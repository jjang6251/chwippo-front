import {
  SHOWCASE_BUSINESS_SUMMARY,
  SHOWCASE_COMPANY,
  SHOWCASE_COVERLETTER,
  SHOWCASE_INTERVIEW,
  SHOWCASE_JOB,
  SHOWCASE_KEYWORD_HINT,
  SHOWCASE_NOTE,
  SHOWCASE_PRODUCTS,
  SHOWCASE_RESEARCH_KEYWORDS,
  SHOWCASE_RESEARCH_SECTIONS,
  SHOWCASE_ROLE_INSIGHT,
  SHOWCASE_STATS,
  SHOWCASE_STORY,
  SHOWCASE_TALENT_PROFILE,
} from './showcase'
import { typingDurationMs } from './useTypewriter'
import { CHOREO } from './choreo'

/**
 * 장면별 **연출 지연표 + 읽기 시간 규칙** — 장면 파일과 재생 엔진이 **같은 숫자**를 본다.
 *
 * 🔴 왜 별도 모듈인가 — 두 곳이 이 값을 쓴다: 장면이 단계를 넘길 때, `Tour` 가 「이 장면을
 * 얼마나 두고 볼까」를 계산할 때. 장면 파일에 두면 컴포넌트 파일이 상수를 내보내게 되어
 * fast-refresh 가 깨지고(`react-refresh/only-export-components`), 엔진에 따로 적으면
 * **연출을 늘렸는데 넘어가는 시간은 그대로**가 되어 글자가 다 나오기 전에 넘어간다.
 *
 * ## 🔴 v3.4 — 페이싱 규칙을 하나로 (CEO 실기)
 *
 * 「1장은 너무 길고 3장 조사는 스쳐 지나간다」의 원인은 **규칙이 둘이었기 때문**이다:
 *
 * ```
 * 예전: 장면 시간 = 연출 + DWELL(4.5s 고정) + READ(제목·설명 글자수만)
 *        → 글이 적은 1장도 DWELL 을 다 먹고, 글이 많은 3장은 무대 글이 안 세어져 짧았다
 * 지금: 장면 시간 = 연출 + READ(제목 + 설명 + 무대 글자수 × 55ms)
 *        → 읽을 게 많으면 오래, 적으면 짧게. 규칙 하나.
 * ```
 *
 * `DWELL_MS` 는 폐지했다 — 「머무는 시간」과 「읽는 시간」이 따로 있을 이유가 없다.
 * 읽기 시간은 **마지막 요소가 다 나타난 뒤**부터 흐른다 (`SCENE_PERFORM_MS` 뒤).
 */

const len = (...xs: readonly string[]) => xs.join('').length

/**
 * 순차 등장 간격.
 * 🔴 350 → **250** (CEO 「나오는 게 느리다」). 요소가 눈에 하나씩 걸리는 하한이 이 근처고,
 * 그보다 촘촘하면 동시에 뜬 것으로 읽힌다.
 */
export const REVEAL_STEP_MS = 250

/* ── 읽기 시간 ──────────────────────────────────────────────────────────── */

/**
 * 한글 기준 체감 읽기 속도. 실기 조정 손잡이는 이 셋뿐이다.
 *
 * 🔴 **안무가 들어오면서 값이 확 줄었다** (55ms → 25ms · 3~9.5s → 1.5~4.5s).
 * 예전엔 요소가 한꺼번에 떠서 「다 뜬 뒤에 읽는 시간」이 통째로 필요했다. 지금은 위계
 * 순서대로 하나씩 나타나므로 **읽기가 안무 중에 이미 일어난다** — 완성 뒤에 또 길게 주면
 * 「다 나왔는데 왜 안 넘어가」가 된다 (CEO 8/29).
 */
/*
 * 8/29 실측: 25ms·상한 4.5s 로는 총 46초 — 글이 많은 ③④⑥ 이 완성 뒤 4.5초 만에 넘어가
 * 「똭」 보여준 걸 읽을 틈이 없다(④ 초안 198자는 타이핑을 따라 읽을 수 없는 속도다).
 * 35ms·6.5s 로 올려 ③ ≈5.3s · ④⑥ 6.5s, 총 ≈51초. 그림 위주 ①② 는 하한 1.5s 그대로.
 */
/*
 * 8/29 실기 2차: 상한 6.5s 에 붙는 ④⑥ 이 「완성 뒤 너무 길다」(CEO). 내용이 순서대로 나오며
 * 읽히므로 완성 뒤 몫은 4s 면 충분 — 상한 6.5 → 4.0. 비례 구간(35ms/자)은 그대로.
 */
export const READ_MS_PER_CHAR = 35
export const READ_MS_MIN = 1500
// 8/29 3차: 「조금만 더」 — 4.0 → 3.2s
export const READ_MS_MAX = 3200

/**
 * 글자수 → 완성 **뒤** 머무는 시간.
 *
 * 🔴 제목·설명 DOM 측정은 폐지했다 — 안무가 등장 순서를 정하므로 제목·설명은 이미
 * 마지막에 나온다. 남은 변수는 「무대에 읽을 게 얼마나 있나」뿐이다.
 */
export function readMsFor(charCount: number): number {
  return Math.min(Math.max(charCount * READ_MS_PER_CHAR, READ_MS_MIN), READ_MS_MAX)
}

/**
 * 장면별 **무대 글자수** — 사람이 실제로 읽는 문장만 센다.
 *
 * 🔴 **`aria-hidden` 장식 텍스트는 세지 않는다.** 스텝 라벨·퍼센트·흐린 옆 카드처럼 눈이
 * 훑고 지나가는 표식까지 읽는 글로 세면 1장처럼 그림 위주인 장면이 통째로 길어진다
 * (그게 「1장 너무 길다」의 원인이었다). 보조기술에서 숨기는 텍스트라면 읽는 시간도 주지
 * 않는 게 일관된다 — 판정 기준이 하나가 된다.
 */
export const SCENE_STAGE_TEXT_LEN: Record<number, number> = {
  // 옆 카드는 `aria-hidden` 흐린 장식이라 빠진다 (읽으라고 놓은 게 아니다)
  1: len(
    '지원 현황 보드',
    `예시 · ${SHOWCASE_COMPANY} ${SHOWCASE_JOB}`,
    SHOWCASE_COMPANY,
    SHOWCASE_JOB,
  ),
  /* 카드 + 체크 4줄. 단계 이름·미니 캘린더는 `aria-hidden` 장식이라 빠지고,
     체크 4줄은 **읽는 문장**이라 들어간다 */
  2: len(
    SHOWCASE_COMPANY,
    SHOWCASE_JOB,
    '전형 단계 템플릿 적용',
    '마감 D-day 자동 계산',
    '캘린더에 자동 등록',
    '합격까지 한 카드에서',
  ),
  /* 실제 탭과 같은 4섹션. 🔴 값은 `SCENE_READ_MS[3]` override 가 이겨서 읽기 시간에는
     쓰이지 않지만, 「무대에 읽을 게 얼마나 있나」의 기록으로 맞춰 둔다 */
  3: len(
    SHOWCASE_COMPANY,
    SHOWCASE_JOB,
    ...Object.values(SHOWCASE_RESEARCH_SECTIONS),
    ...SHOWCASE_RESEARCH_KEYWORDS,
    SHOWCASE_KEYWORD_HINT,
    ...SHOWCASE_STATS.flatMap((s) => [s.label, s.value, s.delta]),
    SHOWCASE_BUSINESS_SUMMARY,
    ...SHOWCASE_PRODUCTS,
    ...SHOWCASE_STORY.flatMap((s) => [s.label, s.text]),
    ...SHOWCASE_TALENT_PROFILE,
    SHOWCASE_ROLE_INSIGHT,
  ),
  4: len(
    SHOWCASE_COVERLETTER.question,
    ...SHOWCASE_COVERLETTER.draft,
    ...SHOWCASE_COVERLETTER.checks,
  ),
  // 5장은 판이 둘이라 아래에서 따로 계산한다
  5: 0,
  6: len(
    SHOWCASE_NOTE.title,
    SHOWCASE_NOTE.stepPill,
    SHOWCASE_NOTE.questionsHeading,
    ...SHOWCASE_NOTE.questions,
    SHOWCASE_NOTE.study.heading,
    ...SHOWCASE_NOTE.study.bullets,
    ...SHOWCASE_NOTE.checklist.map((c) => c.label),
    SHOWCASE_NOTE.highlight,
    SHOWCASE_NOTE.imageCaption,
  ),
  7: 0,
}

/* ── 장면별 연출 ────────────────────────────────────────────────────────── */

/**
 * 장면 2 — **바뀌는 것은 단계 이동 세 번**: 과제 → 1차 실무면접 → 2차 면접 → 최종 합격
 * (안무표의 `move`·`move2`·`move3`, 칸마다 700ms). D-day 값·캘린더 점·합격 표시는 전부
 * 그 상태에서 파생되므로 함께 바뀐다 — 옮기는 것 하나만 재생하면 나머지가 따라온다.
 */
export const SCENE2_PHASE_MS = [
  CHOREO[2].move,
  CHOREO[2].move2 - CHOREO[2].move,
  CHOREO[2].move3 - CHOREO[2].move2,
]
const SCENE2_PERFORM_MS = CHOREO[2].end

/**
 * 장면 3 — 0 카드+탭 → 1 키워드 칩 4개 → 2 칩 하나 펼침 → 3 원하는 사람 → 4 한 줄 소개.
 * 🔴 칩이 다 오른 **뒤에** 펼쳐져야 「하나가 열렸다」로 읽힌다 (0.9s).
 */
const SCENE3_PERFORM_MS = CHOREO[3].end

/**
 * 장면 4 — 0 문항 열림 → 1 「AI 초안」 눌림 → 2 타이핑 → 3 점검 배지.
 * 타이핑 구간은 문장 길이에서 나온다 (12ms/자 → 198자 ≈ 2.4s).
 */
/**
 * 장면 4 — **바뀌는 것 셋**: 버튼 눌림 → 타이핑 시작 → 점검 배지 등장 시점의 타이핑 완료.
 * 시각은 안무표(`CHOREO[4]`)에서 가져온다 — CSS 등장과 한 표를 본다.
 */
export const SCENE4_TYPING_MS = typingDurationMs(SHOWCASE_COVERLETTER.draft)
export const SCENE4_PHASE_MS = [
  CHOREO[4].press,
  CHOREO[4].typing - CHOREO[4].press,
  CHOREO[4].checks - CHOREO[4].typing,
]
const SCENE4_PERFORM_MS = CHOREO[4].end

/**
 * 장면 5 — **판이 둘**이라 읽기 시간도 둘이다.
 *
 * ```
 * Q1 등장 → Q1 읽기(3~6.5s) → 접힘 → Q2 등장 → Q2 읽기(3~5.5s, 장면 종료 몫)
 * ```
 *
 * 🔴 두 번째 상한이 더 낮다 — **이미 한 번 읽은 구조**라 두 번째는 「어떻게 굴러가는지」만
 * 확인하면 된다. 같은 상한을 주면 뒤가 늘어져 지루해진다.
 */
export const SCENE5_SENTENCE_MS = 400

/** 타이머는 문장 등장에 맞춰 흐른다 — 문장이 끝났는데 시계만 도는 화면을 만들지 않는다 */
export function scene5ElapsedAt(tick: number, total: number): number {
  const t = Math.min(Math.max(tick, 0), total)
  return Math.round((t / total) * SHOWCASE_INTERVIEW.elapsedSec)
}

/**
 * Q2 는 **두 번째**라 읽기 상한이 낮다 — 이미 한 번 읽은 구조라 「어떻게 굴러가는지」만
 * 확인하면 된다. 같은 상한을 주면 뒤가 늘어져 지루해진다.
 */
export const SCENE5_Q2_READ_MS = 3000

/**
 * 장면 5 — 바뀌는 것: 답변 문장 등장 시작 · 피드백 · **Q1 접힘** · Q2 답변 · Q2 피드백.
 * 전부 안무표(`CHOREO[5]`)의 시각을 그대로 쓴다.
 */
export const SCENE5_PHASE_MS = [
  CHOREO[5].answer,
  CHOREO[5].feedback - CHOREO[5].answer,
  CHOREO[5].collapse - CHOREO[5].feedback,
  CHOREO[5].answer2 - CHOREO[5].collapse,
  CHOREO[5].feedback2 - CHOREO[5].answer2,
]
const SCENE5_PERFORM_MS = CHOREO[5].end

/**
 * 장면 6 — 0 제목 → 1 예상 질문 → 2 정리 글(크루 문화) → 3 체크리스트 → 4 항목 체크됨
 * → 5 형광 강조 → 6 사진
 */
/** 장면 6 — 바뀌는 것은 **체크가 그어지는 것** 하나뿐이다 */
export const SCENE6_PHASE_MS = [CHOREO[6].check]
const SCENE6_PERFORM_MS = CHOREO[6].end

/** 장면 7 — 0·1·2 「지금 열린 것」 칩 3개 → 3 카드 등장 */
const SCENE7_PERFORM_MS = CHOREO[7].end

/**
 * 🔴 1장 **오프닝 안무**의 길이 — 지연표 자체는 `index.css` 의 `.tour-stage-1` 에 있다
 * (실제 `CompanyCard` 내부 요소를 `data-*` 훅으로 잡아 연출하므로 CSS 가 유일한 자리다).
 *
 * ⚠️ **두 곳이 같은 숫자를 봐야 한다.** CSS 의 마지막 지연(설명 2250ms + 300ms)보다 이 값이
 * 짧으면 글이 다 나오기 전에 읽는 시간이 시작돼 장면이 일찍 넘어간다. 안무를 고치면 여기도.
 */
export const SCENE1_OPENING_MS = 2550
/** 5장 문장 등장 간격 — 말하는 리듬 (글자 단위 타이핑은 지루했다) */

/** 연출 길이(ms) — 그림이 다 움직이는 데 걸리는 시간. 읽기는 이 **뒤에** 시작한다 */
export const SCENE_PERFORM_MS: Record<number, number> = {
  1: SCENE1_OPENING_MS,
  2: SCENE2_PERFORM_MS,
  3: SCENE3_PERFORM_MS,
  4: SCENE4_PERFORM_MS,
  5: SCENE5_PERFORM_MS,
  6: SCENE6_PERFORM_MS,
  7: SCENE7_PERFORM_MS,
}

/**
 * 장면별 **읽기 시간 override** — 기본 공식을 쓰지 않는 장면만.
 * 5장은 Q1 읽기를 연출 안에 이미 넣었으므로, 장면 끝에 남는 건 **Q2 몫**이다.
 */
/**
 * 기본 공식을 쓰지 않는 장면만.
 *
 * 🔴 이제 **5장 하나뿐**이다. 1장 예외(1500)는 새 공식이 그대로 내놓으므로(무대 34자 →
 * 하한 1500) 규칙이 예외를 흡수했다 — 예외가 규칙이 되면 예외를 지운다.
 * 5장은 Q1 읽기를 연출 안에 이미 넣었으므로 장면 끝에 남는 건 **Q2 몫**이다.
 */
export const SCENE_READ_MS: Record<number, number> = {
  /* 🔴 3장은 **완성 뒤 2.5초**다 (기본 공식이면 상한 6.5s — CEO 8/29 「다 나오고 나서
     기다리는 게 길다」). 4섹션이 순서대로 나타나는 5초 동안 이미 읽히므로, 완성 뒤에 또
     6.5초를 주면 「다 나왔는데 왜 안 넘어가」가 된다. 내용을 늘리면서 대기는 줄인다. */
  3: 2500,
  5: SCENE5_Q2_READ_MS,
}
