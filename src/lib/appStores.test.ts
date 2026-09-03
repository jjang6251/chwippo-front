import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STORE_URLS,
  detectMobileOS,
  isConfirmedNonSafariIos,
  isNativeApp,
  storeUrlFor,
} from './appStores'

/**
 * appStores — 앱 배너의 노출 판정 근거.
 *
 * 🔴 **내가 지어낸 UA 로는 내 전제를 검증할 수 없다.** 판정이 틀리면 두 방향으로 다르게 아프다:
 *  - 과탐(iOS 사파리를 비사파리로 오인) → 애플 스마트 배너와 **이중 배너**
 *  - 미탐(안드로이드를 못 알아봄) → 배너가 그냥 안 뜬다 (무해)
 * 그래서 아래 픽스처는 **실제 브라우저·인앱 브라우저가 보내는 형태**를 그대로 쓰고,
 * 애매한 쪽은 전부 미탐(= 'other' · false)으로 떨어지는지 확인한다.
 *
 * 시나리오
 *  1) OS 판정 — Android · iPhone · iPad 데스크탑모드(Mac UA + 터치) · Mac 데스크탑 · 빈 UA · Windows 터치
 *  2) 비사파리 iOS 확정 — 마커 있는 인앱/서드파티 브라우저만 true, 사파리·안드로이드는 false
 *  3) 네이티브 판정 — UA · ?native=1 · sessionStorage · html[data-native] 4종 · 저장소 throw
 *  4) storeUrlFor — OS ↔ 스토어 주소 짝
 */

/** 실제 UA 문자열 픽스처 (2026-09 기준) */
const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 EdgiOS/126.0.2592.87 Mobile/15E148 Safari/604.1',
  iphoneKakao:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 335.0.0.32.99 (iPhone15,3; iOS 17_5_1; ko_KR)',
  iphoneFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.42.107;FBBV/589634712]',
  iphoneNaver:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.7.0)',
  /** iPadOS 13+ 「데스크탑용 사이트 요청」 기본값 — Mac 과 UA 가 구분되지 않는다 */
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsTouch:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  /** chwippo-mobile 이 WebView 에 붙이는 커스텀 UA */
  nativeWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 chwippo-mobile-webview/1.0',
} as const

describe('detectMobileOS — UA 픽스처 ↔ 판정 매트릭스', () => {
  const cases: Array<[string, string, number, ReturnType<typeof detectMobileOS>]> = [
    ['Android 크롬', UA.androidChrome, 5, 'android'],
    ['Android 인앱 WebView', UA.androidWebView, 5, 'android'],
    ['iPhone 사파리', UA.iphoneSafari, 5, 'ios'],
    ['iPhone 크롬(CriOS)', UA.iphoneChrome, 5, 'ios'],
    ['iPhone 카카오 인앱', UA.iphoneKakao, 5, 'ios'],
    ['iPad 데스크탑 모드(Mac UA + 터치 5)', UA.ipadDesktopMode, 5, 'ios'],
    ['Mac 데스크탑 사파리(터치 0)', UA.macSafari, 0, 'other'],
    ['Windows 터치 노트북', UA.windowsTouch, 10, 'other'],
    ['네이티브 WebView(iPhone)', UA.nativeWebView, 5, 'ios'],
    ['빈 UA', '', 0, 'other'],
  ]

  it.each(cases)('%s → %s 아님 · 기대 OS', (_label, ua, touch, expected) => {
    expect(detectMobileOS(ua, touch)).toBe(expected)
  })

  /**
   * 🔴 **Mac + 터치는 iPad 로만 되돌린다.** Windows 터치 노트북까지 모바일로 보면
   * 데스크탑 사용자 머리 위에 스토어 배너가 뜬다 — 받을 앱이 없는 사람에게.
   */
  it('Mac UA 는 maxTouchPoints 로만 iPad 와 갈린다', () => {
    expect(detectMobileOS(UA.macSafari, 0)).toBe('other')
    expect(detectMobileOS(UA.macSafari, 1)).toBe('other') // 1 은 확신 부족 → other
    expect(detectMobileOS(UA.ipadDesktopMode, 5)).toBe('ios')
  })

  it('인자 없이 부르면 현재 navigator 를 본다 (throw 하지 않는다)', () => {
    expect(() => detectMobileOS()).not.toThrow()
    expect(['ios', 'android', 'other']).toContain(detectMobileOS())
  })
})

describe('isConfirmedNonSafariIos — 마커 없으면 사파리로 간주(배너 양보)', () => {
  const confirmed: Array<[string, string]> = [
    ['iPhone 크롬(CriOS)', UA.iphoneChrome],
    ['iPhone 파이어폭스(FxiOS)', UA.iphoneFirefox],
    ['iPhone 엣지(EdgiOS)', UA.iphoneEdge],
    ['iPhone 카카오톡 인앱', UA.iphoneKakao],
    ['iPhone 인스타그램 인앱', UA.iphoneInstagram],
    ['iPhone 페이스북 인앱(FBAN)', UA.iphoneFacebook],
    ['iPhone 네이버 인앱', UA.iphoneNaver],
  ]

  it.each(confirmed)('%s → true', (_label, ua) => {
    expect(isConfirmedNonSafariIos(ua, 5)).toBe(true)
  })

  /**
   * 🔴 **여기가 이중 배너를 막는 유일한 지점이다.** iPhone 사파리는 애플이 이미
   * 상단에 「받기」배너를 그리므로, 우리 배너가 같이 뜨면 같은 말이 두 줄 쌓인다.
   */
  it('🔴 iPhone 사파리는 false — 애플 스마트 배너에 양보한다', () => {
    expect(isConfirmedNonSafariIos(UA.iphoneSafari, 5)).toBe(false)
  })

  it('iPad 데스크탑 모드도 마커가 없으면 false (사파리로 간주)', () => {
    expect(isConfirmedNonSafariIos(UA.ipadDesktopMode, 5)).toBe(false)
  })

  it('iOS 가 아니면 마커가 있어도 false', () => {
    // 안드로이드 WebView 는 `; wv` 마커를 갖지만 iOS 가 아니다
    expect(isConfirmedNonSafariIos(UA.androidWebView, 5)).toBe(false)
    expect(isConfirmedNonSafariIos(UA.macSafari, 0)).toBe(false)
    expect(isConfirmedNonSafariIos('', 0)).toBe(false)
  })
})

describe('isNativeApp — index.html 인라인 스크립트와 같은 판정', () => {
  const originalUA = navigator.userAgent

  function setNavigatorUA(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  }

  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
    document.documentElement.removeAttribute('data-native')
  })

  afterEach(() => {
    window.sessionStorage.clear()
    document.documentElement.removeAttribute('data-native')
    setNavigatorUA(originalUA)
  })

  it('커스텀 UA(chwippo-mobile-webview) → true', () => {
    expect(isNativeApp(UA.nativeWebView, '')).toBe(true)
  })

  it('?native=1 → true', () => {
    expect(isNativeApp(UA.iphoneSafari, '?native=1')).toBe(true)
  })

  it("native 값이 '1' 이 아니면 false (엄격 매칭)", () => {
    expect(isNativeApp(UA.iphoneSafari, '?native=0')).toBe(false)
    expect(isNativeApp(UA.iphoneSafari, '?native=true')).toBe(false)
  })

  it('sessionStorage chwippo:native-mode=1 → true', () => {
    window.sessionStorage.setItem('chwippo:native-mode', '1')
    expect(isNativeApp(UA.iphoneSafari, '')).toBe(true)
  })

  /** 실제 브라우저에서는 index.html 스크립트가 이미 판정해 박아둔다 — 그게 단일 소스 */
  it('html[data-native="1"] → true (인라인 스크립트 결과 존중)', () => {
    document.documentElement.setAttribute('data-native', '1')
    expect(isNativeApp(UA.iphoneSafari, '')).toBe(true)
  })

  it('일반 브라우저 → false', () => {
    expect(isNativeApp(UA.androidChrome, '')).toBe(false)
    expect(isNativeApp(UA.iphoneSafari, '?utm_campaign=season_2609')).toBe(false)
    expect(isNativeApp('', '')).toBe(false)
  })

  it('🔴 useNativeMode 와 달리 sessionStorage 에 쓰지 않는다 (순수 판정)', () => {
    isNativeApp(UA.nativeWebView, '?native=1')
    expect(window.sessionStorage.getItem('chwippo:native-mode')).toBeNull()
  })

  it('인자 없이 부르면 현재 환경을 본다 (throw 하지 않는다)', () => {
    setNavigatorUA(UA.androidChrome)
    expect(() => isNativeApp()).not.toThrow()
    expect(isNativeApp()).toBe(false)
  })
})

describe('storeUrlFor', () => {
  it('OS 마다 자기 스토어로 · 데스크탑은 null', () => {
    expect(storeUrlFor('ios')).toBe(STORE_URLS.ios)
    expect(storeUrlFor('android')).toBe(STORE_URLS.android)
    expect(storeUrlFor('other')).toBeNull()
  })

  /** 스토어 주소가 조용히 바뀌면 배너·랜딩·하단 섹션이 한꺼번에 잘못된 곳으로 나간다 */
  it('🔴 스토어 주소는 실제 등록된 앱을 가리킨다', () => {
    expect(STORE_URLS.ios).toBe('https://apps.apple.com/app/id6789707709')
    expect(STORE_URLS.android).toBe(
      'https://play.google.com/store/apps/details?id=com.chwippo.app',
    )
  })
})
