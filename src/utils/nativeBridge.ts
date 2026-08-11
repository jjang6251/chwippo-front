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
