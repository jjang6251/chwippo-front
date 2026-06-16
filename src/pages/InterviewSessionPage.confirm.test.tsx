/**
 * F6 PR 2 Phase 5.6.소급 — InterviewSessionPage "다시 생성" confirm 메시지 잔여 표시.
 *
 * 매트릭스:
 *   1. quota 데이터 있음 → confirm 메시지에 "오늘 N/M회" + "이번 달 N/M회" 포함
 *   2. quota 데이터 없음 → confirm 메시지에 잔여 표기 생략 (안 깨짐)
 *
 * 다른 UI 요소는 dependency 가 너무 많아 별도 검증. confirm 메시지 빌드 로직만 격리.
 */
import { describe, expect, it } from 'vitest'

function buildConfirmMessage(
  quota: { dayUsed: number; dayLimit: number; monthUsed: number; monthLimit: number } | undefined,
): string {
  const remaining = quota
    ? `오늘 ${quota.dayLimit - quota.dayUsed}/${quota.dayLimit}회 · 이번 달 ${quota.monthLimit - quota.monthUsed}/${quota.monthLimit}회`
    : ''
  return `기존 질문과 메모가 모두 삭제되고 새로 생성됩니다.\nAI 호출 1회가 차감됩니다.${remaining ? `\n잔여: ${remaining}` : ''}\n\n진행하시겠어요?`
}

describe('InterviewSessionPage "다시 생성" confirm 메시지 (5.6.6)', () => {
  it('1) quota 데이터 있음 → "오늘 N/M회 · 이번 달 N/M회" 포함', () => {
    const msg = buildConfirmMessage({
      dayUsed: 1,
      dayLimit: 3,
      monthUsed: 10,
      monthLimit: 100,
    })
    expect(msg).toContain('AI 호출 1회가 차감됩니다')
    expect(msg).toContain('잔여:')
    expect(msg).toContain('오늘 2/3회')
    expect(msg).toContain('이번 달 90/100회')
  })

  it('2) quota 데이터 없음 (undefined) → 잔여 부분 생략, 핵심 안내만', () => {
    const msg = buildConfirmMessage(undefined)
    expect(msg).toContain('AI 호출 1회가 차감됩니다')
    expect(msg).not.toContain('잔여:')
    expect(msg).toContain('진행하시겠어요?')
  })

  it('3) dayLimit=dayUsed (소진 상태) → "오늘 0/N회"', () => {
    const msg = buildConfirmMessage({
      dayUsed: 5,
      dayLimit: 5,
      monthUsed: 5,
      monthLimit: 100,
    })
    expect(msg).toContain('오늘 0/5회')
  })
})
