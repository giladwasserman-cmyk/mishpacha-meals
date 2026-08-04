// ============================================================
// Food Log — לוגיקה טהורה
//
// הועתק מילה במילה מ-files/food-tracker.html (שורות 189–580).
// אין כאן DOM, אין רשת, אין אחסון — רק פונקציות טהורות.
// השינוי המכני היחיד: מה שקרא קודם מ-`state` הגלובלי מקבל
// עכשיו את הערך כפרמטר (lang / plan / t).
// ============================================================

/* ================= Translations ================= */
export const I18N = {
  en: {
    appTitle: 'Food Log', tabLog: 'Log', tabWeek: 'Week', tabWeight: 'Weight', today: 'today',
    addEntry: 'Add an entry', manual: 'Manual', photo: 'Photo', meal: 'Meal',
    mealBreakfast: 'Breakfast', mealLunch: 'Lunch', mealDinner: 'Dinner', mealSnack: 'Snack',
    whatDidYouEat: 'What did you eat?',
    descPlaceholder: 'e.g. grilled chicken breast ~200g, cucumber salad, tahini',
    estimate: 'Estimate', estimating: 'Estimating…',
    photoOfPlate: 'Photo of the plate', tapToChoosePhoto: 'Tap to choose a photo',
    anchorHint: 'For a better portion estimate, get a fork, hand, or standard plate in the frame — food identification is usually right, portion size is where it drifts.',
    optionalNote: 'Note (portion, ingredients, cooking method)',
    notePlaceholder: 'e.g. large plate, tahini on the side, no oil',
    estimateFromPhoto: 'Estimate from photo',
    estimateDisclaimer: 'Estimates are approximate. Check the portion before saving.',
    identified: 'Identified:', portionLabel: 'Portion actually eaten',
    calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber', sodium: 'Sodium',
    confSuffix: 'confidence', confLow: 'low', confMedium: 'medium', confHigh: 'high',
    addToLog: 'Add to log', discard: 'Discard', saveFav: 'Save as favourite',
    favourites: 'Quick add', noFavs: 'Log something and star it to add it here.',
    logForDay: 'log', noEntries: 'No entries yet for this day.',
    last7days: 'Last 7 days · calories',
    describeFirst: 'Describe what you ate first.',
    couldNotEstimate: 'Could not get an estimate. Try again.',
    enterDateWeight: 'Enter a date and weight',
    weightSaved: 'Weight saved', addedToLog: 'Added to log', favSaved: 'Saved to quick add',
    allDataCleared: 'All data cleared', settingsSaved: 'Saved',
    logYourWeight: 'Log your weight', date: 'Date', time: 'Time', weightKg: 'Weight (kg)',
    weightPlaceholder: 'e.g. 82.4', save: 'Save', trend: 'Trend',
    needTwoWeighins: 'Log at least two weigh-ins to see a trend.',
    history: 'History', noWeighins: 'No weigh-ins logged yet.',
    rawWeight: 'Scale reading', trendWeight: 'Trend',
    currentTrend: 'Trend weight', weeklyRate: 'Rate of change', vsTarget: 'target',
    perWeek: '/week', notEnoughData: 'Not enough data yet',
    weighNote: 'Adva asked for one weigh-in a week, not daily — day-to-day swings are water, not fat. The trend line is what to read.',
    dailyTargets: 'Daily targets', planRules: 'Plan rules',
    targetsSub: 'From your dietitian. Blank means track without a target.',
    planSub: "These are read from your dietitian's chat. Edit if the plan changes.",
    proteinDaily: 'Protein target (g/day)', proteinPerMeal: 'Max protein per meal (g)',
    carbEntryFlag: 'Flag an entry above (g carbs)', carbSplurgeDay: 'Carb day above (g carbs)',
    splurgeDaysAllowed: 'Carb days allowed per week', weeklyLossTarget: 'Loss target (kg/week)',
    lateHour: 'Late eating starts at (hour)',
    planNotes: 'Plan notes (used when checking entries)',
    clearAllData: 'Clear all data', cancel: 'Cancel',
    confirmClearData: 'Delete all entries, weights, favourites and plan settings? This cannot be undone.',
    noTargetSet: 'no target', of: 'of',
    kcal: 'kcal', gUnit: 'g', mgUnit: 'mg', kgUnit: 'kg',
    abbrProtein: 'P', abbrCarbs: 'C', abbrFat: 'F', abbrFiber: 'Fib', abbrSodium: 'Na',
    // week tab
    weekOf: '7 days ending', avgCalories: 'Avg calories', avgProtein: 'Avg protein',
    proteinDaysHit: 'Days at protein target', carbDaysUsed: 'Carb days used',
    daysLogged: 'days logged', ofDays: 'of', allowed: 'allowed',
    mealTiming: 'When you eat', lateShare: 'of calories after',
    timingNote: 'Bars are average calories per hour across the last 14 days.',
    weekEmpty: 'Log a few days to see the weekly picture.',
    // flags
    flagProteinMeal: '{n}g protein in one meal — Adva caps a single meal at {max}g. Spread it across the day.',
    flagCarbHigh: '{n}g carbs in this entry. Under the 80/20 rule this counts against your carb budget.',
    flagLate: 'Logged at {t} — this lands in your late-eating window.',
    flagProteinLow: 'Day total {n}g protein, target is {target}g. {gap}g short — a protein snack (20–25g) closes it.',
    flagProteinGood: 'Protein target met for the day ({n}g).',
    flagSplurgeUsed: 'This makes {n} carb days this week ({allowed} allowed under 80/20).',
    flagSnackProtein: 'Snack with almost no protein — Adva wanted protein in the between-meal snacks.',
    calorieCeiling: 'Calorie red line (kcal/day)',
    ceilingOver: 'Over the {c} kcal line — {n} kcal today ({over} over).',
    ceilingNear: '{n} kcal today. {left} kcal left under the {c} line.',
    ceilingCross: 'Adding this puts the day at {n} kcal, past the {c} kcal line.',
    ceilingWouldNear: 'This brings the day to {n} kcal — {left} left under the line.',
    remaining: 'left today', overBy: 'over',
    ceilingDays: 'Days over the line',
    titleFont: 'Title font',
    // component bank
    compose: 'Build', componentBank: 'Component bank',
    noComponents: 'Your bank is empty. Add a component, or start from the base set.',
    addBaseSet: 'Add base components', baseSetAdded: 'Base components added',
    newComponent: 'New component', componentName: 'Name', componentUnit: 'Unit',
    unitPlaceholder: 'e.g. one, slice, 100 g',
    componentDescPlaceholder: 'e.g. one large egg',
    perUnitNote: 'Values are per one unit. Estimated once, then reused — no guessing again later.',
    saveToBank: 'Save to bank', componentSaved: 'Saved to bank',
    editComponent: 'Edit', confirmDeleteComponent: 'Remove this component from the bank?',
    composeEmpty: 'Pick components to build a meal.',
    composeTotal: 'Total', composeContinue: 'Review and add',
    manageComponents: 'Manage the bank',
    estimateTruncated: 'The estimate came back cut off. Try splitting the meal into two entries, or describing it more briefly.'
  },
  he: {
    appTitle: 'יומן אכילה', tabLog: 'יומן', tabWeek: 'שבוע', tabWeight: 'משקל', today: 'היום',
    addEntry: 'הוספת רשומה', manual: 'ידני', photo: 'תמונה', meal: 'ארוחה',
    mealBreakfast: 'ארוחת בוקר', mealLunch: 'ארוחת צהריים', mealDinner: 'ארוחת ערב', mealSnack: 'נשנוש',
    whatDidYouEat: 'מה אכלת?',
    descPlaceholder: 'לדוגמה: חזה עוף בגריל כ-200 גרם, סלט מלפפונים, טחינה',
    estimate: 'הערכה', estimating: 'מעריך…',
    photoOfPlate: 'תמונה של הצלחת', tapToChoosePhoto: 'הקישו לבחירת תמונה',
    anchorHint: 'להערכת מנה מדויקת יותר — שימו בפריים מזלג, יד או צלחת סטנדרטית. זיהוי המאכל בדרך כלל מדויק; גודל המנה הוא מה שסוטה.',
    optionalNote: 'הערה (גודל מנה, מרכיבים, אופן הכנה)',
    notePlaceholder: 'לדוגמה: צלחת גדולה, טחינה בצד, בלי שמן',
    estimateFromPhoto: 'הערכה מתמונה',
    estimateDisclaimer: 'ההערכות משוערות. בדקו את גודל המנה לפני השמירה.',
    identified: 'זוהה:', portionLabel: 'כמה באמת נאכל',
    calories: 'קלוריות', protein: 'חלבון', carbs: 'פחמימות', fat: 'שומן', fiber: 'סיבים', sodium: 'נתרן',
    confSuffix: 'ביטחון', confLow: 'נמוך', confMedium: 'בינוני', confHigh: 'גבוה',
    addToLog: 'הוספה ליומן', discard: 'ביטול', saveFav: 'שמירה למועדפים',
    favourites: 'הוספה מהירה', noFavs: 'סמנו רשומה בכוכב כדי שתופיע כאן.',
    logForDay: 'יומן', noEntries: 'אין עדיין רשומות ליום זה.',
    last7days: '7 הימים האחרונים · קלוריות',
    describeFirst: 'תארו קודם מה אכלתם.',
    couldNotEstimate: 'לא ניתן היה לקבל הערכה. נסו שוב.',
    enterDateWeight: 'הזינו תאריך ומשקל',
    weightSaved: 'המשקל נשמר', addedToLog: 'נוסף ליומן', favSaved: 'נשמר להוספה מהירה',
    allDataCleared: 'כל הנתונים נמחקו', settingsSaved: 'נשמר',
    logYourWeight: 'רישום משקל', date: 'תאריך', time: 'שעה', weightKg: 'משקל (ק"ג)',
    weightPlaceholder: 'לדוגמה: 82.4', save: 'שמירה', trend: 'מגמה',
    needTwoWeighins: 'רשמו לפחות שתי שקילות כדי לראות מגמה.',
    history: 'היסטוריה', noWeighins: 'עדיין לא נרשמו שקילות.',
    rawWeight: 'קריאת המשקל', trendWeight: 'מגמה',
    currentTrend: 'משקל מגמה', weeklyRate: 'קצב שינוי', vsTarget: 'יעד',
    perWeek: '/שבוע', notEnoughData: 'אין עדיין מספיק נתונים',
    weighNote: 'אדוה ביקשה שקילה אחת בשבוע, לא יומית — תנודות יומיות הן נוזלים, לא שומן. קו המגמה הוא מה שחשוב.',
    dailyTargets: 'יעדים יומיים', planRules: 'כללי התוכנית',
    targetsSub: 'מהדיאטנית. שדה ריק = מעקב ללא יעד.',
    planSub: 'נקראו מהצ׳אט עם הדיאטנית. ערכו אם התוכנית משתנה.',
    proteinDaily: 'יעד חלבון (גר׳/יום)', proteinPerMeal: 'מקסימום חלבון בארוחה (גר׳)',
    carbEntryFlag: 'סימון רשומה מעל (גר׳ פחמימה)', carbSplurgeDay: 'יום פחמימות מעל (גר׳)',
    splurgeDaysAllowed: 'ימי פחמימות מותרים בשבוע', weeklyLossTarget: 'יעד ירידה (ק"ג/שבוע)',
    lateHour: 'אכילה מאוחרת מתחילה בשעה',
    planNotes: 'הערות התוכנית (משמשות בבדיקת רשומות)',
    clearAllData: 'מחיקת כל הנתונים', cancel: 'ביטול',
    confirmClearData: 'למחוק את כל הרשומות, המשקלים, המועדפים והגדרות התוכנית? לא ניתן לבטל.',
    noTargetSet: 'ללא יעד', of: 'מתוך',
    kcal: 'קק"ל', gUnit: "גר'", mgUnit: 'מ"ג', kgUnit: 'ק"ג',
    abbrProtein: 'חלבון', abbrCarbs: "פחמ'", abbrFat: 'שומן', abbrFiber: 'סיבים', abbrSodium: 'נתרן',
    weekOf: '7 ימים עד', avgCalories: 'ממוצע קלוריות', avgProtein: 'ממוצע חלבון',
    proteinDaysHit: 'ימים ביעד החלבון', carbDaysUsed: 'ימי פחמימות שנוצלו',
    daysLogged: 'ימים נרשמו', ofDays: 'מתוך', allowed: 'מותר',
    mealTiming: 'מתי אתה אוכל', lateShare: 'מהקלוריות אחרי',
    timingNote: 'העמודות הן ממוצע קלוריות לשעה ב-14 הימים האחרונים.',
    weekEmpty: 'רשמו כמה ימים כדי לראות את התמונה השבועית.',
    flagProteinMeal: '{n} גר׳ חלבון בארוחה אחת — אדוה מגבילה ארוחה בודדת ל-{max} גר׳. כדאי לפזר על פני היום.',
    flagCarbHigh: '{n} גר׳ פחמימה ברשומה הזו. לפי כלל ה-80/20 זה נזקף לתקציב הפחמימות.',
    flagLate: 'נרשם ב-{t} — נופל בחלון האכילה המאוחרת.',
    flagProteinLow: 'סה"כ {n} גר׳ חלבון היום, היעד {target}. חסרים {gap} גר׳ — נשנוש חלבון (20–25 גר׳) סוגר את זה.',
    flagProteinGood: 'יעד החלבון היומי הושג ({n} גר׳).',
    flagSplurgeUsed: 'זה {n} ימי פחמימות השבוע ({allowed} מותרים לפי 80/20).',
    flagSnackProtein: 'נשנוש כמעט בלי חלבון — אדוה ביקשה חלבון בנשנושים שבין הארוחות.',
    calorieCeiling: 'קו אדום קלורי (קק"ל/יום)',
    ceilingOver: 'מעל הקו של {c} קק"ל — {n} קק"ל היום ({over} מעל).',
    ceilingNear: '{n} קק"ל היום. נותרו {left} קק"ל עד הקו של {c}.',
    ceilingCross: 'ההוספה תביא את היום ל-{n} קק"ל, מעבר לקו של {c} קק"ל.',
    ceilingWouldNear: 'זה מביא את היום ל-{n} קק"ל — נותרו {left} עד הקו.',
    remaining: 'נותרו היום', overBy: 'מעל',
    ceilingDays: 'ימים מעל הקו',
    titleFont: 'גופן הכותרת',
    // בנק הרכיבים
    compose: 'הרכבה', componentBank: 'בנק הרכיבים',
    noComponents: 'הבנק ריק. הוסיפו רכיב, או התחילו מסט הבסיס.',
    addBaseSet: 'הוספת רכיבי בסיס', baseSetAdded: 'רכיבי הבסיס נוספו',
    newComponent: 'רכיב חדש', componentName: 'שם', componentUnit: 'יחידה',
    unitPlaceholder: 'לדוגמה: יחידה, פרוסה, 100 גרם',
    componentDescPlaceholder: 'לדוגמה: ביצה גדולה אחת',
    perUnitNote: 'הערכים הם ליחידה אחת. מעריכים פעם אחת ומכאן זה חוזר על עצמו — בלי לנחש מחדש בכל פעם.',
    saveToBank: 'שמירה לבנק', componentSaved: 'הרכיב נשמר',
    editComponent: 'עריכה', confirmDeleteComponent: 'למחוק את הרכיב מהבנק?',
    composeEmpty: 'בחרו רכיבים כדי להרכיב ארוחה.',
    composeTotal: 'סה״כ', composeContinue: 'לסקירה והוספה',
    manageComponents: 'ניהול הבנק',
    estimateTruncated: 'התשובה חזרה קטועה. נסו לפצל את הארוחה לשתי רשומות, או לתאר אותה בקצרה יותר.'
  }
};

export const MEAL_I18N = { breakfast: 'mealBreakfast', lunch: 'mealLunch', dinner: 'mealDinner', snack: 'mealSnack' };
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

/* מפעל המתרגמים. במקור אלו היו פונקציות גלובליות שקראו מ-state.lang;
   כאן השפה נכנסת פעם אחת ומוחזר אותו API בדיוק. */
export function makeT(lang) {
  const l = lang || 'en';
  const tr = (k) => (I18N[l] && I18N[l][k] !== undefined) ? I18N[l][k] : (I18N.en[k] || k);
  const trf = (k, params) => {
    let s = tr(k);
    Object.keys(params || {}).forEach((p) => { s = s.split('{' + p + '}').join(params[p]); });
    return s;
  };
  const mealLabel = (k) => MEAL_I18N[k] ? tr(MEAL_I18N[k]) : k;
  const locale = () => l === 'he' ? 'he-IL' : 'en-US';
  return { lang: l, tr, trf, mealLabel, locale };
}

/* ================= Dates ================= */
export function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function displayDate(iso, locale) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function shiftDate(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
export function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ================= Defaults (from the dietitian chat) ================= */
export const defaultSettings = { calories: '1800', protein: '100', carbs: '', fat: '', fiber: '', sodium: '' };
export const defaultPlan = {
  proteinDaily: 100, proteinPerMeal: 40, carbEntryFlag: 30, carbSplurgeDay: 100,
  splurgeDaysAllowed: 2, weeklyLossTarget: 0.5, lateHour: 21, calorieCeiling: 1800,
  notes_en: "Adva Lotati's plan:\n• At least 100 g protein a day; never more than 30–40 g in a single meal.\n• 80/20 carbs: 80% of the week low-carb (protein + vegetables), carbs saved for the 20% — evening wine, a bar, a restaurant, one treat meal.\n• Protein in the between-meal snacks (protein drink / bar / Pro yogurt, 20–25 g).\n• Base of every meal is protein + vegetables. Carrots, sweet potato, legumes and cherry tomatoes behave like carbs, not free vegetables.\n• Target loss 0.5 kg/week. Weigh once a week, not daily.\n• Current phase: metabolic adaptation — strength training 3x/week plus aerobic work is the lever, and protein goes up once training starts.",
  notes_he: "התוכנית של אדוה לוטטי:\n• לפחות 100 גר׳ חלבון ביום; לא יותר מ-30–40 גר׳ בארוחה בודדת.\n• 80/20 בפחמימות: 80% מהשבוע דל פחמימות (חלבון + ירקות), הפחמימות נשמרות ל-20% — כוס יין בערב, בר, מסעדה, ארוחת פינוק אחת.\n• חלבון בנשנושים שבין הארוחות (משקה/חטיף חלבון/יוגורט פרו, 20–25 גר׳).\n• בסיס כל ארוחה: חלבון + ירקות. גזר, בטטה, קטניות ועגבניות שרי מתנהגים כפחמימה, לא כירק חופשי.\n• יעד ירידה 0.5 ק\"ג לשבוע. שקילה פעם בשבוע, לא כל יום.\n• השלב הנוכחי: אדפטציה מטבולית — אימוני כוח 3 בשבוע יחד עם אירובי הם המנוף, וכמות החלבון עולה כשמתחילים להתאמן."
};

/* ================= Display font ================= */
export const FONTS = {
  frank: { label: 'Frank Ruhl Libre', stack: "'Frank Ruhl Libre','Noto Serif Hebrew','Frank Ruehl CLM',David,Georgia,serif" },
  suez: { label: 'Suez One', stack: "'Suez One','Noto Serif Hebrew','Frank Ruehl CLM',David,Georgia,serif" },
  rubik: { label: 'Rubik', stack: "'Rubik','Arial Hebrew','Segoe UI',Helvetica,sans-serif" },
  heebo: { label: 'Heebo', stack: "'Heebo','Arial Hebrew','Segoe UI',Helvetica,sans-serif" },
  assistant: { label: 'Assistant', stack: "'Assistant','Arial Hebrew','Segoe UI',Helvetica,sans-serif" }
};
export const DEFAULT_FONT = 'frank';

/* ================= Totals ================= */
export function dayTotals(entries) {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 };
  (entries || []).forEach((e) => {
    t.calories += Number(e.calories) || 0;
    t.protein_g += Number(e.protein_g) || 0;
    t.carbs_g += Number(e.carbs_g) || 0;
    t.fat_g += Number(e.fat_g) || 0;
    t.fiber_g += Number(e.fiber_g) || 0;
    t.sodium_mg += Number(e.sodium_mg) || 0;
  });
  return t;
}

/* ================= Plan checking (local, deterministic) =================
   זהה למקור; `plan` ו-`t` מגיעים כפרמטרים במקום מ-state הגלובלי. */
export function checkEntry(entry, dayEntriesAfterAdd, splurgeDaysThisWeek, plan, t) {
  const p = plan || defaultPlan;
  const { tr, trf } = t;
  const flags = [];
  if (entry.protein_g > p.proteinPerMeal)
    flags.push({ sev: 'warn', text: trf('flagProteinMeal', { n: Math.round(entry.protein_g), max: p.proteinPerMeal }) });
  if (entry.carbs_g > p.carbEntryFlag)
    flags.push({ sev: 'note', text: trf('flagCarbHigh', { n: Math.round(entry.carbs_g) }) });
  if (entry.meal === 'snack' && entry.protein_g < 8 && entry.calories > 80)
    flags.push({ sev: 'note', text: tr('flagSnackProtein') });
  if (entry.time) {
    const hr = parseInt(entry.time.split(':')[0], 10);
    if (!isNaN(hr) && hr >= p.lateHour) flags.push({ sev: 'note', text: trf('flagLate', { t: entry.time }) });
  }
  const totals = dayTotals(dayEntriesAfterAdd);
  if (p.calorieCeiling > 0) {
    if (totals.calories > p.calorieCeiling)
      flags.push({ sev: 'warn', text: trf('ceilingCross', { n: Math.round(totals.calories), c: p.calorieCeiling }) });
    else
      flags.push({ sev: 'note', text: trf('ceilingWouldNear', { n: Math.round(totals.calories), left: Math.round(p.calorieCeiling - totals.calories) }) });
  }
  if (totals.protein_g >= p.proteinDaily)
    flags.push({ sev: 'good', text: trf('flagProteinGood', { n: Math.round(totals.protein_g) }) });
  else
    flags.push({ sev: 'note', text: trf('flagProteinLow', { n: Math.round(totals.protein_g), target: p.proteinDaily, gap: Math.round(p.proteinDaily - totals.protein_g) }) });
  if (totals.carbs_g > p.carbSplurgeDay)
    flags.push({
      sev: splurgeDaysThisWeek > p.splurgeDaysAllowed ? 'warn' : 'note',
      text: trf('flagSplurgeUsed', { n: splurgeDaysThisWeek, allowed: p.splurgeDaysAllowed })
    });
  return flags;
}

/* ================= Trend weight (EWMA) ================= */
export function computeTrend(weights) {
  if (!weights.length) return [];
  const alphaDaily = 0.10;
  const out = [];
  let trend = weights[0].kg;
  out.push({ date: weights[0].date, kg: weights[0].kg, trend });
  for (let i = 1; i < weights.length; i++) {
    const gap = Math.max(1, daysBetween(weights[i - 1].date, weights[i].date));
    const a = 1 - Math.pow(1 - alphaDaily, gap);
    trend = trend + a * (weights[i].kg - trend);
    out.push({ date: weights[i].date, kg: weights[i].kg, trend });
  }
  return out;
}

export function trendRate(series) { // kg per week over last 28 days of trend
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  let ref = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (daysBetween(series[i].date, last.date) >= 14) { ref = series[i]; break; }
  }
  if (!ref) ref = series[0];
  const days = daysBetween(ref.date, last.date);
  if (days < 7) return null;
  return ((last.trend - ref.trend) / days) * 7;
}

/* ================= Render helpers ================= */
export function fmt(n, locale) { return (Math.round(Number(n) || 0)).toLocaleString(locale); }
export function fmt1(n) { return (Number(n) || 0).toFixed(1); }

/* כמה ימי-פחמימות נוצלו בשבוע המוצג */
export function splurgeCount(weekDays, plan) {
  const p = plan || defaultPlan;
  return weekDays.filter((d) => d.totals.carbs_g > p.carbSplurgeDay).length;
}

/* ================= בנק הרכיבים =================
   סכימה של רכיבים נבחרים לכדי ארוחה אחת. זה כפל וחיבור בלבד —
   אין כאן קריאת API ואין שונות: אותה חביתה תיתן אותם מספרים
   בכל פעם. הערכים מעוגלים לספרה אחת אחרי הנקודה, כי רכיבים
   כמו סיבים בירק בודד נעלמים בעיגול לשלם. */
const MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg'];

export function composeTotals(picks) {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 };
  for (const { component, qty } of picks) {
    const q = Number(qty) || 0;
    for (const k of MACRO_KEYS) t[k] += (Number(component[k]) || 0) * q;
  }
  for (const k of MACRO_KEYS) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

/* "ביצה ×1, חלבון ביצה ×2, גבינה בולגרית 5%" — כמות 1 לא מצוינת */
export function composeDescription(picks) {
  return picks
    .map(({ component, qty }) => component.name + (Number(qty) === 1 ? '' : ' ×' + qty))
    .join(', ');
}

/* ================= Photo helper ================= */
export function fileToBase64(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Could not read image'));
    r.readAsDataURL(f);
  });
}

/* ================= Nutrition estimate — בניית ההודעה =================
   מבוסס על food-tracker.html:394–408. הסכמה והמבנה זהים למקור;
   נוספו שתי הנחיות אחרי ש-Haiku העריך "קפוצ׳ינו קטן עם חלב 3%"
   כ-250 מ״ל וספר כמעט את כל הנפח כחלב — 120 קק״ל ו-5 גר׳ חלבון
   במקום כ-45 ו-2.3. שתי שגיאות נפרדות: נפח מוגזם, וספירת נפח
   הכוס כולו כמרכיב קלורי.
   הקריאה עצמה עברה ל-foodLogApi.js, שפונה ל-Edge Function. */
export function buildEstimateMessages({ description, meal, imageBase64, imageMediaType, note }, lang, t) {
  const mealText = t.mealLabel(meal);
  const langName = lang === 'he' ? 'Hebrew' : 'English';
  const schema = 'Return ONLY valid JSON (no markdown fences, no commentary) matching exactly: ' +
    '{"items":[{"name":"string","portion":"string"}],"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number,"sodium_mg":number,"confidence":"low"|"medium"|"high"}. ' +
    'Use standard nutrition-database values for common foods and typical adult portions. Israeli supermarket products and restaurant dishes are likely. ' +
    'For drinks, count only the caloric ingredients actually in the cup. Espresso, water, tea and the air whipped into foam add volume but almost no calories, so never treat the total cup volume as if it were all milk — a cappuccino is mostly foam and espresso by volume. ' +
    'When the size is given only as a word like "small", "regular" or "large", do not silently assume a large serving: choose the smaller end of the plausible range, state the assumed amount in "portion", and set confidence to "low". ' +
    'If portion size is unclear, assume a typical serving and set confidence to "low". ' +
    'Write "name" and "portion" in ' + langName + '. Numeric fields are plain numbers, no units.';
  let content;
  if (imageBase64) {
    content = [{ type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } },
    { type: 'text', text: 'Identify the food(s) in this photo and estimate the nutrition. Meal: ' + mealText + '.' + (note ? ' User note: ' + note + '.' : '') + ' Pay particular attention to portion size; use any fork, hand, or plate in frame as a scale reference.\n\n' + schema }];
  } else {
    content = [{ type: 'text', text: 'Estimate nutrition for this entry. Meal: ' + mealText + '. Food: ' + description + '\n\n' + schema }];
  }
  return [{ role: 'user', content }];
}

/* פענוח בלוק הטקסט שחוזר מקלוד. הניקוי זהה למקור (שורות 415–418);
   נוסף טיפול בשגיאה, כי המקור נתן ל-JSON.parse ליפול והמשתמש ראה
   "Unterminated string in JSON at position 401" — הודעה שלא מסבירה
   כלום. כשהתשובה נקטעה בגלל max_tokens אנחנו יודעים זאת בוודאות
   מ-stop_reason ואפשר להגיד את זה בשפה של המשתמש. */
export function parseEstimate(data, t) {
  const tb = (data.content || []).find((b) => b.type === 'text');
  if (!tb) throw new Error(t ? t.tr('couldNotEstimate') : 'No estimate returned');
  const clean = tb.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    if (data.stop_reason === 'max_tokens') {
      throw new Error(t ? t.tr('estimateTruncated') : 'The estimate was cut off. Try describing the meal more briefly.');
    }
    throw new Error(t ? t.tr('couldNotEstimate') : 'Could not read the estimate');
  }
}
