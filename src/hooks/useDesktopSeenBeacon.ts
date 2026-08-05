import { useEffect } from 'react'
import { markDesktopWebSeen } from '@/api/users'
import { useCoverletterReadOnly } from '@/hooks/useCoverletterReadOnly'

const STORAGE_KEY = 'chwippo:desktop-seen'

/**
 * "이 사용자가 데스크탑 웹을 썼다" 를 서버에 한 번 알린다 — 관측 전용.
 *
 * 🔴 **왜 게이트 훅을 그대로 쓰나** — 재려는 것이 *"자소서를 쓸 수 있는 환경이었는가"* 이고,
 * 그 판정은 이미 `useCoverletterReadOnly` 가 갖고 있다. 같은 조건을 다시 구현하면
 * (뷰포트 헤더·UA 파싱 등) **게이트와 신호가 어긋나는 순간 분모가 거짓말을 시작한다.**
 * 여기서는 게이트의 부정(`readOnly === false`)이 곧 신호라 어긋날 수가 없다.
 *
 * 관측 화면에서 이 값은 **자소서 도달 지표의 분모**다 — 없으면 *"모바일이라 못 쓴 것"* 과
 * *"데스크탑에서 안 쓴 것"* 이 한 숫자에 섞인다.
 *
 * ## 발사 조건
 *
 * - `enabled` (데모·비로그인 제외) **그리고** `readOnly === false`
 * - `localStorage` 에 표식이 없을 때만 — **브라우저당 1회**.
 *   `sessionStorage` 면 탭 세션마다 재발사해 서버에 0행 UPDATE 가 반복된다
 * - 훅이 resize 에 반응하므로 **창을 넓힌 사용자도** 그 시점에 잡힌다
 *
 * ⚠️ 실패하면 표식을 남기지 않는다 — 다음 진입에서 다시 시도한다. 성공해야만 기록.
 */
export function useDesktopSeenBeacon(enabled: boolean): void {
  const readOnly = useCoverletterReadOnly()

  useEffect(() => {
    if (!enabled || readOnly) return
    if (readStorage() === '1') return

    let cancelled = false
    markDesktopWebSeen()
      .then(() => {
        if (!cancelled) writeStorage()
      })
      // 관측 실패가 화면을 흔들면 안 된다 — 조용히 넘어가고 다음에 다시 시도한다
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [enabled, readOnly])
}

/** Safari 프라이빗 모드 등에서 storage 접근 자체가 던진다 — 그 경우 매번 발사하되 죽지는 않는다 */
function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* 무시 — 표식만 못 남길 뿐 서버는 멱등이다 */
  }
}
