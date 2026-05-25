import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/stores/toastStore'
import { useCreateLog, useUpdateLog } from '@/hooks/useActivities'
import type {
  ActivityLog,
  CoverletterTag,
  LogCategory,
  LogComp,
  LogMood,
  QuantValue,
} from '@/types/activity'
import { todayLocal } from '../utils'

type QuantPattern = 'none' | 'count' | 'before-after' | 'raw'

interface Props {
  open: boolean
  /** create 모드: activityId 필수, editing=null. edit 모드: editing 주어짐 */
  activityId: string
  editing?: ActivityLog | null
  onClose: () => void
  onRequestDelete?: () => void
}

const CAT_CHIPS: Array<[LogCategory, string]> = [
  ['develop', '개발·구현'],
  ['meeting', '회의·기획'],
  ['presentation', '발표·강연'],
  ['collaboration', '협업·팀워크'],
  ['conflict_resolution', '갈등해결'],
  ['learning', '학습·자기개발'],
  ['leadership', '리더십·주도'],
  ['volunteer', '봉사·기여'],
  ['customer', '고객응대'],
  ['analysis', '분석·리서치'],
  ['creative', '창작·디자인'],
  ['other', '기타'],
]

const COMP_CHIPS: Array<[LogComp, string]> = [
  ['technical', '기술'],
  ['leadership', '리더십'],
  ['communication', '소통'],
  ['planning', '기획'],
  ['analytical', '분석'],
  ['problem_solving', '문제해결'],
  ['collaboration', '협업'],
  ['creativity', '창의성'],
  ['responsibility', '책임감'],
  ['adaptability', '적응력'],
]

const CL_CHIPS: Array<[CoverletterTag, string]> = [
  ['personality', '→ 성격·인성'],
  ['background', '→ 성장과정·가치관'],
  ['job_competency', '→ 직무역량·핵심경험'],
  ['own_strength', '→ 나만의 강점'],
  ['collaboration', '→ 협업·갈등경험'],
  ['challenge', '→ 도전·실패경험'],
]

const MOOD_CHIPS: Array<[LogMood, string, string]> = [
  ['proud', '🌟', '뿌듯'],
  ['learning', '🌱', '배움'],
  ['frustrated', '😮‍💨', '힘듦'],
  ['neutral', '🙂', '평범'],
]

interface QuantFields {
  metric: string
  value: string
  unit: string
  before: string
  after: string
  raw: string
}

const EMPTY_QUANT: QuantFields = {
  metric: '',
  value: '',
  unit: '',
  before: '',
  after: '',
  raw: '',
}

function quantToFields(q: QuantValue | null | undefined): {
  pattern: QuantPattern
  fields: QuantFields
} {
  if (!q) return { pattern: 'none', fields: { ...EMPTY_QUANT } }
  if (q.type === 'count') {
    return {
      pattern: 'count',
      fields: {
        ...EMPTY_QUANT,
        metric: q.metric ?? '',
        value: q.value,
        unit: q.unit,
      },
    }
  }
  if (q.type === 'before-after') {
    return {
      pattern: 'before-after',
      fields: {
        ...EMPTY_QUANT,
        before: q.before,
        after: q.after,
        unit: q.unit ?? '',
      },
    }
  }
  return { pattern: 'raw', fields: { ...EMPTY_QUANT, raw: q.raw } }
}

function fieldsToQuant(
  pattern: QuantPattern,
  f: QuantFields,
): QuantValue | null {
  if (pattern === 'none') return null
  if (pattern === 'count') {
    if (!f.value.trim() && !f.unit.trim()) return null
    return {
      type: 'count',
      value: f.value.trim(),
      unit: f.unit.trim(),
      metric: f.metric.trim(),
    }
  }
  if (pattern === 'before-after') {
    if (!f.before.trim() || !f.after.trim()) return null
    return {
      type: 'before-after',
      before: f.before.trim(),
      after: f.after.trim(),
      unit: f.unit.trim() || undefined,
    }
  }
  if (!f.raw.trim()) return null
  return { type: 'raw', raw: f.raw.trim() }
}

export function LogDetailModal({
  open,
  activityId,
  editing,
  onClose,
  onRequestDelete,
}: Props) {
  const isEdit = !!editing
  const [content, setContent] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => todayLocal())
  const [cat, setCat] = useState<LogCategory | null>(null)
  const [comps, setComps] = useState<LogComp[]>([])
  const [cl, setCl] = useState<CoverletterTag[]>([])
  const [mood, setMood] = useState<LogMood | null>(null)
  const [keywords, setKeywords] = useState('')
  const [quantPattern, setQuantPattern] = useState<QuantPattern>('none')
  const [quantFields, setQuantFields] = useState<QuantFields>({
    ...EMPTY_QUANT,
  })
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const create = useCreateLog(activityId)
  const update = useUpdateLog(editing?.activityId ?? activityId)

  // open/editing 변경 시 초기화
  useEffect(() => {
    if (!open) return
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync: editing 전환 시 form 다중 필드 일괄 초기화
      setContent(editing.content)
      setOccurredAt(editing.occurredAt)
      setCat(editing.cat)
      setComps(editing.comps ?? [])
      setCl(editing.cl ?? [])
      setMood(editing.mood)
      setKeywords((editing.keywords ?? []).join(', '))
      const { pattern, fields } = quantToFields(editing.quant)
      setQuantPattern(pattern)
      setQuantFields(fields)
      // 채워진 옵션 있으면 advanced 자동 펼침
      const hasAdvanced =
        !!editing.cat ||
        (editing.comps?.length ?? 0) > 0 ||
        !!editing.quant ||
        (editing.cl?.length ?? 0) > 0 ||
        !!editing.mood ||
        (editing.keywords?.length ?? 0) > 0
      setAdvancedOpen(hasAdvanced)
    } else {
      setContent('')
      setOccurredAt(todayLocal())
      setCat(null)
      setComps([])
      setCl([])
      setMood(null)
      setKeywords('')
      setQuantPattern('none')
      setQuantFields({ ...EMPTY_QUANT })
      setAdvancedOpen(false)
    }
  }, [open, editing])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const quant = useMemo(
    () => fieldsToQuant(quantPattern, quantFields),
    [quantPattern, quantFields],
  )

  if (!open) return null

  async function handleSave() {
    const trimmed = content.trim()
    if (!trimmed) {
      toast.error('내용을 입력해 주세요')
      return
    }
    const kwList = keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // 기본 필드. cat/mood/comps/cl/keywords/quant 는 사용자가 명시한 경우에만 포함.
    // - 빈 값 (null/[]/none) 을 보내지 않음 → backend autoTag 가 fallback 으로 채움 (create).
    // - 사용자가 advanced 에서 비웠더라도 dto 에 안 포함 → 이번 modal 로는 "값 비우기" 불가
    //   (cl 비우기는 Phase B.4 cl-popover · 노트 페이지 sidebar 에서 처리)
    const dto: Record<string, unknown> = {
      content: trimmed,
      occurredAt,
    }
    if (cat) dto.cat = cat
    if (mood) dto.mood = mood
    if (comps.length > 0) dto.comps = comps
    if (cl.length > 0) dto.cl = cl
    if (kwList.length > 0) dto.keywords = kwList
    if (quant) dto.quant = quant

    try {
      if (isEdit && editing) {
        await update.mutateAsync({
          logId: editing.id,
          dto: dto as Parameters<typeof update.mutateAsync>[0]['dto'],
        })
        toast.success('기록이 저장되었어요')
      } else {
        await create.mutateAsync(
          dto as unknown as Parameters<typeof create.mutateAsync>[0],
        )
        toast.success('기록이 추가되었어요')
      }
      onClose()
    } catch {
      toast.error(isEdit ? '저장에 실패했어요' : '추가에 실패했어요')
    }
  }

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="head">
          <div className="ic-box">✶</div>
          <div style={{ flex: 1 }}>
            <div className="t">활동 기록 편집</div>
            <div className="s">
              옵션 정보를 채우면 자소서·면접 AI 정확도가 올라가요
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="body">
          <div className="sect">
            <div className="l">
              기록 내용 <span className="req">필수</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예: 인스타 캠페인 ROAS 1.8 달성"
              autoFocus
            />
          </div>

          <div className="sect">
            <div className="l">
              📅 기록 날짜 <span className="opt">옵션</span>
            </div>
            <div className="hlp">과거 사건이면 정확한 날짜로 보정하세요.</div>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="ai-cta">
            <span className="ic">🪄</span>
            <span className="copy">
              <strong>자동 정리</strong> — 1줄만 적어두면 키워드·활동 유형 기반으로
              분류·매핑을 추정해드려요. 자소서·면접 답변 작성(AI) 시 활용됩니다.
            </span>
            <span className="pro-badge bg-info">자동</span>
          </div>

          <button
            type="button"
            className={`advanced-toggle${advancedOpen ? ' expanded' : ''}`}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <span className="ic">⚙</span>
            <span>
              직접 수정 — 분류·역량·정량·자소서 매핑 (정확도 더 높이고 싶으면)
            </span>
            <span className="chev">▾</span>
          </button>

          <div
            className={`advanced-body${advancedOpen ? ' expanded' : ''}`}
            style={advancedOpen ? undefined : { display: 'none' }}
          >
            <div className="sect">
              <div className="l">
                행동 분류 <span className="opt">옵션 · 1개</span>
              </div>
              <div className="hlp">
                이 기록이 어떤 종류의 행동인가요? 자소서·면접에서 정확히
                분류됩니다.
              </div>
              <div className="chip-select">
                {CAT_CHIPS.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={cat === v ? 'selected' : ''}
                    onClick={() => setCat(cat === v ? null : v)}
                  >
                    <span className={`cat-mark ${v}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sect">
              <div className="l">
                발휘 역량 <span className="opt">옵션 · 복수</span>
              </div>
              <div className="chip-select">
                {COMP_CHIPS.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={comps.includes(v) ? 'selected' : ''}
                    onClick={() =>
                      setComps((arr) =>
                        arr.includes(v)
                          ? arr.filter((x) => x !== v)
                          : [...arr, v],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sect">
              <div className="l">
                정량 결과 <span className="opt">옵션</span>
              </div>
              <div className="hlp">
                숫자로 표현 가능한 결과가 있으면 자소서에 그대로 인용돼요.
              </div>
              <div className="quant-patterns" role="tablist">
                {(['none', 'count', 'before-after', 'raw'] as QuantPattern[]).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={quantPattern === p}
                      onClick={() => setQuantPattern(p)}
                    >
                      {p === 'none'
                        ? '없음'
                        : p === 'count'
                          ? '단일 카운트'
                          : p === 'before-after'
                            ? '개선 (전→후)'
                            : '자유'}
                    </button>
                  ),
                )}
              </div>
              {quantPattern === 'count' && (
                <div className="quant-row count">
                  <input
                    type="text"
                    placeholder="지표명 (예: PR 머지)"
                    value={quantFields.metric}
                    onChange={(e) =>
                      setQuantFields((f) => ({ ...f, metric: e.target.value }))
                    }
                  />
                  <div className="sub-row">
                    <input
                      type="text"
                      className="unit-input"
                      placeholder="값"
                      value={quantFields.value}
                      onChange={(e) =>
                        setQuantFields((f) => ({ ...f, value: e.target.value }))
                      }
                    />
                    <input
                      type="text"
                      className="unit-input"
                      placeholder="단위 (건/회)"
                      value={quantFields.unit}
                      onChange={(e) =>
                        setQuantFields((f) => ({ ...f, unit: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
              {quantPattern === 'before-after' && (
                <div className="quant-row before-after">
                  <input
                    type="text"
                    className="unit-input"
                    placeholder="이전"
                    value={quantFields.before}
                    onChange={(e) =>
                      setQuantFields((f) => ({ ...f, before: e.target.value }))
                    }
                  />
                  <span className="arr">→</span>
                  <input
                    type="text"
                    className="unit-input"
                    placeholder="이후"
                    value={quantFields.after}
                    onChange={(e) =>
                      setQuantFields((f) => ({ ...f, after: e.target.value }))
                    }
                  />
                  <input
                    type="text"
                    className="unit-input"
                    placeholder="단위"
                    value={quantFields.unit}
                    onChange={(e) =>
                      setQuantFields((f) => ({ ...f, unit: e.target.value }))
                    }
                  />
                </div>
              )}
              {quantPattern === 'raw' && (
                <div className="quant-row">
                  <input
                    type="text"
                    placeholder="자유 텍스트 (예: 참석자 200명, 평점 4.7/5)"
                    value={quantFields.raw}
                    onChange={(e) =>
                      setQuantFields((f) => ({ ...f, raw: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="sect">
              <div className="l">
                키워드 <span className="opt">옵션</span>
              </div>
              <div className="hlp">회사·기술·사람 등. 쉼표로 구분.</div>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 결제, 리팩터링"
              />
            </div>

            <div className="sect">
              <div className="l">
                활용 가능 자소서 소재 <span className="opt">옵션 · 복수</span>
              </div>
              <div className="hlp">
                이 기록을 어떤 자소서 답변에 끌어다 쓸 수 있나요?
              </div>
              <div className="chip-select">
                {CL_CHIPS.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={cl.includes(v) ? 'selected' : ''}
                    onClick={() =>
                      setCl((arr) =>
                        arr.includes(v)
                          ? arr.filter((x) => x !== v)
                          : [...arr, v],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sect">
              <div className="l">
                감정 톤 <span className="opt">옵션</span>
              </div>
              <div className="mood-chips">
                {MOOD_CHIPS.map(([v, em, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={mood === v ? 'selected' : ''}
                    onClick={() => setMood(mood === v ? null : v)}
                  >
                    <span className="emoji">{em}</span>
                    <span className="lbl">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="foot">
          {isEdit && (
            <button type="button" className="del" onClick={onRequestDelete}>
              기록 삭제
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="cancel" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="save"
            onClick={handleSave}
            disabled={create.isPending || update.isPending}
          >
            {create.isPending || update.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
