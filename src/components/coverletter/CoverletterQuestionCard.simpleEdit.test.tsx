/**
 * `simpleEdit` — **글자만 고친다.**
 *
 * 🔴 **왜 필요했나** (2026-08-10). 면접 세션의 「나란히 보기」가 이 카드를 그대로 쓴다.
 * 거기서 자소서는 **답을 쓰는 동안 참고하는 자료**다 — 문항 유형을 바꾸거나 AI 를 부르거나
 * 문항을 지우는 건 그 맥락이 아니고, 504px 열에서 모달이 뜨는 것도 어색하다.
 *
 * 🔴 **`readOnly` 로 대신할 수 없다.** 그건 답변까지 못 고친다. 오타 하나 고치려고
 * 자소서 화면까지 가야 하면 나란히 보기를 만든 이유가 없어진다.
 *
 * 그래서 이 spec 이 잠그는 계약은 둘이다:
 *   ① 답변은 **고쳐진다** (`readOnly` 와 다른 점)
 *   ② 구조를 바꾸는 조작과 부가 도구는 **안 보인다** (기본 편집과 다른 점)
 *
 * 세 상태가 서로 다르다는 걸 한 파일에서 대조한다 — 하나만 보면 구분이 안 된다.
 */
import { render, screen, act, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverletterQuestionCard } from './CoverletterQuestionCard'
import type { ApplicationCoverletter } from '@/types/coverletter'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useAiEnabled', () => ({ useAiEnabled: () => true }))

const cl = {
  id: 'cl-1',
  applicationId: 'app-1',
  category: '지원동기',
  question: '지원하게 된 동기를 작성해 주세요.',
  answer: '경품을 키우는 대신 참여 문턱을 낮췄습니다.',
  charLimit: 800,
  orderIndex: 0,
} as unknown as ApplicationCoverletter

const onUpdateSpy = vi.fn()

function draw(props: { readOnly?: boolean; simpleEdit?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CoverletterQuestionCard
        cl={cl}
        number={1}
        applicationId="app-1"
        expanded
        onToggle={vi.fn()}
        onUpdate={onUpdateSpy}
        onDelete={vi.fn()}
        onAskAI={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
}

/** 답변 입력칸 — 있으면 고칠 수 있다는 뜻 */
const answerBox = () =>
  screen.queryByDisplayValue(/경품을 키우는 대신/) as HTMLTextAreaElement | null

describe('simpleEdit — 답변만 고친다', () => {
  it('🔴 답변은 고칠 수 있다 (readOnly 와 다른 점)', () => {
    draw({ simpleEdit: true })
    expect(answerBox()).toBeTruthy()
  })

  it('🔴 AI·답변 가져오기 같은 부가 도구는 안 보인다', () => {
    draw({ simpleEdit: true })
    expect(screen.queryByText(/AI 에게 묻기/)).toBeNull()
    expect(screen.queryByText(/답변 가져오기/)).toBeNull()
  })

  /**
   * 🔴 유형·글자수 제한은 **자소서의 구조**다. 면접 답을 쓰다 바꿀 일이 아니고,
   * 잘못 건드리면 자소서 화면에서 그대로 어긋난 채 보인다.
   */
  it('🔴 유형·글자수 제한은 편집 컨트롤이 아니라 표시로 나온다', () => {
    draw({ simpleEdit: true })
    expect(screen.queryByLabelText('유형')).toBeNull()
    expect(screen.queryByLabelText('글자수 제한')).toBeNull()
    expect(screen.getByText(/제한 800자/)).toBeTruthy()
  })
})

describe('세 상태가 서로 다르다', () => {
  it('readOnly — 답변도 못 고친다', () => {
    draw({ readOnly: true })
    expect(answerBox()).toBeNull()
    expect(screen.getByText(/경품을 키우는 대신/)).toBeTruthy() // 글로는 보인다
  })

  it('기본(편집) — 부가 도구가 보인다 (기존 동작 무변경)', () => {
    draw()
    expect(answerBox()).toBeTruthy()
    expect(screen.getByText(/AI 에게 묻기/)).toBeTruthy()
    expect(screen.getByText(/답변 가져오기/)).toBeTruthy()
  })
})

/**
 * 🔴 **떠날 때 잃지 않는가** (2026-08-10 점검에서 발견).
 *
 * 저장은 1.5초 debounce 이고 cleanup 은 타이머를 **지우기만** 했다. 나란히 보기가
 * 언마운트 경로를 크게 늘렸다 — 손잡이를 눌러 열을 접기·끝까지 끌어 접기·창 줄이기.
 * 타이핑하고 바로 접으면 마지막 1.5초가 사라지는데 화면엔 「자동 저장돼요」가 떠 있었다.
 *
 * 면접 카드가 같은 사고를 먼저 겪고 flush 로 막아 뒀다 (2026-08-09). 그 계약을 여기도 건다.
 */
describe('떠날 때 답변을 잃지 않는다', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    onUpdateSpy.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  const type = (v: string) => {
    const ta = screen.getByDisplayValue(/경품을 키우는 대신/) as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: v } })
    })
  }

  it('🔴 debounce 가 끝나기 전에 접어도 저장한다 (flush)', () => {
    const { unmount } = draw({ simpleEdit: true })
    type('보정 전 41%였습니다')
    act(() => {
      vi.advanceTimersByTime(300) // 1.5초 전
    })
    expect(onUpdateSpy).not.toHaveBeenCalled()

    act(() => {
      unmount()
    })
    expect(onUpdateSpy).toHaveBeenCalledWith({ answer: '보정 전 41%였습니다' })
  })

  it('이미 저장된 뒤 접으면 또 보내지 않는다', () => {
    const { unmount } = draw({ simpleEdit: true })
    type('저장된 답변')
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(onUpdateSpy).toHaveBeenCalledTimes(1)

    act(() => {
      unmount()
    })
    expect(onUpdateSpy).toHaveBeenCalledTimes(1)
  })

  it('한 글자도 안 쳤으면 접어도 아무 일 없다', () => {
    const { unmount } = draw({ simpleEdit: true })
    act(() => {
      unmount()
    })
    expect(onUpdateSpy).not.toHaveBeenCalled()
  })
})

/**
 * 🔴 **없는 것을 가리키지 않는다** (2026-08-10 점검).
 *
 * `simpleEdit` 는 AI 채팅·[검사] 버튼을 의도적으로 뺀 화면인데, 안내 문구는 그걸 계속
 * 가리키고 있었다 — 게다가 「우측 AI 채팅」의 오른쪽엔 채팅이 아니라 **면접 열**이 있다.
 * 없는 버튼을 찾게 만드는 안내는 안 하느니만 못하다.
 */
describe('없는 UI 를 가리키지 않는다', () => {
  it('🔴 placeholder 가 AI 채팅을 가리키지 않는다', () => {
    draw({ simpleEdit: true })
    const ta = screen.getByDisplayValue(/경품을 키우는 대신/)
    expect(ta.getAttribute('placeholder')).not.toContain('AI 채팅')
  })

  it('기본 편집에선 그대로 안내한다 (기존 동작)', () => {
    draw()
    const ta = screen.getByDisplayValue(/경품을 키우는 대신/)
    expect(ta.getAttribute('placeholder')).toContain('AI 채팅')
  })

  /** 🔴 [검사] 버튼은 `simpleEdit` 에서 감춰져 있다 — 힌트만 남으면 찾아 헤맨다 */
  it('🔴 글자수 초과 힌트가 감춰진 [검사] 를 가리키지 않는다', () => {
    const long = { ...cl, answer: '가'.repeat(900) } as typeof cl
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CoverletterQuestionCard
          cl={long}
          number={1}
          applicationId="app-1"
          expanded
          onToggle={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          onAskAI={vi.fn()}
          simpleEdit
        />
      </QueryClientProvider>,
    )
    expect(screen.queryByText(/AI 심층 점검/)).toBeNull()
  })
})
