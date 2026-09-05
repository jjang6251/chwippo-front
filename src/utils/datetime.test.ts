import { describe, it, expect } from 'vitest'
import {
  APP_TIMEZONE,
  addMonths,
  addYears,
  toLocalDateString,
  todayLocal,
  getWeekMonday,
  getWeekSunday,
  isThisWeek,
  formatWeekLabel,
  formatDateTime,
  formatStepSchedule,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
  escapeHtml,
} from './datetime'

/**
 * memory `feedback_kst_local_date` — 치뽀는 KST-fixed 앱.
 * 모든 헬퍼가 Asia/Seoul 기본 + tz? 옵셔널로 미래 사용자 TZ 확장 친화.
 * `new Date().toISOString().slice(0, 10)` 같은 UTC 패턴은 금지.
 */
describe('utils/datetime — KST-fixed 헬퍼', () => {
  describe('formatDateTime — 자정 h23 고정', () => {
    it('KST 자정 정각 → "00:00:00" (구형 ICU 의 hour12:false h24 해석 "24:00:00" 회귀 방지)', async () => {
      const { formatDateTime } = await import('./datetime')
      expect(formatDateTime(new Date('2026-05-25T00:00:00+09:00'))).toBe(
        '2026-05-25 00:00:00',
      )
    })
  })

  it('APP_TIMEZONE 은 Asia/Seoul', () => {
    expect(APP_TIMEZONE).toBe('Asia/Seoul')
  })

  describe('toLocalDateString', () => {
    it('UTC 정오 → KST 같은 날', () => {
      const d = new Date('2026-05-25T12:00:00Z') // KST 21:00
      expect(toLocalDateString(d)).toBe('2026-05-25')
    })

    it('UTC 일 23:00 → KST 월 08:00 — KST 기준 다음 날', () => {
      const d = new Date('2026-05-17T23:00:00Z')
      expect(toLocalDateString(d)).toBe('2026-05-18')
    })

    it('UTC 월 14:59 → KST 화 00:00 (자정 직후) — KST 기준 화', () => {
      const d = new Date('2026-05-25T15:00:00Z') // KST 화 2026-05-26 00:00
      expect(toLocalDateString(d)).toBe('2026-05-26')
    })

    it('월말 KST 자정 — UTC 5/31 15:00 → KST 6/1 00:00', () => {
      const d = new Date('2026-05-31T15:00:00Z')
      expect(toLocalDateString(d)).toBe('2026-06-01')
    })

    it('tz="America/New_York" 인자 — 미래 사용자 TZ 확장 친화', () => {
      const d = new Date('2026-05-25T03:00:00Z') // NYC 5/24 23:00 (EDT -4)
      expect(toLocalDateString(d, 'America/New_York')).toBe('2026-05-24')
    })

    it('tz="UTC" 인자 — UTC 그대로', () => {
      const d = new Date('2026-05-25T15:30:00Z')
      expect(toLocalDateString(d, 'UTC')).toBe('2026-05-25')
    })
  })

  describe('todayLocal', () => {
    it('YYYY-MM-DD 형식', () => {
      expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('default = KST — tz 명시 안 해도 Asia/Seoul', () => {
      // 같은 순간을 다른 tz로 비교 — 차이 없거나 1일 차이 (시간대에 따라)
      const kst = todayLocal()
      const seoul = todayLocal('Asia/Seoul')
      expect(kst).toBe(seoul)
    })
  })

  describe('getWeekMonday', () => {
    it('월요일 → 자기 자신', () => {
      expect(getWeekMonday('2026-05-18')).toBe('2026-05-18')
    })

    it('수요일 → 같은 주 월요일', () => {
      expect(getWeekMonday('2026-05-20')).toBe('2026-05-18')
    })

    it('일요일 → 직전 월요일 (ISO 주)', () => {
      expect(getWeekMonday('2026-05-24')).toBe('2026-05-18')
    })

    it('월말 일요일 → 전월 월요일 (3/1 일 → 2/23 월)', () => {
      expect(getWeekMonday('2026-03-01')).toBe('2026-02-23')
    })

    it('연말/연초 경계 — 1/3 일 → 12/28 월', () => {
      expect(getWeekMonday('2027-01-03')).toBe('2026-12-28')
    })

    it('인자 없음 — 오늘 기준 (YYYY-MM-DD 형식)', () => {
      expect(getWeekMonday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('getWeekSunday', () => {
    it('월요일 + 6일 = 같은 주 일요일', () => {
      expect(getWeekSunday('2026-05-18')).toBe('2026-05-24')
    })

    it('수요일 기준에서도 같은 주 일요일', () => {
      expect(getWeekSunday('2026-05-20')).toBe('2026-05-24')
    })

    it('월말 일요일 — 일요일 자체가 반환', () => {
      expect(getWeekSunday('2026-05-24')).toBe('2026-05-24')
    })

    it('연말 — 12/28 월 → 1/3 일', () => {
      expect(getWeekSunday('2026-12-28')).toBe('2027-01-03')
    })
  })

  describe('isThisWeek', () => {
    it('오늘 = this week true', () => {
      expect(isThisWeek(todayLocal())).toBe(true)
    })

    it('이번주 월요일 = true (양끝 포함)', () => {
      expect(isThisWeek(getWeekMonday())).toBe(true)
    })

    it('이번주 일요일 = true (양끝 포함)', () => {
      expect(isThisWeek(getWeekSunday())).toBe(true)
    })

    it('다음주 월요일 = false', () => {
      const nextMon = (() => {
        const sun = getWeekSunday()
        const [y, m, d] = sun.split('-').map(Number)
        const next = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
        next.setUTCDate(next.getUTCDate() + 1)
        return next.toISOString().slice(0, 10) // 비교용으로 사용 OK (테스트 자체)
      })()
      expect(isThisWeek(nextMon)).toBe(false)
    })

    it('지난주 일요일 = false', () => {
      const prevSun = (() => {
        const mon = getWeekMonday()
        const [y, m, d] = mon.split('-').map(Number)
        const prev = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
        prev.setUTCDate(prev.getUTCDate() - 1)
        return prev.toISOString().slice(0, 10)
      })()
      expect(isThisWeek(prevSun)).toBe(false)
    })
  })

  describe('formatWeekLabel', () => {
    it('정상 — 5월 넷째주 라벨', () => {
      // 2026-05-25 (월) 의 일요일 = 2026-05-31
      expect(formatWeekLabel('2026-05-25')).toBe(
        '5월 넷째주 · 5/25 ~ 5/31',
      )
    })

    it('월 첫주 — d=4 면 첫째주 (Math.floor((4-1)/7)+1 = 1)', () => {
      expect(formatWeekLabel('2026-05-04')).toBe(
        '5월 첫째주 · 5/4 ~ 5/10',
      )
    })

    it('월 말주 — d=25 → 넷째주', () => {
      expect(formatWeekLabel('2026-03-30')).toBe(
        '3월 다섯째주 · 3/30 ~ 4/5',
      )
    })

    it('koreanOrd fallback — 6째주 이상 (d=29 → 다섯째주, d>28 cap)', () => {
      // 29 ~ 31 → floor((29-1)/7)+1 = 5 → 다섯째주 (배열 마지막)
      expect(formatWeekLabel('2026-08-31')).toBe(
        '8월 다섯째주 · 8/31 ~ 9/6',
      )
    })

    it('일요일 = 다음 달인 경우 (3/30 월 → 4/5 일)', () => {
      const label = formatWeekLabel('2026-03-30')
      expect(label).toContain('3월') // 월요일이 속한 달 기준
      expect(label).toContain('3/30 ~ 4/5')
    })
  })

  describe('formatDateTime', () => {
    it('UTC ISO → KST YYYY-MM-DD HH:mm:ss', () => {
      // UTC 2026-05-25 03:00:00 = KST 12:00:00
      expect(formatDateTime('2026-05-25T03:00:00Z')).toBe(
        '2026-05-25 12:00:00',
      )
    })

    it('Date 객체도 받음', () => {
      const d = new Date('2026-05-25T03:00:00Z')
      expect(formatDateTime(d)).toBe('2026-05-25 12:00:00')
    })

    it('UTC 자정 → KST 09:00', () => {
      expect(formatDateTime('2026-05-25T00:00:00Z')).toBe(
        '2026-05-25 09:00:00',
      )
    })

    it('tz="UTC" 명시 — UTC 그대로', () => {
      expect(formatDateTime('2026-05-25T03:00:00Z', 'UTC')).toBe(
        '2026-05-25 03:00:00',
      )
    })
  })

  describe('escapeHtml', () => {
    it.each([
      ['<script>', '&lt;script&gt;'],
      ['a & b', 'a &amp; b'],
      ['"quoted"', '&quot;quoted&quot;'],
      ["it's", 'it&#39;s'],
      ['<a href="x">', '&lt;a href=&quot;x&quot;&gt;'],
      ['no special', 'no special'],
    ])('escape: %s → %s', (input, expected) => {
      expect(escapeHtml(input)).toBe(expected)
    })
  })

  // card-detail-remodel — 현재 스텝 카드 날짜+시간 표시. KST 고정 → TZ=UTC 실행에서도 동일.
  describe('formatStepSchedule — 현재 스텝 카드 날짜/시간', () => {
    it('날짜+시간 있음 → "M월 D일 (요일)" + KST 시간 (14:00 이 05:00 로 밀리지 않음)', () => {
      const { dateLabel, timeLabel } = formatStepSchedule('2026-07-22T14:00:00+09:00')
      expect(dateLabel).toBe('7월 22일 (수)')
      expect(timeLabel).toBe('14:00')
    })

    it('시간이 자정(00:00) → timeLabel null ("시간 미정" 표기 생략)', () => {
      const { dateLabel, timeLabel } = formatStepSchedule('2026-07-22T00:00:00+09:00')
      expect(dateLabel).toBe('7월 22일 (수)')
      expect(timeLabel).toBeNull()
    })

    it('UTC 자정 저장분도 KST 로 표시 (09:00, 날짜 밀림 없음)', () => {
      const { dateLabel, timeLabel } = formatStepSchedule('2026-07-22T00:00:00Z')
      expect(dateLabel).toBe('7월 22일 (수)')
      expect(timeLabel).toBe('09:00')
    })

    it('null / 빈 값 → 둘 다 null', () => {
      expect(formatStepSchedule(null)).toEqual({ dateLabel: null, timeLabel: null })
      expect(formatStepSchedule(undefined)).toEqual({ dateLabel: null, timeLabel: null })
      expect(formatStepSchedule('')).toEqual({ dateLabel: null, timeLabel: null })
    })

    it('잘못된 날짜 문자열 → 둘 다 null', () => {
      expect(formatStepSchedule('not-a-date')).toEqual({ dateLabel: null, timeLabel: null })
    })

    it('tz override — UTC 로 보면 시간이 다르게 (확장 친화 시그니처)', () => {
      const { timeLabel } = formatStepSchedule('2026-07-22T14:00:00+09:00', 'UTC')
      expect(timeLabel).toBe('05:00')
    })
  })

  describe('addYears — 자격증 만료일 등 연 단위 (TZ 무관 date-only)', () => {
    it('정상 +N년', () => {
      expect(addYears('2026-07-20', 2)).toBe('2028-07-20')
      expect(addYears('2024-01-31', 1)).toBe('2025-01-31')
    })

    it('2/29 + 비윤년 → 3/1 오버플로 (명시 동작)', () => {
      expect(addYears('2024-02-29', 1)).toBe('2025-03-01')
      expect(addYears('2024-02-29', 4)).toBe('2028-02-29')
    })
  })

  /**
   * 기간 보조 칩(`DurationChips`) — 시작일 + 「+1학기(6)·+1년(12)·18/21/24개월」.
   *
   * 케이스: 정상 · 해 넘김 · 말일 보정(넘침 금지) · 윤년 2월 · 0/음수 · 잘못된 입력.
   */
  describe('addMonths — 재학·복무 기간 보조 칩', () => {
    it('정상 +N개월', () => {
      expect(addMonths('2026-03-02', 6)).toBe('2026-09-02')
      expect(addMonths('2026-03-02', 18)).toBe('2027-09-02')
      expect(addMonths('2026-03-02', 24)).toBe('2028-03-02')
    })

    it('해를 넘긴다', () => {
      expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
      expect(addMonths('2026-12-31', 1)).toBe('2027-01-31')
    })

    it('🔴 말일 보정 — 1/31 + 1개월은 3/2 가 아니라 2/28 이다', () => {
      expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
      expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    })

    it('윤년 2월은 29일까지 살린다', () => {
      expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
      expect(addMonths('2023-12-31', 2)).toBe('2024-02-29')
    })

    it('0 · 음수', () => {
      expect(addMonths('2026-05-10', 0)).toBe('2026-05-10')
      expect(addMonths('2026-01-10', -1)).toBe('2025-12-10')
      expect(addMonths('2026-01-10', -13)).toBe('2024-12-10')
    })

    it('날짜 형식이 아니면 빈 문자열 (렌더 중 호출이라 던지지 않는다)', () => {
      expect(addMonths('', 6)).toBe('')
      expect(addMonths('2026-05', 6)).toBe('')
      expect(addMonths('날짜아님', 6)).toBe('')
    })
  })

/**
 * 🔴 **이 두 함수가 ADR-049 의 「시각 보존」을 지키는 자리다.**
 *
 * 카드 상세 헤더에 있던 날짜 입력이 `type="date"` 라 저장할 때마다 시각을 `T00:00:00`
 * 으로 덮어썼고, 그래서 **임박(2시간 전) 알림 대상에서 이탈**하고 캘린더 시간도 사라졌다.
 * ADR-049 는 편집 경로를 하나로 좁혀 막았는데, 경로가 둘이 된 지금(스텝 상세 · 카드 상세
 * 인라인)은 **쓰기 구현이 하나인 것**이 그 자리를 대신한다.
 */
describe('datetime-local 왕복 — 스텝 일정 편집', () => {
  describe('toDateTimeLocalValue', () => {
    it('저장된 UTC ISO → KST 벽시각 (브라우저 TZ 무관)', () => {
      // 05:00Z = 같은 날 14:00 KST
      expect(toDateTimeLocalValue('2026-07-22T05:00:00Z')).toBe('2026-07-22T14:00')
    })

    it('🔴 KST 자정 경계 — UTC 로 읽으면 날짜가 하루 어긋난다', () => {
      // 2026-07-21T15:00Z = 2026-07-22T00:00 KST
      expect(toDateTimeLocalValue('2026-07-21T15:00:00Z')).toBe('2026-07-22T00:00')
    })

    it('offset 이 붙은 ISO 도 같은 값으로 돌아온다 (왕복 안정)', () => {
      expect(toDateTimeLocalValue('2026-07-22T14:00:00+09:00')).toBe('2026-07-22T14:00')
    })

    it('없음·손상된 값 → 빈 문자열 (렌더 중 호출이라 던지면 안 된다)', () => {
      expect(toDateTimeLocalValue(null)).toBe('')
      expect(toDateTimeLocalValue(undefined)).toBe('')
      expect(toDateTimeLocalValue('날짜아님')).toBe('')
    })

    it('tz override — 확장 친화 시그니처', () => {
      expect(toDateTimeLocalValue('2026-07-22T05:00:00Z', 'UTC')).toBe('2026-07-22T05:00')
    })
  })

  describe('fromDateTimeLocalValue', () => {
    it('🔴 KST offset 을 붙여 저장한다 — 시각이 보존되는 지점', () => {
      expect(fromDateTimeLocalValue('2026-07-22T14:00')).toBe('2026-07-22T14:00:00+09:00')
    })

    it('빈 값 → null (날짜 삭제)', () => {
      expect(fromDateTimeLocalValue('')).toBeNull()
    })

    it('🔴 왕복해도 시각이 안 밀린다 — 저장 → 다시 열기 → 다시 저장', () => {
      const first = fromDateTimeLocalValue('2026-07-22T14:00')
      const reopened = toDateTimeLocalValue(first)
      expect(reopened).toBe('2026-07-22T14:00')
      expect(fromDateTimeLocalValue(reopened)).toBe(first)
    })

    it('🔴 자정도 그대로 자정 — 「시간 미정」과 「자정에 덮임」은 다른 것이다', () => {
      expect(fromDateTimeLocalValue('2026-07-22T00:00')).toBe('2026-07-22T00:00:00+09:00')
    })
  })
})
})
