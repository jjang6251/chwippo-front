import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CoverletterGenerateSection } from '@/components/coverletter/CoverletterGenerateSection'
import { useApplication, useApplications } from '@/hooks/useApplications'
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
      <Header total={active.length} />
      {/* 회사 카드 그리드 (잡코리아·자소설닷컴 식 모아보기) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

function Header({ total }: { total?: number }) {
  return (
    <header className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <h1 className="text-text-primary text-2xl font-bold leading-tight">
          자소서 <span className="text-brand">모아보기</span>
        </h1>
        {total !== undefined && (
          <span className="text-text-quaternary text-xs font-mono">
            {total}개 회사
          </span>
        )}
      </div>
      <p className="text-text-tertiary text-xs leading-relaxed">
        지원한 회사 별 자소서 문항·답변·진행률. 카드 클릭 → 회사 자소서
        풀페이지.
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
  // PR_B1c — application 의 coverletterGenerationStatus 별 UI 분기 (polling 자동)
  const { data: application } = useApplication(applicationId)

  if (isLoading) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-4 py-3">
        <div className="h-4 w-32 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-3 w-48 bg-surface-3 rounded animate-pulse" />
      </div>
    )
  }

  // PR_B1c — 자소서 row 있으면 이미 작성 진행 중 → 기존 진행률 카드 (legacy 보존).
  //   row 0 일 때만 GenerateSection (4 상태 UI — idle/in_progress/completed/failed 자동)
  if (items.length === 0) {
    if (!application) return null
    return (
      <div className="border border-line bg-surface-2 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-surface-3/40">
          <h3 className="text-text-primary text-sm font-semibold truncate">
            {companyName}
          </h3>
          {(jobTitle || jobCategory) && (
            <p className="text-text-quaternary text-[10px] mt-0.5 truncate">
              {[jobCategory, jobTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="p-4">
          <CoverletterGenerateSection application={application} />
        </div>
      </div>
    )
  }

  // 진행률 계산 (잡코리아·자소설닷컴 표준 — 작성 완료 문항 N/M)
  const completedCount = items.filter((c) => (c.answer ?? '').trim().length > 0).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <Link
      to={`/board/${applicationId}/coverletter`}
      className="block border border-line bg-surface-2 rounded-xl overflow-hidden hover:border-brand/40 transition-colors"
    >
      {/* 회사 헤더 + 진행률 progress bar */}
      <div className="px-4 py-3 border-b border-line bg-surface-3/40">
        <div className="flex items-center gap-2 mb-2">
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
          <span
            className={`shrink-0 text-[11px] font-mono font-semibold ${
              progress === 100
                ? 'text-success'
                : progress > 0
                  ? 'text-brand'
                  : 'text-text-quaternary'
            }`}
          >
            {completedCount}/{totalCount}
          </span>
        </div>
        {/* progress bar (잡코리아 식 — 작성 완료 비율) */}
        <div className="h-1 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              progress === 100 ? 'bg-success' : 'bg-brand'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 분류 chip 요약 (max 4개) */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {items.slice(0, 4).map((cl) => {
          const cat = coverletterCategory(cl.category)
          const catStyle = COVERLETTER_CATEGORY_STYLE[cat]
          const hasAnswer = (cl.answer ?? '').trim().length > 0
          return (
            <span
              key={cl.id}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${catStyle} ${
                hasAnswer ? '' : 'opacity-50'
              }`}
              title={hasAnswer ? '작성됨' : '미작성'}
            >
              {COVERLETTER_CATEGORY_EMOJI[cat]} {cat}
              {!hasAnswer && (
                <span className="text-text-quaternary text-[8px]">·미작성</span>
              )}
            </span>
          )
        })}
        {items.length > 4 && (
          <span className="text-[10px] text-text-quaternary px-1.5 py-0.5">
            +{items.length - 4}
          </span>
        )}
      </div>
    </Link>
  )
}
