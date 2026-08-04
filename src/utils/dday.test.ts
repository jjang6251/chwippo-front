import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcDday, getDdayLabel, getDdayVariant, formatDate } from './dday'

// dayjs는 시스템 시간에 의존 → 고정 날짜로 테스트
const FIXED_NOW = '2025-09-10'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${FIXED_NOW}T00:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('calcDday', () => {
  it('오늘 마감 → 0', () => {
    expect(calcDday(FIXED_NOW)).toBe(0)
  })

  it('내일 마감 → 1', () => {
    expect(calcDday('2025-09-11')).toBe(1)
  })

  it('3일 후 마감 → 3', () => {
    expect(calcDday('2025-09-13')).toBe(3)
  })

  it('어제 마감(지남) → -1', () => {
    expect(calcDday('2025-09-09')).toBe(-1)
  })

  it('7일 후 → 7', () => {
    expect(calcDday('2025-09-17')).toBe(7)
  })

  it('30일 후 → 30', () => {
    expect(calcDday('2025-10-10')).toBe(30)
  })
})

describe('getDdayLabel', () => {
  it('dday = 0 → "D-day"', () => {
    expect(getDdayLabel(0)).toBe('D-day')
  })

  it('dday = 1 → "D-1"', () => {
    expect(getDdayLabel(1)).toBe('D-1')
  })

  it('dday = 7 → "D-7"', () => {
    expect(getDdayLabel(7)).toBe('D-7')
  })

  it('dday = -1 (지남) → "D+1"', () => {
    expect(getDdayLabel(-1)).toBe('D+1')
  })

  it('dday = -14 (14일 지남) → "D+14"', () => {
    expect(getDdayLabel(-14)).toBe('D+14')
  })
})

describe('getDdayVariant', () => {
  it('dday < 0 (마감 지남) → "muted"', () => {
    expect(getDdayVariant(-1)).toBe('muted')
    expect(getDdayVariant(-100)).toBe('muted')
  })

  it('dday = 0 (오늘 마감) → "danger"', () => {
    expect(getDdayVariant(0)).toBe('danger')
  })

  it('dday = 1 → "danger"', () => {
    expect(getDdayVariant(1)).toBe('danger')
  })

  it('dday = 2 (경계값) → "danger"', () => {
    expect(getDdayVariant(2)).toBe('danger')
  })

  it('dday = 3 → "warning"', () => {
    expect(getDdayVariant(3)).toBe('warning')
  })

  it('dday = 7 (경계값) → "warning"', () => {
    expect(getDdayVariant(7)).toBe('warning')
  })

  it('dday = 8 → "info"', () => {
    expect(getDdayVariant(8)).toBe('info')
  })

  it('dday = 30 → "info"', () => {
    expect(getDdayVariant(30)).toBe('info')
  })
})

describe('formatDate', () => {
  it('날짜 문자열을 "M월 D일 (ddd)" 형식으로 반환', () => {
    // 2025-09-10 = 수요일
    const result = formatDate('2025-09-10')
    expect(result).toMatch(/9월 10일/)
  })

  it('요일이 한글로 표기됨 (dayjs ko locale — 영어 요일 회귀 방어)', () => {
    // 2025-09-10 = 수요일 → "(수)" (locale 미설정 시 "(Wed)")
    expect(formatDate('2025-09-10')).toContain('(수)')
  })

  it('월/일 포맷에 선행 0 없음 (1월 5일, not 01월 05일)', () => {
    const result = formatDate('2025-01-05')
    expect(result).toMatch(/1월 5일/)
    expect(result).not.toMatch(/01월/)
    expect(result).not.toMatch(/05일/)
  })
})

/**
 * 🔴 **D-day 가 기기 타임존을 타면 안 된다** (2026-08-04).
 *
 * 치뽀는 **KST 고정 앱**이고 다른 시간 계산은 전부 `datetime.ts`(Asia/Seoul) 를 쓰는데
 * `calcDday` 만 `dayjs()` 로컬 기준이었다. `timezone`·`utc` 플러그인을 import 해놓고
 * **쓰지 않은 상태**였다 — 하다 만 흔적.
 *
 * 마감일은 `timestamptz` 라 API 가 `2026-08-13T15:00:00Z`(= KST 8/14 자정) 같은 값을 준다.
 * 기기 TZ 가 KST 가 아니면 **하루 어긋난다**:
 *
 * | 기기 TZ | 해석 | D-day |
 * |---|---|---|
 * | Asia/Seoul | 8/14 00:00 | 정상 |
 * | UTC | 8/13 15:00 | **-1일** |
 *
 * 국내 사용자·국내 기기에서는 안 터지지만 **해외 체류 취준생·기기 TZ 오설정**에서 터진다.
 * 그리고 **로컬에서 재현이 어려워** 신고를 받아도 원인을 찾기 힘든 유형이다.
 */
describe('calcDday — 기기 타임존 무관 (KST 고정)', () => {
  const KST_MIDNIGHT_AUG14 = '2026-08-13T15:00:00.000Z' // = KST 2026-08-14 00:00

  /** 기기 TZ 를 UTC 로 두고도 KST 기준 날짜로 계산돼야 한다 */
  it('UTC 기기에서도 KST 기준으로 계산한다', () => {
    // KST 2026-08-04 09:00 = UTC 2026-08-04 00:00
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'))
    expect(calcDday(KST_MIDNIGHT_AUG14)).toBe(10)
  })

  /**
   * 🔴 **KST 자정 경계** — 가장 잘 깨지는 지점.
   * UTC 로는 아직 8/3 15:30 이지만 KST 로는 이미 8/4 00:30 이다.
   */
  it('KST 자정 직후(UTC 로는 전날)에도 KST 날짜로 센다', () => {
    vi.setSystemTime(new Date('2026-08-03T15:30:00.000Z')) // KST 8/4 00:30
    expect(calcDday(KST_MIDNIGHT_AUG14)).toBe(10)
  })

  /** KST 자정 직전 — 아직 8/3 이므로 하루 더 남았다 */
  it('KST 자정 직전에는 하루 더 남은 것으로 센다', () => {
    vi.setSystemTime(new Date('2026-08-03T14:30:00.000Z')) // KST 8/3 23:30
    expect(calcDday(KST_MIDNIGHT_AUG14)).toBe(11)
  })

  /** date-only 문자열도 KST 날짜로 해석 (기존 호출부가 이 형태도 넘긴다) */
  it('date-only 문자열도 동일하게 처리한다', () => {
    vi.setSystemTime(new Date('2026-08-03T15:30:00.000Z')) // KST 8/4
    expect(calcDday('2026-08-14')).toBe(10)
  })

  /**
   * 🔴 **date-only 는 TZ 해석을 태우면 안 된다.**
   *
   * `new Date('2026-08-14')` 는 명세상 **UTC 자정**으로 파싱된다. 이걸 다시 어떤 TZ 로
   * 환산하면, **UTC 보다 뒤진 지역에서 하루 앞당겨진다** (LA = 8/13 17:00 → "8/13").
   *
   * KST 는 UTC 보다 **앞서** 있어 이 차이가 안 드러난다 — 그래서 기본값만 테스트하면
   * 분기를 지워도 통과한다(뮤테이션에서 실제로 안 잡혔다). `tz` 인자를 UTC 보다 뒤진
   * 지역으로 줘야 비로소 드러난다.
   *
   * 이 분기는 **미래 user-TZ 확장**(모든 헬퍼가 `tz?` 를 받는 이유)을 위한 것이라,
   * 지금 안 쓰인다고 지우면 그때 조용히 어긋난다.
   */
  it('🔴 UTC 보다 뒤진 TZ 에서도 date-only 를 그 날짜로 본다', () => {
    vi.setSystemTime(new Date('2026-08-04T12:00:00.000Z')) // LA 8/4 05:00
    expect(calcDday('2026-08-14', 'America/Los_Angeles')).toBe(10)
  })
})

/**
 * 🔴 **날짜로 못 읽는 값에 던지면 안 된다** — KST 전환에서 실제로 생겼던 회귀다.
 *
 * `toLocalDateString` 안의 `Intl.DateTimeFormat.format()` 은 Invalid Date 에
 * `RangeError` 를 던진다. `calcDday` 는 렌더 중에 호출되므로(MyInfo 시험 일정 ·
 * StepPage · CompanyCard), 값 하나가 이상하면 **그 페이지가 통째로 하얘진다.**
 *
 * 예전 `dayjs` 구현은 `NaN` 을 뱉었다 — "D-NaN" 이 떠도 나머지 화면은 살아 있었다.
 * 서버 응답을 신뢰하지 않는다는 원칙(2026-08-01 자소서 점검 크래시)이 여기에도 적용된다.
 * **표시가 이상한 것과 화면이 죽는 것은 다른 등급의 사고다.**
 */
describe('calcDday — 잘못된 값에 던지지 않는다', () => {
  it.each([
    ['빈 문자열', ''],
    ['날짜가 아닌 문자열', 'nonsense'],
    ['깨진 ISO', '2026-13-45T99:99:99Z'],
  ])('%s → 던지지 않고 NaN', (_label, value) => {
    expect(() => calcDday(value)).not.toThrow()
    expect(calcDday(value)).toBeNaN()
  })

  /** NaN 이 흘러가도 라벨·색 계산이 죽지 않아야 화면이 산다 */
  it('NaN 이 라벨·variant 로 흘러가도 던지지 않는다', () => {
    const d = calcDday('')
    expect(() => getDdayLabel(d)).not.toThrow()
    expect(() => getDdayVariant(d)).not.toThrow()
  })

  /** 지남 판정(`< 0`)에 NaN 이 들어가면 false — "결과 입력" 오유도가 안 뜬다 */
  it('NaN 은 지남으로 판정되지 않는다', () => {
    expect(calcDday('nonsense') < 0).toBe(false)
  })
})
