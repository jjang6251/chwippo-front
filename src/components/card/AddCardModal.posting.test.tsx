/**
 * 카드 추가 모달 — **공고로 만들기** 갈래.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *
 * **토글·NEW 알약**
 *  1. 「지원 중」엔 토글 2칸 · 「지원 예정」엔 토글 자체가 없다
 *  2. 공고 카드가 없고 기간 안이면 NEW 가 붙는다
 *  3. 🔴 공고 카드를 1장이라도 만들었으면 뗀다
 *  4. 🔴 출시 60일이 지나면 뗀다
 *
 * **첫 열림 캡션 · 타이밍 넛지**
 *  5. 첫 열림에 캡션 1회 · 다시 열면 없다
 *  6. 마감일 칩을 **펼친 순간** 넛지 · 접었다 펴도 한 번
 *  7. 다시 열면 넛지도 없다
 *  8. 🔴 넛지를 눌러 공고 모드로 가도 **입력값이 남는다**
 *
 * **붙여넣기 칸**
 *  9. 29자 → 버튼 잠김 / 30자 → 열림
 * 10. 10,000자 초과 → 앞부분만 남고 잘렸다고 그 자리에 적는다
 * 11. 200자 이상 붙으면 4줄 미리보기로 접히고 「전체 보기」가 생긴다
 * 12. 클립보드 버튼은 **지원하는 브라우저에서만** 렌더 (비활성 버튼 금지)
 * 13. 확인 줄이 붙인 글자 수를 말한다
 *
 * **자동 전환**
 * 14. 회사 칸에 200자 이상 붙이면 묻지 않고 공고 모드로 옮긴다
 * 15. 200자 미만은 평소대로 회사명 입력이다
 *
 * **데모**
 * 16. 데모에서만 「샘플 공고 넣어보기」 칩
 *
 * **생성**
 * 17. 🔴 AI 동의를 거절하면 아무 일도 안 일어난다 (생성 중 카드도 안 생긴다)
 * 18. 동의 통과 → 생성 중 카드 추가 + 모달 닫힘 + 파싱 시작
 * 19. 같은 글 재시도 → 「방금 만든 공고예요」 (생성 중 카드는 안 늘어난다)
 * 20. 데모는 동의 게이트를 거치지 않고 바로 시작한다 (백엔드 0)
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AddCardModal } from './AddCardModal'
import { useAuthStore } from '@/stores/authStore'
import { usePendingCardStore, runPostingParse } from '@/stores/pendingCardStore'
import { POSTING_NEW_UNTIL, POSTING_RELEASE_DATE } from '@/utils/postingNew'
import { addDays } from '@/utils/datetime'
import type { Application, PostingMeta } from '@/types/application'

// ── 모킹 ────────────────────────────────────────────────────
// 자동완성은 네트워크 의존 → stub. 🔴 `onPaste` 는 그대로 통과시킨다 (자동 전환의 입구다)
vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: {
    value: string
    onChange: (v: string) => void
    onPaste?: React.ClipboardEventHandler<HTMLInputElement>
  }) => (
    <input
      aria-label="회사명"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onPaste={props.onPaste}
    />
  ),
}))

const mutate = vi.fn()
let applications: Application[] = []
vi.mock('@/hooks/useApplications', () => ({
  useCreateApplication: () => ({ mutate, isPending: false }),
  useApplications: () => ({ data: applications }),
}))

let consentAnswer = true
const ensureConsent = vi.fn(async () => consentAnswer)
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => ensureConsent,
}))

let demo = false
vi.mock('@/contexts/demoMode', () => ({
  useDemoMode: () => demo,
  DemoModeContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// 실제 요청은 실행기가 한다 — 여기선 「시작됐는가」만 본다
vi.mock('@/stores/pendingCardStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/pendingCardStore')>()),
  runPostingParse: vi.fn(),
}))

// ── 헬퍼 ────────────────────────────────────────────────────
const META: PostingMeta = {
  filled: [],
  deadlineKind: null,
  jobPicked: null,
  companySource: null,
  editedFields: [],
  reviewedAt: null,
  extraDates: [],
  callCount: 1,
}

function app(over: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    userId: 'u1',
    companyName: '카카오',
    jobTitle: null,
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

const onClose = vi.fn()
function renderModal(defaultStatus: 'PLANNED' | 'IN_PROGRESS' = 'IN_PROGRESS') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AddCardModal open onClose={onClose} defaultStatus={defaultStatus} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const postingTab = () => screen.getByRole('button', { name: /공고로 만들기/ })
const manualTab = () => screen.getByRole('button', { name: '직접 입력' })
const pasteBox = () => screen.getByLabelText('채용 공고 원문') as HTMLTextAreaElement
const createBtn = () => screen.getByRole('button', { name: /카드 만들기/ })
const deadlineChip = () => screen.getByRole('button', { name: /마감/ })

function signIn(userId = 'u1') {
  useAuthStore.getState().setUser({
    id: userId,
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
  })
}

/** KST 벽시각 고정 — NEW 알약 기간 판정이 오늘(KST)을 본다 */
function freezeKst(ymd: string) {
  vi.setSystemTime(new Date(`${ymd}T12:00:00+09:00`))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  freezeKst(POSTING_RELEASE_DATE)
  vi.clearAllMocks()
  localStorage.clear()
  applications = []
  consentAnswer = true
  demo = false
  usePendingCardStore.getState().reset()
  useAuthStore.getState().clearAuth()
  signIn()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('토글 · NEW 알약', () => {
  it('1) 지원 중엔 토글 2칸 · 지원 예정엔 없다', () => {
    renderModal()
    expect(manualTab()).toHaveAttribute('aria-pressed', 'true')
    expect(postingTab()).toHaveAttribute('aria-pressed', 'false')

    cleanup()
    renderModal('PLANNED')
    expect(screen.queryByRole('button', { name: /공고로 만들기/ })).toBeNull()
  })

  it('2) 공고 카드가 없고 기간 안이면 NEW', () => {
    applications = [app()]
    renderModal()
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })

  it('3) 🔴 공고 카드를 하나라도 만들었으면 뗀다', () => {
    applications = [app({ postingMeta: META })]
    renderModal()
    expect(screen.queryByText('NEW')).toBeNull()
  })

  it('4) 🔴 출시 60일이 지나면 뗀다', () => {
    freezeKst(addDays(POSTING_NEW_UNTIL, 1))
    renderModal()
    expect(screen.queryByText('NEW')).toBeNull()
  })
})

describe('첫 열림 캡션 · 타이밍 넛지', () => {
  const caption = /공고를 통째로 붙이면 회사·전형·날짜까지 채워요/
  const nudge = /공고를 붙이면 마감·전형이 자동으로 채워져요/

  it('5) 첫 열림에 1회 · 다시 열면 없다', () => {
    renderModal()
    expect(screen.getByText(caption)).toBeInTheDocument()
    cleanup()
    renderModal()
    expect(screen.queryByText(caption)).toBeNull()
  })

  it('6·7) 마감일 칩을 펼친 순간 넛지 1회 · 다시 열면 없다', () => {
    renderModal()
    expect(screen.queryByText(nudge)).toBeNull()
    fireEvent.click(deadlineChip())
    expect(screen.getByText(nudge)).toBeInTheDocument()

    // 접었다 다시 펴도 같은 한 번이다 (기회는 이미 소진됐다)
    fireEvent.click(deadlineChip())
    fireEvent.click(deadlineChip())
    expect(screen.getAllByText(nudge)).toHaveLength(1)

    cleanup()
    renderModal()
    fireEvent.click(deadlineChip())
    expect(screen.queryByText(nudge)).toBeNull()
  })

  it('8) 🔴 넛지로 공고 모드에 가도 입력값이 남는다', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('회사명'), { target: { value: '무신사' } })
    fireEvent.click(deadlineChip())
    fireEvent.click(screen.getByRole('button', { name: '→ 공고로 만들기' }))

    expect(postingTab()).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(manualTab())
    expect(screen.getByLabelText('회사명')).toHaveValue('무신사')
  })
})

describe('붙여넣기 칸', () => {
  beforeEach(() => {
    renderModal()
    fireEvent.click(postingTab())
  })

  it('9) 29자는 잠기고 30자면 열린다', () => {
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(29) } })
    expect(createBtn()).toBeDisabled()
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(30) } })
    expect(createBtn()).toBeEnabled()
  })

  it('10) 10,000자를 넘기면 앞부분만 남고 그 자리에 적는다', () => {
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(10_050) } })
    expect(pasteBox().value).toHaveLength(10_000)
    expect(screen.getByRole('alert')).toHaveTextContent(/앞 10,000자만 들어갔어요/)
  })

  it('11) 200자 이상이면 4줄 미리보기로 접힌다', () => {
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(200) } })
    expect(pasteBox()).toHaveAttribute('rows', '4')
    expect(pasteBox()).toHaveAttribute('readonly')

    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
    expect(pasteBox()).toHaveAttribute('rows', '7')
    expect(pasteBox()).not.toHaveAttribute('readonly')
  })

  it('11-b) 「이어 붙이기」 — 접힌 칸을 펼치고 커서를 끝으로 보낸다 (직무 설명을 뒤에 붙일 수 있다)', async () => {
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(200) } })
    expect(pasteBox()).toHaveAttribute('readonly')

    fireEvent.click(screen.getByRole('button', { name: '이어 붙이기' }))
    expect(pasteBox()).not.toHaveAttribute('readonly')
    await waitFor(() => expect(document.activeElement).toBe(pasteBox()))
    expect(pasteBox().selectionStart).toBe(200)

    // 이어서 붙이면 앞 내용 뒤에 붙는다
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(200) + '\n직무 설명' } })
    expect(pasteBox().value.endsWith('직무 설명')).toBe(true)
  })

  it('13) 확인 줄이 붙인 글자 수를 말한다', () => {
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(3214) } })
    expect(screen.getByText(/3,214자 붙었어요/)).toBeInTheDocument()
    expect(screen.getByText('3,214/10,000')).toBeInTheDocument()
  })
})

describe('클립보드 버튼', () => {
  const CLIP = /클립보드에서 붙여넣기/

  it('12) 지원하지 않는 브라우저에선 아예 안 보인다', () => {
    // jsdom 기본 — navigator.clipboard 없음
    renderModal()
    fireEvent.click(postingTab())
    expect(screen.queryByRole('button', { name: CLIP })).toBeNull()
  })

  it('12-b) 지원하면 보인다', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { readText: async () => '' },
    })
    renderModal()
    fireEvent.click(postingTab())
    expect(screen.getByRole('button', { name: CLIP })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})

describe('회사 칸 자동 전환', () => {
  function pasteIntoCompany(text: string) {
    fireEvent.paste(screen.getByLabelText('회사명'), {
      clipboardData: { getData: () => text },
    })
  }

  it('14) 200자 이상이면 묻지 않고 공고 모드로 옮긴다', () => {
    renderModal()
    pasteIntoCompany('공'.repeat(250))
    expect(postingTab()).toHaveAttribute('aria-pressed', 'true')
    expect(pasteBox().value).toHaveLength(250)
  })

  it('15) 200자 미만은 평소대로 회사명 입력', () => {
    renderModal()
    pasteIntoCompany('무신사')
    expect(manualTab()).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('데모', () => {
  it('16) 데모에서만 「샘플 공고 넣어보기」', () => {
    renderModal()
    fireEvent.click(postingTab())
    expect(screen.queryByRole('button', { name: /샘플 공고 넣어보기/ })).toBeNull()

    cleanup()
    demo = true
    renderModal()
    fireEvent.click(postingTab())
    expect(screen.getByRole('button', { name: /샘플 공고 넣어보기/ })).toBeInTheDocument()
  })

  it('20) 데모는 동의 게이트를 거치지 않는다', async () => {
    demo = true
    renderModal()
    fireEvent.click(postingTab())
    fireEvent.change(pasteBox(), { target: { value: '가'.repeat(50) } })
    fireEvent.click(createBtn())

    await waitFor(() => expect(usePendingCardStore.getState().entries).toHaveLength(1))
    expect(ensureConsent).not.toHaveBeenCalled()
    expect(usePendingCardStore.getState().entries[0].demo).toBe(true)
  })
})

describe('생성', () => {
  beforeEach(() => {
    renderModal()
    fireEvent.click(postingTab())
    fireEvent.change(pasteBox(), { target: { value: '공고'.repeat(30) } })
  })

  it('17) 🔴 동의를 거절하면 아무 일도 안 일어난다', async () => {
    consentAnswer = false
    fireEvent.click(createBtn())
    await waitFor(() => expect(ensureConsent).toHaveBeenCalled())
    expect(usePendingCardStore.getState().entries).toHaveLength(0)
    expect(runPostingParse).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('18) 동의 통과 → 생성 중 카드 + 모달 닫힘 + 파싱 시작', async () => {
    fireEvent.click(createBtn())
    await waitFor(() => expect(usePendingCardStore.getState().entries).toHaveLength(1))
    expect(runPostingParse).toHaveBeenCalledWith(
      usePendingCardStore.getState().entries[0].tempId,
      expect.objectContaining({ rawText: '공고'.repeat(30), demo: false }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('19) 같은 글을 곧바로 다시 → 「방금 만든 공고예요」', async () => {
    fireEvent.click(createBtn())
    await waitFor(() => expect(usePendingCardStore.getState().entries).toHaveLength(1))

    // 모달을 다시 열어 같은 글을 붙인 상황
    cleanup()
    renderModal()
    fireEvent.click(postingTab())
    fireEvent.change(pasteBox(), { target: { value: '공고'.repeat(30) } })
    fireEvent.click(createBtn())

    expect(await screen.findByText(/방금 만든 공고예요/)).toBeInTheDocument()
    expect(usePendingCardStore.getState().entries).toHaveLength(1)
  })
})
