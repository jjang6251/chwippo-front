import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyInfoViewRow } from './MyInfoViewRow'

const toastError = vi.fn()
vi.mock('@/stores/toastStore', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}))

function setClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: impl } })
}

describe('MyInfoViewRow', () => {
  it('label·value 표시', () => {
    render(<MyInfoViewRow label="이름" value="홍길동" />)
    expect(screen.getByText('이름')).toBeInTheDocument()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })

  it('빈 값 — em dash 회색 표시', () => {
    render(<MyInfoViewRow label="이름" value="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('null·undefined 값 — em dash', () => {
    const { rerender } = render(<MyInfoViewRow label="이름" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    rerender(<MyInfoViewRow label="이름" value={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('공백만 — em dash (trim 후 비어있음)', () => {
    render(<MyInfoViewRow label="이름" value="   " />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('copyable + 값 있음 — CopyButton 노출', () => {
    render(<MyInfoViewRow label="이메일" value="a@b.com" copyable />)
    expect(screen.getByTitle('복사')).toBeInTheDocument()
  })

  it('copyable 이지만 값 없음 — CopyButton 안 보임', () => {
    render(<MyInfoViewRow label="이메일" value="" copyable />)
    expect(screen.queryByTitle('복사')).not.toBeInTheDocument()
  })

  it('copyable=false — CopyButton 안 보임', () => {
    render(<MyInfoViewRow label="성별" value="남성" />)
    expect(screen.queryByTitle('복사')).not.toBeInTheDocument()
  })
})

/**
 * CopyButton 의 클립보드 실패 경로 — **실사고 지점** (Sentry CHWIPPO-FRONT-6).
 *
 * `/demo/myinfo` 에서 복사가 거부되자(NotAllowedError) 방어가 없어 rejection 이
 * unhandled 로 새어 크래시로 잡혔다. CopyButton 은 전용 spec 이 없고 이 파일이
 * 이미 CopyButton 을 렌더·단언하고 있어 여기에 실패 경로를 붙인다.
 *
 * 케이스:
 *  1. 복사 성공 → 체크 표시(text-success)
 *  2. 복사 실패 → 안내 토스트 + 체크 표시 안 뜸 (거짓 성공 금지)
 *     ※ rejection 이 새면 vitest 가 unhandled 로 런 자체를 실패시킨다 — 그게 크래시 회귀 방어다
 */
describe('MyInfoViewRow — CopyButton 클립보드', () => {
  beforeEach(() => {
    toastError.mockReset()
    setClipboard(() => Promise.resolve())
  })

  it('1. 복사 성공 → 체크 표시', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const { container } = render(
      <MyInfoViewRow label="이메일" value="a@b.com" copyable />,
    )
    fireEvent.click(screen.getByTitle('복사'))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('a@b.com'))
    await waitFor(() =>
      expect(container.querySelector('.text-success')).toBeInTheDocument(),
    )
    expect(toastError).not.toHaveBeenCalled()
  })

  it('2. 복사 실패 → 안내 토스트 + 체크 표시 안 뜸', async () => {
    setClipboard(() => Promise.reject(new Error('NotAllowedError')))

    const { container } = render(
      <MyInfoViewRow label="이메일" value="a@b.com" copyable />,
    )
    fireEvent.click(screen.getByTitle('복사'))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('복사에 실패했어요'),
      ),
    )
    expect(container.querySelector('.text-success')).toBeNull()
  })
})
