import { useLayoutEffect, type ReactNode } from 'react'
import { apiClient } from '@/api/client'
import { demoAdapter } from '@/demo/demoAdapter'
import { resetDemoStore } from '@/demo/demoStore'
import { DemoModeContextProvider } from './demoMode'

// 모듈 로드 시점의 진짜 기본 어댑터 — 데모를 떠날 때 이걸로 복구
const ORIGINAL_ADAPTER = apiClient.defaults.adapter

export function DemoModeProvider({ children }: { children: ReactNode }) {
  // 레이아웃 이펙트는 자식의 데이터 쿼리(패시브 이펙트)보다 먼저 실행되므로,
  // 여기서 어댑터를 갈아끼우면 데모 화면의 첫 요청부터 샘플 데이터로 응답된다.
  useLayoutEffect(() => {
    // 데모 재진입 시 인메모리 mutation 상태를 초기 샘플로 되돌린다 (새로고침과 동일한 첫인상).
    resetDemoStore()
    apiClient.defaults.adapter = demoAdapter
    return () => {
      apiClient.defaults.adapter = ORIGINAL_ADAPTER
    }
  }, [])
  return <DemoModeContextProvider value>{children}</DemoModeContextProvider>
}
