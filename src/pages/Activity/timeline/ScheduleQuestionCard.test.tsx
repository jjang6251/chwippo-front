/**
 * activity-redesign — 일정 질문 카드 시나리오:
 * 1. 질문 렌더 (회사·스텝명·날짜 라벨)
 * 2. 한 줄 남기기 → 입력 전환 → 저장 시 relatedStepId 포함 + onDone
 * 3. 넘기기 → dismiss 저장 + onDone (기록 생성 없음)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleQuestionCard } from './ScheduleQuestionCard'
import { loadDismissedStepIds } from './questionCard'

const quickCreateMock = vi.fn()

vi.mock('@/hooks/useActivities', () => ({
  useQuickCreateLog: () => ({
    mutate: (dto: unknown, opts?: { onSuccess?: () => void }) => {
      quickCreateMock(dto)
      opts?.onSuccess?.()
    },
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const QUESTION = {
  stepId: 's-1',
  applicationId: 'app-1',
  companyName: '삼성전자',
  stepName: '코딩테스트',
  dateLabel: '어제',
}

describe('ScheduleQuestionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('1) 질문 렌더', () => {
    render(<ScheduleQuestionCard question={QUESTION} onDone={vi.fn()} />)
    expect(screen.getByText(/삼성전자 코딩테스트, 어땠어요/)).toBeInTheDocument()
    expect(screen.getByText(/📅 어제 일정/)).toBeInTheDocument()
  })

  it('2) 답 저장 → relatedStepId 포함 + onDone', () => {
    const onDone = vi.fn()
    render(<ScheduleQuestionCard question={QUESTION} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: '한 줄 남기기' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '시간 배분 실패 — 다음엔 쉬운 것부터' },
    })
    fireEvent.click(screen.getByRole('button', { name: '남기기' }))
    expect(quickCreateMock).toHaveBeenCalledWith({
      content: '시간 배분 실패 — 다음엔 쉬운 것부터',
      relatedStepId: 's-1',
    })
    expect(onDone).toHaveBeenCalled()
  })

  it('3) 넘기기 → dismiss + onDone (기록 없음)', () => {
    const onDone = vi.fn()
    render(<ScheduleQuestionCard question={QUESTION} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: '넘기기' }))
    expect(quickCreateMock).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
    expect(loadDismissedStepIds().has('s-1')).toBe(true)
  })
})
