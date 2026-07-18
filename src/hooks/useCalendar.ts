import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getCalendarEvents, getDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote, carryOverDailyNote, getUrgentChecklist } from '@/api/calendar'
import { updateChecklistItem } from '@/api/stepDetail'
import { toast } from '@/stores/toastStore'

export function useCalendarEvents(year: number, month: number) {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => getCalendarEvents(year, month),
    staleTime: 60_000,
  })
}

export function useDailyNotes(date: string | null) {
  return useQuery({
    queryKey: ['dailyNotes', date],
    queryFn: () => getDailyNotes({ date: date! }),
    enabled: !!date,
    staleTime: 30_000,
  })
}

export function useTodayDailyNotes() {
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  return useQuery({
    queryKey: ['dailyNotes', 'range', yesterday, today],
    queryFn: () => getDailyNotes({ startDate: yesterday, endDate: today }),
    staleTime: 30_000,
  })
}

function invalidateCalendarAndDday(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendar'], refetchType: 'all' })
  qc.invalidateQueries({ queryKey: ['dashboard', 'dday'], refetchType: 'all' })
  // daily_notes 는 streak 소스 — 기록 즉시 잔디 반영 (백엔드 5분 캐시는 수용)
  qc.invalidateQueries({ queryKey: ['dashboard', 'streak'], refetchType: 'all' })
}

export function useCreateDailyNote(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDailyNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dailyNotes', date] })
      qc.invalidateQueries({ queryKey: ['dailyNotes', 'range'] })
      invalidateCalendarAndDday(qc)
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  })
}

export function useUpdateDailyNote(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; content?: string; isDone?: boolean }) =>
      updateDailyNote(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dailyNotes', date] })
      qc.invalidateQueries({ queryKey: ['dailyNotes', 'range'] })
      invalidateCalendarAndDday(qc)
    },
    onError: () => toast.error('업데이트에 실패했습니다.'),
  })
}

export function useDeleteDailyNote(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteDailyNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dailyNotes', date] })
      qc.invalidateQueries({ queryKey: ['dailyNotes', 'range'] })
      invalidateCalendarAndDday(qc)
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })
}

/** A3 — 오늘 할 일 자동 합류: D-3 이내 스텝의 미완 체크리스트 (오늘 패널에서만 사용) */
export function useUrgentChecklist(enabled: boolean) {
  return useQuery({
    queryKey: ['calendar', 'urgent-checklist'],
    queryFn: getUrgentChecklist,
    enabled,
    staleTime: 30_000,
  })
}

/** A3 — 임박 체크리스트 항목 체크 (read-through — 원본 checklist item 토글) */
export function useCompleteUrgentChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      applicationId,
      stepId,
      itemId,
    }: {
      applicationId: string
      stepId: string
      itemId: string
    }) => updateChecklistItem(applicationId, stepId, itemId, { isDone: true }),
    onSuccess: (_, { applicationId, stepId }) => {
      qc.invalidateQueries({ queryKey: ['calendar', 'urgent-checklist'] })
      // 카드 상세 스텝 체크리스트와 단일 소스 — 그쪽 캐시도 갱신
      qc.invalidateQueries({ queryKey: ['checklist', applicationId, stepId] })
    },
    onError: () => toast.error('체크에 실패했습니다.'),
  })
}

export function useCarryOverDailyNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: carryOverDailyNote,
    onSuccess: () => {
      // 어제(이월 원본)·오늘·range 캐시 모두 무효화 — U12 이월 후 어제 서브섹션 즉시 갱신
      qc.invalidateQueries({ queryKey: ['dailyNotes'] })
      invalidateCalendarAndDday(qc)
    },
    onError: () => toast.error('이동에 실패했습니다.'),
  })
}
