/**
 * 직무 게이트 모달 — **공용 입력기로 통일** (`plans/job-role-first.md` 묶음 3 ③).
 *
 * 직무가 들어오는 세 길(온보딩 · 카드 추가 · 이 게이트)이 같은 `JobTitleField` 를 쓴다.
 * 여기만 맨 input 이면 사전 추천도 계열 판정도 이 자리에서만 없는데, 게이트야말로
 * 「필요한 순간에 묻는」 자리라 입력 품질이 제일 중요하다.
 *
 * 시나리오:
 *  1. 게이트가 열리면 공용 입력기가 뜬다 (필수 표시 유지)
 *  2. 타이핑 → 저장 payload = 직무 + 계열 라벨 + 출처 `typed`
 *  3. 사전 추천 탭 → 출처 `suggestion`
 *  4. 🔴 계열을 못 잡으면 `jobCategory` 를 안 보낸다 (「기타」로 뭉치지 않는다)
 *  5. 저장 성공 → 게이트 통과 (모달 닫힘)
 *  6. 저장 실패 → 토스트 + 게이트는 열린 채 (사용자를 통과시키지 않는다)
 *  7. 취소 → 게이트 거절
 *  8. 빈 값이면 저장 버튼이 잠긴다
 *  9. 제안 줄 — 희망 직무와 다르면 뜨고, 같으면 안 뜬다
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobTitleRequiredModal } from './JobTitleRequiredModal'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'

const updateApp = vi.fn()
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { id: 'app-1', companyName: '카카오' } }),
  useUpdateApplication: () => ({ mutateAsync: updateApp }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

/** 게이트를 실제로 요청한 상태로 만든다 — caller 가 기다리는 Promise 까지 흉내낸다 */
function openGate() {
  const gate = useJobTitleGateStore.getState().request('app-1')
  // 제안 줄(`PromoteJobTitleRow`)이 useMutation 을 쓴다 — 앱에선 늘 Provider 안이다
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={qc}>
      <JobTitleRequiredModal />
    </QueryClientProvider>,
  )
  return gate
}

/*
  모달 제목도 「지원 직무를 알려주세요」라 라벨 텍스트로 집으면 dialog 와 둘 다 걸린다.
  `role="combobox"` 는 `JobTitleField` 만 가진다 — 공용 입력기를 쓰고 있다는 단언이기도 하다.
*/
const jobInput = () => screen.getByRole('combobox')
const saveButton = () => screen.getByRole('button', { name: /저장하고 계속|저장 중/ })

beforeEach(() => {
  vi.clearAllMocks()
  useJobTitleGateStore.setState({ applicationId: null, _resolve: null })
  useAuthStore.getState().clearAuth()
  updateApp.mockResolvedValue(undefined)
})

describe('JobTitleRequiredModal — 공용 입력기 경유 저장', () => {
  it('1) 게이트가 열리면 공용 입력기가 뜬다 (필수 표시 유지)', () => {
    openGate()

    expect(jobInput()).toBeInTheDocument()
    // 필수 표시는 ui-specs 규칙 — 공용 컴포넌트로 바꾸면서 잃지 않는다
    expect(screen.getByText('*')).toHaveClass('text-danger')
  })

  it('2) 타이핑 → 직무 + 계열 라벨 + 출처 typed', async () => {
    openGate()
    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(updateApp).toHaveBeenCalledWith({
        jobTitle: '간호사',
        jobTitleSource: 'typed',
        jobCategory: '의료·보건·복지',
      }),
    )
  })

  it('3) 사전 추천을 탭하면 출처가 suggestion', async () => {
    openGate()
    fireEvent.change(jobInput(), { target: { value: '간호' } })
    fireEvent.mouseDown(screen.getByText('간호조무사'))

    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(updateApp).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTitle: '간호조무사',
          jobTitleSource: 'suggestion',
        }),
      ),
    )
  })

  it('4) 🔴 계열을 못 잡으면 jobCategory 를 안 보낸다', async () => {
    openGate()
    // 사전에 없는 말 — 원문은 그대로 저장되고 계열만 빈다 (「기타」로 뭉치지 않는다)
    fireEvent.change(jobInput(), { target: { value: '龍龍龍' } })

    fireEvent.click(saveButton())

    await waitFor(() => expect(updateApp).toHaveBeenCalled())
    expect(updateApp).toHaveBeenCalledWith({
      jobTitle: '龍龍龍',
      jobTitleSource: 'typed',
      jobCategory: undefined,
    })
  })

  it('5) 저장 성공 → 게이트 통과 + 모달 닫힘', async () => {
    const gate = openGate()
    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    fireEvent.click(saveButton())

    await expect(gate).resolves.toBe(true)
    expect(useJobTitleGateStore.getState().applicationId).toBeNull()
  })

  it('6) 저장 실패 → 토스트 + 게이트는 열린 채', async () => {
    openGate()
    updateApp.mockRejectedValueOnce(new Error('boom'))
    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    fireEvent.click(saveButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    // 실패했는데 통과시키면 AI 가 직무 없이 돌아간다
    expect(useJobTitleGateStore.getState().applicationId).toBe('app-1')
  })

  it('7) 취소 → 게이트 거절 (caller 는 silent skip)', async () => {
    const gate = openGate()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    await expect(gate).resolves.toBe(false)
    expect(updateApp).not.toHaveBeenCalled()
  })

  it('8) 빈 값이면 저장 버튼이 잠긴다', () => {
    openGate()

    expect(saveButton()).toBeDisabled()

    fireEvent.change(jobInput(), { target: { value: '   ' } })
    expect(saveButton()).toBeDisabled()
  })
})

describe('JobTitleRequiredModal — 제안 줄', () => {
  const promoteLink = () => screen.queryByRole('button', { name: /희망 직무/ })

  /** 희망 직무를 갈아 끼운 로그인 사용자 */
  function signIn(signupJobTitle: string | null) {
    useAuthStore.getState().setUser({
      id: 'u1', nickname: '테스터', email: null, role: 'user',
      onboardedAt: null, termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null,
      onboardedCoinAt: null, signupJobCategories: [], signupOtherText: null,
      signupSeriesId: null, signupJobTitle,
      sampleCardsDismissedAt: null, calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
    })
  }

  it('9) 희망 직무와 다르게 적으면 제안 줄이 뜬다', () => {
    signIn('승무원')
    openGate()

    expect(promoteLink()).toBeNull()
    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘간호사’로 바꾸기')
  })

  it('9-b) 희망 직무와 같게 적으면 안 뜬다', () => {
    signIn('간호사')
    openGate()

    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    expect(promoteLink()).toBeNull()
  })
})
