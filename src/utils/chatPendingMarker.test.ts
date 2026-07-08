/**
 * 자소서 채팅 스트림 진행 marker (sessionStorage) 테스트.
 *
 * 시나리오:
 * 1. set → get → clear round-trip
 * 2. 3분 초과 stale marker → 자동 clear 후 null
 * 3. 다른 applicationId 격리
 * 4. 손상된 JSON → null + 자동 정리
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearChatPending,
  getChatPending,
  setChatPending,
} from './chatPendingMarker'

describe('chatPendingMarker', () => {
  beforeEach(() => sessionStorage.clear())

  it('set → get → clear round-trip', () => {
    setChatPending('app-1')
    const m = getChatPending('app-1')
    expect(m).not.toBeNull()
    expect(typeof m!.at).toBe('number')
    clearChatPending('app-1')
    expect(getChatPending('app-1')).toBeNull()
  })

  it('3분 초과 stale → 자동 clear 후 null', () => {
    sessionStorage.setItem(
      'chat-pending:app-1',
      JSON.stringify({ at: Date.now() - 4 * 60 * 1000 }),
    )
    expect(getChatPending('app-1')).toBeNull()
    // 자동 정리 확인
    expect(sessionStorage.getItem('chat-pending:app-1')).toBeNull()
  })

  it('다른 applicationId 격리', () => {
    setChatPending('app-1')
    expect(getChatPending('app-2')).toBeNull()
    expect(getChatPending('app-1')).not.toBeNull()
  })

  it('손상된 JSON → null + 자동 정리', () => {
    sessionStorage.setItem('chat-pending:app-1', 'not-json')
    expect(getChatPending('app-1')).toBeNull()
    expect(sessionStorage.getItem('chat-pending:app-1')).toBeNull()
  })
})
