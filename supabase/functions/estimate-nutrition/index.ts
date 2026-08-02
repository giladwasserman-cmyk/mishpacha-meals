// ============================================================
// Supabase Edge Function: estimate-nutrition
//
// מחזיקה את מפתח ה-Claude API בצד השרת. הדפדפן לעולם לא רואה אותו.
// מבוססת על files/03-edge-function-skeleton.ts.
//
// פריסה:
//   supabase functions deploy estimate-nutrition
//
// סודות (לא בקוד, לא ב-repo):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set ALLOWED_ORIGINS=https://<הדומיין-שלך>.vercel.app
//
// SUPABASE_URL ו-SUPABASE_ANON_KEY מוזרקים אוטומטית לסביבת ההרצה.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ברירת מחדל למודל הזול. אפשר לעקוף, אבל רק לערך מהרשימה —
// כך שלקוח פרוץ לא יכול לבקש מודל יקר.
const MODEL_DEFAULT = "claude-haiku-4-5-20251001";
const MODEL_ALLOWED = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-5", // מסלול השדרוג אם Haiku לא יימצא מדויק מספיק
]);

const MAX_TOKENS = 1000; // כמו במקור (food-tracker.html:411)
const MAX_BODY_BYTES = 8 * 1024 * 1024; // תמונה ב-base64 תופחת פי ~1.33

// ---- CORS ----
// ברירת המחדל מתירה פיתוח מקומי ופריסות Vercel של הפרויקט הזה.
// בפרודקשן קבע ALLOWED_ORIGINS לרשימה מדויקת מופרדת בפסיקים.
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// כתובות רשת פרטית (RFC1918) — כדי שאפשר יהיה לבדוק מהטלפון
// מול שרת הפיתוח באותה רשת Wi-Fi, בלי לקבע IP שמשתנה.
// רלוונטי רק לענף ברירת המחדל; ברגע ש-ALLOWED_ORIGINS מוגדר,
// הרשימה המפורשת גוברת וזה מתבטל.
const PRIVATE_LAN =
  /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED.length) return ALLOWED.includes(origin);
  return /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    PRIVATE_LAN.test(origin) ||
    /^https:\/\/[\w-]*mishpacha-meals[\w-]*\.vercel\.app$/.test(origin);
}

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": isAllowed(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    // ---- 1. לוודא שהקורא מחובר, לפני שמוציאים טוקנים ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not authenticated" }, 401, origin);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Not authenticated" }, 401, origin);

    // ---- 2. קריאת הבקשה מהדפדפן ----
    // אותה צורה בדיוק ש-buildEstimateMessages בונה: { model?, messages }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413, origin);

    let body: { model?: string; messages?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const model = (body.model && MODEL_ALLOWED.has(body.model)) ? body.model : MODEL_DEFAULT;
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "Missing messages" }, 400, origin);
    }

    // ---- 3. קריאה לקלוד עם המפתח שיושב בשרת ----
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Server not configured" }, 500, origin);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages }),
    });

    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 500);
      console.error("anthropic error", resp.status, detail);
      return json({ error: "Estimate failed", status: resp.status, detail }, 502, origin);
    }

    // מחזירים את תשובת קלוד כמו שהיא. פענוח בלוק הטקסט
    // נשאר בצד הלקוח, ב-parseEstimate, בדיוק כמו במקור.
    return json(await resp.json(), 200, origin);

  } catch (e) {
    console.error("estimate-nutrition", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500, origin);
  }
});
