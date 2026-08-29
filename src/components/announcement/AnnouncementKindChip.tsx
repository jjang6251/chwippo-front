import type { AnnouncementKind } from '@/types/announcement'

/**
 * 공지 종류 칩 — 「이 글이 무슨 소식인가」를 제목보다 먼저 말한다.
 *
 * 🔴 `notice`(안내)는 **칩이 없다.** 안내는 기본값이라 굳이 이름표를 달면
 *    나머지 셋의 이름표가 같이 흔해진다 (전부 붙으면 아무것도 안 붙은 것과 같다).
 *
 * ## 면이 두 종류라 색 규칙도 둘이다
 *
 * - `surface` — 모달 안(중립 배경). 「새 기능」은 `AddCardModal` 의 NEW 알약과 **같은 토큰**
 *   (`accent-fill` + `accent-fill-ink`)을 쓴다. 앱 안에서 「새로 생긴 것」의 색이 하나여야
 *   두 번째로 봤을 때 읽지 않고도 안다. 개선·수정은 의미색 틴트.
 * - `onBrand` — 배너 안(brand 면 위). 여기선 의미색 틴트가 **거의 안 보인다** — `bg-info/12`
 *   는 sage 위에서 사라지고 `text-info` 는 대비가 안 나온다. 그래서 배너 칩은 색으로 가르지
 *   않고 **글자로만** 가른다: 배너가 이미 쓰고 있는 `bg-bg/15` + `text-bg` 한 쌍
 *   (닫기 버튼과 같은 토큰이라 대비가 이미 검증된 조합).
 */
const KIND_LABEL: Record<AnnouncementKind, string | null> = {
  feature: '새 기능',
  improvement: '개선',
  fix: '수정',
  notice: null,
}

/** 모달(중립 면) 위 색 — NEW 알약과 같은 문법: 채움 + 그 위 글자 */
const SURFACE_STYLE: Record<AnnouncementKind, string> = {
  feature: 'bg-accent-fill text-accent-fill-ink',
  improvement: 'bg-info/12 text-info border border-info/20',
  fix: 'bg-success/12 text-success border border-success/20',
  notice: '',
}

export function AnnouncementKindChip({
  kind,
  variant = 'surface',
  className = '',
}: {
  kind: AnnouncementKind
  variant?: 'surface' | 'onBrand'
  /** 자리마다 배치가 다르다 — 배너는 flex 아이템, 모달은 세로 흐름 */
  className?: string
}) {
  const label = KIND_LABEL[kind]
  /*
    🔴 `notice` 는 여기서 **아무것도 렌더하지 않는다** — 호출부가 껍데기 `<span>` 으로
    감싸면 flex gap 이 그대로 남아 「빈 칸이 하나 더 있는」 배너가 된다. 그래서 감싸지 말고
    배치 클래스를 이 프롭으로 넘긴다.
  */
  if (!label) return null

  return (
    <span
      className={`inline-flex items-center h-[17px] px-1.5 rounded-full text-[10px] font-bold tracking-[0.08em] whitespace-nowrap ${
        // 🔴 brand 띠 위에선 **역상 칩**(바탕색 칩 + brand 글자) — `bg-bg/15 text-bg` 는 라이트에서
        //    10px 글자가 4.06:1 로 미달이었다 (2026-08-30 실측). 역상은 페이지 위 brand 글자와 같은 짝
        variant === 'onBrand' ? 'bg-bg text-brand' : SURFACE_STYLE[kind]
      } ${className}`}
    >
      {label}
    </span>
  )
}
