/**
 * 「지원 예정」 카드 상세 안내 블록 — 「그래서 지금 뭘 하면 되나」에 답하는지.
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 상태 pill + 「아직 지원 전이에요」
 *  2. 🔴 전형 미리보기가 **전부 미도달**이다 (완료·현재 표식 0 · 진행률 줄 없음)
 *  3. 스텝이 0개면 대신 한 줄 안내 (빈 상자를 만들지 않는다)
 *  4. 「지원 시작하기」 + 마감일 캡션 → `onStart`
 *  5. 조사가 있으면 「회사 알아보기 · 면접 키워드 N개 준비됨」 → `onOpenResearch`
 *  6. 조사 키워드가 0이면 개수를 말하지 않는다 / 탭이 없으면 링크 자체가 없다
 *  7. 「메모 남기기」 → `onFocusMemo`
 *  8. 🔴 카드처럼 보이지 않는다 (좌측 accent 스트라이프 금지)
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlannedGuide } from './PlannedGuide'
import type { Application, ApplicationStep } from '@/types/application'

function step(orderIndex: number, name: string): ApplicationStep {
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

const STEP_NAMES = ['서류 제출', '1차 면접', '최종 합격']

function makeApp(over: Partial<Application> = {}): Application {
  return {
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
    steps: STEP_NAMES.map((n, i) => step(i, n)),
    createdAt: '2026-08-29T00:00:00Z',
    updatedAt: '2026-08-29T00:00:00Z',
    ...over,
  }
}

function renderGuide(over: Partial<Parameters<typeof PlannedGuide>[0]> = {}) {
  const props = {
    app: makeApp(),
    keywordCount: 12,
    hasResearchTab: true,
    onStart: vi.fn(),
    onOpenResearch: vi.fn(),
    onFocusMemo: vi.fn(),
    ...over,
  }
  const utils = render(<PlannedGuide {...props} />)
  return { ...utils, props }
}

describe('PlannedGuide', () => {
  it('1) 상태 pill + 「아직 지원 전이에요」', () => {
    renderGuide()
    expect(screen.getByText('지원 예정')).toBeInTheDocument()
    expect(screen.getByText('아직 지원 전이에요')).toBeInTheDocument()
  })

  it('2) 🔴 전형 미리보기가 전부 미도달이다 (완료·현재 표식 0 · 진행률 줄 없음)', () => {
    const { container } = renderGuide()

    // 스텝 이름은 다 보인다 — 「이 길을 걷게 된다」
    for (const n of STEP_NAMES) expect(screen.getByText(n)).toBeInTheDocument()

    // 🔴 어떤 노드도 (완료)·(현재) 가 아니다
    const nodes = screen.getAllByRole('button', { name: /서류 제출|1차 면접|최종 합격/ })
    expect(nodes).toHaveLength(STEP_NAMES.length)
    for (const n of nodes) {
      expect(n.getAttribute('aria-label')).not.toMatch(/완료|현재/)
      // 아직 걷지 않은 길이라 눌러도 아무 일이 없다
      expect(n).toBeDisabled()
    }

    // 진행률 줄(현재: …  N%)이 없다 — 이름 붙일 「현재」가 없다
    expect(screen.queryByText(/현재:/)).not.toBeInTheDocument()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('3) 스텝이 0개면 빈 상자 대신 한 줄 안내', () => {
    renderGuide({ app: makeApp({ steps: [] }) })
    expect(
      screen.getByText('지원 시작하면 전형 단계가 자동으로 채워져요'),
    ).toBeInTheDocument()
    expect(screen.queryByText('서류 제출')).not.toBeInTheDocument()
  })

  it('4) 「지원 시작하기」 + 마감일 캡션 → onStart', () => {
    const { props } = renderGuide()
    expect(screen.getByText('지원했다면')).toBeInTheDocument()
    expect(screen.getByText('마감일을 넣으면 D-day 와 캘린더가 붙어요')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /지원 시작하기/ }))
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })

  it('5) 조사가 있으면 키워드 개수를 말한다 → onOpenResearch', () => {
    const { props } = renderGuide({ keywordCount: 12 })
    const link = screen.getByRole('button', {
      name: '회사 알아보기 · 면접 키워드 12개 준비됨',
    })
    fireEvent.click(link)
    expect(props.onOpenResearch).toHaveBeenCalledTimes(1)
  })

  it('6) 키워드 0이면 개수를 말하지 않고, 탭이 없으면 링크도 없다', () => {
    const { unmount } = renderGuide({ keywordCount: 0 })
    expect(screen.getByRole('button', { name: '회사 알아보기' })).toBeInTheDocument()
    expect(screen.queryByText(/준비됨/)).not.toBeInTheDocument()
    unmount()

    renderGuide({ hasResearchTab: false, keywordCount: 12 })
    expect(screen.queryByRole('button', { name: /회사 알아보기/ })).not.toBeInTheDocument()
  })

  it('7) 「메모 남기기」 → onFocusMemo', () => {
    const { props } = renderGuide()
    fireEvent.click(screen.getByRole('button', { name: '메모 남기기' }))
    expect(props.onFocusMemo).toHaveBeenCalledTimes(1)
  })

  /**
   * 🔴 상세 안에서 카드 모양을 또 만들면 「카드 안에 카드」가 된다
   * (`CardResearchReveal` 의 「같은 언어, 다른 그릇」). 면·테두리·라운드만 쓴다.
   */
  it('8) 좌측 accent 스트라이프가 없다 (카드처럼 보이지 않는다)', () => {
    const { container } = renderGuide()
    const block = container.querySelector('[data-planned-guide]') as HTMLElement
    expect(block.className).toContain('bg-surface-2')
    expect(block.className).not.toMatch(/border-l-\d/)
  })

  it('9) 행동 두 갈래가 「했다면 → 아직이면」 순서다', () => {
    const { container } = renderGuide()
    const block = container.querySelector('[data-planned-guide]') as HTMLElement
    const text = within(block).getByText('지원했다면').compareDocumentPosition(
      within(block).getByText('아직이면'),
    )
    // 「지원했다면」이 먼저 — 그게 이 카드의 다음 상태다
    expect(text & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
