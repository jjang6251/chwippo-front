/**
 * Meta Pixel — 광고 성과 측정 (Meta Platforms).
 *
 * **왜 index.html 이 아니라 여기인가** — 메타가 주는 표준 스니펫은 정적 HTML 전제라
 * `fbq('track','PageView')` 를 **최초 1회**만 쏜다. 치뽀는 SPA 라 그 뒤 라우팅은
 * 문서를 다시 로드하지 않는다 — 스니펫만 붙이면 **방문자가 몇 화면을 보든 PageView 1건**이다.
 * 그래서 부트스트랩만 여기서 하고, 라우트 변경 PageView 는
 * `components/layout/MetaPixelPageView` 가 `useLocation` 을 구독해 보낸다.
 *
 * 🔴 **`VITE_META_PIXEL_ID` 미설정이면 완전 no-op** — Sentry·Clarity 와 같은 패턴이다.
 * 로컬 개발·CI·Vercel 프리뷰 트래픽이 운영 픽셀로 섞여 들어가면 광고 최적화가 오염되고,
 * 방침 고지 없는 수집이 된다. 순서는 항상 **방침 시행 → ID 주입** 이다
 * (`src/pages/Privacy.tsx` §5-2 · 시행일 2026-09-10).
 *
 * 🔴 **어떤 경로에서도 던지지 않는다.** 광고 차단기는 `fbevents.js` 를 흔히 막고, 그때
 * `window.fbq` 는 큐 shim 인 채로 남거나 아예 없다. 계측 실패로 앱이 죽으면
 * **광고를 켜는 순간 서비스가 멈춘다** — 계측은 언제나 기능보다 아래다
 * (`lib/clarity.ts` 의 `trackClarityEvent` 와 같은 정책).
 *
 * ⚠️ `/ops/*`(관리자)는 PageView 대상이 아니다. 운영자 한 명의 화면 이동이 광고 모수에
 * 섞이면 표본이 작은 지금은 그대로 왜곡이 된다.
 */

/**
 * 메타 표준 스니펫이 `window` 에 세우는 큐 shim.
 * 🔴 `as any` 를 쓰지 않으려고 **선언 확장**으로 타입을 준다 — 호출부(`window.fbq?.(...)`)가
 * 그대로 타입 검사를 받아야, 이벤트 이름 오타 같은 것이 캐스팅에 묻히지 않는다.
 */
interface Fbq {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: Fbq
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    /** 스니펫이 세우는 내부 별칭 — fbevents.js 가 로드 시 이걸로 큐를 찾는다 */
    _fbq?: Fbq
  }
}

const SCRIPT_ID = 'meta-pixel-script'
const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js'

/** 픽셀이 실제로 켜져 있는가 (미설정 = 로컬·CI·프리뷰) */
export function isMetaPixelActive(): boolean {
  return Boolean(import.meta.env.VITE_META_PIXEL_ID)
}

/**
 * 광고 픽셀에서 제외할 경로 — 관리자 화면.
 * `initMetaPixel`(최초 PageView)과 `MetaPixelPageView`(라우트 변경) **두 곳이 같은 판정**을
 * 써야 한다. 한쪽에만 두면 `/ops` 로 직접 들어온 방문이 새어 나간다.
 */
export function isPixelExcludedPath(pathname: string): boolean {
  return pathname === '/ops' || pathname.startsWith('/ops/')
}

/**
 * 픽셀 초기화. 미설정·중복 호출 시 아무것도 하지 않는다.
 * 스크립트는 메타가 안내하는 형태 그대로 주입한다 (큐 shim → script → init → PageView).
 */
export function initMetaPixel(): void {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID
  if (!pixelId) return // 미설정 = 비활성 (로컬·CI·프리뷰·방침 시행 전)
  if (document.getElementById(SCRIPT_ID)) return // 중복 주입 방지

  try {
    ensureShim()
    injectScript()
    callFbq('init', pixelId)
    // 최초 PageView — 라우트 변경분은 MetaPixelPageView 가 이어받는다
    if (!isPixelExcludedPath(window.location.pathname)) callFbq('track', 'PageView')
  } catch {
    /* 🔴 주입 실패(차단기·CSP)로 앱이 죽으면 안 된다 — 위 주석 참조 */
  }
}

/** 라우트 1회 이동 = PageView 1건. fbq 가 없으면 no-op */
export function trackPageView(): void {
  callFbq('track', 'PageView')
}

/**
 * 가입 완료 전환 — 메타 표준 이벤트 `CompleteRegistration`.
 * 🔴 **성공했을 때만** 부른다. 서버가 「이미 답변」 400 으로 막는 재진입 경로에서 쏘면
 * 같은 사람이 전환 여러 건으로 잡혀 광고 학습이 오염된다.
 */
export function trackSignupComplete(): void {
  callFbq('track', 'CompleteRegistration')
}

/**
 * 큐 shim — 스크립트 로드 전 호출도 유실되지 않게 한다 (로드 후 큐가 재생된다).
 * 🔴 이미 있는 `fbq` 는 덮지 않는다 — 덮으면 그때까지 쌓인 큐가 통째로 사라진다.
 */
function ensureShim(): void {
  if (window.fbq) return
  const fbq = function (...args: unknown[]) {
    // 메타 원본 스니펫은 `callMethod.apply(n, arguments)` 다 — 스프레드도 수신자가 같은 `fbq` 라 동치
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Fbq
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  window.fbq = fbq
  window._fbq ??= fbq
}

function injectScript(): void {
  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.async = true
  s.src = SCRIPT_SRC
  document.head.appendChild(s)
}

/** 모든 발송의 단일 통로 — env 게이트 + 예외 삼킴이 여기 한 곳에만 있으면 된다 */
function callFbq(...args: unknown[]): void {
  if (!isMetaPixelActive()) return
  try {
    window.fbq?.(...args)
  } catch {
    /* 🔴 계측 실패 ≠ 기능 실패 — 위 주석 참조 */
  }
}
