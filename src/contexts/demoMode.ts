import { createContext, useContext } from 'react'

const DemoModeContext = createContext(false)

/** `/demo/*` 라우트 안에서만 true. AppShell·Sidebar·MobileNav가 nav 링크를 `/demo/*`로 프리픽스하는 데 씀. */
export const useDemoMode = () => useContext(DemoModeContext)

export const DemoModeContextProvider = DemoModeContext.Provider
