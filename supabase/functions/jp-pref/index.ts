// 현 대회 결과 모으기: koko-volley.com 의 현별 카테고리(최근 글 5개: 하루코·인터하이·지역대회 현 예선)를 읽어
// 「■男子 / ※決勝 / 山形中央 3(25-18,…)0 山形城北」 줄을 jp_pref_matches 에 저장. 학교 목록(현 4강 이상)의 출처.
// 서버 예약 작업(x-cron)만 부를 수 있음. body.cats 로 일부 현만 돌릴 수 있음.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "ja-JP,ja;q=0.9" };
const BASE = "https://koko-volley.com/";
const get = async (p: string) => { try { const r = await fetch(BASE + p, { headers: UA }); return r.ok ? await r.text() : ""; } catch (_) { return ""; } };
const text = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").normalize("NFKC");
const PREFS = ["北海道", "青森", "秋田", "岩手", "山形", "宮城", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "神奈川", "東京", "山梨", "新潟", "長野", "富山", "石川", "福井", "静岡", "愛知", "岐阜", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "岡山", "広島", "鳥取", "島根", "山口", "香川", "徳島", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];
// 카테고리 번호 7(北海道) ~ 53(沖縄)
const CAT = (i: number) => `blog-category-${i + 7}.html`;
function roundOf(h: string): string | null {
  if (/決勝リーグ|決勝L|最終リーグ/.test(h)) return "FL";
  if (/3位決定|三位決定/.test(h)) return "3rd";
  if (/準々決勝/.test(h)) return "QF";
  if (/準決勝/.test(h)) return "SF";
  if (/代表決定/.test(h)) return "REP";
  if (/決勝/.test(h) && !/トーナメント/.test(h)) return "F";
  const m = h.match(/([1-8一二三四五六七八])回戦/); if (m) return "R" + ("1一".includes(m[1]) ? 1 : "2二".includes(m[1]) ? 2 : "3三".includes(m[1]) ? 3 : "4四".includes(m[1]) ? 4 : "5五".includes(m[1]) ? 5 : 6);
  if (/リーグ|予選|ブロック|グループ/.test(h)) return "group";
  return null;
}
function parse(html: string) {
  const out: any[] = []; let g: string | null = null, rnd: string | null = null, head = "";
  for (let line of text(html).split("\n")) {
    line = line.replace(/\s+/g, " ").trim(); if (!line) continue;
    if (/^■\s*男子/.test(line)) { g = "m"; rnd = null; continue; }
    if (/^■\s*女子/.test(line)) { g = "w"; rnd = null; continue; }
    const hd = line.match(/^※\s*(.+)$/); if (hd) { head = hd[1].slice(0, 40); rnd = roundOf(hd[1]); continue; }
    if (!g || !head) continue;
    const m = line.match(/^(.{1,20}?)\s*(\d)\s*(?:\([^)]*\))?\s*[-ー－]?\s*(\d)\s*(.{1,20})$/);
    if (m && !/\d{2}:\d{2}/.test(line)) {
      const a = m[1].trim(), b = m[4].trim();
      if (/[0-9()]/.test(a + b) || a === b) continue;
      out.push({ gender: g, rnd, head, a_name: a, b_name: b, a_sets: Number(m[2]), b_sets: Number(m[3]) });
    }
  }
  return out;
}
Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const idx: number[] = Array.isArray(body.cats) ? body.cats : PREFS.map((_, i) => i);
  const res: any[] = [], heads: Record<string, number> = {};
  for (let i = 0; i < idx.length; i += 6) {
    await Promise.all(idx.slice(i, i + 6).map(async (pi) => {
      const pref = PREFS[pi], html = await get(CAT(pi)); if (!html) { res.push({ pref, err: "category" }); return; }
      const posts = new Map<string, { tourn: string; year: number; title: string }>();
      for (const m of html.matchAll(/href="(?:https:\/\/koko-volley\.com\/)?(blog-entry-\d+\.html)"[^>]*>\s*([^<]{4,80}?)\s*</g)) {
        const t = m[2].normalize("NFKC");
        if (!new RegExp(`(?:^|\\s)${pref}(?:都|府|県)?\\s*予選`).test(t)) continue; // 東京都 안의 京都 는 빼고
        const y = t.match(/(20\d\d)/); if (!y) continue;
        const tourn = /春高/.test(t) ? "haruko" : /インターハイ|総体/.test(t) ? "ih" : "block";
        if (!posts.has(m[1])) posts.set(m[1], { tourn, year: Number(y[1]), title: t });
      }
      for (const [page, p] of posts) {
        const rows = parse(await get(page));
        for (const r of rows) if (!r.rnd) heads[r.head] = (heads[r.head] || 0) + 1;
        await sb.from("jp_pref_matches").delete().eq("src", BASE + page);
        if (rows.length) await sb.from("jp_pref_matches").insert(rows.map((r) => ({ ...r, pref, tourn: p.tourn, year: p.year, src: BASE + page })));
        res.push({ pref, title: p.title, n: rows.length });
      }
    }));
  }
  return json({ res, unknownHeads: Object.entries(heads).sort((a, b) => b[1] - a[1]).slice(0, 40) });
});
