import { describe, expect, it } from 'vitest'
import {
  FINE_COMPANIES,
  SERIES_ONBOARDING,
  getRewardCompanies,
  getSeriesCompanies,
  getSeriesLabel,
  getSeriesOnboarding,
  hasCompanyReward,
} from './seriesOnboarding'
import { JOB_FINE_GROUPS, JOB_SERIES } from '@/utils/jobRole'

/**
 * 온보딩 즉시 보상 사전.
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 🔴 14계열 전부 키가 있다 — 하나라도 비면 그 계열 사용자는 보상이 **빈손**이다
 *  2. 질문은 정확히 3개 · 공백 아님 · 물음표로 끝난다
 *  3. 회사는 1~6개 · 중복 없음 · 공백 아님
 *  4. 🔴 모든 계열이 3개 이상 → 현재는 2단이 전 계열에서 나간다 (숨김 규칙은 살아 있다)
 *  5. `hasCompanyReward` — 하한 3의 경계
 *  6. 모르는 계열 id · null 에 던지지 않는다 (렌더 중 호출)
 */
describe('SERIES_ONBOARDING', () => {
  const ids = JOB_SERIES.map((s) => s.id)

  it('1) 🔴 14계열 전부 키가 있다 — 남는 키도 없다', () => {
    expect(Object.keys(SERIES_ONBOARDING).sort()).toEqual([...ids].sort())
    expect(ids).toHaveLength(14)
  })

  it('2) 질문은 정확히 3개 · 공백 아님 · 물음표로 끝난다', () => {
    for (const id of ids) {
      const { questions } = SERIES_ONBOARDING[id as keyof typeof SERIES_ONBOARDING]
      expect(questions).toHaveLength(3)
      for (const q of questions) {
        expect(q.trim().length).toBeGreaterThan(0)
        // 「면접에선 이런 질문이 나와요」 밑에 붙는 줄이라 질문 형태를 못 박는다
        expect(q.endsWith('?') || q.endsWith('요.')).toBe(true)
      }
      // 같은 계열 안에서 같은 질문이 두 번 나오면 「예시가 3개」가 거짓말이 된다
      expect(new Set(questions).size).toBe(3)
    }
  })

  it('3) 회사는 1~6개 · 중복 없음 · 공백 아님', () => {
    for (const id of ids) {
      const { companies } = SERIES_ONBOARDING[id as keyof typeof SERIES_ONBOARDING]
      expect(companies.length).toBeGreaterThan(0)
      expect(companies.length).toBeLessThanOrEqual(6)
      expect(new Set(companies).size).toBe(companies.length)
      for (const c of companies) {
        expect(c).toBe(c.trim())
        expect(c.length).toBeGreaterThan(0)
      }
    }
  })

  it('4) 🔴 현재는 14계열 전부 3개 이상 — 2단이 전 계열에서 나간다', () => {
    for (const id of ids) {
      expect(hasCompanyReward(id)).toBe(true)
    }
    // education·agriculture 는 4개로 하한 바로 위다 — 시드가 줄면 여기가 먼저 깨진다
    expect(getSeriesCompanies('education')).toHaveLength(4)
    expect(getSeriesCompanies('agriculture')).toHaveLength(4)
  })

  it('5) hasCompanyReward — 하한 3의 경계 (2개면 숨긴다)', () => {
    // 규칙 자체를 재는 케이스. 사전이 전부 3개 이상이라 실물로는 못 재므로
    // 하한을 넘지 못하는 입력(모르는 계열 = 0개)으로 「숨긴다」 쪽을 고정한다.
    expect(hasCompanyReward('no-such-series')).toBe(false)
    expect(hasCompanyReward(null)).toBe(false)
    expect(hasCompanyReward(undefined)).toBe(false)
  })

  it('6) 모르는 계열·null 에 던지지 않는다 (렌더 중 호출)', () => {
    expect(getSeriesOnboarding('no-such-series')).toBeNull()
    expect(getSeriesOnboarding(null)).toBeNull()
    expect(getSeriesCompanies('no-such-series')).toEqual([])
    expect(getSeriesLabel('no-such-series')).toBeNull()
    // 프로토타입 키로도 안 새어야 한다 (Object.hasOwnProperty 가드)
    expect(getSeriesOnboarding('constructor')).toBeNull()
  })

  it('계열 라벨은 JOB_SERIES 단일 소스에서 온다', () => {
    expect(getSeriesLabel('health')).toBe('의료·보건·복지')
    expect(getSeriesLabel('it')).toBe('IT·개발')
  })
})

/**
 * 세밀 그룹 전용 회사 목록 (A안 · CEO 2026-08-28).
 *
 * ## 시나리오
 *  7. 🔴 키는 전부 `JOB_FINE_GROUPS` id — 오타 난 키는 조용히 계열 fallback 으로 빠져 안 걸린다
 *  8. 각 목록 ≤6 · 중복 없음 · 공백 아님
 *  9. 🔴 빈 배열 그룹은 2단을 숨긴다 (계열 회사로 대신 채우지 않는다)
 * 10. 전용 목록이 있으면 그것, 없으면 계열 목록
 * 11. 승무원 → 항공사 목록 · 이마트는 없다 (이 사고가 A안의 출발점)
 */
describe('FINE_COMPANIES — 세밀 그룹 전용 목록', () => {
  const fineIds = JOB_FINE_GROUPS.map((g) => g.id)

  it('7) 🔴 키는 전부 JOB_FINE_GROUPS id 다', () => {
    for (const key of Object.keys(FINE_COMPANIES)) {
      expect(fineIds).toContain(key)
    }
  })

  it('8) 각 목록 ≤6 · 중복 없음 · 공백 아님', () => {
    for (const list of Object.values(FINE_COMPANIES)) {
      expect(list.length).toBeLessThanOrEqual(6)
      expect(new Set(list).size).toBe(list.length)
      for (const c of list) {
        expect(c).toBe(c.trim())
        expect(c.length).toBeGreaterThan(0)
      }
    }
  })

  it('9) 🔴 빈 배열 그룹은 2단을 숨긴다 — 계열 회사로 대신 채우지 않는다', () => {
    for (const fineId of ['public-safety', 'public-military', 'health-care', 'media-sports']) {
      expect(FINE_COMPANIES[fineId]).toEqual([])
      expect(getRewardCompanies('public', fineId)).toEqual([])
      expect(hasCompanyReward('public', fineId)).toBe(false)
    }
    // 같은 계열이라도 세밀 그룹이 없으면 계열 목록으로 2단이 나간다
    expect(hasCompanyReward('public', null)).toBe(true)
  })

  it('10) 전용 목록이 있으면 그것, 없으면 계열 목록', () => {
    expect(getRewardCompanies('finance', 'finance-public')).toContain('한국은행')
    expect(getRewardCompanies('finance', 'finance-general')).toEqual(getSeriesCompanies('finance'))
    expect(getRewardCompanies('it', null)).toEqual(getSeriesCompanies('it'))
    expect(getRewardCompanies('it', 'no-such-fine')).toEqual(getSeriesCompanies('it'))
    // 프로토타입 키로 안 샌다
    expect(getRewardCompanies('it', 'constructor')).toEqual(getSeriesCompanies('it'))
  })

  it('11) 승무원 → 항공사 목록, 이마트는 없다', () => {
    const list = getRewardCompanies('sales', 'sales-travel')
    expect(list).toContain('대한항공')
    expect(list).toContain('아시아나항공')
    expect(list).not.toContain('이마트')
    expect(hasCompanyReward('sales', 'sales-travel')).toBe(true)
  })
})
