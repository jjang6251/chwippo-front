import { describe, it, expect } from 'vitest'
import { getStepType, isInterviewLikeForNudge } from './stepTemplates'

/**
 * 면접 유도 모달 판정 — `getStepType` 보다 좁다.
 *
 * 🔴 **왜 따로 있나** — `getStepType` 은 `interview` 가 1순위, `result` 가 4순위라
 * 「면접 결과 발표」가 `interview` 로 잡힌다. 아이콘·색 용도로는 맞지만(면접 결과니 면접 아이콘)
 * 넛지 기준으로는 **결과를 기다리는 사람에게 「면접이 잡혔네요」가 뜨는 것**이라 부적합하다.
 */
describe('isInterviewLikeForNudge', () => {
  describe('C-3 정상 — 면접형은 전부 뜬다', () => {
    it.each([
      '1차 면접',
      '2차 면접',
      '임원 면접',
      '화상 인터뷰',
      'PT 면접',
      '토론 면접',
      '컬처핏',
      '컬쳐핏 인터뷰',
      '커피챗',
    ])('%s → true', (name) => {
      expect(isInterviewLikeForNudge(name)).toBe(true)
    })
  })

  describe('🔴 C-1·C-2 오탐 — 「결과」 계열은 걸러낸다', () => {
    it.each([
      '면접 결과 발표',
      '1차 면접 결과',
      '면접 후 최종 발표',
      '임원면접 합격 발표',
      '면접 후기 작성',
    ])('%s → false (결과를 기다리는 단계다)', (name) => {
      // 전제 확인 — getStepType 은 이것들을 interview 로 본다 (그게 아이콘용으로는 옳다)
      expect(getStepType(name)).toBe('interview')
      // 그런데 넛지 기준으로는 아니다
      expect(isInterviewLikeForNudge(name)).toBe(false)
    })
  })

  describe('면접이 아닌 유형은 애초에 false', () => {
    it.each([
      ['서류 제출', 'document'],
      ['코딩테스트', 'exam'],
      ['인적성 검사', 'exam'],
      ['결과 대기', 'wait'],
    ])('%s (%s) → false', (name) => {
      expect(isInterviewLikeForNudge(name)).toBe(false)
    })
  })

  /**
   * 🔴 **C-4 회귀 방어.** 넛지를 고치려다 `getStepType` 을 건드리면
   * 아이콘·필터·그룹핑 등 소비처 4곳이 조용히 어긋난다.
   * 이 테스트는 「넛지 판정은 좁히되 원본 분류는 그대로」를 고정한다.
   */
  it('🔴 C-4 `getStepType` 자체는 바뀌지 않는다 (소비처 4곳 회귀 방어)', () => {
    expect(getStepType('면접 결과 발표')).toBe('interview')
    expect(getStepType('2차 면접')).toBe('interview')
    expect(getStepType('서류 제출')).toBe('document')
    expect(getStepType('코딩테스트')).toBe('exam')
    expect(getStepType('최종 합격 발표')).toBe('result')
    expect(getStepType('결과 대기')).toBe('wait')
  })
})
