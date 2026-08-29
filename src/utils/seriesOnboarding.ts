import { JOB_SERIES } from '@/utils/jobRole'

/**
 * 온보딩 **즉시 보상**의 재료 — 계열 14벌의 면접 질문 3개 + 조사가 준비된 회사.
 *
 * ## 왜 정적 사전인가
 *
 * 가입 직후 계열을 한 번 눌렀을 때 **그 자리에서** 뭔가가 돌아와야 「앱이 작동하는구나」가
 * 성립한다. 서버 왕복·LLM 호출을 끼우면 그 순간에 스피너가 뜨고, 실패하면 보상이 통째로
 * 사라진다 — 보상은 재고 걱정이 없어야 한다. 그래서 번들에 싣는다.
 *
 * ## 2단 구조 (`plans/job-role-first.md` — 보상 2단)
 *
 * | 단 | 내용 | 성립 조건 |
 * |---|---|---|
 * | 1단 | 전형 흐름 + 면접 질문 3개 | **없음** — 14계열 전부 있다 |
 * | 2단 | 조사가 준비된 회사 칩 | 그 계열 회사 **3개 이상** (`hasCompanyReward`) |
 *
 * 🔴 **회사명은 조사 시드(`data-seeds`) 표기와 글자 하나까지 같아야 한다.** 여기서 고른
 * 회사가 카드가 되고, 그 카드가 회사 조사 캐시를 찾을 때 쓰는 키가 **회사명 문자열**이다
 * (`normalizeCompanyName` = trim + lowercase 뿐 — 내부 공백도 안 지운다). 「하이브」를
 * 「HYBE」로 적는 순간 「조사가 준비돼 있어요」라고 말해 놓고 조사가 안 나온다.
 *
 * 🔴 **회사는 계열당 수동 매핑이다.** 시드에 업종 필드가 없어 자동 매칭이 불가능하다
 * (`plans/job-role-first.md` 8/28 결정 ②). 시드가 늘면 여기를 손으로 넓힌다.
 */
export interface SeriesOnboardingContent {
  /** 정확히 3개 — 더 주면 읽지 않고, 덜 주면 「예시가 빈약하다」로 읽힌다 */
  questions: [string, string, string]
  /** 조사가 준비된 회사 (최대 6). 3개 미만이면 2단을 통째로 숨긴다 */
  companies: string[]
}

/** 계열 id 유니온 — `JOB_SERIES` 의 id 를 문자열 그대로 못 박는다 */
export type JobSeriesId =
  | 'it'
  | 'office'
  | 'finance'
  | 'health'
  | 'education'
  | 'public'
  | 'research'
  | 'manufacturing'
  | 'construction'
  | 'sales'
  | 'media'
  | 'logistics'
  | 'agriculture'
  | 'marketing'

export const SERIES_ONBOARDING: Record<JobSeriesId, SeriesOnboardingContent> = {
  it: {
    questions: [
      '최근에 해결한 가장 어려운 기술 문제는 무엇이었나요?',
      '코드 리뷰에서 의견이 갈리면 어떻게 하나요?',
      '우리 서비스에서 개선하고 싶은 기능이 있나요?',
    ],
    companies: ['네이버', '카카오', '쿠팡', '토스', '라인', '우아한형제들'],
  },
  office: {
    questions: [
      '여러 부서의 이해관계가 충돌할 때 조율한 경험이 있나요?',
      '데이터로 문제를 먼저 발견한 경험이 있나요?',
      '지원 직무에서 3년 뒤 어떤 모습이고 싶나요?',
    ],
    companies: ['삼성전자', 'CJ제일제당', '현대자동차', 'LG전자', '롯데지주', 'SK텔레콤'],
  },
  finance: {
    questions: [
      '최근 금리 변화가 우리 회사에 어떤 영향을 줄까요?',
      '고객 자산을 다룰 때 가장 중요한 가치는 무엇인가요?',
      '숫자에 강하다는 걸 보여준 경험이 있나요?',
    ],
    companies: ['KB국민은행', '신한은행', '하나은행', '삼성화재', '미래에셋증권', '신한카드'],
  },
  health: {
    questions: [
      '환자·보호자와 갈등이 생겼을 때 어떻게 대처했나요?',
      '교대·야간 근무를 어떻게 관리할 계획인가요?',
      '실습 중 가장 기억에 남는 순간은 무엇인가요?',
    ],
    companies: ['삼성바이오로직스', '유한양행', '대전성모병원', '씨젠', '녹십자', '대한적십자사'],
  },
  education: {
    questions: [
      '학생이 수업에 흥미를 잃었을 때 어떻게 하나요?',
      '학부모 민원에는 어떻게 대응하나요?',
      '본인이 생각하는 좋은 교사란 무엇인가요?',
    ],
    // 🔴 4개 — 2단 노출 하한(3)을 겨우 넘긴다. 조사 배치가 늘면 여기가 먼저 넓어진다
    companies: ['메가스터디교육', '웅진씽크빅', '데이원컴퍼니', 'KT밀리의서재'],
  },
  public: {
    questions: [
      '공직자에게 가장 중요한 가치는 무엇이라고 생각하나요?',
      '민원인이 부당한 요구를 할 때 어떻게 하나요?',
      '우리 기관의 최근 사업 중 아는 것이 있나요?',
    ],
    companies: [
      '국민건강보험공단',
      '한국전력공사',
      '인천국제공항공사',
      '한국토지주택공사',
      '한국철도공사',
      '근로복지공단',
    ],
  },
  research: {
    questions: [
      '졸업 연구를 3분 안에 설명해 주세요.',
      '실험이 계속 실패했을 때 어떻게 했나요?',
      '우리 회사 연구 분야에서 관심 있는 주제는 무엇인가요?',
    ],
    companies: ['삼성전자', 'SK하이닉스', 'LG화학', '셀트리온', '한미약품', '한국항공우주'],
  },
  manufacturing: {
    questions: [
      '안전 규정을 어기는 동료를 봤을 때 어떻게 하나요?',
      '현장에서 불량이 반복되면 무엇부터 확인하나요?',
      '교대 근무와 현장 배치에 대해 어떻게 생각하나요?',
    ],
    companies: [
      '현대자동차',
      'SK하이닉스',
      'LG에너지솔루션',
      'POSCO홀딩스',
      'HD현대중공업',
      '한화에어로스페이스',
    ],
  },
  construction: {
    questions: [
      '공기가 지연될 때 무엇부터 조정하나요?',
      '현장 안전사고를 줄이기 위한 방법은 무엇인가요?',
      '지방·해외 현장 배치가 가능한가요?',
    ],
    companies: ['현대건설', '삼성물산', 'GS건설', 'DL이앤씨', '대우건설', '현대엔지니어링'],
  },
  sales: {
    questions: [
      '까다로운 고객을 응대한 경험이 있나요?',
      '매출 목표를 못 채울 것 같을 때 어떻게 하나요?',
      '우리 매장·서비스를 이용해 본 소감은 어떤가요?',
    ],
    companies: ['이마트', '롯데쇼핑', '아모레퍼시픽', '스타벅스코리아', '호텔신라', '대한항공'],
  },
  media: {
    questions: [
      '포트폴리오에서 가장 아끼는 작업과 그 이유는 무엇인가요?',
      '요즘 주목하는 콘텐츠·트렌드는 무엇인가요?',
      '마감이 촉박할 때 퀄리티를 어떻게 지키나요?',
    ],
    companies: ['CJ ENM', '하이브', '에스엠', '스튜디오드래곤', '제일기획', '넥슨'],
  },
  logistics: {
    questions: [
      '배송·운송이 지연됐을 때 우선순위를 어떻게 정하나요?',
      '체력·교대 근무에 대한 준비가 되어 있나요?',
      '물류 비용을 줄일 아이디어가 있나요?',
    ],
    companies: ['CJ대한통운', '대한항공', '현대글로비스', 'HMM', '인천국제공항공사', '한국철도공사'],
  },
  agriculture: {
    questions: [
      '농업·수산업의 미래를 어떻게 보나요?',
      '현장·지방 근무가 가능한가요?',
      '우리 회사 제품을 써본 경험이 있나요?',
    ],
    // 🔴 4개 — education 과 같은 이유로 하한 근처다
    companies: ['하림', '동원산업', '사조산업', '농협중앙회'],
  },
  marketing: {
    questions: [
      '최근 인상 깊었던 캠페인과 그 이유는 무엇인가요?',
      '예산이 절반으로 줄면 어디에 쓰겠어요?',
      '우리 브랜드의 약점은 무엇이라고 보나요?',
    ],
    companies: ['제일기획', '이노션', '아모레퍼시픽', '무신사', '오늘의집', 'CJ ENM'],
  },
}

/**
 * 2단(회사 담기) 노출 하한 — **조사 3개 미만이면 숨긴다** (CEO 2026-08-25 Q1).
 *
 * 회사를 한둘만 보여주면 「이것밖에 없나」가 되어 보상이 되레 실망이 된다.
 * 1단(전형·질문)은 이 판정과 무관하게 **항상** 나가므로, 숨겨도 빈손으로 끝나지 않는다.
 */
const MIN_COMPANIES_FOR_REWARD = 3

/**
 * 세밀 그룹 전용 회사 목록 — 계열 목록보다 **먼저** 본다 (CEO 2026-08-28 A안).
 *
 * 계열 단위로만 추천하면 「승무원」을 친 사람에게 이마트·롯데쇼핑이 뜬다 (영업·판매·서비스
 * 계열). 직무를 쳐서 세밀 그룹이 확정된 사람에게는 그 그룹 회사를 보여준다.
 *
 * 🔴 **빈 배열 = 그 그룹은 2단을 숨긴다.** 시드(대기업·상장사 중심)에 맞는 회사가 없는
 * 그룹(경찰·군인·돌봄·스포츠·보안·인문 연구)에 계열 회사를 대신 보여주면 「경찰 준비하는데
 * 한국전력?」이 된다 — 엉뚱한 회사보다 안 보이는 게 낫다. 채우는 건 코드가 아니라 조사
 * 배치의 일이다 (`data-seeds/RESEARCH-PROGRESS.md` 7차 요청).
 *
 * 항목이 없는 세밀 그룹은 계열 목록으로 떨어진다. 키는 `JOB_FINE_GROUPS` 의 id 다.
 */
export const FINE_COMPANIES: Record<string, string[]> = {
  'finance-public': ['한국은행', '한국산업은행', 'IBK기업은행', '신용보증기금', '한국무역보험공사', '새마을금고중앙회'],
  'health-welfare': ['국민연금공단', '국민건강보험공단', '근로복지공단', '대한적십자사'],
  'health-care': [],
  'public-safety': [],
  'public-military': [],
  'research-humanities': [],
  'mfg-machine': ['현대자동차', 'HD현대중공업', '두산에너빌리티', '현대로템', '현대위아', 'HL만도'],
  'mfg-metal': ['현대제철', 'POSCO홀딩스', '고려아연', '풍산', '동국제강', '세아제강'],
  'mfg-electric': ['삼성전자', 'LG전자', 'SK하이닉스', '삼성SDI', 'LG이노텍', '삼성전기'],
  'mfg-telecom': ['SK텔레콤', 'KT', 'LG유플러스', '한화시스템', 'LG전자', '삼성전자'],
  'mfg-chemical': ['LG화학', '롯데케미칼', 'SK이노베이션', '한화솔루션', '금호석유화학', '코오롱인더스트리'],
  'mfg-textile': ['효성티앤씨', '휴비스', '한세실업', '영원무역', 'F&F', '신성통상'],
  'mfg-food': ['CJ제일제당', '오뚜기', '농심', '오리온', '롯데웰푸드', '풀무원'],
  'construction-design': ['간삼건축', '희림', '현대엔지니어링', '삼성E&A', 'DL이앤씨', '현대건설'],
  'sales-travel': ['대한항공', '아시아나항공', '제주항공', '진에어', '에어부산', '호텔신라'],
  'sales-food': ['스타벅스코리아', '교촌에프앤비', 'CJ프레시웨이', '신세계푸드', '하이트진로', '롯데칠성음료'],
  'sales-beauty': ['아모레퍼시픽', 'LG생활건강', '코스맥스', '한국콜마', '클리오', '에이피알'],
  'sales-security': [],
  'sales-personal': [],
  'media-art': ['CJ ENM', '하이브', '에스엠', 'JYP Ent.', '와이지엔터테인먼트', '스튜디오드래곤'],
  'media-sports': [],
  'logistics-transport': ['CJ대한통운', '현대글로비스', 'HMM', '한진', '팬오션', '대한항공'],
}

/**
 * 보상 2단에 보여줄 회사 — 세밀 그룹 전용 목록이 있으면 그것(빈 배열 포함), 없으면 계열 목록.
 * 호출부가 「직무의 계열 = 고른 계열」일 때만 `fineId` 를 넘긴다 — 직무는 승무원인데
 * pill 을 IT 로 바꿨으면 IT 계열 목록이 맞다.
 */
export function getRewardCompanies(
  seriesId: string | null | undefined,
  fineId: string | null | undefined,
): string[] {
  if (fineId && Object.prototype.hasOwnProperty.call(FINE_COMPANIES, fineId)) {
    return FINE_COMPANIES[fineId]
  }
  return getSeriesCompanies(seriesId)
}

/** 알 수 없는 계열 id 에도 던지지 않는다 — 렌더 중 호출이다 */
export function hasCompanyReward(
  seriesId: string | null | undefined,
  fineId?: string | null,
): boolean {
  return getRewardCompanies(seriesId, fineId).length >= MIN_COMPANIES_FOR_REWARD
}

export function getSeriesOnboarding(
  seriesId: string | null | undefined,
): SeriesOnboardingContent | null {
  if (!seriesId) return null
  // Object.hasOwn 금지 — ES2022, iOS 15.4 미만 WebKit 크래시
  return Object.prototype.hasOwnProperty.call(SERIES_ONBOARDING, seriesId)
    ? SERIES_ONBOARDING[seriesId as JobSeriesId]
    : null
}

export function getSeriesCompanies(seriesId: string | null | undefined): string[] {
  return getSeriesOnboarding(seriesId)?.companies ?? []
}

/** 계열 라벨 — 사전은 id 만 알고, 화면 문구는 `JOB_SERIES` 단일 소스에서 가져온다 */
export function getSeriesLabel(seriesId: string | null | undefined): string | null {
  if (!seriesId) return null
  return JOB_SERIES.find((s) => s.id === seriesId)?.label ?? null
}
