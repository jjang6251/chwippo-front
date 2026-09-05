import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'
import { useCoverletterAiBlocked } from '@/hooks/useCoverletterAiBlocked'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { JobTitleField } from '@/components/common/JobTitleField'
import { CoverletterChatPanel } from '@/components/coverletter/CoverletterChatPanel'
import { CoverletterQuestionCard } from '@/components/coverletter/CoverletterQuestionCard'
import { CompanyResearchBanner } from '@/components/coverletter/CompanyResearchBanner'
import {
  loadCollapseExpanded, saveCollapseExpanded, loadExpandedIds, saveExpandedIds,
  JOB_POSTING_EXPANDED_STORAGE_KEY, COMPANY_RESEARCH_EXPANDED_STORAGE_KEY,
  coverletterExpandedKey,
} from '@/utils/collapsePref'
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
import { GoToInterviewButton } from '@/components/card/GoToInterviewButton'
import type { UpdateCoverletterDto } from '@/types/coverletter'
import { DesktopOnlyNotice } from '@/components/coverletter/DesktopOnlyNotice'

/**
 * F1 자소서 풀페이지 (회사 단위) — `/board/:applicationId/coverletter`.
 *
 * Phase A — 베이스 / Phase B — 회사 조사 banner (자동 fetch)
 * Phase C — N문항 카드 + sticky nav (다음)
 * Phase D — AI 채팅 (다음)
 */
export function CoverletterDocPage() {
  const aiEnabled = useAiEnabled()
  const interviewAiEnabled = useInterviewAiEnabled()
  /**
   * 🔴 **AI 만 막는다 — 이 게이트가 IAP 방어선이다 (완화 금지).**
   * 모바일·RN 에서 문항·답변 편집은 열려 있고(2026-08-23 CEO), 코인을 쓰는 진입점만
   * 닫힌다: 채팅 패널·FAB·바텀시트·카드의 「AI 에게 묻기」·「자소서 검사」·공고 파싱.
   */
  const aiBlocked = useCoverletterAiBlocked()
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
  /**
   * 펼침 상태 — **사용자가 건드리기 전까지는 파생값**이다 (`null` = 아직 안 건드림).
   * effect 로 초기값을 세팅하면 `react-hooks/set-state-in-effect` 에 걸리고,
   * 실제로도 렌더 한 번을 낭비한다. 저장값·기본값 모두 렌더 시점에 계산 가능하다.
   */
  const [userExpanded, setUserExpanded] = useState<Set<string> | null>(null)
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
  /**
   * 🔴 예전엔 무조건 첫 카드를 펼쳤다. 사용자가 접어도 새로고침·재진입하면 **매번 다시
   * 펼쳐졌다** (2026-08-23 CEO 실사용 지적). 자동 펼침의 목적은 **처음 온 사람을 돕는 것**
   * 이지 매번 강제하는 게 아니다 — 명시적으로 접었으면 그 판단이 이긴다.
   *
   * 「기록 없음(`null`)」과 「전부 접음(`[]`)」을 가르는 게 핵심이다. **전자만** 자동 펼침.
   * 저장은 **지원 카드별** — 회사마다 자소서가 다르다.
   */
  const savedExpanded = useMemo(
    () => (applicationId ? loadExpandedIds(coverletterExpandedKey(applicationId)) : null),
    [applicationId],
  )
  const expandedClIds = useMemo<Set<string>>(() => {
    if (userExpanded) return userExpanded
    if (savedExpanded) {
      // 지워진 문항 id 가 남아 있어도 무해하지만, 목록에 없는 건 걸러 둔다
      const live = new Set(cls.map((c) => c.id))
      return new Set(savedExpanded.filter((id) => live.has(id)))
    }
    return cls.length > 0 ? new Set([cls[0].id]) : new Set<string>()
  }, [userExpanded, savedExpanded, cls])

  // 문항 점프 칩 — 해당 카드로 스크롤 + 플래시 (flash 메커니즘 재사용)
  const handleJump = useCallback((clId: string) => {
    document
      .getElementById(`cl-${clId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlashClId(clId)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashClId(null), 1200)
  }, [])

  /**
   * 저장은 **여기 한 곳에서만** 한다 — 펼침을 바꾸는 곳이 셋(토글·삭제·AI 적용)이라
   * 각각에 붙이면 언젠가 하나를 빠뜨린다. 상태가 바뀌면 무조건 따라 저장한다.
   * 🔴 복원(`firstExpandRef`) 전에는 저장하지 않는다 — 빈 초기값이 저장을 덮어쓴다.
   */
  useEffect(() => {
    if (!userExpanded || !applicationId) return
    saveExpandedIds(coverletterExpandedKey(applicationId), [...userExpanded])
  }, [userExpanded, applicationId])

  const handleToggle = useCallback(
    (clId: string) => {
      const next = new Set<string>(expandedClIds)
      if (next.has(clId)) next.delete(clId)
      else next.add(clId)
      setUserExpanded(next)
    },
    [expandedClIds],
  )

  /**
   * 🔴 **문항 딥링크** — `/board/:id/coverletter#cl-<clId>`.
   *
   * 확장(지원 폼)이 「치뽀에서 작성하고 돌아오면 채워드려요」로 **이 문항 하나**를 가리키며
   * 보낸다. 도착해서 접혀 있으면 링크가 아무 일도 안 한 것처럼 보이므로, 저장된 펼침
   * 상태(localStorage)와 **무관하게 강제로 편다**. 목록에 없는 id 는 조용히 무시한다.
   *
   * 해시가 바뀌면 다시 동작한다 (같은 페이지 안에서 다른 문항으로 건너뛰는 경우).
   * `handledHashRef` 가 같은 해시의 반복 실행만 막는다 — 사용자가 편 카드를 도로 접었는데
   * 렌더 한 번에 다시 펴지면 그게 더 이상하다.
   */
  const location = useLocation()
  const hashClId = location.hash.startsWith('#cl-') ? location.hash.slice('#cl-'.length) : null
  const handledHashRef = useRef<string | null>(null)
  useEffect(() => {
    if (!hashClId) {
      handledHashRef.current = null
      return
    }
    if (handledHashRef.current === hashClId) return
    if (!cls.some((c) => c.id === hashClId)) return // 아직 안 불러왔거나 지워진 문항
    handledHashRef.current = hashClId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL(외부 입력) 반영. 렌더 중엔 알 수 없다
    setUserExpanded(new Set<string>([...expandedClIds, hashClId]))
    requestAnimationFrame(() => handleJump(hashClId))
  }, [hashClId, cls, expandedClIds, handleJump])

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
          const next = new Set<string>(expandedClIds)
          next.delete(clId)
          setUserExpanded(next)
        },
      })
    },
    [removeCl, expandedClIds],
  )

  // suggestedUpdate 적용 — ChatPanel 안 CoverletterDiffModal 이 사용자 명시 확인 후 호출.
  // 부모는 단순 update mutation + 카드 펴기 (race confirm 은 diff modal 이 시각적 대체).
  const handleApplyUpdate = useCallback(
    (update: { clId: string; newAnswer: string }) => {
      const cl = cls.find((c) => c.id === update.clId)
      if (!cl) return
      updateCl({ clId: update.clId, dto: { answer: update.newAnswer } })
      const nextExpanded = new Set<string>(expandedClIds)
      nextExpanded.add(update.clId)
      setUserExpanded(nextExpanded)
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
    [cls, updateCl, expandedClIds],
  )

  // 회사 조사: cache 우선 → null 이면 자동 fetch (1회만)
  const {
    data: research,
    isLoading: researchLoading,
  } = useCompanyResearchCache(applicationId ?? '', !!applicationId)

  /* 배너 접힘도 기억한다 — 카드 상세의 공고 요건은 이미 기억하는데 여기만 안 해서
     같은 배너가 화면마다 다르게 동작했다 (2026-08-23). 키를 공유해 선호가 따라다닌다. */
  const [bannerExpanded, setBannerExpanded] = useState(() =>
    loadCollapseExpanded(COMPANY_RESEARCH_EXPANDED_STORAGE_KEY),
  )
  const [jpExpanded, setJpExpanded] = useState(() =>
    loadCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY),
  )
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
              navigateOnly={aiBlocked}
            />
          )}
        </div>
        {/*
          🔴 직무를 **여기서 고칠 수 있어야 한다** (2026-08-06).
          자소서 AI(초안·점검·대화)가 전부 이 직무를 기준으로 쓴다. 예전엔 표시만
          있어서, 비었거나 잘못 적힌 걸 발견해도 카드 상세로 돌아가야 했다.
          표시 규칙도 `resolveJobText` 로 통일 — 프롬프트가 보는 값과 같은 걸 보여준다.
        */}
        {!aiBlocked && applicationId && (
          <div className="max-w-md">
            <JobTitleField applicationId={applicationId} />
          </div>
        )}
        {aiBlocked && (app.jobTitle || app.jobCategory) && (
          <p className="text-text-tertiary text-xs">
            {app.jobTitle ?? app.jobCategory}
          </p>
        )}
      </header>

      {aiBlocked && <DesktopOnlyNotice className="mb-5" />}

      {/* Phase B — 회사 조사 banner.
        * PR UI: default collapse (outdated 우선 표시 — 사용자 인지 부하 ↓).
        *   사용자가 클릭하면 펼침 가능 (강제 collapse 가 아닌 default 만).
        */}
      <CompanyResearchBanner
        research={research}
        loading={researchLoading}
        expanded={bannerExpanded}
        onToggle={() =>
          setBannerExpanded((v) => {
            saveCollapseExpanded(COMPANY_RESEARCH_EXPANDED_STORAGE_KEY, !v)
            return !v
          })
        }
      />

      {/* 공고 요건 배너 — 회사 조사 아래. app.jobPosting (상세 whitelist) 사용 */}
      <JobPostingBanner
        applicationId={applicationId ?? ''}
        jobPosting={app.jobPosting}
        jobPostingStatus={app.jobPostingStatus}
        /* 공고 파싱은 AI 호출이다 — 모바일·RN 에선 계속 닫는다 */
        readOnly={aiBlocked}
        expanded={jpExpanded}
        onToggle={() =>
          setJpExpanded((v) => {
            saveCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY, !v)
            return !v
          })
        }
      />

      {/* write-shell: 2-pane (Phase D 에서 채움) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-[18px] lg:gap-[22px]">
        <div className="space-y-3">
          {cls.length === 0 ? (
            /*
              모바일 전용 「PC에서 추가하세요」 분기를 없앤다 (2026-08-23) — 이제 여기서
              바로 추가·작성할 수 있으므로 그 안내는 거짓이고, 시작점 없이 빈 화면만 남는다.
              달라지는 건 **설명 문구뿐** — AI 도움은 여전히 PC 전용이라 그렇게 약속하지 않는다.
            */
            <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center">
              <div className="text-2xl mb-2">📝</div>
              <p className="text-text-secondary text-sm font-medium mb-1">
                자소서 문항을 추가해 시작하세요
              </p>
              <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                {/* AI·PC 안내는 위 배너가 이미 한다 — 여기서 되풀이하지 않는다 */}
                {aiBlocked
                  ? '문항을 추가하고 바로 작성할 수 있어요.'
                  : '문항을 추가하면 AI 가 활동일지·회사 정보를 활용해 답변 작성을 도와줍니다.'}
              </p>
              <button
                onClick={() => createCl({ question: '' })}
                disabled={creating}
                className="px-4 py-2 text-xs font-medium text-bg bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
              >
                + 첫 문항 추가하기
              </button>
            </div>
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
                        className="text-[11px] font-mono px-2.5 min-h-[32px] rounded-md transition-colors inline-flex items-center gap-1.5 bg-surface-2 border border-line text-text-secondary hover:border-brand/40 hover:text-text-primary"
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
                  /*
                    🔴 **`readOnly` 가 아니라 `simpleEdit`** (2026-08-23 CEO — 모바일 편집 개방).
                    `simpleEdit` 이 감추는 것과 여기서 감춰야 할 것이 정확히 같다:
                    유형 · 글자수 제한 · 삭제 · 답변 가져오기 · AI 에게 묻기 · 자소서 검사.
                    문항 편집만 예외라 `allowQuestionEdit` 로 따로 연다.
                    데스크탑(aiBlocked=false)은 `simpleEdit=false` 라 기존 동작 그대로다.
                  */
                  simpleEdit={aiBlocked}
                  allowQuestionEdit
                  flash={flashClId === cl.id}
                  containerRef={(el) => {
                    if (el) cardRefs.current.set(cl.id, el)
                    else cardRefs.current.delete(cl.id)
                  }}
                />
              ))}
              {/* 추가는 모바일에서도 연다 — 문항을 쓸 수 있는데 만들 수 없으면 막다른 길이다 */}
              <button
                onClick={() => createCl({ question: '' })}
                disabled={creating}
                className="w-full py-2.5 text-xs font-medium text-text-secondary border border-dashed border-line rounded-lg hover:border-brand/40 hover:text-text-primary transition-colors disabled:opacity-40"
              >
                + 문항 추가
              </button>
            </>
          )}
        </div>

        {/*
         * sticky top: header 52 + page outer pt-9 (36) = 88.
         * h: viewport - top(88) - 아래 여백(72) = calc(100vh - 160px). 약 vh 85%.
         */}
        <aside className="hidden lg:flex flex-col bg-card border border-line rounded-[14px] p-3.5 shadow-md self-start sticky top-[88px] h-[calc(100vh-160px)] overflow-hidden">
          {/* 🔴 AI 채팅 = 코인 소비 — IAP 방어선. `aiBlocked` 를 지우지 말 것 */}
          {aiEnabled && !aiBlocked && <CoverletterChatPanel
            applicationId={applicationId ?? ''}
            onApplyUpdate={handleApplyUpdate}
            prefill={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
          />}
        </aside>
      </div>

      {/* 🔴 모바일 FAB — 모바일·네이티브에선 AI 미노출 (IAP 방어선) */}
      {aiEnabled && !aiBlocked && (
        <button
          onClick={() => setMobileChatOpen(true)}
          className="lg:hidden fixed bottom-[100px] right-4 z-40 px-4 py-3 bg-brand text-bg text-sm font-semibold rounded-full shadow-lg hover:bg-accent active:scale-95 transition-all"
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
            {aiEnabled && !aiBlocked && <CoverletterChatPanel
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
