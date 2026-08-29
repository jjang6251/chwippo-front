import { addDays, todayLocal } from '@/utils/datetime'
import type { Application, ApplicationStep } from '@/types/application'

/**
 * 앱 소개 투어의 **고정 쇼케이스 이야기** — 무신사 · 브랜드 마케터 (v3).
 *
 * ## 왜 개인화를 버렸나
 *
 * v2 는 1장 카드를 그 사람 회사로, 4·5장 문장을 그 사람 계열 사전으로 채웠다. 그런데
 * **둘이 서로 다른 이야기를 했다** — 대한항공 카드를 보여준 다음 자소서 장면에서 갑자기
 * 다른 맥락이 나오면 「이게 내 카드 얘기인가?」가 되어 오히려 헷갈린다 (CEO 2차 실기).
 *
 * v3 는 **한 사람의 한 지원**을 일곱 장에 걸쳐 따라간다:
 * 카드를 만들고 → 단계를 옮기고 → 회사를 조사하고 → 자소서를 쓰고 → 면접을 연습하고 →
 * 노트에 쌓고 → **그리고 마지막에 내 카드로 돌아온다.**
 *
 * 🔴 **「예시」 표기는 1장 헤더 pill 한 번뿐이다.** 장면마다 반복하면 화면이 계속
 * 「이건 가짜예요」라고 말하게 되어 이야기에 몰입할 수 없다. 한 번 말했으면 충분하다.
 *
 * ## 왜 무신사인가
 *
 * 조사 시드에 실제로 들어 있는 회사고(아래 값은 시드 표기 그대로), 취준생 인지도가 높으며,
 * 「온라인 → 오프라인 확장」이라는 **면접에서 실제로 묻는 서사**가 있다. 마케터 직무는
 * 자소서·면접 예문이 특정 전공 지식 없이도 읽힌다.
 */

/** 무대 카드의 안정적인 id — 서버에 없는 합성 카드다 (상호작용은 `inert` 로 통째 차단) */
export const SHOWCASE_APP_ID = 'tour-showcase'

export const SHOWCASE_COMPANY = '무신사'
export const SHOWCASE_JOB = '브랜드 마케터'
/** `utils/tags` 의 색·아이콘이 있는 값이어야 한다 — 없으면 무색 태그가 된다 */
export const SHOWCASE_CATEGORY = '마케팅·광고·홍보'

/** `marketing` 템플릿 그대로 (`utils/stepTemplates`) — 실제 카드가 받는 단계와 같다 */
export const SHOWCASE_STEPS = [
  '서류 제출',
  '과제(기획안)',
  '1차 실무면접',
  '2차 면접',
  '최종 합격',
] as const

/**
 * 현재 단계 = 과제(기획안). 2장에서 여기서부터 **최종 합격까지** 세 칸을 옮겨간다
 * (과제 → 1차 실무면접 → 2차 면접 → 최종 합격).
 */
export const SHOWCASE_STEP_INDEX = 1
export const SHOWCASE_NEXT_STEP_INDEX = 2
export const SHOWCASE_SECOND_STEP_INDEX = 3
export const SHOWCASE_FINAL_STEP_INDEX = 4
export const SHOWCASE_INTERVIEW_STEP = SHOWCASE_STEPS[SHOWCASE_NEXT_STEP_INDEX]

/**
 * 옮겨 다니는 네 단계에 전부 날짜가 있다 — **2장의 연출이 성립하려면 전부 필요하다.**
 *
 * 카드의 D-day 배지는 **현재 단계의 날짜**를 본다(`CompanyCard`). 1차 실무면접에만 날짜를
 * 주면 1장 카드에는 배지가 아예 없고, 2장에서 「없음 → D-5」가 되어 *바뀌는* 게 아니라
 * *생기는* 것으로 보인다. 「단계를 옮기면 D-day 가 **따라온다**」를 보여주려면 옮기기 전에도,
 * 그리고 옮겨간 뒤에도 배지가 있어야 한다. 그래서 D-2 → D-5 → D-12 다.
 * (최종 합격 단계는 카드가 `PASSED` 로 바뀌어 배지 자리가 「🎉 합격」에 넘어간다.)
 *
 * 🔴 날짜는 **KST 헬퍼로만** 만든다 — ISO 문자열 앞 10자를 잘라 쓰는 방식은 기기 TZ 를
 * 타서 해외·TZ 오설정 기기에서 하루 어긋난다 (`utils/datetime` 규칙 · CI 가드가 그 패턴을
 * 주석까지 잡으므로 여기엔 패턴을 적지 않는다).
 */
export const SHOWCASE_DDAY_TASK = 2
export const SHOWCASE_DDAY_INTERVIEW = 5
export const SHOWCASE_DDAY_SECOND = 12
export const SHOWCASE_DDAY_FINAL = 20

/**
 * 2장 캘린더 칸 **아래 8px 라벨** — 원 단계 이름은 안 들어간다.
 *
 * 🔴 칸 폭이 43px(390 화면)뿐이라 「1차 실무면접」(6자)은 8px 로도 넘친다. 잘라서 「1차 실…」로
 * 두면 무슨 단계인지 못 읽으니 **줄여서 온전한 말**로 준다 — 라벨의 목적은 「이 날에 뭐가
 * 있나」이지 정식 명칭 표기가 아니다. 최종 칸은 그 자리에서 합격까지 말한다.
 */
export const SHOWCASE_STEP_SHORT: Record<number, string> = {
  1: '과제',
  2: '1차 면접',
  3: '2차 면접',
  4: '합격 🎉',
}

/** 단계 인덱스 → 오늘로부터 며칠 뒤. 없는 단계(서류 제출)는 날짜가 없다 */
const STEP_DDAYS: Record<number, number> = {
  [SHOWCASE_STEP_INDEX]: SHOWCASE_DDAY_TASK,
  [SHOWCASE_NEXT_STEP_INDEX]: SHOWCASE_DDAY_INTERVIEW,
  [SHOWCASE_SECOND_STEP_INDEX]: SHOWCASE_DDAY_SECOND,
  [SHOWCASE_FINAL_STEP_INDEX]: SHOWCASE_DDAY_FINAL,
}

function stepDate(days: number): string {
  return addDays(todayLocal(), days)
}

function makeSteps(): ApplicationStep[] {
  return SHOWCASE_STEPS.map((name, i) => ({
    id: `${SHOWCASE_APP_ID}-step-${i}`,
    applicationId: SHOWCASE_APP_ID,
    orderIndex: i,
    name,
    scheduledDate: STEP_DDAYS[i] === undefined ? null : stepDate(STEP_DDAYS[i]),
    location: null,
    notes: null,
    pinnedContent: null,
  }))
}

/**
 * 실제 `CompanyCard` 가 먹을 수 있는 모양의 합성 카드.
 *
 * ⚠️ **서버에 존재하지 않는다.** 장면들이 `inert` + `pointer-events-none` 으로 상호작용을
 * 통째로 막으므로 이 id 로 요청이 나가는 경로가 없다.
 * 🔴 매번 새로 만든다 — 날짜가 「오늘 기준」이라 모듈 상수로 굳히면 자정을 넘긴 탭에서
 * D-day 가 하루 밀린다.
 */
export function makeShowcaseApplication(
  overrides: Partial<Application> = {},
): Application {
  const now = new Date().toISOString()
  return {
    id: SHOWCASE_APP_ID,
    userId: SHOWCASE_APP_ID,
    companyName: SHOWCASE_COMPANY,
    jobTitle: SHOWCASE_JOB,
    jobCategory: SHOWCASE_CATEGORY,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: SHOWCASE_STEP_INDEX,
    needsDetail: false,
    isStarred: false,
    isSample: false,
    steps: makeSteps(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * 1장 데스크탑에만 놓는 **옆 카드 2장** — 「보드에는 여러 장이 쌓인다」는 문맥.
 * 모바일은 폭이 없어 스켈레톤 두 줄로 대신한다 (내용이 있으면 읽으려다 폴드를 넘긴다).
 */
export const SHOWCASE_SIDE_CARDS: {
  company: string
  job: string
  stepLabel: string
}[] = [
  { company: '오늘의집', job: '서비스 기획', stepLabel: '서류 제출' },
  { company: '제일기획', job: 'AE', stepLabel: '지원 예정' },
]

/* ── 3장: 회사 조사 (조사 시드 값 그대로) ───────────────────────────────── */

/**
 * 🔴 **칩 색을 카테고리로 나누지 않는다** (CEO 실기).
 *
 * 예전엔 tech/issue/business/talent 5색 칩이었는데, 취준생 눈에는 **색이 무슨 뜻인지 알 수
 * 없어** 그냥 알록달록한 상자로 보였다. 여기서 답해야 하는 질문은 「이 회사가 무슨 색인가」가
 * 아니라 **「그래서 면접에서 뭐가 나오나」**다. 그래서 전부 같은 brand 틴트로 두고,
 * **하나를 펼쳐서 실제로 나올 질문을 보여준다** — 색이 아니라 내용이 정보를 나른다.
 */
export const SHOWCASE_RESEARCH_KEYWORDS = [
  '무신사 스탠다드',
  '29CM 인수',
  '오프라인 매장 확장',
  '크루 문화',
] as const

/** 자동으로 펼쳐질 칩과 그때 나오는 한 줄 — 「그래서 면접에서 뭐」에 답하는 자리 */
export const SHOWCASE_KEYWORD_EXPANDED = '29CM 인수'
export const SHOWCASE_KEYWORD_HINT =
  '→ ‘포트폴리오 확장을 어떻게 보나’ 질문이 자주 나와요'

/**
 * 🔴 **섹션 이름은 실제 탭(`CompanyInfoTab`)에서 그대로 가져온다.**
 *
 * 투어에서 「면접에서 나올 말」·「원하는 사람」이라고 부르고 실제 화면에 가면 다른 이름이
 * 붙어 있으면, 방금 본 그 자리를 다시 찾지 못한다. 소개 화면이 실물과 **같은 말**을 써야
 * 「아까 그거」가 성립한다 — 카드를 흉내내지 않고 진짜를 세우는 것과 같은 이유다.
 */
export const SHOWCASE_RESEARCH_SECTIONS = {
  keywords: '이 회사 주요 키워드',
  about: '어떤 회사인가요',
  story: '자소서에 쓸 이야기',
  wants: '이 회사가 원하는 사람',
} as const

/**
 * 「어떤 회사인가요」 한눈에 스탯 — **숫자가 있어야 「조사됐다」로 읽힌다** (CEO 8/29
 * 「조사한 게 너무 부실하다」). 키워드 칩 넉 장만으로는 「이게 다야?」가 된다.
 * 값은 조사 시드 표기 그대로다.
 */
export const SHOWCASE_STATS = [
  { label: '2025 매출', value: '1조 4,679억', delta: '+18.1%' },
  { label: '영업이익', value: '1,405억', delta: '+36.7%' },
  { label: '패션 앱 사용자', value: '430만', delta: '2위' },
] as const

/** 스탯 아래 한 줄 — 근거 시점(2024.10)을 문장 안으로 흡수했다(따로 메타를 달지 않는다) */
export const SHOWCASE_BUSINESS_SUMMARY =
  'PB 무신사 스탠다드 오프라인 16개 매장 합산 연매출 약 1,000억 (2024.10)'

/** 제품·서비스 — 「무엇을 만드는 회사인가」가 pill 세 개로 끝난다 */
export const SHOWCASE_PRODUCTS = ['무신사 스토어', '무신사 스탠다드', '29CM'] as const

/**
 * 「자소서에 쓸 이야기」 — 라벨 + **한 줄**. 설득 재료로 바로 쓰는 형태다.
 *
 * 🔴 문장이 **390px 한 줄에 들어가야 한다.** 두 줄이 되면 네 섹션이 폴드를 넘어 무대가
 * 축소되고, 그러면 본문 12px 이 11px 대로 떨어진다 — 「정보가 많다」가 「안 읽힌다」가 되는
 * 지점이다. 사실을 빼는 게 아니라 **군더더기를 빼서** 한 줄에 맞춘다.
 */
export const SHOWCASE_STORY = [
  { label: '최근 동향', text: '2025 사상 최대 실적 · 이익 성장률이 매출을 앞섬' },
  { label: '차별점', text: '29CM 인수(2021)로 포트폴리오 다각화' },
] as const

export const SHOWCASE_TALENT_PROFILE = [
  '익숙한 것에 질문하기',
  '고객 관점',
  '실행과 시행착오를 통한 학습',
]

/** 🔴 이 장면의 **핵심 한 방** — 인재상이 내 직무 이야기로 바뀌는 줄 */
export const SHOWCASE_ROLE_INSIGHT =
  '전 직군 공통 ‘크루 문화’ · MD/기획은 PB 상품 기획 역량'

/* ── 4장: 자소서 ────────────────────────────────────────────────────────── */

/**
 * 🔴 **초안은 두괄식이어야 한다** — 점검 배지가 「두괄식 ✓」라고 말하기 때문이다.
 *
 * 예전 초안은 「매장 앞 줄을 보며 …물었습니다 / …되고 싶습니다 / …남기겠습니다」 순서라
 * **결론이 두 번째 줄**에 있었다. 화면이 스스로 「두괄식 ✓」라고 체크해 놓고 본문은 아닌
 * 상태 — 자소서를 봐주는 제품이 자기 기준을 안 지키면 그 배지 전체가 신뢰를 잃는다
 * (CEO 실기). 이제 **결론 → 근거 → 실행**이다.
 */
const COVERLETTER_DRAFT = [
  '무신사에서 ‘온라인 브랜드가 오프라인에서도 사랑받는 장면’을 만드는 브랜드 마케터가 되고 싶습니다.',
  '무신사 스탠다드 홍대 매장 앞에 줄 선 사람들을 보며, 화면에서 쌓인 신뢰가 공간에서 완성된다는 걸 확인했기 때문입니다.',
  '입사 후에는 고객 관점에서 익숙한 것에 질문하는 크루 문화 안에서, 캠페인마다 가설과 결과를 기록해 다음 판단의 근거로 남기겠습니다.',
] as const

/**
 * 🔴 글자수는 **본문에서 센다** — 손으로 적어 두면 문장을 고칠 때마다 어긋나고,
 * 어긋난 줄 아무도 모른다(화면은 멀쩡해 보인다). 실제 자소서 편집기처럼 **공백 포함**이다.
 */
export const COVERLETTER_CHAR_COUNT = COVERLETTER_DRAFT.join(' ').length
/*
 * 8/29 CEO: 「600자 제한인데 198자면 아쉽다 — 조금 보여줄 거면 제한을 줄여라」.
 * 초안은 재생 속도 때문에 3문장(≈200자)으로 두고, 문항 제한을 300자로 낮춰 2/3 가 찬
 * 「거의 다 쓴」 상태로 보이게 한다 (실제 300자 문항도 흔하다).
 */
const COVERLETTER_LIMIT = 300

export const SHOWCASE_COVERLETTER = {
  question: '무신사에서 브랜드 마케터로 이루고 싶은 것과 그 이유를 적어 주세요',
  draft: COVERLETTER_DRAFT,
  checks: [
    `${COVERLETTER_CHAR_COUNT} / ${COVERLETTER_LIMIT}자`,
    '회사 키워드 3 · 무신사 스탠다드 · 크루 · 고객 관점',
    '두괄식 ✓',
  ],
  /** 데스크탑 왼쪽 문항 목록 — 「자소서는 문항이 여러 개」라는 사실이 목록으로 읽힌다 */
  questionList: [
    { label: '성장 과정에서 가장 크게 배운 것', state: 'done' as const },
    { label: '무신사에서 이루고 싶은 것', state: 'writing' as const },
    { label: '지원 동기', state: 'todo' as const },
  ],
}

/* ── 5장: 면접 ──────────────────────────────────────────────────────────── */

export const SHOWCASE_INTERVIEW = {
  question: '무신사 스탠다드가 오프라인으로 확장한 이유를 어떻게 보나요?',
  /**
   * 🔴 **면접 답변은 두 문장으로 끝나지 않는다.** 예전 답변은 「…단계라고 봅니다. 16개 매장
   * 연매출 1,000억이 그 증거입니다.」 두 줄이라 **성의 없어 보였다** (CEO 실기) — 연습 화면이
   * 보여주는 답변이 그 수준이면 「이 정도면 되는구나」를 가르치는 셈이다.
   * 실제 합격권 답변의 뼈대(결론 → 근거 수치 → 해석 → 직무로서의 의미)를 그대로 담는다.
   */
  /**
   * 🔴 **문장 단위로 나눠 둔다.** 글자 단위 타이핑(241자 × 40ms = 9.6초)은 실기에서
   * **지루하다**는 판정을 받았다 (CEO). 사람이 말하는 리듬은 글자가 아니라 문장이라,
   * 0.5초 간격으로 문장이 올라오는 편이 「말하는 중」으로 읽히고 5배 빠르다.
   */
  answer: [
    '온라인에서 쌓인 신뢰를 실물로 확인시키는 단계라고 봅니다.',
    '2024년 10월 기준 무신사 스탠다드 16개 매장의 합산 연매출이 약 1,000억 원인데, 이건 고객이 앱에서 본 브랜드를 직접 만져 보고 싶어 한다는 증거입니다.',
    '오프라인 매장은 판매처라기보다 브랜드를 체험하는 장소이고, 그 경험이 다시 앱 재방문으로 돌아온다고 생각합니다.',
    '그래서 저는 매장 방문이 앱 안의 행동으로 이어지는 캠페인을 설계하는 마케터가 되고 싶습니다.',
  ],
  feedback: [
    '수치와 해석을 같이 든 점이 좋아요',
    '‘매장 → 앱 재방문’ 연결을 사례 하나로 보여주면 더 설득력 있어요',
  ],
  /** 접혔을 때 남는 한 줄 — 질문 2가 열릴 자리를 만들어 준다 */
  summary: 'Q1 무신사 스탠다드 오프라인 확장 …',
  /**
   * 🔴 **질문 2를 실제로 보여준다** (CEO 실기). 예전엔 점선 「미리보기」 한 줄이라
   * 「한 판이 이어진다」는 말만 하고 **보여주지는 않았다** — 연습이 어떻게 굴러가는지가
   * 이 장면의 전부인데 그 절반이 비어 있던 셈이다.
   */
  question2: '29CM 인수 이후 브랜드 포트폴리오 변화를 마케팅 관점에서 설명해 주세요',
  answer2: [
    '남성 스트리트 중심이던 브랜드 폭이 여성·셀렉트숍까지 넓어져 ‘무신사 = 패션 전체’로 인식이 바뀌는 계기였다고 봅니다.',
    '마케팅 관점에서는 29CM 고객이 무신사 앱으로 넘어오는 동선을 설계하는 게 핵심 과제라고 생각합니다.',
  ],
  feedback2: ['인식 변화 → 과제로 이어진 구조가 좋아요'],
  /** 타이머가 도달하는 값(초) — 답변 길이에 맞춘다 (짧은 답에 긴 시간은 거짓말이다) */
  elapsedSec: 41,
  /** 질문 2로 넘어간 뒤 표시할 시각 */
  elapsedSec2: 29,
  totalQuestions: 8,
}

/* ── 6장: 공부 노트 ─────────────────────────────────────────────────────── */

export const SHOWCASE_NOTE = {
  title: `${SHOWCASE_INTERVIEW_STEP} 준비 · ${SHOWCASE_COMPANY}`,
  stepPill: `스텝에 연결 · ${SHOWCASE_INTERVIEW_STEP}`,
  questionsHeading: '예상 질문 TOP 3',
  questions: [
    '무신사 스탠다드가 오프라인으로 확장한 이유를 어떻게 보나요?',
    '29CM 인수 이후 브랜드 포트폴리오 변화를 마케팅 관점에서 어떻게 보나요?',
    '크루 문화에서 내가 기여할 수 있는 것',
  ],
  checklist: [
    { label: '자기소개 45초 버전', done: true },
    { label: '무신사 스탠다드 홍대 매장 방문 후기', done: false },
    { label: '29CM·무신사 앱 UX 비교 메모', done: false },
    { label: '최근 캠페인 3건 정리', done: false },
  ],
  /** 연출 중 체크되는 항목 — 두 번째(방문 후기). 첫 줄은 처음부터 완료다 */
  checkingIndex: 1,
  highlight: '답은 항상 고객 관점에서 시작',
  imageLabel: '무신사 스탠다드 홍대 매장',
  imageCaption: '무신사 스탠다드 홍대 매장 · 8/24 방문',
  /**
   * 🔴 **공부한 티가 나는 정리 글** — 체크리스트만 있으면 「할 일 목록」이지 노트가 아니다
   * (CEO 실기 「공부한 것처럼 정리된 글」). 면접에서 실제로 쓰는 형태로 접어 둔다.
   */
  study: {
    heading: '크루 문화 = 무엇?',
    bullets: [
      '① 익숙한 것에 질문하기 — 당연한 프로세스도 ‘왜’부터',
      '② 고객 관점 — 데이터보다 고객의 문장으로 말하기',
      '③ 실행과 시행착오 — 작게 해보고 기록',
    ],
    /** 2열 미니 표 — 데스크탑 전용(모바일은 폭·세로가 모자라 글자가 12px 밑으로 떨어진다) */
    table: {
      head: ['온라인(앱)', '오프라인(매장)'],
      rows: [
        { label: '역할', cells: ['발견·비교', '체험·확신'] },
        { label: '지표', cells: ['재방문', '체류·구매 전환'] },
      ],
    },
  },
  /** 데스크탑 왼쪽 노트 목록 — 노트가 여러 개 쌓인다는 문맥 */
  noteList: ['1차 실무면접 준비 · 무신사', '과제(기획안) 아이디어', '마케팅 용어 정리'],
}
