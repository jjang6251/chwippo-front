import { useRef, useState } from 'react'
import { POSTING_RAW_MAX, POSTING_RAW_MIN } from '@/api/jobPosting'

/** 이 길이를 넘겨 붙이면 칸이 4줄 미리보기로 접힌다 (아래 주석 참조) */
export const POSTING_COLLAPSE_AT = 200

interface Props {
  value: string
  onChange: (v: string) => void
  /** 데모 「샘플 공고 넣어보기」 — 데모 모드에서만 넘어온다 */
  onFillSample?: () => void
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * 공고 붙여넣기 칸 — **붙이기 전보다 붙인 뒤가 더 중요한 입력**.
 *
 * ## 붙인 뒤 칸을 접는 이유
 *
 * 공고는 보통 3,000자쯤 된다. 그대로 두면 칸이 화면을 통째로 먹고 **「카드 만들기」가
 * 폴드 밖으로 밀린다** — 붙였는데 다음에 뭘 눌러야 하는지 안 보인다 (CEO 2026-08-29
 * 「붙이기 전은 OK, 후가 빔」). 그래서 4줄 미리보기로 접고, 그 자리에 **확인 줄**을 세운다:
 * 「N자 붙었어요 — 회사·전형·날짜·발표 일정을 찾을게요」. 무엇이 들어갔고 무엇을 할지가
 * 한 줄로 읽히면 붙인 사람이 다음 동작을 망설이지 않는다.
 *
 * 🔴 마지막 줄에 fade 를 씌우지 않는다 — 가려진 글을 「더 있어 보이게」 꾸미는 장식이고,
 * 「전체 보기」가 이미 그 사실을 말한다.
 *
 * ## 빈 칸은 점선
 *
 * 「비어 있고 눌러서 채우는 자리」의 앱 문법(`RevealChip`·`StepDateField`)을 그대로 쓴다.
 * 채워지면 실선으로 바뀌어 **상태가 바뀐 것**이 테두리만으로 보인다.
 *
 * ## 초과는 토스트가 아니라 인라인
 *
 * 뒤가 잘렸다는 사실은 **붙인 자리에서** 읽혀야 하고, 사라지는 알림에 실으면 안 된다.
 */
export function PostingPasteField({
  value,
  onChange,
  onFillSample,
  disabled,
  autoFocus,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  /** 상한을 넘겨 붙어서 잘린 적이 있나 — 지우고 다시 붙이면 사라진다 */
  const [truncated, setTruncated] = useState(false)
  const [expanded, setExpanded] = useState(false)

  /**
   * 🔴 `maxLength` 를 걸지 않는다. 브라우저가 조용히 잘라 버리면 **잘렸다는 사실 자체를
   * 알 수 없어** 「마감이 뒤쪽에 있었는데 안 잡혔다」의 원인을 사용자가 영영 모른다.
   * 직접 잘라서 그 사실을 화면에 남긴다.
   */
  const apply = (next: string) => {
    if (next.length > POSTING_RAW_MAX) {
      setTruncated(true)
      onChange(next.slice(0, POSTING_RAW_MAX))
      return
    }
    if (next.length === 0) setTruncated(false)
    onChange(next)
  }

  const len = value.length
  const collapsed = len >= POSTING_COLLAPSE_AT && !expanded
  const atMax = len >= POSTING_RAW_MAX

  /** 모바일에서 붙이는 순간 키보드를 내린다 — 미리보기·확인 줄·CTA 가 한 화면에 같이 서야 한다 */
  const handlePaste = () => {
    window.setTimeout(() => {
      if ((taRef.current?.value.length ?? 0) >= POSTING_COLLAPSE_AT) taRef.current?.blur()
    }, 0)
  }

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        apply(text)
        taRef.current?.blur()
      }
    } catch {
      /* 권한 거부·미지원 — 직접 붙여넣기가 그대로 남아 있다 */
    }
  }

  // 지원하지 않는 브라우저에선 **아예 렌더하지 않는다** (비활성 버튼 금지 — 눌러도 안 되는
  // 버튼은 기능이 고장 난 것처럼 보인다)
  const clipboardSupported =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  return (
    <div>
      {len === 0 && (
        /* 읽는 문장(40자+) → 14px (DESIGN.md 규칙 7-b). 아래 카운터·최소 길이는 라벨이라 11px */
        <p className="text-sm text-text-quaternary mb-1.5 leading-relaxed">
          제목부터 마감·발표일까지 통째로 — 카드와 캘린더 일정을 한 번에 만들어요
        </p>
      )}

      <textarea
        ref={taRef}
        id="add-card-posting-text"
        aria-label="채용 공고 원문"
        value={value}
        onChange={(e) => apply(e.target.value)}
        onPaste={handlePaste}
        readOnly={collapsed}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={collapsed ? 4 : 7}
        placeholder="채용 공고를 통째로 붙여넣으세요 — 직무 설명(하는 일·자격 요건)이 따로 있으면 이어서 붙여도 돼요"
        className={`w-full bg-input rounded-lg p-3 text-base lg:text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none overscroll-contain disabled:opacity-50 ${
          len === 0
            ? 'border-[1.5px] border-dashed border-line-strong'
            : 'border-[1.5px] border-solid border-line-strong'
        } ${collapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}
      />

      {collapsed && (
        /*
         * 접힌 칸은 readOnly 라 두 번째 붙여넣기가 막힌다. placeholder 가 「직무 설명이 따로
         * 있으면 이어서 붙여도 돼요」라고 말하므로, 그 길을 여기 **이름 붙여** 둔다 —
         * 펼치고 커서를 끝으로 보내 바로 Ctrl+V 하면 이어진다 (거짓 어포던스 방지)
         */
        <div className="mt-1.5 flex justify-end gap-3">
          {/*
            11px 글자 링크는 높이 17px — 모바일 터치 44px 미달 (실측 8/30). 글자는 그대로 두고
            `py-[14px] -my-[14px]` 로 **히트 영역만** 45px 로 늘린다 (레이아웃 높이는 안 바뀐다).
            데스크탑(lg:)은 포인터라 원래대로.
          */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] text-text-tertiary hover:text-text-secondary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded py-[14px] -my-[14px] px-1 -mx-1 lg:py-0 lg:my-0"
          >
            전체 보기
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(true)
              window.setTimeout(() => {
                const ta = taRef.current
                if (!ta) return
                ta.focus()
                ta.setSelectionRange(ta.value.length, ta.value.length)
              }, 0)
            }}
            className="text-[11px] text-text-tertiary hover:text-text-secondary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 rounded py-[14px] -my-[14px] px-1 -mx-1 lg:py-0 lg:my-0"
          >
            이어 붙이기
          </button>
        </div>
      )}

      {/* 모바일 전용 — 데스크탑은 Ctrl+V 가 이미 몸에 붙어 있어 버튼이 군더더기다 */}
      {clipboardSupported && (
        <div className="mt-2.5 lg:hidden">
          <button
            type="button"
            onClick={readClipboard}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 min-h-[44px] lg:min-h-[30px] text-xs text-text-tertiary hover:bg-card hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            📋 클립보드에서 붙여넣기
          </button>
        </div>
      )}

      {onFillSample && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={onFillSample}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 min-h-[44px] lg:min-h-[30px] text-xs text-text-tertiary hover:bg-card hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            ✨ 샘플 공고 넣어보기
          </button>
        </div>
      )}

      {/* 모바일은 두 줄 — 한 줄이면 「찾을게요」가 접힌다 (실측) */}
      <div className="mt-2.5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {len === 0 ? (
          <span className="text-[11px] text-text-quaternary">
            {POSTING_RAW_MIN}자 이상 붙여 주세요
          </span>
        ) : (
          <p className="text-[13px] text-text-secondary leading-relaxed">
            <span className="text-brand font-semibold">✓</span>{' '}
            {len.toLocaleString()}자 붙었어요 — 회사·전형·날짜·발표 일정을 찾을게요
          </p>
        )}
        <span
          className={`text-[11px] font-mono tabular-nums shrink-0 sm:pt-[3px] ${
            atMax ? 'text-warning' : 'text-text-quaternary'
          }`}
        >
          {len.toLocaleString()}/{POSTING_RAW_MAX.toLocaleString()}
        </span>
      </div>

      {truncated && (
        <p role="alert" className="mt-2 text-[11px] text-warning leading-relaxed">
          앞 {POSTING_RAW_MAX.toLocaleString()}자만 들어갔어요. 마감·전형이 뒤쪽에 있으면 그
          부분만 다시 붙여 주세요
        </p>
      )}
    </div>
  )
}
