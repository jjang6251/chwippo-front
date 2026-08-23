import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { useDemoMode } from '@/contexts/demoMode'
import { useCompanyResearchCache } from '@/hooks/useCoverletterDoc'
import { trackClarityEvent } from '@/lib/clarity'
import { useAuthStore } from '@/stores/authStore'
import { markResearchRevealSeen } from '@/utils/researchIntro'
import { keywordChip } from '@/utils/researchKeywords'

/**
 * 회사 조사 노출 — 보드 상단 스트립(기본) · 첫 카드 축하 오버레이 안(변형).
 *
 * 뜨는 경로는 둘이다 — **카드 추가 직후**(항상) · **보드 진입 1회**(`intro`, 기존 사용자용).
 * 후자는 그 순간을 영영 못 만나는 사람들 때문에 있다(`utils/researchIntro` 참조).
 *
 * **왜 이 형태인가**
 * - 🔴 **정보를 나열하면 실패다.** 조사 11항목 중 **3개만** 낸다 —
 *   면접 키워드(주인공·색칩) → 인재상(인라인 텍스트) → 한 줄 요약(가장 약한 톤).
 *   `recentTrends`(300자)·재무·경쟁사는 뺐다. "많다" 가 되는 순간 "오~" 가 사라진다.
 * - 🔴 **카드 안이 아니라 그리드 위 스트립이다** (2026-08-22 실물 판정으로 이동).
 *   카드 안에 넣었더니 두 가지가 깨졌다: ① 보드 그리드가 `[grid-auto-rows:1fr]` 로 높이를
 *   맞추는 계약이라 **관계없는 카드까지 전부 +112px 커지며 텅 비었다**(모바일은 화면 대부분).
 *   ② 새 카드가 정렬상 어디 놓일지 몰라 **화면 밖이면 아예 못 봤다.**
 *   위로 올리면 그리드는 **무접촉**이고(카드 높이 회귀 spec 그대로), 항상 눈에 들어온다.
 * - 🔴 **카드처럼 보이면 안 된다.** 바로 아래가 카드 그리드다. 카드는 셋을 다 갖는다 —
 *   채움(`bg-surface-2`) · 사방 테두리 · `rounded-xl`. 스트립은 **셋 다 버리고** 카드가
 *   이미 쓰는 좌측 accent(`border-l-2`) 하나만 남긴다. 같은 언어, 다른 그릇.
 * - 🔴 **어느 회사 얘기인지** 를 아바타 + 회사명으로 붙인다 — 카드 밖으로 나오는 순간
 *   "방금 만든 그 카드" 라는 연결이 끊긴다. 표기는 카드 헤더와 같은 컴포넌트를 쓴다.
 * - 🔴 **가짜 로딩 금지.** 데이터는 캐시(+생성 직후 prefetch)라 즉시 온다. "조사 중…" 은
 *   없는 일을 지어내는 것 (AI UX 원칙 「매끄러움 우선」). 대신 3요소가 촘촘히 순차 등장한다.
 * - 🔴 **조사가 없으면 아무것도 렌더하지 않는다.** 미조사·만료(둘 다 `null`)·`opt_out`·
 *   API 실패가 **전부 같은 처리**다. 부탁하지 않은 일이라 실패도 알리지 않는다(토스트 금지).
 *   레이아웃 이동 0.
 *
 * 등장 연출은 기존 `animate-fadeInUp`(0.2s · opacity + 8px 상승) 재사용 — 새 시각 언어를
 * 만들지 않는다. `prefers-reduced-motion` 은 전역 가드(index.css)가 duration 을 0.01ms 로
 * 눌러버리지만 **delay 는 안 건드리므로** 축하 오버레이와 같은
 * `motion-reduce:animate-none + motion-reduce:opacity-100` 로 확실히 즉시 표시시킨다.
 */
interface Props {
  applicationId: string
  /**
   * `strip`(기본) — 보드 필터 줄 아래·카드 그리드 위 가로 스트립.
   * `celebration` — 첫 카드 축하 오버레이 안 (오버레이라 그리드와 무관).
   *   🔴 컴포넌트를 복제하지 않는다 — 3요소가 두 벌이 되면 곧 서로 달라진다.
   */
  variant?: 'strip' | 'celebration'
  /** strip 전용 — 어느 회사 얘기인지 (카드 헤더와 같은 아바타·회사명 표기) */
  company?: { name: string; domain?: string | null }
  /** strip 전용 — 닫기. 화면 상단을 차지하므로 조용히 치울 수단은 있어야 한다 */
  onDismiss?: () => void
  /**
   * strip 전용 — **보드 진입 1회 노출**로 뜬 것인가 (기존 사용자용 · `Board`).
   *
   * 🔴 **이 경우에만 한 줄 안내가 붙는다.** 스트립은 원래 "방금 한 일에 대한 반응" 인데
   * 3주 전에 만든 카드에 갑자기 뜨면 **"이게 왜 지금?"** 이 된다. 카드 추가로 뜬 경우엔
   * 방금 한 일이 답이라 안내가 필요 없다(붙이면 오히려 군더더기).
   * 계측 이름도 여기서 갈린다 — "기존 사용자에게 닿았는가" 를 따로 봐야 한다.
   */
  intro?: boolean
  /** 순차 등장 시작 시각(ms). 축하 오버레이는 체크 행이 다 뜬 뒤부터 시작한다 */
  startDelayMs?: number
}

/**
 * 요약은 **전문을 그대로**. 처음엔 첫 문장 + 한 줄 고정이었는데 **문장이 길면 잘렸다**
 * (2026-08-22 CEO 실기 — "글이 길면 잘리네"). 잘린 소개는 안 읽히느니만 못하다:
 * 마지막 어절이 사라져 무슨 회사인지가 오히려 흐려진다.
 * 대신 **위계는 색·크기로만** 유지한다(가장 약한 톤) — 줄 수가 늘어도 주인공은 칩이다.
 */

/** 이 순간에 색칩 8개는 시끄럽다 — 원본 7~8개 중 앞 5개만 */
const MAX_KEYWORDS = 5
/** 요소 간 간격. 축하 오버레이 체크 행(400ms)보다 훨씬 촘촘하게 — 작은 요소들이다 */
const STEP_MS = 90

export function CardResearchReveal({
  applicationId,
  variant = 'strip',
  company,
  onDismiss,
  intro = false,
  startDelayMs = 120,
}: Props) {
  const isOverlay = variant === 'celebration'
  const isDemo = useDemoMode()
  const userId = useAuthStore((s) => s.user?.id)

  // 🔴 조회수 미집계 — 자동 노출은 "읽은 것" 이 아니다 (hit_count = 조사 수요 신호)
  const { data } = useCompanyResearchCache(applicationId, true, { countHit: false })

  const research = data?.status === 'ok' ? data.research : undefined
  const keywords = (research?.interviewKeywords ?? []).slice(0, MAX_KEYWORDS)
  const talents = research?.talentProfile ?? []
  const summary = research?.businessSummary?.trim() ?? ''
  /* 세 항목이 전부 비면 껍데기만 남는다 — 그건 조사가 없는 것과 같다.
     미조사·만료(`null`)·`opt_out`·API 실패도 여기서 한 줄로 합쳐진다. */
  const visible =
    Boolean(research) && (keywords.length > 0 || talents.length > 0 || summary.length > 0)

  /**
   * 계측 ① **실제로 떴을 때.** 카드를 추가한 사람 중 몇 %가 조사가 있는 회사였는지 —
   * 즉 **커버리지**를 이 이벤트로만 알 수 있다 (조사가 없으면 컴포넌트가 통째로 null 이라
   * 아무 흔적도 남지 않기 때문).
   *
   * 🔴 **노출 하나당 한 번만.** `ref` 로 잠근다 — 리렌더·React StrictMode 이중 호출마다 쏘면
   * 분모가 부풀어 수치가 무의미해진다. 자리(`strip`/`celebration`/`intro`)를 이름에 넣는 건
   * `jobhub_{site}_{placement}` 관례 — 나중에 갈라 볼 수 없으면 안 만든 것과 같다.
   *
   * 🔴 데모는 렌더는 하되 계측은 안 보낸다 (`JobSiteChips` 선례). 실사용자 판정을 오염시키면 안 된다.
   * 훅이라 위 early return 보다 앞에 있어야 하므로 `visible` 로 조건을 옮겼다.
   */
  /**
   * 자리·경로를 합친 계측 이름. `intro` 는 strip 의 한 갈래지만 **분모가 다르다** —
   * 카드 추가 노출(그날 카드를 만든 사람)과 섞이면 "기존 사용자에게 닿았는가" 를 못 본다.
   * shown 뿐 아니라 click 도 같은 토큰을 쓴다 (섞이면 두 경로의 CTR 이 둘 다 거짓이 된다).
   */
  const place = intro ? 'intro' : variant

  /**
   * 이미 쏜 노출의 표식. 🔴 **mount 가 아니라 「무엇을 보여줬는가」 단위다** — 스트립은 같은
   * 컴포넌트 자리에서 대상이 갈아끼워진다(보드 진입 노출 뒤 카드 추가, 카드 연속 추가).
   * `boolean` 한 개로 잠그면 그 두 번째부터가 통째로 안 잡혀 분자가 비는데, 정작 막으려던
   * 리렌더·StrictMode 이중 호출은 key 가 같아 그대로 걸러진다.
   */
  const shownKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!visible) return
    /**
     * 🔴 **소진은 「떴다」이지 「시도했다」가 아니다.** 보드 진입 1회 노출의 기회를 여기서
     * 쓴다 — 렌더 주체가 이 컴포넌트라서다. `Board` 가 미리 판단하려면 조사 유무를 **두 번**
     * 알아야 하고(스트립도 알고 보드도 알고), 그러면 조사가 없는 날에 기회만 날아간다.
     * 카드 추가·축하 오버레이로 뜬 것도 같은 기회를 쓴다 — 이미 본 사람에게 또 보여줄 순 없다.
     */
    markResearchRevealSeen(userId)
    const shownKey = `${place}:${applicationId}`
    if (isDemo || shownKeyRef.current === shownKey) return
    shownKeyRef.current = shownKey
    trackClarityEvent(`research_reveal_shown_${place}`)
  }, [visible, isDemo, place, userId, applicationId])

  if (!visible) return null

  let step = 0
  const delay = () => ({ animationDelay: `${startDelayMs + step++ * STEP_MS}ms` })
  const enter =
    'animate-fadeInUp motion-reduce:animate-none opacity-0 motion-reduce:opacity-100 [animation-fill-mode:both]'
  /* 라벨은 정보 이름(「회사 조사」)이 아니라 **말을 건다**. 하나뿐 — 인재상·요약은
     형태(크기·색)로 구분한다. 라벨 3개면 그게 투박함이다.

     🔴 처음엔 「면접에서 이런 걸 물어요」였는데 **두 가지가 틀렸다** (2026-08-22 CEO 지적).
     ① 부정확 — 칩의 카테고리는 tech·talent·business·role·issue 5종이라 면접 질문이 아니라
       **회사의 성격**이다. ② 자리와 안 맞음 — 이 라벨은 회사명 옆에 서서 **스트립 전체**를
       대표하는데, 요약이 전문으로 늘어난 뒤로는 칩만 설명하는 문구가 됐다.
     회사명이 바로 앞에 있으므로 이름을 반복하지 않는다. */
  const label = '어떤 회사일까요?'

  const body = (
    <>
      {keywords.length > 0 && (
        <div style={delay()} className={`${enter} flex flex-wrap gap-1`}>
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
      )}

      {talents.length > 0 && (
        /* 🔴 칩으로 만들지 않는다 — 키워드와 형태가 같으면 위계가 무너진다 */
        <p
          style={delay()}
          /* 잘라내지 않는다 — 3~5 단어라 길어야 두 줄이고, 자르면 마지막 인재상을 잃는다 */
          className={`${enter} mt-2 text-text-tertiary ${
            isOverlay ? 'text-xs' : 'text-[11px]'
          }`}
        >
          {talents.join(' · ')}
        </p>
      )}

      {summary && (
        /* 맥락일 뿐 payoff 가 아니다 — 위계는 **색·크기로만** 낮춘다(자르지 않는다) */
        <p
          style={delay()}
          className={`${enter} mt-1 leading-relaxed text-text-quaternary ${
            isOverlay ? 'text-xs' : 'text-[11px]'
          }`}
        >
          {summary}
        </p>
      )}
    </>
  )

  if (isOverlay) {
    return (
      <div className="mx-auto max-w-xs text-left border-t border-line pt-4 mb-6">
        {keywords.length > 0 && (
          <p style={delay()} className={`${enter} text-text-tertiary text-[11px] font-semibold mb-1.5`}>
            {label}
          </p>
        )}
        {body}
      </div>
    )
  }

  return (
    <section
      aria-label={company ? `${company.name} 회사 조사` : '회사 조사'}
      // 채움·사방 테두리·라운드 없음 = 카드가 아니다 (위 주석 참고)
      className="border-l-2 border-brand/60 pl-3 py-0.5 mb-4"
    >
      {/*
        🔴 **보드 진입 1회 노출에만** 붙는 한 줄 (`intro`). 안 붙이면 3주 전 카드에 갑자기
        떠서 "이게 왜 지금?" 이 된다.
        - **기능을 설명한다** — 「새 기능이 나왔어요」 류는 무엇이 생겼는지를 안 알려준다.
          「이런」 은 바로 아래 3요소를 가리켜 설명과 실물을 한 줄로 잇는다.
        - 🔴 「카드**마다**」가 아니라 「카드에서」 — 조사 커버리지가 100% 가 아니라
          카드마다 있다고 말하면 다른 카드를 열어본 사람에게 거짓말이 된다.
        - 톤은 가장 약하게(`text-text-quaternary`·11px). 주인공은 여전히 칩이다 —
          이 줄이 커지면 "공지" 가 되고, 보여주는 대신 말하는 쪽으로 되돌아간다.
        - 배지·아이콘을 새로 만들지 않는다 (NEW 뱃지 등 = 없던 시각 언어).
      */}
      {intro && (
        <p style={delay()} className={`${enter} text-[11px] text-text-quaternary mb-1.5`}>
          이제 카드에서 이런 회사 정보를 볼 수 있어요
        </p>
      )}
      <div className="flex items-start gap-2">
        {/*
          🔴 스트립 전체가 **카드 상세 「회사 알아보기」 탭으로 가는 길**이다 (2026-08-22).
          여기서 3요소를 본 사람이 다음에 하고 싶은 건 "더 보기" 인데, 그 자리가 없으면
          이 순간이 막다른 길이 된다.
          - **닫기(×)는 이 길 밖에 둔다** — 링크 안에 넣으면 치우려다 이동해버린다.
            (버튼 안 버튼은 HTML 로도 잘못됐고, 두 동작이 정반대라 더더욱 겹치면 안 된다.)
          - `<a>` 다 — cmd+클릭·새 탭·스크린리더의 링크 목록이 전부 공짜로 따라온다.
            버튼으로 만들면 `<p>` 를 품은 버튼이 돼 마크업도 깨진다.
        */}
        <Link
          to={`${isDemo ? '/demo' : ''}/board/${applicationId}?tab=company`}
          /* 계측 ③ 의 출처 표식. 🔴 URL 쿼리(`&from=strip`)로 안 붙인 이유 — 사용자가
             복사·공유한 주소에도 따라다녀 남의 클릭까지 스트립 성과로 잡힌다.
             router state 는 **이 이동에만** 실린다 (BoardDetail 이 읽는다). */
          state={{ from: 'strip' }}
          // 계측 ② 스트립이 클릭을 만드는가. 실패해도 이동은 정상 — `trackClarityEvent` 가 삼킨다
          onClick={() => {
            if (!isDemo) trackClarityEvent(`research_reveal_click_${place}`)
          }}
          aria-label={company ? `${company.name} 회사 정보 자세히 보기` : '회사 정보 자세히 보기'}
          className="group min-w-0 flex-1 -m-1 p-1 rounded-md hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <div
            style={delay()}
            className={`${enter} flex items-center gap-2 mb-1.5 min-w-0`}
          >
            {company && (
              <CompanyAvatar name={company.name} domain={company.domain} size="xs" />
            )}
            {company && (
              <span className="text-xs font-semibold text-text-primary truncate">
                {company.name}
              </span>
            )}
            {keywords.length > 0 && (
              <span className="text-[11px] text-text-tertiary truncate">{label}</span>
            )}
            {/* 「스텝 열기 →」·「카드 보러가기 →」 와 같은 관례 — 눌러도 되는 곳이라는 신호 */}
            <span
              aria-hidden="true"
              className="ml-auto shrink-0 text-[11px] text-brand group-hover:text-brand-hover transition-colors"
            >
              자세히 →
            </span>
          </div>
          {body}
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="회사 조사 닫기"
            /* 터치 타겟은 앱 표준 32px(`w-8 h-8`) — 아이콘은 14px 그대로 두고 히트 영역만 넓힌다.
               28px(`w-7 h-7`)로 뒀다가 실측에서 걸렸다: 이 ×는 모바일 보드 상단에 뜨는데
               바로 옆이 「자세히 →」 링크라, 작을수록 치우려다 이동하는 오조작이 난다. */
            className="shrink-0 -mt-0.5 w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  )
}
