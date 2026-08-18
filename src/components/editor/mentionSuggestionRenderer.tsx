import { createRoot, type Root } from 'react-dom/client'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { MentionSuggestionList } from './MentionSuggestionList'
import type { StudyNoteMentionItem } from './StudyNoteMention'

/**
 * suggestion 팝오버의 mount/위치/키보드 처리.
 *
 * tippy 같은 포지셔닝 라이브러리를 안 쓴다 — 필요한 건 "캐럿 아래, 화면 밖으로 안 나가게"
 * 하나뿐이라 의존성을 하나 더 얹을 이유가 없다. `body` 에 직접 붙이는 이유는 에디터 툴바가
 * `overflow-x-auto` 라 그 안에 두면 잘리기 때문이다 (툴팁과 같은 이유).
 */

const GAP = 6
const MAX_WIDTH = 260

export function createMentionSuggestionRenderer(): SuggestionOptions<StudyNoteMentionItem>['render'] {
  return () => {
    let el: HTMLDivElement | null = null
    let root: Root | null = null
    let selected = 0
    let props: SuggestionProps<StudyNoteMentionItem> | null = null

    const pick = (index: number) => {
      const item = props?.items[index]
      if (item) props?.command(item)
    }

    const position = () => {
      if (!el || !props) return
      const rect = props.clientRect?.()
      if (!rect) return
      const width = Math.min(MAX_WIDTH, window.innerWidth - GAP * 2)
      let left = rect.left
      if (left + width > window.innerWidth - GAP) left = window.innerWidth - width - GAP
      if (left < GAP) left = GAP
      // 아래 공간이 부족하면 캐럿 위로 띄운다 (모바일 키보드가 아래를 다 먹는다)
      const below = window.innerHeight - rect.bottom
      el.style.width = `${width}px`
      el.style.left = `${left}px`
      if (below < 180) {
        el.style.top = ''
        el.style.bottom = `${window.innerHeight - rect.top + GAP}px`
      } else {
        el.style.bottom = ''
        el.style.top = `${rect.bottom + GAP}px`
      }
    }

    const paint = () => {
      if (!root || !props) return
      root.render(
        <MentionSuggestionList
          items={props.items}
          selected={selected}
          onPick={pick}
          onHover={(i) => {
            selected = i
            paint()
          }}
        />,
      )
      position()
    }

    const destroy = () => {
      root?.unmount()
      el?.remove()
      root = null
      el = null
      props = null
    }

    return {
      onStart: (p) => {
        props = p
        selected = 0
        el = document.createElement('div')
        el.dataset.testid = 'mention-suggestion'
        el.className =
          'fixed z-50 rounded-xl bg-surface-2 border border-line-strong shadow-lg overflow-hidden max-h-[260px] overflow-y-auto overscroll-contain'
        document.body.appendChild(el)
        root = createRoot(el)
        paint()
      },
      onUpdate: (p) => {
        props = p
        // 목록이 줄면 하이라이트가 밖으로 나간다 — 안으로 다시 당긴다
        if (selected >= p.items.length) selected = 0
        paint()
      },
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (!props) return false
        if (event.key === 'ArrowDown') {
          selected = props.items.length === 0 ? 0 : (selected + 1) % props.items.length
          paint()
          return true
        }
        if (event.key === 'ArrowUp') {
          selected =
            props.items.length === 0
              ? 0
              : (selected - 1 + props.items.length) % props.items.length
          paint()
          return true
        }
        if (event.key === 'Enter') {
          if (props.items.length === 0) return false
          pick(selected)
          return true
        }
        if (event.key === 'Escape') {
          destroy()
          return true
        }
        return false
      },
      onExit: destroy,
    }
  }
}
