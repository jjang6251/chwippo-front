/**
 * A9 — 결과 입력 모달 시나리오 (케어는 전역 FailedCareOverlay 로 위임):
 * 1. 합격 → celebrate + 닫힘 (케어 없음)
 * 2. 불합격 → 닫히고 showFailedCare 에 스텝 스냅샷 전달
 * 3. app 미로드 상태 불합격 → 빈 스냅샷 폴백 (서류 안내로 흐름)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetResultModal } from './SetResultModal'
import type { Application } from '@/types/application'

const updateMock = vi.fn()
const celebrateMock = vi.fn()
const showFailedCareMock = vi.fn()
let appData: Partial<Application> | undefined

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: appData }),
  useUpdateApplication: () => ({
    mutate: (dto: unknown, opts?: { onSuccess?: () => void }) => {
      updateMock(dto)
      opts?.onSuccess?.()
    },
    isPending: false,
  }),
}))
vi.mock('@/stores/celebrationStore', () => ({
  celebrate: (name: string) => celebrateMock(name),
  showFailedCare: (data: unknown) => showFailedCareMock(data),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const INTERVIEW_APP = {
  currentStepIndex: 2,
  steps: [
    { orderIndex: 0, name: '서류' },
    { orderIndex: 1, name: '코딩테스트' },
    { orderIndex: 2, name: '1차 면접' },
  ],
} as Partial<Application>

function renderModal(onClose = vi.fn()) {
  render(
    <SetResultModal
      open
      onClose={onClose}
      applicationId="app-1"
      companyName="카카오"
    />,
  )
  return onClose
}

describe('SetResultModal (A9 — 전역 케어 위임)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appData = INTERVIEW_APP
  })

  it('1) 합격 → celebrate + 닫힘, 케어 미호출', () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByRole('button', { name: '🎉 합격' }))
    expect(updateMock).toHaveBeenCalledWith({ status: 'PASSED' })
    expect(celebrateMock).toHaveBeenCalledWith('카카오')
    expect(showFailedCareMock).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('2) 불합격 → 닫히고 showFailedCare 에 스냅샷 전달', () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByRole('button', { name: '불합격' }))
    expect(updateMock).toHaveBeenCalledWith({ status: 'FAILED' })
    expect(onClose).toHaveBeenCalled()
    expect(showFailedCareMock).toHaveBeenCalledWith({
      applicationId: 'app-1',
      currentStepIndex: 2,
      steps: [
        { orderIndex: 0, name: '서류' },
        { orderIndex: 1, name: '코딩테스트' },
        { orderIndex: 2, name: '1차 면접' },
      ],
    })
  })

  it('3) app 미로드 불합격 → 빈 스냅샷 폴백', () => {
    appData = undefined
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: '불합격' }))
    expect(showFailedCareMock).toHaveBeenCalledWith({
      applicationId: 'app-1',
      currentStepIndex: 0,
      steps: [],
    })
  })
})
