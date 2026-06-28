/**
 * W1 — SampleCardDismissBar spec.
 *
 * count 표시 / ConfirmModal open → 취소 / ConfirmModal confirm → mutate.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SampleCardDismissBar } from './SampleCardDismissBar'
import { dismissAllSampleCards } from '@/api/users'

vi.mock('@/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/api/users')>(
    '@/api/users',
  )
  return { ...actual, dismissAllSampleCards: vi.fn() }
})

vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), show: vi.fn() },
}))

const dismissMock = vi.mocked(dismissAllSampleCards)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  dismissMock.mockReset()
  dismissMock.mockResolvedValue(undefined)
})

describe('SampleCardDismissBar', () => {
  it('count 3 → "샘플 카드 3개" 텍스트', () => {
    render(<SampleCardDismissBar count={3} />, { wrapper })
    expect(screen.getByText(/샘플 카드 3개/)).toBeInTheDocument()
  })

  it('"전체 숨기기" 클릭 → ConfirmModal open + mutate 호출 X', () => {
    render(<SampleCardDismissBar count={3} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /전체 숨기기/ }))

    expect(dismissMock).not.toHaveBeenCalled()
    expect(screen.getByText(/샘플 카드 3개를 모두 숨길까요/)).toBeInTheDocument()
  })

  it('ConfirmModal "모두 숨기기" → dismissAllSampleCards 호출', async () => {
    render(<SampleCardDismissBar count={3} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /전체 숨기기/ }))
    fireEvent.click(screen.getByRole('button', { name: /모두 숨기기/ }))

    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalledTimes(1)
    })
  })
})
