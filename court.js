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
const ctOther = s => s === "us" ? "opp" : "us";
const ctLu = m => m.lineup || {};
const ctReady = m => { const L = ctLu(m); return L.us && (L.us.slots || []).filter(Boolean).length === 6 && L.opp && (L.opp.slots || []).filter(x => x !== "" && x != null).length === 6; };
// 로테이션 r에서 자리 z(1~6)에 선 선수 = 처음(R1) 자리 ((z-1)+(r-1))%6 +1 의 선수 (로테이션은 2→1, 1→6 … 시계 방향)
const ctAt = (slots, r, z) => slots[((z - 1) + (r - 1)) % 6];
// 세트 하나를 처음부터 다시 따라가며 지금 상태 계산 (되돌리기도 이걸로 맞음)
function ctState(m, ev, setNo) {
  const L = ctLu(m), st = (L.sets || {})[setNo] || {}, s = { rot: st.rot || 1, orot: st.opp_rot || 1, serve: st.serve || "us", us: 0, op: 0, done: false, list: [] };
  for (const e of ev) {
    if (e.set_no !== setNo || !e.action) continue;
    s.list.push(e);
    if (e.skill === "serve") { s.serve = e.side; s.done = false; }
    else if (e.skill === "receive") { s.serve = ctOther(e.side); s.done = false; } // 리시브 = 새 랠리 (서브 기록을 빼먹어도)
    if (e.point) {
      if (e.point === "us") { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; }
      else { s.op++; if (s.serve === "us") s.orot = s.orot % 6 + 1; s.serve = "opp"; }
      s.done = true;
    }
  }
  return s;
}
const ctName = (side, v) => { if (side === "us") { const p = playerOf(v); return p ? { no: p.number != null ? String(p.number) : "", nm: p.name } : { no: "", nm: "?" }; } return { no: String(v ?? ""), nm: "" }; };
function ctBtn(side, v, z, serving) {
  const n = ctName(side, v);
  return `<button type="button" class="ct-p ${side} ${serving ? "srv" : ""}" data-act="ctpick" data-side="${side}" data-v="${esc(v)}" ${z ? `data-z="${z}"` : ""}><b>${esc(n.no || "–")}</b>${n.nm ? `<span>${esc(n.nm)}</span>` : ""}${z ? `<i>${z}</i>` : ""}</button>`;
}
// 코트 화면
function ctPad(m, ev) {
  const S = sc(), L = ctLu(m), setNo = S.sel.set || 1;
  if (!ctReady(m)) return `<div class="panel ct-empty"><b>라인업이 아직 없어요</b><span class="small muted">우리 선발 6명과 상대 등번호 6개를 넣으면 코트에서 바로 기록해요.</span>${can("analysis") ? `<button class="btn primary" type="button" data-act="ctlineup">라인업 넣기</button>` : `<span class="small muted">전력분석 담당이 넣을 수 있어요.</span>`}</div>`;
  const s = ctState(m, ev, setNo), us = L.us.slots, op = L.opp.slots;
  const half = (side, slots, r) => { const srv = s.serve === side;
    // 우리: 네트 쪽 4·3·2, 뒤 5·6·1 / 상대(위, 우리 쪽에서 본 모양): 뒤 1·6·5, 네트 쪽 2·3·4
    const rows = side === "us" ? [[4, 3, 2], [5, 6, 1]] : [[1, 6, 5], [2, 3, 4]];
    return `<div class="ct-half ${side}">${rows.map(row => `<div class="ct-row">${row.map(z => ctBtn(side, ctAt(slots, r, z), z, srv && z === 1)).join("")}</div>`).join("")}</div>`; };
  const lib = (side, l) => (l || []).filter(x => x !== "" && x != null).map(v => ctBtn(side, v, 0, false)).join("");
  const onCourt = new Set(us), bench = sortedPlayers().filter(p => !p.military && !onCourt.has(p.id) && !(L.us.libero || []).includes(p.id));
  const recent = s.list.slice(-6).reverse();
  return `<div class="panel ct-bar">
      <div class="sc-row"><span class="sc-k">세트</span>${[1, 2, 3, 4, 5].map(n => scChip("scset", n, setNo, n)).join("")}${can("analysis") ? `<button class="btn link small" type="button" data-act="ctlineup" style="margin-left:auto">라인업 · 시작 로테</button>` : ""}</div>
      <div class="ct-score"><span class="ct-t us ${s.serve === "us" ? "srv" : ""}">우리 <small>R${s.rot}</small></span><b class="num">${s.us} : ${s.op}</b><span class="ct-t opp ${s.serve === "opp" ? "srv" : ""}"><small>R${s.orot}</small> ${esc(m.opponent || "상대")}</span></div>
      <div class="ct-quick"><button class="btn small" type="button" data-act="ctpt" data-w="us">우리 +1</button><span class="small muted">${s.serve === "us" ? "우리 서브" : "상대 서브"}</span><button class="btn small" type="button" data-act="ctpt" data-w="opp">상대 +1</button></div>
    </div>
    <div class="ct-court">${half("opp", op, s.orot)}<div class="ct-net"><span>네트</span></div>${half("us", us, s.rot)}</div>
    <div class="ct-extra">
      ${(L.opp.libero || []).length ? `<div class="sc-row"><span class="sc-k">상대 리베로</span>${lib("opp", L.opp.libero)}</div>` : ""}
      ${(L.us.libero || []).length ? `<div class="sc-row"><span class="sc-k">리베로</span>${lib("us", L.us.libero)}</div>` : ""}
      <details data-keep="ct-bench" ${keepOpen("ct-bench", false)}><summary class="small">교체 선수 · 상대 다른 번호</summary>
        <div class="sc-row">${bench.map(p => ctBtn("us", p.id, 0, false)).join("")}</div>
        <div class="sc-row"><label class="fl sc-opp">상대 번호<input id="ctOppNo" type="number" inputmode="numeric" min="0" max="99" placeholder="번호"></label><button class="btn small" type="button" data-act="ctpickno">기록</button></div>
      </details>
    </div>
    <section class="sec"><div class="sec-head"><h3>방금 기록 <span class="small muted">${s.list.length}개</span></h3>${s.list.length ? `<button class="btn link small danger" type="button" data-act="ctundo">하나 되돌리기</button>` : ""}</div>
      ${recent.length ? `<ul class="watch sc-recent ct-rec">${recent.map(e => `<li><span class="num small">${esc(e.score || "")}</span><span class="small ct-l">${ctLabel(e)}</span>${e.point ? `<span class="chip ${e.point === "us" ? "ok" : "warn"}">${e.point === "us" ? "우리" : "상대"} 점수</span>` : ""}</li>`).join("")}</ul>` : emptyLine("선수를 눌러 기록을 시작해요.")}
    </section>`;
}
function ctLabel(e) {
  const a = CT_ACT[e.action], who = e.side === "us" ? (() => { const p = playerOf(e.player_id); return p ? `${pNo(p)}${esc(p.name)}` : "우리"; })() : `상대 #${e.opp_no ?? "?"}`;
  if (e.action === CT_PT) return `${e.side === "us" ? "우리" : "상대"} 점수`;
  return `${who} · ${a ? esc(a.name) : esc(e.action)}${e.detail ? ` (${esc(e.detail)})` : ""}${e.zone ? ` → ${e.zone}` : ""}`;
}
// 선수를 누르면: 동작 고르기 창
function ctOpen(side, v) {
  const S = sc(); S.ct = { side, v, cat: S.ct && S.ct.side === side ? S.ct.cat : (side === "us" ? "receive" : "serve"), zone: null, act: null };
  ctSheet();
}
function ctSheet() {
  const c = sc().ct; if (!c) return;
  const n = ctName(c.side, c.v), cat = CT_MENU.find(x => x[0] === c.cat) || CT_MENU[0], el = document.getElementById("sheet");
  const zoned = ["serve", "attack"].includes(c.cat);
  const btn = a => { const cls = a[3] === "earned" ? "g-best" : a[3] === "error" ? (a[2] === "/" ? "g-blk" : "g-err") : a[2] === "#" || a[2] === "+" ? "g-good" : "g-ok";
    return `<button type="button" class="btn sc-g ${cls}" data-act="ctact" data-a="${a[0]}">${esc(a[1])}</button>`; };
  const det = c.act && CT_ACT[c.act].det;
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${c.side === "us" ? "우리" : "상대"} ${esc(n.no ? "#" + n.no : "")} ${esc(n.nm)}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="sc-row ct-cats">${CT_MENU.map(([k, l]) => `<button type="button" class="chip sc-chip ${k === c.cat ? "on" : ""}" data-act="ctcat" data-v="${k}">${l}</button>`).join("")}</div>
    ${zoned ? `<div class="sc-row"><span class="sc-k">코스</span><div class="sc-court">${ZONES.map(z => `<button type="button" class="sc-z ${c.zone === z ? "on" : ""}" data-act="ctzone" data-v="${z}">${z}</button>`).join("")}</div><span class="small muted">골라도 되고 안 골라도 돼요</span></div>` : ""}
    ${det ? `<p class="small">${esc(CT_ACT[c.act].name)} · 이유</p><div class="ct-acts">${det.map(d => `<button type="button" class="btn sc-g g-err" data-act="ctdet" data-v="${esc(d)}">${esc(d)}</button>`).join("")}<button type="button" class="btn sc-g g-ok" data-act="ctdet" data-v="">모름</button></div>`
      : `<div class="ct-acts">${cat[2].map(btn).join("")}</div>`}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function ctSave(code, detail) {
  const S = sc(), m = scMatch(), c = S.ct || {}; if (!m) return;
  const a = code === CT_PT ? { skill: "fault", grade: "#", res: "earned" } : CT_ACT[code];
  const ev = S.events[m.id] || [], setNo = S.sel.set || 1, s = ctState(m, ev, setNo);
  // 서브를 누르면 그 팀 서브, 리시브면 상대 서브 (점수는 랠리에서 처음 난 것만)
  const serveBefore = a.skill === "serve" ? c.side : a.skill === "receive" ? ctOther(c.side) : s.serve;
  const fresh = code === CT_PT || a.skill === "serve" || a.skill === "receive" || !s.done;
  const point = fresh && a.res ? (a.res === "earned" ? c.side : ctOther(c.side)) : null;
  let rot = s.rot, orot = s.orot, us = s.us, op = s.op;
  if (point === "us") { us++; } else if (point === "opp") { op++; }
  const row = { match_id: m.id, set_no: setNo, side: c.side, player_id: c.side === "us" && code !== CT_PT ? c.v : null, opp_no: c.side === "opp" && code !== CT_PT && c.v !== "" && c.v != null ? Number(c.v) : null,
    skill: a.skill, grade: a.grade, action: code, detail: detail || null, zone: c.zone || null, rot, opp_rot: orot, serve: serveBefore, point, score: `${us}:${op}`, t: scNow(), author: uid() };
  const r = await sb.from("scout_events").insert(row).select().maybeSingle();
  if (r.error) { toast(failMsg(r.error)); return; }
  const saved = { ...row, id: (r.data && r.data.id) || "tmp" + Date.now(), created_at: (r.data && r.data.created_at) || new Date().toISOString() };
  (S.events[m.id] = S.events[m.id] || []).push(saved);
  if (point) {
    const pr = { match_id: m.id, set_no: setNo, rot, opp_rot: orot, serve: serveBefore, won: point === "us", t: row.t, author: uid(), event_id: r.data ? r.data.id : null };
    const q = await sb.from("scout_points").insert(pr).select().maybeSingle();
    if (!q.error) (S.points[m.id] = S.points[m.id] || []).push({ ...pr, id: (q.data && q.data.id) || "tmp" + Date.now() });
  }
  S.ct = { side: c.side, cat: c.cat }; closeSheet(); state.dirty = false; render();
}
async function ctUndo() {
  const S = sc(), m = scMatch(); if (!m) return;
  const l = (S.events[m.id] || []).filter(e => e.action && e.set_no === (S.sel.set || 1)), e = l[l.length - 1]; if (!e) return;
  if (!await confirmDel(`방금 기록을 지울까요?\n${ctLabel(e).replace(/<[^>]+>/g, "")}`)) return;
  try {
    ok(await sb.from("scout_events").delete().eq("id", e.id)); // 랠리 점수(scout_points)는 같이 지워짐
    S.events[m.id] = S.events[m.id].filter(x => x.id !== e.id); S.points[m.id] = (S.points[m.id] || []).filter(p => p.event_id !== e.id);
  } catch (err) { toast(failMsg(err)); }
  state.dirty = false; render();
}
// 라인업 · 세트 시작 로테 (전력분석 담당). 라인업 용지처럼 앞줄 4·3·2, 뒷줄 5·6·1 순서로 입력 (저장은 자리 1~6)
const CT_SHEET = [3, 2, 1, 4, 5, 0];
function ctLineupForm() {
  const S = sc(), m = scMatch(), L = ctLu(m), setNo = S.sel.set || 1, st = (L.sets || {})[setNo] || {};
  const ps = sortedPlayers().filter(p => !p.military), us = (L.us && L.us.slots) || [], op = (L.opp && L.opp.slots) || [];
  const sel = (i, cur) => `<label class="fl">${i + 1}${i === 0 ? " 서브" : ""}<select id="ctu-${i}"><option value="">선택</option>${ps.map(p => `<option value="${p.id}" ${cur === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)} · ${esc(p.pos || "")}</option>`).join("")}</select></label>`;
  const num = (id, v, l) => `<label class="fl">${l}<input id="${id}" type="number" inputmode="numeric" min="0" max="99" value="${esc(v ?? "")}"></label>`;
  const libs = (L.us && L.us.libero) || [];
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>라인업</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="ctLineupForm">
      <h4>우리</h4><div class="ct-lu"><span class="ct-netl">네트</span>${CT_SHEET.map(i => sel(i, us[i])).join("")}</div>
      <label class="fl">리베로<select id="ctu-lib" multiple size="3">${ps.map(p => `<option value="${p.id}" ${libs.includes(p.id) ? "selected" : ""}>${esc(pNo(p) + p.name)}</option>`).join("")}</select></label>
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
  if (op.some(x => x === "")) { toast("상대 등번호 6개를 넣어 주세요"); return false; }
  const L = { ...ctLu(m) };
  L.us = { slots: us, libero: [...document.getElementById("ctu-lib").selectedOptions].map(o => o.value).slice(0, 2) };
  L.opp = { slots: op.map(Number), libero: [v("cto-l1"), v("cto-l2")].filter(x => x !== "").map(Number) };
  L.sets = { ...(L.sets || {}), [setNo]: { rot: Number(v("cts-rot")) || 1, opp_rot: Number(v("cts-orot")) || 1, serve: v("cts-serve") || "us" } };
  ok(await sb.from("scout_matches").update({ lineup: L }).eq("id", m.id));
  m.lineup = L; closeSheet(); toast("라인업을 저장했어요"); state.dirty = false; render();
  return false;
}
function courtClick(b, act) {
  const S = sc();
  if (act === "ctpick") return ctOpen(b.dataset.side, b.dataset.side === "us" ? b.dataset.v : b.dataset.v);
  if (act === "ctpickno") { const n = (document.getElementById("ctOppNo") || {}).value; if (n === "" || n == null) return toast("상대 번호를 넣어 주세요"); return ctOpen("opp", n); }
  if (act === "ctcat") { S.ct.cat = b.dataset.v; S.ct.act = null; return ctSheet(); }
  if (act === "ctzone") { const z = Number(b.dataset.v); S.ct.zone = S.ct.zone === z ? null : z; return ctSheet(); }
  if (act === "ctact") { const a = CT_ACT[b.dataset.a]; if (a.det) { S.ct.act = a.code; return ctSheet(); } return ctSave(a.code, null); }
  if (act === "ctdet") return ctSave(S.ct.act, b.dataset.v || null);
  if (act === "ctpt") { S.ct = { side: b.dataset.w, v: null }; return ctSave(CT_PT, null); }
  if (act === "ctundo") return ctUndo();
  if (act === "ctlineup") return ctLineupForm();
}

/* ---------- 분석: 기록지 (예전 프로그램 엑셀 요약과 같은 항목) · 상대 로테이션별 ---------- */
const ctReal = l => l.filter(e => e.action !== CT_PT);
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
