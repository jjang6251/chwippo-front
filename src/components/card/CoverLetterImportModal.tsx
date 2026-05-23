import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/common/Modal'
import { applicationCoverlettersApi } from '@/api/applicationCoverletters'
import { getCoverletter } from '@/api/myinfo'
import type { Coverletter } from '@/api/myinfo'
import type { CoverletterReuseOption } from '@/types/coverletter'
import { countChars } from '@/utils/charCount'

type Source = 'card' | 'myinfo'

interface PickItem {
  key: string
  title: string
  subtitle?: string
  text: string
}

interface CoverLetterImportModalProps {
  onClose: () => void
  applicationId: string
  currentCategory: string | null
  currentAnswer: string
  onApply: (value: string) => void
}

const MYINFO_FIELDS: { key: keyof Coverletter; label: string }[] = [
  { key: 'personality', label: '성격 장단점' },
  { key: 'background', label: '성장 배경' },
  { key: 'job_competency', label: '직무 역량·핵심 경험' },
  { key: 'own_strength', label: '나만의 강점' },
  { key: 'collaboration', label: '갈등 해결·협업 경험' },
  { key: 'challenge', label: '도전·실패 경험' },
]

export function CoverLetterImportModal({
  onClose,
  applicationId,
  currentCategory,
  currentAnswer,
  onApply,
}: CoverLetterImportModalProps) {
  const [source, setSource] = useState<Source>('card')
  const [showAll, setShowAll] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const reuseQuery = useQuery({
    queryKey: ['coverletters', applicationId, 'reuse', currentCategory ?? ''],
    queryFn: () => applicationCoverlettersApi.reuseOptions(applicationId, currentCategory ?? undefined),
    enabled: source === 'card',
  })

  const myinfoQuery = useQuery({
    queryKey: ['myinfo', 'coverletter'],
    queryFn: getCoverletter,
    enabled: source === 'myinfo',
  })

  const cardItems: PickItem[] = useMemo(() => {
    const rows: CoverletterReuseOption[] = reuseQuery.data ?? []
    const filtered = currentCategory && !showAll
      ? rows.filter((r) => r.category === currentCategory)
      : rows
    return filtered.map((r) => ({
      key: r.id,
      title: r.question || '(문항 없음)',
      subtitle: r.companyName,
      text: r.answer,
    }))
  }, [reuseQuery.data, currentCategory, showAll])

  const myinfoItems: PickItem[] = useMemo(() => {
    const data = myinfoQuery.data
    if (!data) return []
    const fixed: PickItem[] = MYINFO_FIELDS
      .map((f) => ({ key: `f-${f.key}`, title: f.label, text: (data.coverletter[f.key] ?? '').trim() }))
      .filter((i) => i.text.length > 0)
    const custom: PickItem[] = data.custom
      .filter((c) => (c.content ?? '').trim().length > 0)
      .map((c) => ({ key: `c-${c.id}`, title: c.label, text: (c.content ?? '').trim() }))
    return [...fixed, ...custom]
  }, [myinfoQuery.data])

  const items = source === 'card' ? cardItems : myinfoItems
  const isLoading = source === 'card' ? reuseQuery.isLoading : myinfoQuery.isLoading
  const selected = items.find((i) => i.key === selectedKey) ?? null

  const apply = (mode: 'append' | 'overwrite') => {
    if (!selected) return
    const value =
      mode === 'append' && currentAnswer.trim()
        ? `${currentAnswer.trimEnd()}\n\n${selected.text}`
        : selected.text
    onApply(value)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="문항 답변 가져오기" width="max-w-md">
      {/* 소스 전환 */}
      <div className="flex gap-1 p-1 bg-surface-2 border border-line rounded-lg mb-4">
        {(
          [
            { v: 'card' as Source, label: '다른 카드에서' },
            { v: 'myinfo' as Source, label: '내정보 소재에서' },
          ]
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => { setSource(t.v); setSelectedKey(null) }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors
              ${source === t.v ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 같은 유형/전체 토글 (다른 카드 + category 있을 때만) */}
      {source === 'card' && currentCategory && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-[11px] text-text-quaternary hover:text-text-secondary mb-3 transition-colors"
        >
          {showAll ? `← ${currentCategory} 유형만 보기` : '전체 문항 보기 →'}
        </button>
      )}

      <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1.5">
        {isLoading ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-card rounded-lg animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-text-quaternary text-xs text-center py-8">
            {source === 'card'
              ? '답변을 작성한 다른 카드 문항이 아직 없어요.'
              : '내정보 창고 자소서 소재에 작성된 내용이 없어요.'}
          </p>
        ) : (
          items.map((item) => {
            const isSel = item.key === selectedKey
            return (
              <div key={item.key} className={`rounded-lg border transition-colors ${isSel ? 'border-brand/40 bg-brand/5' : 'border-line bg-surface-2 hover:border-line-strong'}`}>
                <button
                  onClick={() => setSelectedKey(isSel ? null : item.key)}
                  className="w-full text-left px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-text-primary text-xs font-medium flex-1 min-w-0 truncate">{item.title}</span>
                    {item.subtitle && <span className="text-text-quaternary text-[10px] flex-none">{item.subtitle}</span>}
                    <span className="text-text-quaternary text-[10px] flex-none font-mono">{countChars(item.text).total.toLocaleString()}자</span>
                  </div>
                  <p className="text-text-tertiary text-[11px] line-clamp-2 leading-relaxed">{item.text}</p>
                </button>
                {isSel && (
                  <div className="flex gap-1.5 px-3 pb-2.5">
                    <button
                      onClick={() => apply('append')}
                      disabled={!currentAnswer.trim()}
                      className="flex-1 py-1.5 text-[11px] font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-card active:bg-card-strong active:bg-card-strong"
                    >
                      답변 끝에 추가
                    </button>
                    <button
                      onClick={() => apply('overwrite')}
                      className="flex-1 py-1.5 text-[11px] font-medium text-text-primary bg-brand hover:bg-accent active:bg-accent-hover rounded-md transition-colors"
                    >
                      덮어쓰기
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
