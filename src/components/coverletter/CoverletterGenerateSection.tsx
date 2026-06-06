import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/components/common/Spinner'
import { GenerateCoverletterConfirmModal } from '@/components/common/GenerateCoverletterConfirmModal'
import { useGenerateCoverletter } from '@/hooks/useApplications'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { toast } from '@/stores/toastStore'
import type { Application } from '@/types/application'

interface Props {
  application: Application
  /** 완료 시 자소서 카드/페이지로 진입할 수 있도록 children 으로 갱신 후 표시 (옵션) */
  completedChildren?: React.ReactNode
}

/**
 * PR_B1c — 자소서 생성 4 상태 통합 UI.
 *
 * 사용처: Coverletters 페이지 + BoardDetail 의 자소서 탭 (양쪽 동일 동작).
 *
 * **상태 별 UI**:
 * - 'idle': "✨ 자소서 생성하기" 버튼 → 클릭 → ConfirmModal
 * - 'in_progress': "🔄 회사 정보 조사 중..." spinner (양쪽 페이지 polling 으로 동기화)
 * - 'completed': completedChildren 표시 (자소서 카드 / 작성 진입 등)
 * - 'failed': "❌ 조사 실패 — 다시 시도" 버튼
 *
 * **자동 동기화**:
 * - useApplication 의 refetchInterval 3초 (in_progress 일 때) → 양쪽 페이지 자동 갱신
 * - mutation onSuccess → application invalidate → polling 다음 tick 까지 spinner 유지
 */
export function CoverletterGenerateSection({
  application,
  completedChildren,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { mutate, isPending } = useGenerateCoverletter(application.id)
  const ensureAiConsent = useRequireAiConsent()

  const status = application.coverletterGenerationStatus ?? 'idle'

  const handleClick = async () => {
    if (!(await ensureAiConsent())) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    // PR_B1c Phase E — modal 즉시 close → polling 으로 in_progress spinner 표시.
    //   기존: mutation 끝까지 (1-2분) modal 의 isPending 그대로 → 사용자 답답함.
    setConfirmOpen(false)
    mutate(undefined, {
      onSuccess: (result) => {
        if (result.status === 'completed') {
          toast.show('✨ 자소서 작성 준비 완료!')
        } else if (result.status === 'already_in_progress') {
          toast.show('이미 생성 진행 중이에요.')
        } else if (result.status === 'already_completed') {
          toast.show('이미 완료된 자소서가 있어요.')
        } else if (result.status === 'coin_insufficient') {
          toast.error(result.reason ?? '코인이 부족해요.')
        }
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : '자소서 생성에 실패했어요.'
        toast.error(message)
      },
    })
  }

  // ── 상태 별 UI ──

  if (status === 'in_progress') {
    return (
      <div className="border border-dashed border-brand/40 bg-brand/5 rounded-xl px-6 py-10 text-center">
        <Spinner size={32} className="mx-auto text-brand mb-3" />
        <p className="text-text-secondary text-sm font-medium mb-1">
          🔄 회사 정보를 조사 중이에요
        </p>
        <p className="text-text-quaternary text-xs leading-relaxed">
          자소서 작성을 위한 회사 정보·직무 분석을 준비하고 있어요. 1-2분
          걸려요.
          <br />
          창을 닫아도 자동으로 진행되니 잠시만 기다려주세요
          <span className="inline-flex ml-0.5">
            <span className="animate-pulse [animation-delay:0ms]">.</span>
            <span className="animate-pulse [animation-delay:200ms]">.</span>
            <span className="animate-pulse [animation-delay:400ms]">.</span>
          </span>
        </p>
      </div>
    )
  }

  if (status === 'completed') {
    // 회사조사 완료 + 자소서 row 0 인 케이스 (caller 가 자소서 row > 0 시 이 컴포넌트 안 부름)
    // → "자소서 작성 시작" link
    if (completedChildren) return <>{completedChildren}</>
    return (
      <div className="border border-success/30 bg-success/5 rounded-xl px-6 py-10 text-center">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-text-secondary text-sm font-medium mb-1">
          회사 정보 준비 완료
        </p>
        <p className="text-text-quaternary text-xs leading-relaxed mb-5">
          {application.companyName} 자소서 작성을 시작할 수 있어요.
        </p>
        <Link
          to={`/board/${application.id}/coverletter`}
          className="inline-block bg-brand hover:bg-brand-hover text-text-primary text-sm font-semibold px-5 py-2.5 rounded-md transition-colors"
        >
          📝 자소서 작성 시작 →
        </Link>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="border border-dashed border-danger/40 bg-danger/5 rounded-xl px-6 py-10 text-center">
        <div className="text-2xl mb-2">❌</div>
        <p className="text-text-secondary text-sm font-medium mb-1">
          자소서 생성에 실패했어요
        </p>
        <p className="text-text-quaternary text-xs leading-relaxed mb-4">
          회사 정보 조사 중 오류가 발생했어요. 다시 시도해주세요.
          <br />
          (실패 시 코인은 차감되지 않아요)
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="bg-brand hover:bg-brand-hover text-text-primary text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          🔄 다시 시도하기
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

  // 'idle' (default)
  return (
    <div className="border border-dashed border-line bg-surface-2/30 rounded-xl px-6 py-10 text-center">
      <div className="text-2xl mb-2">✨</div>
      <p className="text-text-secondary text-sm mb-2">
        아직 자소서 작성이 시작되지 않았어요
      </p>
      <p className="text-text-quaternary text-xs leading-relaxed mb-5">
        {application.companyName} 의 회사 정보를 자동 조사하고
        <br />
        자소서 작성을 시작할 수 있어요. (🪙 50 코인)
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="bg-brand hover:bg-brand-hover text-text-primary text-sm font-semibold px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
      >
        ✨ 자소서 생성하기
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
