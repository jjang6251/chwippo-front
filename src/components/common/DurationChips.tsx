/**
 * 기간 보조 칩 — 시작일만 넣으면 종료일이 따라온다.
 *
 * 실측 근거: 리크루터 지원서가 재학 기간에 「+1학기·+1년·+2년」, 복무 기간에 「18·21·24개월」
 * 칩을 두고 있었다(`autofill-census-2026-09.md` 「입력 UX 관찰」 #3). 우리 창고는 종료일을
 * 달력에서 손으로 찾게 했는데, 학기·복무는 **시작일에서 산술로 나오는 값**이라 그럴 이유가 없다.
 *
 * 날짜 계산은 전부 `@/utils/datetime`(`addMonths`·`addMonthsInclusiveEnd`) — 여기서 `Date` 를
 * 직접 만지지 않는다 (기기 로컬 TZ 를 타면 KST 새벽에 하루 밀린다).
 */
import { addMonths, addMonthsInclusiveEnd } from '@/utils/datetime'
import type { DurationPreset } from '@/utils/durationPresets'

interface Props {
  /** 시작일 'YYYY-MM-DD' — 비어 있으면 칩은 비활성(계산 근거가 없다) */
  start: string
  presets: readonly DurationPreset[]
  /** 계산된 종료일 'YYYY-MM-DD' 를 넘긴다 */
  onPick: (end: string) => void
  /**
   * 시작일이 기간에 **포함**되는 칸인가 (복무 기간). 켜면 종료일이 「해당일 −1」이다 —
   * 2020-01-01 입대 + 18개월 → 전역일 2021-06-30.
   *
   * 🔴 기본값은 끔이다. 학력 재학 기간(입학 → 졸업/예정)은 「입학일 포함 N개월의 마지막 날」이
   * 아니라 **그 달의 학사 일정**이라 −1일이 뜻을 갖지 않는다 — 종전 계산을 그대로 둔다.
   */
  inclusiveEnd?: boolean
  /** `role="group"` 접근성 이름 */
  label?: string
  /** 종료일 입력이 `aria-describedby` 로 이 칩 묶음을 가리킬 때 쓰는 id */
  id?: string
  className?: string
}

export function DurationChips({
  start, presets, onPick, inclusiveEnd = false, label = '기간 자동 계산', id, className = '',
}: Props) {
  const ready = !!addMonths(start, 0)
  return (
    <div id={id} role="group" aria-label={label} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          disabled={!ready}
          onClick={() => {
            const end = inclusiveEnd
              ? addMonthsInclusiveEnd(start, p.months)
              : addMonths(start, p.months)
            if (end) onPick(end)
          }}
          className="min-h-[44px] sm:min-h-[32px] px-2.5 rounded-full border border-dashed border-line text-[11px] text-text-tertiary touch-manipulation whitespace-nowrap
            hover:text-brand hover:border-brand/40 active:bg-card-strong transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-tertiary disabled:hover:border-line"
        >
          {p.label}
        </button>
      ))}
      {/* 시작일을 넣는 순간 칩이 살아난다 — 그 전환을 스크린리더도 알아야 한다 */}
      {!ready && (
        <span aria-live="polite" className="text-[11px] text-text-quaternary">시작일을 먼저 입력하면 종료일을 채워드려요</span>
      )}
    </div>
  )
}
