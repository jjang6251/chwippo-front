import { useState } from 'react'
import { Link } from 'react-router-dom'

const FAQ = [
  {
    q: '회사 카드를 추가하려면 어떻게 하나요?',
    a: '보드 화면 우측 상단의 + 버튼을 눌러 "지원 예정 추가" 또는 "지원 중으로 추가"를 선택하세요. 지원 예정은 회사명만, 지원 중은 회사명과 마감일을 입력하면 됩니다.',
  },
  {
    q: '스텝바의 단계를 변경하려면?',
    a: '카드 상세 페이지에서 "스텝 편집" 버튼을 누르면 단계 이름 변경, 추가, 삭제, 드래그 순서 변경이 가능합니다. 보드 카드에서 스텝 노드를 직접 클릭해 현재 단계를 업데이트할 수도 있어요.',
  },
  {
    q: '내 정보 창고의 데이터는 어디에 저장되나요?',
    a: '모든 데이터는 치뽀 서버에 안전하게 저장됩니다. 필드를 벗어날 때 자동으로 저장되니 별도로 저장 버튼을 누를 필요가 없어요.',
  },
  {
    q: '불합격한 카드는 어디서 볼 수 있나요?',
    a: '보드 화면의 필터 탭에서 "불합격"을 선택하면 불합격 카드만 모아볼 수 있습니다. 기본 뷰에서는 숨겨져 있어요.',
  },
  {
    q: '지원 서류에는 어떤 파일을 올릴 수 있나요?',
    a: '내 정보 창고 › 지원 서류에 증명사진·이력서·포트폴리오·경력기술서를 올려 두면 지원서 작성 때 그대로 씁니다(PDF·JPG·PNG, 파일당 10MB, 포트폴리오는 20MB 또는 링크). 성적증명서·졸업증명서는 학력 항목에, 어학 성적표는 어학 항목에, 자격증·상장 사본은 각 항목에 붙이면 지원 서류에 함께 모입니다.',
  },
  {
    q: 'D-day는 어떻게 계산되나요?',
    a: '마감일 기준으로 오늘과의 차이를 계산합니다. D-0이 마감 당일이며, D-1부터 빨간색, D-7까지 주황색, 그 이상은 파란색으로 표시됩니다.',
  },
]

export function Help() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <h1 className="text-xl font-bold mb-1">도움말</h1>
      <p className="text-sm text-text-tertiary mb-8">자주 묻는 질문</p>

      <div className="flex flex-col gap-2">
        {FAQ.map(({ q, a }, i) => {
          const isOpen = open === i
          return (
            <div
              key={i}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isOpen
                  ? 'bg-brand/5 border-brand/25'
                  : 'bg-surface-2 border-line hover:border-line-strong'
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isOpen ? 'bg-brand text-bg' : 'bg-card-strong text-text-tertiary'
                  }`}>
                    Q
                  </span>
                  <span className={`text-sm font-semibold ${isOpen ? 'text-brand' : 'text-text-primary'}`}>
                    {q}
                  </span>
                </div>
                <span className={`text-sm flex-shrink-0 transition-transform font-light ${isOpen ? 'rotate-45 text-brand' : 'text-text-tertiary'}`}>
                  +
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 flex gap-3">
                  <span className="text-xs font-bold w-5 h-5 rounded-full bg-success/15 text-success flex items-center justify-center flex-shrink-0 mt-0.5">
                    A
                  </span>
                  <p className="text-sm text-text-secondary leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/*
        앱 소개 다시 보기 — 투어의 **두 번째이자 마지막 진입점**이다
        (첫 번째는 온보딩 직후 경로). 기존 사용자에게 자동으로 띄우지 않기로 했으므로
        (`plans/app-tour.md` §Out of Scope) 스스로 찾아올 자리가 하나는 있어야 한다.
        🔴 `?replay=1` — 저장도 부수효과도 없이 재생만 하고 여기로 되돌아온다.
      */}
      <div className="mt-8 bg-surface-2 border border-line rounded-xl p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium mb-0.5">치뽀가 처음이신가요?</p>
          <p className="text-xs text-text-tertiary">60초 만에 앱 사용법을 훑어봐요.</p>
        </div>
        <Link
          to="/signup/tour?replay=1"
          className="px-4 py-2 bg-brand/10 text-brand border border-brand/20 rounded-lg text-sm font-medium hover:bg-brand/20 active:bg-brand/30 transition-colors flex-shrink-0"
        >
          앱 소개 다시 보기
        </Link>
      </div>

      <div className="mt-4 bg-surface-2 border border-line rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium mb-0.5">원하는 답변을 찾지 못하셨나요?</p>
          <p className="text-xs text-text-tertiary">무엇이든 편하게 물어보세요.</p>
        </div>
        <Link
          to="/inquiry"
          className="px-4 py-2 bg-brand/10 text-brand border border-brand/20 rounded-lg text-sm font-medium hover:bg-brand/20 active:bg-brand/30 transition-colors flex-shrink-0"
        >
          문의하기
        </Link>
      </div>
    </div>
  )
}
