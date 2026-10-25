// 학교별 선수 명단: 하루코 출전 명단 페이지(春高バレー.online)를 읽어 jp_roster 에 저장 (번호·이름·학년·키·주장★).
// 출신 중학교는 저장하지 않음. 서버 예약 작업(x-cron)만 부를 수 있음. body.pages 로 다른 해 페이지를 줄 수 있음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "ja-JP,ja;q=0.9" };
const BASE = "https://www.xn--8wv97xz6xo7h.online/";
const PAGES = [
  { path: "haruko-member-danshi-2026/", gender: "m", tourn: "haruko", year: 2026 },
  { path: "volleyball-jyoshi-member-2026/", gender: "w", tourn: "haruko", year: 2026 },
];
// 등번호 앞의 흰 글씨 0(<span>0</span>1)은 붙이고, 🏐 같은 문자 참조는 지움
const text = (h: string) => h.replace(/<span[^>]*>0<\/span>/g, "0").replace(/&#x?[0-9a-f]+;/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr|table)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").normalize("NFKC");
function parse(html: string) {
  const out: { team: string; no: number; name: string; grade: number; height: number | null; cap: boolean }[] = [];
  let team = "";
  for (let line of text(html).split("\n")) {
    line = line.replace(/\s+/g, " ").trim(); if (!line) continue;
    const h = line.match(/(?:^|\s)([^\s()]{2,20})\s?\(([^)]*(?:回目|初出場)[^)]*)\)$/); if (h) { team = h[1]; continue; }
    if (!team) continue;
    const m = line.match(/^(\d{1,2}) (\S{2,12}(?: \S{1,8})?) ([123]) (\d{3})(?: \S+)?( ★)?$/);
    if (m && !out.some((x) => x.team === team && x.no === Number(m[1]))) out.push({ team, no: Number(m[1]), name: m[2].replace(/ /g, ""), grade: Number(m[3]), height: Number(m[4]) || null, cap: !!m[5] });
  }
  return out;
}
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const pages = Array.isArray(body.pages) ? body.pages : PAGES;
  const res: unknown[] = [];
  for (const p of pages) {
    let html = ""; try { const r = await fetch(BASE + p.path, { headers: UA }); if (r.ok) html = await r.text(); } catch (_) { /* 아래에서 기록 */ }
    if (!html) { res.push({ path: p.path, err: "fetch" }); continue; }
    const rows = parse(html);
    if (rows.length < 50) { res.push({ path: p.path, err: "few", n: rows.length }); continue; } // 명단이 아직 없으면 지우지 않음
    const src = BASE + p.path;
    await sb.from("jp_roster").delete().eq("src", src);
    const { error } = await sb.from("jp_roster").insert(rows.map((r) => ({ ...r, gender: p.gender, tourn: p.tourn, year: p.year, src })));
    res.push({ path: p.path, n: rows.length, teams: new Set(rows.map((r) => r.team)).size, error: error?.message });
  }
  await sb.rpc("jp_roster_link").then(() => {}, () => {});
  return json({ res });
});
