/* SNUVT Physical — 화면·데이터 (프로그램 규칙은 program.js) */

/* ---------- 기준값 ---------- */
// 일정표를 못 불러올 때만 쓰는 기본값
const DEFAULT_EVENTS = [{ name: "서울대배", kind: "major", start: "2026-11-21", end: "2026-11-22" }];
const LOG_TYPES = { A: ["웨이트 A (점프·하체)", 75], B: ["웨이트 B (상체·코어)", 60], team: ["정규 훈련", 180], act: ["활성화", 30], match: ["경기", 90], other: ["맨몸·기타", 35] };
// 세션 RPE (Foster 2001 CR-10). 원 척도에 말이 없는 6·8·9는 앞뒤 사이 값으로 풀어 씀
const RPE = ["0 휴식", "1 아주 아주 쉬움", "2 쉬움", "3 보통 · 대화하며 할 수 있음", "4 약간 힘듦", "5 힘듦 · 숨이 차지만 계속할 수 있음", "6 힘듦과 매우 힘듦 사이", "7 매우 힘듦 · 짧게만 말할 수 있음", "8 매우 힘듦과 최대 사이", "9 거의 최대 · 겨우 끝냄", "10 최대 · 더는 못 함"];
const AREA_KO = { knee: "무릎", shoulder: "어깨", ankle: "발목", back: "허리", wrist: "손목", finger: "손가락" };
// 통증은 두 시점(운동할 때 · 다음 날 아침)을 구간으로 고르고, 쉴 때·밤에도 아픈지 따로 체크 → painStage 로 단계 판정
const PAIN_LEVELS = [[0, "0 없음"], [2, "1–3 살짝"], [5, "4–6 꽤 아픔"], [8, "7–10 많이 아픔"]];
const painBucket = v => { v = Number(v) || 0; return v <= 0 ? 0 : v <= 3 ? 2 : v <= 6 ? 5 : 8; };
const levelSelect = (id, cur, label) => `<label class="fl">${label}<select id="${id}">${PAIN_LEVELS.map(([v, t]) => `<option value="${v}" ${painBucket(cur) === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
const STAGE_KEY = () => `<p class="small stage-key">${STAGE_NAMES.slice(0, 3).map((n, i) => `<span><b>${i + 1}단계 ${n}</b> ${STAGE_HINT[i]}</span>`).join("")}</p>`;
// 부위마다 '아파요' 체크 → 펼쳐지는 두 시점 + 쉴 때 (CSS :has 로 펼침)
function painRows(prefix, pain) {
  return `<div class="pain-rows">${PAIN_AREAS.map(a => {
    const v = normPain((pain || {})[a]) || { d: 0, m: 0, r: false }, on = v.d > 0 || v.m > 0 || v.r;
    return `<div class="pain-row"><label class="check"><input type="checkbox" class="pain-on" id="${prefix}-${a}-on" ${on ? "checked" : ""}> ${AREA_KO[a]}</label>
      <div class="pain-detail fields">${levelSelect(`${prefix}-${a}-d`, v.d, "운동할 때")}${levelSelect(`${prefix}-${a}-m`, v.m, "다음 날 아침")}
      <label class="check"><input type="checkbox" id="${prefix}-${a}-r" ${v.r ? "checked" : ""}> 쉴 때·밤에도 아파요</label></div></div>`;
  }).join("")}</div>`;
}
const readPain = prefix => Object.fromEntries(PAIN_AREAS.map(a => {
  const on = document.getElementById(`${prefix}-${a}-on`).checked;
  return [a, on ? { d: Number(document.getElementById(`${prefix}-${a}-d`).value) || 0, m: Number(document.getElementById(`${prefix}-${a}-m`).value) || 0, r: document.getElementById(`${prefix}-${a}-r`).checked } : { d: 0, m: 0, r: false }];
}));
const painMax = v => { const p = normPain(v); return !p ? 0 : p.r ? 10 : Math.max(p.d, p.m); };
const coreSum = t => t && [t.sideL, t.sideR, t.plank].every(v => v != null) ? Number(t.sideL) + Number(t.sideR) + Number(t.plank) : null;
// 웨이트 경험 3단계 (예전 값 lt6·gte6 도 읽음)
const WEXP = [["none", "초보자 · 웨이트가 처음이에요"], ["machine", "중급자 · 기구(머신)는 쓸 줄 알아요"], ["free", "숙련자 · 스쿼트·데드리프트 자세를 알아요"]];
const wexpNorm = v => v === "lt6" ? "machine" : v === "gte6" ? "free" : v;
const wexpSelect = (id, cur, required) => `<label class="fl wide">웨이트 경험<select id="${id}" ${required ? "required" : ""}><option value="">고르기</option>${WEXP.map(([v, l]) => `<option value="${v}" ${wexpNorm(cur) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
// 부상 이력: 부위 → 운동하다 흔히 다치는 종류
const INJ_PARTS = [
  ["shoulder", "어깨", ["회전근개 손상 (힘줄염·부분파열)", "회전근개 파열", "와순 파열 (SLAP 등)", "어깨 탈구·불안정", "충돌증후군", "견봉쇄골(AC) 관절 손상", "쇄골 골절"]],
  ["elbow", "팔꿈치", ["팔꿈치 힘줄염 (테니스·골프 엘보)", "팔꿈치 인대 손상", "팔꿈치 탈구·골절"]],
  ["wrist", "손목·손", ["손목 염좌", "TFCC 손상", "손목 골절 (주상골 등)", "손목 건초염", "손 골절"]],
  ["finger", "손가락", ["손가락 염좌 (인대)", "손가락 탈구", "손가락 골절", "망치손가락 (힘줄 손상)"]],
  ["neck", "목", ["목 염좌", "목 디스크"]],
  ["back", "허리", ["허리 염좌·근육 손상", "허리 디스크 탈출", "척추분리증·피로골절"]],
  ["hip", "엉덩이·사타구니", ["사타구니(내전근) 손상", "고관절 충돌·와순 손상", "엉덩이 굴곡근 손상"]],
  ["thigh", "허벅지", ["햄스트링 파열·손상", "대퇴사두근 파열·손상", "허벅지 타박상"]],
  ["knee", "무릎", ["전방십자인대(ACL) 파열", "전방십자인대 부분파열", "후방십자인대(PCL) 손상", "내측·외측 인대(MCL·LCL) 손상", "반월상연골 파열", "슬개건병증 (점퍼스니)", "슬개대퇴 통증", "슬개골 탈구"]],
  ["calf", "종아리·아킬레스", ["종아리 근육 파열", "아킬레스건병증", "아킬레스건 파열", "정강이 통증 (신스플린트)·피로골절"]],
  ["ankle", "발목", ["발목 염좌 (바깥쪽 인대)", "발목 인대 파열", "고위 발목 염좌", "발목 골절"]],
  ["foot", "발", ["족저근막염", "발 피로골절", "발가락 염좌·골절"]],
  ["head", "머리", ["뇌진탕"]],
  ["other", "기타", ["골절", "기타"]],
];
const INJ_SIDES = [["L", "왼쪽"], ["R", "오른쪽"], ["B", "양쪽"], ["-", "해당 없음"]];
const injTypes = part => (INJ_PARTS.find(x => x[0] === part) || INJ_PARTS[0])[2];
function injRowHtml(x = {}) {
  const part = x.part || "shoulder", y = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => String(y - i)).concat(["그 전"]);
  const o = (v, cur, l) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
  return `<div class="inj-row">
    <select class="inj-side" aria-label="방향">${INJ_SIDES.map(([v, l]) => o(v, x.side || "R", l)).join("")}</select>
    <select class="inj-part" aria-label="부위">${INJ_PARTS.map(([v, l]) => o(v, part, l)).join("")}</select>
    <select class="inj-type" aria-label="부상">${injTypes(part).map(t => o(t, x.type, t)).join("")}</select>
    <select class="inj-year" aria-label="연도">${years.map(v => o(v, x.year || y, v)).join("")}</select>
    <div class="inj-end"><label class="check"><input type="checkbox" class="inj-surg" ${x.surgery ? "checked" : ""}> 수술</label>
    <button class="btn link danger" type="button" data-act="delinj" aria-label="이 부상 지우기">✕ 지우기</button></div></div>`;
}
const injuryEditor = (prefix, list) => `<div class="inj" id="${prefix}-inj">${(list || []).map(injRowHtml).join("")}</div>
  <button class="btn" type="button" data-act="addinj" data-prefix="${prefix}">+ 부상 추가</button>`;
const readInjuries = prefix => [...document.querySelectorAll(`#${prefix}-inj .inj-row`)].map(r => ({
  side: r.querySelector(".inj-side").value, part: r.querySelector(".inj-part").value, type: r.querySelector(".inj-type").value,
  year: r.querySelector(".inj-year").value, surgery: r.querySelector(".inj-surg").checked,
}));
const injText = x => `${(INJ_SIDES.find(s => s[0] === x.side) || ["", ""])[1].replace("해당 없음", "")} ${x.type} (${x.year}${x.surgery ? ", 수술" : ""})`.trim();
const confirmDel = msg => { try { return window.confirm(msg); } catch (e) { return false; } };
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const VIEWS = ["home", "plan", "rec", "season", "intake", "load"];

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, "0");
const parseD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
const today = () => parseD(iso(new Date()));
const daysBetween = (a, b) => Math.round((parseD(iso(a)) - parseD(iso(b))) / 86400000);
const events = () => state.events || DEFAULT_EVENTS;
const dowMon = date => (date.getDay() + 6) % 7; // 월요일 = 0
const longDate = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;

/* ---------- 상태 ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = {
  view: "home", week: null, day: null, pid: null, editPid: null,
  players: {}, tests: {}, health: {}, logs: {}, inbody: {}, events: null,
  loaded: false, offline: false, admin: false, canWrite: null, dirty: false, armed: null,
  session: null, role: null, myPid: null, email: "", profiles: [], authMode: "login", authMsg: "", authErr: false, booting: true,
  selfPlayer: null, selfHealth: null, editingSelf: false, painChecks: {}, openKeys: {},
};
let sb = null;

function sortedPlayers() {
  return Object.entries(state.players).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)) || ((a.order ?? 99) - (b.order ?? 99)) || String(a.name).localeCompare(String(b.name), "ko"));
}
function runs(pid) { return [...((state.tests[pid] || {}).runs || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))); }
// 측정은 날마다 일부 항목만 잴 수 있어서, 항목별로 가장 최근 값을 모은다 (코어만 잰 날이 점프·근력 값을 지우지 않게)
const TEST_KEYS = ["reach", "cmj", "block", "approach", "balL", "balR", "hsStage", "hsSec", "hsWalk", "squat", "rdl", "pull", "sideL", "sideR", "plank"];
// 버티컬 점프 = 블로킹 높이(제자리 점프 최고 도달) − 스탠딩 리치, 맥스 버티컬 = 스파이크 높이(도움닫기) − 스탠딩 리치
const vertOf = t => t && t.reach != null && t.block != null ? Number(t.block) - Number(t.reach) : null;
const maxVertOf = t => t && t.reach != null && t.approach != null ? Number(t.approach) - Number(t.reach) : null;
function latest(pid) {
  const r = runs(pid); if (!r.length) return null;
  const out = { date: r.at(-1).date };
  for (const t of r) for (const k of TEST_KEYS) if (t[k] != null) out[k] = t[k];
  return out;
}
const isMainTest = t => ["reach", "cmj", "block", "approach", "balL", "balR", "squat", "rdl", "pull"].some(k => t[k] != null);
const isCoreHs = t => coreSum(t) != null || t.hsStage != null || t.hsWalk != null;
const inbodyOf = pid => [...(state.inbody[pid] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
const logsOf = pid => state.logs[pid] || [];
const checksOf = pid => [...(state.painChecks[pid] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created).localeCompare(String(b.created)));
const recentChecks = pid => { const from = iso(addDays(today(), -14)); return checksOf(pid).filter(c => c.date >= from); };
const coreRuns = pid => runs(pid).filter(t => coreSum(t) != null);
const hsText = t => t && t.hsStage ? `${t.hsStage}단계${t.hsWalk ? ` · ${t.hsWalk}m` : ""}` : "—";
// 다시 그려도 펼친 상태가 유지되게: <details data-keep="키">
const keepOpen = (key, dflt) => (state.openKeys[key] ?? dflt) ? "open" : "";
// 주는 월요일 날짜(YYYY-MM-DD)로 다룬다. 어떤 날의 프로그램은 일정표(대회·방학·학기)로 정해진다 (program.js seasonDay)
const thisMon = () => mondayOf(iso(today()));
const selMon = () => state.week ?? thisMon();
const selDay = () => state.day ?? (selMon() === thisMon() ? dowMon(today()) : 0);
const infoOn = date => seasonDay(date, events());
function weekLabel(mon) {
  const ls = DAYS.map((_, d) => infoOn(dAdd(mon, d)).label);
  return ls.find(l => /^(대회 주|컨디셔닝|트라이아웃)/.test(l)) || ls[3];
}
const canSeePrivate = pid => state.admin || (!!pid && pid === state.myPid);
// 처방·기록 화면에서 보는 선수 (선수는 항상 본인)
function viewPid() {
  if (!state.admin) return state.myPid && state.players[state.myPid] ? state.myPid : null;
  if (state.pid && state.players[state.pid]) return state.pid;
  if (state.myPid && state.players[state.myPid]) return state.myPid;
  const ps = sortedPlayers(); return ps.length ? ps[0].id : null;
}

/* ---------- 프로그램 연결 ---------- */
function ctxFor(p) {
  const h = state.health[p.id] || {};
  const ib = inbodyOf(p.id).filter(x => x.weight != null).at(-1);
  return {
    player: p, test: latest(p.id),
    weight: ib ? ib.weight : p.weight,
    rehab: h.rehab || [], pain: state.health[p.id] ? (h.pain || {}) : null, checks: recentChecks(p.id),
    injuries: h.injuries || [], year: today().getFullYear(),
    ankleHistory: !!(p.adjust && p.adjust.ankleBal) || (Number(h.ankleL) || 0) + (Number(h.ankleR) || 0) > 0,
  };
}
const planOn = (p, date) => planForDay(ctxFor(p), infoOn(date));
const teamPlanOn = date => planForDay({ player: {} }, infoOn(date));
const modsFor = p => { const h = state.health[p.id] || {}; return effectiveModules(p.adjust, h.rehab, state.health[p.id] ? (h.pain || {}) : null, recentChecks(p.id)); };
const playerOf = pid => pid && state.players[pid] ? { id: pid, ...state.players[pid] } : null;

/* ---------- 공통 조각 ---------- */
const chipsHtml = list => list.length ? `<div class="chips">${list.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : "";
const emptyLine = t => `<p class="empty-line">${t}</p>`;
const SHORT = { "점프 + 하체 근력": "하체", "상체·엉덩이·코어": "상체", "활성화 30분": "활성화", "정규 훈련": "훈련", "맨몸 상체·코어": "맨몸", "맨몸 하체·균형": "맨몸", "완전 휴식": "휴식", "대회": "대회", "대회 전날": "전날", "회복": "회복", "트라이아웃": "트라이", };
function weeksHtml(mon) {
  const now = thisMon();
  return `<div class="wnav" role="group" aria-label="주">
    <button class="btn" type="button" data-act="week" data-m="${dAdd(mon, -7)}" aria-label="이전 주">‹</button>
    <div class="wcur"><b>${md(parseD(mon))}–${md(parseD(dAdd(mon, 6)))}${mon === now ? ' <i class="dot" title="이번 주"></i>' : ""}</b><span>${esc(weekLabel(mon))}</span></div>
    <button class="btn" type="button" data-act="week" data-m="${dAdd(mon, 7)}" aria-label="다음 주">›</button>
    ${mon !== now ? `<button class="btn link" type="button" data-act="week" data-m="${now}">이번 주</button>` : ""}</div>`;
}
// act: "day" (프로그램 화면 안에서 요일 바꾸기) 또는 "openday" (홈에서 프로그램 화면으로)
function daysHtml(mon, sel, planOf, act = "day", doneDates = new Set()) {
  const t = iso(today());
  return `<div class="days" role="group" aria-label="요일">${DAYS.map((lab, d) => {
    const date = dAdd(mon, d), plan = planOf(date);
    const cls = ["rest", "recover"].includes(plan.slot) ? "rest" : ["match", "prep", "tryout"].includes(plan.slot) ? "cup" : plan.slot === "team" ? "team" : "gym";
    return `<button type="button" class="day ${cls}${plan.optional ? " opt" : ""}" data-act="${act}" data-m="${mon}" data-d="${d}" aria-pressed="${sel === d}">
      <span class="dw">${lab}</span><span class="dt">${md(parseD(date))}</span><span class="kd">${esc(SHORT[plan.kind] || plan.kind)}</span>${doneDates.has(date) ? '<span class="ok" title="기록함">✓</span>' : ""}${date === t ? '<span class="tdy">오늘</span>' : ""}</button>`;
  }).join("")}</div>`;
}
function playerPicker(pid) {
  if (!state.admin) return "";
  return `<label class="fl picker">선수<select id="pp-select">${state.view === "plan" ? `<option value="__team" ${pid === "__team" ? "selected" : ""}>팀 세션만 보기</option>` : ""}${sortedPlayers().map(x => `<option value="${esc(x.id)}" ${x.id === pid ? "selected" : ""}>${esc(x.name)} · ${esc(x.pos)}</option>`).join("")}</select></label>`;
}
function myName() {
  const p = (state.myPid && state.players[state.myPid]) || state.selfPlayer;
  return p && p.name ? p.name : (state.email || "").split("@")[0];
}
function header() {
  document.getElementById("today").textContent = longDate(today());
  const nm = nextMajor(events(), iso(today()));
  const d = nm ? daysBetween(parseD(nm.start), today()) : null;
  document.getElementById("dday").innerHTML = !nm ? "" : d > 0 ? `${esc(nm.name)} <strong>D-${d}</strong>` : `${esc(nm.name)} <strong>${d === 0 ? "D-DAY" : "대회 중"}</strong>`;
  const who = document.getElementById("who");
  const roleKo = state.admin ? "관리자" : state.role === "player" ? "선수" : "";
  who.innerHTML = state.session ? `<span>${esc(myName())}${roleKo ? " " + roleKo : ""}</span><button class="btn link" type="button" data-act="logout">로그아웃</button>` : "";
  if (!state.session || !state.role || state.role === "pending" || state.offline || needsSelfReg()) { document.getElementById("tabs").innerHTML = ""; return; }
  const tabs = [["home", "홈"], ["plan", "프로그램"], ["rec", "기록"], ["season", "일정"]];
  if (state.admin) tabs.push(["intake", "등록·측정"], ["load", "부하"]);
  document.getElementById("tabs").innerHTML = tabs.map(([k, l]) =>
    `<button type="button" data-act="view" data-v="${k}" ${state.view === k ? 'aria-current="page"' : ""}>${l}</button>`).join("");
}

/* ---------- 홈 ---------- */
function viewHome() {
  if (!state.loaded) return `<div class="panel empty"><strong>불러오는 중</strong></div>`;
  const me = playerOf(state.myPid);
  const parts = [];
  if (state.admin) parts.push(teamStatusHtml());
  if (state.admin && !me) parts.push(`<section class="panel row between"><div><h3>내 선수 정보가 아직 없어요</h3></div><button class="btn primary" type="button" data-act="editself">내 정보 입력</button></section>`);
  if (me) parts.push(todayHtml(me), myStatusHtml(me));
  else if (!state.admin) parts.push(`<div class="panel empty"><strong>계정이 선수와 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`);
  return parts.join("");
}
function todayHtml(p) {
  const t = iso(today()), mon = thisMon(), d = dowMon(today());
  const done = new Set(logsOf(p.id).map(e => e.date));
  const strip = daysHtml(mon, d, x => planOn(p, x), "openday", done);
  const plan = planOn(p, t);
  const main = plan.blocks.filter(b => !["warm", "cool"].includes(b.key));
  const items = main.flatMap(b => b.items).slice(0, 5);
  const mine = plan.blocks.filter(b => b.scope === "me");
  return `<section class="panel today-card">
    <p class="eyebrow">오늘 · ${longDate(today())} · ${esc(weekLabel(mon))}</p>
    <h2>${esc(plan.title)}</h2>
    ${items.length ? `<ul class="mini">${items.map(x => `<li><span>${esc(x.name)}</span><b>${esc(fmtRx(x.rx))}</b></li>`).join("")}</ul>` : ""}
    <div class="row between">
      <span class="small muted">${[plan.landings ? `착지 약 ${plan.landings}회` : "", mine.length ? `개인 ${mine.map(b => b.title.replace(/ \(.*\)$/, "")).join(" · ")}` : ""].filter(Boolean).join(" · ")}</span>
      <button class="btn primary" type="button" data-act="openday" data-m="${mon}" data-d="${d}">전체 프로그램 보기</button>
    </div>
    <p class="sub">이번 주</p>${strip}</section>`;
}
function myStatusHtml(p) {
  const t = latest(p.id);
  const ib = inbodyOf(p.id).filter(x => x.weight != null).at(-1);
  const rel = relStrength(t, ib ? ib.weight : p.weight);
  const mv = maxVertOf(t), v = vertOf(t);
  const mvRuns = runs(p.id).filter(x => maxVertOf(x) != null);
  const dMv = mv != null && mvRuns.length > 1 ? mv - maxVertOf(mvRuns[0]) : null;
  const blk = t && t.block != null ? Number(t.block) - NET : null;
  const todayLog = logsOf(p.id).filter(e => e.date === iso(today()));
  const weekLogs = logsOf(p.id).filter(e => mondayOf(e.date) === thisMon());
  const au = weekLogs.reduce((s, e) => s + (Number(e.rpe) || 0) * (Number(e.minutes) || 0), 0);
  const jumps = weekLogs.reduce((s, e) => s + (Number(e.jumps) || 0), 0);
  const mods = modsFor(p);
  const cr = coreRuns(p.id), core = cr.length ? coreSum(cr.at(-1)) : null, dCore = cr.length > 1 ? core - coreSum(cr[0]) : null;
  const stat = (k, v, sub = "") => `<div class="stat"><div class="k">${k}</div><div class="v">${v}${sub}</div></div>`;
  return `<section class="tiles">
    <div class="panel tile">
      <h3>오늘 기록</h3>
      ${todayLog.length ? `<p class="done">✓ ${todayLog.map(e => `${esc((LOG_TYPES[e.type] || ["기타"])[0])} RPE ${esc(e.rpe)} × ${esc(e.minutes)}분`).join(", ")}</p>`
        : `<button class="btn primary" type="button" data-act="view" data-v="rec">기록하기</button>`}
      <p class="small muted">이번 주 ${au.toLocaleString("ko-KR")} AU · 착지 ${jumps}회</p>
    </div>
    <div class="panel tile">
      <h3>내 지표</h3>
      ${t || ib ? `<div class="stats">
        ${stat("맥스 버티컬", mv != null ? mv : "—", dMv != null ? ` <small class="${dMv < 0 ? "neg" : ""}">${dMv > 0 ? "+" : ""}${dMv}</small>` : "")}
        ${stat("버티컬 점프", v != null ? v : "—")}
        ${stat("블로킹 네트 위", blk != null ? (blk >= 0 ? "+" : "") + blk : "—")}
        ${stat("상대 근력", rel != null ? rel.toFixed(2) : "—")}
        ${stat("코어 합계 (초)", core != null ? core : "—", dCore != null ? ` <small class="${dCore < 0 ? "neg" : ""}">${dCore > 0 ? "+" : ""}${dCore}</small>` : "")}
        ${stat("물구나무", hsText(t))}</div>` : emptyLine("측정 후 나와요.")}
      <button class="btn link" type="button" data-act="view" data-v="rec">코어·물구나무 기록하기 →</button>
    </div>
    <div class="panel tile">
      <h3>통증</h3>
      ${mods.length ? `<ul class="plain">${mods.map(m => `<li><b>${esc(painLabel(m))}</b> <span class="muted">${esc(REHAB[m.area].pain[m.stage - 1])}</span></li>`).join("")}</ul>` : `<p class="small muted">지금 붙은 통증 단계 없음</p>`}
      ${painCheckForm(p, "home")}
    </div>
  </section>`;
}
function teamStatusHtml() {
  const ps = sortedPlayers(), t = iso(today()), mon = thisMon();
  const pending = state.profiles.filter(m => m.role === "pending" && m.id !== state.session.user.id);
  const loggedToday = ps.filter(p => logsOf(p.id).some(e => e.date === t)).length;
  const recent = iso(addDays(today(), -3));
  const watch = [];
  for (const p of ps) {
    const why = [];
    const pc = checksOf(p.id).filter(c => c.date >= recent && painStage({ d: c.during, m: c.morning, r: c.rest }) && painStage({ d: c.during, m: c.morning, r: c.rest }) <= 2);
    if (pc.length) { const c = pc.at(-1), st = painStage({ d: c.during, m: c.morning, r: c.rest }); why.push([st === 1 ? "crit" : "warn", `${AREA_KO[c.area]} ${c.rest ? "쉴 때도 아픔" : `운동 ${c.during ?? "—"} · 아침 ${c.morning ?? "—"}`} (${md(parseD(c.date))})`]); }
    for (const m of modsFor(p)) why.push([m.stage === 1 ? "crit" : "warn", painLabel(m) + (m.inferred ? "?" : "") + (m.fromCheck ? " · 체크" : "")]);
    const sum = m => logsOf(p.id).filter(e => mondayOf(e.date) === m).reduce((s, e) => s + (Number(e.rpe) || 0) * (Number(e.minutes) || 0), 0);
    const a = sum(mon), b = sum(dAdd(mon, -7));
    if (b > 0 && a >= 2 * b) why.push(["warn", "부하 전주 2배↑"]);
    if (why.length) watch.push({ p, why });
  }
  return `<section class="panel team-status">
    <h3>팀 현황</h3>
    <div class="stats">
      <div class="stat"><div class="k">오늘 기록</div><div class="v">${loggedToday} / ${ps.length}</div></div>
      <div class="stat ${pending.length ? "hot" : ""}"><div class="k">승인 대기</div><div class="v">${pending.length}</div></div>
      <div class="stat ${watch.length ? "hot" : ""}"><div class="k">확인할 선수</div><div class="v">${watch.length}</div></div>
    </div>
    ${pending.length ? `<button class="btn link" type="button" data-act="view" data-v="intake">승인하러 가기 →</button>` : ""}
    ${watch.length ? `<ul class="watch">${watch.map(({ p, why }) => `<li><button type="button" class="btn link" data-act="open" data-pid="${esc(p.id)}">${esc(p.name)}</button>${chipsHtml(why)}</li>`).join("")}</ul>` : ""}
  </section>`;
}

/* ---------- 프로그램 ---------- */
function blockHtml(b) {
  return `<section class="blk b-${esc(b.key)}"><h4>${esc(b.title)}</h4><ul class="rows">${b.items.map(x => {
    const tap = exGuide(x.name) || exSeconds(x.rx);
    return `<li${tap ? ` class="tap" data-act="ex" data-n="${esc(x.name)}" data-r="${esc(x.rx ?? "")}" data-c="${esc(x.cue || "")}" role="button" tabindex="0"` : ""}>
    <div class="nm">${esc(x.name)}${x.mod ? ` <span class="mod">${esc(x.mod)}</span>` : ""}</div><div class="rx">${esc(fmtRx(x.rx))}</div></li>`; }).join("")}</ul>
    ${b.note ? `<p class="bnote">${esc(b.note).replace(/\n/g, "<br>")}</p>` : ""}</section>`;
}
function viewPlan() {
  if (state.admin && state.pid === "__team") return viewTeamPlan();
  const pid = viewPid();
  if (!pid) return state.admin ? `<div class="panel empty"><strong>등록된 선수가 없어요</strong><button class="btn primary" data-act="view" data-v="intake">선수 등록하기</button></div>`
    : `<div class="panel empty"><strong>계정이 선수와 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`;
  const p = playerOf(pid);
  const mon = selMon(), d = selDay(), date = dAdd(mon, d);
  const plan = planOn(p, date);
  const notes = [...plan.notes];
  return `
  <section class="sec">
    <div class="sec-head"><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2>${playerPicker(pid)}</div>
    ${weeksHtml(mon)}
    ${daysHtml(mon, d, x => planOn(p, x))}
  </section>
  <section class="sec">
    <div><h3 class="day-title">${longDate(parseD(date))} · ${esc(plan.title)}</h3>
      ${plan.landings ? `<p class="small muted">착지 약 ${plan.landings}회</p>` : ""}</div>
    ${notes.length ? `<ul class="notes callout">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${scopedBlocks(plan)}
  </section>
  ${ladderHtml(p)}`;
}
// 팀 세션(다 같이) / 개인(포지션 · 재활 · 예방)으로 나눠 보여 주기
// 비시즌은 '자율', 쉬는 날·대회 날은 나누지 않음
function scopedBlocks(plan, teamOnly) {
  const team = plan.blocks.filter(b => b.scope !== "me"), me = teamOnly ? [] : plan.blocks.filter(b => b.scope === "me");
  if (["rest", "recover", "match", "prep"].includes(plan.slot) && !me.length) return `<div class="blocks">${team.map(blockHtml).join("")}</div>`;
  const teamH = plan.optional ? `자율 <span class="small muted">비시즌 · 각자 선택</span>` : `팀 세션 <span class="small muted">다 같이</span>`;
  return `<h3 class="scope-h">${teamH}</h3><div class="blocks">${team.map(blockHtml).join("")}</div>
    ${teamOnly ? "" : `<h3 class="scope-h me">개인 <span class="small muted">나만 · 포지션 · 부상 이력 · 재활</span></h3>
    ${me.length ? `<div class="blocks">${me.map(blockHtml).join("")}</div>` : `<p class="small muted">오늘은 개인 운동이 없어요.</p>`}`}`;
}
function viewTeamPlan() {
  const mon = selMon(), d = selDay(), date = dAdd(mon, d);
  const plan = teamPlanOn(date);
  const ps = sortedPlayers();
  // 이날 개인 블록이 있는 선수 (관리자 확인용)
  const extra = ps.map(p => ({ p, b: planOn(p, date).blocks.filter(b => b.scope === "me") })).filter(x => x.b.length);
  return `
  <section class="sec">
    <div class="sec-head"><h2>팀 세션</h2>${playerPicker("__team")}</div>
    ${weeksHtml(mon)}
    ${daysHtml(mon, d, teamPlanOn)}
  </section>
  <section class="sec">
    <div><h3 class="day-title">${longDate(parseD(date))} · ${esc(plan.title)}</h3></div>
    ${scopedBlocks(plan, true)}
    ${extra.length ? `<h3 class="scope-h me">개인 블록이 있는 선수</h3><ul class="watch">${extra.map(({ p, b }) => `<li><button type="button" class="btn link" data-act="open" data-pid="${esc(p.id)}">${esc(p.name)}</button>${chipsHtml(b.map(x => ["", x.title.replace(/ \(.*\)$/, "")]))}</li>`).join("")}</ul>` : ""}
  </section>`;
}
function ladderHtml(p) {
  const mods = modsFor(p);
  if (!mods.length) return "";
  const h = state.health[p.id] || {};
  return `<section class="sec"><h3>통증 단계 <span class="private">본인·관리자만</span></h3>
    <p class="small muted">계속 아프면 진료가 먼저예요.${mods.some(m => m.inferred) ? " ? = 통증 기록으로 정한 단계." : ""}</p>
    ${mods.map(m => {
      const def = REHAB[m.area], note = ((h.rehab || []).find(x => x.area === m.area) || {}).note;
      return `<details class="panel ladder" data-keep="ladder-${m.area}" ${keepOpen("ladder-" + m.area, false)}><summary><b>${esc(painLabel(m))}${m.inferred ? "?" : ""}</b>${m.fromCheck ? ' <span class="chip warn">최근 통증 체크 기준</span>' : ""} · ${esc(def.pain[m.stage - 1])}${note ? ` <span class="muted">(${esc(note)})</span>` : ""}</summary>
        <ol class="stages">${def.stages.map((s, i) => `<li class="${i + 1 === m.stage ? "cur" : ""}"><b>${i + 1}단계 ${STAGE_NAMES[i]} · ${esc(def.pain[i])}</b>
          <span class="small">${s.items.map(x => esc(x.name) + " " + esc(fmtRx(x.rx))).join(" · ")}</span>
          ${i + 1 < def.stages.length ? `<span class="small muted">다음 단계: ${esc(s.next)}</span>` : ""}</li>`).join("")}</ol>
        ${def.always ? `<p class="small">항상: ${esc(def.always)}</p>` : ""}</details>`;
    }).join("")}</section>`;
}

/* ---------- 기록 (세션 · 측정 · 인바디) ---------- */
function viewRec() {
  const pid = viewPid();
  if (!pid) return viewPlan();
  const p = playerOf(pid);
  return `<section class="sec"><div class="sec-head"><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2>${playerPicker(pid)}</div></section>
  <div class="cols">
    <div class="col">${logHtml(p)}<section class="sec"><h3>통증 기록 <span class="private">본인·관리자만</span></h3>${painCheckForm(p, "rec")}${painCheckList(p)}</section></div>
    <div class="col">${coreHtml(p)}${testsHtml(p)}${inbodyHtml(p)}</div>
  </div>`;
}
function logHtml(p) {
  const canLog = state.admin || (state.role === "player" && p.id === state.myPid);
  const tplan = planOn(p, iso(today())), defType = tplan.logType;
  const entries = logsOf(p.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  return `<section class="sec"><h3>세션 기록</h3>
    ${canLog ? `<form class="f panel" id="logForm" data-pid="${esc(p.id)}">
      <div class="fields">
        <label class="fl">날짜<input type="date" id="lg-date" value="${iso(today())}" required></label>
        <label class="fl">종류<select id="lg-type">${Object.entries(LOG_TYPES).map(([k, [l]]) => `<option value="${k}" ${k === defType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fl">시간 (분)<input type="number" id="lg-min" inputmode="numeric" min="1" max="400" value="${tplan.minutes}" required></label>
        <label class="fl">힘든 정도 (RPE)<select id="lg-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 5 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fl">점프·착지 수<input type="number" id="lg-jumps" inputmode="numeric" min="0" max="2000" value="${tplan.landings || ""}" placeholder="모르면 비우기"></label>
        <label class="fl wide">메모<input type="text" id="lg-note" maxlength="200" placeholder="무게, 컨디션, 손목·손가락 통증 등"></label>
      </div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form>` : ""}
    ${entries.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>종류</th><th>RPE×분</th><th>착지</th><th>통증</th>${state.admin ? "<th></th>" : ""}</tr></thead><tbody>
      ${entries.map(e => `<tr><td class="num">${md(parseD(e.date))}</td><td>${esc((LOG_TYPES[e.type] || ["기타"])[0])}</td><td class="num">${Number(e.rpe) * Number(e.minutes)}</td><td class="num">${e.jumps ?? "—"}</td><td>${e.painArea ? `<span class="chip ${Number(e.pain) >= 3 ? "crit" : ""}">${esc(AREA_KO[e.painArea] || "")} ${esc(e.pain)}</span>` : "—"}</td>
      ${state.admin ? `<td><button class="btn link danger" data-act="dellog" data-id="${esc(e._id)}">삭제</button></td>` : ""}</tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
  </section>`;
}
function testsHtml(p) {
  const r = runs(p.id).filter(isMainTest);
  const ib = inbodyOf(p.id).filter(x => x.weight != null).at(-1);
  const rel = relStrength(latest(p.id), ib ? ib.weight : p.weight);
  const above = v => v == null || v === "" ? "—" : ((Number(v) - NET >= 0 ? "+" : "") + (Number(v) - NET));
  return `<section class="sec"><h3>측정</h3>
    ${r.length ? `${rel != null ? `<p class="small muted">상대 근력 <b>${rel.toFixed(2)}</b></p>` : ""}
    <div class="tw"><table><thead><tr><th>날짜</th><th>맥스 버티컬</th><th>버티컬 점프</th><th>스파이크 네트 위</th><th>블로킹 네트 위</th><th>CMJ</th><th>한 발 서기</th><th>스쿼트</th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${maxVertOf(t) ?? "—"}</td><td class="num">${vertOf(t) ?? "—"}</td><td class="num">${above(t.approach)}</td><td class="num">${above(t.block)}</td><td class="num">${t.cmj ?? "—"}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td class="num">${t.squat ?? "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="small muted">버티컬 점프 = 블로킹 높이 − 스탠딩 리치 · 맥스 버티컬 = 스파이크 높이 − 스탠딩 리치 (cm)</p>` : emptyLine(state.admin ? "측정값은 ‘등록·측정’에서 넣어요." : "측정 후 나와요.")}
  </section>`;
}
const bal = v => v === true ? "○" : v === false ? "×" : "—";
function canEditSelf(p) { return state.admin || (state.role === "player" && p.id === state.myPid); }
function painCheckForm(p, where) {
  if (!canEditSelf(p)) return "";
  const key = "pain-" + where, open = where === "rec" || modsFor(p).length > 0;
  return `<details class="pcheck" data-keep="${key}" ${keepOpen(key, open)}><summary><b>통증 체크</b> <span class="small muted">다음 날 아픈 것도</span></summary>
    <form class="f" id="painForm" data-pid="${esc(p.id)}" data-where="${where}">
      <div class="fields">
        <label class="fl">날짜<input type="date" id="pc-date-${where}" value="${iso(today())}" required></label>
        <label class="fl">부위<select id="pc-area-${where}">${PAIN_AREAS.map(a => `<option value="${a}">${AREA_KO[a]}</option>`).join("")}</select></label>
        ${levelSelect("pc-d-" + where, 0, "운동할 때 (어제·오늘)")}
        ${levelSelect("pc-m-" + where, 0, "오늘 아침")}
      </div>
      <label class="check"><input type="checkbox" id="pc-r-${where}"> 쉴 때·밤에도 아파요</label>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form></details>`;
}
function painCheckList(p) {
  const list = checksOf(p.id).slice().reverse().slice(0, 8);
  if (!list.length) return emptyLine("아직 통증 기록이 없어요.");
  const lv = v => v == null ? "—" : PAIN_LEVELS.find(([x]) => x === painBucket(v))[1];
  return `<div class="tw"><table><thead><tr><th>날짜</th><th>부위</th><th>운동할 때</th><th>아침</th><th>단계</th><th></th></tr></thead><tbody>
    ${list.map(c => { const st = painStage({ d: c.during, m: c.morning, r: c.rest }); return `<tr><td class="num">${md(parseD(c.date))}</td><td>${esc(AREA_KO[c.area])}</td><td>${lv(c.during)}</td><td>${lv(c.morning)}${c.rest ? ' <span class="chip crit">쉴 때도</span>' : ""}</td>
      <td>${st ? `<span class="chip ${st === 1 ? "crit" : st === 2 ? "warn" : ""}">${st}단계</span>` : "없음"}</td>
      <td><button class="btn link danger" type="button" data-act="delpain" data-id="${esc(c.id)}">삭제</button></td></tr>`; }).join("")}
  </tbody></table></div>`;
}
function coreHtml(p) {
  const all = runs(p.id).filter(isCoreHs), r = coreRuns(p.id), canAdd = canEditSelf(p);
  const first = r[0];
  const delta = (t, k) => !first || first === t || t[k] == null || first[k] == null ? "" : (() => { const v = Number(t[k]) - Number(first[k]); return ` <small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; })();
  const cell = (t, k) => t[k] == null ? "—" : t[k] + delta(t, k);
  return `<section class="sec"><h3>코어·물구나무 테스트 <span class="small muted">버틴 시간 (초)</span></h3>
    ${all.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>사이드 왼</th><th>사이드 오른</th><th>풀 플랭크</th><th>합계</th><th>물구나무</th><th></th></tr></thead><tbody>
      ${all.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${cell(t, "sideL")}</td><td class="num">${cell(t, "sideR")}</td><td class="num">${cell(t, "plank")}</td>
        <td class="num">${coreSum(t) != null ? `<b>${coreSum(t)}</b>${first && first !== t ? ` <small class="${coreSum(t) - coreSum(first) < 0 ? "neg" : ""}">${coreSum(t) - coreSum(first) > 0 ? "+" : ""}${coreSum(t) - coreSum(first)}</small>` : ""}` : "—"}</td>
        <td>${hsText(t)}</td>
        <td>${state.admin || t.author === state.session.user.id ? `<button class="btn link danger" type="button" data-act="deltest" data-id="${esc(t.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
    ${canAdd ? `<details class="panel" data-keep="core-form" ${keepOpen("core-form", !all.length)}><summary><b>코어·물구나무 입력</b> <span class="small muted">잰 것만</span></summary>
      <form class="f" id="coreForm" data-pid="${esc(p.id)}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="ct-date" value="${iso(today())}" required></label>
          <label class="fl">사이드 플랭크 왼 (초)<input type="number" id="ct-sl" inputmode="numeric" min="0" max="600"></label>
          <label class="fl">사이드 플랭크 오른 (초)<input type="number" id="ct-sr" inputmode="numeric" min="0" max="600"></label>
          <label class="fl">풀 플랭크 (초)<input type="number" id="ct-pl" inputmode="numeric" min="0" max="900"></label>
          ${hsStageSelect("ct-hs")}
          <label class="fl">물구나무 걷기 (m)<input type="number" id="ct-walk" inputmode="decimal" min="0" max="100" step="0.5" placeholder="5단계만"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">저장</button></div>
      </form></details>` : ""}
  </section>`;
}
const hsStageSelect = id => `<label class="fl">물구나무 단계<select id="${id}"><option value="">—</option>${HS_STAGES.slice(1).map((n, i) => `<option value="${i + 1}">${i + 1} ${n}</option>`).join("")}</select></label>`;
function inbodyHtml(p) {
  const list = inbodyOf(p.id);
  const canAdd = state.admin || (state.role === "player" && p.id === state.myPid);
  const diff = (a, b, k) => a[k] == null || !b || b[k] == null ? "" : (() => { const v = Number(a[k]) - Number(b[k]); return ` <small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}</small>`; })();
  const rows = list.slice().reverse().map((x, i, arr) => {
    const prev = arr[i + 1];
    const gap = x.legL && x.legR ? Math.abs(x.legL - x.legR) / Math.max(x.legL, x.legR) * 100 : null;
    return `<tr><td class="num">${md(parseD(x.date))}${x.standardized ? "" : ' <span class="chip" title="아침 공복·운동 전이 아님">조건 다름</span>'}</td>
      <td class="num">${x.weight ?? "—"}${diff(x, prev, "weight")}</td><td class="num">${x.smm ?? "—"}${diff(x, prev, "smm")}</td><td class="num">${x.pbf ?? "—"}</td>
      <td class="num">${x.legL ?? "—"} / ${x.legR ?? "—"}${gap != null && gap >= 10 ? ' <span class="chip warn">차이 10%↑</span>' : ""}</td>
      <td>${canAdd ? `<button class="btn link danger" type="button" data-act="delinbody" data-id="${esc(x.id)}">삭제</button>` : ""}</td></tr>`;
  }).join("");
  return `<section class="sec"><h3>인바디 <span class="private">본인·관리자만</span></h3>
    ${rows ? `<div class="tw"><table><thead><tr><th>날짜</th><th>체중</th><th>골격근</th><th>체지방률</th><th>다리 L/R</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
    ${canAdd ? `<details class="panel" data-keep="inbody-form" ${keepOpen("inbody-form", !rows)}><summary><b>인바디 입력</b> <span class="small muted">아침 공복 · 운동 전 · 같은 기기</span></summary>
    <form class="f" id="inbodyForm" data-pid="${esc(p.id)}">
      <div class="fields">
        <label class="fl">측정일<input type="date" id="ib-date" value="${iso(today())}" required></label>
        <label class="fl">체중 (kg)<input type="number" id="ib-weight" inputmode="decimal" step="0.1" min="30" max="200" required></label>
        <label class="fl">골격근량 (kg)<input type="number" id="ib-smm" inputmode="decimal" step="0.1" min="10" max="80"></label>
        <label class="fl">체지방량 (kg)<input type="number" id="ib-fat" inputmode="decimal" step="0.1" min="0" max="100"></label>
        <label class="fl">체지방률 (%)<input type="number" id="ib-pbf" inputmode="decimal" step="0.1" min="1" max="60"></label>
        <label class="fl">왼다리 근육 (kg)<input type="number" id="ib-legl" inputmode="decimal" step="0.01" min="1" max="30"></label>
        <label class="fl">오른다리 근육 (kg)<input type="number" id="ib-legr" inputmode="decimal" step="0.01" min="1" max="30"></label>
        <label class="fl">메모<input id="ib-note" maxlength="100" placeholder="기기·장소"></label>
      </div>
      <label class="check"><input type="checkbox" id="ib-std" checked> 아침 공복 · 운동 전에 쟀어요</label>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form></details>` : ""}
  </section>`;
}

/* ---------- 로그인 · 승인 대기 · 가입 정보 ---------- */
function viewAuth() {
  const login = state.authMode === "login";
  return `<section class="auth">
    <div class="auth-hero">
      <img class="logo logo-light" src="logo.png?v=4" alt="서울대학교 배구부 엠블럼" width="130" height="128">
      <img class="logo logo-dark" src="logo-white.png?v=4" alt="서울대학교 배구부 엠블럼" width="130" height="128">
      <h2>SNUVT <b>Physical</b></h2>
      <p>서울대학교 배구부 피지컬 트레이닝</p>
    </div>
    <form class="f panel" id="authForm">
      <div><h3>${login ? "로그인" : "가입하기"}</h3><p class="small muted">${login ? "가입 → 내 정보 입력 → 관리자 승인 순서예요." : "가입하면 바로 내 정보 입력으로 넘어가요."}</p></div>
      <label class="fl">이메일<input type="email" id="au-email" autocomplete="email" required></label>
      <label class="fl">비밀번호 (6자 이상)<input type="password" id="au-pw" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required></label>
      <div class="row"><button class="btn primary" type="submit">${login ? "로그인" : "가입하기"}</button>
        <button class="btn link" type="button" data-act="authmode">${login ? "처음이면 가입하기" : "계정이 있으면 로그인"}</button></div>
      ${state.authMsg ? `<p class="msg ${state.authErr ? "err" : ""}">${esc(state.authMsg)}</p>` : ""}
    </form>
  </section>`;
}
function viewPending() {
  if (!state.myPid || state.editingSelf) return viewSelfReg();
  const p = state.selfPlayer || {};
  return `<section class="auth"><div class="panel empty"><strong>관리자 승인을 기다리고 있어요</strong>
    <span>${esc(p.name || "")}${p.pos ? " · " + esc(POS[p.pos] || p.pos) : ""} 정보를 냈어요.</span>
    <div class="row center"><button class="btn primary" type="button" data-act="refresh">승인됐는지 확인</button><button class="btn" type="button" data-act="editself">정보 수정</button></div></div></section>`;
}
function viewSelfReg() {
  const p = state.selfPlayer || {}, h = state.selfHealth || {}, pain = h.pain || {};
  const opt = (v, cur, l) => `<option value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${l}</option>`;
  return `<section class="sec narrow">
    <div><h2>내 정보</h2><p class="lede">${state.role === "pending" ? "프로그램을 내 몸에 맞추는 데 써요. 제출하면 관리자가 승인해요." : state.admin ? "관리자 계정에 연결할 내 선수 정보예요." : "승인은 됐어요. 내 정보를 입력하면 프로그램이 열려요."}</p></div>
    <form class="f panel" id="selfForm">
      <fieldset><legend>기본 정보</legend>
        <div class="fields">
          <label class="fl">이름<input id="sf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
          <label class="fl">포지션<select id="sf-pos" required><option value="">고르기</option>${POS_ORDER.map(k => opt(k, p.pos, `${POS[k]} (${k})`)).join("")}</select></label>
          <label class="fl">학년<input id="sf-year" maxlength="10" placeholder="예: 3학년" value="${esc(p.year || "")}"></label>
          <label class="fl">키 (cm)<input id="sf-height" type="number" inputmode="decimal" min="140" max="220" step="0.1" value="${esc(p.height ?? "")}"></label>
          <label class="fl">몸무게 (kg)<input id="sf-weight" type="number" inputmode="decimal" min="40" max="150" step="0.1" value="${esc(p.weight ?? "")}"></label>
          <label class="fl">배구 경력 (년)<input id="sf-exp" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="${esc(p.exp ?? "")}"></label>
          ${wexpSelect("sf-wexp", p.weightExp, true)}
        </div>
      </fieldset>
      <fieldset><legend>부상·통증 <span class="private">본인·관리자만</span></legend>
        <h4 class="sub-h">지금 아픈 곳</h4>
        <p class="small muted">운동할 때와 다음 날 아침을 따로 골라요.</p>
        ${painRows("sf", pain)}
        ${STAGE_KEY()}
        <h4 class="sub-h">부상 이력</h4>
        ${injuryEditor("sf", h.injuries)}
        <div class="fields">
          <label class="fl">발목 다친 횟수 (왼)<input id="sf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
          <label class="fl">발목 다친 횟수 (오른)<input id="sf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
          <label class="fl wide">기타 알려줄 것 (선택)<input id="sf-note" maxlength="200" value="${esc(h.note || "")}"></label>
        </div>
        <label class="check"><input type="checkbox" id="sf-consent" ${h.consent ? "checked" : ""}> 트레이닝 프로그램에만 쓰는 데 동의해요</label>
      </fieldset>
      <div class="row"><button class="btn primary" type="submit">${state.myPid ? "수정 내용 내기" : state.role === "pending" ? "제출" : "저장"}</button>
        ${state.editingSelf ? '<button class="btn" type="button" data-act="canceledit">취소</button>' : ""}</div>
    </form>
  </section>`;
}

/* ---------- 등록·측정 (관리자) ---------- */
function membersHtml() {
  const ps = sortedPlayers();
  const list = state.profiles.slice().sort((a, b) => (a.role === "pending" ? -1 : 0) - (b.role === "pending" ? -1 : 0));
  if (!list.length) return "";
  const roleOpt = (v, cur, l) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`;
  const nameOf = m => (m.player_id && state.players[m.player_id] && state.players[m.player_id].name) || "";
  return `<details class="sec members" data-keep="members" ${keepOpen("members", list.some(m => m.role === "pending"))}><summary><h3>팀원 계정 <span class="muted small">${list.length}명${list.some(m => m.role === "pending") ? ` · 대기 ${list.filter(m => m.role === "pending").length}` : ""}</span></h3></summary>
    <div class="tw"><table><thead><tr><th>이름</th><th>역할</th><th></th></tr></thead><tbody>
    ${list.map(m => `<tr><td>${nameOf(m) ? `<b>${esc(nameOf(m))}</b>` : `<span class="muted">정보 없음</span>`}<br><span class="small muted">${esc(m.email || "")}</span>${m.role === "pending" ? ' <span class="chip warn">대기</span>' : ""}</td>
      <td><select id="mr-${esc(m.id)}" aria-label="역할" ${m.id === state.session.user.id ? "disabled" : ""}>${roleOpt("pending", m.role, "대기")}${roleOpt("player", m.role, "선수")}${roleOpt("coach", m.role, "관리자")}</select></td>
      <td>${m.id === state.session.user.id ? '<span class="small muted">나</span>' : `<div class="row nowrap">
        <button class="btn" type="button" data-act="savemember" data-id="${esc(m.id)}">저장</button>
        <button class="btn danger" type="button" data-act="delmember" data-id="${esc(m.id)}">삭제</button></div>`}</td></tr>`).join("")}
    </tbody></table></div></details>`;
}
function viewIntake() {
  if (!state.admin) return `<div class="panel empty"><strong>관리자 전용이에요</strong></div>`;
  const ps = sortedPlayers();
  const isNew = state.editPid === "__new" || !ps.length;
  const pid = isNew ? null : (state.editPid && state.players[state.editPid] ? state.editPid : ps[0].id);
  const p = pid ? { id: pid, ...state.players[pid] } : {};
  const h = (pid && state.health[pid]) || {};
  const pain = h.pain || {};
  const rehab = h.rehab || [];
  const list = `<div class="plist">${ps.map(x => `<button type="button" data-act="edit" data-pid="${esc(x.id)}" aria-pressed="${x.id === pid}"><span>${esc(x.name)}</span><span class="chip pos">${esc(x.pos)}</span></button>`).join("")}
    <button type="button" data-act="edit" data-pid="__new" aria-pressed="${isNew}"><span>+ 새 선수</span></button></div>`;
  const opt = (v, cur) => `value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}`;
  const rehabRows = REHAB_AREAS.map(a => {
    const cur = rehab.find(m => m.area === a) || {};
    return `<div class="rh-row"><span class="rh-lab">${esc(REHAB[a].label)}</span>
      <select id="rh-${a}" aria-label="${esc(REHAB[a].label)} 통증 단계"><option value="">없음</option>${REHAB[a].pain.map((t, i) => `<option value="${i + 1}" ${Number(cur.stage) === i + 1 ? "selected" : ""}>${i + 1} ${STAGE_NAMES[i]} · ${esc(t)}</option>`).join("")}</select>
      <input id="rhn-${a}" maxlength="60" placeholder="메모 (예: 오른쪽, 10/20 진단)" value="${esc(cur.note || "")}" aria-label="${esc(REHAB[a].label)} 메모"></div>`;
  }).join("");
  return `<section class="sec"><h2>등록·측정</h2></section>
  ${membersHtml()}
  <section class="side">
    <div class="panel">${list}</div>
    <div class="sec">
      <form class="f panel" id="playerForm" data-pid="${esc(pid || "")}">
        <fieldset><legend>기본 정보</legend>
          <div class="fields">
            <label class="fl">이름<input id="pf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
            <label class="fl">포지션<select id="pf-pos" required>${POS_ORDER.map(k => `<option ${opt(k, p.pos)}>${k}</option>`).join("")}</select></label>
            <label class="fl">학년<input id="pf-year" maxlength="10" placeholder="예: 3학년" value="${esc(p.year || "")}"></label>
            <label class="fl">키 (cm)<input id="pf-height" type="number" inputmode="decimal" min="140" max="220" step="0.1" value="${esc(p.height ?? "")}"></label>
            <label class="fl">몸무게 (kg)<input id="pf-weight" type="number" inputmode="decimal" min="40" max="150" step="0.1" value="${esc(p.weight ?? "")}"></label>
            <label class="fl">배구 경력 (년)<input id="pf-exp" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="${esc(p.exp ?? "")}"></label>
            ${wexpSelect("pf-wexp", p.weightExp, false)}
          </div>
        </fieldset>
        <fieldset><legend>통증 단계 <span class="private">본인·관리자만</span></legend>
          <p class="small stage-key">${STAGE_NAMES.map((n, i) => `<span><b>${i + 1} ${n}</b> ${STAGE_HINT[i]}</span>`).join("")}</p>
          <div class="rh">${rehabRows}</div>
        </fieldset>
        <details class="panel inner" data-keep="intake-pain" ${keepOpen("intake-pain", false)}><summary><b>통증 · 부상 이력</b>${(h.injuries || []).length ? ` <span class="small muted">${esc(h.injuries.map(injText).join(", "))}</span>` : ""}</summary>
          <h4 class="sub-h">지금 아픈 곳</h4>
          ${painRows("hf", pain)}
          <h4 class="sub-h">부상 이력</h4>
          ${injuryEditor("hf", h.injuries)}
          <div class="fields">
            <label class="fl">발목 다친 횟수 (왼)<input id="hf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
            <label class="fl">발목 다친 횟수 (오른)<input id="hf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
            <label class="fl wide">기타<input id="hf-note" maxlength="200" value="${esc(h.note || "")}"></label>
          </div>
        </details>
        <label class="check"><input type="checkbox" id="hf-consent" ${h.consent ? "checked" : ""} required> 선수가 프로그램 목적의 정보 사용에 동의함</label>
        <div class="row"><button class="btn primary" type="submit">${pid ? "저장" : "선수 추가"}</button>
          ${pid ? `<button class="btn danger" type="button" data-act="delplayer" data-pid="${esc(pid)}">선수 삭제</button>` : ""}</div>
      </form>
      ${pid ? testFormHtml(pid) : ""}
    </div>
  </section>`;
}
function testFormHtml(pid) {
  const r = runs(pid);
  return `<form class="f panel" id="testForm" data-pid="${esc(pid)}">
    <h3>측정값 추가</h3>
    <div class="fields">
      <label class="fl">날짜<input type="date" id="tf-date" value="${iso(today())}" required></label>
      <label class="fl">스탠딩 리치 (cm)<input type="number" id="tf-reach" inputmode="decimal" step="0.5"></label>
      <label class="fl">블로킹 높이 (cm) · 제자리 점프<input type="number" id="tf-block" inputmode="decimal" step="0.5"></label>
      <label class="fl">스파이크 높이 (cm) · 도움닫기<input type="number" id="tf-approach" inputmode="decimal" step="0.5"></label>
      <label class="fl">CMJ (cm) · 팔 없이, 앱<input type="number" id="tf-cmj" inputmode="decimal" step="0.1"></label>
      <label class="fl">한 발 서기 왼<select id="tf-balL"><option value="">—</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      <label class="fl">한 발 서기 오른<select id="tf-balR"><option value="">—</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      ${hsStageSelect("tf-hsStage")}
      <label class="fl">물구나무 버티기 (초)<input type="number" id="tf-hsSec" inputmode="numeric" min="0" max="120"></label>
      <label class="fl">물구나무 걷기 (m)<input type="number" id="tf-hsWalk" inputmode="decimal" min="0" max="100" step="0.5"></label>
      <label class="fl">스쿼트 5RM (kg)<input type="number" id="tf-squat" inputmode="decimal" step="2.5"></label>
      <label class="fl">RDL 5RM (kg)<input type="number" id="tf-rdl" inputmode="decimal" step="2.5"></label>
      <label class="fl">턱걸이 (회)<input type="number" id="tf-pull" inputmode="numeric" min="0" max="50"></label>
      <label class="fl">사이드 플랭크 왼 (초)<input type="number" id="tf-sl" inputmode="numeric" min="0" max="600"></label>
      <label class="fl">사이드 플랭크 오른 (초)<input type="number" id="tf-sr" inputmode="numeric" min="0" max="600"></label>
      <label class="fl">풀 플랭크 (초)<input type="number" id="tf-pl" inputmode="numeric" min="0" max="900"></label>
    </div>
    <div class="row"><button class="btn primary" type="submit">측정값 저장</button></div>
    ${r.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>리치</th><th>블로킹</th><th>스파이크</th><th>맥스 버티컬</th><th>CMJ</th><th>균형</th><th>물구나무</th><th>스쿼트</th><th>RDL</th><th>턱걸이</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${t.reach ?? "—"}</td><td class="num">${t.block ?? "—"}</td><td class="num">${t.approach ?? "—"}</td><td class="num">${maxVertOf(t) ?? "—"}</td><td class="num">${t.cmj ?? "—"}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td>${hsText(t)}${t.hsSec ? " · " + esc(t.hsSec) + "초" : ""}</td><td class="num">${t.squat ?? "—"}</td><td class="num">${t.rdl ?? "—"}</td><td class="num">${t.pull ?? "—"}</td>
    <td><button class="btn link danger" type="button" data-act="deltest" data-id="${esc(t.id)}">삭제</button></td></tr>`).join("")}
    </tbody></table></div>` : ""}
  </form>`;
}

/* ---------- 훈련 부하 (관리자) ---------- */
function viewLoad() {
  if (!state.admin) return `<div class="panel empty"><strong>관리자 전용이에요</strong></div>`;
  const ps = sortedPlayers();
  const mons = [-5, -4, -3, -2, -1, 0].map(k => dAdd(thisMon(), 7 * k));
  const rows = ps.map(p => {
    const agg = {};
    for (const e of logsOf(p.id)) {
      const k = mondayOf(e.date);
      agg[k] = agg[k] || { s: 0, j: 0, n: 0 };
      agg[k].s += (Number(e.rpe) || 0) * (Number(e.minutes) || 0);
      agg[k].j += Number(e.jumps) || 0;
      agg[k].n += 1;
    }
    const cells = mons.map(m => {
      const a = agg[m], prev = agg[dAdd(m, -7)];
      if (!a) return `<td class="muted">—</td>`;
      const spike = prev && ((prev.s > 0 && a.s >= 2 * prev.s) || (prev.j > 0 && a.j >= 2 * prev.j));
      return `<td class="num ${spike ? "cell-warn" : ""}">${a.s.toLocaleString("ko-KR")}<br><span class="small">${a.j}회 · ${a.n}건</span>${spike ? ' <span class="chip warn">2배↑</span>' : ""}</td>`;
    }).join("");
    return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td>${cells}</tr>`;
  }).join("");
  return `<section class="sec"><div><h2>훈련 부하</h2><p class="lede">주간 RPE×분 합(AU)과 착지 수. 전주보다 2배 넘게 늘면 표시해요.</p></div>
  ${ps.length ? `<div class="tw"><table><thead><tr><th>선수</th>${mons.map(m => `<th>${md(parseD(m))}주${m === thisMon() ? " <span class=\"muted\">이번 주</span>" : ""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyLine("선수를 먼저 등록해 주세요.")}
  </section>`;
}

/* ---------- 일정 (1년: 3월 → 다음 해 2월) ---------- */
function viewSeason() {
  const t = iso(today()), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  const sy = m >= 3 ? y : y - 1, from = `${sy}-03-01`, to = `${sy + 1}-02-28`;
  const evs = normEvents(events());
  const list = evs.filter(e => e.end >= from || e.end >= t);
  const range = e => e.start === e.end ? longDate(parseD(e.start)) : `${md(parseD(e.start))} – ${md(parseD(e.end))}`;
  // 앞으로 16주 흐름
  const weeks = Array.from({ length: 16 }, (_, k) => dAdd(thisMon(), 7 * k)).map(mon => {
    const infos = DAYS.map((_, d) => infoOn(dAdd(mon, d)));
    const i = infos[3], tag = infos.some(x => x.slot === "match") ? "cup" : infos.every(x => x.optional) ? "opt" : i.w === 0 ? "test" : "";
    const note = infos.some(x => x.slot === "match") ? "" : infos.every(x => x.optional) ? "" : i.w === 0 ? "측정·가볍게" : "";
    return `<li class="${tag}"><span class="num">${md(parseD(mon))}</span><span>${esc(weekLabel(mon))}${note ? ` <span class="chip">${note}</span>` : ""}</span></li>`;
  }).join("");
  return `<section class="sec"><div><h2>일정 <span class="small muted">${sy}.3 – ${sy + 1}.2</span></h2>
    <p class="lede">일정에 맞춰 프로그램이 자동으로 바뀌어요.</p></div>
    <ul class="plain small rules">
      <li><b>1학기</b> (3–8월) 정규 훈련 월·목 · <b>2학기</b> (9–2월) 수·금 — 요일 배치가 따라 바뀜</li>
      <li><b>주요 대회</b> 대회 날에 맞춰 측정 → 쌓기 → 최대 → 대회 주(양 절반)로 거꾸로 맞춤</li>
      <li><b>9인제·기타 대회</b> 그 주만 컨디셔닝 주간, 끝나면 원래 흐름</li>
      <li><b>비시즌·방학</b> 첫 주 회복, 그다음 자율 프로그램</li>
    </ul></section>
  <div class="cols">
    <div class="col"><section class="sec"><h3>대회·일정</h3>
      ${list.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>이름</th><th>종류</th>${state.admin ? "<th></th>" : ""}</tr></thead><tbody>
      ${list.map(e => `<tr class="${e.end < t ? "past" : ""}"><td class="num">${range(e)}</td><td><b>${esc(e.name)}</b>${e.note ? `<br><span class="small muted">${esc(e.note)}</span>` : ""}</td><td><span class="chip ${e.kind === "major" ? "warn" : ""}">${esc(EVENT_KINDS[e.kind] || e.kind)}</span></td>
        ${state.admin ? `<td>${e.id ? `<button class="btn link danger" type="button" data-act="delevent" data-id="${esc(e.id)}">삭제</button>` : ""}</td>` : ""}</tr>`).join("")}
      </tbody></table></div>` : emptyLine("등록된 일정이 없어요.")}
      ${state.admin ? `<form class="f panel" id="eventForm">
        <h4>일정 추가</h4>
        <div class="fields">
          <label class="fl">이름<input id="ev-name" required maxlength="40" placeholder="예: KUSF 중부 예선"></label>
          <label class="fl">종류<select id="ev-kind">${Object.entries(EVENT_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
          <label class="fl">시작<input type="date" id="ev-start" required></label>
          <label class="fl">끝 (하루면 비우기)<input type="date" id="ev-end"></label>
          <label class="fl wide">메모<input id="ev-note" maxlength="100" placeholder="예: 본선 진출 시에만"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">추가</button></div>
      </form>` : ""}
    </section></div>
    <div class="col"><section class="sec"><h3>앞으로 16주</h3><ul class="season-weeks">${weeks}</ul></section></div>
  </div>`;
}

/* ---------- 운동 설명 · 타이머 ---------- */
const timer = { total: 0, left: 0, running: false, startAt: 0, base: 0, h: null };
const fmtT = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.value = 0.2; o.start(); o.stop(a.currentTime + 0.5); } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
}
function timerDraw() {
  const el = document.getElementById("t-time"); if (!el) return;
  const v = timer.total ? timer.left : timer.base + (timer.running ? (Date.now() - timer.startAt) / 1000 : 0);
  el.textContent = fmtT(Math.max(0, timer.total ? Math.ceil(v) : Math.floor(v)));
  document.getElementById("t-go").textContent = timer.running ? "멈춤" : "시작";
  document.getElementById("t-mode").textContent = timer.total ? "카운트다운" : "스톱워치";
}
function timerTick() {
  if (!timer.running) return;
  if (timer.total) {
    timer.left = Math.max(0, timer.base - (Date.now() - timer.startAt) / 1000);
    if (timer.left <= 0) { timer.running = false; clearInterval(timer.h); beep(); }
  }
  timerDraw();
}
function timerToggle() {
  if (timer.running) { timer.base = timer.total ? timer.left : timer.base + (Date.now() - timer.startAt) / 1000; timer.running = false; clearInterval(timer.h); }
  else { if (timer.total && timer.left <= 0) timer.left = timer.total; timer.base = timer.total ? timer.left : timer.base; timer.startAt = Date.now(); timer.running = true; timer.h = setInterval(timerTick, 200); }
  timerDraw();
}
function timerSet(sec) { clearInterval(timer.h); Object.assign(timer, { total: sec, left: sec, running: false, base: 0 }); timerDraw(); }
function openSheet(name, rx, cue) {
  const steps = exGuide(name) || [], sec = exSeconds(rx);
  const presets = [...new Set([sec, 30, 60, 90, 180].filter(Boolean))];
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `
    <div class="row between"><h3>${esc(name)}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    ${rx ? `<p class="sheet-rx">${esc(fmtRx(rx))}</p>` : ""}
    ${steps.length ? `<ol class="sheet-steps">${steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
    ${cue ? `<p class="small muted">${esc(cue)}</p>` : ""}
    <div class="timer"><div class="t-time" id="t-time">0:00</div><div class="small muted" id="t-mode"></div>
      <div class="row center"><button class="btn primary" type="button" id="t-go" data-act="tgo">시작</button><button class="btn" type="button" data-act="treset">다시</button></div>
      <div class="row center chips-t">${presets.map(v => `<button class="btn chip-t" type="button" data-act="tset" data-s="${v}">${v >= 60 ? v / 60 + "분" : v + "초"}</button>`).join("")}<button class="btn chip-t" type="button" data-act="tset" data-s="0">스톱워치</button></div></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  timerSet(sec);
}
function closeSheet() { clearInterval(timer.h); timer.running = false; document.getElementById("sheet").hidden = true; document.body.classList.remove("noscroll"); }
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") closeSheet();
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.closest && ev.target.closest('li.tap')) { ev.preventDefault(); ev.target.closest("li.tap").click(); }
});

/* ---------- 렌더 ---------- */
function offlineHtml() {
  return `<div class="panel empty"><strong>팀 데이터에 연결하지 못했어요</strong><span>인터넷 연결을 확인하고 새로고침해 주세요.</span></div>`;
}
const needsSelfReg = () => state.session && state.role === "player" && !state.myPid && state.loaded;
function render() {
  header();
  if (state.dirty) return; // 입력 중인 폼은 덮어쓰지 않음
  let html;
  if (state.booting) html = `<div class="panel empty"><strong>불러오는 중</strong></div>`;
  else if (state.offline) html = offlineHtml();
  else if (!state.session) html = viewAuth();
  else if (!state.role || state.role === "pending") html = viewPending();
  else if (needsSelfReg() || (state.admin && state.editingSelf)) html = viewSelfReg();
  else {
    const v = state.view;
    html = v === "plan" ? viewPlan() : v === "rec" ? viewRec() : v === "season" ? viewSeason() : v === "intake" ? viewIntake() : v === "load" ? viewLoad() : viewHome();
  }
  document.getElementById("main").innerHTML = html;
}
function go(view) {
  state.view = view; state.dirty = false; state.armed = null;
  try { history.replaceState(null, "", "#" + view); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
let toastT;
function toast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800);
}
function failMsg(e) {
  const c = e && e.code;
  if (c === "42501") return "권한이 없어요.";
  if (c === "23514") return "입력값이 허용 범위를 벗어났어요.";
  return "저장하지 못했어요. 다시 시도해 주세요." + (e && e.message ? ` (${e.message})` : "");
}
const ok = r => { if (r.error) throw r.error; return r.data; };

/* ---------- 이벤트 ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]");
  if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act;
  if (act === "view") return go(b.dataset.v);
  if (act === "addinj") { document.getElementById(b.dataset.prefix + "-inj").insertAdjacentHTML("beforeend", injRowHtml()); state.dirty = true; return; }
  if (act === "delinj") { b.closest(".inj-row").remove(); state.dirty = true; return; }
  if (act === "ex") return openSheet(b.dataset.n, b.dataset.r, b.dataset.c);
  if (act === "sheetclose") return closeSheet();
  if (act === "tgo") return timerToggle();
  if (act === "treset") return timerSet(timer.total);
  if (act === "tset") return timerSet(Number(b.dataset.s));
  if (act === "week") { state.week = b.dataset.m; state.day = null; state.dirty = false; return render(); }
  if (act === "day") { state.day = Number(b.dataset.d); state.dirty = false; return render(); }
  if (act === "openday") { state.week = b.dataset.m; state.day = Number(b.dataset.d); state.pid = state.myPid; return go("plan"); }
  if (act === "open") { state.pid = b.dataset.pid; state.week = null; state.day = null; return go("plan"); }
  if (act === "edit") { state.editPid = b.dataset.pid; state.dirty = false; state.armed = null; return render(); }
  if (act === "authmode") { state.authMode = state.authMode === "login" ? "signup" : "login"; state.authMsg = ""; state.dirty = false; return render(); }
  if (act === "logout") { await sb.auth.signOut(); return; }
  if (act === "refresh") { await loadProfile(); if (state.role === "pending") toast("아직 승인 전이에요."); return; }
  if (act === "editself") { state.editingSelf = true; state.dirty = false; return render(); }
  if (act === "canceledit") { state.editingSelf = false; state.dirty = false; return render(); }
  if (act === "savemember") {
    const id = b.dataset.id;
    const role = document.getElementById("mr-" + id).value;
    try { ok(await sb.from("profiles").update({ role }).eq("id", id)); toast("저장했어요"); }
    catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
  if (act === "delmember") {
    const m = state.profiles.find(x => x.id === b.dataset.id) || {};
    const who = (m.player_id && state.players[m.player_id] && state.players[m.player_id].name) || m.email || "이 계정";
    if (!confirmDel(`${who} 계정을 삭제할까요?\n선수 정보와 측정·기록·부상·인바디가 모두 함께 지워져요.`)) return;
    // 이 계정에만 연결된 선수 정보를 먼저 지운다 (측정·기록 등은 cascade 로 함께 삭제) → 그다음 계정 삭제
    if (m.player_id && !state.profiles.some(o => o.id !== m.id && o.player_id === m.player_id)) {
      const d = await sb.from("players").delete().eq("id", m.player_id);
      if (d.error) { toast(failMsg(d.error)); state.dirty = false; return loadAll(); }
    }
    const r = await sb.rpc("remove_member", { target: b.dataset.id });
    if (r.error) toast(r.error.code === "PGRST202" ? "remove_member.sql 을 먼저 실행해 주세요." : (r.error.code === "42501" ? r.error.message : failMsg(r.error)));
    else toast("계정을 삭제했어요");
    state.dirty = false; return loadAll();
  }
  if (["delplayer", "deltest", "dellog", "delinbody", "delpain", "delevent"].includes(act)) {
    const msg = { delevent: "이 일정을 삭제할까요?\n프로그램이 바로 다시 맞춰져요.", delplayer: `${(state.players[b.dataset.pid] || {}).name || "이 선수"}를 삭제할까요?\n측정·기록·부상 정보도 함께 지워져요.`, deltest: "이 측정 기록을 삭제할까요?", dellog: "이 세션 기록을 삭제할까요?", delinbody: "이 인바디 기록을 삭제할까요?", delpain: "이 통증 기록을 삭제할까요?" }[act];
    if (!confirmDel(msg)) return;
    try {
      if (act === "delplayer") { ok(await sb.from("players").delete().eq("id", b.dataset.pid)); state.editPid = null; } // 부상·측정·기록도 함께 삭제됨
      else ok(await sb.from({ deltest: "tests", dellog: "logs", delinbody: "inbody", delpain: "pain_checks", delevent: "events" }[act]).delete().eq("id", b.dataset.id));
      toast("삭제했어요");
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
});
document.addEventListener("change", ev => {
  if (ev.target.classList.contains("inj-part")) {
    const t = ev.target.closest(".inj-row").querySelector(".inj-type");
    t.innerHTML = injTypes(ev.target.value).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    return;
  }
  if (ev.target.id === "pp-select") { state.pid = ev.target.value; state.dirty = false; render(); return; }
  if (ev.target.id === "lg-type") {
    const k = ev.target.value, m = document.getElementById("lg-min");
    if (m) m.value = LOG_TYPES[k][1];
  }
});
document.addEventListener("toggle", ev => { const d = ev.target; if (d && d.dataset && d.dataset.keep) state.openKeys[d.dataset.keep] = d.open; }, true);
document.addEventListener("input", ev => { const f = ev.target.closest("form.f"); if (f && f.id !== "authForm") state.dirty = true; });

const num = id => { const v = document.getElementById(id).value; return v === "" ? null : Number(v); };
const txt = id => document.getElementById(id).value.trim();

document.addEventListener("submit", async ev => {
  ev.preventDefault();
  const f = ev.target;
  if (!sb) return toast("서버에 연결되어 있지 않아요.");
  const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;

  if (f.id === "selfForm") {
    const info = {
      name: txt("sf-name"), pos: document.getElementById("sf-pos").value, year: txt("sf-year"),
      height: txt("sf-height"), weight: txt("sf-weight"), exp: txt("sf-exp"),
      weight_exp: document.getElementById("sf-wexp").value || null,
      ankle_l: txt("sf-al"), ankle_r: txt("sf-ar"), injuries: readInjuries("sf"),
      pain: readPain("sf"),
      note: txt("sf-note"), consent: document.getElementById("sf-consent").checked,
    };
    try {
      if (!info.consent) { toast("동의해야 제출할 수 있어요."); return; }
      const r = await sb.rpc("submit_my_info", { info });
      if (r.error) { toast(r.error.code === "23514" || r.error.code === "42501" ? r.error.message : failMsg(r.error)); return; }
      const wasPending = state.role === "pending";
      state.editingSelf = false; state.dirty = false;
      toast(wasPending ? "제출했어요. 승인을 기다려 주세요." : "저장했어요. 프로그램이 열렸어요.");
      await loadProfile();
    } finally { if (btn) btn.disabled = false; }
    return;
  }

  if (f.id === "authForm") {
    const email = txt("au-email"), password = document.getElementById("au-pw").value;
    try {
      if (state.authMode === "login") {
        const r = await sb.auth.signInWithPassword({ email, password });
        if (r.error) {
          const m = r.error.message || "";
          state.authErr = true;
          state.authMsg = /confirm/i.test(m) ? "가입 확인 메일의 링크를 먼저 눌러 주세요." : /invalid/i.test(m) ? "이메일이나 비밀번호가 맞지 않아요." : "로그인하지 못했어요: " + m;
        } else { state.authMsg = ""; }
      } else {
        const r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (r.error) { state.authErr = true; state.authMsg = "가입하지 못했어요: " + r.error.message; }
        else if (!r.data.session) { // 이메일 확인이 켜져 있으면 세션이 없다 → 바로 로그인 시도
          const li = await sb.auth.signInWithPassword({ email, password });
          state.authMode = "login"; state.authErr = !!li.error;
          state.authMsg = li.error ? "가입은 됐어요. 확인 메일의 링크를 누른 뒤 로그인해 주세요." : "";
        }
        else { state.authMsg = ""; }
      }
    } finally { if (btn) btn.disabled = false; }
    state.dirty = false; render(); return;
  }

  try {
    if (f.id === "playerForm") {
      const name = txt("pf-name");
      if (!name) { toast("이름을 입력해 주세요."); return; }
      if (!document.getElementById("hf-consent").checked) { toast("정보 사용 동의를 받은 뒤 저장해 주세요."); return; }
      const pain = readPain("hf"), mx = a => painMax(pain[a]);
      const ankleL = num("hf-al") || 0, ankleR = num("hf-ar") || 0, injuries = readInjuries("hf");
      const adjust = {
        plyo: mx("ankle") >= 3 ? "hold" : mx("knee") >= 3 ? "iso" : null,
        overhead: mx("shoulder") >= 3 ? true : null,
        back: mx("back") >= 3 ? true : null,
        ankleBal: (ankleL + ankleR) > 0 || injuries.some(x => x.part === "ankle") ? true : null,
        refer: PAIN_AREAS.some(a => mx(a) >= 3) ? true : null,
      };
      const rehab = REHAB_AREAS.map(a => ({ area: a, stage: Number(document.getElementById("rh-" + a).value) || 0, note: txt("rhn-" + a) || null }))
        .filter(m => m.stage > 0);
      const prevPid = f.dataset.pid || null;
      const row = {
        name, pos: document.getElementById("pf-pos").value, year: txt("pf-year") || null,
        height: num("pf-height"), weight: num("pf-weight"), exp: num("pf-exp"),
        weight_exp: document.getElementById("pf-wexp").value, adjust,
        sort: prevPid ? ((state.players[prevPid] || {}).order ?? 99) : Object.keys(state.players).length + 1,
      };
      let id = prevPid;
      if (prevPid) ok(await sb.from("players").update(row).eq("id", prevPid));
      else id = ok(await sb.from("players").insert(row).select("id").single()).id;
      ok(await sb.from("health").upsert({
        player_id: id, ankle_l: ankleL, ankle_r: ankleR, injuries,
        knee_injury: injuries.some(x => x.part === "knee"), pain, note: txt("hf-note") || null,
        rehab, consent: true, updated_at: new Date().toISOString(),
      }));
      state.editPid = id;
      toast(prevPid ? "저장했어요" : `${name} 선수를 추가했어요`);
    } else if (f.id === "testForm") {
      const balv = id => { const v = document.getElementById(id).value; return v === "" ? null : v === "1"; };
      const st = document.getElementById("tf-hsStage").value;
      const row = {
        player_id: f.dataset.pid, date: txt("tf-date"),
        reach: num("tf-reach"), cmj: num("tf-cmj"), block: num("tf-block"), approach: num("tf-approach"),
        bal_l: balv("tf-balL"), bal_r: balv("tf-balR"), hs_stage: st ? Number(st) : null, hs_sec: num("tf-hsSec"), hs_walk: num("tf-hsWalk"),
        squat: num("tf-squat"), rdl: num("tf-rdl"), pull: num("tf-pull"),
        side_l: num("tf-sl"), side_r: num("tf-sr"), plank: num("tf-pl"),
      };
      const filled = Object.entries(row).filter(([k, v]) => !["player_id", "date"].includes(k) && v != null && !Number.isNaN(v));
      if (!filled.length) { toast("측정값을 하나 이상 입력해 주세요."); return; }
      ok(await sb.from("tests").insert(row));
      toast("측정값을 저장했어요");
    } else if (f.id === "inbodyForm") {
      ok(await sb.from("inbody").insert({
        player_id: f.dataset.pid, date: txt("ib-date"), weight: num("ib-weight"), smm: num("ib-smm"),
        fat_mass: num("ib-fat"), pbf: num("ib-pbf"), leg_l: num("ib-legl"), leg_r: num("ib-legr"),
        standardized: document.getElementById("ib-std").checked, note: txt("ib-note") || null,
      }));
      toast("인바디를 저장했어요");
    } else if (f.id === "painForm") {
      const w = f.dataset.where;
      ok(await sb.from("pain_checks").insert({
        player_id: f.dataset.pid, date: txt("pc-date-" + w), area: document.getElementById("pc-area-" + w).value,
        during: Number(document.getElementById("pc-d-" + w).value), morning: Number(document.getElementById("pc-m-" + w).value),
        rest: document.getElementById("pc-r-" + w).checked,
      }));
      toast("통증을 기록했어요");
    } else if (f.id === "coreForm") {
      const hs = document.getElementById("ct-hs").value;
      const row = { player_id: f.dataset.pid, date: txt("ct-date"), side_l: num("ct-sl"), side_r: num("ct-sr"), plank: num("ct-pl"), hs_stage: hs ? Number(hs) : null, hs_walk: num("ct-walk") };
      const core = [row.side_l, row.side_r, row.plank].filter(v => v != null).length;
      if (core && core < 3) { toast("코어는 세 가지를 모두 입력해 주세요."); return; }
      if (!core && row.hs_stage == null && row.hs_walk == null) { toast("값을 하나 이상 입력해 주세요."); return; }
      ok(await sb.from("tests").insert(row));
      toast("저장했어요");
    } else if (f.id === "eventForm") {
      const start = txt("ev-start"), end = txt("ev-end") || start;
      if (end < start) { toast("끝 날짜가 시작보다 앞이에요."); return; }
      ok(await sb.from("events").insert({ name: txt("ev-name"), kind: document.getElementById("ev-kind").value, start_date: start, end_date: end, note: txt("ev-note") || null }));
      toast("일정을 추가했어요. 프로그램이 맞춰졌어요.");
    } else if (f.id === "logForm") {
      ok(await sb.from("logs").insert({
        player_id: f.dataset.pid, date: txt("lg-date"), type: document.getElementById("lg-type").value,
        minutes: num("lg-min") || 1, rpe: Number(document.getElementById("lg-rpe").value),
        jumps: num("lg-jumps"), pain: 0, note: txt("lg-note") || null,
      }));
      toast("기록했어요");
    }
    state.dirty = false;
    await loadAll();
  } catch (e) { toast(failMsg(e)); }
  finally { if (btn) btn.disabled = false; }
});

/* ---------- 데이터 ---------- */
async function loadProfile() {
  const { data } = await sb.auth.getSession();
  const session = data ? data.session : null;
  state.session = session;
  state.email = session && session.user ? (session.user.email || "") : "";
  if (!session) {
    Object.assign(state, { role: null, admin: false, myPid: null, players: {}, tests: {}, health: {}, logs: {}, inbody: {}, profiles: [], loaded: false, booting: false, dirty: false, selfPlayer: null, selfHealth: null, editingSelf: false });
    render(); return;
  }
  const r = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (r.error) { state.offline = true; state.booting = false; render(); return; }
  state.role = r.data ? r.data.role : "pending";
  state.myPid = r.data ? r.data.player_id : null;
  state.admin = state.role === "coach";
  state.canWrite = state.role === "coach" || state.role === "player";
  if (state.canWrite) await loadAll();
  else if (state.role === "pending" && state.myPid) await loadSelf();
  state.booting = false; render();
}
// 승인 대기 중인 사람이 자기가 낸 정보를 다시 불러올 때
async function loadSelf() {
  const [pl, hl] = await Promise.all([
    sb.from("players").select("*").eq("id", state.myPid).maybeSingle(),
    sb.from("health").select("*").eq("player_id", state.myPid).maybeSingle(),
  ]);
  const r = pl.data, h = hl.data;
  state.selfPlayer = r ? { name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp, weightExp: wexpNorm(r.weight_exp) } : null;
  state.selfHealth = h ? { ankleL: h.ankle_l, ankleR: h.ankle_r, injuries: h.injuries || [], pain: h.pain || {}, note: h.note, consent: h.consent } : null;
}
const numOrNull = v => v == null ? null : Number(v);
async function loadAll() {
  try {
    const q = [
      sb.from("settings").select("*").maybeSingle(),
      sb.from("players").select("*"),
      sb.from("tests").select("*").order("date"),
      sb.from("health").select("*"),
      sb.from("logs").select("*").order("date"),
      sb.from("inbody").select("*").order("date"),
      sb.from("pain_checks").select("*").order("date"),
      sb.from("events").select("*").order("start_date"),
    ];
    if (state.admin) q.push(sb.from("profiles").select("*").order("created_at"));
    const res = await Promise.all(q);
    const [st, pl, ts, hl, lg, ib, pcs, evq] = res, pr = state.admin ? res[8] : null;
    for (const r of [pl, ts, hl, lg]) if (r.error) throw r.error;
    state.events = evq && !evq.error ? evq.data.map(r => ({ id: r.id, name: r.name, kind: r.kind, start: r.start_date, end: r.end_date, note: r.note })) : null;
    state.players = Object.fromEntries(pl.data.map(r => [r.id, {
      name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp,
      weightExp: wexpNorm(r.weight_exp), adjust: r.adjust || {}, order: r.sort,
    }]));
    const tests = {};
    for (const r of ts.data) {
      (tests[r.player_id] = tests[r.player_id] || { runs: [] }).runs.push({
        id: r.id, date: r.date, reach: r.reach, cmj: r.cmj, block: r.block, approach: r.approach,
        balL: r.bal_l, balR: r.bal_r, hsStage: r.hs_stage, hsSec: r.hs_sec, hsWalk: r.hs_walk == null ? null : Number(r.hs_walk), squat: r.squat, rdl: r.rdl, pull: r.pull,
        sideL: r.side_l, sideR: r.side_r, plank: r.plank, author: r.author,
      });
    }
    state.tests = tests;
    state.health = Object.fromEntries(hl.data.map(r => [r.player_id, {
      ankleL: r.ankle_l, ankleR: r.ankle_r, injuries: Array.isArray(r.injuries) ? r.injuries : [],
      pain: r.pain || {}, note: r.note, consent: r.consent, rehab: Array.isArray(r.rehab) ? r.rehab : [],
    }]));
    const logs = {};
    for (const r of lg.data) {
      (logs[r.player_id] = logs[r.player_id] || []).push({
        _id: r.id, date: r.date, type: r.type, minutes: r.minutes, rpe: r.rpe, jumps: r.jumps,
        painArea: r.pain_area, pain: r.pain, note: r.note,
      });
    }
    state.logs = logs;
    const inbody = {};
    for (const r of (ib && !ib.error ? ib.data : [])) {
      (inbody[r.player_id] = inbody[r.player_id] || []).push({
        id: r.id, date: r.date, weight: numOrNull(r.weight), smm: numOrNull(r.smm), fat: numOrNull(r.fat_mass), pbf: numOrNull(r.pbf),
        legL: numOrNull(r.leg_l), legR: numOrNull(r.leg_r), standardized: r.standardized, note: r.note,
      });
    }
    state.inbody = inbody;
    const checks = {};
    for (const r of (pcs && !pcs.error ? pcs.data : [])) {
      (checks[r.player_id] = checks[r.player_id] || []).push({ id: r.id, date: r.date, area: r.area, during: r.during, morning: r.morning, rest: r.rest, created: r.created_at });
    }
    state.painChecks = checks;
    state.profiles = pr && !pr.error ? pr.data : [];
    state.loaded = true; state.offline = false;
  } catch (e) { state.offline = true; }
  render();
}
function boot() {
  const h = (location.hash || "").replace("#", "");
  state.view = VIEWS.includes(h) ? h : h === "player" ? "plan" : "home";
  render();
  const cfg = window.SNUVT_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.anonKey || /YOUR/.test(cfg.url + cfg.anonKey)) {
    state.offline = true; state.booting = false; render(); return;
  }
  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  // 콜백 안에서 바로 Supabase 를 부르면 멈출 수 있어 다음 틱으로 넘긴다
  sb.auth.onAuthStateChange(event => {
    if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) setTimeout(loadProfile, 0);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.canWrite && !state.dirty) loadAll();
  });
  // 날짜가 바뀌면 오늘·D-day를 갱신
  let shown = iso(today());
  setInterval(() => { const t = iso(today()); if (t !== shown) { shown = t; state.day = null; state.week = null; if (!state.dirty) render(); else header(); } }, 60 * 1000);
}
if (typeof document !== "undefined" && document.getElementById("main")) {
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet-bg" id="sheet" hidden data-act="sheetclose"><div class="sheet" role="dialog" aria-modal="true" data-act="noop"><div class="sheet-body"></div></div></div>`);
  boot();
}
