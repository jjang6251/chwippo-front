import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { canAiTargetSelection } from './editorBridge'

/**
 * 드래그하면 뜨는 「AI」 버튼 — **데스크탑 전용 진입점**.
 *
 * 모바일에는 이걸 두지 않는다. 손가락 선택 위에 뜨는 팝오버는 iOS 기본 선택 메뉴와
 * 자리를 다투고, 시트가 올라오면 어차피 가려진다 — 모바일 진입은 툴바 AI 버튼이다.
 *
 * 🔴 `onMouseDown` 에서 기본 동작을 막는다. 안 막으면 버튼으로 포커스가 옮겨 가며
 * ProseMirror 선택이 풀려, 정작 패널이 잡을 대상이 사라진다 (툴바와 같은 관례).
 *
 * 🔴 노출 판정은 `canAiTargetSelection` 하나로 간다 (study-note-media). 이미지를 클릭하면
 * NodeSelection 이라 `from !== to` 를 통과해 버튼이 떴는데, 정작 AI 가 할 수 있는 게
 * 없었다 — **거짓 어포던스**. 판정을 기반부에 두어 패널 진입(툴바·레일)과 같은 규칙을 탄다.
 */
export function AiNoteBubbleMenu({
  editor,
  onOpen,
}: {
  editor: Editor
  onOpen: () => void
}) {
  return (
    <BubbleMenu
      editor={editor}
      /* 🔴 z-30: sticky 툴바(z-20)보다 위. 선택이 문서 상단이면 버블이 툴바 영역에 겹치는데,
         낮으면 툴바가 포인터를 가로채 버튼이 안 눌린다 (2026-08-19 Playwright 실측) */
      className="hidden lg:block print:hidden z-30"
      shouldShow={({ editor: ed }) => ed.isEditable && canAiTargetSelection(ed)}
    >
      <button
        type="button"
        data-testid="ai-bubble-button"
        aria-label="AI 도움 열기"
        onMouseDown={(e) => {
          e.preventDefault()
          onOpen()
        }}
        onClick={(e) => {
          // 키보드(Enter·Space)는 mousedown 을 안 낸다 — 툴바와 같은 보정
          if (e.detail === 0) onOpen()
        }}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-surface-3 border border-line-strong shadow-md text-[12px] font-medium text-text-secondary hover:text-text-primary hover:border-brand/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <span aria-hidden="true" className="text-brand">
          ✦
        </span>
        AI
      </button>
    </BubbleMenu>
  )
}
