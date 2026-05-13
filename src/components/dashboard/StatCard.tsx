import { useDemoNavigate } from '@/hooks/useDemoNavigate'

interface StatCardProps {
  label: string
  value: number | undefined
  icon: string
  description: string
  filterKey?: string
  accent?: 'brand' | 'success' | 'warning' | 'info' | 'neutral'
  isLoading?: boolean
}

const ACCENT = {
  brand:   {
    border:   'border-brand/25',
    iconBg:   'bg-brand/15 text-brand',
    value:    'text-brand',
    glow:     'hover:shadow-brand/12',
    gradient: 'from-brand/10',
    label:    'text-brand/80',
  },
  success: {
    border:   'border-success/25',
    iconBg:   'bg-success/15 text-success',
    value:    'text-success',
    glow:     'hover:shadow-success/12',
    gradient: 'from-success/10',
    label:    'text-success/80',
  },
  warning: {
    border:   'border-warning/25',
    iconBg:   'bg-warning/15 text-warning',
    value:    'text-warning',
    glow:     'hover:shadow-warning/12',
    gradient: 'from-warning/10',
    label:    'text-warning/80',
  },
  info: {
    border:   'border-info/25',
    iconBg:   'bg-info/15 text-info',
    value:    'text-info',
    glow:     'hover:shadow-info/12',
    gradient: 'from-info/10',
    label:    'text-info/80',
  },
  neutral: {
    border:   'border-white/8',
    iconBg:   'bg-white/8 text-text-tertiary',
    value:    'text-text-primary',
    glow:     '',
    gradient: 'from-white/[0.05]',
    label:    'text-text-secondary',
  },
}

export function StatCard({ label, value, icon, description, filterKey, accent = 'brand', isLoading }: StatCardProps) {
  const navigate = useDemoNavigate()
  const c = ACCENT[accent]

  return (
    <div
      onClick={() => filterKey && navigate(`/board?filter=${filterKey}`)}
      className={`
        bg-gradient-to-b ${c.gradient} to-white/[0.04]
        border ${c.border} rounded-xl p-3.5
        transition-all duration-200 flex flex-col gap-2.5
        ${filterKey ? `cursor-pointer hover:brightness-110 hover:shadow-lg ${c.glow}` : ''}
      `}
    >
      {/* 이모지 + 라벨 + 화살표 */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`hidden sm:flex flex-none w-7 h-7 rounded-lg items-center justify-center text-sm ${c.iconBg}`}>
            {icon}
          </span>
          <p className={`text-xs font-semibold truncate ${c.label}`}>{label}</p>
        </div>
        {filterKey && (
          <svg className="flex-none text-text-quaternary/60" width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 숫자 */}
      {isLoading ? (
        <div className="h-8 w-8 bg-white/8 rounded animate-pulse" />
      ) : (
        <p className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none ${c.value}`}>{value ?? 0}</p>
      )}

      {/* 설명 */}
      <p className="hidden sm:block text-text-quaternary text-[10px] leading-relaxed">{description}</p>
    </div>
  )
}
