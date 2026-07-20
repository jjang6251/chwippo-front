// 데모 모드용 샘플 데이터. 모든 날짜는 "오늘(KST)" 기준 상대값으로 생성 — 데모를 언제 봐도 자연스럽게.
import { addDays, todayLocal } from '@/utils/datetime'
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
