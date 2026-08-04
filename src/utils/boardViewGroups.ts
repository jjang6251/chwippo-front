import type { Application } from '@/types/application'
import { calcDday } from '@/utils/dday'

/**
 * A11 — 보드 뷰 3종 토글 공용 로직.
 *
 * - 뷰 종류(card/list/group) + localStorage 저장/복원
 * - 그룹 판정: status 우선 → 진행 중은 현재 스텝으로 (결과 대기 / 서류 / 면접·시험)
 * - 리스트 행 스텝 칩 라벨·톤, D-day 대상 날짜
 *
 * 그룹 판정 철학은 알림 백엔드 classifyBriefingEventKind(이름 기반 최소 매핑)과 동일하되
 * 프론트 독립 구현 — 여기선 status + step.orderIndex 만으로 결정(이름 파싱 X).
 */

export type BoardView = 'card' | 'list' | 'group'

export const BOARD_VIEW_STORAGE_KEY = 'board:view:v1'

const VALID_VIEWS: readonly BoardView[] = ['card', 'list', 'group']

/** localStorage 에서 뷰 복원. 없거나 잘못된 값이면 기본값 'card'. */
export function loadBoardView(): BoardView {
  try {
    const raw = localStorage.getItem(BOARD_VIEW_STORAGE_KEY)
    if (raw && (VALID_VIEWS as readonly string[]).includes(raw)) {
      return raw as BoardView
    }
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) → 기본값 */
  }
  return 'card'
}

export function saveBoardView(view: BoardView): void {
  try {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, view)
  } catch {
    /* 저장 실패는 조용히 무시 (뷰는 여전히 세션 내 유지) */
  }
}

function sortedSteps(app: Application) {
  return [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
}

/**
 * 결과 대기 판정 — IN_PROGRESS + 마지막 스텝 + 그 스텝 예정일이 오늘 이전.
 *
 * 🔴 **이 함수가 유일한 구현이다.** 예전엔 CompanyCard·BoardDetail 이 같은 식을
 * 각자 인라인으로 갖고 있었고(주석에도 "동일" 이라 적혀 있었다), 셋 다 로컬 TZ 를 타서
 * **비KST 기기에서 하루 일찍 "결과 입력하세요" 가 떴다.** 한 곳만 고치면 나머지가 남는다.
 *
 * `scheduled_date` 는 `timestamptz` 라 API 가 `2026-08-13T15:00:00Z`(= KST 8/14) 를 준다.
 * 지남 판정은 KST 날짜 기준이어야 하므로 `calcDday` 에 위임한다.
 * (날짜가 아닌 값이면 `calcDday` 가 `NaN` → `NaN < 0` 은 false → 오유도 안 뜸)
 */
export function needsResult(app: Application): boolean {
  if (app.status !== 'IN_PROGRESS') return false
  const steps = sortedSteps(app)
  const isLastStep = steps.length > 0 && app.currentStepIndex === steps.length - 1
  const scheduled = steps[app.currentStepIndex]?.scheduledDate
  const stepDatePassed = !!scheduled && calcDday(scheduled) < 0
  return isLastStep && stepDatePassed
}

export type BoardGroupKey =
  | 'interview'
  | 'document'
  | 'waiting'
  | 'planned'
  | 'passed'
  | 'failed'

/**
 * 단계 그룹 판정.
 * status 우선(PASSED→합격 · FAILED→불합격 · PLANNED→지원 예정) →
 * IN_PROGRESS 는 현재 스텝으로: 마지막 스텝 날짜 경과=결과 대기 / orderIndex 0=서류 / 그 외=면접·시험.
 */
export function getBoardGroupKey(app: Application): BoardGroupKey {
  if (app.status === 'PASSED') return 'passed'
  if (app.status === 'FAILED') return 'failed'
  if (app.status === 'PLANNED') return 'planned'
  // IN_PROGRESS
  if (needsResult(app)) return 'waiting'
  const currentStep = sortedSteps(app)[app.currentStepIndex]
  if (!currentStep || currentStep.orderIndex === 0) return 'document'
  return 'interview'
}

export interface BoardGroupMeta {
  key: BoardGroupKey
  icon: string
  label: string
}

/** 그룹 렌더 순서. 불합격(💪)은 FAILED 탭에서만 등장(전체 탭은 FAILED 제외). */
export const BOARD_GROUP_ORDER: readonly BoardGroupMeta[] = [
  { key: 'interview', icon: '🎯', label: '면접·시험' },
  { key: 'document', icon: '📄', label: '서류' },
  { key: 'waiting', icon: '⏳', label: '결과 대기' },
  { key: 'planned', icon: '🗓️', label: '지원 예정' },
  { key: 'passed', icon: '🎉', label: '합격' },
  { key: 'failed', icon: '💪', label: '불합격' },
]

export interface BoardGroup extends BoardGroupMeta {
  items: Application[]
}

/**
 * 입력 순서(= sortApplications 결과)를 그룹 내에서 보존하며 그룹핑.
 * 빈 그룹은 제외 → 렌더 시 숨김.
 */
export function groupApplications(apps: Application[]): BoardGroup[] {
  const buckets = new Map<BoardGroupKey, Application[]>()
  for (const app of apps) {
    const key = getBoardGroupKey(app)
    const arr = buckets.get(key)
    if (arr) arr.push(app)
    else buckets.set(key, [app])
  }
  return BOARD_GROUP_ORDER.map((meta) => ({
    ...meta,
    items: buckets.get(meta.key) ?? [],
  })).filter((group) => group.items.length > 0)
}

export type StepChipTone = 'warning' | 'success' | 'neutral'

export interface StepChip {
  label: string
  tone: StepChipTone
}

/**
 * 리스트 뷰 현재 스텝 칩.
 * 결과 대기=warning · 합격=success · 그 외(진행 스텝명·지원 예정·불합격)=neutral(surface-3).
 */
export function getStepChip(app: Application): StepChip {
  if (app.status === 'PASSED') return { label: '최종 합격', tone: 'success' }
  if (app.status === 'FAILED') return { label: '불합격', tone: 'neutral' }
  if (app.status === 'PLANNED') return { label: '지원 예정', tone: 'neutral' }
  if (needsResult(app)) return { label: '결과 대기', tone: 'warning' }
  const currentStep = sortedSteps(app)[app.currentStepIndex]
  return { label: currentStep?.name ?? '진행 중', tone: 'neutral' }
}

/**
 * D-day 배지 대상 날짜 — 현재 스텝 예정일. 합격·불합격은 배지 없음.
 * CompanyCard 의 ddayTarget 규칙과 동일.
 */
export function getDdayTarget(app: Application): string | null {
  if (app.status === 'PASSED' || app.status === 'FAILED') return null
  return sortedSteps(app)[app.currentStepIndex]?.scheduledDate ?? null
}
