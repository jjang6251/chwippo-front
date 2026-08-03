/**
 * U8/U9 — 월 그리드 셀 탭 · "+N개" 탭 시나리오:
 * 1. 셀 탭 → onSelectDate(date) (셀은 role=button)
 * 2. 이벤트 5개(pill+dot3+overflow1) → "+N개" button(aria-label) 노출
 * 3. "+N개" 탭 → onSelectDate 1회만 (stopPropagation, 셀과 중복 호출 없음)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarMonthlyGrid } from './CalendarMonthlyGrid'
import { addDays } from '@/utils/datetime'
import type { CalendarEvent } from '@/api/calendar'

// U4 — '오늘'은 KST 기준. 컴포넌트가 todayLocal() 을 쓰므로 테스트도 같은 날짜를 봐야 한다.
//
// 🔴 2026-07-30 수정 — 여기서 `todayLocal()` 을 호출하면 **모듈 로드 시점**에 평가돼
// `beforeEach` 의 `vi.setSystemTime(2026-07-15)` 보다 먼저 실행된다. 그래서 테스트는
// 실제 오늘을, 컴포넌트는 7/15 를 보게 되고 **두 날짜가 다른 주·달이 되는 순간 깨진다**
// (7월 중순엔 우연히 같은 그리드라 통과했고 7/30 에 터졌다).
// 아래 모든 describe 가 2026-07-15 로 고정하므로 상수도 그 값으로 박는다.
const TODAY = '2026-07-15'
const DAY_NUM = String(Number(TODAY.slice(8, 10)))

function ev(partial: Partial<CalendarEvent> & { type: CalendarEvent['type'] }): CalendarEvent {
  return {
    date: TODAY,
    time: null,
    applicationId: null,
    stepId: null,
    examId: null,
    noteId: null,
    companyName: '회사',
    stepName: null,
    location: null,
    content: null,
    ...partial,
  }
}

// 5개 → pill(step no-time) + dot×3(exam) + overflow×1
const FIVE_EVENTS: CalendarEvent[] = [
  ev({ type: 'step', stepName: '서류' }),
  ev({ type: 'exam', examId: 'e1' }),
  ev({ type: 'exam', examId: 'e2' }),
  ev({ type: 'exam', examId: 'e3' }),
  ev({ type: 'exam', examId: 'e4' }),
]

describe('CalendarMonthlyGrid — 셀·+N개 탭 (U8/U9)', () => {
  // 🔴 2026-08-02 — 이 describe 만 시간 고정이 빠져 있었다. 위 17행 주석이 "아래 모든
  // describe 가 2026-07-15 로 고정" 이라고 적어놨지만 **첫 describe 가 누락**돼 있었고,
  // 7/30 수정 당시엔 실제 오늘도 7월이라 우연히 통과해서 드러나지 않았다.
  // 8/1 자정에 그리드가 8월로 넘어가면서 3건이 깨졌다 (셀 15 → 2026-08-15 반환,
  // 이벤트는 전부 7월 날짜라 8월 그리드에 없어 "+N개" 미생성).
  // 시간을 고정하지 않으면 **매달 1일마다 재발**한다.
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-07-15 정오 KST (= 03:00Z) — UTC·KST 러너 양쪽에서 7월 그리드
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 셀 탭 → onSelectDate(date)', () => {
    const onSelectDate = vi.fn()
    render(<CalendarMonthlyGrid events={[ev({ type: 'exam', examId: 'e1' })]} onSelectDate={onSelectDate} />)
    const cell = screen.getByText(DAY_NUM).closest('[role="button"]')!
    fireEvent.click(cell)
    expect(onSelectDate).toHaveBeenCalledWith(TODAY)
  })

  it('2) 5개 이벤트 → "+N개" button 노출', () => {
    render(<CalendarMonthlyGrid events={FIVE_EVENTS} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '이벤트 1개 더 보기' })).toBeInTheDocument()
  })

  it('3) "+N개" 탭 → onSelectDate 1회만 (stopPropagation)', () => {
    const onSelectDate = vi.fn()
    render(<CalendarMonthlyGrid events={FIVE_EVENTS} onSelectDate={onSelectDate} />)
    fireEvent.click(screen.getByRole('button', { name: '이벤트 1개 더 보기' }))
    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(onSelectDate).toHaveBeenCalledWith(TODAY)
  })
})

/**
 * M8·U22·링 — 월뷰 A안 (목업 확정) 시나리오:
 * 1. 같은 날 종일 마감 3건 → pill 1개(첫 회사명) + "+2" 뱃지 (나머지 개별 pill 없음)
 * 2. 마감 1건 → "+N" 뱃지 없음
 * 3. 마감 있는 날 날짜 숫자 → warning 링 클래스
 * 4. pill 회사명 → 11px 클래스
 *
 * 날짜는 @/utils/datetime + 정오 KST 고정(fake timer) 으로 UTC·KST 러너 모두 동일 판정.
 * (컴포넌트가 todayLocal() = KST 로 '오늘'을 판정 — CI TZ 안전)
 */
describe('CalendarMonthlyGrid — 마감 pill·"+N" 뱃지·링 (M8·U22)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-07-15 정오 KST (= 03:00Z) — UTC·KST 러너 양쪽에서 7월 그리드
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 오늘(15)이 아닌 미래·비오늘 날짜 → past opacity·today 배지 간섭 없음.
  // ⚠️ `todayLocal()` 을 쓰면 describe 본문(= beforeEach 보다 먼저) 에서 평가돼
  // 고정 시각이 아직 안 걸린 실제 오늘을 잡는다. TODAY 상수로부터 계산한다.
  const DEADLINE_DAY = addDays(TODAY, 2) // 2026-07-17
  const DEADLINE_DAY_NUM = String(Number(DEADLINE_DAY.slice(8, 10))) // '17'

  function deadlineEvents(n: number): CalendarEvent[] {
    return Array.from({ length: n }, (_, i) =>
      ev({ type: 'step', stepName: '서류', companyName: `회사${i}`, date: DEADLINE_DAY }),
    )
  }

  it('1) 같은 날 종일 마감 3건 → pill 1개 + "+2" 뱃지', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(3)} onSelectDate={vi.fn()} />)
    // 첫 회사명만 pill 로
    expect(screen.getByText('회사0')).toBeInTheDocument()
    expect(screen.queryByText('회사1')).toBeNull()
    expect(screen.queryByText('회사2')).toBeNull()
    // 나머지 2건 = "+2" 뱃지
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('2) 마감 1건 → "+N" 뱃지 없음', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    expect(screen.getByText('회사0')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d/)).toBeNull()
  })

  it('3) 마감 있는 날 날짜 숫자 → warning 링 클래스', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    const badge = screen.getByText(DEADLINE_DAY_NUM)
    expect(badge.className).toContain('ring-warning/50')
  })

  it('4) pill 회사명 → 11px 클래스', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    const pillLabel = screen.getByText('회사0')
    expect(pillLabel.className).toContain('text-[11px]')
  })
})

/**
 * U7 — 월 pill 개별 클릭 딥링크 시나리오:
 * 1. pill 회사명 클릭 → 스텝 경로(/board/:appId/steps/:stepId) 이동 + 셀 onSelectDate 미호출 (stopPropagation)
 * 2. stepId 없는 마감 → /board/:appId fallback
 * 3. "+N" 뱃지 클릭 → 셀로 버블 = 기존 날짜 선택 동작 유지
 *
 * 정오 KST 고정으로 UTC·KST 러너 모두 동일 판정.
 */
describe('CalendarMonthlyGrid — pill 스텝 딥링크 (U7)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ⚠️ 위 DEADLINE_DAY 와 같은 함정 — describe 본문은 beforeEach 보다 먼저 평가된다.
  // 주석은 '2026-07-15' 인데 실제로는 실행일이 들어가고 있었다. 상수로 고정.
  const DAY = TODAY // '2026-07-15'

  it('1) pill 회사명 클릭 → 스텝 경로 이동 · 셀 onSelectDate 미호출', () => {
    const onSelectDate = vi.fn()
    const step = ev({
      type: 'step',
      stepName: '서류',
      companyName: '카카오',
      applicationId: 'a1',
      stepId: 's1',
      date: DAY,
    })
    render(
      <MemoryRouter>
        <CalendarMonthlyGrid events={[step]} onSelectDate={onSelectDate} />
      </MemoryRouter>,
    )
    const pillLink = screen.getByRole('link', { name: '카카오' })
    expect(pillLink).toHaveAttribute('href', '/board/a1/steps/s1')
    fireEvent.click(pillLink)
    expect(onSelectDate).not.toHaveBeenCalled()
  })

  it('2) stepId 없는 마감 → /board/:appId fallback', () => {
    const step = ev({
      type: 'step',
      stepName: '서류',
      companyName: '네이버',
      applicationId: 'a2',
      stepId: null,
      date: DAY,
    })
    render(
      <MemoryRouter>
        <CalendarMonthlyGrid events={[step]} onSelectDate={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: '네이버' })).toHaveAttribute('href', '/board/a2')
  })

  it('3) "+N" 뱃지 클릭 → 셀 날짜 선택 유지 (버블)', () => {
    const onSelectDate = vi.fn()
    const events = [
      ev({ type: 'step', stepName: '서류', companyName: '회사A', applicationId: 'a1', stepId: 's1', date: DAY }),
      ev({ type: 'step', stepName: '서류', companyName: '회사B', applicationId: 'a2', stepId: 's2', date: DAY }),
    ]
    render(
      <MemoryRouter>
        <CalendarMonthlyGrid events={events} onSelectDate={onSelectDate} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('+1'))
    expect(onSelectDate).toHaveBeenCalledWith(DAY)
  })
})

/**
 * U25·표기 통일 — 오늘 배지 text-bg + 월 네비 aria-label 시나리오.
 */
describe('CalendarMonthlyGrid — CTA 색·aria (U25·표기)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 오늘 배지 → text-bg (브랜드 반전)', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    const todayBadge = screen.getByText('15') // 오늘 = 7/15
    expect(todayBadge.className).toContain('bg-brand')
    expect(todayBadge.className).toContain('text-bg')
    expect(todayBadge.className).not.toContain('text-text-primary')
  })

  it('2) 월 네비 aria-label "이전 달"/"다음 달"', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '이전 달' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 달' })).toBeInTheDocument()
  })
})

/**
 * U18 — 날짜 셀 aria 시나리오 (2026-07-15 정오 KST 고정 → 7월 그리드):
 * 1. 일정 없는 날 → "7월 16일"
 * 2. 일정 2건 → "7월 16일, 일정 2건"
 * 3. 오늘 → "7월 15일, 오늘"
 * 4. 공휴일(7/17 제헌절) + 일정 1건 → "7월 17일, 제헌절, 일정 1건"
 * 5. selectedDate 셀 → aria-pressed=true, 나머지 false
 */
describe('CalendarMonthlyGrid — 날짜 셀 aria (U18)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z')) // = KST 2026-07-15 12:00
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 일정 없는 날 → "7월 16일"', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '7월 16일' })).toBeInTheDocument()
  })

  it('2) 일정 2건 → "7월 16일, 일정 2건"', () => {
    const events = [
      ev({ type: 'exam', examId: 'e1', date: '2026-07-16' }),
      ev({ type: 'note', noteId: 'n1', date: '2026-07-16' }),
    ]
    render(<CalendarMonthlyGrid events={events} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '7월 16일, 일정 2건' })).toBeInTheDocument()
  })

  it('3) 오늘 → "7월 15일, 오늘"', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '7월 15일, 오늘' })).toBeInTheDocument()
  })

  it('4) 공휴일 + 일정 1건 → "7월 17일, 제헌절, 일정 1건"', () => {
    const events = [ev({ type: 'exam', examId: 'e1', date: '2026-07-17' })]
    render(<CalendarMonthlyGrid events={events} onSelectDate={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: '7월 17일, 제헌절, 일정 1건' }),
    ).toBeInTheDocument()
  })

  it('5) 선택 셀만 aria-pressed=true', () => {
    render(
      <CalendarMonthlyGrid events={[]} selectedDate="2026-07-16" onSelectDate={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '7월 16일' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '7월 15일, 오늘' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

/**
 * U4 — 로컬 TZ 의존 제거 회귀: '오늘' 판정·초기 월 커서가 브라우저/러너 TZ 가 아니라
 * KST 기준이어야 한다.
 *   KST 2026-08-01 00:30 = UTC 2026-07-31 15:30.
 *   UTC 러너에서 로컬 now = 7/31 이지만 todayLocal() = 8/1.
 *   구현이 dayjs()(로컬) 였다면 7월·7/31 로 판정돼 두 케이스 모두 실패 → 회귀 가드.
 * 두 러너(UTC·KST) 모두에서 todayLocal() 은 8/1 로 고정 → 결정적.
 */
describe('CalendarMonthlyGrid — KST 경계 오늘·월 커서 (U4 TZ)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-31T15:30:00Z')) // = KST 2026-08-01 00:30
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 오늘 판정 = KST 날짜(8/1) → 브랜드 오늘 배지 (로컬 7/31 아님)', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    const todayBadge = screen.getByText('1')
    expect(todayBadge.className).toContain('bg-brand')
    expect(todayBadge.className).toContain('text-bg')
  })

  it('2) 초기 월 커서 = KST 현재 월 (2026년 8월, 7월 아님)', () => {
    render(<CalendarMonthlyGrid events={[]} onSelectDate={vi.fn()} />)
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
    expect(screen.queryByText('2026년 7월')).toBeNull()
  })
})
