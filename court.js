/* ---------- 전력분석 · 코트 입력 ----------
   예전 전력분석 프로그램(VolleyballLogger)처럼: 두 팀 라인업을 코트에 두고 선수를 눌러 동작을 고르면
   점수 · 서브권 · 우리/상대 로테이션이 저절로 돌아감 → 상대가 어느 로테이션에서 강한지까지 봄.
   기록은 scout_events(동작·로테·점수까지) + 점수가 난 랠리는 scout_points(우리·상대 로테)로 저장. 6인제만 */
// 동작: [코드, 이름, 등급(# + ! - / =), 결과(earned 득점 · error 실점 · 없으면 이어짐), 범실 이유]
const CT_MENU = [
  ["serve", "서브", [["ace", "에이스", "#", "earned"], ["s3", "흔듦", "+"], ["s2", "보통", "!"], ["s1", "쉬움", "-"], ["serr", "서브 범실", "=", "error", ["네트", "아웃"]], ["foot", "풋폴트", "=", "error"]]],
  ["receive", "리시브", [["r3", "완벽", "#"], ["r2", "좋음", "+"], ["r1", "보통", "!"], ["rover", "바로 넘어감", "-"], ["rerr", "리시브 실패", "=", "error"]]],
  ["attack", "공격", [["kill", "스파이크 득점", "#", "earned"], ["tip", "페인트 득점", "#", "earned"], ["dump", "투 득점", "#", "earned"], ["down", "다운볼 득점", "#", "earned"], ["inplay", "이어짐", "!"], ["aerr", "공격 범실", "=", "error", ["네트", "아웃"]], ["blocked", "블로킹 당함", "/", "error"], ["backrow", "후위 반칙", "=", "error"]]],
  ["block", "블로킹", [["blk", "블로킹 득점", "#", "earned"], ["touch", "유효 블로킹", "+"], ["binplay", "블로킹 이어짐", "!"], ["half", "반쪽 블로킹", "!"], ["berr", "블로킹 범실", "=", "error", ["네트 터치", "아웃"]]]],
  ["dig", "디그", [["dig", "디그", "+"], ["dok", "디그 보통", "!"], ["derr", "디그 실패", "=", "error"]]],
  ["set", "토스", [["t3", "완벽", "#"], ["t2", "좋음", "+"], ["t1", "보통", "!"], ["terr", "토스 범실", "=", "error"]]],
  ["free", "프리볼", [["f3", "완벽", "#"], ["f2", "좋음", "+"], ["f1", "보통", "!"], ["ferr", "프리볼 실패", "=", "error"]]],
  ["fault", "반칙", [["hand", "캐치·더블", "=", "error"], ["net", "네트 터치", "=", "error"], ["under", "센터라인", "=", "error"], ["over", "오버넷", "=", "error"], ["rotf", "포지션 폴트", "=", "error"], ["whose", "서로 미룸", "=", "error"]]],
];
const CT_ACT = Object.fromEntries(CT_MENU.flatMap(([sk, , l]) => l.map(a => [a[0], { skill: sk, code: a[0], name: a[1], grade: a[2], res: a[3] || "", det: a[4] || null }])));
const CT_PT = "pt"; // 누가 땄는지만 (선수 없이)
const CT_SUB = "sub"; // 교체 (zone = 바뀐 자리 1~6, detail = 나간 선수)
const CT_LIB = "lib"; // 코트에 서는 리베로 바꾸기 (리베로 2명일 때)
const ctIsLib = (L, v) => ((L.us || {}).libero || []).some(x => String(x) === String(v));
const ctOther = s => s === "us" ? "opp" : "us";
const ctLu = m => m.lineup || {};
const ctReady = m => { const L = ctLu(m); return L.us && (L.us.slots || []).filter(Boolean).length === 6 && L.opp && (L.opp.slots || []).filter(x => x !== "" && x != null).length === 6; };
// 로테이션 r에서 자리 z(1~6)에 선 선수 = 처음(R1) 자리 ((z-1)+(r-1))%6 +1 의 선수 (로테이션은 2→1, 1→6 … 시계 방향)
const ctAt = (slots, r, z) => slots[((z - 1) + (r - 1)) % 6];
// 리베로 자동: '리베로' 표시한 선수가 뒷줄(5·6, 상대 서브일 때 1)에 오면 그 자리에 리베로. 우리 서브 차례 1번 자리는 원래 선수가 서브
const ctUsAt = (s, z) => { const i = ((z - 1) + (s.rot - 1)) % 6; return s.lib && !s.usSlots.includes(s.lib) && s.libFor.includes(i) && (z === 5 || z === 6 || (z === 1 && s.serve !== "us")) ? { v: s.lib, lib: true } : { v: s.usSlots[i], lib: false }; };
const ctZoneOf = (slots, r, i) => ((i - (r - 1)) % 6 + 6) % 6 + 1; // 처음 자리 i(0~5)가 지금 서 있는 자리
// 세트 하나를 처음부터 다시 따라가며 지금 상태 계산 (되돌리기도 이걸로 맞음)
function ctState(m, ev, setNo) {
  const L = ctLu(m), st = (L.sets || {})[setNo] || {};
  const s = { rot: st.rot || 1, orot: st.opp_rot || 1, serve: st.serve || "us", us: 0, op: 0, done: false, last: null, list: [],
    usSlots: [...((L.us || {}).slots || [])], opSlots: [...((L.opp || {}).slots || [])],
    lib: ((L.us || {}).libero || [])[0] || null, libFor: (L.us || {}).libFor || [] };
  for (const e of ev) {
    if (e.set_no !== setNo || !e.action) continue;
    s.list.push(e);
    if (e.action === CT_LIB) { if (ctIsLib(L, e.player_id) && !s.usSlots.includes(e.player_id)) s.lib = e.player_id; continue; }
    if (e.action === CT_SUB) { const i = (e.zone || 0) - 1; if (i >= 0 && i < 6) { if (e.side === "us") s.usSlots[i] = e.player_id; else s.opSlots[i] = e.opp_no; }
      // 리베로(L)를 일반 선수(OH 등)로 넣으면 리베로 자리는 다른 리베로가 (없으면 리베로 없이)
      if (e.side === "us" && s.lib === e.player_id) s.lib = ((L.us || {}).libero || []).find(x => x !== e.player_id && !s.usSlots.includes(x)) || null;
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
// 세트 끝: 25점(5세트 15점) 넘고 2점 차
const ctSetEnd = (s, setNo) => { const t = setNo === 5 ? 15 : 25; return Math.max(s.us, s.op) >= t && Math.abs(s.us - s.op) >= 2 ? (s.us > s.op ? "us" : "opp") : null; };
// 다음에 나올 동작 짐작: 랠리 흐름(서브 → 리시브 → 토스 → 공격 → 블로킹/디그 …)
function ctGuess(s, side, z) {
  const front = [2, 3, 4].includes(Number(z)), l = s.last;
  if (!l) return side === s.serve ? "serve" : "receive";
  if (side === l.side) return { serve: front ? "block" : "dig", receive: "set", dig: "set", free: "set", set: "attack", attack: "dig", block: "dig" }[l.skill] || "set";
  if (l.skill === "attack" || l.skill === "set") return front ? "block" : "dig";
  if (l.skill === "serve") return "receive";
  if (l.action === "rover") return front ? "attack" : "free";
  return front && l.skill !== "block" ? "block" : "dig";
}
const ctName = (side, v) => { if (side === "us") { const p = playerOf(v); return p ? { no: p.number != null ? String(p.number) : "", nm: p.name } : { no: "", nm: "?" }; } return { no: String(v ?? ""), nm: "" }; };
function ctBtn(side, v, z, serving, lib) {
  const n = ctName(side, v);
  return `<button type="button" class="ct-p ${side} ${serving ? "srv" : ""} ${lib ? "lib" : ""}" data-act="ctpick" data-side="${side}" data-v="${esc(v)}" ${z ? `data-z="${z}"` : ""}><b>${esc(n.no || "–")}</b>${n.nm ? `<span>${esc(n.nm)}</span>` : ""}${z ? `<i>${z}</i>` : ""}</button>`;
}
const ctFlip = () => { try { return localStorage.getItem("snuvt-ctflip") === "1"; } catch (e) { return false; } };
// 코트 화면
function ctPad(m, ev) {
  const S = sc(), L = ctLu(m), setNo = S.sel.set || 1;
  if (!ctReady(m)) return `<div class="panel ct-empty"><b>라인업이 아직 없어요</b>${can("analysis") ? `<button class="btn primary" type="button" data-act="ctlineup">라인업 넣기</button>` : `<span class="small muted">전력분석 담당이 넣을 수 있어요.</span>`}</div>`;
  ctWake(true);
  const s = ctState(m, ev, setNo), flip = ctFlip(), end = ctSetEnd(s, setNo);
  // 아래 칸: 앞줄(네트) 4·3·2, 뒷줄 5·6·1 / 위 칸: 뒷줄 1·6·5, 앞줄 2·3·4 (영상 방향에 맞게 뒤집기)
  const half = (side, slots, r, top) => { const srv = s.serve === side && !s.last;
    const rows = top ? [[1, 6, 5], [2, 3, 4]] : [[4, 3, 2], [5, 6, 1]];
    return `<div class="ct-half ${side}">${rows.map(row => `<div class="ct-row">${row.map(z => { const x = side === "us" ? ctUsAt(s, z) : { v: ctAt(slots, r, z), lib: false }; return ctBtn(side, x.v, z, srv && z === 1, x.lib); }).join("")}</div>`).join("")}</div>`; };
  const lib = (side, l) => (l || []).filter(x => x !== "" && x != null && !(side === "us" && s.usSlots.includes(x))).map(v => ctBtn(side, v, 0, false, side === "us" && String(v) === String(s.lib))).join("");
  const onCourt = new Set(s.usSlots), bench = sortedPlayers().filter(p => !p.military && !onCourt.has(p.id) && !(L.us.libero || []).includes(p.id));
  const recent = s.list.slice(-6).reverse(), q = ctQ.list.length;
  // 랠리 시작이면 서버 한 번에 기록
  const server = s.serve === "us" ? ctAt(s.usSlots, s.rot, 1) : ctAt(s.opSlots, s.orot, 1), sn = ctName(s.serve, server);
  const srvRow = !s.last && !end ? `<div class="ct-srv ${s.serve}"><span class="ct-srvw">서브 <b>${esc(sn.no ? "#" + sn.no : "")}</b> ${esc(sn.nm)}</span><div class="ct-srvb">${CT_MENU[0][2].filter(a => a[0] !== "foot").map(a => `<button type="button" class="btn sc-g ${a[3] === "earned" ? "g-best" : a[3] === "error" ? "g-err" : a[2] === "+" ? "g-good" : "g-ok"}" data-act="ctsrv" data-a="${a[0]}">${a[0] === "serr" ? "범실" : esc(a[1])}</button>`).join("")}</div></div>` : "";
  const endRow = end ? `<div class="ct-end"><b>${setNo}세트 ${end === "us" ? "우리" : esc(m.opponent || "상대")} 승 · ${s.us}:${s.op}</b>${setNo < 5 ? `<button class="btn primary small" type="button" data-act="ctnextset">${setNo + 1}세트 시작</button>` : ""}</div>` : "";
  const court = flip ? `${half("us", s.usSlots, s.rot, true)}<div class="ct-net"><span>네트</span></div>${half("opp", s.opSlots, s.orot, false)}` : `${half("opp", s.opSlots, s.orot, true)}<div class="ct-net"><span>네트</span></div>${half("us", s.usSlots, s.rot, false)}`;
  return `<div class="ct-wrap">${state.ctFocus ? `<div class="ct-clock">${scVodHtml(m)}</div>` : ""}<div class="panel ct-bar">
      <div class="sc-row"><span class="sc-k">세트</span>${[1, 2, 3, 4, 5].map(n => scChip("scset", n, setNo, n)).join("")}<span class="ct-tools">${q ? `<span class="chip warn" title="인터넷이 되면 저장돼요">대기 ${q}</span>` : ""}<button class="btn link small" type="button" data-act="ctflip">뒤집기</button><button class="btn small ${state.ctFocus ? "" : "primary"}" type="button" data-act="ctfocus">${state.ctFocus ? "나가기" : "기록 화면"}</button>${can("analysis") ? `<button class="btn link small" type="button" data-act="ctlineup">라인업</button>` : ""}</span></div>
      <div class="ct-score"><span class="ct-t us ${s.serve === "us" ? "srv" : ""}">우리 <small>R${s.rot}</small></span><b class="num">${s.us} : ${s.op}</b><span class="ct-t opp ${s.serve === "opp" ? "srv" : ""}"><small>R${s.orot}</small> ${esc(m.opponent || "상대")}</span></div>
      ${endRow || srvRow}
      <div class="ct-quick"><button class="btn small" type="button" data-act="ctpt" data-w="us">우리 +1</button>${s.list.length ? `<button class="btn small ct-undo" type="button" data-act="ctundo">↶ 되돌리기</button>` : "<span></span>"}<button class="btn small" type="button" data-act="ctpt" data-w="opp">상대 +1</button></div>
    </div>
    <div class="ct-court">${court}</div>
    <div class="ct-extra">
      ${(L.opp.libero || []).length ? `<div class="sc-row"><span class="sc-k">상대 리베로</span>${lib("opp", L.opp.libero)}</div>` : ""}
      ${(x => x ? `<div class="sc-row"><span class="sc-k">리베로</span>${x}</div>` : "")(lib("us", L.us.libero))}
      <details data-keep="ct-bench" ${keepOpen("ct-bench", false)}><summary class="small">교체</summary>
        <div class="sc-row">${bench.map(p => ctBtn("us", p.id, 0, false)).join("")}</div>
        <div class="sc-row"><label class="fl sc-opp">상대 번호<input id="ctOppNo" type="number" inputmode="numeric" min="0" max="99" placeholder="번호"></label><button class="btn small" type="button" data-act="ctpickno">선택</button></div>
      </details>
    </div>
    <section class="sec ct-recs"><div class="sec-head"><h3>방금 기록 <span class="small muted">${s.list.length}개</span></h3></div>
      ${recent.length ? `<ul class="watch sc-recent ct-rec">${recent.map(e => `<li class="${e._pending ? "ct-pend" : ""}"><span class="num small">${esc(e.score || "")}</span><span class="small ct-l">${ctLabel(e)}</span>${e.point ? `<span class="chip ${e.point === "us" ? "ok" : "warn"}">${e.point === "us" ? "우리" : "상대"} 점수</span>` : ""}</li>`).join("")}</ul>` : emptyLine("선수를 눌러 기록을 시작해요.")}
    </section></div>`;
}
function ctLabel(e) {
  const a = CT_ACT[e.action], who = e.side === "us" ? (() => { const p = playerOf(e.player_id); return p ? `${pNo(p)}${esc(p.name)}` : "우리"; })() : `상대 #${e.opp_no ?? "?"}`;
  if (e.action === CT_PT) return `${e.side === "us" ? "우리" : "상대"} 점수`;
  if (e.action === CT_LIB) return `리베로 바꿈 · ${who}`;
  if (e.action === CT_SUB) return `교체 · ${who} 들어감${e.detail ? ` ↔ ${esc(e.detail)}` : ""}`;
  return `${who} · ${a ? esc(a.name) : esc(e.action)}${e.detail ? ` (${esc(e.detail)})` : ""}${e.zone ? ` → ${e.zone}` : ""}`;
}
// 선수를 누르면: 동작 고르기 창 (다음 동작을 미리 골라 둠)
function ctOpen(side, v, z) {
  const S = sc(), m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1);
  const onCourt = (side === "us" ? s.usSlots : s.opSlots).some(x => String(x) === String(v));
  const L = ctLu(m), lib = ((L[side] || {}).libero || []).some(x => String(x) === String(v));
  const usLib = side === "us" && lib && !onCourt, other = usLib && s.libFor.length && String(v) !== String(s.lib); // 지금 안 뛰는 리베로
  let cat = (!onCourt && !lib) || other ? "sub" : ctGuess(s, side, z);
  if (usLib && ["serve", "block", "attack"].includes(cat)) cat = cat === "attack" ? "set" : "dig"; // 리베로는 서브·블로킹 X
  S.ct = { side, v, z: z || null, cat, zone: null, act: null };
  ctSheet();
}
function ctSheet() {
  const S = sc(), c = S.ct; if (!c) return;
  const m = scMatch(), n = ctName(c.side, c.v), el = document.getElementById("sheet");
  const zoned = ["serve", "attack"].includes(c.cat);
  const btn = (a, i) => { const cls = a[3] === "earned" ? "g-best" : a[3] === "error" ? (a[2] === "/" ? "g-blk" : "g-err") : a[2] === "#" || a[2] === "+" ? "g-good" : "g-ok";
    return `<button type="button" class="btn sc-g ${cls}" data-act="ctact" data-a="${a[0]}">${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}${esc(a[1])}</button>`; };
  const det = c.act && CT_ACT[c.act].det;
  let body;
  if (c.cat === "sub") {
    const s = ctState(m, S.events[m.id] || [], S.sel.set || 1), L = ctLu(m), slots = c.side === "us" ? s.usSlots : s.opSlots, r = c.side === "us" ? s.rot : s.orot;
    const i = slots.findIndex(x => String(x) === String(c.v));
    const asPlayer = () => `<p class="small">선수로 들어가기 · 누구 대신?</p><div class="ct-acts">${slots.map((x, k) => { const nn = ctName("us", x); return `<button type="button" class="btn sc-g g-ok" data-act="ctsub" data-in="${esc(c.v)}" data-i="${k}"><kbd>${ctZoneOf(slots, r, k)}</kbd>${esc(nn.no ? "#" + nn.no : "")} ${esc(nn.nm)}</button>`; }).join("")}</div>`;
    if (c.side === "us" && ctIsLib(L, c.v) && i < 0) body = `${String(c.v) !== String(s.lib) && s.libFor.length ? `<div class="ct-acts"><button type="button" class="btn sc-g g-good" data-act="ctlib" data-v="${esc(c.v)}">이 리베로로 바꾸기</button></div>` : ""}${asPlayer()}`;
    else if (i >= 0) { // 코트에 있는 선수 → 누가 들어오나
      body = c.side === "us"
        ? `<p class="small">들어올 선수</p><div class="ct-acts">${sortedPlayers().filter(p => !p.military && !slots.includes(p.id)).map(p => `<button type="button" class="btn sc-g g-ok" data-act="ctsub" data-in="${esc(p.id)}" data-i="${i}">${esc(pNo(p) + p.name)}${p.pos === "Li" ? " · L" : ""}</button>`).join("")}</div>`
        : `<div class="sc-row"><label class="fl sc-opp">들어올 번호<input id="ctSubNo" type="number" inputmode="numeric" min="0" max="99"></label><button class="btn primary small" type="button" data-act="ctsub" data-i="${i}">교체</button></div>`;
    } else body = `<p class="small">누구 대신?</p><div class="ct-acts">${slots.map((x, k) => { const nn = ctName(c.side, x); return `<button type="button" class="btn sc-g g-ok" data-act="ctsub" data-in="${esc(c.v)}" data-i="${k}"><kbd>${ctZoneOf(slots, r, k)}</kbd>${esc(nn.no ? "#" + nn.no : "")} ${esc(nn.nm)}</button>`; }).join("")}</div>`;
  } else {
    const cat = CT_MENU.find(x => x[0] === c.cat) || CT_MENU[0];
    body = `${zoned ? `<div class="sc-row"><span class="sc-k">코스</span><div class="sc-court">${ZONES.map(z => `<button type="button" class="sc-z ${c.zone === z ? "on" : ""}" data-act="ctzone" data-v="${z}">${z}</button>`).join("")}</div></div>` : ""}
    ${det ? `<p class="small">${esc(CT_ACT[c.act].name)} · 이유</p><div class="ct-acts">${det.map((d, i) => `<button type="button" class="btn sc-g g-err" data-act="ctdet" data-v="${esc(d)}"><kbd>${i + 1}</kbd>${esc(d)}</button>`).join("")}<button type="button" class="btn sc-g g-ok" data-act="ctdet" data-v=""><kbd>${det.length + 1}</kbd>모름</button></div>`
      : `<div class="ct-acts">${cat[2].map(btn).join("")}</div>`}`;
  }
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${c.side === "us" ? "우리" : "상대"} ${esc(n.no ? "#" + n.no : "")} ${esc(n.nm)}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="sc-row ct-cats">${CT_MENU.map(([k, l]) => `<button type="button" class="chip sc-chip ${k === c.cat ? "on" : ""}" data-act="ctcat" data-v="${k}">${l}</button>`).join("")}<button type="button" class="chip sc-chip ${c.cat === "sub" ? "on" : ""}" data-act="ctcat" data-v="sub">교체</button></div>
    ${body}`;
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
  try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
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
    skill: a.skill, grade: a.grade, action: code, detail: detail || null, zone: c.zone || null, rot, opp_rot: orot, serve: serveBefore, point, score: `${us}:${op}`, t: scNow(), author: uid() };
  ctPush(row, point ? { match_id: m.id, set_no: setNo, rot, opp_rot: orot, serve: serveBefore, won: point === "us", t: row.t, author: uid() } : null);
  S.ct = null; closeSheet(); state.dirty = false; render();
}
function ctSubSave(inV, i) {
  const S = sc(), m = scMatch(), c = S.ct || {}, setNo = S.sel.set || 1, s = ctState(m, S.events[m.id] || [], setNo);
  const slots = c.side === "us" ? s.usSlots : s.opSlots, out = slots[i];
  if (inV === "" || inV == null) return toast("들어올 번호를 넣어 주세요");
  if (slots.some(x => String(x) === String(inV))) return toast("이미 코트에 있어요");
  const on = ctName(c.side, out);
  ctPush({ match_id: m.id, set_no: setNo, side: c.side, player_id: c.side === "us" ? inV : null, opp_no: c.side === "opp" ? Number(inV) : null, skill: "sub", grade: "!", action: CT_SUB,
    detail: `${on.no ? "#" + on.no + " " : ""}${on.nm}`.trim().slice(0, 30) || null, zone: i + 1, rot: s.rot, opp_rot: s.orot, serve: s.serve, point: null, score: `${s.us}:${s.op}`, t: scNow(), author: uid() }, null);
  S.ct = null; closeSheet(); state.dirty = false; render();
}
function ctLibSave(v) {
  const S = sc(), m = scMatch(), setNo = S.sel.set || 1, s = ctState(m, S.events[m.id] || [], setNo);
  ctPush({ match_id: m.id, set_no: setNo, side: "us", player_id: v, opp_no: null, skill: "sub", grade: "!", action: CT_LIB, detail: null, zone: null, rot: s.rot, opp_rot: s.orot, serve: s.serve, point: null, score: `${s.us}:${s.op}`, t: scNow(), author: uid() }, null);
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
// 기록 화면: 머리말·메뉴를 숨기고 점수·코트만 (가로로 돌리면 코트 옆에 점수)
function ctFocus(on, quiet) {
  state.ctFocus = !!on;
  try {
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  } catch (e) {}
  if (on) { pushInner(); window.scrollTo(0, 0); }
  if (!quiet) { state.dirty = false; render(); }
}
// 화면 꺼짐 막기 (코트 입력 중에만)
let ctLock = null;
async function ctWake(on) {
  try {
    if (on && !ctLock && navigator.wakeLock && document.visibilityState === "visible") { ctLock = await navigator.wakeLock.request("screen"); ctLock.addEventListener("release", () => { ctLock = null; }); }
    else if (!on && ctLock) { const l = ctLock; ctLock = null; await l.release(); }
  } catch (e) { ctLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.view === "scout" && sc().tab === "court" && scMatch()) ctWake(true); });
// 라인업 · 세트 시작 로테 (전력분석 담당). 라인업 용지처럼 앞줄 4·3·2, 뒷줄 5·6·1 순서로 입력 (저장은 자리 1~6)
const CT_SHEET = [3, 2, 1, 4, 5, 0];
function ctLineupForm() {
  const S = sc(), m = scMatch(), L = ctLu(m), setNo = S.sel.set || 1, prev = (L.sets || {})[setNo - 1];
  const st = (L.sets || {})[setNo] || (prev ? { rot: prev.rot, opp_rot: prev.opp_rot, serve: prev.serve === "opp" ? "us" : "opp" } : {});
  const ps = sortedPlayers().filter(p => !p.military), us = (L.us && L.us.slots) || [], op = (L.opp && L.opp.slots) || [];
  const libFor = L.us && L.us.libFor ? L.us.libFor : us.map((id, i) => (playerOf(id) || {}).pos === "MB" ? i : -1).filter(i => i >= 0);
  const sel = (i, cur) => `<div class="ct-lu-c"><label class="fl">${i + 1}${i === 0 ? " 서브" : ""}<select id="ctu-${i}"><option value="">선택</option>${ps.map(p => `<option value="${p.id}" ${cur === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)} · ${esc(p.pos === "Li" ? "L" : p.pos || "")}</option>`).join("")}</select></label><label class="ct-lf"><input type="checkbox" id="ctf-${i}" ${libFor.includes(i) ? "checked" : ""}>리베로</label></div>`;
  const lsel = (k, cur) => `<label class="fl">리베로 ${k + 1}<select id="ctu-l${k}"><option value="">없음</option>${ps.map(p => `<option value="${p.id}" ${cur === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)}${p.pos === "Li" ? " · L" : ""}</option>`).join("")}</select></label>`;
  const num = (id, v, l) => `<label class="fl">${l}<input id="${id}" type="number" inputmode="numeric" min="0" max="99" value="${esc(v ?? "")}"></label>`;
  const libs = (L.us && L.us.libero) || [];
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>라인업</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="ctLineupForm">
      <h4>우리</h4><div class="ct-lu"><span class="ct-netl">네트</span>${CT_SHEET.map(i => sel(i, us[i])).join("")}</div>
      <div class="pair">${lsel(0, libs[0])}${lsel(1, libs[1])}</div>
      <h4>${esc(m.opponent || "상대")} (등번호)</h4><div class="ct-lu"><span class="ct-netl">네트</span>${CT_SHEET.map(i => num(`cto-${i}`, op[i], `${i + 1}${i === 0 ? " 서브" : ""}`)).join("")}</div>
      <div class="pair">${num("cto-l1", ((L.opp && L.opp.libero) || [])[0], "상대 리베로")}${num("cto-l2", ((L.opp && L.opp.libero) || [])[1], "상대 리베로 2")}</div>
      <h4>${setNo}세트 시작</h4><div class="fields">
        <label class="fl">우리 로테<select id="cts-rot">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === (st.rot || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="fl">상대 로테<select id="cts-orot">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === (st.opp_rot || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="fl">첫 서브<select id="cts-serve"><option value="us" ${st.serve !== "opp" ? "selected" : ""}>우리</option><option value="opp" ${st.serve === "opp" ? "selected" : ""}>상대</option></select></label></div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function ctLineupSave(f) {
  const S = sc(), m = scMatch(), v = id => (document.getElementById(id) || {}).value || "", setNo = S.sel.set || 1;
  const us = [0, 1, 2, 3, 4, 5].map(i => v(`ctu-${i}`)), op = [0, 1, 2, 3, 4, 5].map(i => v(`cto-${i}`));
  if (us.some(x => !x) || new Set(us).size !== 6) { toast("우리 선수 6명을 겹치지 않게 골라 주세요"); return false; }
  const libs = [v("ctu-l0"), v("ctu-l1")].filter(Boolean);
  if (new Set(libs).size !== libs.length) { toast("리베로 1·2를 다른 사람으로 골라 주세요"); return false; }
  if (libs.some(x => us.includes(x))) { toast("코트 6명에 넣은 선수는 리베로로 고를 수 없어요"); return false; }
  const libFor = [0, 1, 2, 3, 4, 5].filter(i => (document.getElementById(`ctf-${i}`) || {}).checked);
  if (libFor.length && !libs.length) { toast("리베로를 골라 주세요"); return false; }
  if (op.some(x => x === "")) { toast("상대 등번호 6개를 넣어 주세요"); return false; }
  const L = { ...ctLu(m) };
  L.us = { slots: us, libero: libs, libFor };
  L.opp = { slots: op.map(Number), libero: [v("cto-l1"), v("cto-l2")].filter(x => x !== "").map(Number) };
  L.sets = { ...(L.sets || {}), [setNo]: { rot: Number(v("cts-rot")) || 1, opp_rot: Number(v("cts-orot")) || 1, serve: v("cts-serve") || "us" } };
  ok(await sb.from("scout_matches").update({ lineup: L }).eq("id", m.id));
  m.lineup = L; closeSheet(); toast("라인업을 저장했어요"); state.dirty = false; render();
  return false;
}
function courtClick(b, act) {
  const S = sc();
  if (act === "ctpick") return ctOpen(b.dataset.side, b.dataset.v, b.dataset.z);
  if (act === "ctpickno") { const n = (document.getElementById("ctOppNo") || {}).value; if (n === "" || n == null) return toast("상대 번호를 넣어 주세요"); return ctOpen("opp", n); }
  if (act === "ctcat") { S.ct.cat = b.dataset.v; S.ct.act = null; return ctSheet(); }
  if (act === "ctzone") { const z = Number(b.dataset.v); S.ct.zone = S.ct.zone === z ? null : z; return ctSheet(); }
  if (act === "ctact") { const a = CT_ACT[b.dataset.a]; if (a.det) { S.ct.act = a.code; return ctSheet(); } return ctSave(a.code, null); }
  if (act === "ctdet") return ctSave(S.ct.act, b.dataset.v || null);
  if (act === "ctsrv") { const m = scMatch(), s = ctState(m, S.events[m.id] || [], S.sel.set || 1);
    S.ct = { side: s.serve, v: String(s.serve === "us" ? ctAt(s.usSlots, s.rot, 1) : ctAt(s.opSlots, s.orot, 1)), z: 1, cat: "serve", zone: null, act: null };
    const a = CT_ACT[b.dataset.a]; if (a.det) { S.ct.act = a.code; return ctSheet(); } return ctSave(a.code, null); }
  if (act === "ctsub") return ctSubSave(b.dataset.in != null ? b.dataset.in : (document.getElementById("ctSubNo") || {}).value, Number(b.dataset.i));
  if (act === "ctpt") { S.ct = { side: b.dataset.w, v: null }; return ctSave(CT_PT, null); }
  if (act === "ctlib") return ctLibSave(b.dataset.v);
  if (act === "ctundo") return ctUndo();
  if (act === "ctlineup") return ctLineupForm();
  if (act === "ctfocus") { if (state.ctFocus) { try { history.back(); } catch (e) { ctFocus(false); } return; } return ctFocus(true); }
  if (act === "ctflip") { try { localStorage.setItem("snuvt-ctflip", ctFlip() ? "0" : "1"); } catch (e) {} state.dirty = false; return render(); }
  if (act === "ctnextset") { const m = scMatch(), n = (S.sel.set || 1) + 1; S.sel.set = n; state.dirty = false; render(); if (!(ctLu(m).sets || {})[n] && can("analysis")) ctLineupForm(); return; }
}
// 컴퓨터: 창이 열려 있으면 숫자 키로 바로 고르기 (예전 프로그램처럼) · 코트에서 Backspace = 되돌리기
document.addEventListener("keydown", ev => {
  if (state.view !== "scout" || sc().tab !== "court" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  const sh = document.getElementById("sheet");
  if (sh && !sh.hidden && sc().ct && /^[1-9]$/.test(ev.key)) { const bs = sh.querySelectorAll(".ct-acts .btn"), x = bs[Number(ev.key) - 1]; if (x) { ev.preventDefault(); x.click(); } }
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
  return `<div class="tw"><table class="ct-sheet"><thead><tr><th>선수</th><th>득점</th><th>공격</th><th>성공률</th><th>효율</th><th>점유율</th><th>서브</th><th>서브 점수</th><th>블로킹</th><th>디그</th><th>리시브</th><th>리시브 점수</th><th>토스 점수</th><th>범실</th></tr></thead><tbody>${keys.map(row).join("")}</tbody></table></div>`;
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
