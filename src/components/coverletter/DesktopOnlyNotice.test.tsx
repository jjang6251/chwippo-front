import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopOnlyNotice } from './DesktopOnlyNotice'

/**
 * 앱(WebView)·모바일 웹에서 자소서 **AI 가 막혀 있을 때** 뜨는 안내.
 *
 * 🔴 2026-08-23 — 모바일에서 문항·답변 편집이 열렸다. 그래서 이 안내가 말할 수 있는 건
 * **AI(초안 채팅·검사)가 PC 전용**이라는 것뿐이다. 「보기 전용」·「작성은 PC에서」 로
 * 남으면 **있는 길을 감춘다.**
 *
 * 기존 문구는 "PC에서 작성할 수 있어요" 로 끝나 **어디로 가야 하는지가 없었다.**
 * 앱 사용자는 자기가 웹을 보고 있다는 것도 모르고 주소를 옮겨적을 수도 없어
 * 핵심 기능 앞에서 막다른 길이었다 (2026-07-29).
 *
 * 케이스:
 *  1. 주소가 화면에 보인다 (복사가 실패해도 눈으로 읽을 수 있어야 함)
 *  2. 복사 버튼 → 클립보드에 https 전체 주소
 *  3. 복사 후 "복사됨" 피드백
 *  4. 클립보드 실패(권한 거부·비보안) → throw 하지 않고 주소를 토스트로 안내
 *  5. 같은 계정 안내 문구 (로그인 다시 해야 하나 하는 불안 제거)
 *  6. **결제·구매 문구 없음** — 앱에서 외부 결제 유도는 심사 리젝 사유
 */

const toastShow = vi.fn()
const toastError = vi.fn()
vi.mock('@/stores/toastStore', () => ({
  toast: {
    show: (...a: unknown[]) => toastShow(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}))

function setClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: impl } })
}

beforeEach(() => {
  toastShow.mockReset()
  toastError.mockReset()
  setClipboard(() => Promise.resolve())
})

describe('DesktopOnlyNotice', () => {
  it('1. 주소가 화면에 보인다', () => {
    render(<DesktopOnlyNotice />)
    expect(screen.getByText('chwippo.com')).toBeInTheDocument()
  })

  it('2·3. 복사 버튼 → https 전체 주소 복사 + "복사됨" 피드백', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    render(<DesktopOnlyNotice />)
    fireEvent.click(screen.getByRole('button', { name: /주소 복사/ }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://chwippo.com'),
    )
    await waitFor(() => expect(screen.getByText('복사됨')).toBeInTheDocument())
    expect(toastShow).toHaveBeenCalled()
  })

  it('4. 클립보드 실패 → throw 하지 않고 주소를 토스트로 안내', async () => {
    setClipboard(() => Promise.reject(new Error('denied')))

    render(<DesktopOnlyNotice />)
    fireEvent.click(screen.getByRole('button', { name: /주소 복사/ }))

    // 실패는 error 토스트여야 한다 — info 로 뜨면 실패인지 알 수 없다
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('chwippo.com'),
      ),
    )
    // 실패했으므로 "복사됨" 으로 바뀌면 안 된다 (거짓 성공 표시 금지)
    expect(screen.queryByText('복사됨')).not.toBeInTheDocument()
  })

  it('5. 같은 계정으로 이어진다는 안내가 있다', () => {
    render(<DesktopOnlyNotice />)
    expect(screen.getByText(/같은 계정으로 로그인하면/)).toBeInTheDocument()
  })

  it('6. 결제·구매 뉘앙스 문구가 없다 (앱 심사 리스크)', () => {
    const { container } = render(<DesktopOnlyNotice />)
    const text = container.textContent ?? ''
    for (const banned of ['결제', '구매', '구독', '결제하', '요금']) {
      expect(text).not.toContain(banned)
    }
  })

  it('variant=inline 이면 카드 안 보조 문구 톤으로 바뀐다', () => {
    render(<DesktopOnlyNotice variant="inline" />)
    expect(screen.getByText(/AI 초안·검사는 PC에서/)).toBeInTheDocument()
  })

  /**
   * 🔴 **못 하는 것만 PC 전용이라고 말한다** (2026-08-23 모바일 편집 개방).
   * 문항·답변은 모바일에서 쓸 수 있으므로 「보기 전용」·「작성은 PC에서」 는 거짓이 됐다.
   * 두 variant 모두 잠근다 — 한쪽만 고치면 화면마다 다른 말을 한다.
   */
  it('🔴 작성 자체가 PC 전용인 것처럼 말하지 않는다', () => {
    for (const variant of ['banner', 'inline'] as const) {
      const { container, unmount } = render(<DesktopOnlyNotice variant={variant} />)
      const text = container.textContent ?? ''
      expect(text, variant).not.toMatch(/보기 전용/)
      expect(text, variant).not.toMatch(/작성.{0,3}은 PC에서/)
      expect(text, variant).toMatch(/AI/)
      unmount()
    }
  })
})
