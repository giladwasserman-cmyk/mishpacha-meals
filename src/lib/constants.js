export const MEAL_TYPES = [
  { key: 'breakfast', label: 'בוקר' },
  { key: 'lunch', label: 'צהריים' },
  { key: 'school', label: 'בית ספר' },
  { key: 'dinner', label: 'ערב' },
]
export const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map((m) => [m.key, m.label]))

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'] // א–ה

export const TAGS = [
  'בריא',
  'מהיר',
  'הכנה מראש',
  'נשמר טוב',
  'צמחוני',
  'חלבון גבוה',
  'פינוק',
]

export const CATEGORIES = [
  'ירקות ופירות',
  'חלבונים',
  'מוצרי חלב',
  'יבשים ומזווה',
  'קפואים',
  'אחר',
]

// צבעים לבחירה לכל בן משפחה
export const PALETTE = [
  '#2e6b4c', '#cf4b39', '#e39b1f', '#3a7ca5',
  '#7a4fa3', '#c45d9b', '#5c8a3a', '#b5651d',
]
