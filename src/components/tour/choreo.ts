import type { CSSProperties } from 'react'

/**
 * 전 장면 공통 **안무 문법** (`plans/app-tour.md` · CEO 8/29 「1장처럼 나머지도 전부」).
 *
 * ## 규칙 넷
 *
 * ```
 * A 틀 먼저   — 무대 껍데기가 celebrateUp(0.25s 시작·450ms). 내용은 비어 있다
 * B 위계 순서 — 0.2~0.25s 간격으로 큰 것 → 몸통 → **핵심 한 방은 맨 마지막 팝**
 * C 제목·설명 — 그 뒤 제목(fadeInUp 300ms) → 설명(+150ms)
 * D 읽기      — 완성 뒤 clamp(1500, 무대 글자수 × 25ms, 4500). 안무 중에 이미 읽으므로 짧다
 * ```
 *
 * ## 🔴 「나타나는 것」과 「바뀌는 것」을 가른다
 *
 * | | 누가 | 왜 |
 * |---|---|---|
 * | 나타나는 것 (등장·페이드·팝) | **CSS `animation-delay`** | 조건부 렌더로 하면 리렌더가 줄줄이 나고, 무대 높이가 요소마다 튄다 |
 * | 바뀌는 것 (노드 이동·타이핑·접힘·체크) | **`usePhase`** | 실제 상태 변화라 CSS 로는 표현할 수 없다 |
 *
 * 둘의 시각은 **이 표 하나**로 맞춘다 — 두 군데에 숫자를 적으면 연출을 고칠 때 한쪽만 바뀌어
 * 「글자가 다 나오기 전에 넘어가는」 결함이 조용히 생긴다.
 */

/** 등장 방식 — 실제 키프레임은 `index.css` 에 있다 */
export type CueAnim = 'shell' | 'rise' | 'pop' | 'slide' | 'fade'

/**
 * 장면별 큐 시각(ms) — `t = 장면 시작` 기준.
 *
 * 🔴 `title`·`desc` 가 각 장면의 **마지막 큐**여야 한다 (규칙 C). 그보다 늦게 나타나는
 * 요소가 있으면 읽기 시간이 그 요소를 기다리지 않고 먼저 흐른다.
 */
export const CHOREO: Record<number, Record<string, number>> = {
  /* 1장은 카드 **내부**까지 연출해야 해서 지연표가 `index.css` 의 `.tour-stage-1` 에 있다
     (빌려 쓰는 `CompanyCard` 는 props 가 없다). 제목·설명만 여기서 공통 문법을 탄다. */
  1: { title: 2100, desc: 2250, end: 2550 },
  /* 2장 — 단계를 끝까지 옮긴다. 핵심 한 방 = **최종 합격 카드 위의 폭죽 한 번**
     (CEO 8/29 「전형 스텝별로 옮겨지면서 최종 합격까지 눌러서 폭죽이 조그맣게」).

     🔴 `dday` 가 250 인 이유 — 배지가 **바뀌는 걸 보여주려면 먼저 떠 있어야 한다.**
     예전엔 2200 이라 값이 안 보이는 사이에 갈렸고, 그래서 「따라온다」가 아니라
     「나중에 생긴다」로 읽혔다. 이제 카드 헤더와 함께 떠서 D-2 → D-5 → D-12 로 옮겨간다. */
  2: {
    shell: 0,
    cardHeader: 250,
    cardTags: 250,
    dday: 250,
    stepNodes: 500,
    stepNodeStep: 100,
    /** 노드가 한 칸 미끄러지는 데 걸리는 시간 — 등장이 아니라 **이동**의 길이다 */
    moveMs: 850,
    calendar: 1000,
    /* 🔴 칸 간격 **1000ms** (700 → 1000, CEO 8/29 「살짝 빠르다」). 한 칸이 옮겨간 걸
       눈으로 확인하고 D-day·캘린더가 따라온 것까지 읽으려면 850ms 짜리 이동 트랜지션이
       끝난 뒤 150ms 는 가만히 있어야 한다 — 700 이면 다음 칸이 이미 출발해 있었다. */
    move: 1400,
    move2: 2400,
    move3: 3400,
    confetti: 4150,
    checks: 4500,
    checkStep: 200,
    title: 5200,
    desc: 5350,
    end: 5650,
  },
  /* 3장 — 회사 조사. **실제 탭의 4섹션을 같은 이름·같은 순서로** 압축해 보여준다
     (CEO 8/29 「조사한 게 너무 부실하다」 — 11항목 중 3개만 나와 「이게 다야?」였다).
     핵심 한 방 = 인재상이 **내 직무 이야기**로 바뀌는 마지막 한 줄. */
  3: {
    shell: 0,
    cardHeader: 250,
    tabs: 450,
    tabActive: 650,
    keywordLabel: 900,
    chips: 1050,
    chipStep: 150,
    expand: 1750,
    about: 2000,
    stats: 2150,
    statStep: 150,
    summary: 2650,
    products: 2850,
    story: 3100,
    storyStep: 200,
    talent: 3700,
    talentStep: 120,
    roleInsight: 4250,
    title: 4500,
    desc: 4650,
    end: 4950,
  },
  // 4장 — 자소서. 핵심 한 방 = 「두괄식 ✓」 배지
  4: {
    shell: 0,
    question: 250,
    aiButton: 600,
    press: 900,
    typing: 1100,
    checks: 3600,
    checkStep: 200,
    title: 4300,
    desc: 4450,
    end: 4750,
  },
  // 5장 — 면접. 판이 둘이라 Q1 안무 → 읽기 → 접힘 → Q2 안무
  5: {
    shell: 0,
    topBar: 250,
    question: 550,
    bubble: 900,
    answer: 1000,
    answerStep: 400,
    feedback: 2900,
    title: 3300,
    desc: 3450,
    q1Read: 2500,
    collapse: 6250,
    question2: 6550,
    answer2: 6900,
    feedback2: 7900,
    end: 8400,
  },
  // 6장 — 노트. 핵심 한 방 = 체크가 그어지는 순간
  6: {
    shell: 0,
    noteTitle: 250,
    study: 500,
    studyStep: 150,
    checklist: 1300,
    checklistStep: 120,
    check: 1900,
    highlight: 2500,
    photo: 2800,
    pdf: 3100,
    title: 3300,
    desc: 3450,
    end: 3750,
  },
  // 7장 — 끝. 핵심 한 방 = CTA
  7: {
    chips: 0,
    chipStep: 300,
    card: 1000,
    title: 1500,
    desc: 1650,
    cta: 1900,
    link: 2100,
    end: 2400,
  },
}

/** 장면의 큐 시각. 없는 이름은 0 — 렌더 중 호출이라 던지지 않는다 */
export function at(scene: number, name: string, offset = 0): number {
  return (CHOREO[scene]?.[name] ?? 0) + offset
}

/**
 * 요소 하나에 붙일 안무 props — `data-anim` 이 방식을, 인라인 지연이 시각을 정한다.
 *
 * 🔴 지연만 인라인이다. **색·크기 같은 시각 속성은 인라인으로 주지 않는다**(DESIGN.md).
 * 시각은 전부 `index.css` 의 `[data-anim]` 규칙이 쥐고 있어서, 안무 문법을 바꾸면
 * 전 장면이 한 번에 따라온다.
 */
export function cue(
  scene: number,
  name: string,
  anim: CueAnim = 'rise',
  offset = 0,
): { 'data-anim': CueAnim; style: CSSProperties } {
  return {
    'data-anim': anim,
    style: { animationDelay: `${at(scene, name, offset)}ms` },
  }
}

/** 같은 줄에 여러 개가 차례로 오를 때 — `chips`, `chipStep` 처럼 짝으로 둔 값을 쓴다 */
export function cueEach(
  scene: number,
  name: string,
  stepName: string,
  index: number,
  anim: CueAnim = 'rise',
): { 'data-anim': CueAnim; style: CSSProperties } {
  return cue(scene, name, anim, index * (CHOREO[scene]?.[stepName] ?? 0))
}
