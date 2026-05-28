import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  alertThresholdsApi,
  type UpdateAlertThresholdsDto,
} from '@/api/alertThresholds'

const QUERY_KEY = ['admin', 'alert-thresholds'] as const

export function useAlertThresholds() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: alertThresholdsApi.get,
    staleTime: 0,
  })
}

export function useUpdateAlertThresholds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateAlertThresholdsDto) =>
      alertThresholdsApi.update(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useSendTestAlert() {
  return useMutation({
    mutationFn: alertThresholdsApi.test,
  })
}
