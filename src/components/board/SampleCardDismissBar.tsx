import { useState } from 'react'
import { useDismissAllSampleCards } from '@/hooks/useDismissSampleCards'
import { ConfirmModal } from '@/pages/Activity/modals/ConfirmModal'
import { toast } from '@/stores/toastStore'

/**
 * W1 — 보드 상단 sticky 바.
 * "📌 샘플 카드 N개가 보이는 중이에요" + "전체 숨기기" CTA → ConfirmModal → mutate.
 * 영구 dismiss 라 파괴적 액션 = ConfirmModal 패턴 (ui-specs.md 표준).
 */
interface Props {
  count: number
}

export function SampleCardDismissBar({ count }: Props) {
  const dismiss = useDismissAllSampleCards()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    dismiss.mutate(undefined, {
      onSuccess: () => {
        toast.show('샘플 카드를 정리했어요')
        setConfirmOpen(false)
      },
      onError: () => {
        toast.error('숨기기에 실패했어요. 다시 시도해주세요.')
        setConfirmOpen(false)
      },
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-warning/[0.06] border border-warning/[0.18] rounded-[10px] mb-4">
        <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
          <span className="text-sm shrink-0">📌</span>
          <span className="truncate">
            <strong className="text-warning font-semibold">샘플 카드 {count}개</strong>
            가 보이는 중이에요 · 익숙해지셨으면 정리하세요
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={dismiss.isPending}
          className="
            shrink-0 bg-transparent border border-line-strong rounded-md
            px-3 py-2 text-xs font-medium text-text-tertiary min-h-[32px]
            hover:text-text-primary hover:border-text-tertiary
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {dismiss.isPending ? '숨기는 중…' : '전체 숨기기'}
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        emoji="📌"
        title={`샘플 카드 ${count}개를 모두 숨길까요?`}
        desc="되돌릴 수 없어요. 진짜 카드는 그대로 남아요."
        confirmLabel="모두 숨기기"
        danger={false}
        pending={dismiss.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}
