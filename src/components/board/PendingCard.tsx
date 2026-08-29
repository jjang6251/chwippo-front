import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { CompanyAutocomplete } from '@/components/board/CompanyAutocomplete'
import { JobPickList } from '@/components/board/JobPickList'
import { JobPickSheet } from '@/components/board/JobPickSheet'
import { useAuthStore } from '@/stores/authStore'
import {
  runPostingCommit,
  runPostingParse,
  SLOW_AFTER_MS,
  usePendingCardStore,
  type PendingCardEntry,
} from '@/stores/pendingCardStore'
import { shouldPickInSheet } from '@/utils/postingJobList'
import type { AddCardPrefill } from '@/components/card/AddCardModal'

interface Props {
  entry: PendingCardEntry
  /** 「직접 입력하기 →」 — 찾은 값을 들고 카드 추가 모달로 돌아간다 */
  onManualFallback: (prefill: AddCardPrefill) => void
}

/** 진행 문구 — **1.5초**마다 넘어간다 */
const PHASES = ['공고 읽는 중…', '전형 찾는 중…', '날짜 맞추는 중…']
const PHASE_MS = 1500

/**
 * 「생성 중」 카드 — 보드 목록 **맨 위**에 서는 임시 카드.
 *
 * ## 왜 카드 모양인가
 *
 * 결과가 카드로 나올 자리에 미리 카드 모양을 세워 두면 **무엇이 만들어지는 중인지**가
 * 설명 없이 읽힌다. 스피너나 전역 로딩 바로는 「무엇이」가 사라진다.
 *
 * ## 진행률 바를 그리지 않는다
 *
 * 실제 진행을 우리는 모른다 — LLM 호출은 중간 상태가 없다. 채워지는 막대를 그리면 그건
 * **거짓말**이다. 대신 단계 문구를 돌린다. 카드 1장이 보통 2~4초라 5초 간격이면 첫 문구만
 * 보고 끝나서 1.5초로 맞췄다 (실측).
 *
 * ## 결과는 세 갈래고, 셋 다 **이 자리에서** 이어진다
 *
 * 완성(카드가 그 자리를 대신) · 보완 질문(회사명 / 직무) · 실패(공고 아님 / 오류).
 * 🔴 실패를 토스트로만 알리고 카드를 지우면 **다음에 뭘 해야 하는지**가 사라진다 —
 * 붙인 글도 같이 사라져서 처음부터 다시 붙여야 한다. 그래서 실패도 자리를 지킨다.
 */
export function PendingCard({ entry, onManualFallback }: Props) {
  const remove = usePendingCardStore((s) => s.remove)
  const profileJobTitle = useAuthStore((s) => s.user?.signupJobTitle ?? null)

  const [company, setCompany] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')

  const dismiss = () => remove(entry.tempId)

  const commit = (patch: { companyName?: string; jobContext?: string }) => {
    if (!entry.hash) {
      // 초안 참조가 없으면 서버에 물어볼 수가 없다 — 있을 수 없는 상태지만 조용히 죽지는 않는다
      usePendingCardStore.getState().fail(entry.tempId, 'error')
      return
    }
    setPickOpen(false)
    void runPostingCommit(entry.tempId, { hash: entry.hash, ...patch, demo: entry.demo })
  }

  const retry = () => {
    if (!entry.rawText) {
      dismiss()
      return
    }
    usePendingCardStore.getState().markParsing(entry.tempId)
    void runPostingParse(entry.tempId, { rawText: entry.rawText, demo: entry.demo })
  }

  if (entry.status === 'parsing') {
    return (
      <PendingShell>
        <ParsingBody startedAt={entry.startedAt} />
      </PendingShell>
    )
  }

  if (entry.status === 'needs-company') {
    return (
      <PendingShell>
        <Header
          title="회사명을 찾지 못했어요"
          sub="회사명만 적어 주세요"
          onDismiss={dismiss}
        />
        <div className="mt-2.5">
          <CompanyAutocomplete
            variant="underline"
            value={company}
            onChange={setCompany}
            placeholder="어느 회사에 지원하세요?"
          />
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          {/* 🔴 남은 게 한 칸뿐이라는 걸 말해 준다 — 안 그러면 처음부터 다시 하는 줄 안다 */}
          <p className="text-[11px] text-text-quaternary min-w-0">
            직무·전형·날짜는 이미 준비됐어요
          </p>
          <button
            type="button"
            disabled={!company.trim()}
            onClick={() => commit({ companyName: company.trim() })}
            className="flex-none min-h-[44px] lg:min-h-[32px] px-4 text-[13px] lg:text-xs font-semibold text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            카드 만들기
          </button>
        </div>
      </PendingShell>
    )
  }

  if (entry.status === 'needs-job') {
    const inSheet = shouldPickInSheet(entry.candidates)
    return (
      <PendingShell>
        <Header
          title={inSheet ? '직무를 골라 주세요' : '어느 직무로 지원하세요?'}
          sub={inSheet ? `공고에 부문이 ${entry.candidates.length}개예요` : null}
          onDismiss={dismiss}
        />

        {typing ? (
          <form
            className="mt-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim()) commit({ jobContext: typed.trim() })
            }}
          >
            <label htmlFor={`pending-job-${entry.tempId}`} className="sr-only">
              지원 직무
            </label>
            <input
              id={`pending-job-${entry.tempId}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              maxLength={100}
              placeholder="예: 브랜드 마케터"
              className="w-full bg-transparent border-0 border-b-[1.5px] border-line-strong rounded-none px-0.5 py-2.5 text-[17px] lg:text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand transition-colors"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!typed.trim()}
                className="min-h-[44px] lg:min-h-[32px] px-4 text-[13px] lg:text-xs font-semibold text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-brand"
              >
                카드 만들기
              </button>
            </div>
          </form>
        ) : inSheet ? (
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            className="mt-3.5 inline-flex min-h-[44px] lg:min-h-[32px] items-center px-4 text-[13px] lg:text-xs font-semibold text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            직무 고르기
          </button>
        ) : (
          <div className="mt-2">
            <JobPickList
              candidates={entry.candidates}
              profileJobTitle={profileJobTitle}
              onPick={(v) => commit({ jobContext: v })}
              onTypeOwn={() => setTyping(true)}
              dense
            />
          </div>
        )}

        {/* 2차 파싱이 붙는 이유를 미리 말해 둔다 — 고르고 나서 또 기다리는 게 왜인지 알게 */}
        <p className="text-[11px] text-text-quaternary mt-3">
          고르면 그 직무 기준으로 요건을 정리해요
        </p>

        <JobPickSheet
          open={pickOpen}
          candidates={entry.candidates}
          profileJobTitle={profileJobTitle}
          onPick={(v) => commit({ jobContext: v })}
          onTypeOwn={() => {
            setPickOpen(false)
            setTyping(true)
          }}
          onClose={() => setPickOpen(false)}
        />
      </PendingShell>
    )
  }

  // 실패 2종 — 🔴 색으로 구분하지 않는다. 어느 쪽도 사용자 잘못이 아니다.
  const notPosting = entry.failure === 'not-posting'
  return (
    <PendingShell broken>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            aria-hidden="true"
            className="flex-none w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold bg-warning/10 text-warning"
          >
            !
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {notPosting ? '공고로 보이지 않아요' : (entry.reason ?? '잠시 후 다시 시도해 주세요')}
            </p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {notPosting
                ? '직접 입력할까요?'
                : entry.rawText
                  ? '붙여넣은 글은 그대로 있어요'
                  : '다시 붙여넣어 주세요'}
            </p>
          </div>
        </div>
        <DismissButton onClick={dismiss} />
      </div>
      <button
        type="button"
        onClick={() => {
          if (notPosting || !entry.rawText) {
            onManualFallback({
              companyName: entry.companyName,
              jobTitle: entry.jobTitle,
              companyNotFound: !entry.companyName,
            })
            dismiss()
            return
          }
          retry()
        }}
        className="mt-3.5 w-full min-h-[44px] py-2.5 text-xs font-semibold text-brand border border-brand/30 rounded-lg hover:bg-brand/10 hover:border-brand/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        {notPosting || !entry.rawText ? '직접 입력하기 →' : '다시 시도 →'}
      </button>
    </PendingShell>
  )
}

/** 카드 껍데기 — 실제 카드(`CompanyCard`)와 같은 면·모서리, 테두리만 점선 */
function PendingShell({
  broken,
  children,
}: {
  broken?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-pending-card
      className={`bg-surface-2 border border-dashed rounded-xl p-4 flex flex-col h-full shadow-sm ${
        broken ? 'border-line-strong border-l-2 border-l-warning/50' : 'border-brand/40 border-l-2 border-l-brand/60'
      }`}
    >
      {children}
    </div>
  )
}

function Header({
  title,
  sub,
  onDismiss,
}: {
  title: string
  sub: string | null
  onDismiss: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
      </div>
      <DismissButton onClick={onDismiss} />
    </div>
  )
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="이 카드 만들기 그만두기"
      /* 44px 터치 — 음수 마진으로 카드 안쪽 여백은 그대로 둔다 (`StepNodeHint` 와 같은 수법) */
      className="shrink-0 -mt-1.5 -mr-1.5 w-11 h-11 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <X size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

/**
 * 생성 중 본문 — 스켈레톤 + 단계 문구.
 *
 * `aria-live="polite"` 는 **문구 한 줄에만** 건다. 스켈레톤까지 라이브 영역에 넣으면
 * 읽을 것도 없는 변화를 계속 알린다.
 */
function ParsingBody({ startedAt }: { startedAt: number }) {
  const [phase, setPhase] = useState(0)
  const [slow, setSlow] = useState(false)
  const startRef = useRef(startedAt)

  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % PHASES.length), PHASE_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const elapsed = Date.now() - startRef.current
    if (elapsed >= SLOW_AFTER_MS) {
      setSlow(true)
      return
    }
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS - elapsed)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-surface-3 animate-pulse flex-none" />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="h-3.5 w-24 rounded bg-surface-3 animate-pulse mb-2" />
          <div className="h-2.5 w-28 rounded bg-surface-3 animate-pulse" />
        </div>
      </div>
      <div className="h-[18px] w-16 rounded-full bg-surface-3 animate-pulse mb-3" />
      <div className="flex gap-2 mb-3 opacity-70" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-surface-3 animate-pulse flex-none" />
            <div className="flex-1 h-px bg-line-strong" />
          </div>
        ))}
      </div>
      <p className="text-xs font-medium text-brand mt-auto" aria-live="polite">
        {slow ? '조금 오래 걸리네요 — 곧 돼요' : PHASES[phase]}
      </p>
    </>
  )
}
