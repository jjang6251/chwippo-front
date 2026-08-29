/**
 * 노트에 붙은 **매장 사진** 자리 — 인라인 SVG 일러스트.
 *
 * 🔴 **외부 이미지를 쓰지 않는다.** 실제 매장 사진은 저작권이 걸리고, 사진처럼 보이는 것을
 * 넣으면 「이 앱이 사진을 제공한다」로 읽힌다. 반대로 v3 의 회색 네모 + 라벨은 **사진이 없는
 * 것**으로 보여 「이미지 기능이 있다」는 말이 공허했다 (CEO 실기).
 * 그래서 **그림이되 그림임이 분명한** 일러스트를 그린다 — 사용자가 붙일 사진의 자리 표시다.
 *
 * 🔴 색은 **토큰만** 쓴다 (`rgb(var(--...))`). hex 를 박으면 라이트/다크 한쪽에서 깨진다.
 * 면은 `--surface-3`(중립), 강조는 `--brand`, 사람 실루엣은 `--text-quaternary`,
 * 간판 글자는 `--accent` — 다크·라이트 양쪽에서 대비가 유지되는 조합이다.
 */
export function StoreIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 120"
      className={className}
      role="img"
      aria-label="무신사 스탠다드 홍대 매장 외관 일러스트"
    >
      {/* 거리 톤 배경 */}
      <rect width="200" height="120" rx="6" fill="rgb(var(--surface-3))" />
      {/* 인도 */}
      <rect y="96" width="200" height="24" fill="rgb(var(--bg))" opacity="0.5" />

      {/* 건물 파사드 */}
      <rect x="24" y="14" width="152" height="86" rx="3" fill="rgb(var(--surface))" />
      {/* 간판 */}
      <rect x="24" y="14" width="152" height="20" rx="3" fill="rgb(var(--brand))" opacity="0.9" />
      <text
        x="100"
        y="28"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.5"
        fill="rgb(var(--bg))"
      >
        MUSINSA STANDARD
      </text>

      {/* 유리문 2짝 + 쇼윈도 */}
      <rect x="34" y="42" width="44" height="58" rx="2" fill="rgb(var(--bg))" opacity="0.55" />
      <rect x="122" y="42" width="44" height="58" rx="2" fill="rgb(var(--bg))" opacity="0.55" />
      <rect x="84" y="42" width="32" height="58" rx="2" fill="rgb(var(--bg))" opacity="0.75" />
      <line x1="100" y1="42" x2="100" y2="100" stroke="rgb(var(--surface-3))" strokeWidth="1.5" />
      <circle cx="96" cy="72" r="1.6" fill="rgb(var(--accent))" />
      <circle cx="104" cy="72" r="1.6" fill="rgb(var(--accent))" />

      {/* 줄 선 사람 실루엣 3명 — 「줄이 선다」가 이 장면의 근거 문장과 이어진다 */}
      {[
        { x: 46, h: 26 },
        { x: 62, h: 29 },
        { x: 78, h: 24 },
      ].map(({ x, h }) => (
        <g key={x} fill="rgb(var(--text-quaternary))">
          <circle cx={x} cy={100 - h - 5} r="4.2" />
          <rect x={x - 5} y={100 - h} width="10" height={h} rx="4" />
        </g>
      ))}
    </svg>
  )
}
