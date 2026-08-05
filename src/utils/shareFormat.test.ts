import { describe, it, expect } from 'vitest'
import { formatShare, MIN_DENOMINATOR_FOR_PERCENT } from './shareFormat'

/**
 * 🔴 이 규칙이 깨지면 **소표본 백분율이 조용히 돌아온다** — `1명 중 1명 = 100%` 같은 표기가
 * 제품 판단 화면에 다시 뜬다. 화면은 멀쩡해 보이므로 눈으로는 못 잡는다.
 */
describe('formatShare', () => {
  it('분모 0 → —', () => {
    expect(formatShare(0, 0)).toBe('—')
    expect(formatShare(5, 0)).toBe('—')
  })

  it('분모가 음수·NaN 이어도 죽지 않는다', () => {
    expect(formatShare(1, -3)).toBe('—')
    expect(formatShare(1, Number.NaN)).toBe('—')
    expect(formatShare(1, Number.POSITIVE_INFINITY)).toBe('—')
  })

  describe(`소표본 (분모 < ${MIN_DENOMINATOR_FOR_PERCENT})`, () => {
    it('% 대신 "N명 중 M명"', () => {
      expect(formatShare(1, 3)).toBe('3명 중 1명')
      expect(formatShare(2, 9)).toBe('9명 중 2명')
    })

    // 🔴 이게 이 규칙의 존재 이유 — 1/1 을 100% 로 쓰면 안 된다
    it('1명 중 1명을 100% 로 쓰지 않는다', () => {
      expect(formatShare(1, 1)).toBe('1명 중 1명')
      expect(formatShare(1, 1)).not.toContain('%')
    })

    it('compact 는 좁은 셀용 축약', () => {
      expect(formatShare(1, 3, { compact: true })).toBe('1/3')
      expect(formatShare(0, 5, { compact: true })).toBe('0/5')
    })

    it('단위를 바꿀 수 있다', () => {
      expect(formatShare(2, 7, { unit: '건' })).toBe('7건 중 2건')
    })
  })

  describe(`충분한 표본 (분모 ≥ ${MIN_DENOMINATOR_FOR_PERCENT})`, () => {
    it('% 와 실수를 함께 보여준다', () => {
      expect(formatShare(12, 36)).toBe('33% (12/36)')
    })

    it('compact 는 % 만', () => {
      expect(formatShare(12, 36, { compact: true })).toBe('33%')
    })
  })

  // 임계값 경계 — 여기가 흔들리면 규칙이 아니라 취향이 된다
  it.each([
    [MIN_DENOMINATOR_FOR_PERCENT - 1, false],
    [MIN_DENOMINATOR_FOR_PERCENT, true],
    [MIN_DENOMINATOR_FOR_PERCENT + 1, true],
  ])('분모 %s → %% 사용 %s', (denominator, usesPercent) => {
    expect(formatShare(1, denominator).includes('%')).toBe(usesPercent)
  })

  it('분자가 분모보다 커도 죽지 않는다 (데이터 이상 방어)', () => {
    expect(formatShare(5, 3)).toBe('3명 중 5명')
    expect(formatShare(50, 30)).toBe('167% (50/30)')
  })

  it('소수·음수 분자는 정수로 다듬는다', () => {
    expect(formatShare(2.7, 9)).toBe('9명 중 2명')
    expect(formatShare(-1, 9)).toBe('9명 중 0명')
  })
})
