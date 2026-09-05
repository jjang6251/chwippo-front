/**
 * 내 정보 창고 공용 입력 프리미티브 — 라벨·상태·자동완성 힌트가 **칸까지 닿는가**.
 *
 * 🔴 이 spec 의 심장은 둘이다.
 *   ① `disabled` 가 textarea 에서 **말로만** 걸려 있었다 (흐릿해 보이는데 타이핑은 됐다).
 *   ② `for` 없는 `<label>` 은 아무것도 가리키지 않는다 — 세그먼트 토글 자리에서
 *      「라벨」만 읽히고 끝났다. 그 자리는 `<p id>` 로 그리고 그룹이 이름으로 참조한다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 비활성
 *   1. 🔴 textarea `disabled` → 실제로 비활성이고 입력이 안 먹는다
 *   2. input `disabled` (회귀 방어 — 원래 되던 것)
 *  ── 필수
 *   3. input 에 `required` · `aria-required` 가 실린다
 *   4. `*` 는 `aria-hidden`, 「필수」는 sr-only 글자로 읽힌다
 *   5. required 아니면 둘 다 없다
 *  ── FieldLabel
 *   6. 🔴 `htmlFor` 없으면 `<label>` 이 아니라 `<p id>` 로 그린다
 *   7. `htmlFor` 있으면 `<label for>` 로 칸과 이어진다
 *  ── 브라우저 힌트 pass-through
 *   8. input — autoComplete · inputMode · spellCheck
 *   9. textarea — 같은 셋
 *  10. 안 주면 속성 자체가 없다 (`spellCheck` 는 기본값을 덮지 않는다)
 *  ── 설명·검증 연결
 *  11. describedBy → `aria-describedby`
 *  12. invalid → `aria-invalid`
 *  ── 카운터
 *  13. 🔴 이모지는 1자다 — `String.length`(2) 가 아니라 `countChars`
 *  14. 카운터는 `aria-live="polite"`
 *  15. maxLength 가 없으면 카운터도 없다
 */
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Field, FieldLabel } from './fields'

afterEach(cleanup)

const input = () => screen.getByRole('textbox')

describe('비활성', () => {
  it('🔴 textarea disabled — 실제로 비활성이고 입력이 안 먹는다', async () => {
    const onChange = vi.fn()
    render(<Field as="textarea" label="메모" value="" onChange={onChange} disabled />)
    const el = input()
    expect(el).toBeDisabled()
    // `fireEvent.change` 는 disabled 를 무시한다 — 사람이 치는 경로로 확인해야 의미가 있다
    await userEvent.type(el, '타이핑')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('input disabled — 원래 되던 것 (회귀 방어)', () => {
    render(<Field label="이름" value="" onChange={vi.fn()} disabled />)
    expect(input()).toBeDisabled()
  })
})

describe('필수', () => {
  it('input 에 required · aria-required 가 실린다', () => {
    render(<Field label="이름" value="" onChange={vi.fn()} required />)
    const el = input()
    expect(el).toBeRequired()
    expect(el).toHaveAttribute('aria-required', 'true')
  })

  it('🔴 별표는 aria-hidden, 「필수」는 글자로 읽힌다', () => {
    render(<Field label="이름" value="" onChange={vi.fn()} required />)
    // 별표만 있으면 안 읽히거나 「별」로 읽힌다 — 글자 「필수」가 라벨에 함께 들어가야 한다
    expect(screen.getByLabelText(/^이름/)).toBe(input())
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('필수').className).toContain('sr-only')
    expect(input()).toHaveAccessibleName(/필수/)
  })

  it('required 가 아니면 required·aria-required 둘 다 없다', () => {
    render(<Field label="이름" value="" onChange={vi.fn()} />)
    const el = input()
    expect(el).not.toBeRequired()
    expect(el).not.toHaveAttribute('aria-required')
    expect(screen.queryByText('*')).toBeNull()
  })
})

describe('FieldLabel', () => {
  it('🔴 htmlFor 가 없으면 <label> 이 아니라 <p id> 로 그린다', () => {
    const { container } = render(<FieldLabel label="보훈 대상 여부" id="patriot-label" />)
    expect(container.querySelector('label')).toBeNull()
    const p = container.querySelector('p#patriot-label')
    expect(p).not.toBeNull()
    expect(p?.textContent).toBe('보훈 대상 여부')
  })

  it('htmlFor 가 있으면 <label for> 로 칸과 이어진다', () => {
    const { container } = render(
      <>
        <FieldLabel label="요약" htmlFor="summary" />
        <textarea id="summary" />
      </>,
    )
    expect(container.querySelector('label')).toHaveAttribute('for', 'summary')
    expect(screen.getByLabelText('요약')).toBe(input())
  })
})

describe('브라우저 힌트 pass-through', () => {
  it('input — autoComplete · inputMode · spellCheck', () => {
    render(
      <Field
        label="연락처" value="" onChange={vi.fn()}
        autoComplete="tel" inputMode="tel" spellCheck={false}
      />,
    )
    const el = input()
    expect(el).toHaveAttribute('autocomplete', 'tel')
    expect(el).toHaveAttribute('inputmode', 'tel')
    expect(el).toHaveAttribute('spellcheck', 'false')
  })

  it('textarea — 같은 셋', () => {
    render(
      <Field
        as="textarea" label="메모" value="" onChange={vi.fn()}
        autoComplete="off" inputMode="text" spellCheck={false}
      />,
    )
    const el = input()
    expect(el).toHaveAttribute('autocomplete', 'off')
    expect(el).toHaveAttribute('inputmode', 'text')
    expect(el).toHaveAttribute('spellcheck', 'false')
  })

  it('안 주면 속성 자체가 없다 — 브라우저 기본값을 덮지 않는다', () => {
    render(<Field label="이름" value="" onChange={vi.fn()} />)
    const el = input()
    expect(el).not.toHaveAttribute('autocomplete')
    expect(el).not.toHaveAttribute('inputmode')
    expect(el).not.toHaveAttribute('spellcheck')
  })
})

describe('설명 · 검증 연결', () => {
  it('describedBy → aria-describedby', () => {
    render(<Field label="전역일" value="" onChange={vi.fn()} describedBy="chips" />)
    expect(input()).toHaveAttribute('aria-describedby', 'chips')
  })

  it('invalid → aria-invalid', () => {
    render(<Field label="경력명" value="" onChange={vi.fn()} invalid />)
    expect(input()).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('카운터', () => {
  it('🔴 이모지는 1자 — String.length(2) 가 아니라 countChars', () => {
    render(<Field as="textarea" label="성과" value="👍" onChange={vi.fn()} maxLength={200} />)
    expect(screen.getByText('1 / 200')).toBeInTheDocument()
  })

  it('보통 글자는 그대로 센다', () => {
    render(<Field as="textarea" label="성과" value="가나다" onChange={vi.fn()} maxLength={200} />)
    expect(screen.getByText('3 / 200')).toBeInTheDocument()
  })

  it('카운터는 aria-live="polite" — 세면서 읽힌다', () => {
    render(<Field as="textarea" label="성과" value="가" onChange={vi.fn()} maxLength={200} />)
    expect(screen.getByText('1 / 200')).toHaveAttribute('aria-live', 'polite')
  })

  it('maxLength 가 없으면 카운터도 없다', () => {
    render(<Field as="textarea" label="성과" value="가" onChange={vi.fn()} />)
    expect(screen.queryByText(/\/ /)).toBeNull()
  })
})
