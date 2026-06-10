/**
 * PR_B2 Phase 4 — admin audit log detail 의 시각 표시 컴포넌트.
 *
 * action 별 detail JSON 의 핵심 key 만 한국어 라벨로 강조. 나머지는 expand 시 raw JSON.
 */

const KEY_LABEL_KR: Record<string, string> = {
  amount: '코인',
  reason: '사유',
  memo: '메모',
  expiresAt: '만료',
  expires_at: '만료',
  suspendReason: '정지 사유',
  fromTier: '이전 tier',
  toTier: '새 tier',
  applyMode: '적용 시점',
  appliedImmediately: '즉시 적용',
  planExpiresAt: 'Plan 만료',
  monthlyCoinLimit: '월 한도',
  inputTokenCapPerCall: 'Input cap',
  defaultCooldownSeconds: 'Cooldown 초',
  companyResearchDailyCap: '회사조사 일 cap',
  noteSummaryCooldownMinutes: '노트 cooldown 분',
  priceKrw: '가격(원)',
  active: '활성',
  chargesCoins: '코인 차감',
  fixedCoinCost: '고정 코인',
  avgCoinCost: '평균 코인',
  description: '설명',
  affectedUsers: '영향 사용자 수',
  before: '이전',
  after: '이후',
  fromAssignedTo: '이전 담당자',
  toAssignedTo: '새 담당자',
  fromPriority: '이전 우선순위',
  toPriority: '새 우선순위',
  recalcSla: '기한 재계산',
  newSlaDeadline: '새 처리 기한',
  fromSlaDeadlineAt: '이전 처리 기한',
  toSlaDeadlineAt: '새 처리 기한',
  trigger: '트리거',
  fieldsChanged: '변경 필드',
  threshold: '임계치',
  value: '값',
}

const APPLY_MODE_LABEL: Record<string, string> = {
  immediate: '즉시',
  next_reset: '다음 reset',
  next_cycle: '다음 cycle',
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (key === 'applyMode' && typeof value === 'string') {
    return APPLY_MODE_LABEL[value] ?? value
  }
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    return new Date(value).toLocaleString('ko-KR')
  }
  if (typeof value === 'object') {
    // before/after 같은 nested object 는 별도 렌더링
    return ''
  }
  return String(value)
}

function isNestedObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  )
}

export function AuditDetailView({
  detail,
}: {
  detail: Record<string, unknown>
}) {
  const entries = Object.entries(detail)
  if (entries.length === 0) {
    return <span className="text-text-quaternary text-[10px]">(detail 없음)</span>
  }

  return (
    <ul className="space-y-0.5 text-[10px]">
      {entries.map(([key, value]) => {
        const label = KEY_LABEL_KR[key] ?? key
        if (isNestedObject(value)) {
          // before/after 같은 nested object — inline diff 표시
          return (
            <li key={key}>
              <span className="text-text-quaternary">{label}:</span>{' '}
              <span className="text-text-tertiary">
                {Object.entries(value)
                  .map(
                    ([k, v]) =>
                      `${KEY_LABEL_KR[k] ?? k}=${formatValue(k, v)}`,
                  )
                  .join(', ')}
              </span>
            </li>
          )
        }
        return (
          <li key={key}>
            <span className="text-text-quaternary">{label}:</span>{' '}
            <span className="text-text-secondary font-medium">
              {formatValue(key, value)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
