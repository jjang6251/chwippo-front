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
 *
 * ## native → web 회신 (get/set-app-lock 응답)
 *   - native 가 `window.dispatchEvent(new CustomEvent('chwippo:app-lock-state',
 *     { detail: { supported, enabled } }))` 주입 → 웹이 event 로 수신 (AppLockSection).
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
