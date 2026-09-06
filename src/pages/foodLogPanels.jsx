// ============================================================
// Food Log — טאב השבוע, טאב המשקל, ומודל ההגדרות.
// המרה ל-React של renderWeekTab / renderWeightTab / renderSettings
// (food-tracker.html:711–844). החישובים עצמם מיובאים מ-foodLogCore.
// ============================================================

import { useState, useEffect } from 'react'
import {
  FONTS, computeTrend, trendRate, splurgeCount, fmt, fmt1, isoDate, displayDate,
  composeTotals, composeDescription,
} from '../lib/foodLogCore'

/* ================= פירוק ההערכה לפריטים =================
   מחליף את שורת "זוהה:" שהראתה שמות בלבד. שם המספר הכולל היה
   אטום — אי אפשר היה לדעת איזה פריט תרם את הפחמימות. כאן רואים
   כמה כל פריט תרם, אפשר להכפיל פריט שהוערך קטן מדי, ואפשר לאפס
   פריט שלא היה בצלחת. הסכום מתעדכן בהתאם. */
export function ItemBreakdown({ items, setItems, t, scale = 1 }) {
  const L = t.locale()
  if (!items?.length) return null
  const r1 = (n) => Math.round(n * 10) / 10

  const setQty = (idx, qty) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(0, qty) } : it))
  const bump = (idx, delta) =>
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const cur = Number(it.qty ?? 1) || 0
      return { ...it, qty: Math.max(0, Math.round((cur + delta) * 10) / 10) }
    }))

  return (
    <div className="item-breakdown">
      <div className="plabel">{t.tr('breakdown')}</div>
      {items.map((it, idx) => {
        const q = Number(it.qty ?? 1) || 0
        const eff = q * scale // מה שבאמת נספר: כמות הפריט × מנת המנה
        const off = q === 0
        return (
          <div className={'bd-row' + (off ? ' off' : '')} key={idx}>
            <div className="bd-meta">
              <div className="bd-name">
                {it.name}{it.portion && <span className="bd-portion">{it.portion}</span>}
              </div>
              {/* קלוריות, חלבון ופחמימות בלבד — ארבעה ערכים נחתכים
                  ברוחב טלפון, ואלה השלושה שהתוכנית נשענת עליהם.
                  השומן והנתרן נשארים בשדות הסיכום מתחת. */}
              <div className="bd-nums">
                {fmt((Number(it.calories) || 0) * eff, L)} {t.tr('kcal')} ·{' '}
                {t.tr('abbrProtein')} {r1((Number(it.protein_g) || 0) * eff)} ·{' '}
                {t.tr('abbrCarbs')} {r1((Number(it.carbs_g) || 0) * eff)}
              </div>
            </div>
            <div className="comp-qty">
              <button onClick={() => bump(idx, -0.5)} disabled={q <= 0} aria-label="-">−</button>
              <input type="number" step="0.1" min="0" value={q}
                onChange={(e) => setQty(idx, Number(e.target.value) || 0)} />
              <button onClick={() => bump(idx, 0.5)} aria-label="+">+</button>
            </div>
          </div>
        )
      })}
      <div className="bd-hint">{t.tr('breakdownHint')}</div>
    </div>
  )
}

/* דגלי בדיקת התוכנית — flagsHtml במקור (שורות 591–594) */
export function Flags({ flags }) {
  if (!flags?.length) return null
  return (
    <div className="flags">
      {flags.map((f, i) => <div className={'flag ' + f.sev} key={i}>{f.text}</div>)}
    </div>
  )
}

/* ================= בנק הרכיבים =================
   מצב שלישי בהוספת רשומה, לצד "ידני" ו"תמונה".
   בוחרים רכיבים וכמויות, והסכום הוא חשבון פשוט — אפס קריאות API.
   התוצאה עוברת לאותו מסך סקירה של שאר המצבים, כך שבדיקת התוכנית
   והעריכה הידנית זהות. */
export function ComposePanel({
  components, picks, setPicks, t, busy,
  onSeed, onAddComponent, onDeleteComponent, onContinue,
}) {
  const L = t.locale()
  const [managing, setManaging] = useState(false)
  const [adding, setAdding] = useState(false)

  const qtyOf = (id) => picks.find((p) => p.component.id === id)?.qty || 0

  /* הבחירות נשמרות ממוינות לפי סדר הבנק, כדי שהתיאור שנבנה
     יהיה יציב ולא יושפע מסדר ההקלקות. */
  const put = (prev, component, qty) => {
    const rest = prev.filter((p) => p.component.id !== component.id)
    const next = qty > 0 ? [...rest, { component, qty }] : rest
    return next.sort((a, b) =>
      (a.component.sort_order - b.component.sort_order) ||
      a.component.name.localeCompare(b.component.name))
  }

  const setQty = (component, qty) => setPicks((prev) => put(prev, component, qty))

  /* חייב להיות עדכון פונקציונלי: שתי לחיצות רצופות על + קוראות
     אחרת את אותו state ישן, והשנייה פשוט כותבת שוב 1.
     צעד של 1, כי רוב השימוש הוא במספרים שלמים; כמויות חלקיות
     כמו 0.7 כוס חלב מוקלדות ישירות בשדה. */
  const bump = (component, delta) => setPicks((prev) => {
    const cur = prev.find((p) => p.component.id === component.id)?.qty || 0
    return put(prev, component, Math.max(0, Math.round((cur + delta) * 10) / 10))
  })

  const totals = composeTotals(picks)
  const chosen = picks.length > 0

  if (!components.length) {
    return (
      <div>
        <div className="empty-state">{t.tr('noComponents')}</div>
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={onSeed}>{t.tr('addBaseSet')}</button>
          <button className="btn secondary" onClick={() => setAdding(true)}>{t.tr('newComponent')}</button>
        </div>
        {adding && <ComponentForm t={t} busy={busy}
          onCancel={() => setAdding(false)}
          onSave={async (c) => { await onAddComponent(c); setAdding(false) }} />}
      </div>
    )
  }

  return (
    <div>
      <div className="comp-list">
        {components.map((c) => {
          const q = qtyOf(c.id)
          return (
            <div className={'comp-row' + (q > 0 ? ' on' : '')} key={c.id}>
              <div className="comp-meta">
                <div className="comp-name">
                  {c.name}{c.unit && <span className="comp-unit">{c.unit}</span>}
                </div>
                <div className="comp-sub">
                  {fmt(c.calories, L)} {t.tr('kcal')} · {t.tr('abbrProtein')} {c.protein_g}{t.tr('gUnit')}
                </div>
              </div>
              {managing ? (
                <button className="act del" title={t.tr('editComponent')}
                  onClick={() => onDeleteComponent(c)}>×</button>
              ) : (
                <div className="comp-qty">
                  <button onClick={() => bump(c, -1)} disabled={q <= 0} aria-label="-">−</button>
                  <input type="number" step="0.1" min="0" value={q || ''} placeholder="0"
                    className={q > 0 ? 'on' : ''}
                    onChange={(e) => setQty(c, Math.max(0, Number(e.target.value) || 0))} />
                  <button onClick={() => bump(c, 1)} aria-label="+">+</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="btn-row">
        <button className="btn secondary small" onClick={() => setAdding(true)}>+ {t.tr('newComponent')}</button>
        <button className="btn secondary small" onClick={() => setManaging((m) => !m)}>
          {managing ? t.tr('cancel') : t.tr('manageComponents')}
        </button>
      </div>

      {adding && <ComponentForm t={t} busy={busy}
        onCancel={() => setAdding(false)}
        onSave={async (c) => { await onAddComponent(c); setAdding(false) }} />}

      {chosen ? (
        <div className="compose-total">
          <div className="compose-desc">{composeDescription(picks)}</div>
          <div className="compose-nums">
            <strong>{fmt(totals.calories, L)}</strong> {t.tr('kcal')} ·{' '}
            {t.tr('abbrProtein')} {totals.protein_g}{t.tr('gUnit')} ·{' '}
            {t.tr('abbrCarbs')} {totals.carbs_g}{t.tr('gUnit')} ·{' '}
            {t.tr('abbrFat')} {totals.fat_g}{t.tr('gUnit')}
          </div>
          <div className="btn-row">
            <button className="btn" onClick={onContinue}>{t.tr('composeContinue')}</button>
            <button className="btn secondary" onClick={() => setPicks([])}>{t.tr('cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="estimate-note">{t.tr('composeEmpty')}</div>
      )}
    </div>
  )
}

/* טופס רכיב חדש. אפשר להזין ערכים ידנית, או לתת ל-AI להעריך
   פעם אחת — וזו הנקודה: ההערכה קורית פעם אחת בחיי הרכיב. */
function ComponentForm({ t, busy, onCancel, onSave }) {
  const [f, setF] = useState({
    name: '', unit: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', sodium_mg: '',
  })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const num = (v) => Number(v) || 0

  return (
    <div className="review">
      <label className="field-label">{t.tr('componentName')}</label>
      <input type="text" value={f.name} placeholder={t.tr('componentDescPlaceholder')}
        onChange={(e) => set('name', e.target.value)} />

      <label className="field-label">{t.tr('componentUnit')}</label>
      <input type="text" value={f.unit} placeholder={t.tr('unitPlaceholder')}
        onChange={(e) => set('unit', e.target.value)} />

      <div className="review-grid" style={{ marginTop: 10 }}>
        {[['calories', 'calories', null], ['protein_g', 'protein', 'gUnit'],
          ['carbs_g', 'carbs', 'gUnit'], ['fat_g', 'fat', 'gUnit'],
          ['fiber_g', 'fiber', 'gUnit'], ['sodium_mg', 'sodium', 'mgUnit']].map(([key, labK, unitK]) => (
          <div className="f" key={key}>
            <label>{t.tr(labK)}{unitK ? ` (${t.tr(unitK)})` : ''}</label>
            <input type="number" value={f[key]} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="estimate-note">{t.tr('perUnitNote')}</div>

      <div className="btn-row">
        <button className="btn" disabled={busy || !f.name.trim()}
          onClick={() => onSave({
            name: f.name.trim(), unit: f.unit.trim(),
            calories: num(f.calories), protein_g: num(f.protein_g), carbs_g: num(f.carbs_g),
            fat_g: num(f.fat_g), fiber_g: num(f.fiber_g), sodium_mg: num(f.sodium_mg),
          })}>{t.tr('saveToBank')}</button>
        <button className="btn secondary" onClick={onCancel}>{t.tr('cancel')}</button>
      </div>
    </div>
  )
}

/* ================= טאב השבוע ================= */
export function WeekTab({ weekDays, timingBuckets, settings, plan, currentDate, t }) {
  const L = t.locale()
  const logged = weekDays.filter((d) => d.entries.length)

  if (!logged.length) {
    return <div className="card"><div className="empty-state">{t.tr('weekEmpty')}</div></div>
  }

  const avgCal = logged.reduce((a, d) => a + d.totals.calories, 0) / logged.length
  const avgProt = logged.reduce((a, d) => a + d.totals.protein_g, 0) / logged.length
  const protTarget = Number(settings.protein) || plan.proteinDaily
  const protHit = logged.filter((d) => d.totals.protein_g >= protTarget).length
  const splurge = splurgeCount(weekDays, plan)

  const calTarget = Number(settings.calories) || 0
  const max = Math.max(1, ...weekDays.map((d) => d.totals.calories), calTarget)

  let timing = null
  if (timingBuckets) {
    const b = timingBuckets.buckets
    const dcount = timingBuckets.days
    const mx = Math.max(1, ...b)
    const total = b.reduce((a, x) => a + x, 0)
    const late = b.slice(plan.lateHour).reduce((a, x) => a + x, 0)
    const latePct = total ? Math.round((late / total) * 100) : 0
    timing = (
      <>
        <div className="section-title">{t.tr('mealTiming')}</div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 15 }}>
            {latePct}% <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t.tr('lateShare')} {plan.lateHour}:00</span>
          </div>
          <div className="timing-chart">
            {b.map((v, h) => (
              <div className="timing-col" key={h}>
                <div className={'timing-bar' + (h >= plan.lateHour ? ' late' : '')}
                  style={{ height: Math.max(1, (v / mx) * 100) + '%' }}
                  title={`${h}:00 — ${fmt(v / dcount, L)}`} />
              </div>
            ))}
          </div>
          <div className="timing-axis">{b.map((v, h) => <div key={h}>{h % 6 === 0 ? h : ''}</div>)}</div>
          <div className="estimate-note">{t.tr('timingNote')}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-title">{t.tr('weekOf')} {displayDate(currentDate, L)}</div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">{t.tr('avgCalories')}</div>
          <div className="val">{fmt(avgCal, L)}</div>
          <div className="sub">{logged.length} {t.tr('daysLogged')}</div>
        </div>
        <div className="stat">
          <div className="lab">{t.tr('avgProtein')}</div>
          <div className={'val ' + (avgProt >= protTarget ? 'good' : 'bad')}>{fmt(avgProt, L)}{t.tr('gUnit')}</div>
          <div className="sub">{t.tr('of')} {protTarget}{t.tr('gUnit')}</div>
        </div>
        <div className="stat">
          <div className="lab">{t.tr('proteinDaysHit')}</div>
          <div className={'val ' + (protHit >= logged.length * 0.7 ? 'good' : 'bad')}>{protHit}</div>
          <div className="sub">{t.tr('ofDays')} {logged.length}</div>
        </div>
        <div className="stat">
          <div className="lab">{t.tr('carbDaysUsed')}</div>
          <div className={'val ' + (splurge <= plan.splurgeDaysAllowed ? 'good' : 'bad')}>{splurge}</div>
          <div className="sub">{plan.splurgeDaysAllowed} {t.tr('allowed')} · 80/20</div>
        </div>
      </div>

      <div className="section-title">{t.tr('last7days')}</div>
      <div className="card">
        <div className="week-chart">
          {calTarget > 0 && <div className="target-line" style={{ bottom: Math.min(100, (calTarget / max) * 100) + '%' }} />}
          {weekDays.map((d) => (
            <div className="week-bar-col" key={d.iso}>
              <div className={'week-bar' + (d.totals.carbs_g > plan.carbSplurgeDay ? ' splurge' : '')}
                style={{ height: Math.max(2, (d.totals.calories / max) * 100) + '%' }} title={d.iso} />
              <div className="week-bar-label">
                {new Date(d.iso + 'T00:00:00').toLocaleDateString(L, { weekday: 'narrow' })}
              </div>
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="swatch" style={{ background: 'var(--accent)', height: 8, width: 8, borderRadius: 2 }} />{t.tr('logForDay')}</span>
          <span><i className="swatch" style={{ background: 'var(--gold)', height: 8, width: 8, borderRadius: 2 }} />{t.tr('carbDaysUsed')}</span>
        </div>
      </div>

      {timing}
    </>
  )
}

/* ================= טאב המשקל ================= */
export function WeightTab({ weights, plan, t, onAdd, onDelete }) {
  const L = t.locale()
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [kg, setKg] = useState('')

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const series = computeTrend(sorted)
  const rate = trendRate(series)
  const last = series.length ? series[series.length - 1] : null

  const submit = async () => {
    await onAdd(date, Number(kg))
    setKg('')
  }

  /* גרף המגמה — SVG זהה למקור (שורות 774–791) */
  let chart = <div className="empty-state">{t.tr('needTwoWeighins')}</div>
  if (series.length >= 2) {
    const w = 560, h = 150, pad = 22
    const vals = series.map((s) => s.kg).concat(series.map((s) => s.trend))
    const mn = Math.min(...vals), mx = Math.max(...vals)
    const rg = (mx - mn) || 1
    const t0 = new Date(series[0].date + 'T00:00:00').getTime()
    const t1 = new Date(series[series.length - 1].date + 'T00:00:00').getTime()
    const span = (t1 - t0) || 1
    const X = (d) => pad + ((new Date(d + 'T00:00:00').getTime() - t0) / span) * (w - pad * 2)
    const Y = (v) => pad + (1 - (v - mn) / rg) * (h - pad * 2)
    chart = (
      <>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 150 }}>
          <polyline points={series.map((s) => `${X(s.date)},${Y(s.kg)}`).join(' ')}
            fill="none" stroke="#C7C2AF" strokeWidth="1.5" strokeDasharray="3 3" />
          <polyline points={series.map((s) => `${X(s.date)},${Y(s.trend)}`).join(' ')}
            fill="none" stroke="#2F6F62" strokeWidth="2.5" />
          {series.map((s) => <circle key={s.date} cx={X(s.date)} cy={Y(s.kg)} r="2.5" fill="#C7C2AF" />)}
        </svg>
        <div className="legend">
          <span><i className="swatch" style={{ background: '#C7C2AF' }} />{t.tr('rawWeight')}</span>
          <span><i className="swatch" style={{ background: '#2F6F62', height: 3 }} />{t.tr('trendWeight')}</span>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-title">{t.tr('logYourWeight')}</div>
      <div className="card">
        <div className="weight-form">
          <div className="f">
            <label className="field-label">{t.tr('date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="f">
            <label className="field-label">{t.tr('weightKg')}</label>
            <input type="number" step="0.1" value={kg} placeholder={t.tr('weightPlaceholder')}
              onChange={(e) => setKg(e.target.value)} />
          </div>
          <button className="btn" onClick={submit}>{t.tr('save')}</button>
        </div>
        <div className="estimate-note">{t.tr('weighNote')}</div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">{t.tr('currentTrend')}</div>
          <div className="val">{last ? `${fmt1(last.trend)} ${t.tr('kgUnit')}` : '—'}</div>
          <div className="sub">{last ? `${t.tr('rawWeight')} ${fmt1(last.kg)}` : ''}</div>
        </div>
        <div className="stat">
          <div className="lab">{t.tr('weeklyRate')}</div>
          <div className={'val ' + (rate == null ? '' : rate <= -0.2 ? 'good' : rate > 0.1 ? 'bad' : '')}>
            {rate == null ? '—' : `${rate > 0 ? '+' : ''}${fmt1(rate)} ${t.tr('kgUnit')}`}
          </div>
          <div className="sub">
            {rate == null ? t.tr('notEnoughData')
              : `${t.tr('vsTarget')} −${plan.weeklyLossTarget} ${t.tr('kgUnit')}${t.tr('perWeek')}`}
          </div>
        </div>
      </div>

      <div className="section-title">{t.tr('trend')}</div>
      <div className="card">{chart}</div>

      <div className="section-title">{t.tr('history')}</div>
      <div className="card">
        {sorted.length ? [...sorted].reverse().map((w) => (
          <div className="weight-row" key={w.date}>
            <span>{new Date(w.date + 'T00:00:00').toLocaleDateString(L, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>
              {w.kg} {t.tr('kgUnit')}{' '}
              <button className="del" onClick={() => onDelete(w.date)}>×</button>
            </span>
          </div>
        )) : <div className="empty-state">{t.tr('noWeighins')}</div>}
      </div>
    </>
  )
}

/* ================= מודל ההגדרות ================= */
const TARGET_FIELDS = [
  ['calories', 'calories', null], ['protein', 'protein', 'gUnit'], ['carbs', 'carbs', 'gUnit'],
  ['fat', 'fat', 'gUnit'], ['fiber', 'fiber', 'gUnit'], ['sodium', 'sodium', 'mgUnit'],
]
const PLAN_FIELDS = [
  ['proteinDaily', 'proteinDaily'], ['proteinPerMeal', 'proteinPerMeal'],
  ['carbEntryFlag', 'carbEntryFlag'], ['carbSplurgeDay', 'carbSplurgeDay'],
  ['splurgeDaysAllowed', 'splurgeDaysAllowed'], ['weeklyLossTarget', 'weeklyLossTarget'],
  ['lateHour', 'lateHour'], ['calorieCeiling', 'calorieCeiling'],
]

export function SettingsModal({ open, settings, plan, lang, displayFont, t, onClose, onSave, onFont, onClear }) {
  const [s, setS] = useState(settings)
  const [p, setP] = useState(plan)
  const [notes, setNotes] = useState('')

  // איפוס הטופס בכל פתיחה, כדי שביטול לא ישאיר ערכים תלויים
  useEffect(() => {
    if (!open) return
    setS(settings)
    setP(plan)
    setNotes(lang === 'he' ? plan.notes_he : plan.notes_en)
  }, [open, settings, plan, lang])

  if (!open) return null

  const save = () => {
    const nextPlan = { ...p }
    for (const [key] of PLAN_FIELDS) {
      nextPlan[key] = key === 'weeklyLossTarget'
        ? (Number(p[key]) || 0.5)
        : (Number(p[key]) || 0)
    }
    if (lang === 'he') nextPlan.notes_he = notes
    else nextPlan.notes_en = notes
    onSave(s, nextPlan)
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{t.tr('dailyTargets')}</h2>
        <div className="sub">{t.tr('targetsSub')}</div>

        <div className="settings-grid">
          {TARGET_FIELDS.map(([key, labK, unitK]) => (
            <div key={key}>
              <label className="field-label">{t.tr(labK)}{unitK ? ` (${t.tr(unitK)})` : ''}</label>
              <input type="number" value={s[key] ?? ''}
                onChange={(e) => setS((prev) => ({ ...prev, [key]: e.target.value }))} />
            </div>
          ))}
        </div>

        <h3>{t.tr('planRules')}</h3>
        <div className="sub">{t.tr('planSub')}</div>

        <div className="settings-grid">
          {PLAN_FIELDS.map(([key, labK]) => (
            <div key={key}>
              <label className="field-label">{t.tr(labK)}</label>
              <input type="number" {...(key === 'weeklyLossTarget' ? { step: '0.1' } : {})}
                value={p[key] ?? ''}
                onChange={(e) => setP((prev) => ({ ...prev, [key]: e.target.value }))} />
            </div>
          ))}
        </div>

        <label className="field-label">{t.tr('planNotes')}</label>
        <textarea style={{ minHeight: 150, fontSize: 13, lineHeight: 1.5 }}
          value={notes} onChange={(e) => setNotes(e.target.value)} />

        <h3>{t.tr('titleFont')}</h3>
        <div className="font-picker">
          {Object.keys(FONTS).map((k) => (
            <button key={k} className={'font-opt' + (displayFont === k ? ' active' : '')}
              style={{ fontFamily: FONTS[k].stack }} onClick={() => onFont(k)}>
              <span className="fname">{FONTS[k].label}</span>
              <span className="fsample">{t.tr('appTitle')}</span>
            </button>
          ))}
        </div>

        <div className="modal-close-row">
          <button className="danger-link" onClick={onClear}>{t.tr('clearAllData')}</button>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className="btn secondary" onClick={onClose}>{t.tr('cancel')}</button>
            <button className="btn" onClick={save}>{t.tr('save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
