/**
 * A3 — 마감 임박 준비 (오늘 할 일 자동 합류) 시나리오:
 * 1. 오늘 패널 + 임박 항목 → 🔥 그룹 + 항목·회사명·D-day 표시
 * 2. 오늘 아닌 날짜 → 그룹 미표시 (hook enabled=false)
 * 3. 체크 클릭 → 원본 checklist 토글 mutation (read-through)
 * 4. 임박 항목 0개 → 그룹 헤더 미표시
 *
 * A4 — 일정 충돌 배너:
 * 5. 근접(2h 미만) 시간 일정 2개 → danger 배너 + 일정 나열
 * 6. 충돌 없으면 배너 없음
 *
 * A6 — 공휴일 뱃지:
 * 7. 공휴일 날짜 → 헤더에 이름 뱃지 / 평일 → 없음
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarDayPanel } from './CalendarDayPanel'
import type { UrgentChecklistItem } from '@/api/calendar'

let urgentData: UrgentChecklistItem[] = []
const completeMock = vi.fn()

vi.mock('@/hooks/useCalendar', () => ({
  useDailyNotes: () => ({ data: [] }),
  useCreateDailyNote: () => ({ mutate: vi.fn() }),
  useUpdateDailyNote: () => ({ mutate: vi.fn() }),
  useDeleteDailyNote: () => ({ mutate: vi.fn() }),
  useCarryOverDailyNote: () => ({ mutate: vi.fn() }),
  useUrgentChecklist: (enabled: boolean) => ({
    data: enabled ? urgentData : [],
  }),
  useCompleteUrgentChecklistItem: () => ({
    mutate: completeMock,
    isPending: false,
  }),
}))

const TODAY = dayjs().format('YYYY-MM-DD')
const TOMORROW = dayjs().add(1, 'day').format('YYYY-MM-DD')

const ITEM: UrgentChecklistItem = {
  itemId: 'c-1',
  content: '포트폴리오 출력',
  stepId: 's-1',
  stepName: '면접',
  applicationId: 'app-1',
  companyName: '카카오',
  date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
}

function renderPanel(date: string) {
  return render(
    <MemoryRouter>
      <CalendarDayPanel date={date} events={[]} />
    </MemoryRouter>,
  )
}

describe('CalendarDayPanel — 마감 임박 준비 (A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    urgentData = []
  })

  it('1) 오늘 + 임박 항목 → 그룹·항목·회사명·D-day 표시', () => {
    urgentData = [ITEM]
    renderPanel(TODAY)
    expect(screen.getByText('🔥 마감 임박 준비')).toBeInTheDocument()
    expect(screen.getByText('포트폴리오 출력')).toBeInTheDocument()
    expect(screen.getByText('카카오')).toBeInTheDocument()
    expect(screen.getByText('D-2')).toBeInTheDocument()
    // 스텝 페이지 링크
    expect(screen.getByTitle(/면접 준비 체크리스트로 이동/)).toHaveAttribute(
      'href',
      '/board/app-1/steps/s-1',
    )
  })

  it('2) 오늘 아닌 날짜 → 그룹 미표시', () => {
    urgentData = [ITEM]
    renderPanel(TOMORROW)
    expect(screen.queryByText('🔥 마감 임박 준비')).toBeNull()
  })

  it('3) 체크 클릭 → 원본 checklist 토글 (read-through)', () => {
    urgentData = [ITEM]
    renderPanel(TODAY)
    fireEvent.click(screen.getByLabelText('완료 표시'))
    expect(completeMock).toHaveBeenCalledWith({
      applicationId: 'app-1',
      stepId: 's-1',
      itemId: 'c-1',
    })
  })

  it('4) 임박 항목 0개 → 그룹 헤더 미표시', () => {
    renderPanel(TODAY)
    expect(screen.queryByText('🔥 마감 임박 준비')).toBeNull()
  })

  it('5) [A4] 근접 시간 일정 2개 → 겹침 배너 + 일정 나열', () => {
    const base = {
      date: TODAY,
      type: 'step' as const,
      applicationId: 'a',
      stepId: 's',
      examId: null,
      noteId: null,
      location: null,
      content: null,
    }
    render(
      <MemoryRouter>
        <CalendarDayPanel
          date={TODAY}
          events={[
            { ...base, time: '14:00', companyName: '카카오', stepName: '면접' },
            { ...base, time: '15:00', companyName: '네이버', stepName: '면접' },
          ]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/일정이 겹쳐요/)).toBeInTheDocument()
    expect(screen.getByText(/14:00 카카오 면접 · 15:00 네이버 면접/)).toBeInTheDocument()
  })

  it('6) [A4] 충돌 없으면 배너 없음', () => {
    renderPanel(TODAY)
    expect(screen.queryByText(/일정이 겹쳐요|시간 일정이 2개/)).toBeNull()
  })

  it('7) [A6] 공휴일 날짜 → 헤더 뱃지 / 평일 → 없음', () => {
    const { unmount } = renderPanel('2026-09-25')
    expect(screen.getByText('추석')).toBeInTheDocument()
    unmount()
    renderPanel('2026-07-08')
    expect(screen.queryByText('추석')).toBeNull()
  })
})
