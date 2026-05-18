/**
 * StarToggle 테스트
 *
 * 시나리오:
 * 1. starred=false → "즐겨찾기 추가" aria-label + aria-pressed=false
 * 2. starred=true → "즐겨찾기 해제" aria-label + aria-pressed=true
 * 3. starred=false → outline 별 (filled 별 아님)
 * 4. starred=true → text-warning 색상 적용
 * 5. 클릭 시 onToggle 호출
 * 6. disabled=true → onToggle 호출 안 됨
 * 7. e.stopPropagation 동작 (부모 onClick 차단)
 * 8. size='sm' vs 'md' → 다른 크기 클래스
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StarToggle } from './StarToggle'

describe('StarToggle', () => {
  describe('starred 상태별 aria 속성', () => {
    it('starred=false → aria-label="즐겨찾기 추가", aria-pressed=false', () => {
      render(<StarToggle starred={false} onToggle={() => {}} />)
      const btn = screen.getByRole('button', { name: '즐겨찾기 추가' })
      expect(btn).toBeDefined()
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    })

    it('starred=true → aria-label="즐겨찾기 해제", aria-pressed=true', () => {
      render(<StarToggle starred={true} onToggle={() => {}} />)
      const btn = screen.getByRole('button', { name: '즐겨찾기 해제' })
      expect(btn).toBeDefined()
      expect(btn.getAttribute('aria-pressed')).toBe('true')
    })
  })

  describe('색상·시각 표현', () => {
    it('starred=true → text-warning 클래스 적용 (강조 색상)', () => {
      render(<StarToggle starred={true} onToggle={() => {}} />)
      const btn = screen.getByRole('button', { name: '즐겨찾기 해제' })
      expect(btn.className).toContain('text-warning')
    })

    it('starred=false → text-text-quaternary 클래스 (중성 색상)', () => {
      render(<StarToggle starred={false} onToggle={() => {}} />)
      const btn = screen.getByRole('button', { name: '즐겨찾기 추가' })
      expect(btn.className).toContain('text-text-quaternary')
      expect(btn.className).not.toContain('text-warning')
    })

    it('starred=true → SVG fill="currentColor" (filled 별)', () => {
      const { container } = render(<StarToggle starred={true} onToggle={() => {}} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('fill')).toBe('currentColor')
    })

    it('starred=false → SVG fill="none" (outline 별)', () => {
      const { container } = render(<StarToggle starred={false} onToggle={() => {}} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('fill')).toBe('none')
    })
  })

  describe('상호작용', () => {
    it('클릭 시 onToggle 호출', () => {
      const onToggle = vi.fn()
      render(<StarToggle starred={false} onToggle={onToggle} />)
      fireEvent.click(screen.getByRole('button'))
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('disabled=true → 클릭해도 onToggle 호출 안 됨', () => {
      const onToggle = vi.fn()
      render(<StarToggle starred={false} onToggle={onToggle} disabled />)
      const btn = screen.getByRole('button')
      // disabled 버튼은 클릭 이벤트 자체가 안 발생
      fireEvent.click(btn)
      expect(onToggle).not.toHaveBeenCalled()
    })

    it('disabled 시 opacity-50·cursor-not-allowed 클래스 적용', () => {
      render(<StarToggle starred={false} onToggle={() => {}} disabled />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('opacity-50')
      expect(btn.className).toContain('cursor-not-allowed')
    })

    it('e.stopPropagation — 부모 onClick 차단', () => {
      const parentClick = vi.fn()
      const onToggle = vi.fn()
      render(
        <div onClick={parentClick}>
          <StarToggle starred={false} onToggle={onToggle} />
        </div>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(onToggle).toHaveBeenCalledTimes(1)
      expect(parentClick).not.toHaveBeenCalled()
    })
  })

  describe('size prop', () => {
    it('size 미지정 시 디폴트 sm → w-8 h-8', () => {
      render(<StarToggle starred={false} onToggle={() => {}} />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('w-8')
      expect(btn.className).toContain('h-8')
    })

    it('size="md" → w-9 h-9', () => {
      render(<StarToggle starred={false} onToggle={() => {}} size="md" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('w-9')
      expect(btn.className).toContain('h-9')
    })
  })
})
