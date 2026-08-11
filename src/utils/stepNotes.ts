/**
 * card-detail-remodel — 죽은 `pinnedContent`(핵심 메모) 파이프라인을 준비 노트로 lazy 이관.
 *
 * pinnedContent 는 프론트 렌더 표면이 0개(백엔드 dashboard 응답에만 실림 — 소멸된 파이프라인).
 * StepPage 의 "📌 핵심 메모" 섹션을 준비 노트(tiptap)로 통합하며, 기존 데이터는 로드 시
 * 준비 노트 초기 콘텐츠 맨 앞에 "📌 {pinned}" 문단으로 병합해 표시한다.
 * 실제 서버 이관은 사용자가 노트를 저장하는 순간 1회(`notes` 병합본 + `pinnedContent: null`).
 */

type TiptapNode = { type: string; content?: unknown[]; text?: string }

/** plain text 한 줄 → 문단 노드 (빈 줄은 빈 문단) */
function textParagraph(text: string): TiptapNode {
  return text.length > 0
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }
}

/**
 * 준비 노트 초기 콘텐츠에 pinned 텍스트를 "📌 …" 문단으로 병합 (순수).
 *
 * - pinned 없음(null/공백) → notes 그대로 반환 (병합 없음)
 * - pinned 있음 → 줄바꿈 단위 문단으로 변환(첫 문단에 📌 prefix) 후 기존 notes 문서 맨 앞에 prepend
 * - notes 가 tiptap doc JSON 이면 content 배열 앞에 삽입 / null·레거시 plain text 도 안전 처리
 *
 * @returns 병합된 tiptap doc JSON 문자열, 또는 병합할 게 없으면 원본 notes(null 가능)
 */
export function mergePinnedIntoNotes(notes: string | null, pinned: string | null): string | null {
  const trimmed = (pinned ?? '').trim()
  if (!trimmed) return notes

  const pinnedParagraphs: TiptapNode[] = trimmed
    .split('\n')
    .map((line, i) => textParagraph(i === 0 ? `📌 ${line}` : line))

  let baseContent: unknown[] = []
  if (notes) {
    try {
      const parsed = JSON.parse(notes) as unknown
      if (
        parsed && typeof parsed === 'object' &&
        (parsed as TiptapNode).type === 'doc' &&
        Array.isArray((parsed as TiptapNode).content)
      ) {
        baseContent = (parsed as TiptapNode).content as unknown[]
      } else if (typeof parsed === 'string' && parsed.trim()) {
        // JSON.parse 가 문자열을 반환 (따옴표로 감싼 레거시) → 한 문단으로
        baseContent = [textParagraph(parsed)]
      }
    } catch {
      // JSON 아님 (레거시 plain text notes) → 한 문단으로
      if (notes.trim()) baseContent = [textParagraph(notes)]
    }
  }

  return JSON.stringify({ type: 'doc', content: [...pinnedParagraphs, ...baseContent] })
}

/**
 * 줄이 끊기는 노드. `bulletList`·`listItem` 은 **컨테이너라 제외** — 안의 `paragraph` 가
 * 이미 끊는다. 여기에 넣으면 항목마다 빈 줄이 하나씩 더 생긴다.
 */
const LINE_BREAKING = new Set(['paragraph', 'heading', 'codeBlock'])

function nodeToText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  const inner = (node.content ?? [])
    .map((child) => nodeToText(child as TiptapNode))
    .join('')
  return LINE_BREAKING.has(node.type) ? `${inner}\n` : inner
}

/**
 * 준비 노트(tiptap doc JSON) → plain text (순수).
 *
 * 노트 → 면접 질문 은행 다리가 쓴다. 붙여넣기 파서가 **줄 단위**로 쪼개므로
 * 블록마다 `\n` 하나만 넣는다 (tiptap 기본 `getText()` 는 `\n\n` 이라 빈 줄이 생긴다).
 *
 * 🔴 **heading 도 함께 뽑는다.** 면접 스텝 기본 포맷의 `예상 질문 & 답변` 같은 제목이
 * 질문 후보로 섞이지만, 붙여넣기 미리보기가 체크박스로 걸러 낸다 — 여기서 몰래 빼면
 * 제목처럼 적은 **진짜 질문**이 소리 없이 사라진다.
 *
 * 레거시 plain text notes(=JSON 아님)·`null` 도 안전 처리.
 */
export function notesToPlainText(notes: string | null): string {
  if (!notes) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(notes)
  } catch {
    return notes.trim() // 레거시 plain text
  }
  // 따옴표로 감싼 레거시 문자열
  if (typeof parsed === 'string') return parsed.trim()
  if (!parsed || typeof parsed !== 'object') return ''
  return nodeToText(parsed as TiptapNode).trim()
}
