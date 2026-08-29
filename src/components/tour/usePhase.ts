import { useEffect, useState } from 'react'

/**
 * 장면 안의 **연출 단계 진행기** — 자소서·면접·노트 장면이 「과정을 재생」하는 엔진.
 *
 * CSS `animation-delay` 로는 못 하는 것들이 있어서 필요하다:
 * - 문항 1이 **접히고** 문항 2가 열린다 (요소가 사라졌다 나타난다)
 * - 타이머 숫자가 00:00 → 00:12 로 **올라간다**
 * - 체크박스가 **체크된다**
 *
 * ## 세 가지를 지킨다
 *
 * 1. 🔴 **일시정지를 존중한다** — 길게 누르거나 탭이 백그라운드로 가면 멈춘다.
 *    (CSS 애니메이션은 `animation-play-state` 로 따로 멈춘다.)
 * 2. 🔴 **`instant` 면 마지막 단계로 즉시 간다** — `prefers-reduced-motion` 수동 모드에서
 *    「완성 상태」를 보여줘야 한다. 연출을 빨리 감는 게 아니라 **아예 하지 않는다.**
 * 3. 남은 단계가 없으면 타이머를 걸지 않는다 (마운트된 채 도는 타이머 0개).
 *
 * ⚠️ 일시정지 후 재개하면 **그 단계의 지연이 처음부터** 다시 흐른다. 프레임 단위 정확도가
 * 필요한 자리가 아니고(사람이 손가락을 떼는 순간이다), 남은 시간을 추적하면 코드가 두 배가
 * 된다 — 재생 전체의 시계는 `Tour` 가 별도로(정확하게) 들고 있다.
 */
export function usePhase(
  /** 단계 수 (0 … count-1) */
  count: number,
  /** 단계당 지연(ms). 배열이면 단계별로 다르게 — `steps[i]` = i 에서 i+1 로 가는 시간 */
  stepMs: number | number[],
  opts: { paused?: boolean; instant?: boolean } = {},
): number {
  const { paused = false, instant = false } = opts
  const [ticked, setTicked] = useState(0)

  /* 🔴 `instant` 를 **effect 에서 setState 로** 처리하지 않는다 — 렌더 → effect → 렌더가
     한 번 더 도는 데다(cascading render), 그 사이 한 프레임 동안 연출이 시작된 모습이
     보인다. 모션을 줄여 달라는 사람에게 정확히 보여주면 안 되는 프레임이다. 파생값으로 둔다. */
  const phase = instant ? count - 1 : Math.min(ticked, count - 1)

  useEffect(() => {
    if (instant || paused || phase >= count - 1) return
    const delay = Array.isArray(stepMs) ? (stepMs[phase] ?? 0) : stepMs
    const t = window.setTimeout(() => setTicked((p) => p + 1), delay)
    return () => window.clearTimeout(t)
    // stepMs 가 배열 리터럴이면 매 렌더 새 참조라 의존성에 넣으면 타이머가 계속 재시작한다.
    // 호출부는 모듈 상수로 넘긴다 (`scenePhases.ts`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, instant, count])

  return phase
}
