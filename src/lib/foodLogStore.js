// ============================================================
// Food Log — שכבת האחסון
//
// מחליפה את window.storage מ-food-tracker.html (שורות 337–547).
// כל שאילתה מסוננת לפי user_id של המשתמש המחובר; ה-RLS בסכמה
// אוכף את אותו כלל גם בצד השרת, כך שהסינון כאן הוא נוחות ולא הגנה.
//
// מיפוי המפתחות (לפי הערת המיפוי בסוף 02-supabase-schema.sql):
//   log:YYYY-MM-DD -> food_entries      weights -> weights
//   favourites     -> food_favourites   config  -> food_config.config
//   lang           -> food_config.lang
// ============================================================

import { supabase } from './supabase'
import { defaultSettings, defaultPlan, DEFAULT_FONT, FONTS } from './foodLogCore'

/* ---------- מיפוי שורה <-> הצורה שהאפליקציה מכירה ----------
   ההבדל היחיד בשמות הוא entry_time <-> time.
   ה-Number() חיוני: PostgREST מחזיר numeric כמחרוזת בחלק
   מהמקרים, ו-checkEntry משווה עם > ישירות. */
const num = (v) => Number(v) || 0

function rowToEntry(r) {
  return {
    id: r.id,
    time: r.entry_time || '',
    meal: r.meal,
    description: r.description,
    source: r.source || undefined,
    confidence: r.confidence || undefined,
    calories: num(r.calories),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
    sodium_mg: num(r.sodium_mg),
  }
}

function entryToRow(userId, iso, e) {
  return {
    user_id: userId,
    entry_date: iso,
    entry_time: e.time || null,
    meal: e.meal,
    description: e.description,
    source: e.source || null,
    confidence: e.confidence || null,
    calories: num(e.calories),
    protein_g: num(e.protein_g),
    carbs_g: num(e.carbs_g),
    fat_g: num(e.fat_g),
    fiber_g: num(e.fiber_g),
    sodium_mg: num(e.sodium_mg),
  }
}

function rowToFav(r) {
  return {
    id: r.id,
    description: r.description,
    meal: r.meal,
    calories: num(r.calories),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
    sodium_mg: num(r.sodium_mg),
  }
}

/* ---------- 1. Config: settings + plan + displayFont + lang ----------
   שורה אחת למשתמש. במקור אלו היו ארבעה מפתחות נפרדים
   (settings/plan/displayFont/lang); כאן הם נכתבים ביחד, וזה
   מה שמונע את ריבוי הכתיבות שהסכמה מתריעה עליו.

   הערה: ל-displayFont לא היה יעד בהערת המיפוי, והוא נשמר
   כמפתח שלישי בתוך config. */
export async function loadConfig(userId) {
  const { data } = await supabase
    .from('food_config').select('config, lang').eq('user_id', userId).maybeSingle()

  const c = data?.config || {}
  const font = c.displayFont
  return {
    settings: c.settings ? { ...defaultSettings, ...c.settings } : { ...defaultSettings },
    plan: c.plan ? { ...defaultPlan, ...c.plan } : { ...defaultPlan },
    displayFont: (font && FONTS[font]) ? font : DEFAULT_FONT,
    lang: data?.lang || 'en',
  }
}

export async function saveConfig(userId, { settings, plan, displayFont, lang }) {
  const { error } = await supabase.from('food_config').upsert({
    user_id: userId,
    config: { settings, plan, displayFont },
    ...(lang ? { lang } : {}),
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

/* שמירת שפה בלבד — אל תדרוס את config בדרך. */
export async function saveLang(userId, lang) {
  const { error } = await supabase.from('food_config')
    .upsert({ user_id: userId, lang, updated_at: new Date().toISOString() })
  if (error) throw error
}

/* ---------- 2. Entries ----------
   במקור: storeGet('log:'+iso) החזיר מערך שלם, וכל הוספה/מחיקה
   כתבה את המערך כולו בחזרה. כאן זה insert/delete נקודתי. */
export async function loadDay(userId, iso) {
  const { data, error } = await supabase
    .from('food_entries').select('*')
    .eq('user_id', userId).eq('entry_date', iso)
    .order('entry_time', { ascending: true, nullsFirst: true })
  if (error) throw error
  return (data || []).map(rowToEntry)
}

/* טווח ימים בשאילתה אחת.
   loadWeek במקור עשה 7 קריאות רצופות ו-loadTiming עוד 14 —
   מול הרשת זה 21 הלוך-ושוב. אותה תוצאה, שתי שאילתות. */
export async function loadRange(userId, isoStart, isoEnd) {
  const { data, error } = await supabase
    .from('food_entries').select('*')
    .eq('user_id', userId)
    .gte('entry_date', isoStart).lte('entry_date', isoEnd)
    .order('entry_time', { ascending: true, nullsFirst: true })
  if (error) throw error
  const byDate = {}
  for (const r of data || []) {
    (byDate[r.entry_date] = byDate[r.entry_date] || []).push(rowToEntry(r))
  }
  return byDate
}

export async function addEntry(userId, iso, entry) {
  const { data, error } = await supabase
    .from('food_entries').insert(entryToRow(userId, iso, entry)).select().single()
  if (error) throw error
  return rowToEntry(data)
}

export async function deleteEntry(userId, id) {
  const { error } = await supabase
    .from('food_entries').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ---------- 3. Weights ----------
   addWeight במקור סינן את אותו תאריך ואז דחף מחדש (שורה 532);
   unique(user_id, weigh_date) בסכמה הופך את זה ל-upsert. */
export async function loadWeights(userId) {
  const { data, error } = await supabase
    .from('weights').select('weigh_date, kg')
    .eq('user_id', userId).order('weigh_date', { ascending: true })
  if (error) throw error
  return (data || []).map((r) => ({ date: r.weigh_date, kg: num(r.kg) }))
}

export async function addWeight(userId, dateIso, kg) {
  const { error } = await supabase.from('weights')
    .upsert({ user_id: userId, weigh_date: dateIso, kg }, { onConflict: 'user_id,weigh_date' })
  if (error) throw error
}

export async function deleteWeight(userId, dateIso) {
  const { error } = await supabase
    .from('weights').delete().eq('user_id', userId).eq('weigh_date', dateIso)
  if (error) throw error
}

/* ---------- 4. Favourites ----------
   שומר על התקרה של 24 ועל בדיקת הכפילות שהיו במקור (שורות 511–518). */
export const FAV_LIMIT = 24

export async function loadFavourites(userId) {
  const { data, error } = await supabase
    .from('food_favourites').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(rowToFav)
}

/* מחזיר { added: false } כשהמועדף כבר קיים — במקור זו הייתה
   הודעת ה-toast שנשלחה בלי לשמור. */
export async function addFavourite(userId, e) {
  const existing = await loadFavourites(userId)
  if (existing.some((f) => f.description === e.description && f.calories === num(e.calories))) {
    return { added: false, favourites: existing }
  }

  const { error } = await supabase.from('food_favourites').insert({
    user_id: userId,
    description: e.description,
    meal: e.meal || null,
    calories: num(e.calories),
    protein_g: num(e.protein_g),
    carbs_g: num(e.carbs_g),
    fat_g: num(e.fat_g),
    fiber_g: num(e.fiber_g),
    sodium_mg: num(e.sodium_mg),
  })
  if (error) throw error

  // גזירה ל-24 האחרונים, כמו favs.slice(0,24) במקור
  const fresh = await loadFavourites(userId)
  const excess = fresh.slice(FAV_LIMIT)
  if (excess.length) {
    await supabase.from('food_favourites').delete()
      .eq('user_id', userId).in('id', excess.map((f) => f.id))
    return { added: true, favourites: fresh.slice(0, FAV_LIMIT) }
  }
  return { added: true, favourites: fresh }
}

export async function removeFavourite(userId, id) {
  const { error } = await supabase
    .from('food_favourites').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* ---------- 5. Components (בנק הרכיבים) ----------
   הערכים נשמרים ליחידה אחת. ההרכבה עצמה היא כפל וחיבור בצד
   הלקוח, כך שרכיב מוערך פעם אחת ומכאן ואילך השימוש בו לא עולה
   קריאת API ולא משתנה בין פעם לפעם. */
function rowToComponent(r) {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit || '',
    calories: num(r.calories),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
    sodium_mg: num(r.sodium_mg),
    sort_order: Number(r.sort_order) || 0,
  }
}

function componentToRow(userId, c) {
  return {
    user_id: userId,
    name: c.name,
    unit: c.unit || null,
    calories: num(c.calories),
    protein_g: num(c.protein_g),
    carbs_g: num(c.carbs_g),
    fat_g: num(c.fat_g),
    fiber_g: num(c.fiber_g),
    sodium_mg: num(c.sodium_mg),
    sort_order: Number(c.sort_order) || 0,
  }
}

export async function loadComponents(userId) {
  const { data, error } = await supabase
    .from('food_components').select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true }).order('name', { ascending: true })
  if (error) throw error
  return (data || []).map(rowToComponent)
}

export async function addComponent(userId, c) {
  const { data, error } = await supabase
    .from('food_components').insert(componentToRow(userId, c)).select().single()
  if (error) throw error
  return rowToComponent(data)
}

export async function updateComponent(userId, id, c) {
  const { data, error } = await supabase
    .from('food_components').update(componentToRow(userId, c))
    .eq('user_id', userId).eq('id', id).select().single()
  if (error) throw error
  return rowToComponent(data)
}

export async function deleteComponent(userId, id) {
  const { error } = await supabase
    .from('food_components').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}

/* הכנסת סט הבסיס. נקרא רק כשהבנק ריק, ומחזיר את הבנק המלא. */
export async function seedComponents(userId, list) {
  const { error } = await supabase
    .from('food_components').insert(list.map((c) => componentToRow(userId, c)))
  if (error) throw error
  return loadComponents(userId)
}

/* ---------- 6. Clear all ----------
   במקור: storage.list ואז מחיקת כל מפתח פרט ל-lang (שורות 540–547).
   כאן: מרוקנים את שלוש הטבלאות ומאפסים את config — ו-lang נשאר
   על כנו, כי הוא עמודה נפרדת באותה שורה. */
export async function clearAllData(userId) {
  for (const table of ['food_entries', 'weights', 'food_favourites', 'food_components']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    if (error) throw error
  }
  const { error } = await supabase.from('food_config')
    .update({ config: {}, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw error
}
