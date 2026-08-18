/**
 * 공부 노트 템플릿 7종 (tiptap doc JSON).
 *
 * 🔴 **템플릿이 곧 서식 가이드다** (plan UX 검토 ⑧). 투어·툴팁 대신 첫 문서 안에서
 * 토글·형광펜·체크리스트·표가 **실사용 형태로** 이미 굴러가고 있게 만든다 — 사용자는
 * 「이렇게 쓰는 거구나」를 읽으면서 배우고, 지우고 자기 내용으로 덮으면 그게 첫 노트다.
 * 그래서 안내문이 아니라 **취준생이 실제로 적을 법한 내용**이 들어 있어야 한다.
 *
 * 🔴 **두 번째 원칙: 방법론을 내장한다.** 빈 칸만 주면 사용자는 자기가 원래 하던 방식을
 * 그대로 옮겨 적는다. 오답 노트가 「틀린 이유가 이 노트의 전부다」라고 먼저 말하는 것처럼,
 * 각 템플릿은 **어떻게 써야 효과가 나는지**를 도입 한 문단에 박아 둔다.
 *
 * 🔴 **세 번째 원칙: 회사별 준비를 빨아들이지 않는다.** 「삼성전자 준비」 같은 템플릿은
 * 만들지 않는다 — 그건 지원 카드의 준비 노트 영역이고, 여기로 새면 카드와 노트가 갈라져
 * 어느 쪽도 완전하지 않게 된다 (허브가 준비 노트를 *보여만* 주는 것과 같은 이유).
 * 면접 관련 템플릿이 「인성 면접 답변 스크립트」·「면접 기출 모음」처럼 **회사 무관 자산**
 * 형태인 건 그래서다.
 *
 * ## 7종이 된 이유 (CEO 지시 2026-08-18 — 웹 리서치 기반)
 *
 * 첫 3종은 질은 탄탄했지만 **전부 IT 편향**(CS·SQL·코드)이라, 21개 직군 중 비개발 직군에겐
 * 남의 템플릿이었다. 기존 3종은 그대로 두고 직군 무관한 4종을 더한다.
 *
 * | 템플릿 | 이 템플릿이 가르치는 서식 | 내장한 방법론 |
 * |---|---|---|
 * | CS 정리 | 토글 · 형광펜 · 코드 블록 · 체크 | 토글 접고 self-test |
 * | 면접 기출 모음 | 회사별 H2 + 질문 토글 누적 · 체크 | 접으면 그대로 모의 면접 |
 * | 오답 노트 | 표 · 체크 · 토글 | 틀린 **이유**가 전부다 · 유형별로 본다 |
 * | 인성 면접 답변 스크립트 | 토글 · 표 · 형광펜 · 체크 | 1분 자기소개 3단 구조 · 두괄식·수치 |
 * | 직무 지식 정리 | 표 · 토글 · 형광펜 · 체크 | 용어·개념·트렌드 3층 |
 * | 주간 공부 계획 | 표 · 체크 · 토글 | 목표 구체화 · **예상/실제** 병기 · 주 1회 점검 |
 * | 어학·자격증 대비 | 표 · 토글 · 체크 | 파트별 전략 · 토글 = 플래시카드 |
 *
 * 노드 이름은 `editorExtensions.ts` 가 등록한 것과 1:1 이어야 한다 — 이름이 어긋나면
 * tiptap 이 그 노드를 **조용히 버린다**(문서가 반쯤 빈 채로 열린다).
 */

type Node = Record<string, unknown>

const text = (value: string): Node => ({ type: 'text', text: value })

/** 형광펜 — 색 값은 `HIGHLIGHT_COLORS` 와 같은 키 (실제 색은 index.css 가 두 벌로 들고 있다) */
const mark = (value: string, color: 'yellow' | 'green' | 'blue' = 'yellow'): Node => ({
  type: 'text',
  marks: [{ type: 'highlight', attrs: { color } }],
  text: value,
})

const bold = (value: string): Node => ({
  type: 'text',
  marks: [{ type: 'bold' }],
  text: value,
})

const p = (...content: Node[]): Node =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' }

const h = (level: 2 | 3, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
})

/** 섹션 사이 빈 줄 — 템플릿 가독용 (CEO 실기 피드백 2026-08-18: 섹션 제목 앞에 엔터 한 번) */
const gap = (): Node => ({ type: 'paragraph' })

/**
 * 토글 — `open: false` 로 둔다. **접힌 채로 열려야** 질문만 보이고 답이 가려져
 * self-test 가 성립한다 (열림 상태는 문서에 저장되므로 사용자가 바꾸면 그대로 남는다).
 */
const details = (summary: string, ...body: Node[]): Node => ({
  type: 'details',
  attrs: { open: false },
  content: [
    { type: 'detailsSummary', content: [text(summary)] },
    { type: 'detailsContent', content: body },
  ],
})

const check = (checked: boolean, value: string): Node => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text(value))],
})

const checklist = (...items: Node[]): Node => ({ type: 'taskList', content: items })

/**
 * 🔴 빈 칸은 `text('')` 가 아니라 **빈 문단**이다. 길이 0 인 text 노드는 ProseMirror 스키마
 * 위반이라 문서 전체가 통째로 버려진다 (테이블 한 줄 때문에 템플릿이 빈 문서로 열렸다).
 */
const cell = (value: string, header = false): Node => ({
  type: header ? 'tableHeader' : 'tableCell',
  content: [value ? p(text(value)) : p()],
})

const row = (...cells: Node[]): Node => ({ type: 'tableRow', content: cells })

const table = (...rows: Node[]): Node => ({ type: 'table', content: rows })

const code = (language: string, value: string): Node => ({
  type: 'codeBlock',
  attrs: { language },
  content: [text(value)],
})

const doc = (...content: Node[]): Node => ({ type: 'doc', content })

export interface StudyNoteTemplate {
  key: string
  /** 빈 상태 카드의 아이콘 */
  emoji: string
  /** 카드 제목 = 새 노트의 기본 제목 */
  title: string
  /** 카드 한 줄 설명 */
  desc: string
  doc: Node
}

export const STUDY_NOTE_TEMPLATES: readonly StudyNoteTemplate[] = [
  {
    key: 'cs',
    emoji: '🧠',
    title: 'CS 정리',
    desc: '개념 · 토글 암기 · 코드 블록 구성',
    doc: doc(
      h(2, '프로세스와 스레드'),
      p(
        text('프로세스는 실행 중인 프로그램의 인스턴스로 독립된 주소 공간을 가진다. 스레드는 '),
        mark('프로세스 안에서 실행 흐름만 분리한 단위'),
        text('라 코드·데이터·힙을 공유하고 스택만 따로 가진다.'),
      ),
      details(
        'Q. 컨텍스트 스위칭이 스레드보다 프로세스에서 비싼 이유는?',
        p(
          text('프로세스 전환은 '),
          bold('주소 공간 자체가 바뀌므로'),
          text(' 페이지 테이블 교체 → TLB 플러시가 일어난다. 스레드는 같은 주소 공간이라 레지스터·스택 포인터만 갈아끼우면 된다.'),
        ),
      ),
      details(
        'Q. 멀티프로세스 대신 멀티스레드를 쓰면 생기는 위험은?',
        p(
          text('메모리를 공유하니까 '),
          mark('한 스레드가 죽으면 프로세스 전체가 같이 죽는다', 'blue'),
          text('. 공유 자원 접근에 동기화(뮤텍스·세마포어)가 필요하고, 그 과정에서 데드락이 생길 수 있다.'),
        ),
      ),
      gap(),
      h(2, '외워 둘 코드'),
      p(text('면접에서 화이트보드로 요구받는 빈도가 높은 것부터.')),
      code(
        'java',
        'synchronized (lock) {\n    while (queue.isEmpty()) {\n        lock.wait();   // 조건이 아직 아니면 대기\n    }\n    return queue.poll();\n}',
      ),
      gap(),
      h(2, '복습 체크'),
      checklist(
        check(true, '데드락 4조건 외우기 (상호배제·점유대기·비선점·순환대기)'),
        check(false, '위 토글 접고 답 말해 보기'),
        check(false, '가상 메모리 파트 정리해서 이 노트에 잇기'),
      ),
    ),
  },
  {
    key: 'interview-bank',
    emoji: '🎤',
    title: '면접 기출 모음',
    desc: '여러 회사 기출을 한 곳에 축적',
    doc: doc(
      p(
        text('회사별로 H2 를 만들고 그 아래에 질문을 토글로 쌓는다. '),
        mark('토글을 접으면 질문만 보여서 그대로 모의 면접이 된다', 'green'),
        text('.'),
      ),
      gap(),
      h(2, '삼성전자 — 1차 면접'),
      details(
        'Q. 본인이 가장 몰입했던 프로젝트와 그때 맡은 역할은?',
        p(text('상황 → 역할 → 한 일 → 숫자로 말할 수 있는 결과 순서로. 결과는 「응답 3.2초 → 0.8초」처럼 수치를 남긴다.')),
      ),
      details(
        'Q. 갈등이 있었던 협업 경험과 해결 방법은?',
        p(text('누가 잘못했나가 아니라 '), bold('무엇을 기준으로 합의했는지'), text('를 말한다.')),
      ),
      gap(),
      h(2, '카카오 — 기술 면접'),
      details(
        'Q. 인덱스를 걸었는데도 느린 쿼리, 어디부터 보나?',
        p(text('실행 계획부터 확인 → 인덱스를 안 타는 조건(함수 적용·형변환·선행 컬럼 누락) → 카디널리티 순으로 좁힌다.')),
      ),
      details('Q. 마지막으로 궁금한 점 있나요?', p(text('팀이 지금 가장 크게 겪는 기술 부채 / 온보딩 첫 3개월에 기대하는 것.'))),
      gap(),
      h(2, '다음에 물어보면 답 못 할 것들'),
      checklist(
        check(false, '트랜잭션 격리 수준 4가지 차이 말하기'),
        check(false, '내 프로젝트에서 가장 아쉬운 설계 결정 1개 준비'),
      ),
    ),
  },
  {
    key: 'wrong-answers',
    emoji: '✍️',
    title: '오답 노트',
    desc: '틀린 것만 모아 반복 복습',
    doc: doc(
      p(
        text('맞은 문제는 안 적는다. '),
        mark('틀린 이유'),
        text('가 이 노트의 전부다 — 다음에 같은 이유로 또 틀리지 않는 게 목표.'),
      ),
      gap(),
      h(2, '이번 주 틀린 것'),
      table(
        /* 「유형」 열 — 인적성·NCS 는 유형별 약점 파악이 정석이라, 틀린 이유를
           몰라서/헷갈려서/실수/시간부족 네 갈래로 분류해 반복 패턴을 드러낸다 */
        row(cell('문제', true), cell('유형', true), cell('내가 쓴 답', true), cell('정답', true), cell('왜 틀렸나', true)),
        row(
          cell('정처기 — 응집도가 가장 강한 것'),
          cell('헷갈려서'),
          cell('순차적 응집도'),
          cell('기능적 응집도'),
          cell('응집도 순서를 거꾸로 외움'),
        ),
        row(
          cell('SQL — HAVING vs WHERE'),
          cell('몰라서'),
          cell('둘 다 같음'),
          cell('HAVING 은 그룹 후'),
          cell('집계 전후 시점을 안 따짐'),
        ),
        row(cell(''), cell(''), cell(''), cell(''), cell('')),
      ),
      details(
        '왜 자꾸 같은 걸 틀릴까? (내 패턴)',
        p(text('개념을 문장으로 외우고 예시로 검증하지 않는다. 표에 한 줄 적을 때마다 '), bold('반례를 하나씩'), text(' 같이 적기로.')),
      ),
      gap(),
      h(2, '다시 풀 것'),
      checklist(
        check(false, '위 표의 문제 3개 — 3일 뒤 다시 풀기'),
        check(false, '틀린 이유가 「몰라서」인 것만 개념 노트로 옮기기'),
      ),
    ),
  },
  /* ── 신규 4종 (2026-08-18 CEO 지시 · 웹 리서치 기반 — plan §3 템플릿 확장 7종) ──
     원칙: ① 회사별 준비를 빨아들이지 않는다(그건 카드 준비 노트) ② 서식 가이드 겸용
     ③ 방법론 내장. 리서치 근거는 plan 참조 (1분 자기소개 3단 구조·플래너 예상/실제 병기 등) */
  {
    key: 'personality-interview',
    emoji: '🗣',
    title: '인성 면접 답변 스크립트',
    desc: '1분 자기소개 · 단골 질문 · 스터디 피드백',
    doc: doc(
      p(
        text('회사가 달라도 단골 질문은 같다. '),
        mark('여기 쌓아두면 어느 면접이든 꺼내 쓴다', 'green'),
        text(' — 회사별 각색은 그 카드의 준비 노트에서.'),
      ),
      gap(),
      h(2, '1분 자기소개'),
      p(
        text('검증된 3단 구조: '),
        bold('현재(직무+키워드) → 경험(활동+수치 성과) → 연결(지원 동기+기여)'),
        text('. 45초~1분 — 꽉 채우기보다 밀도. 아래에 초안을 쓰고 '),
        mark('핵심 키워드에 형광펜'),
        text('을 쳐 두면 말할 때 강세 둘 곳이 보인다.'),
      ),
      p(text('(초안을 여기에 — 예: 데이터로 근거를 만드는 마케터 지망 ○○○입니다. 학회에서 SNS 캠페인을 운영하며 팔로워를 3개월에 2.4배로 늘렸고…)')),
      gap(),
      h(2, '단골 질문'),
      details(
        'Q. 우리 회사에 지원한 이유는? (지원 동기)',
        p(text('회사 칭찬이 아니라 '), bold('내 경험과 회사 방향의 교집합'), text('을 말한다. 교집합이 안 떠오르면 아직 회사 조사가 부족한 것.')),
      ),
      details(
        'Q. 성격의 장점과 단점은?',
        p(text('단점은 '), bold('직무에 치명적이지 않은 것 + 보완 중인 행동'), text('까지 세트로. 「단점: 신중해서 느림 → 마감 이틀 전 초안 원칙으로 보완」')),
      ),
      details(
        'Q. 협업 중 갈등을 해결한 경험은?',
        p(text('누가 잘못했나가 아니라 '), bold('무엇을 기준으로 합의했는지'), text('. 상황→갈등 지점→기준 제시→결과(수치) 순서.')),
      ),
      details(
        'Q. 실패했던 경험과 배운 점은?',
        p(text('실패 자체보다 '), bold('그 뒤 행동이 어떻게 달라졌는지'), text('가 답이다. 배운 점이 추상어(「소통의 중요성」)면 탈락 답변.')),
      ),
      details(
        'Q. 마지막으로 하고 싶은 질문 있나요?',
        p(text('팀이 지금 가장 크게 겪는 과제 / 입사 후 첫 3개월에 기대하는 것 — '), mark('「없습니다」는 금지', 'blue'), text('.')),
      ),
      gap(),
      h(2, '스터디 피드백'),
      p(text('모의 면접에서 받은 지적을 그대로 적는다 — 같은 지적을 두 번 받으면 그게 진짜 약점이다.')),
      table(
        row(cell('날짜', true), cell('누가', true), cell('지적받은 것', true), cell('고칠 것', true)),
        row(cell('8/20'), cell('스터디 A'), cell('결론이 늦게 나온다'), cell('첫 문장에 결론부터 (두괄식)')),
        row(cell(''), cell(''), cell(''), cell('')),
      ),
      gap(),
      h(2, '연습 체크'),
      checklist(
        check(false, '1분 자기소개 소리 내어 3회 (녹음해서 들어보기)'),
        check(false, '위 토글 전부 접고 질문만 보며 self-test'),
      ),
    ),
  },
  {
    key: 'domain-knowledge',
    emoji: '📚',
    title: '직무 지식 정리',
    desc: '용어 · 개념 · 트렌드 — 어느 직무든 같은 틀',
    doc: doc(
      p(
        text('아래는 마케팅 예시지만 '),
        bold('어느 직무든 같은 3층'),
        text('이다 — 용어 사전 · 개념 정리 · 최근 트렌드. 예시를 지우고 내 직무로 채우면 된다.'),
      ),
      gap(),
      h(2, '용어 사전'),
      table(
        row(cell('용어', true), cell('한 줄 정의', true), cell('면접에서 나올 때', true)),
        row(cell('퍼널(Funnel)'), cell('인지→관심→구매로 좁아지는 고객 여정'), cell('「어느 단계가 병목인지 어떻게 찾나요?」')),
        row(cell('CAC'), cell('고객 1명 획득에 든 비용'), cell('LTV 와 비율로 묶어서 답해야 함')),
        row(cell('리텐션'), cell('재방문·재구매 잔존율'), cell('「신규 유입 vs 리텐션, 뭐가 먼저?」')),
        row(cell(''), cell(''), cell('')),
      ),
      gap(),
      h(2, '개념 정리'),
      details(
        'Q. SWOT 으로 지원 산업을 분석한다면?',
        p(text('강점·약점은 '), bold('내부'), text(', 기회·위협은 '), bold('외부'), text(' — 이 구분만 지켜도 답이 정리된다. 산업 하나 골라 4칸을 직접 채워볼 것.')),
      ),
      details(
        'Q. 4P 와 4C 의 차이는?',
        p(text('4P(제품·가격·유통·판촉)는 '), bold('판매자 관점'), text(', 4C(고객가치·비용·편의·소통)는 '), bold('구매자 관점'), text(' — 같은 활동을 어느 쪽에서 보느냐의 차이.')),
      ),
      gap(),
      h(2, '최근 이슈 · 트렌드'),
      p(
        text('직무 관련 기사를 읽다가 면접에서 쓸 만한 문장에 '),
        mark('형광펜을 쳐서 여기로'),
        text(' 옮겨 둔다. 출처와 날짜를 같이 — 「최근에 본 업계 이슈 있나요?」의 답이 된다.'),
      ),
      gap(),
      h(2, '이번 주 체크'),
      checklist(
        check(false, '용어 사전 10개 채우고 토글 접고 말해 보기'),
        check(false, '직무 관련 기사 2개 읽고 트렌드 섹션에 한 줄씩'),
      ),
    ),
  },
  {
    key: 'weekly-plan',
    emoji: '🗓',
    title: '주간 공부 계획',
    desc: '목표 구체화 · 예상/실제 시간 · 주 1회 점검',
    doc: doc(
      p(
        text('계획의 정석 두 가지 — 목표는 '),
        bold('행동 단위로 구체화'),
        text('하고(「NCS 공부」 ✗ → 「수리 유형 20문제+오답 정리」 ✓), 복습 점검은 매일이 아니라 '),
        mark('주 1회', 'green'),
        text('.'),
      ),
      gap(),
      h(2, '이번 주 목표'),
      checklist(
        check(false, '예: NCS 수리 유형 20문제 + 오답 정리'),
        check(false, '예: 1분 자기소개 초안 완성해서 스터디 피드백 받기'),
        check(false, '예: 토익 RC 파트7 모의 2회분'),
      ),
      gap(),
      h(2, '요일별 계획'),
      p(text('예상/실제를 같이 적는 게 핵심이다 — 몇 주 쌓이면 '), bold('내가 계획을 몇 % 로 잡아야 하는지'), text(' 보인다.')),
      table(
        row(cell('요일', true), cell('할 것', true), cell('예상', true), cell('실제', true)),
        row(cell('월'), cell('NCS 수리 10문제'), cell('2h'), cell('')),
        row(cell('화'), cell('오답 정리 + 자기소개 초안'), cell('1.5h'), cell('')),
        row(cell('수'), cell(''), cell(''), cell('')),
        row(cell('목'), cell(''), cell(''), cell('')),
        row(cell('금'), cell(''), cell(''), cell('')),
        /* 🔴 토·일을 「주말」 한 줄로 묶지 않는다 — 주말은 공부량이 가장 크게 갈리는 이틀이라
           묶으면 예상/실제 비교가 가장 필요한 자리에서 해상도를 잃는다 */
        row(cell('토'), cell(''), cell(''), cell('')),
        row(cell('일'), cell('복습 점검 (아래 토글)'), cell('1h'), cell('')),
      ),
      gap(),
      h(2, '주말 복습 점검'),
      details(
        '이번 주 배운 것 3개 — 접은 채로 먼저 떠올려 보기',
        p(text('떠오르지 않으면 그게 다음 주 첫 계획이 된다. 배운 게 아니라 '), bold('본 것'), text('일 뿐이었다는 뜻.')),
      ),
      checklist(
        check(false, '다음 주로 넘길 것 옮겨 적기'),
        check(false, '예상 대비 실제 시간 비율 계산해 보기'),
      ),
    ),
  },
  {
    key: 'exam-prep',
    emoji: '🌐',
    title: '어학 · 자격증 대비',
    desc: '파트별 전략 · 토글 = 플래시카드',
    doc: doc(
      h(2, '목표'),
      table(
        row(cell('시험', true), cell('목표', true), cell('시험일', true), cell('남은 주', true)),
        row(cell('토익'), cell('850'), cell('9/28'), cell('6주')),
        row(cell(''), cell(''), cell(''), cell('')),
      ),
      gap(),
      h(2, '파트별 전략'),
      p(text('전 파트를 똑같이 공부하지 않는다 — '), bold('현재점수와 목표의 간격이 큰 파트'), text('에 시간을 몰아준다.')),
      table(
        row(cell('파트', true), cell('현재 → 목표', true), cell('전략', true)),
        row(cell('LC'), cell('380 → 430'), cell('파트3·4 받아쓰기 매일 5문항')),
        row(cell('RC'), cell('350 → 420'), cell('파트7 시간 초과가 문제 — 지문당 시간 재기')),
      ),
      gap(),
      h(2, '암기 카드'),
      p(
        mark('토글이 곧 플래시카드다', 'green'),
        text(' — 앞면(질문)만 보이게 접어두고, 읽기 모드의 「모두 접기」로 한 번에 시험지처럼.'),
      ),
      details('deteriorate', p(text('악화되다 — 「상황이 deteriorate 되기 전에」 처럼 문장째 외우기.'))),
      details('감가상각이란?', p(text('자산 가치를 사용 기간에 나눠 비용 처리 — 회계 자격증 단골.'))),
      details('(새 카드는 토글 버튼으로 추가)', p(text('앞면 = 토글 제목, 뒷면 = 이 자리.'))),
      gap(),
      h(2, '루틴 체크'),
      checklist(
        check(false, '모의고사 주 1회 — 틀린 건 오답 노트 템플릿으로'),
        check(false, '암기 카드 전부 접고 앞면만 보며 말해 보기'),
      ),
    ),
  },
] as const

/** 템플릿 → 노트 생성 본문 (서버는 tiptap JSON 문자열을 그대로 저장한다) */
export function templateContent(template: StudyNoteTemplate): string {
  return JSON.stringify(template.doc)
}
