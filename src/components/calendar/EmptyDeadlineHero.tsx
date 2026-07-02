import { Link } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'

/**
 * 캘린더 UX 재구성 — 지원카드는 있는데 D-day 이벤트 0건 (다 지난 마감).
 *
 * Hero 자리에 "이번 주는 여유로워요" 안내 카드 노출.
 * CTA: 새 카드 추가 (Board) + 회고 보기 (Dashboard)
 */
export function EmptyDeadlineHero() {
  const isDemo = useDemoMode()
  const boardTo = isDemo ? '/demo/board' : '/board'
  const dashboardTo = isDemo ? '/demo/dashboard' : '/dashboard'

  return (
    <div className="relative rounded-2xl border border-line bg-surface overflow-hidden py-12 px-8 text-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(600px 260px at 50% 0%, rgb(var(--brand) / 0.09), transparent 70%)',
        }}
      />
      <div className="relative mx-auto mb-5 w-14 h-14 rounded-2xl bg-brand/12 border border-brand/25 flex items-center justify-center text-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      </div>
      <h2 className="relative text-base font-bold tracking-tight text-text-primary mb-2">
        이번 주는 여유로워요
      </h2>
      <p className="relative text-xs text-text-tertiary max-w-[380px] mx-auto leading-relaxed mb-5">
        다가오는 마감이 없어요.<br />
        다음 지원 준비하기 좋은 시간이에요.
      </p>
      <div className="relative flex items-center justify-center gap-2">
        <Link
          to={boardTo}
          className="h-9 px-4 rounded-lg bg-brand hover:bg-brand-hover text-bg text-[11px] font-bold transition-colors inline-flex items-center"
        >
          새 카드 추가 →
        </Link>
        <Link
          to={dashboardTo}
          className="h-9 px-4 rounded-lg border border-line text-text-secondary hover:bg-surface-2 text-[11px] font-medium inline-flex items-center"
        >
          회고 보기
        </Link>
      </div>
    </div>
  )
}
