import { useState } from 'react'
import type { ApplicationStep, ApplicationStatus } from '@/types/application'

interface StepBarProps {
  steps: ApplicationStep[]
  currentStepIndex: number
  status?: ApplicationStatus
  onStepClick?: (index: number) => void
  onStepNameClick?: (stepId: string) => void
  size?: 'sm' | 'md'
}

function ProgressBar({ progress, isPassed, height = 'h-1.5' }: { progress: number; isPassed?: boolean; height?: string }) {
  return (
    <div
      className={`w-full bg-white/5 rounded-full overflow-hidden ${height}`}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={isPassed ? '최종 합격' : `진행률 ${progress}%`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${isPassed ? 'bg-success' : 'bg-brand'}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function StepBar({ steps, currentStepIndex, status, onStepClick, onStepNameClick, size = 'sm' }: StepBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  if (steps.length === 0) return null

  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const progress = Math.round((currentStepIndex / Math.max(sorted.length - 1, 1)) * 100)
  const nodeSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const checkSize = size === 'sm' ? 6 : 8

  return (
    <div className="w-full">
      {/* ── 노드 행 ──
          모든 셀: [flex-1 왼쪽] [노드] [flex-1 오른쪽]
          첫/마지막 셀의 바깥쪽 spacer는 투명(invisible)하게만 처리 → 노드가 모든 셀 정중앙 고정 */}
      <div className="flex">
        {sorted.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          const isFirst = i === 0
          const isLast = i === sorted.length - 1
          const isHovered = hoveredIndex === i

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">

                {/* 왼쪽: 첫 셀은 투명 spacer, 나머지는 실제 연결선 */}
                <div className="flex-1 flex items-center">
                  {!isFirst && (
                    <div className="w-full h-px overflow-hidden bg-white/8">
                      <div
                        className="h-full bg-brand transition-all duration-500 ease-out"
                        style={{ width: i <= currentStepIndex ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>

                {/* 노드 + 툴팁 */}
                <div className="relative shrink-0">
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
                  <button
                    {...(i === currentStepIndex + 1 ? { 'data-tour': 'step-node-next' } : {})}
                    onClick={() => onStepClick?.(i)}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    disabled={!onStepClick}
                    aria-label={`${step.name}${isDone ? ' (완료)' : isCurrent ? ' (현재)' : ''}`}
                    className={`
                      relative flex-none rounded-full transition-all duration-200 flex items-center justify-center
                      ${nodeSize}
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
                      <svg className="text-text-primary" width={checkSize} height={checkSize} viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2.5 2.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* 오른쪽: 마지막 셀은 투명 spacer, 나머지는 실제 연결선 */}
                <div className="flex-1 flex items-center">
                  {!isLast && (
                    <div className="w-full h-px overflow-hidden bg-white/8">
                      <div
                        className="h-full bg-brand transition-all duration-500 ease-out"
                        style={{ width: i < currentStepIndex ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {/* ── 스텝명 레이블 (sm + md 공통) ──
          flex-1 + overflow-hidden truncate → 노드 간격만큼 잘리고 ... 처리 */}
      <div className="flex mt-2">
        {sorted.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          return (
            <button
              key={step.id}
              onClick={(e) => { e.stopPropagation(); onStepNameClick?.(step.id) }}
              disabled={!onStepNameClick}
              title={step.name}
              className={`
                flex-1 min-w-0 text-center overflow-hidden text-ellipsis whitespace-nowrap
                leading-tight px-0.5 py-0.5 rounded transition-all duration-150
                ${size === 'sm' ? 'text-[8px]' : 'text-[9px] font-medium'}
                ${isCurrent ? 'text-brand' : ''}
                ${isDone ? 'text-text-quaternary' : ''}
                ${!isDone && !isCurrent ? 'text-white/25' : ''}
                ${onStepNameClick
                  ? 'cursor-pointer hover:bg-white/8 hover:text-text-primary'
                  : 'cursor-default'
                }
              `}
            >
              {step.name}
            </button>
          )
        })}
      </div>

      {/* ── sm 하단: 현재 단계 + 진행률 바 ── */}
      {size === 'sm' && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-text-quaternary text-[10px] truncate">
              현재:{' '}
              <span className="text-text-secondary font-medium">
                {sorted[currentStepIndex]?.name ?? '완료'}
              </span>
            </span>
            <span className="text-text-secondary text-[10px] font-mono font-semibold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>
          <ProgressBar progress={progress} isPassed={status === 'PASSED'} height="h-1.5" />
        </div>
      )}

      {/* ── md 하단: 현재 단계 + % + 진행률 바 ── */}
      {size === 'md' && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const cur = sorted[currentStepIndex]
                if (cur && onStepNameClick) onStepNameClick(cur.id)
              }}
              disabled={!onStepNameClick}
              className={`flex items-center gap-1.5 group/cur ${onStepNameClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="w-2 h-2 rounded-full bg-brand shadow-[0_0_6px_rgba(94,106,210,0.6)] inline-block shrink-0" />
              <span
                className={`text-text-secondary text-sm font-medium transition-colors ${
                  onStepNameClick ? 'group-hover/cur:text-text-primary group-hover/cur:underline underline-offset-2' : ''
                }`}
              >
                현재: {sorted[currentStepIndex]?.name ?? '완료'}
              </span>
            </button>
            <span className="text-text-secondary text-sm font-mono font-semibold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>
          <ProgressBar progress={progress} isPassed={status === 'PASSED'} height="h-2" />
        </div>
      )}
    </div>
  )
}
