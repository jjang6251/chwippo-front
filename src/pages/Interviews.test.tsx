/**
 * F6 PR 2 Phase 5.6.소급 — Interviews 페이지 삭제 버튼.
 *
 * 매트릭스:
 *   1. 세션 카드 hover 영역에 🗑️ 버튼 렌더
 *   2. 클릭 → window.confirm 호출 (round 이름 포함)
 *   3. confirm 거부 → delete mutation 호출 X
 *   4. confirm 수락 → delete mutation 호출 + applicationId 전파
 *   5. preventDefault — Link 가 click 안 됨 (navigate X)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const APP = {
  id: 'app-1',
  companyName: '카카오',
  jobTitle: '백엔드',
  jobCategory: '엔지니어링',
  status: 'IN_PROGRESS',
}

vi.mock('@/hooks/useApplications', () => ({
  // 세션 생성 모달이 단수형을 쓴다 — 없으면 모달 렌더가 통째로 터진다
  useApplication: () => ({ data: APP, isLoading: false }),
  useApplications: () => ({
    data: [
      {
        id: 'app-1',
        company: '카카오',
        jobTitle: '백엔드',
        jobCategory: '엔지니어링',
        status: 'IN_PROGRESS',
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/api/interviewPrep', () => ({
  interviewPrepApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'session-1',
        round: '1차 실무면접',
        interviewType: 'technical',
        applicationId: 'app-1',
        createdAt: '2026-05-28T00:00:00Z',
        jobDescription: null,
        emphasisPoints: null,
      },
    ]),
    remove: vi.fn(),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )),
  useNavigate: () => navigateMock,
}))

/**
 * 🔴 **모달은 스텁으로 대체한다.** 진짜 모달은 useApplication·useUpdateApplication 등
 * 훅 체인을 요구하는데, 그걸 다 mock 하면 **모달의 테스트**가 되지 이 페이지의 배선
 * 테스트가 아니다. 여기서 지킬 계약은 "onCreated 를 받으면 그 세션으로 보낸다" 뿐이다.
 */
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: ({
    onCreated,
  }: {
    onCreated: (id: string) => void
  }) => (
    <button type="button" onClick={() => onCreated('sess-new')}>
      [스텁] 생성 완료
    </button>
  ),
}))

import { Interviews } from './Interviews'
import { interviewPrepApi } from '@/api/interviewPrep'

const removeMock = vi.mocked(interviewPrepApi.remove)
const listMock = vi.mocked(interviewPrepApi.list)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

async function waitForSession() {
  await waitFor(() => expect(screen.queryByText('1차 실무면접')).not.toBeNull())
}

describe('Interviews 페이지 삭제 버튼', () => {
  beforeEach(() => removeMock.mockReset())

  it('1) 세션 카드에 🗑️ 버튼 렌더 (aria-label 포함)', async () => {
    render(<Interviews />, { wrapper })
    await waitForSession()
    expect(
      screen.getByLabelText('1차 실무면접 세션 삭제'),
    ).toBeInTheDocument()
  })

  it('2) 🗑️ click → window.confirm 호출 (round 이름 포함)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    expect(confirmSpy).toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0][0]).toContain('1차 실무면접')
    confirmSpy.mockRestore()
  })

  it('3) confirm 거부 → delete mutation 호출 X', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('4) confirm 수락 → delete mutation 호출 (sessionId 전달)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    removeMock.mockResolvedValue({} as never)
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByLabelText('1차 실무면접 세션 삭제'))
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('session-1'))
  })
})

/**
 * 🔴 **필터가 목록을 조용히 지우던 자리** (2026-08-07).
 *
 * 그룹은 필터에 안 맞으면 **스스로 숨는다**(`return null`) — 회사가 여럿이면 관련 없는
 * 회사를 지우는 게 맞다. 문제는 **전부 숨었을 때**다: 필터 바만 남고 목록이 통째로
 * 사라져 "세션이 삭제됐다" 로 읽히는데, 푸는 방법도 화면에 없었다.
 *
 * 세션은 그룹마다 따로 fetch 하므로 부모가 "전부 비었나" 를 못 안다. 그래서
 * ① 필터 자리에 **해제 버튼**(원인이 있는 곳) ② 컨테이너가 실제로 비었다는 사실을
 * CSS(`peer-empty`)로 읽어 안내 — 두 겹으로 둔다.
 */
describe('Interviews — 필터 0건', () => {
  beforeEach(() => {
    removeMock.mockReset()
  })

  it('🔴 필터로 전부 숨으면 목록 컨테이너가 빈다 (안내가 켜지는 조건)', async () => {
    const { container } = render(<Interviews />, { wrapper })
    await waitForSession()
    const list = container.querySelector('.peer')
    expect(list?.children.length).toBe(1)

    // 세션은 technical 뿐 — 임원·인성으로 거르면 그룹이 스스로 숨는다
    fireEvent.click(screen.getByText('임원·인성'))
    await waitFor(() => expect(list?.children.length).toBe(0))
    expect(screen.queryByText('1차 실무면접')).toBeNull()
  })

  it('🔴 컨테이너가 비면 드러나는 안내가 DOM 에 있다', () => {
    const { container } = render(<Interviews />, { wrapper })
    // peer-empty 는 CSS 라 jsdom 이 가시성을 계산하지 않는다 — 배선(클래스·문구)을 고정한다
    const notice = screen.getByText('이 조건에 맞는 세션이 없어요')
    expect(notice.closest('div')?.className).toContain('peer-empty:block')
    expect(container.querySelector('.peer')).not.toBeNull()
  })

  it('🔴 필터가 걸렸을 때만 해제 버튼이 뜬다', async () => {
    render(<Interviews />, { wrapper })
    await waitForSession()
    expect(screen.queryByText('필터 해제')).toBeNull()

    fireEvent.click(screen.getByText('임원·인성'))
    await waitFor(() => expect(screen.queryByText('필터 해제')).not.toBeNull())
  })

  it('해제를 누르면 목록이 돌아온다', async () => {
    render(<Interviews />, { wrapper })
    await waitForSession()
    fireEvent.click(screen.getByText('임원·인성'))
    await waitFor(() => expect(screen.queryByText('필터 해제')).not.toBeNull())

    fireEvent.click(screen.getByText('필터 해제'))
    await waitFor(() =>
      expect(screen.queryByText('1차 실무면접')).not.toBeNull(),
    )
    expect(screen.queryByText('필터 해제')).toBeNull()
  })
})

/**
 * 🔴 **세션 0 인 회사 그룹이 막다른 길이었다** (2026-08-07).
 *
 * `아직 면접 세션이 없어요` 한 줄뿐이고 만들 방법이 화면에 없었다. 세션 생성 모달은
 * 이 페이지가 이미 들고 있으므로(`NewInterviewSessionModal`) **여기서 바로 열면 된다** —
 * 카드 상세까지 가게 만들 이유가 없다.
 */
describe('Interviews — 세션 0 인 회사', () => {
  it('🔴 만들 수 있는 길을 준다 (버튼 + 무엇이 생기는지)', async () => {
    listMock.mockResolvedValueOnce([])
    render(<Interviews />, { wrapper })
    await waitFor(() =>
      expect(screen.queryByText('아직 면접 세션이 없어요')).not.toBeNull(),
    )
    expect(screen.queryByText('면접 차수 만들기')).not.toBeNull()
    // 왜 만들어야 하는지도 말한다 — 버튼만 있으면 누를 이유가 없다
    expect(
      screen.queryByText(/자소서를 바탕으로 예상 질문을 뽑아드려요/),
    ).not.toBeNull()
  })

  /*
    모달이 열리는지는 여기서 안 본다 — 모달이 useApplication·useUpdateApplication 등
    훅 체인을 요구해서, 그걸 다 mock 하면 **모달의 테스트**가 되지 내 변경의 테스트가
    아니다. 여기서 지킬 계약은 "만들 길이 화면에 있다" 까지다.
  */
})

/**
 * 🔴 **만든 세션으로 바로 들어간다** (2026-08-07).
 *
 * 모달만 닫으면 목록에서 방금 만든 차수를 눈으로 찾아 다시 눌러야 한다.
 * 만들자마자 할 일은 질문 생성이라 그 자리로 보낸다.
 * 카드 상세(`InterviewPrepTab`)는 진작 이렇게 하고 있었고 여기만 빠져 있었다.
 */
describe('Interviews — 세션 생성 후 이동', () => {
  beforeEach(() => {
    navigateMock.mockReset()
  })

  it('🔴 생성되면 그 세션 상세로 이동한다', async () => {
    listMock.mockResolvedValueOnce([])
    render(<Interviews />, { wrapper })
    await waitFor(() =>
      expect(screen.queryByText('면접 차수 만들기')).not.toBeNull(),
    )
    fireEvent.click(screen.getByText('면접 차수 만들기'))

    // 스텁이 실제 생성 성공을 대신한다
    await waitFor(() =>
      expect(screen.queryByText('[스텁] 생성 완료')).not.toBeNull(),
    )
    fireEvent.click(screen.getByText('[스텁] 생성 완료'))

    expect(navigateMock).toHaveBeenCalledWith('/interviews/sess-new')
  })
})

/**
 * 🔴 **브랜드 CTA 대비** (2026-08-07 /uiux 실측).
 *
 * `text-text-primary` 를 `bg-brand` 위에 얹고 있었다. **둘 다 테마에 따라 뒤집혀서**
 * 다크에서 같이 밝아진다 — `src/index.css` 토큰으로 계산한 실측:
 *
 * | 텍스트 토큰            | 다크   | 라이트 | 최악 |
 * |----------------------|-------|-------|------|
 * | `text-text-primary`  | 2.59  | 4.38  | 2.59 |
 * | `text-white`         | 3.14  | 4.04  | 3.14 |
 * | `text-bg`            | 5.64  | 3.37  | 3.37 |
 *
 * 2.59 는 AA(4.5) 는 물론 large-text 기준(3.0)도 못 넘는 **유일한** 조합이었다.
 *
 * 🔴 게다가 같은 일을 하는 `InterviewPrepTab` 의 CTA 는 `text-white` 를 쓰고 있었다 —
 * **면접 세션 만들기 버튼이 두 진입점에서 다르게 생겼다.** 이동 동작이 갈라져 있던 것과
 * 같은 종류의 문제라 함께 맞춘다.
 *
 * (sage 브랜드가 중간 명도라 세 후보 **어느 것도** 양쪽 AA 4.5 를 만족하지 못한다.
 *  그건 팔레트 차원의 별건이고, 여기서는 최악값을 올리고 형제와 맞추는 데까지가 범위다.)
 */
describe('Interviews — 빈 상태 CTA 대비', () => {
  it('🔴 brand 배경 위에 테마 따라 뒤집히는 텍스트 토큰을 쓰지 않는다', async () => {
    listMock.mockResolvedValueOnce([])
    render(<Interviews />, { wrapper })
    const cta = await screen.findByText('면접 차수 만들기')
    expect(cta.className).toContain('bg-brand')
    expect(cta.className).toContain('text-white')
    // 되돌아오면 다크에서 2.59:1 이 된다
    expect(cta.className).not.toContain('text-text-primary')
  })
})

