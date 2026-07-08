/**
 * 자소서 AI 채팅 스트림 진행 표시 marker (sessionStorage).
 *
 * 스트림 시작 직전 set → onDone/onError(=stream 종료) 에서 clear.
 * 새로고침·탭 닫기로 스트림이 끊겨도 서버는 완주·저장하므로, 재진입 시 이 marker 로
 * "직전 요청 답변 생성 중" 안내 배너를 띄운다.
 *
 * - sessionStorage: 같은 탭 새로고침엔 유지, 다른 탭엔 격리.
 * - 3분 초과 marker 는 stale 로 간주 (자동 clear 후 null).
 */

const STALE_MS = 3 * 60 * 1000

const key = (applicationId: string) => `chat-pending:${applicationId}`

export function setChatPending(applicationId: string): void {
  sessionStorage.setItem(key(applicationId), JSON.stringify({ at: Date.now() }))
}

export function clearChatPending(applicationId: string): void {
  sessionStorage.removeItem(key(applicationId))
}

export function getChatPending(applicationId: string): { at: number } | null {
  const raw = sessionStorage.getItem(key(applicationId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { at?: unknown }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > STALE_MS) {
      clearChatPending(applicationId)
      return null
    }
    return { at: parsed.at }
  } catch {
    clearChatPending(applicationId)
    return null
  }
}
