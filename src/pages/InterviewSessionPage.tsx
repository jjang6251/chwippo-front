import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Star } from 'lucide-react'
import { CompanyResearchCard } from '@/components/card/CompanyResearchCard'
import { JobTitleField } from '@/components/common/JobTitleField'
import { useRequireJobTitle } from '@/hooks/useRequireJobTitle'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { EditInterviewSessionModal } from '@/components/card/EditInterviewSessionModal'
import { InterviewQuestionCard } from '@/components/card/InterviewQuestionCard'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useApplication } from '@/hooks/useApplications'
import {
  useDeleteInterviewSession,
  useGenerateInterviewSession,
  questionsKey,
  sessionKey,
  useInterviewPrepQuestions,
  useInterviewPrepRefs,
  useInterviewPrepSession,
  useRefetchQuestionsOnGenerationEnd,
  useUpdateInterviewPrepSession,
} from '@/hooks/useInterviewPrep'
import { useAiQuotaBlocked, useMyAiQuota } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import {
  INTERVIEW_SIDEBAR_EXPANDED_STORAGE_KEY as SIDEBAR_EXPANDED_KEY,
  saveCollapseExpanded,
} from '@/utils/collapsePref'
import { toast } from '@/stores/toastStore'
import {
  CATEGORY_FLOW_FALLBACK,
  CATEGORY_FLOW_ORDER,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * F6 PR 2 Phase 4 — 면접 세션 풀스크린 페이지.
 *
 * 라우트: `/interviews/:sessionId` — 사이드바 "면접 준비" active 유지.
 * applicationId 는 session 응답으로부터 추출 (백엔드 user_id 가드 보장).
 */
export function InterviewSessionPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const {
    data: session,
    isLoading: sessionLoading,
    isError: sessionError,
  } = useInterviewPrepSession(sessionId)
  const applicationId = session?.applicationId ?? ''
  const { data: app } = useApplication(applicationId)
  // 사전 게이트 — 누르기 전에 직무를 받는다 (누른 뒤 실패로 알게 되지 않도록)
  const ensureJobTitle = useRequireJobTitle(applicationId)
  const {
    data: questions = [],
    isLoading: questionsLoading,
    isError: questionsError,
  } = useInterviewPrepQuestions(sessionId)
  const { data: refs } = useInterviewPrepRefs(sessionId)
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked('interview_prep_session')
  const quota = useMyAiQuota('interview_prep_session')
  const { mutateAsync: generateSession, isPending: pendingLocal } =
    useGenerateInterviewSession(sessionId)
  /**
   * 🔴 **서버 상태를 함께 본다.** `isPending` 은 이 탭의 요청이 살아 있는 동안만 true 라,
   * 새로고침하면 false 로 돌아가 화면이 "아직 질문이 없어요" 를 띄운다 — 사용자는
   * 실패한 줄 알고 다시 누르고, in-flight lock 에 막혀 엉뚱한 문구를 본다.
   * `generationStatus` 는 새로고침해도 살아 있으므로 그걸 같이 본다.
   */
  const generating =
    pendingLocal || session?.generationStatus === 'in_progress'
  /*
    생성 중 새로고침하면 이 탭엔 mutation 이 없어 완료를 알 방법이 없었다 —
    서버는 질문을 다 만들어 놨는데 화면은 0개인 채로 생성 버튼을 다시 띄웠다.
  */
  useRefetchQuestionsOnGenerationEnd(sessionId, session?.generationStatus)
  const ensureAiConsent = useRequireAiConsent()
  // 생성 중 새로고침 = 코인만 차감되고 질문은 유실 (면접에만 이 가드가 없었다)
  useUnloadGuard(generating)
  const { mutate: updateSession, isPending: updatingSession } =
    useUpdateInterviewPrepSession(sessionId, applicationId)
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)
  const [editing, setEditing] = useState(false)
  /**
   * 읽기 모드 — **면접 직전에 꺼내 보는 화면**.
   *
   * 이 페이지는 준비하는 화면이라 편집 표면이 촘촘하다. 대기실에서 스크롤하다
   * `AI 도움`·`꼬리질문 추가` 를 잘못 누르면 **코인이 나간다.** 읽기 모드는 그 버튼을
   * 전부 감추고, 꼬리질문까지 펼쳐 **훑어보기**에 맞춘다.
   *
   * 🔴 자소서의 `useCoverletterReadOnly` 처럼 **강제하지 않는다** — 그건 뷰포트·네이티브로
   * 편집을 막는 제약(IAP 심사)이라, 면접에 적용하면 모바일에서 질문 생성 자체를 못 한다.
   * 여기선 사용자가 고르는 토글이다.
   */
  const [readMode, setReadMode] = useState(false)
  /**
   * 전체 접기·펼치기 — **목록 전체를 다루는 동작**이라 `↻ 다시 생성` 과 같은 줄에 둔다.
   * 예전엔 필터 바 안에 `ml-auto` 로 있었는데, 뒤에 카테고리 칩이 더 붙어 줄바꿈되면
   * 목록 한가운데 놓였다.
   *
   * `collapseSignal` 은 카드에 "지금 다시 맞춰라" 를 알리는 카운터다 — 카드가 각자
   * 펼침 상태를 들고 있어서(메모 입력 중 상태 보존) 값 하나로는 못 덮는다.
   */
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const toggleAll = () => {
    setAllCollapsed((v) => !v)
    setCollapseSignal((n) => n + 1)
  }
  // 공고 요건 접힘 — 정리 안 했으면 펼쳐서 CTA 가 바로 보이게
  const [jpExpanded, setJpExpanded] = useState(true)

  /**
   * 좌측 메타 사이드바 펼침 — **데스크탑에서도 접을 수 있다** (2026-08-06).
   *
   * 이전엔 접기 버튼이 `md:hidden` 이라 모바일 전용이었고, 데스크탑에선 280px 이
   * 항상 자리를 차지했다. 공고 요건처럼 내용이 있는 카드가 들어오면서 좁아졌고,
   * 질문을 읽을 땐 사이드바가 필요 없는 순간이 많다.
   *
   * 저장된 선택이 있으면 그걸 따르고, 없을 때만 화면 폭으로 정한다
   * (모바일 기본 접힘 — 사이드바가 질문을 아래로 밀어낸다).
   */
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
      if (saved !== null) return saved === '1'
    } catch {
      /* 접근 불가(프라이빗 모드 등) → 기본 펼침 */
    }
    return true
  })
  const toggleSidebar = () =>
    setSidebarExpanded((prev) => {
      const next = !prev
      saveCollapseExpanded(SIDEBAR_EXPANDED_KEY, next)
      return next
    })

  const handleDelete = () => {
    const ok = window.confirm(
      `🗑️ 면접 세션 "${session?.round ?? ''}" 을 정말 삭제하시겠어요?\n\n생성된 질문과 메모가 모두 삭제됩니다 (회사 조사 캐시는 보존).\n복구할 수 없습니다.`,
    )
    if (!ok) return
    deleteSession(sessionId, {
      onSuccess: () => {
        toast.show('세션을 삭제했어요.')
        /*
          🔴 **온 자리로 돌려보낸다.** 예전엔 카드 상세(`/board/:id`)로 보냈는데,
          이 페이지는 면접 준비 모아보기에서 들어온다. 세션 하나를 지웠다고 카드
          상세로 튕기면 "내가 왜 여기 있지" 가 되고, 다른 세션을 지우려면 다시
          모아보기로 돌아와야 한다.
        */
        navigate('/interviews')
      },
      onError: () => toast.error('삭제에 실패했어요.'),
    })
  }

  const handleGenerate = async (isRegenerate = false) => {
    if (isRegenerate) {
      const remaining = quota
        ? `오늘 ${quota.dayLimit - quota.dayUsed}/${quota.dayLimit}회 · 이번 달 ${quota.monthLimit - quota.monthUsed}/${quota.monthLimit}회`
        : ''
      const ok = window.confirm(
        `기존 질문과 메모가 모두 삭제되고 새로 생성됩니다.\nAI 호출 1회가 차감됩니다.${remaining ? `\n잔여: ${remaining}` : ''}\n\n진행하시겠어요?`,
      )
      if (!ok) return
    }
    if (!(await ensureAiConsent())) return
    if (!(await ensureJobTitle())) return
    try {
      // 🔴 파괴적 의사표시를 서버에 그대로 넘긴다 — 확인창을 통과한 경로만 true
      const result = await generateSession(isRegenerate)
      if (result.status === 'ok') {
        // v2 — 세션 생성은 **질문만** 만든다. 꼬리질문 개수는 항상 0 이라 안 쓴다
        toast.show(
          `질문 ${result.meta?.mainCount ?? 0}개 생성 — 답변은 각 질문에서 만들 수 있어요`,
        )
      } else if (result.code === 'REGENERATE_REQUIRED') {
        /*
          🔴 **서버가 화면을 정정한 상황이다.** 화면은 "질문이 없다" 고 믿고 최초 생성을
          보냈는데, 서버가 세어 보니 있었다 — 조회가 실패했다는 뜻이다. 이때 필요한 건
          "실패했어요" 가 아니라 **답변이 무사하다는 사실**과 새로고침이다.
          여기서 재생성을 권하면 이 가드를 만든 이유가 없어진다.
        */
        /*
          🔴 사용자에게 새로고침을 시킬 이유가 없다 — **서버가 방금 「있다」고 알려줬으니**
          그대로 다시 가져오면 화면이 스스로 회복한다. 저위험 동작은 확인 없이 실행한다는
          AI UX 원칙과도 같은 결이다.
        */
        qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
        qc.invalidateQueries({ queryKey: sessionKey(sessionId) })
        toast.error(
          '이미 만들어 둔 질문이 있어요 — 작성한 답변은 그대로 있어요. 다시 불러올게요.',
        )
      } else {
        toast.error(result.reason ?? '생성에 실패했어요.')
      }
    } catch (err) {
      // 인터셉터가 이미 토스트를 띄웠거나(400 서버 메시지) 직무 모달을 열었으면
      // 여기서 또 띄우지 않는다 — 고정 문구가 진짜 이유를 덮는다
      const shown = (err as { config?: { _toastShown?: boolean } })?.config
        ?._toastShown
      if (shown) return
      const message =
        err instanceof Error ? err.message : 'AI 호출 중 오류가 발생했어요.'
      toast.error(message)
    }
  }

  if (sessionLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse" />
      </div>
    )
  }

  /**
   * 🔴 **로딩과 실패를 갈라야 한다** (2026-08-09).
   *
   * 예전엔 `if (sessionLoading || !session)` 한 줄이 둘 다 삼켰다. 조회가 **실패하면**
   * `isLoading=false` · `data=undefined` 가 되는데, 그러면 이 조건이 다시 참이라
   * **로딩이 끝났는데도 로딩 화면**으로 돌아간다. 상태가 더 안 바뀌니 영원히 그대로다.
   *
   * 삭제된 세션 링크(404) · 남의 세션(403) · 네트워크 끊김 · 배포 중 500 에서 걸리고,
   * 화면엔 빠져나갈 길이 없어 새로고침만 반복하게 된다. `main.tsx` 가 기본
   * `new QueryClient()` 라 **재시도 3회**를 이미 쓴 뒤다 — 더 기다려도 안 바뀐다.
   */
  if (!session) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="border border-line bg-surface-2 rounded-xl px-5 py-10 text-center">
          <p className="text-text-primary text-sm font-semibold mb-1.5">
            면접 준비를 불러오지 못했어요
          </p>
          <p className="text-text-tertiary text-xs leading-relaxed mb-5">
            {sessionError
              ? '삭제됐거나 접근할 수 없는 세션일 수 있어요.'
              : '잠시 후 다시 시도해 주세요.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-medium text-text-secondary border border-line hover:border-line-strong px-4 py-3 rounded-lg transition-colors"
            >
              다시 시도
            </button>
            {/* 막다른 길을 만들지 않는다 — 어디로든 나갈 문이 화면에 있어야 한다 */}
            <button
              onClick={() => navigate('/interviews')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
            >
              면접 준비 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalMain = questions.length
  const totalFollowup = questions.reduce(
    (n, q) => n + q.children.length + q.children.reduce((m, c) => m + c.children.length, 0),
    0,
  )

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <>
        {/* 헤더 — breadcrumb + 차수 */}
        <header className="mb-5 space-y-2">
          <div className="text-xs text-text-tertiary">
            <Link to="/interviews" className="hover:text-text-primary transition-colors">
              ← 면접 목록
            </Link>
            <span className="text-text-quaternary mx-2">·</span>
            <span>{app?.companyName ?? '...'}</span>
            <span className="text-text-quaternary mx-2">·</span>
            <span>{session.round}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-text-primary text-2xl font-bold">
              {session.round}
            </h1>
            {session.interviewType && (
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INTERVIEW_TYPE_STYLE[session.interviewType]}`}
              >
                {INTERVIEW_TYPE_LABEL[session.interviewType]}
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="ml-auto text-xs text-text-tertiary hover:text-brand border border-line hover:border-brand/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
            >
              ✎ 세션 자료
            </button>
            <button
              onClick={() => setReadMode((v) => !v)}
              aria-pressed={readMode}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                readMode
                  ? 'bg-brand text-text-primary border-brand'
                  : 'text-text-tertiary hover:text-brand border-line hover:border-brand/40 bg-surface-2'
              }`}
              title={
                readMode
                  ? '편집 화면으로 돌아가요'
                  : '면접 직전에 훑어보기 좋게 — 코인 쓰는 버튼을 감추고 꼬리질문까지 펼쳐요'
              }
            >
              {readMode ? '✎ 편집 모드' : '📖 읽기 모드'}
            </button>
            {/* 읽기 중에 삭제가 보일 이유가 없다 — 오탭이 가장 비싼 버튼이다 */}
            {!readMode && (
              <button
                onClick={handleDelete}
                className="text-xs text-text-tertiary hover:text-danger border border-line hover:border-danger/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
                title="세션 삭제 (질문·답변 모두 삭제, 회사 조사 캐시는 보존)"
              >
                🗑️ 삭제
              </button>
            )}
            {/*
              🔴 **접혀 있을 때만** 노출한다 — 펼쳐져 있으면 사이드바 안의 `←` 가 닫기를
              맡는다. 같은 일을 하는 버튼이 둘 다 보이면 어느 쪽이 무엇인지 흐려진다.
              접히면 사이드바가 통째로 사라지므로 여는 수단은 여기밖에 없다.
            */}
            {!sidebarExpanded && (
              <button
                onClick={toggleSidebar}
                aria-expanded={false}
                aria-label="자료 사이드바 펼치기"
                className="hidden md:inline-block text-xs text-text-tertiary hover:text-text-primary border border-line rounded-md px-2.5 py-1.5"
              >
                📋 자료 보기
              </button>
            )}
          </div>
        </header>

        {/* 접으면 열이 사라져 질문 목록이 전체 폭을 쓴다 */}
        <div
          className={`grid grid-cols-1 gap-5 ${sidebarExpanded ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-1'}`}
        >
          {/* 좌측: 메타 사이드바 — 그룹화 (Linear 패턴) + 시각 위계 */}
          {/* 🔴 모바일에는 사이드바가 없다 (`hidden md:block`) — 세로로 쌓이면 카드 8개가
              질문 위를 덮어 한참 스크롤해야 질문이 나온다. 모바일에서 자료는
              `세션 자료` 모달이 전담하고, 그래서 그 모달은 사이드바의 **상위집합**이다. */}
          <aside
            className={`hidden ${sidebarExpanded ? 'md:block' : 'md:hidden'} space-y-5`}
          >
            {/*
              접기 손잡이 — 사이드바 맨 위, 본문 경계 쪽(오른쪽 정렬)에 둔다.
              화살표가 가리키는 방향 = 사이드바가 밀려갈 방향이라 무슨 일이 일어날지
              눌러보지 않아도 읽힌다 (Notion·Linear·VSCode 패턴).
              여는 쪽은 헤더의 `📋 자료 보기` 가 맡는다 (접히면 이 버튼이 사라지므로).
            */}
            <button
              onClick={toggleSidebar}
              aria-expanded={true}
              aria-label="자료 사이드바 접기"
              className="w-full min-h-8 flex items-center justify-end gap-1 px-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
              접기
            </button>

            {/* ─── 그룹 1: 회사 (primary) ─── */}
            <section className="space-y-2.5">
              <h2 className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-1">
                회사
              </h2>

              <MetaCard title="회사·직무">
                <p className="text-text-primary text-base font-semibold">
                  {app?.companyName ?? '...'}
                </p>
                {/*
                  🔴 예전엔 `jobCategory` 만 보여줬다 — 프롬프트는 `jobTitle` 을 우선하므로
                  화면에 "금융" 이 뜨는데 질문은 개발로 나가는 어긋남이 있었다.
                  `JobTitleField` 가 같은 규칙(`resolveJobText`)으로 표시하고, 그 자리에서
                  고칠 수도 있다 — 질문의 기준값을 세션 안에서 확인·수정하게 한다.
                */}
                <div className="mt-2 pt-2 border-t border-line">
                  <JobTitleField applicationId={applicationId} />
                </div>
              </MetaCard>

              {/* 회사 조사 + 내가 알아본 정보 (primary 카드 — bg-brand/5) */}
              <CompanyResearchCard
                sessionId={sessionId}
                userNotes={session.userResearchNotes}
              />

              {/*
                v2 — 공고 요건. 세션 안에서도 확인하고, 안 해뒀으면 여기서 바로 정리한다.
                `app.jobPosting` 단일 소스라 카드 상세·자소서와 같은 내용을 본다
                (여기서 정리하면 그쪽에도 바로 반영된다).
                직무 fork 질문의 1순위 근거라 회사 조사 바로 아래 둔다.
              */}
              <JobPostingBanner
                variant="section"
                applicationId={applicationId}
                jobPosting={app?.jobPosting}
                jobPostingStatus={app?.jobPostingStatus}
                readOnly={false}
                expanded={jpExpanded}
                onToggle={() => setJpExpanded((v) => !v)}
              />
            </section>

            {/* ─── 그룹 2: 내 자료 (secondary) ─── */}
            <section className="space-y-2.5">
              <h2 className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-1">
                내 자료
              </h2>

              <CollapsibleMetaCard
                title={`📄 자소서 문항 · ${session.coverletterIds.length}개`}
                defaultOpen={false}
              >
                {session.coverletterIds.length === 0 ? (
                  <p className="text-text-faint text-xs">선택된 자소서 없음</p>
                ) : !refs ? (
                  <div className="space-y-1.5">
                    {session.coverletterIds.slice(0, 3).map((id) => (
                      <div
                        key={id}
                        className="h-3 bg-surface-3 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {refs.coverletters.map((cl) => (
                      <li key={cl.id} className="text-xs leading-relaxed">
                        {cl.category && (
                          <span className="inline-block text-[10px] font-medium bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded mb-1">
                            {cl.category}
                          </span>
                        )}
                        <p className="text-text-secondary line-clamp-2">
                          {cl.question}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleMetaCard>

              <CollapsibleMetaCard
                title={`📂 활동 로그 · ${session.extraLogIds.length}개`}
                defaultOpen={false}
              >
                {session.extraLogIds.length === 0 ? (
                  <p className="text-text-faint text-xs">선택된 로그 없음</p>
                ) : !refs ? (
                  <div className="space-y-1.5">
                    {session.extraLogIds.slice(0, 3).map((id) => (
                      <div
                        key={id}
                        className="h-3 bg-surface-3 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {refs.logs.map((log) => (
                      <li
                        key={log.id}
                        className="text-xs leading-relaxed border-l-2 border-line pl-2"
                      >
                        <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-text-faint text-[10px] font-mono">
                            {log.occurredAt.slice(5).replace('-', '/')}
                          </span>
                          {/* 활동명은 사용자가 직접 쓴 텍스트라 길 수 있다 —
                              min-w-0 없이는 truncate 가 죽어 320px 에서 가로로 넘친다 */}
                          <span className="min-w-0 text-text-tertiary text-[10px] font-medium truncate">
                            {log.activityName}
                          </span>
                          {log.cat && (
                            <span className="inline-block text-[10px] font-medium bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded">
                              {log.cat}
                            </span>
                          )}
                        </div>
                        <p className="text-text-secondary line-clamp-2">
                          {log.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleMetaCard>

              <CollapsibleMetaCard title="🎯 AI 강화 자료" defaultOpen={false}>
                {!session.jobDescription && !session.emphasisPoints ? (
                  <p className="text-text-tertiary text-xs leading-relaxed">
                    모집 요강·강조 포인트를 추가하면 더 정확한 질문이 나와요.
                    <br />
                    상단 <strong>"✎ 세션 편집"</strong> 을 눌러 입력하세요.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {session.jobDescription && (
                      <div>
                        <p className="text-text-tertiary text-[11px] mb-1 font-semibold">
                          모집 요강
                        </p>
                        <p className="text-text-secondary text-xs line-clamp-3 leading-relaxed">
                          {session.jobDescription}
                        </p>
                      </div>
                    )}
                    {session.emphasisPoints && (
                      <div>
                        <p className="text-text-tertiary text-[11px] mb-1 font-semibold">
                          강조 포인트
                        </p>
                        <p className="text-text-secondary text-xs line-clamp-3 leading-relaxed">
                          {session.emphasisPoints}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleMetaCard>
            </section>

            {/* ─── 그룹 3: 진행 (minimal) ─── */}
            <section>
              <div className="border-t border-line pt-3 px-1 flex items-center justify-between text-xs">
                <span className="text-text-quaternary font-medium uppercase tracking-wider text-[10px]">
                  진행
                </span>
                <div className="flex items-center gap-3 text-text-tertiary">
                  <span>
                    메인{' '}
                    <span className="text-text-primary font-mono font-semibold">
                      {totalMain}
                    </span>
                  </span>
                  <span className="text-text-faint">·</span>
                  <span>
                    꼬리{' '}
                    <span className="text-text-primary font-mono font-semibold">
                      {totalFollowup}
                    </span>
                  </span>
                </div>
              </div>
            </section>
          </aside>

          {/* 우측: 질문 트리 */}
          <main>
            {questionsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-surface-2 border border-line rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : questionsError ? (
              /*
                🔴 **실패를 빈 상태로 보여주면 데이터가 날아간다** (2026-08-09).

                훅이 `data = []` 로 떨어져서, 질문 20개짜리 세션이 조회 한 번 실패했다고
                **"아직 질문이 없어요" + [✨ AI 질문 생성]** 으로 보였다. 그리고 그 버튼은
                `handleGenerate(false)` — **재생성이 아니라 최초 생성으로 취급**되므로
                `기존 질문과 메모가 모두 삭제됩니다` 확인창도 **안 뜬다.**
                서버는 `interview-prep-ai.service.ts:726` 에서
                `em.delete(InterviewPrepQuestion, { sessionId })` 로 전부 지우고 새로 만든다.

                즉 **한 번의 조회 실패 → 한 번의 클릭 → 사용자가 쓴 답변 전량 소실 + 코인 차감.**
                에러를 빈 상태로 착각시키는 건 그냥 못 보는 것보다 나쁘다.
              */
              <div className="border border-line bg-surface-2 rounded-xl px-6 py-10 text-center">
                <p className="text-text-primary text-sm font-semibold mb-1.5">
                  질문을 불러오지 못했어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                  질문이 없는 게 아니라 <b className="font-semibold">불러오기가 실패</b>한 거예요.
                  <br />
                  새로 만들지 말고 다시 시도해 주세요.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : session?.generationStatus === 'failed' &&
              questions.length === 0 ? (
              /*
                생성이 도중에 끊긴 상태 (서버 예외·재시작). 결과가 없으므로 다시 눌러야
                하는데, 빈 화면만 두면 "왜 아무것도 없지" 가 된다. 상태를 말해 준다.
                코인은 `status='ok'` 에서만 차감되므로 실패분은 안 나갔다.
              */
              <div className="border border-dashed border-warning/40 bg-warning/5 rounded-xl px-6 py-10 text-center">
                <p className="text-warning text-sm font-medium mb-1.5">
                  질문 생성이 중간에 멈췄어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed mb-4">
                  코인은 차감되지 않았어요. 다시 시도해 주세요.
                </p>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating || quotaBlocked}
                  className="min-h-8 text-xs font-medium text-text-primary bg-brand hover:bg-brand-hover px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  다시 시도
                </button>
              </div>
            ) : generating && questions.length === 0 ? (
              /*
                🔴 **스피너를 스켈레톤으로** — DESIGN.md 는 로딩에 스켈레톤을 쓴다.
                같은 화면의 답변 생성(InterviewQuestionCard)은 이미 스켈레톤인데 여기만
                스피너라 자기모순이었다. 스피너는 "돌고 있다" 만 말하지만, 질문 모양
                스켈레톤은 **무엇이 몇 개 올지**를 보여준다 — 10초를 기다리는 근거가 된다.
              */
              <div className="space-y-3">
                <div className="border border-dashed border-brand/40 bg-brand/5 rounded-xl px-5 py-4 text-center">
                  <p className="text-text-secondary text-sm font-medium mb-1">
                    🤖 AI 면접관이 질문을 만들고 있어요
                  </p>
                  <p className="text-text-quaternary text-xs leading-relaxed">
                    자소서·활동·회사 조사를 꼼꼼히 읽고 있어요. 1~2분쯤 걸려요.
                  </p>
                </div>
                {/* 곧 들어올 질문 카드의 자리 — 번호·태그·본문 두 줄 구조를 그대로 흉내낸다 */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="border border-line bg-surface-2 rounded-xl p-4 space-y-2 animate-pulse"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-6 bg-surface-3 rounded" />
                      <div className="h-3 w-16 bg-surface-3 rounded-full" />
                    </div>
                    <div className="h-3.5 w-full bg-surface-3 rounded" />
                    <div className="h-3.5 w-4/5 bg-surface-3 rounded" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="border border-dashed border-line bg-surface-2/30 rounded-xl px-6 py-12 text-center">
                <div className="text-2xl mb-2">✨</div>
                <p className="text-text-secondary text-sm mb-2">
                  아직 질문이 없어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                  선택한 자소서·모집 요강·강조 포인트·로그를 바탕으로
                  <br />
                  AI 가 예상 질문 + 모범 답안을 만들어줘요.
                </p>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating || quotaBlocked}
                  className="bg-brand hover:bg-brand-hover text-text-primary text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
                  title={quotaReason ?? undefined}
                >
                  ✨ AI 질문 생성 (메인 20개)
                </button>
                <div className="mt-3 flex justify-center">
                  <AiQuotaChip feature="interview_prep_session" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-text-tertiary text-xs">
                      메인 {totalMain}개 · 꼬리 {totalFollowup}개
                    </p>
                    <AiQuotaChip feature="interview_prep_session" />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/*
                      🔴 **좁은 화면에선 감춘다** (2026-08-09). 모바일 목록은 이제 한 줄
                      요약이라 접을 게 없다 — 눌러도 아무 일이 안 일어나는 **거짓 어포던스**가
                      된다. 카드가 실제로 펼쳐지는 건 넓은 화면뿐이다.
                    */}
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="hidden sm:inline-flex text-xs text-text-tertiary hover:text-text-primary transition-colors items-center gap-1"
                    >
                      <CollapsibleChevron open={!allCollapsed} />
                      {allCollapsed ? '전체 펼치기' : '전체 닫기'}
                    </button>
                    {/* 읽기 모드엔 코인 쓰는 버튼을 두지 않는다 */}
                    {!readMode && (
                      <button
                        onClick={() => handleGenerate(true)}
                        disabled={generating || quotaBlocked}
                        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary text-xs disabled:opacity-50"
                        title={quotaReason ?? '기존 질문 모두 삭제 + AI 1회 차감'}
                      >
                        {/* 버튼 로딩은 하우스 패턴대로 **텍스트 변경**만 (스피너 없음) */}
                        <span>
                          {generating ? '다시 만들고 있어요…' : '↻ 다시 생성'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                <CategoryFilterAndList
                  questions={questions}
                  sessionId={sessionId}
                  applicationId={applicationId}
                  readOnly={readMode}
                  allCollapsed={allCollapsed}
                  collapseSignal={collapseSignal}
                />
              </>
            )}
          </main>
        </div>
      </>

      {editing && (
        <EditInterviewSessionModal
          session={session}
          questionCount={totalMain}
          isSaving={updatingSession}
          onClose={() => setEditing(false)}
          onSave={(dto, refs) => {
            updateSession(
              { ...dto, ...refs },
              {
                onSuccess: () => {
                  setEditing(false)
                  toast.show(
                    '저장됐어요. "↻ 다시 생성" 을 누르면 새 자료 기반 질문이 만들어져요.',
                  )
                },
                onError: () => toast.error('저장에 실패했습니다.'),
              },
            )
          }}
        />
      )}
    </div>
  )
}

function MetaCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-line bg-surface-2 rounded-lg p-3.5">
      <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider mb-2.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

/** Notion 식 collapsible 카드 — chevron 좌측 + 부드러운 토글 */
function CollapsibleMetaCard({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-line bg-surface-2 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? `${title} 접기` : `${title} 펼치기`}
        className="w-full flex items-center gap-2 px-3.5 py-3 hover:bg-surface-3 transition-colors"
      >
        <CollapsibleChevron open={open} />
        <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider text-left">
          {title}
        </h3>
      </button>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}

/**
 * F1 v2 Phase 5b — 카테고리 chip filter + 그룹/평면 보기 toggle.
 * main 20개 + 카테고리 18종 → 사용자가 카테고리 누르면 해당만, '전체' = 모두.
 */
function CategoryFilterAndList({
  questions,
  sessionId,
  applicationId,
  readOnly = false,
  allCollapsed,
  collapseSignal,
}: {
  questions: InterviewPrepQuestion[]
  sessionId: string
  applicationId: string
  /** 읽기 모드 — 카드까지 그대로 내려간다 (꼬리질문 포함) */
  readOnly?: boolean
  /** 전체 접기·펼치기 — 버튼은 부모(다시 생성 옆)에 있고 상태만 내려온다 */
  allCollapsed: boolean
  collapseSignal: number
}) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  /**
   * 우선 질문만 보기 — 실제 면접에서 받는 질문이 5개 안팎이라 20개를 다 준비하는 건
   * 현실과 맞지 않다. "먼저 할 것" 만 추려 보는 창구다.
   */
  const [onlyMust, setOnlyMust] = useState(false)
  const mustCount = useMemo(
    () => questions.filter((q) => q.mustPrepare).length,
    [questions],
  )
  /**
   * 전체 접기·펼치기 — 메인은 기본 펼침이라 20문항이면 화면이 매우 길어진다.
   * 목록을 훑을 땐 접고, 준비할 문항을 정하면 그것만 펼치는 흐름이다.
   *
   * `collapseSignal` 은 **카드에 "지금 다시 맞춰라" 를 알리는 카운터**다. 카드가 각자
   * 펼침 상태를 들고 있어서(메모 입력 중 유실 방지), 부모가 통째로 소유하지 않고
   * 신호만 보낸다. 카드는 신호가 바뀐 렌더에서만 자기 상태를 재설정한다.
   */

  // 카테고리별 카운트 (UI chip badge)
  const catCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questions) {
      const c = q.category ?? '(미분류)'
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return map
  }, [questions])

  /**
   * 🔴 **면접 진행 순서로 정렬하고, 그 순서로 번호를 매긴다.**
   *
   * 번호는 **필터보다 먼저** 확정한다 — 필터를 걸 때마다 번호가 1부터 다시 매겨지면
   * "3번 질문" 이 화면마다 달라져서 기억할 수가 없다. 전체 기준 번호를 들고 다닌다.
   *
   * 우선순위로 정렬하지 않는 이유는 `CATEGORY_FLOW_ORDER` 주석 참고 — 자기소개가
   * 1번이어야 리허설이 된다.
   */
  const numbered = useMemo(() => {
    return [...questions]
      .sort(
        (a, b) =>
          (CATEGORY_FLOW_ORDER[a.category ?? ''] ?? CATEGORY_FLOW_FALLBACK) -
            (CATEGORY_FLOW_ORDER[b.category ?? ''] ?? CATEGORY_FLOW_FALLBACK) ||
          a.orderIndex - b.orderIndex,
      )
      .map((q, i) => ({ q, no: i + 1 }))
  }, [questions])

  const filtered = useMemo(() => {
    let list = numbered
    if (onlyMust) list = list.filter(({ q }) => q.mustPrepare)
    if (selectedCat === '(미분류)') list = list.filter(({ q }) => !q.category)
    else if (selectedCat)
      list = list.filter(({ q }) => q.category === selectedCat)
    return list
  }, [numbered, selectedCat, onlyMust])

  const totalCats = catCounts.size

  /**
   * 🔴 **모바일은 「목록 ↔ 집중」 두 화면으로 나눈다** (2026-08-09 CEO).
   *
   * 390px 에서 카드를 세로로 쌓으면 문항 하나가 화면을 넘긴다. 그래서 평소엔
   * **한 줄 요약**으로 20문항을 한 화면에 담고, 준비할 문항을 누르면 그것만 전체 화면으로 연다.
   * 넓은 화면은 원래대로 카드 목록이다 — 폭이 있어서 나눌 이유가 없다.
   *
   * 꼬리질문은 **순서에 넣지 않고 그 문항 아래에 그대로 둔다** (기본 접힘).
   * 순서에 넣으면 재귀 구조를 평탄한 배열로 바꿔야 하는데, 그러면 "이 꼬리가 누구의 꼬리인지"
   * 를 라벨로만 설명하게 된다. 아래 두는 편이 관계가 눈에 보인다.
   */
  const narrow = useMediaQuery('(max-width: 639px)')
  const [focusIdx, setFocusIdx] = useState<number | null>(null)

  // 필터를 바꾸면 인덱스가 다른 문항을 가리킨다 — 목록으로 되돌린다
  const [seenLen, setSeenLen] = useState(filtered.length)
  if (seenLen !== filtered.length) {
    setSeenLen(filtered.length)
    setFocusIdx(null)
  }

  const focused = focusIdx !== null ? filtered[focusIdx] : undefined

  /**
   * 🔴 **문항을 넘기면 맨 위로 올린다** (2026-08-09). 「다음 질문」 버튼은 카드 **하단**에 있어
   * 누르는 순간 스크롤이 페이지 아래쪽이다. 카드가 remount 돼도 스크롤은 그대로라
   * **다음 질문의 첫 줄이 아니라 중간부터** 보인다 — 꼬리질문이 있으면 확실히 어긋난다.
   * 20문항을 넘기는 동안 매번 겪는 자리라 자동으로 맞춘다.
   */
  useEffect(() => {
    if (focusIdx === null) return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [focusIdx])

  if (narrow && focused) {
    const answered = filtered.filter(({ q }) => (q.myMemo ?? '').trim()).length
    return (
      <div className="space-y-3">
        {/* 상단 — 어디쯤인지와 나갈 문 */}
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setFocusIdx(null)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] -ml-1 inline-flex items-center gap-1 pl-1 pr-3 text-xs font-medium text-text-secondary"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              목록
            </button>
            <span className="text-[13px] font-mono font-semibold tabular-nums">
              {focusIdx! + 1}
              <span className="text-text-quaternary"> / {filtered.length}</span>
            </span>
            <span className="text-[11px] text-text-quaternary">· 답변 {answered}개</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${((focusIdx! + 1) / filtered.length) * 100}%` }}
            />
          </div>
        </div>

        {/*
          카드를 그대로 쓴다 — 꼬리질문·AI 답변·자동저장이 전부 이미 여기 있다.
          `key` 를 문항 id 로 두는 이유: 문항을 넘기면 카드가 새로 마운트돼
          **가림 상태가 다시 걸린다.** 그게 연습이다.
        */}
        <InterviewQuestionCard
          key={focused.q.id}
          question={focused.q}
          questionNo={focused.no}
          sessionId={sessionId}
          applicationId={applicationId}
          readOnly={readOnly}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFocusIdx((i) => Math.max(0, (i ?? 0) - 1))}
            disabled={focusIdx === 0}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] flex-1 text-[13px] font-medium text-text-secondary border border-line rounded-lg py-3 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={() =>
              setFocusIdx((i) => Math.min(filtered.length - 1, (i ?? 0) + 1))
            }
            disabled={focusIdx === filtered.length - 1}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] flex-[2] text-[13px] font-semibold rounded-lg py-3 bg-brand text-bg disabled:opacity-35 disabled:cursor-not-allowed"
          >
            다음 질문 →
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-3">
      {totalCats > 0 && (
        /*
          🔴 **모바일은 가로 스크롤 한 줄** (2026-08-09 CEO).

          실측: 세션에 흔한 칩 12개가 390px 에서 **4줄 · 약 122px** 를 먹었다 — 질문이
          나오기 전에 화면 1/6 이다. PC(1028px)에선 한 줄에 들어가 문제가 안 보였다.
          **같은 요소가 폭에 따라 성격이 달라진 경우**다.

          칩을 없애지 않고 눕힌다 — 모바일에서 카테고리 필터를 쓰는지 **관측한 적이 없어서**
          (실사용자 3명 전원 PC) 기능을 지우는 결정은 근거가 없다. 안 쓰는 게 확인되면
          그때 빼면 된다. `전체`·`우선` 은 맨 앞이라 스크롤 없이 잡힌다.
        */
        <div className="relative">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCat(null)}
            className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors ${
              selectedCat === null
                ? 'bg-brand text-text-primary border-brand'
                : 'bg-card hover:bg-card-strong border-line text-text-secondary hover:text-text-primary'
            }`}
          >
            전체 ({questions.length})
          </button>
          {/*
            우선 필터 — 다른 칩(카테고리)과 축이 달라서 색을 accent 로 구분한다.
            옛 세션은 mustPrepare 가 전부 false 라 0개면 아예 안 띄운다.
          */}
          {mustCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyMust((v) => !v)}
              aria-pressed={onlyMust}
              title="이 면접에서 나올 확률이 높은 질문만 봅니다"
              className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                onlyMust
                  ? 'bg-accent text-white border-accent'
                  : 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/15'
              }`}
            >
              <Star size={10} strokeWidth={2.5} aria-hidden="true" />
              우선 ({mustCount})
            </button>
          )}
          {/*
            🔴 **전체 접기·펼치기는 여기 없다** (2026-08-07). `ml-auto` 로 우측에 밀었는데
            **뒤에 카테고리 칩이 더 붙어서**, 줄바꿈되면 목록 한가운데 놓였다.
            필터 바는 필터만 두고, 목록 전체를 다루는 동작은 `↻ 다시 생성` 옆으로 올렸다.
          */}
          {Array.from(catCounts.entries()).map(([cat, count]) => {
            const isActive = selectedCat === cat
            const label = CATEGORY_LABEL[cat] ?? cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(isActive ? null : cat)}
                /*
                  비활성 칩도 **카드의 태그와 같은 색**을 쓴다. 여기만 회색이면
                  "필터의 파랑" 과 "카드의 파랑" 이 따로 놀아 색이 묶음 역할을 못 한다.
                  활성은 대비를 위해 채도를 올린다.
                */
                className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-brand text-text-primary border-brand font-medium'
                    : `${CATEGORY_STYLE[cat] ?? CATEGORY_STYLE_FALLBACK} hover:brightness-110`
                }`}
              >
                {label} ({count})
              </button>
            )
          })}
          </div>
          {/*
            우측 페이드 — **더 있다는 신호.** 없으면 스크롤 되는 줄 모르고, 오른쪽 칩은
            존재 자체가 안 알려진다. 넓은 화면은 줄바꿈이라 필요 없다.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent sm:hidden"
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="text-text-quaternary text-xs text-center py-4">
          이 카테고리에 질문이 없어요.
        </p>
      ) : narrow ? (
        /*
          🔴 **모바일 목록은 한 줄이다.** 카드를 그대로 쌓으면 문항 하나가 화면을 넘겨서
          "어디까지 했나" 를 보려면 한참 스크롤해야 했다. 여기서 필요한 정보는 세 개뿐이다 —
          **몇 번인지 · 답을 썼는지 · 꼬리가 몇 개인지.** 나머지는 눌러서 본다.
        */
        <ul className="space-y-1.5">
          {filtered.map(({ q, no }, i) => {
            const done = (q.myMemo ?? '').trim().length > 0
            const kids =
              q.children.length +
              q.children.reduce((m, c) => m + c.children.length, 0)
            /* 🔴 분모가 손자(재꼬리)까지 세므로 분자도 같은 범위로 — 안 맞추면 재꼬리에 답해도 안 오른다 */
            const kidsDone =
              q.children.filter((c) => (c.myMemo ?? '').trim()).length +
              q.children.reduce(
                (m, c) =>
                  m + c.children.filter((g) => (g.myMemo ?? '').trim()).length,
                0,
              )
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setFocusIdx(i)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[52px] text-left border border-line-strong bg-card-solid shadow-sm rounded-lg px-3 py-3 flex items-start gap-2.5 active:bg-card-hover transition-colors"
                >
                  <span className="shrink-0 w-5 mt-0.5 text-text-tertiary text-[11px] font-mono font-semibold tabular-nums">
                    {no}.
                  </span>
                  {/* 작성 여부를 색 점 하나로 — 목록을 훑는 눈이 제일 먼저 잡는 신호다 */}
                  <span
                    aria-hidden="true"
                    className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${done ? 'bg-brand' : 'bg-surface-3'}`}
                  />
                  <span
                    /*
                      🔴 **2줄까지 보여준다** (2026-08-09). 1줄(약 13자)로는 질문이 구분되지
                      않았다 — 실측상 질문 56개의 **최소 길이가 44자**이고 「커넥션 풀을…」
                      「커넥션 획득…」처럼 앞머리가 겹치는 게 흔하다. 목록의 일은
                      **어느 질문인지 알아보는 것**인데 그게 안 되면 결국 하나씩 열어보게 된다.
                      모든 질문이 26자를 넘으므로 행 높이는 **전부 2줄로 균일**하다.
                    */
                    className={`flex-1 min-w-0 line-clamp-2 text-[14px] font-medium leading-snug ${
                      done ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {q.questionText}
                  </span>
                  {q.mustPrepare && (
                    <Star
                      size={12}
                      strokeWidth={2.5}
                      aria-label="우선 준비"
                      className="shrink-0 mt-0.5 text-accent fill-accent"
                    />
                  )}
                  {/*
                    🔴 **320px 에선 「꼬리」 두 글자를 뗀다.** 이 표시가 58px 를 먹는데,
                    320px 행에서 질문에 남는 폭이 178 → 120px 로 줄어 2줄 합쳐 16자밖에 안 된다.
                    목록의 일은 **어느 질문인지 아는 것**이라 그쪽이 우선이다 —
                    분자/분모 숫자만 남겨도 무엇을 세는지는 위치와 아이콘으로 읽힌다.
                  */}
                  {kids > 0 && (
                    <span
                      className="shrink-0 mt-0.5 text-[11px] text-text-quaternary tabular-nums"
                      title={`꼬리질문 ${kids}개 중 ${kidsDone}개 작성`}
                    >
                      <span className="max-[359px]:hidden">꼬리 </span>
                      {kidsDone}/{kids}
                    </span>
                  )}
                  <span className="sr-only">{done ? '답변 작성함' : '미작성'}</span>
                  <CollapsibleChevron open={false} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ q, no }) => (
            <InterviewQuestionCard
              key={q.id}
              question={q}
              questionNo={no}
              sessionId={sessionId}
              applicationId={applicationId}
              collapseSignal={collapseSignal}
              collapseAll={allCollapsed}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  )
}
