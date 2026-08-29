// 데모 「샘플 공고 넣어보기」 — 고정 원문 + 고정 결과.
//
// 🔴 **백엔드 호출 0.** 데모에서 AI 를 실제로 부르면 비로그인 사용자가 우리 돈으로 모델을
// 돌리게 된다. 그렇다고 가입 모달로 막기만 하면 이 기능이 **무엇을 해주는지** 못 보여준다 —
// 「공고를 붙이면 카드가 채워진다」는 말로 설명이 안 되고 보여야 이해된다 (CEO 「ㄱㄱ」).
//
// 그래서 파싱만 흉내 내고(2초) 결과는 아래 상수로 고정한다. 날짜 5유형(확정·대략·미정·없음
// + 캘린더로 간 일정)이 전부 들어 있어야 「애매한 건 글자로」가 화면에서 보인다.
import { addDays, todayLocal } from '@/utils/datetime'
import type { Application, ApplicationStep } from '@/types/application'

const d = (offset: number) => addDays(todayLocal(), offset)
const dt = (offset: number, hourKst = 10) =>
  new Date(
    `${d(offset)}T${String(hourKst).padStart(2, '0')}:00:00+09:00`,
  ).toISOString()

/** 칩을 누르면 붙여넣기 칸에 들어가는 글 — 실제 공고 서식(모집 부문·전형 절차·날짜)을 갖췄다 */
export const DEMO_POSTING_TEXT = `[무신사] 브랜드 마케터 채용

■ 모집 부문
브랜드 마케터 (경력 3년 이상) / 1명

■ 담당 업무
- 무신사 스탠다드 브랜드 캠페인 기획·실행
- 온·오프라인 통합 마케팅 커뮤니케이션 운영
- 캠페인 성과 분석 및 리포팅
- 외부 협업사 커뮤니케이션

■ 자격 요건
- 브랜드 마케팅 실무 경력 3년 이상
- 캠페인 기획부터 집행까지 리드해 본 경험
- 데이터 기반 의사결정에 익숙하신 분

■ 우대 사항
- 패션·리테일 산업 경험
- GA4 · Amplitude 등 분석 툴 활용 가능자
- 영상·이미지 콘텐츠 제작 디렉팅 경험

■ 전형 절차
서류 접수 → 필기 전형(9월 중 예정) → 1차 면접(추후 공지) → 최종 면접
서류 합격 발표는 접수 마감 일주일 뒤, 신체검사는 최종 합격 후 별도 안내

■ 근무지
서울 성동구 아차산로`

function step(
  appId: string,
  orderIndex: number,
  name: string,
  opts: Partial<ApplicationStep> = {},
): ApplicationStep {
  return {
    id: `${appId}-s${orderIndex}`,
    applicationId: appId,
    orderIndex,
    name,
    scheduledDate: null,
    location: null,
    notes: null,
    pinnedContent: null,
    dateHint: null,
    ...opts,
  }
}

/** 캘린더로 간 일정 — 되돌리기 때 함께 지워지는 daily note 의 재료 */
export interface DemoPostingNote {
  label: string
  date: string
  /** KST 시각 — 없으면 종일 */
  hourSlot: number | null
}

export const DEMO_POSTING_NOTES: DemoPostingNote[] = [
  { label: '서류 합격 발표', date: d(24), hourSlot: null },
  { label: '신체검사', date: d(62), hourSlot: 14 },
]

/**
 * 고정 결과 카드. `noteIds` 는 데모 스토어가 실제로 만든 노트 id 로 채워 넣는다 —
 * 되돌리기(카드 삭제)에서 캘린더 일정도 같이 사라지는 걸 데모에서도 보여주기 위해서다.
 */
export function buildDemoPostingCard(
  appId: string,
  noteIds: string[],
  userId: string,
): Application {
  const now = new Date().toISOString()
  return {
    id: appId,
    userId,
    companyName: '무신사',
    jobTitle: '브랜드 마케터',
    jobCategory: '마케팅·광고',
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    createdVia: 'paste_posting',
    jobPostingStatus: null,
    jobPosting: {
      responsibilities:
        '무신사 스탠다드 브랜드 캠페인 기획·실행, 온·오프라인 통합 마케팅 커뮤니케이션 운영, 캠페인 성과 분석 및 리포팅.',
      requirements: [
        '브랜드 마케팅 실무 경력 3년 이상',
        '캠페인 기획부터 집행까지 리드해 본 경험',
        '데이터 기반 의사결정에 익숙한 분',
      ],
      preferred: [
        '패션·리테일 산업 경험',
        '영상·이미지 콘텐츠 제작 디렉팅 경험',
      ],
      techStack: ['GA4', 'Amplitude'],
      qualifications: [],
      keywords: ['브랜드 캠페인', '통합 마케팅', '성과 분석'],
      parsedAt: now,
    },
    steps: [
      // ① 확정 날짜 — 캘린더·D-day 가 붙는 유일한 유형
      step(appId, 0, '서류 접수', { scheduledDate: dt(17, 23) }),
      // ② 대략 표현 — 날짜로 바꾸지 않는다
      step(appId, 1, '필기 전형', { dateHint: '9월 중 예정' }),
      // ③ 미정
      step(appId, 2, '1차 면접', { dateHint: '추후 공지' }),
      // ④ 아무것도 없음
      step(appId, 3, '최종 합격', {}),
    ],
    postingMeta: {
      filled: ['companyName', 'jobTitle', 'deadline', 'steps', 'jobPosting'],
      deadlineKind: 'fixed',
      jobPicked: 'single',
      companySource: 'parsed',
      editedFields: [],
      reviewedAt: null,
      /*
        🔴 **서버 계약과 같은 형식**으로 둔다 — 시각 없는 일정은 `'2026-09-22'`(날짜만),
        있는 일정은 `'2026-10-30T14:00'`. 데모만 offset 을 붙여 두면 「날짜만 온 값에
        시각이 붙는」 결함이 데모에서 재현되지 않아 실기 확인을 통과해 버린다.
      */
      extraDates: DEMO_POSTING_NOTES.map((n, i) => ({
        label: n.label,
        date:
          n.hourSlot === null
            ? n.date
            : `${n.date}T${String(n.hourSlot).padStart(2, '0')}:00`,
        noteId: noteIds[i] ?? '',
      })),
      callCount: 1,
    },
    createdAt: now,
    updatedAt: now,
  }
}
