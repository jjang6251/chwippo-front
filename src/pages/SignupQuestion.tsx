import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSignupAnswer } from '@/hooks/useSignupAnswer'
import { useAuthStore } from '@/stores/authStore'
import { JobTitleField } from '@/components/card/JobTitleField'
import { JOB_SERIES, classifyJob } from '@/utils/jobRole'
import {
  STEP_TYPE_CONFIG,
  getApplicationTemplate,
  getStepType,
  recommendTemplate,
} from '@/utils/stepTemplates'
import {
  getRewardCompanies,
  getSeriesCompanies,
  getSeriesLabel,
  getSeriesOnboarding,
  hasCompanyReward,
} from '@/utils/seriesOnboarding'
import { toast } from '@/stores/toastStore'
import type { SignupAnswerBody } from '@/api/users'

/**
 * 가입 온보딩 — **계열 1탭 → 즉시 보상 2단** (`plans/job-role-first.md` 묶음 1 · A안).
 *
 * ## 무엇이 바뀌었나
 *
 * 예전엔 **21개 직군 칩**을 5개 그룹 카드에 담아 다중 선택하게 했다. 두 가지가 틀렸다:
 *
 * - **원리적으로 전 직군을 못 덮었다** — 간호사·전기기사·9급 공무원이 전부 「기타」였다
 * - **답한 대가가 없었다** — 고르고 나면 `Sample Corp` 라는 **가상 회사** 카드가 깔렸다.
 *   가입 직후 처음 보는 화면이 가짜 데이터라는 뜻이다
 *
 * 이제 **계열 하나를 누르면 그 자리에서 두 가지가 돌아온다**:
 *
 * ```
 * 1단 (전 계열 공통) — 전형 흐름 + 그 계열 면접 질문 3개   ← 재고 걱정이 없다
 * 2단 (조사 3개 이상) — 조사가 준비된 진짜 회사 칩          ← 고르면 지원 예정 카드
 * ```
 *
 * 🔴 **2단이 가상 샘플을 대체한다.** 담은 회사는 진짜 회사의 진짜 카드(PLANNED)가 되고,
 * 하나도 안 담아도 1단은 그대로 나가므로 빈손으로 끝나지 않는다.
 *
 * ## 직무 타이핑은 **선택**이다
 *
 * 보상 1단은 계열만으로 나간다 — 타이핑이 보상의 조건이 아니다. 적은 사람에겐 그 값이
 * **카드 추가 모달의 프리필**이 되고(`job_title_source = 'prefill'`), 안 적은 사람은 그냥
 * 통과한다. 🔴 **계열 라벨은 직무로 승격하지 않는다** — 시스템이 고른 말을 사람이 쓴 말
 * 자리에 넣으면 예전 「직군 칩 자동 선택」 오염의 재판이 된다 (「사람 말만 볼펜」).
 *
 * 라우트 = /signup/question (AuthGuard 안, onboardedAt null 시 LoginCallback 가 redirect).
 */

/** 계열 pill — `JobTitleField` 의 `SeriesPill` 과 **같은 클래스 문법**. 여기선 그리드 칸을 채운다 */
const PILL_BASE =
  'inline-flex items-center justify-center text-center break-keep leading-tight rounded-full border px-3 lg:px-2.5 min-h-[44px] lg:min-h-[36px] text-sm lg:text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed'
const PILL_ON = 'text-brand bg-brand/15 border-brand/30 font-semibold'
const PILL_OFF =
  'bg-card border-line text-text-secondary hover:bg-card-hover hover:text-text-primary'

export function SignupQuestion() {
  const navigate = useNavigate()
  const signupAnswer = useSignupAnswer()
  const user = useAuthStore((s) => s.user)

  /*
    이미 온보딩을 끝낸 사람이 이 주소로 들어오면(뒤로가기·북마크·주소창) 답을 다시 받지
    않는다 — 서버는 「이미 답변하셨어요」 400 으로 거절하므로, 채우고 누른 뒤에야 실패를
    보게 된다. 화면에 도달하기 전에 홈으로 돌린다.

    🔴 **마운트 시점 값만 본다.** 제출이 성공하면 `useSignupAnswer` 의 낙관 갱신이 그 자리에서
    `onboardedAt` 을 채운다 — 살아 있는 값을 그대로 보면, 이 가드가 `navigate('/signup/tour')`
    보다 먼저 발동해 방금 답한 사람이 투어 대신 캘린더로 튕긴다.
  */
  const [enteredOnboarded] = useState(() => user?.onboardedAt != null)

  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  /*
    계열 그리드는 **계열이 없을 때만** 펼친다(계열 1탭 경로). 타이핑으로든 탭으로든 계열이
    잡히는 순간 그리드는 접히고 판정 칩 한 줄로 바뀐다 — 그래야 보상 카드가 입력 바로 아래,
    모바일 폴드 **안**으로 올라온다 (14개 pill 7줄 밑에 두면 타이핑하고 스크롤해야 보상을 본다).
    「바꾸기」가 다시 펼친다.
  */
  const [gridForced, setGridForced] = useState(false)

  // 훅을 전부 부른 뒤에 나간다 (조기 반환이 훅보다 위에 있으면 순서가 깨진다)
  if (enteredOnboarded) return <Navigate to="/calendar" replace />

  const disabled = signupAnswer.isPending

  const seriesLabel = getSeriesLabel(seriesId)
  const content = getSeriesOnboarding(seriesId)

  /*
    회사 추천은 **세밀 그룹 → 계열** 순 (A안). 직무가 확신 판정이고 그 직무의 계열이
    지금 고른 계열과 같을 때만 세밀 목록을 쓴다 — 직무는 「승무원」인데 pill 을 IT 로
    바꿨으면 IT 계열 목록이 맞다. 세밀 목록이 비어 있으면 2단 자체가 안 나간다.
  */
  const trimmedTitle = jobTitle.trim()
  const verdict = trimmedTitle ? classifyJob(trimmedTitle) : null
  const fineId =
    verdict?.status === 'confident' && verdict.series.id === seriesId ? verdict.fine.id : null
  const companies = getRewardCompanies(seriesId, fineId)
  const showCompanies = hasCompanyReward(seriesId, fineId)
  const usingFineList = fineId !== null && companies !== getSeriesCompanies(seriesId)
  // 목록이 바뀌어도(계열 변경·직무 수정) 화면에 없는 회사는 담긴 것으로 치지 않는다
  const visiblePicked = companies.filter((c) => picked.indexOf(c) !== -1)

  /*
    전형 미리보기는 **직무까지 반영**한다 — 「승무원」을 치면 항공 서비스 스텝이 나와야
    「내 얘기구나」가 된다. 계열만 보면 영업·판매 4단계라 승무원에게는 남의 전형이다.
  */
  const templateId = recommendTemplate({ seriesId, jobTitle })
  const steps = getApplicationTemplate(templateId).steps

  /**
   * 계열을 바꾸면 담아둔 회사를 비운다 — 회사 목록이 계열에서 파생되므로,
   * 안 비우면 **화면에 없는 회사**가 제출 body 에 실려 나간다.
   * (직무 타이핑은 유지한다 — 사람이 적은 말이라 계열 변경으로 지울 이유가 없다.)
   */
  function chooseSeries(next: string) {
    setGridForced(false)
    if (next === seriesId) return
    setSeriesId(next)
    setPicked([])
  }

  const gridOpen = !seriesId || gridForced

  function toggleCompany(name: string) {
    setPicked((prev) =>
      prev.indexOf(name) === -1 ? [...prev, name] : prev.filter((c) => c !== name),
    )
  }

  function handleStart() {
    if (!seriesId) return
    const trimmed = jobTitle.trim()
    const body: SignupAnswerBody = {
      // 🔴 새 경로도 빈 배열을 보낸다 — 서버가 이 컬럼의 NULL 여부로 「이미 답변했나」를
      //    판정한다. 빼면 온보딩이 로그인할 때마다 다시 뜬다.
      jobCategories: [],
      seriesId,
    }
    if (trimmed) body.jobTitle = trimmed
    // 표시 순서 그대로 — 누른 순서가 아니라 화면에서 본 순서로 카드가 생긴다
    const orderedPicks = companies.filter((c) => picked.indexOf(c) !== -1)
    if (orderedPicks.length > 0) {
      body.pickedCompanies = orderedPicks
      /*
        🔴 **미리보기에 쓴 바로 그 값**을 보낸다. 서버는 직무 사전이 없어 계열까지만 알아서,
        안 보내면 「승무원」을 친 사람이 방금 본 항공 서비스 전형 대신 영업·판매 전형이
        담긴 카드를 받는다 — 보상이 곧바로 거짓말이 된다.
      */
      body.templateId = templateId
    }

    signupAnswer.mutate(body, {
      onSuccess: () => {
        toast.success(
          orderedPicks.length > 0
            ? `환영해요! 지원 예정 카드 ${orderedPicks.length}장을 담아뒀어요`
            : '환영해요! 준비됐어요',
        )
        /*
          🔴 캘린더가 아니라 **투어**로 간다 (`plans/app-tour.md`). 여기서 곧장 캘린더로
          보내면 가입 직후 첫 화면이 「빈 캘린더」다 — 방금 담은 카드로 무엇을 할 수 있는지
          아무도 말해주지 않는다. 투어가 끝나면 그 카드(또는 보드)로 이어진다.
          토스트는 그대로 둔다 — 투어 위에 떠도 무해하고, 「담겼다」는 확인은 즉시가 낫다.
        */
        navigate('/signup/tour', { replace: true })
      },
      onError: () => toast.error('저장에 실패했어요. 다시 시도해주세요.'),
    })
  }

  function handleSkip() {
    signupAnswer.mutate(
      { jobCategories: [] },
      {
        // 건너뛴 사람에게도 투어는 나간다 — 무대는 계열 대표 회사 미리보기가 맡는다
        onSuccess: () => navigate('/signup/tour', { replace: true }),
        onError: () => toast.error('저장에 실패했어요. 다시 시도해주세요.'),
      },
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background: `
          radial-gradient(ellipse 800px 600px at 50% -200px, rgba(var(--brand), 0.08), transparent 60%),
          rgb(var(--bg))
        `,
      }}
    >
      <div className="w-full max-w-[560px] text-center">
        {/* Hero illustration */}
        {/* 모바일에선 64px — 상단 380px 을 장식이 먹으면 보상 카드가 폴드 밖으로 밀린다 */}
        <svg viewBox="0 0 200 200" className="w-16 h-16 mb-3 lg:w-[144px] lg:h-[144px] lg:mb-6 mx-auto" fill="none" aria-hidden="true">
          <circle cx="100" cy="60" r="22" fill="rgb(var(--brand))" opacity="0.85" />
          <rect x="78" y="86" width="44" height="58" rx="6" fill="rgb(var(--brand))" opacity="0.85" />
          <rect
            x="55"
            y="110"
            width="36"
            height="48"
            rx="4"
            fill="rgb(var(--accent))"
            opacity="0.6"
            transform="rotate(-8 73 134)"
          />
          <rect
            x="110"
            y="105"
            width="36"
            height="48"
            rx="4"
            fill="rgb(var(--surface-3))"
            stroke="rgb(var(--brand))"
            strokeWidth="1.5"
            transform="rotate(6 128 129)"
          />
          <circle cx="40" cy="40" r="3" fill="rgb(var(--accent))" opacity="0.6" />
          <circle cx="170" cy="50" r="2.5" fill="rgb(var(--brand))" opacity="0.6" />
          <circle cx="160" cy="160" r="3" fill="rgb(var(--accent))" opacity="0.6" />
          <circle cx="30" cy="170" r="2" fill="rgb(var(--brand))" opacity="0.6" />
        </svg>

        <div className="text-[11px] text-brand font-medium tracking-[0.08em] uppercase mb-3">
          한 가지만 알려주세요
        </div>
        {/* break-keep — 320px 에서 「…준비하고 계 / 세요?」로 단어 중간이 잘리는 걸 막는다 */}
        <h1 className="text-[28px] sm:text-[32px] font-bold text-text-primary mb-3 font-display tracking-tight break-keep">
          어떤 일을 준비하고 계세요?
        </h1>
        {/* break-keep — 없으면 390px 에서 「…보여드려 / 요.」로 잘려 마지막 줄에 「요.」만 남는다 */}
        <p className="text-sm text-text-secondary mb-5 lg:mb-6 leading-relaxed break-keep">
          직무를 적으면 계열을 자동으로 골라드리고, 전형 흐름과 면접 질문을 바로 보여드려요.
          {/* 둘째 줄은 데스크탑만 — 모바일은 폴드가 비싸고 하단 안내가 같은 말을 한다 */}
          <span className="hidden lg:inline">
            <br />
            나중에 언제든 바꿀 수 있어요.
          </span>
        </p>

        {/*
          직무 칸이 계열 그리드보다 **위**에 있다 — 타이핑하는 순간 아래 pill 이 저절로 켜지는
          걸 눈으로 보게 하려는 배치다(「오~」는 자동 선택이 **보일 때** 난다). 적으면 카드
          프리필 재료가 되고, 안 적고 pill 만 눌러도 그냥 통과한다.
        */}
        <div className="text-left">
          <JobTitleField
            variant="underline"
            /* 계열 그리드가 바로 아래 있다 — 판정 행까지 두면 같은 정보가 두 군데다 */
            hideSeriesRow
            labelText="직무 (선택)"
            placeholder="예: 간호사, 백엔드 개발자, 9급 공무원"
            value={jobTitle}
            onChange={(v) => setJobTitle(v)}
            seriesId={seriesId}
            /*
              🔴 **null 은 무시한다.** 사전이 못 잡는 말을 치는 순간 이미 고른 계열이
              풀리면 보상 카드가 통째로 사라진다 — 사용자는 지운 적이 없는데.
            */
            onSeriesChange={(id) => {
              if (id) chooseSeries(id)
            }}
          />
        </div>

        {/*
          🔴 예전 「1개 이상 선택해주세요」 카운터 pill 을 뺐다. 단일 선택이라 셀 것이 없고,
          고르기 **전에** 잔소리를 하는 자리라 첫인상이 지시로 시작했다.
        */}
        {gridOpen ? (
          <>
            <p className="mt-5 mb-2 text-left text-[11px] text-text-tertiary">
              계열 — 직접 골라도 돼요
            </p>
            <div
              role="radiogroup"
              aria-label="준비 중인 계열"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
            >
              {JOB_SERIES.map((s) => {
                const active = s.id === seriesId
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => chooseSeries(s.id)}
                    className={`${PILL_BASE} ${active ? PILL_ON : PILL_OFF}`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          /* 판정 칩 한 줄 — 그리드 14개가 있던 자리를 36px 로 접는다 */
          <div
            className="mt-5 flex items-center gap-2 text-left"
            role="status"
            aria-live="polite"
          >
            <span className="text-[11px] text-text-tertiary shrink-0">계열</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[44px] lg:min-h-[32px] text-sm lg:text-[13px] ${PILL_ON}`}
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="2 6.5 4.8 9.2 10 3.5" />
              </svg>
              {seriesLabel}
            </span>
            <button
              type="button"
              onClick={() => setGridForced(true)}
              disabled={disabled}
              className="text-xs text-text-tertiary underline underline-offset-2 hover:text-text-primary min-h-[44px] lg:min-h-[32px] px-2 lg:px-1 rounded transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              바꾸기
            </button>
          </div>
        )}

        {/*
          보상 카드 — 🔴 **고르기 전엔 DOM 에 없다.** 빈 껍데기를 미리 깔아두면 화면이
          「아직 아무것도 없음」을 큰 면적으로 말하게 된다 (빈 패널은 없애는 게 디자인).
        */}
        {seriesId && content && (
          <div
            key={seriesId}
            className="mt-4 bg-surface-2 border border-line rounded-2xl p-4 lg:p-5 text-left animate-fadeInUp motion-reduce:animate-none"
          >
            {/* ① 전형 흐름 — 전 계열 공통 */}
            <p
              className="text-sm font-semibold text-text-primary"
              aria-live="polite"
            >
              {seriesLabel} 준비 중이시군요
            </p>
            <p className="text-xs text-text-tertiary mt-0.5">전형은 보통 이렇게 흘러가요</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              {steps.map((step, i) => (
                <span key={step} className="contents">
                  {i > 0 && (
                    <span className="text-text-quaternary text-[11px]" aria-hidden="true">
                      →
                    </span>
                  )}
                  {/* 보드 스텝과 같은 유형색(서류·시험·면접·결과) — 색이 곧 정보고, 보드에서 다시 만난다 */}
                  <span
                    className={`font-mono text-[11px] rounded-full px-2 py-0.5 border ${STEP_TYPE_CONFIG[getStepType(step)].bgCls} ${STEP_TYPE_CONFIG[getStepType(step)].borderCls} ${STEP_TYPE_CONFIG[getStepType(step)].colorCls}`}
                  >
                    {step}
                  </span>
                </span>
              ))}
            </div>

            {/* ② 면접 질문 3개 — 「앱이 작동하는구나」의 두 번째 증거 */}
            <p className="text-xs text-text-tertiary mt-4">면접에선 이런 질문이 나와요</p>
            <ul className="mt-1.5 space-y-1.5">
              {content.questions.map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="font-mono text-brand text-[11px] mt-[3px] shrink-0" aria-hidden="true">
                    Q
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed">{q}</span>
                </li>
              ))}
            </ul>

            {/* ③ 2단 — 조사가 3개 이상 준비된 계열만. 없으면 이 블록 자체가 없다 */}
            {showCompanies && (
              <div className="border-t border-line mt-4 pt-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {/*
                    🔴 위 두 캡션(「전형은 보통…」·「면접에선…」)과 달리 **14px** 이다
                    (DESIGN.md 7-b). 저건 40자 미만 라벨이지만 이건 40자를 넘는 문장이라
                    읽는 글에 해당한다 — 판정은 위치가 아니라 「이게 뭔가」로 한다.
                  */}
                  <p className="text-sm text-text-tertiary break-keep">
                    {usingFineList
                      ? `${trimmedTitle} 준비하는 분들이 많이 보는 회사예요 — 골라두면 지원 예정 카드로 담아드려요`
                      : '이 회사들은 조사가 준비돼 있어요 — 골라두면 지원 예정 카드로 담아드려요'}
                  </p>
                  {visiblePicked.length > 0 && (
                    <span
                      className="font-mono text-[11px] text-brand ml-auto shrink-0"
                      aria-live="polite"
                    >
                      {visiblePicked.length}곳 담김
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {companies.map((name) => {
                    const on = picked.indexOf(name) !== -1
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={on}
                        disabled={disabled}
                        onClick={() => toggleCompany(name)}
                        /*
                          담기 칩은 **행동**이다 — 바로 위 스텝 pill(정보·색)과 같은 생김새면 라벨로
                          읽힌다. 카드 추가 모달의 「+ 마감일」 점선 칩 문법을 그대로 가져와
                          「누르면 추가된다」를 이미 배운 모양으로 말한다. hover 에 brand 가 비친다.
                        */
                        className={`inline-flex items-center gap-1 min-h-[44px] lg:min-h-[32px] px-3 rounded-full border text-sm lg:text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          on
                            ? PILL_ON
                            : 'border-dashed border-line-strong text-text-secondary hover:border-brand/50 hover:bg-brand/8 hover:text-brand'
                        }`}
                      >
                        {on ? (
                          <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="2 6.5 4.8 9.2 10 3.5" />
                          </svg>
                        ) : (
                          /* 색을 따로 주지 않는다 — hover 때 라벨과 같이 brand 로 넘어가야 한 덩어리로 읽힌다 */
                          <span aria-hidden="true">+</span>
                        )}
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/*
          Actions — 🔴 **모바일은 하단 고정**이다 (2026-08-29 실측).
          회사 6곳이 보이는 상태에서 CTA 가 `bottom 932px`(폴드 844)라 **처음부터 화면 밖**이었다.
          담기 칩이 44px 로 커지며 +32px 더 밀렸고, 여백을 깎아 되돌리려면 120px 을 걷어내야 해서
          그건 페이지를 다시 짜는 일이다. 「N장 담고 시작하기」는 **담는 동안 계속 보여야 하는
          버튼**(몇 장 담았는지가 라벨에 있다)이라, 자리를 옮기는 대신 **따라오게** 만든다.

          ⚠️ `sticky` 는 스크롤 컨테이너가 **문서**여야 산다 — 이 페이지 조상에 `overflow` 가
          하나도 없어서 동작한다. 나중에 누가 래퍼에 `overflow-hidden` 을 걸면 조용히 죽는다.
          데스크탑은 `lg:static` 으로 시각 무변경(원래도 한 화면에 들어온다).
        */}
        <div className="sticky bottom-0 mt-7 -mx-6 px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur border-t border-line lg:static lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0 lg:bg-transparent lg:border-0 lg:backdrop-blur-0">
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={disabled}
            className="bg-transparent text-text-tertiary px-4 py-3 text-[13px] font-medium rounded-lg hover:text-text-primary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={disabled || !seriesId}
            /*
              🔴 비활성 스타일이 형제 버튼들과 다르다 (`disabled:opacity-40` 을 뺐다).
              다른 화면의 CTA 는 「채우고 나서」 비활성이 풀리는 자리라 흐릿해도 되지만,
              이 버튼은 **첫 화면의 기본 상태가 비활성**이다. `bg-surface-3`(#363330) 위에
              `text-bg`(#1a1816) 를 opacity-40 으로 깔면 다크에서 글자가 사실상 안 읽혀,
              가입 직후 처음 보는 화면의 주 CTA 가 무슨 버튼인지 모르는 상태가 된다.
              면(surface-3)은 그대로 두고 글자만 4단 텍스트 토큰으로 올려 대비를 되찾는다.
              (브리프 지시 — 같은 조합을 쓰는 형제 화면은 건드리지 않는다.)
            */
            className="
              bg-brand hover:bg-accent text-bg px-7 py-3
              rounded-lg text-sm font-semibold
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg
              disabled:bg-surface-3 disabled:text-text-quaternary disabled:cursor-not-allowed
              transition-colors
            "
          >
            {disabled
              ? '저장 중…'
              : visiblePicked.length > 0
                ? `카드 ${visiblePicked.length}장 담고 시작하기`
                : '시작하기'}
          </button>
        </div>

        {/*
          🔴 「설정에서」는 거짓이었다 — 바꿀 자리가 설정에 없었다.
          정식 자리는 **내 정보 › 기본 인적사항**이고 설정엔 그리로 가는 길잡이 한 줄만 있다
          (`plans/job-role-first.md` 묶음 3). 안내 문구는 도착지를 가리켜야 한다.
          고정 바 **안**에 있다 — 버튼만 따라오고 이 줄이 위에 남으면 바 위로 글자가 비쳐 지나간다.
        */}
        <div className="mt-3 lg:mt-6 text-[11px] text-text-quaternary">
          언제든 내 정보에서 바꿀 수 있어요
        </div>
        </div>
      </div>
    </div>
  )
}
