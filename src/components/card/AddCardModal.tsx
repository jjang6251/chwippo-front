import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { useCreateApplication } from '@/hooks/useApplications'
import { serializeTags } from '@/utils/tags'
import { toast } from '@/stores/toastStore'

interface AddCardModalProps {
  open: boolean
  onClose: () => void
  defaultStatus?: 'PLANNED' | 'IN_PROGRESS'
}

export function AddCardModal({ open, onClose, defaultStatus = 'IN_PROGRESS' }: AddCardModalProps) {
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const { mutate: create, isPending } = useCreateApplication()

  const isPlanned = defaultStatus === 'PLANNED'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return

    create(
      {
        companyName: companyName.trim(),
        jobTitle: jobTitle.trim() || undefined,
        jobCategory: serializeTags(tags) || undefined,
        status: defaultStatus,
        deadline: deadline || undefined,
        needsDetail: !isPlanned && !jobTitle.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`${companyName} 카드가 추가됐어요.`)
          handleClose()
        },
        onError: () => toast.error('카드 추가에 실패했습니다.'),
      },
    )
  }

  const handleClose = () => {
    setCompanyName(''); setJobTitle(''); setTags([]); setDeadline('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={isPlanned ? '지원 예정 추가' : '지원 중으로 추가'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">회사명 *</label>
          <input
            autoFocus
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="예) 카카오, 네이버, 삼성전자"
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">
            직무명{' '}
            {!isPlanned && <span className="text-text-quaternary">(나중에 입력 가능)</span>}
          </label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="예) 백엔드 개발자, iOS 개발자"
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">직군 태그</label>
          <TagSelector selected={tags} onChange={setTags} />
        </div>

        {!isPlanned && (
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">서류 마감일</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all [color-scheme:dark]"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">
            취소
          </button>
          <button type="submit" disabled={!companyName.trim() || isPending} className="flex-1 py-2.5 text-xs font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40">
            {isPending ? '추가 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
