import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activityApi } from '@/api/activity'
import type {
  CreateActivityDto,
  CreateActivityLogDto,
  CreateActivityReflectionDto,
  UpdateActivityDto,
  UpdateActivityLogDto,
  UpdateActivityReflectionDto,
} from '@/types/activity'

const QK = {
  all: ['activities'] as const,
  list: (includeArchived: boolean) =>
    ['activities', { includeArchived }] as const,
  detail: (id: string) => ['activities', id] as const,
  logs: (activityId: string) => ['activities', activityId, 'logs'] as const,
  reflections: (activityId: string) =>
    ['activities', activityId, 'reflections'] as const,
}

export function useActivities(includeArchived = false) {
  return useQuery({
    queryKey: QK.list(includeArchived),
    queryFn: () => activityApi.list(includeArchived),
  })
}

export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: id ? QK.detail(id) : ['activities', 'none'],
    queryFn: () => activityApi.get(id as string),
    enabled: !!id,
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateActivityDto) => activityApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.all, refetchType: 'all' })
    },
  })
}

export function useUpdateActivity(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateActivityDto) => activityApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.all, refetchType: 'all' })
      qc.invalidateQueries({ queryKey: QK.detail(id), refetchType: 'all' })
    },
  })
}

export function useArchiveActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, unarchive = false }: { id: string; unarchive?: boolean }) =>
      unarchive ? activityApi.unarchive(id) : activityApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.all, refetchType: 'all' })
    },
  })
}

// ───────── Logs ─────────
export function useActivityLogs(activityId: string | undefined) {
  return useQuery({
    queryKey: activityId ? QK.logs(activityId) : ['activity-logs', 'none'],
    queryFn: () => activityApi.listLogs(activityId as string),
    enabled: !!activityId,
  })
}

// log 변경 후 카드 리스트 (`useActivities`) 가 즉시 반영되도록 QK.all prefix 무효화.
// QK.all=['activities'] 는 list/detail/logs/reflections 키 전부의 공통 prefix.
function invalidateAllActivities(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QK.all, refetchType: 'all' })
}

export function useCreateLog(activityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateActivityLogDto) =>
      activityApi.createLog(activityId, dto),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

// activityId 매개변수는 호환을 위해 유지하지만 invalidateAllActivities 가 모든 키를 무효화하므로 직접 사용은 없음.
export function useUpdateLog(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, dto }: { logId: string; dto: UpdateActivityLogDto }) =>
      activityApi.updateLog(logId, dto),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

export function useRemoveLog(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (logId: string) => activityApi.removeLog(logId),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

/** log 단일 archive (source_refs 보존, "기록 보관" 액션) */
export function useArchiveLog(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      logId,
      unarchive = false,
    }: {
      logId: string
      unarchive?: boolean
    }) =>
      unarchive ? activityApi.unarchiveLog(logId) : activityApi.archiveLog(logId),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

/** 활동 hard delete — 409 Conflict 면 컴포넌트가 archive 모달 swap */
export function useRemoveActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activityApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.all, refetchType: 'all' })
    },
  })
}

// AI 요약 — 결과를 직접 사용하는 쪽에서 호출
export function useSummarizeLog(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, force = false }: { logId: string; force?: boolean }) =>
      activityApi.summarizeLog(logId, force),
    onSuccess: (_, vars) => {
      invalidateAllActivities(qc)
      // 5.6.x — quota 차감 즉시 반영 (AiQuotaChip)
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      // 5.6.8 — 노트별 잔여 갱신 (요약 본문 아래 N/M)
      qc.invalidateQueries({ queryKey: ['note-summary-status', vars.logId] })
    },
  })
}

/** 5.6.8 — 노트별 요약 잔여 (mount 시 항상 표시용) */
export function useNoteSummaryStatus(logId: string | undefined) {
  return useQuery({
    queryKey: ['note-summary-status', logId],
    queryFn: () => activityApi.summarizeStatus(logId as string),
    enabled: !!logId,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

// ───────── Reflections ─────────
export function useReflections(activityId: string | undefined) {
  return useQuery({
    queryKey: activityId
      ? QK.reflections(activityId)
      : ['activity-reflections', 'none'],
    queryFn: () => activityApi.listReflections(activityId as string),
    enabled: !!activityId,
  })
}

export function useCreateReflection(activityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateActivityReflectionDto) =>
      activityApi.createReflection(activityId, dto),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

export function useUpdateReflection(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      refId,
      dto,
    }: {
      refId: string
      dto: UpdateActivityReflectionDto
    }) => activityApi.updateReflection(refId, dto),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

export function useRemoveReflection(_activityId: string) {
  void _activityId
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (refId: string) => activityApi.removeReflection(refId),
    onSuccess: () => invalidateAllActivities(qc),
  })
}

