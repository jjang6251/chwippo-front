import dayjs from 'dayjs'

/**
 * 캘린더 UX 재구성 — 아젠다 날짜 그룹 헤더.
 *
 * "4월 30일 화요일 · 오늘"  [+ 버튼]
 * 오늘 · D-N · D+N · 지난 날짜 상황별 배지 표시
 */
interface Props {
  date: string
  isToday: boolean
  onAdd?: () => void
}

const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

export function AgendaDateHeader({ date, isToday, onAdd }: Props) {
  const d = dayjs(date)
  const today = dayjs().startOf('day')
  const dday = d.startOf('day').diff(today, 'day')
  const monthDay = `${d.month() + 1}월 ${d.date()}일`
  const dayLabel = KO_DAYS[d.day()]

  const ddayBadge = isToday ? (
    <span className="text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 rounded-md px-1.5 py-0.5">
      오늘
    </span>
  ) : dday > 0 ? (
    <span className="text-[10px] font-medium text-text-tertiary tabular-nums">D-{dday}</span>
  ) : (
    <span className="text-[10px] font-medium text-text-quaternary tabular-nums">D+{Math.abs(dday)}</span>
  )

  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-baseline gap-2">
        <span className={`text-sm font-bold tracking-tight ${isToday ? 'text-text-primary' : 'text-text-secondary'}`}>
          {monthDay}
        </span>
        <span className="text-[11px] text-text-tertiary">{dayLabel}</span>
        {ddayBadge}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label={`${monthDay}에 일정 추가`}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface text-text-quaternary hover:text-text-secondary transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
