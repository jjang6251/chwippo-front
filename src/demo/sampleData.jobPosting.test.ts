/**
 * card-detail-remodel — 데모 카드 공고 요건 예시 데이터 검증.
 * 모든 데모 지원 카드가 유효한 jobPosting 형상을 갖고, 카드별로 차별화(동일 복붙 아님)됐는지 박제.
 */
import { describe, it, expect } from 'vitest'
import { DEMO_APPLICATIONS } from './sampleData'
import { hasJobPostingData, countJobPostingItems } from '@/api/jobPosting'

describe('sampleData — 데모 카드 공고 요건', () => {
  it('모든 데모 지원 카드(11)에 jobPosting 존재 + jobPostingStatus null + 표시 데이터 있음', () => {
    expect(DEMO_APPLICATIONS.length).toBe(11)
    for (const app of DEMO_APPLICATIONS) {
      expect(app.jobPosting, `${app.companyName} jobPosting`).toBeTruthy()
      expect(app.jobPostingStatus ?? null).toBeNull()
      expect(hasJobPostingData(app.jobPosting)).toBe(true)
    }
  })

  it('각 카드 요건 형상 유효 (배열 타입 · parsedAt ISO · 표시 항목 ≥ 1)', () => {
    for (const app of DEMO_APPLICATIONS) {
      const jp = app.jobPosting!
      for (const key of ['requirements', 'preferred', 'techStack', 'qualifications', 'keywords'] as const) {
        expect(Array.isArray(jp[key]), `${app.companyName}.${key}`).toBe(true)
      }
      expect(typeof jp.responsibilities === 'string' || jp.responsibilities === null).toBe(true)
      expect(Number.isNaN(Date.parse(jp.parsedAt)), `${app.companyName}.parsedAt`).toBe(false)
      expect(countJobPostingItems(jp)).toBeGreaterThan(0)
    }
  })

  it('대표 카드 형상 — 카카오(서버)·삼성(임베디드)·KB(금융) 직군별 차별화', () => {
    const jp = (id: string) => DEMO_APPLICATIONS.find((a) => a.id === id)!.jobPosting!
    expect(jp('demo-a1').techStack).toContain('Java')
    expect(jp('demo-a3').techStack).toContain('C++')
    expect(jp('demo-a8').techStack).toEqual([]) // 금융영업 = 기술스택 없음
    expect(jp('demo-a8').qualifications).toContain('은행FP(AFPK)')
    expect(jp('demo-a9').keywords).toContain('NCS') // 공기업 사무
  })

  it('전 카드 담당업무·키워드가 모두 유일 (동일 복붙 금지)', () => {
    const resps = DEMO_APPLICATIONS.map((a) => a.jobPosting!.responsibilities)
    expect(new Set(resps).size).toBe(resps.length)
    const kwSigs = DEMO_APPLICATIONS.map((a) => a.jobPosting!.keywords.join('|'))
    expect(new Set(kwSigs).size).toBe(kwSigs.length)
  })
})
