import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, TextCursor, Undo2 } from 'lucide-react'
import { Drawer } from 'vaul'
import type { Editor } from '@tiptap/react'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useNoteAiAction } from '@/hooks/useNoteAiAction'
import { qaMarkdownToToggleNodes } from './qaToggles'
import { useEditorInteracted } from './useEditorInteracted'
import { toast } from '@/stores/toastStore'
import { isNearLimit } from '@/utils/inputLimit'
import type { NoteAiActionKind, NoteAiResource } from '@/api/noteAiAction'
import {
  AI_ACTION_CHIPS,
  INSTRUCTION_MAX_CHARS,
  SELECTION_MAX_CHARS,
  buildHistory,
  previewText,
  turnTitle,
  type AiTurn,
} from './aiNoteModel'
import {
  applyInsertAt,
  applyNodesAt,
  applyReplace,
  clearAiTarget,
  expandSelection,
  serializeSelection,
  setAiTarget,
  useEditorSelection,
  type AiRange,
} from './editorBridge'
import { AiResultPreview } from './AiResultPreview'

/**
 * **노트 AI 패널** — 선택 영역 변환 · 무선택 생성 · 무상태 멀티턴.
 *
 * 데스크탑은 우측 슬라이드, 모바일(lg 미만)은 vaul 바텀 시트. 본문 폭 재계산·목차 양보는
 * **페이지가** 한다 (패널은 자기 자리만 안다).
 *
 * ## 🔴 D6 — 대화는 저장되지 않는다
 *
 * 히스토리는 이 컴포넌트의 state 다. 새로고침·라우트 이탈이면 사라진다. **적용한 결과는
 * 문서에 남고 미적용 결과만 사라진다** — 그래서 패널에 그 문장을 띄워 둔다. 안 띄우면
 * 사용자는 채팅앱처럼 "나중에 다시 보면 되겠지" 로 읽는다.
 *
 * 닫아도 히스토리가 남는 이유도 같다 — 상태가 `open` 보다 위에 있어서, 닫기는 화면만
 * 접는다.
 *
 * ## 🔴 [교체] 는 요청 시점의 자리에만 유효하다
 *
 * 요청을 보내 놓고 본문을 고치면 저장해 둔 범위가 다른 글자를 가리킨다. 그래서 요청마다
 * 그 시점의 **본문 버전**을 적어 두고, 달라졌으면 [교체] 를 잠근다(사유는 툴팁).
 * [아래 삽입] 은 자리를 덮지 않으므로 계속 열어 둔다.
 */

interface Props {
  /** 이 패널이 붙은 tiptap 인스턴스. 아직 없으면 패널을 그리지 않는다 */
  editor: Editor | null
  resource: NoteAiResource
  open: boolean
  onClose: () => void
}

const NO_SELECTION_HINT =
  '지금은 새로 만들기 모드 — 지시만 적으면 새 내용을 커서 자리에 넣어요. 본문을 다듬으려면 그 부분을 드래그하거나 문단을 클릭하세요.'
/**
 * 🔴 이미지가 낀 선택은 대상이 될 수 없다(`aiSelection.rangeHasImage`). 그런데 그 사실을
 * 안 알리면 방금 드래그한 사람에게 「새로 만들기 모드」 안내가 뜬다 — 드래그가 씹힌 것으로
 * 읽힌다. 새 시각 요소를 만들지 않고 **같은 자리의 문구만** 바꿔 이유를 준다.
 */
const IMAGE_SELECTION_HINT =
  'AI는 글자만 읽을 수 있어요 — 사진이 들어간 선택은 대상이 되지 않아요. 사진을 뺀 글자 부분만 드래그해 주세요.'
const TRUNCATED_NOTICE =
  '글자수 제한 때문에 결과가 다 들어가지 못했어요. 나눠서 적용해 주세요.'

export function AiNotePanel(props: Props) {
  // AI 전면 비활성 시 소멸 (wrapper 패턴 — inner hooks 의 conditional 호출 회피)
  const aiEnabled = useAiEnabled()
  if (!aiEnabled || !props.editor) return null
  return <AiNotePanelInner {...props} editor={props.editor} />
}

function AiNotePanelInner({
  editor,
  resource,
  open,
  onClose,
}: Props & { editor: Editor }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { run, pending } = useNoteAiAction(resource)
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked(
    'note_ai_action',
    { enabled: open },
  )
  const selection = useEditorSelection(editor)
  // 🔴 상호작용 전의 커서(기본값=문서 시작)는 의도가 아니다 — 첫 블록 오타깃 방지
  const interacted = useEditorInteracted(editor)

  const [turns, setTurns] = useState<AiTurn[]>([])
  const [instruction, setInstruction] = useState('')
  const [target, setTarget] = useState<AiRange | null>(null)
  const [targetMd, setTargetMd] = useState('')
  /** 「자유 지시」 칩이 바로 요청하지 않고 여기로 포커스를 옮긴다 */
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  /** 히스토리 조립이 항상 최신 턴을 보게 — 렌더 밖에서 갱신 (deps 없는 effect) */
  const turnsRef = useRef(turns)
  useEffect(() => {
    turnsRef.current = turns
  })

  /**
   * 본문 버전 — 문서가 바뀔 때마다 오른다. ref 와 state 를 같이 두는 이유:
   * ref 는 적용 직후 **동기로** 읽어야 하고(되돌리기 유효 판정), state 는 [교체] 버튼이
   * 다시 그려져야 해서 필요하다.
   */
  const docVersionRef = useRef(0)
  const [docVersion, setDocVersion] = useState(0)
  useEffect(() => {
    const onUpdate = () => {
      docVersionRef.current += 1
      setDocVersion(docVersionRef.current)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  // 열릴 때 대상 확정 · 닫을 때 표시 해제
  useEffect(() => {
    if (!open) {
      clearAiTarget(editor)
      return
    }
    const range = interacted ? expandSelection(editor) : null
    if (!range) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 열림 트리거 → 대상 1회 확정
      setTarget(null)
      setTargetMd('')
      return
    }
    setTarget(range)
    setTargetMd(serializeSelection(editor, range))
    setAiTarget(editor, range)
  }, [open, editor, interacted])

  /**
   * 패널을 연 채로 본문을 다시 드래그하면 대상이 따라간다 — 닫았다 열게 만들지 않는다.
   * 선택이 비면 직전 대상을 유지한다(패널 입력에 포커스가 갔다고 대상을 잃으면 안 된다).
   */
  useEffect(() => {
    if (!open || !interacted || selection.empty) return
    const range = expandSelection(editor)
    if (!range) return
    if (target && range.from === target.from && range.to === target.to) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 사용자 선택 변경 → 대상 추적
    setTarget(range)
    setTargetMd(serializeSelection(editor, range))
    setAiTarget(editor, range)
  }, [open, editor, interacted, selection.empty, selection.from, selection.to, target])

  /**
   * ESC 닫기 (데스크탑). 모바일 시트는 vaul 이 처리한다.
   * ADR-053 규약 — 이미 처리된 ESC 면 양보하고, 우리가 처리하면 표시를 남긴다.
   */
  useEffect(() => {
    if (!open || !isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isDesktop, onClose])

  const selectionTooLong = targetMd.length > SELECTION_MAX_CHARS

  const submit = useCallback(
    async (draft: AiTurn) => {
      setTurns((prev) => {
        const exists = prev.some((t) => t.id === draft.id)
        const next: AiTurn = { ...draft, status: 'running', error: undefined }
        return exists ? prev.map((t) => (t.id === draft.id ? next : t)) : [...prev, next]
      })
      const outcome = await run({
        action: draft.action,
        selectionMd: draft.selectionMd,
        instruction: draft.instruction,
        // 자기 자신은 문맥이 아니다 — 재시도 시 자기 요청이 섞이는 걸 막는다
        history: buildHistory(turnsRef.current.filter((t) => t.id !== draft.id)),
      })
      if (outcome.kind === 'cancelled') {
        // 동의 게이트에서 멈춤 — 보내지 않은 요청을 히스토리에 남기지 않는다
        setTurns((prev) => prev.filter((t) => t.id !== draft.id))
        return
      }
      setTurns((prev) =>
        prev.map((t) =>
          t.id !== draft.id
            ? t
            : outcome.kind === 'ok'
              ? {
                  ...t,
                  status: 'done',
                  markdown: outcome.markdown,
                  cached: outcome.cached,
                  truncated: outcome.truncated,
                }
              : { ...t, status: 'error', error: outcome.message },
        ),
      )
    },
    [run],
  )

  function startAction(action: NoteAiActionKind) {
    const text = instruction.trim()
    if (action === 'free' && !text) return
    if (action !== 'free' && !target) return
    if (selectionTooLong) return
    setInstruction('')
    void submit({
      id: crypto.randomUUID(),
      action,
      instruction: text || undefined,
      status: 'running',
      target,
      selectionMd: target ? targetMd : undefined,
      docVersion: docVersionRef.current,
    })
  }

  function applyTurn(turn: AiTurn, how: 'replace' | 'insert' | 'cursor' | 'end') {
    if (!turn.markdown) return
    // qa_toggle 은 md 에 없는 서식(토글)이라 후처리 노드로 적용 — 실패 시 md 폴백
    const toggleNodes =
      turn.action === 'qa_toggle' ? qaMarkdownToToggleNodes(editor, turn.markdown) : null
    const at =
      how === 'replace' && turn.target
        ? turn.target
        : how === 'end'
          ? editor.state.doc.content.size
          : how === 'insert' && turn.target
            ? turn.target.to
            : editor.state.selection.to
    const result = toggleNodes
      ? applyNodesAt(editor, at, toggleNodes)
      : how === 'replace' && turn.target
        ? applyReplace(editor, turn.target, turn.markdown)
        : applyInsertAt(editor, at as number, turn.markdown)
    if (!result?.ok) {
      toast.error('본문에 넣지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    if (result.truncated) toast.error(TRUNCATED_NOTICE)
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id ? { ...t, applied: how === 'replace' ? 'replace' : 'insert' } : t,
      ),
    )
    clearAiTarget(editor)
    // 어디 들어갔는지 보여준다 — 특히 [문서 끝] 은 화면 밖일 수 있다 (2026-08-19 CEO 질문)
    editor.commands.scrollIntoView()
    /*
      되돌리기 창은 **다음 편집 전까지**다. 그 뒤에 undo 를 대신 눌러 주면 사용자가 방금
      쓴 문장이 사라진다 — 적용 시점의 본문 버전과 다르면 안내만 하고 손대지 않는다.
    */
    const versionAtApply = docVersionRef.current
    toast.action('본문에 적용했어요', {
      label: '되돌리기',
      onAction: () => {
        if (docVersionRef.current !== versionAtApply) {
          toast.show('그 뒤에 편집한 내용이 있어 되돌리지 않았어요.')
          return
        }
        editor.commands.undo()
      },
    })
  }

  function discardTurn(turn: AiTurn) {
    setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, applied: 'discard' } : t)))
  }

  const lastTurn = turns[turns.length - 1]
  /*
   * 스크린리더 알림 — **상주 리전의 텍스트 교체**가 유일하게 안정적이다.
   * (동적으로 role="status" 요소를 새로 꽂으면 리더기마다 낭독이 갈린다 — /uiux 개선 후보)
   */
  const liveMessage = pending
    ? 'AI가 답변을 만드는 중이에요…'
    : lastTurn?.status === 'done'
      ? 'AI 결과가 도착했어요. 적용 버튼으로 본문에 넣을 수 있어요.'
      : lastTurn?.status === 'error'
        ? '요청이 실패했어요. 다시 시도할 수 있어요.'
        : ''

  const body = (
    <div className="flex flex-col h-full min-h-0">
      <div role="status" className="sr-only">
        {liveMessage}
      </div>
      {/* ── 머리 ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
        <span className="text-brand text-sm" aria-hidden="true">
          ✦
        </span>
        <h2 className="text-[13px] font-semibold text-text-primary">AI 도움</h2>
        <div className="flex-1" />
        {open && <AiQuotaChip feature="note_ai_action" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="AI 패널 닫기"
          /* 모바일 시트에서 44px 터치 타겟 (uiux 실측 32px 미달) — 데스크탑은 32px 완화 허용 */
          className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 lg:w-8 lg:h-8 shrink-0 rounded-lg flex items-center justify-center text-text-quaternary hover:text-text-primary hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          ✕
        </button>
      </div>

      {/* ── 대상 · 비저장 안내 ── */}
      <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
        {target ? (
          <div className="rounded-lg border border-line bg-card p-2.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-text-secondary">대상 부분</span>
              <span
                className={`text-[10px] font-mono ${
                  selectionTooLong ? 'text-danger' : 'text-text-quaternary'
                }`}
              >
                {targetMd.length.toLocaleString('en-US')} /{' '}
                {SELECTION_MAX_CHARS.toLocaleString('en-US')}
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary leading-relaxed line-clamp-2">
              {previewText(targetMd)}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-text-quaternary leading-relaxed">
            {selection.hasImage ? IMAGE_SELECTION_HINT : NO_SELECTION_HINT}
          </p>
        )}
        {selectionTooLong && (
          <p className="text-[11px] text-danger leading-relaxed">
            선택이 {SELECTION_MAX_CHARS.toLocaleString('en-US')}자를 넘어요. 범위를 줄여 주세요.
          </p>
        )}
        <p className="text-[11px] text-text-quaternary leading-relaxed">
          💬 대화는 저장되지 않아요 — 페이지를 떠나면 사라집니다. 본문에 적용한 내용만 남아요.
        </p>
      </div>

      {/* ── 히스토리 ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-2 space-y-2.5">
        {turns.length === 0 ? (
          /* 빈 상태 = 안내판 (ui-specs §3) — 발견성이 이 기능의 성패다 (2026-08-19 CEO:
             "나도 드래그 선택을 까먹었다"). 투어 대신 쓰는 자리에서 가르친다 */
          <div className="py-2 space-y-3" data-testid="ai-empty-guide">
            <p className="text-[11px] font-medium text-text-secondary">이렇게 써보세요</p>
            <div className="flex items-start gap-2">
              <TextCursor size={13} className="shrink-0 mt-0.5 text-brand" aria-hidden="true" />
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                <span className="text-text-secondary font-medium">다듬기</span> — 본문을
                드래그하거나 문단을 클릭하면 그 부분이 대상이 돼요. 표 안을 클릭하면 표
                전체가 잡혀요
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles size={13} className="shrink-0 mt-0.5 text-brand" aria-hidden="true" />
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                <span className="text-text-secondary font-medium">새로 만들기</span> — 빈 줄에
                커서를 두고 지시만 적으면 그 자리에 만들어 드려요
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Undo2 size={13} className="shrink-0 mt-0.5 text-brand" aria-hidden="true" />
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                <span className="text-text-secondary font-medium">적용</span> — 결과를 보고
                교체·삽입을 고르세요. 적용 직후엔 언제든 되돌릴 수 있어요
              </p>
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <TurnCard
              key={turn.id}
              turn={turn}
              stale={turn.docVersion !== docVersion}
              cursorMeaningful={interacted}
              toggleDoc={
                turn.action === 'qa_toggle' && turn.markdown
                  ? (() => {
                      const nodes = qaMarkdownToToggleNodes(editor, turn.markdown)
                      return nodes ? { type: 'doc', content: nodes } : undefined
                    })()
                  : undefined
              }
              onApply={applyTurn}
              onDiscard={discardTurn}
              onRetry={(t) => void submit(t)}
            />
          ))
        )}
      </div>

      {/* ── 액션 칩 · 지시 입력 ── */}
      <div className="border-t border-line px-4 pt-2.5 pb-4 shrink-0 space-y-2">
        {quotaBlocked && (
          <p className="text-[11px] text-warning">⚠️ {quotaReason}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {AI_ACTION_CHIPS.map((chip) => {
            const needsSelection = chip.requiresSelection && !target
            const disabled = pending || quotaBlocked || needsSelection || selectionTooLong
            return (
              <button
                key={chip.action}
                type="button"
                data-action-chip={chip.action}
                disabled={disabled}
                title={needsSelection ? '본문에서 다듬을 부분을 먼저 드래그해 주세요' : chip.desc}
                onClick={() => {
                  if (chip.action === 'free') {
                    inputRef.current?.focus()
                    return
                  }
                  startAction(chip.action)
                }}
                className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-full border border-line bg-card text-[11px] text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        <textarea
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={INSTRUCTION_MAX_CHARS}
          rows={2}
          disabled={pending || quotaBlocked}
          aria-label={turns.length > 0 ? '이어서 고치기 지시' : '자유 지시'}
          placeholder={
            turns.length > 0
              ? '이어서 고치기 — 예) 아까 그 표에 예시 열을 추가해줘'
              : target
                ? '직접 지시하기 — 예) 이 표를 채워줘 · 면접 답변용 3줄 요약으로'
                : '새로 만들기 — 예) 프로세스 vs 스레드 비교표 만들어줘'
          }
          className="w-full resize-none rounded-lg bg-input border border-line px-3 py-2 text-sm max-lg:text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all disabled:opacity-50"
        />

        {/*
          🔴 카운터는 **다 치기 전에** 색이 바뀌어야 쓸모가 있다 (`isNearLimit` = 90%).
          `maxLength` 는 초과분을 말없이 자르므로, 한도에 닿은 뒤의 숫자만으로는
          "왜 더 안 써지지" 를 알 수 없다. 색 변화가 유일한 신호라 행 전체를 aria-live 로
          감싸 스크린리더에도 같은 경고가 간다 (자소서 입력 관례).
        */}
        <div className="flex items-center justify-between gap-2" aria-live="polite">
          <span
            className={`text-[10px] font-mono ${
              isNearLimit(instruction.length, INSTRUCTION_MAX_CHARS)
                ? 'text-warning'
                : 'text-text-quaternary'
            }`}
          >
            {instruction.length} / {INSTRUCTION_MAX_CHARS}
            {isNearLimit(instruction.length, INSTRUCTION_MAX_CHARS) && ' · 곧 한도예요'}
          </span>
          <button
            type="button"
            data-testid="ai-request"
            disabled={pending || quotaBlocked || !instruction.trim() || selectionTooLong}
            onClick={() => startAction('free')}
            className="min-h-[44px] lg:min-h-0 lg:h-9 px-4 rounded-lg bg-brand text-bg text-[13px] font-semibold hover:bg-accent active:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            요청
          </button>
        </div>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <aside
        aria-label="노트 AI"
        aria-hidden={!open}
        data-testid="ai-note-panel-desktop"
        className={`fixed right-0 top-12 bottom-0 z-30 w-[380px] bg-surface border-l border-line shadow-md transition-transform duration-200 print:hidden ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {body}
      </aside>
    )
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      shouldScaleBackground={false}
      /* vaul 키보드 보정 해제 — iOS 에서 시트가 두 배로 밀려 올라간다 (근거는 InfoModal.tsx 주석) */
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm print:hidden" />
        <Drawer.Content
          aria-label="노트 AI"
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[88dvh] h-[88dvh] flex flex-col shadow-2xl outline-none print:hidden"
        >
          <Drawer.Title className="sr-only">노트 AI</Drawer.Title>
          <div
            className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-line-strong shrink-0"
            aria-hidden="true"
          />
          {body}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// ── 히스토리 한 장 ────────────────────────────────────────────

function TurnCard({
  turn,
  stale,
  onApply,
  onDiscard,
  onRetry,
  cursorMeaningful,
  toggleDoc,
}: {
  turn: AiTurn
  /** 요청 이후 본문이 바뀌었나 — [교체] 잠금 사유 */
  stale: boolean
  onApply: (turn: AiTurn, how: 'replace' | 'insert' | 'cursor' | 'end') => void
  onDiscard: (turn: AiTurn) => void
  onRetry: (turn: AiTurn) => void
  /** 커서가 사용자 의도인가 — false 면 [커서에 삽입]을 숨긴다 (기본 커서=문서 시작 함정) */
  cursorMeaningful?: boolean
  /** qa_toggle 후처리 doc — 프리뷰를 실제 토글 모양으로 */
  toggleDoc?: object
}) {
  const generated = turn.target === null

  return (
    <div className="rounded-xl border border-line-strong bg-card-solid shadow-sm p-3">
      <p className="text-[11px] font-medium text-text-secondary mb-2 break-words">
        {turnTitle(turn)}
        {turn.cached && (
          <span className="ml-1.5 text-[10px] text-text-quaternary font-normal">· 캐시</span>
        )}
      </p>

      {turn.status === 'running' && (
        <div className="space-y-1.5" aria-busy="true" data-testid="ai-turn-skeleton">
          <div className="h-3 w-full rounded bg-card animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-card animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-card animate-pulse" />
        </div>
      )}

      {turn.status === 'error' && (
        <div className="space-y-2">
          <p className="text-[11px] text-danger leading-relaxed">⚠ {turn.error}</p>
          <button
            type="button"
            onClick={() => onRetry(turn)}
            className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg border border-line bg-card text-[11px] text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            다시 시도
          </button>
        </div>
      )}

      {turn.status === 'done' && turn.markdown && (
        <>
          {generated && (
            <p className="text-[10px] text-warning mb-1.5">
              ✨ AI 생성 내용 — 검증 후 사용하세요
            </p>
          )}
          {/*
            출력 한도에 걸려 뒷부분이 없다. **적용은 막지 않는다** — 앞부분만이라도 쓰는
            게 나은 경우가 있고, 막아 버리면 코인만 쓰고 아무것도 못 가져간다.
            대신 "왜 짧은가" 와 "다음엔 어떻게" 를 같이 준다.
          */}
          {turn.truncated && (
            <p
              data-testid="ai-truncated-badge"
              className="mb-1.5 rounded-md bg-warning/10 border border-warning/25 px-2 py-1 text-[10px] text-warning leading-relaxed"
            >
              ⚠️ 출력 한도로 뒷부분이 잘렸어요 — 선택을 나눠서 다시 시도해 보세요
            </p>
          )}
          <AiResultPreview markdown={turn.markdown} docContent={toggleDoc} />

          {turn.applied ? (
            <p className="mt-2 text-[11px] text-text-quaternary">
              {turn.applied === 'discard' ? '버렸어요' : '✓ 본문에 넣었어요'}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {generated ? (
                <>
                  {cursorMeaningful && (
                    <button
                      type="button"
                      onClick={() => onApply(turn, 'cursor')}
                      className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg bg-brand text-bg text-[11px] font-semibold hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      커서에 삽입
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onApply(turn, 'end')}
                    className={
                      cursorMeaningful
                        ? 'min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg border border-line text-[11px] text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
                        : 'min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg bg-brand text-bg text-[11px] font-semibold hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
                    }
                  >
                    문서 끝에 삽입
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={stale}
                    title={
                      stale
                        ? '요청 뒤에 본문이 바뀌어서 원래 자리에 교체할 수 없어요. [아래 삽입] 을 쓰거나 다시 요청해 주세요.'
                        : undefined
                    }
                    onClick={() => onApply(turn, 'replace')}
                    className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg bg-brand text-bg text-[11px] font-semibold hover:bg-accent active:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    교체
                  </button>
                  <button
                    type="button"
                    onClick={() => onApply(turn, 'insert')}
                    className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg border border-line bg-card text-[11px] text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    아래 삽입
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onDiscard(turn)}
                className="min-h-[44px] lg:min-h-0 lg:h-7 px-3 rounded-lg text-[11px] text-text-quaternary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                버리기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
