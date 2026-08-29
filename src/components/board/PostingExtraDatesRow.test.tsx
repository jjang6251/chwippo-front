/**
 * 카드 상세 「공고 일정」 줄.
 *
 * ## 케이스 목록
 * 1. 일정이 없으면 줄 자체가 없다 (사람이 만든 카드엔 영원히 안 뜬다)
 * 2. 개수·축약 캡션·목록
 * 3. 🔴 시각이 있으면 시각까지 · 없으면 날짜만 — **KST 기준**
 * 4. 시각이 자정이면 시각을 안 적는다 (「미정」과 구분이 안 되는 값이라)
 * 5. 🔴 **날짜만 온 값(서버 계약)에 시각을 지어내지 않는다** (2026-08-29 실측: 09:00 이 붙었다)
 * 6. 읽을 수 없는 값은 「—」
 */
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PostingExtraDatesRow } from './PostingExtraDatesRow'
import type { Application, PostingExtraDate } from '@/types/application'

function app(extraDates: PostingExtraDate[] | null): Application {
  return {
    id: 'app-1',
    userId: 'u1',
    companyName: '무신사',
    jobTitle: null,
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    postingMeta: extraDates
      ? {
          filled: [],
          deadlineKind: null,
          jobPicked: null,
          companySource: null,
          editedFields: [],
          reviewedAt: null,
          extraDates,
          callCount: 1,
        }
      : null,
    createdAt: '',
    updatedAt: '',
  }
}

afterEach(cleanup)

describe('공고 일정 줄', () => {
  it('1) 일정이 없으면 아무것도 안 그린다', () => {
    const { container } = render(<PostingExtraDatesRow app={app(null)} />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    const { container: c2 } = render(<PostingExtraDatesRow app={app([])} />)
    expect(c2).toBeEmptyDOMElement()
  })

  it('2·3·4) 개수·캡션·날짜 표기', () => {
    render(
      <PostingExtraDatesRow
        app={app([
          // 시각 없음 (자정) → 날짜만
          { label: '서류 합격 발표', date: '2026-09-22T00:00:00+09:00', noteId: 'n1' },
          // 시각 있음 → 시각까지
          { label: '신체검사', date: '2026-10-30T14:00:00+09:00', noteId: 'n2' },
        ])}
      />,
    )
    expect(screen.getByText('공고 일정')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/발표·검진은 캘린더에 넣었어요/)).toBeInTheDocument()
    expect(screen.getByText('9월 22일 (화)')).toBeInTheDocument()
    expect(screen.getByText('10월 30일 (금) 14:00')).toBeInTheDocument()
  })

  it('5) 🔴 날짜만 온 일정(서버 계약)에 시각이 붙지 않는다', () => {
    render(
      <PostingExtraDatesRow
        app={app([
          { label: '서류 합격 발표', date: '2026-09-22', noteId: 'n1' },
          { label: '신체검사', date: '2026-10-30T14:00', noteId: 'n2' },
        ])}
      />,
    )
    expect(screen.getByText('9월 22일 (화)')).toBeInTheDocument()
    expect(screen.queryByText(/9월 22일 \(화\) \d{2}:\d{2}/)).toBeNull()
    expect(screen.getByText('10월 30일 (금) 14:00')).toBeInTheDocument()
  })

  it('6) 읽을 수 없는 값은 「—」', () => {
    render(<PostingExtraDatesRow app={app([{ label: '발표', date: 'nope', noteId: 'n1' }])} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('3-b) 🔴 UTC 자정 근처도 KST 날짜로 읽는다', () => {
    // 2026-09-21T15:30Z = KST 9/22 00:30 — 기기 TZ 와 무관하게 9월 22일이어야 한다
    render(
      <PostingExtraDatesRow
        app={app([{ label: '발표', date: '2026-09-21T15:30:00Z', noteId: 'n1' }])}
      />,
    )
    expect(screen.getByText('9월 22일 (화) 00:30')).toBeInTheDocument()
  })
})
