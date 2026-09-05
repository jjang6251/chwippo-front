/**
 * 세그먼트 토글 — 선택지 2~9개를 한 화면에 펼쳐 **0클릭에 가깝게** 고르는 입력.
 *
 * 왜 드롭다운이 아닌가: 지원서 폼 11곳 실측(`company/01_product/autofill-census-2026-09.md`
 * 「입력 UX 관찰」 #1)에서 병역·보훈·장애·본교/분교 같은 칸은 전부 세그먼트였고,
 * 대부분의 사용자는 **기본값(「비대상」)에서 손을 대지 않는다.** 드롭다운은 그 0클릭을
 * 2클릭으로 만든다.
 *
 * 톤은 `BoardViewToggle`·`CoverLetterImportModal` 의 인라인 선례를 그대로 따른다 —
 * 활성 = `bg-surface-3 text-text-primary font-medium`. **기존 인라인 6종은 건드리지 않는다**
 * (신규 표면에서만 쓴다).
 *
 * - `role="group"` + 옵션마다 `aria-pressed` — 라디오가 아니라 「눌린 버튼」 모델이다
 *   (스크린리더가 선택 상태를 그대로 읽고, 키보드는 Tab/Enter 로 충분하다)
 * - 모바일 터치 타겟 44px · 옵션이 많으면 **줄바꿈**(9개까지 가로 강제하면 320px 에서 터진다)
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  /** `role="group"` 의 접근성 이름 (시각 라벨이 따로 있어도 필요하다) */
  label: string
  /**
   * `null` = **아직 아무것도 안 고름** — 어떤 옵션도 눌린 상태가 아니다.
   *
   * 🔴 왜 필요한가: 보훈·장애처럼 「비대상」이 기본값인 칸은, 저장 전에도 비대상이 눌려 보여서
   * 사용자가 **이미 답한 줄 안다** (그리고 게이지는 계속 미완료라 어긋난다). 미선택을
   * 미선택으로 그려야 「한 번 눌러 주세요」가 말이 된다.
   */
  value: T | null
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /**
   * 화면에 이미 있는 라벨(`FieldLabel`)의 id — 주면 그 글자가 그룹 이름이 된다.
   * `aria-labelledby` 가 `aria-label` 을 이기므로, **보이는 글자와 읽히는 이름이 어긋날 때만**
   * `label` 을 그대로 두고 이 값을 비운다.
   */
  labelledBy?: string
  /** 그룹 아래 도움말의 id (`aria-describedby`) */
  describedBy?: string
  className?: string
}

export function SegmentedToggle<T extends string>({
  label, value, options, onChange, disabled, labelledBy, describedBy, className = '',
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] sm:min-h-[38px] px-3.5 rounded-lg border text-[13px] whitespace-nowrap touch-manipulation transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg
              disabled:opacity-40 disabled:cursor-not-allowed
              ${active
                ? 'bg-surface-3 text-text-primary font-medium border-line-strong'
                : 'bg-card text-text-tertiary border-line hover:text-text-secondary hover:bg-card-hover'
              }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
