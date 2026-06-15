import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DAYS, MEAL_LABEL } from '../lib/constants'
import { startOfWeek, addDays, toISODate, formatRange } from '../lib/dates'

export default function CookingPlan() {
  const { household } = useApp()
  const hid = household?.id
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const weekIso = toISODate(weekStart)
  const [plan, setPlan] = useState([])
  const [dishes, setDishes] = useState([])

  const load = useCallback(async () => {
    if (!hid) return
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from('meal_plan').select('*').eq('household_id', hid).eq('week_start', weekIso),
      supabase.from('dishes').select('*').eq('household_id', hid),
    ])
    setPlan(p || []); setDishes(d || [])
  }, [hid, weekIso])
  useEffect(() => { load() }, [load])

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d])), [dishes])

  const prepAhead = useMemo(() => {
    const seen = new Set(); const out = []
    plan.forEach((p) => {
      const d = dishById[p.dish_id]
      if (!d || seen.has(d.id)) return
      if (d.tags?.includes('הכנה מראש') || d.tags?.includes('נשמר טוב')) { seen.add(d.id); out.push(d) }
    })
    return out
  }, [plan, dishById])

  const byDay = useMemo(() => {
    return DAYS.map((name, day) => {
      const meals = plan.filter((p) => p.day === day && p.dish_id)
        .map((p) => ({ meal: p.meal_type, dish: dishById[p.dish_id] }))
        .filter((m) => m.dish)
      return { name, day, meals }
    })
  }, [plan, dishById])

  return (
    <div className="page">
      <div className="week-head">
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, -7))}>›</button>
        <div className="week-title"><h1>תכנון בישול</h1><span className="muted">{formatRange(weekStart)}</span></div>
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, 7))}>‹</button>
      </div>

      <section className="block">
        <h2 className="block-title">🥘 כדאי להכין מראש (יום ראשון)</h2>
        {prepAhead.length === 0 ? (
          <p className="muted small">אין השבוע מנות שתויגו "הכנה מראש" או "נשמר טוב". תייג מנות בבנק כדי לקבל הצעות.</p>
        ) : (
          <ul className="prep-list">
            {prepAhead.map((d) => (
              <li key={d.id}><strong>{d.name}</strong>{d.notes && <span className="muted"> — {d.notes}</span>}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2 className="block-title">📅 לוח הבישול לשבוע</h2>
        <div className="cook-days">
          {byDay.map((d) => (
            <div className="cook-day" key={d.day}>
              <div className="cook-day-name">{d.name}</div>
              {d.meals.length === 0 ? (
                <span className="muted small">—</span>
              ) : (
                <ul>
                  {d.meals.map((m, i) => (
                    <li key={i}><span className="meal-tag">{MEAL_LABEL[m.meal]}</span> {m.dish.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
