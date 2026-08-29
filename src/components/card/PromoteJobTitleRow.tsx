import { useState } from 'react'
import { useUpdateJobProfile } from '@/hooks/useJobProfile'
import { classifyJob } from '@/utils/jobRole'

/**
 * 「으로 / 로」 — 받침으로 갈린다. 값이 사용자 입력이라 문구에 하나로 박을 수 없다
 * (「간호사으로」·「지상직로」 둘 중 하나는 반드시 틀린다).
 * 한글이 아니면(「PM」) 안전형 「(으)로」.
 */
function roSuffix(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '(으)로'
  const jongseong = (code - 0xac00) % 28
  // 받침 없음(0) · ㄹ(8) → 「로」
  return jongseong === 0 || jongseong === 8 ? '로' : '으로'
}

/**
 * 「을 / 를」 — `roSuffix` 와 달리 **ㄹ 예외가 없다** (「서울을」). 받침 유무만 본다.
 */
function eulSuffix(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '(을)를'
  return (code - 0xac00) % 28 === 0 ? '를' : '을'
}

/** 한 줄로 두기엔 긴 문장은 글자를 키워 읽히게 한다 (내 정보 캡션과 같은 기준) */
const LONG_TEXT_THRESHOLD = 40

interface PromoteJobTitleRowProps {
  /**
   * **내 희망 직무** (`user.signupJobTitle`). 비어 있으면(계열만 고른 사용자·건너뛴 사용자)
   * 문구가 「바꾸기」가 아니라 「등록하기」가 된다.
   */
  profileTitle: string | null
  /** 이 화면의 직무 칸 현재 값 (raw — trim 은 여기서 한다) */
  jobTitle: string
  /** 이 화면에서 확정된 계열 id — 사전 판정이 실패했을 때의 폴백 */
  seriesId: string | null
}

/**
 * 「내 희망 직무도 바꾸기」 — **직무를 적는 모든 자리**에 붙는 한 줄
 * (`plans/job-role-first.md` 묶음 3 ①).
 *
 * ## 규칙은 하나 — **카드 직무 ≠ 내 희망 직무**
 *
 * 「승무원」으로 온보딩한 사람이 지금 카드에 「백엔드」를 적고 있다면, 프로필의 직무가
 * 낡았다는 걸 **본인이 방금 증명한 것**이다. 설정 어딘가에 폼을 두고 찾아오길 기다리는
 * 대신, 어긋난 값을 마주친 그 자리에서 탭 한 번으로 맞춘다.
 *
 * 🔴 **자동 반영은 없다.** 눌러야만 바뀐다(opt-in). 그래서 「카드 하나 = 진로」가 되지
 * 않는다 — 카드를 저장해도 프로필은 그대로고, 이 줄을 눌러도 카드 저장과는 무관하다.
 * 두 값을 한 버튼에 묶으면 「카드 만들 때마다 진로가 바뀌는」 앱이 된다.
 *
 * ## 안 뜨는 경우
 *
 * - **같은 값** → 맞출 게 없다
 * - **빈 값** → 지운 건 「이 카드엔 직무 없음」이지 「프로필을 지워 달라」가 아니다
 *   (프로필을 비우는 길은 내 정보에 따로 있다)
 *
 * 프로필이 비어 있어도 뜬다 — 그 사람에겐 「등록하기」다.
 */
export function PromoteJobTitleRow({
  profileTitle,
  jobTitle,
  seriesId,
}: PromoteJobTitleRowProps) {
  /*
    방금 올린 값 + **그때 프로필이 비어 있었는지**. 성공하면 `profileTitle` 이 새 값으로
    갱신돼 아래 조건이 스스로 false 가 되므로, 이 상태가 없으면 줄이 그냥 **사라지기만**
    한다 — 눌렀는데 아무 말이 없는 게 된다. `wasEmpty` 를 같이 들고 있어야 성공 문구가
    「바뀌었어요」/「등록했어요」 중 **누른 시점의 것**으로 남는다.
  */
  const [promoted, setPromoted] = useState<{ title: string; wasEmpty: boolean } | null>(null)
  const { mutate, isPending } = useUpdateJobProfile()

  const trimmed = jobTitle.trim()
  const profileTrimmed = profileTitle?.trim() ?? ''

  if (promoted && promoted.title === trimmed) {
    const text = promoted.wasEmpty
      ? '✓ 희망 직무로 등록했어요 — 카드 추가할 때 미리 채워져요'
      : `✓ 희망 직무가 ‘${promoted.title}’${roSuffix(promoted.title)} 바뀌었어요 — 카드 추가할 때 미리 채워져요`
    return (
      <p
        role="status"
        className={`mt-2 text-success ${text.length > LONG_TEXT_THRESHOLD ? 'text-sm' : 'text-xs'}`}
      >
        {text}
      </p>
    )
  }

  if (!trimmed || trimmed === profileTrimmed) return null

  const isEmptyProfile = profileTrimmed.length === 0

  const handleClick = () => {
    const verdict = classifyJob(trimmed)
    mutate(
      {
        jobTitle: trimmed,
        /*
          🔴 계열도 같이 올린다. 직무만 바꾸면 프로필이 「간호사 · IT·개발」처럼 어긋난 채
          남고, 그 어긋남을 자소서·면접 AI 가 그대로 먹는다. 사전이 확신하면 그 판정을,
          아니면 사용자가 이 화면에서 고른 계열을 따른다.
        */
        seriesId:
          verdict.status === 'confident' ? verdict.series.id : (seriesId ?? null),
      },
      { onSuccess: () => setPromoted({ title: trimmed, wasEmpty: isEmptyProfile }) },
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      /* SignupQuestion 「바꾸기」와 같은 문법 — 본문이 아니라 곁다리 제안이라는 무게 */
      className="mt-2 text-xs text-text-tertiary underline underline-offset-2 hover:text-text-primary min-h-[36px] lg:min-h-[28px] px-1 -mx-1 rounded transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      {isPending
        ? '저장 중…'
        : isEmptyProfile
          ? `‘${trimmed}’${eulSuffix(trimmed)} 내 희망 직무로 등록하기`
          : `내 희망 직무도 ‘${trimmed}’${roSuffix(trimmed)} 바꾸기`}
    </button>
  )
}
