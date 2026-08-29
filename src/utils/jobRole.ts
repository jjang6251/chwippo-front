/**
 * 「직무 → 직군」 분류기 — `plans/job-role-first.md` 묶음 0.
 *
 * 사용자가 적은 **직무 원문**(「간호사」·「지상직」·「9급 공무원」)에서 **계열**을 파생한다.
 * 온보딩·카드 추가·설정·관측이 전부 이 한 벌을 쓴다.
 *
 * ## 3층 구조
 *
 * | 층 | 개수 | 역할 |
 * |---|---|---|
 * | 원문 | 무한 | 정보의 그릇 — 절대 안 깎인다 (분류 실패해도 원문은 저장) |
 * | 세밀(`FineGroupDef`) | 42 | 관측·집계 축 — 어디에 사람이 몰리는지 |
 * | 계열(`JobSeriesDef`) | 14 | 콘텐츠 매칭 — 전형 템플릿·면접 질문·온보딩 보상 |
 *
 * 세밀→계열은 `seriesId` 접기 표로 파생한다. 특정 세밀에 사람이 몰리면 그 층에
 * 콘텐츠만 붙이면 되고, 저장된 원문에서 언제든 재계산되므로 마이그레이션이 없다.
 *
 * ## 설계 원칙
 *
 * - **LLM 미사용·결정적** — 카드 추가마다 모델을 부르지 않는다. 번들 사전으로 클라이언트 매칭.
 * - **실패를 실패로 둔다** — 못 잡으면 `none`. 「기타」로 뭉치지 않는다. 원문 보존이 전 직군 커버의 진짜 보장이고,
 *   반복되는 실패는 관측 화면에서 사전을 키우는 재료가 된다.
 * - **억지 어휘 금지** — 확신 없는 표현은 넣지 않는다. 오분류(잘못된 `confident`)가 미분류(`none`)보다 나쁘다.
 * - **ES2022+ 내장 API 미사용** — iOS 15.4 미만에서 크래시. `Object.hasOwn`·`structuredClone`·`.at()`·`.findLast()` 등 금지.
 */

export interface JobSeriesDef {
  /** ASCII 안정키 — 저장·비교용. 라벨이 바뀌어도 이 값은 안 바뀐다 */
  id: string
  /** 화면·저장용 한국어 라벨 */
  label: string
}

export interface FineGroupDef {
  id: string
  label: string
  /** 소속 계열 (`JobSeriesDef.id`) */
  seriesId: string
}

export interface DictEntry {
  /** 사용자가 실제로 쓰는 표현 (원형 그대로 — 표시에 쓴다) */
  expr: string
  /** 소속 세밀 그룹 (`FineGroupDef.id`) */
  fineId: string
}

export interface JobMatch {
  series: JobSeriesDef
  fine: FineGroupDef
  /** 매치된 사전 표현 원형 — 「‘간호사’로 판단했어요」 식 근거 표시용 */
  matched: string
}

export type ClassifyJobResult =
  | ({ status: 'confident' } & JobMatch)
  | { status: 'ambiguous'; candidates: JobMatch[] }
  | { status: 'none' }

export interface JobSuggestion {
  expr: string
  series: JobSeriesDef
  fine: FineGroupDef
}

// ─────────────────────────────────────────────────────────────
// 계열 14 — 워크넷 35 중분류를 전부 배정한 결과치 (목표치가 아니다)
// ─────────────────────────────────────────────────────────────

export const JOB_SERIES: readonly JobSeriesDef[] = [
  { id: 'it', label: 'IT·개발' },
  { id: 'office', label: '경영·사무·행정' },
  { id: 'finance', label: '금융·보험' },
  { id: 'health', label: '의료·보건·복지' },
  { id: 'education', label: '교육' },
  { id: 'public', label: '공공·공무원·군인' },
  { id: 'research', label: '연구·R&D' },
  { id: 'manufacturing', label: '생산·기술·기능' },
  { id: 'construction', label: '건설·설비' },
  { id: 'sales', label: '영업·판매·서비스' },
  { id: 'media', label: '미디어·디자인·문화' },
  { id: 'logistics', label: '운송·물류' },
  { id: 'agriculture', label: '농림어업' },
  { id: 'marketing', label: '마케팅·광고·홍보' },
]

// ─────────────────────────────────────────────────────────────
// 세밀 42 — 워크넷 중분류 기본 + 사용자가 몰리는 덩어리는 소분류급으로 쪼갬
// (사무직 6분할 · 금융공공 · 항공 서비스가 그 쪼갠 자리)
// ─────────────────────────────────────────────────────────────

export const JOB_FINE_GROUPS: readonly FineGroupDef[] = [
  { id: 'it-software', label: 'IT·소프트웨어', seriesId: 'it' },

  { id: 'office-management', label: '관리·임원', seriesId: 'office' },
  { id: 'office-strategy', label: '경영기획·전략', seriesId: 'office' },
  { id: 'office-hr', label: '인사·HR', seriesId: 'office' },
  { id: 'office-finance', label: '재무·회계', seriesId: 'office' },
  { id: 'office-admin', label: '총무·사무행정', seriesId: 'office' },
  { id: 'office-legal', label: '법률·법무', seriesId: 'office' },

  { id: 'finance-general', label: '금융일반(은행·증권·보험)', seriesId: 'finance' },
  { id: 'finance-public', label: '금융공공', seriesId: 'finance' },

  { id: 'health-medical', label: '보건·의료', seriesId: 'health' },
  { id: 'health-welfare', label: '사회복지·종교', seriesId: 'health' },
  { id: 'health-care', label: '돌봄', seriesId: 'health' },

  { id: 'education-general', label: '교육', seriesId: 'education' },

  { id: 'public-servant', label: '공무원·공기업', seriesId: 'public' },
  { id: 'public-safety', label: '경찰·소방·교도', seriesId: 'public' },
  { id: 'public-military', label: '군인', seriesId: 'public' },

  { id: 'research-humanities', label: '인문사회 연구', seriesId: 'research' },
  { id: 'research-science', label: '자연·생명과학 연구', seriesId: 'research' },
  { id: 'research-engineering', label: '제조 R&D·공학', seriesId: 'research' },

  { id: 'mfg-machine', label: '기계', seriesId: 'manufacturing' },
  { id: 'mfg-metal', label: '금속·재료', seriesId: 'manufacturing' },
  { id: 'mfg-electric', label: '전기·전자', seriesId: 'manufacturing' },
  { id: 'mfg-telecom', label: '정보통신 설치·정비', seriesId: 'manufacturing' },
  { id: 'mfg-chemical', label: '화학·환경', seriesId: 'manufacturing' },
  { id: 'mfg-textile', label: '섬유·의복', seriesId: 'manufacturing' },
  { id: 'mfg-food', label: '식품 가공', seriesId: 'manufacturing' },
  { id: 'mfg-craft', label: '인쇄·목재·공예·기타', seriesId: 'manufacturing' },
  { id: 'mfg-simple', label: '제조 단순', seriesId: 'manufacturing' },
  // 대졸 공채 제조 직군의 큰 축 — 몰리면 콘텐츠 승격 1순위 후보
  { id: 'mfg-quality', label: '생산·품질관리', seriesId: 'manufacturing' },

  { id: 'construction-field', label: '건설·채굴', seriesId: 'construction' },
  { id: 'construction-design', label: '건설 공학·설계', seriesId: 'construction' },

  { id: 'sales-general', label: '영업·판매', seriesId: 'sales' },
  { id: 'sales-travel', label: '항공·여행·숙박 서비스', seriesId: 'sales' },
  { id: 'sales-food', label: '음식·조리', seriesId: 'sales' },
  { id: 'sales-beauty', label: '미용·예식', seriesId: 'sales' },
  { id: 'sales-security', label: '경호·경비', seriesId: 'sales' },
  { id: 'sales-personal', label: '청소·기타 개인서비스', seriesId: 'sales' },

  { id: 'media-art', label: '예술·디자인·방송', seriesId: 'media' },
  { id: 'media-sports', label: '스포츠·레크리에이션', seriesId: 'media' },

  { id: 'logistics-transport', label: '운전·운송·물류', seriesId: 'logistics' },

  { id: 'agriculture-general', label: '농림어업', seriesId: 'agriculture' },

  { id: 'marketing-general', label: '마케팅·광고·홍보', seriesId: 'marketing' },
]

/**
 * 🔴 **의도적으로 여러 세밀에 걸친 표현** — 여기 적힌 것만 중복 `expr` 이 허용된다.
 *
 * - **엔지니어** — IT 개발자도, 제조 R&D 도, 현장 기계 기술자도 전부 자기를 그렇게 부른다.
 * - **QA** — IT 품질 담당과 제조 품질보증이 같은 두 글자를 쓴다.
 *
 * 하나로 찍는 순간 둘 중 하나가 틀린다 → 후보를 보여주고 사용자가 고르는 게 정답이다.
 * 구조 테스트(`expr` 중복 0)의 유일한 예외 창구이자, 예외가 늘어나면 눈에 띄게 만드는 장치다.
 */
export const INTENTIONAL_AMBIGUOUS_EXPRS: readonly string[] = ['엔지니어', 'QA']

// ─────────────────────────────────────────────────────────────
// 표현 사전
//
// 출발점은 운영 카드의 실제 직무(지상직·간호·텔러·행원·원무·사무행정·NCS류)이고,
// 나머지는 세밀 그룹별로 흔한 한국 취준 직무 표현을 채웠다.
//
// 🔴 2글자 영문 약어(BE·FE·PM·PO·HR·QA·MD·CS·PD)는 부분 문자열 오탐 위험이 있어
//    최소한만 둔다. 오탐이 실측되는 영단어는 더 긴 표현을 사전에 넣어 최장 매치로 막는다
//    (예: `logistics` 가 `CS` 를 이기게, `전자상거래` 가 `전자` 를 이기게).
// ─────────────────────────────────────────────────────────────

export const JOB_DICT: readonly DictEntry[] = [
  // ── IT·소프트웨어 ────────────────────────────────────────
  { expr: '백엔드', fineId: 'it-software' },
  { expr: '프론트엔드', fineId: 'it-software' },
  { expr: 'Backend', fineId: 'it-software' },
  { expr: 'Frontend', fineId: 'it-software' },
  { expr: 'BE', fineId: 'it-software' },
  { expr: 'FE', fineId: 'it-software' },
  { expr: '개발자', fineId: 'it-software' },
  { expr: '개발', fineId: 'it-software' },
  { expr: '데이터 분석가', fineId: 'it-software' },
  { expr: '머신러닝', fineId: 'it-software' },
  { expr: '정보보안', fineId: 'it-software' },
  { expr: 'QA', fineId: 'it-software' },
  { expr: '서비스기획', fineId: 'it-software' },
  { expr: 'PM', fineId: 'it-software' },
  { expr: 'PO', fineId: 'it-software' },
  { expr: '엔지니어', fineId: 'it-software' }, // 의도적 모호 1/3

  // ── 관리·임원 ────────────────────────────────────────────
  { expr: '임원', fineId: 'office-management' },
  { expr: '경영지원', fineId: 'office-management' },
  { expr: '관리직', fineId: 'office-management' },
  { expr: '지점장', fineId: 'office-management' },
  { expr: '본부장', fineId: 'office-management' },

  // ── 경영기획·전략 ────────────────────────────────────────
  { expr: '경영기획', fineId: 'office-strategy' },
  { expr: '전략기획', fineId: 'office-strategy' },
  { expr: '사업기획', fineId: 'office-strategy' },
  { expr: '사업개발', fineId: 'office-strategy' }, // 최장 매치로 `개발`(IT)을 이겨야 한다
  { expr: '경영전략', fineId: 'office-strategy' },
  { expr: '경영컨설팅', fineId: 'office-strategy' },
  { expr: '컨설턴트', fineId: 'office-strategy' },

  // ── 인사·HR ─────────────────────────────────────────────
  { expr: '인사', fineId: 'office-hr' },
  { expr: 'HR', fineId: 'office-hr' },
  { expr: 'HRD', fineId: 'office-hr' },
  { expr: 'HRBP', fineId: 'office-hr' },
  { expr: '채용담당', fineId: 'office-hr' },
  { expr: '노무', fineId: 'office-hr' },
  { expr: '인재개발', fineId: 'office-hr' },
  { expr: '조직문화', fineId: 'office-hr' },

  // ── 재무·회계 ────────────────────────────────────────────
  { expr: '재무', fineId: 'office-finance' },
  { expr: '회계', fineId: 'office-finance' },
  { expr: '회계사', fineId: 'office-finance' },
  { expr: '경리', fineId: 'office-finance' },
  { expr: '세무', fineId: 'office-finance' },
  { expr: '세무사', fineId: 'office-finance' },
  { expr: '자금', fineId: 'office-finance' },
  { expr: '재경', fineId: 'office-finance' },

  // ── 총무·사무행정 ────────────────────────────────────────
  { expr: '총무', fineId: 'office-admin' },
  { expr: '사무행정', fineId: 'office-admin' },
  { expr: '사무직', fineId: 'office-admin' },
  { expr: '사무보조', fineId: 'office-admin' },
  { expr: '비서', fineId: 'office-admin' },
  { expr: '서무', fineId: 'office-admin' },
  { expr: '행정지원', fineId: 'office-admin' },

  // ── 법률·법무 ────────────────────────────────────────────
  { expr: '법무', fineId: 'office-legal' },
  { expr: '법률', fineId: 'office-legal' },
  { expr: '변호사', fineId: 'office-legal' },
  { expr: '준법감시', fineId: 'office-legal' },
  { expr: '컴플라이언스', fineId: 'office-legal' },
  { expr: '변리사', fineId: 'office-legal' },

  // ── 금융일반 ─────────────────────────────────────────────
  { expr: '행원', fineId: 'finance-general' },
  { expr: '텔러', fineId: 'finance-general' },
  { expr: '증권', fineId: 'finance-general' },
  { expr: '보험설계사', fineId: 'finance-general' },
  { expr: '애널리스트', fineId: 'finance-general' },
  { expr: '펀드매니저', fineId: 'finance-general' },
  { expr: '자산운용', fineId: 'finance-general' },
  { expr: '여신심사', fineId: 'finance-general' },
  { expr: '손해사정', fineId: 'finance-general' },

  // ── 금융공공 (정책금융·A매치) ───────────────────────────
  { expr: '정책금융', fineId: 'finance-public' },
  { expr: '금융공기업', fineId: 'finance-public' }, // `공기업`(공공)을 최장 매치로 이긴다
  { expr: 'A매치', fineId: 'finance-public' },
  { expr: '금융감독', fineId: 'finance-public' },
  { expr: '국책은행', fineId: 'finance-public' },

  // ── 보건·의료 ────────────────────────────────────────────
  { expr: '간호', fineId: 'health-medical' },
  { expr: '간호사', fineId: 'health-medical' },
  { expr: '간호조무사', fineId: 'health-medical' },
  { expr: '원무', fineId: 'health-medical' },
  { expr: '약사', fineId: 'health-medical' },
  { expr: '임상병리사', fineId: 'health-medical' },
  { expr: '방사선사', fineId: 'health-medical' },
  { expr: '물리치료사', fineId: 'health-medical' },
  { expr: '응급구조사', fineId: 'health-medical' },
  { expr: '의료행정', fineId: 'health-medical' },

  // ── 사회복지·종교 ────────────────────────────────────────
  { expr: '사회복지', fineId: 'health-welfare' },
  { expr: '사회복지사', fineId: 'health-welfare' },
  { expr: '성직자', fineId: 'health-welfare' },
  { expr: '목사', fineId: 'health-welfare' },
  { expr: '전도사', fineId: 'health-welfare' },
  { expr: '수녀', fineId: 'health-welfare' },
  { expr: '승려', fineId: 'health-welfare' },
  // 🔴 `청소`(청소·기타 개인서비스)에 부분 매치돼 청소 직군으로 오분류되던 실오탐 —
  //    최장 매치로 이겨 복지 쪽으로 돌린다
  { expr: '청소년지도사', fineId: 'health-welfare' },
  { expr: '청소년상담사', fineId: 'health-welfare' },

  // ── 돌봄 ────────────────────────────────────────────────
  { expr: '요양보호사', fineId: 'health-care' },
  { expr: '간병인', fineId: 'health-care' },
  { expr: '돌봄', fineId: 'health-care' },
  { expr: '활동지원사', fineId: 'health-care' },
  { expr: '산후도우미', fineId: 'health-care' },

  // ── 교육 ────────────────────────────────────────────────
  { expr: '교사', fineId: 'education-general' },
  { expr: '임용', fineId: 'education-general' },
  { expr: '강사', fineId: 'education-general' },
  { expr: '학원강사', fineId: 'education-general' },
  { expr: '교수', fineId: 'education-general' },
  { expr: '조교', fineId: 'education-general' },
  { expr: '교직원', fineId: 'education-general' },
  { expr: '보육교사', fineId: 'education-general' },
  { expr: '유치원교사', fineId: 'education-general' },
  { expr: '교육행정', fineId: 'education-general' },

  // ── 공무원·공기업 ────────────────────────────────────────
  // 🔴 워크넷상 행정직 공무원은 「경영·사무」지만 취준생에겐 공시·NCS 라는 다른 트랙이다.
  //    계획서의 명시적 예외 — 사전 표현 층에서 공공 계열로 직접 배정한다.
  { expr: '공무원', fineId: 'public-servant' },
  { expr: '9급', fineId: 'public-servant' },
  { expr: '7급', fineId: 'public-servant' },
  { expr: '5급', fineId: 'public-servant' },
  { expr: '군무원', fineId: 'public-servant' },
  { expr: '공기업', fineId: 'public-servant' },
  { expr: '공공기관', fineId: 'public-servant' },
  { expr: '행정공무원', fineId: 'public-servant' },
  { expr: '지방직', fineId: 'public-servant' },
  { expr: '국가직', fineId: 'public-servant' },

  // ── 경찰·소방·교도 ───────────────────────────────────────
  { expr: '경찰', fineId: 'public-safety' },
  { expr: '경찰공무원', fineId: 'public-safety' },
  { expr: '순경', fineId: 'public-safety' },
  { expr: '소방관', fineId: 'public-safety' },
  { expr: '소방공무원', fineId: 'public-safety' },
  { expr: '교도관', fineId: 'public-safety' },

  // ── 군인 ────────────────────────────────────────────────
  { expr: '군인', fineId: 'public-military' },
  { expr: '부사관', fineId: 'public-military' },
  { expr: '준사관', fineId: 'public-military' },
  { expr: '장교', fineId: 'public-military' },
  { expr: 'ROTC', fineId: 'public-military' },

  // ── 인문사회 연구 ────────────────────────────────────────
  { expr: '정책연구', fineId: 'research-humanities' },
  { expr: '사회조사', fineId: 'research-humanities' },
  { expr: '경제연구', fineId: 'research-humanities' },
  { expr: '인문사회연구', fineId: 'research-humanities' },
  { expr: '학술연구', fineId: 'research-humanities' },

  // ── 자연·생명과학 연구 ───────────────────────────────────
  { expr: '신약개발', fineId: 'research-science' },
  { expr: '임상연구', fineId: 'research-science' },
  { expr: '임상시험', fineId: 'research-science' },
  { expr: '생명공학', fineId: 'research-science' },
  { expr: '바이오연구', fineId: 'research-science' },
  { expr: '화학연구', fineId: 'research-science' },
  { expr: '유전공학', fineId: 'research-science' },

  // ── 제조 R&D·공학 ───────────────────────────────────────
  { expr: 'R&D', fineId: 'research-engineering' },
  { expr: '연구개발', fineId: 'research-engineering' },
  { expr: '기술개발', fineId: 'research-engineering' },
  { expr: '공정개발', fineId: 'research-engineering' },
  { expr: '제품개발', fineId: 'research-engineering' },
  { expr: '선행연구', fineId: 'research-engineering' },
  { expr: '기구설계', fineId: 'research-engineering' },
  { expr: '엔지니어', fineId: 'research-engineering' }, // 의도적 모호 2/3

  // ── 기계 ────────────────────────────────────────────────
  { expr: '기계설계', fineId: 'mfg-machine' },
  { expr: '기계정비', fineId: 'mfg-machine' },
  { expr: '기계조립', fineId: 'mfg-machine' },
  { expr: '크레인', fineId: 'mfg-machine' },
  { expr: 'CNC', fineId: 'mfg-machine' },
  { expr: '설비보전', fineId: 'mfg-machine' },
  { expr: '금형', fineId: 'mfg-machine' },
  { expr: '엔지니어', fineId: 'mfg-machine' }, // 의도적 모호 3/3

  // ── 금속·재료 ────────────────────────────────────────────
  { expr: '용접', fineId: 'mfg-metal' },
  { expr: '용접사', fineId: 'mfg-metal' },
  { expr: '판금', fineId: 'mfg-metal' },
  { expr: '주조', fineId: 'mfg-metal' },
  { expr: '열처리', fineId: 'mfg-metal' },
  { expr: '금속가공', fineId: 'mfg-metal' },
  { expr: '도금', fineId: 'mfg-metal' },

  // ── 전기·전자 ────────────────────────────────────────────
  { expr: '전기', fineId: 'mfg-electric' },
  { expr: '전기기사', fineId: 'mfg-electric' },
  { expr: '전기설비', fineId: 'mfg-electric' },
  { expr: '전기공사', fineId: 'mfg-electric' },
  { expr: '전자', fineId: 'mfg-electric' },
  { expr: '전자회로', fineId: 'mfg-electric' },
  { expr: '전장설계', fineId: 'mfg-electric' },
  { expr: '반도체', fineId: 'mfg-electric' },

  // ── 정보통신 설치·정비 ───────────────────────────────────
  { expr: '정보통신', fineId: 'mfg-telecom' },
  { expr: '통신설비', fineId: 'mfg-telecom' },
  { expr: '통신기사', fineId: 'mfg-telecom' },
  { expr: '통신공사', fineId: 'mfg-telecom' },
  { expr: '네트워크설치', fineId: 'mfg-telecom' },
  { expr: '광통신', fineId: 'mfg-telecom' },

  // ── 화학·환경 ────────────────────────────────────────────
  { expr: '화학공정', fineId: 'mfg-chemical' },
  { expr: '화공', fineId: 'mfg-chemical' },
  { expr: '환경기사', fineId: 'mfg-chemical' },
  { expr: '환경관리', fineId: 'mfg-chemical' },
  { expr: '수질관리', fineId: 'mfg-chemical' },
  { expr: '대기환경', fineId: 'mfg-chemical' },
  { expr: '폐기물처리', fineId: 'mfg-chemical' },

  // ── 섬유·의복 ────────────────────────────────────────────
  { expr: '섬유', fineId: 'mfg-textile' },
  { expr: '봉제', fineId: 'mfg-textile' },
  { expr: '패턴사', fineId: 'mfg-textile' },
  { expr: '재단사', fineId: 'mfg-textile' },
  { expr: '의류생산', fineId: 'mfg-textile' },
  { expr: '염색가공', fineId: 'mfg-textile' },

  // ── 식품 가공 ────────────────────────────────────────────
  { expr: '식품가공', fineId: 'mfg-food' },
  { expr: '식품제조', fineId: 'mfg-food' },
  { expr: '식품위생', fineId: 'mfg-food' },
  { expr: '제과제빵', fineId: 'mfg-food' },
  { expr: '제빵사', fineId: 'mfg-food' },
  { expr: '축산가공', fineId: 'mfg-food' },

  // ── 인쇄·목재·공예·기타 ──────────────────────────────────
  { expr: '인쇄', fineId: 'mfg-craft' },
  { expr: '제본', fineId: 'mfg-craft' },
  { expr: '목공', fineId: 'mfg-craft' },
  { expr: '목재가공', fineId: 'mfg-craft' },
  { expr: '가구제작', fineId: 'mfg-craft' },
  { expr: '공예', fineId: 'mfg-craft' },

  // ── 제조 단순 ────────────────────────────────────────────
  { expr: '생산직', fineId: 'mfg-simple' },
  { expr: '조립원', fineId: 'mfg-simple' },
  { expr: '포장원', fineId: 'mfg-simple' },
  { expr: '검사원', fineId: 'mfg-simple' },
  { expr: '단순노무', fineId: 'mfg-simple' },

  // ── 생산·품질관리 ────────────────────────────────────────
  // 대졸 공채 제조 직군의 큰 축 — 몰리면 콘텐츠 승격 1순위 후보
  { expr: '생산관리', fineId: 'mfg-quality' },
  { expr: '품질관리', fineId: 'mfg-quality' },
  { expr: '품질보증', fineId: 'mfg-quality' },
  { expr: '품질경영', fineId: 'mfg-quality' },
  { expr: '공정관리', fineId: 'mfg-quality' },
  { expr: 'QC', fineId: 'mfg-quality' },
  { expr: 'QA', fineId: 'mfg-quality' }, // 의도적 모호 — 제조 품질도 QA 를 쓴다

  // ── 건설·채굴 ────────────────────────────────────────────
  { expr: '건설', fineId: 'construction-field' },
  { expr: '시공', fineId: 'construction-field' },
  { expr: '시공관리', fineId: 'construction-field' },
  { expr: '토목', fineId: 'construction-field' },
  { expr: '철근공', fineId: 'construction-field' },
  { expr: '배관', fineId: 'construction-field' },
  { expr: '안전관리자', fineId: 'construction-field' },

  // ── 건설 공학·설계 ───────────────────────────────────────
  { expr: '건축', fineId: 'construction-design' },
  { expr: '건축설계', fineId: 'construction-design' },
  { expr: '건축사', fineId: 'construction-design' },
  { expr: '구조설계', fineId: 'construction-design' },
  { expr: '도시계획', fineId: 'construction-design' },
  { expr: '조경', fineId: 'construction-design' },
  { expr: '감리', fineId: 'construction-design' },
  { expr: '부동산개발', fineId: 'construction-design' },

  // ── 영업·판매 ────────────────────────────────────────────
  { expr: '영업', fineId: 'sales-general' },
  { expr: '영업관리', fineId: 'sales-general' },
  { expr: '해외영업', fineId: 'sales-general' },
  { expr: '기술영업', fineId: 'sales-general' },
  { expr: '판매', fineId: 'sales-general' },
  { expr: '매장관리', fineId: 'sales-general' },
  { expr: 'MD', fineId: 'sales-general' },
  { expr: 'CS', fineId: 'sales-general' },
  { expr: '고객상담', fineId: 'sales-general' },
  { expr: '상담원', fineId: 'sales-general' },

  // ── 항공·여행·숙박 서비스 ────────────────────────────────
  { expr: '지상직', fineId: 'sales-travel' },
  { expr: '승무원', fineId: 'sales-travel' },
  { expr: '객실승무원', fineId: 'sales-travel' },
  { expr: '항공서비스', fineId: 'sales-travel' },
  { expr: '호텔리어', fineId: 'sales-travel' },
  { expr: '호텔프런트', fineId: 'sales-travel' },
  { expr: '여행사', fineId: 'sales-travel' },
  { expr: '관광가이드', fineId: 'sales-travel' },

  // ── 음식·조리 ────────────────────────────────────────────
  { expr: '조리', fineId: 'sales-food' },
  { expr: '조리사', fineId: 'sales-food' },
  { expr: '요리사', fineId: 'sales-food' },
  { expr: '셰프', fineId: 'sales-food' },
  { expr: '바리스타', fineId: 'sales-food' },
  { expr: '주방보조', fineId: 'sales-food' },
  { expr: '홀서빙', fineId: 'sales-food' },

  // ── 미용·예식 ────────────────────────────────────────────
  { expr: '미용사', fineId: 'sales-beauty' },
  { expr: '헤어디자이너', fineId: 'sales-beauty' },
  { expr: '네일아티스트', fineId: 'sales-beauty' },
  { expr: '피부관리사', fineId: 'sales-beauty' },
  { expr: '메이크업', fineId: 'sales-beauty' },
  { expr: '웨딩플래너', fineId: 'sales-beauty' },

  // ── 경호·경비 ────────────────────────────────────────────
  { expr: '경비', fineId: 'sales-security' },
  { expr: '시설경비', fineId: 'sales-security' },
  { expr: '경호', fineId: 'sales-security' },
  { expr: '경호원', fineId: 'sales-security' },
  { expr: '보안요원', fineId: 'sales-security' },

  // ── 청소·기타 개인서비스 ─────────────────────────────────
  { expr: '청소', fineId: 'sales-personal' },
  { expr: '미화원', fineId: 'sales-personal' },
  { expr: '세탁', fineId: 'sales-personal' },
  { expr: '장례지도사', fineId: 'sales-personal' },
  { expr: '가사도우미', fineId: 'sales-personal' },
  { expr: '반려동물미용', fineId: 'sales-personal' },

  // ── 예술·디자인·방송 ─────────────────────────────────────
  { expr: '디자이너', fineId: 'media-art' },
  { expr: '그래픽디자이너', fineId: 'media-art' },
  { expr: 'UI 디자이너', fineId: 'media-art' },
  { expr: 'UX 디자이너', fineId: 'media-art' },
  { expr: '웹디자이너', fineId: 'media-art' },
  { expr: '편집디자이너', fineId: 'media-art' },
  { expr: 'PD', fineId: 'media-art' },
  { expr: '방송작가', fineId: 'media-art' },
  { expr: '영상편집', fineId: 'media-art' },
  { expr: '아나운서', fineId: 'media-art' },

  // ── 스포츠·레크리에이션 ──────────────────────────────────
  { expr: '트레이너', fineId: 'media-sports' },
  { expr: '요가강사', fineId: 'media-sports' },
  { expr: '필라테스강사', fineId: 'media-sports' },
  { expr: '운동선수', fineId: 'media-sports' },
  { expr: '레크리에이션', fineId: 'media-sports' },

  // ── 운전·운송·물류 ───────────────────────────────────────
  { expr: '물류', fineId: 'logistics-transport' },
  { expr: '운송', fineId: 'logistics-transport' },
  { expr: '배송', fineId: 'logistics-transport' },
  { expr: '택배', fineId: 'logistics-transport' },
  { expr: '운전기사', fineId: 'logistics-transport' },
  { expr: '버스기사', fineId: 'logistics-transport' },
  { expr: '지게차', fineId: 'logistics-transport' },
  { expr: 'SCM', fineId: 'logistics-transport' },
  { expr: 'logistics', fineId: 'logistics-transport' }, // 「logistics」가 2글자 `CS` 에 오탐되는 걸 막는다

  // ── 농림어업 ─────────────────────────────────────────────
  { expr: '농업', fineId: 'agriculture-general' },
  { expr: '축산', fineId: 'agriculture-general' },
  { expr: '임업', fineId: 'agriculture-general' },
  { expr: '어업', fineId: 'agriculture-general' },
  { expr: '원예', fineId: 'agriculture-general' },
  { expr: '양식업', fineId: 'agriculture-general' },

  // ── 마케팅·광고·홍보 ─────────────────────────────────────
  { expr: '마케터', fineId: 'marketing-general' },
  { expr: '마케팅', fineId: 'marketing-general' },
  { expr: '퍼포먼스마케팅', fineId: 'marketing-general' },
  { expr: '콘텐츠마케팅', fineId: 'marketing-general' },
  { expr: '브랜드마케팅', fineId: 'marketing-general' },
  { expr: '광고', fineId: 'marketing-general' },
  { expr: '광고기획', fineId: 'marketing-general' },
  { expr: '홍보', fineId: 'marketing-general' },
  { expr: '이커머스', fineId: 'marketing-general' },
  { expr: '전자상거래', fineId: 'marketing-general' }, // `전자`(전기·전자)를 최장 매치로 이긴다
]

// ─────────────────────────────────────────────────────────────
// 정규화·매칭
// ─────────────────────────────────────────────────────────────

/** 공백·구분자를 지운다 — 「백엔드 개발자」와 「백엔드개발자」를 같은 말로 만든다 */
const STRIP_RE = /[\s·・/,.()[\]{}-]/g

/** 1글자 표현은 오탐 폭발(「사」·「원」)이라 아예 매칭 대상에서 뺀다 */
export const MIN_EXPR_LENGTH = 2

export function normalizeJobExpr(value: string): string {
  return value.trim().toLowerCase().replace(STRIP_RE, '')
}

interface IndexedEntry {
  expr: string
  norm: string
  len: number
  fineId: string
  series: JobSeriesDef
  fine: FineGroupDef
}

const SERIES_BY_ID = new Map<string, JobSeriesDef>()
for (const series of JOB_SERIES) SERIES_BY_ID.set(series.id, series)

const FINE_BY_ID = new Map<string, FineGroupDef>()
for (const fine of JOB_FINE_GROUPS) FINE_BY_ID.set(fine.id, fine)

/** 사전을 1회 정규화해 둔다 — 매 호출마다 300번 정규화하지 않기 위해 */
const INDEX: IndexedEntry[] = []
for (const entry of JOB_DICT) {
  const fine = FINE_BY_ID.get(entry.fineId)
  const series = fine ? SERIES_BY_ID.get(fine.seriesId) : undefined
  const norm = normalizeJobExpr(entry.expr)
  if (!fine || !series || norm.length < MIN_EXPR_LENGTH) continue
  INDEX.push({ expr: entry.expr, norm, len: norm.length, fineId: entry.fineId, series, fine })
}

/** 모호 판정 시 보여줄 후보 최대 개수 — 넷을 넘기면 고르는 게 일이 된다 */
const MAX_CANDIDATES = 3

/**
 * 직무 원문 → 계열·세밀 판정.
 *
 * 사전 표현이 입력에 **부분 문자열로 포함**되면 매치로 보고, **최장 매치가 이긴다**.
 * (「사업개발」에는 `사업개발`(경영기획)과 `개발`(IT)이 둘 다 걸리지만 긴 쪽이 이긴다.)
 *
 * - 최장 매치들이 한 세밀을 가리키면 `confident`
 * - 서로 다른 세밀을 가리키면 `ambiguous` (후보 최대 3 — 사용자가 고른다)
 * - 하나도 안 걸리면 `none` — 「기타」로 뭉치지 않고 원문을 그대로 둔다
 *
 * 어떤 입력에도 던지지 않는다 (렌더 중 호출이라 던지면 페이지가 통째로 죽는다).
 */
export function classifyJob(input: string): ClassifyJobResult {
  const norm = normalizeJobExpr(input)
  if (norm.length < MIN_EXPR_LENGTH) return { status: 'none' }

  let bestLen = 0
  let hits: IndexedEntry[] = []
  for (const entry of INDEX) {
    if (entry.len < bestLen) continue
    if (norm.indexOf(entry.norm) === -1) continue
    if (entry.len > bestLen) {
      bestLen = entry.len
      hits = []
    }
    hits.push(entry)
  }
  if (hits.length === 0) return { status: 'none' }

  const seenFineIds: string[] = []
  const matches: JobMatch[] = []
  for (const hit of hits) {
    if (seenFineIds.indexOf(hit.fineId) !== -1) continue
    seenFineIds.push(hit.fineId)
    matches.push({ series: hit.series, fine: hit.fine, matched: hit.expr })
  }

  if (matches.length === 1) {
    return {
      status: 'confident',
      series: matches[0].series,
      fine: matches[0].fine,
      matched: matches[0].matched,
    }
  }
  return { status: 'ambiguous', candidates: matches.slice(0, MAX_CANDIDATES) }
}

/**
 * 타이핑 중 드롭다운용 사전 추천.
 *
 * 접두사 매치를 먼저 채우고 모자라면 부분 포함 매치로 보충한다
 * (「간호」로 `간호사`·`간호조무사` 가 먼저, 「호사」로도 `간호사` 가 나오게).
 * 같은 표현이 여러 세밀에 걸린 경우(`엔지니어`)는 목록에 한 번만 보인다 — 고르는 건 판정 화면의 일이다.
 */
export function suggestJobs(prefix: string, limit = 8): JobSuggestion[] {
  const norm = normalizeJobExpr(prefix)
  if (norm.length === 0 || limit <= 0) return []

  const taken: string[] = []
  const head: JobSuggestion[] = []
  const tail: JobSuggestion[] = []

  for (const entry of INDEX) {
    if (taken.indexOf(entry.norm) !== -1) continue
    const at = entry.norm.indexOf(norm)
    if (at === -1) continue
    taken.push(entry.norm)
    const item: JobSuggestion = { expr: entry.expr, series: entry.series, fine: entry.fine }
    if (at === 0) head.push(item)
    else tail.push(item)
  }

  return head.concat(tail).slice(0, limit)
}
