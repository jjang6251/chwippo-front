import { useEffect, useState } from 'react'

/**
 * media query subscribe.
 *
 * @example
 *   const isMobile = useMediaQuery('(max-width: 639px)')  // Tailwind sm 미만
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    // 초기 setState 는 initial state (useState) 로 이미 반영. 여기서는 subscribe 만.
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Tailwind sm 미만 (모바일 폭 판정) */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
