import { useMutation } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import { dismissInterviewNudge } from '@/api/users'

/**
 * 「다시 보지 않기」 로컬 보조 기록 키.
 *
 * 🔴 **서버가 진실의 원천이다.** 이건 서버 저장이 실패했을 때만 쓰는 **두 번째 방어선**이다.
 * 기기를 바꾸면 이 값은 없지만 그땐 서버 값이 살아 있다 (재시도가 성공했을 것).
 */
const DISMISS_KEY = 'chwippo:interviewNudgeDismissed'

/** 로컬 보조 기록이 있는가 — 서버 판정과 AND 로 묶어 한 겹 더 막는다 */
export function isInterviewNudgeDismissedLocally(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // 시크릿 모드·저장소 차단 — 보조 방어선일 뿐이라 조용히 넘어간다
    return false
  }
}

function rememberDismissLocally(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* 무시 — 서버가 원천이다 */
  }
}

/**
 * 이 스텝에서 안내를 띄웠다고 기록 — **스텝당 1회 소진**.
 *
 * 닫는 방법 4가지(X · 오버레이 탭 · ESC · CTA)가 전부 이걸 부른다.
 *
 * 🔴 **실패해도 조용히 넘어간다 (안전한 실패).** 못 찍히면 다음에 한 번 더 뜰 뿐이고,
 * 그건 「안내를 한 번 더 보는」 방향이라 안전하다. 사용자에게 에러를 보여줄 일이 아니다.
 */
export function useMarkInterviewNudgeShown() {
  return useMutation({
    mutationFn: ({ appId, stepId }: { appId: string; stepId: string }) =>
      applicationsApi.markInterviewNudgeShown(appId, stepId),
    onError: () => undefined,
  })
}

/**
 * 「다시 보지 않기」 — 전 카드 영구 차단.
 *
 * 🔴 **여기만 실패 처리 방향이 반대다.** `shownAt` 은 실패하면 「또 뜨는」 쪽이 안전하지만,
 * 이건 사용자가 **명시적으로 체크한 약속**이라 실패 후 또 뜨면 약속 파기다.
 * 그래서 ① 재시도 2회 ② 성공·실패와 무관하게 **localStorage 에 먼저 남긴다.**
 *
 * 로컬에 먼저 남기는 이유 — 서버 왕복을 기다리는 동안 사용자는 이미 모달을 닫았고,
 * 그 사이 다른 카드로 이동하면 판정이 돈다. 낙관적으로 막아두는 편이 약속에 맞다.
 */
export function useDismissInterviewNudge() {
  return useMutation({
    mutationFn: () => dismissInterviewNudge(),
    retry: 2,
    onMutate: () => {
      rememberDismissLocally()
    },
    onError: () => undefined, // 로컬 보조 기록이 이미 막고 있다
  })
}
