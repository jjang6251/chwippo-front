import { useEffect, useState } from 'react'

/**
 * PR_B2 Phase 4 — inquiry SLA countdown.
 *
 * deadline 까지 남은 시간 표시. overdue 시 빨간색 + "초과" 표기.
 * 30s 마다 갱신.
 */
interface Props {
  deadlineAt: string | null
}

function formatRemaining(ms: number): { label: string; overdue: boolean } {
  const overdue = ms < 0
  const abs = Math.abs(ms)
  const hours = Math.floor(abs / 3600000)
  const minutes = Math.floor((abs % 3600000) / 60000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return {
      label: `${overdue ? '+' : ''}${days}일 ${hours % 24}시간`,
      overdue,
    }
  }
  return {
    label: `${overdue ? '+' : ''}${hours}시간 ${minutes}분`,
    overdue,
  }
}

export function SlaCountdown({ deadlineAt }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  if (!deadlineAt) {
    return (
      <span className="text-text-quaternary text-[10px]">처리 기한 없음</span>
    )
  }

  const remaining = new Date(deadlineAt).getTime() - now
  const { label, overdue } = formatRemaining(remaining)

  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
        overdue
          ? 'text-danger bg-danger/10'
          : remaining < 3 * 3600000
            ? 'text-warning bg-warning/10'
            : 'text-text-tertiary'
      }`}
      title={
        overdue
          ? `처리 기한 초과 — ${new Date(deadlineAt).toLocaleString('ko-KR')}`
          : `처리 기한 남음 — ${new Date(deadlineAt).toLocaleString('ko-KR')}`
      }
    >
      {overdue ? '⏱ 초과 ' : '⏱ '}
      {label}
    </span>
  )
}
