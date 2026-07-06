import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'

/**
 * A1 Phase 3 — 검사 2층 구조의 AI 층 (CleanupModal 하단에 mount).
 * 로컬 검사(무료·즉시)가 1층, 이 섹션이 opt-in 2층 (약 10코인, 실측 가변).
 * 결과 = 짚어주기: 잘한 점 + 문장 인용 지적 + 예시 + 총평 (통째 재작성 없음).
 */

interface FeedbackIssue {
  kind:
    | 'ai_tone'
    | 'structure'
    | 'question_mismatch'
    | 'company_mismatch'
    | 'over_limit'
    | 'vague'
  quote: string
  advice: string
}

interface FeedbackResult {
  status: 'ok' | 'blocked' | 'error'
  reason?: string
  feedback?: {
    strengths: string[]
    issues: FeedbackIssue[]
    suggestions: Array<{ target: string; improved: string }>
    summary: string
  }
}

const KIND_LABEL: Record<FeedbackIssue['kind'], { label: string; tone: string }> = {
  ai_tone: { label: 'AI 티 나는 표현', tone: 'text-danger bg-danger/8 border-danger/20' },
  structure: { label: '구조', tone: 'text-warning bg-warning/8 border-warning/20' },
  question_mismatch: { label: '문항 어긋남', tone: 'text-warning bg-warning/8 border-warning/20' },
  company_mismatch: { label: '회사 미스매치', tone: 'text-info bg-info/8 border-info/20' },
  over_limit: { label: '글자수', tone: 'text-text-tertiary bg-surface-3 border-line' },
  vague: { label: '추상적', tone: 'text-violet bg-violet/8 border-violet/20' },
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data

interface AiFeedbackSectionProps {
  clId: string
  /** 현재 답변 텍스트 — 예시 문장 적용(치환)용. 없으면 적용 버튼 미노출 */
  answer?: string
  /** 예시 적용 — 치환된 전체 답변으로 저장 (CleanupModal onApply 경유) */
  onApplyText?: (next: string) => void
}

export function AiFeedbackSection({ clId, answer, onApplyText }: AiFeedbackSectionProps) {
  // 예시 적용 상태 — index 기준 (적용됨 / 원문 못 찾음)
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set())
  const [notFoundIdx, setNotFoundIdx] = useState<Set<number>>(new Set())
  const canApply = answer !== undefined && !!onApplyText

  const handleApplySuggestion = (i: number, target: string, improved: string) => {
    if (!canApply) return
    if (!answer.includes(target)) {
      setNotFoundIdx((prev) => new Set(prev).add(i))
      return
    }
    onApplyText(answer.replace(target, improved))
    setAppliedIdx((prev) => new Set(prev).add(i))
  }

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/coverletters/${clId}/ai-feedback`)
        .then(unwrap<FeedbackResult>),
    onError: () => toast.error('점검 요청에 실패했어요. 잠시 후 다시 시도해 주세요.'),
  })

  const result = mutation.data
  const feedback = result?.status === 'ok' ? result.feedback : undefined

  return (
    <div className="mt-4 pt-4 border-t border-line">
      {!mutation.data && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-text-primary text-xs font-semibold">✨ AI 심층 점검</p>
            <p className="text-[11px] text-text-quaternary mt-0.5">
              AI 티 나는 문장 · 문항 부합 · 구조 · 글자수까지 짚어드려요 (약 10코인)
            </p>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="shrink-0 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? '점검 중...' : '점검 받기'}
          </button>
        </div>
      )}

      {mutation.isPending && (
        <p className="text-[11px] text-text-tertiary mt-2 animate-pulse">
          답변을 읽고 있어요 — 10~20초 걸려요...
        </p>
      )}

      {result && result.status !== 'ok' && (
        <p className="text-xs text-danger mt-2">
          {result.reason ?? '점검에 실패했어요.'}
        </p>
      )}

      {feedback && (
        <div className="space-y-3 mt-1">
          <p className="text-text-primary text-xs font-semibold">✨ AI 심층 점검 결과</p>

          {feedback.strengths.length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg px-3 py-2">
              {feedback.strengths.map((st, i) => (
                <p key={i} className="text-[11px] text-text-secondary leading-relaxed">
                  👍 {st}
                </p>
              ))}
            </div>
          )}

          {feedback.issues.map((issue, i) => (
            <div key={i} className="bg-card border border-line rounded-lg px-3 py-2 space-y-1">
              <span
                className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${KIND_LABEL[issue.kind]?.tone ?? 'text-text-tertiary bg-surface-3 border-line'}`}
              >
                {KIND_LABEL[issue.kind]?.label ?? issue.kind}
              </span>
              <p className="text-[11px] text-text-quaternary italic leading-relaxed">
                “{issue.quote}”
              </p>
              <p className="text-[11px] text-text-secondary leading-relaxed">{issue.advice}</p>
            </div>
          ))}

          {feedback.suggestions.length > 0 && (
            <div className="bg-card border border-line rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-[10px] text-text-quaternary font-medium">예시 방향 (참고용)</p>
              {feedback.suggestions.map((sg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <p className="flex-1 min-w-0 text-[11px] leading-relaxed">
                    <span className="text-text-quaternary line-through">{sg.target}</span>
                    <span className="text-text-tertiary mx-1">→</span>
                    <span className="text-text-secondary">{sg.improved}</span>
                    {notFoundIdx.has(i) && (
                      <span className="block text-[10px] text-warning mt-0.5">
                        원문을 찾을 수 없어요 — 이미 수정된 문장이에요
                      </span>
                    )}
                  </p>
                  {canApply &&
                    (appliedIdx.has(i) ? (
                      <span className="shrink-0 text-[10px] text-text-quaternary py-0.5">
                        ✓ 적용됨
                      </span>
                    ) : (
                      !notFoundIdx.has(i) && (
                        <button
                          onClick={() => handleApplySuggestion(i, sg.target, sg.improved)}
                          className="shrink-0 text-[10px] font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-2 py-0.5 rounded transition-colors"
                          title="답변에서 이 문장만 바꿔요"
                        >
                          이 문장 적용
                        </button>
                      )
                    ))}
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-text-tertiary leading-relaxed">💬 {feedback.summary}</p>
          <p className="text-[10px] text-text-quaternary">
            점검은 짚어주기예요 — 고치는 건 본인 문장으로. 수정 후 다시 점검할 수 있어요.
          </p>
        </div>
      )}
    </div>
  )
}
