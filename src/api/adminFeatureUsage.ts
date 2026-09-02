import { apiClient } from '@/api/client'

/**
 * 기능 사용 실태 — `GET /admin/feature-usage`.
 *
 * **「누가 어떤 기능을 얼마나 쓰는가」** 하나에 답한다.
 * `OpsReach`(가입 후 어디까지 갔나)와도 `CardFieldsSection`(카드에 무엇을 채우나)과도
 * 다른 질문이다 — 저 둘은 각각 한 축(자소서 퍼널 · 카드)만 본다.
 *
 * 🔴 **기능 목록을 프론트가 들고 있지 않다.** 서버가 `label`·`depthUnit`·`dateBasis` 를
 * 같이 주고, 화면은 `features[]` 순서대로 그린다. 기능이 늘 때마다 두 레포를 같이 고쳐야
 * 하는 구조를 만들면 배포 창에서 **화면에만 없는 기능**이 생긴다.
 */

/**
 * 🔴 **캐시 키를 API 파일이 들고 있다.** `/ops/feature-usage` 와 회원 상세의 「기능 사용」
 * 섹션이 **같은 응답**을 쓴다 — 키가 갈라지면 같은 화면 안에서 두 번 받아 오고,
 * 새로고침 버튼이 한쪽만 갱신하게 된다.
 */
export const FEATURE_USAGE_QUERY_KEY = ['admin', 'feature-usage'] as const

/** 사용 횟수 분포 — 「한 번 써 보고 말았다」와 「돌아왔다」를 가르는 칸 */
export interface FeatureBuckets {
  one: number
  twoToFour: number
  fivePlus: number
}

export interface FeatureStat {
  /** 서버가 정하는 기능 키 — 프론트는 union 으로 좁히지 않는다 (배포 창에 새 키가 온다) */
  key: string
  label: string
  usersEver: number
  /** 🔴 `null` = **잴 수 없음**(행에 생성 시각이 없는 기능). 0("아무도 재방문 안 함")이 아니다 */
  usersMultiDay: number | null
  buckets: FeatureBuckets
  /** 깊이 프록시의 사용자 중앙값. 쓴 사람이 0명이면 `null` */
  depthMedian: number | null
  /** 깊이의 단위 — 기능마다 다르므로 값 옆에 항상 같이 적는다 */
  depthUnit: string
  usersLast7d: number | null
  /** 날짜 축이 무엇인지 (또는 왜 없는지) */
  dateBasis: string
}

export interface UserFeatureCell {
  count: number
  lastUsedAt: string | null
}

export interface FeatureUsageUserRow {
  userId: string
  nickname: string
  joinedAt: string
  /** 🔴 **쓴 기능만** 들어 있다. 없는 키 = 0회 */
  perFeature: Record<string, UserFeatureCell | undefined>
}

export interface RetentionRow {
  cohortWeek: string
  size: number
  /** 🔴 `null` = **아직 그 주가 시작되지 않음**. 0 과 화면에서 반드시 달라 보여야 한다 */
  week1: number | null
  week2: number | null
  week3: number | null
  week4: number | null
}

export interface FeatureUsageData {
  generatedAt: string
  excludedAdmins: number
  totalUsers: number
  features: FeatureStat[]
  users: FeatureUsageUserRow[]
  retention: RetentionRow[]
}

/**
 * 🔴 백엔드는 모든 응답을 `{ data, message }` 로 감싼다 (`ResponseTransformInterceptor`).
 * 형제 API(`adminReach`·`adminCardFields`)와 같은 `unwrap` 을 쓴다.
 */
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 🔴 **빠진 값을 0 으로 채우지 않는다.** `?? 0` 은 *"모른다"* 를 *"0명이다"* 라는 거짓 주장으로
 * 바꾼다. 이 화면은 그 숫자로 제품 결정을 하는 곳이라 거짓 0 이 가장 비싼 실패다 —
 * 형태가 깨졌으면 에러로 올려 "불러오지 못했어요" 를 띄운다 (`adminCardFields` 와 같은 판단).
 */
function assertFeatureUsageData(raw: unknown): FeatureUsageData {
  const d = raw as Partial<FeatureUsageData> | null
  if (
    !d ||
    typeof d.generatedAt !== 'string' ||
    typeof d.totalUsers !== 'number' ||
    typeof d.excludedAdmins !== 'number' ||
    !Array.isArray(d.features) ||
    !Array.isArray(d.users) ||
    !Array.isArray(d.retention)
  ) {
    throw new Error('기능 사용 실태 응답 형태가 올바르지 않습니다')
  }
  return d as FeatureUsageData
}

/**
 * @param force 서버 5분 캐시를 건너뛴다 (`?refresh=1`).
 *
 * 🔴 **평소 조회에는 쓰지 않는다.** 새로고침이 기본이 되면 캐시가 무의미해진다.
 */
export const getAdminFeatureUsage = (force = false) =>
  apiClient
    .get(force ? '/admin/feature-usage?refresh=1' : '/admin/feature-usage')
    .then(unwrap<FeatureUsageData>)
    .then(assertFeatureUsageData)

/** 매트릭스 한 칸 — 없는 키는 0회 (서버가 쓴 기능만 담는다) */
export function cellCount(
  row: FeatureUsageUserRow,
  key: string,
): number {
  // Object.hasOwn 금지 — ES2022, iOS 15.4 미만 WebKit 크래시 (routeMeta.ts 참조)
  const has = Object.prototype.hasOwnProperty.call(row.perFeature, key)
  return has ? (row.perFeature[key]?.count ?? 0) : 0
}
