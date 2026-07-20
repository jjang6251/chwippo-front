/**
 * W2 — CompanyInfoSection spec.
 *
 * 5축 — 정상 / 404 (비상장사 silent) / 503 (한도 초과 안내 박스) / stale 라벨 / 재무·공시 옵셔널
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyInfoSection } from './CompanyInfoSection'
import { getCompanyDetails } from '@/api/companies'
import { DART_EXPANDED_STORAGE_KEY } from '@/utils/dartCollapse'
import type { CompanyDetails } from '@/types/company'

vi.mock('@/api/companies', () => ({
  getCompanyDetails: vi.fn(),
}))

const apiMock = vi.mocked(getCompanyDetails)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const makeAxiosError = (status: number): AxiosError => {
  const headers = new AxiosHeaders()
  const err = new AxiosError(`HTTP ${status}`)
  err.response = {
    status,
    data: {},
    statusText: '',
    headers,
    config: { headers },
  }
  return err
}

const makeDetails = (overrides: Partial<CompanyDetails> = {}): CompanyDetails => ({
  corpCode: '00266961',
  fetchedAt: Date.now(),
  isStale: false,
  profile: {
    corpName: 'NAVER',
    ceoName: '최수연',
    estDate: '19990602',
    homepage: 'www.navercorp.com',
    induty: '포털',
  },
  disclosures: [
    { receiptNo: 'A1', reportName: '분기보고서', receiptDate: '20251114' },
  ],
  financials: {
    bsnsYear: '2025',
    reportName: '2025 사업보고서',
    items: [
      { sjNm: '손익', accountNm: '매출액', thstrmAmount: '2500000000000' },
      { sjNm: '손익', accountNm: '영업이익', thstrmAmount: '400000000000' },
    ],
  },
  ...overrides,
})

beforeEach(() => {
  apiMock.mockReset()
  localStorage.clear() // DART 접힘 상태 전역 localStorage 격리 (기본 접힘)
})

/** 정상 데이터 렌더 후 "회사 정보" 토글을 눌러 본문을 펼친다 (기본 접힘). */
async function expandSection() {
  const toggle = await screen.findByRole('button', { name: /회사 정보/ })
  fireEvent.click(toggle)
}

describe('CompanyInfoSection', () => {
  it('정상 데이터 — (펼치면) 프로필·재무·공시 모두 표시', async () => {
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    await expandSection()
    expect(screen.getByText('최수연')).toBeInTheDocument()
    expect(screen.getByText('매출액')).toBeInTheDocument()
    expect(screen.getByText('분기보고서')).toBeInTheDocument()
  })

  it('DART 접힘 기본 — 헤더만 보이고 본문(프로필) 숨김', async () => {
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    // 접힘 기본 → 본문 필드 미렌더
    expect(screen.queryByText('최수연')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /회사 정보/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('펼침 → localStorage 에 상태 저장', async () => {
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    await expandSection()
    expect(localStorage.getItem(DART_EXPANDED_STORAGE_KEY)).toBe('1')
    expect(screen.getByText('최수연')).toBeInTheDocument()
  })

  it('localStorage=1(펼침 기억) → 마운트 시 이미 펼쳐진 상태', async () => {
    localStorage.setItem(DART_EXPANDED_STORAGE_KEY, '1')
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    // 클릭 없이 본문 노출
    await waitFor(() => expect(screen.getByText('최수연')).toBeInTheDocument())
  })

  it('isStale=true → "N일 전 정보" 라벨 표시', async () => {
    apiMock.mockResolvedValue(
      makeDetails({
        isStale: true,
        fetchedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h 전
      }),
    )

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('1일 전 정보')).toBeInTheDocument())
  })

  it('isStale=false → stale 라벨 안 보임', async () => {
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    expect(screen.queryByText(/시간 전 정보|일 전 정보/)).not.toBeInTheDocument()
  })

  it('404 (비상장사·매핑 안 됨) → silent 미렌더', async () => {
    apiMock.mockRejectedValue(makeAxiosError(404))

    const { container } = render(
      <CompanyInfoSection companyName="알수없는스타트업" />,
      { wrapper },
    )

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    // 로딩 끝나면 섹션 없어야 함
    await waitFor(() => expect(container.querySelector('h2')).toBeNull())
  })

  it('503 (DART 한도 초과 등) → "잠시 후 다시" 회색 안내 박스 표시', async () => {
    apiMock.mockRejectedValue(makeAxiosError(503))

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/잠시 후 다시 불러올게요/)).toBeInTheDocument(),
    )
  })

  it('재무 null — (펼치면) 재무 섹션 안 보이지만 프로필·공시는 보임', async () => {
    apiMock.mockResolvedValue(makeDetails({ financials: null }))

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    await expandSection()
    expect(screen.queryByText('매출액')).not.toBeInTheDocument()
    expect(screen.queryByText('최근 재무')).not.toBeInTheDocument()
    expect(screen.getByText('분기보고서')).toBeInTheDocument()
  })

  it('공시 빈 배열 — (펼치면) 공시 섹션 안 보이지만 프로필은 보임', async () => {
    apiMock.mockResolvedValue(makeDetails({ disclosures: [] }))

    render(<CompanyInfoSection companyName="네이버" />, { wrapper })

    await waitFor(() => expect(screen.getByText('회사 정보')).toBeInTheDocument())
    await expandSection()
    expect(screen.queryByText('최근 공시')).not.toBeInTheDocument()
    expect(screen.getByText('최수연')).toBeInTheDocument()
  })

  it('빈 회사명 → enabled=false, API 호출 안 함', () => {
    apiMock.mockResolvedValue(makeDetails())

    render(<CompanyInfoSection companyName="" />, { wrapper })

    expect(apiMock).not.toHaveBeenCalled()
  })
})
