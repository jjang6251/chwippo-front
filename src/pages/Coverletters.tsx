import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CoverletterGenerateSection } from '@/components/coverletter/CoverletterGenerateSection'
import { useApplication, useApplications } from '@/hooks/useApplications'
import {
  COVERLETTER_CATEGORY_EMOJI,
  COVERLETTER_CATEGORY_STYLE,
  coverletterCategory,
} from '@/types/coverletter'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'
import type { Application } from '@/types/application'

type StatusFilter = 'all' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'
type SortKey = 'deadline' | 'recent' | 'name'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'IN_PROGRESS', label: '진행 중' },
  { key: 'PASSED', label: '합격' },
  { key: 'FAILED', label: '탈락' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'deadline', label: '마감일 임박' },
  { key: 'recent', label: '최근 편집' },
  { key: 'name', label: '가나다' },
]

/** PR UI — 상대 시간 변환. now 인자로 받아 pure 유지 (lint react-hooks 호환) */
function relativeTime(iso: string | null, now: number): string {
  if (!iso) return ''
  const diff = now - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return `${Math.floor(days / 30)}달 전`
}

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

  // PR UI C — 검색 + status 탭 + 정렬
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('deadline')

  // PASSED/FAILED 도 보여줌 (작성 이력 참고용). 단 archived (deleted_at) 는 API 단에서 제외됨
  const allActive = useMemo(
    () =>
      applications.filter((a) =>
        ['CREATED', 'IN_PROGRESS', 'PASSED', 'FAILED'].includes(a.status),
      ),
    [applications],
  )

  const active = useMemo(() => {
    let list: Application[] = allActive
    // status 탭 필터
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter)
    }
    // 회사명 / 직무 검색
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.companyName.toLowerCase().includes(q) ||
          (a.jobTitle?.toLowerCase().includes(q) ?? false) ||
          (a.jobCategory?.toLowerCase().includes(q) ?? false),
      )
    }
    // 정렬
    const sorted = [...list]
    if (sortKey === 'deadline') {
      sorted.sort((a, b) => {
        const aDay = a.steps?.[0]?.scheduledDate
        const bDay = b.steps?.[0]?.scheduledDate
        if (!aDay && !bDay) return 0
        if (!aDay) return 1
        if (!bDay) return -1
        return aDay.localeCompare(bDay)
      })
    } else if (sortKey === 'recent') {
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } else {
      sorted.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'))
    }
    return sorted
  }, [allActive, statusFilter, search, sortKey])

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

  if (allActive.length === 0) {
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

      {/* PR UI C — 검색 + status 탭 + 정렬 */}
      <div className="space-y-2">
        {/* status 탭 + 정렬 dropdown */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? allActive.length
                  : allActive.filter((a) => a.status === tab.key).length
              const isActive = statusFilter === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                    isActive
                      ? 'bg-brand/10 text-brand border-brand/30'
                      : 'bg-card border-line text-text-tertiary hover:text-text-secondary hover:border-line-strong'
                  }`}
                >
                  {tab.label}{' '}
                  <span className="text-[10px] font-mono">({count})</span>
                </button>
              )
            })}
          </div>
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="appearance-none bg-input border border-line text-text-secondary text-xs font-medium pl-2.5 pr-7 py-1 rounded-md focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 hover:border-line-strong transition-all cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {/* 검색 input */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-quaternary pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사명 또는 직무 검색"
            aria-label="회사명 또는 직무 검색"
            className="w-full bg-input border border-line text-text-primary text-xs pl-8 pr-3 py-1.5 rounded-md placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>
      </div>

      {active.length === 0 ? (
        <div className="bg-surface-2 border border-dashed border-line rounded-xl p-6 text-center">
          <p className="text-text-tertiary text-xs">
            {search ? `"${search}" 검색 결과가 없어요` : '해당 조건의 카드가 없어요'}
          </p>
        </div>
      ) : (
      /* 회사 카드 그리드 (잡코리아·자소설닷컴 식 모아보기) */
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
      )}
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

  // PR UI — Date.now() 는 mount 시 한 번 만 (pure render 보존 — lint react-hooks/rules-of-hooks)
  const [renderedNow] = useState(() => Date.now())

  // PR UI fix — useMemo 는 early return 위 (react-hooks/rules-of-hooks)
  const lastEditedAt = useMemo(() => {
    if (items.length === 0) return null
    return items.reduce<string | null>(
      (acc, c) =>
        !acc || (c.updatedAt && c.updatedAt > acc) ? c.updatedAt : acc,
      null,
    )
  }, [items])

  if (isLoading) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-4 py-3">
        <div className="h-4 w-32 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-3 w-48 bg-surface-3 rounded animate-pulse" />
      </div>
    )
  }

  // 진행률 계산 (잡코리아·자소설닷컴 표준 — 작성 완료 문항 N/M)
  const completedCount = items.filter((c) => (c.answer ?? '').trim().length > 0).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const hasItems = items.length > 0

  // PR UI C — 추가 정보 (status badge / D-day / 마지막 편집 / 다음 미작성)
  const isPassed = application?.status === 'PASSED'
  const isFailed = application?.status === 'FAILED'
  // 마감일 = 첫 step.scheduledDate (deadline) — 없으면 null
  const deadline = application?.steps?.[0]?.scheduledDate ?? null
  const dday = deadline ? calcDday(deadline) : null
  // 다음 미작성 문항 (첫 빈 answer)
  const nextEmpty = items.find((c) => !(c.answer ?? '').trim())

  // PR UI — CTO C 옵션: 모든 카드 동일 헤더 + 본문 swap (그리드 정렬 통일).
  //   PR UI C 확장 — status badge / D-day / 마지막 편집 / 다음 미작성 chip 강조
  const Header = (
    <div className="px-4 py-3 border-b border-line bg-surface-3/40">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-text-primary text-sm font-semibold truncate">
              {companyName}
            </h3>
            {isPassed && (
              <span className="bg-success/10 text-success border border-success/30 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                ✅ 합격
              </span>
            )}
            {isFailed && (
              <span className="bg-danger/10 text-danger border border-danger/30 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                ❌ 탈락
              </span>
            )}
            {dday !== null && !isPassed && !isFailed && (
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  getDdayVariant(dday) === 'danger'
                    ? 'bg-danger/10 text-danger border-danger/30'
                    : getDdayVariant(dday) === 'warning'
                      ? 'bg-warning/10 text-warning border-warning/30'
                      : 'bg-info/10 text-info border-info/30'
                }`}
              >
                {getDdayLabel(dday)}
              </span>
            )}
          </div>
          {(jobTitle || jobCategory) && (
            <p className="text-text-quaternary text-[10px] mt-0.5 truncate">
              {[jobCategory, jobTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {hasItems && (
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
        )}
      </div>
      {hasItems && (
        <div className="h-1 bg-surface rounded-full overflow-hidden mt-2">
          <div
            className={`h-full transition-all ${
              progress === 100 ? 'bg-success' : 'bg-brand'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )

  if (!hasItems) {
    if (!application) return null
    return (
      <div className="border border-line bg-surface-2 rounded-xl overflow-hidden flex flex-col">
        {Header}
        <div className="p-3 flex-1">
          <CoverletterGenerateSection application={application} compact />
        </div>
      </div>
    )
  }

  return (
    <Link
      to={`/board/${applicationId}/coverletter`}
      className="flex flex-col border border-line bg-surface-2 rounded-xl overflow-hidden hover:border-brand/40 transition-colors"
    >
      {Header}
      {/* 분류 chip + 다음 미작성 강조 + 마지막 편집 + "이어서 작성" 빠른 액션 */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-2">
        {/* PR UI C — 다음 미작성 highlight (가장 중요한 정보 — 사용자가 다음 액션 직관) */}
        {nextEmpty && progress < 100 && (
          <div className="bg-brand/5 border border-brand/20 rounded-md px-2 py-1.5">
            <p className="text-text-quaternary text-[9px] mb-0.5">
              다음 미작성
            </p>
            <p className="text-text-secondary text-[11px] font-medium truncate">
              {COVERLETTER_CATEGORY_EMOJI[coverletterCategory(nextEmpty.category)]}{' '}
              {nextEmpty.question || coverletterCategory(nextEmpty.category)}
            </p>
          </div>
        )}
        {progress === 100 && (
          <div className="bg-success/5 border border-success/20 rounded-md px-2 py-1.5 text-center">
            <p className="text-success text-[11px] font-semibold">
              🎉 모든 문항 작성 완료
            </p>
          </div>
        )}
        {/* 분류 chip 요약 (max 4개) */}
        <div className="flex flex-wrap gap-1">
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
              </span>
            )
          })}
          {items.length > 4 && (
            <span className="text-[10px] text-text-quaternary px-1.5 py-0.5">
              +{items.length - 4}
            </span>
          )}
        </div>
        {/* 마지막 편집 시간 */}
        {lastEditedAt && (
          <p className="text-text-quaternary text-[10px] mt-auto">
            마지막 편집 · {relativeTime(lastEditedAt, renderedNow)}
          </p>
        )}
      </div>
    </Link>
  )
}
