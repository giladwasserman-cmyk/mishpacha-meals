import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Nav from './components/Nav'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import DishBank from './pages/DishBank'
import WeeklyPlanner from './pages/WeeklyPlanner'
import ShoppingList from './pages/ShoppingList'
import CookingPlan from './pages/CookingPlan'
import NutritionProfile from './pages/NutritionProfile'
import Family from './pages/Family'
import PrintView from './pages/PrintView'

export default function App() {
  const { loading, session, profile } = useApp()

  if (loading) {
    return <div className="splash"><div className="splash-mark">🍽️</div><p>טוען…</p></div>
  }
  if (!session) return <Login />
  if (!profile?.household_id) return <Onboarding />

  return (
    <div className="shell">
      <Nav />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bank" element={<DishBank />} />
          <Route path="/week" element={<WeeklyPlanner />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/cooking" element={<CookingPlan />} />
          <Route path="/nutrition" element={<NutritionProfile />} />
          <Route path="/family" element={<Family />} />
          <Route path="/print" element={<PrintView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
