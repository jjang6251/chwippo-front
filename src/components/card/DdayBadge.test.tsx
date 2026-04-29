import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DdayBadge } from './DdayBadge'

const FIXED_NOW = '2025-09-10'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${FIXED_NOW}T00:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DdayBadge', () => {
  describe('레이블 표시', () => {
    it('오늘 마감 → "D-day"', () => {
      render(<DdayBadge deadline="2025-09-10" />)
      expect(screen.getByText('D-day')).toBeInTheDocument()
    })

    it('1일 후 → "D-1"', () => {
      render(<DdayBadge deadline="2025-09-11" />)
      expect(screen.getByText('D-1')).toBeInTheDocument()
    })

    it('7일 후 → "D-7"', () => {
      render(<DdayBadge deadline="2025-09-17" />)
      expect(screen.getByText('D-7')).toBeInTheDocument()
    })

    it('어제 마감 (지남) → "D+1"', () => {
      render(<DdayBadge deadline="2025-09-09" />)
      expect(screen.getByText('D+1')).toBeInTheDocument()
    })

    it('14일 지남 → "D+14"', () => {
      render(<DdayBadge deadline="2025-08-27" />)
      expect(screen.getByText('D+14')).toBeInTheDocument()
    })
  })

  describe('색상 variant 클래스', () => {
    it('dday ≤ 2 → danger 클래스 적용', () => {
      const { container } = render(<DdayBadge deadline="2025-09-12" />)  // D-2
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-danger')
    })

    it('dday 0 (오늘) → danger 클래스', () => {
      const { container } = render(<DdayBadge deadline="2025-09-10" />)
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-danger')
    })

    it('dday = 3~7 → warning 클래스 적용', () => {
      const { container } = render(<DdayBadge deadline="2025-09-15" />)  // D-5
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-warning')
    })

    it('dday ≥ 8 → info (brand) 클래스 적용', () => {
      const { container } = render(<DdayBadge deadline="2025-09-20" />)  // D-10
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-brand')
    })

    it('마감 지남 (dday < 0) → muted 클래스 (text-text-quaternary)', () => {
      const { container } = render(<DdayBadge deadline="2025-09-05" />)  // D+5
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-text-quaternary')
    })
  })

  describe('DOM 구조', () => {
    it('span 태그로 렌더링', () => {
      render(<DdayBadge deadline="2025-09-11" />)
      const badge = screen.getByText('D-1')
      expect(badge.tagName.toLowerCase()).toBe('span')
    })

    it('rounded-full, border, font-mono 클래스 포함 (뱃지 형태)', () => {
      const { container } = render(<DdayBadge deadline="2025-09-11" />)
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('rounded-full')
      expect(badge.className).toContain('border')
      expect(badge.className).toContain('font-mono')
    })
  })
})
