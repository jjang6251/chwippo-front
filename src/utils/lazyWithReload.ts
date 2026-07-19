import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'chwippo:chunk-reload'

/**
 * 라우트 code-split 용 lazy 래퍼 — 배포 직후 stale 해시 방어 1층.
 *
 * 새 빌드가 배포되면 구 index.html 이 참조하던 청크 해시가 사라져서 lazy import 가
 * 404 로 실패할 수 있다(사용자가 오래 열어둔 탭). 이때 새 빌드를 받도록 1회 자동 새로고침한다.
 * 무한 루프 방지를 위해 sessionStorage 플래그로 딱 1회만 시도하고, 재시도 후에도 실패하면
 * 그대로 throw → 상위 RouteErrorBoundary 가 잡아 "다시 시도" 카드를 보여준다.
 */
export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory()
      // 성공적으로 로드되면 다음 실패에 대비해 플래그 해제
      sessionStorage.removeItem(RELOAD_KEY)
      return mod
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
        // reload 진행 중 — Suspense fallback 이 유지되도록 resolve 되지 않는 promise 반환
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}
