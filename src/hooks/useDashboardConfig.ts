import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardConfig, patchDashboardConfig, type DashboardConfig } from '@/api/users'

const DEFAULT_CONFIG: DashboardConfig = {
  sections: [
    { id: 'stats', visible: true },
    { id: 'dday', visible: true },
    { id: 'todos', visible: true },
  ],
}

export function useDashboardConfig() {
  return useQuery({
    queryKey: ['dashboard', 'config'],
    queryFn: getDashboardConfig,
    placeholderData: DEFAULT_CONFIG,
  })
}

export function useUpdateDashboardConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: patchDashboardConfig,
    onMutate: async (newConfig) => {
      await qc.cancelQueries({ queryKey: ['dashboard', 'config'] })
      const prev = qc.getQueryData<DashboardConfig>(['dashboard', 'config'])
      qc.setQueryData(['dashboard', 'config'], newConfig)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['dashboard', 'config'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'config'] })
    },
  })
}
