import { useState } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { keywordChip } from '@/utils/researchKeywords'
import { parseTimeline, parseValueList } from '@/utils/researchTimeline'
import { toLocalDateString } from '@/utils/datetime'
import type { CompanyResearchData } from '@/types/interviewPrep'

/**
 * 자소서 화면의 회사 조사 — **참고용 곁눈질 자리**다 (학습은 카드 상세 「회사 알아보기」 탭).
 *
 * 🔴 **2026-08-23 재구성** (CEO 실기 — "보기가 편한 것 같지 않다").
 * 이전엔 7개 항목을 **전부 같은 모양·같은 크기(12px)로 세로 나열**했다. 그래서
 * 자소서를 쓰다 열면 필요한 게 어디 있는지 훑어야 했고, 정작 문항이 묻는
 * 핵심 가치·직무 정보가 목록 **4·6번째**에 있었다.
 *
 * 이제 **문항에 답할 재료를 먼저** 놓고, 배경 지식은 「더보기」 뒤로 보낸다:
 * - 항상: 어떤 회사인가요 · 핵심 가치 · 직무 정보 · 주요 키워드
 *   (지원동기 → 요약 / 가치관 문항 → 핵심 가치 / 직무 문항 → 직무 정보)
 * - 더보기: 왜 이 회사인가 · 최근 행보 · 비전·미션 · 조사 시점
 *
 * 🔴 **라벨은 탭과 같은 말을 쓴다** — 예전엔 같은 필드를 「비즈니스 요약/최근 동향/직무
 * 인사이트/면접·자소서 키워드」로 불러 탭의 「어떤 회사인가요/최근 행보/직무 정보/이 회사
 * 주요 키워드」와 넷이 어긋났다. 이름이 다르면 **다른 정보인 줄 안다.**
 *
 * 🔴 **탭으로 보내지 않는다** (CEO 결정). 자소서를 쓰는 중에 화면을 떠나게 하면
 * 쓰던 흐름이 끊긴다 — 안에서 늘렸다 줄인다.
 *
 * 🔴 **탭과 데이터 처리를 맞춘다** — 파서·칩 색을 공용 유틸에서 가져온다. 같은 조사가
 * 두 화면에서 다르게 보이면 어느 쪽을 믿어야 할지 알 수 없다. 다만 **마크업은 공유하지
 * 않는다**: 탭은 작정하고 읽는 화면, 여기는 곁눈질하는 자리라 밀도가 다르다.
 */
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
  /* 배경 지식 펼침 — 배너 자체와 같은 **세션성**(`useState`). 배너 펼침도 localStorage 를
     안 쓰므로 여기만 기억하면 둘이 따로 놀아 "왜 이건 열려 있지" 가 된다. */
  const [showMore, setShowMore] = useState(false)

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

  /* 배경 지식이 하나도 없으면 「더보기」 자체를 만들지 않는다 — 눌러도 아무 일이 없는
     버튼은 거짓 어포던스다 (조사 필드 보유율이 회사마다 다르다). */
  const hasMore = Boolean(
    data.differentiators?.trim() ||
      data.recentTrends?.trim() ||
      data.visionMission?.trim() ||
      research.cachedAt,
  )

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
        /* 12px → 14px. 조사 내용은 메타데이터가 아니라 **문장**이다(요약 약 210자).
           배너는 기본이 접힘이라 **펼치는 행위 자체가 "지금 읽겠다"** 는 뜻이고, 그때는
           본문 대접을 한다. 위계는 접힘/펼침과 섹션 제목(11px)이 만들므로 크기로 또
           낮추지 않는다 (2026-08-23 조판 수리와 한 벌 · 공고 요건 배너와 같은 값). */
        <div className="px-3 pb-1.5 text-sm">
          {/* ── 문항에 답할 재료 (항상) ───────────────── */}
          {summary && <Section title="어떤 회사인가요" content={summary} />}
          {data.coreValues?.trim() && <ValuesSection content={data.coreValues} />}
          {data.jobInsights?.trim() && (
            <Section title="직무 정보" content={data.jobInsights} />
          )}
          {data.interviewKeywords && data.interviewKeywords.length > 0 && (
            <ChipSection
              title="이 회사 주요 키워드"
              chips={data.interviewKeywords}
            />
          )}

          {/* ── 배경 지식 (더보기) ────────────────────── */}
          {hasMore && (
            <>
              {showMore && (
                <>
                  {data.differentiators?.trim() && (
                    <Section
                      title="왜 이 회사인가"
                      content={data.differentiators}
                    />
                  )}
                  {data.recentTrends?.trim() && (
                    <TrendsSection content={data.recentTrends} />
                  )}
                  {data.visionMission?.trim() && (
                    <Section title="비전·미션" content={data.visionMission} />
                  )}
                  {research.cachedAt && (
                    <p className="text-text-quaternary text-[11px] py-1.5">
                      · {toLocalDateString(new Date(research.cachedAt))} 기준 (KST)
                      {research.isCached === false ? ' · 방금 조사됨' : ''}
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                className="flex items-center gap-1 min-h-[32px] text-[11px] font-semibold text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <CollapsibleChevron open={showMore} />
                {showMore ? '접기' : '더보기'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 섹션 제목 — F안 (2026-07-12 CEO 확정): brand 틱 + 제목 승격으로
 * 박스·구분선 없이 타이포 위계만으로 섹션 구분감 확보.
 */
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span aria-hidden className="w-1 h-3 rounded-full bg-brand/60" />
      <span className="text-[11px] text-text-secondary font-semibold">
        {title}
      </span>
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="py-2">
      <SectionTitle title={title} />
      <p className="text-text-secondary leading-relaxed whitespace-pre-wrap pl-2.5">
        {content}
      </p>
    </div>
  )
}

/**
 * 핵심 가치 — **이름 + 부연 목록**으로 쪼갠다 (「회사 알아보기」 탭과 같은 파서).
 * 원문은 `인재제일(사람이 기업이다), 최고지향(…), 상생추구(…)` 처럼 쉼표로 이어진 한 줄이라,
 * 그대로 두면 **가치 이름이 문장에 묻힌다.** 가치관 문항을 쓰는 사람에게 필요한 건
 * 이름 3~5개가 눈에 박히는 것이다. 목록이 아니면(실측 약 75% 문단형) 원문 그대로 둔다.
 */
function ValuesSection({ content }: { content: string }) {
  const parsed = parseValueList(content)
  return (
    <div className="py-2">
      <SectionTitle title="핵심 가치" />
      {parsed ? (
        <div className="pl-2.5">
          {parsed.lead && (
            <p className="text-text-tertiary text-[11px] leading-relaxed mb-1">{parsed.lead}</p>
          )}
          <ul className="list-disc pl-3.5 marker:text-text-quaternary space-y-1">
            {parsed.items.map((it, i) => (
              <li key={i}>
                <span className="text-text-primary font-semibold">{it.name}</span>
                {it.note && (
                  <span className="text-text-tertiary text-[11px]"> — {it.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-text-secondary leading-relaxed whitespace-pre-wrap pl-2.5">
          {content}
        </p>
      )}
    </div>
  )
}

/**
 * 최근 행보 — 날짜가 붙은 항목이면 **배지 + 항목**으로 쪼갠다 (「회사 알아보기」 탭과 같은 파서).
 * 실측상 이 필드는 `1) 2026-04-28 발표: …` 형태가 많은데, 원문 그대로 두면 한 문단에
 * 날짜 두세 개가 엉겨 어느 게 언제 일인지 안 읽힌다. 파싱 실패 시엔 원문을 그대로 둔다 —
 * 서식이 제각각이라 억지로 쪼개면 문장이 잘린다.
 */
function TrendsSection({ content }: { content: string }) {
  const timeline = parseTimeline(content)
  return (
    <div className="py-2">
      <SectionTitle title="최근 행보" />
      {timeline ? (
        <ul className="pl-2.5 space-y-1">
          {timeline.map((e, i) => (
            <li key={i} className="flex gap-1.5">
              {/* 날짜가 없는 항목도 있다(`date: null`) — 배지 자리를 비워 두면 본문이
                  들쭉날쭉해지므로 그때는 아예 안 그리고 본문만 흐른다 */}
              {e.date && (
                <span className="shrink-0 font-mono text-[11px] text-text-quaternary tabular-nums">
                  {e.date}
                </span>
              )}
              <span className="text-text-secondary leading-relaxed min-w-0">
                {e.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary leading-relaxed whitespace-pre-wrap pl-2.5">
          {content}
        </p>
      )}
    </div>
  )
}

/**
 * 키워드 칩 — 카테고리 색은 **공용 유틸**에서 가져온다 (`researchKeywords`).
 * 예전엔 전부 무채색 info 였는데, 같은 조사가 카드 상세에서는 5색으로 갈려 보였다.
 */
function ChipSection({
  title,
  chips,
}: {
  title: string
  chips: NonNullable<CompanyResearchData['interviewKeywords']>
}) {
  return (
    <div className="py-2">
      <SectionTitle title={title} />
      <div className="flex flex-wrap gap-1 pl-2.5">
        {chips.map((c, i) => {
          const { keyword, style } = keywordChip(c)
          return (
            <span
              key={i}
              className={`text-[11px] px-1.5 py-0.5 rounded border ${style}`}
            >
              {keyword}
            </span>
          )
        })}
      </div>
    </div>
  )
}
