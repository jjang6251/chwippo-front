import { useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import {
  useDemoSignupStore,
  type DemoBlockReason,
} from '@/stores/demoSignupStore'
import { useLoginModalStore } from '@/stores/loginModalStore'

/**
 * 데모에서 막힌 순간의 안내.
 *
 * 🔴 **문구는 금지가 아니라 초대여야 한다.** 예전 제목은 `"데모에서는 저장되지 않아요"` 였다.
 * 안 되는 이유만 말해서, 방금 뭔가 해보려던 사람을 막아세우는 것으로 끝났다.
 *
 * 🔴 **그리고 맥락을 받아준다.** 예전엔 `AI 도움`·`꼬리질문 추가`·`카드 만들기` 어디서 눌러도
 * 같은 문구가 떴다. **그 버튼을 누른 순간이 관심이 가장 높은 시점**인데 그걸 안 받아주면
 * 남의 얘기로 들린다. `demoAdapter` 가 이미 어떤 요청인지 알고 있으므로 그대로 넘겨받는다.
 *
 * 🔴 **"내 자소서와 지원 현황으로" 는 쓰지 않는다** — 데모를 보는 사람은 대부분 시작 전이라
 * 아직 자소서가 없다. 가진 것을 전제하는 문장은 남 얘기가 된다. 대신 **무엇을 해주는지**를 쓴다.
 */
const COPY: Record<DemoBlockReason, { title: string; body: string }> = {
  ai_answer: {
    title: '이 질문의 답변, AI가 써드릴게요',
    body: '자소서를 읽고 그 사람 경험으로 답변을 만듭니다. 지금 보시는 답변들도 그렇게 나온 거예요.',
  },
  ai_followup: {
    title: '꼬리질문까지 미리 뽑아드릴게요',
    body: '면접관이 이어서 물을 법한 걸 답변에서 찾아 만듭니다. 실제 면접은 거기서 갈립니다.',
  },
  ai_generate: {
    title: '내 자소서로 예상 질문을 뽑아드릴게요',
    body: '회사·직무·자소서를 읽고 20문항을 만듭니다. 지금 보시는 질문들도 그렇게 나온 거예요.',
  },
  ai_coverletter: {
    title: '자소서 쓰는 것도 도와드릴게요',
    body: '쌓아둔 경험을 근거로 초안을 만들고, 쓴 답변의 개선 포인트를 짚어드립니다.',
  },
  coverletter_item: {
    title: '문항을 더 추가할 수 있어요',
    body: '회사마다 묻는 게 다릅니다. 문항을 추가해 답변을 써두면 비슷한 문항이 나왔을 때 다시 꺼내 쓸 수 있어요.',
  },
  create: {
    title: '내 지원 현황으로 시작해볼까요',
    body: '지원한 회사를 추가하면 마감 D-day와 전형 단계를 한 곳에서 볼 수 있어요.',
  },
  default: {
    title: '여기서부터는 직접 해볼 수 있어요',
    body: '지금 보시는 건 미리 만들어둔 샘플이에요. 로그인하면 내 것으로 바로 써볼 수 있습니다.',
  },
}

export function DemoSignupModal() {
  const open = useDemoSignupStore((s) => s.open)
  const reason = useDemoSignupStore((s) => s.reason)
  const hide = useDemoSignupStore((s) => s.hide)
  const showLogin = useLoginModalStore((s) => s.show)

  const goLogin = () => {
    hide()
    showLogin()
  }

  /**
   * 🔴 **언마운트되면 반드시 닫는다** (2026-08-08 QA 발견).
   *
   * 이 모달은 `DemoShell` 안에만 있는데, `toast.error` 는 **전역 스토어의 `open` 을 보고**
   * 에러 토스트를 억제한다. 모달이 열린 채 데모를 벗어나면(뒤로가기 등) 모달은 사라지지만
   * `open` 은 `true` 로 남아 — **앱 전체에서 에러 토스트가 영구히 죽는다.**
   * 로그인한 뒤 저장에 실패해도 아무 말이 없게 된다.
   *
   * "화면에 없으면 열린 게 아니다" 라는 불변식을 여기서 지킨다.
   */
  useEffect(() => () => hide(), [hide])

  const { title, body } = COPY[reason] ?? COPY.default

  return (
    <Modal open={open} onClose={hide} title={title}>
      <p className="text-text-secondary text-sm leading-relaxed mb-4">{body}</p>

      {/*
        🔴 **비용이 작다는 걸 먼저 보여준다.** 취준생에게 로그인은 비용이다 —
        또 계정 만들고 마케팅 문자 오는 일. 실제로는 소셜 로그인이라 3초면 끝나는데
        그걸 모르면 요구만 크게 느껴진다.
      */}
      <div className="flex items-start gap-2 text-[11px] text-text-tertiary bg-surface-2 border border-line rounded-lg px-3 py-2.5 mb-5">
        <span className="shrink-0 leading-relaxed" aria-hidden>🕒</span>
        <span>
          카카오·애플 계정으로{' '}
          <span className="text-text-secondary font-medium">3초</span>면 시작해요
          · 무료 · 보던 화면 그대로
        </span>
      </div>

      {/*
        🔴 **주 CTA 를 키우고 부 액션은 링크로 내린다.** 예전엔 둘 다 같은 크기·같은 모양의
        전체 폭 버튼이라 「더 둘러보기」가 대등하게 보여 눈이 아래로 흘렀다.
        🔴 `text-bg` — DESIGN.md 규칙 5(브랜드 CTA 텍스트 색 단일화). `text-text-primary` 는
        테마에 따라 뒤집혀 다크에서 **2.59:1** 이 되고, `text-white` 도 다크 **3.14:1** 에 그친다.
        `text-bg` 는 다크 **5.64:1**. (라이트는 3.37 로 낮은데 이건 brand 토큰 자체의 문제라
        기존 CTA 13곳이 전부 같다 — 토큰 차원에서 따로 다뤄야 한다)
        🔴 `hover:bg-brand-hover` — 예전 `hover:bg-accent` 는 sage→coral 로 튀었다.
        accent 는 합격·pinned 전용이라 토큰 의미 위반이다 (위생 백로그 ㉒).

        🔴 **라벨에 provider 를 단정하지 않는다** — 이 버튼은 카카오로 바로 가지 않고
        **로그인 모달**을 연다(거기서 카카오·애플을 고른다). `카카오로 시작하기` 는
        하지 않는 일을 약속하는 **거짓 어포던스**이고, 애플로 하려는 사람에겐 틀린 말이다.
      */}
      <button
        onClick={goLogin}
        className="block w-full text-center py-3.5 text-sm font-semibold text-bg bg-brand hover:bg-brand-hover active:bg-brand-hover rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        로그인하고 시작하기
      </button>
      <button
        onClick={hide}
        className="block w-full text-center mt-1 py-3 min-h-[44px] text-xs text-text-tertiary hover:text-text-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        조금 더 둘러볼게요
      </button>
    </Modal>
  )
}
