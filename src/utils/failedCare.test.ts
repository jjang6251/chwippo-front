/**
 * A9 — 탈락 단계 판정 시나리오:
 * 1. 면접류 이름 매칭 (면접·임원 면접·PT·피티·토론·인터뷰) / 비면접 (서류·코딩테스트·인적성·최종 발표)
 * 2. 현재 스텝이 면접 → true
 * 3. 현재가 면접 이후 단계(최종 발표)여도 면접을 거쳤으면 → true
 * 4. 서류 단계 탈락 — 이후에 면접 스텝이 있어도 미도달 → false
 * 5. steps 없음/빈 배열 → false
 */
import { describe, expect, it } from 'vitest'
import {
  isInterviewLikeStep,
  lastReachedInterviewStepName,
  reachedInterviewStage,
} from './failedCare'

const step = (orderIndex: number, name: string) => ({ orderIndex, name })

describe('isInterviewLikeStep', () => {
  it('1) 면접류 매칭 / 비면접 제외', () => {
    expect(isInterviewLikeStep('면접')).toBe(true)
    expect(isInterviewLikeStep('임원 면접')).toBe(true)
    expect(isInterviewLikeStep('PT')).toBe(true)
    expect(isInterviewLikeStep('피티 면접')).toBe(true)
    expect(isInterviewLikeStep('토론')).toBe(true)
    expect(isInterviewLikeStep('1차 인터뷰')).toBe(true)
    expect(isInterviewLikeStep('서류')).toBe(false)
    expect(isInterviewLikeStep('코딩테스트')).toBe(false)
    expect(isInterviewLikeStep('인적성')).toBe(false)
    // '최종 발표'(결과 발표) 는 면접류 아님 — 오판 방지
    expect(isInterviewLikeStep('최종 발표')).toBe(false)
  })
})

describe('reachedInterviewStage', () => {
  const STEPS = [
    step(0, '서류'),
    step(1, '코딩테스트'),
    step(2, '1차 면접'),
    step(3, '최종 발표'),
  ]

  it('2) 현재 스텝이 면접 → true', () => {
    expect(reachedInterviewStage({ currentStepIndex: 2, steps: STEPS })).toBe(true)
  })

  it('3) 현재가 최종 발표여도 면접 거침 → true', () => {
    expect(reachedInterviewStage({ currentStepIndex: 3, steps: STEPS })).toBe(true)
  })

  it('4) 서류·코테 단계 탈락 (면접 미도달) → false', () => {
    expect(reachedInterviewStage({ currentStepIndex: 0, steps: STEPS })).toBe(false)
    expect(reachedInterviewStage({ currentStepIndex: 1, steps: STEPS })).toBe(false)
  })

  it('5) steps 없음/빈 배열 → false', () => {
    expect(reachedInterviewStage({ currentStepIndex: 0, steps: [] })).toBe(false)
    expect(reachedInterviewStage({ currentStepIndex: 0, steps: null })).toBe(false)
  })

  it('6) lastReachedInterviewStepName — 도달한 마지막 면접류 이름 / 미도달 null', () => {
    const steps = [
      step(0, '서류'),
      step(1, '1차 면접'),
      step(2, '2차 면접'),
      step(3, '최종 발표'),
    ]
    expect(lastReachedInterviewStepName({ currentStepIndex: 1, steps })).toBe('1차 면접')
    expect(lastReachedInterviewStepName({ currentStepIndex: 3, steps })).toBe('2차 면접')
    expect(lastReachedInterviewStepName({ currentStepIndex: 0, steps })).toBeNull()
  })
})
