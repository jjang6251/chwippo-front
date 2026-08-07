/**
 * useAutoResize hook — value 외부 변경 시 ref 의 height 자동 조정.
 *
 * cover: 요소 부착 시 즉시 조정 / **접었다 펼침(재부착)** / value 변경 / min·max 경계 / null 가드
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
    const el = attachMockEl(300)
    act(() => result.current.ref(el))
    expect(el.style.height).toBe('300px')
  })

  it('scrollHeight 100 (min 미만) → min 200px', () => {
    const { result } = renderHook(() => useAutoResize('text', { min: 200, max: 500 }))
    const el = attachMockEl(100)
    act(() => result.current.ref(el))
    expect(el.style.height).toBe('200px')
  })

  it('scrollHeight 800 (max 초과) → max 500px', () => {
    const { result } = renderHook(() => useAutoResize('text', { min: 200, max: 500 }))
    const el = attachMockEl(800)
    act(() => result.current.ref(el))
    expect(el.style.height).toBe('500px')
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
    const el = attachMockEl(250)
    act(() => result.current.ref(el))
    el.style.height = '' // 부착 시 조정된 값을 지워 value 경로만 본다
    rerender({ v: 'b' }) // value 변경

    // requestAnimationFrame 호출됨 → autoResize 실행
    expect(rafSpy).toHaveBeenCalled()
    expect(el.style.height).toBe('250px')
    rafSpy.mockRestore()
  })

  it('default min=200 max=500', () => {
    const { result } = renderHook(() => useAutoResize('text'))
    const el = attachMockEl(150)
    act(() => result.current.ref(el))
    expect(el.style.height).toBe('200px')
  })

  /**
   * 🔴 **접었다 펼치면 높이가 쪼그라들던 버그** (2026-08-07 CEO 실기 제보).
   *
   * 접으면 textarea 만 언마운트되고 **훅은 살아 있다.** object ref + `useEffect([value])`
   * 구조에서는 다시 펼쳐 요소가 새로 붙어도 `value` 가 그대로라 effect 가 재실행되지
   * 않아 `min` 높이로 남았다. **글을 쓰는 중엔 onChange 가 직접 부르니 멀쩡해 보여서**
   * 발견이 늦었다 — "쓸 때는 되는데 접었다 펼치면 작아진다" 가 정확히 이 구조다.
   */
  it('🔴 언마운트 후 재부착에도 높이를 다시 잡는다 (접기→펼치기)', () => {
    const { result } = renderHook(() =>
      useAutoResize('긴 메모', { min: 76, max: 420 }),
    )
    const el = attachMockEl(300)

    act(() => result.current.ref(el)) // 펼침
    expect(el.style.height).toBe('300px')

    act(() => result.current.ref(null)) // 접음 — textarea 언마운트
    el.style.height = '' // 재마운트된 요소는 style 이 초기 상태다

    act(() => result.current.ref(el)) // 다시 펼침 — value 는 그대로다
    expect(el.style.height).toBe('300px')
  })

  it('🔴 재부착 요소가 다른 인스턴스여도 잡는다 (실제 remount)', () => {
    const { result } = renderHook(() =>
      useAutoResize('긴 메모', { min: 76, max: 420 }),
    )
    act(() => result.current.ref(attachMockEl(300)))
    act(() => result.current.ref(null))

    const remounted = attachMockEl(300) // React 가 새로 만든 요소
    act(() => result.current.ref(remounted))
    expect(remounted.style.height).toBe('300px')
  })
})
