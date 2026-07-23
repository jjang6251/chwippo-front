import { useCallback, useEffect, useRef, useState } from 'react'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useCoverletterReadOnly } from '@/hooks/useCoverletterReadOnly'
import { useNavigate, useParams } from 'react-router-dom'
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
import type { UpdateCoverletterDto } from '@/types/coverletter'

/**
 * F1 자소서 풀페이지 (회사 단위) — `/board/:applicationId/coverletter`.
 *
 * Phase A — 베이스 / Phase B — 회사 조사 banner (자동 fetch)
 * Phase C — N문항 카드 + sticky nav (다음)
 * Phase D — AI 채팅 (다음)
 */
export function CoverletterDocPage() {
  const aiEnabled = useAiEnabled()
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
        <h1 className="text-text-primary text-[22px] lg:text-[26px] font-bold leading-tight">
          {app.companyName} <span className="text-brand italic">자소서</span>
        </h1>
        {(app.jobTitle || app.jobCategory) && (
          <p className="text-text-tertiary text-xs">
            {[app.jobCategory, app.jobTitle].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      {readOnly && (
        <div className="bg-card border border-line rounded-lg px-3 py-2 text-xs text-text-tertiary mb-5">
          📱 모바일에서는 보기 전용이에요 — 작성·수정은 PC에서 진행해 주세요.
        </div>
      )}

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
