import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativeMode } from './useNativeMode'

/**
 * useNativeMode spec.
 *
 * 시나리오:
 *   1) sessionStorage flag 우선 (라우팅 후 query param 사라져도 유지)
 *   2) URL query `?native=1` 감지 → sessionStorage 저장
 *   3) User-Agent `chwippo-mobile-webview` 감지 → sessionStorage 저장
 *   4) 셋 다 없으면 false
 *   5) query param 값이 '0' or 다른 값이면 false (엄격 매칭)
 *   6) UA 대소문자 무시 (case-insensitive)
 */
describe('useNativeMode', () => {
  const originalUA = navigator.userAgent

  beforeEach(() => {
    window.sessionStorage.clear()
    // URL 초기화
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    window.sessionStorage.clear()
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  const setUA = (ua: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      configurable: true,
    })
  }

  it('sessionStorage flag 있으면 true', () => {
    window.sessionStorage.setItem('chwippo:native-mode', '1')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(true)
  })

  it('URL query ?native=1 → true · sessionStorage 저장됨', () => {
    window.history.replaceState({}, '', '/?native=1')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(true)
    expect(window.sessionStorage.getItem('chwippo:native-mode')).toBe('1')
  })

  it('User-Agent 에 chwippo-mobile-webview 있으면 true · sessionStorage 저장됨', () => {
    setUA('Mozilla/5.0 chwippo-mobile-webview/1.0')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(true)
    expect(window.sessionStorage.getItem('chwippo:native-mode')).toBe('1')
  })

  it('셋 다 없으면 false · sessionStorage 도 저장 안 됨', () => {
    setUA('Mozilla/5.0 (Regular Browser)')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(false)
    expect(window.sessionStorage.getItem('chwippo:native-mode')).toBeNull()
  })

  it('?native=0 은 false · 엄격 매칭', () => {
    window.history.replaceState({}, '', '/?native=0')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(false)
  })

  it('?native=true 는 false · 엄격 매칭', () => {
    window.history.replaceState({}, '', '/?native=true')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(false)
  })

  it('UA 대소문자 무시 (CHWIPPO-MOBILE-WEBVIEW 도 감지)', () => {
    setUA('Mozilla/5.0 CHWIPPO-MOBILE-WEBVIEW/1.0')
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(true)
  })

  it('sessionStorage 우선 · query 없어도 재감지 시 true 유지', () => {
    window.sessionStorage.setItem('chwippo:native-mode', '1')
    setUA('Mozilla/5.0 (Regular)') // UA 는 native 아님
    window.history.replaceState({}, '', '/board') // 라우팅 후 상태
    const { result } = renderHook(() => useNativeMode())
    expect(result.current).toBe(true)
  })
})
