import { expect } from 'vitest'
import { fireEvent } from '@testing-library/react'

/**
 * `role="menu"` 드롭다운 **세 곳이 똑같이 움직이는지**를 재는 공용 계약.
 *
 * 세 메뉴(EditorToolbar 내보내기 · StudyNoteDocPage DocMenu · HubRows DotsMenu)는 트리거도
 * 앵커도 항목 수도 다르지만 키보드 동작만은 `useMenuKeyboard` 하나를 공유한다. 그 "같음"을
 * 말로 주장하지 않고 **문자 그대로 같은 단언문**을 셋에 돌려서 증명한다 — 각 spec 이
 * 여기 `assertMenuKeyboardContract` 를 부른다.
 *
 * 재는 것 (항목 수와 무관하게 그때그때 질의한 목록 기준):
 *   ↓ ↑        순환 (끝 → 처음 / 처음 → 마지막) · 포커스가 메뉴 밖이면 ↓=첫 · ↑=마지막
 *   Home End   처음 / 마지막
 *   Enter 스페이스  가로채지 않는다 (preventDefault 도, 닫지도, 포커스 이동도 없다)
 *   ESC        닫힘 + **트리거로 포커스 복귀**
 *   여는 방식   키보드로 열면 첫 항목 포커스 · 마우스로 열면 포커스 이동 없음
 *   바깥 클릭   닫히되 포커스는 트리거로 안 튄다 (마우스로 운전 중)
 *
 * ⚠️ jsdom 한계 — 여기서 마우스 열기는 "우리가 **강제로** 포커스를 주지 않는다"까지만 잰다.
 * 진짜 브라우저의 포커스 이동·포커스 링은 `e2e/study-notes-menu-keyboard.spec.ts` 담당.
 */
export interface MenuKeyboardHarness {
  /** 메뉴를 여는 버튼 (닫힌 뒤에도 같은 노드를 돌려줘야 한다) */
  trigger: () => HTMLElement
  /** 마우스로 연다 */
  openByMouse: () => void
  /** 키보드로 연다 (click detail 0) */
  openByKeyboard: () => void
}

const itemsOf = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

const isOpen = () => document.querySelector('[role="menu"]') !== null

/** 지금 포커스된 곳에서 키를 누른다 — 실제 키 입력처럼 document 까지 버블한다 */
const key = (k: string) => {
  fireEvent.keyDown(document.activeElement ?? document, { key: k, bubbles: true })
}

export function assertMenuKeyboardContract(h: MenuKeyboardHarness): void {
  // ── 마우스로 열기 = 포커스를 건드리지 않는다 ────────────────
  h.openByMouse()
  const items = itemsOf()
  expect(items.length).toBeGreaterThanOrEqual(2)
  expect(items).not.toContain(document.activeElement)

  // ── ↓ : 포커스가 메뉴 밖이면 첫 항목부터 ───────────────────
  key('ArrowDown')
  expect(document.activeElement).toBe(items[0])

  // ── ↓ 순환 : 항목 수만큼 내려가면 다시 처음 ────────────────
  for (let i = 1; i < items.length; i++) {
    key('ArrowDown')
    expect(document.activeElement).toBe(items[i])
  }
  key('ArrowDown')
  expect(document.activeElement).toBe(items[0])

  // ── ↑ 순환 : 처음에서 위로 = 마지막 ────────────────────────
  key('ArrowUp')
  expect(document.activeElement).toBe(items[items.length - 1])
  key('ArrowUp')
  expect(document.activeElement).toBe(items[items.length - 2])

  // ── Home / End ─────────────────────────────────────────────
  key('Home')
  expect(document.activeElement).toBe(items[0])
  key('End')
  expect(document.activeElement).toBe(items[items.length - 1])

  // ── Enter · 스페이스는 우리 것이 아니다 ────────────────────
  // 네이티브 <button> 이 click 으로 바꿔준다. 가로채면 두 번 실행되거나 기본기가 깨진다.
  // (jsdom 은 button 기본 활성화를 구현하지 않으므로 "막지 않았다"까지가 여기 몫이다)
  const last = items[items.length - 1]
  expect(fireEvent.keyDown(last, { key: 'Enter' })).toBe(true)
  expect(fireEvent.keyDown(last, { key: ' ' })).toBe(true)
  expect(isOpen()).toBe(true)
  expect(document.activeElement).toBe(last)

  // ── ESC = 닫힘 + 트리거로 포커스 복귀 ──────────────────────
  key('Escape')
  expect(isOpen()).toBe(false)
  expect(document.activeElement).toBe(h.trigger())

  // ── 키보드로 열기 = 첫 항목 포커스 ─────────────────────────
  h.openByKeyboard()
  expect(document.activeElement).toBe(itemsOf()[0])
  key('Escape')
  expect(isOpen()).toBe(false)
  expect(document.activeElement).toBe(h.trigger())

  // ── 바깥 클릭 = 닫히되 포커스를 트리거로 뺏지 않는다 ───────
  h.openByKeyboard()
  expect(document.activeElement).toBe(itemsOf()[0])
  fireEvent.mouseDown(document.body)
  expect(isOpen()).toBe(false)
  expect(document.activeElement).not.toBe(h.trigger())
}
