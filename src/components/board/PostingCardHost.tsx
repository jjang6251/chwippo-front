import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import { useApplications } from '@/hooks/useApplications'
import { prefetchCompanyResearchNoHit } from '@/hooks/useCoverletterDoc'
import { useDemoMode } from '@/contexts/demoMode'
import { useAuthStore } from '@/stores/authStore'
import { showFirstCardCelebration } from '@/stores/celebrationStore'
import { revealCardResearch } from '@/stores/researchRevealStore'
import { toast } from '@/stores/toastStore'
import { usePendingCardStore } from '@/stores/pendingCardStore'
import { shouldCelebrateFirstCard } from '@/utils/firstCardCelebration'
import { classifyJob } from '@/utils/jobRole'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import { postToNative } from '@/utils/nativeBridge'
import { PostingResultSheet } from '@/components/board/PostingResultSheet'
import type { Application } from '@/types/application'

/** 되돌리기 토스트가 서 있는 시간 — 「방금 만든 걸 무를 수 있다」는 감각의 상한 */
const UNDO_MS = 10_000

/**
 * 공고 카드의 **뒤처리 담당** — **스코프마다 하나씩**.
 *
 * ## 왜 컴포넌트로 떠 있나
 *
 * 「카드 만들기」를 누르면 모달이 즉시 닫히고, 사용자는 결과가 오기 전에 다른 화면으로 갈 수
 * 있다. 뒤처리(캐시 갱신·축하·결과 시트·되돌리기 토스트)를 모달이나 보드에 맡기면 **그
 * 컴포넌트가 살아 있을 때만** 동작한다 — 언마운트된 뒤 도착한 카드는 아무 일도 안 일어난 채
 * 목록에만 조용히 생긴다.
 *
 * ## 🔴 왜 **둘**인가 — QueryClient 가 둘이라서
 *
 * 데모 라우트는 `DemoShell` 이 **별도 `QueryClient`** 를 세운다(데모 데이터가 본앱 캐시에
 * 남지 않게). 그래서 「앱 전역에 하나」로 두면 데모에서 만든 카드를 **앱 클라이언트**에 심고,
 * 시트도 앱 목록에서 그 카드를 찾다 못 찾아 즉시 닫힌다 — 실측에서 「카드도 시트도 없고
 * 토스트만」이 그 증상이었다(2026-08-29 `/demo/board`).
 *
 * 그래서 `App` 과 `DemoShell` 이 각각 하나씩 마운트하고, 자기 스코프를 `useDemoMode()` 로
 * 안다. 대기열에서도 **자기 것만** 꺼낸다(`takeCompleted(demo)`) — 남의 항목을 집어 버리면
 * 정작 처리할 호스트에겐 아무것도 안 남는다.
 *
 * ## 결과 시트는 조건 3개를 **전부** 만족할 때만
 *
 * ① 아직 보드에 있을 때 — 다른 화면에 있으면 갑자기 시트가 덮치고, 검토는 카드 상세
 *    확인 줄이 대신 받는다.
 * ② 첫 카드가 아닐 때 — 첫 카드는 축하 오버레이가 이미 화면을 쓴다. 두 겹은 둘 다 안 읽힌다.
 * ③ 아무도 시트를 안 잡고 있을 때 — 「카드는 병렬, 시트는 직렬」.
 * 못 띄운 카드는 토스트로 알린다 — **되돌리기는 어느 경로에서든 준다.**
 */
export function PostingCardHost() {
  const qc = useQueryClient()
  /** 이 호스트가 책임지는 스코프. App 레벨은 false, `DemoShell` 안은 true */
  const scopeDemo = useDemoMode()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const completed = usePendingCardStore((s) => s.completed)
  const takeCompleted = usePendingCardStore((s) => s.takeCompleted)
  const openSheet = usePendingCardStore((s) => s.openSheet)
  const sheetAppId = usePendingCardStore((s) => s.sheetAppId)
  const sheetDemo = usePendingCardStore((s) => s.sheetDemo)
  const closeSheet = usePendingCardStore((s) => s.closeSheet)

  /**
   * 파싱 중 이탈 경고 — AI 호출 중 새로고침을 막는 앱 전역 정책(`useUnloadGuard`).
   *
   * 🔴 여기선 **유실이 없는데도** 경고한다. 서버는 끝까지 만들고 초안도 10분 보관되지만,
   * 사용자 입장에선 「만들다 말았는데 어떻게 됐는지 모르는」 상태가 남는다 —
   * 그 불안이 곧 「다시 붙여 볼까」가 되고, 그게 중복 호출이다.
   */
  const parsing = usePendingCardStore((s) => s.entries.some((e) => e.status === 'parsing'))
  useUnloadGuard(parsing)

  /** 시트가 닫힌 뒤에 띄울 되돌리기 토스트 — 시트와 토스트가 겹치지 않게 미뤄 둔다 */
  const deferredUndo = useRef<{ id: string; companyName: string; demo: boolean } | null>(null)
  /** 경로는 최신값이 필요한데 effect 의존성에 넣으면 이동만 해도 큐 처리가 다시 돈다 */
  const pathRef = useRef(location.pathname)
  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  const undo = useCallback(
    (id: string, demo: boolean) => {
      const run = demo
        ? import('@/demo/demoStore').then((m) => m.deleteApplication(id))
        : applicationsApi.remove(id)
      void Promise.resolve(run)
        .then(() => {
          invalidateBoard(qc)
          toast.show('카드를 되돌렸어요.')
        })
        .catch(() => toast.error('되돌리기에 실패했어요.'))
    },
    [qc],
  )

  const showUndoToast = useCallback(
    (card: { id: string; companyName: string }, demo: boolean, also: boolean) => {
      toast.action(
        `${card.companyName} 카드${also ? '도' : '를'} 만들었어요`,
        { label: '되돌리기', onAction: () => undo(card.id, demo) },
        { durationMs: UNDO_MS },
      )
    },
    [undo],
  )

  useEffect(() => {
    // 🔴 **내 스코프 것만** 꺼낸다 — 남의 것을 집으면 그쪽 호스트에겐 처리할 게 안 남는다
    const item = takeCompleted(scopeDemo)
    if (!item) return

    const { demo, hasDeadline } = item
    /*
      🔴 **계열은 프론트가 채운다.** 서버엔 분류기가 없어 `jobCategory: null` 로 온다
      (사전은 번들에만 있다 — `utils/jobRole`). 직접 입력 경로가 `seriesLabel` 을 저장하는
      규칙을 그대로 쓴다: **확정(`confident`)일 때만** 저장하고, 애매하면 비운 채 둔다.
      「기타」로 뭉치거나 빌려온 값을 채우면 그 순간 직군 통계가 통째로 거짓이 된다.
    */
    const card = withSeriesLabel(item.card)
    const seriesLabel = card.jobCategory
    /*
      🔴 **삽입 전 목록**으로 첫 카드를 판정한다. `setQueryData` 뒤에 물으면 방금 넣은 카드가
      「이미 있던 카드」로 세어져 축하가 영영 안 뜬다.
    */
    const before = qc.getQueryData<Application[]>(['applications'])
    qc.setQueryData<Application[]>(['applications'], (old) =>
      old ? [card, ...old.filter((a) => a.id !== card.id)] : old,
    )
    invalidateBoard(qc)

    if (!demo) {
      // 마감이 있는 카드 = 알림이 값어치를 갖는 순간 → 네이티브 soft-ask 트리거
      // (직접 입력 경로와 같은 발신. 빠지면 이 경로 사용자만 권한을 영영 안 물어본다)
      if (hasDeadline) postToNative({ type: 'deadline-saved' })
      prefetchCompanyResearchNoHit(qc, card.id)
      /*
        캐시엔 이미 반영했고(위 `withSeriesLabel`), 서버에도 한 번 알린다.
        🔴 **실패는 조용히** — 계열은 카드의 부가 태그라, 여기서 토스트를 띄우면 방금 성공한
        생성이 실패처럼 읽힌다. 다음 편집이 다시 채운다.
      */
      if (seriesLabel) {
        void applicationsApi.update(card.id, { jobCategory: seriesLabel }).catch(() => {})
      }
    }

    const celebrated = shouldCelebrateFirstCard({
      userId: user?.id,
      existingApplications: before,
      createdId: card.id,
    })
    if (celebrated) {
      showFirstCardCelebration({
        appId: card.id,
        companyName: card.companyName,
        hadTemplate: card.steps.length > 0,
        deadline: card.steps.find((s) => s.scheduledDate)?.scheduledDate ?? null,
        planned: false,
      })
      // 축하 오버레이가 화면을 쓰는 동안 시트를 겹치지 않는다. 되돌리기는 토스트가 맡는다.
      showUndoToast(card, demo, false)
      return
    }

    // 회사 조사 스트립 — 직접 입력 경로와 **같은 규칙**(축하와 배타적)
    revealCardResearch(card.id)

    const onBoard = /^\/(demo\/)?board\/?$/.test(pathRef.current)
    if (onBoard) {
      if (openSheet(card.id, scopeDemo)) {
        deferredUndo.current = { id: card.id, companyName: card.companyName, demo }
        return
      }
      // 시트를 이미 다른 카드가 잡고 있다 — 「…도 만들어졌어요」로 이어서 알린다
      showUndoToast(card, demo, true)
      return
    }
    showUndoToast(card, demo, false)
  }, [completed, qc, takeCompleted, openSheet, showUndoToast, user?.id, scopeDemo])

  const handleSheetClose = useCallback(() => {
    closeSheet()
    const pending = deferredUndo.current
    deferredUndo.current = null
    if (pending) showUndoToast(pending, pending.demo, false)
  }, [closeSheet, showUndoToast])

  /*
    🔴 **자기 스코프의 시트만 그린다.** 앱 호스트가 데모 시트를 그리면 앱 클라이언트에서
    그 카드를 찾다 못 찾아 곧바로 닫아 버린다 (실측 결함의 두 번째 절반).
  */
  if (!sheetAppId || sheetDemo !== scopeDemo) return null
  return (
    <SheetGate
      appId={sheetAppId}
      onClose={handleSheetClose}
      onOpenCard={() => {
        handleSheetClose()
        navigate(scopeDemo ? `/demo/board/${sheetAppId}` : `/board/${sheetAppId}`)
      }}
    />
  )
}

/**
 * 시트가 **열려 있을 때만** 목록을 구독한다.
 *
 * 🔴 호스트 본체에서 `useApplications()` 를 부르면 로그인 전·랜딩·데모 밖 어디서나
 * `GET /applications` 가 나간다. 시트는 보드에서만 열리므로 그 질의는 이미 떠 있다.
 */
function SheetGate({
  appId,
  onClose,
  onOpenCard,
}: {
  appId: string
  onClose: () => void
  onOpenCard: () => void
}) {
  const { data: applications = [] } = useApplications()
  const app = applications.find((a) => a.id === appId)
  // 목록에서 사라졌다(되돌리기·필터 refetch) — 없는 카드의 결과를 보여줄 수는 없다
  useEffect(() => {
    if (!app) onClose()
  }, [app, onClose])
  if (!app) return null
  return <PostingResultSheet app={app} onClose={onClose} onOpenCard={onOpenCard} />
}

/**
 * 직무 원문에서 **계열 라벨**을 파생해 붙인다 (서버는 분류기가 없어 `null` 로 준다).
 *
 * 🔴 이미 값이 있으면 손대지 않고, 판정이 확정이 아니면 **비운 채로 둔다** —
 * 「기타」로 뭉치거나 애매한 추정을 저장으로 승격시키지 않는 게 이 앱의 계열 규칙이다
 * (`AddCardModal` 의 `seriesLabel` 과 같은 판단).
 */
function withSeriesLabel(card: Application): Application {
  if (card.jobCategory || !card.jobTitle) return card
  const verdict = classifyJob(card.jobTitle)
  if (verdict.status !== 'confident') return card
  return { ...card, jobCategory: verdict.series.label }
}

/** 카드가 생기거나 사라지면 함께 흔들리는 것들 — `useApplications` 의 규칙을 그대로 따른다 */
function invalidateBoard(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['applications'], refetchType: 'all' })
  void qc.invalidateQueries({ queryKey: ['calendar'], refetchType: 'all' })
  void qc.invalidateQueries({ queryKey: ['dashboard', 'dday'], refetchType: 'all' })
  void qc.invalidateQueries({ queryKey: ['dashboard', 'streak'], refetchType: 'all' })
}
