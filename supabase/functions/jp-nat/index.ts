// 전국대회(춘고·인터하이) 대진 모으기: koko-volley.com 의 '日程・結果' 글에서 모든 경기(라운드·학교·현)를 읽어 jp_matches 에 저장.
// jp-sync 가 이 표로 영상이 전국 본선인지 현 예선인지, 몇 회전인지 정함. 서버 예약 작업(x-cron)만 부를 수 있음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "ja-JP,ja;q=0.9" };
const BASE = "https://koko-volley.com/";
const get = async (p: string) => { const r = await fetch(BASE + p, { headers: UA }); return r.ok ? await r.text() : ""; };
const text = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").normalize("NFKC");
function roundOf(h: string): string | null {
  if (/3位決定/.test(h)) return "3rd";
  if (/準々決勝/.test(h)) return "QF";
  if (/準決勝/.test(h)) return "SF";
  if (/決勝トーナメント\s*1回戦/.test(h)) return "R1";
  if (/決勝/.test(h)) return "F";
  const m = h.match(/([1-6一二三四五六])回戦/); if (m) return "R" + ("1一".includes(m[1]) ? 1 : "2二".includes(m[1]) ? 2 : "3三".includes(m[1]) ? 3 : "4四".includes(m[1]) ? 4 : "5五".includes(m[1]) ? 5 : 6);
  if (/敗者復活/.test(h)) return "rep";
  if (/予選|グループ|リーグ/.test(h)) return "group";
  return null;
}
function parse(html: string) {
  const out: any[] = []; let rnd: string | null = null;
  for (let line of text(html).split("\n")) {
    line = line.trim(); if (!line) continue;
    const hd = line.match(/^※\s*(.+)$/); if (hd) { rnd = roundOf(hd[1]); continue; }
    if (!rnd) continue;
    const m = line.match(/^(.+?)\(([^()]{1,6})\)\s*(?:(\d)\s*(?:\([^)]*\))?\s*(\d)|vs|VS|-|ー|－|―)\s*(.+?)\(([^()]{1,6})\)\s*$/);
    if (m) out.push({ rnd, a_name: m[1].trim(), a_pref: m[2], a_sets: m[3] ? Number(m[3]) : null, b_sets: m[4] ? Number(m[4]) : null, b_name: m[5].trim(), b_pref: m[6] });
  }
  return out;
}
// 두 번째 출처: 春高バレー 연도별 일정·결과 글 (xn--8wv97xz6xo7h.online, 2021~). 「1回戦 [男子]」 아래 「09:30 A 2-1 B [B]」
const XN = "https://www.xn--8wv97xz6xo7h.online/";
function parseXn(html: string) {
  // 해마다 글 모양이 달라서: 「1月5日(火) 1回戦 [女子]」「決勝戦[男女]」「3回戦」 같은 제목 + 「09:30 (男子) A 2-1 B [女A]」「(女)」
  const t = text(html).replace(/\s+/g, " "), out: any[] = [];
  let rnd: string | null = null, g: string | null = null;
  const re = /(?:\d{1,2}月\d{1,2}日\s*[(（][^)）]{1,3}[)）]\s*)(1回戦|2回戦|3回戦|準々決勝|準決勝|決勝戦?)(?:\s*\[(男子|女子|男女|午前|午後)\])?|(?:^|\s)(1回戦|2回戦|3回戦|準々決勝|準決勝|決勝)\s*\[(男子|女子)\]|\d{1,2}:\d{2}\s+(?:(男子|女子)\s+)?([^\s\d:\[\]()（）][^\s\[\]()（）]*?)\s+(\d)\s*-\s*(\d)\s+([^\s\[\]()（）]+?)(?:\s*[\[(（](男|女)[^\])）]*[\])）])?(?=\s|$)/g;
  for (const m of t.matchAll(re)) {
    if (m[1] || m[3]) { rnd = roundOf(m[1] || m[3]); const gg = m[2] || m[4]; g = gg === "男子" ? "m" : gg === "女子" ? "w" : null; continue; }
    if (!rnd) continue;
    const gender = m[10] ? (m[10] === "男" ? "m" : "w") : m[5] ? (m[5] === "男子" ? "m" : "w") : g;
    if (!gender) continue;
    out.push({ rnd, gender, a_name: m[6], a_pref: null, a_sets: Number(m[7]), b_sets: Number(m[8]), b_name: m[9], b_pref: null });
  }
  return out;
}
// 세 번째 출처: 국민스포츠대회(国スポ·国体) 소년부 — zutto-sports.com 결과 글(해마다 같은 글에 쌓임).
// 「結果速報・滋賀国民スポーツ大会バレーボール2025」 아래 「少年男子 準決勝」「熊本(鎮西高) 3-2 福岡(選抜)」. 팀은 현 대표라 a_pref=현, a_name=「현(학교)」
const ZS = "https://zutto-sports.com/kokutai-volleyball-results";
const KRND: Record<string, string> = { "1回戦": "R1", "2回戦": "R2", "準々決勝": "QF", "準決勝": "SF", "3・4位決定戦": "3rd", "3位決定戦": "3rd", "決勝": "F" };
function parseKokutai(html: string) {
  // 칸(td·span)이 붙지 않게 태그를 빈칸으로 바꿈
  const t = text(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/ (\d) ?- ?(\d) /g, " $1-$2 "), out: any[] = [];
  let year: number | null = null, g: string | null = null, rnd: string | null = null;
  const re = /(?:国民スポーツ大会|国民体育大会|国スポ|国体)・?(?:バレーボール)?(?:競技は)?(20\d\d)|(少年男子|少年女子|成年男子|成年女子) (1回戦|2回戦|準々決勝|5・7位決定戦|準決勝|3・4位決定戦|3位決定戦|決勝)|([^\s()｜|]{2,4}) ?\(([^()\s]{1,12})\) (\d)-(\d) ([^\s()｜|]{2,4})(?: ?\(([^()\s]{1,12})\))?/g;
  for (const m of t.matchAll(re)) {
    if (m[1]) { year = Number(m[1]); continue; }
    if (m[2]) { g = m[2] === "少年男子" ? "m" : m[2] === "少年女子" ? "w" : null; rnd = KRND[m[3]] || null; continue; }
    if (!year || !g || !rnd) continue;
    const side = (pref: string, sch?: string) => ({ name: sch && sch !== "選抜" ? `${pref}(${sch})` : pref, pref });
    const a = side(m[4], m[5]), b = side(m[8], m[9]);
    out.push({ tourn: "kokutai", year, gender: g, rnd, a_name: a.name, a_pref: a.pref, a_sets: Number(m[6]), b_sets: Number(m[7]), b_name: b.name, b_pref: b.pref, src: ZS });
  }
  // 같은 경기가 두 번(목차·본문) 나오면 하나만
  const seen = new Set<string>();
  return out.filter((r) => { const k = `${r.year}|${r.gender}|${r.rnd}|${r.a_name}|${r.b_name}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const found = new Map<string, { tourn: string; gender: string; year: number; title: string }>();
  for (const [tourn, cat] of [["haruko", "blog-category-0"], ["ih", "blog-category-3"]]) {
    for (let i = 0; i < 40; i++) {
      const html = await get(i ? `${cat}-${i}.html` : `${cat}.html`); if (!html) break;
      let n = 0, all = 0;
      for (const m of html.matchAll(/href="(?:https:\/\/koko-volley\.com\/)?(blog-entry-\d+\.html)"[^>]*>\s*([^<]{4,80}?)\s*</g)) {
        all++; const t = m[2].normalize("NFKC"), r = t.match(/(春高バレー|インターハイ)\s*(男子|女子)\s*(\d{4})\s*日程/);
        if (r && !found.has(m[1])) { found.set(m[1], { tourn: r[1] === "春高バレー" ? "haruko" : "ih", gender: r[2] === "男子" ? "m" : "w", year: Number(r[3]), title: t }); n++; }
      }
      if (!all || !html.includes(`${cat}-${i + 1}.html`)) break;
    }
  }
  const res = [];
  for (const [page, e] of found) {
    const rows = parse(await get(page)).map((r) => ({ ...r, tourn: e.tourn, gender: e.gender, year: e.year, src: BASE + page }));
    if (!rows.length) { res.push({ page, ...e, n: 0 }); continue; }
    await sb.from("jp_matches").delete().eq("tourn", e.tourn).eq("gender", e.gender).eq("year", e.year);
    const ins = await sb.from("jp_matches").insert(rows);
    res.push({ page, tourn: e.tourn, gender: e.gender, year: e.year, n: rows.length, err: ins.error ? ins.error.message : undefined });
  }
  // 춘고: koko-volley 에 없는 해는 두 번째 출처에서
  const have = new Set(res.filter((r: any) => r.n).map((r: any) => `${r.tourn}|${r.gender}|${r.year}`));
  for (let y = 2019; y <= new Date().getFullYear() + 1; y++) {
    if (have.has(`haruko|m|${y}`) && have.has(`haruko|w|${y}`)) continue;
    const r = await fetch(`${XN}haruko-volleyball-${y}/`, { headers: UA }); if (!r.ok) continue;
    const rows = parseXn(await r.text());
    for (const g of ["m", "w"]) {
      if (have.has(`haruko|${g}|${y}`)) continue;
      const l = rows.filter((x) => x.gender === g).map((x) => ({ ...x, tourn: "haruko", year: y, src: `${XN}haruko-volleyball-${y}/` }));
      if (!l.length) continue;
      await sb.from("jp_matches").delete().eq("tourn", "haruko").eq("gender", g).eq("year", y);
      const ins = await sb.from("jp_matches").insert(l);
      res.push({ page: `xn haruko ${y}`, tourn: "haruko", gender: g, year: y, n: l.length, err: ins.error ? ins.error.message : undefined } as any);
    }
  }
  // 국민스포츠대회
  try {
    const r = await fetch(ZS, { headers: UA });
    const rows = r.ok ? parseKokutai(await r.text()) : [];
    for (const y of [...new Set(rows.map((x) => x.year))]) for (const g of ["m", "w"]) {
      const l = rows.filter((x) => x.year === y && x.gender === g); if (!l.length) continue;
      await sb.from("jp_matches").delete().eq("tourn", "kokutai").eq("gender", g).eq("year", y);
      const ins = await sb.from("jp_matches").insert(l);
      res.push({ page: "zutto kokutai", tourn: "kokutai", gender: g, year: y, n: l.length, err: ins.error ? ins.error.message : undefined } as any);
    }
  } catch (e) { res.push({ page: "zutto kokutai", error: String(e) } as any); }
  return json({ pages: found.size, res });
});
