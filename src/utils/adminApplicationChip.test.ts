import { describe, it, expect } from 'vitest'
import { cardChip, type AdminChipInput } from './adminApplicationChip'

/**
 * 관리자 지원 카드 탭 — 상태 → 칩 매핑.
 *
 * 사용자 화면(`utils/boardViewGroups.getStepChip`)과 **같은 규칙**을 써야 한다.
 * 운영자와 사용자가 같은 카드를 다른 색·다른 말로 보면 CS 때 대화가 어긋난다.
 * 여기는 admin 전용 경량 DTO라 타입이 달라 로직을 공유할 수 없으므로,
 * 규칙이 갈라지지 않도록 spec 으로 고정한다.
 *
 * 케이스 나열:
 *  1. PASSED   → "최종 합격" · success (유일하게 색이 들어감)
 *  2. FAILED   → "불합격" · neutral
 *  3. PLANNED  → "지원 예정" · neutral
 *  4. IN_PROGRESS + 스텝명 있음 → 스텝명 그대로
 *  5. IN_PROGRESS + 스텝명 null(스텝 0개) → "진행 중" 폴백
 *  6. 종료 상태(PASSED/FAILED)는 스텝명이 있어도 스텝명을 쓰지 않는다
 */

function makeCard(over: Partial<AdminChipInput> = {}): AdminChipInput {
  return { status: 'IN_PROGRESS', currentStepName: null, ...over }
}

describe('cardChip — 관리자 지원 카드 상태 칩', () => {
  it('1. PASSED → 최종 합격 (success)', () => {
    expect(cardChip(makeCard({ status: 'PASSED' }))).toEqual({
      label: '최종 합격',
      tone: 'success',
    })
  })

  it('2. FAILED → 불합격 (neutral)', () => {
    expect(cardChip(makeCard({ status: 'FAILED' }))).toEqual({
      label: '불합격',
      tone: 'neutral',
    })
  })

  it('3. PLANNED → 지원 예정 (neutral)', () => {
    expect(cardChip(makeCard({ status: 'PLANNED' }))).toEqual({
      label: '지원 예정',
      tone: 'neutral',
    })
  })

  it('4. IN_PROGRESS → 현재 스텝명을 그대로 보여준다', () => {
    expect(
      cardChip(makeCard({ status: 'IN_PROGRESS', currentStepName: '1차 면접' })),
    ).toEqual({ label: '1차 면접', tone: 'neutral' })
  })

  it('5. IN_PROGRESS + 스텝 0개 → "진행 중" 폴백 (빈 칩 방지)', () => {
    expect(
      cardChip(makeCard({ status: 'IN_PROGRESS', currentStepName: null })),
    ).toEqual({ label: '진행 중', tone: 'neutral' })
  })

  it('6. 종료 상태는 스텝명이 남아 있어도 결과를 우선한다', () => {
    // 합격했는데 current_step_index 가 중간 스텝을 가리키는 데이터도 실제로 존재
    expect(
      cardChip(makeCard({ status: 'PASSED', currentStepName: '2차 면접' })),
    ).toEqual({ label: '최종 합격', tone: 'success' })
    expect(
      cardChip(makeCard({ status: 'FAILED', currentStepName: '서류' })),
    ).toEqual({ label: '불합격', tone: 'neutral' })
  })
})
