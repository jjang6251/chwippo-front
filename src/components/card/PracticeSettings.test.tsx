/**
 * 「면접 보기」 시험 설정 화면.
 *
 * 🔴 이 컴포넌트의 계약은 "고를 수 있다" 가 아니라 **[시작] 을 누르기 전에 결과를 아는 것**이다.
 * 조건이 AND 로 겹쳐 걸려 0개가 되기 쉬운데, 그걸 시작한 뒤 알게 되면 설정을 처음부터
 * 다시 짚어야 한다.
 *
 * 시나리오:
 *  A. 기본값
 *   A1. 둘 다 · 전체 · 전체(카테고리) · 차례 · 전체 · 끔 이 눌려 있다
 *   A2. 히어로가 전체 개수를 그대로 말한다 (필터 기본값 = 안 거른다)
 *   A3. 타이머 보조 문구는 항상 보인다 (만료가 곧 탈락이 아니라는 약속)
 *  B. 실시간 산출
 *   B1. ⭐ 우선만 → N 이 즉시 줄고 CTA 숫자도 따라간다
 *   B2. 내 질문만 → source 필터가 N 에 반영된다
 *  C. 0개
 *   C1. 🔴 조건에 맞는 게 없으면 시작이 disabled 이고 이유를 말한다
 *  D. 실전 흐름 안내 (미분류)
 *   D1. 일부만 미분류 → "N개는 중간에 무작위로 섞여요"
 *   D2. 🔴 전부 미분류 → "사실상 무작위 순서예요"
 *   D3. 차례·올랜덤에는 그 안내가 없다 (실전 흐름 전용)
 *  E. 상한
 *   E1. 후보가 상한보다 적으면 "M개로 시작해요" + CTA 도 M 개
 *  F. 시작
 *   F1. 고른 설정이 그대로 `onStart` 로 넘어간다
 *  G. 문항 수 직접 입력
 *   G1. 「직접 입력」을 누르면 숫자칸이 열리고 **지금 산출값이 채워져 있다**
 *   G2. 적은 수가 CTA 에 반영된다
 *   G3. 🔴 M 초과 → 값은 M 으로 잘리고 "M개까지예요" 가 이유를 말한다
 *       (입력칸의 글자는 **안 덮어쓴다** — 덮어쓰면 M=4 일 때 「10」을 못 친다)
 *   G4. 🔴 비우면 시작이 막힌다 (0 이 아니라 「아직 안 적음」이다)
 *   G5. 프리셋으로 돌아가면 숫자칸이 닫힌다
 *   G6. 숫자가 아닌 입력은 들어가지 않는다
 *  H. 타이머 직접 입력 · 스톱워치
 *   H1. 「직접 입력」 → 숫자칸 + 초 단위로 `onStart` 에 실린다
 *   H2. 🔴 5~600 밖이면 잘리고 안내가 붙는다
 *   H3. 🔴 비우면 시작이 막힌다
 *   H4. 스톱워치 → `{ mode:'stopwatch', sec:0 }` + 전용 보조 문구
 *   H5. 🔴 스톱워치는 sec 이 무엇이든 시작할 수 있다 (직접 입력을 비운 뒤 골라도 열린다)
 *   H6. 프리셋(60초) → `{ mode:'countdown', sec:60 }`
 *  I. 히어로 요약 (2026-08-11 재구성)
 *   I1. 🔴 큰 숫자·보조줄이 **설정을 만질 때마다 즉시** 따라온다 — 이 화면의 목적이
 *       "몇 문항을 연습하게 되는가" 라, 그 답이 스크롤 아래 있으면 화면이 목적을 잃는다
 *   I2. 🔴 0개면 숫자가 danger 로 물든다 (시작 못 하는 걸 CTA 까지 가서 알면 늦다)
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PracticeSettings } from './PracticeSettings'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

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

/** 4개 — ⭐ 1개 · 내 질문 1개 · 미분류 1개 */
const QUESTIONS = [
  q({ id: 'a', mustPrepare: true }),
  q({ id: 'b', source: 'user', category: 'failure' }),
  q({ id: 'c', category: 'closing_remark' }),
  q({ id: 'd', category: null }),
]

const draw = (questions = QUESTIONS, onStart = vi.fn()) => {
  render(<PracticeSettings questions={questions} onStart={onStart} />)
  return onStart
}

/** 행별로 좁혀 찾는다 — 「전체」는 범위·카테고리·문항 수 세 곳에 있다 */
const pill = (row: string, name: string) =>
  within(screen.getByRole('group', { name: row })).getByRole('button', { name })
const startButton = () =>
  screen.getByRole('button', { name: /개로 시작하기/ }) as HTMLButtonElement
/**
 * 히어로의 큰 숫자. 라벨에 값이 함께 담겨 있다 (`조건에 맞는 질문 12개`) — 숫자만 떼면
 * 무엇의 12 인지 알 수 없어서, 타이머와 같은 규칙으로 라벨에 넣었다.
 */
const summaryCount = () => screen.getByLabelText(/조건에 맞는 질문/)
/** 히어로 보조줄 — `전체 N개 중 · 차례 · 타이머 없음` */
const summaryLine = () => screen.getByText(/개 중/)

describe('A. 기본값', () => {
  it('A1. 둘 다 · 전체 · 차례 · 전체 · 끔 이 눌려 있다', () => {
    draw()
    expect(pill('출처', '둘 다')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('범위', '전체')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('순서', '차례')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('문항 수', '전체')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('타이머', '끔')).toHaveAttribute('aria-pressed', 'true')
    // 카테고리는 `null` 이 「미분류」가 아니라 **「전체」**로 보여야 한다
    expect(
      within(screen.getByRole('group', { name: '질문 유형' })).getByRole(
        'button',
        { name: '전체' },
      ),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('A2. 히어로가 전체 개수를 그대로 말한다', () => {
    draw()
    expect(summaryCount()).toHaveTextContent('4')
    expect(summaryLine()).toHaveTextContent('전체 4개 중')
    expect(startButton().textContent).toContain('4개로 시작하기')
    expect(startButton().disabled).toBe(false)
  })

  it('A3. 타이머 보조 문구 — 만료가 곧 넘김이 아니다', () => {
    draw()
    expect(
      screen.getByText('시간이 다 되면 표시만 해요 — 넘어가지 않아요.'),
    ).toBeInTheDocument()
  })
})

describe('B. 실시간 산출', () => {
  it('B1. ⭐ 우선만 을 고르면 N 이 즉시 준다', () => {
    draw()
    fireEvent.click(pill('범위', '⭐ 우선만'))
    expect(startButton().textContent).toContain('1개로 시작하기')
    expect(summaryCount()).toHaveTextContent('1')
    // 분모(전체)는 그대로다 — 무엇을 얼마나 걸렀는지 보여야 한다
    expect(summaryLine()).toHaveTextContent('전체 4개 중')
  })

  it('B2. 내 질문만 을 고르면 출처 필터가 반영된다', () => {
    draw()
    fireEvent.click(pill('출처', '내 질문만'))
    expect(startButton().textContent).toContain('1개로 시작하기')
  })
})

describe('C. 0개', () => {
  it('C1. 🔴 조건에 맞는 게 없으면 시작이 막히고 이유를 말한다', () => {
    draw()
    fireEvent.click(pill('범위', '다시 볼 것만')) // 연습 이력이 없는 픽스처
    expect(startButton().disabled).toBe(true)
    expect(startButton().textContent).toContain('0개로 시작하기')
    expect(
      screen.getByText('조건에 맞는 질문이 없어요 (전체 4개 중 0개)'),
    ).toBeInTheDocument()
  })
})

describe('D. 실전 흐름 안내 (미분류)', () => {
  const notice = () => screen.queryByText(/무작위/)

  it('D1. 일부만 미분류면 몇 개가 섞이는지 말한다', () => {
    draw()
    fireEvent.click(pill('순서', '실전 흐름'))
    expect(
      screen.getByText('카테고리 없는 질문 1개는 중간에 무작위로 섞여요.'),
    ).toBeInTheDocument()
  })

  it('D2. 🔴 전부 미분류면 사실상 무작위라고 알린다', () => {
    draw([q({ id: 'x', category: null }), q({ id: 'y', category: null })])
    fireEvent.click(pill('순서', '실전 흐름'))
    expect(
      screen.getByText('카테고리가 없어 사실상 무작위 순서예요.'),
    ).toBeInTheDocument()
  })

  it('D3. 차례·올랜덤에는 안내가 없다 (실전 흐름 전용)', () => {
    draw()
    expect(notice()).toBeNull()
    fireEvent.click(pill('순서', '올랜덤'))
    expect(notice()).toBeNull()
  })
})

describe('E. 상한', () => {
  it('E1. 후보가 상한보다 적으면 M개로 시작한다고 미리 말한다', () => {
    draw()
    fireEvent.click(pill('문항 수', '10개'))
    expect(screen.getByText('4개로 시작해요')).toBeInTheDocument()
    expect(startButton().textContent).toContain('4개로 시작하기')
  })
})

describe('F. 시작', () => {
  it('F1. 고른 설정이 그대로 넘어간다', () => {
    const onStart = draw()
    fireEvent.click(pill('출처', 'AI 질문만'))
    fireEvent.click(pill('순서', '실전 흐름'))
    fireEvent.click(pill('문항 수', '20개'))
    fireEvent.click(pill('타이머', '60초'))
    fireEvent.click(
      within(screen.getByRole('group', { name: '질문 유형' })).getByRole(
        'button',
        { name: '자기소개' },
      ),
    )
    fireEvent.click(startButton())

    expect(onStart).toHaveBeenCalledWith({
      source: 'ai',
      scope: 'all',
      category: 'self_intro',
      order: 'flow',
      count: 20,
      timer: { mode: 'countdown', sec: 60 },
    })
  })
})

/** 「직접 입력」 숫자칸 — 행이 두 개(문항 수·타이머)라 라벨로 갈라 잡는다 */
const countField = () =>
  screen.getByLabelText('문항 수 직접 입력') as HTMLInputElement
const timerField = () =>
  screen.getByLabelText('타이머 직접 입력') as HTMLInputElement
const type = (el: HTMLInputElement, v: string) =>
  fireEvent.change(el, { target: { value: v } })

describe('G. 문항 수 직접 입력', () => {
  /** 12개짜리 풀 — 프리셋(10·20)만으로는 못 고르는 수를 적을 수 있어야 한다 */
  const TWELVE = Array.from({ length: 12 }, (_, i) =>
    q({ id: `q${i}`, orderIndex: i }),
  )

  it('G1. 누르면 숫자칸이 열리고 지금 산출값이 채워져 있다', () => {
    draw(TWELVE)
    expect(screen.queryByLabelText('문항 수 직접 입력')).toBeNull()
    fireEvent.click(pill('문항 수', '직접 입력'))
    expect(countField().value).toBe('12')
    expect(pill('문항 수', '직접 입력')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('문항 수', '전체')).toHaveAttribute('aria-pressed', 'false')
  })

  it('G2. 적은 수가 CTA 에 반영된다', () => {
    const onStart = draw(TWELVE)
    fireEvent.click(pill('문항 수', '직접 입력'))
    type(countField(), '7')
    expect(startButton().textContent).toContain('7개로 시작하기')

    fireEvent.click(startButton())
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ count: 7 }))
  })

  /**
   * 🔴 **입력칸의 글자는 안 덮어쓴다.** 타건마다 M 으로 되쓰면 M=12 일 때 「20」을 치려고
   * `2` 를 누른 뒤 `0` 을 누르면 칸이 「120」이 되는 식으로 뒤엉킨다. 자르는 것은 값이다.
   */
  it('G3. 🔴 M 초과 → 값은 M 으로 잘리고 이유를 말한다 (글자는 그대로)', () => {
    const onStart = draw(TWELVE)
    fireEvent.click(pill('문항 수', '직접 입력'))
    type(countField(), '99')

    expect(countField().value).toBe('99')
    expect(screen.getByText('12개까지예요')).toBeInTheDocument()
    expect(startButton().textContent).toContain('12개로 시작하기')

    fireEvent.click(startButton())
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ count: 12 }))
  })

  it('G4. 🔴 비우면 시작이 막힌다', () => {
    draw(TWELVE)
    fireEvent.click(pill('문항 수', '직접 입력'))
    type(countField(), '')

    expect(startButton().disabled).toBe(true)
    expect(screen.getByText('문항 수를 적어주세요')).toBeInTheDocument()
    // 「조건에 맞는 질문이 없어요」와 다른 사건이다 — 후보는 12개 그대로 있다
    expect(screen.queryByText(/조건에 맞는 질문이 없어요/)).toBeNull()
  })

  it('G5. 프리셋으로 돌아가면 숫자칸이 닫힌다', () => {
    draw(TWELVE)
    fireEvent.click(pill('문항 수', '직접 입력'))
    type(countField(), '')
    fireEvent.click(pill('문항 수', '10개'))

    expect(screen.queryByLabelText('문항 수 직접 입력')).toBeNull()
    expect(startButton().disabled).toBe(false)
    expect(startButton().textContent).toContain('10개로 시작하기')
  })

  it('G6. 숫자가 아닌 글자는 들어가지 않는다', () => {
    draw(TWELVE)
    fireEvent.click(pill('문항 수', '직접 입력'))
    type(countField(), '3a-b')
    expect(countField().value).toBe('3')
  })
})

describe('H. 타이머 직접 입력 · 스톱워치', () => {
  const STOPWATCH_HINT = '질문이 나오면 시간이 흘러요 — 제한은 없어요'
  const COUNTDOWN_HINT = '시간이 다 되면 표시만 해요 — 넘어가지 않아요.'

  it('H1. 직접 입력한 초가 countdown 으로 실린다', () => {
    const onStart = draw()
    fireEvent.click(pill('타이머', '직접 입력'))
    type(timerField(), '45')
    fireEvent.click(startButton())

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ timer: { mode: 'countdown', sec: 45 } }),
    )
  })

  it('H2. 🔴 5~600 밖이면 잘리고 안내가 붙는다', () => {
    const onStart = draw()
    fireEvent.click(pill('타이머', '직접 입력'))
    type(timerField(), '900')
    expect(screen.getByText('5초 ~ 600초 사이로 정해요')).toBeInTheDocument()
    fireEvent.click(startButton())
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ timer: { mode: 'countdown', sec: 600 } }),
    )

    type(timerField(), '2')
    fireEvent.click(startButton())
    expect(onStart).toHaveBeenLastCalledWith(
      expect.objectContaining({ timer: { mode: 'countdown', sec: 5 } }),
    )
  })

  it('H3. 🔴 비우면 시작이 막힌다', () => {
    draw()
    fireEvent.click(pill('타이머', '직접 입력'))
    type(timerField(), '')
    expect(startButton().disabled).toBe(true)
    expect(screen.getByText('시간을 적어주세요')).toBeInTheDocument()
  })

  it('H4. 스톱워치 → mode stopwatch + 전용 보조 문구', () => {
    const onStart = draw()
    expect(screen.getByText(COUNTDOWN_HINT)).toBeInTheDocument()

    fireEvent.click(pill('타이머', '⏱ 스톱워치'))
    expect(screen.getByText(STOPWATCH_HINT)).toBeInTheDocument()
    expect(screen.queryByText(COUNTDOWN_HINT)).toBeNull()

    fireEvent.click(startButton())
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ timer: { mode: 'stopwatch', sec: 0 } }),
    )
  })

  /** 스톱워치엔 제한 시간이 없다 — 직접 입력 칸을 비워 둔 채 넘어와도 막히면 안 된다 */
  it('H5. 🔴 직접 입력을 비운 뒤 스톱워치를 고르면 시작이 다시 열린다', () => {
    draw()
    fireEvent.click(pill('타이머', '직접 입력'))
    type(timerField(), '')
    expect(startButton().disabled).toBe(true)

    fireEvent.click(pill('타이머', '⏱ 스톱워치'))
    expect(screen.queryByLabelText('타이머 직접 입력')).toBeNull()
    expect(startButton().disabled).toBe(false)
  })

  it('H6-hero. 타이머를 고르면 히어로 보조줄이 따라 말한다', () => {
    draw()
    expect(summaryLine()).toHaveTextContent('타이머 없음')
    fireEvent.click(pill('타이머', '90초'))
    expect(summaryLine()).toHaveTextContent('90초')
    fireEvent.click(pill('타이머', '⏱ 스톱워치'))
    expect(summaryLine()).toHaveTextContent('스톱워치')
  })

  it('H6. 프리셋 60초 → countdown 60', () => {
    const onStart = draw()
    fireEvent.click(pill('타이머', '60초'))
    expect(pill('타이머', '60초')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('타이머', '끔')).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(startButton())
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ timer: { mode: 'countdown', sec: 60 } }),
    )
  })
})

/**
 * 🔴 **이 화면의 목적이 화면 맨 위에 있어야 한다** (2026-08-11 재구성).
 *
 * 예전엔 여섯 행이 전부 같은 문법이라 위계가 없었고, 정작 "몇 문항을 연습하게 되는가" 는
 * 스크롤 아래 작은 회색 한 줄이었다. 옵션을 하나 만질 때마다 끝까지 내려가 확인해야
 * 했다는 뜻이다. 히어로가 죽으면 그 화면으로 되돌아간다 — 그래서 잠근다.
 */
describe('I. 히어로 요약', () => {
  it('🔴 I1. 설정을 만질 때마다 숫자·보조줄이 즉시 따라온다', () => {
    draw()
    expect(summaryCount()).toHaveTextContent('4')
    expect(summaryLine()).toHaveTextContent('전체 4개 중')
    expect(summaryLine()).toHaveTextContent('차례')

    // 필터를 좁히면 큰 숫자가 준다 (분모는 그대로 — 무엇을 얼마나 걸렀는지가 보여야 한다)
    fireEvent.click(pill('출처', '내 질문만'))
    expect(summaryCount()).toHaveTextContent('1')
    expect(summaryLine()).toHaveTextContent('전체 4개 중')

    // 상한도 같은 숫자에 모인다
    fireEvent.click(pill('출처', '둘 다'))
    fireEvent.click(pill('문항 수', '직접 입력'))
    fireEvent.change(screen.getByLabelText('문항 수 직접 입력'), {
      target: { value: '2' },
    })
    expect(summaryCount()).toHaveTextContent('2')

    // 순서 라벨도 실시간이다
    fireEvent.click(pill('순서', '실전 흐름'))
    expect(summaryLine()).toHaveTextContent('실전 흐름')
  })

  it('🔴 I2. 0개면 숫자가 danger 로 물들고 이유가 히어로에 붙는다', () => {
    draw()
    expect(summaryCount().className).not.toContain('text-danger')

    fireEvent.click(pill('범위', '다시 볼 것만')) // 연습 이력이 없는 픽스처
    expect(summaryCount()).toHaveTextContent('0')
    expect(summaryCount().className).toContain('text-danger')
    expect(
      screen.getByText('조건에 맞는 질문이 없어요 (전체 4개 중 0개)'),
    ).toBeInTheDocument()
    expect(startButton().disabled).toBe(true)
  })
})
