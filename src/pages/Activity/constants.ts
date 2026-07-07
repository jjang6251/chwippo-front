// mock (plans/activity-journal-mock.html) 상수 1:1.
import type { ActivityType, LogMood, QuantValue } from '@/types/activity'

export const TYPE_KO: Record<ActivityType, string> = {
  intern: '인턴',
  club: '동아리',
  study: '스터디',
  project: '팀 프로젝트',
  sideproject: '사이드 프로젝트',
  contest: '공모전·해커톤',
  research: '연구·학술',
  parttime: '알바',
  volunteer: '봉사',
  overseas: '해외 경험',
  bootcamp: '부트캠프·교육',
  other: '기타',
}

export const CAT_KO: Record<string, string> = {
  // 취준 실전 3종 (auto-tagger v2) — 편집기 칩도 이 순서로 노출
  coding_test: '코테',
  interview: '면접',
  apply: '지원',
  develop: '개발',
  meeting: '회의',
  presentation: '발표',
  collaboration: '협업',
  conflict_resolution: '갈등해결',
  learning: '학습',
  leadership: '리더십',
  volunteer: '봉사',
  customer: '고객응대',
  analysis: '분석',
  creative: '창작',
  other: '기타',
}

export const COMP_KO: Record<string, string> = {
  technical: '기술',
  leadership: '리더십',
  communication: '소통',
  planning: '기획',
  analytical: '분석',
  problem_solving: '문제해결',
  collaboration: '협업',
  creativity: '창의성',
  responsibility: '책임감',
  adaptability: '적응력',
}

export const CL_KO: Record<string, string> = {
  personality: '성격·인성',
  background: '성장과정',
  job_competency: '직무역량',
  own_strength: '나만의 강점',
  collaboration: '협업·갈등',
  challenge: '도전·실패',
}

export const CL_LABEL: Record<string, string> = {
  job_competency: '💼 직무역량',
  collaboration: '🤝 협업·갈등',
  challenge: '🚀 도전·실패',
  background: '🌱 성장·가치관',
  personality: '✨ 성격·인성',
  own_strength: '💎 나만의 강점',
}

/**
 * F6 PR 1 Phase 6 — Insights 페이지 시각화 색 매핑.
 * DESIGN.md 의 "단일 브랜드 액센트" 원칙은 *인터랙티브 요소* 한정 (DESIGN §1).
 * 데이터 시각화는 사용자 직관 보조 차원에서 예외 — 10 역량·6 카테고리 각각 다른 색.
 *
 * Tailwind 색 palette 사용 (rgb 정의된 inline 단순화 회피). 채도 낮춰서 (`/40` 정도) 화려함 X.
 */
export const COMP_COLOR: Record<string, string> = {
  technical: 'rgb(59 130 246)', // blue
  leadership: 'rgb(249 115 22)', // orange
  communication: 'rgb(16 185 129)', // emerald
  planning: 'rgb(94 106 210)', // brand indigo
  analytical: 'rgb(168 85 247)', // purple
  problem_solving: 'rgb(6 182 212)', // cyan
  collaboration: 'rgb(236 72 153)', // pink
  creativity: 'rgb(234 179 8)', // yellow
  responsibility: 'rgb(220 38 38)', // red
  adaptability: 'rgb(20 184 166)', // teal
}

export const CL_COLOR: Record<string, string> = {
  personality: 'rgb(168 85 247)', // purple
  background: 'rgb(16 185 129)', // emerald
  job_competency: 'rgb(59 130 246)', // blue
  own_strength: 'rgb(245 158 11)', // amber
  collaboration: 'rgb(236 72 153)', // pink
  challenge: 'rgb(220 38 38)', // red
}

// LogDetailModal·LogTagEditor 공용 감정 칩 (autoTag 미지원 — 수동 선택 전용)
export const MOOD_CHIPS: Array<[LogMood, string, string]> = [
  ['proud', '🌟', '뿌듯'],
  ['learning', '🌱', '배움'],
  ['frustrated', '😮‍💨', '힘듦'],
  ['neutral', '🙂', '평범'],
]

/**
 * 태그 칩 색 스타일 (타임라인·태그 편집기 공용).
 * COMP_COLOR·CL_COLOR 데이터 시각화 예외 (위 COMP_COLOR docstring) 를 칩에도 동일 적용 —
 * 인사이트 차트와 같은 태그 = 같은 색.
 */
export function tagColorStyle(rgb: string) {
  return {
    color: rgb,
    backgroundColor: rgb.replace(')', ' / 0.12)'),
    borderColor: rgb.replace(')', ' / 0.28)'),
  }
}

/** quant 칩 표시용 포맷 (타임라인·태그 편집기 공용) */
export function fmtQuant(q: QuantValue): string {
  if (q.type === 'before-after') return `${q.before}→${q.after}${q.unit ?? ''}`
  if (q.type === 'count')
    return `${q.metric ? `${q.metric} ` : ''}${q.value}${q.unit}`
  return q.raw
}

export const MOOD_EM: Record<string, string> = {
  proud: '🌟',
  learning: '🌱',
  frustrated: '😮‍💨',
  neutral: '🙂',
}

export const TYPE_TO_CL: Record<ActivityType, string[]> = {
  intern: ['job_competency'],
  club: ['collaboration', 'background'],
  study: ['job_competency', 'background'],
  project: ['job_competency', 'collaboration'],
  sideproject: ['job_competency', 'challenge'],
  contest: ['challenge', 'job_competency'],
  research: ['job_competency', 'challenge'],
  parttime: ['collaboration', 'background'],
  volunteer: ['background', 'personality'],
  overseas: ['challenge', 'background'],
  bootcamp: ['job_competency', 'background'],
  other: [],
}

/** ActivityFormModal 의 분류 그리드 — mock TYPE_GROUPS 1:1 */
export interface TypeGroupEntry {
  v: ActivityType
  em: string
  label: string
}
export interface TypeGroup {
  gl: string
  types: TypeGroupEntry[]
}

export const TYPE_GROUPS: TypeGroup[] = [
  {
    gl: '💼 직무 경험',
    types: [
      { v: 'intern', em: '🏢', label: '인턴' },
      { v: 'parttime', em: '🏪', label: '알바' },
    ],
  },
  {
    gl: '🎓 학생 활동',
    types: [
      { v: 'club', em: '🤝', label: '동아리' },
      { v: 'study', em: '📚', label: '스터디' },
      { v: 'project', em: '👥', label: '팀 프로젝트' },
      { v: 'sideproject', em: '💻', label: '사이드 프로젝트' },
    ],
  },
  {
    gl: '🏆 결과·성과',
    types: [
      { v: 'contest', em: '🏆', label: '공모전·해커톤' },
      { v: 'research', em: '🔬', label: '연구·학술' },
    ],
  },
  {
    gl: '🌱 자기 개발',
    types: [
      { v: 'overseas', em: '🌏', label: '해외 경험' },
      { v: 'bootcamp', em: '⛺', label: '부트캠프·교육' },
      { v: 'volunteer', em: '🙌', label: '봉사' },
    ],
  },
  {
    gl: '📌 기타',
    types: [{ v: 'other', em: '📌', label: '기타' }],
  },
]

export const TYPE_KEYWORDS: Partial<Record<ActivityType, string[]>> = {
  intern: ['인턴', '인턴십', 'intern'],
  parttime: ['알바', '아르바이트', '파트타임', 'parttime'],
  club: ['동아리', '학회', '학과회', '교회', '학생회'],
  study: ['스터디', 'study'],
  project: ['팀프로젝트', '팀플젝', '팀플', '졸업작품', '졸업 작품'],
  sideproject: [
    '사이드프로젝트',
    '사이드 프로젝트',
    '개인프로젝트',
    '토이프로젝트',
    '토이 프로젝트',
  ],
  contest: ['공모전', '해커톤', '경진대회', '대회'],
  research: ['연구', '논문', '학부 연구생', 'ra', '랩'],
  overseas: ['해외', '교환학생', '교환', '워홀', '어학연수'],
  bootcamp: [
    '부트캠프',
    '캠프',
    '교육과정',
    '패스트캠퍼스',
    '코드스테이츠',
  ],
  volunteer: ['봉사', '자원봉사'],
}

export const NAME_PLACEHOLDERS: Record<ActivityType, string> = {
  intern: '회사 + 부서·팀 + 직무 (예: 네이버 클로바 ML 인턴)',
  parttime: '매장·회사 + 직무 (예: 스타벅스 파트너 / 영어 과외)',
  club: '동아리명 (예: 학과 학술 동아리 / IT 연합 동아리 X)',
  study: '스터디 주제 (예: 자료구조 알고리즘 스터디)',
  project: '프로젝트명 (예: 친환경 패키지 디자인 졸업작품)',
  sideproject: '프로젝트명 (예: 취준생용 일정 관리 웹앱)',
  contest: '대회명 (예: 2025 한이음 ICT 공모전)',
  research: '연구 주제 (예: NLP 기반 감정 분류 연구)',
  volunteer: '봉사 분야·기관 (예: 다문화 청소년 학습 멘토링)',
  overseas: '학교·회사 + 국가 (예: UBC 교환학생 (캐나다))',
  bootcamp: '과정명 (예: 패스트캠퍼스 그로스해킹 부트캠프)',
  other: '활동명',
}

/** 분류별 form 필드 노출 매트릭스 — mock TYPE_LABELS 1:1 */
export interface TypeFormConfig {
  name: string
  org: string
  role: string
  orgPh: string
  rolePh: string
  showOrg: boolean
  showRole: boolean
  showResultUrl: boolean
  showOutcome: boolean
  outcomeLabel?: string
  outcomePh?: string
}

export const TYPE_LABELS: Record<ActivityType, TypeFormConfig> = {
  intern: {
    name: '활동명',
    org: '회사',
    role: '직무',
    orgPh: '예: CJ제일제당 / 네이버 / 토스',
    rolePh: '예: 마케터 / 디자이너 / 기획자 / 영업',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  club: {
    name: '동아리명',
    org: '소속',
    role: '직책',
    orgPh: '예: 경영학과 / 디자인 동아리',
    rolePh: '예: 회장 / 운영진 / 멤버',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  study: {
    name: '스터디 주제',
    org: '소속',
    role: '본인 역할',
    orgPh: '예: 학과 / 온라인',
    rolePh: '예: 운영자 / 멤버',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  project: {
    name: '프로젝트명',
    org: '소속',
    role: '역할',
    orgPh: '예: 학과 졸업작품 / 공모전 팀',
    rolePh: '예: PM / 디자이너 / 마케터 / 백엔드',
    showOrg: true,
    showRole: true,
    showResultUrl: true,
    showOutcome: false,
  },
  sideproject: {
    name: '프로젝트명',
    org: '',
    role: '',
    orgPh: '',
    rolePh: '',
    showOrg: false,
    showRole: false,
    showResultUrl: true,
    showOutcome: false,
  },
  contest: {
    name: '대회명',
    org: '주최',
    role: '본인 역할',
    orgPh: '예: 한이음 / 대학생 마케팅 공모전 / KOSAF',
    rolePh: '예: 팀장 / 발표 담당 / 콘텐츠 제작',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: true,
    outcomeLabel: '수상 결과',
    outcomePh: '예: 대상 / 우수상 / 본선 진출',
  },
  research: {
    name: '연구 주제',
    org: '학교 / 연구실',
    role: '본인 역할',
    orgPh: '예: 서울대 마케팅 연구실 / NLP Lab / 사회학과',
    rolePh: '예: 학부 연구생 / RA',
    showOrg: true,
    showRole: true,
    showResultUrl: true,
    showOutcome: true,
    outcomeLabel: '논문 / 특허',
    outcomePh: '예: SCI 논문 게재 / 학회 발표',
  },
  parttime: {
    name: '매장·회사명',
    org: '',
    role: '직무',
    orgPh: '',
    rolePh: '예: 카운터 / 서빙 / 매니저 / 과외',
    showOrg: false,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  volunteer: {
    name: '봉사처',
    org: '',
    role: '활동 종류',
    orgPh: '',
    rolePh: '예: 교육 / 환경 / 복지 / 의료',
    showOrg: false,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  overseas: {
    name: '학교·회사명',
    org: '국가',
    role: '형태',
    orgPh: '예: 캐나다 / 일본 / 미국',
    rolePh: '예: 교환학생 / 워홀 / 어학연수',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: false,
  },
  bootcamp: {
    name: '과정명',
    org: '주관',
    role: '분야',
    orgPh: '예: 패스트캠퍼스 / 그로스해킹 클래스 / 디자인 부트캠프',
    rolePh: '예: 마케팅 / 데이터 / UX 디자인 / 백엔드',
    showOrg: true,
    showRole: true,
    showResultUrl: false,
    showOutcome: true,
    outcomeLabel: '수료 여부',
    outcomePh: '예: 수료 / 우수 수료',
  },
  other: {
    name: '활동명',
    org: '',
    role: '',
    orgPh: '',
    rolePh: '',
    showOrg: false,
    showRole: false,
    showResultUrl: false,
    showOutcome: false,
  },
}

export const PAST_QUESTIONS: Record<ActivityType, string[]> = {
  intern: [
    '가장 큰 성과나 기여는?',
    '수치로 표현되는 결과 (KPI · 매출 · 만족도 등)?',
    '어려웠던 순간과 어떻게 풀었는지?',
    '협업했던 사람·팀 구성은?',
    '여기서 배운 점·성장한 점?',
    '결정적인 일화나 에피소드?',
  ],
  parttime: [
    '주요 업무·역할은?',
    '특별히 잘했던 점·인정받은 일?',
    '어려웠던 고객·상황과 대응?',
    '함께한 동료·매니저는?',
    '여기서 배운 점?',
  ],
  club: [
    '본인 역할·기여는?',
    '운영 규모 (인원·예산·기간)?',
    '대표 행사·프로젝트는?',
    '멤버·운영진과의 관계?',
    '여기서 배운 점?',
  ],
  study: [
    '스터디 주제·방향은?',
    '본인이 맡은 발표·역할?',
    '결과물·산출물 (발표·자료·논문)?',
    '함께한 사람들?',
    '여기서 배운 점?',
  ],
  project: [
    '결과물·산출물 한 줄로?',
    '본인이 맡은 역할은?',
    '막혔던 부분과 해결 방법?',
    '정량 결과·임팩트?',
    '회고·배운 점?',
    '결과물 링크가 있다면?',
  ],
  sideproject: [
    '왜 시작했나? 동기?',
    '결과물·기술 스택?',
    '가장 어려웠던 부분?',
    '얼마나 사용됐나? 사용자·반응?',
    '회고·배운 점?',
  ],
  contest: [
    '주제·과제는?',
    '본인 역할?',
    '결과 (수상·진출)?',
    '경쟁자·다른 팀 분석?',
    '여기서 배운 점?',
  ],
  research: [
    '연구 주제·방법론?',
    '본인 기여 (실험·분석·작성)?',
    '논문·발표 결과?',
    '랩 동료·교수님과 협업?',
    '여기서 배운 점?',
  ],
  volunteer: [
    '봉사 분야·대상?',
    '본인 역할·시간?',
    '인상 깊었던 일화?',
    '함께한 봉사자들?',
    '여기서 배운 점?',
  ],
  overseas: [
    '간 곳·기간?',
    '주요 활동·일정?',
    '문화 차이·도전?',
    '만난 사람들?',
    '여기서 얻은 것?',
  ],
  bootcamp: [
    '과정 주제·기간?',
    '본인 학습 진도·성과?',
    '결과물·프로젝트?',
    '함께한 동료들?',
    '여기서 배운 점?',
  ],
  other: [
    '활동 개요?',
    '본인 역할?',
    '주요 결과?',
    '함께한 사람?',
    '배운 점?',
  ],
}

/** 자소서 매핑 카테고리별 회고 prompt 풀 — mock REFLECTION_PROMPTS 1:1 */
export const REFLECTION_PROMPTS: Record<string, string[]> = {
  job_competency: [
    '이번주 가장 의미 있는 직무 경험은?',
    '어떤 스킬·역량이 늘었나요?',
    '결과로 어떤 변화를 만들었나요?',
  ],
  collaboration: [
    '사람들과의 관계·갈등에서 배운 점은?',
    '팀워크에서 어떤 역할을 맡았나요?',
    '의견 차이를 어떻게 풀어냈나요?',
  ],
  challenge: [
    '이번주 가장 힘들었던 순간은?',
    '시도한 것·실패한 것·배운 것?',
    '낯선 환경에서 새로 배운 것은?',
  ],
  background: [
    '이번주 무엇을 새로 알게 됐나요?',
    '이 활동에서 어떤 가치를 느끼나요?',
    '왜 이 활동을 시작했고 지금 어떤 의미인가요?',
  ],
  personality: [
    '이번주 자신의 어떤 면을 발견했나요?',
    '평소와 다르게 행동한 순간은?',
    '어떤 태도가 결과를 바꿨나요?',
  ],
  own_strength: [
    '나만의 강점이 발휘된 순간은?',
    '다른 사람과 차별되는 행동은?',
    '내가 가장 잘하는 것을 보여준 일은?',
  ],
}

/** mock suggestActivityType */
export function suggestActivityType(name: string): ActivityType | null {
  const lower = (name || '').toLowerCase()
  if (!lower.trim()) return null
  for (const [type, kws] of Object.entries(TYPE_KEYWORDS) as Array<
    [ActivityType, string[]]
  >) {
    if (kws.some((kw) => lower.includes(kw.toLowerCase()))) return type
  }
  return null
}
