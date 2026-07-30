import { describe, it, expect } from 'vitest'
import {
  parseNotificationEvents,
  safeInternalPath,
  ddayLabel,
  ddayTone,
} from './notificationEvents'
import { getDdayVariant } from './dday'

/**
 * 알림 payload 파싱 — `payload` 는 서버가 넣은 임의 jsonb 라 **형태를 믿을 수 없다.**
 * 특히 2026-07-29 이전 알림에는 events 가 아예 없다.
 * 파싱 실패 시 null 을 돌려주고 화면이 body 텍스트로 폴백해야 하며,
 * **옛 알림이 깨져 보이면 안 된다.**
 *
 * 케이스:
 *  1. 정상 events → 파싱
 *  2. payload null (옛 알림) → null
 *  3. events 없음 (eventCount 만 있던 구버전) → null
 *  4. events 가 배열 아님 → null
 *  5. 빈 배열 → null (구조화 렌더할 게 없음)
 *  6. subject 누락·빈 문자열 → null (주 정보 없으면 구조화 포기)
 *  7. 원소가 객체 아님 → null
 *  8. label·dday·deepLink 결측 → 기본값으로 채우고 렌더는 계속
 *  9. dday 가 숫자 아님·NaN → null 로 정규화
 * 10. D-day 라벨 — 당일은 "D-0" 아니라 "D-day", 지난 건 "D+N"
 * 11. 색 경계가 보드 `getDdayVariant` 와 일치 (같은 마감이 다른 색이면 안 됨)
 */

describe('parseNotificationEvents', () => {
  it('1. 정상 events → 파싱', () => {
    expect(
      parseNotificationEvents({
        payload: {
          events: [
            { subject: '카카오', label: '서류 마감', dday: 3, deepLink: '/board/a' },
          ],
        },
      }),
    ).toEqual([
      { subject: '카카오', label: '서류 마감', dday: 3, deepLink: '/board/a' },
    ])
  })

  it('2. payload null (옛 알림) → null', () => {
    expect(parseNotificationEvents({ payload: null })).toBeNull()
  })

  it('3. events 없이 eventCount 만 (구버전) → null', () => {
    expect(parseNotificationEvents({ payload: { eventCount: 3 } })).toBeNull()
  })

  it('4. events 가 배열이 아니면 → null', () => {
    expect(
      parseNotificationEvents({ payload: { events: 'oops' } }),
    ).toBeNull()
  })

  it('5. 빈 배열 → null', () => {
    expect(parseNotificationEvents({ payload: { events: [] } })).toBeNull()
  })

  it('6. subject 누락·빈 문자열 → null (주 정보 없으면 구조화 포기)', () => {
    expect(
      parseNotificationEvents({ payload: { events: [{ label: '서류' }] } }),
    ).toBeNull()
    expect(
      parseNotificationEvents({
        payload: { events: [{ subject: '   ', label: '서류' }] },
      }),
    ).toBeNull()
  })

  it('7. 원소가 객체가 아니면 → null', () => {
    expect(
      parseNotificationEvents({ payload: { events: ['카카오', null] } }),
    ).toBeNull()
  })

  it('8. label·deepLink 결측 → 기본값으로 채우고 계속', () => {
    expect(
      parseNotificationEvents({ payload: { events: [{ subject: '카카오' }] } }),
    ).toEqual([{ subject: '카카오', label: '', dday: null, deepLink: null }])
  })

  it('9. dday 가 숫자 아님·NaN → null 로 정규화', () => {
    const out = parseNotificationEvents({
      payload: { events: [{ subject: 'A', dday: 'D-3' }, { subject: 'B', dday: NaN }] },
    })
    expect(out?.[0].dday).toBeNull()
    expect(out?.[1].dday).toBeNull()
  })
})

describe('ddayLabel', () => {
  it('10. 당일은 "D-day" (D-0 아님) · 지난 건 D+N', () => {
    expect(ddayLabel(0)).toBe('D-day')
    expect(ddayLabel(3)).toBe('D-3')
    expect(ddayLabel(-2)).toBe('D+2')
  })
})

describe('ddayTone', () => {
  it('11. 보드 getDdayVariant 와 경계가 일치한다', () => {
    // 같은 마감을 알림과 보드에서 다른 색으로 보여주면 안 된다
    for (const d of [-5, -1, 0, 1, 2, 3, 7, 8, 30]) {
      expect(ddayTone(d)).toBe(getDdayVariant(d))
    }
  })
})

describe('safeInternalPath — 오픈 리다이렉트 차단', () => {
  it('앱 내부 경로만 통과', () => {
    expect(safeInternalPath('/board/abc')).toBe('/board/abc')
    expect(safeInternalPath('/calendar')).toBe('/calendar')
  })

  it('🔴 외부로 나가는 형태는 전부 차단', () => {
    // 프로토콜 상대 URL — '/' 로 시작하지만 브라우저는 외부로 보낸다 (가장 놓치기 쉬움)
    expect(safeInternalPath('//evil.com')).toBeNull()
    expect(safeInternalPath('https://evil.com')).toBeNull()
    expect(safeInternalPath('http://evil.com')).toBeNull()
    expect(safeInternalPath('javascript:alert(1)')).toBeNull()
    expect(safeInternalPath('board/abc')).toBeNull() // 상대 경로도 거부
  })

  it('🔴 역슬래시 우회도 차단 — 브라우저 URL 파서 기준으로 검증', () => {
    /*
      '//' 만 막았을 때 실제로 뚫렸던 케이스다 (2026-07-30 /qa).
      WHATWG URL 파서는 http/https 에서 '\' 를 '/' 로 취급하므로
      '/\evil.com' 이 https://evil.com/ 으로 해석된다.

      단정하지 않고 **파서에 직접 물어서** 검증한다 — 이 규칙은 우리 정규식이 아니라
      브라우저 동작이 소스라, 문자 비교만 하면 다음 우회를 또 놓친다.
    */
    const attacks = [
      '/\\evil.com',
      '/\\\\evil.com',
      '\\\\evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
    ]
    for (const a of attacks) {
      const passed = safeInternalPath(a)
      if (passed !== null) {
        // 통과시켰다면 최소한 우리 호스트를 벗어나지 않아야 한다
        expect(new URL(passed, 'https://chwippo.com').origin).toBe(
          'https://chwippo.com',
        )
      }
    }
    // 위 중 프로토콜 상대로 해석되는 것들은 애초에 통과되지 않아야 한다
    expect(safeInternalPath('/\\evil.com')).toBeNull()
    expect(safeInternalPath('/\\\\evil.com')).toBeNull()
    expect(safeInternalPath('\\\\evil.com')).toBeNull()
    // 정상 경로 안의 역슬래시는 내부로 해석되므로 통과해도 안전
    expect(new URL('/board/a\\b', 'https://chwippo.com').origin).toBe(
      'https://chwippo.com',
    )
  })

  it('문자열 아님·빈 값 → null', () => {
    expect(safeInternalPath(null)).toBeNull()
    expect(safeInternalPath(undefined)).toBeNull()
    expect(safeInternalPath(42)).toBeNull()
    expect(safeInternalPath('')).toBeNull()
  })

  it('파서가 외부 deepLink 를 걸러낸다 (줄 클릭 불가 처리)', () => {
    const out = parseNotificationEvents({
      payload: {
        events: [{ subject: '카카오', deepLink: 'https://evil.com' }],
      },
    })
    expect(out?.[0].deepLink).toBeNull()
  })
})
