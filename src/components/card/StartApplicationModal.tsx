import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'

interface StartApplicationModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  companyName: string
}

export function StartApplicationModal({ open, onClose, applicationId, companyName }: StartApplicationModalProps) {
  const [deadline, setDeadline] = useState('')
  const { mutate: update, isPending } = useUpdateApplication(applicationId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update(
      { status: 'IN_PROGRESS', deadline: deadline || undefined },
      {
        onSuccess: () => {
          toast.success(`${companyName} 지원을 시작했어요!`)
          setDeadline('')
          onClose()
        },
        onError: () => toast.error('업데이트에 실패했습니다.'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="지원 시작">
      <div className="mb-4">
        <p className="text-text-tertiary text-xs">
          <span className="text-text-primary font-medium">{companyName}</span> 지원을 시작합니다.
          마감일을 입력하면 D-day가 표시됩니다.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">서류 마감일 (선택)</label>
          <input
            autoFocus
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all [color-scheme:dark]"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">
            취소
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 text-xs font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40">
            {isPending ? '처리 중...' : '지원 시작'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
