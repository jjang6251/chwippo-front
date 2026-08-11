import { CATEGORY_LABEL } from '@/types/interviewPrep'

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL)

/**
 * 질문 유형 select — **좁은 모달에서 조준 사격용**으로 쓴다.
 *
 * 🔴 남은 소비처는 `GenerateQuestionsModal` **하나뿐이다** (2026-08-12). 고르는 자리는
 * 전부 `CategoryChipPicker`(칩 줄)로 옮겼는데, 여기만 남긴 건 취향이 아니라 **뜻이 달라서**다:
 * 저기 빈 값은 「미분류」(분류를 안 한다)이고 여기 빈 값은 「전체 = 부족한 유형 위주」
 * (서버가 알아서 고른다)다. 게다가 좁은 모달에서 칩 줄은 세로를 너무 먹는다.
 *
 * 목록은 `CATEGORY_LABEL` 단일 소스를 칩 피커와 함께 쓴다 — 갈라지면 값을 더할 때
 * 한 곳만 늘어나는 사고가 난다.
 *
 * 🔴 네이티브 chevron 을 쓰지 않는다 — `appearance-none` + 12x12 SVG 가 하우스 규칙이다.
 */
interface Props {
  value: string
  onChange: (next: string) => void
  /** 접근성 라벨 — 화면에 보이는 제목이 따로 없는 자리가 많다 */
  label: string
  /**
   * 빈 값(`''`)의 라벨. 추가 폼은 「미분류」(분류를 안 한다), 생성 모달은
   * 「전체 (부족한 유형 위주)」(서버가 알아서 고른다) — 같은 빈 값이 자리마다 다른 뜻이다.
   */
  emptyLabel?: string
  /** 래퍼 폭 — 폼은 옆 버튼과 나눠 갖고(`flex-1`), 모달은 한 줄을 다 쓴다 */
  wrapperClass?: string
}

export function CategorySelect({
  value,
  onChange,
  label,
  emptyLabel = '미분류',
  wrapperClass = 'flex-1 min-w-0',
}: Props) {
  return (
    <div className={`relative ${wrapperClass}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        /* iOS 포커스 줌 방지 — 모바일 노출 select 는 16px 이상 */
        className="w-full appearance-none bg-input border border-line rounded-lg pl-3 pr-8 py-2 text-base sm:text-xs text-text-primary cursor-pointer focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      >
        <option value="">{emptyLabel}</option>
        {CATEGORY_OPTIONS.map(([slug, korean]) => (
          <option key={slug} value={slug}>
            {korean}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-quaternary"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
