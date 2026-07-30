import { describe, expect, it } from 'vitest'
import { visitDetailLine, visitSummary, type VisitStats } from './visitStats'

/**
 * 방문 이력 표시.
 *
 * 🔴 이 파일이 존재하는 이유는 1번 케이스다 — `visitStats` 가 `undefined` 인데 바로
 * `.totalDays` 를 읽어 페이지 전체가 터지는 코드를 실제로 냈다. tsc·lint·전체 테스트를
 * 다 통과했고, **백엔드가 항상 응답을 주는 로컬에선 재현되지 않는다.**
 * 프론트(Vercel)가 백엔드(Railway)보다 먼저 뜨는 배포 창에서만 터진다.
 *
 * 경우의 수:
 *  1. undefined (백엔드 미배포) → '-' · sub 없음   ← 크래시 방어
 *  2. 0회 방문 → '0일' · '기록 없음'
 *  3. 정상 → 'N일' · '최근 30일 중 M일'
 *  4. 과거엔 왔는데 최근 30일 0 → '최근 30일 중 0일' (전부 최근인 경우와 구분)
 *  5. 전부 최근 (total === last30)
 *  6. 상세 — 집계 시작일 부착
 *  7. 상세 — firstVisitDate 만 null (응답 이상) → 시작일 없이 일수만
 */
function v(over: Partial<VisitStats> = {}): VisitStats {
  return { totalDays: 24, last30Days: 18, firstVisitDate: '2026-07-07', ...over }
}

describe('visitSummary — 미니 stat', () => {
  it('1. 🔴 undefined → 던지지 않고 "-" · sub 없음 (모름 ≠ 0회)', () => {
    expect(() => visitSummary(undefined)).not.toThrow()
    expect(visitSummary(undefined)).toEqual({ value: '-' })
    // 0 으로 폴백하면 "한 번도 안 왔다" 는 거짓 주장이 된다
    expect(visitSummary(undefined).value).not.toBe('0일')
    expect(visitSummary(undefined).sub).toBeUndefined()
  })

  it('2. 0회 방문 → "0일" · "기록 없음" (undefined 와 다른 표시)', () => {
    expect(visitSummary(v({ totalDays: 0, last30Days: 0 }))).toEqual({
      value: '0일',
      sub: '기록 없음',
    })
  })

  it('3. 정상 → 총 일수 + 최근 30일', () => {
    expect(visitSummary(v())).toEqual({
      value: '24일',
      sub: '최근 30일 중 18일',
    })
  })

  it('4. 과거엔 왔지만 최근 30일 0 → 이탈 신호가 그대로 보인다', () => {
    expect(visitSummary(v({ totalDays: 24, last30Days: 0 })).sub).toBe(
      '최근 30일 중 0일',
    )
  })

  it('5. 전부 최근 (total === last30)', () => {
    expect(visitSummary(v({ totalDays: 12, last30Days: 12 }))).toEqual({
      value: '12일',
      sub: '최근 30일 중 12일',
    })
  })
})

describe('visitDetailLine — 상세 Row', () => {
  it('1. 🔴 undefined → 던지지 않고 "-"', () => {
    expect(() => visitDetailLine(undefined)).not.toThrow()
    expect(visitDetailLine(undefined)).toBe('-')
  })

  it('2. 0회 방문 → "기록 없음"', () => {
    expect(visitDetailLine(v({ totalDays: 0, firstVisitDate: null }))).toBe(
      '기록 없음',
    )
  })

  it('6. 집계 시작일을 반드시 붙인다 (가입 후 N일로 오해 방지)', () => {
    const line = visitDetailLine(v({ totalDays: 24, firstVisitDate: '2026-07-07' }))
    expect(line).toContain('24일')
    expect(line).toContain('부터 집계')
    expect(line).toContain(new Date('2026-07-07').toLocaleDateString('ko-KR'))
  })

  it('7. firstVisitDate 만 null (응답 이상) → 시작일 없이 일수만', () => {
    // MIN(visit_date) 는 행이 있으면 null 이 아니지만 응답을 믿지 않는다.
    // 여기서 new Date(null) 을 타면 "1970. 1. 1.부터 집계" 가 찍힌다
    const line = visitDetailLine(v({ totalDays: 5, firstVisitDate: null }))
    expect(line).toBe('5일')
    expect(line).not.toContain('1970')
  })
})
