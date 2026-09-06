/**
 * 내 정보 창고 공용 입력 프리미티브.
 *
 * `MyInfo.tsx` 안에 있던 것을 **그대로** 옮겼다 — 새로 생기는 섹션(우대·기타)과 모달
 * (경험 경량 폼)이 같은 칸 톤을 써야 하는데, 페이지 파일에서 import 하면 화면→컴포넌트
 * 방향이 뒤집힌다. 클래스·동작은 한 글자도 바꾸지 않았다 (이관만).
 *
 * 톤: Toss — h-12(48px) · `text-base`(iOS 확대 방지) · rounded-xl · focus 4px halo.
 */
import { useId } from 'react'
import { useAutoResize } from '@/hooks/useAutoResize'
import { countChars } from '@/utils/charCount'

/**
 * 포커스에서 바뀌는 건 테두리 색과 halo(box-shadow) 둘뿐이다 — `transition-all` 은
 * width·height 같은 레이아웃 속성까지 애니메이션 후보로 올려 두는 값이다.
 */
const FIELD_BASE =
  'w-full bg-input border border-line rounded-xl text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]'

/**
 * `Field` 와 같은 톤의 클래스 — 자동완성·자유 업로드 폼처럼 `Field` 를 그대로 못 쓰는 칸이
 * 같은 48px 을 맞출 때 쓴다. 한 화면에 40px 과 48px 이 섞이면 어느 쪽이 「정상」인지 사용자가
 * 매번 다시 읽는다.
 */
export const FIELD_INPUT_CLASS = `${FIELD_BASE} px-4 h-12`
export const FIELD_TEXTAREA_CLASS = `${FIELD_BASE} px-4 py-3`
export const FIELD_SELECT_CLASS =
  'w-full appearance-none bg-input border border-line rounded-xl pl-4 pr-11 h-12 text-base text-text-primary cursor-pointer focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]'

/** InfoModal 안 body section 그룹핑 (Education 톤과 통일) */
export function ModalSection({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? '' : 'pt-6 border-t border-line'}>
      <p className="text-[13px] font-bold text-text-primary mb-3.5">{title}</p>
      {children}
    </div>
  )
}

const FIELD_LABEL_CLASS = 'block text-sm text-text-secondary mb-2 font-medium'

/**
 * 필수 입력 라벨 — ui-specs.md "필수 입력 필드" 규칙 따름.
 *
 * `htmlFor` 는 선택이다: 세그먼트 토글처럼 **연결할 단일 입력이 없는** 자리에서도
 * 같은 라벨 톤을 쓰기 때문이다 (그런 자리는 `role="group"` 이 이름을 갖는다).
 *
 * 🔴 그런 자리에서는 `<label>` 이 아니라 `<p>` 로 그린다 — `for` 없는 `<label>` 은
 * **아무것도 가리키지 않는 라벨**이라 스크린리더가 「라벨」이라고 읽고 넘어간다.
 * 대신 `id` 를 받아, 그룹이 `aria-labelledby` 로 이 글자를 자기 이름으로 쓴다.
 *
 * `*` 는 **글자로도 읽혀야 한다** — 별표 하나만 있으면 「별」로 읽히거나 아예 안 읽힌다.
 */
export function FieldLabel({ label, required, htmlFor, id }: {
  label: string; required?: boolean; htmlFor?: string
  /** 그룹이 `aria-labelledby` 로 참조할 id */
  id?: string
}) {
  const content = (
    <>
      {label}
      {required && (
        <span className="text-danger ml-1">
          <span aria-hidden="true">*</span>
          <span className="sr-only">필수</span>
        </span>
      )}
    </>
  )
  if (!htmlFor) return <p id={id} className={FIELD_LABEL_CLASS}>{content}</p>
  return <label htmlFor={htmlFor} id={id} className={FIELD_LABEL_CLASS}>{content}</label>
}

/**
 * 🔴 편집 칸에는 복사 버튼이 없다 — 쓰는 중에 칸 오른쪽을 가리고, 값이 아직 저장 전이라
 * 「지금 복사한 게 저장된 값인가」가 애매하다. 복사는 보기 모드 행(`MyInfoViewRow copyable`)의 몫이다.
 */
export function Field({
  label, value, onChange, onBlur, type = 'text',
  placeholder, maxLength, as, span, required, disabled, name,
  autoComplete, inputMode, spellCheck, describedBy, invalid, inputRef,
}: {
  label: string; value: string; onChange: (v: string) => void
  onBlur?: () => void; type?: string; placeholder?: string
  maxLength?: number; as?: 'textarea'; span?: boolean
  required?: boolean; disabled?: boolean
  /**
   * 게이지 칩이 「이 칸」을 지목할 때 쓰는 이름. `useId` 는 매 렌더 달라져 밖에서 못 찾는다 —
   * 포커스 대상은 안정적인 이름이 있어야 한다.
   */
  name?: string
  /**
   * 브라우저 자동완성 힌트 — 창고를 채우는 화면이야말로 **브라우저가 이미 아는 값**
   * (이름·연락처·주소)을 그대로 받을 수 있어야 한다.
   */
  autoComplete?: string
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'numeric' | 'decimal' | 'search' | 'none'
  /** 자격번호·우편번호 같은 **코드 칸**은 맞춤법 밑줄이 방해만 된다 */
  spellCheck?: boolean
  /** 칸 아래 도움말·보조 칩의 id (`aria-describedby`) */
  describedBy?: string
  /** 검증에 걸린 칸 (`aria-invalid`) — 오류 문장은 호출부가 그린다 */
  invalid?: boolean
  /** 저장 시 첫 오류 칸으로 포커스를 옮길 때 쓴다 (`as="textarea"` 는 대상이 아니다) */
  inputRef?: React.Ref<HTMLInputElement>
}) {
  // Toss 톤 — h-12 (48px), text-base, rounded-xl, focus 4px halo
  const cls = `${FIELD_INPUT_CLASS} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  const textareaCls = `${FIELD_TEXTAREA_CLASS} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  // 자소서 소재 textarea — 베타 피드백 패턴 (auto-resize 200~500 + lineHeight 1.6)
  const { ref: textareaRef, autoResize } = useAutoResize(value, { min: 80, max: 500 })
  // 라벨↔입력 연결. 없으면 스크린리더가 「입력」 이라고만 읽는다 (칸이 20개인 화면에서 치명적)
  const id = useId()
  // 🔴 `String.length` 는 이모지를 2로 센다 — `CharCounter` 와 같은 숫자를 보여야 한다
  const count = countChars(value).total
  return (
    /*
      🔴 `span` 은 **2열이 켜진 뒤에만** 걸어야 한다. 조건 없는 `col-span-2` 를 1열 그리드
      (`grid-cols-1`) 안에 두면 브라우저가 **암시 칼럼**을 하나 더 만들고, 그 칼럼이 `auto`
      라 내용 폭을 다 먹는다 — 명시 칼럼 `minmax(0,1fr)` 이 **0px** 으로 찌그러져 라벨이
      겹치고 칩 글자가 한 자씩 세로로 찢어졌다 (390px 실측 `grid-template-columns: 0px 292px`).
      분기점은 그리드 쪽(`lg:grid-cols-2`)과 **반드시 같아야** 한다 — 어긋나면 그 구간에서
      같은 증상이 그대로 재발한다. `min-w-0` 은 칸이 제 몫보다 넓은 트랙을 요구하지 않게 한다.
    */
    <div className={`min-w-0 ${span ? 'lg:col-span-2' : ''}`}>
      <FieldLabel label={label} required={required} htmlFor={id} />
      {as === 'textarea' ? (
        <div>
          <textarea
            id={id}
            name={name}
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              autoResize()
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            autoComplete={autoComplete}
            inputMode={inputMode}
            spellCheck={spellCheck}
            aria-describedby={describedBy}
            style={{ minHeight: 80, lineHeight: 1.6 }}
            className={textareaCls + ' resize-y'}
          />
          {maxLength && (
            <p
              aria-live="polite"
              className={`text-xs text-right mt-1 ${
                count >= maxLength
                  ? 'text-danger'
                  : count >= maxLength * 0.9
                  ? 'text-warning'
                  : count >= 200
                  ? 'text-success'
                  : 'text-text-quaternary'
              }`}
            >
              {count} / {maxLength}
            </p>
          )}
        </div>
      ) : (
        <input
          id={id}
          ref={inputRef}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          aria-required={required}
          aria-invalid={invalid}
          autoComplete={autoComplete}
          inputMode={inputMode}
          spellCheck={spellCheck}
          aria-describedby={describedBy}
          className={cls}
        />
      )}
    </div>
  )
}

export function SelectField({ label, value, onChange, options, optionLabels, required, name }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
  /** 보이는 글자가 저장값과 다를 때 (성별 `MALE` → 「남성」). 없으면 값을 그대로 보여준다 */
  optionLabels?: Record<string, string>
  required?: boolean
  /** 게이지 칩이 지목하는 이름 — `Field.name` 과 같은 이유 */
  name?: string
}) {
  const id = useId()
  return (
    <div className="min-w-0">
      <FieldLabel label={label} required={required} htmlFor={id} />
      <div className="relative">
        <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_SELECT_CLASS}>
          <option value="">선택</option>
          {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
        </select>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
