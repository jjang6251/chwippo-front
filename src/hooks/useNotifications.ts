import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getAlarmConfig,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateAlarmConfig,
} from '@/api/notifications'
import type { AlarmConfig } from '@/types/notification'

/** 인앱 알림 센터 — 무한 스크롤 목록 */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => getNotifications(pageParam),
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
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
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

export function useUpdateAlarmConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AlarmConfig>) => updateAlarmConfig(partial),
    onSuccess: (config) => {
      qc.setQueryData(['alarm-config'], config)
    },
  })
}
