import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApplication } from '@/hooks/useApplications'
import { useChecklist, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, useUpdateStep } from '@/hooks/useStepDetail'
import { StepNoteEditor } from '@/components/editor/StepNoteEditor'
import { PinnedNoteField } from '@/components/editor/PinnedNoteField'

export function StepPage() {
  const { id: appId, stepId } = useParams<{ id: string; stepId: string }>()
  const navigate = useNavigate()

  const { data: app, isLoading } = useApplication(appId!)
  const step = app ? [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex).find((s) => s.id === stepId) ?? null : null

  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')

  // step 로드 후 초기값 세팅 (한 번만)
  const [initialized, setInitialized] = useState(false)
  if (step && !initialized) {
    setScheduledDate(step.scheduledDate ? dayjs(step.scheduledDate).format('YYYY-MM-DDTHH:mm') : '')
    setLocation(step.location ?? '')
    setInitialized(true)
  }

  const { data: checklist = [] } = useChecklist(appId!, stepId ?? null)
  const { mutate: updateStep } = useUpdateStep(appId!)
  const { mutate: createItem } = useCreateChecklistItem(appId!, stepId!)
  const { mutate: updateItem } = useUpdateChecklistItem(appId!, stepId!)
  const { mutate: deleteItem } = useDeleteChecklistItem(appId!, stepId!)

  function handleDateBlur() {
    updateStep({ stepId: stepId!, scheduledDate: scheduledDate ? `${scheduledDate}:00` : null })
  }

  function handleLocationBlur() {
    updateStep({ stepId: stepId!, location: location || null })
  }

  async function handleSaveNotes(json: string) {
    await new Promise<void>((resolve, reject) =>
      updateStep(
        { stepId: stepId!, notes: json },
        { onSuccess: () => resolve(), onError: () => reject() },
      ),
    )
  }

  function handleSavePinnedContent(value: string | null) {
    updateStep({ stepId: stepId!, pinnedContent: value })
  }

  function handleAddItem() {
    if (!inputText.trim()) return
    createItem(inputText.trim())
    setInputText('')
  }

  if (isLoading) return <PageSkeleton />
  if (!app || !step) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-tertiary text-sm">
        스텝을 찾을 수 없어요.
      </div>
    )
  }

  const doneCount = checklist.filter((i) => i.isDone).length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(`/board/${appId}`)}
        className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-xs mb-6 transition-colors group"
      >
        <svg className="group-hover:-translate-x-0.5 transition-transform" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {app.companyName} 상세
      </button>

      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-brand text-xs font-medium bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20">
            {app.companyName}
          </span>
        </div>
        <h1 className="text-text-primary text-2xl font-bold">{step.name}</h1>
        {checklist.length > 0 && (
          <p className="text-text-quaternary text-xs mt-1.5">
            체크리스트 {doneCount}/{checklist.length} 완료
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* 날짜/시간 */}
        <section className="border border-white/8 bg-surface-2 rounded-2xl p-5">
          <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-3">날짜 · 시간</p>
          <input
            type="datetime-local"
            value={scheduledDate ?? ''}
            onChange={(e) => setScheduledDate(e.target.value)}
            onBlur={handleDateBlur}
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand/50 transition-colors [color-scheme:dark]"
          />
        </section>

        {/* 장소 */}
        <section className="border border-white/8 bg-surface-2 rounded-2xl p-5">
          <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-3">장소</p>
          <input
            type="text"
            value={location ?? ''}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={handleLocationBlur}
            placeholder="예: 강남역 3번 출구 위워크 3층"
            className="w-full bg-surface-3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 transition-colors"
          />
        </section>

        {/* 핵심 메모 (핀) */}
        <section>
          <PinnedNoteField
            initialValue={step.pinnedContent ?? null}
            onSave={handleSavePinnedContent}
          />
        </section>

        {/* 자유 메모 */}
        <section>
          <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-3">메모</p>
          <StepNoteEditor
            stepName={step.name}
            initialContent={step.notes ?? null}
            onSave={handleSaveNotes}
          />
        </section>

        {/* 준비 체크리스트 */}
        <section className="border border-white/8 bg-surface-2 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide">준비 체크리스트</p>
            {checklist.length > 0 && (
              <span className="text-[10px] text-text-quaternary font-mono">{doneCount}/{checklist.length}</span>
            )}
          </div>

          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-3 group py-0.5">
                <button
                  onClick={() => updateItem({ itemId: item.id, isDone: !item.isDone })}
                  className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border shrink-0 flex items-center justify-center transition-colors ${
                    item.isDone ? 'bg-brand border-brand' : 'border-white/20 hover:border-brand/60'
                  }`}
                >
                  {item.isDone && (
                    <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${item.isDone ? 'line-through text-text-quaternary' : 'text-text-primary'}`}>
                  {item.content}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-danger transition-all w-6 h-6 flex items-center justify-center rounded"
                >
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2L2 8" />
                  </svg>
                </button>
              </div>
            ))}

            {/* 새 항목 입력 */}
            <div className="flex items-center gap-3 py-0.5 mt-1">
              <div className="w-[18px] h-[18px] rounded border border-white/10 shrink-0" />
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddItem()
                  if (e.key === 'Escape') setInputText('')
                }}
                placeholder="항목 추가 후 Enter"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-3 bg-white/6 rounded w-24 mb-6" />
      <div className="h-8 bg-white/8 rounded w-48 mb-8" />
      <div className="space-y-4">
        <div className="h-16 bg-white/5 rounded-2xl" />
        <div className="h-16 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    </div>
  )
}
