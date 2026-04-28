import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApplication, useUpdateApplication, useUpdateCurrentStep, useUpdateSteps } from '@/hooks/useApplications'
import { StepBar } from '@/components/card/StepBar'
import { DdayBadge } from '@/components/card/DdayBadge'
import { SetResultModal } from '@/components/card/SetResultModal'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { toast } from '@/stores/toastStore'
import { calcDday } from '@/utils/dday'
import { parseTags, serializeTags, JOB_CATEGORY_COLOR, JOB_CATEGORY_EMOJI } from '@/utils/tags'

// --- 드래그 가능한 스텝 아이템 ---
interface SortableStepItem {
  id: string
  name: string
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
      className={`flex items-center gap-2 rounded-lg transition-all ${isDragging ? 'opacity-50 bg-surface-3 shadow-xl z-50' : ''}`}
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
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
        className="flex-1 bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all"
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
    onKeyDown: (e: React.KeyboardEvent) => { if (!multiline && e.key === 'Enter') (e.target as HTMLElement).blur() },
    placeholder,
    className: `w-full bg-transparent focus:outline-none transition-all rounded-md px-2 py-1 -mx-2 -my-1
      ${focused ? 'bg-surface-3 ring-1 ring-brand/30' : 'hover:bg-white/4'}
      ${className}`,
  }

  if (multiline) return <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={4} className={props.className + ' resize-none'} />
  return <input {...props as React.InputHTMLAttributes<HTMLInputElement>} />
}

// --- 메인 페이지 ---
export function BoardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = (location.state as any)?.from === 'dashboard' ? '/dashboard' : '/board'
  const { data: app, isLoading } = useApplication(id!)
  const { mutate: update } = useUpdateApplication(id!)
  const { mutate: updateStep } = useUpdateCurrentStep()
  const { mutate: updateSteps, isPending: isSavingSteps } = useUpdateSteps(id!)

  const [showResultModal, setShowResultModal] = useState(false)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [editSteps, setEditSteps] = useState<SortableStepItem[]>([])
  const [editTags, setEditTags] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isLoading) return <DetailSkeleton />
  if (!app) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-tertiary text-sm">
      카드를 찾을 수 없어요.
    </div>
  )

  const sortedSteps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const needsResult = app.status === 'IN_PROGRESS' && app.deadline && calcDday(app.deadline) < 0
  const currentTags = parseTags(app.jobCategory)

  const save = (field: string) => (value: string) => {
    update(
      { [field]: value || undefined } as any,
      {
        onSuccess: () => toast.show('저장됐어요.'),
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleStepClick = (index: number) => {
    const isLastStep = index === sortedSteps.length - 1
    if (isLastStep) {
      if (confirm(`"${sortedSteps[index].name}"을(를) 완료하면 최종 합격으로 처리됩니다.`)) {
        updateStep({ id: app.id, stepIndex: index })
      }
    } else {
      updateStep({ id: app.id, stepIndex: index })
    }
  }

  const openStepEditor = () => {
    setEditSteps(sortedSteps.map((s) => ({ id: s.id, name: s.name })))
    setShowStepEditor(true)
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
      { steps: valid.map((s, i) => ({ orderIndex: i, name: s.name.trim() })) },
      {
        onSuccess: () => { setShowStepEditor(false); toast.show('스텝이 저장됐어요.') },
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(backTo)}
        className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-xs mb-6 transition-colors group"
      >
        <svg className="group-hover:-translate-x-0.5 transition-transform" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        지원 현황 보드
      </button>

      {/* 기본 정보 카드 */}
      <div className={`border rounded-2xl p-6 mb-4 ${app.status === 'PASSED' ? 'border-success/25 bg-gradient-to-br from-success/6 to-surface-2' : 'border-white/8 bg-surface-2'}`}>
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

          <div className="flex items-center gap-2 flex-none">
            {app.status === 'PASSED' && (
              <span className="text-xs text-success font-medium bg-success/10 px-2 py-1 rounded-full border border-success/20">🎉 최종 합격</span>
            )}
            {app.deadline && app.status !== 'PASSED' && <DdayBadge deadline={app.deadline} />}
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
            className="text-xs text-text-quaternary hover:text-text-secondary border border-dashed border-white/12 hover:border-white/20 px-2.5 py-1 rounded-full transition-all"
          >
            {currentTags.length > 0 ? '+ 태그 수정' : '+ 태그 추가'}
          </button>
        </div>

        {/* 마감일 + URL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-text-quaternary mb-1">서류 마감일</label>
            <input
              type="date"
              defaultValue={app.deadline ?? ''}
              onBlur={(e) => { if (e.target.value !== (app.deadline ?? '')) save('deadline')(e.target.value) }}
              className="w-full bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/40 transition-all hover:border-white/14 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-quaternary mb-1">채용공고 URL</label>
            <div className="flex gap-1.5">
              <input
                defaultValue={app.jobUrl ?? ''}
                onBlur={(e) => { if (e.target.value !== (app.jobUrl ?? '')) save('jobUrl')(e.target.value) }}
                placeholder="https://"
                className="flex-1 min-w-0 bg-surface-3 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/40 transition-all hover:border-white/14"
              />
              {app.jobUrl && (
                <a href={app.jobUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-none px-2 py-2 bg-surface-3 border border-white/8 rounded-lg text-text-quaternary hover:text-text-secondary text-xs transition-colors">
                  ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 스텝바 */}
      {app.status !== 'PLANNED' && sortedSteps.length > 0 && (
        <div className="border border-white/8 bg-surface-2 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-text-primary text-sm font-semibold">진행 상황</h2>
            {app.status !== 'PASSED' && (
              <button
                onClick={openStepEditor}
                className="text-xs text-text-tertiary hover:text-text-secondary border border-white/8 hover:border-white/15 px-2.5 py-1.5 rounded-lg transition-all"
              >
                스텝 편집
              </button>
            )}
          </div>
          <StepBar
            steps={app.steps}
            currentStepIndex={app.currentStepIndex}
            onStepClick={app.status !== 'PASSED' && app.status !== 'FAILED' ? handleStepClick : undefined}
            size="md"
          />
        </div>
      )}

      {/* 결과 처리 */}
      {needsResult && (
        <div className="border border-warning/25 bg-warning/5 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-warning text-xs font-medium">⚠️ 마감일이 지났어요</p>
            <p className="text-text-tertiary text-xs mt-0.5">최종 결과를 입력해주세요.</p>
          </div>
          <button
            onClick={() => setShowResultModal(true)}
            className="text-xs font-medium text-white bg-brand hover:bg-accent px-3 py-2 rounded-lg transition-colors"
          >결과 입력</button>
        </div>
      )}

      {/* 메모 */}
      <div className="border border-white/8 bg-surface-2 rounded-2xl p-5">
        <h2 className="text-text-primary text-sm font-semibold mb-3">메모</h2>
        <EditableField
          value={app.memo ?? ''}
          placeholder="면접관 3명, 복장 자유, 기술 면접 위주... (자동 저장)"
          onSave={save('memo')}
          className="text-sm text-text-primary placeholder:text-text-quaternary"
          multiline
        />
      </div>

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
          <button onClick={() => setShowTagEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">취소</button>
          <button onClick={handleSaveTags} className="flex-1 py-2.5 text-xs font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors">저장</button>
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
          onClick={() => setEditSteps((prev) => [...prev, { name: '', id: crypto.randomUUID() }])}
          className="w-full py-2 text-xs text-text-tertiary border border-dashed border-white/15 rounded-lg hover:border-white/25 hover:text-text-secondary transition-all mb-4"
        >
          + 스텝 추가
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowStepEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">취소</button>
          <button onClick={handleSaveSteps} disabled={isSavingSteps} className="flex-1 py-2.5 text-xs font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40">
            {isSavingSteps ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-3 bg-white/6 rounded w-24 mb-6" />
      <div className="border border-white/8 bg-surface-2 rounded-2xl p-6 mb-4">
        <div className="flex gap-4 mb-5">
          <div className="w-12 h-12 bg-white/6 rounded-xl" />
          <div className="flex-1"><div className="h-5 bg-white/8 rounded w-32 mb-2" /><div className="h-3 bg-white/5 rounded w-24" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3"><div className="h-9 bg-white/5 rounded-lg" /><div className="h-9 bg-white/5 rounded-lg" /></div>
      </div>
    </div>
  )
}
