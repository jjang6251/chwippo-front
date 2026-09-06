/**
 * 「연결된 확장」 — 백엔드 `src/auth/extension/` 실측 계약 (2026-09-06 로컬 프로브).
 *
 * 모든 응답은 전역 `ResponseTransformInterceptor` 가 `{ data, message }` 로 감싼다.
 * 여기 타입은 **감싸기를 벗긴 뒤**의 모양이다 (`src/api/extension.ts` 의 `unwrap`).
 */

/** `POST /auth/extension/pair` — 6자리·1회용. 재발급하면 이전 코드는 즉시 무효다. */
export interface ExtensionPairCode {
  /** 숫자 6자리 (앞자리 0 포함 — 문자열로 다룬다) */
  code: string
  /** ISO 8601 (UTC). 표시는 남은 **상대 시간**으로만 한다 — 절대 시각을 그리지 않는다 */
  expiresAt: string
  /** 서버가 정한 수명(초). 카운트다운의 분모 — 60 을 상수로 박지 않는다 */
  ttlSeconds: number
}

/** `GET /auth/extension/sessions` — 살아 있는 확장 세션만 (revoke·만료분 제외). */
export interface ExtensionSession {
  id: string
  /**
   * 기기 공개키 지문 16자리 hex. 공개키 원문은 내려오지 않는다.
   * 🔴 `null` 가능 — 확장 이전에 만들어진 세션이면 공개키가 없다.
   */
  deviceFingerprint: string | null
  createdAt: string
  /** 아직 한 번도 회전하지 않았으면 `null` 일 수 있다 */
  lastUsedAt: string | null
  expiresAt: string
}

/** `POST /auth/extension/disconnect` — 멱등이라 이미 끊긴 세션이면 `0` 이다. */
export interface ExtensionDisconnectResult {
  disconnected: number
}
