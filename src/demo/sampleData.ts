// 데모 모드용 샘플 데이터. 모든 날짜는 "오늘(KST)" 기준 상대값으로 생성 — 데모를 언제 봐도 자연스럽게.
import { addDays, todayLocal } from '@/utils/datetime'
import type { Application, ApplicationStep } from '@/types/application'
import type { ApplicationCoverletter } from '@/types/coverletter'
import type { AutocompleteCompany } from '@/types/company'
import type {
  DashboardStats, DdayItem, InterviewReviewItem, GrowthMetricsResponse,
} from '@/api/dashboard'
import type { CalendarEvent, DailyNote } from '@/api/calendar'
import type { ChecklistItem } from '@/api/stepDetail'
import type { CoverletterChatMessage } from '@/api/coverletterDoc'
import type {
  UserProfile, LanguageCert, Cert, Award, Experience, CoverletterData, StorageUsage,
} from '@/api/myinfo'
import type { Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'
import type { DashboardStreakResponse } from '@/types/dashboardStreak'
import type { Activity, ActivityLog, TimelinePage } from '@/types/activity'
import type {
  CompanyResearchResult,
  InterviewPrepQuestion,
  InterviewPrepSession,
  InterviewType,
} from '@/types/interviewPrep'
import type { CoinBalance } from '@/types/coinSystem'

// 상대 날짜 — 반드시 KST 오늘 기준 (UTC toISOString 기준이면 KST 00~09시에 전 날짜로 하루 밀림. 2026-07-20 실발견)
const d = (offsetDays: number) => addDays(todayLocal(), offsetDays)
// scheduledDate(TIMESTAMPTZ) — KST 벽시각으로 조립 후 ISO 변환 (동일 이유로 UTC 날짜 기준 금지)
const dt = (offsetDays: number, hourKst = 10) =>
  new Date(`${addDays(todayLocal(), offsetDays)}T${String(hourKst).padStart(2, '0')}:00:00+09:00`).toISOString()

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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '금융 서비스의 사용자 경험을 설계하고 화면 흐름·인터랙션·디자인 시스템을 개선. PM·개발자와 협업해 가설을 화면으로 구현하고 사용성을 검증.',
      requirements: [
        'UX/UI 디자인 실무 또는 프로젝트 경험',
        'Figma 등 디자인 툴 능숙',
        '유저 플로우·프로토타입 설계 능력',
      ],
      preferred: [
        '디자인 시스템 구축·운영 경험',
        '데이터 기반 사용성 개선 경험',
        '프론트엔드 협업에 대한 이해',
      ],
      techStack: ['Figma', 'ProtoPie', 'Framer'],
      qualifications: [],
      keywords: ['사용자 경험', '디자인 시스템', '프로토타이핑', '협업'],
      parsedAt: dt(-1),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '디바이스·플랫폼에 탑재되는 임베디드 소프트웨어 설계·개발. 저수준 최적화, 하드웨어 연동, 성능·안정성 개선.',
      requirements: [
        'C/C++ 기반 개발 경험',
        '자료구조·알고리즘·운영체제 지식',
        '리눅스 환경 개발 경험',
      ],
      preferred: [
        '임베디드·펌웨어 개발 경험',
        '멀티스레드·성능 최적화 경험',
        '영어 기술 문서 독해·커뮤니케이션',
      ],
      techStack: ['C', 'C++', 'Linux', 'Python', 'Git'],
      qualifications: ['정보처리기사'],
      keywords: ['임베디드', '저수준 최적화', '알고리즘', '안정성'],
      parsedAt: dt(-2),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '서비스 기획 전반 — 사용자·시장 분석, 요구사항 정의, 화면 설계, 지표 기반 개선. 디자인·개발과 협업해 기능을 출시하고 성과를 측정.',
      requirements: [
        '서비스 기획 또는 관련 프로젝트 경험',
        '데이터 기반 의사결정 능력',
        '문서화·커뮤니케이션 역량',
      ],
      preferred: [
        'IT 서비스 도메인 이해',
        'SQL 등 데이터 분석 능력',
        'A/B 테스트·지표 설계 경험',
      ],
      techStack: ['Figma', 'SQL', 'Amplitude', 'Notion'],
      qualifications: [],
      keywords: ['서비스 기획', '지표 설계', '사용자 분석', 'A/B 테스트'],
      parsedAt: dt(-8),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '비즈니스 지표를 정의하고 대시보드를 구축. 로그·주문 데이터를 분석해 인사이트를 도출하고 의사결정을 지원. A/B 테스트 설계·해석.',
      requirements: [
        'SQL 능숙 · 대용량 데이터 처리 경험',
        '통계·지표 해석 능력',
        'Python 또는 R 기반 분석 경험',
      ],
      preferred: [
        '대시보드(Tableau·Looker 등) 구축 경험',
        '실험 설계·인과추론에 대한 이해',
        '커머스·물류 도메인 경험',
      ],
      techStack: ['SQL', 'Python', 'Tableau', 'Airflow'],
      qualifications: ['SQLD', 'ADsP'],
      keywords: ['데이터 분석', '지표 정의', 'A/B 테스트', '대시보드'],
      parsedAt: dt(-6),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '지역 기반 커뮤니티 서비스의 기능 개발·운영. 사용자 요구를 빠르게 실험하고, 신뢰와 안전을 지키는 시스템을 함께 만듭니다.',
      requirements: [
        '웹/앱 서비스 개발 경험',
        '문제를 스스로 정의하고 해결한 경험',
        '협업·커뮤니케이션 역량',
      ],
      preferred: [
        '스타트업·빠른 실험 환경 경험',
        '대용량 트래픽 처리에 대한 이해',
        '사이드 프로젝트 경험',
      ],
      techStack: ['Kotlin', 'Spring', 'React', 'AWS'],
      qualifications: [],
      keywords: ['로컬 커뮤니티', '빠른 실험', '신뢰·안전', '오너십'],
      parsedAt: dt(-1),
    },
    steps: [],
  },
  {
    id: 'demo-a7', userId: DEMO_USER, companyName: '현대자동차', jobTitle: '생산관리', jobCategory: '기타',
    status: 'IN_PROGRESS', jobUrl: 'https://careers.hyundai.com', memo: '인적성(HMAT) D-5 · 온라인 응시 환경 미리 점검', domain: 'hyundai.com',
    currentStepIndex: 1, needsDetail: false, isStarred: false, createdAt: d(-14) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '완성차 생산 라인의 공정·물류·품질 관리. 생산 계획 수립, 라인 효율 개선, 협력사 납기·재고 관리.',
      requirements: [
        '생산관리·산업공학 관련 지식',
        '데이터 기반 공정 개선 마인드',
        '현장 커뮤니케이션 역량',
      ],
      preferred: [
        '제조·자동차 산업에 대한 이해',
        'ERP·MES 시스템 사용 경험',
        '통계적 품질관리(SQC) 지식',
      ],
      techStack: ['Excel', 'SAP', 'Minitab'],
      qualifications: ['품질경영기사', '산업안전기사'],
      keywords: ['생산관리', '공정 개선', '품질', '납기 관리'],
      parsedAt: dt(-2),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '개인·소상공인 고객 대상 금융상품 상담·영업. 고객 자금 흐름 분석, 맞춤 상품 제안, 여수신·자산관리 지원.',
      requirements: [
        '금융·경제 기초 지식',
        '고객 응대·영업 커뮤니케이션 역량',
        '성실성과 직업 윤리',
      ],
      preferred: [
        '금융 관련 자격증 보유',
        '영업·고객 상담 경험',
        '데이터로 고객을 분석한 경험',
      ],
      techStack: [],
      qualifications: ['은행FP(AFPK)', '펀드투자권유대행인', '신용분석사'],
      keywords: ['고객 상담', '금융상품', '소상공인', '자산관리'],
      parsedAt: dt(0),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '전력 공기업의 경영지원 사무 — 예산·회계, 계약·구매, 인사·총무 등 조직 운영 전반을 지원.',
      requirements: [
        'NCS 직무능력 기반 사무 역량',
        '문서 작성·데이터 정리 능력',
        '공공기관 윤리·성실성',
      ],
      preferred: [
        '회계·재무 지식',
        '전산·한국사 자격증 보유',
        '엑셀 데이터 처리 능숙',
      ],
      techStack: ['Excel', '한글(HWP)'],
      qualifications: ['컴퓨터활용능력 1급', '한국사능력검정 1급', '전산회계 1급'],
      keywords: ['NCS', '경영지원', '예산·회계', '공공기관'],
      parsedAt: dt(-2),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '브랜드 마케팅 전략 수립·실행 — 캠페인 기획, 콘텐츠·채널 운영, 소비자 조사, 성과 분석을 통한 브랜드 자산 강화.',
      requirements: [
        '마케팅 관련 프로젝트·인턴 경험',
        '트렌드 감각과 콘텐츠 기획력',
        '데이터로 캠페인 성과를 본 경험',
      ],
      preferred: [
        '뷰티·소비재 산업에 대한 관심',
        'SNS·디지털 마케팅 경험',
        'GA 등 분석 툴 이해',
      ],
      techStack: ['Google Analytics', 'Meta Ads', 'Figma'],
      qualifications: ['GAIQ'],
      keywords: ['브랜드 마케팅', '캠페인 기획', '소비자 조사', '콘텐츠'],
      parsedAt: dt(-1),
    },
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
    jobPostingStatus: null,
    jobPosting: {
      responsibilities: '식품 브랜드의 상품 기획·마케팅 — 신제품 콘셉트 개발, 유통 채널 전략, 프로모션 실행, 판매 데이터 분석.',
      requirements: [
        '마케팅·상경 계열 기초 지식',
        '소비자 관점의 기획력',
        '숫자로 성과를 정리하는 능력',
      ],
      preferred: [
        '식품·FMCG 산업에 대한 관심',
        '유통·리테일에 대한 이해',
        'SNS 콘텐츠 기획 경험',
      ],
      techStack: ['Excel', 'Nielsen', 'Google Analytics'],
      qualifications: ['유통관리사 2급'],
      keywords: ['식품 마케팅', '상품 기획', '유통 전략', '소비자 분석'],
      parsedAt: dt(-3),
    },
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
  // 카카오 백엔드 — 완성(3/3). Kafka·MySQL·대용량 소재 맞물림.
  'demo-a1': [
    cl('demo-a1', 0, '카카오에 지원하게 된 동기를 작성해 주세요.', '지원동기',
      '[4시간 배치를 40분으로 — 대용량은 증설이 아니라 구조로 견딥니다]\n대용량 서비스는 서버를 늘려서가 아니라 병목의 구조를 바로잡아야 견딘다고 믿어 지원했습니다. 스타트업 백엔드 인턴 시절, 하루 30만 건의 이벤트를 처리하던 큐가 매일 새벽 지연되는 문제를 맡았습니다. 처음에는 서버 증설을 제안했지만 비용 대비 효과가 불확실했고, 대신 APM으로 원인을 재보니 병목은 트래픽 총량이 아니라 정산 배치와 큐 소비가 같은 커넥션 풀을 나눠 쓰는 구조에 있었습니다. 풀을 역할별로 분리하고 배치를 청크 단위로 쪼개자 처리 시간이 4시간에서 40분으로 줄었습니다. 사실 중간에 인덱스를 성급히 추가했다가 쓰기 성능이 20%가량 떨어져 되돌린 시행착오도 있었고, 그 뒤로는 개선 전후를 반드시 지표로 비교한 다음 반영하는 습관이 생겼습니다. 이 경험은 규모가 커질수록 더 절실해지는 원칙이라고 생각합니다. 카카오처럼 수천만 명이 동시에 쓰는 서비스에서는 1%의 지연도 수십만 명의 경험이 되기 때문입니다. 대규모 트래픽과 메시지 큐를 다루는 백엔드에서, 추측이 아니라 측정으로 구조를 바로잡아 트래픽이 급증해도 흔들리지 않는 시스템을 만드는 데 기여하고 싶어 지원했습니다.', 650),
    cl('demo-a1', 1, '지원 직무와 관련한 본인의 핵심 역량과 경험을 작성해 주세요.', '직무역량·핵심경험',
      '[측정으로 병목을 좁히고 Kafka로 유실을 막은 두 경험]\n저는 문제를 감이 아니라 수치로 좁혀 푸는 것이 백엔드의 기본기라고 생각합니다. 첫째, 성능 개선 경험입니다. 인턴 첫 달 매일 새벽 4시간씩 돌던 결제 정산 배치가 영업시간을 침범하기 시작했습니다. "데이터가 늘어 어쩔 수 없다"는 팀의 통념 대신 APM 프로파일링으로 재보니 전체 시간의 70%가 건별 단건 조회에 쓰이고 있었습니다. 조회를 배치 단위로 묶고 복합 인덱스를 추가해 40분으로 줄였고, 개선 전후를 그래프로 남겨 "측정 없이 개선 없다"는 공감대를 팀에 만들었습니다. 둘째, 대용량·비동기 경험입니다. 졸업 캡스톤에서 주문 API가 피크마다 느려지는 문제를 부하 테스트로 진단해 응답을 300ms에서 90ms로 줄였고, 주문과 알림을 Kafka로 분리해 트래픽이 몰려도 메시지 유실 없이 처리했습니다. 처음엔 컨슈머 재처리 설계를 놓쳐 중복 알림이 나가는 실수가 있었지만, 멱등 키를 도입해 같은 메시지가 두 번 처리되지 않도록 바로잡았습니다. 이 두 경험에서 얻은, MySQL 인덱스 설계와 캐시 도입을 반드시 지표로 검증하는 습관을 대규모 서비스 백엔드에서 이어가겠습니다.', 600),
    cl('demo-a1', 2, '입사 후 이루고 싶은 목표를 작성해 주세요.', '입사후포부',
      '[배포 전에 병목을 잡고, 장애를 미리 읽는 엔지니어로]\n입사 후에는 문제가 터지기 전에 신호를 먼저 읽는 백엔드 엔지니어로 성장하겠습니다. 단기적으로는 신규 API를 설계할 때 정상 흐름만이 아니라 부하 시나리오와 실패 케이스를 먼저 그려, 배포 후가 아니라 배포 전에 병목을 잡는 습관을 팀에 보태겠습니다. 인턴 때 개선 전후를 지표로 남겨 팀의 판단 기준을 바꿨던 것처럼, 성능 개선을 재현 가능한 기록으로 남겨 혼자만의 성과가 아니라 팀의 자산으로 만들겠습니다. 중장기적으로는 로그·메트릭·트레이싱을 엮어 장애를 사전에 감지하는 관측 체계를 다루고 싶습니다. 대규모 트래픽과 메시지 큐 위에서 1%의 지연이 수십만 명의 경험이 되는 환경일수록, 문제가 커지기 전에 이상 신호를 먼저 읽는 역량이 중요하다고 믿기 때문입니다. 측정으로 구조를 바로잡는 지금의 방식을 더 큰 규모에서 단련해, 트래픽이 아무리 몰려도 흔들리지 않는 시스템을 함께 만드는 데 기여하겠습니다.', 500),
  ],
  // 토스 프로덕트 디자이너 — 진행 중(2/3, 입사후포부 미작성). Figma·디자인 시스템 맞물림.
  'demo-a2': [
    cl('demo-a2', 0, '토스에 지원한 동기를 작성해 주세요.', '지원동기',
      '[귀찮은 분류 단계를 조회 시점으로 옮겨 사용률을 끌어올린 경험]\n좋은 금융 경험은 기능을 더하는 게 아니라 막히는 순간을 없애는 데서 나온다고 믿어 지원했습니다. 동아리 가계부 앱을 만들며 사용자 대부분이 카테고리 분류 기능을 쓰지 않는다는 걸 발견했고, 처음엔 안내 문구가 부족한 탓이라 생각해 설명을 늘렸습니다. 그런데 수치는 그대로였고, 다섯 명을 직접 인터뷰해 보니 문제는 설명이 아니라 순서였습니다. 저장하는 순간에 폴더를 고르는 단계가 귀찮아 다들 기본값에 쌓아둔 것이었습니다. 그래서 분류를 저장 시점이 아니라 나중에 지출을 볼 때로 옮기고, 최근 지출을 자동으로 묶어 "이렇게 분류할까요?"라고 제안했더니 분류 사용률이 눈에 띄게 올랐습니다. 사용자의 귀찮음을 데이터로 확인하고 흐름의 순서를 바꿔 푸는 것 — 그것이 제가 프로덕트 디자인에서 가장 하고 싶은 일입니다. 어렵게 느껴지는 금융을 누구나 막힘없이 쓰는 흐름으로 바꾸는 데 기여하고 싶어 지원했습니다.', 500),
    cl('demo-a2', 1, '핵심 프로젝트 경험과 그때의 역할을 작성해 주세요.', '직무역량·핵심경험',
      '[세션 리플레이로 이탈 지점을 찾아 가입 흐름을 다시 설계한 경험]\n저는 화면을 예쁘게 만드는 일보다 사용자가 어디서 멈추는지 찾아 흐름을 다시 짜는 일에 강합니다. 졸업 프로젝트에서 신규 가입 이탈률이 높다는 지적을 받았을 때, 처음엔 버튼 색과 문구부터 손댔지만 수치는 거의 그대로였습니다. 그래서 감으로 고치기를 멈추고 세션 리플레이로 화면별 이탈 지점을 확인하니, 3단계 인증 화면 한 곳에서 절반 가까이가 빠져나가고 있었습니다. 인증을 2단계로 줄이고 지금 어디까지 왔는지 보여 주는 진행 표시를 넣은 프로토타입을 ProtoPie로 만들어 사용성 테스트를 돌렸더니, 다섯 명 중 네 명이 "어디까지 왔는지 보여 안심된다"고 답했습니다. 다만 진행 표시를 처음엔 너무 크게 넣어 화면을 어지럽혔고, 크기를 줄이며 절제가 곧 정보 전달이라는 걸 배웠습니다. 나아가 버튼·입력 컴포넌트가 화면마다 제각각이던 것을 Figma 컴포넌트로 정리해 팀의 화면 제작 속도를 높였습니다. 감이 아니라 근거로 설득하고, 반복되는 결정을 시스템으로 줄이는 이 방식이 제 강점이라고 생각합니다.', 600),
    cl('demo-a2', 2, '입사 후 이루고 싶은 목표를 작성해 주세요.', '입사후포부', null, 800),
  ],
  // 삼성전자 SW — 완성(3/3). 임베디드·C/C++·리눅스 맞물림.
  'demo-a3': [
    cl('demo-a3', 0, '삼성전자 SW 직무에 지원한 동기를 작성해 주세요.', '지원동기',
      '[오실로스코프로 찾은 원인 — 눈에 안 보이는 곳을 측정하는 일]\n저수준 소프트웨어의 매력은 눈에 보이지 않는 동작을 측정으로 드러내는 데 있다고 믿어 지원했습니다. 학부 임베디드 수업에서 센서 값이 간헐적으로 튀는 문제를 맡았을 때, 처음엔 코드 로직만 며칠 동안 뜯어봤지만 원인을 찾지 못했습니다. 소프트웨어만 의심하던 시야를 넓혀 오실로스코프로 인터럽트 타이밍을 직접 재보니, 원인은 로직이 아니라 디바운스 처리 누락이라는 하드웨어 신호 쪽 문제였습니다. 짧은 지연 처리를 넣자 값이 안정됐고, 그때 문제는 코드 안에만 있지 않다는 것을 배웠습니다. 이 경험은 소프트웨어와 하드웨어의 경계에서 원인을 찾는 일이 얼마나 흥미로운지 알게 해 줬습니다. 수많은 기기에 탑재되는 소프트웨어는 1%의 불안정도 대규모 문제가 됩니다. 눈에 보이지 않는 동작을 끝까지 측정으로 확인하는 태도로, C/C++와 리눅스 위에서 성능과 안정성을 함께 잡는 엔지니어가 되고 싶어 지원했습니다.', 500),
    cl('demo-a3', 1, '지원 직무와 관련한 핵심 경험을 작성해 주세요.', '직무역량·핵심경험',
      '[처리량 40% 개선과 간헐적 크래시 추적 — 재현이 최적화의 시작]\n저는 최적화든 버그든 재현 가능하게 만드는 것이 문제 해결의 절반이라고 생각합니다. 임베디드 팀 프로젝트에서 영상 처리 루프가 목표 프레임을 못 맞추는 문제를 맡았을 때, 알고리즘부터 바꾸려다 오히려 시간을 버렸습니다. 방향을 바꿔 프로파일링으로 재보니 병목은 연산이 아니라 프레임마다 일어나는 불필요한 메모리 복사였습니다. 버퍼 복사를 제거하고 링 버퍼 구조로 바꾸자 처리량이 40% 높아졌습니다. 또 며칠에 한 번 발생하는 간헐적 크래시는 로그만으로 잡히지 않아, 조건을 바꿔 가며 100회 반복하는 재현 스크립트를 만들어 범위를 좁혔고, 원인이 멀티스레드 경합임을 확인해 락 구조를 다시 설계했습니다. 재현 환경을 먼저 만드느라 초기엔 더뎠고 팀에서도 조급해했지만, 결국 그것이 원인을 정확히 짚는 가장 빠른 길이었습니다. C·C++·리눅스 위에서 자료구조와 OS 지식을 실제 문제에 적용해 온 이 경험이, 안정성이 곧 품질인 임베디드 개발에서 제가 내세울 핵심 역량입니다.', 550),
    cl('demo-a3', 2, '본인의 성장 과정과 가치관을 작성해 주세요.', '성장과정·가치관',
      '[분해부터 하던 아이가 몇 ms를 재는 사람이 되기까지]\n저는 겉보기보다 원리를 먼저 확인하려는 사람으로 자라났습니다. 어릴 때부터 "왜 이렇게 동작하지?"가 궁금해 고장 난 선풍기를 뜯어보다 모터 원리를 알게 되곤 했고, 그 호기심이 자연스럽게 전공 선택으로 이어졌습니다. 대학에 와서는 이 호기심을 습관으로 바꾸는 계기가 있었습니다. 팀 프로젝트에서 "프로그램이 느리다"는 막연한 불평만 반복되던 때, 저는 어디가 몇 ms 걸리는지부터 재 보자고 제안했습니다. 근거 없는 추측이 오가던 회의가 숫자 하나 앞에서 정리되는 걸 보며, 측정이 가장 조용한 설득이라는 걸 배웠습니다. 처음엔 재는 데 시간을 쓰는 게 비효율처럼 보여 눈치도 봤지만, 엉뚱한 곳을 고치느라 낭비하던 시간이 줄자 팀도 방식을 받아들였습니다. 이후로는 문제를 만나면 감정이나 인상보다 먼저 재 보는 것이 제 기준이 되었습니다. 이 습관은 임베디드처럼 동작이 눈에 보이지 않는 영역일수록 강력했습니다. 정확해야 하는 곳에서는 끝까지 파고들고 그 근거를 팀과 나누는 사람으로 계속 성장하고 싶습니다.', 550),
  ],
  // 네이버 서비스 기획(합격) — 완성(2/2). 지표·A/B·SQL 맞물림.
  'demo-a4': [
    cl('demo-a4', 0, '네이버 서비스 중 개선하고 싶은 것과 그 이유를 작성해 주세요.', '직무역량·핵심경험',
      '[저장 후 7일 재방문율로 검증하는 즐겨찾기 개선안]\n좋은 기획은 아이디어의 참신함이 아니라 검증 가능한 가설에서 나온다고 생각합니다. 지도의 즐겨찾기를 200곳 넘게 쓰는 헤비 유저로서 저장은 쉽지만 다시 찾을 때 막히는 문제를 반복해 겪었고, 처음엔 폴더 UI가 불편한 탓이라 여겼습니다. 그런데 주변 다섯 명을 인터뷰하니 네 명이 "폴더는 만들었는데 안 쓴다"고 답했고, 진짜 원인은 저장하는 순간에 폴더를 고르는 단계가 귀찮아 전부 기본 폴더에 쌓이는 데 있었습니다. 그래서 정리 부담을 저장 시점이 아니라 나중에 다시 볼 때로 옮기는 안을 제안합니다. 최근 저장한 장소를 지역·카테고리로 자동으로 묶어 "이 일곱 곳을 여행 폴더로 만들까요?"라고 제안하면, 정리 비용을 사용자가 의지를 낸 순간으로 옮길 수 있습니다. 물론 자동 묶음이 어설프면 오히려 방해가 되므로, 무작정 적용하기보다 저장 후 7일 재방문율과 폴더 생성률을 A/B로 나눠 검증하겠습니다. 사용자의 귀찮음을 데이터로 확인하고 흐름의 순서를 바꿔 푸는 것이, 제가 서비스 기획에서 가장 하고 싶은 일입니다.', 600),
    cl('demo-a4', 1, '네이버에 지원한 동기를 작성해 주세요.', '지원동기',
      '[질문 순서만 바꿔 완료율 20%를 올린 경험에서 얻은 확신]\n큰 기능이 아니라 작은 순서 하나가 사용자의 행동을 바꾼다는 확신으로 지원했습니다. 학과 프로젝트에서 만든 설문 앱의 응답 완료율이 낮았을 때, 처음엔 보상이 약한 탓이라 생각해 경품을 늘리자고 했습니다. 그런데 로그를 뜯어보니 이탈은 보상 안내가 아니라 초반의 긴 인적사항 문항에서 몰려 있었습니다. 부담이 적은 질문을 앞으로, 개인정보 문항을 뒤로 옮기는 순서 변경만으로 완료율이 20% 올랐고, 그때 사용자의 마음은 크게 설득하는 게 아니라 흐름을 매끄럽게 만들어 얻는 것임을 배웠습니다. 경품을 늘리자던 처음 판단이 틀렸음을 데이터로 인정한 경험이기도 했습니다. 이후로는 문제를 만나면 무엇을 더할지보다 어디서 막히는지를 먼저 봅니다. 매일 수천만 명이 지나는 서비스에서는 이 작은 순서 하나가 곧 큰 지표가 됩니다. 지표로 가설을 검증하며 사용자 관점의 작은 개선을 성과로 연결하는 기획자가 되고 싶어 지원했습니다.', 500),
  ],
  // 쿠팡 데이터 분석(불합격) — 완성(2/2). SQL·Python·대시보드 맞물림.
  'demo-a5': [
    cl('demo-a5', 0, '쿠팡에 지원한 동기를 작성해 주세요.', '지원동기',
      '[정확도보다 개입 지점 — 데이터로 문제를 정의하는 사람]\n저는 데이터 분석의 본질이 정답을 맞히는 것보다 무엇이 진짜 문제인지 정의하는 데 있다고 믿어 지원했습니다. 교내 공모전에서 출퇴근 혼잡을 예측하는 모델을 만들 때, 처음엔 예측 정확도를 높이는 데만 매달렸습니다. 그런데 정확도를 몇 %p 올려도 현실에서 바뀌는 게 없었고, 방향을 틀어 "어느 역·어느 시간대에 개입해야 효과가 큰가"를 지표로 좁히자 비로소 쓸모 있는 결론이 나왔습니다. 상위 세 개 역의 특정 시간대만 조정해도 전체 혼잡의 상당 부분을 줄일 수 있다는 것이었습니다. 정확도라는 숫자에 갇혀 정작 쓸모를 놓칠 뻔한 그 경험에서, 분석은 리포트를 만드는 일이 아니라 결정을 바꾸는 일이라는 걸 배웠습니다. 커머스·물류처럼 방대한 로그가 쌓이는 환경에서는 개선 여지가 큰 지점을 먼저 짚는 눈이 특히 중요합니다. 숫자로 문제를 정의하고 실험으로 검증해 의사결정을 돕는 분석가가 되고 싶어 지원했습니다.', 500),
    cl('demo-a5', 1, '데이터로 문제를 해결한 경험을 작성해 주세요.', '직무역량·핵심경험',
      '[코호트 분석으로 이탈 화면을 찾아 재방문율 12%를 올린 경험]\n저는 막연한 가설을 검증 가능한 질문으로 쪼개는 일을 가장 잘합니다. 동아리 서비스의 이탈 원인을 찾을 때, 팀에서는 "가격이 비싸서"라는 추측이 지배적이었습니다. 저는 그 추측을 그대로 받지 않고 가입 후 7일 행동 로그를 SQL로 코호트별로 쪼갰습니다. 그 결과 이탈은 가격 화면이 아니라 특정 설정 단계 한 곳에 몰려 있었고, 그 화면 하나를 단순화하자 재방문율이 12% 올랐습니다. 처음엔 코호트 기준을 잘못 잡아 엉뚱한 결론을 낼 뻔했지만, 기준을 다시 정의하며 데이터는 자르는 방식에 따라 전혀 다른 이야기를 한다는 걸 배웠습니다. 이후 매번 요청받아 돌리던 지표를 Tableau 대시보드로 만들어 팀이 스스로 보게 했고, Python으로 주간 리포트를 자동화해 반복 작업을 크게 줄였습니다. SQL·Python·대시보드로 "측정 가능한 질문"을 만드는 이 역량을, 방대한 로그가 매일 쌓이는 실무에서 이어 가고 싶습니다.', 550),
  ],
  // 당근마켓(지원 예정, 직무 미정) — 진행 중(1/2). 신뢰·안전·빠른 실험 맞물림.
  'demo-a6': [
    cl('demo-a6', 0, '당근마켓에 지원하고 싶은 이유를 작성해 주세요.', '지원동기',
      '[사기 글을 걸러낸 신고 봇 — 가까운 불편을 기술로 푸는 일]\n저는 멀리 있는 거대한 문제보다 내 주변의 구체적인 불편을 기술로 푸는 일에 끌려 지원을 준비합니다. 자취생 커뮤니티를 이용하다 중고 거래 사기 글이 반복적으로 올라오는 걸 보고, 신고가 쌓이기만 하고 처리가 느린 게 문제라고 생각했습니다. 그래서 반복되는 문구와 계좌 패턴을 잡아내는 간단한 신고 보조 봇을 만들어 운영진에게 먼저 걸러 보여 줬습니다. 처음엔 정상 글까지 잡아내는 오탐이 많아 오히려 항의를 받았지만, 규칙을 좁히고 사람이 최종 확인하는 단계를 두자 오탐이 줄고 신뢰를 얻었습니다. 그 경험에서 신뢰와 안전은 화려한 기능이 아니라 이런 작은 장치들이 쌓여 만들어진다는 걸 배웠습니다. 완벽한 설계를 오래 붙들기보다 일단 동작하는 최소 버전으로 반응을 보고 고치는 방식이 제게 맞습니다. 지역과 가까운 사람들의 신뢰가 곧 서비스의 자산인 환경에서, 빠르게 실험하고 그 신뢰를 지키는 시스템을 함께 만드는 데 기여하고 싶어 지원을 준비합니다.', 550),
    cl('demo-a6', 1, '가장 몰입했던 프로젝트 경험을 작성해 주세요.', '직무역량·핵심경험', null, 800),
  ],
  // 현대자동차 생산관리 — 완성(3/3). 공정·품질·Minitab·SQC 맞물림.
  'demo-a7': [
    cl('demo-a7', 0, '현대자동차 생산관리 직무에 지원한 동기를 작성해 주세요.', '지원동기',
      '[요일별 발주 기준으로 폐기를 줄인 경험 — 현장을 숫자로 잇는 일]\n저는 생산관리가 숫자와 현장을 잇는 일이라고 믿어 지원했습니다. 편의점 물류 아르바이트를 하며 발주와 재고가 대부분 담당자의 감으로 관리돼 결품과 과잉 폐기가 매주 반복되는 걸 봤습니다. 처음엔 발주량을 일괄로 늘려 결품부터 막으려 했지만 이번엔 폐기가 늘었고, 문제는 양이 아니라 요일별 편차를 무시한 데 있었습니다. 그래서 최근 몇 주의 판매를 요일·품목별로 정리해 발주 기준을 다시 세우자 결품과 폐기가 함께 줄었습니다. 엑셀로 숫자 몇 개를 정리했을 뿐인데 매주 반복되던 낭비가 눈에 띄게 준 그 경험이, 현장의 손실은 대개 데이터로 줄일 수 있다는 확신을 줬습니다. 완성차 생산은 공정·물류·품질이 촘촘히 얽혀 작은 편차도 라인 전체로 번집니다. 현장의 흐름을 데이터로 읽고 작업자의 목소리를 반영해, 라인 효율과 납기를 함께 잡는 생산관리 담당자가 되고 싶어 지원했습니다.', 500),
    cl('demo-a7', 1, '지원 직무와 관련한 핵심 경험을 작성해 주세요.', '직무역량·핵심경험',
      '[병목을 재정의해 대기 30% 단축, Minitab으로 불량 원인 좁히기]\n저는 현장 문제를 인상이 아니라 데이터로 좁혀서 푸는 데 강합니다. 산업공학 팀 프로젝트에서 학내 카페의 긴 대기 시간을 줄이는 과제를 맡았을 때, 다들 제조 속도가 느린 탓이라 여겨 인원 충원을 제안했습니다. 저는 단계별 소요 시간을 직접 측정했고, 병목은 음료 제조가 아니라 주문·결제 대기라는 뜻밖의 결과를 얻었습니다. 선결제 방식을 제안해 평균 대기를 30% 줄였고, 원인을 재정의하는 것만으로 더 적은 비용으로 문제를 풀 수 있음을 배웠습니다. 또 다른 프로젝트에서는 불량 데이터를 Minitab 관리도로 그려 특정 시간대에 불량이 몰린다는 패턴을 찾아 교대 직후 점검 절차를 보강했습니다. 초기엔 표본을 적게 잡아 성급히 결론 낼 뻔했지만, 데이터를 더 모아 판단을 미룬 것이 오히려 오판을 막았습니다. 엑셀·통계 도구로 현장 데이터를 다루고 SQC 관점으로 원인을 좁히는 이 역량을, 작은 편차가 라인 전체로 번지는 생산 현장에서 발휘하겠습니다.', 550),
    cl('demo-a7', 2, '구성원과 의견이 달랐던 경험과 해결 과정을 작성해 주세요.', '협업·갈등경험',
      '[하루 동안 현장을 따라다니며 안을 고친 경험 — 관찰이 곧 설득]\n저는 갈등은 설득이 아니라 관찰로 푼다고 생각합니다. 팀 프로젝트에서 제가 데이터로 설계한 최적 작업 동선과, 현장 작업자분들이 오래 써 온 익숙한 동선이 충돌한 적이 있습니다. 처음엔 제 안이 수치상 더 효율적이니 맞다고 밀어붙였고, 당연히 반발을 샀습니다. 회의로는 좁혀지지 않아, 저는 하루 동안 현장을 직접 따라다니며 왜 그 동선을 쓰는지 관찰했습니다. 그러자 제 안이 무시했던 안전상의 이유와 자재 적재 위치라는 제약이 눈에 보였습니다. 그 제약을 반영해 동선을 다시 짜자, 효율은 조금 양보했지만 현장이 실제로 받아들이고 지킬 수 있는 안이 됐습니다. 데이터는 강력하지만 현장의 맥락을 이길 수는 없다는 것, 그리고 상대의 이유를 먼저 관찰하면 갈등이 협력으로 바뀐다는 것을 배웠습니다. 여러 이해관계가 얽히는 생산관리일수록 이렇게 현장을 먼저 이해하는 태도가 중요하다고 생각합니다.', 500),
  ],
  // KB국민은행 금융영업 — 완성(3/3). 소상공인 금융·상담 맞물림.
  'demo-a8': [
    cl('demo-a8', 0, 'KB국민은행에 지원한 동기를 작성해 주세요.', '지원동기',
      '[상인 열두 분의 인터뷰에서 본 금융의 문턱 — 설명하는 사람]\n저는 금융의 문턱이 상품이 아니라 설명해 주는 사람의 부재에 있다고 배워 지원했습니다. 창업 동아리에서 소상공인용 정산 서비스를 기획하며 상인 열두 분을 인터뷰했습니다. 매출은 있는데 현금 흐름이 꼬여 대출 창구 앞에서 발길을 돌리는 분, 어떤 상품이 있는지도 모른 채 지인에게 급전을 빌리는 분을 만났습니다. 처음엔 더 좋은 상품을 만들면 된다고 생각했지만, 인터뷰가 쌓일수록 문제는 상품 수가 아니라 그것을 자기 말로 풀어 설명해 줄 사람이 곁에 없다는 것이었습니다. 저희 팀이 복잡한 정산 내역을 쉬운 말로 바꿔 보여드렸을 때 "이제야 내 장사가 보인다"던 반응이, 제가 은행 영업에서 하고 싶은 일의 원형이 됐습니다. 좋은 상품을 나열하는 사람이 아니라, 고객의 자금 흐름을 함께 읽고 필요한 상품을 먼저, 그리고 쉽게 설명하는 사람이 되고 싶어 지원했습니다.', 500),
    cl('demo-a8', 1, '조직 생활에서 구성원과 갈등을 겪었던 경험과 해결 과정을 작성해 주세요.', '협업·갈등경험',
      '[반반으로 갈린 회의를 표와 설문으로 정리한 경험 — 합의의 방식]\n저는 갈등의 해법이 논쟁의 승리가 아니라 결정 방식에 대한 합의라고 배웠습니다. 동아리 행사 방향을 두고 운영진이 대면 해커톤과 온라인 세미나로 정확히 반반 갈렸습니다. 처음엔 각자 자기 안의 장점만 반복하며 회의가 감정싸움으로 흘렀고, 저 역시 제 안을 관철하려 목소리를 높였습니다. 그러다 이대로는 누가 이겨도 앙금이 남겠다는 생각에, 다투는 대신 방식을 바꾸자고 제안했습니다. 각 안의 예상 비용·참여 인원·준비 공수를 표로 정리해 공유하고, 결정은 부원 전체 설문에 맡기자고 했습니다. 결과는 제 안이 아닌 해커톤이었지만, 반대편이던 운영진이 먼저 "이렇게 정하니 서운하지 않다"고 말해 줬습니다. 그때 사람들은 결과보다 결정 과정이 공정했는지에 승복한다는 것을 배웠습니다. 고객이나 동료와 이해가 갈릴 때에도, 근거를 함께 펴 놓고 정하는 이 방식으로 오래가는 신뢰를 쌓을 수 있다고 생각합니다.', 500),
    cl('demo-a8', 2, '입행 후 이루고 싶은 목표를 작성해 주세요.', '입사후포부',
      '[상담 이력을 기록하는 행원에서 소상공인 금융 전문가로]\n저는 고객을 가장 가까이서 만나 신뢰를 쌓는 행원에서 출발하겠습니다. 단기적으로는 영업점에서 개인·소상공인 고객의 자금 흐름을 함께 읽고, 필요한 상품을 먼저 쉬운 말로 설명하는 사람이 되겠습니다. 동아리에서 상인 인터뷰를 정리하며 익힌 기록 습관을 살려, 상담 이력을 꼼꼼히 남기고 고객의 생애 단계 변화에 맞춰 다음 제안을 준비하겠습니다. 한 번의 판매가 아니라 이어지는 관계를 만드는 것이 결국 은행의 자산이라고 믿기 때문입니다. 중장기적으로는 소상공인 금융 지원 분야로 전문성을 키우고 싶습니다. 제가 인터뷰에서 만났던, 제도권 금융 앞에서 머뭇거리던 분들에게 가장 먼저 손 내미는 사람이 되고 싶기 때문입니다. 자격증으로 다진 기본기 위에 현장에서 쌓은 고객 이해를 더해, 어려운 금융을 쉬운 말로 옮겨 주는 은행원으로 꾸준히 성장하겠습니다.', 500),
  ],
  // 한국전력공사 사무 — 완성(2/2). NCS·예산·회계·전산 맞물림.
  'demo-a9': [
    cl('demo-a9', 0, '한국전력공사에 지원한 동기를 작성해 주세요.', '지원동기',
      '[집행 내역을 공개해 신뢰를 얻은 총무 경험 — 조직을 받치는 일]\n저는 조직이 조용히 굴러가게 받치는 경영지원 업무의 가치를 믿어 지원했습니다. 학생회 총무를 맡아 1년 예산을 관리하며, 처음엔 영수증을 모아 정리하기만 하면 되는 줄 알았습니다. 그런데 회비 사용에 대한 불신이 회의마다 반복되는 걸 보고, 문제는 정산의 정확성이 아니라 과정의 투명성이라는 걸 깨달았습니다. 그래서 매달 집행 내역을 항목별로 정리해 전체에 공개하고 질문을 받는 자리를 만들었습니다. 처음엔 번거롭다는 반응도 있었고 저도 매달 정리가 부담스러웠지만, 반년쯤 지나자 "돈이 어디 쓰이는지 보인다"는 신뢰가 쌓였고 예산 관련 갈등이 눈에 띄게 줄었습니다. 국민의 세금과 전력 인프라를 다루는 공기업의 사무는 정확성과 투명성이 곧 신뢰라고 생각합니다. NCS 기반 사무 역량과 꼼꼼한 데이터 정리 습관으로, 조직의 뒤를 든든히 받치는 사람이 되고 싶어 지원했습니다.', 500),
    cl('demo-a9', 1, '지원 직무와 관련한 본인의 역량을 작성해 주세요.', '직무역량·핵심경험',
      '[초과 항목을 찾아 예산을 다시 짜고, 규정을 끝까지 대조한 경험]\n저는 흩어진 자료를 정리해 판단의 근거로 바꾸는 일에 강합니다. 총무 일을 하며 매달 지출 내역을 항목별로 정리해 추이를 그래프로 공유했는데, 그 과정에서 특정 항목이 매달 예산을 초과한다는 패턴을 발견했습니다. 처음엔 그저 아껴 쓰자고 독려했지만 효과가 없었고, 문제는 씀씀이가 아니라 애초의 배분이 현실과 맞지 않는 데 있었습니다. 실제 사용 비율에 맞춰 항목별 예산을 다시 짜자 다음 학기 예산 정확도가 크게 올랐습니다. 또 공모전 회계 정산을 맡았을 때는 증빙 규정을 한 줄씩 대조하며 누락 없이 마감했는데, 급하게 넘겼다면 놓쳤을 항목을 끝까지 확인한 덕에 문제가 없었습니다. 반복 대조가 지루해 건너뛰고 싶던 순간도 있었지만, 규정은 예외 없이 확인해야 신뢰가 된다는 걸 그때 배웠습니다. 컴퓨터활용능력과 전산회계로 다진 문서·데이터 처리 능력, 그리고 규정을 끝까지 확인하는 성실함이 공기업 사무에서 발휘할 제 강점입니다.', 550),
  ],
  // 아모레퍼시픽 브랜드 마케팅 — 완성(3/3). GA·캠페인·콘텐츠 맞물림.
  'demo-a10': [
    cl('demo-a10', 0, '아모레퍼시픽 브랜드 마케팅 직무에 지원한 동기를 작성해 주세요.', '지원동기',
      '[광고를 추천으로 바꿔 참여율을 두 배로 — 감각과 숫자 사이의 일]\n저는 브랜드 마케팅이 감각과 숫자 사이에서 균형을 잡는 일이라고 믿어 지원했습니다. 교내 뷰티 동아리에서 신제품 체험단 캠페인을 기획했을 때, 처음엔 정보를 촘촘히 담은 광고형 콘텐츠를 만들었지만 반응이 미지근했습니다. 왜 저장도 공유도 되지 않는지 데이터를 들여다보니, 사람들은 제품 설명이 아니라 친구의 진짜 후기 같은 이야기에 반응하고 있었습니다. 그래서 콘텐츠의 톤을 "광고"에서 "친구의 추천"으로 바꾸고 체험단의 솔직한 후기를 전면에 세웠더니 참여율이 두 배가 됐습니다. 정성 들여 만든 첫 콘텐츠가 데이터 앞에서 뒤집힌 그 경험이, 트렌드 감각과 성과 측정은 함께 가야 한다는 확신을 줬습니다. 감각만으로도, 숫자만으로도 사람의 마음은 움직이지 않는다고 생각합니다. 소비자의 마음을 읽는 콘텐츠와 성과를 재는 숫자를 함께 다루는 브랜드 마케터가 되고 싶어 지원했습니다.', 500),
    cl('demo-a10', 1, '지원 직무와 관련한 핵심 경험을 작성해 주세요.', '직무역량·핵심경험',
      '[GA로 콘텐츠 유형을 재편해 팔로워를 3개월 만에 두 배로]\n저는 콘텐츠를 감이 아니라 데이터로 다듬어 성과로 잇는 데 강합니다. 동아리 SNS 채널을 6개월간 맡으며, 처음엔 예쁜 이미지 위주로 매일 올렸지만 팔로워는 좀처럼 늘지 않았습니다. 방향을 바꿔 게시물별 도달·저장·클릭을 GA와 채널 인사이트로 추적하니, 정보형 콘텐츠보다 공감형 콘텐츠의 저장률이 훨씬 높다는 패턴이 보였습니다. 그에 맞춰 콘텐츠 비중을 재편하자 팔로워가 3개월 만에 두 배로 늘었습니다. 또 체험단 캠페인에서는 두 가지 카피를 소규모로 먼저 돌려 반응이 좋은 쪽에 예산을 몰았습니다. 초반엔 표본이 적은데도 성급히 판단할 뻔했지만, 며칠 더 지켜본 뒤 결정해 오판을 피했습니다. 감이 아니라 작은 실험으로 방향을 정하고 GA·광고 도구로 성과를 읽는 이 방식이, 브랜드 자산을 쌓아 가는 마케팅에서 제가 가장 잘하는 일이라고 생각합니다.', 500),
    cl('demo-a10', 2, '본인의 성장 과정과 가치관을 작성해 주세요.', '성장과정·가치관',
      '[매대 위치가 매출을 바꾸는 걸 보며 생긴 관찰의 습관]\n저는 사람들의 선택 뒤에 숨은 이유를 관찰하는 사람으로 자라났습니다. 어릴 때부터 무엇이 사람의 지갑을 열게 하는지 지켜보는 걸 좋아했는데, 편의점 아르바이트를 하며 그 관심이 구체적인 습관이 되었습니다. 매대 위치만 살짝 바꿔도 같은 상품의 매출이 달라지는 걸 직접 보며, 작은 배치 하나가 행동을 바꾼다는 데 흥미를 느꼈습니다. 처음엔 그저 신기해하는 데 그쳤지만, 왜 그런지 이유를 적어 두기 시작하면서 관찰이 자산으로 바뀌었습니다. 이후로 좋았던 광고와 캠페인을 매주 스크랩하고 왜 마음이 움직였는지 한 줄로 남기는 습관을 3년째 이어오고 있습니다. 기록이 쌓이자 기획을 할 때 감이 아니라 축적된 사례에서 근거를 꺼낼 수 있게 되었고, 유행을 좇는 대신 왜 유행하는지를 먼저 묻게 되었습니다. 트렌드를 유행이 아니라 관찰의 누적으로 읽는 이 태도가, 마케터로서 저를 지탱하는 힘이 되었습니다.', 500),
  ],
  // CJ제일제당 식품 마케팅(지원 예정) — 진행 중(1/2). 식품·소비자·판매 데이터 맞물림.
  'demo-a11': [
    cl('demo-a11', 0, 'CJ제일제당에 지원하고 싶은 이유를 작성해 주세요.', '지원동기',
      '[매대에서 신제품의 흥망을 관찰하는 취미 — 소비자의 하루를 읽는 일]\n저는 식품 마케팅이 소비자의 하루 리듬을 이해하는 일이라고 믿어 지원을 준비합니다. 자취를 시작하며 간편식으로 끼니를 해결하다 보니, 이 시장이 얼마나 빠르게 바뀌는지 소비자로서 매일 체감했습니다. 처음엔 그저 신제품을 사 먹는 재미였지만, 어떤 제품은 순식간에 매대 중앙을 차지하고 어떤 제품은 몇 주 만에 사라지는 게 눈에 들어오면서 그 차이가 궁금해졌습니다. 그래서 마트에 갈 때마다 신제품의 위치와 가격, 매대에서 버티는 기간을 노트에 적어 두는 관찰이 취미가 됐습니다. 몇 달 치가 쌓이자, 잘 팔리는 제품에는 진열 위치와 출시 시점, 소비자가 그것을 찾는 식사 시간대라는 나름의 패턴이 보였습니다. 단순한 취미가 시장을 읽는 눈으로 바뀐 셈입니다. 식품 마케팅은 결국 소비자가 언제 무엇을 먹는지를 읽는 일이라고 생각합니다. 판매 데이터와 소비자 관점을 함께 읽어 신제품이 매대에 자리 잡도록 돕는 마케터가 되고 싶어 지원을 준비합니다.', 550),
    cl('demo-a11', 1, '가장 성과가 컸던 경험을 작성해 주세요.', '직무역량·핵심경험', null, 800),
  ],
}
export const getDemoCoverletters = (applicationId: string): ApplicationCoverletter[] =>
  DEMO_COVERLETTERS[applicationId] ?? []

// ── 자소서 AI 대화 (카카오 지원동기) ─────────────────────
/**
 * 🔴 **데모 채팅창이 비어 있었다** (2026-08-09). `/coverletter/messages` 가 `[]` 를 돌려줘서
 * 데모 방문자는 **「AI 에게 묻기」가 뭘 해주는지 볼 수 없었다** — 랜딩은 그걸 광고하는데.
 * 어제 면접에서 고친 것과 같은 문제다(광고하는 기능이 체험판에 없음).
 *
 * 🔴 **대화는 사람이 썼다.** AI 로 뽑으면 실사용자 자료가 섞일 위험이 있고,
 * 데모 자소서(카카오 = 배치 개선·Kafka)와 소재가 맞물려야 진짜처럼 보인다.
 *
 * 🔴 **보내기는 여전히 차단**된다(`POST /coverletter/chat` → 가입 모달).
 * 지난 대화를 보여주는 것과 새로 부르는 것은 다르다.
 */
export const DEMO_COVERLETTER_MESSAGES: Record<string, CoverletterChatMessage[]> = {
  'demo-a1': [
    {
      id: 'demo-msg1',
      applicationId: 'demo-a1',
      role: 'user',
      content:
        '지원동기 도입부가 좀 늘어지는 것 같아요. 배치를 40분으로 줄인 수치를 앞으로 당기고 200자쯤 줄여줄 수 있을까요?',
      suggestedUpdates: null,
      citations: null,
      createdAt: d(-1) + 'T04:12:00Z',
    },
    {
      id: 'demo-msg2',
      applicationId: 'demo-a1',
      role: 'assistant',
      content:
        '도입부에서 믿음을 먼저 말하고 사례가 뒤에 오는 구조라 첫 세 문장이 비슷한 말을 반복하고 있었어요. 수치를 첫 문장으로 올리고, 인덱스 시행착오는 한 문장으로 압축했습니다. 카카오가 요구하는 대규모 트래픽 맥락은 마지막에 그대로 두었어요.',
      suggestedUpdates: [
        {
          clId: 'demo-a1-cl0',
          newAnswer:
            '[4시간 배치를 40분으로 — 대용량은 증설이 아니라 구조로 견딥니다]\n하루 30만 건을 처리하던 정산 배치를 4시간에서 40분으로 줄인 경험이 지원의 계기였습니다. 스타트업 백엔드 인턴 시절 매일 새벽 큐가 지연되는 문제를 맡았을 때, 처음엔 서버 증설을 제안했지만 APM 으로 다시 재보니 병목은 트래픽 총량이 아니라 정산 배치와 큐 소비가 같은 커넥션 풀을 나눠 쓰는 구조에 있었습니다. 풀을 역할별로 분리하고 배치를 청크로 쪼개 처리 시간을 40분으로 줄였습니다. 중간에 인덱스를 성급히 추가했다가 쓰기 성능이 20% 떨어져 되돌린 뒤로는, 개선 전후를 반드시 지표로 비교하고 반영하는 습관이 생겼습니다. 카카오처럼 수천만 명이 동시에 쓰는 서비스에서는 1%의 지연도 수십만 명의 경험이 됩니다. 추측이 아니라 측정으로 구조를 바로잡는 백엔드로 기여하고 싶습니다.',
        },
      ],
      citations: { citedLogIds: ['demo-log-intern'] },
      createdAt: d(-1) + 'T04:12:40Z',
    },
  ],
}

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

/**
 * 보드 "지원 추가" 회사명 자동완성 후보.
 *
 * 🔴 미등록이면 `CompanyAutocomplete` 가 `null.filter` 로 **화면 전체를 죽인다**
 * (2026-08-05 데모 실사고 — 둘러보기의 첫 CTA 가 크래시했다).
 * 빈 배열로 막을 수도 있지만, 데모에서 "검색 결과 없음"만 뜨면 기능이 없어 보인다.
 * 데모 카드에 쓰는 회사들과 같은 목록이라 화면 간 인상이 어긋나지 않는다.
 */
export const DEMO_AUTOCOMPLETE_COMPANIES: AutocompleteCompany[] = [
  { name: '카카오', source: 'dart', market: 'KOSPI', industry: 'IT·플랫폼' },
  { name: '네이버', source: 'dart', market: 'KOSPI', industry: 'IT·플랫폼' },
  { name: '삼성전자', source: 'dart', market: 'KOSPI', industry: '전기·전자' },
  { name: '토스', source: 'user_added', userCount: 12 },
  { name: '쿠팡', source: 'dart', market: 'OTC', industry: '유통·이커머스' },
  { name: '당근마켓', source: 'user_added', userCount: 8 },
  { name: '현대자동차', source: 'dart', market: 'KOSPI', industry: '자동차' },
  { name: 'KB국민은행', source: 'dart', market: 'KOSPI', industry: '금융' },
  { name: '한국전력공사', source: 'dart', market: 'KOSPI', industry: '공기업' },
  { name: '아모레퍼시픽', source: 'dart', market: 'KOSPI', industry: '화장품' },
]


// ── 면접 준비 (직군 대표 5개사) ────────────────────────────
/**
 * 🔴 **실제 생성물을 표본으로 삼아 썼다.** 데모가 실제보다 좋으면 가입 후 실망하고,
 * 나쁘면 저평가된다. 운영 세션(`코어플로우 · 데이터 엔지니어 · technical`, 24문항)을
 * 실측해 맞춘 것:
 *
 *  - **문체** — 60~100자로 길고, **두 가지를 한 문장에** 묶는다
 *    (`"A를 어떻게 설계하고, B의 실패는 어떻게 처리하시겠습니까?"`)
 *  - `coverletter_based` 는 `"~라고 했는데"` 로 **자소서를 인용하고 그 판단 근거를 파고든다**
 *  - **`mustPrepare` 는 앞쪽에 몰린다** — 실제 면접은 4분 남짓이라 5~7개만 고른다
 *  - **답변은 앞쪽부터** 채워진다 — 사람이 위에서부터 준비하기 때문
 *
 * 🔴 **답변 길이·끝맺음은 2026-08-08 에 고친 기준을 따른다.** 표본으로 쓴 운영 세션은
 * 그 이전 것이라 자기소개가 **470자에 "감사합니다"** 로 끝난다. 지금 가입하면 받게 될 결과는
 * **300~350자 · 다짐으로 끝**이므로 그쪽에 맞췄다.
 *
 * 🔴 **5개사인 이유 — 직군 fork 를 전부 덮는다** (2026-08-09 CEO 결정).
 * 데모를 보는 사람마다 직무가 달라 백엔드 하나로는 자기 경우를 볼 수 없다. 다만 10개사를
 * 다 쓰면 **개발 3사(카카오·삼성·쿠팡)처럼 fork 가 같아 질문이 겹친다** — 회사명만 다른
 * 210문항보다 **성격이 다른 105문항**이 제품을 더 잘 보여준다. 나머지 5개사는 빈 상태 +
 * 만들기 CTA 로 두고, 누르면 가입 모달이 뜬다.
 *
 *   카카오 백엔드     → cs_tech            (개발 · 자료구조/DB/OS/네트워크 4~5개)
 *   네이버 서비스기획   → business_reasoning  (기획 · 시장추정/KPI 3~4개)
 *   아모레 브랜드마케팅  → data_metrics·trend_ai (마케팅)
 *   토스 프로덕트디자이너 → portfolio_decision  (디자인)
 *   KB국민은행 금융영업 → domain_knowledge    (금융)
 */
function isess(
  id: string,
  applicationId: string,
  interviewType: InterviewType,
  round = '1차',
): InterviewPrepSession {
  return {
    id, applicationId, round, interviewType,
    coverletterIds: DEMO_COVERLETTERS[applicationId].map((c) => c.id),
    extraLogIds: [], myMemo: null, jobDescription: null, emphasisPoints: null,
    userResearchNotes: null, generationStatus: 'completed',
    createdAt: d(-4) + 'T09:00:00Z', updatedAt: d(-1) + 'T14:20:00Z',
  }
}

/** 세션 목록 — 카드 상세 「면접 준비」 탭이 applicationId 로 조회한다 */
export const DEMO_INTERVIEW_SESSIONS: Record<string, InterviewPrepSession[]> = {
  'demo-a1': [isess('demo-is1', 'demo-a1', 'technical')],
  'demo-a4': [isess('demo-is4', 'demo-a4', 'job_fit')],
  'demo-a10': [isess('demo-is10', 'demo-a10', 'job_fit')],
  'demo-a2': [isess('demo-is2', 'demo-a2', 'job_fit')],
  'demo-a8': [isess('demo-is8', 'demo-a8', 'personality')],
}

function iq(
  sid: string,
  i: number,
  category: string,
  questionText: string,
  opts: {
    must?: boolean
    answer?: string
    memo?: string
    gap?: string
    /** 질문 은행 — 사용자가 직접 적은 질문 (「내 질문」 배지). 기본은 AI 생성 */
    source?: 'ai' | 'user'
    /** 「면접 보기」 지난 연습 결과. 설정 화면의 「다시 볼 것만」이 이 값으로 거른다 */
    practice?: NonNullable<InterviewPrepQuestion['lastPracticeResult']>
    children?: InterviewPrepQuestion[]
  } = {},
): InterviewPrepQuestion {
  return {
    id: `${sid}-q${i}`, sessionId: sid, parentQuestionId: null, depth: 0,
    orderIndex: i, category, mustPrepare: opts.must ?? false, followupBasis: null,
    questionText, suggestedAnswer: opts.answer ?? null, materialGap: opts.gap ?? null,
    sourceLogIds: [], myMemo: opts.memo ?? null,
    source: opts.source ?? 'ai',
    lastPracticedAt: opts.practice ? d(-1) + 'T22:10:00Z' : null,
    lastPracticeResult: opts.practice ?? null,
    createdAt: d(-4) + 'T09:00:00Z', updatedAt: d(-4) + 'T09:00:00Z',
    children: opts.children ?? [],
  }
}

/** 꼬리질문 — 부모의 **AI 답변**을 파고든다 (실제로도 `ai_answer` 가 대부분) */
function ifu(
  sid: string, id: string, parentId: string,
  basis: 'my_memo' | 'ai_answer' | 'question', questionText: string,
): InterviewPrepQuestion {
  return {
    id, sessionId: sid, parentQuestionId: parentId, depth: 1, orderIndex: 0,
    category: null, mustPrepare: false, followupBasis: basis, questionText,
    suggestedAnswer: null, materialGap: null, sourceLogIds: [], myMemo: null,
    source: 'ai', lastPracticedAt: null, lastPracticeResult: null,
    createdAt: d(-3) + 'T11:00:00Z', updatedAt: d(-3) + 'T11:00:00Z', children: [],
  }
}


/** 🖥 카카오 · 백엔드 개발자 — technical (cs_tech fork) */
const IQ_KAKAO: InterviewPrepQuestion[] = [
  iq('demo-is1', 0, 'self_intro', '카카오 백엔드 개발자 직무와 관련된 경험과 강점을 중심으로 1분 자기소개를 해 주세요.', {
    must: true,
    answer:
      '안녕하십니까. 문제의 원인을 감이 아니라 측정으로 좁혀 구조를 바로잡는 백엔드 개발자입니다. 스타트업 인턴 시절 매일 새벽 4시간씩 돌던 결제 정산 배치가 영업시간을 침범하기 시작했을 때, 처음엔 서버 증설을 제안했지만 APM으로 재보니 병목은 트래픽 총량이 아니라 정산 배치와 큐 소비가 같은 커넥션 풀을 나눠 쓰는 구조에 있었습니다. 풀을 역할별로 분리하고 배치를 청크로 쪼개 처리 시간을 40분으로 줄였습니다. 캡스톤에서는 주문과 알림을 Kafka로 분리해 트래픽이 몰려도 메시지 유실 없이 처리했습니다. 카카오의 대규모 트래픽 위에서도 측정으로 병목을 좁히는 백엔드 개발자가 되겠습니다.',
    /**
     * 🔴 **AI 답변만 있고 내 답변이 비면 읽기 모드가 "아직 안 썼어요" 로 보인다** (2026-08-09).
     * 실제로 준비한 사람은 AI 문장을 그대로 외우지 않고 **자기 말로 줄여 적는다** —
     * 그 모습이 이 기능의 요점이라 데모에도 그대로 둔다.
     */
    memo: '첫 문장에 "측정" 넣고 시작 · 4시간 → 40분 수치는 꼭 말하기\n증설 먼저 제안했다가 APM 보고 방향 바꿨다는 흐름 유지 (솔직한 게 나음)\nKafka는 시간 남으면 — 1분 넘기지 말 것',
  }),
  iq('demo-is1', 1, 'cs_tech', '커넥션 풀을 역할별로 분리했다고 하셨는데, 풀 크기는 어떤 지표를 근거로 정하고 분리 이후 오히려 자원이 남거나 모자라는 상황은 어떻게 판단하시겠습니까?', {
    must: true,
    answer:
      '풀 크기는 동시 처리 요청 수와 평균 쿼리 응답 시간을 곱해 필요한 커넥션 수를 추정한 뒤, 여유분을 두고 시작하겠습니다. 이후에는 대기 큐 길이와 커넥션 획득 대기 시간을 지표로 봅니다. 대기 시간이 늘면 부족한 것이고, 활성 커넥션이 최대치에 한참 못 미치면 남는 것입니다. 다만 DB 쪽 최대 연결 수가 상한이라 무한정 늘릴 수 없으므로, 애플리케이션 여러 대의 풀 합계가 그 상한을 넘지 않는지 함께 확인하겠습니다. 인턴 때도 풀을 분리한 뒤 배치 쪽이 남고 API 쪽이 모자란 시기가 있어, 두 지표를 하루 단위로 보며 비율을 조정했습니다.',
    children: [
      ifu('demo-is1', 'demo-is1-f1', 'demo-is1-q1', 'ai_answer',
        '커넥션 획득 대기 시간을 지표로 보신다고 하셨는데, 그 값이 늘어난 원인이 풀 크기가 아니라 느린 쿼리 때문일 수도 있습니다. 두 원인을 어떻게 구분하시겠습니까?'),
    ],
  }),
  iq('demo-is1', 2, 'cs_tech', '대량 데이터를 다루는 배치를 청크 단위로 나눌 때 청크 크기는 어떤 기준으로 정하고, 중간에 실패한 청크만 재처리하려면 어떤 상태를 남겨야 합니까?', {
    must: true,
    answer:
      '청크 크기는 한 번에 메모리에 올릴 수 있는 양과 트랜잭션이 잠그는 범위를 함께 보고 정하겠습니다. 너무 크면 메모리와 락 경합이 커지고, 너무 작으면 커밋 횟수가 늘어 오히려 느려집니다. 실제 데이터로 몇 가지 크기를 재보고 처리량이 꺾이는 지점 직전을 택하겠습니다. 재처리를 위해서는 청크 단위로 처리 상태와 마지막 처리 지점을 남기고, 각 청크를 멱등하게 만들어 같은 청크를 두 번 돌려도 결과가 같도록 하겠습니다. 그러면 실패한 청크만 다시 돌릴 수 있고 전체를 처음부터 되돌릴 필요가 없습니다.',
  }),
  iq('demo-is1', 3, 'cs_tech', 'Kafka로 주문과 알림을 분리했다고 하셨는데, 컨슈머가 같은 메시지를 두 번 처리하는 상황을 어떻게 막고 처리 도중 장애가 나면 메시지를 어떻게 복구하시겠습니까?', {
    must: true,
    answer:
      '중복 처리는 메시지마다 고유 키를 두고 이미 처리한 키인지 확인하는 방식으로 막겠습니다. 캡스톤에서 컨슈머 재처리 설계를 놓쳐 중복 알림이 나간 적이 있어, 멱등 키를 도입해 같은 메시지가 두 번 반영되지 않도록 바로잡은 경험이 있습니다. 장애 복구는 처리 완료 시점에만 오프셋을 커밋해 미처리 메시지가 유실되지 않게 하고, 반복 실패하는 메시지는 별도 토픽으로 격리해 나머지 처리가 멈추지 않도록 하겠습니다. 격리된 메시지는 원인을 확인한 뒤 재투입하는 절차를 두겠습니다.',
    children: [
      ifu('demo-is1', 'demo-is1-f2', 'demo-is1-q3', 'ai_answer',
        '멱등 키로 중복을 막는다고 하셨는데, 그 키를 어디에 얼마나 오래 보관하시겠습니까? 보관 기간이 짧으면 지연 재전송을 놓치고 길면 저장 비용이 늘어나는데 어떻게 정하시겠습니까?'),
    ],
  }),
  iq('demo-is1', 4, 'cs_tech', '인덱스를 추가했다가 쓰기 성능이 떨어져 되돌린 경험이 있다고 하셨습니다. 인덱스 추가 전에 무엇을 확인해야 했다고 보시며, 읽기와 쓰기 중 무엇을 우선할지는 어떻게 판단하시겠습니까?', {
    must: true,
    answer:
      '추가 전에 실행 계획을 먼저 보고 그 인덱스가 실제로 쓰이는지, 기존 인덱스로 대체할 수 없는지 확인했어야 했습니다. 당시에는 조회가 느리다는 이유만으로 추가했고 쓰기 경로에 미칠 영향을 재지 않았습니다. 인덱스는 쓰기마다 갱신 비용이 붙으므로, 해당 테이블의 읽기와 쓰기 비율을 먼저 확인하겠습니다. 쓰기가 많은 테이블이면 인덱스를 늘리기보다 쿼리나 조회 시점을 바꾸는 쪽을 먼저 보고, 꼭 필요하면 추가 후 쓰기 지연을 함께 측정해 되돌릴 기준을 미리 정해 두겠습니다.',
  }),
  /*
    🔴 **지난 연습에서 「다시」로 찍힌 2개** (질문 은행 D3). 없으면 설정 화면의
    「다시 볼 것만」이 데모에서 항상 0개라, 그 범위가 무엇인지 보여줄 방법이 없다.
    답변이 아직 없는 것(5번)과 메모만 있는 것(14번)을 섞는다 — 실제로 「다시」가 찍히는
    자리가 그 둘이다.
  */
  iq('demo-is1', 5, 'cs_tech', '트래픽이 몰릴 때 특정 API의 응답이 느려진다면 애플리케이션 로그, DB 실행 계획, 인프라 자원 중 무엇을 어떤 순서로 확인하시겠습니까?', { must: true, practice: 'again' }),
  iq('demo-is1', 6, 'cs_tech', '캐시를 도입해 조회 성능을 높인다고 할 때 만료 정책은 어떤 기준으로 정하고, 원본 데이터가 바뀌었는데 캐시가 남아 있는 상황은 어떻게 막으시겠습니까?', { must: true }),
  iq('demo-is1', 7, 'cs_tech', '데이터베이스 트랜잭션 격리 수준을 설명하고, 결제나 정산처럼 정확성이 중요한 작업에서 어떤 수준을 선택하시겠습니까? 그 선택의 대가도 함께 말씀해 주세요.'),
  iq('demo-is1', 8, 'cs_tech', 'REST API를 설계할 때 멱등성이 필요한 메서드와 그렇지 않은 메서드를 구분해 설명하고, 클라이언트가 같은 요청을 재시도해도 안전하려면 서버가 무엇을 보장해야 합니까?'),
  iq('demo-is1', 9, 'cs_tech', '대용량 테이블에 페이지네이션을 적용할 때 OFFSET 방식의 한계를 설명하고, 어떤 대안을 어떤 상황에서 쓰시겠습니까?'),
  iq('demo-is1', 10, 'cs_tech', '동기 호출과 비동기 메시지 방식 중 하나를 선택해야 한다면 어떤 기준으로 나누시겠습니까? 비동기로 바꿨을 때 새로 생기는 문제도 함께 설명해 주세요.'),
  iq('demo-is1', 11, 'cs_tech', '서비스가 여러 대로 늘어났을 때 스케줄러가 중복 실행되지 않도록 하려면 어떤 방법을 쓰시겠습니까? 그 방법이 실패하는 경우도 함께 말씀해 주세요.'),
  iq('demo-is1', 12, 'cs_tech', '장애가 발생했을 때 원인을 빠르게 좁히려면 로그, 메트릭, 트레이싱을 각각 어떤 목적으로 남겨야 한다고 생각하십니까?'),
  iq('demo-is1', 13, 'cs_tech', '프로세스와 스레드의 차이를 설명하고, 백엔드 서버에서 스레드 풀 크기를 정할 때 무엇을 고려해야 하는지 말씀해 주세요.'),
  iq('demo-is1', 14, 'coverletter_based', '정산 배치의 병목이 트래픽 총량이 아니라 커넥션 풀 구조에 있었다고 했는데, 처음에 서버 증설을 제안했다가 방향을 바꾼 판단은 어떤 근거로 이뤄졌습니까?', {
    must: true,
    practice: 'again',
    memo: 'APM 프로파일링 결과 — 전체 시간의 70%가 건별 단건 조회. 증설해도 그 비율은 그대로라 효과가 없다고 판단.\n(면접에서 "왜 증설이 답이 아니라고 봤나"를 먼저 말하기)',
  }),
  iq('demo-is1', 15, 'coverletter_based', '개선 전후를 그래프로 남겨 팀에 "측정 없이 개선 없다"는 공감대를 만들었다고 했습니다. 팀이 기존 통념을 유지하려 했다면 어떤 근거로 설득하시겠습니까?', { must: true }),
  iq('demo-is1', 16, 'coverletter_based', '조회를 배치 단위로 묶고 복합 인덱스를 추가해 4시간을 40분으로 줄였다고 했는데, 두 조치 중 어느 쪽이 얼마나 기여했는지는 어떻게 구분해 확인하셨습니까?'),
  iq('demo-is1', 17, 'coverletter_based', '부하 테스트로 주문 API 응답을 300ms에서 90ms로 줄였다고 했습니다. 부하 조건은 어떻게 정했고, 그 조건이 실제 운영 트래픽과 다를 가능성은 어떻게 보완하시겠습니까?'),
  iq('demo-is1', 18, 'coverletter_based', '배포 전에 부하 시나리오와 실패 케이스를 먼저 그리겠다고 했는데, 일정이 촉박한 상황에서 그 원칙을 어떻게 지키시겠습니까?', {
    gap: '자소서에 일정 압박 상황에서 우선순위를 조정한 경험이 없어, 앞으로의 계획으로 답하는 편이 자연스럽습니다.',
  }),
  iq('demo-is1', 19, 'reverse_question', '마지막으로, 백엔드 개발 업무나 팀 운영 방식과 관련해 면접관에게 궁금한 점을 질문해 주세요.'),
  iq('demo-is1', 20, 'closing_remark', '마지막으로 본인의 기술 역량이나 경험 중 추가로 강조하고 싶은 내용을 말씀해 주세요.'),
  /*
    🔴 **직접 모은 기출 2개** (질문 은행 D2). 데모에 AI 질문만 있으면 「내 질문」 배지가
    한 번도 안 보이고, 그러면 이 기능이 존재한다는 걸 알 방법이 없다.
    실제 1차 면접에서 흔히 나오는 문장을 쓴다 — AI 가 만든 긴 질문과 **문장 길이부터 다르다**.
  */
  iq('demo-is1', 21, 'self_intro', '1분 자기소개 해주세요.', { source: 'user' }),
  iq('demo-is1', 22, 'company_industry', '우리 회사 서비스에서 개선하고 싶은 점 하나를 꼽는다면?', {
    source: 'user',
    memo: '알림 설정이 전부/끄기 둘뿐인 점 — 중요한 것만 받고 싶다고 말하기',
  }),
]

/** 📋 네이버 · 서비스 기획 — job_fit (business_reasoning fork) */
const IQ_NAVER: InterviewPrepQuestion[] = [
  iq('demo-is4', 0, 'self_intro', '네이버 서비스 기획 직무에 지원한 지원자로서 본인을 소개해 주세요.', {
    must: true,
    answer:
      '안녕하십니까. 아이디어가 아니라 검증 가능한 가설로 기획하는 지원자입니다. 지도 즐겨찾기를 200곳 넘게 쓰면서 저장은 쉬운데 다시 찾을 때 막히는 문제를 반복해 겪었고, 처음엔 폴더 UI가 불편한 탓이라 여겼습니다. 그런데 주변 다섯 명을 인터뷰하니 네 명이 폴더는 만들었지만 쓰지 않는다고 답했고, 진짜 원인은 저장하는 순간에 분류를 요구하는 순서에 있었습니다. 학과 프로젝트에서도 설문 앱 완료율이 낮아 보상을 늘리자는 의견이 있었지만, 로그를 보니 이탈은 초반 인적사항 문항에 몰려 있었습니다. 질문 순서만 바꿔 완료율을 20% 올렸습니다. 네이버에서도 감이 아니라 근거로 순서를 바꾸는 기획자가 되겠습니다.',
  }),
  iq('demo-is4', 1, 'business_reasoning', '즐겨찾기 개선안의 성과를 저장 후 7일 재방문율로 보겠다고 했는데, 그 지표를 고른 이유와 이 지표만으로는 놓치는 부분을 어떻게 보완하시겠습니까?', {
    must: true,
    answer:
      '저장은 쉬운데 다시 찾지 못하는 것이 문제였으므로, 저장 이후 실제로 되돌아오는지를 봐야 개선 여부를 알 수 있다고 판단했습니다. 저장 건수만 보면 늘어도 문제는 그대로일 수 있습니다. 다만 이 지표는 자주 가는 곳만 저장하는 사용자에게 유리해, 저장 개수가 많은 헤비 유저와 적은 라이트 유저를 나눠 보겠습니다. 또 재방문했지만 원하는 곳을 못 찾고 검색으로 다시 간 경우는 성공으로 잡히므로, 저장 목록에서 바로 이동한 비율을 보조 지표로 함께 보겠습니다.',
    children: [
      ifu('demo-is4', 'demo-is4-f1', 'demo-is4-q1', 'ai_answer',
        '헤비 유저와 라이트 유저를 나눠 보겠다고 하셨는데, 두 집단의 기준은 어떻게 정하시겠습니까? 그리고 두 집단에서 결과가 반대로 나오면 어떤 쪽을 우선해 판단하시겠습니까?'),
    ],
  }),
  iq('demo-is4', 2, 'business_reasoning', '국내에서 지도 앱의 즐겨찾기 기능을 실제로 쓰는 사용자 규모를 추정한다면 어떤 방식으로 계산하시겠습니까? 계산에 쓴 가정과 그 가정이 틀릴 위험도 함께 말씀해 주세요.', { must: true }),
  iq('demo-is4', 3, 'business_reasoning', '새 기능을 출시할 때 성공과 실패를 판정할 지표를 하나만 고른다면 무엇을 기준으로 고르시겠습니까? 여러 지표가 서로 반대 방향으로 움직이면 어떻게 결정하시겠습니까?', { must: true }),
  iq('demo-is4', 4, 'business_reasoning', '개선안을 실험으로 검증한다고 할 때 실험 기간과 대상 비율은 어떤 근거로 정하고, 결과가 애매할 때는 어떤 기준으로 도입 여부를 판단하시겠습니까?', {
    must: true,
    answer:
      '기간은 사용자의 자연스러운 사용 주기를 한 번 이상 포함하도록 정하겠습니다. 즐겨찾기처럼 주 단위로 쓰는 기능이면 최소 2주를 봐야 요일 효과에 휘둘리지 않습니다. 대상 비율은 기대하는 변화 폭이 작을수록 크게 잡아야 하므로, 목표로 삼은 개선 폭을 먼저 정하고 그에 필요한 표본을 역산하겠습니다. 결과가 애매하면 지표가 오르지 않았다는 사실 자체를 결론으로 받아들이고, 되돌리기 비용이 작으면 일부 사용자에게 유지하며 더 보겠습니다. 다만 판정 기준은 실험 시작 전에 정해 두고, 결과를 보고 기준을 바꾸지는 않겠습니다.',
  }),
  iq('demo-is4', 5, 'business_reasoning', '기획안을 개발·디자인과 함께 진행할 때 일정이 부족해 범위를 줄여야 한다면 무엇부터 덜어내시겠습니까? 그 판단을 팀에 어떻게 설명하시겠습니까?', { must: true }),
  iq('demo-is4', 6, 'motivation', '여러 IT 기업 중 네이버 서비스 기획에 지원한 이유를 말씀해 주세요.', { must: true }),
  iq('demo-is4', 7, 'company_industry', '네이버의 여러 서비스 중 하나를 골라 지금의 강점과 앞으로의 과제를 설명해 주세요.'),
  iq('demo-is4', 8, 'business_reasoning', '사용자 인터뷰 결과와 로그 데이터가 서로 다른 방향을 가리킨다면 어느 쪽을 먼저 믿고, 그 차이는 어떻게 해석하시겠습니까?'),
  iq('demo-is4', 9, 'business_reasoning', '경쟁 서비스가 우리에게 없는 기능을 먼저 출시했을 때 따라갈지 말지를 어떤 기준으로 판단하시겠습니까?'),
  iq('demo-is4', 10, 'personality', '본인의 강점 한 가지를 말씀해 주시고, 서비스 기획 업무에서 그 강점을 어떻게 발휘할 수 있는지 설명해 주세요.'),
  iq('demo-is4', 11, 'personality', '본인의 약점 한 가지를 말씀해 주시고, 이를 보완하기 위해 어떤 노력을 하고 있는지 설명해 주세요.'),
  iq('demo-is4', 12, 'collaboration', '다른 직군과 협업하며 의견이 갈렸던 경험을 말씀해 주시고, 어떻게 조율했는지 설명해 주세요.'),
  iq('demo-is4', 13, 'failure', '기획한 대로 결과가 나오지 않았던 경험을 말씀해 주시고, 그 경험에서 무엇을 배웠는지 설명해 주세요.'),
  iq('demo-is4', 14, 'coverletter_based', '폴더 UI가 문제라고 여겼다가 인터뷰 후 저장 시점의 분류 요구가 원인이라고 판단을 바꿨다고 했습니다. 다섯 명의 인터뷰만으로 방향을 바꿔도 된다고 본 근거는 무엇입니까?', {
    must: true,
    memo: '다섯 명 중 네 명이 같은 답 — "폴더는 만들었는데 안 쓴다".\n표본은 작지만 원인 가설을 바꿀 신호로는 충분하다고 봤고, 실제 도입은 실험으로 검증할 계획이었다.',
  }),
  iq('demo-is4', 15, 'coverletter_based', '설문 앱에서 보상을 늘리자는 의견 대신 로그를 먼저 봤다고 했는데, 팀의 통념과 다른 방향을 제안할 때 어떻게 설득하셨습니까?', { must: true }),
  iq('demo-is4', 16, 'coverletter_based', '질문 순서를 바꿔 완료율을 20% 올렸다고 했습니다. 그 변화가 순서 때문이라고 확신할 수 있었던 근거는 무엇이며, 다른 요인은 어떻게 배제하셨습니까?'),
  iq('demo-is4', 17, 'coverletter_based', '즐겨찾기 개선안을 실제 네이버 지도에 적용한다면 지금 자소서에 쓴 안에서 무엇을 더 확인해야 한다고 보십니까?'),
  iq('demo-is4', 18, 'aspiration', '입사 후 어떤 기획자로 성장하고 싶은지 말씀해 주세요.'),
  iq('demo-is4', 19, 'reverse_question', '마지막으로, 서비스 기획 업무나 팀 운영 방식과 관련해 면접관에게 궁금한 점을 질문해 주세요.'),
  iq('demo-is4', 20, 'closing_remark', '마지막으로 본인을 꼭 선발해야 하는 이유나 하고 싶은 말이 있다면 말씀해 주세요.'),
]


/** 💄 아모레퍼시픽 · 브랜드 마케팅 — job_fit (data_metrics·trend_ai fork) */
const IQ_AMORE: InterviewPrepQuestion[] = [
  iq('demo-is10', 0, 'self_intro', '아모레퍼시픽 브랜드 마케팅 직무에 지원한 지원자로서 본인을 소개해 주세요.', {
    must: true,
    answer:
      '안녕하십니까. 감각으로 만든 콘텐츠를 숫자로 다듬어 성과로 잇는 지원자입니다. 교내 뷰티 동아리에서 신제품 체험단 캠페인을 기획했을 때 처음엔 정보를 촘촘히 담은 광고형 콘텐츠를 만들었지만 반응이 미지근했습니다. 저장도 공유도 되지 않는 이유를 데이터로 보니 사람들은 제품 설명이 아니라 친구의 후기 같은 이야기에 반응하고 있었고, 톤을 바꾸자 참여율이 두 배가 됐습니다. 동아리 SNS를 6개월 맡으면서는 게시물별 도달·저장·클릭을 추적해 공감형 콘텐츠의 저장률이 높다는 패턴을 찾았고, 비중을 재편해 팔로워를 3개월 만에 두 배로 늘렸습니다. 아모레퍼시픽에서도 감각과 숫자 사이에서 균형을 잡는 마케터가 되겠습니다.',
  }),
  iq('demo-is10', 1, 'data_metrics', '콘텐츠 성과를 볼 때 도달·저장·클릭 중 무엇을 우선 지표로 삼으시겠습니까? 캠페인 목적에 따라 그 우선순위가 어떻게 달라지는지도 설명해 주세요.', {
    must: true,
    answer:
      '목적에 따라 다르게 보겠습니다. 인지도가 목적이면 도달을, 구매로 이어지는 관심이 목적이면 저장과 클릭을 우선하겠습니다. 동아리 채널을 운영할 때는 팔로워 증가가 목표였는데, 도달이 높아도 팔로워가 늘지 않는 게시물이 많았습니다. 반면 저장률이 높은 게시물은 시간이 지나도 유입이 이어졌습니다. 저장은 나중에 다시 보겠다는 의사라 관심의 깊이를 보여준다고 판단했고, 그 기준으로 콘텐츠 비중을 재편했습니다. 다만 저장은 절대 수가 작아 변동이 크므로, 게시물 단위가 아니라 유형 단위로 묶어서 비교하겠습니다.',
    children: [
      ifu('demo-is10', 'demo-is10-f1', 'demo-is10-q1', 'ai_answer',
        '저장률이 높은 게시물이 시간이 지나도 유입이 이어졌다고 하셨는데, 그 유입이 저장 때문인지 알고리즘 노출 때문인지는 어떻게 구분하셨습니까?'),
    ],
  }),
  iq('demo-is10', 2, 'data_metrics', '캠페인 예산이 절반으로 줄었다면 어떤 채널이나 콘텐츠부터 덜어내시겠습니까? 그 판단의 근거가 될 지표를 함께 말씀해 주세요.', { must: true }),
  iq('demo-is10', 3, 'data_metrics', '브랜드 인지도처럼 바로 숫자로 잡히지 않는 목표는 어떻게 측정하시겠습니까? 대체 지표를 쓸 때 생기는 함정도 함께 설명해 주세요.', { must: true }),
  iq('demo-is10', 4, 'trend_ai', '최근 뷰티 시장에서 눈여겨본 마케팅 흐름을 하나 소개하고, 그것이 아모레퍼시픽 브랜드에 어떤 기회나 위험이 되는지 말씀해 주세요.', { must: true }),
  iq('demo-is10', 5, 'trend_ai', 'AI 도구를 콘텐츠 제작이나 성과 분석에 쓴다면 어디에 쓰고 어디에는 쓰지 않으시겠습니까? 그 경계를 나눈 기준을 설명해 주세요.'),
  iq('demo-is10', 6, 'motivation', '여러 화장품 기업 중 아모레퍼시픽에 지원한 이유를 말씀해 주세요.', { must: true }),
  iq('demo-is10', 7, 'company_industry', '아모레퍼시픽의 브랜드 중 하나를 골라 지금의 포지션과 앞으로의 과제를 설명해 주세요.'),
  iq('demo-is10', 8, 'data_metrics', '인플루언서 협업의 성과를 판단한다면 어떤 지표를 보고, 팔로워 수만으로 판단하면 안 되는 이유는 무엇입니까?'),
  iq('demo-is10', 9, 'business_reasoning', '신제품의 타깃 고객을 정할 때 어떤 순서로 좁혀 가시겠습니까? 좁힌 결과가 틀렸다는 신호는 어떻게 알아채시겠습니까?'),
  iq('demo-is10', 10, 'personality', '본인의 강점 한 가지를 말씀해 주시고, 브랜드 마케팅 업무에서 그 강점을 어떻게 발휘할 수 있는지 설명해 주세요.'),
  iq('demo-is10', 11, 'personality', '본인의 약점 한 가지를 말씀해 주시고, 이를 보완하기 위해 어떤 노력을 하고 있는지 설명해 주세요.'),
  iq('demo-is10', 12, 'collaboration', '다른 사람들과 협업해 목표를 달성한 경험을 말씀해 주시고, 본인이 맡은 역할과 기여를 구체적으로 설명해 주세요.'),
  iq('demo-is10', 13, 'failure', '기획한 콘텐츠나 캠페인이 기대만큼 반응을 얻지 못했던 경험과 그때 무엇을 배웠는지 말씀해 주세요.'),
  iq('demo-is10', 14, 'coverletter_based', '광고형 콘텐츠의 반응이 미지근하자 톤을 후기형으로 바꿔 참여율을 두 배로 올렸다고 했습니다. 톤 말고 다른 요인이 작용했을 가능성은 어떻게 배제하셨습니까?', {
    must: true,
    memo: '같은 제품·같은 채널·같은 시간대에 두 유형을 번갈아 올려 비교.\n다만 표본이 작아 "확신"보다 "방향"으로 말하기.',
  }),
  iq('demo-is10', 15, 'coverletter_based', '게시물별 도달·저장·클릭을 추적해 공감형 콘텐츠의 저장률이 높다는 패턴을 찾았다고 했는데, 그 패턴이 우연이 아니라고 판단한 기준은 무엇입니까?', { must: true }),
  iq('demo-is10', 16, 'coverletter_based', '콘텐츠 비중을 재편해 팔로워를 3개월 만에 두 배로 늘렸다고 했습니다. 늘어난 팔로워가 실제 구매로 이어졌는지는 어떻게 확인하시겠습니까?'),
  iq('demo-is10', 17, 'coverletter_based', '편의점 아르바이트에서 매대 위치가 매출을 바꾸는 걸 보며 관찰 습관이 생겼다고 했는데, 그 관찰을 브랜드 마케팅에서는 어떻게 활용하시겠습니까?'),
  iq('demo-is10', 18, 'aspiration', '입사 후 어떤 마케터로 성장하고 싶은지 말씀해 주세요.'),
  iq('demo-is10', 19, 'reverse_question', '마지막으로, 브랜드 마케팅 업무와 관련해 면접관에게 궁금한 점을 질문해 주세요.'),
  iq('demo-is10', 20, 'closing_remark', '마지막으로 본인을 꼭 선발해야 하는 이유나 하고 싶은 말이 있다면 말씀해 주세요.'),
]

/** 🎨 토스 · 프로덕트 디자이너 — job_fit (portfolio_decision fork) */
const IQ_TOSS: InterviewPrepQuestion[] = [
  iq('demo-is2', 0, 'self_intro', '토스 프로덕트 디자이너 직무에 지원한 지원자로서 본인을 소개해 주세요.', {
    must: true,
    answer:
      '안녕하십니까. 화면을 예쁘게 만드는 일보다 사용자가 어디서 멈추는지 찾아 흐름을 다시 짜는 데 강한 지원자입니다. 동아리 가계부 앱에서 대부분이 분류 기능을 쓰지 않는 걸 발견했을 때, 처음엔 설명이 부족한 줄 알고 안내를 늘렸지만 수치는 그대로였습니다. 다섯 명을 인터뷰해 보니 문제는 설명이 아니라 순서였고, 분류를 저장 시점이 아니라 지출을 볼 때로 옮기자 사용률이 올랐습니다. 졸업 프로젝트에서는 세션 리플레이로 3단계 인증 화면에서 절반이 이탈하는 걸 확인해 2단계로 줄이고 진행 표시를 넣었습니다. 토스에서도 막히는 순간을 찾아 흐름으로 푸는 디자이너가 되겠습니다.',
  }),
  iq('demo-is2', 1, 'portfolio_decision', '가계부 앱에서 분류 단계를 저장 시점에서 조회 시점으로 옮겼다고 하셨는데, 그 결정으로 잃는 것은 무엇이었고 어떻게 감수하기로 판단하셨습니까?', {
    must: true,
    answer:
      '저장 시점에 분류하면 데이터가 처음부터 정돈된다는 장점이 있는데, 그걸 포기하는 결정이었습니다. 조회 시점으로 미루면 분류되지 않은 지출이 쌓이고, 나중에 한꺼번에 정리해야 하는 부담이 생깁니다. 다만 인터뷰에서 확인한 건 사람들이 그 부담 때문에 아예 분류를 안 한다는 것이었고, 정돈된 데이터를 얻기 전에 기능 자체가 쓰이지 않는 상태였습니다. 그래서 완전한 분류보다 일단 쓰이는 쪽을 택했습니다. 대신 최근 지출을 자동으로 묶어 제안하는 방식으로 사용자의 부담을 줄여, 미룬 비용을 상쇄하려 했습니다.',
    children: [
      ifu('demo-is2', 'demo-is2-f1', 'demo-is2-q1', 'ai_answer',
        '자동으로 묶어 제안하는 방식을 넣으셨다고 했는데, 그 제안이 틀렸을 때 사용자가 느끼는 불편은 어떻게 줄이셨습니까? 제안 정확도는 어떤 기준으로 판단하셨습니까?'),
    ],
  }),
  iq('demo-is2', 2, 'portfolio_decision', '3단계 인증을 2단계로 줄였다고 하셨습니다. 금융 서비스에서 단계를 줄일 때 보안이나 규제 요구와 충돌한다면 어떻게 조율하시겠습니까?', { must: true }),
  iq('demo-is2', 3, 'portfolio_decision', '진행 표시를 처음엔 너무 크게 넣어 화면을 어지럽혔다고 했는데, 정보를 전달하면서도 절제하는 기준을 어떻게 잡으시겠습니까?', { must: true }),
  iq('demo-is2', 4, 'portfolio_decision', '버튼·입력 컴포넌트를 정리해 팀의 제작 속도를 높였다고 했습니다. 디자인 시스템을 만들 때 어디까지 규칙으로 묶고 어디부터는 자유롭게 두시겠습니까?', {
    must: true,
    answer:
      '반복해서 같은 결정을 내리는 부분은 규칙으로 묶고, 맥락마다 달라져야 하는 부분은 열어 두겠습니다. 버튼의 크기·간격·상태 표현처럼 매번 같은 답이 나오는 것은 컴포넌트로 고정해 고민을 없앴습니다. 반대로 화면의 정보 구조나 강조 순서는 서비스마다 달라져야 해서 규칙으로 묶으면 오히려 어색해집니다. 실제로 컴포넌트를 정리한 뒤 화면 제작 속도가 붙었지만, 새로운 형태가 필요할 때 규칙이 발목을 잡는 일도 있었습니다. 그래서 예외를 금지하기보다 예외가 반복되면 규칙 쪽을 고치는 절차를 두는 편이 낫다고 봅니다.',
  }),
  iq('demo-is2', 5, 'portfolio_decision', '사용성 테스트 참여자가 다섯 명이었다고 했는데, 그 규모로 얻은 결론을 어디까지 믿고 어디부터는 추가 검증이 필요하다고 보십니까?', { must: true }),
  iq('demo-is2', 6, 'motivation', '여러 회사 중 토스 프로덕트 디자이너에 지원한 이유를 말씀해 주세요.', { must: true }),
  iq('demo-is2', 7, 'company_industry', '토스의 서비스 중 하나를 골라 사용자 흐름 관점에서 잘 만들어졌다고 보는 부분과 아쉬운 부분을 설명해 주세요.'),
  iq('demo-is2', 8, 'portfolio_decision', '데이터는 개선을 가리키는데 이해관계자가 반대한다면 어떤 근거로 설득하시겠습니까?'),
  iq('demo-is2', 9, 'collaboration', '개발자와 구현 범위를 두고 의견이 갈렸던 경험을 말씀해 주시고, 어떻게 합의에 이르렀는지 설명해 주세요.'),
  iq('demo-is2', 10, 'personality', '본인의 강점 한 가지를 말씀해 주시고, 프로덕트 디자인 업무에서 그 강점을 어떻게 발휘할 수 있는지 설명해 주세요.'),
  iq('demo-is2', 11, 'personality', '본인의 약점 한 가지를 말씀해 주시고, 이를 보완하기 위해 어떤 노력을 하고 있는지 설명해 주세요.'),
  iq('demo-is2', 12, 'failure', '디자인 변경이 기대만큼 효과를 내지 못했던 경험과 그때 무엇을 배웠는지 말씀해 주세요.'),
  iq('demo-is2', 13, 'portfolio_decision', '접근성을 고려한 디자인 결정을 내려 본 경험이 있다면 말씀해 주시고, 없다면 어떤 기준으로 접근하시겠습니까?'),
  iq('demo-is2', 14, 'coverletter_based', '버튼 색과 문구부터 손댔지만 수치가 그대로였다고 했습니다. 그때 감으로 고치기를 멈추고 세션 리플레이로 방향을 바꾼 판단은 무엇이 계기였습니까?', {
    must: true,
    memo: '두 번 바꿔도 이탈률이 거의 안 움직임 → "보이는 것"이 원인이 아닐 수 있다고 봄.\n리플레이에서 3단계 인증 화면 하나에 절반 가까이 몰려 있는 걸 확인.',
  }),
  iq('demo-is2', 15, 'coverletter_based', '사용성 테스트에서 다섯 명 중 네 명이 진행 표시에 안심된다고 답했다고 했는데, 그 응답이 실제 이탈률 개선으로 이어졌는지는 어떻게 확인하시겠습니까?', { must: true }),
  iq('demo-is2', 16, 'coverletter_based', '분류를 조회 시점으로 옮긴 뒤 사용률이 올랐다고 했습니다. 그 변화가 순서 변경 때문이라고 확신할 수 있었던 근거는 무엇입니까?'),
  iq('demo-is2', 17, 'coverletter_based', '자소서의 입사 후 목표 문항이 아직 비어 있습니다. 토스에서 어떤 디자이너로 성장하고 싶은지 지금 말씀해 주신다면 무엇을 쓰시겠습니까?', {
    gap: '자소서의 입사후포부 문항이 아직 작성되지 않아, 앞의 두 문항에 나온 방향(막히는 순간을 흐름으로 푸는 일)을 근거로 답하는 편이 자연스럽습니다.',
  }),
  iq('demo-is2', 18, 'aspiration', '입사 후 어떤 디자이너로 성장하고 싶은지 말씀해 주세요.'),
  iq('demo-is2', 19, 'reverse_question', '마지막으로, 프로덕트 디자인 업무나 팀의 일하는 방식과 관련해 면접관에게 궁금한 점을 질문해 주세요.'),
  iq('demo-is2', 20, 'closing_remark', '마지막으로 본인을 꼭 선발해야 하는 이유나 하고 싶은 말이 있다면 말씀해 주세요.'),
]

/** 🏦 KB국민은행 · 금융영업 — personality (domain_knowledge fork) */
const IQ_KB: InterviewPrepQuestion[] = [
  iq('demo-is8', 0, 'self_intro', 'KB국민은행 금융영업 직무에 지원한 지원자로서 본인을 소개해 주세요.', {
    must: true,
    answer:
      '안녕하십니까. 금융의 문턱이 상품이 아니라 설명해 주는 사람의 부재에 있다고 배운 지원자입니다. 창업 동아리에서 소상공인용 정산 서비스를 기획하며 상인 열두 분을 인터뷰했습니다. 매출은 있는데 현금 흐름이 꼬여 대출 창구 앞에서 발길을 돌리는 분, 어떤 상품이 있는지도 모른 채 지인에게 급전을 빌리는 분을 만났습니다. 처음엔 더 좋은 상품을 만들면 된다고 생각했지만, 인터뷰가 쌓일수록 문제는 설명해 주는 사람이 없다는 데 있었습니다. KB국민은행에서 고객의 자금 흐름을 함께 읽고 필요한 상품을 쉬운 말로 먼저 설명하는 행원이 되겠습니다.',
  }),
  iq('demo-is8', 1, 'domain_knowledge', '소상공인 고객의 현금 흐름이 꼬였다고 판단하려면 어떤 자료를 보시겠습니까? 매출이 있는데도 자금이 부족한 상황은 어떤 원인으로 생길 수 있는지 설명해 주세요.', {
    must: true,
    answer:
      '매출 자료와 함께 입출금 내역, 매입 대금 지급 시점, 카드 매출 정산 주기를 보겠습니다. 매출이 있는데 자금이 부족한 대표적 원인은 들어오는 시점과 나가는 시점이 어긋나는 것입니다. 카드 매출은 며칠 뒤에 들어오는데 재료비나 임차료는 먼저 나가면, 장부상 이익이 나도 통장은 비는 상황이 생깁니다. 인터뷰에서 만난 분들 중에도 매출은 꾸준한데 정산 주기 때문에 매달 특정 시점에 막히는 경우가 있었습니다. 그래서 손익만 보지 않고 시점별 현금 흐름을 함께 봐야 정확한 제안을 할 수 있다고 생각합니다.',
    children: [
      ifu('demo-is8', 'demo-is8-f1', 'demo-is8-q1', 'ai_answer',
        '들어오는 시점과 나가는 시점이 어긋나는 것이 원인이라고 하셨는데, 그런 고객에게는 어떤 금융 상품을 어떤 근거로 제안하시겠습니까?'),
    ],
  }),
  iq('demo-is8', 2, 'domain_knowledge', '금리가 오르는 상황이 소상공인 고객과 은행에 각각 어떤 영향을 주는지 설명하고, 영업 현장에서는 무엇을 먼저 안내해야 한다고 보십니까?', { must: true }),
  iq('demo-is8', 3, 'domain_knowledge', '예금과 대출 금리의 차이가 은행 수익에서 갖는 의미를 설명하고, 고객에게 상품을 권할 때 은행 수익과 고객 이익이 충돌한다면 어떻게 판단하시겠습니까?', { must: true }),
  iq('demo-is8', 4, 'domain_knowledge', '고객이 원하는 대출 금액이 상환 능력에 비해 과하다고 판단될 때 어떻게 설명하시겠습니까? 거절이 아니라 대안을 제시한다면 무엇을 보시겠습니까?', {
    must: true,
    answer:
      '먼저 왜 그 금액이 필요한지 용도와 상환 계획을 함께 확인하겠습니다. 금액만 보고 판단하면 고객은 거절당했다고만 느끼고 다른 곳으로 갑니다. 상환 능력은 소득이나 매출뿐 아니라 이미 있는 부채의 상환 부담까지 함께 봐야 정확합니다. 과하다고 판단되면 그 근거를 숫자로 보여드리고, 금액을 나누거나 기간을 늘려 매달 부담을 낮추는 방안, 보증기관을 활용하는 방안을 함께 검토하겠습니다. 동아리에서 만난 상인분들도 어떤 선택지가 있는지 몰라 지인에게 급전을 빌리는 경우가 많았습니다. 선택지를 아는 것만으로도 다른 결정을 하실 수 있다고 생각합니다.',
  }),
  iq('demo-is8', 5, 'domain_knowledge', '금융소비자 보호 관점에서 상품을 설명할 때 반드시 지켜야 할 것은 무엇이라고 생각하십니까? 실적 압박과 충돌한다면 어떻게 하시겠습니까?', { must: true }),
  iq('demo-is8', 6, 'motivation', '여러 금융기관 중 KB국민은행에 지원한 동기를 말씀해 주세요.', { must: true }),
  iq('demo-is8', 7, 'company_industry', '최근 은행권이 겪는 변화 중 하나를 골라 설명하고, 그것이 영업 현장에 어떤 영향을 준다고 보는지 말씀해 주세요.'),
  iq('demo-is8', 8, 'personality', '본인의 강점 한 가지를 말씀해 주시고, 금융영업 업무에서 그 강점을 어떻게 발휘할 수 있는지 설명해 주세요.'),
  iq('demo-is8', 9, 'personality', '본인의 약점 한 가지를 말씀해 주시고, 이를 보완하기 위해 어떤 노력을 하고 있는지 설명해 주세요.'),
  iq('demo-is8', 10, 'personality', '스트레스가 큰 상황에서 어떻게 대처하시는지, 실제 경험을 들어 말씀해 주세요.'),
  iq('demo-is8', 11, 'collaboration', '다른 사람들과 협업해 목표를 달성한 경험을 말씀해 주시고, 본인이 맡은 역할과 기여를 구체적으로 설명해 주세요.'),
  iq('demo-is8', 12, 'failure', '지금까지 가장 힘들었거나 실패했다고 느꼈던 경험을 말씀해 주시고, 그 경험에서 무엇을 배웠는지 설명해 주세요.'),
  iq('demo-is8', 13, 'executive', '고객의 신뢰를 얻기 위해 가장 중요한 것이 무엇이라고 생각하며, 그것을 업무에서 어떻게 실천하시겠습니까?'),
  iq('demo-is8', 14, 'coverletter_based', '상인 열두 분을 인터뷰하며 더 좋은 상품을 만들면 된다는 생각이 바뀌었다고 했습니다. 어느 시점에 그 판단이 바뀌었고 무엇이 결정적이었습니까?', {
    must: true,
    memo: '인터뷰 대여섯 분째부터 같은 말이 반복됨 — "어떤 상품이 있는지 모른다".\n상품이 없어서가 아니라 닿지 않아서라는 걸 그때 알았음.',
  }),
  iq('demo-is8', 15, 'coverletter_based', '운영진이 반반으로 갈린 회의에서 논쟁 대신 결정 방식을 바꾸자고 제안했다고 했습니다. 그 제안을 받아들이게 만든 근거는 무엇이었습니까?', { must: true }),
  iq('demo-is8', 16, 'coverletter_based', '상담 이력을 꼼꼼히 남겨 고객의 생애 단계 변화에 맞춰 다음 제안을 준비하겠다고 했는데, 실제 영업 현장에서 그 습관을 어떻게 유지하시겠습니까?'),
  iq('demo-is8', 17, 'coverletter_based', '한 번의 판매가 아니라 이어지는 관계를 만들겠다고 했습니다. 단기 실적과 장기 관계가 충돌하는 상황에서는 어떻게 판단하시겠습니까?'),
  iq('demo-is8', 18, 'aspiration', '입행 후 어떤 행원으로 성장하고 싶은지 말씀해 주세요.'),
  iq('demo-is8', 19, 'reverse_question', '마지막으로, 금융영업 업무나 영업점 운영과 관련해 면접관에게 궁금한 점을 질문해 주세요.'),
  iq('demo-is8', 20, 'closing_remark', '마지막으로 본인을 꼭 선발해야 하는 이유나 하고 싶은 말이 있다면 말씀해 주세요.'),
]

/** 세션별 질문 트리 */
export const DEMO_INTERVIEW_QUESTIONS: Record<string, InterviewPrepQuestion[]> = {
  'demo-is1': IQ_KAKAO,
  'demo-is4': IQ_NAVER,
  'demo-is10': IQ_AMORE,
  'demo-is2': IQ_TOSS,
  'demo-is8': IQ_KB,
}

/**
 * 세션이 참조하는 자료 — 사이드바 「🎯 AI 강화 자료」.
 * 각 회사의 자소서를 그대로 가리킨다(활동 로그는 미연결 — 데모 세션이 자소서만 쓴다).
 */
export const DEMO_INTERVIEW_REFS: Record<
  string,
  { coverletters: Array<{ id: string; category: string | null; question: string }>; logs: [] }
> = Object.fromEntries(
  Object.entries(DEMO_INTERVIEW_SESSIONS).map(([appId, [sess]]) => [
    sess.id,
    {
      coverletters: DEMO_COVERLETTERS[appId].map((c) => ({
        id: c.id,
        category: c.category,
        question: c.question,
      })),
      logs: [] as [],
    },
  ]),
)


// ── 코인 잔액 (헤더 코인 칩·자소서 AI UI) ────────────────────
export const DEMO_COIN_BALANCE: CoinBalance = {
  balance: 150,
  tier: 'free',
  nextResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  monthlyCoinLimit: 150,
  companyResearchDailyCap: 2,
}
