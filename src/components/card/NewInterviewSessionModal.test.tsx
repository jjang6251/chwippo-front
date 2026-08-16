/**
 * 질문 은행 D2 — **자소서 0건이 더 이상 차단이 아니다.**
 *
 * 🔴 예전엔 자소서를 1개도 안 고르면 세션 생성 자체를 막았다. AI 생성이 유일한 입구였을 때의
 * 규칙이다. 지금은 **직접 적은 질문을 모으는 것**이 기본 동선이라, 자소서가 없어도 세션을
 * 만들어 기출을 쌓을 수 있어야 한다 — 자소서는 AI 생성의 재료로만 남는다.
 *
 * 🔴 그렇다고 안내까지 지우면 "왜 자소서를 등록해야 하는지" 를 알 방법이 사라진다.
 * 차단은 없애고 **권장은 남긴다** — 0건일 때만 뜨는 안내 + 등록하러 가기.
 *
 * 시나리오:
 *  1. 자소서 0건이어도 세션 생성이 호출된다 (버튼도 활성)
 *  2. 0건이면 안내 박스가 뜨고 「자소서 등록하러 가기」가 그 안에 있다
 *  3. 1건 이상이면 안내 박스는 없다 (있으면 매번 잔소리가 된다)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewInterviewSessionModal } from './NewInterviewSessionModal'

const state = vi.hoisted(() => ({
  coverletters: [] as unknown[],
}))
const createMock = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({ data: state.coverletters }),
}))
vi.mock('@/hooks/useActivities', () => ({
  useActivities: () => ({ data: [] }),
  useActivityLogs: () => ({ data: [] }),
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: {
      id: 'app-1',
      companyName: '카카오',
      jobTitle: '백엔드 개발자',
      jobCategory: null,
      steps: [{ id: 'st-1', name: '1차 실무 면접' }],
      jobPosting: null,
      jobPostingStatus: null,
    },
  }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useCreateInterviewPrepSession: () => ({
    mutate: createMock,
    isPending: false,
  }),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))

const onNeedCoverletter = vi.fn()

const draw = () =>
  render(
    <NewInterviewSessionModal
      applicationId="app-1"
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onNeedCoverletter={onNeedCoverletter}
    />,
  )

const GUIDE = /자소서는 AI 질문 생성에 필요해요/

describe('새 면접 세션 — 자소서 0건', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.coverletters = []
  })

  it('🔴 1) 자소서가 0건이어도 세션 생성이 호출된다', async () => {
    draw()
    // 🔴 드롭다운 value 는 스텝 **이름이 아니라 id** 다 (2026-08-16 — 세션↔스텝 FK 연결).
    //    이름을 넣으면 아무 것도 선택되지 않아 「세션 만들기」가 잠긴 채로 남는다.
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'st-1' },
    })

    const submit = screen.getByRole('button', { name: '세션 만들기' })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock.mock.calls[0][0]).toMatchObject({
      applicationId: 'app-1',
      round: '1차 실무 면접',
      coverletterIds: [],
    })
  })

  it('2) 0건이면 안내 박스와 등록 링크가 보인다', () => {
    draw()
    expect(screen.getByText(GUIDE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '자소서 등록하러 가기' }))
    expect(onNeedCoverletter).toHaveBeenCalled()
  })

  it('3) 자소서가 1건 이상이면 안내 박스가 없다', () => {
    state.coverletters = [
      { id: 'cl-1', category: '지원동기', question: '지원 동기를 적어주세요.' },
    ]
    draw()
    expect(screen.queryByText(GUIDE)).toBeNull()
    expect(
      screen.queryByRole('button', { name: '자소서 등록하러 가기' }),
    ).toBeNull()
  })
})
