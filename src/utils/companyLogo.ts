/**
 * W2 — Google s2 Favicon helper.
 *
 * 회사 domain → favicon URL. domain 알면 즉시 로고, 없으면 null (호출자가 해시 아바타 fallback).
 *
 * 사용:
 *   const url = getFaviconUrl('toss.im')
 *   → 'https://www.google.com/s2/favicons?domain=toss.im&sz=64'
 *
 *   <img src={url} onError={(e) => { e.currentTarget.style.display='none' }} />
 *
 * 정책: Google s2 무료 + rate limit 사실상 없음 + 브라우저 캐시 잘 작동.
 */

/** Google s2 favicon URL 생성. domain 빈 string / null / undefined → null */
export function getFaviconUrl(
  domain: string | null | undefined,
  size: 16 | 32 | 64 | 128 = 64,
): string | null {
  if (!domain || !domain.trim()) return null
  // domain 정규화 — scheme/path 제거. 예: 'https://www.toss.im/foo' → 'toss.im'
  const cleaned = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleaned)}&sz=${size}`
}
