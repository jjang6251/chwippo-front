import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  updateStep,
  getNoteSheets,
  createNoteSheet,
  updateNoteSheet,
  deleteNoteSheet,
  type UpdateStepBody,
  type CreateNoteSheetBody,
  type UpdateNoteSheetBody,
  type StepNoteSheet,
} from '@/api/stepDetail'
import { toast } from '@/stores/toastStore'

export function useChecklist(appId: string, stepId: string | null) {
  return useQuery({
    queryKey: ['checklist', appId, stepId],
    queryFn: () => getChecklist(appId, stepId!),
    enabled: !!stepId,
    staleTime: 30_000,
  })
}

export function useUpdateStep(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, ...body }: { stepId: string } & UpdateStepBody) =>
      updateStep(appId, stepId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'], refetchType: 'all' })
      qc.invalidateQueries({ queryKey: ['calendar'], refetchType: 'all' })
      qc.invalidateQueries({ queryKey: ['dashboard', 'dday'], refetchType: 'all' })
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  })
}

export function useCreateChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => createChecklistItem(appId, stepId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('저장에 실패했습니다.'),
  })
}

export function useUpdateChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: string; content?: string; isDone?: boolean }) =>
      updateChecklistItem(appId, stepId, itemId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('업데이트에 실패했습니다.'),
  })
}

export function useDeleteChecklistItem(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem(appId, stepId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', appId, stepId] }),
    onError: () => toast.error('삭제에 실패했습니다.'),
  })
}

// ── 준비 노트 시트 ───────────────────────────────────────────

/** 캐시 키 팩토리 — 무효화·패치가 문자열 배열을 손으로 짜지 않게 (오타 = 조용한 미반영) */
export const noteSheetsKey = (appId: string, stepId: string) =>
  ['note-sheets', appId, stepId] as const

/**
 * 🔴 **서버 문구가 우선이다.** 캡(10장)·이름 길이는 서버가 숫자를 실어 400 으로 돌려준다.
 * 프론트가 자기 문구로 덮으면 "무엇을 줄여야 하는지" 가 사라진다 (한도는 서버가 정한다).
 */
export function serverMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0]
  return fallback
}

export function useNoteSheets(appId: string, stepId: string | null) {
  return useQuery({
    queryKey: noteSheetsKey(appId, stepId ?? ''),
    queryFn: () => getNoteSheets(appId, stepId!),
    enabled: !!stepId,
    staleTime: 30_000,
  })
}

/**
 * 시트 추가 · 기존 노트 승격(`ifEmpty`) 공용.
 *
 * 🔴 캐시 반영이 **append 가 아니라 upsert** 여야 한다. `ifEmpty` 승격은 이미 시트가 있으면
 * 200 으로 **기존 첫 시트**를 돌려주는데, 그걸 그냥 밀어 넣으면 탭이 하나 복제된다.
 */
export function useCreateNoteSheet(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateNoteSheetBody) => createNoteSheet(appId, stepId, body),
    onSuccess: (sheet) => {
      qc.setQueryData<StepNoteSheet[]>(noteSheetsKey(appId, stepId), (prev) => {
        const list = prev ?? []
        return list.some((s) => s.id === sheet.id)
          ? list.map((s) => (s.id === sheet.id ? sheet : s))
          : [...list, sheet]
      })
    },
    onError: (err) => toast.error(serverMessage(err, '시트를 추가하지 못했어요.')),
  })
}

/**
 * 이름·본문 저장.
 *
 * 🔴 **`invalidateQueries` 를 쓰지 않는다.** 자동 저장이 1.5초마다 도는데 그때마다 목록을
 * 다시 받으면, 응답이 도착하는 순간 탭 줄이 재정렬(리렌더)되어 글 쓰는 중에 화면이 흔들린다.
 * 자리는 그대로 두고 **그 시트 한 장만** 갈아 끼운다.
 */
export function useUpdateNoteSheet(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sheetId, ...body }: { sheetId: string } & UpdateNoteSheetBody) =>
      updateNoteSheet(appId, stepId, sheetId, body),
    onSuccess: (sheet) => {
      qc.setQueryData<StepNoteSheet[]>(noteSheetsKey(appId, stepId), (prev) =>
        (prev ?? []).map((s) => (s.id === sheet.id ? sheet : s)),
      )
    },
    // 본문 저장 실패 토스트는 컨테이너가 맥락(자동 저장 / 전환 flush)에 맞춰 낸다
  })
}

export function useDeleteNoteSheet(appId: string, stepId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sheetId: string) => deleteNoteSheet(appId, stepId, sheetId),
    onSuccess: (_res, sheetId) => {
      qc.setQueryData<StepNoteSheet[]>(noteSheetsKey(appId, stepId), (prev) =>
        (prev ?? []).filter((s) => s.id !== sheetId),
      )
    },
    onError: (err) => toast.error(serverMessage(err, '시트를 삭제하지 못했어요.')),
  })
}
