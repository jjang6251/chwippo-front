import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InterviewNudgeModal } from './InterviewNudgeModal'
import { todayLocal } from '@/utils/datetime'

/**
 * 면접 유도 모달 — **체크박스가 「닫기의 종류」를 정한다.**
 *
 * 🔴 닫는 방법이 넷이다 (X · 오버레이 탭 · ESC · CTA). **한 경로만 테스트하면 나머지 셋에서
 * 체크가 무시되는 버그가 조용히 남는다** — 그래서 4경로를 각각 본다.
 */
describe('InterviewNudgeModal', () => {
  const onClose = vi.fn()
  const onGo = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  function draw(
    variant: 'first' | 'again' | 'noCoverletter' = 'first',
    scheduledDate: string | null = null,
  ) {
    return render(
      <InterviewNudgeModal
        open
        variant={variant}
        stepName="2차 면접"
        companyName="카카오"
        scheduledDate={scheduledDate}
        onClose={onClose}
        onGo={onGo}
      />,
    )
  }

  const check = () =>
    fireEvent.click(screen.getByRole('checkbox', { name: /다시 보지 않기/ }))
  const xBtn = () => screen.getByRole('button', { name: '닫기' })
  const cta = () =>
    screen.getByRole('button', { name: '무료로 면접 준비하기' })

  describe('🔴 H-1 체크 없이 닫으면 — 그 스텝만 소진', () => {
    it('X 버튼 → onClose(false)', () => {
      draw('first')
      fireEvent.click(xBtn())
      expect(onClose).toHaveBeenCalledWith(false)
    })

    it('ESC → onClose(false)', () => {
      draw('first')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledWith(false)
    })

    it('CTA → onGo(false)', () => {
      draw('first')
      fireEvent.click(cta())
      expect(onGo).toHaveBeenCalledWith(false)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('🔴 H-2 체크하고 닫으면 — 4경로 전부 영구 차단이 실려야 한다', () => {
    it('☑ + X → onClose(true)', () => {
      draw('first')
      check()
      fireEvent.click(xBtn())
      expect(onClose).toHaveBeenCalledWith(true)
    })

    it('☑ + ESC → onClose(true)', () => {
      draw('first')
      check()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledWith(true)
    })

    it('🔴 ☑ + CTA → onGo(true) — 이동하면서 영구 차단도 같이 간다', () => {
      draw('first')
      check()
      fireEvent.click(cta())
      expect(onGo).toHaveBeenCalledWith(true)
    })
  })

  it('H-3 체크만 하고 아무것도 안 누르면 콜백이 안 불린다', () => {
    draw('first')
    check()
    expect(onClose).not.toHaveBeenCalled()
    expect(onGo).not.toHaveBeenCalled()
  })

  describe('문구 3벌', () => {
    /**
     * 🔴 「무료」를 앞세우되 **차별점(자소서 기반)이 둘째 줄에 남아야 한다.**
     * 그게 빠지면 「왜 하필 여기서?」에 답이 사라진다 — 무료는 GPT 도 무료라 차별점이 아니다.
     */
    it('🔴 first — 「무료」 배지 + 자소서 차별점 + 연습 루프 3가지가 다 있다', () => {
      draw('first')
      expect(screen.getByText('무료')).toBeInTheDocument()
      expect(screen.getByText(/AI가 내 자소서를 읽고 예상 질문 20개/)).toBeInTheDocument()
      // 🔴 연습 루프 — 이게 빠지면 「질문 생성기」로만 읽혀 GPT 와 구분이 안 된다
      // 🔴 직접 모은 기출 + 연습 루프 — 「GPT 로도 되는데 굳이?」에 대한 진짜 답
      // 🔴 first 는 처음 온 사람 — 「모은 기출」이 있다고 전제하면 안 된다
      expect(screen.getByText(/기출을 직접 더하고/)).toBeInTheDocument()
      expect(screen.queryByText(/직접 모은 기출/)).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '무료로 면접 준비하기' }),
      ).toBeInTheDocument()
    })

    /**
     * 🔴 제목은 **아이콘 옆 본문**에 그린다 (헤더는 sr-only). 회사명 개인화는 조사에서
     * 전환 기여가 가장 큰 축 하나였다 (개인화 CTA +202%).
     */
    it('🔴 아이콘 옆에 회사명 + 단계가 보인다', () => {
      draw('first')
      // 헤더(sr-only)와 본문 라벨 둘 다 같은 문자열 → 2건
      expect(screen.getAllByText('카카오 2차 면접').length).toBeGreaterThanOrEqual(1)
    })

    /**
     * 🔴 회사명·단계 둘 다 사용자가 직접 짓는 값이라 길 수 있다.
     * `truncate` 는 조상에 `min-w-0` 이 없으면 flex 안에서 **조용히 죽는다** — 체인을 같이 본다.
     */
    /**
     * 🔴 X 가 `absolute` 로 떠 있어 우측 12~44px 을 점유한다. 본문 패딩(20px)만으로는
     * **긴 회사명이 X 밑으로 파고든다** — 첫 줄에 `pr-8` 로 컨테이너를 좁혀야 한다.
     * `truncate` 는 컨테이너 끝에서 자를 뿐이라 이걸 못 막는다.
     */
    it('🔴 첫 줄에 닫기 버튼 회피 여백(pr-8)이 있다', () => {
      draw('first')
      const row = screen
        .getAllByText('카카오 2차 면접')
        .find((el) => el.className.includes('truncate'))
        ?.closest('div')?.parentElement
      expect(row?.className).toContain('pr-8')
    })

    it('긴 이름은 truncate + min-w-0 체인이 걸려 있다', () => {
      draw('first')
      const label = screen
        .getAllByText('카카오 2차 면접')
        .find((el) => el.className.includes('truncate'))
      expect(label).toBeTruthy()
      expect(label?.parentElement?.className).toContain('min-w-0')
    })

    /**
     * 🔴 이미 써본 사람에게 「체험」을 권하면 말이 안 맞는다.
     * 제목도 스텝 이름을 받아 「2차 면접 단계네요」가 된다.
     */
    it('again — 「체험」은 안 쓴다 (이미 써본 사람) · 연습 루프는 유지', () => {
      draw('again')
      expect(screen.getByText(/AI가 이번 단계에 맞는 질문을 새로/)).toBeInTheDocument()
      // 🔴 숫자를 쓰면 거짓이 된다 — 이미 질문이 있는 세션은 기본값이 10 이다
      expect(screen.queryByText(/20개/)).not.toBeInTheDocument()
      // 🔴 「1차 때」는 거짓일 수 있다 (2차→3차 · 1차 없는 전형)
      expect(screen.getByText(/앞 단계와 다른 질문에 기출까지/)).toBeInTheDocument()
      expect(screen.queryByText(/1차 때/)).not.toBeInTheDocument()
      expect(screen.queryByText(/체험/)).not.toBeInTheDocument()
    })

    /**
     * 🔴 자소서가 0건이면 AI 질문 생성이 서버 게이트(NEED_COVERLETTER)에 막힌다.
     * **체험할 수 없는 걸 체험하라고 하면 그 자체가 거짓**이라 「무료·체험」을 빼고
     * 자소서 훅만 심는다.
     */
    /**
     * 🔴 여기서 「무료」는 **가장 확실하게 참**이다 — 세션 생성·직접 질문 모으기는 코인 0 이고,
     * 막히는 건 AI 뿐인데 문구가 「모아 연습」까지만 약속한다.
     */
    it('noCoverletter — 「체험」 없이 자소서 훅만 · 연습은 진짜 무료다', () => {
      draw('noCoverletter')
      expect(screen.queryByText(/체험/)).not.toBeInTheDocument()
      expect(screen.getByText(/기출·예상 질문을 직접 모아/)).toBeInTheDocument()
      expect(screen.getByText(/자소서를 등록하면 AI가 그 내용에서/)).toBeInTheDocument()
    })
  })

  describe('🔴 D-day — 취준생을 움직이는 건 「잡혔다」가 아니라 「남았다」', () => {
    it('예정일이 있으면 D-n 이 붙는다', () => {
      const inThreeDays = new Date(Date.now() + 3 * 86400_000).toISOString()
      draw('first', inThreeDays)
      expect(screen.getByText(/^D-[23]$/)).toBeInTheDocument()
    })

    it('예정일이 없으면 안 붙는다 (날짜 없는 스텝이 많다)', () => {
      draw('first', null)
      expect(screen.queryByText(/^D-/)).not.toBeInTheDocument()
    })

    /** 🔴 이미 지난 면접에 「준비하세요」는 말이 안 된다 */
    it('지난 날짜면 안 붙는다', () => {
      const yesterday = new Date(Date.now() - 2 * 86400_000).toISOString()
      draw('first', yesterday)
      expect(screen.queryByText(/^D-/)).not.toBeInTheDocument()
    })

    /**
     * 🔴 **라벨·색을 손으로 만들면 앱과 갈린다** (2026-08-17 `/uiux` 에서 실제로 걸렸다).
     * 한때 `'D-DAY'` 를 직접 찍고 색을 `text-warning` 으로 박아, **내일 면접이 한 달 뒤
     * 면접과 같은 색**이었다. 이 세 케이스가 그 회귀를 막는다.
     */
    it('🔴 임박(D-2 이하)은 danger 색 — 손으로 warning 을 박으면 실패한다', () => {
      const tomorrow = new Date(Date.now() + 86400_000).toISOString()
      draw('first', tomorrow)
      const el = screen.getByText(/^D-\d/)
      expect(el.className).toContain('text-danger')
      expect(el.className).not.toContain('text-warning')
    })

    it('🔴 여유(D-8 이상)는 brand 색 — 전부 같은 색이면 급박함이 사라진다', () => {
      const inThreeWeeks = new Date(Date.now() + 21 * 86400_000).toISOString()
      draw('first', inThreeWeeks)
      expect(screen.getByText(/^D-\d/).className).toContain('text-brand')
    })

    /**
     * 🔴 **픽스처와 코드가 같은 시계를 봐야 한다** (ADR-066 재발 — 2026-08-17 CI 실패).
     *
     * 처음엔 `new Date()` + `setHours(12)` 로 만들었다. 로컬(KST)에선 통과하는데
     * **CI(UTC)에서 죽는다** — CI 가 22:10 UTC 에 돌면 KST 로는 이미 다음 날이라,
     * UTC 기준 「오늘 정오」가 KST 로는 **어제**가 되어 D-day 가 아니라 「지남」이 된다.
     * KST/UTC 날짜가 갈리는 구간이 **하루 9시간**뿐이라 로컬에선 좀처럼 안 걸린다.
     *
     * `calcDday` 는 KST 로 판정하므로 픽스처도 KST 날짜에서 만든다.
     * `T03:00:00Z` = 그날 **정오 KST** — 어느 TZ 에서 돌려도 같은 KST 날짜를 가리킨다.
     */
    it('🔴 당일 표기는 앱 전역과 같은 `D-day` — `D-DAY` 가 아니다', () => {
      draw('first', `${todayLocal()}T03:00:00Z`)
      expect(screen.getByText('D-day')).toBeInTheDocument()
      expect(screen.queryByText('D-DAY')).not.toBeInTheDocument()
    })
  })

  it('🔴 질문 개수를 숫자로 말한다 (「뽑아드려요」는 양이 불명확하다)', () => {
    draw('first')
    expect(screen.getByText(/예상 질문 20개/)).toBeInTheDocument()
  })

  /**
   * 🔴 랜딩 칩(「AI 면접 준비」) → 이 모달 → 착지점(「AI 질문 생성」) 이 한 흐름이다.
   * 가운데만 AI 를 안 말하면 사용자가 **같은 기능인지 못 알아본다.**
   */
  it.each(['first', 'again', 'noCoverletter'] as const)(
    '🔴 %s — 「AI」를 말한다 (제품 전반의 공식 어휘)',
    (variant) => {
      draw(variant)
      expect(screen.getByText(/AI가/)).toBeInTheDocument()
    },
  )

  it('접근성 — dialog · 체크박스 44px 터치 타겟', () => {
    draw('first')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const label = screen.getByRole('checkbox', { name: /다시 보지 않기/ }).closest('label')
    expect(label?.className).toContain('min-h-[44px]')
  })
})
