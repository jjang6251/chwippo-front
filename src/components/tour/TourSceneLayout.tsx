import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cue } from '@/components/tour/choreo'

/**
 * 장면 7개가 공유하는 뼈대 — **무대 · 제목 · 설명**.
 *
 * ## 🔴 무대는 절대 자르지도 스크롤하지도 않는다 (v2 결함 수정)
 *
 * v1 은 무대에 `max-h + overflow-y-auto` 를 걸었다. 그래서 두 가지가 깨졌다:
 * ① 2장 스텝 노드 **툴팁이 잘렸다**(그 장면이 보여주려던 게 바로 그 툴팁이다)
 * ② 4장 질문 하나가 스크롤 아래에 **조용히 숨었다**(모바일엔 스크롤바도 없다).
 *
 * v2 규칙: `overflow` 를 건드리지 않고, 실제 높이를 재서 안 들어가면 `scale` 로 **줄인다**.
 * transform 은 레이아웃 상자를 바꾸지 않으므로 바깥 상자 높이를 `needed × scale` 로 직접
 * 잡아준다. 툴팁·팝오버는 상자 밖으로 나가도 그려진다(자를 상자가 없다).
 *
 * 🔴 `items-start` 가 **필수**다. flex 기본값 `stretch` 면 안쪽 div 가 바깥 상자 높이로
 * 늘어나 `offsetHeight` 가 「필요 높이」가 아니라 「현재 상자 높이」를 돌려준다 — 측정이
 * 자기 결과를 다시 읽는 셈이라 처음 잡힌 숫자에 얼어붙는다 (실기: 상자 239 / 내용 277).
 *
 * ## 데스크탑은 2열 (v3)
 *
 * 세로로 쌓으면 1280×900 에서 위아래가 크게 비었다. `lg:` 부터 **왼쪽 무대 · 오른쪽 글**로
 * 나눠 가로를 쓴다 (CEO 「웹·모바일 달라도 된다」). 모바일은 그대로 세로다.
 */
interface Props {
  /** 몇 장인가 — 제목·설명 등장 시각을 `choreo.ts` 표에서 가져온다 */
  scene: number
  /** 무대 — 카드·스텝바·재생 화면 */
  stage: ReactNode
  title: string
  /** 2줄 이내. 문장이지 문단이 아니다 */
  description: ReactNode
  /** 데스크탑 오른쪽 열 맨 아래 진행 안내 (모바일은 하단 바가 맡는다) */
  hint?: ReactNode
  /**
   * **무대의 주인공이 카드인 장면**(1·2·3·7) — 데스크탑 세로 몫을 주고 **확대를 끈다.**
   *
   * 🔴 카드는 **키우면 안 된다.** 실제 `CompanyCard`(①②⑦)는 확대분만큼 흐려지고,
   * 카드 모양 판(③)은 혼자 1.29배가 되어 같은 카드가 장면마다 다른 크기로 보인다 —
   * 그게 CEO 가 말한 「커졌다 작아졌다」의 나머지 절반이다 (8/29).
   *
   * 폭은 이 플래그가 정하지 않는다: 전 장면이 `TOUR_CARD_W_CLASS` 하나를 본다.
   */
  cards?: boolean
  /**
   * 문서형 장면(6장 노트) — **모바일 무대 몫을 넓힌다**.
   *
   * 🔴 기본 50vh 로는 정리 글 + 체크리스트 + 사진이 안 들어가 축소가 걸리고, 그러면 본문
   * 12px 이 9px 대로 떨어져 「공부한 글」이 읽히지 않는다. 세로를 더 주는 쪽이 맞다 —
   * 이 장면은 제목·설명이 짧아 아래 몫을 덜 쓴다 (폴드 assert 로 잠근다).
   */
  tall?: boolean
}

/**
 * 데스크탑 무대 **안쪽 폭** — 전 장면이 같은 값이다.
 *
 * 🔴 예전엔 카드 장면(①②⑦)만 660, 나머지는 560 이었다. 그래서 장면이 넘어갈 때 같은
 * `CompanyCard` 가 **커졌다 작아졌다** 했고, 바깥 상자 폭까지 달라(700 vs 720) 카드의
 * 왼쪽 끝이 좌우로 흔들렸다 (CEO 실기 8/29). 폭이 장면마다 다를 이유가 없다 —
 * 「한 카드를 일곱 장에 걸쳐 따라간다」는 이야기라면 그 카드는 내내 같은 크기여야 한다.
 *
 * ⚠️ Tailwind 는 **소스의 문자열 리터럴**을 훑어 클래스를 만든다. 숫자를 템플릿으로 조립하면
 * 클래스 자체가 생성되지 않으므로, 값이 아니라 **클래스 문자열**을 단일 소스로 둔다
 * (숫자 쪽은 테스트·문서용이고, 둘이 어긋나지 않는지는 spec 이 잠근다).
 */
export const TOUR_CARD_MAX_W = 560
export const TOUR_CARD_W_CLASS = 'lg:w-[560px]'

/** 무대 바깥 상자 — 안쪽보다 넓게 잡아 두면 그 비율이 확대 상한이 된다 */
const STAGE_BOX_W_CLASS = 'lg:w-[720px]'

/** 무대가 쓸 수 있는 세로 비율 — 나머지는 제목·설명·버튼 몫이다 */
const STAGE_VH_MOBILE = 0.5
/**
 * 글이 긴 장면(5장 답변 4문장 · 6장 노트)의 몫.
 *
 * 🔴 기본값(모바일 0.50 · 데스크탑 0.56)으로는 **축소가 걸려 글자가 규격 밑으로 떨어진다** —
 * 실측에서 6장 데스크탑이 `scale 0.71` → 본문 12px 이 **8.5px**, 5장 모바일이 `0.86` →
 * 말풍선 13px 이 11.1px 이었다. 축소는 「안 잘리게」 하는 안전장치지 **읽기 규격을 깎는
 * 수단이 아니다.** 자리를 더 주는 쪽이 맞다 — 이 장면들은 제목·설명이 짧아 아래 몫을 덜 쓴다
 * (폴드 assert 로 잠근다).
 */
const STAGE_VH_MOBILE_TALL = 0.66
const STAGE_VH_DESKTOP_TALL = 0.8
const STAGE_VH_DESKTOP = 0.56
/** 카드 장면은 높이 여유를 더 준다 — 축소가 걸리면 카드가 실화면보다 작아진다 */
const STAGE_VH_DESKTOP_CARDS = 0.64
/** 데스크탑 분기 — 사이드바가 나타나는 지점과 같다 (`lg`) */
const LG_PX = 1024
/**
 * 🔴 **무대는 키우기도 한다** (v3).
 *
 * 줄이기만 하면 1280×900 에서 내용이 300px 짜리 섬처럼 떠 있고 **화면의 70%가 빈다**
 * (실기 실측). 무대는 「화면 안의 화면」이라, 자리가 남으면 그 자리를 채우는 게 맞다.
 * 상한을 두는 이유는 작은 카드가 만화처럼 부풀면 오히려 가짜로 보이기 때문이다.
 *
 * 확대는 **가로 여유 안에서만** 한다 — 안쪽(`lg:w-[560px]`)보다 바깥 상자(`lg:w-[720px]`)를
 * 넓게 잡아 두었고, 그 비율(1.28)이 자연 상한이 된다. 모바일은 둘이 같은 폭이라 비율이 1 →
 * **확대가 원리적으로 일어나지 않는다**(가로가 넘칠 여지가 없다).
 */
const MAX_SCALE_UP = 1.3

export function TourSceneLayout({
  scene,
  stage,
  title,
  description,
  hint,
  cards = false,
  tall = false,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [boxHeight, setBoxHeight] = useState<number | null>(null)

  const measure = useCallback(() => {
    const el = innerRef.current
    const box = el?.parentElement
    if (!el || !box) return
    /* offsetHeight 는 transform 의 영향을 받지 않는다 — 축소한 뒤에도 「원래 필요한 높이」를
       그대로 돌려주므로 되돌아가는 진동(축소 → 작아짐 → 확대 → …)이 생기지 않는다. */
    const needed = el.offsetHeight
    const neededW = el.offsetWidth
    if (needed <= 0 || neededW <= 0) return
    const isDesktop = window.innerWidth >= LG_PX
    const vh = isDesktop
      ? cards
        ? STAGE_VH_DESKTOP_CARDS
        : tall
          ? STAGE_VH_DESKTOP_TALL
          : STAGE_VH_DESKTOP
      : tall
        ? STAGE_VH_MOBILE_TALL
        : STAGE_VH_MOBILE
    const avail = window.innerHeight * vh
    /* 가로 여유 — 모바일은 안쪽·바깥이 같은 폭이라 1 이 되어 확대가 막힌다.
       🔴 폭을 못 재는 환경(레이아웃 계산이 없는 jsdom, 아직 배치 전)에서는 **1 로 본다** —
       0 으로 두면 `scale(0)` 이 되어 무대가 통째로 사라진다. 축소 판정은 높이가 계속 맡는다. */
    const boxW = box.clientWidth
    const widthRoom = boxW > 0 ? boxW / neededW : 1
    // 카드 장면은 **확대 상한이 1** — 키우면 실화면과 달라지고 흐려진다
    const maxUp = cards ? 1 : MAX_SCALE_UP
    const next = Math.min(avail / needed, widthRoom, maxUp)
    setScale(next)
    setBoxHeight(needed * next)
  }, [cards, tall])

  // 첫 페인트 전에 재서 「컸다가 줄어드는」 깜빡임을 없앤다
  useLayoutEffect(measure)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    window.addEventListener('resize', measure)
    /* 연출 중에 무대가 자란다(문항이 열리고 카드가 붙는다) — 그때마다 다시 잰다.
       jsdom 등 관찰자가 없는 환경에서는 위 layout effect 의 측정으로 끝난다. */
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null
    ro?.observe(el)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [measure])

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 lg:flex-row lg:items-center lg:gap-12">
      {/* 🔴 overflow 를 걸지 않는다 — 툴팁이 위로 나가도 그려져야 한다 */}
      <div
        data-tour-stage
        style={boxHeight === null ? undefined : { height: boxHeight }}
        className={`w-full lg:shrink-0 flex justify-center items-start ${STAGE_BOX_W_CLASS}`}
      >
        <div
          ref={innerRef}
          style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
          className={`w-full origin-top ${TOUR_CARD_W_CLASS}`}
        >
          {stage}
        </div>
      </div>

      {/* `data-tour-copy` — 재생 엔진이 **제목 + 설명 글자수**를 여기서 잰다 (읽는 시간 계산).
          무대 글자수는 장면이 상수로 선언한다 (`SCENE_STAGE_TEXT_LEN`) — 연출로 나중에
          나타나는 요소는 진입 시점의 DOM 에 없어서 셀 수가 없다. */}
      <div
        data-tour-copy
        className="w-full max-w-[520px] lg:max-w-[380px] text-center lg:text-left"
      >
        {/* break-keep — 320px 에서 단어 중간이 잘리는 걸 막는다 (SignupQuestion 과 같은 이유) */}
        {/* 규칙 C — 제목 → 0.15s 뒤 설명. 읽는 시간은 이 뒤부터 흐른다 */}
        <h1
          {...cue(scene, 'title', 'rise')}
          className="text-[22px] lg:text-[30px] font-bold text-text-primary font-display tracking-tight break-keep"
        >
          {title}
        </h1>
        <p
          {...cue(scene, 'desc', 'rise')}
          className="mt-2 lg:mt-3 text-sm lg:text-[15px] text-text-secondary leading-relaxed break-keep"
        >
          {description}
        </p>
        {hint && <div className="hidden lg:block mt-6">{hint}</div>}
      </div>
    </div>
  )
}
