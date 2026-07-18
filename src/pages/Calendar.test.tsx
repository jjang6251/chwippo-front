/**
 * 캘린더 보수 묶음 3 — 페이지 상태·인터랙션 시나리오.
 *
 * U2 (로딩·에러·false-empty flash 제거):
 *   1. 초기 로딩 중 → 스켈레톤만 (EmptyDeadlineHero·"임박한 일정" 등 미노출)
 *   2. 주 데이터 에러 → 에러 카드 + "다시 시도" 클릭 시 4개 쿼리 refetch
 *   3. streak 실패 → 페이지 정상 (Hero 노출) · Hero 에 streak 미전달
 *
 * F10 (empty state 분기 · hasCards = useApplications):
 *   1. 카드 0개 → 온보딩형 empty ("첫 지원 카드를 만들어보세요")
 *   2. 카드 있음 + 마감 없음 → 기존 empty ("이번 주는 여유로워요")
 *   3. 마감 있음 → Hero
 *
 * U10 (T/N 단축키 · 데스크탑 전용):
 *   1. T → selectedDate 오늘로 (사이드 미니맵 반영)
 *   2. N → AddEventSheet 열림
 *   3. input focus 중 → 무시
 *   4. IME 조합 중 → 무시
 *   5. 모바일 → 미동작
 *
 * TZ 안전: fake timer 정오 KST(2026-07-15) 고정 → UTC·KST 러너 동일 판정.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Calendar } from './Calendar'
import type { CalendarEvent } from '@/api/calendar'
import type { DdayItem } from '@/api/dashboard'

interface MockQuery<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

let isMobile = false
let calendarState: MockQuery<CalendarEvent[]>
let ddayState: MockQuery<DdayItem[]>
let streakState: MockQuery<{ streak: { current: number } }>
let applicationsState: MockQuery<unknown[]>

vi.mock('@/hooks/useCalendar', () => ({
  useCalendarEvents: () => calendarState,
}))
vi.mock('@/hooks/useDashboard', () => ({
  useDdayList: () => ddayState,
}))
vi.mock('@/hooks/useDashboardStreak', () => ({
  useDashboardStreak: () => streakState,
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => applicationsState,
}))
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => isMobile,
}))
vi.mock('@/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({}),
}))
vi.mock('@/components/common/PullToRefreshIndicator', () => ({
  PullToRefreshIndicator: () => null,
}))

// 테스트 대상 아닌 자식 컴포넌트 stub (자체 쿼리·라우터 의존 제거)
vi.mock('@/components/calendar/TodayBriefingBanner', () => ({
  TodayBriefingBanner: () => null,
}))
vi.mock('@/components/calendar/CalendarAgendaView', () => ({
  CalendarAgendaView: () => <div>agenda-view</div>,
}))
vi.mock('@/components/calendar/CalendarMonthlyGrid', () => ({
  CalendarMonthlyGrid: () => <div>month-grid</div>,
}))
vi.mock('@/components/calendar/CalendarDayPanel', () => ({
  CalendarDayPanel: () => null,
}))
vi.mock('@/components/calendar/CalendarSideMinimap', () => ({
  CalendarSideMinimap: ({
    selectedDate,
    onSelectDate,
  }: {
    selectedDate: string
    onSelectDate: (d: string) => void
  }) => (
    <div>
      <span data-testid="sel">{selectedDate}</span>
      <button onClick={() => onSelectDate('2026-08-01')}>pick-aug</button>
    </div>
  ),
}))
vi.mock('@/components/calendar/CalendarDaySheet', () => ({
  CalendarDaySheet: ({ open }: { open: boolean }) => (open ? <div>day-sheet-open</div> : null),
}))
vi.mock('@/components/calendar/AddEventSheet', () => ({
  AddEventSheet: ({ open }: { open: boolean }) => (open ? <div>add-sheet-open</div> : null),
}))
vi.mock('@/components/calendar/CountdownHeroLarge', () => ({
  CountdownHeroLarge: ({ event, streakDays }: { event: DdayItem; streakDays?: number }) => (
    <div>{`hero:${event.companyName}:${streakDays ?? 'nostreak'}`}</div>
  ),
}))
vi.mock('@/components/calendar/CountdownPillCard', () => ({
  CountdownPillCard: ({ event }: { event: DdayItem }) => <div>{`pill:${event.companyName}`}</div>,
}))

const heroEvent: DdayItem = {
  type: 'step',
  companyName: '카카오',
  date: '2026-07-20',
  dday: 3,
  applicationId: 'a1',
  nextAction: 'no_action',
}

function renderCalendar() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T03:00:00Z')) // 정오 KST
  isMobile = false
  calendarState = { data: [], isLoading: false, isError: false, refetch: vi.fn() }
  ddayState = { data: [], isLoading: false, isError: false, refetch: vi.fn() }
  streakState = { data: { streak: { current: 3 } }, isLoading: false, isError: false, refetch: vi.fn() }
  applicationsState = { data: [], isLoading: false, isError: false, refetch: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Calendar — 로딩·에러·false-empty (U2)', () => {
  it('1) 초기 로딩 → 스켈레톤만, empty·아젠다 미노출', () => {
    calendarState.isLoading = true
    ddayState.isLoading = true
    applicationsState.isLoading = true
    renderCalendar()
    // false-empty flash 방지: empty 문구·아젠다 헤딩 미노출
    expect(screen.queryByText('이번 주는 여유로워요')).toBeNull()
    expect(screen.queryByText('첫 지원 카드를 만들어보세요')).toBeNull()
    expect(screen.queryByText('임박한 일정')).toBeNull()
    expect(screen.queryByText('agenda-view')).toBeNull()
  })

  it('2) 주 데이터 에러 → 에러 카드 + 재시도 클릭 → refetch', () => {
    calendarState.isError = true
    renderCalendar()
    expect(screen.getByText('일정을 불러오지 못했어요')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(calendarState.refetch).toHaveBeenCalled()
    expect(ddayState.refetch).toHaveBeenCalled()
    expect(applicationsState.refetch).toHaveBeenCalled()
    expect(streakState.refetch).toHaveBeenCalled()
  })

  it('3) streak 실패 → 페이지 정상, Hero 에 streak 미전달', () => {
    ddayState.data = [heroEvent]
    streakState = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() }
    renderCalendar()
    // 페이지 정상 (Hero 노출) · streakDays 미전달(nostreak) — 에러가 페이지 전체를 막지 않음
    expect(screen.getByText('hero:카카오:nostreak')).toBeInTheDocument()
    expect(screen.queryByText('일정을 불러오지 못했어요')).toBeNull()
  })
})

describe('Calendar — empty state 분기 (F10)', () => {
  it('1) 카드 0개 → 온보딩형 empty', () => {
    applicationsState.data = []
    ddayState.data = []
    renderCalendar()
    expect(screen.getByText('첫 지원 카드를 만들어보세요')).toBeInTheDocument()
    expect(screen.queryByText('이번 주는 여유로워요')).toBeNull()
  })

  it('2) 카드 있음 + 마감 없음 → 기존 empty', () => {
    applicationsState.data = [{ id: 'a1' }]
    ddayState.data = []
    renderCalendar()
    expect(screen.getByText('이번 주는 여유로워요')).toBeInTheDocument()
    expect(screen.queryByText('첫 지원 카드를 만들어보세요')).toBeNull()
  })

  it('3) 마감 있음 → Hero', () => {
    ddayState.data = [heroEvent]
    renderCalendar()
    expect(screen.getByText('hero:카카오:3')).toBeInTheDocument()
    expect(screen.queryByText('이번 주는 여유로워요')).toBeNull()
    expect(screen.queryByText('첫 지원 카드를 만들어보세요')).toBeNull()
  })

  it('4) 카드 목록 조회 실패 → 온보딩 아닌 기존 empty (기존 유저 오노출 방지)', () => {
    applicationsState = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() }
    ddayState.data = []
    renderCalendar()
    expect(screen.getByText('이번 주는 여유로워요')).toBeInTheDocument()
    expect(screen.queryByText('첫 지원 카드를 만들어보세요')).toBeNull()
  })
})

describe('Calendar — 단축키 T/N (U10)', () => {
  it('1) T → selectedDate 오늘로 (미니맵 반영)', () => {
    renderCalendar()
    fireEvent.click(screen.getByText('pick-aug'))
    expect(screen.getByTestId('sel').textContent).toBe('2026-08-01')
    fireEvent.keyDown(window, { key: 't', code: 'KeyT' })
    expect(screen.getByTestId('sel').textContent).toBe('2026-07-15')
  })

  it('1-1) 한글 입력 소스 (key=ㅅ, code=KeyT) → 물리 키 기준 동작 (CEO 실기 버그 재현)', () => {
    renderCalendar()
    fireEvent.click(screen.getByText('pick-aug'))
    fireEvent.keyDown(window, { key: 'ㅅ', code: 'KeyT' })
    expect(screen.getByTestId('sel').textContent).toBe('2026-07-15')
  })

  it('2) N → AddEventSheet 열림', () => {
    renderCalendar()
    expect(screen.queryByText('add-sheet-open')).toBeNull()
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' })
    expect(screen.getByText('add-sheet-open')).toBeInTheDocument()
  })

  it('3) input focus 중 → 무시', () => {
    renderCalendar()
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'n' })
    expect(screen.queryByText('add-sheet-open')).toBeNull()
    input.remove()
  })

  it('4) IME 조합 중 → 무시', () => {
    renderCalendar()
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', isComposing: true })
    expect(screen.queryByText('add-sheet-open')).toBeNull()
  })

  it('5) 모바일 → 단축키 미동작', () => {
    isMobile = true
    renderCalendar()
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' })
    expect(screen.queryByText('add-sheet-open')).toBeNull()
  })
})
