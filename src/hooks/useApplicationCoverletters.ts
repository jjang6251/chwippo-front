import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationCoverlettersApi } from '@/api/applicationCoverletters'
import type { CreateCoverletterDto, UpdateCoverletterDto } from '@/types/coverletter'

const listKey = (applicationId: string) => ['coverletters', applicationId]

export function useCoverletters(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: listKey(applicationId),
    queryFn: () => applicationCoverlettersApi.list(applicationId),
    enabled,
  })
}

export function useCreateCoverletter(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateCoverletterDto) =>
      applicationCoverlettersApi.create(applicationId, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(applicationId) }),
  })
}

export function useUpdateCoverletter(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clId, dto }: { clId: string; dto: UpdateCoverletterDto }) =>
      applicationCoverlettersApi.update(applicationId, clId, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(applicationId) }),
  })
}

export function useRemoveCoverletter(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clId: string) => applicationCoverlettersApi.remove(applicationId, clId),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(applicationId) }),
  })
}
