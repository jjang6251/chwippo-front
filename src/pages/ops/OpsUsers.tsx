import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  getAdminUsers,
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
  warnAdminUser,
  exportAdminUser,
  viewAdminUserData,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserExportData,
} from '@/api/adminUsers'
import { toast } from '@/stores/toastStore'

// ─── 뱃지 ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin')
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border text-brand bg-brand/15 border-brand/30 tracking-wide">
        ADMIN
      </span>
    )
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border text-text-tertiary bg-white/[0.04] border-white/10">
      일반
    </span>
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
        className="appearance-none bg-surface-2 border border-white/10 rounded-lg pl-3 pr-7 py-2 text-xs text-text-secondary outline-none focus:border-brand/50 transition-colors cursor-pointer hover:border-white/20"
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const qc = useQueryClient()
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
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          to="/ops"
          className="text-text-quaternary hover:text-text-tertiary text-sm transition-colors"
        >
          ← 관리자
        </Link>
        <span className="text-white/15">/</span>
        <h1 className="text-lg font-bold text-text-primary">회원 관리</h1>
        <span className="ml-auto text-xs text-text-quaternary bg-white/[0.04] border border-white/8 px-2.5 py-1 rounded-full">
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
            className="w-full bg-surface-2 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-text-secondary outline-none focus:border-brand/50 transition-colors placeholder:text-text-quaternary"
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
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">닉네임</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden md:table-cell">이메일</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">역할</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">상태</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden sm:table-cell">가입일</th>
                  <th className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider hidden lg:table-cell">최근접속</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onSelect={() => setSelectedId(user.id)}
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
                className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-text-tertiary hover:border-white/20 hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              <span className="text-xs text-text-tertiary tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-text-tertiary hover:border-white/20 hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onMutate={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'users'] })
            setSelectedId(null)
          }}
        />
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
      className={`border-b border-white/[0.06] last:border-0 transition-colors cursor-pointer group focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand/40
        ${isSuspended ? 'bg-danger/[0.04]' : 'hover:bg-white/[0.03]'}
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
      <td className="px-4 py-3.5 text-text-tertiary text-xs hidden sm:table-cell tabular-nums">
        {dayjs(user.createdAt).format('YYYY.MM.DD')}
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
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {['닉네임', '이메일', '역할', '상태', '가입일', '최근접속', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[11px] text-text-quaternary font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-white/[0.06] last:border-0">
              {[100, 150, 60, 50, 80, 110, 30].map((w, j) => (
                <td key={j} className="px-4 py-3.5">
                  <div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: w }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 회원 상세 모달 ───────────────────────────────────────────────────────────

type ConfirmState = {
  title: string
  description: string
  confirmLabel: string
  variant: 'danger' | 'warning' | 'default'
  onConfirm: () => void
}

function UserDetailModal({
  userId,
  onClose,
  onMutate,
}: {
  userId: string
  onClose: () => void
  onMutate: () => void
}) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [renameMode, setRenameMode] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [warnMode, setWarnMode] = useState(false)
  const [warnValue, setWarnValue] = useState('')
  const [viewData, setViewData] = useState<AdminUserExportData | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getAdminUser(userId),
  })

  const updateMut = useMutation({
    mutationFn: (dto: Parameters<typeof updateAdminUser>[1]) =>
      updateAdminUser(userId, dto),
    onSuccess: (_, dto) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setConfirm(null)
      setRenameMode(false)
      setWarnMode(false)
      if (dto.suspended === true) toast.success('계정을 정지했어요.')
      else if (dto.suspended === false) toast.success('정지를 해제했어요.')
      else if (dto.role === 'admin') toast.success('어드민으로 승격했어요.')
      else if (dto.role === 'user') toast.success('어드민 권한을 해제했어요.')
      else if (dto.nickname) toast.success('닉네임을 변경했어요.')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const warnMut = useMutation({
    mutationFn: (message: string) => warnAdminUser(userId, message),
    onSuccess: () => {
      setWarnMode(false)
      setWarnValue('')
      toast.success('경고를 발송했어요.')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const exportMut = useMutation({
    mutationFn: () => exportAdminUser(userId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user_${userId}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('데이터를 내보냈어요.')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const viewMut = useMutation({
    mutationFn: () => viewAdminUserData(userId),
    onSuccess: (data) => setViewData(data),
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteAdminUser(userId),
    onSuccess: () => {
      setConfirm(null)
      toast.success('계정을 삭제했어요.')
      onMutate()
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  function openConfirm(cfg: ConfirmState) {
    setRenameMode(false)
    setWarnMode(false)
    setConfirm(cfg)
  }

  if (isLoading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="bg-surface border border-white/10 rounded-xl w-full max-w-lg p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3.5 rounded bg-white/[0.06] animate-pulse w-1/3" />
              <div className="h-2.5 rounded bg-white/[0.04] animate-pulse w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-white/[0.05] animate-pulse" />
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const isSuspended = !!user.suspendedAt
  const isAdmin = user.role === 'admin'

  return (
    <>
      <div
        role="dialog"
        aria-modal
        aria-label="회원 상세"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-surface border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
            <div className="w-10 h-10 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-bold flex-shrink-0">
              {user.nickname[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-text-primary">{user.nickname}</span>
                <RoleBadge role={user.role} />
                <StatusBadge suspendedAt={user.suspendedAt} />
              </div>
              <p className="text-xs text-text-quaternary truncate mt-0.5">{user.email ?? '이메일 없음'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-text-quaternary hover:text-text-tertiary text-xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* 정보 그리드 */}
          <div className="px-6 py-3.5 border-b border-white/8 bg-white/[0.015]">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <InfoItem label="가입일" value={dayjs(user.createdAt).format('YYYY.MM.DD')} />
              <InfoItem
                label="최근접속"
                value={user.lastActiveAt ? dayjs(user.lastActiveAt).format('YYYY.MM.DD HH:mm') : '없음'}
              />
              <InfoItem
                label="지원 카드"
                value={`${(user as AdminUserDetail).stats?.applicationCount ?? 0}개`}
              />
              <InfoItem
                label="정지 상태"
                value={isSuspended ? `정지 중 (${dayjs(user.suspendedAt).format('MM.DD')})` : '정상'}
                valueClass={isSuspended ? 'text-danger' : 'text-success'}
              />
            </dl>
          </div>

          {/* 사용량 통계 */}
          {(user as AdminUserDetail).stats && (
            <UserStatsBlock stats={(user as AdminUserDetail).stats} />
          )}

          {/* 최근 문의 */}
          {((user as AdminUserDetail).recentInquiries?.length ?? 0) > 0 && (
            <div className="px-6 py-3.5 border-b border-white/8">
              <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-2">최근 문의</p>
              <div className="flex flex-col gap-1.5">
                {((user as AdminUserDetail).recentInquiries ?? []).slice(0, 3).map((inq) => (
                  <div key={inq.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                        inq.status === 'CLOSED'
                          ? 'text-text-quaternary bg-white/[0.04] border-white/10'
                          : 'text-brand bg-brand/10 border-brand/20'
                      }`}
                    >
                      {inq.status === 'CLOSED' ? '완료' : '진행'}
                    </span>
                    <span className="text-text-secondary truncate">{inq.title}</span>
                    <span className="text-text-quaternary ml-auto flex-shrink-0 tabular-nums">{dayjs(inq.created_at).format('MM.DD')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 액션 영역 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2.5">
            {/* 닉네임 변경 */}
            <div>
              {renameMode ? (
                <div className="flex gap-2">
                  <input
                    ref={renameRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="새 닉네임 입력"
                    maxLength={100}
                    className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-quaternary"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (!renameValue.trim()) return
                      updateMut.mutate({ nickname: renameValue.trim() })
                    }}
                    disabled={!renameValue.trim() || updateMut.isPending}
                    className="px-3 py-2 bg-brand/20 text-brand border border-brand/30 text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-brand/30 transition-colors"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => { setRenameMode(false); setRenameValue('') }}
                    className="px-3 py-2 border border-white/10 text-text-tertiary text-sm rounded-lg hover:border-white/20 transition-colors"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <ActionButton
                  label="닉네임 변경"
                  icon="✏️"
                  onClick={() => { setRenameValue(user.nickname); setRenameMode(true) }}
                />
              )}
            </div>

            {/* 경고 발송 */}
            <div>
              {warnMode ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={warnValue}
                    onChange={(e) => setWarnValue(e.target.value)}
                    placeholder="경고 사유를 입력하세요 (audit log에 기록됩니다)"
                    rows={3}
                    maxLength={500}
                    className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-quaternary resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setWarnMode(false); setWarnValue('') }}
                      className="flex-1 py-2 border border-white/10 text-text-tertiary text-sm rounded-lg hover:border-white/20 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => warnValue.trim() && warnMut.mutate(warnValue.trim())}
                      disabled={!warnValue.trim() || warnMut.isPending}
                      className="flex-1 py-2 bg-warning/15 text-warning border border-warning/25 text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-warning/20 transition-colors"
                    >
                      {warnMut.isPending ? '발송 중...' : '경고 발송'}
                    </button>
                  </div>
                </div>
              ) : (
                <ActionButton
                  label="경고 발송"
                  icon="⚠️"
                  onClick={() => setWarnMode(true)}
                />
              )}
            </div>

            {/* 데이터 보기 */}
            <ActionButton
              label={viewMut.isPending ? '불러오는 중...' : '데이터 보기'}
              icon="🔍"
              onClick={() => viewMut.mutate()}
              disabled={viewMut.isPending}
            />

            {/* 데이터 내보내기 */}
            <ActionButton
              label={exportMut.isPending ? '내보내는 중...' : '데이터 내보내기 (.json)'}
              icon="📦"
              onClick={() => exportMut.mutate()}
              disabled={exportMut.isPending}
            />

            <div className="h-px bg-white/[0.06] my-0.5" />

            {/* 정지 / 해제 */}
            <ActionButton
              label={isSuspended ? '정지 해제' : '계정 정지'}
              icon={isSuspended ? '✅' : '🚫'}
              variant={isSuspended ? 'safe' : 'warning'}
              onClick={() =>
                openConfirm({
                  title: isSuspended ? '정지를 해제할까요?' : '계정을 정지할까요?',
                  description: isSuspended
                    ? '해제 즉시 로그인이 허용됩니다.'
                    : '즉시 JWT 및 refresh token 모두 차단됩니다.',
                  confirmLabel: isSuspended ? '해제' : '정지',
                  variant: isSuspended ? 'default' : 'warning',
                  onConfirm: () => updateMut.mutate({ suspended: !isSuspended }),
                })
              }
            />

            {/* 어드민 승격 / 해제 */}
            <ActionButton
              label={isAdmin ? '어드민 권한 해제' : '어드민으로 승격'}
              icon={isAdmin ? '👤' : '🛡️'}
              variant="warning"
              onClick={() =>
                openConfirm({
                  title: isAdmin ? '어드민 권한을 해제할까요?' : '어드민으로 승격할까요?',
                  description: isAdmin
                    ? '관리자 메뉴 접근이 즉시 차단됩니다.'
                    : '모든 관리자 기능에 접근할 수 있게 됩니다.',
                  confirmLabel: isAdmin ? '해제' : '승격',
                  variant: 'warning',
                  onConfirm: () => updateMut.mutate({ role: isAdmin ? 'user' : 'admin' }),
                })
              }
            />

            <div className="h-px bg-white/[0.06] my-0.5" />

            {/* 계정 삭제 */}
            <ActionButton
              label="계정 삭제"
              icon="🗑️"
              variant="danger"
              onClick={() =>
                openConfirm({
                  title: '계정을 삭제할까요?',
                  description: '이 작업은 되돌릴 수 없습니다. 모든 지원 카드·문의 데이터가 삭제됩니다.',
                  confirmLabel: '영구 삭제',
                  variant: 'danger',
                  onConfirm: () => deleteMut.mutate(),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* 데이터 보기 모달 */}
      {viewData && (
        <DataViewModal
          nickname={user?.nickname ?? ''}
          data={viewData}
          onClose={() => setViewData(null)}
        />
      )}

      {/* 확인 모달 */}
      {confirm && (
        <div
          role="dialog"
          aria-modal
          aria-label={confirm.title}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4"
        >
          <div className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">{confirm.title}</h3>
            <p className="text-sm text-text-tertiary mb-6">{confirm.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-text-secondary hover:bg-white/[0.04] transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirm.onConfirm}
                disabled={updateMut.isPending || deleteMut.isPending}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                  confirm.variant === 'danger'
                    ? 'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25'
                    : confirm.variant === 'warning'
                    ? 'bg-warning/15 text-warning border border-warning/25 hover:bg-warning/25'
                    : 'bg-success/15 text-success border border-success/25 hover:bg-success/25'
                }`}
              >
                {updateMut.isPending || deleteMut.isPending ? '처리 중...' : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── 공통 서브컴포넌트 ────────────────────────────────────────────────────────

function InfoItem({
  label,
  value,
  valueClass = 'text-text-secondary',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-text-quaternary w-16 flex-shrink-0">{label}</dt>
      <dd className={`${valueClass} font-medium tabular-nums break-all`}>{value}</dd>
    </div>
  )
}

// ─── 사용량 통계 블록 (어드민 회원 상세) ──────────────────────────────────
function userStatsFormatBytes(bytes: number): string {
  if (bytes <= 0) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function UserStatsBlock({
  stats,
}: {
  stats: NonNullable<AdminUserDetail['stats']>
}) {
  const { storage, myinfoCount } = stats
  const tone =
    storage.percentage >= 95
      ? 'bg-danger'
      : storage.percentage >= 80
        ? 'bg-warning'
        : 'bg-brand'

  const myinfoTotal =
    myinfoCount.cert +
    myinfoCount.award +
    myinfoCount.languageCert +
    myinfoCount.experience +
    myinfoCount.coverletterCustom +
    myinfoCount.document +
    myinfoCount.education

  return (
    <div className="px-6 py-3.5 border-b border-white/8 space-y-3">
      <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider">
        사용량 통계
      </p>

      {/* 파일 저장 용량 */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-tertiary">파일 저장 용량</span>
          <span className="text-text-secondary font-medium tabular-nums">
            {userStatsFormatBytes(storage.usedBytes)} / {storage.limitMB}MB
            <span className="text-text-quaternary ml-1.5">({storage.percentage}%)</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={storage.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`파일 저장 용량 ${storage.percentage}%`}
          className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden"
        >
          <div
            className={`h-full transition-all ${tone}`}
            style={{ width: `${Math.min(storage.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* myinfo 항목 합계 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-tertiary">내 정보 창고 항목 (전체)</span>
        <span className="text-text-secondary font-medium tabular-nums">{myinfoTotal}개</span>
      </div>

      {/* myinfo 세부 — 작은 그리드 (모바일 2열, 데스크탑 3열) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-text-quaternary tabular-nums">
        <span>자격증 {myinfoCount.cert}</span>
        <span>상장 {myinfoCount.award}</span>
        <span>어학 {myinfoCount.languageCert}</span>
        <span>활동 {myinfoCount.experience}</span>
        <span>자소서 {myinfoCount.coverletterCustom}</span>
        <span>문서 {myinfoCount.document}</span>
        <span>학력 {myinfoCount.education}</span>
      </div>
    </div>
  )
}

// ─── 데이터 보기 모달 ─────────────────────────────────────────────────────────

const APP_STATUS_LABEL: Record<string, string> = {
  PLANNED: '지원예정',
  IN_PROGRESS: '진행중',
  PASSED: '최종합격',
  FAILED: '불합격',
}

const APP_STATUS_COLOR: Record<string, string> = {
  PLANNED: 'text-text-tertiary bg-white/[0.04] border-white/10',
  IN_PROGRESS: 'text-brand bg-brand/10 border-brand/20',
  PASSED: 'text-success bg-success/10 border-success/20',
  FAILED: 'text-text-quaternary bg-white/[0.03] border-white/8',
}

function DataViewModal({
  nickname,
  data,
  onClose,
}: {
  nickname: string
  data: AdminUserExportData
  onClose: () => void
}) {
  const userFields: [string, unknown][] = Object.entries(data.user)
    .filter(([k]) => !['refreshToken'].includes(k))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="회원 데이터 보기"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-white/10 rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="font-bold text-text-primary">{nickname}</h2>
            <p className="text-xs text-text-quaternary mt-0.5">데이터 조회</p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-text-quaternary hover:text-text-tertiary text-xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">

          {/* 사용자 정보 */}
          <section>
            <SectionTitle>사용자 정보</SectionTitle>
            <div className="flex flex-col gap-2">
              {userFields.map(([key, val]) => {
                const isObj = val !== null && typeof val === 'object'
                return (
                  <div key={key} className={`flex gap-2 text-xs ${isObj ? 'flex-col' : ''}`}>
                    <span className="text-text-quaternary font-mono flex-shrink-0 w-40">{key}</span>
                    {isObj ? (
                      <pre className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-text-secondary font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(val, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-text-secondary break-all">
                        {val == null ? '—' : String(val)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 지원 카드 */}
          <section>
            <SectionTitle>지원 카드 ({data.applications.length}개)</SectionTitle>
            {data.applications.length === 0 ? (
              <p className="text-xs text-text-quaternary">지원 카드가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{app.companyName}</p>
                      {app.jobTitle && (
                        <p className="text-xs text-text-tertiary truncate mt-0.5">{app.jobTitle}</p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border flex-shrink-0 ${
                        APP_STATUS_COLOR[app.status] ?? 'text-text-quaternary bg-white/[0.04] border-white/10'
                      }`}
                    >
                      {APP_STATUS_LABEL[app.status] ?? app.status}
                    </span>
                    <span className="text-xs text-text-quaternary tabular-nums flex-shrink-0">
                      {dayjs(app.createdAt).format('YYYY.MM.DD')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 문의 내역 */}
          <section>
            <SectionTitle>문의 내역 ({data.inquiries.length}개)</SectionTitle>
            {data.inquiries.length === 0 ? (
              <p className="text-xs text-text-quaternary">문의 내역이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                  >
                    <p className="flex-1 text-sm text-text-secondary truncate">{inq.title}</p>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border flex-shrink-0 ${
                        inq.status === 'CLOSED'
                          ? 'text-text-quaternary bg-white/[0.04] border-white/10'
                          : 'text-brand bg-brand/10 border-brand/20'
                      }`}
                    >
                      {inq.status === 'CLOSED' ? '완료' : '진행'}
                    </span>
                    <span className="text-xs text-text-quaternary tabular-nums flex-shrink-0">
                      {dayjs(inq.created_at).format('YYYY.MM.DD')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 내 정보 창고 */}
          <section>
            <SectionTitle>내 정보 창고</SectionTitle>
            <div className="flex flex-col gap-4">
              <MyinfoGroup label="프로필" items={data.myinfo.profile ? [data.myinfo.profile] : []} renderItem={(p) => (
                <MyinfoRow fields={[
                  ['이름', p.name],
                  ['성별', p.gender],
                  ['생년월일', p.birthdate],
                  ['연락처', p.phone],
                  ['이메일', p.email_personal],
                ]} />
              )} emptyText="프로필 정보 없음" />

              <MyinfoGroup label={`학력 (${data.myinfo.educations.length})`} items={data.myinfo.educations} renderItem={(e) => (
                <MyinfoRow fields={[
                  ['학교', e.school_name],
                  ['전공', e.major],
                  ['기간', `${e.start_at ?? '?'} ~ ${e.end_at ?? '재학중'}`],
                ]} />
              )} />

              <MyinfoGroup label={`경험 (${data.myinfo.experiences.length})`} items={data.myinfo.experiences} renderItem={(e) => (
                <MyinfoRow fields={[
                  ['활동명', e.activity_name],
                  ['기관', e.org],
                  ['기간', `${e.start_at ?? '?'} ~ ${e.end_at ?? '?'}`],
                ]} />
              )} />

              <MyinfoGroup label={`자격증 (${data.myinfo.certs.length})`} items={data.myinfo.certs} renderItem={(c) => (
                <MyinfoRow fields={[
                  ['자격증명', c.name],
                  ['발급기관', c.issuer],
                  ['취득일', c.acquired_at],
                ]} />
              )} />

              <MyinfoGroup label={`어학 (${data.myinfo.languageCerts.length})`} items={data.myinfo.languageCerts} renderItem={(l) => (
                <MyinfoRow fields={[
                  ['종류', l.cert_type],
                  ['점수/등급', l.score_grade],
                  ['취득일', l.acquired_at],
                ]} />
              )} />

              <MyinfoGroup label={`수상 (${data.myinfo.awards.length})`} items={data.myinfo.awards} renderItem={(a) => (
                <MyinfoRow fields={[
                  ['대회명', a.contest_name],
                  ['수상명', a.award_name],
                  ['일자', a.awarded_at],
                ]} />
              )} />

              <MyinfoGroup label={`파일 (${data.myinfo.documents.length})`} items={data.myinfo.documents} renderItem={(d) => (
                <MyinfoRow fields={[
                  ['파일명', d.title],
                  ['카테고리', d.category],
                ]} />
              )} />

              <MyinfoGroup label={`자기소개서 문항 (${data.myinfo.coverletters.length})`} items={data.myinfo.coverletters} renderItem={(c) => (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-text-secondary">{String(c.label ?? '—')}</p>
                  {!!c.content && (
                    <p className="text-xs text-text-tertiary leading-relaxed whitespace-pre-wrap">
                      {String(c.content)}
                    </p>
                  )}
                </div>
              )} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-3">
      {children}
    </p>
  )
}

function MyinfoGroup<T extends Record<string, unknown>>({
  label,
  items,
  renderItem,
  emptyText,
}: {
  label: string
  items: T[]
  renderItem: (item: T) => React.ReactNode
  emptyText?: string
}) {
  return (
    <div>
      <p className="text-[11px] text-text-quaternary font-medium mb-1.5">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-text-quaternary">{emptyText ?? '없음'}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <div key={String(item.id ?? i)} className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MyinfoRow({ fields }: { fields: [string, unknown][] }) {
  const filled = fields.filter(([, v]) => v != null && v !== '')
  if (filled.length === 0) return <p className="text-xs text-text-quaternary">—</p>
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {filled.map(([label, val]) => (
        <span key={label} className="text-xs">
          <span className="text-text-quaternary">{label} </span>
          <span className="text-text-secondary">{String(val)}</span>
        </span>
      ))}
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'warning' | 'danger' | 'safe'
}) {
  const variantClass = {
    default: 'border-white/10 text-text-secondary hover:border-white/20 hover:text-text-primary hover:bg-white/[0.03]',
    warning: 'border-warning/20 text-warning/80 hover:border-warning/35 hover:text-warning hover:bg-warning/5',
    danger: 'border-danger/20 text-danger/80 hover:border-danger/35 hover:text-danger hover:bg-danger/5',
    safe: 'border-success/20 text-success/80 hover:border-success/35 hover:text-success hover:bg-success/5',
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-all disabled:opacity-40 ${variantClass}`}
    >
      <span className="text-base leading-none flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
