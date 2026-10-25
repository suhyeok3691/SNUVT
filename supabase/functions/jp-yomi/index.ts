// 학교 이름 읽기(현지 발음) 찾기: 일본어 위키백과에서 학교 글을 찾아 첫 줄 괄호 안의 히라가나 읽기를 jp_schools.wiki 에 저장.
// (한글 이름은 이 읽기로 사람이 확인해 정함.) 서버 예약 작업(x-cron)만 부를 수 있음. body.limit 개씩.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "SNUVT-team-tool/1.0 (school name readings; contact via github.com/suhyeok3691/SNUVT)" };
const API = "https://ja.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&";
const PREF_FULL = (p: string) => p === "北海道" ? p : p === "東京" ? "東京都" : /^(京都|大阪)$/.test(p) ? p + "府" : p + "県";
async function api(q: string) { try { const r = await fetch(API + q, { headers: UA }); return r.ok ? await r.json() : null; } catch (_) { return null; } }
async function lookup(name: string, pref: string) {
  const base = name.replace(/(高等学校|高校)$/, "");
  const s = await api(`action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(`${base} 高等学校 ${PREF_FULL(pref)}`)}`);
  const hits: string[] = ((s && s.query && s.query.search) || []).map((x: any) => x.title).filter((t: string) => !/一覧|大学$|中学校$/.test(t) && /高等学校|高校|学園|学院/.test(t) && [...base].filter((c) => t.includes(c)).length >= Math.min(base.length, 2));
  for (const title of hits) {
    const e = await api(`action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`);
    const p = e && e.query && e.query.pages && e.query.pages[0]; const ex: string = (p && p.extract) || "";
    if (!ex.includes(PREF_FULL(pref)) && !ex.includes(pref)) continue; // 다른 현의 같은 이름 학교는 건너뜀
    const m = ex.match(/[（(]([ぁ-ゖー・\s、]+)[、,）)]/);
    if (m) return `${p.title}|${m[1].replace(/\s/g, "")}`;
  }
  return hits.length ? `${hits[0]}|?` : "?";
}
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const l = ((await sb.from("jp_schools").select("id,name_ja,pref").is("wiki", null).limit(body.limit || 60)).data || []) as any[];
  const deadline = Date.now() + 120000; let n = 0;
  for (let i = 0; i < l.length && Date.now() < deadline; i += 6) {
    await Promise.all(l.slice(i, i + 6).map(async (s) => { const w = await lookup(s.name_ja, s.pref); await sb.from("jp_schools").update({ wiki: w }).eq("id", s.id); n++; }));
  }
  return json({ done: n, left: l.length - n });
});
