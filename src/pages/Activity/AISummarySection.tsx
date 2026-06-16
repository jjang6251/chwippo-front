import { useEffect, useState } from 'react'
import { toast } from '@/stores/toastStore'
import {
  useNoteSummaryStatus,
  useSummarizeLog,
} from '@/hooks/useActivities'
import { useAiQuotaBlocked, useMyAiQuota } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import type { ActivityLog, SummarizeNoteResult } from '@/types/activity'

const MIN_CHARS = 50

interface Props {
  log: ActivityLog
  /** 현재 에디터의 plain text 길이 (NoteEditor 가 onTextChange 로 알림) — 50자 미만 시 hint */
  currentTextLength: number
}

export function AISummarySection({ log, currentTextLength }: Props) {
  const summarize = useSummarizeLog(log.activityId)
  const ensureAiConsent = useRequireAiConsent()
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked('note_summary')
  const noteQuota = useMyAiQuota('note_summary')
  // 5.6.8 — 노트별 잔여 (mount 시 항상). lastResult 우선 (방금 호출 신선), 없으면 status fetch
  const { data: status } = useNoteSummaryStatus(log.id)
  const [lastResult, setLastResult] = useState<SummarizeNoteResult | null>(null)
  // 5.6.8 fix — 쿨다운 source 는 백엔드의 nextAvailableAt (페이지 전환 후 mount 시에도 유지)
  // 매초 tick 으로 (target - now) 재계산. target 만료 시 0 → setInterval 자동 종료
  const [cooldownLeft, setCooldownLeft] = useState(0)
  useEffect(() => {
    if (!noteQuota?.nextAvailableAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCooldownLeft(0)
      return
    }
    const target = new Date(noteQuota.nextAvailableAt).getTime()
    const compute = () => Math.max(0, Math.ceil((target - Date.now()) / 1000))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCooldownLeft(compute())
    if (compute() <= 0) return
    const id = setInterval(() => {
      const left = compute()
      setCooldownLeft(left)
      if (left <= 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [noteQuota?.nextAvailableAt])
  // 표시할 요약 텍스트: 방금 호출 결과 우선, 없으면 저장된 noteSummary
  const summary = lastResult?.summary ?? log.noteSummary
  const blockedReason = lastResult?.status === 'blocked' ? lastResult.reason : null
  const cached = lastResult?.cached ?? false
  // 5.6.8 — 노트별 잔여: lastResult (방금 호출) 우선, fallback status (mount fetch)
  const remainingPerNote =
    lastResult?.remainingPerNote ?? status?.remainingPerNote
  const perNoteLimit = lastResult?.perNoteLimit ?? status?.perNoteLimit ?? 5
  const perNoteUsed =
    lastResult?.remainingPerNote !== undefined
      ? perNoteLimit - lastResult.remainingPerNote
      : (status?.perNoteUsed ?? 0)
  const tooShort = currentTextLength < MIN_CHARS

  // stale 판정 — 저장된 요약이 있고, 노트가 그 이후 수정됨 (서버 updatedAt > noteSummaryAt)
  // 단, 방금 fresh 생성한 직후엔 stale 아님
  const justFreshLocal =
    lastResult?.status === 'ok' && !lastResult.cached
  const isStale =
    !justFreshLocal &&
    !!log.noteSummary &&
    !!log.noteSummaryAt &&
    new Date(log.updatedAt).getTime() > new Date(log.noteSummaryAt).getTime()

  async function handleClick(force = false) {
    if (tooShort || cooldownLeft > 0) return
    if (!(await ensureAiConsent())) return
    summarize.mutate(
      { logId: log.id, force },
      {
        onSuccess: (r) => {
          setLastResult(r)
          // 5.6.8 fix — optimistic: 백엔드 invalidate fetch 까지 짧은 lag 동안 즉시 차단
          // 새 nextAvailableAt 받으면 useEffect 가 정확한 값으로 갱신
          if (r.status === 'ok' || r.status === 'cached') {
            setCooldownLeft(30)
          }
          if (r.status === 'ok' && !r.cached) {
            toast.success('✨ 요약 생성됨')
          } else if (r.status === 'cached' || (r.status === 'ok' && r.cached)) {
            toast.show('캐시된 요약')
          } else if (r.status === 'blocked') {
            toast.error(r.reason ?? '요약 차단됨')
          }
        },
        onError: () => toast.error('요약 요청 중 오류가 발생했어요'),
      },
    )
  }

  // 버튼 라벨
  let btnLabel: string
  if (summarize.isPending) btnLabel = '✨ 요약중... (3-5초)'
  else if (cooldownLeft > 0) btnLabel = `⏳ ${cooldownLeft}초 후 다시 시도`
  else if (tooShort) btnLabel = '✨ 노트 더 작성하기'
  else if (isStale) btnLabel = '✨ 다시 요약 (변경됨)'
  else if (summary) btnLabel = '↻ 다시 생성'
  else btnLabel = '✨ 지금 요약'

  return (
    <div className="np-ai-summary">
      <div className="np-ai-summary-head">
        <span className="lbl">✨ AI 요약</span>
        {/* 5.6.8 — 노트당 잔여는 항상 표시 (status fetch 가 mount 시 보장) */}
        <span
          className={`quota${remainingPerNote !== undefined && remainingPerNote <= 0 ? ' exhausted' : ''}`}
        >
          오늘 노트당 {perNoteUsed}/{perNoteLimit}
        </span>
      </div>

      {/* 5.6.8 fix — 본문 우선 분기: 요약 있으면 본문 표시 + blocked/stale 안내는 하단 별도 */}
      {tooShort && !summary ? (
        <div className="np-ai-summary-hint">
          📝 노트를 <strong>{MIN_CHARS}자 이상</strong> 적어주세요 (현재{' '}
          {currentTextLength}자). 충분한 내용이 있어야 요약 가치가 있어요.
        </div>
      ) : summary ? (
        <>
          {isStale && (
            <div className="np-ai-summary-hint text-warning mb-1">
              ⚠ 노트가 변경됐어요. 최신 내용으로 다시 요약하세요.
            </div>
          )}
          <div className={`np-ai-summary-text${isStale ? ' stale' : ''}`}>
            {summary}
          </div>
          <div className="np-ai-summary-meta mt-1 text-[10px] text-text-quaternary">
            {isStale
              ? '⚠ 옛 요약 — 자소서·면접 AI 는 옛 내용으로 답변할 수 있어요'
              : `${cached ? '캐시 반환' : '방금 생성'} · 자소서·면접 AI 가 이 요약을 소비합니다`}
          </div>
          {blockedReason && (
            <div className="np-ai-summary-hint text-warning mt-2">
              ⚠ {blockedReason}
            </div>
          )}
        </>
      ) : blockedReason ? (
        <div className="np-ai-summary-hint text-warning">⚠ {blockedReason}</div>
      ) : (
        <div className="np-ai-summary-hint">
          노트를 자세히 적고 요약을 해두면{' '}
          <strong>자소서·면접 AI 답변 품질이 평균 3배 풍부</strong>해져요.
        </div>
      )}

      <button
        type="button"
        className={`np-ai-summary-btn${cooldownLeft > 0 ? ' cooldown' : ''}`}
        disabled={tooShort || summarize.isPending || cooldownLeft > 0 || quotaBlocked}
        onClick={() => handleClick(!!summary)}
        title={quotaReason ?? undefined}
      >
        {btnLabel}
      </button>
      {/* 5.6.8 — 전체 사용량 항상 표시 (사용/한도 형식, 노트당 표기와 통일) */}
      {noteQuota && (
        <div className="np-ai-summary-totals">
          오늘 {noteQuota.dayUsed}/{noteQuota.dayLimit}회 ·
          이번 달 {noteQuota.monthUsed}/{noteQuota.monthLimit}회
        </div>
      )}
    </div>
  )
}
