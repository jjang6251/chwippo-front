/**
 * A5 — 첫 카드 보상 연출 렌더 시나리오:
 * 1. store 비면 렌더 없음
 * 2. full (템플릿+마감일): 체크 3개 + D-day 뱃지, 유도 문구 없음
 * 3. 마감일 없음: 템플릿 체크 + 💡 유도, D-day·캘린더 체크 없음
 * 4. planned: 등록 체크 + 유도, 템플릿 체크 없음 (거짓 체크 금지)
 * 5. CTA → navigate(/board/:id) + dismiss
 * 6. 배경 클릭 → dismiss
 * 7. 🔴 회귀: KST 날짜 경계(UTC 15:00 이후)에도 D-day 가 밀리지 않음
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstCardCelebration } from './FirstCardCelebration'
import {
  useCelebrationStore,
  type FirstCardCelebrationData,
} from '@/stores/celebrationStore'
import { addDays, todayLocal } from '@/utils/datetime'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))

const show = (over: Partial<FirstCardCelebrationData> = {}) =>
  useCelebrationStore.getState().showFirstCard({
    appId: 'app-1',
    companyName: '카카오',
    hadTemplate: true,
    // 🔴 마감일은 **KST 기준**으로 만든다 — `dayjs().add(14,'day')` 는 기기 로컬 시각이라
    // 컴포넌트의 KST 기준 D-day 와 어긋난다. UTC 러너에서 15:00 이후(=KST 다음날)면
    // 하루 밀려 D-13 이 나온다. 픽스처와 검증 대상이 **같은 시계**를 봐야 한다.
    deadline: addDays(todayLocal(), 14),
    planned: false,
    ...over,
  })

describe('FirstCardCelebration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCelebrationStore.getState().dismissFirstCard()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) store 비면 렌더 없음', () => {
    const { container } = render(<FirstCardCelebration />)
    expect(container.firstChild).toBeNull()
  })

  it('2) full — 체크 3개 + D-day 뱃지, 유도 문구 없음', () => {
    show()
    render(<FirstCardCelebration />)
    expect(screen.getByText('첫 카드 완성')).toBeInTheDocument()
    expect(screen.getByText('카카오')).toBeInTheDocument()
    expect(screen.getByText('전형 단계 템플릿 적용')).toBeInTheDocument()
    expect(screen.getByText('마감 D-day 계산 완료')).toBeInTheDocument()
    expect(screen.getByText('D-14')).toBeInTheDocument()
    expect(screen.getByText('캘린더에 자동 등록')).toBeInTheDocument()
    expect(screen.queryByText(/마감일을 넣으면/)).toBeNull()
  })

  it('3) 마감일 없음 — 유도 문구, D-day·캘린더 체크 없음', () => {
    show({ deadline: null })
    render(<FirstCardCelebration />)
    expect(screen.getByText('전형 단계 템플릿 적용')).toBeInTheDocument()
    expect(screen.getByText(/마감일을 넣으면 D-day·캘린더가 자동/)).toBeInTheDocument()
    expect(screen.queryByText('마감 D-day 계산 완료')).toBeNull()
    expect(screen.queryByText('캘린더에 자동 등록')).toBeNull()
  })

  it('4) planned — 등록 체크 + 유도, 템플릿 체크 없음', () => {
    show({ planned: true, hadTemplate: false, deadline: null })
    render(<FirstCardCelebration />)
    expect(screen.getByText('지원 예정 보드에 등록 완료')).toBeInTheDocument()
    expect(screen.getByText(/지원을 시작하면 전형 단계·D-day·캘린더가 자동/)).toBeInTheDocument()
    expect(screen.queryByText('전형 단계 템플릿 적용')).toBeNull()
  })

  it('5) CTA → navigate + dismiss', () => {
    show()
    render(<FirstCardCelebration />)
    fireEvent.click(screen.getByRole('button', { name: '카드 보러가기 →' }))
    expect(navigateMock).toHaveBeenCalledWith('/board/app-1')
    expect(useCelebrationStore.getState().firstCard).toBeNull()
  })

  it('6) 배경 클릭 → dismiss', () => {
    show()
    render(<FirstCardCelebration />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(useCelebrationStore.getState().firstCard).toBeNull()
  })

  /**
   * 🔴 **CI 가 언제 도느냐에 따라 깨지면 안 된다** — 실제로 여기서 한 번 터졌다.
   *
   * D-day 는 **KST 기준**인데 픽스처를 `dayjs().add(14,'day')`(기기 로컬)로 만들고 있었다.
   * 두 시계는 **15:00~24:00 UTC 구간에서만** 갈린다 — 그때 KST 는 이미 다음 날이라
   * 하루가 밀려 `D-13` 이 된다. 로컬 실행(14:30 UTC)은 그 구간을 안 지나서 통과했고,
   * CI 가 15:48 UTC 에 돌면서 드러났다.
   *
   * **타임존 테스트는 `TZ` 만 바꿔선 부족하다 — "언제 도는가" 도 조건이다.**
   * 그래서 이 케이스는 그 구간에 시각을 고정해 둔다.
   *
   * ⚠️ **이 테스트는 `TZ=Asia/Seoul`(개발 기본값)에서는 회귀를 못 잡는다.** 픽스처를 로컬
   * 시각으로 되돌려도 로컬 TZ 가 KST 면 두 시계가 일치해 그냥 통과한다 — 실측으로 확인했다.
   * 잡히는 건 CI(UTC) 뿐이므로, **"테스트가 있으니 안전" 이라고 읽으면 안 된다.**
   */
  it('🔴 KST 날짜 경계(UTC 15:48 = KST 익일 00:48)에도 D-14 로 나온다', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-04T15:48:00.000Z')) // KST 2026-08-05 00:48
    show()
    render(<FirstCardCelebration />)
    expect(screen.getByText('D-14')).toBeInTheDocument()
  })
})
