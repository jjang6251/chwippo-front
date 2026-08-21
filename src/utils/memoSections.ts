/**
 * card-detail-remodel — "회사 메모" 리치 에디터 소제목(H3) 유틸 (순수).
 *
 * 회사 메모가 plain textarea → tiptap 리치 에디터로 전환되며, 시작 칩은 대괄호 텍스트가 아니라
 * 진짜 H3 heading 노드를 삽입한다. 여기 함수들은 tiptap doc(JSON) 을 다루는 순수 함수로,
 * 컴포넌트(RichTextEditor/CompanyMemoCard)와 spec 이 공유한다.
 */

export const MEMO_MAX = 2000

/** 시작 칩 — 3종 (지인·인맥 제거, CEO 2026-07-20). H3 heading 텍스트로도 쓰임. */
export const MEMO_SECTIONS = ['왜 이 회사?', '연봉·처우', '면접 분위기'] as const

// ── tiptap 최소 노드 타입 (editor.getJSON() 호환) ──
export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
}
export interface TiptapDoc {
  type: 'doc'
  content?: TiptapNode[]
}

/** 노드의 평문 텍스트 (text 노드 concat) */
function nodeText(node: TiptapNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(nodeText).join('')
}

/** doc 에 title 과 같은 텍스트의 H3(level 3) heading 이 있는지 — 칩 ✓·중복 가드 판정 */
export function docHasHeading(doc: TiptapDoc, title: string): boolean {
  return (doc.content ?? []).some(
    (n) => n.type === 'heading' && n.attrs?.level === 3 && nodeText(n).trim() === title,
  )
}

/** 칩 클릭 시 문서 끝에 삽입할 노드 = H3 heading(title) + 빈 paragraph (커서 이동 대상) */
export function sectionNodes(title: string): TiptapNode[] {
  return [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: title }] },
    { type: 'paragraph' },
  ]
}

/**
 * 글자가 0자여도 **그 자체가 내용인** 노드 (study-note-media PR-A).
 * 필기 블록(`drawing`)이 들어오면 여기에 한 줄 늘린다.
 */
const MEDIA_NODE_TYPES = new Set(['image'])

function hasMediaNode(nodes: TiptapNode[]): boolean {
  return nodes.some((n) => MEDIA_NODE_TYPES.has(n.type) || hasMediaNode(n.content ?? []))
}

/**
 * doc 이 실질적으로 비어있는지 — 텍스트 없는 빈 문단 껍데기 JSON 판정.
 * 빈 tiptap 문서 `{"type":"doc","content":[{"type":"paragraph"}]}` 가 "메모 있음" 으로
 * 오판되는 회귀 방지 (이때 저장 값은 '' 여야 함).
 *
 * 🔴 **글자 수로만 세면 이미지가 사라진다.** 이미지 한 장만 넣은 노트는 텍스트가 0자라
 * 여기서 「빈 문서」로 판정되고, 그러면 `docToMemoValue` 가 저장 값으로 `''` 를 내보내
 * **방금 올린 이미지가 저장 순간 날아간다.** 같은 판정이 공부 노트의 「빈 노트는 떠날 때
 * 스스로 지운다」로도 흘러가 노트째 삭제된다 (`StudyNoteDocPage.tsx`).
 */
export function isEmptyDoc(doc: TiptapDoc): boolean {
  const content = doc.content ?? []
  if (hasMediaNode(content)) return false
  return content.map(nodeText).join('').trim().length === 0
}

/**
 * 에디터 저장 값 — 빈 문서면 '' (껍데기 JSON 저장 방지), 아니면 tiptap JSON 문자열.
 * `''` 는 BoardDetail save 래퍼(`value || undefined`)에서 "메모 없음" 으로 처리됨.
 */
export function docToMemoValue(doc: TiptapDoc): string {
  return isEmptyDoc(doc) ? '' : JSON.stringify(doc)
}

/** 카운터 색 — 기존 회사 메모 관례 (90% warning · 100% danger) */
export function memoCounterColor(count: number, limit: number = MEMO_MAX): string {
  return count >= limit
    ? 'text-danger'
    : count >= limit * 0.9
      ? 'text-warning'
      : 'text-text-quaternary'
}

/** 줄 전체가 정확히 하나의 `[...]` 인지 (중간에 `]` 없음 → `[a] [b]` 는 heading 오변환 X) */
const WHOLE_BRACKET_LINE = /^\[([^\]]+)\]$/

/**
 * legacy plain 메모 → tiptap doc (순수).
 *
 * - JSON.parse 성공 + `type:'doc'` → 그대로 (이미 tiptap doc)
 * - plain text: 줄 단위 변환
 *   - 줄 전체가 `[제목]` → H3 heading 노드 (칩이 삽입했던 `[왜 이 회사?]` 줄 포함)
 *   - 나머지 비어있지 않은 줄 → paragraph
 *   - 빈 줄 → 빈 paragraph (보존)
 *   - 본문 중간에 `[ ]` 가 든 일반 문장은 heading 오변환하지 않음 (줄 전체가 `[...]` 일 때만)
 * - 빈/공백 → 빈 문서 (빈 paragraph 1개)
 */
export function plainMemoToDoc(memo: string | null | undefined): TiptapDoc {
  const raw = memo ?? ''
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed && typeof parsed === 'object' &&
      (parsed as TiptapDoc).type === 'doc' &&
      Array.isArray((parsed as TiptapDoc).content)
    ) {
      return parsed as TiptapDoc
    }
  } catch {
    /* plain text — 아래에서 변환 */
  }

  if (!raw.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] }

  const content: TiptapNode[] = raw.split('\n').map((line) => {
    const m = line.match(WHOLE_BRACKET_LINE)
    // 괄호 안이 공백뿐인 줄(`[ ]` 체크박스 마커 등)은 문단으로 — 빈 text 노드는 ProseMirror 가 거부
    if (m && m[1].trim()) {
      return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: m[1].trim() }] }
    }
    return line.length > 0
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' }
  })
  return { type: 'doc', content }
}
