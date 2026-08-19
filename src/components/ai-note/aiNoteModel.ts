import type {
  NoteAiActionKind,
  NoteAiHistoryItem,
} from '@/api/noteAiAction'
import type { AiRange } from './editorBridge'

/**
 * 노트 AI 패널의 값·모델 — 컴포넌트가 아니라 여기서 한 벌로 정한다.
 * 라벨·상한·컨텍스트 조립 규칙을 화면 여러 곳이 각자 들고 있으면 조용히 갈린다.
 */

/* 코인은 토큰 환산 차감 (2026-08-19 D1 개정 — 고정 2 → 기본 방식 복귀).
   버튼에 정액을 표기하지 않는다 — 잔여는 헤더 CoinChip 이 보여준다 */

/** 서버 class-validator 캡과 같은 값 — 한쪽만 바꾸면 다 쓰고 나서 400 을 만난다 */
export const SELECTION_MAX_CHARS = 6000
export const INSTRUCTION_MAX_CHARS = 500

/** 프롬프트에 실어 보내는 최근 턴 수 (4턴째부터 오래된 것 제외) */
export const HISTORY_TURNS = 3

export interface AiActionChip {
  action: NoteAiActionKind
  label: string
  /** 툴팁 — 무엇이 달라지는지 한 줄 */
  desc: string
  /** 선택이 있어야 의미가 있는 액션인가 */
  requiresSelection: boolean
}

/**
 * 액션 5종. `free` 는 칩을 눌러도 바로 요청하지 않고 **지시 입력으로 포커스를 옮긴다** —
 * 무엇을 시킬지 없이 보낼 수 없는 유일한 액션이라서다.
 */
export const AI_ACTION_CHIPS: AiActionChip[] = [
  {
    action: 'easy',
    label: '쉽게 풀어쓰기',
    desc: '어려운 문장을 풀어서 다시 씁니다',
    requiresSelection: true,
  },
  {
    action: 'concise',
    label: '간결히',
    desc: '군더더기를 덜어 짧게 만듭니다',
    requiresSelection: true,
  },
  {
    action: 'table',
    label: '표로 정리',
    desc: '항목·기준이 있는 내용을 표로 바꿉니다',
    requiresSelection: true,
  },
  {
    action: 'qa_toggle',
    label: '토글 문답',
    desc: '접었다 펴며 답을 맞혀 보는 문답으로 바꿉니다',
    requiresSelection: true,
  },
  {
    action: 'free',
    label: '자유 지시',
    desc: '원하는 걸 직접 적어 시킵니다',
    requiresSelection: false,
  },
]

export function actionLabel(action: NoteAiActionKind): string {
  return AI_ACTION_CHIPS.find((c) => c.action === action)?.label ?? action
}

export type TurnStatus = 'running' | 'done' | 'error'

/** 결과를 어떻게 처리했는가 — 같은 결과에 두 번 적용하지 않게 잠근다 */
export type TurnApplied = 'replace' | 'insert' | 'discard'

export interface AiTurn {
  id: string
  action: NoteAiActionKind
  /** 사용자가 적은 자유 지시·이어서 고치기 (없으면 프리셋 액션) */
  instruction?: string
  status: TurnStatus
  markdown?: string
  cached?: boolean
  /** 출력 한도에서 잘렸다 — 결과는 쓸 수 있지만 뒷부분이 없다 */
  truncated?: boolean
  /** 실패 시 사용자에게 보일 문구 (서버 우선) */
  error?: string
  /** 선택 기반이면 요청 시점의 범위, 생성이면 null */
  target: AiRange | null
  /** 요청 시점에 직렬화한 선택 마크다운 — 재시도가 같은 입력을 다시 보낸다 */
  selectionMd?: string
  /** 요청 시점의 본문 버전 — 이후 편집되면 [교체] 를 잠근다 */
  docVersion: number
  applied?: TurnApplied
}

/** 요청·결과를 사용자가 알아볼 한 줄로 (히스토리 머리글) */
export function turnTitle(turn: AiTurn): string {
  if (turn.action === 'free') return turn.instruction?.trim() || '자유 지시'
  return turn.instruction?.trim()
    ? `${actionLabel(turn.action)} · ${turn.instruction.trim()}`
    : actionLabel(turn.action)
}

/**
 * 프롬프트 컨텍스트 조립 — **최근 3턴만** 보낸다.
 *
 * 🔴 실패한 턴은 넣지 않는다. 결과가 없는 요청을 문맥이라고 보내면 모델이 "아까 그것"을
 * 존재하지 않는 답으로 이어 받는다.
 */
export function buildHistory(turns: AiTurn[]): NoteAiHistoryItem[] {
  const usable = turns.filter((t) => t.status === 'done' && t.markdown)
  return usable.slice(-HISTORY_TURNS).flatMap((t): NoteAiHistoryItem[] => [
    { role: 'user', text: turnTitle(t) },
    { role: 'result', text: t.markdown! },
  ])
}

/** 선택 미리보기 칩에 넣을 요약 — 줄바꿈을 접고 앞부분만 */
export function previewText(markdown: string, max = 120): string {
  const flat = markdown.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}
