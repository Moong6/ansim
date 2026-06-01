import { useEffect } from 'react'
import Header from '../components/Header'
import S1Programs from '../components/S1Programs'
import S2Residents from '../components/S2Residents'
import ReadOnlyNotice from '../components/ReadOnlyNotice'
import S3WritingArea from '../components/S3WritingArea'
import S4ResultArea from '../components/S4ResultArea'
import Toast from '../components/Toast'
import { useDashboardStore } from '../store/dashboardStore'

export default function DashboardPage() {
  const loadPrograms  = useDashboardStore((s) => s.loadPrograms)
  const loadResidents = useDashboardStore((s) => s.loadResidents)
  const reset         = useDashboardStore((s) => s.reset)

  useEffect(() => {
    loadPrograms()
    loadResidents()
    return () => reset()
  }, [loadPrograms, loadResidents, reset])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <S1Programs />
        <S2Residents />
        {/* 모드별 — 컴포넌트 내부에서 mode 가드 */}
        <ReadOnlyNotice />     {/* mode === 'reading' 일 때만 */}
        <S3WritingArea />      {/* mode === 'editing' 일 때만 */}
        <S4ResultArea />       {/* mode === 'editing' 일 때만 */}
      </main>
      <Toast />
    </div>
  )
}
