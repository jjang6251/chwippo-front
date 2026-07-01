import { Link } from 'react-router-dom'
import type { DdayItem } from '@/api/dashboard'
import { useDemoMode } from '@/contexts/demoMode'

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

  const iconInitial = event.companyName.charAt(0)

  const bgClass =
    color === 'violet'
      ? 'bg-violet/12 border-violet/25'
      : color === 'warning'
        ? 'bg-warning/15 border-warning/25'
        : color === 'brand'
          ? 'bg-brand/12 border-brand/25'
          : 'bg-info/12 border-info/25'
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
    <Link to={to} className="block rounded-2xl bg-surface border border-line p-4 card-hover">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bgClass}`}>
          <span className={`text-sm font-bold ${textClass}`}>{iconInitial}</span>
        </div>
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
          <p className="text-sm font-bold text-text-primary tracking-tight">{event.companyName}</p>
          {event.stepName && !label.includes(event.stepName) && (
            <p className="text-[10px] text-text-tertiary truncate mt-0.5">{event.stepName}</p>
          )}
        </div>
        <div className="text-right tabular-nums shrink-0">
          <p className="text-[9px] font-medium text-text-quaternary">D-</p>
          <p className={`text-xl font-bold leading-none ${textClass}`}>{event.dday}</p>
        </div>
      </div>
    </Link>
  )
}
