import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { goBack } from '@/utils/navigation'
import dayjs from 'dayjs'
import { useApplication, useUpdateApplication, useUpdateCurrentStep } from '@/hooks/useApplications'
import { useChecklist, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, useUpdateStep } from '@/hooks/useStepDetail'
import { StepNoteEditor } from '@/components/editor/StepNoteEditor'
import { Modal } from '@/components/common/Modal'
import { getStepType, STEP_TYPE_CONFIG, CHECKLIST_PRESETS } from '@/utils/stepTemplates'
import { getDdayLabel, getDdayVariant } from '@/utils/dday'
import { postToNative } from '@/utils/nativeBridge'
import { mergePinnedIntoNotes } from '@/utils/stepNotes'
import { Calendar, MapPin } from 'lucide-react'

export function StepPage() {
  const { id: appId, stepId } = useParams<{ id: string; stepId: string }>()
  const navigate = useDemoNavigate()

  const { data: app, isLoading } = useApplication(appId!)
  const sortedSteps = app ? [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex) : []
  const step = sortedSteps.find((s) => s.id === stepId) ?? null
  const stepIdx = sortedSteps.findIndex((s) => s.id === stepId)
  const prevStep = stepIdx > 0 ? sortedSteps[stepIdx - 1] : null
  const nextStep = stepIdx < sortedSteps.length - 1 ? sortedSteps[stepIdx + 1] : null
  const isLastStep = stepIdx === sortedSteps.length - 1
  const isCurrentStep = step ? step.orderIndex === app?.currentStepIndex : false

  const [scheduledDate, setScheduledDate] = useState('')
  const [location, setLocation] = useState('')
  const [inputText, setInputText] = useState('')
  const [editingField, setEditingField] = useState<'date' | 'location' | null>(null)
  const [showPassedModal, setShowPassedModal] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

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
  const { mutate: updateCurrentStep } = useUpdateCurrentStep()
  const { mutate: updateApplication } = useUpdateApplication(appId!)

  function handleDateBlur() {
    setEditingField(null)
  }
  function saveScheduledDate(value: string) {
    // card-detail-remodel — 헤더 날짜 입력 삭제로 soft-ask 트리거를 스텝 날짜 저장으로 이전.
    // 정책 = 현행 유지: 날짜 저장 시 발신 / 날짜 삭제(null) 시 미발신 / WebView 밖 no-op.
    updateStep(
      { stepId: stepId!, scheduledDate: value ? `${value}:00+09:00` : null },
      { onSuccess: () => { if (value) postToNative({ type: 'deadline-saved' }) } },
    )
  }
  function handleLocationBlur() {
    setEditingField(null)
    updateStep({ stepId: stepId!, location: location || null })
  }
  async function handleSaveNotes(json: string) {
    // card-detail-remodel — 핵심 메모 통합: 병합된 notes 저장 시 죽은 pinnedContent 를 1회 이관(null).
    // step.pinnedContent 가 있을 때만 동봉 → 저장 성공 후 refetch 로 null 이 되면 이후 저장엔 미동봉.
    const clearPinned = !!step?.pinnedContent
    await new Promise<void>((resolve, reject) =>
      updateStep(
        { stepId: stepId!, notes: json, ...(clearPinned ? { pinnedContent: null } : {}) },
        { onSuccess: () => resolve(), onError: () => reject() },
      ),
    )
  }
  function handleAddItem() {
    if (!inputText.trim()) return
    createItem(inputText.trim())
    setInputText('')
  }
  function handleLoadPreset() {
    if (!step) return
    const preset = CHECKLIST_PRESETS[getStepType(step.name)]
    if (!preset) return
    const existing = new Set(checklist.map((i) => i.content))
    preset.filter((p) => !existing.has(p)).forEach((p) => createItem(p))
  }
  function handleCompleteStep() {
    if (!app || !step) return
    if (isLastStep) {
      setShowPassedModal(true)
    } else {
      updateCurrentStep({ id: appId!, stepIndex: step.orderIndex + 1 })
    }
  }
  function handleConfirmPassed() {
    updateApplication({ status: 'PASSED' }, { onSuccess: () => navigate(`/board/${appId}`) })
    setShowPassedModal(false)
  }

  if (isLoading) return <PageSkeleton />
  if (!app || !step) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-tertiary text-sm">
        스텝을 찾을 수 없어요.
      </div>
    )
  }

  const stepType = getStepType(step.name)
  const typeConfig = STEP_TYPE_CONFIG[stepType]
  const TypeIcon = typeConfig.Icon
  const hasPreset = !!CHECKLIST_PRESETS[stepType]
  const doneCount = checklist.filter((i) => i.isDone).length

  const dday = step.scheduledDate
    ? dayjs(step.scheduledDate).startOf('day').diff(dayjs().startOf('day'), 'day')
    : null
  const ddayVariant = dday !== null ? getDdayVariant(dday) : null
  const ddayLabel = dday !== null ? getDdayLabel(dday) : null

  const stepStatus: 'done' | 'current' | 'upcoming' =
    step.orderIndex < app.currentStepIndex ? 'done' :
    step.orderIndex === app.currentStepIndex ? 'current' : 'upcoming'

  const statusBadge = {
    done:     { label: '완료됨', cls: 'text-success bg-success/8 border-success/25' },
    current:  { label: '진행중', cls: 'text-info bg-info/8 border-info/25' },
    upcoming: { label: '대기중', cls: 'text-text-quaternary bg-card border-line' },
  }[stepStatus]

  // 날짜 표시 포맷
  const scheduledDjs = step.scheduledDate ? dayjs(step.scheduledDate) : null
  const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']
  const dateDisplayLabel = scheduledDjs
    ? `${scheduledDjs.month() + 1}월 ${scheduledDjs.date()}일 (${DAY_KO[scheduledDjs.day()]})`
    : null
  const timeDisplayLabel = scheduledDjs && (scheduledDjs.hour() > 0 || scheduledDjs.minute() > 0)
    ? scheduledDjs.format('HH:mm')
    : null

  // D-day 강조 색상
  const ddayTextCls =
    ddayVariant === 'danger' ? 'text-danger' :
    ddayVariant === 'warning' ? 'text-warning' : 'text-info'
  const dateRowAccentCls =
    dday === 0 ? 'bg-danger/5' :
    dday === 1 ? 'bg-warning/5' : ''

  // 준비 노트 초기 콘텐츠 — 죽은 pinnedContent 가 있으면 맨 앞에 "📌 …" 문단으로 병합해 표시.
  // 서버 이관은 저장 시(handleSaveNotes)에 1회. pinned 이관 후엔 null 이라 병합 없음(idempotent).
  const initialNotes = mergePinnedIntoNotes(step.notes, step.pinnedContent)

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[160px] lg:max-w-[1100px] lg:px-9 lg:py-9 lg:pb-28">
      {/* 뒤로가기 */}
      <div className="pt-6 pb-4">
        <button
          onClick={() => goBack(navigate, `/board/${appId}`)}
          className="flex items-center gap-1.5 text-text-quaternary hover:text-text-tertiary text-xs transition-colors group"
        >
          <svg className="group-hover:-translate-x-0.5 transition-transform" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          뒤로
        </button>
      </div>

      {/* 헤더 + Properties 병합 카드 (CEO 2026-07-20 — 라이트 흰 card-solid 4→3장) · 스트라이프 유지 */}
      <div className={`rounded-xl bg-card-solid shadow-sm border border-line-strong border-l-[3px] overflow-hidden mb-4 ${typeConfig.accentBorderCls}`}>
        {/* 배너부 */}
        <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <TypeIcon size={18} strokeWidth={1.75} className={`shrink-0 ${typeConfig.colorCls}`} aria-hidden="true" />
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${typeConfig.colorCls}`}>
              {typeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {ddayLabel && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border font-mono
                ${ddayVariant === 'danger' ? 'text-danger bg-danger/8 border-danger/25' :
                  ddayVariant === 'warning' ? 'text-warning bg-warning/8 border-warning/25' :
                  'text-info bg-info/8 border-info/25'}`}>
                {ddayLabel}
              </span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
        </div>
        <h1 className="text-text-primary text-2xl font-bold leading-tight mb-2">{step.name}</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-text-quaternary text-xs font-mono">{stepIdx + 1} / {sortedSteps.length}</span>
          {checklist.length > 0 && (
            <>
              <span className="text-text-faint">·</span>
              <span className="text-text-quaternary text-xs">체크리스트 {doneCount}/{checklist.length}</span>
            </>
          )}
        </div>
        </div>
        {/* 배너 ↔ 날짜/장소 구분 (기존 문법 h-px bg-card-strong) */}
        <div className="h-px bg-card-strong mx-3" />
        {/* 날짜 행 */}
        <div className={`transition-colors ${dateRowAccentCls}`}>
          {editingField === 'date' ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar size={15} strokeWidth={1.75} className={`${typeConfig.colorCls} shrink-0`} aria-hidden="true" />
              <span className="text-xs text-text-quaternary w-10 shrink-0">날짜</span>
              <input
                ref={dateInputRef}
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => {
                  const v = e.target.value
                  setScheduledDate(v)
                  saveScheduledDate(v)
                }}
                onBlur={handleDateBlur}
                autoFocus
                aria-label="일정 날짜 및 시간"
                className="flex-1 bg-transparent text-base text-text-primary focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => { setEditingField('date'); setTimeout(() => dateInputRef.current?.focus(), 0) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card active:bg-card-strong transition-colors text-left"
            >
              <Calendar size={15} strokeWidth={1.75} className={`${typeConfig.colorCls} shrink-0`} aria-hidden="true" />
              <span className="text-xs text-text-quaternary w-10 shrink-0">날짜</span>
              {dateDisplayLabel ? (
                <span className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  <span className="text-sm text-text-primary">{dateDisplayLabel}</span>
                  {timeDisplayLabel && (
                    <span className={`text-sm font-semibold font-mono ${typeConfig.colorCls}`}>{timeDisplayLabel}</span>
                  )}
                  {ddayLabel && (
                    <span className={`text-[10px] font-semibold font-mono ml-auto ${ddayTextCls}`}>{ddayLabel}</span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-text-quaternary flex-1">날짜 설정</span>
              )}
            </button>
          )}
        </div>

        <div className="h-px bg-card-strong mx-3" />

        {/* 장소 행 */}
        <div>
          {editingField === 'location' ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <MapPin size={15} strokeWidth={1.75} className={`${typeConfig.colorCls} shrink-0`} aria-hidden="true" />
              <span className="text-xs text-text-quaternary w-10 shrink-0">장소</span>
              <input
                ref={locationInputRef}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={handleLocationBlur}
                autoFocus
                placeholder="장소 입력"
                aria-label="면접 장소"
                className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => { setEditingField('location'); setTimeout(() => locationInputRef.current?.focus(), 0) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card active:bg-card-strong transition-colors text-left"
            >
              <MapPin size={15} strokeWidth={1.75} className={`${typeConfig.colorCls} shrink-0`} aria-hidden="true" />
              <span className="text-xs text-text-quaternary w-10 shrink-0">장소</span>
              <span className={`text-sm flex-1 ${location ? 'text-text-primary' : 'text-text-quaternary'}`}>
                {location || '장소 설정'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 이전/다음 네비게이션 — 병합 카드 아래 (CEO 2026-07-20) */}
      <div className="flex items-center border border-line-strong rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => prevStep && navigate(`/board/${appId}/steps/${prevStep.id}`)}
          disabled={!prevStep}
          aria-label={prevStep ? `이전 단계: ${prevStep.name}` : '처음 단계'}
          className="flex-1 flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-25 hover:bg-card active:bg-card-strong transition-colors disabled:cursor-default"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-text-quaternary">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs text-text-quaternary truncate">{prevStep ? prevStep.name : '처음 단계'}</span>
        </button>
        <div className="w-px h-5 bg-card" />
        <button
          onClick={() => nextStep && navigate(`/board/${appId}/steps/${nextStep.id}`)}
          disabled={!nextStep}
          aria-label={nextStep ? `다음 단계: ${nextStep.name}` : '마지막 단계'}
          className="flex-1 flex items-center justify-end gap-1.5 px-4 py-2.5 disabled:opacity-25 hover:bg-card active:bg-card-strong transition-colors disabled:cursor-default"
        >
          <span className="text-xs text-text-quaternary truncate">{nextStep ? nextStep.name : '마지막 단계'}</span>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-text-quaternary">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── 준비 체크리스트 ────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-text-quaternary shrink-0">준비 체크리스트</span>
          <div className="flex-1 h-px bg-card-strong" />
          <div className="flex items-center gap-2 shrink-0">
            {checklist.length > 0 && (
              <span className="text-[10px] text-text-quaternary font-mono">{doneCount}/{checklist.length}</span>
            )}
            {hasPreset && (
              <button
                onClick={handleLoadPreset}
                className="text-[10px] text-text-quaternary hover:text-text-tertiary transition-colors"
              >
                기본 불러오기
              </button>
            )}
          </div>
        </div>

        {/* card-solid 승격 — Properties 바와 동급 시인성 (CEO: "체크리스트 잘 안 보임") */}
        <div className="bg-card-solid shadow-sm border border-line-strong rounded-xl p-5">
        {stepType === 'wait' && checklist.length === 0 && (
          <p className="text-xs text-text-quaternary leading-relaxed mb-4">
            결과 발표일을 위 날짜 필드에 기록해두세요. 준비 노트에 예상 결과나 특이사항을 적어두면 나중에 참고하기 좋아요.
          </p>
        )}

        <div className="space-y-1">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 group py-1 px-1 rounded-lg hover:bg-card active:bg-card-strong transition-colors">
              <button
                onClick={() => updateItem({ itemId: item.id, isDone: !item.isDone })}
                className={`relative w-[17px] h-[17px] rounded border shrink-0 flex items-center justify-center transition-colors after:content-[''] after:absolute after:inset-[-8px] ${
                  item.isDone ? 'bg-brand border-brand' : 'border-line hover:border-brand/60'
                }`}
              >
                {item.isDone && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-sm leading-relaxed ${item.isDone ? 'line-through text-text-quaternary' : 'text-text-primary'}`}>
                {item.content}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-danger transition-all w-6 h-6 flex items-center justify-center rounded"
              >
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2L2 8" />
                </svg>
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 py-1 px-1">
            <div className="w-[17px] h-[17px] rounded border border-line shrink-0" />
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddItem()
                if (e.key === 'Escape') setInputText('')
              }}
              placeholder="항목 추가 후 Enter"
              className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-tertiary outline-none rounded focus-visible:ring-1 focus-visible:ring-brand/30"
            />
          </div>
        </div>
        </div>
      </div>

      {/* ── 준비 노트 (핵심 메모 통합) ─────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-text-quaternary shrink-0">준비 노트</span>
          <div className="flex-1 h-px bg-card-strong" />
        </div>
        <StepNoteEditor
          stepName={step.name}
          initialContent={initialNotes}
          onSave={handleSaveNotes}
        />
      </div>

      {/* ── 이 단계 완료하기 버튼 (fixed bottom) ─────── */}
      {isCurrentStep && (
        <div className="fixed bottom-20 lg:bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-4 pt-8 bg-gradient-to-t from-bg via-bg/95 to-transparent pointer-events-auto">
            <button
              onClick={handleCompleteStep}
              className="w-full bg-brand hover:bg-accent active:bg-accent-hover text-text-primary font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLastStep ? '🎉 최종 합격 처리하기' : '이 단계 완료하기'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 최종 합격 확인 모달 */}
      <Modal open={showPassedModal} onClose={() => setShowPassedModal(false)} title="최종 합격 처리">
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">
          <span className="text-text-primary font-semibold">{app.companyName}</span>에 최종 합격 처리할까요?
          카드가 초록색으로 전환됩니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPassedModal(false)}
            className="flex-1 py-2.5 rounded-lg border border-line text-text-secondary text-sm hover:bg-card active:bg-card-strong transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirmPassed}
            className="flex-1 py-2.5 rounded-lg bg-success text-text-primary text-sm font-semibold hover:bg-success/90 transition-colors"
          >
            🎉 합격!
          </button>
        </div>
      </Modal>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-3 bg-card rounded w-24 mb-5" />
      <div className="h-24 bg-card rounded-xl mb-1" />
      <div className="h-10 bg-card rounded-xl mb-6" />
      <div className="h-20 bg-card rounded-xl mb-6" />
      <div className="h-3 bg-card rounded w-32 mb-4" />
      <div className="space-y-2.5">
        <div className="h-7 bg-card rounded-lg" />
        <div className="h-7 bg-card rounded-lg" />
        <div className="h-7 bg-card rounded-lg w-3/4" />
      </div>
    </div>
  )
}
