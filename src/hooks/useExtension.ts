import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extensionApi } from '@/api/extension'

/** 「연결된 확장」 목록 캐시 키 — 발급·해제 뒤 이 키만 무효화한다 */
export const EXTENSION_SESSIONS_KEY = ['extension', 'sessions'] as const

/**
 * 연결된 확장 목록.
 *
 * `staleTime` 을 두지 않는다 — 다른 기기에서 방금 연결했는지가 이 화면의 전부라
 * 캐시된 「0개」를 보여주면 화면이 거짓말을 한다.
 */
export function useExtensionSessions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EXTENSION_SESSIONS_KEY,
    queryFn: extensionApi.listSessions,
    enabled: options?.enabled ?? true,
  })
}

/**
 * 연결 코드 발급.
 *
 * 목록을 무효화하지 않는다 — 코드를 뽑는 것만으로는 세션이 안 생긴다(확장이 교환해야
 * 생긴다). 무효화하면 매번 「0개」를 다시 확인하는 헛 요청만 늘어난다. 새 연결이 붙었는지는
 * 호출부가 **코드 만료 시점에 한 번** 다시 읽는다.
 */
export function useCreatePairCode() {
  return useMutation({ mutationFn: extensionApi.createPairCode })
}

/** 연결 해제 — 성공하면 목록을 다시 읽는다 (해제된 행이 남아 있으면 또 누르게 된다). */
export function useDisconnectExtension() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => extensionApi.disconnect(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXTENSION_SESSIONS_KEY }),
  })
}
