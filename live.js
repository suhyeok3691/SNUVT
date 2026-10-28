/* ---------- 대회 실시간 기록 ----------
   경기를 보면서 랠리 결과만 빠르게: 누가 땄는지 + 어떻게(공격·블로킹·서브·범실) + (선수 · 리시브 A/B/C는 골라도 되고 안 골라도 됨)
   점수 · 서브권 · 우리 로테는 저절로. 결과(사이드아웃 · 브레이크 · 득실 구성 · 로테별 · 리시브별 · 선수별)는 바로 아래에 */
const LV_HOW = {
  atk: ["공격", "us"], blk: ["블로킹", "us"], ace: ["서브 에이스", "us"], oerr: ["상대 범실", "us"],
  oatk: ["상대 공격", "opp"], oblk: ["상대 블로킹", "opp"], oace: ["상대 서브", "opp"], serr: ["서브 범실", "opp"], err: ["우리 범실", "opp"],
};
const LV_US = ["atk", "blk", "ace", "oerr"], LV_OPP = ["oatk", "oblk", "oace", "serr", "err"];
const LV_PLAYER = ["atk", "blk", "ace", "oblk", "serr", "err"]; // 선수를 붙일 수 있는 것
const lv = () => state.live || (state.live = { games: {}, rallies: {}, open: null, set: 1, pid: null, pass: null, scope: "set" });
const lvCan = () => can("analysis") || can("schedule");
const lvGame = () => { const L = lv(); for (const l of Object.values(L.games)) { const g = (l || []).find(x => x.id === L.open); if (g) return g; } return null; };
// 세트 하나 다시 따라가기: 점수 · 서브권 · 우리 로테 · 연속 실점
function lvState(g, rs, setNo) {
  const st = (g.sets || {})[setNo] || {}, s = { rot: st.rot || 1, serve: st.serve || "us", us: 0, op: 0, run: 0, list: [] };
  for (const r of rs) {
    if (r.set_no !== setNo) continue; s.list.push(r);
    if (r.won) { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; s.run = s.run > 0 ? s.run + 1 : 1; }
    else { s.op++; s.serve = "opp"; s.run = s.run < 0 ? s.run - 1 : -1; }
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
function lvSave(how) {
  const L = lv(), g = lvGame(); if (!g) return;
  const rs = L.rallies[g.id] || [], s = lvState(g, rs, L.set), won = LV_HOW[how][1] === "us";
  const row = { id: "tmp" + Date.now() + Math.random().toString(36).slice(2, 5), game_id: g.id, set_no: L.set, rot: s.rot, serve: s.serve, won, how,
    player_id: LV_PLAYER.includes(how) ? L.pid : null, pass: s.serve === "opp" ? L.pass : null, author: uid(), created_at: new Date().toISOString(), _pending: true };
  (L.rallies[g.id] = rs).push(row); lvQ.list.push({ ...row }); lvQSave();
  L.pid = null; L.pass = null; state.dirty = false; render(); lvFlush();
}
async function lvUndo() {
  const L = lv(), g = lvGame(); if (!g) return;
  const l = (L.rallies[g.id] || []).filter(r => r.set_no === L.set), r = l[l.length - 1]; if (!r) return;
  if (!await confirmDel(`마지막 랠리를 지울까요?\n${r.won ? "SNU" : "상대"} 득점 · ${(LV_HOW[r.how] || [""])[0]}`)) return;
  const qi = lvQ.list.findIndex(x => x.id === r.id);
  if (qi >= 0) { if (qi === 0 && lvQ.busy) { toast("저장 중이에요. 잠깐 뒤에 다시 눌러 주세요"); return; } lvQ.list.splice(qi, 1); lvQSave(); }
  else { try { ok(await sb.from("live_rallies").delete().eq("id", r.id)); } catch (e) { toast(failMsg(e)); return; } }
  L.rallies[g.id] = L.rallies[g.id].filter(x => x !== r); state.dirty = false; render();
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
// 결과: 이번 세트 / 경기 전체
function lvStats(rs) {
  const so = rs.filter(r => r.serve === "opp"), br = rs.filter(r => r.serve === "us"), cnt = h => rs.filter(r => r.how === h).length;
  const bar = (keys, side) => { const tot = keys.reduce((a, k) => a + cnt(k), 0);
    return `<div class="lv-bars">${keys.map(k => { const n = cnt(k); return `<div class="lv-bar ${side}"><span>${LV_HOW[k][0]}</span><i style="--w:${tot ? Math.round(100 * n / tot) : 0}%"></i><b class="num">${n}</b></div>`; }).join("")}</div>`; };
  const pass = ["A", "B", "C"].map(p => { const l = so.filter(r => r.pass === p); return `<td class="num">${l.length ? `${l.length} · ${lvPct(l.filter(r => r.won).length, l.length)}` : "—"}</td>`; }).join("");
  const passN = so.filter(r => r.pass).length;
  const rot = [1, 2, 3, 4, 5, 6].map(n => { const l = rs.filter(r => r.rot === n), a = l.filter(r => r.serve === "opp"), b = l.filter(r => r.serve === "us"), d = l.filter(r => r.won).length * 2 - l.length;
    return `<tr><td><b>R${n}</b></td><td class="num">${a.length ? `${lvPct(a.filter(r => r.won).length, a.length)} <small>${a.filter(r => r.won).length}/${a.length}</small>` : "—"}</td><td class="num">${b.length ? `${lvPct(b.filter(r => r.won).length, b.length)} <small>${b.filter(r => r.won).length}/${b.length}</small>` : "—"}</td><td class="num ${d > 0 ? "good" : d < 0 ? "crit" : ""}">${l.length ? (d > 0 ? "+" : "") + d : "—"}</td></tr>`; }).join("");
  const pids = [...new Set(rs.filter(r => r.player_id).map(r => r.player_id))];
  const prow = pids.map(id => playerOf(id)).filter(Boolean).sort((a, b) => (a.number ?? 999) - (b.number ?? 999)).map(p => { const l = rs.filter(r => r.player_id === p.id), c = h => l.filter(r => r.how === h).length;
    return `<tr><td><b>${pNo(p)}${esc(p.name)}</b></td><td class="num">${c("atk") || "—"}</td><td class="num">${c("blk") || "—"}</td><td class="num">${c("ace") || "—"}</td><td class="num">${c("oblk") || "—"}</td><td class="num">${c("serr") || "—"}</td><td class="num">${c("err") || "—"}</td><td class="num"><b>${c("atk") + c("blk") + c("ace") || "—"}</b></td></tr>`; }).join("");
  return `<div class="lv-kpi"><div><span>사이드아웃</span><b>${lvPct(so.filter(r => r.won).length, so.length)}</b><small>${so.filter(r => r.won).length}/${so.length}</small></div><div><span>브레이크</span><b>${lvPct(br.filter(r => r.won).length, br.length)}</b><small>${br.filter(r => r.won).length}/${br.length}</small></div><div><span>서브 에이스 · 범실</span><b>${cnt("ace")} · ${cnt("serr")}</b></div><div><span>우리 범실</span><b>${cnt("serr") + cnt("err")}</b><small>상대 ${cnt("oerr")}</small></div></div>
    <div class="cols lv-two"><div class="col"><h4>득점 ${rs.filter(r => r.won).length}</h4>${bar(LV_US, "us")}</div><div class="col"><h4>실점 ${rs.filter(r => !r.won).length}</h4>${bar(LV_OPP, "opp")}</div></div>
    ${passN ? `<h4>리시브 (사이드아웃 %)</h4><div class="tw"><table class="lv-t"><thead><tr><th></th><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td>${passN}개</td>${pass}</tr></tbody></table></div>` : ""}
    <h4>로테별</h4><div class="tw"><table class="lv-t"><thead><tr><th>로테</th><th>사이드아웃</th><th>브레이크</th><th>득실</th></tr></thead><tbody>${rot}</tbody></table></div>
    ${prow ? `<h4>선수별</h4><div class="tw"><table class="lv-t"><thead><tr><th>선수</th><th>공격</th><th>블로킹</th><th>에이스</th><th>막힘</th><th>서브 범실</th><th>범실</th><th>득점</th></tr></thead><tbody>${prow}</tbody></table></div>` : ""}`;
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
  const btn = k => `<button type="button" class="btn lv-h ${LV_HOW[k][1]}" data-act="lvhow" data-h="${k}">${LV_HOW[k][0]}</button>`;
  const pad = me && !end ? `<div class="panel lv-pad">
      ${cur.serve === "opp" ? `<div class="sc-row"><span class="sc-k">리시브</span>${["A", "B", "C"].map(p => `<button type="button" class="chip sc-chip ${L.pass === p ? "on" : ""}" data-act="lvpass" data-v="${p}">${p}</button>`).join("")}</div>` : ""}
      <div class="lv-ps">${ps.map(p => `<button type="button" class="chip sc-chip ${L.pid === p.id ? "on" : ""}" data-act="lvpid" data-v="${esc(p.id)}">${pNo(p)}${esc(p.name)}</button>`).join("")}</div>
      <div class="lv-grid"><div><p class="lv-k us">SNU 득점</p>${LV_US.map(btn).join("")}</div><div><p class="lv-k opp">상대 득점</p>${LV_OPP.map(btn).join("")}</div></div>
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
      ${scope.length ? lvStats(scope) : emptyLine(me ? "랠리가 끝날 때마다 위 버튼을 눌러요." : "아직 기록이 없어요.")}</section>
    ${cur.list.length ? `<section class="sec"><h4>최근 랠리</h4><ul class="watch sc-recent">${cur.list.slice(-5).reverse().map((r, i, a) => { const k = cur.list.length - i, sc = (() => { let u = 0, o = 0; for (const y of cur.list.slice(0, k)) y.won ? u++ : o++; return `${u}:${o}`; })(); const p = playerOf(r.player_id);
      return `<li class="${r._pending ? "ct-pend" : ""}"><span class="num small">${sc}</span><span class="small ct-l">${LV_HOW[r.how] ? LV_HOW[r.how][0] : ""}${p ? ` · ${pNo(p)}${esc(p.name)}` : ""}${r.pass ? ` · 리시브 ${r.pass}` : ""}</span><span class="chip ${r.won ? "ok" : "warn"}">${r.won ? "SNU" : "상대"}</span></li>`; }).join("")}</ul></section>` : ""}
  </section>`;
}
async function liveClick(b, act) {
  const L = lv();
  if (act === "lvnew") return lvForm(b.dataset.k, null);
  if (act === "lvopen") { L.open = b.dataset.id; L.set = 1; L.pid = null; L.pass = null; L.scope = "set"; pushInner();
    const g = lvGame(); if (g && L.rallies[g.id]) L.set = Math.max(1, ...L.rallies[g.id].map(r => r.set_no));
    state.dirty = false; render(); window.scrollTo(0, 0); if (g) lvLoadRallies(g.id).then(() => { const l = L.rallies[g.id] || []; if (l.length) { L.set = Math.max(...l.map(r => r.set_no)); state.dirty = false; render(); } }); return; }
  if (act === "lvback") { if (history.state && history.state.inner) return history.back(); L.open = null; state.dirty = false; render(); return; }
  if (act === "lvedit") { const g = lvGame(); return lvForm(`${g.ref_kind}:${g.ref_id}`, g.id); }
  if (act === "lvdel") { const g = lvGame(); if (!g) return;
    try { ok(await sb.from("live_games").delete().eq("id", g.id)); for (const k in L.games) if (L.games[k]) L.games[k] = L.games[k].filter(x => x.id !== g.id); L.open = null; closeSheet(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render(); }
  if (act === "lvset") { const n = Number(b.dataset.v), g = lvGame(); L.set = n; L.pid = null; L.pass = null;
    if (!(g.sets || {})[n] && lvCan() && !(L.rallies[g.id] || []).some(r => r.set_no === n)) return lvSetForm(n);
    state.dirty = false; return render(); }
  if (act === "lvnext") return lvSetForm(L.set + 1);
  if (act === "lvpid") { L.pid = L.pid === b.dataset.v ? null : b.dataset.v; state.dirty = false; return render(); }
  if (act === "lvpass") { L.pass = L.pass === b.dataset.v ? null : b.dataset.v; state.dirty = false; return render(); }
  if (act === "lvhow") return lvSave(b.dataset.h);
  if (act === "lvundo") return lvUndo();
  if (act === "lvscope") { L.scope = b.dataset.v; state.dirty = false; return render(); }
}
