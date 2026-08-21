import Image from '@tiptap/extension-image'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/**
 * study-note-media PR-A — 본문 이미지 노드 + 업로드 자리 표시.
 *
 * ## 🔴 src 는 http/https 만 노드가 된다
 *
 * 이미지는 **붙여넣은 마크다운**으로도 들어온다 (`![](…)`). 그 자리에 `data:` 나
 * `javascript:` 가 실려 오면 노드를 아예 만들지 않는다 — `getAttrs` 가 `false` 를 주면
 * 파서 규칙이 매칭에 실패하고, ProseMirror 는 그 `<img>` 를 통째로 건너뛴다.
 * 링크(`SAFE_LINK_OPTIONS`)가 위험 스킴 **거부 목록**을 쓰는 것과 달리 여기는 **허용
 * 목록**이다: 이미지 src 에 필요한 스킴은 우리 R2 도메인의 https 하나뿐이라 더 좁게 잡는다.
 *
 * ## 🔴 업로드 중 표시는 **문서가 아니라 데코레이션**이다
 *
 * 자리 표시를 노드로 만들면 그 노드가 doc 에 들어가고, 1.5초 자동 저장이 **업로드가 끝나기
 * 전에** 그걸 그대로 서버에 저장한다. 업로드 중 탭을 닫으면 노트에 영원히 안 끝나는
 * 스켈레톤이 남고, image 확장이 꺼진 소비처(준비·활동·메모)가 그 JSON 을 열면 스키마에
 * 없는 노드라 문서가 통째로 깨진다. 데코레이션은 doc 밖이라 저장에도, md 내보내기에도,
 * 「빈 노트」 판정에도 잡히지 않는다 (ProseMirror 공식 업로드 예제와 같은 구조).
 */

/** `![](…)` 로 들어온 외부 src 허용 판정 — 우리 R2 도 https 다 */
export function isSafeImageSrc(src: string | null | undefined): boolean {
  return typeof src === 'string' && /^https?:\/\//i.test(src.trim())
}

export const NoteImage = Image.extend({
  addAttributes() {
    return {
      // alt·title 은 부모 것을 그대로 — 마크다운 `![alt](src "title")` 왕복이 이 셋에 걸려 있다
      ...this.parent?.(),
      /**
       * 서버 `note_attachments` 행 id. 저장 reconcile 이 이 값으로 「아직 쓰이는 첨부」를
       * 세므로, 이게 비면 서버가 미참조로 보고 R2 객체를 지운다.
       * (md 로 수입된 외부 이미지는 우리 첨부가 아니라 null 이 정상이다.)
       */
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-attachment-id'),
        renderHTML: (attributes) =>
          attributes.attachmentId
            ? { 'data-attachment-id': attributes.attachmentId as string }
            : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) =>
          isSafeImageSrc((element as HTMLElement).getAttribute('src')) ? null : false,
      },
    ]
  },

  addProseMirrorPlugins() {
    return [uploadPlaceholderPlugin()]
  },
})

// ── 업로드 자리 표시 ─────────────────────────────────────────

const placeholderKey = new PluginKey<DecorationSet>('noteImageUploadPlaceholder')

type PlaceholderMeta = { add: { id: string; pos: number } } | { remove: string }

function uploadPlaceholderPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: placeholderKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        // 자리 표시는 사용자가 계속 타이핑하는 동안에도 제자리를 지켜야 한다 — 문서 변경을 따라 민다
        let next = set.map(tr.mapping, tr.doc)
        const meta = tr.getMeta(placeholderKey) as PlaceholderMeta | undefined
        if (meta && 'add' in meta) {
          const dom = document.createElement('span')
          dom.className = 'chw-image-uploading'
          dom.setAttribute('role', 'status')
          dom.setAttribute('aria-label', '이미지 올리는 중')
          next = next.add(tr.doc, [
            Decoration.widget(meta.add.pos, dom, { id: meta.add.id }),
          ])
        }
        if (meta && 'remove' in meta) {
          next = next.remove(
            next.find(undefined, undefined, (spec) => spec.id === meta.remove),
          )
        }
        return next
      },
    },
    props: {
      decorations: (state) => placeholderKey.getState(state) ?? DecorationSet.empty,
    },
  })
}

/** 업로드 시작 — 커서 자리에 스켈레톤을 띄운다 */
export function showImagePlaceholder(view: EditorView, id: string, pos: number): void {
  view.dispatch(view.state.tr.setMeta(placeholderKey, { add: { id, pos } }))
}

/** 실패·취소 — 자리 표시만 걷는다 (문서는 애초에 안 건드렸다) */
export function hideImagePlaceholder(view: EditorView, id: string): void {
  view.dispatch(view.state.tr.setMeta(placeholderKey, { remove: id }))
}

/**
 * 지금 그 자리 표시가 있는 위치. 사용자가 그 문단을 지웠으면 null —
 * 그때는 이미지를 **넣지 않는다** (지운 자리에 뒤늦게 튀어나오면 그게 더 놀랍다).
 */
export function imagePlaceholderPos(state: EditorState, id: string): number | null {
  const found = placeholderKey
    .getState(state)
    ?.find(undefined, undefined, (spec) => spec.id === id)
  return found && found.length > 0 ? found[0].from : null
}

/** 업로드 성공 — 자리 표시를 진짜 image 노드로 바꾼다. 자리가 사라졌으면 false */
export function replacePlaceholderWithImage(
  view: EditorView,
  id: string,
  attrs: { src: string; attachmentId: string },
): boolean {
  const pos = imagePlaceholderPos(view.state, id)
  if (pos === null) return false
  const type = view.state.schema.nodes.image
  if (!type) return false
  view.dispatch(
    view.state.tr
      .replaceWith(pos, pos, type.create(attrs))
      .setMeta(placeholderKey, { remove: id }),
  )
  return true
}
