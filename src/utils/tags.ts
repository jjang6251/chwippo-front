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
  'IT개발':   'text-blue-400 bg-blue-400/10 border-blue-400/25',
  '기획·PM':  'text-violet-400 bg-violet-400/10 border-violet-400/25',
  '디자인':   'text-pink-400 bg-pink-400/10 border-pink-400/25',
  '마케팅':   'text-orange-400 bg-orange-400/10 border-orange-400/25',
  '영업':     'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  '경영지원': 'text-slate-400 bg-slate-400/10 border-slate-400/25',
  '금융':     'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
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
  'bg-cyan-700 text-white',
  'bg-orange-600 text-white',
  'bg-pink-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-700 text-white',
]

export function getAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
