import { describe, it, expect } from 'vitest'
import { sortApplications } from './sortApplications'
import type { Application } from '@/types/application'

function makeApp(
  overrides: Partial<Application> & { id: string; deadline?: string | null },
): Application {
  const { deadline, steps, ...rest } = overrides
  const app: Application = {
    userId: 'u1',
    companyName: '테스트',
    jobTitle: null,
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: steps ?? [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...rest,
  }
  // 옛 테스트 호환: deadline 주어졌고 steps 없으면 첫 step.scheduledDate로 변환
  if (deadline !== undefined && (!steps || steps.length === 0)) {
    app.steps = deadline ? [makeStep(deadline, 0)] : []
  }
  return app
}

function makeStep(scheduledDate: string | null, orderIndex = 0) {
  return {
    id: `step-${orderIndex}`,
    applicationId: 'app1',
    orderIndex,
    name: `스텝${orderIndex}`,
    scheduledDate,
    location: null,
    notes: null,
    pinnedContent: null,
  }
}

describe('sortApplications', () => {
  describe('빈 배열 / 1개', () => {
    it('빈 배열 → 빈 배열', () => {
      expect(sortApplications([])).toEqual([])
    })

    it('1개 → 그대로', () => {
      const app = makeApp({ id: 'a1' })
      expect(sortApplications([app])).toEqual([app])
    })
  })

  describe('다음 액션 임박순 — IN_PROGRESS', () => {
    it('currentStep.scheduledDate 기준으로 정렬', () => {
      const a = makeApp({
        id: 'a1',
        status: 'IN_PROGRESS',
        currentStepIndex: 0,
        steps: [makeStep('2026-06-10')],
      })
      const b = makeApp({
        id: 'b1',
        status: 'IN_PROGRESS',
        currentStepIndex: 0,
        steps: [makeStep('2026-06-05')],
      })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
      expect(result[1].id).toBe('a1')
    })


    it('scheduledDate도 deadline도 없으면 Infinity → 뒤로', () => {
      const a = makeApp({ id: 'a1', status: 'IN_PROGRESS', steps: [makeStep(null)] })
      const b = makeApp({
        id: 'b1',
        status: 'IN_PROGRESS',
        steps: [makeStep('2026-06-05')],
      })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
      expect(result[1].id).toBe('a1')
    })

    it('날짜 동일하면 createdAt DESC (최근 등록 먼저) tiebreaker', () => {
      const a = makeApp({
        id: 'a1',
        status: 'IN_PROGRESS',
        createdAt: '2026-01-01T00:00:00.000Z',
        steps: [makeStep('2026-06-10')],
      })
      const b = makeApp({
        id: 'b1',
        status: 'IN_PROGRESS',
        createdAt: '2026-01-05T00:00:00.000Z',
        steps: [makeStep('2026-06-10')],
      })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
    })
  })

  describe('다음 액션 임박순 — PLANNED', () => {
    it('PLANNED는 deadline 기준으로 정렬', () => {
      const a = makeApp({ id: 'a1', status: 'PLANNED', deadline: '2026-07-01' })
      const b = makeApp({ id: 'b1', status: 'PLANNED', deadline: '2026-06-15' })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
    })

    it('PLANNED deadline 없으면 Infinity → 뒤로', () => {
      const a = makeApp({ id: 'a1', status: 'PLANNED', deadline: null })
      const b = makeApp({ id: 'b1', status: 'PLANNED', deadline: '2026-06-15' })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
      expect(result[1].id).toBe('a1')
    })
  })

  describe('PASSED 항상 하단', () => {
    it('PASSED는 IN_PROGRESS보다 항상 뒤', () => {
      const passed = makeApp({ id: 'passed', status: 'PASSED', deadline: '2026-01-01' })
      const active = makeApp({
        id: 'active',
        status: 'IN_PROGRESS',
        deadline: '2026-12-31',
        steps: [makeStep(null)],
      })
      const result = sortApplications([passed, active])
      expect(result[0].id).toBe('active')
      expect(result[1].id).toBe('passed')
    })

    it('PASSED는 PLANNED보다도 항상 뒤', () => {
      const passed = makeApp({ id: 'passed', status: 'PASSED', deadline: '2026-01-01' })
      const planned = makeApp({ id: 'planned', status: 'PLANNED', deadline: '2026-12-31' })
      const result = sortApplications([passed, planned])
      expect(result[0].id).toBe('planned')
      expect(result[1].id).toBe('passed')
    })

    it('PASSED끼리는 deadline ASC로 정렬', () => {
      const a = makeApp({ id: 'p1', status: 'PASSED', deadline: '2026-03-01' })
      const b = makeApp({ id: 'p2', status: 'PASSED', deadline: '2026-02-01' })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('p2')
      expect(result[1].id).toBe('p1')
    })
  })

  describe('혼재 케이스', () => {
    it('IN_PROGRESS + PLANNED + PASSED 혼재 — PASSED 항상 하단, 나머지 액션 임박순', () => {
      const p1 = makeApp({ id: 'p1', status: 'PASSED', deadline: '2026-01-10' })
      const planned = makeApp({ id: 'pl', status: 'PLANNED', deadline: '2026-06-20' })
      const active = makeApp({
        id: 'ac',
        status: 'IN_PROGRESS',
        currentStepIndex: 0,
        steps: [makeStep('2026-06-05')],
      })
      const result = sortApplications([p1, planned, active])
      expect(result[0].id).toBe('ac')
      expect(result[1].id).toBe('pl')
      expect(result[2].id).toBe('p1')
    })

    it('모든 날짜 null — Infinity끼리 createdAt DESC', () => {
      const a = makeApp({ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z', steps: [makeStep(null)] })
      const b = makeApp({ id: 'b1', createdAt: '2026-01-10T00:00:00.000Z', steps: [makeStep(null)] })
      const result = sortApplications([a, b])
      expect(result[0].id).toBe('b1')
    })
  })

  describe('currentStepIndex 방어', () => {
    it('currentStepIndex 범위 초과해도 크래시 없이 deadline fallback', () => {
      const app = makeApp({
        id: 'a1',
        status: 'IN_PROGRESS',
        currentStepIndex: 99,
        deadline: '2026-06-10',
        steps: [makeStep(null)],
      })
      expect(() => sortApplications([app])).not.toThrow()
    })
  })
})
