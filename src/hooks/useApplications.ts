import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import type { CreateApplicationDto, UpdateApplicationDto, UpdateStepsDto } from '@/types/application'

const QUERY_KEY = ['applications']

export function useApplications() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: applicationsApi.list })
}

export function useApplication(id: string) {
  return useQuery({ queryKey: [...QUERY_KEY, id], queryFn: () => applicationsApi.get(id) })
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateApplicationDto) => applicationsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateApplication(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateApplicationDto) => applicationsApi.update(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
      qc.setQueryData(QUERY_KEY, (old: any) =>
        old?.map((a: any) => (a.id === id ? { ...a, currentStepIndex: stepIndex } : a)),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
