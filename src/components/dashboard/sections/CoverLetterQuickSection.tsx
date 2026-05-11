import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoverletter } from '@/hooks/useMyinfo'
import { toast } from '@/stores/toastStore'
import type { Coverletter } from '@/api/myinfo'

const FIELDS: { key: keyof Coverletter; label: string }[] = [
  { key: 'personality',    label: '성격 장단점' },
  { key: 'background',      label: '성장 배경' },
  { key: 'job_competency',  label: '직무 역량·핵심 경험' },
  { key: 'own_strength',    label: '나만의 강점' },
  { key: 'collaboration',   label: '갈등 해결·협업 경험' },
  { key: 'challenge',       label: '도전·실패 경험' },
]

export function CoverLetterQuickSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useCoverletter()
  const [openKey, setOpenKey] = useState<string | null>(null)

  const coverletter = data?.coverletter
  const filledCount = coverletter
    ? FIELDS.filter((f) => (coverletter[f.key] ?? '').trim().length > 0).length
    : 0

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content)
    toast.show('복사됐어요')
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text-primary text-base font-semibold">📋 자소서 소재</h2>
        <button
          onClick={() => navigate('/myinfo#coverletter')}
          className="text-[11px] text-text-quaternary hover:text-text-tertiary transition-colors"
        >
          편집 →
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-surface-2 border border-white/6 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filledCount === 0 ? (
        <div className="flex flex-col items-center py-6 text-center gap-2">
          <p className="text-2xl">📝</p>
          <p className="text-text-tertiary text-xs">자소서 소재가 비어있어요</p>
          <button
            onClick={() => navigate('/myinfo#coverletter')}
            className="mt-1 text-[11px] text-brand hover:text-accent transition-colors"
          >
            내 정보 창고에서 작성하기 →
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {FIELDS.map((f) => {
            const content = (coverletter?.[f.key] ?? '').trim()
            const isOpen = openKey === f.key
            const hasContent = content.length > 0

            return (
              <li key={f.key} className="bg-surface-2 border border-white/6 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenKey(isOpen ? null : f.key)}
                  disabled={!hasContent}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors
                    ${hasContent ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default opacity-50'}
                  `}
                >
                  <span className={`text-xs font-medium ${hasContent ? 'text-text-secondary' : 'text-text-quaternary'}`}>
                    {f.label}
                  </span>
                  {hasContent ? (
                    <svg
                      className={`text-text-quaternary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                    >
                      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-[10px] text-text-quaternary">미입력</span>
                  )}
                </button>
                {isOpen && hasContent && (
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-text-secondary text-xs whitespace-pre-wrap leading-relaxed mb-2">{content}</p>
                    <button
                      onClick={() => handleCopy(content)}
                      className="text-[10px] text-brand hover:text-accent transition-colors"
                    >
                      📋 복사
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
