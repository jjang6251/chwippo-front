/**
 * 공개 라우트별 메타 — **sitemap 과 canonical 이 서로 모순되지 않게** 한다.
 *
 * 🔴 문제였던 것 (2026-08-06 발견): `index.html` 의 canonical 이 홈으로 하드코딩돼 있고
 * SPA 는 라우트별 meta 를 갱신하지 않았다. 그래서 **sitemap 에 올린 8개 URL 이 전부
 * "내 표준 주소는 홈" 이라고 자기 선언**하고 있었다. sitemap 주석은 데모를
 * *"서비스 이해에 가장 도움되는 진입점"* 이라며 priority 0.8 을 줬는데 canonical 이 그걸 취소했다.
 *
 * ⚠️ **효과 범위는 구글뿐이다.** JS 를 실행하는 크롤러만 이 값을 본다.
 *   - 구글 — 렌더 후 읽는다 → ✅ 적용됨
 *   - 네이버 Yeti · 카카오톡·페이스북 공유 미리보기 — **JS 미실행** → 정적 `index.html` 만 본다
 *
 * 그래서 **데모 링크를 카톡에 공유하면 여전히 홈 카드가 뜬다.** 그걸 고치려면 라우트별 정적
 * HTML(프리렌더)이 필요하고, 이 변경의 범위가 아니다. 네이버 표면은 정적 가이드 6장이 담당한다.
 *
 * 여기 없는 경로(로그인 뒤 화면)는 홈 기본값을 그대로 둔다. sitemap 에도 없고 `AuthGuard`
 * 뒤라 크롤러가 도달하지 못한다.
 */

export const SITE_ORIGIN = 'https://chwippo.com'

export interface RouteMeta {
  title: string
  description: string
}

/**
 * 홈 기본값 — `index.html` 의 정적 meta 와 **같은 값이어야 한다.**
 * 다르면 초기 렌더 순간 홈 title 이 깜빡이며 바뀐다.
 *
 * ⚠️ 34자로 한국어 SERP 절단선(~30자)을 넘지만 **이미 색인된 값이라 이 PR 에서 건드리지 않는다** —
 * 홈 title 변경은 별도 판단이다. 새로 추가하는 라우트는 32자 이하로 맞춘다(아래 spec 이 강제).
 */
export const DEFAULT_META: RouteMeta = {
  title: '치뽀 — 취업 일정 관리 | 취준생 지원현황·자소서·면접 준비',
  description: '치뽀 — 취준생을 위한 취업 일정·자소서·면접 올인원 관리 웹앱',
}

/**
 * 🔴 키는 **sitemap.xml 의 경로와 1:1** 이어야 한다.
 * 둘이 어긋나면 "sitemap 에 있는데 canonical 은 홈" 인 원래 문제로 되돌아간다.
 * `components/layout/RouteMeta.test.tsx` 가 sitemap.xml 을 직접 읽어 이 정합을 검사한다.
 */
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': DEFAULT_META,
  '/login': {
    title: '로그인 · 무료 시작 | 치뽀',
    description: '카카오·Apple 로 3초 만에 시작하세요. 카드 등록 없이 무료로 씁니다.',
  },
  '/demo/calendar': {
    title: '취업 일정 캘린더 둘러보기 — 면접·시험 한눈에 | 치뽀',
    description:
      '로그인 없이 둘러보는 취업 캘린더. 서류 마감·면접·시험 일정을 월별로 확인하고 임박한 일정을 먼저 봅니다.',
  },
  '/demo/board': {
    title: '지원 현황 보드 둘러보기 — 전형 단계·D-day | 치뽀',
    description:
      '지원한 회사를 전부 한 화면에서. 서류·면접·결과 대기로 자동 분류되고 마감 D-day 가 자동 계산됩니다.',
  },
  '/demo/coverletters': {
    title: '자소서 관리 둘러보기 — 문항·답변 보관 | 치뽀',
    description:
      '회사별 자소서 문항과 답변을 한 곳에 모아 보관하고 글자수를 실시간으로 확인합니다. 작성은 PC 에서.',
  },
  '/demo/myinfo': {
    title: '내 정보 창고 둘러보기 — 경험·자격증 정리 | 치뽀',
    description:
      '학력·자격증·수상·경험을 한 번 정리해두면 자소서 쓸 때마다 꺼내 씁니다.',
  },
  '/demo/dashboard': {
    title: '취업 준비 회고 둘러보기 — 월간 통계 | 치뽀',
    description:
      '이번 달에 몇 곳 지원했고 면접을 몇 번 봤는지. 지난달보다 얼마나 나아갔는지 돌아봅니다.',
  },
  '/privacy': {
    title: '개인정보처리방침 | 치뽀',
    description: '치뽀가 수집하는 개인정보 항목과 이용·보관·파기 기준, 수탁 업체를 안내합니다.',
  },
  '/terms': {
    title: '이용약관 | 치뽀',
    description:
      '치뽀 서비스 이용 조건, 회원 가입·금지 행위, 콘텐츠 소유권, AI 기능 이용 안내를 담은 약관입니다.',
  },
}

/**
 * 🔴 `Object.hasOwn` 으로 조회한다 — 그냥 `ROUTE_META[key]` 를 쓰면 `'constructor'`·`'__proto__'`
 * 같은 키에서 **`Object.prototype` 값이 새어 나온다** (실검 확인, CWE-1321).
 * 라우터의 `pathname` 은 언제나 `/` 로 시작해 지금은 도달 불가하지만, 이 함수들은 export 라
 * 다른 호출부가 생기면 뚫린다. 값 하나로 막을 수 있는 것을 조건에 의존하지 않는다.
 */
function lookup(pathname: string): { key: string; meta: RouteMeta | null } {
  const key = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/'
  return { key, meta: Object.hasOwn(ROUTE_META, key) ? ROUTE_META[key] : null }
}

/** 경로 → 메타. 끝의 `/` 는 무시하고 찾는다(`/privacy/` 도 같은 페이지다) */
export function resolveRouteMeta(pathname: string): RouteMeta {
  return lookup(pathname).meta ?? DEFAULT_META
}

/** 경로 → 표준 주소. 미등록 경로는 홈으로 모은다(중복 색인 방지) */
export function resolveCanonical(pathname: string): string {
  const { key, meta } = lookup(pathname)
  return meta ? `${SITE_ORIGIN}${key === '/' ? '/' : key}` : `${SITE_ORIGIN}/`
}
