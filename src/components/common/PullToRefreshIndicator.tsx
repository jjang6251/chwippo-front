/**
 * W4 — pull-to-refresh 상단 spinner.
 * usePullToRefresh 훅과 함께 사용.
 */
interface Props {
  pullY: number
  isRefreshing: boolean
  isMobile: boolean
}

export function PullToRefreshIndicator({ pullY, isRefreshing, isMobile }: Props) {
  if (!isMobile) return null
  const visible = pullY > 0 || isRefreshing
  if (!visible) return null

  const progress = Math.min(pullY / 60, 1)
  const y = isRefreshing ? 20 : Math.min(pullY, 60) - 30

  return (
    <div
      className="fixed top-0 left-0 right-0 flex justify-center pointer-events-none z-40"
      style={{ transform: `translateY(${y}px)`, transition: pullY === 0 ? 'transform 200ms ease-out' : 'none' }}
      aria-hidden="true"
    >
      <span
        className={`inline-block w-6 h-6 rounded-full border-2 border-brand ${isRefreshing ? 'animate-spin border-t-transparent' : ''}`}
        style={!isRefreshing ? {
          borderTopColor: 'transparent',
          transform: `rotate(${progress * 360}deg)`,
          opacity: 0.3 + progress * 0.7,
        } : undefined}
      />
    </div>
  )
}
