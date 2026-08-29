/**
 * 「공고로 만들기」의 **한 번만 하는 말들** — NEW 알약 · 첫 열림 캡션 · 타이밍 넛지 · 마지막 모드.
 *
 * ## 왜 한곳에 모으나
 *
 * 넷 다 「이 사람에게 이미 했나」를 묻는다. 판정이 컴포넌트 안에 흩어지면 조건이 하나
 * 바뀔 때마다 어디를 고쳐야 하는지 알 수 없고, 무엇보다 **테스트할 자리가 없어진다** —
 * 실제로 이 기능에서 가장 자주 틀릴 곳이 「두 번 뜬다」/「영영 안 뜬다」다.
 *
 * ## 🔴 저장 못 하는 환경은 「이미 봤음」으로 답한다
 *
 * 사파리 프라이빗 등에서 저장이 실패하면 「아직 안 봤음」으로 답하는 쪽이 **모달을 열 때마다**
 * 같은 캡션을 띄운다. 한 번 못 보는 것보다 매번 보는 게 훨씬 나쁘다
 * (`researchIntro`·`stepNodeHint` 와 같은 판단).
 *
 * ## NEW 알약의 소거 조건 2개는 성격이 다르다
 *
 * - **공고 카드를 1장이라도 만들었다** → 사용자 단위 사실이라 서버 데이터(`postingMeta`)로 본다.
 *   localStorage 로 기억하면 기기를 바꿨을 때 이미 써 본 기능에 NEW 가 다시 붙는다.
 * - **출시 60일 경과** → 「새 기능」이라는 말의 유통기한. 아무도 안 눌러도 내려간다.
 */
import { addDays, todayLocal, type Tz } from '@/utils/datetime'
import type { Application } from '@/types/application'

/** 이 기능이 사용자에게 처음 보인 날 (KST) */
export const POSTING_RELEASE_DATE = '2026-08-29'
/** 「새 기능」이라고 부를 수 있는 기간 */
export const POSTING_NEW_DAYS = 60
/** 이 날짜까지만 NEW 가 붙는다 (이 날 포함) */
export const POSTING_NEW_UNTIL = addDays(POSTING_RELEASE_DATE, POSTING_NEW_DAYS)

/** 카드 목록에 공고로 만든 카드가 하나라도 있나 — NEW 소거 조건 ① */
export function hasPostingCard(applications: Application[] | undefined): boolean {
  if (!applications) return false
  return applications.some((a) => !!a.postingMeta)
}

/**
 * NEW 알약을 붙일까.
 *
 * @param applications 카드 목록 (없으면 「아직 모른다」 = 붙인다 — 목록이 늦게 와도 깜빡이지 않게
 *   소비처가 로딩 중엔 이 판정을 미룬다)
 */
export function shouldShowPostingNewPill(
  applications: Application[] | undefined,
  tz?: Tz,
): boolean {
  if (hasPostingCard(applications)) return false
  return todayLocal(tz) <= POSTING_NEW_UNTIL
}

// ── 사용자별 1회 기억 ────────────────────────────────────────

function readOnce(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return true // 위 주석 — 판정 불가는 「이미 봤음」
  }
}

function writeOnce(key: string): void {
  try {
    localStorage.setItem(key, new Date().toISOString())
  } catch {
    /* best-effort */
  }
}

const HINT_KEY = (userId: string) => `posting_hint_seen_${userId}`
const NUDGE_KEY = (userId: string) => `posting_nudge_seen_${userId}`
const MODE_KEY = (userId: string) => `posting_last_mode_${userId}`

/** 토글 아래 첫 열림 캡션을 이미 봤나 */
export function hasSeenPostingHint(userId: string | undefined): boolean {
  if (!userId) return true
  return readOnce(HINT_KEY(userId))
}
export function markPostingHintSeen(userId: string | undefined): void {
  if (!userId) return
  writeOnce(HINT_KEY(userId))
}

/** 직접 입력에서 마감일·전형 칩을 펼쳤을 때 뜨는 넛지를 이미 봤나 */
export function hasSeenPostingNudge(userId: string | undefined): boolean {
  if (!userId) return true
  return readOnce(NUDGE_KEY(userId))
}
export function markPostingNudgeSeen(userId: string | undefined): void {
  if (!userId) return
  writeOnce(NUDGE_KEY(userId))
}

// ── 마지막 모드 기억 ────────────────────────────────────────

export type AddCardMode = 'manual' | 'posting'

/**
 * 마지막에 쓴 모드. 🔴 **기본은 언제나 직접 입력**이다 — 기억이 없거나 못 읽으면
 * 붙여넣기 칸이 아니라 익숙한 폼이 열려야 한다.
 */
export function loadAddCardMode(userId: string | undefined): AddCardMode {
  if (!userId) return 'manual'
  try {
    return localStorage.getItem(MODE_KEY(userId)) === 'posting' ? 'posting' : 'manual'
  } catch {
    return 'manual'
  }
}

export function saveAddCardMode(userId: string | undefined, mode: AddCardMode): void {
  if (!userId) return
  try {
    localStorage.setItem(MODE_KEY(userId), mode)
  } catch {
    /* best-effort */
  }
}
