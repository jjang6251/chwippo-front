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
  /** U28 — 날짜 영역 탭: 모바일 시트 열기 / 데스크탑 선택일 변경 */
  onSelect?: () => void
  /** U10+ — T 단축키 피드백: 값이 바뀔 때마다 오늘 배지 펄스 재생 (isToday 일 때만 사용) */
  pulse?: number
}

const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

export function AgendaDateHeader({ date, isToday, onAdd, onSelect, pulse = 0 }: Props) {
  const d = dayjs(date)
  const today = dayjs().startOf('day')
  const dday = d.startOf('day').diff(today, 'day')
  const monthDay = `${d.month() + 1}월 ${d.date()}일`
  const dayLabel = KO_DAYS[d.day()]

  const ddayBadge = isToday ? (
    // key={pulse} — T 단축키마다 remount 로 펄스 애니메이션 재생
    <span
      key={pulse}
      className={`text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 rounded-md px-1.5 py-0.5 ${pulse > 0 ? 'animate-today-pulse' : ''}`}
    >
      오늘
    </span>
  ) : dday > 0 ? (
    <span className="text-[10px] font-medium text-text-tertiary tabular-nums">D-{dday}</span>
  ) : (
    <span className="text-[10px] font-medium text-text-quaternary tabular-nums">D+{Math.abs(dday)}</span>
  )

  const dateInfo = (
    <>
      <span className={`text-sm font-bold tracking-tight ${isToday ? 'text-text-primary' : 'text-text-secondary'}`}>
        {monthDay}
      </span>
      <span className="text-[11px] text-text-tertiary">{dayLabel}</span>
      {ddayBadge}
    </>
  )

  return (
    <div className="flex items-center justify-between mb-2.5">
      {/* U28 — onSelect 있으면 날짜 영역이 탭 가능 (button), 없으면 정적 표시 */}
      {onSelect ? (
        <button
          onClick={onSelect}
          aria-label={`${monthDay} 상세 보기`}
          className="flex items-baseline gap-2 text-left rounded hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          {dateInfo}
        </button>
      ) : (
        <div className="flex items-baseline gap-2">{dateInfo}</div>
      )}
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label={`${monthDay}에 일정 추가`}
          className="w-11 h-11 -mr-2 flex items-center justify-center rounded-md hover:bg-surface text-text-quaternary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
