# files/ — חומרי המקור של יומן האכילה

התיקייה הזו היא **תיעוד**, לא קוד פעיל. שום דבר כאן לא נטען על ידי האפליקציה.

| קובץ | מה זה | סטטוס |
|---|---|---|
| `food-tracker.html` | האפליקציה המקורית העצמאית — המפרט בפועל שממנו נגזר הטאב | נשמר כהפניה |
| `01-הוראות-חיבור-claude-code.md` | הרנבוק המקורי (התקנה, branch, מפתח API, מיזוג) | נשמר |
| `02-supabase-schema.sql` | סכמת הטבלאות + RLS | **הוחל** → `supabase/migrations/` |
| `03-edge-function-skeleton.ts` | שלד ה-Edge Function | **הוחל** → `supabase/functions/estimate-nutrition/` |

שני האחרונים נשארים כאן כמקור ההשוואה, אבל הגרסאות החיות הן אלה שתחת `supabase/`.
עריכה כאן לא משפיעה על כלום.

## מ-`food-tracker.html` לטאב

| מקור | יעד |
|---|---|
| לוגיקה (i18n, `checkEntry`, `dayTotals`, EWMA, הפרומפט) | `src/lib/foodLogCore.js` — הועתק מילה במילה |
| `window.storage` | `src/lib/foodLogStore.js` — Supabase, מסונן לפי `user_id` |
| `fetch` ל-`api.anthropic.com` | `src/lib/foodLogApi.js` → Edge Function (המפתח בצד השרת) |
| `render*` + `bind` | `src/pages/FoodLog.jsx` + `src/pages/foodLogPanels.jsx` |
| ה-`<style>` | `src/pages/foodlog.css` — ממודר תחת `.foodlog` |
