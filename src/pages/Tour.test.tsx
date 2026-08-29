/**
 * 앱 소개 투어 v2 — **자동 재생 엔진** (`plans/app-tour.md` 8/28 실기 v2).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 7장이 순서대로 나온다
 *  2. 🔴 **가만히 두면 저절로 넘어간다** (연출 + 읽는 여유 뒤)
 *  3. 🔴 읽는 여유는 글자수에 비례하되 2.5~5초로 잘린다
 *  4. 탭 = 다음 즉시 · ←/→/Space · Esc = 건너뛰기
 *  5. 🔴 길게 누름(≥300ms) = 일시정지, 떼면 재개 (그 사이 자동 진행 0)
 *  6. 🔴 버튼·스텝 노드 위에서 시작한 탭은 재생 조작이 아니다
 *  7. 좌우 스와이프(40px)
 *  8. 🔴 `prefers-reduced-motion` = 수동 모드 (자동 진행 0 · 「다음」 버튼 표시 · 완성 상태)
 *  9. 🔴 탭 이탈(visibilitychange) → 자동 일시정지, 복귀 시 재개
 * 10. 저장 side effect 는 v1 그대로 (건너뛰기·완료·replay·코인·배너·researchIntro)
 * 11. 무대는 **스크롤하지 않는다** — 안 들어가면 `scale` 로 줄인다
 * 12. 장면 4·5·6 이 사전 문장을 끝까지 재생한다
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React, { type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOUR_SCENE_COUNT, Tour } from './Tour'
import {
  READ_MS_MAX,
  READ_MS_MIN,
  SCENE1_OPENING_MS,
  SCENE_READ_MS,
  SCENE2_PHASE_MS,
  SCENE5_PHASE_MS,
  SCENE_PERFORM_MS,
  SCENE_STAGE_TEXT_LEN,
  readMsFor,
} from '@/components/tour/scenePhases'
import { CHOREO } from '@/components/tour/choreo'
import {
  TOUR_CARD_MAX_W,
  TOUR_CARD_W_CLASS,
} from '@/components/tour/TourSceneLayout'
import { addDays, getWeekMonday, todayLocal } from '@/utils/datetime'

/** 엔진이 쓰는 것과 같은 입력 — 무대 글자수만 (제목·설명 DOM 측정은 v3.5 에서 폐지) */
function sceneReadMs(step: number): number {
  return SCENE_READ_MS[step] ?? readMsFor(SCENE_STAGE_TEXT_LEN[step] ?? 0)
}
import {
  SHOWCASE_COMPANY,
  SHOWCASE_COVERLETTER,
  SHOWCASE_DDAY_FINAL,
  SHOWCASE_DDAY_INTERVIEW,
  SHOWCASE_DDAY_SECOND,
  SHOWCASE_DDAY_TASK,
  SHOWCASE_INTERVIEW,
  SHOWCASE_JOB,
  SHOWCASE_NOTE,
  SHOWCASE_PRODUCTS,
  SHOWCASE_RESEARCH_KEYWORDS,
  SHOWCASE_RESEARCH_SECTIONS,
  SHOWCASE_ROLE_INSIGHT,
  SHOWCASE_STATS,
  SHOWCASE_STORY,
  SHOWCASE_TALENT_PROFILE,
} from '@/components/tour/showcase'
import { dismissCalendarHomeIntro, postTourProgress } from '@/api/users'
import { useApplications } from '@/hooks/useApplications'
import { useSetCoinOnboarded } from '@/hooks/useMyCoin'
import { useCompanyResearchCache } from '@/hooks/useCoverletterDoc'
import { markResearchRevealSeen } from '@/utils/researchIntro'
import { useAuthStore } from '@/stores/authStore'
import type { Application, ApplicationStep } from '@/types/application'

vi.mock('@/api/users', async (orig) => ({
  ...(await orig<typeof import('@/api/users')>()),
  postTourProgress: vi.fn(),
  dismissCalendarHomeIntro: vi.fn(),
}))
vi.mock('@/hooks/useApplications', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useApplications')>()),
  useApplications: vi.fn(),
}))
vi.mock('@/hooks/useMyCoin', () => ({ useSetCoinOnboarded: vi.fn() }))
vi.mock('@/hooks/useCoverletterDoc', () => ({ useCompanyResearchCache: vi.fn() }))
vi.mock('@/utils/researchIntro', () => ({
  markResearchRevealSeen: vi.fn(),
  hasSeenResearchReveal: vi.fn(() => true),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

/**
 * 🔴 폭죽은 **호출 횟수로만** 검증한다 — jsdom 에는 캔버스 2D 컨텍스트가 없어 진짜
 * `canvas-confetti` 는 여기서 아무것도 못 그린다. 확인해야 하는 계약은 셋이다:
 * ① 2장에서 **딱 한 번** 터진다 ② 모션 최소화면 **0번** ③ 장면을 떠나면 `reset()`.
 */
const confettiMock = vi.hoisted(() => {
  const fire = vi.fn()
  const reset = vi.fn()
  const instance = Object.assign(fire, { reset })
  return { fire, reset, create: vi.fn(() => instance) }
})
vi.mock('canvas-confetti', () => ({
  default: Object.assign(vi.fn(), {
    create: confettiMock.create,
    reset: vi.fn(),
  }),
}))

const postMock = vi.mocked(postTourProgress)
const dismissMock = vi.mocked(dismissCalendarHomeIntro)
const appsMock = vi.mocked(useApplications)
const coinHookMock = vi.mocked(useSetCoinOnboarded)
const researchMock = vi.mocked(useCompanyResearchCache)
const markSeenMock = vi.mocked(markResearchRevealSeen)
const coinMutate = vi.fn()

type AppsResult = ReturnType<typeof useApplications>
type ResearchResult = ReturnType<typeof useCompanyResearchCache>

function mockApps(data: Application[] | undefined, isPending = false) {
  appsMock.mockReturnValue({ data, isPending } as unknown as AppsResult)
}

function step(name: string, orderIndex: number): ApplicationStep {
  return {
    id: `s-${orderIndex}`,
    applicationId: 'a1',
    orderIndex,
    name,
    scheduledDate: null,
    location: null,
    notes: null,
    pinnedContent: null,
  }
}

const REAL_APP: Application = {
  id: 'a1',
  userId: 'u1',
  companyName: '대한항공',
  jobTitle: '승무원',
  jobCategory: null,
  status: 'PLANNED',
  jobUrl: null,
  memo: null,
  currentStepIndex: 0,
  needsDetail: false,
  isStarred: false,
  isSample: false,
  createdVia: 'onboarding_pick',
  steps: [
    step('서류 제출', 0),
    step('1차 실무면접', 1),
    step('최종 합격', 2),
  ],
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
}

function setUser(over: Partial<Record<string, unknown>> = {}) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      nickname: 'tester',
      email: null,
      role: 'user',
      onboardedAt: '2026-08-28T00:00:00Z',
      termsAgreedAt: '2026-08-01T00:00:00Z',
      aiConsentAt: null,
      aiConsentVersion: null,
      onboardedCoinAt: null,
      signupJobCategories: [],
      signupOtherText: null,
      signupSeriesId: 'sales',
      signupJobTitle: '승무원',
      sampleCardsDismissedAt: null,
      calendarHomeIntroDismissedAt: null,
      alarmPromptedAt: null,
      ...over,
    },
    accessToken: 'tok',
  })
}

/** `prefers-reduced-motion` 을 켜고 끄는 스위치 — 수동 모드 검증용 */
let reducedMotion = false
function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function renderTour(path = '/signup/tour') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(MemoryRouter, { initialEntries: [path] }, children),
    )
  return render(<Tour />, { wrapper })
}

const surface = () => document.querySelector('[data-tour-scene]') as HTMLElement
const progress = () => screen.getByText(/7장 중 \d장/).textContent
const skipBtn = () => screen.getByRole('button', { name: '건너뛰기' })

/**
 * 재생 장면 하나가 확실히 끝나고 남을 만큼 (연출 + 읽는 여유 상한).
 * 🔴 읽기 override 가 있는 장면(1장 1.5s 등)은 그 값을 쓴다 — 상한(9.5s)으로 흘리면
 * 다음 장면까지 통째로 지나가 버려 「2장」 단언이 「3장」에서 깨진다.
 */
const overScene = (n: number) => (SCENE_PERFORM_MS[n] ?? 1000) + sceneReadMs(n) + 400

/**
 * 타이머를 흘린다.
 *
 * 🔴 **잘게 나눠 흘린다.** 연출은 「타이머 → setState → effect 가 다음 타이머 예약」의
 * 사슬이라(`usePhase`), 한 번의 `advanceTimersByTime` 으로 통째로 밀면 **React 가 커밋할
 * 틈이 없어 두 번째 단계부터 예약되지 않는다.** `act` 한 번에 한 칸씩 흘려야 사슬이 돈다.
 */
function advance(ms: number, chunk = 50) {
  for (let elapsed = 0; elapsed < ms; elapsed += chunk) {
    act(() => {
      vi.advanceTimersByTime(Math.min(chunk, ms - elapsed))
    })
  }
}

/** 눌렀다 떼기 — 탭·길게 누름·스와이프가 전부 이 한 쌍에서 갈린다 */
function press(el: HTMLElement, opts: { from?: number; to?: number; hold?: number } = {}) {
  const from = opts.from ?? 100
  fireEvent.pointerDown(el, { clientX: from })
  if (opts.hold) advance(opts.hold)
  fireEvent.pointerUp(el, { clientX: opts.to ?? from })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.clearAllMocks()
  reducedMotion = false
  installMatchMedia()
  postMock.mockResolvedValue(undefined)
  dismissMock.mockResolvedValue(undefined)
  coinHookMock.mockReturnValue({
    mutate: coinMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useSetCoinOnboarded>)
  researchMock.mockReturnValue({ data: undefined } as unknown as ResearchResult)
  mockApps([REAL_APP])
  setUser()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Tour v2 — 자동 재생', () => {
  it('1) 7장이 순서대로 나온다', () => {
    renderTour()
    expect(progress()).toBe('7장 중 1장')
    expect(
      screen.getByRole('heading', { name: '지원 카드 한 장으로 시작해요' }),
    ).toBeInTheDocument()

    const titles = [
      '단계를 옮기면 D-day 와 캘린더가 따라와요',
      '회사 조사가 카드 안에 들어 있어요',
      '자소서, AI 가 초안까지 써 줘요',
      '면접, 실제처럼 답해 보고 피드백까지',
      '공부 노트에 준비를 쌓아요',
      '이제 내 카드로 시작해요',
    ]
    for (const [i, name] of titles.entries()) {
      press(surface())
      expect(progress()).toBe(`7장 중 ${i + 2}장`)
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('2) 🔴 가만히 두면 저절로 다음 장으로 넘어간다', () => {
    renderTour()
    expect(progress()).toBe('7장 중 1장')

    advance(overScene(1))
    expect(progress()).toBe('7장 중 2장')

    advance(overScene(2))
    expect(progress()).toBe('7장 중 3장')
  })

  it('2-b) 🔴 마지막 장은 저절로 끝나지 않는다 (완료는 사람이 누른다)', () => {
    renderTour(`/signup/tour?step=${TOUR_SCENE_COUNT}`)

    advance(overScene(7) * 2)

    expect(postMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(progress()).toBe('7장 중 7장')
  })

  it('3) 🔴 장면이 끝나기 전에는 넘어가지 않는다 (읽는 여유가 있다)', () => {
    renderTour()
    // 연출만 끝난 시점 — 읽을 시간은 아직 남아 있어야 한다
    advance(SCENE_PERFORM_MS[1] + 100)
    expect(progress()).toBe('7장 중 1장')
  })

  it('3-b) 진행 바가 장면 길이만큼 채워지도록 duration 이 설정된다', () => {
    const { container } = renderTour()
    const bars = container.querySelectorAll('.animate-tourProgress')
    expect(bars).toHaveLength(1)
    const ms = Number.parseInt((bars[0] as HTMLElement).style.animationDuration, 10)
    expect(ms).toBe(SCENE_PERFORM_MS[1] + sceneReadMs(1))
    expect(ms).toBeLessThanOrEqual(SCENE_PERFORM_MS[1] + READ_MS_MAX)
  })

  /**
   * 🔴 읽는 시간 규칙은 **하나**다 — `DWELL` 고정 대기 + 제목만 세던 이중 규칙이
   * 「1장은 길고 3장은 짧다」를 만들었다 (CEO 실기).
   */
  describe('읽기 시간 계산', () => {
    it('글자 0 → 하한 1500ms', () => {
      expect(readMsFor(0)).toBe(READ_MS_MIN)
      expect(READ_MS_MIN).toBe(1500)
    })

    it('200자 → 7000 이지만 상한 3200 으로 잘린다 (8/29: ④⑥ 완성 뒤 너무 길어 6.5→4.0→3.2)', () => {
      expect(200 * 35).toBe(7000)
      expect(readMsFor(200)).toBe(READ_MS_MAX)
      expect(READ_MS_MAX).toBe(3200)
    })

    it('중간 구간은 글자수에 비례한다 (35ms/자 — 8/29 실측 후 25 에서 올림)', () => {
      // 80자 — 하한(1500)·상한(3200) 사이의 비례 구간
      expect(readMsFor(80)).toBe(2800)
    })

    /**
     * 🔴 override 는 **둘뿐**이다 — 3장(내용은 늘리고 대기는 줄인다)·5장(Q2 몫).
     * 늘어나면 「규칙 하나」가 다시 무너지므로 목록째 잠근다.
     */
    it('읽기 override 는 3·5장 둘뿐이다', () => {
      expect(Object.keys(SCENE_READ_MS)).toEqual(['3', '5'])
      expect(SCENE_READ_MS[3]).toBe(2500)
    })

    it('🔴 무대 글자수가 계산에 들어간다 — 조사·노트가 스쳐 지나가지 않게', () => {
      // 3장(조사)·6장(노트)은 무대에 문장이 많다. 제목만 세면 이 값이 0 이 된다
      expect(SCENE_STAGE_TEXT_LEN[3]).toBeGreaterThan(150)
      expect(SCENE_STAGE_TEXT_LEN[6]).toBeGreaterThan(150)
      // 1장은 그림 위주라 짧다 (그래서 짧게 지나간다)
      expect(SCENE_STAGE_TEXT_LEN[1]).toBeLessThan(SCENE_STAGE_TEXT_LEN[3])
    })

    it('장면 길이 = 연출 + 읽기 (읽기는 마지막 요소 뒤부터)', () => {
      const { container } = renderTour('/signup/tour?step=3')
      const bar = container.querySelector('.animate-tourProgress') as HTMLElement
      const ms = Number.parseInt(bar.style.animationDuration, 10)
      /* 🔴 3장은 override 다 — 무대 글자수로는 상한(6.5s)에 붙지만, 4섹션이 순서대로
         나타나는 5초 동안 이미 읽히므로 완성 뒤에는 2.5s 만 준다 (CEO 8/29). */
      expect(ms).toBe(SCENE_PERFORM_MS[3] + 2500)
      expect(readMsFor(SCENE_STAGE_TEXT_LEN[3])).toBe(READ_MS_MAX)
    })

    /**
     * 🔴 안무표와 연출 길이가 **같은 표**에서 나와야 한다. 두 군데에 적으면 연출을 늘렸을 때
     * 한쪽만 바뀌어 「글자가 다 나오기 전에 넘어가는」 결함이 조용히 생긴다.
     */
    it('장면 연출 길이 = 안무표의 end', () => {
      for (const step of [2, 3, 4, 5, 6, 7]) {
        expect(SCENE_PERFORM_MS[step]).toBe(CHOREO[step].end)
      }
    })

    /** 규칙 C — 제목·설명이 각 장면의 **마지막 큐**여야 읽기가 그 뒤에 흐른다 */
    it('제목·설명이 안무의 마지막 큐다', () => {
      for (const step of [2, 3, 4, 6]) {
        const c = CHOREO[step]
        expect(c.desc).toBeGreaterThan(c.title)
        expect(c.end).toBeGreaterThanOrEqual(c.desc)
        for (const [name, ms] of Object.entries(c)) {
          if (name === 'end' || name.endsWith('Step')) continue
          expect(ms).toBeLessThanOrEqual(c.desc)
        }
      }
    })
  })
})

describe('Tour v2 — 조작', () => {
  it('4) 탭 = 다음 즉시', () => {
    renderTour()
    press(surface())
    expect(progress()).toBe('7장 중 2장')
  })

  it('4-b) 키보드 →·Space·← 로 이동한다', () => {
    renderTour()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(progress()).toBe('7장 중 2장')

    fireEvent.keyDown(window, { key: ' ' })
    expect(progress()).toBe('7장 중 3장')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(progress()).toBe('7장 중 2장')
  })

  it('4-c) Esc = 건너뛰기', async () => {
    renderTour('/signup/tour?step=2')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith({ lastStep: 2, completed: false }),
    )
  })

  it('5) 🔴 길게 누르면 멈추고, 떼면 이어서 간다', () => {
    renderTour()

    fireEvent.pointerDown(surface(), { clientX: 100 })
    advance(400) // 300ms 임계 통과
    expect(screen.getByRole('status')).toHaveTextContent('일시정지')

    // 멈춰 있는 동안은 아무리 기다려도 안 넘어간다
    advance(overScene(1) * 2)
    expect(progress()).toBe('7장 중 1장')

    // 떼면 재개 — 그리고 이건 탭이 아니므로 다음 장으로 튀지 않는다
    fireEvent.pointerUp(surface(), { clientX: 100 })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(progress()).toBe('7장 중 1장')

    advance(overScene(1))
    expect(progress()).toBe('7장 중 2장')
  })

  it('5-b) 짧게 누르면(300ms 미만) 일시정지가 아니라 탭이다', () => {
    renderTour()
    press(surface(), { hold: 100 })
    expect(progress()).toBe('7장 중 2장')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('6) 🔴 「건너뛰기」 버튼 위에서 시작한 탭은 재생 조작이 아니다', () => {
    renderTour()
    fireEvent.pointerDown(skipBtn(), { clientX: 100 })
    fireEvent.pointerUp(skipBtn(), { clientX: 100 })
    // 다음 장으로 넘어가지 않았다 (버튼 자체 클릭은 별개로 동작한다)
    expect(progress()).toBe('7장 중 1장')
  })

  /**
   * 🔴 2장 스텝바는 **하나**다 (v3.5) — 예전엔 카드 안 것 + 조작용 것 두 벌이라
   * 「어느 게 진짜지」가 됐다. 남은 하나는 카드 안에 있고 카드는 `inert` 라, 그 구역을
   * 눌러도 **아무 일도 일어나지 않는다**(장면도 안 넘어간다 — `data-no-card-nav` 표식).
   */
  it('6-b) 🔴 2장 스텝바는 하나 · 그 구역을 눌러도 장면이 넘어가지 않는다', () => {
    const { container } = renderTour('/signup/tour?step=2')

    expect(container.querySelectorAll('[data-no-card-nav]')).toHaveLength(1)

    const bar = container.querySelector('[data-no-card-nav]') as HTMLElement
    fireEvent.pointerDown(bar, { clientX: 100 })
    fireEvent.pointerUp(bar, { clientX: 100 })

    expect(progress()).toBe('7장 중 2장')
  })

  it('7) 좌우 스와이프 — 40px 넘으면 이동, 그 아래는 탭으로 친다', () => {
    renderTour('/signup/tour?step=3')

    press(surface(), { from: 200, to: 120 }) // 왼쪽으로 80px
    expect(progress()).toBe('7장 중 4장')

    press(surface(), { from: 120, to: 200 }) // 오른쪽으로 80px
    expect(progress()).toBe('7장 중 3장')
  })

  it('9) 🔴 탭이 백그라운드로 가면 멈추고, 돌아오면 재개한다', () => {
    renderTour()

    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('일시정지')

    advance(overScene(1) * 2)
    expect(progress()).toBe('7장 중 1장')

    spy.mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    advance(overScene(1))
    expect(progress()).toBe('7장 중 2장')
    spy.mockRestore()
  })
})

describe('Tour v2 — 모션 최소화(수동 모드)', () => {
  beforeEach(() => {
    reducedMotion = true
    installMatchMedia()
  })

  it('8) 🔴 자동 진행이 0이고 「다음」 버튼이 나온다', () => {
    renderTour()

    expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument()
    advance(overScene(1) * 3)
    expect(progress()).toBe('7장 중 1장')

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(progress()).toBe('7장 중 2장')
  })

  it('8-b) 🔴 연출을 기다리지 않고 완성 상태로 보여준다', () => {
    renderTour('/signup/tour?step=4')

    // 자소서 장면의 **마지막** 상태 = 초안 3줄이 다 쓰이고 점검 배지까지 붙은 모습
    expect(screen.getByText(SHOWCASE_COVERLETTER.draft[2])).toBeInTheDocument()
    expect(screen.getByText(SHOWCASE_COVERLETTER.checks[0])).toBeInTheDocument()
  })

  it('8-c) 진행 바에 재생 애니메이션이 붙지 않는다', () => {
    const { container } = renderTour()
    expect(container.querySelectorAll('.animate-tourProgress')).toHaveLength(0)
  })
})

describe('Tour v2 — 종료와 부수효과', () => {
  it('10) 건너뛰기 → lastStep 은 그 장면 · completed:false + 부수효과 3종', async () => {
    renderTour('/signup/tour?step=3')

    fireEvent.click(skipBtn())

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith({ lastStep: 3, completed: false }),
    )
    expect(coinMutate).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user?.onboardedCoinAt).not.toBeNull()
    expect(dismissMock).toHaveBeenCalledTimes(1)
    expect(markSeenMock).toHaveBeenCalledWith('u1')
  })

  it('10-b) 마지막 CTA → completed:true(7) + 내 카드 상세로 간다', async () => {
    renderTour('/signup/tour?step=7')

    const cta = screen.getByRole('button', { name: '대한항공 카드 열어보기' })
    fireEvent.click(cta)

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith({ lastStep: 7, completed: true }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/board/a1', { replace: true })
  })

  it('10-c) 미리보기 → 보드로 가고 CTA 문구가 「첫 카드 만들기」', async () => {
    mockApps([])
    renderTour('/signup/tour?step=7')

    fireEvent.click(screen.getByRole('button', { name: '첫 카드 만들기' }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/board', { replace: true }))
  })

  /**
   * 🔴 다시 보기에서도 **CTA 는 라벨대로 간다** (2026-08-29). 예전엔 replay 면 무조건
   * `navigate(-1)` 이라, 「대한항공 카드 열어보기」를 눌렀는데 도움말로 돌아갔다 —
   * 버튼이 거짓말을 한 셈이다. 저장·부수효과가 0인 건 그대로다.
   */
  it('10-d) 🔴 replay=1 → 저장·부수효과 0 · CTA 는 그 카드로 간다', async () => {
    renderTour('/signup/tour?step=7&replay=1')

    fireEvent.click(screen.getByRole('button', { name: /카드 열어보기/ }))

    // 🔴 push 다 (`replace` 아님) — 도움말로 돌아올 길을 남긴다
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/board/a1'))
    expect(navigateMock).not.toHaveBeenCalledWith(-1)
    expect(postMock).not.toHaveBeenCalled()
    expect(coinMutate).not.toHaveBeenCalled()
    expect(dismissMock).not.toHaveBeenCalled()
    expect(markSeenMock).not.toHaveBeenCalled()
  })

  it('10-d-b) replay + 카드 없음 → 「첫 카드 만들기」도 보드로 간다', async () => {
    mockApps([])
    renderTour('/signup/tour?step=7&replay=1')

    fireEvent.click(screen.getByRole('button', { name: '첫 카드 만들기' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/board'))
    expect(postMock).not.toHaveBeenCalled()
  })

  /** 반대로 **건너뛰기**는 「안 볼래」라 온 곳(도움말)으로 돌려보낸다 — 여기만 `-1` 이다 */
  it('10-d-c) 🔴 replay 건너뛰기 → 저장 0 · 뒤로 간다', async () => {
    renderTour('/signup/tour?step=3&replay=1')

    fireEvent.click(skipBtn())

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(-1))
    expect(postMock).not.toHaveBeenCalled()
  })

  it('10-e) 자동 진행으로 끝까지 가도 replay 표식이 살아 있다', () => {
    renderTour('/signup/tour?replay=1')
    for (let s = 1; s < TOUR_SCENE_COUNT; s++) advance(overScene(s))

    expect(progress()).toBe('7장 중 7장')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('10-f) onboardedCoinAt·배너가 이미 있으면 다시 쏘지 않는다', async () => {
    setUser({
      onboardedCoinAt: '2026-08-01T00:00:00Z',
      calendarHomeIntroDismissedAt: '2026-08-01T00:00:00Z',
    })
    renderTour('/signup/tour?step=2')

    fireEvent.click(skipBtn())

    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(coinMutate).not.toHaveBeenCalled()
    expect(dismissMock).not.toHaveBeenCalled()
  })

  it('10-g) 🔴 저장이 실패해도 이동은 그대로다', async () => {
    postMock.mockRejectedValue(new Error('network'))
    renderTour('/signup/tour?step=7')

    fireEvent.click(screen.getByRole('button', { name: /카드 열어보기/ }))
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/board/a1', { replace: true }),
    )
  })

  it('10-h) 연타해도 부수효과는 한 번만', async () => {
    renderTour('/signup/tour?step=2')

    fireEvent.click(skipBtn())
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(coinMutate).toHaveBeenCalledTimes(1)
  })

  it('범위 밖 step 은 1장으로 접는다 (보지도 않은 완료를 막는다)', () => {
    renderTour('/signup/tour?step=99')
    expect(progress()).toBe('7장 중 1장')
  })
})

/**
 * 🔴 브라우저 뒤로가기 (2026-08-29). 장면 전환이 `replace` 라 히스토리에 투어는 한 칸뿐이고,
 * 그대로 두면 뒤로가기가 투어를 통째로 벗어나 `/login` → `/calendar` 로 튕겼다 —
 * **투어를 봤다는 기록조차 남지 않은 채**. 마운트할 때 같은 URL 로 한 칸을 쌓아 두고
 * 그 칸이 먹힐 때마다 장면을 하나 되돌린다.
 *
 * ## 시나리오
 *  1. 3장에서 뒤로 → 2장 (저장·이동 0)
 *  2. 되돌린 뒤 칸을 **다시 쌓는다** (안 쌓으면 두 번째 뒤로가기가 투어를 벗어난다)
 *  3. 🔴 1장에서 뒤로 = 건너뛰기 (기록 + 목적지)
 *  4. 🔴 replay 1장에서 뒤로 → 저장 0 · 온 곳으로
 */
describe('Tour — 브라우저 뒤로가기', () => {
  const back = () =>
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

  it('1) 3장에서 뒤로가기 → 2장 (투어를 벗어나지 않는다)', () => {
    renderTour('/signup/tour?step=3')

    back()

    expect(progress()).toBe('7장 중 2장')
    expect(postMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('2) 마운트할 때 한 칸 쌓고, 되돌릴 때마다 다시 쌓는다', () => {
    const push = vi.spyOn(window.history, 'pushState')
    renderTour('/signup/tour?step=3')
    expect(push).toHaveBeenCalledTimes(1)

    back()
    expect(progress()).toBe('7장 중 2장')
    expect(push).toHaveBeenCalledTimes(2)

    back()
    expect(progress()).toBe('7장 중 1장')
    expect(push).toHaveBeenCalledTimes(3)
    push.mockRestore()
  })

  it('3) 🔴 1장에서 뒤로가기 = 건너뛰기 (기록 + 목적지)', async () => {
    renderTour()

    back()

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith({ lastStep: 1, completed: false }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/board/a1', { replace: true })
  })

  it('4) 🔴 replay 1장에서 뒤로가기 → 저장 0 · 온 곳으로', async () => {
    renderTour('/signup/tour?replay=1')

    back()

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(-1))
    expect(postMock).not.toHaveBeenCalled()
    expect(markSeenMock).not.toHaveBeenCalled()
  })

  it('5) 끝난 뒤에 들어온 뒤로가기는 아무 일도 하지 않는다 (연타 방어)', async () => {
    renderTour('/signup/tour?step=2')

    fireEvent.click(skipBtn())
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))

    back()
    expect(postMock).toHaveBeenCalledTimes(1)
  })
})

describe('Tour v3 — 무대', () => {
  /**
   * 🔴 v1 은 무대에 `overflow-y-auto` 가 걸려 있어 **툴팁이 잘리고 내용이 숨었다.**
   * 안 들어가면 자르는 게 아니라 **줄여야** 한다.
   */
  it('11) 무대에 스크롤·클립이 걸려 있지 않다', () => {
    const { container } = renderTour('/signup/tour?step=2')
    const stage = container.querySelector('[data-tour-stage]') as HTMLElement
    expect(stage).toBeTruthy()
    expect(stage.className).not.toMatch(/overflow-(y-auto|hidden|auto)/)
  })

  it('11-b) 🔴 내용이 무대보다 크면 scale 로 줄인다 (자르지 않는다)', () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(2000)
    // 폭도 재져야 측정이 돈다 (jsdom 은 기본 0 이라 측정 자체가 no-op 이다)
    const wSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(360)
    const { container } = renderTour()
    const inner = container.querySelector('[data-tour-stage] > div') as HTMLElement

    expect(inner.style.transform).toMatch(/^scale\(0\./)
    const box = container.querySelector('[data-tour-stage]') as HTMLElement
    expect(box.style.height).not.toBe('')
    spy.mockRestore()
    wSpy.mockRestore()
  })

  /**
   * 🔴 폭을 못 재는 환경에서 `scale(0)` 이 되면 무대가 통째로 사라진다 —
   * 그때는 확대를 포기하고 1 로 둔다 (축소 판정은 높이가 계속 맡는다).
   */
  it('11-c) 폭을 못 재면 확대하지 않는다 (scale 0 으로 무너지지 않는다)', () => {
    const hSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100)
    const wSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(360)
    const { container } = renderTour()
    const inner = container.querySelector('[data-tour-stage] > div') as HTMLElement
    expect(inner.style.transform).toBe('')
    hSpy.mockRestore()
    wSpy.mockRestore()
  })

  it('12) 1장은 실제 CompanyCard 다 (흉내 카드가 아니다) · 상호작용 차단', () => {
    const { container } = renderTour()
    expect(container.querySelector('[data-card-id="tour-showcase"]')).not.toBeNull()
    expect(container.querySelector('[inert]')).not.toBeNull()
  })

  /**
   * 🔴 **카드 폭은 전 장면이 같다** (CEO 실기 8/29 — ①②⑦ 440 · ③ 560 이라 장면이 넘어갈 때
   * 같은 카드가 커졌다 작아졌다 했다). jsdom 은 레이아웃을 계산하지 않으므로 **단일 상수가
   * 실제로 붙는지**로 고정한다 — 픽셀 동일성은 Playwright 실측이 맡는다.
   */
  it('12-c) 🔴 ①②③⑦ 무대가 같은 폭 상수 하나를 본다', () => {
    for (const s of [1, 2, 3, 7]) {
      const { container, unmount } = renderTour(`/signup/tour?step=${s}`)
      const inner = container.querySelector('[data-tour-stage] > div') as HTMLElement
      expect(inner.className, `${s}장 무대 폭`).toContain(TOUR_CARD_W_CLASS)
      // 장면이 제 폭을 따로 우기면 안 된다 (그게 폭이 갈라진 원인이었다)
      expect(inner.innerHTML).not.toContain('lg:max-w-[440px]')
      unmount()
    }
  })

  it('12-c-b) 폭 상수와 클래스가 같은 값을 가리킨다', () => {
    expect(TOUR_CARD_W_CLASS).toBe(`lg:w-[${TOUR_CARD_MAX_W}px]`)
  })

  /**
   * 🔴 히어로가 무대 폭을 다 쓰면서 옆 기둥은 **아래 한 줄 압축 카드**로 내려왔다.
   * 데스크탑 전용 세로 기둥(210px)·균등 3열은 둘 다 남아 있으면 안 된다.
   */
  it('12-c-c) 1장 — 옆 카드는 히어로 아래 한 줄 압축 카드 2장 (기둥 없음)', () => {
    const { container } = renderTour()
    expect(container.querySelectorAll('[data-tour-side]')).toHaveLength(2)
    expect(container.querySelector('.lg\\:w-\\[210px\\]')).toBeNull()
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeNull()
  })

  /**
   * 🔴 1장 오프닝 안무 (CEO 「PPT 시작하듯 쫘라란」). 실측에서 전 요소가 +2ms 에 동시에 떠
   * 「툭 놓임」이었다. jsdom 은 CSS 를 계산하지 않으므로 **훅과 스코프의 존재**로 고정한다 —
   * 실제 지연·순서는 Playwright 프레임 캡처가 맡는다.
   */
  /**
   * 🔴 안무는 **전 장면 공통 문법**이다 (CEO 8/29 「1장처럼 나머지도 전부」).
   * 장면마다 스코프(`tour-stage-N`)가 붙고, 그 안의 요소가 `data-anim` 으로 방식을 고른다.
   * 실제 지연·순서는 Playwright 프레임 캡처가 맡는다 (jsdom 은 CSS 를 계산하지 않는다).
   */
  it.each([
    [1, ['[data-tour-open]', '[data-card-id]', '[data-step-cell]', '[data-card-dday]']],
    [2, ['[data-card-id]', '[data-step-cell]', '[data-card-dday]']],
    [3, ['[data-anim="shell"]', '[data-anim="pop"]']],
    [4, ['[data-anim="shell"]', '[data-anim="pop"]']],
    [5, ['[data-anim="shell"]', '[data-anim="pop"]']],
    [6, ['[data-anim="shell"]', '[data-anim="pop"]']],
    [7, ['[data-anim="pop"]', '[data-anim="shell"]']],
  ])('12-e) 🔴 %s장 — 안무 스코프와 훅이 붙는다', (step, selectors) => {
    const { container } = renderTour(`/signup/tour?step=${step}`)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('tour-stage')
    expect(root.className).toContain(`tour-stage-${step}`)
    for (const sel of selectors) {
      expect(container.querySelector(sel), `${step}장 ${sel}`).not.toBeNull()
    }
    // 제목·설명은 어느 장면에서나 마지막 큐다
    expect(container.querySelector('[data-tour-copy] > h1')).not.toBeNull()
  })

  it('12-f) 🔴 1장 장면 길이 = 안무가 끝난 뒤부터 읽기', () => {
    const { container } = renderTour()
    const bar = container.querySelector('.animate-tourProgress') as HTMLElement
    const ms = Number.parseInt(bar.style.animationDuration, 10)
    // 안무 2.55s 가 통째로 앞에 붙는다 (예전 0.7s → 요소가 동시에 뜨던 시절 값)
    expect(SCENE_PERFORM_MS[1]).toBe(SCENE1_OPENING_MS)
    expect(SCENE1_OPENING_MS).toBeGreaterThanOrEqual(2400)
    // 🔴 안무 중에 다 읽는다 — 완성 뒤 읽기는 하한(1.5s) 에 붙는다
    expect(sceneReadMs(1)).toBe(READ_MS_MIN)
    expect(ms).toBe(SCENE1_OPENING_MS + READ_MS_MIN)
  })

  it('12-d) 🔴 카드가 서는 장면(1·2·7)은 무대를 확대하지 않는다', () => {
    // 확대하면 실화면보다 커지고 그만큼 흐려진다 — 폭을 크게 재도 scale 이 붙지 않는다
    const hSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80)
    const wSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
    for (const step of [1, 2, 7]) {
      const { container, unmount } = renderTour(`/signup/tour?step=${step}`)
      const inner = container.querySelector('[data-tour-stage] > div') as HTMLElement
      expect(inner.style.transform).toBe('')
      unmount()
    }
    hSpy.mockRestore()
    wSpy.mockRestore()
  })

  it('12-b) 🔴 「예시」 pill 은 1장에 한 번만 — 2·4장에는 없다', () => {
    renderTour()
    expect(screen.getByText(/예시 · 무신사 브랜드 마케터/)).toBeInTheDocument()

    press(surface())
    expect(screen.queryByText(/예시/)).not.toBeInTheDocument()
    press(surface())
    press(surface())
    expect(screen.queryByText(/예시/)).not.toBeInTheDocument()
  })
})

describe('Tour v3 — 쇼케이스 이야기 (무신사 · 브랜드 마케터)', () => {
  it('1장 — 무신사 카드가 D-2 로 서 있다 (현재 단계 = 과제)', () => {
    renderTour()
    expect(screen.getByText('무신사')).toBeInTheDocument()
    expect(screen.getByText('브랜드 마케터')).toBeInTheDocument()
    expect(screen.getByText(`D-${SHOWCASE_DDAY_TASK}`)).toBeInTheDocument()
  })

  /**
   * 🔴 D-day 는 KST 헬퍼로 만든 날짜에서 나온다 — `TZ=UTC` 에서도 같은 값이어야 한다
   * (`toISOString().slice` 였다면 여기서 하루 어긋난다).
   */
  it('2장 — 노드가 한 칸 옮겨가면 D-day 배지가 D-2 → D-5 로 따라 바뀐다', () => {
    renderTour('/signup/tour?step=2')
    expect(screen.getByText(`D-${SHOWCASE_DDAY_TASK}`)).toBeInTheDocument()

    advance(CHOREO[2].move + 200)

    expect(screen.getByText(`D-${SHOWCASE_DDAY_INTERVIEW}`)).toBeInTheDocument()
    expect(screen.queryByText(`D-${SHOWCASE_DDAY_TASK}`)).not.toBeInTheDocument()
  })

  /**
   * 🔴 v3.3 — 「설정 화면 같은 3등분 상자」에서 **카드 안의 탭**으로 바꿨다 (CEO 실기).
   * 카드 헤더 + 탭 줄이 있어야 「이게 카드 안에 있다」가 형태로 읽힌다.
   */
  it('3장 — 카드 헤더 + 탭 줄 위에 조사가 얹힌다', () => {
    renderTour('/signup/tour?step=3')

    // 1장에서 본 그 카드의 헤더 (회사·직무·D-day)
    expect(screen.getByRole('heading', { name: '무신사' })).toBeInTheDocument()
    expect(screen.getByText('브랜드 마케터')).toBeInTheDocument()
    expect(screen.getByText(`D-${SHOWCASE_DDAY_TASK}`)).toBeInTheDocument()
    // 실제 카드 상세와 같은 탭 줄 — 「회사 조사」가 열려 있다
    for (const t of ['전형', '회사 조사', '자소서']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  /**
   * 🔴 v3.7 — 「조사한 게 너무 부실하다」(CEO 8/29). 11항목 중 3개만 보여줘 「이게 다야?」였다.
   * 실제 탭(`CompanyInfoTab`)의 **4섹션을 같은 이름·같은 순서로** 압축해 폭을 보여준다.
   */
  it('3장 — 실제 탭과 같은 4섹션 이름이 같은 순서로 나온다', () => {
    const { container } = renderTour('/signup/tour?step=3')
    advance(SCENE_PERFORM_MS[3] + 200)

    const names = Object.values(SHOWCASE_RESEARCH_SECTIONS)
    for (const n of names) expect(screen.getByText(n)).toBeInTheDocument()

    // 순서 — DOM 등장 순서가 곧 읽는 순서다
    const stage = container.querySelector('[data-tour-stage]') as HTMLElement
    const order = Array.from(stage.querySelectorAll('p'))
      .map((el) => el.textContent ?? '')
      .filter((t) => names.includes(t as (typeof names)[number]))
    expect(order).toEqual(names)
  })

  it('3장 — 키워드 4 + 펼침 힌트 · 스탯 3 · 제품 pill 3 · 자소서 2줄 · 인재상 3', () => {
    renderTour('/signup/tour?step=3')
    advance(SCENE_PERFORM_MS[3] + 200)

    for (const kw of SHOWCASE_RESEARCH_KEYWORDS) {
      expect(screen.getAllByText(kw).length, kw).toBeGreaterThanOrEqual(1)
    }
    expect(
      screen.getByText('→ ‘포트폴리오 확장을 어떻게 보나’ 질문이 자주 나와요'),
    ).toBeInTheDocument()

    // 🔴 숫자가 있어야 「조사됐다」로 읽힌다
    for (const s of SHOWCASE_STATS) {
      expect(screen.getByText(s.label)).toBeInTheDocument()
      expect(screen.getByText(s.value)).toBeInTheDocument()
      expect(screen.getByText(s.delta)).toBeInTheDocument()
    }
    expect(screen.getByText(/16개 매장 합산 연매출/)).toBeInTheDocument()
    // 「2024.10 기준」 메타는 별도 칩이 아니라 그 한 줄 안으로 흡수됐다
    expect(screen.queryByText('2024.10 기준')).not.toBeInTheDocument()

    /* 🔴 `getAllByText` 다 — 「무신사 스탠다드」는 키워드 칩이자 제품 pill 이라 **의도적으로**
       두 번 나온다(실제 조사 데이터가 그렇다: 키워드 = 회사의 성격, 제품 = 무엇을 만드나).
       섹션이 다르고 톤도 다르니 중복이 아니라 두 질문에 각각 답하는 것이다. */
    for (const p of SHOWCASE_PRODUCTS) {
      expect(screen.getAllByText(p).length).toBeGreaterThanOrEqual(1)
    }
    for (const st of SHOWCASE_STORY) {
      expect(screen.getByText(st.label)).toBeInTheDocument()
      // 라벨과 본문이 한 `li` 안에서 노드로 쪼개져 있어 부분 일치로 찾는다
      expect(
        screen.getByText((_, el) => el?.textContent?.includes(st.text) ?? false, {
          selector: 'li',
        }),
      ).toBeInTheDocument()
    }
    for (const t of SHOWCASE_TALENT_PROFILE) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  /** 규칙 B — 핵심 한 방은 **맨 마지막 팝**이다 (제목·설명 직전) */
  it('3장 — 직무 인사이트가 마지막 큐이자 pop 이다', () => {
    const { container } = renderTour('/signup/tour?step=3')
    advance(SCENE_PERFORM_MS[3] + 200)

    const line = screen.getByText(SHOWCASE_ROLE_INSIGHT)
    expect(line.getAttribute('data-anim')).toBe('pop')
    expect(line.style.animationDelay).toBe(`${CHOREO[3].roleInsight}ms`)

    // 제목·설명을 뺀 모든 큐보다 늦다
    const c = CHOREO[3]
    for (const [name, ms] of Object.entries(c)) {
      if (['end', 'title', 'desc', 'roleInsight'].includes(name)) continue
      if (name.endsWith('Step')) continue
      expect(ms, name).toBeLessThan(c.roleInsight)
    }
    // 카테고리 5색 칩이 남아 있으면 안 된다 (색이 의미 없다는 지적)
    expect(container.querySelector('.bg-violet\\/10')).toBeNull()
  })

  it('4장 — 문항 → AI 초안 버튼 → 3줄 타이핑 → 점검 배지', () => {
    renderTour('/signup/tour?step=4')

    expect(screen.getByText(SHOWCASE_COVERLETTER.question)).toBeInTheDocument()
    expect(screen.getByText('AI 초안')).toBeInTheDocument()
    // 아직 초안이 안 나왔다 (버튼을 누르기 전이다)
    expect(screen.queryByText(SHOWCASE_COVERLETTER.draft[0])).not.toBeInTheDocument()

    advance(SCENE_PERFORM_MS[4] + 200)

    for (const line of SHOWCASE_COVERLETTER.draft) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
    for (const check of SHOWCASE_COVERLETTER.checks) {
      expect(screen.getByText(check)).toBeInTheDocument()
    }
  })

  /**
   * 🔴 v3.3 — 답변은 **문장 단위**로 오르고(글자 타이핑은 지루했다), 질문 2가 **실제로**
   * 열린다(예전엔 점선 미리보기 한 줄뿐이었다).
   */
  it('5장 — 질문 1 답변 4문장 + 피드백이 먼저 완성된다', () => {
    renderTour('/signup/tour?step=5')
    expect(screen.getByText('00:00')).toBeInTheDocument()

    // 피드백 단계까지만 진행 (아직 접히기 전)
    const untilFeedback = SCENE5_PHASE_MS.slice(0, 3).reduce((a, b) => a + b, 0) - 800
    advance(untilFeedback)

    expect(screen.getByText(SHOWCASE_INTERVIEW.question)).toBeInTheDocument()
    for (const s of SHOWCASE_INTERVIEW.answer) {
      expect(screen.getByText(s)).toBeInTheDocument()
    }
    for (const f of SHOWCASE_INTERVIEW.feedback) {
      expect(screen.getByText(f)).toBeInTheDocument()
    }
    expect(screen.getByText(`00:${SHOWCASE_INTERVIEW.elapsedSec}`)).toBeInTheDocument()
  })

  it('5장 — 🔴 최종 상태 = 접힌 Q1 요약 + 펼쳐진 Q2 전문 + 피드백', () => {
    renderTour('/signup/tour?step=5')

    advance(SCENE_PERFORM_MS[5] + 200)

    // Q1 은 한 줄로 접힌다 (4장 자소서와 같은 문법)
    expect(screen.getByText(SHOWCASE_INTERVIEW.summary)).toBeInTheDocument()
    expect(screen.getByText('답변 완료 ✓')).toBeInTheDocument()
    expect(screen.queryByText(SHOWCASE_INTERVIEW.question)).not.toBeInTheDocument()

    // Q2 는 전문이 보인다
    expect(screen.getByText(SHOWCASE_INTERVIEW.question2)).toBeInTheDocument()
    for (const s of SHOWCASE_INTERVIEW.answer2) {
      expect(screen.getByText(s)).toBeInTheDocument()
    }
    expect(screen.getByText(SHOWCASE_INTERVIEW.feedback2[0])).toBeInTheDocument()
    // 텍스트가 `{2}/{8}` 로 쪼개져 있어 노드 단위 매칭이 안 된다
    expect(screen.getByText(/예상 질문 2\/8/)).toBeInTheDocument()
    expect(screen.getByText(`00:${SHOWCASE_INTERVIEW.elapsedSec2}`)).toBeInTheDocument()
  })

  it('6장 — 정리 글 · 체크리스트(하나 체크됨) · 형광 강조 · 매장 일러스트 · PDF', () => {
    renderTour('/signup/tour?step=6')

    // 데스크탑 노트 목록의 활성 항목과 제목이 같은 문자열이라 role 로 좁힌다 (목록/상세 구조)
    expect(
      screen.getByRole('heading', { name: SHOWCASE_NOTE.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(SHOWCASE_NOTE.stepPill)).toBeInTheDocument()

    advance(SCENE_PERFORM_MS[6] + 200)

    // 🔴 「공부한 것처럼 정리된 글」 — 체크리스트만 있으면 할 일 목록이지 노트가 아니다
    expect(screen.getByText(SHOWCASE_NOTE.study.heading)).toBeInTheDocument()
    for (const b of SHOWCASE_NOTE.study.bullets) {
      expect(screen.getByText(b)).toBeInTheDocument()
    }
    // 2열 미니 표 (데스크탑 전용이지만 DOM 에는 있다)
    expect(screen.getByText('온라인(앱)')).toBeInTheDocument()
    expect(screen.getByText('체류·구매 전환')).toBeInTheDocument()

    expect(screen.getByText(SHOWCASE_NOTE.questionsHeading)).toBeInTheDocument()
    expect(screen.getByText(SHOWCASE_NOTE.highlight)).toBeInTheDocument()
    expect(screen.getByText('PDF 로 내보내기')).toBeInTheDocument()
    // 처음부터 완료인 1개 + 연출로 체크된 1개
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })

  /**
   * 🔴 회색 네모 + 라벨이 아니라 **실제 그림**이어야 한다 (CEO 실기).
   * 외부 이미지는 금지라 인라인 SVG 이고, 토큰 색만 써야 라이트·다크 양쪽에서 산다.
   */
  it('6장 — 매장 일러스트가 실제 SVG 로 그려진다 (토큰 색만)', () => {
    const { container } = renderTour('/signup/tour?step=6')
    advance(SCENE_PERFORM_MS[6] + 200)

    const svg = container.querySelector('svg[role="img"]')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-label')).toContain('무신사 스탠다드 홍대 매장')
    expect(svg?.querySelector('text')?.textContent).toBe('MUSINSA STANDARD')
    // 하드코딩 hex 가 섞이면 한쪽 테마에서 깨진다
    expect(svg?.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(screen.getByText(SHOWCASE_NOTE.imageCaption)).toBeInTheDocument()
  })

  it('7장 — 🔴 내 카드로 돌아온다 (쇼케이스가 아니다) + 「지금 열린 것」 3칩', () => {
    const { container } = renderTour('/signup/tour?step=7')

    expect(container.querySelector('[data-card-id="a1"]')).not.toBeNull()
    expect(container.querySelector('[data-card-id="tour-showcase"]')).toBeNull()
    expect(screen.getByText('대한항공')).toBeInTheDocument()

    // 여섯 장에서 본 것을 세 줄로 되짚어 준다 (밋밋함 해소)
    for (const chip of ['전형 단계 자동', '회사 조사 준비', 'AI 자소서·면접']) {
      expect(screen.getByText(chip)).toBeInTheDocument()
    }
  })

  it('7장 — CTA 가 크고 「다시 보기」 안내가 붙는다', () => {
    renderTour('/signup/tour?step=7')

    const cta = screen.getByRole('button', { name: /대한항공 카드 열어보기/ })
    expect(cta.className).toContain('min-h-[52px]')
    expect(cta.className).toContain('lg:w-[320px]')
    expect(screen.getByText('나중에 다시 보려면 설정 › 도움말')).toBeInTheDocument()
  })

  it('7장 — 카드가 없으면 빈 카드를 그리지 않고 약속으로 닫는다', () => {
    mockApps([])
    const { container } = renderTour('/signup/tour?step=7')

    expect(container.querySelector('[data-card-id]')).toBeNull()
    expect(screen.getByText('여기에 내 첫 카드가 놓여요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '첫 카드 만들기' })).toBeInTheDocument()
  })

  it('7장 — 캐시가 없으면 스켈레톤 (스피너 금지)', () => {
    mockApps(undefined, true)
    const { container } = renderTour('/signup/tour?step=7')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  /**
   * 🔴 조회 실패는 「0장」과 **다르다** (2026-08-29). 둘을 같이 묶으면 카드를 여섯 장 가진
   * 사람이 조회 한 번 실패했다고 「첫 카드 만들기」를 본다 — 마지막 장이 거짓말을 한다.
   * 모를 때는 아무것도 단정하지 않는 「보드로 가기」로 닫는다 (도착지는 같은 `/board`).
   */
  it('7장 — 조회 실패 → 중립 CTA 「보드로 가기」 · 보드로 간다', async () => {
    mockApps(undefined, false)
    renderTour('/signup/tour?step=7')

    expect(screen.queryByRole('button', { name: '첫 카드 만들기' })).toBeNull()
    expect(screen.getByText('카드는 보드에서 이어져요')).toBeInTheDocument()
    // 없다고도, 있다고도 말하지 않는다
    expect(screen.queryByText('여기에 내 첫 카드가 놓여요')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '보드로 가기' }))
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/board', { replace: true }),
    )
  })

  it('7장 — 「첫 카드 만들기」는 성공했는데 0장일 때만', () => {
    mockApps([])
    renderTour('/signup/tour?step=7')

    expect(screen.getByRole('button', { name: '첫 카드 만들기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '보드로 가기' })).toBeNull()
    expect(screen.getByText('여기에 내 첫 카드가 놓여요')).toBeInTheDocument()
  })
})

/**
 * v3.6 — 2장이 **최종 합격까지** 간다 (CEO 8/29 「전형 스텝별로 옮겨지면서 최종 합격까지
 * 눌러서 폭죽이 한 번 보기 좋게 조그맣게 터지면 좋겠다」).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 노드가 세 칸 옮겨가고 D-day 가 D-2 → D-5 → D-12 로 따라온다
 *  2. 마지막 칸에서 카드가 **합격 상태**가 된다 (D-day 배지 자리 → 「🎉 합격」)
 *  3. 🔴 폭죽은 3.55s 에 **한 번만** 터진다 (같은 장면에서 두 번 없음)
 *  4. 🔴 모션 최소화면 **0번** — 이동도 없이 완성 상태(합격 카드)만
 *  5. 🔴 터지기 전에 떠나면 아예 안 터진다 (예약 취소)
 *  6. 🔴 터진 뒤 떠나면 조각까지 걷는다 (`reset`)
 *  7. 체크가 4줄이고 읽기 시간도 그 4줄을 센다
 *  8. 장면 길이 = 안무(5.05s) + 읽기, 폭죽은 그 안에서 끝난다
 *  9. 🔴 **폭죽은 2장뿐** — 다른 장면으로 번지지 않는다 (합격 전유, `plans/app-tour.md` Q6)
 */
describe('Tour v3.6 — 2장 최종 합격 + 폭죽', () => {
  const FINAL_CHECK = '합격까지 한 카드에서'
  const CHECK_LINES = [
    '전형 단계 템플릿 적용',
    '마감 D-day 자동 계산',
    '캘린더에 자동 등록',
    FINAL_CHECK,
  ]

  it('1·2) 노드가 세 칸 옮겨가고 마지막엔 합격 카드가 된다', () => {
    const { container } = renderTour('/signup/tour?step=2')
    expect(screen.getByText(`D-${SHOWCASE_DDAY_TASK}`)).toBeInTheDocument()

    advance(CHOREO[2].move + 100)
    expect(screen.getByText(`D-${SHOWCASE_DDAY_INTERVIEW}`)).toBeInTheDocument()

    advance(CHOREO[2].move2 - CHOREO[2].move)
    expect(screen.getByText(`D-${SHOWCASE_DDAY_SECOND}`)).toBeInTheDocument()

    advance(CHOREO[2].move3 - CHOREO[2].move2)
    // 🔴 합격 표시는 **실제 `CompanyCard` 의 PASSED 모양** 그대로다 (따로 그리지 않는다)
    expect(screen.getByText('🎉 합격')).toBeInTheDocument()
    expect(container.querySelector('.passed-card')).not.toBeNull()
    // 합격하면 D-day 배지 자리를 합격 배지가 가져간다
    expect(screen.queryByText(/^D-\d+$/)).not.toBeInTheDocument()
  })

  it('3) 🔴 폭죽은 3.55s 에 딱 한 번, 작게 터진다', () => {
    renderTour('/signup/tour?step=2')

    advance(CHOREO[2].confetti - 300)
    expect(confettiMock.fire).not.toHaveBeenCalled()

    advance(600)
    expect(confettiMock.fire).toHaveBeenCalledTimes(1)

    // 남은 장면을 다 흘려도 두 번째는 없다
    advance(1000)
    expect(confettiMock.fire).toHaveBeenCalledTimes(1)

    const opts = confettiMock.fire.mock.calls[0][0]
    expect(opts.particleCount).toBe(36)
    expect(opts.spread).toBe(55)
    expect(opts.ticks).toBe(90)
    expect(opts.scalar).toBe(0.8)
    expect(opts.disableForReducedMotion).toBe(true)
    // 색은 토큰에서 읽는다 (hex 를 박아두지 않는다) — 5색.
    // 🔴 형식은 hex 여야 한다: canvas-confetti 파서가 hex 전용이라 `rgb(...)` 는 뭉개진다
    expect(opts.colors).toHaveLength(5)
    for (const c of opts.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    // 원점은 카드 중앙. jsdom 은 상자 크기를 0 으로 재므로 한가운데로 접힌다
    expect(opts.origin).toEqual({ x: 0.5, y: 0.5 })
  })

  it('4) 🔴 모션 최소화 — 이동 없이 합격 상태, 폭죽 0번', () => {
    reducedMotion = true
    installMatchMedia()
    renderTour('/signup/tour?step=2')

    expect(screen.getByText('🎉 합격')).toBeInTheDocument()

    advance(CHOREO[2].end + 2000)
    expect(confettiMock.create).not.toHaveBeenCalled()
    expect(confettiMock.fire).not.toHaveBeenCalled()
  })

  it('5) 🔴 터지기 전에 떠나면 아예 안 터진다 (예약 취소)', () => {
    renderTour('/signup/tour?step=2')
    advance(CHOREO[2].confetti - 500)

    press(surface())
    expect(progress()).toBe('7장 중 3장')

    advance(3000)
    expect(confettiMock.fire).not.toHaveBeenCalled()
  })

  it('6) 🔴 터진 뒤 떠나면 조각까지 걷는다 (reset)', () => {
    renderTour('/signup/tour?step=2')
    advance(CHOREO[2].confetti + 200)

    expect(confettiMock.fire).toHaveBeenCalledTimes(1)
    expect(confettiMock.reset).not.toHaveBeenCalled()

    press(surface())
    expect(progress()).toBe('7장 중 3장')
    expect(confettiMock.reset).toHaveBeenCalledTimes(1)
  })

  it('7) 🔴 체크가 4줄 — 읽기 시간도 4번째 줄을 센다', () => {
    renderTour('/signup/tour?step=2')

    for (const line of CHECK_LINES) expect(screen.getByText(line)).toBeInTheDocument()

    // 무대 글자수 = 회사·직무 + 체크 4줄 (단계 이름·캘린더는 aria-hidden 장식이라 빠진다)
    expect(SCENE_STAGE_TEXT_LEN[2]).toBe(
      [SHOWCASE_COMPANY, SHOWCASE_JOB, ...CHECK_LINES].join('').length,
    )
  })

  it('8) 장면 길이 = 안무(5.05s) + 읽기 · 폭죽은 그 안에서 끝난다', () => {
    const { container } = renderTour('/signup/tour?step=2')
    const bar = container.querySelector('.animate-tourProgress') as HTMLElement
    const ms = Number.parseInt(bar.style.animationDuration, 10)

    expect(CHOREO[2].end).toBe(5650)
    expect(SCENE_PERFORM_MS[2]).toBe(CHOREO[2].end)
    expect(ms).toBe(CHOREO[2].end + readMsFor(SCENE_STAGE_TEXT_LEN[2]))
    // 🔴 폭죽이 장면 끝에 걸치면 다음 장 위로 색종이가 넘어간다
    expect(CHOREO[2].confetti).toBeLessThan(CHOREO[2].end)
  })

  /**
   * 🔴 v3.6-b — 「1~7 숫자는 뭐임?」(CEO 8/29). 순번 일곱 칸이 아니라 **진짜 이번 주부터
   * 3주치 날짜**여야 캘린더로 읽힌다. 날짜는 전부 KST 헬퍼라 `TZ=UTC`·`TZ=America/New_York`
   * 에서도 같은 칸이 나온다 — 그게 이 테스트가 두 TZ 에서 함께 도는 이유다.
   */
  describe('캘린더', () => {
    const monday = () => getWeekMonday()
    const cellText = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll('[data-tour-stage] .grid.grid-cols-7'),
      ).map((g) => g.textContent)

    it('c1) 라벨·요일 줄·3주치 21칸이 있다', () => {
      const { container } = renderTour('/signup/tour?step=2')

      expect(screen.getByText('캘린더')).toBeInTheDocument()
      const [weekdayRow, dateGrid] = cellText(container)
      expect(weekdayRow).toBe('월화수목금토일')
      expect(dateGrid).not.toBeUndefined()

      // 21칸 = 이번 주 월요일부터 3주. 날짜 숫자가 그 순서로 들어 있다
      const grid = container.querySelectorAll(
        '[data-tour-stage] .grid.grid-cols-7',
      )[1] as HTMLElement
      const cells = grid.children
      expect(cells).toHaveLength(21)
      for (let i = 0; i < 21; i++) {
        const day = Number(addDays(monday(), i).slice(8, 10))
        expect(cells[i].textContent, `${i}번 칸`).toContain(String(day))
      }
    })

    it('c2) 🔴 오늘 칸에 brand 테두리 + 「오늘」', () => {
      const { container } = renderTour('/signup/tour?step=2')
      const grid = container.querySelectorAll(
        '[data-tour-stage] .grid.grid-cols-7',
      )[1] as HTMLElement

      const todayIdx = Array.from({ length: 21 }, (_, i) =>
        addDays(monday(), i),
      ).indexOf(todayLocal())
      expect(todayIdx).toBeGreaterThanOrEqual(0)

      const cell = grid.children[todayIdx] as HTMLElement
      expect(cell.className).toContain('border-brand/60')
      expect(cell.textContent).toContain('오늘')
      // 「오늘」은 딱 한 칸이다
      expect(screen.getAllByText('오늘')).toHaveLength(1)
    })

    /** 마감 칸 = **카드가 보는 그 날짜** — D-day 배지와 같은 값에서 나와야 한다 */
    it('c3) 🔴 마감 틴트·라벨이 단계를 따라 그 날짜 칸으로 옮겨간다', () => {
      const { container } = renderTour('/signup/tour?step=2')
      const grid = container.querySelectorAll(
        '[data-tour-stage] .grid.grid-cols-7',
      )[1] as HTMLElement
      const days = Array.from({ length: 21 }, (_, i) => addDays(monday(), i))
      const cellFor = (delta: number) => {
        const idx = days.indexOf(addDays(todayLocal(), delta))
        // 3주를 넘어가면 마지막 칸으로 접힌다 (「→」)
        return grid.children[idx === -1 ? 20 : idx] as HTMLElement
      }

      expect(cellFor(SHOWCASE_DDAY_TASK).textContent).toContain('과제')
      expect(cellFor(SHOWCASE_DDAY_TASK).className).toContain('border-warning/40')

      advance(CHOREO[2].move + 100)
      expect(cellFor(SHOWCASE_DDAY_INTERVIEW).textContent).toContain('1차 면접')
      expect(screen.queryByText('과제')).not.toBeInTheDocument()

      advance(CHOREO[2].move2 - CHOREO[2].move)
      expect(cellFor(SHOWCASE_DDAY_SECOND).textContent).toContain('2차 면접')
    })

    it('c4) 🔴 합격하면 success 틴트 + 「합격 🎉」 (warning 색 어긋남 해소)', () => {
      const { container } = renderTour('/signup/tour?step=2')
      advance(CHOREO[2].move3 + 100)

      const marked = container.querySelector(
        '[data-tour-stage] .border-success\\/40',
      ) as HTMLElement
      expect(marked).not.toBeNull()
      expect(marked.textContent).toContain('합격 🎉')
      expect(container.querySelector('[data-tour-stage] .border-warning\\/40')).toBeNull()
    })

    /**
     * 🔴 3주를 넘어가는 마감(+20)은 **마지막 칸 + 「→」**다. 그리지 않으면 라벨이 통째로
     * 사라지고, 아무 칸에 찍으면 D-day 와 어긋난 거짓말이 된다.
     */
    it('c5) 3주를 넘어가면 마지막 칸으로 접고 「→」로 표시한다', () => {
      const { container } = renderTour('/signup/tour?step=2')
      advance(CHOREO[2].move3 + 100)

      const days = Array.from({ length: 21 }, (_, i) => addDays(monday(), i))
      const fits = days.includes(addDays(todayLocal(), SHOWCASE_DDAY_FINAL))
      const grid = container.querySelectorAll(
        '[data-tour-stage] .grid.grid-cols-7',
      )[1] as HTMLElement
      const last = grid.children[20] as HTMLElement

      if (fits) {
        // 오늘이 월·화면 +20 이 21칸 안에 들어온다 — 그때는 화살표를 쓰지 않는다
        expect(container.textContent).not.toContain('→')
      } else {
        expect(last.textContent).toContain('→')
        expect(last.textContent).toContain('합격 🎉')
      }
    })

    it('c6) 캘린더는 aria-hidden 장식이라 읽기 글자수에 안 들어간다', () => {
      const { container } = renderTour('/signup/tour?step=2')
      const cal = container.querySelector(
        '[data-tour-stage] .grid.grid-cols-7',
      )?.parentElement
      expect(cal?.getAttribute('aria-hidden')).toBe('true')
      // 무대 글자수는 회사·직무 + 체크 4줄뿐이다 (날짜·요일은 안 센다)
      expect(SCENE_STAGE_TEXT_LEN[2]).toBe(
        [SHOWCASE_COMPANY, SHOWCASE_JOB, ...CHECK_LINES].join('').length,
      )
    })
  })

  /**
   * 🔴 CEO 8/29 「카드 단계 옮기는 게 살짝 빠르다」 — 칸 간격 700 → **1000ms**.
   * 이동 트랜지션(850ms)이 끝난 뒤 150ms 는 가만히 있어야 「옮겨갔다」가 읽힌다.
   */
  it('10) 이동 간격이 1000ms 씩이고 트랜지션(850ms)보다 길다', () => {
    expect(CHOREO[2].move2 - CHOREO[2].move).toBe(1000)
    expect(CHOREO[2].move3 - CHOREO[2].move2).toBe(1000)
    expect(SCENE2_PHASE_MS).toEqual([1400, 1000, 1000])
    // 🔴 트랜지션이 간격보다 길면 앞 칸이 도착하기 전에 다음 칸이 출발한다
    expect(CHOREO[2].moveMs).toBe(850)
    expect(CHOREO[2].moveMs).toBeLessThan(CHOREO[2].move2 - CHOREO[2].move)
  })

  /**
   * 🔴 카드·스텝바 **내부** 안무의 시각은 `index.css` 가 아니라 `CHOREO` 가 쥔다 —
   * CSS 는 여기서 내려준 변수만 읽는다. 두 곳에 숫자를 적으면 한쪽만 바뀐다.
   */
  it('11) 무대가 안무 시각을 CSS 변수로 내려준다 (숫자가 CSS 에 없다)', () => {
    const { container } = renderTour('/signup/tour?step=2')
    const stage = container.querySelector(
      '[data-tour-stage] > div > div',
    ) as HTMLElement

    expect(stage.style.getPropertyValue('--t2-head')).toBe(`${CHOREO[2].cardHeader}ms`)
    expect(stage.style.getPropertyValue('--t2-nodes')).toBe(`${CHOREO[2].stepNodes}ms`)
    expect(stage.style.getPropertyValue('--t2-node-step')).toBe(
      `${CHOREO[2].stepNodeStep}ms`,
    )
    expect(stage.style.getPropertyValue('--t2-dday')).toBe(`${CHOREO[2].dday}ms`)
    expect(stage.style.getPropertyValue('--t2-move')).toBe(`${CHOREO[2].moveMs}ms`)
  })

  it('9) 🔴 폭죽은 2장 하나뿐 — 다른 장면에서는 터지지 않는다 (합격 전유)', () => {
    for (const s of [1, 3, 4, 5, 6, 7]) {
      const { unmount } = renderTour(`/signup/tour?step=${s}`)
      advance((SCENE_PERFORM_MS[s] ?? 1000) + 500)
      unmount()
    }
    expect(confettiMock.fire).not.toHaveBeenCalled()
  })
})
