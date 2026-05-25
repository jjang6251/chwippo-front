import type { Activity, ActivityLog } from '@/types/activity'
import {
  getWeekMonday,
  isThisWeek,
  toLocalDateString,
  todayLocal,
} from '@/utils/datetime'
import { REFLECTION_PROMPTS } from './constants'

// ────────────────────────────────────────────────────────────────────────
// Re-export — Activity 모듈 내부에서 임포트 경로 통일용 (기존 사용처 호환).
// 새 코드는 `@/utils/datetime` 에서 직접 import 권장.
// ────────────────────────────────────────────────────────────────────────
export {
  APP_TIMEZONE,
  escapeHtml,
  formatWeekLabel,
  getWeekMonday,
  getWeekSunday,
  isThisWeek,
  toLocalDateString,
  todayLocal,
} from '@/utils/datetime'

/** alias — Activity 모듈에서 쓰던 이름 보존 */
export const getISOWeekMonday = getWeekMonday

// ────────────────────────────────────────────────────────────────────────
// Activity 도메인 전용 헬퍼
// ────────────────────────────────────────────────────────────────────────

/** mock 의 isActivityOngoing — end 없거나 미래면 ongoing */
export function isActivityOngoing(act: Activity): boolean {
  if (act.archivedAt) return false
  if (!act.endedAt) return true
  return act.endedAt >= todayLocal()
}

/** mock formatPeriod 1:1 */
export function formatPeriod(act: Activity): string {
  if (!act.startedAt && !act.endedAt) return ''
  const start = act.startedAt ? act.startedAt.slice(0, 7).replace('-', '.') : ''
  if (!act.endedAt) {
    return start ? `${start} ~ 진행 중` : '진행 중'
  }
  const end = act.endedAt.slice(0, 7).replace('-', '.')
  return start ? `${start} ~ ${end}` : end
}

export function extractNoteText(
  note: Record<string, unknown> | null | undefined,
): string {
  if (!note) return ''
  const parts: string[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    const obj = n as Record<string, unknown>
    if (typeof obj.text === 'string') parts.push(obj.text)
    const content = obj.content
    if (Array.isArray(content)) content.forEach(walk)
  }
  walk(note)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function logDateLabel(log: ActivityLog): string {
  return log.occurredAt.slice(5).replace('-', '.')
}

// ────────────────────────────────────────────────────────────────────────
// Quick log 자동 매핑 (B.5)
// ────────────────────────────────────────────────────────────────────────

/** mock 의 5분 윈도우 — "방금 입력한 활동" 으로 fallback 가능한 기간 */
export const RECENT_USE_WINDOW_MS = 5 * 60 * 1000

/** 활동의 매칭용 별칭(토큰) 추출 — name/org/role 분리 */
export function extractActivityAliases(act: Activity): string[] {
  const aliases = new Set<string>()
  const addText = (text: string | null | undefined) => {
    if (!text) return
    const t = text.trim()
    if (t.length >= 2) aliases.add(t.toLowerCase())
    t.split(/[\s·,/]+/).forEach((tok) => {
      const clean = tok.replace(/[^\w가-힣]/g, '')
      if (clean.length >= 2) aliases.add(clean.toLowerCase())
    })
  }
  addText(act.name)
  addText(act.org)
  addText(act.role)
  return Array.from(aliases)
}

/** 활동 목록에서 content 와 매칭되는 활동을 score desc 로 반환 */
export function findMatchingActivities(
  content: string,
  activities: Activity[],
): Activity[] {
  const lower = (content ?? '').toLowerCase()
  const ongoing = activities.filter(isActivityOngoing)
  const scored = ongoing
    .map((a) => {
      let score = 0
      const name = (a.name ?? '').toLowerCase()
      const org = (a.org ?? '').toLowerCase()
      const role = (a.role ?? '').toLowerCase()
      if (name && lower.includes(name)) score += 12
      if (org && lower.includes(org)) score += 6
      if (role && lower.includes(role)) score += 3
      extractActivityAliases(a).forEach((tok) => {
        if (tok.length >= 2 && lower.includes(tok)) score += 3
      })
      return { a, score }
    })
    .filter((x) => x.score > 0)
  scored.sort((x, y) => y.score - x.score)
  return scored.map((x) => x.a)
}

export interface MappingResult {
  activity: Activity | null
  confidence: 'HIGH' | 'MID' | 'LOW'
  cands: Activity[]
}

/** content 입력에 대한 매핑 결과 + 확신도. MID = 5분 내 최근 사용 활동 fallback */
export function evalMappingConfidence(
  content: string,
  activities: Activity[],
  recent: { id: string | null; at: number } = { id: null, at: 0 },
): MappingResult {
  const cands = findMatchingActivities(content, activities)
  if (cands.length >= 1) {
    return { activity: cands[0], confidence: 'HIGH', cands }
  }
  if (recent.id && Date.now() - recent.at < RECENT_USE_WINDOW_MS) {
    const act = activities.find(
      (a) => a.id === recent.id && isActivityOngoing(a),
    )
    if (act) return { activity: act, confidence: 'MID', cands: [] }
  }
  return { activity: null, confidence: 'LOW', cands: [] }
}

/**
 * 오늘부터 역순으로 사용자가 "실제 활동 일지를 사용한 날" 의 연속 N일.
 * 기준: 각 log 의 `createdAt` (서버 timestamp) 을 KST 날짜로 변환.
 * - `occurred_at` (사건 발생일) 이 아닌 `createdAt` (작성 시각) 사용 — backdate 조작 무관
 * - 사용자가 과거·미래 날짜를 채워넣어도 streak 영향 없음 — "오늘 앱을 썼나" 라는 진짜 habit 신호
 * - 오늘 안 적었어도 어제부터는 카운트 (i>0 break)
 */
export function calcStreak(allLogs: ActivityLog[]): number {
  const usedDates = new Set(
    allLogs.map((l) => toLocalDateString(new Date(l.createdAt))),
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = toLocalDateString(d)
    if (usedDates.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

/** mock weeklyRotatingPrompt — 사용자 cl 분포 분석 후 부족 카테고리 우선, 동률은 주별 회전 */
export function weeklyRotatingPrompt(
  weekStart: string,
  allLogs: ActivityLog[],
): { cat: string; prompt: string } {
  const cats = [
    'job_competency',
    'collaboration',
    'challenge',
    'background',
    'personality',
    'own_strength',
  ]
  const counts: Record<string, number> = {}
  cats.forEach((c) => (counts[c] = 0))
  allLogs.forEach((l) =>
    (l.cl ?? []).forEach((c) => {
      if (counts[c] !== undefined) counts[c] += 1
    }),
  )
  const minCount = Math.min(...Object.values(counts))
  const candidates = cats.filter((c) => counts[c] === minCount)
  const weekNum = Math.floor(new Date(weekStart).getTime() / (7 * 86400000))
  const cat = candidates[Math.abs(weekNum) % candidates.length]
  const pool = REFLECTION_PROMPTS[cat] ?? []
  const prompt =
    pool[Math.abs(weekNum) % Math.max(1, pool.length)] ?? '✶ 이번주 어땠나요?'
  return { cat, prompt }
}

// `toLocalDateString` 도 Activity 모듈 안에서 쓰일 수 있으니 export (이미 re-export 됨)
void toLocalDateString
void isThisWeek
