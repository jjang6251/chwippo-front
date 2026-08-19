import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * note-ai-panel — **AI 대상 하이라이트**.
 *
 * 패널이 잡은 범위(선택을 최상위 블록으로 확장한 것 — `aiSelection.expandToBlockRange`)를
 * 본문에 칠해 둔다. 패널 입력창으로 포커스가 넘어가면 브라우저 선택 표시는 사라지는데,
 * 그러면 "무엇을 대상으로 요청하는 중인지" 가 화면에서 통째로 없어진다.
 *
 * 🔴 **문서를 바꾸지 않는다.** 하이라이트는 ProseMirror **데코레이션**이라 doc JSON 에
 * 아무것도 남지 않는다. 그래서
 *   - 자동 저장(1.5s debounce)이 깨어나지 않는다 — tiptap 은 `docChanged` 일 때만 `update`
 *     를 쏘는데, 우리 트랜잭션은 meta 만 실어 스텝이 0개다
 *   - undo 스택도 안 건드린다 (되돌리기가 "하이라이트 켜기" 를 먹지 않는다)
 *   - 내보내기·마크다운 직렬화에도 안 나타난다
 * 형광펜(mark)으로 구현하면 이 넷이 전부 반대가 된다 — 그래서 데코레이션이다.
 *
 * 범위는 **편집을 따라 밀린다**(`map`). 요청 뒤 사용자가 위쪽을 고쳐도 하이라이트가 원래
 * 문단에 붙어 있고, 대상이 통째로 지워지면 하이라이트도 같이 사라진다 — 패널은 그걸
 * [교체] 버튼 활성 판정에 쓸 수 있다(`getAiTargetRange`).
 *
 * 스타일은 클래스만 붙인다 — 실제 색은 `index.css` 의 `.chw-ai-target` (다크·라이트 두 벌).
 */

export interface AiTargetRange {
  from: number
  to: number
}

/** 데코 클래스 — 색은 index.css 가 들고 있다 (다크/라이트 두 벌) */
export const AI_TARGET_CLASS = 'chw-ai-target'

const aiTargetPluginKey = new PluginKey<DecorationSet>('aiTargetHighlight')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiTargetHighlight: {
      /** 지정 범위를 AI 대상으로 칠한다 (기존 대상은 대체). 빈 범위면 지운 것과 같다 */
      setAiTarget: (range: AiTargetRange) => ReturnType
      /** 하이라이트 해제 */
      clearAiTarget: () => ReturnType
    }
  }
}

export const AiTargetHighlight = Extension.create({
  name: 'aiTargetHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiTargetPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            // meta 미지정 = 평범한 편집 → 기존 데코를 문서 변화에 맞춰 밀어 준다
            const meta = tr.getMeta(aiTargetPluginKey) as AiTargetRange | null | undefined
            if (meta === undefined) return value.map(tr.mapping, tr.doc)
            if (meta === null) return DecorationSet.empty

            // 빈·역방향 범위는 칠할 게 없다 (Decoration.inline 이 그런 범위를 허용하지 않는다)
            if (meta.from >= meta.to) return DecorationSet.empty
            const from = Math.max(0, Math.min(meta.from, tr.doc.content.size))
            const to = Math.max(from, Math.min(meta.to, tr.doc.content.size))
            if (from >= to) return DecorationSet.empty

            return DecorationSet.create(tr.doc, [
              Decoration.inline(from, to, { class: AI_TARGET_CLASS }),
            ])
          },
        },
        props: {
          decorations(state) {
            return aiTargetPluginKey.getState(state)
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setAiTarget:
        (range: AiTargetRange) =>
        ({ tr, dispatch }) => {
          // 스텝이 없는 meta 전용 트랜잭션 — docChanged=false 라 저장·undo 경로를 안 깨운다
          if (dispatch) dispatch(tr.setMeta(aiTargetPluginKey, range))
          return true
        },
      clearAiTarget:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(aiTargetPluginKey, null))
          return true
        },
    }
  },
})

/**
 * 현재 하이라이트 범위 — **편집을 따라 갱신된 값**이다.
 *
 * 패널이 [교체] 를 누를 때 쓰는 좌표는 요청 시점에 들고 있던 from/to 가 아니라 이것이어야
 * 한다. 요청 뒤 사용자가 위쪽 문단을 고쳤으면 원래 좌표는 이미 다른 곳을 가리킨다.
 * 대상이 통째로 지워졌으면 `null`.
 */
export function getAiTargetRange(editor: Editor): AiTargetRange | null {
  const set = aiTargetPluginKey.getState(editor.state)
  const [decoration] = set?.find() ?? []
  return decoration ? { from: decoration.from, to: decoration.to } : null
}
