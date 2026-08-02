/**
 * PR_B2 Phase 3 — MatrixConfirmModal 시나리오 매트릭스 (CTO 시각 spec).
 *
 * Q3 C 매트릭스 수정 confirm — applyMode 선택 + affectedUsers + balanceDiff hint.
 *
 * 사용자 시각 못 잡는 영역:
 * - sample preview 5개 cap
 * - applyMode default next_reset 권장
 * - balanceDiff 양수/음수 표시
 * - showApplyMode=false 시 fieldset 숨김 (feature_coin_meta 용)
 * - confirm 의 applyMode 정확 전달
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MatrixConfirmModal } from './MatrixConfirmModal'

const onConfirm = vi.fn()
const onClose = vi.fn()

describe('MatrixConfirmModal', () => {
  beforeEach(() => {
    onConfirm.mockReset()
    onClose.mockReset()
  })

  describe('초기 render', () => {
    it('title + description + affectedUsers 표시', () => {
      render(
        <MatrixConfirmModal
          title="Free tier 한도 변경"
          description="monthlyCoinLimit 100 → 150"
          affectedUsers={42}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      expect(screen.getByText('Free tier 한도 변경')).toBeInTheDocument()
      expect(
        screen.getByText('monthlyCoinLimit 100 → 150'),
      ).toBeInTheDocument()
      expect(screen.getByText(/42/)).toBeInTheDocument()
    })

    it('sample 빈 → preview 미표시', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={0}
          sample={[]}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      expect(screen.queryByText(/샘플/)).not.toBeInTheDocument()
    })

    it('sample 7개 → preview 5개만 표시 (cap)', () => {
      const sample = Array.from({ length: 7 }, (_, i) => ({
        userId: `user-${i}-abcdefgh`,
        balance: 100 + i,
      }))
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={7}
          sample={sample}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      // 처음 5개 만 표시
      expect(screen.getByText(/user-0-a/)).toBeInTheDocument()
      expect(screen.getByText(/user-4-a/)).toBeInTheDocument()
      expect(screen.queryByText(/user-5-a/)).not.toBeInTheDocument()
    })
  })

  describe('applyMode', () => {
    it('default = next_reset + 권장 표시', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      const next = screen.getByDisplayValue('next_reset') as HTMLInputElement
      expect(next.checked).toBe(true)
      expect(screen.getByText('권장')).toBeInTheDocument()
    })

    it('immediate 선택 시 balanceDiff hint 표시 (양수)', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          balanceDiff={50}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByDisplayValue('immediate'))
      expect(screen.getByText(/\(1인당 잔액 변경: \+50\)/)).toBeInTheDocument()
    })

    it('immediate 선택 시 balanceDiff hint 표시 (음수)', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          balanceDiff={-30}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByDisplayValue('immediate'))
      expect(screen.getByText(/\(1인당 잔액 변경: -30\)/)).toBeInTheDocument()
    })

    it('balanceDiff=0 → hint 미표시', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          balanceDiff={0}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByDisplayValue('immediate'))
      expect(screen.queryByText(/1인당 잔액 변경/)).not.toBeInTheDocument()
    })

    it('showApplyMode=false → applyMode fieldset 숨김 (feature_coin_meta 용)', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          showApplyMode={false}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      expect(screen.queryByText('적용 시점')).not.toBeInTheDocument()
    })
  })

  describe('confirm / cancel', () => {
    it('확인 → onConfirm("next_reset") 호출 (default)', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByText('확인'))
      expect(onConfirm).toHaveBeenCalledWith('next_reset')
    })

    it('immediate 선택 후 확인 → onConfirm("immediate")', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByDisplayValue('immediate'))
      fireEvent.click(screen.getByText('확인'))
      expect(onConfirm).toHaveBeenCalledWith('immediate')
    })

    it('취소 → onClose 호출 + onConfirm 미호출', () => {
      render(
        <MatrixConfirmModal
          title="t"
          description="d"
          affectedUsers={1}
          onConfirm={onConfirm}
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByText('취소'))
      expect(onClose).toHaveBeenCalled()
      expect(onConfirm).not.toHaveBeenCalled()
    })
  })
})

/**
 * G-1 (2026-08-02) — **셀 수 없으면 세는 척하지 않는다.**
 *
 * 이전엔 feature 단위 설정 변경에서 `affectedUsers={0}` 을 넘겨 화면에
 * `영향: 0명 사용자` 가 떴다. 대상이 없어서가 아니라 **셀 수 없어서** 0 이었는데,
 * 읽는 사람에겐 "아무도 영향 없다" 로 보인다 — 위험한 방향으로 틀린 표시였다.
 */
describe('MatrixConfirmModal — 영향 대상 표기', () => {
  const base = {
    title: 't',
    description: 'd',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  }

  it('셀 수 있으면 숫자로 보여준다 (tier 변경 등)', () => {
    render(<MatrixConfirmModal {...base} affectedUsers={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText(/명/)).toBeInTheDocument()
  })

  it('🔴 셀 수 없으면 숫자 대신 대상을 말로 적는다', () => {
    render(
      <MatrixConfirmModal {...base} impactLabel="자소서 점검 을(를) 사용하는 모든 사용자" />,
    )
    expect(
      screen.getByText(/자소서 점검 을\(를\) 사용하는 모든 사용자/),
    ).toBeInTheDocument()
    // "0명" 같은 오해 소지가 있는 표기가 남아있지 않아야 한다
    expect(screen.queryByText(/0명/)).not.toBeInTheDocument()
  })

  it('문구를 안 주면 기본 문구로 대체 (숫자 0 으로 떨어지지 않는다)', () => {
    render(<MatrixConfirmModal {...base} />)
    expect(
      screen.getByText(/이 설정을 사용하는 모든 사용자/),
    ).toBeInTheDocument()
  })

  it('영향 0명은 여전히 표현 가능하다 (진짜 0일 때)', () => {
    render(<MatrixConfirmModal {...base} affectedUsers={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
