import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { StudyNoteFolder, StudyNoteListItem } from '@/api/studyNotes'
import { Modal } from '@/components/common/Modal'
import { STUDY_NOTE_TEMPLATES, templateContent, type StudyNoteTemplate } from '@/data/studyNoteTemplates'
import {
  useCreateStudyNote,
  useCreateStudyNoteFolder,
  useDeleteStudyNote,
  useDeleteStudyNoteFolder,
  useMoveStudyNote,
  usePrepHubGroups,
  useRenameStudyNoteFolder,
  useStudyNoteFolders,
  useStudyNotes,
} from '@/hooks/useStudyNotes'
import { FolderHeader, InlineNameInput, PrepNoteRow, StudyNoteRow } from './HubRows'
import {
  buildHubModel,
  formatRelativeTime,
  HUB_FILTERS,
  loadCollapsedFolders,
  noteTitleLabel,
  prepDeepLink,
  recentItems,
  saveCollapsedFolders,
  type HubFilter,
} from './studyNotesModel'

/**
 * **공부 노트 허브** — 내 공부 노트와 카드 안 준비 노트를 한 화면에서 본다.
 *
 * ## 왜 준비 노트가 여기 보이나 (CEO 결정 1)
 *
 * 카니벌 걱정의 해법이다. 준비 노트가 안 보이면 사람들은 "회사 준비도 공부 노트에서
 * 하지 뭐" 로 간다 — 그러면 카드와 노트가 갈라져 어느 쪽도 완전하지 않게 된다.
 * 그래서 **보여 주되 편집은 안 한다**: 준비 행은 클릭하면 원래 자리(스텝 페이지의 준비
 * 노트 섹션)로 딥링크한다. 데이터는 한 곳에만 있고 복제·동기화가 없다.
 *
 * ## 검색은 서버가 아니다
 *
 * 노트 상한이 500이고 목록에 본문이 없어서 전부 손에 들고 거를 수 있다. 서버 왕복이
 * 없으니 글자를 칠 때마다 즉시 걸러진다 (본문 검색이 생기는 2차에 서버로 옮긴다).
 *
 * ## 🔴 로딩 중에는 빈 상태를 그리지 않는다
 *
 * 「첫 공부 노트를 만들어 볼까요?」가 0.3초 번쩍이고 목록으로 바뀌면, 사용자는 자기
 * 노트가 사라진 줄 안다. 스켈레톤이 그 자리를 지킨다 (스피너 아님 — 자리 모양이 실제와
 * 같아야 로드 후 화면이 안 튄다).
 */

const PAGE = 'w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9'

const SEGMENT_ON = 'bg-surface-3 text-text-primary font-medium'
const SEGMENT_OFF = 'text-text-quaternary hover:text-text-secondary'

export function StudyNotesHub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: notes, isLoading: notesLoading } = useStudyNotes()
  const { data: folders, isLoading: foldersLoading } = useStudyNoteFolders()
  const { data: preps = [] } = usePrepHubGroups()

  const createNote = useCreateStudyNote()
  const createFolder = useCreateStudyNoteFolder()
  const renameFolder = useRenameStudyNoteFolder()
  const deleteFolder = useDeleteStudyNoteFolder()
  const deleteNote = useDeleteStudyNote()
  const moveNoteMutation = useMoveStudyNote()

  /**
   * 문서 페이지의 브레드크럼(📁 폴더명)이 `?folder=` 로 돌아온다. 접어 뒀더라도 그 폴더는
   * 펴 준다 — 눌러서 온 자리가 닫혀 있으면 아무 일도 안 일어난 것처럼 보인다.
   *
   * 🔴 **효과가 아니라 초기값에서** 뺀다. 효과로 열면 "접힘 → 펼침" 두 번 그려지고,
   * 그 사이 프레임에서 스크롤 목표가 아직 접혀 있어 엉뚱한 높이로 튄다.
   */
  const focusFolderId = searchParams.get('folder')

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<HubFilter>('all')
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    const stored = loadCollapsedFolders()
    return focusFolderId ? stored.filter((id) => id !== focusFolderId) : stored
  })
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [folderPendingDelete, setFolderPendingDelete] = useState<StudyNoteFolder | null>(null)
  const [notePendingDelete, setNotePendingDelete] = useState<StudyNoteListItem | null>(null)

  /** 상대 시각은 시계에 의존한다 — 1분마다 다시 그려야 「방금」이 「3분 전」이 된다 */
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const isLoading = notesLoading || foldersLoading
  const noteList = useMemo(() => notes ?? [], [notes])
  const folderList = useMemo(() => folders ?? [], [folders])

  const model = useMemo(
    () => buildHubModel({ notes: noteList, folders: folderList, preps, query, filter }),
    [noteList, folderList, preps, query, filter],
  )
  const recent = useMemo(() => recentItems(noteList, preps), [noteList, preps])

  /** 목록이 그려진 뒤에 그 폴더로 스크롤한다 — 로딩 중엔 아직 붙을 DOM 이 없다 */
  const focusRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!focusFolderId || isLoading) return
    focusRef.current?.scrollIntoView({ block: 'center' })
    // 한 번 쓰고 지운다 — 새로고침할 때마다 다시 튀어 오르면 성가시다
    searchParams.delete('folder')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 진입 1회 처리 (param 을 지우며 스스로 끝난다)
  }, [focusFolderId, isLoading])

  function toggleFolder(id: string) {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      saveCollapsedFolders(next)
      return next
    })
  }

  /** 검색 중에는 접힘을 무시한다 — 걸린 노트가 접힌 폴더 안에 숨으면 결과가 거짓말이 된다 */
  const searching = query.trim() !== ''
  const isExpanded = (id: string) => searching || !collapsed.includes(id)

  async function openNewNote(template?: StudyNoteTemplate) {
    if (createNote.isPending) return
    try {
      const note = await createNote.mutateAsync(
        template ? { title: template.title, content: templateContent(template) } : {},
      )
      navigate(`/study-notes/${note.id}`)
    } catch {
      // 서버 문구 토스트는 훅(onError)이 낸다 — 500개 상한이 현재 개수를 실어 온다
    }
  }

  function commitNewFolder(name: string) {
    setCreatingFolder(false)
    createFolder.mutate(name)
  }

  function moveNote(note: StudyNoteListItem, folderId: string | null) {
    if (note.folderId === folderId) return
    moveNoteMutation.mutate({ id: note.id, folderId })
  }

  const showEmptyState = !isLoading && !searching && noteList.length === 0 && folderList.length === 0

  return (
    <div className={PAGE}>
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-3 mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl font-bold">공부 노트</h1>
          <p className="text-xs text-text-quaternary mt-1">
            공부 자료와 회사별 준비 노트를 한 곳에서
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-card border border-line text-text-secondary hover:border-line-strong hover:text-text-primary text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <FolderPlusIcon />
            새 폴더
          </button>
          <button
            type="button"
            onClick={() => void openNewNote()}
            disabled={createNote.isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand hover:bg-accent text-bg text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <PlusIcon />새 노트
          </button>
        </div>
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="mb-5 lg:mb-6 lg:flex lg:items-center lg:gap-3">
        <div className="relative mb-3.5 lg:mb-0 lg:flex-1 lg:max-w-[320px]">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노트 · 폴더 · 회사 검색"
            aria-label="노트 · 폴더 · 회사 검색"
            /* 모바일 16px — 미만이면 iOS 사파리가 포커스에서 화면을 확대한다 */
            className="w-full h-10 lg:h-9 pl-8 pr-3 rounded-lg bg-input border border-line text-base lg:text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60"
          />
        </div>
        <div className="flex items-center justify-between lg:justify-start gap-2">
          <div
            role="tablist"
            aria-label="노트 종류"
            className="inline-flex items-center h-9 p-1 rounded-lg bg-surface-2 text-xs"
          >
            {HUB_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`h-7 px-3 lg:px-3.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                  filter === value ? SEGMENT_ON : SEGMENT_OFF
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            aria-label="새 폴더"
            className="lg:hidden w-9 h-9 rounded-lg bg-card border border-line text-text-tertiary flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <FolderPlusIcon />
          </button>
        </div>
      </div>

      {isLoading ? (
        <HubSkeleton />
      ) : (
        <>
          {/* ── 최근 (공부·준비 통합 3개) ── */}
          {!searching && recent.length > 0 && (
            <div className="mb-6">
              <div className="text-[11px] font-medium text-text-quaternary uppercase tracking-wider mb-2">
                최근
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      navigate(
                        item.kind === 'study'
                          ? `/study-notes/${item.noteId}`
                          : prepDeepLink({
                              applicationId: item.applicationId!,
                              stepId: item.stepId!,
                            }),
                      )
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-line text-xs text-text-secondary hover:border-brand/60 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <span aria-hidden="true">{item.kind === 'study' ? '📄' : '🏢'}</span>
                    <span className="max-w-[180px] truncate">{item.label}</span>
                    <span className="text-[10px] text-text-quaternary font-mono">
                      {formatRelativeTime(item.updatedAt, now)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {model.noSearchResult && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary mb-1">검색 결과가 없어요</p>
              <p className="text-xs text-text-quaternary">
                노트 제목 · 폴더 이름 · 회사 이름으로 찾을 수 있어요
              </p>
            </div>
          )}

          {showEmptyState ? (
            <EmptyState
              onPick={(t) => void openNewNote(t)}
              onBlank={() => void openNewNote()}
              disabled={createNote.isPending}
            />
          ) : (
            <>
              {/* ── 폴더 ── */}
              {model.folders.map(({ folder, notes: folderNotes }) => (
                <div
                  key={folder.id}
                  ref={folder.id === focusFolderId ? focusRef : undefined}
                  className="mb-5"
                >
                  <FolderHeader
                    folder={folder}
                    count={folderNotes.length}
                    collapsed={!isExpanded(folder.id)}
                    renaming={renamingFolderId === folder.id}
                    onToggle={() => toggleFolder(folder.id)}
                    onStartRename={() => setRenamingFolderId(folder.id)}
                    onRename={(name) => {
                      setRenamingFolderId(null)
                      if (name !== folder.name) renameFolder.mutate({ folderId: folder.id, name })
                    }}
                    onCancelRename={() => setRenamingFolderId(null)}
                    onRequestDelete={() => setFolderPendingDelete(folder)}
                  />
                  {isExpanded(folder.id) && (
                    <div className="space-y-1.5">
                      {folderNotes.length === 0 ? (
                        <p className="pl-[18px] text-[11px] text-text-quaternary">비어 있어요</p>
                      ) : (
                        folderNotes.map((note) => (
                          <StudyNoteRow
                            key={note.id}
                            note={note}
                            folders={folderList}
                            now={now}
                            onMove={(folderId) => moveNote(note, folderId)}
                            onRequestDelete={() => setNotePendingDelete(note)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* 목록 끝 ghost — 「새 폴더」와 같은 동작, 손이 이미 아래에 있을 때의 자리 */}
              {filter !== 'prep' &&
                (creatingFolder ? (
                  <div className="flex items-center gap-1.5 mb-5">
                    <span className="text-[13px]" aria-hidden="true">
                      📁
                    </span>
                    <InlineNameInput
                      initial=""
                      ariaLabel="새 폴더 이름"
                      onCommit={commitNewFolder}
                      onCancel={() => setCreatingFolder(false)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="flex items-center gap-1.5 mb-5 text-[13px] text-text-quaternary hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded"
                  >
                    <PlusIcon />
                    폴더 만들기
                  </button>
                ))}

              {/* ── 미분류 ── */}
              {model.unfiled.length > 0 && (
                <div className="mb-7">
                  <div className="mb-2 text-[13px] font-medium text-text-quaternary pl-[18px]">
                    미분류
                  </div>
                  <div className="space-y-1.5">
                    {model.unfiled.map((note) => (
                      <StudyNoteRow
                        key={note.id}
                        note={note}
                        folders={folderList}
                        now={now}
                        onMove={(folderId) => moveNote(note, folderId)}
                        onRequestDelete={() => setNotePendingDelete(note)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 회사 준비 노트 ── */}
          {model.preps.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[13px] font-medium text-text-secondary">회사 준비 노트</h2>
                <span className="text-[11px] text-text-quaternary hidden sm:inline">
                  카드에서 작성한 노트 · 누르면 해당 카드로 이동
                </span>
              </div>
              <div className="space-y-1.5">
                {model.preps.map((group) => (
                  <PrepNoteRow key={group.stepId} group={group} now={now} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 모바일 새 노트 FAB — 하단 탭 위 */}
      <button
        type="button"
        onClick={() => void openNewNote()}
        disabled={createNote.isPending}
        aria-label="새 노트"
        className="lg:hidden fixed bottom-[88px] right-[18px] z-40 w-12 h-12 rounded-full bg-brand text-bg shadow-lg flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <PlusIcon size={19} strokeWidth={2.5} />
      </button>

      {/* ── 폴더 삭제 확인 ── */}
      <Modal
        open={!!folderPendingDelete}
        onClose={() => setFolderPendingDelete(null)}
        title="폴더 삭제"
      >
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">
          <span className="text-text-primary font-semibold">
            &apos;{folderPendingDelete?.name}&apos;
          </span>{' '}
          폴더를 삭제할까요? <span className="text-text-primary">노트는 미분류로 남아요.</span>
        </p>
        <ConfirmButtons
          onCancel={() => setFolderPendingDelete(null)}
          onConfirm={() => {
            if (folderPendingDelete) deleteFolder.mutate(folderPendingDelete.id)
            setFolderPendingDelete(null)
          }}
          pending={deleteFolder.isPending}
        />
      </Modal>

      {/* ── 노트 삭제 확인 (휴지통 없음 — 영구 삭제를 문구로 명시) ── */}
      <Modal open={!!notePendingDelete} onClose={() => setNotePendingDelete(null)} title="노트 삭제">
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">
          <span className="text-text-primary font-semibold">
            &apos;{notePendingDelete ? noteTitleLabel(notePendingDelete.title) : ''}&apos;
          </span>{' '}
          노트를 삭제하면 안의 내용도 사라져요. 되돌릴 수 없어요.
        </p>
        <ConfirmButtons
          onCancel={() => setNotePendingDelete(null)}
          onConfirm={() => {
            if (notePendingDelete) deleteNote.mutate(notePendingDelete.id)
            setNotePendingDelete(null)
          }}
          pending={deleteNote.isPending}
        />
      </Modal>
    </div>
  )
}

function ConfirmButtons({
  onCancel,
  onConfirm,
  pending,
}: {
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 rounded-lg border border-line text-text-secondary text-sm hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-text-primary text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        삭제
      </button>
    </div>
  )
}

/** 첫 방문 — 템플릿 카드가 곧 온보딩이다 (서식은 템플릿 본문이 가르친다) */
function EmptyState({
  onPick,
  onBlank,
  disabled,
}: {
  onPick: (t: StudyNoteTemplate) => void
  onBlank: () => void
  disabled: boolean
}) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-text-secondary mb-1.5">첫 공부 노트를 만들어 볼까요?</p>
      <p className="text-xs text-text-quaternary mb-6">
        AI가 정리해 준 내용을 붙여넣으면 서식까지 그대로 들어와요
      </p>
      {/*
        🔴 7종이 되면서 3열 고정을 놨다 (2026-08-18). 320px 에서 3열은 카드 하나가 ~90px 라
        제목이 두 줄로 접히고 설명은 읽을 수 없다 — 좁은 화면은 **1열이 정답**이고, 넓어질수록
        열을 준다. 마지막 줄이 한 장만 남는 건 감수한다(7은 소수라 어떤 열 수로도 안 떨어진다).
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-[720px] mx-auto">
        {STUDY_NOTE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            disabled={disabled}
            className="p-4 rounded-xl bg-card border border-line hover:border-brand/60 text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <div className="text-lg mb-2" aria-hidden="true">
              {t.emoji}
            </div>
            <div className="text-[13px] font-medium mb-1">{t.title}</div>
            <div className="text-[11px] text-text-quaternary leading-relaxed">{t.desc}</div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onBlank}
        disabled={disabled}
        className="mt-4 text-xs text-text-quaternary hover:text-text-secondary underline underline-offset-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded"
      >
        빈 문서로 시작
      </button>
    </div>
  )
}

/** 자리 모양이 실제 목록과 같아야 로드 후 화면이 안 튄다 (폴더 머리 → 행 3장) */
function HubSkeleton() {
  return (
    <div aria-busy="true">
      <div className="h-4 w-24 rounded bg-card animate-pulse mb-3" />
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[46px] rounded-lg bg-card animate-pulse" />
        ))}
      </div>
    </div>
  )
}

/* ─── Icons ─── */
function PlusIcon({ size = 13, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function FolderPlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6M9 13h6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
