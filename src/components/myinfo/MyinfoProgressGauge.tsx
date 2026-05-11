import { useNavigate } from 'react-router-dom'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'

const RADIUS = 38
const STROKE = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SIZE = (RADIUS + STROKE / 2) * 2

interface Stage {
  color: string
  message: string
}

function getStage(percent: number): Stage {
  if (percent === 100) return { color: 'text-success', message: '🎉 모든 섹션 완성!' }
  if (percent >= 70)   return { color: 'text-brand',   message: '거의 다 왔어요!' }
  if (percent >= 30)   return { color: 'text-warning', message: '절반 왔어요' }
  return                       { color: 'text-danger',  message: '이제 시작!' }
}

export function MyinfoProgressGauge() {
  const navigate = useNavigate()
  const { percent, filled, total, firstEmptyId, isLoading } = useMyinfoProgress()

  const isComplete = percent === 100
  const stage = getStage(percent)
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE

  function handleClick() {
    if (firstEmptyId && !isComplete) {
      const el = document.getElementById(firstEmptyId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }

  if (isLoading) {
    return <div className="h-28 bg-surface-2 border border-white/6 rounded-xl animate-pulse" />
  }

  return (
    <div
      onClick={handleClick}
      role={!isComplete && firstEmptyId ? 'button' : undefined}
      tabIndex={!isComplete && firstEmptyId ? 0 : undefined}
      onKeyDown={(e) => { if (!isComplete && firstEmptyId && (e.key === 'Enter' || e.key === ' ')) handleClick() }}
      aria-label={`내 정보 작성 완성도 ${percent}%`}
      className={`bg-surface-2 border border-white/6 rounded-xl p-4 flex items-center gap-4 transition-all ${!isComplete && firstEmptyId ? 'hover:border-white/12 hover:bg-[#1d1e20] cursor-pointer' : ''}`}
    >
      {/* 원형 게이지 */}
      <div className="relative flex-none" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`내 정보 작성 완성도 ${percent}%`}
          className={`${stage.color} transition-colors duration-300`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold font-mono tabular-nums ${stage.color}`}>{percent}<span className="text-sm">%</span></span>
        </div>
      </div>

      {/* 우측 텍스트 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold mb-1 ${stage.color}`}>{stage.message}</p>
        <p className="text-text-tertiary text-xs">
          <span className="font-mono tabular-nums">{filled}</span> / <span className="font-mono tabular-nums">{total}</span> 섹션 작성
        </p>
        {!isComplete && firstEmptyId && (
          <p className="text-text-quaternary text-[11px] mt-1.5">탭해서 비어있는 섹션으로 이동</p>
        )}
      </div>
    </div>
  )
}
