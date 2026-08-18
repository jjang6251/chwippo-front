import type { Editor } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'

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
  { kind: 'link', re: /\[[^\]\n]+\]\([^)\s]+\)/ },
  { kind: 'inlineCode', re: /`[^`\n]+`/ },
]

/**
 * 평문에 섞인 마크다운 신호 종류 수.
 *
 * `task` 가 걸리면 `bullet` 도 같이 걸리는데(둘 다 `- ` 로 시작), 그건 한 줄이 만든
 * 신호 하나라 2종으로 세면 안 된다 — 체크리스트만 붙여넣어도 게이트를 통과해버린다.
 */
export function countMarkdownSignals(text: string): number {
  const kinds = new Set<string>()
  for (const { kind, re } of SIGNALS) {
    if (re.test(text)) kinds.add(kind)
  }
  if (kinds.has('task')) kinds.delete('bullet')
  return kinds.size
}

/** 붙여넣기 파싱 게이트 — 신호 2종 이상 */
export function looksLikeMarkdown(text: string): boolean {
  return countMarkdownSignals(text) >= 2
}

interface MarkdownStorage {
  parser: { parse: (content: string, options?: { inline?: boolean }) => string }
  getMarkdown: () => string
}

/** tiptap-markdown 은 타입 선언에 storage 를 안 붙여 준다 — 여기서 한 번만 보강한다 */
declare module '@tiptap/core' {
  interface Storage {
    markdown?: MarkdownStorage
  }
}

/** 확장이 꺼진 소비처(features.markdown=false)에서도 안전하게 — storage 자체가 없다 */
function markdownStorage(editor: Editor): MarkdownStorage | null {
  const storage = editor.storage.markdown
  return storage && typeof storage.getMarkdown === 'function' && storage.parser ? storage : null
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
 */
export function editorToMarkdown(editor: Editor): string {
  return markdownStorage(editor)?.getMarkdown() ?? editor.getText({ blockSeparator: '\n\n' })
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
export function handleMarkdownPaste(
  editor: Editor,
  text: string,
  characterLimit?: number,
): MarkdownPasteResult {
  if (!looksLikeMarkdown(text)) return { handled: false, truncated: false }
  const storage = markdownStorage(editor)
  if (!storage) return { handled: false, truncated: false }

  const before = editor.state.doc.content.size

  // 🔴 파서 결과(HTML 문자열)를 그대로 insertContent 에 넘기면 안 된다 — Markdown 확장이
  //    `insertContentAt` 을 가로채 **문자열을 한 번 더 마크다운으로 읽는다**. html:false 라
  //    그 두 번째 파싱이 태그를 통째로 이스케이프해서 `&lt;h1&gt;…` 평문이 박힌다.
  //    JSON 은 가로채기 대상이 아니라 그대로 지나간다.
  //    (에디터의 살아 있는 schema 로 파싱한다 — `generateJSON` 은 확장 목록으로 스키마를
  //     새로 짜느라 StarterKit 하위 확장이 중복 등록된 것처럼 보여 경고를 뱉는다.)
  const el = document.createElement('div')
  el.innerHTML = storage.parser.parse(text)
  const parsedDoc = PMDOMParser.fromSchema(editor.schema).parse(el).toJSON() as {
    content?: unknown[]
  }
  editor
    .chain()
    .focus()
    .insertContent((parsedDoc.content ?? []) as Parameters<typeof editor.commands.insertContent>[0])
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
