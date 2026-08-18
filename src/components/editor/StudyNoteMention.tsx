import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import type { Node as PMNode } from '@tiptap/pm/model'
import { StudyNoteMentionChip, MENTION_FALLBACK_LABEL } from './StudyNoteMentionChip'
import { createMentionSuggestionRenderer } from './mentionSuggestionRenderer'

/**
 * study-notes Phase 2a — 노트 멘션 노드 (공용 승격).
 *
 * 🔴 **백엔드 계약** — 노드 타입명은 정확히 `studyNoteMention`, 노트 id 는 `attrs.noteId`.
 * 백엔드 `src/study-notes/mention-links.ts` 의 `MENTION_NODE_TYPE` 이 이 문자열을 그대로
 * 찾아 `study_note_links` 를 재계산한다. 이름이나 attr 키가 바뀌면 백링크가 통째로 끊긴다
 * (조용히 — 저장은 성공하고 링크만 0개가 된다). 바꿔야 하면 양쪽을 같은 PR 에서 바꾼다.
 *
 * `attrs.label` 은 **삽입 시점 제목 스냅샷**이다 (plan §3). 원본 노트 제목이 바뀌어도
 * 칩 글자는 옛 제목으로 남는다 — 클릭 이동은 `noteId` 로 하니 항상 정상이고,
 * 라이브 제목은 2차 범위다. 라벨을 안 들고 있으면 목록을 못 받은 화면(준비 노트 시트 등)에서
 * 칩이 통째로 빈칸이 된다.
 */

export const STUDY_NOTE_MENTION_TYPE = 'studyNoteMention'

export interface StudyNoteMentionItem {
  id: string
  title: string
}

export interface StudyNoteMentionOptions {
  /**
   * suggestion 데이터 소스 — **주입**받는다 (plan §3: 목록 1회 로드 후 클라 필터).
   * 에디터가 직접 fetch 하지 않는 이유는 소비처마다 목록의 출처가 다르기 때문 —
   * 공부 노트 문서 페이지는 허브가 이미 받아 둔 목록을 그대로 넘긴다.
   */
  items: (query: string) => StudyNoteMentionItem[] | Promise<StudyNoteMentionItem[]>
  /** 칩 클릭 시 SPA 이동. 미지정이면 `<a href>` 기본 이동에 맡긴다 */
  onNavigate?: (noteId: string) => void
  /**
   * 끊긴 링크 판정 — 삭제된 노트를 가리키는 칩을 「삭제된 노트」로 렌더한다 (plan 결정 10).
   * 이번 Phase 에서는 항상 `false` (허브가 목록을 넘기기 시작하면 그때 배선한다).
   */
  isDeadNote?: (noteId: string) => boolean
}

const EMPTY_ITEMS: StudyNoteMentionItem[] = []

/** `[[`·`@` 두 트리거가 같은 plugin key 를 쓰면 ProseMirror 가 중복 키로 던진다 */
const BRACKET_KEY = new PluginKey('studyNoteMentionBracket')
const AT_KEY = new PluginKey('studyNoteMentionAt')

/** 문서에 남는 형태 — 백엔드 추출기가 보는 건 이 JSON 뿐이다 */
export const StudyNoteMention = Node.create<StudyNoteMentionOptions>({
  name: STUDY_NOTE_MENTION_TYPE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      items: () => EMPTY_ITEMS,
      onNavigate: undefined,
      isDeadNote: undefined,
    }
  },

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-id'),
        renderHTML: (attributes) => ({ 'data-note-id': attributes.noteId as string }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-label') ?? '',
        renderHTML: (attributes) => ({ 'data-label': attributes.label as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: `span[data-type="${STUDY_NOTE_MENTION_TYPE}"]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? '').trim() || MENTION_FALLBACK_LABEL
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': STUDY_NOTE_MENTION_TYPE,
        class: 'study-note-mention',
      }),
      `📄 ${label}`,
    ]
  },

  renderText({ node }) {
    return `📄 ${String(node.attrs.label ?? '').trim() || MENTION_FALLBACK_LABEL}`
  },

  addNodeView() {
    return ReactNodeViewRenderer(StudyNoteMentionChip)
  },

  /**
   * md 내보내기 — 멘션은 마크다운에 대응 문법이 없다. 사람이 읽을 수 있게
   * 앱 내부 경로 링크로 떨군다 (열화 명세: 칩 시각·dead 여부는 사라진다).
   */
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          const label = String(node.attrs.label ?? '').trim() || MENTION_FALLBACK_LABEL
          state.write(`[${label}](/study-notes/${String(node.attrs.noteId ?? '')})`)
        },
      },
    }
  },

  addProseMirrorPlugins() {
    const shared: Omit<SuggestionOptions<StudyNoteMentionItem>, 'editor' | 'char' | 'pluginKey'> = {
      /**
       * 주입된 소스가 **거르지 않고 전체 목록을 줘도** 팝오버가 쓸 만하도록 여기서 한 번 더
       * 좁힌다 (plan §3 "목록 1회 로드 후 클라 필터"). 이미 거른 목록이면 같은 조건이라 무해.
       */
      items: async ({ query }) => filterMentionItems(await this.options.items(query), query),
      render: createMentionSuggestionRenderer(),
      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: STUDY_NOTE_MENTION_TYPE,
              // label = 삽입 시점 스냅샷. 이후 원본 제목이 바뀌어도 여기는 안 따라간다
              attrs: { noteId: props.id, label: props.title },
            },
            { type: 'text', text: ' ' },
          ])
          .run()
      },
    }

    return [
      Suggestion({ ...shared, editor: this.editor, char: '[[', pluginKey: BRACKET_KEY }),
      Suggestion({ ...shared, editor: this.editor, char: '@', pluginKey: AT_KEY }),
    ]
  },
})

/**
 * 목록 클라 필터 (순수) — suggestion 이 쓰고 spec 이 직접 검증한다.
 * 제목 부분일치·대소문자 무시. 빈 질의는 최근 순 상위 N개.
 */
export function filterMentionItems(
  items: StudyNoteMentionItem[],
  query: string,
  limit = 8,
): StudyNoteMentionItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, limit)
  return items.filter((i) => i.title.toLowerCase().includes(q)).slice(0, limit)
}
