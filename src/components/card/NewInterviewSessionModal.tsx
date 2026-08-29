import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Lightbulb, Target } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { useActivities, useActivityLogs } from '@/hooks/useActivities'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { useCreateInterviewPrepSession } from '@/hooks/useInterviewPrep'
import { JobTitleField } from '@/components/card/JobTitleField'
import { PromoteJobTitleRow } from '@/components/card/PromoteJobTitleRow'
import { JOB_SERIES } from '@/utils/jobRole'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import type { JobTitleSource } from '@/types/application'
import type { InterviewType } from '@/types/interviewPrep'
import { INTERVIEW_TYPE_LABEL } from '@/types/interviewPrep'

interface Props {
  applicationId: string
  onClose: () => void
  onCreated: (sessionId: string) => void
  /**
   * v2 — 자소서가 0건이라 세션을 만들 수 없을 때 "자소서 등록하러 가기".
   * 모달을 닫고 같은 카드의 **자소서 풀페이지**(`/board/:id/coverletter`)로 보낸다.
   * 경로는 부모가 안다 — 이 모달은 어디서 열렸는지 모르기 때문이다.
   */
  onNeedCoverletter: () => void
  /**
   * 면접 유도 모달에서 열릴 때 **방금 이동한 스텝**을 미리 골라 둔다.
   * 그 순간 우리는 사용자가 어느 단계로 갔는지 알고 있는데, 비워 두면
   * 드롭다운을 다시 열어 같은 걸 고르게 된다 (필수 입력이라 더 어색하다).
   */
  defaultStepId?: string
}

const TYPE_OPTIONS: Array<{ value: InterviewType; label: string }> = (
  Object.entries(INTERVIEW_TYPE_LABEL) as Array<[InterviewType, string]>
).map(([value, label]) => ({ value, label }))

const CUSTOM_ROUND = '__custom__'

/**
 * F6 PR 2 Phase 4 — 새 면접 세션 생성 모달.
 *
 * 섹션 구분 (필수·권장·선택 시각화):
 * 1. 회사·직무 확인 (read-only, 상단 confirm 카드)
 * 2. 면접 정보 (round 필수 · 면접 종류 선택)
 * 3. AI 질문 품질 강화 (권장) — 공고 요건(정리 결과 재사용) · 강조 포인트
 * 4. 참고 자료 (권장) — 자소서 multi-select + 활동 로그 트리 (전체 선택 가능)
 */
export function NewInterviewSessionModal({
  applicationId,
  onClose,
  onCreated,
  onNeedCoverletter,
  defaultStepId,
}: Props) {
  /**
   * 🔴 값이 스텝 **이름**이 아니라 **id** 다 (2026-08-16 변경).
   *
   * 예전엔 `value={s.name}` 이라 이름 문자열만 남았고, 그래서 ① 스텝 이름을 고치면
   * 세션 `round` 가 옛 이름으로 굳고 ② 「이 스텝의 세션이 있나?」를 물을 수 없었다.
   * id 로 바꾸면서 **동명 스텝**(「2차 면접」이 둘)도 구분된다.
   *
   * `CUSTOM_ROUND` 센티널과 uuid 가 같은 state 에 섞이므로 판별을 명시적으로 한다.
   */
  const [roundChoice, setRoundChoice] = useState(defaultStepId ?? '')
  const [customRound, setCustomRound] = useState('')
  const [interviewType, setInterviewType] = useState<InterviewType | ''>('')
  // 공고 요건 섹션 접힘 — 정리된 내용이 없으면 펼쳐서 CTA 를 바로 보이게 한다
  const [jpExpanded, setJpExpanded] = useState(true)
  const [emphasisPoints, setEmphasisPoints] = useState('')
  const [selectedClIds, setSelectedClIds] = useState<Set<string>>(new Set())
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())

  const { data: app } = useApplication(applicationId)
  const { mutateAsync: updateApp } = useUpdateApplication(applicationId)
  /** 카드에 직무가 없을 때 이 모달에서 받는 값. 저장되면 카드의 jobTitle 이 된다 */
  const [jobTitleDraft, setJobTitleDraft] = useState('')
  const [jobSource, setJobSource] = useState<JobTitleSource>('typed')
  const [jobSeriesId, setJobSeriesId] = useState<string | null>(null)
  const profileJobTitle = useAuthStore((s) => s.user?.signupJobTitle ?? null)

  /**
   * 프롬프트가 실제로 쓰는 직무 — 백엔드 `resolveJobText` 와 **같은 규칙**이다.
   * **`jobTitle`("백엔드 개발자") 우선**, 없으면 직군 태그.
   * 한쪽만 고치면 화면에 보이는 직무와 질문 기준이 어긋난다.
   */
  const resolvedJob = app?.jobTitle?.trim() || app?.jobCategory?.trim() || null
  /** 카드에 있거나, 이 모달에서 적었거나 */
  const jobReady = Boolean(resolvedJob) || jobTitleDraft.trim().length > 0

  const { data: coverletters } = useCoverletters(applicationId, true)
  const { data: activities } = useActivities()
  const { mutate: create, isPending } = useCreateInterviewPrepSession(
    applicationId,
  )

  // 자소서 기본 전체 선택 — coverletters 로드 직후 1회만 초기화 (사용자 변경은 보존)
  const initializedRef = useRef(false)
  const allClIds = useMemo(
    () => (coverletters ?? []).map((c) => c.id),
    [coverletters],
  )
  useEffect(() => {
    if (!initializedRef.current && allClIds.length > 0) {
      setSelectedClIds(new Set(allClIds))
      initializedRef.current = true
    }
  }, [allClIds])

  const toggleId = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }


  const handleSubmit = async () => {
    if (!round) {
      toast.error('면접 차수를 선택하거나 입력해 주세요.')
      return
    }
    const newJobTitle = jobTitleDraft.trim()
    if (!resolvedJob && !newJobTitle) {
      toast.error('지원 직무를 입력해 주세요. 직무별 질문의 기준이 됩니다.')
      return
    }
    // 🔴 세션 생성은 서버가 **카드의 직무를 다시 읽어** 프롬프트를 만든다.
    //    그래서 카드에 먼저 저장한 뒤 create 해야 한다. 순서가 바뀌면 이번 세션만
    //    직무 없이 생성되고, 서버 게이트에 걸려 세션 자체가 안 만들어진다.
    if (!resolvedJob && newJobTitle) {
      try {
        // 계열도 함께 — 못 잡으면 `null` 로 명시해 옛 라벨을 남기지 않는다 (카드 추가와 같은 규칙)
        const seriesLabel = jobSeriesId
          ? JOB_SERIES.find((s) => s.id === jobSeriesId)?.label
          : undefined
        await updateApp({
          jobTitle: newJobTitle,
          jobTitleSource: jobSource,
          jobCategory: seriesLabel ?? null,
        })
      } catch {
        toast.error('직무 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
    }

    create(
      {
        applicationId,
        round,
        // 「직접 입력」이면 스텝이 없다 — 그 세션은 stepId=null 로 남는다 (설계대로)
        stepId: selectedStep?.id,
        interviewType: interviewType || undefined,
        coverletterIds: Array.from(selectedClIds),
        extraLogIds: Array.from(selectedLogIds),
        emphasisPoints: emphasisPoints.trim() || undefined,
      },
      {
        onSuccess: (session) => onCreated(session.id),
        onError: () => toast.error('세션 생성에 실패했습니다.'),
      },
    )
  }

  const clList = coverletters ?? []
  // 기본함(미분류) 맨 위 고정 — 퀵캡처 기록도 면접 소재로 첨부 가능
  const actList = [...(activities ?? [])].sort(
    (a, b) => (b.isInbox ? 1 : 0) - (a.isInbox ? 1 : 0),
  )
  const steps = app?.steps ?? []

  /** 선택된 스텝 — 센티널·빈값이면 undefined (「직접 입력」 또는 미선택) */
  const selectedStep =
    roundChoice && roundChoice !== CUSTOM_ROUND
      ? steps.find((s) => s.id === roundChoice)
      : undefined
  const round =
    roundChoice === CUSTOM_ROUND
      ? customRound.trim()
      : (selectedStep?.name ?? '').trim()


  return (
    <Modal open onClose={onClose} title="새 면접 세션" width="max-w-2xl">
      {/*
        🔴 **여기에 스크롤 컨테이너를 두지 않는다.** `Modal` 본문이 이미
        `flex-1 overflow-y-auto overscroll-contain` 이라, 안에 하나 더 두면 **둘이 중첩**된다.

        그러면 손가락이 닿는 면적은 전부 안쪽이고, 안쪽이 바닥에 닿는 순간
        `overscroll-contain` 이 바깥으로 넘기는 걸 막는다. 그런데 아래 버튼 줄은 바깥에만
        있어서 **「세션 만들기」에 영원히 못 닿는다** — 428×926 실측에서 버튼 줄이 모달
        박스 밖 11px 에 있었고, 안쪽을 끝까지 내려도 1px 도 안 움직였다 (2026-08-24).
      */}
      <div className="space-y-5">
        {/* 1. 회사·직무 confirm */}
        <section>
          <div className="border border-line bg-surface rounded-lg p-3">
            <p className="text-text-faint text-[10px] mb-1.5">
              이 세션은 아래 카드 기준으로 만들어집니다
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-text-primary text-base font-semibold">
                {app?.companyName ?? '…'}
              </span>
              <span className="text-text-tertiary text-xs">
                {resolvedJob ?? '직무 미지정'}
              </span>
            </div>
            {/*
              🔴 직무가 비면 **여기서 바로 적는다** (2026-08-06).

              "세션 만들 때 물어볼게요" 안내만 뒀더니, 눈앞에 `직무 미지정` 이 보이는데
              고칠 칸이 없어서 막다른 길처럼 읽혔다. 미지정을 보여주는 자리와 고치는
              자리가 같아야 한다. 공용 게이트 모달(`useRequireJobTitle`)은 자소서
              점검·대화처럼 **입력 자리가 없는 진입점**을 위한 장치다.
            */}
            {app && !resolvedJob && (
              <div className="mt-2.5 border-t border-line pt-2.5">
                {/* 직무가 들어오는 모든 입구가 같은 입력기를 쓴다 — 계열도 여기서 함께 잡힌다 */}
                <JobTitleField
                  id="interview-job-title"
                  labelText={
                    <>
                      지원 직무 <span className="text-danger">*</span>
                    </>
                  }
                  value={jobTitleDraft}
                  onChange={(v, src) => {
                    setJobTitleDraft(v)
                    setJobSource(src)
                  }}
                  seriesId={jobSeriesId}
                  onSeriesChange={(id) => setJobSeriesId(id)}
                />
                {/* 이 카드 직무가 내 희망 직무와 다르면 맞추자고 제안한다 (탭해야만 반영) */}
                <PromoteJobTitleRow
                  profileTitle={profileJobTitle}
                  jobTitle={jobTitleDraft}
                  seriesId={jobSeriesId}
                />
                <p className="text-warning text-[11px] mt-1.5">
                  <span className="inline-flex items-start gap-1">
                    <Lightbulb
                      size={13}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="shrink-0 mt-px"
                    />
                    <span>
                      직무가 없으면 <strong>직무별 질문이 안 나옵니다.</strong> 카드에도
                      함께 저장됩니다.
                    </span>
                  </span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 2. 면접 정보 */}
        <section>
          <h3 className="text-text-secondary text-xs font-semibold mb-2">
            면접 정보
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                면접 차수 <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  value={roundChoice}
                  onChange={(e) => setRoundChoice(e.target.value)}
                  /* iOS 포커스 줌 방지 — 모바일 노출 select 는 16px 이상 */
                  className="w-full appearance-none bg-input border border-line rounded-lg pl-3 pr-8 py-2 text-base sm:text-sm text-text-primary cursor-pointer focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                >
                  <option value="" disabled>
                    전형 단계를 선택하세요
                  </option>
                  {steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={CUSTOM_ROUND}>직접 입력…</option>
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-quaternary"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {roundChoice === CUSTOM_ROUND && (
                <input
                  type="text"
                  value={customRound}
                  onChange={(e) => setCustomRound(e.target.value)}
                  maxLength={40}
                  placeholder="예: 모의 면접 / 코딩테스트 회고"
                  autoFocus
                  /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 */
                  className="mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2 text-base sm:text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand/45 outline-none"
                />
              )}
              {steps.length === 0 && roundChoice !== CUSTOM_ROUND && (
                <p className="text-text-faint text-[10px] mt-1.5">
                  전형 단계가 없어요. 카드 상세에서 단계를 먼저 추가하거나
                  '직접 입력' 을 사용하세요.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1.5">
                면접 종류
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setInterviewType(
                        interviewType === opt.value ? '' : opt.value,
                      )
                    }
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      interviewType === opt.value
                        ? 'bg-brand/15 border-brand/45 text-brand'
                        : 'bg-surface border-line text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-text-faint text-[10px] mt-1.5">
                PT·토론·코딩테스트는 별도 기능으로 준비 중이에요.
              </p>
            </div>
          </div>
        </section>

        {/* 3. 참고 자료 — 사용자가 가장 자주 손대는 영역이라 위로 */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-text-secondary text-sm font-semibold inline-flex items-center gap-1.5">
              <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" />
              참고 자료
            </h3>
            <span className="text-text-faint text-xs">자소서 기본 전체 선택</span>
          </div>

          {/* coverletters */}
          <div className="mb-3">
            <label className="block text-xs text-text-tertiary mb-1.5">
              관련 자소서 문항{' '}
              <span className="text-text-faint">
                ({selectedClIds.size}개 선택)
              </span>
            </label>
            {clList.length === 0 ? (
              /*
                🔴 **차단이 아니라 권장이다** (질문 은행 D2a). 예전엔 자소서 0건이면 세션
                자체를 못 만들었다 — AI 생성이 유일한 입구였을 때의 규칙이다.
                지금은 **직접 적은 질문을 모으는 것**이 기본 동선이라, 자소서가 없어도
                세션을 만들어 기출을 쌓을 수 있어야 한다. 자소서는 AI 생성의 재료로만 남는다.

                「자소서 등록하러 가기」는 지운 게 아니라 이 안내 안으로 옮겼다 —
                강제는 없애되 길은 남긴다.
              */
              <div className="bg-info/10 border border-info/25 text-text-secondary text-xs rounded-lg p-3">
                <p className="leading-relaxed">
                  자소서는 AI 질문 생성에 필요해요. 직접 질문은 세션을 만든 뒤 바로
                  추가할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={onNeedCoverletter}
                  className="mt-2 min-h-8 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors"
                >
                  자소서 등록하러 가기
                </button>
              </div>
            ) : (
              <div className="max-h-32 overflow-y-auto overscroll-contain space-y-1 border border-line rounded-lg p-2 bg-surface">
                {clList.map((cl) => (
                  <label
                    key={cl.id}
                    className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClIds.has(cl.id)}
                      onChange={() =>
                        setSelectedClIds((s) => toggleId(s, cl.id))
                      }
                      className="accent-brand"
                    />
                    <span className="truncate">
                      {cl.category && (
                        <span className="text-text-faint mr-1">
                          [{cl.category}]
                        </span>
                      )}
                      {cl.question}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* extra logs */}
          <div>
            <label className="block text-xs text-text-tertiary mb-1.5">
              추가 활동 로그{' '}
              <span className="text-text-faint">
                ({selectedLogIds.size}개 선택 · 활동 헤더 체크 = 전체 선택)
              </span>
            </label>
            {actList.length === 0 ? (
              <p className="text-text-faint text-xs">활동이 없어요.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto overscroll-contain space-y-1 border border-line rounded-lg p-2 bg-surface">
                {actList.map((act) => (
                  <ActivityLogPicker
                    key={act.id}
                    activityId={act.id}
                    activityName={act.isInbox ? '📥 미분류 기록' : act.name}
                    selectedLogIds={selectedLogIds}
                    onChangeSelected={setSelectedLogIds}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 4. AI 질문 품질 강화 — 권장 */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-text-secondary text-sm font-semibold inline-flex items-center gap-1.5">
              <Target size={15} strokeWidth={1.75} aria-hidden="true" />
              AI 질문 품질 강화
            </h3>
            <span className="text-text-faint text-xs">권장</span>
          </div>
          <div className="bg-brand/5 border border-brand/15 rounded-lg p-3 mb-3">
            <p className="text-text-secondary text-xs leading-relaxed">
              아래 정보가 있으면 회사 특화 · 본인 의도 기반 질문이 만들어져요.
              없어도 진행 가능하지만 일반론 질문에 그칠 수 있어요.
            </p>
          </div>

          <div className="space-y-3">
            {/*
              v2 (2026-08-06) — 손으로 붙여넣던 "모집 요강" textarea 를 **공고 요건 정리 UI**
              로 교체했다. 카드·자소서에서 이미 정리했으면 그 결과가 여기 그대로 보이고,
              안 했으면 여기서 바로 정리할 수 있다. 같은 정보를 두 번 넣게 하지 않는다.
              (실측: 기존 수동 입력란은 세션 8건 중 0건 사용 — 아무도 두 번 쓰지 않았다)

              `app.jobPosting` 단일 소스라 카드 상세·자소서와 자동으로 같은 내용을 본다.
            */}
            <div>
              <label className="block text-xs text-text-tertiary mb-1.5">
                공고 요건{' '}
                <span className="text-text-faint">
                  (있으면 직무 질문이 정확해져요)
                </span>
              </label>
              <JobPostingBanner
                variant="section"
                applicationId={applicationId}
                jobPosting={app?.jobPosting}
                jobPostingStatus={app?.jobPostingStatus}
                readOnly={false}
                expanded={jpExpanded}
                onToggle={() => setJpExpanded((v) => !v)}
              />
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1.5">
                강조하고 싶은 강점·경험
              </label>
              <textarea
                value={emphasisPoints}
                onChange={(e) => setEmphasisPoints(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="면접관에게 꼭 어필하고 싶은 본인의 강점·경험&#10;예) 팀 갈등을 중재해서 프로젝트 성공시킨 경험을 부각하고 싶어요"
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
              />
              <p className="text-text-faint text-[11px] mt-1 text-right">
                {emphasisPoints.length} / 2000
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-line">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
        >
          취소
        </button>
        <button
          onClick={() => void handleSubmit()}
          // 직무는 직무별 질문의 기준이라 비어 있으면 위 칸에서 고르게 한다.
          // 자소서는 더 이상 조건이 아니다 — 직접 적은 질문만으로도 세션이 성립한다.
          disabled={isPending || !round || !jobReady}
          title={!jobReady ? '지원 직무를 입력해 주세요' : undefined}
          className="px-4 py-1.5 text-xs bg-brand hover:bg-accent text-bg rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? '생성 중…' : '세션 만들기'}
        </button>
      </div>
    </Modal>
  )
}

function ActivityLogPicker({
  activityId,
  activityName,
  selectedLogIds,
  onChangeSelected,
}: {
  activityId: string
  activityName: string
  selectedLogIds: Set<string>
  onChangeSelected: (next: Set<string>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [forceFetch, setForceFetch] = useState(false)
  const { data: logs } = useActivityLogs(
    expanded || forceFetch ? activityId : undefined,
  )
  const checkboxRef = useRef<HTMLInputElement>(null)

  // 쉬어가기(rest) 기록은 면접 소재가 아님
  const allLogs = (logs ?? []).filter((l) => l.cat !== 'rest')
  const selectedInThis = allLogs.filter((l) => selectedLogIds.has(l.id))
  const selectAll =
    allLogs.length > 0 && selectedInThis.length === allLogs.length
  const partial = selectedInThis.length > 0 && !selectAll

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partial
  }, [partial])

  const handleHeaderToggle = () => {
    if (!logs) {
      setForceFetch(true)
      return
    }
    const next = new Set(selectedLogIds)
    if (selectAll) {
      allLogs.forEach((l) => next.delete(l.id))
    } else {
      allLogs.forEach((l) => next.add(l.id))
    }
    onChangeSelected(next)
  }

  useEffect(() => {
    if (forceFetch && logs && logs.length > 0) {
      const next = new Set(selectedLogIds)
      logs.forEach((l) => next.add(l.id))
      onChangeSelected(next)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForceFetch(false)
      setExpanded(true)
    } else if (forceFetch && logs && logs.length === 0) {
      setForceFetch(false)
      setExpanded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceFetch, logs])

  const toggleLog = (logId: string) => {
    const next = new Set(selectedLogIds)
    if (next.has(logId)) next.delete(logId)
    else next.add(logId)
    onChangeSelected(next)
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-1">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={selectAll}
          onChange={handleHeaderToggle}
          className="accent-brand"
          aria-label={`${activityName} 전체 선택`}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between text-xs text-text-secondary hover:text-text-primary text-left min-w-0"
        >
          <span className="truncate">
            <span className="text-text-faint mr-1">{expanded ? '▾' : '▸'}</span>
            {activityName}
          </span>
          {selectedInThis.length > 0 && (
            <span className="text-brand text-[10px] shrink-0 ml-2">
              {selectedInThis.length}
              {allLogs.length > 0 && `/${allLogs.length}`}
            </span>
          )}
        </button>
      </div>
      {expanded && (
        <div className="pl-6 space-y-1 mt-1">
          {allLogs.length === 0 ? (
            <p className="text-text-faint text-[10px]">기록 없음</p>
          ) : (
            allLogs.map((log) => (
              <label
                key={log.id}
                className="flex items-start gap-2 text-[11px] text-text-tertiary hover:text-text-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLogIds.has(log.id)}
                  onChange={() => toggleLog(log.id)}
                  className="accent-brand mt-0.5"
                />
                <span className="line-clamp-2">
                  <span className="text-text-faint mr-1">
                    [{log.occurredAt}]
                  </span>
                  {log.content}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
