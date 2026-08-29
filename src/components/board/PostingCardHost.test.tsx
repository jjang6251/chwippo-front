/**
 * 공고 카드 뒤처리 — **결과 시트 조건 3개**와 되돌리기.
 *
 * ## 케이스 목록
 *
 * **결과 시트 조건**
 *  1. 보드에 있을 때만 뜬다
 *  2. 🔴 다른 화면이면 안 뜨고 토스트로만 알린다 (검토는 카드 상세 확인 줄이 받는다)
 *  3. 🔴 첫 카드면 축하 오버레이만 (두 겹 금지)
 *  4. 🔴 한 번에 하나 — 이미 잡혀 있으면 「…도 만들어졌어요」
 *
 * **되돌리기**
 *  5. 시트가 닫힌 **뒤에** 토스트가 뜬다 (시트와 겹치지 않는다)
 *  6. 되돌리기 → 카드 삭제
 *
 * **곁다리**
 *  7. 마감이 있는 카드만 네이티브 soft-ask 를 깨운다
 *  8. 만들어진 카드가 목록 캐시 맨 앞에 꽂힌다 (refetch 전에도 보인다)
 *
 * **계열(jobCategory) 채움 — 서버엔 분류기가 없다**
 * 13. 직무가 확정 분류되면 계열 라벨을 캐시에 넣고 서버에도 한 번 보낸다
 * 14. 🔴 확정이 아니면 **비운 채로 둔다** (추측을 저장으로 승격하지 않는다)
 * 15. 🔴 데모는 서버를 부르지 않는다 (캐시만)
 *
 * **스코프 (2026-08-29 데모 실측 결함)**
 *  9. 🔴 데모 항목을 **앱 호스트가 집지 않는다** (집으면 앱 QueryClient 에 심고 시트가 즉시 닫힌다)
 * 10. 🔴 실서비스 항목을 **데모 호스트가 집지 않는다**
 * 11. 데모 호스트는 데모 항목을 제대로 처리한다 (시트가 뜬다)
 * 12. 🔴 남의 스코프 시트는 렌더하지 않는다
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const remove = vi.fn()
const update = vi.fn()
vi.mock('@/api/applications', () => ({
  applicationsApi: {
    remove: (...a: unknown[]) => remove(...a),
    update: (...a: unknown[]) => update(...a),
  },
}))

vi.mock('@/hooks/useCoverletterDoc', () => ({ prefetchCompanyResearchNoHit: vi.fn() }))

const postToNative = vi.fn()
vi.mock('@/utils/nativeBridge', () => ({ postToNative: (...a: unknown[]) => postToNative(...a) }))

let firstCard = false
vi.mock('@/utils/firstCardCelebration', () => ({
  shouldCelebrateFirstCard: () => firstCard,
}))

const showFirstCardCelebration = vi.fn()
vi.mock('@/stores/celebrationStore', () => ({
  showFirstCardCelebration: (...a: unknown[]) => showFirstCardCelebration(...a),
}))

vi.mock('@/stores/researchRevealStore', () => ({ revealCardResearch: vi.fn() }))

/**
 * 🔴 이 호스트가 **어느 스코프 것인가**. 실서비스는 false(App 레벨), 데모는 true(`DemoShell`).
 * 데모 라우트는 별도 QueryClient 를 쓰므로 호스트도 스코프마다 하나씩 뜬다.
 */
let hostDemo = false
vi.mock('@/contexts/demoMode', () => ({ useDemoMode: () => hostDemo }))

// 시트 본체는 여기 관심 밖 — 열렸는지와 닫기만 본다
vi.mock('@/components/board/PostingResultSheet', () => ({
  PostingResultSheet: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>결과 시트</span>
      <button onClick={onClose}>시트 닫기</button>
    </div>
  ),
}))

let applications: Application[] = []
vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: applications }),
}))

import { PostingCardHost } from './PostingCardHost'
import { usePendingCardStore } from '@/stores/pendingCardStore'
import { useToastStore } from '@/stores/toastStore'
import type { Application } from '@/types/application'

function card(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    userId: 'u1',
    companyName: '무신사',
    jobTitle: '브랜드 마케터',
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

let qc: QueryClient
function renderHost(path = '/board') {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['applications'], [])
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <PostingCardHost />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

function complete(over: { card?: Application; hasDeadline?: boolean } = {}) {
  const c = over.card ?? card()
  applications = [c]
  act(() => {
    usePendingCardStore
      .getState()
      .pushCompleted({ card: c, demo: false, hasDeadline: over.hasDeadline ?? false })
  })
}

const toasts = () => useToastStore.getState().toasts

beforeEach(() => {
  vi.clearAllMocks()
  firstCard = false
  hostDemo = false
  applications = []
  usePendingCardStore.getState().reset()
  useToastStore.setState({ toasts: [] })
  remove.mockResolvedValue(undefined)
  update.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('결과 시트 조건', () => {
  it('1) 보드에 있으면 뜬다', async () => {
    renderHost('/board')
    complete()
    expect(await screen.findByText('결과 시트')).toBeInTheDocument()
    expect(toasts()).toHaveLength(0)
  })

  it('1-b) 데모 보드에서도 뜬다', async () => {
    renderHost('/demo/board')
    complete()
    expect(await screen.findByText('결과 시트')).toBeInTheDocument()
  })

  it('2) 🔴 카드 상세·다른 화면이면 안 뜨고 토스트만', () => {
    renderHost('/board/app-9')
    complete()
    expect(screen.queryByText('결과 시트')).toBeNull()
    expect(toasts()[0].message).toBe('무신사 카드를 만들었어요')
  })

  it('3) 🔴 첫 카드면 축하만 — 시트는 겹치지 않는다', () => {
    firstCard = true
    renderHost('/board')
    complete()
    expect(showFirstCardCelebration).toHaveBeenCalled()
    expect(screen.queryByText('결과 시트')).toBeNull()
    // 되돌리기는 어느 경로에서든 준다
    expect(toasts()[0].action?.label).toBe('되돌리기')
  })

  it('4) 🔴 시트가 이미 잡혀 있으면 「…도 만들어졌어요」', () => {
    // 앞 카드가 시트를 잡고 있는 상황 — 그 카드는 목록에 살아 있어야 시트가 안 닫힌다
    const first = card({ id: 'other', companyName: '카카오' })
    const second = card({ id: 'app-1' })
    applications = [first, second]
    renderHost('/board')
    act(() => { usePendingCardStore.getState().openSheet('other', false) })
    act(() => {
      usePendingCardStore
        .getState()
        .pushCompleted({ card: second, demo: false, hasDeadline: false })
    })
    expect(toasts()[0].message).toBe('무신사 카드도 만들었어요')
  })
})

describe('되돌리기', () => {
  it('5) 시트가 닫힌 뒤에 토스트가 뜬다', async () => {
    renderHost('/board')
    complete()
    await screen.findByText('결과 시트')
    expect(toasts()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: '시트 닫기' }))
    expect(toasts()[0].message).toBe('무신사 카드를 만들었어요')
  })

  it('6) 되돌리기 → 카드 삭제', async () => {
    renderHost('/board/app-9')
    complete()
    act(() => { toasts()[0].action!.onAction() })
    await waitFor(() => expect(remove).toHaveBeenCalledWith('app-1'))
  })
})

describe('곁다리', () => {
  it('7) 마감이 있을 때만 네이티브를 깨운다', () => {
    renderHost('/board')
    complete({ hasDeadline: false })
    expect(postToNative).not.toHaveBeenCalled()

    cleanup()
    renderHost('/board')
    complete({ hasDeadline: true, card: card({ id: 'app-2' }) })
    expect(postToNative).toHaveBeenCalledWith({ type: 'deadline-saved' })
  })

  it('8) 목록 캐시 맨 앞에 꽂힌다', () => {
    renderHost('/board')
    qc.setQueryData(['applications'], [card({ id: 'old' })])
    complete()
    const list = qc.getQueryData<Application[]>(['applications'])
    expect(list?.map((a) => a.id)).toEqual(['app-1', 'old'])
  })
})

describe('스코프 분리 — 데모는 별도 QueryClient', () => {
  const push = (demo: boolean) => {
    const c = card({ id: demo ? 'demo-1' : 'app-1' })
    applications = [c]
    act(() => {
      usePendingCardStore.getState().pushCompleted({ card: c, demo, hasDeadline: false })
    })
    return c
  }

  it('9) 🔴 데모 항목을 앱 호스트가 집지 않는다 — 대기열에 그대로 남는다', () => {
    hostDemo = false
    renderHost('/board')
    push(true)
    expect(screen.queryByText('결과 시트')).toBeNull()
    expect(toasts()).toHaveLength(0)
    expect(usePendingCardStore.getState().completed).toHaveLength(1)
  })

  it('10) 🔴 실서비스 항목을 데모 호스트가 집지 않는다', () => {
    hostDemo = true
    renderHost('/demo/board')
    push(false)
    expect(screen.queryByText('결과 시트')).toBeNull()
    expect(toasts()).toHaveLength(0)
    expect(usePendingCardStore.getState().completed).toHaveLength(1)
  })

  it('11) 데모 호스트는 데모 항목을 처리한다', async () => {
    hostDemo = true
    renderHost('/demo/board')
    push(true)
    expect(await screen.findByText('결과 시트')).toBeInTheDocument()
    expect(usePendingCardStore.getState().completed).toHaveLength(0)
    expect(usePendingCardStore.getState().sheetDemo).toBe(true)
  })

  it('12) 🔴 남의 스코프 시트는 렌더하지 않는다', () => {
    hostDemo = false
    renderHost('/board')
    act(() => { usePendingCardStore.getState().openSheet('app-1', true) })
    expect(screen.queryByText('결과 시트')).toBeNull()
  })
})

describe('계열 채움', () => {
  const pushWith = (jobTitle: string | null, demo = false) => {
    const c = card({ id: 'app-1', jobTitle, jobCategory: null })
    applications = [c]
    act(() => {
      usePendingCardStore.getState().pushCompleted({ card: c, demo, hasDeadline: false })
    })
  }

  it('13) 확정 분류 → 캐시 + 서버 둘 다', () => {
    renderHost('/board')
    pushWith('간호사')
    const list = qc.getQueryData<Application[]>(['applications'])
    expect(list?.[0].jobCategory).toBe('의료·보건·복지')
    expect(update).toHaveBeenCalledWith('app-1', { jobCategory: '의료·보건·복지' })
  })

  it('14) 🔴 분류 실패면 비운 채로 둔다 — 서버도 안 부른다', () => {
    renderHost('/board')
    pushWith('zzzz알수없는말')
    const list = qc.getQueryData<Application[]>(['applications'])
    expect(list?.[0].jobCategory).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it('14-b) 직무 자체가 없으면 아무 일도 안 한다', () => {
    renderHost('/board')
    pushWith(null)
    expect(update).not.toHaveBeenCalled()
  })

  it('15) 🔴 데모는 서버를 안 부른다 (캐시만)', () => {
    hostDemo = true
    renderHost('/demo/board')
    pushWith('간호사', true)
    expect(qc.getQueryData<Application[]>(['applications'])?.[0].jobCategory).toBe(
      '의료·보건·복지',
    )
    expect(update).not.toHaveBeenCalled()
  })
})
