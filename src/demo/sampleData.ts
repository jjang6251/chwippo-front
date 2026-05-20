// 데모 모드용 샘플 데이터. 모든 날짜는 "오늘" 기준 상대값으로 생성 — 데모를 언제 봐도 자연스럽게.
import type { Application, ApplicationStep } from '@/types/application'
import type { ApplicationCoverletter } from '@/types/coverletter'
import type { DashboardStats, DdayItem, InterviewReviewItem } from '@/api/dashboard'
import type { CalendarEvent, DailyNote } from '@/api/calendar'
import type { ChecklistItem } from '@/api/stepDetail'
import type {
  UserProfile, LanguageCert, Cert, Award, Experience, CoverletterData,
} from '@/api/myinfo'
import type { Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'

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

// ── 회사 카드 6개 ───────────────────────────────────────────
export const DEMO_APPLICATIONS: Application[] = [
  {
    id: 'demo-a1', userId: DEMO_USER, companyName: '카카오', jobTitle: '백엔드 개발자', jobCategory: 'IT개발',
    status: 'IN_PROGRESS', jobUrl: 'https://careers.kakao.com', memo: '면접관 2명 · 기술 면접 위주 · 시스템 설계 준비',
    currentStepIndex: 2, needsDetail: false, isStarred: true, createdAt: d(-30) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
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
      '저는 사용자 수백만 명이 매일 쓰는 서비스의 백엔드를 만들고 싶었습니다. 카카오톡 메시지 인프라처럼 대규모 트래픽을 안정적으로 다루는 일에 매력을 느꼈고, 인턴 기간 동안 일 평균 30만 건의 이벤트를 처리하는 큐 시스템을 개선하며 그 가능성을 봤습니다. ...', 1000),
    cl('demo-a1', 1, '본인의 직무 역량과 핵심 경험을 작성해 주세요.', '직무역량·핵심경험',
      '인턴 기간 동안 결제 정산 배치를 개선해 처리 시간을 4시간에서 40분으로 줄였습니다. 병목을 프로파일링으로 찾아 ...', 1500),
    cl('demo-a1', 2, '입사 후 포부를 작성해 주세요.', '입사후포부', null, 800),
  ],
  'demo-a4': [
    cl('demo-a4', 0, '네이버 서비스 중 개선하고 싶은 것과 그 이유는?', '직무역량·핵심경험',
      '네이버 지도의 "즐겨찾기 폴더" 흐름을 개선하고 싶습니다. 사용자 인터뷰 5명을 해보니 ...', 1000),
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
}
export const getDemoChecklist = (stepId: string): ChecklistItem[] => DEMO_CHECKLISTS[stepId] ?? []

// ── 대시보드 ────────────────────────────────────────────────
export const DEMO_DASHBOARD_STATS: DashboardStats = { total: 5, inProgress: 3, interviewsAttended: 4, passed: 1 }

export const DEMO_DDAY: DdayItem[] = [
  { type: 'step', applicationId: 'demo-a2', stepId: 'demo-a2-s1', companyName: '토스', stepName: '서류전형', date: d(2), dday: 2 },
  { type: 'step', applicationId: 'demo-a1', stepId: 'demo-a1-s2', companyName: '카카오', stepName: '1차 기술면접', date: d(3), scheduledTime: '10:00', dday: 3, pinnedContent: '엘리베이터 5층 · 신분증 지참' },
  { type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s3', companyName: '삼성전자', stepName: '임원면접', date: d(5), scheduledTime: '14:00', dday: 5 },
  { type: 'exam', examId: 'demo-e1', companyName: 'SQLD 시험', date: d(9), dday: 9 },
]

export const DEMO_INTERVIEW_REVIEW: InterviewReviewItem[] = [
  { stepId: 'demo-a3-s2', stepName: '1차 실무면접', applicationId: 'demo-a3', companyName: '삼성전자' },
]

// ── 캘린더 ──────────────────────────────────────────────────
export const DEMO_CALENDAR_EVENTS: CalendarEvent[] = [
  { date: d(2), time: null, type: 'step', applicationId: 'demo-a2', stepId: 'demo-a2-s1', examId: null, noteId: null, companyName: '토스', stepName: '서류전형', location: null, content: null },
  { date: d(3), time: '10:00', type: 'step', applicationId: 'demo-a1', stepId: 'demo-a1-s2', examId: null, noteId: null, companyName: '카카오', stepName: '1차 기술면접', location: '판교 카카오 아지트', content: null },
  { date: d(5), time: '14:00', type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s3', examId: null, noteId: null, companyName: '삼성전자', stepName: '임원면접', location: '서울 서초 사옥', content: null },
  { date: d(9), time: '09:00', type: 'exam', applicationId: null, stepId: null, examId: 'demo-e1', noteId: null, companyName: 'SQLD 시험', stepName: null, location: '강남 시험장', content: null },
  { date: d(-7), time: '15:00', type: 'step', applicationId: 'demo-a3', stepId: 'demo-a3-s2', examId: null, noteId: null, companyName: '삼성전자', stepName: '1차 실무면접', location: '수원 디지털시티', content: null },
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
    personality: '꼼꼼하게 끝까지 파고드는 편이라 디버깅·정산처럼 정확성이 중요한 일에서 강점을 보입니다. 다만 처음엔 완벽주의 때문에 속도가 느려 — 인턴 때 "초안을 빨리 내고 같이 다듬자"는 피드백을 받고 의식적으로 고치는 중입니다.',
    background: '어릴 때부터 "왜 이렇게 동작하지?"가 궁금해 분해부터 하던 아이였습니다. 자취를 시작하며 가계부 앱이 불편해 직접 만들어 본 게 개발의 시작이었습니다.',
    job_competency: '인턴 기간 결제 정산 배치를 개선해 처리 시간을 1/6로 줄였습니다. 병목을 프로파일링으로 찾고, N+1 쿼리를 배치 조회로 바꾸고, 인덱스를 추가했습니다.',
    own_strength: '"문제를 측정 가능하게 만드는" 습관. 막연한 "느려요" 대신 어디가 몇 ms인지 먼저 보고 시작합니다.',
    collaboration: '동아리 운영 중 행사 방향을 두고 운영진끼리 갈렸을 때, 각 안의 장단점을 표로 정리해 공유하고 작은 설문으로 결정했습니다. 감정 싸움 대신 데이터로.',
    challenge: '첫 해커톤에서 욕심내 범위를 너무 키워 미완성으로 끝났습니다. 다음엔 "데모 가능한 최소"부터 만들고 시간 남으면 확장하는 식으로 바꿔 수상했습니다.',
  },
  custom: [
    { id: 'demo-clc1', label: '리더십 경험', content: '동아리 운영진으로 주간 스터디를 1년 운영하며 신입 8명을 멘토링했습니다.', order_index: 0 },
  ],
}
