/**
 * 랜딩 미리보기 액자 — **배율·높이·차단** 세 가지가 계약이다.
 *
 * 🔴 이 컴포넌트는 랜딩이 **제품 화면을 실물로** 보여주려고 만들었다. 스크린샷은 UI 가 바뀌면
 * 조용히 낡고 다크 모드에 박제되는데, 실물은 그 어긋남이 원리적으로 안 생긴다.
 * 대신 제품 컴포넌트는 페이지 폭(1100px 등)에 맞춰져 있어 **통째로 줄여야** 화면 조각처럼 보인다.
 *
 * 세 가지가 실제로 지켜지는지 여기서 잠근다:
 *  1. 배율을 **손으로 안 정한다** — 칸 폭에서 계산해 꽉 찬다 (오른쪽이 비지 않는다)
 *  2. `transform: scale` 은 레이아웃 높이를 안 바꾸므로 **액자 높이를 직접 잡는다**
 *  3. `inert` — 안의 카드는 진짜 컴포넌트라 눌리거나 포커스되면 mutation 이 나간다
 *
 * jsdom 은 레이아웃을 계산하지 않아 `clientWidth`/`offsetHeight` 가 0 이다.
 * 실제 배율 값은 브라우저에서만 의미가 있으므로, 여기서는 **폭을 강제로 주입해** 계산식만 검증한다.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScaledPreview } from './ScaledPreview'

/** jsdom 은 레이아웃이 없다 — 부모 폭과 내용 높이를 직접 심는다 */
function withLayout(parentWidth: number, innerHeight: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return parentWidth
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return innerHeight
    },
  })
}

describe('ScaledPreview', () => {
  /**
   * 🔴 **배율을 손으로 정하면 칸이 빈다.** 처음엔 `scale` 을 인자로 받았는데
   * 액자 바깥은 부모 폭까지 늘어나고 안쪽은 `width × scale` 이라
   * **1080×0.62 = 670px 를 976px 칸에 넣어 306px 가 비었다.**
   */
  it('🔴 배율을 칸 폭에서 계산해 꽉 채운다', () => {
    withLayout(500, 400)
    const { container } = render(
      <ScaledPreview width={1000}>
        <div>내용</div>
      </ScaledPreview>,
    )
    const inner = container.querySelector('[style*="scale"]') as HTMLElement
    // 500 / 1000 = 0.5
    expect(inner.style.transform).toBe('scale(0.5)')
  })

  /**
   * 🔴 **실제보다 키우지 않는다.** 칸이 원본보다 넓어도 확대하면 제품 화면이 아니라
   * 확대경처럼 보인다. 대신 액자 폭이 내용에 맞춰 줄고 가운데 놓인다.
   */
  it('🔴 칸이 더 넓어도 maxScale 을 넘지 않는다', () => {
    withLayout(2000, 400)
    const { container } = render(
      <ScaledPreview width={1000}>
        <div>내용</div>
      </ScaledPreview>,
    )
    const inner = container.querySelector('[style*="scale"]') as HTMLElement
    expect(inner.style.transform).toBe('scale(1)')
  })

  /**
   * 🔴 `transform: scale` 은 **레이아웃 높이를 바꾸지 않는다.** 그냥 쓰면 축소된 만큼
   * 아래에 빈 공간이 남는다. 안쪽 실제 높이 × 배율을 액자 높이로 잡아야 한다.
   */
  it('🔴 액자 높이 = 내용 높이 × 배율', () => {
    withLayout(500, 400)
    const { container } = render(
      <ScaledPreview width={1000}>
        <div>내용</div>
      </ScaledPreview>,
    )
    const frame = container.querySelector('[inert]') as HTMLElement
    expect(frame.style.height).toBe('200px') // 400 × 0.5
    expect(frame.style.width).toBe('500px') // 1000 × 0.5
  })

  /**
   * 🔴 **`pointer-events-none` 은 키보드를 막지 않는다.** 실측 결과 `aria-hidden` 안에
   * 포커스 가능한 요소가 75개였고, Tab→Enter 로 단계변경 mutation 이 실제로 발동됐다.
   * `aria-hidden` + 포커스 가능은 WCAG 4.1.2 위반이기도 하다. `inert` 가 셋 다 막는다.
   */
  it('🔴 액자가 inert 다 (클릭·포커스·보조기기 차단)', () => {
    withLayout(500, 400)
    const { container } = render(
      <ScaledPreview width={1000}>
        <button>누르면 안 되는 버튼</button>
      </ScaledPreview>,
    )
    const btn = container.querySelector('button')!
    expect(btn.closest('[inert]'), 'inert 래퍼 없음').toBeTruthy()
  })

  it('라벨을 주면 액자 위에 표시한다', () => {
    withLayout(500, 400)
    const { getByText } = render(
      <ScaledPreview width={1000} label="자소서 탭">
        <div>내용</div>
      </ScaledPreview>,
    )
    expect(getByText('자소서 탭')).toBeTruthy()
  })
})
