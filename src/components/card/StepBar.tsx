import { useState } from 'react'
import type { ApplicationStep } from '@/types/application'

interface StepBarProps {
  steps: ApplicationStep[]
  currentStepIndex: number
  onStepClick?: (index: number) => void
  size?: 'sm' | 'md'
}

export function StepBar({ steps, currentStepIndex, onStepClick, size = 'sm' }: StepBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  if (steps.length === 0) return null

  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const progress = Math.round((currentStepIndex / Math.max(sorted.length - 1, 1)) * 100)

  return (
    <div className="w-full">
      {/* 노드 + 선 */}
      <div className="flex items-center w-full relative">
        {sorted.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          const isLast = i === sorted.length - 1
          const isHovered = hoveredIndex === i

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none relative">
              {/* 툴팁 */}
              {isHovered && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <div className="bg-[#1e1f21] border border-white/12 text-text-primary text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                    {step.name}
                    {isDone && <span className="ml-1.5 text-brand">✓</span>}
                    {isCurrent && <span className="ml-1.5 text-brand">← 현재</span>}
                  </div>
                  <div className="w-1.5 h-1.5 bg-[#1e1f21] border-r border-b border-white/12 rotate-45 mx-auto -mt-1" />
                </div>
              )}

              {/* 노드 */}
              <button
                onClick={() => onStepClick?.(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                disabled={!onStepClick}
                className={`
                  relative flex-none rounded-full transition-all duration-200 flex items-center justify-center
                  ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}
                  ${isDone ? 'bg-brand shadow-[0_0_6px_rgba(94,106,210,0.4)]' : ''}
                  ${isCurrent ? 'bg-brand shadow-[0_0_10px_rgba(94,106,210,0.6)]' : ''}
                  ${!isDone && !isCurrent ? 'bg-white/12 border border-white/8' : ''}
                  ${onStepClick ? 'cursor-pointer hover:scale-125 hover:shadow-[0_0_12px_rgba(94,106,210,0.5)]' : 'cursor-default'}
                `}
              >
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-brand/50 animate-ping" />
                )}
                {isDone && (
                  <svg
                    className="text-white"
                    width={size === 'sm' ? 6 : 8}
                    height={size === 'sm' ? 6 : 8}
                    viewBox="0 0 8 8"
                    fill="none"
                  >
                    <path d="M1 4l2.5 2.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* 연결선 */}
              {!isLast && (
                <div className="flex-1 h-px mx-0.5 rounded-full overflow-hidden bg-white/8">
                  <div
                    className="h-full bg-brand transition-all duration-500 ease-out"
                    style={{ width: i < currentStepIndex ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 현재 단계 + 진행률 */}
      {size === 'sm' && (
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-text-tertiary text-[11px] flex items-center gap-1">
            <span className="text-brand">●</span>
            {sorted[currentStepIndex]?.name ?? '완료'}
          </p>
          <span className="text-text-quaternary text-[11px] font-mono tabular-nums">{progress}%</span>
        </div>
      )}

      {size === 'md' && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-text-secondary text-sm font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand shadow-[0_0_6px_rgba(94,106,210,0.6)] inline-block" />
              현재: {sorted[currentStepIndex]?.name ?? '완료'}
            </p>
            <span className="text-text-tertiary text-xs font-mono tabular-nums bg-white/5 px-2 py-0.5 rounded">{progress}%</span>
          </div>
          {/* 단계 이름 목록 (md에서만) */}
          <div className="flex mt-3 gap-0">
            {sorted.map((step, i) => (
              <div
                key={step.id}
                className={`flex-1 text-center text-[9px] leading-tight px-0.5 truncate font-medium transition-colors
                  ${i === currentStepIndex ? 'text-brand' : ''}
                  ${i < currentStepIndex ? 'text-text-quaternary' : ''}
                  ${i > currentStepIndex ? 'text-white/20' : ''}
                `}
              >
                {step.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
