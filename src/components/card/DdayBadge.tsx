import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'

interface DdayBadgeProps {
  deadline: string
}

const variantClass: Record<string, string> = {
  danger: 'text-danger bg-danger/10 border-danger/25',
  warning: 'text-warning bg-warning/10 border-warning/25',
  info: 'text-brand bg-brand/10 border-brand/25',
  muted: 'text-text-quaternary bg-white/5 border-white/10',
}

export function DdayBadge({ deadline }: DdayBadgeProps) {
  const dday = calcDday(deadline)
  const variant = getDdayVariant(dday)

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-mono font-semibold ${variantClass[variant]}`}>
      {getDdayLabel(dday)}
    </span>
  )
}
