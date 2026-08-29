/**
 * AddCardModal spec.
 *
 * ## A안 레이아웃 — 핵심 2칸 + 접힌 칩 3개 (2026-08-28)
 *  1. 기본 뷰 = 입력 **2칸뿐**(회사·직무) + 칩 3개 — 마감일·URL·전형은 접혀 있다
 *  2. 칩 클릭 → `aria-expanded` 토글 + 그 칸이 아래로 펼쳐짐 / 다시 누르면 접힘
 *  3. 마감일 펼쳐 입력 → 칩 라벨이 「마감 M/D」로 바뀌고, **접어도** 값·표시가 남는다
 *  4. 공고 링크 펼쳐 입력 → 칩 라벨 「공고 링크 ✓」
 *  5. 전형 칩 → select 노출, 바꾸면 칩 라벨·payload 가 따라온다
 *
 * ## U20 — 서류 마감일 과거 경고 (지난 공고 기록 허용 → 저장 차단 아님)
 *  6. 펼친 마감일에 과거 날짜 → 경고 문구 노출
 *  7. 미래 마감일 → 경고 없음
 *
 * ## 직무 기준 재설계 (`plans/job-role-first.md` 묶음 2)
 *  8. PLANNED 모드 → **회사 한 칸만** (직무·칩 전부 없음)
 *  9. 직무 타이핑 → payload `jobCategory` = 계열 라벨 + `jobTitleSource: 'typed'`
 * 10. 추천 탭 → `jobTitleSource: 'suggestion'`
 * 11. 🔴 아무것도 안 치면 `jobCategory` 는 undefined — **프리셋 자동 선택이 없다**
 * 12. 🔴 signup 직군 답변이 있어도 payload 에 안 간다 (빌려온 값은 저장으로 승격 금지)
 * 13. 공고 URL — 빈 값은 undefined, 입력하면 trim 해서 보낸다
 * 14. 전형 템플릿이 **계열**로 추천된다 (직군 칩이 아니라)
 *
 * 날짜는 컴포넌트와 동일 유틸(todayLocal/addDays, KST) 로 계산 → CI TZ 안전.
 * (데스크탑 Modal 경로 — jsdom matchMedia 미구현 → useIsMobile=false)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddCardModal } from './AddCardModal'
import { useAuthStore } from '@/stores/authStore'
import { patchJobProfile } from '@/api/users'
import { addDays, todayLocal } from '@/utils/datetime'
import type { CreateApplicationDto } from '@/types/application'

// 「앞으로도 ‘X’로 채우기」가 부르는 유일한 네트워크 — 나머지 export 는 실물 그대로 둔다
vi.mock('@/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/users')>()),
  patchJobProfile: vi.fn(),
}))

// 회사명 자동완성 = 네트워크 의존 → 단순 stub 로 대체
vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="회사명" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}))

const mutate = vi.fn()
vi.mock('@/hooks/useApplications', () => ({
  useCreateApplication: () => ({ mutate, isPending: false }),
}))

function renderModal(defaultStatus: 'PLANNED' | 'IN_PROGRESS' = 'IN_PROGRESS') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AddCardModal open onClose={() => {}} defaultStatus={defaultStatus} />
    </QueryClientProvider>,
  )
}

/** 회사명 채우고 제출 → 서버로 갈 payload */
function submit(): CreateApplicationDto {
  fireEvent.change(screen.getByLabelText('회사명'), { target: { value: '카카오' } })
  fireEvent.click(screen.getByRole('button', { name: '추가하기' }))
  return mutate.mock.calls[mutate.mock.calls.length - 1][0] as CreateApplicationDto
}

/** 직무 칸 — underline variant 라 캡션 라벨이 「직무」다 */
function typeJob(text: string) {
  fireEvent.change(screen.getByLabelText('직무'), { target: { value: text } })
}

/*
  접힘 칩 3개. 라벨이 값에 따라 바뀌므로(「+ 마감일」 → 「마감 9/12」) 정규식으로 집는다 —
  이름을 고정 문자열로 박으면 값이 들어온 순간 테스트가 칩을 못 찾는다.
*/
const deadlineChip = () => screen.getByRole('button', { name: /마감/ })
const urlChip = () => screen.getByRole('button', { name: /공고 링크/ })
const templateChip = () => screen.getByRole('button', { name: /^전형:/ })

/** 마감일 칩을 펼치고 날짜를 넣는다 */
function fillDeadline(value: string) {
  fireEvent.click(deadlineChip())
  fireEvent.change(screen.getByLabelText('서류 마감일'), { target: { value } })
}

/** signup 직군 답변이 있는 사용자 — 「빌려올 수 있는 값이 있는데도 안 빌린다」를 재려면 필요 */
function signInWithCategories(categories: string[] | null) {
  signIn({ signupJobCategories: categories })
}

/** 온보딩 답을 갈아 끼운 로그인 사용자 */
function signIn(over: {
  signupJobCategories?: string[] | null
  signupSeriesId?: string | null
  signupJobTitle?: string | null
}) {
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
    signupJobCategories: null,
    signupOtherText: null,
    signupSeriesId: null,
    signupJobTitle: null,
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    ...over,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  vi.mocked(patchJobProfile).mockResolvedValue(undefined)
})

describe('AddCardModal — A안 레이아웃 (핵심 2칸 + 접힌 칩)', () => {
  it('1) 기본 뷰 = 입력 2칸 + 칩 3개 — 마감일·URL·전형은 접혀 있다', () => {
    const { container } = renderModal()

    // 열자마자 보이는 입력은 회사·직무 둘뿐 (예전엔 5칸이 세로로 쌓여 있었다)
    expect(container.querySelectorAll('input')).toHaveLength(2)
    expect(screen.getByLabelText('회사명')).toBeInTheDocument()
    expect(screen.getByLabelText('직무')).toBeInTheDocument()

    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(container.querySelector('input[type="url"]')).toBeNull()
    expect(container.querySelector('select')).toBeNull()

    // 접힌 3항목은 칩으로만 존재한다
    expect(deadlineChip()).toHaveAttribute('aria-expanded', 'false')
    expect(urlChip()).toHaveAttribute('aria-expanded', 'false')
    expect(templateChip()).toHaveAttribute('aria-expanded', 'false')
  })

  it('2) 칩 클릭 → aria-expanded 토글 + 칸 노출/숨김', () => {
    renderModal()

    fireEvent.click(deadlineChip())
    expect(deadlineChip()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('서류 마감일')).toBeInTheDocument()
    // 한 칩을 열어도 나머지는 접힌 채다 (아코디언이 아니라 각각 독립)
    expect(urlChip()).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(deadlineChip())
    expect(deadlineChip()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('서류 마감일')).toBeNull()
  })

  it('3) 마감일 입력 → 칩 라벨이 「마감 M/D」 + 접어도 값이 남는다', () => {
    renderModal()
    const target = addDays(todayLocal(), 7)
    const [, month, day] = target.split('-')
    const expected = `마감 ${Number(month)}/${Number(day)}`

    fillDeadline(target)
    expect(deadlineChip()).toHaveTextContent(expected)

    // 접어도 「채워졌다」는 남아야 한다 — 안 그러면 저장될 값이 화면에서 사라진다
    fireEvent.click(deadlineChip())
    expect(screen.queryByLabelText('서류 마감일')).toBeNull()
    expect(deadlineChip()).toHaveTextContent(expected)
    expect(submit().deadline).toBe(target)
  })

  it('4) 공고 링크 입력 → 칩 라벨 「공고 링크 ✓」', () => {
    renderModal()
    expect(urlChip()).toHaveTextContent('+ 공고 링크')

    fireEvent.click(urlChip())
    fireEvent.change(screen.getByLabelText('공고 링크'), {
      target: { value: 'https://example.com/job/1' },
    })

    expect(urlChip()).toHaveTextContent('공고 링크 ✓')
  })

  it('5) 전형 칩 → select 노출, 바꾸면 칩 라벨·payload 가 따라온다', () => {
    renderModal()
    expect(templateChip()).toHaveTextContent('전형: 일반 대기업')

    fireEvent.click(templateChip())
    fireEvent.change(screen.getByLabelText(/전형 단계/), { target: { value: 'finance' } })

    expect(templateChip()).toHaveTextContent('전형: 금융권')
    expect(screen.getByText(/임원면접/)).toBeInTheDocument() // 단계 미리보기도 갱신
    expect(submit().templateId).toBe('finance')
  })
})

describe('AddCardModal — 과거 마감일 경고 (U20)', () => {
  it('6) 과거 마감일 → 경고 노출', () => {
    renderModal()
    fillDeadline(addDays(todayLocal(), -5))
    expect(screen.getByText(/지난 마감일이에요/)).toBeInTheDocument()
  })

  it('7) 미래 마감일 → 경고 없음', () => {
    renderModal()
    fillDeadline(addDays(todayLocal(), 5))
    expect(screen.queryByText(/지난 마감일이에요/)).toBeNull()
  })
})

describe('AddCardModal — 직무 기준 재설계', () => {
  it('8) PLANNED → 회사 한 칸만 (나머지는 지원 시작 때 묻는다)', () => {
    const { container } = renderModal('PLANNED')

    expect(container.querySelectorAll('input')).toHaveLength(1)
    expect(screen.getByLabelText('회사명')).toBeInTheDocument()
    expect(screen.queryByLabelText('직무')).not.toBeInTheDocument() // 직무
    expect(container.querySelector('input[type="date"]')).toBeNull() // 마감일
    expect(container.querySelector('input[type="url"]')).toBeNull() // 공고 URL
    expect(container.querySelector('select')).toBeNull() // 전형 템플릿
    // 접힘 칩도 없다 — 지원 예정은 「일단 적어두기」라 부가 항목 자체를 안 보여준다
    expect(screen.queryByRole('button', { name: /마감/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /공고 링크/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^전형:/ })).toBeNull()
  })

  it('9) 직무 타이핑 → jobCategory = 계열 라벨 + jobTitleSource: typed', () => {
    renderModal()
    typeJob('간호사')

    const payload = submit()
    expect(payload.jobTitle).toBe('간호사')
    expect(payload.jobCategory).toBe('의료·보건·복지')
    expect(payload.jobTitleSource).toBe('typed')
    expect(payload.needsDetail).toBe(false)
  })

  it('10) 사전 추천 탭 → jobTitleSource: suggestion', () => {
    renderModal()
    typeJob('간호')
    fireEvent.mouseDown(screen.getByText('간호조무사'))

    const payload = submit()
    expect(payload.jobTitle).toBe('간호조무사')
    expect(payload.jobTitleSource).toBe('suggestion')
  })

  it('11) 🔴 직무를 안 치면 jobCategory 는 undefined — 프리셋 자동 선택이 없다', () => {
    renderModal()

    // 예전엔 여기 21개 직군 칩이 있었고 signup 답변이 첫 칩을 자동 선택했다
    expect(screen.queryByRole('button', { name: '백엔드 개발' })).not.toBeInTheDocument()

    const payload = submit()
    expect(payload.jobCategory).toBeUndefined()
    expect(payload.jobTitle).toBeUndefined()
    expect(payload.jobTitleSource).toBeUndefined()
    expect(payload.needsDetail).toBe(true)
  })

  it('12) 🔴 signup 직군 답변이 있어도 payload 에 안 간다 (빌려온 값 금지)', () => {
    signInWithCategories(['백엔드 개발', '데이터·AI'])
    renderModal()

    // 폼 어디에도 그 값이 미리 채워지지 않는다
    expect(screen.queryByText('백엔드 개발')).not.toBeInTheDocument()

    const payload = submit()
    expect(payload.jobCategory).toBeUndefined()
    expect(payload.jobTitleSource).toBeUndefined()
  })

  it('13) 공고 URL — 빈 값은 undefined, 입력하면 trim 해서 보낸다', () => {
    renderModal()

    expect(submit().jobUrl).toBeUndefined()

    fireEvent.click(urlChip())
    fireEvent.change(screen.getByLabelText('공고 링크'), {
      target: { value: '  https://example.com/job/1  ' },
    })
    expect(submit().jobUrl).toBe('https://example.com/job/1')
  })

  /**
   * 온보딩 직무 프리필 (`plans/job-role-first.md` 묶음 2 · 2026-08-28).
   *
   * 15. 온보딩에서 **타이핑한** 직무가 미리 채워지고, 안 건드리면 `prefill` 로 저장된다
   * 16. 🔴 **계열만 고른 사용자는 프리필이 없다** — 시스템 말은 직무로 승격하지 않는다
   * 17. 프리필을 고치면 출처가 `typed` 로 바뀐다 (묵인과 확정을 가른다)
   * 18. 🔴 지원 예정(PLANNED)에는 프리필 값이 **안 나간다** — 직무 칸이 화면에 없다
   */
  it('15) 온보딩 타이핑 직무 → 프리필 + jobTitleSource: prefill', () => {
    signIn({ signupJobTitle: '간호사', signupSeriesId: 'health' })
    renderModal()

    expect(screen.getByLabelText('직무')).toHaveValue('간호사')

    const payload = submit()
    expect(payload.jobTitle).toBe('간호사')
    expect(payload.jobTitleSource).toBe('prefill')
    // 프리필 직무에서 파생한 계열이라 저장돼도 된다 (사람이 쓴 말에서 나온 값)
    expect(payload.jobCategory).toBe('의료·보건·복지')
  })

  it('16) 🔴 계열만 고른 사용자 → 프리필 없음 (라벨 승격 금지)', () => {
    signIn({ signupSeriesId: 'health', signupJobTitle: null })
    renderModal()

    expect(screen.getByLabelText('직무')).toHaveValue('')

    const payload = submit()
    expect(payload.jobTitle).toBeUndefined()
    expect(payload.jobTitleSource).toBeUndefined()
    expect(payload.jobCategory).toBeUndefined()
  })

  it('17) 프리필을 고치면 출처가 typed 로 바뀐다', () => {
    signIn({ signupJobTitle: '간호사' })
    renderModal()
    typeJob('백엔드 개발자')

    const payload = submit()
    expect(payload.jobTitle).toBe('백엔드 개발자')
    expect(payload.jobTitleSource).toBe('typed')
  })

  it('18) 🔴 PLANNED 에는 프리필 값이 안 나간다 (화면에 없는 값을 저장하지 않는다)', () => {
    signIn({ signupJobTitle: '간호사', signupSeriesId: 'health' })
    renderModal('PLANNED')

    expect(screen.queryByLabelText('직무')).not.toBeInTheDocument()

    const payload = submit()
    expect(payload.jobTitle).toBeUndefined()
    expect(payload.jobTitleSource).toBeUndefined()
    expect(payload.jobCategory).toBeUndefined()
  })

  /**
   * ① 제안 줄 — 규칙은 **「카드 직무 ≠ 내 희망 직무」** (CEO 2026-08-28 · 프리필 전제 폐기).
   *
   * 19. 희망 직무와 다르면 「내 희망 직무도 ‘X’로 바꾸기」가 뜬다
   * 20. 누르면 PATCH body + 확인 문구로 바뀌고 줄은 사라진다
   * 21. 🔴 **희망 직무가 비어 있어도 뜬다** — 문구만 「등록하기」로 바뀐다
   *     (자동 반영이 아니라 탭 1번 opt-in 이라 「카드 하나 = 진로」가 되지 않는다)
   * 22. 같은 값이면 안 뜬다 (맞출 게 없다)
   * 23. 빈 값이면 안 뜬다 (「이 카드엔 직무 없음」이지 프로필을 비우란 말이 아니다)
   */
  const promoteLink = () =>
    screen.queryByRole('button', { name: /희망 직무/ })

  it('19) 희망 직무와 다르면 「내 희망 직무도 ‘X’로 바꾸기」가 뜬다', () => {
    signIn({ signupJobTitle: '간호', signupSeriesId: 'health' })
    renderModal()

    expect(promoteLink()).toBeNull() // 아직 프로필 값 그대로
    typeJob('간호사')

    // 받침 없는 「간호사」 → 「로」 (「지상직」이면 「으로」)
    expect(promoteLink()).toHaveTextContent('내 희망 직무도 ‘간호사’로 바꾸기')
  })

  it('20) 누르면 PATCH body 가 나가고 확인 문구로 바뀐다', async () => {
    signIn({ signupJobTitle: '간호', signupSeriesId: 'health' })
    renderModal()
    typeJob('간호사')

    fireEvent.click(promoteLink()!)

    await waitFor(() =>
      expect(patchJobProfile).toHaveBeenCalledWith({
        jobTitle: '간호사',
        seriesId: 'health',
      }),
    )
    expect(
      await screen.findByText(/희망 직무가 ‘간호사’로 바뀌었어요 — 카드 추가할 때 미리 채워져요/),
    ).toBeInTheDocument()
    expect(promoteLink()).toBeNull()
    // 🔴 카드 저장과는 무관하다 — 프로필만 바뀌고 카드 payload 는 기존 그대로
    expect(submit().jobTitle).toBe('간호사')
  })

  it('21) 🔴 희망 직무가 비어 있으면 「등록하기」로 뜬다', () => {
    signIn({ signupJobTitle: null, signupSeriesId: 'health' })
    renderModal()
    typeJob('간호사')

    // 받침 없는 「간호사」 → 「를」
    expect(promoteLink()).toHaveTextContent('‘간호사’를 내 희망 직무로 등록하기')
  })

  it('22) 희망 직무와 같으면 안 뜬다', () => {
    signIn({ signupJobTitle: '간호사', signupSeriesId: 'health' })
    renderModal()

    expect(screen.getByLabelText('직무')).toHaveValue('간호사')
    expect(promoteLink()).toBeNull()
  })

  it('23) 직무를 지우면 안 뜬다 (프로필을 비우란 뜻이 아니다)', () => {
    signIn({ signupJobTitle: '간호', signupSeriesId: 'health' })
    renderModal()
    typeJob('')

    expect(promoteLink()).toBeNull()
  })

  it('14) 전형 템플릿이 계열로 추천된다 (직군 칩이 아니라)', () => {
    renderModal()
    typeJob('백엔드 개발자')

    // 펼치지 않아도 칩 라벨이 추천 결과를 말해 준다
    expect(templateChip()).toHaveTextContent('전형: IT 개발')
    expect(submit().templateId).toBe('it_dev')

    // 미리보기도 같이 따라온다
    fireEvent.click(templateChip())
    expect(screen.getByText(/코딩테스트·과제/)).toBeInTheDocument()
  })
})
