/**
 * chwippo/vaul-reposition-inputs
 *
 * vaul `Drawer.Root` 에 `repositionInputs` 를 **명시**하게 한다.
 * 기본값 `true` 는 입력칸에 포커스가 가면 시트를 키보드 높이만큼 `bottom` 으로 들어올리는데,
 * iOS 는 이미 visual viewport 를 스크롤해 입력칸을 드러낸 뒤라 **두 힘이 겹쳐 두 배로** 밀린다.
 * 시트가 화면 위로 튀어나가고 아래엔 키보드 높이만큼 검은 띠가 남는다
 * (2026-09-01 iPhone 실사고 — `InfoModal` 에 원인 주석 전문).
 *
 * 입력칸이 없는 시트도 대상이다 — 나중에 칸 하나 넣는 순간 조용히 재발하기 때문.
 */

/** 이 파일이 vaul 을 import 하는가 — `Drawer` 이름만 같은 남의 컴포넌트는 대상이 아니다 */
function importsVaul(sourceCode) {
  for (const stmt of sourceCode.ast.body) {
    if (stmt.type !== 'ImportDeclaration') continue
    if (stmt.source.value === 'vaul') return true
  }
  return false
}

/** `<Drawer.Root>` 인가 (`<Foo.Root>` · `<Drawer.Content>` 는 아니다) */
function isDrawerRoot(nameNode) {
  return (
    nameNode.type === 'JSXMemberExpression' &&
    nameNode.object.type === 'JSXIdentifier' &&
    nameNode.object.name === 'Drawer' &&
    nameNode.property.type === 'JSXIdentifier' &&
    nameNode.property.name === 'Root'
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'vaul Drawer.Root 에 repositionInputs 명시 필수 (기본값 true 가 iOS 키보드에서 시트를 두 배로 밀어 올린다)',
    },
    schema: [],
    messages: {
      missingRepositionInputs:
        'vaul 시트에는 `repositionInputs={false}` 를 명시한다 — 기본값 true 는 iOS 키보드에서 시트를 두 배로 밀어 올린다 (2026-09-01 실사고, InfoModal 주석 참고)',
    },
  },

  create(context) {
    if (!importsVaul(context.sourceCode)) return {}

    return {
      JSXOpeningElement(node) {
        if (!isDrawerRoot(node.name)) return
        const hasProp = node.attributes.some(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'repositionInputs',
        )
        if (hasProp) return
        context.report({ node, messageId: 'missingRepositionInputs' })
      },
    }
  },
}
