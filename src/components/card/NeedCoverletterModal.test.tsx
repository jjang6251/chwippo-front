/**
 * 자소서 게이트 공통 모달 — **막힌 사용자에게 길을 주는 것**이 이 모달의 유일한 일이다.
 *
 * 백엔드가 면접 AI 4경로(생성·↻·답변·꼬리)에 같은 게이트를 달면서, 모달 밖에서 일어나는
 * 3경로가 이 컴포넌트를 함께 쓴다. 그래서 검증할 축은 두 개다 — **문구가 서버 것인가**,
 * **길이 올바른 카드로 열리는가.**
 *
 * 시나리오 매트릭스:
 *   1. 🔴 서버 reason 이 있으면 그대로 (프론트 고정 문구가 진짜 이유를 덮지 않는다)
 *   2. 🔴 reason 없음 → 기본 문구 (막혔는데 빈 모달이 뜨지 않게)
 *   3. 🔴 reason 이 빈 문자열·공백 → 기본 문구 (`?? ''` 로 넘어온 값이 그대로 새지 않게)
 *   4. 🔴 CTA → 그 지원 카드의 자소서 화면으로 이동
 *   5. 보조 문구 — 자소서 없이도 할 수 있는 일을 남긴다 (막다른 길 방지)
 *   6. 닫기 → onClose
 *   7. open=false → 아무것도 그리지 않는다
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NeedCoverletterModal } from './NeedCoverletterModal'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

const FALLBACK = 'AI 질문·답변은 자소서를 재료로 만들어요. 자소서를 먼저 등록해 주세요.'

function renderModal(
  props: Partial<Parameters<typeof NeedCoverletterModal>[0]> = {},
) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <NeedCoverletterModal
        open
        onClose={onClose}
        applicationId="app-1"
        {...props}
      />
    </MemoryRouter>,
  )
  return { onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('문구 — 서버 우선', () => {
  it('1) 🔴 서버 reason 을 그대로 보여준다', () => {
    renderModal({
      reason: '자소서가 있어야 AI 질문을 만들 수 있어요. 먼저 추가해 주세요.',
    })
    expect(
      screen.getByText(/자소서가 있어야 AI 질문을 만들 수 있어요/),
    ).toBeInTheDocument()
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })

  it('2) 🔴 reason 이 없으면 기본 문구로 채운다', () => {
    renderModal()
    expect(screen.getByText(FALLBACK)).toBeInTheDocument()
  })

  /** 호출부가 `result.reason ?? ''` 로 넘긴다 — 빈 값이 그대로 새면 안내가 사라진다 */
  it.each(['', '   '])('3) 🔴 reason 이 빈 값(%s)이면 기본 문구', (blank) => {
    renderModal({ reason: blank })
    expect(screen.getByText(FALLBACK)).toBeInTheDocument()
  })
})

describe('길 — 자소서로 가기', () => {
  it('4) 🔴 CTA 는 그 지원 카드의 자소서 화면으로 보낸다', () => {
    renderModal({ applicationId: 'app-77' })
    fireEvent.click(screen.getByRole('button', { name: /자소서 쓰러 가기/ }))
    expect(navigateMock).toHaveBeenCalledWith('/board/app-77/coverletter')
  })

  it('5) 자소서 없이도 할 수 있는 일을 함께 알린다', () => {
    renderModal()
    expect(
      screen.getByText(/직접 질문 추가와 내 답변 메모는 자소서 없이도/),
    ).toBeInTheDocument()
  })

  it('6) 닫기를 누르면 onClose', () => {
    const { onClose } = renderModal()
    // 공용 `Modal` 헤더의 X 도 접근명이 「닫기」 다 — 본문 ghost 는 마지막 것
    const buttons = screen.getAllByRole('button', { name: '닫기' })
    fireEvent.click(buttons[buttons.length - 1])
    expect(onClose).toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('7) open=false 면 아무것도 그리지 않는다', () => {
    renderModal({ open: false })
    expect(screen.queryByText(FALLBACK)).toBeNull()
    expect(
      screen.queryByRole('button', { name: /자소서 쓰러 가기/ }),
    ).toBeNull()
  })
})
