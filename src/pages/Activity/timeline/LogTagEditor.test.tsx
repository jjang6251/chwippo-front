/**
 * activity-redesign — 타임라인 인라인 태그 편집기 시나리오:
 * 1. 초기값 렌더 (기존 태그 pressed 상태)
 * 2. 행동분류 변경 + 역량 해제 → updateLog dto (comps: [] 로 비움) + onClose
 * 3. cat 해제 상태로 저장 → dto 에 cat 미포함 (null 전송 불가 — 기존값 유지 의미론)
 * 4. 취소 → onClose, updateLog 미호출
 * 5. quant 있으면 "기록 상세에서 수정" 안내
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogTagEditor } from './LogTagEditor'
import type { QuantValue } from '@/types/activity'

const updateMock = vi.fn()

vi.mock('@/hooks/useActivities', () => ({
  useUpdateLog: () => ({
    mutate: (
      args: { logId: string; dto: unknown },
      opts?: { onSuccess?: () => void },
    ) => {
      updateMock(args)
      opts?.onSuccess?.()
    },
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

function renderEditor(overrides: Partial<Parameters<typeof LogTagEditor>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <LogTagEditor
      logId="l-1"
      cat="develop"
      comps={['problem_solving']}
      cl={['job_competency']}
      mood={null}
      keywords={['리팩터링']}
      quant={null}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onClose }
}

describe('LogTagEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('1) 초기값 pressed 상태 렌더', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: '개발', pressed: true })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '문제해결', pressed: true }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('키워드')).toHaveValue('리팩터링')
  })

  it('2) 행동분류 변경 + 역량 해제 → updateLog dto + onClose', () => {
    const { onClose } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: '학습' }))
    fireEvent.click(screen.getByRole('button', { name: '문제해결', pressed: true }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(updateMock).toHaveBeenCalledWith({
      logId: 'l-1',
      dto: {
        cat: 'learning',
        comps: [],
        cl: ['job_competency'],
        keywords: ['리팩터링'],
      },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('3) cat 해제 상태로 저장 → dto 에 cat 미포함', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: '개발', pressed: true }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const dto = updateMock.mock.calls[0][0].dto as Record<string, unknown>
    expect('cat' in dto).toBe(false)
  })

  it('4) 취소 → onClose, 저장 미호출', () => {
    const { onClose } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('5) quant 존재 → 기록 상세 안내', () => {
    renderEditor({
      quant: { type: 'count', value: '5', unit: '문제' } as QuantValue,
    })
    expect(screen.getByText(/정량 수치\(5문제\)는 기록 상세에서/)).toBeInTheDocument()
  })
})
