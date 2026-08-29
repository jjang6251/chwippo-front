/**
 * 가입 온보딩 — **계열 1탭 → 즉시 보상 2단** (A안).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 🔴 고르기 전엔 보상 카드가 **DOM 에 없다** (빈 패널을 미리 깔지 않는다)
 *  2. 계열 pill → 1단 즉시 (전형 스텝 + 면접 질문 정확히 3개)
 *  3. 직무 「간호사」 타이핑 → 계열이 **자동 선택**되고 보상이 뜬다
 *  4. 🔴 「승무원」 → 항공 서비스 스텝 (세밀 오버라이드가 계열을 이긴다)
 *  5. 회사 칩 2개 토글 → body `pickedCompanies` 2개 (표시 순서 그대로)
 *  6. 계열을 바꾸면 담아둔 회사가 비워진다 (화면에 없는 회사를 보내지 않는다)
 *  7. 계열 미선택 → 「시작하기」 disabled
 *  8. 건너뛰기 → `{ jobCategories: [] }` 만
 *  9. 저장 중 → 두 버튼 다 disabled + 「저장 중…」
 * 10. 성공 토스트가 담은 장수를 반영한다 (0장·N장)
 * 11. radiogroup · aria-checked (단일 선택이라는 걸 보조기술도 안다)
 * 12. 직무를 지워도 고른 계열이 풀리지 않는다 (보상이 사라지면 안 된다)
 *
 * 2단 노출 조건(회사 3개 미만이면 숨김)은 현재 14계열 전부 3개 이상이라 화면으로 못 잰다 —
 * `seriesOnboarding.test.ts` 의 `hasCompanyReward` 단위 테스트가 그 규칙을 지킨다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupQuestion } from './SignupQuestion'
import { postSignupAnswer, type SignupAnswerBody } from '@/api/users'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/api/users')>('@/api/users')
  return { ...actual, postSignupAnswer: vi.fn() }
})

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const postMock = vi.mocked(postSignupAnswer)
const successToast = vi.mocked(toast.success)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(MemoryRouter, null, children),
  )
}

/**
 * 재진입 가드 검증용 — 실제 라우팅으로 그린다.
 * 🔴 `<Navigate>` 는 모듈 **내부**의 `useNavigate` 를 쓰므로 위 `navigateMock` 에 안 걸린다.
 * 그래서 목적지 라우트를 실제로 두고 「무엇이 그려졌나」로 판정한다.
 */
function renderRouted() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/signup/question'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/signup/question',
            element: React.createElement(SignupQuestion),
          }),
          React.createElement(Route, {
            path: '/calendar',
            element: React.createElement('div', null, '캘린더 화면'),
          }),
        ),
      ),
    ),
  )
}

/** 계열 pill — 단일 선택이라 role 이 radio 다 (드롭다운 option 과도 안 겹친다) */
const pill = (label: string) => screen.getByRole('radio', { name: label })
const startBtn = () => screen.getByRole('button', { name: /시작하기|저장 중/ })
const skipBtn = () => screen.getByRole('button', { name: '건너뛰기' })
const jobInput = () => screen.getByLabelText('직무 (선택)')
/** 계열이 잡히면 그리드가 접히고 판정 칩 한 줄(role=status)이 그 자리에 선다 */
const changeBtn = () => screen.getByRole('button', { name: '바꾸기' })
const seriesChip = () => changeBtn().parentElement as HTMLElement
const expectCollapsedTo = (label: string) => {
  expect(seriesChip()).toHaveTextContent(label)
  expect(screen.queryByRole('radiogroup')).toBeNull()
}

/** 제출 body — 마지막 호출 인자 */
function lastBody(): SignupAnswerBody {
  return postMock.mock.calls[postMock.mock.calls.length - 1][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  postMock.mockResolvedValue(undefined)
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
      signupSeriesId: null,
      signupJobTitle: null,
      sampleCardsDismissedAt: null,
      calendarHomeIntroDismissedAt: null,
      alarmPromptedAt: null,
    },
    accessToken: 'tok',
  })
})

describe('SignupQuestion — 계열 1탭', () => {
  it('1) 🔴 고르기 전엔 보상 카드가 DOM 에 없다 (빈 패널 금지)', () => {
    render(<SignupQuestion />, { wrapper })

    expect(screen.queryByText(/준비 중이시군요/)).toBeNull()
    expect(screen.queryByText(/전형은 보통 이렇게 흘러가요/)).toBeNull()
    expect(screen.queryByText(/면접에선 이런 질문이 나와요/)).toBeNull()
    expect(screen.queryByText(/조사가 준비돼 있어요/)).toBeNull()
    // 21직군 칩 블록도 사라졌다
    expect(screen.queryByRole('radio', { name: '백엔드 개발' })).toBeNull()
    expect(screen.queryByText(/1개 이상 선택/)).toBeNull()
  })

  it('2) 계열 pill → 1단 즉시 (전형 스텝 + 면접 질문 3개)', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('의료·보건·복지'))

    expect(screen.getByText(/의료·보건·복지 준비 중이시군요/)).toBeInTheDocument()
    // health 템플릿 = 서류 제출 → 면접 → 신체검사 → 최종 합격
    expect(screen.getByText('신체검사')).toBeInTheDocument()
    expect(screen.getByText('최종 합격')).toBeInTheDocument()

    // 질문은 정확히 3개 (더도 덜도 아니다)
    expect(screen.getByText(/환자·보호자와 갈등/)).toBeInTheDocument()
    expect(screen.getAllByText('Q')).toHaveLength(3)
  })

  it('3) 직무 「간호사」 타이핑 → 계열 자동 선택(그리드 접힘 + 판정 칩) + 보상 표시', () => {
    render(<SignupQuestion />, { wrapper })
    // 고르기 전엔 그리드가 펼쳐져 있다 (계열 1탭 경로)
    expect(screen.getByRole('radiogroup', { name: '준비 중인 계열' })).toBeInTheDocument()

    fireEvent.change(jobInput(), { target: { value: '간호사' } })

    expectCollapsedTo('의료·보건·복지')
    expect(screen.getByText(/준비 중이시군요/)).toBeInTheDocument()
    expect(startBtn()).not.toBeDisabled()
  })

  it('4) 🔴 「승무원」 → 항공 서비스 스텝 (세밀 오버라이드가 계열을 이긴다)', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '승무원' } })

    // 계열은 영업·판매·서비스로 잡히지만 전형은 승무원 전용이어야 한다
    expectCollapsedTo('영업·판매·서비스')
    expect(screen.getByText('체력·신체검사')).toBeInTheDocument()
    expect(screen.getByText('2차 임원·영어면접')).toBeInTheDocument()
    // 계열 기본(sales) 스텝은 나오지 않는다
    expect(screen.queryByText('인적성·AI역량검사')).toBeNull()
  })

  it('5) 회사 칩 2개 토글 → pickedCompanies 2개 (표시 순서 그대로)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))

    // 누르는 순서를 일부러 뒤집는다 — 저장 순서는 화면 순서를 따라야 한다
    fireEvent.click(screen.getByRole('button', { name: '쿠팡' }))
    fireEvent.click(screen.getByRole('button', { name: '네이버' }))
    expect(screen.getByRole('button', { name: '네이버' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2곳 담김')).toBeInTheDocument()
    // 결과가 버튼에 보인다 — 「담았다」가 화면 밖 카운터가 아니라 다음 행동에 붙는다
    expect(screen.getByRole('button', { name: '카드 2장 담고 시작하기' })).toBeInTheDocument()

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody()).toEqual({
      jobCategories: [],
      seriesId: 'it',
      pickedCompanies: ['네이버', '쿠팡'],
      templateId: 'it_dev',
    })
  })

  it('5-b) 직무를 적으면 jobTitle 이 함께 간다 (계열 라벨은 안 간다)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '  간호사  ' } })

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody()).toEqual({
      jobCategories: [],
      seriesId: 'health',
      jobTitle: '간호사',
    })
  })

  /**
   * 🔴 **서버는 직무 사전이 없다** — 세밀 오버라이드 판정을 재현하지 못한다.
   * 미리보기에 쓴 그 값을 같이 보내지 않으면, 방금 본 항공 서비스 전형 대신
   * 영업·판매 전형이 담긴 카드를 받게 된다 (보상이 곧바로 거짓말이 된다).
   */
  it('5-c) 미리보기에 쓴 templateId 가 함께 간다 (승무원 → air_service)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '승무원' } })
    fireEvent.click(screen.getByRole('button', { name: '대한항공' }))

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody().templateId).toBe('air_service')
    expect(lastBody().pickedCompanies).toEqual(['대한항공'])
  })

  it('5-d) 회사를 안 담으면 templateId 도 안 보낸다 (카드를 안 만드는 경로)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '승무원' } })

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody().templateId).toBeUndefined()
    expect(lastBody().pickedCompanies).toBeUndefined()
  })

  it('6) 계열을 바꾸면 담아둔 회사가 비워진다 (화면에 없는 회사를 보내지 않는다)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))
    fireEvent.click(screen.getByRole('button', { name: '네이버' }))
    expect(screen.getByText('1곳 담김')).toBeInTheDocument()

    // 그리드는 접혀 있다 — 「바꾸기」로 다시 펼치고 고른다
    fireEvent.click(changeBtn())
    expect(pill('IT·개발')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(pill('금융·보험'))
    expectCollapsedTo('금융·보험')
    expect(screen.queryByText(/곳 담김/)).toBeNull()
    expect(screen.queryByRole('button', { name: '네이버' })).toBeNull()

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody().pickedCompanies).toBeUndefined()
    expect(lastBody().seriesId).toBe('finance')
  })

  /**
   * 🔴 CTA 는 **모바일에서 하단 고정**이다 — 회사 6곳이 보이면 원래 위치가 폴드 밖
   * (2026-08-29 실측 `bottom 932` / 폴드 844)이라 「몇 장 담았는지」가 안 보였다.
   * jsdom 은 레이아웃을 계산하지 않으므로 **클래스의 존재**로 고정한다(실측은 Playwright).
   */
  it('6-b) 🔴 액션 줄이 모바일에서 sticky 다 (데스크탑은 static)', () => {
    render(<SignupQuestion />, { wrapper })
    const row = startBtn().closest('.sticky') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.className).toContain('bottom-0')
    expect(row.className).toContain('lg:static')
    // 안내 한 줄도 같은 바 안에 있어야 바 위로 글자가 비쳐 지나가지 않는다
    expect(row.textContent).toContain('언제든 내 정보에서 바꿀 수 있어요')
  })

  it('7) 계열 미선택 → 시작하기 disabled (건너뛰기는 살아 있다)', () => {
    render(<SignupQuestion />, { wrapper })

    expect(startBtn()).toBeDisabled()
    expect(skipBtn()).not.toBeDisabled()
  })

  /**
   * 🔴 목적지가 **캘린더가 아니라 투어**다 (`plans/app-tour.md`). 여기서 곧장 캘린더로
   * 보내면 가입 직후 첫 화면이 빈 캘린더라, 방금 담은 카드로 무엇을 할 수 있는지
   * 아무도 말해주지 않는다. 건너뛴 사람도 같은 곳으로 간다 (무대는 미리보기가 맡는다).
   */
  it('8) 건너뛰기 → jobCategories 빈 배열만 보내고 투어로 간다', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(skipBtn())

    await waitFor(() => expect(postMock).toHaveBeenCalledWith({ jobCategories: [] }))
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/signup/tour', { replace: true }),
    )
    expect(navigateMock).not.toHaveBeenCalledWith('/calendar', { replace: true })
  })

  it('9) 저장 중 → 버튼 disabled + 「저장 중…」', async () => {
    const release: { resolve: (() => void) | null } = { resolve: null }
    postMock.mockImplementation(
      () =>
        new Promise<undefined>((r) => {
          release.resolve = () => r(undefined)
        }),
    )

    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))
    fireEvent.click(startBtn())

    await waitFor(() => expect(screen.getByText(/저장 중/)).toBeInTheDocument())
    expect(startBtn()).toBeDisabled()
    expect(skipBtn()).toBeDisabled()
    // 계열 변경(바꾸기)도 잠긴다 — 저장 중에 답이 바뀌면 보낸 것과 화면이 어긋난다
    expect(changeBtn()).toBeDisabled()

    release.resolve?.()
  })

  it('10) 성공 토스트가 담은 장수를 반영한다 (0장)', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))
    fireEvent.click(startBtn())

    await waitFor(() => expect(successToast).toHaveBeenCalledWith('환영해요! 준비됐어요'))
  })

  it('10-b) 회사를 담았으면 장수를 말해 준다', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))
    fireEvent.click(screen.getByRole('button', { name: '네이버' }))
    fireEvent.click(screen.getByRole('button', { name: '토스' }))
    fireEvent.click(startBtn())

    await waitFor(() =>
      expect(successToast).toHaveBeenCalledWith('환영해요! 지원 예정 카드 2장을 담아뒀어요'),
    )
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/signup/tour', { replace: true }),
    )
  })

  it('11) radiogroup · 단일 선택 (aria-checked 는 언제나 한 개)', () => {
    render(<SignupQuestion />, { wrapper })

    expect(screen.getByRole('radiogroup', { name: '준비 중인 계열' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(14)

    fireEvent.click(pill('IT·개발'))
    expectCollapsedTo('IT·개발')
    fireEvent.click(changeBtn())
    expect(
      screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(1)
    fireEvent.click(pill('교육'))
    expectCollapsedTo('교육')
  })

  it('11-b) 🔴 계열이 잡히면 그리드가 접힌다 — 보상 카드가 입력 바로 아래로 올라온다', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.click(pill('IT·개발'))

    // 접힌 자리: 판정 칩 + 바꾸기. 14개 pill 은 DOM 에서 사라진다
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(changeBtn()).toBeInTheDocument()
    // 바꾸기 → 그리드가 돌아오고 현재 계열이 체크돼 있다
    fireEvent.click(changeBtn())
    expect(screen.getAllByRole('radio')).toHaveLength(14)
    expect(pill('IT·개발')).toHaveAttribute('aria-checked', 'true')
    // 같은 계열을 다시 눌러도 접힌다 (담은 회사는 그대로)
    fireEvent.click(pill('IT·개발'))
    expectCollapsedTo('IT·개발')
  })

  it('12) 직무를 지워도 고른 계열이 풀리지 않는다 (보상이 사라지면 안 된다)', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '간호사' } })
    expectCollapsedTo('의료·보건·복지')

    // 사전이 못 잡는 말로 바꿔도 (=판정 null) 계열은 그대로다
    fireEvent.change(jobInput(), { target: { value: '가나다라' } })
    expectCollapsedTo('의료·보건·복지')
    expect(screen.getByText(/준비 중이시군요/)).toBeInTheDocument()
  })

  /**
   * A안 (CEO 2026-08-28) — 회사 추천은 세밀 그룹 → 계열 순.
   * 13. 🔴 「승무원」 → 항공사 목록 (이마트가 아니다) + 직무 맞춤 문구
   * 14. 🔴 「경찰」 → 2단 자체가 없다 (1단은 있다) — 엉뚱한 회사보다 안 보이는 게 낫다
   * 15. 세밀 목록에서 담은 회사는 목록이 계열로 돌아가면 담긴 것으로 치지 않는다
   */
  it('13) 🔴 「승무원」 → 항공사 목록, 이마트는 없다', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '승무원' } })

    expect(screen.getByRole('button', { name: '아시아나항공' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '제주항공' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이마트' })).toBeNull()
    expect(screen.getByText(/승무원 준비하는 분들이 많이 보는 회사예요/)).toBeInTheDocument()
  })

  it('14) 🔴 「경찰」 → 2단 없음 · 1단(군경 전형)은 있다', () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '경찰' } })

    expectCollapsedTo('공공·공무원·군인')
    expect(screen.getByText('체력검정')).toBeInTheDocument()
    expect(screen.queryByText(/조사가 준비돼 있어요/)).toBeNull()
    expect(screen.queryByText(/많이 보는 회사예요/)).toBeNull()
    // 계열 회사(한국전력공사)로 대신 채우지 않는다
    expect(screen.queryByRole('button', { name: '한국전력공사' })).toBeNull()
  })

  /**
   * 🔴 재진입 가드 (2026-08-29). 이미 온보딩을 끝낸 사람이 이 주소로 들어오면
   * (뒤로가기·북마크·주소창) 답을 다시 받지 않는다 — 서버가 「이미 답변하셨어요」 400 으로
   * 거절하므로, 안 막으면 다 채우고 누른 뒤에야 실패를 본다.
   *
   * 16.   온보딩 완료 사용자 → `/calendar`
   * 17.   신규 사용자는 그대로 렌더
   * 18. 🔴 **제출 성공 직후에는 발동하면 안 된다** — 낙관 갱신이 그 자리에서 `onboardedAt`
   *        을 채우므로, 살아 있는 값을 보면 방금 답한 사람이 투어 대신 캘린더로 튕긴다
   */
  it('16) 온보딩 완료 사용자 → /calendar 로 돌린다 (질문을 다시 안 한다)', () => {
    useAuthStore.setState({
      user: {
        ...useAuthStore.getState().user!,
        onboardedAt: '2026-08-01T00:00:00Z',
      },
    })

    renderRouted()

    expect(screen.getByText('캘린더 화면')).toBeInTheDocument()
    expect(screen.queryByText('어떤 일을 준비하고 계세요?')).toBeNull()
  })

  it('17) 신규 사용자(onboardedAt null)는 그대로 렌더된다', () => {
    renderRouted()

    expect(screen.getByText('어떤 일을 준비하고 계세요?')).toBeInTheDocument()
    expect(screen.queryByText('캘린더 화면')).toBeNull()
  })

  it('18) 🔴 제출 성공 직후 낙관 갱신에 가드가 반응하지 않는다 (투어로 간다)', async () => {
    renderRouted()
    fireEvent.click(pill('IT·개발'))
    fireEvent.click(startBtn())

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/signup/tour', { replace: true }),
    )
    // 낙관 갱신으로 onboardedAt 이 채워졌는데도 캘린더로 튕기지 않았다
    expect(useAuthStore.getState().user?.onboardedAt).not.toBeNull()
    expect(screen.queryByText('캘린더 화면')).toBeNull()
  })

  it('15) 세밀 목록에서 담은 회사는 목록이 계열로 돌아가면 담긴 것으로 치지 않는다', async () => {
    render(<SignupQuestion />, { wrapper })
    fireEvent.change(jobInput(), { target: { value: '승무원' } })
    fireEvent.click(screen.getByRole('button', { name: '아시아나항공' }))
    expect(screen.getByText('1곳 담김')).toBeInTheDocument()

    // 사전 밖 말로 바꾸면 계열(영업·판매) 목록으로 돌아간다 — 아시아나는 그 목록에 없다
    fireEvent.change(jobInput(), { target: { value: '가나다라' } })
    expect(screen.getByRole('button', { name: '이마트' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '아시아나항공' })).toBeNull()
    expect(screen.queryByText(/곳 담김/)).toBeNull()

    fireEvent.click(startBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(lastBody().pickedCompanies).toBeUndefined()
  })
})
