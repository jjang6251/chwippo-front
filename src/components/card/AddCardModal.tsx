import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { useCreateApplication } from '@/hooks/useApplications'
import { serializeTags } from '@/utils/tags'
import { APPLICATION_TEMPLATES, getApplicationTemplate, recommendTemplate } from '@/utils/stepTemplates'
import { toast } from '@/stores/toastStore'
import { useTourStore } from '@/stores/tourStore'

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
  const [templateId, setTemplateId] = useState('general')
  const [templateTouched, setTemplateTouched] = useState(false)
  const { mutate: create, isPending } = useCreateApplication()
  const tourActive = useTourStore((s) => s.active)
  const tourStep = useTourStore((s) => s.step)
  const onCardCreated = useTourStore((s) => s.onCardCreated)

  const isPlanned = defaultStatus === 'PLANNED'
  // 사용자가 직접 고르기 전까지는 직군 태그·회사명 기반 추천을 따라감
  const effectiveTemplateId = templateTouched
    ? templateId
    : recommendTemplate({ jobCategories: tags, companyName })
  const templatePreview = getApplicationTemplate(effectiveTemplateId).steps.join(' → ')

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
        templateId: !isPlanned ? effectiveTemplateId : undefined,
      },
      {
        onSuccess: (data) => {
          toast.success(`${companyName} 카드가 추가됐어요.`)
          if (tourActive && tourStep === 4) onCardCreated(data.id)
          handleClose()
        },
        onError: () => toast.error('카드 추가에 실패했습니다.'),
      },
    )
  }

  const handleClose = () => {
    setCompanyName(''); setJobTitle(''); setTags([]); setDeadline('')
    setTemplateId('general'); setTemplateTouched(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={isPlanned ? '지원 예정 추가' : '지원 중으로 추가'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {tourActive && tourStep === 4 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-brand/10 border border-brand/20 rounded-lg">
            <span className="text-brand text-sm">💡</span>
            <p className="text-xs text-brand/90">회사 이름만 입력해도 지원 단계가 자동 생성돼요</p>
          </div>
        )}
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
            <label>
              <span className="block text-xs text-text-tertiary mb-1.5">
                전형 템플릿 <span className="text-text-quaternary">(만든 뒤 단계 자유 편집)</span>
              </span>
              <select
                value={effectiveTemplateId}
                onChange={(e) => { setTemplateTouched(true); setTemplateId(e.target.value) }}
                className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all [color-scheme:dark] cursor-pointer"
              >
                {APPLICATION_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <p className="mt-1.5 text-[11px] text-text-quaternary leading-relaxed">{templatePreview}</p>
          </div>
        )}

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
          <button type="submit" disabled={!companyName.trim() || isPending} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40">
            {isPending ? '추가 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
