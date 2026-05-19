import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  updateStep,
  type UpdateStepBody,
} from '@/api/stepDetail'
import { toast } from '@/stores/toastStore'

export function useChecklist(appId: string, stepId: string | null) {
  return useQuery({
    queryKey: ['checklist', appId, stepId],
    queryFn: () => getChecklist(appId, stepId!),
    enabled: !!stepId,
    staleTime: 30_000,
  })
}

export function useUpdateStep(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, ...body }: { stepId: string } & UpdateStepBody) =>
      updateStep(appId, stepId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications', appId] })
      qc.invalidateQueries({ queryKey: ['calendar'], refetchType: 'all' })
      qc.invalidateQueries({ queryKey: ['dashboard', 'dday'], refetchType: 'all' })
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  })
}

export function useCreateChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => createChecklistItem(appId, stepId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('저장에 실패했습니다.'),
  })
}

export function useUpdateChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: string; content?: string; isDone?: boolean }) =>
      updateChecklistItem(appId, stepId, itemId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('업데이트에 실패했습니다.'),
  })
}

export function useDeleteChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem(appId, stepId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('삭제에 실패했습니다.'),
  })
}
