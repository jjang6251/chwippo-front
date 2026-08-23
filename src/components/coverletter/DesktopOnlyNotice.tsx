import { useState } from 'react'
import { Monitor, Check, Copy } from 'lucide-react'
import { toast } from '@/stores/toastStore'

const WEB_URL = 'chwippo.com'

interface Props {
  /** 'banner' = 문서 상단 알림 · 'inline' = 카드 안 보조 문구 */
  variant?: 'banner' | 'inline'
  className?: string
}

/**
 * 자소서 **AI 는 PC 전용**(모바일 웹·앱) 안내.
 *
 * 🔴 2026-08-23 부터 모바일에서도 **문항·답변을 쓸 수 있다.** 그 전 문구("작성·수정은
 * PC에서")는 그대로 두면 **거짓말이 되고, 있는 길을 막는다** — 쓸 수 있는데 못 쓰는 줄 안다.
 * PC 전용으로 남는 것은 코인을 쓰는 AI 뿐이다 (초안 채팅·자소서 검사).
 *
 * 기존 문구는 "PC에서 작성할 수 있어요" 로 끝나 **어디로 가야 하는지가 없었다.**
 * 앱은 WebView 라 사용자는 자기가 웹을 보고 있다는 사실조차 모르고, 주소를 손으로
 * 옮겨적을 수도 없어 **핵심 기능 앞에서 막다른 길**이 됐다 (2026-07-29 발견).
 * 그래서 주소를 명시하고 복사 버튼을 붙인다.
 *
 * ⚠️ 문구에 결제·구매 뉘앙스를 넣지 말 것 — 앱에서 외부 결제 유도는 심사 리젝 사유다.
 * 여기는 "무료 기능을 큰 화면에서 쓰는 방법" 안내에 머물러야 한다.
 */
export function DesktopOnlyNotice({ variant = 'banner', className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${WEB_URL}`)
      setCopied(true)
      toast.show('주소를 복사했어요. PC 브라우저에 붙여넣으세요.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 권한 거부·비보안 컨텍스트 — 주소는 화면에 이미 보이므로 치명적이지 않다
      toast.error(`복사에 실패했어요. 주소: ${WEB_URL}`)
    }
  }

  return (
    <div
      className={`bg-card border border-line rounded-lg px-3 py-2.5 ${className}`}
    >
      {/* 🔴 14px — **모바일 사용자가 「여기서 뭘 할 수 있나」를 아는 유일한 문장**이다.
          편집을 막 열어 놓고 그 사실을 알리는 문장이 12px 이면 안 읽힌다
          (DESIGN.md 규칙 7-b · 2026-08-23 /uiux 1-c 실측에서 걸림). */}
      <p className="flex items-start gap-1.5 text-sm text-text-secondary leading-relaxed break-keep">
        <Monitor size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          {variant === 'banner'
            ? '문항과 답변은 여기서 바로 쓸 수 있어요. AI 초안·검사는 PC에서 할 수 있어요.'
            : 'AI 초안·검사는 PC에서 할 수 있어요. 문항과 답변은 여기서 쓸 수 있어요.'}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 pl-[22px]">
        <span className="text-text-secondary text-xs font-mono" translate="no">
          {WEB_URL}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 h-11 px-2 -my-2.5 rounded-md text-[11px] font-medium text-text-tertiary hover:text-text-primary hover:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2} aria-hidden="true" />
              복사됨
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
              주소 복사
            </>
          )}
        </button>
      </div>
      <p className="text-text-quaternary text-[11px] mt-1.5 pl-[22px] leading-relaxed">
        같은 계정으로 로그인하면 지금 쓰던 내용이 그대로 있어요.
      </p>
    </div>
  )
}
