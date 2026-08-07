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
  const ref = useCallback(
    (el: HTMLTextAreaElement | null) => {
      elRef.current = el
      if (el) autoResize()
    },
    [autoResize],
  )

  // value 외부 변경 (form reset 등) 시 다음 frame 에 resize
  useEffect(() => {
    const id = requestAnimationFrame(autoResize)
    return () => cancelAnimationFrame(id)
  }, [value, autoResize])

  return { ref, autoResize }
}
