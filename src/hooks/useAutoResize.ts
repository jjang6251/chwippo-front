import { useCallback, useEffect, useRef } from 'react'

/**
 * 베타 피드백 — "본인이 쓴 글이 한눈에 안 보임".
 * textarea 의 scrollHeight 측정해서 [min, max] 안에서 자동 확장.
 *
 * 사용:
 *   const { ref, autoResize } = useAutoResize(value, { min: 200, max: 500 })
 *   <textarea ref={ref} value={value} onChange={(e) => { setValue(e.target.value); autoResize() }} />
 *
 * 초기 mount + value 외부 변경 시 자동 호출. 사용자 입력 시 onChange 에서 명시 호출.
 */
export function useAutoResize(
  value: string,
  options: { min?: number; max?: number } = {},
) {
  const elRef = useRef<HTMLTextAreaElement | null>(null)
  const { min = 200, max = 500 } = options

  const autoResize = useCallback(() => {
    const el = elRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(max, Math.max(min, el.scrollHeight))
    el.style.height = `${next}px`
  }, [min, max])

  /**
   * 🔴 **callback ref 여야 한다** (2026-08-07 버그).
   *
   * object ref + `useEffect([value])` 로는 **접었다 펼치면 높이가 쪼그라든다.**
   * 접으면 textarea 만 언마운트되고 **훅은 살아 있어서**, 다시 펼쳐 요소가 새로 붙어도
   * `value` 가 그대로라 effect 가 재실행되지 않는다 → `min` 높이로 남는다.
   * (글을 쓰는 중엔 onChange 가 직접 부르니 멀쩡해 보여서 더 늦게 발견된다.)
   *
   * callback ref 는 요소가 **붙는 순간** 불리므로 마운트·재마운트를 모두 잡는다.
   * 동기 호출이라 한 프레임 깜빡임도 없다 (`requestAnimationFrame` 은 그게 보인다).
   */
  /**
   * 🔴 **폭이 바뀌면 다시 재야 한다** (2026-08-10 CEO 실기 지적).
   *
   * 높이는 **줄 수**에서 나오고 줄 수는 **폭**에서 나온다. 그런데 재는 시점은
   * 마운트와 입력뿐이라, 그 뒤에 폭이 바뀌면 **옛 폭에서 센 줄 수가 그대로 남는다.**
   *
   * 나란히 보기에서 그게 드러났다 — 자소서만 보다가 반반으로 돌아오면 면접 열이 새로
   * 마운트되는데, 그 순간 열은 아직 **44px**(세로 탭 폭)이다. 240ms 전환이 시작되기 전이라
   * 44px 에서 줄 수를 세니 `max` 까지 부풀고, 폭이 넓어져도 다시 재지 않아 **계속 커진 채**
   * 남는다. 글자를 치면 `onChange` 가 다시 재서 멀쩡해지므로 「썼더니 돌아왔다」로 보인다.
   *
   * **너비만** 본다 — 높이는 우리가 방금 바꾼 것이라 그걸로 다시 재면 서로 물린다.
   */
  const roRef = useRef<ResizeObserver | null>(null)
  const lastW = useRef(-1)
  const ref = useCallback(
    (el: HTMLTextAreaElement | null) => {
      roRef.current?.disconnect()
      roRef.current = null
      elRef.current = el
      if (!el) return
      autoResize()
      if (typeof ResizeObserver === 'undefined') return
      lastW.current = el.clientWidth
      const ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width)
        if (w === lastW.current) return // 우리가 바꾼 높이 때문에 온 것
        lastW.current = w
        autoResize()
      })
      ro.observe(el)
      roRef.current = ro
    },
    [autoResize],
  )

  useEffect(() => () => roRef.current?.disconnect(), [])

  // value 외부 변경 (form reset 등) 시 다음 frame 에 resize
  useEffect(() => {
    const id = requestAnimationFrame(autoResize)
    return () => cancelAnimationFrame(id)
  }, [value, autoResize])

  return { ref, autoResize }
}
