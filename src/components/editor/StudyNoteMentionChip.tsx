import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { StudyNoteMentionOptions } from './StudyNoteMention'

/**
 * 노트 멘션 칩 — brand 틴트 + 📄 (mockup detail-desktop 117행).
 *
 * `dead`(삭제된 노트)는 **판정을 밖에서 받는다**. 어떤 노트가 살아 있는지는 허브가 받아 둔
 * 목록만 알고, 에디터는 본문 안의 id 밖에 못 본다. 그래서 판정자는 옵션으로 주입되고
 * 이번 Phase 에서는 항상 살아 있는 것으로 본다 (plan 결정 10 — 렌더 정책만 미리 깔아둔다).
 */

export const MENTION_FALLBACK_LABEL = '제목 없음'
export const MENTION_DEAD_LABEL = '삭제된 노트'

export function StudyNoteMentionChip({ node, extension }: NodeViewProps) {
  const noteId = String(node.attrs.noteId ?? '')
  const rawLabel = String(node.attrs.label ?? '').trim()
  const options = extension.options as StudyNoteMentionOptions
  const dead = noteId === '' || (options.isDeadNote?.(noteId) ?? false)

  if (dead) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <span
          data-testid="study-note-mention-dead"
          aria-label={`${MENTION_DEAD_LABEL} — 이동할 수 없어요`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-dashed border-line-strong text-text-faint text-[0.93em] align-baseline cursor-not-allowed"
        >
          <span aria-hidden="true">📄</span>
          {MENTION_DEAD_LABEL}
        </span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href={`/study-notes/${noteId}`}
        data-testid="study-note-mention"
        data-note-id={noteId}
        // contenteditable 안의 링크는 클릭이 캐럿 이동에 먹히기 쉬워 mousedown 부터 잡는다
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          if (!options.onNavigate) return
          e.preventDefault()
          options.onNavigate(noteId)
        }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-[0.93em] align-baseline cursor-pointer hover:bg-brand/20 transition-colors"
      >
        <span aria-hidden="true">📄</span>
        {rawLabel || MENTION_FALLBACK_LABEL}
      </a>
    </NodeViewWrapper>
  )
}
