/**
 * URL fragment (#)를 key/value object로 파싱.
 *
 * Why: OAuth 콜백에서 access token을 query string(`?`) 대신 fragment(`#`)로 받음.
 * Fragment는 server access log·Referer header에 노출되지 않아 token 노출 위험을 줄임.
 *
 * @param hash `window.location.hash` 값 (앞에 `#` 포함 또는 미포함)
 * @returns 디코딩된 key/value object. fragment 없으면 빈 object
 */
export function parseHashParams(hash: string): Record<string, string> {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash
  if (cleaned.length === 0) return {}
  const params = new URLSearchParams(cleaned)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}
