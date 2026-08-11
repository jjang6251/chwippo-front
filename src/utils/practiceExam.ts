import {
  CATEGORY_FLOW_FALLBACK,
  CATEGORY_FLOW_ORDER,
} from '@/types/interviewPrep'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * 「면접 보기」 시험 문제 산출 (질문 은행 D3).
 *
 * 화면이 아니라 **여기가 규칙의 자리**다 — 설정 화면은 고르고 미리보기만 하고, 무엇이
 * 몇 번째로 나오는지는 전부 이 파일이 정한다. 셔플이 들어가므로 `rng` 를 주입받아
 * **테스트가 순서를 단언할 수 있게** 한다 (`Math.random` 기본값).
 */

/**
 * 타이머는 **세 갈래**다 (끔·카운트다운·스톱워치).
 *
 * 🔴 `sec` 하나로는 스톱워치를 표현할 수 없다 — 「제한 없음」과 「끔」이 둘 다 0 이라
 * 같은 값이 두 가지를 뜻하게 된다. 그래서 `mode` 가 무엇인지를 쥐고, `sec` 은
 * **`countdown` 일 때만** 의미가 있다 (나머지 모드에선 0).
 */
export interface ExamTimer {
  mode: 'off' | 'countdown' | 'stopwatch'
  /** `countdown` 의 제한 시간(초). 다른 모드에선 0 */
  sec: number
}

export interface ExamSettings {
  /** 출처 — `both` 면 전부 */
  source: 'both' | 'user' | 'ai'
  /** 범위 — `must`=⭐ 우선만 · `again`=지난 연습에서 「다시」로 찍은 것만 */
  scope: 'all' | 'must' | 'again'
  /** `null` = 전체. scope 와 **AND** 로 겹쳐 건다 */
  category: string | null
  order: 'sequence' | 'random' | 'flow'
  /**
   * **상한**이다 — 필터 결과가 더 적으면 그만큼만 나온다.
   *
   * 🔴 리터럴(10·20)이 아니라 `number` 다: 설정 화면에 「직접 입력」이 생겼고, 그 값은
   * 필터 결과 M 에 따라 달라진다. 여기서는 **min(count, M) 만** 책임진다 —
   * 1 미만·M 초과 같은 입력 검사는 고르는 자리(설정 화면)의 몫이다.
   */
  count: 'all' | number
  timer: ExamTimer
}

/** 흐름 순서를 모르는 카테고리는 직무 질문 자리(40)로 — 세션 목록과 같은 규칙 */
const flowOf = (q: InterviewPrepQuestion) =>
  CATEGORY_FLOW_ORDER[q.category ?? ''] ?? CATEGORY_FLOW_FALLBACK

/**
 * **면접 진행 순서** 비교 함수 — 세션 목록(`InterviewSessionPage` 의 `numbered`)과
 * 「차례」 시험이 **같은 함수를 쓴다.** 식을 두 벌로 두면 한쪽만 고쳐지는 날이 오고,
 * 그때 사용자는 "목록에선 3번인데 시험에선 7번째로 나오는" 화면을 본다.
 */
export const compareByInterviewFlow = (
  a: InterviewPrepQuestion,
  b: InterviewPrepQuestion,
) => flowOf(a) - flowOf(b) || a.orderIndex - b.orderIndex

/**
 * 필터만 적용한 후보군 — **설정 화면의 미리보기가 이걸 쓴다.**
 * (`조건에 맞는 질문 N개` · 「M개로 시작해요」 · 미분류 안내가 전부 정렬 전 숫자다.)
 *
 * 🔴 **메인 질문(depth 0)만.** 꼬리질문은 부모 답변을 파고든 것이라 혼자 떼어 물으면
 * 맥락이 없다 (계획 §3-B: 루프는 메인 질문만).
 */
export function filterExamQuestions(
  questions: InterviewPrepQuestion[],
  settings: Pick<ExamSettings, 'source' | 'scope' | 'category'>,
): InterviewPrepQuestion[] {
  return questions.filter((q) => {
    if (q.depth !== 0) return false
    if (settings.source !== 'both' && q.source !== settings.source) return false
    if (settings.scope === 'must' && !q.mustPrepare) return false
    if (settings.scope === 'again' && q.lastPracticeResult !== 'again')
      return false
    if (settings.category !== null && q.category !== settings.category)
      return false
    return true
  })
}

/** Fisher-Yates — 주입된 `rng` 만 쓴다 (`sort(() => rng() - 0.5)` 는 편향된다) */
function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 블록 비례 추출 — **한 유형이 통째로 사라지지 않게** 각 블록에 1개를 먼저 주고,
 * 남은 자리만 크기 비례로 나눈다.
 *
 * 🔴 앞에서 N개를 자르면 안 되는 이유: 아크 순 결합이라 앞은 자기소개·지원동기다.
 * 20문항 중 10개를 고르면 **역질문·마지막 한마디가 한 번도 안 나온다** — 실전 흐름을
 * 고른 사람이 정확히 원하지 않는 결과다.
 *
 * `limit` 이 블록 수보다 작으면 큰 블록부터 1개씩 (동률은 앞 블록 = 흐름이 이른 쪽).
 */
function allocate(sizes: number[], limit: number): number[] {
  const total = sizes.reduce((a, b) => a + b, 0)
  if (limit >= total) return [...sizes]

  const k = sizes.length
  if (limit <= k) {
    const picked = sizes
      .map((size, i) => ({ size, i }))
      .sort((a, b) => b.size - a.size || a.i - b.i)
      .slice(0, limit)
      .map((x) => x.i)
    return sizes.map((_, i) => (picked.includes(i) ? 1 : 0))
  }

  const rest = limit - k
  const room = sizes.map((s) => s - 1)
  const roomTotal = total - k
  const add = room.map((c) => Math.floor((rest * c) / roomTotal))
  let leftover = rest - add.reduce((a, b) => a + b, 0)
  // 나머지 자리는 **소수부가 큰 블록부터** (동률이면 여유가 큰 쪽 → 앞 블록)
  const byFraction = room
    .map((c, i) => ({ i, frac: (rest * c) / roomTotal - add[i], room: c }))
    .sort((a, b) => b.frac - a.frac || b.room - a.room || a.i - b.i)
  for (const cand of byFraction) {
    if (leftover === 0) break
    if (add[cand.i] >= room[cand.i]) continue
    add[cand.i] += 1
    leftover -= 1
  }
  return sizes.map((_, i) => 1 + add[i])
}

/**
 * 미분류를 **중반에 산개**한다.
 *
 * 🔴 미분류(fallback 40)를 아크에 그대로 넣으면 직무 질문 자리에 뭉치고, 뒤에 붙이면
 * "마지막 5문항이 전부 미분류" 가 된다. 둘 다 실전 흐름이 아니다 — 최종 배열의
 * **25%~75% 구간**에 균등하게 흩는다 (계획 §3-B "기타는 중반 분산 · 끝 몰빵 X").
 */
function spreadLoose(
  arc: InterviewPrepQuestion[],
  loose: InterviewPrepQuestion[],
): InterviewPrepQuestion[] {
  if (loose.length === 0) return arc
  if (arc.length === 0) return loose

  const size = arc.length + loose.length
  const lo = Math.ceil(size * 0.25)
  const hi = Math.floor(size * 0.75)
  const capacity = hi - lo + 1
  const slots = new Set<number>()
  if (loose.length <= capacity) {
    const step = capacity / loose.length
    for (let i = 0; i < loose.length; i++) {
      slots.add(lo + Math.floor(i * step + step / 2))
    }
  } else {
    // 중반이 다 못 담을 만큼 미분류가 많다 → 전체에 균등 (설정 화면이 "사실상 무작위" 라고 알린다)
    const step = size / loose.length
    for (let i = 0; i < loose.length; i++) {
      slots.add(Math.floor(i * step + step / 2))
    }
  }

  const out: InterviewPrepQuestion[] = []
  let a = 0
  let l = 0
  for (let i = 0; i < size; i++) {
    const takeLoose = slots.has(i) ? l < loose.length : a >= arc.length
    out.push(takeLoose ? loose[l++] : arc[a++])
  }
  return out
}

/**
 * 실전 흐름 — 카테고리 아크 순 **블록 정렬 + 블록 안 셔플** + 미분류 중반 분산.
 *
 * 블록 안을 섞는 이유: 같은 세션을 두 번 봐도 순서가 그대로면 "답을 외운 게 아니라
 * 순서를 외운" 상태가 된다. 흐름(자기소개 → … → 마지막 한마디)은 지키면서 안쪽만 흔든다.
 *
 * 🔴 `rng` 소비 순서는 **블록 흐름 오름차순 → 미분류** 다 (테스트가 이 순서에 기댄다).
 */
function buildFlowOrder(
  pool: InterviewPrepQuestion[],
  limit: number,
  rng: () => number,
): InterviewPrepQuestion[] {
  const blocks = new Map<number, InterviewPrepQuestion[]>()
  const loose: InterviewPrepQuestion[] = []
  for (const q of pool) {
    if (!q.category) {
      loose.push(q)
      continue
    }
    const key = flowOf(q)
    const bucket = blocks.get(key)
    if (bucket) bucket.push(q)
    else blocks.set(key, [q])
  }

  const keys = [...blocks.keys()].sort((a, b) => a - b)
  // 셔플 전에 `orderIndex` 로 한 번 정렬한다 — 같은 rng 면 **입력 배열 순서와 무관하게**
  // 같은 결과가 나와야 재현(테스트·버그 신고)이 가능하다
  const shuffled = keys.map((k) =>
    shuffle(
      [...blocks.get(k)!].sort((a, b) => a.orderIndex - b.orderIndex),
      rng,
    ),
  )
  const shuffledLoose = shuffle(
    [...loose].sort((a, b) => a.orderIndex - b.orderIndex),
    rng,
  )

  // 미분류도 **하나의 블록으로** 상한 배분에 참여한다 — 안 그러면 상한을 걸 때
  // 미분류가 전멸하거나(앞에서 자름) 혼자 살아남는다.
  const groups = shuffledLoose.length > 0 ? [...shuffled, shuffledLoose] : shuffled
  const quota = allocate(
    groups.map((g) => g.length),
    limit,
  )
  const trimmed = groups.map((g, i) => g.slice(0, quota[i]))

  const arc = (shuffledLoose.length > 0 ? trimmed.slice(0, -1) : trimmed).flat()
  const trimmedLoose = shuffledLoose.length > 0 ? trimmed[trimmed.length - 1] : []
  return spreadLoose(arc, trimmedLoose)
}

/**
 * 시험 문제를 산출한다 — **반환 순서가 곧 시험 순서**다.
 * 시작 시 한 번 부르고 호출측이 state 로 고정한다 (진행 중 목록이 바뀌어도 안 흔들리게).
 */
export function buildExamQuestions(
  questions: InterviewPrepQuestion[],
  settings: ExamSettings,
  rng: () => number = Math.random,
): InterviewPrepQuestion[] {
  const pool = filterExamQuestions(questions, settings)
  const limit =
    settings.count === 'all'
      ? pool.length
      : Math.min(settings.count, pool.length)
  if (limit === 0) return []

  if (settings.order === 'random') return shuffle(pool, rng).slice(0, limit)
  if (settings.order === 'flow') return buildFlowOrder(pool, limit, rng)
  // 차례 = 세션 목록과 같은 순서. 앞에서 N개 (목록을 위에서부터 훑는 것과 같다)
  return [...pool].sort(compareByInterviewFlow).slice(0, limit)
}
