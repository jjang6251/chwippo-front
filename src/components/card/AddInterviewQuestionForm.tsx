import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { CategoryChipPicker } from '@/components/common/CategoryChipPicker'
import { useBulkCreateQuestions } from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import {
  BULK_MAX_ITEMS,
  QUESTION_MAX_CHARS,
  parsePastedQuestions,
  type ParsedExclusion,
} from '@/utils/interviewQuestionParse'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * 질문 은행 D2 — **내가 직접 질문을 모으는 폼.**
 *
 * 🔴 **모달이 아니라 인라인이다.** 이 화면은 자소서와 나란히 볼 수 있고(열당 400px),
 * 모달을 띄우면 그 순간 옆의 자소서가 가려진다 — 기출을 적는 사람은 보통 무언가를
 * 보면서 적는다. 목록 툴바 바로 아래에 펼쳐 **목록과 같은 자리**에 둔다.
 *
 * 두 갈래를 세그먼트로 나눈 이유:
 * - ✍️ 직접 적기 — 하나 떠올랐을 때. 추가해도 **폼이 닫히지 않는다** (연속으로 적는다)
 * - 📋 여러 개 붙여넣기 — 면접 직후 복기·블로그/카톡에서 긁어온 목록. 줄 단위로 쪼갠다
 */

const EXCLUSION_LABEL: Record<ParsedExclusion, string> = {
  duplicate: '중복',
  too_long: `${QUESTION_MAX_CHARS}자 초과`,
  over_limit: `${BULK_MAX_ITEMS}개 초과`,
}

/**
 * 🔴 서버가 이미 이유를 말했으면 고정 문구로 덮지 않는다 (/qa 2026-08-11).
 * 400 서버 메시지("한 세션에는 100개까지…" 등)는 인터셉터가 토스트하고 `_toastShown`
 * 을 세운다 — 여기서 또 띄우면 이중 토스트에 진짜 이유가 밀려난다
 * (`InterviewSessionPage.handleGenerate` 의 catch 와 같은 규칙).
 */
const showAddErrorUnlessServerDid = (err: unknown) => {
  const shown = (err as { config?: { _toastShown?: boolean } })?.config
    ?._toastShown
  if (!shown) toast.error('질문 추가에 실패했어요.')
}

const PILL_BASE =
  'min-h-8 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors'
const PILL_ON = 'bg-brand text-bg border-brand font-medium'
const PILL_OFF =
  'bg-card hover:bg-card-strong border-line text-text-secondary hover:text-text-primary'

/** 두 갈래가 같은 footer 리듬을 쓴다 — 좌: 맥락, 우: [취소]·[주 동작] */
const CANCEL_BTN =
  'text-xs text-text-tertiary hover:text-text-primary transition-colors px-2 py-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
const SUBMIT_BTN =
  'shrink-0 min-h-8 inline-flex items-center gap-1 bg-brand hover:bg-accent text-bg text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

interface Props {
  sessionId: string
  /** 취소·붙여넣기 성공 시 폼을 닫는다 (열림 상태는 부모가 들고 있다) */
  onClose: () => void
  /**
   * 서버가 만든 질문들. **폼은 성공 토스트를 띄우지 않는다** — 목록이 면접 진행 순서로
   * 정렬돼서 새 질문은 맨 끝이 아니라 카테고리가 정한 자리로 들어간다. "추가했어요" 만으론
   * 어디로 갔는지 알 수 없어, 번호를 아는 부모(목록)가 위치까지 함께 알린다.
   */
  onAdded?: (created: InterviewPrepQuestion[]) => void
  /**
   * 준비 노트에서 건너온 본문. 있으면 **📋 붙여넣기로 열고** 그 자리에 채운다 —
   * 파서가 그대로 돌아 미리보기가 뜨므로, 사용자는 지울 줄만 끄면 된다.
   * 폼이 닫힐 때 부모가 값을 버리므로 다시 열면 빈 폼이다.
   */
  initialPasteText?: string
}

export function AddInterviewQuestionForm({
  sessionId,
  onClose,
  onAdded,
  initialPasteText,
}: Props) {
  const [mode, setMode] = useState<'single' | 'paste'>(
    initialPasteText ? 'paste' : 'single',
  )
  const { mutate: bulkCreate, isPending } = useBulkCreateQuestions(sessionId)

  // ── ✍️ 직접 적기 ──
  const [text, setText] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // ── 📋 붙여넣기 ──
  const [raw, setRaw] = useState(initialPasteText ?? '')
  const [pasteCategory, setPasteCategory] = useState<string | null>(null)
  /**
   * 사용자가 **직접 끈 줄.** 인덱스가 아니라 본문으로 들고 있다 — 위에 한 줄을 더 붙여넣으면
   * 인덱스가 통째로 밀려서 엉뚱한 줄이 꺼진다. 유효한 줄은 중복이 제거돼 본문이 유일하다.
   */
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())

  const parsed = useMemo(() => parsePastedQuestions(raw), [raw])
  const selected = useMemo(
    () => parsed.filter((p) => p.exclude === null && !unchecked.has(p.text)),
    [parsed, unchecked],
  )
  const overLimit = parsed.some((p) => p.exclude === 'over_limit')

  const trimmed = text.trim()

  const handleAddSingle = () => {
    if (!trimmed || isPending) return
    bulkCreate(
      { items: [{ questionText: trimmed, category }] },
      {
        onSuccess: (created) => {
          /*
            🔴 **입력칸만 비운다.** 카테고리와 폼 열림은 그대로 둔다 — 기출을 적는 사람은
            보통 같은 결의 질문을 연달아 적는다. 매번 폼을 다시 열고 카테고리를 고르게 하면
            두 번째 질문에서 그만두게 된다.
          */
          setText('')
          textRef.current?.focus()
          onAdded?.(created)
        },
        // 실패해도 입력은 남긴다 — 방금 쓴 문장을 다시 치게 하지 않는다
        onError: showAddErrorUnlessServerDid,
      },
    )
  }

  const handleAddPasted = () => {
    if (selected.length === 0 || isPending) return
    bulkCreate(
      {
        items: selected.map((p) => ({
          questionText: p.text,
          category: pasteCategory,
        })),
      },
      {
        onSuccess: (created) => {
          onAdded?.(created)
          onClose()
        },
        onError: showAddErrorUnlessServerDid,
      },
    )
  }

  return (
    <div className="mb-3 border border-line bg-surface-2 rounded-xl p-3.5 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMode('single')}
          aria-pressed={mode === 'single'}
          className={`${PILL_BASE} ${mode === 'single' ? PILL_ON : PILL_OFF}`}
        >
          ✍️ 직접 적기
        </button>
        <button
          type="button"
          onClick={() => setMode('paste')}
          aria-pressed={mode === 'paste'}
          className={`${PILL_BASE} ${mode === 'paste' ? PILL_ON : PILL_OFF}`}
        >
          📋 여러 개 붙여넣기
        </button>
      </div>

      {mode === 'single' ? (
        <div className="space-y-2.5">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={QUESTION_MAX_CHARS}
            rows={2}
            placeholder="예: 프로젝트에서 가장 어려웠던 기술적 결정은 무엇이었나요?"
            aria-label="질문 내용"
            /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 */
            className="w-full bg-input border border-line rounded-lg px-3 py-2 text-base sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none leading-relaxed"
          />

          <CategoryChipPicker
            value={category}
            onChange={setCategory}
            idPrefix="add-q-single"
          />

          <div className="flex items-end justify-between gap-3">
            {/*
              🔴 카테고리가 **정렬 자리를 정한다.** 목록이 면접 진행 순서라 새 질문은 맨 끝이
              아니라 그 카테고리의 자리로 들어간다 — 고르기 전에 알려야 "어디 갔지" 가 안 생긴다.
            */}
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-text-faint leading-relaxed">
              <p className="min-w-0">
                카테고리를 고르면 면접 흐름의 그 자리로 들어가요 · 미분류는 중간
              </p>
              <span className="shrink-0 tabular-nums whitespace-nowrap">
                {text.length} / {QUESTION_MAX_CHARS}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <button type="button" onClick={onClose} className={CANCEL_BTN}>
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSingle}
                disabled={!trimmed || isPending}
                className={SUBMIT_BTN}
              >
                {isPending ? (
                  '추가 중…'
                ) : (
                  <>
                    <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                    추가
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value)
              setUnchecked(new Set())
            }}
            rows={5}
            placeholder="면접 다녀왔다면 받은 질문을 기록해 두세요 — 다음 차수·다른 회사에서 다시 나옵니다.&#10;&#10;1. 1분 자기소개 해주세요&#10;2. 가장 어려웠던 협업 경험은?"
            aria-label="붙여넣을 질문 목록"
            /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 */
            className="w-full bg-input border border-line rounded-lg px-3 py-2 text-base sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
          />

          {parsed.length > 0 && (
            <div className="max-h-48 overflow-y-auto overscroll-contain space-y-1 border border-line rounded-lg p-2 bg-surface">
              {parsed.map((p, i) => {
                const on = p.exclude === null && !unchecked.has(p.text)
                return (
                  <label
                    key={`${i}-${p.text}`}
                    className={`flex items-start gap-2 text-xs leading-relaxed py-0.5 ${
                      p.exclude
                        ? 'text-text-quaternary'
                        : 'text-text-secondary cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={p.exclude !== null}
                      onChange={() =>
                        setUnchecked((prev) => {
                          const next = new Set(prev)
                          if (next.has(p.text)) next.delete(p.text)
                          else next.add(p.text)
                          return next
                        })
                      }
                      className="accent-brand mt-0.5 shrink-0"
                    />
                    <span className="min-w-0 line-clamp-2">{p.text}</span>
                    {p.exclude && (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 rounded bg-surface-3 text-text-tertiary border border-line">
                        {EXCLUSION_LABEL[p.exclude]}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {overLimit && (
            <p className="bg-info/10 border border-info/25 text-text-secondary text-xs rounded-lg p-3">
              {BULK_MAX_ITEMS}개까지 한 번에 추가할 수 있어요. 앞의{' '}
              {BULK_MAX_ITEMS}개만 선택했어요.
            </p>
          )}

          {/* 일괄 적용이라 붙여넣은 줄을 다 본 뒤에 고르는 게 맞다 — 미리보기 아래 */}
          <CategoryChipPicker
            value={pasteCategory}
            onChange={setPasteCategory}
            idPrefix="add-q-paste"
          />

          <div className="flex items-end justify-between gap-3">
            <p className="min-w-0 text-[11px] text-text-faint leading-relaxed">
              고른 카테고리가 선택한 줄 전체에 붙어요
            </p>
            <div className="shrink-0 flex items-center gap-1">
              <button type="button" onClick={onClose} className={CANCEL_BTN}>
                취소
              </button>
              <button
                type="button"
                onClick={handleAddPasted}
                disabled={selected.length === 0 || isPending}
                className={SUBMIT_BTN}
              >
                {isPending ? '추가 중…' : `${selected.length}개 추가`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
