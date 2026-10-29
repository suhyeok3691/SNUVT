/* ---------- 대회 실시간 기록 (버튼판, Tactic 방식) ----------
   팀(SNU · 상대) → 선수 번호(골라도 되고 안 골라도 됨) → 동작 버튼 하나. 동작은 서브 · 리시브 · 공격 · 블로킹 · 수비만.
   컴퓨터: 동작마다 단축키, 숫자 = 선수 번호, Tab = 팀 바꾸기, Backspace = 되돌리기.
   점수 · 서브권 · 우리 로테는 저절로 (같은 랠리를 두 팀에서 같이 눌러도 점수는 한 번: 공격 득점↔수비 실패, 막힘↔블로킹 득점, 에이스↔리시브 0) */
// [동작, 이름, [[결과, 이름, 단축키, 색, 점수(me: 그 팀 · other: 상대 팀)]]]
const LV_BOARD = [
  ["srv", "서브", [["ace", "에이스", "q", "best", "me"], ["err", "범실", "w", "bad", "other"], ["in", "들어감", "e", "ok"]]],
  ["rcv", "리시브", [["3", "3 완벽", "r", "best"], ["2", "2", "t", "good"], ["1", "1", "y", "ok"], ["0", "0 실패", "u", "bad", "other"]]],
  ["atk", "공격", [["kill", "득점", "a", "best", "me"], ["err", "범실", "s", "bad", "other"], ["blk", "막힘", "d", "bad", "other"], ["in", "이어짐", "f", "ok"]]],
  ["blk", "블로킹", [["pt", "득점", "g", "best", "me"], ["touch", "유효", "h", "good"], ["err", "범실", "j", "bad", "other"]]],
  ["dig", "수비", [["ok", "성공", "z", "good"], ["err", "실패", "x", "bad", "other"]]],
  ["err", "파울", [["net", "네트·라인", "c", "bad", "other"]]],
];
// 공격 종류(토스 분배): 공격 전에 골라 두면 그 공격에 붙음 (안 골라도 됨)
const LV_ATYPE = [["w4", "4번 윙", "v"], ["o2", "2번 아포짓", "b"], ["q3", "3번 속공", "n"], ["pipe", "파이프", "m"], ["etc", "기타", ""]];
const LV_AT = Object.fromEntries(LV_ATYPE.map(x => [x[0], x[1]]));
const LV_ATKEY = Object.fromEntries(LV_ATYPE.filter(x => x[2]).map(x => [x[2], x[0]]));
// 코트 구역 (지키는 팀 쪽에서 네트를 보고: 앞 4·3·2 / 가운데 7·8·9 / 뒤 5·6·1, 각 3m)
const LV_ZROWS = [[4, 3, 2], [7, 8, 9], [5, 6, 1]];
const lvZone = (x, y) => LV_ZROWS[Math.min(2, Math.floor(y / 33.34))][Math.min(2, Math.floor(x / 33.34))];
// 타법: 스파이크 · 팁 (공격할 때 고름)
const LV_SHOT = [["spike", "스파이크", "o"], ["tip", "팁", "i"]];
const LV_SH = Object.fromEntries(LV_SHOT.map(x => [x[0], x[1]]));
const LV_SHKEY = Object.fromEntries(LV_SHOT.map(x => [x[2], x[0]]));
const lvShot = r => r.kind === "atk" && r.shot ? LV_SH[r.shot] : "";
const LV_RES = {}; for (const [k, l, rs] of LV_BOARD) for (const r of rs) LV_RES[k + ":" + r[0]] = { kind: k, kname: l, res: r[0], name: r[1], key: r[2], cls: r[3], pt: r[4] || null };
const LV_KEYS = Object.fromEntries(Object.values(LV_RES).map(x => [x.key, x]));
const lvOther = s => s === "us" ? "opp" : "us";
// 두 팀에서 같은 랠리 끝을 같이 눌렀을 때 (점수 한 번만)
const LV_PAIR = [["atk:kill", "dig:err"], ["atk:blk", "blk:pt"], ["srv:ace", "rcv:0"]];
const lvPairOf = (a, b) => LV_PAIR.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const lvWho = r => { if (r.side === "us") { const p = playerOf(r.player_id); return p ? `${pNo(p)}${esc(p.name)}` : "SNU"; } return r.opp_no != null ? `상대 #${r.opp_no}` : "상대"; };
const lvLabel = r => { const x = LV_RES[r.kind + ":" + r.res], sh = lvShot(r);
  return `${lvWho(r)} · ${x ? `${x.kind === "err" ? "" : x.kname + " "}${x.name}` : esc(r.kind || "")}${r.atype ? ` · ${LV_AT[r.atype]}` : ""}${sh ? ` · ${sh}` : ""}${r.zone ? ` → ${r.zone}구역` : ""}`; };
const lv = () => state.live || (state.live = { games: {}, rallies: {}, open: null, set: 1, scope: "set", side: "us", pick: null, atype: null, shot: null, extra: {} });
const lvCan = () => can("analysis") || can("schedule");
const lvGame = () => { const L = lv(); for (const l of Object.values(L.games)) { const g = (l || []).find(x => x.id === L.open); if (g) return g; } return null; };
// 세트 하나 다시 따라가기: 점수 · 서브권 · 우리 로테 · 연속 득실
function lvState(g, rs, setNo) {
  const st = (g.sets || {})[setNo] || {}, s = { rot: st.rot || 1, serve: st.serve || "us", us: 0, op: 0, run: 0, list: [], last: null };
  for (const r of rs) {
    if (r.set_no !== setNo || !r.kind) continue; s.list.push(r);
    r._sit = s.us > s.op ? "lead" : s.us < s.op ? "trail" : "tie"; // 점수 상황 (우리 기준, 이 플레이 전)
    if (r.kind === "srv") s.serve = r.side || "us"; else if (r.kind === "rcv") s.serve = lvOther(r.side || "us");
    if (r.point === "us") { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; s.run = s.run > 0 ? s.run + 1 : 1; s.last = r; }
    else if (r.point === "opp") { s.op++; s.serve = "opp"; s.run = s.run < 0 ? s.run - 1 : -1; s.last = r; }
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
function lvSave(code, extra) {
  const L = lv(), g = lvGame(), x = LV_RES[code]; if (!g || !x) return;
  const rs = L.rallies[g.id] || [], s = lvState(g, rs, L.set), side = L.side, pk = L.pick;
  const serve = x.kind === "srv" ? side : x.kind === "rcv" ? lvOther(side) : s.serve;
  let point = x.pt === "me" ? side : x.pt === "other" ? lvOther(side) : null;
  // 바로 앞 점수 기록이 같은 랠리의 짝이면(상대 팀 쪽에서 같은 끝을 누름) 점수는 한 번만
  const prev = s.list[s.list.length - 1];
  if (point && prev && prev.point === point && prev.side !== side && lvPairOf(prev.kind + ":" + prev.res, code)) point = null;
  const row = { id: "tmp" + Date.now() + Math.random().toString(36).slice(2, 5), game_id: g.id, set_no: L.set, side, rot: s.rot, serve, kind: x.kind, res: x.res,
    player_id: side === "us" && pk ? pk : null, opp_no: side === "opp" && pk != null && pk !== "" ? Number(pk) : null, point, won: point ? point === "us" : null,
    atype: x.kind === "atk" ? L.atype || null : null, shot: x.kind === "atk" ? L.shot || null : null, x: null, y: null, zone: null, ...(extra || {}),
    author: uid(), created_at: new Date().toISOString(), _pending: true };
  (L.rallies[g.id] = rs).push(row); const q = { ...row }; delete q._sit; lvQ.list.push(q); lvQSave();
  L.pick = null; L.atype = null; L.shot = null; L.spot = null; closeSheet(); state.dirty = false; render(); lvFlush();
}
// 코트 그림 (지키는 팀 코트, 네트가 위). dots = [{x,y,c}]
function lvCourt(dots, big) {
  const W = 300, lines = `<rect x="1" y="1" width="${W - 2}" height="${W - 2}" class="lv-c-bd"/><line x1="0" y1="1" x2="${W}" y2="1" class="lv-c-net"/><line x1="0" y1="100" x2="${W}" y2="100" class="lv-c-al"/>
    <line x1="100" y1="0" x2="100" y2="${W}" class="lv-c-g"/><line x1="200" y1="0" x2="200" y2="${W}" class="lv-c-g"/><line x1="0" y1="200" x2="${W}" y2="200" class="lv-c-g"/>`;
  const labs = "";
  const pts = (dots || []).map(d => `<circle cx="${d.x * 3}" cy="${d.y * 3}" r="${big ? 7 : 6}" class="lv-dot ${d.c || ""}"/>`).join("");
  return `<svg class="lv-c ${big ? "big" : ""}" viewBox="0 0 ${W} ${W}" ${big ? 'id="lvCourtTap"' : ""} role="img" aria-label="코트">${lines}${labs}${pts}</svg>`;
}
// 공격 득점 → 종류 · 떨어진 자리 고르기
function lvSpotSheet(code) {
  const L = lv(), g = lvGame(), side = L.side, el = document.getElementById("sheet");
  L.spot = { code };
  const who = side === "us" ? (playerOf(L.pick) ? `${pNo(playerOf(L.pick))}${esc(playerOf(L.pick).name)}` : "SNU") : L.pick != null ? `상대 #${L.pick}` : esc(g.opponent);
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${who} 공격 득점</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="sc-row">${LV_ATYPE.map(([k, l]) => `<button type="button" class="chip sc-chip ${L.atype === k ? "on" : ""}" data-act="lvatype2" data-v="${k}">${l}</button>`).join("")}</div>
    <div class="sc-row">${LV_SHOT.map(([k, l]) => `<button type="button" class="chip sc-chip ${L.shot === k ? "on" : ""}" data-act="lvshot2" data-v="${k}">${l}</button>`).join("")}</div>
    <p class="small muted">${side === "us" ? esc(g.opponent) : "SNU"} 코트 · 떨어진 자리를 누르면 저장</p>
    <div class="lv-cwrap">${lvCourt([], true)}</div>
    <div class="row"><button type="button" class="btn link small" data-act="lvnospot">코스 모름</button></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  const svg = document.getElementById("lvCourtTap");
  svg.addEventListener("click", e => { const r = svg.getBoundingClientRect(), x = Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100))), y = Math.max(0, Math.min(100, Math.round((e.clientY - r.top) / r.height * 100)));
    lvSave(code, { x, y, zone: lvZone(x, y) }); });
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
// 상대 번호: 기록에 나온 번호 + 이번에 더한 번호
const lvOppNos = g => [...new Set([...(lv().rallies[g.id] || []).filter(r => r.opp_no != null).map(r => r.opp_no), ...(lv().extra[g.id] || [])])].sort((a, b) => a - b);
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
// 팀 하나 선수별 표 (서브 · 리시브 · 공격 · 블로킹 · 수비)
function lvTeam(rs, side) {
  const l = rs.filter(r => r.side === side), key = r => side === "us" ? r.player_id || "" : r.opp_no ?? "";
  const ks = [...new Set(l.map(key))].sort((a, b) => (side === "us" ? ((playerOf(a) || {}).number ?? 999) - ((playerOf(b) || {}).number ?? 999) : (a === "" ? 999 : a) - (b === "" ? 999 : b)));
  if (!ks.length) return emptyLine("기록이 없어요.");
  const nm = k => side === "us" ? (playerOf(k) ? `${pNo(playerOf(k))}${esc(playerOf(k).name)}` : "선수 없음") : k === "" ? "번호 없음" : "#" + k;
  const d = v => v || "—";
  const row = k => { const m = l.filter(r => key(r) === k), c = (kd, rr) => m.filter(r => r.kind === kd && (!rr || r.res === rr)).length;
    const at = c("atk"), ak = c("atk", "kill"), ae = c("atk", "err") + c("atk", "blk"), rc = m.filter(r => r.kind === "rcv"), dg = c("dig"), fl = c("err");
    return `<tr><td><b>${nm(k)}</b></td><td class="num">${c("srv") ? `${c("srv", "ace")}/${c("srv", "err")}` : "—"}</td><td class="num">${rc.length ? `${lvAvg(rc)} <small>${rc.length}</small>` : "—"}</td>
      <td class="num">${at ? `${ak}/${at}` : "—"}</td><td class="num">${d(c("atk", "err"))}</td><td class="num">${d(c("atk", "blk"))}</td><td class="num"><b>${at ? lvPct(ak - ae, at) : "—"}</b></td>
      <td class="num">${c("blk") ? `${c("blk", "pt")}/${c("blk", "touch")}` : "—"}</td><td class="num">${dg ? `${c("dig", "ok")}/${dg}` : "—"}</td><td class="num">${d(fl)}</td><td class="num"><b>${d(ak + c("blk", "pt") + c("srv", "ace"))}</b></td></tr>`; };
  return `<div class="tw"><table class="lv-t"><thead><tr><th>선수</th><th>서브 <small>에이스/범실</small></th><th>리시브 <small>평균</small></th><th>공격 <small>득점/시도</small></th><th>범실</th><th>막힘</th><th>효율</th><th>블로킹 <small>득점/유효</small></th><th>수비 <small>성공/시도</small></th><th>파울</th><th>득점</th></tr></thead><tbody>${ks.map(row).join("")}</tbody></table></div>`;
}
// 공격 종류(토스 분배) · 득점 자리 (두 팀)
function lvAtk(rs, g) {
  const team = side => { const a = rs.filter(r => r.side === side && r.kind === "atk"); if (!a.length) return "";
    const tot = a.length, rows = LV_ATYPE.map(([k, l]) => { const l2 = a.filter(r => r.atype === k); if (!l2.length) return ""; const kk = l2.filter(r => r.res === "kill").length, e = l2.filter(r => r.res === "err" || r.res === "blk").length;
      return `<tr><td><b>${l}</b></td><td class="num">${l2.length} <small>${lvPct(l2.length, tot)}</small></td><td class="num">${kk}</td><td class="num">${e}</td><td class="num"><b>${lvPct(kk - e, l2.length)}</b></td></tr>`; }).join("");
    const kills = a.filter(r => r.res === "kill" && r.x != null), zc = {}; for (const r of kills) zc[r.zone] = (zc[r.zone] || 0) + 1;
    const ft = a.filter(r => r.shot === "tip"), ftk = ft.filter(r => r.res === "kill").length;
    return `<div class="col"><h4>${side === "us" ? "SNU" : esc(g.opponent)} 공격</h4>${rows ? `<div class="tw"><table class="lv-t"><thead><tr><th>종류</th><th>시도 <small>분배</small></th><th>득점</th><th>범실·막힘</th><th>효율</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
      ${kills.length ? `<p class="small muted">득점 자리 · ${side === "us" ? esc(g.opponent) : "SNU"} 코트${kills.some(r => r.shot === "tip") ? ` · ○ 팁` : ""}</p><div class="lv-cwrap sm">${lvCourt(kills.map(r => ({ x: r.x, y: r.y, c: (r.atype || "") + (r.shot === "tip" ? " tip" : "") })))}</div>
        <p class="small">${Object.entries(zc).sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z}구역 ${n}`).join(" · ")}</p>` : ""}${ft.length ? `<p class="small">팁 ${ft.length} · 득점 ${ftk}</p>` : ""}</div>`; };
  const u = team("us"), o = team("opp");
  return u || o ? `<div class="cols lv-two">${u}${o}</div><p class="small muted lv-leg">${LV_ATYPE.map(([k, l]) => `<i class="lv-dot-k ${k}"></i>${l}`).join(" ")}</p>` : "";
}
// 점수 상황별 (리드 · 동점 · 추격) — 우리 기준
function lvSit(rs) {
  const rows = [["lead", "리드"], ["tie", "동점"], ["trail", "추격"]].map(([k, l]) => { const l2 = rs.filter(r => r._sit === k), pts = l2.filter(r => r.point), so = pts.filter(r => r.serve === "opp"), br = pts.filter(r => r.serve === "us");
    const a = l2.filter(r => r.side === "us" && r.kind === "atk"), kk = a.filter(r => r.res === "kill").length, e = a.filter(r => r.res === "err" || r.res === "blk").length;
    return pts.length ? `<tr><td><b>${l}</b></td><td class="num">${lvPct(so.filter(r => r.point === "us").length, so.length)} <small>${so.filter(r => r.point === "us").length}/${so.length}</small></td><td class="num">${lvPct(br.filter(r => r.point === "us").length, br.length)} <small>${br.filter(r => r.point === "us").length}/${br.length}</small></td><td class="num">${lvPct(kk - e, a.length)}</td></tr>` : ""; }).join("");
  return rows ? `<h4>점수 상황별 (SNU)</h4><div class="tw"><table class="lv-t"><thead><tr><th>상황</th><th>사이드아웃</th><th>브레이크</th><th>공격 효율</th></tr></thead><tbody>${rows}</tbody></table></div>` : "";
}
// 결과: 이번 세트 / 경기 전체
function lvStats(rs, g) {
  const pts = rs.filter(r => r.point), so = pts.filter(r => r.serve === "opp"), br = pts.filter(r => r.serve === "us");
  const eff = side => { const a = rs.filter(r => r.side === side && r.kind === "atk"), k = a.filter(r => r.res === "kill").length, e = a.filter(r => r.res === "err" || r.res === "blk").length; return [lvPct(k - e, a.length), `${k}/${a.length}`]; };
  const rcv = side => rs.filter(r => r.side === side && r.kind === "rcv");
  const [ue, ul] = eff("us"), [oe, ol] = eff("opp");
  const src = winner => { const l = pts.filter(r => r.point === winner), m = {};
    for (const r of l) { const x = LV_RES[r.kind + ":" + r.res], nm = r.side === winner ? `${x.kname} ${x.name}` : `상대 ${x.kname} ${x.name}`; m[nm] = (m[nm] || 0) + 1; }
    const tot = l.length; return `<div class="lv-bars">${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="lv-bar ${winner}"><span>${esc(k)}</span><i style="--w:${tot ? Math.round(100 * v / tot) : 0}%"></i><b class="num">${v}</b></div>`).join("") || `<span class="small muted">—</span>`}</div>`; };
  const rot = [1, 2, 3, 4, 5, 6].map(nr => { const l = pts.filter(r => r.rot === nr), a = l.filter(r => r.serve === "opp"), b = l.filter(r => r.serve === "us"), dd = l.filter(r => r.point === "us").length * 2 - l.length;
    return `<tr><td><b>R${nr}</b></td><td class="num">${a.length ? `${lvPct(a.filter(r => r.point === "us").length, a.length)} <small>${a.filter(r => r.point === "us").length}/${a.length}</small>` : "—"}</td><td class="num">${b.length ? `${lvPct(b.filter(r => r.point === "us").length, b.length)} <small>${b.filter(r => r.point === "us").length}/${b.length}</small>` : "—"}</td><td class="num ${dd > 0 ? "good" : dd < 0 ? "crit" : ""}">${l.length ? (dd > 0 ? "+" : "") + dd : "—"}</td></tr>`; }).join("");
  return `<div class="lv-kpi"><div><span>사이드아웃</span><b>${lvPct(so.filter(r => r.point === "us").length, so.length)}</b><small>${so.filter(r => r.point === "us").length}/${so.length}</small></div><div><span>브레이크</span><b>${lvPct(br.filter(r => r.point === "us").length, br.length)}</b><small>${br.filter(r => r.point === "us").length}/${br.length}</small></div><div><span>공격 효율</span><b>${ue}</b><small>SNU ${ul} · 상대 ${oe}</small></div><div><span>리시브 평균</span><b>${lvAvg(rcv("us"))}</b><small>상대 ${lvAvg(rcv("opp"))}</small></div></div>
    <div class="cols lv-two"><div class="col"><h4>SNU 득점 ${pts.filter(r => r.point === "us").length}</h4>${src("us")}</div><div class="col"><h4>${esc(g.opponent)} 득점 ${pts.filter(r => r.point === "opp").length}</h4>${src("opp")}</div></div>
    <h4>SNU</h4>${lvTeam(rs, "us")}<h4>${esc(g.opponent)}</h4>${lvTeam(rs, "opp")}
    ${lvAtk(rs, g)}
    ${lvSit(rs)}
    <h4>로테별 (SNU)</h4><div class="tw"><table class="lv-t"><thead><tr><th>로테</th><th>사이드아웃</th><th>브레이크</th><th>득실</th></tr></thead><tbody>${rot}</tbody></table></div>`;
}
function lvPage(x) {
  const L = lv(), g = lvGame();
  if (!g) { L.open = null; return ""; }
  if (!L.rallies[g.id]) { lvLoadRallies(g.id); return loaderHtml(); }
  const rs = L.rallies[g.id], sets = [1, 2, 3, 4, 5].map(n => ({ n, s: lvState(g, rs, n) })), cur = sets[L.set - 1].s, end = lvEnd(cur, L.set);
  const won = sets.filter(({ n, s }) => lvEnd(s, n) === "us").length, lost = sets.filter(({ n, s }) => lvEnd(s, n) === "opp").length;
  const lastSet = Math.max(1, ...rs.map(r => r.set_no), ...Object.keys(g.sets || {}).map(Number).filter(n => n >= 1 && n <= 5));
  const chips = sets.filter(({ n }) => n <= Math.min(5, lastSet + (lvEnd(sets[lastSet - 1].s, lastSet) ? 1 : 0))).map(({ n, s }) => `<button type="button" class="chip sc-chip ${n === L.set ? "on" : ""}" data-act="lvset" data-v="${n}">${n}세트${s.list.length ? ` <span class="num">${s.us}:${s.op}</span>` : ""}</button>`).join("");
  const me = lvCan(), en = entryOf(x.kind, x.id), st = startersOf(x.kind, x.id), kb = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const ps = sortedPlayers().filter(p => !p.military && (st.size ? st.has(p.id) || en.has(p.id) : en.size ? en.has(p.id) : true)).sort((a, b) => (st.has(b.id) - st.has(a.id)) || (a.number ?? 999) - (b.number ?? 999));
  const side = L.side;
  const players = side === "us"
    ? ps.map(p => `<button type="button" class="lv-n us ${L.pick === p.id ? "on" : ""} ${st.has(p.id) ? "" : "sub"}" data-act="lvpick" data-v="${esc(p.id)}"><b>${esc(p.number ?? "–")}</b><span>${esc(p.name)}</span></button>`).join("")
    : lvOppNos(g).map(n => `<button type="button" class="lv-n opp ${String(L.pick) === String(n) ? "on" : ""}" data-act="lvpick" data-v="${n}"><b>${n}</b></button>`).join("") + `<span class="lv-add"><input id="lvAddNo" type="number" inputmode="numeric" min="0" max="99" placeholder="번호"><button type="button" class="btn small" data-act="lvaddno">추가</button></span>`;
  const shRow = `<div class="lv-row"><span class="lv-rk">타법</span><div class="lv-rb lv-at">${LV_SHOT.map(([k, l, key]) => `<button type="button" class="chip sc-chip ${L.shot === k ? "on" : ""}" data-act="lvshot" data-v="${k}">${l}${kb ? `<kbd>${key}</kbd>` : ""}</button>`).join("")}</div></div>`;
  const atRow = `<div class="lv-row"><span class="lv-rk">토스</span><div class="lv-rb lv-at">${LV_ATYPE.filter(x => x[2]).map(([k, l, key]) => `<button type="button" class="chip sc-chip ${L.atype === k ? "on" : ""}" data-act="lvatype" data-v="${k}">${l}${kb ? `<kbd>${key}</kbd>` : ""}</button>`).join("")}</div></div>`;
  const board = atRow + shRow + LV_BOARD.map(([k, l, rs2]) => `<div class="lv-row"><span class="lv-rk">${l}</span><div class="lv-rb">${rs2.map(r => `<button type="button" class="btn lv-b ${r[3]}" data-act="lvcode" data-v="${k}:${r[0]}">${esc(r[1])}${kb ? `<kbd>${r[2]}</kbd>` : ""}</button>`).join("")}</div></div>`).join("");
  const pad = me && !end ? `<div class="panel lv-pad ${side}">
      <div class="seg fill lv-side">${[["us", "SNU"], ["opp", esc(g.opponent)]].map(([v, l]) => `<button type="button" class="seg-tab ${side === v ? "on solid" : ""}" data-act="lvside" data-v="${v}">${l}${kb ? ` <kbd>Tab</kbd>` : ""}</button>`).join("")}</div>
      <div class="lv-ns">${players || `<span class="small muted">선수 없음</span>`}</div>
      ${board}
      <div class="row between"><button type="button" class="btn small" data-act="lvundo" ${cur.list.length ? "" : "disabled"}>되돌리기${kb ? " <kbd>⌫</kbd>" : ""}</button>${lvQ.list.length ? `<span class="chip warn">대기 ${lvQ.list.length}</span>` : ""}</div>
    </div>` : "";
  const endBox = end ? `<div class="panel lv-end"><b>${L.set}세트 ${end === "us" ? "SNU" : esc(g.opponent)} 승 · ${cur.us}:${cur.op}</b>${me && L.set < 5 && !(won >= 3 || lost >= 3) ? `<button class="btn primary small" type="button" data-act="lvnext">${L.set + 1}세트 시작</button>` : ""}</div>` : "";
  const scope = L.scope === "all" ? rs.filter(r => r.kind) : cur.list;
  return `<section class="sec lv-page"><div class="row between"><button class="btn link small" type="button" data-act="lvback">‹ ${esc(x.name)}</button>${me ? `<button class="btn link small" type="button" data-act="lvedit">수정</button>` : ""}</div>
    <div class="jp-head"><h2 class="dyn">${esc(g.label || "경기")} · vs ${esc(g.opponent)}</h2><span class="small muted">세트 ${won} : ${lost}</span></div>
    <div class="sc-row">${chips}</div>
    <div class="panel lv-score"><span class="lv-t1 ${cur.serve === "us" ? "srv" : ""}">SNU <small>R${cur.rot}</small></span><b class="num">${cur.us} : ${cur.op}</b><span class="lv-t2 ${cur.serve === "opp" ? "srv" : ""}">${esc(g.opponent)}</span>
      ${cur.run <= -3 ? `<span class="chip warn lv-run">${-cur.run}연속 실점</span>` : cur.run >= 3 ? `<span class="chip ok lv-run">${cur.run}연속 득점</span>` : ""}</div>
    ${endBox}${pad}
    ${cur.list.length ? `<section class="sec"><h4>최근 기록</h4><ul class="watch sc-recent">${cur.list.map((r, i) => ({ r, sc: (() => { let u = 0, o = 0; for (const y of cur.list.slice(0, i + 1)) { if (y.point === "us") u++; else if (y.point === "opp") o++; } return `${u}:${o}`; })() })).slice(-5).reverse().map(({ r, sc }) =>
      `<li class="${r._pending ? "ct-pend" : ""}"><span class="num small">${sc}</span><span class="small ct-l">${lvLabel(r)}</span>${r.point ? `<span class="chip ${r.point === "us" ? "ok" : "warn"}">${r.point === "us" ? "SNU" : "상대"}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
    <section class="sec"><div class="seg fill">${[["set", `${L.set}세트`], ["all", "경기 전체"]].map(([k, l]) => `<button type="button" class="seg-tab ${L.scope === k ? "on solid" : ""}" data-act="lvscope" data-v="${k}">${l}</button>`).join("")}</div>
      ${scope.length ? lvStats(scope, g) : emptyLine(me ? "팀 · 선수를 고르고 동작 버튼을 눌러요." : "아직 기록이 없어요.")}</section>
  </section>`;
}
async function liveClick(b, act) {
  const L = lv();
  if (act === "lvnew") return lvForm(b.dataset.k, null);
  if (act === "lvopen") { L.open = b.dataset.id; L.set = 1; L.pick = null; L.side = "us"; L.scope = "set"; pushInner();
    const g = lvGame(); state.dirty = false; render(); window.scrollTo(0, 0);
    if (g) lvLoadRallies(g.id).then(() => { const l = (L.rallies[g.id] || []).filter(r => r.kind); if (l.length) { L.set = Math.max(...l.map(r => r.set_no)); state.dirty = false; render(); } }); return; }
  if (act === "lvback") { if (history.state && history.state.inner) return history.back(); L.open = null; state.dirty = false; render(); return; }
  if (act === "lvedit") { const g = lvGame(); return lvForm(`${g.ref_kind}:${g.ref_id}`, g.id); }
  if (act === "lvdel") { const g = lvGame(); if (!g) return;
    try { ok(await sb.from("live_games").delete().eq("id", g.id)); for (const k in L.games) if (L.games[k]) L.games[k] = L.games[k].filter(x => x.id !== g.id); L.open = null; closeSheet(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render(); }
  if (act === "lvset") { const n = Number(b.dataset.v), g = lvGame(); L.set = n; L.pick = null;
    if (!(g.sets || {})[n] && lvCan() && !(L.rallies[g.id] || []).some(r => r.set_no === n && r.kind)) return lvSetForm(n);
    state.dirty = false; return render(); }
  if (act === "lvnext") return lvSetForm(L.set + 1);
  if (act === "lvside") { L.side = b.dataset.v; L.pick = null; state.dirty = false; return render(); }
  if (act === "lvpick") { const v = L.side === "us" ? b.dataset.v : Number(b.dataset.v); L.pick = String(L.pick) === String(v) ? null : v; state.dirty = false; return render(); }
  if (act === "lvaddno") { const i = document.getElementById("lvAddNo"), n = Number(i && i.value); if (!i || i.value === "" || n < 0 || n > 99) return toast("번호를 넣어 주세요");
    const g = lvGame(); (L.extra[g.id] = L.extra[g.id] || []).push(n); L.pick = n; state.dirty = false; return render(); }
  if (act === "lvcode") return b.dataset.v === "atk:kill" ? lvSpotSheet("atk:kill") : lvSave(b.dataset.v);
  if (act === "lvshot") { L.shot = L.shot === b.dataset.v ? null : b.dataset.v; state.dirty = false; return render(); }
  if (act === "lvshot2") { L.shot = L.shot === b.dataset.v ? null : b.dataset.v; document.querySelectorAll('[data-act="lvshot2"]').forEach(x => x.classList.toggle("on", x.dataset.v === L.shot)); return; }
  if (act === "lvatype") { L.atype = L.atype === b.dataset.v ? null : b.dataset.v; state.dirty = false; return render(); }
  if (act === "lvatype2") { L.atype = L.atype === b.dataset.v ? null : b.dataset.v; document.querySelectorAll('[data-act="lvatype2"]').forEach(x => x.classList.toggle("on", x.dataset.v === L.atype)); return; }
  if (act === "lvnospot") return lvSave(L.spot ? L.spot.code : "atk:kill");
  if (act === "lvundo") return lvUndo();
  if (act === "lvscope") { L.scope = b.dataset.v; state.dirty = false; return render(); }
}
// 컴퓨터 단축키: 동작 글자 · 숫자 = 선수 번호(이어서 치면 두 자리) · Tab = 팀 · Backspace = 되돌리기
let lvNum = { s: "", t: 0 };
document.addEventListener("keydown", ev => {
  const L = state.live; if (!L || !L.open || !(state.view === "cup" || state.view === "fr") || !lvCan() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  const sh = document.getElementById("sheet"), k = ev.key.toLowerCase();
  if (sh && !sh.hidden) { // 득점 자리 창: 숫자 1~9 = 그 구역 가운데, 0 = 코스 모름
    if (L.spot && /^[0-9]$/.test(k)) { ev.preventDefault(); if (k === "0") return lvSave(L.spot.code); const z = Number(k), ri = LV_ZROWS.findIndex(r => r.includes(z)), ci = LV_ZROWS[ri].indexOf(z); return lvSave(L.spot.code, { x: ci * 33 + 17, y: ri * 33 + 17, zone: z }); }
    if (L.spot && LV_SHKEY[k]) { ev.preventDefault(); L.shot = LV_SHKEY[k]; document.querySelectorAll('[data-act="lvshot2"]').forEach(x => x.classList.toggle("on", x.dataset.v === L.shot)); return; }
    if (L.spot && LV_ATKEY[k]) { ev.preventDefault(); L.atype = LV_ATKEY[k]; document.querySelectorAll('[data-act="lvatype2"]').forEach(x => x.classList.toggle("on", x.dataset.v === L.atype)); }
    return; }
  const g = lvGame(); if (!g || !L.rallies[g.id]) return;
  if (k === "tab") { ev.preventDefault(); L.side = lvOther(L.side); L.pick = null; state.dirty = false; return render(); }
  if (k === "backspace") { ev.preventDefault(); return lvUndo(); }
  if (/^[0-9]$/.test(k)) { ev.preventDefault(); const now = Date.now(); lvNum.s = now - lvNum.t < 900 && lvNum.s.length < 2 ? lvNum.s + k : k; lvNum.t = now; const n = Number(lvNum.s);
    if (L.side === "us") { const p = sortedPlayers().find(x => x.number === n); if (p) L.pick = p.id; }
    else { if (!lvOppNos(g).includes(n)) (L.extra[g.id] = L.extra[g.id] || []).push(n); L.pick = n; }
    state.dirty = false; return render(); }
  if (LV_SHKEY[k]) { ev.preventDefault(); L.shot = L.shot === LV_SHKEY[k] ? null : LV_SHKEY[k]; state.dirty = false; return render(); }
  if (LV_ATKEY[k]) { ev.preventDefault(); L.atype = L.atype === LV_ATKEY[k] ? null : LV_ATKEY[k]; state.dirty = false; return render(); }
  const x = LV_KEYS[k]; if (x) { ev.preventDefault(); const c = x.kind + ":" + x.res; return c === "atk:kill" ? lvSpotSheet(c) : lvSave(c); }
});
