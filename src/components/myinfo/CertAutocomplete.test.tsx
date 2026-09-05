import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CertAutocomplete } from './CertAutocomplete'
import { autocompleteCerts } from '@/api/schools'

vi.mock('@/api/schools', () => ({
  autocompleteCerts: vi.fn(),
  autocompleteLangCerts: vi.fn(),
  autocompleteSchools: vi.fn(),
  autocompleteMajors: vi.fn(),
}))

const apiMock = vi.mocked(autocompleteCerts)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue([])
})

describe('CertAutocomplete', () => {
  it('초기 render — combobox', () => {
    render(<CertAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('focus → dropdown 열림 + fetch', async () => {
    render(<CertAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(''))
  })

  it('결과 클릭 → onChange + onSelect (metadata 전달)', async () => {
    const cert = {
      name: '정보처리기사',
      issuer: '한국산업인력공단',
      hasNumber: true,
      validYears: null,
      category: 'IT',
      popularity: 100,
    }
    apiMock.mockResolvedValue([cert])
    const onChange = vi.fn()
    const onSelect = vi.fn()
    render(<CertAutocomplete value="정보" onChange={onChange} onSelect={onSelect} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('정보처리기사')).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText('정보처리기사'))
    expect(onChange).toHaveBeenCalledWith('정보처리기사')
    expect(onSelect).toHaveBeenCalledWith(cert)
  })

  it('validYears 있으면 dropdown 에 유효 N년 표시', async () => {
    apiMock.mockResolvedValue([{
      name: 'CCNA', issuer: 'Cisco', hasNumber: true, validYears: 3, category: 'IT', popularity: 55,
    }])
    render(<CertAutocomplete value="CCNA" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/유효 3년/)).toBeInTheDocument())
  })

  it('category chip 렌더', async () => {
    apiMock.mockResolvedValue([{
      name: 'SQLD (SQL 개발자)', issuer: '한국데이터산업진흥원', hasNumber: true, validYears: null, category: 'IT', popularity: 90,
    }])
    render(<CertAutocomplete value="SQLD" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('IT')).toBeInTheDocument())
  })

  it('결과 없음 → 안내 메시지', async () => {
    apiMock.mockResolvedValue([])
    render(<CertAutocomplete value="없는자격증" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/직접 입력해도 돼요/)).toBeInTheDocument())
  })

  it('Escape → 닫힘', async () => {
    apiMock.mockResolvedValue([{
      name: '정보처리기사', issuer: '한국산업인력공단', hasNumber: true, validYears: null, category: 'IT', popularity: 100,
    }])
    render(<CertAutocomplete value="정보" onChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  /** 🔴 내부 `useId` 값은 밖에서 알 수 없다 — 라벨을 이으려면 id 를 받아야 한다 */
  it('id 를 주면 그 값이 input 에 실린다 (바깥 라벨과 잇는 유일한 통로)', () => {
    render(<CertAutocomplete id="cert-name" value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'cert-name')
  })

  it('id 를 안 주면 내부 id 로 스스로 굴러간다 (기존 호출부 회귀 방어)', () => {
    render(<CertAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox').id).toBeTruthy()
  })
})
