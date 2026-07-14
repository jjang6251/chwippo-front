// 데모 모드용 샘플 데이터. 모든 날짜는 "오늘" 기준 상대값으로 생성 — 데모를 언제 봐도 자연스럽게.
import type { Application, ApplicationStep } from '@/types/application'
import type { ApplicationCoverletter } from '@/types/coverletter'
import type {
  DashboardStats, DdayItem, InterviewReviewItem, GrowthMetricsResponse,
} from '@/api/dashboard'
import type { CalendarEvent, DailyNote } from '@/api/calendar'
import type { ChecklistItem } from '@/api/stepDetail'
import type {
  UserProfile, LanguageCert, Cert, Award, Experience, CoverletterData, StorageUsage,
} from '@/api/myinfo'
import type { Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'
import type { DashboardStreakResponse } from '@/types/dashboardStreak'
import type { Activity, ActivityLog, TimelinePage } from '@/types/activity'
import type { CompanyResearchResult } from '@/types/interviewPrep'
import type { CoinBalance } from '@/types/coinSystem'

const DAY = 86400000
const d = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().split('T')[0]
// scheduledDate(TIMESTAMPTZ) — 10:00 KST = 01:00 UTC
const dt = (offsetDays: number, hourKst = 10) =>
  new Date(new Date(Date.now() + offsetDays * DAY).setUTCHours(hourKst - 9, 0, 0, 0)).toISOString()

const DEMO_USER = 'demo-user'

function step(applicationId: string, orderIndex: number, name: string, opts: Partial<ApplicationStep> = {}): ApplicationStep {
  return {
    id: `${applicationId}-s${orderIndex}`,
    applicationId,
    orderIndex,
    name,
    scheduledDate: null,
    location: null,
    notes: null,
    pinnedContent: null,
    ...opts,
  }
}

// ── 회사 카드 11개 (업종 다양화: IT·금융·공기업·제조·소비재) ──
export const DEMO_APPLICATIONS: Application[] = [
  {
    id: 'demo-a1', userId: DEMO_USER, companyName: '카카오', jobTitle: '백엔드 개발자', jobCategory: 'IT개발',
    status: 'IN_PROGRESS', jobUrl: 'https://careers.kakao.com', memo: '면접관 2명 · 기술 면접 위주 · 시스템 설계 준비',
    currentStepIndex: 2, needsDetail: false, isStarred: true, createdAt: d(-30) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
    // 공고 요건 — 일반적인 백엔드 직무 요건(범용). 특정 회사 사실 주장 아님, 지원자가 정리한 지원 준비 자료로 연출.
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '대규모 트래픽을 처리하는 서버 애플리케이션 설계·개발·운영. API 설계, 데이터 파이프라인 구축, 장애 대응.',
      requirements: [
        'Java 또는 Kotlin 기반 백엔드 개발 경험',
        'RDBMS(MySQL·PostgreSQL 등) 설계·튜닝 경험',
        '컴퓨터공학 전공 지식(자료구조·네트워크·OS)',
      ],
      preferred: [
        'MSA·대용량 트래픽 처리 경험',
        'Kafka 등 메시지 큐 사용 경험',
        '오픈소스 기여 또는 사이드 프로젝트 경험',
      ],
      techStack: ['Java', 'Kotlin', 'Spring Boot', 'MySQL', 'Redis', 'Kafka'],
      qualifications: ['정보처리기사', 'SQLD'],
      keywords: ['대용량 트래픽', '시스템 설계', 'MSA', '문제 해결'],
      parsedAt: dt(-3),
    },
    steps: [
      step('demo-a1', 0, '서류 제출', { scheduledDate: dt(-20) }),
      step('demo-a1', 1, '코딩테스트·과제', { scheduledDate: dt(-12), location: '온라인(프로그래머스)' }),
      step('demo-a1', 2, '1차 기술면접', { scheduledDate: dt(3), location: '판교 카카오 아지트', pinnedContent: '엘리베이터 5층 · 신분증 지참' }),
      step('demo-a1', 3, '2차 컬처핏', {}),
      step('demo-a1', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a2', userId: DEMO_USER, companyName: '토스', jobTitle: '프로덕트 디자이너', jobCategory: '디자인',
    status: 'IN_PROGRESS', jobUrl: 'https://toss.im/career', memo: '포트폴리오 PDF 10MB 이하 · 회사 디자인 시스템 리서치',
    currentStepIndex: 0, needsDetail: false, isStarred: false, createdAt: d(-5) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    steps: [
      step('demo-a2', 0, '서류 제출', { scheduledDate: dt(2) }),
      step('demo-a2', 1, '과제 전형', {}),
      step('demo-a2', 2, '1차 면접', {}),
      step('demo-a2', 3, '대표 면접', {}),
      step('demo-a2', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a3', userId: DEMO_USER, companyName: '삼성전자', jobTitle: 'SW 개발', jobCategory: 'IT개발',
    status: 'IN_PROGRESS', jobUrl: null, memo: 'GSAT 인적성 통과 · 면접 3:1',
    currentStepIndex: 3, needsDetail: false, isStarred: false, createdAt: d(-45) + 'T00:00:00Z', updatedAt: d(-3) + 'T00:00:00Z',
    steps: [
      step('demo-a3', 0, '서류 제출', { scheduledDate: dt(-35) }),
      step('demo-a3', 1, '인적성', { scheduledDate: dt(-21), location: '온라인(GSAT)' }),
      step('demo-a3', 2, '1차 실무면접', { scheduledDate: dt(-7), location: '수원 디지털시티' }),
      step('demo-a3', 3, '임원면접', { scheduledDate: dt(5), location: '서울 서초 사옥' }),
      step('demo-a3', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a4', userId: DEMO_USER, companyName: '네이버', jobTitle: '서비스 기획', jobCategory: '기획·PM',
    status: 'PASSED', jobUrl: 'https://recruit.navercorp.com', memo: '🎉 합격!',
    currentStepIndex: 3, needsDetail: false, isStarred: true, createdAt: d(-70) + 'T00:00:00Z', updatedAt: d(-10) + 'T00:00:00Z',
    steps: [
      step('demo-a4', 0, '서류 제출', { scheduledDate: dt(-60) }),
      step('demo-a4', 1, '1차 면접', { scheduledDate: dt(-40), location: '분당 그린팩토리' }),
      step('demo-a4', 2, '2차 면접', { scheduledDate: dt(-25) }),
      step('demo-a4', 3, '최종 합격', { scheduledDate: dt(-10) }),
    ],
  },
  {
    id: 'demo-a5', userId: DEMO_USER, companyName: '쿠팡', jobTitle: '데이터 분석가', jobCategory: 'IT개발',
    status: 'FAILED', jobUrl: null, memo: '서류 탈락 — 다음엔 SQL 프로젝트 더 강조',
    failedTakeaway: '지원 동기를 회사가 아니라 직무 중심으로만 썼던 게 아쉬웠다. 데이터 분석가로서 어떤 문제를 풀고 싶은지는 잘 담았지만, "왜 이 회사에서"에 대한 답이 약했다. 다음엔 SQL 프로젝트 결과를 수치로 먼저 보여주고, 회사 서비스와 연결지어 쓰기로 했다.',
    failedTakeawayAt: d(-28) + 'T00:00:00Z',
    currentStepIndex: 0, needsDetail: false, isStarred: false, createdAt: d(-55) + 'T00:00:00Z', updatedAt: d(-30) + 'T00:00:00Z',
    steps: [
      step('demo-a5', 0, '서류 제출', { scheduledDate: dt(-50) }),
      step('demo-a5', 1, '1차 면접', {}),
      step('demo-a5', 2, '2차 면접', {}),
      step('demo-a5', 3, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a6', userId: DEMO_USER, companyName: '당근마켓', jobTitle: null, jobCategory: 'IT개발',
    status: 'PLANNED', jobUrl: null, memo: null,
    currentStepIndex: 0, needsDetail: false, isStarred: false, createdAt: d(-1) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    steps: [],
  },
  {
    id: 'demo-a7', userId: DEMO_USER, companyName: '현대자동차', jobTitle: '생산관리', jobCategory: '기타',
    status: 'IN_PROGRESS', jobUrl: 'https://careers.hyundai.com', memo: '인적성(HMAT) D-5 · 온라인 응시 환경 미리 점검', domain: 'hyundai.com',
    currentStepIndex: 1, needsDetail: false, isStarred: false, createdAt: d(-14) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    steps: [
      step('demo-a7', 0, '서류 제출', { scheduledDate: dt(-10) }),
      step('demo-a7', 1, '인적성(HMAT)', { scheduledDate: dt(5), location: '온라인(HMAT)', pinnedContent: '노트북·웹캠 사전 점검 · 신분증 준비' }),
      step('demo-a7', 2, '직무·PT 면접', {}),
      step('demo-a7', 3, '임원면접', {}),
      step('demo-a7', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a8', userId: DEMO_USER, companyName: 'KB국민은행', jobTitle: '금융영업', jobCategory: '금융',
    status: 'IN_PROGRESS', jobUrl: 'https://obank.kbstar.com', memo: '서류 마감 D-2 · 지원동기·갈등경험 문항 마무리', domain: 'kbstar.com',
    currentStepIndex: 0, needsDetail: false, isStarred: false, createdAt: d(-4) + 'T00:00:00Z', updatedAt: d(0) + 'T00:00:00Z',
    steps: [
      step('demo-a8', 0, '서류 제출', { scheduledDate: dt(2) }),
      step('demo-a8', 1, '필기전형(NCS·상식)', {}),
      step('demo-a8', 2, '1차 세일즈 면접', {}),
      step('demo-a8', 3, '2차 임원면접', {}),
      step('demo-a8', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a9', userId: DEMO_USER, companyName: '한국전력공사', jobTitle: '사무', jobCategory: '경영지원',
    status: 'IN_PROGRESS', jobUrl: 'https://recruit.kepco.co.kr', memo: 'NCS 직무능력 필기 D-10 · PSAT형 기출 위주로 준비', domain: 'kepco.co.kr',
    currentStepIndex: 1, needsDetail: false, isStarred: false, createdAt: d(-9) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
    steps: [
      step('demo-a9', 0, '서류 제출', { scheduledDate: dt(-8) }),
      step('demo-a9', 1, 'NCS 직무능력 필기', { scheduledDate: dt(10), location: '지정 고사장' }),
      step('demo-a9', 2, '직무면접', {}),
      step('demo-a9', 3, '종합면접', {}),
      step('demo-a9', 4, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a10', userId: DEMO_USER, companyName: '아모레퍼시픽', jobTitle: '브랜드 마케팅', jobCategory: '마케팅',
    status: 'IN_PROGRESS', jobUrl: 'https://recruit.apgroup.com', memo: '1차 면접 D-7 · 최근 뷰티 캠페인 사례 정리', domain: 'apgroup.com',
    currentStepIndex: 1, needsDetail: false, isStarred: false, createdAt: d(-12) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    steps: [
      step('demo-a10', 0, '서류 제출', { scheduledDate: dt(-6) }),
      step('demo-a10', 1, '1차 실무면접', { scheduledDate: dt(7), location: '서울 용산 본사' }),
      step('demo-a10', 2, '2차 임원면접', {}),
      step('demo-a10', 3, '최종 합격', {}),
    ],
  },
  {
    id: 'demo-a11', userId: DEMO_USER, companyName: 'CJ제일제당', jobTitle: '식품 마케팅', jobCategory: '마케팅',
    status: 'PLANNED', jobUrl: null, memo: '관심 기업 · 하반기 공채 지원 예정', domain: 'cj.co.kr',
    currentStepIndex: 0, needsDetail: false, isStarred: false, createdAt: d(-1) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    steps: [],
  },
]

export const getDemoApplication = (id: string): Application | undefined =>
  DEMO_APPLICATIONS.find((a) => a.id === id)

// ── 회사별 자소서 ───────────────────────────────────────────
function cl(applicationId: string, i: number, question: string, category: string | null, answer: string | null, charLimit: number | null): ApplicationCoverletter {
  return {
    id: `${applicationId}-cl${i}`, applicationId, question, category, answer, charLimit, orderIndex: i,
    createdAt: d(-5) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
  }
}
export const DEMO_COVERLETTERS: Record<string, ApplicationCoverletter[]> = {
  'demo-a1': [
    cl('demo-a1', 0, '카카오에 지원하게 된 동기를 작성해 주세요.', '지원동기',
      '수백만 명이 매일 쓰는 서비스의 뒷단을 지탱하는 일을 하고 싶습니다. 스타트업 백엔드 인턴 시절, 일 평균 30만 건의 이벤트를 처리하는 큐 시스템이 새벽마다 지연되는 문제를 맡았습니다. 처음에는 서버 증설부터 떠올렸지만, 프로파일링 결과 병목은 정산 배치와 큐 소비가 같은 DB 커넥션 풀을 나눠 쓰는 구조에 있었습니다. 풀을 분리하고 배치를 청크 단위로 쪼개 처리 시간을 4시간에서 40분으로 줄였고, 그 과정에서 "추측이 아니라 측정이 문제를 푼다"는 원칙을 몸에 익혔습니다.\n\n이 경험은 규모가 커질수록 더 절실해지는 원칙이라고 생각합니다. 수천만 명이 동시에 쓰는 메시징 인프라에서는 1%의 지연도 수십만 명의 경험이 되기 때문입니다. 대학 캡스톤에서도 주문 API 응답을 300ms에서 90ms로 줄이며 같은 방식을 검증했습니다. 부하 테스트로 병목을 수치로 확인하고, 캐시 도입 전후를 지표로 비교해 팀을 설득했습니다.\n\n입사 후에는 측정 기반의 개선 습관으로 트래픽 급증 상황에서도 흔들리지 않는 백엔드를 만드는 데 기여하고, 장기적으로는 장애를 사전에 감지하는 관측 체계까지 다룰 줄 아는 엔지니어로 성장하겠습니다.', 1000),
    cl('demo-a1', 1, '본인의 직무 역량과 핵심 경험을 작성해 주세요.', '직무역량·핵심경험',
      '첫째, 성능 개선 경험입니다. 인턴으로 합류한 첫 달, 매일 새벽 4시간씩 돌던 결제 정산 배치가 영업시간을 침범하기 시작했습니다. 선배들은 "데이터가 늘어서 어쩔 수 없다"고 했지만, 저는 원인을 수치로 확인하고 싶었습니다. APM 프로파일링으로 전체 시간의 70%가 건별 단건 조회에 쓰인다는 걸 발견했고, 조회를 배치 단위로 묶고 인덱스를 추가해 처리 시간을 40분까지 줄였습니다. 단순히 빨라진 것보다 값진 성과는, 개선 전후를 그래프로 정리해 팀 위키에 남기면서 "측정 없이 개선 없다"는 공감대를 팀에 만든 것이었습니다.\n\n둘째, 협업 속에서 기술 결정을 조율한 경험입니다. 졸업 캡스톤에서 주문 API가 피크 시간마다 느려지는 문제를 두고, 프론트 팀원은 로딩 UI로 가리자고 했고 저는 근본 원인을 찾자고 맞섰습니다. 감정 소모 대신 부하 테스트를 함께 돌려 병목이 재고 조회 쿼리에 있음을 확인했고, 캐시 도입으로 응답을 300ms에서 90ms로 줄였습니다. 의견이 갈릴 때 "누가 맞느냐"가 아니라 "무엇이 사실이냐"로 논점을 옮기는 습관을 이때 얻었습니다.\n\n셋째, 꾸준함입니다. 저는 개발하며 배운 것을 매주 기록해 왔고, 그 기록 덕분에 반년 전의 시행착오를 면접 자리에서도 수치까지 정확히 말할 수 있습니다. 이 세 가지 — 측정으로 문제를 풀고, 사실로 협업하고, 기록으로 성장하는 습관 — 이 대규모 서비스를 다루는 백엔드 엔지니어에게 필요한 기본기라고 믿습니다.', 1500),
    cl('demo-a1', 2, '입사 후 포부를 작성해 주세요.', '입사후포부', null, 800),
  ],
  'demo-a4': [
    cl('demo-a4', 0, '네이버 서비스 중 개선하고 싶은 것과 그 이유는?', '직무역량·핵심경험',
      '네이버 지도의 즐겨찾기 폴더 흐름을 개선하고 싶습니다. 맛집·카페·여행지를 200개 넘게 저장해 쓰는 헤비 유저로서, 저장할 때는 쉽지만 "다시 찾을 때" 막히는 경험을 반복했습니다. 실제로 주변 5명을 인터뷰해 보니 4명이 "폴더를 만들긴 했는데 안 쓴다"고 답했고, 이유는 저장 시점에 폴더를 고르는 단계가 귀찮아 전부 기본 폴더에 쌓이기 때문이었습니다.\n\n제안은 두 가지입니다. 첫째, 저장 시점이 아니라 조회 시점에 정리를 돕는 것입니다. 최근 저장한 장소를 지역·카테고리 기준으로 묶어 "이 7곳을 부산 여행 폴더로 만들까요?"라고 제안하면, 정리 비용을 사용자가 의지를 낸 순간으로 옮길 수 있습니다. 둘째, 폴더에 시간 맥락을 더하는 것입니다. 주말 오전에 지도를 열면 저장해 둔 브런치 카페가 먼저 보이는 식으로, 같은 데이터라도 꺼내 보여주는 순서를 바꾸면 "저장만 하고 안 쓰는" 문제를 줄일 수 있다고 생각합니다.\n\n개선안은 저장 후 7일 내 재방문율과 폴더 생성률로 검증하겠습니다. 사용자의 귀찮음을 데이터로 확인하고 흐름의 순서를 바꿔 푸는 것 — 제가 서비스 기획에서 가장 하고 싶은 일입니다.', 1000),
  ],
  // KB국민은행 — 금융권다운 문항 2개(지원동기 작성 완료 · 갈등경험 미작성 → 작성 CTA 연출)
  'demo-a8': [
    cl('demo-a8', 0, 'KB국민은행에 지원한 동기와 입행 후 이루고 싶은 목표를 작성해 주세요.', '지원동기',
      '숫자 뒤에 있는 사람을 이해하는 금융을 하고 싶어 지원했습니다. 교내 창업 동아리에서 소상공인용 간편 정산 서비스를 기획하며 시장 조사를 위해 상인 열두 분을 인터뷰했습니다. 매출은 있는데 현금 흐름이 꼬여 대출 창구 앞에서 발걸음을 돌리는 분, 금리 비교는커녕 어떤 상품이 있는지도 모른 채 지인에게 돈을 빌리는 분을 만나며, 금융의 문턱은 상품이 아니라 "설명해 주는 사람"의 부재라는 걸 배웠습니다. 저희 팀이 정산 리포트를 쉬운 말로 바꿔 보여드렸을 때 "이제야 내 장사가 보인다"던 반응이, 제가 은행 영업에서 하고 싶은 일의 원형입니다.\n\n입행 후 단기적으로는 개인·소상공인 고객을 가장 가까이서 만나는 영업점에서, 고객의 자금 흐름을 함께 읽고 필요한 상품을 먼저 설명하는 행원이 되겠습니다. 동아리에서 익힌 데이터 정리 습관으로 상담 이력을 기록하고, 고객마다 다른 생애 단계에 맞는 제안을 준비하겠습니다. 장기적으로는 소상공인 금융 지원 직무로 전문성을 키워, 제가 인터뷰에서 만났던 분들처럼 제도권 금융 앞에서 머뭇거리는 고객에게 가장 먼저 손을 내미는 KB인이 되고 싶습니다.', 1000),
    cl('demo-a8', 1, '조직 생활에서 구성원과 갈등을 겪었던 경험과 해결 과정을 작성해 주세요.', '직무역량·핵심경험', null, 800),
  ],
}
export const getDemoCoverletters = (applicationId: string): ApplicationCoverletter[] =>
  DEMO_COVERLETTERS[applicationId] ?? []

// ── 스텝 체크리스트 (1차 기술면접 등 일부만) ─────────────────
export const DEMO_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'demo-a1-s2': [
    { id: 'demo-ck1', stepId: 'demo-a1-s2', content: '지원서 재검토', isDone: true, orderIndex: 0, createdAt: d(-3) + 'T00:00:00Z' },
    { id: 'demo-ck2', stepId: 'demo-a1-s2', content: '교통 경로 확인', isDone: true, orderIndex: 1, createdAt: d(-3) + 'T00:00:00Z' },
    { id: 'demo-ck3', stepId: 'demo-a1-s2', content: '복장 준비', isDone: false, orderIndex: 2, createdAt: d(-3) + 'T00:00:00Z' },
    { id: 'demo-ck4', stepId: 'demo-a1-s2', content: '시스템 설계 예상 질문 복습', isDone: false, orderIndex: 3, createdAt: d(-3) + 'T00:00:00Z' },
  ],
  // 현대자동차 인적성(HMAT) 스텝 준비 체크리스트
  'demo-a7-s1': [
    { id: 'demo-ck-hmat1', stepId: 'demo-a7-s1', content: '온라인 응시 환경 점검(웹캠·인터넷)', isDone: true, orderIndex: 0, createdAt: d(-2) + 'T00:00:00Z' },
    { id: 'demo-ck-hmat2', stepId: 'demo-a7-s1', content: '모의 인적성 1회 풀어보기', isDone: false, orderIndex: 1, createdAt: d(-2) + 'T00:00:00Z' },
    { id: 'demo-ck-hmat3', stepId: 'demo-a7-s1', content: '신분증·응시 안내 메일 재확인', isDone: false, orderIndex: 2, createdAt: d(-2) + 'T00:00:00Z' },
  ],
}
export const getDemoChecklist = (stepId: string): ChecklistItem[] => DEMO_CHECKLISTS[stepId] ?? []

// ── 대시보드 ────────────────────────────────────────────────
// total = PLANNED 제외(IN_PROGRESS 7 + PASSED 1 + FAILED 1 = 9). interviewsAttended = 과거 면접 스텝(신규 카드는 전부 미래 일정이라 불변).
export const DEMO_DASHBOARD_STATS: DashboardStats = { total: 9, inProgress: 7, interviewsAttended: 4, passed: 1 }

export const DEMO_DDAY: DdayItem[] = [
  { type: 'step', applicationId: 'demo-a2', stepId: 'demo-a2-s1', companyName: '토스', stepName: '서류전형', date: d(2), dday: 2,
    nextAction: 'start_coverletter', progress: { current: 0, total: 1 }, jobUrl: 'https://toss.im/career', domain: 'toss.im' },
  { type: 'step', applicationId: 'demo-a8', stepId: 'demo-a8-s0', companyName: 'KB국민은행', stepName: '서류전형', date: d(2), dday: 2,
    nextAction: 'writing_coverletter', progress: { current: 1, total: 2 }, jobUrl: 'https://obank.kbstar.com', domain: 'kbstar.com' },
  { type: 'step', applicationId: 'demo-a1', stepId: 'demo-a1-s2', companyName: '카카오', stepName: '1차 기술면접', date: d(3), scheduledTime: '10:00', dday: 3, pinnedContent: '엘리베이터 5층 · 신분증 지참',
    nextAction: 'writing_coverletter', progress: { current: 2, total: 3 }, jobUrl: 'https://careers.kakao.com', domain: 'kakao.com' },
  { type: 'step', applicationId: 'demo-a7', stepId: 'demo-a7-s1', companyName: '현대자동차', stepName: '인적성(HMAT)', date: d(5), scheduledTime: '10:00', dday: 5,
    nextAction: 'no_action', jobUrl: 'https://careers.hyundai.com', domain: 'hyundai.com' },
  { type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s3', companyName: '삼성전자', stepName: '임원면접', date: d(5), scheduledTime: '14:00', dday: 5,
    nextAction: 'confirm_submit', jobUrl: null, domain: 'samsung.com' },
  { type: 'step', applicationId: 'demo-a10', stepId: 'demo-a10-s1', companyName: '아모레퍼시픽', stepName: '1차 실무면접', date: d(7), scheduledTime: '14:00', dday: 7,
    nextAction: 'confirm_submit', jobUrl: 'https://recruit.apgroup.com', domain: 'apgroup.com' },
  { type: 'exam', examId: 'demo-e1', companyName: 'SQLD 시험', date: d(9), dday: 9, nextAction: 'no_action' },
]

export const DEMO_INTERVIEW_REVIEW: InterviewReviewItem[] = [
  { stepId: 'demo-a3-s2', stepName: '1차 실무면접', applicationId: 'demo-a3', companyName: '삼성전자' },
]

// ── 캘린더 ──────────────────────────────────────────────────
// isStarred 는 지원 카드의 값과 파생 동기화됨(demoStore.getCalendarEvents). 초기값은 카드와 일치.
export const DEMO_CALENDAR_EVENTS: CalendarEvent[] = [
  { date: d(2), time: null, type: 'step', applicationId: 'demo-a2', stepId: 'demo-a2-s1', examId: null, noteId: null, companyName: '토스', stepName: '서류전형', location: null, content: null, isStarred: false },
  { date: d(3), time: '10:00', type: 'step', applicationId: 'demo-a1', stepId: 'demo-a1-s2', examId: null, noteId: null, companyName: '카카오', stepName: '1차 기술면접', location: '판교 카카오 아지트', content: null, isStarred: true },
  { date: d(5), time: '14:00', type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s3', examId: null, noteId: null, companyName: '삼성전자', stepName: '임원면접', location: '서울 서초 사옥', content: null, isStarred: false },
  { date: d(9), time: '09:00', type: 'exam', applicationId: null, stepId: null, examId: 'demo-e1', noteId: null, companyName: 'SQLD 시험', stepName: null, location: '강남 시험장', content: null },
  { date: d(-7), time: '15:00', type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s2', examId: null, noteId: null, companyName: '삼성전자', stepName: '1차 실무면접', location: '수원 디지털시티', content: null, isStarred: false },
  // 신규 카드 파생 이벤트 (기존 시간대와 겹침 최소화)
  { date: d(2), time: '18:00', type: 'step', applicationId: 'demo-a8', stepId: 'demo-a8-s0', examId: null, noteId: null, companyName: 'KB국민은행', stepName: '서류전형', location: null, content: null, isStarred: false },
  { date: d(5), time: '10:00', type: 'step', applicationId: 'demo-a7', stepId: 'demo-a7-s1', examId: null, noteId: null, companyName: '현대자동차', stepName: '인적성(HMAT)', location: '온라인(HMAT)', content: null, isStarred: false },
  { date: d(7), time: '14:00', type: 'step', applicationId: 'demo-a10', stepId: 'demo-a10-s1', examId: null, noteId: null, companyName: '아모레퍼시픽', stepName: '1차 실무면접', location: '서울 용산 본사', content: null, isStarred: false },
  { date: d(10), time: '09:00', type: 'step', applicationId: 'demo-a9', stepId: 'demo-a9-s1', examId: null, noteId: null, companyName: '한국전력공사', stepName: 'NCS 직무능력 필기', location: '지정 고사장', content: null, isStarred: false },
]

export const DEMO_DAILY_NOTES: DailyNote[] = [
  { id: 'demo-dn1', date: d(0), hourSlot: null, content: '오후에 카카오 자소서 복습', isDone: false, createdAt: d(0) + 'T00:00:00Z' },
  { id: 'demo-dn2', date: d(3), hourSlot: 9, content: '면접 1시간 전 도착하기', isDone: false, createdAt: d(0) + 'T00:00:00Z' },
]

// ── 내 정보 창고 ────────────────────────────────────────────
export const DEMO_PROFILE: UserProfile = {
  user_id: DEMO_USER, name: '김취준', gender: 'MALE', birthdate: '1999-03-14',
  phone: '010-1234-5678', email_personal: 'demo@example.com',
  military_branch: '육군', military_type: '현역', military_start: '2019-06-01', military_end: '2021-01-15', military_unit: '제00사단',
  goal_toeic: 950, goal_certs: '정보처리기사, SQLD', goal_other: '오픽 IH 이상',
}
export const DEMO_LANG_CERTS: LanguageCert[] = [
  { id: 'demo-lc1', cert_type: 'TOEIC', score_grade: '925', issuer: 'ETS', acquired_at: '2025-08-10', expires_at: '2027-08-10' },
  { id: 'demo-lc2', cert_type: 'OPIc', score_grade: 'IH', issuer: 'ACTFL', acquired_at: '2025-09-02' },
]
export const DEMO_CERTS: Cert[] = [
  { id: 'demo-c1', name: '정보처리기사', issuer: '한국산업인력공단', acquired_at: '2024-11-20' },
  { id: 'demo-c2', name: 'SQLD', issuer: '한국데이터산업진흥원', acquired_at: '2025-03-15' },
]
export const DEMO_AWARDS: Award[] = [
  { id: 'demo-aw1', contest_name: '대학생 데이터 분석 공모전', award_name: '우수상', org: 'OO데이터협회', awarded_at: '2024-09-30', content: '공공 교통 데이터로 출퇴근 혼잡 예측 모델 제작' },
]
export const DEMO_EXPERIENCES: Experience[] = [
  { id: 'demo-ex1', activity_name: '스타트업 백엔드 인턴', org: '○○테크', start_at: '2025-01-02', end_at: '2025-06-30', content: '결제 정산 배치 개선(4시간→40분), 이벤트 큐 시스템 모니터링 추가' },
  { id: 'demo-ex2', activity_name: '교내 개발 동아리 운영진', org: 'OO대학교', start_at: '2023-03-01', end_at: '2024-12-31', content: '주간 스터디 진행, 신입 멘토링, 해커톤 2회 주최' },
]
export const DEMO_EXAM_SCHEDULES: ExamSchedule[] = [
  {
    id: 'demo-e1', user_id: DEMO_USER, exam_type: 'cert', cert_type: 'SQLD', name: 'SQLD 정기시험',
    exam_date: d(9), location: '강남 시험장', memo: '기출 3회분 풀고 가기',
    created_at: d(-10) + 'T00:00:00Z', updated_at: d(-10) + 'T00:00:00Z',
  },
]
export const DEMO_EDUCATIONS: Education[] = [
  { id: 'demo-ed1', school_name: 'OO대학교', major: '컴퓨터공학과', degree: '대학교 (학사)', status: '졸업', start_at: '2018-03-01', end_at: '2025-02-28', gpa: '3.8', gpa_max: '4.5' },
]
export const DEMO_COVERLETTER: CoverletterData = {
  coverletter: {
    personality:
      '꼼꼼하게 끝까지 파고드는 편이라 디버깅·정산처럼 정확성이 중요한 일에서 강점을 보입니다. 인턴 때 정산 금액이 1원 단위로 안 맞는 버그를 사흘간 추적해, 원인이 부동소수점 반올림이라는 걸 찾아 통화 계산을 정수 연산으로 바꾼 적이 있습니다. 반대로 완벽주의 때문에 초안이 늦는 단점이 있었는데, "초안을 빨리 내고 같이 다듬자"는 사수 피드백 이후 일단 동작하는 버전을 하루 안에 공유하는 습관으로 바꿨습니다. 지금은 "정확해야 하는 곳엔 끝까지, 빨라야 하는 곳엔 과감히"를 기준으로 씁니다.',
    background:
      '어릴 때부터 "왜 이렇게 동작하지?"가 궁금해 분해부터 하던 아이였습니다. 자취를 시작하며 쓰던 가계부 앱이 불편해 직접 만들어 본 게 개발의 시작이었고, 처음엔 저장 버튼 하나 만드는 데도 일주일이 걸렸습니다. 그런데 제가 만든 걸 친구 둘이 진짜로 쓰기 시작하면서 "요청 → 개선 → 반응"의 사이클에 빠졌습니다. 사용자가 있는 코드를 만드는 즐거움이 전공 선택과 백엔드 지망으로 이어졌습니다.',
    job_competency:
      '① 성능 개선 — 인턴 때 결제 정산 배치를 4시간에서 40분으로(1/6) 단축. APM 프로파일링으로 전체 시간의 70%가 건별 단건 조회임을 확인 → N+1을 배치 조회로 교체 + 인덱스 추가. ② 부하 대응 — 캡스톤 주문 API를 부하 테스트로 진단해 응답 300ms → 90ms (캐시 도입, 도입 전후 지표 비교로 팀 설득). ③ 운영 감각 — 개선 전후를 그래프로 정리해 팀 위키에 남기는 습관. 성과를 "몇 배 빨라졌다"가 아니라 재현 가능한 기록으로 남깁니다.',
    own_strength:
      '"문제를 측정 가능하게 만드는" 습관입니다. 막연한 "느려요" 대신 어디가 몇 ms인지 먼저 재고 시작합니다. 이 습관은 기술 문제 밖에서도 통했습니다 — 스터디 출석이 흔들릴 때 감정적으로 다그치는 대신 출석 데이터를 공유하고 규칙을 투표로 정해 출석률을 70%에서 95%로 올렸습니다. 측정은 상대를 설득하는 가장 부드러운 언어라고 생각합니다.',
    collaboration:
      '동아리 운영 중 행사 방향(대면 해커톤 vs 온라인 세미나)을 두고 운영진이 반반으로 갈렸습니다. 회의가 감정전으로 흐르기에, 각 안의 예상 비용·참여 인원·준비 공수를 표로 정리해 공유하고 부원 전체 설문으로 결정하자고 제안했습니다. 결과는 해커톤이었고, 반대편이었던 운영진이 먼저 "이렇게 정하니 서운하지 않다"고 말해줬습니다. 갈등의 해법은 논쟁의 승리가 아니라 결정 방식에 대한 합의라는 걸 배웠습니다.',
    challenge:
      '첫 해커톤에서 욕심내 기능 범위를 너무 키웠다가 데모조차 못 돌리고 끝났습니다. 밤을 새우고도 빈손이었던 그날의 실패를 복기하며, 문제는 실력이 아니라 순서였다는 결론을 냈습니다. 다음 해커톤에선 "데모 가능한 최소"를 첫 4시간 안에 만들고 남는 시간에 확장하는 방식으로 바꿨고, 우수상을 받았습니다. 이후 모든 프로젝트에서 "일단 끝까지 한 번 관통시키고 살 붙이기"를 원칙으로 삼고 있습니다.',
  },
  custom: [
    { id: 'demo-clc1', label: '리더십 경험', content: '동아리 운영진으로 주간 스터디를 1년 운영하며 신입 8명을 멘토링했습니다. 첫 달엔 제가 다 가르치려다 지쳤는데, 신입끼리 짝을 지어 서로 설명하게 하는 방식으로 바꾸자 이해도와 출석이 함께 올라갔습니다. 리더의 일은 직접 다 하는 게 아니라 구조를 만드는 것임을 배웠습니다.', order_index: 0 },
    { id: 'demo-clc2', label: '실패에서 배운 것', content: '인턴 초기, 테스트 없이 배포한 수정이 새벽 정산 오류로 이어져 사수가 새벽에 호출된 적이 있습니다. 다음 날 제가 먼저 사고 경위서와 재발 방지책(배포 전 체크리스트)을 써서 공유했고, 그 체크리스트가 팀 표준이 됐습니다. 실수 자체보다 실수 이후의 행동이 신뢰를 만든다는 걸 배웠습니다.', order_index: 1 },
    { id: 'demo-clc3', label: '기록 습관', content: '개발하며 배운 것·막힌 것을 매주 기록해 왔습니다(1년 누적 60여 건). 이 기록 덕분에 반년 전 트러블슈팅도 수치까지 정확히 복기할 수 있고, 자소서와 면접 답변의 재료가 전부 여기서 나옵니다.', order_index: 2 },
  ],
}

// ── 활동 일지 (내 정보 창고 "경험" 섹션 + 성장 지표) ──────────
function log(
  activityId: string,
  i: number,
  content: string,
  occurredAt: string,
  opts: Partial<ActivityLog> = {},
): ActivityLog {
  return {
    id: `${activityId}-l${i}`,
    activityId,
    userId: DEMO_USER,
    content,
    occurredAt,
    cat: null,
    comps: [],
    cl: [],
    quant: null,
    mood: null,
    keywords: [],
    note: null,
    noteSummary: null,
    noteSummaryHash: null,
    noteSummaryAt: null,
    archivedAt: null,
    createdAt: occurredAt + 'T00:00:00Z',
    updatedAt: occurredAt + 'T00:00:00Z',
    ...opts,
  }
}

export const DEMO_ACTIVITIES: Activity[] = [
  {
    id: 'demo-act1', userId: DEMO_USER, name: '졸업 캡스톤 프로젝트', type: 'project',
    org: 'OO대학교', role: '백엔드 담당', resultUrl: null, outcome: '교내 캡스톤 경진대회 은상',
    startedAt: d(-90), endedAt: null, archivedAt: null, isInbox: false,
    legacyExperienceId: null, summaryReflection: null,
    logs: [
      log('demo-act1', 0, '팀 회의에서 서버 아키텍처를 확정했다. REST + 인증은 JWT 로.', d(-1), { cat: 'meeting', mood: 'proud', comps: ['collaboration', 'planning'] }),
      log('demo-act1', 1, '주문 API 부하 테스트에서 병목을 찾아 캐시를 도입, 응답 300ms → 90ms.', d(-4), { cat: 'develop', mood: 'proud', comps: ['technical', 'problem_solving'], keywords: ['성능', '캐시'] }),
      log('demo-act1', 2, '발표 리허설. 데모 시나리오를 3분 안에 보여주도록 다듬었다.', d(-9), { cat: 'presentation', mood: 'learning', comps: ['communication'] }),
    ],
    reflections: [],
    createdAt: d(-90) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
  },
  {
    id: 'demo-act2', userId: DEMO_USER, name: '스타트업 백엔드 인턴', type: 'intern',
    org: '○○테크', role: '백엔드 인턴', resultUrl: null, outcome: '정규직 전환 제안(고사)',
    startedAt: '2025-01-02', endedAt: '2025-06-30', archivedAt: null, isInbox: false,
    legacyExperienceId: null,
    summaryReflection: '6개월 동안 "측정하고 개선하는" 사이클을 몸에 익혔다. 결제 정산 배치를 4시간에서 40분으로 줄이며, 막연한 추측보다 프로파일링 데이터가 훨씬 강력하다는 걸 배웠다. 다음엔 개선 전후를 지표로 남기는 습관을 더 일찍부터 들이고 싶다.',
    logs: [
      log('demo-act2', 0, '결제 정산 배치 프로파일링. N+1 쿼리와 인덱스 부재가 주 병목.', '2025-03-11', { cat: 'analysis', comps: ['analytical', 'technical'], keywords: ['프로파일링'] }),
      log('demo-act2', 1, '배치 조회로 전환 + 인덱스 추가. 처리 시간 4시간 → 40분.', '2025-04-02', { cat: 'develop', mood: 'proud', comps: ['technical', 'problem_solving'], quant: { type: 'before-after', before: '4시간', after: '40분' } }),
    ],
    reflections: [],
    createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-06-30T00:00:00Z',
  },
  {
    id: 'demo-act3', userId: DEMO_USER, name: '교내 개발 동아리 운영진', type: 'club',
    org: 'OO대학교', role: '운영진', resultUrl: null, outcome: null,
    startedAt: '2023-03-01', endedAt: '2024-12-31', archivedAt: null, isInbox: false,
    legacyExperienceId: null,
    summaryReflection: '주간 스터디 1년 운영과 신입 8명 멘토링으로 "가르치며 배우는" 경험을 했다. 갈등을 감정이 아니라 데이터로 조율하는 방식이 협업에서 잘 통한다는 걸 확인했다.',
    logs: [
      log('demo-act3', 0, '행사 방향을 두고 운영진 의견이 갈려 각 안의 장단점을 표로 정리해 설문으로 결정.', '2024-05-18', { cat: 'conflict_resolution', comps: ['leadership', 'communication'] }),
      log('demo-act3', 1, '해커톤 주최. 신입 멘토링 8명 진행.', '2024-09-21', { cat: 'leadership', mood: 'proud', comps: ['leadership'] }),
    ],
    reflections: [],
    createdAt: '2023-03-01T00:00:00Z', updatedAt: '2024-12-31T00:00:00Z',
  },
  {
    id: 'demo-act4', userId: DEMO_USER, name: 'CS·모의면접 스터디', type: 'study',
    org: '취준 스터디 (6인)', role: '스터디장', resultUrl: null, outcome: null,
    startedAt: d(-45), endedAt: null, archivedAt: null, isInbox: false,
    legacyExperienceId: null, summaryReflection: null,
    logs: [
      log('demo-act4', 0, '모의 기술면접 3회차. "인덱스가 왜 빠른가"에 B+Tree 구조까지 설명 성공 — 지난주 막혔던 질문을 다시 받아 통과한 게 뿌듯했다.', d(-2), { cat: 'interview', mood: 'proud', comps: ['technical', 'communication'], keywords: ['DB', '모의면접'] }),
      log('demo-act4', 1, '네트워크 주차 발표 준비. TCP 혼잡 제어를 그림 한 장으로 그려봤더니 내가 어디를 모르는지 보였다. 발표 자료 12장.', d(-6), { cat: 'learning', mood: 'learning', comps: ['technical'], keywords: ['네트워크', 'TCP'] }),
      log('demo-act4', 2, '스터디원 6명 일정 조율이 계속 깨져서 투표로 고정 시간대(화·토 저녁)를 정하고 결석 규칙을 합의. 이후 출석률 70% → 95%.', d(-13), { cat: 'leadership', mood: 'proud', comps: ['leadership', 'planning'], keywords: ['운영'] }),
      log('demo-act4', 3, '운영체제 스터디 시작. 매주 CS 1과목 + 모의면접 1회 루틴으로 커리큘럼 확정. 8주 계획표 공유.', d(-40), { cat: 'learning', mood: 'neutral', comps: ['planning'], keywords: ['운영체제', '커리큘럼'] }),
    ],
    reflections: [],
    createdAt: d(-45) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
  },
]

// ── W3 통합 streak + 365 heatmap + status 분포 ──────────────
function buildHeatmap(): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = []
  // 오래된 날(index 큰) → 오늘(index 0) 순으로 생성 후 date 오름차순 정렬 불필요 (backend 도 시계열)
  for (let i = 364; i >= 0; i--) {
    let count: number
    if (i <= 4) {
      // 최근 5일 — 연속 활동 (streak.current 5 와 정합)
      count = [2, 3, 1, 4, 2][i]
    } else if (i <= 20) {
      // 최근 3주 — 활발
      count = i % 3 === 0 ? 0 : (i % 4) + 1
    } else {
      // 이전 — 듬성듬성
      count = i % 7 === 0 ? 1 : 0
    }
    out.push({ date: d(-i), count })
  }
  return out
}

export const DEMO_STREAK: DashboardStreakResponse = {
  streak: { current: 5, lastActivityDate: d(0) },
  heatmap: buildHeatmap(),
  // 카드 상태 히스토그램 (PLANNED 제외) — DEMO_DASHBOARD_STATS 와 동일 소스, 대시보드 도넛
  statusDistribution: [
    { status: 'IN_PROGRESS', count: 7 },
    { status: 'PASSED', count: 1 },
    { status: 'FAILED', count: 1 },
  ],
}

// ── 성장 지표 (회고=성장 페이지) ─────────────────────────────
const ym = (offsetMonths: number) => {
  const now = new Date()
  const m = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
}

export const DEMO_GROWTH_METRICS: GrowthMetricsResponse = {
  monthlyComparison: {
    currentYearMonth: ym(0),
    previousYearMonth: ym(-1),
    applications: { current: 5, previous: 2, delta: 3 },
    activityLogs: { current: 14, previous: 6, delta: 8 },
    reflections: { current: 2, previous: 1, delta: 1 },
  },
  funnel: { total: 9, reachedInterview: 4, passed: 1 },
  insights: {
    mostActiveWeekday: { weekday: '화', count: 6, sharePercent: 30 },
    topJobCategory: { category: 'IT개발', count: 3 },
  },
  milestoneCounts: {
    applications: 9,
    reachedInterview: 4,
    passed: 1,
    activityLogs: 14,
    reflections: 2,
  },
}

// ── 내 정보 창고 저장 용량 ───────────────────────────────────
// ── 활동 타임라인 (GET /activity-logs · 사이드탭 "활동 일지" 기본 화면) ──────────
// DEMO_ACTIVITIES 의 로그를 TimelineLogItem 으로 파생 — 단일 소스 유지 (로그 수정 시 자동 동기화)
export const DEMO_TIMELINE: TimelinePage = {
  items: DEMO_ACTIVITIES.flatMap((act) =>
    (act.logs ?? []).map((l) => ({
      id: l.id,
      content: l.content,
      occurredAt: l.occurredAt,
      cat: l.cat,
      cl: l.cl ?? [],
      comps: l.comps ?? [],
      mood: l.mood,
      quant: l.quant,
      keywords: l.keywords ?? [],
      hasNote: false,
      createdAt: l.occurredAt + 'T09:00:00Z',
      activityId: act.id,
      activityName: act.name,
      activityIsInbox: act.isInbox ?? false,
      relatedStepId: null,
      stepName: null,
      companyName: null,
    })),
  ).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
  nextCursor: null,
}

export const DEMO_STORAGE_USAGE: StorageUsage = {
  usedBytes: Math.round(3.2 * 1024 * 1024),
  limitBytes: 100 * 1024 * 1024,
  usedMB: 3.2,
  limitMB: 100,
  percentage: 3,
}

// ── 자소서 탭 회사 조사 배너 ─────────────────────────────────
//
// 판단: 데모 카드의 회사명(카카오·토스·삼성전자·네이버·쿠팡·당근마켓)은 모두 "실존" 기업이다.
// 회사 조사 배너는 앱이 "치뽀가 수집한 회사 사실"로 제시하는 정보다. 실존 회사에 대해
// 재무·동향·핵심가치 등을 지어내면 곧 "허위 사실"이 되므로(CEO 확정 요구사항 #2·자소서 원칙),
// 이 항목은 안전하게 null(배너 미노출 — 컴포넌트의 정상적 graceful-absence 상태)로 둔다.
// (self-cl 답변처럼 "지원자 본인의 서술"은 가상이 아닌 실존 회사에 붙어도 허위가 아니지만,
//  회사 조사는 "회사에 대한 앱의 주장"이라 성격이 다르다.)
export const DEMO_COMPANY_RESEARCH: CompanyResearchResult | null = null

// ── 코인 잔액 (헤더 코인 칩·자소서 AI UI) ────────────────────
export const DEMO_COIN_BALANCE: CoinBalance = {
  balance: 150,
  tier: 'free',
  nextResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  monthlyCoinLimit: 150,
  companyResearchDailyCap: 2,
}
