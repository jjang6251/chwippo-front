import { useEffect, useRef, type RefObject } from 'react'

/**
 * `role="menu"` 드롭다운의 **키보드 조작**을 한 곳에서 책임진다.
 *
 * 쓰는 곳 (세 군데가 전부 — `role="menu"` 를 선언한 곳 전수):
 *   - `components/editor/EditorToolbar` 「내보내기」 형식 선택
 *   - `pages/StudyNotes/StudyNoteDocPage` 의 `DocMenu` (노트 메뉴)
 *   - `pages/StudyNotes/HubRows` 의 `DotsMenu` (허브 행 ⋯)
 *
 * 트리거·앵커 방식은 셋이 서로 다르지만(스크롤 행 안 버튼 + 좌표 계산 ↔ ⋯ 버튼 + relative
 * 부모) **키보드 동작은 그 차이와 무관**하다. `role="menu"` 를 선언한 이상 화살표 이동이
 * 표준 기대이고, 세 곳이 각자 다르게 움직이는 게 제일 나쁘므로 여기서 하나로 묶는다.
 *
 * ## 담당 범위
 *   ↓ ↑        항목 순환 (끝 ↔ 처음). 포커스가 메뉴 밖이면 ↓=첫 항목 · ↑=마지막 항목
 *   Home End   처음 / 마지막
 *   ESC        닫기 — **이 훅이 유일한 주인**이다 (각 메뉴는 ESC 를 직접 듣지 않는다)
 *   닫힘       포커스가 메뉴 안에 있었다면 트리거로 되돌린다
 *
 * ## 담당하지 **않는** 것
 *   Enter·Space  네이티브 `<button>` 이 이미 click 으로 바꿔준다. 가로채면 두 번 실행되거나
 *                Space 스크롤 방지 같은 기본기를 우리가 다시 짜야 한다 — 손대지 않는다.
 *   바깥 클릭    닫는 **경계**가 메뉴마다 다르다 (툴바 전체 ↔ 트리거+메뉴 상자). 각 메뉴가
 *                자기 경계로 판정하는 게 맞아 그대로 뒀다. 이 훅은 "마우스로 운전 중" 인지만
 *                엿듣는다 (아래 `onDown` — 닫지는 않는다).
 *
 * ## 🔴 열었을 때 첫 항목 포커스 — **키보드로 열었을 때만**
 *
 * 마우스로 열었을 때까지 강제로 포커스를 주면 (1) 안 누른 포커스 링이 뜬금없이 뜨고,
 * (2) EditorToolbar 는 트리거가 `mousedown` 을 `preventDefault` 해서 **ProseMirror 선택
 * 영역을 일부러 살려두는데** 그 선택이 통째로 날아간다 (형광펜·링크가 선택 기반이라 곧
 * 기능 고장이다). WAI-ARIA APG 도 마우스 열기의 포커스 배치는 선택 사항으로 둔다.
 * 반대로 키보드로 열었으면 포커스를 안 옮기는 순간 조작할 방법이 사라진다 — 그래서 준다.
 *
 * 판정은 `click` 의 `detail === 0` (= 키보드로 발생한 click) — EditorToolbar 가 이미 쓰던
 * 관용구다. 세 메뉴 모두 트리거에서 `markOpenedByKeyboard(e.detail === 0)` 을 부른다.
 */
interface UseMenuKeyboardOptions {
  /** 메뉴가 열려 있나 */
  open: boolean
  /** `role="menu"` 상자. 열렸을 때만 존재한다 (조건부 렌더) */
  menuRef: RefObject<HTMLElement | null>
  /** 메뉴를 여는 버튼. 닫을 때 포커스가 여기로 돌아온다 */
  triggerRef: RefObject<HTMLElement | null>
  /** ESC 로 닫기 — 각 메뉴의 닫기 함수 */
  onClose: () => void
}

interface UseMenuKeyboardApi {
  /** 트리거의 click 핸들러에서 `e.detail === 0` 을 그대로 넘긴다 */
  markOpenedByKeyboard: (viaKeyboard: boolean) => void
}

export function useMenuKeyboard({
  open,
  menuRef,
  triggerRef,
  onClose,
}: UseMenuKeyboardOptions): UseMenuKeyboardApi {
  const openedByKeyboardRef = useRef(false)
  /** 지금 포커스가 메뉴 안인가 — 닫을 때 트리거로 되돌릴지 판단하는 유일한 근거 */
  const focusInsideRef = useRef(false)
  /**
   * 세 메뉴 모두 `onClose` 를 인라인 화살표로 넘긴다 — deps 에 넣으면 렌더마다 리스너가
   * 재등록되고, 그때마다 cleanup 이 돌아 **포커스가 트리거로 튄다.** 최신 값만 ref 로 받는다.
   */
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    /* 🔴 cleanup 시점에 읽지 않고 지금 잡아둔다 — 그때는 메뉴가 이미 사라진 뒤다 */
    const trigger = triggerRef.current

    /**
     * 🔴 항목은 **그때그때 질의**한다. 허브 ⋯ 메뉴는 폴더 수에 따라 항목이 2~N 개로
     * 달라지고, 노트 메뉴는 앱(WebView)에서 「PDF로 저장」이 통째로 빠진다. 열 때 한 번
     * 담아두면 그 사이 바뀐 목록으로 순환이 어긋난다.
     */
    const itemsOf = (): HTMLElement[] => {
      const root = menuRef.current
      if (!root) return []
      return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
      )
    }

    /** `pick` 이 고른 자리로 포커스 이동. `current` 는 메뉴 밖이면 -1 */
    const focusItem = (pick: (count: number, current: number) => number) => {
      const items = itemsOf()
      if (items.length === 0) return
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = items[pick(items.length, current)]
      if (!next) return
      focusInsideRef.current = true
      next.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 뒤의 모달까지 같이 닫히지 않게 — 세 메뉴가 각자 쓰던 규약을 그대로 이어받는다
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      // 화살표·Home·End 는 페이지 스크롤과 본문 캐럿 이동을 막고 메뉴 안에서만 쓴다
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        focusItem((n, cur) => (cur < 0 ? 0 : (cur + 1) % n))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        focusItem((n, cur) => (cur < 0 ? n - 1 : (cur - 1 + n) % n))
      } else if (e.key === 'Home') {
        e.preventDefault()
        e.stopPropagation()
        focusItem(() => 0)
      } else if (e.key === 'End') {
        e.preventDefault()
        e.stopPropagation()
        focusItem((n) => n - 1)
      }
      // Enter·Space 는 손대지 않는다 (위 주석)
    }

    const onFocusIn = (e: FocusEvent) => {
      focusInsideRef.current = menuRef.current?.contains(e.target as globalThis.Node) ?? false
    }

    /**
     * 메뉴 밖을 마우스로 누른 순간부터는 "마우스로 운전 중" 이다 — 닫을 때 포커스를 뺏지
     * 않는다. (닫는 일 자체는 각 메뉴가 자기 경계로 한다. 여기서는 기록만 한다.)
     *
     * 🔴 **capture 단계**여야 한다. 각 메뉴의 "바깥 클릭 = 닫기" 리스너도 document 에 있어서,
     * bubble 로 달면 그쪽이 먼저 닫아버린 뒤에 기록하게 될 수 있다 — 그러면 마우스로 바깥을
     * 눌렀는데 포커스가 트리거로 튄다. capture 는 항상 먼저 도착한다.
     */
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as globalThis.Node)) focusInsideRef.current = false
    }

    focusInsideRef.current = false
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('mousedown', onDown, true)

    if (openedByKeyboardRef.current) focusItem(() => 0)
    openedByKeyboardRef.current = false

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('mousedown', onDown, true)
      /**
       * 🔴 트리거로 포커스 복귀. 안 하면 ESC 뒤 포커스가 body 로 날아가 다음 Tab 이 페이지
       * 맨 앞으로 튄다. 언마운트로 닫힌 경우엔 ref 가 이미 null 이라 아무 일도 안 한다.
       */
      if (focusInsideRef.current) trigger?.focus()
      focusInsideRef.current = false
    }
  }, [open, menuRef, triggerRef])

  return {
    markOpenedByKeyboard: (viaKeyboard: boolean) => {
      openedByKeyboardRef.current = viaKeyboard
    },
  }
}
