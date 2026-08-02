// ============================================================
// Food Log — טאב השבוע, טאב המשקל, ומודל ההגדרות.
// המרה ל-React של renderWeekTab / renderWeightTab / renderSettings
// (food-tracker.html:711–844). החישובים עצמם מיובאים מ-foodLogCore.
// ============================================================

import { useState, useEffect } from 'react'
import {
  FONTS, computeTrend, trendRate, splurgeCount, fmt, fmt1, isoDate, displayDate,
} from '../lib/foodLogCore'

/* דגלי בדיקת התוכנית — flagsHtml במקור (שורות 591–594) */
export function Flags({ flags }) {
  if (!flags?.length) return null
  return (
    <div className="flags">
      {flags.map((f, i) => <div className={'flag ' + f.sev} key={i}>{f.text}</div>)}
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
