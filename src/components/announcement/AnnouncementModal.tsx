import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnnouncementKindChip } from './AnnouncementKindChip'
import type { AnnouncementKind } from '@/types/announcement'

interface Props {
  title: string
  body: string
  kind: AnnouncementKind
  /** 「지금 해보기」 버튼 글자 — 경로와 짝이다. 한쪽만 오면 CTA 를 안 그린다 */
  ctaLabel?: string | null
  /** 앱 내부 경로 (`/` 로 시작) */
  ctaPath?: string | null
  onDismiss: () => void
}

/** 본문 한 덩어리 — 문단 아니면 목록 */
type Block = { type: 'p'; text: string } | { type: 'ul'; items: string[] }

/**
 * 관리자가 친 평문을 문단·목록으로 나눈다.
 *
 * 🔴 **HTML 은 해석하지 않는다.** 나오는 글자는 전부 텍스트 노드다 — 공지 본문은 admin 이
 * 쓰지만 그렇다고 마크업을 그대로 실행할 이유가 없다(계정 하나가 뚫리면 전 사용자 화면이다).
 * 그래서 지원하는 문법은 딱 둘: 빈 줄 = 문단 나눔, `- ` 로 시작하는 줄 = 목록 항목.
 */
function parseAnnouncementBody(body: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let items: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') })
    para = []
  }
  const flushList = () => {
    if (items.length) blocks.push({ type: 'ul', items })
    items = []
  }

  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('- ')) {
      flushPara()
      items.push(line.slice(2).trim())
      continue
    }
    flushList()
    if (!line) {
      flushPara()
      continue
    }
    para.push(line)
  }
  flushList()
  flushPara()
  return blocks
}

export function AnnouncementModal({ title, body, kind, ctaLabel, ctaPath, onDismiss }: Props) {
  const navigate = useNavigate()

  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // eslint-disable-next-line chwippo/no-bare-autofocus -- 입력 칸이 아니라 **대화상자 div** 에 주는 포커스다 (스크린리더 진입점) — 키보드가 안 올라온다
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const hasCta = !!ctaPath && !!ctaLabel
  const blocks = parseAnnouncementBody(body)
  /*
    짧은 한 줄은 가운데가 「발표」처럼 읽혀 낫지만, 길어지면 가운데 정렬은 줄마다 시작점이
    달라져서 눈이 매번 왼쪽 끝을 찾는다. 두 줄 이상 · 40자 초과부터 왼쪽으로 내린다.
  */
  const isLong = body.length > 40 || body.trim().includes('\n')

  const handleCta = () => {
    navigate(ctaPath!)
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        tabIndex={-1}
        // 열릴 때 포커스는 **대화상자 자체**로 — 버튼에 autoFocus 를 주면 focus-visible 링이 열리자마자
        // 떠서 터치 사용자에게 「왜 테두리가 있지」가 된다. 대화상자에 두면 스크린리더는 제목을 읽고,
        // Tab 한 번이면 주 버튼(링 표시)으로 간다
        className="bg-surface border border-line rounded-2xl w-full max-w-sm overflow-hidden outline-none"
      >
        {/* 상단 brand 바 */}
        <div className="h-1 bg-brand w-full" />

        {/* 아이콘 + 종류 + 제목 */}
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mb-3">
            <MegaphoneIcon />
          </div>
          {/* 칩이 없는 「안내」에선 이 줄이 통째로 사라진다 — 여백도 같이 사라져야 한다 */}
          <AnnouncementKindChip kind={kind} className="mb-2" />
          <h2
            id="announcement-modal-title"
            className="text-[15px] font-bold text-text-primary leading-snug break-keep"
          >
            {title}
          </h2>
        </div>

        {/* 구분선 + 본문 + 버튼 */}
        <div className="border-t border-line px-6 pt-5 pb-6 flex flex-col gap-5">
          {/* 🔴 overscroll-contain — 본문 끝에서 계속 밀면 뒤 페이지가 따라 움직인다 */}
          <div
            className={`max-h-[35vh] overflow-y-auto overscroll-contain flex flex-col gap-2.5 ${
              isLong ? 'text-left' : 'text-center'
            }`}
          >
            {blocks.map((block, i) =>
              block.type === 'ul' ? (
                <ul key={i} className="flex flex-col gap-1 pl-4 list-disc marker:text-text-quaternary">
                  {block.items.map((item, j) => (
                    <li key={j} className="text-sm text-text-secondary leading-relaxed break-keep">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  key={i}
                  className="text-sm text-text-secondary leading-relaxed whitespace-pre-line break-keep"
                >
                  {block.text}
                </p>
              ),
            )}
          </div>

          {hasCta ? (
            /*
              CTA 가 있으면 「확인했어요」는 사라진다 — 세 갈래로 늘리면 「지금 해보기」가
              선택지 중 하나로 묽어진다. 가로가 아니라 세로로 쌓는 이유는 라벨(최대 30자)이
              길 수 있어서다.
            */
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCta}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-brand text-bg text-sm font-semibold hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {ctaLabel}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                // 🔴 보조 버튼은 **글자 버튼** — `bg-card` 상자는 모달 면 위에서 1.06:1 이라 보이지도 않으면서
                //    주 버튼과 같은 덩치로 서 있었다(2026-08-30 실측). 주=채움 · 부=글자가 위계를 만든다 (토스 「나중에」)
                className="w-full min-h-[44px] py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                나중에
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-brand text-bg text-sm font-semibold hover:bg-accent active:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              확인했어요
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-bg" aria-hidden="true">
      <path d="M13 2L3 6H1a1 1 0 00-1 1v2a1 1 0 001 1h2l10 4V2z" />
      <path d="M3 9v4" />
    </svg>
  )
}
