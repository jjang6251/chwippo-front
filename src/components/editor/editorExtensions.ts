import { generateJSON, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { CharacterCount } from '@tiptap/extensions'
import { createLowlight } from 'lowlight'
import langJavascript from 'highlight.js/lib/languages/javascript'
import langTypescript from 'highlight.js/lib/languages/typescript'
import langPython from 'highlight.js/lib/languages/python'
import langJava from 'highlight.js/lib/languages/java'
import langKotlin from 'highlight.js/lib/languages/kotlin'
import langC from 'highlight.js/lib/languages/c'
import langCpp from 'highlight.js/lib/languages/cpp'
import langCsharp from 'highlight.js/lib/languages/csharp'
import langGo from 'highlight.js/lib/languages/go'
import langSql from 'highlight.js/lib/languages/sql'
import langBash from 'highlight.js/lib/languages/bash'
import langJson from 'highlight.js/lib/languages/json'
import langYaml from 'highlight.js/lib/languages/yaml'
import langXml from 'highlight.js/lib/languages/xml'
import langCss from 'highlight.js/lib/languages/css'
import langSwift from 'highlight.js/lib/languages/swift'
import { Markdown } from 'tiptap-markdown'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import type { Node as PMNode } from '@tiptap/pm/model'
import { StudyNoteMention, type StudyNoteMentionOptions } from './StudyNoteMention'
import { AiTargetHighlight } from './aiTargetHighlight'

/**
 * study-notes Phase 2a — **공용** 에디터 확장 세트.
 *
 * 준비 노트(StepNoteEditor)·회사 메모(CompanyMemoCard)·활동 노트(NoteEditor)가 같이 쓴다.
 * 확장을 여기 한 곳에 모으는 이유는 셋이 각자 목록을 들고 있으면 **같은 확장이 서로 다른
 * 설정으로 갈라지기** 때문이다 — 실제로 그랬다: 활동 노트는 `Link` 를 StarterKit 것과
 * 중복 등록해 tiptap 이 `Duplicate extension names found: ['link','underline']` 를 찍고 있었고,
 * 어느 쪽 설정이 이기는지가 등록 순서에 달려 있었다(`openOnClick` 이 true/false 로 갈렸다).
 * 그래서 Link·Underline 은 **StarterKit 을 통해서만** 설정한다.
 */

/**
 * 🔴 위험 스킴 차단 — Tiptap 기본 allowlist(http/https/ftp/mailto/tel/…) 위에 명시 방어선.
 * 기본값도 `javascript:`·`data:` 를 막지만(실측 확인), 그건 **라이브러리 기본값**이라
 * 조용히 바뀔 수 있다. 링크는 사용자가 붙여넣는 값이 그대로 href 가 되는 자리라
 * 우리 쪽에도 한 겹 적어 둔다 (앞에 붙는 제어문자·공백 우회는 `defaultValidate` 가 먹는다).
 */
const DANGEROUS_URI = /^(javascript|data|vbscript|file|blob):/i

export const SAFE_LINK_OPTIONS = {
  openOnClick: false,
  autolink: true,
  isAllowedUri: (url: string, ctx: { defaultValidate: (url: string) => boolean }) =>
    ctx.defaultValidate(url) && !DANGEROUS_URI.test(url),
}

/**
 * 형광펜 5색 — 값은 **의미 토큰**(`--warning` 등)이 아니라 색 키다.
 * 실제 색은 `index.css` 의 `mark[data-color=…]` 가 다크/라이트 두 벌로 들고 있다
 * (알파 틴트를 다크 색으로 라이트에 얹으면 회색으로 죽는다 — 두 벌이 필요한 이유).
 */
export const HIGHLIGHT_COLORS = [
  { value: 'yellow', label: '형광펜 노랑' },
  { value: 'green', label: '형광펜 초록' },
  { value: 'blue', label: '형광펜 파랑' },
  { value: 'red', label: '형광펜 빨강' },
  { value: 'purple', label: '형광펜 보라' },
] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]['value']

/**
 * 색은 `data-color` 로만 남긴다 — 기본 Highlight 는 `style="background-color: …"` 를
 * 함께 박는데, 그러면 색이 **문서에 하드코딩**돼 라이트 모드에서 다크 색이 그대로 나온다.
 */
const ThemedHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-color'),
        renderHTML: (attributes) =>
          attributes.color ? { 'data-color': attributes.color as string } : {},
      },
    }
  },
  /** md 에 형광펜 문법이 없다 — 색을 버리고 글자만 남긴다 (열화 명세: markdownIO.ts) */
  addStorage() {
    return { markdown: { serialize: { open: '', close: '' } } }
  },
})

/**
 * 토글 카드. `persist: true` 라야 열림/닫힘이 **문서에 저장**된다 —
 * plan §3 의 "접고 저장하면 다음에도 접힘 = self-test 친화" 가 이 옵션 하나에 달려 있다.
 */
const StudyDetails = Details.configure({ persist: true }).extend({
  /**
   * md 열화 — `**제목**` + 본문. 접힘 상태는 마크다운으로 표현할 수 없어 사라진다.
   * 자식(detailsSummary·detailsContent)은 여기서 직접 그리므로 각자 spec 이 필요 없다.
   */
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          const summary = node.child(0)
          state.write('**')
          state.renderInline(summary)
          state.write('**')
          state.closeBlock(node)
          if (node.childCount > 1) state.renderContent(node.child(1))
        },
      },
    }
  },
})

/**
 * 코드 하이라이팅 언어셋 — lowlight 의 `common`(37종) 대신 **취준 CS 공부에 실제로 쓰이는
 * 것만** 등록한다. `common` 은 entry 청크를 140kB(gzip 50kB) 불리는데, 그 안엔 이 앱에서
 * 나올 일이 없는 언어가 절반이다. 필요한 언어가 생기면 여기에 한 줄 추가하면 된다
 * (등록 안 된 언어는 하이라이팅만 없고 코드 블록 자체는 정상 동작한다).
 */
const LANGUAGES = {
  javascript: langJavascript,
  typescript: langTypescript,
  python: langPython,
  java: langJava,
  kotlin: langKotlin,
  c: langC,
  cpp: langCpp,
  csharp: langCsharp,
  go: langGo,
  sql: langSql,
  bash: langBash,
  json: langJson,
  yaml: langYaml,
  xml: langXml,
  css: langCss,
  swift: langSwift,
}

const lowlight = createLowlight(LANGUAGES)

/**
 * 언어 선택지 — 등록된 16종 + 「auto」. `auto`(빈 값)는 `attrs.language = null` 이고,
 * 그때 lowlight 가 내용을 보고 스스로 고른다.
 */
export const CODE_LANGUAGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  ...Object.keys(LANGUAGES).map((value) => ({ value, label: value })),
]

/** select 의 커스텀 chevron — 프로젝트 규칙(네이티브 chevron 금지)의 12×12 path 그대로 */
const CHEVRON_SVG =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
  '<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>'

const COPY_ICON =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'

const COPIED_MS = 1500

/**
 * 코드 블록 헤더 (mockup `paste-demo.html`·`detail-desktop.html`) — 좌: 언어 · 우: 복사.
 *
 * 🔴 **vanilla ProseMirror NodeView 다. React 로 만들지 않는다.**
 * 이 확장은 `studyNoteTemplates.test`·`docEditorUtils.test` 가 **headless `new Editor`**
 * (React 컨텍스트 없음) 로 여는 경로에도 그대로 실린다 — `ReactNodeViewRenderer` 는 그
 * 환경에서 렌더러를 붙일 자리가 없어 깨질 수 있다. DOM 을 직접 만들면 어느 컨텍스트에서든
 * 같은 결과다.
 *
 * ## 왜 언어를 **고를 수 있어야** 하나
 *
 * 지금까지 언어가 박히는 길은 ```c 처럼 마크다운을 붙여넣는 경로뿐이었다. 툴바로 만든
 * 코드 블록은 auto-detect 에 맡겨지는데, 짧은 코드는 자주 틀리고(파이썬을 루비로 본다)
 * **틀렸다는 걸 알아도 고칠 UI 가 없었다.** 라벨이 아니라 select 인 이유다.
 *
 * ## 읽기 모드
 *
 * 언어 변경은 **편집 행위**라 막고(값을 되돌린다), 복사는 살린다 — 정리해 둔 코드를
 * 가져다 쓰는 건 읽기 모드가 주 무대다.
 */
const CodeBlockWithHeader = CodeBlockLowlight.extend({
  addNodeView() {
    /*
      🔴 **`code` 의 `language-*` 클래스를 우리가 직접 붙여야 한다.** 기본 `renderHTML` 이
      하던 일인데, NodeView 로 DOM 을 직접 만들면서 그 경로가 통째로 빠졌다 — 붙여넣은
      ```javascript 코드가 클래스 없는 `<code>` 로 렌더돼 e2e 가 잡았다(2026-08-18).
      접두어는 확장 옵션에서 가져온다(하드코딩하면 옵션을 바꾼 날 조용히 어긋난다).
    */
    const prefix = this.options.languageClassPrefix ?? 'language-'

    return ({ editor, node, getPos }) => {
      let current = node

      const langOf = (n: typeof node): string =>
        typeof n.attrs.language === 'string' ? n.attrs.language : ''

      const dom = document.createElement('div')
      dom.className = 'chw-codeblock'

      const head = document.createElement('div')
      head.className = 'chw-codeblock-head'
      // 헤더는 문서가 아니다 — 커서가 들어가거나 지워지면 안 된다
      head.contentEditable = 'false'

      // ── 좌: 언어 select (네이티브 chevron 금지 — 커스텀 12×12 SVG) ──
      const langWrap = document.createElement('span')
      langWrap.className = 'chw-codeblock-lang'
      const select = document.createElement('select')
      select.setAttribute('aria-label', '코드 언어')
      for (const opt of CODE_LANGUAGE_OPTIONS) {
        const option = document.createElement('option')
        option.value = opt.value
        option.textContent = opt.label
        select.appendChild(option)
      }
      select.value = langOf(current)
      const chevron = document.createElement('span')
      chevron.className = 'chw-codeblock-chevron'
      chevron.innerHTML = CHEVRON_SVG
      langWrap.append(select, chevron)

      select.addEventListener('change', () => {
        // 읽기 모드에서는 문서를 못 바꾼다 — 고른 값을 조용히 되돌린다
        if (!editor.isEditable) {
          select.value = langOf(current)
          return
        }
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        const language = select.value === '' ? null : select.value
        const { state, dispatch } = editor.view
        dispatch(state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, language }))
      })

      // ── 우: 복사 ──
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.className = 'chw-codeblock-copy'
      copy.setAttribute('aria-label', '코드 복사')
      const copyLabel = document.createElement('span')
      const iconHost = document.createElement('span')
      iconHost.innerHTML = COPY_ICON
      const paint = (copied: boolean) => {
        iconHost.style.display = copied ? 'none' : ''
        copyLabel.textContent = copied ? '✓ 복사됨' : '복사'
      }
      paint(false)
      copy.append(iconHost, copyLabel)

      let copiedTimer: ReturnType<typeof setTimeout> | null = null
      copy.addEventListener('click', () => {
        // 실패는 조용히 무시한다 — 권한 없는 브라우저에서 에러 토스트를 띄울 일이 아니다
        void navigator.clipboard
          ?.writeText(current.textContent)
          .then(() => {
            paint(true)
            if (copiedTimer) clearTimeout(copiedTimer)
            copiedTimer = setTimeout(() => paint(false), COPIED_MS)
          })
          .catch(() => {})
      })

      head.append(langWrap, copy)

      const pre = document.createElement('pre')
      const code = document.createElement('code')
      const applyLangClass = (n: typeof node) => {
        const lang = langOf(n)
        code.className = lang ? `${prefix}${lang}` : ''
      }
      applyLangClass(current)
      pre.appendChild(code)
      dom.append(head, pre)

      /**
       * 편집 가능 여부는 **문서 변경 없이도** 바뀐다 (읽기 모드 토글).
       *
       * 🔴 `transaction` 만 듣고는 못 잡는다 — `setEditable` 은 트랜잭션을 만들지 않고
       * `update` 만 흘린다(실측: 읽기로 넘어가도 select 가 계속 눌렸다). 둘 다 듣는다.
       * 이건 **보이는 상태**일 뿐이고, 실제 방어는 change 핸들러의 `isEditable` 검사다.
       */
      const syncEditable = () => {
        select.disabled = !editor.isEditable
      }
      syncEditable()
      editor.on('transaction', syncEditable)
      editor.on('update', syncEditable)

      return {
        dom,
        contentDOM: code,
        update: (updated) => {
          if (updated.type.name !== current.type.name) return false
          current = updated
          const lang = langOf(updated)
          if (select.value !== lang) select.value = lang
          applyLangClass(updated)
          syncEditable()
          return true
        },
        /* 헤더는 ProseMirror 가 관리하지 않는다 — 여기 DOM 변화로 문서를 다시 읽으면 안 된다 */
        ignoreMutation: (mutation) =>
          mutation.type !== 'selection' && !code.contains(mutation.target as globalThis.Node),
        destroy: () => {
          if (copiedTimer) clearTimeout(copiedTimer)
          editor.off('transaction', syncEditable)
          editor.off('update', syncEditable)
        },
      }
    }
  },
})

export interface EditorFeatures {
  /** 체크리스트 (TaskList·TaskItem) */
  taskList?: boolean
  /** 토글 카드 (Details) */
  details?: boolean
  /** 문법 하이라이팅 코드 블록 */
  codeBlock?: boolean
  /** 표 */
  table?: boolean
  /** 마크다운 붙여넣기 파싱·내보내기 */
  markdown?: boolean
}

/** 미지정 = 전부 on (plan §2 "공용" 세트) */
const DEFAULT_FEATURES: Required<EditorFeatures> = {
  taskList: true,
  details: true,
  codeBlock: true,
  table: true,
  markdown: true,
}

export interface BuildExtensionsOptions {
  placeholder: string
  characterLimit?: number
  features?: EditorFeatures
  /** 지정하면 `[[`·`@` 멘션이 켜진다. 데이터 소스는 소비 측이 주입 */
  mention?: StudyNoteMentionOptions
}

export function buildEditorExtensions({
  placeholder,
  characterLimit,
  features,
  mention,
}: BuildExtensionsOptions): Extensions {
  const f = { ...DEFAULT_FEATURES, ...features }

  return [
    StarterKit.configure({
      // CodeBlockLowlight 로 갈아끼운다 — 이름이 같아 둘 다 켜면 스키마가 충돌한다
      codeBlock: f.codeBlock ? false : undefined,
      link: SAFE_LINK_OPTIONS,
    }),
    ThemedHighlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder }),
    ...(f.taskList ? [TaskList, TaskItem.configure({ nested: true })] : []),
    ...(f.details ? [StudyDetails, DetailsSummary, DetailsContent] : []),
    ...(f.codeBlock ? [CodeBlockWithHeader.configure({ lowlight })] : []),
    /*
      resizable 컬럼은 모바일에서 잡을 수 없는 핸들이 생긴다 — 폭은 CSS 가 잡는다.

      🔴 `renderWrapper` · `cellMinWidth` 는 **320px 보호의 전부**다 (e2e 실측으로 발견).
      - `renderWrapper: false`(기본)면 `.tableWrapper` 가 아예 안 생긴다. 그 클래스에 걸어 둔
        `overflow-x: auto` 가 통째로 죽은 CSS 가 되고, 표는 스크롤 대신 **열이 찌그러진다**
        (320px 에서 3열이 84px 씩 = 한글 4자). 에러도 경고도 없어서 눈으로만 알 수 있었다.
        참고: 래퍼 DOM 은 `resizable: true` 일 때만 붙는 NodeView 쪽에도 있어서, 리사이즈를
        끈 우리 설정에서는 이 옵션 말고는 래퍼를 만들 길이 없다.
      - `cellMinWidth` 는 tiptap 이 `<table style="min-width: cols × N">` 로 실어 준다.
        기본 25 면 3열 75px 이라 절대 안 넘쳐서 래퍼가 있어도 스크롤이 안 걸린다.
        110 = 한글 5자(5em ≈ 74px) + 셀 좌우 패딩 28px 의 여유값.
        데스크탑은 `width: 100%` 가 더 커서 이 값이 보이지 않는다.
    */
    ...(f.table
      ? [
          Table.configure({ resizable: false, renderWrapper: true, cellMinWidth: 110 }),
          TableRow,
          TableHeader,
          TableCell,
        ]
      : []),
    ...(mention ? [StudyNoteMention.configure(mention)] : []),
    ...(f.markdown
      ? [
          Markdown.configure({
            // 🔴 raw HTML 미주입 — 붙여넣은 `<script>` 가 문서로 들어오는 길을 막는다
            html: false,
            breaks: true,
            linkify: false,
            // 🔴 항상 끈다. 켜면 **모든 평문**이 마크다운으로 읽혀 "- 면접 복장" 이 목록으로
            //    튄다. 파싱 여부는 markdownIO 의 신호 게이트가 정한다
            transformPastedText: false,
            transformCopiedText: false,
          }),
        ]
      : []),
    ...(characterLimit ? [CharacterCount.configure({ limit: characterLimit })] : []),
    // 노트 AI 패널이 「지금 보고 있는 대상」을 본문에 표시한다. 데코레이션뿐이라 문서·저장
    // 형식을 건드리지 않고, 명령을 안 부르면 아무것도 안 그린다 — 항상 켜 둬도 무해하다
    AiTargetHighlight,
  ]
}

/**
 * 🔴 레거시 평문 본문을 **미리 doc JSON 으로 고정**한다.
 *
 * `Markdown` 확장은 에디터에 넘어온 `content` 가 **문자열이면 마크다운으로 읽는다**.
 * 준비 노트에는 tiptap 전환 이전의 평문 노트가 그대로 남아 있어서(시트 승격 경로가
 * 원본 문자열을 그대로 옮긴다), 그냥 두면 어제까지 한 문단이던 메모가 오늘 갑자기
 * 목록·제목으로 재조립된다. 그건 저장 형식이 바뀌는 회귀다.
 *
 * `generateJSON` 은 tiptap 이 문자열 content 에 쓰는 것과 **같은 HTML 파서**라,
 * 결과가 확장 추가 이전과 정확히 같다 (spec 이 옛 경로와 1:1 비교한다).
 */
export function parseEditorContent(
  raw: string | null,
  extensions: Extensions,
): object | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as object
  } catch {
    return generateJSON(raw, extensions)
  }
}

/**
 * 표 삽입 기본형 — 3×3(헤더 1줄). 툴바와 spec 이 같은 값을 쓴다.
 */
export const DEFAULT_TABLE = { rows: 3, cols: 3, withHeaderRow: true }

/** 표 안에서만 의미 있는 행/열 조작 — 툴바가 표 안일 때만 노출한다 */
export const TABLE_ACTIONS = [
  { key: 'addRowAfter', label: '아래 행 추가' },
  { key: 'deleteRow', label: '행 삭제' },
  { key: 'addColumnAfter', label: '오른쪽 열 추가' },
  { key: 'deleteColumn', label: '열 삭제' },
  { key: 'deleteTable', label: '표 삭제' },
] as const
