/**
 * SuspendedModal 로그아웃 — 브리지 구멍 메움 + 앱 랜딩 깜빡임 (2026-08-12).
 *
 * 🔴 이 화면만 `postToNative({type:'logout'})` 이 **빠져 있었다.** 앱에서 정지 로그아웃을
 * 하면 네이티브 SecureStore 가 안 지워져, 재시작 때 토큰이 있다고 낙관 진입했다가
 * 401 을 맞고 나서야 정리됐다. 다른 로그아웃 경로와 같은 계약으로 맞춘다.
 *
 * 시나리오:
 * 1. 브라우저: clearAuth + logout 브리지 + href='/'   ← 브리지는 신설분
 * 2. 앱: clearAuth + logout 브리지 · href 미변경 (화면 전환은 네이티브 소유)
 * 3. 정지 정보(사유·시점·해제 예정)는 그대로 렌더 — 로그아웃 수정이 화면을 건드리지 않음
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SuspendedModal } from './SuspendedModal'
import { useAuthStore } from '@/stores/authStore'
import { postToNative } from '@/utils/nativeBridge'

// postToNative 만 관찰용으로 바꾸고 isInNativeApp 은 **실제 구현**을 쓴다 —
// 앱 판정은 window.ReactNativeWebView 주입/제거로 재현해야 실제 계약을 검증한다.
vi.mock('@/utils/nativeBridge', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/nativeBridge')>(
      '@/utils/nativeBridge',
    )
  return { ...actual, postToNative: vi.fn() }
})

const mockedPostToNative = vi.mocked(postToNative)

interface RNWindowMock {
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

function renderModal() {
  return render(
    <MemoryRouter>
      <SuspendedModal
        suspendedAt="2026-08-01T00:00:00.000Z"
        suspendReason="약관 위반"
        suspendExpiresAt={null}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: 'test-token', user: null })
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
})

afterEach(() => {
  // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
  delete (window as unknown as RNWindowMock).ReactNativeWebView
})

describe('SuspendedModal — 정지 로그아웃', () => {
  it('1. 브라우저: clearAuth + logout 브리지 + href="/"', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
    expect(window.location.href).toBe('/')
  })

  it('2. 🔴 앱: logout 브리지 발신 (네이티브 SecureStore 정리) · href 미변경', () => {
    ;(window as unknown as RNWindowMock).ReactNativeWebView = {
      postMessage: vi.fn(),
    }
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(window.location.href).toBe('')
  })

  it('3. 정지 안내는 그대로 렌더 (사유·문의 진입점)', () => {
    renderModal()

    expect(screen.getByText('계정이 정지되었습니다')).toBeTruthy()
    expect(screen.getByText('약관 위반')).toBeTruthy()
    expect(screen.getByText('영구')).toBeTruthy()
    expect(screen.getByRole('link', { name: '문의하기' })).toBeTruthy()
  })
})
