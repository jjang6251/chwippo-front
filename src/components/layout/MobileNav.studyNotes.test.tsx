/**
 * 하단 탭 스왑 회귀 (plan §5 「탭 스왑 회귀」 · CEO 결정 3).
 *
 * 🔴 **경위** — 「내정보」가 있던 자리를 「공부 노트」가 가져간다. 탭은 앱에서 가장 눈에 띄는
 * 동선이라 이 배열이 조용히 틀어지면 사용자가 매일 쓰는 길이 사라진다. 특히 **데모는 스왑
 * 대상이 아니다** — `/demo/study-notes` 라우트도 샘플도 없어서, 데모까지 바뀌면 메뉴가
 * 광고하는 곳에 갈 수 없게 된다 (사이드바에서 이미 한 번 겪은 사고).
 *
 * 시나리오:
 *   1  실계정 = 캘린더·보드·활동 일지·**공부 노트**·회고 (내정보 없음)
 *   2  공부 노트 탭이 /study-notes 를 가리킨다
 *   3  문서 페이지(/study-notes/:id)에서도 탭이 켜져 있다
 *   4  🔴 데모 = 기존 5탭 불변 (내정보 있고 공부 노트 없음)
 *   5  데모의 내정보는 /demo/myinfo 로 간다 (직링크 동선 유지)
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MobileNav } from './MobileNav'
import { DemoModeContextProvider } from '@/contexts/demoMode'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: 'user' } }),
}))

function renderNav({ demo = false, path = '/calendar' } = {}) {
  return render(
    <DemoModeContextProvider value={demo}>
      <MemoryRouter initialEntries={[path]}>
        <MobileNav />
      </MemoryRouter>
    </DemoModeContextProvider>,
  )
}

const tabLabels = () =>
  screen.getAllByRole('link').map((a) => a.textContent?.trim() ?? '')

describe('MobileNav — 내정보 → 공부 노트 스왑', () => {
  it('1 실계정 탭 = 캘린더·보드·활동 일지·공부 노트·회고', () => {
    renderNav()
    expect(tabLabels()).toEqual(['캘린더', '보드', '활동 일지', '공부 노트', '회고'])
  })

  it('2 공부 노트 탭이 /study-notes 를 가리킨다', () => {
    renderNav()
    expect(screen.getByRole('link', { name: '공부 노트' })).toHaveAttribute(
      'href',
      '/study-notes',
    )
  })

  it('3 문서 페이지에서도 탭이 켜져 있다', () => {
    renderNav({ path: '/study-notes/abc-123' })
    const tab = screen.getByRole('link', { name: '공부 노트' })
    expect(tab.querySelector('.text-brand')).not.toBeNull()
  })

  it('4 🔴 데모는 기존 5탭 불변 — 내정보가 그대로 있고 공부 노트는 없다', () => {
    renderNav({ demo: true, path: '/demo/calendar' })
    expect(tabLabels()).toEqual(['캘린더', '보드', '활동 일지', '내정보', '회고'])
    expect(screen.queryByRole('link', { name: '공부 노트' })).toBeNull()
  })

  it('5 데모의 내정보는 /demo/myinfo 로 간다', () => {
    renderNav({ demo: true, path: '/demo/calendar' })
    expect(screen.getByRole('link', { name: '내정보' })).toHaveAttribute('href', '/demo/myinfo')
  })
})
