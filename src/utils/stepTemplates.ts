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
