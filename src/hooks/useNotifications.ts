import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { postToNative } from '@/utils/nativeBridge'
import {
  getAlarmConfig,
  getAlarmStatus,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateAlarmConfig,
} from '@/api/notifications'
import type {
  AlarmConfigUpdate,
  NotificationType,
} from '@/types/notification'

/**
 * 인앱 알림 센터 — 무한 스크롤 목록 (U23 서버사이드 type 필터).
 * type 이 쿼리 키에 포함 → 필터 변경 시 서버 재조회. "더 보기"도 필터 상태 유지.
 *
 * 목록 응답의 unreadCount 를 종 배지 캐시에 즉시 동기화 — 새 알림 직후 알림센터를
 * 열면 목록엔 미읽음이 보이는데 종은 낡은 숫자(staleTime 60s)를 보여주던 불일치 제거.
 * (unreadCount 는 type 필터와 무관한 전체값이라 어떤 필터에서도 동기화 안전)
 */
export function useNotifications(type?: NotificationType) {
  const qc = useQueryClient()
  return useInfiniteQuery({
    queryKey: ['notifications', 'list', type ?? 'all'],
    queryFn: async ({ pageParam }) => {
      const result = await getNotifications(pageParam, type)
      qc.setQueryData(['notifications', 'unread-count'], result.unreadCount)
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

/** 헤더 종 배지용 — 안 읽음 개수 (첫 페이지만 · 가볍게) */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getNotifications().then((r) => r.unreadCount),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // 5분마다 갱신
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      // native 종 배지 즉시 갱신 (WebView 밖이면 no-op)
      postToNative({ type: 'notifications-read' })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      postToNative({ type: 'notifications-read' })
    },
  })
}

export function useAlarmConfig() {
  return useQuery({
    queryKey: ['alarm-config'],
    queryFn: getAlarmConfig,
    staleTime: 5 * 60_000,
  })
}

/**
 * 「알림이 실제로 갈 상태인가」 — 공고 결과 시트의 일정 블록이 안내 문구를 고를 때 쓴다.
 *
 * `enabled: false` 를 기본값으로 두지 않는다 — 로딩 중에 「알림이 꺼져 있어요」가 잠깐
 * 떴다 사라지면 켜져 있는 사람에게 거짓말을 한 셈이다. 소비처는 `data` 가 올 때까지 숨긴다.
 */
export function useAlarmStatus(enabled = true) {
  return useQuery({
    queryKey: ['alarm-status'],
    queryFn: getAlarmStatus,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateAlarmConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial: AlarmConfigUpdate) => updateAlarmConfig(partial),
    onSuccess: (config) => {
      qc.setQueryData(['alarm-config'], config)
    },
  })
}
