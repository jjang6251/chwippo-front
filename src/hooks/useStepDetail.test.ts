/**
 * 서버 문구 추출 — 저장 실패를 「무엇을 줄여야 하는지」로 바꿔 주는 유일한 통로.
 *
 * 시나리오
 *   1. message 가 문자열 → 그대로
 *   2. message 가 배열(Nest ValidationPipe) → 첫 항목
 *   3. 공백뿐인 문구 → null (빈 토스트를 띄우지 않는다)
 *   4. 응답에 message 가 없음 / 응답 자체가 없음(네트워크·5xx) → null
 *   5. `serverMessage` 는 null 일 때만 fallback 을 쓴다
 */
import { describe, expect, it } from 'vitest'
import { serverMessage, serverMessageOrNull } from './useStepDetail'

const OVER = '노트는 100,000자까지 저장할 수 있어요.'
const err = (message: unknown) => ({ response: { data: { message } } })

describe('serverMessageOrNull', () => {
  it('1 문자열 message → 그대로', () => {
    expect(serverMessageOrNull(err(OVER))).toBe(OVER)
  })

  it('2 배열 message → 첫 항목', () => {
    expect(serverMessageOrNull(err([OVER, '이름은 50자까지예요.']))).toBe(OVER)
  })

  it('3 공백뿐인 문구 → null', () => {
    expect(serverMessageOrNull(err('   '))).toBeNull()
    expect(serverMessageOrNull(err(['  ']))).toBeNull()
  })

  it('4 message 가 없거나 응답 자체가 없으면 null', () => {
    expect(serverMessageOrNull(err(undefined))).toBeNull()
    expect(serverMessageOrNull(err(42))).toBeNull()
    expect(serverMessageOrNull(new Error('Network Error'))).toBeNull()
    expect(serverMessageOrNull(undefined)).toBeNull()
    expect(serverMessageOrNull(null)).toBeNull()
  })
})

describe('serverMessage', () => {
  it('5 서버 문구가 있으면 그것, 없으면 fallback', () => {
    expect(serverMessage(err(OVER), '저장하지 못했어요.')).toBe(OVER)
    expect(serverMessage(new Error('Network Error'), '저장하지 못했어요.')).toBe(
      '저장하지 못했어요.',
    )
  })
})
