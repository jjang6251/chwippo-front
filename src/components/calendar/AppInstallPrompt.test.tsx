import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import { AppInstallPrompt } from './AppInstallPrompt'

/**
 * 캘린더 홈 앱 유도 배너.
 *
 * 랜딩 배너와 조건이 **일부러 다르다**: 여긴 이미 로그인해서 쓰고 있는 사람의 홈이라
 *  - iOS 사파리도 대상이다 (헤더 위 띠가 아니라 카드라 애플 배너와 자리가 겹치지 않는다)
 *  - dismiss 는 **영구**다 — 안 깔기로 한 사람에게 매달 다시 묻는 건 광고다
 *
 * 시나리오
 *  1) 숨김 — 데스크탑 · 네이티브 앱 · 데모 모드 · 이미 닫음
 *  2) 노출 — Android / iOS(사파리 포함) + 「앱 받기」 href OS 분기
 *  3) 닫기 — 즉시 사라지고 영구 기록('1')
 *  4) 저장소 고장 — 읽기 throw 시 노출 · 쓰기 throw 시에도 닫힘
 */

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  nativeWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 chwippo-mobile-webview/1.0',
} as const

const DISMISS_KEY = 'chwippo:app-prompt-dismissed'

const originalUA = navigator.userAgent
const originalTouchPoints = navigator.maxTouchPoints

function setEnv(ua: string, maxTouchPoints = 5) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
}

function renderPrompt(demo = false) {
  return render(
    <DemoModeContextProvider value={demo}>
      <AppInstallPrompt />
    </DemoModeContextProvider>,
  )
}

function cta() {
  return screen.queryByRole('link', { name: /치뽀 앱 받기/ })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState({}, '', '/calendar')
  document.documentElement.removeAttribute('data-native')
})

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-native')
  setEnv(originalUA, originalTouchPoints)
  vi.restoreAllMocks()
})

describe('AppInstallPrompt — 노출 조건', () => {
  it('데스크탑에서는 렌더 자체를 하지 않는다', () => {
    setEnv(UA.macSafari, 0)
    const { container } = renderPrompt()
    expect(container).toBeEmptyDOMElement()
  })

  it('네이티브 앱 안에서는 렌더하지 않는다 (앱 안에서 앱을 받으라고 할 수 없다)', () => {
    setEnv(UA.nativeWebView)
    const { container } = renderPrompt()
    expect(container).toBeEmptyDOMElement()
  })

  it('데모 모드에서는 렌더하지 않는다', () => {
    setEnv(UA.androidChrome)
    const { container } = renderPrompt(true)
    expect(container).toBeEmptyDOMElement()
  })

  it('Android 모바일 웹 → 노출 · Google Play 로', () => {
    setEnv(UA.androidChrome)
    renderPrompt()
    expect(screen.getByText('마감 알림은 앱이 확실해요')).toBeInTheDocument()
    expect(cta()).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.chwippo.app',
    )
  })

  /** 랜딩 배너와 달리 사파리를 빼지 않는다 — 카드 자리라 애플 배너와 겹치지 않는다 */
  it('iOS 사파리에서도 노출된다 · App Store 로', () => {
    setEnv(UA.iphoneSafari)
    renderPrompt()
    expect(cta()).toHaveAttribute('href', 'https://apps.apple.com/app/id6789707709')
    expect(cta()).toHaveAttribute('target', '_blank')
    expect(cta()).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('AppInstallPrompt — 닫기는 영구다', () => {
  it('닫으면 사라지고 영구 기록을 남긴다', () => {
    setEnv(UA.androidChrome)
    renderPrompt()
    fireEvent.click(screen.getByRole('button', { name: '앱 안내 닫기' }))
    expect(cta()).toBeNull()
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1')
  })

  /**
   * 🔴 랜딩 배너(14일)와 다른 지점이다. 시각이 아니라 '1' 을 저장하므로 만료가 없다 —
   * 여기에 만료를 붙이면 이미 거절한 사용자에게 홈에서 매번 같은 말을 걸게 된다.
   */
  it('🔴 이미 닫았으면 시간이 아무리 지나도 다시 뜨지 않는다', () => {
    setEnv(UA.androidChrome)
    window.localStorage.setItem(DISMISS_KEY, '1')
    const { container } = renderPrompt()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AppInstallPrompt — 저장소가 막혀 있어도 동작한다', () => {
  it('읽기가 throw 하면 노출 방향으로 실패한다', () => {
    setEnv(UA.androidChrome)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    renderPrompt()
    expect(cta()).toBeInTheDocument()
  })

  it('쓰기가 throw 해도 닫기는 동작한다', () => {
    setEnv(UA.androidChrome)
    renderPrompt()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: '앱 안내 닫기' })),
    ).not.toThrow()
    expect(cta()).toBeNull()
  })
})
