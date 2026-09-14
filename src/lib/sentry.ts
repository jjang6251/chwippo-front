import * as Sentry from '@sentry/react'
import type { ErrorEvent, Breadcrumb, StackFrame } from '@sentry/react'

/**
 * Sentry 에러 추적 — 초기화 + PII 스크러빙.
 *
 * 치뽀는 자소서 본문·실명·전화번호·병역 정보를 다루므로 기본 설정으로 붙이면
 * 요청 본문이 에러 컨텍스트에 딸려가 사용자 작성 내용이 미국 서버에 쌓인다.
 * 개인정보처리방침(2026-08-04 시행) §1 이 "회원이 작성한 내용은 포함되지 않는다"고
 * 공표하므로, 아래 스크러빙은 편의가 아니라 **방침 준수 의무**다.
 *
 * DSN 미설정 시 완전 no-op — 로컬·CI·테스트 부팅에 영향 없음 (REDIS_URL optional 과 같은 패턴).
 */

/** 예외 message 길이 상한 — LLM 프롬프트(자소서 본문 포함)가 예외로 새는 경로 차단 */
const MAX_MESSAGE_LEN = 500

/** 쿼리스트링 제거 — OAuth code·state, 검색어 등이 URL 에 실린다 */
function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

function capText(text: string | undefined): string | undefined {
  if (typeof text !== 'string') return text
  return text.length > MAX_MESSAGE_LEN ? `${text.slice(0, MAX_MESSAGE_LEN)}… (잘림)` : text
}

/**
 * 전송 직전 스크러빙. 8개 유출 경로를 여기서 막는다.
 * Sentry 기본값에 의존하지 않고 **명시적으로 삭제** — SDK 버전이 올라가며 기본값이
 * 바뀌어도 우리 방침은 깨지지 않아야 한다.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  // P1·P2·P3 — 요청 본문·쿼리스트링·헤더·쿠키
  if (event.request) {
    event.request.url = stripQuery(event.request.url)
    delete event.request.data // 자소서 본문·내정보 입력값
    delete event.request.cookies // refresh token
    delete event.request.headers // Authorization Bearer
    delete event.request.query_string
  }

  // P6 — user context 는 id 만. 이메일·닉네임은 방침상 전송 대상이 아니다
  if (event.user) {
    event.user = { id: event.user.id }
  }

  // P7 — 예외 message 길이 cap (AI 프롬프트 유출 차단)
  event.message = capText(event.message)
  for (const ex of event.exception?.values ?? []) {
    ex.value = capText(ex.value)
  }

  // P4·P5 — breadcrumb: console 은 통째로 버리고(우리 코드가 error 객체를 찍는다),
  // 나머지는 URL 쿼리스트링만 절단
  event.breadcrumbs = (event.breadcrumbs ?? [])
    .filter((b: Breadcrumb) => b.category !== 'console')
    .map((b: Breadcrumb) => {
      const data = b.data as Record<string, unknown> | undefined
      if (data && typeof data.url === 'string') {
        return { ...b, data: { ...data, url: stripQuery(data.url) } }
      }
      return b
    })

  return event
}

/**
 * 인앱 브라우저가 페이지에 주입하는 스크립트의 함수명 (우리 소스에는 없는 이름 — grep 0건 확인).
 * FRONT-1(iOS)은 파일이 우리 페이지 URL 로 찍혀 URL 로는 못 가르므로 함수명이 유일한 표식이다.
 * FRONT-D 처럼 `window.` 접두가 붙어 찍히기도 한다.
 */
const IN_APP_BROWSER_FUNCTIONS = new Set([
  'sendDataToNative',
  'sendPageHideMessage',
  'sendBeforeUnloadMessage',
  'sendINPMessage',
  '_handleBrowserPreparingToClose',
])

/** index.html 이 로드하는 AdSense 의 자체 텔레메트리(rum_fy2021.js) 호스트 — FRONT-C */
const AD_SCRIPT_HOST = 'pagead2.googlesyndication.com'

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined // `<anonymous>` 등 URL 이 아닌 프레임
  }
}

function isThirdPartyFrame(frame: StackFrame): boolean {
  for (const url of [frame.filename, frame.abs_path]) {
    if (url && (url.startsWith('iabjs://') || hostOf(url) === AD_SCRIPT_HOST)) return true
  }
  const fn = frame.function?.replace(/^window\./, '')
  return fn !== undefined && IN_APP_BROWSER_FUNCTIONS.has(fn)
}

/**
 * 남이 주입한 스크립트의 에러인가 — 운영 Sentry 노이즈 4건(FRONT-1·B·C·D, 2026-09) 차단.
 * 전부 인앱 브라우저·AdSense 가 제 코드에서 던진 것이라 우리 코드·사용자와 무관하다.
 *
 * **가장 안쪽 프레임**(에러가 던져진 지점)만 본다. frames 는 바깥→안쪽 순서라 마지막이 안쪽이다.
 *  - 메시지 매칭(ignoreErrors)을 쓰지 않는다 — 우리 코드가 같은 문구로 죽으면 그것까지 가린다.
 *  - "프레임 중 하나라도 우리 번들이면 유지"도 안 된다 — FRONT-B·C 의 바깥 프레임은 우리 번들에
 *    든 Sentry 래퍼(addEventListener 감싸기)라 노이즈가 전부 통과한다.
 *
 * 예외가 여럿(cause 연결)이면 **전부** 서드파티일 때만 노이즈 — 우리 에러가 서드파티 에러를
 * cause 로 품은 경우까지 버리지 않기 위해서다. 스택이 없어 판정 불가한 예외는 남긴다.
 */
export function isThirdPartyNoise(event: ErrorEvent): boolean {
  const values = event.exception?.values ?? []
  if (values.length === 0) return false
  return values.every((ex) => {
    const frames = ex.stacktrace?.frames ?? []
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i]
      if (frame.filename || frame.abs_path || frame.function) return isThirdPartyFrame(frame)
    }
    return false
  })
}

/** 전송 직전 훅 — 서드파티 노이즈는 스크럽 전에 버리고, 나머지는 스크럽해서 보낸다 */
export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (isThirdPartyNoise(event)) return null
  return scrubEvent(event)
}

/** 앱(WebView) vs 웹 구분 — index.html 이 native 진입 시 data-native 를 세운다 */
function detectPlatform(): 'app' | 'web' {
  return document.documentElement.dataset.native === '1' ? 'app' : 'web'
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return // 미설정 = 비활성 (로컬·CI·테스트)

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    // 성능 추적 끔 — 무료 티어 quota 는 에러에만 쓴다
    tracesSampleRate: 0,
    // console breadcrumb 만 끈다 (P5) — RouteErrorBoundary 가 error 객체를 console.error 로 찍어
    // 그 인자가 통째로 전송된다. navigation·fetch·xhr·dom breadcrumb 은 디버깅에 필요하므로 유지
    // (URL 쿼리스트링은 beforeSend 에서 절단).
    integrations: (defaults) => [
      ...defaults.filter((i) => i.name !== 'Breadcrumbs'),
      Sentry.breadcrumbsIntegration({ console: false }),
    ],
    beforeSend,
  })

  Sentry.setTag('platform', detectPlatform())
}

/** 로그인 시 호출 — id 만 전달한다 (이메일·닉네임 금지) */
export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null)
}
