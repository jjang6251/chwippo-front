import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyInfoItemRow } from './MyInfoItemRow'

const toastError = vi.fn()
vi.mock('@/stores/toastStore', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}))

function setClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: impl } })
}

describe('MyInfoItemRow', () => {
  it('emoji·title·meta 표시', () => {
    render(
      <MyInfoItemRow
        emoji="🎓"
        title="서울대학교 · 컴퓨터공학"
        meta="학사 · 2020.03 ~ 2024.02"
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('🎓')).toBeInTheDocument()
    expect(screen.getByText('서울대학교 · 컴퓨터공학')).toBeInTheDocument()
    expect(screen.getByText('학사 · 2020.03 ~ 2024.02')).toBeInTheDocument()
  })

  it('클릭 시 onClick 호출', () => {
    const onClick = vi.fn()
    render(<MyInfoItemRow emoji="🎓" title="학교" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('meta 없으면 meta 영역 안 보임', () => {
    render(<MyInfoItemRow emoji="🎓" title="학교" onClick={vi.fn()} />)
    expect(screen.queryByText(/학사/)).not.toBeInTheDocument()
  })

  it('rightSlot 있으면 chevron 대신 표시', () => {
    render(
      <MyInfoItemRow
        emoji="🎓"
        title="학교"
        onClick={vi.fn()}
        rightSlot={<span>custom</span>}
      />,
    )
    expect(screen.getByText('custom')).toBeInTheDocument()
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })

  it('accent prop — emoji 배경 색 변경', () => {
    const { container, rerender } = render(
      <MyInfoItemRow emoji="🎓" title="학교" accent="brand" onClick={vi.fn()} />,
    )
    expect(container.querySelector('.bg-brand\\/15')).toBeInTheDocument()

    rerender(<MyInfoItemRow emoji="🎓" title="학교" accent="warning" onClick={vi.fn()} />)
    expect(container.querySelector('.bg-warning\\/15')).toBeInTheDocument()
  })
})

/**
 * 펼친 상세 필드의 [📋] 복사 — 클립보드가 **거부될 수 있다**.
 * 권한 거부·비보안 컨텍스트(NotAllowedError)에서 `writeText` 는 reject 한다.
 *
 * 케이스:
 *  1. 복사 성공 → 성공 표시(체크·text-success)
 *  2. 복사 실패 → 안내 토스트 + 성공 표시 안 뜸 (거짓 성공 금지)
 *     ※ rejection 이 새면 vitest 가 unhandled 로 런 자체를 실패시킨다 — 그게 크래시 회귀 방어다
 */
describe('MyInfoItemRow — 클립보드 복사', () => {
  const detailFields = [{ label: '이메일', value: 'a@b.com' }]

  function renderExpanded() {
    render(
      <MyInfoItemRow
        emoji="🎓"
        title="학교"
        onClick={vi.fn()}
        detailFields={detailFields}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /학교/ }))
  }

  const copyButton = () => screen.getByRole('button', { name: '이메일 복사' })

  beforeEach(() => {
    toastError.mockReset()
    setClipboard(() => Promise.resolve())
  })

  it('1. 복사 성공 → 성공 표시', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    renderExpanded()
    fireEvent.click(copyButton())

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('a@b.com'))
    await waitFor(() => expect(copyButton().className).toContain('text-success'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('2. 복사 실패 → 안내 토스트 + 성공 표시 안 뜸', async () => {
    setClipboard(() => Promise.reject(new Error('NotAllowedError')))

    renderExpanded()
    fireEvent.click(copyButton())

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('복사에 실패했어요'),
      ),
    )
    expect(copyButton().className).not.toContain('text-success')
  })
})
