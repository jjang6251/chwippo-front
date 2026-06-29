/**
 * 표준 input·textarea·select className 상수.
 *
 * 베타 UIUX polish — 모든 사용자 입력 필드의 background·focus·placeholder 통일.
 * 양 모드 자동 작동 (의미 토큰 `bg-input` 등 CSS 변수).
 *
 * 사용 예:
 *   <input className={INPUT_BASE} />
 *   <input className={`${INPUT_BASE} pl-9`} />  // 확장 시 추가 className 뒤에 붙이기
 *   <textarea className={TEXTAREA_BASE} />
 *   <select className={SELECT_BASE} />
 *
 * 핵심:
 *   - bg-input (다크 = 컨테이너보다 +36 밝게 / 라이트 = 컨테이너보다 어둡게 — 입력 영역 식별)
 *   - border-line + focus:border-brand/50 + ring-1 ring-brand/20
 *   - placeholder:text-text-tertiary (입력값과 구분되면서 잘 보임 — 양 모드 자동)
 *   - transition-all (focus 부드러움)
 */

const SHARED =
  'border border-line text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all'

/** 일반 input (type="text", "email", "tel", "url", "search", "password" 등) */
export const INPUT_BASE = `w-full bg-input rounded-lg px-3 py-2.5 text-sm ${SHARED}`

/** textarea — height·resize 는 사용처에서 style/className 으로 추가 (auto-resize hook 등) */
export const TEXTAREA_BASE = `w-full bg-input rounded-lg px-3 py-2.5 text-sm resize-y ${SHARED}`

/** select — appearance-none + 커스텀 chevron 패턴 강제 (CLAUDE 메모 feedback_select_chevron) */
export const SELECT_BASE = `w-full appearance-none bg-input rounded-lg pl-3 pr-9 py-2.5 text-sm cursor-pointer ${SHARED}`

/** 작은 input·select (text-xs 사이즈, 모달·테이블 등) */
export const INPUT_BASE_SM = `w-full bg-input rounded-lg px-3 py-2 text-xs ${SHARED}`
export const SELECT_BASE_SM = `w-full appearance-none bg-input rounded-lg pl-3 pr-9 py-2 text-xs cursor-pointer ${SHARED}`
