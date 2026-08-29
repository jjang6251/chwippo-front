import { CompanyCard } from '@/components/card/CompanyCard'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import {
  SHOWCASE_COMPANY,
  SHOWCASE_JOB,
  SHOWCASE_SIDE_CARDS,
  makeShowcaseApplication,
} from '@/components/tour/showcase'
import { TourInert } from '@/components/tour/TourInert'
import { TourSideCard } from '@/components/tour/TourSideCard'

/**
 * 장면 1 — **「지원 카드 한 장으로 시작해요」**
 *
 * ## 🔴 흉내 카드가 아니라 실제 `CompanyCard` 다
 *
 * 모양만 베낀 카드는 실물이 바뀌면 소개 화면만 옛 모양으로 남고, 보드에 갔을 때
 * 「아까 그거」라는 연결이 약하다. 보드에서 만날 **바로 그 컴포넌트**를 그대로 세운다.
 *
 * ## 🔴 히어로는 무대 폭을 **다 쓴다** — 옆 기둥은 아래로 내려갔다 (8/29)
 *
 * 처음엔 카드 3장을 균등 3열로 놨다가(카드가 230px 로 눌려 `StepBar` 라벨이 전부 잘렸다)
 * 히어로 440px + 오른쪽 210px 기둥으로 고쳤다. 그런데 ③ 회사 조사 무대는 560px 을 다 쓰기
 * 때문에, ①→②→③ 으로 넘어갈 때 **같은 카드가 커졌다 작아졌다** 했다 (CEO 실기 8/29).
 *
 * 이제 카드 폭은 `TOUR_CARD_W_CLASS` 하나다. 폭을 다 쓴 히어로 옆에는 기둥을 둘 자리가
 * 없으므로, 다른 카드 두 장은 **히어로 아래 가로 한 줄 압축 카드**로 내려간다 —
 * 모바일과 같은 배치다. 「보드에는 여러 장이 쌓인다」는 문맥은 그대로 남는다.
 *
 * ## 🔴 「예시」 표기는 여기 한 번뿐이다
 *
 * 1~6장은 무신사 · 브랜드 마케터 **한 이야기**다(`showcase.ts`). 장면마다 「예시」를 붙이면
 * 화면이 계속 「이건 가짜예요」라고 말하게 되어 이야기에 몰입할 수 없다.
 */

export function Scene1() {
  return (
    <TourSceneLayout
      scene={1}
      cards
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto">
          {/* 안무 훅 — 연출 순서·지연은 전부 `index.css` 의 `.tour-stage-1` 스코프가 쥔다.
              장면 파일에는 「무엇이 있나」만 남기고 「언제 나오나」는 한 곳에 모은다. */}
          <div data-tour-open className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-semibold text-text-tertiary">지원 현황 보드</p>
            <span className="text-[10px] font-medium text-text-tertiary bg-card border border-line px-2 py-0.5 rounded-full">
              예시 · {SHOWCASE_COMPANY} {SHOWCASE_JOB}
            </span>
          </div>

          {/* 🔴 히어로는 무대 폭을 그대로 쓴다 — 폭은 `TourSceneLayout` 이 정한다 */}
          <TourInert>
            <CompanyCard application={makeShowcaseApplication()} />
          </TourInert>

          {/* 다른 카드 두 장 — 한 줄짜리 압축형. 데스크탑·모바일 같은 배치다 */}
          <div className="mt-2 space-y-2">
            {SHOWCASE_SIDE_CARDS.map((c) => (
              <TourSideCard key={c.company} {...c} />
            ))}
          </div>
        </div>
      }
      title="지원 카드 한 장으로 시작해요"
      description="회사·직무만 적으면 전형 단계가 자동으로 채워져요."
    />
  )
}
