import { useCallback, useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/common/Modal'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { JobTitleField } from '@/components/card/JobTitleField'
import { StepDateField } from '@/components/board/StepDateField'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useAlarmStatus } from '@/hooks/useNotifications'
import { useDemoMode } from '@/contexts/demoMode'
import { applicationsApi } from '@/api/applications'
import { countJobPostingItems, jobPostingCardApi } from '@/api/jobPosting'
import { useAuthStore } from '@/stores/authStore'
import { JOB_SERIES, classifyJob } from '@/utils/jobRole'
import { formatPostingDate } from '@/utils/postingDates'
import type { Application } from '@/types/application'

interface Props {
  app: Application
  /** 「좋아요」·✕·Esc — 어느 쪽으로 닫혀도 같은 자리로 온다 (닫힌 뒤 되돌리기 토스트) */
  onClose: () => void
  onOpenCard: () => void
}

const TITLE = '카드가 만들어졌어요 ✓'

/**
 * 결과 시트 — **확인 단계가 아니라 결과 화면**이다.
 *
 * ## 왜 「맞아요?」가 아니라 「이렇게 만들었어요」인가
 *
 * 생성 전에 확인 화면을 두면 붙여넣기의 값어치(한 번에 끝난다)가 사라진다. 카드는 이미
 * 만들어졌고, 이 시트는 **무엇이 채워졌는지 보여주는 자리**다 — 그래서 버튼이 「확인」이
 * 아니라 「좋아요」 하나고, 되돌리기는 닫힌 뒤 토스트가 맡는다.
 *
 * ## 여기서 고칠 수 있는 건 **날짜뿐**이다
 *
 * 마감·면접 날짜가 틀리면 알림이 잘못 가고 신뢰가 깨진다 — 가장 비싼 오류라 그 자리에서
 * 고치게 둔다. 회사명·직무·요건은 카드 상세에서 언제든 고칠 수 있고, 여기에 다 넣으면
 * 결과 화면이 편집 폼이 된다.
 *
 * ## 발표·검진이 스텝에 없는 이유를 **그 자리에서** 말한다
 *
 * 「내가 하는 것은 스텝, 기다리거나 가는 날은 캘린더 일정」이 우리 규칙인데, 사용자는 모른다.
 * 합격 발표 날짜가 스텝 바에 없으면 「안 잡혔나」로 읽히므로 어디로 갔는지·알림은 어떻게
 * 되는지까지 붙인다. 🔴 알림이 **안 가는 상태**면 그 사실도 여기서 말한다 —
 * 「캘린더에 넣었어요」만 하고 실제로 안 울리면 그게 더 나쁜 거짓말이다.
 */
export function PostingResultSheet({ app, onClose, onOpenCard }: Props) {
  const isMobile = useIsMobile()
  const isDemo = useDemoMode()
  const panelRef = useRef<HTMLDivElement>(null)
  const [reqOpen, setReqOpen] = useState(false)
  /** 여기서 고친 칸 — 「AI 값 수정률」의 재료. 닫을 때 한 번에 보낸다 */
  const editedRef = useRef<Set<string>>(new Set())

  const meta = app.postingMeta
  const extraDates = meta?.extraDates ?? []
  // 알림 상태는 일정이 있을 때만 묻는다 — 없으면 할 말도 없다
  const { data: alarm } = useAlarmStatus(extraDates.length > 0 && !isDemo)

  const steps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const reqCount = app.jobPosting ? countJobPostingItems(app.jobPosting) : 0

  /**
   * 닫기.
   *
   * 🔴 **「좋아요」와 그냥 닫기는 다르다.** ✕·Esc·스와이프로 치운 건 「봤다」가 아니라
   * 「지금은 안 볼래」다 — 그걸 검토로 세면 카드 상세 확인 줄(폴백)이 영영 안 뜬다.
   * 다만 **날짜를 하나라도 고쳤으면** 그것 자체가 검토다 (계획서 정정 1 「첫 편집까지 유지」).
   *
   * 데모는 서버가 없다. 여기서 건너뛰지 않으면 데모 「백엔드 요청 0」이 깨진다.
   */
  const finish = useCallback(
    (explicit: boolean) => {
      const edited = [...editedRef.current]
      if (!isDemo && (explicit || edited.length > 0)) {
        void jobPostingCardApi
          .patchMeta(app.id, {
            reviewed: true,
            ...(edited.length ? { editedFields: edited } : {}),
          })
          .catch(() => {
            /* 검토 표시는 실패해도 사용자가 할 일이 없다 — 확인 줄이 그대로 남을 뿐이다 */
          })
      }
      onClose()
    },
    [app.id, isDemo, onClose],
  )

  const body = (
    <div ref={panelRef}>
      {/* 회사·직무 — 무엇을 만들었는지 한 줄로 */}
      <div className="flex items-center gap-2.5 pb-3.5 border-b border-line">
        <CompanyAvatar name={app.companyName} domain={app.domain} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{app.companyName}</p>
          {app.jobTitle && (
            <p className="text-xs text-text-tertiary truncate">{app.jobTitle}</p>
          )}
        </div>
        {app.jobCategory && (
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-xs font-medium text-brand bg-brand/15 border border-brand/30">
            {app.jobCategory} ✓
          </span>
        )}
      </div>

      {/*
        🔴 공고 본문에 직무가 없는 경우 — JD 가 PDF·이미지 첨부인 공고가 실제로 많다
        (CEO 실기: SK하이닉스). 서버는 **지어내지 않고** `jobTitle: null` 로 카드를 만들고,
        묻는 건 여기서 한다 — 카드는 이미 만들어졌으니 흐름을 막지 않으면서,
        직무가 비면 자소서·면접 AI 가 기준을 잃으므로 **가장 값싼 자리**에서 한 칸만 받는다.
      */}
      {!app.jobTitle && (
        <MissingJobTitle app={app} onSaved={() => editedRef.current.add('jobTitle')} />
      )}

      {steps.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-text-quaternary mt-4 mb-1">
            전형 {steps.length}단계
          </p>
          {meta?.orderConflict && (
            <p role="alert" className="text-[12px] text-warning mb-1.5">
              날짜 순서가 공고와 달라 보여요 — 순서를 확인해 주세요
            </p>
          )}
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-2.5 min-h-[44px] border-b border-line"
            >
              <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                {step.name}
              </span>
              <StepDateField
                appId={app.id}
                stepId={step.id}
                stepName={step.name}
                scheduledDate={step.scheduledDate}
                emptyLabel={step.dateHint ?? undefined}
                onSaved={() => editedRef.current.add('steps')}
              />
              {/* 🔴 힌트가 있는 행에만 붙인다 — 아무 정보도 없는 행에 붙이면 잔소리가 된다 */}
              {!step.scheduledDate && step.dateHint && (
                <p className="w-full text-[11px] text-text-quaternary">
                  날짜가 나오면 적어 주세요
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {extraDates.length > 0 && (
        <div className="py-3 border-b border-line">
          <p className="text-sm text-text-secondary">캘린더에 넣은 일정 {extraDates.length}</p>
          {/* 읽는 문장(40자+) → 14px (DESIGN.md 규칙 7-b) */}
          <p className="text-sm text-text-tertiary mt-1 leading-relaxed">
            발표·검진은 스텝에 넣지 않고 캘린더에 자동으로 넣었어요 — 당일 아침에, 시각이 있으면
            2시간 전에도 알려드려요
          </p>
          <AlarmNotice
            hasDevice={alarm?.hasDevice}
            enabled={alarm?.enabled}
            imminentOn={alarm?.imminentOn}
          />
          <ul className="mt-2 space-y-1.5">
            {extraDates.map((e) => {
              // 🔴 날짜만 온 일정에 시각을 지어내지 않는다 (`formatPostingDate` 주석)
              const label = formatPostingDate(e.date)
              return (
                <li
                  key={e.noteId || `${e.label}-${e.date}`}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="text-text-secondary min-w-0 truncate">
                    📅 {app.companyName} · {e.label}
                  </span>
                  <span className="font-mono tabular-nums text-text-tertiary shrink-0">
                    {label ?? '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {reqCount > 0 && (
        <div className="border-b border-line">
          <button
            type="button"
            onClick={() => setReqOpen((v) => !v)}
            aria-expanded={reqOpen}
            className="w-full flex items-center justify-between gap-2 py-3 min-h-[44px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded"
          >
            <span className="text-sm text-text-secondary">요건 {reqCount}개 정리됨</span>
            <CollapsibleChevron open={reqOpen} />
          </button>
          {reqOpen && (
            <p className="pb-3 text-[13px] text-text-tertiary leading-relaxed">
              자소서 탭에서 그대로 쓸 수 있어요 — 공고 요건이 이미 정리돼 있어요.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => finish(true)}
        className="w-full mt-4 min-h-[44px] lg:min-h-[40px] rounded-lg text-sm font-semibold text-bg bg-brand hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        좋아요
      </button>
      <Link
        to={isDemo ? `/demo/board/${app.id}` : `/board/${app.id}`}
        onClick={onOpenCard}
        className="w-full mt-2 min-h-[44px] lg:min-h-[32px] flex items-center justify-center text-[13px] text-text-tertiary hover:text-text-secondary underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded"
      >
        카드 열기 →
      </Link>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer.Root open onOpenChange={(o) => { if (!o) finish(false) }} shouldScaleBackground={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Drawer.Content
            aria-label={TITLE}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[88dvh] flex flex-col shadow-2xl outline-none"
          >
            <Drawer.Title className="sr-only">{TITLE}</Drawer.Title>
            <div
              className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-line-strong shrink-0"
              aria-hidden="true"
            />
            <div className="px-[18px] pt-2 pb-3 border-b border-line shrink-0">
              <p className="text-sm font-semibold text-text-primary">{TITLE}</p>
            </div>
            <div className="px-[18px] py-4 overflow-y-auto overscroll-contain flex-1">
              {body}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <DesktopPanel title={TITLE} onClose={() => finish(false)}>
      {body}
    </DesktopPanel>
  )
}

/**
 * 「직무가 비어 있어요」 한 칸 — **공고 본문에 직무가 없을 때만** 선다.
 *
 * ## 왜 카드를 막지 않고 여기서 묻나
 *
 * JD 가 첨부 파일인 공고는 본문에 부문 이름이 아예 없다. 그렇다고 카드 생성을 멈추면
 * 「붙이면 카드가 생긴다」는 약속이 깨진다 — 회사·마감·전형은 이미 다 찾았기 때문이다.
 * 그래서 카드는 만들고, **결과를 보여주는 이 자리**에서 한 칸만 받는다.
 *
 * 🔴 **강제하지 않는다.** 「좋아요」는 직무가 비어도 눌린다 — 지금 모르는 사람도 있고
 * (부문 공고), 카드 상세에서 언제든 채울 수 있다. 여기서 막으면 결과 화면이 폼이 된다.
 *
 * 저장은 **확정된 순간 한 번**(blur·칩). 계열은 확정(`confident`)일 때만 함께 보낸다 —
 * 애매한 추정을 저장으로 승격시키지 않는 앱 전역 규칙 그대로다.
 */
function MissingJobTitle({ app, onSaved }: { app: Application; onSaved: () => void }) {
  const qc = useQueryClient()
  const isDemo = useDemoMode()
  const profileTitle = useAuthStore((s) => s.user?.signupJobTitle?.trim() ?? '')
  const [value, setValue] = useState('')
  const [seriesId, setSeriesId] = useState<string | null>(null)
  /** 같은 값을 blur 마다 다시 보내지 않는다 */
  const savedRef = useRef('')

  /** `source` — 직접 친 값은 `typed`, 희망 직무 칩은 `prefill` (관측: 「AI 값 수정률」·직무 출처) */
  const save = (title: string, sid: string | null, source: 'typed' | 'prefill') => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === savedRef.current) return
    savedRef.current = trimmed
    const label = sid ? (JOB_SERIES.find((s) => s.id === sid)?.label ?? null) : null

    // 화면부터 갱신 — 이 블록이 사라지고 위 회사 줄에 직무가 뜬다 (저장됐다는 신호)
    qc.setQueryData<Application[]>(['applications'], (old) =>
      old?.map((a) => (a.id === app.id ? { ...a, jobTitle: trimmed, jobCategory: label } : a)),
    )
    onSaved()
    if (isDemo) return
    void applicationsApi
      .update(app.id, { jobTitle: trimmed, jobCategory: label, jobTitleSource: source })
      .catch(() => {
        /* 실패해도 사용자가 할 일은 없다 — 카드 상세에서 다시 고칠 수 있다 */
      })
  }

  return (
    <div className="pt-3.5 pb-1 border-b border-line">
      {/* 40자 넘는 읽는 문장 → 14px (DESIGN.md 규칙 7-b) */}
      <p className="text-sm text-text-secondary leading-relaxed mb-2">
        공고 본문엔 직무가 없어요(직무 설명이 첨부 파일인가 봐요) — 지원하는 직무를 적어 주세요
      </p>
      <JobTitleField
        variant="underline"
        value={value}
        onChange={(v) => setValue(v)}
        seriesId={seriesId}
        onSeriesChange={(id) => setSeriesId(id)}
        onBlur={() => save(value, seriesId, 'typed')}
      />
      {profileTitle && (
        <button
          type="button"
          onClick={() => {
            setValue(profileTitle)
            const verdict = classifyJob(profileTitle)
            const sid = verdict.status === 'confident' ? verdict.series.id : null
            setSeriesId(sid)
            save(profileTitle, sid, 'prefill')
          }}
          className="mt-2 inline-flex items-center min-h-[44px] lg:min-h-[32px] px-3 rounded-full border border-line bg-card text-[13px] lg:text-xs font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          ‘{profileTitle}’로 채우기
        </button>
      )}
      {/* 다음번을 위한 힌트 (28자 — 라벨 크기로 충분) */}
      <p className="text-[11px] text-text-quaternary mt-2">
        직무 설명 글도 같이 붙이면 직무·요건까지 채워요
      </p>
    </div>
  )
}

/**
 * 데스크탑 — 공용 `Modal` + **포커스 가둠**.
 *
 * `Modal` 은 Esc·오버레이 클릭까지 맡지만 포커스는 안 가둔다. 여기는 안에서 날짜를 고치는
 * 화면이라 Tab 이 뒤 보드로 새면 어디를 편집하는지 알 수 없다.
 * (모바일 시트는 vaul 이 이미 가둬 준다.)
 */
function DesktopPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'))
    /* eslint-disable chwippo/no-bare-autofocus -- 데스크탑 전용 패널(`DesktopPanel`)의 Tab 가둠이다.
       모바일은 이 경로를 안 타고 vaul 시트가 대신 가둔다. 여기 `.focus()` 는 첫 요소 진입 + Tab 순환이라
       칸이 아니라 버튼·링크로 가고, 순환 쪽은 사용자가 Tab 을 눌러야 돈다 */
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!root.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }
    /* eslint-enable chwippo/no-bare-autofocus */
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Modal open onClose={onClose} title={title} width="max-w-md">
      <div ref={ref}>{children}</div>
    </Modal>
  )
}

/**
 * 알림이 **안 가는 상태**면 그 자리에서 말한다.
 *
 * 🔴 값이 아직 안 왔으면 아무 말도 안 한다 — 로딩 중에 「알림이 꺼져 있어요」가 잠깐 떴다
 * 사라지면 켜 둔 사람에게 거짓말을 한 셈이다.
 */
function AlarmNotice({
  hasDevice,
  enabled,
  imminentOn,
}: {
  hasDevice?: boolean
  enabled?: boolean
  imminentOn?: boolean
}) {
  if (hasDevice === undefined) return null
  if (!hasDevice) {
    return (
      <p className="text-[12px] text-text-tertiary mt-1">
        앱에서 알림을 켜면 폰으로도 알려드려요
      </p>
    )
  }
  if (enabled && imminentOn) return null
  return (
    <p className="text-[12px] text-warning mt-1">
      알림이 꺼져 있어요 —{' '}
      <Link
        to="/settings/alarm"
        className="text-brand font-medium underline underline-offset-2"
      >
        설정 › 알림에서 켜기
      </Link>
    </p>
  )
}
