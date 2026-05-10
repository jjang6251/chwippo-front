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

export const STEP_TYPE_CONFIG: Record<StepType, { icon: string; label: string; colorCls: string; borderCls: string; bgCls: string; hex: string }> = {
  interview: { icon: '🎤', label: '면접', colorCls: 'text-info', borderCls: 'border-info/30', bgCls: 'bg-info/5', hex: '#7170ff' },
  document:  { icon: '📄', label: '서류', colorCls: 'text-blue-400', borderCls: 'border-blue-400/30', bgCls: 'bg-blue-400/5', hex: '#60a5fa' },
  wait:      { icon: '⏳', label: '대기', colorCls: 'text-text-tertiary', borderCls: 'border-white/10', bgCls: 'bg-white/3', hex: '#8a8f98' },
  result:    { icon: '🎯', label: '결과', colorCls: 'text-success', borderCls: 'border-success/30', bgCls: 'bg-success/5', hex: '#10b981' },
}

export const CHECKLIST_PRESETS: Partial<Record<StepType, string[]>> = {
  interview: ['지원서 재검토', '교통 경로 확인', '복장 준비', '면접관 인원 확인', '예상 질문 답변 복습'],
  document:  ['지원서 최종 확인', '첨부파일 체크', '제출 플랫폼 로그인 확인', '마감 시간 재확인'],
}
