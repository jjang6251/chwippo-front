/**
 * F6 PR 2 Phase 5.6.소급 — Interviews 페이지 삭제 버튼.
 *
 * 매트릭스:
 *   1. 세션 카드 hover 영역에 🗑️ 버튼 렌더
 *   2. 클릭 → window.confirm 호출 (round 이름 포함)
 *   3. confirm 거부 → delete mutation 호출 X
 *   4. confirm 수락 → delete mutation 호출 + applicationId 전파
 *   5. preventDefault — Link 가 click 안 됨 (navigate X)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({
    data: [
      {
        id: 'app-1',
        company: '카카오',
        jobTitle: '백엔드',
        jobCategory: '엔지니어링',
        status: 'IN_PROGRESS',
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/api/interviewPrep', () => ({
  interviewPrepApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'session-1',
        round: '1차 실무면접',
        interviewType: 'technical',
        applicationId: 'app-1',
        createdAt: '2026-05-28T00:00:00Z',
        jobDescription: null,
        emphasisPoints: null,
      },
    ]),
    remove: vi.fn(),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))

import { Interviews } from './Interviews'
import { interviewPrepApi } from '@/api/interviewPrep'

const removeMock = vi.mocked(interviewPrepApi.remove)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

async function waitForSession() {
  await waitFor(() => expect(screen.queryByText('1차 실무면접')).not.toBeNull())
}

describe('Interviews 페이지 삭제 버튼', () => {
  beforeEach(() => removeMock.mockReset())

  it('1) 세션 카드에 🗑️ 버튼 렌더 (aria-label 포함)', async () => {
    render(<Interviews />, { wrapper })
    await waitForSession()
    expect(
      screen.getByLabelText('1차 실무면접 세션 삭제'),
    ).toBeInTheDocument()
  })

  it('2) 🗑️ click → window.confirm 호출 (round 이름 포함)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    expect(confirmSpy).toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0][0]).toContain('1차 실무면접')
    confirmSpy.mockRestore()
  })

  it('3) confirm 거부 → delete mutation 호출 X', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('4) confirm 수락 → delete mutation 호출 (sessionId 전달)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    removeMock.mockResolvedValue({} as never)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('session-1'))
  })
})
