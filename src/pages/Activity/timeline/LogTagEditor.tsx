import { useState } from 'react'
import { useUpdateLog } from '@/hooks/useActivities'
import { toast } from '@/stores/toastStore'
import {
  CAT_KO,
  CL_COLOR,
  CL_KO,
  COMP_COLOR,
  COMP_KO,
  MOOD_CHIPS,
  fmtQuant,
  tagColorStyle,
} from '../constants'
import type {
  CoverletterTag,
  LogCategory,
  LogComp,
  LogMood,
  QuantValue,
  UpdateActivityLogDto,
} from '@/types/activity'

/**
 * activity-redesign — 타임라인 로그의 간단 태그 편집기.
 * 기록 상세(LogDetailModal)를 열지 않고 자동 태그(행동분류·역량·자소서 소재·감정·키워드)만 보정.
 * 정량(quant)은 3패턴 입력 구조라 여기선 제외 — 기록 상세로 위임.
 */
interface LogTagEditorProps {
  logId: string
  cat: string | null
  comps: string[]
  cl: string[]
  mood: string | null
  keywords: string[]
  quant: QuantValue | null
  onClose: () => void
}

const CAT_OPTIONS = Object.keys(CAT_KO).filter((c) => c !== 'rest')

export function LogTagEditor({
  logId,
  cat: initialCat,
  comps: initialComps,
  cl: initialCl,
  mood: initialMood,
  keywords: initialKeywords,
  quant,
  onClose,
}: LogTagEditorProps) {
  const [cat, setCat] = useState<LogCategory | null>(
    initialCat as LogCategory | null,
  )
  const [comps, setComps] = useState<LogComp[]>(initialComps as LogComp[])
  const [cl, setCl] = useState<CoverletterTag[]>(initialCl as CoverletterTag[])
  const [mood, setMood] = useState<LogMood | null>(initialMood as LogMood | null)
  const [keywords, setKeywords] = useState(initialKeywords.join(', '))
  const update = useUpdateLog('')

  const handleSave = () => {
    const kwList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    // cat/mood 는 DTO 상 null 전송 불가 — 값이 있을 때만 포함 (LogDetailModal 과 동일 의미론).
    // comps/cl/keywords 는 [] 전송 시 백엔드가 비움 → 전체 해제 가능.
    const dto: UpdateActivityLogDto = {
      comps,
      cl,
      keywords: kwList,
    }
    if (cat) dto.cat = cat
    if (mood) dto.mood = mood
    update.mutate(
      { logId, dto },
      {
        onSuccess: () => {
          toast.success('태그를 수정했어요')
          onClose()
        },
        onError: () => toast.error('태그 수정에 실패했습니다.'),
      },
    )
  }

  const chipClass = (active: boolean, tone: 'brand' | 'success' = 'brand') =>
    `text-[10px] px-1.5 py-0.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
      active
        ? tone === 'success'
          ? 'bg-success/10 text-success border-success/30 font-medium'
          : 'bg-brand/12 text-brand border-brand/30 font-medium'
        : 'bg-surface-3 text-text-tertiary border-line hover:text-text-secondary'
    }`

  return (
    <div className="mt-1 bg-surface-2 border border-line rounded-xl px-3.5 py-3 space-y-2">
      <div>
        <p className="text-[10px] text-text-quaternary mb-1">행동분류</p>
        <div className="flex flex-wrap gap-1">
          {CAT_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(cat === c ? null : (c as LogCategory))}
              aria-pressed={cat === c}
              className={chipClass(cat === c)}
            >
              {CAT_KO[c]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-text-quaternary mb-1">발휘 역량</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(COMP_KO) as LogComp[]).map((c) => (
            <button
              key={c}
              onClick={() =>
                setComps((arr) =>
                  arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c],
                )
              }
              aria-pressed={comps.includes(c)}
              className={
                comps.includes(c) && COMP_COLOR[c]
                  ? 'text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
                  : chipClass(comps.includes(c))
              }
              style={
                comps.includes(c) && COMP_COLOR[c]
                  ? tagColorStyle(COMP_COLOR[c])
                  : undefined
              }
            >
              {COMP_KO[c]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-text-quaternary mb-1">자소서 소재</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CL_KO) as CoverletterTag[]).map((c) => (
            <button
              key={c}
              onClick={() =>
                setCl((arr) =>
                  arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c],
                )
              }
              aria-pressed={cl.includes(c)}
              className={
                cl.includes(c) && CL_COLOR[c]
                  ? 'text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
                  : chipClass(cl.includes(c), 'success')
              }
              style={
                cl.includes(c) && CL_COLOR[c] ? tagColorStyle(CL_COLOR[c]) : undefined
              }
            >
              {CL_KO[c]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-text-quaternary mb-1">감정 톤</p>
        <div className="flex flex-wrap gap-1">
          {MOOD_CHIPS.map(([v, em, label]) => (
            <button
              key={v}
              onClick={() => setMood(mood === v ? null : v)}
              aria-pressed={mood === v}
              className={chipClass(mood === v)}
            >
              {em} {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-text-quaternary mb-1">
          키워드 <span className="text-text-faint">(쉼표로 구분)</span>
        </p>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="예: 결제, 리팩터링"
          aria-label="키워드"
          className="w-full bg-input border border-line rounded-lg px-2 py-1.5 text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60"
        />
      </div>
      {quant && (
        <p className="text-[10px] text-text-faint">
          📊 정량 수치({fmtQuant(quant)})는 기록 상세에서 수정할 수 있어요.
        </p>
      )}
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button
          onClick={onClose}
          className="text-[11px] px-2.5 py-1 rounded-lg text-text-tertiary hover:text-text-secondary transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-brand hover:bg-accent text-bg font-medium transition-colors disabled:opacity-40"
        >
          {update.isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
