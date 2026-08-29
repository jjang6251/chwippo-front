/**
 * 「생성 중」 카드 — 4가지 모습.
 *
 * ## 케이스 목록
 *
 * **생성 중**
 *  1. 단계 문구가 1.5초마다 넘어간다
 *  2. 8초를 넘기면 「조금 오래 걸리네요」로 바뀐다
 *  3. 🔴 진행률 바를 그리지 않는다 (실제 진행을 모르는데 그리면 거짓말)
 *  4. 문구가 `aria-live` 로 읽힌다
 *
 * **회사명 보완**
 *  5. 회사명 칸 + 「직무·전형·날짜는 이미 준비됐어요」
 *  6. 비어 있으면 버튼 잠김 · 채우면 열림
 *  7. 🔴 commit 은 **hash 와 회사명만** 보낸다
 *
 * **직무 보완**
 *  8. 후보 ≤3 → 카드 안에서 바로 고른다 (버튼 없음)
 *  9. 후보 ≥4 → 「직무 고르기」 버튼만 (목록은 시트에서)
 * 10. 시트를 열면 묶음 소제목과 배지가 보인다
 * 11. 직무를 고르면 그 표기로 2차 호출
 * 12. 「직접 입력…」 → 자유 입력 → 그 값으로 2차 호출
 *
 * **실패 2종**
 * 13. 공고 아님 → 「직접 입력하기 →」가 찾은 값을 들고 모달로 넘긴다 + 카드는 사라진다
 * 14. 서버 오류 → 「다시 시도 →」가 같은 원문으로 다시 파싱한다
 * 15. 🔴 원문이 없으면(새로고침 복원) 「다시 시도」 대신 직접 입력으로 보낸다
 * 16. ✕ 로 언제든 치울 수 있다
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runPostingCommit = vi.fn()
const runPostingParse = vi.fn()
vi.mock('@/stores/pendingCardStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/pendingCardStore')>()),
  runPostingCommit: (...a: unknown[]) => runPostingCommit(...a),
  runPostingParse: (...a: unknown[]) => runPostingParse(...a),
}))

vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: { value: string; onChange: (v: string) => void }) => (
    <input
      aria-label="회사명"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}))

import { PendingCard } from './PendingCard'
import { usePendingCardStore, type PendingCardEntry } from '@/stores/pendingCardStore'
import { useAuthStore } from '@/stores/authStore'

const onManualFallback = vi.fn()

function entry(over: Partial<PendingCardEntry> = {}): PendingCardEntry {
  return {
    tempId: 't1',
    textHash: 'h',
    rawText: '공고 원문',
    status: 'parsing',
    hash: null,
    candidates: [],
    companyName: null,
    jobTitle: null,
    failure: null,
    reason: null,
    startedAt: Date.now(),
    demo: false,
    ...over,
  }
}

function renderCard(e: PendingCardEntry) {
  return render(
    <MemoryRouter>
      <PendingCard entry={e} onManualFallback={onManualFallback} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  usePendingCardStore.getState().reset()
  useAuthStore.getState().clearAuth()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('생성 중', () => {
  it('1·4) 문구가 1.5초마다 넘어가고 aria-live 로 읽힌다', () => {
    vi.useFakeTimers()
    renderCard(entry())
    const line = screen.getByText('공고 읽는 중…')
    expect(line).toHaveAttribute('aria-live', 'polite')

    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('전형 찾는 중…')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('날짜 맞추는 중…')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('공고 읽는 중…')).toBeInTheDocument()
  })

  it('2) 8초를 넘기면 문구가 바뀐다', () => {
    vi.useFakeTimers()
    renderCard(entry())
    act(() => { vi.advanceTimersByTime(8000) })
    expect(screen.getByText('조금 오래 걸리네요 — 곧 돼요')).toBeInTheDocument()
  })

  it('2-b) 이미 8초가 지난 뒤 마운트되면 곧바로 그 문구다 (SPA 복귀)', () => {
    vi.useFakeTimers()
    renderCard(entry({ startedAt: Date.now() - 20_000 }))
    expect(screen.getByText('조금 오래 걸리네요 — 곧 돼요')).toBeInTheDocument()
  })

  it('3) 🔴 진행률 바가 없다', () => {
    const { container } = renderCard(entry())
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })
})

describe('회사명 보완', () => {
  const e = () => entry({ status: 'needs-company', hash: 'h1', jobTitle: '브랜드 마케터' })

  it('5·6) 칸과 안내 · 비면 잠김 · 채우면 열림', () => {
    renderCard(e())
    expect(screen.getByText('회사명을 찾지 못했어요')).toBeInTheDocument()
    expect(screen.getByText('직무·전형·날짜는 이미 준비됐어요')).toBeInTheDocument()

    const btn = screen.getByRole('button', { name: '카드 만들기' })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('회사명'), { target: { value: '무신사' } })
    expect(btn).toBeEnabled()
  })

  it('7) 🔴 hash 와 회사명만 보낸다', () => {
    renderCard(e())
    fireEvent.change(screen.getByLabelText('회사명'), { target: { value: '  무신사  ' } })
    fireEvent.click(screen.getByRole('button', { name: '카드 만들기' }))
    expect(runPostingCommit).toHaveBeenCalledWith('t1', {
      hash: 'h1',
      companyName: '무신사',
      demo: false,
    })
  })
})

describe('직무 보완', () => {
  const few = ['브랜드 마케터', '프론트엔드 개발자', 'MD']
  const many = [
    '사무영업(일반)',
    '사무영업(IT)',
    '차량(기계)',
    '차량(전기)',
    '토목(일반)',
  ]

  it('8) 후보 3개면 카드 안에서 바로 고른다', () => {
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: few }))
    expect(screen.getByText('어느 직무로 지원하세요?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '직무 고르기' })).toBeNull()
    expect(screen.getByRole('listbox', { name: '직무 후보' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(few.length + 1) // + 직접 입력…
  })

  it('9) 후보 4개 이상이면 버튼만 · 목록은 시트에서', () => {
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: many }))
    expect(screen.getByText('직무를 골라 주세요')).toBeInTheDocument()
    expect(screen.getByText('공고에 부문이 5개예요')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('10) 시트를 열면 묶음 소제목이 보인다', () => {
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: many }))
    fireEvent.click(screen.getByRole('button', { name: '직무 고르기' }))
    expect(screen.getByRole('listbox', { name: '직무 후보' })).toBeInTheDocument()
    expect(screen.getByText('사무영업')).toBeInTheDocument()
    expect(screen.getByText('차량')).toBeInTheDocument()
  })

  it('10-b) 내 희망 직무와 가까운 후보에 배지', () => {
    useAuthStore.getState().setUser({
      id: 'u1',
      nickname: '테스터',
      email: null,
      role: 'user',
      onboardedAt: null,
      termsAgreedAt: null,
      aiConsentAt: null,
      aiConsentVersion: null,
      onboardedCoinAt: null,
      signupJobCategories: null,
      signupOtherText: null,
      signupSeriesId: null,
      signupJobTitle: '간호사',
      sampleCardsDismissedAt: null,
      calendarHomeIntroDismissedAt: null,
      alarmPromptedAt: null,
    })
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: ['간호사', 'MD'] }))
    expect(screen.getByText('✦ 내 직무와 가까움')).toBeInTheDocument()
  })

  it('11) 고른 표기 그대로 2차 호출', () => {
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: few }))
    fireEvent.click(screen.getByRole('option', { name: /브랜드 마케터/ }))
    expect(runPostingCommit).toHaveBeenCalledWith('t1', {
      hash: 'h1',
      jobContext: '브랜드 마케터',
      demo: false,
    })
  })

  it('12) 「직접 입력…」 → 자유 입력으로 2차 호출', () => {
    renderCard(entry({ status: 'needs-job', hash: 'h1', candidates: few }))
    fireEvent.click(screen.getByRole('option', { name: /직접 입력…/ }))
    fireEvent.change(screen.getByLabelText('지원 직무'), {
      target: { value: '비공개(외국계 제조사)' },
    })
    fireEvent.click(screen.getByRole('button', { name: '카드 만들기' }))
    expect(runPostingCommit).toHaveBeenCalledWith('t1', {
      hash: 'h1',
      jobContext: '비공개(외국계 제조사)',
      demo: false,
    })
  })
})

describe('실패 2종', () => {
  it('13) 공고 아님 → 찾은 값을 들고 직접 입력으로', () => {
    usePendingCardStore.getState().start({ rawText: '아무 글' })
    const e = entry({
      tempId: usePendingCardStore.getState().entries[0].tempId,
      status: 'failed',
      failure: 'not-posting',
      jobTitle: '브랜드 마케터',
    })
    renderCard(e)
    expect(screen.getByText('공고로 보이지 않아요')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '직접 입력하기 →' }))
    expect(onManualFallback).toHaveBeenCalledWith({
      companyName: null,
      jobTitle: '브랜드 마케터',
      companyNotFound: true,
    })
    expect(usePendingCardStore.getState().entries).toHaveLength(0)
  })

  it('14) 서버 오류 → 같은 원문으로 다시 시도', () => {
    renderCard(entry({ status: 'failed', failure: 'error' }))
    expect(screen.getByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument()
    expect(screen.getByText('붙여넣은 글은 그대로 있어요')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도 →' }))
    expect(runPostingParse).toHaveBeenCalledWith('t1', {
      rawText: '공고 원문',
      demo: false,
    })
  })

  it('14-b) 서버 문구가 있으면 그걸 쓴다', () => {
    renderCard(entry({ status: 'failed', failure: 'error', reason: '오늘 한도를 다 썼어요' }))
    expect(screen.getByText('오늘 한도를 다 썼어요')).toBeInTheDocument()
  })

  it('15) 🔴 원문이 없으면 다시 시도 대신 직접 입력', () => {
    renderCard(entry({ status: 'failed', failure: 'error', rawText: '' }))
    expect(screen.getByRole('button', { name: '직접 입력하기 →' })).toBeInTheDocument()
    expect(screen.getByText('다시 붙여넣어 주세요')).toBeInTheDocument()
  })

  it('16) ✕ 로 치운다', () => {
    usePendingCardStore.getState().start({ rawText: '아무 글' })
    const tempId = usePendingCardStore.getState().entries[0].tempId
    renderCard(entry({ tempId, status: 'needs-company', hash: 'h' }))
    fireEvent.click(screen.getByRole('button', { name: '이 카드 만들기 그만두기' }))
    expect(usePendingCardStore.getState().entries).toHaveLength(0)
  })
})
