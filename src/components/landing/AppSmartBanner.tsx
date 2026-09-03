import { useState } from 'react'
import {
  detectMobileOS,
  isConfirmedNonSafariIos,
  isNativeApp,
  storeUrlFor,
} from '@/lib/appStores'

/**
 * 랜딩 최상단 커스텀 스마트 배너 — 앱 존재를 헤더보다 먼저 알린다.
 *
 * 안드로이드가 Play 에 올라간 뒤(2026-09-04) 랜딩에서 앱으로 가는 길이 **하단 섹션 하나**뿐이었다.
 * 애플의 스마트 배너(`index.html` 의 `apple-itunes-app`)는 **iOS 사파리 전용**이라
 * 안드로이드 크롬·카카오 인앱 브라우저 방문자에겐 애초에 뜨지 않는다. 그 빈자리만 채운다.
 *
 * 🔴 **애플 배너와 겹치지 않는 게 설계 목표다.** iOS 는 비사파리임이 UA 로 확정될 때만 띄우고
 * (`isConfirmedNonSafariIos`), 마커가 없으면 사파리로 간주해 접는다 — 판정 실패가
 * 「이중 배너」가 아니라 「배너 없음」으로 떨어지도록 방향을 고정했다.
 *
 * 🔴 **sticky 가 아니다.** 애플 배너와 같은 정보 구조(아이콘·이름·한 줄 설명·받기·닫기)를
 * 쓰되, 스크롤과 함께 흘러가게 둔다. 랜딩 헤더가 이미 `sticky` 라 둘 다 붙으면 첫 화면의
 * 세로를 두 번 깎는다.
 */

/** 닫은 시각(ms). 14일 지나면 다시 보여준다 */
const DISMISS_KEY = 'chwippo:app-banner-dismissed-at'
const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/**
 * 🔴 **광고로 들어온 첫 세션엔 띄우지 않는다.** 인스타 광고는 「가입」을 사는데,
 * 도착하자마자 스토어로 나가는 문을 열면 그 클릭값이 앱 설치 이탈로 샌다.
 * 진입 시점에 표식을 남겨, 그 세션 안에서 URL 파라미터가 사라진 뒤에도 계속 접는다.
 */
const AD_SESSION_KEY = 'chwippo:app-banner-ad-session'
const AD_CAMPAIGN = 'season_2609'

/** 저장소 접근은 전부 실패해도 노출 방향 — 배너를 못 띄우는 것보다 한 번 더 보는 게 낫다 */
function isRecentlyDismissed(now: number): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return now - at < DISMISS_WINDOW_MS
  } catch {
    return false
  }
}

function rememberDismiss(now: number) {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(now))
  } catch {
    /* 저장 실패는 무시 — 이번 화면에서 사라지는 것까지는 보장된다 */
  }
}

/** 광고 유입 세션인가. sessionStorage 가 막혀 있어도 **현재 URL 만으로** 판정은 선다 */
function isAdEntrySession(): boolean {
  let flagged = false
  try {
    flagged = window.sessionStorage.getItem(AD_SESSION_KEY) === '1'
  } catch {
    /* 읽기 실패 — URL 만 본다 */
  }
  const fromAd =
    new URLSearchParams(window.location.search).get('utm_campaign') === AD_CAMPAIGN
  if (fromAd && !flagged) {
    try {
      window.sessionStorage.setItem(AD_SESSION_KEY, '1')
    } catch {
      /* 저장 실패 — 이 세션 뒤쪽 페이지에선 다시 보일 수 있다 (안전한 방향은 아니지만 무해) */
    }
  }
  return flagged || fromAd
}

function shouldShow(now: number): boolean {
  if (isNativeApp()) return false
  const os = detectMobileOS()
  if (os === 'other') return false
  // iOS 는 애플 배너가 뜨는 사파리를 피해야 한다 — 비사파리 확정일 때만
  if (os === 'ios' && !isConfirmedNonSafariIos()) return false
  if (isAdEntrySession()) return false
  return !isRecentlyDismissed(now)
}

export function AppSmartBanner() {
  const [visible, setVisible] = useState(() => shouldShow(Date.now()))
  const os = detectMobileOS()
  const href = storeUrlFor(os)

  if (!visible || !href) return null

  const storeName = os === 'ios' ? 'App Store' : 'Google Play'

  return (
    <div className="w-full bg-surface border-b border-line">
      <div className="max-w-5xl mx-auto flex items-center gap-2.5 px-3 py-2">
        {/* 앱 아이콘 — 파비콘 재사용(별도 에셋 없이 스토어 아이콘과 같은 마크) */}
        <img
          src="/favicon.svg"
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          className="w-[22px] h-[22px] shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-primary truncate">치뽀</p>
          <p className="text-[11px] text-text-tertiary truncate">
            마감 알림은 앱으로 받으세요
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${storeName} 에서 치뽀 앱 받기`}
          className="shrink-0 inline-flex items-center min-h-[44px] px-3.5 rounded-lg bg-brand hover:bg-accent active:bg-accent-hover text-bg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          받기
        </a>
        <button
          type="button"
          onClick={() => {
            rememberDismiss(Date.now())
            setVisible(false)
          }}
          aria-label="앱 안내 닫기"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-lg leading-none text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          ×
        </button>
      </div>
    </div>
  )
}
