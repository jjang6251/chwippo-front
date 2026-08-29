import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DemoModeProvider } from '@/contexts/DemoModeProvider'
import { AppShell } from '@/components/layout/AppShell'
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { DemoSignupModal } from '@/components/demo/DemoSignupModal'
import { LoginModal } from '@/components/demo/LoginModal'
import { PostingCardHost } from '@/components/board/PostingCardHost'

// 데모 라우트는 별도 QueryClient — 데모를 떠나도 모킹된 데이터가 본앱 캐시에 안 남게
const demoQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

export function DemoShell() {
  return (
    <QueryClientProvider client={demoQueryClient}>
      <DemoModeProvider>
        <RouteErrorBoundary>
          <AppShell />
        </RouteErrorBoundary>
        {/*
          🔴 **공고 카드 뒤처리는 스코프마다 하나씩** — 이 안의 호스트는 위 `demoQueryClient`
          를 쓴다. App 레벨 호스트 하나로 두면 데모에서 만든 카드를 **앱 클라이언트**에 심어
          보드에 안 나타나고, 시트도 앱 목록에서 못 찾아 즉시 닫힌다 (2026-08-29 실측).
          두 호스트는 `useDemoMode()` 로 자기 스코프를 알고 자기 것만 꺼낸다.
        */}
        <PostingCardHost />
        <DemoSignupModal />
        <LoginModal />
      </DemoModeProvider>
    </QueryClientProvider>
  )
}
