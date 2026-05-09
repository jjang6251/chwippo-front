import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getCalendarEvents, getDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote, carryOverDailyNote } from '@/api/calendar'
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

export function useCreateDailyNote(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDailyNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dailyNotes', date] })
      qc.invalidateQueries({ queryKey: ['dailyNotes', 'range'] })
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
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })
}

export function useCarryOverDailyNote() {
  const qc = useQueryClient()
  const today = dayjs().format('YYYY-MM-DD')
  return useMutation({
    mutationFn: carryOverDailyNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dailyNotes', 'range'] })
      qc.invalidateQueries({ queryKey: ['dailyNotes', today] })
    },
    onError: () => toast.error('이동에 실패했습니다.'),
  })
}
