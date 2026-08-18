import type { PrepHubGroup, StudyNoteFolder, StudyNoteListItem } from '@/api/studyNotes'
import { APP_TIMEZONE, formatMonthDay, toLocalDateString, type Tz } from '@/utils/datetime'

/**
 * 공부 노트 허브의 **순수 로직** — 검색·정렬·최근·시간 표기 + 기기 단위 선호 저장.
 *
 * 화면에서 떼어 둔 이유는 이 규칙들이 전부 "눈으로 보면 맞는 것 같은데 경계에서 틀리는"
 * 종류라서다 (빈 질의 · 무결과 · 폴더명만 맞는 경우 · 자정 넘긴 「어제」). spec 이 직접 부른다.
 */

// ── 화면 표기 ────────────────────────────────────────────────

/** 빈 제목은 서버에서 **정상 값**이다 — 화면에서만 대신 읽어 준다 (서버가 저장하면 못 지운다) */
export const UNTITLED_LABEL = '제목 없음'

export function isUntitled(title: string): boolean {
  return title.trim() === ''
}

export function noteTitleLabel(title: string): string {
  return isUntitled(title) ? UNTITLED_LABEL : title.trim()
}

/** 회사 이니셜 아바타 — 첫 글자 하나 (mockup 「삼」·「카」) */
export function companyInitial(companyName: string): string {
  return companyName.trim().charAt(0) || '·'
}

/** 'YYYY-MM-DD' 두 개의 일수 차 (a - b). TZ 무관 — 이미 KST 달력 날짜다 */
function ymdDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000)
}

/**
 * 수정 시각 표기 — 「방금 · N분 전 · N시간 전 · 어제 · N일 전 · 8월 3일」.
 *
 * 🔴 **「어제」는 시간 차가 아니라 KST 달력 날짜 차다.** 24시간으로 재면 밤 11시에 쓴 글을
 * 다음 날 아침에 「10시간 전」이라 부르게 된다 — 사람은 그걸 어제라고 부른다.
 * 미래 시각(기기 시계 어긋남)은 「방금」으로 접는다 — 음수 시간을 보여줄 이유가 없다.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
  tz: Tz = APP_TIMEZONE,
): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 60_000) return '방금'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}분 전`

  const todayYmd = toLocalDateString(now, tz)
  const thenYmd = toLocalDateString(then, tz)
  const days = ymdDiffDays(todayYmd, thenYmd)

  if (days <= 0) return `${Math.floor(diffMs / 3_600_000)}시간 전`
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return formatMonthDay(then, tz)
}

// ── 허브 모델 ────────────────────────────────────────────────

export type HubFilter = 'all' | 'study' | 'prep'

export const HUB_FILTERS: { value: HubFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'study', label: '공부 노트' },
  { value: 'prep', label: '회사 준비' },
]

export interface HubFolderGroup {
  folder: StudyNoteFolder
  notes: StudyNoteListItem[]
  /** 폴더 **이름**이 질의에 걸렸다 — 안의 노트를 전부 보여 준다 */
  matchedByName: boolean
}

export interface HubModel {
  folders: HubFolderGroup[]
  unfiled: StudyNoteListItem[]
  preps: PrepHubGroup[]
  /** 검색했는데 아무 것도 안 걸렸다 (질의가 비어 있으면 항상 false — 그건 빈 상태다) */
  noSearchResult: boolean
}

const byUpdatedDesc = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  b.updatedAt.localeCompare(a.updatedAt)

const HANGUL_FIRST_CHAR = /^[가-힣ㄱ-ㅎㅏ-ㅣ]/

/**
 * 가나다순 — 2차 드래그 정렬이 생기기 전까지 폴더의 **유일한 순서**다.
 *
 * 🔴 **영문·숫자를 한글 앞에 둔다.** ICU 의 한국어 정렬(`localeCompare(…, 'ko')`)은 한글을
 * 먼저 놓는데, 그러면 「CS 기초」가 「알고리즘」 뒤로 간다 — 윈도우 탐색기·맥 파인더의 한국어
 * 정렬과 반대라 사용자가 아는 순서가 아니다 (mockup 도 CS 기초 → 알고리즘 순).
 * 한글끼리·영문끼리는 그대로 ICU 에 맡긴다 (「ㄱ」·모음 자모까지 한글로 친다).
 */
const byNameKo = (a: StudyNoteFolder, b: StudyNoteFolder) => {
  const aHangul = HANGUL_FIRST_CHAR.test(a.name.trim())
  const bHangul = HANGUL_FIRST_CHAR.test(b.name.trim())
  if (aHangul !== bHangul) return aHangul ? 1 : -1
  return a.name.localeCompare(b.name, 'ko')
}

function hit(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q)
}

/**
 * 검색 = **클라 필터**다 (plan §3 — 서버 검색은 본문 검색이 생기는 2차에).
 * 폴더명·노트 제목·회사 준비(회사명·스텝명)를 한 칸에서 같이 찾는다.
 *
 * 폴더명이 걸리면 **안의 노트를 전부** 보여 준다 — 「알고리즘」을 친 사람이 찾는 건
 * 그 이름이 붙은 노트가 아니라 그 폴더의 내용이다.
 */
export function buildHubModel({
  notes,
  folders,
  preps,
  query,
  filter,
}: {
  notes: StudyNoteListItem[]
  folders: StudyNoteFolder[]
  preps: PrepHubGroup[]
  query: string
  filter: HubFilter
}): HubModel {
  const q = query.trim().toLowerCase()
  const showStudy = filter !== 'prep'
  const showPrep = filter !== 'study'

  const sortedNotes = [...notes].sort(byUpdatedDesc)

  const folderGroups: HubFolderGroup[] = showStudy
    ? [...folders]
        .sort(byNameKo)
        .map((folder) => {
          const own = sortedNotes.filter((n) => n.folderId === folder.id)
          const matchedByName = q !== '' && hit(folder.name, q)
          return {
            folder,
            notes: q === '' || matchedByName ? own : own.filter((n) => hit(n.title, q)),
            matchedByName,
          }
        })
        // 질의가 있으면 아무 것도 안 걸린 폴더는 목록에서 뺀다 (빈 껍데기가 결과를 가린다)
        .filter((g) => q === '' || g.matchedByName || g.notes.length > 0)
    : []

  const unfiledAll = sortedNotes.filter((n) => n.folderId === null)
  const unfiled = showStudy
    ? q === ''
      ? unfiledAll
      : unfiledAll.filter((n) => hit(n.title, q))
    : []

  const prepList = showPrep
    ? q === ''
      ? preps
      : preps.filter((g) => hit(g.companyName, q) || hit(g.stepName, q))
    : []

  return {
    folders: folderGroups,
    unfiled,
    preps: prepList,
    noSearchResult:
      q !== '' && folderGroups.length === 0 && unfiled.length === 0 && prepList.length === 0,
  }
}

// ── 최근 칩 ──────────────────────────────────────────────────

export interface RecentItem {
  kind: 'study' | 'prep'
  key: string
  label: string
  updatedAt: string
  /** study = 노트 id · prep = 스텝 딥링크에 필요한 두 id */
  noteId?: string
  applicationId?: string
  stepId?: string
}

/**
 * 「최근」 칩 — 공부·준비를 **통합**해서 최근 수정순 3개 (plan UX 검토 ①).
 * 어제 하던 공부를 1클릭으로 이어 가는 자리라 종류를 나누면 의미가 없다.
 */
export function recentItems(
  notes: StudyNoteListItem[],
  preps: PrepHubGroup[],
  limit = 3,
): RecentItem[] {
  const merged: RecentItem[] = [
    ...notes.map((n) => ({
      kind: 'study' as const,
      key: `study:${n.id}`,
      label: noteTitleLabel(n.title),
      updatedAt: n.updatedAt,
      noteId: n.id,
    })),
    ...preps.map((g) => ({
      kind: 'prep' as const,
      key: `prep:${g.stepId}`,
      label: `${g.companyName} — ${g.stepName}`,
      updatedAt: g.lastUpdatedAt,
      applicationId: g.applicationId,
      stepId: g.stepId,
    })),
  ]
  return merged.sort(byUpdatedDesc).slice(0, limit)
}

// ── 딥링크 ───────────────────────────────────────────────────

/**
 * 스텝 페이지의 준비 노트 섹션 앵커. **허브와 StepPage 가 같은 문자열을 봐야 한다** —
 * 어긋나면 이동은 되는데 화면 맨 위에 떨어져서 "왜 아무 일도 안 일어나지" 가 된다.
 */
export const PREP_NOTES_ANCHOR = 'prep-notes'

export function prepDeepLink(group: Pick<PrepHubGroup, 'applicationId' | 'stepId'>): string {
  return `/board/${group.applicationId}/steps/${group.stepId}#${PREP_NOTES_ANCHOR}`
}

// ── 기기 단위 선호 (localStorage) ────────────────────────────

const COLLAPSED_FOLDERS_KEY = 'study-notes:collapsed-folders:v1'
const NOTE_MODE_KEY = 'study-notes:mode:v1'

/**
 * **접힌** 폴더 id 목록을 저장한다 (펼침이 아니라). 기본이 펼침이라, 새로 만든 폴더가
 * 저장값에 없다는 이유로 접힌 채 나타나면 방금 만든 걸 못 찾는다.
 * 저장 실패(프라이빗 모드 등)는 조용히 무시 — 세션 안에서는 그대로 동작한다.
 */
export function loadCollapsedFolders(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_FOLDERS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveCollapsedFolders(ids: string[]): void {
  try {
    localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify(ids))
  } catch {
    /* 저장 실패는 조용히 무시 */
  }
}

export type NoteMode = 'edit' | 'read'

/** 마지막 모드는 **기기 단위**로 기억한다 (plan §3) — 계정이 아니라 지금 쓰는 화면의 성격이다 */
export function loadNoteMode(): NoteMode {
  try {
    return localStorage.getItem(NOTE_MODE_KEY) === 'read' ? 'read' : 'edit'
  } catch {
    return 'edit'
  }
}

export function saveNoteMode(mode: NoteMode): void {
  try {
    localStorage.setItem(NOTE_MODE_KEY, mode)
  } catch {
    /* 저장 실패는 조용히 무시 */
  }
}
