/**
 * W2 — CompanyAutocomplete spec.
 *
 * 5축 — debounce 250ms / 키보드 ↑↓ enter / esc / 자유 입력 / dropdown sections (DART vs user_added vs 추천)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyAutocomplete } from './CompanyAutocomplete'
import { autocompleteCompanies } from '@/api/companies'

vi.mock('@/api/companies', () => ({
  autocompleteCompanies: vi.fn(),
}))

const apiMock = vi.mocked(autocompleteCompanies)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue([])
})

// real timer 사용 — 250ms debounce 통과 후 waitFor 가 자연스럽게 polling

describe('CompanyAutocomplete', () => {
  it('초기 render — input 보임, dropdown 닫힘', () => {
    render(<CompanyAutocomplete value="" onChange={vi.fn()} />, { wrapper })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('input focus → dropdown 열림 + autocomplete API 호출 (debounce 250ms)', async () => {
    const onChange = vi.fn()
    render(<CompanyAutocomplete value="" onChange={onChange} />, { wrapper })

    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling
    await waitFor(() => expect(apiMock).toHaveBeenCalled())
  })

  it('typing → onChange 호출 + debounce 후 fetch', async () => {
    const onChange = vi.fn()
    render(<CompanyAutocomplete value="네이" onChange={onChange} />, { wrapper })

    fireEvent.focus(screen.getByRole('combobox'))
    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('네이')
    })
  })

  it('dropdown items 표시 + "다른 사용자가 추가" 섹션 라벨 (DART 는 무라벨)', async () => {
    apiMock.mockResolvedValue([
      { name: '네이버', domain: 'naver.com', source: 'dart' },
      { name: '커스텀스타트업', source: 'user_added', userCount: 5 },
    ])

    render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))

    await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())
    expect(screen.getByText('커스텀스타트업')).toBeInTheDocument()
    expect(screen.getByText(/다른 사용자가 추가/)).toBeInTheDocument()
    // DART 섹션 라벨은 없음 (clean — 평범한 결과 = 무라벨)
    expect(screen.queryByText(/DART 상장사/)).not.toBeInTheDocument()
  })

  it('키보드 ↓ → activeIdx 첫번째 item, ↵ enter → onSelect + onChange + 닫기', async () => {
    apiMock.mockResolvedValue([{ name: '네이버', domain: 'naver.com', source: 'dart' }])

    const onChange = vi.fn()
    const onSelect = vi.fn()
    render(<CompanyAutocomplete value="네" onChange={onChange} onSelect={onSelect} />, {
      wrapper,
    })

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling
    await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('네이버')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: '네이버', domain: 'naver.com' }),
    )
    // 닫기
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Escape → dropdown 닫기', async () => {
    apiMock.mockResolvedValue([{ name: '네이버', domain: 'naver.com', source: 'dart' }])

    render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('빈 결과 → "검색 결과가 없어요" hint + 자유 입력 보존', async () => {
    apiMock.mockResolvedValue([])
    render(<CompanyAutocomplete value="ZZZZ" onChange={vi.fn()} />, { wrapper })

    fireEvent.focus(screen.getByRole('combobox'))
    // debounce 250ms + fetch 완료까지 polling
    await waitFor(() =>
      expect(screen.getByText(/검색 결과가 없어요/)).toBeInTheDocument(),
    )
  })

  it('자유 입력 enter (selected item 없음) → dropdown 닫기, onChange 그대로', async () => {
    apiMock.mockResolvedValue([])
    const onChange = vi.fn()
    render(<CompanyAutocomplete value="MyCompany" onChange={onChange} />, { wrapper })

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // value 는 props 기반 — 변경 X
  })

  it('맞춤 추천 섹션 — boost > 0 인 dart 항목 별도', async () => {
    apiMock.mockResolvedValue([
      { name: '네이버', domain: 'naver.com', source: 'dart', boost: 5 },
      { name: '네이처바이오', source: 'dart', boost: 0 },
    ])

    render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    // debounce 250ms 자연 통과 — waitFor 가 5s 안 polling
    await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())

    expect(screen.getByText(/맞춤 추천/)).toBeInTheDocument()
    // DART 섹션 라벨 X — 평범한 결과는 무라벨
  })

  /**
   * 출처 신뢰도 표시 (2026-07-28 — `로쏘(성심당` 실사례).
   * DART 목록에 없는 회사는 사용자 자유 입력이라 오타가 추천에 그대로 남는다.
   * 한 명만 넣은 이름은 "검증된 적 없다"를 드러내 사용자가 스스로 거르게 한다.
   *
   * 케이스:
   *  1. userCount 1 → "한 명만 추가했어요" (경고성 힌트)
   *  2. userCount 2+ → "N명이 추가" (숫자가 신뢰도)
   *  3. dart 항목엔 어떤 출처 힌트도 없다 (공식 목록이므로)
   *  4. accent(coral) 미사용 — 합격·pinned 전용 토큰이라 여기 쓰면 의도와 반대 신호
   */
  describe('출처 신뢰도 표시', () => {
    it('1. 한 명만 추가한 이름 → 미검증 힌트', async () => {
      apiMock.mockResolvedValue([
        { name: '로쏘(성심당', source: 'user_added', userCount: 1 },
      ])
      render(<CompanyAutocomplete value="로쏘" onChange={vi.fn()} />, { wrapper })
      fireEvent.focus(screen.getByRole('combobox'))

      await waitFor(() =>
        expect(screen.getByText('로쏘(성심당')).toBeInTheDocument(),
      )
      expect(screen.getByText('한 명만 추가했어요')).toBeInTheDocument()
      expect(screen.queryByText(/명이 추가/)).not.toBeInTheDocument()
    })

    it('2. 여러 명이 추가한 이름 → 인원수 표시', async () => {
      apiMock.mockResolvedValue([
        { name: '커스텀스타트업', source: 'user_added', userCount: 7 },
      ])
      render(<CompanyAutocomplete value="커스" onChange={vi.fn()} />, { wrapper })
      fireEvent.focus(screen.getByRole('combobox'))

      await waitFor(() =>
        expect(screen.getByText('커스텀스타트업')).toBeInTheDocument(),
      )
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.queryByText('한 명만 추가했어요')).not.toBeInTheDocument()
    })

    it('3. DART 항목엔 출처 힌트가 붙지 않는다', async () => {
      apiMock.mockResolvedValue([
        { name: '네이버', domain: 'naver.com', source: 'dart' },
      ])
      render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
      fireEvent.focus(screen.getByRole('combobox'))

      await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())
      expect(screen.queryByText('한 명만 추가했어요')).not.toBeInTheDocument()
      expect(screen.queryByText(/명이 추가/)).not.toBeInTheDocument()
    })

    it('4. 출처 힌트에 accent(coral) 토큰을 쓰지 않는다', async () => {
      apiMock.mockResolvedValue([
        { name: '커스텀스타트업', source: 'user_added', userCount: 3 },
      ])
      const { container } = render(
        <CompanyAutocomplete value="커스" onChange={vi.fn()} />,
        { wrapper },
      )
      fireEvent.focus(screen.getByRole('combobox'))

      await waitFor(() =>
        expect(screen.getByText('커스텀스타트업')).toBeInTheDocument(),
      )
      // DESIGN.md — accent 는 합격·pinned 전용. 가장 덜 검증된 항목이 가장 눈에 띄면 안 된다
      expect(container.querySelector('.text-accent')).toBeNull()
    })
  })

  it('disabled prop → input 비활성', () => {
    render(<CompanyAutocomplete value="" onChange={vi.fn()} disabled />, { wrapper })
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
