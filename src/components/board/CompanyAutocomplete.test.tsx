/**
 * W2 — CompanyAutocomplete spec.
 *
 * 5축 — debounce 250ms / 키보드 ↑↓ enter / esc / 자유 입력 / dropdown sections
 *        (DART·조사 시드 vs user_added — 「맞춤 추천」 섹션은 직무 기준 재설계로 제거됨)
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

  it('🔴 빈 입력 포커스 → 패널이 열리지 않는다 (안내만 있는 빈 상자 금지 · 2026-08-28)', async () => {
    // 예전엔 focus 만으로 listbox 가 떠서 「회사명을 입력해주세요」 빈 상자가 아래 칸을 가렸다.
    // 보여줄 게 없으면 패널 자체를 안 연다 — 타이핑이 시작되면 그때 연다.
    const onChange = vi.fn()
    render(<CompanyAutocomplete value="" onChange={onChange} />, { wrapper })

    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // 데이터 훅은 그대로 돈다 (debounce 250ms 자연 통과) — 패널 표시와 fetch 는 별개
    await waitFor(() => expect(apiMock).toHaveBeenCalled())
  })

  it('타이핑이 시작되면 패널이 열린다', async () => {
    const onChange = vi.fn()
    render(<CompanyAutocomplete value="네" onChange={onChange} />, { wrapper })

    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
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

  /**
   * 🔴 **「맞춤 추천 — 직군 기반」 섹션 제거** (직무 기준 재설계 · 묶음 5).
   *
   * signup 직군 `boost` 로 만들던 섹션인데 직군 자체가 사라져 근거가 없어졌다.
   * 대신 조사 시드(`source: 'research'`)가 들어오는데, **별도 섹션을 만들지 않는다** —
   * 사용자에겐 DART 든 조사 시드든 그냥 「아는 회사」다.
   */
  it('조사 시드 항목 — DART 와 같은 첫 섹션 + 「조사 있음」 배지', async () => {
    apiMock.mockResolvedValue([
      { name: '네이버', domain: 'naver.com', source: 'dart' },
      { name: '대전성모병원', source: 'research' },
    ])

    render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())

    expect(screen.getByText('대전성모병원')).toBeInTheDocument()
    expect(screen.getByText('조사 있음')).toBeInTheDocument()
    // 두 항목 모두 「다른 사용자가 추가」 섹션 위 — 섹션 라벨이 하나도 안 붙는다
    expect(screen.queryByText(/다른 사용자가 추가/)).not.toBeInTheDocument()
  })

  it('🔴 「맞춤 추천 — 직군 기반」 섹션은 더 이상 없다', async () => {
    apiMock.mockResolvedValue([{ name: '네이버', domain: 'naver.com', source: 'dart' }])

    render(<CompanyAutocomplete value="네" onChange={vi.fn()} />, { wrapper })
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())

    expect(screen.queryByText(/맞춤 추천/)).not.toBeInTheDocument()
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

  /**
   * 입력 껍데기 variant (2026-08-28 카드 추가 모달 A안).
   *
   * 🔴 기본값이 `box` 인 게 핵심 — 이 컴포넌트를 쓰는 다른 화면이 모달 재스타일에
   * 딸려 바뀌면 안 된다.
   */
  describe('입력 껍데기 variant', () => {
    it('🔴 기본값 box — 현행 클래스 그대로 (회귀)', () => {
      render(<CompanyAutocomplete value="" onChange={vi.fn()} />, { wrapper })
      const input = screen.getByRole('combobox')

      expect(input.className).toContain('bg-input')
      expect(input.className).toContain('rounded-lg')
      expect(input.className).not.toContain('border-b-[1.5px]')
    })

    it('underline → 밑줄 입력 (채움 박스 없음)', () => {
      render(<CompanyAutocomplete value="" onChange={vi.fn()} variant="underline" />, { wrapper })
      const input = screen.getByRole('combobox')

      expect(input.className).toContain('border-b-[1.5px]')
      expect(input.className).toContain('bg-transparent')
      expect(input.className).not.toContain('bg-input')
    })

    it('underline 이어도 드롭다운 동작은 그대로', async () => {
      apiMock.mockResolvedValue([{ name: '네이버', domain: 'naver.com', source: 'dart' }])
      render(<CompanyAutocomplete value="네" onChange={vi.fn()} variant="underline" />, { wrapper })

      fireEvent.focus(screen.getByRole('combobox'))
      await waitFor(() => expect(screen.getByText('네이버')).toBeInTheDocument())
    })
  })

  /**
   * 🔴 **응답이 `null` 이어도 죽지 않는다** — 2026-08-05 데모 실사고 회귀.
   *
   * 구조분해 기본값(`const { data: items = [] }`)은 **undefined 에만** 적용된다.
   * 데모 어댑터는 미등록 경로에 `null` 을 주므로 기본값이 안 걸리고, 아래 `.filter`/`.length`
   * 에서 에러 바운더리로 떨어졌다 — **둘러보기의 첫 CTA 가 통째로 죽었다.**
   *
   * 서버가 계약을 어겨도 화면은 살아야 한다. e2e 는 데모 경로만 덮으므로, 계약 위반 자체는
   * 여기서 막는다 (운영 API 가 null 을 주는 경우도 같은 방어에 걸린다).
   */
  it('🔴 응답이 null 이어도 크래시하지 않고 빈 목록으로 처리한다', async () => {
    apiMock.mockResolvedValue(null as unknown as never)

    expect(() =>
      render(<CompanyAutocomplete value="카카오" onChange={vi.fn()} />, { wrapper }),
    ).not.toThrow()

    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(apiMock).toHaveBeenCalled())

    // 죽지 않고 "결과 없음" 경로로 간다
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
