import { useState } from 'react'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useAiFeedbackStore } from '@/stores/aiFeedbackStore'
import type {
  CoverletterFeedback,
  CoverletterFeedbackIssue,
} from '@/types/coverletter'

/**
 * A1 Phase 3 — 검사 2층 구조의 AI 층 (CleanupModal 하단에 mount).
 * 로컬 검사(무료·즉시)가 1층, 이 섹션이 opt-in 2층 (약 10코인, 실측 가변).
 * 결과 = 짚어주기: 잘한 점 + 문장 인용 지적 + 예시 + 총평 (통째 재작성 없음).
 *
 * 상태·호출은 aiFeedbackStore 로 승격 — 모달을 닫아도 점검이 계속 진행되고,
 * 서버가 저장한 마지막 결과(lastFeedback)를 재진입 시 그대로 보여준다.
 */

const KIND_LABEL: Record<
  CoverletterFeedbackIssue['kind'],
  { label: string; tone: string }
> = {
  ai_tone: { label: 'AI 티 나는 표현', tone: 'text-danger bg-danger/8 border-danger/20' },
  structure: { label: '구조', tone: 'text-warning bg-warning/8 border-warning/20' },
  question_mismatch: { label: '문항 어긋남', tone: 'text-warning bg-warning/8 border-warning/20' },
  company_mismatch: { label: '회사 미스매치', tone: 'text-info bg-info/8 border-info/20' },
  over_limit: { label: '글자수', tone: 'text-text-tertiary bg-surface-3 border-line' },
  vague: { label: '추상적', tone: 'text-violet bg-violet/8 border-violet/20' },
}

/** "3분 전 · 2일 전" 형식 상대 시각 (KST 무관 — 경과 시간만). */
function relativeKo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return '방금 전'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  return `${day}일 전`
}

interface AiFeedbackSectionProps {
  clId: string
  /** 현재 답변 텍스트 — 예시 문장 적용(치환)용. 없으면 적용 버튼 미노출 */
  answer?: string
  /** 예시 적용 — 치환된 전체 답변으로 저장 (CleanupModal onApply 경유) */
  onApplyText?: (next: string) => void
  /** 서버가 저장한 마지막 점검 결과 (문항 데이터에서 전달) */
  lastFeedback?: CoverletterFeedback | null
  /** 마지막 점검 시각 (ISO) */
  lastFeedbackAt?: string | null
}

export function AiFeedbackSection({
  clId,
  answer,
  onApplyText,
  lastFeedback,
  lastFeedbackAt,
}: AiFeedbackSectionProps) {
  // 예시 적용 상태 — index 기준 (적용됨 / 원문 못 찾음)
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set())
  const [notFoundIdx, setNotFoundIdx] = useState<Set<number>>(new Set())
  const canApply = answer !== undefined && !!onApplyText

  const { blocked: quotaBlocked, reason: quotaReason } =
    useAiQuotaBlocked('coverletter_feedback')

  const entry = useAiFeedbackStore((s) => s.entries[clId])
  const requestFeedback = useAiFeedbackStore((s) => s.requestFeedback)
  const clear = useAiFeedbackStore((s) => s.clear)
  const ensureAiConsent = useRequireAiConsent()

  const runFeedback = async () => {
    if (!(await ensureAiConsent())) return
    requestFeedback(clId)
  }

  const status = entry?.status
  const isRunning = status === 'running'
  const isError = status === 'error'
  // 표시할 결과: 스토어 done 우선 → 없으면(idle) 저장된 lastFeedback
  const shownFeedback: CoverletterFeedback | undefined | null =
    status === 'done' ? entry?.result : !status ? lastFeedback : undefined
  // 저장된(신규 아님) 결과를 보여주는 중인지 — "N분 전 점검" 라벨 노출용
  const showSavedLabel = !status && !!lastFeedback && !!lastFeedbackAt

  const handleApplySuggestion = (i: number, target: string, improved: string) => {
    if (!canApply) return
    if (!answer.includes(target)) {
      setNotFoundIdx((prev) => new Set(prev).add(i))
      return
    }
    onApplyText(answer.replace(target, improved))
    setAppliedIdx((prev) => new Set(prev).add(i))
  }

  const handleRetry = async () => {
    if (!(await ensureAiConsent())) return
    setAppliedIdx(new Set())
    setNotFoundIdx(new Set())
    clear(clId)
    requestFeedback(clId)
  }

  return (
    <div className="mt-4 pt-4 border-t border-line">
      {/* idle 이고 저장된 결과도 없음 → 점검 받기 CTA */}
      {!isRunning && !isError && !shownFeedback && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-text-primary text-xs font-semibold">✨ AI 심층 점검</p>
            <p className="text-[11px] text-text-quaternary mt-0.5">
              AI 티 나는 문장 · 문항 부합 · 구조 · 글자수까지 짚어드려요 (약 10코인)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AiQuotaChip feature="coverletter_feedback" />
            <button
              onClick={() => runFeedback()}
              disabled={quotaBlocked}
              title={quotaReason ?? undefined}
              className="shrink-0 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              점검 받기
            </button>
          </div>
        </div>
      )}

      {/* 점검 중 — 모달을 닫아도 계속 진행 */}
      {isRunning && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-xs text-text-secondary font-medium animate-pulse">
            🔍 AI 가 점검 중이에요… 모달을 닫아도 계속 진행됩니다
          </p>
          <div className="space-y-1.5">
            <div className="h-3 w-2/3 bg-surface-3 rounded animate-pulse" />
            <div className="h-3 w-full bg-surface-3 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-surface-3 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* 에러 — 메시지 + 다시 시도 */}
      {isError && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-danger min-w-0">
            {entry?.errorMsg ?? '점검에 실패했어요.'}
          </p>
          <button
            onClick={() => runFeedback()}
            disabled={quotaBlocked}
            title={quotaReason ?? undefined}
            className="shrink-0 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 — 스토어 done 또는 저장된 lastFeedback */}
      {shownFeedback && (
        <div className="space-y-3 mt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-text-primary text-xs font-semibold">✨ AI 심층 점검 결과</p>
            {showSavedLabel && (
              <span className="shrink-0 text-[10px] text-text-quaternary">
                🕐 {relativeKo(lastFeedbackAt!)} 점검
              </span>
            )}
          </div>

          {shownFeedback.strengths.length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg px-3 py-2">
              {shownFeedback.strengths.map((st, i) => (
                <p key={i} className="text-[11px] text-text-secondary leading-relaxed">
                  👍 {st}
                </p>
              ))}
            </div>
          )}

          {shownFeedback.issues.map((issue, i) => (
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

          {shownFeedback.suggestions.length > 0 && (
            <div className="bg-card border border-line rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-[10px] text-text-quaternary font-medium">예시 방향 (참고용)</p>
              {shownFeedback.suggestions.map((sg, i) => (
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

          <p className="text-[11px] text-text-tertiary leading-relaxed">💬 {shownFeedback.summary}</p>

          {/* 결과가 보이는 동안엔 "점검 받기" 대신 재검사 */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-text-quaternary">
              점검은 짚어주기예요 — 고치는 건 본인 문장으로.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <AiQuotaChip feature="coverletter_feedback" />
              <button
                onClick={() => handleRetry()}
                disabled={quotaBlocked}
                className="shrink-0 text-[11px] font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={quotaReason ?? '답변을 다시 점검해요 (약 10코인)'}
              >
                ↻ 재검사
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
