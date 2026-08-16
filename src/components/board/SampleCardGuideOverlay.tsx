/**
 * W1 — 샘플 카드 hover 시 brand 풍선 + 👆 bounce 화살표 + 1줄 안내.
 * 카드 안내 텍스트는 카드 index 별 분배:
 *   0 → "단계를 클릭해서 진행 상황을 바꿔보세요"
 *   1 → "카드를 클릭해서 회사 정보를 채워보세요"
 *   2+ → "📌 핀 / 메모 / 자소서 모두 한 곳에"
 *
 * CompanyCard 의 wrapper relative + group/sample-card hover 가 이 컴포넌트 표시.
 */

import { MousePointerClick } from 'lucide-react'

const GUIDE_TEXTS = [
  '단계를 클릭해서 진행 상황을 바꿔보세요',
  '카드를 클릭해서 회사 정보를 채워보세요',
  '핀 / 메모 / 자소서 모두 한 곳에',
]

interface Props {
  /** 샘플 카드 순번 (0, 1, 2…) — 안내 텍스트 선택용 */
  index: number
}

export function SampleCardGuideOverlay({ index }: Props) {
  const text = GUIDE_TEXTS[index] ?? GUIDE_TEXTS[2]
  return (
    <div
      className="
        absolute left-1/2 -translate-x-1/2 -bottom-[42px]
        bg-brand text-bg text-xs font-medium
        px-3.5 py-2 rounded-lg whitespace-nowrap
        opacity-0 pointer-events-none
        group-hover/sample-card:opacity-100 group-hover/sample-card:-bottom-[48px]
        transition-all duration-200
        shadow-lg z-10
      "
      aria-hidden="true"
    >
      <MousePointerClick size={13} strokeWidth={1.75} className="inline-block align-[-0.125em] animate-bounce" aria-hidden="true" /> {text}
    </div>
  )
}
