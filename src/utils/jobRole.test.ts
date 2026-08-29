/**
 * 「직무 → 직군」 분류기 스펙 — `plans/job-role-first.md` 16축 표 기준.
 *
 * 🔴 **케이스를 먼저 나열하고 코드를 썼다.** 통과시키려고 짠 게 아니라, 아래 목록이 먼저다.
 *
 * ## 구조 검증 (데이터가 300줄이라 눈으로는 못 지킨다)
 *  S1  모든 `fine.seriesId` 가 실존 계열을 가리킨다
 *  S2  모든 `dict.fineId` 가 실존 세밀을 가리킨다
 *  S3  `(expr, fineId)` 완전 중복 0
 *  S4  정규화 `expr` 중복은 `INTENTIONAL_AMBIGUOUS_EXPRS` 에 적힌 것만
 *  S5  `INTENTIONAL_AMBIGUOUS_EXPRS` 는 실제로 2개 이상 세밀에 걸려 있다 (목록이 썩지 않게)
 *  S6  14계열 전부 세밀 ≥1 · 표현 ≥1
 *  S7  세밀 42 전부 표현 ≥1
 *  S8  모든 `expr` 정규화 길이 ≥2
 *  S9  계열 14개 · 라벨 정확 · 세밀 42개
 *  S10 사전 총량 200~400 (급팽창 감지용)
 *  S11 필수 실측 어휘 전부 존재 + 각각 판정된다
 *
 * ## 1축 정상
 *  N1 `백엔드 개발자` → IT·개발
 *  N2 `간호사` → 의료·보건·복지
 *  N3 `9급 공무원` → 공공·공무원·군인
 *  N4 `전기기사` → 생산·기술·기능
 *  N5 `지상직` → 영업·판매·서비스
 *  N6 `마케터` → 마케팅·광고·홍보
 *
 * ## 2축 경계 (throw 금지)
 *  B1 빈 문자열 → none
 *  B2 공백만 → none
 *  B3 탭·개행만 → none
 *  B4 구분자만(`·/-()`) → none
 *  B5 1글자 → none
 *  B6 200자 초과·매치 없음 → none
 *  B7 200자 초과·매치 포함 → 판정되고 던지지 않는다
 *  B8 `undefined`/`null` 이 아닌 이상한 문자열(이모지·한자) → none
 *
 * ## 표기 변형 (사전 내부 요건)
 *  V1 `백엔드`/`백엔드 개발자`/`백엔드개발자`/`Backend`/`BE` → 전부 IT·개발
 *  V2 대소문자·앞뒤 공백 무시
 *
 * ## 6축 상태전이
 *  T1 `엔지니어` → ambiguous, 후보 2~3, 서로 다른 세밀
 *  T2 `성직자` → confident 의료·보건·복지 (사회복지·종교)
 *  T3 `크레인 기사` → confident 생산·기술·기능
 *  T4 `매니저` → none (일반어를 억지로 찍지 않는다)
 *  T5 `QA` → ambiguous 후보 2 (IT 품질 / 제조 품질보증)
 *
 * ## 최장 매치
 *  L1 `사업개발` → 경영·사무·행정 (🔴 IT 아님)
 *  L2 `금융공기업` → 금융·보험 (공공 아님)
 *  L3 `소방공무원` → 공공 계열 · 세밀은 경찰·소방·교도
 *  L4 `전자상거래` → 마케팅 (전기·전자 아님)
 *  L5 `신약개발`·`부동산개발` → 각각 연구·R&D · 건설·설비
 *  L6 `간호조무사` → 보건·의료 (`간호`·`간호사` 에 안 먹힘)
 *  L7 🔴 `청소년지도사` → 의료·보건·복지 (`청소` 오탐 회귀)
 *
 * ## 42번째 세밀 (생산·품질관리)
 *  Q1 `생산관리` → 생산·기술·기능 confident
 *  Q2 `품질관리`·`품질보증`·`품질경영`·`QC` → 같은 세밀
 *  Q3 `공정관리`(생산·품질관리)와 `공정개발`(제조 R&D·공학)이 서로를 안 가리킨다
 *
 * ## suggest
 *  G1 접두사 매치가 나온다
 *  G2 접두사 매치가 부분 포함 매치보다 앞
 *  G3 limit 준수 · 기본 8
 *  G4 빈 prefix·공백 prefix → []
 *  G5 limit 0·음수 → []
 *  G6 매치 없음 → []
 *  G7 여러 세밀에 걸린 표현은 목록에 1회만
 *
 * ## 16축 실행환경
 *  E1 소스에 ES2022+ 내장 API 미사용 (iOS 15.4 미만 크래시 방지)
 */
import { describe, it, expect } from 'vitest'
// 소스 원문 — 16축(실행환경) 가드가 코드 문자열을 직접 훑는다
import jobRoleSource from './jobRole.ts?raw'
import {
  JOB_SERIES,
  JOB_FINE_GROUPS,
  JOB_DICT,
  INTENTIONAL_AMBIGUOUS_EXPRS,
  MIN_EXPR_LENGTH,
  normalizeJobExpr,
  classifyJob,
  suggestJobs,
} from './jobRole'

/** 판정 결과에서 계열 라벨만 뽑는다 (`none` 이면 null) */
function seriesLabelOf(input: string): string | null {
  const result = classifyJob(input)
  return result.status === 'confident' ? result.series.label : null
}

/** 판정 결과에서 세밀 라벨만 뽑는다 */
function fineLabelOf(input: string): string | null {
  const result = classifyJob(input)
  return result.status === 'confident' ? result.fine.label : null
}

describe('jobRole — 구조 검증', () => {
  it('S1 모든 세밀의 seriesId 가 실존 계열을 가리킨다', () => {
    const seriesIds = JOB_SERIES.map((s) => s.id)
    const orphans = JOB_FINE_GROUPS.filter((f) => seriesIds.indexOf(f.seriesId) === -1)
    expect(orphans.map((f) => `${f.id}→${f.seriesId}`)).toEqual([])
  })

  it('S2 모든 사전 항목의 fineId 가 실존 세밀을 가리킨다', () => {
    const fineIds = JOB_FINE_GROUPS.map((f) => f.id)
    const orphans = JOB_DICT.filter((d) => fineIds.indexOf(d.fineId) === -1)
    expect(orphans.map((d) => `${d.expr}→${d.fineId}`)).toEqual([])
  })

  it('S3 (expr, fineId) 완전 중복 0', () => {
    const seen: string[] = []
    const dupes: string[] = []
    for (const entry of JOB_DICT) {
      const key = `${normalizeJobExpr(entry.expr)}|${entry.fineId}`
      if (seen.indexOf(key) !== -1) dupes.push(key)
      else seen.push(key)
    }
    expect(dupes).toEqual([])
  })

  it('S4 정규화 expr 중복은 의도적 모호 목록에만 허용된다', () => {
    const countByNorm = new Map<string, number>()
    for (const entry of JOB_DICT) {
      const norm = normalizeJobExpr(entry.expr)
      countByNorm.set(norm, (countByNorm.get(norm) ?? 0) + 1)
    }
    const allowed = INTENTIONAL_AMBIGUOUS_EXPRS.map(normalizeJobExpr)
    const unexpected: string[] = []
    countByNorm.forEach((count, norm) => {
      if (count > 1 && allowed.indexOf(norm) === -1) unexpected.push(norm)
    })
    expect(unexpected).toEqual([])
  })

  it('S5 의도적 모호 표현은 실제로 2개 이상 세밀에 걸려 있다', () => {
    for (const expr of INTENTIONAL_AMBIGUOUS_EXPRS) {
      const norm = normalizeJobExpr(expr)
      const fineIds: string[] = []
      for (const entry of JOB_DICT) {
        if (normalizeJobExpr(entry.expr) !== norm) continue
        if (fineIds.indexOf(entry.fineId) === -1) fineIds.push(entry.fineId)
      }
      expect(fineIds.length, `${expr} 는 세밀 2개 이상이어야 모호가 된다`).toBeGreaterThanOrEqual(2)
    }
  })

  it('S6 14계열 전부 세밀 ≥1 · 표현 ≥1', () => {
    for (const series of JOB_SERIES) {
      const fines = JOB_FINE_GROUPS.filter((f) => f.seriesId === series.id)
      expect(fines.length, `${series.label} 계열에 세밀이 없다`).toBeGreaterThanOrEqual(1)
      const fineIds = fines.map((f) => f.id)
      const exprs = JOB_DICT.filter((d) => fineIds.indexOf(d.fineId) !== -1)
      expect(exprs.length, `${series.label} 계열에 표현이 없다`).toBeGreaterThanOrEqual(1)
    }
  })

  it('S7 세밀 42 전부 표현 ≥1', () => {
    const empty = JOB_FINE_GROUPS.filter(
      (f) => JOB_DICT.filter((d) => d.fineId === f.id).length === 0,
    )
    expect(empty.map((f) => f.id)).toEqual([])
  })

  it('S8 모든 expr 정규화 길이 ≥2 (1글자 오탐 방지)', () => {
    const tooShort = JOB_DICT.filter(
      (d) => normalizeJobExpr(d.expr).length < MIN_EXPR_LENGTH,
    )
    expect(tooShort.map((d) => d.expr)).toEqual([])
  })

  it('S9 계열 14개 · 라벨 정확 · 세밀 42개', () => {
    expect(JOB_SERIES.map((s) => s.label)).toEqual([
      'IT·개발',
      '경영·사무·행정',
      '금융·보험',
      '의료·보건·복지',
      '교육',
      '공공·공무원·군인',
      '연구·R&D',
      '생산·기술·기능',
      '건설·설비',
      '영업·판매·서비스',
      '미디어·디자인·문화',
      '운송·물류',
      '농림어업',
      '마케팅·광고·홍보',
    ])
    expect(JOB_FINE_GROUPS).toHaveLength(42)
    // 계열 id 도 중복 없어야 저장키로 쓸 수 있다
    expect(new Set(JOB_SERIES.map((s) => s.id)).size).toBe(JOB_SERIES.length)
    expect(new Set(JOB_FINE_GROUPS.map((f) => f.id)).size).toBe(JOB_FINE_GROUPS.length)
  })

  // 범위 자체가 목적이 아니라 **급팽창 감지**가 목적이다 —
  // 어휘 보강으로 상한에 닿으면 그때 한 번 더 올리면 된다 (상한이 곧 설계 제약은 아니다)
  it('S10 사전 총량 200~400 (급팽창 감지용)', () => {
    // 하한 200 = 사전이 통째로 날아간 사고 감지. 상한 400 = 「몇 개 추가」가 아니라
    // **설계 재검토가 필요한 규모**의 감지다 — 운영 원문 기반 2차 보강(예정)이 몇십 개
    // 들어와도 안 걸리고, 400 을 넘기면 사전 구조(세밀 분할·매칭 성능)를 다시 본다.
    expect(JOB_DICT.length).toBeGreaterThanOrEqual(200)
    expect(JOB_DICT.length).toBeLessThanOrEqual(400)
  })
})

describe('jobRole — S11 필수 실측 어휘', () => {
  const REQUIRED = [
    '지상직',
    '간호사',
    '텔러',
    '행원',
    '원무',
    '사무행정',
    '공무원',
    '9급',
    '7급',
    '군무원',
    '공기업',
    'MD',
    '마케터',
    '백엔드',
    '프론트엔드',
    '전기기사',
    '크레인',
    '성직자',
    '교사',
    '임용',
    '승무원',
    '조리사',
    '용접',
  ]

  it('전부 사전에 존재한다', () => {
    const norms = JOB_DICT.map((d) => normalizeJobExpr(d.expr))
    const missing = REQUIRED.filter((expr) => norms.indexOf(normalizeJobExpr(expr)) === -1)
    expect(missing).toEqual([])
  })

  it('전부 확신 판정된다 (사전에만 있고 매칭에서 가려지면 소용없다)', () => {
    const unresolved = REQUIRED.filter((expr) => classifyJob(expr).status !== 'confident')
    expect(unresolved).toEqual([])
  })

  it('성직자는 사회복지·종교 세밀로 간다', () => {
    expect(fineLabelOf('성직자')).toBe('사회복지·종교')
    expect(seriesLabelOf('성직자')).toBe('의료·보건·복지')
  })
})

describe('classifyJob — 1축 정상', () => {
  it('N1 백엔드 개발자 → IT·개발', () => {
    expect(seriesLabelOf('백엔드 개발자')).toBe('IT·개발')
  })

  it('N2 간호사 → 의료·보건·복지', () => {
    expect(seriesLabelOf('간호사')).toBe('의료·보건·복지')
  })

  it('N3 9급 공무원 → 공공·공무원·군인', () => {
    expect(seriesLabelOf('9급 공무원')).toBe('공공·공무원·군인')
  })

  it('N4 전기기사 → 생산·기술·기능', () => {
    expect(seriesLabelOf('전기기사')).toBe('생산·기술·기능')
    expect(fineLabelOf('전기기사')).toBe('전기·전자')
  })

  it('N5 지상직 → 영업·판매·서비스', () => {
    expect(seriesLabelOf('지상직')).toBe('영업·판매·서비스')
    expect(fineLabelOf('지상직')).toBe('항공·여행·숙박 서비스')
  })

  it('N6 마케터 → 마케팅·광고·홍보', () => {
    expect(seriesLabelOf('마케터')).toBe('마케팅·광고·홍보')
  })

  it('confident 결과는 매치 근거(matched)를 돌려준다', () => {
    const result = classifyJob('간호사')
    expect(result.status).toBe('confident')
    if (result.status !== 'confident') return
    expect(result.matched).toBe('간호사')
  })
})

describe('classifyJob — 2축 경계', () => {
  it('B1 빈 문자열 → none', () => {
    expect(classifyJob('')).toEqual({ status: 'none' })
  })

  it('B2 공백만 → none', () => {
    expect(classifyJob('     ')).toEqual({ status: 'none' })
  })

  it('B3 탭·개행만 → none', () => {
    expect(classifyJob('\t\n  ')).toEqual({ status: 'none' })
  })

  it('B4 구분자만 → none', () => {
    expect(classifyJob('·/-().,[]{}')).toEqual({ status: 'none' })
  })

  it('B5 1글자 → none', () => {
    expect(classifyJob('개')).toEqual({ status: 'none' })
    expect(classifyJob('사')).toEqual({ status: 'none' })
    expect(classifyJob('a')).toEqual({ status: 'none' })
  })

  it('B6 200자 초과·매치 없음 → none (던지지 않는다)', () => {
    const long = new Array(251).join('a')
    expect(long.length).toBeGreaterThan(200)
    expect(() => classifyJob(long)).not.toThrow()
    expect(classifyJob(long)).toEqual({ status: 'none' })
  })

  it('B7 200자 초과·매치 포함 → 판정되고 던지지 않는다', () => {
    const long = `간호사${new Array(251).join('x')}`
    expect(long.length).toBeGreaterThan(200)
    expect(() => classifyJob(long)).not.toThrow()
    expect(seriesLabelOf(long)).toBe('의료·보건·복지')
  })

  it('B8 이모지·한자 같은 낯선 문자열 → none', () => {
    expect(classifyJob('🙂🙂')).toEqual({ status: 'none' })
    expect(classifyJob('龍龍龍')).toEqual({ status: 'none' })
  })
})

describe('classifyJob — 표기 변형', () => {
  it('V1 백엔드 5종 표기 → 전부 IT·개발', () => {
    const variants = ['백엔드', '백엔드 개발자', '백엔드개발자', 'Backend', 'BE']
    for (const v of variants) {
      expect(seriesLabelOf(v), `${v} 가 IT·개발이 아니다`).toBe('IT·개발')
    }
  })

  it('V2 대소문자·앞뒤 공백을 무시한다', () => {
    expect(seriesLabelOf('  backend  ')).toBe('IT·개발')
    expect(seriesLabelOf('BACKEND')).toBe('IT·개발')
    expect(seriesLabelOf(' be ')).toBe('IT·개발')
  })

  it('정규화는 공백·구분자를 지운다', () => {
    expect(normalizeJobExpr(' 백엔드 개발자 ')).toBe('백엔드개발자')
    expect(normalizeJobExpr('UI/UX·디자이너')).toBe('uiux디자이너')
    expect(normalizeJobExpr('R&D')).toBe('r&d')
  })
})

describe('classifyJob — 6축 상태전이', () => {
  it('T1 엔지니어 → ambiguous 후보 2~3 · 서로 다른 세밀', () => {
    const result = classifyJob('엔지니어')
    expect(result.status).toBe('ambiguous')
    if (result.status !== 'ambiguous') return
    expect(result.candidates.length).toBeGreaterThanOrEqual(2)
    expect(result.candidates.length).toBeLessThanOrEqual(3)
    const fineIds = result.candidates.map((c) => c.fine.id)
    expect(new Set(fineIds).size).toBe(fineIds.length)
    expect(fineIds).toContain('it-software')
  })

  it('T2 성직자 → confident (일반어가 아니라 고유 직업이라 후보를 안 늘린다)', () => {
    expect(classifyJob('성직자').status).toBe('confident')
    expect(seriesLabelOf('성직자')).toBe('의료·보건·복지')
  })

  it('T3 크레인 기사 → confident 생산·기술·기능', () => {
    expect(classifyJob('크레인 기사').status).toBe('confident')
    expect(seriesLabelOf('크레인 기사')).toBe('생산·기술·기능')
    expect(fineLabelOf('크레인 기사')).toBe('기계')
  })

  it('T4 매니저 → none (사전에 없는 일반어를 억지로 찍지 않는다)', () => {
    expect(classifyJob('매니저')).toEqual({ status: 'none' })
  })

  it('T5 QA → ambiguous 후보 2 (IT·소프트웨어 / 생산·품질관리)', () => {
    const result = classifyJob('QA')
    expect(result.status).toBe('ambiguous')
    if (result.status !== 'ambiguous') return
    expect(result.candidates.map((c) => c.fine.id).sort()).toEqual([
      'it-software',
      'mfg-quality',
    ])
  })
})

describe('classifyJob — 생산·품질관리 (42번째 세밀)', () => {
  it('생산관리 → 생산·기술·기능 confident', () => {
    expect(classifyJob('생산관리').status).toBe('confident')
    expect(seriesLabelOf('생산관리')).toBe('생산·기술·기능')
    expect(fineLabelOf('생산관리')).toBe('생산·품질관리')
  })

  it('품질관리·품질보증·QC 도 같은 세밀로 간다', () => {
    for (const expr of ['품질관리', '품질보증', '품질경영', 'QC']) {
      expect(fineLabelOf(expr), `${expr} 가 생산·품질관리가 아니다`).toBe('생산·품질관리')
    }
  })

  it('🔴 공정관리(생산·품질관리)와 공정개발(제조 R&D·공학)이 서로를 안 가리킨다', () => {
    expect(fineLabelOf('공정관리')).toBe('생산·품질관리')
    expect(fineLabelOf('공정개발')).toBe('제조 R&D·공학')
    expect(seriesLabelOf('공정관리')).toBe('생산·기술·기능')
    expect(seriesLabelOf('공정개발')).toBe('연구·R&D')
  })
})

describe('classifyJob — 최장 매치 우선', () => {
  it('L1 사업개발 → 경영·사무·행정 (🔴 IT·개발 아님)', () => {
    expect(seriesLabelOf('사업개발')).toBe('경영·사무·행정')
    expect(seriesLabelOf('사업개발')).not.toBe('IT·개발')
    expect(fineLabelOf('사업개발')).toBe('경영기획·전략')
    // `개발` 단독은 여전히 IT 로 간다 — 이겨야 할 상대가 실재함을 못박는다
    expect(seriesLabelOf('개발')).toBe('IT·개발')
  })

  it('L2 금융공기업 → 금융·보험 (공공 아님)', () => {
    expect(seriesLabelOf('금융공기업')).toBe('금융·보험')
    expect(fineLabelOf('금융공기업')).toBe('금융공공')
    expect(seriesLabelOf('공기업')).toBe('공공·공무원·군인')
  })

  it('L3 소방공무원 → 공공 계열 · 세밀은 경찰·소방·교도', () => {
    expect(seriesLabelOf('소방공무원')).toBe('공공·공무원·군인')
    expect(fineLabelOf('소방공무원')).toBe('경찰·소방·교도')
    expect(fineLabelOf('공무원')).toBe('공무원·공기업')
  })

  it('L4 전자상거래 → 마케팅 (전기·전자 아님)', () => {
    expect(seriesLabelOf('전자상거래')).toBe('마케팅·광고·홍보')
    expect(seriesLabelOf('전자')).toBe('생산·기술·기능')
  })

  it('L5 신약개발 → 연구·R&D · 부동산개발 → 건설·설비', () => {
    expect(seriesLabelOf('신약개발')).toBe('연구·R&D')
    expect(seriesLabelOf('부동산개발')).toBe('건설·설비')
  })

  it('L6 간호조무사 → 보건·의료 (간호·간호사에 가려지지 않는다)', () => {
    const result = classifyJob('간호조무사')
    expect(result.status).toBe('confident')
    if (result.status !== 'confident') return
    expect(result.matched).toBe('간호조무사')
    expect(result.fine.label).toBe('보건·의료')
  })

  it('🔴 L7 청소년지도사 → 의료·보건·복지 (청소 직군 오탐 회귀)', () => {
    expect(seriesLabelOf('청소년지도사')).toBe('의료·보건·복지')
    expect(seriesLabelOf('청소년지도사')).not.toBe('영업·판매·서비스')
    expect(fineLabelOf('청소년지도사')).toBe('사회복지·종교')
    expect(fineLabelOf('청소년상담사')).toBe('사회복지·종교')
    // 이겨야 할 상대가 실재함을 못박는다 — `청소` 단독은 여전히 개인서비스다
    expect(fineLabelOf('청소')).toBe('청소·기타 개인서비스')
  })

  it('logistics 는 2글자 CS 오탐을 이긴다', () => {
    expect(seriesLabelOf('logistics')).toBe('운송·물류')
    expect(seriesLabelOf('CS')).toBe('영업·판매·서비스')
  })
})

describe('suggestJobs', () => {
  it('G1 접두사 매치가 나온다', () => {
    const exprs = suggestJobs('간호').map((s) => s.expr)
    expect(exprs).toContain('간호')
    expect(exprs).toContain('간호사')
    expect(exprs).toContain('간호조무사')
  })

  it('G1 추천 항목은 계열·세밀을 함께 돌려준다', () => {
    const items = suggestJobs('간호')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.series.label).toBe('의료·보건·복지')
      expect(item.fine.id).toBe('health-medical')
    }
  })

  it('G2 접두사 매치가 부분 포함 매치보다 앞', () => {
    const exprs = suggestJobs('개발', 30).map((s) => s.expr)
    // `개발`·`개발자` 는 접두사 매치, `사업개발`·`연구개발` 은 중간 포함 매치
    const lastPrefix = Math.max(exprs.indexOf('개발'), exprs.indexOf('개발자'))
    const firstContains = Math.min(exprs.indexOf('사업개발'), exprs.indexOf('연구개발'))
    expect(lastPrefix).toBeGreaterThanOrEqual(0)
    expect(firstContains).toBeGreaterThan(lastPrefix)
    expect(normalizeJobExpr(exprs[0]).indexOf('개발')).toBe(0)
  })

  it('G3 limit 준수 · 기본 8', () => {
    expect(suggestJobs('개발', 3)).toHaveLength(3)
    expect(suggestJobs('개발').length).toBeLessThanOrEqual(8)
    expect(suggestJobs('사').length).toBeLessThanOrEqual(8)
  })

  it('G4 빈 prefix·공백 prefix → []', () => {
    expect(suggestJobs('')).toEqual([])
    expect(suggestJobs('   ')).toEqual([])
    expect(() => suggestJobs('')).not.toThrow()
  })

  it('G5 limit 0·음수 → []', () => {
    expect(suggestJobs('간호', 0)).toEqual([])
    expect(suggestJobs('간호', -1)).toEqual([])
  })

  it('G6 매치 없는 prefix → []', () => {
    expect(suggestJobs('zzzzzz')).toEqual([])
  })

  it('G7 여러 세밀에 걸린 표현은 목록에 1회만', () => {
    const exprs = suggestJobs('엔지니어', 20).map((s) => s.expr)
    expect(exprs.filter((e) => e === '엔지니어')).toHaveLength(1)
  })
})

describe('jobRole — 16축 실행환경', () => {
  it('E1 소스에 ES2022+ 내장 API 미사용 (iOS 15.4 미만 크래시 방지)', () => {
    // 주석은 뺀다 — 「금지 목록」을 적어둔 문서 주석 자체가 걸리면 가드가 무의미해진다
    const source = jobRoleSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:/])\/\/.*$/gm, '$1')
    // 주석 제거가 소스를 통째로 날려 가드가 헛도는 걸 막는다
    expect(source).toContain('export function classifyJob')
    const forbidden = [
      /Object\.hasOwn/,
      /Object\.groupBy/,
      /Map\.groupBy/,
      /structuredClone/,
      /Array\.fromAsync/,
      /\.at\(/,
      /\.findLast/,
      /\.toSorted\(/,
      /\.toReversed\(/,
      /\.toSpliced\(/,
    ]
    const hits = forbidden.filter((re) => re.test(source)).map((re) => re.source)
    expect(hits).toEqual([])
  })
})
