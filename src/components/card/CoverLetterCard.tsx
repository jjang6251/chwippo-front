import { Link } from 'react-router-dom'
import { ClipboardList, PenLine, Sparkle, Sparkles } from 'lucide-react'
import { useDemoLink } from '@/hooks/useDemoLink'
import { CopyButton } from '@/components/myinfo/CopyButton'
import { useCoverletterSourceRefs } from '@/hooks/useCoverletterSourceRefs'
import { countChars } from '@/utils/charCount'
import {
  COVERLETTER_CATEGORY_EMOJI,
  COVERLETTER_CATEGORY_STYLE,
  coverletterCategory,
} from '@/types/coverletter'
import type { ApplicationCoverletter } from '@/types/coverletter'

/**
 * F1 자소서 카드 — 보기 전용 (BoardDetail · /coverletters).
 *
 * 편집·AI 답변·가져오기·검사·삭제 = 풀페이지 (`/board/:appId/coverletter`).
 * 카드는 미리보기 + 진입 링크만.
 *
 * 이전 (PR 1 Phase 5): 인라인 편집 + AiDraftModal — 풀페이지 PR 에서 모두 풀페이지로 이전.
 */

interface CoverLetterCardProps {
  cl: ApplicationCoverletter
  applicationId: string
}

export function CoverLetterCard({ cl, applicationId }: CoverLetterCardProps) {
  const link = useDemoLink()
  const answer = cl.answer ?? ''
  const hasAnswer = answer.trim().length > 0
  const { data: sourceRefs = [] } = useCoverletterSourceRefs(cl.id, hasAnswer)

  const { total, withoutSpaces } = countChars(answer)
  const limit = cl.charLimit
  const over = limit != null && total > limit
  const category = coverletterCategory(cl.category)
  const categoryStyle = COVERLETTER_CATEGORY_STYLE[category]

  const countLabel =
    limit != null
      ? `${total.toLocaleString()} / ${limit.toLocaleString()}자`
      : `${total.toLocaleString()}자 (공백 제외 ${withoutSpaces.toLocaleString()}자)`

  const editHref = link(`/board/${applicationId}/coverletter`)

  return (
    <div className="px-4 sm:px-5 py-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${categoryStyle}`}
        >
          {COVERLETTER_CATEGORY_EMOJI[category]} {category}
        </span>
        <Link
          to={editHref}
          className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-brand border border-line hover:border-brand/40 px-2 py-1 rounded-md transition-colors"
        >
          <PenLine size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
          작성하러 가기
        </Link>
      </div>

      <Link
        to={editHref}
        className="block text-text-primary text-base font-bold leading-snug mb-3 hover:text-brand transition-colors"
      >
        {cl.question || (
          <span className="text-text-quaternary font-medium">
            (문항 미입력 — 클릭해서 작성)
          </span>
        )}
      </Link>

      {hasAnswer ? (
        <p className="text-text-secondary text-sm leading-[1.75] whitespace-pre-wrap line-clamp-3">
          {answer}
        </p>
      ) : (
        <Link
          to={editHref}
          className="text-text-quaternary text-xs hover:text-text-tertiary transition-colors"
        >
          답변 미작성 — 클릭해서 작성하기
        </Link>
      )}

      {hasAnswer && sourceRefs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line/60">
          <div className="text-[10px] text-text-quaternary mb-1.5">
            <span className="inline-flex items-center gap-1">
              <Sparkle size={13} strokeWidth={1.75} aria-hidden="true" />
              이 답변이 참조한 경험 ({sourceRefs.length}개)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {sourceRefs.map((ref) => (
              <span
                key={ref.id}
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                  ref.aiRecommended
                    ? 'text-brand bg-brand/8 border-brand/20'
                    : 'text-text-tertiary bg-surface-3 border-line'
                }`}
                title={ref.aiRecommended ? 'AI 자동 추천' : '사용자 선택'}
              >
                {ref.sourceLogId ? (
                  <ClipboardList size={13} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <PenLine size={13} strokeWidth={1.75} aria-hidden="true" />
                )}
                {ref.aiRecommended && (
                  <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
                )}
                {ref.sourceLogId ? 'log' : 'reflection'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        {hasAnswer && (
          <span
            className={`font-mono text-[11px] ${over ? 'text-danger' : 'text-text-tertiary'}`}
          >
            {countLabel}
          </span>
        )}
        <div className="flex-1" />
        <CopyButton value={answer} />
      </div>
    </div>
  )
}
