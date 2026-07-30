import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { NotificationEventList } from './NotificationEventList'
import type { NotificationEvent } from '@/types/notification'

/**
 * 알림 안 일정 목록.
 *
 * 이전 문제 — 알림 전체가 버튼 하나여서 **두 번째 회사를 눌러도 첫 번째로 이동**했다.
 * 줄 단위 링크가 이 컴포넌트의 존재 이유다.
 *
 * 줄은 `<button>` 이 아니라 `<Link>`(=`<a href>`) 다 — Cmd/Ctrl·중클릭으로 새 탭에
 * 열 수 있어야 "여러 회사 훑으며 각각 처리" 흐름이 산다 (2026-07-30 /uiux).
 * 그래서 검증도 **핸들러 호출이 아니라 href** 로 한다 — 새 탭 클릭은 onClick 을 타지 않으므로
 * href 가 틀리면 핸들러 spec 은 통과해도 사용자는 엉뚱한 곳으로 간다.
 *
 * 케이스:
 *  1. 회사명·단계·D-day 가 각각 렌더된다
 *  2. 🔴 각 줄의 href 가 **그 줄의** deepLink (첫 줄 아님)
 *  3. deepLink 없는 줄은 링크가 아니다 (누를 수 없음이 시각·의미 모두 일치)
 *  4. dday null 이면 뱃지 없음
 *  5. 당일은 "D-day" (D-0 아님) — 앱 전역 규칙
 *  6. 4개 초과 시 접힘 + "N개 더 보기" → 펼치면 전부
 *  7. 클릭 시 이동 전 부수효과(읽음 처리)가 실행되고 부모로 전파되지 않는다
 */

function ev(over: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    subject: '카카오',
    label: '서류 마감',
    dday: 3,
    deepLink: '/board/a',
    ...over,
  }
}

function renderList(props: Partial<Parameters<typeof NotificationEventList>[0]> = {}) {
  return render(
    <MemoryRouter>
      <NotificationEventList events={[ev()]} {...props} />
    </MemoryRouter>,
  )
}

describe('NotificationEventList', () => {
  it('1. 회사명·단계·D-day 렌더', () => {
    renderList()
    expect(screen.getByText('카카오')).toBeInTheDocument()
    expect(screen.getByText('서류 마감')).toBeInTheDocument()
    expect(screen.getByText('D-3')).toBeInTheDocument()
  })

  it('2. 🔴 각 줄의 href 가 그 줄의 deepLink (첫 줄 아님)', () => {
    renderList({
      events: [
        ev({ subject: '카카오', deepLink: '/board/kakao' }),
        ev({ subject: '네이버', deepLink: '/board/naver' }),
      ],
    })
    expect(screen.getByText('네이버').closest('a')).toHaveAttribute(
      'href',
      '/board/naver',
    )
    expect(screen.getByText('카카오').closest('a')).toHaveAttribute(
      'href',
      '/board/kakao',
    )
  })

  it('3. deepLink 없는 줄은 링크가 아니다', () => {
    renderList({ events: [ev({ subject: '토익', deepLink: null })] })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('토익')).toBeInTheDocument()
  })

  it('4·5. dday null → 뱃지 없음 / 0 → "D-day"', () => {
    const { unmount } = renderList({ events: [ev({ dday: null })] })
    expect(screen.queryByText(/^D-/)).not.toBeInTheDocument()
    unmount()

    renderList({ events: [ev({ dday: 0 })] })
    expect(screen.getByText('D-day')).toBeInTheDocument()
    expect(screen.queryByText('D-0')).not.toBeInTheDocument()
  })

  it('6. 4개 초과 → 접힘 + 더 보기 → 펼치면 전부', () => {
    const events = ['A', 'B', 'C', 'D', 'E', 'F'].map((s) =>
      ev({ subject: s, deepLink: `/board/${s}` }),
    )
    renderList({ events })

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('E')).not.toBeInTheDocument()

    const more = screen.getByRole('button', { name: '2개 더 보기' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)

    expect(screen.getByText('E')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('7. 클릭 시 이동 전 부수효과 실행 + 부모로 전파 안 됨', () => {
    const onParent = vi.fn()
    const onBeforeNavigate = vi.fn()
    render(
      <MemoryRouter>
        <div onClick={onParent}>
          <NotificationEventList
            events={[ev()]}
            onBeforeNavigate={onBeforeNavigate}
          />
        </div>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('카카오'))
    expect(onBeforeNavigate).toHaveBeenCalledTimes(1)
    // 전파되면 알림 카드의 대표 deepLink 로 튀어 "누른 곳과 다른 데로 이동" 이 된다
    expect(onParent).not.toHaveBeenCalled()
  })
})
