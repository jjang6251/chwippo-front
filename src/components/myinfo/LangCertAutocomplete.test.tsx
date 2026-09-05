import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LangCertAutocomplete } from './LangCertAutocomplete'
import { autocompleteLangCerts } from '@/api/schools'

vi.mock('@/api/schools', () => ({
  autocompleteLangCerts: vi.fn(),
  autocompleteCerts: vi.fn(),
  autocompleteSchools: vi.fn(),
  autocompleteMajors: vi.fn(),
}))

const apiMock = vi.mocked(autocompleteLangCerts)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const jlpt = {
  name: 'JLPT', language: 'japanese' as const, issuer: '일본국제교류기금',
  scoreType: 'grade' as const, grades: ['N1', 'N2', 'N3', 'N4', 'N5'], scoreExample: 'N1', validYears: null,
  category: '일본어', popularity: 95,
}

const toeic = {
  name: 'TOEIC', language: 'english' as const, issuer: 'ETS / YBM',
  scoreType: 'number' as const, scoreMax: 990, scoreExample: '990', validYears: 2,
  category: '영어', popularity: 100,
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue([])
})

describe('LangCertAutocomplete', () => {
  it('결과 클릭 시 metadata 전파 (grades 포함)', async () => {
    apiMock.mockResolvedValue([jlpt])
    const onSelect = vi.fn()
    render(<LangCertAutocomplete value="JLPT" onChange={vi.fn()} onSelect={onSelect} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('JLPT')).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText('JLPT'))
    expect(onSelect).toHaveBeenCalledWith(jlpt)
  })

  it('scoreType=number 자격증 dropdown 에 만점 표시', async () => {
    apiMock.mockResolvedValue([toeic])
    render(<LangCertAutocomplete value="TOEIC" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/만점 990/)).toBeInTheDocument())
  })

  it('scoreType=grade 자격증 dropdown 에 등급 N단계 표시', async () => {
    apiMock.mockResolvedValue([jlpt])
    render(<LangCertAutocomplete value="JLPT" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/등급 5단계/)).toBeInTheDocument())
  })

  it('validYears 있으면 유효 N년 표시', async () => {
    apiMock.mockResolvedValue([toeic])
    render(<LangCertAutocomplete value="TOEIC" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/유효 2년/)).toBeInTheDocument())
  })

  it('language 별 chip 색상 (영어 / 일본어)', async () => {
    apiMock.mockResolvedValue([toeic, jlpt])
    render(<LangCertAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('영어')).toBeInTheDocument())
    expect(screen.getByText('일본어')).toBeInTheDocument()
  })

  it('결과 없음 안내', async () => {
    apiMock.mockResolvedValue([])
    render(<LangCertAutocomplete value="없는어학" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(/직접 입력해도 돼요/)).toBeInTheDocument())
  })

  /** 🔴 내부 `useId` 값은 밖에서 알 수 없다 — 라벨을 이으려면 id 를 받아야 한다 */
  it('id 를 주면 그 값이 input 에 실린다 (바깥 라벨과 잇는 유일한 통로)', () => {
    render(<LangCertAutocomplete id="lang-cert-type" value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'lang-cert-type')
  })
})
