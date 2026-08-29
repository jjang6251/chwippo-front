/**
 * 공지 관리(admin) — 종류 · 형태 기본값 · 「지금 해보기」 두 칸.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *
 * **종류 → 형태 기본값**
 *  1. 새 공지는 「안내」 + 배너로 시작한다
 *  2. 종류를 「새 기능」으로 바꾸면 형태가 모달로 따라온다
 *  3. 새 기능 → 개선으로 되돌리면 형태도 배너로 돌아온다
 *  4. 🔴 형태를 사람이 직접 고른 뒤엔 종류를 바꿔도 그 선택을 안 덮는다
 *  5. 🔴 수정 화면은 저장된 형태를 그대로 연다 (종류가 새 기능이어도 배너면 배너)
 *
 * **CTA 두 칸**
 *  6. 한쪽만 채우면 인라인 경고 + 저장 잠김
 *  7. 둘 다 채우면 경고가 사라지고 저장이 열린다
 *  8. 🔴 경로가 `/` 로 시작하지 않으면 (외부 URL 등) 경고 + 저장 잠김
 *  9. 둘 다 비우면 정상 — 경고 없음
 *
 * **저장 페이로드**
 * 10. kind · cta_label · cta_path 를 실어 보낸다
 * 11. CTA 를 비우면 두 값 다 null 로 보낸다
 *
 * **서버 거절**
 * 12. 🔴 400 메시지를 **그대로** 보여준다 (배열 message 도 읽힌다)
 *
 * **목록**
 * 13. 행에 종류 칩이 뜬다
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpsAnnouncements } from './OpsAnnouncements'
import { getAdminAnnouncements, createAnnouncement } from '@/api/announcements'
import type { Announcement } from '@/types/announcement'

vi.mock('@/api/announcements', () => ({
  getAdminAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}))

const getMock = vi.mocked(getAdminAnnouncements)
const createMock = vi.mocked(createAnnouncement)

function announcement(over: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    title: '기존 공지',
    body: '기존 본문',
    type: 'banner',
    kind: 'notice',
    cta_label: null,
    cta_path: null,
    active: true,
    starts_at: null,
    ends_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OpsAnnouncements />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

async function openCreateForm() {
  renderPage()
  await screen.findByRole('button', { name: '+ 새 공지' })
  fireEvent.click(screen.getByRole('button', { name: '+ 새 공지' }))
  await screen.findByRole('dialog', { name: '새 공지 작성' })
}

const kindSelect = () => screen.getByLabelText('종류') as HTMLSelectElement
const typeRadio = (label: RegExp) => screen.getByRole('radio', { name: label }) as HTMLInputElement
const ctaLabelInput = () => screen.getByLabelText(/버튼 글자/) as HTMLInputElement
const ctaPathInput = () => screen.getByLabelText(/이동 경로/) as HTMLInputElement
const saveBtn = () => screen.getByRole('button', { name: /등록|수정 저장/ }) as HTMLButtonElement

/** 필수 칸(제목·본문)을 채워 저장 잠김이 CTA 때문인지 분명하게 만든다 */
function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText('공지 제목'), { target: { value: '제목' } })
  fireEvent.change(screen.getByPlaceholderText('공지 내용을 입력하세요'), {
    target: { value: '본문' },
  })
}

const CTA_PAIR_WARNING = /둘 다 채우거나 둘 다 비워/
const CTA_PATH_WARNING = /\/ 로 시작/

beforeEach(() => {
  vi.clearAllMocks()
  getMock.mockResolvedValue([])
})

afterEach(cleanup)

describe('OpsAnnouncements — 종류 → 형태 기본값', () => {
  it('1) 새 공지는 안내 + 배너로 시작', async () => {
    await openCreateForm()
    expect(kindSelect().value).toBe('notice')
    expect(typeRadio(/배너/).checked).toBe(true)
  })

  it('2) 새 기능으로 바꾸면 형태가 모달로 따라온다', async () => {
    await openCreateForm()
    fireEvent.change(kindSelect(), { target: { value: 'feature' } })
    expect(typeRadio(/모달/).checked).toBe(true)
  })

  it('3) 개선으로 되돌리면 형태도 배너로 돌아온다', async () => {
    await openCreateForm()
    fireEvent.change(kindSelect(), { target: { value: 'feature' } })
    fireEvent.change(kindSelect(), { target: { value: 'improvement' } })
    expect(typeRadio(/배너/).checked).toBe(true)
  })

  it('4) 형태를 직접 고른 뒤엔 종류를 바꿔도 안 덮는다', async () => {
    await openCreateForm()
    fireEvent.click(typeRadio(/모달/))
    fireEvent.change(kindSelect(), { target: { value: 'fix' } })
    expect(typeRadio(/모달/).checked).toBe(true)
  })

  it('5) 수정 화면은 저장된 형태를 그대로 연다', async () => {
    getMock.mockResolvedValue([announcement({ kind: 'feature', type: 'banner' })])
    renderPage()
    fireEvent.click(await screen.findByText('✎'))
    await screen.findByRole('dialog', { name: '공지 수정' })
    expect(kindSelect().value).toBe('feature')
    expect(typeRadio(/배너/).checked).toBe(true)
  })
})

describe('OpsAnnouncements — CTA 두 칸', () => {
  it('6) 한쪽만 채우면 경고 + 저장 잠김', async () => {
    await openCreateForm()
    fillRequired()
    fireEvent.change(ctaLabelInput(), { target: { value: '지금 해보기' } })
    expect(screen.getByText(CTA_PAIR_WARNING)).toBeInTheDocument()
    expect(saveBtn()).toBeDisabled()
  })

  it('7) 둘 다 채우면 경고가 사라지고 저장이 열린다', async () => {
    await openCreateForm()
    fillRequired()
    fireEvent.change(ctaLabelInput(), { target: { value: '지금 해보기' } })
    fireEvent.change(ctaPathInput(), { target: { value: '/board?add=posting' } })
    expect(screen.queryByText(CTA_PAIR_WARNING)).not.toBeInTheDocument()
    expect(saveBtn()).toBeEnabled()
  })

  it('8) / 로 시작하지 않는 경로 → 경고 + 저장 잠김', async () => {
    await openCreateForm()
    fillRequired()
    fireEvent.change(ctaLabelInput(), { target: { value: '지금 해보기' } })
    fireEvent.change(ctaPathInput(), { target: { value: 'https://example.com' } })
    expect(screen.getByText(CTA_PATH_WARNING)).toBeInTheDocument()
    expect(saveBtn()).toBeDisabled()
  })

  it('9) 둘 다 비우면 정상', async () => {
    await openCreateForm()
    fillRequired()
    expect(screen.queryByText(CTA_PAIR_WARNING)).not.toBeInTheDocument()
    expect(saveBtn()).toBeEnabled()
  })
})

describe('OpsAnnouncements — 저장 페이로드', () => {
  it('10) kind · cta_label · cta_path 를 실어 보낸다', async () => {
    createMock.mockResolvedValue(announcement())
    await openCreateForm()
    fillRequired()
    fireEvent.change(kindSelect(), { target: { value: 'feature' } })
    fireEvent.change(ctaLabelInput(), { target: { value: '지금 해보기' } })
    fireEvent.change(ctaPathInput(), { target: { value: '/board?add=posting' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'feature',
        type: 'modal',
        cta_label: '지금 해보기',
        cta_path: '/board?add=posting',
      }),
    )
  })

  it('11) CTA 를 비우면 두 값 다 null', async () => {
    createMock.mockResolvedValue(announcement())
    await openCreateForm()
    fillRequired()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'notice', cta_label: null, cta_path: null }),
    )
  })
})

describe('OpsAnnouncements — 서버 거절', () => {
  it('12) 400 메시지를 그대로 보여준다 (배열도 읽힌다)', async () => {
    createMock.mockRejectedValue({
      response: { data: { message: ['cta_path must start with /', 'cta_label too long'] } },
    })
    await openCreateForm()
    fillRequired()
    fireEvent.click(saveBtn())

    expect(
      await screen.findByText(/cta_path must start with \/ · cta_label too long/),
    ).toBeInTheDocument()
  })
})

describe('OpsAnnouncements — 목록', () => {
  it('13) 행에 종류 칩이 뜬다', async () => {
    getMock.mockResolvedValue([
      announcement({ id: 'x1', kind: 'feature', title: '새 기능 공지' }),
    ])
    renderPage()
    expect(await screen.findByText('새 기능 공지')).toBeInTheDocument()
    expect(screen.getByText('새 기능')).toBeInTheDocument()
  })
})
