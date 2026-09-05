import { describe, it, expect } from 'vitest'
import { KOREA_REGIONS, REGION_LABEL, normalizeRegion } from './koreaRegions'

/**
 * 🔴 **저장값 = 짧은 이름 17개.** 백엔드 `ADDRESS_REGIONS` 가 이 문자열과 완전 일치만
 * 받고 그 외에는 400 을 준다 — 정식 표기(「서울특별시」)를 흘리면 주소 저장이 통째로 막힌다.
 * 그래서 이 spec 은 「정규화되나」가 아니라 **「계약 문자열만 나오나」**를 본다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 목록이 짧은 이름 17개이고 중복이 없다
 *  2. 🔴 어떤 입력을 넣어도 출력은 반드시 계약 목록 안이다
 *  3. 카카오 `sido` 실측값(짧은 이름)은 그대로 통과
 *  4. 정식 표기 → 짧은 이름
 *  5. 옛 이름·개칭 표기(강원도/강원특별자치도, 전라북도/전북특별자치도, 제주도) → 짧은 이름
 *  6. 공백 섞인 입력
 *  7. 빈 값·null·undefined → null
 *  8. 모르는 값 → null (400 을 부르는 값을 통과시키지 않는다)
 *  9. 표시 라벨은 17개 전부 있고, 저장값과 다르다 (라벨을 저장하면 400)
 */
describe('koreaRegions — 저장값은 짧은 이름', () => {
  it('짧은 이름 17개, 중복 없음', () => {
    expect(KOREA_REGIONS).toEqual([
      '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
      '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
    ])
    expect(new Set(KOREA_REGIONS).size).toBe(17)
  })

  it('🔴 어떤 입력이든 출력은 계약 목록 안이거나 null', () => {
    const inputs = [
      '서울', '서울특별시', '경기', '경기도', '강원도', '강원특별자치도',
      '전라북도', '전북특별자치도', '제주도', '제주특별자치도', '세종시',
      'Seoul', '강남구', '', '   ',
    ]
    for (const raw of inputs) {
      const out = normalizeRegion(raw)
      if (out !== null) expect(KOREA_REGIONS).toContain(out)
    }
  })

  it('카카오 sido 실측값(짧은 이름)은 그대로 통과한다', () => {
    for (const r of KOREA_REGIONS) {
      expect(normalizeRegion(r)).toBe(r)
    }
  })

  it('정식 표기 → 짧은 이름', () => {
    expect(normalizeRegion('서울특별시')).toBe('서울')
    expect(normalizeRegion('경기도')).toBe('경기')
    expect(normalizeRegion('부산광역시')).toBe('부산')
    expect(normalizeRegion('세종특별자치시')).toBe('세종')
    expect(normalizeRegion('충청북도')).toBe('충북')
    expect(normalizeRegion('경상남도')).toBe('경남')
  })

  it('옛 이름·개칭 표기도 같은 칸으로 접는다', () => {
    expect(normalizeRegion('강원도')).toBe('강원')
    expect(normalizeRegion('강원특별자치도')).toBe('강원')
    expect(normalizeRegion('전라북도')).toBe('전북')
    expect(normalizeRegion('전북특별자치도')).toBe('전북')
    expect(normalizeRegion('제주도')).toBe('제주')
    expect(normalizeRegion('제주특별자치도')).toBe('제주')
  })

  it('앞뒤 공백은 무시한다', () => {
    expect(normalizeRegion('  서울특별시  ')).toBe('서울')
  })

  it('빈 값·null·undefined → null', () => {
    expect(normalizeRegion('')).toBeNull()
    expect(normalizeRegion('   ')).toBeNull()
    expect(normalizeRegion(null)).toBeNull()
    expect(normalizeRegion(undefined)).toBeNull()
  })

  it('🔴 모르는 값은 통과시키지 않는다 — 백엔드 400 을 부를 값이다', () => {
    expect(normalizeRegion('Seoul')).toBeNull()
    expect(normalizeRegion('강남구')).toBeNull()
    expect(normalizeRegion('경기도 성남시')).toBeNull()
  })

  it('표시 라벨은 17개 전부 있고 저장값과 다르다 (라벨을 저장하면 400)', () => {
    expect(Object.keys(REGION_LABEL).sort()).toEqual([...KOREA_REGIONS].sort())
    for (const r of KOREA_REGIONS) {
      // 라벨은 저장값과 절대 같지 않다 — 같으면 화면 글자를 그대로 저장하는 실수가 안 잡힌다
      expect(REGION_LABEL[r]).not.toBe(r)
      // 라벨을 다시 넣어도 짧은 이름으로 돌아온다 (왕복 안전 — 별칭 표에 빠진 게 없다)
      expect(normalizeRegion(REGION_LABEL[r])).toBe(r)
    }
  })
})
