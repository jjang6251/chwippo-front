/**
 * 공지 컨테이너 — **모달 1 + 배너 1 을 동시에** 꽂는 자리.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *
 * **동시 렌더**
 *  1. 모달 공지 + 배너 공지가 함께 오면 둘 다 보인다
 *  2. 배너만 오면 모달은 안 뜬다
 *  3. 빈 배열이면 아무것도 안 뜬다
 *
 * **dismiss 는 공지마다 따로**
 *  4. 🔴 모달을 닫아도 배너는 남는다 (닫힌 건 모달 id 키만)
 *  5. 🔴 배너를 닫아도 모달은 남는다
 *  6. localStorage 에 이미 닫힌 기록이 있으면 그것만 빠지고 나머지는 뜬다
 *  7. dismiss 키는 **사용자별**이다 — 다른 userId 의 기록은 안 먹는다
 *
 * **배너 펼치기**
 *  8. 모달 공지가 없을 때 배너를 누르면 배너 내용이 모달로 열린다
 *
 * **안 뜨는 조건**
 *  9. 데모 모드면 아무것도 안 뜬다
 * 10. 🔴 userId 가 아직 없으면(auth 로딩) 아무것도 안 뜬다 — 빈 키 오염 차단
 * 11. 🔴 배열 계약 이전 응답(단건 객체)이 와도 죽지 않는다 (배포 순서 어긋남)
 */
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnnouncementContainer } from './AnnouncementContainer'
import { useAuthStore } from '@/stores/authStore'
import type { ActiveAnnouncement } from '@/types/announcement'

let demo = false
vi.mock('@/contexts/demoMode', () => ({
  useDemoMode: () => demo,
}))

let data: unknown = []
vi.mock('@/hooks/useActiveAnnouncements', () => ({
  useActiveAnnouncements: () => ({ data }),
}))

const MODAL: ActiveAnnouncement = {
  id: 'm1',
  title: '공고로 만들기가 생겼어요',
  body: '공고를 붙여넣으면 카드가 만들어져요.',
  type: 'modal',
  kind: 'feature',
  cta_label: null,
  cta_path: null,
}
const BANNER: ActiveAnnouncement = {
  id: 'b1',
  title: '점검 안내',
  body: '오늘 밤 12시에 잠깐 멈춰요.',
  type: 'banner',
  kind: 'notice',
  cta_label: null,
  cta_path: null,
}

function signIn(userId = 'u1') {
  useAuthStore.getState().setUser({
    id: userId,
    nickname: '테스터',
    email: null,
    role: 'user',
    onboardedAt: null,
    termsAgreedAt: null,
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: null,
    signupOtherText: null,
    signupSeriesId: null,
    signupJobTitle: null,
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
  })
}

function renderContainer() {
  return render(
    <MemoryRouter>
      <AnnouncementContainer />
    </MemoryRouter>,
  )
}

const modalDialog = () => screen.queryByRole('dialog')
const bannerLink = (title: string) =>
  screen.queryByRole('button', { name: `공지 상세 보기: ${title}` })

beforeEach(() => {
  localStorage.clear()
  demo = false
  data = []
  signIn()
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearAuth()
})

describe('AnnouncementContainer', () => {
  it('1) 모달 + 배너가 함께 오면 둘 다 렌더', () => {
    data = [MODAL, BANNER]
    renderContainer()
    expect(modalDialog()).toBeInTheDocument()
    expect(screen.getByText('공고로 만들기가 생겼어요')).toBeInTheDocument()
    expect(bannerLink('점검 안내')).toBeInTheDocument()
  })

  it('2) 배너만 오면 모달은 안 뜬다', () => {
    data = [BANNER]
    renderContainer()
    expect(modalDialog()).not.toBeInTheDocument()
    expect(bannerLink('점검 안내')).toBeInTheDocument()
  })

  it('3) 빈 배열 → 아무것도 안 뜬다', () => {
    data = []
    const { container } = renderContainer()
    expect(container).toBeEmptyDOMElement()
  })

  it('4) 모달을 닫아도 배너는 남는다 — 닫힌 건 모달 id 키만', () => {
    data = [MODAL, BANNER]
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: '확인했어요' }))
    expect(modalDialog()).not.toBeInTheDocument()
    expect(bannerLink('점검 안내')).toBeInTheDocument()
    expect(localStorage.getItem('dismissed_announcement_u1_m1')).toBe('1')
    expect(localStorage.getItem('dismissed_announcement_u1_b1')).toBeNull()
  })

  it('5) 배너를 닫아도 모달은 남는다', () => {
    data = [MODAL, BANNER]
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: '공지 닫기' }))
    expect(bannerLink('점검 안내')).not.toBeInTheDocument()
    expect(modalDialog()).toBeInTheDocument()
    expect(localStorage.getItem('dismissed_announcement_u1_b1')).toBe('1')
    expect(localStorage.getItem('dismissed_announcement_u1_m1')).toBeNull()
  })

  it('6) 이미 닫은 기록이 있는 것만 빠진다', () => {
    localStorage.setItem('dismissed_announcement_u1_m1', '1')
    data = [MODAL, BANNER]
    renderContainer()
    expect(modalDialog()).not.toBeInTheDocument()
    expect(bannerLink('점검 안내')).toBeInTheDocument()
  })

  it('7) dismiss 키는 사용자별 — 다른 userId 기록은 안 먹는다', () => {
    localStorage.setItem('dismissed_announcement_other_m1', '1')
    data = [MODAL]
    renderContainer()
    expect(modalDialog()).toBeInTheDocument()
  })

  it('8) 모달 공지가 없을 때 배너를 누르면 배너 내용이 모달로 열린다', () => {
    data = [BANNER]
    renderContainer()
    fireEvent.click(bannerLink('점검 안내')!)
    const dialog = modalDialog()
    expect(dialog).toBeInTheDocument()
    // 배너에도 같은 글자가 있으므로 모달 안에서만 찾는다
    expect(within(dialog!).getByText('오늘 밤 12시에 잠깐 멈춰요.')).toBeInTheDocument()
  })

  it('9) 데모 모드 → 아무것도 안 뜬다', () => {
    demo = true
    data = [MODAL, BANNER]
    const { container } = renderContainer()
    expect(container).toBeEmptyDOMElement()
  })

  it('10) userId 가 아직 없으면 아무것도 안 뜬다', () => {
    useAuthStore.getState().clearAuth()
    data = [MODAL, BANNER]
    const { container } = renderContainer()
    expect(container).toBeEmptyDOMElement()
  })

  it('11) 배열 계약 이전 응답(단건 객체)이 와도 죽지 않는다', () => {
    data = MODAL
    const { container } = renderContainer()
    expect(container).toBeEmptyDOMElement()
  })
})
