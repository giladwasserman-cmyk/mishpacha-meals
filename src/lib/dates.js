// שבוע מתחיל ביום ראשון (0). מתכננים א–ה.

export function startOfWeek(d = new Date()) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const diff = date.getDay() // 0=ראשון
  date.setDate(date.getDate() - diff)
  return date
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function toISODate(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatRange(weekStart) {
  const s = new Date(weekStart)
  const e = addDays(s, 4) // חמישי
  const f = (d) => `${d.getDate()}.${d.getMonth() + 1}`
  return `${f(s)}–${f(e)}`
}
