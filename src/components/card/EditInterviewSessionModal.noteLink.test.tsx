/**
 * 다리 (b) — **면접 질문 은행 → 준비 노트** (2026-08-11).
 *
 * 🔴 노트 → 은행만 뚫으면 한쪽 통행이다. 세션에서 "그때 뭐라고 적어뒀더라" 가 떠올랐을 때
 * 카드 상세를 거쳐 스텝을 다시 찾아야 하고, 그 길을 기억에 맡기면 아무도 안 간다.
 * 자료 창구가 이 모달이라 여기 둔다 — 모바일엔 사이드바가 없어 **유일한 창구**다.
 *
 * 이 spec 이 잠그는 것:
 *   ① 면접 스텝이 **정확히 1개면 그 스텝으로 직행** (고를 게 없는데 물을 이유가 없다)
 *   ② 여러 개면 카드 상세(스텝 목록)로 — 어느 면접의 노트인지는 사용자가 안다
 *   ③ 🔴 0개면 **링크 자체를 두지 않는다** (눌러도 갈 곳이 없는 링크는 두지 않는다)
 *   ④ 판정은 `getStepType` 단일 구현 — 'PT·토론'·'컬처핏'도 면접형이다
 *   ⑤ 데모에서는 `/demo` 프리픽스 (안 붙이면 AuthGuard 로 빠져 랜딩으로 튕긴다)
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import { EditInterviewSessionModal } from './EditInterviewSessionModal'
import type { InterviewPrepSession } from '@/types/interviewPrep'

const h = vi.hoisted(() => ({
  steps: [] as { id: string; name: string }[],
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { companyName: '카카오', steps: h.steps } }),
}))
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({ data: [] }),
}))
vi.mock('@/hooks/useActivities', () => ({
  useActivities: () => ({ data: [] }),
  useActivityLogs: () => ({ data: [] }),
}))
vi.mock('@/components/card/CompanyResearchCard', () => ({
  CompanyResearchCard: () => null,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))

const session = {
  id: 's-1',
  applicationId: 'app-1',
  round: '1차 실무 면접',
  interviewType: null,
  coverletterIds: [],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
} as unknown as InterviewPrepSession

function draw({ demo = false } = {}) {
  return render(
    <DemoModeContextProvider value={demo}>
      <MemoryRouter>
        <EditInterviewSessionModal
          session={session}
          questionCount={0}
          onClose={vi.fn()}
          onSave={vi.fn()}
          isSaving={false}
        />
      </MemoryRouter>
    </DemoModeContextProvider>,
  )
}

const noteLink = () => screen.queryByRole('link', { name: /준비 노트 보기/ })

beforeEach(() => {
  h.steps = []
})

describe('📝 준비 노트로 돌아가는 길', () => {
  it('면접 스텝이 1개면 그 스텝으로 직행한다', () => {
    h.steps = [
      { id: 'st-1', name: '서류 제출' },
      { id: 'st-2', name: '1차 면접' },
    ]
    draw()
    expect(noteLink()?.getAttribute('href')).toBe(
      '/board/app-1/steps/st-2',
    )
  })

  it('어느 스텝인지 이름으로 알려준다 (누르기 전에 확인된다)', () => {
    h.steps = [{ id: 'st-2', name: '1차 면접' }]
    draw()
    expect(noteLink()?.textContent).toContain('1차 면접')
  })

  it('여러 개면 카드 상세(스텝 목록)로 보낸다', () => {
    h.steps = [
      { id: 'st-1', name: '1차 면접' },
      { id: 'st-2', name: '임원면접' },
    ]
    draw()
    expect(noteLink()?.getAttribute('href')).toBe('/board/app-1')
    expect(noteLink()?.textContent).toContain('2개')
  })

  /** 🔴 눌러도 갈 곳이 없는 링크는 두지 않는다 */
  it('🔴 면접 스텝이 없으면 링크가 아예 없다', () => {
    h.steps = [
      { id: 'st-1', name: '서류 제출' },
      { id: 'st-2', name: '코딩테스트' },
    ]
    draw()
    expect(noteLink()).toBeNull()
  })

  it('스텝 목록 자체가 없어도 터지지 않는다', () => {
    h.steps = []
    draw()
    expect(noteLink()).toBeNull()
  })

  it("🔴 이름에 '면접' 이 없어도 면접형이면 잡는다 (2차 PT·토론)", () => {
    h.steps = [
      { id: 'st-1', name: '서류 제출' },
      { id: 'st-2', name: '2차 PT·토론' },
    ]
    draw()
    expect(noteLink()?.getAttribute('href')).toBe('/board/app-1/steps/st-2')
  })

  /** 🔴 프리픽스가 빠지면 AuthGuard 로 빠져 랜딩으로 튕긴다 */
  it('🔴 데모에서는 /demo 안에 머문다', () => {
    h.steps = [{ id: 'st-2', name: '1차 면접' }]
    draw({ demo: true })
    expect(noteLink()?.getAttribute('href')).toBe(
      '/demo/board/app-1/steps/st-2',
    )
  })
})
