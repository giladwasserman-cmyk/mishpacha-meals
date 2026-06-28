import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { loadState, saveState, subscribe, isCentral } from "./storage";
import { HebrewCalendar, flags } from "@hebcal/core";

/* ====================== קבועים ====================== */
const STORAGE_KEY = "unit_mgmt_v2";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
const SHIFTS = [
  { id: "morning", label: "בוקר", icon: "☀️" },
  { id: "evening", label: "ערב", icon: "🌙" },
  { id: "allday", label: "כל היום", icon: "◎" },
];

const TYPES = [
  { id: "clinicA", label: "מרפאה — מתחם א׳", kind: "clinic", color: "#0E7C7B" },
  { id: "clinicB", label: "מרפאה — מתחם ב׳", kind: "clinic", color: "#2A9D8F" },
  { id: "or", label: "חדר ניתוח", color: "#B5485D" },
  { id: "imaging", label: "חדר צילומים", color: "#5B5F97" },
  { id: "consult", label: "ייעוצים", color: "#C97B2D" },
  { id: "semRes", label: "סמינר מתמחים", kind: "seminar", color: "#7A5CA8" },
  { id: "semUnit", label: "סמינר יחידה", kind: "seminar", color: "#3D5A80" },
  { id: "research", label: "פעילות מחקר", color: "#56707F" },
  { id: "conf", label: "כנס / השתלמות", color: "#1F7A8C" },
  { id: "team", label: "יום גיבוש / רווחה", color: "#C9468B" },
  { id: "other", label: "אחר", color: "#64748B" },
];

const RECUR = [
  { id: "weekly", label: "שבועי" },
  { id: "biweekly", label: "דו־שבועי" },
  { id: "monthly", label: "חודשי" },
  { id: "once", label: "חד־פעמי" },
];

const ROLES = ["מנהל/ת יחידה", "סגן מנהל", "רופא/ה בכיר/ה", "מתמחה"];

const TASK_STATUS = [
  { id: "open", label: "פתוחה", color: "#C97B2D" },
  { id: "progress", label: "בתהליך", color: "#3D5A80" },
  { id: "done", label: "הושלמה", color: "#2A7D4F" },
];

const STUDY_STATUS = ["תכנון", 'הגשה לוועדת הלסינקי', "מאושר — גיוס", "איסוף נתונים", "ניתוח", "כתיבה", "הוגש לפרסום", "פורסם"];
const STUDENT_STATUS = ["הגדרת נושא", "סקירת ספרות", "איסוף נתונים", "ניתוח וכתיבה", "הוגש", "הסתיים"];
const ABSENCE_KINDS = ["חופשה", "מחלה", "כנס/השתלמות", "מילואים", "אחר"];

const DEFAULT_STAFF = [
  { id: "s1", name: "מנהלת היחידה", role: "מנהל/ת יחידה", color: "#3D5A80" },
  { id: "s2", name: "סגן מנהל", role: "סגן מנהל", color: "#0E7C7B" },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: "s" + (i + 3),
    name: `רופא/ה בכיר/ה ${i + 1}`,
    role: "רופא/ה בכיר/ה",
    color: ["#B5485D", "#C97B2D", "#7A5CA8", "#2A9D8F", "#5B5F97", "#8A6D3B", "#56707F", "#A0527C"][i],
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: "s" + (i + 11),
    name: `מתמחה ${i + 1}`,
    role: "מתמחה",
    color: ["#6B8E23", "#4682B4", "#9370DB", "#CD853F"][i],
  })),
];

/* ====================== עזרי תאריכים ====================== */
const MS_DAY = 86400000;
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function weekStart(d) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt(d) { return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }); }
function fmtFull(d) { return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }); }
function toISO(d) { const x = startOfDay(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; }
function parseISO(s) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
/* שעת התחלה מתוך טקסט חופשי (למיון כרונולוגי). ללא שעה — בסוף. */
function startMin(ev) {
  const m = (ev.timeText || "").match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : 9999;
}
function ovKey(eventId, date) { return eventId + "|" + toISO(date); }

/* ----- חגים: יהודיים (hebcal) + מוסלמיים (אום אל-קורא) + דרוזיים ----- */
const DEFAULT_HOLIDAY_SETS = { jewish: true, muslim: true, druze: true };
const _holCache = {};
function computeHolidays(year, sets) {
  const sig = year + "|" + (sets.jewish ? 1 : 0) + (sets.muslim ? 1 : 0) + (sets.druze ? 1 : 0);
  if (_holCache[sig]) return _holCache[sig];
  const map = {};
  const add = (iso, name, tradition, opts = {}) => {
    const e = map[iso] || { name, traditions: [], major: false, erev: false };
    if (!e.traditions.includes(tradition)) e.traditions.push(tradition);
    if (opts.major) e.major = true;
    if (opts.erev) e.erev = true;
    if (!map[iso]) e.name = name;
    map[iso] = e;
  };
  if (sets.jewish) {
    try {
      const evs = HebrewCalendar.calendar({ year, isHebrewYear: false, il: true, sedrot: false, omer: false, candlelighting: false });
      for (const ev of evs) {
        const f = ev.getFlags();
        const major = Boolean(f & flags.CHAG) && !(f & flags.CHOL_HAMOED);
        const erev = Boolean(f & flags.EREV);
        const chm = Boolean(f & flags.CHOL_HAMOED);
        const fast = Boolean(f & flags.MAJOR_FAST);
        if (!(major || erev || chm || fast)) continue;
        add(toISO(ev.getDate().greg()), ev.render("he"), "jewish", { major, erev });
      }
    } catch (e) { console.error("jewish holidays", e); }
  }
  if (sets.muslim || sets.druze) {
    try {
      const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric" });
      const hijri = (d) => { const o = {}; for (const p of fmt.formatToParts(d)) if (p.type !== "literal") o[p.type] = parseInt(p.value); return o; };
      for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
        const h = hijri(d); const iso = toISO(d); const md = h.month + "-" + h.day;
        if (h.month === 12 && h.day >= 10 && h.day <= 13) {
          if (sets.muslim) add(iso, "עיד אל-אדחא", "muslim");
          if (sets.druze) add(iso, "עיד אל-אדחא", "druze");
        } else if (sets.muslim) {
          if (h.month === 10 && h.day >= 1 && h.day <= 3) add(iso, "עיד אל-פיטר", "muslim");
          else if (md === "1-1") add(iso, "ראש השנה ההיג׳רי", "muslim");
          else if (md === "3-12") add(iso, "מולד א-נבי (יום הולדת הנביא)", "muslim");
          else if (md === "9-1") add(iso, "תחילת רמדאן", "muslim");
        }
      }
    } catch (e) { console.error("muslim holidays", e); }
  }
  if (sets.druze) {
    add(toISO(new Date(year, 3, 25)), "זיארת א-נבי שועייב", "druze");
  }
  _holCache[sig] = map;
  return map;
}
function holidayInfo(date, sets) {
  return computeHolidays(date.getFullYear(), sets || DEFAULT_HOLIDAY_SETS)[toISO(date)] || null;
}
function holTagClass(hol) {
  if (hol.major) return "major";
  if (hol.traditions?.includes("muslim")) return "muslim";
  if (hol.traditions?.includes("druze")) return "druze";
  return "jewish";
}

/* ----- ימי הולדת ----- */
function birthdaysOnDate(date, staff) {
  return (staff || []).filter(s => s.birthday && (() => { const b = parseISO(s.birthday); return b && b.getMonth() === date.getMonth() && b.getDate() === date.getDate(); })());
}
function nextBirthdayDate(iso, fromDate) {
  const b = parseISO(iso); if (!b) return null;
  let d = new Date(fromDate.getFullYear(), b.getMonth(), b.getDate());
  if (startOfDay(d) < startOfDay(fromDate)) d = new Date(fromDate.getFullYear() + 1, b.getMonth(), b.getDate());
  return d;
}

/* ----- ביטול אוטומטי + שעות עבודה + חדרים ----- */
const SHIFT_DEFAULT_HOURS = { morning: 5, evening: 4, allday: 8 };
function eventHours(ev) {
  const times = (ev.timeText || "").match(/(\d{1,2}):(\d{2})/g);
  if (times && times.length >= 2) {
    const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
    let d = (toMin(times[1]) - toMin(times[0])) / 60;
    if (d < 0) d += 24;
    if (d > 0 && d <= 16) return d;
  }
  return SHIFT_DEFAULT_HOURS[ev.shift] ?? 0;
}
// ביטול בפועל: ביטול ידני, או אחראי/ת בחופשה (ביטול אוטומטי של המשמרת)
function effectiveCancel(ev, date, overrides, absences) {
  const ov = (overrides || {})[ovKey(ev.id, date)] || {};
  if (ov.cancelled) return { cancelled: true, auto: false, reason: "מבוטל" };
  if (ev.responsibleId && isAbsent(ev.responsibleId, date, absences)) return { cancelled: true, auto: true, reason: "אחראי/ת בחופשה" };
  return { cancelled: false, auto: false, reason: "" };
}
function evRooms(ev) { const n = parseInt(ev.rooms); return Number.isFinite(n) && n > 0 ? n : 1; }

/* ----- היעדרויות ----- */
function isAbsent(staffId, date, absences) {
  if (!staffId) return false;
  const iso = toISO(date);
  return (absences || []).some(a => a.staffId === staffId && iso >= a.startDate && iso <= a.endDate);
}
function absencesOnDate(date, absences) {
  const iso = toISO(date);
  return (absences || []).filter(a => iso >= a.startDate && iso <= a.endDate);
}

/* ----- רשת חודשית ----- */
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthGrid(anchor) {
  const first = monthStart(anchor);
  const start = weekStart(first); // ראשון של השבוע הראשון
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  return cells;
}
function weeksFromToday(date) {
  return Math.round((weekStart(date) - weekStart(new Date())) / (7 * MS_DAY));
}
const HE_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

/* ייצוא ה-PDF השבועי כקובץ להורדה (עובד בכל דפדפן) */
async function exportWeekPdf(ws) {
  const area = document.querySelector(".print-area");
  if (!area) return;
  const header = area.querySelector(".print-header");
  const prevDisplay = header ? header.style.display : "";
  if (header) header.style.display = "flex";
  try {
    const canvas = await html2canvas(area, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const ratio = canvas.height / canvas.width;
    let imgW = pw - margin * 2;
    let imgH = imgW * ratio;
    if (imgH > ph - margin * 2) { imgH = ph - margin * 2; imgW = imgH / ratio; }
    pdf.addImage(img, "PNG", (pw - imgW) / 2, margin, imgW, imgH);
    pdf.save(`weekly-plan-${toISO(ws)}.pdf`);
  } catch (e) {
    console.error("ייצוא PDF נכשל, מנסה הדפסה", e);
    window.print();
  } finally {
    if (header) header.style.display = prevDisplay;
  }
}

/* האם אירוע מתקיים בשבוע המוצג, ובאיזה יום */
function eventOccursOnDate(ev, date) {
  const anchor = parseISO(ev.anchorDate);
  const end = parseISO(ev.endDate);
  if (end && startOfDay(date) > end) return false;
  if (ev.recurrence === "once") {
    if (!anchor) return false;
    const d = startOfDay(date).getTime();
    if (end) return d >= anchor.getTime(); // טווח רב-יומי (כנס/גיבוש); הגבול העליון נבדק למעלה
    return d === anchor.getTime();
  }
  if (anchor && startOfDay(date) < anchor) return false;
  if (date.getDay() !== ev.day) return false;
  if (ev.recurrence === "weekly") return true;
  if (ev.recurrence === "biweekly") {
    if (!anchor) return true;
    const diff = Math.round((weekStart(date) - weekStart(anchor)) / (7 * MS_DAY));
    return diff >= 0 && diff % 2 === 0;
  }
  if (ev.recurrence === "monthly") {
    if (!anchor) return true;
    const nthAnchor = Math.ceil(anchor.getDate() / 7);
    const nthThis = Math.ceil(date.getDate() / 7);
    return nthThis === nthAnchor;
  }
  return false;
}

/* ====================== אחסון ====================== */
function useStoredState() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const ignoreNext = useRef(false);

  function normalize(base) {
    if (!base.types) base.types = TYPES;
    if (!base.studyStatuses) base.studyStatuses = STUDY_STATUS;
    if (!base.studentStatuses) base.studentStatuses = STUDENT_STATUS;
    base.students = (base.students || []).map(s =>
      s.mentorIds ? s : { ...s, mentorIds: s.mentorId ? [s.mentorId] : [] });
    if (!base.overrides) base.overrides = {};
    if (!base.absences) base.absences = [];
    if (!base.holidaySets) base.holidaySets = { jewish: true, muslim: true, druze: true };
    if (base.editPassword === undefined) base.editPassword = "1234";
    return base;
  }

  useEffect(() => {
    (async () => {
      let data = null;
      try { data = await loadState(); } catch (e) { console.error(e); }
      const base = data || {
        unitName: "היחידה לרפואת הפה",
        staff: DEFAULT_STAFF,
        events: [],
        tasks: [],
        studies: [],
        students: [],
      };
      setState(normalize(base));
      setLoaded(true);
    })();

    // עדכונים בזמן אמת מאנשי צוות אחרים (במצב אחסון מרכזי)
    const unsub = subscribe((remote) => {
      ignoreNext.current = true;
      setState(normalize({ ...remote }));
    });
    return unsub;
  }, []);

  const update = useCallback((patch) => {
    setState(prev => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveState(next).catch(e => console.error("שמירה נכשלה", e));
      }, 600);
      return next;
    });
  }, []);

  return [state, update, loaded];
}

/* ====================== רכיבים קטנים ====================== */
function Chip({ children, color, outline }) {
  return (
    <span className="chip" style={outline
      ? { border: `1px solid ${color}`, color }
      : { background: color + "1A", color }}>
      {children}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ====================== טופס אירוע ====================== */
function EventForm({ initial, staff, types, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || {
    title: "", type: types[0]?.id || "clinicA", day: 0, shift: "morning",
    recurrence: "weekly", anchorDate: "", endDate: "",
    responsibleId: "", participants: [], timeText: "", rooms: 1, notes: "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const type = types.find(t => t.id === f.type);
  const isClinic = type?.kind === "clinic";
  const seniors = staff.filter(s => s.role !== "מתמחה");
  const needsAnchor = f.recurrence !== "weekly";
  const fridaySelected = f.recurrence === "weekly"
    ? f.day === 5
    : (f.anchorDate && parseISO(f.anchorDate)?.getDay() === 5);

  const toggleParticipant = (id) =>
    set("participants", f.participants.includes(id)
      ? f.participants.filter(p => p !== id)
      : [...f.participants, id]);

  const save = () => {
    if (!f.title.trim() && !isClinic) { alert("יש להזין שם לאירוע"); return; }
    if (needsAnchor && !f.anchorDate) { alert("יש לבחור תאריך מופע ראשון"); return; }
    const out = { ...f };
    if (!out.title.trim() && isClinic) out.title = type.label;
    if (needsAnchor) out.day = parseISO(out.anchorDate).getDay();
    if (out.day === 5 && out.shift === "evening") { alert("אין פעילות ערב ביום שישי"); return; }
    onSave(out);
  };

  useEffect(() => {
    if (fridaySelected && f.shift === "evening") set("shift", "morning");
  }, [fridaySelected]);

  return (
    <Modal title={initial?.id ? "עריכת אירוע" : "אירוע חדש"} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="סוג פעילות">
          <select value={f.type} onChange={e => set("type", e.target.value)}>
            {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="שם / כותרת" hint={isClinic ? "אפשר להשאיר ריק — יוצג שם המתחם" : ""}>
          <input value={f.title} onChange={e => set("title", e.target.value)} placeholder={isClinic ? type.label : "לדוגמה: סמינר ICOP"} />
        </Field>
        <Field label="תדירות">
          <select value={f.recurrence} onChange={e => set("recurrence", e.target.value)}>
            {RECUR.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        {f.recurrence === "weekly" ? (
          <Field label="יום בשבוע">
            <select value={f.day} onChange={e => set("day", Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={i} value={i}>יום {d}</option>)}
            </select>
          </Field>
        ) : (
          <Field label={f.recurrence === "once" ? "תאריך" : "תאריך מופע ראשון"}
            hint={f.recurrence === "monthly" ? "יחזור באותו יום בשבוע, באותו שבוע בחודש (למשל: יום שלישי השני בכל חודש)" : f.recurrence === "biweekly" ? "יחזור כל שבועיים מתאריך זה" : ""}>
            <input type="date" value={f.anchorDate} onChange={e => set("anchorDate", e.target.value)} />
          </Field>
        )}
        <Field label="משמרת" hint={fridaySelected ? "ביום שישי אין משמרת ערב" : ""}>
          <select value={f.shift} onChange={e => set("shift", e.target.value)}>
            {SHIFTS.filter(s => !(fridaySelected && s.id === "evening")).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="שעות (טקסט חופשי)" hint="לחישוב שעות עבודה הזינו טווח, למשל 08:00–13:00">
          <input value={f.timeText} onChange={e => set("timeText", e.target.value)} placeholder="לדוגמה: 08:00–13:00" />
        </Field>
        <Field label="מספר חדרים בשימוש" hint="כמה חדרים תופסת הפעילות (למונה החדרים)">
          <input type="number" min="1" max="20" value={f.rooms ?? 1} onChange={e => set("rooms", parseInt(e.target.value) || 1)} />
        </Field>
        <Field label={isClinic ? "בכיר/ה אחראי/ת על המשמרת" : "אחראי/ת"}
          hint={isClinic ? "אחריות על פעילות המתחם במשמרת זו" : ""}>
          <select value={f.responsibleId} onChange={e => set("responsibleId", e.target.value)}>
            <option value="">— ללא —</option>
            {seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="תאריך סיום (אופציונלי)" hint="האירוע יפסיק להופיע אחרי תאריך זה">
          <input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} />
        </Field>
      </div>
      <Field label="משתתפים נוספים">
        <div className="pick-grid">
          {staff.map(s => (
            <button key={s.id} type="button"
              className={"pick" + (f.participants.includes(s.id) ? " on" : "")}
              style={f.participants.includes(s.id) ? { borderColor: s.color, background: s.color + "14" } : {}}
              onClick={() => toggleParticipant(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="הערות">
        <textarea rows={2} value={f.notes} onChange={e => set("notes", e.target.value)} />
      </Field>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => { if (confirm("למחוק את האירוע?")) onDelete(initial.id); }}>מחיקה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={save}>שמירה</button>
      </div>
    </Modal>
  );
}

/* ====================== הלוח השבועי ====================== */
/* ייצוא אלמנט כלשהו ל-PDF (A4 לרוחב) */
async function captureToPdf(el, filename) {
  if (!el) return;
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const ratio = canvas.height / canvas.width;
    let imgW = pw - margin * 2;
    let imgH = imgW * ratio;
    if (imgH > ph - margin * 2) { imgH = ph - margin * 2; imgW = imgH / ratio; }
    pdf.addImage(img, "PNG", (pw - imgW) / 2, margin, imgW, imgH);
    pdf.save(filename);
  } catch (e) { console.error("PDF export failed", e); window.print(); }
}

/* ====================== הלוח השבועי ====================== */
function WeekBoard({ state, update, weekOffset, setWeekOffset, canEdit = true }) {
  const [editing, setEditing] = useState(null);
  const [occMenu, setOccMenu] = useState(null);
  const [viewMode, setViewMode] = useState("week");
  const [dayOffset, setDayOffset] = useState(0);
  const [personPick, setPersonPick] = useState(false);
  const [personExport, setPersonExport] = useState(null);
  const overrides = state.overrides || {};
  const absences = state.absences || [];
  const setOverride = (eventId, date, patch) => {
    const key = ovKey(eventId, date);
    update(p => {
      const ovs = { ...(p.overrides || {}) };
      const merged = { ...(ovs[key] || {}), ...patch };
      const empty = !merged.cancelled && !(merged.note && merged.note.trim()) && !merged.presenterId && !(merged.topic && merged.topic.trim());
      if (empty) delete ovs[key];
      else ovs[key] = merged;
      return { ...p, overrides: ovs };
    });
  };
  const ws = addDays(weekStart(new Date()), weekOffset * 7);
  const today = startOfDay(new Date());
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));

  const occByDay = useMemo(() => {
    return DAYS.map((_, i) => {
      const date = addDays(ws, i);
      const evs = state.events.filter(ev => eventOccursOnDate(ev, date));
      const order = { morning: 0, allday: 1, evening: 2 };
      evs.sort((a, b) => (order[a.shift] - order[b.shift]) || (startMin(a) - startMin(b)) || (a.title || "").localeCompare(b.title || ""));
      return { date, evs };
    });
  }, [state.events, ws.getTime()]);

  const coverage = useMemo(() => {
    const gaps = [];
    occByDay.forEach(({ date, evs }, di) => {
      if (holidayInfo(date, state.holidaySets)?.major) return;
      evs.forEach(ev => {
        if (effectiveCancel(ev, date, overrides, absences).cancelled) return;
        const t = state.types.find(x => x.id === ev.type);
        if (t?.kind !== "clinic") return;
        if (!ev.responsibleId) gaps.push(`${t.label} — יום ${DAYS[di]} (אין אחראי/ת)`);
      });
    });
    return gaps;
  }, [occByDay, state.types, absences]);

  const weekAbsences = useMemo(() => {
    const wEnd = toISO(addDays(ws, 5)), wStart = toISO(ws);
    return absences.filter(a => a.startDate <= wEnd && a.endDate >= wStart);
  }, [absences, ws.getTime()]);

  const selectedDay = startOfDay(addDays(today, dayOffset));
  const dayEvs = useMemo(() => {
    const order = { morning: 0, allday: 1, evening: 2 };
    return state.events.filter(ev => eventOccursOnDate(ev, selectedDay))
      .sort((a, b) => (order[a.shift] - order[b.shift]) || (startMin(a) - startMin(b)) || (a.title || "").localeCompare(b.title || ""));
  }, [state.events, selectedDay.getTime()]);
  const dayAbsences = absencesOnDate(selectedDay, absences);
  const dayCoverage = useMemo(() => {
    if (holidayInfo(selectedDay, state.holidaySets)?.major) return [];
    const gaps = [];
    dayEvs.forEach(ev => {
      if (effectiveCancel(ev, selectedDay, overrides, absences).cancelled) return;
      const t = state.types.find(x => x.id === ev.type);
      if (t?.kind !== "clinic") return;
      if (!ev.responsibleId) gaps.push(`${t.label} (אין אחראי/ת)`);
    });
    return gaps;
  }, [dayEvs, state.types, absences]);

  const saveEvent = (ev) => {
    update(p => ({ ...p, events: ev.id ? p.events.map(e => e.id === ev.id ? ev : e) : [...p.events, { ...ev, id: "e" + Date.now() }] }));
    setEditing(null);
  };
  const deleteEvent = (id) => { update(p => ({ ...p, events: p.events.filter(e => e.id !== id) })); setEditing(null); };

  useEffect(() => {
    if (!personExport) return;
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        captureToPdf(document.getElementById("person-print-area"),
          `personal-${personExport}-${toISO(ws)}.pdf`).then(() => setPersonExport(null));
      }, 60);
    });
    return () => cancelAnimationFrame(id);
  }, [personExport]);

  const monthAnchor = ws;
  const goMonth = (delta) => setWeekOffset(weeksFromToday(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1)));

  // מונה חדרים בשימוש ליום, מקובץ לפי סוג פעילות (לא כולל מבוטלים)
  const roomsForDay = (date, evs) => {
    const by = {};
    evs.forEach(ev => {
      if (effectiveCancel(ev, date, overrides, absences).cancelled) return;
      const t = state.types.find(x => x.id === ev.type);
      if (!t) return;
      by[t.id] = (by[t.id] || 0) + evRooms(ev);
    });
    return Object.entries(by).map(([id, n]) => ({ type: state.types.find(x => x.id === id), n }));
  };
  const totalRooms = (date, evs) => evs.reduce((s, ev) => effectiveCancel(ev, date, overrides, absences).cancelled ? s : s + evRooms(ev), 0);

  const SectionFor = (date) => ({ list, label, cls }) => (
    <div className={"shift-block " + cls}>
      <div className="shift-label">{label}</div>
      {list.length === 0 && <div className="empty-slot">—</div>}
      {list.map(ev => {
        const t = state.types.find(x => x.id === ev.type) || { label: "אחר", color: "#64748B" };
        const resp = staffById[ev.responsibleId];
        const recur = RECUR.find(r => r.id === ev.recurrence);
        const ov = overrides[ovKey(ev.id, date)] || {};
        const ec = effectiveCancel(ev, date, overrides, absences);
        const respAbsent = ev.responsibleId && isAbsent(ev.responsibleId, date, absences);
        const presenter = ov.presenterId ? staffById[ov.presenterId] : null;
        return (
          <div key={ev.id} className={"event-card" + (ec.cancelled ? " cancelled" : "") + (canEdit ? "" : " readonly")} style={{ borderInlineStartColor: t.color }}
            onClick={canEdit ? () => setOccMenu({ ev, date }) : undefined}>
            <div className="ev-title">{ev.title || t.label}</div>
            <div className="ev-type" style={{ color: t.color }}>{t.label}{ev.timeText ? ` · ${ev.timeText}` : ""}{evRooms(ev) > 1 ? ` · ${evRooms(ev)} חדרים` : ""}</div>
            {resp && <div className={"ev-resp" + (respAbsent ? " warn" : "")}>אחראי/ת: <b>{resp.name}</b>{respAbsent ? " · בחופשה" : ""}</div>}
            {t.kind === "seminar" && (presenter || ov.topic) && (
              <div className="ev-seminar">{presenter ? `מציג/ה: ${presenter.name}` : ""}{presenter && ov.topic ? " · " : ""}{ov.topic || ""}</div>
            )}
            {ev.participants?.length > 0 && (
              <div className="ev-people">{ev.participants.map(pid => staffById[pid]?.name).filter(Boolean).join(", ")}</div>
            )}
            {ec.cancelled && <span className="ev-cancel-badge">{ec.auto ? "מבוטל · חופשה" : "מבוטל"}</span>}
            {ov.note && <div className="ev-note">{ov.note}</div>}
            {ev.recurrence !== "weekly" && <span className="ev-recur">{recur.label}</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="board-toolbar no-print">
        <div className="week-nav">
          {viewMode === "day" && (
            <>
              <button className="icon-btn" onClick={() => setDayOffset(dayOffset + 1)} title="יום הבא">‹</button>
              <button className="btn ghost small" onClick={() => setDayOffset(0)}>היום</button>
              <button className="icon-btn" onClick={() => setDayOffset(dayOffset - 1)} title="יום קודם">›</button>
              <span className="week-range">{selectedDay.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </>
          )}
          {viewMode === "week" && (
            <>
              <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} title="שבוע הבא">‹</button>
              <button className="btn ghost small" onClick={() => setWeekOffset(0)}>השבוע</button>
              <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} title="שבוע קודם">›</button>
              <span className="week-range">{fmt(ws)} – {fmt(addDays(ws, 5))} · {ws.getFullYear()}</span>
            </>
          )}
          {viewMode === "month" && (
            <>
              <button className="icon-btn" onClick={() => goMonth(1)} title="חודש הבא">‹</button>
              <button className="btn ghost small" onClick={() => setWeekOffset(0)}>החודש</button>
              <button className="icon-btn" onClick={() => goMonth(-1)} title="חודש קודם">›</button>
              <span className="week-range">{HE_MONTHS[ws.getMonth()]} {ws.getFullYear()}</span>
            </>
          )}
        </div>
        <div className="toolbar-actions">
          <div className="seg">
            <button className={"seg-btn" + (viewMode === "day" ? " on" : "")} onClick={() => setViewMode("day")}>יומי</button>
            <button className={"seg-btn" + (viewMode === "week" ? " on" : "")} onClick={() => setViewMode("week")}>שבועי</button>
            <button className={"seg-btn" + (viewMode === "month" ? " on" : "")} onClick={() => setViewMode("month")}>חודשי</button>
          </div>
          {canEdit && <button className="btn primary" onClick={() => setEditing({})}>+ אירוע</button>}
          {viewMode === "week" && <button className="btn accent" onClick={() => exportWeekPdf(ws)}>⤓ PDF שבועי</button>}
          {viewMode === "day" && <button className="btn accent" onClick={() => captureToPdf(document.querySelector(".print-area"), `day-${toISO(selectedDay)}.pdf`)}>⤓ PDF יומי</button>}
          {viewMode === "week" && <button className="btn ghost" onClick={() => setPersonPick(true)}>⤓ PDF אישי</button>}
        </div>
      </div>

      {viewMode === "week" && coverage.length > 0 && (
        <div className="alert no-print"><strong>⚠ דורש שיבוץ:</strong> {coverage.join(" · ")}</div>
      )}
      {viewMode === "week" && weekAbsences.length > 0 && (
        <div className="absence-strip no-print">
          <strong>🏖 בחופשה השבוע:</strong> {weekAbsences.map(a => `${staffById[a.staffId]?.name || "?"} (${a.kind})`).join(" · ")}
        </div>
      )}
      {viewMode === "day" && dayCoverage.length > 0 && (
        <div className="alert no-print"><strong>⚠ דורש שיבוץ:</strong> {dayCoverage.join(" · ")}</div>
      )}
      {viewMode === "day" && dayAbsences.length > 0 && (
        <div className="absence-strip no-print">
          <strong>🏖 בחופשה היום:</strong> {dayAbsences.map(a => `${staffById[a.staffId]?.name || "?"} (${a.kind})`).join(" · ")}
        </div>
      )}

      {viewMode === "day" && (() => {
        const hol = holidayInfo(selectedDay, state.holidaySets);
        const Section = SectionFor(selectedDay);
        const di = selectedDay.getDay();
        const morning = dayEvs.filter(e => e.shift === "morning");
        const evening = dayEvs.filter(e => e.shift === "evening");
        const allday = dayEvs.filter(e => e.shift === "allday");
        const bdays = birthdaysOnDate(selectedDay, state.staff);
        return (
          <div className="print-area">
            <div className="print-header">
              <div>
                <div className="print-title">{state.unitName} — תכנית יומית</div>
                <div className="print-sub">{selectedDay.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              </div>
              <div className="print-stamp">הופק: {fmtFull(new Date())}</div>
            </div>
            <div className="day-single">
              {hol && <div className={"holiday-tag " + holTagClass(hol)}>{hol.name}</div>}
              {bdays.length > 0 && <div className="bday-tag">🎂 {bdays.map(s => s.name).join(", ")}</div>}
              {roomsForDay(selectedDay, dayEvs).length > 0 && (
                <div className="rooms-box">
                  <span className="rooms-box-title">🚪 חדרים בשימוש ({totalRooms(selectedDay, dayEvs)}):</span>
                  {roomsForDay(selectedDay, dayEvs).map(({ type, n }) => (
                    <span key={type.id} className="rooms-chip" style={{ background: type.color + "1A", color: type.color }}>{type.label}: {n}</span>
                  ))}
                </div>
              )}
              {allday.length > 0 && <Section list={allday} label="כל היום" cls="allday" />}
              <Section list={morning} label="☀️ בוקר" cls="morning" />
              {di !== 5 && <Section list={evening} label="🌙 ערב" cls="evening" />}
            </div>
          </div>
        );
      })()}

      {viewMode === "week" && (
        <div className="print-area">
          <div className="print-header">
            <div>
              <div className="print-title">{state.unitName} — תכנית פעילות שבועית</div>
              <div className="print-sub">{fmtFull(ws)} – {fmtFull(addDays(ws, 5))}</div>
            </div>
            <div className="print-stamp">הופק: {fmtFull(new Date())}</div>
          </div>
          <div className="board">
            {occByDay.map(({ date, evs }, di) => {
              const isToday = date.getTime() === today.getTime();
              const hol = holidayInfo(date, state.holidaySets);
              const Section = SectionFor(date);
              const morning = evs.filter(e => e.shift === "morning");
              const evening = evs.filter(e => e.shift === "evening");
              const allday = evs.filter(e => e.shift === "allday");
              return (
                <div key={di} className={"day-col" + (isToday ? " today" : "") + (hol?.major ? " holiday" : "")}>
                  <div className="day-head">
                    <span className="day-name">יום {DAYS[di]}</span>
                    <span className="day-date">{fmt(date)}</span>
                  </div>
                  {totalRooms(date, evs) > 0 && <div className="rooms-line">🚪 {totalRooms(date, evs)} חדרים</div>}
                  {hol && <div className={"holiday-tag " + holTagClass(hol)}>{hol.name}</div>}
                  {birthdaysOnDate(date, state.staff).length > 0 && <div className="bday-tag">🎂 {birthdaysOnDate(date, state.staff).map(s => s.name).join(", ")}</div>}
                  {allday.length > 0 && <Section list={allday} label="כל היום" cls="allday" />}
                  <Section list={morning} label="☀️ בוקר" cls="morning" />
                  {di !== 5 && <Section list={evening} label="🌙 ערב" cls="evening" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "month" && (
        <MonthView anchor={ws} state={state} overrides={overrides} absences={absences}
          onPickDay={(d) => { setDayOffset(Math.round((startOfDay(d) - today) / MS_DAY)); setViewMode("day"); }} />
      )}

      {editing !== null && (
        <EventForm initial={editing.id ? editing : null} staff={state.staff} types={state.types}
          onSave={saveEvent} onDelete={deleteEvent} onClose={() => setEditing(null)} />
      )}
      {occMenu && (
        <OccurrenceModal
          ev={occMenu.ev} date={occMenu.date}
          typeObj={state.types.find(x => x.id === occMenu.ev.type)}
          staff={state.staff}
          override={overrides[ovKey(occMenu.ev.id, occMenu.date)] || {}}
          onSet={(patch) => setOverride(occMenu.ev.id, occMenu.date, patch)}
          onEditSeries={() => { const ev = occMenu.ev; setOccMenu(null); setEditing(ev); }}
          onClose={() => setOccMenu(null)} />
      )}
      {personPick && (
        <Modal title="ייצוא PDF אישי" onClose={() => setPersonPick(false)}>
          <p className="muted" style={{ marginBottom: 12 }}>בחר/י איש צוות — יופק PDF של הלו״ז שלו לשבוע המוצג.</p>
          <div className="pick-grid">
            {state.staff.map(s => (
              <button key={s.id} className="pick" onClick={() => { setPersonPick(false); setPersonExport(s.id); }}>{s.name}</button>
            ))}
          </div>
        </Modal>
      )}
      {personExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,35,40,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>מכין PDF…</div>
      )}
      {personExport && (
        <div style={{ position: "absolute", left: -99999, top: 0 }}>
          <PersonWeekPrint state={state} ws={ws} docId={personExport} />
        </div>
      )}
    </div>
  );
}

/* ====================== תצוגה חודשית ====================== */
function MonthView({ anchor, state, overrides, absences, onPickDay }) {
  const cells = monthGrid(anchor);
  const month = anchor.getMonth();
  const today = startOfDay(new Date());
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  return (
    <div className="month-grid">
      {DAYS.map((d, i) => <div key={i} className="month-dow">{d}</div>)}
      {cells.map((date, idx) => {
        const inMonth = date.getMonth() === month;
        const isToday = date.getTime() === today.getTime();
        const hol = holidayInfo(date, state.holidaySets);
        const evs = state.events.filter(ev => eventOccursOnDate(ev, date) && !effectiveCancel(ev, date, overrides, absences).cancelled);
        evs.sort((a, b) => startMin(a) - startMin(b));
        const outToday = absencesOnDate(date, absences);
        return (
          <div key={idx} className={"month-cell" + (inMonth ? "" : " dim") + (isToday ? " today" : "") + (hol?.major ? " holiday" : "")}
            onClick={() => onPickDay(date)}>
            <div className="month-cell-head">
              <span className="mc-day">{date.getDate()}</span>
              {hol && <span className="mc-hol">{hol.major ? "🕎" : "•"}</span>}
            </div>
            {hol && <div className={"mc-holname " + holTagClass(hol)}>{hol.name}</div>}
            {birthdaysOnDate(date, state.staff).length > 0 && <div className="mc-out">🎂 {birthdaysOnDate(date, state.staff).map(s => s.name).join(", ")}</div>}
            {evs.slice(0, 4).map(ev => {
              const t = state.types.find(x => x.id === ev.type) || { color: "#64748B", label: "" };
              const tm = (ev.timeText || "").match(/\d{1,2}:\d{2}/);
              return <div key={ev.id} className="mc-ev" style={{ background: t.color + "1A", color: t.color }}>
                {tm ? tm[0] + " " : ""}{ev.title || t.label}
              </div>;
            })}
            {evs.length > 4 && <div className="mc-more">+{evs.length - 4}</div>}
            {outToday.length > 0 && <div className="mc-out">🏖 {outToday.map(a => staffById[a.staffId]?.name).filter(Boolean).join(", ")}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ====================== אזור הדפסה אישי ====================== */
function PersonWeekPrint({ state, ws, docId }) {
  const doc = state.staff.find(s => s.id === docId);
  const overrides = state.overrides || {};
  const days = DAYS.map((_, i) => {
    const date = addDays(ws, i);
    if (isAbsent(docId, date, state.absences)) return { date, evs: [], absent: true };
    const evs = state.events.filter(ev => {
      if (!eventOccursOnDate(ev, date)) return false;
      const ov = overrides[ovKey(ev.id, date)] || {};
      if (effectiveCancel(ev, date, overrides, state.absences).cancelled) return false;
      return ev.responsibleId === docId || (ev.participants || []).includes(docId) || ov.presenterId === docId;
    });
    evs.sort((a, b) => startMin(a) - startMin(b));
    return { date, evs, absent: false };
  });
  return (
    <div id="person-print-area" style={{ width: 1000, background: "#fff", padding: 18, fontFamily: "Assistant, sans-serif" }} dir="rtl">
      <div className="print-header" style={{ display: "flex", justifyContent: "space-between", borderBottom: "2.5px solid #0A5C5B", paddingBottom: 7, marginBottom: 10 }}>
        <div>
          <div className="print-title">{state.unitName} — לו״ז אישי: {doc?.name}</div>
          <div className="print-sub">{fmtFull(ws)} – {fmtFull(addDays(ws, 5))}</div>
        </div>
        <div className="print-stamp">הופק: {fmtFull(new Date())}</div>
      </div>
      <div className="board">
        {days.map(({ date, evs, absent }, di) => (
          <div key={di} className="day-col">
            <div className="day-head"><span className="day-name">יום {DAYS[di]}</span><span className="day-date">{fmt(date)}</span></div>
            <div className="shift-block morning">
              {absent && <div className="empty-slot">בחופשה</div>}
              {!absent && evs.length === 0 && <div className="empty-slot">—</div>}
              {!absent && evs.map(ev => {
                const t = state.types.find(x => x.id === ev.type) || { label: "אחר", color: "#64748B" };
                const ov = overrides[ovKey(ev.id, date)] || {};
                return (
                  <div key={ev.id} className="event-card" style={{ borderInlineStartColor: t.color }}>
                    <div className="ev-title">{ev.title || t.label}</div>
                    <div className="ev-type" style={{ color: t.color }}>{t.label}{ev.timeText ? ` · ${ev.timeText}` : ""}</div>
                    {ev.responsibleId === docId && <div className="ev-resp">אחראי/ת</div>}
                    {ov.topic && <div className="ev-seminar">נושא: {ov.topic}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================== תפריט מופע בודד ====================== */
function OccurrenceModal({ ev, date, typeObj, staff, override, onSet, onEditSeries, onClose }) {
  const [note, setNote] = useState(override.note || "");
  const [presenterId, setPresenterId] = useState(override.presenterId || "");
  const [topic, setTopic] = useState(override.topic || "");
  const cancelled = !!override.cancelled;
  const isSeminar = typeObj?.kind === "seminar";
  const residents = staff.filter(s => s.role === "מתמחה");
  return (
    <Modal title={(ev.title || typeObj?.label || "אירוע")} onClose={onClose}>
      <p className="muted" style={{ marginBottom: 14 }}>מופע בתאריך <b>{fmtFull(date)}</b>. שינוי כאן משפיע על תאריך זה בלבד — הסדרה הקבועה נשמרת.</p>
      {isSeminar && (
        <div className="form-grid">
          <Field label="מתמחה שמציג/ה">
            <select value={presenterId} onChange={e => setPresenterId(e.target.value)}>
              <option value="">— לא נקבע —</option>
              {residents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {staff.filter(s => s.role !== "מתמחה").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="נושא הסמינר"><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="לדוגמה: כאב אורופציאלי" /></Field>
        </div>
      )}
      <div className="occ-actions">
        {cancelled ? (
          <button className="btn primary" onClick={() => onSet({ cancelled: false })}>↺ שחזור המופע</button>
        ) : (
          <button className="btn danger" onClick={() => onSet({ cancelled: true })}>✕ ביטול המופע (חופשה / מחלה)</button>
        )}
      </div>
      <Field label="הערה למופע זה" hint="לדוגמה: ד״ר כהן בחופשה · מחליף: ד״ר לוי">
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
      </Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onEditSeries}>עריכת הסדרה כולה…</button>
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>סגירה</button>
        <button className="btn primary" onClick={() => { onSet({ note, presenterId: isSeminar ? presenterId : override.presenterId, topic: isSeminar ? topic : override.topic }); onClose(); }}>שמירה</button>
      </div>
    </Modal>
  );
}

/* ====================== רשימת אירועים ====================== */
function EventsTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const save = (ev) => {
    update(p => ({
      ...p,
      events: ev.id ? p.events.map(e => e.id === ev.id ? ev : e) : [...p.events, { ...ev, id: "e" + Date.now() }],
    }));
    setEditing(null);
  };
  const del = (id) => { update(p => ({ ...p, events: p.events.filter(e => e.id !== id) })); setEditing(null); };

  const grouped = state.types.map(t => ({ type: t, list: state.events.filter(e => e.type === t.id) })).filter(g => g.list.length);

  return (
    <div>
      <div className="tab-toolbar">
        <h2>כל האירועים הקבועים</h2>
        <button className="btn primary" onClick={() => setEditing({})}>+ אירוע חדש</button>
      </div>
      {state.events.length === 0 && <div className="empty-state">אין אירועים עדיין. הוסיפו את הפעילות הקבועה של היחידה — מרפאות, חדר ניתוח, סמינרים.</div>}
      {grouped.map(({ type, list }) => (
        <div key={type.id} className="group">
          <div className="group-title" style={{ color: type.color }}>{type.label}</div>
          <div className="rows">
            {list.map(ev => {
              const resp = staffById[ev.responsibleId];
              return (
                <div key={ev.id} className="row" onClick={() => setEditing(ev)}>
                  <span className="row-main">{ev.title || type.label}</span>
                  <Chip color={type.color}>{RECUR.find(r => r.id === ev.recurrence)?.label}</Chip>
                  <span className="row-meta">
                    {ev.recurrence === "once" ? parseISO(ev.anchorDate)?.toLocaleDateString("he-IL") : `יום ${DAYS[ev.day] ?? ""}`}
                    {" · "}{SHIFTS.find(s => s.id === ev.shift)?.label}
                    {ev.timeText ? ` · ${ev.timeText}` : ""}
                  </span>
                  {resp && <span className="row-resp">אחראי/ת: {resp.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {editing !== null && (
        <EventForm initial={editing.id ? editing : null} staff={state.staff} types={state.types}
          onSave={save} onDelete={del} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/* ====================== צוות ====================== */
function StaffTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const save = (s) => {
    update(p => ({
      ...p,
      staff: s.id ? p.staff.map(x => x.id === s.id ? s : x) : [...p.staff, { ...s, id: "s" + Date.now() }],
    }));
    setEditing(null);
  };
  const del = (id) => {
    if (!confirm("להסיר מהצוות? שיבוצים קיימים של איש צוות זה יוסרו מהתצוגה.")) return;
    update(p => ({ ...p, staff: p.staff.filter(x => x.id !== id) }));
    setEditing(null);
  };
  return (
    <div>
      <div className="tab-toolbar">
        <h2>צוות היחידה ({state.staff.length})</h2>
        <button className="btn primary" onClick={() => setEditing({})}>+ הוספה</button>
      </div>
      <div className="staff-grid">
        {state.staff.map(s => (
          <div key={s.id} className="staff-card" onClick={() => setEditing(s)}>
            <span className="dot" style={{ background: s.color }} />
            <div>
              <div className="staff-name">{s.name}</div>
              <div className="staff-role">{s.role}</div>
            </div>
          </div>
        ))}
      </div>
      {editing !== null && (
        <Modal title={editing.id ? "עריכת איש צוות" : "איש צוות חדש"} onClose={() => setEditing(null)}>
          <StaffForm initial={editing.id ? editing : null} onSave={save} onDelete={del} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
function StaffForm({ initial, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || { name: "", role: "רופא/ה בכיר/ה", color: "#0E7C7B", birthday: "" });
  return (
    <div>
      <div className="form-grid">
        <Field label="שם"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="תפקיד">
          <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="יום הולדת" hint="לתזכורת בסקירה ובלוח"><input type="date" value={f.birthday || ""} onChange={e => setF({ ...f, birthday: e.target.value })} /></Field>
        <Field label="צבע"><input type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></Field>
      </div>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => onDelete(initial.id)}>הסרה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={() => { if (f.name.trim()) onSave(f); }}>שמירה</button>
      </div>
    </div>
  );
}

/* ====================== משימות ====================== */
function TasksTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("active");
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const save = (t) => {
    update(p => ({
      ...p,
      tasks: t.id ? p.tasks.map(x => x.id === t.id ? t : x) : [...p.tasks, { ...t, id: "t" + Date.now() }],
    }));
    setEditing(null);
  };
  const del = (id) => { update(p => ({ ...p, tasks: p.tasks.filter(x => x.id !== id) })); setEditing(null); };
  const cycle = (t) => {
    const order = ["open", "progress", "done"];
    const next = order[(order.indexOf(t.status) + 1) % 3];
    update(p => ({ ...p, tasks: p.tasks.map(x => x.id === t.id ? { ...x, status: next } : x) }));
  };
  const list = state.tasks
    .filter(t => filter === "all" || (filter === "active" ? t.status !== "done" : t.status === "done"))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const todayISO = toISO(new Date());

  return (
    <div>
      <div className="tab-toolbar">
        <h2>משימות ומטלות</h2>
        <div className="seg">
          {[["active", "פעילות"], ["done", "הושלמו"], ["all", "הכל"]].map(([k, l]) => (
            <button key={k} className={"seg-btn" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>+ משימה</button>
      </div>
      {list.length === 0 && <div className="empty-state">אין משימות בתצוגה זו.</div>}
      <div className="rows">
        {list.map(t => {
          const st = TASK_STATUS.find(s => s.id === t.status);
          const overdue = t.due && t.due < todayISO && t.status !== "done";
          return (
            <div key={t.id} className="row">
              <button className="status-pill" style={{ background: st.color + "1A", color: st.color }}
                onClick={(e) => { e.stopPropagation(); cycle(t); }} title="לחיצה לשינוי סטטוס">{st.label}</button>
              <span className="row-main link" onClick={() => setEditing(t)}>{t.title}</span>
              {t.assigneeId && <Chip color={staffById[t.assigneeId]?.color || "#666"}>{staffById[t.assigneeId]?.name}</Chip>}
              {t.due && <span className={"row-meta" + (overdue ? " overdue" : "")}>יעד: {parseISO(t.due).toLocaleDateString("he-IL")}{overdue ? " ⚠" : ""}</span>}
            </div>
          );
        })}
      </div>
      {editing !== null && (
        <Modal title={editing.id ? "עריכת משימה" : "משימה חדשה"} onClose={() => setEditing(null)}>
          <TaskForm initial={editing.id ? editing : null} staff={state.staff} onSave={save} onDelete={del} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
function TaskForm({ initial, staff, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || { title: "", assigneeId: "", due: "", status: "open", notes: "" });
  return (
    <div>
      <Field label="תיאור המשימה"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></Field>
      <div className="form-grid">
        <Field label="אחראי/ת">
          <select value={f.assigneeId} onChange={e => setF({ ...f, assigneeId: e.target.value })}>
            <option value="">— ללא —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="תאריך יעד"><input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="סטטוס">
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            {TASK_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="הערות"><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => onDelete(initial.id)}>מחיקה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={() => { if (f.title.trim()) onSave(f); }}>שמירה</button>
      </div>
    </div>
  );
}

/* ====================== מחקרים ====================== */
function StudiesTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const save = (x) => {
    update(p => ({
      ...p,
      studies: x.id ? p.studies.map(s => s.id === x.id ? x : s) : [...p.studies, { ...x, id: "r" + Date.now() }],
    }));
    setEditing(null);
  };
  const del = (id) => { update(p => ({ ...p, studies: p.studies.filter(s => s.id !== id) })); setEditing(null); };
  return (
    <div>
      <div className="tab-toolbar">
        <h2>מחקרים קליניים ({state.studies.length})</h2>
        <button className="btn primary" onClick={() => setEditing({})}>+ מחקר</button>
      </div>
      {state.studies.length === 0 && <div className="empty-state">אין מחקרים רשומים. הוסיפו מחקר כדי לעקוב אחר סטטוס, חוקר ראשי ואבני דרך.</div>}
      <div className="cards-grid">
        {state.studies.map(s => (
          <div key={s.id} className="study-card" onClick={() => setEditing(s)}>
            <div className="study-title">{s.title}</div>
            <div className="study-meta">
              <Chip color="#3D5A80">{s.status}</Chip>
              {s.piId && <span>חוקר/ת ראשי/ת: <b>{staffById[s.piId]?.name}</b></span>}
              {s.protocol && <span className="mono">{s.protocol}</span>}
            </div>
            {s.deadline && <div className="study-deadline">📌 {s.deadlineLabel || "יעד"}: {parseISO(s.deadline).toLocaleDateString("he-IL")}</div>}
            {s.notes && <div className="study-notes">{s.notes}</div>}
          </div>
        ))}
      </div>
      {editing !== null && (
        <Modal title={editing.id ? "עריכת מחקר" : "מחקר חדש"} onClose={() => setEditing(null)}>
          <StudyForm initial={editing.id ? editing : null} staff={state.staff} statuses={state.studyStatuses} onSave={save} onDelete={del} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
function StudyForm({ initial, staff, statuses, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || { title: "", piId: "", protocol: "", status: statuses[0] || "", deadline: "", deadlineLabel: "", notes: "" });
  return (
    <div>
      <Field label="שם המחקר"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></Field>
      <div className="form-grid">
        <Field label="חוקר/ת ראשי/ת">
          <select value={f.piId} onChange={e => setF({ ...f, piId: e.target.value })}>
            <option value="">— ללא —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="מס׳ פרוטוקול"><input value={f.protocol} onChange={e => setF({ ...f, protocol: e.target.value })} placeholder="0299-24-TLV" /></Field>
        <Field label="סטטוס">
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            {!statuses.includes(f.status) && f.status && <option key="__cur">{f.status}</option>}
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="תאריך יעד קרוב" hint="לדוגמה: חידוש הלסינקי, יעד גיוס — יופיע בסקירה">
          <input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} />
        </Field>
        <Field label="כותרת היעד"><input value={f.deadlineLabel} onChange={e => setF({ ...f, deadlineLabel: e.target.value })} placeholder="חידוש הלסינקי" /></Field>
      </div>
      <Field label="הערות / אבני דרך"><textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => onDelete(initial.id)}>מחיקה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={() => { if (f.title.trim()) onSave(f); }}>שמירה</button>
      </div>
    </div>
  );
}

/* ====================== סטודנטים ====================== */
function StudentsTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const save = (x) => {
    update(p => ({
      ...p,
      students: x.id ? p.students.map(s => s.id === x.id ? x : s) : [...p.students, { ...x, id: "st" + Date.now() }],
    }));
    setEditing(null);
  };
  const del = (id) => { update(p => ({ ...p, students: p.students.filter(s => s.id !== id) })); setEditing(null); };
  return (
    <div>
      <div className="tab-toolbar">
        <h2>הנחיית סטודנטים ({state.students.length})</h2>
        <button className="btn primary" onClick={() => setEditing({})}>+ סטודנט/ית</button>
      </div>
      {state.students.length === 0 && <div className="empty-state">אין עבודות סטודנטים במעקב.</div>}
      {(() => {
        const stages = state.studentStatuses || [];
        const extra = [...new Set(state.students.map(s => s.status).filter(st => st && !stages.includes(st)))];
        const groups = [...stages, ...extra].map(stage => ({ stage, list: state.students.filter(s => s.status === stage) })).filter(g => g.list.length);
        return groups.map(({ stage, list }) => (
          <div key={stage} className="group">
            <div className="group-title" style={{ color: "#7A5CA8" }}>{stage} <span className="group-count">({list.length})</span></div>
            <div className="rows">
              {list.map(s => (
                <div key={s.id} className="row" onClick={() => setEditing(s)}>
                  <span className="row-main">{s.name}</span>
                  <span className="row-meta">{s.project}</span>
                  {(s.mentorIds || []).map(mid => staffById[mid] && (
                    <Chip key={mid} color={staffById[mid].color || "#666"}>מנחה: {staffById[mid].name}</Chip>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ));
      })()}
      {editing !== null && (
        <Modal title={editing.id ? "עריכה" : "סטודנט/ית חדש/ה"} onClose={() => setEditing(null)}>
          <StudentForm initial={editing.id ? editing : null} staff={state.staff} statuses={state.studentStatuses} onSave={save} onDelete={del} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
function StudentForm({ initial, staff, statuses, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || { name: "", project: "", mentorIds: [], status: statuses[0] || "", notes: "" });
  const mentorIds = f.mentorIds || [];
  const toggleMentor = (id) =>
    setF(p => ({ ...p, mentorIds: mentorIds.includes(id) ? mentorIds.filter(m => m !== id) : [...mentorIds, id] }));
  return (
    <div>
      <div className="form-grid">
        <Field label="שם הסטודנט/ית"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="סטטוס / שלב">
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            {!statuses.includes(f.status) && f.status && <option key="__cur">{f.status}</option>}
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="נושא העבודה"><input value={f.project} onChange={e => setF({ ...f, project: e.target.value })} /></Field>
      <Field label="מנחים" hint="אפשר לבחור יותר ממנחה אחד">
        <div className="pick-grid">
          {staff.map(s => (
            <button key={s.id} type="button"
              className={"pick" + (mentorIds.includes(s.id) ? " on" : "")}
              style={mentorIds.includes(s.id) ? { borderColor: s.color, background: s.color + "14" } : {}}
              onClick={() => toggleMentor(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="הערות"><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => onDelete(initial.id)}>מחיקה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={() => { if (f.name.trim()) onSave(f); }}>שמירה</button>
      </div>
    </div>
  );
}

/* ====================== הגדרות ====================== */
function SettingsTab({ state, update }) {
  const fileRef = useRef(null);
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `unit-backup-${toISO(new Date())}.json`;
    a.click();
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.staff || !data.events) throw new Error("מבנה קובץ לא תקין");
        if (confirm("לטעון את הגיבוי? הנתונים הנוכחיים יוחלפו.")) update(() => data);
      } catch { alert("הקובץ אינו גיבוי תקין של המערכת."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  return (
    <div>
      <h2>הגדרות</h2>
      <div className="settings-box">
        <Field label="שם היחידה (יופיע בכותרת ובייצוא ה-PDF)">
          <input value={state.unitName} onChange={e => update({ unitName: e.target.value })} />
        </Field>
      </div>
      <div className="settings-box">
        <h3>מתחמי עבודה וסוגי פעילות</h3>
        <p className="muted">אפשר לשנות שמות, צבעים ולהוסיף מתחמים. סימון "מתחם מרפאה" מפעיל מעקב בכיר/ה אחראי/ת והתראה כשאין שיבוץ.</p>
        {state.types.map((t, i) => {
          const inUse = state.events.some(e => e.type === t.id);
          return (
            <div key={t.id} className="type-row">
              <input type="color" value={t.color} className="type-color"
                onChange={e => update(p => ({ ...p, types: p.types.map(x => x.id === t.id ? { ...x, color: e.target.value } : x) }))} />
              <input value={t.label}
                onChange={e => update(p => ({ ...p, types: p.types.map(x => x.id === t.id ? { ...x, label: e.target.value } : x) }))} />
              <label className="check">
                <input type="checkbox" checked={t.kind === "clinic"}
                  onChange={e => update(p => ({ ...p, types: p.types.map(x => x.id === t.id ? { ...x, kind: e.target.checked ? "clinic" : (x.kind === "clinic" ? undefined : x.kind) } : x) }))} />
                מרפאה
              </label>
              <label className="check">
                <input type="checkbox" checked={t.kind === "seminar"}
                  onChange={e => update(p => ({ ...p, types: p.types.map(x => x.id === t.id ? { ...x, kind: e.target.checked ? "seminar" : (x.kind === "seminar" ? undefined : x.kind) } : x) }))} />
                סמינר
              </label>
              <button className="icon-btn" title={inUse ? "קיימים אירועים מסוג זה" : "הסרה"}
                onClick={() => {
                  if (inUse) { alert("לא ניתן להסיר — קיימים אירועים מסוג זה. יש למחוק או לשנות אותם קודם."); return; }
                  update(p => ({ ...p, types: p.types.filter(x => x.id !== t.id) }));
                }}>✕</button>
            </div>
          );
        })}
        <button className="btn ghost small" onClick={() =>
          update(p => ({ ...p, types: [...p.types, { id: "ty" + Date.now(), label: "מתחם חדש", color: "#0E7C7B" }] }))
        }>+ הוספת מתחם / סוג פעילות</button>
      </div>
      <div className="settings-box">
        <h3>סטטוסים של מחקרים</h3>
        <p className="muted">הרשימה משמשת את שדה הסטטוס במעקב המחקרים. מחקר קיים שומר את הסטטוס שלו גם אם הוסר מהרשימה.</p>
        {state.studyStatuses.map((s, i) => (
          <div key={i} className="type-row">
            <input value={s}
              onChange={e => update(p => {
                const next = [...p.studyStatuses]; next[i] = e.target.value;
                return { ...p, studyStatuses: next };
              })} />
            <button className="icon-btn" title="הסרה"
              onClick={() => update(p => ({ ...p, studyStatuses: p.studyStatuses.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        <button className="btn ghost small" onClick={() =>
          update(p => ({ ...p, studyStatuses: [...p.studyStatuses, "סטטוס חדש"] }))
        }>+ הוספת סטטוס</button>
      </div>
      <div className="settings-box">
        <h3>שלבי עבודת הסטודנטים</h3>
        <p className="muted">הרשימה משמשת את שדה הסטטוס/שלב במעקב הסטודנטים. סטודנט קיים שומר את השלב הנוכחי גם אם הוסר מהרשימה.</p>
        {state.studentStatuses.map((s, i) => (
          <div key={i} className="type-row">
            <input value={s}
              onChange={e => update(p => {
                const next = [...p.studentStatuses]; next[i] = e.target.value;
                return { ...p, studentStatuses: next };
              })} />
            <button className="icon-btn" title="הסרה"
              onClick={() => update(p => ({ ...p, studentStatuses: p.studentStatuses.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        <button className="btn ghost small" onClick={() =>
          update(p => ({ ...p, studentStatuses: [...p.studentStatuses, "שלב חדש"] }))
        }>+ הוספת שלב</button>
      </div>
      <div className="settings-box">
        <h3>חגים בלוח</h3>
        <p className="muted">בחרו אילו מסורות חג יוצגו בלוח. חגים יהודיים מסומנים כ״סגירת יחידה״ ומשפיעים על התראות הכיסוי; חגים מוסלמיים ודרוזיים מוצגים כסימון מידע (לרישום היעדרות אישית השתמשו בלשונית חופשות).</p>
        {[["jewish", "חגים יהודיים"], ["muslim", "חגים מוסלמיים"], ["druze", "חגים דרוזיים"]].map(([k, label]) => (
          <label key={k} className="check" style={{ display: "flex", marginBottom: 6 }}>
            <input type="checkbox" checked={(state.holidaySets || {})[k] !== false}
              onChange={e => update(p => ({ ...p, holidaySets: { ...(p.holidaySets || {}), [k]: e.target.checked } }))} />
            {label}
          </label>
        ))}
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>החישוב המוסלמי מבוסס לוח אום אל-קורא; התאריך בפועל עשוי לנוע ±יום לפי ראיית הירח.</p>
      </div>
      <div className="settings-box">
        <h3>הרשאות וכניסה</h3>
        <p className="muted">רופאי היחידה נכנסים במצב "צפייה בלבד" ורואים רק את הלוח (כולל הורדת לו״ז שבועי/יומי/אישי). עריכה, משימות, מחקרים, סטודנטים, חופשות והגדרות זמינים רק עם סיסמת הניהול.</p>
        <Field label="סיסמת עריכה (ניהול)" hint="שתפו רק עם מנהלת היחידה והסגן. מומלץ לשנות מברירת המחדל.">
          <input value={state.editPassword ?? ""} onChange={e => update({ editPassword: e.target.value })} />
        </Field>
        <p className="muted" style={{ fontSize: 12 }}>שימו לב: זהו מנגנון הגנה בסיסי המתאים לכלי פנימי. הוא מונע עריכה מקרית, אך אינו אבטחה חזקה. לאבטחה מלאה (התחברות אישית לכל משתמש) נדרשת תוספת — אפשר להוסיף בהמשך.</p>
      </div>
      <div className="settings-box">
        <h3>גיבוי ושחזור</h3>
        <p className="muted">הנתונים נשמרים אוטומטית. מומלץ לייצא גיבוי תקופתי לקובץ — אפשר גם להעביר כך את כל ההגדרות למחשב אחר.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={exportJSON}>⤓ ייצוא גיבוי (JSON)</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⤒ טעינת גיבוי</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importJSON} />
        </div>
      </div>
      <div className="settings-box danger-zone">
        <h3>איפוס</h3>
        <button className="btn danger" onClick={() => {
          if (confirm("לאפס את כל נתוני המערכת? פעולה זו אינה הפיכה (מומלץ לייצא גיבוי קודם).")) {
            update(() => ({ unitName: "היחידה לרפואת הפה", staff: DEFAULT_STAFF, types: TYPES, studyStatuses: STUDY_STATUS, studentStatuses: STUDENT_STATUS, events: [], tasks: [], studies: [], students: [], overrides: {}, absences: [], holidaySets: { jewish: true, muslim: true, druze: true }, editPassword: "1234" }));
          }
        }}>איפוס כל הנתונים</button>
      </div>
    </div>
  );
}

/* ====================== סקירה (Dashboard) ====================== */
function Dashboard({ state, setTab }) {
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const today = startOfDay(new Date());
  const todayISO = toISO(today);
  const inDays = (iso) => Math.round((parseISO(iso) - today) / MS_DAY);

  const studyDeadlines = (state.studies || [])
    .filter(s => s.deadline)
    .map(s => ({ ...s, days: inDays(s.deadline) }))
    .filter(s => s.days >= -7)
    .sort((a, b) => a.days - b.days).slice(0, 8);

  const dueTasks = (state.tasks || [])
    .filter(t => t.status !== "done" && t.due)
    .map(t => ({ ...t, days: inDays(t.due) }))
    .sort((a, b) => a.days - b.days).slice(0, 8);

  const upcomingAbsences = (state.absences || [])
    .filter(a => a.endDate >= todayISO)
    .sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 8);

  // שיבוצי סמינר קרובים (מתוך החריגים)
  const seminarTypeIds = new Set(state.types.filter(t => t.kind === "seminar").map(t => t.id));
  const seminarAssign = Object.entries(state.overrides || {})
    .map(([key, ov]) => { const [eid, iso] = key.split("|"); return { eid, iso, ov }; })
    .filter(x => (x.ov.presenterId || x.ov.topic) && x.iso >= todayISO)
    .map(x => { const ev = state.events.find(e => e.id === x.eid); return ev && seminarTypeIds.has(ev.type) ? { ...x, ev, days: inDays(x.iso) } : null; })
    .filter(Boolean).sort((a, b) => a.iso.localeCompare(b.iso)).slice(0, 6);

  const birthdays = (state.staff || [])
    .filter(s => s.birthday)
    .map(s => { const d = nextBirthdayDate(s.birthday, today); return { ...s, bdate: d, days: Math.round((startOfDay(d) - today) / MS_DAY) }; })
    .filter(s => s.days <= 30)
    .sort((a, b) => a.days - b.days);

  const specials = (state.events || [])
    .filter(e => e.recurrence === "once" && e.anchorDate)
    .map(e => ({ ...e, days: inDays(e.anchorDate) }))
    .filter(e => e.days >= -1 && e.days <= 45)
    .sort((a, b) => a.days - b.days).slice(0, 6);

  const tag = (days) => days < 0 ? <span className="badge-over">באיחור</span>
    : days <= 14 ? <span className="badge-soon">בעוד {days} ימים</span>
    : <span className="badge-ok">בעוד {days} ימים</span>;

  const empty = !studyDeadlines.length && !dueTasks.length && !upcomingAbsences.length && !seminarAssign.length && !birthdays.length && !specials.length;

  return (
    <div>
      <h2>סקירה — מה דורש תשומת לב</h2>
      {empty && <div className="empty-state">אין כרגע יעדים, משימות או חופשות קרובות. הוסיפו תאריך יעד למחקר, תאריך יעד למשימה או חופשה כדי שיופיעו כאן.</div>}
      <div className="dash-grid">
        {studyDeadlines.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("studies")}>יעדי מחקר</div>
            {studyDeadlines.map(s => (
              <div key={s.id} className="dash-item">
                <span>{s.deadlineLabel || "יעד"} — <b>{s.title}</b><br /><span className="muted">{parseISO(s.deadline).toLocaleDateString("he-IL")}</span></span>
                {tag(s.days)}
              </div>
            ))}
          </div>
        )}
        {dueTasks.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("tasks")}>משימות עם יעד</div>
            {dueTasks.map(t => (
              <div key={t.id} className="dash-item">
                <span><b>{t.title}</b>{t.assigneeId ? <><br /><span className="muted">{staffById[t.assigneeId]?.name}</span></> : null}</span>
                {tag(t.days)}
              </div>
            ))}
          </div>
        )}
        {seminarAssign.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("seminars")}>סמינרים קרובים</div>
            {seminarAssign.map((x, i) => (
              <div key={i} className="dash-item">
                <span><b>{x.ov.topic || x.ev.title}</b><br /><span className="muted">{x.ov.presenterId ? staffById[x.ov.presenterId]?.name + " · " : ""}{parseISO(x.iso).toLocaleDateString("he-IL")}</span></span>
                {tag(x.days)}
              </div>
            ))}
          </div>
        )}
        {specials.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("board")}>אירועים מיוחדים קרובים</div>
            {specials.map(e => {
              const t = state.types.find(x => x.id === e.type) || {};
              return (
                <div key={e.id} className="dash-item">
                  <span><b>{e.title || t.label}</b><br /><span className="muted">{parseISO(e.anchorDate).toLocaleDateString("he-IL")}{e.endDate ? " – " + parseISO(e.endDate).toLocaleDateString("he-IL") : ""}</span></span>
                  {tag(e.days)}
                </div>
              );
            })}
          </div>
        )}
        {birthdays.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("staff")}>🎂 ימי הולדת קרובים</div>
            {birthdays.map(s => (
              <div key={s.id} className="dash-item">
                <span><b>{s.name}</b><br /><span className="muted">{s.bdate.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}</span></span>
                {s.days === 0 ? <span className="badge-soon">היום!</span> : tag(s.days)}
              </div>
            ))}
          </div>
        )}
        {upcomingAbsences.length > 0 && (
          <div className="dash-card">
            <div className="dash-title" onClick={() => setTab("absences")}>חופשות קרובות</div>
            {upcomingAbsences.map(a => (
              <div key={a.id} className="dash-item">
                <span><b>{staffById[a.staffId]?.name || "?"}</b> — {a.kind}<br /><span className="muted">{parseISO(a.startDate).toLocaleDateString("he-IL")} – {parseISO(a.endDate).toLocaleDateString("he-IL")}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== חופשות והיעדרויות ====================== */
function AbsencesTab({ state, update }) {
  const [editing, setEditing] = useState(null);
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const todayISO = toISO(new Date());
  const save = (a) => {
    update(p => ({ ...p, absences: a.id ? p.absences.map(x => x.id === a.id ? a : x) : [...(p.absences || []), { ...a, id: "ab" + Date.now() }] }));
    setEditing(null);
  };
  const del = (id) => { update(p => ({ ...p, absences: p.absences.filter(x => x.id !== id) })); setEditing(null); };
  const list = [...(state.absences || [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <div>
      <div className="tab-toolbar">
        <h2>חופשות והיעדרויות</h2>
        <button className="btn primary" onClick={() => setEditing({})}>+ היעדרות</button>
      </div>
      {list.length === 0 && <div className="empty-state">אין היעדרויות רשומות. הוסיפו טווח תאריכים — האירועים של אותו רופא יסומנו אוטומטית בלוח.</div>}
      <div className="rows">
        {list.map(a => {
          const current = a.startDate <= todayISO && a.endDate >= todayISO;
          return (
            <div key={a.id} className="row" onClick={() => setEditing(a)}>
              <span className="row-main">{staffById[a.staffId]?.name || "?"}</span>
              <Chip color="#0E7C7B">{a.kind}</Chip>
              <span className="row-meta">{parseISO(a.startDate).toLocaleDateString("he-IL")} – {parseISO(a.endDate).toLocaleDateString("he-IL")}</span>
              {current && <Chip color="#B5485D" outline>פעיל כעת</Chip>}
              {a.note && <span className="row-resp">{a.note}</span>}
            </div>
          );
        })}
      </div>
      {editing !== null && (
        <Modal title={editing.id ? "עריכת היעדרות" : "היעדרות חדשה"} onClose={() => setEditing(null)}>
          <AbsenceForm initial={editing.id ? editing : null} staff={state.staff} onSave={save} onDelete={del} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
function AbsenceForm({ initial, staff, onSave, onDelete, onClose }) {
  const [f, setF] = useState(initial || { staffId: staff[0]?.id || "", kind: ABSENCE_KINDS[0], startDate: "", endDate: "", note: "" });
  const save = () => {
    if (!f.staffId || !f.startDate || !f.endDate) { alert("יש לבחור איש צוות וטווח תאריכים"); return; }
    if (f.endDate < f.startDate) { alert("תאריך הסיום מוקדם מתאריך ההתחלה"); return; }
    onSave(f);
  };
  return (
    <div>
      <div className="form-grid">
        <Field label="איש/אשת צוות">
          <select value={f.staffId} onChange={e => setF({ ...f, staffId: e.target.value })}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="סוג">
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
            {ABSENCE_KINDS.map(k => <option key={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="מתאריך"><input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="עד תאריך"><input type="date" value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} /></Field>
      </div>
      <Field label="הערה"><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="לא חובה" /></Field>
      <div className="modal-actions">
        {initial?.id && <button className="btn danger" onClick={() => onDelete(initial.id)}>מחיקה</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" onClick={save}>שמירה</button>
      </div>
    </div>
  );
}

/* ====================== נושאי סמינר ====================== */
function SeminarsTab({ state, setTab }) {
  const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));
  const overrides = state.overrides || {};
  const today = startOfDay(new Date());
  const seminarTypes = state.types.filter(t => t.kind === "seminar");
  const seminarEvents = state.events.filter(e => seminarTypes.some(t => t.id === e.type));

  // מופעי סמינר ל-70 הימים הקרובים
  const rows = [];
  for (let i = 0; i < 70; i++) {
    const date = addDays(today, i);
    seminarEvents.forEach(ev => {
      if (!eventOccursOnDate(ev, date)) return;
      const ov = overrides[ovKey(ev.id, date)] || {};
      if (ov.cancelled) return;
      rows.push({ date, ev, ov });
    });
  }
  const t = state.types;

  return (
    <div>
      <h2>נושאי סמינר ושיוך מתמחים</h2>
      {seminarTypes.length === 0 && <div className="empty-state">לא הוגדר אף סוג פעילות כ״סמינר״. בהגדרות, סמנו ״סמינר״ ליד סוג הפעילות הרלוונטי.</div>}
      {seminarTypes.length > 0 && rows.length === 0 && <div className="empty-state">אין מופעי סמינר ב-70 הימים הקרובים.</div>}
      {rows.length > 0 && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>השיוך (מתמחה + נושא) נקבע בלחיצה על הסמינר בלוח השבועי. כאן רואים את כל המופעים הקרובים ומה עדיין לא שובץ.</p>
          <div className="rows">
            {rows.map((r, i) => {
              const typeObj = t.find(x => x.id === r.ev.type) || {};
              const assigned = r.ov.presenterId || r.ov.topic;
              return (
                <div key={i} className="row">
                  <span className="row-meta" style={{ minWidth: 92 }}>{r.date.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })}</span>
                  <span className="row-main">{r.ev.title || typeObj.label}</span>
                  {r.ov.presenterId && <Chip color={staffById[r.ov.presenterId]?.color || "#7A5CA8"}>{staffById[r.ov.presenterId]?.name}</Chip>}
                  {r.ov.topic && <span className="row-resp">{r.ov.topic}</span>}
                  {!assigned && <Chip color="#C97B2D" outline>טרם שובץ</Chip>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ====================== שעות עבודה שבועיות ====================== */
function HoursTab({ state }) {
  const [wo, setWo] = useState(0);
  const ws = addDays(weekStart(new Date()), wo * 7);
  const overrides = state.overrides || {};
  const absences = state.absences || [];
  const rows = useMemo(() => {
    return state.staff.map(s => {
      let hours = 0; const detail = {};
      for (let i = 0; i < 6; i++) {
        const date = addDays(ws, i);
        if (isAbsent(s.id, date, absences)) continue;
        state.events.forEach(ev => {
          if (!eventOccursOnDate(ev, date)) return;
          if (effectiveCancel(ev, date, overrides, absences).cancelled) return;
          const ov = overrides[ovKey(ev.id, date)] || {};
          const involved = ev.responsibleId === s.id || (ev.participants || []).includes(s.id) || ov.presenterId === s.id;
          if (!involved) return;
          const h = eventHours(ev);
          hours += h;
          const t = state.types.find(x => x.id === ev.type);
          const lbl = t?.label || "אחר";
          detail[lbl] = (detail[lbl] || 0) + h;
        });
      }
      return { ...s, hours, detail };
    }).sort((a, b) => b.hours - a.hours);
  }, [state.events, state.staff, ws.getTime(), absences, overrides]);

  const max = Math.max(1, ...rows.map(r => r.hours));
  const fmtH = (h) => Number.isInteger(h) ? String(h) : h.toFixed(1);

  return (
    <div>
      <div className="tab-toolbar">
        <h2>שעות עבודה שבועיות</h2>
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setWo(wo + 1)}>‹</button>
          <button className="btn ghost small" onClick={() => setWo(0)}>השבוע</button>
          <button className="icon-btn" onClick={() => setWo(wo - 1)}>›</button>
          <span className="week-range">{fmt(ws)} – {fmt(addDays(ws, 5))}</span>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>מחושב משדה השעות של כל פעילות (טווח כמו 08:00–13:00). פעילות ללא שעות מחושבת לפי ברירת מחדל למשמרת (בוקר 5, ערב 4, כל היום 8). ימי חופשה ופעילויות מבוטלות לא נספרים.</p>
      <div className="hours-list">
        {rows.map(r => (
          <div key={r.id} className="hours-row">
            <div className="hours-name"><span className="dot" style={{ background: r.color }} />{r.name}</div>
            <div className="hours-bar-wrap">
              <div className="hours-bar" style={{ width: `${(r.hours / max) * 100}%`, background: r.color }} />
            </div>
            <div className="hours-total">{fmtH(r.hours)} ש׳</div>
            <div className="hours-detail">{Object.entries(r.detail).map(([k, v]) => `${k}: ${fmtH(v)}`).join(" · ") || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================== מסך כניסה (הרשאות) ====================== */
function LoginGate({ unitName, editPassword, onPick }) {
  const [mode, setMode] = useState(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const tryEditor = () => {
    if (pw === (editPassword ?? "1234")) onPick("editor");
    else setErr(true);
  };
  return (
    <div className="gate" dir="rtl">
      <style>{CSS}</style>
      <div className="gate-card">
        <div className="gate-mark">⚕</div>
        <div className="gate-title">{unitName}</div>
        <div className="gate-sub">בחר/י אופן כניסה</div>
        {!mode && (
          <div className="gate-actions">
            <button className="btn primary gate-btn" onClick={() => onPick("viewer")}>צפייה בלוח (רופא/ה)</button>
            <button className="btn ghost gate-btn" onClick={() => setMode("editor")}>כניסת ניהול (עריכה)</button>
          </div>
        )}
        {mode === "editor" && (
          <div className="gate-actions">
            <input type="password" autoFocus placeholder="סיסמת עריכה" value={pw}
              onChange={e => { setPw(e.target.value); setErr(false); }}
              onKeyDown={e => e.key === "Enter" && tryEditor()} />
            {err && <div className="gate-err">סיסמה שגויה</div>}
            <button className="btn primary gate-btn" onClick={tryEditor}>כניסה</button>
            <button className="btn ghost gate-btn" onClick={() => { setMode(null); setPw(""); setErr(false); }}>חזרה</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== אפליקציה ====================== */
export default function App() {
  const [state, update, loaded] = useStoredState();
  const [tab, setTab] = useState("dashboard");
  const [weekOffset, setWeekOffset] = useState(0);
  const [role, setRole] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("unit_role") : null));
  const pickRole = (r) => { try { localStorage.setItem("unit_role", r); } catch (e) {} setRole(r); setTab(r === "editor" ? "dashboard" : "board"); };
  const logout = () => { try { localStorage.removeItem("unit_role"); } catch (e) {} setRole(null); };

  if (!loaded || !state) {
    return <div className="loading" dir="rtl">טוען את נתוני היחידה…<style>{CSS}</style></div>;
  }
  if (!role) {
    return <LoginGate unitName={state.unitName} editPassword={state.editPassword} onPick={pickRole} />;
  }
  const canEdit = role === "editor";
  const activeTab = canEdit ? tab : "board";

  const openTasks = state.tasks.filter(t => t.status !== "done").length;

  const allTabs = [
    { id: "dashboard", label: "סקירה" },
    { id: "board", label: "לוח" },
    { id: "absences", label: "חופשות" },
    { id: "events", label: "אירועים" },
    { id: "tasks", label: `משימות${openTasks ? ` (${openTasks})` : ""}` },
    { id: "studies", label: "מחקרים" },
    { id: "seminars", label: "סמינרים" },
    { id: "students", label: "סטודנטים" },
    { id: "hours", label: "שעות" },
    { id: "staff", label: "צוות" },
    { id: "settings", label: "הגדרות" },
  ];
  const tabs = canEdit ? allTabs : allTabs.filter(t => t.id === "board");

  return (
    <div className="app" dir="rtl">
      <style>{CSS}</style>
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark">⚕</span>
          <div>
            <div className="brand-name">{state.unitName}</div>
            <div className="brand-sub">{canEdit ? "ניהול ובקרה" : "צפייה בלבד"}{isCentral ? " · אחסון מרכזי" : " · אחסון מקומי"}</div>
          </div>
          <button className="btn ghost small logout-btn" onClick={logout}>{canEdit ? "יציאה" : "החלף משתמש"}</button>
        </div>
        <nav className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={"tab" + (activeTab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        {activeTab === "board" && <WeekBoard state={state} update={update} weekOffset={weekOffset} setWeekOffset={setWeekOffset} canEdit={canEdit} />}
        {canEdit && activeTab === "dashboard" && <Dashboard state={state} setTab={setTab} />}
        {canEdit && activeTab === "absences" && <AbsencesTab state={state} update={update} />}
        {canEdit && activeTab === "seminars" && <SeminarsTab state={state} setTab={setTab} />}
        {canEdit && activeTab === "events" && <EventsTab state={state} update={update} />}
        {canEdit && activeTab === "tasks" && <TasksTab state={state} update={update} />}
        {canEdit && activeTab === "studies" && <StudiesTab state={state} update={update} />}
        {canEdit && activeTab === "students" && <StudentsTab state={state} update={update} />}
        {canEdit && activeTab === "hours" && <HoursTab state={state} />}
        {canEdit && activeTab === "staff" && <StaffTab state={state} update={update} />}
        {canEdit && activeTab === "settings" && <SettingsTab state={state} update={update} />}
      </main>
    </div>
  );
}

/* ====================== עיצוב ====================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@700;900&display=swap');

:root {
  --ink: #20303F;
  --ink-soft: #5A6B79;
  --teal: #0E7C7B;
  --teal-deep: #0A5C5B;
  --paper: #F7F8F7;
  --card: #FFFFFF;
  --line: #E2E7E6;
  --amber: #C97B2D;
  --morning: #FBF4E8;
  --evening: #EEF0F8;
  --danger: #B5485D;
}
* { box-sizing: border-box; margin: 0; }
body { margin: 0; }
.app, .loading {
  font-family: 'Assistant', 'Heebo', system-ui, sans-serif;
  background: var(--paper); color: var(--ink); min-height: 100vh;
}
.loading { display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--ink-soft); }

/* ----- כותרת עליונה ----- */
.topbar {
  background: linear-gradient(180deg, #103A3A, #0E7C7B 140%);
  color: #fff; padding: 14px 22px 0; box-shadow: 0 2px 10px rgba(16,58,58,.25);
}
.brand { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; }
.brand-mark { font-size: 30px; line-height: 1; background: rgba(255,255,255,.12); border-radius: 12px; padding: 8px 11px; }
.brand-name { font-family: 'Frank Ruhl Libre', serif; font-weight: 900; font-size: 21px; letter-spacing: .2px; }
.brand-sub { font-size: 12.5px; opacity: .75; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tab {
  background: transparent; border: 0; color: rgba(255,255,255,.78);
  padding: 9px 15px; font: inherit; font-weight: 600; cursor: pointer;
  border-radius: 10px 10px 0 0; transition: background .15s;
}
.tab:hover { background: rgba(255,255,255,.1); }
.tab.on { background: var(--paper); color: var(--teal-deep); }
.content { padding: 20px 22px 40px; max-width: 1480px; margin: 0 auto; }

/* ----- לוח שבועי ----- */
.board-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.week-nav { display: flex; align-items: center; gap: 8px; }
.week-range { font-weight: 700; font-size: 16px; color: var(--teal-deep); margin-inline-start: 6px; }
.toolbar-actions { display: flex; gap: 8px; }
.alert {
  background: #FCF3E6; border: 1px solid #EBD3AE; color: #7A5215;
  border-radius: 10px; padding: 9px 14px; margin-bottom: 12px; font-size: 14px;
}
.board {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
}
.day-col {
  background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  overflow: hidden; min-height: 200px; display: flex; flex-direction: column;
}
.day-col.today { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(14,124,123,.18); }
.day-head {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 9px 12px; background: #F0F4F3; border-bottom: 1px solid var(--line);
}
.day-col.today .day-head { background: var(--teal); color: #fff; }
.day-name { font-weight: 700; font-size: 14.5px; }
.day-date { font-size: 12.5px; opacity: .7; }
.shift-block { padding: 7px 9px 9px; }
.shift-block.morning { background: var(--morning); }
.shift-block.evening { background: var(--evening); flex: 1; }
.shift-block.allday { background: #F2F2EE; }
.shift-label { font-size: 11.5px; font-weight: 700; color: var(--ink-soft); margin-bottom: 5px; letter-spacing: .3px; }
.empty-slot { color: #B9C2C0; font-size: 13px; padding: 2px 4px; }
.event-card {
  background: #fff; border: 1px solid var(--line); border-inline-start: 4px solid var(--teal);
  border-radius: 8px; padding: 7px 9px; margin-bottom: 6px; cursor: pointer;
  position: relative; transition: box-shadow .12s, transform .12s;
}
.event-card:hover { box-shadow: 0 3px 10px rgba(32,48,63,.12); transform: translateY(-1px); }
.ev-title { font-weight: 700; font-size: 13.5px; line-height: 1.25; }
.ev-type { font-size: 11.5px; font-weight: 600; margin-top: 1px; }
.ev-resp { font-size: 12px; margin-top: 3px; color: var(--ink); }
.ev-people { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; }
.event-card.cancelled { opacity: .58; }
.event-card.cancelled .ev-title { text-decoration: line-through; }
.ev-cancel-badge { display: inline-block; background: #FBEDF0; color: #B5485D; font-size: 10px; font-weight: 800; border-radius: 6px; padding: 1px 7px; margin-top: 3px; }
.ev-note { font-size: 11.5px; color: #7A5215; background: #FCF3E6; border-radius: 6px; padding: 2px 7px; margin-top: 3px; }
.occ-actions { margin-bottom: 14px; }
.occ-actions .btn { width: 100%; }
.ev-recur {
  position: absolute; top: 6px; inset-inline-end: 7px; font-size: 10px;
  background: #EEF2F1; color: var(--ink-soft); border-radius: 6px; padding: 1px 6px; font-weight: 700;
}

/* ----- ייצוא PDF ----- */
.print-header { display: none; }
@media print {
  @page { size: A4 landscape; margin: 9mm; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; width: 100%; }
  .no-print { display: none !important; }
  .print-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2.5px solid var(--teal-deep); padding-bottom: 7px; margin-bottom: 10px;
  }
  .print-title { font-family: 'Frank Ruhl Libre', serif; font-weight: 900; font-size: 19px; color: var(--teal-deep); }
  .print-sub { font-size: 13px; color: var(--ink-soft); }
  .print-stamp { font-size: 11px; color: var(--ink-soft); }
  .board { gap: 6px; }
  .day-col { border-radius: 6px; min-height: auto; break-inside: avoid; }
  .event-card { box-shadow: none !important; transform: none !important; padding: 5px 7px; margin-bottom: 4px; }
  .ev-title { font-size: 11.5px; }
  .ev-type, .ev-resp { font-size: 10px; }
  .ev-people { font-size: 9.5px; }
  .shift-label { font-size: 10px; }
}

/* ----- כפתורים ושדות ----- */
.btn {
  font: inherit; font-weight: 700; border: 0; border-radius: 10px;
  padding: 9px 16px; cursor: pointer; transition: filter .12s;
}
.btn:hover { filter: brightness(1.07); }
.btn.primary { background: var(--teal); color: #fff; }
.btn.accent { background: var(--amber); color: #fff; }
.btn.ghost { background: #fff; border: 1px solid var(--line); color: var(--ink); }
.btn.danger { background: #FBEDF0; color: var(--danger); border: 1px solid #EBC6CE; }
.btn.small { padding: 6px 12px; font-size: 13.5px; }
.icon-btn {
  background: #fff; border: 1px solid var(--line); border-radius: 9px;
  width: 32px; height: 32px; font-size: 17px; cursor: pointer; color: var(--ink);
}
.btn-row { display: flex; gap: 10px; flex-wrap: wrap; }
.spacer { flex: 1; }

.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.field-label { font-size: 13px; font-weight: 700; color: var(--ink-soft); }
.field-hint { font-size: 11.5px; color: #93A1AC; }
input, select, textarea {
  font: inherit; padding: 8px 11px; border: 1px solid var(--line);
  border-radius: 9px; background: #fff; color: var(--ink); width: 100%;
}
input:focus, select:focus, textarea:focus { outline: 2px solid rgba(14,124,123,.3); border-color: var(--teal); }
input[type=color] { padding: 3px; height: 40px; width: 70px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0 14px; }
.pick-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.pick {
  font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 999px;
  border: 1px solid var(--line); background: #fff; cursor: pointer; color: var(--ink-soft);
}
.pick.on { font-weight: 700; color: var(--ink); }

/* ----- מודאל ----- */
.overlay {
  position: fixed; inset: 0; background: rgba(20,35,40,.45);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
}
.modal {
  background: var(--paper); border-radius: 16px; width: 100%; max-width: 480px;
  max-height: 92vh; overflow-y: auto; box-shadow: 0 18px 50px rgba(0,0,0,.3);
}
.modal.wide { max-width: 640px; }
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--paper); z-index: 2;
}
.modal-head h3 { font-family: 'Frank Ruhl Libre', serif; font-size: 18px; color: var(--teal-deep); }
.modal-body { padding: 16px 18px; }
.modal-actions { display: flex; gap: 8px; margin-top: 8px; }

/* ----- רשימות וכרטיסים ----- */
.tab-toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.tab-toolbar h2 { font-family: 'Frank Ruhl Libre', serif; font-size: 21px; color: var(--teal-deep); flex: 1; }
h2 { font-family: 'Frank Ruhl Libre', serif; color: var(--teal-deep); margin-bottom: 12px; }
.empty-state {
  background: #fff; border: 1px dashed var(--line); border-radius: 12px;
  padding: 26px; text-align: center; color: var(--ink-soft);
}
.group { margin-bottom: 18px; }
.group-title { font-weight: 800; font-size: 15px; margin-bottom: 6px; }
.rows { display: flex; flex-direction: column; gap: 6px; }
.row {
  background: #fff; border: 1px solid var(--line); border-radius: 10px;
  padding: 9px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; cursor: pointer;
}
.row:hover { border-color: var(--teal); }
.row-main { font-weight: 700; }
.row-main.link { cursor: pointer; }
.row-meta { font-size: 13px; color: var(--ink-soft); }
.row-meta.overdue { color: var(--danger); font-weight: 700; }
.row-resp { font-size: 13px; color: var(--ink-soft); margin-inline-start: auto; }
.chip { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.status-pill { font: inherit; font-size: 12.5px; font-weight: 700; border: 0; border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.seg { display: flex; background: #fff; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.seg-btn { font: inherit; font-size: 13.5px; border: 0; background: transparent; padding: 7px 13px; cursor: pointer; color: var(--ink-soft); }
.seg-btn.on { background: var(--teal); color: #fff; font-weight: 700; }

.staff-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.staff-card {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 12px 14px; display: flex; align-items: center; gap: 11px; cursor: pointer;
}
.staff-card:hover { border-color: var(--teal); }
.dot { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }
.staff-name { font-weight: 700; }
.staff-role { font-size: 12.5px; color: var(--ink-soft); }

.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.study-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; cursor: pointer; }
.study-card:hover { border-color: var(--teal); }
.study-title { font-weight: 800; margin-bottom: 6px; }
.study-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; color: var(--ink-soft); }
.study-notes { font-size: 13px; color: var(--ink-soft); margin-top: 7px; white-space: pre-wrap; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; background: #F0F4F3; border-radius: 6px; padding: 1px 7px; }

.settings-box { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; max-width: 640px; }
.settings-box h3 { margin-bottom: 8px; color: var(--teal-deep); }
.muted { color: var(--ink-soft); font-size: 14px; margin-bottom: 12px; }
.danger-zone { border-color: #EBC6CE; }
.type-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.type-row input[type=text], .type-row input:not([type]) { flex: 1; }
.type-color { width: 44px !important; height: 36px; padding: 2px; flex-shrink: 0; }
.check { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--ink-soft); white-space: nowrap; }
.check input { width: auto; }


/* ----- חופשות / חגים / סמינר על הכרטיס ----- */
.absence-strip { background: #E9F4F2; border: 1px solid #BFE0DB; color: #0A5C5B; border-radius: 10px; padding: 8px 14px; margin-bottom: 12px; font-size: 14px; }
.ev-resp.warn { color: #B5485D; font-weight: 700; }
.ev-seminar { font-size: 11.5px; color: #5B3E86; background: #F1ECF7; border-radius: 6px; padding: 2px 7px; margin-top: 3px; }
.day-col.holiday .day-head { background: #7A1F2B; color: #fff; }
.holiday-tag { font-size: 11px; font-weight: 700; padding: 3px 9px; background: #FBEDF0; color: #7A1F2B; }
.holiday-tag.major { background: #7A1F2B; color: #fff; }
.holiday-tag.jewish { background: #FBEDF0; color: #7A1F2B; }
.holiday-tag.muslim { background: #E6F2EA; color: #1B6B3A; }
.holiday-tag.druze { background: #E8EEF6; color: #2A4A7A; }
.bday-tag { font-size: 11px; font-weight: 700; padding: 2px 9px; background: #FCEFF7; color: #B0327E; }
.mc-holname.muslim { color: #1B6B3A; }
.mc-holname.druze { color: #2A4A7A; }
.day-col.holiday .day-head { background: #7A1F2B; color: #fff; }
.study-deadline { font-size: 12.5px; color: #7A5215; background: #FCF3E6; border-radius: 6px; padding: 2px 8px; margin-top: 7px; display: inline-block; }

/* ----- לוח חודשי ----- */
.rooms-box { background: #F0F4F3; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rooms-box-title { font-weight: 700; font-size: 13.5px; color: var(--ink); }
.rooms-chip { font-size: 12.5px; font-weight: 700; border-radius: 999px; padding: 2px 10px; }
.rooms-line { font-size: 11px; font-weight: 700; color: var(--ink-soft); padding: 2px 12px; background: #EEF2F1; }
.logout-btn { margin-inline-start: auto; align-self: center; background: rgba(255,255,255,.14) !important; color: #fff !important; border: 0 !important; }
.gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #103A3A, #0E7C7B); font-family: 'Assistant', sans-serif; padding: 20px; }
.gate-card { background: #fff; border-radius: 18px; padding: 32px 30px; width: 100%; max-width: 360px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.gate-mark { font-size: 38px; background: #F0F4F3; width: 70px; height: 70px; line-height: 70px; border-radius: 18px; margin: 0 auto 14px; }
.gate-title { font-family: 'Frank Ruhl Libre', serif; font-weight: 900; font-size: 21px; color: var(--teal-deep); }
.gate-sub { color: var(--ink-soft); margin: 4px 0 20px; }
.gate-actions { display: flex; flex-direction: column; gap: 10px; }
.gate-btn { width: 100%; }
.gate-err { color: var(--danger); font-size: 13px; font-weight: 700; }
.hours-list { display: flex; flex-direction: column; gap: 8px; }
.hours-row { display: grid; grid-template-columns: 160px 1fr 70px; grid-template-areas: "name bar total" "detail detail detail"; gap: 4px 10px; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
.hours-name { grid-area: name; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.hours-bar-wrap { grid-area: bar; background: #F0F4F3; border-radius: 999px; height: 12px; overflow: hidden; }
.hours-bar { height: 100%; border-radius: 999px; min-width: 2px; }
.hours-total { grid-area: total; font-weight: 800; color: var(--teal-deep); text-align: left; }
.hours-detail { grid-area: detail; font-size: 12px; color: var(--ink-soft); }
.event-card.readonly { cursor: default; }
.event-card.readonly:hover { box-shadow: none; transform: none; }
.day-single { max-width: 760px; }
.day-single .shift-block { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; padding: 10px 12px; }
.day-single .shift-label { font-size: 13px; }
.day-single .event-card { padding: 9px 12px; }
.day-single .ev-title { font-size: 15px; }
.group-count { font-weight: 600; color: var(--ink-soft); font-size: 13px; }
.month-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.month-dow { font-weight: 700; font-size: 13px; color: var(--ink-soft); text-align: center; padding: 4px 0; }
.month-cell { background: #fff; border: 1px solid var(--line); border-radius: 9px; min-height: 104px; padding: 5px 6px; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
.month-cell:hover { border-color: var(--teal); }
.month-cell.dim { background: #FAFBFA; opacity: .5; }
.month-cell.today { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(14,124,123,.16); }
.month-cell.holiday { background: #FCF3F4; }
.month-cell-head { display: flex; justify-content: space-between; align-items: center; }
.mc-day { font-weight: 700; font-size: 13.5px; }
.mc-hol { font-size: 11px; }
.mc-holname { font-size: 10.5px; color: #7A1F2B; font-weight: 700; }
.mc-ev { font-size: 10.5px; border-radius: 5px; padding: 1px 5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-more { font-size: 10px; color: var(--ink-soft); }
.mc-out { font-size: 10px; color: #0A5C5B; margin-top: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ----- סקירה ----- */
.dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.dash-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.dash-title { font-weight: 800; color: var(--teal-deep); margin-bottom: 10px; cursor: pointer; }
.dash-title:hover { text-decoration: underline; }
.dash-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
.dash-item:first-of-type { border-top: 0; }
.badge-over { background: #FBEDF0; color: #B5485D; font-size: 11.5px; font-weight: 800; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
.badge-soon { background: #FCF3E6; color: #B5762D; font-size: 11.5px; font-weight: 800; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
.badge-ok { background: #EAF3EE; color: #2A7D4F; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }

@media (max-width: 1100px) {
  .month-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 680px) {
  .month-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 1100px) { .board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 680px) {
  .board { grid-template-columns: 1fr; }
  .content { padding: 14px 12px 30px; }
  .topbar { padding: 12px 12px 0; }
}
`;
