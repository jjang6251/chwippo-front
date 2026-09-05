/**
 * 주소 입력 — 「주소 검색」(카카오 우편번호) + **로드 실패 시 직접 입력 폴백**.
 *
 * 🔴 이 spec 의 요점: 외부 스크립트 하나 때문에 **주소 칸이 죽으면 안 된다.** 검색이
 *    안 되면 그대로 손으로 칠 수 있어야 하고, 시/도는 17개 목록에서 고를 수 있어야 한다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 우편번호·기본·상세·시/도 네 칸이 처음부터 편집 가능하다 (검색 없이도 채운다)
 *  2. 🔴 시/도 option 의 **값은 짧은 이름 17개**(백엔드 `ADDRESS_REGIONS` 완전 일치),
 *     보이는 글자만 정식 표기다 — 라벨을 저장하면 400 이 난다
 *  3. 페이지를 열자마자 외부 스크립트를 붙이지 않는다 — 버튼을 눌러야 붙는다
 *  4. 🔴 검색 결과 → zonecode·roadAddress·sido 가 한 번에 저장된다 (sido 는 짧은 이름 그대로)
 *  5. 긴 표기(「강원특별자치도」)로 와도 짧은 이름으로 접어 저장한다
 *  6. 목록에서 고르면 짧은 이름이 저장된다
 *  7. 🔴 스크립트 로드 실패 → 토스트 안내, 칸은 그대로 살아 있다
 *  8. 직접 입력 → blur 에 그 칸만 저장된다
 *  9. 스크립트는 두 번 붙지 않는다
 *  ── 자동 채움 힌트
 * 10. 🔴 네 칸 모두 표준 autocomplete 토큰 (postal-code · address-line1/2 · address-level1)
 * 11. 우편번호는 맞춤법 검사를 끈다
 *  ── 여는 중 (포커스를 잃지 않는다)
 * 12. 🔴 `disabled` 가 아니라 `aria-disabled`·`aria-busy` — 버튼이 포커스를 지킨다
 * 13. 여는 중 다시 눌러도 스크립트를 또 붙이지 않는다 (클릭은 핸들러가 무시한다)
 * 14. 평소에는 aria-disabled=false
 */
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddressField, type AddressValue } from './AddressField'
import { KOREA_REGIONS, REGION_LABEL } from '@/utils/koreaRegions'

const h = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('@/stores/toastStore', () => ({ toast: { error: h.toastError, show: vi.fn() } }))

const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
const EMPTY: AddressValue = { address_zip: '', address_base: '', address_detail: '', address_region: '' }

type Complete = (d: { zonecode: string; roadAddress: string; jibunAddress: string; sido: string }) => void

/** 스크립트 태그가 붙는 순간 load/error 를 흉내 낸다 */
function stubScript(mode: 'ok' | 'fail', onComplete?: (fire: Complete) => void) {
  const realAppend = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) => {
    const el = realAppend(node) as HTMLScriptElement
    queueMicrotask(() => {
      if (mode === 'fail') {
        el.dispatchEvent(new Event('error'))
        return
      }
      window.daum = {
        Postcode: class {
          private opts: { oncomplete: Complete }
          constructor(opts: { oncomplete: Complete }) { this.opts = opts }
          open() { onComplete?.(this.opts.oncomplete) }
        } as unknown as NonNullable<typeof window.daum>['Postcode'],
      }
      el.dispatchEvent(new Event('load'))
    })
    return el
  }) as typeof document.head.appendChild)
}

function draw(value: AddressValue = EMPTY) {
  const onChange = vi.fn()
  const onCommit = vi.fn()
  const view = render(<AddressField value={value} onChange={onChange} onCommit={onCommit} />)
  return { ...view, onChange, onCommit }
}

beforeEach(() => {
  h.toastError.mockReset()
  delete window.daum
  document.querySelectorAll(`script[src="${SRC}"]`).forEach((s) => s.remove())
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AddressField', () => {
  it('네 칸이 처음부터 편집 가능하다 (검색 없이도 채운다)', () => {
    draw()
    expect(screen.getByLabelText('우편번호')).toBeEnabled()
    expect(screen.getByLabelText('기본 주소')).toBeEnabled()
    expect(screen.getByLabelText('상세 주소')).toBeEnabled()
    expect(screen.getByLabelText('시/도')).toBeEnabled()
  })

  it('🔴 시/도 option 값은 짧은 이름 17개 — 보이는 글자만 정식 표기', () => {
    draw()
    const options = [...screen.getByLabelText('시/도').querySelectorAll('option')]
      .filter((o) => o.getAttribute('value') !== '')
    // 저장으로 나가는 값 = 백엔드 ADDRESS_REGIONS 계약 문자열
    expect(options.map((o) => o.getAttribute('value'))).toEqual([...KOREA_REGIONS])
    // 화면 글자는 읽기 쉬운 정식 표기
    expect(options.map((o) => o.textContent)).toEqual(
      KOREA_REGIONS.map((r) => REGION_LABEL[r]),
    )
  })

  it('열자마자 외부 스크립트를 붙이지 않는다', () => {
    draw()
    expect(document.querySelector(`script[src="${SRC}"]`)).toBeNull()
  })

  it('🔴 검색 결과 → 우편번호·기본주소·시/도가 한 번에 저장된다', async () => {
    stubScript('ok', (fire) =>
      fire({ zonecode: '06236', roadAddress: '서울 강남구 테헤란로 1', jibunAddress: '', sido: '서울' }),
    )
    const { onCommit } = draw()
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }))
    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(onCommit).toHaveBeenCalledWith({
      address_zip: '06236',
      address_base: '서울 강남구 테헤란로 1',
      address_region: '서울',
    })
  })

  it('🔴 긴 표기로 와도 짧은 이름으로 접어 저장한다 (백엔드 완전 일치 계약)', async () => {
    stubScript('ok', (fire) =>
      fire({ zonecode: '24341', roadAddress: '강원 춘천시 1', jibunAddress: '', sido: '강원특별자치도' }),
    )
    const { onCommit } = draw()
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }))
    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(onCommit.mock.calls[0][0].address_region).toBe('강원')
  })

  it('목록에서 고르면 짧은 이름이 저장된다', () => {
    const { onChange, onCommit } = draw()
    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '경기' } })
    expect(onChange).toHaveBeenCalledWith({ address_region: '경기' })
    expect(onCommit).toHaveBeenCalledWith({ address_region: '경기' })
  })

  it('🔴 스크립트 로드 실패 → 안내 토스트, 칸은 그대로 살아 있다', async () => {
    stubScript('fail')
    draw()
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }))
    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(h.toastError.mock.calls[0][0]).toMatch(/직접 입력/)
    expect(screen.getByLabelText('기본 주소')).toBeEnabled()
  })

  it('직접 입력 → blur 에 그 칸만 저장된다', () => {
    const { onChange, onCommit } = draw({ ...EMPTY, address_detail: '101동 1001호' })
    fireEvent.change(screen.getByLabelText('상세 주소'), { target: { value: '102동' } })
    expect(onChange).toHaveBeenCalledWith({ address_detail: '102동' })
    fireEvent.blur(screen.getByLabelText('상세 주소'))
    expect(onCommit).toHaveBeenCalledWith({ address_detail: '101동 1001호' })
  })

  it('스크립트는 두 번 붙지 않는다', async () => {
    stubScript('ok', (fire) =>
      fire({ zonecode: '1', roadAddress: 'a', jibunAddress: '', sido: '서울' }),
    )
    const { onCommit } = draw()
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }))
    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(1)
  })
})

describe('브라우저 자동 채움 힌트', () => {
  it('🔴 네 칸 모두 표준 autocomplete 토큰을 단다 — 브라우저가 아는 값은 타이핑이 0 이 된다', () => {
    draw()
    expect(screen.getByLabelText('우편번호')).toHaveAttribute('autocomplete', 'postal-code')
    expect(screen.getByLabelText('기본 주소')).toHaveAttribute('autocomplete', 'address-line1')
    expect(screen.getByLabelText('상세 주소')).toHaveAttribute('autocomplete', 'address-line2')
    expect(screen.getByLabelText('시/도')).toHaveAttribute('autocomplete', 'address-level1')
  })

  it('우편번호는 숫자 칸이라 맞춤법 검사를 끈다', () => {
    draw()
    expect(screen.getByLabelText('우편번호')).toHaveAttribute('spellcheck', 'false')
  })
})

/**
 * 🔴 여는 동안 버튼을 `disabled` 로 바꾸면 **포커스가 body 로 튄다** — 방금 누른 자리로
 * 돌아올 수 없다. 상태는 `aria-disabled`·`aria-busy` 로 알리고 클릭만 무시한다.
 */
describe('여는 중 — 포커스를 잃지 않는다', () => {
  /** 스크립트가 붙기만 하고 load 가 안 오는 상태 = 「여는 중」에 멈춰 있다 */
  function stubPending() {
    const realAppend = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) =>
      realAppend(node)) as typeof document.head.appendChild)
  }

  it('🔴 여는 중에도 버튼이 포커스를 지킨다 (disabled 가 아니라 aria-disabled)', () => {
    stubPending()
    draw()
    const btn = screen.getByRole('button', { name: '주소 검색' })
    btn.focus()
    fireEvent.click(btn)

    const busy = screen.getByRole('button', { name: '여는 중…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).not.toBeDisabled()
    expect(busy).toHaveFocus()
  })

  it('여는 중 다시 눌러도 스크립트를 또 붙이지 않는다', () => {
    stubPending()
    draw()
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }))
    fireEvent.click(screen.getByRole('button', { name: '여는 중…' }))
    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(1)
  })

  it('평소에는 aria-disabled 가 없다', () => {
    draw()
    expect(screen.getByRole('button', { name: '주소 검색' }))
      .toHaveAttribute('aria-disabled', 'false')
  })
})
