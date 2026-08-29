/**
 * chwippo/no-bare-autofocus
 *
 * 오버레이(모달·시트·드로어) 안에서 **열자마자 포커스가 잡히는 입력**을 막는다.
 * 모바일은 포커스 = 키보드다. 모달을 보기도 전에 키보드가 화면 절반을 덮고,
 * iOS 는 키보드가 닫힌 뒤 뷰포트가 늦게 돌아와 시트 위치까지 흔들린다
 * (2026-08-30 iPhone 실사고 — `AddCardModal` 첫 칸).
 *
 * `AddEventSheet` 는 2026-07-25 에 같은 걸 겪고 주석으로 남겼지만, 강제하는 게 없어
 * 한 달 뒤 다른 모달에서 그대로 재발했다. 그래서 규칙으로 옮긴다.
 */

/** 파일명이 이거면 오버레이로 본다 */
const OVERLAY_NAME = /(Modal|Sheet|Overlay|Drawer)/
/** `@/components/common/Modal` · `./Modal` 처럼 공용 Modal 을 쓰는 파일 */
const MODAL_IMPORT = /(^|\/)Modal$/
/** 이름이 뭐든 전면 오버레이를 직접 그리는 파일 */
const OVERLAY_MARKUP = 'fixed inset-0'

/** 포커스가 곧 키보드인 요소 — 소문자 네이티브 태그는 이 셋뿐 */
const KEYBOARD_TAGS = new Set(['input', 'textarea', 'select'])

/** 이 파일이 오버레이인가 — 이름·import·마크업 중 하나만 걸려도 참 */
function isOverlayFile(context) {
  const sourceCode = context.sourceCode
  const basename = String(context.filename ?? '').split(/[\\/]/).pop() ?? ''
  if (OVERLAY_NAME.test(basename)) return true
  if (sourceCode.getText().includes(OVERLAY_MARKUP)) return true
  for (const stmt of sourceCode.ast.body) {
    if (stmt.type !== 'ImportDeclaration') continue
    const source = stmt.source.value
    if (typeof source !== 'string') continue
    if (source === 'vaul' || MODAL_IMPORT.test(source)) return true
  }
  return false
}

/**
 * `<input>`·`<textarea>`·`<select>` 와 **모든 컴포넌트**(대문자 시작 · `X.Y`)만 본다.
 * `<button>`·`<a>` 는 포커스가 가도 키보드가 안 올라오니 대상이 아니다.
 */
function isKeyboardElement(nameNode) {
  if (nameNode.type === 'JSXMemberExpression') return true
  if (nameNode.type !== 'JSXIdentifier') return false
  if (KEYBOARD_TAGS.has(nameNode.name)) return true
  return /^[A-Z]/.test(nameNode.name)
}

/** `useEffect` · `useLayoutEffect` (`React.useEffect` 포함) */
function isEffectCallee(callee) {
  const name =
    callee.type === 'Identifier'
      ? callee.name
      : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
        ? callee.property.name
        : null
  return name === 'useEffect' || name === 'useLayoutEffect'
}

/**
 * effect 콜백 **안**인가. 마운트 시 도는 포커스만 잡고, 이벤트 핸들러 안의
 * `.focus()`(사용자가 탭한 뒤 도는 것)는 통과시킨다.
 */
function isInsideEffect(context, node) {
  const ancestors = context.sourceCode.getAncestors(node)
  for (let i = ancestors.length - 1; i > 0; i--) {
    const fn = ancestors[i]
    if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') continue
    const parent = ancestors[i - 1]
    if (parent.type !== 'CallExpression') continue
    if (parent.arguments[0] !== fn) continue
    if (isEffectCallee(parent.callee)) return true
  }
  return false
}

/** `autoFocus` / `autoFocus={true}` 인가 (그 외 표현식은 이미 게이트한 것으로 본다) */
function isUngatedValue(value) {
  if (value === null || value === undefined) return true
  return (
    value.type === 'JSXExpressionContainer' &&
    value.expression.type === 'Literal' &&
    value.expression.value === true
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        '오버레이 안에서 게이트 없는 autoFocus·마운트 시 .focus() 금지 (모바일 키보드가 모달을 덮는다)',
    },
    schema: [],
    messages: {
      bareAutoFocus:
        '모바일에서 열자마자 키보드가 올라와 모달을 덮는다 (2026-08-30 iPhone 실사고). `autoFocus={open && !isMobile}` (`useIsMobile` · `@/hooks/useMediaQuery`) 로 게이트하거나, 사용자가 탭한 뒤 나타나는 칸이면 `eslint-disable-next-line` 에 사유를 적는다',
    },
  },

  create(context) {
    if (!isOverlayFile(context)) return {}

    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'autoFocus') return
        if (!isUngatedValue(node.value)) return
        const opening = node.parent
        if (!opening || opening.type !== 'JSXOpeningElement') return
        if (!isKeyboardElement(opening.name)) return
        context.report({ node, messageId: 'bareAutoFocus' })
      },

      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        const prop = callee.property
        const propName =
          prop.type === 'Identifier' ? prop.name : prop.type === 'Literal' ? prop.value : null
        if (propName !== 'focus') return
        if (!isInsideEffect(context, node)) return
        context.report({ node, messageId: 'bareAutoFocus' })
      },
    }
  },
}
