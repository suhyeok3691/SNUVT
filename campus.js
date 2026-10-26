/* ---------- 교내 대회 (1학기 총장배 · 2학기 종합체육대회) ----------
   남녀 배구부가 함께 운영: 대회 주에는 정규 훈련 대신 대회 · 날마다 올 수 있는 사람 투표(남녀 합침) → 심판 배정
   표: cups · cup_teams · cup_matches · cup_avail (팀 구분 없음, 쓰기는 일정 담당·관리자 / 가능 투표는 본인) */
const CUP_KIND = { pres: "총장배", gen: "종합체육대회" };
const CUP_SHORT = { pres: "총장배", gen: "종체" };
const REF_ROLES = [["ju", "주심"], ["bu", "부심"], ["s1", "선심"], ["s2", "선심"], ["rec", "기록심"]];
const STAGE_KO = { group: "예선", r6: "6강", qf: "8강", sf: "4강", "3rd": "3·4위전", f: "결승", etc: "기타" };
const BRACKET = ["r6", "qf", "sf", "f"];
const CAFE_URL = "https://cafe.naver.com/f-e/cafes/30687222/menus/0";
const cupOn = d => (state.cups || []).find(c => d >= c.start && d <= c.end) || null;
const cupDays = c => { const out = []; for (let d = c.start; d <= c.end; d = dAdd(d, 1)) out.push(d); return out; };
const cupWeekName = c => `${CUP_KIND[c.kind] || c.name} 주`;
const cupById = id => (state.cups || []).find(c => c.id === id) || null;
const cmpMe = () => { const p = playerOf(state.myPid); return p ? p.name : ""; };
const availOf = (c, d) => ((state.cupAvail || {})[c.id] || {})[d] || {};
const cmpTeam = (c, id) => c.teams.find(t => t.id === id) || null;
// 자리 이름으로 팀 찾기: "A1위"(조 경기가 다 끝나면) · "6강 1경기 승자/패자"(그 경기가 끝나면)
function sideId(c, m, s, depth = 0) {
  if (m[s]) return m[s];
  const lab = m[s + "l"] || ""; if (depth > 6 || !lab) return null;
  const g = /^([A-Za-z])조?\s*([1-9])위$/.exec(lab);
  if (g) { const gs = groupStand(c), k = g[1].toUpperCase(); return gs.done[k] ? gs.order[k][Number(g[2]) - 1] || null : null; }
  const w = /^(.+?)\s*(승자|패자)$/.exec(lab);
  if (w) { const src = c.matches.find(x => x.label === w[1] && x !== m); if (!src) return null; const win = winnerOf(c, src, depth + 1); if (!win) return null; if (w[2] === "승자") return win; const a = sideId(c, src, "a", depth + 1), b = sideId(c, src, "b", depth + 1); return win === a ? b : a; }
  return null;
}
const cmpSide = (c, m, s) => { const id = sideId(c, m, s), t = id && cmpTeam(c, id); return t ? t.name : m[s + "l"] || "미정"; };
const hm = s => s ? String(s).slice(0, 5) : "";
const cmpSets = m => { const x = /(\d+)\s*[-:]\s*(\d+)/.exec(m.score || ""); return x ? [Number(x[1]), Number(x[2])] : null; };
function winnerOf(c, m, depth = 0) {
  if (m.winner) return m.winner;
  const s = cmpSets(m); if (!s || s[0] === s[1]) return null;
  return sideId(c, m, s[0] > s[1] ? "a" : "b", depth);
}
// 조별 순위: 승 → 세트 득실 → 조 안 순서. 조 경기가 모두 끝났는지도
function groupStand(c) {
  const st = {}, order = {}, done = {};
  for (const t of c.teams) st[t.id] = { w: 0, l: 0, sw: 0, sl: 0, n: 0 };
  for (const m of c.matches) if (m.stage === "group" && m.a && m.b && st[m.a] && st[m.b]) {
    const s = cmpSets(m), w = m.winner || (s && s[0] !== s[1] ? (s[0] > s[1] ? m.a : m.b) : null);
    const g = (cmpTeam(c, m.a) || {}).grp || "-"; if (done[g] === undefined) done[g] = true;
    if (!s && !w) { done[g] = false; continue; }
    st[m.a].n++; st[m.b].n++;
    if (s) { st[m.a].sw += s[0]; st[m.a].sl += s[1]; st[m.b].sw += s[1]; st[m.b].sl += s[0]; }
    if (w) { st[w].w++; st[w === m.a ? m.b : m.a].l++; }
  }
  for (const t of c.teams) { const g = (t.grp || "-").toUpperCase(); (order[g] = order[g] || []).push(t); }
  for (const g in order) order[g] = order[g].sort((a, b) => (a.withdrawn - b.withdrawn) || (st[b.id].w - st[a.id].w) || ((st[b.id].sw - st[b.id].sl) - (st[a.id].sw - st[a.id].sl)) || a.sort - b.sort).filter(t => !t.withdrawn).map(t => t.id);
  return { st, order, done };
}
// 내가 맡은 심판 (이름으로 맞춤)
function myRefs(c) {
  const me = cmpMe(); if (!me) return [];
  const out = [];
  for (const m of c.matches) for (const [k, l] of REF_ROLES) if ((m.refs || {})[k] === me) out.push({ m, role: l });
  return out;
}
// 사람마다 이번 대회에서 맡은 횟수 (배정 고르게)
function refCounts(c) {
  const n = {};
  for (const m of c.matches) for (const [k] of REF_ROLES) { const v = (m.refs || {})[k]; if (v) n[v] = (n[v] || 0) + 1; }
  return n;
}
function buildCups(raw) {
  const T = {}, M = {};
  for (const r of raw.cup_teams || []) (T[r.cup_id] = T[r.cup_id] || []).push({ id: r.id, name: r.name, grp: r.grp || "", sort: r.sort ?? 9, withdrawn: !!r.withdrawn });
  for (const r of raw.cup_matches || []) (M[r.cup_id] = M[r.cup_id] || []).push({ id: r.id, date: r.date, start: hm(r.start_time), end: hm(r.end_time), stage: r.stage, label: r.label || "", a: r.team_a, b: r.team_b, al: r.a_label || "", bl: r.b_label || "", score: r.score || "", winner: r.winner, refs: r.refs || {} });
  state.cups = (raw.cups || []).map(r => ({ id: r.id, name: r.name, kind: r.kind, start: r.start_date, end: r.end_date, place: r.place || "", cafe: r.cafe_url || "", adv: r.adv || 2, note: r.note || "",
    teams: (T[r.id] || []).sort((a, b) => a.grp.localeCompare(b.grp) || a.sort - b.sort || a.name.localeCompare(b.name, "ko")),
    matches: (M[r.id] || []).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)) })).sort((a, b) => b.start.localeCompare(a.start));
  const av = {};
  for (const r of raw.cup_avail || []) ((av[r.cup_id] = av[r.cup_id] || {})[r.date] = av[r.cup_id][r.date] || {})[r.player_id] = { going: !!r.going, name: r.name || "", team: r.team_id || "", reason: r.reason || "", note: r.note || "" };
  state.cupAvail = av;
}
// 보여줄 대회: 고른 것 → 진행 중·다가오는 것 → 가장 최근
function curCup() {
  const l = state.cups || [], t = iso(today());
  return cupById(state.cmpId) || l.filter(c => c.end >= t).sort((a, b) => a.start.localeCompare(b.start))[0] || l[0] || null;
}
const dayKo = d => `${md(parseD(d))} (${DOW_KO[parseD(d).getDay()]})`;
const cupRange = c => c.start === c.end ? dayKo(c.start) : `${dayKo(c.start)} – ${dayKo(c.end)}`;
const teamTag = t => t === "women" ? `<span class="chip cmp-w">여</span>` : t === "men" ? `<span class="chip cmp-m">남</span>` : "";

/* 가능일 투표 (하루): 참 · 불참(사유) — 대회·훈련 투표와 같은 창 */
function availBtns(c, d, compact) {
  if (!state.myPid) return "";
  const v = availOf(c, d)[state.myPid], cur = v ? (v.going ? "go" : "no") : "", past = d < iso(today()), id = `${c.id}|${d}`;
  if (compact) return `<button type="button" class="cmp-day ${cur}" data-act="voteopen" data-type="cup" data-id="${id}" ${past ? "disabled" : ""} aria-label="${dayKo(d)} ${cur === "go" ? "참" : cur === "no" ? "불참" : "미응답"}">${parseD(d).getDate()}<small>${DOW_KO[parseD(d).getDay()]}</small></button>`;
  return past ? (cur ? `<span class="chip ${cur === "go" ? "ok" : "warn"}">${cur === "go" ? "참" : "불참"}</span>` : "") : voteBtn("cup", id, cur);
}

/* ---------- 화면 ---------- */
const CMP_TABS = [["games", "경기"], ["avail", "가능일"], ["groups", "조편성"], ["bracket", "대진표"]];
function viewCampus() {
  if (!state.loaded) return loaderHtml();
  const c = curCup(), adm = can("schedule"), t = iso(today()), tab = state.cmpTab || "games";
  const pick = (state.cups || []).length > 1 ? `<div class="sc-row">${state.cups.map(x => `<button type="button" class="chip sc-chip ${c && x.id === c.id ? "on" : ""}" data-act="cmppick" data-id="${x.id}">${esc(x.name)}</button>`).join("")}</div>` : "";
  const addCup = adm ? `<button class="btn add" type="button" data-act="cmpform" data-f="cup">+ 교내 대회</button>` : "";
  if (!c) return `<section class="sec"><div class="sec-head"><h3>교내 대회</h3>${addCup}</div>${emptyLine("등록된 교내 대회가 없어요.")}<a class="btn small" href="${CAFE_URL}" target="_blank" rel="noopener">스포츠진흥원 cafe</a></section>`;
  const head = `<section class="sec"><div class="sec-head"><h3>교내 대회</h3>${addCup}</div>${pick}
    <div class="panel cmp-head"><div class="cmp-ttl"><h2 class="dyn">${esc(c.name)}</h2><span class="small muted">${cupRange(c)}${c.place ? ` · ${esc(c.place)}` : ""}</span></div>
      ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
      <div class="row"><a class="btn small" href="${esc(c.cafe || CAFE_URL)}" target="_blank" rel="noopener">스포츠진흥원 cafe</a>${adm ? `<button class="btn small" type="button" data-act="cmpform" data-f="cup" data-id="${c.id}">수정</button>` : ""}</div></div>
    <div class="seg fill sc-tabs cmp-tabs" role="tablist">${CMP_TABS.map(([k, l]) => `<button type="button" class="seg-tab ${tab === k ? "on solid" : ""}" role="tab" aria-selected="${tab === k}" data-act="cmptab" data-v="${k}">${l}</button>`).join("")}</div></section>`;
  if (tab === "avail") return head + availHtml(c);
  if (tab === "groups") return head + groupsHtml(c);
  if (tab === "bracket") return head + (bracketHtml(c) || emptyLine("조편성을 하면 대진표가 만들어져요."));
  const mine = myRefs(c).filter(x => x.m.date >= t);
  const mineHtml = mine.length ? `<section class="sec"><h3>내 심판</h3><ul class="boxes cmp-mine">${mine.map(({ m, role }) => `<li><span class="num">${dayKo(m.date)} ${m.start}</span><b>${role}</b><span class="small">${esc(cmpSide(c, m, "a"))} vs ${esc(cmpSide(c, m, "b"))}</span></li>`).join("")}</ul></section>` : "";
  return head + mineHtml + matchesHtml(c);
}
// 가능일: 날마다 가능 · 불가 (남녀 합쳐서)
function availHtml(c) {
  const adm = can("schedule"), cnt = refCounts(c), me = cmpMe();
  const nm = v => `<span class="${v.name === me ? "me" : ""}">${teamTag(v.team)}${esc(v.name)}${adm && cnt[v.name] ? `<sub>${cnt[v.name]}</sub>` : ""}</span>`;
  const rows = cupDays(c).map(d => {
    const av = Object.values(availOf(c, d)).sort((a, b) => a.name.localeCompare(b.name, "ko")), go = av.filter(v => v.going), no = av.filter(v => !v.going);
    return `<li class="${d < iso(today()) ? "past" : ""}"><div class="cmp-av-h"><b>${dayKo(d)}</b><span class="chip ok">참 ${go.length}</span>${no.length ? `<span class="chip warn">불참 ${no.length}</span>` : ""}<span class="cmp-av-btn">${availBtns(c, d)}</span></div>
      ${go.length ? `<p class="small cmp-who">${go.map(nm).join("")}</p>` : ""}
      ${no.length ? (adm ? `<ul class="at-list">${no.map(v => `<li><b>${esc(v.name)}</b> <span class="small">${esc(ABS_REASONS[v.reason] || "")}${v.note ? ` · ${esc(v.note)}` : ""}</span></li>`).join("")}</ul>` : `<p class="small cmp-who"><b class="c-no">불참</b>${no.map(nm).join("")}</p>`) : ""}</li>`;
  }).join("");
  return `<section class="sec"><h3>가능일</h3><ul class="boxes cmp-av">${rows}</ul></section>`;
}
// 경기 · 심판 (날짜별 표, 화면 캡처와 같은 모양)
function matchesHtml(c) {
  const adm = can("schedule"), me = cmpMe(), byD = {};
  for (const m of c.matches) (byD[m.date] = byD[m.date] || []).push(m);
  const cell = v => `<td class="${v && v === me ? "me" : ""}">${esc(v || "")}</td>`;
  const days = Object.keys(byD).sort().map(d => `<div class="tw cmp-tw"><table class="cmp-tbl"><thead><tr><th>${dayKo(d)}</th><th>경기</th>${REF_ROLES.map(([, l]) => `<th>${l}</th>`).join("")}${adm ? "<th></th>" : ""}</tr></thead><tbody>
    ${byD[d].map(m => { const w = winnerOf(c, m), nm = s => { const id = sideId(c, m, s), n = esc(cmpSide(c, m, s)); return id && w === id ? `<b>${n}</b>` : n; };
      return `<tr><td class="num">${m.start}${m.end ? "–" + m.end : ""}</td><td class="cmp-vs">${m.stage !== "group" || m.label ? `<span class="small muted">${esc(m.label || STAGE_KO[m.stage])}</span>` : ""}${nm("a")} <span class="muted">vs</span> ${nm("b")}${m.score ? ` <span class="chip">${esc(m.score)}</span>` : ""}</td>${REF_ROLES.map(([k]) => cell((m.refs || {})[k])).join("")}${adm ? `<td><button class="btn link small" type="button" data-act="cmpform" data-f="match" data-id="${m.id}">수정</button></td>` : ""}</tr>`; }).join("")}
    </tbody></table></div>
    <ul class="cmp-cards"><li class="cmp-dh">${dayKo(d)}</li>${byD[d].map(m => { const w = winnerOf(c, m), nm = sd => { const id = sideId(c, m, sd), n = esc(cmpSide(c, m, sd)); return id && w === id ? `<b>${n}</b>` : n; };
      return `<li><div class="cmp-mh"><span class="num">${m.start}</span>${m.stage !== "group" || m.label ? `<span class="small muted">${esc(m.label || STAGE_KO[m.stage])}</span>` : ""}${m.score ? `<span class="chip">${esc(m.score)}</span>` : ""}${adm ? `<button class="btn link small" type="button" data-act="cmpform" data-f="match" data-id="${m.id}">수정</button>` : ""}</div>
        <p class="cmp-mv">${nm("a")} <span class="muted">vs</span> ${nm("b")}</p>${Object.keys(m.refs || {}).length ? `<div class="cmp-rf">${REF_ROLES.map(([k, l]) => (m.refs || {})[k] ? `<span class="${m.refs[k] === me ? "me" : ""}"><em>${l}</em>${esc(m.refs[k])}</span>` : "").join("")}</div>` : ""}</li>`; }).join("")}</ul>`).join("");
  return `<section class="sec"><div class="sec-head"><h3>경기 · 심판</h3>${adm ? `<button class="btn add" type="button" data-act="cmpform" data-f="match">+ 경기</button>` : ""}</div>${days || emptyLine("아직 경기 일정이 없어요.")}</section>`;
}
// 조편성 + 조별 순위 (점수 "2-1" = 세트)
function groupsHtml(c) {
  const adm = can("schedule"), grps = [...new Set(c.teams.map(t => t.grp || "-"))].sort(), { st } = groupStand(c);
  const played = Object.values(st).some(x => x.n);
  const box = g => { const ts = c.teams.filter(t => (t.grp || "-") === g).sort((a, b) => played ? (a.withdrawn - b.withdrawn) || (st[b.id].w - st[a.id].w) || ((st[b.id].sw - st[b.id].sl) - (st[a.id].sw - st[a.id].sl)) || a.sort - b.sort : a.sort - b.sort);
    return `<div class="panel cmp-grp"><h4>${g === "-" ? "조 없음" : esc(g) + "조"}</h4><ol>${ts.map(t => `<li class="${t.withdrawn ? "wd" : ""}"><span>${esc(t.name)}${t.withdrawn ? ` <span class="chip warn">기권</span>` : ""}</span>${st[t.id].n && !t.withdrawn ? `<span class="num small">${st[t.id].w}승 ${st[t.id].l}패${st[t.id].sw || st[t.id].sl ? ` · ${st[t.id].sw}:${st[t.id].sl}` : ""}</span>` : ""}${adm ? `<button class="btn link small" type="button" data-act="cmpform" data-f="team" data-id="${t.id}">수정</button>` : ""}</li>`).join("")}</ol></div>`; };
  const live = c.teams.filter(t => !t.withdrawn).length;
  return `<section class="sec"><div class="sec-head"><h3>조편성 <span class="small muted">${live}팀 · 조 ${c.adv}위까지 본선</span></h3>${adm ? `<span class="row"><button class="btn add" type="button" data-act="cmpform" data-f="draw">조 추첨</button><button class="btn add" type="button" data-act="cmpform" data-f="team">+ 팀</button></span>` : ""}</div>${c.teams.length ? `<div class="cmp-grps">${grps.map(box).join("")}</div>` : emptyLine("아직 참가 팀이 없어요.")}</section>`;
}
// 본선 대진표 (토너먼트 나무): 왼쪽에 자리(A1위 · B선택 · C2위 …)를 세로로, 경기마다 선을 모아 오른쪽으로 → 우승
// 경기의 자리 이름이 "○○ 승자"면 그 경기가 아래 가지. 3·4위전은 아래에 따로
function bracketHtml(c) {
  const bm = c.matches.filter(m => BRACKET.includes(m.stage)), third = c.matches.filter(m => m.stage === "3rd");
  if (!bm.length && !third.length) return "";
  const adm = can("schedule");
  const ref = (m, sd) => { const x = /^(.+?)\s*승자$/.exec(m[sd + "l"] || ""); return x && !m[sd] ? bm.find(o => o.label === x[1] && o !== m) || null : null; };
  const used = new Set(); for (const m of bm) for (const sd of ["a", "b"]) { const r = ref(m, sd); if (r) used.add(r); }
  const roots = bm.filter(m => !used.has(m)).sort((a, b) => BRACKET.indexOf(b.stage) - BRACKET.indexOf(a.stage));
  const node = (m, d = 0) => ({ m, kids: ["a", "b"].map(sd => { const r = d < 6 && ref(m, sd); return r ? node(r, d + 1) : { leaf: true, m, sd }; }) });
  const height = n => n.leaf ? 0 : 1 + Math.max(...n.kids.map(height));
  const trees = roots.map(r => node(r)), maxH = Math.max(1, ...trees.map(height));
  const nw = matchMedia("(max-width: 640px)").matches, RH = 40, LW = nw ? 84 : 96, GAP = nw ? 84 : 96, BW = nw ? 84 : 96, BH = 30, TOP = 6;
  // 높이별 선 모이는 x, 그 뒤 승자 칸(4강 이상)
  const JX = [0, 0], OUT = [LW];
  for (let h = 1; h <= maxH; h++) { JX[h] = OUT[h - 1] + GAP; OUT[h] = h >= 2 ? JX[h] + 14 + BW : JX[h]; }
  let row = 0; const leaves = [], joins = [], lines = [];
  const place = (n, top) => {
    if (n.leaf) { const y = TOP + (row++ + 0.5) * RH; leaves.push({ n, y }); return { x: LW, y }; }
    const h = height(n), pts = n.kids.map(k => place(k)), y = (pts[0].y + pts[1].y) / 2, jx = JX[h];
    for (const p of pts) lines.push(`M${p.x} ${p.y}H${jx}`);
    lines.push(`M${jx} ${pts[0].y}V${pts[1].y}`);
    joins.push({ n, h, y, jx });
    if (h >= 2 && !top) { lines.push(`M${jx} ${y}H${jx + 14}`); return { x: jx + 14 + BW, y }; }
    return { x: jx, y };
  };
  const tops = trees.map((t, i) => { if (i) row += 0.6; return { t, p: place(t, true) }; });
  const tag = m => adm ? `data-act="cmpform" data-f="match" data-id="${m.id}" role="button" tabindex="0"` : "";
  const winX = JX[maxH] + 40;
  // 3·4위전: 우승 옆에 같은 모양으로 (4강 패자 두 자리 → 선 모음 → 3위)
  const thirdBits = [];
  if (third.length) {
    const x0 = winX + BW + 34, jx = x0 + LW + GAP, fy = tops.length ? tops[0].p.y : TOP + RH;
    third.forEach((m, i) => {
      const w = winnerOf(c, m), wt = w && cmpTeam(c, w), my = fy + i * 2.4 * RH, ys = [my - RH / 2, my + RH / 2];
      thirdBits.push(`<span class="bk-l" style="left:${x0}px;top:${ys[0] - BH / 2 - 20}px;width:${LW + GAP + 14 + BW}px">3·4위전</span>`);
      ["a", "b"].forEach((sd, k) => { const id = sideId(c, m, sd), t = id && cmpTeam(c, id);
        thirdBits.push(`<div class="tb-leaf ${w && id && w !== id ? "lose" : ""} ${w && id === w ? "win" : ""}" style="left:${x0}px;top:${ys[k] - BH / 2}px;width:${LW}px;height:${BH}px">${t ? esc(t.name) : esc((m[sd + "l"] || "미정").replace(/ 패자$/, " 패"))}</div>`);
        lines.push(`M${x0 + LW} ${ys[k]}H${jx}`); });
      lines.push(`M${jx} ${ys[0]}V${ys[1]}M${jx} ${my}H${jx + 14}`);
      thirdBits.push(`<div class="tb-lab" style="left:${jx - GAP + 4}px;top:${my - 17}px;width:${GAP - 10}px" ${tag(m)}><b>${md(parseD(m.date))}</b><span>${m.start}${m.end ? "–" + m.end : ""}${m.score ? ` · ${esc(m.score)}` : ""}</span></div>`,
        `<div class="tb-win ${wt ? "on" : ""}" style="left:${jx + 14}px;top:${my - BH / 2}px;width:${BW}px;height:${BH}px">${wt ? esc(wt.name) : "3위"}</div>`);
      thirdBits.w = Math.max(thirdBits.w || 0, jx + 14 + BW + 4);
      row = Math.max(row, (ys[1] + BH / 2 - TOP) / RH);
    });
  }
  const totW = Math.max(winX + BW + 4, thirdBits.w || 0), totH = TOP + row * RH;
  for (const { p } of tops) lines.push(`M${p.x} ${p.y}H${winX}`);
  const leafHtml = leaves.map(({ n, y }) => { const id = sideId(c, n.m, n.sd), w = winnerOf(c, n.m), t = id && cmpTeam(c, id);
    return `<div class="tb-leaf ${w && id && w !== id ? "lose" : ""} ${w && id === w ? "win" : ""}" style="top:${y - BH / 2}px;width:${LW}px;height:${BH}px" title="${esc(n.m[n.sd + "l"] || "")}">${t ? `${esc(t.name)}${n.m[n.sd + "l"] ? `<small>${esc(n.m[n.sd + "l"])}</small>` : ""}` : esc(n.m[n.sd + "l"] || "미정")}</div>`; }).join("");
  const joinHtml = joins.map(({ n, h, y, jx }) => { const m = n.m, w = winnerOf(c, m), wt = w && cmpTeam(c, w);
    const lab = `<div class="tb-lab" style="left:${jx - GAP + 4}px;top:${y - 17}px;width:${GAP - 10}px" ${tag(m)}><b>${esc(m.label || STAGE_KO[m.stage])}</b><span>${m.start}${m.end ? "–" + m.end : ""}${m.score ? ` · ${esc(m.score)}` : ""}</span></div>`;
    const isTop = tops.some(x => x.t === n);
    return lab + (h >= 2 && !isTop ? `<div class="tb-win ${wt ? "on" : ""}" style="left:${jx + 14}px;top:${y - BH / 2}px;width:${BW}px;height:${BH}px">${wt ? esc(wt.name) : esc((m.label || "") + " 승자")}</div>` : ""); }).join("");
  const champ = tops.map(({ t, p }) => { const w = winnerOf(c, t.m), wt = w && cmpTeam(c, w);
    return `<div class="tb-champ ${wt ? "on" : ""}" style="left:${winX}px;top:${p.y - 18}px;width:${BW}px">${svg("trophy")}<span>${wt ? esc(wt.name) : "우승"}</span></div>`; }).join("");
  return `<section class="sec"><h3>본선 대진표</h3><div class="bk-wrap"><div class="tb" style="width:${totW}px;height:${totH}px">
    <svg class="bk-ln" width="${totW}" height="${totH}" aria-hidden="true"><path d="${lines.join("")}"/></svg>${leafHtml}${joinHtml}${champ}${thirdBits.join("")}</div></div></section>`;
}

/* ---------- 홈: 내 투표 (한 줄씩, 응답한 건 접어 둠) ---------- */
const VT_SHORT = { go: "참", no: "불참" };
function myVotesHtml() {
  const me = playerOf(state.myPid); if (!me || me.military) return "";
  const t = iso(today()), rows = [];
  const line = (name, when, right) => `<span class="mv-n"><b>${esc(name)}</b> <span class="small muted">${esc(when)}</span></span>${right}`;
  for (const x of voteItems()) {
    const v = evVotesOf(x.kind, x.id)[me.id];
    rows.push({ d: x.d, todo: !v, html: line(x.name, x.when, voteBtn(x.kind, x.id, v ? (v.going ? "go" : "no") : "")) });
  }
  for (const [d, os] of Object.entries(state.opens)) if (d >= t && d <= dAdd(t, 14)) for (const o of os) {
    const v = o.votes[me.id];
    rows.push({ d, todo: v === undefined, html: line("자율 훈련", `${md(parseD(d))}${o.start ? " " + o.start : ""}`, voteBtn("open", o.id, v === true ? "go" : v === false ? "no" : "")) });
  }
  for (const c of state.cups || []) {
    const days = cupDays(c).filter(d => d >= t); if (!days.length) continue;
    rows.push({ d: c.start, todo: days.some(d => !availOf(c, d)[me.id]), html: `<span class="mv-n"><b>${esc(CUP_SHORT[c.kind] || c.name)}</b> <span class="small muted">가능일</span></span><span class="cmp-days">${days.map(d => availBtns(c, d, true)).join("")}</span>` });
  }
  if (!rows.length) return "";
  rows.sort((a, b) => a.d.localeCompare(b.d));
  const todo = rows.filter(r => r.todo), done = rows.filter(r => !r.todo), li = r => `<li class="mv-row">${r.html}</li>`;
  return `<section class="panel my-votes"><div class="mv-head"><h3>내 투표</h3>${todo.length ? `<span class="chip warn">미응답 ${todo.length}</span>` : `<span class="chip ok">모두 응답</span>`}</div>
    ${todo.length ? `<ul class="mv-list">${todo.map(li).join("")}</ul>` : ""}
    ${done.length ? `<details class="mv-done" data-keep="mv-done" ${keepOpen("mv-done", false)}><summary class="small muted">응답 ${done.length}</summary><ul class="mv-list">${done.map(li).join("")}</ul></details>` : ""}</section>`;
}
// 달력에서 고른 날이 교내 대회 날이면: 경기 · 내 심판 · 내 가능 투표
function cupDayHtml(c, d) {
  const ms = c.matches.filter(m => m.date === d), me = cmpMe();
  return `<div class="cmp-cal"><span class="small"><i class="dot k-cup"></i>${esc(c.name)}${c.place ? ` · ${esc(c.place)}` : ""}</span>
    ${ms.length ? `<ul class="cmp-cal-m">${ms.map(m => { const r = REF_ROLES.find(([k]) => me && (m.refs || {})[k] === me); return `<li><span class="num">${m.start}</span><span>${esc(m.stage !== "group" && m.label ? m.label + " · " : "")}${esc(cmpSide(c, m, "a"))} vs ${esc(cmpSide(c, m, "b"))}</span>${r ? `<span class="chip warn">내 ${r[1]}</span>` : ""}</li>`; }).join("")}</ul>` : ""}
    <div class="row">${state.myPid && d >= iso(today()) ? availBtns(c, d) : ""}<button class="btn link small" type="button" data-act="view" data-v="campus">교내 대회 ›</button></div></div>`;
}

/* ---------- 관리 폼 (아래에서 올라오는 창) ---------- */
// 심판 후보: 남녀 배구부 명단 (다른 팀 선수 표는 못 읽어서 서버 함수로 이름만)
async function cupPeople() {
  if (state.cupPeople) return state.cupPeople;
  try { const r = await sb.rpc("cup_people"); if (!r.error && Array.isArray(r.data)) state.cupPeople = r.data; } catch (e) { /* 아래에서 내 팀 명단으로 */ }
  return state.cupPeople || sortedPlayers().map(p => ({ id: p.id, name: p.name, team_id: TEAM.id }));
}
// 심판 칸: 명단에서 고르기 + 직접 입력
function refSel(k, l, cur, people, avNames) {
  const known = people.some(p => p.name === cur), og = (lab, l2) => l2.length ? `<optgroup label="${lab}">${l2.map(n => `<option value="${esc(n)}" ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>` : "";
  const av = avNames.filter(n => people.some(p => p.name === n));
  const rest = t => people.filter(p => p.team_id === t && !av.includes(p.name)).map(p => p.name);
  return `<label class="fl">${l}<select id="cm-r-${k}" class="cmp-ref"><option value="">비움</option>${og("참", av)}${og("남자부", rest("men"))}${og("여자부", rest("women"))}<option value="__custom" ${cur && !known ? "selected" : ""}>직접 입력</option></select>
    <input id="cm-rc-${k}" class="cmp-refc" maxlength="20" placeholder="이름" value="${esc(cur && !known ? cur : "")}" ${cur && !known ? "" : "hidden"} aria-label="${l} 이름"></label>`;
}
async function openCmpForm(kind, id) {
  const c = curCup(), el = document.getElementById("sheet");
  const people = kind === "match" && c ? await cupPeople() : [];
  let title = "", html = "";
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  if (kind === "cup") {
    const x = id ? cupById(id) : null, s = x || {};
    title = x ? "교내 대회 수정" : "교내 대회 추가";
    html = `<form class="f" id="cmpCupForm" data-id="${x ? x.id : ""}" data-close="1"><div class="fields">
      <label class="fl">종류<select id="cc-kind">${Object.entries(CUP_KIND).map(([k, l]) => opt(k, l, s.kind || (Number(iso(today()).slice(5, 7)) >= 8 ? "gen" : "pres"))).join("")}</select></label>
      <label class="fl">이름<input id="cc-name" required maxlength="60" value="${esc(s.name || "")}" placeholder="예: ${iso(today()).slice(0, 4)} 종합체육대회"></label>
      <div class="pair"><label class="fl">시작<input type="date" id="cc-start" required value="${esc(s.start || "")}"></label><label class="fl">끝<input type="date" id="cc-end" value="${esc(s.end || "")}"></label></div>
      <label class="fl">본선 진출<select id="cc-adv">${[1, 2, 3].map(n => opt(String(n), `조 ${n}위까지`, String(s.adv || 2))).join("")}</select></label>
      <label class="fl">장소<input id="cc-place" maxlength="60" value="${esc(s.place || "")}" placeholder="예: 71동 B코트"></label>
      <label class="fl wide">카페 글 주소<input id="cc-cafe" type="url" maxlength="300" value="${esc(s.cafe || CAFE_URL)}"></label>
      <label class="fl wide">메모<input id="cc-note" maxlength="500" value="${esc(s.note || "")}"></label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button></div></form>${x ? delZone(`data-act="cmpdelcup" data-id="${x.id}"`, "교내 대회 삭제") : ""}`;
  } else if (kind === "draw" && c) {
    const n = c.teams.filter(t => !t.withdrawn).length, cur = new Set(c.teams.map(t => t.grp).filter(Boolean)).size || Math.min(3, Math.max(1, Math.round(n / 3)));
    title = "조 추첨";
    html = `<form class="f" id="cmpDrawForm" data-c="${c.id}" data-close="1"><p class="small muted">기권 뺀 ${n}팀을 무작위로 나눠요. 조 경기와 본선 대진표는 자동으로 다시 맞춰져요.</p><div class="fields">
      <label class="fl">조 개수<select id="cd-n">${[1, 2, 3, 4].map(k => opt(String(k), `${k}개 조 (${Math.floor(n / k)}${n % k ? "–" + Math.ceil(n / k) : ""}팀씩)`, String(cur))).join("")}</select></label>
    </div><div class="row"><button class="btn primary" type="submit">추첨</button></div></form>`;
  } else if (kind === "team" && c) {
    const x = id ? cmpTeam(c, id) : null, s = x || {};
    title = x ? "팀 수정" : "팀 추가";
    html = `<form class="f" id="cmpTeamForm" data-c="${c.id}" data-id="${x ? x.id : ""}" data-close="1"><div class="fields">
      <label class="fl">팀 이름<input id="ct-name" required maxlength="40" value="${esc(s.name || "")}"></label>
      <div class="pair"><label class="fl">조<input id="ct-grp" maxlength="4" value="${esc(s.grp || "")}" placeholder="A"></label><label class="fl">조 안 순서<input id="ct-sort" type="number" min="1" max="20" value="${s.sort ?? ""}"></label></div>
      <label class="check"><input type="checkbox" id="ct-wd" ${s.withdrawn ? "checked" : ""}> 기권</label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button></div></form>${x ? delZone(`data-act="cmpdel" data-t="cup_teams" data-id="${x.id}"`, "팀 삭제") : ""}`;
  } else if (kind === "match" && c) {
    const x = id ? c.matches.find(m => m.id === id) : null, s = x || { date: c.start, stage: "group", refs: {} };
    const d = s.date, av = availOf(c, d), cnt = refCounts(c);
    const pool = Object.values(av).filter(v => v.going).sort((a, b) => (cnt[a.name] || 0) - (cnt[b.name] || 0) || a.name.localeCompare(b.name, "ko"));
    const teamSel = (sid, cur, lab) => `<label class="fl">${sid === "a" ? "A" : "B"} 팀<select id="cm-${sid}"><option value="">정해지지 않음</option>${c.teams.filter(t => !t.withdrawn).map(t => opt(t.id, `${t.grp ? t.grp + "조 " : ""}${t.name}`, cur)).join("")}</select></label><label class="fl">${sid === "a" ? "A" : "B"} 자리 이름<input id="cm-${sid}l" maxlength="20" value="${esc(lab || "")}" placeholder="예: A1위"></label>`;
    title = x ? "경기 · 심판" : "경기 추가";
    html = `<form class="f" id="cmpMatchForm" data-c="${c.id}" data-id="${x ? x.id : ""}" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="cm-date" required value="${esc(d)}" min="${c.start}" max="${c.end}"></label>
      <div class="pair"><label class="fl">시작<input type="time" id="cm-s" value="${esc(s.start || "")}"></label><label class="fl">끝<input type="time" id="cm-e" value="${esc(s.end || "")}"></label></div>
      <label class="fl">단계<select id="cm-stage">${Object.entries(STAGE_KO).map(([k, l]) => opt(k, l, s.stage)).join("")}</select></label>
      <label class="fl">경기 이름<input id="cm-label" maxlength="40" value="${esc(s.label || "")}" placeholder="예: 6강 1경기"></label>
      ${teamSel("a", s.a, s.al)}${teamSel("b", s.b, s.bl)}
      <label class="fl">점수 (세트)<input id="cm-score" maxlength="40" value="${esc(s.score || "")}" placeholder="예: 2-1 (21-18, 19-21, 15-12)"></label>
    </div>
    <h4 class="cmp-sub">심판</h4>
    <div class="fields cmp-refs">${REF_ROLES.map(([k, l]) => refSel(k, l, (s.refs || {})[k] || "", people, pool.map(v => v.name))).join("")}</div>
    ${pool.length ? `<p class="small muted">${dayKo(d)} 참 · 누르면 빈 칸에 (숫자 = 맡은 횟수)</p><div class="cmp-pool">${pool.map(v => `<button type="button" class="chip sc-chip" data-act="cmpfill" data-n="${esc(v.name)}">${teamTag(v.team)}${esc(v.name)}${v.note ? ` <em>${esc(v.note)}</em>` : ""}${cnt[v.name] ? ` <sub>${cnt[v.name]}</sub>` : ""}</button>`).join("")}</div>` : `<p class="small muted">${dayKo(d)} 참 인원 없음</p>`}
    <div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button></div></form>${x ? delZone(`data-act="cmpdel" data-t="cup_matches" data-id="${x.id}"`, "경기 삭제") : ""}`;
  } else return;
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${title}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>${html}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
let cmpLastRef = null;
document.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("cmp-ref")) cmpLastRef = e.target; });
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.classList && el.classList.contains("cmp-ref")) { const ci = document.getElementById(el.id.replace("cm-r-", "cm-rc-")); if (ci) { ci.hidden = el.value !== "__custom"; if (!ci.hidden) ci.focus(); } return; }
});
async function campusClick(b, act) {
  if (act === "cmpgo") { state.cmpId = b.dataset.id; state.cmpTab = "games"; return go("campus"); }
  if (act === "cmptab") { state.cmpTab = b.dataset.v; state.dirty = false; return render(); }
  if (act === "cmppick") { state.cmpId = b.dataset.id; state.dirty = false; return render(); }
  if (act === "cmpform") return openCmpForm(b.dataset.f, b.dataset.id);
  if (act === "cmpfill") {
    const ins = [...document.querySelectorAll("select.cmp-ref")], tgt = cmpLastRef && document.contains(cmpLastRef) && !cmpLastRef.value ? cmpLastRef : ins.find(i => !i.value);
    if (!tgt) return toast("빈 심판 칸이 없어요");
    const n = b.dataset.n, has = [...tgt.options].some(o => o.value === n), ci = document.getElementById(tgt.id.replace("cm-r-", "cm-rc-"));
    tgt.value = has ? n : "__custom"; if (ci) { ci.hidden = has; ci.value = has ? "" : n; } cmpLastRef = null; return;
  }
  if (act === "cmpdel") {
    if (!await confirmDel(b.dataset.t === "cup_teams" ? "이 팀을 지울까요?" : "이 경기를 지울까요?")) return;
    try { ok(await sb.from(b.dataset.t).delete().eq("id", b.dataset.id)); closeSheet(); await loadAll(); if (b.dataset.t === "cup_teams" && await syncCup(curCup())) await loadAll(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    return;
  }
  if (act === "cmpdelcup") {
    if (!await confirmDel("이 교내 대회를 지울까요? 팀 · 경기 · 투표가 모두 지워져요.")) return;
    try { ok(await sb.from("cups").delete().eq("id", b.dataset.id)); state.cmpId = null; toast("지웠어요"); await loadAll(); } catch (e) { toast(failMsg(e)); }
  }
}
async function campusSubmit(f) {
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  if (f.id === "cmpCupForm") {
    const start = v("cc-start"), end = v("cc-end") || start;
    if (end < start) { toast("끝 날짜가 시작보다 앞이에요."); return false; }
    const row = { name: v("cc-name"), kind: v("cc-kind"), start_date: start, end_date: end, adv: Number(v("cc-adv")) || 2, place: v("cc-place") || null, cafe_url: v("cc-cafe") || null, note: v("cc-note") || null };
    if (f.dataset.id) { ok(await sb.from("cups").update(row).eq("id", f.dataset.id)); await loadAll(); await syncCup(cupById(f.dataset.id)); }
    else state.cmpId = ok(await sb.from("cups").insert(row).select("id").single()).id;
    toast(f.dataset.id ? "저장했어요" : "교내 대회를 넣었어요 · 그 기간은 정규 훈련 대신 대회 주");
  } else if (f.id === "cmpTeamForm") {
    const row = { cup_id: f.dataset.c, name: v("ct-name"), grp: v("ct-grp").toUpperCase() || null, sort: Number(v("ct-sort")) || 9, withdrawn: document.getElementById("ct-wd").checked };
    ok(f.dataset.id ? await sb.from("cup_teams").update(row).eq("id", f.dataset.id) : await sb.from("cup_teams").insert(row));
    await loadAll(); const n = await syncCup(cupById(f.dataset.c));
    toast(n ? `저장했어요 · 경기 ${n}개 맞춤` : "저장했어요");
  } else if (f.id === "cmpDrawForm") {
    const c = cupById(f.dataset.c), k = Number(v("cd-n")) || 1, ts = c.teams.filter(t => !t.withdrawn);
    for (let i = ts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ts[i], ts[j]] = [ts[j], ts[i]]; }
    const G = "ABCDEFGH".slice(0, k);
    for (let i = 0; i < ts.length; i++) ok(await sb.from("cup_teams").update({ grp: G[i % k], sort: Math.floor(i / k) + 1 }).eq("id", ts[i].id));
    await loadAll(); const n = await syncCup(cupById(c.id));
    toast(`${k}개 조로 나눴어요${n ? ` · 경기 ${n}개 맞춤` : ""}`);
  } else if (f.id === "cmpMatchForm") {
    const s = v("cm-s") || null, e = v("cm-e") || null;
    if (s && e && e <= s) { toast("끝 시간이 시작보다 앞이에요."); return false; }
    const refs = {}; for (const [k] of REF_ROLES) { const sel = v("cm-r-" + k), n = sel === "__custom" ? v("cm-rc-" + k) : sel; if (n) refs[k] = n; }
    const a = v("cm-a") || null, b = v("cm-b") || null;
    if (a && a === b) { toast("같은 팀끼리는 경기할 수 없어요."); return false; }
    const row = { cup_id: f.dataset.c, date: v("cm-date"), start_time: s, end_time: e, stage: v("cm-stage"), label: v("cm-label") || null, team_a: a, team_b: b, a_label: v("cm-al") || null, b_label: v("cm-bl") || null, score: v("cm-score") || null, refs };
    ok(f.dataset.id ? await sb.from("cup_matches").update(row).eq("id", f.dataset.id) : await sb.from("cup_matches").insert(row));
    toast("저장했어요");
  }
}

/* ---------- 조편성 · 대진 자동 맞춤 ----------
   조마다 풀리그(기권 팀 빼고), 조 n위까지 본선. 본선 자리 수에 맞춰 부전승(위 시드)을 두고 같은 조끼리 첫 경기는 피함.
   3개 조 · 2위까지(6강)는 우리 대회 방식: A1위·C1위 부전승, B조는 1·2위가 자리 선택(B선택) */
function rrPairs(ts) {
  if (ts.length === 3) return [[ts[0], ts[1]], [ts[1], ts[2]], [ts[2], ts[0]]];
  const a = ts.slice(); if (a.length % 2) a.push(null);
  const out = [], n = a.length;
  for (let r = 0; r < n - 1; r++) { for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; if (x && y) out.push(r % 2 ? [y, x] : [x, y]); } a.splice(1, 0, a.pop()); }
  return out;
}
function koPlan(groups, adv) {
  const G = groups.map(g => g.g);
  if (G.length === 3 && adv === 2 && groups.every(g => g.n >= 2)) return [
    { stage: "r6", label: "6강 1경기", al: "B선택", bl: "C2위" }, { stage: "r6", label: "6강 2경기", al: "A2위", bl: "B선택" },
    { stage: "sf", label: "4강 1경기", al: "A1위", bl: "6강 1경기 승자" }, { stage: "sf", label: "4강 2경기", al: "6강 2경기 승자", bl: "C1위" },
    { stage: "3rd", label: "3·4위전", al: "4강 1경기 패자", bl: "4강 2경기 패자" }, { stage: "f", label: "결승", al: "4강 1경기 승자", bl: "4강 2경기 승자" }];
  const seeds = [];
  for (let r = 1; r <= adv; r++) for (const g of groups) if (g.n >= r) seeds.push({ lab: `${g.g}${r}위`, g: g.g, r });
  const K = seeds.length; if (K < 2) return [];
  let P = 2; while (P < K) P *= 2; if (P > 8) return null;
  let ord = [1, 2]; while (ord.length < P) { const m = ord.length * 2 + 1; ord = ord.flatMap(x => [x, m - x]); }
  const slot = ord.map(x => x <= K ? seeds[x - 1] : null);
  // 첫 경기에서 같은 조끼리 만나면 같은 순위 다른 자리와 바꿈
  for (let i = 0; i < P; i += 2) { const x = slot[i], y = slot[i + 1]; if (!x || !y || x.g !== y.g) continue;
    for (let j = 0; j < P; j += 2) if (j !== i) { const z = slot[j + 1]; if (z && z.r === y.r && z.g !== x.g && (!slot[j] || slot[j].g !== y.g)) { slot[i + 1] = z; slot[j + 1] = y; break; } } }
  const nm = n => n === 2 ? ["f", "결승"] : n === 4 ? ["sf", "4강"] : K === 6 ? ["r6", "6강"] : ["qf", "8강"];
  let cur = slot.map(x => x ? x.lab : null); const out = []; let last = null;
  while (cur.length > 1) {
    const [st, ko] = nm(cur.length), nx = [], made = [];
    for (let i = 0; i < cur.length; i += 2) { const x = cur[i], y = cur[i + 1];
      if (x && y) { const label = cur.length === 2 ? "결승" : `${ko} ${made.length + 1}경기`; const m = { stage: st, label, al: x, bl: y }; made.push(m); out.push(m); nx.push(label + " 승자"); }
      else nx.push(x || y); }
    last = made; cur = nx;
  }
  const fin = out.find(m => m.stage === "f");
  if (fin && / 승자$/.test(fin.al) && / 승자$/.test(fin.bl)) out.splice(out.indexOf(fin), 0, { stage: "3rd", label: "3·4위전", al: fin.al.replace(/ 승자$/, " 패자"), bl: fin.bl.replace(/ 승자$/, " 패자") });
  return out;
}
// 계획대로 DB 맞춤: 같은 경기(같은 두 팀 · 같은 경기 이름)는 시간·심판·점수 그대로 두고, 빠진 건 추가, 필요 없어진 건(점수 없는 것만) 삭제. 바꾼 개수를 돌려줌
async function syncCup(c) {
  if (!c || !can("schedule")) return 0;
  const live = c.teams.filter(t => !t.withdrawn && t.grp);
  const G = [...new Set(live.map(t => t.grp.toUpperCase()))].sort();
  const groups = G.map(g => ({ g, ts: live.filter(t => t.grp.toUpperCase() === g).sort((a, b) => a.sort - b.sort) }));
  const ko = koPlan(groups.map(x => ({ g: x.g, n: x.ts.length })), c.adv || 2);
  if (ko === null) { toast("본선 9팀 이상은 경기를 직접 넣어 주세요"); return 0; }
  const key = (a, b) => [a, b].sort().join(), want = new Map();
  for (const x of groups) for (const [a, b] of rrPairs(x.ts)) want.set(key(a.id, b.id), [a.id, b.id]);
  const del = [], ins = [], upd = [], have = new Set();
  for (const m of c.matches.filter(m => m.stage === "group")) { const k = m.a && m.b ? key(m.a, m.b) : null; if (k && want.has(k) && !have.has(k)) have.add(k); else if (!m.score) del.push(m.id); }
  for (const [k, [a, b]] of want) if (!have.has(k)) ins.push({ cup_id: c.id, date: c.start, stage: "group", team_a: a, team_b: b, refs: {} });
  const exK = c.matches.filter(m => m.stage !== "group" && m.stage !== "etc"), used = new Set();
  const late = c.end > c.start ? dAdd(c.end, -1) : c.end;
  for (const p of ko) {
    const m = exK.find(x => x.label === p.label && !used.has(x));
    if (m) { used.add(m); if (m.stage !== p.stage || m.al !== p.al || m.bl !== p.bl) upd.push([m.id, { stage: p.stage, a_label: p.al, b_label: p.bl, team_a: m.al === p.al ? m.a : null, team_b: m.bl === p.bl ? m.b : null }]); }
    else ins.push({ cup_id: c.id, date: ["f", "3rd"].includes(p.stage) ? c.end : late, stage: p.stage, label: p.label, a_label: p.al, b_label: p.bl, refs: {} });
  }
  for (const m of exK) if (!used.has(m) && !m.score) del.push(m.id);
  if (del.length) ok(await sb.from("cup_matches").delete().in("id", del));
  if (ins.length) ok(await sb.from("cup_matches").insert(ins));
  for (const [id, row] of upd) ok(await sb.from("cup_matches").update(row).eq("id", id));
  return del.length + ins.length + upd.length;
}
