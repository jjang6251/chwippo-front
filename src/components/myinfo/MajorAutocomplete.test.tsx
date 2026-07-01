import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MajorAutocomplete } from './MajorAutocomplete'
import { autocompleteMajors } from '@/api/schools'

vi.mock('@/api/schools', () => ({
  autocompleteMajors: vi.fn(),
  autocompleteSchools: vi.fn(),
}))

const apiMock = vi.mocked(autocompleteMajors)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue([])
})

describe('MajorAutocomplete', () => {
  it('초기 render — combobox 보임', () => {
    render(<MajorAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('focus → dropdown 열림 + API 호출', async () => {
    render(<MajorAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(''))
  })

  it('typing → debounce 후 fetch', async () => {
    render(<MajorAutocomplete value="컴퓨터" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('컴퓨터'))
  })

  it('결과 클릭 → onChange 호출', async () => {
    apiMock.mockResolvedValue(['컴퓨터공학과'])
    const onChange = vi.fn()
    render(<MajorAutocomplete value="컴" onChange={onChange} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('컴퓨터공학과')).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText('컴퓨터공학과'))
    expect(onChange).toHaveBeenCalledWith('컴퓨터공학과')
  })

  it('결과 없음 → 안내 메시지 (직접 입력 OK)', async () => {
    apiMock.mockResolvedValue([])
    render(<MajorAutocomplete value="없는전공" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/직접 입력해도 돼요/)).toBeInTheDocument())
  })

  it('ArrowDown + Enter → 첫 항목 pick', async () => {
    apiMock.mockResolvedValue(['경영학과', '경제학과'])
    const onChange = vi.fn()
    render(<MajorAutocomplete value="경" onChange={onChange} />, { wrapper })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByText('경영학과')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('경영학과')
  })
})
