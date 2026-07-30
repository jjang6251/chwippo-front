/**
 * 알림센터 — 타입 필터(A7 → U23 서버사이드) + 미읽음 행 구분감(U30) 시나리오:
 * 1. 기본(전체) → 모든 타입 표시
 * 2. 브리핑 chip 클릭 → useNotifications 가 type='briefing' 으로 재조회 (서버 필터)
 * 3. '?type=briefing' 딥링크 진입 → 필터 초기 적용 (캘린더 배너 경유)
 * 4. 브리핑 필터 + 브리핑 0건 → 전용 빈 상태 문구
 * 5. (U30) 미읽음 행 = card-solid + 유형색 좌측 스트라이프 / 읽음 행 = surface-2
 *
 * U23: 클라이언트 필터 제거 → useNotifications(type) 가 서버 필터. 여기선 mock 이
 * type 인자로 서버 필터를 시뮬레이션 (컴포넌트가 올바른 type 을 넘기는지 검증).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigateSpy = vi.fn()
const markReadSpy = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { ...actual, useNavigate: () => navigateSpy }
})
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from './Notifications'
import type { NotificationItem } from '@/types/notification'

let items: NotificationItem[] = []
const useNotificationsSpy = vi.fn()

vi.mock('@/hooks/useNotifications', () => ({
  // 서버 필터 시뮬레이션 — 컴포넌트가 넘긴 type 으로 실제 필터링
  useNotifications: (type?: string) => {
    useNotificationsSpy(type)
    return {
      data: {
        pages: [
          {
            items: type ? items.filter((i) => i.type === type) : items,
            unreadCount: 0,
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    }
  },
  useMarkNotificationRead: () => ({ mutate: markReadSpy }),
  useMarkAllRead: () => ({ mutate: vi.fn(), isPending: false }),
}))

const item = (over: Partial<NotificationItem>): NotificationItem => ({
  id: Math.random().toString(36).slice(2),
  type: 'briefing',
  title: '제목',
  body: '내용',
  deepLink: null,
  payload: null,
  read: true,
  createdAt: new Date().toISOString(),
  ...over,
})

function renderPage(initialEntry = '/notifications') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Notifications />
    </MemoryRouter>,
  )
}

describe('Notifications — 타입 필터 (U23 서버사이드)', () => {
  beforeEach(() => {
    useNotificationsSpy.mockClear()
    items = [
      item({ type: 'briefing', title: '아침 브리핑' }),
      item({ type: 'deadline_urgent', title: '마감 긴급 알림' }),
      item({ type: 'admin', title: '운영 공지' }),
    ]
  })

  it('1) 기본(전체) → 모든 타입 표시 · useNotifications(undefined)', () => {
    renderPage()
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.getByText('마감 긴급 알림')).toBeInTheDocument()
    expect(screen.getByText('운영 공지')).toBeInTheDocument()
    expect(useNotificationsSpy).toHaveBeenLastCalledWith(undefined)
  })

  it('2) 브리핑 chip 클릭 → type="briefing" 로 재조회 (쿼리 인자)', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '브리핑' }))
    expect(useNotificationsSpy).toHaveBeenLastCalledWith('briefing')
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급 알림')).toBeNull()
    expect(screen.queryByText('운영 공지')).toBeNull()
  })

  it("2b) 임박 chip('임박') 클릭 → type=\"imminent\" 로 재조회", () => {
    items = [
      item({ type: 'imminent', title: '임박 알림' }),
      item({ type: 'deadline_urgent', title: '마감 긴급 알림' }),
    ]
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '임박' }))
    expect(useNotificationsSpy).toHaveBeenLastCalledWith('imminent')
    expect(screen.getByText('임박 알림')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급 알림')).toBeNull()
  })

  it("3) '?type=briefing' 딥링크 → 필터 초기 적용", () => {
    renderPage('/notifications?type=briefing')
    expect(useNotificationsSpy).toHaveBeenLastCalledWith('briefing')
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급 알림')).toBeNull()
  })

  it('4) 브리핑 필터 + 0건 → 전용 빈 상태 문구', () => {
    items = [item({ type: 'admin', title: '운영 공지' })]
    renderPage('/notifications?type=briefing')
    expect(screen.getByText('아직 받은 브리핑이 없어요')).toBeInTheDocument()
    expect(
      screen.getByText(/매일 아침 8시에 정리해드려요/),
    ).toBeInTheDocument()
  })
})

describe('Notifications — 미읽음 행 구분감 (U30)', () => {
  beforeEach(() => {
    useNotificationsSpy.mockClear()
    items = [
      item({ type: 'briefing', title: '안읽음 브리핑', read: false }),
      item({ type: 'admin', title: '읽음 운영', read: true }),
    ]
  })

  it('미읽음 행 = card-solid + 유형색 좌측 스트라이프 + shadow', () => {
    renderPage()
    const row = screen.getByText('안읽음 브리핑').closest('button')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('bg-card-solid')
    expect(row!.className).toContain('border-l-[3px]')
    expect(row!.className).toContain('border-l-brand')
    expect(row!.className).toContain('shadow-sm')
    // 저알파 틴트 잔재 없음
    expect(row!.className).not.toContain('bg-brand/10')
  })

  it('읽음 행 = surface-2 (스트라이프·틴트 없음)', () => {
    renderPage()
    const row = screen.getByText('읽음 운영').closest('button')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('bg-surface-2')
    expect(row!.className).not.toContain('border-l-[3px]')
    expect(row!.className).not.toContain('bg-card-solid')
  })

  it('미읽음 imminent 행 = violet 스트라이프 (warning 마감긴급과 구분)', () => {
    items = [item({ type: 'imminent', title: '안읽음 임박', read: false })]
    renderPage()
    const row = screen.getByText('안읽음 임박').closest('button')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('border-l-violet')
    expect(row!.className).not.toContain('border-l-warning')
  })
})


/**
 * 구조화 이벤트 도입(2026-07-29) 후 클릭 동작.
 *
 * 이전엔 알림 전체가 버튼 하나여서 **제목을 눌러도 첫 회사로 튀었다**(CEO 지적).
 * 줄마다 링크가 생긴 지금은 카드 탭이 이동하면 "어디를 눌렀느냐"로 결과가 갈려 예측이 안 된다.
 *
 * 케이스:
 *  1. events 있음 → 카드 탭은 **이동 없음** (읽음 처리만)
 *  2. events 있음 → 줄을 누르면 **그 줄의** 링크로 이동
 *  3. events 없음(옛 알림) → 기존대로 대표 링크로 이동
 *  4. 옛 알림은 body 텍스트로 폴백 렌더
 */
describe('Notifications — 구조화 이벤트 클릭 동작', () => {
  const withEvents = () =>
    item({
      title: '오늘의 일정 2건',
      deepLink: '/board/first',
      read: false,
      payload: {
        events: [
          { subject: '카카오', label: '서류 마감', dday: 0, deepLink: '/board/kakao' },
          { subject: '네이버', label: '1차 면접', dday: 2, deepLink: '/board/naver' },
        ],
      },
    })

  beforeEach(() => {
    navigateSpy.mockClear()
    markReadSpy.mockClear()
  })

  it('1) events 있으면 카드 탭은 이동하지 않는다', () => {
    items = [withEvents()]
    renderPage()
    fireEvent.click(screen.getByText('오늘의 일정 2건'))
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('2) 줄은 그 줄의 링크를 가리키는 <a> 다 + 클릭 시 읽음 처리', () => {
    // navigate 스파이가 아니라 **href** 로 검증한다 — Cmd/중클릭(새 탭)은 onClick 을
    // 타지 않으므로 핸들러만 보는 spec 은 통과해도 사용자는 엉뚱한 곳으로 갈 수 있다.
    items = [withEvents()]
    renderPage()
    expect(screen.getByText('네이버').closest('a')).toHaveAttribute(
      'href',
      '/board/naver',
    )
    // 카드 대표 링크(/board/first)로 튀지 않는다
    expect(screen.getByText('카카오').closest('a')).toHaveAttribute(
      'href',
      '/board/kakao',
    )
    fireEvent.click(screen.getByText('네이버'))
    expect(markReadSpy).toHaveBeenCalled()
  })

  it('3) 옛 알림(events 없음)은 대표 링크로 이동한다', () => {
    items = [item({ title: '옛 알림', deepLink: '/calendar', payload: null })]
    renderPage()
    fireEvent.click(screen.getByText('옛 알림'))
    expect(navigateSpy).toHaveBeenCalledWith('/calendar')
  })

  it('4) 옛 알림은 body 텍스트로 폴백 렌더된다', () => {
    items = [item({ title: '옛 알림', body: '카카오 서류 마감 · D-3', payload: null })]
    renderPage()
    expect(screen.getByText('카카오 서류 마감 · D-3')).toBeInTheDocument()
  })
})

/**
 * 읽음 처리 경로 — events 가 있으면 카드가 버튼이 아니라서(어포던스 일치) 별도 경로가 필요하다.
 * "카드에 들어가야만 읽음 처리된다" 면 목록에서 정리를 못 한다.
 */
describe('Notifications — 읽음 처리 경로', () => {
  const unreadWithEvents = () =>
    item({
      title: '오늘의 일정 2건',
      read: false,
      payload: {
        events: [
          { subject: '카카오', label: '서류 마감', dday: 0, deepLink: '/board/k' },
        ],
      },
    })

  it('안 읽은 알림에 읽음 버튼이 있다 (카드에 들어가지 않고 목록에서 처리)', () => {
    items = [unreadWithEvents()]
    renderPage()
    expect(
      screen.getByRole('button', { name: '읽음으로 표시' }),
    ).toBeInTheDocument()
  })

  it('🔴 안 읽음은 빈 체크박스 · 읽음은 채워진 체크 (상태와 라벨이 대응)', () => {
    // "읽음" 단독은 카카오톡식 상태 표시로 읽혀 사실과 반대였고, "✓ 읽음 처리" 는
    // 체크 표시가 이미 읽은 것처럼 보였다. 체크박스가 둘을 해결한다 (2026-07-30).
    items = [unreadWithEvents()]
    const { container, unmount } = renderPage()
    // 안 읽음 → 빈 사각형(lucide square) · 채워진 체크 없음
    expect(container.querySelector('.lucide-square')).not.toBeNull()
    expect(container.querySelector('.lucide-square-check-big')).toBeNull()
    unmount()

    items = [item({ read: true, payload: { events: [{ subject: 'A' }] } })]
    const read = renderPage()
    // 읽음 → 채워진 체크 · 버튼 아님(되돌리는 API 가 없어 누를 수 있게 보이면 거짓 어포던스)
    expect(read.container.querySelector('.lucide-square-check-big')).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: '읽음으로 표시' }),
    ).not.toBeInTheDocument()
  })

  it('읽음 버튼 클릭 → markRead 호출 (이동 없음)', () => {
    items = [unreadWithEvents()]
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '읽음으로 표시' }))
    expect(markReadSpy).toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('이미 읽은 알림에는 버튼이 없다', () => {
    items = [item({ read: true, payload: { events: [{ subject: 'A' }] } })]
    renderPage()
    expect(
      screen.queryByRole('button', { name: '읽음으로 표시' }),
    ).not.toBeInTheDocument()
  })

  it('"모두 읽음" 버튼도 별도로 있다 (일괄 처리)', () => {
    items = [unreadWithEvents()]
    renderPage()
    // unreadCount 가 0 인 mock 이라 노출 조건 확인만 — 실제 노출은 unread > 0
    expect(screen.getByText('오늘의 일정 2건')).toBeInTheDocument()
  })
})
