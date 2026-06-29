import { useEffect, useRef, useState } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import {
  useCreateInterviewFollowup,
  useUpdateInterviewQuestion,
} from '@/hooks/useInterviewPrep'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { toast } from '@/stores/toastStore'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'
import { CATEGORY_LABEL } from '@/types/interviewPrep'

interface Props {
  question: InterviewPrepQuestion
  sessionId: string
}

/**
 * F6 PR 2 Phase 4 — 재귀 질문 카드 (depth 0/1/2).
 *
 * **디자인 패턴** (실서비스 reference):
 * - **자식이 부모 카드 안** (GitHub PR review / Slack thread) — 시각적 소속 명확
 * - **좌측 connector line** (Linear / Twitter / Slack) — depth 시각 트래킹
 * - **chevron 좌측** (Notion / Finder) — 자연스러운 토글 시작점
 * - **hover 액션** (Notion) — "+ 꼬리질문" 데스크탑에서 hover 시만 (모바일은 항상 노출)
 * - **depth 1·2 default 접힘** (YouTube / Twitter) — 메인 우선 보게 유도
 *
 * **표시**:
 * - 질문 텍스트 + AI suggested_answer (펼침 시)
 * - 내 답변 my_memo + 1.5s debounce autosave
 * - 자식 질문 inline 재귀 (부모 카드 내부 + 좌측 line 연결)
 * - depth < 2 면 "+ 꼬리질문" (hover, parent.depth=2 는 자식 depth=3 차단)
 */
export function InterviewQuestionCard({ question, sessionId }: Props) {
  const [memo, setMemo] = useState(question.myMemo ?? '')
  // depth 0 default 펼침, depth 1·2 default 접힘 (메인부터 보게 유도)
  const [expanded, setExpanded] = useState(question.depth === 0)
  const { mutate: updateMemo } = useUpdateInterviewQuestion()
  const { mutate: createFollowup, isPending: creatingFollowup } =
    useCreateInterviewFollowup(sessionId)
  const { blocked: followupBlocked, reason: followupReason } =
    useAiQuotaBlocked('interview_prep_followup')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemo(question.myMemo ?? '')
  }, [question.id, question.myMemo])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMemoChange = (val: string) => {
    setMemo(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateMemo({ questionId: question.id, dto: { myMemo: val } })
    }, 1500)
  }

  const handleAddFollowup = () => {
    createFollowup(
      { parentQuestionId: question.id },
      {
        onSuccess: (result) => {
          if (result.status === 'ok') {
            toast.show('꼬리질문을 추가했어요.')
          } else {
            toast.error(result.reason ?? '생성에 실패했어요.')
          }
        },
        onError: () => toast.error('AI 호출 중 오류가 발생했어요.'),
      },
    )
  }

  // depth 별 컨테이너 스타일
  // - depth 0: 강한 박스 (border + bg-surface-2) — 메인 질문은 카드처럼 도드라지게
  // - depth 1·2: 좌측 connector line 만 (Linear/Twitter 패턴) — 부모 카드 안에 가볍게
  const isRoot = question.depth === 0
  const containerClass = isRoot
    ? 'group border border-line bg-surface-2 rounded-xl p-4'
    : `group border-l-2 ${
        question.depth === 1 ? 'border-info/40' : 'border-warning/40'
      } pl-4 py-2 ml-2`

  const depthLabel: Record<number, string> = {
    0: '메인',
    1: '꼬리',
    2: '재꼬리',
  }
  const depthBadgeStyle: Record<number, string> = {
    0: 'bg-brand/10 text-brand border border-brand/20',
    1: 'bg-info/10 text-info border border-info/20',
    2: 'bg-warning/10 text-warning border border-warning/20',
  }

  return (
    <div className={containerClass}>
      {/* 헤더 — chevron 좌측 (Notion 패턴) */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={
          expanded ? '질문 답변·메모 접기' : '질문 답변·메모 펼치기'
        }
        className="w-full text-left flex items-start gap-2"
      >
        <span className="shrink-0 mt-1.5">
          <CollapsibleChevron open={expanded} />
        </span>
        <span
          className={`text-[11px] font-medium shrink-0 mt-0.5 px-2 py-0.5 rounded-md ${depthBadgeStyle[question.depth]}`}
        >
          {depthLabel[question.depth]}
        </span>
        {question.category && (
          <span
            className="text-[10px] font-semibold shrink-0 mt-1 px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20"
            title={`카테고리: ${question.category}`}
          >
            {CATEGORY_LABEL[question.category] ?? question.category}
          </span>
        )}
        <span className="text-text-primary text-[15px] font-medium leading-snug flex-1">
          {question.questionText}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 pl-6">
          {question.suggestedAnswer && (
            <div className="bg-surface border border-line rounded-lg p-3">
              <p className="text-text-tertiary text-xs font-semibold mb-1.5">
                ✨ AI 모범 답안
              </p>
              <p className="text-text-secondary text-[13px] leading-relaxed whitespace-pre-wrap">
                {question.suggestedAnswer}
              </p>
              {question.sourceLogIds.length > 0 && (
                <p className="text-text-faint text-[11px] mt-2">
                  참조 로그 {question.sourceLogIds.length}개
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-text-tertiary text-xs font-semibold mb-1.5">
              내 답변 메모 (자동 저장)
            </label>
            <textarea
              value={memo}
              onChange={(e) => handleMemoChange(e.target.value)}
              placeholder="이 질문에 본인이 어떻게 답할지 적어보세요…"
              rows={3}
              maxLength={5000}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-faint focus:border-brand/45 outline-none resize-none leading-relaxed"
            />
            <p className={`text-[10px] text-right mt-1 ${memo.length >= 5000 ? 'text-danger' : memo.length >= 4500 ? 'text-warning' : 'text-text-quaternary'}`}>
              {memo.length} / 5000
            </p>
          </div>

          {/* 자식 질문 — 부모 카드 안 nested (GitHub PR review 패턴) */}
          {question.children.length > 0 && (
            <div className="space-y-2 mt-3">
              {question.children.map((child) => (
                <InterviewQuestionCard
                  key={child.id}
                  question={child}
                  sessionId={sessionId}
                />
              ))}
            </div>
          )}

          {/* 꼬리 추가 (depth < 2 만) — hover 시만 (Notion 패턴, 모바일은 항상) */}
          {question.depth < 2 && (
            <button
              onClick={handleAddFollowup}
              disabled={creatingFollowup || followupBlocked}
              className="text-text-tertiary hover:text-brand text-xs font-medium disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              title={followupReason ?? undefined}
            >
              {creatingFollowup ? '✨ 생성 중…' : '+ 꼬리질문 추가'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
