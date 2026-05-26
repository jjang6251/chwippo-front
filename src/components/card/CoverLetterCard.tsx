import { useState } from 'react'
import { CopyButton } from '@/components/myinfo/CopyButton'
import { CoverLetterImportModal } from '@/components/card/CoverLetterImportModal'
import { CoverLetterCleanupModal } from '@/components/card/CoverLetterCleanupModal'
import { AiDraftModal } from '@/components/card/AiDraftModal'
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

const HARD_CAP = 2000

// PR 1 Phase 5 — refs 표시 분기용 helper (정의: 보기·편집 모드 양쪽에서 hasAnswer 일 때만 useCoverletterSourceRefs 호출)
function hasAnswerCheck(v: string): boolean {
  return v.trim().length > 0
}

interface CoverLetterCardProps {
  cl: ApplicationCoverletter
  applicationId: string
  onUpdate: (clId: string, dto: UpdateCoverletterDto) => void
  onRequestRemove: (cl: ApplicationCoverletter) => void
}

export function CoverLetterCard({ cl, applicationId, onUpdate, onRequestRemove }: CoverLetterCardProps) {
  const [editing, setEditing] = useState(() => cl.question.trim() === '')
  const [question, setQuestion] = useState(cl.question)
  const [answer, setAnswer] = useState(cl.answer ?? '')
  const [limitInput, setLimitInput] = useState(cl.charLimit != null ? String(cl.charLimit) : '')
  const [showImport, setShowImport] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)
  // PR 1 Phase 5 — AI 답변 도와줘 모달 + 덮어쓰기 confirm
  const [showAiDraft, setShowAiDraft] = useState(false)
  const [pendingAiAnswer, setPendingAiAnswer] = useState<string | null>(null)
  // 출처 칩 (보기 모드에서도 표시)
  const { data: sourceRefs = [] } = useCoverletterSourceRefs(cl.id, editing || hasAnswerCheck(answer))

  const { total, withoutSpaces } = countChars(answer)
  const limit = cl.charLimit
  const over = limit != null && total > limit
  const maxLength = Math.max(HARD_CAP, limit ?? 0)
  const category = coverletterCategory(cl.category)
  const categoryStyle = COVERLETTER_CATEGORY_STYLE[category]
  const hasAnswer = answer.trim().length > 0

  const countLabel =
    limit != null
      ? `${total.toLocaleString()} / ${limit.toLocaleString()}자`
      : `${total.toLocaleString()}자 (공백 제외 ${withoutSpaces.toLocaleString()}자)`

  const saveQuestion = () => {
    const v = question.trim()
    if (!v) { setQuestion(cl.question); return }
    if (v !== cl.question) onUpdate(cl.id, { question: v })
  }
  const saveAnswer = () => {
    if (answer !== (cl.answer ?? '')) onUpdate(cl.id, { answer })
  }
  const saveLimit = () => {
    const raw = limitInput.trim() === '' ? null : Math.max(0, Math.floor(Number(limitInput) || 0))
    const next = raw === 0 ? null : raw
    if (next !== cl.charLimit) onUpdate(cl.id, { charLimit: next })
    setLimitInput(next != null ? String(next) : '')
  }

  // PR 1 Phase 5 — AI 응답 핸들러: 기존 answer 가 있으면 confirm, 없으면 즉시 적용
  const handleAiAnswer = (newAnswer: string) => {
    if (hasAnswerCheck(answer)) {
      // 기존 답변 있음 — confirm 후 덮어쓰기
      setPendingAiAnswer(newAnswer)
    } else {
      // 빈 answer — 즉시 적용
      setAnswer(newAnswer)
      onUpdate(cl.id, { answer: newAnswer })
    }
  }
  const confirmOverwrite = () => {
    if (!pendingAiAnswer) return
    setAnswer(pendingAiAnswer)
    onUpdate(cl.id, { answer: pendingAiAnswer })
    setPendingAiAnswer(null)
  }

  // ── 보기 모드 ─────────────────────────────────────
  if (!editing) {
    return (
      <div className="px-4 sm:px-5 py-5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${categoryStyle}`}>
          {COVERLETTER_CATEGORY_EMOJI[category]} {category}
        </span>
        <h3
          onClick={() => setEditing(true)}
          className="text-text-primary text-base font-bold leading-snug mt-3 mb-3 cursor-pointer hover:text-brand transition-colors"
        >
          {cl.question || <span className="text-text-quaternary font-medium">(문항 미입력 — 클릭해서 작성)</span>}
        </h3>
        {hasAnswer ? (
          <p className="text-text-secondary text-sm leading-[1.75] whitespace-pre-wrap">{answer}</p>
        ) : (
          <button onClick={() => setEditing(true)} className="text-text-quaternary text-xs hover:text-text-tertiary transition-colors">
            답변 미작성 — 클릭해서 작성하기
          </button>
        )}
        {/* PR 1 Phase 5 — 출처 칩 (보기 모드에서도, 답변 있을 때만) */}
        {hasAnswer && sourceRefs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line/60">
            <div className="text-[10px] text-text-quaternary mb-1.5">
              ✦ 이 답변이 참조한 경험 ({sourceRefs.length}개)
            </div>
            <div className="flex flex-wrap gap-1">
              {sourceRefs.map((ref) => (
                <span
                  key={ref.id}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    ref.aiRecommended
                      ? 'text-brand bg-brand/8 border-brand/20'
                      : 'text-text-tertiary bg-surface-3 border-line'
                  }`}
                  title={ref.aiRecommended ? 'AI 자동 추천' : '사용자 선택'}
                >
                  {ref.sourceLogId ? '📋' : '📝'} {ref.aiRecommended ? '✨' : ''}
                  {ref.sourceLogId ? 'log' : 'reflection'}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mt-4">
          {hasAnswer && (
            <span className={`font-mono text-[11px] ${over ? 'text-danger' : 'text-text-tertiary'}`}>{countLabel}</span>
          )}
          <div className="flex-1" />
          <CopyButton value={answer} />
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2 py-1 rounded-md transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            편집
          </button>
        </div>
      </div>
    )
  }

  // ── 편집 모드 ─────────────────────────────────────
  return (
    <div className="px-4 sm:px-5 py-4 sm:py-5 bg-card">
      <label className="block text-[11px] font-medium text-text-tertiary mb-1.5">문항</label>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={saveQuestion}
        rows={2}
        placeholder="예: 우리 회사에 지원한 동기를 작성해 주세요."
        className="w-full resize-none bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary leading-relaxed
          placeholder:text-text-quaternary hover:border-line-strong
          focus:outline-none focus:bg-surface-3 focus:border-brand/60 focus:ring-2 focus:ring-brand/10 transition-colors"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 mb-3 text-[11px] text-text-tertiary">
        <label className="flex items-center gap-1.5">
          <span>유형</span>
          <span className="relative">
            <select
              value={category}
              onChange={(e) => onUpdate(cl.id, { category: e.target.value })}
              className="appearance-none bg-surface-2 border border-line rounded-md pl-2 pr-6 py-1 text-[11px] text-text-secondary
                focus:outline-none focus:bg-surface-3 focus:border-brand/60 focus:ring-2 focus:ring-brand/10 transition-colors cursor-pointer"
            >
              {COVERLETTER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
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
            onBlur={saveLimit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="없음"
            className="w-16 bg-surface-2 border border-line rounded-md px-2 py-1 font-mono text-[11px] text-text-secondary
              placeholder:text-text-quaternary focus:outline-none focus:bg-surface-3 focus:border-brand/60 focus:ring-2 focus:ring-brand/10 transition-colors"
          />
          <span className="text-text-quaternary">자</span>
        </label>
      </div>

      <label className="block text-[11px] font-medium text-text-tertiary mb-1.5">답변</label>
      {/* NotePage 의 .np-editor-surface 색 통일 — bg-surface (가장 어두운 단계) + focus-within brand/45 */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={saveAnswer}
        maxLength={maxLength}
        rows={8}
        placeholder="답변을 작성하세요. (자동 저장)"
        className="w-full resize-y bg-surface border border-line rounded-xl px-4 py-3 text-sm text-text-primary leading-relaxed
          placeholder:text-text-quaternary
          focus:outline-none focus:border-brand/45 transition-colors min-h-[160px]"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-text-quaternary">최대 {maxLength.toLocaleString()}자까지 입력</span>
        <span className={`font-mono text-[11px] ${over ? 'text-danger' : 'text-text-quaternary'}`}>{countLabel}</span>
      </div>

      {/* PR 1 Phase 5 — 출처 칩 (편집 모드) */}
      {sourceRefs.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] text-text-quaternary mb-1.5">
            ✦ 이 답변이 참조한 경험 ({sourceRefs.length}개)
          </div>
          <div className="flex flex-wrap gap-1">
            {sourceRefs.map((ref) => (
              <span
                key={ref.id}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  ref.aiRecommended
                    ? 'text-brand bg-brand/8 border-brand/20'
                    : 'text-text-tertiary bg-surface-3 border-line'
                }`}
                title={ref.aiRecommended ? 'AI 자동 추천' : '사용자 선택'}
              >
                {ref.sourceLogId ? '📋' : '📝'} {ref.aiRecommended ? '✨ ' : ''}
                {ref.sourceLogId ? '활동 로그' : '회고'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-line">
        <button
          onClick={() => setShowAiDraft(true)}
          disabled={!question.trim()}
          title="활동 일지의 로그·회고를 골라 AI 가 자소서 초안 생성"
          className="text-[11px] font-medium text-brand hover:text-accent border border-brand/30 hover:border-brand/50 bg-brand/8 hover:bg-brand/12 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:hover:text-brand disabled:hover:border-brand/30"
        >
          ✨ AI 답변 도와줘
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
          title="맞춤법이 아닌 형식(줄바꿈·공백·이모지·특수문자 등)을 정리합니다"
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:hover:text-text-tertiary disabled:hover:border-line-strong"
        >
          🔍 자소서 검사
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onRequestRemove(cl)}
          className="text-[11px] text-text-quaternary hover:text-danger px-2.5 py-1.5 rounded-md transition-colors"
        >
          삭제
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={!question.trim()}
          className="text-[11px] font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover px-3 py-1.5 rounded-md transition-colors disabled:opacity-40"
        >
          완료
        </button>
      </div>

      {showImport && (
        <CoverLetterImportModal
          onClose={() => setShowImport(false)}
          applicationId={applicationId}
          currentCategory={cl.category}
          currentAnswer={answer}
          onApply={(value) => { setAnswer(value); onUpdate(cl.id, { answer: value }) }}
        />
      )}
      {showCleanup && (
        <CoverLetterCleanupModal
          text={answer}
          limit={cl.charLimit}
          onClose={() => setShowCleanup(false)}
          onApply={(cleaned) => { setAnswer(cleaned); onUpdate(cl.id, { answer: cleaned }) }}
        />
      )}
      {/* PR 1 Phase 5 — AI 자소서 답변 생성 모달 */}
      {showAiDraft && (
        <AiDraftModal
          open={showAiDraft}
          onClose={() => setShowAiDraft(false)}
          clId={cl.id}
          clQuestion={cl.question}
          clCategory={cl.category}
          onAnswerGenerated={handleAiAnswer}
        />
      )}
      {/* 덮어쓰기 confirm */}
      <Modal
        open={pendingAiAnswer !== null}
        onClose={() => setPendingAiAnswer(null)}
        title="기존 답변을 덮어쓸까요?"
      >
        <p className="text-text-tertiary text-xs leading-relaxed mb-2">
          이미 작성된 답변이 AI 가 생성한 답변으로 교체됩니다.
        </p>
        <p className="text-text-quaternary text-[11px] leading-relaxed mb-5">
          되돌리려면 textarea 에서 Cmd+Z (Ctrl+Z) 로 직전 상태로 돌아갈 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPendingAiAnswer(null)}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={confirmOverwrite}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
          >
            덮어쓰기
          </button>
        </div>
      </Modal>
    </div>
  )
}
