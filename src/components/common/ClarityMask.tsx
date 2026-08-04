import { Outlet } from 'react-router-dom'
import { CLARITY_MASK } from '@/lib/clarity'

/**
 * 민감 화면 마스킹 경계 — **방침의 약속을 코드가 지키는 지점.**
 *
 * 개인정보처리방침 §5-2 가 *"자기소개서·활동 기록·내 정보 등 민감한 화면에는 마스킹을 추가로
 * 적용합니다"* 라고 고지한다. 그 약속을 실제로 이행하는 곳이 여기다.
 *
 * 🔴 **페이지 컴포넌트마다 붙이지 않고 라우트에서 감싼다.** 페이지에 붙이면 로딩·에러·빈 상태
 * 같은 **다른 렌더 분기를 놓친다** — 그 분기에서만 자소서가 노출되면 아무도 모른다.
 * 라우트를 감싸면 그 하위에서 무엇이 그려지든 마스킹 안이다.
 *
 * ⚠️ Clarity 에 "특정 화면 수집 중단" API 는 없다 (`consent`·`identify`·`set`·`event`·`upgrade`
 * 뿐). SPA 라 스크립트가 한 번 로드되면 이후 라우팅까지 기록되므로, **마스킹이 유일한 방어**다.
 * 마스킹된 콘텐츠는 Clarity 로 업로드되지 않는다 (Microsoft 문서).
 *
 * `data-clarity-mask="false"` 는 효과가 없고 해제는 `data-clarity-unmask` 로만 되므로,
 * 실수로 노출되는 방향의 사고는 구조적으로 어렵다.
 */
export function ClarityMask() {
  return (
    <div {...CLARITY_MASK}>
      <Outlet />
    </div>
  )
}
