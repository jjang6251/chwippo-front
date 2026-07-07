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
  /** PR UI — 그리드 셀용 컴팩트 size (Coverletters 모아보기). default=false (큰 panel) */
  compact?: boolean
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
  compact = false,
}: Props) {
  // PR UI — compact 시 size·padding·typography 다운스케일 (그리드 셀 적합)
  const wrapClass = compact
    ? 'border border-dashed rounded-md px-3 py-3 text-center'
    : 'border border-dashed rounded-xl px-6 py-10 text-center'
  const iconClass = compact ? 'text-lg mb-1' : 'text-2xl mb-2'
  const titleClass = compact
    ? 'text-text-secondary text-xs font-medium mb-1'
    : 'text-text-secondary text-sm font-medium mb-1'
  const descClass = compact
    ? 'text-text-quaternary text-[10px] leading-relaxed mb-2'
    : 'text-text-quaternary text-xs leading-relaxed mb-5'
  // PR UI — compact 도 모바일 터치 타겟 36px (이전 24px → 36px). 44px 권장에 가까움
  const buttonClass = compact
    ? 'text-xs font-semibold px-3 py-2 rounded-md min-h-[36px] inline-flex items-center justify-center'
    : 'text-sm font-semibold px-5 py-2.5 rounded-md'
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
      <div className={`${wrapClass} border-brand/40 bg-brand/5`}>
        <Spinner
          size={compact ? 20 : 32}
          className={`mx-auto text-brand ${compact ? 'mb-2' : 'mb-3'}`}
        />
        <p className={titleClass}>🔄 회사 정보를 조사 중이에요</p>
        {!compact && (
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
        )}
        {compact && (
          <p className="text-text-quaternary text-[10px]">
            1-2분 걸려요
            <span className="inline-flex ml-0.5">
              <span className="animate-pulse [animation-delay:0ms]">.</span>
              <span className="animate-pulse [animation-delay:200ms]">.</span>
              <span className="animate-pulse [animation-delay:400ms]">.</span>
            </span>
          </p>
        )}
      </div>
    )
  }

  if (status === 'completed') {
    // 회사조사 완료 + 자소서 row 0 인 케이스 (caller 가 자소서 row > 0 시 이 컴포넌트 안 부름)
    // → "자소서 작성 시작" link
    if (completedChildren) return <>{completedChildren}</>
    return (
      <div
        className={`${wrapClass} border-success/30 bg-success/5 border-solid`}
      >
        <div className={iconClass}>✅</div>
        <p className={titleClass}>회사 정보 준비 완료</p>
        <p className={descClass}>
          {compact
            ? '자소서 작성 시작 가능'
            : `${application.companyName} 자소서 작성을 시작할 수 있어요.`}
        </p>
        <Link
          to={`/board/${application.id}/coverletter`}
          className={`inline-block bg-brand hover:bg-brand-hover text-text-primary ${buttonClass} transition-colors`}
        >
          📝 자소서 작성 시작 →
        </Link>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className={`${wrapClass} border-danger/40 bg-danger/5`}>
        <div className={iconClass}>❌</div>
        <p className={titleClass}>회사 조사에 실패했어요</p>
        {!compact && (
          <p className={descClass}>
            회사 정보 조사 중 오류가 발생했어요. 다시 시도해주세요.
            <br />
            (실패 시 코인은 차감되지 않아요)
          </p>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className={`bg-brand hover:bg-brand-hover text-text-primary ${buttonClass} transition-colors disabled:opacity-50`}
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

  // 'idle' (default) — A1: "자소서 생성"이 아니라 "회사 조사" (선택적 부스터, 차단 아님)
  return (
    <div className={`${wrapClass} border-line bg-surface-2/30`}>
      <div className={iconClass}>🔎</div>
      <p className={titleClass}>
        {compact ? '회사 조사로 품질 올리기' : '회사 조사로 자소서 품질을 올려보세요'}
      </p>
      <p className={descClass}>
        {compact
          ? '🪙 약 50코인 · 초안·챗·점검에 회사 맥락 반영'
          : `${application.companyName} 의 최신 정보를 검색해`}
        {!compact && (
          <>
            <br />
            AI 초안·챗·점검에 회사 맥락이 반영돼요. (🪙 약 50코인)
            <br />
            <span className="text-text-quaternary">
              조사 없이도 자소서 작성은 자유롭게 가능해요
            </span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`bg-brand hover:bg-brand-hover text-text-primary ${buttonClass} transition-colors disabled:opacity-50`}
      >
        🔎 회사 조사 시작 (+약 50코인)
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
