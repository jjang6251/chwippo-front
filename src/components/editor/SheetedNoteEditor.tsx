import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { StepNoteEditor } from './StepNoteEditor'
import { NoteSheetTabs } from './NoteSheetTabs'
import { Modal } from '@/components/common/Modal'
import {
  useNoteSheets,
  useCreateNoteSheet,
  useUpdateNoteSheet,
  useDeleteNoteSheet,
  serverMessage,
  serverMessageOrNull,
} from '@/hooks/useStepDetail'
import type { StepNoteSheet } from '@/api/stepDetail'
import { docToMemoValue, type TiptapDoc } from '@/utils/memoSections'
import { notesToPlainText } from '@/utils/stepNotes'
import { toast } from '@/stores/toastStore'

/**
 * 준비 노트 **다중 시트** 컨테이너 — 에디터 한 장 + 아래 탭 줄.
 *
 * ## 🔴 불변식 ① 기존 노트는 건드리지 않는다
 *
 * 시트가 0장인 스텝은 `application_steps.notes` 를 **첫 탭처럼 보여주기만** 한다(가상 시트).
 * 서버에 실제로 만드는 건 **처음 저장이 일어나는 순간** 한 번, `POST … { ifEmpty: true }` 로
 * 복사한다. 원본 `notes` 를 갱신하는 기존 저장 API 는 이 화면에서 **호출하지 않는다** —
 * 복구 자리를 남겨 두기 위해서다(구버전 클라이언트·다른 화면은 그대로 쓴다).
 *
 * `ifEmpty` 라 더블 세이브·멀티탭이 같은 승격을 두 번 보내도 시트는 한 장이다.
 *
 * ## 🔴 불변식 ② 전환하면서 글을 흘리지 않는다
 *
 * `RichTextEditor` 의 자동 저장은 1.5초 debounce 다. 그 타이머는 **언마운트에서 그냥
 * 버려진다** — 지금까지는 페이지를 떠날 때뿐이라 드러나지 않았지만, 시트 전환이 주 동선이
 * 되면 "탭 눌렀더니 마지막 한 문장이 없다" 가 된다.
 *
 * 그래서 컨테이너가 **저장 직전 형태의 값**을 매 입력마다 쥐고 있다가(`pendingRef`),
 * 전환·언마운트 순간 즉시 보낸다. 전환은 응답을 기다리지 않는다 — 실패하면 토스트로
 * 정직하게 알리되 화면은 막지 않는다(입력 자체는 직전 debounce 분까지 서버에 있다).
 */

/** 아직 서버에 없는 첫 시트(기존 노트 폴백)의 자리 표시 id */
const DRAFT_ID = '__draft__'
const FIRST_SHEET_NAME = '준비 노트'
/** 서버 캡(`MAX_SHEETS_PER_STEP`)과 같은 값 — 넘으면 400 이라 [+] 를 미리 잠근다 */
const MAX_SHEETS = 10

interface Props {
  appId: string
  stepId: string
  stepName: string
  /**
   * 시트가 0장일 때 첫 탭에 보일 기존 노트. 호출부가 `mergePinnedIntoNotes` 를 통과시킨
   * 값을 준다 (죽은 📌 핵심 메모까지 그대로 승격되도록).
   */
  fallbackContent: string | null
  /**
   * 활성 시트의 본문(plain text). 전환·입력마다 흐른다.
   * 「이 내용으로 면접 질문 만들기」 다리가 쓴다 — **활성 시트만** 넘긴다(CEO 결정).
   */
  onActiveTextChange?: (plainText: string) => void
  /**
   * 활성 시트의 tiptap 인스턴스를 바깥으로 알린다 — 노트 AI 패널·버블 메뉴가 쓴다.
   * 시트 전환마다 에디터가 remount 되므로 **다시 불린다** (받는 쪽이 갈아 끼워야 한다).
   */
  onEditorReady?: (editor: Editor) => void
  /** 지정 시 툴바 맨 앞 AI 버튼 (모바일의 유일한 진입점) */
  onAiOpen?: () => void
}

interface TabModel {
  id: string
  name: string
  content: string | null
}

export function SheetedNoteEditor({
  appId,
  stepId,
  stepName,
  fallbackContent,
  onActiveTextChange,
  onEditorReady,
  onAiOpen,
}: Props) {
  const { data: sheets = [], isLoading } = useNoteSheets(appId, stepId)
  const create = useCreateNoteSheet(appId, stepId)
  const update = useUpdateNoteSheet(appId, stepId)
  const remove = useDeleteNoteSheet(appId, stepId)

  /** 사용자가 **명시적으로 고른** 탭. null = 아직 안 골랐다 → 목록의 첫 장 */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StepNoteSheet | null>(null)

  const promoted = sheets.length > 0
  const tabs: TabModel[] = promoted
    ? sheets.map((s) => ({ id: s.id, name: s.name, content: s.content }))
    : [{ id: DRAFT_ID, name: FIRST_SHEET_NAME, content: fallbackContent }]
  const active = tabs.find((t) => t.id === selectedId) ?? tabs[0]

  /**
   * 🔴 에디터 remount 키가 **활성 시트 id 가 아니다.** 승격(가상 → 진짜)에서 id 는 바뀌지만
   * 보고 있는 글은 그대로다 — id 를 키로 쓰면 저장 1.5초 뒤 커서가 튀고 쓰던 자리를 잃는다.
   * 그래서 **사용자가 탭을 고를 때만** 바뀌는 값으로 remount 한다.
   * (tiptap 은 `content` 를 초기화 때만 읽어서, 키 없이 prop 만 갈면 남의 시트를 덮어쓴다.)
   */
  const mountKey = `${stepId}|${selectedId ?? 'first'}`

  // 콜백·flush 가 항상 최신 값을 보게 — 렌더마다 갱신 (ref 는 반응형이 아니라 deps 밖)
  const activeIdRef = useRef(active.id)
  activeIdRef.current = active.id
  const activeContentRef = useRef(active.content)
  activeContentRef.current = active.content
  const onTextRef = useRef(onActiveTextChange)
  onTextRef.current = onActiveTextChange

  /** 아직 서버에 못 보낸 최신 본문(저장 형태). null = 보낼 것 없음 */
  const pendingRef = useRef<string | null>(null)
  const editorRef = useRef<Editor | null>(null)
  /**
   * 자동 저장 400 문구를 **한 번만** 띄우기 위한 마지막 문구 (저장 성공 시 초기화).
   * 재시도가 1.5초마다 도니 dedupe 없이는 같은 토스트가 쌓인다.
   */
  const lastSaveErrorRef = useRef<string | null>(null)

  /**
   * 🔴 **매 입력마다 저장 형태로 떠 둔다.** flush 시점에 doc 을 읽으려 하면, 언마운트에선
   * tiptap 이 이미 destroy 된 뒤일 수 있다. 값을 미리 쥐고 있으면 순서에 기대지 않는다.
   */
  function handleTextChange(plain: string) {
    const editor = editorRef.current
    if (editor) {
      pendingRef.current = editor.isEmpty
        ? ''
        : docToMemoValue(editor.getJSON() as TiptapDoc)
    }
    onTextRef.current?.(plain)
  }

  /** 승격(가상 시트) 또는 일반 저장. 호출부가 sheetId 를 **명시**한다 — 전환 뒤 남의 시트에 쓰지 않게 */
  async function persist(sheetId: string, value: string): Promise<void> {
    if (sheetId === DRAFT_ID) {
      // 201(방금 만듦)·200(이미 있었음) 무관 — 반환 시트가 첫 탭이 된다(캐시 upsert)
      await create.mutateAsync({ name: FIRST_SHEET_NAME, content: value, ifEmpty: true })
      return
    }
    await update.mutateAsync({ sheetId, content: value })
  }

  /** RichTextEditor 의 1.5s 자동 저장 */
  async function handleSave(value: string): Promise<void> {
    const sheetId = activeIdRef.current
    pendingRef.current = null
    try {
      await persist(sheetId, value)
      lastSaveErrorRef.current = null
    } catch (err) {
      // 전환 flush 가 재시도한다 + RichTextEditor 의 「저장 실패」 라벨을 살린다
      pendingRef.current = value
      /*
        🔴 「저장 실패」 라벨만으로는 **무엇을 줄여야 하는지** 알 수 없다 (2026-09-02 —
        글자수 상한 400 이 라벨 하나로 뭉개졌다). 서버가 이유를 말해 준 실패만 그 문구
        그대로 띄운다 — 네트워크·5xx 는 지금처럼 라벨만.
        승격(DRAFT) 경로는 `useCreateNoteSheet.onError` 가 이미 같은 문구를 띄우므로 뺀다.
      */
      if (sheetId !== DRAFT_ID) {
        const message = serverMessageOrNull(err)
        if (message !== null && message !== lastSaveErrorRef.current) {
          lastSaveErrorRef.current = message
          toast.error(message)
        }
      }
      throw err
    }
  }

  /** 전환·언마운트 직전 미저장분 즉시 전송. **기다리지 않는다** — 전환을 막지 않는다 */
  function flush(): void {
    const value = pendingRef.current
    if (value === null) return
    const sheetId = activeIdRef.current
    pendingRef.current = null
    void persist(sheetId, value).catch(() => {
      toast.error('시트를 넘기기 전 저장에 실패했어요. 직전 자동 저장 시점까지만 남아 있어요.')
    })
  }

  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => flushRef.current(), [])

  /**
   * 다리 버튼이 보는 텍스트를 **활성 시트로 갈아 끼운다.** 전환했는데 직전 시트의 글이
   * 그대로 넘어가면, 사용자는 눈앞에 없는 내용으로 질문이 만들어지는 걸 보게 된다.
   */
  useEffect(() => {
    if (isLoading) return
    onTextRef.current?.(notesToPlainText(activeContentRef.current))
  }, [mountKey, isLoading])

  function selectSheet(id: string): void {
    if (id === active.id) return
    flush()
    setRenamingId(null)
    setSelectedId(id)
  }

  async function addSheet(): Promise<void> {
    if (create.isPending || sheets.length >= MAX_SHEETS) return
    // 승격 직후엔 시트가 1장이 되어 있다 (아래 mutateAsync 뒤 sheets 는 아직 옛 값)
    const nextIndex = (promoted ? sheets.length : 1) + 1
    try {
      if (promoted) {
        flush()
      } else {
        /*
          🔴 **먼저 승격시킨다.** 폴백은 "시트 0장" 일 때만 뜨므로, 승격 없이 새 시트를
          만들면 그 순간 기존 노트가 탭 줄에서 통째로 사라진다 (서버엔 남아 있지만
          화면에서 사라지는 건 사용자에겐 소실이다).
        */
        await create.mutateAsync({
          name: FIRST_SHEET_NAME,
          content: pendingRef.current ?? fallbackContent ?? '',
          ifEmpty: true,
        })
        pendingRef.current = null
      }
      const sheet = await create.mutateAsync({ name: `시트 ${nextIndex}` })
      setSelectedId(sheet.id)
      setRenamingId(sheet.id) // 만들자마자 이름 짓기 — 엑셀 문법
    } catch {
      // 서버 문구 토스트는 훅(onError)이 낸다. 실패했으면 전환하지 않는다.
    }
  }

  function renameSheet(id: string, name: string): void {
    if (id === DRAFT_ID) {
      // 아직 서버에 없다 — 이름을 붙이려면 그 이름으로 승격시킨다
      const content = pendingRef.current ?? fallbackContent ?? ''
      pendingRef.current = null
      create.mutate({ name, content, ifEmpty: true })
      return
    }
    update.mutate(
      { sheetId: id, name },
      { onError: (err) => toast.error(serverMessage(err, '시트 이름을 바꾸지 못했어요.')) },
    )
  }

  function requestDelete(id: string): void {
    const sheet = sheets.find((s) => s.id === id)
    if (!sheet || sheets.length <= 1) return
    /*
      확인창은 **잃을 게 있을 때만**. 빈 시트를 지우는 데 한 번 더 묻는 건 저위험 동작을
      막아서는 것이고, 매번 묻는 확인창은 결국 안 읽힌다.
    */
    if (notesToPlainText(sheet.content).trim()) {
      setPendingDelete(sheet)
      return
    }
    void deleteSheet(sheet)
  }

  async function deleteSheet(sheet: StepNoteSheet): Promise<void> {
    setPendingDelete(null)
    const idx = sheets.findIndex((s) => s.id === sheet.id)
    const neighbor = sheets[idx - 1] ?? sheets[idx + 1] ?? null
    const wasActive = sheet.id === active.id
    // 지우기로 한 글을 flush 가 되살려 저장하면 안 된다
    if (wasActive) pendingRef.current = null
    try {
      await remove.mutateAsync(sheet.id)
      if (wasActive) setSelectedId(neighbor?.id ?? null)
    } catch {
      // 서버 문구 토스트는 훅(onError)이 낸다
    }
  }

  if (isLoading) {
    return (
      <div aria-busy="true">
        {/* 자리 순서가 실제와 같아야 로드 후 화면이 안 튄다 (탭 줄 → 에디터) */}
        <div className="flex gap-1 px-2">
          <div className="h-9 w-24 rounded-t-lg bg-card animate-pulse" />
          <div className="h-9 w-9 rounded-t-lg bg-card animate-pulse" />
        </div>
        <div className="h-[420px] rounded-xl border border-line-strong bg-card-solid shadow-sm animate-pulse" />
      </div>
    )
  }

  const panelId = `note-panel-${stepId}`

  return (
    <div>
      {/*
        탭 줄이 **위**다 (CEO 실기 판단 2026-08-11). 노트는 세로로 긴 문서라 아래에 두면
        쓰는 동안 탭이 화면 밖으로 밀려나, 시트를 바꾸려고 끝까지 스크롤해 내려가야 했다.
        DOM 순서도 그대로 위 — 탭을 먼저 만나고 내용을 만나는 게 낭독 순서로도 맞다.
      */}
      <NoteSheetTabs
        sheets={tabs}
        activeId={active.id}
        onSelect={selectSheet}
        onAdd={() => void addSheet()}
        onRename={renameSheet}
        onDelete={requestDelete}
        renamingId={renamingId}
        onRenamingChange={setRenamingId}
        atCap={sheets.length >= MAX_SHEETS}
        adding={create.isPending}
        canDelete={promoted && sheets.length > 1}
        panelId={panelId}
      />

      <div role="tabpanel" id={panelId} aria-labelledby={`sheet-tab-${active.id}`}>
        <StepNoteEditor
          key={mountKey}
          stepName={stepName}
          initialContent={active.content}
          onSave={handleSave}
          onTextChange={handleTextChange}
          editorRef={editorRef}
          onEditorReady={onEditorReady}
          onAiOpen={onAiOpen}
        />
      </div>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="시트 삭제"
      >
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">
          <span className="text-text-primary font-semibold">
            &apos;{pendingDelete?.name}&apos;
          </span>{' '}
          시트를 삭제하면 안의 내용도 사라져요. 되돌릴 수 없어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="flex-1 py-2.5 rounded-lg border border-line text-text-secondary text-sm hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => pendingDelete && void deleteSheet(pendingDelete)}
            disabled={remove.isPending}
            className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-text-primary text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            삭제
          </button>
        </div>
      </Modal>
    </div>
  )
}
