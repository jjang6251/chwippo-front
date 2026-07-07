/**
 * activity-redesign — 일정 질문 선택 시나리오:
 * 1. 어제 면접 스텝 → 질문 (어제 라벨)
 * 2. 서류 마감 스텝 → 대상 아님 (CEO 결정 — 노이즈)
 * 3. 이미 답한 스텝(relatedStepId 로그 존재) → 제외
 * 4. dismiss 된 스텝 → 제외
 * 5. 어제·오늘 둘 다 있으면 어제 우선
 * 6. 그제(범위 밖) → 제외
 * 7. note·exam 타입 이벤트 → 제외 (step 만)
 * 8. 후보 없음 → null
 */
import { describe, expect, it } from 'vitest'
import { pickScheduleQuestion, isQuestionableStep } from './questionCard'
import type { CalendarEvent } from '@/api/calendar'

const TODAY = '2026-07-07'
const YESTERDAY = '2026-07-06'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  date: YESTERDAY,
  time: '14:00',
  type: 'step',
  applicationId: 'app-1',
  stepId: 's-1',
  examId: null,
  noteId: null,
  companyName: '삼성전자',
  stepName: '코딩테스트',
  location: null,
  content: null,
  ...over,
})

const base = {
  today: TODAY,
  yesterday: YESTERDAY,
  answeredStepIds: new Set<string>(),
  dismissedStepIds: new Set<string>(),
}

describe('isQuestionableStep', () => {
  it('면접·코테·인적성류 매칭 / 서류 제외', () => {
    expect(isQuestionableStep('1차 면접')).toBe(true)
    expect(isQuestionableStep('코딩테스트')).toBe(true)
    expect(isQuestionableStep('인적성')).toBe(true)
    expect(isQuestionableStep('필기시험')).toBe(true)
    expect(isQuestionableStep('서류')).toBe(false)
    expect(isQuestionableStep('서류 마감')).toBe(false)
  })
})

describe('pickScheduleQuestion', () => {
  it('1) 어제 코테 → 질문 (어제 라벨)', () => {
    const q = pickScheduleQuestion({ ...base, events: [ev({})] })
    expect(q).toMatchObject({
      stepId: 's-1',
      companyName: '삼성전자',
      stepName: '코딩테스트',
      dateLabel: '어제',
    })
  })

  it('2) 서류 스텝 → null', () => {
    const q = pickScheduleQuestion({
      ...base,
      events: [ev({ stepName: '서류' })],
    })
    expect(q).toBeNull()
  })

  it('3) 이미 답한 스텝 → 제외', () => {
    const q = pickScheduleQuestion({
      ...base,
      answeredStepIds: new Set(['s-1']),
      events: [ev({})],
    })
    expect(q).toBeNull()
  })

  it('4) dismiss 된 스텝 → 제외', () => {
    const q = pickScheduleQuestion({
      ...base,
      dismissedStepIds: new Set(['s-1']),
      events: [ev({})],
    })
    expect(q).toBeNull()
  })

  it('5) 어제·오늘 둘 다 → 어제 우선', () => {
    const q = pickScheduleQuestion({
      ...base,
      events: [
        ev({ stepId: 's-today', date: TODAY, stepName: '면접' }),
        ev({ stepId: 's-yesterday', date: YESTERDAY }),
      ],
    })
    expect(q?.stepId).toBe('s-yesterday')
  })

  it('6) 그제 일정 → 범위 밖 제외', () => {
    const q = pickScheduleQuestion({
      ...base,
      events: [ev({ date: '2026-07-05' })],
    })
    expect(q).toBeNull()
  })

  it('7) note·exam 타입 → 제외', () => {
    const q = pickScheduleQuestion({
      ...base,
      events: [
        ev({ type: 'note', stepId: null }),
        ev({ type: 'exam', stepId: null, examId: 'e-1' }),
      ],
    })
    expect(q).toBeNull()
  })

  it('8) 후보 없음 → null', () => {
    expect(pickScheduleQuestion({ ...base, events: [] })).toBeNull()
  })
})
