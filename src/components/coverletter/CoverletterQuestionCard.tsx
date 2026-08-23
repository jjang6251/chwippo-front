import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { CoverLetterImportModal } from '@/components/card/CoverLetterImportModal'
import { useAutoResize } from '@/hooks/useAutoResize'
import { CoverLetterCleanupModal } from '@/components/card/CoverLetterCleanupModal'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { Modal } from '@/components/common/Modal'
import { toast } from '@/stores/toastStore'
import { useCoverletterSourceRefs } from '@/hooks/useCoverletterSourceRefs'
import { countChars } from '@/utils/charCount'
import { countFillPlaceholders } from '@/utils/coverletterPlaceholder'
import {
  COVERLETTER_CATEGORIES,
  COVERLETTER_CATEGORY_EMOJI,
  COVERLETTER_CATEGORY_STYLE,
  coverletterCategory,
} from '@/types/coverletter'
import type { ApplicationCoverletter, UpdateCoverletterDto } from '@/types/coverletter'

/**
 * F1 자소서 풀페이지 — 문항 카드 (접기 default + 펴기 시 전체 편집).
 *
 * 접힘: 분류 chip + question 1줄 + 답변 미리보기 + 글자수
 * 펴짐: question 편집 + 분류 / limit / 답변 textarea + 가져오기 / 검사 / 삭제 + source chips
 *
 * 자동저장: answer/question/limit 변경 → 1.5s debounce → update.
 */

interface Props {
  cl: ApplicationCoverletter
  /** 1-based 문항 번호 — 사용자가 AI 에게 "1번 문항" 처럼 지칭 */
  number: number
  applicationId: string
  expanded: boolean
  onToggle: () => void
  onUpdate: (dto: UpdateCoverletterDto) => void
  onDelete: () => void
  /** "✨ AI 에게 묻기" — 부모가 ChatPanel input 에 prefill */
  onAskAI: () => void
  /** 보기 전용 — 모바일·RN 네이티브. 편집·AI 요소 미노출 (CEO 결정 2026-07-09) */
  readOnly?: boolean
  /**
   * 🔴 **간단 편집 — 글자만 고친다** (2026-08-10). 면접 세션의 「나란히 보기」 전용.
   *
   * 거기서 자소서는 **답을 쓰는 동안 참고하는 자료**다. 문항 유형을 바꾸거나 AI 를 부르거나
   * 문항을 지우는 건 그 맥락이 아니다 — 504px 열에서 모달이 뜨는 것도 어색하고,
   * 실수로 지우면 되돌릴 수도 없다. **답변 textarea 하나만 살리고 나머지는 읽기 표시로** 둔다.
   *
   * `readOnly` 로 대신할 수 없다 — 그건 **아무것도 못 고친다.** 오타 하나 고치려고
   * 자소서 화면까지 가야 하면 이 화면을 만든 이유가 없어진다.
   *
   * 감추는 것: 유형 select · 글자수 제한 · 문항 편집 · AI 에게 묻기 · 답변 가져오기 · 정리 · 삭제.
   * 그 기능들이 어디 있는지는 부모(자소서 열 헤더)가 링크로 알려 준다.
   */
  simpleEdit?: boolean
  /**
   * 🔴 **문항도 고칠 수 있게 한다** — `simpleEdit` 의 예외 하나 (2026-08-23 CEO).
   *
   * 자소서 풀페이지의 모바일이 이걸 쓴다. 거기서는 코인을 쓰는 **AI 진입점만** 막으면 되고
   * (`useCoverletterAiBlocked`), 문항·답변은 사용자가 자기 자소서를 쓰는 본 작업이다.
   * `simpleEdit` 이 문항을 잠그는 이유는 **면접 화면의 맥락**(회사가 준 문항을 보며 답을 쓴다)
   * 이지 IAP 가 아니므로, 그 화면(`allowQuestionEdit` 미지정)의 동작은 그대로 둔다.
   *
   * 이 플래그는 **유형·글자수 제한·삭제·가져오기를 열지 않는다** — 되돌리기 어렵거나
   * 구조를 바꾸는 조작이라 작은 화면에서 오조작 위험이 크다.
   */
  allowQuestionEdit?: boolean
  /** AI 적용 직후 강조 플래시 (부모가 1.2s 후 해제) */
  flash?: boolean
  /** 펼친 카드 루트 ref — 부모가 적용 시 scrollIntoView 대상 등록 */
  containerRef?: (el: HTMLDivElement | null) => void
  /**
   * 🔴 **랜딩 미리보기 — 네트워크를 타지 않는다** (2026-08-09).
   *
   * 랜딩이 이 카드를 **스크린샷 대신 실물로** 렌더한다(이미지는 UI 가 바뀌면 조용히 낡고
   * 다크에 박제된다). 그런데 참조 경험 조회가 **비로그인 방문자에게 401** 을 내고
   * refresh 재시도까지 연쇄된다 — 면접 카드에서 실측으로 요청 30건이 나왔다.
   *
   * `readOnly` 로 대신하지 않는 이유: 참조 경험 칩은 `readOnly`(모바일)에서도 **보여야 한다.**
   * 여기에 `!readOnly` 를 걸면 모바일 동작이 조용히 바뀐다. 그래서 별도 플래그를 둔다.
   */
  preview?: boolean
}

export function CoverletterQuestionCard({
  cl,
  number,
  applicationId,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onAskAI,
  readOnly = false,
  simpleEdit = false,
  allowQuestionEdit = false,
  preview = false,
  flash = false,
  containerRef,
}: Props) {
  const aiEnabled = useAiEnabled()
  /**
   * 구조를 바꾸는 조작(유형·글자수 제한·문항·삭제)과 부가 도구(AI·가져오기·정리)를 감출지.
   * `readOnly` 는 답변까지 못 고치고, `simpleEdit` 은 **답변만** 고친다.
   */
  const chromeless = readOnly || simpleEdit
  /** 문항 편집 개방 — `allowQuestionEdit` 만 `chromeless` 를 뚫는다 (다른 조작은 그대로 감춘다) */
  const questionEditable = !chromeless || allowQuestionEdit
  const [question, setQuestion] = useState(cl.question)
  // 문항 인라인 편집 — 새 문항(비어 있음)은 바로 편집 모드, 기존 문항은 읽기 뷰(클릭 시 편집)
  const [editingQuestion, setEditingQuestion] = useState(!cl.question)
  const [answer, setAnswer] = useState(cl.answer ?? '')
  // 베타 피드백 — 자소서 답변이 길어지면 scroll 필요. auto-resize (min 200 / max 600 — 자소서 답변은 더 길게 허용)
  const { ref: answerRef, autoResize: autoResizeAnswer } = useAutoResize(answer, { min: 80, max: 600 })
  // 문항도 길면 내부 scroll 발생 — auto-resize (min 56 / max 400)
  const { ref: questionRef, autoResize: autoResizeQuestion } = useAutoResize(question, { min: 56, max: 400 })
  // 카드가 접힌 채 마운트되면 훅 내부 effect(value 변경 시)가 초기 확장을 못 잡음 — 펼침 시점에 명시 resize
  useEffect(() => {
    if (!expanded || readOnly) return
    const id = requestAnimationFrame(autoResizeAnswer)
    return () => cancelAnimationFrame(id)
  }, [expanded, readOnly, autoResizeAnswer])
  // 편집 재진입 시에도 동일 — textarea 재마운트인데 값은 그대로라 훅 effect 가 안 잡음.
  // 조건은 **textarea 가 실제로 있는가**(questionEditable) — `readOnly` 로 물으면
  // 모바일 편집 개방 경로(readOnly=false·simpleEdit=true)에서 없는 요소를 재려 한다.
  useEffect(() => {
    if (!editingQuestion || !questionEditable) return
    const id = requestAnimationFrame(autoResizeQuestion)
    return () => cancelAnimationFrame(id)
  }, [editingQuestion, questionEditable, autoResizeQuestion])
  const [limitInput, setLimitInput] = useState(
    cl.charLimit != null ? String(cl.charLimit) : '',
  )
  const [showImport, setShowImport] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  /**
   * 🔴 **문항 + 답변을 한 번에** 복사한다 (2026-08-23 CEO — "각각 복사해야 해서 불편").
   *
   * 답변만 복사하면 옮긴 곳에서 **무슨 질문에 답한 건지 사라진다.** 자소서를 다른 데로
   * 옮기는 경우(메모·문서·다른 도구)가 지원 폼에 직접 붙여넣는 경우보다 잦고, 폼에
   * 넣을 땐 편집 화면 textarea 에서 전체 선택이 이미 된다.
   * 그래서 **버튼 하나 = 문항 + 답변**으로 둔다 — 둘로 나누면 매번 고르게 만든다.
   *
   * 자리는 카드 헤더(접기 옆) — `chromeless`(읽기 전용·간단 편집)에서도 **같은 위치**다.
   * 읽기 모드는 모바일이라 긴 답변을 손으로 드래그하는 게 특히 고통스럽다.
   */
  const [copied, setCopied] = useState(false)
  const copyQnA = async () => {
    if (copied) return
    const text = `${cl.question ?? ''}\n\n${answer}`.trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // 권한 거부·비보안 컨텍스트 — 방어가 없으면 rejection 이 unhandled 로 새어
      // Sentry 에 크래시로 잡힌다 (CHWIPPO-FRONT-6 · CopyButton 과 같은 처리)
      toast.error('복사에 실패했어요. 직접 선택해 복사해 주세요.')
    }
  }

  const initialized = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * 🔴 **아직 서버로 안 나간 답변** — 떠날 때 이걸 내보낸다 (2026-08-10 점검에서 발견).
   *
   * 저장은 1.5초 debounce 인데 cleanup 은 타이머를 **지우기만** 했다. 예전엔 언마운트
   * 경로가 「자소서 화면을 떠난다」 뿐이라 잘 안 드러났는데, 면접 화면의 나란히 보기가
   * 경로를 크게 늘렸다 — **손잡이를 눌러 열을 접기**·끝까지 끌어 접기·창을 줄이기.
   * 타이핑하고 바로 접으면 마지막 1.5초가 사라지는데, 화면엔 「자동 저장돼요」가 떠 있었다.
   *
   * 같은 사고를 면접 카드가 먼저 겪고 flush 로 막아 뒀다 (`InterviewQuestionCard`, 2026-08-09).
   * 그 패턴을 여기로 옮긴다.
   */
  const pendingRef = useRef<string | null>(null)
  /* 부모가 인라인 람다를 넘겨 매 렌더 신원이 바뀐다 — deps 에 넣으면 cleanup 이 매번 돈다.
     렌더 중에 ref 를 쓰는 건 React 규칙 위반이라 effect 에서 갱신한다 (최신값 보관 표준 패턴). */
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  })
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (pendingRef.current !== null) {
        onUpdateRef.current({ answer: pendingRef.current })
        pendingRef.current = null
      }
    },
    [],
  )

  // 저장 발화 시점에 footer 문구를 "저장됨 ✓" 로 2초간 전환 (자동저장 피드백)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flagSaved = useCallback(() => {
    setJustSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setJustSaved(false), 2000)
  }, [])
  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    },
    [],
  )

  // 외부에서 cl 변경 (예: AI 적용으로 부모가 updateCl) — 로컬 state 동기화.
  // 단 사용자가 직접 편집해 debounce 가 active 면 skip (사용자 입력 우선).
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }
    if (saveTimerRef.current) return // 사용자 편집 중 → 덮어쓰지 않음
    setAnswer(cl.answer ?? '')
  }, [cl.answer])

  // 답변 변경 자동저장 (debounce 1.5s)
  useEffect(() => {
    if (!initialized.current) return
    if (answer === (cl.answer ?? '')) {
      // 로컬 == 서버 → 저장할 것 없음. ref 를 여기서 해제해야 외부 변경(AI 적용 등)
      // 동기화가 재개됨. cleanup 에서 해제하면 안 됨 — cleanup 은 sync effect 보다
      // 먼저 돌아서 "사용자 편집 중" 보호가 깨짐.
      saveTimerRef.current = null
      pendingRef.current = null
      return
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    pendingRef.current = answer // 아직 안 나간 값 — 언마운트 때 이걸 내보낸다
    saveTimerRef.current = setTimeout(() => {
      // 발화 후 ref 해제 필수 — 남겨두면 외부 변경 동기화가 영구 skip 되고,
      // 이 effect 가 stale 로컬 답변을 재저장해 적용 내용을 롤백시킴
      saveTimerRef.current = null
      pendingRef.current = null
      onUpdate({ answer })
      flagSaved()
    }, 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [answer, cl.answer, onUpdate, flagSaved])

  const category = coverletterCategory(cl.category)
  const categoryStyle = COVERLETTER_CATEGORY_STYLE[category]
  const counts = useMemo(() => countChars(answer), [answer])
  const [includeSpaces, setIncludeSpaces] = useState(true) // 공백포함 토글 (잡코리아 표준)
  const charCount = includeSpaces ? counts.total : counts.withoutSpaces
  const byteCount = includeSpaces ? counts.bytes : counts.bytesWithoutSpaces
  const overLimit = cl.charLimit != null && charCount > cl.charLimit
  const nearLimit =
    cl.charLimit != null && !overLimit && charCount >= cl.charLimit * 0.9
  const hasAnswer = useMemo(() => answer.trim().length > 0, [answer])
  const fillCount = useMemo(() => countFillPlaceholders(answer), [answer])

  // source_refs (답변 있을 때만)
  const { data: sourceRefs = [] } = useCoverletterSourceRefs(cl.id, hasAnswer && !preview)

  /**
   * 접힘 모드 — 🔴 **카드 전체를 `<button>` 으로 두지 않는다** (2026-08-23 수리).
   *
   * 예전엔 전체가 토글 버튼이라 **복사 버튼을 넣을 자리가 없었다**(button 안 button 은
   * 마크업 위반이고, 스트립 × 에서 겪었듯 「치우려다 이동」이 난다). 그런데 접힌 카드는
   * 답변을 **전문으로** 보여준다 — 읽고 있는데 복사는 못 하는 상태였다.
   *
   * 그래서 **헤더(뱃지 줄)를 토글 밖으로** 빼고 거기에 복사·펼치기를 형제로 둔다.
   * 본문(문항+답변)은 그대로 눌러서 펼친다 — 큰 표적은 유지된다.
   */
  if (!expanded) {
    return (
      <div
        id={`cl-${cl.id}`}
        className="bg-card border border-line rounded-[14px] p-4 hover:border-brand/40 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-5 text-[11px] font-bold font-mono text-brand bg-brand/10 border border-brand/20 rounded px-1.5"
            title={`${number}번 문항`}
          >
            Q{number}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${categoryStyle}`}
          >
            {COVERLETTER_CATEGORY_EMOJI[category]} {category}
          </span>
          {cl.charLimit && (
            <span className="text-[10px] text-text-quaternary font-mono">
              · {cl.charLimit}자
            </span>
          )}
          {!hasAnswer && (
            <span className="text-[10px] text-warning bg-warning/8 border border-warning/20 px-1.5 rounded-full">
              미작성
            </span>
          )}
          <div className="flex-1" />
          {hasAnswer && <CopyQnAButton copied={copied} onCopy={copyQnA} />}
          <button
            type="button"
            onClick={onToggle}
            aria-label="문항 펼치기"
            className="flex items-center justify-center w-8 h-8 -mr-1 rounded-md text-text-quaternary hover:text-text-primary hover:bg-card-strong transition-colors"
          >
            <CollapsibleChevron open={false} />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="block w-full text-left"
          aria-label={`${cl.question || `${number}번 문항`} 펼치기`}
        >
          <p className="text-[15px] lg:text-base font-semibold text-text-primary leading-relaxed whitespace-pre-wrap break-words mb-1.5">
            {cl.question || (
              <span className="text-text-quaternary font-medium font-sans">
                (문항 미입력 — 클릭해서 작성)
              </span>
            )}
          </p>
          {hasAnswer && (
            <div className="mt-2 pl-2.5 border-l-2 border-line">
              <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap break-words">
                {answer}
              </p>
              <p
                className={`mt-1.5 font-mono text-xs ${overLimit ? 'text-danger font-semibold' : 'text-text-quaternary'}`}
              >
                {charCount} / {cl.charLimit ?? '∞'}
              </p>
            </div>
          )}
        </button>
      </div>
    )
  }

  // 펴짐 모드 — 편집
  return (
    <div
      ref={containerRef}
      id={`cl-${cl.id}`}
      className={`bg-card border border-brand/40 rounded-[14px] p-4 lg:p-[18px] shadow-md transition-shadow ${
        flash ? 'ring-2 ring-brand/60' : ''
      }`}
    >
      {/* 헤더 — 번호 + 분류 + 글자수 limit + 닫기 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 text-[11px] text-text-tertiary">
        <span
          className="inline-flex items-center justify-center min-w-[28px] h-6 text-xs font-bold font-mono text-brand bg-brand/10 border border-brand/20 rounded px-2"
          title={`${number}번 문항 — AI 에게 "${number}번 문항" 또는 "Q${number}" 로 지칭 가능`}
        >
          Q{number}
        </span>
        {chromeless ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${categoryStyle}`}
          >
            {COVERLETTER_CATEGORY_EMOJI[category]} {category}
          </span>
        ) : (
          <label className="flex items-center gap-1.5">
            <span>유형</span>
            <span className="relative">
              <select
                value={category}
                onChange={(e) => onUpdate({ category: e.target.value })}
                className="appearance-none bg-surface-2 border border-line rounded-md pl-2 pr-8 py-1 text-[11px] text-text-secondary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors cursor-pointer"
              >
                {COVERLETTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </label>
        )}
        {chromeless ? (
          cl.charLimit != null && (
            <span className="font-mono text-text-quaternary">
              제한 {cl.charLimit}자
            </span>
          )
        ) : (
          <label className="flex items-center gap-1.5">
            <span>글자수 제한</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              onBlur={() => {
                const raw =
                  limitInput.trim() === ''
                    ? null
                    : Math.max(0, Math.floor(Number(limitInput) || 0))
                const next = raw === 0 ? null : raw
                if (next !== cl.charLimit) {
                  onUpdate({ charLimit: next })
                  flagSaved()
                }
                setLimitInput(next != null ? String(next) : '')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              placeholder="없음"
              className="w-16 bg-surface-2 border border-line rounded-md px-2 py-1 font-mono text-[11px] text-text-secondary placeholder:text-text-tertiary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors"
            />
            <span className="text-text-quaternary">자</span>
          </label>
        )}
        <div className="flex-1" />
        {hasAnswer && <CopyQnAButton copied={copied} onCopy={copyQnA} />}
        <button
          onClick={onToggle}
          className="flex items-center gap-1 min-h-[32px] px-1.5 -mr-1.5 rounded-md text-text-quaternary hover:text-text-primary hover:bg-card-strong text-xs transition-colors"
          aria-label="카드 접기"
        >
          <CollapsibleChevron open={true} />
          접기
        </button>
      </div>

      {/*
        question — 기본은 읽기(`chromeless`). 면접 「나란히 보기」에서는 회사가 준 문항이
        답을 쓰다 고칠 대상이 아니기 때문이다.
        `allowQuestionEdit`(자소서 풀페이지 모바일)만 이 잠금을 뚫는다 — 거기선 문항을 쓰는 게
        본 작업이고, 막아야 하는 건 코인을 쓰는 AI 뿐이다.
      */}
      {!questionEditable ? (
        <p className="w-full text-[15px] lg:text-base font-semibold text-text-primary leading-relaxed whitespace-pre-wrap break-words mb-4">
          {cl.question || (
            <span className="text-text-quaternary font-sans text-sm">
              (문항 미입력)
            </span>
          )}
        </p>
      ) : !editingQuestion ? (
        <button
          type="button"
          onClick={() => setEditingQuestion(true)}
          aria-label="문항 편집"
          className="group w-full text-left flex items-start gap-1.5 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors mb-4"
        >
          <span className="flex-1 text-[15px] lg:text-base font-semibold text-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {cl.question || (
              <span className="text-text-quaternary font-sans text-sm">
                (문항 미입력 — 클릭해 입력)
              </span>
            )}
          </span>
          <span
            aria-hidden
            className="shrink-0 text-text-quaternary text-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
          >
            ✎
          </span>
        </button>
      ) : (
        <textarea
          ref={questionRef}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value)
            autoResizeQuestion()
          }}
          onBlur={() => {
            const v = question.trim()
            if (!v && !cl.question) return // 빈 문항 → 편집 모드 유지
            if (!v) {
              setQuestion(cl.question)
              setEditingQuestion(false)
              return
            }
            if (v !== cl.question) {
              onUpdate({ question: v })
              flagSaved()
            }
            setEditingQuestion(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuestion(cl.question)
              setEditingQuestion(false)
            }
          }}
          autoFocus
          maxLength={500}
          placeholder="예: 우리 회사에 지원한 동기를 작성해 주세요."
          className="w-full resize-none bg-surface-2 border border-line rounded-lg px-3 py-2 text-[15px] lg:text-base font-semibold text-text-primary leading-relaxed placeholder:text-text-tertiary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors mb-4"
        />
      )}

      {/* answer */}
      {readOnly ? (
        hasAnswer ? (
          <div className="w-full whitespace-pre-wrap break-words text-sm text-text-primary leading-relaxed">
            {answer}
          </div>
        ) : (
          <p className="text-sm text-text-quaternary">(아직 작성 안 됨)</p>
        )
      ) : (
      <textarea
        ref={answerRef}
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value)
          autoResizeAnswer()
        }}
        /*
          🔴 **없는 것을 가리키지 않는다** (2026-08-10 점검). `simpleEdit`(면접 화면의
          나란히 보기)은 AI 채팅을 의도적으로 뺀 화면인데, 안내는 "우측 AI 채팅" 을
          계속 가리키고 있었다 — 게다가 거기 오른쪽엔 채팅이 아니라 면접 열이 있다.
        */
        placeholder={
          aiEnabled && !simpleEdit
            ? '여기에 답변을 작성하세요. 또는 우측 AI 채팅으로 초안 생성. (자동 저장)'
            : '여기에 답변을 작성하세요. (자동 저장)'
        }
        style={{ minHeight: 80, lineHeight: 1.65 }}
        className="w-full bg-input border border-line rounded-[11px] px-3.5 py-3 text-sm leading-relaxed text-text-primary resize-y focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      />
      )}
      <div className="flex items-center justify-between gap-2 mt-2 text-xs flex-wrap">
        {readOnly ? (
          <span />
        ) : (
          <span className="text-text-quaternary" aria-live="polite">
            {justSaved ? (
              <span className="text-success">저장됨 ✓</span>
            ) : (
              '✎ 자동 저장돼요'
            )}
          </span>
        )}
        {fillCount > 0 && (
          <span className="text-[10px] text-warning">
            ⚠️ 채워야 할 부분 {fillCount}곳
          </span>
        )}
        <div className="flex items-center gap-2 text-text-tertiary">
          <button
            onClick={() => setIncludeSpaces((v) => !v)}
            className="text-[10px] text-text-quaternary hover:text-text-secondary border border-line hover:border-line-strong px-2 min-h-[32px] rounded transition-colors"
            title="공백 포함/제외 토글"
          >
            {includeSpaces ? '공백포함' : '공백제외'}
          </button>
          <span
            className={`font-mono ${overLimit ? 'text-danger font-semibold' : nearLimit ? 'text-warning' : 'text-text-tertiary'}`}
          >
            {charCount.toLocaleString()} / {cl.charLimit?.toLocaleString() ?? '∞'}자
          </span>
          <span className="font-mono text-text-quaternary">
            · {byteCount.toLocaleString()}byte
          </span>
          {/*
            🔴 `readOnly` 가 아니라 `chromeless` 로 가른다 (2026-08-10 점검) —
            이 문구가 가리키는 [검사] 버튼은 `simpleEdit` 에서도 감춰져 있다.
            안내만 남으면 없는 버튼을 찾게 된다.
          */}
          {overLimit && !chromeless && (
            <span className="text-[10px] text-text-quaternary">
              · [검사]의 AI 심층 점검이 줄일 문장을 짚어드려요
            </span>
          )}
        </div>
      </div>

      {/* 액션 — readOnly(모바일·네이티브)·simpleEdit(나란히 보기)에선 미노출 */}
      {!chromeless && (
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-line">
        {aiEnabled && (
          <button
            onClick={onAskAI}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-accent border border-brand/30 hover:border-brand/50 bg-brand/8 hover:bg-brand/12 px-2.5 py-1.5 rounded-md transition-colors"
            title="이 문항을 AI 에게 물어보거나 답변 도움 요청"
          >
            ✨ AI 에게 묻기
          </button>
        )}
        <button
          onClick={() => setShowImport(true)}
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors"
        >
          📋 답변 가져오기
        </button>
        <button
          onClick={() => setShowCleanup(true)}
          disabled={!answer.trim()}
          className="text-[11px] text-text-tertiary hover:text-text-secondary border border-line hover:border-line-strong px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-40"
        >
          🔍 자소서 검사
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-[11px] text-text-quaternary hover:text-danger border border-line hover:border-danger/30 px-2.5 py-1.5 rounded-md transition-colors"
        >
          삭제
        </button>
      </div>
      )}

      {/* source chips */}
      {sourceRefs.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-line">
          <div className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider mb-2">
            ✦ 이 답변이 참조한 경험 ({sourceRefs.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sourceRefs.map((ref) => (
              <span
                key={ref.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-surface ${
                  ref.aiRecommended
                    ? 'border-accent/40 text-accent border-dashed'
                    : 'border-line text-text-secondary'
                }`}
              >
                <span
                  className={`text-[9px] font-bold px-1.5 rounded ${
                    ref.aiRecommended
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-3 text-text-quaternary'
                  }`}
                >
                  {ref.aiRecommended ? 'AI' : ref.sourceReflectionId ? '회고' : 'log'}
                </span>
                <span className="max-w-[140px] truncate">
                  {ref.snippetText?.slice(0, 30) ?? '(미리보기 없음)'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* modals */}
      {showImport && (
        <CoverLetterImportModal
          onClose={() => setShowImport(false)}
          applicationId={applicationId}
          currentCategory={cl.category}
          currentAnswer={answer}
          onApply={(value) => {
            setAnswer(value)
            onUpdate({ answer: value })
          }}
        />
      )}
      {showCleanup && (
        <CoverLetterCleanupModal
          text={answer}
          limit={cl.charLimit}
          aiFeedbackClId={aiEnabled ? cl.id : null}
          applicationId={applicationId}
          lastFeedback={cl.lastFeedback}
          lastFeedbackAt={cl.lastFeedbackAt}
          onClose={() => setShowCleanup(false)}
          onApply={(cleaned) => {
            setAnswer(cleaned)
            onUpdate({ answer: cleaned })
          }}
        />
      )}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="자소서 문항을 삭제할까요?"
      >
        <p className="text-text-tertiary text-xs leading-relaxed mb-5">
          이 문항과 답변, 모든 출처 참조가 함께 삭제됩니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              setShowDeleteConfirm(false)
              onDelete()
            }}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors"
          >
            삭제
          </button>
        </div>
      </Modal>
    </div>
  )
}

/**
 * 문항+답변 복사 버튼 — **접힘·펼침 양쪽이 같은 것을 쓴다.**
 * 두 벌로 두면 한쪽만 고치는 순간 같은 동작이 화면마다 다르게 보인다
 * (`ResearchSourceChip` 을 공용으로 뺀 것과 같은 판단).
 */
function CopyQnAButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="문항과 답변 복사"
      title="문항과 답변을 함께 복사해요"
      className="flex items-center gap-1 min-h-[32px] px-1.5 rounded-md text-xs text-text-quaternary hover:text-text-primary hover:bg-card-strong transition-colors"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="text-success" aria-hidden="true">
            <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-success">복사됨</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <rect x="4.5" y="1" width="7.5" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 4.5h3M1 4.5v7.5h7.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          복사
        </>
      )}
    </button>
  )
}
