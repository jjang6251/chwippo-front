/**
 * 랜딩 시즌 훅 — **가이드와 어긋나면 안 되고, 시즌이 끝나면 스스로 사라져야 한다.**
 *
 * 🔴 이 spec 의 목적은 두 가지다:
 *
 * 1. **출처 1:1** — 마감 일정의 원본은 `public/guide/gongchae-iljeong-2026-h2.html` 하나다.
 *    같은 사실을 두 곳에 적어두면 한쪽만 고쳐지고 조용히 어긋난다 (랜딩이 반복해서 겪은
 *    사고 유형). 그래서 **가이드 HTML 을 실제로 파싱해** 회사명·날짜·시각을 대조한다.
 *    「예상」 카드(삼성·포스코·CJ)는 `data-due` 가 없어 자동으로 빠진다 — 확정만 들어온다.
 * 2. **회사명 미노출** (2026-09-03 CEO) — 랜딩은 개수·시기만 말한다. 데이터에는 이름이
 *    있으므로(대조용) 렌더 경로로 새어 나가는 것을 여기서 막는다.
 *
 * 시나리오:
 *  1. 데이터 ↔ 가이드 1:1 (회사명·날짜·시각 · 개수)
 *  2. 마감 전 (KST 2026-09-03) → 9곳 · 9월 · 가장 빠른 마감 D-4
 *  3. 일부 지남 (KST 2026-09-11) → 지난 4곳 제외 → 5곳 · D-2
 *  4. 전부 지남 (KST 2026-09-19) → 미렌더 (시즌 자동 소멸)
 *  5. 🔴 회사명 미노출
 *  6. D-day 는 KST 기준 (UTC 로는 전날인 시각에도 KST 오늘로 센다 — 픽스처는 TZ 무관)
 *  7. 「전체 일정」이 가이드 전문을 가리킨다
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import guideHtml from '../../../public/guide/gongchae-iljeong-2026-h2.html?raw'
import { SeasonStrip } from './SeasonStrip'
import { SEASON_DEADLINES, SEASON_GUIDE_HREF, getOpenSeason } from './seasonDeadlines'

/**
 * 시각을 KST 로 못 박는다 — `Date` 하나로 고정하므로 **테스트 러너 TZ 와 무관**하다.
 * 인자는 UTC 순간이고, 주석의 KST 는 그 순간을 서울에서 본 값이다.
 */
function atInstant(utcIso: string) {
  vi.setSystemTime(new Date(utcIso))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('시즌 데이터 ↔ 가이드 1:1', () => {
  /** 가이드 확정 카드 = `.acard[data-due]` (「예상」 카드는 data-due 가 없다) */
  const cards = Array.from(
    new DOMParser()
      .parseFromString(guideHtml, 'text/html')
      .querySelectorAll('.acard[data-due]'),
  ).map((card) => ({
    name: card.querySelector('h3')?.textContent?.trim() ?? '',
    date: card.getAttribute('data-due') ?? '',
    // "마감 9/7 (월) 16:00" 형태의 굵은 글씨에서 시각만 뽑는다
    time: card.querySelector('.ac-due strong')?.textContent?.match(/(\d{1,2}:\d{2})/)?.[1] ?? '',
  }))

  it('가이드 HTML 을 실제로 읽어왔다 (빈 결과면 아래 대조가 전부 무의미)', () => {
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.name && c.date && c.time)).toBe(true)
  })

  it('🔴 확정 공고 개수가 같다 (예상 카드가 새어 들어오지 않는다)', () => {
    expect(SEASON_DEADLINES).toHaveLength(cards.length)
  })

  it('🔴 회사명·마감 날짜·마감 시각이 한 글자도 다르지 않다', () => {
    // 배열 순서(가이드 카드 순서)까지 같아야 눈으로도 대조된다
    expect(SEASON_DEADLINES.map((d) => ({ ...d }))).toEqual(cards)
  })
})

describe('getOpenSeason — KST 오늘 기준', () => {
  it('마감 전 (KST 2026-09-03) → 확정 9곳 전부 · 가장 빠른 마감 D-4', () => {
    atInstant('2026-09-03T03:00:00Z') // KST 09-03 12:00
    expect(getOpenSeason()).toEqual({ count: 9, month: 9, nearestDday: 4 })
  })

  it('일부 지남 (KST 2026-09-11) → 지난 4곳 제외 · 가장 빠른 마감 D-2', () => {
    atInstant('2026-09-11T03:00:00Z') // KST 09-11 12:00 — KT·우리은행·현대엔지니어링·KT&G 마감
    expect(getOpenSeason()).toEqual({ count: 5, month: 9, nearestDday: 2 })
  })

  it('🔴 전부 지남 (KST 2026-09-19) → null (시즌 자동 소멸)', () => {
    atInstant('2026-09-19T03:00:00Z')
    expect(getOpenSeason()).toBeNull()
  })

  /**
   * 🔴 **KST 고정 앱이다.** UTC 로는 아직 9/6 인 순간에도 서울은 이미 9/7 이라, 마감이
   * 9/7 인 공고는 D-0 이어야 한다. 로컬 TZ 로 계산하면 여기서 하루 어긋난다
   * (`utils/dday.ts` 상단의 실사고 — 국내 기기에서는 안 터져서 오래 안 들킨다).
   */
  it('🔴 UTC 로는 전날인 시각에도 KST 오늘로 센다', () => {
    atInstant('2026-09-06T15:30:00Z') // UTC 09-06 · KST 09-07 00:30
    expect(getOpenSeason()).toEqual({ count: 9, month: 9, nearestDday: 0 })
  })
})

describe('SeasonStrip 렌더', () => {
  it('마감 전 → 개수·시기·가장 빠른 마감을 노출한다', () => {
    atInstant('2026-09-03T03:00:00Z')
    const { container } = render(<SeasonStrip />)
    const text = container.textContent ?? ''
    expect(text).toContain('9월 대기업 공채 마감 9곳')
    expect(text).toContain('가장 빠른 마감')
    expect(text).toContain('D-4')
  })

  it('일부 지남 → 남은 개수만 센다', () => {
    atInstant('2026-09-11T03:00:00Z')
    const { container } = render(<SeasonStrip />)
    expect(container.textContent).toContain('9월 대기업 공채 마감 5곳')
    expect(container.textContent).toContain('D-2')
  })

  it('🔴 전부 지남 → 아무것도 렌더하지 않는다', () => {
    atInstant('2026-09-19T03:00:00Z')
    const { container } = render(<SeasonStrip />)
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * 🔴 **랜딩에 회사명을 걸지 않는다** (2026-09-03 CEO). 데이터에는 이름이 있으므로
   * (가이드 대조용) 렌더로 새어 나가는 경로를 여기서 막는다.
   */
  it('🔴 회사명이 하나도 노출되지 않는다', () => {
    atInstant('2026-09-03T03:00:00Z')
    const { container } = render(<SeasonStrip />)
    const text = container.textContent ?? ''
    const leaked = SEASON_DEADLINES.filter((d) => text.includes(d.name)).map((d) => d.name)
    expect(leaked, `랜딩에 노출된 회사명: ${leaked.join(', ')}`).toEqual([])
  })

  it('「전체 일정」이 가이드 전문을 가리킨다', () => {
    atInstant('2026-09-03T03:00:00Z')
    render(<SeasonStrip />)
    expect(screen.getByRole('link', { name: /전체 일정/ })).toHaveAttribute(
      'href',
      SEASON_GUIDE_HREF,
    )
  })
})
