import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApplications } from '@/hooks/useApplications'
import {
  COVERLETTER_CATEGORY_EMOJI,
  COVERLETTER_CATEGORY_STYLE,
  coverletterCategory,
} from '@/types/coverletter'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'

/**
 * F6 PR 1 — 자소서 통합 페이지 (`/coverletters`).
 *
 * 모든 application 의 자소서 문항을 한 곳에서 둘러보기. 클릭 → 해당 보드 카드 상세의
 * 자소서 탭으로 이동 (편집은 카드 상세에서. V1 단순화 — 통합 페이지는 list view).
 *
 * 데스크탑 Sidebar 메뉴에서 진입. 모바일은 MobileNav 변경 없음 (사용자 결정).
 */
export function Coverletters() {
  const { data: applications = [], isLoading } = useApplications()

  // PASSED/FAILED 도 보여줌 (작성 이력 참고용). 단 archived (deleted_at) 는 API 단에서 제외됨
  const active = useMemo(
    () =>
      applications.filter((a) =>
        ['CREATED', 'IN_PROGRESS', 'PASSED'].includes(a.status),
      ),
    [applications],
  )

  if (isLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-3">
        <Header />
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <Header />
        <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center mt-4">
          <div className="text-2xl mb-2">📝</div>
          <p className="text-text-secondary text-sm font-medium mb-1">
            아직 지원 카드가 없어요
          </p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-5">
            보드에서 회사 카드를 먼저 만든 뒤 자소서 문항을 추가할 수 있어요.
          </p>
          <Link
            to="/board"
            className="inline-block px-4 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
          >
            보드로 이동 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-4">
      <Header />
      <div className="space-y-3">
        {active.map((app) => (
          <ApplicationGroup
            key={app.id}
            applicationId={app.id}
            companyName={app.companyName}
            jobTitle={app.jobTitle}
            jobCategory={app.jobCategory}
          />
        ))}
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="space-y-1.5">
      <h1 className="text-text-primary text-2xl font-bold leading-tight">
        자소서 <span className="text-brand">모아보기</span>
      </h1>
      <p className="text-text-tertiary text-xs leading-relaxed">
        지원한 회사들의 자소서 문항·답변을 한곳에서 확인. 편집은 회사 카드에서.
      </p>
    </header>
  )
}

function ApplicationGroup({
  applicationId,
  companyName,
  jobTitle,
  jobCategory,
}: {
  applicationId: string
  companyName: string
  jobTitle: string | null
  jobCategory: string | null
}) {
  const { data: items = [], isLoading } = useCoverletters(applicationId, true)

  if (isLoading) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-4 py-3">
        <div className="h-4 w-32 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-3 w-48 bg-surface-3 rounded animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    // 자소서 문항 없는 회사는 작은 placeholder 만
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-text-primary text-sm font-semibold truncate">
            {companyName}
          </h3>
          <p className="text-text-quaternary text-[10px] mt-0.5">
            자소서 문항 없음
          </p>
        </div>
        <Link
          to={`/board/${applicationId}?tab=coverletter`}
          className="text-[11px] text-text-tertiary hover:text-brand border border-line hover:border-brand/40 px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          + 추가
        </Link>
      </div>
    )
  }

  return (
    <div className="border border-line bg-surface-2 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface-3/40">
        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary text-sm font-semibold truncate">
            {companyName}
          </h3>
          {(jobTitle || jobCategory) && (
            <p className="text-text-quaternary text-[10px] mt-0.5 truncate">
              {[jobCategory, jobTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Link
          to={`/board/${applicationId}?tab=coverletter`}
          className="text-[11px] text-text-tertiary hover:text-brand border border-line hover:border-brand/40 px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          편집 →
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {items.map((cl) => {
          const cat = coverletterCategory(cl.category)
          const catStyle = COVERLETTER_CATEGORY_STYLE[cat]
          const hasAnswer = (cl.answer ?? '').trim().length > 0
          return (
            <li key={cl.id}>
              <Link
                to={`/board/${applicationId}?tab=coverletter`}
                className="block px-4 py-3 hover:bg-surface-3/40 transition-colors"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${catStyle}`}
                  >
                    {COVERLETTER_CATEGORY_EMOJI[cat]} {cat}
                  </span>
                  {cl.charLimit && (
                    <span className="text-[10px] text-text-quaternary font-mono">
                      · {cl.charLimit}자
                    </span>
                  )}
                  {!hasAnswer && (
                    <span className="text-[10px] text-warning bg-warning/8 border border-warning/20 px-1.5 rounded-full">
                      미작성
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-xs font-medium leading-snug line-clamp-2">
                  {cl.question || (
                    <span className="text-text-quaternary">(문항 미입력)</span>
                  )}
                </p>
                {hasAnswer && (
                  <p className="text-text-tertiary text-[11px] leading-relaxed line-clamp-2 mt-1.5">
                    {cl.answer}
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
