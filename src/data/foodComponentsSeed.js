// ============================================================
// בנק רכיבים — סט התחלתי
//
// כל הערכים הם ל-*יחידה אחת* של הרכיב, לפי טבלאות תזונה
// סטנדרטיות ומוצרים נפוצים בישראל. אלו נקודות פתיחה סבירות,
// לא אמת מוחלטת: מותגים נבדלים זה מזה, וגודל "בינוני" הוא
// הערכה. הכל ניתן לעריכה ולמחיקה מתוך האפליקציה.
//
// נשמר בקוד ולא ב-SQL כדי שלא יהיה צורך במיגרציה כדי לתקן ערך.
// ============================================================

export const FOOD_COMPONENTS_SEED = [
  // ---- חלבון ----
  { name: 'ביצה', unit: 'יחידה (L)', calories: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3, fiber_g: 0, sodium_mg: 62 },
  { name: 'חלבון ביצה', unit: 'מביצה אחת', calories: 17, protein_g: 3.6, carbs_g: 0.2, fat_g: 0.1, fiber_g: 0, sodium_mg: 55 },
  { name: 'חזה עוף מבושל', unit: '100 גרם', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sodium_mg: 74 },
  { name: 'טונה במים, מסוננת', unit: '100 גרם', calories: 116, protein_g: 26, carbs_g: 0, fat_g: 1, fiber_g: 0, sodium_mg: 320 },
  { name: 'גבינה בולגרית 5%', unit: '30 גרם', calories: 45, protein_g: 5, carbs_g: 1, fat_g: 1.5, fiber_g: 0, sodium_mg: 400 },
  { name: 'קוטג׳ 5%', unit: '100 גרם', calories: 98, protein_g: 11, carbs_g: 3.5, fat_g: 5, fiber_g: 0, sodium_mg: 330 },
  { name: 'יוגורט פרו', unit: 'גביע (150 גרם)', calories: 95, protein_g: 15, carbs_g: 7.5, fat_g: 0.5, fiber_g: 0, sodium_mg: 60 },

  // ---- פחמימה ----
  { name: 'פרוסת לחם מלא', unit: 'פרוסה (30 גרם)', calories: 75, protein_g: 3.5, carbs_g: 13, fat_g: 1, fiber_g: 2, sodium_mg: 150 },

  // ---- שומן ----
  { name: 'שמן זית', unit: 'כף (15 מ״ל)', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5, fiber_g: 0, sodium_mg: 0 },
  { name: 'טחינה גולמית', unit: 'כף (15 גרם)', calories: 89, protein_g: 2.6, carbs_g: 3.2, fat_g: 8, fiber_g: 1.4, sodium_mg: 5 },
  { name: 'אבוקדו', unit: 'חצי בינוני (70 גרם)', calories: 112, protein_g: 1.4, carbs_g: 6, fat_g: 10, fiber_g: 4.7, sodium_mg: 5 },

  // ---- ירקות ----
  { name: 'עגבנייה', unit: 'בינונית (120 גרם)', calories: 22, protein_g: 1.1, carbs_g: 4.8, fat_g: 0.2, fiber_g: 1.5, sodium_mg: 6 },
  { name: 'מלפפון', unit: 'בינוני (150 גרם)', calories: 23, protein_g: 1, carbs_g: 5.4, fat_g: 0.2, fiber_g: 0.8, sodium_mg: 3 },
  { name: 'בצל', unit: 'בינוני (110 גרם)', calories: 44, protein_g: 1.2, carbs_g: 10, fat_g: 0.1, fiber_g: 1.9, sodium_mg: 4 },
  { name: 'פלפל אדום', unit: 'בינוני (120 גרם)', calories: 37, protein_g: 1.2, carbs_g: 7.2, fat_g: 0.4, fiber_g: 2.5, sodium_mg: 5 },

  // ---- נוזלים ----
  { name: 'חלב 3%', unit: '100 מ״ל', calories: 61, protein_g: 3.3, carbs_g: 4.7, fat_g: 3, fiber_g: 0, sodium_mg: 44 },
].map((c, i) => ({ ...c, sort_order: i }))
