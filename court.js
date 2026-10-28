/* ---------- 전력분석 · 코트 입력 ----------
   예전 전력분석 프로그램(VolleyballLogger)처럼: 두 팀 라인업을 코트에 두고 선수를 눌러 동작을 고르면
   점수 · 서브권 · 우리/상대 로테이션이 저절로 돌아감 → 상대가 어느 로테이션에서 강한지까지 봄.
   기록은 scout_events(동작·로테·점수까지) + 점수가 난 랠리는 scout_points(우리·상대 로테)로 저장. 6인제만 */
// 동작: [코드, 이름, 등급(# + ! - / =), 결과(earned 득점 · error 실점 · 없으면 이어짐), 범실 이유] — 이름·순서는 예전 프로그램(VolleyballLogger) 그대로
const CT_AE = ["Into Net", "Blocked", "Out"];
const CT_MENU = [
  ["serve", "Serve", [["ace", "Ace", "#", "earned"], ["s1", "1-serve", "-"], ["s2", "2-serve", "!"], ["s3", "3-serve", "+"], ["serr", "Serve Error", "=", "error", ["Net", "Out", "Blocked"]], ["foot", "Foot Fault", "=", "error"]]],
  ["receive", "Receive", [["rerr", "Receive Error", "=", "error"], ["rover", "Over Pass (Play)", "-"], ["r1", "1-Receive", "!"], ["r2", "2-Receive", "+"], ["r3", "3-Receive", "#"]]],
  ["attack", "Attack", [["kill", "Spike Kill", "#", "earned"], ["tip", "Tip Kill", "#", "earned"], ["dump", "Dump Kill", "#", "earned"], ["down", "Down Ball Kill", "#", "earned"], ["opk", "Over Pass Kill", "#", "earned"], ["inplay", "Hit In Play", "!"],
    ["aerr", "Spike Error", "=", "error", CT_AE], ["tiperr", "Tip Error", "=", "error", CT_AE], ["dumperr", "Dump Error", "=", "error", CT_AE], ["downerr", "Down Ball Error", "=", "error", CT_AE], ["backrow", "Back Row Fault", "=", "error"]]],
  ["set", "Set", [["t1", "1-Set (In)", "!"], ["t2", "2-Set (In)", "+"], ["t3", "3-Set (In)", "#"], ["t1o", "1-Set (Out)", "!"], ["t2o", "2-Set (Out)", "+"], ["t3o", "3-Set (Out)", "#"], ["terr", "Set Error", "=", "error"]]],
  ["block", "Block", [["blk", "Block", "#", "earned"], ["bast", "Block Assist", "+"], ["binplay", "Block In Play", "!"], ["half", "half block", "!"], ["berr", "Block Error", "=", "error", ["Into Net", "Out"]]]],
  ["dig", "Dig", [["dtip", "Tip Dig", "+"], ["ddump", "Dump Dig", "+"], ["ddown", "Down Ball Dig", "+"], ["dig", "Spike Dig", "+"], ["dblk", "block dig", "+"],
    ["dtiperr", "Tip Dig Error", "=", "error"], ["ddumperr", "Dump Dig Error", "=", "error"], ["ddownerr", "Down Ball Dig Error", "=", "error"], ["derr", "Spike Dig Error", "=", "error"]]],
  ["free", "Pass", [["fbr", "F.B. Return In Play", "!"], ["fop", "Over Pass In Play", "-"], ["f1", "1-Free Ball Pass", "!"], ["f2", "2-Free Ball Pass", "+"], ["f3", "3-Free Ball Pass", "#"]]],
  ["fault", "Fault & Error", [["unk", "????", "!"], ["hand", "Ball Handling", "=", "error"], ["net", "Net Fault", "=", "error"], ["under", "Under Net", "=", "error"], ["over", "Over Net", "=", "error"], ["whose", "Whose Ball?", "=", "error"],
    ["bret", "Ball Return Err", "=", "error"], ["fbre", "Free Ball Recv Err", "=", "error"], ["rotf", "Out of Rotation", "=", "error"], ["outc", "Outside Court", "=", "error"]]],
];
const CT_ACT = Object.fromEntries(CT_MENU.flatMap(([sk, , l]) => l.map(a => [a[0], { skill: sk, code: a[0], name: a[1], grade: a[2], res: a[3] || "", det: a[4] || null }])));
const CT_NOLIB = ["serve", "attack", "block"]; // 리베로는 서브·공격·블로킹 없음
const CT_POS = ["OH", "MB", "OP", "S"];
const CT_PT = "pt"; // 누가 땄는지만 (선수 없이)
const CT_SUB = "sub"; // 교체 (zone = 바뀐 자리 1~6, kind = 들어온 선수 포지션, detail = 나간 선수)
const CT_LIB = "lib"; // 코트에 서는 리베로 바꾸기 (리베로 2명일 때)
const ctSame = (a, b) => a != null && b != null && String(a) === String(b);
const ctLibs = (L, side) => ((L[side] || {}).libero || []).filter(x => x !== "" && x != null);
const ctIsLib = (L, v, side = "us") => ctLibs(L, side).some(x => ctSame(x, v));
const ctOther = s => s === "us" ? "opp" : "us";
const ctLu = m => m.lineup || {};
const ctReady = m => { const L = ctLu(m); return L.us && (L.us.slots || []).filter(Boolean).length === 6 && L.opp && (L.opp.slots || []).filter(x => x !== "" && x != null).length === 6; };
const ctRosterPos = id => { const p = playerOf(id) || {}; return CT_POS.includes(p.pos) ? p.pos : "OH"; }; // 명단 L 선수가 코트 6명이면 OH
// 로테이션 r에서 자리 z(1~6)에 선 선수 = 처음(R1) 자리 ((z-1)+(r-1))%6 +1 의 선수 (로테이션은 2→1, 1→6 … 시계 방향)
const ctAt = (slots, r, z) => slots[((z - 1) + (r - 1)) % 6];
// 리베로 자동 (우리·상대 둘 다): MB가 뒷줄(5·6, 그 팀 서브가 아닐 때 1)에 오면 그 자리에 리베로. 그 팀 서브 차례 1번 MB는 직접 서브
function ctSideAt(s, side, z) {
  const us = side === "us", r = us ? s.rot : s.orot, i = ((z - 1) + (r - 1)) % 6, slots = us ? s.usSlots : s.opSlots, pos = us ? s.usPos : s.opPos, lib = us ? s.lib : s.olib;
  const on = lib != null && !slots.some(x => ctSame(x, lib)) && pos[i] === "MB" && (z === 5 || z === 6 || (z === 1 && s.serve !== side));
  return on ? { v: lib, lib: true, pos: "L" } : { v: slots[i], lib: false, pos: pos[i] || "" };
}
const ctUsAt = (s, z) => ctSideAt(s, "us", z);
const ctZoneOf = (slots, r, i) => ((i - (r - 1)) % 6 + 6) % 6 + 1; // 처음 자리 i(0~5)가 지금 서 있는 자리
// 세트 하나를 처음부터 다시 따라가며 지금 상태 계산 (되돌리기도 이걸로 맞음)
function ctState(m, ev, setNo) {
  const L = ctLu(m), st = (L.sets || {})[setNo] || {}, U = L.us || {}, O = L.opp || {};
  const s = { rot: st.rot || 1, orot: st.opp_rot || 1, serve: st.serve || "us", us: 0, op: 0, done: false, last: null, list: [],
    usSlots: [...(U.slots || [])], opSlots: [...(O.slots || [])],
    usPos: (U.slots || []).map((id, i) => (U.pos || [])[i] || ctRosterPos(id)), opPos: (O.slots || []).map((n, i) => (O.pos || [])[i] || ""),
    lib: ctLibs(L, "us")[0] ?? null, olib: ctLibs(L, "opp")[0] ?? null };
  for (const e of ev) {
    if (e.set_no !== setNo || !e.action) continue;
    s.list.push(e);
    const us = e.side === "us", v = us ? e.player_id : e.opp_no, slots = us ? s.usSlots : s.opSlots;
    if (e.action === CT_LIB) { if (ctIsLib(L, v, e.side) && !slots.some(x => ctSame(x, v))) { if (us) s.lib = v; else s.olib = v; } continue; }
    if (e.action === CT_SUB) { const i = (e.zone || 0) - 1;
      if (i >= 0 && i < 6) { slots[i] = v; (us ? s.usPos : s.opPos)[i] = e.kind || (us ? ctRosterPos(v) : (us ? s.usPos : s.opPos)[i]); }
      // 리베로(L)를 일반 선수(OH 등)로 넣으면 리베로 자리는 다른 리베로가 (없으면 리베로 없이)
      const cur = us ? s.lib : s.olib;
      if (ctSame(cur, v)) { const nx = ctLibs(L, e.side).find(x => !ctSame(x, v) && !slots.some(y => ctSame(y, x))) ?? null; if (us) s.lib = nx; else s.olib = nx; }
      continue; }
    if (e.skill === "serve") { s.serve = e.side; s.done = false; s.last = null; }
    else if (e.skill === "receive") { s.serve = ctOther(e.side); s.done = false; s.last = null; } // 리시브 = 새 랠리 (서브 기록을 빼먹어도)
    if (e.point) {
      if (e.point === "us") { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; }
      else { s.op++; if (s.serve === "us") s.orot = s.orot % 6 + 1; s.serve = "opp"; }
      s.done = true; s.last = null;
    } else if (e.action !== CT_PT && !s.done) s.last = e;
  }
  return s;
}
const ctName = (side, v) => { if (side === "us") { const p = playerOf(v); return p ? { no: p.number != null ? String(p.number) : "", nm: p.name } : { no: "", nm: "?" }; } return { no: String(v ?? ""), nm: "" }; };
function ctBtn(side, v, z, serving, lib, mini, pos) {
  const n = ctName(side, v);
  return `<button type="button" class="ct-p ${side} ${serving ? "srv" : ""} ${lib ? "lib" : ""} ${mini ? "mini" : ""}" data-act="ctpick" data-side="${side}" data-v="${esc(v)}" ${z ? `data-z="${z}"` : ""}><b>${esc(n.no || "–")}</b>${n.nm ? `<span>${esc(n.nm)}</span>` : ""}${z ? `<i>${z}</i>` : ""}${pos ? `<em>${esc(pos)}</em>` : ""}</button>`;
}
const ctFlip = () => { try { return localStorage.getItem("snuvt-ctflip") === "1"; } catch (e) { return false; } };
// 코트 화면
function ctPad(m, ev) {
  const S = sc(), L = ctLu(m), setNo = S.sel.set || 1;
  if (!ctReady(m)) return `<div class="panel ct-empty"><b>라인업이 아직 없어요</b>${can("analysis") ? `<button class="btn primary" type="button" data-act="ctlineup">라인업 넣기</button>` : `<span class="small muted">전력분석 담당이 넣을 수 있어요.</span>`}</div>`;
  const s = ctState(m, ev, setNo), flip = ctFlip();
  // 아래 칸: 앞줄(네트) 4·3·2, 뒷줄 5·6·1 / 위 칸: 뒷줄 1·6·5, 앞줄 2·3·4 (영상 방향에 맞게 뒤집기)
  const half = (side, top) => { const srv = s.serve === side && !s.last;
    const rows = top ? [[1, 6, 5], [2, 3, 4]] : [[4, 3, 2], [5, 6, 1]];
    return `<div class="ct-half ${side}">${rows.map(row => `<div class="ct-row">${row.map(z => { const x = ctSideAt(s, side, z); return ctBtn(side, x.v, z, srv && z === 1, x.lib, false, x.pos); }).join("")}</div>`).join("")}</div>`; };
  // 리베로 줄 (작게): 지금 코트 리베로는 색칠, 일반 선수로 들어간 리베로는 빠짐
  const libRow = side => { const slots = side === "us" ? s.usSlots : s.opSlots, cur = side === "us" ? s.lib : s.olib;
    const l = ctLibs(L, side).filter(x => !slots.some(y => ctSame(y, x)));
    return `<div class="ct-lrow ${side}"><span class="sc-k">${side === "us" ? "우리" : "상대"}</span>${l.length ? `<span class="ct-lk">L</span>${l.map(v => ctBtn(side, v, 0, false, ctSame(v, cur), true)).join("")}` : ""}<button class="btn small ct-subbtn" type="button" data-act="ctsubopen" data-side="${side}">교체</button></div>`; };
  const recent = s.list.slice(-6).reverse(), q = ctQ.list.length;
  const court = flip ? `${half("us", true)}<div class="ct-net"><span>네트</span></div>${half("opp", false)}` : `${half("opp", true)}<div class="ct-net"><span>네트</span></div>${half("us", false)}`;
  const rally = s.us + s.op + 1;
  return `<div class="ct-wrap"><div class="panel ct-bar">
      <div class="sc-row"><span class="sc-k">세트</span>${[1, 2, 3, 4, 5].map(n => scChip("scset", n, setNo, n)).join("")}<span class="ct-tools">${q ? `<span class="chip warn" title="인터넷이 되면 저장돼요">대기 ${q}</span>` : ""}${can("analysis") ? `<button class="btn link small" type="button" data-act="ctlineup">라인업</button>` : ""}</span></div>
      <div class="ct-score"><span class="ct-t us ${s.serve === "us" ? "srv" : ""}">우리 <small>R${s.rot}</small></span><b class="num">${s.us} : ${s.op}</b><span class="ct-t opp ${s.serve === "opp" ? "srv" : ""}"><small>R${s.orot}</small> ${esc(m.opponent || "상대")}</span></div>
      <div class="ct-quick"><span class="small muted">Rally ${rally}</span><span class="row nowrap">${s.list.length ? `<button class="btn small" type="button" data-act="ctundo">↶ Undo</button>` : ""}<button class="btn small" type="button" data-act="ctflip">Change Court</button></span></div>
    </div>
    <div class="ct-court">${court}</div>
    <div class="ct-extra">${flip ? libRow("us") + libRow("opp") : libRow("opp") + libRow("us")}</div>
    <section class="sec ct-recs"><div class="sec-head"><h3>방금 기록 <span class="small muted">${s.list.length}개</span></h3></div>
      ${recent.length ? `<ul class="watch sc-recent ct-rec">${recent.map(e => `<li class="${e._pending ? "ct-pend" : ""}"><span class="num small">${esc(e.score || "")}</span><span class="small ct-l">${ctLabel(e)}</span>${e.point ? `<span class="chip ${e.point === "us" ? "ok" : "warn"}">${e.point === "us" ? "우리" : "상대"} 점수</span>` : ""}</li>`).join("")}</ul>` : emptyLine("선수를 눌러 기록을 시작해요.")}
    </section></div>`;
}
function ctLabel(e) {
  const a = CT_ACT[e.action], who = e.side === "us" ? (() => { const p = playerOf(e.player_id); return p ? `${pNo(p)}${esc(p.name)}` : "우리"; })() : `상대 #${e.opp_no ?? "?"}`;
  if (e.action === CT_PT) return `${e.side === "us" ? "우리" : "상대"} 점수`;
  if (e.action === CT_LIB) return `리베로 바꿈 · ${who}`;
  if (e.action === CT_SUB) return `교체 · ${who}${e.kind ? ` (${esc(e.kind)})` : ""} 들어감${e.detail ? ` ↔ ${esc(e.detail)}` : ""}`;
  return `${who} · ${a ? esc(a.name) : esc(e.action)}${e.detail ? ` (${esc(e.detail)})` : ""}${e.zone ? ` → ${e.zone}` : ""}`;
}
// 지금 리베로로 뛰는 중인가 (코트 6명 칸이 아닌 리베로)
const ctLibActing = (m, s, side, v) => ctIsLib(ctLu(m), v, side) && !(side === "us" ? s.usSlots : s.opSlots).some(x => ctSame(x, v));
// 선수를 누르면: 동작 고르기 창
function ctOpen(side, v, z) {
  const S = sc(), m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1);
  const slots = side === "us" ? s.usSlots : s.opSlots, i = slots.findIndex(x => ctSame(x, v)), libAct = ctLibActing(m, s, side, v);
  const cur = side === "us" ? s.lib : s.olib;
  if (i < 0 && (!libAct || !ctSame(v, cur))) return ctSubOpen(side, { inn: v }); // 벤치 · 안 뛰는 리베로 → 교체
  S.ct = { side, v, z: z || null, cat: null, act: null }; // 예전 프로그램처럼: 카테고리 → 결과 → 세부
  ctSheet();
}
function ctSubOpen(side, o) {
  const S = sc(), m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1), slots = side === "us" ? s.usSlots : s.opSlots;
  const out = o.out != null ? o.out : null, pos = out != null ? (side === "us" ? s.usPos : s.opPos)[out] || null : null;
  S.ct = { side, v: o.v ?? null, cat: "sub", out, inn: o.inn ?? null, pos };
  if (o.inn != null && slots.some(x => ctSame(x, o.inn))) S.ct.inn = null;
  ctSheet();
}
// 교체 창: 나갈 선수(코트 6명) · 들어올 선수(벤치 · 리베로 / 상대는 번호) · 포지션 → 교체
function ctSubHtml(m, s) {
  const c = sc().ct, side = c.side, us = side === "us", L = ctLu(m), slots = us ? s.usSlots : s.opSlots, pos = us ? s.usPos : s.opPos, r = us ? s.rot : s.orot, cur = us ? s.lib : s.olib;
  const nm = v => { const n = ctName(side, v); return `${n.no ? "#" + n.no : ""} ${n.nm}`.trim(); };
  const outs = [4, 3, 2, 5, 6, 1].map(z => { const i = ((z - 1) + (r - 1)) % 6; return `<button type="button" class="ct-sb ${c.out === i ? "on" : ""}" data-act="ctsubout" data-i="${i}"><i>${z}</i><b>${esc(nm(slots[i]))}</b><small>${esc(pos[i] || "")}</small></button>`; }).join("");
  const ins = us ? sortedPlayers().filter(p => !p.military && !slots.includes(p.id)).map(p => `<button type="button" class="ct-sb ${ctSame(c.inn, p.id) ? "on" : ""}" data-act="ctsubin" data-v="${esc(p.id)}"><b>${esc(pNo(p) + p.name)}</b><small>${esc(p.pos === "Li" ? "L" : p.pos || "")}</small></button>`).join("")
    : `<label class="fl sc-opp">번호<input id="ctSubNo" type="number" inputmode="numeric" min="0" max="99" value="${esc(c.inn ?? "")}"></label>${ctLibs(L, "opp").filter(x => !slots.some(y => ctSame(y, x))).map(n => `<button type="button" class="ct-sb ${ctSame(c.inn, n) ? "on" : ""}" data-act="ctsubin" data-v="${esc(n)}"><b>#${esc(n)}</b><small>L</small></button>`).join("")}`;
  const libs = ctLibs(L, side).filter(x => !slots.some(y => ctSame(y, x)));
  return `${libs.length > 1 ? `<div class="sc-row"><span class="sc-k">코트 리베로</span>${libs.map(v => `<button type="button" class="chip sc-chip ${ctSame(v, cur) ? "on" : ""}" data-act="ctlib" data-side="${side}" data-v="${esc(v)}">${esc(nm(v))}</button>`).join("")}</div>` : ""}
    <div class="ct-subg"><div><p class="sc-k">나감</p><div class="ct-subl out">${outs}</div></div><div><p class="sc-k">들어옴</p><div class="ct-subl">${ins || `<span class="small muted">벤치 선수가 없어요</span>`}</div></div></div>
    <div class="sc-row"><span class="sc-k">포지션</span>${CT_POS.map(p => `<button type="button" class="chip sc-chip ${c.pos === p ? "on" : ""}" data-act="ctsubpos" data-v="${p}">${p}</button>`).join("")}</div>
    <div class="row"><button class="btn primary" type="button" data-act="ctsubok">교체</button></div>`;
}
function ctSheet() {
  const S = sc(), c = S.ct; if (!c) return;
  const m = scMatch(), el = document.getElementById("sheet"), s = ctState(m, S.events[m.id] || [], S.sel.set || 1);
  const noEl = document.getElementById("ctSubNo"); if (noEl && c.cat === "sub" && c.side === "opp" && noEl.value !== "") c.inn = noEl.value;
  const libAct = c.v != null && ctLibActing(m, s, c.side, c.v);
  const cls = a => a[3] === "earned" ? "g-best" : a[3] === "error" ? "g-err" : a[2] === "#" || a[2] === "+" ? "g-good" : "g-ok";
  const grid = items => `<div class="ct-acts">${items.map(([act, attrs, cl, label], i) => `<button type="button" class="btn sc-g ${cl}" data-act="${act}" ${attrs}>${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}${esc(label)}</button>`).join("")}</div>`;
  const cats = CT_MENU.filter(([k]) => !(libAct && CT_NOLIB.includes(k)));
  const n = c.v != null ? ctName(c.side, c.v) : null, who = n ? `${c.side === "us" ? "우리" : "상대"} ${esc(n.no ? "#" + n.no : "")} ${esc(n.nm)}${libAct ? ` <span class="chip">L</span>` : ""}` : "";
  let body, title, back = "";
  if (c.cat === "sub") { body = ctSubHtml(m, s); title = `${c.side === "us" ? "우리" : "상대"} 교체`; if (c.v != null && (libAct || (c.side === "us" ? s.usSlots : s.opSlots).some(x => ctSame(x, c.v)))) back = `<button type="button" class="btn link small" data-act="ctback">‹ 뒤로</button>`; }
  else if (!c.cat) { title = who;
    body = `<div class="ct-catg">${grid(cats.map(([k, l]) => ["ctcat", `data-v="${k}"`, `ct-cat ${c.side}`, l]))}</div>${c.v != null ? `<div class="row"><button type="button" class="btn link small" data-act="ctcat" data-v="sub">교체</button></div>` : ""}`; }
  else { const cat = CT_MENU.find(x => x[0] === c.cat) || CT_MENU[0], det = c.act && CT_ACT[c.act].det;
    title = `${who} · ${esc(det ? CT_ACT[c.act].name : cat[1])}`; back = `<button type="button" class="btn link small" data-act="ctback">‹ 뒤로</button>`;
    body = det ? grid(det.map(d => ["ctdet", `data-v="${esc(d)}"`, "g-err", d])) : grid(cat[2].map(a => ["ctact", `data-a="${a[0]}"`, cls(a), a[1]])); }
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${title}</h3><span class="row nowrap">${back}<button class="btn link" type="button" data-act="sheetclose">닫기</button></span></div>${body}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
/* 저장: 화면에 먼저 넣고(바로 다음 입력) 서버에는 차례대로 보냄. 인터넷이 끊겨도 대기열에 남았다가 다시 보냄 */
const ctQ = { list: [], busy: false, timer: null };
const ctQKey = "snuvt-ctq";
const ctQSave = () => { try { localStorage.setItem(ctQKey, JSON.stringify(ctQ.list.map(x => ({ ev: x.ev, pt: x.pt })))); } catch (e) {} };
try { ctQ.list = (JSON.parse(localStorage.getItem(ctQKey) || "[]") || []).filter(x => x && x.ev); } catch (e) { ctQ.list = []; }
const ctRetry = err => !err || !err.code || /fetch|network|timeout|JWT|PGRST301/i.test(`${err.message || ""} ${err.code || ""}`);
const ctClean = r => { const o = { ...r }; delete o.id; delete o._pending; delete o._done; delete o.created_at; return o; };
async function ctFlush() {
  if (ctQ.busy || !ctQ.list.length) return;
  if (!uid() || (typeof navigator !== "undefined" && navigator.onLine === false)) { clearTimeout(ctQ.timer); ctQ.timer = setTimeout(ctFlush, 4000); return; }
  ctQ.busy = true; let changed = false;
  try {
    while (ctQ.list.length) {
      const it = ctQ.list[0];
      if (!it.ev._done) {
        const r = await sb.from("scout_events").insert(ctClean(it.ev)).select("id,created_at").maybeSingle();
        if (r.error) { if (ctRetry(r.error)) { clearTimeout(ctQ.timer); ctQ.timer = setTimeout(ctFlush, 4000); break; }
          toast(failMsg(r.error)); ctQ.list.shift(); ctDrop(it); changed = true; continue; }
        it.ev._done = true; ctQSave(); ctFix(it.ev, r.data && r.data.id, r.data && r.data.created_at); if (it.pt) it.pt.event_id = it.ev.id;
      }
      if (it.pt) {
        const q = await sb.from("scout_points").insert({ ...ctClean(it.pt), event_id: it.ev.id }).select("id").maybeSingle();
        if (q.error && ctRetry(q.error)) { clearTimeout(ctQ.timer); ctQ.timer = setTimeout(ctFlush, 4000); break; }
        if (!q.error) ctFixPt(it.pt, q.data && q.data.id);
      }
      ctQ.list.shift(); ctQSave(); changed = true;
    }
  } finally { ctQ.busy = false; }
  if (changed && state.view === "scout" && sc().tab === "court" && document.getElementById("sheet").hidden) { state.dirty = false; render(); }
}
// 서버 번호로 바꿔 끼움 (화면 기록 · 대기열 모두)
function ctFix(ev, id, at) { const tmp = ev.id; if (!id) return; for (const l of Object.values(sc().events)) for (const e of l) if (e.id === tmp) { e.id = id; delete e._pending; if (at) e.created_at = at; } ev.id = id; }
function ctFixPt(pt, id) { if (!id) return; for (const l of Object.values(sc().points)) for (const p of l) if (p.id === pt.id) p.id = id; pt.id = id; }
function ctDrop(it) { const S = sc(), mid = it.ev.match_id; if (S.events[mid]) S.events[mid] = S.events[mid].filter(e => e.id !== it.ev.id); if (it.pt && S.points[mid]) S.points[mid] = S.points[mid].filter(p => p.id !== it.pt.id); }
window.addEventListener("online", () => ctFlush());
window.addEventListener("beforeunload", e => { if (ctQ.list.length) { ctQSave(); e.preventDefault(); e.returnValue = ""; } });
setTimeout(ctFlush, 3000);
function ctPush(row, pr) {
  const S = sc(), now = new Date().toISOString(), tmp = "tmp" + Date.now() + Math.random().toString(36).slice(2, 6);
  const ev = { ...row, id: tmp, _pending: true, created_at: now };
  (S.events[row.match_id] = S.events[row.match_id] || []).push(ev);
  let pt = null;
  if (pr) { pt = { ...pr, id: "tp" + tmp, event_id: null }; (S.points[row.match_id] = S.points[row.match_id] || []).push(pt); }
  ctQ.list.push({ ev: { ...row, id: tmp }, pt }); ctQSave();
  ctFlush();
}
function ctSave(code, detail) {
  const S = sc(), m = scMatch(), c = S.ct || {}; if (!m) return;
  const a = code === CT_PT ? { skill: "fault", grade: "#", res: "earned" } : CT_ACT[code];
  const ev = S.events[m.id] || [], setNo = S.sel.set || 1, s = ctState(m, ev, setNo);
  // 서브를 누르면 그 팀 서브, 리시브면 상대 서브 (점수는 랠리에서 처음 난 것만)
  const serveBefore = a.skill === "serve" ? c.side : a.skill === "receive" ? ctOther(c.side) : s.serve;
  const fresh = code === CT_PT || a.skill === "serve" || a.skill === "receive" || !s.done;
  const point = fresh && a.res ? (a.res === "earned" ? c.side : ctOther(c.side)) : null;
  const rot = s.rot, orot = s.orot; let us = s.us, op = s.op;
  if (point === "us") us++; else if (point === "opp") op++;
  const row = { match_id: m.id, set_no: setNo, side: c.side, player_id: c.side === "us" && code !== CT_PT ? c.v : null, opp_no: c.side === "opp" && code !== CT_PT && c.v !== "" && c.v != null ? Number(c.v) : null,
    skill: a.skill, grade: a.skill === "attack" && detail === "Blocked" ? "/" : a.grade, action: code, detail: detail || null, zone: c.zone || null, rot, opp_rot: orot, serve: serveBefore, point, score: `${us}:${op}`, t: scNow(), author: uid() };
  ctPush(row, point ? { match_id: m.id, set_no: setNo, rot, opp_rot: orot, serve: serveBefore, won: point === "us", t: row.t, author: uid() } : null);
  S.ct = null; closeSheet(); state.dirty = false; render();
}
function ctSubSave() {
  const S = sc(), m = scMatch(), c = S.ct || {}, setNo = S.sel.set || 1, s = ctState(m, S.events[m.id] || [], setNo), us = c.side === "us";
  const noEl = document.getElementById("ctSubNo"); if (!us && noEl && noEl.value !== "") c.inn = noEl.value;
  const slots = us ? s.usSlots : s.opSlots, i = c.out, inV = c.inn;
  if (i == null) return toast("나갈 선수를 골라 주세요");
  if (inV === "" || inV == null) return toast(us ? "들어올 선수를 골라 주세요" : "들어올 번호를 넣어 주세요");
  if (slots.some(x => ctSame(x, inV))) return toast("이미 코트에 있어요");
  const on = ctName(c.side, slots[i]), pos = c.pos || (us ? s.usPos : s.opPos)[i] || (us ? ctRosterPos(inV) : null);
  ctPush({ match_id: m.id, set_no: setNo, side: c.side, player_id: us ? inV : null, opp_no: us ? null : Number(inV), skill: "sub", grade: "!", action: CT_SUB, kind: pos || null,
    detail: `${on.no ? "#" + on.no + " " : ""}${on.nm}`.trim().slice(0, 30) || null, zone: i + 1, rot: s.rot, opp_rot: s.orot, serve: s.serve, point: null, score: `${s.us}:${s.op}`, t: scNow(), author: uid() }, null);
  S.ct = null; closeSheet(); state.dirty = false; render();
}
function ctLibSave(side, v) {
  const S = sc(), m = scMatch(), setNo = S.sel.set || 1, s = ctState(m, S.events[m.id] || [], setNo);
  if (ctSame(v, side === "us" ? s.lib : s.olib)) return;
  ctPush({ match_id: m.id, set_no: setNo, side, player_id: side === "us" ? v : null, opp_no: side === "us" ? null : Number(v), skill: "sub", grade: "!", action: CT_LIB, detail: null, zone: null, rot: s.rot, opp_rot: s.orot, serve: s.serve, point: null, score: `${s.us}:${s.op}`, t: scNow(), author: uid() }, null);
  S.ct = null; closeSheet(); state.dirty = false; render();
}
async function ctUndo() {
  const S = sc(), m = scMatch(); if (!m) return;
  const l = (S.events[m.id] || []).filter(e => e.action && e.set_no === (S.sel.set || 1)), e = l[l.length - 1]; if (!e) return;
  if (!await confirmDel(`방금 기록을 지울까요?\n${ctLabel(e).replace(/<[^>]+>/g, "")}`)) return;
  const qi = ctQ.list.findIndex(x => x.ev.id === e.id);
  if (qi >= 0) { // 아직 서버에 안 간 것
    if (qi === 0 && ctQ.busy) { toast("저장 중이에요. 잠깐 뒤에 다시 눌러 주세요"); return; }
    const it = ctQ.list.splice(qi, 1)[0]; ctQSave(); ctDrop(it); state.dirty = false; return render();
  }
  try {
    ok(await sb.from("scout_events").delete().eq("id", e.id)); // 랠리 점수(scout_points)는 같이 지워짐
    S.events[m.id] = S.events[m.id].filter(x => x.id !== e.id); S.points[m.id] = (S.points[m.id] || []).filter(p => p.event_id !== e.id);
  } catch (err) { toast(failMsg(err)); }
  state.dirty = false; render();
}
// 라인업 · 세트 시작 로테 (전력분석 담당). 라인업 용지처럼 앞줄 4·3·2, 뒷줄 5·6·1 순서로 입력 (저장은 자리 1~6)
const CT_SHEET = [3, 2, 1, 4, 5, 0];
function ctLineupForm() {
  const S = sc(), m = scMatch(), L = ctLu(m), setNo = S.sel.set || 1, prev = (L.sets || {})[setNo - 1];
  const st = (L.sets || {})[setNo] || (prev ? { rot: prev.rot, opp_rot: prev.opp_rot, serve: prev.serve === "opp" ? "us" : "opp" } : {});
  const ps = sortedPlayers().filter(p => !p.military), U = L.us || {}, O = L.opp || {}, us = U.slots || [], op = O.slots || [];
  const posSel = (id, cur, blank) => `<select id="${id}" class="ct-pos" aria-label="포지션">${blank ? `<option value="">포지션</option>` : ""}${CT_POS.map(p => `<option ${p === cur ? "selected" : ""}>${p}</option>`).join("")}</select>`;
  const sel = i => `<div class="ct-lu-c"><span class="ct-lu-n">${i + 1}${i === 0 ? " 서브" : ""}</span><select id="ctu-${i}" aria-label="${i + 1}번 자리"><option value="">선택</option>${ps.map(p => `<option value="${p.id}" ${us[i] === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)} · ${esc(p.pos === "Li" ? "L" : p.pos || "")}</option>`).join("")}</select>${posSel(`ctp-${i}`, (U.pos || [])[i] || (us[i] ? ctRosterPos(us[i]) : ""), !us[i])}</div>`;
  const lsel = k => `<label class="fl">리베로 ${k + 1}<select id="ctu-l${k}"><option value="">없음</option>${ps.map(p => `<option value="${p.id}" ${(U.libero || [])[k] === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)}${p.pos === "Li" ? " · L" : ""}</option>`).join("")}</select></label>`;
  const onum = i => `<div class="ct-lu-c"><span class="ct-lu-n">${i + 1}${i === 0 ? " 서브" : ""}</span><input id="cto-${i}" type="number" inputmode="numeric" min="0" max="99" placeholder="번호" value="${esc(op[i] ?? "")}" aria-label="상대 ${i + 1}번 자리 번호">${posSel(`cop-${i}`, (O.pos || [])[i] || "", true)}</div>`;
  const num = (id, v, l) => `<label class="fl">${l}<input id="${id}" type="number" inputmode="numeric" min="0" max="99" value="${esc(v ?? "")}"></label>`;
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>라인업</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="ctLineupForm">
      <h4>우리</h4><div class="ct-lu"><span class="ct-netl">네트</span>${CT_SHEET.map(sel).join("")}</div>
      <div class="pair">${lsel(0)}${lsel(1)}</div>
      <h4>${esc(m.opponent || "상대")}</h4><div class="ct-lu"><span class="ct-netl">네트</span>${CT_SHEET.map(onum).join("")}</div>
      <div class="pair">${num("cto-l1", (O.libero || [])[0], "리베로 1")}${num("cto-l2", (O.libero || [])[1], "리베로 2")}</div>
      <h4>${setNo}세트 시작</h4><div class="fields">
        <label class="fl">우리 로테<select id="cts-rot">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === (st.rot || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="fl">상대 로테<select id="cts-orot">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === (st.opp_rot || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="fl">첫 서브<select id="cts-serve"><option value="us" ${st.serve !== "opp" ? "selected" : ""}>우리</option><option value="opp" ${st.serve === "opp" ? "selected" : ""}>상대</option></select></label></div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
  // 선수를 고르면 명단 포지션으로 채움 (바꿀 수 있음)
  el.querySelectorAll('select[id^="ctu-"]').forEach(x => { const i = x.id.slice(4); if (!/^\d$/.test(i)) return; x.addEventListener("change", () => { const p = document.getElementById(`ctp-${i}`); if (p && x.value) p.value = ctRosterPos(x.value); }); });
}
async function ctLineupSave(f) {
  const S = sc(), m = scMatch(), v = id => (document.getElementById(id) || {}).value || "", setNo = S.sel.set || 1;
  const us = [0, 1, 2, 3, 4, 5].map(i => v(`ctu-${i}`)), op = [0, 1, 2, 3, 4, 5].map(i => v(`cto-${i}`));
  if (us.some(x => !x) || new Set(us).size !== 6) { toast("우리 선수 6명을 겹치지 않게 골라 주세요"); return false; }
  const libs = [v("ctu-l0"), v("ctu-l1")].filter(Boolean);
  if (new Set(libs).size !== libs.length) { toast("리베로 1·2를 다른 사람으로 골라 주세요"); return false; }
  if (libs.some(x => us.includes(x))) { toast("코트 6명에 넣은 선수는 리베로로 고를 수 없어요"); return false; }
  if (op.some(x => x === "")) { toast("상대 등번호 6개를 넣어 주세요"); return false; }
  if (new Set(op).size !== 6) { toast("상대 등번호가 겹쳐요"); return false; }
  const olibs = [v("cto-l1"), v("cto-l2")].filter(x => x !== "");
  if (olibs.some(x => op.includes(x))) { toast("상대 코트 6명 번호는 리베로로 넣을 수 없어요"); return false; }
  const L = { ...ctLu(m) };
  L.us = { slots: us, pos: us.map((id, i) => v(`ctp-${i}`) || ctRosterPos(id)), libero: libs };
  L.opp = { slots: op.map(Number), pos: op.map((x, i) => v(`cop-${i}`)), libero: olibs.map(Number) };
  L.sets = { ...(L.sets || {}), [setNo]: { rot: Number(v("cts-rot")) || 1, opp_rot: Number(v("cts-orot")) || 1, serve: v("cts-serve") || "us" } };
  ok(await sb.from("scout_matches").update({ lineup: L }).eq("id", m.id));
  m.lineup = L; closeSheet(); toast("라인업을 저장했어요"); state.dirty = false; render();
  return false;
}
function courtClick(b, act) {
  const S = sc();
  if (act === "ctpick") return ctOpen(b.dataset.side, b.dataset.v, b.dataset.z);
  if (act === "ctsubopen") return ctSubOpen(b.dataset.side, {});
  if (act === "ctcat") { if (b.dataset.v === "sub") { const m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1), slots = S.ct.side === "us" ? s.usSlots : s.opSlots, i = slots.findIndex(x => ctSame(x, S.ct.v));
      return ctSubOpen(S.ct.side, i >= 0 ? { out: i, v: S.ct.v } : { inn: S.ct.v, v: S.ct.v }); }
    S.ct.cat = b.dataset.v; S.ct.act = null; return ctSheet(); }
  if (act === "ctback") { if (S.ct.act) S.ct.act = null; else if (S.ct.cat === "sub") S.ct = { side: S.ct.side, v: S.ct.v, z: null, cat: null, act: null }; else S.ct.cat = null; return ctSheet(); }
  if (act === "ctsubout") { const m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1), i = Number(b.dataset.i); S.ct.out = i; S.ct.pos = (S.ct.side === "us" ? s.usPos : s.opPos)[i] || S.ct.pos; return ctSheet(); }
  if (act === "ctsubin") { S.ct.inn = b.dataset.v; const n = document.getElementById("ctSubNo"); if (n) n.value = ""; return ctSheet(); }
  if (act === "ctsubpos") { S.ct.pos = b.dataset.v; return ctSheet(); }
  if (act === "ctsubok") return ctSubSave();
  if (act === "ctact") { const a = CT_ACT[b.dataset.a]; if (a.det) { S.ct.act = a.code; return ctSheet(); } return ctSave(a.code, null); }
  if (act === "ctdet") return ctSave(S.ct.act, b.dataset.v || null);
  if (act === "ctlib") return ctLibSave(b.dataset.side || "us", b.dataset.v);
  if (act === "ctundo") return ctUndo();
  if (act === "ctlineup") return ctLineupForm();
  if (act === "ctflip") { try { localStorage.setItem("snuvt-ctflip", ctFlip() ? "0" : "1"); } catch (e) {} state.dirty = false; return render(); }
}
// 컴퓨터: 창이 열려 있으면 숫자 키로 바로 고르기 (예전 프로그램처럼) · 코트에서 Backspace = 되돌리기
document.addEventListener("keydown", ev => {
  if (state.view !== "scout" || sc().tab !== "court" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  const sh = document.getElementById("sheet");
  if (sh && !sh.hidden && sc().ct && /^[1-9]$/.test(ev.key)) { const bs = sh.querySelectorAll(".ct-acts .btn"), x = bs[Number(ev.key) - 1]; if (x) { ev.preventDefault(); x.click(); } }
  else if (sh && !sh.hidden && sc().ct && ev.key === "Backspace") { ev.preventDefault(); const c = sc().ct; if (c.act) c.act = null; else if (c.cat && c.cat !== "sub" || c.cat === "sub" && c.v != null) c.cat = null; else return closeSheet(); ctSheet(); } // 한 단계 뒤로
  else if (sh && sh.hidden && ev.key === "Backspace") { ev.preventDefault(); ctUndo(); }
});

/* ---------- 분석: 기록지 (예전 프로그램 엑셀 요약과 같은 항목) · 상대 로테이션별 ---------- */
const ctReal = l => l.filter(e => e.action !== CT_PT && e.action !== CT_SUB && e.action !== CT_LIB);
function ctSum(l) {
  const c = (sk, g) => l.filter(e => e.skill === sk && (!g || g.includes(e.grade))).length;
  const at = c("attack"), ak = c("attack", "#"), ae = c("attack", "=/");
  const sv = c("serve"), sa = c("serve", "#"), se = c("serve", "=");
  const ss = l.filter(e => e.skill === "serve").reduce((a, e) => a + ({ "#": 4, "+": 3, "!": 2, "-": 1 }[e.grade] || 0), 0);
  const rc = c("receive"), r3 = c("receive", "#"), rs = l.filter(e => e.skill === "receive").reduce((a, e) => a + ({ "#": 3, "+": 2, "!": 1 }[e.grade] || 0), 0);
  const st = c("set"), ts = l.filter(e => e.skill === "set").reduce((a, e) => a + ({ "#": 3, "+": 2, "!": 1 }[e.grade] || 0), 0);
  const bk = c("block", "#"), bt = c("block", "#+!"), dg = c("dig"), dok = c("dig", "#+!");
  const err = l.filter(e => e.grade === "=" || (e.skill === "attack" && e.grade === "/")).length;
  return { pts: ak + bk + sa, at, ak, ae, sv, sa, se, ss, rc, r3, rs, st, ts, bk, bt, dg, dok, err };
}
function ctSheetTable(l, side) {
  l = ctReal(l).filter(e => e.side === side);
  const keys = side === "us" ? sortedPlayers().filter(p => l.some(e => e.player_id === p.id)).map(p => [p.id, `${pNo(p)}${p.name}`]) : [...new Set(l.map(e => e.opp_no))].sort((a, b) => (a ?? 999) - (b ?? 999)).map(n => [n, n == null ? "번호 없음" : "#" + n]);
  if (!keys.length) return emptyLine(side === "us" ? "우리 기록이 없어요." : "상대 기록이 없어요.");
  const teamAt = ctSum(l).at, f2 = (a, b) => b ? (a / b).toFixed(2) : "—";
  const row = ([k, nm]) => { const s = ctSum(l.filter(e => side === "us" ? e.player_id === k : e.opp_no === k)); if (!(s.at + s.sv + s.rc + s.st + s.bt + s.dg + s.err)) return "";
    const eff = s.at ? Math.round(100 * (s.ak - s.ae) / s.at) : null;
    return `<tr><td><b>${esc(nm)}</b></td><td class="num">${s.pts || "—"}</td><td class="num">${s.at ? `${s.ak}/${s.at}` : "—"}</td><td class="num ${s.at && 100 * s.ak / s.at >= 25 ? "ct-hi" : ""}">${s.at ? scPct(s.ak, s.at) : "—"}</td><td class="num ${eff == null ? "" : eff > 0 ? "ct-up" : eff < 0 ? "ct-dn" : ""}">${eff == null ? "—" : eff + "%"}</td><td class="num">${s.at ? scPct(s.at, teamAt) : "—"}</td>
      <td class="num">${s.sv ? `${s.sa}/${s.sv}` : "—"}</td><td class="num">${f2(s.ss, s.sv)}</td><td class="num">${s.bt ? `${s.bk}/${s.bt}` : "—"}</td><td class="num">${s.dg ? `${s.dok}/${s.dg}` : "—"}</td><td class="num">${s.rc ? `${s.r3}/${s.rc}` : "—"}</td><td class="num">${f2(s.rs, s.rc)}</td><td class="num">${f2(s.ts, s.st)}</td><td class="num">${s.err || "—"}</td></tr>`; };
  return `<div class="tw"><table class="ct-sheet"><thead><tr><th>선수</th><th>득점</th><th>공격</th><th>성공률</th><th>효율</th><th>점유율</th><th>서브</th><th>서브 점수</th><th>블로킹</th><th>디그</th><th>리시브</th><th>리시브 점수</th><th>세트 점수</th><th>범실</th></tr></thead><tbody>${keys.map(row).join("")}</tbody></table></div>`;
}
// 상대 로테이션별: 상대가 서브 받을 때(사이드아웃) · 서브할 때(브레이크) 얼마나 따는지
function ctOppRotTable(pts) {
  const l = pts.filter(p => p.opp_rot);
  if (!l.length) return emptyLine("코트 입력으로 기록하면 상대 로테이션도 같이 쌓여요.");
  const rows = [1, 2, 3, 4, 5, 6].map(r => { const x = l.filter(p => p.opp_rot === r), so = x.filter(p => p.serve === "us"), br = x.filter(p => p.serve === "opp"), w = x.filter(p => !p.won).length;
    return { r, so, br, w, n: x.length, d: w - (x.length - w) }; });
  const best = rows.filter(x => x.n >= 3).sort((a, b) => b.d - a.d)[0], worst = rows.filter(x => x.n >= 3).sort((a, b) => a.d - b.d)[0];
  return `<div class="tw"><table><thead><tr><th>상대 로테</th><th>상대 사이드아웃</th><th>상대 브레이크</th><th>상대 득실</th></tr></thead><tbody>${rows.map(x => `<tr class="${best && x.r === best.r ? "ct-strong" : worst && x.r === worst.r && worst.d < 0 ? "ct-weak" : ""}"><td><b>R${x.r}</b></td><td class="num">${x.so.length ? `${scPct(x.so.filter(p => !p.won).length, x.so.length)} <span class="small muted">${x.so.filter(p => !p.won).length}/${x.so.length}</span>` : "—"}</td><td class="num">${x.br.length ? `${scPct(x.br.filter(p => !p.won).length, x.br.length)} <span class="small muted">${x.br.filter(p => !p.won).length}/${x.br.length}</span>` : "—"}</td><td class="num">${x.n ? (x.d > 0 ? "+" : "") + x.d : "—"}</td></tr>`).join("")}</tbody></table></div>
    ${best && best.d > 0 ? `<p class="small">상대가 가장 강한 로테: <b>R${best.r}</b>${worst && worst.d < 0 ? ` · 가장 약한 로테: <b>R${worst.r}</b>` : ""}</p>` : ""}`;
}
