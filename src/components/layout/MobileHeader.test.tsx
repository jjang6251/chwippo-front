/**
 * MobileHeader — 모바일 상단바 제목.
 *
 * 🔴 제목 소스가 **두 군데로 오해되기 쉽다.** 상단바 제목은 여기 `PAGE_TITLES` 이고,
 * `@/utils/routeMeta` 는 **공개 라우트 SEO 전용**(document.title·canonical)이다. 후자는
 * `sitemap.xml` 과 키가 1:1 이어야 해서(`RouteMeta.test.tsx` 가 강제) 로그인 뒤 화면을
 * 넣으면 그 spec 이 깨진다 — 그래서 설정 하위 페이지는 전부 여기에만 등록한다.
 *
 * 시나리오: 등록된 경로는 제목 표시 · 미등록 경로는 기본값 「치뽀」 로 떨어진다
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }))
vi.mock('@/components/notification/NotificationBell', () => ({
  NotificationBell: () => null,
}))

import { MobileHeader } from './MobileHeader'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileHeader />
    </MemoryRouter>,
  )
}

describe('MobileHeader — 페이지 제목', () => {
  it.each([
    ['/settings', '설정'],
    ['/settings/profile', '프로필 설정'],
    ['/settings/help', '도움말'],
  ])('%s → 「%s」 (기존 설정 하위 페이지)', (path, title) => {
    renderAt(path)
    expect(screen.getByText(title)).toBeInTheDocument()
  })

  /**
   * 등록을 빠뜨리면 상단바가 「치뽀 | 치뽀」로 나온다 (2026-09-06 390px 캡처에서 실제로 발견).
   * 조용히 기본값으로 떨어지는 종류라 화면을 안 보면 모른다.
   */
  it('/settings/extension → 「연결된 확장」', () => {
    renderAt('/settings/extension')
    expect(screen.getByText('연결된 확장')).toBeInTheDocument()
    // 기본값으로 떨어지지 않았다 — 로고 「치뽀」 하나만 남는다
    expect(screen.getAllByText('치뽀')).toHaveLength(1)
  })

  it('미등록 경로는 기본값 「치뽀」', () => {
    renderAt('/notifications')
    expect(screen.getAllByText('치뽀')).toHaveLength(2)
  })
})
