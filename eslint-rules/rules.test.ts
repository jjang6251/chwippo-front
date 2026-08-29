/**
 * 재발 방지 린트 규칙 spec — 2026-08-30 iPhone 실사고 두 건.
 *
 * 시나리오 먼저 (프로젝트 규칙: 나열 → 코드):
 *
 *  ── chwippo/no-bare-autofocus ─────────────────────────────────
 *   1. `FooModal.tsx` 의 `<input autoFocus />`               → 1건
 *   2. `autoFocus={true}` (표현식이어도 늘 참)                 → 1건
 *   3. `autoFocus={open && !isMobile}` (게이트 됨)             → 0건
 *   4. 오버레이 파일이라도 `<button autoFocus>` 는 키보드 없음   → 0건
 *   5. 오버레이 표식이 하나도 없는 `Foo.tsx`                    → 0건
 *   6. `Foo.tsx` 인데 `vaul` 을 import (import 표식)           → 1건
 *   7. `Foo.tsx` 인데 `fixed inset-0` 마크업 (텍스트 표식)      → 1건
 *   8. 컴포넌트 칸 `<JobTitleField autoFocus />` 도 대상        → 1건
 *   9. `useEffect` 안 `ref.current?.focus()` (마운트 포커스)    → 1건
 *  10. `onClick` 안 `ref.current?.focus()` (탭 뒤 포커스)       → 0건
 *
 *  ── chwippo/no-overlay-bottom-padding ─────────────────────────
 *  11. 실사고 그 클래스 (`fixed inset-0` + `pb-[calc(...)]`)     → 1건
 *  12. 고친 뒤 클래스 (`fixed inset-0 z-[60]`, pb 없음)          → 0건
 *  13. 템플릿 리터럴 quasi 안의 `pb-4`                          → 1건
 *  14. `fixed inset-0` 과 `pb-4` 가 **다른** 요소에 있으면        → 0건
 */
import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import noBareAutofocus from './no-bare-autofocus.js'
import noOverlayBottomPadding from './no-overlay-bottom-padding.js'

const linter = new Linter()

/** 규칙 하나만 켠 flat config 로 스니펫을 검사하고 메시지 배열을 돌려준다 */
function lint(ruleName: string, rule: unknown, code: string, filename: string) {
  return linter.verify(
    code,
    {
      // flat config 는 `files` 없이는 .js 계열만 본다 — .tsx 스니펫을 검사하려면 명시해야 한다
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: { chwippo: { rules: { [ruleName]: rule } } },
      rules: { [`chwippo/${ruleName}`]: 'error' },
    } as Linter.Config,
    { filename },
  )
}

const autofocus = (code: string, filename: string) =>
  lint('no-bare-autofocus', noBareAutofocus, code, filename)

const padding = (code: string, filename = 'Foo.tsx') =>
  lint('no-overlay-bottom-padding', noOverlayBottomPadding, code, filename)

describe('chwippo/no-bare-autofocus', () => {
  it('1) 오버레이 파일의 맨 autoFocus 를 잡는다', () => {
    const messages = autofocus('const A = () => <input autoFocus />', 'FooModal.tsx')
    expect(messages).toHaveLength(1)
    expect(messages[0].ruleId).toBe('chwippo/no-bare-autofocus')
  })

  it('2) autoFocus={true} 도 게이트가 아니다', () => {
    expect(autofocus('const A = () => <input autoFocus={true} />', 'FooModal.tsx')).toHaveLength(1)
  })

  it('3) autoFocus={open && !isMobile} 는 통과', () => {
    expect(
      autofocus('const A = () => <input autoFocus={open && !isMobile} />', 'FooModal.tsx'),
    ).toHaveLength(0)
  })

  it('4) <button> 은 포커스가 가도 키보드가 안 올라온다 — 통과', () => {
    expect(autofocus('const A = () => <button autoFocus>확인</button>', 'FooModal.tsx')).toHaveLength(0)
  })

  it('5) 오버레이 표식이 없는 파일은 대상이 아니다', () => {
    expect(autofocus('const A = () => <input autoFocus />', 'Foo.tsx')).toHaveLength(0)
  })

  it("6) 'vaul' import 만으로 오버레이로 본다", () => {
    const code = "import { Drawer } from 'vaul'\nconst A = () => <input autoFocus />"
    expect(autofocus(code, 'Foo.tsx')).toHaveLength(1)
  })

  it('7) `fixed inset-0` 마크업만으로 오버레이로 본다', () => {
    const code = 'const A = () => <div className="fixed inset-0"><input autoFocus /></div>'
    expect(autofocus(code, 'Foo.tsx')).toHaveLength(1)
  })

  it('8) 컴포넌트 칸(대문자 시작)도 대상이다', () => {
    expect(autofocus('const A = () => <JobTitleField autoFocus />', 'FooModal.tsx')).toHaveLength(1)
  })

  it('9) useEffect 안의 .focus() 는 마운트 포커스라 잡는다', () => {
    const code = 'const A = () => { useEffect(() => { ref.current?.focus() }, []); return null }'
    expect(autofocus(code, 'FooModal.tsx')).toHaveLength(1)
  })

  it('10) onClick 안의 .focus() 는 탭 뒤 포커스라 통과', () => {
    const code = 'const A = () => <button onClick={() => ref.current?.focus()}>고치기</button>'
    expect(autofocus(code, 'FooModal.tsx')).toHaveLength(0)
  })
})

describe('chwippo/no-overlay-bottom-padding', () => {
  it('11) 실사고 그 클래스를 잡는다', () => {
    const code =
      'const A = () => <div className="fixed inset-0 z-50 flex items-end pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0" />'
    const messages = padding(code)
    expect(messages).toHaveLength(1)
    expect(messages[0].ruleId).toBe('chwippo/no-overlay-bottom-padding')
  })

  it('12) 고친 뒤 클래스는 통과', () => {
    const code = 'const A = () => <div className="fixed inset-0 z-[60] flex items-end" />'
    expect(padding(code)).toHaveLength(0)
  })

  it('13) 템플릿 리터럴 안의 pb- 도 잡는다', () => {
    const code = 'const A = () => <div className={`fixed inset-0 flex items-end pb-4 ${extra}`} />'
    expect(padding(code)).toHaveLength(1)
  })

  it('14) 두 토큰이 다른 요소에 흩어져 있으면 통과', () => {
    const code =
      'const A = () => <div className="fixed inset-0"><section className="pb-4" /></div>'
    expect(padding(code)).toHaveLength(0)
  })
})
