import { apiClient } from '@/api/client'

/**
 * study-notes — 공부 노트 허브 API.
 *
 * 🔴 **경로 순서는 서버 컨트롤러와 같은 계약이다.** `folders`·`hub/prep` 는 `:id` 보다
 * 위에서 매칭되는 정적 경로라 프론트도 같은 문자열을 쓴다 (`/study-notes/folders` 를
 * `/study-notes/${id}` 로 만들면 ParseUUIDPipe 가 400 을 준다).
 *
 * 응답은 전부 `{ data, message }` 로 감싸져 온다 (`ResponseTransformInterceptor`).
 */

const BASE = '/study-notes'

export interface StudyNoteFolder {
  id: string
  name: string
  /** 2차 중첩 예약 — 1차는 항상 null */
  parentId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * 허브 목록 한 줄 — **본문이 없다** (서버가 `content` 를 select 에서 뺀다).
 * 멘션 suggestion 소스도 이 목록을 그대로 재사용한다.
 */
export interface StudyNoteListItem {
  id: string
  /** 빈 문자열이 정상 값 — 화면 표시(「제목 없음」)는 프론트 몫 */
  title: string
  folderId: string | null
  updatedAt: string
  /**
   * 이 노트를 **가리키는** 문서 수 (공부 + 준비 합계).
   *
   * 🔴 **옵셔널인 건 실수가 아니다.** ① 서버 배포 순서상 이 필드가 없는 응답이 잠시 온다
   * ② 단건 CRUD 응답(`StudyNote`)에는 애초에 실리지 않는다 — 목록 전용 집계다.
   * 타입이 `number` 였다면 두 경우 모두 **런타임에 `undefined` 인데 컴파일러는 안전하다고
   * 말하는** 상태가 된다. 화면은 언제나 `?? 0` 으로 받는다.
   */
  backlinkCount?: number
}

/** 문서 페이지가 받는 한 장 — 목록 필드 + 본문 */
export interface StudyNote extends StudyNoteListItem {
  content: string | null
  createdAt: string
}

/** 백링크 한 줄 — 이 노트를 어디서 참조했나 */
export interface StudyNoteBacklink {
  fromType: 'study' | 'prep_sheet'
  fromId: string
  /** study = 노트 제목(빈 제목이면 '') · prep_sheet = "회사명 — 스텝명" */
  label: string
  /** prep_sheet 딥링크용. study 는 둘 다 null */
  applicationId: string | null
  stepId: string | null
}

/** 허브의 「회사 준비」 행 — 카드-스텝 묶음 하나 */
export interface PrepHubGroup {
  applicationId: string
  companyName: string
  stepId: string
  stepName: string
  sheetCount: number
  lastUpdatedAt: string
}

export interface CreateStudyNoteBody {
  title?: string
  folderId?: string | null
  content?: string
}

export interface UpdateStudyNoteBody {
  title?: string
  /** 🔴 미전달 = 폴더 유지 · `null` 명시 = 미분류로 이동 (서버가 둘을 구분한다) */
  folderId?: string | null
  content?: string
}

// ── 폴더 ─────────────────────────────────────────────────────

export const getStudyNoteFolders = () =>
  apiClient.get<{ data: StudyNoteFolder[] }>(`${BASE}/folders`).then((r) => r.data.data)

export const createStudyNoteFolder = (name: string) =>
  apiClient
    .post<{ data: StudyNoteFolder }>(`${BASE}/folders`, { name })
    .then((r) => r.data.data)

export const renameStudyNoteFolder = (folderId: string, name: string) =>
  apiClient
    .patch<{ data: StudyNoteFolder }>(`${BASE}/folders/${folderId}`, { name })
    .then((r) => r.data.data)

export const deleteStudyNoteFolder = (folderId: string) =>
  apiClient.delete(`${BASE}/folders/${folderId}`)

// ── 허브의 「회사 준비」 ───────────────────────────────────────

export const getPrepHubGroups = () =>
  apiClient.get<{ data: PrepHubGroup[] }>(`${BASE}/hub/prep`).then((r) => r.data.data)

// ── 노트 ─────────────────────────────────────────────────────

export const getStudyNotes = () =>
  apiClient.get<{ data: StudyNoteListItem[] }>(BASE).then((r) => r.data.data)

export const getStudyNote = (id: string) =>
  apiClient.get<{ data: StudyNote }>(`${BASE}/${id}`).then((r) => r.data.data)

export const createStudyNote = (body: CreateStudyNoteBody) =>
  apiClient.post<{ data: StudyNote }>(BASE, body).then((r) => r.data.data)

export const updateStudyNote = (id: string, body: UpdateStudyNoteBody) =>
  apiClient.patch<{ data: StudyNote }>(`${BASE}/${id}`, body).then((r) => r.data.data)

export const deleteStudyNote = (id: string) => apiClient.delete(`${BASE}/${id}`)

export const getStudyNoteBacklinks = (id: string) =>
  apiClient
    .get<{ data: StudyNoteBacklink[] }>(`${BASE}/${id}/backlinks`)
    .then((r) => r.data.data)

// ── 본문 첨부 (이미지) ────────────────────────────────────────

/** R2 PUT 이 끝난 뒤 등록하는 첨부 한 건 (study-note-media PR-A) */
export interface NoteAttachment {
  id: string
  fileUrl: string
}

/**
 * 업로드된 객체를 노트에 붙인다 — 저장 용량 cap 검증이 여기서 돈다.
 *
 * 🔴 body 의 `fileUrl` 은 인터셉터의 **보상 삭제 추적 키**이기도 하다 (`client.ts`).
 * 4xx/5xx 로 떨어지면 인터셉터가 `DELETE /files` 로 R2 객체를 지우고 서버 문구를
 * 토스트한다 — 호출부가 같은 일을 또 하면 안 된다 (`noteImageUpload.ts` 주석).
 */
export const createNoteAttachment = (
  noteId: string,
  body: { fileUrl: string; fileSizeBytes: number },
) =>
  apiClient
    .post<{ data: NoteAttachment }>(`${BASE}/${noteId}/attachments`, body)
    .then((r) => r.data.data)
