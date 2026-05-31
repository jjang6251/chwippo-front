import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompanyResearchCard } from '@/components/card/CompanyResearchCard'
import { EditInterviewSessionModal } from '@/components/card/EditInterviewSessionModal'
import { InterviewQuestionCard } from '@/components/card/InterviewQuestionCard'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
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
import { toast } from '@/stores/toastStore'
import {
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'

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
  const { data: questions = [], isLoading: questionsLoading } =
    useInterviewPrepQuestions(sessionId)
  const { data: refs } = useInterviewPrepRefs(sessionId)
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked('interview_prep_session')
  const quota = useMyAiQuota('interview_prep_session')
  const { mutate: generate, isPending: generating } =
    useGenerateInterviewSession(sessionId)
  const ensureAiConsent = useRequireAiConsent()
  const { mutate: updateSession, isPending: updatingSession } =
    useUpdateInterviewPrepSession(sessionId, applicationId)
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)
  const [editing, setEditing] = useState(false)
  const [metaCollapsed, setMetaCollapsed] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 920,
  )

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
    generate(undefined, {
      onSuccess: (result) => {
        if (result.status === 'ok') {
          toast.show(
            `${result.meta?.mainCount ?? 0}개 메인 + 꼬리 ${result.meta?.followupCount ?? 0}개 생성`,
          )
        } else {
          toast.error(result.reason ?? '생성에 실패했어요.')
        }
      },
      onError: () => toast.error('AI 호출 중 오류가 발생했어요.'),
    })
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
              ✎ 세션 편집
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-text-tertiary hover:text-danger border border-line hover:border-danger/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
              title="세션 삭제 (질문·메모 모두 삭제, 회사 조사 캐시는 보존)"
            >
              🗑️ 삭제
            </button>
            <button
              onClick={() => setMetaCollapsed(!metaCollapsed)}
              aria-expanded={!metaCollapsed}
              aria-label={metaCollapsed ? '메타 정보 펼치기' : '메타 정보 접기'}
              className="md:hidden text-xs text-text-tertiary hover:text-text-primary border border-line rounded-md px-2.5 py-1.5"
            >
              {metaCollapsed ? '📋 정보' : '📋 접기'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
          {/* 좌측: 메타 사이드바 — 그룹화 (Linear 패턴) + 시각 위계 */}
          <aside
            className={`${metaCollapsed ? 'hidden md:block' : 'block'} space-y-5`}
          >
            {/* ─── 그룹 1: 회사 (primary) ─── */}
            <section className="space-y-2.5">
              <h2 className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-1">
                회사
              </h2>

              <MetaCard title="회사·직무">
                <p className="text-text-primary text-base font-semibold">
                  {app?.companyName ?? '...'}
                </p>
                {app?.jobCategory && (
                  <p className="text-text-tertiary text-sm mt-1">
                    {app.jobCategory}
                  </p>
                )}
              </MetaCard>

              {/* 회사 조사 + 내가 알아본 정보 (primary 카드 — bg-brand/5) */}
              <CompanyResearchCard
                sessionId={sessionId}
                userNotes={session.userResearchNotes}
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
                          <span className="text-text-tertiary text-[10px] font-medium truncate">
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
                  className="bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
                  title={quotaReason ?? undefined}
                >
                  {generating ? '✨ 질문 생성중... (10-20초 소요)' : '✨ AI 질문 생성'}
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
                    className="text-text-tertiary hover:text-text-primary text-xs disabled:opacity-50"
                    title={quotaReason ?? '기존 질문 모두 삭제 + AI 1회 차감'}
                  >
                    {generating ? '✨ 재생성중... (10-20초)' : '↻ 다시 생성'}
                  </button>
                </div>
                <div className="space-y-3">
                  {questions.map((q) => (
                    <InterviewQuestionCard
                      key={q.id}
                      question={q}
                      sessionId={sessionId}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </>

      {editing && (
        <EditInterviewSessionModal
          session={session}
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
