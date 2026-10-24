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
let schools: { id: string; pref: string; res: RegExp[] }[] = [];
// 전국대회 대진(jp_matches) · 역대 결과(jp_results): 영상이 전국 본선인지 현 예선인지 가름
type Side = { ids: string[]; raw: string };
let MATCH = new Map<string, { rnd: string; gender: string; a: Side; b: Side }[]>();
let RESULT = new Map<string, { place: number; id: string | null; g: string }[]>();
const idsOf = (name: string) => { const n = norm(name); return schools.filter((s) => s.res.some((re) => { re.lastIndex = 0; return re.test(n); })).map((s) => s.id); };
const rawOf = (name: string) => norm(name).replace(/(高等学校|高校)$/, "");
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function tag(title: string) {
  const t = norm(title);
  const body = norm(title.split(/[｜|]/)[0].replace(/#[^\s#]+/g, " "));
  let tourn: string | null = null;
  // 큰 대회 이름은 해시태그 말고 제목 본문에서 먼저 찾고, 여럿이면 먼저 나온 것 (#インターハイ2026 … #春高バレー → 인터하이)
  const BIG: [string, RegExp][] = [["haruko", /春高|春の高校バレー|高等学校選手権|全日本高校選手権/], ["ih", /インターハイ|インハイ|高校総体|総合体育大会/], ["kokutai", /国体|国民体育大会|国スポ|国民スポーツ大会/], ["sakura", /さくらバレー|全国私立高等学校|全国私学/]];
  const first = (x: string) => { let best: [string, number] | null = null; for (const [k, re] of BIG) { const m = x.match(re); if (m && (!best || m.index! < best[1])) best = [k, m.index!]; } return best ? best[0] : null; };
  if (/インカレ|大学|大学院/.test(t) && !/高校|高等学校/.test(t)) tourn = "univ";
  else if (/日本代表|VNL|ネーションズ|アジア(大会|選手権)|SVリーグ|Vリーグ|日本リーグ|天皇杯|オールスター|ドリームマッチ|JOC|JOS|TAURON|Lubin|エキシビション|ハイライト\||ワールドカップ|W杯|五輪|オリンピック|世界選手権|中学|さわやか杯|早慶|代表(MB|WS|OP|L)|全日本(?!高|バレーボール高等|ジュニア)/i.test(t)) tourn = "other";
  else if ((tourn = first(body) || first(t))) { /* 위에서 정함 */ }
  else if (/近畿総体/.test(t) && /2026/.test(t)) tourn = "ih";
  else if (/練習|潜入|密着/.test(t)) tourn = "practice";
  else if (/(九州|近畿|東北|関東|北信越|東海|中国|四国|北海道|中部日本)(総体|総合|選抜|大会|バレー|ブロック|インターハイ|新人)/.test(t)) tourn = "block";
  else if (/黒鷲旗/.test(t)) tourn = "other";
  else if (/新人/.test(t)) tourn = "other";
  else if (/さくらバレー|さくら杯|私学|私立高等学校|私立高校/.test(t)) tourn = "sakura";
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
  else if (t.match(/令和(元|\d{1,2})年/)) { const n = t.match(/令和(元|\d{1,2})年/)!; year = 2018 + (n[1] === "元" ? 1 : Number(n[1])); }
  else if (t.match(/平成(\d{1,2})年/)) year = 1988 + Number(t.match(/平成(\d{1,2})年/)![1]);
  else { const n = t.match(/第(\d{1,2})回/); if (n && tourn === "haruko") year = Number(n[1]) + (Number(n[1]) < 45 ? 1969 : 1948); else if (n && tourn === "ih") year = Number(n[1]) + 1953; }
  let gender: string | null = /女子|女バレ|ガールズ/.test(t) ? "w" : /男子|男バレ/.test(t) ? "m" : null;
  const hits: { id: string; a: number; b: number }[] = [];
  for (const s of schools) for (const re of s.res) { re.lastIndex = 0; let m; while ((m = re.exec(body))) { hits.push({ id: s.id, a: m.index, b: m.index + m[0].length }); if (!m[0].length) break; } }
  const keep = hits.filter((h) => !hits.some((o) => o.id !== h.id && o.a <= h.a && o.b >= h.b && (o.b - o.a) > (h.b - h.a)));
  const ids = [...new Set(keep.map((h) => h.id))];
  // ---- 위계: 전국 본선 vs 현 예선 ----
  // 학교 이름을 뺀 제목에 「鹿児島県男子」「県大会」「県高校総体」 같은 말이 있으면 현 대회
  let rest = body; for (const h of [...keep].sort((x, y) => y.a - x.a)) rest = rest.slice(0, h.a) + " " + rest.slice(h.b);
  const prefLocal = /[県都府](男子|女子|高等学校|高校総体|総体|大会|予選|代表|決勝|準決勝|準々決勝|バレー|新人)/.test(rest);
  if ((tourn === "haruko" || tourn === "ih") && !year && prefLocal) rnd = ["yosen", (rnd || "").split(":").filter((x) => x && x !== "yosen").join(":")].filter(Boolean).join(":");
  if (tourn === "kokutai" && year) {
    // 국민스포츠대회는 현 대표끼리: 제목의 현 이름(熊本·京都…)이나 학교로 대진을 찾음
    const ms = MATCH.get(`kokutai|${year}`) || [], set = new Set(ids);
    const hit = (sd: Side) => sd.ids.some((i) => set.has(i)) || (sd.raw.length >= 2 && body.includes(sd.raw));
    const found = ms.filter((m) => hit(m.a) && hit(m.b) && (!gender || m.gender === gender));
    if (found.length) { const m = found.find((f) => (rnd || "").split(":").includes(f.rnd)) || found[0]; rnd = m.rnd; gender = gender || m.gender; }
  }
  if ((tourn === "haruko" || tourn === "ih") && year && ids.length > 2) {
    // 학교가 셋 이상 나오면 한 경기 영상이 아님(예고·모음·두 경기 묶음): 대진으로 라운드를 붙이지 않고 제목 그대로
  } else if ((tourn === "haruko" || tourn === "ih") && year) {
    const key = `${tourn}|${year}`, ms = MATCH.get(key) || [], set = new Set(ids);
    const hit = (sd: Side) => sd.ids.some((i) => set.has(i)) || (sd.raw.length >= 2 && body.includes(sd.raw));
    const isVs = /vs|VS|Vs|対|×|\s[-ー－]\s/.test(title) || ids.length >= 2;
    const found = ms.filter((m) => hit(m.a) && hit(m.b) && (!gender || m.gender === gender));
    const strip = (r: string | null) => (r || "").split(":").filter((x) => x && x !== "yosen").join(":");
    if (found.length) {
      const m = found.find((f) => (rnd || "").split(":").includes(f.rnd)) || found[0];
      rnd = m.rnd; gender = gender || m.gender;
    } else if (prefLocal) {
      rnd = ["yosen", strip(rnd)].filter(Boolean).join(":");
    } else if (ms.length && isVs) {
      rnd = ["yosen", strip(rnd)].filter(Boolean).join(":");
    } else if (!ms.length && ids.length >= 2) {
      const rs = (RESULT.get(key) || []).filter((r) => !gender || r.g === gender), gs = [...new Set(rs.map((r) => r.g))];
      const r0 = (rnd || "").split(":"), pref = ids.map((i) => (schools.find((s) => s.id === i) || {} as any).pref);
      const sameP = pref.length >= 2 && pref[0] && pref.every((p) => p === pref[0]);
      // 결승: 그해 실제 우승·준우승 두 학교, 준결승: 둘 다 그해 4강
      const okF = gs.some((g) => rs.filter((r) => r.g === g && r.place <= 2).every((r) => set.has(r.id as string)));
      const okSF = gs.some((g) => ids.every((i) => rs.some((r) => r.g === g && r.id === i)));
      const badF = r0.includes("F") && !r0.includes("yosen") && rs.length && !okF;
      const badSF = r0.includes("SF") && !r0.includes("yosen") && rs.length && !okSF;
      if (sameP || badF || badSF) rnd = ["yosen", strip(rnd)].filter(Boolean).join(":");
    }
  }
  return { tourn, rnd, year, gender, schools: ids };
}
async function loadSchools() {
  const r = await sb.from("jp_schools").select("id,name_ja,aliases,pref");
  schools = ((r.data || []) as (S & { pref: string })[]).map((s) => ({ id: s.id, pref: s.pref, res: [s.name_ja, ...(s.aliases || [])].filter(Boolean).map((x) => x.startsWith("re:") ? new RegExp(x.slice(3), "g") : new RegExp(esc(norm(x)), "g")) }));
  MATCH = new Map(); RESULT = new Map();
  for (let from = 0; ; from += 1000) {
    const m = await sb.from("jp_matches").select("tourn,year,gender,rnd,a_name,b_name,a_pref,b_pref").range(from, from + 999);
    for (const x of m.data || []) {
      const k = `${x.tourn}|${x.year}`; if (!MATCH.has(k)) MATCH.set(k, []);
      // 국민스포츠대회: a_name 「大阪(清風高)」 → 학교는 괄호 안, raw 는 현 이름
      const side = (name: string, pref: string | null): Side => x.tourn === "kokutai" ? { ids: idsOf((name.match(/\(([^)]+)\)/) || [])[1] || "-"), raw: norm(pref || name) } : { ids: idsOf(name), raw: rawOf(name) };
      MATCH.get(k)!.push({ rnd: x.rnd, gender: x.gender, a: side(x.a_name, x.a_pref), b: side(x.b_name, x.b_pref) });
    }
    if ((m.data || []).length < 1000) break;
  }
  const rr = await sb.from("jp_results").select("tourn,year,place,school_id,gender");
  for (const x of rr.data || []) { const k = `${x.tourn}|${x.year}`; if (!RESULT.has(k)) RESULT.set(k, []); RESULT.get(k)!.push({ place: x.place, id: x.school_id, g: x.gender }); }
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

// ---------- 전국 대진의 결승·4강·8강 영상이 없으면 유튜브 검색으로 채움 (source 'search') ----------
let CTX: { ver: string; visitor: string; key: string } | null = null;
async function ytSearch(q: string) {
  // 검색 페이지는 동의 화면으로 돌려보내는 일이 있어서 innertube 검색 API 사용
  if (!CTX) { const fp = await firstPage({ id: "kurome", kind: "channel", ref: "@KUROMEvolleyballCH" }); CTX = { ver: fp.ver, visitor: fp.visitor, key: fp.key }; }
  const out: V[] = [];
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${CTX.key}&prettyPrint=false`, { method: "POST", headers: { ...UA, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: CTX.ver, hl: "ja", gl: "JP", visitorData: CTX.visitor } }, query: q, params: "EgIQAQ==" }) });
    walk(await r.json(), out, { t: null });
  } catch (_) { /* 이번엔 건너뜀 */ }
  return out;
}
const RND_JA: Record<string, string> = { F: "決勝", SF: "準決勝", QF: "準々決勝", "3rd": "3位決定戦" };
// 직캠·중계 풀영상만: 하이라이트·쇼츠·모음은 빼고, 길이를 알면 8분 이상
const NOT_FULL = /ハイライト|ダイジェスト|shorts|切り抜き|名場面|好プレー|スーパープレー|まとめ|highlight/i;
const secs = (len: string | null) => { if (!len) return null; const p = len.split(":").map(Number); return p.some(isNaN) ? null : p.reduce((a, x) => a * 60 + x, 0); };
const KW: Record<string, RegExp> = { haruko: /春高|春の高校バレー|高校選手権/, ih: /インターハイ|インハイ|総体/, kokutai: /国スポ|国体|国民スポーツ大会|国民体育大会/ };
async function fill(deadline: number) {
  const cy = new Date().getFullYear();
  const ms = ((await sb.from("jp_matches").select("tourn,year,gender,rnd,a_name,b_name,a_pref,b_pref").in("rnd", ["F", "SF", "QF", "3rd"]).gte("year", cy - 7)).data || []) as any[];
  const vids: any[] = [];
  for (let from = 0; ; from += 1000) { const r = await sb.from("jp_videos").select("id,title,tourn,year,rnd").in("tourn", ["haruko", "ih", "kokutai"]).gte("year", cy - 7).range(from, from + 999); vids.push(...(r.data || [])); if ((r.data || []).length < 1000) break; }
  const known = new Set(vids.map((v) => v.id));
  let searched = 0, added = 0;
  const order: Record<string, number> = { F: 0, SF: 1, "3rd": 2, QF: 3 };
  for (const m of ms.filter((x) => x.tourn !== "ih" || x.rnd !== "3rd").sort((a, b) => b.year - a.year || order[a.rnd] - order[b.rnd])) {
    if (Date.now() > deadline) break;
    // 두 팀을 알아보는 말: 하루코·인터하이는 학교 이름, 국민스포츠대회는 현 이름이나 학교 이름
    const names = (name: string, pref: string | null) => m.tourn === "kokutai" ? [norm(pref || name), ...((name.match(/\(([^)]+)\)/) || [])[1] ? [norm(name.match(/\(([^)]+)\)/)![1]).replace(/高$/, "")] : [])] : [rawOf(name)];
    const A = names(m.a_name, m.a_pref), B = names(m.b_name, m.b_pref);
    const pair = (title: string) => { const t = norm(title); return A.some((x) => t.includes(x)) && B.some((x) => t.includes(x)); };
    const same = vids.filter((v) => v.tourn === m.tourn && v.year === m.year);
    if (same.some((v) => pair(v.title) && (m.tourn !== "kokutai" || v.rnd === m.rnd))) continue;
    if (m.tourn !== "kokutai" && m.rnd === "F" && same.filter((v) => v.rnd === "F").length >= 2) continue;
    const g = m.gender === "w" ? "女子" : "男子";
    const qs = m.tourn === "kokutai"
      ? [`${m.year >= 2024 ? "国スポ" : "国体"}${m.year} 少年${g} ${A[0]} ${B[0]} ${RND_JA[m.rnd]}`, `${m.year >= 2024 ? "国スポ" : "国体"}${m.year} バレー ${A[A.length - 1]} ${B[B.length - 1]}`]
      : [`${m.tourn === "haruko" ? "春高" : "インターハイ"}${m.year} ${g} ${m.a_name} ${m.b_name} ${RND_JA[m.rnd]}`];
    let ok: V[] = [];
    for (const q of qs) {
      const items = await ytSearch(q); searched++;
      ok = items.filter((x) => {
        const t = norm(x.title), ys = [...t.matchAll(/20[0-3]\d/g)].map((y) => Number(y[0])), sec = secs(x.len);
        return !known.has(x.id) && pair(x.title) && KW[m.tourn].test(t) && !/予選|代表決定|ブロック/.test(t) && !NOT_FULL.test(t) && (sec === null || sec >= 480)
          && (!ys.length || ys.includes(m.year)) && !(m.gender === "m" && /女子/.test(t)) && !(m.gender === "w" && /男子/.test(t));
      }).slice(0, 6);
      if (ok.length) {
        // 다른 채널에서 이미 모은 영상이면 출처를 바꾸지 않음
        const ex = new Set(((await sb.from("jp_videos").select("id").in("id", ok.map((x) => x.id))).data || []).map((r: any) => r.id));
        ok.forEach((x) => ex.has(x.id) && known.add(x.id)); ok = ok.filter((x) => !ex.has(x.id));
      }
      if (ok.length) break;
    }
    if (ok.length) { await upsert({ id: "search" }, ok); added += ok.length; ok.forEach((x) => { known.add(x.id); vids.push({ id: x.id, title: x.title, tourn: m.tourn, year: m.year, rnd: m.rnd }); }); }
  }
  return { searched, added };
}

Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const mode = ["new", "full", "retag", "fill"].includes(body.mode) ? body.mode : "new";
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
  if (mode === "fill") return json({ mode, ...(await fill(deadline)) });
  const srcs = ((await sb.from("jp_sources").select("*")).data || []).filter((s: any) => s.kind !== "search");
  const res = [];
  for (const s of srcs) {
    if (Date.now() > deadline) break;
    if (mode === "full" && s.full_done) continue;
    try { res.push(await syncSource(s, mode, deadline)); } catch (e) { res.push({ id: s.id, error: String((e as Error).message || e).slice(0, 200) }); }
  }
  return json({ mode, res });
});
