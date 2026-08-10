import { Mic } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'
import { useCoverletterReadOnly } from '@/hooks/useCoverletterReadOnly'
import { useNavigate, useParams } from 'react-router-dom'
import { JobTitleField } from '@/components/common/JobTitleField'
import { CoverletterChatPanel } from '@/components/coverletter/CoverletterChatPanel'
import { CoverletterQuestionCard } from '@/components/coverletter/CoverletterQuestionCard'
import { CompanyResearchBanner } from '@/components/coverletter/CompanyResearchBanner'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { useApplication } from '@/hooks/useApplications'
import { useAiFeedbackUnloadGuard } from '@/hooks/useAiFeedbackUnloadGuard'
import {
  useCoverletters,
  useCreateCoverletter,
  useRemoveCoverletter,
  useUpdateCoverletter,
} from '@/hooks/useApplicationCoverletters'
import {
  useCompanyResearchCache,
} from '@/hooks/useCoverletterDoc'
import { Modal } from '@/components/common/Modal'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import { useInterviewPrepSessions } from '@/hooks/useInterviewPrep'
import {
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'
import type { UpdateCoverletterDto } from '@/types/coverletter'
import { DesktopOnlyNotice } from '@/components/coverletter/DesktopOnlyNotice'

/**
 * F1 자소서 풀페이지 (회사 단위) — `/board/:applicationId/coverletter`.
 *
 * Phase A — 베이스 / Phase B — 회사 조사 banner (자동 fetch)
 * Phase C — N문항 카드 + sticky nav (다음)
 * Phase D — AI 채팅 (다음)
 */
/**
 * 자소서 → 면접 건너가기.
 *
 * 🔴 **방향이 비대칭이다.** 면접 → 자소서는 1:1(세션은 한 회사에 속한다)이지만,
 * 자소서 → 면접은 **1:N** 이다 — 1차·2차·임원면접이 따로 있을 수 있다.
 *
 *   0개 → 만들기 모달 (버튼 문구도 **「만들기」**로 바뀐다 — 「준비하기」면 기존 게 있는 줄 안다)
 *   1개 → 바로 이동 (고를 게 없는데 물을 이유가 없다)
 *   N개 → 선택 목록 + 🔴 **「새로 만들기」** (목록만 두면 3차가 잡혔을 때 만들 길이 없다)
 */
/**
 * 자소서 → 면접 건너가기.
 *
 * `navigateOnly` 는 **이미 있는 세션으로 이동만** 한다 (모바일). 세션 생성은 AI 질문
 * 생성으로 이어져 코인이 드는 동작이라, 자소서 화면이 보기 전용인 곳에서는 만들지 않는다.
 * 만들 세션이 하나도 없으면 아예 렌더하지 않는다 — 눌러도 갈 곳이 없는 버튼은 두지 않는다.
 */
export function GoToInterviewButton({
  applicationId,
  navigateOnly = false,
}: {
  applicationId: string
  navigateOnly?: boolean
}) {
  const navigate = useNavigate()
  /*
    🔴 **로딩 중을 「없음」으로 읽으면 안 된다** (2026-08-10 점검).
    조회 전엔 `[]` 이므로 세션이 있어도 「새로 만들기」가 열리고, 거기서 만들면
    **AI 질문 생성으로 코인이 나간다.** 라벨도 「만들기 ↔ 준비하기」로 깜빡였다.
    실패도 마찬가지 — 모르는 상태에서 중복을 만들 바엔 버튼을 잠근다.
  */
  const {
    data: sessions = [],
    isLoading: sessLoading,
    isError: sessError,
  } = useInterviewPrepSessions(applicationId)
  const sessUnknown = sessLoading || sessError
  const [picking, setPicking] = useState(false)
  const [creating, setCreating] = useState(false)

  const go = () => {
    if (sessUnknown) return // 몇 개인지 모르는 채로 만들지 않는다
    if (sessions.length === 0) {
      if (navigateOnly) return
      return setCreating(true)
    }
    if (sessions.length === 1) return navigate(`/interviews/${sessions[0].id}`)
    setPicking(true)
  }

  // 이동만 가능한데 갈 곳이 없으면 버튼 자체를 두지 않는다
  if (navigateOnly && (sessUnknown || sessions.length === 0)) return null

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={sessUnknown}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg shrink-0 min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 disabled:opacity-50 disabled:cursor-default px-3 py-2.5 rounded-lg transition-colors"
        title={sessError ? '면접 준비 목록을 불러오지 못했어요' : '이 자소서를 바탕으로 면접 예상 질문을 준비해요'}
      >
        <Mic size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        {navigateOnly || sessUnknown || sessions.length > 0
          ? '면접 준비하기'
          : '면접 준비 만들기'}
      </button>

      {picking && (
        <Modal open onClose={() => setPicking(false)} title="어느 면접을 준비할까요?">
          <div className="space-y-1.5">
            {sessions.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => navigate(`/interviews/${sess.id}`)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[44px] text-left border border-line bg-card hover:border-brand/40 rounded-lg px-3.5 py-3 flex items-center gap-2.5 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text-primary truncate">
                    {sess.round}
                  </span>
                  {/* 질문이 아직 없으면 그것도 정보다 — 어디를 골라야 할지 판단에 쓴다 */}
                  <span className="block text-[11px] text-text-quaternary mt-0.5">
                    {sess.generationStatus === 'completed'
                      ? '질문 준비됨'
                      : '아직 질문 없음'}
                  </span>
                </span>
                {sess.interviewType && (
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${INTERVIEW_TYPE_STYLE[sess.interviewType]}`}
                  >
                    {INTERVIEW_TYPE_LABEL[sess.interviewType]}
                  </span>
                )}
              </button>
            ))}
            {/* 🔴 3차가 잡히면 여기서 만든다 — 목록만 두면 새로 만들 길이 없다 */}
            <button
              type="button"
              onClick={() => {
                setPicking(false)
                setCreating(true)
              }}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[44px] text-xs font-medium text-text-tertiary hover:text-text-secondary border border-dashed border-line hover:border-line-strong rounded-lg py-3 transition-colors"
            >
              + 새 면접 준비 만들기
            </button>
          </div>
        </Modal>
      )}

      {creating && (
        <NewInterviewSessionModal
          applicationId={applicationId}
          onClose={() => setCreating(false)}
          onCreated={(sessionId) => navigate(`/interviews/${sessionId}`)}
          /* 이미 자소서 화면이다 — 닫기만 하면 그 자리다 */
          onNeedCoverletter={() => setCreating(false)}
        />
      )}
    </>
  )
}

export function CoverletterDocPage() {
  const aiEnabled = useAiEnabled()
  const interviewAiEnabled = useInterviewAiEnabled()
  const readOnly = useCoverletterReadOnly()
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const { data: app, isLoading: appLoading } = useApplication(applicationId ?? '')
  const { data: cls = [], isLoading: clsLoading } = useCoverletters(
    applicationId ?? '',
    !!applicationId,
  )
  const { mutate: createCl, isPending: creating } = useCreateCoverletter(
    applicationId ?? '',
  )
  const { mutate: updateCl } = useUpdateCoverletter(applicationId ?? '')
  const { mutate: removeCl } = useRemoveCoverletter(applicationId ?? '')

  // A1 — AI 점검 진행 중 페이지 이탈 경고 (섹션은 모달 안이라 페이지 레벨 가드 필요)
  useAiFeedbackUnloadGuard()

  // 펼침 카드 set — 자유 다중 펴기. 첫 카드는 default 펼침
  const [expandedClIds, setExpandedClIds] = useState<Set<string>>(new Set())
  // AI 적용 시 해당 카드로 스크롤 + 플래시. ref 맵 (펼친 카드 루트 div)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [flashClId, setFlashClId] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    [],
  )
  // cls 첫 로드 시 첫 카드 자동 펼침
  const firstExpandRef = useRef(false)
  useEffect(() => {
    if (!firstExpandRef.current && cls.length > 0) {
      firstExpandRef.current = true
      setExpandedClIds(new Set([cls[0].id]))
    }
  }, [cls])

  // 문항 점프 칩 — 해당 카드로 스크롤 + 플래시 (flash 메커니즘 재사용)
  const handleJump = useCallback((clId: string) => {
    document
      .getElementById(`cl-${clId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlashClId(clId)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashClId(null), 1200)
  }, [])

  const handleToggle = useCallback((clId: string) => {
    setExpandedClIds((prev) => {
      const next = new Set(prev)
      if (next.has(clId)) next.delete(clId)
      else next.add(clId)
      return next
    })
  }, [])

  const handleUpdate = useCallback(
    (clId: string, dto: UpdateCoverletterDto) => {
      updateCl({ clId, dto })
    },
    [updateCl],
  )

  const handleDelete = useCallback(
    (clId: string) => {
      removeCl(clId, {
        onSuccess: () => {
          setExpandedClIds((prev) => {
            const next = new Set(prev)
            next.delete(clId)
            return next
          })
        },
      })
    },
    [removeCl],
  )

  // suggestedUpdate 적용 — ChatPanel 안 CoverletterDiffModal 이 사용자 명시 확인 후 호출.
  // 부모는 단순 update mutation + 카드 펴기 (race confirm 은 diff modal 이 시각적 대체).
  const handleApplyUpdate = useCallback(
    (update: { clId: string; newAnswer: string }) => {
      const cl = cls.find((c) => c.id === update.clId)
      if (!cl) return
      updateCl({ clId: update.clId, dto: { answer: update.newAnswer } })
      setExpandedClIds((prev) => {
        const next = new Set(prev)
        next.add(update.clId)
        return next
      })
      // 적용된 카드로 스크롤 + 플래시 (연속 적용이면 마지막 문항 기준 1회)
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => {
        cardRefs.current.get(update.clId)?.scrollIntoView({
          block: 'center',
          behavior: reduced ? 'auto' : 'smooth',
        })
      })
      setFlashClId(update.clId)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashClId(null), 1200)
    },
    [cls, updateCl],
  )

  // 회사 조사: cache 우선 → null 이면 자동 fetch (1회만)
  const {
    data: research,
    isLoading: researchLoading,
  } = useCompanyResearchCache(applicationId ?? '', !!applicationId)

  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [jpExpanded, setJpExpanded] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  // 카드의 "✨ AI 에게 묻기" prefill — nonce 로 매번 새 이벤트 처리
  const [chatPrefill, setChatPrefill] = useState<
    { clId: string; question: string; nonce: number } | null
  >(null)
  const handleAskAI = useCallback(
    (clId: string, question: string) => {
      setChatPrefill({ clId, question, nonce: Date.now() })
      // 모바일 = bottom sheet 자동 open
      setMobileChatOpen(true)
    },
    [],
  )

  void researchLoading

  if (appLoading || clsLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="h-4 w-32 bg-card rounded animate-pulse mb-4" />
        <div className="h-32 bg-card border border-line rounded-[14px] animate-pulse" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <p className="text-text-tertiary text-sm">회사를 찾을 수 없어요.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          ← 돌아가기
        </button>
      </div>
    )
  }

  // A1 — 전면 차단 게이트 제거: 조사 여부와 무관하게 문항 작성 가능.
  //   조사 미완이면 아래 본 UI 상단에 compact GenerateSection 카드로만 노출.


  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      {/* breadcrumb — PR UI: 진입 경로 보존 (모아보기 / 보드 카드 어디서 왔든 그 자리로) */}
      <header className="mb-5 space-y-2">
        <div className="text-xs text-text-tertiary">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="hover:text-text-primary transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="이전 페이지로 돌아가기"
          >
            ← {app.companyName}
          </button>
          <span className="text-text-quaternary mx-2">·</span>
          <span>자소서</span>
        </div>
        <div className="flex items-start gap-3">
          <h1 className="flex-1 min-w-0 text-text-primary text-[22px] lg:text-[26px] font-bold leading-tight break-words">
            {app.companyName} <span className="text-brand italic">자소서</span>
          </h1>
          {/*
            🔴 **자소서 → 면접.** 이 자소서가 면접 질문의 재료이므로 건너가는 길을 여기 둔다.
            면접 화면에는 반대 방향 링크가 이미 있어 **짝을 이룬다.**

            🔴 모바일에서도 둔다 (2026-08-10 CEO 지적). 전에는 읽기 전용이면 통째로 감췄는데,
            감출 이유였던 「세션 생성은 코인이 드는 동작」은 **생성**에만 해당한다. 이미 있는
            세션으로 **이동**하는 건 공짜다. 그래서 모바일은 `navigateOnly` 로 이동만 하고,
            만들 세션이 없으면 버튼이 아예 안 나온다 (생성은 데스크탑에서).

            🔴 flag 도 본다 — 사이드바·카드 상세는 보는데 여기만 빠져 있었다. 끄면 이 버튼만
            남아 **숨긴 기능으로 안내**한다.
          */}
          {interviewAiEnabled && applicationId && (
            <GoToInterviewButton
              applicationId={applicationId}
              navigateOnly={readOnly}
            />
          )}
        </div>
        {/*
          🔴 직무를 **여기서 고칠 수 있어야 한다** (2026-08-06).
          자소서 AI(초안·점검·대화)가 전부 이 직무를 기준으로 쓴다. 예전엔 표시만
          있어서, 비었거나 잘못 적힌 걸 발견해도 카드 상세로 돌아가야 했다.
          표시 규칙도 `resolveJobText` 로 통일 — 프롬프트가 보는 값과 같은 걸 보여준다.
        */}
        {!readOnly && applicationId && (
          <div className="max-w-md">
            <JobTitleField applicationId={applicationId} />
          </div>
        )}
        {readOnly && (app.jobTitle || app.jobCategory) && (
          <p className="text-text-tertiary text-xs">
            {app.jobTitle ?? app.jobCategory}
          </p>
        )}
      </header>

      {readOnly && <DesktopOnlyNotice className="mb-5" />}

      {/* Phase B — 회사 조사 banner.
        * PR UI: default collapse (outdated 우선 표시 — 사용자 인지 부하 ↓).
        *   사용자가 클릭하면 펼침 가능 (강제 collapse 가 아닌 default 만).
        */}
      <CompanyResearchBanner
        research={research}
        loading={researchLoading}
        expanded={bannerExpanded}
        onToggle={() => setBannerExpanded((v) => !v)}
      />

      {/* 공고 요건 배너 — 회사 조사 아래. app.jobPosting (상세 whitelist) 사용 */}
      <JobPostingBanner
        applicationId={applicationId ?? ''}
        jobPosting={app.jobPosting}
        jobPostingStatus={app.jobPostingStatus}
        readOnly={readOnly}
        expanded={jpExpanded}
        onToggle={() => setJpExpanded((v) => !v)}
      />

      {/* write-shell: 2-pane (Phase D 에서 채움) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-[18px] lg:gap-[22px]">
        <div className="space-y-3">
          {cls.length === 0 ? (
            readOnly ? (
              <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center">
                <div className="text-2xl mb-2">📝</div>
                <p className="text-text-secondary text-sm font-medium">
                  아직 작성된 문항이 없어요. PC에서 문항을 추가해 시작하세요.
                </p>
              </div>
            ) : (
            <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center">
              <div className="text-2xl mb-2">📝</div>
              <p className="text-text-secondary text-sm font-medium mb-1">
                자소서 문항을 추가해 시작하세요
              </p>
              <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                문항을 추가하면 AI 가 활동일지·회사 정보를 활용해 답변 작성을
                도와줍니다.
              </p>
              <button
                onClick={() => createCl({ question: '' })}
                disabled={creating}
                className="px-4 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
              >
                + 첫 문항 추가하기
              </button>
            </div>
            )
          ) : (
            <>
              {cls.length >= 2 && (
                <nav
                  aria-label="문항 바로가기"
                  className="flex flex-wrap gap-1.5 mb-4"
                >
                  {cls.map((cl, idx) => {
                    const unwritten = !(cl.answer ?? '').trim()
                    return (
                      <button
                        key={cl.id}
                        onClick={() => handleJump(cl.id)}
                        aria-label={
                          unwritten ? `Q${idx + 1} (미작성)` : `Q${idx + 1}`
                        }
                        className="text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1.5 bg-surface-2 border border-line text-text-secondary hover:border-brand/40 hover:text-text-primary"
                      >
                        Q{idx + 1}
                        {unwritten && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-warning"
                            aria-hidden
                          />
                        )}
                      </button>
                    )
                  })}
                </nav>
              )}
              {cls.map((cl, idx) => (
                <CoverletterQuestionCard
                  key={cl.id}
                  cl={cl}
                  number={idx + 1}
                  applicationId={applicationId ?? ''}
                  expanded={expandedClIds.has(cl.id)}
                  onToggle={() => handleToggle(cl.id)}
                  onUpdate={(dto) => handleUpdate(cl.id, dto)}
                  onDelete={() => handleDelete(cl.id)}
                  onAskAI={() => handleAskAI(cl.id, cl.question)}
                  readOnly={readOnly}
                  flash={flashClId === cl.id}
                  containerRef={(el) => {
                    if (el) cardRefs.current.set(cl.id, el)
                    else cardRefs.current.delete(cl.id)
                  }}
                />
              ))}
              {!readOnly && (
                <button
                  onClick={() => createCl({ question: '' })}
                  disabled={creating}
                  className="w-full py-2.5 text-xs font-medium text-text-secondary border border-dashed border-line rounded-lg hover:border-brand/40 hover:text-text-primary transition-colors disabled:opacity-40"
                >
                  + 문항 추가
                </button>
              )}
            </>
          )}
        </div>

        {/*
         * sticky top: header 52 + page outer pt-9 (36) = 88.
         * h: viewport - top(88) - 아래 여백(72) = calc(100vh - 160px). 약 vh 85%.
         */}
        <aside className="hidden lg:flex flex-col bg-card border border-line rounded-[14px] p-3.5 shadow-md self-start sticky top-[88px] h-[calc(100vh-160px)] overflow-hidden">
          {aiEnabled && !readOnly && <CoverletterChatPanel
            applicationId={applicationId ?? ''}
            onApplyUpdate={handleApplyUpdate}
            prefill={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
          />}
        </aside>
      </div>

      {/* 모바일 FAB — readOnly(모바일·네이티브)에선 AI 미노출 */}
      {aiEnabled && !readOnly && (
        <button
          onClick={() => setMobileChatOpen(true)}
          className="lg:hidden fixed bottom-[100px] right-4 z-40 px-4 py-3 bg-brand text-text-primary text-sm font-semibold rounded-full shadow-lg hover:bg-accent active:scale-95 transition-all"
          aria-label="AI 채팅 패널 열기"
        >
          ✨ AI
        </button>
      )}

      {/* 모바일 bottom sheet */}
      {mobileChatOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileChatOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-[80vh] bg-bg border-t border-line rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="AI 채팅 패널"
          >
            {aiEnabled && !readOnly && <CoverletterChatPanel
              applicationId={applicationId ?? ''}
              onApplyUpdate={(u) => {
                handleApplyUpdate(u)
                setMobileChatOpen(false)
              }}
              onCloseMobile={() => setMobileChatOpen(false)}
              prefill={chatPrefill}
              onPrefillConsumed={() => setChatPrefill(null)}
            />}
          </div>
        </div>
      )}

    </div>
  )
}
