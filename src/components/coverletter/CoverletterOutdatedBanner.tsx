import { useState } from 'react'
import { GenerateCoverletterConfirmModal } from '@/components/common/GenerateCoverletterConfirmModal'
import { useGenerateCoverletter } from '@/hooks/useApplications'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { toast } from '@/stores/toastStore'
import type { Application } from '@/types/application'

interface Props {
  application: Application
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  return `${months}달 전`
}

/**
 * PR_B1c Phase G — 회사조사 outdated banner.
 *
 * 회사명/직무 변경 후 status='completed' 유지. 사용자 자각 + 재조사 CTA 제공.
 * outdated_at NULL 이면 렌더 X. 재조사 완료 시 backend 가 NULL reset → banner 사라짐.
 */
export function CoverletterOutdatedBanner({ application }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { mutate, isPending } = useGenerateCoverletter(application.id)
  const ensureAiConsent = useRequireAiConsent()

  if (!application.coverletterResearchOutdatedAt) return null

  const handleClick = async () => {
    if (!(await ensureAiConsent())) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    setConfirmOpen(false)
    mutate(undefined, {
      onSuccess: (result) => {
        if (result.status === 'completed') {
          toast.show('✨ 회사 정보 갱신 완료!')
        } else if (result.status === 'coin_insufficient') {
          toast.error(result.reason ?? '코인이 부족해요.')
        } else if (result.status === 'already_in_progress') {
          toast.show('이미 진행 중이에요.')
        }
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : '회사 정보 갱신 실패'
        toast.error(message)
      },
    })
  }

  return (
    <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-md px-4 py-3 mb-4">
      <span className="text-warning text-base" aria-hidden>
        ⚠️
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-text-secondary text-sm font-medium mb-0.5">
          회사 정보가 수정됐어요
        </p>
        <p className="text-text-quaternary text-xs leading-relaxed">
          현재 회사조사 결과는 이전 회사명·직무 기준이에요 (변경:{' '}
          {formatRelative(application.coverletterResearchOutdatedAt)}). 최신
          정보가 필요하면 다시 조사해보세요.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 bg-warning hover:bg-warning/80 text-bg text-xs font-semibold px-3 py-2 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        🔄 다시 조사 (🪙 50)
      </button>
      {confirmOpen && (
        <GenerateCoverletterConfirmModal
          companyName={application.companyName}
          onConfirm={handleConfirm}
          onClose={() => setConfirmOpen(false)}
          isPending={isPending}
        />
      )}
    </div>
  )
}
