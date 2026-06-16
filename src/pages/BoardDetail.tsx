import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { goBack } from '@/utils/navigation'
import dayjs from 'dayjs'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApplication, useUpdateApplication, useUpdateCurrentStep, useUpdateSteps } from '@/hooks/useApplications'
import type { UpdateApplicationDto } from '@/types/application'
import { useUpdateStep } from '@/hooks/useStepDetail'
import { StepBar } from '@/components/card/StepBar'
import { StepDetailPanel } from '@/components/card/StepDetailPanel'
import { CoverLetterTab } from '@/components/card/CoverLetterTab'
import { InterviewPrepTab } from '@/components/card/InterviewPrepTab'
import { DdayBadge } from '@/components/card/DdayBadge'
import { StarToggle } from '@/components/card/StarToggle'
import { SetResultModal } from '@/components/card/SetResultModal'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { toast } from '@/stores/toastStore'
import { celebrate } from '@/stores/celebrationStore'
import { useTourStore } from '@/stores/tourStore'
import { parseTags, serializeTags, JOB_CATEGORY_COLOR, JOB_CATEGORY_EMOJI } from '@/utils/tags'

// --- 드래그 가능한 스텝 아이템 ---
interface SortableStepItem {
  id: string
  name: string
  // scheduledDate/location은 UI에 표시하지 않지만 저장 시 유지하기 위해 보존
  scheduledDate: string | null
  location: string | null
}

function SortableStepRow({
  item, index, onChange, onRemove,
}: {
  item: SortableStepItem
  index: number
  onChange: (id: string, name: string) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg transition-all ${isDragging ? 'opacity-50 bg-surface-3 shadow-xl z-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          {...(index === 0 ? { 'data-tour': 'drag-handle' } : {})}
          className="flex-none text-text-quaternary hover:text-text-tertiary cursor-grab active:cursor-grabbing p-1 touch-none"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="4" cy="3" r="1" /><circle cx="8" cy="3" r="1" />
            <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
            <circle cx="4" cy="9" r="1" /><circle cx="8" cy="9" r="1" />
          </svg>
        </button>
        <span className="text-text-quaternary text-xs w-4 text-center">{index + 1}</span>
        <input
          value={item.name}
          onChange={(e) => onChange(item.id, e.target.value)}
          className="flex-1 bg-surface-3 border border-line rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all"
        />
        <button
          onClick={() => onRemove(item.id)}
          className="flex-none text-text-quaternary hover:text-danger transition-colors p-1"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// --- 인라인 편집 필드 ---
function EditableField({
  value, placeholder, onSave, className = '', multiline = false,
}: {
  value: string
  placeholder: string
  onSave: (v: string) => void
  className?: string
  multiline?: boolean
}) {
  const [local, setLocal] = useState(value)
  const [focused, setFocused] = useState(false)

  const handleBlur = () => {
    setFocused(false)
    if (local !== value) onSave(local)
  }

  const props = {
    value: local,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLocal(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: handleBlur,
    onKeyDown: (e: React.KeyboardEvent) => { if (!multiline && e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLElement).blur() },
    placeholder,
    className: `w-full bg-transparent focus:outline-none transition-all rounded-md px-2 py-1 -mx-2 -my-1
      ${focused ? 'bg-surface-3 ring-1 ring-brand/30' : 'hover:bg-card active:bg-card-strong'}
      ${className}`,
  }

  if (multiline) return <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={4} className={props.className + ' resize-none'} />
  return <input {...props as React.InputHTMLAttributes<HTMLInputElement>} />
}

// --- 메인 페이지 ---
export function BoardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useDemoNavigate()
  const { data: app, isLoading } = useApplication(id!)
  const { mutate: update } = useUpdateApplication(id!)
  const { mutate: updateStep } = useUpdateCurrentStep()
  const { mutate: updateSteps, isPending: isSavingSteps } = useUpdateSteps(id!)
  const { mutate: updateStepDetail } = useUpdateStep(id!)

  const [showResultModal, setShowResultModal] = useState(false)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null)
  const [editSteps, setEditSteps] = useState<SortableStepItem[]>([])
  const [editTags, setEditTags] = useState<string[]>([])
  const [openStepId, setOpenStepId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'steps' | 'coverletter' | 'interview'
  >('steps')

  const tourActive = useTourStore((s) => s.active)
  const tourStep = useTourStore((s) => s.step)
  const tourNext = useTourStore((s) => s.next)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isLoading) return <DetailSkeleton />
  if (!app) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-tertiary text-sm">
      카드를 찾을 수 없어요.
    </div>
  )

  const sortedSteps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sortedSteps[app.currentStepIndex]
  const today = dayjs().startOf('day')
  const isLastStep = sortedSteps.length > 0 && app.currentStepIndex === sortedSteps.length - 1
  const stepDatePassed =
    !!currentStep?.scheduledDate &&
    dayjs(currentStep.scheduledDate).startOf('day').isBefore(today)
  const needsResult = app.status === 'IN_PROGRESS' && isLastStep && stepDatePassed

  // D-day: 현재 스텝 날짜만 사용 (날짜 없으면 배지 없음)
  const ddayTarget = currentStep?.scheduledDate ?? null

  const currentTags = parseTags(app.jobCategory)
  const openStep = openStepId ? sortedSteps.find((s) => s.id === openStepId) ?? null : null

  const save = (field: keyof UpdateApplicationDto) => (value: string) => {
    update(
      { [field]: value || undefined } as UpdateApplicationDto,
      {
        onSuccess: () => toast.show('저장됐어요.'),
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleStepClick = (index: number) => {
    const isLastStep = index === sortedSteps.length - 1
    if (isLastStep) {
      setPendingStepIndex(index)
      setShowPassConfirm(true)
    } else {
      updateStep({ id: app.id, stepIndex: index })
      if (tourActive && tourStep === 7) tourNext()
    }
  }

  const openStepEditor = () => {
    setEditSteps(sortedSteps.map((s) => ({
      id: s.id,
      name: s.name,
      scheduledDate: s.scheduledDate,
      location: s.location,
    })))
    setShowStepEditor(true)
    // Delay so modal open animation settles before measuring element position
    if (tourActive && tourStep === 8) setTimeout(() => tourNext(), 280)
  }

  const openTagEditor = () => {
    setEditTags(currentTags)
    setShowTagEditor(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEditSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSaveSteps = () => {
    const valid = editSteps.filter((s) => s.name.trim())
    if (valid.length === 0) return
    updateSteps(
      {
        steps: valid.map((s, i) => ({
          id: s.id,
          orderIndex: i,
          name: s.name.trim(),
          scheduledDate: s.scheduledDate || undefined,
          location: s.location || undefined,
        })),
      },
      {
        onSuccess: () => {
          setShowStepEditor(false)
          toast.show('스텝이 저장됐어요.')
          if (tourActive && tourStep === 11) tourNext()
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleSaveTags = () => {
    update(
      { jobCategory: serializeTags(editTags) || undefined },
      {
        onSuccess: () => { setShowTagEditor(false); toast.show('태그가 저장됐어요.') },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      {/* 뒤로가기 */}
      <button
        onClick={() => goBack(navigate, '/board')}
        className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-xs mb-6 transition-colors group"
      >
        <svg className="group-hover:-translate-x-0.5 transition-transform" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        뒤로
      </button>

      {/* 기본 정보 카드 */}
      <div className={`border rounded-xl p-6 mb-4 ${app.status === 'PASSED' ? 'border-success/35 bg-gradient-to-br from-success/15 to-surface-2' : 'border-line bg-surface-2'}`}>
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-none ${app.status === 'PASSED' ? 'bg-success/15 text-success' : 'bg-brand/12 text-brand'}`}>
            {app.companyName.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            {/* 회사명 — 편집 가능 힌트 포함 */}
            <div className="group/field flex items-center gap-1.5 mb-0.5">
              <EditableField
                value={app.companyName}
                placeholder="회사명"
                onSave={save('companyName')}
                className="text-text-primary text-lg font-bold"
              />
              <svg className="text-text-quaternary opacity-0 group-hover/field:opacity-100 transition-opacity flex-none" width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* 직무명 */}
            <div className="group/field flex items-center gap-1.5">
              <EditableField
                value={app.jobTitle ?? ''}
                placeholder="직무명 클릭하여 입력"
                onSave={save('jobTitle')}
                className="text-text-tertiary text-sm"
              />
              <svg className="text-text-quaternary opacity-0 group-hover/field:opacity-100 transition-opacity flex-none" width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-none flex-wrap justify-end max-w-[40%] sm:max-w-none">
            <StarToggle
              starred={app.isStarred}
              onToggle={() => update({ isStarred: !app.isStarred })}
              size="md"
            />
            {app.status === 'PASSED' && (
              <span className="text-xs text-success font-medium bg-success/10 px-2 py-1 rounded-full border border-success/20 whitespace-nowrap">🎉 최종 합격</span>
            )}
            {ddayTarget && app.status !== 'PASSED' && <DdayBadge deadline={ddayTarget} />}
          </div>
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {currentTags.length > 0
            ? currentTags.map((tag) => {
                const colorClass = JOB_CATEGORY_COLOR[tag] ?? JOB_CATEGORY_COLOR['기타']
                return (
                  <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${colorClass}`}>
                    {JOB_CATEGORY_EMOJI[tag]} {tag}
                  </span>
                )
              })
            : null
          }
          <button
            onClick={openTagEditor}
            className="text-xs text-text-quaternary hover:text-text-secondary border border-dashed border-line hover:border-line-strong px-2.5 py-1 rounded-full transition-all"
          >
            {currentTags.length > 0 ? '+ 태그 수정' : '+ 태그 추가'}
          </button>
        </div>

        {/* 마감일 + URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            {currentStep ? (
              <>
                <label className="block text-[10px] text-text-quaternary mb-1 truncate">{currentStep.name} 날짜</label>
                <input
                  key={`${currentStep.id}-${currentStep.scheduledDate ?? ''}`}
                  type="date"
                  defaultValue={currentStep.scheduledDate ? dayjs(currentStep.scheduledDate).format('YYYY-MM-DD') : ''}
                  onChange={(e) => {
                    // date picker 선택 시 onBlur가 발생 안 함 → onChange로 즉시 저장
                    const oldDate = currentStep.scheduledDate ? dayjs(currentStep.scheduledDate).format('YYYY-MM-DD') : ''
                    if (e.target.value !== oldDate) {
                      updateStepDetail(
                        { stepId: currentStep.id, scheduledDate: e.target.value ? `${e.target.value}T00:00:00+09:00` : null },
                        { onSuccess: () => toast.show('저장됐어요.') },
                      )
                    }
                  }}
                  className="w-full bg-surface-3 border border-line rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all hover:border-line-strong"
                />
              </>
            ) : (
              <>
                <label className="block text-[10px] text-text-quaternary mb-1">진행 일정</label>
                <div className="text-xs text-text-quaternary px-2.5 py-2">스텝을 추가하면 일정을 설정할 수 있어요</div>
              </>
            )}
          </div>
          <div>
            <label className="block text-[10px] text-text-quaternary mb-1">채용공고 URL</label>
            <div className="flex gap-1.5">
              <input
                defaultValue={app.jobUrl ?? ''}
                onBlur={(e) => { if (e.target.value !== (app.jobUrl ?? '')) save('jobUrl')(e.target.value) }}
                placeholder="https://"
                className="flex-1 min-w-0 bg-surface-3 border border-line rounded-lg px-2.5 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/40 transition-all hover:border-line-strong"
              />
              {app.jobUrl && (
                <a href={app.jobUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-none px-2 py-2 bg-surface-3 border border-line rounded-lg text-text-quaternary hover:text-text-secondary text-xs transition-colors">
                  ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 탭: 전형 단계 / 자소서 / 면접 준비 */}
      <div className="flex gap-1 p-1 bg-surface-2 border border-line rounded-lg mb-4">
        {([
          { v: 'steps' as const, label: '전형 단계' },
          { v: 'coverletter' as const, label: '자소서', tourAttr: 'coverletter-tab' },
          { v: 'interview' as const, label: '면접 준비' },
        ]).map((t) => (
          <button
            key={t.v}
            onClick={() => {
              setActiveTab(t.v)
              if (tourActive && tourStep === 12 && t.v === 'coverletter') tourNext()
            }}
            {...('tourAttr' in t ? { 'data-tour': t.tourAttr } : {})}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors
              ${activeTab === t.v ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'steps' && (
        <>
          {/* 스텝바 */}
          {app.status !== 'PLANNED' && sortedSteps.length > 0 && (
            <div data-tour="step-bar" className="border border-line bg-surface-2 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-text-primary text-sm font-semibold">진행 상황</h2>
                  <p className="text-text-quaternary text-[10px] mt-0.5">스텝 이름을 클릭하면 상세 정보를 입력할 수 있어요</p>
                </div>
                {app.status !== 'PASSED' && (
                  <button
                    data-tour="step-edit-btn"
                    onClick={openStepEditor}
                    className="text-xs text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    스텝 편집
                  </button>
                )}
              </div>
              <StepBar
                steps={app.steps}
                currentStepIndex={app.currentStepIndex}
                status={app.status}
                onStepClick={app.status !== 'PASSED' && app.status !== 'FAILED' ? handleStepClick : undefined}
                onStepNameClick={setOpenStepId}
                size="md"
              />
            </div>
          )}

          {/* 결과 처리 */}
          {needsResult && (
            <div className="border border-warning/25 bg-warning/5 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-warning text-xs font-medium">⚠️ 결과 대기 중이에요</p>
                <p className="text-text-tertiary text-xs mt-0.5">합격·불합격 결과를 입력하면 다음 단계로 진행할 수 있어요.</p>
              </div>
              <button
                onClick={() => setShowResultModal(true)}
                className="text-xs font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover px-3 py-2 rounded-lg transition-colors"
              >결과 입력</button>
            </div>
          )}

          {/* 메모 */}
          <div className="border border-line bg-surface-2 rounded-xl p-5">
            <h2 className="text-text-primary text-sm font-semibold mb-3">메모</h2>
            <EditableField
              value={app.memo ?? ''}
              placeholder="면접관 3명, 복장 자유, 기술 면접 위주... (자동 저장)"
              onSave={save('memo')}
              className="text-sm text-text-primary placeholder:text-text-quaternary"
              multiline
            />
          </div>
        </>
      )}

      {activeTab === 'coverletter' && <CoverLetterTab applicationId={app.id} active />}
      {activeTab === 'interview' && (
        <InterviewPrepTab applicationId={app.id} active />
      )}

      {/* 결과 모달 */}
      <SetResultModal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        applicationId={app.id}
        companyName={app.companyName}
      />

      {/* 태그 편집 모달 */}
      <Modal open={showTagEditor} onClose={() => setShowTagEditor(false)} title="직군 태그 편집">
        <TagSelector selected={editTags} onChange={setEditTags} />
        <div className="flex gap-2 mt-5">
          <button onClick={() => setShowTagEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
          <button onClick={handleSaveTags} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors">저장</button>
        </div>
      </Modal>

      {/* 스텝 편집 모달 (드래그 가능) */}
      <Modal open={showStepEditor} onClose={() => setShowStepEditor(false)} title="스텝 편집">
        <p className="text-text-quaternary text-xs mb-3">☰ 드래그로 순서를 변경할 수 있어요</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={editSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 mb-3">
              {editSteps.map((step, i) => (
                <SortableStepRow
                  key={step.id}
                  item={step}
                  index={i}
                  onChange={(id, name) => setEditSteps((prev) => prev.map((s) => s.id === id ? { ...s, name } : s))}
                  onRemove={(id) => setEditSteps((prev) => prev.filter((s) => s.id !== id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button
          data-tour="add-step-btn"
          onClick={() => {
            setEditSteps((prev) => [...prev, { id: crypto.randomUUID(), name: '', scheduledDate: null, location: null }])
            if (tourActive && tourStep === 9) tourNext()
          }}
          className="w-full py-2 text-xs text-text-tertiary border border-dashed border-line rounded-lg hover:border-line-strong hover:text-text-secondary transition-all mb-4"
        >
          + 스텝 추가
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowStepEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
          <button data-tour="save-steps-btn" onClick={handleSaveSteps} disabled={isSavingSteps} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40">
            {isSavingSteps ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>

      {/* 스텝 상세 패널 */}
      {openStep && (
        <StepDetailPanel
          key={openStep.id}
          appId={app.id}
          step={openStep}
          onClose={() => setOpenStepId(null)}
        />
      )}

      {/* 최종 합격 확인 모달 */}
      {showPassConfirm && pendingStepIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPassConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최종 합격 처리 확인"
            className="bg-surface border border-line rounded-xl p-6 w-80 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-2xl mb-3">🎉</div>
            <h3 className="text-text-primary font-semibold text-sm mb-1">최종 합격 처리할까요?</h3>
            <p className="text-text-tertiary text-xs mb-5">
              <span className="text-text-secondary font-medium">{sortedSteps[pendingStepIndex]?.name}</span> 완료 시 이 카드가 최종 합격으로 전환됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPassConfirm(false)}
                className="flex-1 py-3 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { updateStep({ id: app.id, stepIndex: pendingStepIndex }, { onSuccess: () => celebrate(app.companyName) }); setShowPassConfirm(false) }}
                className="flex-1 py-3 text-xs font-medium text-text-primary bg-success/80 hover:bg-success rounded-lg transition-colors"
              >
                합격 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 animate-pulse">
      <div className="h-3 bg-card rounded w-24 mb-6" />
      <div className="border border-line bg-surface-2 rounded-xl p-6 mb-4">
        <div className="flex gap-4 mb-5">
          <div className="w-12 h-12 bg-card rounded-xl" />
          <div className="flex-1"><div className="h-5 bg-card-strong rounded w-32 mb-2" /><div className="h-3 bg-card rounded w-24" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3"><div className="h-9 bg-card rounded-lg" /><div className="h-9 bg-card rounded-lg" /></div>
      </div>
    </div>
  )
}
