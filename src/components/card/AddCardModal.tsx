import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { CompanyAutocomplete } from '@/components/board/CompanyAutocomplete'
import { JobTitleField } from '@/components/card/JobTitleField'
import { PromoteJobTitleRow } from '@/components/card/PromoteJobTitleRow'
import { useCreateApplication } from '@/hooks/useApplications'
import { useAuthStore } from '@/stores/authStore'
import {
  APPLICATION_TEMPLATES,
  getApplicationTemplate,
  recommendTemplate,
} from '@/utils/stepTemplates'
import { JOB_SERIES, classifyJob } from '@/utils/jobRole'
import { formatMonthDay, todayLocal } from '@/utils/datetime'
import { postToNative } from '@/utils/nativeBridge'
import { toast } from '@/stores/toastStore'
import { useQueryClient } from '@tanstack/react-query'
import { showFirstCardCelebration } from '@/stores/celebrationStore'
import { revealCardResearch } from '@/stores/researchRevealStore'
import { prefetchCompanyResearchNoHit } from '@/hooks/useCoverletterDoc'
import { shouldCelebrateFirstCard } from '@/utils/firstCardCelebration'
import type { Application, JobTitleSource } from '@/types/application'

interface AddCardModalProps {
  open: boolean
  onClose: () => void
  defaultStatus?: 'PLANNED' | 'IN_PROGRESS'
}

/**
 * 카드 추가 — **직무 기준** 폼 (`plans/job-role-first.md` 묶음 2).
 *
 * ## 무엇이 바뀌었나
 *
 * 예전엔 21개 **직군 칩**을 스크롤해서 골랐고, signup 답변이 있으면 첫 칩이 **자동 선택**됐다.
 * 🔴 그 자동 선택이 데이터를 오염시켰다 — 사용자가 의도한 값이 아닌데 채워진 필드가
 * 「직군 채움률」로 집계됐고, 그 수치를 근거로 쓰면 판단이 통째로 틀어진다.
 *
 * 이제 **사용자가 적은 직무 원문이 1급 정보**고 계열은 거기서 파생한다 (`JobTitleField`).
 * 파생에 실패하면 계열을 **비운 채로** 저장한다 — 「기타」로 뭉치거나 빌려온 값을 채우지 않는다.
 *
 * ## 칸 구성 — 열자마자 보이는 입력은 **2개뿐** (2026-08-28 A안)
 *
 * ```
 * 회사      ← 밑줄
 * 직무      ← 밑줄
 * [+ 마감일] [+ 공고 링크] [전형: 일반 대기업 ⌄]   ← 누르면 그 아래로 펼쳐진다
 * ```
 *
 * 예전엔 「라벨 + 채움 박스」가 **5쌍** 세로로 쌓여 있었다. 다섯 칸이 전부 같은 무게라
 * 어디부터 채워야 하는지가 안 보였고, 상자 더미로 읽혔다 (CEO 실기: 「똬·똬 쌓여 투박하다」).
 *
 * 그래서 **필수(회사)와 AI 기준값(직무)만 세우고** 마감일·공고 링크·전형은 칩으로 접었다.
 * 🔴 접힌 값들은 **안 눌러도 카드가 만들어진다** — 전부 선택 항목이고, 전형은 계열 추천이
 * 이미 들어가 있다. 칩 라벨이 현재 값을 그대로 보여주므로 펼치지 않아도 무엇이 들어갈지 보인다.
 *
 * - `IN_PROGRESS` — 회사 · 직무 (+ 칩 3개: 마감일 · 공고 URL · 전형 템플릿)
 * - `PLANNED` — **회사 하나뿐이다.** 지원 예정은 「일단 적어두기」 용도라 나머지를 물으면
 *   적어두는 행위 자체가 무거워진다. 나머지는 지원을 시작할 때(`StartApplicationModal`) 받는다.
 */

/** 밑줄 칸 위에 얹는 캡션 라벨 — 「라벨 + 박스」 한 쌍이 아니라 글자 한 줄 */
const CAPTION_LABEL =
  'block text-[11px] font-semibold text-text-quaternary tracking-wide mb-0.5'
/** 펼친 부가 항목의 입력 — 주인공(밑줄 2칸)보다 한 단계 조용한 면 */
const SUB_INPUT =
  'w-full bg-card border border-line rounded-lg px-3 py-2.5 text-base lg:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all'

const PANEL_DEADLINE = 'add-card-panel-deadline'
const PANEL_URL = 'add-card-panel-url'
const PANEL_TEMPLATE = 'add-card-panel-template'
export function AddCardModal({
  open,
  onClose,
  defaultStatus = 'IN_PROGRESS',
}: AddCardModalProps) {
  /*
    `user` 를 쓰는 곳은 **두 군데뿐**이다 — 첫 카드 축하 판정과 아래 직무 프리필.
    🔴 signup **직군 칩**(`signupJobCategories`)으로는 여전히 아무것도 채우지 않는다:
    그건 사용자가 목록에서 고른 시스템 어휘라, 자소서·면접 AI 의 기준이 되는 직무 칸에
    올리면 예전 「칩 자동 선택」 오염이 그대로 재현된다.
  */
  const user = useAuthStore((s) => s.user)

  /**
   * 온보딩에서 **사람이 타이핑한** 직무를 새 카드에 미리 채운다.
   *
   * 값의 출처가 본인 타이핑이고 **폼의 주인공 자리에 그대로 보인다**는 점이 옛 칩 프리셋과
   * 다르다 — 틀렸으면 눈앞에서 지우면 되고, 안 건드리고 저장하면 그 사실이
   * `jobTitleSource='prefill'` 로 남아 통계에서 「확정」과 갈린다.
   *
   * 🔴 **계열만 고른 사용자는 프리필이 없다** (`signupJobTitle` 이 NULL). 시스템이 고른
   * 라벨을 사람이 쓴 말 자리에 넣지 않는다.
   */
  const prefillTitle = user?.signupJobTitle?.trim() ?? ''
  /*
    🔴 계열 초기값은 **프리필 직무에서 추론한 값만** 쓴다. `user.signupSeriesId` 를 빌려
    seed 해도 `JobTitleField` 가 마운트 직후 자기 판정(`confident` 아니면 null)으로 덮어써서
    한 프레임짜리 죽은 값이 되고, 저장까지 갔다면 그건 **빌려온 값의 저장 승격**이라
    애초에 금지된 경로다 (계열 결정 체인 ②는 표시·추천 전용).
  */
  const prefillVerdict = prefillTitle ? classifyJob(prefillTitle) : null
  const prefillSeries =
    prefillVerdict?.status === 'confident' ? prefillVerdict.series.id : null

  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState(prefillTitle)
  const [jobTitleSource, setJobTitleSource] = useState<JobTitleSource>(
    prefillTitle ? 'prefill' : 'typed',
  )
  const [seriesId, setSeriesId] = useState<string | null>(prefillSeries)
  const [deadline, setDeadline] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [templateId, setTemplateId] = useState('general')
  const [templateTouched, setTemplateTouched] = useState(false)
  // 접힌 부가 항목 — 값은 위 state 에 그대로 남고, 여기선 **펼침 여부만** 다룬다
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const { mutate: create, isPending } = useCreateApplication()
  const qc = useQueryClient()

  const isPlanned = defaultStatus === 'PLANNED'

  // 사용자가 직접 고르기 전까지는 계열·직무·회사명 기반 추천을 따라감
  const effectiveTemplateId = templateTouched
    ? templateId
    : recommendTemplate({ seriesId, jobTitle, companyName })
  const template = getApplicationTemplate(effectiveTemplateId)
  const templatePreview = template.steps.join(' → ')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return

    const trimmedTitle = jobTitle.trim()
    // 🔴 계열은 **확정됐을 때만** 보낸다. 빌려온 추정값은 저장으로 승격시키지 않는다.
    const seriesLabel = seriesId
      ? JOB_SERIES.find((s) => s.id === seriesId)?.label
      : undefined

    create(
      {
        companyName: companyName.trim(),
        /*
          🔴 지원 예정은 **회사 한 칸만** 묻는 화면이다 — 직무 칸이 렌더되지 않으므로
          프리필 값이 남아 있어도 보내지 않는다. 화면에 없는 값을 몰래 저장하면
          「내가 적지도 않은 직무가 카드에 박혀 있다」가 된다.
        */
        jobTitle: isPlanned ? undefined : trimmedTitle || undefined,
        // 관측 전용 — 직무가 있을 때만. 「직접 침」·「추천 수용」·「프리필 묵인」을 가른다
        jobTitleSource: !isPlanned && trimmedTitle ? jobTitleSource : undefined,
        jobCategory: isPlanned ? undefined : seriesLabel,
        status: defaultStatus,
        deadline: deadline || undefined,
        jobUrl: jobUrl.trim() || undefined,
        needsDetail: !isPlanned && !trimmedTitle,
        templateId: !isPlanned ? effectiveTemplateId : undefined,
        // 관측 전용 — 이 모달이 현재 유일한 사용자 생성 경로다. 카드 추가를 재설계해
        // 진입점이 갈리면 그때 경로마다 다른 값을 보내야 신·구 비교가 성립한다.
        createdVia: 'add_modal',
      },
      {
        onSuccess: (data) => {
          toast.success(`${companyName} 카드가 추가됐어요.`)
          // ⑦ 마감일 포함 카드 생성 = 가치 순간 → native soft-ask 트리거 (WebView 밖 no-op)
          if (deadline) postToNative({ type: 'deadline-saved' })
          // 회사 조사를 미리 받아둔다 — 펼침·축하 어느 쪽이든 뜰 때 이미 와 있게.
          // 조사 없으면(대부분) 아무 일도 안 일어난다.
          prefetchCompanyResearchNoHit(qc, data.id)
          // A5 — 첫 실 카드면 보상 연출 (계정당 1회 · 투어 중 생략은 판정 함수가 처리)
          if (
            shouldCelebrateFirstCard({
              userId: user?.id,
              existingApplications: qc.getQueryData<Application[]>(['applications']),
              createdId: data.id,
            })
          ) {
            showFirstCardCelebration({
              appId: data.id,
              companyName: companyName.trim(),
              hadTemplate: !isPlanned,
              deadline: !isPlanned && deadline ? deadline : null,
              planned: isPlanned,
            })
          } else {
            // 🔴 축하 오버레이와 **배타적**이다. 첫 카드는 조사 3요소가 오버레이 안에
            // 이미 들어가므로, 닫자마자 카드에서 같은 걸 또 보여주면 연출이 두 번이 된다.
            revealCardResearch(data.id)
          }
          handleClose()
        },
        onError: () => toast.error('카드 추가에 실패했습니다.'),
      },
    )
  }

  const handleClose = () => {
    setCompanyName('')
    // 프리필은 **닫아도 살아 있다** — 다음에 열었을 때 없으면 "아까는 있었는데" 가 된다
    setJobTitle(prefillTitle)
    setJobTitleSource(prefillTitle ? 'prefill' : 'typed')
    setSeriesId(prefillSeries)
    setDeadline('')
    setJobUrl('')
    setTemplateId('general')
    setTemplateTouched(false)
    setDeadlineOpen(false)
    setUrlOpen(false)
    setTemplateOpen(false)
    onClose()
  }

  const hasDeadline = deadline.length === 10
  // U20 — 과거 서류 마감일 경고 (지난 공고 기록 허용 → 저장 차단 아님)
  const isPastDeadline = hasDeadline && deadline < todayLocal()
  const hasJobUrl = jobUrl.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isPlanned ? '지원 예정 추가' : '지원 중으로 추가'}
      width="max-w-lg"
    >
      <form onSubmit={handleSubmit}>
        {/* ① 회사 — 이 모달의 유일한 필수값이라 제일 위·제일 크게 */}
        <div>
          {/*
            🔴 `<label>` 이 아니라 `<span>` 이다. `CompanyAutocomplete` 는 input id 를 스스로
            만들어(`useId`) 밖에서 `htmlFor` 를 걸 수 없다 — 여기 `<label>` 을 두면 어디에도
            안 붙은 라벨이 되고, 컴포넌트를 감싸면 드롭다운 클릭까지 label 활성화로 새어
            입력에 포커스가 되돌아가 목록이 다시 열린다.
          */}
          <span className={CAPTION_LABEL}>회사</span>
          <CompanyAutocomplete
            variant="underline"
            value={companyName}
            onChange={setCompanyName}
            placeholder="어느 회사에 지원하세요?"
            autoFocus={open}
            disabled={isPending}
          />
          {isPlanned && (
            <p className="text-text-faint text-[11px] mt-2">
              일단 적어두세요 — 직무·마감일은{' '}
              <span className="text-text-tertiary">지원을 시작할 때</span> 물어볼게요.
            </p>
          )}
        </div>

        {!isPlanned && (
          <>
            {/* ② 직무 — 저장되는 값이자 자소서·면접 AI 의 기준 */}
            <div className="mt-6">
              <JobTitleField
                variant="underline"
                value={jobTitle}
                onChange={(v, source) => {
                  setJobTitle(v)
                  setJobTitleSource(source)
                }}
                seriesId={seriesId}
                onSeriesChange={(id) => setSeriesId(id)}
              />
              {/*
                이 카드 직무가 내 희망 직무와 다르면 맞추자고 제안한다.
                프로필만 바꾸고 카드 저장에는 손대지 않는다 (탭해야만 반영).
              */}
              <PromoteJobTitleRow
                profileTitle={user?.signupJobTitle ?? null}
                jobTitle={jobTitle}
                seriesId={seriesId}
              />
            </div>

            {/*
              ③ 부가 3항목 — 점선 칩으로 접어 둔다.
              칩 라벨이 **현재 값을 그대로** 말해 주므로 펼치지 않아도 무엇이 저장될지 보인다.
            */}
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <RevealChip
                label={hasDeadline ? `마감 ${formatMonthDay(deadline)}` : '+ 마감일'}
                expanded={deadlineOpen}
                filled={hasDeadline}
                controls={PANEL_DEADLINE}
                onClick={() => setDeadlineOpen((v) => !v)}
              />
              <RevealChip
                label={hasJobUrl ? '공고 링크 ✓' : '+ 공고 링크'}
                expanded={urlOpen}
                filled={hasJobUrl}
                controls={PANEL_URL}
                onClick={() => setUrlOpen((v) => !v)}
              />
              {/*
                전형은 **언제나 값이 있다**(계열 추천). 그래서 「채워짐」은 값 유무가 아니라
                사용자가 직접 골랐는지(`templateTouched`)로 본다 — 추천값까지 solid 로 그리면
                점선 3개가 처음부터 2개만 점선이라 접힘 규칙이 흐트러진다.
              */}
              <RevealChip
                label={`전형: ${template.label} ⌄`}
                expanded={templateOpen}
                filled={templateTouched}
                controls={PANEL_TEMPLATE}
                onClick={() => setTemplateOpen((v) => !v)}
              />
            </div>

            {deadlineOpen && (
              <div id={PANEL_DEADLINE} className="mt-3">
                <label htmlFor="add-card-deadline" className={CAPTION_LABEL}>
                  서류 마감일
                </label>
                <input
                  id="add-card-deadline"
                  type="date"
                  /* 칩을 눌러 연 칸이다 — 한 번 더 탭하게 하지 않는다 */
                  autoFocus
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  aria-describedby={isPastDeadline ? 'deadline-warning' : undefined}
                  className={SUB_INPUT}
                />
                {isPastDeadline && (
                  <p id="deadline-warning" role="alert" className="mt-1 text-[11px] text-warning">
                    지난 마감일이에요. 지난 공고도 기록할 수 있어요.
                  </p>
                )}
              </div>
            )}

            {urlOpen && (
              <div id={PANEL_URL} className="mt-3">
                <label htmlFor="add-card-job-url" className={CAPTION_LABEL}>
                  공고 링크
                </label>
                {/*
                  🔴 URL 은 **사용자가 붙여넣는 값**일 뿐이다. 이 주소를 자동으로 열거나 긁지 않는다
                  (공고 URL 자동 수집 영구 금지 — 잡코리아 v 사람인 판례). 나중에 「공고 보기 ↗」
                  링크로 돌려주는 게 전부다.
                */}
                <input
                  id="add-card-job-url"
                  type="url"
                  inputMode="url"
                  autoFocus
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  maxLength={500}
                  placeholder="https://…"
                  className={SUB_INPUT}
                />
              </div>
            )}

            {templateOpen && (
              <div id={PANEL_TEMPLATE} className="mt-3">
                <label htmlFor="add-card-template" className={CAPTION_LABEL}>
                  전형 단계{' '}
                  <span className="font-normal text-text-faint">(만든 뒤 자유 편집)</span>
                </label>
                <div className="relative">
                  <select
                    id="add-card-template"
                    value={effectiveTemplateId}
                    onChange={(e) => {
                      setTemplateTouched(true)
                      setTemplateId(e.target.value)
                    }}
                    className="w-full appearance-none bg-card border border-line rounded-lg pl-3 pr-9 py-2.5 text-base lg:text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
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
                <p className="mt-1.5 text-[11px] text-text-quaternary leading-relaxed">
                  {templatePreview}
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 pt-6">
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
            className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40"
          >
            {isPending ? '추가 중...' : '추가하기'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface RevealChipProps {
  /** 현재 값을 그대로 보여준다 — 「+ 마감일」 → 「마감 9/12」 */
  label: string
  expanded: boolean
  /** 값이 들어와 있나 — **접어도** 채워졌다는 표시는 남아야 한다 */
  filled: boolean
  /** 펼침 패널의 id (`aria-controls`) */
  controls: string
  onClick: () => void
}

/**
 * 접힌 부가 항목의 손잡이. 점선 = 「비어 있고, 눌러서 채우는 자리」 (샘플 카드·`StepDateField`
 * 와 같은 문법). 값이 들어오거나 펼쳐지면 실선 + 면을 얹어 **여기 뭔가 있다**를 남긴다.
 *
 * 터치 44px 은 **모바일에서만** — 데스크탑까지 44 로 두면 칩이 밑줄 칸보다 커져
 * 부가 항목이 주인공을 압도한다 (`SeriesPill` 과 같은 판단).
 */
function RevealChip({ label, expanded, filled, controls, onClick }: RevealChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`inline-flex items-center gap-1 rounded-full border border-line-strong px-3 min-h-[44px] lg:min-h-[30px] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
        expanded || filled
          ? 'border-solid bg-card text-text-primary'
          : 'border-dashed text-text-tertiary hover:bg-card hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
