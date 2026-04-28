export const JOB_CATEGORIES = [
  'IT개발', '기획·PM', '디자인', '마케팅', '영업', '경영지원', '금융', '기타',
]

export const JOB_CATEGORY_EMOJI: Record<string, string> = {
  'IT개발': '💻', '기획·PM': '📋', '디자인': '🎨', '마케팅': '📣',
  '영업': '🤝', '경영지원': '🏢', '금융': '💰', '기타': '🏷️',
}

export const JOB_CATEGORY_COLOR: Record<string, string> = {
  'IT개발':   'text-blue-400 bg-blue-400/10 border-blue-400/25',
  '기획·PM':  'text-violet-400 bg-violet-400/10 border-violet-400/25',
  '디자인':   'text-pink-400 bg-pink-400/10 border-pink-400/25',
  '마케팅':   'text-orange-400 bg-orange-400/10 border-orange-400/25',
  '영업':     'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  '경영지원': 'text-slate-400 bg-slate-400/10 border-slate-400/25',
  '금융':     'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  '기타':     'text-text-tertiary bg-white/6 border-white/12',
}

// DB는 comma-separated string, 프론트는 배열
export const parseTags = (raw: string | null): string[] =>
  raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : []

export const serializeTags = (tags: string[]): string =>
  tags.join(',')

// 회사명 해시 기반 아바타 컬러 (CompanyCard, DdayList 공유)
const AVATAR_COLORS = [
  'bg-blue-500/15 text-blue-400',
  'bg-violet-500/15 text-violet-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-amber-500/15 text-amber-400',
  'bg-rose-500/15 text-rose-400',
  'bg-cyan-500/15 text-cyan-400',
  'bg-orange-500/15 text-orange-400',
  'bg-pink-500/15 text-pink-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-teal-500/15 text-teal-400',
]

export function getAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
