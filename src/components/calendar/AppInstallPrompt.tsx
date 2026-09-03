import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { useDemoMode } from '@/contexts/demoMode'
import { detectMobileOS, isNativeApp, storeUrlFor } from '@/lib/appStores'

/**
 * 캘린더 홈(로그인) 1회성 앱 유도 배너.
 *
 * 마감 알림의 실체는 **푸시**인데, 모바일 웹으로 쓰는 사람에겐 그 통로가 없다.
 * 하루의 시작점(캘린더)에서 한 번만 알린다 — `TodayBriefingBanner` 와 같은 자리·같은 모양.
 *
 * 🔴 **닫으면 영구다.** 앱을 안 깔기로 한 사람에게 매번 같은 말을 걸면 그건 광고다.
 * 랜딩 배너(14일)와 달리 여기선 되살리지 않는다 — 이미 로그인해서 쓰고 있는 사람이라
 * 「몰라서 못 깐 것」이 아니다.
 *
 * 데스크탑·네이티브 앱 안에서는 **렌더 자체를 안 한다** (앱 안에서 앱을 받으라고 할 수 없다).
 */

/** 값은 '1' 고정 · 영구 (랜딩 배너의 `-dismissed-at` 과 달리 시각을 안 남긴다) */
const DISMISS_KEY = 'chwippo:app-prompt-dismissed'

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* 저장 실패는 무시 — 이번 화면에서 사라지는 것까지는 보장된다 */
  }
}

export function AppInstallPrompt() {
  const isDemo = useDemoMode()
  const [visible, setVisible] = useState(() => !isDismissed())
  const os = detectMobileOS()
  const href = storeUrlFor(os)

  if (isDemo || !visible || !href || isNativeApp()) return null

  const storeName = os === 'ios' ? 'App Store' : 'Google Play'

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 mb-5">
      <span
        className="shrink-0 w-8 h-8 rounded-lg bg-card flex items-center justify-center text-text-secondary"
        aria-hidden
      >
        <Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold text-text-primary break-keep">
        마감 알림은 앱이 확실해요
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${storeName} 에서 치뽀 앱 받기`}
        className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-lg bg-brand hover:bg-accent active:bg-accent-hover text-bg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        앱 받기
      </a>
      <button
        type="button"
        onClick={() => {
          rememberDismiss()
          setVisible(false)
        }}
        aria-label="앱 안내 닫기"
        className="shrink-0 w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-lg leading-none text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        ×
      </button>
    </div>
  )
}
