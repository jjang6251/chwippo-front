/**
 * A3 — 마감 임박 준비 (오늘 할 일 자동 합류) 시나리오:
 * 1. 오늘 패널 + 임박 항목 → 🔥 그룹 + 항목·회사명·D-day 표시
 * 2. 오늘 아닌 날짜 → 그룹 미표시 (hook enabled=false)
 * 3. 체크 클릭 → 원본 checklist 토글 mutation (read-through)
 * 4. 임박 항목 0개 → 그룹 헤더 미표시
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
})
