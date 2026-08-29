/**
 * 「직무 표시 + 그 자리 수정」 껍데기 (면접 세션 자료·세션 페이지·자소서 문서에서 쓴다).
 *
 * 🔴 **세 번째 입구였다.** 2026-08-28 실기 결함(직무를 고쳤는데 계열이 안 따라옴)을 좇다가
 * 카드 상세 편집 폼·면접 세션 모달 말고 **여기도 맨 input + `jobTitle` 만 PATCH** 하고
 * 있었다는 걸 발견했다. 테스트가 하나도 없어서 아무도 못 봤다.
 *
 * 시나리오:
 *  1. 「수정」 → 입력이 열리고 현재 직무가 채워진다
 *  2. 직무를 바꿔 저장 → `jobTitle` + `jobTitleSource` + **새 계열 라벨**
 *  3. 🔴 사전이 못 잡으면 `jobCategory: null` (옛 라벨을 지운다)
 *  4. 저장된 옛 어휘 라벨을 역매핑하지 않는다 — 판정은 직무 원문에서만
 *  5. `block` + 직무 없음 → 처음부터 입력 상태 (한 번 더 누르게 하지 않는다)
 *  6. 제안 줄 — 희망 직무와 다르면 뜨고, 같으면 안 뜬다
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobTitleField } from './JobTitleField'
import { useAuthStore } from '@/stores/authStore'
import type { UpdateApplicationDto } from '@/types/application'

const h = vi.hoisted(() => ({
  jobTitle: '승무원' as string | null,
  jobCategory: '영업·판매·서비스' as string | null,
  updateApp: vi.fn(),
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: { id: 'app-1', companyName: '대한항공', jobTitle: h.jobTitle, jobCategory: h.jobCategory },
  }),
  useUpdateApplication: () => ({ mutateAsync: h.updateApp }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

const jobInput = () => screen.getByRole('combobox')

/** 제안 줄(`PromoteJobTitleRow`)이 useMutation 을 쓴다 — 앱에선 늘 Provider 안이다 */
function draw(variant?: 'inline' | 'block') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <JobTitleField applicationId="app-1" variant={variant} />
    </QueryClientProvider>,
  )
}

/** 「수정」을 눌러 입력을 열고, 직무를 바꾼 뒤 저장 → 서버로 갈 payload */
async function editAndSave(nextTitle: string): Promise<UpdateApplicationDto> {
  draw()
  fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(jobInput(), { target: { value: nextTitle } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(h.updateApp).toHaveBeenCalled())
  return h.updateApp.mock.calls[0][0] as UpdateApplicationDto
}

beforeEach(() => {
  vi.clearAllMocks()
  h.jobTitle = '승무원'
  h.jobCategory = '영업·판매·서비스'
  h.updateApp.mockResolvedValue(undefined)
  useAuthStore.getState().clearAuth()
})

describe('JobTitleField(공용) — 그 자리 수정이 계열까지 갱신한다', () => {
  it('1) 「수정」 → 입력이 열리고 현재 직무가 채워진다', () => {
    draw()
    expect(screen.queryByRole('combobox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '수정' }))

    expect(jobInput()).toHaveValue('승무원')
  })

  it('2) 직무를 바꿔 저장 → 새 계열 라벨 + 출처가 함께 간다', async () => {
    const payload = await editAndSave('백엔드')

    expect(payload).toEqual({
      jobTitle: '백엔드',
      jobTitleSource: 'typed',
      // 🔴 예전엔 jobTitle 만 보내서 「영업·판매·서비스」가 그대로 남았다
      jobCategory: 'IT·개발',
    })
  })

  it('3) 🔴 사전이 못 잡으면 jobCategory: null — 옛 라벨을 지운다', async () => {
    const payload = await editAndSave('龍龍龍')

    expect(payload.jobTitle).toBe('龍龍龍')
    expect(payload.jobCategory).toBeNull()
  })

  it('4) 저장된 옛 어휘 라벨을 역매핑하지 않는다', () => {
    h.jobTitle = '백엔드 개발자'
    h.jobCategory = '개발,백엔드' // 구 21어휘 콤마 태그
    draw()

    fireEvent.click(screen.getByRole('button', { name: '수정' }))

    // 직무 원문에서 판정한 계열만 보인다
    expect(screen.getByText(/IT·개발/)).toBeInTheDocument()
    expect(screen.queryByText(/개발,백엔드/)).toBeNull()
  })

  it('5) block + 직무 없음 → 처음부터 입력 상태', () => {
    h.jobTitle = null
    h.jobCategory = null
    draw('block')

    expect(jobInput()).toHaveValue('')
    expect(screen.getByText(/자소서·면접 AI 가 일반론/)).toBeInTheDocument()
  })
})

describe('JobTitleField(공용) — 제안 줄', () => {
  const promoteLink = () => screen.queryByRole('button', { name: /희망 직무/ })

  function signIn(signupJobTitle: string | null) {
    useAuthStore.getState().setUser({
      id: 'u1', nickname: '테스터', email: null, role: 'user',
      onboardedAt: null, termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null,
      onboardedCoinAt: null, signupJobCategories: [], signupOtherText: null,
      signupSeriesId: null, signupJobTitle,
      sampleCardsDismissedAt: null, calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
    })
  }

  it('6) 희망 직무와 다르게 고치면 제안 줄이 뜬다', () => {
    signIn('승무원')
    draw()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))

    // 카드 직무(승무원) == 희망 직무 → 아직 없다
    expect(promoteLink()).toBeNull()
    fireEvent.change(jobInput(), { target: { value: '백엔드' } })

    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘백엔드’로 바꾸기')
  })

  it('6-b) 희망 직무가 비어 있으면 카드 직무를 그대로 「등록하기」', () => {
    signIn(null)
    draw()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))

    expect(promoteLink()).toHaveTextContent('‘승무원’을 내 희망 직무로 등록하기')
  })
})
