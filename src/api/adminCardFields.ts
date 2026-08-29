import { apiClient } from '@/api/client'

/**
 * 카드 입력 실태 — `GET /admin/card-fields`.
 *
 * **「사용자가 카드에 무엇을 실제로 채우는가」** 하나에 답한다. `OpsReach`(어디까지 갔나)와도,
 * `ActivationSection`(가입 직후 시작했나)과도 다른 질문이다.
 *
 * 🔴 **이 화면이 생긴 이유** — 2026-08-25 이전에는 이 질문을 로컬 dev DB 를 뒤져 답했다.
 * 그런데 로컬 카드 대부분이 **CEO 본인의 테스트 입력**이라 「채움률」·「표기 분산」 같은
 * 진단이 전부 한 사람의 타이핑 습관이었다. 서버 쿼리의 `role <> 'admin'` 한 줄이 그
 * 결함을 없앤다 — 관측은 운영에서, admin 표면을 통해서 한다.
 */

/** 직군 값이 어느 사전에서 왔는가 */
export type CategoryVocab = 'known' | 'freeform_repeated' | 'freeform_once'

export const CATEGORY_VOCAB_LABEL: Record<CategoryVocab, string> = {
  known: '온보딩 21개 목록',
  freeform_repeated: '목록 밖 · 반복됨',
  freeform_once: '목록 밖 · 1회',
}

export interface FieldFill {
  filled: number
}

export interface CategoryVocabBucket {
  vocab: CategoryVocab
  distinctValues: number
  cards: number
}

export interface CardFieldsData {
  cards: number
  users: number
  excluded: { adminCards: number; sampleCards: number }
  fields: {
    jobTitle: FieldFill
    jobCategory: FieldFill
    jobUrl: FieldFill
    memo: FieldFill
  }
  categoryVocab: {
    buckets: CategoryVocabBucket[]
    top: { value: string; cards: number; vocab: CategoryVocab }[]
  }
  jobTitleVariance: {
    usersWithJobTitle: number
    usersWithVariants: number
    groups: { variants: string[] }[]
  }
  /**
   * 직무 **원문** 빈도 — 사전 어휘 작업의 직접 재료.
   *
   * 위 `jobTitleVariance` 와 답하는 질문이 다르다. 저건 「한 사람이 흔들리나」라 사용자별로
   * 접고, 여기는 **전체가 무슨 말을 쓰나**라 표기 정규화만으로 접는다. 이게 없으면 직군
   * 「기타」를 고른 카드의 실체를 영영 못 본다 — 채움 수는 「적긴 적었다」까지다.
   *
   * 🔴 **옵셔널이다.** 프론트가 백엔드보다 먼저 뜨는 배포 창에서는 없다.
   */
  jobTitleTexts?: {
    /** 정규화 기준으로 접은 서로 다른 직무 수 (전수 — `top` 이 잘려도 이건 안 잘린다) */
    distinct: number
    /** 빈도순 상위 (서버 상한 50). 대표 표기는 최다 빈도 **원문 그대로** */
    top: { value: string; cards: number }[]
  }
  status: Record<string, number>
  stepProgress: { atFirstStep: number; moved: number; noSteps: number }
  companyMatch: {
    distinctNames: number
    matchedNames: number
    topUnmatched: { name: string; cards: number }[]
  }
  templateId: { recorded: number; distribution: Record<string, number> }
  createdVia: { recorded: number; distribution: Record<string, number> }
  /**
   * 추천 템플릿을 **그대로 썼나** — 「맞는 템플릿이면 쓴다」 가설의 직접 근거.
   *
   * 🔴 **옵셔널이다.** 프론트가 백엔드보다 먼저 뜨는 배포 창에서는 이 필드가 없다.
   * `assertCardFieldsData` 가 이걸 필수로 요구하면 그 창 동안 **화면 전체가 에러**가 된다 —
   * 새 지표 하나 때문에 기존 지표까지 못 보게 만들 이유가 없다.
   */
  templateUsage?: {
    withTemplate: number
    keptAsIs: number
    byTemplate: { templateId: string; count: number; kept: number }[]
  }
  generatedAt: string
}

/**
 * 🔴 백엔드는 모든 응답을 `{ data, message }` 로 감싼다 (`ResponseTransformInterceptor`).
 * 형제 API(`adminReach`·`admin`)와 같은 `unwrap` 을 쓴다.
 */
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 🔴 서버 응답을 신뢰하지 않는다 — 배포 창(프론트가 백엔드보다 먼저 뜨는 구간)에 필드가 없을 수 있다.
 *
 * **다만 빠진 값을 0 으로 채우지 않는다.** `?? 0` 은 *"모른다"* 를 *"0장이다"* 라는 **거짓 주장**으로
 * 바꾼다. 이 화면은 그 숫자로 제품 결정을 하는 곳이라 거짓 0 이 가장 비싼 실패다 —
 * 형태가 깨졌으면 **에러로 올려** "불러오지 못했어요" 를 띄운다 (`adminReach` 와 같은 판단).
 */
function assertCardFieldsData(raw: unknown): CardFieldsData {
  const d = raw as Partial<CardFieldsData> | null
  if (
    !d ||
    typeof d.cards !== 'number' ||
    typeof d.users !== 'number' ||
    !d.fields ||
    !d.categoryVocab ||
    !Array.isArray(d.categoryVocab.buckets) ||
    !d.jobTitleVariance ||
    !d.companyMatch ||
    !d.stepProgress
  ) {
    throw new Error('카드 입력 실태 응답 형태가 올바르지 않습니다')
  }
  return d as CardFieldsData
}

/**
 * @param force 서버 5분 캐시를 건너뛴다 (`?refresh=1`).
 *
 * 🔴 **평소 조회에는 쓰지 않는다.** 새로고침이 기본이 되면 캐시가 무의미해진다.
 * 사용자가 「새로고침」을 명시적으로 눌렀을 때만 참으로 넘긴다.
 */
export const getAdminCardFields = (force = false) =>
  apiClient
    .get(force ? '/admin/card-fields?refresh=1' : '/admin/card-fields')
    .then(unwrap<CardFieldsData>)
    .then(assertCardFieldsData)
