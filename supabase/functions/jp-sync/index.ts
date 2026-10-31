// 일본 고교 배구 영상 모으기: 등록한 유튜브 채널·재생목록의 영상 목록을 읽어 jp_videos 에 쌓고,
// 제목에서 학교(jp_schools 이름·별칭)·대회·연도·라운드·남녀를 찾아 붙임. 서버 예약 작업(x-cron)만 부를 수 있음.
// mode: new(새 영상만, 기본) · full(처음부터 끝까지, 이어서) · retag(태그만 다시) · fill(전국 경기마다 더 찾기) · schools(학교별 검색) · ch(채널 이름·재생 가능 여부) · newschools(빠진 상대 학교 넣기) · chans(전국 경기 풀영상을 여러 개 올린 채널을 출처로 더하기)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "Accept-Language": "ja-JP,ja;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Cookie: "CONSENT=YES+1" };
type V = { id: string; title: string; published: string | null; len: string | null; ch?: string | null };
const runs = (x: any) => x?.runs?.[0]?.text ?? x?.simpleText ?? null;

function walk(o: any, out: V[], cont: { t: string | null }) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, out, cont); return; }
  const vr = o.videoRenderer || o.playlistVideoRenderer || o.gridVideoRenderer;
  if (vr && vr.videoId) {
    const title = vr.title?.runs?.map((r: any) => r.text).join("") ?? vr.title?.simpleText ?? "";
    const pub = vr.publishedTimeText?.simpleText ?? vr.videoInfo?.runs?.map((r: any) => r.text).join("") ?? null;
    out.push({ id: vr.videoId, title, published: pub, len: vr.lengthText?.simpleText ?? null, ch: runs(vr.ownerText) ?? runs(vr.longBylineText) ?? runs(vr.shortBylineText) });
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

async function firstPage(src: any, tab = "videos") {
  const url = src.kind === "channel" ? `https://www.youtube.com/${encodeURI(src.ref)}/${tab}?hl=ja&gl=JP` : `https://www.youtube.com/playlist?list=${encodeURIComponent(src.ref)}&hl=ja&gl=JP`;
  const html = await (await fetch(url, { headers: UA })).text();
  const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];
  const visitor = (html.match(/"VISITOR_DATA":"([^"]+)"/) || [])[1] || "";
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m || !key || !ver) throw new Error("page parse " + src.id);
  const out: V[] = [], cont = { t: null as string | null };
  walk(JSON.parse(m[1]), out, cont);
  // 채널 페이지는 영상마다 채널 이름이 없어서 페이지의 채널 이름을 씀
  const name = src.kind === "channel" ? JSON.parse(`"${(html.match(/"channelMetadataRenderer":\{"title":"((?:[^"\\]|\\.)*)"/) || [])[1] || ""}"`) || null : null;
  if (name) for (const v of out) v.ch = v.ch || name;
  return { key, ver, visitor, out, cont: cont.t, name };
}
async function nextPage(key: string, ver: string, visitor: string, token: string, name: string | null = null) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`, { method: "POST", headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: ver, hl: "ja", gl: "JP", visitorData: visitor } }, continuation: token }) });
  const out: V[] = [], cont = { t: null as string | null };
  walk(await r.json(), out, cont);
  if (name) for (const v of out) v.ch = v.ch || name;
  return { out, cont: cont.t };
}

// ---------- 태그 ----------
// 학교 이름: jp_schools.name_ja + aliases ('re:' 로 시작하면 정규식). 제목의 '｜' 뒤(선수 이름)와 #해시태그는 빼고 찾음.
// 짧은 이름이 긴 이름 안에 들어가면(鎮西 ⊂ 鎮西学院) 긴 쪽만.
type S = { id: string; name_ja: string; aliases: string[] };
let schools: { id: string; pref: string; res: RegExp[] }[] = [];
let schoolNames = new Map<string, string>();
// 전국대회 대진(jp_matches) · 역대 결과(jp_results): 영상이 전국 본선인지 현 예선인지 가름
type Side = { ids: string[]; raw: string };
let MATCH = new Map<string, { rnd: string; gender: string; a: Side; b: Side }[]>();
let RESULT = new Map<string, { place: number; id: string | null; g: string }[]>();
// 같은 이름을 여러 번 찾으므로 결과를 기억 (CPU 한도)
const IDS = new Map<string, string[]>();
const idsOf = (name: string) => { const n = norm(name); let r = IDS.get(n); if (!r) { r = schools.filter((s) => s.res.some((re) => { re.lastIndex = 0; return re.test(n); })).map((s) => s.id); IDS.set(n, r); } return r; };
const rawOf = (name: string) => norm(name).replace(/(高等学校|高校)$/, "");
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 제목 본문: 「｜」 뒤는 보통 선수 이름이라 빼지만, 「第1セット｜金蘭会 - 就実《決勝》…」처럼 앞이 세트 표시뿐이면 뒤를 씀
const mainOf = (title: string) => { const sg = title.split(/[｜|]/); return sg.length > 1 && /^\s*(第?\s*[0-9０-９一二三四五]+\s*セット目?|[0-9]+(st|nd|rd|th)?\s*set|フル|ノーカット)\s*$/i.test(sg[0]) ? sg.slice(1).join(" ") : sg[0]; };
// 올린 때(「9 か月前」「1 年前」)로 대회 해 후보: 하루코는 1월, 인터하이는 8월 대회
function pubYears(pub: string | null | undefined, tourn: string, at: string | null = null) {
  const m = (pub || "").replace(/\s/g, "").match(/(\d+)(年|か月|ヶ月|カ月|週間|日|時間|分)前/); if (!m) return [];
  const n = Number(m[1]), d = at ? new Date(at) : new Date();
  if (m[2] === "年") return [d.getFullYear() - n, d.getFullYear() - n - 1];
  if (/月/.test(m[2])) d.setMonth(d.getMonth() - n); else if (m[2] === "週間") d.setDate(d.getDate() - 7 * n); else if (m[2] === "日") d.setDate(d.getDate() - n);
  const y = d.getFullYear(), mo = d.getMonth() + 1;
  return tourn === "haruko" ? (mo >= 11 ? [y + 1, y] : [y, y - 1]) : [y, y - 1];
}
// pub: 유튜브의 「N か月前」, at: 그 글을 읽은 때(없으면 지금)
function tag(title: string, pub: string | null = null, at: string | null = null) {
  const t = norm(title);
  const body = norm(mainOf(title).replace(/#[^\s#]+/g, " "));
  let tourn: string | null = null;
  // 학교 탐방(잠입·밀착·연습 풍경)은 대회 영상이 아님: 「연습·탐방」으로
  const visit = VISIT.test(t);
  // 큰 대회 이름은 해시태그 말고 제목 본문에서 먼저 찾고, 여럿이면 먼저 나온 것 (#インターハイ2026 … #春高バレー → 인터하이)
  const BIG: [string, RegExp][] = [["haruko", /春高|春の高校バレー|高等学校選手権|全日本高校選手権/], ["ih", /インターハイ|インハイ|高校総体|総合体育大会/], ["kokutai", /国体|国民体育大会|国スポ|国民スポーツ大会/], ["sakura", /さくらバレー|全国私立高等学校|全国私学/]];
  const first = (x: string) => { let best: [string, number] | null = null; for (const [k, re] of BIG) { const m = x.match(re); if (m && (!best || m.index! < best[1])) best = [k, m.index!]; } return best ? best[0] : null; };
  if (visit) tourn = "practice";
  else if (/インカレ|大学|大学院/.test(t) && !/高校|高等学校/.test(t)) tourn = "univ";
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
  const repF = rnd === "yosen" && /代表決定/.test(t) && !/準々決勝|準決勝|[1-5一二三四五]回戦|ブロック/.test(t);
  if (/準々決勝/.test(t)) add("QF");
  else if (/準決勝/.test(t)) add("SF");
  else if (/3位|3・4位|3.4位/.test(t)) add("3rd");
  else if (/決勝/.test(t) && !/代表決定|予選/.test(t.replace(/決勝トーナメント/g, ""))) add("F");
  else if (/決勝/.test(t)) add("F");
  else { const r = t.match(/([1-5一二三四五])回戦/); if (r) add("R" + ("1一".includes(r[1]) ? 1 : "2二".includes(r[1]) ? 2 : "3三".includes(r[1]) ? 3 : "4四".includes(r[1]) ? 4 : 5)); }
  // 현 대표 결정전 = 현 결승
  if (repF && !/:/.test(rnd || "")) add("F");
  let year: number | null = null;
  // 하루코는 1월 대회라 현 예선이 전해 가을(6~12월)에 열림: 날짜(20251115·2025.11.15)나 「令和7年度」로 적힌 해는 대회 해(+1)로
  const late = (mo: number) => tourn === "haruko" && mo >= 6 ? 1 : 0;
  const dm = t.match(/(20[0-3]\d)(0[1-9]|1[0-2])[0-3]\d(?!\d)|(20[0-3]\d)[.\/-](1[0-2]|0?[1-9])[.\/-]\d{1,2}|(20[0-3]\d)年(1[0-2]|0?[1-9])月/);
  const dateY = dm ? Number(dm[1] || dm[3] || dm[5]) + late(Number(dm[2] || dm[4] || dm[6])) : null;
  const y = (dm ? t.replace(dm[0], " ") : t).match(/(20[0-3]\d)/);
  if (y) year = Number(y[1]);
  else if (dateY) year = dateY;
  else if (t.match(/第(\d{2})回(全日本バレーボール高等学校選手権|全日本高等学校バレーボール選手権|全日本高校バレー|春の高校バレー|春高)/)) { const n = Number(t.match(/第(\d{2})回(全日本|春)/)![1]); year = tourn === "haruko" && n >= 45 ? n + 1948 : null; }
  else if (t.match(/令和(元|\d{1,2})年/)) { const n = t.match(/令和(元|\d{1,2})年(度)?/)!; year = 2018 + (n[1] === "元" ? 1 : Number(n[1])) + (n[2] && tourn === "haruko" ? 1 : 0); }
  else if (t.match(/平成(\d{1,2})年/)) { const n = t.match(/平成(\d{1,2})年(度)?/)!; year = 1988 + Number(n[1]) + (n[2] && tourn === "haruko" ? 1 : 0); }
  // 「第N回」은 전국대회 회차일 때만 연도로 (「第74回長崎県高等学校総合体育大会」 같은 현 대회 회차는 다름)
  else if (!/[県都府道](高等学校|高校|総合体育|総体|大会|予選)/.test(t)) { const n = t.match(/第(\d{1,2})回/); if (n && tourn === "haruko") year = Number(n[1]) + (Number(n[1]) < 45 ? 1969 : 1948); else if (n && tourn === "ih") year = Number(n[1]) + 1953; }
  // 국민스포츠대회는 개최지로 연도를 앎 (「とちぎ国体」「青森国スポ」「第77回国体」)
  if (!year && tourn === "kokutai") {
    const v = t.match(/(和歌山|岩手|愛媛|福井|茨城|とちぎ|栃木|かごしま|鹿児島|さが|佐賀|SAGA|わたSHIGA|滋賀|SHIGA|青森)[^\s]{0,2}?(国体|国スポ)/i);
    const Y: Record<string, number> = { 和歌山: 2015, 岩手: 2016, 愛媛: 2017, 福井: 2018, 茨城: 2019, とちぎ: 2022, 栃木: 2022, かごしま: 2023, 鹿児島: 2023, さが: 2024, 佐賀: 2024, saga: 2024, わたshiga: 2025, 滋賀: 2025, shiga: 2025, 青森: 2026 };
    const n = t.match(/第(\d{2})回(国体|国民体育大会|国民スポーツ大会|国スポ)/);
    if (v) year = Y[v[1].toLowerCase()] || null; else if (n) year = Number(n[1]) + 1945;
  }
  // 아직 열리지 않은 대회 연도는 버림 (하루코는 다음 해 대회의 현 예선이 가을에 열려서 +1까지)
  if (year && year > new Date().getFullYear() + (tourn === "haruko" ? 1 : 0)) year = null;
  let gender: string | null = /女子|女バレ|ガールズ/.test(t) ? "w" : /男子|男バレ/.test(t) ? "m" : null;
  // 학교 이름은 띄어쓰기·「対」를 구분자(・)로 바꾼 제목에서 찾음: 「代表決定戦 相馬 対 郡山北工業」처럼 앞뒤가 한자여도 별칭 경계(앞이 한자가 아님)가 맞게
  const bodyS = mainOf(title).replace(/#[^\s#]+/g, " ").normalize("NFKC").trim().replace(/\s+/g, "・").replace(/対/g, "・対・");
  const hits: { id: string; a: number; b: number }[] = [];
  for (const s of schools) for (const re of s.res) { re.lastIndex = 0; let m; while ((m = re.exec(bodyS))) { hits.push({ id: s.id, a: m.index, b: m.index + m[0].length }); if (!m[0].length) break; } }
  const keep = hits.filter((h) => !hits.some((o) => o.id !== h.id && o.a <= h.a && o.b >= h.b && (o.b - o.a) > (h.b - h.a)));
  const ids = [...new Set(keep.map((h) => h.id))];
  // 지역 대회인데 고교가 하나도 안 나오면 실업·대학 대회(「近畿総合 サントリー vs 堺」)
  if (tourn === "block" && !ids.length && !/高校|高等学校/.test(t)) tourn = "other";
  // ---- 위계: 전국 본선 vs 현 예선 ----
  // 학교 이름을 뺀 제목에 「鹿児島県男子」「県大会」「県高校総体」 같은 말이 있으면 현 대회
  let rest = bodyS; for (const h of [...keep].sort((x, y) => y.a - x.a)) rest = rest.slice(0, h.a) + " " + rest.slice(h.b);
  const prefLocal = /[県都府](男子|女子|高等学校|高校総体|総体|大会|予選|代表|決勝|準決勝|準々決勝|バレー|新人)/.test(rest.replace(/・/g, ""));
  if ((tourn === "haruko" || tourn === "ih") && !year && prefLocal) rnd = ["yosen", (rnd || "").split(":").filter((x) => x && x !== "yosen").join(":")].filter(Boolean).join(":");
  // 국스포 블록 예선(「国スポ2025九州ブロック」·ミニ国体)은 본선 대진에 넣지 않음
  if (tourn === "kokutai" && /ブロック|予選|ミニ国体/.test(body)) rnd = ["yosen", (rnd || "").split(":").filter((x) => x && x !== "yosen").join(":")].filter(Boolean).join(":");
  else if (tourn === "kokutai" && year) {
    // 국민스포츠대회는 현 대표끼리: 제목의 현 이름(熊本·京都…)이나 학교로 대진을 찾음
    const ms = MATCH.get(`kokutai|${year}`) || [], set = new Set(ids);
    const hit = (sd: Side) => sd.ids.some((i) => set.has(i)) || (sd.raw.length >= 2 && body.includes(sd.raw));
    const found = ms.filter((m) => hit(m.a) && hit(m.b) && (!gender || m.gender === gender));
    if (found.length) { const m = found.find((f) => (rnd || "").split(":").includes(f.rnd)) || found[0]; rnd = m.rnd; gender = gender || m.gender; }
  }
  // 제목에 해가 없으면 올린 때로 짐작한 해 중, 그해 전국 대진에 두 학교가 맞붙은 경기가 있을 때만 그 해로
  if (!year && pub && (tourn === "haruko" || tourn === "ih") && ids.length === 2 && !prefLocal && rnd !== "yosen" && !(rnd || "").startsWith("yosen")) {
    const set = new Set(ids);
    for (const cy of pubYears(pub, tourn, at)) if ((MATCH.get(`${tourn}|${cy}`) || []).some((m) => m.a.ids.some((i) => set.has(i)) && m.b.ids.some((i) => set.has(i)) && (!gender || m.gender === gender))) { year = cy; break; }
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
  schoolNames = new Map(((r.data || []) as any[]).map((s) => [s.id, s.name_ja]));
  schools = ((r.data || []) as (S & { pref: string })[]).map((s) => ({ id: s.id, pref: s.pref, res: [s.name_ja, ...(s.aliases || [])].filter(Boolean).map((x) => x.startsWith("re:") ? new RegExp(x.slice(3), "g") : new RegExp(esc(norm(x)), "g")) }));
  MATCH = new Map(); RESULT = new Map(); IDS.clear();
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

// 경기 직캠·중계 풀영상만: 인터뷰·하이라이트·공식연습·선수 소개·뉴스·짧은 클립(8분 미만)은 안 담음
// (탐방 재생목록과 「연습·탐방」으로 태그된 영상은 그대로)
const VISIT = /潜入|密着|練習風景|練習メニュー|1日練習|部活紹介|部活動紹介|裏側|強さの秘訣|に迫る|vlog|BeeQuick/i;
const HARD = /インタビュー|会見|取材|試合後|表彰|閉会式|開会式|入場行進|ハイライト|ダイジェスト|shorts|切り抜き|名場面|好プレー|スーパープレー|プレー集|(スパイク|レシーブ|ブロック|サーブ|アタック|トス|ディグ)集|まとめ|highlight|優勝の瞬間|ラストポイント|勝ち上がり|予告|特集|ニュース|応援団|応援合戦|応援歌|応援メドレー|応援風景|振り返[りる]|校歌|斉唱|カモンロッソ|パブリックビューイング/i;
const SOFT = /公式練習|スパイク練習|サーブ練習|フリースパイク|メンバー紹介|選手紹介|サービスエース|マッチポイント|ウォーミングアップ|応援|のアップ|アップ風景|試合前アップ/;
const secs = (len: string | null) => { if (!len) return null; const p = len.split(":").map(Number); return p.some(isNaN) ? null : p.reduce((a, x) => a * 60 + x, 0); };
function notMatch(title: string, len: string | null) {
  const t = norm(title);
  if (HARD.test(t) || (SOFT.test(t) && !/セット|フル|全試合|full/i.test(t))) return true;
  const s = secs(len); return s !== null && s < 480;
}
// 「연습·탐방」은 학교 탐방(잠입·밀착)만 둠. 스파이크 연습 같은 짧은 연습 영상은 뺌
// 자동으로 더한 채널(id 'a-…', 아래 roleOf 로 'auto')은 배구 말고 다른 영상도 올리므로 고교 대회로 읽히고 학교가 나오는 영상만
const keepRow = (role: string | undefined, r: { title: string; len: string | null; tourn: string | null; schools?: string[] }) => role === "visit" || (role === "auto" ? !!r.tourn && !["other", "univ", "practice"].includes(r.tourn) && !!(r.schools || []).length && !notMatch(r.title, r.len) : r.tourn === "practice" ? VISIT.test(norm(r.title)) : !notMatch(r.title, r.len));

const roleOf = (src: { id: string; role?: string }) => src.id.startsWith("a-") ? "auto" : src.role;
async function upsert(src: any, vs: V[]) {
  if (!vs.length) return;
  const now = new Date().toISOString();
  const rows = vs.filter((v) => v.id && v.title).map((v) => ({ id: v.id, source: src.id, title: v.title, published: v.published, seen_at: now, len: v.len, ...(v.ch ? { ch: v.ch } : {}), ...tag(v.title, v.published) })).filter((r) => keepRow(roleOf(src), r));
  // 채널 이름을 모르는 영상은 ch 를 덮어쓰지 않게 따로
  for (const part of [rows.filter((r: any) => r.ch), rows.filter((r: any) => !r.ch)])
    for (let i = 0; i < part.length; i += 200) { const r = await sb.from("jp_videos").upsert(part.slice(i, i + 200), { onConflict: "id" }); if (r.error) throw r.error; }
}

let PAGES = 0;
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
    if (mode === "new" && (!src.full_done || fp.out.some((v) => known.has(v.id)))) { await sb.from("jp_sources").update({ synced_at: new Date().toISOString() }).eq("id", src.id); return { id: src.id, seen, pages, done: true }; }
    token = fp.cont;
  }
  // 한 번에 읽는 쪽 수를 제한 (CPU 한도). 다 못 읽으면 cursor 로 다음 번에 이어서
  while (token && Date.now() < deadline && PAGES < 45) {
    const np = await nextPage(fp.key, fp.ver, fp.visitor, token, fp.name); pages++; PAGES++;
    await upsert(src, np.out); seen += np.out.length;
    token = np.cont;
    if (!np.out.length) break;
  }
  const done = !token;
  await sb.from("jp_sources").update({ cursor: done ? null : token, full_done: src.full_done || done, synced_at: new Date().toISOString() }).eq("id", src.id);
  return { id: src.id, seen, pages, done };
}
// 채널의 「ライブ」 탭: 대표 결정전 같은 경기를 라이브로 올리면 동영상 탭에 안 나옴. 이미 있는 영상이 나올 때까지 읽음
async function syncStreams(src: any, deadline: number) {
  let fp;
  try { fp = await firstPage(src, "streams"); } catch (_) { return { id: src.id + ":live", seen: 0 }; }
  let out = fp.out, token = fp.cont, seen = 0;
  while (true) {
    const have = out.length ? await sb.from("jp_videos").select("id").in("id", out.map((v) => v.id)) : { data: [] };
    const known = new Set((have.data || []).map((r: any) => r.id));
    await upsert(src, out); seen += out.length;
    if (!token || out.some((v) => known.has(v.id)) || Date.now() > deadline || PAGES >= 45) break;
    const np = await nextPage(fp.key, fp.ver, fp.visitor, token, fp.name); out = np.out; token = np.cont; PAGES++;
    if (!out.length) break;
  }
  return { id: src.id + ":live", seen };
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
const KW: Record<string, RegExp> = { haruko: /春高|春の高校バレー|高校選手権/, ih: /インターハイ|インハイ|総体/, kokutai: /国スポ|国体|国民スポーツ大会|国民体育大会/ };
async function fill(deadline: number, only = "") {
  // 전국 대진(1회전~결승) 경기마다 검색어를 여러 개로 찾아, 채널이 4곳 될 때까지 영상을 더함. 오래 안 찾아본 경기부터, 같으면 최근 해·큰 라운드부터
  const cy = new Date().getFullYear();
  const ms = ((await sb.from("jp_matches").select("id,tourn,year,gender,rnd,a_name,b_name,a_pref,b_pref,searched_at").gte("year", cy - 7).limit(5000)).data || []) as any[];
  const vids: any[] = [];
  for (let from = 0; ; from += 1000) { const r = await sb.from("jp_videos").select("id,title,tourn,year,rnd,schools,source,ch").in("tourn", ["haruko", "ih", "kokutai"]).gte("year", cy - 7).range(from, from + 999); vids.push(...(r.data || [])); if ((r.data || []).length < 1000) break; }
  const known = new Set(vids.map((v) => v.id));
  // 제목 정규화는 한 번만 (경기마다 다시 하면 CPU 한도를 넘음)
  const byTY = new Map<string, any[]>();
  const addTY = (v: any) => { v.nt = norm(v.title); const k = v.tourn + "|" + v.year; if (!byTY.has(k)) byTY.set(k, []); byTY.get(k)!.push(v); };
  vids.forEach(addTY);
  let searched = 0, added = 0, matches = 0, nOther = 0; const clipS: string[] = []; const rej = { tourn: 0, year: 0, pair: 0, other: 0, clip: 0, known: 0 };
  const order: Record<string, number> = { F: 0, SF: 1, "3rd": 2, QF: 3, R5: 4, R4: 5, R3: 6, R2: 7, R1: 8 };
  ms.sort((a, b) => (a.searched_at || "").localeCompare(b.searched_at || "") || b.year - a.year || (order[a.rnd] ?? 9) - (order[b.rnd] ?? 9));
  // 'fill:haruko:2026' 처럼 대회·해를 좁혀 바로 돌릴 수도 있음. 한 번에 검색 25번까지(CPU 한도 2초), 나머지는 다음 번에
  const [ot, oy] = only.split(":");
  for (const m of ms) {
    if (Date.now() > deadline || searched >= 25) break;
    if ((ot && m.tourn !== ot) || (oy && m.year !== Number(oy))) continue;
    await sb.from("jp_matches").update({ searched_at: new Date().toISOString() }).eq("id", m.id); matches++;
    // 두 팀을 알아보는 말: 하루코·인터하이는 학교 이름(사전의 학교로도), 국민스포츠대회는 현 이름이나 학교 이름
    const inParen = (name: string) => (name.match(/\(([^)]+)\)/) || [])[1] || "";
    const names = (name: string, pref: string | null) => m.tourn === "kokutai" ? [norm(pref || name), ...(inParen(name) ? [norm(inParen(name)).replace(/高$/, "")] : [])] : [rawOf(name)];
    const idsOfSide = (name: string) => m.tourn === "kokutai" ? (inParen(name) ? idsOf(inParen(name)) : []) : idsOf(name);
    const A = names(m.a_name, m.a_pref), B = names(m.b_name, m.b_pref), Ai = idsOfSide(m.a_name), Bi = idsOfSide(m.b_name);
    const hitS = (ids: string[], raws: string[], sc: string[], t: string) => ids.some((i) => sc.includes(i)) || raws.some((x) => x.length >= 2 && t.includes(x));
    const pairN = (t: string, sc: string[]) => hitS(Ai, A, sc, t) && hitS(Bi, B, sc, t);
    const pair = (title: string, sc: string[]) => pairN(norm(title), sc);
    const have = (byTY.get(m.tourn + "|" + m.year) || []).filter((v) => pairN(v.nt, v.schools || []) && (m.tourn !== "kokutai" || v.rnd === m.rnd));
    const chans = new Set(have.map((v) => v.ch || v.source));
    if (chans.size >= 4) continue;
    const g = m.gender === "w" ? "女子" : "男子", rj = RND_JA[m.rnd] || "";
    // 사전의 정식 이름(「市尼崎」→「市立尼崎」)으로도 찾음. 제목에 해가 없는 영상도 있어 마지막 검색어는 해 없이(해는 올린 때로 맞춤)
    const canon = (ids: string[], raw: string) => { const s = ids.length ? schoolNames.get(ids[0]) : null; return s ? s.replace(/(高等学校|高校)$/, "") : raw; };
    const ca = canon(Ai, m.a_name), cb = canon(Bi, m.b_name);
    const kw = m.tourn === "haruko" ? "春高" : m.tourn === "ih" ? "インターハイ" : m.year >= 2024 ? "国スポ" : "国体";
    const qs = m.tourn === "kokutai"
      ? [`${kw}${m.year} 少年${g} ${A[0]} ${B[0]} ${rj}`, `${kw}${m.year} バレー ${A[A.length - 1]} ${B[B.length - 1]}`]
      : [...new Set([`${kw}${m.year} ${g} ${m.a_name} ${m.b_name} ${rj}`, `${ca} ${cb} ${kw} ${m.year}`, m.tourn === "haruko" ? `${ca} ${cb} 春高バレー ${g}` : `${ca} ${cb} インハイ バレー ${g}`,
        // 한쪽 학교만으로도(상대 이름을 줄여 쓰거나 다르게 쓴 제목), 결승~8강은 라운드만으로도(같은 해 다른 경기 영상도 함께 들어옴)
        `${ca} ${kw}${m.year} ${g} バレー`, `${cb} ${kw}${m.year} ${g} バレー`, ...(rj ? [`${m.tourn === "haruko" ? "春の高校バレー" : "インターハイ"}${m.year} ${g}${rj}`] : [])])];
    let ok: V[] = [], extra: V[] = [];
    for (const q of qs) {
      if (Date.now() > deadline || ok.length >= 4 - chans.size + 2 || searched >= 25) break;
      const items = await ytSearch(q.trim()); searched++;
      for (const x of items) {
        if (known.has(x.id) || ok.some((o) => o.id === x.id)) { rej.known++; continue; }
        const t = norm(x.title), ys = [...t.matchAll(/20[0-3]\d/g)].map((y) => Number(y[0]));
        // 같은 대회·같은 해로 읽히는 배구 경기 풀영상만 (국체·인터하이는 다른 종목도 있음)
        const tg = tag(x.title, x.published);
        if (tg.tourn !== m.tourn) { rej.tourn++; continue; }
        if (tg.year !== m.year) { rej.year++; continue; }
        if (m.tourn !== "haruko" && !/バレー|volley/i.test(t) && !tg.schools.length) continue;
        if (/成年|剣道|テニス|バスケ|サッカー|ハンド|ソフトボール|ビーチ/.test(t) || /予選|代表決定|ブロック/.test(t)) { rej.other++; continue; }
        if (notMatch(x.title, x.len)) { rej.clip++; if (clipS.length < 12 && tg.schools.length >= 2) clipS.push(`${x.len || "?"} ${x.title}`.slice(0, 90)); continue; }
        if (ys.length && !ys.includes(m.year) && !ys.includes(m.year - 1)) continue;
        // 같은 해 다른 전국 경기 영상(대진에서 라운드가 붙은 두 학교)도 버리지 않고 넣음
        if (!pair(x.title, tg.schools)) { if (tg.schools.length === 2 && tg.rnd && !tg.rnd.startsWith("yosen") && !extra.some((o) => o.id === x.id)) extra.push(x); else rej.pair++; continue; }
        if ((m.gender === "m" && /女子/.test(t)) || (m.gender === "w" && /男子/.test(t))) continue;
        ok.push(x);
      }
    }
    ok = [...ok.slice(0, 6), ...extra.filter((x) => !ok.some((o) => o.id === x.id))];
    if (ok.length) {
      // 다른 채널에서 이미 모은 영상이면 출처를 바꾸지 않음
      const ex = new Set(((await sb.from("jp_videos").select("id").in("id", ok.map((x) => x.id))).data || []).map((r: any) => r.id));
      ok = ok.filter((x) => !ex.has(x.id));
      nOther += ok.filter((x) => extra.includes(x)).length;
    }
    if (ok.length) { await upsert({ id: "search" }, ok); added += ok.length; ok.forEach((x) => { known.add(x.id); const tg = tag(x.title, x.published); addTY({ id: x.id, title: x.title, tourn: tg.tourn, year: tg.year, rnd: tg.rnd, schools: tg.schools, source: "search", ch: x.ch }); }); }
  }
  return { searched, added, otherMatch: nOther, matches, rej, clipS };
}

// ---------- 채널 더하기 (mode 'chans') ----------
// 검색으로 모은 영상 중 전국 본선 경기 풀영상을 3개 이상 올린 채널을 출처(id 'a-…')로 더함 → 'full' 이 그 채널의 영상 목록을 끝까지 읽음
async function addChans() {
  const cnt = new Map<string, { n: number; vid: string }>();
  for (let from = 0; ; from += 1000) {
    const r = await sb.from("jp_videos").select("id,ch,rnd").eq("source", "search").in("tourn", ["haruko", "ih", "kokutai"]).not("ch", "is", null).range(from, from + 999); const l = (r.data || []) as any[];
    for (const v of l) { if (!v.ch || !v.rnd || String(v.rnd).startsWith("yosen")) continue; const o = cnt.get(v.ch) || { n: 0, vid: v.id }; o.n++; cnt.set(v.ch, o); }
    if (l.length < 1000) break;
  }
  const srcs = ((await sb.from("jp_sources").select("id,ref,label")).data || []) as any[];
  const refs = new Set(srcs.map((s) => String(s.ref).toLowerCase())), labels = new Set(srcs.map((s) => s.label).filter(Boolean));
  const todo = [...cnt.entries()].filter(([ch, o]) => o.n >= 3 && !labels.has(ch)).sort((a, b) => b[1].n - a[1].n).slice(0, 40);
  const added: string[] = [];
  for (const [ch, o] of todo) {
    // oEmbed 의 author_url(https://www.youtube.com/@handle)로 채널 주소를 앎
    let url = ""; try { const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${o.vid}&format=json`); if (r.ok) url = (await r.json()).author_url || ""; } catch (_) { /* 건너뜀 */ }
    const ref = decodeURIComponent((url.match(/youtube\.com\/(@[^/?#]+|channel\/[^/?#]+)/) || [])[1] || "");
    if (!ref || refs.has(ref.toLowerCase())) continue;
    refs.add(ref.toLowerCase());
    const id = "a-" + ref.replace(/^@|^channel\//, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) + (/[^\x00-\x7f]/.test(ref) ? "-" + o.vid.slice(0, 4) : "");
    const r = await sb.from("jp_sources").insert({ id, kind: "channel", ref, label: ch, role: "match", full_done: false });
    if (!r.error) added.push(ch);
  }
  return { cands: todo.length, added };
}

// ---------- 빠진 상대 학교 넣기 (mode 'newschools') ----------
// 현 예선 영상 제목 「A vs B」·「A 対 B」에서 한쪽만 사전에 있으면 다른 쪽을 후보로(같은 현), 전국 대진에서 사전에 없는 학교도 후보로.
// 일본어 위키백과에 그 현의 「○○高等学校」 글이 있고 글 제목의 핵심 이름이 후보와 같을 때만 읽기(히라가나)와 함께 jp_schools 에 넣음 (note 'auto')
const PREF_FULL = (p: string) => p === "北海道" ? p : p === "東京" ? "東京都" : /^(京都|大阪)$/.test(p) ? p + "府" : p + "県";
const WUA = { "User-Agent": "SNUVT-team-tool/1.0 (school name readings; contact via github.com/suhyeok3691/SNUVT)" };
async function wapi(q: string) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch("https://ja.wikipedia.org/w/api.php?format=json&formatversion=2&maxlag=5&" + q, { headers: WUA }); if (r.ok) return await r.json(); } catch (_) { /* 다시 */ }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}
async function wikiSchool(name: string, pref: string) {
  // 글 제목을 바로 맞혀 보고(「埼玉県立深谷高等学校」「深谷高等学校」), 없으면 제목 검색(intitle)
  const PF = PREF_FULL(pref);
  const direct = [`${PF}立${name}高等学校`, `${name}高等学校`, `${PF}${name}高等学校`];
  const s = await wapi(`action=query&list=search&srlimit=8&srsearch=${encodeURIComponent(`intitle:${name}高等学校`)}`);
  const found: string[] = ((s && s.query && s.query.search) || []).map((x: any) => x.title);
  const titles = [...new Set([...direct, ...found])].filter((t) => /高等学校/.test(t) && !/一覧|中学校$|大学$/.test(t));
  const e = await wapi(`action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(titles.slice(0, 12).join("|"))}`);
  if (!s || !e) return undefined; // 위키백과가 응답하지 않음(요청 제한 등): 다음에 다시
  // 「○○県立…」 글을 먼저, 「深谷高等学校（…）は、日本の高等学校。」 같은 동음이의 글은 건너뜀
  const pages: any[] = ((e && e.query && e.query.pages) || []).sort((a: any, b: any) => Number((b.title || "").startsWith(PF)) - Number((a.title || "").startsWith(PF)));
  for (const pg of pages) {
    if (!pg || pg.missing || !pg.extract || /は、日本の(高等)?学校。/.test(pg.extract)) continue;
    const title: string = pg.title, ex: string = pg.extract;
    const core = title.replace(/^.*?[都道府県市町村]立/, "").replace(/高等学校.*$/, "");
    if (core !== name || !ex.includes(PF)) continue; // 다른 현의 같은 이름 학교는 건너뜀
    const m = ex.match(/[（(]([ぁ-ゖー・\s、]+)[、,）)]/); if (!m) continue;
    const kana = m[1].replace(/[\s・、]/g, "").replace(/^.*?(けんりつ|ふりつ|とりつ|どうりつ|しりつ|ちょうりつ|そんりつ)/, "").replace(/こうとうがっこう.*$/, "");
    if (kana.length < 2) continue;
    return { title, kana };
  }
  return null;
}
// 가나 → 한글 (규칙: 장음은 적지 않고, か·た행은 카·타, すん→순)
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const KK: Record<string, [string, string]> = {};
for (const [row, chars] of [["ㅇ", "あいうえお"], ["ㅋ", "かきくけこ"], ["ㄱ", "がぎぐげご"], ["ㅅ", "さしすせそ"], ["ㅈ", "ざじずぜぞ"], ["ㅌ", "たちつてと"], ["ㄷ", "だぢづでど"], ["ㄴ", "なにぬねの"], ["ㅎ", "はひふへほ"], ["ㅂ", "ばびぶべぼ"], ["ㅍ", "ぱぴぷぺぽ"], ["ㅁ", "まみむめも"], ["ㄹ", "らりるれろ"]]) [...chars].forEach((ch, i) => { KK[ch] = [row, "ㅏㅣㅜㅔㅗ"[i]]; });
Object.assign(KK, { "や": ["ㅇ", "ㅑ"], "ゆ": ["ㅇ", "ㅠ"], "よ": ["ㅇ", "ㅛ"], "わ": ["ㅇ", "ㅘ"], "を": ["ㅇ", "ㅗ"], "し": ["ㅅ", "ㅣ"], "ち": ["ㅊ", "ㅣ"], "つ": ["ㅊ", "ㅡ"], "す": ["ㅅ", "ㅡ"], "ず": ["ㅈ", "ㅡ"], "づ": ["ㅈ", "ㅡ"], "じ": ["ㅈ", "ㅣ"], "ぢ": ["ㅈ", "ㅣ"], "ふ": ["ㅎ", "ㅜ"] });
const YY: Record<string, string> = { "ゃ": "ㅑ", "ゅ": "ㅠ", "ょ": "ㅛ" }, SMV: Record<string, string> = { "ぁ": "ㅏ", "ぃ": "ㅣ", "ぅ": "ㅜ", "ぇ": "ㅔ", "ぉ": "ㅗ" };
function k2h(s0: string) {
  const s = [...s0].map((c) => c >= "ァ" && c <= "ヶ" ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);
  const out: any[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1] || "", l = out[out.length - 1];
    if (c === "ん" || c === "っ") { if (Array.isArray(l)) l[2] = c === "ん" ? "ㄴ" : "ㅅ"; i++; continue; }
    if (c === "ー") { i++; continue; }
    if (!KK[c]) { out.push(c); i++; continue; }
    if (Array.isArray(l) && !l[2] && ((("うお".includes(c)) && "ㅗㅛ".includes(l[1])) || (c === "う" && "ㅜㅠ".includes(l[1])) || (c === "い" && l[1] === "ㅣ" && l[0] !== "ㅇ"))) { i++; continue; }
    let [cho, jung] = KK[c];
    if (YY[n]) { jung = !"ㅅㅊㅈ".includes(cho) ? YY[n] : ({ "ㅑ": "ㅏ", "ㅠ": "ㅜ", "ㅛ": "ㅗ" } as any)[YY[n]]; if (c === "し") jung = YY[n]; i++; }
    else if (SMV[n]) { jung = (cho === "ㅇ" ? ({ "ㅔ": "ㅞ", "ㅣ": "ㅟ", "ㅏ": "ㅘ", "ㅗ": "ㅝ" } as any)[SMV[n]] : null) || SMV[n]; i++; if (cho === "ㅎ") cho = "ㅍ"; }
    if (jung === "ㅡ" && s[i + 1] === "ん") jung = "ㅜ";
    out.push([cho, jung, ""]); i++;
  }
  return out.map((x) => Array.isArray(x) ? String.fromCharCode(0xAC00 + (CHO.indexOf(x[0]) * 21 + JUNG.indexOf(x[1])) * 28 + JONG.indexOf(x[2])) : x).join("");
}
const RO: Record<string, string> = Object.fromEntries("あa いi うu えe おo かka きki くku けke こko がga ぎgi ぐgu げge ごgo さsa しshi すsu せse そso ざza じji ずzu ぜze ぞzo たta ちchi つtsu てte とto だda ぢji づzu でde どdo なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro わwa をo んn".split(" ").map((x) => [x[0], x.slice(1)]));
function romaji(k: string) {
  let o = ""; const s = [...k];
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || "";
    if (c === "っ") { o += (RO[n] || "")[0] || ""; continue; }
    let r = RO[c]; if (!r) continue;
    if ("ゃゅょ".includes(n) && n) { const y = ({ "ゃ": "a", "ゅ": "u", "ょ": "o" } as any)[n]; r = /^(shi|chi|ji)$/.test(r) ? r.slice(0, -1) + y : r.slice(0, -1) + "y" + y; i++; }
    o += r;
  }
  return o.replace(/ou/g, "o").replace(/uu/g, "u").replace(/oo/g, "o");
}
const OSEP = /\s*(?:vs\.?|VS\.?|Vs\.?|対|×|－|‐|\s-\s)\s*/;
const NOT_SCHOOL = /大学|中学|中$|クラブ|カップ|杯|遠征|選抜|リーグ|[県府都]$|代表|ジュニア|回戦|試合|決勝|予選|大会|セット|春高|バレー|男子|女子|定時制|高専|チーム|ブロック|後半|前半|総体|新人|地区|練習/;
function oppOf(title: string, known: string) {
  const t = title.normalize("NFKC").split(/[｜|]/)[0].replace(/#[^\s#]+/g, " ");
  const sp = t.split(OSEP), out: string[] = [];
  for (let i = 0; i < sp.length - 1; i++) {
    const L = sp[i].trim().split(/\s+/).pop() || "", R = sp[i + 1].trim().split(/\s+/)[0] || "";
    const li = idsOf(L), ri = idsOf(R);
    let o = li.includes(known) && !ri.length ? R : ri.includes(known) && !li.length ? L : "";
    o = o.replace(/[（(][^）)]*[）)]?/g, "").replace(/[【】\[\]「」『』〈〉<>＜＞]/g, "").replace(/(高等学校|高校|高)$/, "").replace(/[0-9①-⑨]+$/, "").replace(/^(県立|府立|都立|道立)/, "").trim();
    if (/^[一-龥々ヶぁ-んァ-ヴー]{2,8}$/.test(o) && !NOT_SCHOOL.test(o)) out.push(o);
  }
  return out;
}
async function newSchools(deadline: number) {
  // 1) 후보 모으기 (CPU 한도: 아직 안 본 후보가 20개 넘게 남았으면 건너뛰고 확인만)
  const pend = (await sb.from("jp_school_cand").select("name", { count: "exact", head: true }).is("status", null)).count || 0;
  const cnt = new Map<string, { name: string; pref: string; n: number; g: Set<string> }>();
  const addC = (name: string, pref: string, g: string | null) => { const k = name + "|" + pref; const o = cnt.get(k) || { name, pref, n: 0, g: new Set<string>() }; o.n++; if (g) o.g.add(g); cnt.set(k, o); };
  for (let from = 0; pend < 20; from += 1000) {
    const r = await sb.from("jp_videos").select("title,tourn,rnd,gender,schools").range(from, from + 999); const l = (r.data || []) as any[];
    for (const v of l) {
      if ((v.schools || []).length !== 1 || !String(v.rnd || "").split(":").includes("yosen") || v.tourn === "kokutai") continue;
      const pf = (schools.find((s) => s.id === v.schools[0]) || {} as any).pref; if (!pf) continue;
      for (const o of oppOf(v.title, v.schools[0])) addC(o, pf, v.gender);
    }
    if (l.length < 1000) break;
  }
  const cy = new Date().getFullYear();
  const mt = ((await sb.from("jp_matches").select("tourn,gender,a_name,a_pref,b_name,b_pref").in("tourn", ["haruko", "ih"]).gte("year", cy - 8).limit(5000)).data || []) as any[];
  if (pend < 20) for (const x of mt) for (const [nm, pf] of [[x.a_name, x.a_pref], [x.b_name, x.b_pref]]) if (pf && JP_PREF_OK(pf) && !idsOf(nm).length) { const b = norm(nm).replace(/(高等学校|高校)$/, ""); if (/^[一-龥々ヶぁ-んァ-ヴー]{2,8}$/.test(b)) addC(b, pf, x.gender); }
  const rows = [...cnt.values()].map((o) => ({ name: o.name, pref: o.pref, n: o.n, g: o.g.size === 1 ? [...o.g][0] : "mw" }));
  for (let i = 0; i < rows.length; i += 200) await sb.from("jp_school_cand").upsert(rows.slice(i, i + 200), { onConflict: "name,pref" });
  // 2) 아직 안 본 후보를 위키백과로 확인해 넣기
  const todo = ((await sb.from("jp_school_cand").select("name,pref,g").is("status", null).order("n", { ascending: false }).limit(60)).data || []) as any[];
  const have = ((await sb.from("jp_schools").select("id,name_ja,pref,wiki")).data || []) as any[];
  const ids = new Set(have.map((s) => s.id)); let added = 0, none = 0;
  // 위키백과는 한 번에 하나씩 (동시에 많이 물으면 요청 제한에 걸림)
  for (const c of todo) {
    if (Date.now() > deadline) break;
    await (async () => {
      const w = await wikiSchool(c.name, c.pref);
      if (w === undefined) { await new Promise((r) => setTimeout(r, 1500)); return; }
      // 이미 있는 학교(같은 위키 글이거나 같은 현의 같은 이름)는 넣지 않음
      const dup = w && have.find((s) => (s.wiki || "").split("|")[0] === w.title || (s.pref === c.pref && norm(s.name_ja).replace(/(高等学校|高校)$/, "") === c.name));
      if (dup) { await sb.from("jp_school_cand").update({ status: "dup", school_id: dup.id, tried_at: new Date().toISOString() }).eq("name", c.name).eq("pref", c.pref); return; }
      if (!w) { none++; await sb.from("jp_school_cand").update({ status: "none", tried_at: new Date().toISOString() }).eq("name", c.name).eq("pref", c.pref); return; }
      let id = romaji(w.kana) || c.name; if (ids.has(id)) id = id + "-" + romaji(PREF_KANA[c.pref] || "") ; if (ids.has(id)) id = id + "2"; ids.add(id);
      const short = [...c.name].length <= 3;
      const row = { id, name_ja: short && [...c.name].length <= 2 ? c.name + "高校" : c.name, aliases: short ? [`re:(?<![一-龥々ぁ-んァ-ヶ])${c.name}(?=高校|高等|vs|VS|Vs|×|対|[・\\-－ー()（）【】\\[\\]「」、,\\s]|$)`] : [], pref: c.pref, gender: c.g || "mw", kana: w.kana, name_ko: k2h(w.kana), wiki: `${w.title}|${w.kana}`, note: "auto" };
      const r = await sb.from("jp_schools").insert(row);
      await sb.from("jp_school_cand").update({ status: r.error ? "error" : "added", school_id: r.error ? null : id, wiki: `${w.title}|${w.kana}`, tried_at: new Date().toISOString() }).eq("name", c.name).eq("pref", c.pref);
      if (!r.error) added++;
    })();
  }
  return { cands: rows.length, pend, tried: todo.length, added, none };
}
const PREF_KANA: Record<string, string> = { 北海道: "ほっかいどう", 青森: "あおもり", 岩手: "いわて", 宮城: "みやぎ", 秋田: "あきた", 山形: "やまがた", 福島: "ふくしま", 茨城: "いばらき", 栃木: "とちぎ", 群馬: "ぐんま", 埼玉: "さいたま", 千葉: "ちば", 東京: "とうきょう", 神奈川: "かながわ", 新潟: "にいがた", 富山: "とやま", 石川: "いしかわ", 福井: "ふくい", 山梨: "やまなし", 長野: "ながの", 岐阜: "ぎふ", 静岡: "しずおか", 愛知: "あいち", 三重: "みえ", 滋賀: "しが", 京都: "きょうと", 大阪: "おおさか", 兵庫: "ひょうご", 奈良: "なら", 和歌山: "わかやま", 鳥取: "とっとり", 島根: "しまね", 岡山: "おかやま", 広島: "ひろしま", 山口: "やまぐち", 徳島: "とくしま", 香川: "かがわ", 愛媛: "えひめ", 高知: "こうち", 福岡: "ふくおか", 佐賀: "さが", 長崎: "ながさき", 熊本: "くまもと", 大分: "おおいた", 宮崎: "みやざき", 鹿児島: "かごしま", 沖縄: "おきなわ" };
const JP_PREF_OK = (p: string) => p in PREF_KANA;

// ---------- 학교별 경기 영상 찾기 (mode 'schools'): 현 대회 4강 이상 학교 중 오래 안 찾아본 학교부터 ----------
// 「현 이름 학교 バレー 男子」로 검색해, 제목을 태그했을 때 그 학교가 나오는 경기 풀영상만 (하이라이트·쇼츠·다른 종목·대학·중학 빼고)
async function schoolsFill(deadline: number, limit = 60) {
  const l = ((await sb.from("jp_schools").select("id,name_ja,pref,gender,searched_at").order("searched_at", { ascending: true, nullsFirst: true }).limit(limit)).data || []) as any[];
  let searched = 0, added = 0; const done: string[] = [];
  for (const s of l) {
    if (Date.now() > deadline) break;
    await sb.from("jp_schools").update({ searched_at: new Date().toISOString() }).eq("id", s.id);
    const base = s.name_ja.replace(/高校$/, ""), gs = s.gender === "mw" ? ["男子", "女子"] : [s.gender === "w" ? "女子" : "男子"];
    let ok: V[] = [];
    for (const g of gs) {
      const items = await ytSearch(`${s.pref} ${base} 高校 バレー ${g}`); searched++;
      ok.push(...items.filter((x) => {
        const t = norm(x.title), sec = secs(x.len), tg = tag(x.title, x.published);
        if (!tg.schools.includes(s.id) || tg.tourn === "univ" || tg.tourn === "other") return false;
        if (notMatch(x.title, x.len)) return false;
        if (/成年|剣道|テニス|バスケ|サッカー|ハンド|ソフトボール|ビーチ|野球|ラグビー|卓球|中学/.test(t)) return false;
        if (s.gender === "m" && /女子/.test(t)) return false;
        if (s.gender === "w" && /男子/.test(t)) return false;
        return true;
      }));
    }
    ok = [...new Map(ok.map((x) => [x.id, x])).values()].slice(0, 10);
    if (ok.length) {
      const ex = new Set(((await sb.from("jp_videos").select("id").in("id", ok.map((x) => x.id))).data || []).map((r: any) => r.id));
      ok = ok.filter((x) => !ex.has(x.id));
      if (ok.length) { await upsert({ id: "search" }, ok); added += ok.length; }
    }
    done.push(s.id);
  }
  return { searched, added, schools: done.length };
}

Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({})); PAGES = 0;
  const mode = ["new", "full", "retag", "fill", "schools", "ch", "newschools", "chans"].includes(body.mode) || /^fill:[a-z]+(:\d{4})?$/.test(body.mode || "") ? body.mode : "new";
  if (mode === "ch") {
    // 채널 이름이 비었거나 퍼가기 여부를 아직 모르는 영상: oEmbed 로 채움
    // 200 = 채널 이름, 401/403 = 채널 주인이 다른 사이트 재생을 막음(noembed), 404 = 지워졌거나 비공개(noembed)
    const dl = Date.now() + 100000; let n = 0; const skip = new Set<string>();
    while (Date.now() < dl) {
      const l = ((await sb.from("jp_videos").select("id,source,title,ch").or("ch.is.null,noembed.is.null").limit(60)).data || []).filter((v: any) => !skip.has(v.id)) as any[];
      if (!l.length) break;
      const got = await Promise.all(l.map(async (v) => { try { const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.id}&format=json`); return r.ok ? { ch: ((await r.json()).author_name || "").trim(), no: false } : [400, 401, 403, 404].includes(r.status) ? { ch: null, no: true } : null; } catch (_) { return null; } }));
      const rows = l.map((v, i) => got[i] ? { id: v.id, source: v.source, title: v.title, ch: got[i]!.ch || v.ch || "", noembed: got[i]!.no } : (skip.add(v.id), null)).filter(Boolean);
      if (rows.length) { await sb.from("jp_videos").upsert(rows, { onConflict: "id" }); n += rows.length; }
    }
    return json({ mode, filled: n });
  }
  if (mode === "chans") return json({ mode, ...(await addChans()) });
  await loadSchools();
  if (mode === "retag") {
    const ROLE = new Map((((await sb.from("jp_sources").select("id,role")).data || []) as any[]).map((x) => [x.id, roleOf(x)]));
    let n = 0; const drop: string[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await sb.from("jp_videos").select("id,source,title,len,published,added_at,seen_at").order("id").range(from, from + 999);
      const l = r.data || []; if (!l.length) break;
      const all = l.map((v: any) => ({ id: v.id, source: v.source, title: v.title, len: v.len, ...tag(v.title, v.published, v.seen_at || v.added_at) }));
      // 규칙이 바뀌어 이제 경기 풀영상이 아닌 것은 지움
      const bad = all.filter((v) => !keepRow(ROLE.get(v.source), v)).map((v) => v.id);
      const rows = all.filter((v) => !bad.includes(v.id)).map(({ len: _l, ...v }) => v);
      for (let i = 0; i < rows.length; i += 200) await sb.from("jp_videos").upsert(rows.slice(i, i + 200), { onConflict: "id" });
      drop.push(...bad); n += l.length; if (l.length < 1000) break;
    }
    // 다 읽은 뒤에 지움 (읽는 중에 지우면 다음 쪽이 밀림)
    for (let i = 0; i < drop.length; i += 200) await sb.from("jp_videos").delete().in("id", drop.slice(i, i + 200));
    const gone = drop.length;
    return json({ mode, retagged: n, removed: gone });
  }
  const deadline = Date.now() + 110000;
  if (mode.startsWith("fill")) return json({ mode, ...(await fill(deadline, mode.slice(5))) });
  if (mode === "schools") return json({ mode, ...(await schoolsFill(deadline)) });
  if (mode === "newschools") return json({ mode, ...(await newSchools(deadline)) });
  const srcs = ((await sb.from("jp_sources").select("*")).data || []).filter((s: any) => s.kind !== "search");
  const res = [];
  for (const s of srcs) {
    if (Date.now() > deadline) break;
    if (mode === "full" && s.full_done) continue;
    if (PAGES >= 45) break;
    try { res.push(await syncSource(s, mode, deadline)); } catch (e) { res.push({ id: s.id, error: String((e as Error).message || e).slice(0, 200) }); }
    if (s.kind === "channel" && Date.now() < deadline) { try { res.push(await syncStreams(s, deadline)); } catch (e) { res.push({ id: s.id + ":live", error: String((e as Error).message || e).slice(0, 200) }); } }
  }
  return json({ mode, res });
});
