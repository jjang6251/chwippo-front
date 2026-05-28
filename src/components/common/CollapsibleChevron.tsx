/**
 * F6 PR 2 Phase 4 UX — collapsible 토글용 공용 chevron.
 *
 * **표준** (memory `feedback_collapsible_chevron`):
 * - select chevron 과 동일한 12x12 viewBox SVG path
 * - text-text-quaternary 색 (currentColor)
 * - closed = `rotate-[-90deg]` (▸ 모양), open = default (▾ 모양)
 * - transition-transform 으로 부드러운 회전
 *
 * 사용: collapsible 카드·섹션 헤더의 펼침/접힘 인디케이터.
 * select 의 native chevron 대체에는 `<select>` 의 absolute SVG 그대로 사용 (memory `feedback_select_chevron`).
 */
export function CollapsibleChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-text-quaternary transition-transform ${open ? '' : '-rotate-90'}`}
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
  )
}
