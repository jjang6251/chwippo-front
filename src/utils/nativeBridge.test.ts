import { afterEach, describe, expect, it, vi } from 'vitest'
import { postToNative } from './nativeBridge'

/**
 * nativeBridge spec.
 *
 * 시나리오:
 *   1) ReactNativeWebView 없음 (일반 브라우저) → no-op
 *   2) ReactNativeWebView 있음 → postMessage 호출
 *   3) 메시지 stringify 정확
 *   4) postMessage 안에서 throw 해도 caller 정상
 */

interface RNWindowMock {
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

describe('postToNative', () => {
  afterEach(() => {
    delete (window as unknown as RNWindowMock).ReactNativeWebView
  })

  it('ReactNativeWebView 없으면 no-op · throw X', () => {
    expect(() => postToNative({ type: 'logout' })).not.toThrow()
  })

  it('ReactNativeWebView 있으면 stringify 후 postMessage 호출', () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }

    postToNative({ type: 'theme', theme: 'dark' })

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: 'theme', theme: 'dark' }),
    )
  })

  it('여러 메시지 타입 · 각각 stringify', () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }

    postToNative({ type: 'logout' })
    postToNative({ type: 'account-deleted' })
    postToNative({ type: 'theme', theme: 'light' })

    expect(postMessage).toHaveBeenNthCalledWith(1, '{"type":"logout"}')
    expect(postMessage).toHaveBeenNthCalledWith(2, '{"type":"account-deleted"}')
    expect(postMessage).toHaveBeenNthCalledWith(
      3,
      '{"type":"theme","theme":"light"}',
    )
  })

  it("deadline-saved (가치 순간) → stringify 후 postMessage", () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }

    postToNative({ type: 'deadline-saved' })

    expect(postMessage).toHaveBeenCalledWith('{"type":"deadline-saved"}')
  })

  it('deadline-saved · ReactNativeWebView 없으면 no-op (WebView 밖)', () => {
    expect(() => postToNative({ type: 'deadline-saved' })).not.toThrow()
  })

  it('postMessage 내부에서 throw → caller 는 정상 (silent)', () => {
    ;(window as unknown as RNWindowMock).ReactNativeWebView = {
      postMessage: () => {
        throw new Error('bridge crashed')
      },
    }

    expect(() => postToNative({ type: 'logout' })).not.toThrow()
  })
})
