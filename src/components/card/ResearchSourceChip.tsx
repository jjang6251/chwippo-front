/**
 * 회사 조사 출처 chip — favicon + 도메인 (Perplexity 식). 클릭 시 새 탭.
 *
 * 🔴 **공용 위치인 이유** — 원래 `CompanyResearchCard` 안 지역 컴포넌트였는데
 * 카드 상세 「회사 알아보기」 탭이 같은 출처 목록을 낸다. 두 벌로 두면 한쪽만 고치는
 * 순간 같은 출처가 화면마다 다르게 보인다 (`utils/researchKeywords.ts` 와 같은 판단).
 */
export function ResearchSourceChip({ url }: { url: string }) {
  let domain: string
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    domain = url
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      /* min-w-0 없이는 안쪽 truncate 가 동작하지 않는다 — 긴 도메인이 칩 밖으로 나간다.
       *
       * 🔴 **높이 25px 은 의도한 값이다** (2026-08-23 /uiux 실측 · 앱 터치 타겟 기준 32px 미달).
       * 같은 패스에서 스트립 ×(28→32)와 「출처」 토글(29→32)은 올렸는데 여기만 안 올린 이유 —
       * 저 둘은 아이콘·글자를 그대로 두고 **히트 영역만** 넓힐 수 있었지만, 이 칩은 칩 자체가
       * 히트 영역이라 늘리면 「작은 출처 칩」이라는 형태가 바뀐다.
       * 심각도로도 값이 안 나온다: 가로가 94~124px 라 놓치기 어렵고, 접혀 있는 「출처」를 일부러
       * 펼친 사람만 만나며, 잘못 눌러도 **옆에 있는 것도 출처 링크**라 결과가 거의 같다.
       * 다음 감사에서 같은 판단을 다시 밟지 않도록 여기 남긴다. */
      className="inline-flex items-center gap-1 min-w-0 bg-surface border border-line hover:border-brand/40 hover:bg-surface-3 text-text-tertiary hover:text-text-primary text-[10px] px-2 py-1 rounded-md transition-colors max-w-full"
      title={url}
    >
      <img
        src={favicon}
        alt=""
        width={12}
        height={12}
        className="shrink-0"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <span className="truncate">{domain}</span>
    </a>
  )
}
