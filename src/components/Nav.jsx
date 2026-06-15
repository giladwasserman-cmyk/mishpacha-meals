import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

const TABS = [
  { to: '/', label: 'בית', icon: '🏠', end: true },
  { to: '/week', label: 'השבוע', icon: '🗓️' },
  { to: '/bank', label: 'מנות', icon: '🍲' },
  { to: '/shopping', label: 'קניות', icon: '🛒' },
]

export default function Nav() {
  const { profile, household } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()

  const go = (to) => { setMoreOpen(false); navigate(to) }
  const logout = async () => { await supabase.auth.signOut() }

  return (
    <>
      <header className="topbar">
        <div className="brand">מה אוכלים <span>השבוע</span></div>
        <button className="userchip" onClick={() => setMoreOpen(true)} aria-label="תפריט">
          <span className="avatar" style={{ background: profile?.color || '#2e6b4c' }}>
            {(profile?.display_name || '?').trim().charAt(0) || '?'}
          </span>
        </button>
      </header>

      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
        <button className="tab" onClick={() => setMoreOpen(true)}>
          <span className="tab-icon">⋯</span>
          <span className="tab-label">עוד</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <span className="avatar lg" style={{ background: profile?.color || '#2e6b4c' }}>
                {(profile?.display_name || '?').trim().charAt(0) || '?'}
              </span>
              <div>
                <strong>{profile?.display_name || 'בלי שם'}</strong>
                <div className="muted small">{household?.name}</div>
              </div>
            </div>
            <button className="sheet-link" onClick={() => go('/cooking')}>👩‍🍳 תכנון בישול</button>
            <button className="sheet-link" onClick={() => go('/nutrition')}>🥗 התזונה שלי</button>
            <button className="sheet-link" onClick={() => go('/family')}>👨‍👩‍👧 המשפחה</button>
            <button className="sheet-link" onClick={() => go('/print')}>🖨️ הדפסה / שמירה כ‑PDF</button>
            <button className="sheet-link danger" onClick={logout}>התנתקות</button>
          </div>
        </div>
      )}
    </>
  )
}
