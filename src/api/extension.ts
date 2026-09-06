import type {
  ExtensionDisconnectResult,
  ExtensionPairCode,
  ExtensionSession,
} from '@/types/extension'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 확장 페어링·연결 관리 (`plans/autofill-extension.md` §2-4).
 *
 * 세 라우트 모두 **웹 로그인 세션**으로만 부른다. 확장 토큰(`aud:'ext'`)은 `pair`·`sessions`
 * 에서 403 이다 — 확장이 스스로 코드를 뽑을 수 있으면 토큰을 무한 갱신하는 우회로가 된다.
 */
export const extensionApi = {
  listSessions: () =>
    apiClient
      .get<{ data: ExtensionSession[] }>('/auth/extension/sessions')
      .then(unwrap),

  createPairCode: () =>
    apiClient
      .post<{ data: ExtensionPairCode }>('/auth/extension/pair')
      .then(unwrap),

  /**
   * 🔴 `sessionId` 는 **선택이 아니라 필수로 다룬다.** 백엔드는 웹이 `sessionId` 를 빼고
   * 부르면 그 계정의 확장을 **전부** 끊는다 — 「이 기기만 해제」 화면에서 그 기본값이
   * 새어 나가면 남의 기기까지 함께 끊긴다. 여기서 인자를 필수로 받아 그 자리를 막는다.
   */
  disconnect: (sessionId: string) =>
    apiClient
      .post<{ data: ExtensionDisconnectResult }>('/auth/extension/disconnect', {
        sessionId,
      })
      .then(unwrap),
}
