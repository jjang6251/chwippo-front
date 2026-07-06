import { useState, useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import { CompanyAutocomplete } from '@/components/board/CompanyAutocomplete'
import { useCreateApplication } from '@/hooks/useApplications'
import { useAuthStore } from '@/stores/authStore'
import { serializeTags } from '@/utils/tags'
import {
  APPLICATION_TEMPLATES,
  getApplicationTemplate,
  recommendTemplate,
} from '@/utils/stepTemplates'
import { JOB_GROUPS, type JobCategory } from '@/utils/sampleData'
import { toast } from '@/stores/toastStore'
import { useTourStore } from '@/stores/tourStore'

interface AddCardModalProps {
  open: boolean
  onClose: () => void
  defaultStatus?: 'PLANNED' | 'IN_PROGRESS'
}

// 그룹별 컬러 (W1 SignupQuestion 패턴과 동일 — sage·coral·info·violet·warning·grey)
const GROUP_TOKEN: Record<string, { border: string; bg: string; text: string }> = {
  brand: { border: 'border-brand', bg: 'bg-brand/[0.14]', text: 'text-brand' },
  accent: { border: 'border-accent', bg: 'bg-accent/[0.14]', text: 'text-accent' },
  info: { border: 'border-info', bg: 'bg-info/[0.14]', text: 'text-info' },
  violet: { border: 'border-violet', bg: 'bg-violet/[0.14]', text: 'text-violet' },
  warning: { border: 'border-warning', bg: 'bg-warning/[0.14]', text: 'text-warning' },
  'text-tertiary': {
    border: 'border-text-tertiary',
    bg: 'bg-text-tertiary/[0.14]',
    text: 'text-text-tertiary',
  },
}

export function AddCardModal({
  open,
  onClose,
  defaultStatus = 'IN_PROGRESS',
}: AddCardModalProps) {
  const user = useAuthStore((s) => s.user)

  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [tags, setTags] = useState<JobCategory[]>([])
  const [deadline, setDeadline] = useState('')
  const [templateId, setTemplateId] = useState('general')
  const [templateTouched, setTemplateTouched] = useState(false)
  const [showMoreGroups, setShowMoreGroups] = useState(false)
  const { mutate: create, isPending } = useCreateApplication()
  const tourActive = useTourStore((s) => s.active)
  const tourStep = useTourStore((s) => s.step)
  const onCardCreated = useTourStore((s) => s.onCardCreated)

  const isPlanned = defaultStatus === 'PLANNED'
  // signup 답변 = pre-fill default (모달 open 시점 1회)
  const presetCategories = (user?.signupJobCategories ?? []) as JobCategory[]

  useEffect(() => {
    if (open) {
      // 모달 open 마다 signup default 로 reset (부모가 unmount 안 시키고 open prop 만 토글)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTags(presetCategories.length > 0 ? [presetCategories[0]] : [])
       
      setShowMoreGroups(false)
    }
    // presetCategories 변경 시점은 user 변경 = 모달 open 과 무관 → open 만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 사용자가 직접 고르기 전까지는 직군 태그·회사명 기반 추천을 따라감
  const effectiveTemplateId = templateTouched
    ? templateId
    : recommendTemplate({ jobCategories: tags, companyName })
  const templatePreview = getApplicationTemplate(effectiveTemplateId).steps.join(' → ')

  function toggleChip(cat: JobCategory) {
    setTags((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

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
    setCompanyName('')
    setJobTitle('')
    setTags([])
    setDeadline('')
    setTemplateId('general')
    setTemplateTouched(false)
    setShowMoreGroups(false)
    onClose()
  }

  // 처음 3 그룹 (A IT, B 디자인·기획, C 마케팅) + 더 보기로 나머지
  const primaryGroups = JOB_GROUPS.slice(0, 3)
  const secondaryGroups = JOB_GROUPS.slice(3)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isPlanned ? '지원 예정 추가' : '지원 중으로 추가'}
      width="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {tourActive && tourStep === 4 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-brand/10 border border-brand/20 rounded-lg">
            <span className="text-brand text-sm">💡</span>
            <p className="text-xs text-brand/90">
              회사 이름만 입력해도 지원 단계가 자동 생성돼요
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">회사명 *</label>
          <CompanyAutocomplete
            value={companyName}
            onChange={setCompanyName}
            autoFocus={open}
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">
            직무명{' '}
            {!isPlanned && <span className="text-text-quaternary">(나중에 입력 가능)</span>}
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={100}
            placeholder="예) 백엔드 개발자, iOS 개발자"
            className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs text-text-tertiary mb-1.5">
            직군{' '}
            {presetCategories.length > 0 && (
              <span className="text-text-quaternary">(signup 답변 자동 선택)</span>
            )}
          </label>

          <div className="flex flex-col gap-2">
            {primaryGroups.map((group) => (
              <GroupChips
                key={group.id}
                group={group}
                selected={tags}
                preset={presetCategories}
                onToggle={toggleChip}
                disabled={isPending}
              />
            ))}

            {!showMoreGroups ? (
              <button
                type="button"
                onClick={() => setShowMoreGroups(true)}
                className="self-start text-[11px] text-text-tertiary hover:text-text-primary font-mono tracking-wide py-1 transition-colors"
              >
                ▾ 더 보기 (D 경영지원 · E 산업 · 기타)
              </button>
            ) : (
              secondaryGroups.map((group) => (
                <GroupChips
                  key={group.id}
                  group={group}
                  selected={tags}
                  preset={presetCategories}
                  onToggle={toggleChip}
                  disabled={isPending}
                />
              ))
            )}
          </div>
        </div>

        {!isPlanned && (
          <div>
            <label>
              <span className="block text-xs text-text-tertiary mb-1.5">
                전형 템플릿{' '}
                <span className="text-text-quaternary">(만든 뒤 단계 자유 편집)</span>
              </span>
              <div className="relative">
                <select
                  value={effectiveTemplateId}
                  onChange={(e) => {
                    setTemplateTouched(true)
                    setTemplateId(e.target.value)
                  }}
                  className="w-full appearance-none bg-input border border-line rounded-lg pl-3 pr-9 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
                >
                  {APPLICATION_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
                >
                  <path
                    d="M2 4l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </label>
            <p className="mt-1.5 text-[11px] text-text-quaternary leading-relaxed">
              {templatePreview}
            </p>
          </div>
        )}

        {!isPlanned && (
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">서류 마감일</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!companyName.trim() || isPending}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-brand-hover active:bg-brand-hover rounded-lg transition-colors disabled:opacity-40"
          >
            {isPending ? '추가 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface GroupChipsProps {
  group: (typeof JOB_GROUPS)[number]
  selected: JobCategory[]
  preset: JobCategory[]
  onToggle: (cat: JobCategory) => void
  disabled?: boolean
}

function GroupChips({ group, selected, preset, onToggle, disabled }: GroupChipsProps) {
  const tok = GROUP_TOKEN[group.color]
  const hasActive = group.categories.some((c) => selected.includes(c))

  return (
    <div
      className={`bg-surface-2 rounded-lg p-2 sm:p-2.5 border transition-colors ${
        hasActive ? tok.border + '/30' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2 text-[10px] text-text-tertiary font-mono uppercase tracking-wider">
        <strong className={tok.text}>{group.label}</strong>
      </div>
      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {group.categories.map((cat) => {
          const active = selected.includes(cat)
          const isPreset = active && preset.includes(cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              disabled={disabled}
              aria-pressed={active}
              className={`
                relative px-2 py-1.5 sm:px-2.5 rounded-md text-[10px] sm:text-[11px] font-medium border
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  active
                    ? `${tok.bg} ${tok.border} ${tok.text} font-semibold`
                    : `bg-surface border-line text-text-secondary hover:-translate-y-0.5 hover:text-text-primary`
                }
              `}
            >
              {cat}
              {isPreset && (
                <span
                  className={`absolute -top-1.5 -right-1 text-[8px] px-1 py-px rounded font-mono tracking-wider text-white`}
                  style={{ background: `rgb(var(--${group.color === 'text-tertiary' ? 'text-tertiary' : group.color}))` }}
                  aria-hidden="true"
                >
                  signup
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
