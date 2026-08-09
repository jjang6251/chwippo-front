/**
 * 랜딩이 렌더할 **실제 컴포넌트에 넘길 데이터**.
 *
 * 🔴 **왜 스크린샷을 버렸나** (2026-08-09). 이미지는 제품이 바뀌는 순간 **조용히 낡는다** —
 * 하루에만 "랜딩이 제품과 어긋난다" 를 네 번 고쳤다. 실제 컴포넌트를 쓰면 그 어긋남이
 * 원리적으로 안 생기고, 라이트/다크가 자동이며, 어떤 해상도에서도 선명하다.
 *
 * 🔴 **페이지 컨테이너가 아니라 잎 컴포넌트를 쓴다.** `CoverletterChatPanel`(useQuery 5개)·
 * 캘린더 페이지(11개)는 마운트하는 순간 인증이 필요한 API 를 부른다. 반면 실제로 **그리는**
 * 컴포넌트(`CompanyCard`·`MessageBubble`·`InterviewQuestionCard`·`CountdownPillCard`)는
 * 전부 props 만 받는다 — **query 훅 0개.** 랜딩엔 그리는 것만 필요하다.
 *
 * 🔴 **`@/demo/sampleData` 를 import 하지 않는다.** 실측 결과 첫 화면 번들이
 * **gzip +37KB** 늘어난다(자소서 본문·면접 105문항·10개사가 통째로 딸려온다).
 * 여기 필요한 건 카드 몇 장뿐이라 직접 쓴다.
 *
 * 🔴 **날짜는 오늘 기준으로 계산한다** — 박아두면 시간이 지나 D-day 가 음수가 되거나
 * "마감 지남" 으로 뒤집힌다. 랜딩은 배포 후 오래 살아 있는 화면이다.
 */
import { addDays, todayLocal } from '@/utils/datetime'
import type { Application, ApplicationStep } from '@/types/application'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'
import type { CoverletterChatMessage } from '@/api/coverletterDoc'
import type { DdayItem } from '@/api/dashboard'
import type { CalendarEvent } from '@/api/calendar'
import type { ApplicationCoverletter } from '@/types/coverletter'

/** 카드가 쓰지 않는 값 — 타입을 채우기 위한 고정 시각 */
const TS = '2026-01-01T00:00:00Z'

function step(
  applicationId: string,
  orderIndex: number,
  name: string,
  scheduledDate: string | null = null,
): ApplicationStep {
  return {
    id: `${applicationId}-s${orderIndex}`,
    applicationId,
    orderIndex,
    name,
    scheduledDate,
    location: null,
    notes: null,
    pinnedContent: null,
  }
}

// ── 히어로 — 지원 카드 ─────────────────────────────────────
export const HERO_CARDS: Application[] = [
  {
    id: 'hero-1',
    userId: 'hero',
    companyName: '카카오',
    jobTitle: '백엔드 개발자',
    jobCategory: 'IT개발',
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 2,
    needsDetail: false,
    isStarred: true,
    createdAt: TS,
    updatedAt: TS,
    steps: [
      step('hero-1', 0, '서류 제출'),
      step('hero-1', 1, '코딩테스트·과제'),
      step('hero-1', 2, '1차 기술면접', addDays(todayLocal(), 3) + 'T01:00:00Z'),
      step('hero-1', 3, '2차 컬처핏'),
      step('hero-1', 4, '최종 합격'),
    ],
  },
  {
    id: 'hero-2',
    userId: 'hero',
    companyName: '네이버',
    jobTitle: '서비스 기획',
    jobCategory: '기획·PM',
    status: 'PASSED',
    jobUrl: null,
    memo: null,
    currentStepIndex: 3,
    needsDetail: false,
    isStarred: true,
    createdAt: TS,
    updatedAt: TS,
    steps: [
      step('hero-2', 0, '서류 제출'),
      step('hero-2', 1, '1차 면접'),
      step('hero-2', 2, '2차 면접'),
      step('hero-2', 3, '최종 합격'),
    ],
  },
]

// ── 캘린더 — 임박한 일정 ────────────────────────────────────
export const LANDING_DDAYS: DdayItem[] = [
  {
    type: 'step',
    applicationId: 'hero-4',
    stepId: 'hero-1-s2',
    companyName: '카카오',
    stepName: '1차 기술면접',
    date: addDays(todayLocal(), 3),
    scheduledTime: '10:00',
    dday: 3,
  },
  {
    type: 'step',
    applicationId: 'hero-3',
    stepId: 'hero-3-s0',
    companyName: 'KB국민은행',
    stepName: '서류 제출',
    date: addDays(todayLocal(), 5),
    dday: 5,
  },
  // 🔴 pill 은 2열이라 **2개가 있어야 칸이 안 빈다** (1개면 오른쪽 절반이 비어 보인다)
  {
    type: 'step',
    applicationId: 'hero-4',
    stepId: 'hero-4-s1',
    companyName: '아모레퍼시픽',
    stepName: '1차 실무면접',
    date: addDays(todayLocal(), 7),
    scheduledTime: '14:00',
    dday: 7,
  },
]

// ── 자소서 — AI 와 주고받은 대화 ────────────────────────────
/**
 * 실제 `MessageBubble` 이 받는 형태 그대로. 제안(`suggestedUpdates`)이 있어야
 * **「답변 확인하기」/「거절」** 이 그려진다 — AI 와 같이 고쳐 쓴다는 게 이 기능의 요점이다.
 */
export const LANDING_CHAT: CoverletterChatMessage[] = [
  {
    id: 'lp-msg1',
    applicationId: 'hero-4',
    role: 'user',
    content:
      '지원동기 첫 문단이 늘어지는 것 같아요. 참여율 3%에서 11%로 올린 수치를 앞으로 당기고, 남는 분량은 그 뒤 이야기를 더 풀어주세요.',
    suggestedUpdates: null,
    citations: null,
    createdAt: TS,
  },
  {
    id: 'lp-msg2',
    applicationId: 'hero-4',
    role: 'assistant',
    content:
      '믿음을 먼저 말하고 사례가 뒤에 와서 11%라는 수치가 네 번째 문장에서야 나왔어요. 그 수치를 첫 문장으로 올리고, 아낀 분량으로 해시태그를 되돌린 뒤 무엇을 바꿨는지를 덧붙였습니다.',
    suggestedUpdates: [
      {
        clId: 'lp-cl0',
        newAnswer:
          '[참여율 3%를 11%로 — 경품이 아니라 문턱을 낮췄습니다] 학회에서 맡은 화장품 브랜드 SNS 이벤트의 참여율을 3%에서 11%로 올린 경험이 지원의 계기였습니다. 처음엔 경품을 키우자는 의견이 많았지만, 댓글 200개를 읽어보니 절반이 "방법을 모르겠다"였습니다. 참여 단계를 세 개에서 하나로 줄이고 예시 게시물을 먼저 올린 것이 전부였습니다. 중간에 해시태그를 다섯 개나 붙였다가 오히려 참여가 줄어 되돌린 적도 있는데, 그 뒤로는 바꾸기 전에 좋아질 지표와 나빠질 지표를 같이 적어두고 시작합니다. 브랜드가 좋아서 쓰는 게 아니라 쓰기 편해서 좋아지는 경우가 많다고 믿고, 고객이 멈추는 자리를 찾는 마케터가 되고 싶습니다.',
      },
    ],
    citations: { citedLogIds: ['lp-log-club'] },
    createdAt: TS,
  },
]

/** `MessageBubble` 이 제안 카드에 문항 번호·글자수를 그릴 때 참조하는 맵 */
export const LANDING_CL_MAP = new Map([
  [
    'lp-cl0',
    {
      id: 'lp-cl0',
      question: '아모레퍼시픽에 지원하게 된 동기를 작성해 주세요.',
      answer: null,
      category: '지원동기',
      charLimit: 650,
      number: 1,
    },
  ],
])

// ── 면접 — 예상 질문 (읽기 모드) ────────────────────────────
/**
 * 🔴 **AI 예상 답변이 펼쳐져 있어야 한다** (2026-08-09 CEO). 그게 이 기능의 값어치다.
 *
 * 🔴 **보기 모드로 그린다** (2026-08-09 CEO). 랜딩 방문자는 이 화면을 **읽는** 사람이지
 * 쓰는 사람이 아니다. 빈 입력란·저장 안내는 보여줄 것이 아니다.
 *
 * 🔴 **`내 답변` 에는 실제로 그 질문에 답한 문장이 들어간다.** 필드가 `myMemo` 라서
 * 처음엔 준비 메모(`"첫 문장에 측정 넣고 시작"`)를 넣었는데, 그건 **답변이 아니라 쪽지**다.
 * 라벨을 「내 답변」으로 바로잡은 것과 같은 이유로 내용도 답변이어야 한다.
 *
 * 읽기 모드는 내 답변이 있으면 AI 답변을 접는다 — 면접 직전에 외울 건 **내가 쓴 답**이라는
 * 제품 판단이다. 접혀도 한 줄 미리보기와 펼침 화살표가 남아 AI 답변의 존재는 보인다.
 */
function iq(
  i: number,
  category: string,
  questionText: string,
  suggestedAnswer: string,
  myMemo: string | null = null,
  children: InterviewPrepQuestion[] = [],
): InterviewPrepQuestion {
  return {
    id: `lp-q${i}`,
    sessionId: 'lp-s1',
    parentQuestionId: null,
    depth: 0,
    orderIndex: i,
    category,
    mustPrepare: true,
    followupBasis: null,
    questionText,
    suggestedAnswer,
    materialGap: null,
    sourceLogIds: [],
    myMemo,
    createdAt: TS,
    updatedAt: TS,
    children,
  }
}

/**
 * 🔴 **꼬리질문 한 개** (2026-08-09 CEO). 실제 면접은 첫 질문이 아니라 **그 다음**에서 갈린다 —
 * 그게 이 기능의 값어치인데 랜딩엔 메인 질문만 있었다.
 *
 * `followupBasis: 'my_memo'` = **내가 쓴 답을 파고든 것**(카드에 「내 답변 기반」 배지).
 * 실제 면접의 꼬리질문이 거의 전부 그 형태라 그걸 고른다 — `question`(질문 심화)은
 * 답이 아직 없을 때의 폴백이라 성격이 다르다.
 */
function followup(
  parentId: string,
  questionText: string,
  suggestedAnswer: string,
  myMemo: string,
): InterviewPrepQuestion {
  return {
    id: `${parentId}-f1`,
    sessionId: 'lp-s1',
    parentQuestionId: parentId,
    depth: 1,
    orderIndex: 0,
    category: null,
    mustPrepare: false,
    followupBasis: 'my_memo',
    questionText,
    suggestedAnswer,
    materialGap: null,
    sourceLogIds: [],
    // 🔴 꼬리질문에도 내 답변이 있어야 한다 — 비면 읽기 모드가 "아직 안 썼어요" 를 띄운다
    myMemo,
    createdAt: TS,
    updatedAt: TS,
    children: [],
  }
}

export const LANDING_QUESTIONS: InterviewPrepQuestion[] = [
  iq(
    0,
    'self_intro',
    '아모레퍼시픽 브랜드 마케팅 직무와 관련된 경험과 강점을 중심으로 1분 자기소개를 해 주세요.',
    '안녕하십니까. 숫자가 왜 그런지 사람에게서 먼저 찾는 마케터입니다. 학회에서 화장품 브랜드 SNS 이벤트를 맡았을 때 참여율이 3%에 머물렀고, 처음엔 경품을 키우자는 의견이 많았습니다. 그런데 댓글 200개를 전수로 읽어보니 절반이 "방법을 모르겠다"는 말이었습니다. 참여 단계를 세 개에서 하나로 줄이고 예시 게시물을 먼저 올렸더니 참여율이 11%로 올랐습니다. 서포터즈 때도 매장에서 고객을 지켜보며 사용법 안내가 없는 자리에서 손이 멈춘다는 걸 찾아 제안했습니다. 아모레퍼시픽에서도 고객이 남긴 말에서 다음 캠페인의 이유를 찾는 마케터가 되겠습니다.',
    '저는 숫자만 보지 않고 그 뒤에 뭐가 있는지 찾아보는 편입니다. 학회 SNS 이벤트 참여율이 3%였을 때 다들 경품을 키우자고 했는데, 댓글을 다 읽어보니 방법을 모르겠다는 말이 절반이었습니다. 참여 단계를 하나로 줄이고 예시를 먼저 보여주니 11%가 됐습니다. 사람이 왜 멈추는지부터 보는 일을 계속하고 싶습니다.',
    [
      followup(
        'lp-q0',
        '참여율이 3%에서 11%로 올랐다고 하셨는데, 그게 실제 구매나 매출로도 이어졌습니까?',
        '거기까지는 확인하지 못했습니다. 학회 계정이라 구매 데이터에 접근할 수 없었고, 이벤트 기간 브랜드 태그 언급 수가 두 배가 된 것까지만 봤습니다. 다만 그때 참여율만 보고 성공이라고 말했던 게 아쉬워서, 지금은 기획 단계에서 무엇까지 확인할 수 있는지를 먼저 정합니다.',
        '솔직히 매출까지는 못 봤습니다. 학회라 데이터를 볼 수 없었고 언급 수가 두 배 늘어난 것까지만 확인했습니다. 그때 참여율만 보고 잘됐다고 말했던 게 계속 걸려서, 요즘은 시작할 때 어디까지 확인 가능한지부터 정해둡니다.',
      ),
    ],
  ),
  iq(
    1,
    'coverletter_based',
    '해시태그를 다섯 개 붙였다가 되돌린 경험을 적으셨는데, 그때 무엇을 놓쳤다고 보십니까?',
    '보이는 범위만 넓히면 된다고 생각했습니다. 해시태그를 늘리면 노출은 늘지만, 참여자 입장에서는 무엇을 따라 적어야 할지가 흐려집니다. 노출과 참여를 같은 방향으로 움직이는 값이라고 묶어 본 게 잘못이었습니다. 그 뒤로는 바꾸기 전에 어떤 지표가 좋아지고 어떤 지표가 나빠질 수 있는지를 같이 적어두고 시작합니다.',
    '노출만 생각했습니다. 태그가 많으면 눈에 더 띌 줄 알았는데, 정작 참여하는 사람은 뭘 적어야 할지 헷갈려했습니다. 늘어나는 것과 줄어드는 것을 같이 보지 않은 게 문제였습니다.',
    [
      followup(
        'lp-q1',
        '바꾸기 전에 좋아질 지표와 나빠질 지표를 같이 적는다고 하셨는데, 지금은 어떤 기준으로 되돌립니까?',
        '참여율이 직전 회차보다 낮아지면 사흘 안에 되돌리는 것을 기본으로 둡니다. 다만 기간이 짧으면 수치가 흔들려서, 요즘은 숫자와 함께 댓글의 반응도 같이 보고 판단합니다.',
        '사실 사흘이라는 것도 제가 정한 기준입니다. 그래서 혼자 정하지 않고 시작 전에 팀과 맞춰둡니다. 숫자만으로는 잘 안 보여서 댓글도 같이 읽습니다.',
      ),
    ],
  ),
]

// ── 자소서 — 문항 카드 ─────────────────────────────────────
export const LANDING_COVERLETTER: ApplicationCoverletter = {
  id: 'lp-cl0',
  applicationId: 'hero-4',
  question: '아모레퍼시픽에 지원하게 된 동기를 작성해 주세요.',
  category: '지원동기',
  answer:
    '[참여율 3%를 11%로 — 경품이 아니라 문턱을 낮췄습니다]\n브랜드가 좋아서 쓰는 게 아니라 쓰기 편해서 좋아지는 경우가 많다고 믿어 지원했습니다. 학생 마케팅 학회에서 화장품 브랜드 SNS 이벤트를 맡았을 때 참여율이 3%에 머물렀습니다. 처음엔 경품을 키우자는 의견이 많았지만 댓글을 200개쯤 읽어보니 "방법을 모르겠다"는 말이 절반이었습니다. 참여 단계를 세 개에서 하나로 줄이고 예시 게시물을 먼저 올렸더니 참여율이 11%로 올랐습니다. 중간에 해시태그를 다섯 개나 붙였다가 오히려 참여가 줄어 되돌린 적도 있는데, 그 뒤로는 바꾸기 전과 후를 반드시 같은 기준으로 비교합니다.',
  charLimit: 650,
  orderIndex: 0,
  createdAt: TS,
  updatedAt: TS,
}

// ── 자소서 — 문항 3개 (실제 화면은 Q1·Q2·Q3 가 세로로 쌓인다) ──
function cl(
  i: number,
  question: string,
  category: string,
  answer: string,
  charLimit: number,
): ApplicationCoverletter {
  return {
    id: `lp-cl${i}`,
    applicationId: 'hero-4',
    question,
    category,
    answer,
    charLimit,
    orderIndex: i,
    createdAt: TS,
    updatedAt: TS,
  }
}

export const LANDING_COVERLETTERS: ApplicationCoverletter[] = [
  LANDING_COVERLETTER,
  cl(
    1,
    '지원 직무와 관련한 본인의 핵심 역량과 경험을 작성해 주세요.',
    '직무역량·핵심경험',
    '[읽고 나서 바꾸는 사람 — 댓글 200개와 매대 앞 30분]\n저는 숫자가 왜 그런지 사람에게서 먼저 찾습니다. 첫째, 콘텐츠 경험입니다. 학회 SNS 이벤트 참여율이 3%에 머물렀을 때 댓글을 전수로 읽어 "방법을 모르겠다"가 절반임을 확인했고, 참여 단계를 하나로 줄여 11%까지 올렸습니다. 둘째, 현장 경험입니다. 화장품 브랜드 서포터즈로 매장에서 30분씩 고객을 지켜보며, 사람들이 제품을 집어들었다 내려놓는 지점이 성분표가 아니라 사용법 안내가 없는 자리라는 걸 발견했습니다. 그 내용을 정리해 제안했고, 매대 안내문에 사용 순서를 넣은 뒤 해당 제품 문의가 눈에 띄게 줄었습니다.',
    600,
  ),
  cl(
    2,
    '입사 후 이루고 싶은 목표를 작성해 주세요.',
    '입사후포부',
    '[캠페인이 끝나면 이유가 남는 마케터로]\n입사 후에는 잘된 캠페인이 왜 잘됐는지 설명할 수 있는 마케터로 성장하겠습니다. 단기적으로는 기획서를 쓸 때 목표 지표와 실패하면 되돌릴 기준을 함께 적어, 끝난 뒤에 감이 아니라 기록으로 회고할 수 있게 하겠습니다. 중장기적으로는 고객이 남긴 말과 실제 구매 흐름을 이어 보며, 브랜드가 하고 싶은 말이 아니라 고객이 듣고 싶은 말을 찾는 일을 하고 싶습니다.',
    500,
  ),
]

// ── 보드 — 지원 현황 (진행도가 다양해야 스텝바가 채워지는 게 보인다) ──
/**
 * 🔴 **순서가 곧 모바일 구성이다** (2026-08-09 검수). 모바일은 앞 2장만 쓰는데
 * 카카오·삼성이 앞이면 **둘 다 IT개발**이라 "여러 직군" 신호가 사라진다.
 * 아모레(마케팅)를 앞으로 — 심층 샘플(자소서·면접)의 주인공이기도 하다.
 */
export const LANDING_BOARD: Application[] = [
  ...HERO_CARDS.slice(0, 1),
  {
    id: 'hero-4',
    userId: 'hero',
    companyName: '아모레퍼시픽',
    jobTitle: '브랜드 마케팅',
    jobCategory: '마케팅',
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 1,
    needsDetail: false,
    isStarred: false,
    createdAt: TS,
    updatedAt: TS,
    steps: [
      step('hero-4', 0, '서류 제출'),
      step('hero-4', 1, '1차 실무면접', addDays(todayLocal(), 7) + 'T01:00:00Z'),
      step('hero-4', 2, '2차 임원면접'),
      step('hero-4', 3, '최종 합격'),
    ],
  },
  {
    id: 'hero-3',
    userId: 'hero',
    companyName: '삼성전자',
    jobTitle: 'SW 개발',
    jobCategory: 'IT개발',
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 3,
    needsDetail: false,
    isStarred: false,
    createdAt: TS,
    updatedAt: TS,
    steps: [
      step('hero-3', 0, '서류 제출'),
      step('hero-3', 1, '인적성'),
      step('hero-3', 2, '1차 실무면접'),
      // 🔴 D-5 로 두면 「임박한 일정」 top-3(카카오3·KB5·아모레7)가 이 카드를 건너뛴 화면이 된다.
      //    dday 오름차순이라 D-5 가 D-7 보다 앞서야 하는데 목록엔 없어 스스로 하나를 놓친 셈이었다.
      step('hero-3', 3, '임원면접', addDays(todayLocal(), 9) + 'T01:00:00Z'),
      step('hero-3', 4, '최종 합격'),
    ],
  },
  ...HERO_CARDS.slice(1),
]

// ── 캘린더 — 월별 뷰에 찍힐 일정 ────────────────────────────
/**
 * 🔴 섹션 문구가 이미 **"임박한 일정부터 월별 뷰까지"** 라고 약속하는데 월별 화면이 없었다.
 * `CalendarMonthlyGrid` 는 `CalendarEvent[]` 만 받고 데이터 훅이 없어 그대로 쓸 수 있다.
 *
 * 날짜는 **오늘 기준 상대값** — 박아두면 달이 넘어가는 순간 빈 달력이 된다.
 */
/**
 * 🔴 **`type` 을 받는다** (2026-08-09 검수). 전부 `'step'` 으로 고정돼 있어서
 * 월별 뷰 헤더가 **「시험 0」** 이라 적으면서 아래엔 NCS 필기가 **서류 마감 색**으로 찍혔다.
 * 범례엔 보라색 「시험」이 있는데 화면엔 한 번도 안 나왔다.
 */
function ev(
  dayOffset: number,
  companyName: string,
  stepName: string,
  time: string | null = null,
  type: CalendarEvent['type'] = 'step',
): CalendarEvent {
  const isExam = type === 'exam'
  return {
    date: addDays(todayLocal(), dayOffset),
    time,
    type,
    applicationId: isExam ? null : 'hero-1',
    stepId: isExam ? null : `lp-ev${dayOffset}`,
    examId: isExam ? `lp-ex${dayOffset}` : null,
    noteId: null,
    companyName,
    stepName,
    location: null,
    content: null,
  }
}

export const LANDING_EVENTS: CalendarEvent[] = [
  ev(-6, '당근마켓', '서류 제출'),
  ev(-2, '네이버', '최종 합격'),
  ev(3, '카카오', '1차 기술면접', '10:00'),
  ev(5, 'KB국민은행', '서류 마감'),
  ev(7, '아모레퍼시픽', '1차 실무면접', '14:00'),
  // 🔴 보드 카드의 `hero-3` 임원면접(+9일)과 **같은 날**이어야 한다 — 섹션끼리 어긋나면
  //    "D-day 하나도 놓치지 않게" 라고 써놓고 스스로 하나를 놓친 화면이 된다
  ev(9, '삼성전자', '임원면접', '09:30'),
  ev(14, '한국전력공사', 'NCS 직무능력 필기', '10:00', 'exam'),
]

