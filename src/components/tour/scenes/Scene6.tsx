import { Check, FileDown, Star } from 'lucide-react'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { StoreIllustration } from '@/components/tour/StoreIllustration'
import { usePhase } from '@/components/tour/usePhase'
import { cue, cueEach } from '@/components/tour/choreo'
import { SCENE6_PHASE_MS } from '@/components/tour/scenePhases'
import { SHOWCASE_NOTE } from '@/components/tour/showcase'

/**
 * 장면 6 — **「공부 노트에 준비를 쌓아요」**
 *
 * 한 기능을 **쓰는 모습**으로 보여준다 — 정리 글이 깔리고, 체크가 그어지고, 형광이 그어지고,
 * 사진이 붙는다. 체크리스트만 있으면 「할 일 목록」이지 「공부 노트」가 아니다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[6]`)
 *
 * 틀 → 제목·연결 pill → 정리 글(불릿 3) → 체크리스트 4줄 → **체크 2개가 그어짐(핵심·상태)**
 * → 형광 한 줄 → 사진 → PDF → 제목 → 설명.
 *
 * 🔴 **실제 이미지는 없다** — 인라인 SVG 일러스트다. 외부 이미지는 금지고, 회색 네모 + 라벨은
 * 「이미지 기능이 있다」는 말을 공허하게 만들었다 (CEO 실기).
 */
interface Props {
  paused?: boolean
  reduced?: boolean
}

const SCENE = 6

export function Scene6({ paused = false, reduced = false }: Props) {
  /* 🔴 바뀌는 것은 **체크가 그어지는 것** 하나뿐이다. 나머지 등장은 전부 CSS delay 다 */
  const phase = usePhase(2, SCENE6_PHASE_MS, { paused, instant: reduced })
  const checking = phase >= 1

  const doneCount = SHOWCASE_NOTE.checklist.filter(
    (c, i) => c.done || (checking && i === SHOWCASE_NOTE.checkingIndex),
  ).length

  return (
    <TourSceneLayout
      scene={6}
      tall
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto lg:grid lg:grid-cols-[190px_1fr] lg:gap-3 text-left">
          {/* 데스크탑 — 노트 목록. 노트가 여러 개 쌓인다는 사실은 목록으로만 보인다 */}
          <div
            {...cue(SCENE, 'shell', 'shell')}
            className="hidden lg:block bg-surface-2 border border-line rounded-xl p-3.5"
          >
            <p className="text-[11px] font-semibold text-text-tertiary mb-2">공부 노트</p>
            <ul className="space-y-1">
              {SHOWCASE_NOTE.noteList.map((n, i) => (
                <li
                  key={n}
                  className={`text-[12px] leading-snug break-keep px-2 py-1.5 rounded-md ${
                    i === 0 ? 'bg-card text-text-primary font-medium' : 'text-text-tertiary'
                  }`}
                >
                  {n}
                </li>
              ))}
            </ul>
          </div>

          <div
            {...cue(SCENE, 'shell', 'shell')}
            className="bg-surface-2 border border-line rounded-xl p-4 shadow-sm"
          >
            <div {...cue(SCENE, 'noteTitle')} className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-text-primary break-keep">
                {SHOWCASE_NOTE.title}
              </h3>
              <span className="text-[10px] font-medium text-info bg-info/10 border border-info/30 px-2 py-0.5 rounded-full">
                {SHOWCASE_NOTE.stepPill}
              </span>
            </div>

            {/* 예상 질문 — 데스크탑 전용. 5장에서 방금 본 질문이라 모바일에서는 반복이다 */}
            <div {...cue(SCENE, 'study')} className="mt-3 hidden lg:block">
              <p className="text-[11px] font-semibold text-text-tertiary">
                {SHOWCASE_NOTE.questionsHeading}
              </p>
              <ul className="mt-1.5 space-y-1">
                {SHOWCASE_NOTE.questions.map((q, i) => (
                  <li
                    key={q}
                    {...cueEach(SCENE, 'study', 'studyStep', i)}
                    className="flex gap-1.5"
                  >
                    <span
                      className="font-mono text-brand text-[10px] mt-[3px] shrink-0"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-secondary leading-snug break-keep line-clamp-1">
                      {q}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 🔴 정리된 공부 글 — 노트처럼 보이려면 「정의 → 항목 → 대비 표」가 있어야 한다 */}
            <div {...cue(SCENE, 'study')} className="mt-3 pt-3 border-t border-line">
              <p className="text-[12px] font-semibold text-text-primary">
                {SHOWCASE_NOTE.study.heading}
              </p>
              <ul className="mt-1.5 space-y-1">
                {SHOWCASE_NOTE.study.bullets.map((b, i) => (
                  <li
                    key={b}
                    {...cueEach(SCENE, 'study', 'studyStep', i + 1)}
                    className="text-[12px] text-text-secondary leading-snug break-keep"
                  >
                    {b}
                  </li>
                ))}
              </ul>

              {/* 미니 표 — 데스크탑 전용. 모바일에 넣으면 본문이 12px 밑으로 눌린다 */}
              <table className="hidden lg:table w-full mt-2.5 text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className="w-14" />
                    {SHOWCASE_NOTE.study.table.head.map((h) => (
                      <th
                        key={h}
                        className="text-left font-semibold text-text-tertiary border-b border-line pb-1"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHOWCASE_NOTE.study.table.rows.map((r) => (
                    <tr key={r.label}>
                      <td className="text-text-quaternary pt-1 align-top">{r.label}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="text-text-secondary pt-1 align-top">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div {...cue(SCENE, 'checklist')} className="mt-3 pt-3 border-t border-line">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold text-text-tertiary">체크리스트</p>
                <span className="ml-auto font-mono text-[10px] text-text-quaternary tabular-nums">
                  {doneCount}/{SHOWCASE_NOTE.checklist.length}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {SHOWCASE_NOTE.checklist.map((item, i) => {
                  const checked =
                    item.done || (checking && i === SHOWCASE_NOTE.checkingIndex)
                  return (
                    <li
                      key={item.label}
                      {...cueEach(SCENE, 'checklist', 'checklistStep', i)}
                      className="flex items-start gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`shrink-0 mt-px w-4 h-4 rounded border flex items-center justify-center transition-colors duration-300 ${
                          checked
                            ? 'bg-brand border-brand text-bg'
                            : 'bg-card border-line-strong'
                        }`}
                      >
                        {checked && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span
                        className={`text-[12px] leading-snug break-keep transition-colors duration-300 ${
                          checked
                            ? 'text-text-quaternary line-through'
                            : 'text-text-secondary'
                        }`}
                      >
                        {item.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* 형광 강조 — 노트에서 사람이 실제로 하는 행동 */}
            <p
              {...cue(SCENE, 'highlight', 'pop')}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-text-primary bg-warning/15 border border-warning/25 rounded-md px-2 py-1 break-keep"
            >
              <Star
                size={11}
                strokeWidth={2}
                className="text-warning shrink-0"
                aria-hidden="true"
              />
              {SHOWCASE_NOTE.highlight}
            </p>

            <figure {...cue(SCENE, 'photo', 'fade')} className="mt-3">
              <StoreIllustration className="w-[180px] lg:w-[200px] h-auto rounded-lg border border-line" />
              <figcaption className="mt-1 text-[11px] text-text-quaternary">
                {SHOWCASE_NOTE.imageCaption}
              </figcaption>
            </figure>

            <div
              {...cue(SCENE, 'pdf')}
              className="mt-3 pt-3 border-t border-line flex items-center"
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-tertiary bg-card border border-line px-2.5 py-1 rounded-md"
              >
                <FileDown size={12} strokeWidth={1.75} />
                PDF 로 내보내기
              </span>
            </div>
          </div>
        </div>
      }
      title="공부 노트에 준비를 쌓아요"
      description="단계마다 노트를 붙여 예상 질문·체크리스트·사진을 모아두고, 필요하면 PDF 로 꺼내 써요."
    />
  )
}
