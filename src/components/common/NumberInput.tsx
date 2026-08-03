import { useEffect, useState } from 'react'

/**
 * 숫자 입력 — **직접 타이핑**을 위해 raw 문자열(draft)을 따로 들고 있는다.
 *
 * 🔴 **왜 필요한가** (2026-08-03 CEO 발견: "화살표는 되는데 타이핑이 어색하다").
 *
 * 흔한 관용구 `onChange={(e) => setX(Number(e.target.value))}` 는 얼핏 맞아 보이지만,
 * HTML 명세상 `<input type="number">` 의 `.value` 게터는 **유효한 부동소수점 문자열이
 * 아니면 `""` 를 돌려준다**(값 정제 알고리즘). `Number("") === 0` 이라
 * **입력이 미완성인 모든 순간이 0 으로 확정**됐다:
 *
 * | 사용자 동작 | `e.target.value` | 화면 결과 |
 * |---|---|---|
 * | 전체 삭제 | `""` | `0` — **빈칸을 유지할 수 없다** |
 * | `2.` (소수 입력 중) | `""` | `0` — **타이핑이 파괴된다** |
 * | `-` (음수 시작) | `""` | `0` |
 *
 * 화살표(스텝퍼)는 항상 완성된 숫자만 만들어 이 경로를 안 타므로 **정상으로 보였다.**
 * "일부 입력 방식에서만" 깨지는 형태라 오래 살아남았다.
 *
 * **해결의 핵심은 `""` 를 0 으로 바꾸지 않는 것이다.** draft 를 `""` 로 두면 React 가 보는
 * value(`""`)와 DOM 게터(`""`)가 같아 **React 가 DOM 을 건드리지 않고**, 그래서 브라우저
 * 내부의 raw `"2."` 가 살아남아 다음 글자를 이어 칠 수 있다.
 * `type="number"` 와 스텝퍼는 그대로 유지된다.
 *
 * 🔴 **클램프는 타이핑 중이 아니라 blur 에서 한다.** `onChange` 에서 `Math.max(10, ...)`
 * 처럼 걸면 하한 미만으로 시작하는 숫자를 **아예 칠 수 없다** — 월 한도에 50 을 넣으려고
 * `5` 를 치는 순간 10 으로 덮여 화면이 `10` 이 되고, 다음 `0` 은 `100` 이 된다.
 */
export function NumberInput({
  value,
  onValueChange,
  onBlur,
  min,
  max,
  ...rest
}: {
  value: number
  onValueChange: (n: number) => void
  min?: number
  max?: number
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
>) {
  const [draft, setDraft] = useState(() => String(value))

  // 서버에서 값이 새로 내려왔을 때만 draft 를 맞춘다.
  // `Number(draft) !== value` 조건이 없으면 "012" 같은 입력 중간 상태를 매번 덮어써 커서가 튄다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        // 파싱되는 값만 부모로 올린다 — 미완성 입력은 부모 state 를 오염시키지 않는다
        if (raw !== '' && Number.isFinite(Number(raw))) onValueChange(Number(raw))
      }}
      onBlur={(e) => {
        const n = Number(e.target.value)
        if (e.target.value === '' || !Number.isFinite(n)) {
          // 빈칸·미완성인 채로 떠나면 마지막 유효값으로 (0 이 저장되는 사고 방지)
          setDraft(String(value))
        } else {
          // 범위 밖이면 여기서만 끌어당긴다 — 서버 @Min/@Max 와 같은 값이라 400 을 예방한다
          const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
          if (clamped !== n) {
            setDraft(String(clamped))
            onValueChange(clamped)
          }
        }
        onBlur?.(e)
      }}
    />
  )
}
