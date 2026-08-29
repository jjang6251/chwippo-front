/**
 * 공고 일정 날짜 표시.
 *
 * ## 케이스 목록
 * 1. 🔴 **날짜만** → 날짜(+요일)까지만 — 없는 시각을 만들지 않는다
 * 2. 시각이 있으면 시각까지
 * 3. 잘못된 값 → `null` (호출부가 「—」)
 * 4. 🔴 타임존 없는 값도 **KST 로** 읽는다 (기기 TZ·CI `TZ=UTC` 무관)
 * 5. offset·Z 가 붙은 값은 그대로 KST 로 환산
 * 6. 자정 정각은 시각을 안 적는다 (「미정」과 구분이 안 되는 값)
 */
import { describe, expect, it } from 'vitest'
import { formatPostingDate } from './postingDates'

describe('formatPostingDate', () => {
  it('1) 🔴 날짜만이면 시각을 만들어내지 않는다', () => {
    // UTC 자정 해석으로 「09:00」이 붙던 자리 (2026-08-29 실측)
    expect(formatPostingDate('2026-09-22')).toBe('9월 22일 (화)')
    expect(formatPostingDate('2026-01-01')).toBe('1월 1일 (목)')
  })

  it('2·4) 시각이 있으면 시각까지 — 타임존이 없어도 KST', () => {
    expect(formatPostingDate('2026-10-30T14:00')).toBe('10월 30일 (금) 14:00')
    expect(formatPostingDate('2026-10-30T14:00:00')).toBe('10월 30일 (금) 14:00')
  })

  it('3) 읽을 수 없는 값은 null', () => {
    for (const bad of [null, undefined, '', 42, {}, 'not-a-date', '2026-13-45']) {
      expect(formatPostingDate(bad)).toBeNull()
    }
  })

  it('5) offset·Z 가 붙은 값은 KST 로 환산한다', () => {
    expect(formatPostingDate('2026-10-30T14:00:00+09:00')).toBe('10월 30일 (금) 14:00')
    // 2026-09-21T15:30Z = KST 9/22 00:30
    expect(formatPostingDate('2026-09-21T15:30:00Z')).toBe('9월 22일 (화) 00:30')
  })

  it('6) 자정 정각은 시각을 안 적는다', () => {
    expect(formatPostingDate('2026-09-22T00:00:00+09:00')).toBe('9월 22일 (화)')
  })
})
