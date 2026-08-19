import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { CharacterCount, type CharacterCountOptions } from '@tiptap/extensions'
import { markdownStorage, markdownToDocNodes } from './markdownIO'

/**
 * note-ai-panel — 에디터 ↔ AI 패널 사이의 **순수 유틸 층**.
 *
 * 패널 UI 는 이 파일을 모른 채로도 성립하는 계약만 쓴다: 선택을 범위로 바꾸고(확장),
 * 범위를 마크다운으로 굽고, 결과 마크다운을 문서로 되돌린다.
 *
 * ## 왜 「블록 경계로 확장」 인가 (2026-08-19 실측)
 *
 * 인라인 조각(`doc.slice(from, to)`)도 직렬화는 된다. 그런데 **마크가 사라진다** —
 * 굵게 걸린 단어의 일부만 걸친 선택을 구우면 `**…**` 가 빠진 맨 글자가 나온다.
 * 블록 전체를 구우면 표·체크리스트·코드 언어까지 완벽하게 나온다.
 * 그래서 선택은 **최상위 블록(depth 1) 경계로 확장**한 뒤 굽고, 교체도 그 범위로 한다.
 *
 * 부작용은 의도된 것이다: 리스트·표·토글 **안**을 선택하면 depth 1 조상이 그 리스트·표·토글
 * 이라서 **통째로** 잡힌다. 사용자에게는 하이라이트 데코(`aiTargetHighlight`)가 잡힌 범위를
 * 그대로 보여 주므로, "생각보다 넓게 잡혔다" 가 눈에 보인 상태에서 요청하게 된다.
 */

export interface BlockRange {
  from: number
  to: number
}

/**
 * 현재 선택을 **최상위 블록 경계로 확장**한 범위. 빈 선택(커서만)이면 `null`.
 *
 * - 문단 일부만 잡아도 그 문단 전체
 * - 두 문단에 걸치면 두 문단 전체
 * - 리스트·표·토글 **내부**면 그 리스트·표·토글 전체 (depth 1 조상이 그것들이라서)
 * - 끝점이 다음 블록의 첫 칸에 걸치면 그 블록까지 포함된다 — 브라우저가 그 지점을 이미
 *   선택으로 칠하고 있어서, 화면에 보이는 것과 어긋나지 않는 쪽을 택했다
 */
export function expandToBlockRange(editor: Editor): BlockRange | null {
  const { doc, selection } = editor.state
  const { from, to, empty } = selection

  /**
   * 🔴 빈 선택 = **커서가 놓인 최상위 블록**이 대상이다 (2026-08-19 CEO 실기).
   * "표에 커서 두고 채워달라" 했더니 생성 모드로 빠져 모델이 기존 표를 못 보고
   * 새 표를 지어냈다. 커서 블록이 **텍스트 없는 빈 블록이면** 기존대로 null
   * (= 무선택 생성 모드) — 새로 만들기는 보통 빈 줄에서 하므로 두 의도가 자연히 갈린다.
   */
  if (empty) {
    const $pos = doc.resolve(from)
    if ($pos.depth === 0) return null // 블록 사이 경계 (갈 곳 없음)
    const range = { from: $pos.before(1), to: $pos.after(1) }
    const text = doc.textBetween(range.from, range.to, ' ', ' ').trim()
    return text ? range : null
  }

  const $from = doc.resolve(from)
  const $to = doc.resolve(to)

  // depth 0 = 최상위 블록 **사이**를 가리키는 위치 (NodeSelection·AllSelection). 이미 경계다
  return {
    from: $from.depth === 0 ? from : $from.before(1),
    to: $to.depth === 0 ? to : $to.after(1),
  }
}

/**
 * 범위 → 마크다운. 서버로 보내는 `selectionMd` 가 이 값이다.
 *
 * 블록 경계 범위라 조각이 열려 있지 않아(openStart/openEnd = 0) 표·체크리스트·코드 언어·
 * 마크가 전부 살아서 나온다. 마크다운 확장이 꺼진 소비처에서는 평문으로 떨어진다
 * (`editorToMarkdown` 과 같은 정책 — 던지지 않는다).
 *
 * 범위는 문서 크기로 한 번 조인다. 패널이 들고 있던 좌표는 사용자가 그 사이 본문을 지우면
 * 문서 밖을 가리키는데, `doc.slice` 는 그때 예외를 던진다(렌더 중이면 화면이 죽는다).
 */
export function serializeRange(editor: Editor, range: BlockRange): string {
  const { doc } = editor.state
  const from = Math.max(0, Math.min(range.from, doc.content.size))
  const to = Math.max(from, Math.min(range.to, doc.content.size))

  const storage = markdownStorage(editor)
  if (!storage) return doc.textBetween(from, to, '\n\n').trim()

  return storage.serializer.serialize(doc.slice(from, to).content).trim()
}

export interface MarkdownApplyResult {
  /** 문서가 실제로 바뀌었는가 (빈 결과·마크다운 확장 꺼짐·글자수 상한 거부 = false) */
  ok: boolean
  /**
   * 글자수 제한 때문에 결과가 다 못 들어갔는가 — 패널이 안내 문구를 띄운다.
   * 붙여넣기(`handleMarkdownPaste`)와 같은 판정: 통째 거부도, 상한에서 잘린 것도 같은 신호다.
   */
  truncated: boolean
}

/** 에디터에 걸린 글자수 상한 (CharacterCount 미등록이면 undefined) */
function characterLimitOf(editor: Editor): number | undefined {
  const extension = editor.extensionManager.extensions.find((e) => e.name === CharacterCount.name)
  const limit = (extension?.options as CharacterCountOptions | undefined)?.limit
  return typeof limit === 'number' && limit > 0 ? limit : undefined
}

/**
 * 마크다운을 **한 번의 트랜잭션**으로 밀어 넣는다 = 되돌리기 한 번에 원상복구.
 *
 * 🔴 `ok` 를 문서 **크기**로 판정하면 안 된다 — 교체는 들어간 만큼 나가서 크기가 같을 수
 * 있다. 그리고 CharacterCount 는 상한을 넘는 트랜잭션을 통째로 거부하는데, 그때도
 * `run()` 은 `true` 를 돌려준다(명령은 성공했고 dispatch 가 걸러졌을 뿐이다).
 * 그래서 **doc 객체 동일성**으로 본다: 스텝이 실제로 적용됐으면 새 doc 이 만들어진다.
 */
function applyMarkdown(
  editor: Editor,
  at: number | BlockRange,
  markdown: string,
): MarkdownApplyResult {
  // 공백뿐인 결과는 넣을 게 없다. 🔴 `nodes.length` 로는 못 거른다 — 파서가 빈 문단 하나를
  //    돌려주기 때문에, 이 가드가 없으면 빈 결과가 문서에 빈 줄을 박는다
  if (!markdown.trim()) return { ok: false, truncated: false }

  // 🔴 게이트(looksLikeMarkdown) 없이 파싱한다 — 「쉽게 풀어쓰기」 결과처럼 마크다운 신호가
  //    0종인 산문이 정상 결과다. 게이트를 태우면 그 결과가 통째로 버려진다 (markdownIO 주석)
  const nodes = markdownToDocNodes(editor, markdown)
  return applyNodes(editor, at, nodes)
}

/**
 * 미리 조립한 JSON 노드를 넣는다 — qa_toggle 후처리(마크다운으로 표현 못 하는 토글)가 쓴다.
 * 마크다운 경로와 같은 안전장치(clamp·doc 동일성 ok·100K truncated)를 공유한다.
 */
export function applyNodes(
  editor: Editor,
  at: number | BlockRange,
  nodes: unknown[],
): MarkdownApplyResult {
  const limit = characterLimitOf(editor)
  const beforeDoc = editor.state.doc

  // 낡은 좌표(요청 사이에 본문이 줄어든 경우)로 replaceWith 를 부르면 ProseMirror 가 던진다 —
  // 클릭 핸들러에서 터지면 패널이 통째로 멈춘다. 직렬화와 같은 정책으로 조인다
  const size = beforeDoc.content.size
  const clamp = (pos: number) => Math.max(0, Math.min(pos, size))
  const target = typeof at === 'number' ? clamp(at) : { from: clamp(at.from), to: clamp(at.to) }

  const dispatched = editor
    .chain()
    // 🔴 문자열이 아니라 **JSON 노드 배열**을 넘긴다 (문자열이면 Markdown 확장이 한 번 더
    //    파싱해 `&lt;h1&gt;` 평문이 박힌다 — markdownIO 주석)
    .insertContentAt(target, nodes as Parameters<typeof editor.commands.insertContentAt>[1])
    // 적용 지점이 화면 밖일 수 있다. 포커스는 **뺏지 않는다** — 멀티턴 패널이라 사용자는
    // 이어서 지시를 쓰는 중이고, 여기서 본문으로 커서를 끌어오면 입력이 끊긴다
    .scrollIntoView()
    .run()

  const ok = dispatched && editor.state.doc !== beforeDoc
  const characters = editor.storage.characterCount?.characters?.() ?? 0

  return { ok, truncated: limit !== undefined && (!ok || characters >= limit) }
}

/** 범위를 AI 결과로 교체 — [교체] 버튼. 되돌리기 1회로 원본 복구 */
export function replaceRangeWithMarkdown(
  editor: Editor,
  range: BlockRange,
  markdown: string,
): MarkdownApplyResult {
  return applyMarkdown(editor, range, markdown)
}

/** 지정 위치에 AI 결과 삽입 — [아래 삽입](= 확장 범위의 `to`) · 무선택 생성의 [커서 위치에 삽입] */
export function insertMarkdownAt(
  editor: Editor,
  position: number,
  markdown: string,
): MarkdownApplyResult {
  return applyMarkdown(editor, position, markdown)
}

export interface EditorSelectionState {
  /** 빈 선택(커서만) = 패널의 **생성 모드** */
  empty: boolean
  /** AI 대상 범위 — 블록 경계로 확장된 값. 빈 선택이면 from = to = 커서 위치 */
  from: number
  to: number
  /**
   * 확장 범위의 **텍스트** 길이 — 패널 카운터(`N / 6,000자`)용.
   *
   * ⚠️ 서버가 캡을 재는 `selectionMd` 는 이보다 길다 (`##`·`|`·`- [ ]` 같은 문법 문자가
   * 붙는다). 정확한 길이는 `serializeRange` 로만 나오는데 그건 요청 직전에 한 번 구우면
   * 되는 값이라, 매 선택마다 굽지 않는다. 카운터는 "대충 얼마나 잡혔나" 를 보여 주는 값이고
   * 최종 판정은 서버 문구가 한다.
   */
  charCount: number
}

const NO_SELECTION: EditorSelectionState = { empty: true, from: 0, to: 0, charCount: 0 }

function readSelection(editor: Editor): EditorSelectionState {
  const range = expandToBlockRange(editor)
  if (!range) {
    const { from } = editor.state.selection
    return { empty: true, from, to: from, charCount: 0 }
  }
  return {
    empty: false,
    ...range,
    charCount: editor.state.doc.textBetween(range.from, range.to, '\n', '\n').length,
  }
}

function sameSelection(a: EditorSelectionState, b: EditorSelectionState): boolean {
  return a.empty === b.empty && a.from === b.from && a.to === b.to && a.charCount === b.charCount
}

/**
 * 선택 상태 구독 — 패널이 대상 범위·카운터·모드(변환/생성)를 그린다.
 *
 * 🔴 `transaction` 을 직접 구독한다 (EditorToolbar 와 같은 이유). 부모의 `onUpdate` 재렌더만
 * 믿으면 **커서만 움직인 경우**를 놓친다 — 문서가 안 바뀌면 `onUpdate` 가 안 온다. 그러면
 * 드래그로 선택만 바꿔도 패널의 대상·카운터가 직전 값에 멈춘다.
 *
 * transaction 은 타이핑 한 글자마다 흐르므로, 값이 그대로면 상태를 갈지 않는다(재렌더 억제).
 */
export function useEditorSelection(editor: Editor | null | undefined): EditorSelectionState {
  const [state, setState] = useState<EditorSelectionState>(() =>
    editor ? readSelection(editor) : NO_SELECTION,
  )

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      setState((prev) => {
        const next = readSelection(editor)
        return sameSelection(prev, next) ? prev : next
      })
    }
    // 에디터는 첫 렌더에 없다(useEditor 가 null 을 준다) — 뒤늦게 생긴 경우를 한 번 맞춰 준다
    sync()
    editor.on('transaction', sync)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])

  // 에디터가 아직·더는 없으면 직전 값이 아니라 빈 상태 (effect 에서 setState 로 되돌리지 않는다)
  return editor ? state : NO_SELECTION
}
