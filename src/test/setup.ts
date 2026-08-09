import '@testing-library/jest-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

// 프로덕션(main.tsx)과 동일한 dayjs locale — 테스트에서도 요일·월 한글 (요일 포맷 회귀 방어)
dayjs.locale('ko')

/**
 * 🔴 jsdom 에는 `ResizeObserver` 가 없다 (2026-08-09).
 *
 * 랜딩이 제품 화면을 **축소해서** 보여주는데(`ScaledPreview`), `transform: scale` 은
 * 레이아웃 높이를 바꾸지 않아 안쪽 높이를 재서 액자 높이를 잡아야 한다.
 * 그 관찰자가 없으면 랜딩 렌더가 통째로 죽는다 — 실제로 spec 13개가 한 번에 터졌다.
 *
 * 컴포넌트를 테스트용으로 비틀지 않고 **환경을 채운다.** jsdom 은 레이아웃을 계산하지
 * 않으므로 높이는 0 이고, 그래서 콜백은 등록만 해두고 호출하지 않는다.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
