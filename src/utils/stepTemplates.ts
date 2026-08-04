import type { LucideIcon } from 'lucide-react'
import { Mic, FileText, Hourglass, Target, ClipboardCheck } from 'lucide-react'

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
const EXAM_KO_RE = /코딩테스트|코테|테스트|과제|필기|인적성|인성|적성|시험|평가|논술|작문|실기|검사|역검/
const EXAM_EN_RE = /\b(NCS|PSAT|GSAT|HMAT|SKCT|DCAT|PAT|CAT)\b/i
const RESULT_RE = /합격|최종|발표/

export function getStepType(stepName: string): StepType {
  if (INTERVIEW_RE.test(stepName)) return 'interview'
  if (EXAM_KO_RE.test(stepName) || EXAM_EN_RE.test(stepName)) return 'exam'
  if (stepName.includes('서류') || stepName.includes('제출')) return 'document'
  if (RESULT_RE.test(stepName)) return 'result'
  return 'wait'
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
  { id: 'custom', label: '직접 설정', steps: ['서류 제출', '1차 면접', '2차 면접', '최종 합격'] }, // = general, 만든 뒤 편집
]

const TEMPLATE_BY_ID: Record<string, ApplicationTemplate> = Object.fromEntries(
  APPLICATION_TEMPLATES.map((t) => [t.id, t]),
)

export function getApplicationTemplate(id: string | null | undefined): ApplicationTemplate {
  return (id && TEMPLATE_BY_ID[id]) || TEMPLATE_BY_ID.general
}

const FINANCE_RE = /은행|증권|보험|카드|캐피탈/
const PUBLIC_RE = /공사|공단|진흥원|재단|청$/
const MEDIA_RE = /방송|일보|신문|뉴스|MBC|KBS|SBS|JTBC/

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

// 직군 태그·회사명·자연어 입력으로 전형 템플릿 추천 (추천일 뿐 — 드롭다운에서 변경 가능)
export function recommendTemplate(args: {
  jobCategories?: string[]
  companyName?: string
  rawInput?: string
}): string {
  const { jobCategories = [], companyName = '', rawInput = '' } = args
  if (rawInput.includes('인턴')) return 'internship'
  if (jobCategories.some((c) => IT_CATEGORIES.includes(c))) return 'it_dev'
  if (jobCategories.some((c) => FINANCE_CATEGORIES.includes(c))) return 'finance'
  if (FINANCE_RE.test(companyName)) return 'finance'
  if (PUBLIC_RE.test(companyName)) return 'public'
  if (MEDIA_RE.test(companyName)) return 'media'
  return 'general'
}
