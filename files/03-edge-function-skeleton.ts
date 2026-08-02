// ============================================================
// Supabase Edge Function: estimate-nutrition
// Holds the Claude API key server-side. The browser NEVER sees it.
//
// Deploy path (Claude Code will place it correctly):
//   supabase/functions/estimate-nutrition/index.ts
//
// The key is read from a Supabase secret, not from code:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// This is a SKELETON. Claude Code should:
//  - reuse the exact prompt/schema already in food-tracker.html
//    (estimateNutrition) rather than reinventing it
//  - verify the caller is an authenticated Supabase user before
//    spending tokens (auth check below)
//  - keep the model default on Haiku
// ============================================================

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Default to the cheap model; allow an override but keep it server-controlled.
const MODEL_DEFAULT = "claude-haiku-4-5-20251001";
const MODEL_ALLOWED = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-5", // opt-in upgrade path if Haiku proves not accurate enough
]);

const CORS = {
  "Access-Control-Allow-Origin": "*", // Claude Code: tighten to your Vercel domain in prod
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    // ---- 1. Verify the caller is a logged-in user (don't spend tokens for anonymous callers) ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ---- 2. Read the request from the browser ----
    // The client sends the SAME shape estimateNutrition already builds:
    //   { model?, messages: [...] }  where messages contains the text (and optionally image) content.
    const body = await req.json();
    const model = MODEL_ALLOWED.has(body.model) ? body.model : MODEL_DEFAULT;
    const messages = body.messages;
    if (!messages) {
      return new Response(JSON.stringify({ error: "Missing messages" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ---- 3. Call Claude with the server-held key ----
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 1000, messages }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(JSON.stringify({ error: "Estimate failed", detail }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // Return Claude's response through to the browser. The existing
    // client-side JSON-parsing of the text block stays exactly as it is.
    return new Response(JSON.stringify(data), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// Client-side change this enables (for reference — Claude Code applies it):
//
//   BEFORE (in food-tracker.html estimateNutrition):
//     fetch("https://api.anthropic.com/v1/messages", { ...withApiKey })
//
//   AFTER:
//     const { data:{ session } } = await supabase.auth.getSession();
//     fetch("<SUPABASE_URL>/functions/v1/estimate-nutrition", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${session.access_token}`,
//       },
//       body: JSON.stringify({ messages /*, model: "claude-sonnet-5" to upgrade */ }),
//     });
//
// Everything after the fetch (parsing the text block, the ×0.5/×2 review,
// the plan checks) is unchanged.
// ============================================================
