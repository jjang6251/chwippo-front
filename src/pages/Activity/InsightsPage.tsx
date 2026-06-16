import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInsights } from '@/hooks/useInsights'
import {
  CL_COLOR,
  CL_KO,
  COMP_COLOR,
  COMP_KO,
} from '@/pages/Activity/constants'
import type { InsightsResponse } from '@/types/insights'

/**
 * F6 PR 1 Phase 6 — 내 데이터 (insights) 페이지.
 *
 * mock `activity-journal-mock.html #page-insights` (3596-3668) 단순화 (V1):
 * - sub-tab 2: 강점 분석 / 자소서 소재
 * - 강점: 한눈에 보기 + 30일 heatmap + 역량 Top 10 + 자소서 카테고리 누적
 * - 자소서 소재: 인용 횟수 top 10 logs
 *
 * 후속: hero / 이번주 vs 지난주 trend / 정량 결과 Top 5 / 자동 인사이트
 */

type SubTab = 'strengths' | 'sources'

export function InsightsPage() {
  const [tab, setTab] = useState<SubTab>('strengths')
  const { data, isLoading, error } = useInsights()

  if (isLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-4">
        <Header />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <Header />
        <div className="bg-danger/8 border border-danger/20 rounded-lg p-4 text-center">
          <p className="text-danger text-sm">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-5">
      <Header cached={data.cached} />

      <Tabs tab={tab} onChange={setTab} />

      <div
        id={tab === 'strengths' ? 'insights-strengths-panel' : 'insights-sources-panel'}
        role="tabpanel"
        aria-labelledby={tab === 'strengths' ? 'insights-strengths-tab' : 'insights-sources-tab'}
      >
        {tab === 'strengths' ? (
          <StrengthsView data={data} />
        ) : (
          <SourcesView data={data} />
        )}
      </div>
    </div>
  )
}

// ── Header ──

function Header({ cached }: { cached?: boolean } = {}) {
  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-text-primary text-2xl font-bold leading-tight">
            내 <span className="text-brand">데이터</span>
          </h1>
        </div>
        <Link
          to="/activity"
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors"
        >
          ← 활동 일지
        </Link>
      </div>
      <p className="text-text-tertiary text-xs leading-relaxed">
        활동 일지에 쌓인 데이터로 자동 정리한 내 강점과 자소서 활용 가능한 소재.
        매주 들어와 변화를 관찰하세요.
        {cached !== undefined && (
          <span className="text-text-quaternary ml-2">
            {cached ? '· 캐시됨' : '· 방금 갱신됨'}
          </span>
        )}
      </p>
    </header>
  )
}

// ── Tabs ──

function Tabs({ tab, onChange }: { tab: SubTab; onChange: (t: SubTab) => void }) {
  return (
    <div role="tablist" aria-label="내 데이터 탭" className="flex border-b border-line">
      <TabButton
        active={tab === 'strengths'}
        controls="insights-strengths-panel"
        onClick={() => onChange('strengths')}
      >
        ✨ 강점 분석
      </TabButton>
      <TabButton
        active={tab === 'sources'}
        controls="insights-sources-panel"
        onClick={() => onChange('sources')}
      >
        📝 자소서 소재
      </TabButton>
    </div>
  )
}

function TabButton({
  active,
  controls,
  onClick,
  children,
}: {
  active: boolean
  controls: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'text-text-primary border-brand'
          : 'text-text-quaternary border-transparent hover:text-text-tertiary'
      }`}
    >
      {children}
    </button>
  )
}

// ── Strengths sub-view ──

function StrengthsView({ data }: { data: InsightsResponse }) {
  const totalLogs = data.heatmap.reduce((sum, h) => sum + h.count, 0)
  const totalDays = data.heatmap.filter((h) => h.count > 0).length

  return (
    <div className="space-y-5">
      <Section label="한눈에 보기" title="활동·기록 누적량">
        <StatGrid>
          <Stat label="총 기록" value={totalLogs} unit="개" />
          <Stat label="기록한 날" value={totalDays} unit="일" />
          <Stat label="역량 종류" value={data.strengths.byComps.length} unit="개" />
          <Stat label="자소서 매핑" value={data.strengths.byCl.length} unit="개" />
        </StatGrid>
      </Section>

      <Section label="🌱 최근 365일" title="매일의 기록 — 꾸준함이 강점">
        <HeatmapGrid heatmap={data.heatmap} />
      </Section>

      <Section label="발휘 역량 분포" title="당신의 강점 역량">
        <Bars
          items={data.strengths.byComps}
          labelMap={COMP_KO}
          colorMap={COMP_COLOR}
        />
      </Section>

      <Section
        label="자소서 답변 활용 가능도"
        title="6 카테고리별 누적 소재"
      >
        <Bars
          items={data.strengths.byCl}
          labelMap={CL_KO}
          colorMap={CL_COLOR}
        />
      </Section>
    </div>
  )
}

// ── Sources sub-view ──

function SourcesView({ data }: { data: InsightsResponse }) {
  if (data.sources.length === 0) {
    return (
      <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center">
        <p className="text-text-tertiary text-sm font-medium mb-1">
          아직 자소서에 인용된 활동이 없어요
        </p>
        <p className="text-text-quaternary text-xs leading-relaxed">
          자소서 답변에 활동 일지의 logs를 선택하면 여기 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-line rounded-lg p-3">
        <div className="text-[10px] text-brand font-medium mb-0.5">✦ 자소서 인용 통계</div>
        <p className="text-text-secondary text-xs leading-relaxed">
          자소서 답변에 자주 인용된 활동 일지 top {data.sources.length}.
          많이 인용된 경험은 면접에서도 자주 활용 가능.
        </p>
      </div>
      <div className="space-y-2">
        {data.sources.map((s, idx) => (
          <div
            key={s.logId}
            className="border border-line bg-surface-2 rounded-lg px-4 py-3 flex items-start gap-3"
          >
            <div className="text-brand font-mono text-lg font-bold w-6 text-center pt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-text-quaternary mb-1 font-mono">
                {s.occurredAt}
              </div>
              <p className="text-text-secondary text-sm leading-relaxed line-clamp-2">
                {s.content}
              </p>
            </div>
            <span className="text-brand bg-brand/8 border border-brand/20 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
              {s.referencedByCount}회 인용
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Reusable sub-components ──

function Section({
  label,
  title,
  children,
}: {
  label: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface-2 border border-line rounded-xl p-4">
      <div className="text-[10px] text-brand font-medium mb-1">{label}</div>
      <h3 className="text-text-primary text-sm font-semibold mb-3">{title}</h3>
      {children}
    </section>
  )
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-surface-3 border border-line rounded-lg px-3 py-2.5 text-center">
      <div className="text-[10px] text-text-quaternary mb-0.5">{label}</div>
      <div className="text-text-primary font-mono text-lg font-semibold">
        {value.toLocaleString()}
        <span className="text-text-tertiary text-xs ml-0.5">{unit}</span>
      </div>
    </div>
  )
}

function HeatmapGrid({ heatmap }: { heatmap: InsightsResponse['heatmap'] }) {
  if (heatmap.length === 0) {
    return (
      <p className="text-text-quaternary text-xs text-center py-4">
        아직 기록이 없어요.
      </p>
    )
  }
  // 최근 30일만 표시 (V1 단순화)
  const last30 = heatmap.slice(-30)
  const maxCount = Math.max(...last30.map((h) => h.count), 1)
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {last30.map((h) => {
          const intensity = h.count / maxCount
          const cls =
            h.count === 0
              ? 'bg-surface-3'
              : intensity >= 0.75
              ? 'bg-brand'
              : intensity >= 0.5
              ? 'bg-brand/60'
              : intensity >= 0.25
              ? 'bg-brand/35'
              : 'bg-brand/15'
          return (
            <div key={h.date} className="relative group">
              <div
                className={`w-3.5 h-3.5 rounded-sm ${cls} cursor-pointer transition-transform group-hover:scale-125`}
                aria-label={`${h.date}: ${h.count}개 기록`}
              />
              {/* 커스텀 tooltip — GitHub 잔디 풍 (브라우저 native title 보다 빠르고 디자인 일관) */}
              <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface border border-line rounded-md shadow-lg whitespace-nowrap pointer-events-none">
                <div className="font-mono text-[10px] text-text-tertiary">
                  {h.date}
                </div>
                <div className="text-xs text-text-primary font-semibold text-center">
                  {h.count === 0 ? '기록 없음' : `${h.count}개 기록`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-text-quaternary">
        <span>적음</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-surface-3" />
        <div className="w-2.5 h-2.5 rounded-sm bg-brand/15" />
        <div className="w-2.5 h-2.5 rounded-sm bg-brand/35" />
        <div className="w-2.5 h-2.5 rounded-sm bg-brand/60" />
        <div className="w-2.5 h-2.5 rounded-sm bg-brand" />
        <span>많음</span>
      </div>
    </>
  )
}

function Bars({
  items,
  labelMap,
  colorMap,
}: {
  items: Array<{ key: string; count: number }>
  labelMap: Record<string, string>
  /** 카테고리별 색 (rgb 문자열). 없으면 brand 색 fallback */
  colorMap?: Record<string, string>
}) {
  if (items.length === 0) {
    return (
      <p className="text-text-quaternary text-xs text-center py-4">
        아직 데이터가 없어요. 로그를 더 작성하면 분석됩니다.
      </p>
    )
  }
  const maxCount = items[0].count // 정렬된 첫 번째가 최대
  return (
    <div className="space-y-1.5">
      {items.slice(0, 10).map((it) => {
        const width = Math.max(8, (it.count / maxCount) * 100)
        const color = colorMap?.[it.key]
        return (
          <div key={it.key} className="flex items-center gap-2 text-xs">
            {color && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
                aria-hidden="true"
              />
            )}
            <span className="text-text-secondary w-20 truncate">
              {labelMap[it.key] ?? it.key}
            </span>
            <div className="flex-1 bg-surface-3 rounded-full overflow-hidden h-5 relative">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${width}%`,
                  background: color
                    ? `${color.replace('rgb(', 'rgb(').replace(')', ' / 0.5)')}`
                    : 'rgb(94 106 210 / 0.4)',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-2 font-mono text-[10px] text-text-secondary">
                {it.count}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
