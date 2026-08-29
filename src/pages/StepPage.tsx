import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useLocation, useParams } from 'react-router-dom'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { useNativeMode } from '@/hooks/useNativeMode'
import { goBack } from '@/utils/navigation'
import dayjs from 'dayjs'
import { useApplication, useUpdateApplication, useUpdateCurrentStep } from '@/hooks/useApplications'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { useChecklist, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, useUpdateStep } from '@/hooks/useStepDetail'
import { SheetedNoteEditor } from '@/components/editor/SheetedNoteEditor'
import { AiNoteBubbleMenu } from '@/components/ai-note/AiNoteBubbleMenu'
import { AiNotePanel } from '@/components/ai-note/AiNotePanel'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { Modal } from '@/components/common/Modal'
import { GoToInterviewButton } from '@/components/card/GoToInterviewButton'
import { getStepType, STEP_TYPE_CONFIG, CHECKLIST_PRESETS } from '@/utils/stepTemplates'
import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'
import { toDateTimeLocalValue } from '@/utils/datetime'
import { useStepScheduleSave } from '@/hooks/useStepScheduleSave'
import { mergePinnedIntoNotes, notesToPlainText } from '@/utils/stepNotes'
import { PREP_NOTES_ANCHOR } from '@/pages/StudyNotes/studyNotesModel'
import { Calendar, Check, MapPin, PartyPopper } from 'lucide-react'
import { useNavCollapsedStore } from '@/stores/navCollapsedStore'

export function StepPage() {
  const { id: appId, stepId } = useParams<{ id: string; stepId: string }>()
  /* 아래에 면접 장소용 `location` state 가 따로 있다 — 라우터 쪽은 필요한 조각만 꺼내 쓴다 */
  const { hash } = useLocation()
  const navigate = useDemoNavigate()
  const isNative = useNativeMode()

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
  /**
   * **지금 보고 있는 시트**의 plain text. `null` 은 "시트 목록이 아직 안 왔다" 라 폴백
   * (기존 노트)에서 뽑는다. 시트가 오면 에디터가 곧바로 활성 시트 본문을 흘려보내고,
   * 그 뒤로는 전환·입력마다 갱신된다 (저장은 1.5s debounce라 서버 값은 늘 한 박자 뒤).
   *
   * 🔴 **활성 시트만**이다 (CEO 결정). 시트 전부를 합쳐 넘기면, 「예상 질문」 탭을 보며
   * 누른 사용자가 「기업 분석」 문장까지 질문 후보로 받게 된다 — 눈앞에 없는 내용이다.
   */
  const [liveNoteText, setLiveNoteText] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  /**
   * 노트 AI 패널 — 준비 노트에도 1차부터 붙는다 (plan D2).
   *
   * 🔴 **활성 시트의 에디터**를 잡는다. 시트를 바꾸면 tiptap 이 remount 되므로 손잡이가
   * 갈아 끼워져야 한다 — 안 그러면 패널이 이미 사라진 인스턴스에 결과를 넣으려 한다.
   * 렌더 중에 알림이 오므로(`header` 슬롯) 다음 틱에 반영한다 (공부 노트와 같은 관례).
   *
   * 면접 질문 다리(`onActiveTextChange`)와는 서로 모른다 — 같은 에디터를 각자 다른
   * 통로로 볼 뿐이라 간섭이 없다.
   */
  const [aiOpen, setAiOpen] = useState(false)
  const [noteEditor, setNoteEditor] = useState<Editor | null>(null)
  const noteEditorRef = useRef<Editor | null>(null)
  const aiEnabled = useAiEnabled()
  const handleEditorReady = useCallback((ed: Editor) => {
    if (noteEditorRef.current === ed) return
    noteEditorRef.current = ed
    queueMicrotask(() => setNoteEditor(ed))
  }, [])

  /**
   * 공부 노트 허브에서 `#prep-notes` 로 들어온 딥링크의 착지 처리.
   *
   * 🔴 **브라우저의 앵커 점프에 기댈 수 없다.** SPA 라 주소가 바뀌는 순간엔 카드·스텝이
   * 아직 로딩 중이고 그 자리에 스켈레톤만 있다 — 앵커가 없는 문서로 점프하면 아무 일도
   * 안 일어난다. 데이터가 온 **뒤에** 직접 스크롤한다.
   */
  useEffect(() => {
    if (hash !== `#${PREP_NOTES_ANCHOR}` || !step) return
    document.getElementById(PREP_NOTES_ANCHOR)?.scrollIntoView({ block: 'start' })
  }, [hash, step?.id])

  if (step && !initialized) {
    // 🔴 KST 고정 — dayjs 무-플러그인 format 은 기기 로컬 시각이라 해외에서 값이 밀린다
    setScheduledDate(toDateTimeLocalValue(step.scheduledDate))
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
  /**
   * 잠금 완화 (2026-08-16) — 「이 내용으로 면접 질문 만들기」 가 노트 없이도 눌리려면
   * 자소서 유무를 알아야 한다.
   *
   * 🔴 **훅은 early return 위에 있어야 한다** (rules-of-hooks). 그래서 스텝 유형을
   *    알기 전에 호출되고, `enabled` 로 실제 요청만 막는다 —
   *    이 값이 false 면 네트워크는 안 나간다.
   */
  const { data: stepCoverletters } = useCoverletters(
    appId ?? '',
    // 🔴 면접 스텝일 때만 실제로 부른다 — 모든 스텝 진입마다 부르면 불필요한 쿼리가 는다.
    //    `step` 은 early return 전에도 계산돼 있어 여기서 판정할 수 있다.
    !!appId && !!step && getStepType(step.name) === 'interview',
  )
  const hasCoverletter = (stepCoverletters?.length ?? 0) > 0

  function handleDateBlur() {
    setEditingField(null)
  }
  // 저장 정책(KST offset 부착 · soft-ask 발신 · 데모 미발신)은 `useStepScheduleSave` 가 갖는다 —
  // 카드 상세 인라인 편집과 **같은 구현**을 쓰려고 뺐다 (2026-08-25).
  const saveScheduledDate = useStepScheduleSave(appId!, stepId!)
  function handleLocationBlur() {
    setEditingField(null)
    updateStep({ stepId: stepId!, location: location || null })
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

  // KST 기준 — 인라인 계산은 로컬 TZ 를 타서 비KST 기기에서 하루 어긋났다
  const dday = step.scheduledDate ? calcDday(step.scheduledDate) : null
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

  /*
    준비 노트 **폴백** 콘텐츠 — 시트가 0장인 스텝에서만 첫 탭에 보인다.
    죽은 pinnedContent 는 여기서 맨 앞 "📌 …" 문단으로 병합돼 **승격 시 함께 시트로 복사**된다.

    🔴 이 화면은 더 이상 `notes`·`pinnedContent` 를 **쓰지 않는다** (읽기 폴백 전용).
    저장은 전부 시트 API 로 나가고 원본은 그대로 남는다 — 되돌릴 자리를 지우지 않기 위해서다.
  */
  const initialNotes = mergePinnedIntoNotes(step.notes, step.pinnedContent)

  // 면접 스텝에서만 질문 은행으로 건너간다 — 판정은 `getStepType` 단일 구현
  // (스텝명에 '면접' 이 없는 'PT·토론'·'컬처핏'도 면접형이다)
  const isInterviewStep = stepType === 'interview'
  const noteText = liveNoteText ?? notesToPlainText(initialNotes)
  const hasNoteText = noteText.trim().length > 0

  return (
    // 패널 열림 시 본문 밀어내기 — 공부 노트와 동일 (fixed 패널이 본문을 덮지 않게)
    <div className={`transition-[padding] duration-200 ${aiOpen ? 'lg:pr-[380px]' : ''}`}>
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
                // eslint-disable-next-line chwippo/no-bare-autofocus -- 날짜 줄을 눌러야(editingField==='date') 버튼이 이 칸으로 바뀐다 — 탭 뒤 등장
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
              ) : step.dateHint ? (
                /*
                  공고가 날짜 대신 **말로** 알려 준 경우 — 「9월 예정」·「추후 공지」.
                  🔴 「날짜 설정」으로 덮으면 공고가 준 정보가 화면에서 사라진다. 날짜를 넣는
                  순간 서버가 힌트를 지우므로 둘이 같이 서 있는 상태는 없다.
                */
                <span className="flex-1 flex flex-wrap items-center gap-x-2 min-w-0">
                  <span className="text-sm text-text-secondary">{step.dateHint}</span>
                  <span className="text-[11px] text-text-quaternary">
                    공고에서 가져왔어요 · 날짜가 나오면 적어 주세요
                  </span>
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
                // eslint-disable-next-line chwippo/no-bare-autofocus -- 장소 줄을 눌러야(editingField==='location') 버튼이 이 칸으로 바뀐다 — 탭 뒤 등장
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
                aria-label={item.isDone ? '완료 취소' : '완료 표시'}
                onClick={() => updateItem({ itemId: item.id, isDone: !item.isDone })}
                className="group/check w-11 h-11 -ml-2.5 sm:-my-3 flex items-center justify-center shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                <span
                  className={`w-[17px] h-[17px] rounded border flex items-center justify-center transition-colors ${
                    item.isDone ? 'bg-brand border-brand' : 'border-line group-hover/check:border-brand/60'
                  }`}
                >
                  {item.isDone && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
              <span className={`flex-1 text-sm leading-relaxed ${item.isDone ? 'line-through text-text-quaternary' : 'text-text-primary'}`}>
                {item.content}
              </span>
              <button
                aria-label="삭제"
                onClick={() => deleteItem(item.id)}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-text-quaternary hover:text-danger w-11 h-11 -mr-2.5 sm:-my-3 flex items-center justify-center transition-all shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
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
            {/* 입력이 있을 때만 노출 — 빈 상태에선 비활성 버튼이 우측에 떠 삭제(×) 열 정렬을
                깨뜨리고 죽은 무게로 보였다 (2026-07-25 실기 발견). 형제(DayDetailContent)는
                고스트 행이라 버튼 없음 → 입력 시에만 등장시켜 어포던스와 정돈을 동시 충족 */}
            {inputText.trim() && (
              <button
                onClick={handleAddItem}
                className="shrink-0 whitespace-nowrap h-8 px-3 text-[13px] sm:h-7 sm:px-2.5 sm:text-[12px] rounded-lg bg-brand hover:bg-accent active:bg-accent-hover text-bg font-semibold flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                추가
              </button>
            )}
          </div>
        </div>
        </div>
      </div>

      {/*
        ── 준비 노트 (핵심 메모 통합) ───────────────────
        🔴 `id` 는 **공부 노트 허브의 딥링크 착지점**이다 (`PREP_NOTES_ANCHOR`).
        허브의 「회사 준비」 행·백링크가 `#prep-notes` 로 들어와 이 섹션까지 스크롤한다 —
        이 id 가 사라지면 이동은 되는데 화면 맨 위에 떨어져서 아무 일도 안 난 것처럼 보인다.
      */}
      <div id={PREP_NOTES_ANCHOR} className="mb-6 scroll-mt-16">
        {/*
          🔴 **노트 → 면접 질문 은행.** 이 기능의 출발점이 "준비 노트에 기출을 적던
          사람" 인데, 정작 노트에서 은행으로 가는 길이 없었다 (공통 조상인 카드 상세뿐).
          기본 포맷의 첫 칸이 「예상 질문 & 답변」이라 **여기 적힌 게 곧 질문 목록**이다.

          자리가 **섹션 라벨 행 우측**이다 (CEO 실기 판단 2026-08-11 — 에디터 아래에서
          옮겼다). 노트는 세로로 긴 문서라 아래에 두면 길게 쓸수록 버튼이 화면 밖으로
          밀려난다 — 시트 탭 줄을 위로 올린 것과 같은 이유다. 형제인 「준비 체크리스트」
          라벨 행이 이미 쓰는 문법(라벨 · 하이라인 · 우측 액션)이라 새로 만드는 자리도 아니다.

          비었으면 잠근다: 빈 채로 넘어가면 세션 생성(코인)만 쓰고 빈 폼을 만난다.
        */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-text-quaternary shrink-0">준비 노트</span>
          <div className="flex-1 h-px bg-card-strong" />
          {isInterviewStep && appId && (
            <GoToInterviewButton
              applicationId={appId}
              label="이 내용으로 면접 질문 만들기"
              navState={{ bridgeText: noteText }}
              /*
                🔴 잠금 조건을 **완화**했다 (2026-08-16): `노트 없음` → `노트·자소서 둘 다 없음`.
                원래 잠근 이유("빈 채로 넘어가면 세션 생성만 쓰고 빈 폼을 만난다")는 **자소서까지
                없을 때** 성립한다 — 자소서가 있으면 그걸 바탕으로 질문이 생성되므로 빈 폼이 아니다.
                노트가 비었다고 잠그면 **처음 온 사람은 이 기능에 영영 못 들어간다.**
              */
              disabled={!hasNoteText && !hasCoverletter}
              title={
                hasNoteText
                  ? '준비 노트를 붙여넣기 칸에 채워서 질문으로 만들어요'
                  : hasCoverletter
                    ? '자소서를 바탕으로 예상 질문을 만들어요 (준비 노트를 적으면 그 내용도 함께 씁니다)'
                    : '준비 노트나 자소서가 있어야 질문을 만들 수 있어요'
              }
              /* 자소서 화면이 아니다 — 닫기만 하면 갈 곳이 없다 */
              onNeedCoverletter={() => navigate(`/board/${appId}/coverletter`)}
            />
          )}
        </div>
        <SheetedNoteEditor
          appId={appId!}
          stepId={stepId!}
          stepName={step.name}
          fallbackContent={initialNotes}
          onActiveTextChange={isInterviewStep ? setLiveNoteText : undefined}
          onEditorReady={aiEnabled ? handleEditorReady : undefined}
          onAiOpen={aiEnabled ? () => setAiOpen(true) : undefined}
        />
        {/* 드래그 → 「AI」 (데스크탑). 모바일은 툴바 버튼이 같은 자리를 대신한다 */}
        {aiEnabled && noteEditor && (
          <AiNoteBubbleMenu editor={noteEditor} onOpen={() => setAiOpen(true)} />
        )}
      </div>

      {/* 🔴 닫아도 언마운트하지 않는다 — 히스토리가 `open` 보다 위에 있어야 유지된다 */}
      {appId && stepId && (
        <AiNotePanel
          editor={noteEditor}
          resource={{ type: 'application_step', appId, stepId }}
          open={aiOpen}
          onClose={() => setAiOpen(false)}
        />
      )}

      {isCurrentStep && (
        <StepCompleteCta
          isLastStep={isLastStep}
          isNative={isNative}
          onComplete={handleCompleteStep}
        />
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
    </div>
  )
}

/**
 * 「이 단계 완료하기」 — **축소형 CTA** (CEO 결정 2026-08-11).
 *
 * 🔴 **왜 줄였나.** 이 바는 화면 하단을 **항상** 가로막고 있었다. 스텝 페이지는 노트가
 * 길어질수록 세로로 자라는데, 정작 이 버튼은 노트를 다 쓴 **뒤에** 한 번 누르는 것이다.
 * 쓰는 내내 화면 한 줄을 내주고 있을 이유가 없다. 그래서 평소엔 우하단 원형으로 물러나
 * 있다가, **페이지 끝에 닿으면** 원래의 풀폭 바로 돌아온다 — 누를 때가 됐을 때만 커진다.
 *
 * 판정은 콘텐츠 끝의 sentinel + `IntersectionObserver`(`rootMargin` 하단 160px = "근처").
 *
 * 🔴 **관측 전 기본값**이 함정이다. 스크롤이 없을 만큼 짧은 스텝(체크리스트도 노트도 빈
 * 새 카드)은 sentinel 이 처음부터 보이므로 IO 의 **최초 콜백**이 곧바로 확장시킨다 —
 * 그래서 기본값을 축소로 두어도 "짧은 페이지인데 영영 작은 버튼" 이 되지 않는다.
 * 다만 IO 자체가 없는 환경에선 콜백이 아예 안 와서 축소인 채로 굳는다. 그 경우는
 * **오늘의 풀폭 바로 퇴화**시킨다 — 기능이 줄지언정 낯설어지지는 않게.
 *
 * 전환은 `animate-fadeIn`(앱이 이미 쓰는 진입 애니메이션) 하나뿐이다. morph 는 없다.
 * 모션 최소화는 `index.css` 의 전역 `prefers-reduced-motion: reduce` 규칙이 이미 잡는다
 * (animation/transition-duration 0.01ms) — 개별 `motion-reduce:` 를 덧댈 필요가 없음을 실측 확인.
 */
function StepCompleteCta({
  isLastStep,
  isNative,
  onComplete,
}: {
  isLastStep: boolean
  isNative: boolean
  onComplete: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(false)
  // FAB 좌하단 오프셋 — 데스크탑 사이드바 폭(펼침/접힘)만큼 비켜 앉는다
  const navCollapsed = useNavCollapsedStore((s) => s.collapsed)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver !== 'function') {
      setAtEnd(true) // 관측할 수 없으면 기존 풀폭 바 (오늘 동작으로 퇴화)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => setAtEnd(entry.isIntersecting),
      // 아래로 160px 넓혀 본다 — 끝에 "닿기 직전" 부터 커져야 손이 먼저 가 있다
      { rootMargin: '0px 0px 160px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* 화면에 보이는 문구는 그대로 둔다 (🎉 포함). 아이콘 전용 축소형에서만 이모지를 뺀다 —
     낭독기가 "파티 크래커" 를 먼저 읽어 버려 무슨 버튼인지가 뒤로 밀린다. */
  const barLabel = isLastStep ? '🎉 최종 합격 처리하기' : '이 단계 완료하기'
  const a11yLabel = isLastStep ? '최종 합격 처리하기' : '이 단계 완료하기'
  /* 웹 모바일은 MobileNav(실측 60px·z-50) 위로 띄운다: 60 + 8(간격) + safe-area.
     네이티브는 탭바가 숨겨져 바닥 밀착 — 기존 바가 쓰던 계산 그대로다. */
  const liftCls = isNative
    ? 'pb-4'
    : 'pb-[calc(68px+env(safe-area-inset-bottom,0px))] lg:pb-4'
  const fabLiftCls = isNative
    ? 'bottom-4'
    : 'bottom-[calc(68px+env(safe-area-inset-bottom,0px))] lg:bottom-4'
  const CTA_COLOR =
    'bg-brand hover:bg-accent active:bg-accent-hover text-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

  return (
    <>
      {/* 콘텐츠 끝 표식 — 보이지 않지만 자리를 차지해야 관측된다 */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {atEnd ? (
        /* 그라데이션이 탭바까지 이어져 버튼 아래 틈으로 콘텐츠가 비치지 않음 */
        <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none animate-fadeIn">
          <div
            className={`max-w-2xl mx-auto px-4 sm:px-6 pt-8 ${liftCls} bg-gradient-to-t from-bg via-bg/95 to-transparent pointer-events-auto`}
          >
            <button
              onClick={onComplete}
              className={`w-full ${CTA_COLOR} font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2`}
            >
              {barLabel}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className={`fixed left-4 ${navCollapsed ? 'lg:left-[4.5rem]' : 'lg:left-[15.5rem]'} z-20 ${fabLiftCls} animate-fadeIn`}>
          {/*
            🔴 좌하단이다 (2026-08-13 실측). 우하단에 두면 「이 내용으로 면접 질문 만들기」와
            특정 스크롤 구간에서 겹쳐 — 같은 sage 두 컨트롤이 한 덩어리로 융합되고 버튼
            우측 1/4 이 탭을 강탈당했다. 좌측 밴드의 인터랙티브는 체크박스뿐이라 오탭
            결과가 가역 1탭 — 위험 순위가 압도적으로 낮다.
            데스크탑 좌측은 사이드바(펼침 224px·접힘 56px) 폭만큼 비켜 앉는다 — 상태 구독.
          */}
          <button
            onClick={onComplete}
            aria-label={a11yLabel}
            title={a11yLabel}
            className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center ${CTA_COLOR}`}
          >
            {isLastStep ? (
              <PartyPopper size={20} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Check size={22} strokeWidth={2.25} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </>
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
