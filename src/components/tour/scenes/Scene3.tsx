import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { DdayValueBadge } from '@/components/card/DdayBadge'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { cue, cueEach } from '@/components/tour/choreo'
import {
  SHOWCASE_BUSINESS_SUMMARY,
  SHOWCASE_COMPANY,
  SHOWCASE_DDAY_TASK,
  SHOWCASE_JOB,
  SHOWCASE_KEYWORD_EXPANDED,
  SHOWCASE_KEYWORD_HINT,
  SHOWCASE_PRODUCTS,
  SHOWCASE_RESEARCH_KEYWORDS,
  SHOWCASE_RESEARCH_SECTIONS,
  SHOWCASE_ROLE_INSIGHT,
  SHOWCASE_STATS,
  SHOWCASE_STORY,
  SHOWCASE_TALENT_PROFILE,
} from '@/components/tour/showcase'

/**
 * 장면 3 — **「회사 조사가 카드 안에 들어 있어요」**
 *
 * 3등분 상자가 아니라 **카드 헤더 + 탭 줄 + 본문**이다 — 사용자가 나중에 실제로 만날 화면이
 * `BoardDetail` 의 「회사 알아보기」 탭이라, 같은 문법이어야 「카드 안에 있다」가 형태로 읽힌다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[3]`)
 *
 * 틀 → 카드 헤더 → 탭 줄 → 활성 탭 슬라이드 → 라벨 → 칩 4개 →
 * **칩 하나가 펼쳐지며 「면접에서 뭐가 나오나」(핵심 한 방)** → 원하는 사람 → 인용문 → 제목·설명.
 *
 * 🔴 칩 색을 카테고리로 나누지 않는다 — 취준생 눈에 색이 무슨 뜻인지 알 수 없어 알록달록한
 * 상자로만 보였다(CEO 실기). 전부 같은 brand 틴트로 두고 **하나를 펼쳐 내용으로** 답한다.
 */
const SCENE = 3

/**
 * 섹션 라벨·본문의 **한 벌 규격**.
 *
 * 🔴 본문 하한은 **12px** 이다. 네 섹션을 카드 하나에 넣느라 글자를 더 줄이고 싶어지는데,
 * 그러면 「정보가 많다」가 아니라 「안 읽힌다」가 된다 — 못 들어가면 글자가 아니라 **문장**을
 * 줄인다 (`SHOWCASE_STORY` 한 줄씩).
 */
const LABEL = 'text-[11px] font-semibold text-text-tertiary'
const BODY = 'text-xs text-text-secondary leading-snug'
/**
 * 🔴 **40자 넘는 문장은 14px 이상** (DESIGN.md 7-b). 한 줄 요약만 이 규격을 탄다 —
 * 나머지(키워드 힌트·자소서 불릿·직무 인사이트)는 40자 미만이라 12px 로 둔다.
 * 「글자를 줄여 자리를 만들지 않는다」가 규칙이라, 커진 만큼은 아래에서 자리를 만들었다.
 */
const BODY_LONG = 'text-sm text-text-secondary leading-snug'
/** 섹션 사이 — 모바일은 얇은 구분선, 데스크탑 오른쪽 열 첫 섹션만 예외 */
const SECTION = 'mt-2 pt-2 border-t border-line'

/** 실제 카드 상세의 탭 줄 — 「회사 조사」가 열려 있다 */
const TABS = ['전형', '회사 조사', '자소서'] as const
const ACTIVE_TAB = '회사 조사'

export function Scene3() {
  return (
    <TourSceneLayout
      scene={3}
      /* 🔴 `cards` = **확대 금지**. 무대 폭(560)은 이미 전 장면이 같지만, 자동 확대가
         비어 있는 데스크탑을 채우려고 이 장면만 1.29배로 키워서 **화면에 보이는 카드가
         720px** 이 됐다 — ①②⑦(560)과 나란히 놓으면 그게 CEO 가 말한 「커졌다 작아졌다」다.
         여기 주인공도 ①에서 본 그 카드라, 혼자 커지면 안 된다. */
      cards
      tall
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto text-left">
          <div
            {...cue(SCENE, 'shell', 'shell')}
            className="bg-surface-2 border border-line rounded-xl p-3 lg:p-4 shadow-sm"
          >
            {/* 카드 헤더 — 1장에서 본 그 카드다 (아바타·회사명·직무·D-day) */}
            <div {...cue(SCENE, 'cardHeader', 'pop')} className="flex items-center gap-3 min-w-0">
              <CompanyAvatar name={SHOWCASE_COMPANY} size="md" />
              <div className="min-w-0">
                <h3 className="text-text-primary text-[15px] font-semibold truncate">
                  {SHOWCASE_COMPANY}
                </h3>
                <p className="text-text-tertiary text-xs truncate mt-0.5">{SHOWCASE_JOB}</p>
              </div>
              <span className="ml-auto shrink-0">
                <DdayValueBadge dday={SHOWCASE_DDAY_TASK} />
              </span>
            </div>

            {/* 탭 줄 — `BoardDetail` 과 같은 문법. 🔴 `aria-hidden` 장식이다(누를 수 없다) */}
            <div
              {...cue(SCENE, 'tabs')}
              aria-hidden="true"
              className="mt-2.5 flex gap-1 p-1 bg-surface-2 border border-line rounded-lg"
            >
              {TABS.map((t) =>
                t === ACTIVE_TAB ? (
                  <span
                    key={t}
                    {...cue(SCENE, 'tabActive', 'slide')}
                    className="flex-1 py-1.5 text-xs font-medium rounded-md text-center break-keep bg-surface-3 text-text-primary"
                  >
                    {t}
                  </span>
                ) : (
                  <span
                    key={t}
                    className="flex-1 py-1.5 text-xs font-medium rounded-md text-center break-keep text-text-tertiary"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>

            {/* 2열은 **데스크탑만** — 왼쪽 = 회사 자체(키워드·어떤 회사), 오른쪽 = 쓸 거리
                (자소서·원하는 사람). 실제 탭의 2열 배치와 같은 가름이다. */}
            <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-5">
              <div>
                {/* ① 이 회사 주요 키워드 */}
                <p {...cue(SCENE, 'keywordLabel')} className={LABEL}>
                  {SHOWCASE_RESEARCH_SECTIONS.keywords}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SHOWCASE_RESEARCH_KEYWORDS.map((kw, i) => {
                    const expanded = kw === SHOWCASE_KEYWORD_EXPANDED
                    return (
                      <span
                        key={kw}
                        {...cueEach(SCENE, 'chips', 'chipStep', i)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          expanded
                            ? 'text-brand bg-brand/15 border-brand'
                            : 'text-brand bg-brand/10 border-brand/25'
                        }`}
                      >
                        {kw}
                      </span>
                    )
                  })}
                </div>
                <p {...cue(SCENE, 'expand')} className={`mt-1.5 ${BODY}`}>
                  {SHOWCASE_KEYWORD_HINT}
                </p>

                {/* ② 어떤 회사인가요 — 숫자가 있어야 「조사됐다」로 읽힌다 */}
                <div className={SECTION}>
                  <p {...cue(SCENE, 'about')} className={LABEL}>
                    {SHOWCASE_RESEARCH_SECTIONS.about}
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {SHOWCASE_STATS.map((s, i) => (
                      <div
                        key={s.label}
                        {...cueEach(SCENE, 'stats', 'statStep', i)}
                        /* 🔴 **칸 폭이 모바일·데스크탑에서 거꾸로다.** 모바일은 3열이라
                           칸이 94px 이고, 데스크탑은 카드가 2열로 갈려 78px 로 **더 좁다**.
                           그래서 배치를 바꿔 끼운다 — 모바일은 「라벨+증감 / 값」 2줄,
                           데스크탑은 「라벨 / 값 / 증감」 3줄(세로는 남는다). 순서만 `order`
                           로 갈아 끼우므로 **DOM 은 하나**다(증감을 두 번 그리지 않는다).
                           한 줄에 다 넣었더니 「1조 4,679억」이 「1조 4,…」로 잘렸다(실측). */
                        className="rounded-md bg-card border border-line px-1 py-1 lg:py-1.5 flex flex-wrap items-baseline gap-x-1"
                      >
                        <span className="order-1 lg:w-full text-[10px] leading-none text-text-quaternary truncate">
                          {s.label}
                        </span>
                        <span className="order-2 lg:order-3 ml-auto lg:ml-0 shrink-0 font-mono text-[10px] leading-none text-brand">
                          {s.delta}
                        </span>
                        <span className="order-3 lg:order-2 w-full mt-1 lg:mt-0.5 lg:mb-0.5 font-mono text-xs font-semibold text-text-primary whitespace-nowrap">
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p {...cue(SCENE, 'summary')} className={`mt-1 ${BODY_LONG}`}>
                    {SHOWCASE_BUSINESS_SUMMARY}
                  </p>
                  <div
                    {...cue(SCENE, 'products')}
                    className="mt-1 flex flex-wrap gap-1"
                  >
                    {SHOWCASE_PRODUCTS.map((p) => (
                      <span
                        key={p}
                        className="text-[11px] text-text-secondary bg-card border border-line px-1.5 py-0.5 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:border-l lg:border-line lg:pl-5">
                {/* ③ 자소서에 쓸 이야기 */}
                <div className={`${SECTION} lg:mt-0 lg:pt-0 lg:border-t-0`}>
                  <p {...cue(SCENE, 'story')} className={LABEL}>
                    {SHOWCASE_RESEARCH_SECTIONS.story}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {SHOWCASE_STORY.map((s, i) => (
                      <li
                        key={s.label}
                        {...cueEach(SCENE, 'story', 'storyStep', i + 1)}
                        className={`${BODY} break-keep`}
                      >
                        <span className="text-text-tertiary">{s.label}</span>
                        <span className="text-text-quaternary"> · </span>
                        {s.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ④ 이 회사가 원하는 사람 */}
                <div className={SECTION}>
                  <p {...cue(SCENE, 'talent')} className={LABEL}>
                    {SHOWCASE_RESEARCH_SECTIONS.wants}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {SHOWCASE_TALENT_PROFILE.map((t, i) => (
                      <span
                        key={t}
                        {...cueEach(SCENE, 'talent', 'talentStep', i + 1)}
                        className="text-[11px] text-text-secondary bg-card border border-line px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {/* 🔴 핵심 한 방 — 회사 이야기가 **내 직무 이야기**로 바뀌는 줄 */}
                  <p
                    {...cue(SCENE, 'roleInsight', 'pop')}
                    className={`mt-1.5 border-l-2 border-brand/60 pl-2 ${BODY} break-keep`}
                  >
                    {SHOWCASE_ROLE_INSIGHT}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      title="회사 조사가 카드 안에 들어 있어요"
      description="사업·실적·최근 동향·인재상·직무 인사이트까지 — 검색 없이 카드에서 바로 봐요."
    />
  )
}
