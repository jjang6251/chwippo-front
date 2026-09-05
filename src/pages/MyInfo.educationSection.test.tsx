/**
 * 내 정보 › 학력 — **최종 학력 먼저** (대장 44).
 *
 * 왜 바꿨나: 학력은 사람마다 **필요한 칸 수가 다르다**. 고졸에게 대학원 칸을 보여주는 건
 * 「나는 해당 없음」을 매번 다시 판단하게 하는 일이고, 박사에게 학교 하나짜리 목록은 어디에
 * 무엇을 넣어야 할지 알려 주지 않는다. 최종 학력 하나를 먼저 받고 거쳐 온 단계만 편다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 미선택 — 토글 아무것도 안 눌림 + 안내 + 단계 묶음 없음 + 예전처럼 목록 하나
 *  2. 🔴 토글 → `highest_degree` PATCH + 바로 눌림 (재조회를 기다리지 않는다)
 *  3. 이미 눌린 걸 다시 눌러도 PATCH 는 안 나간다
 *  4. 🔴 단계 묶음 5규칙 — 고졸 1 · 전문학사 2 · 학사 2 · 석사 3 · 박사 4 (순서 고정)
 *  5. 🔴 빈 단계의 「+ {단계} 추가」 → 그 단계 프리셋으로 모달 (전문학사의 대학교는 「전문대」)
 *  6. 항목이 단계에 들어가면 그 묶음 안에 보이고 「+ 추가」는 사라진다 · 단계 밖 항목은 「추가 학력」
 *  7. 단계 밖 항목이 없으면 「추가 학력」 제목은 없고 「+ 학력 추가」만 남는다
 *  8. 🔴 게이지 「최종 학력」 칩 → 고른 단계 프리셋으로 추가 모달
 *  9. 칩인데 아직 안 골랐으면 프리셋 없이 연다
 */
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Education, UserProfile } from '@/api/myinfo'
import { EducationsSection, type SectionIntent } from './MyInfo'

const h = vi.hoisted(() => ({
  profile: {} as Partial<UserProfile>,
  educations: [] as Education[],
  updateProfile: vi.fn(),
}))

vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useProfile: () => ({ data: h.profile }),
  useUpdateProfile: () => ({ mutate: h.updateProfile }),
  useEducations: () => ({ data: h.educations, isLoading: false }),
  useCreateEducation: () => ({ mutateAsync: vi.fn() }),
  useUpdateEducation: () => ({ mutateAsync: vi.fn() }),
  useDeleteEducation: () => ({ mutate: vi.fn() }),
}))
/** 실제 모달(vaul·자동완성) 대신 **어떤 프리셋으로 열렸는지**만 드러낸다 */
vi.mock('@/components/myinfo/EducationModal', () => ({
  EducationModal: ({ initial, initialDegree }: { initial?: Education | null; initialDegree?: string }) => (
    <div role="dialog" aria-label="학력 모달">
      {initial ? `edit:${initial.id}` : `add:${initialDegree ?? '(없음)'}`}
    </div>
  ),
}))
vi.mock('@/stores/toastStore', () => ({ toast: { error: vi.fn(), show: vi.fn() } }))

const edu = (over: Partial<Education> & { id: string; school_name: string }): Education => ({ ...over })

const draw = (intent?: SectionIntent | null) =>
  render(<EducationsSection sectionRef={() => {}} intent={intent} />)

const toggle = () => screen.getByRole('group', { name: '최종 학력' })
function chip(label: string): HTMLElement {
  const found = [...toggle().querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`칩을 찾지 못함: ${label}`)
  return found
}
/** 단계 묶음 이름들 — 토글 자신(role=group)은 뺀다 */
/** 단계 묶음 이름 — 「최종 학력」 토글도 role="group" 이라 그 요소 자체를 뺀다 */
const stageNames = () =>
  screen.getAllByRole('group')
    .filter((g) => g !== screen.queryByRole('group', { name: '최종 학력' }))
    .map((g) => g.getAttribute('aria-label'))
const stage = (name: string) => screen.getByRole('group', { name })
const modal = () => screen.getByRole('dialog', { name: '학력 모달' })
const HINT = '최종 학력을 고르면 필요한 학교만 보여드려요'

beforeEach(() => {
  h.profile = { user_id: 'u1' }
  h.educations = []
  h.updateProfile.mockReset()
})
afterEach(cleanup)

describe('최종 학력 토글', () => {
  it('1) 미선택 — 아무것도 안 눌려 있고 안내가 보이며 단계 묶음은 없다 (예전처럼 목록 하나)', () => {
    h.educations = [edu({ id: 'e1', school_name: 'OO대학교', degree: '대학교 (학사)' })]
    draw()
    expect(toggle().querySelector('[aria-pressed="true"]')).toBeNull()
    expect(screen.getByText(HINT)).toBeInTheDocument()
    expect(stageNames()).toEqual([])
    expect(screen.getByText('OO대학교')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /학력 추가$/ })).toBeInTheDocument()
  })

  it('2) 🔴 고르면 highest_degree 가 PATCH 되고 바로 눌린다', () => {
    draw()
    fireEvent.click(chip('학사'))
    expect(h.updateProfile.mock.calls.at(-1)?.[0]).toEqual({ highest_degree: 'bachelor' })
    expect(chip('학사')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('3) 이미 눌린 걸 다시 눌러도 PATCH 는 안 나간다', () => {
    h.profile = { user_id: 'u1', highest_degree: 'bachelor' }
    draw()
    fireEvent.click(chip('학사'))
    expect(h.updateProfile).not.toHaveBeenCalled()
  })

  it('선택지 5개 — 고졸 · 전문학사 · 학사 · 석사 · 박사', () => {
    draw()
    expect([...toggle().querySelectorAll('button')].map((b) => b.textContent?.trim()))
      .toEqual(['고졸', '전문학사', '학사', '석사', '박사'])
  })
})

describe('단계 묶음', () => {
  it.each([
    ['high', ['고등학교']],
    ['associate', ['고등학교', '대학교']],
    ['bachelor', ['고등학교', '대학교']],
    ['master', ['고등학교', '대학교', '대학원 석사']],
    ['doctor', ['고등학교', '대학교', '대학원 석사', '대학원 박사']],
  ] as const)('4) 🔴 %s → %j', (highest, expected) => {
    h.profile = { user_id: 'u1', highest_degree: highest }
    draw()
    expect(stageNames()).toEqual([...expected])
  })

  it('5) 🔴 빈 단계의 「+ {단계} 추가」 → 그 단계 프리셋으로 모달이 열린다', () => {
    h.profile = { user_id: 'u1', highest_degree: 'bachelor' }
    draw()
    fireEvent.click(within(stage('고등학교')).getByRole('button', { name: /고등학교 추가/ }))
    expect(modal()).toHaveTextContent('add:고등학교')
  })

  it('5-a) 전문학사의 대학교 묶음은 「전문대」 프리셋, 학사는 「대학교 (학사)」', () => {
    h.profile = { user_id: 'u1', highest_degree: 'associate' }
    const first = draw()
    fireEvent.click(within(stage('대학교')).getByRole('button', { name: /대학교 추가/ }))
    expect(modal()).toHaveTextContent('add:전문대')
    first.unmount()

    h.profile = { user_id: 'u1', highest_degree: 'bachelor' }
    draw()
    fireEvent.click(within(stage('대학교')).getByRole('button', { name: /대학교 추가/ }))
    expect(modal()).toHaveTextContent('add:대학교 (학사)')
  })

  it('6) 항목이 단계에 들어가면 그 묶음 안에 보이고 「+ 추가」는 사라진다 · 단계 밖 항목은 「추가 학력」', () => {
    h.profile = { user_id: 'u1', highest_degree: 'bachelor' }
    h.educations = [
      edu({ id: 'e1', school_name: 'OO대학교', degree: '대학교 (학사)' }),
      edu({ id: 'e2', school_name: 'OO고등학교', degree: '고등학교' }),
      edu({ id: 'e3', school_name: '어학원', degree: '기타' }),
    ]
    draw()
    const univ = stage('대학교')
    expect(within(univ).getByText('OO대학교')).toBeInTheDocument()
    expect(within(univ).queryByRole('button', { name: /대학교 추가/ })).toBeNull()
    expect(within(stage('고등학교')).getByText('OO고등학교')).toBeInTheDocument()
    expect(screen.getByText('추가 학력')).toBeInTheDocument()
    expect(screen.getByText('어학원')).toBeInTheDocument()
  })

  it('7) 단계 밖 항목이 없으면 「추가 학력」 제목은 없고 「+ 학력 추가」만 남는다', () => {
    h.profile = { user_id: 'u1', highest_degree: 'high' }
    draw()
    expect(screen.queryByText('추가 학력')).toBeNull()
    expect(screen.getByRole('button', { name: /학력 추가$/ })).toBeInTheDocument()
  })

  it('묶음 안 항목을 누르면 편집 모달이 그 항목으로 열린다', () => {
    h.profile = { user_id: 'u1', highest_degree: 'high' }
    h.educations = [edu({ id: 'e2', school_name: 'OO고등학교', degree: '고등학교' })]
    draw()
    fireEvent.click(within(stage('고등학교')).getByRole('button', { name: '편집' }))
    expect(modal()).toHaveTextContent('edit:e2')
  })
})

describe('게이지 「최종 학력」 칩', () => {
  it('8) 🔴 고른 단계가 있으면 그 단계 프리셋으로 추가 모달이 열린다', () => {
    h.profile = { user_id: 'u1', highest_degree: 'master' }
    draw({ section: 'education', opts: { edit: true }, seq: 1 })
    expect(modal()).toHaveTextContent('add:대학원 (석사)')
  })

  it('9) 아직 안 골랐으면 프리셋 없이 연다', () => {
    draw({ section: 'education', opts: { edit: true }, seq: 1 })
    expect(modal()).toHaveTextContent('add:(없음)')
  })
})
