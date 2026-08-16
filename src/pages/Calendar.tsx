import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { todayLocal } from '@/utils/datetime'
import { useAuthStore } from '@/stores/authStore'
import { useDemoMode } from '@/contexts/demoMode'
import { useCalendarEvents } from '@/hooks/useCalendar'
import { useApplications } from '@/hooks/useApplications'
import { useDdayList } from '@/hooks/useDashboard'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator'
import { CalendarAgendaView } from '@/components/calendar/CalendarAgendaView'
import { CalendarMonthlyGrid } from '@/components/calendar/CalendarMonthlyGrid'
import { CalendarSideMinimap } from '@/components/calendar/CalendarSideMinimap'
import { CalendarDayPanel } from '@/components/calendar/CalendarDayPanel'
import { DayDetailContent } from '@/components/calendar/DayDetailContent'
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

  // U4 — 로컬 TZ 의존 제거: '오늘'은 KST 기준 (todayLocal). date-only 로직이라
  // KST 날짜 문자열을 dayjs 로 파싱해 시작점만 고정 (시간 성분 불필요).
  const todayStr = todayLocal()
  const today = dayjs(todayStr)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  // 6c — 모바일 월별: 날짜 탭 시 인라인 상세가 그리드 아래(화면 밖)라 사용자 탭에만 스크롤 유도 (초기 로드 제외)
  const inlineDayRef = useRef<HTMLDivElement>(null)
  const scrollInlineIntoView = () => {
    requestAnimationFrame(() => {
      inlineDayRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }
  const [starOnly, setStarOnly] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetDate, setAddSheetDate] = useState<string>(todayStr)
  // U1 — 모바일 날짜 상세 바텀시트
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null)

  // 이번 달 이벤트 (사이드 미니맵 + 월별 그리드 공유)
  const monthYear = today.year()
  const monthNum = today.month() + 1
  const monthlyQuery = useCalendarEvents(monthYear, monthNum)

  // 아젠다: 오늘부터 D+30 커버 → 다음 달 겹칠 수 있으니 다음 달도 요청
  const nextCursor = today.add(1, 'month')
  const nextMonthQuery = useCalendarEvents(nextCursor.year(), nextCursor.month() + 1)

  // 아젠다 이벤트 = 이번 달 + 다음 달 (중복 제거 필요 없음 · API 는 월별 분리)
  const agendaEvents = useMemo(
    () => [...(monthlyQuery.data ?? []), ...(nextMonthQuery.data ?? [])],
    [monthlyQuery.data, nextMonthQuery.data],
  )
  const monthlyEvents = monthlyQuery.data ?? []

  // Hero 데이터
  const ddayQuery = useDdayList()
  const ddayList = ddayQuery.data ?? []
  // streak 은 보조 데이터 — 실패해도 배지만 숨기고 페이지는 정상 (U2). 에러 게이트 제외.
  const streakQuery = useDashboardStreak()
  const streakDays = streakQuery.data?.streak.current

  // F10 — hasCards 는 기존 지원 카드 목록(useApplications) 재사용 판정 (신규 endpoint 없음)
  // 목록 조회 실패 시엔 true 로 폴백 — 기존 유저에게 온보딩 empty 를 오노출하지 않는 안전한 기본값
  const applicationsQuery = useApplications()
  const hasCards = applicationsQuery.isError
    ? true
    : (applicationsQuery.data?.length ?? 0) > 0

  const heroEvent = ddayList[0]
  const pillEvents = ddayList.slice(1, 3)

  // U2 — false-empty flash 제거: 주 데이터(이벤트·D-day·카드 목록) 초기 로딩·에러 게이팅.
  //  - 로딩 중엔 스켈레톤만 (EmptyDeadlineHero·"여유로워요"·아젠다 빈 문구 미노출)
  //  - streak 은 보조 데이터라 로딩·에러 게이트에서 제외
  const isInitialLoading =
    monthlyQuery.isLoading ||
    nextMonthQuery.isLoading ||
    ddayQuery.isLoading ||
    applicationsQuery.isLoading
  const isPrimaryError =
    monthlyQuery.isError || nextMonthQuery.isError || ddayQuery.isError

  function retryPrimary() {
    monthlyQuery.refetch()
    nextMonthQuery.refetch()
    ddayQuery.refetch()
    applicationsQuery.refetch()
    streakQuery.refetch()
  }

  // U10 — T 단축키: 월뷰 커서를 오늘 달로 되돌리는 신호 카운터
  const [todayResetSignal, setTodayResetSignal] = useState(0)

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

  // U10 — 데스크탑 전용 단축키: T=오늘, N=새 일정.
  //  input/textarea/select focus · IME 조합 · 모달(시트) 열림 · 조합키 중엔 무시.
  useEffect(() => {
    if (isMobile) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.isComposing) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      // 우리 시트/드로어 열림 중이면 무시 (모달 안 조작 우선)
      if (addSheetOpen || daySheetOpen) return

      // e.code(물리 키) 기준 — 한글 입력 소스에서 e.key 가 'ㅅ'/'ㅜ' 로 들어와도 동작
      if (e.code === 'KeyT') {
        e.preventDefault()
        setSelectedDate(todayStr)
        setTodayResetSignal((n) => n + 1) // 월뷰 커서도 오늘 달로
      } else if (e.code === 'KeyN') {
        e.preventDefault()
        setAddSheetDate(todayStr)
        setAddSheetOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobile, addSheetOpen, daySheetOpen, todayStr])

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
            // 라벨 텍스트가 sm 미만에서 hidden → 모바일은 아이콘 only 로 이름이 사라진다.
            // 가시 텍스트와 같은 문구로 맞춰 중복 없이 이름만 보강 (U17).
            aria-label="즐겨찾기만"
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
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand hover:bg-accent text-bg text-xs font-bold transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            일정 추가
          </button>
        </div>
      </header>

      {isPrimaryError ? (
        <CalendarErrorCard onRetry={retryPrimary} />
      ) : isInitialLoading ? (
        <CalendarSkeleton />
      ) : (
        <>
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
        <div className={isMobile ? '' : 'grid grid-cols-[minmax(0,1fr)_320px] gap-8'}>
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
              // F10 — 완전 empty state (지원 카드 0개) → 온보딩형 CTA
              <div className="mb-10">
                <EmptyDeadlineHero variant="onboarding" />
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
              todayPulse={todayResetSignal}
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
        <div className={isMobile ? '' : 'grid grid-cols-[minmax(0,1fr)_320px] gap-8'}>
          <div>
            {/* A7 — 오늘 브리핑 진입점 (아젠다 뷰와 동일 — 뷰 상관없이 노출) */}
            <TodayBriefingBanner />
            <CalendarMonthlyGrid
              // U10 — T 단축키 시 커서를 오늘 달로: 신호 증가 → 리마운트로 초기 오늘 달 복귀
              key={todayResetSignal}
              events={agendaEvents}
              selectedDate={selectedDate}
              // 6c — 월별 그리드 탭은 선택만 변경 (시트 미발동). 모바일은 아래 인라인 상세, 데스크탑은 사이드 패널로 반영.
              onSelectDate={(d) => {
                setSelectedDate(d)
                if (isMobile) scrollInlineIntoView()
              }}
              onToday={() => setSelectedDate(todayStr)}
              todayPulse={todayResetSignal}
            />
            {/* 6c — 모바일 월별: 선택일 상세를 그리드 아래 인라인 렌더 (DayDetailContent 재사용). "상세 열기 →" = 기존 시트 통로 */}
            {isMobile && (
              <div ref={inlineDayRef} className="mt-4 scroll-mt-3 rounded-2xl bg-surface border border-line overflow-hidden">
                <DayDetailContent
                  date={selectedDate}
                  events={agendaEvents.filter((e) => e.date === selectedDate)}
                  onExpand={() => {
                    setDaySheetDate(selectedDate)
                    setDaySheetOpen(true)
                  }}
                />
              </div>
            )}
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
        </>
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

/** U2 — 초기 로딩 스켈레톤 (스피너 금지 규칙). 요약바·Hero·리스트 자리 표시 */
function CalendarSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* 요약 바 */}
      <div className="h-11 mb-5 rounded-xl border border-line bg-surface" />
      {/* 탭 */}
      <div className="h-9 w-40 mb-6 rounded-lg border border-line bg-surface" />
      {/* Hero */}
      <div className="mb-3 rounded-2xl border border-line bg-surface p-7">
        <div className="mb-4 h-3 w-24 rounded bg-card" />
        <div className="mb-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-card" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-40 rounded bg-card" />
            <div className="h-3 w-24 rounded bg-card" />
          </div>
        </div>
        <div className="h-9 w-32 rounded-lg bg-card" />
      </div>
      {/* 리스트 */}
      <div className="mt-8 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-line bg-surface" />
        ))}
      </div>
    </div>
  )
}

/** U2 — 주 데이터 로딩 실패 카드 + 재시도 */
function CalendarErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-8 py-12 text-center">
      <p className="mb-1 text-sm font-semibold text-text-primary">일정을 불러오지 못했어요</p>
      <p className="mb-5 text-xs text-text-tertiary">잠시 후 다시 시도해주세요.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center rounded-lg bg-brand px-5 text-xs font-bold text-bg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        다시 시도
      </button>
    </div>
  )
}
