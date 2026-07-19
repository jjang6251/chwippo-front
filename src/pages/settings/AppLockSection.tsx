import { useEffect, useState } from 'react'
import { useNativeMode } from '@/hooks/useNativeMode'
import { postToNative } from '@/utils/nativeBridge'
import { Toggle } from '@/components/common/Toggle'

/**
 * ① 앱 잠금 (Face ID / Touch ID) — 네이티브 전용 설정 섹션.
 *
 * WebView(치뽀 앱) 안 + 생체 인증 지원 기기에서만 노출.
 * 웹 브라우저이거나 미지원 기기면 섹션 자체를 렌더하지 않음.
 *
 * ## 브릿지
 *   - 마운트 시 `get-app-lock` 전송 → native 가 `chwippo:app-lock-state`
 *     CustomEvent 로 { supported, enabled } 회신.
 *   - 토글 시 `set-app-lock` 전송 (낙관적 UI) → native 가 저장 후 상태 재회신.
 *
 * 잠금 설정은 기기 단위 (AsyncStorage). 실제 잠금 화면·인증은 앱이 담당.
 */

interface AppLockState {
  supported: boolean
  enabled: boolean
}

export function AppLockSection() {
  const isNative = useNativeMode()
  const [state, setState] = useState<AppLockState | null>(null)

  useEffect(() => {
    if (!isNative) return

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<AppLockState> | undefined
      if (
        detail &&
        typeof detail.supported === 'boolean' &&
        typeof detail.enabled === 'boolean'
      ) {
        setState({ supported: detail.supported, enabled: detail.enabled })
      }
    }

    window.addEventListener('chwippo:app-lock-state', handler)
    postToNative({ type: 'get-app-lock' })
    return () => window.removeEventListener('chwippo:app-lock-state', handler)
  }, [isNative])

  // 웹 · 상태 미수신 · 미지원 기기 → 섹션 미렌더
  if (!isNative || !state || !state.supported) return null

  const toggle = (next: boolean) => {
    setState((s) => (s ? { ...s, enabled: next } : s)) // 낙관적 반영
    postToNative({ type: 'set-app-lock', enabled: next })
  }

  return (
    <section className="bg-surface-2 border border-line rounded-xl mb-4 px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-xl w-7 text-center" aria-hidden>
            🔒
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">앱 잠금</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              앱을 열 때 Face ID · Touch ID로 잠금을 해제해요.
            </p>
          </div>
        </div>
        <Toggle checked={state.enabled} onChange={toggle} label="앱 잠금" />
      </div>
    </section>
  )
}
