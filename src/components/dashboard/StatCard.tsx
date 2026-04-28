import { useNavigate } from 'react-router-dom'

interface StatCardProps {
  label: string
  value: number | undefined
  icon: string
  description: string
  filterKey?: string
  accent?: 'brand' | 'success' | 'warning'
  isLoading?: boolean
}

const ACCENT = {
  brand:   { border: 'border-brand/20',   iconBg: 'bg-brand/12 text-brand',    value: 'text-brand',   glow: 'hover:shadow-brand/10' },
  success: { border: 'border-success/20', iconBg: 'bg-success/12 text-success', value: 'text-success', glow: 'hover:shadow-success/10' },
  warning: { border: 'border-warning/20', iconBg: 'bg-warning/12 text-warning', value: 'text-warning', glow: 'hover:shadow-warning/10' },
}

export function StatCard({ label, value, icon, description, filterKey, accent = 'brand', isLoading }: StatCardProps) {
  const navigate = useNavigate()
  const c = ACCENT[accent]

  return (
    <div
      onClick={() => filterKey && navigate(`/board?filter=${filterKey}`)}
      className={`
        bg-surface-2 border ${c.border} rounded-xl p-4 flex flex-col gap-3
        transition-all duration-200
        ${filterKey ? `cursor-pointer hover:brightness-110 hover:shadow-lg ${c.glow}` : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${c.iconBg}`}>
          {icon}
        </span>
        {filterKey && (
          <svg className="text-text-quaternary" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div>
        {isLoading ? (
          <div className="h-8 w-10 bg-white/8 rounded animate-pulse mb-1" />
        ) : (
          <p className={`text-3xl font-bold tabular-nums leading-none ${c.value}`}>{value ?? 0}</p>
        )}
        <p className="text-text-secondary text-xs font-medium mt-1">{label}</p>
      </div>

      <p className="text-text-quaternary text-[10px] leading-relaxed border-t border-white/6 pt-2.5">
        {description}
      </p>
    </div>
  )
}
