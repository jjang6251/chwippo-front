/**
 * A1 버그픽스 — 자동저장 타이머 vs 외부 답변 변경(AI 적용) 동기화.
 *
 * 회귀 배경: saveTimerRef 가 발화 후 null 복원되지 않아
 * (1) 한 번이라도 편집한 카드는 외부 cl.answer 변경 동기화가 영구 skip,
 * (2) 자동저장 effect 가 stale 로컬 답변을 재저장 → AI 적용 내용이 1.5s 내 롤백됨.
 *
 * 시나리오:
 * 1. 편집 없음 + 외부 cl.answer 변경 → textarea 동기화
 * 2. [핵심 회귀] 편집 → 자동저장 발화 → 외부 변경 → 동기화 + 옛 값 재저장 없음
 * 3. 편집 중(debounce 미발화) 외부 변경 → 사용자 입력 유지 (의도된 우선순위)
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverletterQuestionCard } from './CoverletterQuestionCard'
import type { ApplicationCoverletter } from '@/types/coverletter'

vi.mock('@/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }))
import { useCoverletterSourceRefs } from '@/hooks/useCoverletterSourceRefs'

vi.mock('@/hooks/useCoverletterSourceRefs', () => ({
  useCoverletterSourceRefs: vi.fn(() => ({ data: [] })),
}))
vi.mock('@/hooks/useAutoResize', () => ({
  useAutoResize: () => ({ ref: { current: null }, autoResize: vi.fn() }),
}))

const makeCl = (over: Partial<ApplicationCoverletter> = {}): ApplicationCoverletter =>
  ({
    id: 'cl-1',
    applicationId: 'app-1',
    question: '지원 동기를 작성하세요',
    category: '지원동기',
    answer: '기존 답변',
    charLimit: null,
    orderIndex: 0,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  }) as ApplicationCoverletter

const ANSWER_PLACEHOLDER = /여기에 답변을 작성하세요/

function renderReadOnly(
  cl: ApplicationCoverletter,
  readOnly = true,
  opts: { preview?: boolean } = {},
) {
  return render(
    <CoverletterQuestionCard
      cl={cl}
      number={1}
      applicationId="app-1"
      expanded
      onToggle={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onAskAI={vi.fn()}
      readOnly={readOnly}
      preview={opts.preview}
    />,
  )
}

function renderCard(cl: ApplicationCoverletter, onUpdate = vi.fn()) {
  const props = {
    cl,
    number: 1,
    applicationId: 'app-1',
    expanded: true,
    onToggle: vi.fn(),
    onUpdate,
    onDelete: vi.fn(),
    onAskAI: vi.fn(),
  }
  const utils = render(<CoverletterQuestionCard {...props} />)
  const rerenderWith = (next: ApplicationCoverletter) =>
    utils.rerender(<CoverletterQuestionCard {...props} cl={next} />)
  return { ...utils, onUpdate, rerenderWith }
}

describe('CoverletterQuestionCard — 자동저장/외부 동기화', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 편집 없이 외부 cl.answer 변경(AI 적용) → textarea 동기화', () => {
    const { rerenderWith } = renderCard(makeCl())
    rerenderWith(makeCl({ answer: 'AI 가 적용한 새 답변' }))
    expect(
      screen.getByPlaceholderText(ANSWER_PLACEHOLDER),
    ).toHaveValue('AI 가 적용한 새 답변')
  })

  it('2) [회귀] 편집→자동저장 발화 후 외부 변경 → 동기화되고 옛 값 재저장 없음', () => {
    const { onUpdate, rerenderWith } = renderCard(makeCl())
    const textarea = screen.getByPlaceholderText(ANSWER_PLACEHOLDER)

    // 사용자 편집 → 1.5s 경과 → 자동저장 발화
    fireEvent.change(textarea, { target: { value: '사용자 수정 답변' } })
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onUpdate).toHaveBeenCalledWith({ answer: '사용자 수정 답변' })
    onUpdate.mockClear()

    // 외부 적용 (chat 적용 → 서버 반영 → cl.answer 변경)
    rerenderWith(makeCl({ answer: 'AI 가 적용한 새 답변' }))
    expect(textarea).toHaveValue('AI 가 적용한 새 답변')

    // 버그 재현 조건: stale 타이머가 옛 로컬 답변을 재저장해 롤백시켰음 → 이제 없어야 함
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('3) 편집 중(debounce 미발화) 외부 변경 → 사용자 입력 유지', () => {
    const { rerenderWith } = renderCard(makeCl())
    const textarea = screen.getByPlaceholderText(ANSWER_PLACEHOLDER)

    fireEvent.change(textarea, { target: { value: '타이핑 중인 내용' } })
    // 1.5s 안 지남 — 타이머 pending
    rerenderWith(makeCl({ answer: '외부 변경 값' }))
    expect(textarea).toHaveValue('타이핑 중인 내용')
  })
})

describe('CoverletterQuestionCard — placeholder 잔존 경고', () => {
  it('answer 에 "[본인 경험 채우기: …]" 포함 → 경고 배지 렌더', () => {
    render(
      <CoverletterQuestionCard
        cl={makeCl({ answer: '저는 [본인 경험 채우기: 사례] 를 통해 성장했습니다.' })}
        number={1}
        applicationId="app-1"
        expanded
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onAskAI={vi.fn()}
      />,
    )
    expect(screen.getByText(/채워야 할 부분 1곳/)).toBeInTheDocument()
  })
})

describe('CoverletterQuestionCard — 보기 전용(readOnly)', () => {

  it('1) readOnly 펼침 → 질문·답변 텍스트 표시 + textarea/삭제 버튼 부재', () => {
    renderReadOnly(makeCl())
    // 질문·답변 표시 전용
    expect(screen.getByText('지원 동기를 작성하세요')).toBeInTheDocument()
    expect(screen.getByText('기존 답변')).toBeInTheDocument()
    // 편집 UI 부재
    expect(screen.queryByPlaceholderText(ANSWER_PLACEHOLDER)).toBeNull()
    expect(screen.queryByText('삭제')).toBeNull()
  })

  it('2) readOnly → 검사·가져오기 버튼 부재', () => {
    renderReadOnly(makeCl())
    expect(screen.queryByText(/자소서 검사/)).toBeNull()
    expect(screen.queryByText(/답변 가져오기/)).toBeNull()
  })

  it('3) 답변 없으면 "(아직 작성 안 됨)" 표시', () => {
    renderReadOnly(makeCl({ answer: '' }))
    expect(screen.getByText('(아직 작성 안 됨)')).toBeInTheDocument()
  })

  it('4) readOnly=false → 편집 textarea·삭제·검사 UI 존재', () => {
    renderReadOnly(makeCl(), false)
    expect(screen.getByPlaceholderText(ANSWER_PLACEHOLDER)).toBeInTheDocument()
    expect(screen.getByText('삭제')).toBeInTheDocument()
    expect(screen.getByText(/자소서 검사/)).toBeInTheDocument()
  })
})

/**
 * 🔴 **`preview` — 랜딩 미리보기는 네트워크를 타지 않는다** (2026-08-09).
 *
 * 랜딩이 이 카드를 **실물로** 렌더하는데, 참조 경험 조회가 비로그인 방문자에게 401 을 낸다.
 *
 * 🔴 `readOnly` 로 대신하지 않은 이유가 이 spec 의 요점이다 — **참조 경험 칩은
 * `readOnly`(모바일)에서도 보여야 한다.** 거기에 게이트를 걸면 모바일 동작이 조용히 바뀐다.
 * 그래서 별도 플래그를 뒀고, **`readOnly` 만으로는 안 꺼지는 것**까지 확인한다.
 */
describe('CoverletterQuestionCard — preview 네트워크 차단', () => {
  const refsMock = vi.mocked(useCoverletterSourceRefs)
  const withAnswer = () => makeCl({ answer: '작성한 답변입니다.' })

  beforeEach(() => refsMock.mockClear())

  it('🔴 preview → 참조 경험 조회를 끈다', () => {
    renderReadOnly(withAnswer(), false, { preview: true })
    for (const call of refsMock.mock.calls) expect(call[1]).toBe(false)
    expect(refsMock.mock.calls.length).toBeGreaterThan(0)
  })

  it('🔴 readOnly 만으로는 안 꺼진다 (모바일에서 칩이 보여야 한다)', () => {
    renderReadOnly(withAnswer(), true)
    expect(refsMock.mock.calls.some((c: unknown[]) => c[1] === true)).toBe(true)
  })

  it('답변이 없으면 원래도 안 부른다 (기존 조건 유지)', () => {
    renderReadOnly(makeCl({ answer: null }), false)
    for (const call of refsMock.mock.calls) expect(call[1]).toBe(false)
  })
})
