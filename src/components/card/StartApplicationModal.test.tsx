/**
 * StartApplicationModal — 지원 예정 → 지원 시작 전환.
 *
 * ## 시나리오
 *  1. 직무를 적으면 payload 에 `jobTitle` · `jobCategory`(계열 라벨) · `jobTitleSource` 가 실린다
 *  2. 🔴 계열이 안 잡히면 `jobCategory` 를 **안 보낸다** — PATCH 라 빠진 필드는 기존 값이 남는다
 *     (원문은 그대로 저장된다 — 분류 실패가 입력 손실이 되면 안 된다)
 *  3. 마감일 → payload `deadline`
 *  4. 카드 추가 모달과 같은 결 (2026-08-28) — 직무는 밑줄 껍데기, 마감일은 조용한 면
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StartApplicationModal } from './StartApplicationModal'
import { useAuthStore } from '@/stores/authStore'
import { useCelebrationStore } from '@/stores/celebrationStore'
import { shouldCelebrateFirstCard } from '@/utils/firstCardCelebration'
import type { Application, UpdateApplicationDto } from '@/types/application'

vi.mock('@/utils/firstCardCelebration', () => ({
  shouldCelebrateFirstCard: vi.fn(() => false),
}))

const mutate = vi.fn()
vi.mock('@/hooks/useApplications', () => ({
  useUpdateApplication: () => ({ mutate, isPending: false }),
}))

const mockedShouldCelebrate = vi.mocked(shouldCelebrateFirstCard)

// 「앞으로도 ‘X’로 채우기」가 부르는 유일한 네트워크 — 나머지 export 는 실물 그대로 둔다
vi.mock('@/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/users')>()),
  patchJobProfile: vi.fn(),
}))

/** 캐시에 심을 지원 목록 — 첫 카드 판정에 그대로 넘어가는 값이다 */
let seededApplications: Application[] | undefined

function renderModal(currentJobTitle?: string | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  if (seededApplications) qc.setQueryData(['applications'], seededApplications)
  return render(
    <QueryClientProvider client={qc}>
      <StartApplicationModal
        open
        onClose={() => {}}
        applicationId="app-1"
        companyName="카카오"
        currentJobTitle={currentJobTitle}
      />
    </QueryClientProvider>,
  )
}

/** 온보딩에서 직무를 타이핑한 사용자 */
function signInWithOnboardingJob(jobTitle: string | null) {
  useAuthStore.getState().setUser({
    id: 'u1',
    nickname: '테스터',
    email: null,
    role: 'user',
    onboardedAt: null,
    termsAgreedAt: null,
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: [],
    signupOtherText: null,
    signupSeriesId: 'health',
    signupJobTitle: jobTitle,
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
  })
}

function submit(): UpdateApplicationDto {
  fireEvent.click(screen.getByRole('button', { name: '지원 시작' }))
  return mutate.mock.calls[mutate.mock.calls.length - 1][0] as UpdateApplicationDto
}

/** 제출 → 서버 성공까지 흘려보낸다 (연출은 성공 콜백 안에 있다) */
function submitAndSucceed(): void {
  submit()
  const opts = mutate.mock.calls[mutate.mock.calls.length - 1][1] as {
    onSuccess: () => void
  }
  opts.onSuccess()
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  mockedShouldCelebrate.mockReturnValue(false)
  seededApplications = undefined
  useCelebrationStore.getState().dismissFirstCard()
})

describe('StartApplicationModal', () => {
  it('1) 직무 입력 → jobTitle · 계열 라벨 · 출처가 함께 간다', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('직무'), { target: { value: '지상직' } })

    const payload = submit()
    expect(payload.status).toBe('IN_PROGRESS')
    expect(payload.jobTitle).toBe('지상직')
    expect(payload.jobCategory).toBe('영업·판매·서비스')
    expect(payload.jobTitleSource).toBe('typed')
  })

  it('2) 🔴 계열이 안 잡히면 jobCategory 를 안 보낸다 (기존 값 보존) — 원문은 저장된다', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('직무'), { target: { value: '가나다라' } })

    const payload = submit()
    expect(payload.jobTitle).toBe('가나다라')
    expect(payload.jobCategory).toBeUndefined()
  })

  it('3) 마감일 → payload deadline', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('서류 마감일 (선택)'), {
      target: { value: '2026-12-01' },
    })

    expect(submit().deadline).toBe('2026-12-01')
  })

  /**
   * 온보딩 직무 프리필 — **빈 칸에만** 들어간다.
   *
   * 5. 카드에 직무가 없고 온보딩 직무가 있으면 프리필 + 출처 `prefill`
   * 6. 🔴 카드에 이미 적힌 직무가 있으면 **프리필하지 않는다** (덮어쓰기 금지)
   */
  it('5) 빈 직무 카드 → 온보딩 직무 프리필 + jobTitleSource: prefill', () => {
    signInWithOnboardingJob('간호사')
    renderModal(null)

    expect(screen.getByLabelText('직무')).toHaveValue('간호사')

    const payload = submit()
    expect(payload.jobTitle).toBe('간호사')
    expect(payload.jobTitleSource).toBe('prefill')
    expect(payload.jobCategory).toBe('의료·보건·복지')
  })

  it('6) 🔴 카드에 이미 직무가 있으면 프리필하지 않는다 (덮어쓰기 금지)', () => {
    signInWithOnboardingJob('간호사')
    renderModal('지상직')

    expect(screen.getByLabelText('직무')).toHaveValue('지상직')

    const payload = submit()
    expect(payload.jobTitle).toBe('지상직')
    expect(payload.jobTitleSource).toBe('typed')
  })

  it('6-b) 온보딩에서 계열만 고른 사용자 → 프리필 없음', () => {
    signInWithOnboardingJob(null)
    renderModal(null)

    expect(screen.getByLabelText('직무')).toHaveValue('')
    expect(submit().jobTitle).toBeUndefined()
  })

  /**
   * ① 제안 줄 — 규칙은 **「카드 직무 ≠ 내 희망 직무」** (CEO 2026-08-28 · 프리필 전제 폐기).
   * 카드 추가 모달과 같은 컴포넌트·같은 규칙이다.
   */
  const promoteLink = () => screen.queryByRole('button', { name: /희망 직무/ })

  it('7) 희망 직무와 다르면 제안 줄이 뜬다', () => {
    signInWithOnboardingJob('간호')
    renderModal(null)

    expect(promoteLink()).toBeNull()
    fireEvent.change(screen.getByLabelText('직무'), { target: { value: '간호사' } })

    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘간호사’로 바꾸기')
  })

  it('8) 🔴 이미 직무가 적힌 카드를 고칠 때도 뜬다 (규칙이 「다르면」이니까)', () => {
    signInWithOnboardingJob('간호')
    renderModal('지상직')

    fireEvent.change(screen.getByLabelText('직무'), { target: { value: '지상직 승무' } })

    // 받침 있는 「승무」 → 「로」(ㅁ 받침이 아니라 ㅜ 끝) — 조사는 컴포넌트가 계산한다
    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘지상직 승무’로 바꾸기')
  })

  it('8-b) 희망 직무와 같으면 안 뜬다', () => {
    signInWithOnboardingJob('지상직')
    renderModal('지상직')

    expect(promoteLink()).toBeNull()
  })

  /**
   * A5 — **첫 지원 카드 축하가 이 경로에도 있다** (2026-08-29).
   *
   * 온보딩이 담아 준 픽 카드는 `PLANNED` 라 「이미 카드가 있던 사람」으로 세지 않으므로,
   * 그 픽을 여기서 지원 중으로 승격하는 순간이 그 사람의 **첫 「지원 중」 카드**다. 그런데
   * 축하 트리거가 카드 추가 모달 하나뿐이라, 온보딩으로 시작한 사람은 축하를 못 봤다.
   *
   *  9.   판정 true → 연출 (planned:false · hadTemplate:true · 마감일 그대로)
   * 10.   판정 false → 연출 없음
   * 11. 🔴 판정에 넘기는 `createdId` 가 **이 카드 id** — 승격된 자신 때문에 막히면 안 된다
   */
  it('9) 첫 지원 카드면 축하 연출이 뜬다', () => {
    signInWithOnboardingJob(null)
    renderModal(null)
    mockedShouldCelebrate.mockReturnValue(true)

    fireEvent.change(screen.getByLabelText('서류 마감일 (선택)'), {
      target: { value: '2026-12-01' },
    })
    submitAndSucceed()

    expect(useCelebrationStore.getState().firstCard).toEqual({
      appId: 'app-1',
      companyName: '카카오',
      hadTemplate: true,
      deadline: '2026-12-01',
      planned: false,
    })
  })

  it('9-b) 마감일을 안 적었으면 deadline 은 null (거짓 체크 금지)', () => {
    signInWithOnboardingJob(null)
    renderModal(null)
    mockedShouldCelebrate.mockReturnValue(true)

    submitAndSucceed()

    expect(useCelebrationStore.getState().firstCard?.deadline).toBeNull()
  })

  it('10) 첫 카드가 아니면 연출이 없다', () => {
    signInWithOnboardingJob(null)
    renderModal(null)

    submitAndSucceed()

    expect(useCelebrationStore.getState().firstCard).toBeNull()
  })

  it('11) 🔴 판정에 이 카드 id 와 캐시 목록을 그대로 넘긴다', () => {
    signInWithOnboardingJob(null)
    seededApplications = [
      { id: 'app-1', companyName: '카카오', isSample: false } as Application,
    ]
    renderModal(null)

    submitAndSucceed()

    expect(mockedShouldCelebrate).toHaveBeenCalledWith({
      userId: 'u1',
      existingApplications: seededApplications,
      // 승격되는 카드 자신 — 이걸 안 넘기면 자기 자신이 「이미 있던 카드」로 세어진다
      createdId: 'app-1',
    })
  })

  it('4) 카드 추가 모달과 같은 결 — 직무는 밑줄, 마감일은 조용한 면', () => {
    renderModal()

    expect(screen.getByLabelText('직무').className).toContain('border-b-[1.5px]')
    // 마감일은 부가 항목이라 주인공(밑줄)보다 한 단계 조용한 면 — 채움 input 배경이 아니다
    expect(screen.getByLabelText('서류 마감일 (선택)').className).toContain('bg-card')
  })
})
