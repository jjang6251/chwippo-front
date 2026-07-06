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
vi.mock('@/hooks/useCoverletterSourceRefs', () => ({
  useCoverletterSourceRefs: () => ({ data: [] }),
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
