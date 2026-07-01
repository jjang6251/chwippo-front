import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from './useMediaQuery'

/**
 * W4 — 모바일 상단 pull-to-refresh.
 *
 * - scrollY = 0 일 때만 활성
 * - 60px+ pull → onRefresh 실행 · 그 이하는 원복
 * - preventDefault 로 iOS Safari native pull 차단
 * - 데스크탑 = 완전 비활성 (isMobile=false 시 return 0)
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const isMobile = useIsMobile()
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const activeRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  const runRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try { await onRefreshRef.current() } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isMobile) return

    const handleStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      activeRef.current = true
    }
    const handleMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      if (window.scrollY > 0) {
        activeRef.current = false
        setPullY(0)
        return
      }
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) {
        const capped = Math.min(dy, 120)
        setPullY(capped)
        // 30px 넘으면 native pull 차단 (자체 spinner 로 대체)
        if (dy > 30 && e.cancelable) e.preventDefault()
      }
    }
    const handleEnd = () => {
      if (!activeRef.current) return
      activeRef.current = false
      const y = pullY
      setPullY(0)
      if (y >= 60) void runRefresh()
    }

    document.addEventListener('touchstart', handleStart, { passive: true })
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)
    return () => {
      document.removeEventListener('touchstart', handleStart)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
    }
  }, [isMobile, pullY, runRefresh])

  return { pullY, isRefreshing, isMobile }
}
