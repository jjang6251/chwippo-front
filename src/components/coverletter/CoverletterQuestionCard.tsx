import { useEffect, useMemo, useRef, useState } from 'react'
import { CoverLetterImportModal } from '@/components/card/CoverLetterImportModal'
import { useAutoResize } from '@/hooks/useAutoResize'
import { CoverLetterCleanupModal } from '@/components/card/CoverLetterCleanupModal'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { Modal } from '@/components/common/Modal'
import { useCoverletterSourceRefs } from '@/hooks/useCoverletterSourceRefs'
import { countChars } from '@/utils/charCount'
import {
  COVERLETTER_CATEGORIES,
  COVERLETTER_CATEGORY_EMOJI,
  COVERLETTER_CATEGORY_STYLE,
  coverletterCategory,
} from '@/types/coverletter'
import type { ApplicationCoverletter, UpdateCoverletterDto } from '@/types/coverletter'

/**
 * F1 자소서 풀페이지 — 문항 카드 (접기 default + 펴기 시 전체 편집).
 *
 * 접힘: 분류 chip + question 1줄 + 답변 미리보기 + 글자수
 * 펴짐: question 편집 + 분류 / limit / 답변 textarea + 가져오기 / 검사 / 삭제 + source chips
 *
 * 자동저장: answer/question/limit 변경 → 1.5s debounce → update.
 */

interface Props {
  cl: ApplicationCoverletter
  /** 1-based 문항 번호 — 사용자가 AI 에게 "1번 문항" 처럼 지칭 */
  number: number
  applicationId: string
  expanded: boolean
  onToggle: () => void
  onUpdate: (dto: UpdateCoverletterDto) => void
  onDelete: () => void
  /** "✨ AI 에게 묻기" — 부모가 ChatPanel input 에 prefill */
  onAskAI: () => void
}

export function CoverletterQuestionCard({
  cl,
  number,
  applicationId,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onAskAI,
}: Props) {
  const [question, setQuestion] = useState(cl.question)
  const [answer, setAnswer] = useState(cl.answer ?? '')
  // 베타 피드백 — 자소서 답변이 길어지면 scroll 필요. auto-resize (min 200 / max 600 — 자소서 답변은 더 길게 허용)
  const { ref: answerRef, autoResize: autoResizeAnswer } = useAutoResize(answer, { min: 80, max: 600 })
  const [limitInput, setLimitInput] = useState(
    cl.charLimit != null ? String(cl.charLimit) : '',
  )
  const [showImport, setShowImport] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const initialized = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 외부에서 cl 변경 (예: AI 적용으로 부모가 updateCl) — 로컬 state 동기화.
  // 단 사용자가 직접 편집해 debounce 가 active 면 skip (사용자 입력 우선).
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }
    if (saveTimerRef.current) return // 사용자 편집 중 → 덮어쓰지 않음
    setAnswer(cl.answer ?? '')
  }, [cl.answer])

  // 답변 변경 자동저장 (debounce 1.5s)
  useEffect(() => {
    if (!initialized.current) return
    if (answer === (cl.answer ?? '')) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onUpdate({ answer })
    }, 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [answer, cl.answer, onUpdate])

  const category = coverletterCategory(cl.category)
  const categoryStyle = COVERLETTER_CATEGORY_STYLE[category]
  const counts = useMemo(() => countChars(answer), [answer])
  const [includeSpaces, setIncludeSpaces] = useState(true) // 공백포함 토글 (잡코리아 표준)
  const charCount = includeSpaces ? counts.total : counts.withoutSpaces
  const byteCount = includeSpaces ? counts.bytes : counts.bytesWithoutSpaces
  const overLimit = cl.charLimit != null && charCount > cl.charLimit
  const hasAnswer = useMemo(() => answer.trim().length > 0, [answer])

  // source_refs (답변 있을 때만)
  const { data: sourceRefs = [] } = useCoverletterSourceRefs(cl.id, hasAnswer)

  // 접힘 모드
  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        id={`cl-${cl.id}`}
        className="block w-full text-left bg-card border border-line rounded-[14px] p-4 hover:border-brand/40 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-5 text-[11px] font-bold font-mono text-brand bg-brand/10 border border-brand/20 rounded px-1.5"
            title={`${number}번 문항`}
          >
            Q{number}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${categoryStyle}`}
          >
            {COVERLETTER_CATEGORY_EMOJI[category]} {category}
          </span>
          {cl.charLimit && (
            <span className="text-[10px] text-text-quaternary font-mono">
              · {cl.charLimit}자
            </span>
          )}
          {!hasAnswer && (
            <span className="text-[10px] text-warning bg-warning/8 border border-warning/20 px-1.5 rounded-full">
              미작성
            </span>
          )}
          <div className="flex-1" />
          <CollapsibleChevron open={false} />
        </div>
        <p className="font-serif text-sm text-text-primary leading-snug line-clamp-2 mb-1.5">
          {cl.question || (
            <span className="text-text-quaternary font-medium font-sans">
              (문항 미입력 — 클릭해서 작성)
            </span>
          )}
        </p>
        {hasAnswer && (
          <>
            <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
              {answer}
            </p>
            <p
              className={`mt-1.5 font-mono text-[10px] ${overLimit ? 'text-danger' : 'text-text-quaternary'}`}
            >
              {charCount} / {cl.charLimit ?? '∞'}
            </p>
          </>
        )}
      </button>
    )
  }

  // 펴짐 모드 — 편집
  return (
    <div
      id={`cl-${cl.id}`}
      className="bg-card border border-brand/40 rounded-[14px] p-4 lg:p-[18px] shadow-md"
    >
      {/* 헤더 — 번호 + 분류 + 글자수 limit + 닫기 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 text-[11px] text-text-tertiary">
        <span
          className="inline-flex items-center justify-center min-w-[28px] h-6 text-xs font-bold font-mono text-brand bg-brand/10 border border-brand/20 rounded px-2"
          title={`${number}번 문항 — AI 에게 "${number}번 문항" 또는 "Q${number}" 로 지칭 가능`}
        >
          Q{number}
        </span>
        <label className="flex items-center gap-1.5">
          <span>유형</span>
          <span className="relative">
            <select
              value={category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              className="appearance-none bg-surface-2 border border-line rounded-md pl-2 pr-8 py-1 text-[11px] text-text-secondary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors cursor-pointer"
            >
              {COVERLETTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </label>
        <label className="flex items-center gap-1.5">
          <span>글자수 제한</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            onBlur={() => {
              const raw =
                limitInput.trim() === ''
                  ? null
                  : Math.max(0, Math.floor(Number(limitInput) || 0))
              const next = raw === 0 ? null : raw
              if (next !== cl.charLimit) onUpdate({ charLimit: next })
              setLimitInput(next != null ? String(next) : '')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="없음"
            className="w-16 bg-surface-2 border border-line rounded-md px-2 py-1 font-mono text-[11px] text-text-secondary placeholder:text-text-quaternary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors"
          />
          <span className="text-text-quaternary">자</span>
        </label>
        <div className="flex-1" />
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-text-quaternary hover:text-text-primary text-xs"
          aria-label="카드 접기"
        >
          <CollapsibleChevron open={true} />
          접기
        </button>
      </div>

      {/* question */}
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => {
          const v = question.trim()
          if (!v) {
            setQuestion(cl.question)
            return
          }
          if (v !== cl.question) onUpdate({ question: v })
        }}
        rows={2}
        maxLength={500}
        placeholder="예: 우리 회사에 지원한 동기를 작성해 주세요."
        className="w-full resize-none bg-surface-2 border border-line rounded-lg px-3 py-2 font-serif text-base text-text-primary leading-relaxed placeholder:text-text-quaternary placeholder:font-sans focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors mb-4"
      />

      {/* answer */}
      <textarea
        ref={answerRef}
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value)
          autoResizeAnswer()
        }}
        placeholder="여기에 답변을 작성하세요. 또는 우측 AI 채팅으로 초안 생성. (자동 저장)"
        style={{ minHeight: 80, lineHeight: 1.65 }}
        className="w-full bg-surface-3 border border-line rounded-[11px] px-3.5 py-3 text-[13px] text-text-primary resize-y focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      />
      <div className="flex items-center justify-between gap-2 mt-2 text-xs flex-wrap">
        <span className="text-text-quaternary">✎ 자동 저장돼요</span>
        <div className="flex items-center gap-2 text-text-tertiary">
          <button
            onClick={() => setIncludeSpaces((v) => !v)}
            className="text-[10px] text-text-quaternary hover:text-text-secondary border border-line hover:border-line-strong px-1.5 py-0.5 rounded transition-colors"
            title="공백 포함/제외 토글"
          >
            {includeSpaces ? '공백포함' : '공백제외'}
          </button>
          <span
            className={`font-mono ${overLimit ? 'text-danger' : 'text-text-tertiary'}`}
          >
            {charCount.toLocaleString()} / {cl.charLimit?.toLocaleString() ?? '∞'}자
          </span>
          <span className="font-mono text-text-quaternary">
            · {byteCount.toLocaleString()}byte
          </span>
        </div>
      </div>

      {/* 액션 */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-line">
        <button
          onClick={onAskAI}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-accent border border-brand/30 hover:border-brand/50 bg-brand/8 hover:bg-brand/12 px-2.5 py-1.5 rounded-md transition-colors"
          title="이 문항을 AI 에게 물어보거나 답변 도움 요청"
        >
          ✨ AI 에게 묻기
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors"
        >
          📋 답변 가져오기
        </button>
        <button
          onClick={() => setShowCleanup(true)}
          disabled={!answer.trim()}
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-40"
        >
          🔍 자소서 검사
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-[11px] text-text-quaternary hover:text-danger border border-line hover:border-danger/30 px-2.5 py-1.5 rounded-md transition-colors"
        >
          삭제
        </button>
      </div>

      {/* source chips */}
      {sourceRefs.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-line">
          <div className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider mb-2">
            ✦ 이 답변이 참조한 경험 ({sourceRefs.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sourceRefs.map((ref) => (
              <span
                key={ref.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-surface ${
                  ref.aiRecommended
                    ? 'border-accent/40 text-accent border-dashed'
                    : 'border-line text-text-secondary'
                }`}
              >
                <span
                  className={`text-[9px] font-bold px-1.5 rounded ${
                    ref.aiRecommended
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-3 text-text-quaternary'
                  }`}
                >
                  {ref.aiRecommended ? 'AI' : ref.sourceReflectionId ? '회고' : 'log'}
                </span>
                <span className="max-w-[140px] truncate">
                  {ref.snippetText?.slice(0, 30) ?? '(미리보기 없음)'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* modals */}
      {showImport && (
        <CoverLetterImportModal
          onClose={() => setShowImport(false)}
          applicationId={applicationId}
          currentCategory={cl.category}
          currentAnswer={answer}
          onApply={(value) => {
            setAnswer(value)
            onUpdate({ answer: value })
          }}
        />
      )}
      {showCleanup && (
        <CoverLetterCleanupModal
          text={answer}
          limit={cl.charLimit}
          onClose={() => setShowCleanup(false)}
          onApply={(cleaned) => {
            setAnswer(cleaned)
            onUpdate({ answer: cleaned })
          }}
        />
      )}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="자소서 문항을 삭제할까요?"
      >
        <p className="text-text-tertiary text-xs leading-relaxed mb-5">
          이 문항과 답변, 모든 출처 참조가 함께 삭제됩니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              setShowDeleteConfirm(false)
              onDelete()
            }}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors"
          >
            삭제
          </button>
        </div>
      </Modal>
    </div>
  )
}
