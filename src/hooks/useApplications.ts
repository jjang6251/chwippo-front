import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import type { Application, CreateApplicationDto, UpdateApplicationDto, UpdateStepsDto } from '@/types/application'

const QUERY_KEY = ['applications']

export function useApplications() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: applicationsApi.list })
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => applicationsApi.get(id),
    /**
     * PR_B1c — coverletter generation in_progress 일 때 3초마다 polling.
     * completed/failed 로 변경 감지 시 양쪽 화면 동기화.
     */
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && data.coverletterGenerationStatus === 'in_progress') {
        return 3000
      }
      return false
    },
    refetchOnWindowFocus: true,
  })
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
      qc.invalidateQueries({ queryKey: QUERY_KEY, refetchType: 'all' })
      invalidateCalendarAndDday(qc)
    },
  })
}

export function useUpdateApplication(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateApplicationDto) => applicationsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY, refetchType: 'all' })
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
      qc.invalidateQueries({ queryKey: QUERY_KEY, refetchType: 'all' })
      invalidateCalendarAndDday(qc)
    },
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY, refetchType: 'all' })
      invalidateCalendarAndDday(qc)
    },
  })
}

/**
 * PR_B1c — 자소서 생성 (회사조사 trigger + 50 코인 차감).
 *
 * **흐름**:
 * 1. mutation 호출 → backend atomic status='in_progress'
 * 2. useApplication(id) 의 refetchInterval 3초 polling 시작 (in_progress)
 * 3. completed/failed 시 polling 중지 + 양쪽 UI 동기화
 * 4. onSuccess — 코인 chip 갱신 + applications list invalidate (status 표시)
 */
export function useGenerateCoverletter(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => applicationsApi.generateCoverletter(applicationId),
    onSuccess: () => {
      // application 갱신 → polling 다음 tick 자동
      qc.invalidateQueries({
        queryKey: [...QUERY_KEY, applicationId],
      })
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      // 코인 chip 갱신
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })
}
