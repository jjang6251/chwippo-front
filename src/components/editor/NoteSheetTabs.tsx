import { useEffect, useRef, useState } from 'react'

/**
 * 준비 노트 **시트 탭 줄** — 엑셀 시트 탭의 문법 그대로다.
 *
 * 🔴 **왜 위인가** (CEO 실기 판단 2026-08-11 — 하단에서 옮겼다). 엑셀 문법은 아래지만
 * 이 화면은 스프레드시트가 아니라 **세로로 긴 문서**다. 노트를 쓰다 보면 탭 줄이 화면
 * 밖으로 밀려나, 정작 시트를 바꾸려면 끝까지 스크롤해 내려가야 했다. 브라우저 탭처럼
 * 위에 두면 무엇을 보고 있고 어디로 갈 수 있는지가 **글보다 먼저** 눈에 든다.
 *
 * 활성 탭은 **아랫변을 지운 채** 에디터 면 바로 위에 붙어 "이 탭이 곧 아래의 면" 을
 * 선(線)으로 말한다 — 색이 아니라 형태로 말해야 테마가 바뀌어도 안 흔들린다.
 *
 * 🔴 **이름 짓기가 모바일에서 살아 있어야 한다.** 엑셀의 더블클릭은 터치에 없다.
 * 그래서 활성 탭에만 연필을 **상시 노출**(hover 시 진해짐)한다 — hover 로만 나타나면
 * 모바일 사용자는 이름을 바꿀 길이 아예 없다. 데스크탑 더블클릭은 덤으로 남긴다.
 *
 * 스타일 근거: [+] 의 점선 테두리는 `CategoryChipPicker` 의 [더보기] 와 **같은 문법**이다
 * — "이건 항목이 아니라 동작" 이라는 신호.
 */

export interface NoteSheetTab {
  id: string
  name: string
}

interface Props {
  sheets: NoteSheetTab[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  /** trim 된 이름 (빈 문자열은 컴포넌트가 미리 걸러 취소로 처리) */
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  /**
   * 이름 편집 중인 시트. 컨테이너가 쥐는 이유는 **[+] 직후 곧바로 편집 상태**로 들어가기
   * 위해서다 (엑셀 문법 — 만들자마자 이름을 짓는다).
   */
  renamingId: string | null
  onRenamingChange: (id: string | null) => void
  /** 서버 캡(10장) 도달 — [+] 비활성 */
  atCap: boolean
  /** 추가 요청 진행 중 — 연타로 두 장 생기는 걸 막는다 */
  adding?: boolean
  /** 활성 탭에 ×(삭제)를 둘지. 마지막 1장·미승격 가상 시트는 false */
  canDelete: boolean
  /** 에디터 패널 id (aria-controls) */
  panelId: string
}

/** 시트 이름 상한 — 서버(`SHEET_NAME_MAX_CHARS`)와 같은 값. 넘으면 400 이라 입력에서 막는다 */
const NAME_MAX = 50

/**
 * 상단 sticky 헤더(`MobileHeader`·`AppShell` 둘 다 `h-12` = 48px) 밑으로 숨지 않게.
 *
 * 🔴 **실측으로 잡았다** (2026-08-11): 탭 줄을 위로 옮긴 뒤 `scrollIntoView` 로 화면 위쪽에
 * 오게 하면 `elementFromPoint` 가 탭이 아니라 헤더를 집었다 — 눌러도 안 눌리는 상태다.
 * 하단 배치 시절의 `scroll-mb-28`(고정 CTA 회피)이 하던 일을 방향만 바꿔 그대로 한다.
 * 네이티브(헤더 없음)에선 64px 위 여백만 남아 해로울 게 없어 분기하지 않는다.
 */
const SCROLL_CLEAR = 'scroll-mt-16'

/**
 * `-mb-px` 로 카드 윗변 위에 1px 겹쳐 앉는다 — 활성 탭의 아랫변(없음) 자리를 카드의
 * 윗선이 지나가게 해서 두 면이 하나로 읽힌다.
 */
const TAB_BASE =
  `relative -mb-px ${SCROLL_CLEAR} shrink-0 inline-flex items-center gap-1 min-h-9 px-3 text-xs whitespace-nowrap rounded-t-lg border border-b-0 cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg`
/**
 * 활성 = 아래의 에디터 면이 **그대로 올라온** 모양 — 아랫변 없음 + 카드와 **같은 토큰**.
 *
 * 🔴 `bg-surface-2` 로 두면 라이트에서 어긋난다. 에디터 카드는 `bg-card-solid`(라이트=흰색)라
 * 탭만 베이지(#faf8f2)로 떠서 "같은 면" 이 깨진다 (2026-08-11 스크린샷 실측).
 * 보더 굵기도 카드와 맞춰야 세로선이 이어져 보인다.
 */
/*
  🔴 `shadow-sm` 은 **뺐다**. 카드는 라이트에서 그림자를 지지만(아래로 떨어진다), 위에 앉은
  탭이 같은 그림자를 지면 **접합면 위로 그늘이 떨어져** 없앤 아랫변이 다시 생긴 것처럼 보인다.
  하단 배치일 땐 그림자가 카드 반대쪽으로 떨어져서 문제가 없었다.
*/
const TAB_ON =
  'bg-card-solid border-line-strong text-text-primary font-medium'
/**
 * 비활성 = 면이 없다. hover 에서만 살짝 떠올라 "누를 수 있다" 를 알린다 —
 * 처음부터 면을 주면 어느 게 열린 시트인지 한눈에 안 갈린다.
 */
const TAB_OFF =
  'border-transparent text-text-tertiary hover:text-text-secondary hover:bg-card'

/** 활성 탭 안의 마이크로 액션 — 12px 아이콘 + 24px 터치 면 */
const MICRO =
  '-mr-1 shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-card-strong transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M8.2 1.6l2.2 2.2M1.5 10.5l.4-2 6.1-6.1a1 1 0 011.4 0l.6.6a1 1 0 010 1.4l-6.1 6.1-2.4.4z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NoteSheetTabs({
  sheets,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  renamingId,
  onRenamingChange,
  atCap,
  adding = false,
  canDelete,
  panelId,
}: Props) {
  const tabRefs = useRef<Record<string, HTMLElement | null>>({})

  /**
   * 열린 시트가 항상 보이게 — 탭이 넘쳐 가로로 흐를 때(400px 분할 열) 활성 탭이 스크롤
   * 밖에 있으면 "지금 어느 시트인지" 가 화면에서 사라진다. 시트를 지워 이웃으로 옮겨갈
   * 때도 같은 일이 난다. `nearest` 라 이미 보이면 아무 것도 움직이지 않는다.
   */
  useEffect(() => {
    tabRefs.current[activeId]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  /**
   * 좌우 화살표로 시트를 옮긴다 (WAI-ARIA tabs — 자동 활성화).
   * 포커스도 같이 옮겨야 다음 화살표가 이어진다 (roving tabindex).
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (renamingId) return // 이름 편집 중엔 입력이 화살표를 쓴다
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    const idx = sheets.findIndex((s) => s.id === activeId)
    if (idx < 0) return
    const next = sheets[(idx + dir + sheets.length) % sheets.length]
    if (!next || next.id === activeId) return
    e.preventDefault()
    onSelect(next.id)
    // 리렌더 뒤에 포커스 — 같은 프레임에선 아직 tabIndex 가 옮겨지지 않았다
    requestAnimationFrame(() => tabRefs.current[next.id]?.focus())
  }

  return (
    <div
      /* 탭 줄이 넘치면 가로로 흐른다 (400px 분할 열·모바일). 뒤 페이지로 스크롤이 새지 않게 contain 은 가로축만 —
         세로까지 contain 하면 탭 줄 위에서 페이지 휠이 통째로 먹힌다 (2026-08-19 실측: scrollY 무반응) */
      /* 🔴 pb-px -mb-px: 탭들의 -mb-px(카드 윗선 1px 겹침)가 스크롤 컨테이너 밖으로 삐져나와
         세로 1px 스크롤 여지를 만든다 — 패딩으로 상자 안에 품고, 컨테이너가 대신 1px 내려앉아 겹침 유지
         (툴바의 py-1.5 -my-1.5 와 같은 처방) */
      className="flex items-stretch gap-1 px-2 pb-px -mb-px overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        role="tablist"
        aria-label="준비 노트 시트"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="flex items-stretch gap-1"
      >
        {sheets.map((sheet) => {
          const active = sheet.id === activeId
          const renaming = renamingId === sheet.id

          if (renaming) {
            return (
              <SheetNameInput
                key={sheet.id}
                initial={sheet.name}
                onCommit={(name) => {
                  onRenamingChange(null)
                  if (name && name !== sheet.name) onRename(sheet.id, name)
                }}
                onCancel={() => onRenamingChange(null)}
              />
            )
          }

          return (
            /*
              🔴 탭은 `<button>` 이 아니라 `div[role="tab"]` 이다. 안에 연필·× 라는 **진짜
              버튼**이 들어가는데 button 안의 button 은 무효 마크업이고, 브라우저마다
              클릭 판정이 갈린다. 탭 목록의 의미는 role 이 그대로 지고 간다.
            */
            <div
              key={sheet.id}
              ref={(el) => {
                tabRefs.current[sheet.id] = el
              }}
              role="tab"
              id={`sheet-tab-${sheet.id}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(sheet.id)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                onSelect(sheet.id)
              }}
              /* 데스크탑 보너스 — 엑셀 그대로. 모바일 주 경로는 연필이다 */
              onDoubleClick={() => active && onRenamingChange(sheet.id)}
              title={sheet.name}
              className={`${TAB_BASE} ${active ? TAB_ON : TAB_OFF}`}
            >
              <span className="max-w-[10rem] truncate">{sheet.name}</span>

              {active && (
                <button
                  type="button"
                  aria-label={`'${sheet.name}' 시트 이름 바꾸기`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRenamingChange(sheet.id)
                  }}
                  className={MICRO}
                >
                  <PencilIcon />
                </button>
              )}

              {/* 🔴 마지막 1장에는 ×를 두지 않는다 — 눌러 봐야 서버가 막는 버튼은 거짓말이다 */}
              {active && canDelete && (
                <button
                  type="button"
                  aria-label={`'${sheet.name}' 시트 삭제`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(sheet.id)
                  }}
                  className={`${MICRO} hover:text-danger`}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={atCap || adding}
        aria-label="시트 추가"
        title={atCap ? '시트는 10장까지예요' : '시트 추가'}
        /* 점선 = 시트가 아니라 동작 (칩 피커 [더보기] 와 같은 문법) */
        className={`-mb-px ${SCROLL_CLEAR} shrink-0 inline-flex items-center justify-center min-h-9 w-9 rounded-t-lg border border-b-0 border-dashed border-line text-text-quaternary hover:text-text-secondary hover:border-line-strong disabled:opacity-40 disabled:hover:text-text-quaternary disabled:hover:border-line disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

/**
 * 인라인 이름 입력.
 *
 * - Enter 확정 · ESC 취소 · blur 확정 (엑셀과 같다)
 * - 🔴 ESC 는 blur 보다 먼저 도착하고 그 blur 가 다시 확정을 부른다 — 취소 플래그로 막는다
 * - 🔴 한글 조합 중의 Enter 는 **글자 확정**이지 이름 확정이 아니다 (`isComposing`)
 * - 모바일 16px(`text-base`) — 미만이면 iOS 사파리가 포커스에서 화면을 확대한다
 */
function SheetNameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const cancelledRef = useRef(false)

  return (
    <input
      // eslint-disable-next-line chwippo/no-bare-autofocus -- 시트 탭 「이름 바꾸기」를 눌러야 탭이 이 입력으로 바뀐다 — 탭 뒤 등장
      autoFocus
      value={value}
      maxLength={NAME_MAX}
      aria-label="시트 이름"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          e.currentTarget.blur() // blur 핸들러가 확정한다 (경로 하나)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation() // 모달·시트가 같이 닫히지 않게
          cancelledRef.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        if (cancelledRef.current) {
          onCancel()
          return
        }
        /* 공백만 남기면 서버가 400 이다 — 되돌리는 게 사용자가 기대하는 결과다 */
        onCommit(value.trim())
      }}
      /* autoFocus 가 브라우저 스크롤을 부른다 — 헤더 밑으로 들어가면 고치는 칸이 안 보인다 */
      className={`-mb-px ${SCROLL_CLEAR} shrink-0 w-32 min-h-9 px-2 rounded-t-lg border border-b-0 border-brand/60 bg-input text-base sm:text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand/60`}
    />
  )
}
