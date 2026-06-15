import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DAYS, MEAL_LABEL } from '../lib/constants'
import { startOfWeek, toISODate } from '../lib/dates'

export default function Home() {
  const { profile, household, members } = useApp()
  const hid = household?.id
  const weekIso = toISODate(startOfWeek())
  const todayIdx = new Date().getDay() // 0=ראשון
  const [plan, setPlan] = useState([])
  const [dishes, setDishes] = useState([])

  const load = useCallback(async () => {
    if (!hid) return
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from('meal_plan').select('*').eq('household_id', hid).eq('week_start', weekIso),
      supabase.from('dishes').select('id,name').eq('household_id', hid),
    ])
    setPlan(p || []); setDishes(d || [])
  }, [hid, weekIso])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!hid) return
    const ch = supabase.channel('home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [hid, load])

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d.name])), [dishes])
  const isWeekday = todayIdx >= 0 && todayIdx <= 4

  const todayDinner = plan.find((p) => p.day === todayIdx && p.meal_type === 'dinner' && p.profile_id == null)
  const myBreakfast = plan.find((p) => p.day === todayIdx && p.meal_type === 'breakfast' && p.profile_id === profile.id)

  return (
    <div className="page home">
      <p className="hello">שלום {profile.display_name?.split(' ')[0] || ''} 👋</p>

      <div className="today-card">
        <div className="today-label">{isWeekday ? `היום · ${DAYS[todayIdx]}` : 'סוף שבוע'}</div>
        {isWeekday ? (
          <>
            <div className="today-dinner">
              <span className="today-k">לארוחת ערב</span>
              <strong>{todayDinner ? dishById[todayDinner.dish_id] : 'עוד לא תוכנן'}</strong>
            </div>
            {myBreakfast && (
              <div className="today-sub">לבוקר שלי: {dishById[myBreakfast.dish_id]}</div>
            )}
            <Link to="/week" className="btn primary sm">לתכנון השבוע</Link>
          </>
        ) : (
          <div className="today-sub">מתכננים ימים א׳–ה׳. שבת שלום! <Link to="/week">לשבוע הבא</Link></div>
        )}
      </div>

      <div className="tiles">
        <Link to="/bank" className="tile"><span className="tile-ic">🍲</span>בנק המנות</Link>
        <Link to="/week" className="tile"><span className="tile-ic">🗓️</span>הלוח השבועי</Link>
        <Link to="/shopping" className="tile"><span className="tile-ic">🛒</span>קניות</Link>
        <Link to="/cooking" className="tile"><span className="tile-ic">👩‍🍳</span>בישול</Link>
        <Link to="/nutrition" className="tile"><span className="tile-ic">🥗</span>התזונה שלי</Link>
        <Link to="/family" className="tile"><span className="tile-ic">👨‍👩‍👧</span>המשפחה</Link>
      </div>

      <div className="family-strip">
        {members.map((m) => (
          <span key={m.id} className="avatar sm" style={{ background: m.color }} title={m.display_name}>
            {(m.display_name || '?').charAt(0)}
          </span>
        ))}
      </div>
    </div>
  )
}
