import { useEffect, useRef, type CSSProperties } from 'react'
import confetti from 'canvas-confetti'
import { CompanyCard } from '@/components/card/CompanyCard'
import { CalendarIcon } from '@/components/layout/Sidebar'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { TourInert } from '@/components/tour/TourInert'
import { usePhase } from '@/components/tour/usePhase'
import { at, cue, cueEach } from '@/components/tour/choreo'
import { SCENE2_PHASE_MS } from '@/components/tour/scenePhases'
import { confettiColors } from '@/utils/confettiColors'
import { addDays, getWeekMonday, todayLocal } from '@/utils/datetime'
import {
  SHOWCASE_FINAL_STEP_INDEX,
  SHOWCASE_NEXT_STEP_INDEX,
  SHOWCASE_SECOND_STEP_INDEX,
  SHOWCASE_STEP_INDEX,
  SHOWCASE_STEP_SHORT,
  makeShowcaseApplication,
} from '@/components/tour/showcase'

/**
 * 장면 2 — **「단계를 옮기면 D-day 와 캘린더가 따라와요」**
 *
 * ## 🔴 스텝바는 **하나**다 (v3.5)
 *
 * 예전엔 카드 안 스텝바 + 조작용 스텝바 두 벌이 위아래로 있었다. 같은 것이 두 번 보이면
 * 「어느 게 진짜지」가 되고, 무대 세로도 두 배로 먹는다. 카드 안 것 하나만 남긴다 —
 * 사용자가 보드에서 만날 자리가 거기다.
 *
 * ## 🔴 끝까지 간다 — 최종 합격 + 폭죽 (v3.6)
 *
 * 예전엔 한 칸(과제 → 1차 실무면접)만 옮기고 끝났다. 그러면 「옮길 수 있다」까지만 보이고
 * **그래서 어디로 가는지**는 안 보인다. 세 칸을 끝까지 옮겨 카드가 **최종 합격**이 되는
 * 모습까지 보여준다 (CEO 8/29 「전형 스텝별로 옮겨지면서 최종 합격까지」).
 *
 * 합격 상태는 **실제 `CompanyCard` 의 `PASSED` 표시 그대로**다 — success 스트라이프·
 * 「🎉 합격」 배지·100% 진행 바. 모양을 따로 그리면 실물이 바뀔 때 여기만 옛 모습으로 남는다.
 *
 * ## 폭죽은 여기 **한 번뿐**이다
 *
 * `plans/app-tour.md` Q6 은 「컨페티 없음 — 합격 전유」다. 이 장면이 그 원칙의 **예외가
 * 아니라 표현**이다: 투어에서 색종이가 날리는 유일한 순간이 카드가 합격이 되는 순간이라,
 * 「폭죽 = 합격」이라는 뜻이 오히려 선명해진다. 다른 장면으로 번지면 그 뜻이 죽는다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[2]`)
 *
 * 틀 → 카드 헤더·태그·D-day → 스텝 노드 좌→우 → 캘린더 →
 * **노드 이동 ×3(상태)** → **폭죽(핵심 한 방)** → 체크 4줄 → 제목 → 설명.
 * 카드·스텝바 **내부**는 props 가 없어 `index.css` 의 `.tour-stage-2` 가 그린다 —
 * 다만 **시각은 `CHOREO` 가 쥔다**: `stageVars()` 가 CSS 변수로 내려준다.
 *
 * ## 체크 4줄이 전부 ✓ 인 근거
 *
 * 다른 화면(`FirstCardCelebration`)의 「거짓 체크 금지」는 **사용자 데이터**를 두고 한 말이다.
 * 여기는 쇼케이스 이야기고, 그 안에서는 넷 다 실제로 일어났다(날짜가 있는 단계로 옮겼고,
 * 마지막에 합격까지 갔다). 무대에 보이는 카드가 그 증거라 화면과 체크가 어긋나지 않는다.
 */
interface Props {
  paused?: boolean
  /** `prefers-reduced-motion` — 연출 없이 완성 상태로 */
  reduced?: boolean
}

const SCENE = 2

/** 단계 이동 — 진행 단계(phase)마다 카드가 서 있는 스텝 */
const STEP_BY_PHASE = [
  SHOWCASE_STEP_INDEX,
  SHOWCASE_NEXT_STEP_INDEX,
  SHOWCASE_SECOND_STEP_INDEX,
  SHOWCASE_FINAL_STEP_INDEX,
] as const

/**
 * 캘린더 주 수.
 *
 * 🔴 **3주다.** 마감이 오늘 +2 · +5 · +12 · +20 이라 한 주(7칸)로는 셋이 같은 칸에 뭉치고,
 * 두 주로도 +12·+20 이 **둘 다 마지막 칸으로 접혀** 「옮겨간다」가 안 보인다. 3주면 +12 는
 * 오늘이 무슨 요일이든(최대 6+12=18) 제 칸에 앉고, 접히는 건 +20 하나뿐이다.
 * 4주는 모바일 폴드 안에서 칸이 더 납작해져 날짜가 안 읽힌다 — 3주가 상한이다.
 */
const CAL_WEEKS = 3
const CAL_CELLS = CAL_WEEKS * 7
/** 월요일 시작 — 앱 캘린더(`getWeekMonday`)와 같은 주 경계다 */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

const CHECKS = [
  '전형 단계 템플릿 적용',
  '마감 D-day 자동 계산',
  '캘린더에 자동 등록',
  '합격까지 한 카드에서',
]

/**
 * 카드·스텝바 **내부** 안무의 시각을 CSS 로 넘기는 다리.
 *
 * 🔴 그 요소들은 빌려 쓰는 컴포넌트(`CompanyCard`·`StepBar`) 안이라 props 가 없다. 그래서
 * `index.css` 의 `.tour-stage-2` 가 `animation-delay` 를 걸어 왔는데, **숫자가 두 곳에**
 * 있게 되어 안무를 고칠 때마다 한쪽만 바뀔 여지가 남았다(실제로 8/29 이동 간격을 늘리며
 * 드러났다). 이제 CSS 는 값을 갖지 않고 **여기서 내려준 변수만 읽는다** — 단일 소스는 `CHOREO`.
 */
function stageVars(): CSSProperties {
  return {
    '--t2-head': `${at(SCENE, 'cardHeader')}ms`,
    '--t2-nodes': `${at(SCENE, 'stepNodes')}ms`,
    '--t2-node-step': `${at(SCENE, 'stepNodeStep')}ms`,
    '--t2-dday': `${at(SCENE, 'dday')}ms`,
    '--t2-move': `${at(SCENE, 'moveMs')}ms`,
  } as CSSProperties
}

/**
 * 🔴 **작고 짧게** (CEO 「조그맣게 한 번 보기 좋게」).
 *
 * 합격 오버레이(`CelebrationOverlay`)는 70발 + 2.2초 잔불로 **화면을 덮는다** — 거기선
 * 그게 맞다(사용자 본인의 합격이고, 화면에 그것 말고 할 일이 없다). 여기는 소개 영상이라
 * 뒤에 체크 4줄·제목·설명이 이어져야 해서, 카드 위에서 1.2초쯤 톡 터지고 사라져야 한다.
 */

const CONFETTI = {
  particleCount: 36,
  spread: 55,
  startVelocity: 22,
  /**
   * 🔴 `decay` 를 지정하는 이유 — 기본값 0.9 는 조각을 **원점에서 220px 쯤 띄운다**
   * (`startVelocity / (1 - decay)`). 카드 높이가 190px 대라 폭죽이 카드를 한참 벗어나
   * **허공에 따로 떠 있는** 그림이 됐다(390·1280 실측). 0.82 면 ~120px — 카드 위로 살짝
   * 넘어섰다가 도로 카드에 내려앉아 「이 카드가 터졌다」로 읽힌다.
   */
  decay: 0.82,
  gravity: 1.1,
  ticks: 90,
  scalar: 0.8,
} as const

export function Scene2({ paused = false, reduced = false }: Props) {
  /* 🔴 「바뀌는 것」만 `usePhase` 다 — 노드가 실제로 옮겨가고 D-day 값·합격 상태가 갈린다.
     「나타나는 것」은 전부 CSS delay 가 맡는다 (`choreo.ts` 주석 참조). */
  const phase = usePhase(STEP_BY_PHASE.length, SCENE2_PHASE_MS, {
    paused,
    instant: reduced,
  })
  const passed = phase === STEP_BY_PHASE.length - 1

  /* 카드를 현재 단계까지 반영해 다시 만든다 — D-day 배지는 현재 단계의 날짜를 보므로
     인덱스만 바꿔도 배지가 저절로 따라 바뀐다 (`DdayBadge` 단일 구현을 그대로 쓴다).
     마지막 칸에서는 상태까지 `PASSED` 로 — 합격 표시도 `CompanyCard` 것을 그대로 쓴다. */
  const stepIndex = STEP_BY_PHASE[phase]
  const app = makeShowcaseApplication({
    currentStepIndex: stepIndex,
    status: passed ? 'PASSED' : 'IN_PROGRESS',
  })

  /* 🔴 캘린더가 보는 날짜는 **카드가 보는 그 날짜**다 — 카드 스텝에서 그대로 꺼낸다.
     따로 계산하면 D-day 배지와 캘린더 칸이 조용히 어긋난다 (둘 다 그럴듯해 보인다). */
  const deadline = app.steps[stepIndex]?.scheduledDate ?? null

  const cardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fireRef = useRef<ReturnType<typeof confetti.create> | null>(null)
  /** 폭죽은 **장면당 한 번**이다 — 일시정지·재개로 다시 터지면 안 된다 */
  const firedRef = useRef(false)

  /* 🔴 장면을 떠나면 **날아다니던 조각까지 걷는다.** 안 걷으면 다음 장(회사 조사) 위로
     색종이가 넘어가 「폭죽 = 합격」이라는 뜻이 흐려진다. */
  useEffect(() => {
    return () => {
      fireRef.current?.reset()
      fireRef.current = null
    }
  }, [])

  useEffect(() => {
    // 모션 최소화면 이동도 폭죽도 없다 — 완성 상태(합격 카드)만 놓는다
    if (reduced || paused || firedRef.current) return
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas || firedRef.current) return
      firedRef.current = true
      fireRef.current ??= confetti.create(canvas, { resize: true })
      fireRef.current({
        ...CONFETTI,
        origin: cardOrigin(canvas, cardRef.current),
        colors: confettiColors(),
        disableForReducedMotion: true,
      })
    }, at(SCENE, 'confetti'))
    // 탭·건너뛰기로 중간에 떠나면 예약만 취소된다 (터진 적이 없으니 걷을 것도 없다)
    return () => window.clearTimeout(timer)
  }, [paused, reduced])

  return (
    <TourSceneLayout
      scene={2}
      cards
      /* 🔴 `tall` 도 함께 — 캘린더가 1줄에서 3줄로 커지면서 모바일 무대가 기본 몫(50vh)을
         넘었다. 넘으면 `scale` 이 걸려 **카드 글자가 규격 밑으로 떨어진다**(13px → 11px).
         자리를 더 주는 쪽이 맞다: 이 장면은 제목·설명이 짧아 아래 몫을 덜 쓴다
         (폴드 assert 로 잠근다). `cards` 는 데스크탑 몫·확대 금지를 계속 맡는다. */
      tall
      stage={
        /* `relative` — 폭죽 캔버스를 무대 위에 겹쳐 놓는 기준 상자다.
           🔴 캔버스를 `space-y-3` 목록 **안에** 두면 안 된다: 절대 배치 요소에도
           `space-y` 의 `margin-top` 이 붙어 12px 내려앉는다. 목록 밖 형제로 둔다. */
        <div
          style={stageVars()}
          className="relative w-full max-w-[440px] lg:max-w-none mx-auto"
        >
          <div className="space-y-3">
            <div ref={cardRef}>
              <TourInert {...cue(SCENE, 'shell', 'shell')}>
                <CompanyCard application={app} />
              </TourInert>
            </div>

            <div
              {...cue(SCENE, 'calendar')}
              className="bg-surface-2 border border-line rounded-xl p-3 shadow-sm"
            >
              <StageCalendar
                deadline={deadline}
                label={SHOWCASE_STEP_SHORT[stepIndex] ?? ''}
                passed={passed}
              />
            </div>

            <ul className="space-y-2 text-left">
              {CHECKS.map((text, i) => (
                <li
                  key={text}
                  {...cueEach(SCENE, 'checks', 'checkStep', i)}
                  className="flex items-start gap-2.5"
                >
                  <span
                    className="shrink-0 w-5 h-5 mt-px rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center"
                    aria-hidden
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M1.5 5.5l2.3 2.3L8.5 2.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-brand"
                      />
                    </svg>
                  </span>
                  <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* 폭죽 전용 캔버스 — 무대 위에 얹혀 있을 뿐 아무것도 가로채지 않는다.
              🔴 **위로 여유를 준다**(`-top-24` = 96px). 캔버스 밖은 그려지지 않는데
              조각이 원점에서 120px 쯤 솟기 때문이다(`startVelocity`·`decay`) —
              상자를 무대에 맞췄더니 위로 튄 조각이 **일자로 잘려** 있었다(1280·390 실측). */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -bottom-6 -left-6 -right-6"
          />
        </div>
      }
      title="단계를 옮기면 D-day 와 캘린더가 따라와요"
      description="노드를 누르면 현재 단계가 바뀌고, 마감·캘린더가 함께 움직여요. 합격하면 축하까지."
    />
  )
}

/**
 * 폭죽이 터지는 자리 = **카드 한가운데**.
 *
 * canvas-confetti 는 캔버스 안의 **비율(0~1)** 로 원점을 받는다. 카드와 캔버스를 같은 단위
 * (`getBoundingClientRect`)로 재서 나누므로, 무대가 통째로 축소돼도(`TourSceneLayout` 의
 * `scale`) 비율은 변하지 않는다. 아직 배치 전이라 크기를 못 재면 한가운데로 둔다 —
 * 렌더 직후 호출이라 던지지 않는다.
 */
function cardOrigin(
  canvas: HTMLCanvasElement,
  card: HTMLElement | null,
): { x: number; y: number } {
  const box = canvas.getBoundingClientRect()
  const target = card?.getBoundingClientRect()
  if (!target || box.width === 0 || box.height === 0) return { x: 0.5, y: 0.5 }
  const ratio = (center: number, start: number, size: number) =>
    Math.min(Math.max((center - start) / size, 0), 1)
  return {
    x: ratio(target.left + target.width / 2, box.left, box.width),
    y: ratio(target.top + target.height / 2, box.top, box.height),
  }
}

/**
 * 무대 캘린더 — 「이 단계가 캘린더에 찍힌다」를 **말 대신 보여준다.**
 *
 * ## 🔴 숫자 1~7 짜리 가짜 칸이 아니라 **진짜 이번 주**다 (CEO 8/29 「1~7 숫자는 뭐임?」)
 *
 * 예전엔 1~7 이 적힌 칸 일곱 개에 점 하나였다. 요일도 오늘도 없으니 **캘린더로 안 읽혔고**,
 * 숫자는 순번인지 날짜인지도 알 수 없었다. 이제 라벨(「캘린더」)·요일 줄(월~일)·**오늘이
 * 속한 주부터 3주치 실제 날짜**를 그린다 — 오늘 칸에 테두리가 있으니 마감 칸이 며칠 뒤인지
 * 세어서 알 수 있고, 그게 D-day 배지와 같은 값이라는 것도 눈으로 확인된다.
 *
 * 🔴 날짜는 전부 `@/utils/datetime` **KST 헬퍼**로 만든다. `getWeekMonday()` 는 앱 캘린더가
 * 쓰는 주 경계와 같은 구현이라, 소개 화면과 실제 캘린더의 「이번 주」가 어긋나지 않는다.
 *
 * 🔴 전환은 **300ms**다 (500 → 300). 단계가 700ms 마다 옮겨가는데 500ms 크로스페이드를
 * 걸면 틴트가 **한 번도 자리에 앉지 못한 채** 다음 칸으로 끌려간다 — 실측 프레임에서 D-day 는
 * 이미 D-5 인데 캘린더는 아직 옛 칸에 진하게 남아 있어 「같이 움직인다」로 안 읽혔다.
 *
 * `aria-hidden` 은 그대로다 — 읽는 글이 아니라 그림이라 읽기 시간에도 안 들어간다
 * (`SCENE_STAGE_TEXT_LEN[2]`).
 */
function StageCalendar({
  deadline,
  label,
  passed,
}: {
  /** 현재 단계의 예정일 `YYYY-MM-DD` (KST). 없으면 표시할 마감이 없다 */
  deadline: string | null
  /** 마감 칸 아래 8px 라벨 */
  label: string
  /** 최종 합격 — warning 이 아니라 success 로 칠한다 */
  passed: boolean
}) {
  /* 오늘이 속한 주의 월요일부터 3주. 렌더마다 다시 만든다 — 모듈 상수로 굳히면
     자정을 넘긴 탭에서 「오늘」이 어제 칸에 남는다 (`makeShowcaseApplication` 과 같은 이유). */
  const monday = getWeekMonday()
  const days = Array.from({ length: CAL_CELLS }, (_, i) => addDays(monday, i))
  const todayIndex = days.indexOf(todayLocal())

  /* 🔴 마감이 3주를 넘어가면(오늘이 화요일 이후면 +20 이 그렇다) **마지막 칸으로 접고
     「→」로 표시한다.** 없는 칸에 그리지 않으면 라벨이 통째로 사라져 「어디로 갔지」가 되고,
     실제 날짜인 척 아무 칸에 찍으면 D-day 와 어긋난 거짓말이 된다. */
  const exact = deadline ? days.indexOf(deadline) : -1
  const overflow = deadline !== null && exact === -1
  const targetIndex = overflow ? CAL_CELLS - 1 : exact

  return (
    <div aria-hidden="true">
      <div className="flex items-center gap-1.5 mb-2 text-text-tertiary">
        <CalendarIcon size={12} />
        <p className="text-[11px] font-semibold">캘린더</p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="text-center text-[9px] leading-none text-text-quaternary"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mt-1.5">
        {days.map((ymd, i) => {
          const isTarget = i === targetIndex
          const isToday = i === todayIndex
          /* 🔴 클래스를 **문자열로 조립하지 않는다** — Tailwind 는 소스의 리터럴을 훑어
             클래스를 만들므로 `text-${tone}` 은 CSS 가 아예 생성되지 않는다(색 없는 글자가
             된다). 삼항으로 **완성된 클래스 이름**을 둘 다 적어 둔다. */
          const targetText = passed ? 'text-success' : 'text-warning'
          return (
            <div
              key={ymd}
              /* 데스크탑은 칸이 76px 로 넓어져 26px 높이면 납작한 띠로 보인다 — 세로만 키운다 */
              className={`h-[26px] lg:h-8 rounded-md border flex flex-col items-center justify-center gap-px transition-colors duration-300 ${
                isTarget
                  ? passed
                    ? 'bg-success/12 border-success/40'
                    : 'bg-warning/12 border-warning/40'
                  : isToday
                    ? 'bg-card border-brand/60'
                    : 'bg-card border-line'
              }`}
            >
              <span
                className={`font-mono text-[9px] lg:text-[10px] leading-none transition-colors duration-300 ${
                  isTarget
                    ? `${targetText} font-semibold`
                    : isToday
                      ? 'text-brand font-semibold'
                      : 'text-text-quaternary'
                }`}
              >
                {isTarget && overflow ? '\u2192' : dayOfMonth(ymd)}
              </span>
              {/* 라벨 자리는 **늘 비워 둔다** — 마감이 옮겨갈 때마다 칸 높이가 출렁이면
                  캘린더 전체가 덜컹거린다 */}
              <span
                className={`h-[9px] max-w-full px-0.5 text-[8px] leading-none truncate transition-opacity duration-300 ${
                  isTarget
                    ? `${targetText} opacity-100`
                    : isToday
                      ? 'text-brand opacity-100'
                      : 'opacity-0'
                }`}
              >
                {isTarget ? label : isToday ? '오늘' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** `'2026-08-29'` → `29` — 이미 KST 로 만들어진 문자열이라 `Date` 를 거치지 않는다 */
function dayOfMonth(ymd: string): number {
  return Number(ymd.slice(8, 10))
}
