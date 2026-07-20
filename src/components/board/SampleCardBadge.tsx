/**
 * W1 — 샘플 카드 우상단의 "📌 샘플" 작은 warning 배지.
 * CompanyCard 안에서 사용 (isSample=true 일 때만 렌더).
 */
import { Pin } from 'lucide-react'

export function SampleCardBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 border border-warning/30 px-2 py-[2px] rounded">
      <Pin size={11} strokeWidth={2} aria-hidden="true" /> 샘플
    </span>
  )
}
