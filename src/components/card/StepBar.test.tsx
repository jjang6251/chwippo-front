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
  notes: null,
  pinnedContent: null,
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
      // 컴포넌트는 step node 버튼(aria-label 있음)과 step 이름 레이블 버튼 두 행을 렌더링
      // aria-label 있는 버튼 = step node 버튼
      const nodeButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('aria-label'))
      expect(nodeButtons).toHaveLength(DEFAULT_STEPS.length)
    })

    it('steps가 orderIndex 순서 무관하게 입력되어도 정렬해서 렌더링', () => {
      const shuffled = [makeStep(2, '1차 면접'), makeStep(0, '서류 제출'), makeStep(1, '서류 발표')]
      render(<StepBar steps={shuffled} currentStepIndex={0} />)
      // node 버튼(aria-label 있음) 3개 렌더링 확인
      const nodeButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('aria-label'))
      expect(nodeButtons).toHaveLength(3)
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

    it('onStepClick 제공 시 step node 버튼은 활성화 (이름 레이블 버튼은 onStepNameClick 기준으로 별도 제어)', () => {
      const onStepClick = vi.fn()
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={onStepClick} />)
      // aria-label 있는 버튼 = step node 버튼 → onStepClick 제공 시 활성화
      const nodeButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('aria-label'))
      nodeButtons.forEach((btn) => {
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

  // ── 경계값 방어 ────────────────────────────────────────
  describe('경계값 방어', () => {
    it('currentStepIndex가 steps 범위 초과해도 크래시 없이 렌더링', () => {
      expect(() =>
        render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={99} />)
      ).not.toThrow()
    })

    it('currentStepIndex가 음수여도 크래시 없이 렌더링', () => {
      expect(() =>
        render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={-1} />)
      ).not.toThrow()
    })
  })

  /**
   * 🔴 **터치에는 hover 가 없다.** `hover:scale-125` 만 있던 시절, 모바일에서 노드를 눌러도
   * 아무 신호가 없어 「눌러도 단계가 움직인다」는 걸 아무도 몰랐다 (2026-08-24 실사용 보고).
   * 눌린 순간을 눈에 보이게 만드는 게 `pressedIndex` 이고, CSS `active:` 로는 못 건다 —
   * 누르는 오버레이 버튼이 점의 **형제가 아니라 조상 셀의 자식**이라 선택자가 닿지 않는다.
   */
  describe('누름·hover 피드백', () => {
    const dot = (i: number) =>
      screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-label'))[i]
        .parentElement?.querySelector('div[aria-hidden="true"]')

    it('🔴 누르면 점이 커지고 헤일로가 붙는다 (터치의 유일한 신호)', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={vi.fn()} />)
      const btn = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-label'))[3]
      expect(dot(3)?.className).not.toContain('scale-125')
      fireEvent.pointerDown(btn)
      expect(dot(3)?.className).toContain('scale-125')
      fireEvent.pointerUp(btn)
      expect(dot(3)?.className).not.toContain('scale-125')
    })

    it('취소(스크롤로 전환)돼도 눌림이 풀린다 — 눌린 채로 굳으면 안 된다', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={vi.fn()} />)
      const btn = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-label'))[2]
      fireEvent.pointerDown(btn)
      fireEvent.pointerCancel(btn)
      expect(dot(2)?.className).not.toContain('scale-125')
    })

    it('hover → 스텝 이름 툴팁 · 벗어나면 사라진다', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} onStepClick={vi.fn()} />)
      const btn = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-label'))[1]
      fireEvent.mouseEnter(btn)
      // 레이블(span)과 툴팁 둘 다 같은 이름을 그린다 — 늘어난 쪽이 툴팁이다
      expect(screen.getAllByText(DEFAULT_STEPS[1].name).length).toBeGreaterThan(1)
      fireEvent.mouseLeave(btn)
      expect(screen.getAllByText(DEFAULT_STEPS[1].name).length).toBe(1)
    })

    it('🔴 이동할 수 없으면(onStepClick 없음) 눌러도 커지지 않는다', () => {
      render(<StepBar steps={DEFAULT_STEPS} currentStepIndex={0} />)
      const btn = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-label'))[1]
      fireEvent.pointerDown(btn)
      expect(dot(1)?.className).not.toContain('scale-125')
    })
  })

  // ── 공고 날짜 힌트 ────────────────────────────────────
  /**
   * 공고가 날짜 대신 **말로** 알려 준 것 (「9월 예정」·「추후 공지」).
   *
   * 케이스: ① 힌트만 있으면 이름 아래 캡션 ② 날짜가 있으면 힌트를 안 그린다
   * ③ 둘 다 없으면 아무것도 안 그린다 (「—」 같은 자리채움 금지)
   */
  describe('공고 날짜 힌트', () => {
    it('힌트만 있으면 스텝 이름 아래 캡션으로 그린다', () => {
      const steps = [
        { ...makeStep(0, '서류 접수'), dateHint: null },
        { ...makeStep(1, '필기 전형'), dateHint: '9월 중 예정' },
      ]
      render(<StepBar steps={steps} currentStepIndex={0} />)
      expect(screen.getByText('9월 중 예정')).toBeInTheDocument()
    })

    it('🔴 날짜가 있으면 힌트를 그리지 않는다 (같은 칸에 두 말이 서면 안 된다)', () => {
      const steps = [
        {
          ...makeStep(0, '서류 접수'),
          scheduledDate: '2026-09-15T00:00:00+09:00',
          dateHint: '9월 중 예정',
        },
      ]
      render(<StepBar steps={steps} currentStepIndex={0} />)
      expect(screen.queryByText('9월 중 예정')).toBeNull()
    })

    it('힌트도 날짜도 없으면 자리를 만들지 않는다', () => {
      render(<StepBar steps={[makeStep(0, '서류 접수')]} currentStepIndex={0} />)
      expect(screen.queryByText('—')).toBeNull()
    })
  })
})
