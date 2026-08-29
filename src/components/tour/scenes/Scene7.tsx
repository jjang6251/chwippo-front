import { Check } from 'lucide-react'
import { CompanyCard } from '@/components/card/CompanyCard'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { TourInert } from '@/components/tour/TourInert'
import { cue, cueEach } from '@/components/tour/choreo'
import type { Application } from '@/types/application'

/**
 * 장면 7 — **「이제 내 카드로 시작해요」**
 *
 * ## 🔴 여기서만 **내 카드**로 돌아온다
 *
 * 1~6장은 무신사 · 브랜드 마케터 한 이야기였다. 마지막 한 장에서 화면이 **내 회사 이름**으로
 * 바뀌는 것이 이 투어의 결말이다 — 여섯 장 동안 본 것이 남의 일이 아니라 내 것이 된다는
 * 전환을, 문장이 아니라 카드 한 장으로 말한다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[7]`)
 *
 * 칩 3개(0.3s 간격) → 내 카드 `celebrateUp` → 제목 → 설명 → **CTA 팝(핵심 한 방)** → 보조 링크.
 * CTA·보조 링크는 하단 바에 있어 `Tour` 가 같은 표를 보고 그린다.
 */
interface Props {
  /** 사용자 본인 카드. 없으면 「첫 카드 만들기」 경로 */
  application: Application | null
  loading?: boolean
  /**
   * 🔴 카드 목록 **조회 실패** — 「0장」과 다르다. 못 받아온 것뿐인데 「첫 카드 만들기」를
   * 띄우면 카드를 가진 사람에게 없다고 말하는 셈이라, 중립으로(보드로) 닫는다.
   */
  failed?: boolean
}

const SCENE = 7
/** 여섯 장의 요약 — 순서가 장면 순서(2·3·4·5)와 같다 */
const OPENED = ['전형 단계 자동', '회사 조사 준비', 'AI 자소서·면접']

export function Scene7({ application, loading = false, failed = false }: Props) {
  return (
    <TourSceneLayout
      scene={7}
      cards
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-1.5">
            {OPENED.map((label, i) => (
              <span
                key={label}
                {...cueEach(SCENE, 'chips', 'chipStep', i, 'pop')}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border text-brand bg-brand/10 border-brand/25"
              >
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          {loading ? (
            <CardSkeleton />
          ) : application ? (
            <TourInert {...cue(SCENE, 'card', 'shell')} className="w-full">
              <CompanyCard application={application} />
            </TourInert>
          ) : (
            <div {...cue(SCENE, 'card', 'shell')} className="w-full">
              {failed ? <NeutralClose /> : <EmptyPromise />}
            </div>
          )}
        </div>
      }
      title="이제 내 카드로 시작해요"
      description={
        failed
          ? '카드는 보드에서 이어져요'
          : application
            ? '지금 본 것들이 이 카드에서 그대로 이어져요.'
            : '회사·직무만 적으면 지금 본 것들이 그대로 따라와요.'
      }
    />
  )
}

/**
 * 카드가 없는 사람의 무대 — **빈 카드를 그리지 않는다.**
 * 점선 자리는 「여기에 네 카드가 온다」는 뜻이고, 채워진 카드는 「이미 있다」는 거짓말이다.
 */
function EmptyPromise() {
  return (
    <div className="w-full border border-dashed border-line-strong rounded-xl p-6 text-center">
      <p className="text-sm text-text-secondary">여기에 내 첫 카드가 놓여요</p>
      <p className="text-xs text-text-quaternary mt-1">
        회사명만 있으면 전형 단계까지 자동으로 만들어져요
      </p>
    </div>
  )
}

/**
 * 목록을 못 받아왔을 때 — **아무것도 단정하지 않는다.**
 * 「첫 카드가 놓여요」(없다는 뜻)도 「내 카드」(있다는 뜻)도 쓸 수 없으므로,
 * 확실히 참인 것 하나만 말하고 보드로 넘긴다.
 */
function NeutralClose() {
  return (
    <div className="w-full border border-dashed border-line-strong rounded-xl p-6 text-center">
      <p className="text-sm text-text-secondary">내 카드는 보드에 있어요</p>
      <p className="text-xs text-text-quaternary mt-1">
        지금 본 것들이 카드마다 그대로 이어져요
      </p>
    </div>
  )
}

/** 캐시가 아직 없을 때. 🔴 스피너 금지 (ui-specs §1) */
function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="w-full bg-surface-2 border border-line rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-card animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3.5 w-28 rounded bg-card animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-card animate-pulse" />
        </div>
      </div>
      <div className="mt-4 h-9 rounded-lg bg-card animate-pulse" />
    </div>
  )
}
