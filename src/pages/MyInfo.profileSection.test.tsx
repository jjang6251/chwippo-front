/**
 * 내 정보 › 기본 인적사항 — **희망 직무·계열 블록** (`plans/job-role-first.md` 묶음 3 ②).
 *
 * 온보딩에서 정한 직무를 나중에 바꾸는 **정식 자리**다. 여기가 깨지면 온보딩 하단의
 * 「언제든 내 정보에서 바꿀 수 있어요」가 다시 거짓말이 된다.
 *
 * 시나리오:
 *  1. 저장된 값이 그대로 보이고, 계열 판정도 함께 보인다
 *  2. 🔴 인적사항이 통째로 비어 있어도(빈 상태 카드) 블록은 보인다
 *  3. 직무를 고치고 blur → 직무 + 따라 옮겨간 계열이 한 번에 나간다
 *  4. 바뀐 게 없으면 blur 해도 안 부른다 (no-op PATCH · 서버는 빈 body 에 400)
 *  5. 🔴 타이핑 중 추론 계열만으로는 PATCH 가 안 난다 — 글자마다 저장하면 안 된다
 *  6. 계열을 손으로 고르면 blur 를 안 기다리고 즉시 저장한다
 *  7. 직무를 비우면 `jobTitle: null` (빈 문자열이 아니라) · 🔴 **계열은 남는다**
 *
 * ### 계열만 고른 사용자 (온보딩에서 직무를 안 친 다수)
 *  8. 직무 칸이 비어도 자기 계열이 보인다
 *  9. 🔴 빈 칸을 스치기만 해도 계열이 지워지던 회귀 (2026-08-28 재현·수정)
 * 10. 그 상태에서도 계열을 바꿀 수 있다
 *
 * ### 빈 섹션 · 게이지 칩 지시 · 성별 라벨 · 복사 (대장 44)
 * 11. 🔴 이름·연락처가 둘 다 비면 처음부터 편집 폼이다 (빈 상태 카드 없이)
 * 12. 둘 중 하나라도 있으면 보기 모드로 시작한다
 * 13. 🔴 칩 지시 {edit, focus} → 편집으로 열리고 그 칸(연락처·성별·우편번호)에 포커스
 * 14. 성별은 남성/여성으로 보이고 저장값은 MALE/FEMALE
 * 15. 🔴 편집 폼에는 복사 버튼이 없다 — 복사는 보기 모드 행의 몫
 * 16. 보기 모드 — 이름·영문 이름·연락처·이메일·비상 연락처 행에 복사 버튼
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileSection, type SectionIntent } from './MyInfo'
import { useAuthStore } from '@/stores/authStore'
import { patchJobProfile } from '@/api/users'
import type { UserProfile } from '@/api/myinfo'

vi.mock('@/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/users')>()),
  patchJobProfile: vi.fn(),
}))

const profileData = vi.fn<() => Partial<UserProfile> | undefined>()
const updateProfile = vi.fn()
vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useProfile: () => ({ data: profileData() }),
  useUpdateProfile: () => ({ mutate: updateProfile }),
}))

/** 온보딩을 마친 사용자 — 직무·계열이 이미 차 있는 상태 */
function signIn(over: { signupJobTitle?: string | null; signupSeriesId?: string | null } = {}) {
  useAuthStore.getState().setUser({
    id: 'u1',
    nickname: '테스터',
    email: null,
    role: 'user',
    onboardedAt: '2026-01-01T00:00:00.000Z',
    termsAgreedAt: '2026-01-01T00:00:00.000Z',
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: [],
    signupOtherText: null,
    signupSeriesId: 'health',
    signupJobTitle: '간호사',
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    ...over,
  })
}

function renderSection(intent?: SectionIntent | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ProfileSection sectionRef={() => {}} intent={intent} />
    </QueryClientProvider>,
  )
}

const jobInput = () => screen.getByLabelText('희망 직무')

/** 값을 고치고 칸을 빠져나온다 (필드 단위 자동 저장의 트리거) */
function typeAndBlur(value: string) {
  fireEvent.change(jobInput(), { target: { value } })
  fireEvent.blur(jobInput())
}

/**
 * 🔴 **「안 불렀다」를 재려면 반드시 통과해야 하는 관문.**
 *
 * `mutate` 는 비동기라 `fireEvent` 직후의 동기 단언은 **아직 안 나갔을 뿐인 호출까지
 * 통과시킨다.** 2026-08-28 에 실제로 이것 때문에 계열 유실 회귀 테스트가 거짓 통과했고,
 * 같은 흐름을 flush 하고 다시 재니 `{ seriesId: null }` 이 나가고 있었다.
 */
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  vi.mocked(patchJobProfile).mockResolvedValue(undefined)
  // 인적사항은 채워져 있는 상태가 기본 (빈 상태 카드는 2번에서만 본다)
  profileData.mockReturnValue({ name: '홍길동' })
})

describe('ProfileSection — 희망 직무·계열', () => {
  it('1) 저장된 직무·계열이 그대로 보인다', () => {
    signIn()
    renderSection()

    expect(jobInput()).toHaveValue('간호사')
    expect(screen.getByText(/의료·보건·복지/)).toBeInTheDocument()
    expect(screen.getByText('카드 추가할 때 이 직무가 미리 채워져요')).toBeInTheDocument()
  })

  it('2) 🔴 인적사항이 비어 있어도(편집 폼부터 열린 상태) 블록은 보인다', () => {
    // 온보딩에서 직무는 정했지만 이름·연락처는 아직 안 적은 사람이 정확히 이 상태다
    profileData.mockReturnValue({})
    signIn()
    renderSection()

    expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument()
    expect(jobInput()).toHaveValue('간호사')
  })

  it('3) 직무를 고치고 blur → 직무 + 옮겨간 계열이 한 번에 나간다', async () => {
    signIn()
    renderSection()

    typeAndBlur('백엔드 개발자')

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({
        jobTitle: '백엔드 개발자',
        seriesId: 'it',
      }),
    )
  })

  it('4) 바뀐 게 없으면 blur 해도 안 부른다', async () => {
    signIn()
    renderSection()

    fireEvent.blur(jobInput())

    await flush()
    expect(patchJobProfile).not.toHaveBeenCalled()
  })

  it('5) 🔴 타이핑만으로는 저장이 안 난다 — 글자마다 PATCH 금지', async () => {
    signIn()
    renderSection()

    // 「간」→「간호」→「간호사」 사이에도 계열 추론은 계속 바뀐다
    for (const v of ['백', '백엔', '백엔드', '백엔드 개발자']) {
      fireEvent.change(jobInput(), { target: { value: v } })
    }

    await flush()
    expect(patchJobProfile).not.toHaveBeenCalled()
  })

  it('6) 계열을 손으로 고르면 즉시 저장된다 (pill 은 blur 를 기다릴 자리가 아니다)', async () => {
    signIn()
    renderSection()

    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: 'IT·개발' }))

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({ seriesId: 'it' }),
    )
    // 직무는 안 건드렸으니 안 실린다
    expect(vi.mocked(patchJobProfile).mock.calls[0][0]).not.toHaveProperty('jobTitle')
  })

  /**
   * 🔴 **계열만 고른 사용자** — 온보딩에서 직무를 안 친 다수가 이 상태다
   * (직무 타이핑은 「선택」이고 계열 1탭이 핵심이었다).
   *
   * 8. 직무 칸이 비어도 **자기 계열이 보인다** — 안 보이면 바꿀 길도 없다
   * 9. 🔴 **마운트 → blur 만으로 저장이 나가면 안 된다** — 빈 판정(null)이 저장되면
   *    화면을 스치기만 해도 계열이 지워진다 (데이터 손실)
   * 10. 「다르게 고르기」로 바꾸면 그때는 저장된다
   */
  it('8) 계열만 있는 사용자 — 직무가 비어도 계열 칩이 보인다', () => {
    signIn({ signupJobTitle: null, signupSeriesId: 'health' })
    renderSection()

    expect(jobInput()).toHaveValue('')
    expect(screen.getByText(/의료·보건·복지/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다르게 고르기' })).toBeInTheDocument()
  })

  it('9) 🔴 빈 직무 칸을 스치기만 하면 아무것도 저장되지 않는다 (계열 유실 회귀)', async () => {
    signIn({ signupJobTitle: null, signupSeriesId: 'health' })
    renderSection()

    fireEvent.focus(jobInput())
    fireEvent.blur(jobInput())

    await flush()
    expect(patchJobProfile).not.toHaveBeenCalled()
  })

  it('10) 계열만 있는 사용자도 「다르게 고르기」로 바꿀 수 있다', async () => {
    signIn({ signupJobTitle: null, signupSeriesId: 'health' })
    renderSection()

    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: '공공·공무원·군인' }))

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({ seriesId: 'public' }),
    )
  })

  it('7) 직무를 비우면 jobTitle: null — 빈 문자열이 아니다', async () => {
    signIn()
    renderSection()

    typeAndBlur('   ')

    await waitFor(() => expect(patchJobProfile).toHaveBeenCalled())
    /*
      🔴 계열은 **그대로 남는다.** 「이 칸 비움」은 「계열 취소」가 아니다 — 온보딩에서
      계열만 고른 사용자가 다수라, 직무를 비웠다고 계열까지 지우면 그들은 자기 계열을
      볼 수도 바꿀 수도 없게 된다. 비워도 칩은 계속 보인다(테스트 8).
    */
    expect(patchJobProfile).toHaveBeenCalledWith({ jobTitle: null })
  })
})

describe('ProfileSection — 빈 섹션 · 칩 지시 · 성별 라벨 · 복사', () => {
  const filled: Partial<UserProfile> = {
    name: '홍길동', phone: '010-1234-5678', email_personal: 'a@b.c',
    name_en_last: 'HONG', emergency_phone: '010-0000-0000',
  }
  const intentFor = (focus: string): SectionIntent => ({ section: 'profile', opts: { edit: true, focus }, seq: 1 })

  it('11) 🔴 이름·연락처가 둘 다 비면 처음부터 편집 폼이다 (빈 상태 카드 없이)', () => {
    profileData.mockReturnValue({ user_id: 'u1', birthdate: '2000-01-01' })
    signIn()
    renderSection()
    expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument()
    expect(screen.queryByText(/기본 인적사항 입력하기/)).toBeNull()
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument()
  })

  it('12) 둘 중 하나라도 있으면 보기 모드로 시작한다', () => {
    profileData.mockReturnValue({ name: '홍길동' })
    signIn()
    renderSection()
    expect(screen.queryByPlaceholderText('홍길동')).toBeNull()
    expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument()
  })

  it('13) 🔴 칩 지시 {edit, focus:"phone"} → 편집으로 열리고 연락처 칸에 포커스', () => {
    profileData.mockReturnValue({ name: '홍길동' })
    signIn()
    const { container } = renderSection(intentFor('phone'))
    expect(container.querySelector('input[name="phone"]')).toHaveFocus()
  })

  it('13-a) 「병역」 칩(성별 미저장) → 성별 select 에 포커스', () => {
    profileData.mockReturnValue({ name: '홍길동' })
    signIn()
    const { container } = renderSection(intentFor('gender'))
    expect(container.querySelector('select[name="gender"]')).toHaveFocus()
  })

  it('13-b) 「주소」 칩 → 우편번호 칸에 포커스 (검색 버튼이 그 옆에 있다)', () => {
    profileData.mockReturnValue({ name: '홍길동' })
    signIn()
    const { container } = renderSection(intentFor('address_zip'))
    expect(container.querySelector('input[name="address_zip"]')).toHaveFocus()
  })

  it('14) 성별은 남성/여성으로 보이고 저장값은 MALE/FEMALE', () => {
    profileData.mockReturnValue({ user_id: 'u1' })
    signIn()
    renderSection()
    expect(screen.getByRole('option', { name: '남성' })).toHaveValue('MALE')
    expect(screen.getByRole('option', { name: '여성' })).toHaveValue('FEMALE')
    fireEvent.change(screen.getByLabelText('성별'), { target: { value: 'FEMALE' } })
    expect(updateProfile).toHaveBeenCalledWith({ gender: 'FEMALE' }, expect.anything())
  })

  it('15) 🔴 편집 폼에는 복사 버튼이 없다', () => {
    profileData.mockReturnValue({ user_id: 'u1' })
    signIn()
    renderSection()
    expect(screen.queryAllByTitle('복사')).toHaveLength(0)
  })

  it('16) 보기 모드 — 이름·영문 이름·연락처·이메일·비상 연락처 행에 복사 버튼', () => {
    profileData.mockReturnValue(filled)
    signIn()
    renderSection()
    expect(screen.getAllByTitle('복사')).toHaveLength(5)
  })
})
