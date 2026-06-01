import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './api/client'   // 모듈 로드 시 헬스체크 자동 실행 → 콘솔: [health] ok
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
