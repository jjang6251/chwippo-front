import { Link } from 'react-router-dom'
import type { DdayItem } from '@/api/dashboard'
import { useDemoMode } from '@/contexts/demoMode'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'

/**
 * 캘린더 UX 재구성 — supporting pill 카드 (Hero 아래 2장).
 *
 * dday_asc[1..2] 노출. Hero 보다 컴팩트.
 */
interface Props {
  event: DdayItem
}

export function CountdownPillCard({ event }: Props) {
  const isDemo = useDemoMode()

  const isExam = event.type === 'exam'
  const stepName = event.stepName ?? ''
  const isDoc = /서류|공채|자소서|지원/.test(stepName)
  const isInterview = /면접/.test(stepName)

  // 종류별 색
  const color = isExam
    ? 'violet'
    : isDoc
      ? 'warning'
      : isInterview
        ? 'brand'
        : 'info'
  const label = isExam ? '시험' : isDoc ? '서류 마감' : isInterview ? '면접' : stepName

  const borderColor =
    color === 'violet'
      ? 'border-violet/25'
      : color === 'warning'
        ? 'border-warning/25'
        : color === 'brand'
          ? 'border-brand/25'
          : 'border-info/25'
  const textClass =
    color === 'violet'
      ? 'text-violet'
      : color === 'warning'
        ? 'text-warning'
        : color === 'brand'
          ? 'text-brand'
          : 'text-info'

  const rawTo = isExam
    ? '/myinfo#exam-schedules'
    : `/board/${event.applicationId ?? ''}`
  const to = isDemo ? '/demo' + rawTo : rawTo

  return (
    <Link to={to} className="block rounded-2xl bg-surface border border-line p-4 transition-colors hover:bg-card-hover">
      <div className="flex items-center gap-3">
        <CompanyAvatar
          name={event.companyName}
          domain={event.domain}
          size="md"
          className={`border ${borderColor}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-medium ${textClass}`}>{label}</span>
            {event.scheduledTime && (
              <>
                <span className="text-[10px] text-text-quaternary">·</span>
                <span className="text-[10px] text-text-quaternary tabular-nums">
                  {event.scheduledTime}
                </span>
              </>
            )}
          </div>
          <p className="text-sm font-bold text-text-primary tracking-tight truncate">{event.companyName}</p>
          {event.stepName && !label.includes(event.stepName) && (
            <p className="text-[10px] text-text-tertiary truncate mt-0.5">{event.stepName}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {event.dday === 0 ? (
            <p className={`text-lg font-bold leading-none ${textClass}`}>D-DAY</p>
          ) : (
            <p className={`text-2xl font-bold leading-none tabular-nums tracking-[-0.05em] ${textClass}`}>
              D{event.dday > 0 ? '-' : '+'}{Math.abs(event.dday)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
