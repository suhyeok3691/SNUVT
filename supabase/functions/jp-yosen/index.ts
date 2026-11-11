// 현 예선 영상 찾기 (예선 철에만): koko-volley 에서 모은 이번 현 예선 결승 · 준결승 · 3위전(jp_pref_matches)마다 유튜브를 찾아
// 두 학교가 다 나오는 경기 영상을 jp_videos 에 넣음. 일본어 제목뿐 아니라 영어(로마자) 제목도 학교 읽기(kana)로 알아봄
// (「Fukuoka Finals: Higashi Fukuoka vs. Fukuoka University Ohori | 2026.11.07」). 오래 안 찾은 경기부터, 한 번에 검색 24번.
// 서버 예약 작업(x-cron)만 부를 수 있음. 분류(학교 · 남녀 · 현 예선)는 DB 트리거 jp_video_prenat 도 한 번 더 바로잡음
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const UA = { "Accept-Language": "ja-JP,ja;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Cookie: "CONSENT=YES+1" };
const runs = (x: any) => x?.runs?.[0]?.text ?? x?.simpleText ?? null;
type V = { id: string; title: string; published: string | null; len: string | null; ch: string | null };
function walk(o: any, out: V[]) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, out); return; }
  const vr = o.videoRenderer;
  if (vr && vr.videoId) { out.push({ id: vr.videoId, title: vr.title?.runs?.map((r: any) => r.text).join("") ?? "", published: vr.publishedTimeText?.simpleText ?? null, len: vr.lengthText?.simpleText ?? null, ch: runs(vr.ownerText) ?? runs(vr.longBylineText) }); return; }
  for (const k in o) if (k !== "frameworkUpdates") walk(o[k], out);
}
let CTX: { key: string; ver: string; visitor: string } | null = null;
async function ytSearch(q: string): Promise<V[]> {
  if (!CTX) {
    const html = await (await fetch("https://www.youtube.com/results?search_query=" + encodeURIComponent("春高バレー") + "&hl=ja&gl=JP", { headers: UA })).text();
    const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1], ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];
    if (!key || !ver) throw new Error("youtube page");
    CTX = { key, ver, visitor: (html.match(/"VISITOR_DATA":"([^"]+)"/) || [])[1] || "" };
  }
  const out: V[] = [];
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${CTX.key}&prettyPrint=false`, { method: "POST", headers: { ...UA, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: CTX.ver, hl: "ja", gl: "JP", visitorData: CTX.visitor } }, query: q, params: "EgIQAQ==" }) });
    walk(await r.json(), out);
  } catch (_) { /* 이번 검색만 건너뜀 */ }
  return out;
}
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RO: Record<string, string> = Object.fromEntries("あa いi うu えe おo かka きki くku けke こko がga ぎgi ぐgu げge ごgo さsa しshi すsu せse そso ざza じji ずzu ぜze ぞzo たta ちchi つtsu てte とto だda ぢji づzu でde どdo なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro わwa をo んn".split(" ").map((x) => [x[0], x.slice(1)]));
function romaji(k: string) {
  let o = ""; const s = [...k.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))];
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || "";
    if (c === "っ") { o += (RO[n] || "")[0] || ""; continue; }
    let r = RO[c]; if (!r) continue;
    if (n && "ゃゅょ".includes(n)) { const y = ({ ゃ: "a", ゅ: "u", ょ: "o" } as any)[n]; r = /^(shi|chi|ji)$/.test(r) ? r.slice(0, -1) + y : r.slice(0, -1) + "y" + y; i++; }
    o += r;
  }
  return o;
}
const romN = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "").replace(/ou/g, "o").replace(/oo/g, "o").replace(/uu/g, "u");
// 영어 제목 단어 묶음(1~4 단어)이 학교 로마자와 같은가
const enHas = (title: string, rom: string) => { if (rom.length < 5) return false; const w = title.normalize("NFKC").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  for (let i = 0; i < w.length; i++) for (let n = 1; n <= 4 && i + n <= w.length; n++) if (romN(w.slice(i, i + n).join("")) === rom) return true; return false; };
// 경기 영상이 아닌 것 (하이라이트 · 인터뷰 · 같이 보기 · 짧은 클립)
const NOT = /インタビュー|ハイライト|ダイジェスト|shorts|切り抜き|名場面|まとめ|highlight|interview|同時視聴|生観戦|リアクション|reaction|吹奏楽|応援/i;
const secs = (len: string | null) => { if (!len) return null; const p = len.split(":").map(Number); return p.some(isNaN) ? null : p.reduce((a, x) => a * 60 + x, 0); };
const RND: Record<string, string> = { F: "F", REP: "F", SF: "SF", "3rd": "3rd", QF: "QF" };
const RJ: Record<string, string> = { F: "決勝", SF: "準決勝", "3rd": "3位決定戦", QF: "準々決勝" };

Deno.serve(async (req) => {
  const { data: kd } = await sb.rpc("push_keys"); const k = (Array.isArray(kd) ? kd[0] : kd) || {};
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  // 예선 철: 하루코 = 8~12월(대회는 다음 해 1월), 인터하이 = 4~7월. 다른 때는 쉼 (body.tourn · body.year 로 직접 줄 수 있음)
  const now = new Date(), mo = now.getMonth() + 1, y = now.getFullYear();
  const tourn: string | null = body.tourn || (mo >= 8 ? "haruko" : mo >= 4 && mo <= 7 ? "ih" : null), year: number = body.year || (tourn === "haruko" ? y + 1 : y);
  if (!tourn) return json({ skip: "not yosen season" });
  const kw = tourn === "haruko" ? "春高" : "インターハイ", deadline = Date.now() + 120000, maxQ = Number(body.max) || 24;
  const sc = ((await sb.from("jp_schools").select("id,name_ja,aliases,pref,gender,kana")).data || []) as any[];
  const S = sc.map((s) => ({ ...s, base: s.name_ja.replace(/(高等学校|高校)$/, ""), rom: s.kana ? romN(romaji(s.kana)) : "", res: [s.name_ja, s.name_ja.replace(/(高等学校|高校)$/, ""), ...(s.aliases || [])].filter(Boolean).map((x: string) => x.startsWith("re:") ? new RegExp(x.slice(3)) : new RegExp(esc(norm(x)))) }));
  // 대진의 학교 이름(「東福岡」「福大大濠」) → 같은 현 학교
  const find = (name: string, pref: string) => { const n = norm(name); return S.find((s) => s.pref === pref && (s.base === n || s.name_ja === n || s.res.some((re: RegExp) => re.test(n)))) || null; };
  const ms = ((await sb.from("jp_pref_matches").select("id,pref,gender,rnd,head,a_name,b_name,searched_at").eq("tourn", tourn).eq("year", year).in("rnd", Object.keys(RND))
    .order("searched_at", { ascending: true, nullsFirst: true }).limit(200)).data || []) as any[];
  ms.sort((a, b) => (a.searched_at || "").localeCompare(b.searched_at || "") || ["F", "REP", "SF", "3rd", "QF"].indexOf(a.rnd) - ["F", "REP", "SF", "3rd", "QF"].indexOf(b.rnd));
  let q = 0, added = 0, matches = 0; const got: string[] = [];
  for (const m of ms) {
    if (q >= maxQ || Date.now() > deadline) break;
    await sb.from("jp_pref_matches").update({ searched_at: new Date().toISOString() }).eq("id", m.id); matches++;
    const A = find(m.a_name, m.pref), B = find(m.b_name, m.pref), g = m.gender === "w" ? "女子" : "男子", rj = RJ[RND[m.rnd]] || "";
    const an = A ? A.base : m.a_name, bn = B ? B.base : m.b_name;
    const qs = [`${an} ${bn} ${kw} ${year} ${g}`, `${kw} ${year} ${m.pref} ${rj} ${g}`, ...(A && B && A.rom && B.rom ? [`${A.rom} ${B.rom} volleyball`] : [])];
    const hitS = (t: string, x: any, raw: string) => x ? (x.res.some((re: RegExp) => re.test(norm(t))) || enHas(t, x.rom)) : norm(t).includes(norm(raw));
    const ok: V[] = [];
    for (const qq of qs) {
      if (q >= maxQ || Date.now() > deadline) break;
      q++;
      for (const v of await ytSearch(qq)) {
        if (ok.some((o) => o.id === v.id) || NOT.test(v.title)) continue;
        const s = secs(v.len); if (s !== null && s < 480) continue;
        const t = v.title.normalize("NFKC");
        if (!hitS(t, A, m.a_name) || !hitS(t, B, m.b_name)) continue;
        if (m.gender === "m" && /女子|women|girls/i.test(t) || m.gender === "w" && /男子|\bmen\b|boys/i.test(t)) continue;
        const ys = [...t.matchAll(/20[0-3]\d/g)].map((x) => Number(x[0])); if (ys.length && !ys.some((x) => x === year || x === year - 1)) continue;
        ok.push(v);
      }
    }
    if (!ok.length) continue;
    const have = new Set((((await sb.from("jp_videos").select("id").in("id", ok.map((v) => v.id))).data) || []).map((r: any) => r.id));
    const rows = ok.filter((v) => !have.has(v.id)).map((v) => ({ id: v.id, source: "search", title: v.title, published: v.published, len: v.len, ch: v.ch, seen_at: new Date().toISOString(),
      tourn, year, gender: m.gender, rnd: "yosen:" + RND[m.rnd], schools: [A?.id, B?.id].filter(Boolean) }));
    if (rows.length) { const r = await sb.from("jp_videos").upsert(rows, { onConflict: "id", ignoreDuplicates: true }); if (!r.error) { added += rows.length; got.push(...rows.map((x) => `${m.pref} ${RND[m.rnd]} ${x.title}`.slice(0, 80))); } }
  }
  return json({ tourn, year, matches, searched: q, added, got });
});
