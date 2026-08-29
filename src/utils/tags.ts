import type { LucideIcon } from 'lucide-react'
import {
  Code2, ClipboardList, Palette, Megaphone, Handshake, Building2, Wallet, Tag,
  Stethoscope, GraduationCap, Landmark, FlaskConical, Factory, HardHat, Truck, Sprout,
} from 'lucide-react'

export const JOB_CATEGORIES = [
  'IT개발', '기획·PM', '디자인', '마케팅', '영업', '경영지원', '금융', '기타',
]

// ── 색 상수 — 계열 14개가 이 7색을 나눠 쓴다 (🔴 새 hex 도입 금지, 기존 토큰 재사용) ──
const BLUE    = 'text-blue-800 bg-blue-800/10 border-blue-800/25 dark:text-blue-300 dark:bg-blue-300/10 dark:border-blue-300/25'
const VIOLET  = 'text-violet-800 bg-violet-800/10 border-violet-800/25 dark:text-violet-300 dark:bg-violet-300/10 dark:border-violet-300/25'
const PINK    = 'text-pink-800 bg-pink-800/10 border-pink-800/25 dark:text-pink-300 dark:bg-pink-300/10 dark:border-pink-300/25'
const ORANGE  = 'text-orange-800 bg-orange-800/10 border-orange-800/25 dark:text-orange-300 dark:bg-orange-300/10 dark:border-orange-300/25'
const EMERALD = 'text-emerald-800 bg-emerald-800/10 border-emerald-800/25 dark:text-emerald-300 dark:bg-emerald-300/10 dark:border-emerald-300/25'
const SLATE   = 'text-slate-800 bg-slate-800/10 border-slate-800/25 dark:text-slate-300 dark:bg-slate-300/10 dark:border-slate-300/25'
const YELLOW  = 'text-yellow-800 bg-yellow-800/10 border-yellow-800/25 dark:text-yellow-300 dark:bg-yellow-300/10 dark:border-yellow-300/25'

/*
 * 🔴 **키가 두 세대 섞여 있다** — 위 8개는 옛 직군 칩(`JOB_CATEGORIES`), 아래 14개는
 * 계열 라벨(`utils/jobRole.ts` 의 `JOB_SERIES[].label`)이다.
 *
 * 카드의 `jobCategory` 는 새 카드면 계열 라벨, 옛 카드면 직군 칩 값이라 **둘 다 그려져야 한다.**
 * 마이그레이션으로 옛 값을 덮지 않기로 했으므로(계획서 묶음 6) 이 표는 앞으로도 두 세대를
 * 같이 들고 간다. 계열 라벨을 바꾸면 여기 키도 같이 바꿔야 한다 — spec 이 정합을 지킨다.
 *
 * 색은 7개뿐이라 계열끼리 겹친다. 색 하나를 계열 하나에 배정하려면 **새 색을 도입**해야 하고,
 * 그건 다크·라이트 두 값을 새로 검증해야 하는 별개의 작업이다 (DESIGN.md §2).
 */

// 직군 태그 아이콘 — 기능 아이콘 = lucide (아이콘 정책 · DESIGN.md). 색은 태그 chip 텍스트색 상속.
export const JOB_CATEGORY_ICON: Record<string, LucideIcon> = {
  'IT개발': Code2, '기획·PM': ClipboardList, '디자인': Palette, '마케팅': Megaphone,
  '영업': Handshake, '경영지원': Building2, '금융': Wallet, '기타': Tag,

  'IT·개발': Code2,
  '경영·사무·행정': Building2,
  '금융·보험': Wallet,
  '의료·보건·복지': Stethoscope,
  '교육': GraduationCap,
  '공공·공무원·군인': Landmark,
  '연구·R&D': FlaskConical,
  '생산·기술·기능': Factory,
  '건설·설비': HardHat,
  '영업·판매·서비스': Handshake,
  '미디어·디자인·문화': Palette,
  '운송·물류': Truck,
  '농림어업': Sprout,
  '마케팅·광고·홍보': Megaphone,
}

export const JOB_CATEGORY_COLOR: Record<string, string> = {
  'IT개발':   BLUE,
  '기획·PM':  VIOLET,
  '디자인':   PINK,
  '마케팅':   ORANGE,
  '영업':     EMERALD,
  '경영지원': SLATE,
  '금융':     YELLOW,
  '기타':     'text-text-tertiary bg-card border-line',

  'IT·개발':           BLUE,
  '경영·사무·행정':     SLATE,
  '금융·보험':          YELLOW,
  '의료·보건·복지':     EMERALD,
  '교육':              VIOLET,
  '공공·공무원·군인':   SLATE,
  '연구·R&D':          VIOLET,
  '생산·기술·기능':     ORANGE,
  '건설·설비':          YELLOW,
  '영업·판매·서비스':   EMERALD,
  '미디어·디자인·문화': PINK,
  '운송·물류':          BLUE,
  '농림어업':           EMERALD,
  '마케팅·광고·홍보':   ORANGE,
}

// DB는 comma-separated string, 프론트는 배열
export const parseTags = (raw: string | null): string[] =>
  raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : []

export const serializeTags = (tags: string[]): string =>
  tags.join(',')

// 회사명 해시 기반 아바타 컬러 (CompanyCard 등 공유)
const AVATAR_COLORS = [
  // W2 — 다크/라이트 모두 식별 강한 패턴 (solid bg + white text).
  // 이전 alpha 15% + tinted text = 라이트 모드에서 배경에 묻힘.
  'bg-blue-600 text-white',
  'bg-violet-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-800 text-white',
  'bg-orange-600 text-white',
  'bg-pink-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-800 text-white',
]

export function getAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
