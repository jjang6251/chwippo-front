/**
 * 🔴 **타입이 「항상 있다」고 말하는데 런타임에 없을 수 있는 상태** — 2026-08-01 자소서 점검
 * 크래시의 근본 원인이었다(`CoverletterFeedback.strengths`). `JobPosting` 도 같은 모양이다:
 * 배열 필드가 non-optional 로 선언돼 있지만 실제 값은 **LLM 파싱 결과 JSONB** 다.
 *
 * 지금 백엔드는 두 쓰기 경로 모두 정규화하지만, 프론트는 **서버를 신뢰하지 않는다**.
 * `as` 단언은 컴파일러만 통과시킬 뿐 아무것도 보증하지 않는다 — 그래서 읽기 경계에서 한 번
 * 정규화하고, 그게 실제로 크래시를 막는지 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { normalizeJobPosting, hasJobPostingData, countJobPostingItems } from './jobPosting'
import type { JobPosting } from './jobPosting'

/** 서버가 보낼 수 있는 「타입이 거짓말하는」 값 — 배열 필드가 통째로 없다 */
const malformed = { responsibilities: '백엔드 API 개발', parsedAt: '2026-08-21T00:00:00Z' } as unknown as JobPosting
const full: JobPosting = {
  responsibilities: '백엔드 API 개발', requirements: ['3년 이상'], preferred: ['K8s'],
  techStack: ['Java'], qualifications: [], keywords: ['대용량'], parsedAt: '2026-08-21T00:00:00Z',
}

describe('normalizeJobPosting', () => {
  it('null·undefined → null', () => {
    expect(normalizeJobPosting(null)).toBeNull()
    expect(normalizeJobPosting(undefined)).toBeNull()
  })

  it('🔴 배열 필드가 없어도 [] 로 채운다 (여기가 크래시 지점이었다)', () => {
    const n = normalizeJobPosting(malformed)!
    expect(n.requirements).toEqual([])
    expect(n.preferred).toEqual([])
    expect(n.techStack).toEqual([])
    expect(n.qualifications).toEqual([])
    expect(n.keywords).toEqual([])
    expect(n.responsibilities).toBe('백엔드 API 개발')
  })

  it('🔴 배열이 아닌 값이 와도 [] (구버전·수동 편집)', () => {
    const weird = { requirements: 'not-an-array', keywords: 42 } as unknown as JobPosting
    const n = normalizeJobPosting(weird)!
    expect(n.requirements).toEqual([])
    expect(n.keywords).toEqual([])
  })

  it('🔴 배열 안 비문자열은 걸러낸다', () => {
    const dirty = { ...full, requirements: ['ok', null, 3, 'also-ok'] } as unknown as JobPosting
    expect(normalizeJobPosting(dirty)!.requirements).toEqual(['ok', 'also-ok'])
  })

  it('정상 값은 그대로 통과한다', () => {
    expect(normalizeJobPosting(full)).toEqual(full)
  })
})

describe('hasJobPostingData / countJobPostingItems — 비정상 값에 죽지 않는다', () => {
  it('🔴 배열 필드 없는 값에도 던지지 않는다 (예전엔 가드 자체가 크래시했다)', () => {
    expect(() => hasJobPostingData(malformed)).not.toThrow()
    expect(hasJobPostingData(malformed)).toBe(true) // responsibilities 가 있으므로 데이터 있음
    expect(() => countJobPostingItems(malformed)).not.toThrow()
    expect(countJobPostingItems(malformed)).toBe(1)
  })

  it('전부 빈 값 → 데이터 없음', () => {
    expect(hasJobPostingData({} as unknown as JobPosting)).toBe(false)
    expect(hasJobPostingData(null)).toBe(false)
  })

  it('정상 값 계산 — 담당업무 1 + 목록 합', () => {
    expect(countJobPostingItems(full)).toBe(1 + 1 + 1 + 1 + 0 + 1)
  })
})
