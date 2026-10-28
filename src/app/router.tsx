import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { RequireRole } from './guards'
import { RouteError } from './RouteError'
import { LoginPage } from '@/features/auth/LoginPage'
import { StudentLayout } from '@/features/student/StudentLayout'
import { StudentHomePage } from '@/features/student/StudentHomePage'
import { NotFoundPage } from '@/components/NotFoundPage'
import { LoadingBlock } from '@/components/StatusViews'

// โหลดหน้าแยกไฟล์ (เปิดหน้าแรกเร็วขึ้น) — หน้าครูทั้งหมด และหน้านักเรียนที่ใช้ไลบรารีหนัก
function lazyPage<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  const Page = lazy<ComponentType>(() => loader().then((m) => ({ default: m[name] })))
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Page />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage />, errorElement: <RouteError /> },
  {
    errorElement: <RouteError />,
    element: (
      <RequireRole role="student">
        <StudentLayout />
      </RequireRole>
    ),
    children: [
      { path: '/home', element: <StudentHomePage /> },
      { path: '/games', element: lazyPage(() => import('@/features/games/GamesPage'), 'GamesPage') },
      { path: '/assignments/:id', element: lazyPage(() => import('@/features/assignments/AssignmentPage'), 'AssignmentPage') },
      { path: '/exams/:id', element: lazyPage(() => import('@/features/exams/ExamPage'), 'ExamPage') },
      { path: '/scores', element: lazyPage(() => import('@/features/student/ScoresPage'), 'ScoresPage') },
      { path: '/leaderboard', element: lazyPage(() => import('@/features/leaderboard/LeaderboardPage'), 'LeaderboardPage') },
      { path: '/profile', element: lazyPage(() => import('@/features/student/ProfilePage'), 'ProfilePage') },
    ],
  },
  {
    // ครูเปิดดูหน้าหน่วย/คาบ/เกมแบบนักเรียนได้ (โหมดดูตัวอย่าง)
    errorElement: <RouteError />,
    element: (
      <RequireRole role={['student', 'admin']}>
        <StudentLayout />
      </RequireRole>
    ),
    children: [
      { path: '/units/:unitId', element: lazyPage(() => import('@/features/units/UnitPage'), 'UnitPage') },
      { path: '/sessions/:no', element: lazyPage(() => import('@/features/lessons/SessionPage'), 'SessionPage') },
      { path: '/games/:slug', element: lazyPage(() => import('@/features/games/GamePlayPage'), 'GamePlayPage') },
    ],
  },
  {
    path: '/admin',
    errorElement: <RouteError />,
    element: <RequireRole role="admin">{lazyPage(() => import('@/features/admin/AdminLayout'), 'AdminLayout')}</RequireRole>,
    children: [
      { index: true, element: lazyPage(() => import('@/features/admin/AdminDashboardPage'), 'AdminDashboardPage') },
      { path: 'sessions', element: lazyPage(() => import('@/features/admin/AdminSessionsPage'), 'AdminSessionsPage') },
      { path: 'sessions/:no', element: lazyPage(() => import('@/features/admin/AdminSessionEditPage'), 'AdminSessionEditPage') },
      { path: 'attendance', element: lazyPage(() => import('@/features/admin/AdminAttendancePage'), 'AdminAttendancePage') },
      { path: 'classrooms', element: lazyPage(() => import('@/features/admin/AdminClassroomsPage'), 'AdminClassroomsPage') },
      { path: 'students', element: lazyPage(() => import('@/features/admin/AdminStudentsPage'), 'AdminStudentsPage') },
      { path: 'assignments', element: lazyPage(() => import('@/features/admin/AdminAssignmentsPage'), 'AdminAssignmentsPage') },
      { path: 'assignments/:id', element: lazyPage(() => import('@/features/admin/AdminAssignmentEditPage'), 'AdminAssignmentEditPage') },
      { path: 'assignments/:id/grade', element: lazyPage(() => import('@/features/admin/AdminGradingPage'), 'AdminGradingPage') },
      { path: 'gradebook', element: lazyPage(() => import('@/features/admin/AdminGradebookPage'), 'AdminGradebookPage') },
      { path: 'questions', element: lazyPage(() => import('@/features/admin/AdminQuestionsPage'), 'AdminQuestionsPage') },
      { path: 'exams', element: lazyPage(() => import('@/features/admin/AdminExamsPage'), 'AdminExamsPage') },
      { path: 'exams/:id', element: lazyPage(() => import('@/features/admin/AdminExamEditPage'), 'AdminExamEditPage') },
      { path: 'exams/:id/results', element: lazyPage(() => import('@/features/admin/AdminExamResultsPage'), 'AdminExamResultsPage') },
      { path: 'games', element: lazyPage(() => import('@/features/admin/AdminGamesPage'), 'AdminGamesPage') },
      { path: 'games/:slug', element: lazyPage(() => import('@/features/admin/AdminGamesPage'), 'AdminGameEditPage') },
      { path: 'settings', element: lazyPage(() => import('@/features/admin/AdminSettingsPage'), 'AdminSettingsPage') },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
