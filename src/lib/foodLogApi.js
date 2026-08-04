// ============================================================
// Food Log — הערכת ערכים תזונתיים
//
// מחליף את ה-fetch הישיר ל-api.anthropic.com שהיה ב-
// food-tracker.html:409. הבקשה עוברת עכשיו ל-Edge Function
// שמחזיקה את המפתח בצד השרת.
//
// בניית ההודעה (הפרומפט והסכמה) ופענוח התשובה נשארו
// ב-foodLogCore.js ולא השתנו — רק ההובלה ביניהם.
// ============================================================

import { supabase } from './supabase'
import { buildEstimateMessages, parseEstimate } from './foodLogCore'

/* Haiku הוא ברירת המחדל ונקבע בשרת. הלקוח לא שולח model כלל,
   ולכן אי אפשר להעלות עלויות מהדפדפן. לשדרוג עתידי ל-Sonnet:
   estimateNutrition(input, lang, t, { model: MODEL_SONNET })
   — הערך חייב להיות ברשימת MODEL_ALLOWED של הפונקציה. */
export const MODEL_SONNET = 'claude-sonnet-5'

/* חילוץ הודעת השגיאה מגוף התשובה של הפונקציה.
   supabase-js עוטף תשובות לא-2xx ב-FunctionsHttpError ומשאיר
   את ה-Response המקורי ב-error.context. */
async function serverMessage(error) {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return body.detail ? `${body.error}: ${body.detail}` : body.error
  } catch {
    /* גוף לא-JSON — ניפול לברירת המחדל למטה */
  }
  return null
}

export async function estimateNutrition(input, lang, t, { model } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const messages = buildEstimateMessages(input, lang, t)

  // functions.invoke מצרף את טוקן הגישה של המשתמש אוטומטית,
  // ולכן משתמש באותו מנגנון אימות של שאר האפליקציה.
  const { data, error } = await supabase.functions.invoke('estimate-nutrition', {
    body: { messages, ...(model ? { model } : {}) },
  })

  if (error) {
    const msg = await serverMessage(error)
    throw new Error(msg || error.message || 'Estimate request failed')
  }
  if (data?.error) throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error)

  return parseEstimate(data, t)
}
