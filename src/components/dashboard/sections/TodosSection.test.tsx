/**
 * TodosSection 테스트 (LRR P1T3 PR I).
 *
 * 시나리오 enumeration (구현 보기 전에 케이스 먼저):
 * 1. input에 maxLength={200} 속성 존재 (회귀 방어 핵심 — PR I 1차 시도가 dead code였던 자리)
 * 2. 정상 입력 + 엔터 → createDailyNote 호출 (today, hourSlot=null, content trim)
 * 3. 공백만 + 엔터 → createDailyNote 호출 안 함
 * 4. 빈 상태 → "오늘 할 일을 추가해보세요" 안내 표시
 * 5. todayUnscheduled에 할 일 있음 → 내용 + "삭제" 버튼 렌더
 * 6. 어제 미완료 있음 → "어제 미완료" 섹션 + "오늘로" 버튼
 *
 * 빠진 시나리오 (수동 검증 영역):
 * - IME(한글) 조합 중 엔터 차단 — fireEvent로 KeyboardEvent.isComposing(readonly) 시뮬 불가, 수동 검증으로 확인
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import { TodosSection } from './TodosSection'
import type { DailyNote } from '@/api/calendar'

vi.mock('@/contexts/demoMode', () => ({
  useDemoMode: () => false,
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRemove = vi.fn()
const mockCarryOver = vi.fn()
const mockNotesQuery = vi.fn()

vi.mock('@/hooks/useCalendar', () => ({
  useTodayDailyNotes: () => mockNotesQuery(),
  useCreateDailyNote: () => ({ mutate: mockCreate }),
  useUpdateDailyNote: () => ({ mutate: mockUpdate }),
  useDeleteDailyNote: () => ({ mutate: mockRemove }),
  useCarryOverDailyNote: () => ({ mutate: mockCarryOver }),
}))

const today = dayjs().format('YYYY-MM-DD')
const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

function makeNote(overrides: Partial<DailyNote> = {}): DailyNote {
  return {
    id: 'note-1',
    userId: 'user-1',
    date: today,
    hourSlot: null,
    content: '샘플 할 일',
    isDone: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as DailyNote
}

function renderSection(notes: DailyNote[] = [], isLoading = false) {
  mockNotesQuery.mockReturnValue({ data: notes, isLoading })
  return render(
    <MemoryRouter>
      <TodosSection />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TodosSection', () => {
  it('1. input에 maxLength=200 속성 존재 (회귀 방어 핵심)', () => {
    renderSection()
    const input = screen.getByPlaceholderText(
      '할 일 추가 (엔터로 등록)',
    ) as HTMLInputElement
    expect(input.maxLength).toBe(200)
  })

  it('2. 정상 입력 + 엔터 → createDailyNote(today, hourSlot=null, content trim) 호출', () => {
    renderSection()
    const input = screen.getByPlaceholderText('할 일 추가 (엔터로 등록)')
    fireEvent.change(input, { target: { value: '  자소서 다듬기  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockCreate).toHaveBeenCalledWith({
      date: today,
      hourSlot: null,
      content: '자소서 다듬기',
    })
  })

  it('3. 공백만 + 엔터 → createDailyNote 호출 안 함', () => {
    renderSection()
    const input = screen.getByPlaceholderText('할 일 추가 (엔터로 등록)')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('4. 빈 상태 → "오늘 할 일을 추가해보세요" 안내 표시', () => {
    renderSection()
    expect(
      screen.getByText('오늘 할 일을 추가해보세요'),
    ).toBeTruthy()
  })

  it('5. todayUnscheduled 있음 → 내용 + 삭제 버튼 렌더', () => {
    renderSection([makeNote({ content: '면접 준비' })])
    expect(screen.getByText('면접 준비')).toBeTruthy()
    expect(screen.getByLabelText('삭제')).toBeTruthy()
  })

  it('6. 어제 미완료 있음 → "어제 미완료" 섹션 + "오늘로" 버튼', () => {
    renderSection([
      makeNote({
        id: 'note-y',
        date: yesterday,
        content: '어제 못한 일',
        isDone: false,
      }),
    ])
    expect(screen.getByText('어제 미완료')).toBeTruthy()
    expect(screen.getByText('오늘로')).toBeTruthy()
  })
})
