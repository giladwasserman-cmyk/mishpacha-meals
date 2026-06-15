import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { CATEGORIES } from '../lib/constants'
import { startOfWeek, addDays, toISODate, formatRange } from '../lib/dates'

export default function ShoppingList() {
  const { household } = useApp()
  const hid = household?.id
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const weekIso = toISODate(weekStart)
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('אחר')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!hid) return
    const { data } = await supabase.from('shopping_items').select('*')
      .eq('household_id', hid).eq('week_start', weekIso).order('created_at')
    setItems(data || [])
  }, [hid, weekIso])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!hid) return
    const ch = supabase.channel('shop')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [hid, load])

  const generate = async () => {
    if (!confirm('ליצור רשימה מהמנות של השבוע? פריטים אוטומטיים קיימים יוחלפו (פריטים שהוספת ידנית יישארו).')) return
    setBusy(true)
    // אסוף את כל המנות המשובצות בשבוע
    const { data: plan } = await supabase.from('meal_plan').select('dish_id')
      .eq('household_id', hid).eq('week_start', weekIso)
    const ids = [...new Set((plan || []).map((p) => p.dish_id).filter(Boolean))]
    let dishes = []
    if (ids.length) {
      const { data: d } = await supabase.from('dishes').select('id,ingredients').in('id', ids)
      dishes = d || []
    }
    // צבירה לפי שם מרכיב
    const agg = {}
    dishes.forEach((d) => (d.ingredients || []).forEach((ing) => {
      if (!ing?.name) return
      const key = ing.name.trim()
      if (!agg[key]) agg[key] = { name: key, category: ing.category || 'אחר', parts: [] }
      const part = [ing.qty, ing.unit].filter(Boolean).join(' ').trim()
      if (part) agg[key].parts.push(part)
    }))
    const autoRows = Object.values(agg).map((a) => ({
      household_id: hid, week_start: weekIso, name: a.name, category: a.category,
      qty: a.parts.join(' + '), checked: false, source: 'auto',
    }))
    // החלף אוטומטיים בלבד
    await supabase.from('shopping_items').delete()
      .eq('household_id', hid).eq('week_start', weekIso).eq('source', 'auto')
    if (autoRows.length) await supabase.from('shopping_items').insert(autoRows)
    setBusy(false)
    load()
  }

  const toggle = async (it) => {
    await supabase.from('shopping_items').update({ checked: !it.checked }).eq('id', it.id)
    load()
  }
  const addManual = async () => {
    if (!newName.trim()) return
    await supabase.from('shopping_items').insert({
      household_id: hid, week_start: weekIso, name: newName.trim(),
      category: newCat, source: 'manual', checked: false,
    })
    setNewName('')
    load()
  }
  const remove = async (it) => {
    await supabase.from('shopping_items').delete().eq('id', it.id)
    load()
  }
  const clearChecked = async () => {
    await supabase.from('shopping_items').delete()
      .eq('household_id', hid).eq('week_start', weekIso).eq('checked', true)
    load()
  }

  const grouped = useMemo(() => {
    const g = {}
    items.forEach((it) => { (g[it.category || 'אחר'] ||= []).push(it) })
    return CATEGORIES.filter((c) => g[c]?.length).map((c) => [c, g[c]])
  }, [items])

  const remaining = items.filter((i) => !i.checked).length

  return (
    <div className="page">
      <div className="week-head">
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, -7))}>›</button>
        <div className="week-title"><h1>רשימת קניות</h1><span className="muted">{formatRange(weekStart)}</span></div>
        <button className="nav-arrow" onClick={() => setWeekStart(addDays(weekStart, 7))}>‹</button>
      </div>

      <div className="shop-tools">
        <button className="btn primary" disabled={busy} onClick={generate}>{busy ? 'יוצר…' : '↻ צור רשימה מהשבוע'}</button>
        {items.some((i) => i.checked) && <button className="btn ghost" onClick={clearChecked}>נקה מסומנים</button>}
      </div>

      <div className="add-manual">
        <input className="search" placeholder="הוסף פריט…" value={newName}
          onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManual()} />
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn" onClick={addManual}>הוסף</button>
      </div>

      {items.length === 0 ? (
        <div className="empty"><p>הרשימה ריקה.</p><span className="muted small">שבץ מנות בלוח השבועי ואז לחץ "צור רשימה מהשבוע".</span></div>
      ) : (
        <>
          <p className="muted small">{remaining} פריטים לקנייה</p>
          {grouped.map(([cat, list]) => (
            <div className="shop-group" key={cat}>
              <h3 className="shop-cat">{cat}</h3>
              {list.map((it) => (
                <div className={'shop-item' + (it.checked ? ' done' : '')} key={it.id}>
                  <label>
                    <input type="checkbox" checked={it.checked} onChange={() => toggle(it)} />
                    <span className="shop-name">{it.name}</span>
                    {it.qty && <span className="shop-qty">{it.qty}</span>}
                  </label>
                  <button className="x small" onClick={() => remove(it)}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
