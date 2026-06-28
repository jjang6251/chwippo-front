import { useState } from 'react'
import { getFaviconUrl } from '@/utils/companyLogo'
import { getAvatarColor } from '@/utils/tags'

/**
 * W2 — 회사 아바타.
 * domain 있으면 Google s2 favicon 시도 → onError → 해시 색 + 첫글자 fallback.
 * domain 없으면 즉시 해시 아바타.
 *
 * 사용:
 *   <CompanyAvatar name={app.companyName} domain={app.domain} size="md" />
 */
interface Props {
  name: string
  domain?: string | null
  size?: 'sm' | 'md' | 'lg'
  /** 추가 override class (border·shadow 등) */
  className?: string
}

const SIZE_CLASS: Record<string, { box: string; favSize: 16 | 32 | 64 }> = {
  sm: { box: 'w-7 h-7 text-[11px] rounded-md', favSize: 32 },
  md: { box: 'w-9 h-9 text-sm rounded-lg', favSize: 64 },
  lg: { box: 'w-10 h-10 text-base rounded-lg', favSize: 64 },
}

export function CompanyAvatar({ name, domain, size = 'md', className = '' }: Props) {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const sz = SIZE_CLASS[size]
  const faviconUrl = !faviconFailed ? getFaviconUrl(domain, sz.favSize) : null
  const initial = name.slice(0, 1) || '?'
  const avatarColor = getAvatarColor(name)

  if (faviconUrl) {
    return (
      <div
        className={`${sz.box} flex items-center justify-center flex-shrink-0 overflow-hidden bg-surface-3 ${className}`}
      >
        <img
          src={faviconUrl}
          alt=""
          className="w-full h-full object-contain"
          onError={() => setFaviconFailed(true)}
        />
      </div>
    )
  }

  // 해시 아바타 fallback — avatarColor 가 "bg-xxx text-white" 같은 Tailwind class 반환
  return (
    <div
      className={`${sz.box} flex items-center justify-center font-bold flex-shrink-0 ${avatarColor} ${className}`}
    >
      {initial}
    </div>
  )
}
