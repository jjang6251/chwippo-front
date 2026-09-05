/**
 * 필드 아래 **한 줄** 도움말 — 라벨 pill + 문장.
 *
 * 실측 근거(`autofill-census-2026-09.md` 「입력 UX 관찰」 #6): 리크루터는 칸 바로 아래
 * 한 줄 pill 로 「영문 성-이름 순, 대문자」를 알려주고, 잡코리아(JRS)는 섹션 상단에 빨간
 * 안내 10줄을 둔다. **전자만 읽힌다** — 그래서 우리도 칸 옆 한 줄만 쓴다.
 *
 * 접근성: 도움말은 장식이 아니라 입력 규칙이라 `id` 를 받아 입력의 `aria-describedby`
 * 로 연결할 수 있게 열어 둔다.
 */
import type { ReactNode } from 'react'

interface Props {
  /** pill 안 짧은 라벨 (예: 「입력 형식」·「만점 기준」) */
  label: string
  /** 한 줄 설명 */
  children: ReactNode
  /** 입력의 `aria-describedby` 로 연결할 id */
  id?: string
  className?: string
}

export function HelpPill({ label, children, id, className = '' }: Props) {
  return (
    <p id={id} className={`mt-1.5 flex items-start gap-1.5 text-sm text-text-tertiary leading-relaxed ${className}`}>
      <span className="mt-px shrink-0 inline-flex items-center rounded-full border border-info/20 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">
        {label}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}
