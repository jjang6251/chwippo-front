import { useNavigate } from 'react-router-dom'
import { useApplications } from '@/hooks/useApplications'
import { sortApplications } from '@/utils/sortApplications'
import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'
import { getAvatarColor } from '@/utils/tags'
import type { Application } from '@/types/application'

const VARIANT_CLASS = {
  danger:  'text-danger',
  warning: 'text-warning',
  info:    'text-brand',
  muted:   'text-text-quaternary',
}

function getCurrentStepInfo(app: Application) {
  const sorted = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sorted[app.currentStepIndex]
  return {
    name: currentStep?.name ?? null,
    scheduledDate: currentStep?.scheduledDate ?? null,
  }
}

export function TopApplicationsSection() {
  const navigate = useNavigate()
  const { data: applications = [], isLoading } = useApplications()

  const starred = applications.filter((a) => a.isStarred && a.status !== 'FAILED')
  const sorted = sortApplications(starred).slice(0, 5)

  return (
    <section>
      <h2 className="text-text-primary text-base font-semibold mb-3">⭐ 관심 지원</h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-2 border border-white/6 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center gap-2">
          <p className="text-2xl">⭐</p>
          <p className="text-text-tertiary text-xs">즐겨찾기한 카드가 없어요</p>
          <button
            onClick={() => navigate('/board')}
            className="mt-1 text-[11px] text-brand hover:text-accent transition-colors"
          >
            보드에서 ⭐를 눌러 추가하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((app) => {
            const { name: stepName, scheduledDate } = getCurrentStepInfo(app)
            const dday = scheduledDate ? calcDday(scheduledDate) : null
            const variant = dday !== null ? getDdayVariant(dday) : 'muted'
            const avatarColor = getAvatarColor(app.companyName)

            return (
              <button
                key={app.id}
                onClick={() => navigate(`/board/${app.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-white/6 hover:border-white/12 hover:bg-[#1d1e20] transition-all text-left"
              >
                <div className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${avatarColor}`}>
                  {app.companyName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary text-xs font-medium truncate">{app.companyName}</p>
                  <p className="text-text-quaternary text-[10px] truncate">
                    {app.status === 'PASSED' ? '🎉 최종 합격' : stepName ?? '단계 미설정'}
                  </p>
                </div>
                {dday !== null && app.status !== 'PASSED' && (
                  <span className={`text-xs font-mono font-semibold flex-none ${VARIANT_CLASS[variant]}`}>
                    {getDdayLabel(dday)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
