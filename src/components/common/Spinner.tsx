interface SpinnerProps {
  size?: number
  className?: string
}

/**
 * 회전하는 spinner SVG. currentColor 라 부모의 text 색상 상속.
 * Tailwind `animate-spin` 활용.
 */
export function Spinner({ size = 16, className = '' }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
