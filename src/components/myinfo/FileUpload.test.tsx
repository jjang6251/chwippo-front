/**
 * FileUpload (지연 업로드 패턴) 테스트
 *
 * 시나리오 (r2-storage-cap.md 10-B):
 * - T-DU-1: pending 상태에서 X → uploadFile/deleteOwnFile 둘 다 미호출
 * - T-DU-2: existing 상태에서 X → 확인 후 deleteOwnFile 호출
 * - T-DU-3: 파일 선택 → onChange가 pending으로 호출됨
 * - 추가: empty 상태 UI, 파일 검증 (크기·형식), disabled 동작
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUpload } from './FileUpload'
import * as filesApi from '@/api/files'
import type { FileSlot } from '@/utils/fileSlot'

vi.mock('@/api/files', () => ({
  uploadFile: vi.fn(),
  deleteOwnFile: vi.fn().mockResolvedValue({ data: { data: null } }),
}))

describe('FileUpload (지연 업로드)', () => {
  beforeEach(() => {
    window.alert = vi.fn()
    vi.clearAllMocks()
  })

  describe('empty 상태', () => {
    it('파일 첨부 버튼 노출', () => {
      render(
        <FileUpload
          slot={{ kind: 'empty' }}
          scope="myinfo/cert"
          onChange={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: /파일 첨부/ })).toBeTruthy()
    })

    it('파일 선택 → onChange가 pending으로 호출됨, uploadFile은 호출 안 됨 (T-DU-3)', () => {
      const onChange = vi.fn()
      const { container } = render(
        <FileUpload
          slot={{ kind: 'empty' }}
          scope="myinfo/cert"
          onChange={onChange}
        />,
      )
      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' })
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      fireEvent.change(input)

      expect(onChange).toHaveBeenCalledWith({ kind: 'pending', file })
      expect(filesApi.uploadFile).not.toHaveBeenCalled()
    })

    it('허용 안 된 MIME → alert + onChange 호출 안 됨', () => {
      const onChange = vi.fn()
      const { container } = render(
        <FileUpload slot={{ kind: 'empty' }} scope="t" onChange={onChange} />,
      )
      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      const bad = new File(['x'], 'x.exe', { type: 'application/octet-stream' })
      Object.defineProperty(input, 'files', { value: [bad], configurable: true })
      fireEvent.change(input)
      expect(onChange).not.toHaveBeenCalled()
      expect(window.alert).toHaveBeenCalled()
    })

    it('10MB 초과 → alert + onChange 미호출', () => {
      const onChange = vi.fn()
      const { container } = render(
        <FileUpload slot={{ kind: 'empty' }} scope="t" onChange={onChange} />,
      )
      const input = container.querySelector('input[type="file"]') as HTMLInputElement
      const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(input, 'files', { value: [big], configurable: true })
      fireEvent.change(input)
      expect(onChange).not.toHaveBeenCalled()
      expect(window.alert).toHaveBeenCalled()
    })
  })

  describe('pending 상태', () => {
    const pendingSlot: FileSlot = {
      kind: 'pending',
      file: new File(['x'], 'cert.pdf', { type: 'application/pdf' }),
    }

    it('파일명 + "저장 시 업로드" 안내 노출', () => {
      render(
        <FileUpload slot={pendingSlot} scope="myinfo/cert" onChange={() => {}} />,
      )
      expect(screen.getByText('cert.pdf')).toBeTruthy()
      expect(screen.getByText(/저장 시 업로드/)).toBeTruthy()
    })

    it('X 클릭 → onChange(empty), uploadFile·deleteOwnFile 미호출 (T-DU-1)', () => {
      const onChange = vi.fn()
      render(<FileUpload slot={pendingSlot} scope="t" onChange={onChange} />)
      fireEvent.click(
        screen.getByRole('button', { name: '선택한 파일 취소' }),
      )
      expect(onChange).toHaveBeenCalledWith({ kind: 'empty' })
      expect(filesApi.uploadFile).not.toHaveBeenCalled()
      expect(filesApi.deleteOwnFile).not.toHaveBeenCalled()
    })

    it('disabled=true → X 버튼 비활성화', () => {
      render(
        <FileUpload
          slot={pendingSlot}
          scope="t"
          onChange={() => {}}
          disabled
        />,
      )
      const btn = screen.getByRole('button', { name: '선택한 파일 취소' })
      expect(btn).toHaveProperty('disabled', true)
    })
  })

  describe('existing 상태', () => {
    const existingSlot: FileSlot = {
      kind: 'existing',
      url: 'https://r2.example.com/users/u1/myinfo/cert/abc.pdf',
      size: 1024,
    }

    it('파일 보기 링크 + X 버튼 노출', () => {
      render(
        <FileUpload slot={existingSlot} scope="t" onChange={() => {}} />,
      )
      expect(screen.getByText(/파일 보기/)).toBeTruthy()
      expect(
        screen.getByRole('button', { name: '첨부 파일 제거' }),
      ).toBeTruthy()
    })

    it('X 클릭 1회 → 확인 모달 뜸, deleteOwnFile 아직 미호출', () => {
      const onChange = vi.fn()
      render(<FileUpload slot={existingSlot} scope="t" onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: '첨부 파일 제거' }))
      expect(screen.getByRole('dialog', { name: /파일 첨부 해제 확인/ })).toBeTruthy()
      expect(filesApi.deleteOwnFile).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('확인 모달에서 "제거" 클릭 → deleteOwnFile 호출 + onChange(empty) (T-DU-2)', () => {
      const onChange = vi.fn()
      render(<FileUpload slot={existingSlot} scope="t" onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: '첨부 파일 제거' }))
      fireEvent.click(screen.getByText('제거'))
      expect(filesApi.deleteOwnFile).toHaveBeenCalledWith(existingSlot.url)
      expect(onChange).toHaveBeenCalledWith({ kind: 'empty' })
    })

    it('확인 모달에서 "취소" 클릭 → 아무것도 호출 안 됨', () => {
      const onChange = vi.fn()
      render(<FileUpload slot={existingSlot} scope="t" onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: '첨부 파일 제거' }))
      fireEvent.click(screen.getByText('취소'))
      expect(filesApi.deleteOwnFile).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})
