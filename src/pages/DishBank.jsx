import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { MEAL_TYPES, MEAL_LABEL, TAGS, CATEGORIES } from '../lib/constants'
import { SEED_DISHES } from '../data/seedDishes'

export default function DishBank() {
  const { profile, household, members } = useApp()
  const [dishes, setDishes] = useState([])
  const [favs, setFavs] = useState([]) // {dish_id, profile_id}
  const [filterMeal, setFilterMeal] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // dish object or 'new'
  const [loading, setLoading] = useState(true)

  const hid = household?.id

  const load = useCallback(async () => {
    if (!hid) return
    const [{ data: d }, { data: f }] = await Promise.all([
      supabase.from('dishes').select('*').eq('household_id', hid).order('name'),
      supabase.from('dish_favorites').select('*'),
    ])
    setDishes(d || [])
    setFavs(f || [])
    setLoading(false)
  }, [hid])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!hid) return
    const ch = supabase.channel('bank')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_favorites' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [hid, load])

  const myFavIds = useMemo(
    () => new Set(favs.filter((f) => f.profile_id === profile.id).map((f) => f.dish_id)),
    [favs, profile.id]
  )
  const favsByDish = useMemo(() => {
    const map = {}
    favs.forEach((f) => { (map[f.dish_id] ||= []).push(f.profile_id) })
    return map
  }, [favs])

  const shown = dishes.filter((d) => {
    if (filterMeal !== 'all' && !d.meal_types?.includes(filterMeal)) return false
    if (onlyMine && !myFavIds.has(d.id)) return false
    if (q && !d.name.includes(q.trim())) return false
    return true
  })

  const toggleFav = async (dish) => {
    if (myFavIds.has(dish.id)) {
      await supabase.from('dish_favorites').delete()
        .eq('dish_id', dish.id).eq('profile_id', profile.id)
    } else {
      await supabase.from('dish_favorites').insert({ dish_id: dish.id, profile_id: profile.id })
    }
    load()
  }

  const removeDish = async (dish) => {
    if (!confirm(`למחוק את "${dish.name}"?`)) return
    await supabase.from('dishes').delete().eq('id', dish.id)
    load()
  }

  const loadSeed = async () => {
    if (!confirm('להוסיף את מנות הדוגמה לבנק?')) return
    const rows = SEED_DISHES.map((s) => ({ ...s, household_id: hid, created_by: profile.id }))
    await supabase.from('dishes').insert(rows)
    load()
  }

  const canEdit = (d) => profile.role === 'parent' || d.created_by === profile.id

  return (
    <div className="page">
      <div className="page-head">
        <h1>בנק המנות</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>+ מנה חדשה</button>
      </div>

      <div className="filters">
        <input className="search" placeholder="חיפוש מנה…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={'chip' + (filterMeal === 'all' ? ' on' : '')} onClick={() => setFilterMeal('all')}>הכל</button>
          {MEAL_TYPES.map((m) => (
            <button key={m.key} className={'chip' + (filterMeal === m.key ? ' on' : '')}
              onClick={() => setFilterMeal(m.key)}>{m.label}</button>
          ))}
          <button className={'chip heart' + (onlyMine ? ' on' : '')} onClick={() => setOnlyMine((v) => !v)}>♥ אהובות עליי</button>
        </div>
      </div>

      {loading ? (
        <p className="muted">טוען…</p>
      ) : dishes.length === 0 ? (
        <div className="empty">
          <p>הבנק ריק עדיין.</p>
          <button className="btn" onClick={loadSeed}>טען מנות לדוגמה</button>
          <span className="muted small">או צור מנה חדשה.</span>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">אין מנות שמתאימות לסינון.</p>
      ) : (
        <div className="dish-grid">
          {shown.map((d) => (
            <div className="dish-card" key={d.id}>
              <div className="dish-top">
                <h3>{d.name}</h3>
                <button className={'heart-btn' + (myFavIds.has(d.id) ? ' on' : '')}
                  onClick={() => toggleFav(d)} aria-label="אוהב">♥</button>
              </div>
              <div className="dish-meta">
                {d.meal_types?.map((mt) => <span key={mt} className="pill">{MEAL_LABEL[mt]}</span>)}
                {d.tags?.map((t) => <span key={t} className="pill tag">{t}</span>)}
              </div>
              {d.notes && <p className="dish-notes">{d.notes}</p>}
              <div className="dish-foot">
                <div className="likers">
                  {(favsByDish[d.id] || []).map((pid) => {
                    const m = members.find((x) => x.id === pid)
                    return <span key={pid} className="avatar xs" title={m?.display_name}
                      style={{ background: m?.color || '#999' }}>{(m?.display_name || '?').charAt(0)}</span>
                  })}
                </div>
                {canEdit(d) && (
                  <div className="row-actions">
                    <button className="link" onClick={() => setEditing(d)}>עריכה</button>
                    <button className="link danger" onClick={() => removeDish(d)}>מחיקה</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dishes.length > 0 && (
        <button className="btn ghost block mt" onClick={loadSeed}>הוסף מנות דוגמה נוספות</button>
      )}

      {editing && (
        <DishForm dish={editing === 'new' ? null : editing}
          hid={hid} createdBy={profile.id}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

function DishForm({ dish, hid, createdBy, onClose, onSaved }) {
  const [name, setName] = useState(dish?.name || '')
  const [mealTypes, setMealTypes] = useState(dish?.meal_types || [])
  const [tags, setTags] = useState(dish?.tags || [])
  const [notes, setNotes] = useState(dish?.notes || '')
  const [ingredients, setIngredients] = useState(
    dish?.ingredients?.length ? dish.ingredients : [{ name: '', qty: '', unit: '', category: 'אחר' }]
  )
  const [busy, setBusy] = useState(false)

  const toggle = (arr, set, val) =>
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])

  const setIng = (i, key, val) =>
    setIngredients((rows) => rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  const addIng = () => setIngredients((r) => [...r, { name: '', qty: '', unit: '', category: 'אחר' }])
  const delIng = (i) => setIngredients((r) => r.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!name.trim()) return alert('צריך שם למנה')
    setBusy(true)
    const payload = {
      household_id: hid, name: name.trim(),
      meal_types: mealTypes, tags,
      ingredients: ingredients.filter((r) => r.name.trim()),
      notes: notes.trim(),
    }
    if (dish?.id) await supabase.from('dishes').update(payload).eq('id', dish.id)
    else await supabase.from('dishes').insert({ ...payload, created_by: createdBy })
    setBusy(false)
    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{dish ? 'עריכת מנה' : 'מנה חדשה'}</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="field"><span>שם המנה</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: שקשוקה" />
          </label>

          <div className="field"><span>מתי אוכלים?</span>
            <div className="chips">
              {MEAL_TYPES.map((m) => (
                <button key={m.key} type="button"
                  className={'chip' + (mealTypes.includes(m.key) ? ' on' : '')}
                  onClick={() => toggle(mealTypes, setMealTypes, m.key)}>{m.label}</button>
              ))}
            </div>
          </div>

          <div className="field"><span>תגיות</span>
            <div className="chips">
              {TAGS.map((t) => (
                <button key={t} type="button"
                  className={'chip' + (tags.includes(t) ? ' on' : '')}
                  onClick={() => toggle(tags, setTags, t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="field"><span>מרכיבים (לרשימת הקניות)</span>
            <div className="ing-list">
              {ingredients.map((r, i) => (
                <div className="ing-row" key={i}>
                  <input className="ing-name" placeholder="מרכיב" value={r.name}
                    onChange={(e) => setIng(i, 'name', e.target.value)} />
                  <input className="ing-qty" placeholder="כמות" value={r.qty}
                    onChange={(e) => setIng(i, 'qty', e.target.value)} />
                  <input className="ing-unit" placeholder="יח׳" value={r.unit}
                    onChange={(e) => setIng(i, 'unit', e.target.value)} />
                  <select value={r.category} onChange={(e) => setIng(i, 'category', e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="x small" onClick={() => delIng(i)}>✕</button>
                </div>
              ))}
            </div>
            <button className="link" onClick={addIng}>+ הוסף מרכיב</button>
          </div>

          <label className="field"><span>הערות / הכנה</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>ביטול</button>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>
    </div>
  )
}
