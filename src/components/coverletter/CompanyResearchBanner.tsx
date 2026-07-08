import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import type { CompanyResearchData } from '@/types/interviewPrep'

// ── 회사 조사 banner (접기 default, 8 항목 펼치기) ─────────
interface BannerProps {
  research:
    | { status: 'ok'; research?: CompanyResearchData; isCached?: boolean; cachedAt?: string }
    | { status: 'blocked' | 'opt_out'; reason?: string }
    | null
    | undefined
  loading: boolean
  expanded: boolean
  onToggle: () => void
}

export function CompanyResearchBanner({
  research,
  loading,
  expanded,
  onToggle,
}: BannerProps) {
  if (loading) {
    return (
      <div className="bg-info/8 border border-info/20 rounded-lg p-3 mb-5 text-info text-xs">
        🔍 회사·직무 정보 조회 중…
      </div>
    )
  }

  if (research && research.status === 'blocked') {
    return (
      <div className="bg-warning/8 border border-warning/20 rounded-lg p-3 mb-5">
        <span className="text-warning text-xs">
          ⚠️ 회사 조사를 표시할 수 없어요
          {research.reason ? ` · ${research.reason}` : ''}
        </span>
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
