/**
 * useAutoResize hook — value 외부 변경 시 ref 의 height 자동 조정.
 *
 * cover: 초기 mount autoResize / value 변경 시 호출 / min·max 경계 / ref null 가드
 */
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAutoResize } from './useAutoResize'

describe('useAutoResize', () => {
  function attachMockEl(scrollHeight: number) {
    return {
      style: { height: '' },
      scrollHeight,
    } as unknown as HTMLTextAreaElement
  }

  it('ref 없을 때 호출 — 에러 없이 no-op', () => {
    const { result } = renderHook(() => useAutoResize('init'))
    expect(() => act(() => result.current.autoResize())).not.toThrow()
  })

  it('scrollHeight 300, min=200 max=500 → height=300px', async () => {
    const { result } = renderHook(() => useAutoResize('text', { min: 200, max: 500 }))
    result.current.ref.current = attachMockEl(300)
    act(() => result.current.autoResize())
    expect(result.current.ref.current.style.height).toBe('300px')
  })

  it('scrollHeight 100 (min 미만) → min 200px', () => {
    const { result } = renderHook(() => useAutoResize('text', { min: 200, max: 500 }))
    result.current.ref.current = attachMockEl(100)
    act(() => result.current.autoResize())
    expect(result.current.ref.current.style.height).toBe('200px')
  })

  it('scrollHeight 800 (max 초과) → max 500px', () => {
    const { result } = renderHook(() => useAutoResize('text', { min: 200, max: 500 }))
    result.current.ref.current = attachMockEl(800)
    act(() => result.current.autoResize())
    expect(result.current.ref.current.style.height).toBe('500px')
  })

  it('value 변경 시 requestAnimationFrame 안에서 autoResize 호출', async () => {
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0)
        return 0
      })

    const { rerender, result } = renderHook(({ v }) => useAutoResize(v), {
      initialProps: { v: 'a' },
    })
    result.current.ref.current = attachMockEl(250)
    rerender({ v: 'b' }) // value 변경

    // requestAnimationFrame 호출됨 → autoResize 실행
    expect(rafSpy).toHaveBeenCalled()
    expect(result.current.ref.current.style.height).toBe('250px')
    rafSpy.mockRestore()
  })

  it('default min=200 max=500', () => {
    const { result } = renderHook(() => useAutoResize('text'))
    result.current.ref.current = attachMockEl(150)
    act(() => result.current.autoResize())
    expect(result.current.ref.current.style.height).toBe('200px')
  })
})
