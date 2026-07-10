import { useEffect, useMemo, useRef, useState } from 'react'
import { CoverletterDiffModal } from '@/components/coverletter/CoverletterDiffModal'
import { CoverletterBulkApplyModal } from '@/components/coverletter/CoverletterBulkApplyModal'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { Modal } from '@/components/common/Modal'
import {
  useActivities,
  useActivityLogs,
} from '@/hooks/useActivities'
import { useCoverletters } from '@/hooks/useApplicationCoverletters'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import {
  PENDING_ASSISTANT_MSG_ID,
  useCoverletterMessages,
  useDeleteCoverletterMessages,
  useSendCoverletterChatStream,
} from '@/hooks/useCoverletterDoc'
import { toast } from '@/stores/toastStore'
import { clearChatPending, getChatPending } from '@/utils/chatPendingMarker'
import { countChars } from '@/utils/charCount'
import { countFillPlaceholders } from '@/utils/coverletterPlaceholder'
import type { Activity } from '@/types/activity'
import type {
  CoverletterChatMessage,
  CoverletterSuggestedUpdate,
  MyinfoFieldKey,
} from '@/api/coverletterDoc'
import { MyinfoCoverletterTree } from './MyinfoCoverletterTree'
import { AwardTreeSection } from './AwardTreeSection'

/**
 * F1 자소서 풀페이지 Phase D — AI 채팅 패널.
 *
 * 데스크탑 sticky / 모바일 bottom sheet 양립 — 부모가 wrapper 결정.
 *
 * 기능:
 * - 메시지 이력 (DB 영구, ASC)
 * - empty state + 4 chips (사용자 인식)
 * - 메시지 입력 + Send (Enter / Shift+Enter)
 * - suggestedUpdates inline preview + 적용/거절 (race confirm 은 부모가 처리 — onApplyUpdate callback)
 * - 활동 트리 default expand (사용자 명시 source_refs 선택)
 * - DELETE 대화 버튼 (confirm modal)
 * - AiQuotaChip + quota blocked 시 입력 disabled
 */

interface Props {
  applicationId: string
  /** suggestedUpdate 적용 — 부모가 race confirm 후 update mutation. */
  onApplyUpdate: (update: CoverletterSuggestedUpdate) => void
  /** 모바일 bottom sheet 닫기 (데스크탑은 무시) */
  onCloseMobile?: () => void
  /** 카드의 "✨ AI 에게 묻기" 클릭 시 prefill (input 자동 채움 + focus) */
  prefill?: { clId: string; question: string; nonce: number } | null
  /** prefill 소비 후 callback — 부모가 state 비움 */
  onPrefillConsumed?: () => void
}

/**
 * Quick command chips.
 * - requireSelectedLog: true 면 활동 미선택 시 disabled (활동 자료 없으면 무의미).
 */
const CHIPS = [
  {
    label: '전체 답변 생성',
    prompt: '모든 자소서 문항의 답변을 작성해줘.',
    requireSelectedLog: false,
  },
  {
    label: '활동 더 자세히',
    prompt: '내 활동 일지의 가장 관련 있는 경험을 더 자세히 답변에 녹여줘.',
    requireSelectedLog: true,
  },
] as const

export function CoverletterChatPanel({
  applicationId,
  onApplyUpdate,
  onCloseMobile,
  prefill,
  onPrefillConsumed,
}: Props) {
  // 재진입 "생성 중" 안내 — 직전 스트림이 새로고침 등으로 끊겼는지 marker 로 감지.
  // 배너 활성 중엔 messages 를 5초 폴링해 뒤늦게 저장된 응답을 잡는다.
  const [pendingBanner, setPendingBanner] = useState<{ at: number } | null>(null)
  const bannerShownRef = useRef(false)
  const { data: messagesRaw, isLoading } = useCoverletterMessages(
    applicationId,
    true,
    pendingBanner ? 5000 : false,
  )
  // 방어 — backend dev restart 도중 vite proxy HTML, 또는 setQueryData race 로 undefined 섞임 차단
  const messages = useMemo(
    () =>
      Array.isArray(messagesRaw)
        ? messagesRaw.filter(
            (m): m is CoverletterChatMessage => !!m && typeof m.id === 'string',
          )
        : [],
    [messagesRaw],
  )
  const { sendStream, sending } = useSendCoverletterChatStream(applicationId)
  const { mutate: deleteAll, isPending: deleting } = useDeleteCoverletterMessages(applicationId)
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked('coverletter_chat')
  const ensureAiConsent = useRequireAiConsent()
  // citation 칩 — 현재 자소서 N문항 정보 (clId → question + 1-based 번호 매핑)
  const { data: cls = [] } = useCoverletters(applicationId, !!applicationId)
  const clMap = useMemo(
    () =>
      new Map(
        cls.map((c, idx) => [c.id, { ...c, number: idx + 1 }]),
      ),
    [cls],
  )

  // diff modal state (Phase G.3 — 적용 전 word-level diff)
  const [pendingUpdate, setPendingUpdate] = useState<CoverletterSuggestedUpdate | null>(
    null,
  )
  // "모두 적용" 요약 모달 (미처리 제안 2개+ 일괄 적용)
  const [bulkUpdates, setBulkUpdates] = useState<{
    msgId: string
    updates: CoverletterSuggestedUpdate[]
  } | null>(null)
  // 자료 0개 + "전체 답변 생성" 시 안내 (대기 중인 prompt 보관)
  const [nudge, setNudge] = useState<{ prompt: string } | null>(null)

  const [input, setInput] = useState('')
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  const [selectedMyinfoKeys, setSelectedMyinfoKeys] = useState<Set<MyinfoFieldKey>>(new Set())
  const [selectedAwardIds, setSelectedAwardIds] = useState<Set<string>>(new Set())
  // 참고 자료 wrapper — 3개 sub-tree 한 번에 collapse/expand. default collapse (input 자리 확보).
  const [referencesOpen, setReferencesOpen] = useState(false)
  const [activityTreeOpen, setActivityTreeOpen] = useState(false)
  const [myinfoTreeOpen, setMyinfoTreeOpen] = useState(false)
  const [awardTreeOpen, setAwardTreeOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appliedUpdateKeys, setAppliedUpdateKeys] = useState<Set<string>>(new Set())
  const listEndRef = useRef<HTMLDivElement | null>(null)

  // 새 메시지 도착 시 스크롤 맨 아래
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // Task ③ — 스트리밍 중 이탈(새로고침·탭 닫기) 경고. 서버는 끊겨도 완주·저장하므로
  // 문구는 참고용 (표준 beforeunload 는 커스텀 문구 미지원).
  useEffect(() => {
    if (!sending) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sending])

  // marker 이후의 assistant 메시지가 이미 있는지 판단용 (placeholder 제외)
  const lastAssistantAt = useMemo(() => {
    let max = 0
    for (const m of messages) {
      if (m.role === 'assistant' && m.id !== PENDING_ASSISTANT_MSG_ID) {
        const t = new Date(m.createdAt).getTime()
        if (t > max) max = t
      }
    }
    return max
  }, [messages])

  // Task ④ — 재진입 "생성 중" 배너 + 응답 도착 감지 + 90초 안전 타임아웃.
  // 같은 세션 활성 스트림 중(sending)엔 placeholder 가 이미 표시되므로 배너 스킵.
  useEffect(() => {
    if (sending) return
    const marker = getChatPending(applicationId)
    if (!marker) {
      bannerShownRef.current = false
      // 다른 자소서로 전환 시 남아있던 배너 정리 (mount 시 동기 set — AISummarySection 과 동일 패턴)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingBanner(null)
      return
    }
    const arrived = lastAssistantAt >= marker.at
    const stale = Date.now() - marker.at >= 90_000
    if (arrived || stale) {
      // 응답 도착(arrived) 또는 90초 초과(stale, 서버 실패 가능) → marker·배너 정리.
      // 배너가 떠 있던 상태에서 응답이 도착했을 때만 토스트로 알림.
      clearChatPending(applicationId)
      if (arrived && bannerShownRef.current) toast.show('✨ AI 응답이 도착했어요')
      bannerShownRef.current = false
      setPendingBanner(null)
      return
    }
    // 아직 응답 전 → 배너 표시 + 남은 시간만큼 안전 타임아웃
    bannerShownRef.current = true
    setPendingBanner(marker)
    const id = setTimeout(() => {
      clearChatPending(applicationId)
      setPendingBanner(null)
      bannerShownRef.current = false
    }, 90_000 - (Date.now() - marker.at))
    return () => clearTimeout(id)
  }, [applicationId, lastAssistantAt, sending])

  // 카드의 "✨ AI 에게 묻기" prefill — input 자동 채움 + focus + scroll.
  // prefill 은 외부 trigger (nonce 가 매번 변경) 라 effect 에서 setState 정상.
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (!prefill) return
    const q = prefill.question.slice(0, 30)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(`"${q}${prefill.question.length > 30 ? '…' : ''}" 문항을 `)
    onPrefillConsumed?.()
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      // 데스크탑: 입력창이 viewport 안 보이면 scroll. 모바일은 bottom sheet 가 처리.
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [prefill, onPrefillConsumed])

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || sending || quotaBlocked) return
    if (!(await ensureAiConsent())) return
    // 즉시 input clear — placeholder bubble 이 list 끝에 추가됨 (hook onMutate).
    // selection 은 유지 (multi-turn follow-up 자연스러움). 사용자가 tree 헤더 ✕ 로 수동 clear.
    setInput('')

    await sendStream(
      {
        userMessage: text,
        selectedLogIds: selectedLogIds.size > 0 ? Array.from(selectedLogIds) : undefined,
        selectedMyinfoFieldKeys:
          selectedMyinfoKeys.size > 0 ? Array.from(selectedMyinfoKeys) : undefined,
        selectedAwardIds:
          selectedAwardIds.size > 0 ? Array.from(selectedAwardIds) : undefined,
      },
      (res) => {
        // streaming done — assistantStatus enum 분기 (Phase 1 토스트 정책 유지)
        const status = res.assistantStatus
        const reason = res.assistantStatusReason
        const hasSuggestion =
          (res.assistantMessage?.suggestedUpdates?.length ?? 0) > 0
        if (status === 'ok') {
          toast.show(
            hasSuggestion
              ? '✨ AI 응답 도착 — 제안된 답변을 확인하세요'
              : '✨ AI 응답이 도착했어요',
          )
        } else if (status === 'fallback_ok') {
          toast.show('⚡ 임시 GPT 로 응답했어요 (Claude 일시 장애)')
        } else if (status === 'truncated') {
          toast.error(reason ?? '답변이 길어 일부가 잘렸어요. 다시 짧게 요청해 주세요.')
        } else if (status === 'blocked_consent') {
          toast.error('AI 사용 동의가 필요해요. 다시 시도해 주세요.')
        } else if (status === 'blocked_quota') {
          toast.error(reason ?? 'AI 사용 한도에 도달했어요.')
        } else if (status === 'blocked_moderation') {
          toast.error('입력 내용이 가이드라인을 위반해 차단됐어요.')
        } else {
          toast.error(reason ?? '응답 생성에 실패했어요. 잠시 후 다시 시도해 주세요.')
        }
      },
      (errMsg) => {
        toast.error(errMsg || '메시지 전송 실패. 잠시 후 다시 시도해주세요.')
      },
    )
  }

  const handleChipClick = (chip: (typeof CHIPS)[number]) => {
    const noReferences =
      selectedLogIds.size + selectedMyinfoKeys.size + selectedAwardIds.size === 0
    if (chip.label === '전체 답변 생성' && noReferences) {
      setNudge({ prompt: chip.prompt })
      return
    }
    handleSend(chip.prompt)
  }

  // 적용 클릭 → diff modal 띄움 (사용자가 변경 영역 확인 후 명시 적용)
  const handleApplyClick = (msgId: string, update: CoverletterSuggestedUpdate) => {
    const key = `${msgId}:${update.clId}`
    if (appliedUpdateKeys.has(key)) return
    setPendingUpdate({ ...update, __key: key } as CoverletterSuggestedUpdate & {
      __key: string
    })
  }

  const handleDiffApply = () => {
    if (!pendingUpdate) return
    const { __key, ...update } = pendingUpdate as CoverletterSuggestedUpdate & {
      __key: string
    }
    onApplyUpdate(update)
    setAppliedUpdateKeys((prev) => {
      const next = new Set(prev)
      next.add(__key)
      return next
    })
    setPendingUpdate(null)
  }

  // "모두 적용" — 미처리 제안을 개별 diff 모달 없이 순회 적용 (이 요약 모달이 확인 대체)
  const handleBulkApply = (msgId: string, updates: CoverletterSuggestedUpdate[]) => {
    updates.forEach((u) => {
      const key = `${msgId}:${u.clId}`
      if (appliedUpdateKeys.has(key)) return
      onApplyUpdate(u)
    })
    setAppliedUpdateKeys((prev) => {
      const next = new Set(prev)
      updates.forEach((u) => next.add(`${msgId}:${u.clId}`))
      return next
    })
    setBulkUpdates(null)
  }

  const handleReject = (msgId: string, clId: string) => {
    const key = `${msgId}:${clId}`
    setAppliedUpdateKeys((prev) => {
      const next = new Set(prev)
      next.add(key) // 거절도 동일 state 로 (UI = 회색)
      return next
    })
  }

  const handleDelete = () => {
    deleteAll(undefined, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        setAppliedUpdateKeys(new Set())
        toast.show('대화를 삭제했어요.')
      },
      onError: () => toast.error('삭제 실패'),
    })
  }

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* 헤더 (미니멀 — Linear 식) */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-line">
        <span className="text-text-tertiary text-xs font-medium uppercase tracking-wider">
          AI
        </span>
        <div className="flex-1" />
        {messages.length > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-text-quaternary hover:text-danger text-[11px]"
            title="대화 전체 삭제"
            aria-label="대화 삭제"
          >
            🗑
          </button>
        )}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="패널 닫기"
            className="lg:hidden text-text-quaternary hover:text-text-primary w-7 h-7 flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>

      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 bg-surface-2 border border-line rounded animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              clMap={clMap}
              appliedUpdateKeys={appliedUpdateKeys}
              onApply={(u) => handleApplyClick(m.id, u)}
              onReject={(clId) => handleReject(m.id, clId)}
              onBulkApply={(updates) => setBulkUpdates({ msgId: m.id, updates })}
            />
          ))
        )}
        {pendingBanner && (
          <div
            aria-live="polite"
            className="bg-info/8 border border-info/20 text-info text-[11px] rounded-lg p-2.5"
          >
            ⏳ 직전 요청의 답변을 아직 생성 중이에요 — 완료되면 대화에 나타나요.
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* 참고 자료 wrapper — 활동·자소서 소재·수상 3개 sub-tree 를 한 번에 collapse/expand */}
      <ReferencesWrapper
        open={referencesOpen}
        onToggle={() => setReferencesOpen((v) => !v)}
        totalSelected={selectedLogIds.size + selectedMyinfoKeys.size + selectedAwardIds.size}
        onClearAll={() => {
          setSelectedLogIds(new Set())
          setSelectedMyinfoKeys(new Set())
          setSelectedAwardIds(new Set())
        }}
      >
        <ActivityTreeSection
          applicationId={applicationId}
          open={activityTreeOpen}
          onToggle={() => setActivityTreeOpen((v) => !v)}
          selectedLogIds={selectedLogIds}
          onSelectChange={setSelectedLogIds}
        />
        <MyinfoCoverletterTree
          open={myinfoTreeOpen}
          onToggle={() => setMyinfoTreeOpen((v) => !v)}
          selectedKeys={selectedMyinfoKeys}
          onSelectChange={setSelectedMyinfoKeys}
        />
        <AwardTreeSection
          open={awardTreeOpen}
          onToggle={() => setAwardTreeOpen((v) => !v)}
          selectedAwardIds={selectedAwardIds}
          onSelectChange={setSelectedAwardIds}
        />
      </ReferencesWrapper>

      {/* 입력창 — frame 강화 (Claude.ai · ChatGPT 식 통합 box) */}
      <div className="border-t border-line pt-2.5">
        {/* Quick action chips — 채팅 시작 후에도 항상 노출. 일부는 활동 미선택 시 disabled. */}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {CHIPS.map((c) => {
            const needsLog = c.requireSelectedLog && selectedLogIds.size === 0
            const isDisabled = sending || quotaBlocked || needsLog
            const isGenerateAll = c.label === '전체 답변 생성'
            // 예상 코인 — 문항당 약 4.5코인 (output 5× 가중 환산 어림). 실제 차감은 토큰 사용량 기준.
            const estimatedCoin =
              isGenerateAll && cls.length > 0
                ? Math.max(1, Math.round(cls.length * 4.5))
                : 0
            const label =
              isGenerateAll && estimatedCoin > 0
                ? `${c.label} (≈${estimatedCoin}코인)`
                : c.label
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => handleChipClick(c)}
                disabled={isDisabled}
                title={
                  needsLog
                    ? '활동 일지를 먼저 선택하세요'
                    : isGenerateAll
                      ? '실제 차감은 토큰 사용량 기준이에요 — 답변 길이·문항 수에 따라 달라져요. 문항이 5개 이상이면 두 번에 나눠 생성돼요.'
                      : undefined
                }
                className="text-[11px] px-2 py-1 rounded-full bg-card hover:bg-card-strong border border-line hover:border-brand/40 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card disabled:hover:border-line"
              >
                {label}
              </button>
            )
          })}
        </div>
        {selectedLogIds.size === 0 &&
          selectedMyinfoKeys.size === 0 &&
          selectedAwardIds.size === 0 && (
            <p className="text-[10px] text-text-quaternary mb-2 leading-relaxed">
              💡 아래 활동 일지 · 자소서 소재 · 수상을 체크하면 AI 가 그 자료를 참고해서 답변합니다.
            </p>
          )}
        {quotaBlocked && (
          <div className="text-warning text-[11px] mb-2">⚠️ {quotaReason}</div>
        )}
        {nudge && (
          <div className="bg-brand/8 border border-brand/25 rounded-lg p-2.5 text-xs mb-2">
            <p className="text-text-secondary leading-relaxed mb-2">
              활동을 선택하면 내 경험이 답변에 들어가요. 자료 없이 만들면 [본인 경험
              채우기] 빈칸이 섞인 일반적인 답변이 나와요.
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setNudge(null)
                  setReferencesOpen(true)
                  setActivityTreeOpen(true)
                }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded bg-brand text-text-primary hover:bg-accent transition-colors"
              >
                자료 선택하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = nudge.prompt
                  setNudge(null)
                  handleSend(p)
                }}
                className="text-[11px] px-2.5 py-1 rounded text-text-secondary border border-line hover:text-text-primary transition-colors"
              >
                그냥 진행
              </button>
            </div>
          </div>
        )}
        <div
          className={`flex items-end gap-2 bg-input border rounded-2xl p-2 transition-all ${quotaBlocked ? 'border-line opacity-60' : 'border-line focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10'}`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              sending
                ? '✨ AI 가 답변을 작성중이에요 — 끝나면 다음 메시지를 보낼 수 있어요'
                : quotaBlocked
                  ? '한도 초과 — 다시 사용 가능할 때까지 기다려주세요'
                  : '메시지 입력 (Enter 전송 · Shift+Enter 줄바꿈)'
            }
            disabled={quotaBlocked || sending}
            rows={2}
            maxLength={5000}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50 px-1 py-1"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || quotaBlocked}
            className="shrink-0 w-9 h-9 flex items-center justify-center text-base font-bold text-text-primary bg-brand hover:bg-accent active:scale-95 disabled:opacity-30 disabled:hover:bg-brand rounded-xl transition-all"
            aria-label="메시지 전송"
            title="메시지 전송 (Enter)"
          >
            {sending ? (
              <span className="animate-pulse">⋯</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <AiQuotaChip feature="coverletter_chat" />
          <span className="text-[10px] text-text-quaternary">
            {input.length > 0 && `${input.length} / 5000`}
            {selectedLogIds.size > 0 && ` · 활동 ${selectedLogIds.size}개`}
          </span>
        </div>
      </div>

      {/* word-level diff preview (Phase G.3 — Cursor·JobSprout 패턴) */}
      {pendingUpdate && (
        <CoverletterDiffModal
          open={true}
          onClose={() => setPendingUpdate(null)}
          question={clMap.get(pendingUpdate.clId)?.question ?? '문항'}
          currentAnswer={clMap.get(pendingUpdate.clId)?.answer ?? ''}
          newAnswer={pendingUpdate.newAnswer}
          onApply={handleDiffApply}
        />
      )}

      {/* "모두 적용" 요약 모달 */}
      {bulkUpdates && (
        <CoverletterBulkApplyModal
          open={true}
          onClose={() => setBulkUpdates(null)}
          items={bulkUpdates.updates.map((u) => {
            const cl = clMap.get(u.clId)
            return {
              clId: u.clId,
              number: cl?.number,
              question: cl?.question ?? '문항',
              newAnswer: u.newAnswer,
              charLimit: cl?.charLimit ?? null,
            }
          })}
          onConfirm={() => handleBulkApply(bulkUpdates.msgId, bulkUpdates.updates)}
        />
      )}

      {/* 대화 삭제 confirm */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="대화를 모두 삭제할까요?"
      >
        <p className="text-text-tertiary text-xs leading-relaxed mb-5">
          이 자소서의 AI 대화 이력 ({messages.length}개) 가 모두 삭제됩니다.
          되돌릴 수 없어요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleting}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors disabled:opacity-40"
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── 참고 자료 wrapper — 3개 sub-tree 를 한 번에 collapse/expand ──
function ReferencesWrapper({
  open,
  onToggle,
  totalSelected,
  onClearAll,
  children,
}: {
  open: boolean
  onToggle: () => void
  totalSelected: number
  onClearAll: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-line">
      <div className="flex items-center gap-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 text-text-secondary hover:text-text-primary text-[11px] font-semibold transition-colors text-left"
        >
          <span className="flex items-center gap-1.5">
            📎 참고 자료
            {totalSelected > 0 && (
              <span className="text-brand font-mono">· 총 {totalSelected} 선택</span>
            )}
          </span>
          <CollapsibleChevron open={open} />
        </button>
        {totalSelected > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClearAll()
            }}
            className="shrink-0 text-text-quaternary hover:text-danger text-[11px] px-1.5 py-0.5 rounded transition-colors"
            title="모든 선택 초기화"
            aria-label="모든 선택 초기화"
          >
            ✕ 전체
          </button>
        )}
      </div>
      {open && <div className="pl-1.5">{children}</div>}
    </div>
  )
}

// ── empty state ──
// chip 들은 input 위 chip bar 에 항상 표시 — 여기선 안내 텍스트만
function EmptyState() {
  return (
    <div className="space-y-2.5 py-2">
      <p className="text-text-tertiary text-xs leading-relaxed">
        AI 와 대화하며 자소서를 작성해보세요. 활동 일지·회사 조사 정보를
        자동으로 활용합니다. 아래 빠른 명령 또는 직접 입력으로 시작.
      </p>
      <p className="text-text-quaternary text-[11px] leading-relaxed">
        제출 전 점검은 각 문항 카드의 [검사] 버튼에서 할 수 있어요.
      </p>
    </div>
  )
}

// ── 메시지 bubble + suggestedUpdates inline ──
function MessageBubble({
  message,
  clMap,
  appliedUpdateKeys,
  onApply,
  onReject,
  onBulkApply,
}: {
  message: CoverletterChatMessage
  clMap: Map<string, { id: string; question: string; answer: string | null; category: string | null; charLimit: number | null; number: number }>
  appliedUpdateKeys: Set<string>
  onApply: (u: CoverletterSuggestedUpdate) => void
  onReject: (clId: string) => void
  onBulkApply: (updates: CoverletterSuggestedUpdate[]) => void
}) {
  const isUser = message.role === 'user'
  const citations = message.citations
  const isPendingAssistant = message.id === PENDING_ASSISTANT_MSG_ID
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand/15 text-brand text-xs"
          aria-hidden="true"
        >
          ✨
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? 'bg-brand text-text-primary rounded-tr-sm'
            : 'bg-surface-2 text-text-primary border border-line rounded-tl-sm'
        }`}
      >
        {isPendingAssistant && !message.content ? (
          // streaming 시작 전 — dot animation 만
          <p className="flex items-center gap-1.5 text-[13px] text-text-tertiary">
            <span>답변 생성중</span>
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-text-quaternary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-text-quaternary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-text-quaternary animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </p>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed text-[13px]">
              {message.content}
              {isPendingAssistant && (
                // streaming 진행 중 — 끝에 깜빡 cursor (큰 사이즈, brand 색)
                <span className="inline-block w-2 h-4 ml-0.5 bg-brand animate-pulse align-middle rounded-sm" />
              )}
            </p>
            {isPendingAssistant && (
              // 영구 라벨 — chunk 잠시 멈춤 시에도 "끝났나?" 헷갈림 방지
              <div className="mt-2 pt-1.5 border-t border-line flex items-center gap-1.5 text-[11px] text-brand">
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span className="font-medium">계속 작성중 · 잠시만요</span>
              </div>
            )}
          </>
        )}

        {/* citation 칩 (Notion AI 패턴) — assistant 만 */}
        {!isUser && citations && (citations.citedLogIds?.length || citations.citedResearch) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {citations.citedResearch && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20"
                title="이 답변은 회사·직무 조사 정보를 활용했어요"
              >
                🏢 회사 조사
              </span>
            )}
            {citations.citedLogIds?.map((logId) => (
              <span
                key={logId}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20"
                title={`활용한 활동 log (${logId.slice(0, 8)})`}
              >
                📋 활동 log
              </span>
            ))}
          </div>
        )}

        {/* suggestedUpdates (Wanted 1-click + Cursor diff 패턴) */}
        {message.suggestedUpdates && message.suggestedUpdates.length > 0 && (
          <div className="mt-2.5 space-y-2 pt-2 border-t border-line">
            {(() => {
              const unhandled = message.suggestedUpdates!.filter((u) => {
                const key = `${message.id}:${u.clId}`
                const cl = clMap.get(u.clId)
                const isAlreadyApplied = !!cl && (cl.answer ?? '') === u.newAnswer
                return !(appliedUpdateKeys.has(key) || isAlreadyApplied)
              })
              // 스트리밍 중(pending)엔 newAnswer 가 아직 자라는 중 — 적용 차단
              return unhandled.length >= 2 && !isPendingAssistant ? (
                <button
                  onClick={() => onBulkApply(unhandled)}
                  className="w-full text-[11px] font-semibold px-2 py-1.5 rounded bg-brand text-text-primary hover:bg-accent transition-colors"
                  title="미처리 제안을 요약 확인 후 한 번에 적용"
                >
                  모두 적용 ({unhandled.length}개 문항)
                </button>
              ) : null
            })()}
            {message.suggestedUpdates.map((u) => {
              const key = `${message.id}:${u.clId}`
              const cl = clMap.get(u.clId)
              // 적용 판단: in-memory 거절 set + 현재 답변과 newAnswer 일치 (새로고침 후에도 유지)
              const isAlreadyApplied =
                !!cl && (cl.answer ?? '') === u.newAnswer
              const handled = appliedUpdateKeys.has(key) || isAlreadyApplied
              return (
                <div
                  key={u.clId}
                  className={`bg-surface border rounded-lg p-2.5 ${
                    handled ? 'border-line opacity-50' : 'border-brand/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {cl?.number && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-bold font-mono">
                        Q{cl.number}
                      </span>
                    )}
                    {cl?.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-semibold">
                        {cl.category}
                      </span>
                    )}
                    <span className="text-[10px] text-text-quaternary truncate flex-1">
                      {cl?.question.slice(0, 28) ?? '문항'}
                      {cl?.question && cl.question.length > 28 ? '…' : ''}
                    </span>
                  </div>
                  <p className="text-text-tertiary text-[11px] leading-relaxed line-clamp-3 mb-1.5">
                    {u.newAnswer}
                  </p>
                  {/* 글자수 — 제한 초과 시 경고 (AI 가 제한을 못 지킨 경우 사용자가 알고 적용).
                    * 카운트 기준은 문항 카드와 동일 (countChars 공백 포함) */}
                  <p className="text-[10px] font-mono mb-2">
                    {(() => {
                      const n = countChars(u.newAnswer).total
                      return cl?.charLimit != null && n > cl.charLimit ? (
                        <span className="text-warning">
                          ⚠️ {n}자 / 제한 {cl.charLimit}자 — 그대로 적용해도
                          돼요. 마지막에 AI 심층 점검이 줄일 문장을 짚어드려요
                        </span>
                      ) : (
                        <span className="text-text-quaternary">
                          {n}자
                          {cl?.charLimit != null
                            ? ` / 제한 ${cl.charLimit}자`
                            : ''}
                        </span>
                      )
                    })()}
                  </p>
                  {(() => {
                    const fills = countFillPlaceholders(u.newAnswer)
                    return fills > 0 ? (
                      <p className="text-[10px] text-warning mb-2 -mt-1">
                        ⚠️ 채워야 할 부분 {fills}곳
                      </p>
                    ) : null
                  })()}
                  {handled ? (
                    <span className="text-[10px] text-text-quaternary">
                      ✓ 처리됨
                    </span>
                  ) : isPendingAssistant ? (
                    <span className="text-[10px] text-text-quaternary animate-pulse">
                      작성 중…
                    </span>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onApply(u)}
                        className="flex-1 text-[11px] font-semibold px-2 py-1 rounded bg-brand text-text-primary hover:bg-accent transition-colors"
                        title="제안 답변 확인 — 변경 영역 미리보기 후 적용"
                      >
                        답변 확인하기
                      </button>
                      <button
                        onClick={() => onReject(u.clId)}
                        className="text-[11px] px-2 py-1 rounded text-text-quaternary hover:text-text-secondary border border-line transition-colors"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 활동 트리 (default expand) ──
function ActivityTreeSection({
  open,
  onToggle,
  selectedLogIds,
  onSelectChange,
}: {
  applicationId: string
  open: boolean
  onToggle: () => void
  selectedLogIds: Set<string>
  onSelectChange: (set: Set<string>) => void
}) {
  const { data: activities = [], isLoading } = useActivities(false)
  // 기본함(미분류) 은 퀵캡처 기록의 소재 창고 — 맨 위 고정 (숨기지 않고 잘 보이게)
  const sortedActivities = [...activities].sort(
    (a, b) => (b.isInbox ? 1 : 0) - (a.isInbox ? 1 : 0),
  )

  return (
    <div className={open ? 'border-t border-line pt-2' : ''}>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 px-1 py-1.5 text-[11px] text-text-tertiary hover:text-text-primary transition-colors text-left"
        >
          <span className="font-medium">
            📋 활동 첨부{' '}
            {selectedLogIds.size > 0 && (
              <span className="text-brand font-semibold font-mono">
                · {selectedLogIds.size} 선택
              </span>
            )}
          </span>
          <CollapsibleChevron open={open} />
        </button>
        {selectedLogIds.size > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelectChange(new Set())
            }}
            className="shrink-0 text-text-quaternary hover:text-danger text-[11px] px-1.5 py-0.5 rounded transition-colors"
            title="활동 선택 초기화"
            aria-label="활동 선택 초기화"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="max-h-[160px] overflow-y-auto overscroll-contain pb-2 space-y-1">
          {isLoading ? (
            <div className="text-[10px] text-text-quaternary text-center py-2">
              불러오는 중…
            </div>
          ) : activities.length === 0 ? (
            <p className="text-text-quaternary text-[10px] text-center py-2">
              활동 일지에 기록을 먼저 추가해 주세요.
            </p>
          ) : (
            sortedActivities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                selectedLogIds={selectedLogIds}
                onSelectChange={onSelectChange}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ActivityRow({
  activity,
  selectedLogIds,
  onSelectChange,
}: {
  activity: Activity
  selectedLogIds: Set<string>
  onSelectChange: (set: Set<string>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: rawLogs = [] } = useActivityLogs(
    expanded ? activity.id : undefined,
  )
  // 쉬어가기(rest) 기록은 자소서 소재가 아님
  const logs = rawLogs.filter((l) => l.cat !== 'rest')

  return (
    <div className="border border-line bg-surface-2 rounded">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-3 transition-colors"
      >
        <CollapsibleChevron open={expanded} />
        <span className="flex-1 text-left truncate font-medium">
          {activity.isInbox ? '📥 미분류 기록' : activity.name}
        </span>
      </button>
      {expanded && logs.length > 0 && (
        <div className="border-t border-line px-1.5 py-1 space-y-0.5">
          {logs.map((l) => {
            const selected = selectedLogIds.has(l.id)
            return (
              <button
                key={l.id}
                onClick={() => {
                  const next = new Set(selectedLogIds)
                  if (selected) next.delete(l.id)
                  else next.add(l.id)
                  onSelectChange(next)
                }}
                className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  selected
                    ? 'bg-brand/15 text-brand'
                    : 'text-text-tertiary hover:bg-surface-3'
                }`}
              >
                <span className="mr-1">{selected ? '✓' : '+'}</span>
                {l.occurredAt} {l.content.slice(0, 30)}
                {l.content.length > 30 ? '…' : ''}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
