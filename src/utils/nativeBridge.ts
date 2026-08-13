/**
 * chwippo-mobile WebView 로 message 전송.
 *
 * WebView 안이 아니면 no-op. useNativeMode 조건 무관하게 안전.
 *
 * ## 메시지 종류
 *   - theme: 웹 theme 변경 → native tab bar / safe area 색 sync
 *   - logout: 사용자 로그아웃 완료 → native 즉시 clearAll · login redirect
 *   - account-deleted: 회원 탈퇴 완료 → 동일
 *   - request-notification-permission: soft-ask 허용 → native OS 권한 요청 트리거
 *   - open-notification-settings: OS 권한 거부 상태에서 "알림 받기" → 설정 앱 이동
 *   - notifications-read: 알림 읽음 처리 완료 → native 종 배지 즉시 갱신
 *   - deadline-saved: 마감일 저장 성공 (가치 순간) → native soft-ask 트리거 후보
 *   - get-app-lock: 설정 "앱 잠금" 섹션 진입 → native 가 지원 여부·현재 on/off 회신
 *   - set-app-lock: 설정 토글 → native 앱 잠금 on/off 저장
 *   - refresh-lock-request: refresh 회전 직전 락 요청 → native 가 grant 회신 (선착순 1명)
 *   - refresh-lock-release: 회전 **실패** 시 명시 해제 (성공은 아래 token 이 겸용)
 *   - refresh-trace: 회전 구간 진단 breadcrumb → native 가 logcat 으로 출력 (임시 계측)
 *
 * ## native → web 회신 (get/set-app-lock 응답)
 *   - native 가 `window.dispatchEvent(new CustomEvent('chwippo:app-lock-state',
 *     { detail: { supported, enabled } }))` 주입 → 웹이 event 로 수신 (AppLockSection).
 *
 * ## native → web 회신 (refresh 락)
 *   - `chwippo:refresh-lock-grant` { reqId } — 요청한 웹뷰에만 (회전 진행 허가)
 *   - `chwippo:refresh-lock-queued` { reqId } — 요청한 웹뷰에만 (남이 락 보유 · 대기 지시).
 *     락 관리자가 살아 있다는 증거라, 웹은 이걸 받으면 700ms 무응답 폴백을 걷는다.
 *   - `chwippo:token-broadcast` { accessToken } — **전 웹뷰**에 (남이 회전 성공 → 대기자 해소)
 *   수신부는 api/client.ts `acquireNativeRefreshLock`.
 */

export type NativeMessage =
  | { type: 'theme'; theme: 'dark' | 'light' }
  | { type: 'logout' }
  | { type: 'account-deleted' }
  | { type: 'request-notification-permission' }
  | { type: 'open-notification-settings' }
  | { type: 'notifications-read' }
  | { type: 'deadline-saved' }
  | { type: 'get-app-lock' }
  | { type: 'set-app-lock'; enabled: boolean }
  /**
   * refresh 회전 성공 시 새 access token 전달 (refresh 단일 주체화 — 웹뷰가 유일 회전자).
   * 네이티브는 SecureStore 'jwt' 갱신에만 사용. ⚠️ RT 가 아니라 단명 access 이고,
   * 채널이 웹뷰→앱 내부 postMessage 라 과거 제거된 sessionStorage 평문 표면과 다르다.
   */
  | { type: 'token'; accessToken: string }
  /**
   * 회전 직전 락 요청 / 회전 실패 시 명시 해제 (plan refresh-rotation-lock).
   * 탭마다 웹뷰가 1개라 각자 회전을 시도해 같은 RT 를 동시에 소비했다 — 순서만
   * 네이티브가 중재한다. 구앱은 모르는 메시지를 무시하고, 웹은 700ms 뒤 단독 회전으로
   * 폴백하므로 핸드셰이크 불요.
   */
  | { type: 'refresh-lock-request'; reqId: string }
  | { type: 'refresh-lock-release'; reqId: string }
  /**
   * 🔬 **진단 전용** breadcrumb (R2 회전 락 원인 규명 · 2026-08-14) — 락 동작에 관여하지
   * 않으며, **원인 확정 후 제거 가능**하다.
   *
   * 왜 필요한가: 프로덕션 웹의 console 은 logcat 에 안 나와서, 승자 웹뷰가 grant 를 받고도
   * token(성공)·release(실패) 어느 쪽도 안 보낸 채 30s 침묵한 실기(01:31)를 웹 안에서
   * 들여다볼 수단이 없었다. 이 메시지가 그 구간을 네이티브 로그로 끌어낸다.
   *
   * ⚠️ 토큰·PII 는 절대 싣지 않는다 — `info` 는 `status=409` · `code=ECONNABORTED` 같은
   * 짧은 식별자만. 발신부는 api/client.ts `trace`.
   */
  | { type: 'refresh-trace'; event: string; ms?: number; info?: string }

interface RNWindow {
  ReactNativeWebView?: {
    postMessage: (data: string) => void
  }
}

/**
 * 앱 웹뷰 안 여부 — 앱에선 화면 전환(로그인/랜딩 이동)을 네이티브가 소유하므로
 * 웹 측 랜딩 이동을 생략할 때 사용.
 *
 * 판정 기준은 `postToNative` 와 동일하다 (`window.ReactNativeWebView` 존재).
 *
 * 🔴 왜 필요한가 (2026-08-12 실기): 네이티브는 `logout` 브리지를 받고 **푸시 기기 해제를
 * 먼저** 시도한 뒤(오프라인 대비 1.5s 상한) 화면을 바꾼다. 그동안 웹뷰는 계속 보이는데,
 * 웹이 랜딩으로 이동해두면 그 랜딩이 그대로 노출됐다가 로그인 화면으로 넘어간다.
 */
export function isInNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as RNWindow).ReactNativeWebView)
}

export function postToNative(msg: NativeMessage): void {
  if (typeof window === 'undefined') return
  const rn = (window as unknown as RNWindow).ReactNativeWebView
  if (!rn) return
  try {
    rn.postMessage(JSON.stringify(msg))
  } catch {
    // 실패 무시 · WebView 없는 환경은 애초에 rn 이 undefined
  }
}
