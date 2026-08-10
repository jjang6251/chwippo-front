/**
 * 자소서 → 면접 이동 버튼 (2026-08-10).
 *
 * 🔴 **왜 spec 이 생겼나.** 점검에서 드러났다 — `sessions = []` 기본값만 보고 분기해서,
 * **목록을 불러오기 전에 누르면 세션이 있어도 「새로 만들기」가 열렸다.** 거기서 만들면
 * AI 질문 생성으로 이어져 **코인이 나간다.** 라벨도 「만들기 → 준비하기」로 깜빡였다.
 * 조회 실패도 같다 — 모르는 상태에서 중복을 만드는 것보다 잠그는 쪽이 낫다.
 *
 * 0/1/N 세 갈래는 이 버튼의 전부인데 테스트가 하나도 없었다. 같이 잠근다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoToInterviewButton } from './CoverletterDocPage'

const nav = vi.hoisted(() => ({ to: null as string | null }))
const sess = vi.hoisted(() => ({
  list: [] as { id: string; round: string }[],
  loading: false,
  error: false,
}))

vi.mock('react-router-dom', async () => {
  const real =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => (to: string) => { nav.to = to } }
})
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSessions: () => ({
    data: sess.list,
    isLoading: sess.loading,
    isError: sess.error,
  }),
}))
/* 생성 모달은 열렸는지만 보면 된다 — 내부는 이 spec 의 관심사가 아니다 */
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: () => <div>새 면접 준비 만들기 모달</div>,
}))

function draw() {
  return render(
    <MemoryRouter>
      <GoToInterviewButton applicationId="app-1" />
    </MemoryRouter>,
  )
}

const btn = () => screen.getByRole('button', { name: /면접 준비/ })
const createModal = () => screen.queryByText('새 면접 준비 만들기 모달')

beforeEach(() => {
  nav.to = null
  sess.list = []
  sess.loading = false
  sess.error = false
})

describe('면접 준비 버튼 — 0/1/N', () => {
  it('세션이 없으면 만들기 모달을 연다', () => {
    draw()
    expect(btn().textContent).toContain('만들기')
    fireEvent.click(btn())
    expect(createModal()).toBeTruthy()
  })

  it('세션이 1개면 바로 그리로 간다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    draw()
    fireEvent.click(btn())
    expect(nav.to).toBe('/interviews/s-1')
  })

  it('세션이 여러 개면 고르게 한다', () => {
    sess.list = [
      { id: 's-1', round: '1차 실무 면접' },
      { id: 's-2', round: '2차 임원 면접' },
    ]
    draw()
    fireEvent.click(btn())
    expect(screen.getByText('2차 임원 면접')).toBeTruthy()
    expect(nav.to).toBeNull() // 아직 안 옮겼다
  })
})

describe('🔴 몇 개인지 모를 때', () => {
  /** 🔴 여기서 만들면 중복 세션 + AI 생성으로 코인이 나간다 */
  it('🔴 불러오는 중엔 눌러도 만들기가 열리지 않는다', () => {
    sess.loading = true
    draw()
    fireEvent.click(btn())
    expect(createModal()).toBeNull()
    expect(nav.to).toBeNull()
  })

  it('🔴 불러오는 중엔 「만들기」라고 단정하지 않는다 (라벨 깜빡임)', () => {
    sess.loading = true
    draw()
    expect(btn().textContent).not.toContain('만들기')
  })

  it('🔴 조회 실패해도 만들기가 열리지 않는다', () => {
    sess.error = true
    draw()
    fireEvent.click(btn())
    expect(createModal()).toBeNull()
  })
})

/**
 * 🔴 **모바일에서도 건너갈 수 있어야 한다** (2026-08-10 CEO 지적:
 * "PC 자소서 섹션엔 면접으로 가는 버튼이 있는데 모바일엔 구현이 안 되어 있는 것 같은데").
 *
 * 면접 화면에는 「이 면접의 바탕이 된 자소서 보기」가 이미 있어 **짝이 되어야 하는데**,
 * 자소서 쪽만 `readOnly` 로 통째로 감춰져 한 방향만 뚫려 있었다.
 *
 * 감춘 이유였던 「세션 생성은 코인이 드는 동작」은 **생성**에만 해당한다 —
 * 이미 있는 세션으로 **이동**하는 건 공짜다. 그래서 모바일은 이동만 하고,
 * 만들 세션이 없으면 **버튼 자체를 두지 않는다** (눌러도 갈 곳이 없으니까).
 */
describe('navigateOnly — 모바일', () => {
  const drawMobile = () =>
    render(
      <MemoryRouter>
        <GoToInterviewButton applicationId="app-1" navigateOnly />
      </MemoryRouter>,
    )

  it('🔴 세션이 있으면 이동할 수 있다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    drawMobile()
    fireEvent.click(btn())
    expect(nav.to).toBe('/interviews/s-1')
  })

  it('세션이 여러 개면 여기서도 고르게 한다', () => {
    sess.list = [
      { id: 's-1', round: '1차 실무 면접' },
      { id: 's-2', round: '2차 임원 면접' },
    ]
    drawMobile()
    fireEvent.click(btn())
    expect(screen.getByText('2차 임원 면접')).toBeTruthy()
  })

  /** 🔴 생성은 코인이 드는 동작 — 여기서 열리면 안 된다 */
  it('🔴 세션이 없으면 버튼이 아예 없다 (만들기로 새지 않는다)', () => {
    sess.list = []
    drawMobile()
    expect(screen.queryByRole('button', { name: /면접 준비/ })).toBeNull()
  })

  it('🔴 「만들기」라는 말을 쓰지 않는다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    drawMobile()
    expect(btn().textContent).not.toContain('만들기')
  })

  it('아직 모르는 동안에는 두지 않는다', () => {
    sess.loading = true
    drawMobile()
    expect(screen.queryByRole('button', { name: /면접 준비/ })).toBeNull()
  })
})
