/**
 * 「이 단계 완료하기」 **축소형 CTA** (CEO 결정 2026-08-11).
 *
 * 🔴 **왜 줄였나.** 이 바는 화면 하단을 항상 가로막고 있었다. 스텝 페이지는 노트가
 * 길어질수록 세로로 자라는데, 정작 이 버튼은 노트를 다 쓴 **뒤에** 한 번 누르는 것이다.
 * 평소엔 우하단 원형으로 물러나 있다가 **페이지 끝에 닿으면** 원래 풀폭 바로 돌아온다.
 *
 * 시나리오 (먼저 나열하고 코드를 짰다):
 *   A. 기본 = 축소
 *     A1. FAB 이 있고 풀폭 바는 없다
 *     A2. FAB 은 아이콘 전용이라 이름을 aria-label 이 진다
 *   B. 확장
 *     B1. sentinel 이 보이면 풀폭 바가 뜨고 FAB 은 사라진다
 *     B2. 🔴 스크롤이 없을 만큼 짧은 페이지 = 관측 즉시 보임 → **처음부터 풀폭**
 *     B3. 다시 멀어지면 축소로 돌아온다
 *     B4. rootMargin 으로 "근처" 를 본다 (하단 160px)
 *   C. 동작 동일성
 *     C1. FAB 클릭 = 기존 완료 동작 (다음 스텝으로 이동)
 *     C2. 🔴 마지막 스텝은 확인 모달 — 축소 상태에서도 그대로다 (즉시 합격 처리 금지)
 *   D. 라벨·아이콘 분기
 *     D1. 마지막 스텝 FAB 이름은 「최종 합격 처리하기」
 *     D2. 풀폭 바의 **보이는 문구**는 기존 그대로 (🎉 포함)
 *   E. 퇴화·게이팅
 *     E1. 🔴 IntersectionObserver 가 없는 환경 → 오늘의 풀폭 바 (버튼이 사라지지 않는다)
 *     E2. 현재 스텝이 아니면 둘 다 없다
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  updateCurrentStep: vi.fn(),
  updateApplication: vi.fn(),
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: h.app, isLoading: false }),
  useUpdateApplication: () => ({ mutate: h.updateApplication }),
  useUpdateCurrentStep: () => ({ mutate: h.updateCurrentStep }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: [] }),
  useCreateChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateChecklistItem: () => ({ mutate: vi.fn() }),
  useDeleteChecklistItem: () => ({ mutate: vi.fn() }),
  useUpdateStep: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => h.navigate }))
vi.mock('@/utils/nativeBridge', () => ({ postToNative: vi.fn() }))
vi.mock('@/components/editor/SheetedNoteEditor', () => ({
  SheetedNoteEditor: () => <div data-testid="note-editor" />,
}))

import { StepPage } from './StepPage'

/**
 * 🔴 **jsdom 에는 IntersectionObserver 가 없다** — 그래서 스텁을 세우지 않으면 컴포넌트가
 * "관측 불가" 퇴화 경로를 탄다(E1 이 그걸 잰다). 관측되는 상황은 여기서 직접 만든다.
 * 형제 spec(`InterviewSessionPage.notepane`)이 ResizeObserver 에 쓰는 방식과 같다 —
 * setup.ts 전역에 넣지 않는 이유는 **모든 StepPage spec 의 기본 상태를 조용히 뒤집기** 때문이다.
 */
const io = vi.hoisted(() => ({
  /** observe 직후 관측기가 보내는 값 (= 브라우저의 최초 콜백) */
  initial: false,
  cbs: [] as IntersectionObserverCallback[],
  opts: [] as (IntersectionObserverInit | undefined)[],
}))

function installIO() {
  class IOStub {
    private cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      this.cb = cb
      io.cbs.push(cb)
      io.opts.push(opts)
    }
    observe() {
      this.cb(
        [{ isIntersecting: io.initial } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  vi.stubGlobal('IntersectionObserver', IOStub)
}

/** 스크롤로 sentinel 이 들어오거나 나가는 순간 */
const fire = (isIntersecting: boolean) =>
  act(() => {
    io.cbs.forEach((cb) =>
      cb([{ isIntersecting } as IntersectionObserverEntry], null as unknown as IntersectionObserver),
    )
  })

function step(orderIndex: number, name: string): ApplicationStep {
  return {
    id: `s${orderIndex}`, applicationId: 'app-1', orderIndex, name,
    scheduledDate: null, location: null, notes: null, pinnedContent: null,
  }
}

/** currentStepIndex 를 바꿔 「현재 스텝」·「마지막 스텝」 상황을 만든다 */
function makeApp(currentStepIndex: number): Application {
  return {
    id: 'app-1', userId: 'u', companyName: '카카오', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex, needsDetail: false,
    isStarred: false,
    steps: [step(0, '1차 면접'), step(1, '최종 합격')],
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  }
}

function draw(stepId = 's0') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[`/board/app-1/steps/${stepId}`]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/**
 * 🔴 **두 상태의 접근 가능한 이름은 일부러 같다** — 같은 컨트롤이니 낭독기에서 이름이
 * 흔들리면 안 된다. 그래서 셀렉터는 이름이 아니라 **구조**로 가른다:
 * 축소형은 아이콘 전용이라 이름을 `aria-label` 이 지고, 풀폭 바는 본문 텍스트가 진다.
 */
const iconBtn = (name: string) =>
  screen.queryAllByRole('button', { name }).find((b) => b.getAttribute('aria-label') === name) ??
  null
const fab = () => iconBtn('이 단계 완료하기')
const lastFab = () => iconBtn('최종 합격 처리하기')
/** 풀폭 바 = 눈에 보이는 문구를 가진 쪽 */
const bar = () => screen.queryByText('이 단계 완료하기')
const lastBar = () => screen.queryByText('🎉 최종 합격 처리하기')

beforeEach(() => {
  vi.clearAllMocks()
  io.initial = false
  io.cbs = []
  io.opts = []
  installIO()
  h.app = makeApp(0)
})
afterEach(() => vi.unstubAllGlobals())

describe('A. 기본 = 축소', () => {
  it('A1. FAB 이 있고 풀폭 바는 없다', () => {
    draw()
    expect(fab()).toBeTruthy()
    expect(bar()).toBeNull()
  })

  it('A2. 아이콘 전용이라 이름을 aria-label 이 진다', () => {
    draw()
    expect(fab()!.getAttribute('aria-label')).toBe('이 단계 완료하기')
    expect(fab()!.getAttribute('title')).toBe('이 단계 완료하기')
  })
})

describe('B. 확장', () => {
  it('B1. sentinel 이 보이면 풀폭 바가 뜨고 FAB 은 사라진다', () => {
    draw()
    expect(bar()).toBeNull()
    fire(true)
    expect(bar()).toBeTruthy()
    expect(fab()).toBeNull()
  })

  /**
   * 🔴 **관측 전 기본값 함정.** 체크리스트도 노트도 빈 새 스텝은 스크롤이 없어 sentinel 이
   * 처음부터 보인다 — 최초 콜백이 곧바로 확장시켜야 "짧은 페이지인데 영영 작은 버튼" 이 안 된다.
   */
  it('B2. 🔴 짧은 페이지(관측 즉시 보임) → 처음부터 풀폭', () => {
    io.initial = true
    draw()
    expect(bar()).toBeTruthy()
    expect(fab()).toBeNull()
  })

  it('B3. 다시 멀어지면 축소로 돌아온다', () => {
    draw()
    fire(true)
    expect(bar()).toBeTruthy()
    fire(false)
    expect(bar()).toBeNull()
    expect(fab()).toBeTruthy()
  })

  /** 끝에 "닿기 직전" 부터 커져야 손이 먼저 가 있다 */
  it('B4. rootMargin 으로 근처를 본다 (하단 160px)', () => {
    draw()
    expect(io.opts[0]?.rootMargin).toBe('0px 0px 160px 0px')
  })
})

describe('C. 동작 동일성', () => {
  it('C1. FAB 클릭 = 기존 완료 동작 (다음 스텝으로)', () => {
    draw()
    fireEvent.click(fab()!)
    expect(h.updateCurrentStep).toHaveBeenCalledWith({ id: 'app-1', stepIndex: 1 })
  })

  /**
   * 🔴 **마지막 스텝은 되돌리기 어렵다** (카드가 합격으로 전환된다). 축소형이 됐다고
   * 확인 단계를 건너뛰면, 작아진 버튼을 잘못 눌러 합격 처리되는 길이 생긴다.
   */
  it('C2. 🔴 마지막 스텝 FAB 은 즉시 처리하지 않고 확인 모달을 연다', () => {
    h.app = makeApp(1)
    draw('s1')
    fireEvent.click(lastFab()!)
    expect(h.updateApplication).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '최종 합격 처리' })).toBeTruthy()
  })
})

describe('D. 라벨 · 아이콘 분기', () => {
  it('D1. 마지막 스텝 FAB 이름은 「최종 합격 처리하기」', () => {
    h.app = makeApp(1)
    draw('s1')
    expect(lastFab()).toBeTruthy()
    expect(fab()).toBeNull()
  })

  /** 보이는 문구는 기존 그대로 — 이모지를 뺀 건 낭독용 이름뿐이다 */
  it('D2. 풀폭 바의 문구는 기존 그대로 (🎉 포함)', () => {
    h.app = makeApp(1)
    draw('s1')
    fire(true)
    expect(lastBar()).toBeTruthy()
  })

  it('D3. 두 상태의 아이콘이 다르다 (완료 체크 ↔ 축하)', () => {
    draw()
    const normalIcon = fab()!.querySelector('svg')!.getAttribute('class')
    h.app = makeApp(1)
    const { unmount } = draw('s1')
    const lastIcon = lastFab()!.querySelector('svg')!.getAttribute('class')
    expect(normalIcon).not.toBe(lastIcon)
    unmount()
  })
})

describe('E. 퇴화 · 게이팅', () => {
  /**
   * 🔴 관측할 수 없으면 **오늘의 화면**으로 돌아간다. 축소인 채로 굳어도 못 쓰는 건
   * 아니지만, 확장 조건이 영영 오지 않는 상태를 "정상" 으로 두지 않는다.
   */
  it('E1. 🔴 IntersectionObserver 가 없으면 풀폭 바 (버튼이 사라지지 않는다)', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    draw()
    expect(bar()).toBeTruthy()
    expect(fab()).toBeNull()
  })

  it('E2. 현재 스텝이 아니면 둘 다 없다', () => {
    h.app = makeApp(1) // 현재는 s1 인데 s0 을 본다
    draw('s0')
    expect(fab()).toBeNull()
    expect(bar()).toBeNull()
  })
})
