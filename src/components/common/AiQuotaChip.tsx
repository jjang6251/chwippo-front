import { useEffect, useState } from 'react'
import { useMyAiQuota } from '@/hooks/useMyAiQuotas'
import type { LlmFeature } from '@/types/aiQuota'

interface Props {
  feature: LlmFeature
  size?: 'sm' | 'md'
}

interface ChipState {
  variant: 'normal' | 'warn' | 'danger' | 'disabled'
  label: string
  tooltip: string
}

/**
 * F6 PR 2 Phase 5.1 + 5.6.2 — AI 호출 버튼 옆 chip.
 *
 * **표시 조건 (5.6.2 변경)** — admin 이 의식적으로 제한 걸 때만 표시:
 *   - enabled=false (kill switch — 항상)
 *   - cooldown 활성 (nextAvailableAt 미래)
 *   - dayLimit ≤ 100 AND dayUsed ≥ 20% (한도 임박)
 *   - day/month 한도 소진
 *   - 그 외 (1000/10000 같은 무제한 + 한가) → 숨김
 *
 * silent fail — API 실패·로딩 중엔 chip 숨김 (부모 버튼은 정상 동작).
 */
export function AiQuotaChip({ feature, size = 'sm' }: Props) {
  const quota = useMyAiQuota(feature)
  // cooldown 활성(nextAvailableAt 미래) 일 때만 매초 tick 으로 리렌더 → "⏳ N초" 실시간 감소.
  // cooldown 없으면 interval 아예 안 걸어 다수 chip 렌더 시 낭비 방지.
  const cooldownTarget =
    quota?.nextAvailableAt ? new Date(quota.nextAvailableAt).getTime() : null
  const [, setTick] = useState(0)
  useEffect(() => {
    if (cooldownTarget == null || cooldownTarget <= Date.now()) return
    const id = setInterval(() => {
      setTick((t) => t + 1)
      if (cooldownTarget <= Date.now()) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownTarget])

  if (!quota) return null
  if (!shouldShow(quota)) return null

  const state = computeState(quota)

  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  const colorClass: Record<ChipState['variant'], string> = {
    normal: 'text-text-tertiary bg-card border-line',
    warn: 'text-warning bg-warning/10 border-warning/25',
    danger: 'text-danger bg-danger/10 border-danger/25',
    disabled: 'text-text-quaternary bg-card border-line',
  }

  return (
    <span
      className={`inline-flex items-center ${pad} rounded-full border font-mono font-semibold ${colorClass[state.variant]}`}
      title={state.tooltip}
    >
      {state.label}
    </span>
  )
}

/** 5.6.2 — admin 이 의식적 제한 건 경우만 chip 표시. 기본 무제한 (1000/10000) 은 hide */
function shouldShow(quota: {
  enabled: boolean
  dayUsed: number
  dayLimit: number
  monthUsed: number
  monthLimit: number
  nextAvailableAt: string | null
}): boolean {
  if (!quota.enabled) return true
  if (quota.nextAvailableAt && new Date(quota.nextAvailableAt) > new Date()) return true
  if (quota.dayUsed >= quota.dayLimit) return true
  if (quota.monthUsed >= quota.monthLimit) return true
  // 한도 ≤ 100 이고 20% 이상 사용 — admin 가 의식적으로 좁은 한도 설정
  const dayThreshold = Math.max(1, Math.ceil(quota.dayLimit * 0.2))
  if (quota.dayLimit <= 100 && quota.dayUsed >= dayThreshold) return true
  return false
}

function computeState(quota: {
  enabled: boolean
  dayUsed: number
  dayLimit: number
  monthUsed: number
  monthLimit: number
  cooldownSeconds: number
  nextAvailableAt: string | null
}): ChipState {
  if (!quota.enabled) {
    return {
      variant: 'disabled',
      label: '🚧 일시 중단',
      tooltip: '관리자가 일시적으로 비활성화한 기능입니다.',
    }
  }

  if (quota.nextAvailableAt) {
    const next = new Date(quota.nextAvailableAt)
    const sec = Math.max(0, Math.ceil((next.getTime() - Date.now()) / 1000))
    if (sec > 0) {
      return {
        variant: 'warn',
        label: `⏳ ${formatSeconds(sec)}`,
        tooltip: `다음 호출까지 ${formatSeconds(sec)}. 너무 자주 호출하지 못하게 cooldown 이 걸려 있어요.`,
      }
    }
  }

  const dayLeft = quota.dayLimit - quota.dayUsed
  const monthLeft = quota.monthLimit - quota.monthUsed

  if (dayLeft <= 0) {
    return {
      variant: 'danger',
      label: '오늘 한도 소진',
      tooltip: `오늘 ${quota.dayLimit}회를 모두 사용했어요. 내일 다시 시도해주세요.`,
    }
  }
  if (monthLeft <= 0) {
    return {
      variant: 'danger',
      label: '이번 달 소진',
      tooltip: `이번 달 ${quota.monthLimit}회를 모두 사용했어요. 다음 달에 다시 시도해주세요.`,
    }
  }

  const variant: ChipState['variant'] = dayLeft <= Math.max(1, Math.ceil(quota.dayLimit * 0.2)) ? 'warn' : 'normal'
  return {
    variant,
    label: `잔여 ${dayLeft}/${quota.dayLimit}회`,
    tooltip: `오늘 ${quota.dayUsed}/${quota.dayLimit}회 사용. 이번 달 ${quota.monthUsed}/${quota.monthLimit}회.`,
  }
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}초`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  // 초 병기 — 분 단위 반올림이면 120초 cooldown 에서 tick 체감이 없음
  if (m < 60) return `${m}분 ${s}초`
  return `${Math.floor(m / 60)}시간`
}
