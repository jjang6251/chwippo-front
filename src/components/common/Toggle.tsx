interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** 접근성 라벨 (시각 라벨이 별도로 있으면 aria-label 로 연결) */
  label?: string
}

/**
 * 스위치 토글 — DESIGN.md 토큰. on = brand, off = card-strong.
 * 44px 터치 타겟 확보 (외곽 패딩 hit area).
 */
export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
        checked ? 'bg-brand' : 'bg-card-strong'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
