import { useMemo, useState } from 'react'
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
import { Spinner } from '@/components/common/Spinner'
import { useApplication } from '@/hooks/useApplications'
import {
  useDeleteInterviewSession,
  useGenerateInterviewSession,
  useInterviewPrepQuestions,
  useInterviewPrepRefs,
  useInterviewPrepSession,
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
  const { data: session, isLoading: sessionLoading } = useInterviewPrepSession(
    sessionId,
  )
  const applicationId = session?.applicationId ?? ''
  const { data: app } = useApplication(applicationId)
  // 사전 게이트 — 누르기 전에 직무를 받는다 (누른 뒤 실패로 알게 되지 않도록)
  const ensureJobTitle = useRequireJobTitle(applicationId)
  const { data: questions = [], isLoading: questionsLoading } =
    useInterviewPrepQuestions(sessionId)
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
  const ensureAiConsent = useRequireAiConsent()
  // 생성 중 새로고침 = 코인만 차감되고 질문은 유실 (면접에만 이 가드가 없었다)
  useUnloadGuard(generating)
  const { mutate: updateSession, isPending: updatingSession } =
    useUpdateInterviewPrepSession(sessionId, applicationId)
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)
  const [editing, setEditing] = useState(false)
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
        navigate(applicationId ? `/board/${applicationId}` : '/interviews')
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
      const result = await generateSession()
      if (result.status === 'ok') {
        // v2 — 세션 생성은 **질문만** 만든다. 꼬리질문 개수는 항상 0 이라 안 쓴다
        toast.show(
          `질문 ${result.meta?.mainCount ?? 0}개 생성 — 답변은 각 질문에서 만들 수 있어요`,
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

  if (sessionLoading || !session) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse" />
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
              onClick={handleDelete}
              className="text-xs text-text-tertiary hover:text-danger border border-line hover:border-danger/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
              title="세션 삭제 (질문·메모 모두 삭제, 회사 조사 캐시는 보존)"
            >
              🗑️ 삭제
            </button>
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
              <div className="border border-dashed border-brand/40 bg-brand/5 rounded-xl px-6 py-12 text-center">
                <Spinner size={40} className="mx-auto text-brand mb-4" />
                <p className="text-text-secondary text-sm mb-2 font-medium">
                  🤖 AI 면접관이 질문을 만들고 있어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed">
                  자소서·활동·회사 조사를 꼼꼼히 읽고 있어요. 1~2분쯤 걸려요.
                  <br />
                  잠시만 기다려 주세요
                  <span className="inline-flex ml-0.5">
                    <span className="animate-pulse [animation-delay:0ms]">.</span>
                    <span className="animate-pulse [animation-delay:200ms]">.</span>
                    <span className="animate-pulse [animation-delay:400ms]">.</span>
                  </span>
                </p>
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
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating || quotaBlocked}
                    className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary text-xs disabled:opacity-50"
                    title={quotaReason ?? '기존 질문 모두 삭제 + AI 1회 차감'}
                  >
                    {generating ? (
                      <>
                        <Spinner size={12} />
                        <span>다시 만들고 있어요...</span>
                      </>
                    ) : (
                      <span>↻ 다시 생성</span>
                    )}
                  </button>
                </div>
                <CategoryFilterAndList
                  questions={questions}
                  sessionId={sessionId}
                  applicationId={applicationId}
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
}: {
  questions: InterviewPrepQuestion[]
  sessionId: string
  applicationId: string
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
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const toggleAll = () => {
    setAllCollapsed((v) => !v)
    setCollapseSignal((n) => n + 1)
  }

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

  return (
    <div className="space-y-3">
      {totalCats > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCat(null)}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
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
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                onlyMust
                  ? 'bg-accent text-white border-accent'
                  : 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/15'
              }`}
            >
              <Star size={10} strokeWidth={2.5} aria-hidden="true" />
              우선 ({mustCount})
            </button>
          )}
          {/* 전체 접기·펼치기 — 필터 칩과 축이 달라 우측 끝으로 민다 */}
          <button
            type="button"
            onClick={toggleAll}
            className="ml-auto text-[11px] px-2 py-1 rounded-full border border-line bg-card hover:bg-card-strong text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center gap-1"
          >
            <CollapsibleChevron open={!allCollapsed} />
            {allCollapsed ? '전체 펼치기' : '전체 닫기'}
          </button>
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
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
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
      )}
      {filtered.length === 0 ? (
        <p className="text-text-quaternary text-xs text-center py-4">
          이 카테고리에 질문이 없어요.
        </p>
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
