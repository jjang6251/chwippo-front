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
