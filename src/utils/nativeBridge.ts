/**
 * chwippo-mobile WebView 로 message 전송.
 *
 * WebView 안이 아니면 no-op. useNativeMode 조건 무관하게 안전.
 *
 * ## 메시지 종류
 *   - theme: 웹 theme 변경 → native tab bar / safe area 색 sync
 *   - logout: 사용자 로그아웃 완료 → native 즉시 clearAll · login redirect
 *   - account-deleted: 회원 탈퇴 완료 → 동일
 */

export type NativeMessage =
  | { type: 'theme'; theme: 'dark' | 'light' }
  | { type: 'logout' }
  | { type: 'account-deleted' }

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
