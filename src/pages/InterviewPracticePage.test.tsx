/**
 * 「면접 보기」 페이지 — **설정 → 루프 → 요약** 세 상태를 한 주소에서 돈다.
 *
 * 🔴 **요약의 「다시 볼 것만 한 번 더」는 서버를 다시 묻지 않는다.** 방금 찍은 결과로
 * 곧장 돌린다 — 재조회로 풀면 (a) 채점 저장이 실패한 문항이 빠지고 (b) 그 사이 바뀐
 * 목록이 끌려 오며 (c) 순서가 이번 시험과 달라진다. 셋 다 "방금 내가 다시 볼 것"이라는
 * 약속을 깬다.
 *
 * 🔴 **연습 중 세션이 사라지면 나갈 문이 없다.** 남은 문항이 전부 유령인데 화면은 계속
 * 질문을 넘긴다. 다른 기기·탭에서 지운 경우가 실제 경로다.
 *
 * 시나리오:
 *  A. 상태 전환
 *   A1. 설정에서 시작하면 첫 문항이 뜨고 **페이지 머리말이 걷힌다** (집중 화면)
 *   A2. 루프의 X 는 설정 화면으로 되돌린다
 *   A3. 마지막 문항까지 채점하면 요약 — 잘함·애매·다시 카운트
 *   A4. 건너뛴 게 있으면 보조 줄로 알린다
 *  B. 다시 볼 것만 한 번 더
 *   B1. 🔴 「다시」로 찍은 문항만, 이번 시험 순서 그대로 다시 돈다
 *   B2. 「다시」가 0 이면 그 CTA 자체가 없다
 *   B3. 「설정 다시 하기」는 설정 화면으로 돌아간다
 *  C. 세션이 사라진 경우
 *   C1. 🔴 연습 중 세션 조회가 실패하면 토스트 + 목록으로 퇴장한다
 *   C2. 시작 전 실패는 에러 화면(다시 시도)이지 자동 퇴장이 아니다
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewPracticePage } from './InterviewPracticePage'
import { useToastStore } from '@/stores/toastStore'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )),
  useNavigate: () => navigateMock,
}))

const sessionQuery = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}))
const questionsQuery = vi.hoisted(() => ({
  data: [] as unknown[],
  isLoading: false,
  isError: false,
}))
const recordMutate = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () => sessionQuery,
  useInterviewPrepQuestions: () => questionsQuery,
  useRecordPractice: () => ({ mutate: recordMutate }),
}))

const q = (
  over: Partial<InterviewPrepQuestion> & { id: string },
): InterviewPrepQuestion => ({
  sessionId: 's-1',
  parentQuestionId: null,
  depth: 0,
  orderIndex: 0,
  category: null,
  mustPrepare: false,
  followupBasis: null,
  questionText: `질문 ${over.id}`,
  suggestedAnswer: null,
  materialGap: null,
  sourceLogIds: [],
  myMemo: null,
  source: 'ai',
  lastPracticedAt: null,
  lastPracticeResult: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  children: [],
  ...over,
})

/** `차례`(기본값) 순서 = orderIndex 오름차순 → q1 → q2 → q3 */
const QUESTIONS = [
  q({ id: 'q1', orderIndex: 0 }),
  q({ id: 'q2', orderIndex: 1 }),
  q({ id: 'q3', orderIndex: 2 }),
]

const SESSION = {
  id: 's-1',
  applicationId: 'app-1',
  round: '1차 실무 면접',
  interviewType: 'job_fit',
  coverletterIds: [],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
  generationStatus: 'completed',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

/**
 * 🔴 **매번 새 element 를 만든다.** 같은 element 객체를 다시 넘기면 React 가 참조 비교로
 * **렌더를 통째로 건너뛴다** — 훅 목을 바꿔 놓고 rerender 해도 아무 일이 안 일어난다.
 */
const ui = () => (
  <MemoryRouter initialEntries={['/interviews/s-1/practice']}>
    <InterviewPracticePage />
  </MemoryRouter>
)
const draw = () => {
  const { rerender } = render(ui())
  return { rerender: () => rerender(ui()) }
}

const start = () =>
  fireEvent.click(screen.getByRole('button', { name: /개로 시작하기/ }))
const reveal = () =>
  fireEvent.click(screen.getByRole('button', { name: '내 답변 보기' }))
const grade = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  navigateMock.mockReset()
  recordMutate.mockReset()
  useToastStore.setState({ toasts: [] })
  Object.assign(sessionQuery, {
    data: SESSION,
    isLoading: false,
    isError: false,
  })
  Object.assign(questionsQuery, {
    data: QUESTIONS,
    isLoading: false,
    isError: false,
  })
})

describe('A. 상태 전환', () => {
  it('A1. 시작하면 첫 문항이 뜨고 페이지 머리말이 걷힌다', () => {
    draw()
    expect(screen.getByRole('heading', { name: '면접 보기' })).toBeInTheDocument()
    start()
    expect(screen.getByRole('heading', { name: '질문 q1' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '면접 보기' })).toBeNull()
  })

  it('A2. X 는 설정 화면으로 되돌린다', () => {
    draw()
    start()
    fireEvent.click(screen.getByRole('button', { name: '연습 종료' }))
    expect(screen.getByRole('button', { name: /개로 시작하기/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '면접 보기' })).toBeInTheDocument()
  })

  it('A3. 끝까지 채점하면 요약이 뜬다', () => {
    draw()
    start()
    reveal()
    grade('잘함')
    reveal()
    grade('애매')
    reveal()
    grade('다시')

    expect(screen.getByRole('heading', { name: '연습 끝!' })).toBeInTheDocument()
    const good = screen.getByText('잘함').previousElementSibling
    const soso = screen.getByText('애매').previousElementSibling
    const again = screen.getByText('다시').previousElementSibling
    expect(good).toHaveTextContent('1')
    expect(soso).toHaveTextContent('1')
    expect(again).toHaveTextContent('1')
  })

  it('A4. 건너뛴 문항이 있으면 보조 줄로 알린다', () => {
    draw()
    start()
    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
    expect(screen.getByText(/건너뛴 문항/)).toHaveTextContent('3')
  })
})

describe('B. 다시 볼 것만 한 번 더', () => {
  it('🔴 B1. 「다시」로 찍은 문항만 다시 돈다 (이번 시험 순서 그대로)', () => {
    draw()
    start()
    reveal()
    grade('다시') // q1
    reveal()
    grade('잘함') // q2
    reveal()
    grade('다시') // q3

    fireEvent.click(
      screen.getByRole('button', { name: '다시 볼 것만 한 번 더 (2개)' }),
    )
    /* 첫 문항은 q1 — 「다시」를 찍은 순서(=시험 순서)가 그대로 유지된다 */
    expect(screen.getByRole('heading', { name: '질문 q1' })).toBeInTheDocument()

    /* 총 2문항짜리 시험이 새로 시작된 것 — 마지막이 q3 다 */
    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
    expect(screen.getByRole('heading', { name: '질문 q3' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
    expect(screen.getByRole('heading', { name: '연습 끝!' })).toBeInTheDocument()
    expect(screen.getByText(/총/)).toHaveTextContent('2')
  })

  it('B2. 「다시」가 0 이면 그 CTA 가 없다', () => {
    draw()
    start()
    for (let i = 0; i < 3; i++) {
      reveal()
      grade('잘함')
    }
    expect(screen.queryByRole('button', { name: /다시 볼 것만/ })).toBeNull()
    expect(screen.getByRole('button', { name: '설정 다시 하기' })).toBeInTheDocument()
  })

  it('B3. 「설정 다시 하기」는 설정 화면으로 돌아간다', () => {
    draw()
    start()
    for (let i = 0; i < 3; i++) {
      reveal()
      grade('잘함')
    }
    fireEvent.click(screen.getByRole('button', { name: '설정 다시 하기' }))
    expect(screen.getByRole('button', { name: /개로 시작하기/ })).toBeInTheDocument()
  })
})

describe('C. 세션이 사라진 경우', () => {
  it('🔴 C1. 연습 중 세션 조회가 실패하면 토스트 + 목록으로 퇴장한다', () => {
    const { rerender } = draw()
    start()
    expect(screen.getByRole('heading', { name: '질문 q1' })).toBeInTheDocument()

    Object.assign(sessionQuery, { data: undefined, isError: true })
    rerender()

    expect(navigateMock).toHaveBeenCalledWith('/interviews', { replace: true })
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      '세션이 삭제됐어요.',
    )
  })

  it('C2. 시작 전 실패는 에러 화면이지 자동 퇴장이 아니다', () => {
    Object.assign(sessionQuery, { data: undefined, isError: true })
    draw()
    expect(screen.getByText('면접 보기를 시작할 수 없어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
