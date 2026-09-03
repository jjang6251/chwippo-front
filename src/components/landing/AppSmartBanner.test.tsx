import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSmartBanner } from './AppSmartBanner'

/**
 * 랜딩 커스텀 스마트 배너 — **뜨면 안 되는 자리에서 안 뜨는가**가 이 spec 의 본론이다.
 *
 * 노출 조건이 5겹(OS · 네이티브 · iOS 사파리 · 광고 세션 · 14일 dismiss)이라, 한 겹이 뚫리면
 * 다음 셋 중 하나가 된다: ① iOS 사파리에서 애플 배너와 **이중 배너** ② 앱 안에서 앱을 받으라고 함
 * ③ 광고로 들어온 첫 세션에서 가입 대신 스토어로 이탈. 셋 다 되돌리기 어려운 종류다.
 *
 * 시나리오
 *  1) 숨김 — 데스크탑(other) · iOS 사파리(마커 없음) · 네이티브 앱
 *  2) 노출 — Android · iOS 인앱 브라우저(CriOS 등) + 받기 href 의 OS 분기
 *  3) dismiss — 14일 이내 숨김 / 경과 노출 / 깨진 값은 노출 / 닫으면 즉시 사라지고 기록
 *  4) 광고 유입 — utm_campaign=season_2609 URL · 그 뒤 URL 이 사라진 같은 세션
 *  5) 저장소 고장 — 읽기·쓰기 throw 시에도 배너는 뜨고 닫힌다 (실패 방향 = 노출)
 */

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  nativeWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 chwippo-mobile-webview/1.0',
} as const

const DISMISS_KEY = 'chwippo:app-banner-dismissed-at'
const AD_SESSION_KEY = 'chwippo:app-banner-ad-session'
const DAY_MS = 24 * 60 * 60 * 1000

const originalUA = navigator.userAgent
const originalTouchPoints = navigator.maxTouchPoints

function setEnv(ua: string, maxTouchPoints = 5) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
}

/** 배너가 떴는가 — 「받기」 링크 존재로 판정 (텍스트가 아니라 실제 진입점) */
function banner() {
  return screen.queryByRole('link', { name: /치뽀 앱 받기/ })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  document.documentElement.removeAttribute('data-native')
})

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.documentElement.removeAttribute('data-native')
  setEnv(originalUA, originalTouchPoints)
  vi.restoreAllMocks()
})

describe('AppSmartBanner — 뜨면 안 되는 자리', () => {
  it('데스크탑(other)에서는 렌더하지 않는다', () => {
    setEnv(UA.macSafari, 0)
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * 🔴 애플이 이미 상단에 「받기」 배너를 그리는 자리다. 여기서 우리 배너가 같이 뜨면
   * 같은 말이 두 줄 쌓인다 — 마커가 없으면 사파리로 간주해 접는 이유.
   */
  it('🔴 iOS 사파리(비사파리 마커 없음)에서는 렌더하지 않는다 — 애플 배너 양보', () => {
    setEnv(UA.iphoneSafari)
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('네이티브 앱(WebView) 안에서는 렌더하지 않는다', () => {
    setEnv(UA.nativeWebView)
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('네이티브 표식(html[data-native]) 만으로도 렌더하지 않는다', () => {
    setEnv(UA.androidChrome)
    document.documentElement.setAttribute('data-native', '1')
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AppSmartBanner — 노출과 받기 href OS 분기', () => {
  it('Android 웹 → 노출 · Google Play 로 새 탭', () => {
    setEnv(UA.androidChrome)
    render(<AppSmartBanner />)
    const link = banner()
    expect(link).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.chwippo.app',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAccessibleName('Google Play 에서 치뽀 앱 받기')
  })

  it('iOS 인앱 브라우저(CriOS) → 노출 · App Store 로 새 탭', () => {
    setEnv(UA.iphoneChrome)
    render(<AppSmartBanner />)
    const link = banner()
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/id6789707709')
    expect(link).toHaveAccessibleName('App Store 에서 치뽀 앱 받기')
  })

  it('애플 배너와 같은 정보 구조 — 앱 이름·한 줄 설명·닫기', () => {
    setEnv(UA.androidChrome)
    render(<AppSmartBanner />)
    expect(screen.getByText('치뽀')).toBeInTheDocument()
    expect(screen.getByText('마감 알림은 앱으로 받으세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '앱 안내 닫기' })).toBeInTheDocument()
  })
})

describe('AppSmartBanner — 닫기 기억(14일)', () => {
  it('닫으면 즉시 사라지고 닫은 시각을 기록한다', () => {
    setEnv(UA.androidChrome)
    render(<AppSmartBanner />)
    fireEvent.click(screen.getByRole('button', { name: '앱 안내 닫기' }))
    expect(banner()).toBeNull()
    const at = Number(window.localStorage.getItem(DISMISS_KEY))
    expect(Number.isFinite(at)).toBe(true)
    expect(Math.abs(Date.now() - at)).toBeLessThan(5_000)
  })

  it('닫은 지 14일 이내면 렌더하지 않는다', () => {
    setEnv(UA.androidChrome)
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() - 13 * DAY_MS))
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('14일이 지나면 다시 노출된다', () => {
    setEnv(UA.androidChrome)
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() - 15 * DAY_MS))
    render(<AppSmartBanner />)
    expect(banner()).toBeInTheDocument()
  })

  /** 값이 깨져 있으면(수기 편집·구버전 형식) 「닫은 적 없음」으로 본다 — 노출 방향 */
  it('기록이 숫자가 아니면 노출한다', () => {
    setEnv(UA.androidChrome)
    window.localStorage.setItem(DISMISS_KEY, 'yes')
    render(<AppSmartBanner />)
    expect(banner()).toBeInTheDocument()
  })
})

describe('AppSmartBanner — 광고 유입 첫 세션 보호', () => {
  /**
   * 🔴 인스타 광고는 「가입」을 산다. 도착 직후 스토어로 나가는 문을 열면
   * 그 클릭값이 앱 설치 이탈로 새어 전환이 안 잡힌다.
   */
  it('🔴 utm_campaign=season_2609 로 들어오면 렌더하지 않는다', () => {
    setEnv(UA.androidChrome)
    window.history.replaceState({}, '', '/?utm_campaign=season_2609')
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('진입 시점에 세션 표식을 남겨, URL 이 사라진 뒤에도 그 세션 내내 접는다', () => {
    setEnv(UA.androidChrome)
    window.history.replaceState({}, '', '/?utm_campaign=season_2609')
    render(<AppSmartBanner />)
    expect(window.sessionStorage.getItem(AD_SESSION_KEY)).toBe('1')

    // 라우팅으로 utm 이 사라진 뒤 다시 마운트돼도 여전히 숨김
    window.history.replaceState({}, '', '/')
    const { container } = render(<AppSmartBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('다른 캠페인 utm 은 억제하지 않는다', () => {
    setEnv(UA.androidChrome)
    window.history.replaceState({}, '', '/?utm_campaign=organic_blog')
    render(<AppSmartBanner />)
    expect(banner()).toBeInTheDocument()
    expect(window.sessionStorage.getItem(AD_SESSION_KEY)).toBeNull()
  })
})

describe('AppSmartBanner — 저장소가 막혀 있어도 동작한다', () => {
  /** 사파리 프라이빗·쿠키 차단 환경에서 Storage 접근은 실제로 throw 한다 */
  it('localStorage 읽기가 throw 하면 노출 방향으로 실패한다', () => {
    setEnv(UA.androidChrome)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    render(<AppSmartBanner />)
    expect(banner()).toBeInTheDocument()
  })

  it('localStorage 쓰기가 throw 해도 닫기는 동작한다 (그 화면에서는 사라진다)', () => {
    setEnv(UA.androidChrome)
    render(<AppSmartBanner />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: '앱 안내 닫기' })),
    ).not.toThrow()
    expect(banner()).toBeNull()
  })
})
