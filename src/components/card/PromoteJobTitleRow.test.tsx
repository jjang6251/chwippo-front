/**
 * 제안 줄 — 「내 희망 직무도 바꾸기 / 등록하기」 (CEO 2026-08-28 결정).
 *
 * 🔴 규칙은 하나: **카드 직무(trim) ≠ 내 희망 직무**. 예전의 「프리필을 고쳤을 때만」
 * 전제는 폐기됐다 — 프로필이 비어 있어도(계열만 고른 사용자) 제안한다. 자동 반영이 아니라
 * 탭 1번 opt-in 이라 「카드 하나 = 진로」가 되지 않는다.
 *
 * 시나리오:
 *  1. 프로필 직무 있음 & 다름 → 「내 희망 직무도 ‘X’{으}로 바꾸기」
 *  2. 프로필 직무 비어 있음 → 「‘X’{을}를 내 희망 직무로 등록하기」
 *  3. 조사 4종 — 간호사(로/를) · 백엔드(로/를)… 받침 유무와 비한글까지
 *  4. 같은 값 · 빈 값 · 공백만 → 안 뜬다
 *  5. 클릭 payload — 사전이 확신하면 그 계열, 아니면 화면에서 고른 계열
 *  6. 성공 문구 — 누른 시점 기준으로 「바뀌었어요」/「등록했어요」
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromoteJobTitleRow } from './PromoteJobTitleRow'
import { patchJobProfile } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/users')>()),
  patchJobProfile: vi.fn(),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn(), show: vi.fn() },
}))

function draw(props: {
  profileTitle: string | null
  jobTitle: string
  seriesId?: string | null
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <PromoteJobTitleRow
        profileTitle={props.profileTitle}
        jobTitle={props.jobTitle}
        seriesId={props.seriesId ?? null}
      />
    </QueryClientProvider>,
  )
}

const link = () => screen.queryByRole('button', { name: /희망 직무/ })

/** 낙관 갱신이 authStore 를 만지므로 로그인 상태가 필요하다 */
function signIn() {
  useAuthStore.getState().setUser({
    id: 'u1', nickname: '테스터', email: null, role: 'user',
    onboardedAt: null, termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null,
    onboardedCoinAt: null, signupJobCategories: [], signupOtherText: null,
    signupSeriesId: null, signupJobTitle: null,
    sampleCardsDismissedAt: null, calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  vi.mocked(patchJobProfile).mockResolvedValue(undefined)
})

describe('PromoteJobTitleRow — 문구', () => {
  it('1) 프로필 직무가 있고 다르면 → 「바꾸기」', () => {
    draw({ profileTitle: '승무원', jobTitle: '간호사' })
    expect(link()).toHaveTextContent('내 희망 직무도 ‘간호사’로 바꾸기')
  })

  it('2) 프로필 직무가 비어 있으면 → 「등록하기」', () => {
    draw({ profileTitle: null, jobTitle: '간호사' })
    expect(link()).toHaveTextContent('‘간호사’를 내 희망 직무로 등록하기')
  })

  it('2-b) 프로필이 공백만이어도 「등록하기」 (채워진 값이 아니다)', () => {
    draw({ profileTitle: '   ', jobTitle: '간호사' })
    expect(link()).toHaveTextContent('내 희망 직무로 등록하기')
  })
})

/**
 * 🔴 조사는 값이 사용자 입력이라 문구에 하나로 박을 수 없다 —
 * 「간호사으로」·「백엔드로」 둘 중 하나는 반드시 틀린다.
 */
describe('PromoteJobTitleRow — 조사(으로/로 · 을/를)', () => {
  it.each([
    // [직무, 「바꾸기」에 붙는 로/으로, 「등록하기」에 붙는 을/를]
    ['간호사', '‘간호사’로', '‘간호사’를'], // 받침 없음
    ['백엔드', '‘백엔드’로', '‘백엔드’를'], // 받침 없음
    ['지상직', '‘지상직’으로', '‘지상직’을'], // 받침 ㄱ
    ['데이터 분석가', '‘데이터 분석가’로', '‘데이터 분석가’를'], // 공백 포함·받침 없음
  ])('%s → %s / %s', (title, ro, eul) => {
    const { unmount } = draw({ profileTitle: '승무원', jobTitle: title })
    expect(link()).toHaveTextContent(`내 희망 직무도 ${ro} 바꾸기`)
    unmount()

    draw({ profileTitle: null, jobTitle: title })
    expect(link()).toHaveTextContent(`${eul} 내 희망 직무로 등록하기`)
  })

  it('한글이 아니면 안전형 — 「PM(으)로」·「PM(을)를」', () => {
    const { unmount } = draw({ profileTitle: '승무원', jobTitle: 'PM' })
    expect(link()).toHaveTextContent('내 희망 직무도 ‘PM’(으)로 바꾸기')
    unmount()

    draw({ profileTitle: null, jobTitle: 'PM' })
    expect(link()).toHaveTextContent('‘PM’(을)를 내 희망 직무로 등록하기')
  })
})

describe('PromoteJobTitleRow — 안 뜨는 경우', () => {
  it.each([
    ['같은 값', '간호사', '간호사'],
    ['앞뒤 공백만 다른 같은 값', '간호사', '  간호사  '],
    ['빈 값', '간호사', ''],
    ['공백만', '간호사', '   '],
    ['프로필도 비고 입력도 빔', null, ''],
  ])('%s → 안 뜬다', (_label, profileTitle, jobTitle) => {
    draw({ profileTitle, jobTitle })
    expect(link()).toBeNull()
  })
})

describe('PromoteJobTitleRow — 클릭', () => {
  it('5) 사전이 확신하면 그 계열을 올린다 (화면 선택보다 우선)', async () => {
    signIn()
    // 화면에선 엉뚱한 계열이 잡혀 있어도 사전 판정이 이긴다
    draw({ profileTitle: '승무원', jobTitle: '간호사', seriesId: 'it' })

    fireEvent.click(link()!)

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({
        jobTitle: '간호사',
        seriesId: 'health',
      }),
    )
  })

  it('5-b) 사전이 못 잡으면 화면에서 고른 계열을 따른다', async () => {
    signIn()
    draw({ profileTitle: '승무원', jobTitle: '龍龍龍', seriesId: 'public' })

    fireEvent.click(link()!)

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({
        jobTitle: '龍龍龍',
        seriesId: 'public',
      }),
    )
  })

  it('5-c) 둘 다 없으면 seriesId: null', async () => {
    signIn()
    draw({ profileTitle: '승무원', jobTitle: '龍龍龍', seriesId: null })

    fireEvent.click(link()!)

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({
        jobTitle: '龍龍龍',
        seriesId: null,
      }),
    )
  })

  it('6) 성공 → 「바뀌었어요」 + 버튼은 사라진다', async () => {
    signIn()
    draw({ profileTitle: '승무원', jobTitle: '간호사' })

    fireEvent.click(link()!)

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      '✓ 희망 직무가 ‘간호사’로 바뀌었어요 — 카드 추가할 때 미리 채워져요',
    )
    expect(link()).toBeNull()
  })

  it('6-b) 🔴 프로필이 비었던 경우엔 「등록했어요」 — 누른 시점 기준으로 남는다', async () => {
    signIn()
    // 성공하면 authStore 가 갱신돼 profileTitle prop 이 채워진 것처럼 되지만,
    // 문구는 **누를 때** 비어 있었다는 사실을 따라가야 한다
    draw({ profileTitle: null, jobTitle: '간호사' })

    fireEvent.click(link()!)

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      '✓ 희망 직무로 등록했어요 — 카드 추가할 때 미리 채워져요',
    )
  })

  /*
    길이는 직무 값에 따라 달라진다 (실측):
      「간호사」   → 40자 (경계 — 넘지 않으므로 text-xs)
      「데이터 분석가」 → 44자 (넘으므로 text-sm)
      「등록했어요」 문장 → 33자 (언제나 text-xs)
  */
  it('6-c) 40자를 넘으면 text-sm 으로 커진다', async () => {
    signIn()
    draw({ profileTitle: '승무원', jobTitle: '데이터 분석가' })
    fireEvent.click(link()!)

    expect(await screen.findByRole('status')).toHaveClass('text-sm')
  })

  it('6-d) 40자 이하는 text-xs 그대로 (경계값 40 포함)', async () => {
    signIn()
    draw({ profileTitle: '승무원', jobTitle: '간호사' })
    fireEvent.click(link()!)

    expect(await screen.findByRole('status')).toHaveClass('text-xs')
  })

  it('6-e) 「등록했어요」 문장은 짧아 언제나 text-xs', async () => {
    signIn()
    draw({ profileTitle: null, jobTitle: '데이터 분석가' })
    fireEvent.click(link()!)

    expect(await screen.findByRole('status')).toHaveClass('text-xs')
  })
})
