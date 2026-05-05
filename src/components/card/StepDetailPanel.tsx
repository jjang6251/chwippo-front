import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useChecklist, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, useUpdateStep } from '@/hooks/useStepDetail'

interface Step {
  id: string
  name: string
  scheduledDate: string | null
  location: string | null
}

interface Props {
  appId: string
  step: Step
  onClose: () => void
}

export function StepDetailPanel({ appId, step, onClose }: Props) {
  const navigate = useNavigate()
  const [scheduledDate, setScheduledDate] = useState(
    step.scheduledDate ? dayjs(step.scheduledDate).format('YYYY-MM-DDTHH:mm') : '',
  )
  const [location, setLocation] = useState(step.location ?? '')
  const [inputText, setInputText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: checklist = [] } = useChecklist(appId, step.id)
  const { mutate: updateStep } = useUpdateStep(appId)
  const { mutate: createItem } = useCreateChecklistItem(appId, step.id)
  const { mutate: updateItem } = useUpdateChecklistItem(appId, step.id)
  const { mutate: deleteItem } = useDeleteChecklistItem(appId, step.id)

  // 날짜/장소 블러 시 자동 저장
  function handleDateBlur() {
    updateStep({
      stepId: step.id,
      scheduledDate: scheduledDate ? `${scheduledDate}:00` : null,
    })
  }

  function handleLocationBlur() {
    updateStep({ stepId: step.id, location: location || null })
  }

  function handleAddItem() {
    if (!inputText.trim()) return
    createItem(inputText.trim())
    setInputText('')
  }

  // 패널 외부 클릭 시 닫기
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay — lg 이상에서는 사이드바 모드라 불필요 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-surface border-l border-white/8 flex flex-col shadow-2xl lg:shadow-none"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <h2 className="text-text-primary font-semibold text-sm truncate">{step.name}</h2>
          <div className="flex items-center gap-1 shrink-0">
            {/* 전체 화면으로 열기 */}
            <button
              onClick={() => navigate(`/board/${appId}/steps/${step.id}`)}
              title="전체 화면으로 열기"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-quaternary hover:bg-white/6 hover:text-text-primary transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-quaternary hover:bg-white/6 hover:text-text-primary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* 날짜/시간 */}
          <section>
            <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-2">날짜 · 시간</p>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              onBlur={handleDateBlur}
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 transition-colors"
            />
          </section>

          {/* 장소 */}
          <section>
            <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-2">장소</p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={handleLocationBlur}
              placeholder="예: 강남역 3번 출구 위워크 3층"
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/50 transition-colors"
            />
          </section>

          {/* 준비 체크리스트 */}
          <section>
            <p className="text-[10px] font-medium text-text-quaternary uppercase tracking-wide mb-3">준비 체크리스트</p>

            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 group">
                  <button
                    onClick={() => updateItem({ itemId: item.id, isDone: !item.isDone })}
                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      item.isDone ? 'bg-brand border-brand' : 'border-white/20 hover:border-brand/60'
                    }`}
                  >
                    {item.isDone && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`flex-1 text-xs ${item.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}
                  >
                    {item.content}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-danger transition-all w-5 h-5 flex items-center justify-center"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2L2 8" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* 새 항목 입력 */}
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded border border-white/10 shrink-0" />
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddItem()
                    if (e.key === 'Escape') setInputText('')
                  }}
                  placeholder="항목 추가 후 Enter"
                  className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-quaternary outline-none"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
