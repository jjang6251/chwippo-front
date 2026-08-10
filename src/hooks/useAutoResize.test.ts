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

/**
 * 🔴 **폭이 바뀌면 다시 잰다** (2026-08-10 CEO 실기 지적).
 *
 * 높이는 줄 수에서, 줄 수는 폭에서 나온다. 재는 시점이 마운트와 입력뿐이라
 * **그 뒤에 폭이 바뀌면 옛 폭에서 센 줄 수가 그대로 남았다.**
 *
 * 나란히 보기에서 드러났다 — 자소서만 보다 반반으로 돌아오면 면접 열이 새로 마운트되는데
 * 그 순간 열은 아직 **44px**(세로 탭 폭)이다. 거기서 줄 수를 세니 `max` 까지 부풀고,
 * 폭이 넓어져도 다시 재지 않아 계속 커진 채 남았다. 글자를 치면 멀쩡해져서
 * 「썼더니 돌아왔다」로 보였다.
 */
describe('폭 변화 재측정', () => {
  /** 폭에 따라 scrollHeight 가 달라지는 요소 — 좁으면 줄이 늘어난다 */
  function makeEl(width: number) {
    const el = {
      style: { height: '' },
      clientWidth: width,
      get scrollHeight() {
        return Math.round(4000 / (this as unknown as { clientWidth: number }).clientWidth) * 20
      },
    }
    return el as unknown as HTMLTextAreaElement & { clientWidth: number }
  }

  function stubRO() {
    const cbs: ResizeObserverCallback[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        cb: ResizeObserverCallback
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb
          cbs.push(cb)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    return {
      resizeTo(el: HTMLTextAreaElement & { clientWidth: number }, w: number) {
        el.clientWidth = w
        cbs.forEach((cb) =>
          cb(
            [{ contentRect: { width: w } } as ResizeObserverEntry],
            null as unknown as ResizeObserver,
          ),
        )
      },
    }
  }

  it('🔴 좁을 때 붙었어도 넓어지면 다시 잰다', () => {
    const ro = stubRO()
    const { result } = renderHook(() =>
      useAutoResize('text', { min: 80, max: 420 }),
    )
    const el = makeEl(44) // 세로 탭 폭에서 마운트 — 줄이 폭발한다
    act(() => result.current.ref(el))
    expect(el.style.height).toBe('420px') // max 까지 부푼 상태

    act(() => ro.resizeTo(el, 480)) // 전환이 끝나 열이 넓어짐
    expect(el.style.height).toBe('160px') // 제 크기로 돌아온다
  })

  /** 🔴 높이는 우리가 방금 바꾼 것 — 그걸로 다시 재면 서로 물린다 */
  it('🔴 폭이 그대로면 다시 재지 않는다', () => {
    const ro = stubRO()
    const { result } = renderHook(() =>
      useAutoResize('text', { min: 80, max: 420 }),
    )
    const el = makeEl(480)
    act(() => result.current.ref(el))
    const settled = el.style.height

    el.style.height = 'SENTINEL' // 다시 쟀는지 확인용
    act(() => ro.resizeTo(el, 480)) // 높이만 바뀌어 온 알림
    expect(el.style.height).toBe('SENTINEL')
    expect(settled).toBe('160px')
  })
})
