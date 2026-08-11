/**
 * 나란히 보기 — **오른쪽 열이 자소서만은 아니다** (2026-08-11).
 *
 * 🔴 **왜 필요했나.** 면접 준비 노트의 기본 포맷 첫 칸이 「예상 질문 & 답변」이다.
 * 즉 여기 적힌 게 곧 이 세션에서 다듬는 것인데, 답을 쓰는 화면에서는 볼 수가 없어
 * 카드 상세 → 스텝으로 나갔다 돌아와야 했다 — 자소서를 옆에 붙인 것과 **같은 이유**다.
 *
 * 이 spec 이 잠그는 것:
 *   ① 접힌 세로 탭이 **둘**이고, 누른 쪽이 오른쪽 열의 내용이 된다 (진입은 기존 문법 = 전체 펼침)
 *   ② 🔴 면접 스텝이 0개면 **탭 자체가 없다** — 눌러도 빈 노트만 나온다
 *   ③ 열려 있는 동안엔 헤더 세그먼트로 갈아탄다 — **비율·분할 상태는 그대로**
 *   ④ 스텝이 여럿이면 열 안에서 고른다. 고르면 **그 스텝의 노트**가 온다 (남의 노트 저장 방지)
 *   ⑤ 노트를 보는 중엔 자소서를 조회하지 않는다 (「안 쓰는 화면에서 조회하지 않는다」의 연장)
 *
 * 기존 3단 접힘·드래그 계약은 `InterviewSessionPage.split.test.tsx` 가 잠근다 — 그쪽은 손대지 않았다.
 */
import ReactForMock from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import type { ApplicationStep } from '@/types/application'
import { InterviewSessionPage } from './InterviewSessionPage'

const SAVED_JSON = '{"type":"doc","content":[]}'

/** 나란히 보기는 **컨테이너 폭**으로 판정한다 — 뷰포트가 아니다 (split.test 와 같은 스텁) */
const box = vi.hoisted(() => ({ width: 1200 }))
const h = vi.hoisted(() => ({
  steps: [] as unknown[],
  clEnabled: [] as boolean[],
  updateStep: vi.fn(
    (_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
  ),
}))

/** jsdom 은 레이아웃을 안 해 rect 가 전부 0 이다 — 폭을 주어야 2열 판정이 산다 */
const realRect = Element.prototype.getBoundingClientRect
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    return {
      x: 0, y: 200, width: box.width, height: 800,
      top: 200, left: 0, right: box.width, bottom: 1000, toJSON: () => ({}),
    } as DOMRect
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
      }
      observe() {
        this.cb(
          [{ contentRect: { width: box.width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect
})

const session = {
  id: 's-1',
  applicationId: 'app-1',
  round: '1차 실무 면접',
  interviewType: null,
  coverletterIds: ['cl-1'],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
  generationStatus: 'completed',
  createdAt: '2026-08-11T00:00:00.000Z',
}

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () => ({ data: session, isLoading: false, isError: false }),
  useInterviewPrepQuestions: () => ({ data: [], isLoading: false, isError: false }),
  useInterviewPrepRefs: () => ({ data: undefined }),
  useGenerateInterviewSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInterviewSession: () => ({ mutate: vi.fn() }),
  useUpdateInterviewPrepSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRefetchQuestionsOnGenerationEnd: vi.fn(),
  questionsKey: (id: string) => ['interview-prep-questions', id],
  sessionKey: (id: string) => ['interview-prep-session', id],
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { companyName: '카카오', steps: h.steps } }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: (_id: string, enabled: boolean) => {
    h.clEnabled.push(enabled)
    return { data: [], isLoading: false, isError: false }
  },
  useUpdateCoverletter: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useUpdateStep: () => ({ mutate: h.updateStep }),
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useAiQuotaBlocked: () => ({ blocked: false, reason: null }),
  useMyAiQuota: () => undefined,
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({ useRequireAiConsent: () => vi.fn() }))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn(),
  resolveJobText: () => '',
}))
vi.mock('@/hooks/useUnloadGuard', () => ({ useUnloadGuard: vi.fn() }))
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))
vi.mock('@/components/card/CompanyResearchCard', () => ({ CompanyResearchCard: () => null }))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({ JobPostingBanner: () => null }))
vi.mock('@/components/card/EditInterviewSessionModal', () => ({
  EditInterviewSessionModal: () => null,
}))
vi.mock('@/components/card/InterviewQuestionCard', () => ({ InterviewQuestionCard: () => null }))
vi.mock('@/components/coverletter/CoverletterQuestionCard', () => ({
  CoverletterQuestionCard: () => null,
}))
vi.mock('@/components/common/AiQuotaChip', () => ({ AiQuotaChip: () => null }))
/*
  tiptap 은 jsdom 에 안 올라간다 — StepPage spec 들과 같은 대역을 쓴다.
  받은 prop 을 그대로 드러내야 「어느 스텝의 노트인가」를 잴 수 있다.
*/
vi.mock('@/components/editor/StepNoteEditor', () => ({
  /*
    🔴 목이 tiptap 의 **init-only 의미론**을 흉내 내야 한다 (2026-08-13 뮤테이션 감사).
    최신 prop 을 그대로 비추는 목으로는 `key={step.id}` 를 지워도 통과했다 — 실제
    tiptap 은 `content` 를 초기화 때만 읽어서, key 없이 prop 만 갈리면 직전 노트를
    보여주며 새 스텝에 저장한다. 그래서 initialContent 는 **첫 렌더 값을 박제**한다
    (React.useState 초기화 — remount 돼야만 새 값이 잡힌다).
  */
  StepNoteEditor: ({
    stepName,
    initialContent,
    onSave,
  }: {
    stepName: string
    initialContent: string | null
    onSave: (j: string) => Promise<void>
  }) => {
    const [frozen] = ReactForMock.useState(initialContent)
    return (
      <div>
        <div data-testid="note-step">{stepName}</div>
        <div data-testid="note-init">{frozen ?? 'NULL'}</div>
        <button onClick={() => onSave(SAVED_JSON)}>저장노트</button>
      </div>
    )
  },
}))

function step(over: Partial<ApplicationStep> & { id: string; name: string }): ApplicationStep {
  return {
    applicationId: 'app-1',
    orderIndex: 0,
    scheduledDate: null,
    location: null,
    notes: null,
    pinnedContent: null,
    ...over,
  }
}

const draw = ({ demo = false } = {}) =>
  render(
    <DemoModeContextProvider value={demo}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/interviews/s-1']}>
          <InterviewSessionPage />
        </MemoryRouter>
      </QueryClientProvider>
    </DemoModeContextProvider>,
  )

const handle = () => screen.getByRole('button', { name: /구분선/ })
const cols = () =>
  ((handle().parentElement as HTMLElement).parentElement as HTMLElement).style
    .gridTemplateColumns
const noteTab = () => screen.queryByRole('button', { name: '준비 노트 펼치기' })
const clTab = () => screen.queryByRole('button', { name: '자소서 펼치기' })
/** 헤더 세그먼트 — 세로 탭(「… 펼치기」)과 이름이 겹치지 않는다 */
const seg = (name: '자소서' | '준비 노트') => screen.getByRole('button', { name })

beforeEach(() => {
  box.width = 1200
  localStorage.clear()
  document.body.className = ''
  h.clEnabled = []
  h.updateStep.mockClear()
  h.steps = [
    step({ id: 'st-1', name: '서류 제출', orderIndex: 0 }),
    step({ id: 'st-2', name: '1차 실무 면접', orderIndex: 1, notes: 'NOTE_ST2' }),
  ]
})

describe('접힌 세로 탭 — 두 개', () => {
  it('자소서 옆에 준비 노트 탭이 있다', () => {
    draw()
    expect(clTab()).toBeTruthy()
    expect(noteTab()).toBeTruthy()
  })

  /** 🔴 스텝이 없으면 노트도 없다 — 눌러도 빈 화면인 컨트롤은 두지 않는다 */
  it('🔴 면접 스텝이 0개면 준비 노트 탭이 없다', () => {
    h.steps = [step({ id: 'st-1', name: '서류 제출' })]
    draw()
    expect(clTab()).toBeTruthy()
    expect(noteTab()).toBeNull()
  })

  it("🔴 이름에 '면접' 이 없어도 면접형이면 탭이 생긴다 (2차 컬처핏)", () => {
    h.steps = [step({ id: 'st-9', name: '2차 컬처핏' })]
    draw()
    expect(noteTab()).toBeTruthy()
  })

  /** 🔴 자소서 탭과 **같은 문법** — 「펼치기」라고 쓰여 있으면 그쪽만 전체 펼친다 */
  it('🔴 준비 노트 탭을 누르면 그쪽만 펼쳐진다 (반반 아님)', () => {
    draw()
    fireEvent.click(noteTab()!)
    expect(cols()).toContain('44px 22px 1fr')
    expect(screen.getByRole('region', { name: '면접 준비 노트' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '면접 펼치기' })).toBeTruthy()
  })

  it('자소서 탭은 그대로 자소서를 편다 (기존 동작 무변화)', () => {
    draw()
    fireEvent.click(clTab()!)
    expect(cols()).toContain('44px 22px 1fr')
    expect(screen.getByRole('region', { name: '자기소개서' })).toBeTruthy()
  })

  /** 기본값은 자소서 — 손잡이로 반반에 들어가도 지금까지의 화면 그대로다 */
  it('손잡이로 연 반반의 오른쪽은 자소서다', () => {
    draw()
    fireEvent.click(handle())
    expect(screen.getByRole('region', { name: '자기소개서' })).toBeTruthy()
  })
})

describe('열 헤더 세그먼트 — 열린 채로 갈아탄다', () => {
  it('반반에서 자소서 ↔ 준비 노트를 오간다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    fireEvent.click(seg('준비 노트'))
    expect(screen.getByRole('region', { name: '면접 준비 노트' })).toBeTruthy()
    fireEvent.click(seg('자소서'))
    expect(screen.getByRole('region', { name: '자기소개서' })).toBeTruthy()
  })

  /**
   * 🔴 **비율이 유지돼야 한다.** 세로 탭으로 되돌아가 다시 펴는 길밖에 없으면
   * 그때마다 `goSplit('both')` 가 50:50 으로 리셋한다 — 맞춰 둔 폭이 매번 날아간다.
   */
  it('🔴 전환해도 비율이 그대로다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    fireEvent.keyDown(handle(), { key: 'ArrowRight' }) // 0.55
    expect(cols()).toContain('0.55')
    fireEvent.click(seg('준비 노트'))
    expect(cols()).toContain('0.55')
  })

  /** 🔴 분할 상태(한쪽만 보기)도 건드리지 않는다 — 내용만 갈린다 */
  it('🔴 한쪽만 보는 중에 전환해도 접히지 않는다', () => {
    draw()
    fireEvent.click(clTab()!) // 자소서만
    fireEvent.click(seg('준비 노트'))
    expect(cols()).toContain('44px 22px 1fr')
    expect(screen.getByRole('region', { name: '면접 준비 노트' })).toBeTruthy()
  })

  /** 스텝이 없으면 고를 게 없다 — 세그먼트도 두지 않는다 */
  it('면접 스텝이 0개면 세그먼트가 없다', () => {
    h.steps = [step({ id: 'st-1', name: '서류 제출' })]
    draw()
    fireEvent.click(handle())
    expect(screen.queryByRole('group', { name: '오른쪽 열 내용' })).toBeNull()
  })

  /**
   * 🔴 손잡이 이름은 **누르면 무엇이 되는지**를 말한다. 노트를 보는 중에 「자소서만」이라고
   * 하면 화면 낭독기 사용자는 매번 다른 곳에 도착한다.
   */
  it('🔴 손잡이 이름이 오른쪽 내용을 따라간다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    expect(handle().getAttribute('aria-label')).toContain('자소서만')
    fireEvent.click(seg('준비 노트'))
    expect(handle().getAttribute('aria-label')).toContain('준비 노트만')
  })
})

describe('면접 스텝이 여러 개', () => {
  beforeEach(() => {
    h.steps = [
      step({ id: 'st-2', name: '1차 실무 면접', orderIndex: 1, notes: 'NOTE_ST2' }),
      step({ id: 'st-3', name: '2차 임원 면접', orderIndex: 2, notes: 'NOTE_ST3' }),
    ]
  })

  const picker = () => screen.getByRole('combobox', { name: '준비 노트를 볼 면접 단계' })

  it('열 안에서 스텝을 고른다 — 기본은 첫 번째', () => {
    draw()
    fireEvent.click(noteTab()!)
    expect(screen.getByTestId('note-step').textContent).toBe('1차 실무 면접')
    expect((picker() as HTMLSelectElement).value).toBe('st-2')
  })

  /**
   * 🔴 **고른 스텝의 노트가 와야 한다.** tiptap 은 `content` 를 초기화 때만 읽으므로
   * 같은 자리에서 prop 만 갈면 직전 노트를 보여주면서 **새 스텝에 저장한다** —
   * 조용히 남의 노트를 덮어쓰는 경로다.
   */
  it('🔴 고르면 그 스텝의 노트가 온다', () => {
    draw()
    fireEvent.click(noteTab()!)
    expect(screen.getByTestId('note-init').textContent).toBe('NOTE_ST2')
    fireEvent.change(picker(), { target: { value: 'st-3' } })
    expect(screen.getByTestId('note-step').textContent).toBe('2차 임원 면접')
    expect(screen.getByTestId('note-init').textContent).toBe('NOTE_ST3')
  })

  it('저장은 고른 스텝으로 나간다', () => {
    draw()
    fireEvent.click(noteTab()!)
    fireEvent.change(picker(), { target: { value: 'st-3' } })
    fireEvent.click(screen.getByText('저장노트'))
    expect(h.updateStep.mock.calls[0][0]).toMatchObject({
      stepId: 'st-3',
      notes: SAVED_JSON,
    })
  })

  /** 선택지가 하나뿐인 select 는 잡음이다 */
  it('스텝이 1개면 고르는 칸이 없다', () => {
    h.steps = [step({ id: 'st-2', name: '1차 실무 면접' })]
    draw()
    fireEvent.click(noteTab()!)
    expect(
      screen.queryByRole('combobox', { name: '준비 노트를 볼 면접 단계' }),
    ).toBeNull()
  })
})

describe('전체 화면으로 가는 길', () => {
  it('그 스텝의 스텝 화면으로 간다', () => {
    draw()
    fireEvent.click(noteTab()!)
    expect(
      screen.getByRole('link', { name: /전체 화면으로/ }).getAttribute('href'),
    ).toBe('/board/app-1/steps/st-2')
  })

  /** 🔴 프리픽스가 빠지면 AuthGuard 로 빠져 랜딩으로 튕긴다 */
  it('🔴 데모에서는 /demo 안에 머문다', () => {
    draw({ demo: true })
    fireEvent.click(noteTab()!)
    expect(
      screen.getByRole('link', { name: /전체 화면으로/ }).getAttribute('href'),
    ).toBe('/demo/board/app-1/steps/st-2')
  })
})

/**
 * 🔴 **죽은 `pinnedContent` 는 저장할 때 함께 비운다** (`StepPage.handleSaveNotes` 와 같은 규칙).
 * 화면에는 `mergePinnedIntoNotes` 로 📌 문단이 앞에 붙는데, 그걸 본문에 넣어 저장하면서
 * 원본을 안 지우면 **스텝 화면에서 또 붙어 중복**이 된다.
 */
describe('핵심 메모 이관', () => {
  it('🔴 병합해 보여주고, 저장하면서 원본을 비운다', () => {
    h.steps = [
      step({ id: 'st-2', name: '1차 실무 면접', pinnedContent: '신분증 지참' }),
    ]
    draw()
    fireEvent.click(noteTab()!)
    expect(screen.getByTestId('note-init').textContent).toContain('신분증 지참')
    fireEvent.click(screen.getByText('저장노트'))
    expect(h.updateStep.mock.calls[0][0]).toMatchObject({
      stepId: 'st-2',
      notes: SAVED_JSON,
      pinnedContent: null,
    })
  })

  it('핵심 메모가 없으면 동봉하지 않는다', () => {
    draw()
    fireEvent.click(noteTab()!)
    fireEvent.click(screen.getByText('저장노트'))
    expect(h.updateStep.mock.calls[0][0]).not.toHaveProperty('pinnedContent')
  })
})

/**
 * 🔴 **안 보이는 자료는 조회하지 않는다** (기존 「면접만 볼 땐 자소서를 조회하지 않는다」의 연장).
 * 노트 열에는 자소서가 없는데도 켜 두면, 노트만 쓰는 사용자가 열 때마다 자소서를 한 번씩 받는다.
 */
describe('조회 조건', () => {
  it('🔴 준비 노트를 보는 중엔 자소서를 조회하지 않는다', () => {
    draw()
    fireEvent.click(handle()) // 반반 — 자소서
    expect(h.clEnabled.at(-1)).toBe(true)
    fireEvent.click(seg('준비 노트'))
    expect(h.clEnabled.at(-1)).toBe(false)
    fireEvent.click(seg('자소서'))
    expect(h.clEnabled.at(-1)).toBe(true)
  })
})
