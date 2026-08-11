import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'
import { getDefaultTemplate } from '@/utils/stepTemplates'

interface Props {
  stepName: string
  initialContent: string | null
  onSave: (json: string) => Promise<void>
  /** 저장 전 본문(plain text) — 면접 스텝의 「이 내용으로 면접 질문 만들기」가 쓴다 */
  onTextChange?: (plainText: string) => void
  /**
   * tiptap Editor 손잡이 — **시트 전환·언마운트 시 미저장분 flush** 를 위해 바깥이 요청한다
   * (`SheetedNoteEditor`).
   *
   * 🔴 `onTextChange` 로는 부족하다. 그건 plain text 라 **저장 형태(tiptap JSON)로 되돌릴 수
   * 없다** — 그걸로 저장하면 서식이 통째로 날아간다. 저장 직전 값을 만들려면 doc 자체가
   * 필요하고, 공용 `RichTextEditor` 를 건드리지 않고 doc 에 닿는 길은 `header` 슬롯뿐이다
   * (렌더물은 없다 — 손잡이만 받는다).
   */
  editorRef?: RefObject<Editor | null>
}

/**
 * 준비 노트 에디터 — 공용 RichTextEditor 래퍼.
 * 스텝명 기반 기본 포맷·1.5s 자동 저장·저장 상태 라벨은 RichTextEditor 가 담당(동작 무변경).
 * min-height 360 (CEO 2026-07-20). 카운터·글자 제한 없음(스코프 밖).
 */
export function StepNoteEditor({
  stepName,
  initialContent,
  onSave,
  onTextChange,
  editorRef,
}: Props) {
  return (
    // card-solid 승격 — 준비 체크리스트 카드와 동급 시인성
    <div className="border border-line-strong bg-card-solid shadow-sm rounded-xl overflow-hidden">
      <RichTextEditor
        initialContent={initialContent}
        onSave={onSave}
        placeholder="이 단계에서 준비한 것들을 자유롭게 기록해 보세요..."
        minHeightClass="min-h-[360px]"
        template={getDefaultTemplate(stepName)}
        onTextChange={onTextChange}
        header={
          editorRef
            ? (editor) => {
                editorRef.current = editor
                return null
              }
            : undefined
        }
      />
    </div>
  )
}
