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
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const { min = 200, max = 500 } = options

  const autoResize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(max, Math.max(min, el.scrollHeight))
    el.style.height = `${next}px`
  }, [min, max])

  // value 외부 변경 (form reset 등) 시 다음 frame 에 resize
  useEffect(() => {
    const id = requestAnimationFrame(autoResize)
    return () => cancelAnimationFrame(id)
  }, [value, autoResize])

  return { ref, autoResize }
}
