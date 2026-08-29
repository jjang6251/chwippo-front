import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Pause } from 'lucide-react'
import { Scene1 } from '@/components/tour/scenes/Scene1'
import { Scene2 } from '@/components/tour/scenes/Scene2'
import { Scene3 } from '@/components/tour/scenes/Scene3'
import { Scene4 } from '@/components/tour/scenes/Scene4'
import { Scene5 } from '@/components/tour/scenes/Scene5'
import { Scene6 } from '@/components/tour/scenes/Scene6'
import { Scene7 } from '@/components/tour/scenes/Scene7'
import { cue } from '@/components/tour/choreo'
import {
  SCENE_PERFORM_MS,
  SCENE_READ_MS,
  SCENE_STAGE_TEXT_LEN,
  readMsFor,
} from '@/components/tour/scenePhases'
import { useTourStage } from '@/hooks/useTourStage'
import { useSetCoinOnboarded } from '@/hooks/useMyCoin'
import { dismissCalendarHomeIntro, postTourProgress } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'
import { markResearchRevealSeen } from '@/utils/researchIntro'
import type { Application } from '@/types/application'

/**
 * 앱 소개 투어 — `/signup/tour` (`plans/app-tour.md` · v2 「한 편의 애니메이션」).
 *
 * ## v2 가 바꾼 것 — 넘기는 슬라이드 → **재생되는 영상**
 *
 * v1 은 「다음」을 눌러야 넘어가는 슬라이드였다. 그러면 **읽을 마음이 있는 사람만** 끝까지
 * 간다. v2 는 기본이 자동 재생이다 — 가만히 보고만 있어도 7장이 흘러간다.
 * 대신 **손을 대면 즉시 반응한다**: 탭하면 다음, 길게 누르면 멈춘다.
 *
 * ```
 * 장면 = 연출(그림이 움직이는 시간) + 읽는 여유(글자수에 비례)
 * ```
 *
 * 🔴 읽는 여유를 **글자수에서 뽑는 이유** — 장면마다 문장 길이가 두 배 넘게 차이 난다.
 * 같은 시간을 주면 짧은 장면은 지루하고 긴 장면은 못 읽는다. CEO 기준 셋 중 둘
 * (「지루하지 않게」·「읽기에 빠르지 않게」)이 정확히 이 값의 양 끝이다.
 *
 * ## 오버레이 흡수는 그대로
 *
 * 코인 온보딩 모달·캘린더 홈 배너를 이 화면이 흡수한다(끝날 때 함께 기록). 진입은
 * **온보딩 직후 경로**와 **도움말의 다시 보기 링크** 둘뿐 — 기존 사용자에게 자동으로
 * 뜨지 않는다.
 */

/** 장면 수 — 서버 DTO(`@Max(7)`)와 같은 계약이다. 늘리면 양쪽을 같이 본다 */
export const TOUR_SCENE_COUNT = 7

/** 스와이프로 인정하는 최소 가로 이동. 세로 스크롤과 싸우지 않는 값(실측 관례) */
const SWIPE_THRESHOLD_PX = 40
/** 이보다 오래 누르고 있으면 「탭」이 아니라 「일시정지」다 */
const LONG_PRESS_MS = 300

export function Tour() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { application: myCard, loading, failed } = useTourStage()

  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { mutate: setCoinOnboarded } = useSetCoinOnboarded()

  const replay = params.get('replay') === '1'
  const step = clampStep(params.get('step'))
  const isLast = step === TOUR_SCENE_COUNT

  /**
   * 🔴 `prefers-reduced-motion` = **수동 모드**. 자동 진행도 연출도 없이 완성 상태를 놓고
   * 「다음」 버튼을 준다 — 모션을 줄여 달라는 요청에 「빨리 감기」로 답하면 안 된다.
   */
  const reduced = usePrefersReducedMotion()

  const [paused, setPaused] = useState(false)
  /** 자동 재생을 하는 장면인가 — 마지막 장과 수동 모드는 스스로 넘어가지 않는다 */
  const auto = !isLast && !reduced
  const sceneRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  /** 부수효과는 **한 번만** — 더블탭·키보드 연타로 두 번 쏘면 안 된다 */
  const finishedRef = useRef(false)

  const goToStep = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 1), TOUR_SCENE_COUNT)
      const next2 = new URLSearchParams()
      next2.set('step', String(clamped))
      // replay 표식은 이동해도 살아 있어야 한다 — 잃으면 그 순간부터 저장이 켜진다
      if (replay) next2.set('replay', '1')
      /* 🔴 `replace` 다. push 로 쌓으면 다시 보기의 `navigate(-1)` 이 도움말이 아니라
         **직전 장면**으로 돌아가 투어를 못 빠져나온다. 새로고침 복귀는 URL 에 `step` 이
         남아 있어 그대로 동작한다. */
      setParams(next2, { replace: true })
    },
    [replay, setParams],
  )

  /**
   * 투어 종료 — 저장 + 흡수한 오버레이 소진 + 이동.
   *
   * 흡수 대상은 **아직 안 본 사람에게만** 쏜다(`null` 일 때만) — 이미 본 사람의 기록을
   * 다시 쓸 이유가 없고, 서버도 멱등이라 무의미한 왕복이 된다.
   */
  const finish = useCallback(
    (lastStep: number, completed: boolean) => {
      if (finishedRef.current) return
      finishedRef.current = true

      if (!replay) {
        // 실패는 조용히 — 진입 경로가 온보딩 직후뿐이라 기록이 없어도 다시 뜨지 않는다
        void postTourProgress({ lastStep, completed }).catch(() => {})

        if (user && user.onboardedCoinAt === null) {
          /* 🔴 **낙관 갱신이 먼저다.** 다음 화면이 `AppShell` 안이라, 스토어가 아직 null 이면
             방금 코인을 소개했는데 곧바로 코인 모달이 또 뜬다. */
          setUser({ ...user, onboardedCoinAt: new Date().toISOString() })
          setCoinOnboarded()
        }
        if (user && user.calendarHomeIntroDismissedAt === null) {
          void dismissCalendarHomeIntro().catch(() => {})
        }
        /* 보드 진입 1회 조사 노출의 기회를 여기서 쓴다 — 3장에서 이미 봤으므로
           보드에 들어가자마자 같은 회사 조사가 또 뜨면 안 된다 (`utils/researchIntro`). */
        markResearchRevealSeen(user?.id)
      }

      if (replay) {
        /*
          🔴 다시 보기에서도 **CTA 라벨이 가리키는 곳으로 간다.** 「{회사} 카드 열어보기」를
          눌렀는데 도움말로 돌아가면 버튼이 거짓말을 한 것이다 (예전엔 replay 면 무조건
          `navigate(-1)` 이었다). `replace` 를 쓰지 않는 이유는 **도움말로 돌아올 길**을
          남기기 위해서다 — 다시 보기는 설정 안에서 시작한 여정이다.

          반대로 **건너뛰기**(Esc·버튼·1장에서 뒤로가기)는 「안 볼래」라는 뜻이라 온 곳으로
          돌려보낸다. 그래서 `navigate(-1)` 은 완료가 아닌 종료에만 남는다.
        */
        if (completed) navigate(destinationFor(myCard))
        else navigate(-1)
        return
      }
      navigate(destinationFor(myCard), { replace: true })
    },
    [navigate, replay, setCoinOnboarded, setUser, myCard, user],
  )

  const goNext = useCallback(() => {
    if (isLast) finish(TOUR_SCENE_COUNT, true)
    else goToStep(step + 1)
  }, [finish, goToStep, isLast, step])

  const goPrev = useCallback(() => {
    if (step > 1) goToStep(step - 1)
  }, [goToStep, step])

  const skip = useCallback(() => finish(step, false), [finish, step])

  /*
    ── 브라우저 뒤로가기 = 이전 장면 ────────────────────────────────────────

    장면 전환이 `replace` 라 히스토리에 투어는 **한 칸**뿐이다. 그대로 두면 뒤로가기가
    투어를 통째로 벗어나 직전 화면(가입 흐름에선 `/login`)으로 튕기고, 거기서 다시
    `/calendar` 로 밀려 **투어를 본 기록도 남지 않는다** (실측).

    그래서 마운트할 때 **같은 URL 로 한 칸을 쌓아 둔다**(센티널). 뒤로가기가 그 칸을 먹으면
    장면을 하나 되돌리고 다시 쌓는다 — 사용자에게는 「뒤로 = 이전 장면」으로 보인다.
    1장에는 되돌릴 장면이 없으므로 **건너뛰기와 똑같이** 끝낸다(기록 + 목적지).

    🔴 `pushState` 의 state 는 **라우터의 것을 그대로 복사**한다. `null` 로 밀면
    react-router 가 들고 있는 히스토리 인덱스가 끊겨 pop 판정이 어긋난다.
    🔴 StrictMode 는 effect 를 두 번 돌린다 — ref 로 막지 않으면 센티널이 두 칸 쌓여
    개발 중에만 뒤로가기를 두 번 눌러야 한다.
  */
  const sentinelPushedRef = useRef(false)
  const pushSentinel = useCallback(() => {
    window.history.pushState(window.history.state, '', window.location.href)
  }, [])

  useEffect(() => {
    if (sentinelPushedRef.current) return
    sentinelPushedRef.current = true
    pushSentinel()
  }, [pushSentinel])

  useEffect(() => {
    const onPopState = () => {
      if (finishedRef.current) return
      if (step > 1) {
        goToStep(step - 1)
        // 되돌렸으면 다음 뒤로가기를 받을 칸을 다시 쌓는다 (안 쌓으면 한 번만 먹힌다)
        pushSentinel()
        return
      }
      finish(1, false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [finish, goToStep, pushSentinel, step])

  /*
    ── 장면 길이 측정 + 자동 진행 ───────────────────────────────────────────

    🔴 글자수를 **DOM 에서 잰다.** 장면마다 상수로 적어두면 문장을 한 줄 고칠 때마다 숫자를
    같이 고쳐야 하고, 안 고치면 조용히 어긋난다 (사전은 계열마다 길이가 두 배 차이 난다).
    연출로 나중에 나타나는 문장도 DOM 에는 처음부터 있다 (opacity 로만 숨긴다).

    🔴 잰 값을 **state 에 넣지 않는다.** effect 안의 `setState` 는 렌더를 한 번 더 돌리고
    (`react-hooks` 규칙이 막는 cascading render), 그 한 프레임 동안 진행 바가 duration 없이
    한 번 그려져 **막대가 번쩍인다.** 그래서 ref + DOM 직접 세팅이다.

    🔴 남은 시간은 **절대 시각(deadline)** 으로 들고 있는다. 예전엔 「재실행마다 남은 값을
    다시 계산」했는데, 재생 장면은 연출 단계마다 리렌더가 나므로 effect 가 그때마다 다시 돌아
    **경과 0으로 시계가 리셋**됐다 (실기에서 5장이 20초를 넘겨도 안 넘어갔다).
    deadline 은 리렌더와 무관하고, 일시정지 때만 「남은 길이」로 접었다 편다.
    (장면 **안**의 연출 타이머는 `usePhase` 가 따로 멈춘다.)
  */
  const deadlineRef = useRef<number | null>(null)
  const pausedLeftRef = useRef<number | null>(null)
  const stepKeyRef = useRef(-1)

  useEffect(() => {
    if (!auto) {
      deadlineRef.current = null
      pausedLeftRef.current = null
      return
    }

    const now = Date.now()

    // 장면이 바뀌면 길이를 새로 잰다 (같은 장면 안에서는 재지 않는다 — 시계가 리셋된다)
    if (stepKeyRef.current !== step) {
      stepKeyRef.current = step
      pausedLeftRef.current = null
      /*
        🔴 읽는 시간 = **무대 글자수 × 25ms** (`clamp(1500, …, 4500)`).

        제목·설명 DOM 측정은 폐지했다 — **안무가 등장 순서를 정하므로** 제목·설명은 언제나
        맨 마지막에 나타난다(규칙 C). 사람은 그 둘을 안무가 끝나기 직전에 읽으므로, 완성
        뒤에 남는 변수는 「무대에 읽을 게 얼마나 있나」뿐이다.

        읽기는 **마지막 요소가 다 나타난 뒤**(= `SCENE_PERFORM_MS` 뒤) 흐른다.
      */
      const read = SCENE_READ_MS[step] ?? readMsFor(SCENE_STAGE_TEXT_LEN[step] ?? 0)
      const total = (SCENE_PERFORM_MS[step] ?? 1000) + read
      deadlineRef.current = now + total
      // 진행 바는 이 장면의 실제 길이만큼 채워져야 한다 (장면마다 다르다)
      if (barRef.current) barRef.current.style.animationDuration = `${total}ms`
    }

    if (barRef.current) {
      barRef.current.style.animationPlayState = paused ? 'paused' : 'running'
    }

    if (paused) {
      // 멈춘 순간의 남은 길이를 접어 둔다 — 재개하면 그만큼만 더 흐른다
      if (deadlineRef.current !== null && pausedLeftRef.current === null) {
        pausedLeftRef.current = Math.max(0, deadlineRef.current - now)
      }
      return
    }

    if (pausedLeftRef.current !== null) {
      deadlineRef.current = now + pausedLeftRef.current
      pausedLeftRef.current = null
    }
    if (deadlineRef.current === null) return

    const t = window.setTimeout(goNext, Math.max(0, deadlineRef.current - now))
    return () => window.clearTimeout(t)
  }, [auto, step, paused, goNext, loading])

  /* 🔴 탭이 뒤로 가면 멈춘다 — 안 멈추면 다른 앱을 보는 동안 투어가 혼자 끝나 있다 */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setPaused(true)
      else setPaused(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 키보드 — ←/→·Space 이동 · Esc 는 건너뛰기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, skip])

  /*
    ── 탭 · 길게 누름 · 스와이프 ────────────────────────────────────────────
    셋이 같은 손가락 하나에서 나온다. 순서로 가른다:
      40px 이상 움직였나 → 스와이프
      300ms 이상 눌렀나 → 일시정지(떼면 재개)
      나머지            → 탭 = 다음
    🔴 버튼 위에서 시작한 터치는 전부 무시한다 — 「건너뛰기」를 누르려다 다음 장으로 가면
    안 되고, 2장 스텝 노드는 눌러서 옮기라고 만든 것이다.
  */
  const pressRef = useRef<{ x: number; timer: number; longPressed: boolean } | null>(null)

  const endPress = useCallback(
    (clientX: number | null) => {
      const press = pressRef.current
      pressRef.current = null
      if (!press) return
      window.clearTimeout(press.timer)
      if (press.longPressed) {
        setPaused(false)
        return
      }
      const dx = clientX === null ? 0 : clientX - press.x
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        if (dx < 0) goNext()
        else goPrev()
        return
      }
      goNext()
    },
    [goNext, goPrev],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (isInteractive(e.target)) return
    const x = e.clientX ?? 0
    const timer = window.setTimeout(() => {
      if (pressRef.current) {
        pressRef.current.longPressed = true
        setPaused(true)
      }
    }, LONG_PRESS_MS)
    pressRef.current = { x, timer, longPressed: false }
  }
  const onPointerUp = (e: React.PointerEvent) => endPress(e.clientX ?? null)
  const onPointerCancel = () => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return
    window.clearTimeout(press.timer)
    if (press.longPressed) setPaused(false)
  }

  /*
    🔴 「첫 카드 만들기」는 **성공했는데 0장**일 때만이다. 조회가 실패한 상태에서 그 말을
    쓰면 카드를 여섯 장 가진 사람에게 「아직 하나도 없다」고 말하게 된다 — 모를 때는
    아무것도 단정하지 않는 「보드로 가기」로 간다 (도착지는 어차피 같은 `/board`).
  */
  const ctaLabel = isLast
    ? failed
      ? '보드로 가기'
      : myCard
        ? `${myCard.companyName} 카드 열어보기`
        : '첫 카드 만들기'
    : '다음'

  /** 진행 안내 — 데스크탑은 오른쪽 열 아래, 모바일은 하단 바 (같은 문구, 다른 자리) */
  const hintText = '탭하면 다음 · 길게 누르면 잠시 멈춰요'

  return (
    /*
      🔴 데스크탑에서는 **전체를 한 덩어리로 가운데** 둔다 (`lg:justify-center`).
      모바일 문법(내용 가운데 + CTA 하단 고정)을 900px 세로에 그대로 쓰면 설명과 버튼 사이가
      280px 죽은 공간이 됐다 (실기 실측). 상단 바만 절대 위치로 띄우면 나머지가 한 묶음이 된다.
    */
    <div
      /* 🔴 안무 스코프는 **페이지 루트**다 — 마지막 장 CTA·보조 링크가 장면 컨테이너 밖
         (하단 바)에 있어서, 스코프가 장면에만 걸리면 그 둘만 안무를 못 받는다 */
      /* touch-manipulation — 탭=다음 구조라 iOS 더블탭 줌 지연(300ms)이 끼면 안 된다 */
      className={`relative min-h-[100dvh] flex flex-col px-[18px] lg:px-9 lg:justify-center select-none touch-manipulation tour-stage tour-stage-${step}`}
      /* 🔴 마지막 장만 브랜드 라디얼을 한 단계 올린다 (0.08 → 0.12) — 「도착했다」를
         배경이 거들게 한다. 컨페티는 쓰지 않는다(합격 전유 원칙). */
      style={{
        background: `
          radial-gradient(ellipse 800px 600px at 50% -200px, rgba(var(--brand), ${
            isLast ? 0.12 : 0.08
          }), transparent 60%),
          rgb(var(--bg))
        `,
      }}
    >
      {/* ── 상단: 분할 진행 바 + 건너뛰기 ── */}
      <div className="shrink-0 min-h-[56px] flex items-center gap-3 pt-[max(12px,env(safe-area-inset-top))] lg:absolute lg:top-0 lg:inset-x-0 lg:px-9 lg:pt-6">
        {/* 🔴 `role="tablist"` 가 아니다 — 누를 수 없는 장식이다. 진행 상황은 아래
            live 영역이 말로 알린다(막대 7개를 탭 7개로 선언하면 「누르라」고 안내한다) */}
        <div className="flex items-center gap-1 flex-1 min-w-0" aria-hidden="true">
          {Array.from({ length: TOUR_SCENE_COUNT }).map((_, i) => {
            const isCurrent = i + 1 === step
            return (
              <span
                key={i}
                className="flex-1 h-1 rounded-full bg-line-strong overflow-hidden"
              >
                <span
                  // 현재 막대만 ref 를 받는다 — duration 을 effect 가 직접 써넣는다
                  ref={isCurrent ? barRef : undefined}
                  className={`block h-full rounded-full bg-brand origin-left ${
                    i + 1 < step
                      ? 'scale-x-100'
                      : isCurrent
                        ? // 자동 재생이 아니면(마지막 장·수동 모드) 채운 상태로 세워 둔다
                          auto
                          ? 'animate-tourProgress'
                          : 'scale-x-100'
                        : 'scale-x-0'
                  }`}
                />
              </span>
            )
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {TOUR_SCENE_COUNT}장 중 {step}장
        </p>

        {/* 마지막 장에는 건너뛸 것이 남아 있지 않다 */}
        {!isLast && (
          <button
            type="button"
            onClick={skip}
            className="shrink-0 min-h-[44px] px-3 -mr-3 text-[13px] font-medium text-text-tertiary hover:text-text-primary transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            건너뛰기
          </button>
        )}
      </div>

      {/* ── 장면 ── */}
      <div
        ref={sceneRef}
        data-tour-scene
        className={`flex-1 min-h-0 flex flex-col py-4 lg:flex-none lg:py-0 ${
          /* CSS 로 그려지는 순차 등장까지 함께 멈춘다 — JS 연출은 `usePhase` 가 멈춘다 */
          paused ? '[&_*]:[animation-play-state:paused]' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* key — 장면이 바뀔 때마다 리마운트해 연출이 처음부터 돈다 */}
        <SceneAt
          key={step}
          step={step}
          myCard={myCard}
          loading={loading}
          failed={failed}
          paused={paused}
          reduced={reduced}
          hint={
            auto ? <p className="text-[11px] text-text-quaternary">{hintText}</p> : null
          }
        />
      </div>

      {/* ── 하단 ── */}
      <div className="shrink-0 pb-[max(16px,env(safe-area-inset-bottom))] lg:pb-0 lg:mt-9">
        {paused && (
          <p
            role="status"
            className="mb-2 text-center text-[11px] text-text-tertiary inline-flex items-center gap-1 w-full justify-center"
          >
            <Pause size={11} strokeWidth={2} aria-hidden="true" />
            일시정지
          </p>
        )}
        {/*
          🔴 자동 재생 중에는 하단 버튼이 **마지막 장에서만** 나온다.
          매 장면에 「다음」이 붙어 있으면 「눌러야 넘어가는 화면」으로 읽혀서, 가만히 두면
          흘러간다는 사실 자체가 전달되지 않는다. 수동 모드(reduced)에서는 반대로 항상 필요하다.
        */}
        {!auto && (
          <>
            {/* 🔴 마지막 CTA 는 **크다** — 여섯 장을 본 뒤 눌러야 할 단 하나의 버튼이다
                (모바일 풀폭 52px · 데스크탑 320px). 수동 모드의 「다음」은 같은 자리를 쓴다. */}
            <button
              type="button"
              onClick={goNext}
              // 🔴 마지막 장에서는 CTA 가 **핵심 한 방**이라 안무 마지막에 팝으로 뜬다
              {...(isLast ? cue(7, 'cta', 'pop') : {})}
              className={`mx-auto flex items-center justify-center gap-1.5 bg-brand hover:bg-accent active:bg-accent-hover text-bg font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                isLast
                  ? 'w-full lg:w-[320px] min-h-[52px] text-[15px]'
                  : 'w-full max-w-[420px] min-h-[48px] text-sm'
              }`}
            >
              {ctaLabel}
              {isLast && <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />}
            </button>
            {isLast && (
              /* 「다시 볼 수 있다」를 알려 두면 지금 안 본 것에 대한 아쉬움이 줄어든다 */
              <p
                {...cue(7, 'link')}
                className="mt-2.5 text-center text-xs text-text-tertiary"
              >
                나중에 다시 보려면 설정 › 도움말
              </p>
            )}
          </>
        )}
        {auto && (
          <p className="text-center text-[11px] text-text-quaternary min-h-[48px] flex items-center justify-center lg:hidden">
            {hintText}
          </p>
        )}
      </div>
    </div>
  )
}

interface SceneProps {
  step: number
  myCard: Application | null
  loading: boolean
  /** 카드 목록 조회 실패 — 「0장」과 다르게 말해야 한다 */
  failed: boolean
  paused: boolean
  reduced: boolean
  hint: React.ReactNode
}

function SceneAt({ step, myCard, loading, failed, paused, reduced }: SceneProps) {
  switch (step) {
    case 1:
      return <Scene1 />
    case 2:
      return <Scene2 paused={paused} reduced={reduced} />
    case 3:
      return <Scene3 />
    case 4:
      return <Scene4 paused={paused} reduced={reduced} />
    case 5:
      return <Scene5 paused={paused} reduced={reduced} />
    case 6:
      return <Scene6 paused={paused} reduced={reduced} />
    default:
      return <Scene7 application={myCard} loading={loading} failed={failed} />
  }
}

/**
 * 버튼·스텝 노드 위에서 시작한 조작인가 — 그렇다면 재생 조작이 아니다.
 * `data-no-card-nav`(스텝바 구역)는 「빗나간 탭이 아무 일도 안 하는 곳」이라는 기존 표식이라
 * 여기서도 같은 뜻으로 존중한다.
 */
function isInteractive(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return Boolean(el.closest('button, a, [data-no-card-nav]'))
}

/**
 * `?step=` 은 사용자가 손으로 고칠 수 있는 값이다. 범위 밖·숫자 아님은 **1장으로** 접는다 —
 * 렌더 중 판정이라 던지지 않는다.
 *
 * 🔴 상한으로 자르지 **않는다**. `step=99` 를 마지막 장으로 접으면 그 자리에서 완료 CTA 가
 * 눌려 `completed: true` 가 기록된다 — 보지도 않은 투어가 완료로 남는다.
 */
function clampStep(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1 || n > TOUR_SCENE_COUNT) return 1
  return n
}

/**
 * 투어가 끝나고 갈 곳.
 *
 * - 실카드가 있으면 **그 카드 상세** — 방금 일곱 장을 본 그 카드다
 * - 없으면 **보드** — 「카드 추가」 버튼과 빈 상태 CTA 가 둘 다 보이는 화면이다.
 *   🔴 `/calendar` 에서 카드 추가 모달을 여는 기존 수단이 없어 보드로 보낸다
 *   (그 하나 때문에 새 URL 규약을 만들지 않는다).
 */
function destinationFor(myCard: Application | null): string {
  return myCard ? `/board/${myCard.id}` : '/board'
}

/** `prefers-reduced-motion: reduce` — 변경도 따라간다(설정 앱에서 바로 바꾸는 사람이 있다) */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchesReducedMotion())
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function matchesReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
