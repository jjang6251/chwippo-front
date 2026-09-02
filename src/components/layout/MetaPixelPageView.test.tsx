/**
 * 라우트 변경 PageView — **SPA 라 안 붙이면 방문당 1건**이다.
 *
 * 시나리오:
 *  1. 첫 렌더는 안 쏜다 (initMetaPixel 이 이미 보냈다 — 안 막으면 첫 화면만 2건)
 *  2. 라우트가 바뀌면 PageView 1건
 *  3. 🔴 `/ops/*` 는 제외 (관리자 트래픽이 광고 모수를 오염시킨다)
 *  4. `/ops` 를 거쳐 일반 화면으로 돌아오면 다시 쏜다 (제외가 영구 중단이 아님)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetaPixelPageView } from './MetaPixelPageView'

const h = vi.hoisted(() => ({ trackPageView: vi.fn() }))
vi.mock('@/lib/metaPixel', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metaPixel')>('@/lib/metaPixel')
  // 🔴 `isPixelExcludedPath` 는 **실제 구현**을 태운다 — 제외 규칙 자체가 이 spec 의 대상이다
  return { ...actual, trackPageView: h.trackPageView }
})

/** 테스트에서 라우트를 옮기는 버튼 (컴포넌트는 렌더 결과가 없어 이동 수단이 필요하다) */
function Go({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(to)}>go:{to}</button>
  )
}

function setup(...targets: string[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MetaPixelPageView />
      {targets.map((t) => (
        <Go key={t} to={t} />
      ))}
    </MemoryRouter>,
  )
}

afterEach(() => {
  h.trackPageView.mockReset()
})

describe('MetaPixelPageView', () => {
  it('🔴 첫 렌더에서는 보내지 않는다 (initMetaPixel 이 이미 보냈다)', () => {
    setup('/board')
    expect(h.trackPageView).not.toHaveBeenCalled()
  })

  it('라우트가 바뀌면 PageView 를 1건 보낸다', () => {
    setup('/board')
    fireEvent.click(screen.getByText('go:/board'))
    expect(h.trackPageView).toHaveBeenCalledTimes(1)
  })

  it('🔴 /ops/* 로 이동하면 보내지 않는다 (관리자 트래픽 제외)', () => {
    setup('/ops/users')
    fireEvent.click(screen.getByText('go:/ops/users'))
    expect(h.trackPageView).not.toHaveBeenCalled()
  })

  it('/ops 를 거쳐 일반 화면으로 돌아오면 다시 보낸다', () => {
    setup('/ops', '/calendar')
    fireEvent.click(screen.getByText('go:/ops'))
    expect(h.trackPageView).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('go:/calendar'))
    expect(h.trackPageView).toHaveBeenCalledTimes(1)
  })
})
