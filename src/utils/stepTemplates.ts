import type { LucideIcon } from 'lucide-react'
import { Mic, FileText, Hourglass, Target } from 'lucide-react'

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

export type StepType = 'interview' | 'document' | 'wait' | 'result'

export function getStepType(stepName: string): StepType {
  if (stepName.includes('면접')) return 'interview'
  if (stepName.includes('서류') || stepName.includes('제출')) return 'document'
  if (stepName.includes('합격') || stepName.includes('최종')) return 'result'
  return 'wait'
}

// accentBorderCls: card-solid 구분감 패턴의 좌측 스트라이프 (U29 규칙 — 의미 토큰만.
// document=warning 은 캘린더 아젠다의 마감·전형 계열 색과 정합)
// Icon: 기능 아이콘 = lucide (아이콘 정책 — DESIGN.md). 색은 colorCls 를 상속(currentColor).
export const STEP_TYPE_CONFIG: Record<StepType, { Icon: LucideIcon; label: string; colorCls: string; borderCls: string; bgCls: string; accentBorderCls: string }> = {
  interview: { Icon: Mic, label: '면접', colorCls: 'text-info', borderCls: 'border-info/30', bgCls: 'bg-info/5', accentBorderCls: 'border-l-info' },
  document:  { Icon: FileText, label: '서류', colorCls: 'text-warning', borderCls: 'border-warning/30', bgCls: 'bg-warning/5', accentBorderCls: 'border-l-warning' },
  wait:      { Icon: Hourglass, label: '대기', colorCls: 'text-text-tertiary', borderCls: 'border-line', bgCls: 'bg-card', accentBorderCls: 'border-l-text-quaternary' },
  result:    { Icon: Target, label: '결과', colorCls: 'text-success', borderCls: 'border-success/30', bgCls: 'bg-success/5', accentBorderCls: 'border-l-success' },
}

export const CHECKLIST_PRESETS: Partial<Record<StepType, string[]>> = {
  interview: ['지원서 재검토', '교통 경로 확인', '복장 준비', '면접관 인원 확인', '예상 질문 답변 복습'],
  document:  ['지원서 최종 확인', '첨부파일 체크', '제출 플랫폼 로그인 확인', '마감 시간 재확인'],
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

// 직군 태그·회사명·자연어 입력으로 전형 템플릿 추천 (추천일 뿐 — 드롭다운에서 변경 가능)
export function recommendTemplate(args: {
  jobCategories?: string[]
  companyName?: string
  rawInput?: string
}): string {
  const { jobCategories = [], companyName = '', rawInput = '' } = args
  if (rawInput.includes('인턴')) return 'internship'
  if (jobCategories.includes('IT개발')) return 'it_dev'
  if (FINANCE_RE.test(companyName)) return 'finance'
  if (PUBLIC_RE.test(companyName)) return 'public'
  if (MEDIA_RE.test(companyName)) return 'media'
  return 'general'
}
