import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDesktopSeenBeacon } from './useDesktopSeenBeacon'

/**
 * 🔴 이 beacon 이 잘못 쏘면 **관측 지표가 조용히 거짓말을 한다.**
 * 모바일에서 쏘면 "데스크탑 사용자" 가 부풀고, 안 쏘면 자소서 도달 지표의 분모가 0 이 된다.
 * 화면에 아무것도 안 보이는 기능이라 눈으로는 절대 못 잡는다 — 여기서 고정한다.
 */

const markDesktopWebSeen = vi.fn()
vi.mock('@/api/users', () => ({
  markDesktopWebSeen: (...args: unknown[]) => markDesktopWebSeen(...args),
}))

const aiBlocked = vi.fn()
vi.mock('@/hooks/useCoverletterAiBlocked', () => ({
  useCoverletterAiBlocked: () => aiBlocked(),
}))

beforeEach(() => {
  markDesktopWebSeen.mockReset().mockResolvedValue(undefined)
  aiBlocked.mockReset().mockReturnValue(false) // 기본 = 데스크탑 웹
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDesktopSeenBeacon', () => {
  it('데스크탑 웹(게이트 열림) → 1회 발사', async () => {
    renderHook(() => useDesktopSeenBeacon(true))
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
  })

  // 게이트가 닫힌 환경 = 모바일 뷰포트 또는 네이티브. 여기서 쏘면 지표가 오염된다
  it('AI 차단 환경(모바일·네이티브) → 발사하지 않는다', () => {
    aiBlocked.mockReturnValue(true)
    renderHook(() => useDesktopSeenBeacon(true))
    expect(markDesktopWebSeen).not.toHaveBeenCalled()
  })

  // DemoShell 도 AppShell 을 쓴다 — 비로그인 데모 방문자가 쏘면 401 + 무의미한 트래픽
  it('데모(enabled=false) → 발사하지 않는다', () => {
    renderHook(() => useDesktopSeenBeacon(false))
    expect(markDesktopWebSeen).not.toHaveBeenCalled()
  })

  it('성공 후에는 다시 발사하지 않는다 (브라우저당 1회)', async () => {
    const { unmount } = renderHook(() => useDesktopSeenBeacon(true))
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
    unmount()

    renderHook(() => useDesktopSeenBeacon(true))
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
  })

  // 🔴 실패했는데 표식을 남기면 그 브라우저는 **영원히** 스탬프되지 않는다
  it('실패하면 표식을 남기지 않아 다음에 다시 시도한다', async () => {
    markDesktopWebSeen.mockRejectedValueOnce(new Error('network'))
    const { unmount } = renderHook(() => useDesktopSeenBeacon(true))
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
    unmount()

    renderHook(() => useDesktopSeenBeacon(true))
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(2))
  })

  it('발사 실패가 예외로 새어 나오지 않는다', async () => {
    markDesktopWebSeen.mockRejectedValue(new Error('boom'))
    expect(() => renderHook(() => useDesktopSeenBeacon(true))).not.toThrow()
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalled())
  })

  // 모바일로 들어왔다가 창을 넓힌 경우 — 훅이 resize 에 반응하므로 그 시점에 잡혀야 한다
  it('AI 차단 → 데스크탑으로 바뀌면 그때 발사한다', async () => {
    aiBlocked.mockReturnValue(true)
    const { rerender } = renderHook(() => useDesktopSeenBeacon(true))
    expect(markDesktopWebSeen).not.toHaveBeenCalled()

    aiBlocked.mockReturnValue(false)
    rerender()
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
  })

  // Safari 프라이빗 모드 — storage 접근 자체가 던진다
  it('localStorage 가 던져도 죽지 않는다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => renderHook(() => useDesktopSeenBeacon(true))).not.toThrow()
    await waitFor(() => expect(markDesktopWebSeen).toHaveBeenCalledTimes(1))
  })
})
