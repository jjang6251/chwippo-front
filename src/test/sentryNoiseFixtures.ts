import type { ErrorEvent } from '@sentry/react'

/**
 * 운영 Sentry 서드파티 노이즈 4건의 **실제 이벤트** — `beforeSend` 가 받는 클라이언트 모양으로 변환.
 *
 * 원본: `GET /api/0/organizations/chwippo/issues/{id}/events/latest/` (2026-09-14, SDK 10.68.0).
 * 필요한 필드(exception type·value·mechanism, frames 의 filename·function)만 남기고
 * **프레임 순서는 원본 그대로** 둔다 — 바깥→안쪽, 마지막 프레임이 에러가 던져진 지점.
 *
 * 서버 모양 → 클라이언트 모양 변환 규칙 (@sentry/browser stack-parsers.js · core stacktrace.js 로 확인):
 *  1. 클라이언트 `filename` = 서버 `absPath` (전체 URL). 서버 `filename` 은 쓰지 않는다 —
 *     서버가 http URL 을 경로로 줄이고(`/pagead/js/...`) 우리 번들은 소스맵으로 바꿔 놓은 값이다.
 *     클라이언트 스택 파서는 `abs_path` 를 채우지 않으므로 픽스처에도 없다.
 *  2. 우리 번들 프레임은 소스맵 복원 전 값(`rawStacktrace`)을 쓴다 — 서버의
 *     `../../node_modules/@sentry/browser/.../helpers.js` 는 클라이언트에선
 *     `https://chwippo.com/assets/index-DOLW_sEL.js` + 난독화 함수명 `r` 이다.
 *     서드파티 프레임(iabjs://·페이지 URL·pagead2)은 소스맵이 없어 raw 와 복원본이 같다.
 *  3. 서버 `function: null` → 클라이언트 `'?'` (UNKNOWN_FUNCTION — 파서가 이름 없는 프레임에 채운다).
 *  4. camelCase(`absPath`·`lineNo`·`inApp`) → snake_case. `module`·`context`·`inApp` 은 서버가
 *     계산한 값이라 뺐다 (클라이언트는 모든 프레임을 `in_app: true` 로 보낸다 — 판정에 안 쓴다).
 *  5. mechanism 은 양쪽 모양이 같다.
 */

/** 우리 번들 — FRONT-B·C 바깥 프레임(Sentry 래퍼)의 클라이언트 측 파일 */
export const OUR_BUNDLE = 'https://chwippo.com/assets/index-DOLW_sEL.js'

const IABJS = 'iabjs://navigation_performance_logger_android'
const RUM = 'https://pagead2.googlesyndication.com/pagead/js/r20260909/r20190131/rum_fy2021.js'

export interface NoiseFixture {
  issue: string
  /** Sentry issue id */
  id: string
  /** 매번 새 객체 — beforeSend·scrubEvent 가 이벤트를 제자리 수정한다 */
  make: () => ErrorEvent
}

export const THIRD_PARTY_NOISE_FIXTURES: NoiseFixture[] = [
  {
    // iOS 인앱 브라우저 주입 스크립트 — 파일이 우리 페이지 URL 로 찍힌다
    issue: 'FRONT-1',
    id: '7652386273',
    make: () => ({
      type: undefined,
      exception: {
        values: [
          {
            type: 'TypeError',
            value: "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
            mechanism: { type: 'auto.browser.global_handlers.onerror', handled: false },
            stacktrace: {
              frames: [
                { filename: 'https://chwippo.com/', function: '?' },
                { filename: 'https://chwippo.com/', function: 'sendPageHideMessage' },
                { filename: 'https://chwippo.com/', function: 'sendDataToNative' },
              ],
            },
          },
        ],
      },
    }),
  },
  {
    // Android 인앱 브라우저(Meta 계열) — 바깥 프레임이 우리 번들 안의 Sentry 래퍼
    issue: 'FRONT-B',
    id: '7713707718',
    make: () => ({
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Error invoking postMessage: Java object is gone',
            mechanism: {
              type: 'auto.browser.browserapierrors.addEventListener',
              handled: false,
              data: { handler: '<anonymous>', target: 'EventTarget' },
            },
            stacktrace: {
              frames: [
                { filename: OUR_BUNDLE, function: 'r' },
                { filename: IABJS, function: '?' },
                { filename: IABJS, function: 'sendJsBlockingTimeMessage' },
                { filename: IABJS, function: 'sendDataToNative' },
              ],
            },
          },
        ],
      },
    }),
  },
  {
    // 같은 Android 스크립트 — 함수명에 `window.` 접두가 붙어 찍힌다
    issue: 'FRONT-D',
    id: '7729624854',
    make: () => ({
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Error invoking postMessage: Java exception was raised during method invocation',
            mechanism: { type: 'auto.browser.global_handlers.onerror', handled: false },
            stacktrace: {
              frames: [
                { filename: '<anonymous>', function: '?' },
                { filename: '<anonymous>', function: '?' },
                { filename: IABJS, function: 'window._handleBrowserPreparingToClose' },
                { filename: IABJS, function: 'sendBeforeUnloadMessage' },
                { filename: IABJS, function: 'sendDataToNative' },
              ],
            },
          },
        ],
      },
    }),
  },
  {
    // AdSense 자체 텔레메트리 — 함수명 난독화, 바깥 프레임은 우리 번들의 Sentry 래퍼
    issue: 'FRONT-C',
    id: '7727574975',
    make: () => ({
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            value: 'int64',
            mechanism: {
              type: 'auto.browser.browserapierrors.addEventListener',
              handled: false,
              data: { handler: '<anonymous>', target: 'EventTarget' },
            },
            stacktrace: {
              frames: [
                { filename: OUR_BUNDLE, function: 'r' },
                { filename: RUM, function: '?' },
                { filename: RUM, function: 'le' },
                { filename: RUM, function: 'J' },
                { filename: RUM, function: 'cg' },
                { filename: RUM, function: 'N' },
                { filename: RUM, function: 'yb' },
                { filename: RUM, function: 'Ia' },
              ],
            },
          },
        ],
      },
    }),
  },
]
