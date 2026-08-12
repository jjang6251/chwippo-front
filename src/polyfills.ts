/**
 * iOS 15.4 미만 WebKit 용 ES2022 내장 API · Web API 보충.
 *
 * 구형 사파리에는 아래 API 가 **아예 없어서** 호출 즉시 TypeError 로 화면이 통째로 죽는다.
 * 실사고: Sentry CHWIPPO-FRONT-3 · 4 · 5 · 7 · 9.
 *
 * 지난 릴리즈(v1.13.3)에서는 우리 소스의 `Object.hasOwn` · `structuredClone` 을 옛 문법으로
 * 손 치환해 막았다. 그런데 이번엔 **의존성 내부**에서 터졌다 —
 * tiptap/prosemirror 가 `Array.prototype.findLast` 를 쓴다. 남의 코드는 치환할 수 없으므로
 * 전역 polyfill 로 올린다. 여기서 채우면 우리 소스·의존성이 **같이** 커버된다.
 *
 * core-js 의 `actual/*` 엔트리는 **기능 감지 후 없을 때만** 프로토타입에 심는다.
 * 최신 브라우저(대다수 사용자)에서는 사실상 no-op 이라 동작이 바뀌지 않는다.
 *
 * ⚠️ 이 파일은 `main.tsx` 의 **첫 import** 여야 한다 — 아래 main.tsx 주석 참조.
 */
import 'core-js/actual/object/has-own'
import 'core-js/actual/array/at'
import 'core-js/actual/string/at'
import 'core-js/actual/array/find-last'
import 'core-js/actual/array/find-last-index'
import 'core-js/actual/structured-clone'

/**
 * `crypto.randomUUID` — **core-js 가 안 덮는 Web API 라 직접 작성한다.**
 * core-js 는 ECMAScript 표준 내장만 다루고, `crypto` 는 WebCrypto(브라우저) 스펙이다.
 *
 * Safari 15.4 미만에 없어서 `crypto.randomUUID is not a function` 으로 터졌다
 * (Sentry CHWIPPO-FRONT-9). 하필 **토스트 시스템(`toastStore.show`)이 id 발급에 쓰고 있어**
 * 위 클립보드 실패 안내처럼 "에러를 알려주는 경로" 자체가 같이 죽었다.
 *
 * 토대는 `crypto.getRandomValues` (Safari 6+ · 우리 지원 범위 전체가 가짐).
 * RFC 4122 §4.4 의 version(4) · variant(10xx) 비트를 직접 박는다.
 */
export function randomUUIDFallback(): ReturnType<Crypto['randomUUID']> {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // 7번째 바이트 상위 nibble = 4 (version), 9번째 바이트 상위 2비트 = 10 (variant)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// core-js 와 같은 철학 — 기능 감지 후 **없을 때만** 심는다. 최신 브라우저에서는 no-op.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = randomUUIDFallback
}
