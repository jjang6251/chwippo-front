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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

/**
 * 시간 고정 — `needsResult` 가 KST 오늘을 직접 읽으므로 시스템 시각을 고정한다.
 *
 * 예전엔 `now: Dayjs` 를 인자로 주입했지만, **프로덕션 어디서도 넘기지 않는 테스트 전용
 * seam** 이었다. KST 통일(`calcDday` 위임) 과정에서 제거했다 — 안 쓰는 인자를 받는 척하면
 * 테스트가 시간을 통제하는 것처럼 보이지만 실제로는 아니게 된다.
 */
const NOW_UTC = '2026-07-19T00:00:00.000Z' // = KST 2026-07-19 09:00
const PAST = '2026-07-10' // KST 오늘 이전
const FUTURE = '2026-07-25' // KST 오늘 이후

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW_UTC))
})

afterEach(() => {
  vi.useRealTimers()
})

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
    expect(needsResult(app)).toBe(true)
  })

  it('6) 마지막 스텝 + 미래 날짜 → false', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE)], currentStepIndex: 1 })
    expect(needsResult(app)).toBe(false)
  })

  it('7) 중간 스텝(마지막 아님) + 날짜 경과 → false', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE)], currentStepIndex: 0 })
    expect(needsResult(app)).toBe(false)
  })

  it('8) PASSED → false', () => {
    const app = makeApp({ status: 'PASSED', steps: [step(0, PAST)], currentStepIndex: 0 })
    expect(needsResult(app)).toBe(false)
  })

  /**
   * 🔴 **기기 TZ 가 판정을 바꾸면 안 된다** — 예전 인라인 구현이 여기서 틀렸다.
   *
   * `scheduled_date` 는 `timestamptz` 라 API 가 `2026-08-13T15:00:00Z`(= KST 8/14 자정)
   * 같은 값을 준다. 실제 시각이 **KST 8/14 오전 10시**(= UTC 8/14 01:00)일 때:
   *
   * | 기준 | 오늘 | 마감 | 지남? |
   * |---|---|---|---|
   * | KST (정답) | 8/14 | 8/14 | 아니오 |
   * | 로컬 TZ=UTC (예전) | 8/14 | **8/13** | **예** ← 하루 일찍 "결과 입력하세요" |
   *
   * 마감 **당일 아침에** 결과 입력을 재촉당하는 건 사용자가 바로 체감하는 오작동이다.
   */
  it('🔴 마감 당일 아침 — 기기 TZ 와 무관하게 아직 안 지난 것으로 본다', () => {
    vi.setSystemTime(new Date('2026-08-14T01:00:00.000Z')) // KST 8/14 10:00
    const kstMidnightAug14 = '2026-08-13T15:00:00.000Z'
    const app = makeApp({
      steps: [step(0, PAST), step(1, kstMidnightAug14)],
      currentStepIndex: 1,
    })
    expect(needsResult(app)).toBe(false)
  })

  /** 하루가 진짜 지나면 판정이 바뀐다 (위 케이스가 무조건 false 라서 통과하는 게 아님) */
  it('마감 다음 날에는 지남으로 본다', () => {
    vi.setSystemTime(new Date('2026-08-15T01:00:00.000Z')) // KST 8/15 10:00
    const app = makeApp({
      steps: [step(0, PAST), step(1, '2026-08-13T15:00:00.000Z')],
      currentStepIndex: 1,
    })
    expect(needsResult(app)).toBe(true)
  })

  /** 서버가 이상한 값을 줘도 "결과 입력" 오유도가 뜨면 안 된다 */
  it('날짜로 못 읽는 값이면 지남으로 보지 않는다', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, 'nonsense')], currentStepIndex: 1 })
    expect(() => needsResult(app)).not.toThrow()
    expect(needsResult(app)).toBe(false)
  })
})

describe('getBoardGroupKey — 그룹 판정', () => {
  it('9) status 우선: PASSED→passed · FAILED→failed · PLANNED→planned', () => {
    expect(getBoardGroupKey(makeApp({ status: 'PASSED' }))).toBe('passed')
    expect(getBoardGroupKey(makeApp({ status: 'FAILED' }))).toBe('failed')
    expect(getBoardGroupKey(makeApp({ status: 'PLANNED' }))).toBe('planned')
  })

  it('10a) IN_PROGRESS 결과 대기 → waiting', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 })
    expect(getBoardGroupKey(app)).toBe('waiting')
  })

  it('10b) IN_PROGRESS 현재 스텝 orderIndex 0 → document', () => {
    const app = makeApp({ steps: [step(0, FUTURE), step(1, FUTURE)], currentStepIndex: 0 })
    expect(getBoardGroupKey(app)).toBe('document')
  })

  it('10c) IN_PROGRESS 현재 스텝 orderIndex > 0 → interview', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, FUTURE), step(2, FUTURE)], currentStepIndex: 1 })
    expect(getBoardGroupKey(app)).toBe('interview')
  })
})

describe('groupApplications', () => {
  it('11) 빈 그룹은 결과에 포함하지 않음', () => {
    const apps = [
      makeApp({ id: 'p', status: 'PASSED' }),
      makeApp({ id: 'd', steps: [step(0, FUTURE)], currentStepIndex: 0 }),
    ]
    const groups = groupApplications(apps)
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
    const groups = groupApplications(apps)
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
    expect(getStepChip(makeApp({ status: 'PASSED' }))).toEqual({ label: '최종 합격', tone: 'success' })
  })

  it('13b) 결과 대기 → 결과 대기 / warning', () => {
    const app = makeApp({ steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 })
    expect(getStepChip(app)).toEqual({ label: '결과 대기', tone: 'warning' })
  })

  it('13c) 진행 중 → 현재 스텝명 / neutral', () => {
    const app = makeApp({ steps: [step(0, FUTURE), step(1, FUTURE)], currentStepIndex: 1 })
    expect(getStepChip(app)).toEqual({ label: '스텝1', tone: 'neutral' })
  })

  it('13d) PLANNED → 지원 예정 / neutral, FAILED → 불합격 / neutral', () => {
    expect(getStepChip(makeApp({ status: 'PLANNED' }))).toEqual({ label: '지원 예정', tone: 'neutral' })
    expect(getStepChip(makeApp({ status: 'FAILED' }))).toEqual({ label: '불합격', tone: 'neutral' })
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
