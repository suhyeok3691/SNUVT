// 지역 대회 결과 모으기: koko-volley.com 의 지역 카테고리(東北·関東·北信越·東海·近畿·中国·四国·九州)에서
// 「九州大会 男子 2026 日程・結果」 같은 글을 읽어 「※決勝 / 東福岡(福岡) 0(27-29,23-25)2 大村工業(長崎)」 줄을 jp_block_matches 에 저장.
// 서버 예약 작업(x-cron)만 부를 수 있음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "ja-JP,ja;q=0.9" };
const BASE = "https://koko-volley.com/";
const get = async (p: string) => { try { const r = await fetch(BASE + p, { headers: UA }); return r.ok ? await r.text() : ""; } catch (_) { return ""; } };
const text = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").normalize("NFKC");
const REGIONS: [number, string][] = [[54, "東北"], [55, "関東"], [56, "北信越"], [57, "東海"], [58, "近畿"], [59, "中国"], [60, "四国"], [61, "九州"]];
function roundOf(h: string): string | null {
  if (/決勝リーグ|決勝L|最終リーグ/.test(h)) return "FL";
  if (/3位決定|三位決定/.test(h)) return "3rd";
  if (/準々決勝/.test(h)) return "QF";
  if (/準決勝/.test(h)) return "SF";
  if (/決勝/.test(h) && !/トーナメント/.test(h)) return "F";
  const m = h.match(/([1-6一二三四五六])回戦/); if (m) return "R" + ("1一".includes(m[1]) ? 1 : "2二".includes(m[1]) ? 2 : "3三".includes(m[1]) ? 3 : "4四".includes(m[1]) ? 4 : 5);
  if (/リーグ|予選|ブロック|グループ/.test(h)) return "group";
  return null;
}
// 「東福岡(福岡)」 → 이름, 현
const side = (s: string) => { const m = s.trim().match(/^(.{1,20}?)\s*\(([^)]{1,4})\)$/); return m ? [m[1].trim(), m[2]] : [s.trim(), null]; };
function parse(html: string, g0: string | null) {
  const out: any[] = []; let g = g0, rnd: string | null = null, head = "";
  for (let line of text(html).split("\n")) {
    line = line.replace(/\s+/g, " ").trim(); if (!line) continue;
    if (/^■\s*男子/.test(line)) { g = "m"; rnd = null; continue; }
    if (/^■\s*女子/.test(line)) { g = "w"; rnd = null; continue; }
    const hd = line.match(/^※\s*(.+)$/); if (hd) { head = hd[1].slice(0, 40); rnd = roundOf(hd[1]); continue; }
    if (!g || !head) continue;
    const m = line.match(/^(.{1,26}?)\s*(\d)\s*\([^)]*\)\s*(\d)\s*(.{1,26})$/) || line.match(/^(.{1,26}?)\s+(\d)\s*[-ー－]\s*(\d)\s+(.{1,26})$/);
    if (!m || /\d{1,2}:\d{2}/.test(line)) continue;
    const [an, ap] = side(m[1]), [bn, bp] = side(m[4]);
    if (/[0-9()]/.test(an + bn) || an === bn) continue;
    out.push({ gender: g, rnd, head, a_name: an, a_pref: ap, b_name: bn, b_pref: bp, a_sets: Number(m[2]), b_sets: Number(m[3]) });
  }
  return out;
}
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const res: unknown[] = [], done = new Set<string>();
  for (const [cat, region] of REGIONS) {
    const html = await get(`blog-category-${cat}.html`); if (!html) { res.push({ region, err: "category" }); continue; }
    const posts = new Map<string, string>();
    for (const m of html.matchAll(/href="(?:https:\/\/koko-volley\.com\/)?(blog-entry-\d+\.html)"[^>]*>\s*([^<]{4,80}?)\s*</g)) {
      const t = m[2].normalize("NFKC");
      if (/予選|出場校/.test(t) || !/(大会|選手権|選抜|総体|新人)/.test(t) || !/20\d\d/.test(t)) continue; // 현 예선·출전교 목록은 빼고
      if (!posts.has(m[1])) posts.set(m[1], t);
    }
    for (const [page, title] of posts) {
      // 옆 목록에 다른 지역 글도 섞여 나오므로 제목의 지역 이름을 먼저 봄
      const rg = (title.match(/東北|関東|北信越|東海|中部日本|近畿|中国|四国|九州/) || [region])[0].replace("中部日本", "東海");
      if (done.has(page)) continue; done.add(page);
      const year = Number(title.match(/(20\d\d)/)![1]);
      const g0 = /女子/.test(title) ? "w" : /男子/.test(title) ? "m" : null;
      const kind = title.replace(/20\d\d|男子|女子|日程・結果|日程|結果|[・|｜]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
      const rows = parse(await get(page), g0);
      await sb.from("jp_block_matches").delete().eq("src", BASE + page);
      if (rows.length) await sb.from("jp_block_matches").insert(rows.map((r) => ({ ...r, region: rg, kind, year, src: BASE + page })));
      res.push({ region: rg, title, n: rows.length });
    }
  }
  return json({ res });
});
