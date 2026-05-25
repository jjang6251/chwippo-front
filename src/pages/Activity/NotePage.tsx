import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from '@/stores/toastStore'
import { useActivities, useUpdateLog } from '@/hooks/useActivities'
import type { ActivityLog } from '@/types/activity'
import { AISummarySection } from './AISummarySection'
import { LogDetailModal } from './modals/LogDetailModal'
import { NoteEditor, type NoteEditorHandle, type SaveState } from './NoteEditor'
import { CAT_KO, CL_LABEL, COMP_KO, MOOD_EM } from './constants'
import { extractNoteText } from './utils'
import './activity-mock.css'

/** body·title 두 저장 상태를 시각적으로 합침 — 더 "활성" 한 쪽 우선 */
function mergeSaveState(a: SaveState, b: SaveState): SaveState {
  const order: SaveState[] = ['error', 'saving', 'saved', 'idle']
  return order.find((s) => a === s || b === s) ?? 'idle'
}

/** Tiptap note JSON 에 실제 텍스트 content 가 있는지 (비었으면 진입 모드 = edit) */
function hasNoteContent(note: Record<string, unknown> | null): boolean {
  if (!note) return false
  const walk = (n: unknown): boolean => {
    if (!n || typeof n !== 'object') return false
    const obj = n as Record<string, unknown>
    if (typeof obj.text === 'string' && obj.text.trim() !== '') return true
    const content = obj.content
    if (Array.isArray(content)) return content.some(walk)
    return false
  }
  return walk(note)
}

/** epoch ms 차이를 "방금" / "N분 전" / "N시간 전" / "N일 전" 으로 */
function formatRelativeSince(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  if (diff < 5_000) return '방금'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}초 전`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  return `${Math.floor(diff / 86_400_000)}일 전`
}

export function NotePage() {
  const { activityId = '', logId = '' } = useParams<{
    activityId: string
    logId: string
  }>()
  const navigate = useNavigate()
  const { data: activities = [], isLoading } = useActivities(true)
  const update = useUpdateLog(activityId)

  const activity = useMemo(
    () => activities.find((a) => a.id === activityId) ?? null,
    [activities, activityId],
  )
  const log = useMemo(
    () =>
      activity?.logs?.find((l) => l.id === logId) ??
      activities.flatMap((a) => a.logs ?? []).find((l) => l.id === logId) ??
      null,
    [activity, activities, logId],
  )

  // 모바일(≤920px) 에선 default collapsed, 데스크탑은 항상 보임 (CSS 가 처리)
  // 사용자가 모바일에서 expand 한 후 데스크탑으로 resize → expanded 상태 유지 (CSS 가 무시하고 보여줌)
  // 데스크탑에서 모바일로 resize → toggle 버튼 등장, 마지막 상태 그대로
  // 보기/편집 모드 토글 (mock 의 np-mode-seg, Cmd+E)
  // 진입 시 — note 본문 있으면 view 모드, 없으면 edit (mock 5683 동일)
  // log.id 변경 시마다 재평가 (다른 로그로 진입 시 모드 다시 결정)
  const [mode, setMode] = useState<'view' | 'edit'>('edit')
  const [metaExpanded, setMetaExpanded] = useState(
    typeof window !== 'undefined' && window.innerWidth > 920,
  )
  useEffect(() => {
    const onResize = () => {
      // 데스크탑 폭이면 항상 expanded 로 동기화 (CSS 와 일관)
      if (window.innerWidth > 920) setMetaExpanded(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [editMetaOpen, setEditMetaOpen] = useState(false)
  // 에디터 plain text 길이 (AI 요약 활성 조건)
  const [textLen, setTextLen] = useState(0)
  // 저장 상태 — body·title 합쳐 표시
  const [bodySave, setBodySave] = useState<SaveState>('idle')
  const [titleSave, setTitleSave] = useState<SaveState>('idle')
  const combinedSave = mergeSaveState(bodySave, titleSave)
  // 마지막 성공 저장 시각 — "✓ 저장됨 · 방금/N분 전" 표시용. 한 번 저장되면 계속 유지
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  // body·title 가 'saved' 로 전이될 때 lastSavedAt 갱신
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장 상태 변화 감지 후 timestamp 기록 (외부 시계 동기화)
    if (bodySave === 'saved') setLastSavedAt(Date.now())
  }, [bodySave])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 동일 — title 저장도 같은 lastSavedAt 갱신
    if (titleSave === 'saved') setLastSavedAt(Date.now())
  }, [titleSave])
  // 상대 시간 표시 갱신용 tick (20초마다)
  const [, setNowTick] = useState(0)
  useEffect(() => {
    if (lastSavedAt === null) return
    const id = setInterval(() => setNowTick((n) => n + 1), 20_000)
    return () => clearInterval(id)
  }, [lastSavedAt])
  // 제목 (log.content) 인라인 편집 — contentEditable 가 매 렌더마다 reset 되지 않도록 ref
  const titleRef = useRef<HTMLDivElement | null>(null)
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titlePendingRef = useRef<(() => Promise<void>) | null>(null)
  const editorRef = useRef<NoteEditorHandle | null>(null)

  /** 닫기·뒤로가기·모드 전환 직전 호출 — body·title pending debounce 둘 다 강제 flush */
  async function flushAllPending() {
    const tasks: Array<Promise<void>> = []
    // title
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current)
      titleDebounceRef.current = null
      const pending = titlePendingRef.current
      if (pending) {
        titlePendingRef.current = null
        tasks.push(pending())
      }
    }
    // body
    if (editorRef.current) tasks.push(editorRef.current.flush())
    if (tasks.length) await Promise.all(tasks)
  }

  // body scroll lock + ESC 닫기 + beforeunload flush (탭 닫기·새로고침)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editMetaOpen) handleClose()
      // Cmd/Ctrl + E → 보기·편집 토글
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        void toggleMode()
      }
    }
    const onBeforeUnload = () => {
      // sync 호출만 가능 — pending timer 즉시 trigger (브라우저가 fetch keepalive 로 보냄)
      if (titleDebounceRef.current && titlePendingRef.current) {
        clearTimeout(titleDebounceRef.current)
        void titlePendingRef.current()
      }
      void editorRef.current?.flush()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMetaOpen])

  async function handleClose() {
    await flushAllPending()
    navigate('/activity')
  }

  async function toggleMode() {
    const next: 'view' | 'edit' = mode === 'view' ? 'edit' : 'view'
    if (next === 'view') {
      // view 진입 직전 강제 저장 (mock 5713-5717 동일)
      await flushAllPending()
    }
    setMode(next)
    editorRef.current?.setEditable(next === 'edit')
  }

  async function handleSave(note: Record<string, unknown>) {
    if (!log) return
    await update.mutateAsync({ logId: log.id, dto: { note } })
  }

  // log.id 변경 시 (다른 로그로 진입) 제목 영역 초기 텍스트 세팅 + 진입 모드 결정
  useEffect(() => {
    if (!log) return
    // 제목 ref
    if (titleRef.current && titleRef.current.innerText !== log.content) {
      titleRef.current.innerText = log.content
    }
    // 진입 모드 — note 비어있지 않으면 view, 비어있으면 edit (사용자가 바로 읽을지/쓸지)
    const hasNote = !!log.note && hasNoteContent(log.note as Record<string, unknown>)
    const nextMode: 'view' | 'edit' = hasNote ? 'view' : 'edit'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- log.id 변경 시 진입 모드 재결정 (외부 라우트 prop sync)
    setMode(nextMode)
    editorRef.current?.setEditable(nextMode === 'edit')
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    }
  }, [log?.id])

  function handleTitleInput(e: React.FormEvent<HTMLDivElement>) {
    if (!log) return
    const raw = (e.currentTarget.innerText ?? '').replace(/\n/g, ' ')
    const doSave = async () => {
      const next = raw.trim()
      if (!log || !next || next === log.content) return // 빈값·동일값 skip
      setTitleSave('saving')
      try {
        await update.mutateAsync({ logId: log.id, dto: { content: next } })
        setTitleSave('saved')
        setTimeout(() => setTitleSave('idle'), 2000)
      } catch {
        setTitleSave('error')
      } finally {
        titlePendingRef.current = null
      }
    }
    titlePendingRef.current = doSave
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(doSave, 1500)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Enter → 본문으로 포커스 이동
      const editor = document.querySelector<HTMLElement>(
        '.np-editor-surface .ProseMirror',
      )
      editor?.focus()
    }
  }

  function handleTitlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // 서식 제거 — plain text only
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ')
    document.execCommand('insertText', false, text)
  }

  if (isLoading) {
    return (
      <div className="note-page open">
        <div className="np-head">
          <button
            type="button"
            className="np-back"
            onClick={() => navigate('/activity')}
          >
            ← 활동 일지로
          </button>
        </div>
        <div className="np-body">
          <div className="flex-1 p-10 text-center text-text-tertiary text-[13px]">
            기록을 불러오는 중...
          </div>
        </div>
      </div>
    )
  }

  if (!activity || !log) {
    return (
      <div className="note-page open">
        <div className="np-head">
          <button type="button" className="np-back" onClick={handleClose}>
            ← 활동 일지로
          </button>
        </div>
        <div className="np-body">
          <div className="flex-1 p-10 text-center text-text-tertiary text-[13px]">
            기록을 찾을 수 없어요.
            <br />
            <button
              type="button"
              className="mt-3 appearance-none bg-transparent border border-line-strong text-text-secondary px-3.5 py-1.5 rounded-lg text-xs cursor-pointer"
              onClick={handleClose}
            >
              활동 일지로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const dateLabel = log.occurredAt.slice(0, 10).replace(/-/g, '.')
  const moodLabel = log.mood ? MOOD_EM[log.mood] : null
  const catLabel = log.cat ? CAT_KO[log.cat] : null
  const compLabels = (log.comps ?? []).map((c) => COMP_KO[c] || c)
  const keywords = log.keywords ?? []

  return (
    <div
      className={`note-page open${mode === 'view' ? ' view-mode' : ''}`}
      role="dialog"
      aria-label="기록 자세히 적기"
    >
      <div className="np-head">
        <button type="button" className="np-back" onClick={handleClose}>
          ← 활동 일지로
        </button>
        <div className="np-crumb">
          <span className="act">{activity.name}</span>
          <span className="sep">/</span>
          <span>{log.content?.trim() || '제목 없는 기록'}</span>
        </div>
        {/* 모바일 전용 — 데스크탑에선 툴바 우측에 표시 */}
        <span className="np-save-status-mobile">
          <SaveIndicator combined={combinedSave} lastSavedAt={lastSavedAt} />
        </span>
        <div className="np-mode-seg" role="tablist">
          <button
            type="button"
            data-mode="view"
            aria-pressed={mode === 'view'}
            title="보기 (⌘/Ctrl+E)"
            onClick={() => void (mode !== 'view' && toggleMode())}
          >
            👁 보기
          </button>
          <button
            type="button"
            data-mode="edit"
            aria-pressed={mode === 'edit'}
            title="편집 (⌘/Ctrl+E)"
            onClick={() => void (mode !== 'edit' && toggleMode())}
          >
            ✏️ 편집
          </button>
        </div>
        <span className="np-esc-hint">Esc</span>
      </div>

      <div className="np-body">
        {/* 모바일: 메타 토글 */}
        <button
          className={`np-meta-toggle${metaExpanded ? ' expanded' : ''}`}
          type="button"
          onClick={() => setMetaExpanded((v) => !v)}
        >
          <span className="ic">▸</span>
          <span>📋 메타</span>
          <span className="count">활동·날짜·자소서 카테고리</span>
        </button>

        <aside className={`np-meta${metaExpanded ? '' : ' collapsed'}`}>
          <div className="np-meta-header">
            <div className="lbl">📋 메타</div>
            <button
              type="button"
              className="np-meta-edit-btn"
              title="메타 자세히 수정 (cl·정량·키워드 등)"
              onClick={() => setEditMetaOpen(true)}
            >
              ✏️ <span className="lbl-text">자세히 수정</span>
            </button>
          </div>

          <AISummarySection log={log} currentTextLength={textLen} />

          <div className="np-meta-row">
            <div className="k">활동</div>
            <div className="v act-name">{activity.name}</div>
          </div>

          <div className="np-meta-row">
            <div className="k">날짜</div>
            <div className="v">
              {dateLabel}
              {moodLabel ? ` · ${moodLabel}` : ''}
              {catLabel ? ` · ${catLabel}` : ''}
            </div>
          </div>

          <div className="np-meta-row">
            <div className="k">자소서 카테고리</div>
            <div className="np-meta-cl">
              {(log.cl ?? []).length === 0 ? (
                <div className="v muted">없음 — "자세히 수정" 에서 추가</div>
              ) : (
                (log.cl ?? []).map((c) => (
                  <span key={c} className="cl-badge-edit cursor-default">
                    <span>{CL_LABEL[c] ?? c}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {log.quant && <QuantRow quant={log.quant} />}

          {compLabels.length > 0 && (
            <div className="np-meta-row">
              <div className="k">발휘 역량</div>
              <div className="v">{compLabels.join(' · ')}</div>
            </div>
          )}

          {keywords.length > 0 && (
            <div className="np-meta-row">
              <div className="k">키워드</div>
              <div className="v">
                {keywords.map((k) => `#${k}`).join(' ')}
              </div>
            </div>
          )}
        </aside>

        <div className="np-editor">
          <NoteEditor
            key={log.id}
            ref={editorRef}
            initialContent={log.note ?? null}
            onSave={async (note) => {
              try {
                await handleSave(note)
              } catch {
                toast.error('자동저장 중 오류가 발생했어요')
                throw new Error('save failed')
              }
            }}
            onTextChange={(plain) => setTextLen(plain.length)}
            onSaveStateChange={setBodySave}
            toolbarRight={
              <span className="np-save-status-desktop">
                <SaveIndicator
                  combined={combinedSave}
                  lastSavedAt={lastSavedAt}
                />
              </span>
            }
            titleSlot={
              <div
                ref={titleRef}
                className="np-title"
                contentEditable={mode === 'edit'}
                suppressContentEditableWarning
                data-placeholder="제목 (한 줄 요약)"
                spellCheck={false}
                onInput={handleTitleInput}
                onKeyDown={handleTitleKeyDown}
                onPaste={handleTitlePaste}
              />
            }
          />
        </div>
      </div>

      <LogDetailModal
        open={editMetaOpen}
        activityId={activityId}
        editing={log}
        onClose={() => setEditMetaOpen(false)}
      />
    </div>
  )
}

function SaveIndicator({
  combined,
  lastSavedAt,
}: {
  combined: SaveState
  lastSavedAt: number | null
}) {
  // mock (.np-save-status / .saving=accent / .saved=brand) 1:1 — CSS 가 모든 색·폰트 처리
  if (combined === 'saving') {
    return (
      <span className="np-save-status saving">
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full border-[1.5px] border-current border-r-transparent animate-[np-spin_0.7s_linear_infinite]"
        />
        저장 중...
      </span>
    )
  }

  if (combined === 'error') {
    return (
      <span
        className="np-save-status error"
        title="다시 입력하면 자동으로 재시도해요"
      >
        ⚠ 저장 실패
      </span>
    )
  }

  if (lastSavedAt !== null) {
    // eslint-disable-next-line react-hooks/purity -- 사용자 시간 표시(저장 후 N초 전). 매 렌더마다 실시간 평가 의도
    const isFresh = Date.now() - lastSavedAt < 3_000
    return (
      <span
        key={lastSavedAt}
        className={
          isFresh
            ? 'np-save-status saved text-[13px]' // fresh — 살짝 키워 강조
            : 'np-save-status'
        }
      >
        {/* eslint-disable-next-line react-hooks/purity -- 동일 — formatRelativeSince 도 시계 의존 */}
        ✓ 저장됨 · {formatRelativeSince(lastSavedAt, Date.now())}
      </span>
    )
  }

  // 한 번도 저장 안 됨 (페이지 진입 직후)
  return <span className="np-save-status">✎ 자동 저장돼요</span>
}

function QuantRow({ quant }: { quant: NonNullable<ActivityLog['quant']> }) {
  let text: string
  if (quant.type === 'before-after') {
    text = `${quant.before} → ${quant.after}${quant.unit ? ` ${quant.unit}` : ''}`
  } else if (quant.type === 'count') {
    text = `${quant.value}${quant.unit}${quant.metric ? ` (${quant.metric})` : ''}`
  } else {
    text = quant.raw
  }
  return (
    <div className="np-meta-row">
      <div className="k">정량 결과</div>
      <span className="np-meta-quant">{text}</span>
    </div>
  )
}

// extractNoteText 는 향후 활용 (텍스트 fallback). 현재는 NoteEditor 가 onTextChange 로 직접 보고.
void extractNoteText
