import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { DdayItem, NextAction } from '@/api/dashboard'
import { useDemoMode } from '@/contexts/demoMode'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** ISO 날짜 → "7월 3일 (금)" 한국어 포맷 */
function formatDateKo(iso: string): string {
  const d = dayjs(iso)
  return `${d.month() + 1}월 ${d.date()}일 (${KO_DAYS[d.day()]})`
}

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
  const aiEnabled = useAiEnabled()

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

  // AI hide 중이면 자소서 관련 next_action 을 no_action 으로 강등 (자소서 페이지가 hide 상태)
  const effectiveAction: NextAction = !aiEnabled &&
    (event.nextAction === 'writing_coverletter' ||
      event.nextAction === 'start_coverletter' ||
      event.nextAction === 'review_company' ||
      event.nextAction === 'confirm_submit')
    ? 'no_action'
    : event.nextAction ?? 'no_action'
  const ctaLabel = CTA_LABEL[effectiveAction]
  const ctaPath = effectiveAction === 'no_action' ? `/board/${event.applicationId ?? ''}` : ctaLinkPath(event)
  const ctaTo = isDemo ? '/demo' + ctaPath : ctaPath

  const cardPath = `/board/${event.applicationId ?? ''}`
  const cardTo = isDemo ? '/demo' + cardPath : cardPath

  // AI hide 상태에서는 자소서 진행률도 표시 안 함 (자소서 페이지 자체가 hide 되어 있어 진행률 무의미)
  const showProgress =
    aiEnabled && event.progress !== undefined && event.progress.total > 0

  return (
    <div
      className={`relative block rounded-2xl bg-surface p-7 border ${borderClass}`}
    >
      <div className="grid grid-cols-[1fr_auto] gap-6 items-end">
        {/* M1 — 임의값 1fr 셀은 min=auto (DESIGN.md 규칙 3) → min-w-0 로 truncate 활성 */}
        <div className="min-w-0">
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
            {/* domain 있으면 Google s2 favicon → onError 시 CompanyAvatar 내부 해시 아바타 fallback */}
            <CompanyAvatar
              name={event.companyName}
              domain={event.domain}
              size="lg"
              className={
                isExam
                  ? 'border border-violet/25'
                  : 'border border-warning/25'
              }
            />
            {/* M1 — truncate 활성용 min-w-0 · M7 — 회사명 leading-none 제거(안전 행간) */}
            <div className="min-w-0">
              <p className="text-xl font-bold tracking-tight text-text-primary leading-tight truncate">
                {event.companyName}
              </p>
              {event.stepName && (
                <p className="text-xs text-text-tertiary mt-1.5 truncate">{event.stepName}</p>
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

          {/* U21 — CTA 버튼 행 flex-wrap (좁은 폭에서 카드 밖으로 밀지 않음) */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              to={ctaTo}
              className={`h-9 px-4 rounded-lg ${ctaBg} text-bg text-[11px] font-bold transition-colors inline-flex items-center`}
            >
              {ctaLabel}
            </Link>
            {/* Secondary "카드 열기" 는 primary CTA 가 이미 "카드 열기" 인 경우 중복 노출 방지 */}
            {!isExam && ctaLabel !== '카드 열기' && (
              <Link
                to={cardTo}
                className="h-9 px-3 rounded-lg border border-line-strong text-text-secondary hover:bg-surface-2 text-[11px] font-medium inline-flex items-center"
              >
                카드 열기
              </Link>
            )}
            {/* 공고 URL — step 카드에만 노출 (exam 은 URL 없음). 외부 링크 → new tab + noopener */}
            {!isExam && event.jobUrl && (
              <a
                href={event.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg border border-line-strong text-text-secondary hover:bg-surface-2 text-[11px] font-medium inline-flex items-center gap-1.5"
                title={event.jobUrl}
              >
                공고
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 2h6v6" />
                  <path d="M10 2L5 7" />
                  <path d="M9 8v2H2V3h2" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* D-day 표시 — 크기 통일 (text-4xl) · 오늘은 "D-DAY" · 지난 마감은 "D+N" */}
        <div className="text-right pr-1 self-start">
          {event.dday === 0 ? (
            <p className={`text-4xl font-bold leading-none tracking-[-0.04em] ${textColor}`}>
              D-DAY
            </p>
          ) : (
            <p className={`text-4xl font-bold leading-none tabular-nums tracking-[-0.05em] ${textColor}`}>
              D{event.dday > 0 ? '−' : '+'}{Math.abs(event.dday)}
            </p>
          )}
          <p className="text-[11px] text-text-tertiary mt-2 tabular-nums">
            {formatDateKo(event.date)}
          </p>
        </div>
      </div>
    </div>
  )
}
