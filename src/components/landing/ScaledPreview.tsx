import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 실제 제품 화면을 **랜딩 칸에 꽉 차게 축소해서** 보여주는 액자.
 *
 * 🔴 **왜 스크린샷이 아닌가** (2026-08-09). 이미지는 UI 가 바뀌면 조용히 낡고 다크 모드에
 * 박제된다. 실제 컴포넌트를 쓰면 그 어긋남이 원리적으로 안 생기고 라이트/다크를 따라간다.
 * 다만 제품 컴포넌트는 **페이지 폭(1100px 등)에 맞춰 설계**돼 있어, 랜딩 칸에 그대로 넣으면
 * 글씨만 크고 화면 조각처럼 안 보인다. 그래서 **원래 폭으로 그린 뒤 통째로 줄인다.**
 *
 * 🔴 **배율은 손으로 정하지 않는다.** 처음엔 `scale` 을 인자로 받았는데, 액자 바깥 div 는
 * 부모 폭까지 늘어나는 반면 안쪽은 `width × scale` 이라 **오른쪽에 빈 공간이 남았다**
 * (1080×0.62 = 670px 를 1000px 칸에 넣어 330px 가 비었다). 컨테이너 폭을 재서
 * `scale = 컨테이너 / width` 로 잡으면 **항상 정확히 꽉 찬다** — 섹션 폭이 바뀌어도 따라온다.
 *
 * 🔴 **`transform: scale` 은 레이아웃 높이를 바꾸지 않는다.** 그냥 쓰면 축소된 만큼
 * 아래에 빈 공간이 남는다. 그래서 안쪽 실제 높이(`offsetHeight`)를 재서 액자 높이를 잡는다.
 * (CSS `zoom` 은 한 줄이면 되지만 브라우저별 상속·중첩 동작이 갈려 쓰지 않는다.)
 *
 * 🔴 **`inert`** — 이 안의 카드는 진짜 컴포넌트다. 처음엔 `pointer-events-none` + `aria-hidden`
 * 으로 막았는데, **`pointer-events` 는 키보드를 막지 않는다.** 실측 결과 `aria-hidden` 안에
 * 포커스 가능한 요소가 **75개** 였고, Tab 으로 들어가 Enter 를 누르면 단계변경 mutation 이나
 * `/board/hero-1` 라우팅이 실제로 발동됐다. `aria-hidden` + 포커스 가능은 **WCAG 4.1.2 위반**이다.
 *
 * `inert` 는 클릭·포커스·보조기기 노출을 한 번에 막는다 (React 19 지원).
 */
interface Props {
  /** 컴포넌트를 그릴 원래 폭(px) — 제품에서 그 화면이 갖는 폭 */
  width: number
  /**
   * 확대 상한. 칸이 원래 폭보다 넓어도 이 이상 키우지 않는다 —
   * 실제보다 커지면 제품 화면이 아니라 확대경처럼 보인다.
   */
  maxScale?: number
  /** 액자 위 라벨 — 어떤 화면인지 */
  label?: string
  children: ReactNode
}

export function ScaledPreview({ width, maxScale = 1, label, children }: Props) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number>()
  const [innerH, setInnerH] = useState<number>()

  useEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      // 🔴 **부모 폭**을 잰다 — 액자 자신의 폭은 아래에서 `width × scale` 로 정해지므로
      //    자기 폭을 재면 배율이 자기 자신을 참조해 값이 수렴하지 않는다.
      const w = o.parentElement?.clientWidth ?? o.clientWidth
      if (w > 0) setScale(Math.min(w / width, maxScale))
      setInnerH(i.offsetHeight)
    }
    measure()
    // 창 크기·폰트 로드로 둘 다 바뀔 수 있어 양쪽을 관찰한다
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [width, maxScale])

  return (
    <div>
      {label && <p className="text-xs text-text-quaternary mb-2">{label}</p>}
      {/*
        🔴 **액자 폭도 내용에 맞춘다** (2026-08-09). 바깥 div 는 부모 폭까지 늘어나는데
        `scale` 이 `maxScale` 에서 잘리면 내용은 그보다 좁아 **오른쪽이 빈다.**
        폭을 `width × scale` 로 못 박고 가운데 정렬하면, 칸이 넓어도 액자가 내용만큼만
        차지한다 — 태블릿에서 모바일 구성을 그대로 쓸 수 있는 이유이기도 하다.
      */}
      <div
        ref={outer}
        className="overflow-hidden rounded-xl border border-line bg-surface-2 select-none mx-auto"
        inert
        style={{
          height: scale && innerH ? innerH * scale : undefined,
          width: scale ? width * scale : undefined,
          maxWidth: '100%',
        }}
      >
        <div
          ref={inner}
          style={{
            width,
            transform: scale ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            // 배율을 재기 전엔 원래 폭이 액자를 밀어내므로 잠깐 숨긴다 (첫 프레임 깜빡임 방지)
            visibility: scale ? undefined : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
