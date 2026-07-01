import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SchoolAutocomplete } from './SchoolAutocomplete'
import { autocompleteSchools } from '@/api/schools'

vi.mock('@/api/schools', () => ({
  autocompleteSchools: vi.fn(),
  autocompleteMajors: vi.fn(),
}))

const apiMock = vi.mocked(autocompleteSchools)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue([])
})

describe('SchoolAutocomplete', () => {
  it('초기 render — combobox 보임, dropdown 닫힘', () => {
    render(<SchoolAutocomplete value="" onChange={vi.fn()} kind="univ" />, { wrapper })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('kind=null 시 focus 해도 dropdown 안 열림', () => {
    render(<SchoolAutocomplete value="" onChange={vi.fn()} kind={null} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('kind=null placeholder — 학교 단계 선택 안내', () => {
    render(<SchoolAutocomplete value="" onChange={vi.fn()} kind={null} />, { wrapper })
    expect(screen.getByPlaceholderText(/학교 단계를 먼저 선택/)).toBeInTheDocument()
  })

  it('kind=high — focus 시 dropdown 열림 + API 호출 (debounce 250ms)', async () => {
    render(<SchoolAutocomplete value="" onChange={vi.fn()} kind="high" />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('', 'high'))
  })

  it('typing → onChange + debounce 후 fetch', async () => {
    const onChange = vi.fn()
    render(<SchoolAutocomplete value="서울" onChange={onChange} kind="univ" />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('서울', 'univ'))
  })

  it('결과 항목 클릭 → onChange + onSelect 호출', async () => {
    const onChange = vi.fn()
    const onSelect = vi.fn()
    apiMock.mockResolvedValue([{ name: '서울대학교', region: '서울특별시', meta: '4년제' }])
    render(<SchoolAutocomplete value="서울" onChange={onChange} onSelect={onSelect} kind="univ" />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('서울대학교')).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText('서울대학교'))
    expect(onChange).toHaveBeenCalledWith('서울대학교')
    expect(onSelect).toHaveBeenCalledWith({ name: '서울대학교', region: '서울특별시', meta: '4년제' })
  })

  it('결과 없음 → 안내 메시지', async () => {
    apiMock.mockResolvedValue([])
    render(<SchoolAutocomplete value="없는학교" onChange={vi.fn()} kind="univ" />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/직접 입력해도 돼요/)).toBeInTheDocument())
  })

  it('Escape 키 → dropdown 닫힘', async () => {
    apiMock.mockResolvedValue([{ name: '가톨릭대학교', region: '경기도', meta: '4년제' }])
    render(<SchoolAutocomplete value="가" onChange={vi.fn()} kind="univ" />, { wrapper })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('ArrowDown → activeIdx 이동 + aria-activedescendant', async () => {
    apiMock.mockResolvedValue([
      { name: '가톨릭대학교', region: '경기도', meta: '4년제' },
      { name: '가천대학교', region: '경기도', meta: '4년제' },
    ])
    render(<SchoolAutocomplete value="가" onChange={vi.fn()} kind="univ" />, { wrapper })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByText('가톨릭대학교')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant')
  })
})
