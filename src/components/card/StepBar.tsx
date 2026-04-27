import type { ApplicationStep } from '@/types/application'

interface StepBarProps {
  steps: ApplicationStep[]
  currentStepIndex: number
  onStepClick?: (index: number) => void
  size?: 'sm' | 'md'
}

export function StepBar({ steps, currentStepIndex, onStepClick, size = 'sm' }: StepBarProps) {
  if (steps.length === 0) return null

  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const progress = Math.round((currentStepIndex / (sorted.length - 1)) * 100)

  return (
    <div className="w-full">
      {/* 노드 + 선 */}
      <div className="flex items-center w-full">
        {sorted.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          const isLast = i === sorted.length - 1

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* 노드 */}
              <button
                onClick={() => onStepClick?.(i)}
                disabled={!onStepClick}
                title={step.name}
                className={`
                  relative flex-none rounded-full transition-all duration-200
                  ${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}
                  ${isDone ? 'bg-brand' : ''}
                  ${isCurrent ? 'bg-brand ring-2 ring-brand/40 ring-offset-1 ring-offset-surface-2' : ''}
                  ${!isDone && !isCurrent ? 'bg-white/15' : ''}
                  ${onStepClick ? 'cursor-pointer hover:scale-125' : 'cursor-default'}
                `}
              >
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-50" />
                )}
                {isDone && size === 'md' && (
                  <svg className="absolute inset-0 w-full h-full p-0.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* 연결선 */}
              {!isLast && (
                <div className="flex-1 h-px mx-0.5">
                  <div
                    className={`h-full transition-all duration-300 ${i < currentStepIndex ? 'bg-brand' : 'bg-white/10'}`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 진행률 + 현재 스텝명 */}
      {size === 'sm' && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-text-tertiary text-[11px]">
            📍 {sorted[currentStepIndex]?.name ?? '완료'}
          </p>
          <span className="text-text-quaternary text-[11px] font-mono">{progress}%</span>
        </div>
      )}

      {size === 'md' && (
        <div className="mt-3">
          {/* 레이블 */}
          <div className="flex justify-between px-0">
            {sorted.map((step, i) => (
              <div
                key={step.id}
                className={`flex-1 text-center text-[10px] leading-tight px-0.5 truncate
                  ${i === currentStepIndex ? 'text-brand font-medium' : ''}
                  ${i < currentStepIndex ? 'text-text-tertiary' : ''}
                  ${i > currentStepIndex ? 'text-text-quaternary' : ''}
                  ${i === sorted.length - 1 ? 'flex-none' : ''}
                `}
              >
                {step.name}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-text-secondary text-xs font-medium">
              📍 현재: {sorted[currentStepIndex]?.name ?? '완료'}
            </p>
            <span className="text-text-tertiary text-xs font-mono">{progress}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
