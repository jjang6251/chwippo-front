/**
 * 이탈 경고 회귀 (15축 ① · 2026-08-07).
 *
 * 🔴 **이 훅은 없어도 화면이 멀쩡해 보인다.** 리스너가 안 붙었는지는 실제로 새로고침을
 * 해봐야 알 수 있고, 그때는 이미 코인이 나간 뒤다. 그래서 조용히 죽는다.
 *
 * 면접 기능에는 이 가드가 **아예 없었다** (자소서·노트·공고정리엔 있었다). 생성이 ~10초라
 * 그 사이 새로고침하면 차감은 됐는데 결과는 없는 상태가 됐다.
 *
 * 검사 대상은 "리스너를 붙였나" 가 아니라 **"경고가 실제로 뜨나"** 다 —
 * `preventDefault()` 가 불려야 브라우저가 확인창을 띄운다. 리스너만 붙이고
 * `preventDefault` 를 빼먹으면 등록 여부만 보는 테스트는 통과한다.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUnloadGuard } from './useUnloadGuard'

/** 실제 이벤트를 쏴서 preventDefault 가 불리는지 본다 */
function fireBeforeUnload(): boolean {
  const e = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(e)
  return e.defaultPrevented
}

describe('useUnloadGuard', () => {
  it('🔴 active=true — 새로고침에 경고가 뜬다 (preventDefault 호출)', () => {
    renderHook(() => useUnloadGuard(true))
    expect(fireBeforeUnload()).toBe(true)
  })

  it('active=false — 경고하지 않는다 (평소 이탈을 막으면 안 된다)', () => {
    renderHook(() => useUnloadGuard(false))
    expect(fireBeforeUnload()).toBe(false)
  })

  it('🔴 생성이 끝나면(true→false) 경고가 사라진다', () => {
    const { rerender } = renderHook(({ a }) => useUnloadGuard(a), {
      initialProps: { a: true },
    })
    expect(fireBeforeUnload()).toBe(true)
    rerender({ a: false })
    expect(fireBeforeUnload()).toBe(false)
  })

  it('🔴 언마운트하면 리스너가 남지 않는다 — 페이지를 떠난 뒤에도 막히면 안 된다', () => {
    const { unmount } = renderHook(() => useUnloadGuard(true))
    expect(fireBeforeUnload()).toBe(true)
    unmount()
    expect(fireBeforeUnload()).toBe(false)
  })

  it('false→true 로 켜면 그때부터 경고한다', () => {
    const { rerender } = renderHook(({ a }) => useUnloadGuard(a), {
      initialProps: { a: false },
    })
    expect(fireBeforeUnload()).toBe(false)
    rerender({ a: true })
    expect(fireBeforeUnload()).toBe(true)
  })

  it('중복 마운트해도 리스너가 새지 않는다', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useUnloadGuard(true))
    unmount()
    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    spy.mockRestore()
  })
})
