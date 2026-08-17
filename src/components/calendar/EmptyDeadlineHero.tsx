import { Link } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'
import { JobSiteChips } from '@/components/common/JobSiteChips'

/**
 * 캘린더 UX 재구성 — Hero 자리 빈 상태.
 *
 * - variant='no-deadline' (기본): 지원카드는 있는데 D-day 이벤트 0건 (다 지난 마감).
 *   "이번 주는 여유로워요" + 새 카드 추가·회고 보기.
 * - variant='onboarding' (F10): 지원 카드가 하나도 없는 신규 유저.
 *   "첫 지원 카드를 만들어보세요" + 카드 추가 CTA. 같은 그라데이션·카피 톤 유지.
 */
interface Props {
  variant?: 'no-deadline' | 'onboarding'
}

export function EmptyDeadlineHero({ variant = 'no-deadline' }: Props) {
  const isDemo = useDemoMode()
  const boardTo = isDemo ? '/demo/board' : '/board'
  const dashboardTo = isDemo ? '/demo/dashboard' : '/dashboard'
  const isOnboarding = variant === 'onboarding'

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
        {isOnboarding ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h11l5 5v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
            <path d="M12 10v6M9 13h6" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
            <path d="M8 12l2.5 2.5L16 9" />
          </svg>
        )}
      </div>
      <h2 className="relative text-base font-bold tracking-tight text-text-primary mb-2">
        {isOnboarding ? '첫 지원 카드를 만들어보세요' : '이번 주는 여유로워요'}
      </h2>
      <p className="relative text-xs text-text-tertiary max-w-[380px] mx-auto leading-relaxed mb-5">
        {isOnboarding ? (
          <>
            관심 있는 회사를 추가하면<br />
            마감·면접·시험 일정을 한눈에 챙겨드려요.
          </>
        ) : (
          <>
            다가오는 마감이 없어요.<br />
            다음 지원 준비하기 좋은 시간이에요.
          </>
        )}
      </p>
      <div className="relative flex items-center justify-center gap-2">
        <Link
          to={boardTo}
          className="h-9 px-4 rounded-lg bg-brand hover:bg-accent text-bg text-[11px] font-bold transition-colors inline-flex items-center"
        >
          {isOnboarding ? '카드 추가하기 →' : '새 카드 추가 →'}
        </Link>
        {!isOnboarding && (
          <Link
            to={dashboardTo}
            className="h-9 px-4 rounded-lg border border-line text-text-secondary hover:bg-surface-2 text-[11px] font-medium inline-flex items-center"
          >
            회고 보기
          </Link>
        )}
      </div>
      {/* 공고 허브 — 🔴 빈 상태가 이 기능의 본진이다. 「카드를 추가하세요」는
          추가할 공고가 없는 사람에게 막다른 길이라, 공고 찾으러 갈 문을 같은 자리에 둔다.
          (onboarding 변형 = 카드 0개 신규 유저 — 관측된 「카드 도달 안 함」의 직접 처방) */}
      <div className="relative mt-6 pt-5 border-t border-line">
        <JobSiteChips placement="emptyDeadline" />
      </div>
    </div>
  )
}
