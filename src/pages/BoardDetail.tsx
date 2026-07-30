import { useState } from 'react'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'
import { useParams, useLocation } from 'react-router-dom'
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
import type { UpdateApplicationDto, ApplicationStep } from '@/types/application'
import { useChecklist } from '@/hooks/useStepDetail'
import { StepBar } from '@/components/card/StepBar'
import { CoverLetterTab } from '@/components/card/CoverLetterTab'
import { InterviewPrepTab } from '@/components/card/InterviewPrepTab'
import { DdayBadge } from '@/components/card/DdayBadge'
import { StarToggle } from '@/components/card/StarToggle'
import { SetResultModal } from '@/components/card/SetResultModal'
import { FailedTakeawayBox } from '@/components/card/FailedTakeawayBox'
import { Modal } from '@/components/common/Modal'
import { TagSelector } from '@/components/common/TagSelector'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { CompanyInfoSection } from '@/components/board/CompanyInfoSection'
import { CompanyMemoCard } from '@/components/board/CompanyMemoCard'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { useCoverletterReadOnly } from '@/hooks/useCoverletterReadOnly'
import { loadCollapseExpanded, saveCollapseExpanded, JOB_POSTING_EXPANDED_STORAGE_KEY } from '@/utils/collapsePref'
import { toast } from '@/stores/toastStore'
import { celebrate } from '@/stores/celebrationStore'
import { useTourStore } from '@/stores/tourStore'
import { parseTags, serializeTags, JOB_CATEGORY_COLOR, JOB_CATEGORY_ICON } from '@/utils/tags'
import { getStepType, STEP_TYPE_CONFIG } from '@/utils/stepTemplates'
import { formatStepSchedule } from '@/utils/datetime'
import { Calendar, MapPin, Pencil, GripVertical } from 'lucide-react'

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
          aria-label="드래그로 순서 변경"
          className="flex-none text-text-quaternary hover:text-text-tertiary cursor-grab active:cursor-grabbing p-1 touch-none"
        >
          <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="text-text-quaternary text-xs w-4 text-center">{index + 1}</span>
        <input
          value={item.name}
          onChange={(e) => onChange(item.id, e.target.value)}
          className="flex-1 bg-input border border-line rounded-lg px-2.5 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
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


// --- 현재 스텝 카드 (진행 상황 섹션 안) ---
function CurrentStepCard({
  appId, step, needsResult, onOpen, onSetResult,
}: {
  appId: string
  step: ApplicationStep
  needsResult: boolean
  onOpen: () => void
  onSetResult: () => void
}) {
  const { data: checklist = [] } = useChecklist(appId, step.id)
  const type = getStepType(step.name)
  const cfg = STEP_TYPE_CONFIG[type]
  const StepIcon = cfg.Icon
  const { dateLabel, timeLabel } = formatStepSchedule(step.scheduledDate)
  const doneCount = checklist.filter((i) => i.isDone).length
  // U29 card-solid 구분감 — 저알파 틴트(bg-card·warning/5) 금지, 불투명 배경+유형색 스트라이프
  const accentCls = needsResult ? 'border-l-warning' : cfg.accentBorderCls

  return (
    <div className={`mt-5 bg-card-solid shadow-sm border border-line-strong border-l-[3px] rounded-xl p-4 ${accentCls}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <StepIcon size={15} strokeWidth={1.75} className={`shrink-0 ${cfg.colorCls}`} aria-hidden="true" />
            <span className="text-sm font-semibold text-text-primary truncate">{step.name}</span>
          </div>
          {needsResult ? (
            <p className="text-xs text-warning font-medium">결과 대기 중 — 합격·불합격을 입력해 주세요</p>
          ) : (
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-text-secondary flex-wrap">
              {dateLabel ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={13} strokeWidth={1.75} className={`${cfg.colorCls} shrink-0`} aria-hidden="true" /> {dateLabel}
                  {timeLabel && <b className="ml-1 font-mono text-brand">{timeLabel}</b>}
                </span>
              ) : (
                <button
                  onClick={onOpen}
                  className="inline-flex items-center gap-1 text-text-quaternary hover:text-text-secondary transition-colors"
                >
                  <Calendar size={13} strokeWidth={1.75} className="shrink-0" aria-hidden="true" /> 날짜 설정하기
                </button>
              )}
              {step.location && <span className="inline-flex items-center gap-1 max-w-[180px]"><MapPin size={13} strokeWidth={1.75} className={`${cfg.colorCls} shrink-0`} aria-hidden="true" /> <span className="truncate">{step.location}</span></span>}
              {checklist.length > 0 && (
                <span className="text-text-quaternary">체크리스트 {doneCount}/{checklist.length}</span>
              )}
            </div>
          )}
        </div>
        {needsResult ? (
          <button
            onClick={onSetResult}
            className="flex-none text-xs font-medium px-3.5 py-2 rounded-lg text-text-primary bg-brand hover:bg-accent active:bg-accent-hover transition-colors"
          >
            결과 입력
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="flex-none text-xs font-medium px-3.5 py-2 rounded-lg text-text-primary bg-brand hover:bg-accent active:bg-accent-hover transition-colors"
          >
            스텝 열기 →
          </button>
        )}
      </div>
    </div>
  )
}

// --- 메인 페이지 ---
export function BoardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useDemoNavigate()
  /*
    직접 진입(북마크·공유 링크·주소 입력)이면 '이전으로' 를 감춘다.
    `window.history.length` 는 **우리 앱 안에서 왔는지 알려주지 않는다** — 외부에서
    들어와도 1보다 클 수 있어, 그 상태로 뒤로 가면 앱 밖으로 나간다 (2026-07-30 수정).
    react-router 는 앱 안에서 이동해 생긴 항목에만 고유 key 를 주고, 첫 진입은 'default' 다.
  */
  const canGoBack = useLocation().key !== 'default'
  const { data: app, isLoading, isError } = useApplication(id!)
  const { mutate: update } = useUpdateApplication(id!)
  const { mutate: updateStep } = useUpdateCurrentStep()
  const { mutate: updateSteps, isPending: isSavingSteps } = useUpdateSteps(id!)

  const [showResultModal, setShowResultModal] = useState(false)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null)
  const [editSteps, setEditSteps] = useState<SortableStepItem[]>([])
  const [editTags, setEditTags] = useState<string[]>([])
  const [editForm, setEditForm] = useState({ companyName: '', jobTitle: '', jobUrl: '' })
  const [activeTab, setActiveTab] = useState<
    'steps' | 'coverletter' | 'interview'
  >('steps')
  const aiEnabled = useAiEnabled()
  const interviewAiEnabled = useInterviewAiEnabled()

  // 공고 요건 — 자소서와 동일 정책(모바일·RN 보기 전용) + DART 처럼 접힘 localStorage 기억
  const jpReadOnly = useCoverletterReadOnly()
  const [jpExpanded, setJpExpanded] = useState(() => loadCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY))
  const toggleJp = () =>
    setJpExpanded((prev) => {
      const next = !prev
      saveCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY, next)
      return next
    })

  const tourActive = useTourStore((s) => s.active)
  const tourStep = useTourStore((s) => s.step)
  const tourNext = useTourStore((s) => s.next)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isLoading) return <DetailSkeleton />
  /*
    카드가 없거나(삭제됨) id 형식이 틀린 경우(400) 둘 다 여기로 온다.
    이전엔 `!app` 만 보고 "카드를 찾을 수 없어요" 한 줄만 띄워, 알림에서 넘어온
    사용자가 **원인도 모르고 돌아갈 길도 없는** 화면에 갇혔다.
    알림은 최대 30일 남는데 그 사이 카드를 지우면 링크가 죽는다 (2026-07-29 발견).
  */
  if (isError || !app) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <p className="text-text-secondary text-sm font-medium mb-1">
        카드를 찾을 수 없어요
      </p>
      <p className="text-text-tertiary text-xs leading-relaxed mb-5">
        삭제되었거나 주소가 바뀌었을 수 있어요.
      </p>
      <div className="flex items-center gap-2">
        {/*
          나갈 길은 "내가 있던 곳"이 우선이다 — 알림에서 눌러 들어온 사용자를 보드로 보내면
          안 물어본 곳으로 데려가는 셈이고, 읽던 알림 목록으로 못 돌아온다.
          단 북마크·공유 링크·주소 직접 입력으로도 오는 화면이라 이력이 없을 수 있어
          보드로 가는 길을 함께 둔다.
        */}
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[44px] px-4 rounded-lg bg-brand hover:bg-brand-hover text-bg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            ← 이전으로
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/board')}
          className={`min-h-[44px] px-4 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
            canGoBack
              ? 'border border-line text-text-secondary hover:bg-surface-2'
              : 'bg-brand hover:bg-brand-hover text-bg'
          }`}
        >
          지원 현황 보드로 →
        </button>
      </div>
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
  const isResolved = app.status === 'PASSED' || app.status === 'FAILED'

  // 빈 값 정책 — `value || undefined` 는 빈 값이 PATCH 에서 빠져 "지웠는데 저장 토스트만 뜨고
  // 새로고침하면 복귀"하는 거짓 저장이 된다 (CEO 실기 2026-07-20). 삭제 의도는 '' 로 전송.
  // 단 companyName(필수)·jobUrl(@IsUrl 이라 '' = 400)은 빈 값 저장 불가 → 요청 자체 스킵.
  const save = (field: keyof UpdateApplicationDto) => (value: string) => {
    const isEmpty = value.trim() === ''
    if (isEmpty && (field === 'companyName' || field === 'jobUrl')) return
    update(
      { [field]: isEmpty ? '' : value } as UpdateApplicationDto,
      {
        onSuccess: () => toast.show('저장됐어요.'),
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleStepClick = (index: number) => {
    const clickedLast = index === sortedSteps.length - 1
    if (clickedLast) {
      setPendingStepIndex(index)
      setShowPassConfirm(true)
    } else {
      updateStep({ id: app.id, stepIndex: index })
      if (tourActive && tourStep === 7) tourNext()
    }
  }

  const openStep = (stepId: string) => navigate(`/board/${app.id}/steps/${stepId}`)

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

  const openEditModal = () => {
    setEditForm({
      companyName: app.companyName,
      jobTitle: app.jobTitle ?? '',
      jobUrl: app.jobUrl ?? '',
    })
    setEditTags(currentTags)
    setShowEditModal(true)
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

  const handleSaveEdit = () => {
    const dto: UpdateApplicationDto = {
      jobTitle: editForm.jobTitle.trim() || undefined,
      jobCategory: serializeTags(editTags) || undefined,
      jobUrl: editForm.jobUrl.trim() || undefined,
    }
    const name = editForm.companyName.trim()
    if (name) dto.companyName = name
    update(dto, {
      onSuccess: () => { setShowEditModal(false); toast.show('저장됐어요.') },
      onError: () => toast.error('저장에 실패했습니다.'),
    })
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

      {/* 기본 정보 헤더 — 보기형 + ✎ 편집 진입 */}
      <div className={`border rounded-xl px-5 py-4 mb-4 bg-surface-2 ${app.status === 'PASSED' ? 'border-success/40' : 'border-line'}`}>
        <div className="flex items-center gap-3.5">
          <CompanyAvatar name={app.companyName} domain={app.domain} size="md" className="flex-none" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold text-text-primary truncate">{app.companyName}</h1>
              {currentTags.map((tag) => {
                const colorClass = JOB_CATEGORY_COLOR[tag] ?? JOB_CATEGORY_COLOR['기타']
                const TagIcon = JOB_CATEGORY_ICON[tag] ?? JOB_CATEGORY_ICON['기타']
                return (
                  <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorClass}`}>
                    <TagIcon size={11} strokeWidth={2} aria-hidden="true" /> {tag}
                  </span>
                )
              })}
            </div>
            {(app.jobTitle || app.jobUrl) && (
              <div className="flex items-center gap-2 mt-0.5 text-xs text-text-tertiary min-w-0">
                {app.jobTitle && <span className="truncate">{app.jobTitle}</span>}
                {app.jobTitle && app.jobUrl && <span className="text-text-quaternary shrink-0">·</span>}
                {app.jobUrl && (
                  <a
                    href={app.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline shrink-0 inline-flex items-baseline gap-0.5"
                  >
                    공고 보기 <span aria-hidden="true" className="text-[9px]">↗</span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-none">
            <StarToggle
              starred={app.isStarred}
              onToggle={() => update({ isStarred: !app.isStarred })}
              size="sm"
            />
            {app.status === 'PASSED' && (
              <span className="text-xs text-success font-medium bg-success/10 px-2 py-1 rounded-full border border-success/20 whitespace-nowrap">🎉 최종 합격</span>
            )}
            {app.status === 'FAILED' && (
              <span className="text-xs text-text-tertiary font-medium bg-surface-3 px-2 py-1 rounded-full border border-line whitespace-nowrap">불합격</span>
            )}
            {ddayTarget && !isResolved && <DdayBadge deadline={ddayTarget} />}
            <button
              onClick={openEditModal}
              aria-label="기본 정보 편집"
              title="기본 정보 편집"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            >
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* A9 — 결과 되돌리기 (잘못 처리 롤백 · 합격/불합격 공통) */}
        {isResolved && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() =>
                update({
                  status: (app.steps?.length ?? 0) > 0 ? 'IN_PROGRESS' : 'PLANNED',
                })
              }
              className="text-[11px] text-text-quaternary hover:text-text-secondary underline underline-offset-2 whitespace-nowrap transition-colors"
              title="결과 입력을 취소하고 진행 중으로 되돌려요"
            >
              결과 되돌리기
            </button>
          </div>
        )}

        {/* A9 — 탈락 회고 (FAILED 카드만 · 컴포넌트 내부에서 가드) */}
        <FailedTakeawayBox application={app} />
      </div>

      {/* 탭: 전형 단계 / 자소서 / 면접 준비 — 기능별 flag 로 노출 (useAiEnabled.ts) */}
      <div className="flex gap-1 p-1 bg-surface-2 border border-line rounded-lg mb-4">
        {[
          { v: 'steps' as const, label: '전형 단계' },
          ...(aiEnabled
            ? [{ v: 'coverletter' as const, label: '자소서', tourAttr: 'coverletter-tab' }]
            : []),
          ...(interviewAiEnabled
            ? [{ v: 'interview' as const, label: '면접 준비' }]
            : []),
        ].map((t) => (
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
          {/* 진행 상황 — 스텝바 + 현재 스텝 카드 */}
          {app.status !== 'PLANNED' && sortedSteps.length > 0 && (
            <div data-tour="step-bar" className="border border-line bg-surface-2 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text-primary text-sm font-semibold">
                  진행 상황{' '}
                  <span className="font-mono text-text-quaternary font-normal text-xs">
                    {Math.min(app.currentStepIndex + 1, sortedSteps.length)}/{sortedSteps.length}
                  </span>
                </h2>
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
                onStepClick={!isResolved ? handleStepClick : undefined}
                onStepNameClick={openStep}
                size="md"
              />
              {app.status === 'IN_PROGRESS' && currentStep && (
                <CurrentStepCard
                  appId={app.id}
                  step={currentStep}
                  needsResult={needsResult}
                  onOpen={() => openStep(currentStep.id)}
                  onSetResult={() => setShowResultModal(true)}
                />
              )}
            </div>
          )}

          {/* 공고 요건 — 자소서와 동일 UI·데이터(app.jobPosting 단일 소스). 회사 메모 위 (CEO 2026-07-20) */}
          <JobPostingBanner
            variant="section"
            applicationId={app.id}
            jobPosting={app.jobPosting}
            jobPostingStatus={app.jobPostingStatus}
            readOnly={jpReadOnly}
            expanded={jpExpanded}
            onToggle={toggleJp}
          />

          {/* 회사 메모 — 이 회사 전반에 대한 기록 (전형별 메모는 각 스텝 안). 시작 칩으로 섹션 유도 */}
          <div className="mt-4">
            <CompanyMemoCard value={app.memo ?? ''} onSave={save('memo')} />
          </div>

          {/* 회사 정보 (DART) — 상장사이거나 매핑된 회사만 자동 노출 · 접힘 기본 */}
          <div className="mt-4">
            <CompanyInfoSection companyName={app.companyName} />
          </div>
        </>
      )}

      {aiEnabled && activeTab === 'coverletter' && <CoverLetterTab applicationId={app.id} active />}
      {interviewAiEnabled && activeTab === 'interview' && (
        <InterviewPrepTab applicationId={app.id} active />
      )}

      {/* 결과 모달 */}
      <SetResultModal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        applicationId={app.id}
        companyName={app.companyName}
      />

      {/* 기본 정보 편집 모달 — 회사명·직무·태그·공고 URL (입력 16px = iOS 확대 방지) */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="기본 정보 편집">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">회사명</label>
            <input
              value={editForm.companyName}
              onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
              placeholder="회사명"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">직무</label>
            <input
              value={editForm.jobTitle}
              onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
              placeholder="예: 서버 개발자"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-2">직군 태그</label>
            <TagSelector selected={editTags} onChange={setEditTags} />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">채용공고 URL</label>
            <input
              value={editForm.jobUrl}
              onChange={(e) => setEditForm((f) => ({ ...f, jobUrl: e.target.value }))}
              inputMode="url"
              placeholder="https://"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
          <button onClick={handleSaveEdit} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors">저장</button>
        </div>
      </Modal>

      {/* 스텝 편집 모달 (드래그 가능) */}
      <Modal open={showStepEditor} onClose={() => setShowStepEditor(false)} title="스텝 편집">
        <p className="inline-flex items-center gap-1 text-text-quaternary text-xs mb-3"><GripVertical size={13} strokeWidth={1.75} aria-hidden="true" /> 드래그로 순서를 변경할 수 있어요</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={editSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5 max-h-72 overflow-y-auto overscroll-contain pr-1 mb-3">
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
      <div className="border border-line bg-surface-2 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 bg-card rounded-lg flex-none" />
          <div className="flex-1"><div className="h-4 bg-card-strong rounded w-32 mb-2" /><div className="h-3 bg-card rounded w-24" /></div>
        </div>
      </div>
      <div className="h-10 bg-card rounded-lg mb-4" />
      <div className="h-40 bg-card rounded-xl" />
    </div>
  )
}
