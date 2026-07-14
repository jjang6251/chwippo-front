import '@testing-library/jest-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

// 프로덕션(main.tsx)과 동일한 dayjs locale — 테스트에서도 요일·월 한글 (요일 포맷 회귀 방어)
dayjs.locale('ko')
