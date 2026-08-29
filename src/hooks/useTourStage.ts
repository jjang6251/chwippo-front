import { useApplications } from '@/hooks/useApplications'
import type { Application } from '@/types/application'

/**
 * 투어 **마지막 장**이 돌아갈 곳 — 사용자 본인 카드 하나.
 *
 * ## v3 에서 역할이 줄었다
 *
 * v2 까지는 이 훅이 **무대 전체**를 만들었다(실카드 또는 계열 대표 회사 미리보기). 그런데
 * 1장 카드와 4·5장 문장이 서로 다른 이야기를 해서 오히려 헷갈렸다 (CEO 2차 실기).
 * v3 는 1~6장을 **고정 쇼케이스**(무신사 · 브랜드 마케터, `showcase.ts`)로 통일하고,
 * 이 훅은 **7장에서 내 카드로 돌아오는 것**만 맡는다.
 *
 * 「내 것으로 돌아오는 순간」이 마지막 한 장에 몰려 있어서 오히려 세진다 —
 * 여섯 장을 남의 이야기로 본 뒤 마지막에 내 회사 이름이 나온다.
 */
export interface TourFinishTarget {
  /** 내 카드. 없으면 `null` — CTA 가 「첫 카드 만들기」로 갈린다 */
  application: Application | null
  /** 캐시가 아직 없다 — 카드 자리에 스켈레톤 (스피너 금지) */
  loading: boolean
  /**
   * 🔴 목록을 **못 받아왔다** — 「카드가 0장」과 다르다.
   *
   * 둘을 같이 묶으면 카드를 여섯 장 가진 사람이 조회 한 번 실패했다고 「첫 카드 만들기」를
   * 본다 — 마지막 장이 사실이 아닌 말을 하는 것이다. 모르는 상태에서는 아무것도 단정하지
   * 않는 중립 CTA(「보드로 가기」)로 간다.
   */
  failed: boolean
}

export function useTourStage(): TourFinishTarget {
  const { data, isPending } = useApplications()
  return {
    application: pickFinishApplication(data) ?? null,
    loading: isPending,
    /* 로딩이 끝났는데 데이터가 없다 = 에러(또는 그에 준하는 미결). `isError` 를 보지 않는
       이유는 「데이터가 없다」가 판정의 전부이기 때문이다 — 원인은 화면을 바꾸지 않는다. */
    failed: !isPending && data === undefined,
  }
}

/**
 * 마지막 장에 세울 카드 — **온보딩 픽이 1순위**, 없으면 가장 오래된 실카드.
 *
 * 픽이 우선인 이유: 방금 온보딩에서 **사용자가 직접 고른** 회사라 「내가 담은 그거」라는
 * 연결이 가장 세다. 픽이 없는 사람(건너뛰었거나 다시 보기로 들어온 기존 사용자)에게는
 * 가장 오래된 실카드를 준다 — 자기 카드가 있는데 「첫 카드 만들기」를 보여줄 순 없다.
 *
 * 🔴 샘플 카드(`isSample`)는 제외한다. 가상 회사로 「내 카드」라고 말할 수 없다.
 */
function pickFinishApplication(
  apps: Application[] | undefined,
): Application | undefined {
  if (!apps || apps.length === 0) return undefined
  const oldestFirst = [...apps].sort(byCreatedAtAsc)
  const picks = oldestFirst.filter(
    (a) => a.createdVia === 'onboarding_pick' && a.isSample !== true,
  )
  if (picks.length > 0) {
    /*
      🔴 **가장 최근 온보딩의 첫 픽**이다 — 「가장 오래된 픽」이 아니다.
      온보딩을 다시 거친 계정(테스트·다시 보기)엔 옛 픽이 남아 있어, 오래된 것을 고르면
      방금 담은 회사가 아니라 지난번 회사가 「내 카드」로 나온다 (8/29 실기: 매번 대한항공).
      같은 온보딩에서 만든 픽은 한 요청 안에서 연달아 생성되므로, 최신 픽 기준 2분 안의
      것들을 한 묶음으로 보고 그중 **첫 장**(화면에서 본 순서)을 고른다.
    */
    const newest = Date.parse(picks[picks.length - 1].createdAt)
    const batch = Number.isNaN(newest)
      ? picks
      : picks.filter((a) => newest - Date.parse(a.createdAt) <= LATEST_BATCH_WINDOW_MS)
    return batch[0] ?? picks[picks.length - 1]
  }
  return oldestFirst.find((a) => a.isSample !== true)
}

/** 같은 온보딩에서 만들어진 픽으로 볼 시간 폭 — 한 요청 안의 생성이라 실제로는 1초 안이다 */
const LATEST_BATCH_WINDOW_MS = 2 * 60 * 1000

/**
 * 생성순(오래된 것 먼저).
 *
 * 🔴 `createdAt` 문자열을 그대로 비교하지 않는다. 서버가 주는 값은 전부 ISO UTC 라
 * 사전순이 시간순과 일치하지만, 형식이 한 번이라도 바뀌면 조용히 어긋난다.
 * 숫자로 바꿔 비교하고, 파싱 불가(`NaN`)는 맨 뒤로 보낸다 (렌더 중 호출이라 던지면 안 된다).
 */
function byCreatedAtAsc(a: Application, b: Application): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  if (Number.isNaN(ta)) return 1
  if (Number.isNaN(tb)) return -1
  return ta - tb
}
