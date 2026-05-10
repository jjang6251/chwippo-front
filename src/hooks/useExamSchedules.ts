import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/exam-schedules'
import { toast } from '@/stores/toastStore'

export function useExamSchedules() {
  return useQuery({
    queryKey: ['exam-schedules'],
    queryFn: api.listExamSchedules,
    staleTime: 30_000,
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['exam-schedules'] })
  qc.invalidateQueries({ queryKey: ['calendar'] })
  qc.invalidateQueries({ queryKey: ['dashboard', 'dday'] })
  qc.invalidateQueries({ queryKey: ['myinfo'] })
}

export function useCreateExamSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createExamSchedule,
    onSuccess: () => invalidateAll(qc),
    onError: () => toast.error('시험 일정 추가에 실패했습니다.'),
  })
}

export function useUpdateExamSchedule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Parameters<typeof api.updateExamSchedule>[1]) => api.updateExamSchedule(id, dto),
    onSuccess: () => invalidateAll(qc),
    onError: () => toast.error('시험 일정 수정에 실패했습니다.'),
  })
}

export function useDeleteExamSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteExamSchedule,
    onSuccess: () => invalidateAll(qc),
    onError: () => toast.error('시험 일정 삭제에 실패했습니다.'),
  })
}

export function useConvertExamToCert(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Parameters<typeof api.convertExamToCert>[1]) => api.convertExamToCert(id, dto),
    onSuccess: () => invalidateAll(qc),
    onError: () => toast.error('자격증 이관에 실패했습니다.'),
  })
}
