/**
 * SPA 내부 이동 가드 — beforeunload 의 구멍(사이드바·탭·멘션 링크) 커버 (2026-08-19).
 *
 * 시나리오:
 *   1  활성 + 내부 링크 + confirm 취소 → 이동 차단 (defaultPrevented)
 *   2  활성 + 내부 링크 + confirm 확인 → 통과
 *   3  비활성 → confirm 자체를 안 띄운다
 *   4  외부 링크·새 탭(target=_blank)·수정키 클릭 → 현재 화면을 안 떠나므로 통과
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useSpaLeaveConfirm } from './useSpaLeaveConfirm'

const MSG = '나갈까요?'

function clickAnchor(attrs: Record<string, string>, init?: MouseEventInit): MouseEvent {
  const a = document.createElement('a')
  Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v))
  document.body.appendChild(a)
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  a.dispatchEvent(ev)
  a.remove()
  return ev
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useSpaLeaveConfirm', () => {
  it('1 활성 중 내부 링크 + 취소 → 이동 차단', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderHook(() => useSpaLeaveConfirm(true, MSG))
    const ev = clickAnchor({ href: '/board' })
    expect(window.confirm).toHaveBeenCalledWith(MSG)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('2 활성 중 내부 링크 + 확인 → 통과', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderHook(() => useSpaLeaveConfirm(true, MSG))
    const ev = clickAnchor({ href: '/board' })
    expect(ev.defaultPrevented).toBe(false)
  })

  it('3 비활성이면 confirm 을 안 띄운다', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderHook(() => useSpaLeaveConfirm(false, MSG))
    const ev = clickAnchor({ href: '/board' })
    expect(window.confirm).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('4 외부 링크·새 탭·수정키는 통과 (현재 화면을 안 떠난다)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderHook(() => useSpaLeaveConfirm(true, MSG))
    expect(clickAnchor({ href: 'https://example.com' }).defaultPrevented).toBe(false)
    expect(clickAnchor({ href: '/board', target: '_blank' }).defaultPrevented).toBe(false)
    expect(clickAnchor({ href: '/board' }, { metaKey: true }).defaultPrevented).toBe(false)
    expect(window.confirm).not.toHaveBeenCalled()
  })
})
