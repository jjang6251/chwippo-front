/**
 * 카드 상세 확인 줄 — 결과 시트를 못 본 경우의 폴백.
 *
 * ## 케이스 목록
 * 1. 문구와 [확인] 버튼이 있다
 * 2. [확인] → `reviewed` 기록 + 줄이 사라진다
 * 3. 🔴 기록이 실패해도 줄은 사라진다 (사용자가 할 일이 없다 · 다음 조회에서 다시 뜬다)
 * 4. 🔴 데모에선 서버를 부르지 않는다
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const patchMeta = vi.fn()
vi.mock('@/api/jobPosting', () => ({
  jobPostingCardApi: { patchMeta: (...a: unknown[]) => patchMeta(...a) },
}))

let demo = false
vi.mock('@/contexts/demoMode', () => ({ useDemoMode: () => demo }))

import { PostingReviewLine } from './PostingReviewLine'

beforeEach(() => {
  vi.clearAllMocks()
  demo = false
  patchMeta.mockResolvedValue(null)
})
afterEach(cleanup)

describe('PostingReviewLine', () => {
  it('1) 문구와 확인 버튼', () => {
    render(<PostingReviewLine applicationId="app-1" />)
    expect(screen.getByText(/공고에서 채웠어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument()
  })

  it('2) 확인 → reviewed 기록 + 줄이 사라진다', async () => {
    const onReviewed = vi.fn()
    render(<PostingReviewLine applicationId="app-1" onReviewed={onReviewed} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    await waitFor(() => expect(patchMeta).toHaveBeenCalledWith('app-1', { reviewed: true }))
    expect(screen.queryByText(/공고에서 채웠어요/)).toBeNull()
    expect(onReviewed).toHaveBeenCalled()
  })

  it('3) 🔴 기록이 실패해도 줄은 사라진다', async () => {
    patchMeta.mockRejectedValue(new Error('network'))
    render(<PostingReviewLine applicationId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByText(/공고에서 채웠어요/)).toBeNull())
  })

  it('4) 🔴 데모는 서버를 부르지 않는다', () => {
    demo = true
    render(<PostingReviewLine applicationId="app-1" />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(patchMeta).not.toHaveBeenCalled()
    expect(screen.queryByText(/공고에서 채웠어요/)).toBeNull()
  })

  it('5) 직무가 비어 있으면 「직무와 날짜」를 확인하라고 한다 (CEO 실기 — JD 가 PDF 인 공고)', () => {
    render(<PostingReviewLine applicationId="app-1" missingJobTitle />)
    expect(screen.getByText('직무와 날짜')).toBeInTheDocument()
    cleanup()
    render(<PostingReviewLine applicationId="app-1" />)
    expect(screen.queryByText('직무와 날짜')).toBeNull()
    expect(screen.getByText('날짜')).toBeInTheDocument()
  })
})
