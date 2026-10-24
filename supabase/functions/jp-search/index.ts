// 유튜브 검색(일본어 검색어는 앱이 학교·대회 이름으로 만들어 줌). 부원만, 결과는 저장하지 않음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = { "Accept-Language": "ja-JP,ja;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Cookie: "CONSENT=YES+1" };
const cache = new Map<string, { at: number; v: unknown }>();

function collect(o: any, out: any[]) {
  if (!o || typeof o !== "object" || out.length >= 30) return;
  if (Array.isArray(o)) { for (const x of o) collect(x, out); return; }
  const v = o.videoRenderer;
  if (v && v.videoId) {
    out.push({ id: v.videoId, title: v.title?.runs?.map((r: any) => r.text).join("") ?? "", ch: v.ownerText?.runs?.[0]?.text ?? "", pub: v.publishedTimeText?.simpleText ?? "", len: v.lengthText?.simpleText ?? "" });
    return;
  }
  for (const k in o) collect(o[k], out);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const chk = await sb.from("jp_sources").select("id").limit(1);
  if (chk.error || !(chk.data || []).length) return json({ error: "members only" }, 403);
  const body = await req.json().catch(() => ({}));
  const q = String(body.q || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q) return json({ error: "q" }, 400);
  const c = cache.get(q); if (c && Date.now() - c.at < 30 * 60 * 1000) return json(c.v);
  const html = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=ja&gl=JP`, { headers: UA })).text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  const out: any[] = [];
  if (m) collect(JSON.parse(m[1]), out);
  const v = { q, items: out.slice(0, 24) };
  cache.set(q, { at: Date.now(), v });
  return json(v);
});
