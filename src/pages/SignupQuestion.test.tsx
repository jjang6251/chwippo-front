/**
 * W1 — SignupQuestion 페이지 spec.
 *
 * 5축 — selection toggle / counter / "기타" input expand / skip / continue mutation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupQuestion } from './SignupQuestion'
import { postSignupAnswer } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/api/users')>(
    '@/api/users',
  )
  return { ...actual, postSignupAnswer: vi.fn() }
})

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { ...actual, useNavigate: () => navigateMock }
})

const postMock = vi.mocked(postSignupAnswer)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(MemoryRouter, null, children),
  )
}

beforeEach(() => {
  postMock.mockReset()
  postMock.mockResolvedValue(undefined)
  navigateMock.mockReset()
  useAuthStore.setState({
    user: {
      id: 'u1',
      nickname: 'tester',
      email: null,
      role: 'user',
      onboardedAt: null,
      termsAgreedAt: '2026-06-01T00:00:00Z',
      aiConsentAt: null,
      aiConsentVersion: null,
      onboardedCoinAt: null,
      signupJobCategories: null,
      signupOtherText: null,
      sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    },
    accessToken: 'tok',
  })
})

describe('SignupQuestion', () => {
  it('초기 render — 0개 선택 시 "계속하기" disabled + counter "1개 이상"', () => {
    render(<SignupQuestion />, { wrapper })

    const continueBtn = screen.getByRole('button', { name: /계속하기/ })
    expect(continueBtn).toBeDisabled()
    expect(screen.getByText(/1개 이상 선택해주세요/)).toBeInTheDocument()
  })

  it('직군 chip 클릭 → active + counter 갱신 + "계속하기" enabled', () => {
    render(<SignupQuestion />, { wrapper })

    const backendChip = screen.getByRole('button', { name: '백엔드 개발' })
    fireEvent.click(backendChip)

    expect(backendChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1개 선택됨/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /계속하기/ })).not.toBeDisabled()
  })

  it('chip 다중 선택 → counter 증가 + 같은 chip 재클릭 → 해제', () => {
    render(<SignupQuestion />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '백엔드 개발' }))
    fireEvent.click(screen.getByRole('button', { name: 'UI/UX·프로덕트 디자이너' }))
    fireEvent.click(screen.getByRole('button', { name: '마케팅·광고' }))
    expect(screen.getByText(/3개 선택됨/)).toBeInTheDocument()

    // 재클릭 해제
    fireEvent.click(screen.getByRole('button', { name: '백엔드 개발' }))
    expect(screen.getByText(/2개 선택됨/)).toBeInTheDocument()
  })

  it('"기타" 클릭 → input expand (placeholder 표시). 해제 → input 값 clear', () => {
    render(<SignupQuestion />, { wrapper })

    // 기타 미클릭 시 input 은 collapsed (DOM 에는 있지만 max-height:0)
    const otherChip = screen.getByRole('button', { name: '기타' })
    fireEvent.click(otherChip)

    const otherInput = screen.getByPlaceholderText(/어떤 직군이세요/) as HTMLInputElement
    expect(otherInput).toBeInTheDocument()

    fireEvent.change(otherInput, { target: { value: '게임 기획' } })
    expect(otherInput.value).toBe('게임 기획')

    // 해제 → 값 clear
    fireEvent.click(otherChip)
    // input 은 그대로지만 state 가 clear (useEffect 또는 toggle 안에서)
    const otherInputAfter = screen.getByPlaceholderText(/어떤 직군이세요/) as HTMLInputElement
    expect(otherInputAfter.value).toBe('')
  })

  it('"계속하기" 클릭 → postSignupAnswer 호출 + /dashboard navigate', async () => {
    render(<SignupQuestion />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '백엔드 개발' }))
    fireEvent.click(screen.getByRole('button', { name: /계속하기/ }))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith({
        jobCategories: ['백엔드 개발'],
        otherText: undefined,
      })
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('"기타" + otherText 입력 후 continue → otherText 포함 전송', async () => {
    render(<SignupQuestion />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '기타' }))
    const otherInput = screen.getByPlaceholderText(/어떤 직군이세요/)
    fireEvent.change(otherInput, { target: { value: '셰프' } })
    fireEvent.click(screen.getByRole('button', { name: /계속하기/ }))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith({
        jobCategories: ['기타'],
        otherText: '셰프',
      })
    })
  })

  it('"건너뛰기" 클릭 → 빈 array 전송 + /dashboard navigate (선택 0개도 OK)', async () => {
    render(<SignupQuestion />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith({ jobCategories: [] })
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('mutation 진행 중 → "저장 중" 표시', async () => {
    const release: { resolve: (() => void) | null } = { resolve: null }
    postMock.mockImplementation(
      () => new Promise<undefined>((r) => { release.resolve = () => r(undefined) }),
    )

    render(<SignupQuestion />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '백엔드 개발' }))
    fireEvent.click(screen.getByRole('button', { name: /계속하기/ }))

    await waitFor(() => {
      expect(screen.getByText(/저장 중/)).toBeInTheDocument()
    })

    release.resolve?.()
  })
})
