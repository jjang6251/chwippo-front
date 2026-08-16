import type { LucideIcon } from 'lucide-react'
import { Code2, ClipboardList, Palette, Megaphone, Handshake, Building2, Wallet, Tag } from 'lucide-react'

export const JOB_CATEGORIES = [
  'IT개발', '기획·PM', '디자인', '마케팅', '영업', '경영지원', '금융', '기타',
]

// 직군 태그 아이콘 — 기능 아이콘 = lucide (아이콘 정책 · DESIGN.md). 색은 태그 chip 텍스트색 상속.
export const JOB_CATEGORY_ICON: Record<string, LucideIcon> = {
  'IT개발': Code2, '기획·PM': ClipboardList, '디자인': Palette, '마케팅': Megaphone,
  '영업': Handshake, '경영지원': Building2, '금융': Wallet, '기타': Tag,
}

export const JOB_CATEGORY_COLOR: Record<string, string> = {
  'IT개발':   'text-blue-800 bg-blue-800/10 border-blue-800/25 dark:text-blue-300 dark:bg-blue-300/10 dark:border-blue-300/25',
  '기획·PM':  'text-violet-800 bg-violet-800/10 border-violet-800/25 dark:text-violet-300 dark:bg-violet-300/10 dark:border-violet-300/25',
  '디자인':   'text-pink-800 bg-pink-800/10 border-pink-800/25 dark:text-pink-300 dark:bg-pink-300/10 dark:border-pink-300/25',
  '마케팅':   'text-orange-800 bg-orange-800/10 border-orange-800/25 dark:text-orange-300 dark:bg-orange-300/10 dark:border-orange-300/25',
  '영업':     'text-emerald-800 bg-emerald-800/10 border-emerald-800/25 dark:text-emerald-300 dark:bg-emerald-300/10 dark:border-emerald-300/25',
  '경영지원': 'text-slate-800 bg-slate-800/10 border-slate-800/25 dark:text-slate-300 dark:bg-slate-300/10 dark:border-slate-300/25',
  '금융':     'text-yellow-800 bg-yellow-800/10 border-yellow-800/25 dark:text-yellow-300 dark:bg-yellow-300/10 dark:border-yellow-300/25',
  '기타':     'text-text-tertiary bg-card border-line',
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
