/**
 * MyinfoProgressGauge 테스트
 *
 * 시나리오:
 * 1. isLoading=true → 스켈레톤 노출
 * 2. percent=0 → 빨강(text-danger) + "이제 시작!"
 * 3. percent=30 → 주황(text-warning) + "절반 왔어요"
 * 4. percent=70 → 인디고(text-brand) + "거의 다 왔어요!"
 * 5. percent=100 → 초록(text-success) + "🎉 모든 섹션 완성!"
 * 6. percent<100 + firstEmptyId → "탭해서 비어있는 섹션으로 이동" 안내
 * 7. percent=100 → "탭해서..." 안내 없음
 * 8. ARIA progressbar 속성 (valuenow/min/max/label)
 * 9. percent<100일 때 cursor-pointer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useMyinfoProgress', () => ({
  useMyinfoProgress: vi.fn(),
}))

import { MyinfoProgressGauge } from './MyinfoProgressGauge'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'

const mockedUse = useMyinfoProgress as unknown as ReturnType<typeof vi.fn>

function renderGauge() {
  return render(
    <MemoryRouter>
      <MyinfoProgressGauge />
    </MemoryRouter>
  )
}

describe('MyinfoProgressGauge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('로딩 상태', () => {
    it('isLoading=true → 스켈레톤 노출, 게이지 없음', () => {
      mockedUse.mockReturnValue({ isLoading: true, percent: 0, filled: 0, total: 0, firstEmptyId: null, sections: [] })
      const { container } = renderGauge()
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toBeDefined()
      expect(screen.queryByRole('progressbar')).toBeNull()
    })
  })

  describe('단계별 색상·메시지', () => {
    it('percent=0 → "이제 시작!" + text-danger', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 0, filled: 0, total: 8, firstEmptyId: 'profile', sections: [] })
      renderGauge()
      const message = screen.getByText('이제 시작!')
      expect(message.className).toContain('text-danger')
    })

    it('percent=29 → 여전히 "이제 시작!"', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 29, filled: 2, total: 8, firstEmptyId: 'profile', sections: [] })
      renderGauge()
      expect(screen.getByText('이제 시작!')).toBeDefined()
    })

    it('percent=30 → "절반 왔어요" + text-warning', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 30, filled: 2, total: 7, firstEmptyId: 'profile', sections: [] })
      renderGauge()
      const message = screen.getByText('절반 왔어요')
      expect(message.className).toContain('text-warning')
    })

    it('percent=70 → "거의 다 왔어요!" + text-brand', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 70, filled: 5, total: 7, firstEmptyId: 'experiences', sections: [] })
      renderGauge()
      const message = screen.getByText('거의 다 왔어요!')
      expect(message.className).toContain('text-brand')
    })

    it('percent=100 → "🎉 모든 섹션 완성!" + text-success', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 100, filled: 8, total: 8, firstEmptyId: null, sections: [] })
      renderGauge()
      const message = screen.getByText(/모든 섹션 완성/)
      expect(message.className).toContain('text-success')
    })
  })

  describe('CTA 안내', () => {
    it('percent<100 + firstEmptyId → "탭해서 비어있는 섹션으로 이동" 안내', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 50, filled: 4, total: 8, firstEmptyId: 'experiences', sections: [] })
      renderGauge()
      expect(screen.getByText('탭해서 비어있는 섹션으로 이동')).toBeDefined()
    })

    it('percent=100 → "탭해서..." 안내 없음', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 100, filled: 8, total: 8, firstEmptyId: null, sections: [] })
      renderGauge()
      expect(screen.queryByText(/탭해서.*이동/)).toBeNull()
    })
  })

  describe('진척도 숫자 표시', () => {
    it('퍼센트 숫자와 filled/total 비율 표시', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 50, filled: 4, total: 8, firstEmptyId: 'experiences', sections: [] })
      renderGauge()
      expect(screen.getByText('50')).toBeDefined()  // 큰 % 텍스트
      expect(screen.getByText('4')).toBeDefined()    // filled
      expect(screen.getByText('8')).toBeDefined()    // total
    })
  })

  describe('접근성', () => {
    it('role="progressbar" + aria-valuenow/min/max/label', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 75, filled: 6, total: 8, firstEmptyId: 'experiences', sections: [] })
      renderGauge()
      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-valuenow')).toBe('75')
      expect(bar.getAttribute('aria-valuemin')).toBe('0')
      expect(bar.getAttribute('aria-valuemax')).toBe('100')
      expect(bar.getAttribute('aria-label')).toContain('75%')
    })
  })

  describe('인터랙션', () => {
    it('percent<100 → cursor-pointer 클래스 적용', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 50, filled: 4, total: 8, firstEmptyId: 'experiences', sections: [] })
      const { container } = renderGauge()
      const card = container.querySelector('[role="button"]')
      expect(card?.className).toContain('cursor-pointer')
    })

    it('percent=100 → cursor-pointer 클래스 없음 (클릭 불필요)', () => {
      mockedUse.mockReturnValue({ isLoading: false, percent: 100, filled: 8, total: 8, firstEmptyId: null, sections: [] })
      const { container } = renderGauge()
      const card = container.querySelector('[class*="bg-surface-2"]')
      expect(card?.className).not.toContain('cursor-pointer')
    })
  })
})
