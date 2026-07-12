import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  adminResearchApi,
  type ResearchFilter,
  type ResearchSort,
  type ResearchOrder,
  type ResearchRow,
  type ResearchSummary,
} from '@/api/adminResearch'
import { toLocalDateString } from '@/utils/datetime'
import { toast } from '@/stores/toastStore'

const LIMIT = 20

const FILTERS: { label: string; value: ResearchFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '미조사', value: 'unresearched' },
  { label: 'TTL 임박', value: 'expiring' },
  { label: '만료', value: 'expired' },
  { label: 'opt-out', value: 'optout' },
]

/** 통합 테이블 컬럼 정의 — sort 키가 있으면 헤더 클릭으로 정렬 토글. */
interface Column {
  label: string
  sort: ResearchSort | null
  align: 'left' | 'right'
}
const COLUMNS: Column[] = [
  { label: '회사명', sort: 'name', align: 'left' },
  { label: '조사', sort: null, align: 'left' },
  { label: '지원자', sort: 'applicants', align: 'right' },
  { label: '카드', sort: 'cards', align: 'right' },
  { label: '조회수', sort: 'hitCount', align: 'right' },
  { label: '최신화 (KST)', sort: 'updatedAt', align: 'left' },
  { label: '만료 (KST)', sort: null, align: 'left' },
  { label: '보완항목', sort: 'inferredCount', align: 'right' },
  { label: 'opt-out', sort: null, align: 'left' },
]

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function OpsCompanyResearchPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<ResearchFilter>('all')
  const [sort, setSort] = useState<ResearchSort>('applicants')
  const [order, setOrder] = useState<ResearchOrder>('desc')
  const [page, setPage] = useState(1)

  // 300ms debounce — 검색 입력
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const summaryQ = useQuery({
    queryKey: ['admin', 'research', 'summary'],
    queryFn: adminResearchApi.summary,
  })

  const listQ = useQuery({
    queryKey: [
      'admin',
      'research',
      'unified',
      debouncedSearch,
      filter,
      sort,
      order,
      page,
    ],
    queryFn: () =>
      adminResearchApi.unified({
        search: debouncedSearch || undefined,
        filter,
        sort,
        order,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  })

  // 에러 → 토스트
  useEffect(() => {
    if (summaryQ.isError || listQ.isError) {
      toast.error('데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }, [summaryQ.isError, listQ.isError])

  const rows = listQ.data?.items ?? []
  const total = listQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  /** 헤더 클릭 — 같은 컬럼이면 desc⇄asc 토글, 다른 컬럼이면 desc 로 시작. */
  function handleSort(key: ResearchSort) {
    if (sort === key) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(key)
      setOrder('desc')
    }
    setPage(1)
  }

  /** 미조사 필터 — 현재 페이지 행 회사명 복사 (배치 조사 우선순위 참고). */
  function handleCopyNames() {
    if (rows.length === 0) return
    const text = rows.map((r) => r.companyName).join(' · ')
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('회사명을 복사했어요.'))
      .catch(() => toast.error('복사에 실패했어요.'))
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          to="/ops"
          className="text-text-quaternary hover:text-text-tertiary text-sm transition-colors"
        >
          ← 관리자
        </Link>
        <span className="text-text-faint">/</span>
        <h1 className="text-lg font-bold text-text-primary">회사 조사 현황</h1>
      </div>

      {/* 요약 카드 */}
      <SummarySection summary={summaryQ.data} loading={summaryQ.isLoading} />

      {/* 버전 분포 */}
      <VersionDistribution
        dist={summaryQ.data?.versionDistribution}
        loading={summaryQ.isLoading}
      />

      {/* 검색 + 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 mt-8">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-quaternary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx={11} cy={11} r={8} />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사명 검색"
            aria-label="회사명 검색"
            className="w-full bg-surface-2 border border-line rounded-lg pl-8 pr-3 py-2 text-xs text-text-secondary outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary"
          />
        </div>

        {/* 필터 칩 */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value)
                setPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-brand/15 border border-brand/30 text-brand'
                  : 'bg-surface-2 border border-line text-text-tertiary hover:border-line-strong'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 미조사 필터일 때만 — 회사명 복사 */}
        {filter === 'unresearched' && rows.length > 0 && (
          <button
            onClick={handleCopyNames}
            className="ml-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 transition-colors"
          >
            회사명 복사
          </button>
        )}
      </div>

      {/* 통합 테이블 */}
      {listQ.isLoading && !listQ.data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          조건에 맞는 회사가 없어요.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-surface-2 rounded-xl border border-line shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-card">
                  {COLUMNS.map((col) => (
                    <SortableTh
                      key={col.label}
                      col={col}
                      activeSort={sort}
                      order={order}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ResearchTableRow key={row.companyName} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-line rounded-lg text-text-tertiary hover:border-line-strong hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              <span className="text-xs text-text-tertiary tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-line rounded-lg text-text-tertiary hover:border-line-strong hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

function SummarySection({
  summary,
  loading,
}: {
  summary?: ResearchSummary
  loading: boolean
}) {
  const cards = [
    {
      label: '커버리지',
      value: summary
        ? `${summary.researchedCount.toLocaleString()} / ${summary.totalCompanies.toLocaleString()}`
        : '—',
      sub: summary
        ? `${(summary.coverageRate * 100).toFixed(1)}% · 이름 ${summary.researchedNames.toLocaleString()}개 (별칭 포함)`
        : ' ',
      color: 'text-brand',
    },
    {
      label: '평균 채움율',
      value: summary ? `${(summary.avgFillRate * 100).toFixed(0)}%` : '—',
      sub: '조사 항목 충실도',
      color: 'text-info',
    },
    {
      label: 'opt-out',
      value: summary ? summary.optOutCount.toLocaleString() : '—',
      sub: '조사 거부 회사',
      color: 'text-text-secondary',
    },
    {
      label: 'TTL 임박',
      value: summary ? summary.expiringSoonCount.toLocaleString() : '—',
      sub: '30일 내 만료',
      color: 'text-warning',
    },
    {
      label: '만료',
      value: summary ? summary.expiredCount.toLocaleString() : '—',
      sub: '갱신 필요',
      color: 'text-danger',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-surface-2 border border-line rounded-xl p-4"
        >
          <p className="text-xs text-text-tertiary mb-1.5">{c.label}</p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums ${c.color} ${loading ? 'opacity-30' : ''}`}
          >
            {c.value}
          </p>
          <p className="text-xs text-text-quaternary mt-1 tabular-nums">
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── 버전 분포 ────────────────────────────────────────────────────────────────

function VersionDistribution({
  dist,
  loading,
}: {
  dist?: { version: string | null; count: number }[]
  loading: boolean
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
      <p className="text-xs text-text-tertiary font-semibold mb-3">
        seed 버전 분포
      </p>
      {loading ? (
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-28 rounded-full bg-card animate-pulse"
            />
          ))}
        </div>
      ) : !dist || dist.length === 0 ? (
        <p className="text-xs text-text-quaternary">조사 데이터가 없어요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {dist.map((v) => (
            <span
              key={v.version ?? 'none'}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-card border border-line text-text-secondary"
            >
              <span className="font-medium">{v.version ?? '유저 조사'}</span>
              <span className="text-text-quaternary tabular-nums">
                × {v.count.toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 정렬 가능 헤더 ───────────────────────────────────────────────────────────

function SortableTh({
  col,
  activeSort,
  order,
  onSort,
}: {
  col: Column
  activeSort: ResearchSort
  order: ResearchOrder
  onSort: (key: ResearchSort) => void
}) {
  const isActive = col.sort !== null && col.sort === activeSort
  const ariaSort = isActive
    ? order === 'asc'
      ? 'ascending'
      : 'descending'
    : col.sort
      ? 'none'
      : undefined
  const base = `px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider ${
    col.align === 'right' ? 'text-right' : 'text-left'
  }`

  if (!col.sort) {
    return <th className={base}>{col.label}</th>
  }

  return (
    <th className={base} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(col.sort as ResearchSort)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-text-tertiary ${
          col.align === 'right' ? 'flex-row-reverse' : ''
        } ${isActive ? 'text-text-secondary' : ''}`}
      >
        <span>{col.label}</span>
        <span className="text-[9px] leading-none">
          {isActive ? (order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

// ─── 테이블 행 ────────────────────────────────────────────────────────────────

function ResearchTableRow({ row }: { row: ResearchRow }) {
  const expiresAt = row.expiresAt
  const daysLeft = expiresAt
    ? dayjs(expiresAt).startOf('day').diff(dayjs().startOf('day'), 'day')
    : null
  const expiryClass =
    daysLeft == null
      ? 'text-text-quaternary'
      : daysLeft < 0
        ? 'text-danger'
        : daysLeft <= 30
          ? 'text-warning'
          : 'text-text-tertiary'

  return (
    <tr className="border-b border-line[0.06] last:border-0 hover:bg-card transition-colors">
      <td className="px-4 py-3.5">
        <span className="font-medium text-text-primary truncate max-w-[200px] block">
          {row.companyName}
        </span>
      </td>
      <td className="px-4 py-3.5">
        {row.researched ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success tabular-nums">
            <span aria-hidden>✓</span>
            {row.seedVersion ?? '조사됨'}
          </span>
        ) : (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border text-warning bg-warning/15 border-warning/30 tracking-wide">
            미조사
          </span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right text-text-secondary text-xs font-mono tabular-nums">
        {row.applicants.toLocaleString()}
      </td>
      <td className="px-4 py-3.5 text-right text-text-secondary text-xs font-mono tabular-nums">
        {row.cards.toLocaleString()}
      </td>
      <td className="px-4 py-3.5 text-right text-text-secondary text-xs font-mono tabular-nums">
        {row.hitCount.toLocaleString()}
      </td>
      <td className="px-4 py-3.5 text-text-tertiary text-xs font-mono tabular-nums">
        {row.updatedAt ? (
          toLocalDateString(new Date(row.updatedAt))
        ) : (
          <span className="text-text-quaternary">—</span>
        )}
      </td>
      <td className={`px-4 py-3.5 text-xs font-mono tabular-nums ${expiryClass}`}>
        {expiresAt ? (
          toLocalDateString(new Date(expiresAt))
        ) : (
          <span className="text-text-quaternary">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right text-xs font-mono tabular-nums">
        {row.inferredCount == null ? (
          <span className="text-text-quaternary">—</span>
        ) : row.inferredCount > 0 ? (
          <span className="text-warning">{row.inferredCount}</span>
        ) : (
          <span className="text-text-quaternary">0</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {row.optOut ? (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border text-danger bg-danger/15 border-danger/30 tracking-wide">
            opt-out
          </span>
        ) : (
          <span className="text-text-quaternary text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── 테이블 스켈레톤 ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-card">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={`px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-line[0.06] last:border-0">
              {[140, 70, 44, 44, 50, 90, 90, 50, 60].map((w, j) => (
                <td key={j} className="px-4 py-3.5">
                  <div
                    className="h-3 rounded bg-card animate-pulse"
                    style={{ width: w }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
