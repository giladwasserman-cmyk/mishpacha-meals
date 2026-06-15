import { useEffect, useMemo, useState, useCallback, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DAYS, MEAL_LABEL, CATEGORIES } from '../lib/constants'
import { startOfWeek, toISODate, formatRange } from '../lib/dates'

export default function PrintView() {
  const { household, members } = useApp()
  const hid = household?.id
  const weekStart = startOfWeek()
  const weekIso = toISODate(weekStart)
  const [plan, setPlan] = useState([])
  const [dishes, setDishes] = useState([])
  const [shop, setShop] = useState([])

  const load = useCallback(async () => {
    if (!hid) return
    const [{ data: p }, { data: d }, { data: s }] = await Promise.all([
      supabase.from('meal_plan').select('*').eq('household_id', hid).eq('week_start', weekIso),
      supabase.from('dishes').select('id,name').eq('household_id', hid),
      supabase.from('shopping_items').select('*').eq('household_id', hid).eq('week_start', weekIso),
    ])
    setPlan(p || []); setDishes(d || []); setShop(s || [])
  }, [hid, weekIso])
  useEffect(() => { load() }, [load])

  const dishById = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d.name])), [dishes])
  const kids = members.filter((m) => m.role === 'kid')

  const cell = (day, meal, pid) => {
    const e = plan.find((p) => p.day === day && p.meal_type === meal &&
      ((pid == null && p.profile_id == null) || p.profile_id === pid))
    return e ? dishById[e.dish_id] : ''
  }

  const shopGrouped = CATEGORIES
    .map((c) => [c, shop.filter((i) => (i.category || 'אחר') === c)])
    .filter(([, l]) => l.length)

  return (
    <div className="page print-page">
      <div className="print-tools no-print">
        <button className="btn primary" onClick={() => window.print()}>🖨️ הדפס / שמור כ‑PDF</button>
        <span className="muted small">בחלון ההדפסה בחר "שמירה כ‑PDF".</span>
      </div>

      <div className="sheet-print">
        <h1 className="print-title">{household.name} — תפריט השבוע</h1>
        <div className="print-range">{formatRange(weekStart)} · ימים א׳–ה׳</div>

        <table className="print-table">
          <thead>
            <tr><th>ארוחה</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="row-strong">
              <td>ערב משפחתי</td>
              {DAYS.map((_, d) => <td key={d}>{cell(d, 'dinner', null)}</td>)}
            </tr>
            {kids.map((k) => (
              <Fragment key={k.id}>
                <tr><td>{k.display_name} · צהריים</td>{DAYS.map((_, d) => <td key={d}>{cell(d, 'lunch', k.id)}</td>)}</tr>
                <tr><td>{k.display_name} · בית ספר</td>{DAYS.map((_, d) => <td key={d}>{cell(d, 'school', k.id)}</td>)}</tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        <h2 className="print-h2">רשימת קניות</h2>
        {shopGrouped.length === 0 ? <p>אין פריטים.</p> : (
          <div className="print-shop">
            {shopGrouped.map(([cat, list]) => (
              <div className="print-shop-col" key={cat}>
                <h4>{cat}</h4>
                <ul>{list.map((i) => <li key={i.id}>☐ {i.name}{i.qty ? ` (${i.qty})` : ''}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
