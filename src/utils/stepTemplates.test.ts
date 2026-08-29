import { describe, expect, it } from 'vitest'
import {
  APPLICATION_TEMPLATES,
  getApplicationTemplate,
  getStepType,
  recommendTemplate,
  STEP_TYPE_CONFIG,
  CHECKLIST_PRESETS,
  IT_CATEGORIES,
  FINANCE_CATEGORIES,
} from './stepTemplates'
import { JOB_CATEGORIES } from '@/utils/sampleData'
import { JOB_SERIES } from '@/utils/jobRole'

describe('APPLICATION_TEMPLATES', () => {
  it('모든 템플릿은 "서류 제출" 시작 / "최종 합격" 끝', () => {
    for (const t of APPLICATION_TEMPLATES) {
      expect(t.steps.length).toBeGreaterThanOrEqual(3)
      expect(t.steps[0]).toBe('서류 제출')
      expect(t.steps[t.steps.length - 1]).toBe('최종 합격')
    }
  })

  it('custom 은 general 과 동일한 스텝', () => {
    const custom = APPLICATION_TEMPLATES.find((t) => t.id === 'custom')!
    const general = APPLICATION_TEMPLATES.find((t) => t.id === 'general')!
    expect(custom.steps).toEqual(general.steps)
  })

  it('getApplicationTemplate — 미존재·null·undefined 는 general', () => {
    expect(getApplicationTemplate('finance').id).toBe('finance')
    expect(getApplicationTemplate(null).id).toBe('general')
    expect(getApplicationTemplate(undefined).id).toBe('general')
    expect(getApplicationTemplate('nope').id).toBe('general')
  })
})

describe('STEP_TYPE_CONFIG — 시맨틱 토큰 (U32 → 카드 상세 개편에서 warning 통일)', () => {
  it('document 는 warning 계열로 통일 (스트라이프·라벨·보더 — 캘린더 정합, 파랑 라벨+노랑 스트라이프 모순 방지)', () => {
    expect(STEP_TYPE_CONFIG.document.colorCls).toBe('text-warning')
    expect(STEP_TYPE_CONFIG.document.borderCls).toBe('border-warning/30')
    expect(STEP_TYPE_CONFIG.document.bgCls).toBe('bg-warning/5')
    expect(STEP_TYPE_CONFIG.document.accentBorderCls).toBe('border-l-warning')
  })

  it('전 유형 클래스 필드에 raw 팔레트(blue- 등) 없음 — 의미 토큰만', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG)) {
      for (const cls of [cfg.colorCls, cfg.borderCls, cfg.bgCls, cfg.accentBorderCls]) {
        expect(cls).not.toMatch(/blue-|red-|green-|yellow-|indigo-|sky-/)
      }
    }
  })

  it('전 유형 Icon 은 lucide 컴포넌트 — 기능 아이콘 정책 (이모지 문자열 아님)', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG)) {
      expect(cfg.Icon).toBeDefined()
      // lucide 아이콘 = forwardRef(object). 과거 icon: string(이모지) 로의 회귀 방지.
      expect(typeof cfg.Icon).not.toBe('string')
      expect(cfg.Icon).toHaveProperty('render')
    }
  })

  it('구 icon(이모지)·hex 필드 제거 — 아이콘 정책 전환 + 위생 ⑪ (죽은 hex 삭제)', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG) as Record<string, unknown>[]) {
      expect('icon' in cfg).toBe(false)
      expect('hex' in cfg).toBe(false)
    }
  })
})

describe('getStepType — 분류 키워드 확장 + exam 신설 (판정 순서 = 본질 우선순위)', () => {
  it('interview — 면접·인터뷰 + 면접형 전형(PT·토론·컬처핏·커피챗)', () => {
    for (const name of ['1차 면접', '임원면접', '화상 인터뷰', '2차 PT·토론', 'PT 발표', '2차 컬처핏', '컬쳐핏 면접', '커피챗']) {
      expect(getStepType(name)).toBe('interview')
    }
  })

  it('interview 우선 — AI면접은 면접(면접 우선), PT 발표는 result 아닌 interview', () => {
    expect(getStepType('AI면접')).toBe('interview')
    expect(getStepType('PT 발표')).toBe('interview') // 발표(result 키워드) 보다 interview 먼저
  })

  it('exam(신설) — 코테·과제·필기·인적성·시험·평가·검사·역검류', () => {
    for (const name of ['코딩테스트·과제', '코테', '온라인 테스트', '필기(NCS)', '인적성', '인성검사', '적성평가', '논술', '작문 시험', '실기', 'AI역량검사', '역검', '실무 평가', '과제 전형']) {
      expect(getStepType(name)).toBe('exam')
    }
  })

  it('exam — 영문 시험명 대소문자 무관 (\\b 단어경계)', () => {
    for (const name of ['GSAT', 'gsat', '온라인 GSAT', 'HMAT', '인적성(HMAT)', 'SKCT', 'PSAT', 'DCAT', '필기(NCS)']) {
      expect(getStepType(name)).toBe('exam')
    }
  })

  it('exam 영문 \\b — 단어 내부 CAT/PAT 오탐 방지 (application·communication 등은 exam 아님)', () => {
    expect(getStepType('communication 워크샵')).toBe('wait')
    expect(getStepType('Application 접수 안내')).toBe('wait')
  })

  it('순서 충돌 — 과제 제출은 document 보다 exam 먼저 (과제가 본질)', () => {
    expect(getStepType('과제 제출')).toBe('exam')
  })

  it('document — 서류·제출 (exam 키워드 없을 때)', () => {
    expect(getStepType('서류 제출')).toBe('document')
    expect(getStepType('지원서 제출')).toBe('document')
  })

  it('result — 합격·최종·발표 (발표 신규 — "결과 발표"도 발표로 커버)', () => {
    for (const name of ['최종 합격', '합격 발표', '결과 발표', '최종 결과']) {
      expect(getStepType(name)).toBe('result')
    }
  })

  it('wait — "결과 대기"는 대기 (단독 결과 키워드 제외 → 발표만 result). 미매칭은 대기', () => {
    expect(getStepType('결과 대기 중')).toBe('wait')
    expect(getStepType('온보딩')).toBe('wait')
    expect(getStepType('')).toBe('wait')
  })

  it('기본 템플릿 전 스텝명 회귀 — 회색 대기로 새던 핵심 전형이 올바른 유형으로', () => {
    const expected: Record<string, string> = {
      '서류 제출': 'document',
      '코딩테스트·과제': 'exam',
      '1차 기술면접': 'interview',
      '2차 컬처핏': 'interview',
      '최종 합격': 'result',
      '필기(NCS)': 'exam',
      '인적성': 'exam',
      '1차 실무면접': 'interview',
      '2차 PT·토론': 'interview',
      '임원면접': 'interview',
      '과제 전형': 'exam',
      '대표 면접': 'interview',
      '필기': 'exam',
      '실무 평가': 'exam',
      '면접': 'interview',
    }
    for (const [name, type] of Object.entries(expected)) {
      expect(getStepType(name)).toBe(type)
    }
    // APPLICATION_TEMPLATES 안의 스텝명이 wait 로 떨어지지 않는지 (마지막 '최종 합격'=result 등 전부 분류됨)
    for (const t of APPLICATION_TEMPLATES) {
      for (const step of t.steps) {
        expect(getStepType(step)).not.toBe('wait')
      }
    }
  })

  it('exam 은 STEP_TYPE_CONFIG·CHECKLIST_PRESETS 를 모두 보유', () => {
    expect(STEP_TYPE_CONFIG.exam.label).toBe('시험·평가')
    expect(STEP_TYPE_CONFIG.exam.colorCls).toBe('text-violet')
    expect(CHECKLIST_PRESETS.exam).toHaveLength(4)
  })
})

describe('recommendTemplate', () => {
  it('빈 입력 → general', () => {
    expect(recommendTemplate({})).toBe('general')
  })

  it('rawInput에 "인턴" → internship (최우선)', () => {
    expect(recommendTemplate({ rawInput: '삼성전자 하계 인턴' })).toBe('internship')
    expect(recommendTemplate({ rawInput: '네이버 인턴', jobCategories: ['IT개발'] })).toBe('internship')
  })

  /**
   * 🔴 **이 테스트가 옛 값(`'IT개발'`)만 검증해서 버그가 살아남았다** (2026-08-05).
   *
   * W1 에서 직군이 8분류 → **21개 세부 직군**으로 바뀌었는데 `recommendTemplate` 은 옛 값을
   * 그대로 보고 있었다. 그런데 이 spec 도 옛 값을 넣고 있었으므로 **초록불인 채로**
   * "IT 직군을 골라도 IT 템플릿이 안 나오는" 상태가 유지됐다.
   * 앱이 만들지 않는 값으로는 규칙이 맞는지 검증할 수 없다.
   */
  it('🔴 실제 IT 직군 값(21분류) → it_dev', () => {
    for (const c of ['백엔드 개발', '프론트엔드 개발', '모바일 앱 개발', '데이터·AI', 'DevOps·인프라·보안']) {
      expect(recommendTemplate({ jobCategories: [c] })).toBe('it_dev')
    }
    expect(recommendTemplate({ jobCategories: ['그래픽·브랜드 디자이너', '백엔드 개발'] })).toBe('it_dev')
  })

  it('실제 금융 직군 값 → finance (회사명이 금융권이 아니어도)', () => {
    expect(recommendTemplate({ jobCategories: ['금융·은행·증권·보험'], companyName: '토스' })).toBe('finance')
  })

  it('레거시 8분류 값도 계속 동작한다 (옛 카드 데이터 호환)', () => {
    expect(recommendTemplate({ jobCategories: ['IT개발'] })).toBe('it_dev')
    expect(recommendTemplate({ jobCategories: ['금융'] })).toBe('finance')
  })

  /**
   * 🔴 **드리프트 가드** — 매핑에 적은 값이 실제 직군 목록에 없으면 그 분기는 죽은 코드다.
   * 직군 목록을 바꾸면 여기서 먼저 깨진다. (레거시 별칭은 목록에 없는 게 정상이라 제외)
   */
  it('🔴 매핑 값이 실제 JOB_CATEGORIES 에 존재한다', () => {
    const legacy = ['IT개발', '금융']
    for (const c of [...IT_CATEGORIES, ...FINANCE_CATEGORIES].filter((c) => !legacy.includes(c))) {
      expect(JOB_CATEGORIES).toContain(c)
    }
  })

  it('회사명 패턴 — 금융권', () => {
    expect(recommendTemplate({ companyName: '신한은행' })).toBe('finance')
    expect(recommendTemplate({ companyName: 'KB증권' })).toBe('finance')
    expect(recommendTemplate({ companyName: '삼성카드' })).toBe('finance')
  })

  it('회사명 패턴 — 공기업·공공 (청은 끝에 올 때만)', () => {
    expect(recommendTemplate({ companyName: '한국토지주택공사' })).toBe('public')
    expect(recommendTemplate({ companyName: '한국산업인력공단' })).toBe('public')
    expect(recommendTemplate({ companyName: '기상청' })).toBe('public')
    // "청"으로 시작하는 사기업은 오인하지 않음
    expect(recommendTemplate({ companyName: '청호나이스' })).toBe('general')
  })

  it('회사명 패턴 — 방송·언론', () => {
    expect(recommendTemplate({ companyName: 'MBC' })).toBe('media')
    expect(recommendTemplate({ companyName: '한겨레신문' })).toBe('media')
    expect(recommendTemplate({ companyName: 'JTBC' })).toBe('media')
  })

  it('이름에 스타트업이 안 드러나면 추측하지 않는다 → general', () => {
    expect(recommendTemplate({ companyName: '토스' })).toBe('general')
    expect(recommendTemplate({ companyName: '당근마켓', jobCategories: ['마케팅'] })).toBe('general')
  })
})

/**
 * 직무 기준 재설계 (`plans/job-role-first.md` 묶음 4 — 축소분).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 🔴 `인턴` 판정 되살림 — 규칙은 있었는데 **호출부가 `rawInput` 을 안 넘겨** 죽어 있었다
 *  2. 직무 칸에 적힌 「백엔드 인턴」도 잡는다 (실제 입력 형태)
 *  3. 계열 id → 템플릿 3종 (it·finance·public) · media 계열은 일부러 general (방송사는 회사명으로)
 *  4. 🔴 `startup` 템플릿 도달 경로 신설 (그전엔 어떤 규칙도 그 id 를 안 돌려줬다)
 *  5. `PUBLIC_RE` 보강 — 기금·금고·협회·감독원. **병원은 넣지 않는다**(템플릿 보류)
 *  6. 🔴 국책은행은 「은행」보다 공공이 먼저 (안 그러면 새 패턴이 죽은 코드가 된다)
 *  7. 하위 호환 — 옛 `jobCategories` 경로가 그대로 동작한다
 *  8. 우선순위 — 인턴 > 스타트업 > 계열
 */
describe('recommendTemplate — 직무 기준 재배선', () => {
  it('1) rawInput 「인턴」 → internship', () => {
    expect(recommendTemplate({ rawInput: '삼성전자 하계 인턴' })).toBe('internship')
  })

  it('2) 🔴 jobTitle 「백엔드 인턴」 → internship (rawInput 없이도)', () => {
    expect(recommendTemplate({ jobTitle: '백엔드 인턴' })).toBe('internship')
    // 계열이 IT 로 잡혀도 인턴이 이긴다
    expect(recommendTemplate({ jobTitle: '백엔드 인턴', seriesId: 'it' })).toBe('internship')
  })

  /**
   * 🔴 **갱신 (2026-08-28)** — 계열 3종 매핑이 **14종 전부**로 넓어졌다.
   * 온보딩이 계열 1탭이 되면서 「계열을 골랐는데 전형 미리보기는 일반 대기업」이
   * 눈에 보이는 자리로 나왔기 때문이다. `media` 도 이때 연결했다 (SERIES_TEMPLATE 주석 참조).
   */
  it('3) 계열 id → 템플릿 (14계열 전부 매핑)', () => {
    expect(recommendTemplate({ seriesId: 'it' })).toBe('it_dev')
    expect(recommendTemplate({ seriesId: 'finance' })).toBe('finance')
    expect(recommendTemplate({ seriesId: 'public' })).toBe('public')
    expect(recommendTemplate({ seriesId: 'media' })).toBe('media')
    expect(recommendTemplate({ seriesId: 'media', companyName: 'MBC' })).toBe('media')
  })

  it('3-b) 모르는 계열·계열 없음은 general (억지로 배정하지 않는다)', () => {
    expect(recommendTemplate({ seriesId: null })).toBe('general')
    expect(recommendTemplate({ seriesId: 'no-such-series' })).toBe('general')
  })

  it('4) 🔴 스타트업 규칙 — 도달 불가였던 템플릿에 경로가 생겼다', () => {
    expect(recommendTemplate({ companyName: '오늘의집 스타트업' })).toBe('startup')
    expect(recommendTemplate({ companyName: 'Acme Startup' })).toBe('startup')
    expect(recommendTemplate({ jobTitle: '스타트업 백엔드' })).toBe('startup')
    // 계열보다 먼저 — 스타트업 IT 라면 대기업 IT 전형이 아니다
    expect(recommendTemplate({ companyName: 'Foo Startup', seriesId: 'it' })).toBe('startup')
  })

  it('5) PUBLIC_RE 보강 — 기금·금고·협회·감독원', () => {
    expect(recommendTemplate({ companyName: '신용보증기금' })).toBe('public')
    expect(recommendTemplate({ companyName: '새마을금고' })).toBe('public')
    expect(recommendTemplate({ companyName: '대한간호협회' })).toBe('public')
    expect(recommendTemplate({ companyName: '금융감독원' })).toBe('public')
    expect(recommendTemplate({ companyName: '금융결제원' })).toBe('public')
  })

  it('5-b) 🔴 병원은 public 이 아니다 — 병원에 NCS 필기를 주면 안 된다', () => {
    expect(recommendTemplate({ companyName: '삼성서울병원' })).toBe('general')
    // 🔴 갱신 (2026-08-28): health 계열 템플릿이 생겨 이제 general 이 아니라 health 다.
    //    「병원 템플릿 보류」의 이유였던 「NCS 필기를 주게 된다」는 그대로 지켜진다 —
    //    health 스텝은 서류 → 면접 → 신체검사 → 최종 합격이다.
    expect(recommendTemplate({ companyName: '대전성모병원', seriesId: 'health' })).toBe('health')
  })

  it('6) 🔴 국책은행은 public — 「은행」보다 공공 패턴을 먼저 본다', () => {
    expect(recommendTemplate({ companyName: '한국산업은행' })).toBe('public')
    expect(recommendTemplate({ companyName: 'IBK기업은행' })).toBe('public')
    expect(recommendTemplate({ companyName: '한국수출입은행' })).toBe('public')
    // 일반 시중은행은 그대로 금융
    expect(recommendTemplate({ companyName: '신한은행' })).toBe('finance')
    expect(recommendTemplate({ companyName: 'KB증권' })).toBe('finance')
  })

  it('7) 하위 호환 — 옛 jobCategories 경로가 그대로 동작한다', () => {
    expect(recommendTemplate({ jobCategories: ['백엔드 개발'] })).toBe('it_dev')
    expect(recommendTemplate({ jobCategories: ['금융·은행·증권·보험'] })).toBe('finance')
    // 계열이 있으면 계열이 이긴다 (새 경로가 1차 신호)
    expect(recommendTemplate({ seriesId: 'public', jobCategories: ['백엔드 개발'] })).toBe('public')
  })

  /**
   * 🔴 **뒤집혔다 (2026-08-28)** — 예전엔 「계열 → 회사명」이라 `MBC + it` 이 `it_dev` 였다.
   * 이제 **회사명이 계열보다 먼저**다: 전형을 정하는 건 회사이기 때문이다.
   * (계열 14벌이 다 채워지면서 이 충돌이 흔해졌다 — 예전엔 3계열뿐이라 대부분
   * 회사명 규칙까지 흘러왔고, 그래서 순서 문제가 드러나지 않았다.)
   */
  it('8) 🔴 회사명이 계열보다 먼저 — 전형을 정하는 건 회사다', () => {
    expect(recommendTemplate({ companyName: 'MBC', seriesId: 'it' })).toBe('media')
    expect(recommendTemplate({ companyName: 'MBC' })).toBe('media')
    // 은행 공채에 지원하는 개발자는 코테 전형이 아니라 은행 전형을 받는다
    expect(recommendTemplate({ companyName: '신한은행', jobTitle: '백엔드 개발자' })).toBe(
      'finance',
    )
  })
})

/**
 * 계열 14벌 + 세밀 오버라이드 (`plans/job-role-first.md` 묶음 1 · 2026-08-28).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 14계열이 **각각** 자기 템플릿을 받는다 (하나라도 general 로 새면 온보딩 보상이 거짓말)
 *  2. 세밀 오버라이드 4종 — 금융공공 · 승무원 · 경찰 · 군인
 *  3. 🔴 세밀이 **회사명보다 먼저** (한국은행 + 정책금융 → finance_public, 은행 규칙이 아님)
 *  4. 🔴 회사명이 **계열보다 먼저** (신한은행 + 백엔드 → finance)
 *  5. 「임용」 → teacher_exam (사전으로는 학원강사와 못 가른다)
 *  6. 인턴은 여전히 최우선 (계열·세밀·임용 전부 이긴다)
 *  7. 새 템플릿의 스텝이 전부 분류된다 (회색 「대기」로 새지 않는다)
 *  8. 프론트·백 사본 불변식 — 서류 제출 시작 · 최종 합격 끝
 */
describe('recommendTemplate — 계열 14 + 세밀 오버라이드', () => {
  it('1) 14계열이 각각 자기 템플릿을 받는다 (general 로 새는 계열 0)', () => {
    const expected: Record<string, string> = {
      it: 'it_dev',
      office: 'office',
      finance: 'finance',
      health: 'health',
      education: 'education',
      public: 'public',
      research: 'research',
      manufacturing: 'manufacturing',
      construction: 'construction',
      sales: 'sales',
      media: 'media',
      logistics: 'logistics',
      agriculture: 'agriculture',
      marketing: 'marketing',
    }
    // 🔴 드리프트 가드 — 계열 목록을 늘리면 여기서 먼저 깨진다
    expect(Object.keys(expected).sort()).toEqual(JOB_SERIES.map((s) => s.id).sort())
    for (const [seriesId, templateId] of Object.entries(expected)) {
      expect(recommendTemplate({ seriesId })).toBe(templateId)
    }
  })

  it('2) 세밀 오버라이드 4종 — 금융공공 · 승무원 · 경찰 · 군인', () => {
    expect(recommendTemplate({ jobTitle: '정책금융', seriesId: 'finance' })).toBe(
      'finance_public',
    )
    expect(recommendTemplate({ jobTitle: '승무원', seriesId: 'sales' })).toBe('air_service')
    expect(recommendTemplate({ jobTitle: '경찰', seriesId: 'public' })).toBe('uniformed')
    expect(recommendTemplate({ jobTitle: '부사관', seriesId: 'public' })).toBe('uniformed')
  })

  it('3) 🔴 세밀이 회사명보다 먼저 — 한국은행 + 금융공공 직무 → finance_public', () => {
    // 회사명만 보면 「은행」이라 finance 로 갔을 것이다. 세밀이 먼저라 안 그런다.
    expect(recommendTemplate({ companyName: '한국은행', jobTitle: '정책금융' })).toBe(
      'finance_public',
    )
    // 경찰청은 `청$` 이라 PUBLIC_RE 에 걸리지만 세밀이 먼저다
    expect(recommendTemplate({ companyName: '경찰청', jobTitle: '경찰' })).toBe('uniformed')
  })

  it('4) 🔴 회사명이 계열보다 먼저 — 신한은행 + 백엔드 개발자 → finance', () => {
    expect(
      recommendTemplate({ companyName: '신한은행', jobTitle: '백엔드 개발자', seriesId: 'it' }),
    ).toBe('finance')
  })

  it('5) 「임용」 → teacher_exam (사전으로는 학원강사와 못 가른다)', () => {
    expect(recommendTemplate({ jobTitle: '임용 준비' })).toBe('teacher_exam')
    expect(recommendTemplate({ rawInput: '중등 임용', jobTitle: '' })).toBe('teacher_exam')
    // 계열·회사명을 전부 이긴다
    expect(
      recommendTemplate({ jobTitle: '임용', seriesId: 'education', companyName: '서울시교육청' }),
    ).toBe('teacher_exam')
    // 그냥 교사는 교육 계열 템플릿 (임용 고시가 아니다)
    expect(recommendTemplate({ jobTitle: '학원강사', seriesId: 'education' })).toBe('education')
  })

  it('6) 인턴은 여전히 최우선', () => {
    expect(recommendTemplate({ jobTitle: '간호 인턴', seriesId: 'health' })).toBe('internship')
    expect(recommendTemplate({ jobTitle: '승무원 인턴', seriesId: 'sales' })).toBe('internship')
  })

  it('7) 새 템플릿의 스텝이 전부 분류된다 — 회색 「대기」로 새지 않는다', () => {
    // 채용검진(건설)·체력검정(군경)이 어느 갈래에도 안 걸려 모래시계로 떨어지던 구멍
    expect(getStepType('채용검진')).toBe('exam')
    expect(getStepType('체력검정')).toBe('exam')
    expect(getStepType('신체검사')).toBe('exam')
    expect(getStepType('수업 시연·필기')).toBe('exam')
    expect(getStepType('전공 필기·PT')).toBe('interview') // PT 가 면접형이라 interview 가 맞다
    expect(getStepType('과제(기획안)')).toBe('exam')
  })

  it('8) 계열 없음·직무 없음 → general', () => {
    expect(recommendTemplate({})).toBe('general')
    expect(recommendTemplate({ seriesId: null, jobTitle: '' })).toBe('general')
  })
})
