/**
 * A11 — 보드 뷰 토글 공용 로직 시나리오.
 *
 * loadBoardView/saveBoardView:
 *   1. 저장값 없음 → 'card'
 *   2. 'list'/'group' 저장 → 그대로 복원
 *   3. 잘못된 값 → 'card' fallback
 *   4. saveBoardView → localStorage 반영
 * needsResult:
 *   5. IN_PROGRESS + 마지막 스텝 + 날짜 경과 → true
 *   6. IN_PROGRESS + 마지막 스텝 + 미래 날짜 → false
 *   7. IN_PROGRESS + 중간 스텝 + 날짜 경과 → false (마지막 스텝 아님)
 *   8. PASSED → false
 * getBoardGroupKey (합격/불합격/예정/결과 대기/서류/면접 각 1+):
 *   9. PASSED→passed · FAILED→failed · PLANNED→planned
 *   10. 결과 대기→waiting · orderIndex0→document · orderIndex>0→interview
 * groupApplications:
 *   11. 빈 그룹 미포함
 *   12. 그룹 순서 = BOARD_GROUP_ORDER, 그룹 내 입력 순서 보존
 * getStepChip:
 *   13. 합격=success · 결과 대기=warning · 진행=neutral(스텝명) · 예정/불합격=neutral
 * getDdayTarget:
 *   14. 진행 = 현재 스텝 날짜 · 합격/불합격 = null
 */
import { describe, it, expect, beforeEach } from 'vitest'
import dayjs from 'dayjs'
import type { Application, ApplicationStep, ApplicationStatus } from '@/types/application'
import {
  loadBoardView,
  saveBoardView,
  BOARD_VIEW_STORAGE_KEY,
  needsResult,
  getBoardGroupKey,
  groupApplications,
  getStepChip,
  getDdayTarget,
  BOARD_GROUP_ORDER,
} from './boardViewGroups'

const NOW = dayjs('2026-07-19T09:00:00+09:00')
const PAST = '2026-07-10' // NOW 이전
const FUTURE = '2026-07-25' // NOW 이후

function step(orderIndex: number, date: string | null = null): ApplicationStep {
  return {
    id: `s${orderIndex}`,
    applicationId: 'a',
    orderIndex,
    name: `스텝${orderIndex}`,
    scheduledDate: date,
    location: null,
    notes: null,
    pinnedContent: null,
  }
}

function makeApp(over: Partial<Application> & { status?: ApplicationStatus }): Application {
  return {
    id: 'a',
    userId: 'u',
    companyName: '회사',
    jobTitle: null,
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  }
}

describe('loadBoardView / saveBoardView', () => {
  beforeEach(() => localStorage.clear())

  it('1) 저장값 없으면 card', () => {
    expect(loadBoardView()).toBe('card')
  })

  it('2) list/group 저장값 그대로 복원', () => {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, 'list')
    expect(loadBoardView()).toBe('list')
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, 'group')
    expect(loadBoardView()).toBe('group')
  })

  it('3) 잘못된 저장값 → card fallback', () => {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, 'nonsense')
    expect(loadBoardView()).toBe('card')
  })

  it('4) saveBoardView → localStorage 반영 후 복원', () => {
    saveBoardView('group')
    expect(localStorage.getItem(BOARD_VIEW_STORAGE_KEY)).toBe('group')
    expect(loadBoardView()).toBe('group')
  })
})

describe('needsResult', () => {
  it('5) 마지막 스텝 + 날짜 경과 → true', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 })
    expect(needsResult(app, NOW)).toBe(true)
  })

  it('6) 마지막 스텝 + 미래 날짜 → false', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE)], currentStepIndex: 1 })
    expect(needsResult(app, NOW)).toBe(false)
  })

  it('7) 중간 스텝(마지막 아님) + 날짜 경과 → false', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE)], currentStepIndex: 0 })
    expect(needsResult(app, NOW)).toBe(false)
  })

  it('8) PASSED → false', () => {
    const app = makeApp({ status: 'PASSED', steps: [step(0, PAST)], currentStepIndex: 0 })
    expect(needsResult(app, NOW)).toBe(false)
  })
})

describe('getBoardGroupKey — 그룹 판정', () => {
  it('9) status 우선: PASSED→passed · FAILED→failed · PLANNED→planned', () => {
    expect(getBoardGroupKey(makeApp({ status: 'PASSED' }), NOW)).toBe('passed')
    expect(getBoardGroupKey(makeApp({ status: 'FAILED' }), NOW)).toBe('failed')
    expect(getBoardGroupKey(makeApp({ status: 'PLANNED' }), NOW)).toBe('planned')
  })

  it('10a) IN_PROGRESS 결과 대기 → waiting', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 })
    expect(getBoardGroupKey(app, NOW)).toBe('waiting')
  })

  it('10b) IN_PROGRESS 현재 스텝 orderIndex 0 → document', () => {
    const app = makeApp({ steps: [step(0, FUTURE), step(1, FUTURE)], currentStepIndex: 0 })
    expect(getBoardGroupKey(app, NOW)).toBe('document')
  })

  it('10c) IN_PROGRESS 현재 스텝 orderIndex > 0 → interview', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE), step(2, FUTURE)], currentStepIndex: 1 })
    expect(getBoardGroupKey(app, NOW)).toBe('interview')
  })
})

describe('groupApplications', () => {
  it('11) 빈 그룹은 결과에 포함하지 않음', () => {
    const apps = [
      makeApp({ id: 'p', status: 'PASSED' }),
      makeApp({ id: 'd', steps: [step(0, FUTURE)], currentStepIndex: 0 }),
    ]
    const groups = groupApplications(apps, NOW)
    const keys = groups.map((g) => g.key)
    expect(keys).toEqual(['document', 'passed'])
    expect(keys).not.toContain('interview')
    expect(keys).not.toContain('waiting')
  })

  it('12) 그룹 순서 = BOARD_GROUP_ORDER, 그룹 내 입력 순서 보존', () => {
    const apps = [
      makeApp({ id: 'pass', status: 'PASSED' }),
      makeApp({ id: 'doc1', steps: [step(0, FUTURE)], currentStepIndex: 0 }),
      makeApp({ id: 'doc2', steps: [step(0, FUTURE)], currentStepIndex: 0 }),
      makeApp({ id: 'plan', status: 'PLANNED' }),
    ]
    const groups = groupApplications(apps, NOW)
    // 렌더 순서: document → planned → passed (interview/waiting/failed 없음)
    expect(groups.map((g) => g.key)).toEqual(['document', 'planned', 'passed'])
    const orderRef = BOARD_GROUP_ORDER.map((g) => g.key)
    // 각 그룹 key 가 전역 순서의 부분 수열
    let prev = -1
    for (const g of groups) {
      const idx = orderRef.indexOf(g.key)
      expect(idx).toBeGreaterThan(prev)
      prev = idx
    }
    // document 그룹 내 입력 순서 보존
    const docGroup = groups.find((g) => g.key === 'document')!
    expect(docGroup.items.map((a) => a.id)).toEqual(['doc1', 'doc2'])
  })
})

describe('getStepChip', () => {
  it('13a) PASSED → 최종 합격 / success', () => {
    expect(getStepChip(makeApp({ status: 'PASSED' }), NOW)).toEqual({ label: '최종 합격', tone: 'success' })
  })

  it('13b) 결과 대기 → 결과 대기 / warning', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 })
    expect(getStepChip(app, NOW)).toEqual({ label: '결과 대기', tone: 'warning' })
  })

  it('13c) 진행 중 → 현재 스텝명 / neutral', () => {
    const app = makeApp({ steps: [step(0, FUTURE), step(1, FUTURE)], currentStepIndex: 1 })
    expect(getStepChip(app, NOW)).toEqual({ label: '스텝1', tone: 'neutral' })
  })

  it('13d) PLANNED → 지원 예정 / neutral, FAILED → 불합격 / neutral', () => {
    expect(getStepChip(makeApp({ status: 'PLANNED' }), NOW)).toEqual({ label: '지원 예정', tone: 'neutral' })
    expect(getStepChip(makeApp({ status: 'FAILED' }), NOW)).toEqual({ label: '불합격', tone: 'neutral' })
  })
})

describe('getDdayTarget', () => {
  it('14a) 진행 중 → 현재 스텝 예정일', () => {
    const app = makeApp({ steps: [step(0, FUTURE), step(1, PAST)], currentStepIndex: 0 })
    expect(getDdayTarget(app)).toBe(FUTURE)
  })

  it('14b) 합격/불합격 → null', () => {
    expect(getDdayTarget(makeApp({ status: 'PASSED', steps: [step(0, FUTURE)], currentStepIndex: 0 }))).toBeNull()
    expect(getDdayTarget(makeApp({ status: 'FAILED', steps: [step(0, FUTURE)], currentStepIndex: 0 }))).toBeNull()
  })
})
