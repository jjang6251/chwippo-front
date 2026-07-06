import { Modal } from '@/components/common/Modal'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'
import { celebrate, showFailedCare } from '@/stores/celebrationStore'

interface SetResultModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  companyName: string
}

/**
 * 결과 입력 모달.
 * A9 — 불합격 처리 성공 시 전역 FailedCareOverlay 호출 (CompanyCard 드롭다운
 * 경로와 단일 표면). 카드·모달이 FAILED 필터로 언마운트돼도 케어는 살아남음.
 */
export function SetResultModal({ open, onClose, applicationId, companyName }: SetResultModalProps) {
  const { mutate: update, isPending } = useUpdateApplication(applicationId)
  const { data: app } = useApplication(applicationId)

  const handleResult = (status: 'PASSED' | 'FAILED') => {
    // A9 — 스냅샷은 mutation 전에 캡처 (성공 후엔 캐시가 이미 갱신될 수 있음)
    const snapshot = app
      ? {
          applicationId,
          currentStepIndex: app.currentStepIndex,
          steps: (app.steps ?? []).map((st) => ({
            name: st.name,
            orderIndex: st.orderIndex,
          })),
        }
      : { applicationId, currentStepIndex: 0, steps: [] }
    update(
      { status },
      {
        onSuccess: () => {
          onClose()
          if (status === 'PASSED') celebrate(companyName)
          else showFailedCare(snapshot)
        },
        onError: () => toast.error('업데이트에 실패했습니다.'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="결과 입력">
      <p className="text-text-tertiary text-xs mb-5">
        <span className="text-text-primary font-medium">{companyName}</span> 최종 결과를 선택해주세요.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handleResult('PASSED')}
          disabled={isPending}
          className="flex-1 py-4 rounded-xl border border-success/30 bg-success/8 hover:bg-success/14 text-success font-medium text-sm transition-all disabled:opacity-50"
        >
          🎉 합격
        </button>
        <button
          onClick={() => handleResult('FAILED')}
          disabled={isPending}
          className="flex-1 py-4 rounded-xl border border-line bg-card hover:bg-card-strong active:bg-surface-3 text-text-secondary font-medium text-sm transition-all disabled:opacity-50"
        >
          불합격
        </button>
      </div>
    </Modal>
  )
}
