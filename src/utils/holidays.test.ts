/**
 * A6 — 공휴일 데이터 시나리오:
 * 1. 대표 공휴일 조회 (신정·설날·추석)
 * 2. 대체공휴일 포함 (3·1절 2026-03-02 · 성탄 2027-12-27)
 * 3. 2026 신규 재지정 제헌절 + 지방선거일
 * 4. 평일·주말 비공휴일 → null
 * 5. 근로자의 날(법정 공휴일 아님) 미포함
 * 6. 설/추석 대체 규칙 — 2026 추석 토요일 겹침은 대체 없음 / 2027 설 일요일 겹침은 2/9 대체
 */
import { describe, expect, it } from 'vitest'
import { getHolidayName, isHoliday } from './holidays'

describe('holidays', () => {
  it('1) 대표 공휴일', () => {
    expect(getHolidayName('2026-01-01')).toBe('신정')
    expect(getHolidayName('2026-02-17')).toBe('설날')
    expect(getHolidayName('2026-09-25')).toBe('추석')
  })

  it('2) 대체공휴일', () => {
    expect(getHolidayName('2026-03-02')).toBe('대체공휴일')
    expect(getHolidayName('2027-12-27')).toBe('대체공휴일')
  })

  it('3) 2026 제헌절 재지정 + 지방선거일', () => {
    expect(getHolidayName('2026-07-17')).toBe('제헌절')
    expect(getHolidayName('2026-06-03')).toBe('지방선거일')
  })

  it('4) 비공휴일 → null', () => {
    expect(getHolidayName('2026-07-07')).toBeNull()
    expect(isHoliday('2026-07-07')).toBe(false)
  })

  it('5) 근로자의 날 미포함 (법정 공휴일 아님)', () => {
    expect(getHolidayName('2026-05-01')).toBeNull()
  })

  it('6) 설/추석 대체 규칙 — 토요일 겹침 대체 없음 · 일요일 겹침 대체 있음', () => {
    // 2026 추석 연휴 마지막 날이 토요일(9/26) → 9/28 대체 없음
    expect(getHolidayName('2026-09-28')).toBeNull()
    // 2027 설날 당일이 일요일(2/7) → 2/9 대체
    expect(getHolidayName('2027-02-09')).toBe('대체공휴일')
  })
})
