import { Modal } from '@/components/common/Modal'
import { useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'
import { celebrate } from '@/stores/celebrationStore'

interface SetResultModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  companyName: string
}

export function SetResultModal({ open, onClose, applicationId, companyName }: SetResultModalProps) {
  const { mutate: update, isPending } = useUpdateApplication(applicationId)

  const handleResult = (status: 'PASSED' | 'FAILED') => {
    update(
      { status },
      {
        onSuccess: () => {
          onClose()
          if (status === 'PASSED') celebrate(companyName)
          else toast.success(`${companyName} 결과가 기록됐어요.`)
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
          className="flex-1 py-4 rounded-xl border border-line bg-card hover:bg-card-strong text-text-secondary font-medium text-sm transition-all disabled:opacity-50"
        >
          불합격
        </button>
      </div>
    </Modal>
  )
}
