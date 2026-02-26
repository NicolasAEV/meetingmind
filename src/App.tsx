/**
 * App shell — owns the outer `.shell` frame and decides which page to render.
 *
 * Currently: single-page app (MeetingPage only).
 * To add routing in the future, replace the direct import with a router here.
 */
import './App.css'
import MeetingPage from './pages/Meeting/index.tsx'

export default function App() {
  return (
    <div className="shell">
      <MeetingPage />
    </div>
  )
}
