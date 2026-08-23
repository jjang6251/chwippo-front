import { useState } from 'react'
import { Building2, Calendar, MapPin, TriangleAlert, Users, type LucideIcon } from 'lucide-react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { ResearchSourceChip } from '@/components/card/ResearchSourceChip'
import { useCompanyResearchCache } from '@/hooks/useCoverletterDoc'
import { hasResearchContent, isFilled } from '@/utils/companyResearch'
import { keywordChip } from '@/utils/researchKeywords'
import {
  parseNumberedList,
  parseQuotedStatements,
  parseTimeline,
  parseValueList,
} from '@/utils/researchTimeline'
import { toLocalDateString } from '@/utils/datetime'
import type { CompanyResearchData } from '@/types/interviewPrep'

/**
 * 카드 상세 「회사 알아보기」 탭 — 회사 조사가 **사는 집**.
 *
 * **왜 이 묶음인가**
 * - 🔴 **항목 이름이 아니라 쓸모로 묶는다.** 조사 12항목을 이름대로 나열하면 무조건 벽이 된다.
 *   취준생이 이 정보를 쓰는 순간에 맞춰 섹션을 나눈다 —
 *   ⓪ 회사가 나에게 뭘 원하는지 ① 회사를 파악할 때 ② 자소서를 쓸 때 ③ 면접을 준비할 때.
 *   그래서 제목이 「사업 영역·재무·경쟁사」가 아니라 **「어떤 회사인가요」** 다.
 * - 제목 문구 근거: 스트립(`CardResearchReveal`)이 던지는 질문이 「어떤 회사일까요?」다.
 *   그 스트립을 눌러 도착하는 자리라 **같은 질문에 답하는 제목**이어야 연결이 끊기지 않는다.
 *   나머지는 「이 회사 주요 키워드」·「이 회사가 원하는 사람」·「자소서에 쓸 이야기」.
 *   🔴 「예상 면접 키워드」였던 이름을 **「이 회사 주요 키워드」로 바꿨다**(2026-08-22).
 *   칩 카테고리가 tech·talent·business·role·issue 5종이라 면접 질문이 아니라
 *   **회사의 성격**이다 — 스트립 라벨을 「면접에서 물어요」→「어떤 회사일까요?」로
 *   고친 것과 같은 이유고, 이름이 바뀌자 자리도 따라 올라왔다(아래 「읽는 순서」).
 * - `productsAndTech` 는 **①에 둔다.** 제품·기술은 "이 회사가 무엇을 만드는가" 라는 정체성이고,
 *   ②는 지원동기·포부에 **설득 재료**로 쓰이는 것(행보·차별점·비전)만 모은다.
 *
 * **🔴 읽는 순서 — 이게 상단 배치의 근거다** (2026-08-22 상단 재구성)
 * | 순서 | 블록 | 무엇을 말하나 |
 * |---|---|---|
 * | 1 | 명함 (칩 한 줄) | **사실** — 업종·본사·설립·규모. 판단이 안 들어간 값 |
 * | 2 | 이 회사 주요 키워드 | **이 회사를 한 단어씩** — 우리가 뽑아낸 성격 |
 * | 3 | 이 회사가 원하는 사람 | **나에게 요구하는 것** |
 * | 4 | 어떤 회사인가요 · 자소서에 쓸 이야기 | **배경** — 작정하고 읽을 때 |
 * 좁아지는 깔때기다 — 사실 → 성격 → 나와의 접점 → 근거. 훑는 사람은 1·2 에서 멈춰도
 * "어떤 회사인지" 를 얻고, 쓰는 사람만 4 까지 내려간다.
 * 🔴 **키워드를 「이 회사가 원하는 사람」 안에 넣지 않는다.** 키워드는 *회사의 성격*이고
 * 그 그룹 제목은 *나에게 원하는 것*이라 뜻이 어긋난다 (스트립 라벨 정정과 같은 이유).
 * 별도 블록이라 순서 2·3 이 각자 선다.
 * 🔴 키워드 블록은 **소제목 없이 그룹 제목(16/700)이 곧 항목 이름**이다 — 항목이 하나뿐이라
 * 제목을 두 번 쓰면 껍데기가 되고, 이 페이지의 블록 제목은 **한 층뿐**이라 여기만
 * 작게 두면 위 명함(제목 없음)에 딸린 하위 항목처럼 읽힌다. 새 크기를 만들지 않는다.
 *
 * **🔴 명함에서 아바타·회사명을 뺐다** (2026-08-22 상단 재구성)
 * - 페이지 헤더(`BoardDetail`)에 **이미 같은 아바타 + 회사명**이 있다. 세로로 두 번 쌓이면
 *   같은 정보가 첫 화면의 117px 를 먹는다(실측). 남기는 건 헤더에 없는 것 — `companyProfile`
 *   칩 한 줄뿐이다. 실측 -48px.
 * - 🔴 칩이 하나도 없으면 **블록째 사라진다.** 회사명이 빠진 뒤엔 칩이 내용의 전부라
 *   빈 껍데기가 남으면 테두리만 있는 상자가 된다 (그룹 비면 숨김과 같은 계약).
 * - 제목(h2)이 사라져 이 블록엔 접근 가능한 이름이 없어졌다 → `aria-label` 로 대체한다.
 *   스크린리더에서 칩 넉 줄이 맥락 없이 읽히면 「1999년 6월 2일」이 무엇인지 알 수 없다.
 *
 * **맨 위 「이 회사가 원하는 사람」** (2026-08-22 재배치)
 * - 핵심가치·인재상·직무 정보 셋은 **"이 회사가 나에게 뭘 원하는가"** 하나로 묶인다.
 *   지원자가 자소서·면접에서 **가장 먼저 맞춰야 하는 축**이고, 실제 자소서 문항이 이걸 묻는다
 *   (「인재상 중 본인과 맞는 것」). 반면 사업요약·재무·경쟁사는 **배경지식**이라 뒤여도 된다.
 *   재배치 전엔 핵심가치가 「자소서에 쓸 이야기」 **끝**에, 인재상·직무 정보가 「면접 전에 볼 것」에
 *   흩어져 있어 **한 번에 안 보였다.**
 * - 제목이 「회사 정보」류가 아닌 이유: 나머지와 같은 톤으로 **쓸모**를 말해야 한다.
 *   「어떤 회사인가요」의 짝이다 — 회사가 뭘 하는 곳인지 다음에 오는 질문이 「나에게 뭘 원하나」.
 * - 실측 353개사 보유율 — 핵심가치 312 · 인재상 335 · 직무 정보 351. 상단이 비는 일은
 *   사실상 없다. 그래도 **셋 다 없으면 그룹째 사라진다**(다른 그룹과 같은 계약).
 *
 * **🔴 「빡!」은 크기가 아니라 단어를 뽑는 것** — 셋의 형태가 다른 게 곧 위계다
 * | 항목 | 형태 | 근거 |
 * |---|---|---|
 * | 인재상 | 15px/700 한 줄 (`·` 연결) | 3~5 단어라 그 자체로 강하다 |
 * | 핵심가치 | 목록 — 이름 15px/700 + 부연 12px | 파서가 `이름(부연)` 을 나눈다. **이름이 주인공** |
 * | 직무 정보 | 문단 13px/400 | 서술형이라 단어로 못 뽑는다. 억지로 뽑으면 문장이 토막난다 |
 * 🔴 **15px 은 DESIGN.md Body Large** — 섹션 제목(16/700)을 넘지 않는다. 다만 이 그룹의
 * 존재 이유가 그 단어들이라 **여기서만 본문이 소제목(14/600)보다 크다.** 라벨은 손대지 않아
 * 다른 그룹과 같은 층으로 읽히고, 커진 건 내용뿐이다 (DESIGN.md 「강조는 굵기로」).
 * 🔴 **핵심가치 문단형(실측 약 75%)은 문단 그대로.** 못 뽑으면 억지로 뽑지 않는다 —
 * 파서 계약이 타임라인·인용 블록과 같다.
 * 🔴 데스크탑은 전폭이 생기니 **핵심가치 | 인재상을 나란히** 놓고, 직무 정보만 전폭이다
 * (문단을 좁은 칸에 넣으면 답답하다). 모바일은 세로.
 * 🔴 **긴 쪽(핵심가치)이 왼쪽**인 게 실측 판정이다. 반대로 두면 인재상 한 줄 아래로
 * 왼쪽 칸이 270px 넘게 비어 카드에 구멍이 뚫린 것처럼 보인다(1440px 실측). 짧은 쪽을
 * 오른쪽에 두면 같은 여백이 **평범한 오른쪽 여백**이 된다. 문단형 핵심가치(약 75%)는
 * 3~5줄이라 애초에 균형이 맞는다 — 목록형에서만 생기는 문제였다.
 *
 * **남은 그룹 정리** (같은 재배치)
 * - 「면접 전에 볼 것」은 사라졌다. 키워드 하나만 남았고 그 하나가 이름을 바꿔 위로 갔다.
 * - 「자소서에 쓸 이야기」는 핵심가치가 빠져도 최근 행보·왜 이 회사인가·비전·미션이 남아
 *   「설득 재료」라는 응집력이 유지된다. 2열은 이제 **왼쪽 배경 · 오른쪽 쓸 거리** 둘뿐이다.
 * - 🔴 **키워드 칩이 인재상 바로 위 블록으로 돌아왔다**(상단 재구성). 그래도 **인재상은
 *   칩이 아니다** — 이유가 거리가 아니라 **뜻**이라서다. 인재상은 회사가 쓴 말 그대로고,
 *   칩은 우리가 뽑아낸 키워드다. 칩의 `talent` 카테고리가 같은 초록이라 칩으로 두면
 *   두 블록이 한 덩어리로 읽힌다 — 형태를 다르게 두는 게 경계다.
 * - 면접 세션 카드는 `coreValues` 를 「인재상·핵심가치」로 부르는데 여기선 `talentProfile` 이
 *   따로 있다. 같은 이름이 두 곳에 생기지 않게 **여기선 나눠 부른다.**
 *
 * **위계 — 3단** (2026-08-22 가독성 수리. "최근 행보나 비전·미션이 눈에 안 띈다")
 * | 층 | 규격 | 근거 |
 * |---|---|---|
 * | 섹션 제목 (`Group`) | 16px / 700 / `text-primary` | DESIGN.md Heading 2 |
 * | 소제목 (`FieldLabel`) | 14px / 600 / `text-primary` · `<h3>` | Body Medium |
 * | 본문 | 13px / 400 / `text-secondary` | Small |
 * 🔴 **고치기 전엔 소제목이 본문보다 작고(11px vs 12px) 흐렸다**(tertiary vs secondary).
 * 소제목이 뒤로 물러나 섹션 안이 평평했던 게 "안 띈다"의 직접 원인이다. 크기·굵기·색이
 * 세 층에서 **모두 단조 감소**해야 한다 — 소제목만 올리면 섹션 제목과 붙어 위계가 다시 무너진다.
 * 항목 간격은 `mb-6`(24px) — 본문 줄간격(≈21px)보다 커야 덩어리가 나뉜다.
 *
 * - `recentTrends` 가 이 화면에서 가장 강한 자리다 — 날짜가 붙은 회사의 실제 행보라
 *   지원동기에 그대로 쓰인다. 그래서 유일하게 **타임라인**으로 그린다(`utils/researchTimeline`).
 *   🔴 서식이 회사마다 달라 파싱이 실패할 수 있고, **실패하면 원문 문단을 그대로** 떨어뜨린다.
 * - `visionMission` 은 **인용 블록**(회사가 직접 쓴 말) · `coreValues` 는 **이름·부연 목록**.
 *   둘 다 파싱 실패 시 원문 문단 — 타임라인과 같은 계약이다. 🔴 인용 블록의 시각 언어는
 *   에디터의 `.chw-prose blockquote`(왼쪽 brand 3px 선)를 그대로 가져온다. 새로 만들지 않는다.
 * - 빈 항목은 **통째로 뺀다.** 12항목을 한 번에 펼치는 자리라 「확인하지 못했어요」까지
 *   자리를 잡으면 목록의 절반이 "없는 것"이 된다 (면접 세션 카드는 항목이 적어 그 표기가 맞다).
 *   🔴 **글자가 있어도 「확인하지 못함」뿐이면 같이 뺀다** — 판정은 `isFilled` 한 곳
 *   (`utils/companyResearch`)이라 탭 노출 판정(`BoardDetail`)과 어긋나지 않는다.
 *   항목이 다 빠져 그룹이 통째로 비면 그룹 제목도 사라진다 (`hasAbout` 등이 같은 `isFilled`).
 * - 맨 아래에 **AI 산출물이라는 사실·시점·출처**를 둔다. 숨기지 않는 게 신뢰를 만든다 —
 *   `CompanyResearchCard` 의 관례를 잇되, 빨간 경고 박스 대신 조용한 한 줄이다
 *   (여기는 면접 직전이 아니라 **둘러보는** 화면이라 톤을 낮춘다).
 *
 * 🔴 **조회수는 여기서 센다** (`countHit` 기본값 유지). 사람이 실제로 읽는 화면이고,
 * `hit_count` 는 다음 조사 배치의 우선순위 근거다. 자동 노출인 스트립만 미집계다.
 */
interface Props {
  applicationId: string
}

export function CompanyInfoTab({ applicationId }: Props) {
  const { data, isLoading } = useCompanyResearchCache(applicationId)
  const [showSources, setShowSources] = useState(false)

  if (isLoading) return <TabSkeleton />
  if (!hasResearchContent(data)) return null

  const r = data.research
  const inferred = new Set(r.inferredFields ?? data.inferredFields ?? [])
  const sources = r.sources ?? data.sources ?? []
  const cachedLabel = formatCachedAt(data.cachedAt)

  const hasProfile = isFilled(r.companyProfile)
  // ⓪ 맨 위 — 「이 회사가 원하는 사람」. 두 단어형이 **둘 다** 있을 때만 데스크탑 2열이다
  // (하나뿐인데 2열을 깔면 반쪽이 비어 로딩 실패처럼 보인다)
  const hasValues = isFilled(r.coreValues)
  const hasTalent = isFilled(r.talentProfile)
  const hasWanted = hasValues || hasTalent || isFilled(r.jobInsights)
  const hasAbout =
    isFilled(r.businessSummary) ||
    isFilled(r.productsAndTech) ||
    isFilled(r.financials) ||
    isFilled(r.competitors)
  const hasForCoverletter =
    isFilled(r.recentTrends) ||
    isFilled(r.differentiators) ||
    isFilled(r.visionMission)
  const hasKeywords = isFilled(r.interviewKeywords)
  // 상단 3블록이 다 비면 2열의 위 마진도 없어야 한다 — 안 그러면 빈 16px 띠가 남는다
  const hasTop = hasProfile || hasKeywords || hasWanted

  return (
    <div>
      {/* 🔴 **전폭 상단** — 명함 → 주요 키워드 → 「이 회사가 원하는 사람」 → 2열.
          사실 → 이 회사를 한 단어씩 → 나에게 요구하는 것 → 배경 (위 「읽는 순서」).
          2열 안(왼쪽 300px)에 있으면 그 아래를 전폭으로 만들 수 없어 셋 다 밖으로 뺐다.
          🔴 셋이 다 비면 이 div 는 **높이 0** 이다(`space-y` 는 자식 사이에만 붙는다) —
          그래서 컨테이너는 그대로 두고 아래 2열의 `mt-4` 만 `hasTop` 으로 끈다. */}
      <div className="space-y-4">
        {/* 🔴 명함 — **칩만.** 아바타·회사명은 페이지 헤더에 이미 있어 뺐다(중복 -48px).
            칩이 없으면 남는 게 없어 블록째 렌더하지 않는다.
            제목이 사라진 자리를 `aria-label` 이 대신한다 — 칩만 읽히면 맥락이 없다 */}
        {hasProfile && (
          <section
            aria-label="회사 기본 정보"
            className="border border-line bg-surface-2 rounded-xl p-5"
          >
            <ProfileChips profile={r.companyProfile!} />
          </section>
        )}

        {/* 🔴 「예상 면접 키워드」에서 개명 + 상단 이동. 소제목 없이 그룹 제목이 곧 항목 이름 */}
        {hasKeywords && (
          <Group title="이 회사 주요 키워드">
            <KeywordsField keywords={r.interviewKeywords ?? []} />
          </Group>
        )}

        {hasWanted && (
          <Group title="이 회사가 원하는 사람">
            {/* 🔴 `lg:[&>div]:mb-0` — 데스크탑에서만 두 항목의 `Block` 세로 마진을 끈다.
                안 끄면 **더 긴 쪽이 어디냐에 따라** 직무 정보 앞 간격이 24px 도 48px 도 되어
                데이터마다 달라진다. 모바일(세로)에서는 그 마진이 그대로 항목 간격이라 남긴다. */}
            {(hasValues || hasTalent) && (
              <div
                className={`mb-6 last:mb-0${
                  hasValues && hasTalent
                    ? ' lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start lg:[&>div]:mb-0'
                    : ''
                }`}
              >
                <ValuesField value={r.coreValues} inferred={inferred.has('coreValues')} />
                <TalentField values={r.talentProfile ?? []} />
              </div>
            )}
            {/* 서술형이라 단어로 못 뽑는다 — 문단인 채로 전폭 */}
            <Field
              label="직무 정보"
              value={r.jobInsights}
              inferred={inferred.has('jobInsights')}
            />
          </Group>
        )}
      </div>

      {/* 데스크탑 2열 — 왼쪽 = 「어떤 회사인가요」(회사 자체), 오른쪽 = 쓸 거리.
          🔴 **sticky 를 붙이지 않았다** (2026-08-22 실기 판정). 왼쪽 열이 뷰포트보다
          길어서(요약+제품칩+재무+경쟁사 ≈ 1,000px) 고정하면 둘 중 하나가 된다 —
          아래가 잘려 안 보이거나, macOS 에서 **보이지 않는 안쪽 스크롤바** 뒤로 숨는다.
          조용히 잘리는 게 최악이라 페이지와 함께 흐르게 뒀다. 모바일은 1열(grid 가 lg 부터).
          🔴 `mt-4` 가 조건부인 이유: 명함이 칩 없이 사라질 수 있게 되며 **상단이 통째로 빌
          수 있다.** 그때 고정 마진이 남으면 위에 16px 짜리 빈 띠가 생긴다. */}
      <div
        className={`lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-4 lg:items-start ${
          hasTop ? 'mt-4' : ''
        }`}
      >
        <div className="space-y-4">
          {hasAbout && (
            <Group title="어떤 회사인가요">
              <Field
                label="사업 영역"
                value={r.businessSummary}
                inferred={inferred.has('businessSummary')}
              />
              <ProductsField
                data={r.productsAndTech}
                inferred={inferred.has('productsAndTech')}
              />
              <Field
                label="재무·매출"
                value={r.financials}
                inferred={inferred.has('financials')}
              />
              <Field
                label="경쟁사·시장"
                value={r.competitors}
                inferred={inferred.has('competitors')}
              />
            </Group>
          )}
        </div>

        {/* 왼쪽 열이 통째로 빌 수 있어서(명함이 밖으로 나갔다) 모바일 간격을 조건부로 준다 */}
        <div className={`space-y-4 lg:mt-0 ${hasAbout ? 'mt-4' : ''}`}>
          {hasForCoverletter && (
            <Group title="자소서에 쓸 이야기">
              <TrendsField
                value={r.recentTrends}
                inferred={inferred.has('recentTrends')}
              />
              {/* 「왜 이 회사인가」 — 라벨이 곧 이 항목의 쓸모다 (원문은 경쟁사 대비 구조적 차이) */}
              <ListField
                label="왜 이 회사인가"
                value={r.differentiators}
                inferred={inferred.has('differentiators')}
              />
              <VisionField
                value={r.visionMission}
                inferred={inferred.has('visionMission')}
              />
            </Group>
          )}
        </div>
      </div>

      {/* 맨 아래 — 이게 AI 산출물이고 언제 조사됐는지. 숨기지 않는 게 신뢰를 만든다 */}
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-text-quaternary text-[11px] leading-relaxed flex items-start gap-1.5">
          <TriangleAlert size={12} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            AI 가 공개 자료를 모아 정리한 내용이에요. 사실과 다를 수 있으니 중요한 건
            회사 공식 발표로 확인하세요.
            {inferred.size > 0 && ' 「추정」 이 붙은 항목은 근거가 특히 약해요.'}
          </span>
        </p>
        {cachedLabel && (
          <p className="mt-1.5 text-text-quaternary text-[11px] font-mono">
            {cachedLabel}
          </p>
        )}
        {sources.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              aria-expanded={showSources}
              /* 높이는 앱 표준 32px — 글자가 11px 이라 `py-1.5` 로는 29px 였다(실측).
                 아이콘·글자 크기는 그대로 두고 히트 영역만 넓힌다. */
              className="flex items-center gap-1.5 min-h-[32px] text-text-tertiary hover:text-text-secondary text-[11px] font-semibold py-1.5 -mx-1 px-1 rounded hover:bg-surface-3/50 transition-colors"
            >
              <CollapsibleChevron open={showSources} />
              출처 ({sources.length})
            </button>
            {showSources && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {sources.map((s, i) => {
                  const url = typeof s === 'string' ? s : s.url
                  return <ResearchSourceChip key={`${url}-${i}`} url={url} />
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────

/**
 * 조사 시점 — `cachedAt` 은 실제 timestamp 라 **KST 헬퍼로** 바꾼다
 * (`toISOString().slice(0,10)` 은 UTC 라 9시간 어긋난다).
 * 타임라인의 날짜는 원문 텍스트라 여기 오지 않는다.
 */
function formatCachedAt(cachedAt?: string | Date): string | null {
  if (!cachedAt) return null
  const d = cachedAt instanceof Date ? cachedAt : new Date(cachedAt)
  if (Number.isNaN(d.getTime())) return null
  return `${toLocalDateString(d)} 기준 (KST)`
}

/** 위계 1단 — 섹션 제목. 16px/700 (DESIGN.md Heading 2 위, 소제목 14px 와 2단계 벌림) */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface-2 rounded-xl p-5">
      <h2 className="text-text-primary text-base font-bold mb-5">{title}</h2>
      {children}
    </section>
  )
}

/**
 * 위계 2단 — 소제목. 14px/600/`text-primary` 이고 **`<h3>`** 다.
 * 시각 위계와 문서 구조를 같이 세운다 (스크린 리더에서도 섹션 > 항목이 읽힌다).
 * 「추정」 배지는 면접 세션 카드와 같은 토큰·문구 — 같은 뜻이 화면마다 달라 보이면 안 된다.
 */
function FieldLabel({ label, inferred }: { label: string; inferred?: boolean }) {
  return (
    <h3 className="text-text-primary text-sm font-semibold mb-1.5 flex items-center gap-1.5">
      {label}
      {inferred && (
        <span
          className="bg-warning/10 text-warning border border-warning/30 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          title="AI 추정 — 정확성이 약할 수 있어요"
          aria-label="AI 추정 정보 — 정확성이 약할 수 있어요"
          role="note"
        >
          추정
        </span>
      )}
    </h3>
  )
}

/** 항목 간 세로 리듬 — 24px. 본문 줄간격(13px × 1.625 ≈ 21px)보다 커야 덩어리가 나뉜다 */
function Block({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 last:mb-0">{children}</div>
}

/** 위계 3단 — 본문. 13px/400/`text-secondary` */
function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-text-secondary text-[13px] leading-relaxed ${className}`}>{children}</p>
  )
}

function Field({
  label,
  value,
  inferred,
}: {
  label: string
  value?: string
  inferred?: boolean
}) {
  if (!isFilled(value)) return null
  return (
    <Block>
      <FieldLabel label={label} inferred={inferred} />
      <Body className="whitespace-pre-wrap">{value}</Body>
    </Block>
  )
}

/**
 * 🔴 이 화면의 payoff — 날짜를 배지로 뽑아 세로선에 꿴 **최근 행보**.
 * 파싱 실패(서식이 다르거나 날짜가 없음) → 원문 문단 그대로. 화면이 깨지면 안 된다.
 *
 * 라벨이 「최근 동향」이 아니라 「최근 행보」인 이유: 날짜가 붙은 **실제로 한 일**의 목록이고,
 * 그게 지원동기에 그대로 들어가는 재료다.
 */
function TrendsField({ value, inferred }: { value?: string; inferred?: boolean }) {
  if (!isFilled(value)) return null
  const entries = parseTimeline(value)
  return (
    <Block>
      <FieldLabel label="최근 행보" inferred={inferred} />
      {entries ? (
        <ol className="mt-1.5 border-l border-line pl-4 space-y-3">
          {entries.map((e, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[19px] top-1.5 w-1.5 h-1.5 rounded-full bg-brand"
              />
              {e.date && (
                <span className="inline-block font-mono text-[10px] text-brand bg-brand/10 border border-brand/25 px-2 py-0.5 rounded-full mb-1">
                  {e.date}
                </span>
              )}
              <Body>{e.text}</Body>
            </li>
          ))}
        </ol>
      ) : (
        <Body className="whitespace-pre-wrap">{value}</Body>
      )}
    </Block>
  )
}

/**
 * 비전·미션 — 회사가 **직접 쓴 말**이라 인용 블록으로 띄운다.
 * 🔴 시각 언어는 에디터의 `.chw-prose blockquote`(왼쪽 brand 3px 선 + `text-secondary`)를
 * 그대로 옮긴 것이다. 여기는 `.chw-prose` 밖이라 클래스를 못 얹어 토큰으로 다시 쓴다.
 * 인용부호가 없으면(실측 45%) `parseQuotedStatements` 가 null → 지금까지처럼 문단.
 */
function VisionField({ value, inferred }: { value?: string; inferred?: boolean }) {
  if (!isFilled(value)) return null
  const parsed = parseQuotedStatements(value)
  return (
    <Block>
      <FieldLabel label="비전·미션" inferred={inferred} />
      {parsed ? (
        <div className="space-y-2.5">
          {parsed.quotes.map((q, i) => (
            <blockquote key={i} className="border-l-[3px] border-brand pl-3.5 py-0.5">
              {q.label && (
                <p className="text-text-tertiary text-[11px] font-semibold mb-0.5">{q.label}</p>
              )}
              <p className="text-text-primary text-[13px] leading-relaxed">{q.text}</p>
              {q.note && (
                <p className="text-text-tertiary text-xs leading-relaxed mt-1">{q.note}</p>
              )}
            </blockquote>
          ))}
          {parsed.rest && <Body>{parsed.rest}</Body>}
        </div>
      ) : (
        <Body className="whitespace-pre-wrap">{value}</Body>
      )}
    </Block>
  )
}

/**
 * 핵심가치 — `이름(부연), 이름(부연), …` 을 목록으로. **이름이 주인공, 부연은 곁들임.**
 * 🔴 못 읽으면 원문 문단 그대로 (타임라인과 같은 원칙). 실측 322건 중 91건이 목록으로 떨어진다.
 *
 * 🔴 이름이 **15px/700**(Body Large)인 건 이 항목이 맨 위 그룹으로 올라왔기 때문이다 —
 * 「빡!」은 크기가 아니라 **단어를 뽑는 것**이고, 파서가 이미 뽑아 놓은 이름을 키우는 게
 * 그 실행이다. 부연은 12px/tertiary 로 남겨 대비를 만든다 (같이 키우면 다시 벽이 된다).
 * 문단형(실측 약 75%)은 **13px 본문 그대로** — 뽑을 게 없으면 키우지도 않는다.
 */
function ValuesField({ value, inferred }: { value?: string; inferred?: boolean }) {
  if (!isFilled(value)) return null
  const parsed = parseValueList(value)
  return (
    <Block>
      <FieldLabel label="핵심가치" inferred={inferred} />
      {parsed ? (
        <>
          {parsed.lead && (
            <p className="text-text-tertiary text-xs leading-relaxed mb-2">{parsed.lead}</p>
          )}
          <ul className="list-disc pl-4 marker:text-text-quaternary space-y-2.5">
            {parsed.items.map((it, i) => (
              <li key={i}>
                <p className="text-text-primary text-[15px] font-bold leading-snug">
                  {it.name}
                </p>
                {it.note && (
                  <p className="text-text-tertiary text-xs leading-relaxed mt-0.5">{it.note}</p>
                )}
              </li>
            ))}
          </ul>
          {parsed.tail && (
            <p className="text-text-tertiary text-xs leading-relaxed mt-2">{parsed.tail}</p>
          )}
        </>
      ) : (
        <Body className="whitespace-pre-wrap">{value}</Body>
      )}
    </Block>
  )
}

/** 번호형이지만 날짜가 없다 — 타임라인이 아니라 목록이다 */
function ListField({
  label,
  value,
  inferred,
}: {
  label: string
  value?: string
  inferred?: boolean
}) {
  if (!isFilled(value)) return null
  const items = parseNumberedList(value)
  return (
    <Block>
      <FieldLabel label={label} inferred={inferred} />
      {items ? (
        <ul className="space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-text-quaternary font-mono text-[10px] mt-1 shrink-0">
                {i + 1}
              </span>
              <span className="text-text-secondary text-[13px] leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Body className="whitespace-pre-wrap">{value}</Body>
      )}
    </Block>
  )
}

/** 제품·기술 스택 — 칩 색은 면접 세션 카드와 동일(제품 violet · 기술 info) */
function ProductsField({
  data,
  inferred,
}: {
  data?: { products?: string[]; techStack?: string[] }
  inferred?: boolean
}) {
  const products = data?.products ?? []
  const techStack = data?.techStack ?? []
  if (products.length === 0 && techStack.length === 0) return null
  return (
    <Block>
      <FieldLabel label="제품·기술 스택" inferred={inferred} />
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {products.map((p) => (
            <span
              key={p}
              className="text-[10px] font-medium bg-violet/10 text-violet border border-violet/30 px-2 py-0.5 rounded-full"
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {techStack.map((t) => (
            <span
              key={t}
              className="text-[10px] font-medium bg-info/10 text-info border border-info/30 px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Block>
  )
}

/**
 * 이 회사 주요 키워드 — **소제목이 없다.** 그룹에 이 항목뿐이라 그룹 제목이 곧 이름이다.
 *
 * 🔴 여기선 **자르지 않는다** — 스트립은 5개 상한(그 순간엔 8개가 시끄럽다)이지만
 * 이 화면은 작정하고 보는 자리라 상한이 곧 정보 손실이다. 색 규칙은 스트립과 공용
 * (`researchKeywords`) — 5 카테고리가 곧 「이 회사의 성격」이라 이름도 그렇게 바뀌었다.
 */
function KeywordsField({ keywords }: { keywords: CompanyResearchData['interviewKeywords'] }) {
  if (!keywords || keywords.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {keywords.map((kw, i) => {
        const { keyword, style } = keywordChip(kw)
        return (
          <span
            key={`${keyword}-${i}`}
            className={`text-[10px] font-medium ${style} border px-2 py-0.5 rounded-full`}
          >
            {keyword}
          </span>
        )
      })}
    </div>
  )
}

/**
 * 인재상 — 3~5 단어라 **그 자체로 강하다.** 15px/700 한 줄로 세운다 (`·` 로 잇는다).
 *
 * 🔴 **칩으로 만들지 않는다.** 이유가 「키워드 칩 옆에 있어서」가 아니라 **뜻**이다 —
 * 인재상은 회사가 쓴 말 그대로고, 칩은 우리가 뽑아낸 키워드다. 상단 재구성으로 칩 블록이
 * 바로 위로 돌아온 지금도 규칙은 그대로다 (칩의 `talent` 카테고리가 **같은 초록**이라
 * 칩으로 두면 두 블록이 한 덩어리로 읽힌다).
 *
 * 🔴 **밑줄도, `text-brand` 색 강조도 넣지 않는다** (2026-08-22 결정). 굵기만으로 세운다:
 * ① 이 앱에서 **밑줄은 이미 「누를 수 있는 것」**이다 — 약관 링크·「공고 보기」·「결과
 *    되돌리기」·클릭 가능한 스텝 이름 hover. 인재상은 못 누르니 **거짓 어포던스**가 된다.
 * ② `text-brand` 는 CTA·활성 상태 색이라 **색 + 밑줄 = 링크**로 읽힐 확률이 높다.
 * ③ 색 강조는 공부 노트 **형광펜(사용자가 직접 치는 것)** 과 어휘가 겹친다 — 우리가 칠한
 *    색을 사용자가 자기 표시로 오해한다.
 * → 바로 위 키워드 칩이 이미 색을 다 쓰고 있어 **여기까지 색이 되면 상쇄돼 아무것도 안
 *   튄다.** 상단이 전부 색인 화면에서 튀는 방법은 오히려 **색이 없는 굵은 글씨**다.
 */
function TalentField({ values }: { values: string[] }) {
  if (values.length === 0) return null
  return (
    <Block>
      <FieldLabel label="인재상" />
      <p className="text-text-primary text-[15px] font-bold leading-relaxed">
        {values.join(' · ')}
      </p>
    </Block>
  )
}

/**
 * 설립·본사·업종·규모 칩 — **명함의 전부다** (아바타·회사명은 페이지 헤더에 있다).
 * 🔴 `rounded-full` 이 아니라 `rounded-md` 다 — 원문 값이 「직원 수 약 26만 명(2024년 기준…)」
 * 처럼 길어 두 줄이 되는 경우가 있고, 알약 모양은 줄바꿈되면 형태가 무너진다.
 * 🔴 바로 아래 키워드 칩(`rounded-full` 색칩)과 **형태가 갈리는 게 이제 더 중요해졌다** —
 * 둘이 붙어 있어 같은 모양이면 사실과 우리가 뽑은 성격이 한 덩어리로 읽힌다.
 */
function ProfileChips({
  profile,
}: {
  profile: { founded?: string; hq?: string; industry?: string; size?: string }
}) {
  const fields: { icon: LucideIcon; value?: string }[] = [
    { icon: Building2, value: profile.industry },
    { icon: MapPin, value: profile.hq },
    { icon: Calendar, value: profile.founded },
    { icon: Users, value: profile.size },
  ].filter((f) => f.value?.trim())
  if (fields.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f, i) => {
        const Icon = f.icon
        return (
          <span
            key={i}
            className="inline-flex items-start gap-1 max-w-full bg-card border border-line rounded-md px-2 py-1 text-[11px] text-text-secondary"
          >
            <Icon size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 mt-0.5" />
            <span className="min-w-0">{f.value}</span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * 실제 배치와 같은 뼈대 — 명함(칩 한 줄) → 주요 키워드 → 상단 그룹 전폭 → 2열.
 * 다르면 로딩이 끝나는 순간 화면이 튄다.
 */
function TabSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="space-y-4">
        {/* 명함 — 아바타·회사명이 없어 칩 한 줄뿐이다 */}
        <div className="border border-line bg-surface-2 rounded-xl p-5 flex flex-wrap gap-1.5">
          {[72, 104, 88, 96].map((w) => (
            <div key={w} className="h-[26px] bg-card rounded-md" style={{ width: w }} />
          ))}
        </div>
        {/* 주요 키워드 — 알약 칩 */}
        <div className="border border-line bg-surface-2 rounded-xl p-5">
          <div className="h-3 w-28 bg-card-strong rounded mb-5" />
          <div className="flex flex-wrap gap-1">
            {[56, 44, 64, 48, 52].map((w) => (
              <div key={w} className="h-[19px] bg-card rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="border border-line bg-surface-2 rounded-xl p-5">
          <div className="h-3 w-28 bg-card-strong rounded mb-5" />
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 bg-card rounded" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
            <div className="space-y-2 mt-4 lg:mt-0">
              <div className="h-4 w-3/4 bg-card rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-4 lg:items-start">
        <div className="space-y-4">
          <div className="border border-line bg-surface-2 rounded-xl p-5 space-y-2">
            <div className="h-3 w-20 bg-card-strong rounded mb-3" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 bg-card rounded" style={{ width: `${90 - i * 12}%` }} />
            ))}
          </div>
        </div>
        {/* 오른쪽은 「자소서에 쓸 이야기」 하나뿐 — 키워드는 상단으로 갔다 */}
        <div className="space-y-4 mt-4 lg:mt-0">
          <div className="border border-line bg-surface-2 rounded-xl p-5 space-y-2">
            <div className="h-3 w-24 bg-card-strong rounded mb-3" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-card rounded" style={{ width: `${95 - i * 10}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
