import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
  /**
   * 제목을 **스크린리더에만** 남기고 헤더 바를 비운다 (닫기 버튼만 남는다).
   *
   * 🔴 `title` 을 빈 문자열로 넘기는 우회를 막으려고 만들었다 — 그러면 `aria-label` 이
   * 비어 접근성이 깨진다. 제목을 본문 안에서 직접 그리는 모달(아이콘 옆 라벨 등)에만 쓴다.
   */
  titleHidden?: boolean
}

export function Modal({ open, onClose, title, children, width = 'max-w-sm', titleHidden = false }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // U14 — ESC 닫기. 리스너는 document bubble 단계 → 안쪽 요소(인라인 에디터·오토컴플리트)나
  // document capture 단계 소비자(JobPostingModal 닫기 확인)가 preventDefault 로 선점 가능.
  // 처리 후 스스로도 preventDefault → 모달이 겹쳐 열려도 ESC 1번에 1개만 닫힌다.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      /*
        🔴 모바일(sm 미만)은 **바닥에 붙는 바텀시트**다. 예전엔 컨테이너에 `safe-area + 4rem` 하단 여백을 줘서
        시트를 탭바 위에 띄웠는데, 오버레이가 탭바를 이미 어둡게 덮고 있어 시트와 탭바 사이에
        **검은 띠**만 남았다 (2026-08-30 iPhone 실기 — 지원 예정·지원 중·공고 모드 전부). 여백을 없애고
        z 를 탭바(z-50) 위로 올려 시트가 바닥까지 내려온다. 홈 인디케이터 여백은 본문의
        `pb-[max(1.25rem,env(safe-area-inset-bottom))]` 이 진다.
      */
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative bg-surface border border-line rounded-t-2xl sm:rounded-xl shadow-2xl w-full ${width} max-h-[85dvh] sm:max-h-[calc(100vh-4rem)] flex flex-col animate-fadeInUp`}
        onClick={(e) => e.stopPropagation()}
      >
        {/*
          🔴 `titleHidden` 이면 **헤더 박스 자체를 없앤다.**
          `sr-only` 제목은 자리를 안 차지하는데 헤더 패딩(`pt-5`)은 남아,
          본문 `p-5` 와 겹쳐 **아이콘 위에 죽은 공간 ~72px** 이 생겼다.
          닫기 버튼만 우상단에 띄우면 그 공간이 사라진다.
        */}
        {/*
          🔴 **닫기 버튼 히트 영역 44px** (2026-08-17 `/uiux`).
          보이는 상자는 32px 그대로 두고 `before:-inset-1.5`(각 변 +6px)로 **터치 영역만** 넓힌다.
          `w-11 h-11` 로 키우면 헤더가 12px 자라 **모든 모달의 세로 배치가 밀린다** —
          접근성 하나 고치려고 앱 전역 레이아웃을 움직일 이유가 없다.
          (DESIGN.md 「터치 타겟」 44px 기준 · 시각 규격은 변경 없음)
        */}
        {titleHidden ? (
          <>
            <h2 className="sr-only">{title}</h2>
            <button
              onClick={onClose}
              aria-label="닫기"
              /* 포커스 링은 헤더 분기와 **같은 규격**이어야 한다 — `ring-offset` 이 빠지면
                 같은 버튼이 위치에 따라 다르게 보인다 */
              /* 🔴 여기엔 `relative` 를 붙이지 않는다 — `absolute` 와 같은 `position` 속성이라
                 **뒤에 오는 `.relative` 규칙이 이겨서 버튼이 제자리를 벗어난다**
                 (실측: 패널 높이 276 → 308px, X 가 흐름 안으로 들어옴).
                 `absolute` 자체가 이미 positioned 라 `::before` 의 기준이 되어 준다. */
              className="absolute top-3 right-3 z-10 w-8 h-8 before:absolute before:-inset-1.5 before:content-[''] flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
            <h2 className="text-text-primary font-semibold text-sm">{title}</h2>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="w-8 h-8 relative before:absolute before:-inset-1.5 before:content-[''] flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">{children}</div>
      </div>
    </div>
  )
}
