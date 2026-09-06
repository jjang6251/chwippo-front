/**
 * 「논문」 섹션 — 대학원 4칸(지도교수 · 연구 분야 · 논문 제목 · 논문 요약).
 *
 * 🔴 이 spec 의 심장은 **키 이름으로 고른다**는 것이다. 저장 자리(`extra_fields`)는 옛
 * 「추가 정보」와 같지만, 사전이 옛 배포본(취미·특기 등 6키가 살아 있는)이든 새 배포본
 * (대학원 4키만)이든 **화면 결과가 같아야 한다** — 프론트가 백보다 먼저·나중에 나갈 수 있다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 어떤 칸을 그리나 (`useThesisFields`)
 *   1. 🔴 옛 사전(추가 정보 6키 + 대학원 4키) → 대학원 4키만 고른다
 *   2. 🔴 새 사전(대학원 4키만) → 결과가 1과 같다
 *   3. 순서는 우리가 정한다 — 지도교수 · 연구 분야 · 논문 제목 · 논문 요약
 *   4. 사전에 일부만 있으면 있는 것만 (없는 키는 조용히 빠진다)
 *   5. 🔴 sensitive · forbidden · storage!=='extra' 는 골라도 빠진다
 *   6. 사전 호출 실패 → 빈 목록 (섹션이 통째로 안 열린다)
 *  ── 본문
 *   7. 저장된 값이 칸에 들어온다
 *   8. 🔴 저장은 `PATCH extra-fields` — 그 키 하나만, blur 에
 *   9. 🔴 빈 값은 `null` 로 지운다 (빈 문자열로 덮어쓰지 않는다)
 *  10. 🔴 논문 요약(1000자)은 textarea — 한 줄 입력으로는 못 쓴다
 *  11. 나머지 3칸은 한 줄 입력이고 사전의 maxLength 를 그대로 건다
 *  12. 라벨↔칸이 이어져 있다 (`getByLabelText`)
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FieldDictionary, FieldDictionaryEntry, UserProfile } from '@/api/myinfo'
import { ThesisSectionBody } from './ThesisSection'
import { useThesisFields } from '@/hooks/useThesisFields'

const h = vi.hoisted(() => ({
  profile: {} as Partial<UserProfile>,
  updateExtra: vi.fn(),
  dictionary: undefined as FieldDictionary | undefined,
  dictError: false,
}))

vi.mock('@/hooks/useMyinfo', () => ({
  useProfile: () => ({ data: h.profile }),
  useFieldDictionary: () => ({ data: h.dictionary, isError: h.dictError }),
  useUpdateExtraFields: () => ({ mutate: h.updateExtra }),
}))
vi.mock('@/stores/toastStore', () => ({ toast: { error: vi.fn(), show: vi.fn() } }))

const GRAD_FIELDS: FieldDictionaryEntry[] = [
  { key: 'academic_advisor', label: '지도교수', type: 'text', maxLength: 40, storage: 'extra' },
  { key: 'research_field', label: '연구 분야', type: 'text', maxLength: 100, storage: 'extra' },
  { key: 'paper_title', label: '논문 제목', type: 'text', maxLength: 200, storage: 'extra' },
  { key: 'paper_content', label: '논문 요약', type: 'text', maxLength: 1000, storage: 'extra' },
]

/** 옛 배포본 — 추가 정보 6키가 아직 살아 있다 */
const LEGACY_EXTRAS: FieldDictionaryEntry[] = [
  { key: 'hobby', label: '취미', type: 'text', maxLength: 200, storage: 'extra' },
  { key: 'specialty', label: '특기', type: 'text', maxLength: 200, storage: 'extra' },
  { key: 'available_start_date', label: '입사 가능 시기', type: 'date', storage: 'extra' },
  { key: 'preferred_region', label: '희망 근무 지역', type: 'select', options: ['서울'], storage: 'extra' },
  { key: 'visa_info', label: '비자 정보', type: 'text', maxLength: 200, storage: 'extra' },
  { key: 'language_speaking_level', label: '외국어 회화 수준', type: 'select', options: ['상'], storage: 'extra' },
]

const dict = (fields: FieldDictionaryEntry[]): FieldDictionary => ({ version: 'v', fields })
const keysOf = () => renderHook(() => useThesisFields()).result.current.map((f) => f.key)
const draw = (fields = GRAD_FIELDS) =>
  render(<ThesisSectionBody fields={fields} onSaved={vi.fn()} />)
const lastDto = () => h.updateExtra.mock.calls.at(-1)?.[0]

beforeEach(() => {
  h.profile = { user_id: 'u1' }
  h.dictionary = dict(GRAD_FIELDS)
  h.dictError = false
  h.updateExtra.mockReset()
})
afterEach(cleanup)

describe('useThesisFields — 사전에서 대학원 4키만 고른다', () => {
  it('1) 🔴 옛 사전(추가 정보 6키가 섞인)에서도 대학원 4키만 나온다', () => {
    h.dictionary = dict([...LEGACY_EXTRAS, ...GRAD_FIELDS])
    expect(keysOf()).toEqual(['academic_advisor', 'research_field', 'paper_title', 'paper_content'])
  })

  it('2) 🔴 새 사전(4키만)에서도 결과가 같다 — 프론트가 사전 배포 순서를 안 탄다', () => {
    h.dictionary = dict(GRAD_FIELDS)
    expect(keysOf()).toEqual(['academic_advisor', 'research_field', 'paper_title', 'paper_content'])
  })

  it('3) 순서는 사전 응답이 아니라 우리가 정한다', () => {
    h.dictionary = dict([...GRAD_FIELDS].reverse())
    expect(keysOf()).toEqual(['academic_advisor', 'research_field', 'paper_title', 'paper_content'])
  })

  it('4) 사전에 일부만 있으면 있는 것만 (없는 키는 조용히 빠진다)', () => {
    h.dictionary = dict([GRAD_FIELDS[0], GRAD_FIELDS[2]])
    expect(keysOf()).toEqual(['academic_advisor', 'paper_title'])
  })

  it("5) 🔴 sensitive · forbidden · storage!=='extra' 는 골라도 빠진다", () => {
    h.dictionary = dict([
      { ...GRAD_FIELDS[0], sensitive: true },
      { ...GRAD_FIELDS[1], forbidden: true },
      { ...GRAD_FIELDS[2], storage: 'column' },
      GRAD_FIELDS[3],
    ])
    expect(keysOf()).toEqual(['paper_content'])
  })

  it('6) 사전 호출이 실패하면 빈 목록 — 섹션이 통째로 안 열린다', () => {
    h.dictError = true
    expect(keysOf()).toEqual([])
  })

  it('6-a) 사전이 아직 없으면(로딩) 빈 목록', () => {
    h.dictionary = undefined
    expect(keysOf()).toEqual([])
  })
})

describe('논문 섹션 본문', () => {
  it('7) 저장된 값이 칸에 들어온다', () => {
    h.profile = { user_id: 'u1', extra_fields: { academic_advisor: '김교수', paper_title: '분산 시스템' } }
    draw()
    expect(screen.getByLabelText('지도교수')).toHaveValue('김교수')
    expect(screen.getByLabelText('논문 제목')).toHaveValue('분산 시스템')
    expect(screen.getByLabelText('연구 분야')).toHaveValue('')
  })

  it('8) 🔴 저장은 extra-fields PATCH — 그 키 하나만, blur 에 나간다', () => {
    draw()
    const advisor = screen.getByLabelText('지도교수')
    fireEvent.change(advisor, { target: { value: '김교수' } })
    // 타이핑 중에는 아무것도 안 나간다 (칸을 벗어날 때 저장한다)
    expect(h.updateExtra).not.toHaveBeenCalled()
    fireEvent.blur(advisor)
    expect(lastDto()).toEqual({ academic_advisor: '김교수' })
  })

  it('9) 🔴 빈 값은 null 로 지운다 (공백만도 마찬가지)', () => {
    h.profile = { user_id: 'u1', extra_fields: { research_field: '분산 시스템' } }
    draw()
    const field = screen.getByLabelText('연구 분야')
    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.blur(field)
    expect(lastDto()).toEqual({ research_field: null })
  })

  it('10) 🔴 논문 요약(1000자)은 textarea — 한 줄 입력으로는 못 쓴다', () => {
    draw()
    expect(screen.getByLabelText('논문 요약').tagName).toBe('TEXTAREA')
  })

  it('11) 나머지 3칸은 한 줄 입력이고 사전의 maxLength 를 그대로 건다', () => {
    draw()
    expect(screen.getByLabelText('지도교수').tagName).toBe('INPUT')
    expect(screen.getByLabelText('지도교수')).toHaveAttribute('maxlength', '40')
    expect(screen.getByLabelText('연구 분야')).toHaveAttribute('maxlength', '100')
    expect(screen.getByLabelText('논문 제목')).toHaveAttribute('maxlength', '200')
  })

  it('12) 사전이 준 라벨을 그대로 쓴다 (4칸 전부 라벨과 이어져 있다)', () => {
    draw()
    for (const label of ['지도교수', '연구 분야', '논문 제목', '논문 요약']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
})
