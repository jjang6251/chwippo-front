import { useEffect, useState } from 'react'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import {
  useCompanyResearch,
  useTriggerCompanyResearch,
  useUpdateUserResearchNotes,
} from '@/hooks/useInterviewPrep'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { toast } from '@/stores/toastStore'

interface Props {
  sessionId: string
  /** session 의 userResearchNotes (read 용) */
  userNotes: string | null
}

/**
 * F6 PR 2 Phase 4 단계 B+UX — 회사 조사 메타카드.
 *
 * **레퍼런스 패턴 적용**:
 * - **Notion + LinkedIn 하이브리드 collapsible** — 카드 전체 토글 (chevron 좌측)
 *   default 펼침 시 핵심 3 (사업·인재상·최근동향) + "더 보기" 로 나머지 5 + 출처 별도 토글
 * - **Perplexity 식 출처 chip** — favicon + 도메인 (full URL X, 클릭 시 새 탭)
 * - **primary 위계** — bg-brand/5 + border-brand/20 (회사 정보 = 가장 중요)
 *
 * **법적·UX 안전장치**:
 * - 상단 ⚠️ 빨간 alert "AI 가 잘못된 정보 안내 가능"
 * - 출처 명시 + 클릭 시 원본 이동 (transformative use 강화)
 * - AI 정보 read-only — 사용자 수정은 별도 "내가 알아본 정보" 카드
 */
export function CompanyResearchCard({ sessionId, userNotes }: Props) {
  const { data: research, isLoading } = useCompanyResearch(sessionId)
  const { mutate: trigger, isPending: triggering } =
    useTriggerCompanyResearch(sessionId)
  const { blocked: quotaBlocked, reason: quotaReason } =
    useAiQuotaBlocked('company_research')
  const ensureAiConsent = useRequireAiConsent()
  const [cardExpanded, setCardExpanded] = useState(true) // 카드 전체 toggle (default 펼침)
  const [showMore, setShowMore] = useState(false) // "더 보기" — 나머지 5 항목
  const [showSources, setShowSources] = useState(false) // 출처 토글 (default 접힘)
  const [editingNotes, setEditingNotes] = useState(false)

  const handleTrigger = async () => {
    if (!(await ensureAiConsent())) return
    trigger(undefined, {
      onSuccess: (result) => {
        if (result.status === 'ok') {
          toast.show(
            result.isCached
              ? '캐시된 정보로 표시했어요.'
              : '회사 조사를 마쳤어요.',
          )
        } else if (result.status === 'opt_out') {
          toast.show('이 회사는 정보 수집 동의가 철회됐어요.')
        } else {
          toast.error(result.reason ?? '조사에 실패했어요.')
        }
      },
      onError: () => toast.error('AI 호출 중 오류가 발생했어요.'),
    })
  }

  return (
    <>
      {/* 🏢 회사 정보 — primary 위계 (bg-brand/5 + border-brand/20) */}
      <div className="border border-brand/20 bg-brand/5 rounded-lg overflow-hidden">
        {/* 카드 헤더 — chevron 좌측 (Notion 패턴), 전체 클릭으로 토글 */}
        <button
          onClick={() => setCardExpanded(!cardExpanded)}
          aria-expanded={cardExpanded}
          aria-label={cardExpanded ? '회사 정보 접기' : '회사 정보 펼치기'}
          className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-brand/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CollapsibleChevron open={cardExpanded} />
            <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider">
              🏢 회사 정보
            </h3>
          </div>
          {research?.status === 'ok' && (
            <span className="text-text-faint text-[10px]">
              {research.isCached ? '캐시' : '방금'}
            </span>
          )}
        </button>

        {cardExpanded && (
          <div className="px-3.5 pb-3.5 pt-1">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 bg-surface-3 rounded animate-pulse"
                    style={{ width: `${80 - i * 15}%` }}
                  />
                ))}
              </div>
            ) : !research ? (
              <div className="space-y-2">
                <p className="text-text-tertiary text-xs leading-relaxed">
                  AI 가 공식 자료 (위키·언론사·공시) 를 검색해 회사·직무 정보를
                  정리해줘요.
                </p>
                <button
                  onClick={handleTrigger}
                  disabled={triggering || quotaBlocked}
                  className="w-full bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  title={quotaReason ?? undefined}
                >
                  {triggering ? '🔍 조사중... (5-10초 소요)' : '🔍 회사 조사 시작'}
                </button>
                <div className="flex justify-end">
                  <AiQuotaChip feature="company_research" />
                </div>
              </div>
            ) : research.status === 'opt_out' ? (
              <div className="bg-warning/5 border border-warning/20 rounded-md p-2.5">
                <p className="text-warning text-xs leading-relaxed">
                  ⚠️ 이 회사는 정보 수집 동의가 철회됐어요. 직접 회사 홈페이지를
                  확인해 주세요.
                </p>
              </div>
            ) : research.status === 'blocked' ? (
              <div className="bg-danger/5 border border-danger/20 rounded-md p-2.5">
                <p className="text-danger text-xs leading-relaxed">
                  {research.reason}
                </p>
                <button
                  onClick={handleTrigger}
                  disabled={triggering || quotaBlocked}
                  className="mt-2 text-text-tertiary hover:text-brand text-[11px] disabled:opacity-50"
                  title={quotaReason ?? undefined}
                >
                  {triggering ? '🔍 재시도중... (5-10초)' : '다시 시도'}
                </button>
              </div>
            ) : research.research ? (
              <>
                {/* ⚠️ AI 경고 alert */}
                <div className="bg-danger/5 border border-danger/20 rounded-md p-2.5 mb-3">
                  <p className="text-danger text-[11px] leading-relaxed">
                    ⚠️ AI 가 잘못된 정보를 안내할 수 있어요.
                    <br />
                    <strong>면접 전 공식 출처로 반드시 확인하세요.</strong>
                  </p>
                </div>

                {/* 핵심 3 — default 펼침 */}
                <ResearchSection
                  label="사업 영역"
                  value={research.research.businessSummary}
                />
                <ResearchSection
                  label="인재상·핵심가치"
                  value={research.research.coreValues}
                />
                <ResearchSection
                  label="최근 동향·신사업"
                  value={research.research.recentTrends}
                />

                {/* "더 보기" — 나머지 5 항목 */}
                <button
                  onClick={() => setShowMore(!showMore)}
                  aria-expanded={showMore}
                  className="text-brand hover:text-brand-hover text-[11px] font-medium mb-2"
                >
                  {showMore ? '− 접기' : '+ 더 보기 (5)'}
                </button>

                {showMore && (
                  <div className="border-t border-brand/20 pt-2.5 mt-1">
                    <ResearchSection
                      label="비전·미션"
                      value={research.research.visionMission}
                    />
                    <ResearchSection
                      label="재무·매출"
                      value={research.research.financials}
                    />
                    <ResearchSection
                      label="경쟁사·시장"
                      value={research.research.competitors}
                    />
                    <ResearchSection
                      label="직무 정보"
                      value={research.research.jobInsights}
                    />
                    <ResearchKeywords
                      keywords={research.research.interviewKeywords ?? []}
                    />
                  </div>
                )}

                {/* 출처 (Perplexity 식 chip + 별도 토글) */}
                {research.sources && research.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-brand/20">
                    <button
                      onClick={() => setShowSources(!showSources)}
                      aria-expanded={showSources}
                      aria-label={
                        showSources
                          ? `출처 ${research.sources.length}개 접기`
                          : `출처 ${research.sources.length}개 펼치기`
                      }
                      className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-[11px] font-semibold py-1.5 -mx-1 px-1 rounded hover:bg-surface-3/50"
                    >
                      <CollapsibleChevron open={showSources} />
                      출처 ({research.sources.length})
                    </button>
                    {showSources && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {research.sources.map((url) => (
                          <SourceChip key={url} url={url} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* 📝 내가 알아본 추가 정보 — secondary 위계 */}
      <div className="border border-line bg-surface-2 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-line/50">
          <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider">
            📝 내가 알아본 정보
          </h3>
          <button
            onClick={() => setEditingNotes(true)}
            className="text-[11px] text-text-tertiary hover:text-brand"
          >
            ✎ 편집
          </button>
        </div>
        <div className="px-3.5 py-3">
          {userNotes?.trim() ? (
            <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-wrap line-clamp-6">
              {userNotes}
            </p>
          ) : (
            <p className="text-text-faint text-xs leading-relaxed">
              AI 가 놓친 회사 분위기·면접관 후기 등을 직접 적어두세요.
            </p>
          )}
        </div>
      </div>

      {editingNotes && (
        <EditUserNotesModal
          sessionId={sessionId}
          initialNotes={userNotes ?? ''}
          onClose={() => setEditingNotes(false)}
        />
      )}
    </>
  )
}

function ResearchSection({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  if (!value?.trim()) return null
  return (
    <div className="mb-2.5 last:mb-2">
      <p className="text-text-tertiary text-[11px] font-semibold mb-0.5">
        {label}
      </p>
      <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    </div>
  )
}

function ResearchKeywords({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null
  return (
    <div className="mb-2.5">
      <p className="text-text-tertiary text-[11px] font-semibold mb-1">
        예상 면접 키워드
      </p>
      <div className="flex flex-wrap gap-1">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="text-[10px] font-medium bg-info/10 text-info border border-info/20 px-2 py-0.5 rounded-full"
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Perplexity 식 출처 chip — favicon + domain only */
function SourceChip({ url }: { url: string }) {
  let domain: string
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    domain = url
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 bg-surface border border-line hover:border-brand/40 hover:bg-surface-3 text-text-tertiary hover:text-text-primary text-[10px] px-2 py-1 rounded-md transition-colors max-w-full"
      title={url}
    >
      <img
        src={favicon}
        alt=""
        width={12}
        height={12}
        className="shrink-0"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <span className="truncate">{domain}</span>
    </a>
  )
}

function EditUserNotesModal({
  sessionId,
  initialNotes,
  onClose,
}: {
  sessionId: string
  initialNotes: string
  onClose: () => void
}) {
  const [notes, setNotes] = useState(initialNotes)
  const { mutate: save, isPending } = useUpdateUserResearchNotes(sessionId)

  // ESC 키 닫기 — Vercel Web Interface Guidelines 모달 표준
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = () => {
    save(notes.trim() || null, {
      onSuccess: () => {
        onClose()
        toast.show('저장됐어요.')
      },
      onError: () => toast.error('저장에 실패했습니다.'),
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-notes-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-2 border border-line rounded-xl shadow-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto"
      >
        <h2
          id="user-notes-modal-title"
          className="text-text-primary text-base font-semibold mb-2"
        >
          📝 내가 알아본 추가 정보
        </h2>

        <div className="bg-danger/5 border border-danger/20 rounded-md p-3 mb-4">
          <p className="text-danger text-xs leading-relaxed">
            ⚠️ <strong>AI 가 잘못된 정보를 안내할 수 있어요.</strong>
            <br />
            AI 정보는 read-only — 잘못된 부분이 있으면 이 메모에 정정 내용을
            적어 주세요. 면접 전 회사 공식 홈페이지·공시·뉴스로 반드시
            확인하세요.
          </p>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          rows={8}
          placeholder="예: 회사 분위기는 자유로움 / 작년 면접관은 기술 깊이 위주로 물어봤음 / 채용 페이지 인터뷰에서 강조한 점 등"
          autoFocus
          className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-brand/45 outline-none resize-none leading-relaxed"
        />
        <p className="text-text-faint text-[11px] mt-1 text-right">
          {notes.length} / 5000
        </p>

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-line">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-text-tertiary hover:text-text-primary"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-1.5 text-sm bg-brand hover:bg-brand-hover text-white rounded-md font-medium disabled:opacity-50"
          >
            {isPending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
