import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { useUpdateApplication } from '@/hooks/useApplications'
import { serializeTags, parseTags } from '@/utils/tags'
import { toast } from '@/stores/toastStore'

interface StartApplicationModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  companyName: string
  currentCategory?: string | null
  /** 이미 적어둔 직무 — 비우면 안 되므로 prefill 한다 */
  currentJobTitle?: string | null
}

export function StartApplicationModal({
  open, onClose, applicationId, companyName, currentCategory, currentJobTitle,
}: StartApplicationModalProps) {
  const [deadline, setDeadline] = useState('')
  const [jobTitle, setJobTitle] = useState(currentJobTitle ?? '')
  const [tags, setTags] = useState<string[]>(() => parseTags(currentCategory ?? null))
  const { mutate: update, isPending } = useUpdateApplication(applicationId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update(
      {
        status: 'IN_PROGRESS',
        deadline: deadline || undefined,
        jobCategory: serializeTags(tags) || undefined,
        jobTitle: jobTitle.trim() || undefined,
      },
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
      <p className="text-text-tertiary text-xs mb-4">
        <span className="text-text-primary font-medium">{companyName}</span> 지원을 시작합니다.
        기본 4단계 스텝이 자동으로 생성됩니다.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">서류 마감일 (선택)</label>
          <input
            autoFocus
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>
        {/*
          지원 직무 (2026-08-06 추가) — 이 모달이 **지원 예정 → 지원 시작** 전환 지점이라
          사용자가 직무를 가장 확실히 아는 순간이다. 원래 직군 태그만 받아서, 이 경로로
          시작한 카드는 직무가 영영 비어 있었다. AI 결과 기준이 되는 값이다.
          라벨·플레이스홀더는 AddCardModal · 기본 정보 편집 · 게이트 모달과 통일.
        */}
        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">지원 직무</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={100}
            placeholder="예: 백엔드 개발자 / 퍼포먼스 마케터 / 재무회계"
            className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
          <p className="text-text-faint text-[11px] mt-1.5">
            자소서·면접 AI 가 <span className="text-text-tertiary">이 직무 기준</span>으로
            만들어요.
          </p>
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">직군 태그</label>
          <TagSelector selected={tags} onChange={setTags} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
            취소
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40">
            {isPending ? '처리 중...' : '지원 시작'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
