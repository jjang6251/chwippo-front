/**
 * MyInfo C 패턴 — 빈 상태·"+ 추가" dashed 카드
 *
 * 사용:
 *   <MyInfoEmptyAdd
 *     emoji="🎓"
 *     label="첫 학력 추가하기"
 *     example="예: 서울대학교 · 컴퓨터공학 · 2020-2024"
 *     onClick={() => setAddOpen(true)}
 *   />
 *
 * list 가 비어있을 땐 단독 표시 (큰 padding). 항목이 있을 땐 "+ 추가" 만 (작은 padding).
 */
interface Props {
  emoji?: string
  label: string
  /** 빈 상태 (list 0건) — 큰 사이즈 + 예시 */
  example?: string
  /** list 끝에 붙는 "+ 추가" 버튼 — 작은 사이즈 */
  compact?: boolean
  onClick: () => void
}

export function MyInfoEmptyAdd({
  emoji,
  label,
  example,
  compact,
  onClick,
}: Props) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border-2 border-dashed border-line hover:border-brand/40 hover:bg-brand/4 hover:text-brand rounded-xl text-xs text-text-tertiary transition-all"
      >
        <span className="text-sm leading-none">+</span>
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex flex-col items-center gap-2 py-8 px-4 bg-surface-2 border-2 border-dashed border-line hover:border-brand/40 hover:bg-brand/4 rounded-xl transition-all text-center group"
    >
      {emoji && (
        <span className="text-3xl opacity-60 group-hover:opacity-100 transition-opacity">
          {emoji}
        </span>
      )}
      <span className="text-sm font-medium text-text-secondary group-hover:text-brand transition-colors">
        + {label}
      </span>
      {example && (
        <span className="text-[11px] text-text-quaternary mt-1">{example}</span>
      )}
    </button>
  )
}
