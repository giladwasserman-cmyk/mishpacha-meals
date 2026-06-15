import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DAYS, MEAL_LABEL } from '../lib/constants'
import { startOfWeek, addDays, toISODate, formatRange } from '../lib/dates'

// כמה פעמים מותר לחזור על אותה מנה בבית ספר, באותו שבוע, לאותו ילד
const SCHOOL_LIMIT = 3

export default function WeeklyPlanner() {
  const { profile, household, members } = useApp()
  const hid = household?.id
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const weekIso = toISODate(weekStart)
  const [dishes, setDishes] = useState([])
  const [plan, setPlan] = useState([])
  const [picker, setPicker] = useState(null) // {day, meal_type, profile_id, mealLabel}
  const [openKids, setOpenKids] = useState({})

  const kids = members.filter((m) => m.role === 'kid')

  const loadDishes = useCallback(async () => {
    if (!hid) return
    const { data } = await supabase.from('dishes').select('*').eq('household_id', hid).order('name')
    setDishes(data || [])
  }, [hid])

  const loadPlan = useCallback(async () => {
    if (!hid) return
    const { data } = await supabase.from('meal_plan').select('*')
      .eq('household_id', hid).eq('week_start', weekIso)
    setPlan(data || [])
  }, [hid, weekIso])

  useEffect(() => { loadDishes() }, [loadDishes])
  useEffect(() => { loadPlan() }, [loadPlan])
  useEffect(() => {
    if (!hid) return
    const ch = supabase.channel('plan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan' }, loadPlan)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, loadDishes)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [hid, loadPlan, loadDishes])

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d])), [dishes])

  // כל המנות במשבצת (יכולות להיות כמה)
  const rowsFor = (day, meal, pid) =>
    plan.filter((p) => p.day === day && p.meal_type === meal &&
      ((pid == null && p.profile_id == null) || p.profile_id === pid))

  const toggleDish = async (cell, dishId) => {
    const rows = rowsFor(cell.day, cell.meal_type, cell.profile_id)
    const existing = rows.find((r) => r.dish_id === dishId)
    if (existing) {
      await supabase.from('meal_plan').delete().eq('id', existing.id)
    } else {
      // מגבלת גיוון לבית ספר
      if (cell.meal_type === 'school' && cell.profile_id) {
        const count = plan.filter((p) => p.meal_type === 'school' &&
          p.profile_id === cell.profile_id && p.dish_id === dishId).length
        if (count >= SCHOOL_LIMIT) {
          alert(`אפשר לשבץ את אותה מנה לבית ספר עד ${SCHOOL_LIMIT} פעמים בשבוע — בשביל גיוון 🙂`)
          return
        }
      }
      await supabase.from('meal_plan').insert({
        household_id: hid, week_start: weekIso, day: cell.day,
        meal_type: cell.meal_type, profile_id: cell.profile_id ?? null, dish_id: dishId,
      })
    }
    loadPlan()
  }

  const clearSlot = async (cell) => {
    const rows = rowsFor(cell.day, cell.meal_type, cell.profile_id)
    if (!rows.length) return
    await supabase.from('meal_plan').delete().in('id', rows.map((r) => r.id))
    loadPlan()
  }

  const Cell = ({ day, meal, pid }) => {
    const rows = rowsFor(day, meal, pid)
    return (
      <button className={'cell' + (rows.length ? ' filled' : '')}
        onClick={() => setPicker({ day, meal_type: meal, profile_id: pid ?? null, mealLabel: MEAL_LABEL[meal] })}>
        {rows.length ? (
          <span className="cell-dishes">
            {rows.map((r) => (
              <span key={r.id} className="cell-dish">{dishById[r.dish_id]?.name || '—'}</span>
            ))}
          </span>
        ) : <span className="cell-plus">+</span>}
      </button>
    )
  }

  const TrackRow = ({ label, meal, pid, accent }) => (
    <div className="track">
      <div className="track-label" style={accent ? { borderInlineStartColor: accent } : undefined}>{label}</div>
      <div className="track-cells">
        {DAYS.map((_, d) => <Cell key={d} day={d} meal={meal} pid={pid} />)}
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="week-head">
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, -7))}>›</button>
        <div className="week-title">
          <h1>השבוע</h1>
          <span className="muted">{formatRange(weekStart)}</span>
        </div>
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, 7))}>‹</button>
      </div>
      <div className="week-tools">
        <button className="btn ghost sm" onClick={() => setWeekStart(startOfWeek())}>השבוע הנוכחי</button>
      </div>

      <div className="day-headrow">
        <div className="day-spacer" />
        {DAYS.map((d) => <div key={d} className="day-name">{d}</div>)}
      </div>

      <section className="block">
        <h2 className="block-title">🍽️ ארוחת ערב</h2>
        <p className="muted small">משותף לכולם, או לכל אחד מה שבא לו — לא חייבים ארוחה משפחתית כל ערב.</p>
        <TrackRow label="כל המשפחה" meal="dinner" pid={null} accent="#2e6b4c" />
        {members.map((m) => (
          <TrackRow key={m.id}
            label={(m.display_name || 'בלי שם') + (m.id === profile.id ? ' (אני)' : '')}
            meal="dinner" pid={m.id} accent={m.color} />
        ))}
      </section>

      <section className="block">
        <h2 className="block-title">🌅 ארוחת הבוקר שלי</h2>
        <TrackRow label={profile.display_name || 'אני'} meal="breakfast" pid={profile.id} accent={profile.color} />
      </section>

      <section className="block">
        <h2 className="block-title">🎒 ילדים — צהריים ובית ספר</h2>
        {kids.length === 0 && <p className="muted small">עדיין אין ילדים במשפחה. אפשר להוסיף ממסך "המשפחה".</p>}
        {kids.map((k) => {
          const open = openKids[k.id] ?? true
          return (
            <div className="kid-block" key={k.id}>
              <button className="kid-head" onClick={() => setOpenKids((s) => ({ ...s, [k.id]: !open }))}>
                <span className="avatar sm" style={{ background: k.color }}>{(k.display_name || '?').charAt(0)}</span>
                <strong>{k.display_name || 'ילד/ה'}</strong>
                <span className="chev">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="kid-tracks">
                  <TrackRow label="צהריים" meal="lunch" pid={k.id} accent={k.color} />
                  <TrackRow label="בית ספר" meal="school" pid={k.id} accent={k.color} />
                </div>
              )}
            </div>
          )
        })}
      </section>

      {picker && (() => {
        const slotRows = rowsFor(picker.day, picker.meal_type, picker.profile_id)
        const selected = new Set(slotRows.map((r) => r.dish_id))
        const schoolCounts = {}
        if (picker.meal_type === 'school') {
          plan.filter((p) => p.meal_type === 'school' && p.profile_id === picker.profile_id && p.dish_id)
            .forEach((p) => { schoolCounts[p.dish_id] = (schoolCounts[p.dish_id] || 0) + 1 })
        }
        return (
          <DishPicker
            cell={picker} dishes={dishes}
            selected={selected} counts={schoolCounts} limit={SCHOOL_LIMIT}
            onToggle={(id) => toggleDish(picker, id)}
            onClear={() => clearSlot(picker)}
            onClose={() => setPicker(null)}
          />
        )
      })()}
    </div>
  )
}

function DishPicker({ cell, dishes, selected, counts = {}, limit = 3, onToggle, onClear, onClose }) {
  const [q, setQ] = useState('')
  const isSchool = cell.meal_type === 'school'
  const list = dishes
    .filter((d) => d.meal_types?.includes(cell.meal_type))
    .filter((d) => !q || d.name.includes(q.trim()))
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="picker-head">
          <strong>{DAYS[cell.day]} · {cell.mealLabel}</strong>
          {selected.size > 0 && <button className="link danger" onClick={onClear}>נקה הכל</button>}
        </div>
        <p className="muted small">
          {isSchool
            ? `אפשר לבחור כמה מנות. לגיוון: אותה מנה עד ${limit} פעמים בשבוע.`
            : 'אפשר לבחור כמה מנות — לחיצה מוסיפה או מסירה.'}
        </p>
        <input className="search" placeholder="חיפוש מנה…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="picker-list">
          {list.length === 0 && <p className="muted small">אין מנות ל{cell.mealLabel}. צור מנה בבנק.</p>}
          {list.map((d) => {
            const isSel = selected.has(d.id)
            const used = counts[d.id] || 0
            const atLimit = isSchool && used >= limit && !isSel
            return (
              <button key={d.id} disabled={atLimit}
                className={'picker-item' + (isSel ? ' on' : '') + (atLimit ? ' disabled' : '')}
                onClick={() => !atLimit && onToggle(d.id)}>
                <span className="pick-name">
                  <span className={'check' + (isSel ? ' on' : '')}>{isSel ? '✓' : ''}</span>
                  {d.name}
                </span>
                <span className="picker-tags">
                  {atLimit ? `כבר ${limit} פעמים השבוע` : (d.tags?.slice(0, 2).join(' · '))}
                </span>
              </button>
            )
          })}
        </div>
        <button className="btn primary block done-btn" onClick={onClose}>סיום</button>
      </div>
    </div>
  )
}
