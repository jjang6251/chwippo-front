/**
 * PR_B2 Phase 4 — inquiry priority 시각 badge.
 */
interface Props {
  priority: 'high' | 'medium' | 'low'
}

const STYLE: Record<Props['priority'], string> = {
  high: 'bg-danger/10 text-danger border-danger/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-info/10 text-info border-info/30',
}

const LABEL: Record<Props['priority'], string> = {
  high: '🔥 high',
  medium: '⚠️ medium',
  low: '◇ low',
}

export function PriorityBadge({ priority }: Props) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STYLE[priority]}`}
    >
      {LABEL[priority]}
    </span>
  )
}
