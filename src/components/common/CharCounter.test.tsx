import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CharCounter } from './CharCounter'
import { charCounterText, charCounterTone, countChars } from '@/utils/charCount'

/**
 * 글자수 카운터 — 최소·최대 동시 표시 + 자소서 카드와 **같은** 색 규칙.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. min+max → 「0자 (최소 300 – 최대 600)」
 *  2. max 만 → 「120 / 500」
 *  3. min 만 → 「40자 (최소 300)」
 *  4. 둘 다 없음 → 「7자」
 *  5. 경계: 정확히 90% → warning
 *  6. 경계: 90% 직전 → normal
 *  7. 경계: 정확히 max → warning (초과 아님)
 *  8. 경계: max+1 → danger
 *  9. max 없으면 아무리 길어도 normal
 * 10. countChars 와 물린다 — 이모지는 1글자
 * 11. 🔴 aria-live="polite" — 세는 동안 숫자가 들려야 「얼마나 더」를 안다
 */
describe('charCounterText', () => {
  it('min + max 동시 표시', () => {
    expect(charCounterText(0, 600, 300)).toBe('0자 (최소 300 – 최대 600)')
  })
  it('max 만', () => {
    expect(charCounterText(120, 500)).toBe('120 / 500')
  })
  it('min 만', () => {
    expect(charCounterText(40, undefined, 300)).toBe('40자 (최소 300)')
  })
  it('제한 없음', () => {
    expect(charCounterText(7)).toBe('7자')
  })
})

describe('charCounterTone — 자소서 카드와 동일 규칙', () => {
  it('정확히 90% → warning', () => {
    expect(charCounterTone(450, 500)).toBe('warning')
  })
  it('90% 직전 → normal', () => {
    expect(charCounterTone(449, 500)).toBe('normal')
  })
  it('정확히 max → warning (아직 초과 아님)', () => {
    expect(charCounterTone(500, 500)).toBe('warning')
  })
  it('max + 1 → danger', () => {
    expect(charCounterTone(501, 500)).toBe('danger')
  })
  it('max 없으면 언제나 normal', () => {
    expect(charCounterTone(99999)).toBe('normal')
  })
  it('0 → normal', () => {
    expect(charCounterTone(0, 500)).toBe('normal')
  })
})

describe('CharCounter 렌더', () => {
  it('최소·최대를 한 줄에 같이 보여준다', () => {
    render(<CharCounter current={0} min={300} max={600} />)
    expect(screen.getByText('0자 (최소 300 – 최대 600)')).toBeInTheDocument()
  })

  it('초과하면 danger 색 + 굵게', () => {
    render(<CharCounter current={501} max={500} />)
    expect(screen.getByText('501 / 500').className).toContain('text-danger')
  })

  it('90% 이상이면 warning 색', () => {
    render(<CharCounter current={470} max={500} />)
    expect(screen.getByText('470 / 500').className).toContain('text-warning')
  })

  it('여유 있으면 quaternary', () => {
    render(<CharCounter current={10} max={500} />)
    expect(screen.getByText('10 / 500').className).toContain('text-text-quaternary')
  })

  it('🔴 countChars 로 센 값과 물린다 — 이모지는 1글자', () => {
    const n = countChars('가😀나').total
    expect(n).toBe(3)
    render(<CharCounter current={n} max={500} />)
    expect(screen.getByText('3 / 500')).toBeInTheDocument()
  })

  it('🔴 aria-live="polite" — 세는 동안 숫자가 들려야 「얼마나 더」를 안다', () => {
    render(<CharCounter current={10} max={500} />)
    expect(screen.getByText('10 / 500')).toHaveAttribute('aria-live', 'polite')
  })
})
