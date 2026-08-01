/**
 * D0 (2026-08-01) — 입력란 붙여넣기 잘림 판정.
 *
 * `maxLength` 는 붙여넣기 초과분을 **말없이 자른다**. 사용자가 자소서 전문을 붙여넣었는데
 * 뒷부분이 사라진 걸 모르면 AI 결과가 왜 이상한지 알 수 없다 — 이번 사고와 같은
 * "조용한 데이터 손실" 유형이라 경계값까지 고정한다.
 */
import { describe, expect, it } from 'vitest'
import { isNearLimit, willPasteTruncate } from './inputLimit'

const MAX = 5000

describe('willPasteTruncate', () => {
  describe('선택 영역 없이 붙여넣기 (커서 위치에 삽입)', () => {
    it('한도 미만이면 잘리지 않는다', () => {
      expect(willPasteTruncate(1000, 0, 3999, MAX)).toBe(false)
    })

    it('정확히 한도면 잘리지 않는다 (경계 — 한도는 허용값)', () => {
      expect(willPasteTruncate(1000, 0, 4000, MAX)).toBe(false)
    })

    it('한도를 1자 넘으면 잘린다', () => {
      expect(willPasteTruncate(1000, 0, 4001, MAX)).toBe(true)
    })

    it('빈 입력에 한도 초과 텍스트를 붙여넣으면 잘린다 (자소서 전문 붙여넣기)', () => {
      expect(willPasteTruncate(0, 0, 6000, MAX)).toBe(true)
    })

    it('빈 입력에 한도 이하를 붙여넣으면 통과', () => {
      expect(willPasteTruncate(0, 0, 5000, MAX)).toBe(false)
    })
  })

  describe('선택 영역을 대체하는 붙여넣기 — 대체분만큼 여유가 생긴다', () => {
    it('전체 선택 후 붙여넣기는 기존 길이를 상쇄한다', () => {
      // 5000자 전체 선택 → 4000자로 교체 = 최종 4000자
      expect(willPasteTruncate(5000, 5000, 4000, MAX)).toBe(false)
    })

    it('일부 선택 대체가 한도를 넘으면 잘린다', () => {
      // 4900 - 100 + 300 = 5100
      expect(willPasteTruncate(4900, 100, 300, MAX)).toBe(true)
    })

    it('일부 선택 대체가 한도 안이면 통과', () => {
      // 4900 - 500 + 300 = 4700
      expect(willPasteTruncate(4900, 500, 300, MAX)).toBe(false)
    })
  })

  describe('경계·엣지', () => {
    it('빈 텍스트 붙여넣기는 잘리지 않는다', () => {
      expect(willPasteTruncate(5000, 0, 0, MAX)).toBe(false)
    })

    it('이미 한도인 상태에서 1자 붙여넣으면 잘린다', () => {
      expect(willPasteTruncate(5000, 0, 1, MAX)).toBe(true)
    })
  })
})

describe('isNearLimit', () => {
  it('90% 미만이면 false', () => {
    expect(isNearLimit(4499, MAX)).toBe(false)
  })

  it('정확히 90%면 true (경계)', () => {
    expect(isNearLimit(4500, MAX)).toBe(true)
  })

  it('한도를 채우면 true', () => {
    expect(isNearLimit(5000, MAX)).toBe(true)
  })

  it('빈 입력은 false', () => {
    expect(isNearLimit(0, MAX)).toBe(false)
  })
})
