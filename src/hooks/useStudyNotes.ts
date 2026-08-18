import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStudyNote,
  createStudyNoteFolder,
  deleteStudyNote,
  deleteStudyNoteFolder,
  getPrepHubGroups,
  getStudyNote,
  getStudyNoteBacklinks,
  getStudyNoteFolders,
  getStudyNotes,
  renameStudyNoteFolder,
  updateStudyNote,
  type CreateStudyNoteBody,
  type StudyNote,
  type StudyNoteListItem,
  type UpdateStudyNoteBody,
} from '@/api/studyNotes'
import { serverMessage } from '@/hooks/useStepDetail'
import { toast } from '@/stores/toastStore'

/**
 * 공부 노트 허브·문서 react-query 훅.
 *
 * ## 🔴 자동 저장 경로는 `invalidateQueries` 를 쓰지 않는다
 *
 * 문서 페이지의 본문 저장은 1.5초마다 돈다. 그때마다 목록을 다시 받으면 응답이 도착할 때
 * 허브 캐시가 갈리며 글 쓰는 중에 화면이 흔들린다 (준비 노트 시트가 같은 이유로
 * `setQueryData` 만 쓴다 — `useUpdateNoteSheet` 주석). 바뀐 한 줄만 손으로 갈아 끼운다.
 *
 * ## 캐시 키
 *
 * 전부 `['study-notes', …]` 아래다. 폴더 삭제처럼 **여러 목록을 동시에 바꾸는** 동작만
 * 접두어 하나로 통째 무효화한다 (노트의 folderId 가 서버에서 NULL 이 되므로 목록도 낡는다).
 */

export const studyNotesKey = {
  all: ['study-notes'] as const,
  list: ['study-notes', 'list'] as const,
  folders: ['study-notes', 'folders'] as const,
  prepHub: ['study-notes', 'hub-prep'] as const,
  detail: (id: string) => ['study-notes', 'detail', id] as const,
  backlinks: (id: string) => ['study-notes', 'backlinks', id] as const,
}

export function useStudyNotes() {
  return useQuery({
    queryKey: studyNotesKey.list,
    queryFn: getStudyNotes,
    staleTime: 30_000,
  })
}

export function useStudyNoteFolders() {
  return useQuery({
    queryKey: studyNotesKey.folders,
    queryFn: getStudyNoteFolders,
    staleTime: 30_000,
  })
}

export function usePrepHubGroups() {
  return useQuery({
    queryKey: studyNotesKey.prepHub,
    queryFn: getPrepHubGroups,
    staleTime: 30_000,
  })
}

export function useStudyNote(id: string | undefined) {
  return useQuery({
    queryKey: studyNotesKey.detail(id ?? ''),
    queryFn: () => getStudyNote(id!),
    enabled: !!id,
    /**
     * 🔴 재조회 금지. 본문은 tiptap 이 **마운트 때 한 번만** 읽는다 — 뒤늦게 도착한
     * 응답으로 캐시가 갈려도 화면은 안 바뀌고, 그 상태로 저장하면 어느 쪽이 진짜인지
     * 알 수 없게 된다. 문서 한 장의 진실은 화면 위 에디터다 (last-write-wins).
     */
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useStudyNoteBacklinks(id: string | undefined) {
  return useQuery({
    queryKey: studyNotesKey.backlinks(id ?? ''),
    queryFn: () => getStudyNoteBacklinks(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ── 노트 변경 ────────────────────────────────────────────────

/**
 * 목록 한 줄만 갈아 끼운다 (없으면 앞에 꽂는다 — 최근 수정순이라 새 노트가 맨 위다).
 *
 * 🔴 **`backlinkCount` 는 덮지 않고 물려받는다.** 이 함수에 들어오는 건 대부분 단건 CRUD
 * 응답인데 거기엔 백링크 집계가 없다 (목록 전용). 그대로 써 넣으면 자동 저장이 한 번 돌
 * 때마다 허브의 「🔗 2」가 조용히 사라진다 — 사용자 눈엔 링크가 끊긴 것처럼 보인다.
 */
function upsertListItem(
  prev: StudyNoteListItem[] | undefined,
  note: StudyNote | StudyNoteListItem,
): StudyNoteListItem[] {
  const list = prev ?? []
  const existing = list.find((n) => n.id === note.id)
  const row: StudyNoteListItem = {
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    updatedAt: note.updatedAt,
    backlinkCount: note.backlinkCount ?? existing?.backlinkCount,
  }
  return existing
    ? list.map((n) => (n.id === row.id ? row : n))
    : [row, ...list]
}

export function useCreateStudyNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateStudyNoteBody) => createStudyNote(body),
    onSuccess: (note) => {
      qc.setQueryData<StudyNoteListItem[]>(studyNotesKey.list, (prev) =>
        upsertListItem(prev, note),
      )
      qc.setQueryData(studyNotesKey.detail(note.id), note)
    },
    // 🔴 서버 문구 우선 — 500개 상한은 서버가 현재 개수를 실어 400 으로 돌려준다
    onError: (err) => toast.error(serverMessage(err, '노트를 만들지 못했어요.')),
  })
}

export function useUpdateStudyNote(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateStudyNoteBody) => updateStudyNote(id, body),
    onSuccess: (note) => {
      qc.setQueryData(studyNotesKey.detail(note.id), note)
      qc.setQueryData<StudyNoteListItem[]>(studyNotesKey.list, (prev) =>
        upsertListItem(prev, note),
      )
    },
    // 저장 실패 표시는 에디터의 「저장 실패」 라벨이 맡는다 — 토스트까지 겹치면 소음이다
  })
}

/**
 * 폴더 이동 — 노트 id 를 **인자로** 받는다. 허브는 행마다 훅을 걸 수 없고
 * (`useUpdateStudyNote` 는 문서 한 장에 묶여 있다) 바꾸는 건 `folderId` 하나뿐이다.
 */
export function useMoveStudyNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      updateStudyNote(id, { folderId }),
    onSuccess: (note) => {
      qc.setQueryData<StudyNoteListItem[]>(studyNotesKey.list, (prev) =>
        (prev ?? []).map((n) => (n.id === note.id ? { ...n, folderId: note.folderId } : n)),
      )
      qc.setQueryData(studyNotesKey.detail(note.id), note)
    },
    onError: (err) => toast.error(serverMessage(err, '노트를 옮기지 못했어요.')),
  })
}

export function useDeleteStudyNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStudyNote(id),
    onSuccess: (_res, id) => {
      qc.setQueryData<StudyNoteListItem[]>(studyNotesKey.list, (prev) =>
        (prev ?? []).filter((n) => n.id !== id),
      )
      qc.removeQueries({ queryKey: studyNotesKey.detail(id) })
    },
    onError: (err) => toast.error(serverMessage(err, '노트를 삭제하지 못했어요.')),
  })
}

// ── 폴더 변경 ────────────────────────────────────────────────

export function useCreateStudyNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createStudyNoteFolder(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyNotesKey.folders }),
    onError: (err) => toast.error(serverMessage(err, '폴더를 만들지 못했어요.')),
  })
}

export function useRenameStudyNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      renameStudyNoteFolder(folderId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyNotesKey.folders }),
    onError: (err) => toast.error(serverMessage(err, '폴더 이름을 바꾸지 못했어요.')),
  })
}

/**
 * 폴더 삭제 — 안의 노트는 **서버에서 미분류로 남는다** (FK SET NULL).
 * 그래서 폴더 목록만 갈면 안 되고 노트 목록의 `folderId` 도 낡는다 → 접두어 통째 무효화.
 */
export function useDeleteStudyNoteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (folderId: string) => deleteStudyNoteFolder(folderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyNotesKey.all }),
    onError: (err) => toast.error(serverMessage(err, '폴더를 삭제하지 못했어요.')),
  })
}
