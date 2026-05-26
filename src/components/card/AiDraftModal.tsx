import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { useActivities, useActivityLogs, useReflections } from '@/hooks/useActivities'
import {
  useCoverletterSourceRefs,
  useGenerateAiDraft,
} from '@/hooks/useCoverletterSourceRefs'
import { useCreateCoverletterSourceRef } from '@/hooks/useCoverletterSourceRefs'
import { toast } from '@/stores/toastStore'
import type { Activity } from '@/types/activity'
import type { AiDraftResult } from '@/types/coverletterSourceRef'

/**
 * F6 PR 1 Phase 5 — AI 자소서 답변 생성 모달.
 *
 * **흐름** (mock `coverletter-ai-mock.html`):
 * 1. 사용자가 활동 트리에서 logs/reflections 체크 (V1: 활동별 그룹만, 주제별 분류 후속)
 * 2. "생성" 클릭 → POST /coverletters/:clId/ai-draft
 * 3. 결과: status='ok' → answer 반환 → caller 에게 callback (덮어쓰기 confirm 은 caller 책임)
 *         status='blocked' → reason 표시 + 사용 가능 시점 안내
 * 4. AI 추천 ref 는 응답의 meta.createdRefIds → 캐시 invalidate 로 자동 갱신
 */

interface AiDraftModalProps {
  open: boolean
  onClose: () => void
  clId: string
  clQuestion: string
  clCategory: string | null
  /** 생성 성공 시 호출 — caller 가 덮어쓰기 confirm 후 textarea 에 적용 */
  onAnswerGenerated: (answer: string) => void
}

export function AiDraftModal({
  open,
  onClose,
  clId,
  clQuestion,
  clCategory,
  onAnswerGenerated,
}: AiDraftModalProps) {
  const { data: activities = [], isLoading: actLoading } = useActivities(false)
  const { data: existingRefs = [] } = useCoverletterSourceRefs(clId, open)
  const { mutate: createRef } = useCreateCoverletterSourceRef(clId)
  const { mutate: generate, isPending: generating } = useGenerateAiDraft(clId)

  // 사용자가 사이드 패널에서 새로 선택한 ref id 들 (생성 시 selectedSourceRefIds 로 전달)
  // 이미 추가된 ref 는 existingRefs 가 보유
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set())
  const [skipRecommend, setSkipRecommend] = useState(false)
  const [result, setResult] = useState<AiDraftResult | null>(null)

  const totalSelected = selectedRefIds.size + existingRefs.length

  const handleGenerate = () => {
    setResult(null)
    generate(
      {
        selectedSourceRefIds: [
          ...existingRefs.map((r) => r.id),
          ...Array.from(selectedRefIds),
        ],
        skipRecommend,
      },
      {
        onSuccess: (res) => {
          setResult(res)
          if (res.status === 'ok' && res.answer) {
            onAnswerGenerated(res.answer)
          }
        },
        onError: () => toast.error('생성에 실패했어요. 잠시 후 다시 시도해 주세요.'),
      },
    )
  }

  const handleClose = () => {
    setSelectedRefIds(new Set())
    setSkipRecommend(false)
    setResult(null)
    onClose()
  }

  // 활동 행에서 ref 추가 처리 (log 또는 reflection)
  const handleAddRef = (sourceLogId?: string, sourceReflectionId?: string) => {
    createRef(
      { sourceLogId, sourceReflectionId },
      {
        onSuccess: (newRef) => {
          // 새로 추가된 ref 는 existingRefs 에 자동 합류 (invalidate). 선택 상태 초기화
          setSelectedRefIds((prev) => {
            const next = new Set(prev)
            next.add(newRef.id)
            return next
          })
        },
        onError: (err: unknown) => {
          const errResp = (err as { response?: { data?: { message?: string } } })
            .response?.data
          if (errResp?.message?.includes('이미')) {
            toast.show('이미 추가된 항목이에요.')
          } else {
            toast.error('추가에 실패했어요.')
          }
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="✨ AI 답변 도와줘">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* 문항 표시 */}
        <div className="bg-surface-3 border border-line rounded-lg px-3 py-2.5">
          <div className="text-[10px] text-text-quaternary mb-1">
            {clCategory ?? '기타'}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
            {clQuestion || '(문항 미입력)'}
          </p>
        </div>

        {/* 결과 표시 */}
        {result && (
          <ResultPanel result={result} onRegenerate={handleGenerate} />
        )}

        {/* 트리 — 활동별 그룹 */}
        {!result && (
          <>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-secondary">
                활용할 활동 선택
              </h4>
              <span className="text-[10px] text-text-quaternary">
                선택 <strong className="text-text-secondary">{totalSelected}</strong>개
              </span>
            </div>
            {actLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-surface-2 border border-line rounded-md animate-pulse"
                  />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-text-quaternary text-xs text-center py-6">
                활동 일지에 기록을 먼저 추가해 주세요.
              </p>
            ) : (
              <div className="space-y-1.5">
                {activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    existingRefLogIds={new Set(
                      existingRefs
                        .map((r) => r.sourceLogId)
                        .filter((id): id is string => !!id),
                    )}
                    existingRefReflectionIds={new Set(
                      existingRefs
                        .map((r) => r.sourceReflectionId)
                        .filter((id): id is string => !!id),
                    )}
                    onAdd={handleAddRef}
                  />
                ))}
              </div>
            )}

            {/* AI 추천 토글 */}
            <label className="flex items-center gap-2 text-[11px] text-text-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={!skipRecommend}
                onChange={(e) => setSkipRecommend(!e.target.checked)}
                className="w-3.5 h-3.5 accent-brand"
              />
              <span>
                AI 가 적합한 활동 1개를 자동으로 추천 (별도 한도, 일 3회)
              </span>
            </label>
          </>
        )}
      </div>

      {/* 하단 액션 */}
      {!result && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line">
          <span className="text-[10px] text-text-quaternary flex-1">
            무료 한도 1일 3회 · 월 20회
          </span>
          <button
            onClick={handleClose}
            className="px-3 py-2 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || totalSelected === 0}
            className="px-4 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent disabled:opacity-40 rounded-lg transition-colors"
          >
            {generating ? '생성 중…' : '✨ 답변 생성'}
          </button>
        </div>
      )}

      {result && result.status === 'ok' && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line">
          <span className="text-[10px] text-text-quaternary flex-1">
            답변이 자소서에 적용됐어요
          </span>
          <button
            onClick={handleClose}
            className="px-3 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── 결과 패널 ──

function ResultPanel({
  result,
  onRegenerate,
}: {
  result: AiDraftResult
  onRegenerate: () => void
}) {
  if (result.status === 'blocked') {
    return (
      <div className="bg-warning/8 border border-warning/20 rounded-lg p-3">
        <div className="text-warning text-xs font-semibold mb-1">⚠️ 잠깐, 생성할 수 없어요</div>
        <p className="text-text-secondary text-xs leading-relaxed">
          {result.reason ?? '잠시 후 다시 시도해 주세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-success/8 border border-success/20 rounded-lg p-3">
        <div className="text-success text-xs font-semibold mb-1">✅ 답변이 생성됐어요</div>
        <p className="text-text-secondary text-xs leading-relaxed">
          자소서 textarea 에 자동으로 채워졌어요. 본인 경험으로 다듬어 제출하세요.
        </p>
      </div>
      <details className="bg-surface-3 border border-line rounded-lg p-2.5">
        <summary className="text-[10px] text-text-quaternary cursor-pointer">
          생성 정보
        </summary>
        <div className="mt-2 space-y-1 text-[10px] text-text-quaternary font-mono">
          <div>활용 logs: {result.meta?.logsUsed ?? 0}개</div>
          <div>활용 회고: {result.meta?.reflectionsUsed ?? 0}개</div>
          <div>입력 토큰: ~{result.meta?.estimatedInputTokens ?? 0}</div>
          {result.meta?.droppedCount ? (
            <div className="text-warning">
              context cap 초과로 {result.meta.droppedCount}개 제외됨
            </div>
          ) : null}
        </div>
      </details>
      <button
        onClick={onRegenerate}
        className="w-full text-[11px] text-text-tertiary hover:text-text-secondary border border-dashed border-line hover:border-line-strong py-2 rounded-lg transition-colors"
      >
        ↻ 다시 생성 (한도 1회 차감)
      </button>
    </div>
  )
}

// ── 활동 행 (expand 시 logs/reflections lazy load) ──

interface ActivityRowProps {
  activity: Activity
  existingRefLogIds: Set<string>
  existingRefReflectionIds: Set<string>
  onAdd: (sourceLogId?: string, sourceReflectionId?: string) => void
}

function ActivityRow({
  activity,
  existingRefLogIds,
  existingRefReflectionIds,
  onAdd,
}: ActivityRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { data: logs = [], isLoading: logsLoading } = useActivityLogs(
    expanded ? activity.id : undefined,
  )
  const { data: reflections = [], isLoading: refLoading } = useReflections(
    expanded ? activity.id : undefined,
  )

  return (
    <div className="border border-line bg-surface-2 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${activity.name} 펼치기/접기`}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-text-secondary hover:bg-surface-3 transition-colors"
      >
        <span className="text-[10px] text-text-quaternary" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="flex-1 text-left font-medium">{activity.name}</span>
        {activity.org && (
          <span className="text-[10px] text-text-quaternary">{activity.org}</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-line px-2 py-1.5 space-y-1">
          {logsLoading || refLoading ? (
            <div className="text-[10px] text-text-quaternary text-center py-2">
              불러오는 중…
            </div>
          ) : logs.length === 0 && reflections.length === 0 ? (
            <div className="text-[10px] text-text-quaternary text-center py-2">
              이 활동에 기록이 없어요.
            </div>
          ) : (
            <>
              {logs.map((l) => {
                const added = existingRefLogIds.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => !added && onAdd(l.id, undefined)}
                    disabled={added}
                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors ${
                      added
                        ? 'text-text-quaternary bg-surface-3 cursor-default'
                        : 'text-text-tertiary hover:bg-surface-3 hover:text-text-secondary'
                    }`}
                  >
                    <span className="text-[10px] mr-1.5">
                      {added ? '✓' : '+'}
                    </span>
                    <span className="text-[10px] text-text-quaternary mr-1.5">
                      {l.occurredAt}
                    </span>
                    {l.content}
                  </button>
                )
              })}
              {reflections.map((r) => {
                const added = existingRefReflectionIds.has(r.id)
                return (
                  <button
                    key={r.id}
                    onClick={() => !added && onAdd(undefined, r.id)}
                    disabled={added}
                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors ${
                      added
                        ? 'text-text-quaternary bg-surface-3 cursor-default'
                        : 'text-text-tertiary hover:bg-surface-3 hover:text-text-secondary'
                    }`}
                  >
                    <span className="text-[10px] mr-1.5">
                      {added ? '✓' : '+'}
                    </span>
                    <span className="text-[10px] text-warning mr-1.5">회고</span>
                    {r.content.slice(0, 60)}
                    {r.content.length > 60 ? '…' : ''}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
