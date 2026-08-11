import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PracticeSettings } from '@/components/card/PracticeSettings'
import { PracticeSession } from '@/components/card/PracticeSession'
import type { PracticeTally } from '@/components/card/PracticeSession'
import {
  useInterviewPrepQuestions,
  useInterviewPrepSession,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import { buildExamQuestions } from '@/utils/practiceExam'
import type { ExamSettings } from '@/utils/practiceExam'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * 「면접 보기」 — 연습 루프 페이지 (질문 은행 D3).
 *
 * 라우트: `/interviews/:sessionId/practice` (+데모). **뒤로가기가 곧 종료**라 세션 화면과
 * 나란한 별도 주소로 둔다 — 모달이면 뒤로가기가 앱을 나가 버리고, 폰에서 그건 사고다.
 */
const PAGE = 'w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9'

export function InterviewPracticePage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  /**
   * 🔴 세션으로 돌아가는 길을 **주소에서 깎아 만든다.** `to=".."` 는 URL 이 아니라 **라우트
   * 계층** 기준이라, 이 페이지가 `interviews/:sessionId/practice` 한 줄짜리 라우트인 이상
   * 부모는 세션이 아니라 레이아웃이다 (= 홈으로 튄다). 데모(`/demo/...`) 접두도 이 방식이라야 산다.
   */
  const sessionPath = useLocation().pathname.replace(/\/practice\/?$/, '')

  const {
    data: session,
    isLoading: sessionLoading,
    isError: sessionError,
  } = useInterviewPrepSession(sessionId)
  const {
    data: questions = [],
    isLoading: questionsLoading,
    isError: questionsError,
  } = useInterviewPrepQuestions(sessionId)

  /**
   * 시작한 시험. **순서는 시작 시 고정**이다 — 연습 중 자동저장·refetch 로 목록이 바뀌어도
   * 문항 순서가 흔들리면 "몇 번째까지 했는지" 가 무너진다 (계획 §3-B).
   */
  const [exam, setExam] = useState<{
    settings: ExamSettings
    questions: InterviewPrepQuestion[]
  } | null>(null)
  /** 루프가 끝난 결과. `null` = 아직 도는 중 (설정 → 루프 → 요약 세 단계가 이 둘로 갈린다) */
  const [tally, setTally] = useState<PracticeTally | null>(null)

  /**
   * 🔴 **연습 중에 세션이 사라지면 나갈 문이 없다** (계획 §6.3). 채점 404 는 문항 하나가
   * 지워진 것이라 조용히 넘기지만, 세션 자체가 없어지면 남은 문항 전부가 유령이다.
   * 다른 기기·탭에서 지웠을 때 이 화면이 그걸 아는 유일한 경로가 세션 쿼리의 error 다
   * (`refetchOnWindowFocus` 로 돌아올 때 잡힌다).
   *
   * 시작 전(`exam === null`)은 아래 에러 화면이 맡는다 — 그쪽은 「다시 시도」가 있어야 하고,
   * 조회 한 번 실패했다고 화면 밖으로 밀어내면 안 된다.
   */
  useEffect(() => {
    if (!exam || !sessionError) return
    toast.error('세션이 삭제됐어요.')
    navigate('/interviews', { replace: true })
  }, [exam, sessionError, navigate])

  if (sessionLoading || questionsLoading) {
    return (
      <div className={PAGE}>
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="h-10 bg-surface-2 border border-line rounded-xl animate-pulse" />
          <div className="h-80 bg-surface-2 border border-line rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  /* 로딩과 실패를 갈라야 한다 — 실패는 `isLoading=false · data=undefined` 라
     한 조건으로 묶으면 영원한 로딩 화면이 된다 (`InterviewSessionPage` 와 같은 이유) */
  if (!session || sessionError || questionsError) {
    return (
      <div className={PAGE}>
        <div className="max-w-2xl mx-auto border border-line bg-surface-2 rounded-xl px-5 py-10 text-center">
          <p className="text-text-primary text-sm font-semibold mb-1.5">
            면접 보기를 시작할 수 없어요
          </p>
          <p className="text-text-tertiary text-xs leading-relaxed mb-5">
            {sessionError
              ? '삭제됐거나 접근할 수 없는 세션일 수 있어요.'
              : '질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-medium text-text-secondary border border-line hover:border-line-strong px-4 py-3 rounded-lg transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => navigate('/interviews')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
            >
              면접 준비 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 시험이 시작되면 **페이지 머리말을 걷는다.** 세션 이름과 「면접 보기」 제목은 시작 전에
   * 필요한 정보고, 루프에선 폰 화면 높이를 먹으면서 질문을 밀어낸다. 나가는 길은 없어지지
   * 않는다 — 루프는 X, 요약은 CTA 세 개가 각각 쥔다.
   */
  if (exam) {
    return (
      <div className={PAGE}>
        {tally ? (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-text-primary text-2xl font-bold">연습 끝!</h1>
            <p className="text-text-tertiary text-xs mt-1.5">
              총{' '}
              <span className="font-mono tabular-nums text-text-secondary font-semibold">
                {exam.questions.length}
              </span>
              개
            </p>

            <div className="grid grid-cols-3 gap-2 mt-6">
              {(
                [
                  ['잘함', tally.good, 'text-success'],
                  ['애매', tally.soso, 'text-warning'],
                  ['다시', tally.again, 'text-danger'],
                ] as const
              ).map(([label, n, tone]) => (
                <div
                  key={label}
                  className="bg-surface-2 border border-line rounded-xl py-4"
                >
                  <p
                    className={`font-mono tabular-nums text-2xl font-bold ${tone}`}
                  >
                    {n}
                  </p>
                  <p className="text-[11px] text-text-tertiary mt-1">{label}</p>
                </div>
              ))}
            </div>
            {tally.skipped > 0 && (
              <p className="text-text-quaternary text-xs mt-3">
                건너뛴 문항{' '}
                <span className="font-mono tabular-nums">{tally.skipped}</span>개
              </p>
            )}

            <div className="mt-7 space-y-2">
              {tally.again > 0 && (
                /*
                  🔴 **서버에 다시 묻지 않는다.** 방금 「다시」로 찍은 그 문항들을 이번 시험
                  순서 그대로 돌린다 — 저장이 실패했을 수도 있고, 성공했어도 재조회는
                  그 사이 바뀐 목록을 끌고 온다.
                */
                <button
                  type="button"
                  onClick={() => {
                    setExam({
                      settings: exam.settings,
                      questions: exam.questions.filter((q) =>
                        tally.againIds.includes(q.id),
                      ),
                    })
                    setTally(null)
                  }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 w-full min-h-[48px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-5 rounded-md transition-colors"
                >
                  다시 볼 것만 한 번 더 ({tally.again}개)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setExam(null)
                  setTally(null)
                }}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 w-full min-h-[48px] text-sm font-medium text-text-secondary border border-line hover:border-line-strong rounded-md transition-colors"
              >
                설정 다시 하기
              </button>
              <Link
                to={sessionPath}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 flex items-center justify-center w-full min-h-[44px] text-xs text-text-tertiary hover:text-text-primary rounded-md transition-colors"
              >
                세션으로 돌아가기
              </Link>
            </div>
          </div>
        ) : (
          <PracticeSession
            questions={exam.questions}
            timer={exam.settings.timer}
            onFinish={setTally}
            onExit={() => setExam(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={PAGE}>
      <div className="max-w-2xl mx-auto">
        <header className="mb-5 space-y-2">
          <div className="text-xs text-text-tertiary">
            <Link
              to={sessionPath}
              className="hover:text-text-primary transition-colors"
            >
              ← 세션으로
            </Link>
            <span className="text-text-quaternary mx-2">·</span>
            <span>{session.round}</span>
          </div>
          <h1 className="text-text-primary text-2xl font-bold">면접 보기</h1>
        </header>

        {questions.length === 0 ? (
          /* 빈 상태 — 여기서 할 수 있는 일이 없다. 질문을 모으는 자리로 데려간다 */
          <div className="border border-line bg-surface-2 rounded-xl px-5 py-10 text-center">
            <p className="text-text-primary text-sm font-semibold mb-1.5">
              아직 볼 질문이 없어요
            </p>
            <p className="text-text-tertiary text-xs leading-relaxed mb-5">
              받았던 기출을 적어 두거나 AI 로 만들면 바로 시험을 볼 수 있어요.
            </p>
            <Link
              to={sessionPath}
              className="inline-flex items-center justify-center min-h-[44px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-5 rounded-md transition-colors"
            >
              질문 추가하러 가기
            </Link>
          </div>
        ) : (
          <PracticeSettings
            questions={questions}
            onStart={(settings) =>
              setExam({
                settings,
                questions: buildExamQuestions(questions, settings),
              })
            }
          />
        )}
      </div>
    </div>
  )
}
