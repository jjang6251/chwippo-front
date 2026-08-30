/**
 * chwippo/no-overlay-bottom-padding
 *
 * `fixed inset-0` 오버레이 **컨테이너**에 하단 여백을 주지 못하게 한다.
 * 탭바를 피하려고 `pb-[calc(env(safe-area-inset-bottom)+4rem)]` 를 줬더니, 오버레이가
 * 이미 탭바를 어둡게 덮고 있어서 시트와 탭바 사이에 **검은 띠**만 남았다
 * (2026-08-30 iPhone 실사고). 탭바를 피할 게 아니라 그 위로 올라가야 맞다.
 */

/** `pb-4` · `sm:pb-0` · `lg:pb-[calc(...)]` — 앞이 공백/따옴표/문자열 시작이어야 토큰 */
const PB_TOKEN = /(^|[\s'"`])(?:[a-z]+:)?pb-/
const OVERLAY_MARKUP = 'fixed inset-0'

/**
 * className 값 안의 문자열 조각을 전부 모은다.
 * 조건식·논리식·템플릿까지 훑어서 `{cond ? 'pb-4' : ''}` 같은 우회도 같이 잡는다.
 */
function collectStrings(node, out) {
  if (!node) return
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') out.push(node.value)
      break
    case 'JSXExpressionContainer':
      collectStrings(node.expression, out)
      break
    case 'TemplateLiteral':
      for (const quasi of node.quasis) out.push(quasi.value.cooked ?? quasi.value.raw)
      for (const expr of node.expressions) collectStrings(expr, out)
      break
    case 'ConditionalExpression':
      collectStrings(node.consequent, out)
      collectStrings(node.alternate, out)
      break
    case 'LogicalExpression':
      collectStrings(node.left, out)
      collectStrings(node.right, out)
      break
    default:
      break
  }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '`fixed inset-0` 오버레이 컨테이너에 pb- 하단 여백 금지 (탭바 위 검은 띠)',
    },
    schema: [],
    messages: {
      overlayBottomPadding:
        '오버레이 컨테이너에 하단 여백 금지 — 오버레이가 탭바를 덮으니 여백은 검은 띠로만 남는다 (2026-08-30 iPhone 실사고). 탭바 위에 올리려면 `z-[60]`, 홈 인디케이터 여백은 시트 본문 `pb-[max(1.25rem,env(safe-area-inset-bottom))]` 에 준다',
    },
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className') return
        const fragments = []
        collectStrings(node.value, fragments)
        // 조각 사이는 공백으로 잇는다 — 붙여 버리면 토큰 경계가 사라진다
        const className = fragments.join(' ')
        if (!className.includes(OVERLAY_MARKUP)) return
        if (!PB_TOKEN.test(className)) return
        context.report({ node, messageId: 'overlayBottomPadding' })
      },
    }
  },
}
