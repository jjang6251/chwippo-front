import type { ReactNode } from 'react'

/**
 * 무대에 세운 **진짜 컴포넌트**의 상호작용을 통째로 막는 껍데기.
 *
 * 투어는 실제 `CompanyCard`·`StepBar` 를 그대로 렌더한다(모양만 베끼면 실물과 어긋난다).
 * 그런데 그것들은 뮤테이션을 달고 있어서 — 「지원 시작하기」·삭제·즐겨찾기 — 소개 화면에서
 * 눌리면 **서버가 움직인다.**
 *
 * 세 겹으로 막는다:
 * - `inert` — 포커스·클릭·키보드 접근 전부 차단 (React 19 는 boolean 표기)
 * - `pointer-events-none` — hover 조차 생기지 않게 (`inert` 만으로는 hover 가 남는다)
 * - `aria-hidden` — 보조기술이 「눌러도 되는 것」으로 읽지 않게
 *
 * 🔴 `inert=""` 로 쓰면 React 19 가 falsy 로 보고 **속성을 안 붙인다.** 반드시 단독 표기다
 * (실기에서 속성이 통째로 빠져 있었다).
 */
export function TourInert({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    // `...rest` 로 안무 props(`data-anim` + 지연)를 그대로 받는다 — 등장 시각은 `choreo.ts` 가 쥔다
    <div {...rest} inert aria-hidden="true" className={`pointer-events-none ${className}`}>
      {children}
    </div>
  )
}
