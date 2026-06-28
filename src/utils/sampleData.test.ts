/**
 * W1 — JOB_CATEGORIES + JOB_GROUPS const 검증.
 *
 * 21개 (20 + 기타) 동기화 + 5 그룹 합산 검증.
 */
import { describe, expect, it } from 'vitest'
import { JOB_CATEGORIES, JOB_GROUPS } from './sampleData'

describe('JOB_CATEGORIES', () => {
  it('21개 (20 직군 + 기타)', () => {
    expect(JOB_CATEGORIES).toHaveLength(21)
    expect(JOB_CATEGORIES).toContain('기타')
  })

  it('JOB_GROUPS categories 합산 = 21 (모든 직군 정확히 1 그룹에 속함)', () => {
    const allInGroups = JOB_GROUPS.flatMap((g) => g.categories)
    expect(allInGroups).toHaveLength(21)
    // 중복 X
    expect(new Set(allInGroups).size).toBe(21)
    // 21 JOB_CATEGORIES 와 동일 집합
    expect(new Set(allInGroups)).toEqual(new Set(JOB_CATEGORIES))
  })

  it('5 그룹 + 기타 그룹 = 6 그룹', () => {
    expect(JOB_GROUPS).toHaveLength(6)
    expect(JOB_GROUPS.map((g) => g.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'X'])
  })
})
