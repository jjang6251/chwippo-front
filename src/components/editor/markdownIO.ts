import type { Editor } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { convertNotionAsideMarkdown } from './notionPaste'

/**
 * study-notes Phase 2a — 마크다운 붙여넣기 파싱 · 내보내기.
 *
 * ## 파서 선택 근거 (실측 2026-08-18)
 *
 * | 후보 | 결과 |
 * |---|---|
 * | 공식 `@tiptap/markdown` | peerDependencies 가 `@tiptap/core` **정확한 버전 고정**(3.23.2 → 3.23.2). 쓰려면 @tiptap/* 14개를 3.22.5 → 3.30.x 로 일괄 올려야 한다 — 준비·활동 노트가 다 얹혀 있는 판에 회귀 표면이 너무 넓다 |
 * | 커뮤니티 `tiptap-markdown` (채택) | peer `^3.0.1` 로 현행 3.22.5 그대로 동작. 실측에서 표·체크리스트(checked)·코드 언어(`language: "c"`)·인용·구분선·링크 전부 보존 |
 * | `marked` → HTML → tiptap | 표·코드 언어는 되지만 **체크리스트가 통째로 소실**(taskItem → 평범한 listItem, checked 없음). 게다가 내보내기 경로가 따로 필요 |
 *
 * ## 붙여넣기 게이트
 *
 * `tiptap-markdown` 의 `transformPastedText` 는 **켜면 모든 평문을 마크다운으로 읽는다**.
 * 그러면 "- 면접 복장 준비" 같은 평범한 메모 줄이 목록으로 튀고, `2 * 3 = 6` 이
 * 기울임으로 먹힌다. 그래서 그 옵션은 끄고, 여기 신호 판정을 통과할 때만 파싱한다.
 */

const LINK_RE = /\[[^\]\n]+\]\([^)\s]+\)/
/** 이미지 `![alt](url)` — alt 는 비어도 된다 (`![](url)` 이 우리 내보내기 형태다) */
const IMAGE_RE = /!\[[^\]\n]*\]\([^)\s]+\)/
const IMAGE_RE_GLOBAL = new RegExp(IMAGE_RE.source, 'g')

/** 마크다운 신호 — **서로 다른 종류가 2개 이상**일 때만 파싱한다 (같은 종류 반복은 1로 센다) */
const SIGNALS: ReadonlyArray<{ kind: string; re: RegExp }> = [
  { kind: 'heading', re: /^#{1,6}[ \t]+\S/m },
  { kind: 'fence', re: /^```/m },
  { kind: 'task', re: /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+\S/m },
  { kind: 'bullet', re: /^[ \t]*[-*+][ \t]+\S/m },
  { kind: 'ordered', re: /^[ \t]*\d+\.[ \t]+\S/m },
  { kind: 'quote', re: /^>[ \t]+\S/m },
  { kind: 'table', re: /^\|.*\|[ \t]*$/m },
  { kind: 'hr', re: /^(?:-{3,}|\*{3,}|_{3,})[ \t]*$/m },
  { kind: 'bold', re: /\*\*[^\s*][^*]*\*\*/ },
  { kind: 'link', re: LINK_RE },
  { kind: 'inlineCode', re: /`[^`\n]+`/ },
  { kind: 'image', re: IMAGE_RE },
]

/**
 * 평문에 섞인 마크다운 신호 종류 수.
 *
 * `task` 가 걸리면 `bullet` 도 같이 걸리는데(둘 다 `- ` 로 시작), 그건 한 줄이 만든
 * 신호 하나라 2종으로 세면 안 된다 — 체크리스트만 붙여넣어도 게이트를 통과해버린다.
 *
 * `image` ↔ `link` 도 같은 겹침이다 — `![alt](url)` 안에 `[alt](url)` 이 그대로 들어 있다.
 * 다만 이미지 문법을 **걷어낸 뒤에도** 링크가 남으면 그건 진짜 별개 신호라 그대로 센다
 * (task/bullet 처럼 무조건 지우면 「이미지 + 링크」 문서가 게이트에서 막힌다).
 */
export function countMarkdownSignals(text: string): number {
  const kinds = new Set<string>()
  for (const { kind, re } of SIGNALS) {
    if (re.test(text)) kinds.add(kind)
  }
  if (kinds.has('task')) kinds.delete('bullet')
  if (kinds.has('image') && !LINK_RE.test(text.replace(IMAGE_RE_GLOBAL, ''))) {
    kinds.delete('link')
  }
  return kinds.size
}

/** 붙여넣기 파싱 게이트 — 신호 2종 이상 */
export function looksLikeMarkdown(text: string): boolean {
  return countMarkdownSignals(text) >= 2
}

export interface MarkdownStorage {
  parser: { parse: (content: string, options?: { inline?: boolean }) => string }
  /**
   * 문서·조각 → 마크다운. `doc.slice(from, to).content`(Fragment)를 그대로 받는다 —
   * 라이브러리 자신이 클립보드 직렬화에 같은 방식으로 쓴다(`clipboardTextSerializer`).
   */
  serializer: { serialize: (content: Fragment | PMNode) => string }
  getMarkdown: () => string
}

/** tiptap-markdown 은 타입 선언에 storage 를 안 붙여 준다 — 여기서 한 번만 보강한다 */
declare module '@tiptap/core' {
  interface Storage {
    markdown?: MarkdownStorage
  }
}

/** 확장이 꺼진 소비처(features.markdown=false)에서도 안전하게 — storage 자체가 없다 */
export function markdownStorage(editor: Editor): MarkdownStorage | null {
  const storage = editor.storage.markdown
  return storage && typeof storage.getMarkdown === 'function' && storage.parser && storage.serializer
    ? storage
    : null
}

/**
 * 문서 → 마크다운 (내보내기).
 *
 * 🔴 **열화 명세** — 마크다운에 없는 서식은 아래처럼 떨어진다. 되돌릴 수 없으니
 * 내보내기 UI 는 이 사실을 문구로 알려야 한다.
 * - 토글(details) → `**제목**` + 본문 (접힘 상태·self-test 성격 소실)
 * - 형광펜(highlight) → 색이 사라지고 글자만 남는다
 * - 멘션 칩 → `[제목](/study-notes/:id)` 링크 (칩 시각·끊긴 링크 표시 소실)
 * - 표·체크리스트·코드 언어·인용·구분선은 보존된다
 * - 이미지 → `![](url)` 로 보존. 단 **URL 을 들고 나가는 것**이라, 노트를 지우면
 *   그 파일도 정리돼 내보낸 마크다운의 이미지가 깨진다
 */
export function editorToMarkdown(editor: Editor): string {
  return markdownStorage(editor)?.getMarkdown() ?? editor.getText({ blockSeparator: '\n\n' })
}

/**
 * 마크다운 → **doc JSON 노드 배열**. 붙여넣기와 AI 결과 삽입이 같이 쓴다.
 *
 * 🔴 **여기엔 `looksLikeMarkdown` 게이트가 없다.** 게이트는 "사용자가 붙여넣은 평문을
 * 마음대로 재조립하지 않는다" 는 규칙이라 붙여넣기 경로에만 있어야 한다. AI 결과는
 * 애초에 마크다운으로 달라고 시킨 출력이고, 「쉽게 풀어쓰기」 처럼 **신호가 0종인 산문**이
 * 정상 결과인 액션이 있다 — 게이트를 여기에 두면 그 결과가 통째로 삼켜진다.
 *
 * 🔴 결과는 **JSON 으로만** 삽입해야 한다. 문자열을 `insertContent(At)` 에 넘기면 Markdown
 * 확장이 그 명령을 가로채 한 번 더 마크다운으로 읽고(html:false 라) 태그를 이스케이프해서
 * `&lt;h1&gt;…` 평문이 박힌다. JSON 은 가로채기 대상이 아니라 그대로 지나간다.
 *
 * (에디터의 **살아 있는 schema** 로 파싱한다 — `generateJSON` 은 확장 목록으로 스키마를
 *  새로 짜느라 StarterKit 하위 확장이 중복 등록된 것처럼 보여 경고를 뱉는다.)
 *
 * 마크다운 확장이 꺼진 소비처거나 내용이 비면 빈 배열 — 삽입 측이 "넣을 게 없다" 로 받는다.
 */
export function markdownToDocNodes(editor: Editor, markdown: string): unknown[] {
  const storage = markdownStorage(editor)
  if (!storage) return []

  const el = document.createElement('div')
  el.innerHTML = storage.parser.parse(markdown)
  const parsedDoc = PMDOMParser.fromSchema(editor.schema).parse(el).toJSON() as {
    content?: unknown[]
  }
  return parsedDoc.content ?? []
}

export interface MarkdownPasteResult {
  /** 파싱해서 삽입했는가 (false = 평문 그대로 두고 브라우저 기본 동작에 맡김) */
  handled: boolean
  /**
   * 글자수 제한 때문에 내용이 다 못 들어갔는가 — 소비 측이 안내 문구를 띄운다.
   *
   * CharacterCount 는 넘치는 만큼 잘라내지만, 잘라내고도 여전히 넘치면 **트랜잭션 자체를
   * 거부한다**(한 글자도 안 들어간다). 사용자 입장에선 둘 다 "붙여넣었는데 다 안 들어갔다"
   * 라서 같은 신호로 묶는다 — 안 그러면 통째 거부가 아무 안내 없이 조용히 지나간다.
   */
  truncated: boolean
}

/**
 * 붙여넣은 평문이 마크다운이면 파싱해 삽입한다.
 *
 * 글자 제한(CharacterCount)이 걸려 있으면 초과분은 **조용히 잘린다** — 그래서 삽입
 * 전후 글자수를 재서 잘렸는지 돌려준다 (10만자 노트에 긴 AI 답변을 붙이는 흐름).
 */
/**
 * 클립보드의 text/html 이 **코드 에디터 복사물**(VS Code 등)인지 판정.
 *
 * 🔴 왜 필요한가 (2026-08-19 실사용): 학습 md 파일을 VS Code 에서 복사해 붙이면
 * 클립보드에 "색칠된 평문" HTML 이 같이 실린다. 기존 로직은 HTML 이 있으면 마크다운
 * 파싱을 양보했는데(웹페이지 복사엔 그게 맞다), 코드 에디터의 HTML 은 서식이 아니라
 * **모노스페이스로 칠한 생 텍스트**라 — 양보하면 마크다운이 문자 그대로 박힌다.
 *
 * 판정: 코드 에디터 HTML 의 시그니처는 인라인 스타일의 모노스페이스 폰트 지정이다
 * (VS Code: `font-family: Menlo/Monaco/Consolas/'Courier New'/monospace…` + `white-space: pre`).
 * 웹페이지·노션 복사물엔 이 조합이 통째로 걸리지 않는다 (코드블록 일부에만 있을 수 있어
 * **문서 앞부분**에서만 본다 — 전체 검색이면 코드블록 하나로 오탐).
 */
export function looksLikeCodeEditorHtml(html: string): boolean {
  const head = html.slice(0, 600)
  return /font-family:[^;"']*(?:Menlo|Monaco|Consolas|Courier|monospace)/i.test(head)
}

export function handleMarkdownPaste(
  editor: Editor,
  text: string,
  characterLimit?: number,
): MarkdownPasteResult {
  // 노션 콜아웃(`<aside>` 단독 줄) → 인용. 게이트 **전에** 손본다 — 게이트는 실제로
  // 삽입할 문자열을 봐야 한다 (판정·변환 근거는 notionPaste.ts)
  const md = convertNotionAsideMarkdown(text)
  if (!looksLikeMarkdown(md)) return { handled: false, truncated: false }
  if (!markdownStorage(editor)) return { handled: false, truncated: false }

  const before = editor.state.doc.content.size

  editor
    .chain()
    .focus()
    .insertContent(
      markdownToDocNodes(editor, md) as Parameters<typeof editor.commands.insertContent>[0],
    )
    .run()
  const after = editor.state.doc.content.size

  // 제한이 없으면 잘릴 일이 없다. 있으면 (a) 한 글자도 안 들어갔거나 (b) 문서가 정확히
  // 상한에서 멈췄을 때 "다 못 들어갔다" 로 본다
  const truncated =
    characterLimit !== undefined &&
    (after === before ||
      (editor.storage.characterCount?.characters?.() ?? 0) >= characterLimit)

  return { handled: true, truncated }
}
