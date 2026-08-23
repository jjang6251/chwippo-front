import { useEffect, useRef, useState } from 'react'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'
import { useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { useDemoMode } from '@/contexts/demoMode'
import { goBack } from '@/utils/navigation'
import { needsResult as isAwaitingResult } from '@/utils/boardViewGroups'
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
import { useInterviewNudgeFlow } from '@/hooks/useInterviewNudgeFlow'
import { InterviewNudgeModal } from '@/components/card/InterviewNudgeModal'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import type { UpdateApplicationDto, ApplicationStep } from '@/types/application'
import { useChecklist } from '@/hooks/useStepDetail'
import { StepBar } from '@/components/card/StepBar'
import { CoverLetterTab } from '@/components/card/CoverLetterTab'
import { InterviewPrepTab } from '@/components/card/InterviewPrepTab'
import { CompanyInfoTab } from '@/components/card/CompanyInfoTab'
import { useCompanyResearchCache } from '@/hooks/useCoverletterDoc'
import { hasResearchContent } from '@/utils/companyResearch'
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
import { useCoverletterAiBlocked } from '@/hooks/useCoverletterAiBlocked'
import { loadCollapseExpanded, saveCollapseExpanded, JOB_POSTING_EXPANDED_STORAGE_KEY } from '@/utils/collapsePref'
import { toast } from '@/stores/toastStore'
import { celebrate } from '@/stores/celebrationStore'
import { useAuthStore } from '@/stores/authStore'
import { trackClarityEvent } from '@/lib/clarity'
import { hasSeenResearch, markResearchSeen } from '@/utils/researchSeen'
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
            className="flex-none text-xs font-medium px-3.5 py-2 rounded-lg text-bg bg-brand hover:bg-accent active:bg-accent-hover transition-colors"
          >
            결과 입력
          </button>
        ) : (
          <button
            onClick={onOpen}
            className="flex-none text-xs font-medium px-3.5 py-2 rounded-lg text-bg bg-brand hover:bg-accent active:bg-accent-hover transition-colors"
          >
            스텝 열기 →
          </button>
        )}
      </div>
    </div>
  )
}

type TabKey = 'steps' | 'company' | 'coverletter' | 'interview'

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
  const location = useLocation()
  const canGoBack = location.key !== 'default'
  const { data: app, isLoading, isError } = useApplication(id!)
  const { mutate: update } = useUpdateApplication(id!)
  const { mutate: updateStep } = useUpdateCurrentStep()
  // 면접 단계로 이동하면 안내 모달 (StepPage 는 제외 — 거기엔 이미 진입 버튼이 있다)
  const nudge = useInterviewNudgeFlow()
  const { mutate: updateSteps, isPending: isSavingSteps } = useUpdateSteps(id!)

  const [showResultModal, setShowResultModal] = useState(false)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null)
  const [editSteps, setEditSteps] = useState<SortableStepItem[]>([])
  const [editTags, setEditTags] = useState<string[]>([])
  const [editForm, setEditForm] = useState({ companyName: '', jobTitle: '', jobUrl: '' })
  /**
   * 탭은 URL `?tab=` 으로도 열 수 있다 — 다른 화면에서 특정 탭으로 바로 보내기 위해.
   * (면접 세션 생성 모달의 "자소서 등록하러 가기" 가 첫 사용처)
   * 초기값만 URL 에서 읽고 이후 전환은 로컬 상태로 둔다 — 탭 전환마다 히스토리를
   * 쌓으면 뒤로가기가 탭 왕복이 돼 카드에서 빠져나가지 못한다.
   */
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab')
    return t === 'coverletter' || t === 'interview' || t === 'company' ? t : 'steps'
  })
  const aiEnabled = useAiEnabled()
  const interviewAiEnabled = useInterviewAiEnabled()

  /**
   * 「회사 알아보기」 탭 노출 판정 — 🔴 **조사가 있을 때만 탭이 뜬다.**
   * 없는데 탭만 있으면 빈 화면을 여는 셈이라 안 만든 것보다 나쁘다.
   *
   * 🔴 여기는 `countHit: false` 다. 카드 상세를 열기만 해도 조회수가 오르면
   * `hit_count`(= 실제 열람 수요)의 뜻이 바뀐다. 집계는 탭을 실제로 연 뒤
   * `CompanyInfoTab` 이 기본 경로로 한다 — 훅이 두 경로의 캐시 키를 나눠 둔 이유가 이것이다.
   */
  const { data: researchProbe } = useCompanyResearchCache(id!, true, { countHit: false })

  // 공고 요건 — 파싱이 AI 호출이라 모바일·RN 에선 액션 미노출 + DART 처럼 접힘 localStorage 기억
  const jpReadOnly = useCoverletterAiBlocked()
  const [jpExpanded, setJpExpanded] = useState(() => loadCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY))
  const toggleJp = () =>
    setJpExpanded((prev) => {
      const next = !prev
      saveCollapseExpanded(JOB_POSTING_EXPANDED_STORAGE_KEY, next)
      return next
    })


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /*
    🔴 탭 목록·유효 탭 계산이 **로딩·에러 early return 보다 위**에 있는 이유 —
    아래 effect(미열람 점 소진 · 탭 열림 계측)가 훅이라 return 아래에 둘 수 없다.
    계산 자체는 `app` 을 안 쓰므로(조사 유무·flag 만 본다) 올려도 값이 달라지지 않는다.
  */
  const tabs: { v: TabKey; label: string }[] = [
    { v: 'steps', label: '전형 단계' },
    ...(hasResearchContent(researchProbe)
      ? [{ v: 'company' as const, label: '회사 알아보기' }]
      : []),
    ...(aiEnabled ? [{ v: 'coverletter' as const, label: '자소서' }] : []),
    ...(interviewAiEnabled ? [{ v: 'interview' as const, label: '면접 준비' }] : []),
  ]
  /**
   * 🔴 **없는 탭이면 기본 탭으로 안전 폴백.** `?tab=` 은 주소창·알림·다른 화면에서 그대로
   * 들어오는데, 그 탭이 지금 없을 수 있다 — 조사 없는 카드의 `tab=company`,
   * flag 가 꺼진 환경의 `tab=coverletter`. 폴백이 없으면 탭 줄에 아무것도 선택되지 않은 채
   * 본문만 빈 화면이 된다.
   * 상태(`activeTab`)는 건드리지 않는다 — 조사 응답이 늦게 도착해 탭이 생기면 그때 열린다.
   */
  const effectiveTab: TabKey = tabs.some((t) => t.v === activeTab) ? activeTab : 'steps'
  const companyTabOpen = effectiveTab === 'company'

  /**
   * 「회사 알아보기」 **미열람 점** — 조사가 있는데 이 카드에선 아직 안 열어본 상태.
   *
   * 🔴 별표(★)가 아니라 **점**이다. 이 화면 헤더의 별은 **카드 즐겨찾기**(`isStarred`)라
   * 같은 화면에 두 의미의 별이 생기면 "이 회사를 즐겨찾기 했나" 로 읽힌다.
   * 조사가 없으면 탭 자체가 없으므로 점이 거짓말할 일도 없다.
   *
   * 🔴 **state 로 들고 있지 않고 렌더에서 매번 읽는다.** 기억을 state 에 복사해 두면
   * `id`(다른 카드)·`userId`(계정 전환)가 바뀌었을 때 앞의 값이 남아 「카드별 독립」이라는
   * 전제가 깨지고, 되살리려면 effect 안에서 setState 를 해야 해 렌더가 한 번 더 돈다.
   * `localStorage.getItem` 은 동기 읽기라 그럴 값어치가 없다.
   * 탭이 열려 있는 동안은 읽지도 않는다 — **지금 보고 있는 것**이 곧 「봤음」이다.
   */
  const userId = useAuthStore((s) => s.user?.id)
  const showResearchDot =
    !companyTabOpen &&
    tabs.some((t) => t.v === 'company') &&
    !hasSeenResearch(userId, id!)

  /**
   * 탭 열림 계측 — 🔴 **어디서 왔는지를 가른다.** 안 그러면 「점이 효과가 있었나」를 영영
   * 판정하지 못한다. 점은 탭 줄에 있으므로 **점의 성과 = 탭 줄 클릭(`_tab`)** 이고,
   * 스트립(`CardResearchReveal`)을 눌러 온 것은 자동 노출의 성과(`_strip`)다.
   *
   * 출처 표식은 URL 쿼리가 아니라 **router state** 로 받는다 — `?from=strip` 을 붙이면
   * 사용자가 복사·공유한 주소에도 따라다녀 남의 클릭이 스트립 성과로 잡힌다.
   * state 는 그 이동에만 실려 오므로 표식이 없는 주소 진입은 `_url` 로 남는다.
   */
  const cameFromStrip =
    (location.state as { from?: string } | null)?.from === 'strip'
  const isDemo = useDemoMode()
  const tabRowClickedRef = useRef(false)
  const tabOpenSentRef = useRef(false)
  useEffect(() => {
    if (!companyTabOpen) return
    // ① 점 소진 — 한 번 열면 이 카드에선 다시 뜨지 않는다 (스트립·URL 진입도 「봤음」이다).
    //    localStorage 갱신뿐이라 렌더를 다시 돌리지 않는다 — 화면상 점은 이미 숨어 있다
    markResearchSeen(userId, id!)
    // ② 계측은 **화면 진입당 1회.** 리렌더·탭 왕복마다 쏘면 수치가 무의미해진다
    if (tabOpenSentRef.current || isDemo) return
    tabOpenSentRef.current = true
    const source = tabRowClickedRef.current ? 'tab' : cameFromStrip ? 'strip' : 'url'
    trackClarityEvent(`research_tab_open_${source}`)
  }, [companyTabOpen, userId, id, isDemo, cameFromStrip])

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
            className="min-h-[44px] px-4 rounded-lg bg-brand hover:bg-accent text-bg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
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
              : 'bg-brand hover:bg-accent text-bg'
          }`}
        >
          지원 현황 보드로 →
        </button>
      </div>
    </div>
  )

  const sortedSteps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sortedSteps[app.currentStepIndex]
  // 결과 대기 판정은 boardViewGroups 단일 구현 (KST 기준 — CompanyCard 와 같은 값)
  const needsResult = isAwaitingResult(app)

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
      updateStep(
        { id: app.id, stepIndex: index },
        { onSuccess: (moved) => nudge.consider(moved, index) },
      )
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

      {/* 탭: 전형 단계 / 회사 알아보기 / 자소서 / 면접 준비 — 조건부 노출 (flag · 조사 유무).
          「회사 알아보기」가 두 번째인 이유: 회사를 알고 → 자소서를 쓰고 → 면접을 본다.
          🔴 DART 접힘 섹션(「회사 정보」)과 이름을 겹치지 않게 했다 — 같은 카드 안에서
          같은 이름이 두 개면 어디를 눌러야 할지 알 수 없다. 이쪽은 AI 조사, 저쪽은 공시다. */}
      <div className="flex gap-1 p-1 bg-surface-2 border border-line rounded-lg mb-4">
        {tabs.map((t) => (
          <button
            key={t.v}
            onClick={() => {
              // 출처 구분용 — 탭 줄에서 직접 연 것과 스트립에서 온 것을 가른다 (위 effect 주석)
              if (t.v === 'company') tabRowClickedRef.current = true
              setActiveTab(t.v)
            }}
            /* 🔴 열려 있는 탭이 **배경색에만** 실려 있었다 — 스크린리더는 네 개를 전부
               「이름, 버튼」으로 똑같이 읽어서 지금 어디인지 알 수 없다. 바로 아래 미열람 점에는
               `aria-label` 을 붙여 놓고 정작 그 점이 달린 버튼의 상태가 안 나가던 상태다.
               `role="tab"` 정식 패턴을 안 쓴 이유: `tablist`/`tabpanel` + 화살표 키 이동이 딸려와
               **키보드 동작 자체가 바뀐다**(Tab 이 탭 묶음을 통째로 건너뛴다). 상태만 내보내면 된다. */
            aria-pressed={effectiveTab === t.v}
            /* break-keep — 320px 에서 탭이 4개가 되며 「회사 알아보 / 기」 로 잘렸다.
               한국어는 어절 단위로 끊어야 한 글자가 혼자 떨어지지 않는다 (랜딩과 같은 관례) */
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors break-keep
              ${effectiveTab === t.v ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            {t.label}
            {t.v === 'company' && showResearchDot && (
              /* 🔴 점만 있으면 스크린리더는 아무것도 못 읽는다 — `aria-label` 로 뜻을 싣고,
                 그 라벨이 버튼 이름 뒤에 이어 붙어 「회사 알아보기 아직 안 봤어요」가 된다.
                 🔴 `role="img"` 를 함께 준 이유: ARIA 는 **role=generic 요소에 이름 붙이는 것을
                 금지**해서, 이름 없는 `<span>` 의 `aria-label` 은 브라우저 접근성 트리에서
                 무시될 수 있다 (테스트용 accname 구현은 관대해서 이 차이를 못 잡는다 —
                 사이드바 회고 점이 같은 형태인데, 그래서 거기는 지금도 확실하지 않다).
                 텍스트 노드 대신 라벨로 넣어 라벨의 `textContent` 는 그대로 둔다.
                 색은 브랜드(sage) — danger·accent 는 「처리해야 할 일」로 읽혀 조사를 안 본 게
                 잘못처럼 보인다. 크기 6px 은 사이드바 점과 같은 값. */
              <span
                role="img"
                className="ml-1 inline-block align-middle w-1.5 h-1.5 rounded-full bg-brand"
                aria-label="아직 안 봤어요"
                title="아직 열어보지 않은 회사 조사예요"
              />
            )}
          </button>
        ))}
      </div>

      {effectiveTab === 'steps' && (
        <>
          {/* 진행 상황 — 스텝바 + 현재 스텝 카드 */}
          {app.status !== 'PLANNED' && sortedSteps.length > 0 && (
            <div className="border border-line bg-surface-2 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text-primary text-sm font-semibold">
                  진행 상황{' '}
                  <span className="font-mono text-text-quaternary font-normal text-xs">
                    {Math.min(app.currentStepIndex + 1, sortedSteps.length)}/{sortedSteps.length}
                  </span>
                </h2>
                {app.status !== 'PASSED' && (
                  <button
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

      {/* 🔴 `companyName`·`domain` 을 넘기지 않는다 — 탭 안 명함에서 아바타·회사명을 뺐다.
          같은 아바타 + 회사명이 바로 위 페이지 헤더에 이미 있어 세로로 두 번 쌓였다 */}
      {effectiveTab === 'company' && <CompanyInfoTab applicationId={app.id} />}

      {aiEnabled && effectiveTab === 'coverletter' && <CoverLetterTab applicationId={app.id} active />}
      {interviewAiEnabled && effectiveTab === 'interview' && (
        <InterviewPrepTab
          applicationId={app.id}
          active
          /* 탭 전환이 아니라 **쓰는 자리**로 — 탭은 목록이고 풀페이지가 편집 화면이다 */
          onNeedCoverletter={() => navigate(`/board/${app.id}/coverletter`)}
        />
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
            {/* 라벨·플레이스홀더는 AddCardModal · 직무 게이트 모달과 통일 (같은 컬럼이다) */}
            <label className="block text-xs text-text-tertiary mb-1.5">지원 직무</label>
            <input
              value={editForm.jobTitle}
              onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
              maxLength={100}
              placeholder="예: 백엔드 개발자 / 퍼포먼스 마케터 / 재무회계"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
            <p className="text-text-faint text-[11px] mt-1.5">
              자소서·면접 AI 가 <span className="text-text-tertiary">이 직무 기준</span>
              으로 만들어요.
            </p>
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
          <button onClick={handleSaveEdit} className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors">저장</button>
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
          onClick={() => {
            setEditSteps((prev) => [...prev, { id: crypto.randomUUID(), name: '', scheduledDate: null, location: null }])
          }}
          className="w-full py-2 text-xs text-text-tertiary border border-dashed border-line rounded-lg hover:border-line-strong hover:text-text-secondary transition-all mb-4"
        >
          + 스텝 추가
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowStepEditor(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
          <button onClick={handleSaveSteps} disabled={isSavingSteps} className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40">
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
                onClick={() => { updateStep({ id: app.id, stepIndex: pendingStepIndex }, { onSuccess: (moved) => { celebrate(app.companyName); nudge.consider(moved, pendingStepIndex) } }); setShowPassConfirm(false) }}
                className="flex-1 py-3 text-xs font-medium text-text-primary bg-success/80 hover:bg-success rounded-lg transition-colors"
              >
                합격 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 면접 유도 모달 — 이 화면 안이라 이동 없이 탭만 바꾼다 */}
      <InterviewNudgeModal
        open={nudge.pending !== null}
        variant={nudge.pending?.variant ?? 'first'}
        stepName={nudge.pending?.stepName ?? ''}
        companyName={nudge.pending?.companyName ?? ''}
        domain={nudge.pending?.domain}
        scheduledDate={nudge.pending?.scheduledDate ?? null}
        onClose={nudge.close}
        onGo={(dismissForever) => {
          // 탭도 같이 바꿔 둔다 — 생성 모달을 닫으면 면접 탭이 보이는 게 자연스럽다
          setActiveTab('interview')
          nudge.go(dismissForever)
        }}
      />
      {/* CTA → 세션 생성 모달을 **바로** 연다 (면접 차수는 방금 이동한 스텝으로 미리 채움) */}
      {nudge.creating && (
        <NewInterviewSessionModal
          applicationId={nudge.creating.appId}
          defaultStepId={nudge.creating.stepId}
          onClose={nudge.cancelCreating}
          onCreated={(sessionId) => {
            nudge.cancelCreating()
            navigate(`/interviews/${sessionId}`)
          }}
          onNeedCoverletter={() => {
            nudge.cancelCreating()
            setActiveTab('coverletter')
          }}
        />
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
