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
import { GoToInterviewButton } from './GoToInterviewButton'

const nav = vi.hoisted(() => ({
  to: null as string | null,
  opts: null as { state?: unknown } | null,
}))
const sess = vi.hoisted(() => ({
  list: [] as { id: string; round: string }[],
  loading: false,
  error: false,
}))

/* 데모 프리픽스는 `useDemoNavigate` 안에서 붙는다 — 여기선 목적지만 본다 */
vi.mock('@/hooks/useDemoNavigate', () => ({
  useDemoNavigate: () => (to: string, opts?: { state?: unknown }) => {
    nav.to = to
    nav.opts = opts ?? null
  },
}))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSessions: () => ({
    data: sess.list,
    isLoading: sess.loading,
    isError: sess.error,
  }),
}))
/*
  생성 모달은 열렸는지만 보면 된다 — 내부는 이 spec 의 관심사가 아니다.
  다만 「자소서 등록하러 가기」는 **부모가 경로를 아는 콜백**이라 눌러볼 수 있게 둔다.
*/
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: ({
    onNeedCoverletter,
  }: {
    onNeedCoverletter: () => void
  }) => (
    <div>
      새 면접 준비 만들기 모달
      <button onClick={onNeedCoverletter}>자소서 등록하러 가기</button>
    </div>
  ),
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
  nav.opts = null
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

/**
 * 🔴 **준비 노트 → 질문 은행 다리가 이 버튼을 그대로 쓴다** (2026-08-11).
 *
 * 0/1/N 판단은 이미 여기서 한 번 잘못돼 코인이 나갔던 자리다 — 다리를 놓으면서
 * 같은 판단을 다시 구현하는 대신 **문구·잠금·넘길 값**만 밖에서 받게 했다.
 * 아래는 그 세 가지가 기존 갈래를 망가뜨리지 않는지를 지킨다.
 */
describe('브리지 옵션 — 문구·잠금·넘길 값', () => {
  const drawBridge = (over: Record<string, unknown> = {}) =>
    render(
      <MemoryRouter>
        <GoToInterviewButton
          applicationId="app-1"
          label="이 내용으로 면접 질문 만들기"
          navState={{ bridgeText: '1분 자기소개 해주세요' }}
          {...over}
        />
      </MemoryRouter>,
    )
  const bridgeBtn = () =>
    screen.getByRole('button', { name: /이 내용으로 면접 질문 만들기/ })

  it('세션이 1개면 넘길 값을 실어서 옮긴다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    drawBridge()
    fireEvent.click(bridgeBtn())
    expect(nav.to).toBe('/interviews/s-1')
    expect(nav.opts?.state).toEqual({ bridgeText: '1분 자기소개 해주세요' })
  })

  it('여러 개 중에 골라 가도 넘길 값이 따라간다', () => {
    sess.list = [
      { id: 's-1', round: '1차 실무 면접' },
      { id: 's-2', round: '2차 임원 면접' },
    ]
    drawBridge()
    fireEvent.click(bridgeBtn())
    fireEvent.click(screen.getByText('2차 임원 면접'))
    expect(nav.to).toBe('/interviews/s-2')
    expect(nav.opts?.state).toEqual({ bridgeText: '1분 자기소개 해주세요' })
  })

  it('🔴 문구를 고정하면 0개일 때도 「만들기」로 바뀌지 않는다 (깜빡임 원천 차단)', () => {
    sess.list = []
    drawBridge()
    expect(bridgeBtn().textContent).not.toContain('만들기 만들기')
    expect(bridgeBtn().textContent).toContain('이 내용으로 면접 질문 만들기')
  })

  it('세션이 0개면 여기서도 만들기 모달로 이어진다 (막다른 길이 없다)', () => {
    sess.list = []
    drawBridge()
    fireEvent.click(bridgeBtn())
    expect(createModal()).toBeTruthy()
  })

  /** 🔴 넘길 내용이 없는데 세션을 만들면 코인만 쓰고 빈 폼이 열린다 */
  it('🔴 잠겨 있으면 눌러도 만들기가 열리지 않는다', () => {
    sess.list = []
    drawBridge({ disabled: true })
    fireEvent.click(bridgeBtn())
    expect(createModal()).toBeNull()
    expect(bridgeBtn().hasAttribute('disabled')).toBe(true)
  })

  it('잠겨 있으면 세션이 있어도 옮기지 않는다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    drawBridge({ disabled: true })
    fireEvent.click(bridgeBtn())
    expect(nav.to).toBeNull()
  })

  it('툴팁을 바꿀 수 있다 — 다만 조회 실패는 덮지 못한다', () => {
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
    const { unmount } = drawBridge({ title: '준비 노트가 비어 있어요' })
    expect(bridgeBtn().getAttribute('title')).toBe('준비 노트가 비어 있어요')
    unmount()

    sess.error = true
    drawBridge({ title: '준비 노트가 비어 있어요' })
    expect(bridgeBtn().getAttribute('title')).toBe(
      '면접 준비 목록을 불러오지 못했어요',
    )
  })

  /**
   * 🔴 자소서 화면에서는 닫기만 하면 그 자리였다. 스텝 페이지에서 같은 기본값을 쓰면
   * 「자소서 등록하러 가기」가 **모달만 닫고 아무 데도 안 가는 버튼**이 된다.
   */
  it('🔴 자소서로 가는 길은 부모가 정한다', () => {
    const onNeedCoverletter = vi.fn()
    sess.list = []
    drawBridge({ onNeedCoverletter })
    fireEvent.click(bridgeBtn())
    fireEvent.click(screen.getByText('자소서 등록하러 가기'))
    expect(onNeedCoverletter).toHaveBeenCalledTimes(1)
    expect(createModal()).toBeNull() // 모달은 닫힌다
  })

  it('넘기지 않으면 닫기만 한다 (자소서 화면의 기존 동작)', () => {
    sess.list = []
    render(
      <MemoryRouter>
        <GoToInterviewButton applicationId="app-1" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /면접 준비/ }))
    fireEvent.click(screen.getByText('자소서 등록하러 가기'))
    expect(createModal()).toBeNull()
    expect(nav.to).toBeNull()
  })
})
