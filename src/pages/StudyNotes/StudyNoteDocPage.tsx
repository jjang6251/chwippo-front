import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import type { StudyNoteBacklink, StudyNoteListItem } from '@/api/studyNotes'
import { Modal } from '@/components/common/Modal'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { editorToMarkdown } from '@/components/editor/markdownIO'
import { uploadNoteImage } from '@/components/editor/noteImageUpload'
import type { StudyNoteMentionOptions } from '@/components/editor/StudyNoteMention'
import { AiNoteBubbleMenu } from '@/components/ai-note/AiNoteBubbleMenu'
import { AiNotePanel } from '@/components/ai-note/AiNotePanel'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useMenuKeyboard } from '@/hooks/useMenuKeyboard'
import { useInvalidateStorageUsage } from '@/hooks/useStorageUsage'
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
import { isInNativeApp } from '@/utils/nativeBridge'
import {
  countDetails,
  extractToc,
  setAllDetailsOpen,
  tocAncestorPositions,
  tocIndentClass,
  tocLevelClass,
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
 *
 * 🔴 **「비었다」는 글자 수가 아니다.** 이미지 한 장만 올려 둔 노트는 텍스트가 0자다 —
 * 판정이 글자만 보면 그 노트는 떠나는 순간 삭제되고, 저장 값도 `''` 로 나가 이미지가
 * 먼저 날아간다. 두 갈래 모두 미디어 노드를 「내용 있음」으로 세는 한 곳에 걸려 있다:
 * 본문 판정은 `editor.isEmpty`(atom 노드를 내용으로 센다), 저장 값은
 * `docToMemoValue` → `isEmptyDoc`(`utils/memoSections.ts` 의 `MEDIA_NODE_TYPES`).
 *
 * ## PDF 는 브라우저 인쇄다 (study-note-media PR-B)
 *
 * 「PDF로 저장」은 인쇄 다이얼로그의 목적지 하나일 뿐이라 PDF 라이브러리가 없다. 대신
 * **화면을 종이로 바꿔 놓는 일**을 셋으로 나눠서 한다 —
 *   ① 파일명: 브라우저가 `document.title` 을 PDF 이름으로 쓴다 (md 내보내기와 같은 정제 규칙)
 *   ② 색: 다크로 보던 사람이 그냥 인쇄하면 검은 종이가 나온다 → `data-theme='light'` 강제
 *   ③ 크롬: 사이드바·툴바·목차 등은 각 요소의 `print:hidden` 이 지운다 (선택자 추측 금지)
 * 접힌 토글 펼치기·여백·페이지 넘김은 `index.css` 의 `@media print` 절이 맡는다.
 *
 * 🔴 ①②는 **되돌려 놓는 것까지가 한 벌**이다. 복원을 놓치면 탭 제목과 테마가 영영 바뀐
 * 채로 남는다 — 그래서 되돌릴 값을 한 번만 잡고 `afterprint`·예외·언마운트 세 경로에서
 * 모두 되돌린다.
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

/** 이미지는 공부 노트 전용 (plan §1 PR-A) — 매 렌더 새 객체를 만들지 않게 모듈 상수로 */
const IMAGE_ON = { image: true } as const

/**
 * 파일 이름으로 쓸 노트 제목 — 마크다운 내보내기와 PDF 저장이 **같은 규칙**을 쓴다
 * (확장자만 다르다). 파일 시스템이 못 받는 문자는 `_`, 빈 제목은 폴백.
 */
function noteFileBase(title: string): string {
  return (title.trim() || '공부 노트').replace(/[\\/:*?"<>|]/g, '_')
}

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
  /**
   * 노트 AI 패널. 🔴 **라우트 안에서만 산다** — 다른 노트로 옮기거나 새로고침하면
   * 히스토리가 사라진다 (plan D6). 여기서 여닫기만 들고, 대화는 패널이 들고 있다.
   */
  const [aiOpen, setAiOpen] = useState(false)
  const aiEnabled = useAiEnabled()

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

  /**
   * 본문 이미지 업로드 — 압축·발급·PUT·첨부 등록·실패 안내는 전부 `uploadNoteImage` 안이다.
   * 여기서 하는 일은 둘: **이 노트 id 를 묶어 주고**(공용 에디터는 자기가 어느 문서인지
   * 모른다), 성공하면 **저장 용량 캐시를 무효화**한다.
   *
   * 🔴 무효화가 **여기** 있는 이유 — `uploadNoteImage` 는 훅을 쓸 수 없는 순수 함수다
   * (붙여넣기·드롭·툴바 세 진입이 공유하고, spec 도 react-query 없이 돈다). 캐시를 아는
   * 층은 화면이라 호출부가 진다. 실패하면 쓴 바이트도 없으니 성공 경로에서만 민다.
   *
   * 🔴 무효화를 **기다리지 않는다** — 여기서 await 하면 자리 표시가 이미지로 바뀌는 게
   * 용량 재조회만큼 늦어진다. 숫자는 조금 뒤에 따라오면 된다.
   */
  const invalidateStorageUsage = useInvalidateStorageUsage()
  const uploadImage = useCallback(
    async (file: File) => {
      const image = await uploadNoteImage(id, file)
      void invalidateStorageUsage()
      return image
    },
    [id, invalidateStorageUsage],
  )

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

  /* 언마운트 정리(flush·빈 노트 삭제)와 인쇄 리스너가 **마지막 값**을 보게 — 쓰기는 렌더 밖에서 한다 */
  const removeRef = useRef(remove)
  const flushRef = useRef(flush)
  const titleRef = useRef(title)
  useEffect(() => {
    removeRef.current = remove
    flushRef.current = flush
    titleRef.current = title
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

  // ── 인쇄(PDF로 저장) 준비·복원 ─────────────────────────────
  /** 인쇄 동안 바꿔 둔 값의 원본. `null` = 지금 인쇄 중이 아니다 */
  const printRestoreRef = useRef<{ theme: string | null; title: string } | null>(null)

  const applyPrintChrome = useCallback(() => {
    /*
      🔴 이미 걸려 있으면 **원본을 다시 잡지 않는다.** 메뉴에서 직접 한 번 걸고 곧이어
      `beforeprint` 가 또 오는데(브라우저가 print() 안에서 발화), 그때 다시 잡으면
      「이전 값」이 light·노트 제목으로 굳어 복원이 복원이 아니게 된다.
    */
    if (printRestoreRef.current) return
    const root = document.documentElement
    printRestoreRef.current = { theme: root.getAttribute('data-theme'), title: document.title }
    // 새 색을 정의하지 않는다 — `:root[data-theme='light']` 팔레트가 통째로 그대로 걸린다
    root.setAttribute('data-theme', 'light')
    // 브라우저는 PDF 파일명을 여기서 가져간다 (확장자는 브라우저가 붙인다)
    document.title = noteFileBase(titleRef.current)
  }, [])

  const restorePrintChrome = useCallback(() => {
    const prev = printRestoreRef.current
    if (!prev) return
    printRestoreRef.current = null
    const root = document.documentElement
    // 🔴 속성이 **없던** 상태와 `'dark'` 는 다르다 (미지정 = 다크 fallback · tailwind darkMode 배선)
    if (prev.theme === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prev.theme)
    document.title = prev.title
  }, [])

  useEffect(() => {
    /* 메뉴뿐 아니라 Ctrl/⌘+P 로 들어와도 같은 종이가 나오게 — 발화원을 가리지 않는다 */
    window.addEventListener('beforeprint', applyPrintChrome)
    window.addEventListener('afterprint', restorePrintChrome)
    return () => {
      window.removeEventListener('beforeprint', applyPrintChrome)
      window.removeEventListener('afterprint', restorePrintChrome)
      // 인쇄 중 이탈 — 안 되돌리면 다른 화면에서 탭 제목이 노트 제목인 채로 굳는다
      restorePrintChrome()
    }
  }, [applyPrintChrome, restorePrintChrome])

  // ── TOC · 토글 일괄 ───────────────────────────────────────
  const [toc, setToc] = useState<TocItem[]>([])
  const [details, setDetails] = useState({ total: 0, open: 0 })
  const [activePos, setActivePos] = useState<number | null>(null)

  /**
   * 목차 내부 스크롤 따라오기 (2026-08-19) — 활성 항목이 목차의 스크롤 밖이면 목차만 굴린다.
   * 🔴 scrollIntoView 는 조상 전부를 굴려 **본문까지 튄다** — 컨테이너 scrollTop 수동 보정만
   */
  useEffect(() => {
    if (activePos === null) return
    const nav = document.querySelector('[data-toc-nav]')
    const item = nav?.querySelector(`[data-toc-pos="${activePos}"]`)
    if (!nav || !(item instanceof HTMLElement)) return
    const navRect = nav.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    if (itemRect.top < navRect.top) nav.scrollTop += itemRect.top - navRect.top - 8
    else if (itemRect.bottom > navRect.bottom) nav.scrollTop += itemRect.bottom - navRect.bottom + 8
  }, [activePos])

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
        /* 기준선 = 화면 42% — 착지점(scroll-margin 38vh) 바로 아래라 클릭 직후에도
           그 제목이 활성으로 잡힌다. "지금 읽는 위치(중상단)" 감각과도 일치 (2026-08-19 CEO) */
        const baseline = window.innerHeight * 0.42
        for (const item of toc) {
          const dom = editor.view.nodeDOM(item.pos) as HTMLElement | null
          const top = dom?.getBoundingClientRect?.().top ?? Number.POSITIVE_INFINITY
          if (top <= baseline) current = item.pos
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
    if (next === 'read') {
      flush()
      // 읽기 모드엔 적용할 자리가 없다 — 결과만 띄워 두면 누를 수 없는 버튼이 된다
      setAiOpen(false)
    }
    setMode(next)
    saveNoteMode(next)
  }

  function toggleAllDetails() {
    if (!editor) return
    setAllDetailsOpen(editor, details.open === 0)
  }

  /**
   * 인쇄 실행 — 준비(제목·테마)를 걸고 다이얼로그를 연다.
   *
   * 정상 경로의 복원은 `afterprint` 가 맡는다 (Chrome 은 `print()` 가 반환하기 전에 발화,
   * Safari 는 다이얼로그가 닫힌 뒤 발화). 여기서 되돌리는 건 **인쇄 창 자체를 못 연**
   * 경우뿐이다 — 그냥 두면 탭 제목·테마가 바뀐 채로 남는다.
   */
  function runPrint() {
    applyPrintChrome()
    try {
      window.print()
    } catch {
      restorePrintChrome()
    }
  }

  function handlePrint() {
    setMenuOpen(false)
    /*
      🔴 편집 모드 그대로 인쇄하면 제목이 **입력 필드**로 찍히고 본문 폭도 읽기와 다르다.
      `switchMode('read')` 가 미저장분 flush·AI 패널 닫기까지 이미 해 주므로 그대로 쓴다.
    */
    switchMode('read')
    /*
      전환 렌더가 끝난 뒤에 인쇄한다. 클릭 핸들러 안의 setState 는 이벤트 끝에 동기 커밋되니
      첫 rAF 시점엔 DOM 이 이미 읽기 모드고, 한 프레임 더 양보하는 건 그 DOM 의 레이아웃이
      잡힌 뒤에 인쇄 스냅샷이 뜨게 하는 여유다 (편집 툴바가 사라지며 본문이 위로 올라온다).
    */
    requestAnimationFrame(() => requestAnimationFrame(runPrint))
  }

  function handleExport(markdown: string) {
    const filename = `${noteFileBase(title)}.md`
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
    // 🔴 패널은 fixed 라 그냥 두면 본문을 덮는다 — 열릴 때 우측 380px 을 비워 밀어낸다
    //    (2026-08-19 CEO 실기 "패널이 노트를 가린다"). PAGE 의 px 와 충돌하지 않게 바깥 래퍼에
    <div className={`transition-[padding] duration-200 ${aiOpen ? 'lg:pr-[380px]' : ''}`}>
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

        {/* 모드 탭·토글 일괄·⋯ 메뉴 — 종이에서는 누를 수 없는 것들이라 통째로 뺀다 */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
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
            /*
              🔴 앱(WebView)에서는 항목 자체가 없다 — WKWebView 는 `window.print()` 가
              무동작이라 띄워 두면 눌러도 아무 일이 없는 거짓 어포던스가 된다.
              네이티브 print 브리지는 후속 PR (plan §2 Out of Scope).
            */
            onPrint={isInNativeApp() ? undefined : handlePrint}
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
          {/* 읽기 모드 = 65자 가독 폭 (편집은 현행 유지).
              🔴 종이에서는 푼다 — 65자 폭은 화면에서 눈이 줄을 잃지 않게 하는 값이고,
              지면은 이미 `@page` 여백이 그 역할을 한다. 남겨 두면 오른쪽이 통째로 빈다. */}
          <div className={readOnly ? 'max-w-[720px] mx-auto print:max-w-none print:mx-0' : ''}>
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
              <div className="mb-4 print:hidden" data-testid="template-chips">
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
              /*
                🔴 앱(WebView)에서는 PDF 를 안 준다 — 위 DocMenu 의 `onPrint` 와 **같은 근거·
                같은 조건**(WKWebView 는 window.print() 가 무동작 = 거짓 어포던스).
                그러면 툴바 「내보내기」는 형식이 하나뿐이라 메뉴 없이 곧장 마크다운이 된다.
                인쇄 준비(읽기 전환·탭 제목·테마)는 `handlePrint` 를 그대로 재사용한다.
              */
              onExportPdf={isInNativeApp() ? undefined : handlePrint}
              onAiOpen={aiEnabled && !readOnly ? () => setAiOpen(true) : undefined}
              aiEntryMobileOnly
              header={editorSlot}
              /* 이미지는 공부 노트에서만 — 준비·활동·회사 메모는 기본 off 그대로다 */
              features={IMAGE_ON}
              onUploadImage={uploadImage}
            />

            {/* 드래그 → 「AI」 (데스크탑). 모바일은 툴바 버튼이 같은 자리를 대신한다 */}
            {aiEnabled && !readOnly && editor && (
              <AiNoteBubbleMenu editor={editor} onOpen={() => setAiOpen(true)} />
            )}

            <BacklinkPanel items={backlinks} />
          </div>
        </div>

        {/* ── 우측 TOC — 노출 기준 (2026-08-18 CEO 확정):
            편집 = xl(1280+) — 툴바+본문 우선, 좁은 화면에 목차까지 끼우면 그쪽이 불편해진다.
            읽기 = 1120px+ — 본문 최소 612px(한글 38자/줄) 보장선. iPad 가로 전 기종(1080~1366)
            중 1080 만 제외되고 1180·1194·1366 은 포함 — 35자 미만으로 눌리는 폭이 존재하지 않는다. */}
        {/* 🔴 AI 패널이 열리면 목차가 자리를 양보한다 — 우측 380px 을 둘이 나눠 가지면
            본문이 읽기 폭 아래로 눌린다. 닫으면 그대로 돌아온다 (plan UIUX ①). */}
        {/* 레일 노출: AI 버튼(편집+AI on)은 lg+, 목차는 기존 기준 유지 (편집 xl / 읽기 1120px).
            레일 자체가 안 뜨는 조합(읽기+목차 없음 등)은 통째로 생략 */}
        {!aiOpen && ((aiEnabled && !readOnly) || toc.length > 0) && (
          <aside
            className={`${
              aiEnabled && !readOnly
                ? 'hidden lg:block'
                : readOnly
                  ? 'hidden min-[1120px]:block'
                  : 'hidden xl:block'
            } w-[180px] shrink-0 print:hidden`}
          >
            {/* 🔴 top-[72px] = 고정 헤더(48px) + 여유 — top-6(24px) 이던 시절엔 스크롤하면
                목차 상단이 헤더 밑으로 미끄러져 들어가 "안 따라오는" 것처럼 보였다 (2026-08-18 실기).
                본문 제목의 scroll-margin(72px)과 같은 선이라 시선 축이 맞는다. */}
            <div className="sticky top-[72px] space-y-4">
              {/* 🔴 레일 AI 버튼 — "툴바 ✦ 는 안 보인다" (2026-08-19 CEO 실기). 데스크탑 주 진입.
                  드래그 버블과 병존 — 이건 무선택 생성·발견성 담당 */}
              {aiEnabled && !readOnly && (
                <button
                  type="button"
                  data-testid="ai-rail-open"
                  onClick={() => setAiOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand text-bg text-xs font-semibold shadow-sm hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                >
                  <span aria-hidden="true">✦</span>
                  AI 도움
                </button>
              )}
              {toc.length > 0 && (
            /* 내부 스크롤 — 학습 문서(제목 60개+)에서 목차가 뷰포트를 넘는다 (2026-08-19).
               max-h = 화면 − sticky top(72) − 하단 여유. 활성 따라오기는 activePos effect */
            <nav
              aria-label="목차"
              data-toc-nav
              className={`max-h-[calc(100vh-120px)] overflow-y-auto overscroll-contain ${
                aiEnabled && !readOnly ? 'hidden xl:block' : ''
              }`}
            >
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
                      data-toc-pos={item.pos}
                      className={`block w-full text-left py-0.5 -ml-px border-l-2 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${tocIndentClass(
                        item.level,
                        Math.min(...toc.map((t) => t.level)),
                      )} ${tocLevelClass(
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
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 🔴 닫아도 언마운트하지 않는다 — 히스토리가 `open` 보다 위에 있어야 유지된다 */}
      <AiNotePanel
        editor={editor}
        resource={{ type: 'study_note', noteId: id }}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />

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
      className={`ml-3 inline-flex items-center gap-1 text-[11px] shrink-0 transition-opacity print:hidden ${
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
  onPrint,
  onExport,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 없으면 「PDF로 저장」 항목을 아예 그리지 않는다 (앱 웹뷰) */
  onPrint?: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const menuBoxRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  /* ESC · 화살표 이동 · 닫힘 포커스 복귀는 `useMenuKeyboard` 가 진다 (세 메뉴 공용) */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as globalThis.Node)) onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onOpenChange])

  const { markOpenedByKeyboard } = useMenuKeyboard({
    open,
    menuRef: menuBoxRef,
    triggerRef,
    onClose: () => onOpenChange(false),
  })

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="노트 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // detail===0 = 키보드로 발생한 click → 첫 항목 포커스 (마우스면 안 준다)
          markOpenedByKeyboard(e.detail === 0)
          onOpenChange(!open)
        }}
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
          ref={menuBoxRef}
          role="menu"
          aria-label="노트 메뉴"
          className="absolute right-0 top-9 z-20 w-48 rounded-lg bg-surface-2 border border-line-strong shadow-xl py-1 text-[13px]"
        >
          {onPrint && (
            <button
              type="button"
              role="menuitem"
              onClick={onPrint}
              className="w-full px-3 py-2 text-left text-text-secondary hover:bg-card-hover transition-colors"
            >
              PDF로 저장
            </button>
          )}
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
