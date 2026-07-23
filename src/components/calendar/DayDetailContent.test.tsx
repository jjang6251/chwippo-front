/**
 * U1/U12/U13/U19 — DayDetailContent 시나리오:
 *
 * 할 일 입력 v2:
 * 1. 텍스트 없음 → "추가" 커밋 버튼 미노출 / 텍스트 있으면 노출
 * 2. Enter 등록 (createNote 호출) · IME 조합 중 Enter 는 등록 안 함
 * 3. 커밋 버튼 클릭 → createNote(date, hourSlot=null, content)
 * 4. input maxLength=200 · 카운터는 150자+ 만 노출 (149 미노출)
 *
 * U13 삭제 undo:
 * 5. 삭제 → deleteNote 즉시 호출 + "되돌리기" 토스트
 * 6. 되돌리기 → 같은 content·date·hourSlot 으로 createNote 재생성
 * 7. undo 전 재삭제 경합 → 각 토스트 독립 (A 되돌리기는 A만 재생성)
 *
 * U12 이월:
 * 8. 오늘 + 어제 미완료 → "오늘로 →" 노출 · 클릭 시 carryOver(id)
 * 9. 멱등(이미 오늘) — 오늘 자기 노트는 이월 버튼 없음
 * 10. 오늘 아닌 날짜 → 이월 서브섹션 미노출
 *
 * 빈 상태:
 * 11. 빈 날짜 → 종일/시간 이벤트 "없음" + "아직 할 일이 없어요"
 *
 * 6b 인라인 편집:
 * ① 텍스트 탭 → textarea 나타나고 원값 채워짐
 * ② 수정 후 Enter → PATCH {content} + 편집 종료
 * ③ 수정 후 저장 버튼 → 동일
 * ④ ESC → PATCH 미호출 · 원값 표시
 * ⑤ 빈 값 저장 → PATCH 미호출 · 원값 복원
 * ⑥ PATCH 실패 → 토스트 + 편집 유지(입력값 보존)
 * ⑦ 체크박스 토글 회귀 — updateNote(isDone) · 편집 미진입
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DayDetailContent } from './DayDetailContent'
import { useToastStore, toast } from '@/stores/toastStore'
import type { DailyNote } from '@/api/calendar'
import { todayLocal, addDays } from '@/utils/datetime'

const TODAY = todayLocal()
const YESTERDAY = addDays(TODAY, -1)
const OTHER_DAY = addDays(TODAY, 3)

// date 별 daily-notes 데이터 (useDailyNotes 두 번 호출: 현재일 + 어제)
let notesByDate: Record<string, DailyNote[]> = {}
const createNote = vi.fn()
const deleteNote = vi.fn()
const carryOver = vi.fn()
const updateNote = vi.fn()

vi.mock('@/hooks/useCalendar', () => ({
  useDailyNotes: (date: string | null) => ({ data: date ? (notesByDate[date] ?? []) : [] }),
  useCreateDailyNote: () => ({ mutate: createNote }),
  useUpdateDailyNote: () => ({ mutate: updateNote }),
  // 6b — 삭제 undo 훅. 실제 로직(delete + 되돌리기 토스트 + undo 재생성)을 spy 로 재현해
  //       기존 U13 시나리오(5·6·7)를 회귀 없이 검증한다.
  useDeleteNoteWithUndo:
    () =>
    (n: { id: string; date: string; hourSlot: number | null; content: string }) => {
      deleteNote(n.id)
      toast.action('삭제됨', {
        label: '되돌리기',
        onAction: () => createNote({ date: n.date, hourSlot: n.hourSlot, content: n.content }),
      })
    },
  useCarryOverDailyNote: () => ({ mutate: carryOver }),
  useUrgentChecklist: () => ({ data: [] }),
  useCompleteUrgentChecklistItem: () => ({ mutate: vi.fn(), isPending: false }),
}))

function note(partial: Partial<DailyNote> & { id: string; content: string; date: string }): DailyNote {
  return { hourSlot: null, isDone: false, createdAt: '2026-07-16T00:00:00Z', ...partial }
}

function renderContent(date: string) {
  return render(
    <MemoryRouter>
      <DayDetailContent date={date} events={[]} />
    </MemoryRouter>,
  )
}

describe('DayDetailContent — 할 일 입력 v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesByDate = {}
    useToastStore.setState({ toasts: [] })
  })

  it('1) 텍스트 없음 → 커밋 버튼 미노출 / 있으면 노출', () => {
    renderContent(TODAY)
    // 입력 전: "추가" 커밋 버튼(aria-label 할 일 추가 버튼) 없음
    expect(screen.queryByRole('button', { name: '할 일 추가' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: '할 일 추가' }), {
      target: { value: '이력서 검토' },
    })
    expect(screen.getByRole('button', { name: '할 일 추가' })).toBeInTheDocument()
  })

  it('2) Enter 등록 · IME 조합 Enter 는 미등록', () => {
    renderContent(TODAY)
    const input = screen.getByRole('textbox', { name: '할 일 추가' })
    fireEvent.change(input, { target: { value: '자소서 마무리' } })

    // IME 조합 중 Enter → 등록 안 함
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(createNote).not.toHaveBeenCalled()

    // 일반 Enter → 등록
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(createNote).toHaveBeenCalledWith({ date: TODAY, hourSlot: null, content: '자소서 마무리' })
  })

  it('3) 커밋 버튼 클릭 → createNote', () => {
    renderContent(TODAY)
    const input = screen.getByRole('textbox', { name: '할 일 추가' })
    fireEvent.change(input, { target: { value: '  코테 응시  ' } })
    fireEvent.click(screen.getByRole('button', { name: '할 일 추가' }))
    expect(createNote).toHaveBeenCalledWith({ date: TODAY, hourSlot: null, content: '코테 응시' })
  })

  it('4) maxLength=200 · 카운터 150 경계', () => {
    renderContent(TODAY)
    const input = screen.getByRole('textbox', { name: '할 일 추가' }) as HTMLInputElement
    expect(input.maxLength).toBe(200)

    fireEvent.change(input, { target: { value: 'a'.repeat(149) } })
    expect(screen.queryByText('149/200')).toBeNull()

    fireEvent.change(input, { target: { value: 'a'.repeat(150) } })
    expect(screen.getByText('150/200')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'a'.repeat(200) } })
    expect(screen.getByText('200/200')).toBeInTheDocument()
  })
})

describe('DayDetailContent — 삭제 undo (U13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesByDate = {}
    useToastStore.setState({ toasts: [] })
  })

  it('5) 삭제 → deleteNote 즉시 + 되돌리기 토스트', () => {
    notesByDate = { [TODAY]: [note({ id: 'n1', content: '이력서 검토', date: TODAY })] }
    renderContent(TODAY)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(deleteNote).toHaveBeenCalledWith('n1')
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].action?.label).toBe('되돌리기')
  })

  it('6) 되돌리기 → 같은 content·date·hourSlot 재생성', () => {
    notesByDate = {
      [TODAY]: [note({ id: 'n1', content: '이력서 검토', date: TODAY, hourSlot: null })],
    }
    renderContent(TODAY)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    useToastStore.getState().toasts[0].action!.onAction()
    expect(createNote).toHaveBeenCalledWith({ date: TODAY, hourSlot: null, content: '이력서 검토' })
  })

  it('7) undo 전 재삭제 경합 → 토스트 독립 (A 되돌리기는 A만)', () => {
    notesByDate = {
      [TODAY]: [
        note({ id: 'n1', content: '할일 A', date: TODAY }),
        note({ id: 'n2', content: '할일 B', date: TODAY }),
      ],
    }
    renderContent(TODAY)
    const deleteBtns = screen.getAllByRole('button', { name: '삭제' })
    fireEvent.click(deleteBtns[0]) // A
    fireEvent.click(deleteBtns[1]) // B
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(2)
    // 첫 토스트(A) 되돌리기 → A만 재생성
    toasts[0].action!.onAction()
    expect(createNote).toHaveBeenCalledTimes(1)
    expect(createNote).toHaveBeenCalledWith({ date: TODAY, hourSlot: null, content: '할일 A' })
  })
})

describe('DayDetailContent — 이월 (U12) · 빈 상태', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesByDate = {}
    useToastStore.setState({ toasts: [] })
  })

  it('8) 오늘 + 어제 미완료 → 오늘로 → 노출 · carryOver 호출', () => {
    notesByDate = {
      [TODAY]: [],
      [YESTERDAY]: [note({ id: 'y1', content: '면접 예상질문 정리', date: YESTERDAY, isDone: false })],
    }
    renderContent(TODAY)
    expect(screen.getByText('면접 예상질문 정리')).toBeInTheDocument()
    expect(screen.getByText('어제 못 끝낸 일')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '오늘로 이월' }))
    expect(carryOver).toHaveBeenCalledWith('y1')
  })

  it('9) 멱등 — 어제 완료된 노트는 이월 후보 아님', () => {
    notesByDate = {
      [TODAY]: [],
      [YESTERDAY]: [note({ id: 'y1', content: '완료된 일', date: YESTERDAY, isDone: true })],
    }
    renderContent(TODAY)
    expect(screen.queryByRole('button', { name: '오늘로 이월' })).toBeNull()
  })

  it('10) 오늘 아닌 날짜 → 이월 서브섹션 미노출', () => {
    notesByDate = {
      [OTHER_DAY]: [],
      [YESTERDAY]: [note({ id: 'y1', content: '어제 일', date: YESTERDAY, isDone: false })],
    }
    renderContent(OTHER_DAY)
    expect(screen.queryByText('어제 못 끝낸 일')).toBeNull()
    expect(screen.queryByRole('button', { name: '오늘로 이월' })).toBeNull()
  })

  it('11) 빈 날짜 → 종일/시간 이벤트 없음 + 할 일 empty', () => {
    renderContent(OTHER_DAY)
    // 종일 · 시간 이벤트 "없음" (2곳)
    expect(screen.getAllByText('없음')).toHaveLength(2)
    expect(screen.getByText('아직 할 일이 없어요')).toBeInTheDocument()
    // 입력 고스트 행은 존재
    expect(screen.getByRole('textbox', { name: '할 일 추가' })).toBeInTheDocument()
  })
})

describe('DayDetailContent — 할 일 인라인 편집 (6b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateNote.mockReset()
    notesByDate = {}
    useToastStore.setState({ toasts: [] })
  })

  function openEditor(content = '이력서 검토') {
    notesByDate = { [TODAY]: [note({ id: 'n1', content, date: TODAY })] }
    renderContent(TODAY)
    fireEvent.click(screen.getByRole('button', { name: '할 일 수정' }))
    return screen.getByRole('textbox', { name: '할 일 수정' }) as HTMLTextAreaElement
  }

  it('① 텍스트 탭 → textarea 나타나고 원값 채워짐', () => {
    const textarea = openEditor()
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('이력서 검토')
  })

  it('①-Space 키보드 Space 로도 편집 진입 (role=button 관례)', () => {
    notesByDate = { [TODAY]: [note({ id: 'n1', content: '이력서 검토', date: TODAY })] }
    renderContent(TODAY)
    fireEvent.keyDown(screen.getByRole('button', { name: '할 일 수정' }), { key: ' ' })
    expect(screen.getByRole('textbox', { name: '할 일 수정' })).toBeInTheDocument()
  })

  it('② 수정 후 Enter → PATCH {content} + 편집 종료', () => {
    updateNote.mockImplementation((_v, opts) => opts?.onSuccess?.())
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '이력서 최종 검토' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(updateNote).toHaveBeenCalledWith(
      { id: 'n1', content: '이력서 최종 검토' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
    // 편집 종료 → textarea 사라지고 편집 진입(할 일 수정) 버튼 복귀
    expect(screen.queryByRole('textbox', { name: '할 일 수정' })).toBeNull()
    expect(screen.getByRole('button', { name: '할 일 수정' })).toBeInTheDocument()
  })

  it('②-IME 조합 확정 Enter 는 저장 안 함', () => {
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '조합 중 값' } })
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })
    expect(updateNote).not.toHaveBeenCalled()
    // 편집 유지
    expect(screen.getByRole('textbox', { name: '할 일 수정' })).toBeInTheDocument()
  })

  it('③ 수정 후 저장 버튼 클릭 → PATCH {content} + 편집 종료', () => {
    updateNote.mockImplementation((_v, opts) => opts?.onSuccess?.())
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '  이력서 v2  ' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(updateNote).toHaveBeenCalledWith(
      { id: 'n1', content: '이력서 v2' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    expect(screen.queryByRole('textbox', { name: '할 일 수정' })).toBeNull()
  })

  it('④ ESC → PATCH 미호출 · 원값 표시', () => {
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '바뀐 값' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(updateNote).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: '할 일 수정' })).toBeNull()
    expect(screen.getByText('이력서 검토')).toBeInTheDocument()
  })

  it('⑤ 빈 값 저장 시도 → PATCH 미호출 · 원값 복원', () => {
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(updateNote).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: '할 일 수정' })).toBeNull()
    expect(screen.getByText('이력서 검토')).toBeInTheDocument()
  })

  it('⑥ PATCH 실패 → 토스트 + 편집 유지(입력값 보존)', () => {
    updateNote.mockImplementation((_v, opts) => opts?.onError?.())
    const textarea = openEditor()
    fireEvent.change(textarea, { target: { value: '실패할 값' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(updateNote).toHaveBeenCalled()
    // 편집 유지 + 입력값 보존
    const stillThere = screen.getByRole('textbox', { name: '할 일 수정' })
    expect(stillThere).toHaveValue('실패할 값')
    // 실패 토스트
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.type === 'error' && t.message.includes('저장에 실패')),
    ).toBe(true)
  })

  it('⑦ 체크박스 토글 회귀 — updateNote(isDone) · 편집 미진입', () => {
    notesByDate = {
      [TODAY]: [note({ id: 'n1', content: '이력서 검토', date: TODAY, isDone: false })],
    }
    renderContent(TODAY)
    fireEvent.click(screen.getByRole('button', { name: '완료 표시' }))
    expect(updateNote).toHaveBeenCalledWith({ id: 'n1', isDone: true })
    expect(screen.queryByRole('textbox', { name: '할 일 수정' })).toBeNull()
  })
})
