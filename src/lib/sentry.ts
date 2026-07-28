import * as Sentry from '@sentry/react'
import type { ErrorEvent, Breadcrumb } from '@sentry/react'

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
    beforeSend: scrubEvent,
  })

  Sentry.setTag('platform', detectPlatform())
}

/** 로그인 시 호출 — id 만 전달한다 (이메일·닉네임 금지) */
export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null)
}
