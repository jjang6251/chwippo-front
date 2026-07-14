import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 라우트 단위 에러 경계 — 섹션 하나의 렌더 크래시가 페이지 전체를 백지로 만들지 않게 막는다.
 * React 19 에도 클래스 컴포넌트가 에러 경계의 유일한 방법이라 여기서만 예외적으로 사용.
 * 정상 동작에는 영향 없음 — 자식이 throw 할 때만 fallback 이 렌더된다.
 */
interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RouteErrorBoundary] 화면 렌더 실패:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="bg-surface-2 border border-line rounded-xl p-6 text-center max-w-sm">
          <p className="text-text-primary text-sm font-semibold mb-1">
            화면을 불러오지 못했어요
          </p>
          <p className="text-text-tertiary text-xs mb-4 leading-relaxed">
            잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand text-white text-xs font-medium px-3 py-1.5 rounded-md"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }
}
