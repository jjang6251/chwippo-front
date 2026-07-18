import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/authStore'
import { useDemoMode } from '@/contexts/demoMode'
import { useCalendarEvents } from '@/hooks/useCalendar'
import { useDdayList } from '@/hooks/useDashboard'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator'
import { CalendarAgendaView } from '@/components/calendar/CalendarAgendaView'
import { CalendarMonthlyGrid } from '@/components/calendar/CalendarMonthlyGrid'
import { CalendarSideMinimap } from '@/components/calendar/CalendarSideMinimap'
import { CalendarDayPanel } from '@/components/calendar/CalendarDayPanel'
import { CalendarDaySheet } from '@/components/calendar/CalendarDaySheet'
import { CountdownHeroLarge } from '@/components/calendar/CountdownHeroLarge'
import { TodayBriefingBanner } from '@/components/calendar/TodayBriefingBanner'
import { CountdownPillCard } from '@/components/calendar/CountdownPillCard'
import { EmptyDeadlineHero } from '@/components/calendar/EmptyDeadlineHero'
import { AddEventSheet } from '@/components/calendar/AddEventSheet'

type CalendarView = 'agenda' | 'month'
const VIEW_STORAGE_KEY = 'calendar-view'

const KO_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** URL param + localStorage 하이브리드로 초기 view 결정 */
function resolveInitialView(urlParam: string | null): CalendarView {
  if (urlParam === 'month') return 'month'
  if (urlParam === 'agenda') return 'agenda'
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null
  if (saved === 'month') return 'month'
  return 'agenda'
}

export function Calendar() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const isMobile = useIsMobile()
  const isDemo = useDemoMode()

  const [searchParams, setSearchParams] = useSearchParams()
  const urlView = searchParams.get('view')
  const [view, setViewState] = useState<CalendarView>(() => resolveInitialView(urlView))

  const today = dayjs().startOf('day')
  const todayStr = today.format('YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [starOnly, setStarOnly] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetDate, setAddSheetDate] = useState<string>(todayStr)
  // U1 — 모바일 날짜 상세 바텀시트
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null)

  // 이번 달 이벤트 (사이드 미니맵 + 월별 그리드 공유)
  const monthYear = today.year()
  const monthNum = today.month() + 1
  const { data: monthlyEvents = [] } = useCalendarEvents(monthYear, monthNum)

  // 아젠다: 오늘부터 D+30 커버 → 다음 달 겹칠 수 있으니 다음 달도 요청
  const nextCursor = today.add(1, 'month')
  const { data: nextMonthEvents = [] } = useCalendarEvents(
    nextCursor.year(),
    nextCursor.month() + 1,
  )

  // 아젠다 이벤트 = 이번 달 + 다음 달 (중복 제거 필요 없음 · API 는 월별 분리)
  const agendaEvents = useMemo(
    () => [...monthlyEvents, ...nextMonthEvents],
    [monthlyEvents, nextMonthEvents],
  )

  // Hero 데이터
  const { data: ddayList = [] } = useDdayList()
  const { data: streak } = useDashboardStreak()
  const streakDays = streak?.streak.current

  const heroEvent = ddayList[0]
  const pillEvents = ddayList.slice(1, 3)
  const hasCards = ddayList.length > 0 // TODO: card count endpoint 별도 필요할 수 있음

  const pull = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['dashboard', 'dday'] }),
    ])
  })

  function setView(next: CalendarView) {
    setViewState(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'month') params.set('view', 'month')
        else params.delete('view') // default agenda 는 URL 에 안 남김
        return params
      },
      { replace: true },
    )
  }

  function handleAddOnDate(date: string) {
    // 날짜 시트가 열려 있으면 닫고 추가 시트로 전환 (드로어 중첩 방지)
    setDaySheetOpen(false)
    setAddSheetDate(date)
    setAddSheetOpen(true)
  }

  // U8·U9·U28 — 날짜 선택: 모바일 = 상세 시트 열기 / 데스크탑 = 사이드 패널 선택일 변경
  function handleSelectDate(date: string) {
    setSelectedDate(date)
    if (isMobile) {
      setDaySheetDate(date)
      setDaySheetOpen(true)
    }
  }

  // Fantastical-style 헤더 날짜 표시
  const dateHeader = (
    <div>
      <p className="text-[11px] text-text-quaternary tabular-nums mb-1">{today.year()}</p>
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">
        {today.month() + 1}월 {today.date()}일{' '}
        <span className="text-text-tertiary font-medium">{KO_DAYS[today.day()]}</span>
      </h1>
    </div>
  )

  // 인사말 + 요약
  const thisWeekStart = (() => {
    const day = today.day()
    const daysFromMonday = day === 0 ? 6 : day - 1
    return today.subtract(daysFromMonday, 'day').startOf('day')
  })()
  const thisWeekEnd = thisWeekStart.add(6, 'day')
  const thisWeekDeadlineCount = agendaEvents.filter((e) => {
    if (e.type !== 'step') return false
    const stepName = e.stepName ?? ''
    if (!/서류|공채|자소서|지원/.test(stepName)) return false
    const d = dayjs(e.date)
    return !d.isBefore(thisWeekStart) && !d.isAfter(thisWeekEnd)
  }).length

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <PullToRefreshIndicator {...pull} />

      {/* Header */}
      <header className="flex items-end justify-between mb-4">
        {dateHeader}
        <div className="flex items-center gap-2">
          <button
            aria-pressed={starOnly}
            onClick={() => setStarOnly((v) => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
              starOnly
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-line text-text-tertiary hover:text-text-secondary hover:border-line-strong'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-warning">
              <path d="M8 1.5l2 4.5 5 .5-3.7 3.3.9 5-4.2-2.5-4.2 2.5.9-5L1 6.5l5-.5z" fill={starOnly ? 'currentColor' : 'none'} />
            </svg>
            <span className="hidden sm:inline">즐겨찾기만</span>
          </button>
          <button
            onClick={() => {
              setAddSheetDate(todayStr)
              setAddSheetOpen(true)
            }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand hover:bg-brand-hover text-bg text-xs font-bold transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            일정 추가
          </button>
        </div>
      </header>

      {/* Summary bar — M3: 좁은 폭에서 wrap 허용 + 닉네임 truncate + "회고 보기" 항상 온전 노출 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 mb-5 rounded-xl border border-line bg-surface">
        <p className="min-w-0 text-xs text-text-secondary">
          <span className="inline-block max-w-[8rem] truncate align-bottom text-base font-bold text-brand tracking-tight">
            {user?.nickname ?? '재원'}
          </span>
          님, 이번 주 마감{' '}
          <span className="text-warning font-semibold tabular-nums">{thisWeekDeadlineCount}건</span>
          이에요.
        </p>
        {monthlyEvents.length > 0 && (
          <>
            <span className="w-px h-3 bg-line-strong shrink-0" />
            <p className="text-[11px] text-text-tertiary shrink-0">
              이번 달 <span className="text-text-secondary tabular-nums">{monthlyEvents.length}건</span>
            </p>
          </>
        )}
        <a
          href={isDemo ? '/demo/dashboard' : '/dashboard'}
          className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-brand hover:text-brand-hover"
        >
          회고 보기 →
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-0.5 bg-surface border border-line rounded-lg p-0.5">
          <button
            onClick={() => setView('agenda')}
            className={`h-8 px-4 text-xs rounded-md transition-colors ${
              view === 'agenda'
                ? 'font-semibold bg-surface-3 text-text-primary shadow-sm'
                : 'font-medium text-text-quaternary hover:text-text-secondary'
            }`}
          >
            아젠다
          </button>
          <button
            onClick={() => setView('month')}
            className={`h-8 px-4 text-xs rounded-md transition-colors ${
              view === 'month'
                ? 'font-semibold bg-surface-3 text-text-primary shadow-sm'
                : 'font-medium text-text-quaternary hover:text-text-secondary'
            }`}
          >
            월별
          </button>
        </div>
      </div>

      {view === 'agenda' ? (
        <div className={isMobile ? '' : 'grid grid-cols-[1fr_320px] gap-8'}>
          {/* Main — Agenda */}
          <div>
            {/* A7 — 오늘 브리핑 진입점 (오늘 브리핑 알림 있을 때만) */}
            <TodayBriefingBanner />

            {/* 임박한 일정 */}
            <div className="mb-3">
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                임박한 일정
              </h2>
            </div>

            {heroEvent ? (
              <>
                <div className="mb-3">
                  <CountdownHeroLarge event={heroEvent} streakDays={streakDays} />
                </div>
                {pillEvents.length > 0 && (
                  <div className={`mb-10 gap-3 ${pillEvents.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2' : 'grid grid-cols-1'}`}>
                    {pillEvents.map((e) => (
                      <CountdownPillCard
                        key={(e.stepId ?? e.examId ?? '') + e.date}
                        event={e}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : hasCards ? (
              <div className="mb-10">
                <EmptyDeadlineHero />
              </div>
            ) : (
              // 완전 empty state — 지원 카드도 없음
              <div className="mb-10">
                <EmptyDeadlineHero />
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                다가오는 일정
              </h2>
            </div>

            <CalendarAgendaView
              events={agendaEvents}
              starOnly={starOnly}
              onAddOnDate={handleAddOnDate}
              onSelectDate={handleSelectDate}
            />
          </div>

          {/* Side — desktop only */}
          {!isMobile && (
            <aside className="sticky top-6 h-fit space-y-3">
              <CalendarSideMinimap
                events={agendaEvents}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onToday={() => setSelectedDate(todayStr)}
              />
              <div className="rounded-2xl bg-surface border border-line overflow-hidden">
                <CalendarDayPanel
                  date={selectedDate}
                  events={agendaEvents.filter((e) => e.date === selectedDate)}
                />
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className={isMobile ? '' : 'grid grid-cols-[1fr_320px] gap-8'}>
          <div>
            {/* A7 — 오늘 브리핑 진입점 (아젠다 뷰와 동일 — 뷰 상관없이 노출) */}
            <TodayBriefingBanner />
            <CalendarMonthlyGrid
              events={agendaEvents}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onToday={() => setSelectedDate(todayStr)}
            />
          </div>
          {!isMobile && (
            <aside className="sticky top-6 h-fit space-y-3">
              <div className="rounded-2xl bg-surface border border-line overflow-hidden">
                <CalendarDayPanel
                  date={selectedDate}
                  events={agendaEvents.filter((e) => e.date === selectedDate)}
                />
              </div>
            </aside>
          )}
        </div>
      )}

      {/* U1 — 모바일 날짜 상세 시트 (isMobile 에서만 열림) */}
      <CalendarDaySheet
        open={daySheetOpen}
        date={daySheetDate}
        events={daySheetDate ? agendaEvents.filter((e) => e.date === daySheetDate) : []}
        onClose={() => setDaySheetOpen(false)}
        onAddOnDate={handleAddOnDate}
      />

      <AddEventSheet
        open={addSheetOpen}
        defaultDate={addSheetDate}
        onClose={() => setAddSheetOpen(false)}
      />

      {/* Footer 단축키 힌트 (데스크탑만) */}
      {!isMobile && (
        <footer className="mt-16 flex items-center justify-between text-[10px] text-text-quaternary">
          <span className="tabular-nums">KST · {today.format('YYYY년 M월 D일')}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[10px]">T</kbd>
              오늘
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[10px]">N</kbd>
              새 일정
            </span>
          </span>
        </footer>
      )}
    </div>
  )
}
