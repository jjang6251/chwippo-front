/**
 * 「면접 보기」 연습 루프.
 *
 * 🔴 **이 컴포넌트의 계약은 "답을 늦게 보여주는 것"이다.** 질문을 크게 띄우는 건 누구나
 * 하지만, 답이 화면 어딘가에 이미 들어 있으면 그건 연습이 아니라 **읽기**다. 그래서
 * `display:none` 이 아니라 **DOM 미렌더**를 단언한다 — 숨기기는 나중에 스타일 한 줄로
 * 조용히 풀린다.
 *
 * 🔴 **두 번째 계약은 "채점이 연습을 막지 않는 것"이다.** 저장은 best-effort 라
 * 실패(질문 삭제 404·네트워크)해도 루프는 다음 문항으로 간다. 여기서 잃는 건
 * 「다시 볼 것만」 한 칸이고, 막으면 면접 직전 사람이 화면 앞에서 멈춘다.
 *
 * 시나리오:
 *  A. 답변 공개 게이트
 *   A1. 🔴 reveal 전에는 내 답변·AI 예시가 **DOM 에 없다** (숨김이 아니라 미렌더)
 *   A2. reveal 후에는 **있는 것만** 나온다 (메모만 있는 문항 / 둘 다 있는 문항)
 *   A3. 둘 다 없으면 빈 문구 — 지금 할 일이 아니라 **언제 채우는지**를 말한다
 *   A4. 🔴 접으면 **다시 DOM 에서 빠진다** (열 때와 같은 계약 — display 토글이 아니다)
 *  B. 채점
 *   B1. 잘함 → POST(questionId·result) 가 나가고 다음 문항으로 간다
 *   B2. 🔴 POST 가 실패해도 다음 문항으로 간다 (질문이 지워졌어도 연습은 계속)
 *   B3. 건너뛰기는 POST 를 부르지 않는다 (채점 안 한 것과 「잘함」은 다르다)
 *   B4. 마지막 문항을 넘기면 집계가 정확히 나온다 (good·soso·again·skipped·againIds)
 *   B5. 🔴 **답을 펴지 않아도 채점할 수 있다** — 소리 내어 답한 뒤 스스로 아는 사람에게
 *       "일단 정답을 펴라" 를 강요하면 연습이 읽기가 된다 (예전 계약의 반전)
 *  C. 타이머 — 카운트다운
 *   C1. 1초마다 줄어든다
 *   C2. 🔴 reveal 하면 멈춘다 — 답을 읽는 시간은 답할 시간이 아니다
 *   C3. 🔴 0 이 돼도 넘어가지 않는다 (표시만) — 만료가 탈락이 아니다
 *   C4. 다음 문항에서 다시 채워진다
 *   C5. mode `off` 면 타이머가 아예 없다
 *   C6. 🔴 남은 5초부터 danger — 만료 후에도 같은 danger 다 (한 사건의 앞뒤)
 *   C7. 🔴 **접어도 재개하지 않는다** — 한 번 멈춘 시계는 그 문항에서 끝이다
 *  G. 타이머 — 스톱워치
 *   G1. 0 부터 올라간다
 *   G2. 만료가 없다 (오래 둬도 「시간이 됐어요」가 안 뜬다)
 *   G3. 🔴 reveal 순간 멈춘다 — 그 숫자가 곧 「답변에 쓴 시간」이다
 *   G4. 🔴 접어도 재개하지 않는다
 *   G5. 다음 문항에서 0 으로 리셋된다
 *   G6. 색이 변하지 않는다 (제한이 없으므로 위험도 없다)
 *  D. 키보드 (데스크탑)
 *   D1. Space = 답변 여닫기 (양방향 토글)
 *   D2. 🔴 1·2·3 은 **reveal 전에도 먹는다** (채점 버튼이 상시 노출이므로 단축키도 같다)
 *   D3. → 는 언제든 건너뛴다
 *  E. 스크린리더
 *   E1. 문항이 바뀌면 질문 heading 으로 포커스가 옮겨간다
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticeSession } from './PracticeSession'
import type { PracticeTally } from './PracticeSession'
import type { ExamTimer } from '@/utils/practiceExam'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

const api = vi.hoisted(() => ({ recordPractice: vi.fn() }))
/* 훅이 아니라 **API 를 막는다** — 캐시 패치까지 진짜 훅이 돌아야 body 를 실제로 단언할 수 있다 */
vi.mock('@/api/interviewPrep', () => ({ interviewPrepApi: api }))

const q = (
  over: Partial<InterviewPrepQuestion> & { id: string },
): InterviewPrepQuestion => ({
  sessionId: 's-1',
  parentQuestionId: null,
  depth: 0,
  orderIndex: 0,
  category: 'self_intro',
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

/** 1번=메모만 · 2번=둘 다 · 3번=아무것도 없음 */
const QUESTIONS = [
  q({ id: 'q1', myMemo: '내가 적어둔 답' }),
  q({ id: 'q2', myMemo: '두번째 메모', suggestedAnswer: 'AI 가 만든 예시' }),
  q({ id: 'q3' }),
]

const OFF: ExamTimer = { mode: 'off', sec: 0 }
const countdown = (sec: number): ExamTimer => ({ mode: 'countdown', sec })
const STOPWATCH: ExamTimer = { mode: 'stopwatch', sec: 0 }

function draw(
  questions = QUESTIONS,
  timer: ExamTimer = OFF,
  handlers: { onFinish?: (t: PracticeTally) => void; onExit?: () => void } = {},
) {
  const onFinish = handlers.onFinish ?? vi.fn()
  const onExit = handlers.onExit ?? vi.fn()
  const { container } = render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <PracticeSession
        questions={questions}
        timer={timer}
        onFinish={onFinish}
        onExit={onExit}
      />
    </QueryClientProvider>,
  )
  return { onFinish, onExit, container }
}

const reveal = () =>
  fireEvent.click(screen.getByRole('button', { name: '내 답변 보기' }))
const collapse = () =>
  fireEvent.click(screen.getByRole('button', { name: '답변 접기' }))
const gradeBtn = (name: string) => screen.getByRole('button', { name })
const skip = () => fireEvent.click(screen.getByRole('button', { name: /건너뛰기/ }))
/** mutation 은 마이크로태스크로 미뤄진다 — POST 를 단언하려면 한 번 흘려보내야 한다 */
const flush = () => act(async () => undefined)

beforeEach(() => {
  api.recordPractice.mockReset()
  api.recordPractice.mockResolvedValue(undefined)
})

describe('A. 답변 공개 게이트', () => {
  it('🔴 A1. reveal 전에는 답이 DOM 에 없다 (숨김이 아니라 미렌더)', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PracticeSession
          questions={QUESTIONS}
          timer={OFF}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByText('질문 q1')).toBeInTheDocument()
    expect(screen.queryByText('내가 적어둔 답')).toBeNull()
    /* 숨겨둔 채 있는 게 아닌지 — 문자열 자체가 마크업에 없어야 한다 */
    expect(container.innerHTML).not.toContain('내가 적어둔 답')
  })

  it('A2. reveal 하면 **있는 것만** 나온다 — 메모만 있는 문항', () => {
    draw()
    reveal()
    expect(screen.getByText('내가 적어둔 답')).toBeInTheDocument()
    expect(screen.getByText('내 답변')).toBeInTheDocument()
    expect(screen.queryByText('AI 예시 답변')).toBeNull()
  })

  it('A2. 둘 다 있으면 둘 다 나온다', () => {
    draw()
    skip() // 2번 문항으로
    reveal()
    expect(screen.getByText('두번째 메모')).toBeInTheDocument()
    expect(screen.getByText('AI 가 만든 예시')).toBeInTheDocument()
  })

  it('A3. 둘 다 없으면 언제 채우면 되는지 말한다', () => {
    draw([q({ id: 'only' })])
    reveal()
    expect(
      screen.getByText('적어둔 답변이 없어요 — 연습을 마치고 세션에서 채워보세요'),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 **접기는 A1 과 같은 계약이다.** `hidden` 이나 `display:none` 으로 바꾸면
   * 스크린리더·Ctrl+F·개발자도구가 다시 답을 읽고, 무엇보다 스타일 한 줄로 조용히 풀린다.
   */
  it('🔴 A4. 접으면 답이 다시 DOM 에서 빠진다', () => {
    const { container } = draw()
    reveal()
    expect(screen.getByText('내가 적어둔 답')).toBeInTheDocument()

    collapse()
    expect(screen.queryByText('내가 적어둔 답')).toBeNull()
    expect(container.innerHTML).not.toContain('내가 적어둔 답')
    // 다시 열 수 있다 — 되돌릴 수 없는 문이 아니다
    expect(screen.getByRole('button', { name: '내 답변 보기' })).toBeInTheDocument()
    reveal()
    expect(screen.getByText('내가 적어둔 답')).toBeInTheDocument()
  })
})

describe('B. 채점', () => {
  it('B1. 잘함 → POST 가 나가고 다음 문항으로 간다', async () => {
    const { container } = draw()
    reveal()
    fireEvent.click(gradeBtn('잘함'))
    await flush()
    expect(api.recordPractice).toHaveBeenCalledWith('q1', { result: 'good' })
    expect(screen.getByText('질문 q2')).toBeInTheDocument()
    /* 다음 문항은 다시 닫힌 상태다 — 열린 채 넘어가면 답이 먼저 보인다 */
    expect(screen.getByRole('button', { name: '내 답변 보기' })).toBeInTheDocument()
    // 진행 표시가 따라 올라간다 (숫자가 span 으로 쪼개져 있어 통째로 본다)
    expect(container.textContent).toContain('2 / 3')
  })

  it('🔴 B2. POST 가 실패해도(404·네트워크) 다음 문항으로 간다', async () => {
    api.recordPractice.mockRejectedValue(
      Object.assign(new Error('404'), { response: { status: 404 } }),
    )
    draw()
    reveal()
    await act(async () => {
      fireEvent.click(gradeBtn('다시'))
    })
    expect(screen.getByText('질문 q2')).toBeInTheDocument()
  })

  it('B3. 건너뛰기는 POST 를 부르지 않는다', () => {
    draw()
    skip()
    expect(api.recordPractice).not.toHaveBeenCalled()
    expect(screen.getByText('질문 q2')).toBeInTheDocument()
  })

  it('B4. 마지막 문항을 넘기면 집계가 정확하다', () => {
    const { onFinish } = draw()
    reveal()
    fireEvent.click(gradeBtn('잘함')) // q1 = good
    skip() // q2 = skipped
    reveal()
    fireEvent.click(gradeBtn('다시')) // q3 = again → 마지막

    expect(onFinish).toHaveBeenCalledWith({
      good: 1,
      soso: 0,
      again: 1,
      skipped: 1,
      againIds: ['q3'],
    })
  })

  it('B4. 「애매」도 집계에 잡힌다', async () => {
    const { onFinish } = draw([q({ id: 'one' })])
    reveal()
    fireEvent.click(gradeBtn('애매'))
    await flush()
    expect(api.recordPractice).toHaveBeenCalledWith('one', { result: 'soso' })
    expect(onFinish).toHaveBeenCalledWith({
      good: 0,
      soso: 1,
      again: 0,
      skipped: 0,
      againIds: [],
    })
  })

  /**
   * 🔴 **의도가 뒤집힌 단언이다.** 예전 계약은 "안 본 답을 채점할 수는 없다" 였다.
   * 그런데 실제 연습은 **소리 내어 답한 뒤 스스로 아는** 것이라, 채점하려고 정답을 펴는
   * 순간 다음 문항부터는 「답을 읽고 나서 채점」이 습관이 된다 — 연습이 읽기가 된다.
   * 이제 3버튼은 상시 노출이고, `[내 답변 보기]` 는 그 위의 선택지일 뿐이다.
   */
  it('🔴 B5. 답을 펴지 않아도 채점 버튼이 있고, 눌리면 POST 가 나간다', async () => {
    const { onFinish } = draw([q({ id: 'solo', myMemo: '펼치지 않은 답' })])
    // 답은 아직 DOM 에 없는데 채점은 열려 있다
    expect(screen.queryByText('펼치지 않은 답')).toBeNull()
    expect(screen.getByRole('button', { name: '내 답변 보기' })).toBeInTheDocument()

    fireEvent.click(gradeBtn('다시'))
    await flush()

    expect(api.recordPractice).toHaveBeenCalledWith('solo', { result: 'again' })
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ again: 1, againIds: ['solo'] }),
    )
  })
})

describe('C. 타이머 — 카운트다운', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** 라벨에 값이 같이 들어 있다 (`남은 시간 0:30`) — 정규식으로 잡는다 */
  const timer = () => screen.getByLabelText(/남은 시간/)

  const tick = (sec: number) =>
    act(() => {
      vi.advanceTimersByTime(sec * 1000)
    })

  it('C1. 1초마다 줄어든다', () => {
    draw(QUESTIONS, countdown(30))
    expect(timer()).toHaveTextContent('0:30')
    tick(3)
    expect(timer()).toHaveTextContent('0:27')
  })

  it('🔴 C2. reveal 하면 멈춘다', () => {
    draw(QUESTIONS, countdown(30))
    tick(5)
    reveal()
    tick(10)
    expect(timer()).toHaveTextContent('0:25')
  })

  it('🔴 C3. 0 이 돼도 문항이 그대로다 — 표시만 바뀐다', () => {
    draw(QUESTIONS, countdown(30))
    tick(40)
    expect(screen.getByText('질문 q1')).toBeInTheDocument()
    expect(screen.getByText('시간이 됐어요')).toBeInTheDocument()
    expect(timer()).toHaveTextContent('0:00')
  })

  it('C4. 다음 문항에서 다시 채워진다', () => {
    draw(QUESTIONS, countdown(60))
    tick(40)
    skip()
    expect(timer()).toHaveTextContent('1:00')
    expect(screen.queryByText('시간이 됐어요')).toBeNull()
  })

  it('C5. 끔이면 타이머가 없다', () => {
    draw(QUESTIONS, OFF)
    expect(screen.queryByLabelText(/남은 시간/)).toBeNull()
    tick(200)
    expect(screen.queryByText('시간이 됐어요')).toBeNull()
  })

  /**
   * 🔴 5초 전과 만료를 **같은 danger** 로 칠한다. 둘은 다른 사건이 아니라 한 사건의
   * 앞뒤인데, 예전엔 만료만 warning 이라 "노랑이 되는 단계" 로 읽혔다.
   */
  it('🔴 C6. 남은 5초부터 danger, 만료 후에도 danger 다', () => {
    draw(QUESTIONS, countdown(30))
    expect(timer().className).toContain('text-text-tertiary')
    expect(timer().className).not.toContain('text-danger')

    tick(24) // 남은 6초 — 아직 아니다
    expect(timer()).toHaveTextContent('0:06')
    expect(timer().className).not.toContain('text-danger')

    tick(1) // 남은 5초
    expect(timer().className).toContain('text-danger')

    tick(10) // 만료 — 색이 갈리지 않는다
    expect(timer()).toHaveTextContent('0:00')
    expect(timer().className).toContain('text-danger')
    expect(timer().className).not.toContain('text-warning')
  })

  /** 🔴 접기가 시계를 되살리면 "답변에 쓴 시간" 이 답을 읽은 뒤에도 계속 불어난다 */
  it('🔴 C7. 접어도 재개하지 않는다', () => {
    draw(QUESTIONS, countdown(60))
    tick(10)
    reveal()
    tick(5)
    collapse()
    tick(20)
    expect(timer()).toHaveTextContent('0:50')
  })
})

describe('G. 타이머 — 스톱워치', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const timer = () => screen.getByLabelText(/경과 시간/)
  const tick = (sec: number) =>
    act(() => {
      vi.advanceTimersByTime(sec * 1000)
    })

  it('G1. 0 부터 올라간다', () => {
    draw(QUESTIONS, STOPWATCH)
    expect(timer()).toHaveTextContent('0:00')
    tick(7)
    expect(timer()).toHaveTextContent('0:07')
    tick(60)
    expect(timer()).toHaveTextContent('1:07')
  })

  it('G2. 만료가 없다 (오래 둬도 「시간이 됐어요」가 안 뜬다)', () => {
    draw(QUESTIONS, STOPWATCH)
    tick(600)
    expect(screen.queryByText('시간이 됐어요')).toBeNull()
    expect(timer()).toHaveTextContent('10:00')
    // 「남은 시간」이 아니다 — 두 모드가 같은 라벨을 쓰면 무엇을 재는지 알 수 없다
    expect(screen.queryByLabelText(/남은 시간/)).toBeNull()
  })

  it('🔴 G3. reveal 순간 멈춘다 — 그 숫자가 「답변에 쓴 시간」이다', () => {
    draw(QUESTIONS, STOPWATCH)
    tick(12)
    reveal()
    tick(30)
    expect(timer()).toHaveTextContent('0:12')
  })

  it('🔴 G4. 접어도 재개하지 않는다', () => {
    draw(QUESTIONS, STOPWATCH)
    tick(12)
    reveal()
    collapse()
    tick(30)
    expect(timer()).toHaveTextContent('0:12')
  })

  it('G5. 다음 문항에서 0 으로 리셋된다', () => {
    draw(QUESTIONS, STOPWATCH)
    tick(25)
    reveal()
    skip()
    expect(timer()).toHaveTextContent('0:00')
    // 얼음도 함께 풀린다 — 새 문항에서 다시 흘러야 한다
    tick(3)
    expect(timer()).toHaveTextContent('0:03')
  })

  it('G6. 색이 변하지 않는다 (제한이 없으므로 위험도 없다)', () => {
    draw(QUESTIONS, STOPWATCH)
    tick(300)
    expect(timer().className).toContain('text-text-tertiary')
    expect(timer().className).not.toContain('text-danger')
  })
})

describe('D. 키보드', () => {
  const key = (k: string) => fireEvent.keyDown(window, { key: k })

  it('D1. Space 로 답변을 여닫는다 (양방향 토글)', () => {
    draw()
    key(' ')
    expect(screen.getByText('내가 적어둔 답')).toBeInTheDocument()
    key(' ')
    expect(screen.queryByText('내가 적어둔 답')).toBeNull()
  })

  /**
   * 🔴 **의도가 뒤집혔다.** 예전엔 "안 본 답을 채점할 수는 없다" 였는데, 채점 3버튼이
   * 상시 노출로 바뀌었다 — 화면에서 되는 일이 키보드에서 막히면 그게 버그다.
   */
  it('🔴 D2. 1·2·3 은 reveal 전에도 먹는다', async () => {
    draw()
    key('1')
    await flush()
    expect(api.recordPractice).toHaveBeenCalledWith('q1', { result: 'good' })
    expect(screen.getByText('질문 q2')).toBeInTheDocument()
  })

  it('D2. reveal 후 1·2·3 이 잘함·애매·다시로 채점한다', async () => {
    const { onFinish } = draw()
    key(' ')
    key('1') // q1 good
    key(' ')
    key('2') // q2 soso
    key(' ')
    key('3') // q3 again
    await flush()
    expect(api.recordPractice).toHaveBeenNthCalledWith(2, 'q2', {
      result: 'soso',
    })
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ good: 1, soso: 1, again: 1, againIds: ['q3'] }),
    )
  })

  it('D3. → 는 언제든 건너뛴다 (열기 전·후 모두)', () => {
    draw()
    key('ArrowRight')
    expect(screen.getByText('질문 q2')).toBeInTheDocument()
    key(' ')
    key('ArrowRight')
    expect(screen.getByText('질문 q3')).toBeInTheDocument()
    expect(api.recordPractice).not.toHaveBeenCalled()
  })

  /** 이 화면엔 아직 입력칸이 없다 — 하나라도 생기는 날 `1` 이 문항을 넘기면 쓰던 글이 날아간다 */
  it('입력 요소 안에서는 단축키가 무시된다', () => {
    draw()
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: ' ' })
    expect(screen.queryByText('내가 적어둔 답')).toBeNull()
    input.remove()
  })
})

describe('E. 스크린리더', () => {
  it('E1. 문항이 바뀌면 질문 heading 으로 포커스가 간다', () => {
    draw()
    skip()
    const heading = screen.getByRole('heading', { name: '질문 q2' })
    expect(document.activeElement).toBe(heading)
    expect(heading).toHaveAttribute('tabindex', '-1')
  })
})

describe('F. 종료', () => {
  it('X 를 누르면 onExit — 확인창 없이 (채점은 이미 저장됐다)', () => {
    const { onExit, onFinish } = draw()
    fireEvent.click(screen.getByRole('button', { name: '연습 종료' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
