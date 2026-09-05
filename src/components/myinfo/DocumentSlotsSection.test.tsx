/**
 * 「지원 서류」 — 고정 슬롯 4행 + 항목에서 첨부한 서류 + 기타 파일.
 *
 * 🔴 이 spec 의 심장은 둘이다.
 *   ① **업로드 전 차단** — R2 에 올린 뒤 서버가 400 을 주면 고아 파일과 낭비된 대기 시간만
 *      남는다. 규칙 위반은 `uploadFile` 이 호출되기 **전에** 막혀야 한다.
 *   ② **이중 저장 금지** — 어학 성적표·성적/졸업증명서는 슬롯이 아니라 **항목**이 원본이다
 *      (CEO 2026-09-05). 슬롯 목록에 그 셋이 되살아나면 같은 서류가 두 군데 저장된다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 렌더 (슬롯)
 *   1. 슬롯 4행 — 증명사진·이력서·포트폴리오·경력기술서
 *   2. 🔴 지운 슬롯 3종(성적증명서·졸업증명서·어학성적표)은 자리가 없다
 *   3. 파일 없는 슬롯은 「없어요」
 *   4. 파일이 있으면 첫 줄 = 지원서에 들어갈 이름 · 둘째 줄 = 원본 · 크기 · 날짜, 버튼은 [교체]
 *   5. 규칙(형식·크기)을 **파일 고르기 전에** 보여준다 — accept 속성 + 행 안내
 *   6. 증명사진 행에 3:4 안내
 *   7. suggested_file_name 을 행에 표시
 *  ── 업로드 전 차단
 *   8. 🔴 증명사진에 PDF → 형식 문구 · uploadFile 호출 0
 *   9. 🔴 이력서에 11MB PDF → **숫자 포함** 크기 문구 · uploadFile 호출 0
 *  10. 포트폴리오는 20MB 까지 통과 (슬롯마다 한도가 다르다)
 *  11. 빈 파일은 막는다
 *  ── 저장
 *  12. 업로드 성공 → PUT body { fileUrl · fileSize · originalName · mime }
 *  13. 🔴 포트폴리오 링크 저장 → body 에 **linkUrl 만** (파일 필드 동봉 금지)
 *  14. 저장된 링크가 있으면 링크 모드로 열린다
 *  ── 슬롯 삭제
 *  15. [삭제] → 확인 모달이 뜨고 아직 아무것도 지우지 않는다
 *  16. 확인 → deleteDoc(id)
 *  17. 취소 → 아무것도 지우지 않는다
 *  ── 항목에서 첨부한 서류
 *  18. 첨부가 하나도 없으면 한 줄 안내
 *  19. 어학 — 첫 줄 = suggested_file_name · 부제 「TOEIC · 성적표」
 *  20. 🔴 학력 — 성적증명서 · 졸업(예정)증명서가 **각각 한 행**
 *  21. 학력 옛 `file_url` 은 「기타 증빙」 행으로 남는다
 *  22. 자격증 · 수상도 모인다
 *  23. 파일 URL 이 없고 메타만 있으면 [열기] 를 감춘다 (데모)
 *  24. [항목으로] → 원본 섹션으로 점프
 *  25. 🔴 [삭제] 확인 → **그 칸만** 비운다 (항목 row 는 남는다)
 *  26. 취소 → 아무 mutation 도 부르지 않는다
 *  ── 이력서·경력기술서 링크 (CEO 2026-09-05)
 *  27. 🔴 이력서·경력기술서 행에 파일/링크 토글이 있고, 증명사진에는 없다
 *  28. 경력기술서 링크 저장 → body 에 linkUrl 만 · 「파일로 받아요」 안내는 링크 모드에서만
 *  29. 포트폴리오 링크 모드에는 그 안내가 없다 (링크가 기본인 자리)
 *  ── 이름 · 상태 (스크린리더가 「올리기」 4개를 구분할 수 있나)
 *  30. 🔴 버튼 접근 이름에 자리 이름이 붙는다 — 「증명사진 올리기」·「이력서 교체」
 *  31. [열기] 는 새 탭이라고 이름에 말한다
 *  32. 🔴 업로드 전 차단 사유가 **그 행 안에** role=alert 로 남는다 (토스트는 사라진다)
 *  33. 다른 자리에는 그 오류가 없다
 *  34. 🔴 불러오는 중에는 「없어요」 대신 스켈레톤 4행 (없다고 읽고 다시 올리는 일 방지)
 *  35. 불러오기 실패면 에러 한 줄 (「없어요」 4행이 아니다)
 *  36. 링크 칸 — inputMode=url · spellCheck=false · autoComplete=off, 안내와 aria-describedby 로 연결
 *  37. 파일명 예시 `<code>` 는 translate="no" (번역되면 예시가 거짓이 된다)
 *  ── 🔴 지원서에 들어갈 이름이 주인공 (CEO 2026-09-06)
 *      사용자가 궁금한 건 **회사가 받을 이름**이지 자기 하드디스크의 파일명이 아니다.
 *  38. 슬롯 첫 줄 = suggested_file_name · 둘째 줄 = 「원본 {원본명} · 크기 · 날짜」
 *  39. 「지원서엔 … 로 들어가요」 줄은 사라진다 — 첫 줄이 이미 같은 말이다
 *  40. 🔴 이름 접두가 없으면(`_` 없음) 「이름을 채우면」 안내 · 예시는 슬롯마다 다르다
 *  41. 접두가 붙어 있으면 그 안내는 없다 (다 된 일을 시키지 않는다)
 *  42. 옛 데이터라 원본명이 없으면 둘째 줄에서 「원본」 부분만 빠진다
 *  43. 항목 첨부 — 학력 성적증명서 첫 줄 = transcript_suggested_file_name
 *  44. 제안 이름이 없는 자격증은 지금 표시 그대로 (「{항목} · {종류}」)
 *  45. 링크 슬롯은 무변경 — 이름 줄도, 「원본」도, 안내도 없다
 *  46. 섹션 상단 안내는 예시 대신 「아래 이름으로 들어가요」
 */
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Award, Cert, Education, LanguageCert, MyDocument } from '@/api/myinfo'
import { DocumentSlotsBody } from './DocumentSlotsSection'

const h = vi.hoisted(() => ({
  documents: [] as MyDocument[],
  docsLoading: false,
  docsError: false,
  langCerts: [] as LanguageCert[],
  educations: [] as Education[],
  certs: [] as Cert[],
  awards: [] as Award[],
  putSlot: vi.fn(),
  deleteDoc: vi.fn(),
  updateEducation: vi.fn(),
  updateLangCert: vi.fn(),
  updateCert: vi.fn(),
  updateAward: vi.fn(),
  uploadFile: vi.fn(),
  toastError: vi.fn(),
  onJump: vi.fn(),
}))

vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useDocuments: () => ({ data: h.documents, isLoading: h.docsLoading, isError: h.docsError }),
  useLangCerts: () => ({ data: h.langCerts }),
  useEducations: () => ({ data: h.educations }),
  useCerts: () => ({ data: h.certs }),
  useAwards: () => ({ data: h.awards }),
  usePutDocumentSlot: () => ({ mutateAsync: h.putSlot }),
  useDeleteDocument: () => ({ mutate: h.deleteDoc }),
  useUpdateEducation: () => ({ mutate: h.updateEducation }),
  useUpdateLangCert: () => ({ mutate: h.updateLangCert }),
  useUpdateCert: () => ({ mutate: h.updateCert }),
  useUpdateAward: () => ({ mutate: h.updateAward }),
}))
vi.mock('@/api/files', () => ({ uploadFile: h.uploadFile }))
vi.mock('@/stores/toastStore', () => ({ toast: { error: h.toastError, show: vi.fn() } }))

const draw = () => render(
  <DocumentSlotsBody onJump={h.onJump}><p>기타 파일 자리</p></DocumentSlotsBody>,
)

/** 슬롯 라벨이 들어 있는 행 */
function row(label: string): HTMLElement {
  const heading = screen.getByText(label)
  const found = heading.closest('div.rounded-xl')
  if (!found) throw new Error(`행을 찾지 못함: ${label}`)
  return found as HTMLElement
}

/** 항목 첨부 행은 원본 파일명이 없어 「{항목} · {종류}」로 스스로를 설명한다 */
function attachedRow(itemLabel: string, kind: string): HTMLElement {
  const button = screen.getByRole('button', { name: `${itemLabel} ${kind} 항목으로` })
  const found = button.closest('div.rounded-xl')
  if (!found) throw new Error(`첨부 행을 찾지 못함: ${itemLabel} ${kind}`)
  return found as HTMLElement
}

/**
 * 행 본문 칸(왼쪽 라벨 칸이 아니라)의 **첫 줄** — 「주인공」 자리.
 * 「첫 줄이 무엇인가」가 이번 변경의 전부라 텍스트 존재가 아니라 **자리**로 검증한다.
 */
function mainLine(rowEl: HTMLElement): HTMLElement {
  const p = rowEl.querySelector('div.flex-1 p')
  if (!p) throw new Error('본문 첫 줄을 찾지 못함')
  return p as HTMLElement
}

function pick(slot: string, file: File) {
  const input = screen.getByTestId(`slot-input-${slot}`) as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

/** jsdom File 은 size 를 내용으로만 정하므로 명시적으로 덮는다 */
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const MB = 1024 * 1024

const resumeDoc: MyDocument = {
  id: 'd-resume', title: '이력서', slot: 'resume',
  file_url: 'https://files.test/abc.pdf', file_size_bytes: 400 * 1024,
  created_at: '2026-09-01T00:00:00Z',
  original_name: '이력서_최종본.pdf', mime: 'application/pdf',
  suggested_file_name: '홍길동_이력서.pdf',
}

/** 기본 인적사항에 이름이 비어 서버가 접두를 못 붙인 상태 — 제안 이름이 `_` 없이 시작한다 */
const namelessResume: MyDocument = {
  ...resumeDoc,
  id: 'd-resume-noname',
  original_name: 'resume_v3.pdf',
  suggested_file_name: '이력서.pdf',
}

beforeEach(() => {
  h.documents = []
  h.docsLoading = false
  h.docsError = false
  h.langCerts = []
  h.educations = []
  h.certs = []
  h.awards = []
  h.putSlot.mockReset().mockResolvedValue(undefined)
  h.deleteDoc.mockReset()
  h.updateEducation.mockReset()
  h.updateLangCert.mockReset()
  h.updateCert.mockReset()
  h.updateAward.mockReset()
  h.uploadFile.mockReset().mockResolvedValue({ fileUrl: 'https://files.test/new.pdf', fileSize: 1234 })
  h.toastError.mockReset()
  h.onJump.mockReset()
})
afterEach(cleanup)

describe('렌더', () => {
  it('슬롯 4행 + 두 묶음 제목', () => {
    draw()
    for (const label of [
      '증명사진', '이력서', '포트폴리오', '경력기술서',
      '항목에서 첨부한 서류', '기타 파일',
    ]) {
      expect(screen.getByText(label), label).toBeInTheDocument()
    }
  })

  it('🔴 지운 슬롯 3종은 자리가 없다 — 항목이 원본이라 이중 저장이 된다', () => {
    draw()
    for (const label of ['성적증명서', '졸업증명서', '어학성적표']) {
      expect(screen.queryByText(label), label).toBeNull()
    }
    expect(screen.queryByTestId('slot-input-transcript')).toBeNull()
    expect(screen.queryByTestId('slot-input-graduation')).toBeNull()
    expect(screen.queryByTestId('slot-input-language_score')).toBeNull()
  })

  it('파일 없는 슬롯은 「없어요」', () => {
    draw()
    expect(within(row('이력서')).getByText('없어요')).toBeInTheDocument()
    expect(screen.getAllByText('없어요')).toHaveLength(4) // 고정 슬롯 4행 전부
  })

  it('파일이 있으면 원본 파일명 · 크기 · 날짜를 보여주고 버튼이 [교체] 로 바뀐다', () => {
    h.documents = [resumeDoc]
    draw()
    const r = row('이력서')
    expect(within(r).getByText(/이력서_최종본\.pdf/)).toBeInTheDocument()
    expect(within(r).getByText(/400KB/)).toBeInTheDocument()
    expect(within(r).getByText(/2026-09-01/)).toBeInTheDocument()
    // 접근 이름에는 어느 자리인지가 붙는다 — 행 4개의 버튼이 전부 「교체」면 목록에서 구분이 안 된다
    expect(within(r).getByRole('button', { name: '이력서 교체' })).toBeInTheDocument()
    expect(within(r).getByRole('link', { name: '이력서 열기 (새 탭)' })).toHaveAttribute('href', 'https://files.test/abc.pdf')
  })

  it('규칙을 파일 고르기 전에 보여준다 — accept 속성 + 행 안내', () => {
    draw()
    expect(screen.getByTestId('slot-input-photo')).toHaveAttribute('accept', '.jpg,.jpeg,.png')
    expect(screen.getByTestId('slot-input-resume')).toHaveAttribute('accept', '.pdf')
    expect(within(row('증명사진')).getByText('JPG · PNG · 5MB 이하')).toBeInTheDocument()
    expect(within(row('포트폴리오')).getByText('PDF · 20MB 이하')).toBeInTheDocument()
  })

  it('증명사진 행에 3:4 안내', () => {
    draw()
    expect(within(row('증명사진')).getByText('3:4 비율 · 2MB 이하가 대부분 폼에서 통해요')).toBeInTheDocument()
  })

  it('suggested_file_name 을 행에 표시한다', () => {
    h.documents = [resumeDoc]
    draw()
    expect(within(row('이력서')).getByText(/홍길동_이력서\.pdf/)).toBeInTheDocument()
  })
})

describe('🔴 업로드 전 차단', () => {
  it('증명사진에 PDF → 형식 문구 · 업로드 호출 0', () => {
    draw()
    pick('photo', fakeFile('a.pdf', 'application/pdf', 1024))
    expect(h.toastError).toHaveBeenCalledWith('증명사진은(는) JPG · PNG 만 올릴 수 있어요.')
    expect(h.uploadFile).not.toHaveBeenCalled()
    expect(h.putSlot).not.toHaveBeenCalled()
  })

  it('이력서에 11MB PDF → 숫자 포함 크기 문구 · 업로드 호출 0', () => {
    draw()
    pick('resume', fakeFile('big.pdf', 'application/pdf', 11 * MB))
    expect(h.toastError).toHaveBeenCalledWith(
      '이력서은(는) 10MB 이하만 올릴 수 있어요. (선택한 파일 11.0MB)',
    )
    expect(h.uploadFile).not.toHaveBeenCalled()
  })

  it('포트폴리오는 20MB 까지 통과 — 슬롯마다 한도가 다르다', async () => {
    draw()
    pick('portfolio', fakeFile('port.pdf', 'application/pdf', 15 * MB))
    await waitFor(() => expect(h.uploadFile).toHaveBeenCalled())
    expect(h.toastError).not.toHaveBeenCalled()
  })

  it('빈 파일은 막는다', () => {
    draw()
    pick('resume', fakeFile('empty.pdf', 'application/pdf', 0))
    expect(h.toastError).toHaveBeenCalledWith('빈 파일은 올릴 수 없어요.')
    expect(h.uploadFile).not.toHaveBeenCalled()
  })
})

describe('저장', () => {
  it('업로드 성공 → PUT body { fileUrl · fileSize · originalName · mime }', async () => {
    draw()
    pick('resume', fakeFile('내이력서.pdf', 'application/pdf', 2 * MB))
    await waitFor(() => expect(h.putSlot).toHaveBeenCalled())
    expect(h.uploadFile).toHaveBeenCalledWith('myinfo/document', expect.any(File))
    expect(h.putSlot.mock.calls.at(-1)?.[0]).toEqual({
      slot: 'resume',
      dto: {
        fileUrl: 'https://files.test/new.pdf',
        fileSize: 1234,
        originalName: '내이력서.pdf',
        mime: 'application/pdf',
      },
    })
  })

  it('🔴 포트폴리오 링크 저장 → body 에 linkUrl 만', async () => {
    draw()
    const r = row('포트폴리오')
    fireEvent.click(within(r).getByRole('button', { name: '링크' }))
    fireEvent.change(screen.getByLabelText('포트폴리오 링크'), {
      target: { value: 'https://portfolio.test/me' },
    })
    fireEvent.click(within(row('포트폴리오')).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(h.putSlot).toHaveBeenCalled())
    expect(h.putSlot.mock.calls.at(-1)?.[0]).toEqual({
      slot: 'portfolio',
      dto: { linkUrl: 'https://portfolio.test/me' },
    })
    expect(h.uploadFile).not.toHaveBeenCalled()
  })

  it('저장된 링크가 있으면 링크 모드로 열린다', () => {
    h.documents = [{
      id: 'd-p', title: '포트폴리오', slot: 'portfolio', file_url: null,
      link_url: 'https://notion.test/p', created_at: '2026-09-01T00:00:00Z',
    }]
    draw()
    expect(screen.getByLabelText('포트폴리오 링크')).toHaveValue('https://notion.test/p')
  })
})

describe('이력서·경력기술서 링크 (CEO 2026-09-05)', () => {
  const NOTE = '대부분 지원서는 파일로 받아요 — 링크만 있으면 파일 칸은 비워 둬요'

  it('27) 🔴 이력서·경력기술서 행에 파일/링크 토글이 있고, 증명사진에는 없다', () => {
    draw()
    expect(within(row('이력서')).getByRole('group', { name: '이력서 등록 방식' })).toBeInTheDocument()
    expect(within(row('경력기술서')).getByRole('group', { name: '경력기술서 등록 방식' })).toBeInTheDocument()
    expect(within(row('증명사진')).queryByRole('group')).toBeNull()
  })

  it('28) 경력기술서 링크 저장 → body 에 linkUrl 만 · 안내는 링크 모드에서만', async () => {
    draw()
    expect(screen.queryByText(NOTE)).toBeNull()
    fireEvent.click(within(row('경력기술서')).getByRole('button', { name: '링크' }))
    expect(within(row('경력기술서')).getByText(NOTE)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('경력기술서 링크'), {
      target: { value: 'https://notion.test/career' },
    })
    fireEvent.click(within(row('경력기술서')).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(h.putSlot).toHaveBeenCalled())
    expect(h.putSlot.mock.calls.at(-1)?.[0]).toEqual({
      slot: 'career_statement',
      dto: { linkUrl: 'https://notion.test/career' },
    })
    expect(h.uploadFile).not.toHaveBeenCalled()
  })

  it('29) 포트폴리오 링크 모드에는 그 안내가 없다 (링크가 기본인 자리)', () => {
    draw()
    fireEvent.click(within(row('포트폴리오')).getByRole('button', { name: '링크' }))
    expect(screen.queryByText(NOTE)).toBeNull()
  })
})

describe('슬롯 삭제', () => {
  it('[삭제] → 확인 모달이 뜨고 아직 아무것도 지우지 않는다', () => {
    h.documents = [resumeDoc]
    draw()
    fireEvent.click(screen.getByRole('button', { name: '이력서 삭제' }))
    expect(screen.getByRole('dialog', { name: '지원 서류를 삭제할까요?' })).toBeInTheDocument()
    expect(h.deleteDoc).not.toHaveBeenCalled()
  })

  it('확인 → deleteDoc(id)', () => {
    h.documents = [resumeDoc]
    draw()
    fireEvent.click(screen.getByRole('button', { name: '이력서 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '지원 서류를 삭제할까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(h.deleteDoc).toHaveBeenCalledWith('d-resume')
  })

  it('취소 → 아무것도 지우지 않는다', () => {
    h.documents = [resumeDoc]
    draw()
    fireEvent.click(screen.getByRole('button', { name: '이력서 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '지원 서류를 삭제할까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(h.deleteDoc).not.toHaveBeenCalled()
  })
})

describe('항목에서 첨부한 서류', () => {
  const eduWithBoth: Education = {
    id: 'ed1', school_name: 'OO대학교',
    transcript_file_url: 'https://files.test/transcript.pdf',
    transcript_file_size_bytes: 300 * 1024,
    transcript_suggested_file_name: '홍길동_성적증명서.pdf',
    graduation_file_url: 'https://files.test/graduation.pdf',
    graduation_file_size_bytes: 200 * 1024,
  }

  it('첨부가 하나도 없으면 한 줄 안내', () => {
    draw()
    expect(
      screen.getByText('어학·학력·자격증·수상 항목에서 파일을 붙이면 여기 모여요'),
    ).toBeInTheDocument()
  })

  it('어학 — 「TOEIC · 성적표」 + 지원서에 들어갈 이름', () => {
    h.langCerts = [{
      id: 'lc1', cert_type: 'TOEIC', file_url: 'https://files.test/toeic.pdf',
      file_size_bytes: 512 * 1024, suggested_file_name: '홍길동_TOEIC_성적표.pdf',
    }]
    draw()
    const r = attachedRow('TOEIC', '성적표')
    expect(r.textContent).toContain('TOEIC · 성적표')
    expect(r.textContent).toContain('512KB')
    expect(within(r).getByText(/홍길동_TOEIC_성적표\.pdf/)).toBeInTheDocument()
    expect(within(r).getByRole('link', { name: 'TOEIC 성적표 열기 (새 탭)' }))
      .toHaveAttribute('href', 'https://files.test/toeic.pdf')
    expect(
      screen.queryByText('어학·학력·자격증·수상 항목에서 파일을 붙이면 여기 모여요'),
    ).toBeNull()
  })

  it('🔴 학력 — 성적증명서 · 졸업(예정)증명서가 각각 한 행', () => {
    h.educations = [eduWithBoth]
    draw()
    expect(attachedRow('OO대학교', '성적증명서').textContent).toContain('OO대학교 · 성적증명서')
    expect(attachedRow('OO대학교', '졸업(예정)증명서').textContent).toContain('OO대학교 · 졸업(예정)증명서')
  })

  it('학력 옛 file_url 은 「기타 증빙」 행으로 남는다', () => {
    h.educations = [{
      id: 'ed1', school_name: 'OO대학교',
      file_url: 'https://files.test/old.pdf', file_size_bytes: 100 * 1024,
    }]
    draw()
    expect(attachedRow('OO대학교', '기타 증빙').textContent).toContain('OO대학교 · 기타 증빙')
  })

  it('자격증 · 수상도 모인다', () => {
    h.certs = [{ id: 'c1', name: '정보처리기사', file_url: 'https://files.test/cert.pdf' }]
    h.awards = [{ id: 'a1', contest_name: '데이터 공모전', file_url: 'https://files.test/award.pdf' }]
    draw()
    expect(attachedRow('정보처리기사', '자격증')).toBeInTheDocument()
    expect(attachedRow('데이터 공모전', '상장')).toBeInTheDocument()
  })

  it('파일 URL 이 없고 메타만 있으면 [열기] 를 감춘다 (데모)', () => {
    h.educations = [{
      id: 'ed1', school_name: 'OO대학교',
      transcript_file_size_bytes: 800 * 1024,
      transcript_suggested_file_name: '김취뽀_성적증명서.pdf',
    }]
    draw()
    const r = attachedRow('OO대학교', '성적증명서')
    expect(within(r).queryByRole('link', { name: /열기/ })).toBeNull()
    expect(r.textContent).toContain('800KB')
  })

  it('[항목으로] → 원본 섹션으로 점프', () => {
    h.educations = [eduWithBoth]
    h.langCerts = [{ id: 'lc1', cert_type: 'TOEIC', file_url: 'https://files.test/toeic.pdf' }]
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'TOEIC 성적표 항목으로' }))
    expect(h.onJump).toHaveBeenCalledWith('language-certs')
    fireEvent.click(screen.getByRole('button', { name: 'OO대학교 졸업(예정)증명서 항목으로' }))
    expect(h.onJump).toHaveBeenCalledWith('education')
  })

  it('🔴 [삭제] 확인 → 그 칸만 비운다 (항목 row 는 남는다)', () => {
    h.educations = [eduWithBoth]
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'OO대학교 성적증명서 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '첨부 파일을 삭제할까요?' })
    expect(h.updateEducation).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(h.updateEducation).toHaveBeenCalledWith({
      id: 'ed1',
      dto: { transcript_file_url: '', transcript_file_size_bytes: null },
    })
  })

  it('어학 첨부 삭제는 어학 mutation 만 부른다', () => {
    h.langCerts = [{ id: 'lc1', cert_type: 'TOEIC', file_url: 'https://files.test/toeic.pdf' }]
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'TOEIC 성적표 삭제' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '첨부 파일을 삭제할까요?' }))
        .getByRole('button', { name: '삭제' }),
    )
    expect(h.updateLangCert).toHaveBeenCalledWith({
      id: 'lc1',
      dto: { file_url: '', file_size_bytes: null },
    })
    expect(h.updateEducation).not.toHaveBeenCalled()
  })

  it('취소 → 아무 mutation 도 부르지 않는다', () => {
    h.educations = [eduWithBoth]
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'OO대학교 성적증명서 삭제' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '첨부 파일을 삭제할까요?' }))
        .getByRole('button', { name: '취소' }),
    )
    expect(h.updateEducation).not.toHaveBeenCalled()
  })
})

/**
 * 🔴 자리가 4개인데 버튼 이름이 전부 「올리기」면, 스크린리더 버튼 목록에서 어느 자리인지
 * 고를 수 없다. 그리고 불러오는 중의 「없어요」는 **없다는 말**이라 방금 올린 사람이 또 올린다.
 */
describe('이름 · 상태', () => {
  it('30) 🔴 버튼 접근 이름에 자리 이름이 붙는다 — 「증명사진 올리기」·「이력서 교체」', () => {
    h.documents = [resumeDoc]
    draw()
    expect(screen.getByRole('button', { name: '증명사진 올리기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이력서 교체' })).toBeInTheDocument()
    // 이름이 같은 버튼이 둘 이상이면 `getByRole` 자체가 던진다 — 그게 곧 구분 가능 검증이다
    expect(screen.getAllByRole('button', { name: /올리기$/ })).toHaveLength(3)
  })

  it('31) [열기] 는 새 탭이라고 이름에 말한다', () => {
    h.documents = [resumeDoc]
    draw()
    const link = screen.getByRole('link', { name: '이력서 열기 (새 탭)' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('32) 🔴 업로드 전 차단 사유가 그 행 안에 alert 로 남는다', () => {
    draw()
    pick('photo', fakeFile('a.pdf', 'application/pdf', 1024))
    const alert = within(row('증명사진')).getByRole('alert')
    expect(alert).toHaveTextContent('증명사진은(는) JPG · PNG 만 올릴 수 있어요.')
    // 토스트도 그대로 — 즉시 알림과 남는 기록은 역할이 다르다
    expect(h.toastError).toHaveBeenCalledWith('증명사진은(는) JPG · PNG 만 올릴 수 있어요.')
  })

  it('33) 다른 자리에는 그 오류가 없다', () => {
    draw()
    pick('photo', fakeFile('a.pdf', 'application/pdf', 1024))
    expect(within(row('이력서')).queryByRole('alert')).toBeNull()
  })

  it('34) 🔴 불러오는 중에는 「없어요」 대신 스켈레톤 4행', () => {
    h.docsLoading = true
    const { container } = draw()
    expect(screen.queryByText('없어요')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('35) 불러오기 실패면 에러 한 줄 — 「없어요」 4행이 아니다', () => {
    h.docsError = true
    const { container } = draw()
    expect(screen.getByText(/서류를 불러오지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByText('없어요')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('36) 링크 칸 — url 키패드 · 맞춤법 검사 없음 · 안내와 이어진다', () => {
    draw()
    fireEvent.click(within(row('이력서')).getByRole('button', { name: '링크' }))
    const url = screen.getByLabelText('이력서 링크')
    expect(url).toHaveAttribute('inputmode', 'url')
    expect(url).toHaveAttribute('spellcheck', 'false')
    expect(url).toHaveAttribute('autocomplete', 'off')
    const noteId = url.getAttribute('aria-describedby')
    expect(noteId).toBeTruthy()
    expect(document.getElementById(noteId!)).toHaveTextContent(/파일로 받아요|파일/)
  })

  it('37) 파일명 예시는 번역되지 않는다', () => {
    // 예시는 섹션 상단이 아니라 **접두가 빠진 행** 안에 산다 (CEO 2026-09-06)
    h.documents = [namelessResume]
    const { container } = draw()
    const code = container.querySelector('code')
    expect(code).toHaveAttribute('translate', 'no')
    expect(code).toHaveTextContent('홍길동_이력서.pdf')
    // 실제로 받게 될 이름(첫 줄)도 번역 대상이 아니다 — 바뀌면 예시가 아니라 사실이 거짓이 된다
    expect(mainLine(row('이력서'))).toHaveAttribute('translate', 'no')
  })
})

/**
 * 🔴 사용자가 궁금한 건 **회사가 받을 이름**이다 (CEO 2026-09-06). 자기 하드디스크의
 * `이력서_최종_진짜최종.pdf` 는 이미 알고 있다 — 모르는 건 「그래서 뭐로 들어가는데」다.
 * 그래서 변환된 이름이 첫 줄, 원본은 부제로 내려간다.
 */
describe('지원서에 들어갈 이름이 주인공', () => {
  const eduWithTranscript: Education = {
    id: 'ed1', school_name: 'OO대학교',
    transcript_file_url: 'https://files.test/transcript.pdf',
    transcript_file_size_bytes: 300 * 1024,
    transcript_suggested_file_name: '홍길동_성적증명서.pdf',
    graduation_file_url: 'https://files.test/graduation.pdf',
    graduation_file_size_bytes: 200 * 1024,
  }

  it('38) 첫 줄 = 지원서에 들어갈 이름 · 둘째 줄 = 원본 · 크기 · 날짜', () => {
    h.documents = [resumeDoc]
    draw()
    const r = row('이력서')
    expect(mainLine(r).textContent).toBe('홍길동_이력서.pdf')
    expect(r.textContent).toContain('원본 이력서_최종본.pdf · 400KB · 2026-09-01')
  })

  it('39) 「지원서엔 … 로 들어가요」 줄은 사라진다 — 첫 줄이 이미 같은 말이다', () => {
    h.documents = [resumeDoc]
    h.langCerts = [{
      id: 'lc1', cert_type: 'TOEIC', file_url: 'https://files.test/toeic.pdf',
      suggested_file_name: '홍길동_TOEIC_성적표.pdf',
    }]
    draw()
    // 슬롯·항목 어느 쪽에도 남지 않았다 (상단 안내의 「이름으로 들어가요」와는 다른 문장이다)
    expect(screen.queryByText(/지원서엔 .+ 로 들어가요/)).toBeNull()
  })

  it('40) 🔴 이름 접두가 없으면 「이름을 채우면」 안내 · 예시는 슬롯마다 다르다', () => {
    h.documents = [
      namelessResume,
      {
        id: 'd-photo', title: '증명사진', slot: 'photo',
        file_url: 'https://files.test/p.jpg', created_at: '2026-09-01T00:00:00Z',
        suggested_file_name: '증명사진.jpg',
      },
    ]
    draw()
    // 슬롯 라벨이 예시에 그대로 들어간다 — 네 행이 같은 문장을 읊으면 자기 일로 안 읽힌다
    expect(within(row('이력서')).getByText(/기본 인적사항에 이름을 채우면/)).toBeInTheDocument()
    expect(row('이력서').textContent).toContain('홍길동_이력서.pdf')
    expect(row('증명사진').textContent).toContain('홍길동_증명사진.jpg')
  })

  it('41) 접두가 붙어 있으면 그 안내는 없다', () => {
    h.documents = [resumeDoc] // 홍길동_이력서.pdf — 이미 붙어 있다
    draw()
    expect(screen.queryByText(/기본 인적사항에 이름을 채우면/)).toBeNull()
  })

  it('42) 원본명이 없는 옛 데이터는 둘째 줄에서 「원본」 부분만 빠진다', () => {
    h.documents = [{ ...resumeDoc, original_name: null }]
    draw()
    const r = row('이력서')
    expect(mainLine(r).textContent).toBe('홍길동_이력서.pdf')
    expect(r.textContent).toContain('400KB · 2026-09-01')
    expect(r.textContent).not.toContain('원본')
  })

  it('43) 항목 첨부 — 학력 성적증명서 첫 줄 = transcript_suggested_file_name', () => {
    h.educations = [eduWithTranscript]
    draw()
    const r = attachedRow('OO대학교', '성적증명서')
    expect(mainLine(r).textContent).toBe('홍길동_성적증명서.pdf')
    expect(r.textContent).toContain('OO대학교 · 성적증명서 · 300KB')
  })

  it('44) 제안 이름이 없으면 지금 표시 그대로 — 자격증 · 졸업증명서', () => {
    h.educations = [eduWithTranscript] // 졸업증명서 쪽엔 제안 이름이 없다
    h.certs = [{
      id: 'c1', name: '정보처리기사',
      file_url: 'https://files.test/cert.pdf', file_size_bytes: 100 * 1024,
    }]
    draw()
    expect(mainLine(attachedRow('정보처리기사', '자격증')).textContent)
      .toBe('정보처리기사 · 자격증 · 100KB')
    expect(mainLine(attachedRow('OO대학교', '졸업(예정)증명서')).textContent)
      .toBe('OO대학교 · 졸업(예정)증명서 · 200KB')
  })

  it('45) 링크 슬롯은 무변경 — 이름 줄도 「원본」도 안내도 없다', () => {
    h.documents = [{
      id: 'd-p', title: '포트폴리오', slot: 'portfolio', file_url: null,
      link_url: 'https://notion.test/p', created_at: '2026-09-01T00:00:00Z',
    }]
    draw()
    const r = row('포트폴리오')
    expect(within(r).getByLabelText('포트폴리오 링크')).toHaveValue('https://notion.test/p')
    expect(r.textContent).not.toContain('원본')
    expect(within(r).queryByText(/기본 인적사항에 이름을 채우면/)).toBeNull()
  })

  it('46) 섹션 상단 안내는 예시 대신 「아래 이름으로 들어가요」', () => {
    draw()
    expect(
      screen.getByText('파일 이름은 신경 쓰지 마세요 — 지원서엔 아래 이름으로 들어가요'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/이름을 붙여 드려요/)).toBeNull()
  })
})
