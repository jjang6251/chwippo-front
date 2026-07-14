import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DemoModeProvider } from '@/contexts/DemoModeProvider'
import { AppShell } from '@/components/layout/AppShell'
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { DemoSignupModal } from '@/components/demo/DemoSignupModal'
import { LoginModal } from '@/components/demo/LoginModal'

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
        <DemoSignupModal />
        <LoginModal />
      </DemoModeProvider>
    </QueryClientProvider>
  )
}
