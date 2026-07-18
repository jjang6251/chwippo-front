import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardConfig, patchDashboardConfig, type DashboardConfig } from '@/api/users'

// 회고=성장 페이지가 실제 렌더하는 섹션 (Dashboard.tsx 순서 · 백엔드 DEFAULT_SECTIONS 와 동일).
// placeholderData 로만 쓰이고 Dashboard.isVisible 은 미지 id 를 true 로 폴백하므로 렌더 결과는 무변.
// 구 기본값(dday·todos)은 캘린더 UX 재구성으로 제거된 deprecated id 라 정합화.
const DEFAULT_CONFIG: DashboardConfig = {
  sections: [
    { id: 'stats', visible: true },
    { id: 'milestones', visible: true },
    { id: 'monthly_comparison', visible: true },
    { id: 'insights', visible: true },
    { id: 'activity_streak', visible: true },
    { id: 'status_doughnut', visible: true },
    { id: 'personal_funnel', visible: true },
    { id: 'interview_review', visible: true },
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
