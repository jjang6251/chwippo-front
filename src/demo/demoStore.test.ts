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

/**
 * 서버 규칙을 데모에서도 그대로 지킨다 — 여기서만 무르면 둘러보기에서 되던 게
 * 가입 후엔 막혀, 데모가 거짓말을 한 셈이 된다.
 */
describe('demoStore — 준비 노트 시트', () => {
  it('시드: 카카오 1차 기술면접에 시트 2장', () => {
    expect(store.getNoteSheets('demo-a1-s2').map((s) => s.name)).toEqual(['예상 질문', '기업 분석'])
    expect(store.getNoteSheets('demo-a1-s0')).toEqual([])
  })

  it('추가·이름 변경·본문 저장·삭제', () => {
    const created = store.createNoteSheet('demo-a1-s2', { name: '시트 3' })
    expect(created.orderIndex).toBe(2)
    expect(store.getNoteSheets('demo-a1-s2')).toHaveLength(3)

    const renamed = store.updateNoteSheet('demo-a1-s2', created.id, { name: '역질문' })
    expect(renamed.name).toBe('역질문')

    const saved = store.updateNoteSheet('demo-a1-s2', created.id, { content: '{"type":"doc"}' })
    expect(saved.content).toBe('{"type":"doc"}')

    store.deleteNoteSheet('demo-a1-s2', created.id)
    expect(store.getNoteSheets('demo-a1-s2')).toHaveLength(2)
  })

  /** 🔴 승격 멱등 — 이미 있으면 첫 시트를 돌려준다 (시트가 2장이 되지 않는다) */
  it('ifEmpty: 이미 시트가 있으면 첫 시트를 그대로 돌려준다', () => {
    const res = store.createNoteSheet('demo-a1-s2', { name: '준비 노트', content: 'x', ifEmpty: true })
    expect(res.id).toBe('demo-ns1')
    expect(store.getNoteSheets('demo-a1-s2')).toHaveLength(2)
  })

  it('ifEmpty: 0장이면 실제로 만든다 (승격)', () => {
    const res = store.createNoteSheet('demo-a1-s0', { name: '준비 노트', content: 'x', ifEmpty: true })
    expect(res.name).toBe('준비 노트')
    expect(store.getNoteSheets('demo-a1-s0')).toHaveLength(1)
  })

  it('🔴 마지막 1장은 지워지지 않는다', () => {
    store.createNoteSheet('demo-a1-s0', { name: '준비 노트' })
    const only = store.getNoteSheets('demo-a1-s0')[0]
    store.deleteNoteSheet('demo-a1-s0', only.id)
    expect(store.getNoteSheets('demo-a1-s0')).toHaveLength(1)
  })

  it('🔴 캡 10장을 넘기면 던진다 (서버 400 자리)', () => {
    for (let i = 0; i < 10; i++) store.createNoteSheet('demo-a1-s0', { name: `시트 ${i + 1}` })
    expect(() => store.createNoteSheet('demo-a1-s0', { name: '11번째' })).toThrow(/상한/)
  })

  it('store mutation 은 sampleData 상수를 오염시키지 않는다', () => {
    store.updateNoteSheet('demo-a1-s2', 'demo-ns1', { name: '오염' })
    expect(S.DEMO_NOTE_SHEETS['demo-a1-s2'][0].name).toBe('예상 질문')
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

/**
 * 🔴 구형 WebKit 시뮬레이션 (2026-08-12 실사고 CHWIPPO-FRONT-3 과 같은 기기 대역).
 * `structuredClone` 도 ES2022 급 — iOS/Safari 15.4 미만 엔진에는 없다. 데모 진입 시
 * clone 이 첫 호출이라 그 기기에선 둘러보기 전체가 죽는다. jsdom 은 이 API 를 가지므로
 * "지워진 환경"을 흉내내야만 회귀가 잡힌다 (/qa 16축: 실행 환경 호환).
 * 구현이 structuredClone 으로 되돌아가면 이 블록이 실패한다.
 *
 * ⚠️ stub 은 호출 구간에만 — jsdom·vitest 내부도 ES2022 API 를 쓴다 (routeMeta.test 참조).
 */
describe('demoStore — structuredClone 이 없는 구형 엔진에서도 동작', () => {
  it('reset·조회·deep copy 가 전부 동작한다', () => {
    const original = globalThis.structuredClone
    let count: number
    let origStatus: string | undefined
    try {
      ;(globalThis as { structuredClone?: unknown }).structuredClone = undefined
      store.resetDemoStore()
      count = store.getApplications().length
      // deep copy 유지 — store mutation 이 sampleData 상수를 오염시키지 않는다
      store.updateApplication('demo-a1', { status: 'PASSED' })
      origStatus = S.DEMO_APPLICATIONS.find((a) => a.id === 'demo-a1')?.status
    } finally {
      ;(globalThis as { structuredClone?: unknown }).structuredClone = original
    }
    expect(count).toBe(S.DEMO_APPLICATIONS.length)
    expect(origStatus).toBe('IN_PROGRESS')
  })
})
