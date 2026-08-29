import { useEffect, useState } from 'react'

/**
 * 글자 단위 타이핑 — 「AI 가 **써 나가는**」 장면의 엔진.
 *
 * ## 왜 줄 단위가 아니라 글자 단위인가
 *
 * v2 는 줄을 통째로 `fadeInUp` 으로 띄웠다. 그러면 「나타났다」이지 「쓰여진다」가 아니다.
 * CEO 2차 실기의 「4장이 너무 빠르다」는 속도 문제이면서 동시에 **읽을 틈 없이 완성본이
 * 튀어나오는** 문제였다. 글자가 흘러나오면 눈이 자연스럽게 따라 읽는다.
 *
 * ## 🔴 한 틱에 두 글자씩 옮긴다
 *
 * 그대로 타이머로 만들면 200자 문장에 **200번 리렌더**가 난다. 두 배 간격으로 두 글자를
 * 옮기면 눈에 보이는 속도는 같고 리렌더는 절반이다 (한글은 자소가 아니라 음절 단위라
 * 두 글자씩 나가도 「뚝뚝 끊긴다」가 보이지 않는다).
 *
 * 🔴 **12ms/자** — 40ms 는 198자에 8초가 걸려 「나오는 게 느리다」는 판정을 받았다 (CEO 실기).
 * 12ms 면 2.4초라 「AI 가 써 내려간다」는 인상은 남기면서 기다리게 하지 않는다.
 *
 * `paused` 면 멈추고, `instant` 면 전문을 즉시 보여준다(`prefers-reduced-motion` 수동 모드).
 */
export const TYPE_MS_PER_CHAR = 12
const CHARS_PER_TICK = 2
const TICK_MS = TYPE_MS_PER_CHAR * CHARS_PER_TICK

export interface TypewriterState {
  /** 지금까지 쓰인 만큼 잘린 줄들 — 아직 시작 안 한 줄은 빈 문자열 */
  lines: string[]
  /** 커서를 붙일 줄 (아직 쓰는 중인 줄). 다 썼으면 `-1` */
  activeLine: number
  done: boolean
}

/** 여러 줄을 이어서 친다 — 줄 사이에 끊김 없이 하나의 글로 읽힌다 */
export function useTypewriter(
  lines: readonly string[],
  opts: { paused?: boolean; instant?: boolean; startDelayMs?: number } = {},
): TypewriterState {
  const { paused = false, instant = false, startDelayMs = 0 } = opts
  const total = lines.reduce((sum, l) => sum + l.length, 0)
  const [typed, setTyped] = useState(0)

  /* 🔴 `instant` 를 effect 의 setState 로 처리하지 않는다 — 렌더가 한 번 더 돌고(cascading
     render) 그 사이 한 프레임 동안 빈 화면이 보인다. 파생값으로 둔다. */
  const count = instant ? total : Math.min(typed, total)

  useEffect(() => {
    if (instant || paused || count >= total) return
    const delay = count === 0 ? startDelayMs + TICK_MS : TICK_MS
    const t = window.setTimeout(() => setTyped((c) => c + CHARS_PER_TICK), delay)
    return () => window.clearTimeout(t)
  }, [count, total, paused, instant, startDelayMs])

  return { ...sliceLines(lines, count), done: count >= total }
}

/**
 * 지금까지 쓰인 글자 수만큼 줄들을 자른다.
 *
 * 🔴 **모듈 함수로 뺀 이유** — 렌더 중에 `.map()` 콜백 안에서 바깥 변수를 갱신하면
 * React 컴파일러 규칙(`Cannot reassign variable after render completes`)에 걸린다.
 * 순수 함수 안의 지역 변수는 렌더 밖으로 새지 않으므로 안전하고, 덤으로 단위 테스트가 쉽다.
 */
function sliceLines(
  lines: readonly string[],
  count: number,
): { lines: string[]; activeLine: number } {
  const out: string[] = []
  let remaining = count
  let activeLine = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (remaining <= 0) {
      out.push('')
    } else if (remaining >= line.length) {
      out.push(line)
      remaining -= line.length
    } else {
      out.push(line.slice(0, remaining))
      activeLine = i
      remaining = 0
    }
  }
  return { lines: out, activeLine }
}

/** 타이핑에 걸리는 시간 — 장면 길이 계산에 쓴다 (`scenePhases`) */
export function typingDurationMs(lines: readonly string[]): number {
  return lines.reduce((sum, l) => sum + l.length, 0) * TYPE_MS_PER_CHAR
}
