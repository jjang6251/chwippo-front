/**
 * 자소서 **문항 딥링크** — `/board/:id/coverletter#cl-<clId>`.
 *
 * 확장(지원 폼)이 「없는 문항은 치뽀에서 쓰고 오세요」라며 이 링크로 보낸다. 도착했는데
 * 카드가 접혀 있으면 링크가 아무 일도 안 한 것처럼 보인다 — 그래서 **저장된 펼침 상태
 * (localStorage)와 무관하게 강제로 편다.**
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 해시 없음 → 기존 규칙 그대로 (저장값이 이긴다 = 전부 접힘)
 *  2. 🔴 `#cl-<id>` → 저장값이 「전부 접음」이어도 그 문항만 펴진다
 *  3. 해시가 가리키는 문항이 목록에 없으면 아무 일도 없다 (조용히 무시)
 *  4. `#cl-` 형식이 아닌 해시는 무시한다
 *  5. 딥링크로 편 뒤 사용자가 접으면 접힌 채로 남는다 (렌더마다 되펴지지 않는다)
 *  6. 딥링크 도착 시 해당 카드로 스크롤한다
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverletterDocPage } from './CoverletterDocPage'

const CLS = [
  { id: 'cl-1', applicationId: 'app-1', question: 'Q1', answer: '', charLimit: 800, orderIndex: 0 },
  { id: 'cl-2', applicationId: 'app-1', question: 'Q2', answer: '', charLimit: 500, orderIndex: 1 },
]

vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => false,
  useInterviewAiEnabled: () => false,
}))
vi.mock('@/hooks/useCoverletterAiBlocked', () => ({ useCoverletterAiBlocked: () => false }))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { id: 'app-1', companyName: '카카오' }, isLoading: false }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({ data: CLS, isLoading: false, isError: false }),
  useCreateCoverletter: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveCoverletter: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCoverletter: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useCoverletterDoc', () => ({
  useCompanyResearchCache: () => ({ data: null, isLoading: false }),
}))
vi.mock('@/hooks/useAiFeedbackUnloadGuard', () => ({ useAiFeedbackUnloadGuard: () => {} }))
vi.mock('@/components/coverletter/CoverletterChatPanel', () => ({ CoverletterChatPanel: () => null }))
vi.mock('@/components/coverletter/CompanyResearchBanner', () => ({ CompanyResearchBanner: () => null }))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({ JobPostingBanner: () => null }))
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))
vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
vi.mock('@/stores/toastStore', () => ({ toast: { show: vi.fn(), error: vi.fn() } }))

/** 관심사는 「폈는가」뿐 — 카드 속은 보지 않는다 */
vi.mock('@/components/coverletter/CoverletterQuestionCard', () => ({
  CoverletterQuestionCard: ({
    cl, expanded, onToggle,
  }: { cl: { id: string }; expanded: boolean; onToggle: () => void }) => (
    <div id={`cl-${cl.id}`} data-testid={cl.id} data-expanded={expanded ? 'yes' : 'no'}>
      <button type="button" onClick={onToggle}>{`toggle-${cl.id}`}</button>
    </div>
  ),
}))
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useParams: () => ({ applicationId: 'app-1' }) }
})

function draw(hash = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/board/app-1/coverletter${hash}`]}>
        <CoverletterDocPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const expandedOf = (id: string) => screen.getByTestId(id).getAttribute('data-expanded')

describe('자소서 문항 딥링크 (#cl-<id>)', () => {
  beforeEach(() => {
    // 「전부 접음」을 저장해 둔다 — 딥링크가 저장값을 이겨야 한다는 게 이 spec 의 핵심
    localStorage.setItem('coverletter:expanded:app-1', JSON.stringify([]))
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('해시가 없으면 저장된 「전부 접음」이 그대로 이긴다', () => {
    draw()
    expect(expandedOf('cl-1')).toBe('no')
    expect(expandedOf('cl-2')).toBe('no')
  })

  it('🔴 #cl-cl-2 → 저장값이 접힘이어도 그 문항만 펴진다', () => {
    draw('#cl-cl-2')
    expect(expandedOf('cl-2')).toBe('yes')
    expect(expandedOf('cl-1')).toBe('no')
  })

  it('목록에 없는 문항 id 는 조용히 무시한다', () => {
    draw('#cl-없는문항')
    expect(expandedOf('cl-1')).toBe('no')
    expect(expandedOf('cl-2')).toBe('no')
  })

  it('#cl- 형식이 아닌 해시는 무시한다', () => {
    draw('#section-goals')
    expect(expandedOf('cl-1')).toBe('no')
    expect(expandedOf('cl-2')).toBe('no')
  })

  it('딥링크로 편 카드를 사용자가 접으면 접힌 채로 남는다', () => {
    draw('#cl-cl-1')
    expect(expandedOf('cl-1')).toBe('yes')
    fireEvent.click(screen.getByText('toggle-cl-1'))
    expect(expandedOf('cl-1')).toBe('no')
  })

  it('도착하면 해당 카드로 스크롤한다', () => {
    draw('#cl-cl-2')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
