import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * 사용자가 이 에디터와 **상호작용한 적이 있는가** — 커서 신뢰 판정용.
 *
 * 🔴 왜 필요한가 (2026-08-19 CEO 실기 "아래 삽입이 위에 넣는다"): 에디터를 한 번도
 * 안 만지면 커서 기본값이 **문서 시작**이라, 커서-블록 규칙이 첫 블록을 조용히 대상으로
 * 잡는다. [아래 삽입]은 그 첫 블록 아래(= 문서 위쪽)에 넣고, 사용자는 "위에 넣었다"고
 * 느낀다. 상호작용 전의 커서는 사용자 의도가 아니므로 대상 판정에서 제외한다.
 *
 * 판정 신호 = 첫 `selectionUpdate` (클릭·키 이동·프로그램적 선택 전부 발화. 마운트
 * 초기 상태는 발화하지 않는다 — 실측). 에디터 인스턴스가 바뀌면(시트 전환) 리셋.
 */
export function useEditorInteracted(editor: Editor): boolean {
  const [state, setState] = useState<{ editor: Editor; interacted: boolean }>({
    editor,
    interacted: false,
  })

  useEffect(() => {
    const mark = () => {
      setState((prev) =>
        prev.editor === editor && prev.interacted ? prev : { editor, interacted: true },
      )
    }
    editor.on('selectionUpdate', mark)
    return () => {
      editor.off('selectionUpdate', mark)
    }
  }, [editor])

  // 에디터가 바뀌었는데 아직 새 신호가 없으면 리셋된 값으로 읽는다 (렌더 중 파생 — effect 불필요)
  return state.editor === editor ? state.interacted : false
}
