/**
 * W1 — 샘플 dismiss + 진짜 카드 0건일 때 보드 빈 상태.
 * unDraw 스타일 inline SVG (sage+coral 토큰) + 따뜻한 카피 + brand "+ 첫 회사 추가" CTA.
 */
interface Props {
  /** 클릭 시 AddCardModal open */
  onAddFirst: () => void
}

export function EmptyBoardState({ onAddFirst }: Props) {
  return (
    <div className="text-center py-16 px-8">
      <svg
        viewBox="0 0 200 160"
        className="w-[180px] h-[140px] mx-auto mb-6"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="20"
          y="30"
          width="160"
          height="100"
          rx="10"
          stroke="rgb(var(--brand))"
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity="0.4"
          fill="none"
        />
        <rect
          x="40"
          y="55"
          width="50"
          height="60"
          rx="6"
          fill="rgb(var(--brand))"
          opacity="0.85"
        />
        <line x1="46" y1="68" x2="78" y2="68" stroke="white" strokeWidth="1.5" opacity="0.7" />
        <line x1="46" y1="76" x2="70" y2="76" stroke="white" strokeWidth="1.5" opacity="0.5" />
        <line x1="46" y1="92" x2="84" y2="92" stroke="white" strokeWidth="1" opacity="0.4" />
        <line x1="46" y1="100" x2="78" y2="100" stroke="white" strokeWidth="1" opacity="0.4" />
        <circle cx="125" cy="85" r="22" fill="rgb(var(--accent))" opacity="0.85" />
        <path d="M125 75 v20 M115 85 h20" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <circle cx="175" cy="25" r="4" fill="rgb(var(--accent))" opacity="0.7" />
        <circle cx="15" cy="135" r="3" fill="rgb(var(--brand))" opacity="0.6" />
      </svg>
      <h3 className="text-xl font-bold text-text-primary mb-2 font-display">
        첫 회사를 추가해볼까요?
      </h3>
      <p className="text-[13px] text-text-tertiary mb-6 max-w-[360px] mx-auto leading-relaxed">
        관심 있는 회사부터 가볍게 등록해보세요.
        <br />
        마감일·전형 단계·면접 일정 모두 한 곳에서.
      </p>
      <button
        type="button"
        onClick={onAddFirst}
        className="
          bg-brand hover:bg-accent text-bg
          px-7 py-3 rounded-lg text-sm font-semibold
          transition-colors
        "
      >
        + 첫 회사 추가
      </button>
    </div>
  )
}
