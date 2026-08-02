// ============================================================
// Food Log — הטאב
//
// שכבת התצוגה של files/food-tracker.html, מומרת ל-React.
// כל הלוגיקה (checkEntry, dayTotals, EWMA, i18n, הפרומפט)
// יושבת ב-foodLogCore.js ולא שוכתבה — הקובץ הזה רק מציג
// ומחווט אירועים.
//
// שתי הגבלות חשובות מול המקור, ששתיהן במכוון:
//   dir  — נקבע על ה-container ולא על documentElement, כדי
//          שבורר השפה לא יהפוך את כל האפליקציה ל-LTR.
//   font — --font-display נקבע כ-inline style על ה-container,
//          מאותה סיבה.
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import * as store from '../lib/foodLogStore'
import { estimateNutrition } from '../lib/foodLogApi'
import {
  makeT, MEALS, FONTS, DEFAULT_FONT, defaultSettings, defaultPlan,
  isoDate, displayDate, shiftDate, nowTime, dayTotals, checkEntry,
  splurgeCount, fmt, fileToBase64,
} from '../lib/foodLogCore'
import { WeekTab, WeightTab, SettingsModal, Flags } from './foodLogPanels'
import './foodlog.css'

const PORTION_SCALES = [0.5, 0.75, 1, 1.5, 2]
const MACROS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg']

function scaleFields(base, s) {
  const out = {}
  for (const k of MACROS) out[k] = Math.round((Number(base[k]) || 0) * s)
  return out
}

/* אריח יעד יומי — vitalTile במקור (שורות 580–589) */
function Vital({ labK, unitK, val, target, t }) {
  const tv = Number(target)
  const has = target !== '' && target != null && !isNaN(tv) && tv > 0
  const over = has && val > tv
  const pct = has ? Math.min(100, (val / tv) * 100) : 0
  return (
    <div className={'vital' + (over ? ' over' : '')}>
      <div className="label">{t.tr(labK)}</div>
      <div className="value">
        {fmt(val, t.locale())}
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}> {t.tr(unitK)}</span>
      </div>
      <div className="target">{has ? `${t.tr('of')} ${fmt(tv, t.locale())}` : t.tr('noTargetSet')}</div>
      {has && <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>}
    </div>
  )
}

export default function FoodLog() {
  const { user } = useApp()
  const userId = user?.id

  // ---- config ----
  const [lang, setLang] = useState('en')
  const [displayFont, setDisplayFont] = useState(DEFAULT_FONT)
  const [settings, setSettings] = useState(defaultSettings)
  const [plan, setPlan] = useState(defaultPlan)
  const [ready, setReady] = useState(false)

  // ---- navigation ----
  const [currentDate, setCurrentDate] = useState(() => isoDate(new Date()))
  const [activeTab, setActiveTab] = useState('log')
  const [logMode, setLogMode] = useState('manual')

  // ---- data ----
  const [dayEntries, setDayEntries] = useState([])
  const [weekDays, setWeekDays] = useState([])
  const [timingBuckets, setTimingBuckets] = useState(null)
  const [weights, setWeights] = useState([])
  const [favourites, setFavourites] = useState([])

  // ---- ui ----
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState('')

  // ---- add-entry form ----
  const [form, setForm] = useState(() => ({ meal: 'breakfast', time: nowTime(), desc: '', note: '' }))
  const [photo, setPhoto] = useState(null) // { base64, mediaType }
  const [reviewBase, setReviewBase] = useState(null)
  const [reviewScale, setReviewScale] = useState(1)
  const [reviewFields, setReviewFields] = useState(null)

  const fileRef = useRef(null)
  const toastTimer = useRef(null)
  const t = useMemo(() => makeT(lang), [lang])
  const today = isoDate(new Date())

  const showToast = useCallback((m) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const fail = useCallback((e) => setError(e?.message || String(e)), [])

  /* ---- טעינה ראשונית: config + מועדפים + משקלים ---- */
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await store.loadConfig(userId)
        if (cancelled) return
        setLang(cfg.lang)
        setDisplayFont(cfg.displayFont)
        setSettings(cfg.settings)
        setPlan(cfg.plan)
        const [favs, ws] = await Promise.all([
          store.loadFavourites(userId),
          store.loadWeights(userId),
        ])
        if (cancelled) return
        setFavourites(favs)
        setWeights(ws)
      } catch (e) {
        if (!cancelled) fail(e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [userId, fail])

  /* ---- 14 יום בשאילתה אחת ----
     במקור loadDay + loadWeek + loadTiming היו 22 קריאות נפרדות
     (שורות 457, 467–475, 477–490). אותו חישוב בדיוק, שאילתה אחת. */
  const reloadDays = useCallback(async () => {
    if (!userId) return
    try {
      const byDate = await store.loadRange(userId, shiftDate(currentDate, -13), currentDate)
      const at = (iso) => byDate[iso] || []

      setDayEntries(at(currentDate))

      const days = []
      for (let i = 6; i >= 0; i--) {
        const iso = shiftDate(currentDate, -i)
        const entries = at(iso)
        days.push({ iso, entries, totals: dayTotals(entries) })
      }
      setWeekDays(days)

      const buckets = new Array(24).fill(0)
      let daysWithData = 0
      for (let i = 13; i >= 0; i--) {
        const entries = at(shiftDate(currentDate, -i))
        if (entries.length) daysWithData++
        entries.forEach((e) => {
          if (!e.time) return
          const h = parseInt(e.time.split(':')[0], 10)
          if (!isNaN(h) && h >= 0 && h < 24) buckets[h] += Number(e.calories) || 0
        })
      }
      setTimingBuckets({ buckets, days: Math.max(1, daysWithData) })
    } catch (e) {
      fail(e)
    }
  }, [userId, currentDate, fail])

  useEffect(() => { reloadDays() }, [reloadDays])

  /* ================= handlers ================= */

  const resetInput = useCallback(() => {
    setReviewBase(null); setReviewScale(1); setReviewFields(null)
    setError(null); setPhoto(null)
  }, [])

  const goDate = (delta) => { resetInput(); setCurrentDate((d) => shiftDate(d, delta)) }
  const goToday = () => { resetInput(); setCurrentDate(today) }

  const changeLang = async (l) => {
    if (l === lang) return
    setLang(l)
    try { await store.saveLang(userId, l) } catch (e) { fail(e) }
  }

  const changeFont = async (key) => {
    if (!FONTS[key]) return
    setDisplayFont(key)
    try { await store.saveConfig(userId, { settings, plan, displayFont: key }) } catch (e) { fail(e) }
  }

  const openReview = (base) => {
    setReviewBase(base); setReviewScale(1); setReviewFields(scaleFields(base, 1))
  }
  const changeScale = (s) => {
    setReviewScale(s)
    setReviewFields(scaleFields(reviewBase, s))
  }

  const runEstimate = async (payload) => {
    setLoading(true); setError(null)
    try {
      return await estimateNutrition(payload, lang, t)
    } catch (e) {
      setError(e?.message || t.tr('couldNotEstimate'))
      return null
    } finally {
      setLoading(false)
    }
  }

  const estimateManual = async () => {
    const desc = form.desc.trim()
    if (!desc) { setError(t.tr('describeFirst')); return }
    const r = await runEstimate({ description: desc, meal: form.meal })
    if (r) openReview({ ...r, meal: form.meal, time: form.time || nowTime(), description: desc, source: 'manual' })
  }

  const estimatePhoto = async () => {
    if (!photo) return
    const r = await runEstimate({
      meal: form.meal, imageBase64: photo.base64,
      imageMediaType: photo.mediaType, note: form.note.trim(),
    })
    if (!r) return
    const items = (r.items || []).map((i) => i.name).join(', ')
    openReview({
      ...r, meal: form.meal, time: form.time || nowTime(),
      description: items || t.tr('photoOfPlate'), source: 'photo',
    })
  }

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      setPhoto({ mediaType: f.type, base64: await fileToBase64(f) })
    } catch (err) { fail(err) }
  }

  const confirmAdd = async () => {
    const r = reviewBase
    try {
      await store.addEntry(userId, currentDate, {
        time: r.time || nowTime(), meal: r.meal, description: r.description,
        source: r.source, confidence: r.confidence, ...reviewFields,
      })
      await reloadDays()
      resetInput()
      setForm((f) => ({ ...f, desc: '', note: '' }))
      if (fileRef.current) fileRef.current.value = ''
      showToast(t.tr('addedToLog'))
    } catch (e) { fail(e) }
  }

  const removeEntry = async (id) => {
    try { await store.deleteEntry(userId, id); await reloadDays() } catch (e) { fail(e) }
  }

  const starEntry = async (entry) => {
    try {
      const { favourites: favs } = await store.addFavourite(userId, entry)
      setFavourites(favs)
      showToast(t.tr('favSaved'))
    } catch (e) { fail(e) }
  }

  const unstarFav = async (id) => {
    try {
      await store.removeFavourite(userId, id)
      setFavourites((fs) => fs.filter((f) => f.id !== id))
    } catch (e) { fail(e) }
  }

  const logFav = async (f) => {
    try {
      await store.addEntry(userId, currentDate, {
        time: nowTime(), meal: f.meal, description: f.description, source: 'favourite',
        calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g,
        fat_g: f.fat_g, fiber_g: f.fiber_g, sodium_mg: f.sodium_mg,
      })
      await reloadDays()
      showToast(t.tr('addedToLog'))
    } catch (e) { fail(e) }
  }

  const addWeight = async (dateIso, kg) => {
    if (!dateIso || !kg) { showToast(t.tr('enterDateWeight')); return }
    try {
      await store.addWeight(userId, dateIso, kg)
      setWeights(await store.loadWeights(userId))
      showToast(t.tr('weightSaved'))
    } catch (e) { fail(e) }
  }

  const removeWeight = async (dateIso) => {
    try {
      await store.deleteWeight(userId, dateIso)
      setWeights((ws) => ws.filter((w) => w.date !== dateIso))
    } catch (e) { fail(e) }
  }

  const saveSettings = async (nextSettings, nextPlan) => {
    setSettings(nextSettings); setPlan(nextPlan)
    try {
      await store.saveConfig(userId, { settings: nextSettings, plan: nextPlan, displayFont })
      setSettingsOpen(false)
      showToast(t.tr('settingsSaved'))
    } catch (e) { fail(e) }
  }

  const clearAll = async () => {
    if (!window.confirm(t.tr('confirmClearData'))) return
    try {
      await store.clearAllData(userId)
      setSettings({ ...defaultSettings }); setPlan({ ...defaultPlan })
      setWeights([]); setFavourites([]); setSettingsOpen(false)
      await reloadDays()
      showToast(t.tr('allDataCleared'))
    } catch (e) { fail(e) }
  }

  /* ================= derived ================= */
  const totals = useMemo(() => dayTotals(dayEntries), [dayEntries])

  /* דגלי התוכנית לרשומה שבסקירה.
     שינוי מכוון מול המקור: שם ה-preview נבנה מ-base×scale בלבד,
     כך שעריכה ידנית של המספרים לא עדכנה את הדגלים עד שינוי מנה.
     כאן הם מחושבים מהערכים שבשדות בפועל. checkEntry עצמו לא נגע. */
  const reviewFlags = useMemo(() => {
    if (!reviewBase || !reviewFields) return []
    const preview = { meal: reviewBase.meal, time: reviewBase.time, ...reviewFields }
    const withPreview = dayEntries.concat([preview])
    const thr = plan.carbSplurgeDay
    const wasSplurge = totals.carbs_g > thr
    const nowSplurge = dayTotals(withPreview).carbs_g > thr
    const splurgeDays = splurgeCount(weekDays, plan) + ((!wasSplurge && nowSplurge) ? 1 : 0)
    return checkEntry(preview, withPreview, splurgeDays, plan, t)
  }, [reviewBase, reviewFields, dayEntries, weekDays, plan, totals, t])

  if (!ready) {
    return <div className="foodlog"><div className="empty-state">…</div></div>
  }

  const dir = lang === 'he' ? 'rtl' : 'ltr'
  const fontStack = (FONTS[displayFont] || FONTS[DEFAULT_FONT]).stack
  const L = t.locale()

  /* ---- banner: הקו האדום הקלורי ---- */
  let banner = null
  if (plan.calorieCeiling > 0 && dayEntries.length) {
    const diff = totals.calories - plan.calorieCeiling
    if (diff > 0) {
      banner = (
        <div className="ceiling-banner over">
          <span className="big">{fmt(totals.calories, L)}</span>
          <span>{t.trf('ceilingOver', { c: plan.calorieCeiling, n: fmt(totals.calories, L), over: fmt(diff, L) })}</span>
        </div>
      )
    } else if (diff > -250) {
      banner = (
        <div className="ceiling-banner near">
          <span className="big">{fmt(-diff, L)}</span>
          <span>{t.trf('ceilingNear', { n: fmt(totals.calories, L), left: fmt(-diff, L), c: plan.calorieCeiling })}</span>
        </div>
      )
    }
  }

  const calTarget = Number(settings.calories) || 0
  const ceil = plan.calorieCeiling || 0
  const chartMax = Math.max(1, ...weekDays.map((d) => d.totals.calories), calTarget, ceil)

  const mealOptions = MEALS.map((m) => <option key={m} value={m}>{t.mealLabel(m)}</option>)

  return (
    <div className="foodlog" dir={dir} style={{ '--font-display': fontStack }}>
      <div className="masthead">
        <h1>{t.tr('appTitle')}</h1>
        <div className="right-controls">
          <div className="lang-toggle">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
            <button className={lang === 'he' ? 'active' : ''} onClick={() => changeLang('he')}>עב</button>
          </div>
          <button className="gear" onClick={() => setSettingsOpen(true)} aria-label={t.tr('dailyTargets')}>⚙</button>
        </div>
      </div>

      <div className="date-nav">
        <button onClick={() => goDate(-1)} aria-label="prev">‹</button>
        <span className="date-label">{displayDate(currentDate, L)}</span>
        <button onClick={() => goDate(1)} aria-label="next">›</button>
        {currentDate !== today && <button className="today-link" onClick={goToday}>{t.tr('today')}</button>}
      </div>

      <div className="tabs">
        {[['log', 'tabLog'], ['week', 'tabWeek'], ['weight', 'tabWeight']].map(([id, k]) => (
          <button key={id} className={'tab' + (activeTab === id ? ' active' : '')} onClick={() => setActiveTab(id)}>
            {t.tr(k)}
          </button>
        ))}
      </div>

      {activeTab === 'log' && (
        <>
          {banner}

          <div className="vitals">
            <Vital labK="calories" unitK="kcal" val={totals.calories} target={settings.calories} t={t} />
            <Vital labK="protein" unitK="gUnit" val={totals.protein_g} target={settings.protein || plan.proteinDaily} t={t} />
            <Vital labK="carbs" unitK="gUnit" val={totals.carbs_g} target={settings.carbs} t={t} />
            <Vital labK="fat" unitK="gUnit" val={totals.fat_g} target={settings.fat} t={t} />
            <Vital labK="fiber" unitK="gUnit" val={totals.fiber_g} target={settings.fiber} t={t} />
            <Vital labK="sodium" unitK="mgUnit" val={totals.sodium_mg} target={settings.sodium} t={t} />
          </div>

          <div className="section-title">{t.tr('favourites')}</div>
          <div className="card">
            {favourites.length ? (
              <div className="fav-strip">
                {favourites.map((f) => (
                  <span key={f.id} className="fav-chip" onClick={() => logFav(f)}>
                    {f.description.slice(0, 28)}
                    <span className="kc">{fmt(f.calories, L)}</span>
                    <span className="x" onClick={(ev) => { ev.stopPropagation(); unstarFav(f.id) }}>×</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '8px 0' }}>{t.tr('noFavs')}</div>
            )}
          </div>

          <div className="section-title">{t.tr('addEntry')}</div>
          <div className="card">
            <div className="mode-toggle">
              <button className={'mode-btn' + (logMode === 'manual' ? ' active' : '')}
                onClick={() => { setLogMode('manual'); resetInput() }}>{t.tr('manual')}</button>
              <button className={'mode-btn' + (logMode === 'photo' ? ' active' : '')}
                onClick={() => { setLogMode('photo'); resetInput() }}>{t.tr('photo')}</button>
            </div>

            <label className="field-label">{t.tr('meal')}</label>
            <select value={form.meal} onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value }))}>
              {mealOptions}
            </select>

            <label className="field-label">{t.tr('time')}</label>
            <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />

            {logMode === 'manual' ? (
              <>
                <label className="field-label">{t.tr('whatDidYouEat')}</label>
                <textarea value={form.desc} placeholder={t.tr('descPlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} />
                <div className="btn-row">
                  <button className="btn" disabled={loading} onClick={estimateManual}>
                    {loading ? t.tr('estimating') : t.tr('estimate')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="field-label">{t.tr('photoOfPlate')}</label>
                <div className="photo-drop" onClick={() => fileRef.current?.click()}>
                  {photo
                    ? <img src={`data:${photo.mediaType};base64,${photo.base64}`} alt="" />
                    : t.tr('tapToChoosePhoto')}
                </div>
                <div className="anchor-hint">{t.tr('anchorHint')}</div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickPhoto} />
                <label className="field-label">{t.tr('optionalNote')}</label>
                <input type="text" value={form.note} placeholder={t.tr('notePlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                <div className="btn-row">
                  <button className="btn" disabled={loading || !photo} onClick={estimatePhoto}>
                    {loading ? t.tr('estimating') : t.tr('estimateFromPhoto')}
                  </button>
                </div>
              </>
            )}

            {error && <div className="error-msg">{error}</div>}
            <div className="estimate-note">{t.tr('estimateDisclaimer')}</div>

            {reviewBase && reviewFields && (
              <div className="review">
                <div className="items-list">
                  <strong>{t.tr('identified')}</strong>{' '}
                  {(reviewBase.items || []).map((i) => i.name + (i.portion ? ` (${i.portion})` : '')).join(', ') || '—'}
                </div>

                <div className="portion-row">
                  <span className="plabel">{t.tr('portionLabel')}</span>
                  {PORTION_SCALES.map((s) => (
                    <button key={s} className={'portion-btn' + (reviewScale === s ? ' active' : '')}
                      onClick={() => changeScale(s)}>×{s}</button>
                  ))}
                </div>

                <div className="review-grid">
                  {[['calories', 'calories', null], ['protein_g', 'protein', 'gUnit'],
                    ['carbs_g', 'carbs', 'gUnit'], ['fat_g', 'fat', 'gUnit'],
                    ['fiber_g', 'fiber', 'gUnit'], ['sodium_mg', 'sodium', 'mgUnit']].map(([key, labK, unitK]) => (
                    <div className="f" key={key}>
                      <label>{t.tr(labK)}{unitK ? ` (${t.tr(unitK)})` : ''}</label>
                      <input type="number" value={reviewFields[key]}
                        onChange={(e) => setReviewFields((f) => ({ ...f, [key]: Number(e.target.value) || 0 }))} />
                    </div>
                  ))}
                </div>

                <span className={'confidence-tag' + (reviewBase.confidence === 'low' ? ' low' : '')}>
                  {reviewBase.confidence === 'low' ? t.tr('confLow')
                    : reviewBase.confidence === 'high' ? t.tr('confHigh') : t.tr('confMedium')}{' '}
                  {t.tr('confSuffix')}
                </span>

                <Flags flags={reviewFlags} />

                <div className="btn-row">
                  <button className="btn" onClick={confirmAdd}>{t.tr('addToLog')}</button>
                  <button className="btn secondary" onClick={resetInput}>{t.tr('discard')}</button>
                </div>
              </div>
            )}
          </div>

          <div className="section-title">{displayDate(currentDate, L)} — {t.tr('logForDay')}</div>
          <div className="card">
            {dayEntries.length ? dayEntries.map((e) => (
              <div className="entry" key={e.id}>
                <div className="meta">
                  <span className="meal-tag">{t.mealLabel(e.meal)}</span>
                  {e.time && <span className="time-tag">{e.time}</span>}
                  <div className="desc">{e.description}</div>
                  <div className="macros">
                    {t.tr('abbrProtein')} {fmt(e.protein_g, L)}{t.tr('gUnit')} · {t.tr('abbrCarbs')} {fmt(e.carbs_g, L)}{t.tr('gUnit')} · {t.tr('abbrFat')} {fmt(e.fat_g, L)}{t.tr('gUnit')} · {t.tr('abbrFiber')} {fmt(e.fiber_g, L)}{t.tr('gUnit')} · {t.tr('abbrSodium')} {fmt(e.sodium_mg, L)}{t.tr('mgUnit')}
                  </div>
                </div>
                <div className="cals">
                  {fmt(e.calories, L)}
                  <button className="act" title={t.tr('saveFav')} onClick={() => starEntry(e)}>☆</button>
                  <button className="act del" onClick={() => removeEntry(e.id)}>×</button>
                </div>
              </div>
            )) : <div className="empty-state">{t.tr('noEntries')}</div>}
          </div>

          <div className="section-title">{t.tr('last7days')}</div>
          <div className="card">
            <div className="week-chart">
              {ceil > 0 && <div className="ceiling-line" style={{ bottom: Math.min(100, (ceil / chartMax) * 100) + '%' }} />}
              {weekDays.map((d) => {
                const h = Math.max(2, (d.totals.calories / chartMax) * 100)
                const overCeil = ceil && d.totals.calories > ceil
                const splurge = d.totals.carbs_g > plan.carbSplurgeDay
                return (
                  <div className="week-bar-col" key={d.iso}>
                    <div className={'week-bar' + (overCeil ? ' ceilover' : splurge ? ' splurge' : '')}
                      style={{ height: h + '%' }} title={d.iso} />
                    <div className="week-bar-label">
                      {new Date(d.iso + 'T00:00:00').toLocaleDateString(L, { weekday: 'narrow' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === 'week' && (
        <WeekTab weekDays={weekDays} timingBuckets={timingBuckets} settings={settings}
          plan={plan} currentDate={currentDate} t={t} />
      )}

      {activeTab === 'weight' && (
        <WeightTab weights={weights} plan={plan} t={t} onAdd={addWeight} onDelete={removeWeight} />
      )}

      <SettingsModal open={settingsOpen} settings={settings} plan={plan} lang={lang}
        displayFont={displayFont} t={t}
        onClose={() => setSettingsOpen(false)} onSave={saveSettings}
        onFont={changeFont} onClear={clearAll} />

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  )
}
