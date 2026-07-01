import { Link, useNavigate } from 'react-router-dom'
import type { DdayItem, NextAction } from '@/api/dashboard'
import { useDemoMode } from '@/contexts/demoMode'

/**
 * 캘린더 UX 재구성 — 대형 Hero 카드 (가장 임박한 마감 1건).
 *
 * next_action 값별 CTA 라벨/링크 분기:
 *   writing_coverletter → "자소서 이어 쓰기" → /board/:id/coverletter
 *   start_coverletter   → "자소서 시작하기" → /board/:id/coverletter
 *   review_company      → "회사 조사 확인" → /board/:id#company-research
 *   confirm_submit      → "최종 검토" → /board/:id
 *   no_action (or step 아닌 exam) → "카드 열기" → /board/:id (default)
 *
 * streakDays >= 2 일 때만 "🔥 N일 연속" 배지 노출 (streak 끊긴 사용자에게 상처 X).
 * progress 있으면 자소서 진행률 bar.
 */
interface Props {
  event: DdayItem
  streakDays?: number
}

const CTA_LABEL: Record<NextAction, string> = {
  writing_coverletter: '자소서 이어 쓰기',
  start_coverletter: '자소서 시작하기',
  review_company: '회사 조사 확인',
  confirm_submit: '최종 검토',
  no_action: '카드 열기',
}

function ctaLinkPath(event: DdayItem): string {
  const appId = event.applicationId ?? ''
  const action = event.nextAction ?? 'no_action'
  switch (action) {
    case 'writing_coverletter':
    case 'start_coverletter':
      return `/board/${appId}/coverletter`
    case 'review_company':
      return `/board/${appId}#company-research`
    case 'confirm_submit':
    case 'no_action':
    default:
      return `/board/${appId}`
  }
}

function EventTypeLabel({ event }: { event: DdayItem }) {
  if (event.type === 'exam') return <>시험</>
  const stepName = event.stepName ?? ''
  if (/서류|공채|자소서|지원/.test(stepName)) return <>서류 마감</>
  if (/면접/.test(stepName)) return <>면접</>
  return <>{stepName}</>
}

export function CountdownHeroLarge({ event, streakDays }: Props) {
  const isDemo = useDemoMode()
  const navigate = useNavigate()

  const isExam = event.type === 'exam'
  const isUrgent = event.dday <= 2

  // 컬러 계열 — 긴급 (D-2 이내) 은 accent, 그 외 서류/면접은 warning, 시험은 violet
  const color = isExam ? 'violet' : isUrgent ? 'accent' : 'warning'
  const borderClass =
    color === 'accent'
      ? 'border-accent/25'
      : color === 'violet'
        ? 'border-violet/25'
        : 'border-warning/25'
  const textColor =
    color === 'accent'
      ? 'text-accent'
      : color === 'violet'
        ? 'text-violet'
        : 'text-warning'
  const ctaBg =
    color === 'accent'
      ? 'bg-accent hover:bg-accent-hover'
      : color === 'violet'
        ? 'bg-violet hover:bg-violet/90'
        : 'bg-brand hover:bg-brand-hover'

  const ctaLabel = CTA_LABEL[event.nextAction ?? 'no_action']
  const ctaPath = ctaLinkPath(event)
  const ctaTo = isDemo ? '/demo' + ctaPath : ctaPath

  const cardPath = `/board/${event.applicationId ?? ''}`
  const cardTo = isDemo ? '/demo' + cardPath : cardPath

  function handleCardClick(e: React.MouseEvent) {
    // CTA 버튼 등 내부 인터랙션은 카드 이동 무시
    if ((e.target as HTMLElement).closest('button, a')) return
    if (event.type === 'exam') return
    navigate(cardTo)
  }

  const showProgress =
    event.progress !== undefined && event.progress.total > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick(e as unknown as React.MouseEvent)
        }
      }}
      className={`group relative block rounded-2xl bg-surface p-7 cursor-pointer border ${borderClass} card-hover`}
    >
      <div className="grid grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${textColor}`}>
              {isUrgent && !isExam ? '긴급 · ' : ''}
              <EventTypeLabel event={event} />
            </span>
            {streakDays !== undefined && streakDays >= 2 && (
              <>
                <span className="text-[10px] text-text-quaternary">·</span>
                <span className="text-[10px] font-medium text-brand">
                  🔥 {streakDays}일 연속 작업 중
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                isExam
                  ? 'bg-violet/15 border border-violet/25'
                  : 'bg-warning/15 border border-warning/25'
              }`}
            >
              <span className={`text-lg font-bold ${isExam ? 'text-violet' : 'text-warning'}`}>
                {event.companyName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-text-primary leading-none">
                {event.companyName}
              </p>
              {event.stepName && (
                <p className="text-xs text-text-tertiary mt-1.5">{event.stepName}</p>
              )}
            </div>
          </div>

          {showProgress && (
            <div className="mt-5 max-w-[280px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-text-tertiary">자소서 진행</span>
                <span className="text-[10px] font-semibold text-text-secondary tabular-nums">
                  {event.progress!.current} / {event.progress!.total} 문항
                </span>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    color === 'accent'
                      ? 'bg-accent'
                      : color === 'violet'
                        ? 'bg-violet'
                        : 'bg-warning'
                  }`}
                  style={{ width: `${(event.progress!.current / event.progress!.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-quaternary">
                {isExam ? '시험' : '마감'}
              </span>
              <span className="text-text-secondary tabular-nums">
                {event.date}
                {event.scheduledTime && ` · ${event.scheduledTime}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-text-quaternary">남은</span>
              <span className={`font-semibold tabular-nums ${textColor}`}>
                {event.dday === 0 ? '오늘' : `${event.dday}일`}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Link
              to={ctaTo}
              className={`h-9 px-4 rounded-lg ${ctaBg} text-bg text-[11px] font-bold transition-colors inline-flex items-center`}
            >
              {ctaLabel}
            </Link>
            {!isExam && (
              <Link
                to={cardTo}
                className="h-9 px-3 rounded-lg border border-line-strong text-text-secondary hover:bg-surface-2 text-[11px] font-medium inline-flex items-center"
              >
                카드 열기
              </Link>
            )}
          </div>
        </div>

        <div className="text-right pr-1 self-start">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${textColor}`}>
            D-
          </p>
          <p className={`text-[96px] font-bold leading-none tabular-nums tracking-[-0.04em] ${textColor}`}>
            {event.dday}
          </p>
          <p className="text-[10px] text-text-quaternary mt-2 tabular-nums">{event.date}</p>
        </div>
      </div>
    </div>
  )
}
