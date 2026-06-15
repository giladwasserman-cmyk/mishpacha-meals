import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { NUTRITION_SEED } from '../data/nutritionSeed'

export default function NutritionProfile() {
  const { profile } = useApp()
  const [content, setContent] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('nutrition_profiles')
      .select('content').eq('owner_id', profile.id).maybeSingle()
    const c = data?.content
    setContent(Array.isArray(c) && c.length ? c : null)
  }, [profile.id])
  useEffect(() => { load() }, [load])

  const effective = content || NUTRITION_SEED

  const save = async (next) => {
    setBusy(true)
    await supabase.from('nutrition_profiles')
      .upsert({ owner_id: profile.id, content: next, updated_at: new Date().toISOString() })
    setContent(next); setBusy(false); setEditing(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>התזונה שלי</h1>
          <span className="private-badge">🔒 פרטי — רק אתה רואה את זה</span>
        </div>
        {!editing && <button className="btn ghost" onClick={() => setEditing(true)}>עריכה</button>}
      </div>

      {!content && !editing && (
        <div className="note">אלו העקרונות שחילצנו מהשיחה עם התזונאית. עבור עליהם, ערוך אם צריך, ושמור.</div>
      )}
      {saved && <div className="note ok">נשמר ✓</div>}

      {editing ? (
        <Editor initial={effective} busy={busy}
          onCancel={() => setEditing(false)}
          onReset={() => setContent(null)}
          onSave={save} />
      ) : (
        <div className="nutri">
          {effective.map((sec, i) => (
            <section className="nutri-sec" key={i}>
              <h3>{sec.title}</h3>
              <ul>{(sec.items || []).map((it, j) => <li key={j}>{it}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Editor({ initial, busy, onCancel, onReset, onSave }) {
  const [secs, setSecs] = useState(() => JSON.parse(JSON.stringify(initial)))

  const setTitle = (i, v) => setSecs((s) => s.map((x, idx) => idx === i ? { ...x, title: v } : x))
  const setItem = (i, j, v) => setSecs((s) => s.map((x, idx) =>
    idx === i ? { ...x, items: x.items.map((it, k) => k === j ? v : it) } : x))
  const addItem = (i) => setSecs((s) => s.map((x, idx) => idx === i ? { ...x, items: [...x.items, ''] } : x))
  const delItem = (i, j) => setSecs((s) => s.map((x, idx) =>
    idx === i ? { ...x, items: x.items.filter((_, k) => k !== j) } : x))
  const delSec = (i) => setSecs((s) => s.filter((_, idx) => idx !== i))
  const addSec = () => setSecs((s) => [...s, { title: 'כותרת חדשה', items: [''] }])

  const clean = () => secs
    .map((x) => ({ title: x.title.trim(), items: x.items.map((i) => i.trim()).filter(Boolean) }))
    .filter((x) => x.title || x.items.length)

  return (
    <div className="nutri-edit">
      {secs.map((sec, i) => (
        <section className="nutri-sec edit" key={i}>
          <div className="sec-head">
            <input className="sec-title" value={sec.title} onChange={(e) => setTitle(i, e.target.value)} />
            <button className="x small" onClick={() => delSec(i)}>✕</button>
          </div>
          {sec.items.map((it, j) => (
            <div className="item-row" key={j}>
              <textarea rows={1} value={it} onChange={(e) => setItem(i, j, e.target.value)} />
              <button className="x small" onClick={() => delItem(i, j)}>✕</button>
            </div>
          ))}
          <button className="link" onClick={() => addItem(i)}>+ שורה</button>
        </section>
      ))}
      <button className="btn ghost block" onClick={addSec}>+ הוסף נושא</button>
      <div className="edit-foot">
        <button className="link danger" onClick={() => { onReset(); onCancel() }}>שחזר לברירת המחדל</button>
        <div className="spacer" />
        <button className="btn ghost" onClick={onCancel}>ביטול</button>
        <button className="btn primary" disabled={busy} onClick={() => onSave(clean())}>{busy ? 'שומר…' : 'שמירה'}</button>
      </div>
    </div>
  )
}
