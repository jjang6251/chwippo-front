import { create } from 'zustand'
import { jobPostingCardApi } from '@/api/jobPosting'
import type { FromPostingResult, PendingPostingDraft } from '@/api/jobPosting'
import type { Application } from '@/types/application'

/**
 * 「생성 중」 카드들 — 공고를 붙인 뒤 카드가 될 때까지의 상태.
 *
 * ## 왜 스토어인가
 *
 * 모달은 「카드 만들기」를 누른 **즉시 닫힌다.** 그러면 진행 중인 일이 어느 컴포넌트에도
 * 속하지 않게 되는데, 사용자는 그 사이 캘린더로 넘어갔다 돌아올 수 있다. 화면 밖에 있는
 * 동안에도 살아 있어야 하는 상태라 전역이다 (`celebrationStore` 와 같은 성격).
 *
 * ## 배열인 이유 — 「카드는 병렬, 시트는 직렬」
 *
 * 공고 3개를 연달아 붙이는 건 실제로 하는 행동이다. 카드는 동시에 만들되(≤3) 결과 시트는
 * 한 번에 하나만 띄운다 — 시트가 겹치면 방금 만든 게 뭔지 알 수 없다. 시트를 못 띄운 카드는
 * 토스트로 알리고 검토는 카드 상세 확인 줄이 받는다.
 *
 * ## 🔴 진짜 방어는 서버에 있다
 *
 * 여기 해시 중복 차단·동시 3장은 **손이 미끄러진 경우**를 막는 보조다. 새로고침하면 이
 * 스토어는 통째로 사라지므로, 같은 원문 재요청·진행 중 상한은 서버가 따로 막는다
 * (`textHash` 10분 · in-flight 3건). 여기 값을 늘린다고 서버 한도가 늘지 않는다.
 */

export type PendingStatus =
  | 'parsing'
  /** 회사명만 물으면 된다 — 나머지 파싱 결과는 서버 초안에 이미 있다 */
  | 'needs-company'
  /** 부문이 여럿 — 고른 직무로 2차 파싱 후 생성 */
  | 'needs-job'
  | 'failed'

/** 실패는 **두 종류**다 — 다음 행동이 다르므로 뭉치지 않는다 */
export type PendingFailure =
  /** 공고로 안 보인다 → 찾은 값 채운 직접 입력으로 */
  | 'not-posting'
  /** 서버·한도·동의 문제 → 다시 시도 (붙인 글 보존) */
  | 'error'

export interface PendingCardEntry {
  tempId: string
  /** 클라 중복 차단용 원문 해시 (보조 — 위 주석) */
  textHash: string
  /**
   * 붙인 원문. **실패했을 때만 쓸모가 있다** — 다시 시도·직접 입력 폴백.
   * 카드가 만들어지면 엔트리째 사라지므로 메모리에도 남지 않는다.
   */
  rawText: string
  status: PendingStatus
  /**
   * 서버 초안 참조. 🔴 보완 질문·2차 파싱은 **이 값만** 보낸다 —
   * 초안 본문을 클라가 되돌려 보내면 조작된 초안으로 카드를 만들 수 있다.
   */
  hash: string | null
  /** 직무 후보 (공고 표기 그대로) */
  candidates: string[]
  /** 파서가 찾아 둔 값 — 「회사·전형·날짜는 이미 준비됐어요」를 말할 수 있게 */
  companyName: string | null
  jobTitle: string | null
  failure: PendingFailure | null
  /** 서버가 준 문구 — 있으면 우리 기본 문구보다 우선한다 */
  reason: string | null
  /** 「조금 오래 걸리네요」 판정 기준 (ms epoch) */
  startedAt: number
  /** 데모 — 백엔드 호출 0, 고정 응답으로 흉내만 낸다 */
  demo: boolean
}

/** 시작 실패 이유 — 모달이 그대로 문구로 쓴다 */
export type StartRejection = 'limit' | 'duplicate'

export const MAX_CONCURRENT_PENDING = 3
/** 같은 글을 1분 안에 다시 붙이면 「방금 만든 공고예요」 */
export const DUPLICATE_WINDOW_MS = 60_000
/** 이 시간을 넘기면 「조금 오래 걸리네요 — 곧 돼요」 */
export const SLOW_AFTER_MS = 8_000

/**
 * 원문 해시 — **보안용이 아니라 오타 방지용**이라 crypto 를 부르지 않는다.
 * (동기 함수여야 하고, 값은 이 브라우저 안에서만 쓰인다. FNV-1a 32bit)
 */
export function hashText(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

interface RecentHash {
  hash: string
  at: number
}

/**
 * 만들어진 카드 — **뒤처리 대기열**.
 *
 * 캐시 갱신·결과 시트·토스트·네이티브 알림 트리거는 훅과 라우터가 필요해서 스토어가
 * 직접 못 한다. 그렇다고 요청을 건 컴포넌트(닫힌 모달)에 맡기면 언마운트 뒤 실행이라
 * 위험하다. 결과만 여기 쌓고 호스트(`PostingCardHost`)가 하나씩 꺼내 처리한다.
 *
 * 🔴 **`demo` 는 꼬리표가 아니라 주소다.** 데모 라우트는 **별도 `QueryClient`** 를 쓴다
 * (`DemoShell` 의 `demoQueryClient` — 데모 데이터가 본앱 캐시에 남지 않게). 그래서 호스트도
 * 스코프마다 하나씩 있고, 각자 **자기 스코프 항목만** 집어야 한다. 앱 호스트가 데모 카드를
 * 집으면 앱 클라이언트에 캐시를 심고 앱 목록에서 그 카드를 찾다 못 찾아 시트를 즉시 닫는다
 * (2026-08-29 데모 실측 결함).
 */
export interface CompletedCard {
  card: Application
  demo: boolean
  /** 첫 스텝에 날짜가 있었나 — 네이티브 알림 soft-ask 트리거 판정 */
  hasDeadline: boolean
}

interface PendingCardState {
  entries: PendingCardEntry[]
  /** 최근 붙인 글 (엔트리가 사라진 뒤에도 1분간 기억) */
  recent: RecentHash[]
  /** 결과 시트가 잡고 있는 카드 — 한 번에 하나 */
  sheetAppId: string | null
  /** 그 시트가 **어느 스코프 것인가** — 다른 스코프 호스트는 렌더하지 않는다 */
  sheetDemo: boolean
  completed: CompletedCard[]
  pushCompleted: (c: CompletedCard) => void
  /** 내 스코프의 첫 항목을 **꺼내면서 제거**한다. 없으면 null (남의 것은 건드리지 않는다) */
  takeCompleted: (demo: boolean) => CompletedCard | null

  start: (input: {
    rawText: string
    demo?: boolean
    now?: number
  }) => { tempId: string } | { rejected: StartRejection }
  /** 서버 응답 반영 — 카드 생성 성공은 여기가 아니라 `remove` 로 끝난다 */
  applyResult: (tempId: string, result: FromPostingResult) => void
  /** 2차 요청(회사명 commit · 직무 선택)을 보내는 동안 다시 「생성 중」으로 */
  markParsing: (tempId: string) => void
  fail: (tempId: string, failure: PendingFailure, reason?: string | null) => void
  remove: (tempId: string) => void
  /** 새로고침 복원 — 서버가 들고 있는 보완 대기 초안을 카드로 되살린다 */
  restore: (drafts: PendingPostingDraft[], now?: number) => void
  /** 시트를 잡는다. 이미 누가 잡고 있으면 false (호출부가 토스트로 폴백) */
  openSheet: (appId: string, demo: boolean) => boolean
  closeSheet: () => void
  reset: () => void
}

let seq = 0
const nextTempId = () => `pending-${Date.now().toString(36)}-${++seq}`

/** 진행 중으로 세는 상태 — 실패한 카드는 자리를 차지하지 않는다 (사용자가 치울 때까지 남아 있을 뿐) */
const isBusy = (e: PendingCardEntry) => e.status !== 'failed'

export const usePendingCardStore = create<PendingCardState>((set, get) => ({
  entries: [],
  recent: [],
  sheetAppId: null,
  sheetDemo: false,
  completed: [],

  pushCompleted: (c) => set((s) => ({ completed: [...s.completed, c] })),

  takeCompleted: (demo) => {
    const { completed } = get()
    const idx = completed.findIndex((c) => c.demo === demo)
    if (idx === -1) return null
    set({ completed: completed.filter((_, i) => i !== idx) })
    return completed[idx]
  },

  start: ({ rawText, demo = false, now = Date.now() }) => {
    const textHash = hashText(rawText)
    const state = get()
    const recent = state.recent.filter((r) => now - r.at < DUPLICATE_WINDOW_MS)
    if (recent.some((r) => r.hash === textHash)) {
      set({ recent })
      return { rejected: 'duplicate' }
    }
    if (state.entries.filter(isBusy).length >= MAX_CONCURRENT_PENDING) {
      set({ recent })
      return { rejected: 'limit' }
    }
    const tempId = nextTempId()
    set({
      recent: [...recent, { hash: textHash, at: now }],
      entries: [
        ...state.entries,
        {
          tempId,
          textHash,
          rawText,
          status: 'parsing',
          hash: null,
          candidates: [],
          companyName: null,
          jobTitle: null,
          failure: null,
          reason: null,
          startedAt: now,
          demo,
        },
      ],
    })
    return { tempId }
  },

  applyResult: (tempId, result) =>
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.tempId !== tempId) return e
        switch (result.kind) {
          case 'needs':
            return {
              ...e,
              status: result.needs === 'company' ? 'needs-company' : 'needs-job',
              hash: result.hash,
              candidates: result.candidates,
              failure: null,
              reason: null,
            }
          case 'notPosting':
            return { ...e, status: 'failed', failure: 'not-posting', reason: null }
          case 'blocked':
            return {
              ...e,
              status: 'failed',
              failure: 'error',
              reason: result.reason,
            }
          case 'card':
            // 카드가 생겼으면 이 엔트리는 할 일이 끝났다 — 호출부가 `remove` 로 지운다
            return e
        }
      }),
    })),

  markParsing: (tempId) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.tempId === tempId
          ? { ...e, status: 'parsing', failure: null, reason: null, startedAt: Date.now() }
          : e,
      ),
    })),

  fail: (tempId, failure, reason = null) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.tempId === tempId ? { ...e, status: 'failed', failure, reason } : e,
      ),
    })),

  remove: (tempId) =>
    set((s) => ({ entries: s.entries.filter((e) => e.tempId !== tempId) })),

  restore: (drafts, now = Date.now()) =>
    set((s) => {
      const known = new Set(s.entries.map((e) => e.hash).filter(Boolean))
      const revived: PendingCardEntry[] = []
      for (const d of drafts) {
        if (known.has(d.hash)) continue
        if (s.entries.length + revived.length >= MAX_CONCURRENT_PENDING) break
        revived.push({
          tempId: nextTempId(),
          // 🔴 원문은 서버에도 우리에게도 없다 — 복원된 카드는 「다시 시도」를 줄 수 없고
          //    보완 질문에 답하는 것(hash 참조)만 할 수 있다.
          textHash: '',
          rawText: '',
          status: d.needs === 'company' ? 'needs-company' : 'needs-job',
          hash: d.hash,
          candidates: d.candidates,
          companyName: d.companyName,
          jobTitle: d.jobTitle,
          failure: null,
          reason: null,
          startedAt: now,
          demo: false,
        })
      }
      return revived.length ? { entries: [...s.entries, ...revived] } : s
    }),

  openSheet: (appId, demo) => {
    if (get().sheetAppId) return false
    set({ sheetAppId: appId, sheetDemo: demo })
    return true
  },

  closeSheet: () => set({ sheetAppId: null, sheetDemo: false }),

  reset: () =>
    set({ entries: [], recent: [], sheetAppId: null, sheetDemo: false, completed: [] }),
}))

/** 컴포넌트 밖(모달 onSuccess 등)에서 쓰는 손잡이 */
export const pendingCards = {
  start: (input: { rawText: string; demo?: boolean }) =>
    usePendingCardStore.getState().start(input),
  applyResult: (tempId: string, result: FromPostingResult) =>
    usePendingCardStore.getState().applyResult(tempId, result),
  fail: (tempId: string, failure: PendingFailure, reason?: string | null) =>
    usePendingCardStore.getState().fail(tempId, failure, reason),
  remove: (tempId: string) => usePendingCardStore.getState().remove(tempId),
}

// ── 실행기 ───────────────────────────────────────────────────
//
// 🔴 **훅이 아니라 모듈 함수다.** 「카드 만들기」를 누르면 모달이 즉시 닫히는데, 요청을
// 컴포넌트 훅에 매달면 언마운트 뒤에 결과를 받는 모양이 된다. 여기서는 스토어만 건드리고,
// 화면 뒤처리는 `completed` 대기열을 통해 전역 호스트가 받는다.

/** 데모 = 2초 흉내. 실제 파싱 체감(2~4초)과 같은 자리에 두기 위한 값 */
const DEMO_DELAY_MS = 2000

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function finish(tempId: string, result: FromPostingResult, demo: boolean) {
  const store = usePendingCardStore.getState()
  if (result.kind === 'card') {
    const hasDeadline = result.card.steps.some((s) => !!s.scheduledDate)
    store.pushCompleted({ card: result.card, demo, hasDeadline })
    store.remove(tempId)
    return
  }
  store.applyResult(tempId, result)
}

/**
 * 데모 흐름 — 백엔드 요청 0.
 * `import()` 로 늦게 부른다: 데모 픽스처를 정적으로 물면 본 서비스 번들에 샘플 데이터가 들어간다.
 */
async function runDemo(tempId: string) {
  await wait(DEMO_DELAY_MS)
  if (!usePendingCardStore.getState().entries.some((e) => e.tempId === tempId)) return
  const demoStore = await import('@/demo/demoStore')
  const card = demoStore.createApplicationFromPosting()
  finish(tempId, { kind: 'card', card }, true)
}

/** 붙인 원문 → 카드 (1차 호출) */
export async function runPostingParse(
  tempId: string,
  input: { rawText: string; demo?: boolean },
): Promise<void> {
  if (input.demo) return runDemo(tempId)
  try {
    const result = await jobPostingCardApi.parse({ rawText: input.rawText })
    finish(tempId, result, false)
  } catch {
    // 400(길이)·네트워크 — 인터셉터가 이미 토스트를 띄웠을 수 있으므로 카드 문구만 남긴다
    usePendingCardStore.getState().fail(tempId, 'error')
  }
}

/**
 * 보완 답 → 카드 (2차 호출).
 *
 * ## 🔴 직무는 **재파싱**, 회사명은 **재파싱 없음** — 경로가 다르다
 *
 * 부문마다 요건이 통째로 다르다(「사무영업(IT)」와 「차량(전기)」). 그래서 직무를 고르면
 * 그 직무를 컨텍스트로 **원문을 다시 파싱**해야 요건이 맞는다 → `POST /from-posting`.
 * 회사명은 요건에 영향이 없으므로 서버 초안 그대로 만든다 → `commit`(호출 0).
 *
 * ⚠️ **서버는 원문을 보관하지 않는다.** 새로고침으로 복원된 카드는 우리 쪽에도 원문이 없어
 * 재파싱이 불가능하고, 그때만 `commit({hash, jobContext})` 로 **전체 공고 기준 요건**을
 * 받는다 — 요건이 덜 맞더라도 카드가 안 만들어지는 것보다 낫다.
 *
 * `hash` 는 언제나 서버 초안 **참조**다. 초안 본문을 클라가 되돌려 보내지 않는다.
 */
export async function runPostingCommit(
  tempId: string,
  input: { hash: string; companyName?: string; jobContext?: string; demo?: boolean },
): Promise<void> {
  const store = usePendingCardStore.getState()
  const rawText = store.entries.find((e) => e.tempId === tempId)?.rawText ?? ''
  store.markParsing(tempId)
  if (input.demo) return runDemo(tempId)
  try {
    const result =
      input.jobContext && rawText
        ? await jobPostingCardApi.parse({ rawText, jobContext: input.jobContext })
        : await jobPostingCardApi.commit({
            hash: input.hash,
            ...(input.companyName ? { companyName: input.companyName } : {}),
            ...(input.jobContext ? { jobContext: input.jobContext } : {}),
          })
    finish(tempId, result, false)
  } catch {
    usePendingCardStore.getState().fail(tempId, 'error')
  }
}
