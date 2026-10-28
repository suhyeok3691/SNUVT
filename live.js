/* ---------- 대회 실시간 기록 ----------
   우리 선수 위주로 (예전 전력분석처럼 선수를 누르고 → 동작): 리시브 0~3 · 공격(득점 코스 1~6 · 범실 · 막힘(상대 블로커 · 몇 블록) · 이어짐) ·
   블로킹(몇 블록) · 서브 · 토스 범실 · 범실, 그리고 상대 득점 · 상대 범실. 점수 · 서브권 · 우리 로테는 저절로, 결과는 바로 아래에 */
const LV_ACTS = [["rcv", "리시브"], ["atk", "공격"], ["blk", "블로킹"], ["srv", "서브"], ["set", "토스 범실"], ["err", "범실"]];
const LV_NOLIB = ["atk", "blk", "srv"];
// 어느 팀 점수가 되나
const lvPoint = r => r.kind === "rcv" ? (r.res === "0" ? "opp" : null) : r.kind === "atk" ? (r.res === "kill" ? "us" : r.res === "err" || r.res === "blk" ? "opp" : null)
  : r.kind === "blk" ? "us" : r.kind === "srv" ? (r.res === "ace" ? "us" : r.res === "err" ? "opp" : null) : r.kind === "set" || r.kind === "err" || r.kind === "opt" ? "opp" : r.kind === "oer" ? "us" : null;
// 득점 코스로 페인트 · 투 자동 (레프트가 2·3번, 라이트가 3·4번에 떨어뜨리면 페인트, 세터가 앞줄 2·3·4번이면 투)
const lvShot = r => { if (r.kind !== "atk" || r.res !== "kill" || !r.zone) return ""; const pos = (playerOf(r.player_id) || {}).pos;
  if (pos === "S" && [2, 3, 4].includes(r.zone)) return "투"; if (pos === "OH" && [2, 3].includes(r.zone)) return "페인트"; if (pos === "OP" && [3, 4].includes(r.zone)) return "페인트"; return "스파이크"; };
const lvLabel = r => { const p = playerOf(r.player_id), who = p ? `${pNo(p)}${esc(p.name)} · ` : "";
  if (r.kind === "rcv") return `${who}리시브 ${r.res === "0" ? "실패" : r.res + "점"}`;
  if (r.kind === "atk") return `${who}공격 ${r.res === "kill" ? `득점${r.zone ? ` → ${r.zone}번 (${lvShot(r)})` : ""}` : r.res === "err" ? "범실" : r.res === "blk" ? `막힘${r.blockers ? ` · ${r.blockers}블록` : ""}${r.opp_no != null ? ` · 상대 #${r.opp_no}` : ""}` : "이어짐"}`;
  if (r.kind === "blk") return `${who}블로킹 득점${r.blockers ? ` · ${r.blockers}블록` : ""}`;
  if (r.kind === "srv") return `${who}서브 ${r.res === "ace" ? "에이스" : r.res === "err" ? "범실" : "들어감"}`;
  if (r.kind === "set") return `${who}토스 범실`; if (r.kind === "err") return `${who}범실`;
  return r.kind === "opt" ? "상대 득점" : r.kind === "oer" ? "상대 범실" : ""; };
const lv = () => state.live || (state.live = { games: {}, rallies: {}, open: null, set: 1, scope: "set" });
const lvCan = () => can("analysis") || can("schedule");
const lvGame = () => { const L = lv(); for (const l of Object.values(L.games)) { const g = (l || []).find(x => x.id === L.open); if (g) return g; } return null; };
// 세트 하나 다시 따라가기: 점수 · 서브권 · 우리 로테 · 연속 득실 · 이번 랠리
function lvState(g, rs, setNo) {
  const st = (g.sets || {})[setNo] || {}, s = { rot: st.rot || 1, serve: st.serve || "us", us: 0, op: 0, run: 0, list: [], rally: [] };
  for (const r of rs) {
    if (r.set_no !== setNo || !r.kind) continue; s.list.push(r);
    if (r.kind === "srv") s.serve = "us"; else if (r.kind === "rcv") s.serve = "opp";
    s.rally.push(r);
    const pt = r.point;
    if (pt === "us") { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; s.run = s.run > 0 ? s.run + 1 : 1; s.rally = []; }
    else if (pt === "opp") { s.op++; s.serve = "opp"; s.run = s.run < 0 ? s.run - 1 : -1; s.rally = []; }
  }
  return s;
}
const lvEnd = (s, setNo) => { const t = setNo === 5 ? 15 : 25; return Math.max(s.us, s.op) >= t && Math.abs(s.us - s.op) >= 2 ? (s.us > s.op ? "us" : "opp") : null; };
async function lvLoadGames(x) {
  const L = lv(), key = x.kind + ":" + x.id; L.games[key] = L.games[key] || null;
  try { const r = await sb.from("live_games").select("*").eq("ref_kind", x.kind).eq("ref_id", String(x.id)).order("created_at"); L.games[key] = r.data || []; }
  catch (e) { L.games[key] = []; }
  if (state.view === "cup" || state.view === "fr") { state.dirty = false; render(); }
}
async function lvLoadRallies(gid, quiet) {
  const L = lv();
  try {
    const r = await sb.from("live_rallies").select("*").eq("game_id", gid).order("created_at"); if (r.error) throw r.error;
    const pend = (L.rallies[gid] || []).filter(x => x._pending);
    L.rallies[gid] = [...(r.data || []), ...pend];
  } catch (e) { L.rallies[gid] = L.rallies[gid] || []; }
  if (!quiet || (state.view === "cup" || state.view === "fr") && L.open === gid && document.getElementById("sheet").hidden) { state.dirty = false; render(); }
}
// 보는 사람도 바로 보이게: 경기를 열어 두면 몇 초마다 새로 불러옴
setInterval(() => { const L = state.live; if (!L || !L.open || document.visibilityState !== "visible" || !(state.view === "cup" || state.view === "fr") || lvQ.busy) return; lvLoadRallies(L.open, true); }, 6000);
/* 저장: 화면에 먼저, 서버엔 차례대로 (끊기면 폰에 남겨 뒀다가 다시) */
const lvQ = { list: [], busy: false };
try { lvQ.list = JSON.parse(localStorage.getItem("snuvt-lvq") || "[]") || []; } catch (e) { lvQ.list = []; }
const lvQSave = () => { try { localStorage.setItem("snuvt-lvq", JSON.stringify(lvQ.list)); } catch (e) {} };
async function lvFlush() {
  if (lvQ.busy || !lvQ.list.length) return;
  if (!uid() || navigator.onLine === false) { setTimeout(lvFlush, 4000); return; }
  lvQ.busy = true;
  try {
    while (lvQ.list.length) {
      const it = lvQ.list[0], row = { ...it }; delete row.id; delete row._pending; delete row.created_at;
      const r = await sb.from("live_rallies").insert(row).select("id,created_at").maybeSingle();
      if (r.error) { if (!r.error.code || /fetch|network|JWT/i.test(r.error.message || "")) { setTimeout(lvFlush, 4000); break; } toast(failMsg(r.error)); }
      const l = lv().rallies[it.game_id] || [], loc = l.find(x => x.id === it.id);
      if (loc) { if (r.error) lv().rallies[it.game_id] = l.filter(x => x !== loc); else { loc.id = r.data.id; loc.created_at = r.data.created_at; delete loc._pending; } }
      lvQ.list.shift(); lvQSave();
    }
  } finally { lvQ.busy = false; }
  if ((state.view === "cup" || state.view === "fr") && document.getElementById("sheet").hidden) { state.dirty = false; render(); }
}
window.addEventListener("online", () => lvFlush());
setTimeout(lvFlush, 3500);
function lvSave(kind, res, extra) {
  const L = lv(), g = lvGame(); if (!g) return;
  const rs = L.rallies[g.id] || [], s = lvState(g, rs, L.set), c = L.c || {};
  const serve = kind === "srv" ? "us" : kind === "rcv" ? "opp" : s.serve;
  const row = { id: "tmp" + Date.now() + Math.random().toString(36).slice(2, 5), game_id: g.id, set_no: L.set, rot: s.rot, serve, kind, res: res || null,
    player_id: ["opt", "oer"].includes(kind) ? null : c.pid || null, zone: null, opp_no: null, blockers: null, ...(extra || {}), author: uid(), created_at: new Date().toISOString(), _pending: true };
  row.point = lvPoint(row); row.won = row.point ? row.point === "us" : null;
  (L.rallies[g.id] = rs).push(row); lvQ.list.push({ ...row }); lvQSave();
  L.c = null; closeSheet(); state.dirty = false; render(); lvFlush();
}
async function lvUndo() {
  const L = lv(), g = lvGame(); if (!g) return;
  const l = (L.rallies[g.id] || []).filter(r => r.set_no === L.set && r.kind), r = l[l.length - 1]; if (!r) return;
  if (!await confirmDel(`마지막 기록을 지울까요?\n${lvLabel(r).replace(/<[^>]+>/g, "")}`)) return;
  const qi = lvQ.list.findIndex(x => x.id === r.id);
  if (qi >= 0) { if (qi === 0 && lvQ.busy) { toast("저장 중이에요. 잠깐 뒤에 다시 눌러 주세요"); return; } lvQ.list.splice(qi, 1); lvQSave(); }
  else { try { ok(await sb.from("live_rallies").delete().eq("id", r.id)); } catch (e) { toast(failMsg(e)); return; } }
  L.rallies[g.id] = L.rallies[g.id].filter(x => x !== r); state.dirty = false; render();
}
// 선수를 누르면: 동작 고르기 (랠리 처음이면 상대 서브 → 리시브, 우리 서브 → 서브, 그 밖엔 공격)
function lvOpen(pid) {
  const L = lv(), g = lvGame(), s = lvState(g, L.rallies[g.id] || [], L.set), p = playerOf(pid) || {}, lib = p.pos === "Li";
  let act = !s.rally.length ? (s.serve === "opp" ? "rcv" : "srv") : "atk";
  if (lib && LV_NOLIB.includes(act)) act = "rcv";
  L.c = { pid, act, res: null, blockers: null, opp: null }; lvSheet();
}
const lvOppNos = g => [...new Set((lv().rallies[g.id] || []).filter(r => r.opp_no != null).map(r => r.opp_no))].sort((a, b) => a - b);
function lvSheet() {
  const L = lv(), c = L.c, g = lvGame(); if (!c || !g) return;
  const p = playerOf(c.pid) || {}, lib = p.pos === "Li", el = document.getElementById("sheet");
  const big = (act, attrs, cls, label) => `<button type="button" class="btn lv-b ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
  let body = "";
  if (c.act === "rcv") body = `<div class="lv-bs four">${[["0", "0 실패", "bad"], ["1", "1", "ok"], ["2", "2", "good"], ["3", "3", "best"]].map(([v, l, k]) => big("lvres", `data-v="${v}"`, k, l)).join("")}</div>`;
  else if (c.act === "atk") {
    if (c.res === "kill") body = `<p class="small">득점 코스 (상대 코트)</p><div class="lv-court">${[1, 6, 5].map(z => big("lvzone", `data-v="${z}"`, "zone", z)).join("")}<span class="lv-net">네트</span>${[2, 3, 4].map(z => big("lvzone", `data-v="${z}"`, "zone", z)).join("")}</div><div class="row"><button type="button" class="btn link small" data-act="lvzone" data-v="">코스 모름</button></div>`;
    else if (c.res === "blk") body = `<p class="small">몇 블록</p><div class="lv-bs three">${[1, 2, 3].map(n => big("lvblks", `data-v="${n}"`, c.blockers === n ? "on" : "", n + "블록")).join("")}</div>
      <p class="small">막은 상대</p><div class="sc-row">${lvOppNos(g).map(n => `<button type="button" class="chip sc-chip ${c.opp === n ? "on" : ""}" data-act="lvopp" data-v="${n}">#${n}</button>`).join("")}<input id="lvOppNo" class="lv-no" type="number" inputmode="numeric" min="0" max="99" placeholder="번호" value="${c.opp != null && !lvOppNos(g).includes(c.opp) ? c.opp : ""}"></div>
      <div class="row"><button type="button" class="btn primary" data-act="lvblkok">저장</button></div>`;
    else body = `<div class="lv-bs four">${big("lvres", 'data-v="kill"', "best", "득점")}${big("lvres", 'data-v="err"', "bad", "범실")}${big("lvres", 'data-v="blk"', "bad", "막힘")}${big("lvres", 'data-v="in"', "ok", "이어짐")}</div>`;
  }
  else if (c.act === "blk") body = `<p class="small">블로킹 득점 · 몇 블록</p><div class="lv-bs three">${[1, 2, 3].map(n => big("lvres", `data-v="pt" data-b="${n}"`, "best", n + "블록")).join("")}</div>`;
  else if (c.act === "srv") body = `<div class="lv-bs three">${big("lvres", 'data-v="ace"', "best", "에이스")}${big("lvres", 'data-v="err"', "bad", "범실")}${big("lvres", 'data-v="in"', "ok", "들어감")}</div>`;
  else body = `<div class="lv-bs one">${big("lvres", 'data-v="err"', "bad", c.act === "set" ? "토스 범실 기록" : "범실 기록")}</div>`;
  const acts = LV_ACTS.filter(([k]) => !(lib && LV_NOLIB.includes(k)));
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${esc(pNo(p) + (p.name || ""))} <span class="chip">${esc(p.pos === "Li" ? "L" : p.pos || "")}</span></h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="sc-row lv-acts">${acts.map(([k, l]) => `<button type="button" class="chip sc-chip ${c.act === k ? "on" : ""}" data-act="lvact" data-v="${k}">${l}</button>`).join("")}</div>${body}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
/* ---- 화면 ---- */
// 대회 · 교류전 페이지 안 목록
function lvSection(x) {
  const L = lv(), key = x.kind + ":" + x.id, gs = L.games[key];
  if (gs === undefined) { lvLoadGames(x); return `<section class="panel sec"><div class="sec-head"><h3>실시간 기록</h3></div>${loaderHtml(true)}</section>`; }
  const list = (gs || []).map(g => `<button type="button" class="box lv-g" data-act="lvopen" data-id="${esc(g.id)}"><span class="bn"><b>${esc(g.label || "경기")}</b> vs ${esc(g.opponent)}</span><span class="go">›</span></button>`).join("");
  return `<section class="panel sec"><div class="sec-head"><h3>실시간 기록</h3>${lvCan() ? `<button class="btn add" type="button" data-act="lvnew" data-k="${esc(key)}">+ 경기</button>` : ""}</div>${list ? `<div class="boxes">${list}</div>` : emptyLine("아직 기록한 경기가 없어요.")}</section>`;
}
function lvForm(key, gid) {
  const [kind, id] = key.split(":"), x = cupItems().find(y => y.kind === kind && String(y.id) === id) || {}, g = gid ? lvGame() : null;
  const fr = kind === "friendly" ? ((state.friendlies && Object.values(state.friendlies).flat().find(f => String(f.id) === id)) || {}) : {};
  const st = g ? (g.sets || {})[lv().set] || {} : {};
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${g ? "경기 수정" : "경기 추가"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="lvForm" data-k="${esc(key)}" data-id="${esc(gid || "")}"><div class="fields">
      <label class="fl">경기<input id="lv-label" maxlength="40" value="${esc(g ? g.label || "" : "")}" placeholder="예선 1경기 · 8강"></label>
      <label class="fl">상대<input id="lv-opp" required maxlength="60" value="${esc(g ? g.opponent : fr.opponent || "")}"></label>
      ${g ? "" : `<label class="fl">첫 서브<select id="lv-serve"><option value="us">SNU</option><option value="opp">상대</option></select></label>
      <label class="fl">우리 로테<select id="lv-rot">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join("")}</select></label>`}
    </div><div class="row"><button class="btn primary" type="submit">${g ? "저장" : "시작"}</button></div></form>`;
  if (g) addDelZone(`data-act="lvdel" data-id="${esc(g.id)}"`, "경기 삭제");
  el.hidden = false; document.body.classList.add("noscroll");
}
// 세트 시작: 첫 서브 · 우리 로테
function lvSetForm(n) {
  const g = lvGame(), st = (g.sets || {})[n] || {}, prev = (g.sets || {})[n - 1] || {}, el = document.getElementById("sheet");
  const serve = st.serve || (prev.serve ? (prev.serve === "us" ? "opp" : "us") : "us");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${n}세트 시작</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="lvSetForm" data-n="${n}"><div class="fields">
      <label class="fl">첫 서브<select id="lvs-serve"><option value="us" ${serve === "us" ? "selected" : ""}>SNU</option><option value="opp" ${serve === "opp" ? "selected" : ""}>${esc(g.opponent)}</option></select></label>
      <label class="fl">우리 로테<select id="lvs-rot">${[1, 2, 3, 4, 5, 6].map(r => `<option ${r === (st.rot || 1) ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    </div><div class="row"><button class="btn primary" type="submit">시작</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function lvSubmit(f) {
  const L = lv(), v = id => (document.getElementById(id) || {}).value || "";
  if (f.id === "lvForm") {
    const [kind, id] = f.dataset.k.split(":");
    if (f.dataset.id) { ok(await sb.from("live_games").update({ label: v("lv-label").trim() || null, opponent: v("lv-opp").trim() }).eq("id", f.dataset.id)); }
    else {
      const r = await sb.from("live_games").insert({ ref_kind: kind, ref_id: id, label: v("lv-label").trim() || null, opponent: v("lv-opp").trim(), sets: { 1: { serve: v("lv-serve") || "us", rot: Number(v("lv-rot")) || 1 } } }).select().maybeSingle(); ok(r);
      if (r.data) { L.open = r.data.id; L.set = 1; L.rallies[r.data.id] = []; pushInner(); }
    }
    closeSheet(); const x = cupItems().find(y => y.kind === kind && String(y.id) === id); if (x) await lvLoadGames(x); return;
  }
  if (f.id === "lvSetForm") {
    const g = lvGame(), n = Number(f.dataset.n), sets = { ...(g.sets || {}), [n]: { serve: v("lvs-serve") || "us", rot: Number(v("lvs-rot")) || 1 } };
    ok(await sb.from("live_games").update({ sets }).eq("id", g.id)); g.sets = sets; L.set = n; closeSheet(); state.dirty = false; render(); return;
  }
}
const lvPct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
const lvAvg = l => l.length ? (l.reduce((a, r) => a + Number(r.res), 0) / l.length).toFixed(2) : "—";
// 결과: 이번 세트 / 경기 전체
function lvStats(rs) {
  const pts = rs.filter(r => r.point), so = pts.filter(r => r.serve === "opp"), br = pts.filter(r => r.serve === "us");
  const atk = rs.filter(r => r.kind === "atk"), kill = atk.filter(r => r.res === "kill"), aerr = atk.filter(r => r.res === "err" || r.res === "blk");
  const rcv = rs.filter(r => r.kind === "rcv"), n = (k, res) => rs.filter(r => r.kind === k && (!res || r.res === res)).length;
  const srcUs = [["공격", n("atk", "kill")], ["블로킹", n("blk")], ["서브 에이스", n("srv", "ace")], ["상대 범실", n("oer")]];
  const srcOp = [["상대 득점", n("opt")], ["막힘", n("atk", "blk")], ["리시브 실패", n("rcv", "0")], ["서브 범실", n("srv", "err")], ["공격 범실", n("atk", "err")], ["토스 범실", n("set")], ["범실", n("err")]];
  const bar = (l, side) => { const tot = l.reduce((a, x) => a + x[1], 0); return `<div class="lv-bars">${l.map(([k, v]) => `<div class="lv-bar ${side}"><span>${k}</span><i style="--w:${tot ? Math.round(100 * v / tot) : 0}%"></i><b class="num">${v}</b></div>`).join("")}</div>`; };
  const who = id => { const p = playerOf(id); return p ? `<b>${pNo(p)}${esc(p.name)}</b>` : `<span class="muted">선수 없음</span>`; };
  const byP = l => { const m = new Map(); for (const r of l) { const k = r.player_id || ""; (m.get(k) || m.set(k, []).get(k)).push(r); } return [...m.entries()].sort((a, b) => ((playerOf(a[0]) || {}).number ?? 999) - ((playerOf(b[0]) || {}).number ?? 999)); };
  const d = v => v || "—";
  const rcvT = byP(rcv).map(([id, l]) => `<tr><td>${who(id)}</td><td class="num">${l.length}</td><td class="num"><b>${lvAvg(l)}</b></td>${["3", "2", "1", "0"].map(v => `<td class="num">${d(l.filter(r => r.res === v).length)}</td>`).join("")}</tr>`).join("");
  const atkT = byP(atk).map(([id, l]) => { const k = l.filter(r => r.res === "kill"), e = l.filter(r => r.res === "err").length, b = l.filter(r => r.res === "blk").length, f = k.filter(r => lvShot(r) === "페인트" || lvShot(r) === "투").length;
    const zs = [1, 2, 3, 4, 5, 6].map(z => [z, k.filter(r => r.zone === z).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => `${x[0]}번`).join("·");
    return `<tr><td>${who(id)}</td><td class="num">${l.length}</td><td class="num">${d(k.length)}${f ? ` <small>(페인트 ${f})</small>` : ""}</td><td class="num">${d(e)}</td><td class="num">${d(b)}</td><td class="num"><b>${lvPct(k.length - e - b, l.length)}</b></td><td class="num">${zs || "—"}</td></tr>`; }).join("");
  const zc = [1, 2, 3, 4, 5, 6].map(z => kill.filter(r => r.zone === z).length), zmax = Math.max(1, ...zc);
  const zmap = kill.some(r => r.zone) ? `<div class="lv-zmap">${[1, 6, 5].map(z => `<span style="--a:${(zc[z - 1] / zmax).toFixed(2)}"><i>${z}</i>${zc[z - 1] || ""}</span>`).join("")}${[2, 3, 4].map(z => `<span style="--a:${(zc[z - 1] / zmax).toFixed(2)}"><i>${z}</i>${zc[z - 1] || ""}</span>`).join("")}</div><p class="small muted lv-net2">네트</p>` : "";
  const blkT = byP(rs.filter(r => r.kind === "blk")).map(([id, l]) => `<tr><td>${who(id)}</td><td class="num"><b>${l.length}</b></td>${[1, 2, 3].map(b => `<td class="num">${d(l.filter(r => r.blockers === b).length)}</td>`).join("")}</tr>`).join("");
  const blocked = atk.filter(r => r.res === "blk"), bm = new Map(); for (const r of blocked) { const k = r.opp_no ?? "?"; (bm.get(k) || bm.set(k, []).get(k)).push(r); }
  const oppT = [...bm.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `<tr><td><b>${k === "?" ? "번호 없음" : "#" + k}</b></td><td class="num"><b>${l.length}</b></td>${[1, 2, 3].map(b => `<td class="num">${d(l.filter(r => r.blockers === b).length)}</td>`).join("")}</tr>`).join("");
  const srvT = byP(rs.filter(r => r.kind === "srv")).map(([id, l]) => `<tr><td>${who(id)}</td><td class="num">${l.length}</td><td class="num">${d(l.filter(r => r.res === "ace").length)}</td><td class="num">${d(l.filter(r => r.res === "err").length)}</td></tr>`).join("");
  const setE = byP(rs.filter(r => r.kind === "set")).map(([id, l]) => `<span class="chip">${who(id)} ${l.length}</span>`).join("");
  const rot = [1, 2, 3, 4, 5, 6].map(nr => { const l = pts.filter(r => r.rot === nr), a = l.filter(r => r.serve === "opp"), b = l.filter(r => r.serve === "us"), dd = l.filter(r => r.point === "us").length * 2 - l.length;
    return `<tr><td><b>R${nr}</b></td><td class="num">${a.length ? `${lvPct(a.filter(r => r.point === "us").length, a.length)} <small>${a.filter(r => r.point === "us").length}/${a.length}</small>` : "—"}</td><td class="num">${b.length ? `${lvPct(b.filter(r => r.point === "us").length, b.length)} <small>${b.filter(r => r.point === "us").length}/${b.length}</small>` : "—"}</td><td class="num ${dd > 0 ? "good" : dd < 0 ? "crit" : ""}">${l.length ? (dd > 0 ? "+" : "") + dd : "—"}</td></tr>`; }).join("");
  const tbl = (h, rows) => rows ? `<div class="tw"><table class="lv-t"><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : "";
  return `<div class="lv-kpi"><div><span>사이드아웃</span><b>${lvPct(so.filter(r => r.point === "us").length, so.length)}</b><small>${so.filter(r => r.point === "us").length}/${so.length}</small></div><div><span>브레이크</span><b>${lvPct(br.filter(r => r.point === "us").length, br.length)}</b><small>${br.filter(r => r.point === "us").length}/${br.length}</small></div><div><span>공격 효율</span><b>${lvPct(kill.length - aerr.length, atk.length)}</b><small>${kill.length}/${atk.length}</small></div><div><span>리시브 평균</span><b>${lvAvg(rcv)}</b><small>${rcv.length}개</small></div></div>
    <div class="cols lv-two"><div class="col"><h4>득점 ${pts.filter(r => r.point === "us").length}</h4>${bar(srcUs, "us")}</div><div class="col"><h4>실점 ${pts.filter(r => r.point === "opp").length}</h4>${bar(srcOp, "opp")}</div></div>
    ${rcvT ? `<h4>리시브</h4>${tbl(["선수", "개수", "평균", "3", "2", "1", "0"], rcvT)}` : ""}
    ${atkT ? `<h4>공격</h4>${tbl(["선수", "시도", "득점", "범실", "막힘", "효율", "주 코스"], atkT)}${zmap ? `<h4>득점 코스</h4>${zmap}` : ""}` : ""}
    ${blkT ? `<h4>블로킹 득점</h4>${tbl(["선수", "득점", "1블록", "2블록", "3블록"], blkT)}` : ""}
    ${oppT ? `<h4>막힌 상대 블로커</h4>${tbl(["상대", "막힘", "1블록", "2블록", "3블록"], oppT)}` : ""}
    ${srvT ? `<h4>서브</h4>${tbl(["선수", "서브", "에이스", "범실"], srvT)}` : ""}
    ${setE ? `<h4>토스 범실</h4><div class="sc-row">${setE}</div>` : ""}
    <h4>로테별</h4>${tbl(["로테", "사이드아웃", "브레이크", "득실"], rot)}`;
}
function lvPage(x) {
  const L = lv(), g = lvGame();
  if (!g) { L.open = null; return ""; }
  if (!L.rallies[g.id]) { lvLoadRallies(g.id); return loaderHtml(); }
  const rs = L.rallies[g.id], sets = [1, 2, 3, 4, 5].map(n => ({ n, s: lvState(g, rs, n) })), cur = sets[L.set - 1].s, end = lvEnd(cur, L.set);
  const won = sets.filter(({ n, s }) => lvEnd(s, n) === "us").length, lost = sets.filter(({ n, s }) => lvEnd(s, n) === "opp").length;
  const lastSet = Math.max(1, ...rs.map(r => r.set_no), ...Object.keys(g.sets || {}).map(Number));
  const chips = sets.filter(({ n }) => n <= Math.min(5, lastSet + (lvEnd(sets[lastSet - 1].s, lastSet) ? 1 : 0))).map(({ n, s }) => `<button type="button" class="chip sc-chip ${n === L.set ? "on" : ""}" data-act="lvset" data-v="${n}">${n}세트${s.list.length ? ` <span class="num">${s.us}:${s.op}</span>` : ""}</button>`).join("");
  const me = lvCan(), en = entryOf(x.kind, x.id), st = startersOf(x.kind, x.id);
  const ps = sortedPlayers().filter(p => !p.military && (st.size ? st.has(p.id) || en.has(p.id) : en.size ? en.has(p.id) : true)).sort((a, b) => (st.has(b.id) - st.has(a.id)) || (a.number ?? 999) - (b.number ?? 999));
  const pb = p => `<button type="button" class="lv-p ${st.has(p.id) ? "st" : ""} ${p.pos === "Li" ? "li" : ""}" data-act="lvpick" data-v="${esc(p.id)}"><b>${esc(p.number ?? "–")}</b><span>${esc(p.name)}</span><i>${esc(p.pos === "Li" ? "L" : p.pos || "")}</i></button>`;
  const pad = me && !end ? `<div class="panel lv-pad">
      <div class="lv-pg">${ps.map(pb).join("")}</div>
      <div class="lv-q"><button type="button" class="btn lv-o us" data-act="lvquick" data-v="oer">상대 범실 <small>+1 SNU</small></button><button type="button" class="btn lv-o opp" data-act="lvquick" data-v="opt">상대 득점 <small>+1 상대</small></button></div>
      <div class="row between"><button type="button" class="btn small" data-act="lvundo" ${cur.list.length ? "" : "disabled"}>되돌리기</button>${lvQ.list.length ? `<span class="chip warn">대기 ${lvQ.list.length}</span>` : ""}</div>
    </div>` : "";
  const endBox = end ? `<div class="panel lv-end"><b>${L.set}세트 ${end === "us" ? "SNU" : esc(g.opponent)} 승 · ${cur.us}:${cur.op}</b>${me && L.set < 5 && !(won >= 3 || lost >= 3) ? `<button class="btn primary small" type="button" data-act="lvnext">${L.set + 1}세트 시작</button>` : ""}</div>` : "";
  const scope = L.scope === "all" ? rs : cur.list;
  return `<section class="sec lv-page"><div class="row between"><button class="btn link small" type="button" data-act="lvback">‹ ${esc(x.name)}</button>${me ? `<button class="btn link small" type="button" data-act="lvedit">수정</button>` : ""}</div>
    <div class="jp-head"><h2 class="dyn">${esc(g.label || "경기")} · vs ${esc(g.opponent)}</h2><span class="small muted">세트 ${won} : ${lost}</span></div>
    <div class="sc-row">${chips}</div>
    <div class="panel lv-score"><span class="lv-t1 ${cur.serve === "us" ? "srv" : ""}">SNU <small>R${cur.rot}</small></span><b class="num">${cur.us} : ${cur.op}</b><span class="lv-t2 ${cur.serve === "opp" ? "srv" : ""}">${esc(g.opponent)}</span>
      ${cur.run <= -3 ? `<span class="chip warn lv-run">${-cur.run}연속 실점</span>` : cur.run >= 3 ? `<span class="chip ok lv-run">${cur.run}연속 득점</span>` : ""}</div>
    ${endBox}${pad}
    <section class="sec"><div class="seg fill">${[["set", `${L.set}세트`], ["all", "경기 전체"]].map(([k, l]) => `<button type="button" class="seg-tab ${L.scope === k ? "on solid" : ""}" data-act="lvscope" data-v="${k}">${l}</button>`).join("")}</div>
      ${scope.length ? lvStats(scope) : emptyLine(me ? "선수를 눌러 기록해요." : "아직 기록이 없어요.")}</section>
    ${cur.list.length ? `<section class="sec"><h4>최근 기록</h4><ul class="watch sc-recent">${cur.list.map((r, i) => ({ r, sc: (() => { let u = 0, o = 0; for (const y of cur.list.slice(0, i + 1)) { if (y.point === "us") u++; else if (y.point === "opp") o++; } return `${u}:${o}`; })() })).slice(-6).reverse().map(({ r, sc }) =>
      `<li class="${r._pending ? "ct-pend" : ""}"><span class="num small">${sc}</span><span class="small ct-l">${lvLabel(r)}</span>${r.point ? `<span class="chip ${r.point === "us" ? "ok" : "warn"}">${r.point === "us" ? "SNU" : "상대"}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
  </section>`;
}
async function liveClick(b, act) {
  const L = lv();
  if (act === "lvnew") return lvForm(b.dataset.k, null);
  if (act === "lvopen") { L.open = b.dataset.id; L.set = 1; L.c = null; L.scope = "set"; pushInner();
    const g = lvGame(); if (g && L.rallies[g.id]) L.set = Math.max(1, ...L.rallies[g.id].map(r => r.set_no));
    state.dirty = false; render(); window.scrollTo(0, 0); if (g) lvLoadRallies(g.id).then(() => { const l = L.rallies[g.id] || []; if (l.length) { L.set = Math.max(...l.map(r => r.set_no)); state.dirty = false; render(); } }); return; }
  if (act === "lvback") { if (history.state && history.state.inner) return history.back(); L.open = null; state.dirty = false; render(); return; }
  if (act === "lvedit") { const g = lvGame(); return lvForm(`${g.ref_kind}:${g.ref_id}`, g.id); }
  if (act === "lvdel") { const g = lvGame(); if (!g) return;
    try { ok(await sb.from("live_games").delete().eq("id", g.id)); for (const k in L.games) if (L.games[k]) L.games[k] = L.games[k].filter(x => x.id !== g.id); L.open = null; closeSheet(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render(); }
  if (act === "lvset") { const n = Number(b.dataset.v), g = lvGame(); L.set = n; L.c = null;
    if (!(g.sets || {})[n] && lvCan() && !(L.rallies[g.id] || []).some(r => r.set_no === n)) return lvSetForm(n);
    state.dirty = false; return render(); }
  if (act === "lvnext") return lvSetForm(L.set + 1);
  if (act === "lvpick") return lvOpen(b.dataset.v);
  if (act === "lvquick") { L.c = null; return lvSave(b.dataset.v, null); }
  if (act === "lvact") { const c = L.c; c.act = b.dataset.v; c.res = null; c.blockers = null; c.opp = null;
    if (c.act === "set" || c.act === "err") return lvSave(c.act, "err");
    return lvSheet(); }
  if (act === "lvres") { const c = L.c, v = b.dataset.v;
    if (c.act === "atk" && (v === "kill" || v === "blk")) { c.res = v; return lvSheet(); }
    return lvSave(c.act, v, c.act === "blk" ? { blockers: Number(b.dataset.b) } : null); }
  if (act === "lvzone") return lvSave("atk", "kill", { zone: b.dataset.v ? Number(b.dataset.v) : null });
  if (act === "lvblks") { L.c.blockers = Number(b.dataset.v); const i = document.getElementById("lvOppNo"); if (i && i.value !== "") L.c.opp = Number(i.value); return lvSheet(); }
  if (act === "lvopp") { const v = Number(b.dataset.v); L.c.opp = L.c.opp === v ? null : v; return lvSheet(); }
  if (act === "lvblkok") { const c = L.c, i = document.getElementById("lvOppNo"); if (i && i.value !== "") c.opp = Number(i.value);
    if (c.opp != null && (c.opp < 0 || c.opp > 99)) return toast("번호를 확인해 주세요");
    return lvSave("atk", "blk", { blockers: c.blockers, opp_no: c.opp }); }
  if (act === "lvundo") return lvUndo();
  if (act === "lvscope") { L.scope = b.dataset.v; state.dirty = false; return render(); }
}
