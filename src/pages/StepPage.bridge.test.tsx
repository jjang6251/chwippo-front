/**
 * 다리 (a) — **준비 노트 → 면접 질문 은행** (2026-08-11).
 *
 * 🔴 **왜 다리를 놓았나.** 이 기능의 출발점이 "준비 노트에 기출을 적던 사람" 인데,
 * 정작 노트에서 질문 은행으로 가는 길이 **한 건도 없었다** — 둘의 공통 조상인 카드
 * 상세를 거쳐 돌아가야 했다. 노트에 적은 예상 질문이 그 자리에서 죽는다는 뜻이다.
 *
 * 이 spec 이 잠그는 것:
 *   ① **면접 스텝에만** 나온다 — 서류·시험 스텝의 노트는 질문이 아니다
 *   ② 판정은 `getStepType` 단일 구현 — 스텝명에 '면접' 이 없는 'PT·토론'도 면접형이다
 *   ③ 노트가 비면 **잠근다** — 빈 채로 넘어가면 세션 생성(코인)만 쓰고 빈 폼을 만난다
 *   ④ 넘어가는 값은 노트의 **plain text** 이고, 저장 전 편집분까지 따라간다
 *      (저장은 1.5s debounce — 적자마자 누르는 사람이 이 기능의 주인공이다)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'

const h = vi.hoisted(() => ({
  app: null as Application | null,
  navigate: vi.fn(),
  sessions: [] as { id: string; round: string }[],
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: h.app, isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
  useUpdateCurrentStep: () => ({ mutate: vi.fn() }),
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
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSessions: () => ({
    data: h.sessions,
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: () => <div>새 면접 준비 만들기 모달</div>,
}))
/**
 * tiptap 은 jsdom 에 올리지 않는다 (이 spec 의 관심사가 아니다).
 * 대신 **저장 전 편집**을 흉내 낼 손잡이를 둔다 — 실제 에디터의 `onTextChange` 자리다.
 */
vi.mock('@/components/editor/StepNoteEditor', () => ({
  StepNoteEditor: ({
    initialContent,
    onTextChange,
  }: {
    initialContent: string | null
    onTextChange?: (t: string) => void
  }) => (
    <div>
      <div data-testid="note-init">{initialContent ?? 'NULL'}</div>
      <button onClick={() => onTextChange?.('방금 친 질문')}>편집흉내</button>
      <span data-testid="has-textchange">{onTextChange ? 'yes' : 'no'}</span>
    </div>
  ),
}))

import { StepPage } from './StepPage'

const DOC = (lines: string[]) =>
  JSON.stringify({
    type: 'doc',
    content: lines.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  })

function step(
  orderIndex: number,
  name: string,
  over: Partial<ApplicationStep> = {},
): ApplicationStep {
  return {
    id: `s${orderIndex}`,
    applicationId: 'app-1',
    orderIndex,
    name,
    scheduledDate: null,
    location: null,
    notes: null,
    pinnedContent: null,
    ...over,
  }
}

function setApp(steps: ApplicationStep[]) {
  h.app = {
    id: 'app-1',
    companyName: '카카오',
    currentStepIndex: 0,
    steps,
  } as unknown as Application
}

function draw(stepId = 's0') {
  return render(
    <MemoryRouter initialEntries={[`/board/app-1/steps/${stepId}`]}>
      <Routes>
        <Route path="/board/:id/steps/:stepId" element={<StepPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const bridgeBtn = () =>
  screen.queryByRole('button', { name: /이 내용으로 면접 질문 만들기/ })

beforeEach(() => {
  h.navigate.mockReset()
  h.sessions = [{ id: 'sess-1', round: '1차 실무 면접' }]
  h.app = null
})

describe('🎤 다리는 면접 스텝에만 놓인다', () => {
  it('면접 스텝이면 버튼이 있다', () => {
    setApp([step(0, '1차 면접', { notes: DOC(['1분 자기소개']) })])
    draw()
    expect(bridgeBtn()).toBeTruthy()
  })

  it('서류 스텝에는 없다 (제출 서류 목록은 질문이 아니다)', () => {
    setApp([step(0, '서류 제출', { notes: DOC(['자소서 최종본']) })])
    draw()
    expect(bridgeBtn()).toBeNull()
  })

  it('시험 스텝에도 없다', () => {
    setApp([step(0, '코딩테스트', { notes: DOC(['그래프 복습']) })])
    draw()
    expect(bridgeBtn()).toBeNull()
  })

  /** 🔴 flow.md 는 "이름에 '면접' 포함"이라 적혀 있지만 코드의 판정은 더 넓다 */
  it("🔴 이름에 '면접' 이 없어도 면접형이면 나온다 (2차 PT·토론)", () => {
    setApp([step(0, '2차 PT·토론', { notes: DOC(['우리 서비스 개선안']) })])
    draw()
    expect(bridgeBtn()).toBeTruthy()
  })

  it('면접 스텝이 아니면 에디터에 편집 구독도 붙이지 않는다', () => {
    setApp([step(0, '서류 제출')])
    draw()
    expect(screen.getByTestId('has-textchange').textContent).toBe('no')
  })
})

describe('🔴 넘길 내용이 없으면 잠근다', () => {
  it('🔴 노트가 비면 disabled — 코인만 쓰고 빈 폼을 만나지 않는다', () => {
    setApp([step(0, '1차 면접', { notes: null })])
    draw()
    const btn = bridgeBtn()!
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('title')).toContain('비어 있어요')
  })

  it('빈 문단만 있는 노트도 비어 있는 것으로 본다', () => {
    setApp([step(0, '1차 면접', { notes: '{"type":"doc","content":[{"type":"paragraph"}]}' })])
    draw()
    expect(bridgeBtn()!.hasAttribute('disabled')).toBe(true)
  })

  it('잠겨 있으면 눌러도 옮기지 않는다', () => {
    setApp([step(0, '1차 면접', { notes: null })])
    draw()
    fireEvent.click(bridgeBtn()!)
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('내용이 생기면 풀리고 안내 문구도 바뀐다', () => {
    setApp([step(0, '1차 면접', { notes: DOC(['1분 자기소개']) })])
    draw()
    const btn = bridgeBtn()!
    expect(btn.hasAttribute('disabled')).toBe(false)
    expect(btn.getAttribute('title')).not.toContain('비어 있어요')
  })
})

describe('노트를 실어 보낸다', () => {
  it('세션이 1개면 바로 그리로, state 에 노트 본문을 담아서', () => {
    setApp([
      step(0, '1차 면접', { notes: DOC(['1분 자기소개', '지원 동기는?']) }),
    ])
    draw()
    fireEvent.click(bridgeBtn()!)
    expect(h.navigate).toHaveBeenCalledWith('/interviews/sess-1', {
      state: { bridgeText: '1분 자기소개\n지원 동기는?' },
    })
  })

  it('죽은 핵심 메모(pinnedContent)도 노트의 일부로 따라간다', () => {
    setApp([
      step(0, '1차 면접', {
        notes: DOC(['1분 자기소개']),
        pinnedContent: '압박 면접 대비',
      }),
    ])
    draw()
    fireEvent.click(bridgeBtn()!)
    expect(h.navigate).toHaveBeenCalledWith('/interviews/sess-1', {
      state: { bridgeText: '📌 압박 면접 대비\n1분 자기소개' },
    })
  })

  /**
   * 🔴 **적자마자 누르는 사람이 주인공이다.** 저장은 1.5s debounce 라 서버 값만 보면
   * 방금 친 줄이 빠진 **직전 상태**를 넘기게 된다 — 그러고도 화면은 성공처럼 보인다.
   */
  it('🔴 저장 전 편집분이 실린다 (서버 값이 아니라 화면의 값)', () => {
    setApp([step(0, '1차 면접', { notes: DOC(['예전 질문']) })])
    draw()
    fireEvent.click(screen.getByText('편집흉내'))
    fireEvent.click(bridgeBtn()!)
    expect(h.navigate).toHaveBeenCalledWith('/interviews/sess-1', {
      state: { bridgeText: '방금 친 질문' },
    })
  })

  it('세션이 여러 개면 고르게 한다 (아직 안 옮긴다)', () => {
    h.sessions = [
      { id: 'sess-1', round: '1차 실무 면접' },
      { id: 'sess-2', round: '2차 임원 면접' },
    ]
    setApp([step(0, '1차 면접', { notes: DOC(['1분 자기소개']) })])
    draw()
    fireEvent.click(bridgeBtn()!)
    expect(screen.getByText('2차 임원 면접')).toBeTruthy()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('세션이 0개면 만들기 흐름으로 이어진다 (막다른 길이 없다)', () => {
    h.sessions = []
    setApp([step(0, '1차 면접', { notes: DOC(['1분 자기소개']) })])
    draw()
    fireEvent.click(bridgeBtn()!)
    expect(screen.getByText('새 면접 준비 만들기 모달')).toBeTruthy()
  })
})
