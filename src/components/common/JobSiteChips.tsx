import { useState } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { trackClarityEvent } from '@/lib/clarity'
import { getFaviconUrl } from '@/utils/companyLogo'
import { JOB_SITES, type JobSite } from '@/utils/jobSites'

/**
 * 공고 사이트 바로가기 허브 (plans/jobsite-hub.md · 2026-08-17).
 *
 * ## 왜 있나
 *
 * 관측된 진짜 문제는 「가입은 했는데 카드까지 안 넘어온다」였다. 빈 보드의 「카드를 추가하세요」는
 * **추가할 공고가 없는 사람에게 막다른 길**이다 — 공고 찾으러 갈 문이 그 자리에 있어야 한다.
 * 캘린더 홈 배치는 반대 논리다: 새 습관을 만드는 게 아니라 **기존 방문(D-day 확인)에 편승**한다.
 *
 * ## 동작
 *
 * - 전부 `target="_blank"` — 웹은 새 탭(치뽀 유지), 앱은 `AppWebView` 가 가로채
 *   **인앱 브라우저**(SFSafariViewController / Custom Tab)로 연다. 닫으면 그 자리 복귀.
 *   앱 쪽 처리는 이미 있는 인프라라 여기선 아무것도 안 한다
 * - 🔴 `rel="noopener noreferrer"` — 외부 링크의 유일한 보안 표면 (tabnabbing 차단)
 * - 클릭 계측 `jobhub_{site}_{placement}` — **placement 별로 갈라야** 안 쓰일 때
 *   「기능이 죽었는지 자리가 죽었는지」를 가릴 수 있다 (판정 기준: plan 문서)
 * - 🔴 **데모는 렌더는 하되 계측을 안 보낸다** — 링크는 계정 없이 완전 동작하는 몇 안 되는
 *   기능이라 데모 가치가 있지만, 판정(실사용자 전수)을 오염시키면 안 된다
 *
 * ## 시각
 *
 * 칩 높이는 `h-9` — 같은 화면의 `EmptyDeadlineHero` CTA(h-9)와 눈높이를 맞춘다.
 * 터치 타겟 44px 은 `before:-inset-y-1.5` 세로 확장으로 채운다 (시각 36px + 상하 6px = 48px — 44 가 아니라 48 인 이유: 서브픽셀 배치로 경계 1~2px 이 유실돼 4px 확장으론 실측 41px 에 그쳤다).
 * 🔴 가로는 확장하지 않는다 — 칩 간격이 8px 라 좌우로 넓히면 히트 영역이 겹친다.
 */
export function JobSiteChips({ placement }: { placement: 'calendar' | 'emptyDeadline' | 'emptyBoard' }) {
  const isDemo = useDemoMode()
  const centered = placement !== 'calendar'

  return (
    <nav aria-label="공고 사이트 바로가기">
      {centered && (
        <p className="text-[11px] text-text-quaternary text-center mb-2.5">
          공고부터 둘러볼까요?
        </p>
      )}
      {/*
        🔴 `py-1.5 -my-1.5` — **세로 스크롤 3px 버그의 수리다** (2026-08-17 CEO 실기 발견).
        `overflow-x-auto` 를 걸면 CSS 규칙상 `overflow-y: visible` 이 **강제로 `auto` 로 계산**되는데,
        칩의 터치 확장(`before:-inset-y-1.5`)이 삐져나와 39>36 으로 세로가 「약간」 스크롤됐다.
        패딩 6px 로 pseudo 를 박스 안에 품고, 음수 마진으로 바깥 레이아웃은 그대로 둔다.

        🔴 중앙 정렬은 `justify-center` 가 아니라 **안쪽 `w-max mx-auto`** 로 한다.
        flex 컨테이너의 `justify-center` 는 내용이 넘칠 때 **왼쪽 끝이 잘려 스크롤로도 못 간다**
        (시작점이 음수 좌표) — 빈 보드의 420px 래퍼에선 항상 넘치므로 실제로 잡코리아가 잘렸다.
        `w-max` 안쪽 박스는 넘치면 왼쪽부터 정상 스크롤, 여유 있으면 `mx-auto` 로 중앙.
      */}
      <div className="overflow-x-auto overscroll-x-contain py-1.5 -my-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`flex items-center gap-2 w-max ${centered ? 'mx-auto' : ''}`}>
          {!centered && (
            <span className="shrink-0 text-[11px] text-text-quaternary mr-0.5">공고 사이트</span>
          )}
          {JOB_SITES.map((site) => (
            <SiteChip
              key={site.id}
              site={site}
              onVisit={() => {
                if (!isDemo) trackClarityEvent(`jobhub_${site.id}_${placement}`)
              }}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

function SiteChip({ site, onVisit }: { site: JobSite; onVisit: () => void }) {
  /* 파비콘 로드 실패 → 이니셜 fallback (CompanyAvatar 와 같은 정책) */
  const [faviconFailed, setFaviconFailed] = useState(false)
  const faviconUrl = !faviconFailed ? getFaviconUrl(site.domain, 32) : null

  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onVisit}
      className="relative before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card border border-line text-xs font-medium text-text-secondary hover:bg-card-hover hover:border-line-strong hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
    >
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          width={16}
          height={16}
          className="w-4 h-4 rounded-[3px] shrink-0"
          loading="lazy"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-[3px] shrink-0 bg-card-strong text-text-tertiary text-[9px] font-bold flex items-center justify-center"
        >
          {site.name.charAt(0)}
        </span>
      )}
      {site.name}
    </a>
  )
}
