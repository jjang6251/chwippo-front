import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepBar } from './StepBar'
import type { ApplicationStep } from '@/types/application'

const makeStep = (orderIndex: number, name: string): ApplicationStep => ({
  id: `step-${orderIndex}`,
  applicationId: 'app-1',
  orderIndex,
  name,
  scheduledDate: null,
  location: null,
})

const DEFAULT_STEPS: ApplicationStep[] = [
  makeStep(0, '서류 제출'),
  makeStep(1, '서류 발표'),
  makeStep(2, '1차 면접'),
  makeStep(3, '1차 결과 대기'),
  makeStep(4, '2차 면접'),
  makeStep(5, '2차 결과 대기'),
  makeStep(6, '최종 합격'),
]

describe('StepBar', () => {
  // ── 렌더링 ────────────────────────────────────────────
  describe('렌더링', () => {
    it('steps가 빈 배열이면 아무것도 렌더링하지 않음', () => {
      const { container } = render(<StepBar steps={[]} currentStepIndex={0} />)
      expect(container.firstChild).toBeNull()
    })

    it('steps 개수만큼 버튼(노드) 렌더링', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(DEFAULT_STEPS.length)
    })

    it('steps가 orderIndex 순서 무관하게 입력되어도 정렬해서 렌더링', () => {
      const shuffled = [makeStep(2, '1차 면접'), makeStep(0, '서류 제출'), makeStep(1, '서류 발표')]
      render(<StepBar steps={shuffled} currentStepIndex={0} />)
      // 3개 노드 렌더링 확인
      expect(screen.getAllByRole('button')).toHaveLength(3)
    })
  })

  // ── 진행률 ────────────────────────────────────────────
  describe('진행률 계산', () => {
    it('currentStepIndex=0, steps=7 → 0%', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} size="sm" />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('currentStepIndex=6 (마지막), steps=7 → 100%', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={6} size="sm" />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('currentStepIndex=3, steps=7 → Math.round(3/6*100) = 50%', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={3} size="sm" />)
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('steps=1 → Math.max(length-1, 1) = 1 (0으로 나누기 방지), idx=1이면 100%', () => {
      const oneStep = [makeStep(0, '서류 제출')]
      render(<StepBar steps={oneStep} currentStepIndex={0} size="sm" />)
      // 1개 스텝, currentStepIndex=0 → 0/max(0,1)*100 = 0%
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('size=md에서도 진행률 텍스트 표시', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={3} size="md" />)
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  // ── 클릭 핸들러 ────────────────────────────────────────
  describe('onStepClick', () => {
    it('onStepClick 제공 시 버튼 클릭 → 해당 index로 호출', () => {
      const onStepClick = vi.fn()
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={onStepClick} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[2])  // index 2 클릭

      expect(onStepClick).toHaveBeenCalledWith(2)
      expect(onStepClick).toHaveBeenCalledTimes(1)
    })

    it('onStepClick 미제공 시 버튼은 disabled', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled()
      })
    })

    it('onStepClick 제공 시 버튼은 활성화', () => {
      const onStepClick = vi.fn()
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={onStepClick} />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        expect(btn).not.toBeDisabled()
      })
    })

    it('첫 번째(index=0) 클릭 → onStepClick(0)', () => {
      const onStepClick = vi.fn()
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={3} onStepClick={onStepClick} />)

      fireEvent.click(screen.getAllByRole('button')[0])
      expect(onStepClick).toHaveBeenCalledWith(0)
    })

    it('마지막(index=6) 클릭 → onStepClick(6)', () => {
      const onStepClick = vi.fn()
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={onStepClick} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[6])
      expect(onStepClick).toHaveBeenCalledWith(6)
    })
  })

  // ── size prop ──────────────────────────────────────────
  describe('size prop', () => {
    it('size 미지정 시 기본값 "sm" → 진행률 % 텍스트 표시', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('size="md" → "현재: XXX" 텍스트 표시', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={2} size="md" />)
      expect(screen.getByText(/현재: 1차 면접/)).toBeInTheDocument()
    })

    it('size="md" → 모든 스텝 이름 렌더링', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} size="md" />)
      expect(screen.getByText('서류 제출')).toBeInTheDocument()
      expect(screen.getByText('최종 합격')).toBeInTheDocument()
    })
  })
})
