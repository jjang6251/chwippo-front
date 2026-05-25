import { useEffect, useRef, useState } from 'react'
import { toast } from '@/stores/toastStore'
import { useSummarizeLog } from '@/hooks/useActivities'
import type { ActivityLog, SummarizeNoteResult } from '@/types/activity'

const MIN_CHARS = 50
const COOLDOWN_MS = 30_000 // mock 5741 — 같은 노트 30초 쿨다운 (UI 만, 백엔드는 별도 quota)

interface Props {
  log: ActivityLog
  /** 현재 에디터의 plain text 길이 (NoteEditor 가 onTextChange 로 알림) — 50자 미만 시 hint */
  currentTextLength: number
}

export function AISummarySection({ log, currentTextLength }: Props) {
  const summarize = useSummarizeLog(log.activityId)
  const [lastResult, setLastResult] = useState<SummarizeNoteResult | null>(null)
  // 30초 쿨다운 — 호출 성공/캐시 시 lastCallAt set, 매초 tick 으로 남은 시간 계산
  const lastCallAtRef = useRef<number>(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  useEffect(() => {
    if (cooldownLeft <= 0) return
    const id = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((lastCallAtRef.current + COOLDOWN_MS - Date.now()) / 1000),
      )
      setCooldownLeft(left)
    }, 250)
    return () => clearInterval(id)
  }, [cooldownLeft])
  // 표시할 요약 텍스트: 방금 호출 결과 우선, 없으면 저장된 noteSummary
  const summary = lastResult?.summary ?? log.noteSummary
  const blockedReason = lastResult?.status === 'blocked' ? lastResult.reason : null
  const cached = lastResult?.cached ?? false
  const remainingPerNote = lastResult?.remainingPerNote
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
    summarize.mutate(
      { logId: log.id, force },
      {
        onSuccess: (r) => {
          setLastResult(r)
          // 호출 성공·캐시 시 30초 쿨다운 시작 (blocked 는 카운팅 X — 실제 호출 안 됐으니)
          if (r.status === 'ok' || r.status === 'cached') {
            lastCallAtRef.current = Date.now()
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
  if (summarize.isPending) btnLabel = '✨ 생성 중...'
  else if (cooldownLeft > 0) btnLabel = `⏳ ${cooldownLeft}초 후 다시 시도`
  else if (tooShort) btnLabel = '✨ 노트 더 작성하기'
  else if (isStale) btnLabel = '✨ 다시 요약 (변경됨)'
  else if (summary) btnLabel = '↻ 다시 생성'
  else btnLabel = '✨ 지금 요약'

  return (
    <div className="np-ai-summary">
      <div className="np-ai-summary-head">
        <span className="lbl">✨ AI 요약</span>
        {remainingPerNote !== undefined && remainingPerNote >= 0 && (
          <span
            className={`quota${remainingPerNote === 0 ? ' exhausted' : ''}`}
          >
            오늘 노트당 {5 - remainingPerNote}/5
          </span>
        )}
      </div>

      {/* hint / blocked / 요약 표시 분기 */}
      {blockedReason ? (
        <div className="np-ai-summary-hint text-warning">
          ⚠ {blockedReason}
        </div>
      ) : tooShort ? (
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
        </>
      ) : (
        <div className="np-ai-summary-hint">
          노트를 자세히 적고 요약을 해두면{' '}
          <strong>자소서·면접 AI 답변 품질이 평균 3배 풍부</strong>해져요.
        </div>
      )}

      <button
        type="button"
        className={`np-ai-summary-btn${cooldownLeft > 0 ? ' cooldown' : ''}`}
        disabled={tooShort || summarize.isPending || cooldownLeft > 0}
        onClick={() => handleClick(!!summary)}
      >
        {btnLabel}
      </button>
    </div>
  )
}
