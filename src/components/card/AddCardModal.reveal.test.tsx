/**
 * AddCardModal — 카드 생성 성공 직후 회사 조사 트리거.
 *
 * 시나리오:
 * 1. 일반 카드 → 방금 만든 카드가 펼침 대상이 된다 + 조사 prefetch (countHit:false)
 * 2. 🔴 첫 카드(축하 오버레이) → 펼침 대상 **지정 안 함** (연출 두 번 금지) · prefetch 는 그대로
 * 3. 연속 추가 → 대상이 마지막 카드로 옮겨간다 (쌓이지 않는다)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddCardModal } from './AddCardModal'
import { coverletterDocApi } from '@/api/coverletterDoc'
import { useCelebrationStore } from '@/stores/celebrationStore'
import { useResearchRevealStore } from '@/stores/researchRevealStore'
import { shouldCelebrateFirstCard } from '@/utils/firstCardCelebration'
import type { Application } from '@/types/application'

vi.mock('@/components/board/CompanyAutocomplete', () => ({
  CompanyAutocomplete: (props: { value: string; onChange: (v: string) => void }) => (
    <input
      aria-label="회사명"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}))

vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

vi.mock('@/utils/firstCardCelebration', () => ({
  shouldCelebrateFirstCard: vi.fn(() => false),
}))

type MutateOpts = { onSuccess: (data: Application) => void }
const mutate = vi.fn()
vi.mock('@/hooks/useApplications', () => ({
  useCreateApplication: () => ({ mutate, isPending: false }),
  // 목록은 NEW 알약 판정(공고 카드 보유 여부)에만 쓴다 — 이 spec 의 관심 밖
  useApplications: () => ({ data: [] }),
}))

const mockedResearch = vi.mocked(coverletterDocApi.getResearch)
const mockedShouldCelebrate = vi.mocked(shouldCelebrateFirstCard)

/** 회사명 입력 → 추가하기 → mutation onSuccess 를 주어진 id 로 흘려보낸다 */
function submitAndSucceed(createdId: string) {
  fireEvent.change(screen.getByLabelText('회사명'), { target: { value: '카카오' } })
  fireEvent.click(screen.getByRole('button', { name: '추가하기' }))
  const opts = mutate.mock.calls.at(-1)![1] as MutateOpts
  opts.onSuccess({ id: createdId } as Application)
}

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AddCardModal open onClose={() => {}} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedResearch.mockResolvedValue(null)
  mockedShouldCelebrate.mockReturnValue(false)
  useResearchRevealStore.setState({ appId: null })
  useCelebrationStore.getState().dismissFirstCard()
})

describe('AddCardModal — 조사 펼침 트리거', () => {
  it('1) 일반 카드 → 펼침 대상 지정 + 조사 prefetch(countHit:false)', async () => {
    renderModal()
    submitAndSucceed('new-1')

    expect(useResearchRevealStore.getState().appId).toBe('new-1')
    await waitFor(() =>
      expect(mockedResearch).toHaveBeenCalledWith('new-1', { countHit: false }),
    )
  })

  it('2) 첫 카드 축하 → 펼침 대상 지정 안 함 (연출 두 번 금지), prefetch 는 유지', async () => {
    mockedShouldCelebrate.mockReturnValue(true)
    renderModal()
    submitAndSucceed('new-first')

    expect(useResearchRevealStore.getState().appId).toBeNull()
    expect(useCelebrationStore.getState().firstCard?.appId).toBe('new-first')
    await waitFor(() =>
      expect(mockedResearch).toHaveBeenCalledWith('new-first', { countHit: false }),
    )
  })

  it('3) 연속 추가 → 대상이 마지막 카드로 옮겨간다', () => {
    renderModal()
    submitAndSucceed('new-1')
    expect(useResearchRevealStore.getState().appId).toBe('new-1')
    submitAndSucceed('new-2')
    expect(useResearchRevealStore.getState().appId).toBe('new-2')
  })
})
