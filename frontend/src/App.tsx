import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import LoginParentPage from './pages/LoginParentPage'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import HomePage from './pages/HomePage'
import ResidentsPage from './pages/ResidentsPage'
import BoardListPage from './pages/BoardListPage'
import BoardDetailPage from './pages/BoardDetailPage'
import BoardFormPage from './pages/BoardFormPage'
import StaffInquiryListPage from './pages/StaffInquiryListPage'
import StaffInquiryDetailPage from './pages/StaffInquiryDetailPage'
// 보호자 페이지
import ParentHomePage from './pages/parent/ParentHomePage'
import ParentBoardListPage from './pages/parent/ParentBoardListPage'
import ParentBoardDetailPage from './pages/parent/ParentBoardDetailPage'
import ParentNoticeListPage from './pages/parent/ParentNoticeListPage'
import ParentNoticeDetailPage from './pages/parent/ParentNoticeDetailPage'
import ParentReportListPage from './pages/parent/ParentReportListPage'
import ParentReportDetailPage from './pages/parent/ParentReportDetailPage'
import ParentInquiryListPage from './pages/parent/ParentInquiryListPage'
import ParentInquiryDetailPage from './pages/parent/ParentInquiryDetailPage'
import ParentInquiryNewPage from './pages/parent/ParentInquiryNewPage'
import MealsPage from './pages/MealsPage'
import SchedulePage from './pages/SchedulePage'
import AlbumsPage from './pages/AlbumsPage'
import AlbumDetailPage from './pages/AlbumDetailPage'
import ParentMealsPage from './pages/parent/ParentMealsPage'
import ParentSchedulePage from './pages/parent/ParentSchedulePage'
import ParentAlbumsPage from './pages/parent/ParentAlbumsPage'
import ParentAlbumDetailPage from './pages/parent/ParentAlbumDetailPage'
import { useAuthStore } from './store/authStore'
import { useToastStore } from './store/toastStore'

// ─── 세션 만료(401) 전역 핸들러 ──────────────────────────────────────────────
function SessionWatcher() {
  const logout   = useAuthStore((s) => s.logout)
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  useEffect(() => {
    function onUnauthorized() {
      logout()
      useToastStore.getState().show('세션이 만료되었습니다. 다시 로그인해 주세요.', 'error')
      // 역할에 따라 알맞은 로그인 페이지로 이동
      const isGuardian = user?.role === 'GUARDIAN'
      navigate(isGuardian ? '/login-parent' : '/login', { replace: true })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [logout, navigate, user])

  return null
}

// ─── 라우트 가드 ─────────────────────────────────────────────────────────────

/** 미로그인 → 보호자 로그인 페이지 리다이렉트 */
function ParentPrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)

  if (!isAuthenticated) return <Navigate to="/login-parent" replace />
  // 직원이 보호자 경로에 접근 시 → 직원 홈으로
  if (user && user.role !== 'GUARDIAN') return <Navigate to="/home" replace />
  return <>{children}</>
}

/** 직원 전용 — GUARDIAN 역할이면 보호자 홈으로 */
function StaffRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'GUARDIAN') return <Navigate to="/parent/home" replace />
  return <>{children}</>
}

/** 직원 로그인 — 이미 로그인된 직원은 /home, 보호자는 /parent/home */
function PublicStaffRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <>{children}</>
  if (user?.role === 'GUARDIAN') return <Navigate to="/parent/home" replace />
  return <Navigate to="/home" replace />
}

/** 보호자 로그인 — 이미 로그인된 보호자는 /parent/home, 직원은 /home */
function PublicParentRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <>{children}</>
  if (user?.role === 'GUARDIAN') return <Navigate to="/parent/home" replace />
  return <Navigate to="/home" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionWatcher />
      <Routes>
        {/* ── 직원 로그인 ── */}
        <Route
          path="/login"
          element={
            <PublicStaffRoute>
              <LoginPage />
            </PublicStaffRoute>
          }
        />

        {/* ── 보호자 로그인 ── */}
        <Route
          path="/login-parent"
          element={
            <PublicParentRoute>
              <LoginParentPage />
            </PublicParentRoute>
          }
        />

        {/* ── 직원 페이지 ── */}
        <Route path="/home"      element={<StaffRoute><HomePage /></StaffRoute>} />
        <Route path="/dashboard" element={<StaffRoute><DashboardPage /></StaffRoute>} />
        <Route path="/reports"   element={<StaffRoute><ReportsPage /></StaffRoute>} />
        <Route path="/residents" element={<StaffRoute><ResidentsPage /></StaffRoute>} />
        <Route path="/board"     element={<StaffRoute><BoardListPage /></StaffRoute>} />
        <Route path="/board/new" element={<StaffRoute><BoardFormPage mode="create" /></StaffRoute>} />
        <Route path="/board/:id" element={<StaffRoute><BoardDetailPage /></StaffRoute>} />
        <Route path="/board/:id/edit" element={<StaffRoute><BoardFormPage mode="edit" /></StaffRoute>} />
        <Route path="/inquiries"     element={<StaffRoute><StaffInquiryListPage /></StaffRoute>} />
        <Route path="/inquiries/:id" element={<StaffRoute><StaffInquiryDetailPage /></StaffRoute>} />
        <Route path="/meals"         element={<StaffRoute><MealsPage /></StaffRoute>} />
        <Route path="/schedule"      element={<StaffRoute><SchedulePage /></StaffRoute>} />
        <Route path="/albums"        element={<StaffRoute><AlbumsPage /></StaffRoute>} />
        <Route path="/albums/:id"    element={<StaffRoute><AlbumDetailPage /></StaffRoute>} />

        {/* ── 보호자 페이지 ── */}
        <Route path="/parent/home"           element={<ParentPrivateRoute><ParentHomePage /></ParentPrivateRoute>} />
        <Route path="/parent/board"          element={<ParentPrivateRoute><ParentBoardListPage /></ParentPrivateRoute>} />
        <Route path="/parent/board/:id"      element={<ParentPrivateRoute><ParentBoardDetailPage /></ParentPrivateRoute>} />
        <Route path="/parent/notices"        element={<ParentPrivateRoute><ParentNoticeListPage /></ParentPrivateRoute>} />
        <Route path="/parent/notices/:id"    element={<ParentPrivateRoute><ParentNoticeDetailPage /></ParentPrivateRoute>} />
        <Route path="/parent/reports"        element={<ParentPrivateRoute><ParentReportListPage /></ParentPrivateRoute>} />
        <Route path="/parent/reports/:id"    element={<ParentPrivateRoute><ParentReportDetailPage /></ParentPrivateRoute>} />
        <Route path="/parent/inquiries"      element={<ParentPrivateRoute><ParentInquiryListPage /></ParentPrivateRoute>} />
        <Route path="/parent/inquiries/new"  element={<ParentPrivateRoute><ParentInquiryNewPage /></ParentPrivateRoute>} />
        <Route path="/parent/inquiries/:id"  element={<ParentPrivateRoute><ParentInquiryDetailPage /></ParentPrivateRoute>} />
        <Route path="/parent/meals"          element={<ParentPrivateRoute><ParentMealsPage /></ParentPrivateRoute>} />
        <Route path="/parent/schedule"       element={<ParentPrivateRoute><ParentSchedulePage /></ParentPrivateRoute>} />
        <Route path="/parent/albums"         element={<ParentPrivateRoute><ParentAlbumsPage /></ParentPrivateRoute>} />
        <Route path="/parent/albums/:id"     element={<ParentPrivateRoute><ParentAlbumDetailPage /></ParentPrivateRoute>} />

        {/* ── 폴백 ── */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
