/**
 * activity-redesign — 퀵캡처 시나리오:
 * 1. 한 줄 입력 → 기록 → quickCreate({content}) (활동 미지정)
 * 2. 활동 칩 선택 후 저장 → activityId 포함
 * 3. 빈 입력 → 기록 버튼 비활성
 * 4. 🌿 쉬어가기 → isRest 호출
 * 5. 저장 성공 + cl 태그 있음 → "자소서 소재로 저장" 보상 라인 (인사이트 링크)
 * 6. 어제 토글 → occurredAt 어제 날짜
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickCapture } from './QuickCapture'
import type { Activity, ActivityLog } from '@/types/activity'

const quickCreateMock = vi.fn()

// ActivityFormModal(+새 활동)이 react-query 훅 사용 → provider 필요
function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}
let savedLog: Partial<ActivityLog>

vi.mock('@/hooks/useActivities', () => ({
  // ActivityFormModal 이 쓰는 훅들 (open=false 라 mutate 는 미호출)
  useCreateActivity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateActivity: () => ({ mutate: vi.fn(), isPending: false }),
  useActivities: () => ({
    data: [
      { id: 'a-1', name: '코테 스터디', isInbox: false, archivedAt: null },
      { id: 'inbox', name: '기본함', isInbox: true, archivedAt: null },
    ] as Activity[],
  }),
  useQuickCreateLog: () => ({
    mutate: (dto: unknown, opts?: { onSuccess?: (log: unknown) => void }) => {
      quickCreateMock(dto)
      opts?.onSuccess?.(savedLog)
    },
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

describe('QuickCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    savedLog = { id: 'l-1', cat: 'learning', cl: [] }
  })

  it('1) 한 줄 입력 → 기록 (활동 미지정)', () => {
    render(<QuickCapture weekCount={2} />, { wrapper: Wrapper })
    fireEvent.change(screen.getByLabelText('활동 한 줄 기록'), {
      target: { value: '그리디 5문제' },
    })
    fireEvent.click(screen.getByRole('button', { name: '기록' }))
    expect(quickCreateMock).toHaveBeenCalledWith({
      content: '그리디 5문제',
      activityId: undefined,
      occurredAt: undefined,
    })
  })

  it('2) 활동 칩 선택 → activityId 포함 (기본함 칩은 미노출)', () => {
    render(<QuickCapture weekCount={0} />, { wrapper: Wrapper })
    expect(screen.queryByRole('button', { name: '기본함' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '코테 스터디' }))
    fireEvent.change(screen.getByLabelText('활동 한 줄 기록'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: '기록' }))
    expect(quickCreateMock).toHaveBeenCalledWith({
      content: 'x',
      activityId: 'a-1',
      occurredAt: undefined,
    })
  })

  it('3) 빈 입력 → 기록 버튼 비활성', () => {
    render(<QuickCapture weekCount={0} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: '기록' })).toBeDisabled()
  })

  it('4) 쉬어가기 → isRest', () => {
    render(<QuickCapture weekCount={0} />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /오늘은 쉬어가요/ }))
    expect(quickCreateMock).toHaveBeenCalledWith({ isRest: true })
  })

  it('5) cl 태그 저장 → 보상 라인에 "자소서 소재로 저장"', () => {
    savedLog = { id: 'l-2', cat: 'develop', cl: ['job_competency'] }
    render(<QuickCapture weekCount={3} />, { wrapper: Wrapper })
    fireEvent.change(screen.getByLabelText('활동 한 줄 기록'), {
      target: { value: '기록' },
    })
    fireEvent.click(screen.getByRole('button', { name: '기록' }))
    expect(screen.getByText(/자소서 소재로 저장/)).toBeInTheDocument()
    expect(screen.getByText(/이번 주 3일째/)).toBeInTheDocument()
  })

  it('6) 어제 토글 → occurredAt 어제 날짜', () => {
    render(<QuickCapture weekCount={0} />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: '어제' }))
    fireEvent.change(screen.getByLabelText('활동 한 줄 기록'), {
      target: { value: '어제 한 일' },
    })
    fireEvent.click(screen.getByRole('button', { name: '기록' }))
    const dto = quickCreateMock.mock.calls[0][0] as { occurredAt?: string }
    expect(dto.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
