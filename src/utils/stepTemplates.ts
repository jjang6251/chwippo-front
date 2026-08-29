import type { LucideIcon } from 'lucide-react'
import { Mic, FileText, Hourglass, Target, ClipboardCheck } from 'lucide-react'
import { classifyJob } from '@/utils/jobRole'

type TiptapDoc = { type: 'doc'; content: object[] }

function heading(level: 2 | 3, text: string): object {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}
function bullet(...texts: string[]): object {
  return {
    type: 'bulletList',
    content: texts.map((text) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
    })),
  }
}
function para(): object {
  return { type: 'paragraph' }
}

const interviewTemplate: TiptapDoc = {
  type: 'doc',
  content: [
    heading(2, '예상 질문 & 답변'),
    bullet(''),
    heading(2, '회사 리서치'),
    bullet(''),
    heading(2, '당일 메모'),
    para(),
  ],
}

const documentTemplate: TiptapDoc = {
  type: 'doc',
  content: [
    heading(2, '제출 서류 목록'),
    bullet(''),
    heading(2, '자기소개서 포인트'),
    para(),
  ],
}

export function getDefaultTemplate(stepName: string): TiptapDoc | null {
  if (stepName.includes('면접')) return interviewTemplate
  if (stepName.includes('서류')) return documentTemplate
  return null
}

export type StepType = 'interview' | 'document' | 'exam' | 'wait' | 'result'

// 판정 순서 = 전형의 "본질" 우선순위. 위에서부터 먼저 매칭되며, 순서가 곧 분류 규칙이므로 변경 시 아래 spec 회귀 필수.
//  1) interview — PT·토론·컬처핏·커피챗도 면접형 전형 (금융 '2차 PT·토론', IT '2차 컬처핏'). 'AI면접' 등 면접 우선.
//  2) exam(시험·평가) — 코테·과제·필기·인적성·시험·평가·검사류. '과제 제출'은 document 보다 먼저라 exam (과제가 본질).
//     영문 시험명(NCS·GSAT·HMAT…)은 대소문자 무관 + 단어경계(\b) — 'application' 의 CAT 등 오탐 방지.
//  3) document — 서류·제출 (exam 키워드 없을 때).
//  4) result — 합격·최종·발표 ('합격 발표'·'결과 발표'는 '발표'가 커버). interview 뒤라 'PT 발표'는 interview.
//     * 단독 '결과' 키워드는 제외: '결과 발표'는 '발표'로 이미 잡히고, '결과 대기'(item 5)는 wait 여야 하므로.
//  5) 그 외 → wait (결과 대기 등).
const INTERVIEW_RE = /면접|인터뷰|PT|토론|컬처핏|컬쳐핏|커피챗/
// 🔴 `검진`·`체력검정` 은 계열 템플릿 신설(2026-08-28) 때 추가했다. 「채용검진」(건설)과
//    「체력검정」(군인·경찰)이 어느 갈래에도 안 걸려 **회색 「대기」 아이콘**으로 떨어졌는데,
//    둘 다 날짜가 잡히는 실제 전형이라 모래시계로 그리면 화면이 거짓말을 한다.
//    (`검사` 는 이미 있어서 「신체검사」는 원래 잡혔다 — 「검진」만 구멍이었다.)
const EXAM_KO_RE =
  /코딩테스트|코테|테스트|과제|필기|인적성|인성|적성|시험|평가|논술|작문|실기|검사|검진|체력검정|역검/
const EXAM_EN_RE = /\b(NCS|PSAT|GSAT|HMAT|SKCT|DCAT|PAT|CAT)\b/i
const RESULT_RE = /합격|최종|발표/

export function getStepType(stepName: string): StepType {
  if (INTERVIEW_RE.test(stepName)) return 'interview'
  if (EXAM_KO_RE.test(stepName) || EXAM_EN_RE.test(stepName)) return 'exam'
  if (stepName.includes('서류') || stepName.includes('제출')) return 'document'
  if (RESULT_RE.test(stepName)) return 'result'
  return 'wait'
}

/**
 * 면접형 스텝만 고른다 — **면접 세션에서 준비 노트를 찾는 단일 구현**.
 *
 * 세션 자료 모달의 「준비 노트 보기」 링크(다리 b)와 나란히 보기의 준비 노트 열이 같은
 * 판정을 써야 한다: 한쪽만 'PT·토론'·'컬처핏'을 놓치면 **같은 카드인데 링크는 있고 열은
 * 없는** 상태가 된다. 판정 자체는 `getStepType` 단일 구현에 맡긴다.
 *
 * `app` 이 아직 안 온 호출부가 있어 `undefined` 를 그대로 받는다 (0개로 취급).
 */
/**
 * 면접 유도 모달 **전용** 판정 — `getStepType` 보다 좁다.
 *
 * 🔴 **왜 따로 두나** — 판정 순서가 `interview`(1순위) → … → `result`(4순위)라
 * **「면접 결과 발표」·「1차 면접 결과」·「면접 후기 작성」이 전부 `interview` 로 잡힌다.**
 * 아이콘·색을 고르는 용도로는 그게 맞다(면접 결과니 면접 아이콘). 하지만 넛지 기준으로는
 * **결과를 기다리는 사람에게 「면접이 잡혔네요」가 뜨는 것**이라 부적합하다.
 *
 * 🔴 **`getStepType` 을 고치지 않는다** — 소비처가 4곳이고 아이콘·필터·그룹핑이 걸려 있다.
 * 넛지 한 기능 때문에 전역 분류를 바꾸면 그쪽이 조용히 어긋난다.
 *
 * 🔴 **이 판정은 프론트에만 있다.** 서버는 「이 스텝이 면접인가」를 모른다 —
 * 정규식을 백엔드에 복제하면 여기에 `온사이트` 를 추가하고 저기를 잊는 순간 드리프트가 된다.
 * 서버는 「띄워도 되는 상태인가」(노출 이력·영구차단·세션)만 답한다.
 */
export function isInterviewLikeForNudge(stepName: string): boolean {
  return getStepType(stepName) === 'interview' && !NUDGE_EXCLUDE_RE.test(stepName)
}

/**
 * 넛지 전용 제외어 — 🔴 **`RESULT_RE` 를 그대로 못 쓴다.**
 *
 * `RESULT_RE`(`합격|최종|발표`)는 **「결과」 단독을 일부러 뺐다** — `결과 대기` 가 `wait` 로
 * 가야 하기 때문이다(위 판정 순서 주석 참조). 그래서 그걸 재사용하면
 * **「1차 면접 결과」가 안 걸린다.**
 *
 * 넛지는 `getStepType === 'interview'` 를 이미 통과한 이름만 보므로 `결과` 를 넣어도
 * `결과 대기` 에 영향이 없다 — 그건 애초에 `wait` 라 여기 오지 않는다.
 * `후기` 는 면접이 끝난 뒤라 준비를 권할 자리가 아니다.
 */
const NUDGE_EXCLUDE_RE = /합격|최종|발표|결과|후기/

export function pickInterviewSteps<T extends { name: string }>(
  steps: T[] | undefined | null,
): T[] {
  return (steps ?? []).filter((s) => getStepType(s.name) === 'interview')
}

// accentBorderCls: card-solid 구분감 패턴의 좌측 스트라이프 (U29 규칙 — 의미 토큰만.
// document=warning 은 캘린더 아젠다의 마감·전형 계열 색과 정합)
// Icon: 기능 아이콘 = lucide (아이콘 정책 — DESIGN.md). 색은 colorCls 를 상속(currentColor).
export const STEP_TYPE_CONFIG: Record<StepType, { Icon: LucideIcon; label: string; colorCls: string; borderCls: string; bgCls: string; accentBorderCls: string }> = {
  interview: { Icon: Mic, label: '면접', colorCls: 'text-info', borderCls: 'border-info/30', bgCls: 'bg-info/5', accentBorderCls: 'border-l-info' },
  document:  { Icon: FileText, label: '서류', colorCls: 'text-warning', borderCls: 'border-warning/30', bgCls: 'bg-warning/5', accentBorderCls: 'border-l-warning' },
  // exam=violet — 면접(청록 info)·서류(노랑 warning)·결과(초록 success)와 겹치지 않는 미사용 의미색. 캘린더 시험 이벤트(bg-violet)와도 정합.
  exam:      { Icon: ClipboardCheck, label: '시험·평가', colorCls: 'text-violet', borderCls: 'border-violet/30', bgCls: 'bg-violet/5', accentBorderCls: 'border-l-violet' },
  wait:      { Icon: Hourglass, label: '대기', colorCls: 'text-text-secondary', borderCls: 'border-line', bgCls: 'bg-card', accentBorderCls: 'border-l-text-quaternary' },
  result:    { Icon: Target, label: '결과', colorCls: 'text-success', borderCls: 'border-success/30', bgCls: 'bg-success/5', accentBorderCls: 'border-l-success' },
}

export const CHECKLIST_PRESETS: Partial<Record<StepType, string[]>> = {
  interview: ['지원서 재검토', '교통 경로 확인', '복장 준비', '면접관 인원 확인', '예상 질문 답변 복습'],
  document:  ['지원서 최종 확인', '첨부파일 체크', '제출 플랫폼 로그인 확인', '마감 시간 재확인'],
  exam:      ['신분증 준비', '고사장·응시 링크 확인', '필기구·계산기 준비', '기출·유형 복습'],
}

// ── 전형 템플릿 (카드 생성 시 초기 스텝) ──────────────────────
// 백엔드 chwippo-back/src/applications/application-templates.ts 와 id·스텝이 동일해야 함.
// 모두 '서류 제출' 시작 / '최종 합격' 끝.
export interface ApplicationTemplate {
  id: string
  label: string
  steps: string[]
}

export const APPLICATION_TEMPLATES: ApplicationTemplate[] = [
  { id: 'general', label: '일반 대기업', steps: ['서류 제출', '1차 면접', '2차 면접', '최종 합격'] },
  { id: 'it_dev', label: 'IT 개발', steps: ['서류 제출', '코딩테스트·과제', '1차 기술면접', '2차 컬처핏', '최종 합격'] },
  { id: 'public', label: '공기업·공공', steps: ['서류 제출', '필기(NCS)', '면접', '최종 합격'] },
  { id: 'finance', label: '금융권', steps: ['서류 제출', '인적성', '1차 실무면접', '2차 PT·토론', '임원면접', '최종 합격'] },
  { id: 'startup', label: '스타트업', steps: ['서류 제출', '과제 전형', '1차 면접', '대표 면접', '최종 합격'] },
  { id: 'media', label: '방송·언론', steps: ['서류 제출', '필기', '실무 평가', '면접', '최종 합격'] },
  { id: 'internship', label: '인턴십·체험형', steps: ['서류 제출', '면접', '최종 합격'] },

  // ── 계열 14 전용 (2026-08-28) ──────────────────────────────────────
  // 온보딩이 계열 1탭이 되면서 「계열을 골랐는데 전형은 일반 대기업」이라는 구멍이 생겼다.
  // 백엔드 `application-templates.ts` 와 id·스텝 문자열이 **정확히 같아야** 한다
  // (라벨은 화면 문구라 여기만 있다 — 서버는 라벨을 쓰지 않는다).
  { id: 'office', label: '경영·사무·행정', steps: ['서류 제출', '인적성', '1차 실무면접', '2차 임원면접', '최종 합격'] },
  { id: 'health', label: '의료·보건·복지', steps: ['서류 제출', '면접', '신체검사', '최종 합격'] },
  { id: 'education', label: '교육', steps: ['서류 제출', '수업 시연·필기', '면접', '최종 합격'] },
  { id: 'research', label: '연구·R&D', steps: ['서류 제출', '전공 필기·PT', '기술면접', '임원면접', '최종 합격'] },
  // 🔴 실기를 일부러 뺐다 — 대졸 공채 생산·기술 전형에는 실기 단계가 없다 (8/28 결정 ③)
  { id: 'manufacturing', label: '생산·기술', steps: ['서류 제출', '인적성', '실무면접', '임원면접', '최종 합격'] },
  { id: 'construction', label: '건설·설비', steps: ['서류 제출', '면접(직무·인성)', '채용검진', '최종 합격'] },
  { id: 'sales', label: '영업·판매·서비스', steps: ['서류 제출', '인적성·AI역량검사', '1차 실무면접', '2차 면접', '최종 합격'] },
  { id: 'logistics', label: '운송·물류', steps: ['서류 제출', '인적성·필기', '면접', '최종 합격'] },
  { id: 'agriculture', label: '농림어업', steps: ['서류 제출', '필기·인적성', '면접', '최종 합격'] },
  { id: 'marketing', label: '마케팅·광고·홍보', steps: ['서류 제출', '과제(기획안)', '1차 실무면접', '2차 면접', '최종 합격'] },

  // ── 세밀 그룹 전용 — 같은 계열 안에서 전형이 통째로 다른 갈래 ────────
  // 계열을 늘리지 않고 **세밀 층에 콘텐츠만 붙이는** 2층 구조의 첫 사용처다
  // (`utils/jobRole.ts` 설계 주석 참조).
  { id: 'finance_public', label: '금융 공공(한은·금감원)', steps: ['서류 제출', '필기(전공·논술)', '1차 면접', '2차 면접', '최종 합격'] },
  { id: 'air_service', label: '항공 서비스(승무원)', steps: ['서류 제출', '1차 실무면접', '2차 임원·영어면접', '체력·신체검사', '최종 합격'] },
  { id: 'uniformed', label: '군인·경찰·소방', steps: ['서류 제출', '필기', '체력검정', '면접·신체검사', '최종 합격'] },
  { id: 'teacher_exam', label: '교사 임용', steps: ['서류 제출', '1차 필기', '2차 수업실연·심층면접', '최종 합격'] },

  { id: 'custom', label: '직접 설정', steps: ['서류 제출', '1차 면접', '2차 면접', '최종 합격'] }, // = general, 만든 뒤 편집
]

const TEMPLATE_BY_ID: Record<string, ApplicationTemplate> = Object.fromEntries(
  APPLICATION_TEMPLATES.map((t) => [t.id, t]),
)

export function getApplicationTemplate(id: string | null | undefined): ApplicationTemplate {
  return (id && TEMPLATE_BY_ID[id]) || TEMPLATE_BY_ID.general
}

const FINANCE_RE = /은행|증권|보험|카드|캐피탈/
/**
 * 🔴 **`FINANCE_RE` 보다 먼저 본다** — 국책은행(`산업은행`·`기업은행`·`수출입은행`)은 이름에
 * 「은행」이 들어가지만 전형은 **NCS 필기**라 금융권 템플릿이 아니라 공공 템플릿이 맞다.
 * 순서를 뒤집지 않으면 이 세 패턴은 `FINANCE_RE` 에 먼저 걸려 **죽은 패턴**이 된다.
 * (`신한은행`·`KB증권` 은 공공 토큰이 없어 그대로 금융으로 간다.)
 *
 * ⚠️ **`병원` 은 넣지 않는다** — 병원 템플릿 신설이 보류라, 넣으면 간호사 카드가
 * 「필기(NCS)」 스텝을 받는다. 공공 전형이 아닌데 공공 템플릿을 주는 게 더 나쁘다.
 */
const PUBLIC_RE =
  /공사|공단|진흥원|재단|청$|기금|금고|협회|공공기관|감독원|결제원|산업은행|기업은행|수출입은행/
const MEDIA_RE = /방송|일보|신문|뉴스|MBC|KBS|SBS|JTBC/

/** 스타트업은 이름에 그대로 드러나는 경우만 잡는다 — 추측하지 않는다 */
const STARTUP_RE = /스타트업|startup/i

/**
 * 계열(`utils/jobRole.ts` 의 `JobSeriesDef.id`) → 전형 템플릿 — **14계열 전부**.
 *
 * 🔴 예전엔 3계열(it·finance·public)만 있었다. 온보딩이 계열 1탭이 되면서 그 구멍이
 * 눈에 보이는 자리로 나왔다 — 「의료·보건·복지」를 고른 사람에게 전형 미리보기로
 * 「서류 → 1차 면접 → 2차 면접 → 최종 합격」(일반 대기업)을 보여주는 건 보상이 아니다.
 *
 * 🔴 `media` 를 **연결했다.** 예전에 비워둔 이유는 「디자이너에게 방송사 필기 스텝을
 * 주게 된다」였는데, 그건 계열 라벨이 「방송·언론」일 때의 걱정이다. 실제 계열 라벨은
 * **「미디어·디자인·문화」**로 넓고, 디자이너·영상편집·PD 가 한 칸에 있다.
 * `media` 템플릿(서류→필기→실무 평가→면접)은 그중 어느 쪽에도 크게 틀리지 않는
 * 4단계이고, 무엇보다 **만든 뒤 스텝을 자유 편집할 수 있다.** 일반 대기업 템플릿을
 * 주는 것보다 계열에 가까운 걸 주는 편이 낫다.
 */
const SERIES_TEMPLATE: Record<string, string> = {
  it: 'it_dev',
  office: 'office',
  finance: 'finance',
  health: 'health',
  education: 'education',
  public: 'public',
  research: 'research',
  manufacturing: 'manufacturing',
  construction: 'construction',
  sales: 'sales',
  media: 'media',
  logistics: 'logistics',
  agriculture: 'agriculture',
  marketing: 'marketing',
}

/**
 * **세밀 그룹**(`utils/jobRole.ts` 의 `FineGroupDef.id`) → 전형 템플릿.
 *
 * 계열보다 한 층 좁게 봐야 하는 네 자리다 — 같은 계열 안인데 전형이 통째로 다르다:
 *
 * | 세밀 | 계열 | 왜 계열 템플릿으로는 틀리나 |
 * |---|---|---|
 * | `finance-public` | 금융·보험 | 한은·금감원은 **전공 필기·논술**이 관문. 시중은행 인적성 전형이 아니다 |
 * | `sales-travel` | 영업·판매·서비스 | 승무원은 **체력·신체검사**와 영어면접이 붙는다 |
 * | `public-safety` · `public-military` | 공공 | 경찰·소방·군은 **체력검정**이 있고 NCS 가 아니다 |
 *
 * 🔴 **계열보다 먼저 본다.** 세밀은 계열의 부분집합이라, 계열이 먼저 이기면 이 표는
 * 영영 도달하지 않는 죽은 코드가 된다.
 */
const FINE_TEMPLATE: Record<string, string> = {
  'finance-public': 'finance_public',
  'sales-travel': 'air_service',
  'public-safety': 'uniformed',
  'public-military': 'uniformed',
}

/**
 * 교사 **임용**은 사전 판정으로 못 가른다 — `임용` 도 `교사` 도 세밀 그룹이 같은
 * `education-general` 이라 「학원강사」와 구분이 안 된다. 그런데 전형은 완전히 다르다
 * (1차 필기 → 2차 수업실연·심층면접). 원문에 「임용」이 있으면 그건 공시급 신호다.
 */
const TEACHER_RE = /임용/

/**
 * 🔴 직군 → 템플릿 매핑. **값이 `utils/sampleData.ts` 의 `JOB_CATEGORIES` 와 정확히 일치해야 한다.**
 *
 * W1 에서 직군이 8분류(`'IT개발'` 등)에서 **21개 세부 직군**(`'백엔드 개발'` 등)으로 바뀌었는데
 * 이 함수만 옛 값을 그대로 보고 있었다. 그 결과 **IT 직군을 골라도 IT 템플릿이 절대 추천되지
 * 않았다** — `['백엔드 개발'].includes('IT개발')` 은 언제나 false 다. (2026-08-05 발견)
 *
 * 회사명 기반(금융·공기업·방송)은 정규식이라 살아 있었기 때문에 **일부만 죽은 상태**로 오래 갔다.
 * 아래 spec 이 `JOB_CATEGORIES` 와의 정합을 지킨다 — 직군 목록을 바꾸면 여기도 같이 본다.
 */
export const IT_CATEGORIES = [
  '백엔드 개발',
  '프론트엔드 개발',
  '모바일 앱 개발',
  '데이터·AI',
  'DevOps·인프라·보안',
  'IT개발', // 레거시 8분류 — 옛 카드 데이터가 흘러들어와도 동작하게 남긴다
]
export const FINANCE_CATEGORIES = ['금융·은행·증권·보험', '금융'] // 뒤는 레거시

/**
 * 계열·직무 원문·회사명으로 전형 템플릿 추천 (추천일 뿐 — 드롭다운에서 변경 가능).
 *
 * ## 판정 순서 — 위에서 아래로 **첫 매치가 이긴다**
 *
 * ```
 * ① 인턴          — 전형이 통째로 짧아진다. 어떤 계열이든 이긴다
 * ② 임용          — 「교사」와 사전상 구분 불가라 원문 규칙으로만 잡힌다
 * ③ 세밀 그룹     — 금융공공·승무원·경찰. 계열의 부분집합이라 계열보다 먼저 봐야 산다
 * ④ 회사명 정규식 — 공공 → 금융 → 방송 → 스타트업 (기존 순서 유지)
 * ⑤ 계열          — 14계열 전부 매핑
 * ⑥ 옛 직군 칩    — 하위 호환
 * ⑦ general
 * ```
 *
 * 🔴 **④ 회사명이 ⑤ 계열보다 먼저다** (2026-08-28 변경 · 이전엔 계열이 먼저였다).
 * 계열은 「내가 무슨 일을 하는가」이고 회사명은 「이 회사가 어떤 전형을 돌리는가」인데,
 * **전형을 정하는 쪽은 회사다.** 「신한은행 + 백엔드 개발자」는 IT 대기업 코테 전형이
 * 아니라 은행 공채 전형으로 간다. 계열 14벌이 전부 채워지면서 이 충돌이 흔해졌다
 * (예전엔 3계열만 있어 대부분 회사명까지 흘러왔다).
 *
 * 🔴 **`인턴` 판정이 죽어 있었다** — 규칙은 1순위로 적혀 있었는데 **호출부가 `rawInput` 을
 * 한 번도 안 넘겼다.** 이제 `rawInput` 이 없으면 `jobTitle` 을 본다 (「백엔드 인턴」처럼
 * 직무 칸에 적히는 게 실제 입력 형태다).
 *
 * 🔴 **`startup` 템플릿도 도달 불가였다** — 어떤 규칙도 그 id 를 돌려주지 않아 드롭다운에서
 * 손으로 고를 때만 쓰였다. 이름에 드러나는 경우만 잡는 좁은 규칙을 준다.
 *
 * `jobCategories` 는 **하위 호환**이다 — 옛 21개 직군 칩 값을 넘기던 호출부가 아직 있을 수
 * 있어 남겨 뒀다. 새 호출부는 `seriesId` 를 쓴다.
 */
export function recommendTemplate(args: {
  /** `utils/jobRole.ts` 계열 id — 새 경로의 1차 신호 */
  seriesId?: string | null
  /** 직무 원문 (「백엔드 인턴」) */
  jobTitle?: string
  companyName?: string
  rawInput?: string
  /** @deprecated 옛 직군 칩 값 — 하위 호환용 */
  jobCategories?: string[]
}): string {
  const {
    seriesId = null,
    jobTitle = '',
    jobCategories = [],
    companyName = '',
    rawInput = '',
  } = args

  const freeText = rawInput || jobTitle
  if (freeText.includes('인턴')) return 'internship'

  // ② 임용 — `jobTitle` 과 `rawInput` 을 **둘 다** 본다. `freeText` 는 rawInput 이 있으면
  //    jobTitle 을 버리는데, 「임용」이 직무 칸에만 적힌 경우를 놓치면 규칙이 반만 산다.
  if (TEACHER_RE.test(jobTitle) || TEACHER_RE.test(rawInput)) return 'teacher_exam'

  // ③ 세밀 그룹 — 확신 판정일 때만. 모호(`ambiguous`)면 어느 쪽인지 모르는 것이므로
  //    억지로 고르지 않고 아래 규칙에 넘긴다.
  if (jobTitle) {
    const verdict = classifyJob(jobTitle)
    if (verdict.status === 'confident') {
      const fine = FINE_TEMPLATE[verdict.fine.id]
      if (fine) return fine
    }
  }

  // ④ 회사명 — 전형을 정하는 건 회사다 (위 순서 주석 참조).
  //    🔴 공공이 금융보다 먼저 — 국책은행 3종이 「은행」에 먼저 걸리지 않게 (PUBLIC_RE 주석)
  if (PUBLIC_RE.test(companyName)) return 'public'
  if (FINANCE_RE.test(companyName)) return 'finance'
  if (MEDIA_RE.test(companyName)) return 'media'
  if (STARTUP_RE.test(companyName) || STARTUP_RE.test(jobTitle)) return 'startup'

  // ⑤ 계열
  if (seriesId && SERIES_TEMPLATE[seriesId]) return SERIES_TEMPLATE[seriesId]

  // ⑥ 옛 21개 직군 칩 — 하위 호환
  if (jobCategories.some((c) => IT_CATEGORIES.includes(c))) return 'it_dev'
  if (jobCategories.some((c) => FINANCE_CATEGORIES.includes(c))) return 'finance'

  return 'general'
}
