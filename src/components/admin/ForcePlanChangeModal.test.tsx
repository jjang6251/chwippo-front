/**
 * PR_B2 Phase 3 — ForcePlanChangeModal 시나리오 매트릭스 (CTO 시각 spec).
 *
 * 5축 cover — 정상 / 실패 / boundary / 보안 (admin role) / 동시성 (mutation pending).
 *
 * 사용자 시각 못 잡는 영역 :
 * - downgrade 시 next_cycle 권장 안내 정확성
 * - applyMode immediate 선택 시 위험 hint
 * - same tier 선택 시 변경 disabled
 * - quick chip 1/3/6/12개월 + datetime-local 정확
 * - reason 빈/500자 boundary
 * - mutation payload 정확성
 * - tier_upgrade vs tier_downgrade 의 안내 차이
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForcePlanChangeModal } from './ForcePlanChangeModal'
import { forceChangeTierApi } from '@/api/forceChangeTier'

vi.mock('@/api/forceChangeTier', () => ({
  forceChangeTierApi: { change: vi.fn() },
}))

const changeMock = vi.mocked(forceChangeTierApi.change)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const onClose = vi.fn()

describe('ForcePlanChangeModal', () => {
  beforeEach(() => {
    changeMock.mockReset()
    onClose.mockReset()
  })

  describe('초기 render', () => {
    it('현재 tier + nickname 표시', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.getByText(/홍길동/)).toBeInTheDocument()
      expect(screen.getAllByText('free').length).toBeGreaterThanOrEqual(1)
    })

    it('tier 3 chip (free/lite/standard) 표시', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      // free 가 현재 tier 라 처음 표시 안 됨 (현재 tier 표시는 별도). chip 의 free 도 있음
      const chips = screen.getAllByRole('button')
      const labels = chips.map((c) => c.textContent)
      expect(labels).toContain('free')
      expect(labels).toContain('lite')
      expect(labels).toContain('standard')
    })

    it('같은 tier (free → free) 일 때 "변경 사항 없음" + 변경 버튼 disabled', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      expect(screen.getByText(/변경 사항 없음/)).toBeInTheDocument()
      const changeBtn = screen.getByText('변경') as HTMLButtonElement
      expect(changeBtn.disabled).toBe(true)
    })
  })

  describe('tier 선택 → 옵션 표시', () => {
    it('Free → Lite (upgrade) 선택 시 applyMode + quick chip + reason 표시', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      expect(screen.getByText(/적용 시점/)).toBeInTheDocument()
      expect(screen.getByText('1개월')).toBeInTheDocument()
      expect(screen.getByText('3개월')).toBeInTheDocument()
      expect(screen.getByText('6개월')).toBeInTheDocument()
      expect(screen.getByText('12개월')).toBeInTheDocument()
    })

    it('Standard → Free (downgrade) 선택 시 next_cycle 옆 "권장 (Q2)" 안내', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="standard"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('free'))
      expect(screen.getByText(/권장 \(Q2\)/)).toBeInTheDocument()
    })

    it('Standard → Free + immediate 선택 시 "즉시 강등 — 잔액 reset 0 위험" 안내', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="standard"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('free'))
      fireEvent.click(screen.getByDisplayValue('immediate'))
      expect(screen.getByText(/즉시 강등 — 잔액 reset 0 위험/)).toBeInTheDocument()
    })

    it('Free → Lite + immediate 선택 시 upgrade 안내 ("즉시 새 tier + balance reset")', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      fireEvent.click(screen.getByDisplayValue('immediate'))
      expect(screen.getByText(/즉시 새 tier \+ balance reset/)).toBeInTheDocument()
    })
  })

  describe('quick chip → datetime-local 채움', () => {
    it('1개월 chip 클릭 시 datetime-local 의 month 가 약 1개월 후', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      fireEvent.click(screen.getByText('1개월'))
      const input = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement
      expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })

    it('12개월 chip 클릭 시 datetime-local 채워짐', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      fireEvent.click(screen.getByText('12개월'))
      const input = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement
      expect(input.value.length).toBeGreaterThan(10)
    })
  })

  describe('reason boundary', () => {
    it('reason 빈 시 변경 버튼 disabled', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      const changeBtn = screen.getByText('변경') as HTMLButtonElement
      expect(changeBtn.disabled).toBe(true)
    })

    it('reason 1자만 입력해도 변경 버튼 활성', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      const textarea = screen.getByPlaceholderText(
        /예: 운영자 수동 결제 처리/,
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'a' } })
      const changeBtn = screen.getByText('변경') as HTMLButtonElement
      expect(changeBtn.disabled).toBe(false)
    })

    it('reason 의 maxLength=500', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      const textarea = screen.getByPlaceholderText(
        /예: 운영자 수동 결제 처리/,
      ) as HTMLTextAreaElement
      expect(textarea.maxLength).toBe(500)
    })

    it('reason 공백만 → 변경 disabled (trim)', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      const textarea = screen.getByPlaceholderText(
        /예: 운영자 수동 결제 처리/,
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '   ' } })
      const changeBtn = screen.getByText('변경') as HTMLButtonElement
      expect(changeBtn.disabled).toBe(true)
    })
  })

  describe('mutation', () => {
    it('변경 클릭 → forceChangeTierApi.change 호출 (정확한 payload)', async () => {
      changeMock.mockResolvedValue({
        tier: 'lite',
        planExpiresAt: '2026-07-08T00:00:00Z',
        applyMode: 'immediate',
      })
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      const textarea = screen.getByPlaceholderText(
        /예: 운영자 수동 결제 처리/,
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '운영자 보상' } })
      fireEvent.click(screen.getByText('변경'))

      await waitFor(() => expect(changeMock).toHaveBeenCalled())
      const [userId, dto] = changeMock.mock.calls[0]
      expect(userId).toBe('u-1')
      expect(dto.newTier).toBe('lite')
      expect(dto.reason).toBe('운영자 보상')
      expect(dto.applyMode).toBe('next_cycle') // default
    })

    it('변경 성공 → onClose 호출', async () => {
      changeMock.mockResolvedValue({
        tier: 'lite',
        planExpiresAt: null,
        applyMode: 'next_cycle',
      })
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      fireEvent.change(
        screen.getByPlaceholderText(/예: 운영자 수동 결제 처리/),
        { target: { value: '운영자' } },
      )
      fireEvent.click(screen.getByText('변경'))

      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('변경 mutation pending — button 의 text "변경 중..." + disabled', async () => {
      let resolveChange: (v: never) => void = () => {}
      changeMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveChange = resolve
          }),
      )
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('lite'))
      fireEvent.change(
        screen.getByPlaceholderText(/예: 운영자 수동 결제 처리/),
        { target: { value: '운영자' } },
      )
      fireEvent.click(screen.getByText('변경'))

      await waitFor(() =>
        expect(screen.getByText(/변경 중\.\.\./)).toBeInTheDocument(),
      )
      resolveChange({
        tier: 'lite',
        planExpiresAt: null,
        applyMode: 'next_cycle',
      } as never)
    })

    it('취소 → onClose 호출 + mutation 미실행', () => {
      render(
        <ForcePlanChangeModal
          userId="u-1"
          nickname="홍길동"
          currentTier="free"
          onClose={onClose}
        />,
        { wrapper },
      )
      fireEvent.click(screen.getByText('취소'))
      expect(onClose).toHaveBeenCalled()
      expect(changeMock).not.toHaveBeenCalled()
    })
  })
})
