import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import {
  MEMO_MAX,
  MEMO_SECTIONS,
  docHasHeading,
  sectionNodes,
  plainMemoToDoc,
  type TiptapDoc,
} from '@/utils/memoSections'

/**
 * card-detail-remodel — "회사 메모" 카드 (리치 에디터).
 *
 * plain textarea → 공용 RichTextEditor(tiptap)로 전환 (준비 노트와 문법 통일).
 * - 저장: memo = tiptap JSON 문자열 (백 text 컬럼 무변경). 1.5s debounce 자동 저장.
 * - 빈 문서면 '' 전송(껍데기 JSON 저장 방지) — RichTextEditor 가 처리.
 * - legacy plain 메모(칩이 넣던 `[제목]` 줄 포함)는 열 때 plainMemoToDoc 으로 H3/문단 변환.
 * - 시작 칩 3종: 대괄호 텍스트 대신 진짜 H3 heading + 빈 문단을 끝에 삽입, 커서 이동.
 * - 2000자 제한(CharacterCount) + 하단 카운터.
 */

interface Props {
  value: string
  onSave: (v: string) => void
}

export function CompanyMemoCard({ value, onSave }: Props) {
  // 열 때 1회 변환 (에디터는 initialContent 를 mount 시 1회만 읽음)
  const [initialContent] = useState(() =>
    value ? JSON.stringify(plainMemoToDoc(value)) : null,
  )

  const handleChip = (editor: Editor, title: string) => {
    const doc = editor.getJSON() as TiptapDoc
    if (docHasHeading(doc, title)) {
      editor.chain().focus('end').run()
      return
    }
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, sectionNodes(title)).focus('end').run()
  }

  const header = (editor: Editor) => {
    const doc = editor.getJSON() as TiptapDoc
    return (
      <div className="px-4 pt-4 pb-2.5">
        <h2 className="text-text-primary text-sm font-semibold mb-1">회사 메모</h2>
        <p className="text-[11px] text-text-quaternary mb-3">
          이 회사 전반에 대한 기록 — 각 전형의 메모는 스텝 안에서
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MEMO_SECTIONS.map((title) => {
            const added = docHasHeading(doc, title)
            return (
              <button
                key={title}
                type="button"
                // 칩이 에디터 포커스를 뺏지 않게 (핸들러에서 focus 처리)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleChip(editor, title)}
                aria-pressed={added}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-all ${
                  added
                    ? 'border-brand/30 bg-brand/10 text-brand'
                    : 'border-line bg-card text-text-tertiary hover:border-line-strong hover:text-text-secondary'
                }`}
              >
                {added && <span aria-hidden="true">✓</span>}
                {title}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    // 에디터 카드 문법 통일 (CEO 2026-07-20) — bg-input textarea → card-solid 에디터
    <div className="border border-line-strong bg-card-solid shadow-sm rounded-xl overflow-hidden">
      <RichTextEditor
        initialContent={initialContent}
        onSave={onSave}
        placeholder="자유롭게 적거나 위 항목을 눌러 시작해보세요"
        minHeightClass="min-h-[300px]"
        characterLimit={MEMO_MAX}
        header={header}
      />
    </div>
  )
}
