import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
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
 *
 * ## 🔴 「AI 는 글자에만 동작한다」 (study-note-media, 2026-08-21)
 *
 * 이미지가 낀 범위는 **대상이 되지 않는다** (`rangeHasImage`). 판정을 여기 두는 이유는
 * 선택 해석이 여기 하나뿐이기 때문이다 — 버블·툴바·패널이 각자 재구현하면 한쪽만 뚫린다
 * (모바일은 툴바가 버블 자리를 대신한다). 직렬화도 이미지를 걷어내고 굽는다(2중 방어).
 */

export interface BlockRange {
  from: number
  to: number
}

/** 문서 밖 좌표 방어 — 패널이 들고 있던 좌표는 그 사이 본문이 줄면 문서 밖을 가리킨다 */
function clampRange(doc: ProseMirrorNode, range: BlockRange): BlockRange {
  const from = Math.max(0, Math.min(range.from, doc.content.size))
  return { from, to: Math.max(from, Math.min(range.to, doc.content.size)) }
}

/**
 * 범위 안에 image 노드가 하나라도 있나 — **AI 대상 제외** 판정의 단일 소스.
 *
 * 🔴 AI 는 그림을 못 본다. 요청 규격이 글자 3필드뿐이고(`llm-provider.interface.ts`) 모델도
 * 텍스트 전용이라, 이미지는 `![](R2주소)` 문자열이 되어 그대로 전송된다 — ① 모델이 못 본
 * 그림을 본 척 지어낼 여지 ② 우리 R2 주소는 **로그인 없이 열리는 공개 URL** 이라 외부
 * 전달이 곧 공유다.
 *
 * 🔴 그리고 그 범위를 [교체] 하면 결과 텍스트가 그림을 덮어써 **사진이 사라지고**, 이어지는
 * 저장의 reconcile 이 그 첨부를 미참조로 판정해 R2 객체까지 지운다 (복구 불가).
 *
 * 이미지가 꺼진 소비처(준비·활동·메모)는 스키마에 image 노드가 아예 없어 늘 false 다.
 */
export function rangeHasImage(editor: Editor, range: BlockRange): boolean {
  const { doc } = editor.state
  const { from, to } = clampRange(doc, range)

  let found = false
  doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'image') found = true
    return !found // 하나 찾으면 더 내려가지 않는다
  })
  return found
}

/**
 * 현재 선택을 **최상위 블록 경계로 확장**한 범위. AI 대상이 될 수 없으면 `null`.
 *
 * - 문단 일부만 잡아도 그 문단 전체
 * - 두 문단에 걸치면 두 문단 전체
 * - 리스트·표·토글 **내부**면 그 리스트·표·토글 전체 (depth 1 조상이 그것들이라서)
 * - 끝점이 다음 블록의 첫 칸에 걸치면 그 블록까지 포함된다 — 브라우저가 그 지점을 이미
 *   선택으로 칠하고 있어서, 화면에 보이는 것과 어긋나지 않는 쪽을 택했다
 * - 🔴 글자가 없거나 이미지가 낀 범위는 `null` (= 무선택 생성 모드) — `isAiTargetable`
 */
export function expandToBlockRange(editor: Editor): BlockRange | null {
  const range = blockRangeOf(editor)
  return range && isAiTargetable(editor, range) ? range : null
}

/**
 * 자격 판정 **전**의 확장 범위. 「왜 대상이 아닌가」를 알아야 하는 쪽(패널 안내 문구)이
 * 같이 쓴다 — 이미지 때문에 빠진 것과 애초에 선택이 없는 것은 사용자에게 다른 상황이다.
 */
function blockRangeOf(editor: Editor): BlockRange | null {
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
    if ($pos.depth === 0) return null // 블록 사이 경계 (이미지 옆 갭 커서 등 — 갈 곳이 없다)
    return { from: $pos.before(1), to: $pos.after(1) }
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
 * AI 가 다룰 수 있는 범위인가 — 「AI 는 글자에만 동작한다」가 걸리는 한 자리.
 *
 * - 글자가 없으면(이미지만·구분선만) AI 가 할 일이 없다. 빈 커서 블록을 생성 모드로
 *   보내던 기존 규칙을 **선택에도** 그대로 적용한 것이다
 * - 이미지가 끼면 뺀다 (`rangeHasImage` — 못 읽고, 교체하면 사진이 지워진다)
 */
function isAiTargetable(editor: Editor, range: BlockRange): boolean {
  const text = editor.state.doc.textBetween(range.from, range.to, ' ', ' ').trim()
  return text !== '' && !rangeHasImage(editor, range)
}

/**
 * 지금 **선택**이 AI 대상이 될 수 있나 — 진입 어포던스(버블 메뉴)가 보는 값.
 *
 * 빈 선택은 여기서 false 다. 커서만 둔 블록도 패널의 대상은 되지만(위 주석), 드래그
 * 없이 뜨는 버블은 타이핑 위를 덮는다 — 버블은 「드래그했다」는 신호에만 뜬다.
 */
export function canAiTargetSelection(editor: Editor): boolean {
  return !editor.state.selection.empty && expandToBlockRange(editor) !== null
}

/**
 * 이미지 노드만 뺀 사본. 나머지 구조(문단·표·마크)는 손대지 않는다.
 *
 * 🔴 **문자열 정규식이 아니라 노드 단위**다. `!\[.*\]\(.*\)` 로 지우면 사용자가 코드 블록
 * 안에 적어 둔 마크다운 예시까지 지워져, 모델이 보는 글이 사용자가 쓴 글과 달라진다.
 */
function withoutImages(fragment: Fragment): Fragment {
  const kept: ProseMirrorNode[] = []
  fragment.forEach((node) => {
    if (node.type.name === 'image') return
    // 텍스트 노드는 content 가 없다 — copy() 에 Fragment 를 넘기면 글자가 깨진다
    kept.push(node.isText ? node : node.copy(withoutImages(node.content)))
  })
  return Fragment.fromArray(kept)
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
 *
 * 🔴 **이미지는 걷어내고 굽는다 — LLM 으로 가는 경로의 2중 방어.** 진입 게이트
 * (`expandToBlockRange`)가 이미 이미지 낀 범위를 막지만, 대상을 잡아 둔 뒤 그 자리에
 * 그림이 들어오는 경로가 남는다. 여기까지 새면 공개 R2 주소가 그대로 모델에 실린다.
 *
 * 자리표시 문구로 **치환하지 않고 제거**한다: `[이미지]` 같은 표시는 ① 못 본 그림을
 * 언급하도록 모델을 자극하고 ② 결과에 되울려 나와 [교체] 순간 본문에 평문으로 박힌다.
 *
 * 본문·저장·md 내보내기는 이 함수를 타지 않는다 (`editorToMarkdown` 이 따로다) — 사용자
 * 문서에서는 이미지가 그대로 남는다.
 */
export function serializeRange(editor: Editor, range: BlockRange): string {
  const { doc } = editor.state
  const { from, to } = clampRange(doc, range)

  const storage = markdownStorage(editor)
  // 평문 fallback 은 textBetween 이라 애초에 이미지가 안 실린다
  if (!storage) return doc.textBetween(from, to, '\n\n').trim()

  return storage.serializer.serialize(withoutImages(doc.slice(from, to).content)).trim()
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
  /**
   * 잡힌 블록에 이미지가 있어 **대상에서 빠졌나** — 패널 안내 문구가 이걸로 갈린다.
   *
   * 🔴 이게 없으면 이미지를 고른 사용자에게 "본문을 다듬으려면 드래그하세요" 가 뜬다.
   * 방금 드래그한 사람에게는 기능이 고장 난 것으로 읽힌다.
   */
  hasImage: boolean
}

const NO_SELECTION: EditorSelectionState = {
  empty: true,
  from: 0,
  to: 0,
  charCount: 0,
  hasImage: false,
}

function readSelection(editor: Editor): EditorSelectionState {
  const expanded = blockRangeOf(editor)
  const range = expanded && isAiTargetable(editor, expanded) ? expanded : null
  if (!range) {
    const { from } = editor.state.selection
    return {
      empty: true,
      from,
      to: from,
      charCount: 0,
      hasImage: expanded ? rangeHasImage(editor, expanded) : false,
    }
  }
  return {
    empty: false,
    ...range,
    charCount: editor.state.doc.textBetween(range.from, range.to, '\n', '\n').length,
    hasImage: false, // 자격을 통과했다 = 이미지가 없다
  }
}

function sameSelection(a: EditorSelectionState, b: EditorSelectionState): boolean {
  return (
    a.empty === b.empty &&
    a.from === b.from &&
    a.to === b.to &&
    a.charCount === b.charCount &&
    a.hasImage === b.hasImage
  )
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
