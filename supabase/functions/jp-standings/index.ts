// 전국대회 역대 결과(우승·준우승·4강) 갱신 — 일본어 위키백과 하루코·인터하이 글의 「結果」 표를 읽어 jp_results 에 없는 해를 넣음.
// 8강은 대진(jp_matches, jp-nat)에서. 사이트에 없는 해의 8강은 검색해 src 'manual:출처' 로 jp_matches 에 넣어 둠.
// 서버 예약 작업(x-cron)만 부를 수 있음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const WUA = { "User-Agent": "SNUVT-team-tool/1.0 (volleyball results; contact via github.com/suhyeok3691/SNUVT)" };
async function wikitext(title: string) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(`https://ja.wikipedia.org/w/api.php?format=json&formatversion=2&maxlag=5&action=parse&prop=wikitext&redirects=1&page=${encodeURIComponent(title)}`, { headers: WUA }); if (r.ok) { const j = await r.json(); return j.parse ? { title: j.parse.title, text: j.parse.wikitext as string } : null; } } catch (_) { /* 다시 */ }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return undefined;
}
// 위키백과 「結果」 표(회·년·개최지·우승·준우승·4강·4강)를 읽음. 셀은 「'''[[滋賀県立近江高等学校|近江]]'''（滋賀）」 꼴
const clean = (c: string) => c.replace(/<!--[\s\S]*?-->/g, "").replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1").replace(/\[\[([^\]]*)\]\]/g, "$1").replace(/'''|''/g, "").replace(/\{\{[^}]*\}\}/g, "").replace(/^[^|]*?\|(?=[^|]*$)/, (m) => /=/.test(m) ? "" : m).replace(/^[|!\s]+/, "").trim();
function parseTable(sec: string) {
  const out: { year: number; teams: { name: string; pref: string }[] }[] = [];
  for (const row of sec.split(/\n\|-[^\n]*/)) {
    const cells = row.split(/\n[|!]|\|\||!!/).map(clean).filter(Boolean);
    const yi = cells.findIndex((c) => /^(19|20)\d\d年?(度)?$/.test(c)); if (yi < 0) continue;
    const year = Number(cells[yi].slice(0, 4));
    const teams = cells.slice(yi + 1).map((c) => c.match(/^(.+?)\s*[（(]([^（）()]{1,5})[）)]$/)).filter(Boolean).map((m) => ({ name: m![1].trim(), pref: m![2].trim() }));
    if (teams.length >= 2) out.push({ year, teams: teams.slice(0, 4) });
  }
  return out;
}
function parseResults(t: string) {
  const i = t.search(/\n==\s*結果\s*==/); if (i < 0) return { m: [], w: [] };
  const rest = t.slice(i + 5), end = rest.search(/\n==[^=]/), sec = end < 0 ? rest : rest.slice(0, end);
  const wi = sec.search(/===\s*女子\s*===/);
  return { m: parseTable(wi < 0 ? sec : sec.slice(0, wi)), w: wi < 0 ? [] : parseTable(sec.slice(wi)) };
}
const WIKI: Record<string, string> = { haruko: "全日本バレーボール高等学校選手権大会", ih: "全国高等学校総合体育大会バレーボール競技大会" };
const nrm = (s: string) => (s || "").normalize("NFKC").replace(/\s+/g, "").replace(/(高等学校|高校)$/, "");
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.mode === "peek") {
    // 글 모양 확인용: 위키백과 대회 글의 「ベスト8・準々決勝・結果」 주변
    const w = await wikitext(String(body.title || ""));
    if (!w) return json({ title: body.title, found: w === null ? "missing" : "error" });
    const t = w.text, at = (re: RegExp) => { const m = t.search(re); return m < 0 ? "" : t.slice(Math.max(0, m - 200), m + 1800); };
    return json({ title: w.title, len: t.length, heads: (t.match(/^=+[^=\n]+=+$/gm) || []).slice(0, 40), best8: at(/ベスト8|準々決勝/), result: at(/==\s*(大会)?結果/) });
  }
  // 'wiki': 하루코·인터하이 역대 결과표에서 jp_results 에 없는 해를 넣음 (dry 면 비교만)
  const dry = !!body.dry, from = Number(body.from || 2010), out: any[] = [];
  const schools = ((await sb.from("jp_schools").select("id,name_ja,pref,aliases")).data || []) as any[];
  const sid = (name: string, pref: string) => { const n = nrm(name), c = schools.filter((s) => !pref || s.pref === pref.replace(/[県府都]$/, "")); return (c.find((s) => nrm(s.name_ja) === n || (s.aliases || []).some((a: string) => !a.startsWith("re:") && nrm(a) === n)) || {} as any).id || null; };
  for (const [tourn, title] of Object.entries(WIKI)) {
    const w = await wikitext(title); if (!w) { out.push({ tourn, error: w === null ? "missing" : "fetch" }); continue; }
    const pr = parseResults(w.text);
    const have = ((await sb.from("jp_results").select("gender,year,place,name_ja").eq("tourn", tourn)).data || []) as any[];
    for (const g of ["m", "w"] as const) for (const r of pr[g]) {
      if (r.year < from) continue;
      const old = have.filter((h) => h.gender === g && h.year === r.year);
      const rows = r.teams.map((t, i) => ({ tourn, gender: g, year: r.year, place: i === 0 ? 1 : i === 1 ? 2 : 3, name_ja: t.name, school_id: sid(t.name, t.pref) }));
      const same = old.length > 0 && rows.every((x) => old.some((o) => o.place === x.place && nrm(o.name_ja) === nrm(x.name_ja)));
      if (dry) { if (!same) out.push({ tourn, g, y: r.year, wiki: rows.map((x) => `${x.place}:${x.name_ja}${x.school_id ? "" : "?"}`).join(" "), db: old.map((o) => `${o.place}:${o.name_ja}`).join(" ") }); continue; }
      if (old.length) continue; // 이미 있는 해는 그대로
      const ins = await sb.from("jp_results").insert(rows); out.push({ tourn, g, y: r.year, n: rows.length, err: ins.error ? ins.error.message : undefined });
    }
  }
  return json({ mode: "wiki", dry, out });
});
