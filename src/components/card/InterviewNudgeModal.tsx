import { useState } from 'react'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { calcDday, getDdayLabel, getDdayVariant, type DdayVariant } from '@/utils/dday'
import { Modal } from '@/components/common/Modal'
import { StepDateField } from '@/components/board/StepDateField'
import type { InterviewNudge } from '@/types/application'

/**
 * 면접 유도 모달 — 보드에서 **면접 단계로 이동하는 순간** 뜨는 안내.
 *
 * ## 이 모달이 여는 문
 *
 * 면접 스텝 상세에는 이미 「이 내용으로 면접 질문 만들기」 버튼이 있는데 **두 겹으로 닫혀 있었다** —
 * 준비 노트가 비면 `disabled` 라 처음 온 사람은 누를 수 없고, 「준비 노트」 섹션 안이라 눈에도 안 띈다.
 * 그래서 이 기능의 일은 「없는 기능 추가」가 아니라 **있는 문을 여는 것**이다.
 *
 * ## 🔴 문구는 「왜 하필 여기서?」 하나에만 답한다
 *
 * 초안은 기능 3개를 나열했었다 (만들어 준다 · 적어둔다 · 연습한다). 그건 **동작이지 결과가 아니고**,
 * 실사용자가 이미 던진 질문 —「GPT 로도 되는데 굳이?」— 에 답하지 못한다.
 * 치뽀만 할 수 있는 건 하나다: **네가 쓴 자소서에서 질문이 나온다.** 거기에만 건다.
 *
 * 근거 (2026-08-16 조사): 모달 본문 상한 **25~30 단어** · 기능 나열보다 결과 · 명확한 메시지 **+23%** ·
 * CTA 2인칭→1인칭 **+90%** · 개인화 CTA **+202%**.
 *
 * ⚠️ **「무료」를 앞세운 건 CEO 판단이다** (2026-08-16). 무료는 차별점이 아니지만
 * (GPT 도 무료다) 취준생에겐 **비용 장벽 제거**가 실질적 메시지다. 대신 차별점(자소서 기반)을
 * **둘째 줄에 반드시 남긴다** — 그게 빠지면 「왜 하필 여기서?」에 답이 사라진다.
 * 한때 본인 자소서 문항을 인용 박스로 보여줬으나(실물 미리보기 +32~47%) 이 판단으로 뺐다.
 *
 * ## 🔴 강조는 한 곳만 · 색은 쓰지 않는다
 *
 * CTA 가 바로 아래 `bg-brand` 다. 본문에도 `text-brand` 를 쓰면 ① 초록 글자를 누를 수 있는 줄 알고
 * (거짓 어포던스) ② 같은 색이 둘이라 CTA 가 유일한 목적지라는 신호가 흐려진다.
 * 그래서 **명도(secondary→primary) + 굵기**로만 강조하고, 색은 CTA 에 남긴다.
 * 강조는 `lead` **한 곳만** — 다 강조하면 아무것도 강조가 아니다.
 *
 * ## 동작
 *
 * 닫는 방법 넷(X · 오버레이 탭 · ESC · CTA)은 **전부 동등**하다. 체크 여부만 결과를 가른다.
 */
export function InterviewNudgeModal({
  open,
  variant,
  appId,
  stepId,
  stepName,
  companyName,
  domain,
  scheduledDate,
  onClose,
  onGo,
}: {
  open: boolean
  variant: InterviewNudge['variant']
  /** 날짜를 그 자리에서 저장하기 위한 대상 (`useStepScheduleSave`) */
  appId: string
  stepId: string
  /** 제목에 들어간다. 사용자가 직접 지은 이름이라 길 수 있어 truncate 필요 */
  stepName: string
  /** 제목 개인화 — 「현대오토에버 2차 면접」 */
  companyName: string
  /** 회사 로고(favicon). 없으면 `CompanyAvatar` 가 이니셜로 떨어진다 */
  domain?: string
  /** 면접 예정일. 🔴 **취준생을 움직이는 건 「면접이 잡혔다」가 아니라 「3일 남았다」** 다 */
  scheduledDate: string | null
  /** 닫힘 — `dismissForever` 는 체크박스 상태. X · 오버레이 · ESC 가 전부 이걸 부른다 */
  onClose: (dismissForever: boolean) => void
  /** CTA — 세션 생성 흐름으로 */
  onGo: (dismissForever: boolean) => void
}) {
  const [dismissForever, setDismissForever] = useState(false)
  /**
   * 🔴 **열릴 때 날짜가 없었으면, 넣은 뒤에도 칸으로 남는다.**
   *
   * 안 그러면 저장되는 순간 `scheduledDate` 가 채워져 D-day 분기로 넘어가고 **입력 칸이
   * 사라진다** — 잘못 고른 사람이 이 모달 안에서 고칠 방법이 없어진다 (CEO 2026-08-25).
   * 날짜 피커는 한 번에 맞게 고르기 어려운 컨트롤이라 되돌릴 자리가 반드시 있어야 한다.
   *
   * ⚠️ **호출처가 `key` 로 remount 시켜야 이 초기값이 매번 새로 잡힌다** — 이 컴포넌트는
   * `open` 이 false 여도 마운트된 채라, `useState` 초기화만으로는 첫 렌더 값에 굳는다.
   */
  const [askDate] = useState(() => !scheduledDate)
  const copy = COPY[variant]

  /**
   * 🔴 D-day — **날짜가 없는 스텝이 많아 있을 때만** 붙인다.
   * `calcDday` 는 값이 날짜가 아니면 던지지 않고 `NaN` 을 준다 (렌더 중 호출이라 던지면 페이지가 죽는다).
   * 지난 날짜(D+n)는 안 붙인다 — 이미 본 면접에 「준비하세요」는 말이 안 된다.
   *
   * 🔴 **라벨도 색도 직접 만들지 않는다** (2026-08-17 `/uiux` 지적). 손으로 쓰면
   * ① 표기가 갈리고(앱 전역은 `D-day`, 여기만 `D-DAY`)
   * ② **급박함이 사라진다** — 프로젝트는 D-2 이하를 `danger` 로 칠하는데
   *    `text-warning` 을 박아두면 **내일 면접이 한 달 뒤 면접과 같은 색**이 된다.
   */
  const dday = scheduledDate ? calcDday(scheduledDate) : NaN
  const showDday = Number.isFinite(dday) && dday >= 0

  return (
    <Modal
      open={open}
      title={`${companyName} ${stepName}`}
      /* 제목은 아이콘 옆에 직접 그린다 — 헤더엔 닫기 버튼만 남긴다 (a11y 는 sr-only 로 유지) */
      titleHidden
      onClose={() => onClose(dismissForever)}
      /* 320px 에선 w-full 하단 시트라 이 값이 안 걸린다 — 데스크탑 폭만 정한다 */
      width="max-w-[420px]"
    >
      {/*
        🔴 **회사 로고 배지다 — 면접 아이콘이 아니다.**
        처음엔 `Mic`(면접) 아이콘을 썼는데, 바로 옆에 「2차 면접」이라고 이미 써 있어
        **같은 말을 두 번** 하는 셈이었다. 정보를 안 더하는 시각 요소는 장식이다.
        `CompanyAvatar`(보드에서 쓰는 그 배지)로 바꾸면 **「내 카드」라는 연결이 즉시** 생기고,
        개인화가 문구가 아니라 시각으로 전달된다.

        🔴 회사·단계는 **사용자가 직접 짓는 이름**이라 길 수 있다 → `min-w-0` + `truncate` 체인 필수.
      */}
      {/*
        🔴 `pr-8` 은 **닫기 버튼을 피하는 여백**이다 (장식이 아니다).
        `titleHidden` 이면 X 가 `absolute top-3 right-3` 로 떠 있어 우측 12~44px 을 점유하는데,
        본문 패딩은 20px 라 **긴 회사명이 X 밑으로 파고든다.** `truncate` 는 컨테이너 끝에서
        자를 뿐이라 못 막는다 — 컨테이너 자체를 좁혀야 한다.
      */}
      <div className="flex items-center gap-2.5 pr-8">
        <CompanyAvatar name={companyName} domain={domain} size="md" />
        <div className="min-w-0">
          <p className="truncate text-text-primary text-sm font-semibold">
            {companyName} {stepName}
          </p>
          {/*
            🔴 **한 자리, 두 상태.** 날짜가 있으면 D-day, 없으면 **그 자리에서 넣는 칸**이다.

            날짜를 아는 순간은 거의 언제나 「합격 통보를 받았다」이고, 이 모달은 정확히
            그때 뜬다 — 단계를 면접으로 옮기는 순간. 그런데 예전엔 날짜가 없으면 이 줄이
            **통째로 비어 있었다**: 물어볼 최적의 자리에서 아무것도 안 물었다.
            (같은 패턴 — HubSpot 은 딜을 단계로 옮길 때 그 단계가 요구하는 값을 묻는다.)

            🔴 **열릴 때 이미 날짜가 있었으면 입력 칸으로 바꾸지 않는다.** D-day 는
            `D-2 이하 danger` 로 **긴박함을 색으로** 전하는데 칩으로 바꾸면 그 신호가 죽고,
            무엇보다 이미 넣은 사람은 여기서 할 일이 없다 — CTA 로 보내는 게 맞다.

            🔴 반대로 **여기서 넣은 날짜는 칸으로 남는다**(`askDate`) — 저장됐다고 D-day 로
            바뀌면 잘못 고른 사람이 되돌릴 자리가 사라진다.

            ⚠️ 본문 문구는 **늘리지 않는다.** 이 모달의 목적은 하나(면접 준비 시작)이고,
            안내를 한 줄 더 붙이면 목적이 둘이 되어 CTA 가 약해진다. 점선 칸에 적힌
            「날짜 설정하기」가 이미 자기 설명적이라 문구가 필요 없다.
          */}
          {!askDate ? (
            showDday && (
              <p
                className={`mt-0.5 text-[11px] font-semibold ${DDAY_TEXT[getDdayVariant(dday)]}`}
              >
                {getDdayLabel(dday)}
              </p>
            )
          ) : (
            <div className="mt-1">
              <StepDateField
                appId={appId}
                stepId={stepId}
                stepName={stepName}
                scheduledDate={scheduledDate}
                dense
              />
            </div>
          )}
        </div>
      </div>

      {/*
        「무료」 배지 — 🔴 CTA 와 같은 brand 지만 **채운 버튼이 아니라 알약 라벨**이라
        누를 수 있는 것으로 오해되지 않는다. 의미색 alpha 칩은 프로젝트 전반의 기존 문법이다
        (DESIGN.md — 의미 색은 alpha modifier 허용).

        🔴 **크기는 `text-xs`(12px) — 본문과 같다.** 처음 `text-[10px]`(Tiny)로 넣었는데
        DESIGN.md 는 Tiny 를 「D-day 뱃지·아이콘 레이블」용으로 규정하고, 무엇보다
        **강조 요소가 본문보다 작으면 강조가 안 된다** (색으로만 버티게 된다).
        굵기를 `font-bold` 로 올려 같은 크기에서도 눌리지 않게 했다.
      */}
      <p className="mt-4 text-text-secondary text-xs leading-relaxed">
        {/* 🔴 `/15` 다 — `/12` 는 **컴파일되지 않는 no-op** 이라 알약 배경이 아예 안 그려졌다
            (2026-08-17 `/uiux` 실측: `getComputedStyle` → `rgba(0,0,0,0)`). 색만 남고
            배지 형태가 사라져 「강조」가 절반만 전달됐다. 알파 값은 눈으로 고르지 말고
            실제로 적용되는지 확인한 값(`/10`·`/15`)에서 고른다. */}
        <span className="inline-flex items-center bg-brand/15 text-brand text-xs font-bold px-2 py-0.5 rounded-full mr-1.5 align-[1px]">
          무료
        </span>
        <strong className="text-text-primary font-semibold">{copy.line1}</strong>
        <br />
        {copy.line2}
      </p>

      {/*
        🔴 체크박스와 CTA 사이 간격(mt-3)은 **필수**다.
        붙이면 CTA 를 노리다 빗나간 탭이 체크로 이어져, 되돌릴 수 없는 선택이 사고로 걸린다.
      */}
      <label className="flex items-center gap-2 min-h-[44px] mt-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dismissForever}
          onChange={(e) => setDismissForever(e.target.checked)}
          className="w-4 h-4 rounded border-line accent-brand cursor-pointer"
        />
        <span className="text-text-quaternary text-[11px]">
          이 안내 다시 보지 않기
        </span>
      </label>

      <button
        type="button"
        onClick={() => onGo(dismissForever)}
        className="w-full min-h-[44px] mt-3 text-[13px] font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        {copy.cta}
      </button>
      {/* CTA 는 `text-[13px]` — DESIGN.md 「Small Medium 13px = 버튼 텍스트」 규격.
          형제 모달들이 `text-xs`(12px)를 쓰지만 그건 규격 미달이고, 전환의 목적지인 이 버튼만은 맞춘다. */}
    </Modal>
  )
}

/**
 * 문구 3벌 — 분기는 **서버가 정한다** (`variant`).
 *
 * **2줄 구조**: `line1` = 무엇을 뽑아주나(강조) · `line2` = **기출을 섞어 면접처럼 연습한다**.
 *
 * 🔴 line2 가 이 모달에서 가장 중요한 줄이다 — 「질문 생성기」로만 읽히면 GPT 와 구분이 안 된다.
 * 질문 은행의 출발점이 실사용자의 이 말이었다:
 * **「GPT 로도 되는데 굳이? 직접 모은 기출 넣고 시험 보듯 연습하고 싶다」**
 * GPT 는 질문을 만들어 주지만 **내 기출과 섞어 가리고 답하는 연습**은 못 한다. 그게 답이다.
 *
 * 🔴 **숫자는 `first` 에만 쓴다.** 20 은 빈 세션의 기본값이고, 이미 질문이 있으면 10 이며
 * 세션 상한(60)까지 남은 자리에 따라 더 줄어든다.
 *
 * 🔴 **「AI」를 반드시 쓴다 — 제품 전반의 공식 어휘다.** 랜딩 히어로 칩이 「AI 면접 준비」,
 * 착지점 모달 제목이 「AI 질문 생성」인데 그 사이에 낀 이 모달만 AI 를 안 말하면
 * **사용자가 같은 기능인지 못 알아본다.** 「뽑아드려요」만 쓰면 누가 뽑는지도 모호하다.
 * 표현은 랜딩과 같은 결로 — **「AI 가 내 자소서를 읽고」**(랜딩: "자소서를 읽고 면접 질문을 뽑는").
 *
 * ## 문구 점검에서 걸린 것 (2026-08-17)
 *
 * 🔴 **`first` 에 「직접 모은 기출**도**」라고 쓰면 안 된다** — `first` 는 세션 0개,
 *    즉 **처음 온 사람**이라 모은 기출이 없다. 있는 걸 쓰는 게 아니라 **할 수 있다**로 말한다.
 * 🔴 **`again` 에 「1차 때」라고 쓰면 안 된다** — `again` 은 「이 카드에 세션이 있다」는 뜻이지
 *    「1차가 있다」는 뜻이 아니다. 2차→3차일 수도, 1차 없이 임원면접부터일 수도 있다 → **「앞 단계」**.
 * 🟡 종결은 **「~할 수 있어요」로 통일** — 연습의 주체는 서비스가 아니라 사용자다.
 *    「~연습해요」라고 쓰면 서비스가 연습하는 것처럼 읽힌다.
 *
 * 🔴 **「체험」은 안 쓴다.** 이미 써본 사람(`again`)에게 체험을 권하면 말이 안 맞는다.
 *
 * 🔴 **「무료」가 거짓이 아닌 근거** — Free 플랜은 결제 없이 월 100 코인이고, 실제 지출 지점
 * (`GenerateQuestionsModal`)이 코인을 미리 고지한다. `noCoverletter` 는 더 확실하다 —
 * 세션 생성·직접 질문 모으기는 **코인 0** 이고 AI 만 게이트에 막히는데, 그 문구는
 * 「모아 연습」까지만 약속한다.
 *
 * 🔴 **CTA 는 1인칭·행동형이다** (조사: 2인칭→1인칭 최대 +90%).
 */
/**
 * D-day 색 — **뱃지 모양만 안 쓸 뿐 색 규칙은 `DdayBadge` 와 같아야 한다.**
 * (`getDdayVariant`: D-2 이하 danger · D-7 이하 warning · 그 위 info)
 *
 * `muted`(지난 날짜)는 여기선 안 그리지만, 규칙이 바뀌어 과거도 그리게 될 때
 * **조용히 `undefined` 클래스가 되지 않도록** 채워 둔다.
 */
const DDAY_TEXT: Record<DdayVariant, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-brand',
  muted: 'text-text-quaternary',
}

const COPY: Record<
  InterviewNudge['variant'],
  { line1: string; line2: string; cta: string }
> = {
  first: {
    // 🔴 「20개」는 **빈 세션의 기본값**이라 참이다 (`GENERATE_COUNT_MAX = 20`).
    line1: 'AI가 내 자소서를 읽고 예상 질문 20개를 뽑아드려요.',
    line2: '기출을 직접 더하고, 가리고 답하며 연습할 수 있어요.',
    cta: '무료로 면접 준비하기',
  },
  again: {
    // 🔴 **여기엔 숫자를 쓰지 않는다.** 이미 질문이 있는 세션은 기본값이 10 이고,
    //    세션 상한(60)까지 남은 자리에 따라 더 줄어든다 — 「20개」는 거짓이 된다.
    line1: 'AI가 이번 단계에 맞는 질문을 새로 뽑아드려요.',
    line2: '앞 단계와 다른 질문에 기출까지, 가리고 답하며 연습할 수 있어요.',
    cta: '무료로 면접 준비하기',
  },
  noCoverletter: {
    line1: '기출·예상 질문을 직접 모아, 가리고 답하며 연습할 수 있어요.',
    line2: '자소서를 등록하면 AI가 그 내용에서 나올 질문까지 뽑아드려요.',
    cta: '무료로 면접 준비하기',
  },
}
