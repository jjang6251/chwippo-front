import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApplications } from '@/hooks/useApplications'
import {
  useDeleteInterviewSession,
  useInterviewPrepQuestions,
  useInterviewPrepSessions,
} from '@/hooks/useInterviewPrep'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import { toast } from '@/stores/toastStore'
import {
  CATEGORY_LABEL,
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'
import type {
  InterviewPrepSession,
  InterviewType,
} from '@/types/interviewPrep'

/**
 * F6 PR 2 Phase 4 — 면접 준비 통합 페이지 (`/interviews`).
 *
 * 기업 그룹 헤더 + 세션 리스트. 세션 클릭 → `/interviews/:sessionId` 상세.
 * 활동일지 `.aj-content` 너비 표준 (max-w-1100, px-9 py-9 desktop).
 */
export function Interviews() {
  const { data: applications = [], isLoading } = useApplications()
  const [creatingForAppId, setCreatingForAppId] = useState<string | null>(null)
  const navigate = useNavigate()
  // Phase 5c — 필터 state (면접 종류·기간)
  const [typeFilter, setTypeFilter] = useState<InterviewType | 'all'>('all')
  const [periodFilter, setPeriodFilter] = useState<'all' | '7d' | '30d'>('all')

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
        <div className="bg-surface-2 border border-dashed border-line rounded-xl p-10 text-center mt-5">
          <div className="text-3xl mb-3">🎤</div>
          <p className="text-text-secondary text-base font-medium mb-2">
            아직 지원 카드가 없어요
          </p>
          <p className="text-text-tertiary text-sm leading-relaxed mb-6">
            보드에서 회사 카드를 먼저 만든 뒤 면접 세션을 만들 수 있어요.
          </p>
          <Link
            to="/board"
            className="inline-block px-5 py-2.5 text-sm font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
          >
            보드로 이동 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <Header />

      {/* Phase 5c — 필터 bar */}
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
        <span className="text-text-quaternary text-[11px] font-medium mr-1">
          필터:
        </span>
        {(['all', 'technical', 'personality', 'etc'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
              typeFilter === t
                ? 'bg-brand text-text-primary border-brand'
                : 'bg-card hover:bg-card-strong border-line text-text-secondary'
            }`}
          >
            {t === 'all' ? '면접 종류 전체' : INTERVIEW_TYPE_LABEL[t]}
          </button>
        ))}
        <span className="text-text-quaternary mx-1">·</span>
        {(['all', '7d', '30d'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodFilter(p)}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
              periodFilter === p
                ? 'bg-brand text-text-primary border-brand'
                : 'bg-card hover:bg-card-strong border-line text-text-secondary'
            }`}
          >
            {p === 'all' ? '기간 전체' : p === '7d' ? '최근 7일' : '최근 30일'}
          </button>
        ))}
        {/*
          🔴 **필터를 푸는 길이 없었다.** 세션은 기업 그룹별로 따로 그려지는데, 필터가
          걸리면 각 그룹이 조용히 비어서 "세션이 사라졌다" 로 읽힌다. 어느 그룹이 비었는지는
          부모가 알 수 없으므로(그룹마다 따로 fetch 한다) **필터 자리에 되돌리는 버튼**을 둔다 —
          비어 보이는 원인이 여기 있다는 것도 같이 알려주는 자리다.
        */}
        {(typeFilter !== 'all' || periodFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter('all')
              setPeriodFilter('all')
            }}
            className="text-[11px] px-2 py-1 rounded-full border border-dashed border-line text-text-tertiary hover:text-text-primary hover:border-line-strong transition-colors"
          >
            필터 해제
          </button>
        )}
      </div>

      {/*
        🔴 **전부 필터에 걸리면 페이지가 텅 빈다.** 그룹은 관련 없을 때 스스로 숨는데
        (회사가 여럿이면 그게 맞다), 전부 숨으면 필터 바만 남아 "세션이 사라졌다" 로 읽힌다.
        세션은 그룹마다 따로 fetch 하므로 부모가 "전부 비었나" 를 알 수 없다 —
        컨테이너가 실제로 비었다는 사실을 **CSS 로** 읽어 아래 안내를 띄운다.
      */}
      <div className="peer space-y-6 mt-6">
        {active.map((app) => (
          <ApplicationInterviewGroup
            key={app.id}
            applicationId={app.id}
            companyName={app.companyName}
            jobTitle={app.jobTitle}
            jobCategory={app.jobCategory}
            typeFilter={typeFilter}
            periodFilter={periodFilter}
            onCreate={() => setCreatingForAppId(app.id)}
          />
        ))}
      </div>

      {/*
        `mt-6` 를 걸지 않는다 — 위 `peer` 컨테이너가 비어도 **높이 0으로 남은 채 자기 `mt-6` 는
        유지**한다. 여기 또 걸면 빈 상태일 때만 위 여백이 48px 로 벌어진다.
      */}
      <div className="hidden peer-empty:block border border-dashed border-line bg-surface-2/50 rounded-xl px-5 py-8 text-center">
        <p className="text-text-tertiary text-sm">
          이 조건에 맞는 세션이 없어요
        </p>
        <p className="text-text-quaternary text-xs mt-1">
          위 필터를 바꾸거나 해제해 보세요.
        </p>
      </div>

      {creatingForAppId && (
        <NewInterviewSessionModal
          applicationId={creatingForAppId}
          onClose={() => setCreatingForAppId(null)}
          /*
            만든 세션으로 **바로 들어간다.** 모달만 닫으면 목록에서 방금 만든 차수를
            눈으로 찾아 다시 눌러야 한다 — 만들자마자 할 일은 질문 생성이라 그 자리로 보낸다.
            카드 상세(`InterviewPrepTab`)는 진작 이렇게 하고 있었고 여기만 빠져 있었다.
          */
          onCreated={(sessionId) => {
            setCreatingForAppId(null)
            toast.show('면접 세션이 생성됐어요.')
            navigate(`/interviews/${sessionId}`)
          }}
          /*
            자소서 0건 → 그 카드의 **자소서 풀페이지**로 보낸다.
            예전엔 카드 상세의 자소서 탭(`?tab=coverletter`)으로 보냈는데, 거기서
            다시 풀페이지로 들어가야 실제로 쓸 수 있었다. 지금 필요한 건 "자소서를
            쓰는 것" 이므로 쓰는 자리로 바로 보낸다.
          */
          onNeedCoverletter={() => {
            const appId = creatingForAppId
            setCreatingForAppId(null)
            navigate(`/board/${appId}/coverletter`)
          }}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="space-y-2">
      <h1 className="text-text-primary text-[26px] font-bold leading-tight">
        면접 준비 <span className="text-brand italic">모아보기</span>
      </h1>
      <p className="text-text-tertiary text-sm leading-relaxed">
        지원한 회사들의 면접 세션을 한곳에서 확인. 세션 만들기·편집은 회사 그룹에서.
      </p>
    </header>
  )
}

function ApplicationInterviewGroup({
  applicationId,
  companyName,
  jobTitle,
  jobCategory,
  typeFilter,
  periodFilter,
  onCreate,
}: {
  applicationId: string
  companyName: string
  jobTitle: string | null
  jobCategory: string | null
  typeFilter: InterviewType | 'all'
  periodFilter: 'all' | '7d' | '30d'
  onCreate: () => void
}) {
  const { data: sessions = [], isLoading } = useInterviewPrepSessions(
    applicationId,
  )
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)

  // Phase 5c — 필터 적용. nowEpoch 는 useState lazy initializer 로 mount 1회만 계산 (purity 규칙 우회).
  const [nowEpoch] = useState(() => Date.now())
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (typeFilter !== 'all' && s.interviewType !== typeFilter) return false
      if (periodFilter !== 'all') {
        const days = periodFilter === '7d' ? 7 : 30
        const cutoff = nowEpoch - days * 24 * 60 * 60 * 1000
        if (new Date(s.createdAt).getTime() < cutoff) return false
      }
      return true
    })
  }, [sessions, typeFilter, periodFilter, nowEpoch])

  const handleDelete = (
    e: React.MouseEvent,
    sessionId: string,
    round: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = window.confirm(
      `🗑️ "${round}" 세션을 정말 삭제하시겠어요?\n\n생성된 질문과 메모가 모두 삭제됩니다 (회사 조사 캐시는 보존).\n복구할 수 없습니다.`,
    )
    if (!ok) return
    deleteSession(sessionId, {
      onSuccess: () => toast.show('세션을 삭제했어요.'),
      onError: () => toast.error('삭제에 실패했어요.'),
    })
  }

  if (isLoading) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-5 py-4">
        <div className="h-5 w-40 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-4 w-56 bg-surface-3 rounded animate-pulse" />
      </div>
    )
  }

  // 필터 적용 후 회사 자체가 비어있으면 회사 헤더 자체 안 표시 (clean)
  if (filtered.length === 0 && sessions.length > 0) return null

  // 기업 단위 강한 구분 — 회사 헤더 + 카드 그룹
  return (
    <section>
      {/* 기업 헤더 (그룹 라벨) — 세션 수 chip 포함 */}
      <div className="flex items-end justify-between gap-3 mb-3 px-1">
        <div className="min-w-0 flex items-end gap-2">
          <h2 className="text-text-primary text-lg font-bold leading-tight truncate">
            {companyName}
          </h2>
          {sessions.length > 0 && (
            <span className="text-text-quaternary text-[11px] font-mono">
              · {filtered.length}/{sessions.length} 세션
            </span>
          )}
          {(jobTitle || jobCategory) && (
            <p className="text-text-tertiary text-xs ml-1 truncate">
              {[jobCategory, jobTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          onClick={onCreate}
          className="text-xs text-brand hover:text-brand-hover border border-brand/30 hover:border-brand/60 bg-brand/5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap font-medium"
        >
          + 새 세션
        </button>
      </div>

      {/* 세션 카드 컨테이너 */}
      {/*
        🔴 **세 상태를 갈라야 한다.** 예전엔 `sessions.length === 0` 만 보고 나머지를
        `filtered.map()` 에 맡겼는데, 필터로 0건이 되면 **빈 `<ul>` 이 렌더돼 아무 문구 없이
        목록만 사라졌다.** 사용자는 세션이 지워진 줄 안다.

        🔴 필터로 0건인 경우는 **여기 오지 않는다** — 위쪽 early return 이 그룹을 통째로
        숨긴다(회사가 여럿일 때 관련 없는 회사를 지우는 게 맞다). 전부 숨어 페이지가
        비는 경우는 **페이지 레벨**에서 처리한다.
      */}
      {sessions.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-2/50 rounded-xl px-5 py-6 text-center">
          <p className="text-text-tertiary text-sm mb-1">
            아직 면접 세션이 없어요
          </p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-4">
            차수를 만들면 자소서를 바탕으로 예상 질문을 뽑아드려요.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="min-h-8 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors"
          >
            면접 차수 만들기
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onDelete={(e) => handleDelete(e, s.id, s.round)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Phase 5c — 세션 카드 (분리). 카테고리 분포 + 진행률 (my_memo 작성 %).
 * useInterviewPrepQuestions 으로 questions fetch — 세션 수만큼 N+1 query.
 * 면접 모아보기 트래픽 ↓ 이라 OK. 향후 batch endpoint 검토 가능.
 */
function SessionCard({
  session: s,
  onDelete,
}: {
  session: InterviewPrepSession
  onDelete: (e: React.MouseEvent) => void
}) {
  const { data: questions = [] } = useInterviewPrepQuestions(s.id)

  const stats = useMemo(() => {
    const mainQuestions = questions.filter((q) => q.depth === 0)
    const mainCount = mainQuestions.length
    const withMemo = mainQuestions.filter((q) => (q.myMemo ?? '').trim().length > 0).length
    const progressPct =
      mainCount > 0 ? Math.round((withMemo / mainCount) * 100) : 0
    // 카테고리 분포 top 3
    const catCount = new Map<string, number>()
    for (const q of mainQuestions) {
      const c = q.category ?? '(미분류)'
      catCount.set(c, (catCount.get(c) ?? 0) + 1)
    }
    const topCats = Array.from(catCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    return { mainCount, withMemo, progressPct, topCats }
  }, [questions])

  return (
    <li className="relative group">
      <Link
        to={`/interviews/${s.id}`}
        className="block border border-line bg-surface-2 hover:bg-surface-3 hover:border-line-strong rounded-xl px-4 py-3.5 pr-12 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-primary text-sm font-semibold truncate">
              {s.round}
            </span>
            {s.interviewType && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${INTERVIEW_TYPE_STYLE[s.interviewType]}`}
              >
                {INTERVIEW_TYPE_LABEL[s.interviewType]}
              </span>
            )}
          </div>
          <span className="text-text-faint text-xs shrink-0">
            {new Date(s.createdAt).toLocaleDateString('ko-KR')}
          </span>
        </div>

        {/* Phase 5c — 메인 개수 + 진행률 + 카테고리 분포 */}
        {stats.mainCount > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-text-tertiary">
                📋 메인 {stats.mainCount}개
              </span>
              <span className="text-text-quaternary">·</span>
              <span
                className={
                  stats.progressPct === 100
                    ? 'text-success font-semibold'
                    : stats.progressPct > 0
                      ? 'text-brand font-semibold'
                      : 'text-text-quaternary'
                }
              >
                ✎ {stats.withMemo}/{stats.mainCount} 메모 ({stats.progressPct}%)
              </span>
            </div>
            <div className="h-1 bg-surface rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stats.progressPct === 100 ? 'bg-success' : 'bg-brand'
                }`}
                style={{ width: `${stats.progressPct}%` }}
              />
            </div>
            {stats.topCats.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {stats.topCats.map(([cat, count]) => (
                  <span
                    key={cat}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20"
                  >
                    {CATEGORY_LABEL[cat] ?? cat} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {s.emphasisPoints && (
          <p className="text-text-tertiary text-xs mt-2 line-clamp-1">
            <span className="text-brand font-medium">강조 ·</span>{' '}
            {s.emphasisPoints}
          </p>
        )}
      </Link>
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 text-text-quaternary hover:text-danger px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="세션 삭제"
        aria-label={`${s.round} 세션 삭제`}
      >
        🗑️
      </button>
    </li>
  )
}
