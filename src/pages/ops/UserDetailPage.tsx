import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { GrantCoinModal } from '@/components/admin/GrantCoinModal'
import { RevokeCoinModal } from '@/components/admin/RevokeCoinModal'
import { SuspendUserModal } from '@/components/admin/SuspendUserModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * PR_B2 Phase 1 — 사용자 상세 페이지 (Q6 — 모든 항목 + 보기 편한 UI).
 *
 * 탭 4: 기본정보 / 활동·코인 / 문의 / Audit.
 */

interface UserDetail {
  basic: {
    id: string
    nickname: string
    email: string | null
    role: 'user' | 'admin'
    tier: 'free' | 'lite' | 'standard'
    createdAt: string
    lastActiveAt: string | null
    suspendedAt: string | null
    suspendReason: string | null
    suspendExpiresAt: string | null
  }
  coinBalance: {
    balance: number
    tier: string
    nextResetAt: string
    planExpiresAt: string | null
  } | null
  inquiries: Array<{ id: string; title: string; status: string; created_at: string }>
  auditLogs: Array<{
    id: string
    action: string
    detail: Record<string, unknown>
    ip: string | null
    userAgent: string | null
    createdAt: string
  }>
  activityStats: {
    applicationCount: number
    coverletterQuestionTotal: number
    coverletterCompanies: number
    coverletterAnswered: number
    interviewPrepCount: number
    activityLogCount: number
  }
}

type Tab = 'basic' | 'coin' | 'inquiry' | 'audit'

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '기본정보' },
  { key: 'coin', label: '활동·코인' },
  { key: 'inquiry', label: '문의' },
  { key: 'audit', label: 'Audit' },
]

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('basic')
  const [showGrant, setShowGrant] = useState(false)
  const [showRevoke, setShowRevoke] = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [auditFilter, setAuditFilter] = useState<
    'all' | 'coin' | 'suspend' | 'tier' | 'other'
  >('all')
  // PR_B2 — render 안 Date.now() impure 회피 (mount 시점 고정)
  const [renderedNow] = useState(() => Date.now())

  const { data, isLoading, isError } = useQuery<UserDetail>({
    queryKey: ['admin', 'user-detail', id],
    queryFn: () =>
      apiClient
        .get<{ data: UserDetail }>(`/admin/users/${id}/detail`)
        .then((r) => r.data.data),
    enabled: !!id,
  })

  const unsuspend = useMutation({
    mutationFn: () =>
      apiClient.delete(`/admin/users/${id}/suspend`).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin', 'user-detail', id] }),
  })

  if (isLoading) {
    return <div className="p-9 text-text-tertiary text-sm">로딩 중...</div>
  }
  if (isError || !data) {
    return <div className="p-9 text-danger text-sm">사용자 정보를 불러올 수 없어요</div>
  }

  const { basic, coinBalance, inquiries, auditLogs, activityStats } = data
  const isSuspended = basic.suspendedAt !== null

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-4">
      {/* breadcrumb */}
      <Link
        to="/ops/users"
        className="text-text-tertiary text-xs hover:text-text-primary"
      >
        ← 회원 관리
      </Link>

      {/* 헤더 — A: At-a-glance summary (잔여 코인·마지막 활동·가입 N일째) */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-text-primary text-2xl font-bold">
            {basic.nickname}
          </h1>
          {basic.role === 'admin' && (
            <span className="bg-brand/15 text-brand border border-brand/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              admin
            </span>
          )}
          {isSuspended && (
            <span className="bg-danger/15 text-danger border border-danger/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              정지됨
            </span>
          )}
          <span className="bg-card-strong border border-line text-text-tertiary text-[10px] font-mono px-2 py-0.5 rounded-full">
            {basic.tier}
          </span>
        </div>
        <p className="text-text-quaternary text-xs">
          {basic.email ?? '(이메일 없음)'} · 가입{' '}
          {new Date(basic.createdAt).toLocaleDateString('ko-KR')}
          {' '}({Math.floor(
            (renderedNow - new Date(basic.createdAt).getTime()) / 86400000,
          )}
          일째)
        </p>
        {/* 미니 stat — admin 한눈 정보 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <MiniStat
            label="잔여 코인"
            value={coinBalance ? `${coinBalance.balance}` : '-'}
            sub={coinBalance ? coinBalance.tier : undefined}
          />
          <MiniStat
            label="마지막 활동"
            value={
              basic.lastActiveAt
                ? relativeTime(basic.lastActiveAt, renderedNow)
                : '없음'
            }
            sub={
              basic.lastActiveAt
                ? new Date(basic.lastActiveAt).toLocaleDateString('ko-KR')
                : undefined
            }
          />
          <MiniStat
            label="지원 카드"
            value={`${activityStats.applicationCount}`}
            sub={`자소서 ${activityStats.coverletterCompanies}곳`}
          />
        </div>
      </header>

      {/* 빠른 액션 — B: sticky bar (스크롤 시 항상 보임) */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-9 px-4 lg:px-9 py-2 bg-bg/95 backdrop-blur-sm border-y border-line flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowGrant(true)}
          className="bg-brand hover:bg-accent text-text-primary text-xs font-semibold px-3 py-1.5 rounded-md"
        >
          🪙 코인 지급
        </button>
        <button
          type="button"
          onClick={() => setShowRevoke(true)}
          disabled={!coinBalance || coinBalance.balance <= 0}
          className="bg-card-strong hover:bg-surface-2 border border-line text-text-secondary text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-40"
        >
          ⚖️ 코인 환수
        </button>
        {isSuspended ? (
          <button
            type="button"
            onClick={() => unsuspend.mutate()}
            disabled={unsuspend.isPending}
            className="bg-success/15 hover:bg-success/25 border border-success/30 text-success text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            ✅ 정지 해제
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSuspend(true)}
            disabled={basic.role === 'admin'}
            className="bg-danger/15 hover:bg-danger/25 border border-danger/30 text-danger text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
            title={
              basic.role === 'admin' ? 'admin 계정은 정지할 수 없습니다' : ''
            }
          >
            ⛔ 정지
          </button>
        )}
      </div>

      {/* 정지 정보 (정지 시만) */}
      {isSuspended && (
        <div className="bg-danger/10 border border-danger/20 rounded-md p-3 space-y-1 text-xs">
          <p className="text-text-secondary font-medium">정지 사유: {basic.suspendReason ?? '(미지정)'}</p>
          <p className="text-text-quaternary">정지: {new Date(basic.suspendedAt!).toLocaleString('ko-KR')}</p>
          <p className="text-text-quaternary">
            해제 예정: {basic.suspendExpiresAt ? new Date(basic.suspendExpiresAt).toLocaleString('ko-KR') : '영구'}
          </p>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-3 py-2 transition-colors ${
              tab === t.key
                ? 'text-brand border-b-2 border-brand -mb-px'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 — E: 기본정보 2 카드 grouping (계정 / 시스템) */}
      {tab === 'basic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card border border-line rounded-xl p-5 space-y-2 text-sm">
            <h3 className="text-text-primary text-sm font-semibold pb-2 border-b border-line">
              계정 정보
            </h3>
            <Row label="닉네임" value={basic.nickname} />
            <Row label="이메일" value={basic.email ?? '-'} />
            <Row label="권한" value={basic.role} />
            <Row label="Tier" value={basic.tier} />
          </div>
          <div className="bg-card border border-line rounded-xl p-5 space-y-2 text-sm">
            <h3 className="text-text-primary text-sm font-semibold pb-2 border-b border-line">
              시스템 정보
            </h3>
            <Row label="ID" value={basic.id} mono />
            <Row
              label="가입일"
              value={new Date(basic.createdAt).toLocaleString('ko-KR')}
            />
            <Row
              label="마지막 활동"
              value={
                basic.lastActiveAt
                  ? new Date(basic.lastActiveAt).toLocaleString('ko-KR')
                  : '-'
              }
            />
            <Row
              label="정지 상태"
              value={isSuspended ? '정지됨' : '정상'}
            />
          </div>
        </div>
      )}

      {tab === 'coin' && (
        <div className="bg-card border border-line rounded-xl p-5 space-y-3">
          <h3 className="text-text-primary text-sm font-semibold">코인 잔액</h3>
          {coinBalance ? (
            <div className="space-y-1.5 text-sm">
              <Row label="잔여 코인" value={`${coinBalance.balance} 코인`} mono />
              <Row label="Tier" value={coinBalance.tier} />
              <Row label="다음 reset" value={new Date(coinBalance.nextResetAt).toLocaleString('ko-KR')} />
              <Row
                label="Plan 만료"
                value={coinBalance.planExpiresAt ? new Date(coinBalance.planExpiresAt).toLocaleString('ko-KR') : '-'}
              />
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">코인 정보 없음 (지급 시 자동 생성)</p>
          )}
          <h3 className="text-text-primary text-sm font-semibold pt-3 border-t border-line">활동 통계</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="지원 카드" value={activityStats.applicationCount} />
            <Stat
              label="자소서 작성 회사"
              value={activityStats.coverletterCompanies}
              hint={`총 문항 ${activityStats.coverletterQuestionTotal}개 · 답변 ${activityStats.coverletterAnswered}개`}
            />
            <Stat label="면접 prep" value={activityStats.interviewPrepCount} />
            <Stat label="활동 일지" value={activityStats.activityLogCount} />
          </div>
        </div>
      )}

      {tab === 'inquiry' && (
        <div className="bg-card border border-line rounded-xl p-5">
          {inquiries.length === 0 ? (
            <p className="text-text-tertiary text-sm">문의 내역 없음</p>
          ) : (
            <ul className="divide-y divide-line">
              {inquiries.map((iq) => (
                <li
                  key={iq.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-text-secondary text-sm truncate">
                      {iq.title}
                    </p>
                    <p className="text-text-quaternary text-[10px] font-mono">
                      {new Date(iq.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <InquiryStatusBadge status={iq.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-card border border-line rounded-xl p-5 space-y-3">
          {/* D: filter chip */}
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: '모든 액션' },
                { key: 'coin', label: '코인' },
                { key: 'suspend', label: '정지' },
                { key: 'tier', label: 'Tier·권한' },
                { key: 'other', label: '기타' },
              ] as const
            ).map((f) => {
              const count =
                f.key === 'all'
                  ? auditLogs.length
                  : auditLogs.filter((l) => matchAuditFilter(f.key, l.action)).length
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAuditFilter(f.key)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                    auditFilter === f.key
                      ? 'bg-brand/15 text-brand border-brand/30'
                      : 'bg-card-strong border-line text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {f.label}{' '}
                  <span className="text-[10px] font-mono">({count})</span>
                </button>
              )
            })}
          </div>
          {(() => {
            const filtered = auditLogs.filter((l) =>
              matchAuditFilter(auditFilter, l.action),
            )
            if (filtered.length === 0)
              return (
                <p className="text-text-tertiary text-sm">
                  해당 조건의 audit 없음
                </p>
              )
            return (
              <ol className="space-y-3">
                {filtered.map((log) => (
                  <AuditLogItem key={log.id} log={log} />
                ))}
              </ol>
            )
          })()}
        </div>
      )}

      {/* 모달 */}
      {showGrant && (
        <GrantCoinModal
          userId={basic.id}
          nickname={basic.nickname}
          onClose={() => setShowGrant(false)}
        />
      )}
      {showRevoke && coinBalance && (
        <RevokeCoinModal
          userId={basic.id}
          nickname={basic.nickname}
          currentBalance={coinBalance.balance}
          onClose={() => setShowRevoke(false)}
        />
      )}
      {showSuspend && (
        <SuspendUserModal
          userId={basic.id}
          nickname={basic.nickname}
          onClose={() => setShowSuspend(false)}
        />
      )}
    </div>
  )
}

// PR_B2 Phase 2b — admin 전역 utils 통일 (memory: admin 페이지 한국어 라벨 강제)
import { AUDIT_ACTION_KR } from '@/utils/featureLabel'
const ACTION_META = AUDIT_ACTION_KR

const TONE_STYLE: Record<string, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-surface-2 text-text-tertiary border-line',
}

function relativeTime(iso: string, now: number = Date.now()): string {
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

function formatDetailLine(action: string, detail: Record<string, unknown>): string[] {
  const lines: string[] = []
  const get = (k: string): string | undefined => {
    const v = detail[k]
    return v === undefined || v === null ? undefined : String(v)
  }

  switch (action) {
    case 'grant_coin': {
      const amount = get('amount')
      const reason = get('reason')
      const memo = get('memo')
      const before = get('balanceBefore')
      const after = get('balanceAfter')
      if (amount) lines.push(`+${amount} 코인`)
      if (before && after) lines.push(`잔여 ${before} → ${after}`)
      if (reason) lines.push(`사유 · ${reason}`)
      if (memo) lines.push(`메모 · ${memo}`)
      break
    }
    case 'revoke_coin': {
      const requested = get('requested')
      const actual = get('actualRevoked')
      const reason = get('reason')
      const memo = get('memo')
      const before = get('before')
      const after = get('after')
      if (actual) lines.push(`-${actual} 코인 (요청 ${requested})`)
      if (before && after) lines.push(`잔여 ${before} → ${after}`)
      if (reason) lines.push(`사유 · ${reason}`)
      if (memo) lines.push(`메모 · ${memo}`)
      break
    }
    case 'suspend':
    case 'update_suspend_reason': {
      const reason = get('reason')
      const expiresAt = get('expiresAt')
      if (reason) lines.push(`사유 · ${reason}`)
      lines.push(`해제 · ${expiresAt ? new Date(expiresAt).toLocaleString('ko-KR') : '영구'}`)
      break
    }
    case 'unsuspend': {
      const prevReason = get('previousReason')
      if (prevReason) lines.push(`이전 사유 · ${prevReason}`)
      break
    }
    case 'auto_unsuspend': {
      lines.push('만료에 의한 시스템 자동 해제')
      break
    }
    case 'update_tier':
    case 'grant_admin':
    case 'revoke_admin':
    case 'rename': {
      const before = get('before')
      const after = get('after')
      if (before && after) lines.push(`${before} → ${after}`)
      break
    }
    case 'warn': {
      const message = get('message')
      if (message) lines.push(`메시지 · ${message}`)
      break
    }
    default: {
      const entries = Object.entries(detail).slice(0, 3)
      for (const [k, v] of entries) {
        if (v === null || v === undefined) continue
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
        lines.push(`${k} · ${val.length > 60 ? val.slice(0, 60) + '...' : val}`)
      }
    }
  }
  return lines
}

interface AuditLog {
  id: string
  action: string
  detail: Record<string, unknown>
  ip: string | null
  userAgent: string | null
  createdAt: string
}

function AuditLogItem({ log }: { log: AuditLog }) {
  // PR_B2 — render 안 Date.now() impure 회피
  const [renderedNow] = useState(() => Date.now())
  const meta = ACTION_META[log.action] ?? {
    label: log.action,
    icon: '•',
    tone: 'neutral' as const,
  }
  const lines = formatDetailLine(log.action, log.detail)
  const absoluteTime = new Date(log.createdAt).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li className="bg-card-strong border border-line rounded-lg px-3 py-2.5 hover:border-line-strong transition-colors">
      <div className="flex gap-3">
        {/* 좌측 — icon + tone 배지 */}
        <div
          className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center text-base ${TONE_STYLE[meta.tone]}`}
          aria-hidden="true"
        >
          {meta.icon}
        </div>
        {/* 우측 — 본문 */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-text-primary text-sm font-semibold">
              {meta.label}
            </span>
            <span className="text-text-quaternary text-[10px]">
              {relativeTime(log.createdAt, renderedNow)}
            </span>
            <span className="text-text-faint text-[10px] font-mono">
              · {absoluteTime}
            </span>
          </div>
          {lines.length > 0 && (
            <ul className="space-y-0.5">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className="text-text-tertiary text-xs whitespace-pre-line"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
          {log.ip && (
            <p className="text-text-faint text-[10px] font-mono">
              IP {log.ip}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

// PR_B2 Phase 1 — A 헤더 미니 stat
function MiniStat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-card-strong border border-line rounded-md px-3 py-2">
      <p className="text-text-quaternary text-[10px] mb-0.5">{label}</p>
      <p className="text-text-primary text-sm font-bold font-mono">{value}</p>
      {sub && (
        <p className="text-text-faint text-[9px] mt-0.5 truncate">{sub}</p>
      )}
    </div>
  )
}

// PR_B2 Phase 1 — C 문의 status badge
function InquiryStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; tone: string }> = {
    OPEN: { label: '대기', tone: 'bg-info/10 text-info border-info/30' },
    IN_PROGRESS: {
      label: '처리 중',
      tone: 'bg-warning/10 text-warning border-warning/30',
    },
    CLOSED: {
      label: '완료',
      tone: 'bg-success/10 text-success border-success/30',
    },
  }
  const m = meta[status] ?? {
    label: status,
    tone: 'bg-card-strong border-line text-text-tertiary',
  }
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.tone}`}
    >
      {m.label}
    </span>
  )
}

// PR_B2 Phase 1 — D Audit filter
function matchAuditFilter(filter: string, action: string): boolean {
  if (filter === 'all') return true
  if (filter === 'coin') return action === 'grant_coin' || action === 'revoke_coin'
  if (filter === 'suspend')
    return (
      action === 'suspend' ||
      action === 'unsuspend' ||
      action === 'update_suspend_reason' ||
      action === 'auto_unsuspend'
    )
  if (filter === 'tier')
    return (
      action === 'update_tier' ||
      action === 'grant_admin' ||
      action === 'revoke_admin'
    )
  if (filter === 'other')
    return ![
      'grant_coin',
      'revoke_coin',
      'suspend',
      'unsuspend',
      'update_suspend_reason',
      'auto_unsuspend',
      'update_tier',
      'grant_admin',
      'revoke_admin',
    ].includes(action)
  return true
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-quaternary text-xs flex-shrink-0">{label}</span>
      <span
        className={`text-text-secondary text-xs text-right truncate ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="bg-card-strong border border-line rounded-md p-3 text-center">
      <p className="text-text-quaternary text-[10px] mb-1">{label}</p>
      <p className="text-text-primary text-xl font-bold font-mono">{value}</p>
      {hint && (
        <p className="text-text-faint text-[9px] mt-1 leading-tight">{hint}</p>
      )}
    </div>
  )
}
