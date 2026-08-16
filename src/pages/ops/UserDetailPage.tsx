import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { AiQuotaOverrideCard } from '@/components/admin/AiQuotaOverrideCard'
import { GrantCoinModal } from '@/components/admin/GrantCoinModal'
import { RevokeCoinModal } from '@/components/admin/RevokeCoinModal'
import { SuspendUserModal } from '@/components/admin/SuspendUserModal'
import { ForcePlanChangeModal } from '@/components/admin/ForcePlanChangeModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDateTime } from '@/utils/datetime'
import { toast } from '@/stores/toastStore'
import { exportAdminUser } from '@/api/adminUsers'
import { ConfirmModal } from '@/pages/Activity/modals/ConfirmModal'
import {
  cardChip,
  type AdminApplicationStatus,
  type AdminChipTone,
} from '@/utils/adminApplicationChip'
import { visitDetailLine, visitSummary } from '@/utils/visitStats'

/**
 * PR_B2 Phase 1 — 사용자 상세 페이지 (Q6 — 모든 항목 + 보기 편한 UI).
 *
 * 탭 5: 기본정보 / 지원 카드 / 활동·코인 / 문의 / Audit.
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
  /**
   * 운영 조회용 지원 카드 — 회사·직무·진행 상태만.
   * 메모·자소서 답변 등 사용자가 쓴 본문은 의도적으로 없다
   * (그건 방침 §7 "데이터 이동 요청" 경로인 export 로만 열람).
   */
  applications: Array<{
    id: string
    companyName: string
    jobTitle: string | null
    status: AdminApplicationStatus
    isSample: boolean
    createdAt: string
    currentStepName: string | null
    currentStepDate: string | null
  }>
  activityStats: {
    applicationCount: number
    coverletterQuestionTotal: number
    coverletterCompanies: number
    coverletterAnswered: number
    interviewPrepCount: number
    activityLogCount: number
  }
  /**
   * A8 `user_daily_visits` 기반 방문 이력.
   * `lastActiveAt` 은 마지막 한 점만 덮어써서 "얼마나 꾸준히 오나"를 못 답한다 — 그걸 여기가 답한다.
   * ⚠️ `firstVisitDate` 는 **집계 시작일**이지 가입일이 아니다 (테이블 도입 2026-07-07).
   *
   * **optional 인 게 의도다.** 프론트(Vercel)가 백엔드(Railway)보다 먼저 뜨는 배포 창에는
   * 이 필드가 없다. 필수로 두면 타입은 통과하고 런타임에 터진다 —
   * optional 로 둬야 컴파일러가 undefined 처리를 강제한다. (`applications` 와 같은 이유)
   */
  visitStats?: {
    totalDays: number
    last30Days: number
    firstVisitDate: string | null
  }
}

type Tab = 'basic' | 'cards' | 'coin' | 'inquiry' | 'audit'

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '기본정보' },
  { key: 'cards', label: '지원 카드' },
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
  const [showPlanChange, setShowPlanChange] = useState(false)
  const [showExportConfirm, setShowExportConfirm] = useState(false)
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

  /** 방침 §7 개인정보 이동 요청 — 전체 데이터를 .json 파일로 내려받는다 */
  const exportUser = useMutation({
    mutationFn: () => exportAdminUser(id!),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chwippo-user-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
      setShowExportConfirm(false)
      toast.show('데이터를 내려받았어요.')
    },
    onError: () => {
      setShowExportConfirm(false)
      toast.show('내보내기에 실패했어요. 잠시 후 다시 시도해주세요.')
    },
  })

  if (isLoading) {
    return <div className="p-9 text-text-tertiary text-sm">로딩 중...</div>
  }
  if (isError || !data) {
    return <div className="p-9 text-danger text-sm">사용자 정보를 불러올 수 없어요</div>
  }

  const { basic, coinBalance, inquiries, auditLogs, activityStats } = data
  // 배포 순서 무관 — 백엔드가 먼저 나가지 않아도 빈 배열로 안전하게 렌더
  const applications = data.applications ?? []
  /*
    같은 이유로 undefined 일 수 있다. 단 여기선 **기본값을 채우지 않는다** —
    `?? { totalDays: 0 }` 은 "모른다"를 "0회 방문했다"는 거짓 주장으로 바꾼다.
    undefined 를 그대로 넘겨서 visitSummary/visitDetailLine 이 '-' 를 그리게 한다.
  */
  const visitStats = data.visitStats
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
          {/* PR_B2 Phase 3 — plan 만료 예정 표시 (lite/standard + plan_expires_at 있을 때) */}
          {coinBalance?.planExpiresAt && basic.tier !== 'free' && (
            <span className="bg-warning/10 border border-warning/30 text-warning text-[10px] font-mono px-2 py-0.5 rounded-full">
              ⏱ {new Date(coinBalance.planExpiresAt).toLocaleDateString('ko-KR')}{' '}
              만료 (D-
              {Math.max(
                0,
                Math.ceil(
                  (new Date(coinBalance.planExpiresAt).getTime() - renderedNow) /
                    86400000,
                ),
              )}
              )
            </span>
          )}
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
        {/* 형제 ops 화면(OpsPage·SystemStatusPanel)이 쓰는 `grid-cols-2 md:grid-cols-4` 와 통일.
            320px 에서 4개를 한 줄에 넣으면 값이 잘린다 → 2×2 로 접는다 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <MiniStat
            label="잔여 코인"
            value={coinBalance ? `${coinBalance.balance}` : '-'}
            sub={coinBalance ? coinBalance.tier : undefined}
          />
          {/*
            "마지막 활동" → "마지막 접속". 그리고 sub 를 날짜에서 **시각까지**로 올렸다 —
            전엔 저장값이 "그날 첫 접속 시각" 이라 시각을 보여주면 거짓말이었지만,
            이제 1분 throttle 이라 진짜 마지막 접속 시각이다.
          */}
          <MiniStat
            label="마지막 접속"
            value={
              basic.lastActiveAt
                ? relativeTime(basic.lastActiveAt, renderedNow)
                : '없음'
            }
            sub={
              basic.lastActiveAt
                ? /*
                     `dateStyle:'short' + timeStyle:'short'` 는 320px 2열에서 **12월에 잘린다**
                     ("26. 12. 25. 오후 12:38 KST" = 117px / 칸 88px, 실측 2026-07-30).
                     월·일·시각만 남기면 81px 로 여유가 생긴다. 연도는 relativeTime 이 대신 말해준다.
                     `hourCycle:'h23'` 강제 — `hour12:false` 는 ICU 버전에 따라 자정이 24:00 이 된다.
                  */
                  `${new Date(basic.lastActiveAt).toLocaleString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  })} KST`
                : undefined
            }
          />
          {/*
            방문일수 — 총계만 보면 "가입 3개월에 24일"과 "가입 1주에 5일"을 구분 못 한다.
            지금 꾸준한지는 **최근 30일**이 답하므로 sub 로 같이 준다.
          */}
          <MiniStat label="방문" {...visitSummary(visitStats)} />
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
          className="bg-brand hover:bg-accent text-bg text-xs font-semibold px-3 py-1.5 rounded-md"
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
        {/* PR_B2 Phase 3 — Plan 강제 변경 */}
        <button
          type="button"
          onClick={() => setShowPlanChange(true)}
          disabled={basic.role === 'admin'}
          className="bg-info/15 hover:bg-info/25 border border-info/30 text-info text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
          title={basic.role === 'admin' ? 'admin 계정 X' : ''}
        >
          ⬆️ Plan 변경
        </button>
        {/*
          개인정보처리방침 §7 "개인정보 이동 요청" 이행 수단.
          상세 모달 → 페이지 개편 때 이 버튼이 함께 사라져 **방침에 적어둔 권리를
          행사해줄 UI 가 없는 상태**였다 (2026-07-28 복구). 백엔드
          POST /admin/users/:id/export 는 계속 살아 있었음. 실행 시 admin_audit_logs 기록.
        */}
        <button
          type="button"
          onClick={() => setShowExportConfirm(true)}
          disabled={exportUser.isPending}
          className="ml-auto bg-card-strong hover:bg-surface-2 border border-line text-text-tertiary text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          title="개인정보 이동 요청 처리용 — 전체 데이터를 .json 으로 내려받습니다 (audit 기록됨)"
        >
          {exportUser.isPending ? '내보내는 중…' : '📦 데이터 내보내기'}
        </button>
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
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
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
            {/*
              `mono` 를 붙였다가 뺐다 — 320px 에서 값이 **40px 잘렸다**
              (칸 140px / DM Mono 실제 180px, 실측 2026-07-30). 값에 "오후" 같은 한글이 섞여
              DM Mono 에 글리프가 없어 중간에 폰트가 갈리기도 하고, 바로 위 `가입일` 이
              같은 포맷인데 mono 가 아니라 두 행이 달라 보였다. DM Mono 는 숫자·코드용이다.
            */}
            <Row
              label="마지막 접속 (KST)"
              value={
                basic.lastActiveAt
                  ? new Date(basic.lastActiveAt).toLocaleString('ko-KR')
                  : '-'
              }
            />
            {/*
              총 방문일수를 그냥 "24일" 로만 쓰면 **가입 후 24일로 읽힌다.**
              user_daily_visits 는 2026-07-07 부터 쌓여서, 그 전 가입자는 부분값이다
              (예: 4/28 가입자의 24일 = 7/7 이후 24일). 집계 시작일을 같이 붙여 오해를 막는다.
            */}
            <Row label="방문일수" value={visitDetailLine(visitStats)} />
            <Row
              label="정지 상태"
              value={isSuspended ? '정지됨' : '정상'}
            />
          </div>
        </div>
      )}

      {tab === 'cards' && <ApplicationsTab applications={applications} />}

      {tab === 'coin' && (
        <div className="space-y-4">
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
        {/* cost hardening B-4 — AI 개별 한도 */}
        <AiQuotaOverrideCard userId={basic.id} />
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
      {showPlanChange && (
        <ForcePlanChangeModal
          userId={basic.id}
          nickname={basic.nickname}
          currentTier={basic.tier}
          onClose={() => setShowPlanChange(false)}
        />
      )}

      {/*
        내보내기는 되돌릴 수 없는 액션은 아니지만 **타인의 실명·전화·자소서 전문을
        통째로 파일로 꺼내는** 행위다. 실수 클릭 방지 + "지금 무슨 일을 하는지" 자각을
        위해 확인 단계를 둔다. 파괴적 액션이 아니므로 danger 톤은 쓰지 않는다.
        ESC=취소는 공용 ConfirmModal 이 ADR-053 조율 계약대로 처리한다.
      */}
      <ConfirmModal
        open={showExportConfirm}
        emoji="📦"
        title="회원 데이터를 내려받을까요?"
        desc={`${basic.nickname} 님의 실명·연락처·자소서 답변을 포함한 전체 데이터가 .json 파일로 저장됩니다. 개인정보 이동·열람 요청 처리 목적으로만 사용하세요. 이 작업은 관리자 기록(audit)에 남습니다.`}
        confirmLabel="내려받기"
        danger={false}
        pending={exportUser.isPending}
        onCancel={() => setShowExportConfirm(false)}
        onConfirm={() => exportUser.mutate()}
      />
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

// ─── 지원 카드 탭 ─────────────────────────────────────────────────────────────

type AdminApplication = UserDetail['applications'][number]

/** 보드 리스트 뷰(BoardListRow)와 동일한 tone 체계 — 운영 화면도 같은 색을 읽게 */
const CARD_TONE: Record<AdminChipTone, string> = {
  warning: 'text-warning bg-warning/10 border border-warning/25',
  success: 'text-success bg-success/10 border border-success/25',
  neutral: 'text-text-secondary bg-surface-3 border border-transparent',
}

const STATUS_FILTERS: { key: 'all' | AdminApplicationStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'IN_PROGRESS', label: '진행 중' },
  { key: 'PLANNED', label: '지원 예정' },
  { key: 'PASSED', label: '합격' },
  { key: 'FAILED', label: '불합격' },
]

function ApplicationsTab({ applications }: { applications: AdminApplication[] }) {
  const [filter, setFilter] = useState<'all' | AdminApplicationStatus>('all')
  const shown =
    filter === 'all'
      ? applications
      : applications.filter((a) => a.status === filter)

  return (
    <div className="bg-card border border-line rounded-xl p-5 space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? applications.length
              : applications.filter((a) => a.status === f.key).length
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                filter === f.key
                  ? 'bg-brand/15 text-brand border-brand/30'
                  : 'bg-card-strong border-line text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {f.label} <span className="text-[10px] font-mono">({count})</span>
            </button>
          )
        })}
      </div>

      {applications.length === 0 ? (
        <p className="text-text-tertiary text-sm">
          아직 만든 지원 카드가 없어요.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-text-tertiary text-sm">해당 상태의 카드 없음</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((app) => {
            const chip = cardChip(app)
            return (
              <li key={app.id} className="py-2.5 flex items-center gap-2.5">
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <span className="text-text-primary text-sm font-semibold truncate">
                    {app.companyName}
                  </span>
                  {app.jobTitle && (
                    <span className="hidden sm:inline text-text-tertiary text-xs truncate">
                      {app.jobTitle}
                    </span>
                  )}
                  {app.isSample && (
                    <span className="flex-none text-text-quaternary text-[10px]">
                      샘플
                    </span>
                  )}
                </div>
                <span
                  className={`flex-none text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${CARD_TONE[chip.tone]}`}
                >
                  {chip.label}
                </span>
                <span className="flex-none w-[86px] text-right text-text-tertiary text-[11px] font-mono">
                  {app.currentStepDate
                    ? formatDateTime(app.currentStepDate).slice(0, 10)
                    : '—'}
                </span>
                <span className="hidden sm:block flex-none w-[86px] text-right text-text-quaternary text-[11px] font-mono">
                  {formatDateTime(app.createdAt).slice(0, 10)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-text-quaternary text-[11px] pt-1 border-t border-line leading-relaxed">
        열 순서 — 회사 · 직무 · 현재 단계 · 단계 예정일 · 카드 생성일 (KST).
        메모·자소서 등 회원이 작성한 내용은 여기 표시되지 않습니다.
      </p>
    </div>
  )
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
      {/*
        `text-faint` 였는데 **다크 2.64:1 · 라이트 2.84:1** 로 그래픽 최저선(3:1)에도 미달했다
        (2026-07-30 토큰 실측). DESIGN.md 규칙 6 이 text-faint 를 "장식 전용, 본문성 정보 금지"
        로 두는데 여기엔 자소서 곳수·방문일수 같은 **읽어야 하는 값**이 들어간다.
        tertiary 로 올려 5.00 / 5.94:1. 9px → 10px 도 같이 (숫자를 읽으라고 넣은 자리다).
      */}
      {sub && (
        <p className="text-text-tertiary text-[10px] mt-0.5 truncate">{sub}</p>
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
