import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MyInfoViewRow } from './MyInfoViewRow'

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
