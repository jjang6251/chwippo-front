import { calcDday } from '@/utils/dday'

/**
 * 2026 하반기 공채 — **확정 공고**의 마감일.
 *
 * 출처는 `public/guide/gongchae-iljeong-2026-h2.html` 한 곳이다 (기준일 2026-09-01,
 * 각사 공식 채용 공고를 직접 열어 확인한 9개사). 「예상」으로 표기된 삼성·포스코·CJ 는
 * **확정이 아니라 예년 관례**라 여기 없다 — 랜딩이 확정처럼 말하면 그 자체가 거짓말이 된다.
 *
 * 🔴 **가이드와 1:1 이어야 한다.** 같은 사실을 두 곳에 적으면 한쪽만 고쳐지고 조용히
 * 어긋난다(랜딩이 반복해서 겪은 사고 유형이다). 그래서 `SeasonStrip.test.tsx` 가 가이드
 * HTML 을 실제로 파싱해 회사명·날짜·시각을 이 표와 대조한다 — 어긋나면 spec 이 운다.
 *
 * 🔴 **`name` 은 랜딩에 렌더하지 않는다** (2026-09-03 CEO). 랜딩에서 특정 회사를 이름으로
 * 거는 것은 하지 않기로 했고, 스트립은 **개수·시기만** 말한다. 이름을 여기 남겨 두는 이유는
 * 위 대조 검사와 사람이 읽는 근거를 위해서다 — 렌더 경로로 새어 나가면 spec 이 잡는다.
 *
 * 배열 순서는 **가이드 카드 순서 그대로** 둔다 (대조가 눈으로도 되게). 임박순 정렬은
 * `getOpenSeason` 이 날짜+시각으로 따로 한다 — 가이드는 같은 날 안에서 시각순이 아니다.
 */
export interface SeasonDeadline {
  /** 회사명 — 🔴 랜딩 렌더 금지. 가이드 대조·근거용 */
  name: string
  /** 마감 날짜 (KST, YYYY-MM-DD) */
  date: string
  /** 마감 시각 (KST, HH:mm) — 같은 날 안의 임박순 정렬 기준 */
  time: string
}

export const SEASON_DEADLINES: readonly SeasonDeadline[] = [
  { name: 'KT', date: '2026-09-07', time: '16:00' },
  { name: '우리은행', date: '2026-09-08', time: '14:00' },
  { name: '현대엔지니어링', date: '2026-09-09', time: '23:59' },
  { name: 'KT&G', date: '2026-09-10', time: '15:00' },
  { name: 'LG전자', date: '2026-09-13', time: '23:00' },
  { name: '현대자동차', date: '2026-09-14', time: '17:00' },
  { name: 'IBK기업은행', date: '2026-09-14', time: '10:00' },
  { name: '현대카드·현대커머셜', date: '2026-09-14', time: '10:00' },
  { name: '한화금융 신입공채', date: '2026-09-18', time: '15:00' },
]

/** 가이드 전문 — 스트립의 「전체 일정」 도착지 */
export const SEASON_GUIDE_HREF = '/guide/gongchae-iljeong-2026-h2.html'

export interface OpenSeason {
  /** 아직 마감 안 지난 확정 공고 수 */
  count: number
  /** 가장 임박한 마감의 월 (시기 표기용) */
  month: number
  /** 가장 임박한 마감까지 남은 일수 (KST) */
  nearestDday: number
}

/**
 * KST 오늘 기준 **아직 마감 안 지난** 확정 공고 요약. 하나도 안 남으면 `null` —
 * 호출부가 스트립 자체를 렌더하지 않는다 (**시즌이 끝나면 자동으로 사라진다**).
 *
 * 🔴 D-day 는 반드시 `calcDday` 다. 인라인 `dayjs().diff` 는 **기기 로컬 TZ** 를 타서
 * 해외 체류·기기 TZ 오설정에서 하루 어긋난다 (`utils/dday.ts` 상단 사고 기록).
 *
 * ⚠️ 마감 판정은 **날짜 단위**다 — 마감 시각이 지난 당일 오후에도 그날은 남은 것으로 센다.
 * 가이드 페이지의 D-day 스크립트와 같은 기준이라 두 화면이 어긋나지 않는다.
 */
export function getOpenSeason(): OpenSeason | null {
  const open = SEASON_DEADLINES.map((d) => ({ ...d, dday: calcDday(d.date) }))
    .filter((d) => Number.isFinite(d.dday) && d.dday >= 0)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))

  const nearest = open[0]
  if (!nearest) return null

  return {
    count: open.length,
    month: Number(nearest.date.slice(5, 7)),
    nearestDday: nearest.dday,
  }
}
