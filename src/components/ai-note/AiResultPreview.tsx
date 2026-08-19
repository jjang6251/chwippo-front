import { EditorContent, useEditor } from '@tiptap/react'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'

/**
 * 결과 미리보기 — **읽기 전용 미니 에디터**.
 *
 * 🔴 왜 평문이 아닌가 — 「표로 정리」·「토글 문답」의 결과는 모양이 곧 값이다. 마크다운
 * 원문을 그대로 보여 주면 `| --- |` 같은 파이프 줄을 읽어야 하고, 그러면 사용자는
 * 적용해 보기 전에는 맞는지 알 수 없다. 본문과 **같은 확장 세트**로 렌더해서
 * 적용 후 모습을 그대로 보여 준다.
 *
 * 🔴 `content` 에 **문자열**을 넘기는 게 핵심이다 — Markdown 확장이 문자열을 마크다운으로
 * 읽는다(`RichTextEditor` 가 반대로 이 성질 때문에 미리 doc 으로 고정하는 그 지점).
 * 여기서는 그 성질이 그대로 필요한 유일한 자리다.
 *
 * `editable: false` 지만 토글은 열고 닫힌다(Details 는 편집 가능 여부와 무관) —
 * 문답 결과를 프리뷰에서 바로 접었다 펴 볼 수 있다.
 */
export function AiResultPreview({
  markdown,
  docContent,
}: {
  markdown: string
  /** qa_toggle 후처리 결과 — md 로 표현 못 하는 토글을 실모양으로 보여줄 때만 지정 */
  docContent?: object
}) {
  const editor = useEditor(
    {
      extensions: buildEditorExtensions({ placeholder: '' }),
      content: docContent ?? markdown,
      editable: false,
      editorProps: {
        attributes: {
          class: 'chw-prose focus:outline-none px-3 py-2.5 text-text-primary leading-relaxed',
        },
      },
    },
    [markdown, docContent],
  )

  // 🔴 overscroll 은 가로축만 — 세로까지 contain 하면 프리뷰 위에서 패널 휠이 통째로
  //    먹힌다 (2026-08-19 CEO 실기 — 시트 탭 줄과 동일 병). 넓은 표의 가로 새기만 막는다
  return (
    <div className="rounded-lg border border-line bg-surface-2 overflow-x-auto overscroll-x-contain">
      <EditorContent editor={editor} />
    </div>
  )
}
