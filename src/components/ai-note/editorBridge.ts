import type { Editor } from '@tiptap/react'
import {
  expandToBlockRange,
  applyNodes,
  insertMarkdownAt,
  replaceRangeWithMarkdown,
  serializeRange,
  useEditorSelection,
} from '@/components/editor/aiSelection'

/**
 * 에디터 기반부(`components/editor/aiSelection.ts` · AI 대상 데코 확장)로 나가는 **유일한 문**.
 *
 * 🔴 왜 한 파일로 모았나 — 기반부는 다른 작업 단위가 소유한다. 패널·버블·페이지가 각자
 * import 하면 계약이 바뀔 때 손댈 자리가 흩어지고, 테스트에서도 모듈 하나만 갈아끼울 수
 * 없어진다. 이 파일이 그 접합면이다.
 *
 * 데코 명령(`setAiTarget`·`clearAiTarget`)은 `AiTargetHighlight` 가 `buildEditorExtensions`
 * 에 상시 등록돼 있어(= 공용 에디터 전부가 가진다) 그대로 부른다.
 */

export { useEditorSelection }

export type AiRange = { from: number; to: number }

/** 선택을 최상위 블록 경계로 확장 — 인라인 slice 는 마크(굵게 등)를 잃는다 */
export function expandSelection(editor: Editor): AiRange | null {
  return expandToBlockRange(editor)
}

/** 확장된 범위를 마크다운으로 직렬화 (요청 입력) */
export function serializeSelection(editor: Editor, range: AiRange): string {
  return serializeRange(editor, range)
}

/** [교체] — 범위를 결과 마크다운으로 갈아끼운다 (undo 1회로 복원) */
export function applyReplace(editor: Editor, range: AiRange, markdown: string) {
  return replaceRangeWithMarkdown(editor, range, markdown)
}

/** [아래 삽입] · [커서에 삽입] — 위치에 결과 마크다운을 넣는다 */
export function applyInsertAt(editor: Editor, pos: number, markdown: string) {
  return insertMarkdownAt(editor, pos, markdown)
}

/** qa_toggle 후처리 결과(진짜 토글 노드) 적용 — md 로 표현 못 하는 서식의 전용 통로 */
export function applyNodesAt(editor: Editor, at: number | AiRange, nodes: unknown[]) {
  return applyNodes(editor, at, nodes)
}

/** 패널이 보고 있는 대상을 본문에 표시 */
export function setAiTarget(editor: Editor, range: AiRange): void {
  editor.commands.setAiTarget(range)
}

export function clearAiTarget(editor: Editor): void {
  editor.commands.clearAiTarget()
}
