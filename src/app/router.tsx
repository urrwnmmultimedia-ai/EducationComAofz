import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
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
    // หน้านักเรียน ม.3 — ครูเปิดดูได้ทุกหน้า (โหมดดูตัวอย่าง ไม่บันทึกผล)
    errorElement: <RouteError />,
    element: (
      <RequireRole role={['student', 'admin']} course="design_m3">
        <StudentLayout />
      </RequireRole>
    ),
    children: [
      { path: '/home', element: <StudentHomePage /> },
      { path: '/games', element: lazyPage(() => import('@/features/games/GamesPage'), 'GamesPage') },
      { path: '/assignments/:id', element: lazyPage(() => import('@/features/assignments/AssignmentPage'), 'AssignmentPage') },
      { path: '/exams/:id', element: lazyPage(() => import('@/features/exams/ExamPage'), 'ExamPage') },
      // คะแนนย้ายไปอยู่ในหน้า "ฉัน"
      { path: '/scores', element: <Navigate to="/profile?tab=scores" replace /> },
      { path: '/leaderboard', element: lazyPage(() => import('@/features/leaderboard/LeaderboardPage'), 'LeaderboardPage') },
      { path: '/profile', element: lazyPage(() => import('@/features/student/ProfilePage'), 'ProfilePage') },
      { path: '/lessons', element: lazyPage(() => import('@/features/lessons/LessonsMapPage'), 'LessonsMapPage') },
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
      { path: 'classrooms', element: lazyPage(() => import('@/features/admin/AdminClassroomsPage'), 'AdminClassroomsPage') },
      { path: 'progress', element: lazyPage(() => import('@/features/admin/AdminProgressPage'), 'AdminProgressPage') },
      { path: 'progress/:studentId', element: lazyPage(() => import('@/features/admin/AdminProgressPage'), 'AdminStudentProgressPage') },
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
  // ---------- DB Quest (ม.5) — แยกไฟล์โหลดทั้งก้อน ----------
  {
    path: '/db',
    errorElement: <RouteError />,
    element: (
      <RequireRole role={['student', 'admin']} course="dbquest_m5">
        {lazyPage(() => import('@/dbquest/DbqLayout'), 'DbqLayout')}
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="/db/home" replace /> },
      { path: 'home', element: lazyPage(() => import('@/dbquest/pages/DbqHomePage'), 'DbqHomePage') },
      { path: 'map', element: lazyPage(() => import('@/dbquest/pages/DbqMapPage'), 'DbqMapPage') },
      { path: 'lesson/:sessionNo', element: lazyPage(() => import('@/dbquest/lesson/DbqLessonPage'), 'DbqLessonPage') },
      { path: 'games/:gameKey', element: lazyPage(() => import('@/dbquest/games/DbqGamePage'), 'DbqGamePage') },
      { path: 'sql', element: lazyPage(() => import('@/dbquest/pages/DbqPages'), 'DbqSqlPage') },
      { path: 'glossary', element: lazyPage(() => import('@/dbquest/pages/DbqPages'), 'DbqGlossaryPage') },
      { path: 'assignments', element: lazyPage(() => import('@/dbquest/pages/DbqScoresPages'), 'DbqAssignmentsPage') },
      { path: 'exam/:quizId', element: lazyPage(() => import('@/dbquest/pages/DbqPages'), 'DbqExamPage') },
      { path: 'me', element: lazyPage(() => import('@/dbquest/pages/DbqScoresPages'), 'DbqMePage') },
    ],
  },
  {
    path: '/db/admin',
    errorElement: <RouteError />,
    element: <RequireRole role="admin">{lazyPage(() => import('@/dbquest/admin/DbqAdmin'), 'DbqAdminLayout')}</RequireRole>,
    children: [
      { index: true, element: lazyPage(() => import('@/dbquest/admin/DbqAdminHome'), 'DbqAdminHome') },
      { path: 'students', element: lazyPage(() => import('@/dbquest/admin/DbqAdminStudents'), 'DbqAdminStudents') },
      { path: 'students/:studentId', element: lazyPage(() => import('@/dbquest/admin/DbqAdminStudents'), 'DbqAdminStudentDetail') },
      { path: 'unlock', element: lazyPage(() => import('@/dbquest/admin/DbqAdminUnlock'), 'DbqAdminUnlock') },
      { path: 'grading', element: lazyPage(() => import('@/dbquest/admin/DbqAdminGrading'), 'DbqAdminGrading') },
      { path: 'exams', element: lazyPage(() => import('@/dbquest/admin/DbqAdminScores'), 'DbqAdminManualScores') },
      { path: 'gradebook', element: lazyPage(() => import('@/dbquest/admin/DbqAdminScores'), 'DbqAdminGradebook') },
      { path: 'answer-keys', element: lazyPage(() => import('@/dbquest/admin/DbqAdminKeys'), 'DbqAdminKeys') },
      { path: 'settings', element: lazyPage(() => import('@/dbquest/admin/DbqAdminSettings'), 'DbqAdminSettings') },
      { path: 'roster', element: lazyPage(() => import('@/dbquest/admin/DbqAdmin'), 'DbqRosterPage') },
      { path: 'classrooms', element: lazyPage(() => import('@/dbquest/admin/DbqAdmin'), 'DbqClassroomsPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
