import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

describe('RouteErrorBoundary', () => {
  it('자식 크래시 시 fallback 렌더 (페이지 백지 방지)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('화면을 불러오지 못했어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('정상 자식은 그대로 렌더', () => {
    render(
      <RouteErrorBoundary>
        <span>정상 콘텐츠</span>
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('정상 콘텐츠')).toBeInTheDocument()
  })
})
