import { apiClient } from '@/api/client'

export interface StepDetail {
  id: string
  applicationId: string
  orderIndex: number
  name: string
  scheduledDate: string | null
  location: string | null
  notes: string | null
  pinnedContent: string | null
}

export interface ChecklistItem {
  id: string
  stepId: string
  content: string
  isDone: boolean
  orderIndex: number
  createdAt: string
}

export interface UpdateStepBody {
  scheduledDate?: string | null
  location?: string | null
  notes?: string | null
  pinnedContent?: string | null
}

export const updateStep = (appId: string, stepId: string, body: UpdateStepBody) =>
  apiClient.patch<{ data: StepDetail }>(`/applications/${appId}/steps/${stepId}`, body).then((r) => r.data.data)

export const getChecklist = (appId: string, stepId: string) =>
  apiClient.get<{ data: ChecklistItem[] }>(`/applications/${appId}/steps/${stepId}/checklist`).then((r) => r.data.data)

export const createChecklistItem = (appId: string, stepId: string, content: string) =>
  apiClient.post<{ data: ChecklistItem }>(`/applications/${appId}/steps/${stepId}/checklist`, { content }).then((r) => r.data.data)

export const updateChecklistItem = (
  appId: string,
  stepId: string,
  itemId: string,
  body: { content?: string; isDone?: boolean },
) =>
  apiClient
    .patch<{ data: ChecklistItem }>(`/applications/${appId}/steps/${stepId}/checklist/${itemId}`, body)
    .then((r) => r.data.data)

export const deleteChecklistItem = (appId: string, stepId: string, itemId: string) =>
  apiClient.delete(`/applications/${appId}/steps/${stepId}/checklist/${itemId}`)

// ── 준비 노트 시트 (엑셀 탭) ─────────────────────────────────
/**
 * 체크리스트와 **같은 프리픽스** 아래의 형제 리소스다 (`steps/:stepId/note-sheets`).
 * 소유권 체인(카드 → 스텝 → 시트)이 URL 에 그대로 있어 서버가 3-hop 을 빠짐없이 본다.
 */

export interface StepNoteSheet {
  id: string
  stepId: string
  name: string
  /** tiptap doc JSON 문자열. 빈 시트는 null */
  content: string | null
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface CreateNoteSheetBody {
  name: string
  content?: string
  /**
   * 🔴 승격 멱등 가드 — 시트가 **0장일 때만** 만든다. 이미 있으면 서버가 첫 시트를
   * 그대로 돌려준다(200). 더블 세이브·멀티탭이 같은 "기존 노트 → 첫 시트" 승격을
   * 두 번 보내도 시트가 2장이 되지 않는다.
   */
  ifEmpty?: boolean
}

export interface UpdateNoteSheetBody {
  name?: string
  content?: string
  orderIndex?: number
}

const sheetsPath = (appId: string, stepId: string) =>
  `/applications/${appId}/steps/${stepId}/note-sheets`

export const getNoteSheets = (appId: string, stepId: string) =>
  apiClient
    .get<{ data: StepNoteSheet[] }>(sheetsPath(appId, stepId))
    .then((r) => r.data.data)

export const createNoteSheet = (appId: string, stepId: string, body: CreateNoteSheetBody) =>
  apiClient
    .post<{ data: StepNoteSheet }>(sheetsPath(appId, stepId), body)
    .then((r) => r.data.data)

export const updateNoteSheet = (
  appId: string,
  stepId: string,
  sheetId: string,
  body: UpdateNoteSheetBody,
) =>
  apiClient
    .patch<{ data: StepNoteSheet }>(`${sheetsPath(appId, stepId)}/${sheetId}`, body)
    .then((r) => r.data.data)

export const deleteNoteSheet = (appId: string, stepId: string, sheetId: string) =>
  apiClient.delete(`${sheetsPath(appId, stepId)}/${sheetId}`)
