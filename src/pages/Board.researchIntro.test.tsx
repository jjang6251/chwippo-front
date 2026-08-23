/**
 * Board — **기존 사용자를 위한 「보드 진입 1회 노출」.**
 *
 * 스트립은 카드를 만드는 순간에만 뜬다. 이미 카드를 만들어 둔 사람은 그 순간을 영영 못 만나므로,
 * 보드에 들어올 때 **가장 최근 카드**의 조사를 한 번 보여준다.
 *
 * 시나리오 (구현보다 먼저 나열):
 * 1. 기존 사용자(카드 있음·미열람) + 최근 카드에 조사 있음 → **1회 뜸 + 안내 줄**
 * 2. 같은 사용자 재방문 → **안 뜸**(소진됨) + 조사 요청 0
 * 3. 🔴 최근 카드에 **조사 없음** → 안 뜸 + **소진 안 됨** → 조사가 생긴 뒤 재방문하면 **뜸**
 *    ← 이 아크의 핵심. 커버리지가 낮은 지금 배포해도 기회가 낭비되지 않는다
 * 4. 🔴 최근 카드에 조사가 없으면 **다음 카드로 내려가지 않는다** (2번째 카드에 조사가 있어도)
 * 5. 카드 0개 → 안 뜸 + 요청 0
 * 6. 샘플 카드뿐 → 안 뜸 (내가 만든 회사가 아니다)
 * 7. storage 접근 불가 → 안 뜸 (매번 뜨는 것보다 낫다)
 * 8. 카드 추가로 뜬 경우 → **안내 줄 없음** + 소진됨 → 이후 보드 진입 자동 노출 없음
 * 9. 계측 — 두 경로가 다른 이벤트(`_intro` / `_strip`) · 중복 발사 없음
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coverletterDocApi } from '@/api/coverletterDoc'
import { useAuthStore } from '@/stores/authStore'
import { useResearchRevealStore } from '@/stores/researchRevealStore'
import type { Application } from '@/types/application'

function makeApp(over: Partial<Application>): Application {
  return {
    id: 'x', userId: 'u1', companyName: '회사', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0,
    needsDetail: false, isStarred: false, steps: [], createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

/** 오래된 것 → 최근 것 순. 🔴 배열 순서가 아니라 `createdAt` 이 기준이다 */
const OLD = makeApp({ id: 'a1', companyName: '네이버', createdAt: '2026-07-01T00:00:00Z' })
const LATEST = makeApp({ id: 'a2', companyName: '카카오', createdAt: '2026-08-20T00:00:00Z' })

let apps: Application[] = []

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: apps, isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/components/card/CompanyCard', () => ({
  CompanyCard: ({ application }: { application: Application }) => (
    <div data-testid="company-card">{application.companyName}</div>
  ),
}))
vi.mock('@/components/card/AddCardModal', () => ({ AddCardModal: () => null }))
vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

import { Board } from './Board'

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const research = (keyword: string) => ({
  status: 'ok' as const,
  research: {
    interviewKeywords: [{ keyword, category: 'tech' as const }],
    talentProfile: ['도전'],
    businessSummary: '한 줄 요약이다.',
  },
})

const USER = {
  id: 'u1', nickname: 'tester', email: 'a@b.c', role: 'user' as const,
  onboardedAt: '2026-01-01T00:00:00.000Z', termsAgreedAt: '2026-01-01T00:00:00.000Z',
  aiConsentAt: null, aiConsentVersion: null, onboardedCoinAt: null,
  signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
  calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
}

const GUIDE = '이제 카드에서 이런 회사 정보를 볼 수 있어요'
const SEEN_KEY = 'chwippo:research-reveal-seen:u1'

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Board />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/** 실제로 나간 이벤트 이름들 (`lib/clarity` 실구현 + window.clarity 스파이) */
function firedEvents(): string[] {
  const spy = (window as unknown as { clarity?: { mock?: { calls: unknown[][] } } }).clarity
  return (spy?.mock?.calls ?? []).filter((c) => c[0] === 'event').map((c) => String(c[1]))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  localStorage.clear()
  apps = [OLD, LATEST]
  useAuthStore.setState({ user: USER })
  useResearchRevealStore.setState({ appId: null, origin: 'add' })
  vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-clarity')
  ;(window as unknown as { clarity?: unknown }).clarity = vi.fn()
  mockedGet.mockImplementation(async (id: string) =>
    id === 'a2' ? research('추천 알고리즘') : null,
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete (window as unknown as { clarity?: unknown }).clarity
  useAuthStore.setState({ user: null })
})

describe('Board — 보드 진입 1회 노출', () => {
  it('1) 기존 사용자 + 최근 카드에 조사 있음 → 최근 카드로 1회 뜨고 안내 줄이 붙는다', async () => {
    renderBoard()

    const strip = await screen.findByRole('region', { name: '카카오 회사 조사' })
    expect(strip).toHaveTextContent(GUIDE)
    expect(await screen.findByText('추천 알고리즘')).toBeInTheDocument()
    // 🔴 대상은 가장 최근에 만든 카드 하나 — 오래된 카드는 조회조차 하지 않는다
    expect(mockedGet).toHaveBeenCalledWith('a2', { countHit: false })
    expect(mockedGet).not.toHaveBeenCalledWith('a1', expect.anything())
  })

  it('2) 재방문 → 안 뜸 (소진됨) + 조사 요청 0', async () => {
    const first = renderBoard()
    await screen.findByText('추천 알고리즘')
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
    first.unmount()

    // 재방문 = 새 세션. 스토어는 세션성이라 새로고침하면 비어 있고, 소진 기록만 남는다
    useResearchRevealStore.setState({ appId: null, origin: 'add' })
    vi.clearAllMocks()
    renderBoard()
    await waitFor(() => expect(screen.getAllByTestId('company-card').length).toBeGreaterThan(0))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    expect(screen.queryByText(GUIDE)).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('3) 🔴 조사 없음 → 안 뜨고 **소진되지 않는다** → 조사가 생긴 뒤 재방문하면 뜬다', async () => {
    mockedGet.mockResolvedValue(null)
    const first = renderBoard()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('a2', { countHit: false }))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    // 🔴 기회가 그대로 남는다 — 이게 이 설계의 핵심이다
    expect(localStorage.getItem(SEEN_KEY)).toBeNull()
    expect(firedEvents()).toEqual([])
    first.unmount()

    // 며칠 뒤 그 회사 조사가 채워졌다
    useResearchRevealStore.setState({ appId: null, origin: 'add' })
    mockedGet.mockResolvedValue(research('추천 알고리즘'))
    renderBoard()

    const strip = await screen.findByRole('region', { name: '카카오 회사 조사' })
    expect(strip).toHaveTextContent(GUIDE)
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
  })

  it('4) 🔴 최근 카드에 조사가 없으면 다음 카드로 내려가지 않는다', async () => {
    // 오래된 카드에는 조사가 있지만 최근 카드에는 없다
    mockedGet.mockImplementation(async (id: string) =>
      id === 'a1' ? research('분산 시스템') : null,
    )
    renderBoard()

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('a2', { countHit: false }))
    expect(mockedGet).not.toHaveBeenCalledWith('a1', expect.anything())
    expect(screen.queryByText('분산 시스템')).toBeNull()
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
  })

  it('5) 카드 0개 → 안 뜸 + 요청 0', async () => {
    apps = []
    renderBoard()
    await screen.findByText('첫 회사를 추가해볼까요?')
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('6) 샘플 카드뿐 → 안 뜸 (내가 만든 회사가 아니다)', async () => {
    apps = [makeApp({ id: 's1', companyName: '샘플회사', isSample: true, createdAt: '2026-08-21T00:00:00Z' })]
    renderBoard()
    await waitFor(() => expect(screen.getAllByTestId('company-card').length).toBe(1))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('7) storage 접근 불가 → 안 뜸', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    renderBoard()
    await waitFor(() => expect(screen.getAllByTestId('company-card').length).toBeGreaterThan(0))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('8) 카드 추가로 뜬 경우 → 안내 줄 없음 · 소진됨 → 이후 자동 노출 없음', async () => {
    useResearchRevealStore.setState({ appId: 'a2', origin: 'add' })
    const first = renderBoard()

    const strip = await screen.findByRole('region', { name: '카카오 회사 조사' })
    expect(strip).not.toHaveTextContent(GUIDE)
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
    first.unmount()

    // 며칠 뒤 보드 진입 — 같은 회사 걸 또 보여주지 않는다
    useResearchRevealStore.setState({ appId: null, origin: 'add' })
    vi.clearAllMocks()
    renderBoard()
    await waitFor(() => expect(screen.getAllByTestId('company-card').length).toBeGreaterThan(0))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('9) 🔴 계측 — 보드 진입은 _intro, 카드 추가는 _strip · 중복 없음', async () => {
    renderBoard()
    await screen.findByText('추천 알고리즘')
    await waitFor(() => expect(firedEvents()).toEqual(['research_reveal_shown_intro']))

    // 같은 사용자가 카드를 추가하면(같은 세션) 그건 _strip 이다
    useResearchRevealStore.getState().reveal('a2', 'add')
    await waitFor(() =>
      expect(firedEvents()).toEqual([
        'research_reveal_shown_intro',
        'research_reveal_shown_strip',
      ]),
    )
  })

  /**
   * 🔴 **동시성(7축) — 탭 두 개를 동시에 열어 둔 경우.**
   *
   * 소진 기록은 localStorage 라 **탭 사이에 공유되지만 잠금이 없다.** 둘 다 "아직 안 봤음"
   * 을 읽은 뒤 각자 렌더하고 각자 기록하는 경합이 실제로 가능하다.
   *
   * 이 경합이 무해한 이유를 **주장하지 않고 고정한다** — 쓰는 값이 서로 같은 키의 타임스탬프라
   * 나중 쓰기가 앞 쓰기를 덮어도 「봤음」이라는 사실은 변하지 않는다. 위험한 건 반대 경우다:
   * 경합이 키를 **지우거나 비우면** 그 사용자에게 이 노출이 영원히 반복된다.
   * 그래서 마지막 단언(경합 후 새 진입은 안 뜬다)이 이 테스트의 본체다.
   */
  it('🔴 10) 탭 동시 진입 — 둘 다 뜨지만 기회는 하나만 소진된다', async () => {
    // 두 탭이 "아직 안 봤음" 을 동시에 읽은 상태에서 각자 렌더한다
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const twoTabs = render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <Board />
          <Board />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(
        screen.getAllByRole('region', { name: '카카오 회사 조사' }),
      ).toHaveLength(2),
    )
    // 🔴 경합해도 키는 살아 있다 (지워지거나 비지 않는다)
    expect(localStorage.getItem(SEEN_KEY)).toBeTruthy()

    // 🔴 본체 — 경합 뒤 새로 들어오면 안 뜬다. 기회가 되살아나지 않는다
    twoTabs.unmount()
    useResearchRevealStore.setState({ appId: null, origin: 'add' })
    mockedGet.mockClear()
    renderBoard()
    await waitFor(() => expect(mockedGet).not.toHaveBeenCalled())
    expect(screen.queryByText(GUIDE)).toBeNull()
  })
})
