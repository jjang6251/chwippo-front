import { getDdayLabel } from '@/utils/dday'
import { getOpenSeason, SEASON_GUIDE_HREF } from './seasonDeadlines'

/**
 * 시즌 훅 — 히어로 h1 위 한 줄. **지금 마감이 몰려 있다**는 사실만 말하고 가이드로 보낸다.
 *
 * 🔴 **회사명을 쓰지 않는다** (2026-09-03 CEO). 랜딩에서 특정 회사를 이름으로 거는 것은
 * 하지 않기로 했다. 그래서 개수(`N곳`)와 시기(`M월` · 가장 빠른 마감 `D-n`)만 말하고,
 * 구체는 전부 가이드가 맡는다. `SeasonStrip.test.tsx` 가 9개사 이름이 렌더에 새어 나오지
 * 않는지 검사한다.
 *
 * 🔴 **시즌이 끝나면 스스로 사라진다.** `getOpenSeason()` 이 `null` 이면(확정 공고가 전부
 * 마감) 이 컴포넌트는 아무것도 렌더하지 않는다 — 랜딩에 지난 시즌 문구가 남는 사고를
 * 사람 손이 아니라 구조로 막는다.
 *
 * ⚠️ 배선은 `Landing.tsx` 의 **한 줄**이다 (`<SeasonStrip />`). 시즌 훅 자체를 접는 판단이
 * 내려지면 그 한 줄만 지우면 되고, 히어로 카피·보드는 건드릴 일이 없다.
 *
 * 문구는 데이터에서 파생한다 — 「9월 둘째 주」처럼 굳혀 쓰면 9/16 에 남은 공고가 하나여도
 * 여전히 둘째 주라고 말한다. 월은 **가장 임박한 마감의 월**을 그대로 쓴다.
 */
export function SeasonStrip() {
  const season = getOpenSeason()
  if (!season) return null

  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-[13px]">
      <span className="text-text-secondary font-medium whitespace-nowrap">
        🔥 {season.month}월 대기업 공채 마감 {season.count}곳
      </span>
      <span aria-hidden="true" className="text-text-quaternary">
        ·
      </span>
      <span className="text-text-tertiary whitespace-nowrap">
        가장 빠른 마감{' '}
        <span className="font-mono text-brand">{getDdayLabel(season.nearestDday)}</span>
      </span>
      {/*
        정적 가이드(public/guide)라 React 라우트가 아니다 — 푸터의 「가이드 · 도구」와 같은 a 태그.
        푸터 링크가 16px 높이라 지적받은 적이 있어(2026-08-09 uiux) 여기는 처음부터 44px 로 연다.
      */}
      <a
        href={SEASON_GUIDE_HREF}
        className="inline-flex items-center min-h-[44px] px-2 rounded-lg text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        전체 일정 →
      </a>
    </div>
  )
}
