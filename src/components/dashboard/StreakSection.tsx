import { useDashboardStreak } from '@/hooks/useDashboardStreak'

/**
 * W3 — Dashboard streak + 365일 heatmap 섹션.
 *
 * UX:
 *   - current=0 → "🌱 첫 기록!" (Q4=A 침묵 패턴)
 *   - current>=1 → "🔥 N일째"
 *   - Desktop: 365일 GitHub-style grid (53주 × 7요일)
 *   - Mobile: 90일 simplified (가로 grid)
 *   - 외부 401·503 → 섹션 미렌더 (silent)
 */
export function StreakSection() {
  const { data, isLoading, error } = useDashboardStreak()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const { streak, heatmap } = data
  const visible = isMobile90Days() ? heatmap.slice(-90) : heatmap

  return (
    <section
      aria-labelledby="streak-section-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="streak-section-heading" className="text-text-primary text-sm font-semibold">
          {streak.current === 0 ? '🌱 첫 기록!' : `🔥 ${streak.current}일째`}
        </h2>
        {streak.lastActivityDate && streak.current === 0 && (
          <span className="text-text-quaternary text-[10px] font-mono">
            마지막: {streak.lastActivityDate}
          </span>
        )}
      </div>
      <HeatmapGrid heatmap={visible} fullYear={!isMobile90Days()} />
      <Legend />
    </section>
  )
}

/** Mobile 인지 hook 사용. SSR safe X 라 useIsMobile 패턴 따름 */
function isMobile90Days(): boolean {
  // SSR safe — window 없으면 desktop default
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 640px)').matches
}

/** GitHub-style heatmap — fullYear 모드 (X축 월·Y축 요일 라벨 + week 단위 정렬) */
function HeatmapGrid({
  heatmap,
  fullYear,
}: {
  heatmap: { date: string; count: number }[]
  fullYear: boolean
}) {
  const maxCount = Math.max(...heatmap.map((h) => h.count), 1)

  if (!fullYear) {
    // Mobile simplified — wrap grid 그대로 (90일)
    return (
      <div className="flex flex-wrap gap-1">
        {heatmap.map((h) => (
          <HeatmapCell key={h.date} h={h} maxCount={maxCount} tooltipPos="bottom-full mb-1.5 left-1/2 -translate-x-1/2" />
        ))}
      </div>
    )
  }

  // GitHub-style — week 단위 정렬 (첫 주 padding + 7행 × N열)
  // CEO 결정: 현재 연도(KST 1/1 ~ 오늘) 만 표시. 미래 셀은 안 그림 — 매일 칸이 하나씩 늘어남.
  const todayKstYear = todayKstString().slice(0, 4)
  const yearOnly = heatmap.filter((h) => h.date.startsWith(`${todayKstYear}-`))
  const first = yearOnly[0]
  if (!first) return null
  // 첫 주 padding — first 일자의 요일 (일=0) 만큼 앞에 빈 셀 (월요일 정렬은 GitHub 일요일 시작 기준)
  const firstDayOfWeek = dayOfWeek(first.date) // 0=일, ..., 6=토
  const padded: ({ date: string; count: number } | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...yearOnly,
  ]
  // 마지막 주 padding 없음 — 미래 셀 안 그림 (사용자 요청)
  const weeks = Math.ceil(padded.length / 7)

  // 월 라벨 — 각 컬럼의 첫 셀(row 0) 의 월이 이전 컬럼과 다르면 라벨 표시
  const monthLabels: ({ col: number; label: string } | null)[] = []
  let prevMonth = -1
  for (let col = 0; col < weeks; col++) {
    const firstCellOfWeek = padded[col * 7]
    if (!firstCellOfWeek) {
      monthLabels.push(null)
      continue
    }
    const m = Number(firstCellOfWeek.date.slice(5, 7))
    if (m !== prevMonth) {
      monthLabels.push({ col, label: `${m}월` })
      prevMonth = m
    } else {
      monthLabels.push(null)
    }
  }

  return (
    <div className="overflow-x-auto pt-1">
      <div className="inline-flex flex-col gap-1.5">
        {/* X축 — 월 라벨 row (왼쪽 요일 라벨 폭 만큼 padding) */}
        <div className="flex gap-[3px] pl-7" aria-hidden="true">
          {monthLabels.map((m, i) => (
            <div key={i} className="w-[11px] text-[9px] text-text-quaternary font-mono">
              {m?.label ?? ''}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {/* Y축 — 요일 라벨 (월·수·금만 — GitHub 패턴) */}
          <div className="grid grid-rows-7 gap-[3px]" aria-hidden="true">
            {['', '월', '', '수', '', '금', ''].map((d, i) => (
              <div key={i} className="w-5 h-[11px] text-[9px] text-text-quaternary font-mono leading-[11px] text-right">
                {d}
              </div>
            ))}
          </div>
          {/* 메인 grid */}
          <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
            {padded.map((h, i) =>
              h === null ? (
                <div key={`pad-${i}`} className="w-[11px] h-[11px]" />
              ) : (
                <HeatmapCell
                  key={h.date}
                  h={h}
                  maxCount={maxCount}
                  tooltipPos={tooltipPosFor(i, padded.length)}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 단일 셀 + tooltip */
function HeatmapCell({
  h,
  maxCount,
  tooltipPos,
}: {
  h: { date: string; count: number }
  maxCount: number
  tooltipPos: string
}) {
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
    <div className="relative group">
      <div
        className={`w-[11px] h-[11px] rounded-sm ${cls} cursor-pointer transition-transform group-hover:scale-125`}
        aria-label={`${h.date}: ${h.count}개 활동`}
        data-testid="streak-cell"
      />
      <div
        className={`hidden group-hover:block absolute z-10 px-2 py-1 bg-surface border border-line rounded-md shadow-lg whitespace-nowrap pointer-events-none ${tooltipPos}`}
      >
        <div className="font-mono text-[10px] text-text-tertiary">{h.date}</div>
        <div className="text-xs text-text-primary font-semibold text-center">
          {h.count === 0 ? '활동 없음' : `${h.count}개 활동`}
        </div>
      </div>
    </div>
  )
}

/** 셀 boundary 별 tooltip 위치 (잘림 회피) */
function tooltipPosFor(i: number, total: number): string {
  const row = i % 7
  const col = Math.floor(i / 7)
  const totalCols = Math.ceil(total / 7)
  const vertical = row <= 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
  const horizontal =
    col <= 1
      ? 'left-0 translate-x-0'
      : col >= totalCols - 2
      ? 'right-0 translate-x-0'
      : 'left-1/2 -translate-x-1/2'
  return `${vertical} ${horizontal}`
}

/** 'YYYY-MM-DD' → 요일 (0=일 ~ 6=토). UTC 산술 — backend 가 KST 일자로 truncate 했으니 결과 동일 */
function dayOfWeek(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** KST 오늘 'YYYY-MM-DD'. 연도 filter 에 사용 */
function todayKstString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-text-quaternary">
      <span>적음</span>
      <div className="w-2.5 h-2.5 rounded-sm bg-surface-3" />
      <div className="w-2.5 h-2.5 rounded-sm bg-brand/15" />
      <div className="w-2.5 h-2.5 rounded-sm bg-brand/35" />
      <div className="w-2.5 h-2.5 rounded-sm bg-brand/60" />
      <div className="w-2.5 h-2.5 rounded-sm bg-brand" />
      <span>많음</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-card animate-pulse rounded mb-4" />
      <div className="grid grid-cols-12 gap-1.5">
        {Array.from({ length: 84 }).map((_, i) => (
          <div key={i} className="w-3 h-3 bg-card animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
