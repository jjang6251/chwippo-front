/**
 * 앱 스토어 링크 · 실행 환경 판정 — 랜딩 스마트 배너와 캘린더 앱 유도 배너의 공용 소스.
 *
 * 🔴 **애매하면 「배너를 안 띄우는 쪽」으로 실패한다.** 배너는 없어도 손해가 거의 없지만,
 * 잘못 뜨면 iOS 사파리에서 애플 스마트 배너(`index.html` 의 `apple-itunes-app`)와 겹쳐
 * 같은 말이 화면 위에 두 줄 쌓인다. 그래서 iOS 는 **비사파리임이 UA 로 확정될 때만** 후보다.
 *
 * 전부 순수 함수다 — UA 를 인자로 주입할 수 있어 spec 이 실제 UA 문자열로 검증한다.
 * 어떤 함수도 throw 하지 않는다 (렌더 중에 호출되므로 던지면 페이지가 통째로 죽는다).
 */

export const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6789707709',
  android: 'https://play.google.com/store/apps/details?id=com.chwippo.app',
} as const

export type MobileOS = 'ios' | 'android' | 'other'

/**
 * 「이 iOS 브라우저는 사파리가 아니다」를 **확정**하는 UA 마커.
 *
 * 마커가 없으면 사파리로 간주해 우리 배너를 접는다 — 애플 배너에 양보하는 방향이라
 * 이중 배너 위험이 원리적으로 0 이다. 목록을 늘리면 커버리지가 늘고, 줄이면 안전해진다.
 * (`; wv` 는 WebView 마커다. iOS 에선 드물지만 일부 인앱 브라우저가 그대로 붙인다.)
 */
const NON_SAFARI_IOS_MARKERS = [
  /CriOS/i,
  /FxiOS/i,
  /EdgiOS/i,
  /KAKAOTALK/i,
  /Instagram/i,
  /FBAN|FBAV/i,
  /NAVER/i,
  /;\s?wv/i,
] as const

const NATIVE_UA = /chwippo-mobile-webview/i
/** index.html · useNativeMode 와 같은 키 */
const NATIVE_SESSION_KEY = 'chwippo:native-mode'

function readUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : (navigator.userAgent ?? '')
}

function readMaxTouchPoints(): number {
  return typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0)
}

function readSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search
}

function readNativeAttr(): string | null {
  if (typeof document === 'undefined') return null
  return document.documentElement.getAttribute('data-native')
}

function readSessionFlag(): string | null {
  try {
    return window.sessionStorage.getItem(NATIVE_SESSION_KEY)
  } catch {
    return null
  }
}

/**
 * 모바일 OS 판정. **불확실하면 'other'** (배너가 안 뜨는 방향).
 *
 * iPad 는 iPadOS 13 부터 「데스크탑용 사이트 요청」이 기본이라 UA 가 Mac 과 똑같이 온다.
 * 진짜 Mac 은 `maxTouchPoints` 가 0 이고 iPad 는 5 라, 그 한 가지로만 되돌린다.
 */
export function detectMobileOS(
  ua: string = readUserAgent(),
  maxTouchPoints: number = readMaxTouchPoints(),
): MobileOS {
  if (!ua) return 'other'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  return 'other'
}

/**
 * iOS 이면서 **사파리가 아님이 UA 로 확정**되는 경우만 true.
 *
 * 마커가 없으면 false — 사파리로 간주하고 애플 스마트 배너에 자리를 양보한다.
 */
export function isConfirmedNonSafariIos(
  ua: string = readUserAgent(),
  maxTouchPoints: number = readMaxTouchPoints(),
): boolean {
  if (detectMobileOS(ua, maxTouchPoints) !== 'ios') return false
  return NON_SAFARI_IOS_MARKERS.some((marker) => marker.test(ua))
}

/**
 * 네이티브 앱(WebView) 안인가 — `index.html` 39~52행 · `useNativeMode` 와 **같은 판정**이다.
 *
 * 그 인라인 스크립트가 판정 결과를 `html[data-native="1"]` 로 박으므로, 실제 브라우저에서는
 * 그 속성이 단일 소스다. 스크립트가 안 도는 환경(jsdom·SSR)을 위해 원본 신호 3종도 그대로 본다.
 * `useNativeMode` 와 달리 **sessionStorage 에 쓰지 않는다** — 여긴 순수 판정만 한다.
 */
export function isNativeApp(
  ua: string = readUserAgent(),
  search: string = readSearch(),
): boolean {
  if (readNativeAttr() === '1') return true
  if (NATIVE_UA.test(ua)) return true
  if (new URLSearchParams(search).get('native') === '1') return true
  return readSessionFlag() === '1'
}

/** OS 에 맞는 스토어 주소. 데스크탑('other')에는 줄 스토어가 없으므로 null. */
export function storeUrlFor(os: MobileOS): string | null {
  if (os === 'ios') return STORE_URLS.ios
  if (os === 'android') return STORE_URLS.android
  return null
}
