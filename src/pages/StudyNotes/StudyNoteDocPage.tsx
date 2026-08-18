import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import type { StudyNoteBacklink, StudyNoteListItem } from '@/api/studyNotes'
import { Modal } from '@/components/common/Modal'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { editorToMarkdown } from '@/components/editor/markdownIO'
import type { StudyNoteMentionOptions } from '@/components/editor/StudyNoteMention'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import {
  useDeleteStudyNote,
  useStudyNote,
  useStudyNoteBacklinks,
  useStudyNoteFolders,
  useStudyNotes,
  useUpdateStudyNote,
} from '@/hooks/useStudyNotes'
import {
  STUDY_NOTE_TEMPLATES,
  templateContent,
  type StudyNoteTemplate,
} from '@/data/studyNoteTemplates'
import { toast } from '@/stores/toastStore'
import { docToMemoValue, type TiptapDoc } from '@/utils/memoSections'
import {
  countDetails,
  extractToc,
  setAllDetailsOpen,
  tocAncestorPositions,
  tocIndentClass,
  type TocItem,
} from './docEditorUtils'
import {
  companyInitial,
  loadNoteMode,
  noteTitleLabel,
  prepDeepLink,
  saveNoteMode,
  type NoteMode,
} from './studyNotesModel'

/**
 * **공부 노트 문서 한 장** — 편집/읽기 · TOC · 백링크.
 *
 * ## 읽기 모드가 이 화면의 절반이다
 *
 * 정리한 걸 **다시 읽으려고** 오는 화면이라, 편집 UI(툴바·커서)가 계속 떠 있으면 공부가 아니라
 * 작업이 된다. 읽기에서는 툴바가 사라지고 본문이 720px 로 좁아진다(한 줄 65자 = 눈이 줄을
 * 잃지 않는 폭). **토글은 읽기에서도 열고 닫힌다** — 접어 놓고 답을 맞혀 보는 self-test 가
 * 읽기 모드의 존재 이유다. 마지막 모드는 **기기 단위**로 기억한다.
 *
 * ## 🔴 저장은 두 갈래고 둘 다 놓치면 안 된다
 *
 * 본문은 에디터가 1.5초 debounce 로, 제목은 이 페이지가 1초 debounce 로 저장한다.
 * 두 타이머 모두 **언마운트에서 그냥 버려진다** — 뒤로가기 한 번에 마지막 한 문장이
 * 사라지는 종류의 손실이다. 그래서 저장 직전 형태를 `pendingRef` 에 쥐고 있다가 떠날 때
 * 즉시 보낸다 (준비 노트 시트 전환이 쓰는 것과 같은 장치).
 *
 * ## 🔴 빈 노트는 떠날 때 스스로 지운다
 *
 * 「새 노트」가 한 번의 탭으로 문서를 만든다 — 잘못 눌러 놓고 나가면 「제목 없음」 이 목록에
 * 쌓인다. 제목·본문이 **둘 다** 빈 채로 떠나면 지운다.
 * StrictMode 는 마운트 직후 한 번 언마운트했다가 다시 붙이므로, 지우기는 조금 미뤄 두고
 * **다시 마운트되면 취소**한다 — 안 그러면 방금 만든 노트가 개발 모드에서 즉시 증발한다.
 */

const PAGE = 'w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9'

/** 서버 상한과 같은 값 (`NOTE_CONTENT_MAX_CHARS`) */
const CONTENT_MAX = 100_000
/** 서버 상한과 같은 값 (`NOTE_TITLE_MAX_CHARS`) */
const TITLE_MAX = 100

const TITLE_SAVE_DEBOUNCE_MS = 1000

/** 떠난 뒤 지워야 할 빈 노트 — StrictMode 재마운트가 취소할 수 있게 모듈 단위로 둔다 */
const pendingBlankDelete = new Map<string, ReturnType<typeof setTimeout>>()
const BLANK_DELETE_DELAY_MS = 400

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function StudyNoteDocPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: note, isLoading, isError } = useStudyNote(id)
  const { data: folders = [] } = useStudyNoteFolders()
  const { data: allNotes } = useStudyNotes()
  const { data: backlinks = [] } = useStudyNoteBacklinks(id)
  const update = useUpdateStudyNote(id)
  const remove = useDeleteStudyNote()

  const [mode, setMode] = useState<NoteMode>(loadNoteMode)
  const [title, setTitle] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const readOnly = mode === 'read'

  // ── 에디터 손잡이 ─────────────────────────────────────────
  /*
    🔴 공용 `RichTextEditor` 는 editor 를 밖으로 안 준다 — `header` 슬롯이 유일한 통로다
    (`StepNoteEditor` 가 flush 하려고 쓰는 것과 같은 길, 렌더물은 없다). TOC 추출·토글
    일괄 접기가 doc 자체를 봐야 해서 여기서도 그 통로를 쓴다.
  */
  const editorRef = useRef<Editor | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const editorSlot = useCallback((ed: Editor) => {
    if (editorRef.current !== ed) {
      editorRef.current = ed
      // 렌더 중 setState 는 금지 — 다음 틱에 알린다
      queueMicrotask(() => setEditor(ed))
    }
    return null
  }, [])

  // ── 빈 문서 템플릿 제안 (2026-08-18 확장 · plan §3) ─────────
  /*
    템플릿 진입점이 허브 빈 상태뿐이면 **노트가 하나라도 생긴 뒤엔 템플릿에 닿을 길이 없다.**
    그래서 「새 노트」로 열린 빈 문서 위에 칩을 띄운다 — 타이핑을 시작하거나 템플릿을 고르면
    사라진다 (노션의 빈 페이지 패턴). 내용이 있던 노트에는 처음부터 안 뜨고, 본문을 전부
    지우면 다시 나타난다 (라치는 노트 단위 — 자동 저장으로 content 가 차도 유지).
  */
  const [bodyHasContent, setBodyHasContent] = useState(false)
  const [templateApplied, setTemplateApplied] = useState(false)
  /*
    🔴 갓 만든 노트의 content 는 '' 가 아니라 null 이다 (백엔드 TEXT NULL — 빈 노트 삭제 spec 픽스처 실증).
    note.id 시점의 content 만 캡처한다 — 자동 저장으로 content 가 차도 「빈 문서로 시작한 노트」라는
    판정은 유지돼야 하므로 content 는 의도적으로 의존성에서 뺀다.
  */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startedEmpty = useMemo(() => note !== undefined && (note.content ?? '') === '', [note?.id])
  const showTemplateChips =
    !readOnly && startedEmpty && !bodyHasContent && !templateApplied

  /**
   * 템플릿 적용 — setContent 는 update 이벤트를 안 내므로 저장 경로를 직접 민다.
   * 🔴 ref 갱신은 기존 핸들러(handleTextChange·handleTitleChange)를 재사용한다 —
   * 같은 뮤테이션을 여기서 한 벌 더 만들면 두 벌이 어긋나는 날이 온다.
   */
  function applyTemplate(t: StudyNoteTemplate): void {
    const ed = editorRef.current
    if (!ed) return
    setTemplateApplied(true)
    const content = templateContent(t)
    ed.commands.setContent(JSON.parse(content) as Parameters<typeof ed.commands.setContent>[0])
    handleTextChange(ed.getText())
    if (title.trim() === '') handleTitleChange(t.title)
    // 본문은 즉시 저장 (실패 시 pendingBodyRef 가 이미 차 있어 떠날 때 flush 가 재시도)
    void persist({ content }).catch(() => {})
  }

  // ── 멘션 소스 (목록 1회 로드 후 클라 필터) ─────────────────
  const notesRef = useRef<{ loaded: boolean; items: StudyNoteListItem[] }>({
    loaded: false,
    items: [],
  })
  /* 🔴 ref 쓰기는 렌더 밖에서 — 멘션 소스는 `[[` 를 칠 때 읽히므로 한 틱 늦어도 무해하다 */
  useEffect(() => {
    notesRef.current = { loaded: allNotes !== undefined, items: allNotes ?? [] }
  }, [allNotes])

  const mention = useMemo<StudyNoteMentionOptions>(
    () => ({
      // 자기 자신은 뺀다 — 자기 멘션은 무해하지만 고를 이유가 없다
      items: () =>
        notesRef.current.items
          .filter((n) => n.id !== id)
          .map((n) => ({ id: n.id, title: noteTitleLabel(n.title) })),
      onNavigate: (noteId) => navigate(`/study-notes/${noteId}`),
      /*
        🔴 목록을 **아직 못 받았으면 판정하지 않는다.** 그 순간 모든 칩이 「삭제된 노트」로
        보이고, 사용자는 자기 링크가 통째로 끊긴 줄 안다.
      */
      isDeadNote: (noteId) =>
        notesRef.current.loaded && !notesRef.current.items.some((n) => n.id === noteId),
    }),
    [id, navigate],
  )

  // ── 저장 (본문·제목 두 갈래 + 떠날 때 flush) ────────────────
  const pendingTitleRef = useRef<string | null>(null)
  const pendingBodyRef = useRef<string | null>(null)
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 언마운트 판정용 — 로딩 중엔 「빈 노트」로 보지 않는다 (안 읽은 걸 지우면 안 된다) */
  const leaveRef = useRef({ ready: false, title: '', bodyEmpty: true, deleted: false })

  useEffect(() => {
    if (!note) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 값 → 폼 상태 1회 동기화 (id 단위)
    setTitle(note.title)
    leaveRef.current = {
      ready: true,
      title: note.title,
      bodyEmpty: !note.content,
      deleted: false,
    }
  }, [note?.id])

  const persist = useCallback(
    async (body: { title?: string; content?: string }) => {
      setSaveState('saving')
      try {
        await update.mutateAsync(body)
        setSaveState('saved')
        setDirty(false)
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch (err) {
        setSaveState('error')
        throw err
      }
    },
    [update],
  )

  /** 에디터의 1.5s 자동 저장 */
  async function handleBodySave(value: string): Promise<void> {
    pendingBodyRef.current = null
    try {
      await persist({ content: value })
    } catch (err) {
      // 떠날 때 flush 가 한 번 더 시도한다 + 에디터의 「저장 실패」 라벨을 살린다
      pendingBodyRef.current = value
      throw err
    }
  }

  /** 매 입력마다 **저장 형태**로 떠 둔다 — 언마운트 시점엔 tiptap 이 이미 destroy 됐을 수 있다 */
  function handleTextChange(plain: string): void {
    const ed = editorRef.current
    if (ed) {
      const empty = ed.isEmpty
      // 🔴 에디터가 자동 저장에 쓰는 것과 **같은 직렬화** — 다르면 껍데기 JSON 이 저장된다
      pendingBodyRef.current = empty ? '' : docToMemoValue(ed.getJSON() as TiptapDoc)
      leaveRef.current.bodyEmpty = empty
      setBodyHasContent(!empty)
    } else {
      const empty = plain.trim() === ''
      leaveRef.current.bodyEmpty = empty
      setBodyHasContent(!empty)
    }
    setDirty(true)
  }

  function handleTitleChange(next: string): void {
    setTitle(next)
    setDirty(true)
    leaveRef.current.title = next
    pendingTitleRef.current = next
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
    titleTimerRef.current = setTimeout(() => {
      const value = pendingTitleRef.current
      pendingTitleRef.current = null
      if (value !== null) void persist({ title: value }).catch(() => {})
    }, TITLE_SAVE_DEBOUNCE_MS)
  }

  /** 떠나기 직전 미저장분 즉시 전송. 기다리지 않는다 — 이동을 막지 않는다 */
  const flush = useCallback(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
    const body: { title?: string; content?: string } = {}
    if (pendingTitleRef.current !== null) body.title = pendingTitleRef.current
    if (pendingBodyRef.current !== null) body.content = pendingBodyRef.current
    pendingTitleRef.current = null
    pendingBodyRef.current = null
    if (Object.keys(body).length === 0) return
    void update.mutateAsync(body).catch(() => {
      toast.error('나가기 전 저장에 실패했어요. 직전 자동 저장 시점까지만 남아 있어요.')
    })
  }, [update])

  /* 언마운트 정리(flush·빈 노트 삭제)가 **마지막 값**을 보게 — 쓰기는 렌더 밖에서 한다 */
  const removeRef = useRef(remove)
  const flushRef = useRef(flush)
  useEffect(() => {
    removeRef.current = remove
    flushRef.current = flush
  })

  // StrictMode 가 붙였다 뗐다 하는 사이 예약된 삭제를 취소한다
  useEffect(() => {
    const scheduled = pendingBlankDelete.get(id)
    if (scheduled) {
      clearTimeout(scheduled)
      pendingBlankDelete.delete(id)
    }
  }, [id])

  useEffect(() => {
    return () => {
      const st = leaveRef.current
      if (st.deleted) return
      // 오터치 쓰레기 정리 — 제목·본문이 **둘 다** 빈 채로 떠나면 지운다
      if (st.ready && st.title.trim() === '' && st.bodyEmpty) {
        pendingTitleRef.current = null
        pendingBodyRef.current = null
        if (titleTimerRef.current) clearTimeout(titleTimerRef.current)
        pendingBlankDelete.set(
          id,
          setTimeout(() => {
            pendingBlankDelete.delete(id)
            removeRef.current.mutate(id)
          }, BLANK_DELETE_DELAY_MS),
        )
        return
      }
      flushRef.current()
    }
  }, [id])

  // 새로고침·탭 닫기 — 미저장분이 있으면 브라우저가 되묻는다
  useUnloadGuard(dirty)

  // ── TOC · 토글 일괄 ───────────────────────────────────────
  const [toc, setToc] = useState<TocItem[]>([])
  const [details, setDetails] = useState({ total: 0, open: 0 })
  const [activePos, setActivePos] = useState<number | null>(null)

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      setToc(extractToc(editor))
      setDetails(countDetails(editor))
    }
    sync()
    editor.on('update', sync)
    return () => {
      editor.off('update', sync)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || toc.length === 0) return
    const onScroll = () => {
      /*
        🔴 바닥 특례 — 마지막 섹션이 짧으면 그 제목이 120px 선을 **영영 못 넘는다**
        (페이지가 더 안 내려가서). 특례 없이는 목차 마지막 항목을 클릭해도 활성 표시가
        이전 항목으로 되돌아간다 (2026-08-18 목차 세부 검증에서 실측).
      */
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current = toc[0].pos
      if (atBottom) {
        current = toc[toc.length - 1].pos
      } else {
        for (const item of toc) {
          const dom = editor.view.nodeDOM(item.pos) as HTMLElement | null
          const top = dom?.getBoundingClientRect?.().top ?? Number.POSITIVE_INFINITY
          if (top <= 120) current = item.pos
        }
      }
      setActivePos(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [editor, toc])

  function switchMode(next: NoteMode) {
    if (next === mode) return
    // 읽기로 넘어가기 전에 미저장분을 보낸다 — 툴바가 사라진 뒤에 실패하면 알릴 자리가 없다
    if (next === 'read') flush()
    setMode(next)
    saveNoteMode(next)
  }

  function toggleAllDetails() {
    if (!editor) return
    setAllDetailsOpen(editor, details.open === 0)
  }

  function handleExport(markdown: string) {
    const filename = `${(title.trim() || '공부 노트').replace(/[\\/:*?"<>|]/g, '_')}.md`
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('마크다운으로 내보냈어요. 형광펜 색·토글 접힘은 마크다운에 없어 빠져요.')
  }

  function handleDelete() {
    leaveRef.current.deleted = true
    setConfirmDelete(false)
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('노트를 삭제했어요.')
        navigate('/study-notes')
      },
    })
  }

  if (isLoading) return <DocSkeleton />

  if (isError || !note) {
    return (
      <div className={PAGE}>
        <p className="text-sm text-text-secondary mb-4">노트를 찾을 수 없어요.</p>
        <Link
          to="/study-notes"
          className="inline-flex items-center h-9 px-3.5 rounded-lg bg-card border border-line text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          공부 노트로 돌아가기
        </Link>
      </div>
    )
  }

  const folder = folders.find((f) => f.id === note.folderId) ?? null

  return (
    <div className={PAGE}>
      {/* ── 상단: 브레드크럼 · 저장 상태 · 모드 ── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 text-xs text-text-quaternary min-w-0">
          <Link to="/study-notes" className="hover:text-text-secondary transition-colors shrink-0">
            공부 노트
          </Link>
          {folder && (
            <>
              <span className="text-text-faint" aria-hidden="true">
                /
              </span>
              <Link
                to={`/study-notes?folder=${folder.id}`}
                className="hover:text-text-secondary transition-colors shrink-0 truncate max-w-[140px]"
              >
                📁 {folder.name}
              </Link>
            </>
          )}
          <SaveChip state={saveState} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="보기 모드"
            className="inline-flex items-center h-8 p-0.5 rounded-lg bg-surface-2 text-[11px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'edit'}
              onClick={() => switchMode('edit')}
              className={`h-7 px-3 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                mode === 'edit' ? 'bg-surface-3 text-text-primary font-medium' : 'text-text-quaternary'
              }`}
            >
              편집
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'read'}
              onClick={() => switchMode('read')}
              className={`h-7 px-3 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                mode === 'read' ? 'bg-surface-3 text-text-primary font-medium' : 'text-text-quaternary'
              }`}
            >
              읽기
            </button>
          </div>

          {/*
            토글 일괄 — **읽기 모드에서만** (mockup). 접힌 질문을 한 번에 열고 닫는
            self-test 스위치라 편집 중에는 쓸 일이 없고, 토글이 하나도 없는 문서에서는
            누를 게 없는 버튼이라 숨긴다.
          */}
          {readOnly && details.total > 0 && (
            <button
              type="button"
              onClick={toggleAllDetails}
              className="h-8 px-3 rounded-lg bg-card border border-line text-[11px] text-text-tertiary hover:text-text-primary hover:border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              🙈 {details.open === 0 ? '모두 펼치기' : '모두 접기'}
            </button>
          )}

          <DocMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onExport={() => {
              setMenuOpen(false)
              // 툴바의 「내보내기」와 **같은 직렬화**를 탄다 (열화 명세: markdownIO.ts)
              const ed = editorRef.current
              if (ed) handleExport(editorToMarkdown(ed))
            }}
            onDelete={() => {
              setMenuOpen(false)
              setConfirmDelete(true)
            }}
          />
        </div>
      </div>

      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          {/* 읽기 모드 = 65자 가독 폭 (편집은 현행 유지) */}
          <div className={readOnly ? 'max-w-[720px] mx-auto' : ''}>
            {readOnly ? (
              <h1
                className={`text-[28px] leading-[1.25] font-bold mb-4 break-words ${
                  title.trim() === '' ? 'text-text-quaternary' : ''
                }`}
              >
                {noteTitleLabel(title)}
              </h1>
            ) : (
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="제목 없음"
                aria-label="노트 제목"
                className="w-full bg-transparent text-[28px] leading-[1.25] font-bold placeholder:text-text-tertiary focus:outline-none mb-4"
              />
            )}

            {showTemplateChips && (
              <div className="mb-4" data-testid="template-chips">
                <p className="text-[11px] text-text-quaternary mb-2">
                  템플릿으로 시작하기 — 서식 사용법이 본문에 들어 있어요
                </p>
                <div className="flex flex-wrap gap-2">
                  {STUDY_NOTE_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-line text-xs text-text-secondary hover:border-brand/60 hover:text-text-primary transition-colors"
                    >
                      <span aria-hidden="true">{t.emoji}</span>
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <RichTextEditor
              key={note.id}
              initialContent={note.content}
              onSave={handleBodySave}
              onTextChange={handleTextChange}
              placeholder="정리한 내용을 붙여넣거나 직접 적어 보세요. AI가 정리해 준 마크다운도 서식 그대로 들어와요."
              minHeightClass="min-h-[420px]"
              characterLimit={CONTENT_MAX}
              stickyToolbar="page"
              readOnly={readOnly}
              mention={mention}
              onExportMarkdown={handleExport}
              header={editorSlot}
            />

            <BacklinkPanel items={backlinks} />
          </div>
        </div>

        {/* ── 우측 TOC — 노출 기준 (2026-08-18 CEO 확정):
            편집 = xl(1280+) — 툴바+본문 우선, 좁은 화면에 목차까지 끼우면 그쪽이 불편해진다.
            읽기 = 1120px+ — 본문 최소 612px(한글 38자/줄) 보장선. iPad 가로 전 기종(1080~1366)
            중 1080 만 제외되고 1180·1194·1366 은 포함 — 35자 미만으로 눌리는 폭이 존재하지 않는다. */}
        {toc.length > 0 && (
          <aside
            className={`${readOnly ? 'hidden min-[1120px]:block' : 'hidden xl:block'} w-[180px] shrink-0`}
          >
            {/* 🔴 top-[72px] = 고정 헤더(48px) + 여유 — top-6(24px) 이던 시절엔 스크롤하면
                목차 상단이 헤더 밑으로 미끄러져 들어가 "안 따라오는" 것처럼 보였다 (2026-08-18 실기).
                본문 제목의 scroll-margin(72px)과 같은 선이라 시선 축이 맞는다. */}
            <nav aria-label="목차" className="sticky top-[72px]">
              <div className="text-[10px] font-medium text-text-quaternary uppercase tracking-wider mb-2.5">
                목차
              </div>
              <div className="space-y-1 text-xs border-l border-line">
                {toc.map((item) => {
                  /* 조상 챕터는 은은하게 — 활성(brand)과 3단 구분: 활성 > 조상 > 나머지 */
                  const ancestors = tocAncestorPositions(toc, activePos)
                  const state =
                    activePos === item.pos
                      ? 'border-brand text-brand font-medium'
                      : ancestors.has(item.pos)
                        ? 'border-line-strong text-text-secondary font-medium'
                        : 'border-transparent text-text-quaternary hover:text-text-secondary'
                  return (
                    <button
                      key={item.pos}
                      type="button"
                      onClick={() => {
                        const dom = editor?.view.nodeDOM(item.pos) as HTMLElement | null
                        dom?.scrollIntoView?.({ block: 'start' })
                        setActivePos(item.pos)
                      }}
                      className={`block w-full text-left py-0.5 -ml-px border-l-2 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${tocIndentClass(
                        item.level,
                        Math.min(...toc.map((t) => t.level)),
                      )} ${state}`}
                    >
                      {item.text}
                    </button>
                  )
                })}
              </div>
            </nav>
          </aside>
        )}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="노트 삭제">
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">
          <span className="text-text-primary font-semibold">
            &apos;{noteTitleLabel(title)}&apos;
          </span>{' '}
          노트를 삭제하면 안의 내용도 사라져요. 되돌릴 수 없어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="flex-1 py-2.5 rounded-lg border border-line text-text-secondary text-sm hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-text-primary text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
          >
            삭제
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── 조각들 ───────────────────────────────────────────────────

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
}

function SaveChip({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className={`ml-3 inline-flex items-center gap-1 text-[11px] shrink-0 transition-opacity ${
        state === 'idle' ? 'opacity-0' : 'opacity-100'
      } ${state === 'error' ? 'text-danger' : 'text-text-quaternary'}`}
    >
      {state !== 'error' && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {SAVE_LABEL[state]}
    </span>
  )
}

function DocMenu({
  open,
  onOpenChange,
  onExport,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onExport: () => void
  onDelete: () => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as globalThis.Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="노트 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="w-8 h-8 rounded-lg hover:bg-card-hover text-text-quaternary flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="노트 메뉴"
          className="absolute right-0 top-9 z-20 w-48 rounded-lg bg-surface-2 border border-line-strong shadow-xl py-1 text-[13px]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onExport}
            className="w-full px-3 py-2 text-left text-text-secondary hover:bg-card-hover transition-colors"
          >
            마크다운으로 내보내기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="w-full px-3 py-2 text-left text-danger hover:bg-card-hover transition-colors"
          >
            노트 삭제
          </button>
        </div>
      )}
    </div>
  )
}

/** 백링크 — 「이 노트를 어디서 참조했나」. 출처가 사라진 링크는 서버가 이미 걸러서 온다 */
function BacklinkPanel({ items }: { items: StudyNoteBacklink[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-6 pt-5 border-t border-line">
      <h2 className="text-xs font-medium text-text-secondary mb-2.5">
        이 노트를 참조한 노트 <span className="text-text-quaternary">{items.length}</span>
      </h2>
      <div className="space-y-1.5">
        {items.map((item) => {
          const isPrep = item.fromType === 'prep_sheet'
          const to =
            isPrep && item.applicationId && item.stepId
              ? prepDeepLink({ applicationId: item.applicationId, stepId: item.stepId })
              : `/study-notes/${item.fromId}`
          return (
            <Link
              key={`${item.fromType}:${item.fromId}`}
              to={to}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-card hover:bg-card-hover text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {isPrep ? (
                <span
                  aria-hidden="true"
                  className="w-5 h-5 rounded-[5px] bg-card-strong text-text-tertiary text-[10px] font-bold flex items-center justify-center shrink-0"
                >
                  {companyInitial(item.label)}
                </span>
              ) : (
                <span className="text-[13px] shrink-0" aria-hidden="true">
                  📄
                </span>
              )}
              <span className="flex-1 min-w-0 truncate">{noteTitleLabel(item.label)}</span>
              {/* 출처 뱃지 — 공부=brand · 준비=accent (허브 스트라이프와 같은 색 문법) */}
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                  isPrep ? 'bg-accent/10 text-accent' : 'bg-brand/10 text-brand'
                }`}
              >
                {isPrep ? '준비 노트' : '공부 노트'}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function DocSkeleton() {
  return (
    <div className={PAGE} aria-busy="true">
      <div className="h-4 w-32 rounded bg-card animate-pulse mb-5" />
      <div className="h-8 w-64 rounded bg-card animate-pulse mb-4" />
      <div className="h-9 w-full rounded bg-card animate-pulse mb-4" />
      <div className="h-[420px] w-full rounded-xl bg-card animate-pulse" />
    </div>
  )
}
