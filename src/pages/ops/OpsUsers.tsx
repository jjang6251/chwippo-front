import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { PlatformBadges } from '@/components/admin/PlatformBadges'
import { getAdminUsers, type AdminUser } from '@/api/adminUsers'

// ─── 뱃지 ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin')
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border text-brand bg-brand/15 border-brand/30 tracking-wide">
        ADMIN
      </span>
    )
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border text-text-tertiary bg-card border-line">
      일반
    </span>
  )
}

/** W1 — admin OpsUsers 직군 셀. JSONB array → chip list + "기타: {입력값}" */
function JobCategoryCell({
  categories,
  otherText,
}: {
  categories: string[] | null
  otherText: string | null
}) {
  if (!categories) {
    return <span className="text-text-quaternary text-xs">—</span>
  }
  if (categories.length === 0) {
    return (
      <span className="text-text-quaternary text-xs italic">건너뜀</span>
    )
  }
  // 첫 2개만 표시 + 나머지 +N
  const head = categories.slice(0, 2)
  const remaining = categories.length - head.length
  return (
    <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
      {head.map((c) => (
        <span
          key={c}
          className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded text-brand bg-brand/[0.10] border border-brand/25 max-w-[120px] truncate"
          title={c}
        >
          {c}
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="text-[10px] text-text-quaternary"
          title={categories.slice(2).join(', ')}
        >
          +{remaining}
        </span>
      )}
      {otherText && (
        <span
          className="text-[10px] text-text-tertiary italic max-w-[100px] truncate"
          title={`기타: ${otherText}`}
        >
          ({otherText})
        </span>
      )}
    </div>
  )
}

function StatusBadge({ suspendedAt }: { suspendedAt: string | null }) {
  if (suspendedAt)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border text-danger bg-danger/15 border-danger/30 tracking-wide">
        <span className="w-1 h-1 rounded-full bg-danger inline-block" />
        정지
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border text-success bg-success/10 border-success/20">
      <span className="w-1 h-1 rounded-full bg-success inline-block" />
      정상
    </span>
  )
}

// ─── 필터 셀렉트 ──────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="appearance-none bg-surface-2 border border-line rounded-lg pl-3 pr-7 py-2 text-xs text-text-secondary outline-none focus:border-brand/50 transition-colors cursor-pointer hover:border-line-strong"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function OpsUsers() {
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [suspendedFilter, setSuspendedFilter] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const LIMIT = 20

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', submittedSearch, roleFilter, suspendedFilter, page],
    queryFn: () =>
      getAdminUsers({
        page,
        limit: LIMIT,
        search: submittedSearch || undefined,
        role: roleFilter || undefined,
        suspended:
          suspendedFilter === 'true'
            ? true
            : suspendedFilter === 'false'
            ? false
            : undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const users = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSubmittedSearch(search)
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      setPage(1)
    }
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
        <h1 className="text-lg font-bold text-text-primary">회원 관리</h1>
        <span className="ml-auto text-xs text-text-quaternary bg-card border border-line px-2.5 py-1 rounded-full">
          총 {total.toLocaleString()}명
        </span>
      </div>

      {/* 검색 + 필터 바 */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-5">
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
            placeholder="닉네임 검색"
            aria-label="닉네임 검색"
            className="w-full bg-surface-2 border border-line rounded-lg pl-8 pr-3 py-2 text-xs text-text-secondary outline-none focus:border-brand/50 transition-colors placeholder:text-text-tertiary"
          />
        </div>
        <FilterSelect
          value={roleFilter}
          onChange={handleFilterChange(setRoleFilter)}
          ariaLabel="역할 필터"
          options={[
            { label: '전체 역할', value: '' },
            { label: '일반 유저', value: 'user' },
            { label: '어드민', value: 'admin' },
          ]}
        />
        <FilterSelect
          value={suspendedFilter}
          onChange={handleFilterChange(setSuspendedFilter)}
          ariaLabel="상태 필터"
          options={[
            { label: '전체 상태', value: '' },
            { label: '정상만', value: 'false' },
            { label: '정지만', value: 'true' },
          ]}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand/15 border border-brand/30 rounded-lg text-xs text-brand font-medium hover:bg-brand/25 hover:border-brand/40 transition-colors"
        >
          검색
        </button>
      </form>

      {/* 테이블 */}
      {isLoading && !data ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          {submittedSearch ? `"${submittedSearch}" 검색 결과가 없어요.` : '회원이 없어요.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-surface-2 rounded-xl border border-line shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-card">
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">닉네임</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden md:table-cell">이메일</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">역할</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden xl:table-cell">관심 직군</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden sm:table-cell">가입일</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">사용 환경</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden lg:table-cell">최근접속</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onSelect={() => navigate(`/ops/users/${user.id}`)}
                  />
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

// ─── 테이블 행 ────────────────────────────────────────────────────────────────

function UserRow({ user, onSelect }: { user: AdminUser; onSelect: () => void }) {
  const isSuspended = !!user.suspendedAt

  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`${user.nickname} 상세 보기`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={`border-b border-line[0.06] last:border-0 transition-colors cursor-pointer group focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand/40
        ${isSuspended ? 'bg-danger/[0.04]' : 'hover:bg-card active:bg-card-strong'}
      `}
      onClick={onSelect}
    >
      <td className="px-4 py-3.5">
        <span className="font-semibold text-text-primary truncate max-w-[120px] block">
          {user.nickname}
        </span>
      </td>
      <td className="px-4 py-3.5 text-text-tertiary text-xs hidden md:table-cell truncate max-w-[160px]">
        {user.email ?? <span className="text-text-quaternary">—</span>}
      </td>
      <td className="px-4 py-3.5">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge suspendedAt={user.suspendedAt} />
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        <JobCategoryCell
          categories={user.signupJobCategories}
          otherText={user.signupOtherText}
        />
      </td>
      <td className="px-4 py-3.5 text-text-tertiary text-xs hidden sm:table-cell tabular-nums">
        {dayjs(user.createdAt).format('YYYY.MM.DD')}
      </td>
      {/* 사용 환경 — 좁은 화면에선 아이콘만 (라벨은 sr-only 로 유지) */}
      <td className="px-4 py-3.5">
        <span className="hidden xl:inline"><PlatformBadges platform={user.platform} /></span>
        <span className="xl:hidden"><PlatformBadges platform={user.platform} compact /></span>
      </td>
      <td className="px-4 py-3.5 text-text-tertiary text-xs hidden lg:table-cell tabular-nums">
        {user.lastActiveAt ? dayjs(user.lastActiveAt).format('YYYY.MM.DD HH:mm') : <span className="text-text-quaternary">—</span>}
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className="text-[11px] text-text-quaternary group-hover:text-text-tertiary transition-colors whitespace-nowrap px-2 py-1"
        >
          상세 →
        </button>
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
            {['닉네임', '이메일', '역할', '상태', '가입일', '최근접속', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-line[0.06] last:border-0">
              {[100, 150, 60, 50, 80, 110, 30].map((w, j) => (
                <td key={j} className="px-4 py-3.5">
                  <div className="h-3 rounded bg-card animate-pulse" style={{ width: w }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
