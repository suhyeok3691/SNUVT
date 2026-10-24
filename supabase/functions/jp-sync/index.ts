// 일본 고교 배구 영상 모으기: 등록한 유튜브 채널·재생목록의 영상 목록을 읽어 jp_videos 에 쌓고,
// 제목에서 학교(jp_schools 이름·별칭)·대회·연도·라운드·남녀를 찾아 붙임. 서버 예약 작업(x-cron)만 부를 수 있음.
// mode: new(새 영상만, 기본) · full(처음부터 끝까지, 이어서) · retag(태그만 다시)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "Accept-Language": "ja-JP,ja;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Cookie: "CONSENT=YES+1" };
type V = { id: string; title: string; published: string | null; len: string | null };

function walk(o: any, out: V[], cont: { t: string | null }) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, out, cont); return; }
  const vr = o.videoRenderer || o.playlistVideoRenderer || o.gridVideoRenderer;
  if (vr && vr.videoId) {
    const title = vr.title?.runs?.map((r: any) => r.text).join("") ?? vr.title?.simpleText ?? "";
    const pub = vr.publishedTimeText?.simpleText ?? vr.videoInfo?.runs?.map((r: any) => r.text).join("") ?? null;
    out.push({ id: vr.videoId, title, published: pub, len: vr.lengthText?.simpleText ?? null });
    return;
  }
  const lk = o.lockupViewModel;
  if (lk && lk.contentId && lk.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
    const md = lk.metadata?.lockupMetadataViewModel;
    const rows = JSON.stringify(md?.metadata || {});
    const pub = (rows.match(/"content":"([^"]*(?:前|ago)[^"]*)"/) || [])[1] || null;
    out.push({ id: lk.contentId, title: md?.title?.content ?? "", published: pub, len: null });
    return;
  }
  const c = o.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
  if (c && !cont.t) cont.t = c;
  for (const k in o) if (k !== "frameworkUpdates") walk(o[k], out, cont);
}

async function firstPage(src: any) {
  const url = src.kind === "channel" ? `https://www.youtube.com/${encodeURI(src.ref)}/videos?hl=ja&gl=JP` : `https://www.youtube.com/playlist?list=${encodeURIComponent(src.ref)}&hl=ja&gl=JP`;
  const html = await (await fetch(url, { headers: UA })).text();
  const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];
  const visitor = (html.match(/"VISITOR_DATA":"([^"]+)"/) || [])[1] || "";
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m || !key || !ver) throw new Error("page parse " + src.id);
  const out: V[] = [], cont = { t: null as string | null };
  walk(JSON.parse(m[1]), out, cont);
  return { key, ver, visitor, out, cont: cont.t };
}
async function nextPage(key: string, ver: string, visitor: string, token: string) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`, { method: "POST", headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: ver, hl: "ja", gl: "JP", visitorData: visitor } }, continuation: token }) });
  const out: V[] = [], cont = { t: null as string | null };
  walk(await r.json(), out, cont);
  return { out, cont: cont.t };
}

// ---------- 태그 ----------
// 학교 이름: jp_schools.name_ja + aliases ('re:' 로 시작하면 정규식). 제목의 '｜' 뒤(선수 이름)와 #해시태그는 빼고 찾음.
// 짧은 이름이 긴 이름 안에 들어가면(鎮西 ⊂ 鎮西学院) 긴 쪽만.
type S = { id: string; name_ja: string; aliases: string[] };
let schools: { id: string; res: RegExp[] }[] = [];
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function tag(title: string) {
  const t = norm(title);
  const body = norm(title.split(/[｜|]/)[0].replace(/#[^\s#]+/g, " "));
  let tourn: string | null = null;
  if (/インカレ|大学|大学院/.test(t) && !/高校|高等学校/.test(t)) tourn = "univ";
  else if (/日本代表|VNL|ネーションズ|アジア(大会|選手権)|SVリーグ|Vリーグ|天皇杯|オールスター|ドリームマッチ|JOC|JOS|TAURON|Lubin|ハイライト\|/.test(t)) tourn = "other";
  else if (/春高|春の高校バレー|高等学校選手権|全日本高校選手権/.test(t)) tourn = "haruko";
  else if (/インターハイ|インハイ|高校総体|総合体育大会/.test(t) || (/近畿総体/.test(t) && /2026/.test(t))) tourn = "ih";
  else if (/国体|国民体育大会|国スポ|国民スポーツ大会/.test(t)) tourn = "kokutai";
  else if (/練習|潜入|密着/.test(t)) tourn = "practice";
  else if (/(九州|近畿|東北|関東|北信越|東海|中国|四国|北海道|中部日本)(総体|総合|選抜|大会|バレー|ブロック|インターハイ|新人)/.test(t)) tourn = "block";
  else if (/黒鷲旗/.test(t)) tourn = "other";
  else if (/新人/.test(t)) tourn = "shinjin";
  else if (/選抜|私学/.test(t)) tourn = "senbatsu";
  let rnd: string | null = null;
  if (/予選|代表決定|県大会|地区大会|都大会|府大会|道大会/.test(t) && tourn !== "block") rnd = "yosen";
  const add = (x: string) => { rnd = (rnd ? rnd + ":" : "") + x; };
  if (/準々決勝/.test(t)) add("QF");
  else if (/準決勝/.test(t)) add("SF");
  else if (/3位|3・4位|3.4位/.test(t)) add("3rd");
  else if (/決勝/.test(t) && !/代表決定|予選/.test(t.replace(/決勝トーナメント/g, ""))) add("F");
  else if (/決勝/.test(t)) add("F");
  else { const r = t.match(/([1-5一二三四五])回戦/); if (r) add("R" + ("1一".includes(r[1]) ? 1 : "2二".includes(r[1]) ? 2 : "3三".includes(r[1]) ? 3 : "4四".includes(r[1]) ? 4 : 5)); }
  let year: number | null = null;
  const y = t.match(/(20[0-3]\d)/); if (y) year = Number(y[1]);
  else { const n = t.match(/第(\d{2})回/); if (n && tourn === "haruko") year = Number(n[1]) + 1948; else if (n && tourn === "ih") year = Number(n[1]) + 1953; }
  const gender = /女子|女バレ|ガールズ/.test(t) ? "w" : /男子|男バレ/.test(t) ? "m" : null;
  const hits: { id: string; a: number; b: number }[] = [];
  for (const s of schools) for (const re of s.res) { re.lastIndex = 0; let m; while ((m = re.exec(body))) { hits.push({ id: s.id, a: m.index, b: m.index + m[0].length }); if (!m[0].length) break; } }
  const keep = hits.filter((h) => !hits.some((o) => o.id !== h.id && o.a <= h.a && o.b >= h.b && (o.b - o.a) > (h.b - h.a)));
  return { tourn, rnd, year, gender, schools: [...new Set(keep.map((h) => h.id))] };
}
async function loadSchools() {
  const r = await sb.from("jp_schools").select("id,name_ja,aliases");
  schools = ((r.data || []) as S[]).map((s) => ({ id: s.id, res: [s.name_ja, ...(s.aliases || [])].filter(Boolean).map((x) => x.startsWith("re:") ? new RegExp(x.slice(3), "g") : new RegExp(esc(norm(x)), "g")) }));
}

async function upsert(src: any, vs: V[]) {
  if (!vs.length) return;
  const rows = vs.filter((v) => v.id && v.title).map((v) => ({ id: v.id, source: src.id, title: v.title, published: v.published, len: v.len, ...tag(v.title) }));
  for (let i = 0; i < rows.length; i += 200) { const r = await sb.from("jp_videos").upsert(rows.slice(i, i + 200), { onConflict: "id" }); if (r.error) throw r.error; }
}

async function syncSource(src: any, mode: string, deadline: number) {
  const fp = await firstPage(src);
  let seen = 0, pages = 1, token: string | null;
  if (mode === "full" && src.cursor) {
    token = src.cursor;
  } else {
    // 첫 페이지: 이미 있는 영상이 다 나오면 새 영상만 모드는 끝
    const have = await sb.from("jp_videos").select("id").in("id", fp.out.map((v) => v.id));
    const known = new Set((have.data || []).map((r: any) => r.id));
    await upsert(src, fp.out); seen += fp.out.length;
    if (mode === "new" && src.full_done && fp.out.some((v) => known.has(v.id))) { await sb.from("jp_sources").update({ synced_at: new Date().toISOString() }).eq("id", src.id); return { id: src.id, seen, pages, done: true }; }
    token = fp.cont;
  }
  while (token && Date.now() < deadline) {
    const np = await nextPage(fp.key, fp.ver, fp.visitor, token); pages++;
    await upsert(src, np.out); seen += np.out.length;
    token = np.cont;
    if (!np.out.length) break;
  }
  const done = !token;
  await sb.from("jp_sources").update({ cursor: done ? null : token, full_done: src.full_done || done, synced_at: new Date().toISOString() }).eq("id", src.id);
  return { id: src.id, seen, pages, done };
}

Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const mode = ["new", "full", "retag"].includes(body.mode) ? body.mode : "new";
  await loadSchools();
  if (mode === "retag") {
    let n = 0;
    for (let from = 0; ; from += 1000) {
      const r = await sb.from("jp_videos").select("id,source,title").order("id").range(from, from + 999);
      const l = r.data || []; if (!l.length) break;
      const rows = l.map((v: any) => ({ id: v.id, source: v.source, title: v.title, ...tag(v.title) }));
      for (let i = 0; i < rows.length; i += 200) await sb.from("jp_videos").upsert(rows.slice(i, i + 200), { onConflict: "id" });
      n += l.length; if (l.length < 1000) break;
    }
    return json({ mode, retagged: n });
  }
  const deadline = Date.now() + 110000;
  const srcs = (await sb.from("jp_sources").select("*")).data || [];
  const res = [];
  for (const s of srcs) {
    if (Date.now() > deadline) break;
    if (mode === "full" && s.full_done) continue;
    try { res.push(await syncSource(s, mode, deadline)); } catch (e) { res.push({ id: s.id, error: String((e as Error).message || e).slice(0, 200) }); }
  }
  return json({ mode, res });
});
