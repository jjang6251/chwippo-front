import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 text-text-primary">
      <p className="text-text-tertiary text-sm">페이지를 찾을 수 없어요</p>
      <button onClick={() => navigate('/board')} className="text-brand text-sm hover:underline">
        보드로 돌아가기
      </button>
    </div>
  )
}
