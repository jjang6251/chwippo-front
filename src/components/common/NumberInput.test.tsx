/**
 * 🔴 **"화살표는 되는데 직접 타이핑이 안 된다"** (2026-08-03 CEO 발견).
 *
 * `onChange={(e) => setX(Number(e.target.value))}` 라는 흔한 관용구가 원인이었다.
 * `<input type="number">` 의 `.value` 는 **유효한 숫자 문자열이 아니면 `""`** 를 돌려주고
 * (HTML 값 정제 알고리즘), `Number("") === 0` 이라 **입력이 미완성인 모든 순간이 0 으로
 * 확정**된다. 스텝퍼는 항상 완성된 숫자만 만들어 이 경로를 안 타므로 **정상으로 보인다.**
 *
 * 같은 관용구가 admin 화면 3곳(Monitoring 13필드 · AiQuotas 3필드)에 퍼져 있었다.
 * 그래서 방어선을 각 화면이 아니라 **이 컴포넌트**에 둔다.
 *
 * 시나리오:
 * - 타이핑: 전체 삭제 후 빈칸 유지 · 지우고 새 숫자 · 미완성 입력이 부모로 안 새는가
 * - blur: 빈칸이면 직전 값 복구 · 범위 밖이면 클램프
 * - 클램프 시점: **타이핑 중이 아니라 blur** (하한 미만으로 시작하는 숫자를 칠 수 있어야)
 * - 서버 동기화: 외부 value 변경이 draft 에 반영
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberInput } from './NumberInput'

/** 부모 state 를 실제로 들고 있는 하네스 — 제어 컴포넌트라 부모 없이는 의미가 없다 */
function Harness({
  initial = 3,
  min,
  max,
  onChange,
}: {
  initial?: number
  min?: number
  max?: number
  onChange?: (n: number) => void
}) {
  const [v, setV] = useState(initial)
  return (
    <>
      <NumberInput
        aria-label="값"
        min={min}
        max={max}
        value={v}
        onValueChange={(n) => {
          setV(n)
          onChange?.(n)
        }}
      />
      <span data-testid="parent">{v}</span>
    </>
  )
}

const input = () => screen.getByLabelText('값') as HTMLInputElement
const parent = () => screen.getByTestId('parent').textContent

describe('NumberInput', () => {
  describe('타이핑', () => {
    it('전체를 지우면 빈칸이 유지된다 (0 으로 튀지 않는다)', async () => {
      render(<Harness />)
      await userEvent.clear(input())
      expect(input().value).toBe('')
    })

    /** 🔴 빈칸이 0 으로 올라가면 임계값·한도가 조용히 0 이 된다 */
    it('빈칸은 부모 state 로 올라가지 않는다', async () => {
      render(<Harness initial={3} />)
      await userEvent.clear(input())
      expect(parent()).toBe('3')
    })

    it('지우고 새 숫자를 치면 그대로 들어간다', async () => {
      render(<Harness />)
      await userEvent.clear(input())
      await userEvent.type(input(), '12')
      expect(input().value).toBe('12')
      expect(parent()).toBe('12')
    })

    /**
     * 🔴 **클램프를 onChange 에서 하면 이 케이스가 깨진다.**
     * 월 한도(하한 10)에 50 을 넣으려고 `5` 를 치는 순간 10 으로 덮여 화면이 `10` 이 되고,
     * 다음 `0` 은 `100` 이 된다 — **50 을 입력할 방법이 없다.**
     */
    it('하한 미만으로 시작하는 숫자도 칠 수 있다 (타이핑 중 클램프 금지)', async () => {
      render(<Harness initial={30} min={10} max={100000} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '50')
      expect(input().value).toBe('50')
    })
  })

  describe('blur', () => {
    it('빈칸인 채 떠나면 직전 값으로 복구된다', async () => {
      render(<Harness initial={7} />)
      await userEvent.clear(input())
      fireEvent.blur(input())
      expect(input().value).toBe('7')
    })

    it('하한 미만이면 하한으로 끌어당긴다 (서버 @Min 400 예방)', async () => {
      const onChange = vi.fn()
      render(<Harness initial={30} min={10} max={100000} onChange={onChange} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '5')
      fireEvent.blur(input())
      expect(input().value).toBe('10')
      expect(parent()).toBe('10')
    })

    it('상한 초과면 상한으로 끌어당긴다', async () => {
      render(<Harness initial={30} min={0} max={100} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '999')
      fireEvent.blur(input())
      expect(input().value).toBe('100')
    })

    it('범위 안이면 blur 가 값을 건드리지 않는다', async () => {
      render(<Harness initial={30} min={10} max={100} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '55')
      fireEvent.blur(input())
      expect(input().value).toBe('55')
    })

    /** min/max 를 안 주는 호출부도 있다 — 그때 클램프가 값을 삼키면 안 된다 */
    it('min·max 가 없으면 클램프하지 않는다', async () => {
      render(<Harness initial={3} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '99999')
      fireEvent.blur(input())
      expect(input().value).toBe('99999')
    })
  })

  describe('외부 value 동기화', () => {
    it('서버 값이 바뀌면 입력창에 반영된다', () => {
      const { rerender } = render(
        <NumberInput aria-label="값" value={3} onValueChange={() => {}} />,
      )
      expect(input().value).toBe('3')
      rerender(<NumberInput aria-label="값" value={7} onValueChange={() => {}} />)
      expect(input().value).toBe('7')
    })

    /**
     * 선행 0 처럼 **같은 숫자를 뜻하는 중간 상태**를 외부 동기화가 매번 덮으면 커서가 튄다.
     * 그래서 구현은 `Number(draft) !== value` 일 때만 맞춘다.
     *
     * ⚠️ **jsdom 한계** — 여기서 단언할 수 있는 건 "부모 값이 정상" 까지다. jsdom 은
     * `type="number"` 의 표시 문자열을 실제 브라우저와 다르게 정규화해(`"012"` → `"12"`)
     * draft 보존 자체를 재현하지 못한다. 동기화 가드 제거는 **뮤테이션 테스트로 확인했다**
     * (제거 시 "서버 값이 바뀌면 반영된다" 가 실패).
     */
    it('선행 0 을 쳐도 부모 값은 정상이다', async () => {
      render(<Harness initial={3} />)
      await userEvent.clear(input())
      await userEvent.type(input(), '012')
      expect(parent()).toBe('12')
    })
  })

  it('스텝퍼가 살아 있도록 type=number 를 유지한다', () => {
    render(<Harness min={0} max={10} />)
    expect(input().type).toBe('number')
    expect(input()).toHaveAttribute('min', '0')
    expect(input()).toHaveAttribute('max', '10')
  })
})
