import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import type { Application, CreateApplicationDto, UpdateApplicationDto, UpdateStepsDto } from '@/types/application'

const QUERY_KEY = ['applications']

export function useApplications() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: applicationsApi.list })
}

export function useApplication(id: string) {
  return useQuery({ queryKey: [...QUERY_KEY, id], queryFn: () => applicationsApi.get(id) })
}

function invalidateCalendarAndDday(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendar'], refetchType: 'all' })
  qc.invalidateQueries({ queryKey: ['dashboard', 'dday'], refetchType: 'all' })
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateApplicationDto) => applicationsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateCalendarAndDday(qc)
    },
  })
}

export function useUpdateApplication(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateApplicationDto) => applicationsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateCalendarAndDday(qc)
    },
  })
}

export function useUpdateCurrentStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stepIndex }: { id: string; stepIndex: number }) =>
      applicationsApi.updateCurrentStep(id, stepIndex),
    onMutate: async ({ id, stepIndex }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData(QUERY_KEY)
      qc.setQueryData<Application[]>(QUERY_KEY, (old) =>
        old?.map((a) => (a.id === id ? { ...a, currentStepIndex: stepIndex } : a)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(QUERY_KEY, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateSteps(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateStepsDto) => applicationsApi.updateSteps(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateCalendarAndDday(qc)
    },
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateCalendarAndDday(qc)
    },
  })
}
