import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CoverletterChatPanel } from '@/components/coverletter/CoverletterChatPanel'
import { CoverletterGenerateSection } from '@/components/coverletter/CoverletterGenerateSection'
import { CoverletterOutdatedBanner } from '@/components/coverletter/CoverletterOutdatedBanner'
import { CoverletterQuestionCard } from '@/components/coverletter/CoverletterQuestionCard'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useApplication } from '@/hooks/useApplications'
import {
  useCoverletters,
  useCreateCoverletter,
  useRemoveCoverletter,
  useUpdateCoverletter,
} from '@/hooks/useApplicationCoverletters'
import {
  useCompanyResearchCache,
  useFetchCompanyResearch,
} from '@/hooks/useCoverletterDoc'
import type { UpdateCoverletterDto } from '@/types/coverletter'
import type { CompanyResearchData } from '@/types/interviewPrep'

/**
 * F1 자소서 풀페이지 (회사 단위) — `/board/:applicationId/coverletter`.
 *
 * Phase A — 베이스 / Phase B — 회사 조사 banner (자동 fetch)
 * Phase C — N문항 카드 + sticky nav (다음)
 * Phase D — AI 채팅 (다음)
 */
export function CoverletterDocPage() {
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

  // 펼침 카드 set — 자유 다중 펴기. 첫 카드는 default 펼침
  const [expandedClIds, setExpandedClIds] = useState<Set<string>>(new Set())
  // cls 첫 로드 시 첫 카드 자동 펼침
  const firstExpandRef = useRef(false)
  useEffect(() => {
    if (!firstExpandRef.current && cls.length > 0) {
      firstExpandRef.current = true
      setExpandedClIds(new Set([cls[0].id]))
    }
  }, [cls])

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
    },
    [cls, updateCl],
  )

  // 회사 조사: cache 우선 → null 이면 자동 fetch (1회만)
  const {
    data: research,
    isLoading: researchLoading,
  } = useCompanyResearchCache(applicationId ?? '', !!applicationId)
  const {
    mutate: fetchResearch,
    isPending: fetchingResearch,
    isError: researchFetchError,
  } = useFetchCompanyResearch(applicationId ?? '')

  const autoFetchedRef = useRef(false)
  const [bannerExpanded, setBannerExpanded] = useState(false)
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

  // PR_B1c CTO 검토 M3 — silent 50 코인 차감 차단:
  //   기존엔 cache null 시 자동 fetchResearch() → 사용자 동의 없이 50 코인 차감.
  //   특히 legacy backfill (자소서 row 있어 status='completed' 됐지만 cache 없는 application)
  //   진입 시 매번 차감. 동의 modal 우회 = 정책 위반.
  //   → 자동 fetch 제거. cache 없으면 OutdatedBanner 가 명시 "다시 조사" 동의 modal 제공.
  void autoFetchedRef // 변수 보존 (cleanup 안 함 — 다른 곳 영향 없음)
  void fetchResearch
  void fetchingResearch
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

  // PR_B1c Phase F — 회사조사 안 됐으면 GenerateSection inline 표시 (자소서 chat 차단 안내)
  if (app.coverletterGenerationStatus !== 'completed') {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-4">
        <header className="mb-2 space-y-2">
          <div className="text-xs text-text-tertiary">
            <Link
              to={`/board/${applicationId}`}
              className="hover:text-text-primary transition-colors"
            >
              {app.companyName}
            </Link>
            <span className="mx-1.5">›</span>
            <span>자소서</span>
          </div>
          <h1 className="text-text-primary text-xl font-bold">
            {app.companyName} 자소서
          </h1>
        </header>
        <CoverletterGenerateSection application={app} />
      </div>
    )
  }

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

      {/* PR_B1c Phase G — 회사 정보 outdated 안내 */}
      <CoverletterOutdatedBanner application={app} />

      {/* Phase B — 회사 조사 banner.
        * PR UI: default collapse (outdated 우선 표시 — 사용자 인지 부하 ↓).
        *   사용자가 클릭하면 펼침 가능 (강제 collapse 가 아닌 default 만).
        */}
      <CompanyResearchBanner
        research={research}
        loading={researchLoading || fetchingResearch}
        error={researchFetchError}
        expanded={bannerExpanded}
        onToggle={() => setBannerExpanded((v) => !v)}
        onRetry={() => fetchResearch()}
      />

      {/* write-shell: 2-pane (Phase D 에서 채움) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] lg:gap-[22px]">
        <div className="space-y-3">
          {cls.length === 0 ? (
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
          ) : (
            <>
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
                />
              ))}
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
          <CoverletterChatPanel
            applicationId={applicationId ?? ''}
            onApplyUpdate={handleApplyUpdate}
            prefill={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
          />
        </aside>
      </div>

      {/* 모바일 FAB */}
      <button
        onClick={() => setMobileChatOpen(true)}
        className="lg:hidden fixed bottom-[100px] right-4 z-40 px-4 py-3 bg-brand text-text-primary text-sm font-semibold rounded-full shadow-lg hover:bg-accent active:scale-95 transition-all"
        aria-label="AI 채팅 패널 열기"
      >
        ✨ AI
      </button>

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
            <CoverletterChatPanel
              applicationId={applicationId ?? ''}
              onApplyUpdate={(u) => {
                handleApplyUpdate(u)
                setMobileChatOpen(false)
              }}
              onCloseMobile={() => setMobileChatOpen(false)}
              prefill={chatPrefill}
              onPrefillConsumed={() => setChatPrefill(null)}
            />
          </div>
        </div>
      )}

    </div>
  )
}

// ── 회사 조사 banner (접기 default, 8 항목 펼치기) ─────────
interface BannerProps {
  research:
    | { status: 'ok'; research?: CompanyResearchData; isCached?: boolean; cachedAt?: string }
    | { status: 'blocked' | 'opt_out'; reason?: string }
    | null
    | undefined
  loading: boolean
  error: boolean
  expanded: boolean
  onToggle: () => void
  onRetry: () => void
}

function CompanyResearchBanner({
  research,
  loading,
  error,
  expanded,
  onToggle,
  onRetry,
}: BannerProps) {
  if (loading) {
    return (
      <div className="bg-info/8 border border-info/20 rounded-lg p-3 mb-5 text-info text-xs">
        🔍 회사·직무 정보 조회 중…
      </div>
    )
  }

  if (error || (research && research.status === 'blocked')) {
    return (
      <div className="bg-warning/8 border border-warning/20 rounded-lg p-3 mb-5 flex items-center justify-between">
        <span className="text-warning text-xs">
          ⚠️ 회사 조사 실패{' '}
          {research && research.status === 'blocked' && research.reason
            ? `· ${research.reason}`
            : ''}
        </span>
        <button
          onClick={onRetry}
          className="text-[11px] text-text-tertiary hover:text-text-primary border border-line px-2 py-1 rounded transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (research && research.status === 'opt_out') {
    return (
      <div className="bg-card border border-line rounded-lg p-3 mb-5 text-text-tertiary text-xs">
        ℹ️ {research.reason ?? '이 회사는 정보 수집 동의를 철회했어요.'}
      </div>
    )
  }

  if (!research || research.status !== 'ok' || !research.research) {
    return null
  }

  const data = research.research
  const summary = data.businessSummary?.trim()
  const isEmpty =
    !summary && !data.recentTrends?.trim() &&
    (!data.interviewKeywords || data.interviewKeywords.length === 0)

  if (isEmpty) {
    return (
      <div className="bg-card border border-line rounded-lg p-3 mb-5 text-text-tertiary text-xs">
        🔍 회사 정보를 충분히 모으지 못했어요. 직접 입력해 활용하세요.
      </div>
    )
  }

  return (
    <div className="bg-card border border-line rounded-lg mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label="회사 조사 펼치기/접기"
        className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-card-strong transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-text-secondary text-xs font-medium shrink-0">
            🏢 회사·직무 조사
          </span>
          {!expanded && summary && (
            <span className="text-text-tertiary text-[11px] truncate">
              {summary}
            </span>
          )}
        </div>
        <CollapsibleChevron open={expanded} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          {summary && (
            <Section title="비즈니스 요약" content={summary} />
          )}
          {data.recentTrends?.trim() && (
            <Section title="최근 동향" content={data.recentTrends} />
          )}
          {data.coreValues?.trim() && (
            <Section title="핵심 가치" content={data.coreValues} />
          )}
          {data.visionMission?.trim() && (
            <Section title="비전·미션" content={data.visionMission} />
          )}
          {data.jobInsights?.trim() && (
            <Section title="직무 인사이트" content={data.jobInsights} />
          )}
          {data.interviewKeywords && data.interviewKeywords.length > 0 && (
            <ChipSection
              title="면접·자소서 키워드"
              chips={data.interviewKeywords.map((k) =>
                typeof k === 'string' ? k : k.keyword,
              )}
            />
          )}
          {research.cachedAt && (
            <p className="text-text-quaternary text-[10px] pt-1">
              · 캐시 {new Date(research.cachedAt).toLocaleDateString('ko-KR')}{' '}
              {research.isCached === false ? '(방금 조사됨)' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-1">
        {title}
      </div>
      <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    </div>
  )
}

function ChipSection({ title, chips }: { title: string; chips: string[] }) {
  return (
    <div>
      <div className="text-[10px] text-text-quaternary font-semibold uppercase tracking-wider mb-1">
        {title}
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c, i) => (
          <span
            key={i}
            className="text-[11px] text-info bg-info/10 border border-info/20 px-1.5 py-0.5 rounded"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
