/**
 * 질문 은행 D2 — **자소서 0건이 더 이상 차단이 아니다.**
 *
 * 🔴 예전엔 자소서를 1개도 안 고르면 세션 생성 자체를 막았다. AI 생성이 유일한 입구였을 때의
 * 규칙이다. 지금은 **직접 적은 질문을 모으는 것**이 기본 동선이라, 자소서가 없어도 세션을
 * 만들어 기출을 쌓을 수 있어야 한다 — 자소서는 AI 생성의 재료로만 남는다.
 *
 * 🔴 그렇다고 안내까지 지우면 "왜 자소서를 등록해야 하는지" 를 알 방법이 사라진다.
 * 차단은 없애고 **권장은 남긴다** — 0건일 때만 뜨는 안내 + 등록하러 가기.
 *
 * 시나리오:
 *  1. 자소서 0건이어도 세션 생성이 호출된다 (버튼도 활성)
 *  2. 0건이면 안내 박스가 뜨고 「자소서 등록하러 가기」가 그 안에 있다
 *  3. 1건 이상이면 안내 박스는 없다 (있으면 매번 잔소리가 된다)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import { NewInterviewSessionModal } from './NewInterviewSessionModal'

const state = vi.hoisted(() => ({
  coverletters: [] as unknown[],
  /** 카드의 직무 — 비우면 모달 안 직무 입력 블록이 열린다 */
  jobTitle: '백엔드 개발자' as string | null,
  jobCategory: null as string | null,
}))
const createMock = vi.hoisted(() => vi.fn())
const updateAppMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({ data: state.coverletters }),
}))
vi.mock('@/hooks/useActivities', () => ({
  useActivities: () => ({ data: [] }),
  useActivityLogs: () => ({ data: [] }),
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: {
      id: 'app-1',
      companyName: '카카오',
      jobTitle: state.jobTitle,
      jobCategory: state.jobCategory,
      steps: [{ id: 'st-1', name: '1차 실무 면접' }],
      jobPosting: null,
      jobPostingStatus: null,
    },
  }),
  useUpdateApplication: () => ({ mutateAsync: updateAppMock }),
}))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useCreateInterviewPrepSession: () => ({
    mutate: createMock,
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))

const onNeedCoverletter = vi.fn()

const draw = () => {
  // 제안 줄(`PromoteJobTitleRow`)이 useMutation 을 쓴다 — 앱에선 늘 Provider 안이다
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <NewInterviewSessionModal
        applicationId="app-1"
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onNeedCoverletter={onNeedCoverletter}
      />
    </QueryClientProvider>,
  )
}

const GUIDE = /자소서는 AI 질문 생성에 필요해요/

describe('새 면접 세션 — 자소서 0건', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.coverletters = []
    state.jobTitle = '백엔드 개발자'
    state.jobCategory = null
  })

  it('🔴 1) 자소서가 0건이어도 세션 생성이 호출된다', async () => {
    draw()
    // 🔴 드롭다운 value 는 스텝 **이름이 아니라 id** 다 (2026-08-16 — 세션↔스텝 FK 연결).
    //    이름을 넣으면 아무 것도 선택되지 않아 「세션 만들기」가 잠긴 채로 남는다.
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'st-1' },
    })

    const submit = screen.getByRole('button', { name: '세션 만들기' })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock.mock.calls[0][0]).toMatchObject({
      applicationId: 'app-1',
      round: '1차 실무 면접',
      coverletterIds: [],
    })
  })

  it('2) 0건이면 안내 박스와 등록 링크가 보인다', () => {
    draw()
    expect(screen.getByText(GUIDE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '자소서 등록하러 가기' }))
    expect(onNeedCoverletter).toHaveBeenCalled()
  })

  it('3) 자소서가 1건 이상이면 안내 박스가 없다', () => {
    state.coverletters = [
      { id: 'cl-1', category: '지원동기', question: '지원 동기를 적어주세요.' },
    ]
    draw()
    expect(screen.queryByText(GUIDE)).toBeNull()
    expect(
      screen.queryByRole('button', { name: '자소서 등록하러 가기' }),
    ).toBeNull()
  })
})

/**
 * 🔴 직무를 여기서 처음 적는 경로 — **계열도 같이 카드에 저장돼야 한다.**
 *
 * 예전엔 `updateApp({ jobTitle })` 만 보냈다. 카드에 계열이 안 붙으니 보드 태그가 비고,
 * 옛 라벨이 있던 카드였다면 그게 그대로 남았다 (2026-08-28 실기 결함과 같은 원인).
 *
 *  4. 사전이 아는 직무 → `jobCategory` = 계열 라벨 + 출처 `typed`
 *  5. 사전이 모르는 직무 → `jobCategory: null` (**undefined 아님** — 옛 라벨을 지운다)
 *
 * (추천 탭 → 출처 `suggestion` 은 같은 입력기를 쓰는 `AddCardModal`·게이트 모달에서 이미 고정)
 */
describe('새 면접 세션 — 직무 입력이 계열까지 저장한다', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.coverletters = []
    // 카드에 직무가 없어야 모달 안 직무 입력 블록이 열린다
    state.jobTitle = null
    state.jobCategory = null
    updateAppMock.mockResolvedValue(undefined)
  })

  const jobInput = () => screen.getByLabelText(/지원 직무/)

  async function submitWithJob(value: string, pick?: string) {
    draw()
    fireEvent.change(jobInput(), { target: { value } })
    if (pick) fireEvent.mouseDown(screen.getByText(pick))
    fireEvent.change(screen.getByRole('combobox', { name: '' }), {
      target: { value: 'st-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: '세션 만들기' }))
    await waitFor(() => expect(updateAppMock).toHaveBeenCalled())
    return updateAppMock.mock.calls[0][0] as Record<string, unknown>
  }

  it('4) 사전이 아는 직무 → 계열 라벨 + 출처 typed', async () => {
    const payload = await submitWithJob('간호사')
    expect(payload).toEqual({
      jobTitle: '간호사',
      jobTitleSource: 'typed',
      jobCategory: '의료·보건·복지',
    })
  })

  it('5) 🔴 사전이 모르는 직무 → jobCategory: null (undefined 로 뭉개지 않는다)', async () => {
    const payload = await submitWithJob('龍龍龍')
    expect(payload.jobTitle).toBe('龍龍龍')
    expect(payload.jobCategory).toBeNull()
  })
})

describe('새 면접 세션 — 제안 줄', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    state.coverletters = []
    state.jobTitle = null
    state.jobCategory = null
    useAuthStore.getState().clearAuth()
  })

  it('6) 희망 직무와 다르게 적으면 제안 줄이 뜬다', () => {
    signIn('승무원')
    draw()

    expect(promoteLink()).toBeNull()
    fireEvent.change(screen.getByLabelText(/지원 직무/), { target: { value: '간호사' } })

    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘간호사’로 바꾸기')
  })

  it('6-b) 희망 직무와 같게 적으면 안 뜬다', () => {
    signIn('간호사')
    draw()

    fireEvent.change(screen.getByLabelText(/지원 직무/), { target: { value: '간호사' } })

    expect(promoteLink()).toBeNull()
  })
})
