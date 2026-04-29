import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcDday, getDdayLabel, getDdayVariant, formatDate } from './dday'

// dayjs는 시스템 시간에 의존 → 고정 날짜로 테스트
const FIXED_NOW = '2025-09-10'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${FIXED_NOW}T00:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('calcDday', () => {
  it('오늘 마감 → 0', () => {
    expect(calcDday(FIXED_NOW)).toBe(0)
  })

  it('내일 마감 → 1', () => {
    expect(calcDday('2025-09-11')).toBe(1)
  })

  it('3일 후 마감 → 3', () => {
    expect(calcDday('2025-09-13')).toBe(3)
  })

  it('어제 마감(지남) → -1', () => {
    expect(calcDday('2025-09-09')).toBe(-1)
  })

  it('7일 후 → 7', () => {
    expect(calcDday('2025-09-17')).toBe(7)
  })

  it('30일 후 → 30', () => {
    expect(calcDday('2025-10-10')).toBe(30)
  })
})

describe('getDdayLabel', () => {
  it('dday = 0 → "D-day"', () => {
    expect(getDdayLabel(0)).toBe('D-day')
  })

  it('dday = 1 → "D-1"', () => {
    expect(getDdayLabel(1)).toBe('D-1')
  })

  it('dday = 7 → "D-7"', () => {
    expect(getDdayLabel(7)).toBe('D-7')
  })

  it('dday = -1 (지남) → "D+1"', () => {
    expect(getDdayLabel(-1)).toBe('D+1')
  })

  it('dday = -14 (14일 지남) → "D+14"', () => {
    expect(getDdayLabel(-14)).toBe('D+14')
  })
})

describe('getDdayVariant', () => {
  it('dday < 0 (마감 지남) → "muted"', () => {
    expect(getDdayVariant(-1)).toBe('muted')
    expect(getDdayVariant(-100)).toBe('muted')
  })

  it('dday = 0 (오늘 마감) → "danger"', () => {
    expect(getDdayVariant(0)).toBe('danger')
  })

  it('dday = 1 → "danger"', () => {
    expect(getDdayVariant(1)).toBe('danger')
  })

  it('dday = 2 (경계값) → "danger"', () => {
    expect(getDdayVariant(2)).toBe('danger')
  })

  it('dday = 3 → "warning"', () => {
    expect(getDdayVariant(3)).toBe('warning')
  })

  it('dday = 7 (경계값) → "warning"', () => {
    expect(getDdayVariant(7)).toBe('warning')
  })

  it('dday = 8 → "info"', () => {
    expect(getDdayVariant(8)).toBe('info')
  })

  it('dday = 30 → "info"', () => {
    expect(getDdayVariant(30)).toBe('info')
  })
})

describe('formatDate', () => {
  it('날짜 문자열을 "M월 D일 (ddd)" 형식으로 반환', () => {
    // 2025-09-10 = 수요일
    const result = formatDate('2025-09-10')
    expect(result).toMatch(/9월 10일/)
  })

  it('월/일 포맷에 선행 0 없음 (1월 5일, not 01월 05일)', () => {
    const result = formatDate('2025-01-05')
    expect(result).toMatch(/1월 5일/)
    expect(result).not.toMatch(/01월/)
    expect(result).not.toMatch(/05일/)
  })
})
