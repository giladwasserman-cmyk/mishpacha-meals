// בנק מנות התחלתי. נטען בלחיצה מתוך מסך "בנק המנות".
// כל מנה: שם, סוגי ארוחה, תגיות, מרכיבים (עם קטגוריה לרשימת הקניות).

export const SEED_DISHES = [
  // ---- בוקר ----
  {
    name: 'חביתת ירק עם אבוקדו',
    meal_types: ['breakfast'],
    tags: ['בריא', 'מהיר', 'חלבון גבוה'],
    notes: 'ביצה + 2 חלבונים, רבע אבוקדו, עגבניות שרי. אפשר בולגרית 5% בפנים.',
    ingredients: [
      { name: 'ביצים', qty: '2', unit: 'יח׳', category: 'חלבונים' },
      { name: 'אבוקדו', qty: '1', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'עגבניות שרי', qty: '1', unit: 'קופסה', category: 'ירקות ופירות' },
      { name: 'גבינה בולגרית 5%', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
    ],
  },
  {
    name: 'יוגורט פרו עם פרי ואגוזים',
    meal_types: ['breakfast'],
    tags: ['בריא', 'מהיר', 'חלבון גבוה'],
    notes: 'יוגורט פרו, קיווי או תותים, חופן אגוזי מלך.',
    ingredients: [
      { name: 'יוגורט פרו', qty: '4', unit: 'יח׳', category: 'מוצרי חלב' },
      { name: 'קיווי', qty: '4', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'אגוזי מלך', qty: '1', unit: 'שקית', category: 'יבשים ומזווה' },
    ],
  },
  {
    name: 'שקשוקה עם בולגרית',
    meal_types: ['breakfast', 'dinner'],
    tags: ['בריא', 'צמחוני'],
    notes: 'עגבניות, גמבה, ביצים, מעל בולגרית. אפשר להוסיף חציל.',
    ingredients: [
      { name: 'עגבניות', qty: '5', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'פלפל אדום (גמבה)', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'ביצים', qty: '4', unit: 'יח׳', category: 'חלבונים' },
      { name: 'גבינה בולגרית 5%', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
    ],
  },
  {
    name: 'דייסת שיבולת שועל',
    meal_types: ['breakfast'],
    tags: ['מהיר', 'צמחוני'],
    ingredients: [
      { name: 'שיבולת שועל', qty: '1', unit: 'שקית', category: 'יבשים ומזווה' },
      { name: 'חלב', qty: '1', unit: 'ליטר', category: 'מוצרי חלב' },
      { name: 'בננה', qty: '3', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },

  // ---- בית ספר ----
  {
    name: 'כריך גבינה וירקות',
    meal_types: ['school'],
    tags: ['מהיר'],
    ingredients: [
      { name: 'לחם מלא', qty: '1', unit: 'כיכר', category: 'יבשים ומזווה' },
      { name: 'גבינה צהובה', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
      { name: 'מלפפון', qty: '4', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'פיתה עם ממרח וחיתוכי ירק',
    meal_types: ['school'],
    tags: ['מהיר'],
    ingredients: [
      { name: 'פיתות', qty: '1', unit: 'חבילה', category: 'יבשים ומזווה' },
      { name: 'גבינת שמנת', qty: '1', unit: 'גביע', category: 'מוצרי חלב' },
      { name: 'גזר', qty: '4', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'מאפין ביצה וירקות',
    meal_types: ['school', 'breakfast'],
    tags: ['הכנה מראש', 'חלבון גבוה'],
    notes: 'אופים מראש מגש, נשמר 3 ימים במקרר.',
    ingredients: [
      { name: 'ביצים', qty: '6', unit: 'יח׳', category: 'חלבונים' },
      { name: 'תרד עלים', qty: '1', unit: 'שקית', category: 'ירקות ופירות' },
      { name: 'גבינה מגוררת', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
    ],
  },
  {
    name: 'בורקס גבינה (פינוק)',
    meal_types: ['school'],
    tags: ['פינוק'],
    ingredients: [
      { name: 'בצק עלים', qty: '1', unit: 'חבילה', category: 'קפואים' },
      { name: 'גבינה לבנה', qty: '1', unit: 'גביע', category: 'מוצרי חלב' },
    ],
  },

  // ---- צהריים (ילדים בבית / סלט לעבודה) ----
  {
    name: 'סלט טונה',
    meal_types: ['lunch', 'dinner'],
    tags: ['בריא', 'מהיר', 'חלבון גבוה'],
    notes: 'טונה במים, שמן זית, מלפפון חמוץ, גמבה, צלפים, בצל. על חסה או גמבה.',
    ingredients: [
      { name: 'טונה במים', qty: '2', unit: 'קופסה', category: 'יבשים ומזווה' },
      { name: 'מלפפון חמוץ', qty: '1', unit: 'צנצנת', category: 'יבשים ומזווה' },
      { name: 'פלפל אדום (גמבה)', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'חסה', qty: '1', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'אורז עם עוף וירקות',
    meal_types: ['lunch', 'dinner'],
    tags: [],
    ingredients: [
      { name: 'אורז', qty: '1', unit: 'שקית', category: 'יבשים ומזווה' },
      { name: 'חזה עוף', qty: '500', unit: 'גרם', category: 'חלבונים' },
      { name: 'אפונה וגזר קפואים', qty: '1', unit: 'שקית', category: 'קפואים' },
    ],
  },
  {
    name: 'פסטה ברוטב עגבניות',
    meal_types: ['lunch', 'dinner'],
    tags: ['צמחוני', 'פינוק'],
    ingredients: [
      { name: 'פסטה', qty: '1', unit: 'חבילה', category: 'יבשים ומזווה' },
      { name: 'רסק עגבניות', qty: '1', unit: 'צנצנת', category: 'יבשים ומזווה' },
      { name: 'פרמזן', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
    ],
  },

  // ---- ערב (משפחתי + של גלעד) ----
  {
    name: 'מוקפץ אורז-אטריות עם עוף',
    meal_types: ['dinner'],
    tags: ['בריא', 'חלבון גבוה'],
    notes: 'אטריות אורז, גמבה, זוקיני, בצל, כרוב, ביצה מקושקשת, חזה עוף/טופו. רוטב סויה + חמאת בוטנים.',
    ingredients: [
      { name: 'אטריות אורז', qty: '1', unit: 'חבילה', category: 'יבשים ומזווה' },
      { name: 'חזה עוף', qty: '500', unit: 'גרם', category: 'חלבונים' },
      { name: 'זוקיני', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'כרוב', qty: '1', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'רוטב סויה', qty: '1', unit: 'בקבוק', category: 'יבשים ומזווה' },
      { name: 'חמאת בוטנים', qty: '1', unit: 'צנצנת', category: 'יבשים ומזווה' },
    ],
  },
  {
    name: 'שניצל ביתי עם סלט',
    meal_types: ['dinner'],
    tags: ['חלבון גבוה'],
    notes: 'שניצל חזה עוף שגלעד מכין, עם טורטייה וגוואקמולי.',
    ingredients: [
      { name: 'חזה עוף', qty: '700', unit: 'גרם', category: 'חלבונים' },
      { name: 'פירורי לחם', qty: '1', unit: 'חבילה', category: 'יבשים ומזווה' },
      { name: 'ביצים', qty: '2', unit: 'יח׳', category: 'חלבונים' },
      { name: 'אבוקדו', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'פורטובלו ממולא גבינות',
    meal_types: ['dinner'],
    tags: ['בריא', 'צמחוני'],
    ingredients: [
      { name: 'פטריות פורטובלו', qty: '6', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'גבינת חמד 9%', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
      { name: 'פרמזן', qty: '1', unit: 'חבילה', category: 'מוצרי חלב' },
    ],
  },
  {
    name: 'תרד מוקפץ עם פטריות וביצה',
    meal_types: ['dinner'],
    tags: ['בריא', 'מהיר', 'צמחוני'],
    ingredients: [
      { name: 'תרד עלים', qty: '2', unit: 'שקית', category: 'ירקות ופירות' },
      { name: 'פטריות', qty: '1', unit: 'חבילה', category: 'ירקות ופירות' },
      { name: 'ביצים', qty: '3', unit: 'יח׳', category: 'חלבונים' },
      { name: 'שום', qty: '1', unit: 'ראש', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'סיר ירקות מבושלים עם טופו',
    meal_types: ['dinner'],
    tags: ['בריא', 'הכנה מראש', 'נשמר טוב', 'צמחוני'],
    notes: 'ברוקולי וכרובית עד "פירה". מקפיצים טופו בדקה וחצי ומוסיפים.',
    ingredients: [
      { name: 'ברוקולי קפוא', qty: '1', unit: 'שקית', category: 'קפואים' },
      { name: 'כרובית קפואה', qty: '1', unit: 'שקית', category: 'קפואים' },
      { name: 'טופו', qty: '2', unit: 'חבילה', category: 'חלבונים' },
    ],
  },
  {
    name: 'מרק עדשים',
    meal_types: ['dinner'],
    tags: ['הכנה מראש', 'נשמר טוב', 'צמחוני'],
    ingredients: [
      { name: 'עדשים כתומות', qty: '1', unit: 'שקית', category: 'יבשים ומזווה' },
      { name: 'גזר', qty: '4', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'בצל', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'תפוח אדמה', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'דג בתנור עם ירקות שורש',
    meal_types: ['dinner'],
    tags: ['בריא', 'חלבון גבוה'],
    ingredients: [
      { name: 'פילה דג', qty: '600', unit: 'גרם', category: 'חלבונים' },
      { name: 'בטטה', qty: '3', unit: 'יח׳', category: 'ירקות ופירות' },
      { name: 'לימון', qty: '2', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'המבורגר בקר עם סלט',
    meal_types: ['dinner'],
    tags: ['פינוק', 'חלבון גבוה'],
    ingredients: [
      { name: 'בשר טחון', qty: '600', unit: 'גרם', category: 'חלבונים' },
      { name: 'לחמניות', qty: '1', unit: 'חבילה', category: 'יבשים ומזווה' },
      { name: 'עגבניה', qty: '3', unit: 'יח׳', category: 'ירקות ופירות' },
    ],
  },
  {
    name: 'כדורי פלאפל עם סלט',
    meal_types: ['dinner', 'lunch'],
    tags: ['צמחוני', 'פינוק'],
    ingredients: [
      { name: 'פלאפל קפוא', qty: '1', unit: 'שקית', category: 'קפואים' },
      { name: 'טחינה גולמית', qty: '1', unit: 'צנצנת', category: 'יבשים ומזווה' },
      { name: 'ירקות לסלט', qty: '1', unit: 'מארז', category: 'ירקות ופירות' },
    ],
  },
]
