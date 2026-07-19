/**
 * 라우트 code-split(React.lazy) 청크 로딩 중 main 영역에 표시되는 공용 스켈레톤.
 *
 * 디자인 규칙상 스피너 금지 → 기존 페이지 스켈레톤 톤(animate-pulse · border-line · bg-surface
 * · bg-card · rounded)을 그대로 재사용한 얇은 공용 fallback 1개. 특정 페이지 레이아웃을 흉내내지
 * 않고 "헤더 + 카드 몇 개" 수준의 중립적 골격만 두어 모든 라우트에 공통 적용한다.
 * 페이지 너비 표준(desktop max-w-[1100px] px-9 py-9 / mobile px-[18px] pt-6)을 따라 실제 페이지가
 * 올라올 때 레이아웃 점프를 줄인다.
 */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="페이지 불러오는 중"
      className="mx-auto w-full max-w-[1100px] px-[18px] pt-6 pb-[88px] lg:px-9 lg:py-9"
    >
      <div className="animate-pulse" aria-hidden>
        {/* 헤더 — 타이틀 + 메타 */}
        <div className="mb-6">
          <div className="mb-2.5 h-6 w-40 rounded-lg bg-surface" />
          <div className="h-4 w-56 rounded bg-card" />
        </div>
        {/* 콘텐츠 카드 */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <div className="mb-3 h-4 w-32 rounded bg-card" />
              <div className="mb-2 h-3 w-full rounded bg-card" />
              <div className="h-3 w-2/3 rounded bg-card" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
