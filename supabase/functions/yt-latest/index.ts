// 재생목록마다 유튜브 '마지막 업데이트' 날짜를 읽어 줌 (일부 공개 영상은 RSS에 안 나와서 재생목록 페이지를 읽음)
// 부른 사람의 로그인으로 videos 표를 읽으므로 RLS 그대로 → 자기 팀 재생목록만.
// 재생목록 안 영상(id · 제목, 재생목록 순서)도 돌려줌: 유튜브 퍼가기(videoseries)는 재생목록 변경이 늦게 반영돼서 앱이 이 목록으로 바로 틂
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
type Info = { updated: string | null; count: number | null; items: { id: string; t: string }[] };
const cache = new Map<string, { at: number; v: Info }>();
const unq = (x: string) => { try { return JSON.parse(`"${x}"`); } catch (_) { return x; } };
const MON: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function info(list: string) {
  const c = cache.get(list); if (c && Date.now() - c.at < 60 * 1000) return c.v;
  const v: Info = { updated: null, count: null, items: [] };
  try {
    const r = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en&gl=US`, { headers: { "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Cookie: "CONSENT=YES+1" } });
    const html = await r.text();
    const now = new Date();
    let m = html.match(/"text":"Last updated on "\},\{"text":"([A-Z][a-z]{2}) (\d{1,2}), (\d{4})"/);
    if (m && m[1] in MON) v.updated = ymd(new Date(Date.UTC(Number(m[3]), MON[m[1]], Number(m[2]))));
    else if ((m = html.match(/"(?:text|simpleText)":"(?:Last )?[Uu]pdated (today|yesterday|(\d+) days? ago)"/))) {
      const back = m[1] === "today" ? 0 : m[1] === "yesterday" ? 1 : Number(m[2]);
      v.updated = ymd(new Date(now.getTime() - back * 86400000));
    }
    const n = html.match(/"stats":\[\{"runs":\[\{"text":"([\d,]+)"\},\{"text":" videos?"\}/);
    if (n) v.count = Number(n[1].replace(/,/g, ""));
    // 영상 칸: 새 모양(lockupViewModel) · 예전 모양(playlistVideoRenderer) 둘 다
    const seen = new Set<string>();
    for (const part of html.split('"lockupViewModel":{').slice(1)) {
      const id = part.match(/"contentId":"([A-Za-z0-9_-]{11})","contentType":"LOCKUP_CONTENT_TYPE_VIDEO"/), t = part.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/);
      if (id && !seen.has(id[1])) { seen.add(id[1]); v.items.push({ id: id[1], t: t ? unq(t[1]) : "" }); }
    }
    if (!v.items.length) for (const m of html.matchAll(/"playlistVideoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g)) if (!seen.has(m[1])) { seen.add(m[1]); v.items.push({ id: m[1], t: unq(m[2]) }); }
  } catch (_) { /* 못 읽으면 null */ }
  cache.set(list, { at: Date.now(), v });
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await sb.from("videos").select("id,yt").eq("kind", "playlist").limit(40);
  if (error) return json({ error: error.message }, 400);
  const out: Record<string, Info> = {};
  await Promise.all((data || []).filter((v) => /^[A-Za-z0-9_-]{10,64}$/.test(v.yt || "")).map(async (v) => { out[v.id] = await info(v.yt); }));
  return json({ playlists: out });
});
