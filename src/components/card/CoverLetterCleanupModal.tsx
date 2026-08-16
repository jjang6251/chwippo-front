import { useMemo, type ReactNode } from 'react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import { AiFeedbackSection } from '@/components/coverletter/AiFeedbackSection'
import { Modal } from '@/components/common/Modal'
import { cleanupCoverletter } from '@/utils/coverletterCleanup'
import type { CoverletterFeedback } from '@/types/coverletter'

interface CoverLetterCleanupModalProps {
  text: string
  limit: number | null
  onClose: () => void
  /** A1 — AI 심층 점검 층 (2층 구조). 전달 + AI 켜짐 시에만 노출 */
  aiFeedbackClId?: string | null
  /** 점검의 직무 게이트용 */
  applicationId: string
  /** 서버가 저장한 마지막 점검 결과 — 모달 재진입 시 표시 */
  lastFeedback?: CoverletterFeedback | null
  lastFeedbackAt?: string | null
  onApply: (cleaned: string) => void
}

function highlight(text: string, ranges: Array<[number, number]>): ReactNode {
  if (ranges.length === 0) return text
  const out: ReactNode[] = []
  let pos = 0
  ranges.forEach(([s, e], i) => {
    if (s > pos) out.push(<span key={`t${i}`}>{text.slice(pos, s)}</span>)
    out.push(
      <mark key={`m${i}`} className="bg-danger/25 text-danger rounded-[2px] px-px">
        {text.slice(s, e)}
      </mark>,
    )
    pos = e
  })
  if (pos < text.length) out.push(<span key="end">{text.slice(pos)}</span>)
  return out
}

export function CoverLetterCleanupModal({ text, limit, onClose, onApply, aiFeedbackClId, applicationId, lastFeedback, lastFeedbackAt }: CoverLetterCleanupModalProps) {
  const result = useMemo(() => cleanupCoverletter(text, limit), [text, limit])
  const { cleaned, issues, ranges } = result
  const nothingToFix = issues.length === 0
  const onlyOverLimit = !nothingToFix && cleaned === text

  return (
    <Modal open onClose={onClose} title="자소서 정리" width="max-w-lg">
      {/* 무엇을 검사하는지 안내 */}
      <div className="text-[11px] text-text-quaternary leading-relaxed bg-card border border-line rounded-lg px-3 py-2 mb-4">
        <span className="text-text-tertiary">맞춤법은 검사하지 않아요.</span> 형식만 정리합니다 —
        과도한 빈 줄(문단 구분 1개는 유지)·연속 공백, 줄 앞뒤 공백, 탭, 문장 도중 줄바꿈(쉼표 뒤), 한글 자모 단독(ㅋㅋ), 이모지·그림문자, 특수 공백, 둥근 따옴표→직선, 전각 문장부호→반각, 반복된 문장부호, 허용 외 특수문자, 글자수 초과.
      </div>

      {nothingToFix ? (
        <div className="text-center py-6">
          <div className="mb-2"><Sparkles size={24} strokeWidth={1.75} aria-hidden="true" className="inline-block" /></div>
          <p className="text-text-secondary text-sm">정리할 내용이 없어요. 깔끔합니다!</p>
          <button onClick={onClose} className="mt-5 px-4 py-2 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
            닫기
          </button>
          {aiFeedbackClId && <AiFeedbackSection clId={aiFeedbackClId} applicationId={applicationId} answer={text} onApplyText={onApply} lastFeedback={lastFeedback} lastFeedbackAt={lastFeedbackAt} />}
        </div>
      ) : (
        <>
          {/* 발견된 항목 */}
          <ul className="space-y-1.5 mb-4">
            {issues.map((iss) => (
              <li key={iss.key} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-danger flex-none" />
                <span className="flex-1">{iss.label}</span>
                {iss.key !== 'overLimit' && <span className="font-mono text-[11px] text-text-quaternary flex-none">{iss.count}곳</span>}
              </li>
            ))}
          </ul>

          {/* 원본 (문제 부분 강조) */}
          <div className="mb-3">
            <p className="text-[11px] font-medium text-text-tertiary mb-1.5">원본 — 빨간 부분이 정리 대상</p>
            <div className="max-h-40 overflow-y-auto bg-surface-2 border border-line rounded-lg px-3 py-2.5 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {highlight(text, ranges)}
            </div>
          </div>

          {!onlyOverLimit && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-text-tertiary mb-1.5">정리 후</p>
              <div className="max-h-40 overflow-y-auto bg-success/5 border border-success/20 rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {cleaned || <span className="text-text-quaternary">(빈 내용)</span>}
              </div>
            </div>
          )}

          {issues.some((i) => i.key === 'overLimit') && (
            <p className="text-[11px] text-warning mb-3">
              <span className="inline-flex items-center gap-1">
                <TriangleAlert size={13} strokeWidth={1.75} aria-hidden="true" />
                글자수 초과는 자동으로 줄이지 않아요. 직접 다듬어 주세요.
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
              취소
            </button>
            {!onlyOverLimit && (
              <button
                onClick={() => { onApply(cleaned); onClose() }}
                className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors"
              >
                정리된 내용으로 바꾸기
              </button>
            )}
          </div>
          {aiFeedbackClId && <AiFeedbackSection clId={aiFeedbackClId} applicationId={applicationId} answer={text} onApplyText={onApply} lastFeedback={lastFeedback} lastFeedbackAt={lastFeedbackAt} />}
        </>
      )}
    </Modal>
  )
}
