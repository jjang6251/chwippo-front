import { useEffect, useRef, useState } from 'react'
import {
  Building2,
  Calendar,
  MapPin,
  PenLine,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import {
  useCompanyResearch,
  useUpdateUserResearchNotes,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import type { InterviewKeyword, ResearchSource } from '@/types/interviewPrep'

interface Props {
  sessionId: string
  /** session 의 userResearchNotes (read 용) */
  userNotes: string | null
  /**
   * `회사 정보` 접힘 카드의 초기 상태. 기본 펼침.
   *
   * `세션 자료` 모달은 **자료를 고치는 곳**이라 `false` 로 넘긴다 — AI 조사 8항목이
   * 펼쳐져 있으면 정작 편집할 입력란이 스크롤 아래로 밀린다. 사이드바는 **읽는 곳**이라
   * 기본값(펼침)을 그대로 쓴다. `내가 알아본 정보` 는 직접 쓰는 칸이라 접지 않는다.
   */
  defaultExpanded?: boolean
}

/**
 * F6 PR 2 Phase 4 단계 B+UX — 회사 조사 메타카드.
 *
 * **레퍼런스 패턴 적용**:
 * - **Notion + LinkedIn 하이브리드 collapsible** — 카드 전체 토글 (chevron 좌측)
 *   default 펼침 시 핵심 3 (사업·인재상·최근동향) + "더 보기" 로 나머지 5 + 출처 별도 토글
 * - **Perplexity 식 출처 chip** — favicon + 도메인 (full URL X, 클릭 시 새 탭)
 * - **primary 위계** — bg-brand/5 + border-brand/20 (회사 정보 = 가장 중요)
 *
 * **법적·UX 안전장치**:
 * - 상단 ⚠️ 빨간 alert "AI 가 잘못된 정보 안내 가능"
 * - 출처 명시 + 클릭 시 원본 이동 (transformative use 강화)
 * - AI 정보 read-only — 사용자 수정은 별도 "내가 알아본 정보" 카드
 */
export function CompanyResearchCard({
  sessionId,
  userNotes,
  defaultExpanded = true,
}: Props) {
  const { data: research, isLoading } = useCompanyResearch(sessionId)
  const [cardExpanded, setCardExpanded] = useState(defaultExpanded) // 카드 전체 toggle
  const [showMore, setShowMore] = useState(false) // "더 보기" — 나머지 5 항목
  const [showSources, setShowSources] = useState(false) // 출처 토글 (default 접힘)
  /**
   * `내가 알아본 정보` 인라인 편집 — 1.5초 debounce 자동 저장.
   * 질문 카드의 `내 답변 메모` 와 같은 패턴이다.
   *
   * 🔴 `userNotes` 가 서버에서 갱신되면 draft 를 다시 맞춘다. 안 그러면 다른 화면
   * (사이드바 ↔ 세션 자료 모달)에서 고친 내용이 서로 덮어쓴다 — 같은 카드가 두 곳에 뜬다.
   */
  const [notesDraft, setNotesDraft] = useState(userNotes ?? '')
  const { mutate: saveNotes, isPending: savingNotes } =
    useUpdateUserResearchNotes(sessionId)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 저장 안 된 편집이 남아 있는 동안엔 서버값 동기화를 막는다 (아래 effect 참고) */
  const notesDirty = useRef(false)

  useEffect(() => {
    // 🔴 내가 방금 친 글자를 서버 응답이 되돌리면 입력이 통째로 사라진다.
    //    debounce 1.5초 + 왕복 시간 동안 계속 타이핑하면 실제로 발생한다.
    if (notesDirty.current) return
    setNotesDraft(userNotes ?? '')
  }, [userNotes])

  /** debounce 대기 중인 저장을 즉시 실행 — 언마운트 시 유실 방지용 */
  const flushNotes = useRef<(() => void) | null>(null)
  useEffect(() => {
    // 🔴 적자마자 모달을 닫으면(1.5초 안) debounce 가 안 터져서 메모가 통째로 날아간다.
    //    타이머를 지우기만 하면 안 되고, 대기 중이던 저장을 흘려보내야 한다.
    return () => flushNotes.current?.()
  }, [])

  const handleNotesChange = (val: string) => {
    setNotesDraft(val)
    notesDirty.current = true
    if (notesTimer.current) clearTimeout(notesTimer.current)

    const commit = () => {
      notesTimer.current = null
      flushNotes.current = null
      saveNotes(val.trim() || null, {
        onSuccess: () => {
          notesDirty.current = false
        },
        onError: () => toast.error('메모 저장에 실패했습니다.'),
      })
    }
    flushNotes.current = () => {
      if (notesTimer.current) clearTimeout(notesTimer.current)
      commit()
    }
    notesTimer.current = setTimeout(commit, 1500)
  }


  return (
    /*
     * 🔴 두 카드를 fragment 로 내보내면 간격이 **부모마다 달라진다.**
     * 사이드바는 `space-y-2.5` 라 떨어져 보였지만 `세션 자료` 모달에선 맞붙어
     * 하나의 카드처럼 읽혔다. 간격은 이 컴포넌트가 책임진다.
     */
    <div className="space-y-2.5">
      {/* 🏢 회사 정보 — primary 위계 (bg-brand/5 + border-brand/20) */}
      <div className="border border-brand/20 bg-brand/5 rounded-lg overflow-hidden">
        {/* 카드 헤더 — chevron 좌측 (Notion 패턴), 전체 클릭으로 토글 */}
        <button
          onClick={() => setCardExpanded(!cardExpanded)}
          aria-expanded={cardExpanded}
          aria-label={cardExpanded ? '회사 정보 접기' : '회사 정보 펼치기'}
          className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-brand/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CollapsibleChevron open={cardExpanded} />
            <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Building2 size={14} strokeWidth={1.75} aria-hidden="true" />
              회사 정보
            </h3>
          </div>
          {research?.status === 'ok' && (
            <span className="text-text-faint text-[10px]">
              {research.isCached ? '캐시' : '방금'}
            </span>
          )}
        </button>

        {cardExpanded && (
          <div className="px-3.5 pb-3.5 pt-1">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-3 bg-surface-3 rounded animate-pulse"
                    style={{ width: `${80 - i * 15}%` }}
                  />
                ))}
              </div>
            ) : !research ? (
              <div className="bg-surface border border-line rounded-md p-2.5">
                <p className="text-text-tertiary text-xs leading-relaxed">
                  아직 이 회사의 조사 자료가 준비되지 않았어요. 인기 기업부터
                  순차적으로 제공하고 있어요 — 준비되면 자동으로 표시됩니다.
                </p>
              </div>
            ) : research.status === 'opt_out' ? (
              <div className="bg-warning/5 border border-warning/20 rounded-md p-2.5">
                <p className="text-warning text-xs leading-relaxed">
                  <span className="inline-flex items-center gap-1">
                    <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                    이 회사는 정보 수집 동의가 철회됐어요. 직접 회사 홈페이지를
                    확인해 주세요.
                  </span>
                </p>
              </div>
            ) : research.status === 'blocked' ? (
              <div className="bg-danger/5 border border-danger/20 rounded-md p-2.5">
                <p className="text-danger text-xs leading-relaxed">
                  {research.reason}
                </p>
              </div>
            ) : research.research ? (
              <>
                {/* PR 보강 #1 — Hero header (companyProfile 메타칩 항상 표시) */}
                <ResearchHeroHeader
                  profile={research.research.companyProfile}
                />

                {/* ⚠️ AI 경고 alert */}
                <div className="bg-danger/5 border border-danger/20 rounded-md p-2.5 mb-3">
                  <p className="text-danger text-[11px] leading-relaxed">
                    <span className="inline-flex items-center gap-1">
                      <TriangleAlert size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                      AI 가 잘못된 정보를 안내할 수 있어요.
                    </span>
                    <br />
                    <strong>면접 전 공식 출처로 반드시 확인하세요.</strong>
                  </p>
                </div>

                {/* 핵심 3 — default 펼침 */}
                {(() => {
                  const inferred = new Set(research.research.inferredFields ?? [])
                  const srcs = research.research.sources ?? research.sources
                  return (
                    <>
                      <ResearchSection
                        label="사업 영역"
                        value={research.research.businessSummary}
                        sources={srcs}
                        isInferred={inferred.has('businessSummary')}
                      />
                      <ResearchSection
                        label="인재상·핵심가치"
                        value={research.research.coreValues}
                        sources={srcs}
                        isInferred={inferred.has('coreValues')}
                      />
                      <ResearchSection
                        label="최근 동향·신사업"
                        value={research.research.recentTrends}
                        sources={srcs}
                        isInferred={inferred.has('recentTrends')}
                      />
                    </>
                  )
                })()}

                {/* "더 보기" — 나머지 5 항목 */}
                <button
                  onClick={() => setShowMore(!showMore)}
                  aria-expanded={showMore}
                  className="text-brand hover:text-brand-hover text-[11px] font-medium mb-2"
                >
                  {showMore ? '− 접기' : '+ 더 보기 (5)'}
                </button>

                {showMore && (
                  <div className="border-t border-brand/20 pt-2.5 mt-1">
                    {(() => {
                      const inferred = new Set(
                        research.research?.inferredFields ?? [],
                      )
                      const srcs =
                        research.research?.sources ?? research.sources
                      return (
                        <>
                          <ResearchSection
                            label="비전·미션"
                            value={research.research!.visionMission}
                            sources={srcs}
                            isInferred={inferred.has('visionMission')}
                          />
                          <ResearchSection
                            label="재무·매출"
                            value={research.research!.financials}
                            sources={srcs}
                            isInferred={inferred.has('financials')}
                          />
                          <ResearchSection
                            label="경쟁사·시장"
                            value={research.research!.competitors}
                            sources={srcs}
                            isInferred={inferred.has('competitors')}
                          />
                          <ResearchSection
                            label="직무 정보"
                            value={research.research!.jobInsights}
                            sources={srcs}
                            isInferred={inferred.has('jobInsights')}
                          />
                          {/* PR 보강 신규 3 항목 */}
                          <ResearchTalentProfile
                            values={research.research!.talentProfile ?? []}
                          />
                          <ResearchProductsAndTech
                            data={research.research!.productsAndTech}
                          />
                          <ResearchKeywords
                            keywords={
                              research.research!.interviewKeywords ?? []
                            }
                          />
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* 출처 (Perplexity 식 chip + 별도 토글) */}
                {research.sources && research.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-brand/20">
                    <button
                      onClick={() => setShowSources(!showSources)}
                      aria-expanded={showSources}
                      aria-label={
                        showSources
                          ? `출처 ${research.sources.length}개 접기`
                          : `출처 ${research.sources.length}개 펼치기`
                      }
                      className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-[11px] font-semibold py-1.5 -mx-1 px-1 rounded hover:bg-surface-3/50"
                    >
                      <CollapsibleChevron open={showSources} />
                      출처 ({research.sources.length})
                    </button>
                    {showSources && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {research.sources.map((s, i) => {
                          // PR 보강 — ResearchSource (객체) / string 양쪽 호환
                          const url = typeof s === 'string' ? s : s.url
                          return <SourceChip key={`${url}-${i}`} url={url} />
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/*
        📝 내가 알아본 정보 — **바로 쓴다** (2026-08-06).

        이전엔 `편집` 버튼 → 별도 모달이었는데 두 가지가 문제였다:
        ① 한 번 더 눌러야 해서 짧은 메모를 남기는 마찰이 컸다
        ② 이 카드가 `세션 자료` 모달 안에도 들어가면서 **모달 위에 모달**이 뜬다

        저장은 질문 카드의 `내 답변 메모` 와 같은 1.5초 debounce 자동 저장이다.
      */}
      <div className="border border-line bg-surface-2 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-line/50">
          <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
            <PenLine size={14} strokeWidth={1.75} aria-hidden="true" />
            내가 알아본 정보
          </h3>
          <span
            className="text-text-faint text-[10px] shrink-0"
            aria-live="polite"
          >
            {savingNotes ? '저장 중…' : '자동 저장'}
          </span>
        </div>
        <div className="px-3.5 py-3 space-y-2">
          {/* AI 오류 정정이 이 메모의 목적이라 안내를 입력란 위에 남긴다 */}
          <p className="text-danger text-[11px] leading-relaxed">
            <span className="inline-flex items-center gap-1">
              <TriangleAlert
                size={13}
                strokeWidth={1.75}
                aria-hidden="true"
                className="shrink-0"
              />
              <strong>AI 가 잘못된 정보를 안내할 수 있어요.</strong>
            </span>{' '}
            잘못된 부분은 여기에 정정 내용을 적어 주세요. 면접 전 회사 공식
            홈페이지·공시·뉴스로 반드시 확인하세요.
          </p>
          <textarea
            // 시각적 라벨은 위 h3("내가 알아본 정보")가 하지만 연결이 없어 스크린리더가
            // 이 입력을 무명으로 읽는다. 목적(AI 조사 정정)까지 담아 이름을 준다.
            aria-label="내가 알아본 정보 — AI 회사 조사 정정 메모"
            value={notesDraft}
            onChange={(e) => handleNotesChange(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="예: 회사 분위기는 자유로움 / 작년 면접관은 기술 깊이 위주로 물어봤음"
            className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
          />
          <p
            className={`text-[10px] text-right ${
              notesDraft.length >= 5000
                ? 'text-danger'
                : notesDraft.length >= 4500
                  ? 'text-warning'
                  : 'text-text-faint'
            }`}
          >
            {notesDraft.length} / 5000
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * PR 보강 #1 Hero header — companyProfile (설립·본사·산업·규모) 카드 최상단 메타칩.
 * 사용자 한눈에 회사 정보 스캔.
 */
function ResearchHeroHeader({
  profile,
}: {
  profile?: { founded?: string; hq?: string; industry?: string; size?: string }
}) {
  if (!profile) return null
  const fields: { icon: LucideIcon; value?: string }[] = [
    { icon: Building2, value: profile.industry },
    { icon: MapPin, value: profile.hq },
    { icon: Calendar, value: profile.founded },
    { icon: Users, value: profile.size },
  ].filter((f) => f.value?.trim())
  if (fields.length === 0) return null
  return (
    <div className="bg-surface-2 border border-line rounded-md px-3 py-2 mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
      {fields.map((f, i) => {
        const Icon = f.icon
        return (
          <div
            key={i}
            className="flex items-center gap-1 text-[11px] text-text-secondary"
          >
            <Icon size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="font-medium">{f.value}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * PR 보강 #2 footnote `[N]` → `<sup>` 변환 + hover title.
 * sources[] 의 id 매칭 시 title hover 로 출처 미리보기.
 */
function renderFootnotedText(
  text: string,
  sources: ResearchSource[] | string[] | undefined,
): React.ReactNode {
  if (!text) return null
  const sourceMap = new Map<number, ResearchSource>()
  if (Array.isArray(sources)) {
    sources.forEach((s) => {
      if (typeof s !== 'string' && s.id !== undefined) sourceMap.set(s.id, s)
    })
  }
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (!match) return <span key={i}>{part}</span>
    const id = Number(match[1])
    const src = sourceMap.get(id)
    if (!src) return <span key={i}>{part}</span>
    const tooltipText = `${src.title} (${src.domain}${src.publishedAt ? ` · ${src.publishedAt}` : ''})`
    return (
      <sup key={i} className="text-brand font-semibold text-[10px]">
        <a
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          title={tooltipText}
          aria-label={`출처 ${id} — ${tooltipText} (새 탭에서 열기)`}
          className="hover:underline"
        >
          [{id}]
        </a>
      </sup>
    )
  })
}

/**
 * PR 보강 #4 — 빈 항목 "확인하지 못했어요" 안내.
 * PR 보강 #3 — inferredFields 의 "추정" 배지.
 * PR 보강 #2 — footnote `[N]` hover preview.
 */
function ResearchSection({
  label,
  value,
  sources,
  isInferred,
}: {
  label: string
  value?: string
  sources?: ResearchSource[] | string[]
  isInferred?: boolean
}) {
  const isEmpty = !value?.trim()
  return (
    <div className="mb-2.5 last:mb-2">
      <p className="text-text-tertiary text-[11px] font-semibold mb-0.5 flex items-center gap-1.5">
        {label}
        {isInferred && (
          <span
            className="bg-warning/10 text-warning border border-warning/30 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
            title="AI 추정 — 정확성이 약할 수 있어요"
            aria-label="AI 추정 정보 — 정확성이 약할 수 있어요"
            role="note"
          >
            추정
          </span>
        )}
      </p>
      {isEmpty ? (
        <p className="text-text-quaternary text-xs italic">
          확인하지 못했어요
        </p>
      ) : (
        <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-wrap">
          {renderFootnotedText(value!, sources)}
        </p>
      )}
    </div>
  )
}

/** PR 보강 — 인재상 키워드 (회사 채용 페이지 원문) */
function ResearchTalentProfile({ values }: { values: string[] }) {
  if (values.length === 0) return null
  return (
    <div className="mb-2.5">
      <p className="text-text-tertiary text-[11px] font-semibold mb-1">
        인재상 키워드
      </p>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span
            key={v}
            className="text-[10px] font-medium bg-success/10 text-success border border-success/30 px-2 py-0.5 rounded-full"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

/** PR 보강 — 제품·기술 스택 */
function ResearchProductsAndTech({
  data,
}: {
  data?: { products?: string[]; techStack?: string[] }
}) {
  if (!data) return null
  const hasProducts = data.products && data.products.length > 0
  const hasTech = data.techStack && data.techStack.length > 0
  if (!hasProducts && !hasTech) return null
  return (
    <div className="mb-2.5">
      <p className="text-text-tertiary text-[11px] font-semibold mb-1">
        제품·기술 스택
      </p>
      {hasProducts && (
        <div className="flex flex-wrap gap-1 mb-1">
          {data.products!.map((p) => (
            <span
              key={p}
              className="text-[10px] font-medium bg-violet/10 text-violet border border-violet/30 px-2 py-0.5 rounded-full"
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {hasTech && (
        <div className="flex flex-wrap gap-1">
          {data.techStack!.map((t) => (
            <span
              key={t}
              className="text-[10px] font-medium bg-info/10 text-info border border-info/30 px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * PR 보강 — interviewKeywords 카테고리별 색상 매핑.
 * - tech: 기술·아키텍처 (파랑)
 * - talent: 인재상·문화 (초록)
 * - business: 사업·전략 (보라)
 * - role: 직무 특화 (주황)
 * - issue: 회사 이슈 (빨강)
 */
const KEYWORD_CATEGORY_STYLE: Record<string, string> = {
  tech: 'bg-info/10 text-info border-info/30',
  talent: 'bg-success/10 text-success border-success/30',
  business: 'bg-violet/10 text-violet border-violet/30',
  role: 'bg-warning/10 text-warning border-warning/30',
  issue: 'bg-danger/10 text-danger border-danger/30',
}

function ResearchKeywords({
  keywords,
}: {
  keywords: (InterviewKeyword | string)[]
}) {
  if (keywords.length === 0) return null
  return (
    <div className="mb-2.5">
      <p className="text-text-tertiary text-[11px] font-semibold mb-1">
        예상 면접 키워드
      </p>
      <div className="flex flex-wrap gap-1">
        {keywords.map((kw, i) => {
          // PR 보강 — InterviewKeyword (객체) 와 기존 string 양쪽 호환
          const isObj = typeof kw === 'object' && kw !== null
          const keyword = isObj ? kw.keyword : kw
          const category = isObj ? kw.category : null
          const style = category
            ? KEYWORD_CATEGORY_STYLE[category]
            : 'bg-info/10 text-info border-info/30'
          return (
            <span
              key={`${keyword}-${i}`}
              className={`text-[10px] font-medium ${style} border px-2 py-0.5 rounded-full`}
            >
              {keyword}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Perplexity 식 출처 chip — favicon + domain only */
function SourceChip({ url }: { url: string }) {
  let domain: string
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    domain = url
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      // min-w-0 없이는 안쪽 truncate 가 동작하지 않는다 — 긴 도메인이 칩 밖으로 나간다
      className="inline-flex items-center gap-1 min-w-0 bg-surface border border-line hover:border-brand/40 hover:bg-surface-3 text-text-tertiary hover:text-text-primary text-[10px] px-2 py-1 rounded-md transition-colors max-w-full"
      title={url}
    >
      <img
        src={favicon}
        alt=""
        width={12}
        height={12}
        className="shrink-0"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <span className="truncate">{domain}</span>
    </a>
  )
}
