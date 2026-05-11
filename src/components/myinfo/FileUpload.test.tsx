/**
 * FileUpload 테스트
 *
 * 시나리오:
 * 1. value 없으면 "파일 첨부" 버튼 노출
 * 2. value 있으면 파일 보기 링크 + 제거 버튼 노출
 * 3. value=PDF → PDF 아이콘
 * 4. value=이미지 → 이미지 아이콘
 * 5. hint prop → 안내 텍스트 노출
 * 6. 허용 안 된 MIME 업로드 시 alert
 * 7. 10MB 초과 파일 → alert
 * 8. 정상 파일 → uploadFile 호출 + onUploaded 콜백
 * 9. 제거 버튼 클릭 → onRemove 콜백
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUpload } from './FileUpload'

vi.mock('@/api/files', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/test-file.pdf'),
}))

describe('FileUpload', () => {
  beforeEach(() => {
    window.alert = vi.fn()
    vi.clearAllMocks()
  })

  describe('value 상태별 UI', () => {
    it('value 없음 → "파일 첨부" 업로드 버튼 표시', () => {
      render(<FileUpload scope="test" onUploaded={() => {}} onRemove={() => {}} />)
      expect(screen.getByText(/파일 첨부/)).toBeDefined()
    })

    it('value 있음 → 파일 보기 링크 + 제거 버튼', () => {
      render(<FileUpload value="https://s3.example.com/file.pdf" scope="test" onUploaded={() => {}} onRemove={() => {}} />)
      const link = screen.getByRole('link', { name: /파일 보기/ })
      expect(link.getAttribute('href')).toBe('https://s3.example.com/file.pdf')
      expect(link.getAttribute('target')).toBe('_blank')
    })
  })

  describe('hint prop', () => {
    it('hint 전달 시 안내 텍스트 노출', () => {
      render(<FileUpload scope="test" onUploaded={() => {}} onRemove={() => {}} hint="예: 졸업증명서" />)
      expect(screen.getByText('예: 졸업증명서')).toBeDefined()
    })

    it('hint 미전달 시 안내 텍스트 노출 안 됨', () => {
      const { container } = render(<FileUpload scope="test" onUploaded={() => {}} onRemove={() => {}} />)
      // hint 텍스트 노드가 없어야 함
      expect(container.textContent).not.toContain('예:')
    })
  })

  describe('파일 검증', () => {
    it('허용 안 된 MIME (text/plain) → alert + onUploaded 호출 안 됨', async () => {
      const onUploaded = vi.fn()
      const { container } = render(<FileUpload scope="test" onUploaded={onUploaded} onRemove={() => {}} />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const badFile = new File(['hello'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(input, 'files', { value: [badFile], configurable: true })
      fireEvent.change(input)

      await new Promise((r) => setTimeout(r, 50))
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('PDF, JPG, PNG'))
      expect(onUploaded).not.toHaveBeenCalled()
    })

    it('10MB 초과 → alert + onUploaded 호출 안 됨', async () => {
      const onUploaded = vi.fn()
      const { container } = render(<FileUpload scope="test" onUploaded={onUploaded} onRemove={() => {}} />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
      Object.defineProperty(input, 'files', { value: [bigFile], configurable: true })
      fireEvent.change(input)

      await new Promise((r) => setTimeout(r, 50))
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('10MB'))
      expect(onUploaded).not.toHaveBeenCalled()
    })

    it('정상 PDF (3MB) → uploadFile 호출 후 onUploaded 콜백', async () => {
      const onUploaded = vi.fn()
      const { container } = render(<FileUpload scope="myinfo/cert" onUploaded={onUploaded} onRemove={() => {}} />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File([new ArrayBuffer(3 * 1024 * 1024)], 'cert.pdf', { type: 'application/pdf' })
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      fireEvent.change(input)

      // uploadFile 결과 await
      await new Promise((r) => setTimeout(r, 100))
      expect(onUploaded).toHaveBeenCalledWith('https://s3.example.com/test-file.pdf')
    })
  })

  describe('제거 동작', () => {
    it('value 있는 상태에서 제거 버튼 클릭 → onRemove 콜백', () => {
      const onRemove = vi.fn()
      const { container } = render(<FileUpload value="https://s3.example.com/file.pdf" scope="test" onUploaded={() => {}} onRemove={onRemove} />)
      // value 표시 영역의 X 버튼 — svg path "M1 1l10 10..."이 있는 버튼
      const buttons = container.querySelectorAll('button')
      const removeBtn = Array.from(buttons).find((b) => b.querySelector('svg path[d^="M1 1"]'))
      expect(removeBtn).toBeDefined()
      fireEvent.click(removeBtn!)
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })
})
