/**
 * 공부 노트 허브의 순수 로직 spec (plan §5 「허브」 축).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   필터    1  전체 = 공부 + 회사 준비 둘 다
 *           2  「공부 노트」 = 준비 행이 사라진다
 *           3  「회사 준비」 = 폴더·미분류가 사라진다
 *   검색    4  노트 **제목** 매칭 (대소문자 무시)
 *           5  **폴더 이름** 매칭 → 그 폴더의 노트를 **전부** 보여 준다
 *           6  회사 준비 매칭 (회사명 / 스텝명 각각)
 *           7  무결과 → `noSearchResult` (질의가 비었을 때는 false — 그건 빈 상태다)
 *           8  질의가 있으면 아무 것도 안 걸린 폴더는 목록에서 빠진다
 *           9  필터 + 검색 동시 적용
 *   정렬   10  폴더 = 가나다순 (서버 순서와 무관하게)
 *          11  노트 = 최근 수정순
 *   최근   12  공부·준비 통합 최근순 3개
 *          13  빈 제목 노트는 「제목 없음」으로 뜬다
 *   시각   14  방금 / N분 전 / N시간 전
 *          15  🔴 「어제」는 **KST 달력 날짜** 차 (23:50 → 다음날 09:00 = 어제, 10시간 전 아님)
 *          16  7일 넘으면 월·일
 *          17  미래 시각(기기 시계 어긋남) → 「방금」 · 잘못된 값 → 빈 문자열
 *   선호   18  접힌 폴더 저장·복원 · 깨진 값이면 빈 배열
 *          19  마지막 모드 저장·복원 (기본 edit)
 *   딥링크 20  준비 노트 = 스텝 페이지 + 앵커
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { PrepHubGroup, StudyNoteFolder, StudyNoteListItem } from '@/api/studyNotes'
import {
  buildHubModel,
  formatRelativeTime,
  loadCollapsedFolders,
  loadNoteMode,
  noteTitleLabel,
  prepDeepLink,
  recentItems,
  saveCollapsedFolders,
  saveNoteMode,
} from './studyNotesModel'

const folder = (id: string, name: string): StudyNoteFolder => ({
  id,
  name,
  parentId: null,
  sortOrder: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
})

const note = (
  id: string,
  title: string,
  folderId: string | null,
  updatedAt: string,
): StudyNoteListItem => ({ id, title, folderId, updatedAt })

const prep = (
  stepId: string,
  companyName: string,
  stepName: string,
  lastUpdatedAt: string,
): PrepHubGroup => ({
  applicationId: `app-${stepId}`,
  companyName,
  stepId,
  stepName,
  sheetCount: 3,
  lastUpdatedAt,
})

const FOLDERS = [folder('f-algo', '알고리즘'), folder('f-cs', 'CS 기초')]
const NOTES = [
  note('n1', '운영체제 정리', 'f-cs', '2026-08-18T02:00:00.000Z'),
  note('n2', '네트워크 정리', 'f-cs', '2026-08-17T02:00:00.000Z'),
  note('n3', 'DP 유형 정리', 'f-algo', '2026-08-16T02:00:00.000Z'),
  note('n4', '정처기 오답', null, '2026-08-15T02:00:00.000Z'),
]
const PREPS = [
  prep('s1', '삼성전자', '1차 면접', '2026-08-18T01:00:00.000Z'),
  prep('s2', '카카오', '서류', '2026-08-14T01:00:00.000Z'),
]

const model = (query = '', filter: 'all' | 'study' | 'prep' = 'all') =>
  buildHubModel({ notes: NOTES, folders: FOLDERS, preps: PREPS, query, filter })

describe('buildHubModel — 필터', () => {
  it('1 전체 = 공부 폴더·미분류·회사 준비가 모두 보인다', () => {
    const m = model()
    expect(m.folders.map((g) => g.folder.id)).toEqual(['f-cs', 'f-algo'])
    expect(m.unfiled.map((n) => n.id)).toEqual(['n4'])
    expect(m.preps).toHaveLength(2)
  })

  it('2 「공부 노트」 = 회사 준비 행이 사라진다', () => {
    const m = model('', 'study')
    expect(m.preps).toHaveLength(0)
    expect(m.folders).toHaveLength(2)
  })

  it('3 「회사 준비」 = 폴더·미분류가 사라진다', () => {
    const m = model('', 'prep')
    expect(m.folders).toHaveLength(0)
    expect(m.unfiled).toHaveLength(0)
    expect(m.preps).toHaveLength(2)
  })
})

describe('buildHubModel — 검색 (클라 필터)', () => {
  it('4 노트 제목 매칭 · 대소문자 무시', () => {
    const m = model('dp')
    expect(m.folders.map((g) => g.folder.id)).toEqual(['f-algo'])
    expect(m.folders[0].notes.map((n) => n.id)).toEqual(['n3'])
    expect(m.noSearchResult).toBe(false)
  })

  it('5 🔴 폴더 이름이 걸리면 그 폴더의 노트를 **전부** 보여 준다', () => {
    const m = model('CS')
    expect(m.folders).toHaveLength(1)
    expect(m.folders[0].matchedByName).toBe(true)
    // 「CS」 가 제목에 없는 노트까지 다 나온다 — 찾는 건 이름이 아니라 그 폴더의 내용이다
    expect(m.folders[0].notes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })

  it('6 회사 준비 — 회사명·스텝명 각각 매칭된다', () => {
    expect(model('삼성').preps.map((g) => g.stepId)).toEqual(['s1'])
    expect(model('서류').preps.map((g) => g.stepId)).toEqual(['s2'])
  })

  it('7 무결과 → noSearchResult · 빈 질의는 무결과가 아니다', () => {
    const m = model('없는단어')
    expect(m.folders).toHaveLength(0)
    expect(m.unfiled).toHaveLength(0)
    expect(m.preps).toHaveLength(0)
    expect(m.noSearchResult).toBe(true)
    expect(model('').noSearchResult).toBe(false)
    expect(model('   ').noSearchResult).toBe(false)
  })

  it('8 안 걸린 폴더는 빈 껍데기로 남지 않는다', () => {
    expect(model('운영체제').folders.map((g) => g.folder.id)).toEqual(['f-cs'])
  })

  it('9 필터와 검색이 함께 적용된다', () => {
    // 「삼성」 은 준비 행에만 걸리는데 필터가 공부 노트면 아무 것도 안 남는다
    const m = model('삼성', 'study')
    expect(m.preps).toHaveLength(0)
    expect(m.noSearchResult).toBe(true)
  })
})

describe('buildHubModel — 정렬', () => {
  it('10 폴더는 가나다순 (서버가 준 순서와 무관하게)', () => {
    const m = buildHubModel({
      notes: [],
      folders: [folder('c', '코딩테스트'), folder('a', '가나다'), folder('b', '나다라')],
      preps: [],
      query: '',
      filter: 'all',
    })
    expect(m.folders.map((g) => g.folder.name)).toEqual(['가나다', '나다라', '코딩테스트'])
  })

  it('10b 🔴 영문·숫자가 한글 앞이다 (ICU ko 기본값과 반대 — 탐색기 순서)', () => {
    const m = buildHubModel({
      notes: [],
      folders: [folder('a', '알고리즘'), folder('c', 'CS 기초'), folder('n', '1주차')],
      preps: [],
      query: '',
      filter: 'all',
    })
    expect(m.folders.map((g) => g.folder.name)).toEqual(['1주차', 'CS 기초', '알고리즘'])
  })

  it('11 노트는 최근 수정순', () => {
    const m = model()
    expect(m.folders.find((g) => g.folder.id === 'f-cs')!.notes.map((n) => n.id)).toEqual([
      'n1',
      'n2',
    ])
  })
})

describe('recentItems — 최근 칩', () => {
  it('12 공부·준비를 통합해 최근순 3개', () => {
    const items = recentItems(NOTES, PREPS)
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.key)).toEqual(['study:n1', 'prep:s1', 'study:n2'])
    expect(items[1].label).toBe('삼성전자 — 1차 면접')
  })

  it('13 빈 제목은 「제목 없음」으로 뜬다', () => {
    const items = recentItems([note('n9', '   ', null, '2026-08-19T00:00:00.000Z')], [])
    expect(items[0].label).toBe('제목 없음')
    expect(noteTitleLabel('  정리  ')).toBe('정리')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-18T09:00:00+09:00')

  it('14 방금 / N분 전 / N시간 전', () => {
    expect(formatRelativeTime('2026-08-18T08:59:30+09:00', now)).toBe('방금')
    expect(formatRelativeTime('2026-08-18T08:45:00+09:00', now)).toBe('15분 전')
    expect(formatRelativeTime('2026-08-18T07:00:00+09:00', now)).toBe('2시간 전')
  })

  it('15 🔴 「어제」는 KST 달력 날짜 차다 — 10시간 전이 아니라 어제', () => {
    expect(formatRelativeTime('2026-08-17T23:00:00+09:00', now)).toBe('어제')
    // 같은 날 새벽이면 아직 「N시간 전」
    expect(formatRelativeTime('2026-08-18T00:10:00+09:00', now)).toBe('8시간 전')
    expect(formatRelativeTime('2026-08-15T09:00:00+09:00', now)).toBe('3일 전')
  })

  it('16 7일이 넘으면 월·일 (전역 `formatMonthDay` 표기 그대로)', () => {
    expect(formatRelativeTime('2026-08-03T09:00:00+09:00', now)).toBe('8/3')
  })

  it('17 미래 시각은 「방금」 · 값이 날짜가 아니면 빈 문자열', () => {
    expect(formatRelativeTime('2026-08-18T12:00:00+09:00', now)).toBe('방금')
    expect(formatRelativeTime('nope', now)).toBe('')
  })
})

describe('기기 단위 선호 (localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('18 접힌 폴더를 저장·복원한다 · 깨진 값이면 빈 배열', () => {
    expect(loadCollapsedFolders()).toEqual([])
    saveCollapsedFolders(['f-cs'])
    expect(loadCollapsedFolders()).toEqual(['f-cs'])
    localStorage.setItem('study-notes:collapsed-folders:v1', '{{{')
    expect(loadCollapsedFolders()).toEqual([])
  })

  it('19 마지막 모드를 저장·복원한다 (기본 edit)', () => {
    expect(loadNoteMode()).toBe('edit')
    saveNoteMode('read')
    expect(loadNoteMode()).toBe('read')
    saveNoteMode('edit')
    expect(loadNoteMode()).toBe('edit')
  })
})

describe('prepDeepLink', () => {
  it('20 스텝 페이지 + 준비 노트 앵커', () => {
    expect(prepDeepLink({ applicationId: 'a1', stepId: 's1' })).toBe(
      '/board/a1/steps/s1#prep-notes',
    )
  })
})
