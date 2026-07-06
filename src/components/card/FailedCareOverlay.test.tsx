/**
 * A9 — 전역 탈락 케어 오버레이 시나리오:
 * 1. store 비면 미렌더
 * 2. 면접 도달 스냅샷 → "{1차 면접}까지 간 것…" + 회고 입력
 * 3. 회고 남기기 → failedTakeaway 저장 + 닫힘
 * 4. 건너뛰기 → 저장 없이 닫힘
 * 5. 서류 단계 스냅샷 → "버린 게 아니에요" 안내 (회고 입력 없음)
 * 6. 배경 클릭 → 닫힘
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FailedCareOverlay } from './FailedCareOverlay'
import { useCelebrationStore, type FailedCareData } from '@/stores/celebrationStore'

const updateMock = vi.fn()

vi.mock('@/hooks/useApplications', () => ({
  useUpdateApplication: () => ({
    mutate: (dto: unknown, opts?: { onSuccess?: () => void }) => {
      updateMock(dto)
      opts?.onSuccess?.()
    },
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const INTERVIEW_SNAPSHOT: FailedCareData = {
  applicationId: 'app-1',
  currentStepIndex: 2,
  steps: [
    { orderIndex: 0, name: '서류' },
    { orderIndex: 1, name: '코딩테스트' },
    { orderIndex: 2, name: '1차 면접' },
  ],
}

const DOCS_SNAPSHOT: FailedCareData = {
  applicationId: 'app-1',
  currentStepIndex: 0,
  steps: [
    { orderIndex: 0, name: '서류' },
    { orderIndex: 1, name: '1차 면접' },
  ],
}

describe('FailedCareOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCelebrationStore.getState().dismissFailedCare()
  })

  it('1) store 비면 미렌더', () => {
    const { container } = render(<FailedCareOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('2) 면접 도달 → 노드명 문구 + 회고 입력', () => {
    useCelebrationStore.getState().showFailedCare(INTERVIEW_SNAPSHOT)
    render(<FailedCareOverlay />)
    expect(screen.getByText('1차 면접')).toBeInTheDocument()
    expect(screen.getByText(/까지 간 것 자체가 쌓인 실력/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('3) 회고 남기기 → 저장 + 닫힘', () => {
    useCelebrationStore.getState().showFailedCare(INTERVIEW_SNAPSHOT)
    render(<FailedCareOverlay />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '수치로 답하기' },
    })
    fireEvent.click(screen.getByRole('button', { name: '남기기' }))
    expect(updateMock).toHaveBeenCalledWith({ failedTakeaway: '수치로 답하기' })
    expect(useCelebrationStore.getState().failedCare).toBeNull()
  })

  it('4) 건너뛰기 → 저장 없이 닫힘', () => {
    useCelebrationStore.getState().showFailedCare(INTERVIEW_SNAPSHOT)
    render(<FailedCareOverlay />)
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(updateMock).not.toHaveBeenCalled()
    expect(useCelebrationStore.getState().failedCare).toBeNull()
  })

  it('5) 서류 단계 → "버린 게 아니에요" 안내 (회고 입력 없음)', () => {
    useCelebrationStore.getState().showFailedCare(DOCS_SNAPSHOT)
    render(<FailedCareOverlay />)
    expect(screen.getByText(/버린 게 아니에요/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(useCelebrationStore.getState().failedCare).toBeNull()
  })

  it('6) 배경 클릭 → 닫힘', () => {
    useCelebrationStore.getState().showFailedCare(INTERVIEW_SNAPSHOT)
    render(<FailedCareOverlay />)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(useCelebrationStore.getState().failedCare).toBeNull()
  })
})
