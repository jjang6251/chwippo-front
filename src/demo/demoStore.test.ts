import { beforeEach, describe, expect, it } from 'vitest'
import * as store from './demoStore'
import * as S from './sampleData'

beforeEach(() => {
  store.resetDemoStore()
})

describe('demoStore — 초기화·deep copy·reset', () => {
  it('초기 상태는 샘플 데이터와 동일 (카드 11개)', () => {
    expect(store.getApplications()).toHaveLength(S.DEMO_APPLICATIONS.length)
    expect(store.getApplication('demo-a1')?.companyName).toBe('카카오')
  })

  it('store mutation 은 sampleData 상수를 오염시키지 않는다 (deep copy)', () => {
    store.updateApplication('demo-a1', { status: 'PASSED' })
    expect(store.getApplication('demo-a1')?.status).toBe('PASSED')
    // 원본 상수는 그대로
    const orig = S.DEMO_APPLICATIONS.find((a) => a.id === 'demo-a1')
    expect(orig?.status).toBe('IN_PROGRESS')
  })

  it('resetDemoStore 는 변경을 초기 상태로 되돌린다', () => {
    store.updateApplication('demo-a1', { status: 'FAILED', isStarred: false })
    store.resetDemoStore()
    expect(store.getApplication('demo-a1')?.status).toBe('IN_PROGRESS')
    expect(store.getApplication('demo-a1')?.isStarred).toBe(true)
  })
})

describe('demoStore — 지원 카드 mutation', () => {
  it('updateApplication: 상태·별표 변경', () => {
    const res = store.updateApplication('demo-a2', { status: 'PASSED', isStarred: true })
    expect(res.status).toBe('PASSED')
    expect(res.isStarred).toBe(true)
  })

  it('updateApplication: failedTakeaway 저장 시 failedTakeawayAt 자동 기록', () => {
    const res = store.updateApplication('demo-a5', { failedTakeaway: '다음엔 지표 먼저' })
    expect(res.failedTakeaway).toBe('다음엔 지표 먼저')
    expect(res.failedTakeawayAt).toBeTruthy()
  })

  it('updateCurrentStep: 현재 스텝(노드) 이동', () => {
    const res = store.updateCurrentStep('demo-a1', 3)
    expect(res.currentStepIndex).toBe(3)
    expect(store.getApplication('demo-a1')?.currentStepIndex).toBe(3)
  })

  it('updateStep: 스텝 메모·핀 저장', () => {
    const res = store.updateStep('demo-a1', 'demo-a1-s2', { notes: '메모', pinnedContent: '핀' })
    expect(res.notes).toBe('메모')
    expect(res.pinnedContent).toBe('핀')
  })

  it('없는 카드 update 는 throw (fail-loud)', () => {
    expect(() => store.updateApplication('nope', { status: 'PASSED' })).toThrow()
  })
})

describe('demoStore — 체크리스트', () => {
  it('추가·토글·삭제', () => {
    const created = store.createChecklistItem('demo-a1-s2', '새 항목')
    expect(created.content).toBe('새 항목')
    expect(created.isDone).toBe(false)
    expect(store.getChecklist('demo-a1-s2').some((i) => i.id === created.id)).toBe(true)

    const toggled = store.updateChecklistItem('demo-a1-s2', created.id, { isDone: true })
    expect(toggled.isDone).toBe(true)

    store.deleteChecklistItem('demo-a1-s2', created.id)
    expect(store.getChecklist('demo-a1-s2').some((i) => i.id === created.id)).toBe(false)
  })

  it('체크리스트 없던 스텝에도 추가 가능', () => {
    const created = store.createChecklistItem('demo-a3-s3', '항목')
    expect(store.getChecklist('demo-a3-s3')).toHaveLength(1)
    expect(created.orderIndex).toBe(0)
  })
})

describe('demoStore — 데일리 노트', () => {
  it('추가·토글·삭제', () => {
    const before = store.getDailyNotes().length
    const created = store.createDailyNote({ date: '2026-07-13', content: '할 일' })
    expect(store.getDailyNotes()).toHaveLength(before + 1)

    const toggled = store.updateDailyNote(created.id, { isDone: true })
    expect(toggled.isDone).toBe(true)

    store.deleteDailyNote(created.id)
    expect(store.getDailyNotes().some((n) => n.id === created.id)).toBe(false)
  })
})

describe('demoStore — 자소서·캘린더 이벤트', () => {
  it('updateCoverletter: 답변 텍스트 저장', () => {
    const res = store.updateCoverletter('demo-a1', 'demo-a1-cl2', { answer: '입사 후 포부 초안' })
    expect(res.answer).toBe('입사 후 포부 초안')
  })

  it('getCalendarEvents: step 이벤트의 별표는 지원 카드 값에서 파생', () => {
    store.updateApplication('demo-a2', { isStarred: true })
    const ev = store.getCalendarEvents().find((e) => e.applicationId === 'demo-a2')
    expect(ev?.isStarred).toBe(true)
  })
})
