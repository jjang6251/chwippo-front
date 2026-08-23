import { useMemo, useState, type ReactNode } from 'react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import { AiFeedbackSection } from '@/components/coverletter/AiFeedbackSection'
import { Modal } from '@/components/common/Modal'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { cleanupCoverletter } from '@/utils/coverletterCleanup'
import { countChars } from '@/utils/charCount'
import type { CoverletterFeedback } from '@/types/coverletter'

interface CoverLetterCleanupModalProps {
  text: string
  limit: number | null
  onClose: () => void
  /** A1 — AI 심층 점검 층 (2층 구조). 전달 + AI 켜짐 시에만 노출 */
  aiFeedbackClId?: string | null
  /** 점검의 직무 게이트용 */
  applicationId: string
  /** 서버가 저장한 마지막 점검 결과 — 모달 재진입 시 표시 */
  lastFeedback?: CoverletterFeedback | null
  lastFeedbackAt?: string | null
  onApply: (cleaned: string) => void
}

function highlight(text: string, ranges: Array<[number, number]>): ReactNode {
  if (ranges.length === 0) return text
  const out: ReactNode[] = []
  let pos = 0
  ranges.forEach(([s, e], i) => {
    if (s > pos) out.push(<span key={`t${i}`}>{text.slice(pos, s)}</span>)
    out.push(
      <mark key={`m${i}`} className="bg-danger/25 text-danger rounded-[2px] px-px">
        {text.slice(s, e)}
      </mark>,
    )
    pos = e
  })
  if (pos < text.length) out.push(<span key="end">{text.slice(pos)}</span>)
  return out
}

export function CoverLetterCleanupModal({ text, limit, onClose, onApply, aiFeedbackClId, applicationId, lastFeedback, lastFeedbackAt }: CoverLetterCleanupModalProps) {
  const result = useMemo(() => cleanupCoverletter(text, limit), [text, limit])
  const { cleaned, issues, ranges } = result
  const nothingToFix = issues.length === 0
  /* 정리 전후 글자수 — 취준생에게 이 숫자가 제출 가능 여부를 가른다 */
  /**
   * 형식 정리 층 접기 — 🔴 **모달을 닫지 않고 이 층만 치운다** (2026-08-23 CEO).
   * 예전 「취소」는 이름과 동작이 어긋났다: 무엇을 취소하는지 불분명한데 실제로는
   * **모달 전체를 닫아 AI 점검까지 같이 사라졌다.** 게다가 ×와 하는 일이 같아 중복이었다.
   * 이름을 「접기」로 바꾸고 헤더에 다시 펼 손잡이를 둔다(앱의 다른 접기와 같은 관례).
   * 모달을 닫는 건 이제 ×뿐이다.
   */
  const [formatOpen, setFormatOpen] = useState(true)
  const beforeCount = useMemo(() => countChars(text).total, [text])
  const afterCount = useMemo(() => countChars(cleaned).total, [cleaned])
  const onlyOverLimit = !nothingToFix && cleaned === text

  return (
    <Modal open onClose={onClose} title="자소서 검사" width="max-w-2xl">
      {/*
        무엇을 검사하는지 안내.
        🔴 **「맞춤법은 검사하지 않아요」를 따로 세운다** (2026-08-23). 이건 기대를 정정하는
        문장인데 13개 항목 나열에 묻혀 11px 로 깔려 있었다 — 자소서를 자동으로 손대는
        기능이라 **무엇이 바뀌는지는 반드시 읽혀야 한다.** 본문도 13px 로 올렸다.
      */}
      {/*
        🔴 **검사 항목 전체 목록은 「걸린 게 없을 때만」 보인다** (2026-08-23).
        걸린 게 있으면 바로 아래 「발견 항목」이 이름·개수까지 말해 준다 — 위에서 13개를
        또 나열하면 **같은 이름을 두 번 읽히고** 정작 결과를 읽기 전에 벽이 된다.
        반대로 걸린 게 없으면 아래가 비어서, 목록이 없으면 **검사를 한 건지 통과한 건지**
        구분이 안 된다. 그래서 지우지 않고 조건부로 둔다.
      */}
      <div className="bg-card border border-line rounded-lg px-3 py-2.5 mb-4">
        <p className="text-[13px] font-semibold text-text-secondary">
          맞춤법은 검사하지 않아요 — 형식만 정리합니다
        </p>
        {nothingToFix && (
          <p className="text-[13px] text-text-quaternary leading-relaxed mt-1">
            과도한 빈 줄(문단 구분 1개는 유지)·연속 공백, 줄 앞뒤 공백, 탭, 문장 도중 줄바꿈(쉼표 뒤), 한글 자모 단독(ㅋㅋ), 이모지·그림문자, 특수 공백, 둥근 따옴표→직선, 전각 문장부호→반각, 반복된 문장부호, 허용 외 특수문자, 글자수 초과.
          </p>
        )}
      </div>

      {nothingToFix ? (
        <div className="text-center py-6">
          <div className="mb-2"><Sparkles size={24} strokeWidth={1.75} aria-hidden="true" className="inline-block" /></div>
          <p className="text-text-secondary text-sm">정리할 내용이 없어요. 깔끔합니다!</p>
          {aiFeedbackClId && <AiFeedbackSection clId={aiFeedbackClId} applicationId={applicationId} answer={text} onApplyText={onApply} lastFeedback={lastFeedback} lastFeedbackAt={lastFeedbackAt} />}
          <button onClick={onClose} className="mt-5 px-4 py-2 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
            닫기
          </button>
        </div>
      ) : (
        <>
          {/* 층 머리 — 접혀 있어도 「무엇이 몇 곳 걸렸는지」는 남는다 */}
          <button
            type="button"
            onClick={() => setFormatOpen((v) => !v)}
            aria-expanded={formatOpen}
            className="w-full flex items-center gap-2 mb-3 text-left"
          >
            <CollapsibleChevron open={formatOpen} />
            <span className="text-sm font-semibold text-text-primary">형식 정리</span>
            <span className="text-xs text-text-quaternary">{issues.length}곳 발견</span>
          </button>

          {formatOpen && (
          <>
          {/* 발견된 항목 */}
          <ul className="space-y-1.5 mb-4">
            {issues.map((iss) => (
              <li key={iss.key} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-danger flex-none" />
                <span className="flex-1">{iss.label}</span>
                {iss.key !== 'overLimit' && <span className="font-mono text-[11px] text-text-quaternary flex-none">{iss.count}곳</span>}
              </li>
            ))}
          </ul>

          {/* 원본 (문제 부분 강조) */}
          <div className="mb-3">
            <p className="text-[11px] font-medium text-text-tertiary mb-1.5">원본 — 빨간 부분이 정리 대상</p>
            <div className="max-h-40 overflow-y-auto bg-surface-2 border border-line rounded-lg px-3 py-2.5 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {highlight(text, ranges)}
            </div>
          </div>

          {!onlyOverLimit && (
            <div className="mb-3">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <p className="text-[11px] font-medium text-text-tertiary">정리 후</p>
                {/* 🔴 글자수는 제출 가능 여부를 가르는 숫자다 — 몇 자 줄었는지 보여준다 */}
                <p className="font-mono text-[11px] text-text-quaternary">
                  {beforeCount.toLocaleString()}자 → <span className="text-text-secondary font-medium">{afterCount.toLocaleString()}자</span>
                  {limit != null && afterCount <= limit && beforeCount > limit && (
                    <span className="ml-1 text-success">· 제한 안으로</span>
                  )}
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto bg-success/5 border border-success/20 rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {cleaned || <span className="text-text-quaternary">(빈 내용)</span>}
              </div>
            </div>
          )}

          {issues.some((i) => i.key === 'overLimit') && (
            <p className="text-[11px] text-warning mb-3">
              <span className="inline-flex items-center gap-1">
                <TriangleAlert size={13} strokeWidth={1.75} aria-hidden="true" />
                글자수 초과는 자동으로 줄이지 않아요. 직접 다듬어 주세요.
              </span>
            </p>
          )}

          {/*
            🔴 **CTA 는 「정리 후」 바로 밑** — 이 버튼은 **형식 정리 결과**를 적용한다.
            한때 AI 층 아래로 내렸다가 되돌렸다(2026-08-23 CEO): 그러면 「이게 AI 점검 결과를
            적용하는 건가?」로 읽힌다. **버튼은 자기가 적용할 것 바로 옆에 있어야 한다.**

            그런데 원래 이 버튼은 `onClose()` 로 **모달을 닫았고**, 그래서 형식 정리를 한 사람은
            아래 AI 층을 영영 못 봤다. → **닫지 않는다.** 적용하면 `text` 가 갱신돼 화면이
            「정리할 내용이 없어요」로 바뀌고, AI 층은 그대로 남는다. 한 번의 행동으로
            **결과 확인과 다음 단계**가 같이 온다.
          */}
          <div className="flex gap-2">
            <button onClick={() => setFormatOpen(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
              접기
            </button>
            {!onlyOverLimit && (
              <button
                onClick={() => onApply(cleaned)}
                className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors"
              >
                정리된 내용으로 바꾸기
              </button>
            )}
          </div>
          </>
          )}
          {aiFeedbackClId && <AiFeedbackSection clId={aiFeedbackClId} applicationId={applicationId} answer={text} onApplyText={onApply} lastFeedback={lastFeedback} lastFeedbackAt={lastFeedbackAt} />}
        </>
      )}
    </Modal>
  )
}
