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
const cmpSide = (c, m, s) => { const t = m[s] && cmpTeam(c, m[s]); return t ? t.name : m[s + "l"] || "미정"; };
const hm = s => s ? String(s).slice(0, 5) : "";
const cmpSets = m => { const x = /(\d+)\s*[-:]\s*(\d+)/.exec(m.score || ""); return x ? [Number(x[1]), Number(x[2])] : null; };
const winnerOf = m => { if (m.winner) return m.winner; const s = cmpSets(m); return s && s[0] !== s[1] && m.a && m.b ? (s[0] > s[1] ? m.a : m.b) : null; };
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
  state.cups = (raw.cups || []).map(r => ({ id: r.id, name: r.name, kind: r.kind, start: r.start_date, end: r.end_date, place: r.place || "", cafe: r.cafe_url || "", note: r.note || "",
    teams: (T[r.id] || []).sort((a, b) => a.grp.localeCompare(b.grp) || a.sort - b.sort || a.name.localeCompare(b.name, "ko")),
    matches: (M[r.id] || []).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)) })).sort((a, b) => b.start.localeCompare(a.start));
  const av = {};
  for (const r of raw.cup_avail || []) ((av[r.cup_id] = av[r.cup_id] || {})[r.date] = av[r.cup_id][r.date] || {})[r.player_id] = { going: !!r.going, name: r.name || "", team: r.team_id || "", note: r.note || "" };
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

/* 가능 투표 버튼 (하루) */
function availBtns(c, d, compact) {
  if (!state.myPid) return "";
  const v = availOf(c, d)[state.myPid], g = v ? v.going : null, past = d < iso(today());
  if (compact) return `<button type="button" class="cmp-day ${g === true ? "go" : g === false ? "no" : ""}" data-act="cmpav" data-c="${c.id}" data-d="${d}" data-v="${g === true ? 0 : 1}" ${past ? "disabled" : ""} aria-label="${dayKo(d)} ${g === true ? "가능" : g === false ? "불가" : "미응답"}"><b>${md(parseD(d))}</b><span>${DOW_KO[parseD(d).getDay()]}</span><i>${g === true ? "가능" : g === false ? "불가" : "?"}</i></button>`;
  return `<div class="vote-seg" role="group" aria-label="${dayKo(d)}"><button type="button" class="seg-go ${g === true ? "on" : ""}" data-act="cmpav" data-c="${c.id}" data-d="${d}" data-v="1" ${past ? "disabled" : ""}>가능</button><button type="button" class="seg-no ${g === false ? "on" : ""}" data-act="cmpav" data-c="${c.id}" data-d="${d}" data-v="0" ${past ? "disabled" : ""}>불가</button></div>`;
}

/* ---------- 화면 ---------- */
function viewCampus() {
  if (!state.loaded) return loaderHtml();
  const c = curCup(), adm = can("schedule"), t = iso(today());
  const pick = (state.cups || []).length > 1 ? `<div class="sc-row">${state.cups.map(x => `<button type="button" class="chip sc-chip ${c && x.id === c.id ? "on" : ""}" data-act="cmppick" data-id="${x.id}">${esc(x.name)}</button>`).join("")}</div>` : "";
  const addCup = adm ? `<button class="btn add" type="button" data-act="cmpform" data-f="cup">+ 교내 대회</button>` : "";
  if (!c) return `<section class="sec"><div class="sec-head"><h3>교내 대회</h3>${addCup}</div>${emptyLine("등록된 교내 대회가 없어요.")}<a class="btn small" href="${CAFE_URL}" target="_blank" rel="noopener">스포츠진흥원 카페</a></section>`;
  const mine = myRefs(c).filter(x => x.m.date >= t);
  const head = `<section class="sec"><div class="sec-head"><h3>교내 대회</h3>${addCup}</div>${pick}
    <div class="panel cmp-head"><div class="cmp-ttl"><h2 class="dyn">${esc(c.name)}</h2><span class="chip">${esc(CUP_KIND[c.kind] || "")}</span></div>
      <p class="small muted">${cupRange(c)}${c.place ? ` · ${esc(c.place)}` : ""}${c.note ? ` · ${esc(c.note)}` : ""}</p>
      <div class="row"><a class="btn small" href="${esc(c.cafe || CAFE_URL)}" target="_blank" rel="noopener">카페 공지 · 참가 신청</a>${adm ? `<button class="btn small" type="button" data-act="cmpform" data-f="cup" data-id="${c.id}">수정</button><button class="btn link danger small" type="button" data-act="cmpdelcup" data-id="${c.id}">삭제</button>` : ""}</div></div></section>`;
  const mineHtml = mine.length ? `<section class="sec"><h3>내 심판</h3><ul class="boxes cmp-mine">${mine.map(({ m, role }) => `<li><span class="num">${dayKo(m.date)} ${m.start}</span><b>${role}</b><span class="small">${esc(cmpSide(c, m, "a"))} vs ${esc(cmpSide(c, m, "b"))}</span></li>`).join("")}</ul></section>` : "";
  return head + mineHtml + availHtml(c) + matchesHtml(c) + groupsHtml(c) + bracketHtml(c);
}
// 날마다 올 수 있는 사람 (남녀 합쳐서)
function availHtml(c) {
  const adm = can("schedule"), cnt = refCounts(c);
  const rows = cupDays(c).map(d => {
    const av = availOf(c, d), go = Object.entries(av).filter(([, v]) => v.going), no = Object.entries(av).filter(([, v]) => !v.going);
    const mine = state.myPid && av[state.myPid];
    const who = go.length ? `<p class="small cmp-who">${go.sort((a, b) => a[1].name.localeCompare(b[1].name, "ko")).map(([, v]) => `<span class="${v.name === cmpMe() ? "me" : ""}">${teamTag(v.team)}${esc(v.name)}${v.note ? `<em>${esc(v.note)}</em>` : ""}${adm && cnt[v.name] ? `<sub>${cnt[v.name]}</sub>` : ""}</span>`).join("")}</p>` : "";
    return `<li class="${d < iso(today()) ? "past" : ""}"><div class="cmp-av-h"><b>${dayKo(d)}</b><span class="chip ok">가능 ${go.length}</span>${no.length ? `<span class="chip">불가 ${no.length}</span>` : ""}${availBtns(c, d)}</div>
      ${mine && mine.going ? `<input class="cmp-note" data-c="${c.id}" data-d="${d}" maxlength="60" placeholder="메모 (예: 19시부터)" value="${esc(mine.note)}" aria-label="${dayKo(d)} 메모">` : ""}${who}</li>`;
  }).join("");
  return `<section class="sec"><h3>올 수 있는 날 <span class="small muted">남녀 함께</span></h3><ul class="boxes cmp-av">${rows}</ul></section>`;
}
// 경기 · 심판 (날짜별 표, 화면 캡처와 같은 모양)
function matchesHtml(c) {
  const adm = can("schedule"), me = cmpMe(), byD = {};
  for (const m of c.matches) (byD[m.date] = byD[m.date] || []).push(m);
  const cell = v => `<td class="${v && v === me ? "me" : ""}">${esc(v || "")}</td>`;
  const days = Object.keys(byD).sort().map(d => `<div class="tw cmp-tw"><table class="cmp-tbl"><thead><tr><th>${dayKo(d)}</th><th>경기</th>${REF_ROLES.map(([, l]) => `<th>${l}</th>`).join("")}${adm ? "<th></th>" : ""}</tr></thead><tbody>
    ${byD[d].map(m => { const w = winnerOf(m), nm = s => { const id = m[s], n = esc(cmpSide(c, m, s)); return id && w === id ? `<b>${n}</b>` : n; };
      return `<tr><td class="num">${m.start}${m.end ? "–" + m.end : ""}</td><td class="cmp-vs">${m.stage !== "group" || m.label ? `<span class="small muted">${esc(m.label || STAGE_KO[m.stage])}</span>` : ""}${nm("a")} <span class="muted">vs</span> ${nm("b")}${m.score ? ` <span class="chip">${esc(m.score)}</span>` : ""}</td>${REF_ROLES.map(([k]) => cell((m.refs || {})[k])).join("")}${adm ? `<td><button class="btn link small" type="button" data-act="cmpform" data-f="match" data-id="${m.id}">수정</button></td>` : ""}</tr>`; }).join("")}
    </tbody></table></div>
    <ul class="cmp-cards"><li class="cmp-dh">${dayKo(d)}</li>${byD[d].map(m => { const w = winnerOf(m), nm = sd => { const n = esc(cmpSide(c, m, sd)); return m[sd] && w === m[sd] ? `<b>${n}</b>` : n; };
      return `<li><div class="cmp-mh"><span class="num">${m.start}</span>${m.stage !== "group" || m.label ? `<span class="small muted">${esc(m.label || STAGE_KO[m.stage])}</span>` : ""}${m.score ? `<span class="chip">${esc(m.score)}</span>` : ""}${adm ? `<button class="btn link small" type="button" data-act="cmpform" data-f="match" data-id="${m.id}">수정</button>` : ""}</div>
        <p class="cmp-mv">${nm("a")} <span class="muted">vs</span> ${nm("b")}</p>${Object.keys(m.refs || {}).length ? `<div class="cmp-rf">${REF_ROLES.map(([k, l]) => (m.refs || {})[k] ? `<span class="${m.refs[k] === me ? "me" : ""}"><em>${l}</em>${esc(m.refs[k])}</span>` : "").join("")}</div>` : ""}</li>`; }).join("")}</ul>`).join("");
  return `<section class="sec"><div class="sec-head"><h3>경기 · 심판</h3>${adm ? `<button class="btn add" type="button" data-act="cmpform" data-f="match">+ 경기</button>` : ""}</div>${days || emptyLine("아직 경기 일정이 없어요.")}</section>`;
}
// 조편성 + 조별 순위 (점수 "2-1" = 세트)
function groupsHtml(c) {
  const adm = can("schedule"), grps = [...new Set(c.teams.map(t => t.grp || "-"))].sort();
  const st = {};
  for (const t of c.teams) st[t.id] = { w: 0, l: 0, sw: 0, sl: 0, n: 0 };
  for (const m of c.matches) if (m.stage === "group" && m.a && m.b && st[m.a] && st[m.b]) {
    const s = cmpSets(m), w = winnerOf(m); if (!s && !w) continue;
    st[m.a].n++; st[m.b].n++;
    if (s) { st[m.a].sw += s[0]; st[m.a].sl += s[1]; st[m.b].sw += s[1]; st[m.b].sl += s[0]; }
    if (w) { st[w].w++; st[w === m.a ? m.b : m.a].l++; }
  }
  const played = Object.values(st).some(x => x.n);
  const box = g => { const ts = c.teams.filter(t => (t.grp || "-") === g).sort((a, b) => played ? (a.withdrawn - b.withdrawn) || (st[b.id].w - st[a.id].w) || ((st[b.id].sw - st[b.id].sl) - (st[a.id].sw - st[a.id].sl)) || a.sort - b.sort : a.sort - b.sort);
    return `<div class="panel cmp-grp"><h4>${g === "-" ? "조 없음" : esc(g) + "조"}</h4><ol>${ts.map(t => `<li class="${t.withdrawn ? "wd" : ""}"><span>${esc(t.name)}${t.withdrawn ? ` <span class="chip warn">기권</span>` : ""}</span>${st[t.id].n && !t.withdrawn ? `<span class="num small">${st[t.id].w}승 ${st[t.id].l}패${st[t.id].sw || st[t.id].sl ? ` · ${st[t.id].sw}:${st[t.id].sl}` : ""}</span>` : ""}${adm ? `<button class="btn link small" type="button" data-act="cmpform" data-f="team" data-id="${t.id}">수정</button>` : ""}</li>`).join("")}</ol></div>`; };
  return `<section class="sec"><div class="sec-head"><h3>조편성</h3>${adm ? `<button class="btn add" type="button" data-act="cmpform" data-f="team">+ 팀</button>` : ""}</div>${c.teams.length ? `<div class="cmp-grps">${grps.map(box).join("")}</div>` : emptyLine("아직 참가 팀이 없어요.")}</section>`;
}
// 본선 대진: 6강 → 4강 → 결승 (+ 3·4위전)
function bracketHtml(c) {
  const cols = BRACKET.map(s => [s, c.matches.filter(m => m.stage === s)]).filter(([, l]) => l.length);
  const third = c.matches.filter(m => m.stage === "3rd");
  if (!cols.length && !third.length) return "";
  const mbox = m => { const w = winnerOf(m), side = s => `<span class="${m[s] && w === m[s] ? "win" : ""} ${m[s] ? "" : "muted"}">${esc(cmpSide(c, m, s))}</span>`;
    return `<div class="cmp-bm"><span class="small muted">${esc(m.label || STAGE_KO[m.stage])} · ${md(parseD(m.date))} ${m.start}</span>${side("a")}${side("b")}${m.score ? `<span class="chip">${esc(m.score)}</span>` : ""}</div>`; };
  return `<section class="sec"><h3>본선 대진</h3><div class="cmp-br">${cols.map(([s, l]) => `<div class="cmp-bc"><h4>${STAGE_KO[s]}</h4>${l.map(mbox).join("")}</div>`).join("")}${third.length ? `<div class="cmp-bc"><h4>3·4위전</h4>${third.map(mbox).join("")}</div>` : ""}</div></section>`;
}

/* ---------- 홈: 내 투표 현황 ---------- */
function myVotesHtml() {
  const me = playerOf(state.myPid); if (!me || me.military) return "";
  const t = iso(today()), rows = [];
  for (const x of voteItems()) {
    const v = evVotesOf(x.kind, x.id)[me.id];
    rows.push({ d: x.d, todo: !v, html: `<div class="mv-t"><b>${esc(x.name)}</b><span class="small muted">${esc(x.when)}</span></div>${voteBtn(x.kind, x.id, v ? (v.going ? "go" : "no") : "")}` });
  }
  for (const [d, os] of Object.entries(state.opens)) if (d >= t && d <= dAdd(t, 14)) for (const o of os) {
    const v = o.votes[me.id];
    rows.push({ d, todo: v === undefined, html: `<div class="mv-t"><b>자율 훈련</b><span class="small muted">${dayKo(d)}${o.start ? " " + o.start : ""}${o.place ? " · " + esc(o.place) : ""}</span></div>${voteBtn("open", o.id, v === true ? "go" : v === false ? "no" : "")}` });
  }
  for (const c of state.cups || []) {
    const days = cupDays(c).filter(d => d >= t); if (!days.length) continue;
    const todo = days.some(d => !availOf(c, d)[me.id]);
    rows.push({ d: c.start, todo, html: `<div class="mv-t"><b>${esc(c.name)}</b><span class="small muted">올 수 있는 날</span></div><div class="cmp-days">${days.map(d => availBtns(c, d, true)).join("")}</div>`, wide: true });
  }
  if (!rows.length) return "";
  rows.sort((a, b) => (b.todo - a.todo) || a.d.localeCompare(b.d));
  const n = rows.filter(r => r.todo).length;
  return `<section class="panel my-votes"><div class="row between"><h3>내 투표</h3>${n ? `<span class="chip warn">미응답 ${n}</span>` : `<span class="chip ok">모두 응답</span>`}</div>
    <ul class="boxes">${rows.map(r => `<li class="mv-row ${r.todo ? "todo" : ""} ${r.wide ? "wide" : ""}">${r.html}</li>`).join("")}</ul></section>`;
}
// 달력에서 고른 날이 교내 대회 날이면: 경기 · 내 심판 · 내 가능 투표
function cupDayHtml(c, d) {
  const ms = c.matches.filter(m => m.date === d), me = cmpMe();
  return `<div class="cmp-cal"><span class="small"><i class="dot k-cup"></i>${esc(c.name)}${c.place ? ` · ${esc(c.place)}` : ""}</span>
    ${ms.length ? `<ul class="cmp-cal-m">${ms.map(m => { const r = REF_ROLES.find(([k]) => me && (m.refs || {})[k] === me); return `<li><span class="num">${m.start}</span><span>${esc(m.stage !== "group" && m.label ? m.label + " · " : "")}${esc(cmpSide(c, m, "a"))} vs ${esc(cmpSide(c, m, "b"))}</span>${r ? `<span class="chip warn">내 ${r[1]}</span>` : ""}</li>`; }).join("")}</ul>` : ""}
    <div class="row">${state.myPid && d >= iso(today()) ? `<span class="small">올 수 있어요?</span>${availBtns(c, d)}` : ""}<button class="btn link small" type="button" data-act="view" data-v="campus">교내 대회 ›</button></div></div>`;
}

/* ---------- 관리 폼 (아래에서 올라오는 창) ---------- */
function openCmpForm(kind, id) {
  const c = curCup(), el = document.getElementById("sheet");
  let title = "", html = "";
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  if (kind === "cup") {
    const x = id ? cupById(id) : null, s = x || {};
    title = x ? "교내 대회 수정" : "교내 대회 추가";
    html = `<form class="f" id="cmpCupForm" data-id="${x ? x.id : ""}" data-close="1"><div class="fields">
      <label class="fl">종류<select id="cc-kind">${Object.entries(CUP_KIND).map(([k, l]) => opt(k, l, s.kind || (Number(iso(today()).slice(5, 7)) >= 8 ? "gen" : "pres"))).join("")}</select></label>
      <label class="fl">이름<input id="cc-name" required maxlength="60" value="${esc(s.name || "")}" placeholder="예: ${iso(today()).slice(0, 4)} 종합체육대회"></label>
      <div class="pair"><label class="fl">시작<input type="date" id="cc-start" required value="${esc(s.start || "")}"></label><label class="fl">끝<input type="date" id="cc-end" value="${esc(s.end || "")}"></label></div>
      <label class="fl">장소<input id="cc-place" maxlength="60" value="${esc(s.place || "")}" placeholder="예: 71동 B코트"></label>
      <label class="fl wide">카페 글 주소<input id="cc-cafe" type="url" maxlength="300" value="${esc(s.cafe || CAFE_URL)}"></label>
      <label class="fl wide">메모<input id="cc-note" maxlength="500" value="${esc(s.note || "")}" placeholder="예: 3세트 2선승 (21 · 21 · 15)"></label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button></div></form>`;
  } else if (kind === "team" && c) {
    const x = id ? cmpTeam(c, id) : null, s = x || {};
    title = x ? "팀 수정" : "팀 추가";
    html = `<form class="f" id="cmpTeamForm" data-c="${c.id}" data-id="${x ? x.id : ""}" data-close="1"><div class="fields">
      <label class="fl">팀 이름<input id="ct-name" required maxlength="40" value="${esc(s.name || "")}"></label>
      <div class="pair"><label class="fl">조<input id="ct-grp" maxlength="4" value="${esc(s.grp || "")}" placeholder="A"></label><label class="fl">조 안 순서<input id="ct-sort" type="number" min="1" max="20" value="${s.sort ?? ""}"></label></div>
      <label class="check"><input type="checkbox" id="ct-wd" ${s.withdrawn ? "checked" : ""}> 기권</label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button>${x ? `<button class="btn link danger" type="button" data-act="cmpdel" data-t="cup_teams" data-id="${x.id}">팀 삭제</button>` : ""}</div></form>`;
  } else if (kind === "match" && c) {
    const x = id ? c.matches.find(m => m.id === id) : null, s = x || { date: c.start, stage: "group", refs: {} };
    const d = s.date, av = availOf(c, d), cnt = refCounts(c);
    const pool = Object.values(av).filter(v => v.going).sort((a, b) => (cnt[a.name] || 0) - (cnt[b.name] || 0) || a.name.localeCompare(b.name, "ko"));
    const names = [...new Set([...Object.values((state.cupAvail || {})[c.id] || {}).flatMap(o => Object.values(o).map(v => v.name)), ...sortedPlayers().map(p => p.name), ...c.matches.flatMap(m => Object.values(m.refs || {}))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
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
    <div class="fields cmp-refs">${REF_ROLES.map(([k, l]) => `<label class="fl">${l}<input id="cm-r-${k}" class="cmp-ref" list="cmp-names" maxlength="20" value="${esc((s.refs || {})[k] || "")}"></label>`).join("")}</div>
    <datalist id="cmp-names">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    ${pool.length ? `<p class="small muted">${dayKo(d)} 올 수 있는 사람 · 누르면 빈 칸에 들어가요 (숫자 = 이번 대회 맡은 횟수)</p><div class="cmp-pool">${pool.map(v => `<button type="button" class="chip sc-chip" data-act="cmpfill" data-n="${esc(v.name)}">${teamTag(v.team)}${esc(v.name)}${v.note ? ` <em>${esc(v.note)}</em>` : ""}${cnt[v.name] ? ` <sub>${cnt[v.name]}</sub>` : ""}</button>`).join("")}</div>` : `<p class="small muted">${dayKo(d)}에 가능하다고 한 사람이 아직 없어요.</p>`}
    <div class="row"><button class="btn primary" type="submit">${x ? "저장" : "추가"}</button>${x ? `<button class="btn link danger" type="button" data-act="cmpdel" data-t="cup_matches" data-id="${x.id}">경기 삭제</button>` : ""}</div></form>`;
  } else return;
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${title}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>${html}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
let cmpLastRef = null;
document.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("cmp-ref")) cmpLastRef = e.target; });
document.addEventListener("change", async e => {
  const el = e.target;
  if (!el.classList || !el.classList.contains("cmp-note") || !sb) return;
  try {
    ok(await sb.from("cup_avail").update({ note: el.value.trim() || null }).eq("cup_id", el.dataset.c).eq("date", el.dataset.d).eq("player_id", state.myPid));
    const v = availOf(cupById(el.dataset.c), el.dataset.d)[state.myPid]; if (v) v.note = el.value.trim();
    toast("메모를 저장했어요"); state.dirty = false; render();
  } catch (err) { toast(failMsg(err)); }
});
async function campusClick(b, act) {
  if (act === "cmppick") { state.cmpId = b.dataset.id; state.dirty = false; return render(); }
  if (act === "cmpform") return openCmpForm(b.dataset.f, b.dataset.id);
  if (act === "cmpfill") {
    const ins = [...document.querySelectorAll(".cmp-ref")], tgt = cmpLastRef && document.contains(cmpLastRef) && !cmpLastRef.value ? cmpLastRef : ins.find(i => !i.value);
    if (!tgt) return toast("빈 심판 칸이 없어요");
    tgt.value = b.dataset.n; cmpLastRef = null; return;
  }
  if (act === "cmpav") {
    if (!state.myPid) return;
    const c = cupById(b.dataset.c), d = b.dataset.d, going = b.dataset.v === "1", cur = availOf(c, d)[state.myPid];
    try {
      if (cur && cur.going === going && !b.classList.contains("cmp-day")) { ok(await sb.from("cup_avail").delete().eq("cup_id", c.id).eq("date", d).eq("player_id", state.myPid)); delete state.cupAvail[c.id][d][state.myPid]; }
      else {
        ok(await sb.from("cup_avail").upsert({ cup_id: c.id, date: d, player_id: state.myPid, going, note: going && cur ? cur.note || null : null }, { onConflict: "cup_id,date,player_id" }));
        const p = playerOf(state.myPid);
        ((state.cupAvail[c.id] = state.cupAvail[c.id] || {})[d] = state.cupAvail[c.id][d] || {})[state.myPid] = { going, name: p.name, team: TEAM.id, note: going && cur ? cur.note : "" };
      }
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render();
  }
  if (act === "cmpdel") {
    if (!await confirmDel(b.dataset.t === "cup_teams" ? "이 팀을 지울까요?" : "이 경기를 지울까요?")) return;
    try { ok(await sb.from(b.dataset.t).delete().eq("id", b.dataset.id)); closeSheet(); toast("지웠어요"); await loadAll(); } catch (e) { toast(failMsg(e)); }
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
    const row = { name: v("cc-name"), kind: v("cc-kind"), start_date: start, end_date: end, place: v("cc-place") || null, cafe_url: v("cc-cafe") || null, note: v("cc-note") || null };
    if (f.dataset.id) ok(await sb.from("cups").update(row).eq("id", f.dataset.id));
    else state.cmpId = ok(await sb.from("cups").insert(row).select("id").single()).id;
    toast(f.dataset.id ? "저장했어요" : "교내 대회를 넣었어요 · 그 기간은 정규 훈련 대신 대회 주");
  } else if (f.id === "cmpTeamForm") {
    const row = { cup_id: f.dataset.c, name: v("ct-name"), grp: v("ct-grp").toUpperCase() || null, sort: Number(v("ct-sort")) || 9, withdrawn: document.getElementById("ct-wd").checked };
    ok(f.dataset.id ? await sb.from("cup_teams").update(row).eq("id", f.dataset.id) : await sb.from("cup_teams").insert(row));
    toast("저장했어요");
  } else if (f.id === "cmpMatchForm") {
    const s = v("cm-s") || null, e = v("cm-e") || null;
    if (s && e && e <= s) { toast("끝 시간이 시작보다 앞이에요."); return false; }
    const refs = {}; for (const [k] of REF_ROLES) { const n = v("cm-r-" + k); if (n) refs[k] = n; }
    const a = v("cm-a") || null, b = v("cm-b") || null;
    if (a && a === b) { toast("같은 팀끼리는 경기할 수 없어요."); return false; }
    const row = { cup_id: f.dataset.c, date: v("cm-date"), start_time: s, end_time: e, stage: v("cm-stage"), label: v("cm-label") || null, team_a: a, team_b: b, a_label: v("cm-al") || null, b_label: v("cm-bl") || null, score: v("cm-score") || null, refs };
    ok(f.dataset.id ? await sb.from("cup_matches").update(row).eq("id", f.dataset.id) : await sb.from("cup_matches").insert(row));
    toast("저장했어요");
  }
}
