/* SNUVT Physical — 화면·데이터 (프로그램 규칙은 program.js) */

/* ---------- 기준값 ---------- */
// 일정표를 못 불러올 때만 쓰는 기본값
const DEFAULT_EVENTS = [{ name: "서울대배", kind: "major", start: "2026-11-21", end: "2026-11-22" }];
const LOG_TYPES = { A: ["웨이트 A (플라이오메트릭·하체)", 75], B: ["웨이트 B (상체·코어)", 60], team: ["정규 훈련", 180], act: ["활성화", 30], match: ["경기", 90], other: ["맨몸·기타", 35] };
// 세션 RPE (Foster 2001 CR-10) — 원 척도에 말이 없는 6·8·9는 앞뒤 사이 값
const RPE = ["0 휴식", "1 아주 쉬움", "2 쉬움", "3 보통", "4 약간 힘듦", "5 힘듦", "6 힘듦+", "7 매우 힘듦", "8 매우 힘듦+", "9 거의 최대", "10 최대"];
const AREA_KO = { knee: "무릎", shoulder: "어깨", ankle: "발목", back: "허리", wrist: "손목", finger: "손가락" };
// 통증은 두 시점(운동할 때 · 다음 날 아침)을 구간으로 고르고, 쉴 때·밤에도 아픈지 따로 체크 → painStage 로 단계 판정
const PAIN_LEVELS = [[0, "0 없음"], [2, "1–3 살짝"], [5, "4–6 꽤 아픔"], [8, "7–10 많이 아픔"]];
const painBucket = v => { v = Number(v) || 0; return v <= 0 ? 0 : v <= 3 ? 2 : v <= 6 ? 5 : 8; };
const levelSelect = (id, cur, label) => `<label class="fl">${label}<select id="${id}">${PAIN_LEVELS.map(([v, t]) => `<option value="${v}" ${painBucket(cur) === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
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
// 웨이트 경험 4단계 (예전 값 lt6·gte6 도 읽음)
const WEXP = [
  ["none", "입문 · 웨이트를 한 번도 안 해 봤어요"],
  ["machine", "초급 · 기구(머신)는 써 봤어요"],
  ["free", "중급 · 웬만한 기구와 프리웨이트(스쿼트·데드리프트)를 할 수 있어요"],
  ["oly", "상급 · 파워 클린·행 클린·푸시 저크 같은 역도 동작을 할 수 있어요"],
];
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
const INJ_STATUS = [["ok", "다 나음"], ["rehab", "재활 중"], ["pain", "아직 아픔"]];
const INJ_GRADE = [["", "진단: 모름"], ["partial", "부분 손상"], ["complete", "완전 파열"], ["fracture", "골절·탈구"]];
const FINGER_OPTS = [["", "어느 손가락"], ...Object.entries(FINGERS)];
const injTypes = part => (INJ_PARTS.find(x => x[0] === part) || INJ_PARTS[0])[2];
function injRowHtml(x = {}) {
  const part = x.part || "shoulder", y = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => String(y - i)).concat(["그 전"]);
  const o = (v, cur, l) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
  return `<div class="inj-row">
    <select class="inj-side" aria-label="방향">${INJ_SIDES.map(([v, l]) => o(v, x.side || "R", l)).join("")}</select>
    <select class="inj-part" aria-label="부위">${INJ_PARTS.map(([v, l]) => o(v, part, l)).join("")}</select>
    <select class="inj-type" aria-label="부상">${injTypes(part).map(t => o(t, x.type, t)).join("")}</select>
    <select class="inj-finger" aria-label="손가락" ${part === "finger" ? "" : "hidden"}>${FINGER_OPTS.map(([v, l]) => o(v, x.finger || "", l)).join("")}</select>
    <select class="inj-grade" aria-label="진단">${INJ_GRADE.map(([v, l]) => o(v, x.grade || "", l)).join("")}</select>
    <select class="inj-status" aria-label="지금 상태">${INJ_STATUS.map(([v, l]) => o(v, x.status || "ok", l)).join("")}</select>
    <select class="inj-year" aria-label="연도">${years.map(v => o(v, x.year || y, v === "그 전" ? v : v + "년")).join("")}</select>
    <select class="inj-month" aria-label="월"><option value="">월 모름</option>${Array.from({ length: 12 }, (_, i) => o(i + 1, x.month || "", `${i + 1}월`)).join("")}</select>
    <div class="inj-end"><label class="check"><input type="checkbox" class="inj-surg" ${x.surgery ? "checked" : ""}> 수술</label>
    <button class="btn link danger" type="button" data-act="delinj" aria-label="이 부상 지우기">✕ 지우기</button></div></div>`;
}
const injuryEditor = (prefix, list) => `<div class="inj" id="${prefix}-inj">${(list || []).map(injRowHtml).join("")}</div>
  <button class="btn" type="button" data-act="addinj" data-prefix="${prefix}">+ 부상 추가</button>`;
const readInjuries = prefix => [...document.querySelectorAll(`#${prefix}-inj .inj-row`)].map(r => ({
  side: r.querySelector(".inj-side").value, part: r.querySelector(".inj-part").value, type: r.querySelector(".inj-type").value,
  year: r.querySelector(".inj-year").value, month: Number(r.querySelector(".inj-month").value) || null, surgery: r.querySelector(".inj-surg").checked,
  status: r.querySelector(".inj-status").value, grade: r.querySelector(".inj-grade").value || null,
  finger: r.querySelector(".inj-part").value === "finger" ? (r.querySelector(".inj-finger").value || null) : null,
}));
const injText = x => `${(INJ_SIDES.find(s => s[0] === x.side) || ["", ""])[1].replace("해당 없음", "")} ${x.part === "finger" && FINGERS[x.finger] ? FINGERS[x.finger] + " " : ""}${x.type} (${[x.year && x.month ? `${x.year}.${x.month}` : x.year, x.surgery ? "수술" : "", x.status && x.status !== "ok" ? (INJ_STATUS.find(v => v[0] === x.status) || ["", ""])[1] : ""].filter(Boolean).join(", ")})`.trim();
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
  loaded: false, offline: false, admin: false, coach: false, canWrite: null, dirty: false, armed: null,
  session: null, role: null, myPid: null, email: "", profiles: [], authMode: "login", authMsg: "", authErr: false, booting: true,
  selfPlayer: null, selfHealth: null, editingSelf: false, painChecks: {}, openKeys: {}, wellness: {}, lifts: {}, planCtx: null, teamOff: {}, picks: {},
};
let sb = null;

function sortedPlayers() {
  return Object.entries(state.players).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)) || ((a.order ?? 99) - (b.order ?? 99)) || String(a.name).localeCompare(String(b.name), "ko"));
}
function runs(pid) { return [...((state.tests[pid] || {}).runs || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))); }
// 측정은 날마다 일부 항목만 잴 수 있어서, 항목별로 가장 최근 값을 모은다 (코어만 잰 날이 점프·근력 값을 지우지 않게)
const EXTRA_KEYS = ["rsi", "ktwL", "ktwR", "irD", "irN", "erD", "erN", "hopL", "hopR"];
const TEST_KEYS = ["reach", "vert", "maxVert", "cmj", "block", "approach", "hsStage", "hsSec", "hsWalk", "squat", "rdl", "pull", "sideL", "sideR", "plank", ...EXTRA_KEYS];
// 버티컬(제자리 점프 높이) · 맥스 버티컬(도움닫기 점프 높이) — 직접 입력. 예전 도달 높이(block·approach)는 리치를 빼서 읽음
const vertOf = t => t && t.vert != null ? Number(t.vert) : t && t.reach != null && t.block != null ? Number(t.block) - Number(t.reach) : null;
const maxVertOf = t => t && t.maxVert != null ? Number(t.maxVert) : t && t.reach != null && t.approach != null ? Number(t.approach) - Number(t.reach) : null;
// 네트 위 높이 = 스탠딩 리치 + 점프 높이 − 네트
const overNet = (t, v) => t && t.reach != null && v != null ? Number(t.reach) + v - NET : null;
function latest(pid) {
  const r = runs(pid); if (!r.length) return null;
  const out = { date: r.at(-1).date };
  for (const t of r) for (const k of TEST_KEYS) if (t[k] != null) out[k] = t[k];
  return out;
}
const isMainTest = t => ["reach", "vert", "maxVert", "cmj", "block", "approach", "squat", "rdl", "pull", ...EXTRA_KEYS].some(k => t[k] != null);
// 추가 측정 한 줄 요약 (RSI · 한 발 홉 · 무릎 벽 대기 · 어깨 내·외회전)
const extraText = t => [t.rsi != null ? `RSI ${t.rsi}` : "", t.hopL != null || t.hopR != null ? `홉 ${t.hopL ?? "—"}/${t.hopR ?? "—"}` : "",
  t.ktwL != null || t.ktwR != null ? `벽 ${t.ktwL ?? "—"}/${t.ktwR ?? "—"}` : "", t.irD != null || t.irN != null ? `내회전 ${t.irD ?? "—"}/${t.irN ?? "—"}` : "",
  t.erD != null || t.erN != null ? `외회전 ${t.erD ?? "—"}/${t.erN ?? "—"}` : ""].filter(Boolean).join(" · ");
const isCoreHs = t => coreSum(t) != null || t.hsStage != null || t.hsWalk != null || t.hsSec != null;
const logsOf = pid => state.logs[pid] || [];
const checksOf = pid => [...(state.painChecks[pid] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created).localeCompare(String(b.created)));
const recentChecks = pid => { const from = iso(addDays(today(), -14)); return checksOf(pid).filter(c => c.date >= from); };
const coreRuns = pid => runs(pid).filter(t => coreSum(t) != null);
const hsText = t => t && t.hsStage ? `${t.hsStage}단계${t.hsStage >= 5 && t.hsWalk != null ? ` · ${t.hsWalk}m` : t.hsSec != null ? ` · ${t.hsSec}초` : ""}` : "—";
// 다시 그려도 펼친 상태가 유지되게: <details data-keep="키">
const keepOpen = (key, dflt) => (state.openKeys[key] ?? dflt) ? "open" : "";
// 주는 월요일 날짜(YYYY-MM-DD)로 다룬다. 어떤 날의 프로그램은 일정표(대회·방학·학기)로 정해진다 (program.js seasonDay)
const thisMon = () => mondayOf(iso(today()));
const selMon = () => state.week ?? thisMon();
const selDay = () => state.day ?? (selMon() === thisMon() ? dowMon(today()) : 0);
// 정규 훈련 없는 날(관리자 지정)은 선수가 골라서 하는 날로
const infoOn = date => {
  const i = seasonDay(date, events()), off = state.teamOff[date];
  if (!off || i.slot !== "team") return i;
  return { ...i, teamOff: true, teamOffNote: off.note || "", near: [seasonDay(dAdd(date, -1), events()).slot, seasonDay(dAdd(date, 1), events()).slot] };
};
function weekLabel(mon) {
  const infos = DAYS.map((_, d) => infoOn(dAdd(mon, d)));
  const ev = infos.find(i => /^(대회 주|컨디셔닝|트라이아웃|대회 뒤)/.test(i.label));
  if (ev) return ev.label;
  const i = infos[3];
  return i.optional ? i.label : `${i.label} · ${PHASE_NAMES[i.w]}`;
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
const wellOf = pid => state.wellness[pid] || [];
const liftsOf = pid => state.lifts[pid] || [];
const wellOn = (pid, date) => wellOf(pid).find(w => w.date === date) || null;
const wellSum = w => w ? WELL_KEYS.reduce((a, [k]) => a + Number(w[k] || 0), 0) : null;
// 전날 기록 중 가장 높은 RPE
const lastRpeBefore = (pid, date) => { const y = dAdd(date, -1), r = logsOf(pid).filter(e => e.date === y).map(e => Number(e.rpe)); return r.length ? Math.max(...r) : null; };
const LIFT_KO = { squat: "백스쿼트", rdl: "RDL", bench: "덤벨 벤치 (한 손)", hip: "힙 쓰러스트", clean: "행 파워 클린" };
const liftKey = n => ({ ...LIFT_OF, "행 파워 클린": "clean" })[String(n).trim()] || null;
// 세션 화면에서 무게를 적을 수 있는 운동 (기구·덤벨·바벨)
const LOADABLE = /바벨|덤벨|백스쿼트|고블릿|데드리프트|힙 쓰러스트|클린|스텝업|랜드마인|머신|레그 익스텐션|레그프레스/;
const NOT_LOAD = /점프|착지|등척성|외회전|손목|Y·T·W|들고 걷기|메디신볼|컨트라스트|동작 연습/;
const isLoadable = n => LOADABLE.test(n) && !NOT_LOAD.test(n);
// 추정 1RM: 최근 8주 무게 기록 중 최고 → 없으면 측정한 5RM
function e1rmMap(pid, date) {
  const from = dAdd(date, -56), out = {};
  for (const l of liftsOf(pid)) if (l.lift && l.date >= from && l.date <= date) { const v = e1rmOf(l.kg, l.reps, l.rir); if (!out[l.lift] || v > out[l.lift]) out[l.lift] = v; }
  const t = latest(pid);
  if (t && !out.squat && t.squat) out.squat = e1rmOf(t.squat, 5, 0);
  if (t && !out.rdl && t.rdl) out.rdl = e1rmOf(t.rdl, 5, 0);
  return out;
}
// 운동 이름별 최근 8주 최고 추정 1RM (세트 기록) → 모든 웨이트 운동의 추천 무게
function e1rmNameMap(pid, date) {
  const from = dAdd(date, -56), out = {};
  for (const l of liftsOf(pid)) if (l.name && l.date >= from && l.date <= date) { const v = e1rmOf(l.kg, l.reps, l.rir); if (!out[l.name] || v > out[l.name]) out[l.name] = v; }
  return out;
}
function ctxFor(p, date) {
  const h = state.health[p.id] || {};
  const d = date || iso(today());
  return {
    ready: { well: wellOn(p.id, d), lastRpe: lastRpeBefore(p.id, d) },
    e1rm: e1rmMap(p.id, d), e1rmName: e1rmNameMap(p.id, d), custom: h.custom || {},
    pick: (state.picks[p.id] || {})[d] || null,
    player: p, test: latest(p.id),
    weight: p.weight,
    rehab: [], pain: state.health[p.id] ? (h.pain || {}) : null, checks: recentChecks(p.id),
    injuries: h.injuries || [], year: today().getFullYear(), month: today().getMonth() + 1,
    ankleHistory: !!(p.adjust && p.adjust.ankleBal) || (Number(h.ankleL) || 0) + (Number(h.ankleR) || 0) > 0,
  };
}
// 최근 3일 정규 훈련·경기를 본인이 RPE 7 이상으로 기록한 횟수 → 웨이트 A 플라이오메트릭 양
const hardTeamOf = (pid, date) => logsOf(pid).filter(e => (e.type === "team" || e.type === "match") && Number(e.rpe) >= 7 && e.date < date && e.date >= dAdd(date, -3)).length;
// 그 주 흐름: 고른 것에 따라 남은 날 권고가 바뀜 (선수·주마다 계산, 다시 그릴 때 새로)
const flowCache = new Map();
function flowFor(pid, date) {
  const mon = mondayOf(date), k = pid + mon;
  if (!flowCache.has(k)) {
    const picks = state.picks[pid] || {};
    flowCache.set(k, weekFlow(DAYS.map((_, d) => { const dt = dAdd(mon, d), i = infoOn(dt); return { slot: i.slot, off: !!i.teamOff, pick: picks[dt] || null, event: !!i.weekEvent }; })));
  }
  return flowCache.get(k)[dDiff(date, mon)];
}
const planOn = (p, date) => planForDay(ctxFor(p, date), { ...infoOn(date), hardTeam: hardTeamOf(p.id, date), flow: flowFor(p.id, date) });
const teamPlanOn = date => planForDay({ player: {} }, infoOn(date));
const modsFor = p => { const h = state.health[p.id] || {}; return effectiveModules(p.adjust, [], state.health[p.id] ? (h.pain || {}) : null, recentChecks(p.id)); };
const playerOf = pid => pid && state.players[pid] ? { id: pid, ...state.players[pid] } : null;

/* ---------- 공통 조각 ---------- */
const chipsHtml = list => list.length ? `<div class="chips">${list.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : "";
const emptyLine = t => `<p class="empty-line">${t}</p>`;
const SHORT = { "플라이오메트릭 + 하체 근력": "하체", "상체·엉덩이·코어": "상체", "활성화 30분": "활성화", "정규 훈련": "훈련", "맨몸 상체·코어": "맨몸", "맨몸 하체·균형": "맨몸", "완전 휴식": "휴식", "대회": "대회", "대회 전날": "전날", "회복": "회복", "트라이아웃": "트라이", "고르기": "선택", };
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
  const roleKo = state.coach ? "관리자" : state.role === "player" ? "선수" : "";
  const modeBtn = state.coach && state.loaded ? `<button class="btn mode ${state.admin ? "" : "on"}" type="button" data-act="mode" title="관리자 화면과 선수 화면을 바꿔요">${state.admin ? "선수 화면으로" : "관리자 화면으로"}</button>` : "";
  who.innerHTML = state.session ? `<span>${esc(myName())}${roleKo ? " " + roleKo : ""}</span>${modeBtn}<button class="btn link" type="button" data-act="logout">로그아웃</button>` : "";
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
  if (me) parts.push(wellnessHtml(me), todayHtml(me), myStatusHtml(me));
  else if (!state.admin) parts.push(`<div class="panel empty"><strong>계정이 선수와 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`);
  parts.push(`<p class="foot">${me ? `<button class="btn link small" type="button" data-act="pushopen">알림</button> · ` : ""}<button class="btn link small" type="button" data-act="pwchange">비밀번호 바꾸기</button></p>`);
  return parts.join("");
}
function wellnessHtml(p) {
  const t = iso(today()), w = wellOn(p.id, t), why = readiness(w, lastRpeBefore(p.id, t));
  const sel = (k, l) => `<label class="fl">${l}<select id="wl-${k}">${[5, 4, 3, 2, 1].map(v => `<option value="${v}" ${(w ? Number(w[k]) : 3) === v ? "selected" : ""}>${WELL_OPTS[k][v - 1]}</option>`).join("")}</select></label>`;
  const key = "well-form";
  return `<section class="panel well-card">
    <div class="row between"><h3>아침 컨디션</h3>${w ? `<span class="chip ${why.length ? "warn" : ""}">${wellSum(w)}/20${why.length ? " · 회복 버전" : ""}</span>` : why.length ? `<span class="chip warn">회복 버전</span>` : ""}</div>
    <details data-keep="${key}" ${keepOpen(key, !w)}><summary class="small muted">${w ? "수정" : "입력"}</summary>
    <form class="f" id="wellForm" data-pid="${esc(p.id)}">
      <div class="fields well">${WELL_KEYS.map(([k, l]) => sel(k, l)).join("")}</div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form></details>
  </section>`;
}
// 오늘 할 것: 권고가 표시되고, 눌러서 바꿈 (권고를 다시 누르면 원래대로)
function picksHtml(plan, pid, date) {
  if (!plan.choices) return "";
  const can = pid && canEditSelf(playerOf(pid));
  return `<div class="picks" role="group" aria-label="오늘 할 것">${plan.choices.map(c => `<button type="button" class="pick${c.rec ? " rec" : ""}" aria-pressed="${!!c.sel}" ${can ? `data-act="pick" data-pid="${esc(pid)}" data-date="${esc(date)}" data-k="${c.key}" data-rec="${c.rec ? 1 : 0}"` : "disabled"}>${esc(c.label)}${c.rec ? "<em>권고</em>" : ""}</button>`).join("")}</div>`;
}
const hasRun = plan => ["gymA", "gymB", "bwU", "bwL", "act", "recover"].includes(plan.slot);
function runBtn(p, date, plan, inline) {
  if (!p || !canEditSelf(p) || !hasRun(plan)) return "";
  const saved = state.run || lsGet(RUN_KEY());
  const resume = saved && saved.pid === p.id && saved.date === date;
  const btn = `<button class="btn primary" type="button" data-act="${resume ? "runresume" : "runstart"}" data-pid="${esc(p.id)}" data-date="${esc(date)}">${resume ? "이어서 하기" : "운동 시작"}</button>`;
  return inline ? btn : `<div class="row runrow">${btn}</div>`;
}
function todayHtml(p) {
  const t = iso(today()), mon = thisMon(), d = dowMon(today());
  const plan = planOn(p, t);
  const main = plan.blocks.filter(b => !["warm", "cool"].includes(b.key));
  const items = main.flatMap(b => b.items).slice(0, 5);
  const mine = plan.blocks.filter(b => b.scope === "me");
  return `<section class="panel today-card">
    <p class="eyebrow">오늘 · ${longDate(today())} · ${esc(weekLabel(mon))}</p>
    <h2>${esc(plan.title)}</h2>
    ${picksHtml(plan, p.id, t)}
    ${items.length ? `<ul class="mini">${items.map(x => `<li><span>${esc(x.name)}</span><b>${esc(rxMain(x.rx))}</b></li>`).join("")}</ul>` : ""}
    <div class="row between">
      <span class="small muted">${mine.length ? `개인 ${mine.map(b => b.title.replace(/ \(.*\)$/, "")).join(" · ")}` : ""}</span>
      <span class="row nowrap">${runBtn(p, t, plan, true)}<button class="btn ${canEditSelf(p) && hasRun(plan) ? "" : "primary"}" type="button" data-act="openday" data-m="${mon}" data-d="${d}">전체 프로그램 보기</button></span>
    </div>
  </section>`;
}
function myStatusHtml(p) {
  const t = latest(p.id);
  const rel = relOf(ctxFor(p));
  const mv = maxVertOf(t), v = vertOf(t);
  const mvRuns = runs(p.id).filter(x => maxVertOf(x) != null);
  const dMv = mv != null && mvRuns.length > 1 ? mv - maxVertOf(mvRuns[0]) : null;
  const blk = overNet(t, mv);
  const todayLog = logsOf(p.id).filter(e => e.date === iso(today()));
  const weekLogs = logsOf(p.id).filter(e => mondayOf(e.date) === thisMon());
  const nm = nextMeasure(iso(today()), events());
  const au = weekLogs.reduce((s, e) => s + (Number(e.rpe) || 0) * (Number(e.minutes) || 0), 0);
  const mods = modsFor(p);
  const cr = coreRuns(p.id), core = cr.length ? coreSum(cr.at(-1)) : null, dCore = cr.length > 1 ? core - coreSum(cr[0]) : null;
  const stat = (k, v, sub = "") => `<div class="stat"><div class="k">${k}</div><div class="v">${v}${sub}</div></div>`;
  return `<section class="tiles">
    <div class="panel tile">
      <h3>오늘 기록</h3>
      ${todayLog.length ? `<p class="done">✓ ${todayLog.map(e => `${esc((LOG_TYPES[e.type] || ["기타"])[0])} RPE ${esc(e.rpe)} × ${esc(e.minutes)}분`).join(", ")}</p>`
        : `<button class="btn primary" type="button" data-act="view" data-v="rec">기록하기</button>`}
      <p class="small muted">이번 주 ${au.toLocaleString("ko-KR")} AU</p>
    </div>
    <div class="panel tile">
      <h3>내 지표</h3>
      ${t ? `<div class="stats">
        ${stat("맥스 버티컬", mv != null ? mv : "—", dMv != null ? ` <small class="${dMv < 0 ? "neg" : ""}">${dMv > 0 ? "+" : ""}${dMv}</small>` : "")}
        ${stat("버티컬", v != null ? v : "—")}
        ${stat("스파이크 네트 위", blk != null ? (blk >= 0 ? "+" : "") + blk : "—")}
        ${stat("상대 근력", rel != null ? rel.toFixed(2) : "—")}
        ${stat("코어 합계 (초)", core != null ? core : "—", dCore != null ? ` <small class="${dCore < 0 ? "neg" : ""}">${dCore > 0 ? "+" : ""}${dCore}</small>` : "")}
        ${stat("핸드스탠드", hsText(t))}</div>` : emptyLine("측정 후 나와요.")}
      ${!t ? `<p class="small muted">측정 기록 없음 · 측정 주에 점검</p>` : nm ? `<p class="small muted">다음 측정 ${md(parseD(nm.mon))} 주${nm.mon === thisMon() ? " (이번 주)" : ""} · ${nm.type === "jump" ? "점프만" : "전체"}</p>` : ""}
      <button class="btn link" type="button" data-act="view" data-v="rec">코어·핸드스탠드 기록하기 →</button>
    </div>
    <div class="panel tile">
      <h3>통증</h3>
      ${mods.length ? `<ul class="plain">${mods.map(m => `<li><b>${esc(painLabel(m))}</b>${m.fromCheck ? ' <span class="small muted">최근 체크</span>' : ""}</li>`).join("")}</ul>` : `<p class="small muted">지금 아픈 곳 없음</p>`}
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
    for (const m of modsFor(p)) if (m.stage <= 2) why.push([m.stage === 1 ? "crit" : "warn", painLabel(m) + (m.fromCheck ? " · 체크" : "")]);
    for (const x of (state.health[p.id] || {}).injuries || []) if (x.status === "rehab") why.push(["", `${injName(x)} 재활 중`]);
    const rw = readiness(wellOn(p.id, t), lastRpeBefore(p.id, t));
    if (rw.length) why.push(["warn", rw.join(" · ")]);
    const sum = m => logsOf(p.id).filter(e => mondayOf(e.date) === m).reduce((s, e) => s + (Number(e.rpe) || 0) * (Number(e.minutes) || 0), 0);
    const a = sum(mon), b = sum(dAdd(mon, -7));
    if (b > 0 && a >= 2 * b) why.push(["warn", "부하 전주 2배↑"]);
    if (why.length) watch.push({ p, why });
  }
  return `<section class="panel team-status">
    <h3>팀 현황</h3>
    <div class="stats">
      <div class="stat"><div class="k">오늘 기록</div><div class="v">${loggedToday} / ${ps.length}</div></div>
      <div class="stat"><div class="k">아침 컨디션</div><div class="v">${ps.filter(p => wellOn(p.id, t)).length} / ${ps.length}</div></div>
      <div class="stat ${pending.length ? "hot" : ""}"><div class="k">승인 대기</div><div class="v">${pending.length}</div></div>
      <div class="stat ${watch.length ? "hot" : ""}"><div class="k">확인할 선수</div><div class="v">${watch.length}</div></div>
    </div>
    ${pending.length ? `<button class="btn link" type="button" data-act="view" data-v="intake">승인하러 가기 →</button>` : ""}
    ${watch.length ? `<ul class="watch">${watch.map(({ p, why }) => `<li><button type="button" class="btn link" data-act="open" data-pid="${esc(p.id)}">${esc(p.name)}</button>${chipsHtml(why)}</li>`).join("")}</ul>` : ""}
  </section>`;
}
/* ---------- 프로그램 ---------- */
const rxMain = rx => fmtRx(rx).split(" · ")[0];
const rxRest = rx => fmtRx(rx).split(" · ").slice(1).map(t => /^약 [\d.]+kg$/.test(t) ? `<b>${esc(t)}</b>` : esc(t)).join(" · ");
function blockHtml(b) {
  return `<section class="blk b-${esc(b.key)}"><h4>${esc(b.title)}</h4><ul class="rows">${b.items.map(x => {
    const rec = x.name === "통증 체크" ? "pain" : x.name === "세션 RPE 기록" ? "log" : "";
    if (rec) return `<li class="tap" data-act="gorec" data-focus="${rec}" role="button" tabindex="0"><div class="nm">${esc(x.name)} <span class="mod">기록 →</span></div><div class="rx">${esc(fmtRx(x.rx))}</div></li>`;
    const tap = exGuide(x.name) || exSeconds(x.rx) || exLink(x.name);
    return `<li${tap ? ` class="tap" data-act="ex" data-n="${esc(x.name)}" data-r="${esc(x.rx ?? "")}" data-c="${esc(x.cue || "")}" role="button" tabindex="0"` : ""}>
    <div class="nm">${esc(x.name)}${x.mod ? ` <span class="mod">${esc(x.mod)}</span>` : ""}</div><div class="rx">${esc(rxMain(x.rx))}</div>${rxRest(x.rx) ? `<div class="sub">${rxRest(x.rx)}</div>` : ""}</li>`; }).join("")}</ul>
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
  state.planCtx = canEditSelf(p) ? { pid, date } : null; // 운동 창에서 무게 기록
  return `
  <section class="sec">
    <div class="sec-head"><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2>${playerPicker(pid)}</div>
    ${weeksHtml(mon)}
    ${daysHtml(mon, d, x => planOn(p, x))}
  </section>
  <section class="sec">
    ${runBtn(p, date, plan)}
    <div><h3 class="day-title">${longDate(parseD(date))} · ${esc(plan.title)}</h3>
</div>
    ${notes.length ? `<ul class="notes callout">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${picksHtml(plan, pid, date)}${scopedBlocks(plan)}
  </section>`;
}
// 팀 세션(다 같이) / 개인(포지션 · 재활 · 예방)으로 나눠 보여 주기
// 비시즌은 '자율', 쉬는 날·대회 날은 나누지 않음
function scopedBlocks(plan, teamOnly) {
  const team = plan.blocks.filter(b => b.scope !== "me"), me = teamOnly ? [] : plan.blocks.filter(b => b.scope === "me");
  if (["rest", "recover", "match", "prep"].includes(plan.slot) && !me.length) return `<div class="blocks">${team.map(blockHtml).join("")}</div>`;
  const teamH = plan.optional ? "자율" : "팀 세션";
  return `<h3 class="scope-h">${teamH}</h3><div class="blocks">${team.map(blockHtml).join("")}</div>
    ${teamOnly ? "" : `<h3 class="scope-h me">개인</h3>
    ${me.length ? `<div class="blocks">${me.map(blockHtml).join("")}</div>` : `<p class="small muted">오늘은 개인 운동이 없어요.</p>`}`}`;
}
function viewTeamPlan() {
  const mon = selMon(), d = selDay(), date = dAdd(mon, d);
  state.planCtx = null;
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
    <div class="row between"><h3 class="day-title">${longDate(parseD(date))} · ${esc(plan.title)}</h3>
      ${seasonDay(date, events()).slot === "team" ? `<button class="btn" type="button" data-act="teamoff" data-date="${esc(date)}">${state.teamOff[date] ? "정규 훈련 다시 있음" : "정규 훈련 없음으로"}</button>` : ""}</div>
    ${scopedBlocks(plan, true)}
    ${extra.length ? `<h3 class="scope-h me">개인 블록이 있는 선수</h3><ul class="watch">${extra.map(({ p, b }) => `<li><button type="button" class="btn link" data-act="open" data-pid="${esc(p.id)}">${esc(p.name)}</button>${chipsHtml(b.map(x => ["", x.title.replace(/ \(.*\)$/, "")]))}</li>`).join("")}</ul>` : ""}
  </section>`;
}
/* ---------- 기록 (세션 · 측정) ---------- */
function viewRec() {
  const pid = viewPid();
  if (!pid) return viewPlan();
  const p = playerOf(pid);
  return `<section class="sec"><div class="sec-head"><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2>${playerPicker(pid)}</div></section>
  <div class="cols">
    <div class="col">${logHtml(p)}<section class="sec"><h3>통증 기록 <span class="private">본인·관리자만</span></h3>${painCheckForm(p, "rec")}${painCheckList(p)}</section></div>
    <div class="col">${liftHtml(p)}${coreHtml(p)}${testsHtml(p)}</div>
  </div>
  ${reportHtml(p)}`;
}
function logHtml(p) {
  const canLog = canEditSelf(p);
  const tplan = planOn(p, iso(today())), defType = tplan.logType;
  const entries = logsOf(p.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  return `<section class="sec"><h3>세션 기록</h3>
    ${canLog ? `<form class="f panel" id="logForm" data-pid="${esc(p.id)}">
      <div class="fields">
        <label class="fl">날짜<input type="date" id="lg-date" value="${iso(today())}" required></label>
        <label class="fl">종류<select id="lg-type">${Object.entries(LOG_TYPES).map(([k, [l]]) => `<option value="${k}" ${k === defType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fl">시간 (분)<input type="number" id="lg-min" inputmode="numeric" min="1" max="400" value="${tplan.minutes}" required></label>
        <label class="fl">힘든 정도 (RPE)<select id="lg-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 5 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fl">완료율<select id="lg-done"><option value="all">100%</option><option value="part">50%</option><option value="none">0%</option></select></label>
        <label class="fl wide">메모<input type="text" id="lg-note" maxlength="200" placeholder="컨디션, 손목·손가락 통증 등"></label>
      </div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form>` : ""}
    ${entries.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>종류</th><th>RPE×분</th><th>통증</th>${state.admin ? "<th></th>" : ""}</tr></thead><tbody>
      ${entries.map(e => `<tr><td class="num">${md(parseD(e.date))}</td><td>${esc((LOG_TYPES[e.type] || ["기타"])[0])}${e.completion && e.completion !== "all" ? ` <span class="chip">${e.completion === "part" ? "50%" : "0%"}</span>` : ""}</td><td class="num">${Number(e.rpe) * Number(e.minutes)}</td><td>${e.painArea ? `<span class="chip ${Number(e.pain) >= 3 ? "crit" : ""}">${esc(AREA_KO[e.painArea] || "")} ${esc(e.pain)}</span>` : "—"}</td>
      ${state.admin ? `<td><button class="btn link danger" data-act="dellog" data-id="${esc(e._id)}">삭제</button></td>` : ""}</tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
  </section>`;
}
function measureMode(p) {
  if (state.admin) return "full";
  if (!isMe(p)) return null;
  const info = infoOn(iso(today()));
  if (!runs(p.id).some(isMainTest)) return "full";        // 아직 측정이 없으면 언제든 첫 측정
  if (info.slot === "tryout") return "full";
  return info.measure || null;                              // 측정 주: full / 피크 주: jump
}
function testsHtml(p) {
  const r = runs(p.id).filter(isMainTest);
  const rel = relStrength(latest(p.id), p.weight);
  const sign = v => v == null ? "—" : (v >= 0 ? "+" : "") + v;
  const mode = measureMode(p), mine = t => state.admin || t.author === (state.session && state.session.user.id);
  const nf = (id, label, step = "0.5", max = 400) => `<label class="fl">${label}<input type="number" id="${id}" inputmode="decimal" step="${step}" min="0" max="${max}"></label>`;
  return `<section class="sec"><h3>측정</h3>
    ${r.length ? `${rel != null ? `<p class="small muted">상대 근력 <b>${rel.toFixed(2)}</b></p>` : ""}
    <div class="tw"><table><thead><tr><th>날짜</th><th>버티컬</th><th>맥스 버티컬</th><th>스파이크 네트 위</th><th>CMJ</th><th>스쿼트</th><th>기타</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${vertOf(t) ?? "—"}</td><td class="num">${maxVertOf(t) ?? "—"}</td><td class="num">${sign(overNet(t, maxVertOf(t)))}</td><td class="num">${t.cmj ?? "—"}</td><td class="num">${t.squat ?? "—"}</td><td class="small">${esc(extraText(t)) || "—"}</td>
      <td>${mine(t) ? `<button class="btn link danger" type="button" data-act="deltest" data-id="${esc(t.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 측정이 없어요.")}
    ${mode && !state.admin ? `<details class="panel" data-keep="measure-form" open><summary><b>${mode === "jump" ? "점프 측정 입력" : "측정 입력"}</b></summary>
      <form class="f" id="measureForm" data-pid="${esc(p.id)}" data-mode="${mode}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="ms-date" value="${iso(today())}" required></label>
          ${nf("ms-reach", "스탠딩 리치 (cm)")}${nf("ms-vert", "버티컬 (cm)", "0.5", 150)}${nf("ms-maxvert", "맥스 버티컬 (cm)", "0.5", 150)}${nf("ms-cmj", "CMJ (cm)", "0.1", 150)}${nf("ms-rsi", "RSI", "0.01", 5)}
          ${mode === "full" ? `${nf("ms-squat", "스쿼트 5RM (kg)", "2.5")}${nf("ms-rdl", "RDL 5RM (kg)", "2.5")}${nf("ms-pull", "턱걸이 (회)", "1", 50)}${extraFields("ms")}` : ""}
        </div>
        ${protocolHtml()}
        <div class="row"><button class="btn primary" type="submit">저장</button></div>
      </form></details>` : ""}
  </section>`;
}
// 추가 측정 입력 칸 (선수 측정·관리자 측정 공통)
const EXTRA_FIELDS = [["hopL", "한 발 홉 왼 (cm)", "1", 400], ["hopR", "한 발 홉 오른 (cm)", "1", 400], ["ktwL", "무릎 벽 대기 왼 (cm)", "0.5", 30], ["ktwR", "무릎 벽 대기 오른 (cm)", "0.5", 30],
  ["irD", "어깨 내회전 공격 팔 (°)", "1", 120], ["irN", "어깨 내회전 반대 팔 (°)", "1", 120], ["erD", "어깨 외회전 공격 팔 (°)", "1", 160], ["erN", "어깨 외회전 반대 팔 (°)", "1", 160]];
const EXTRA_COL = { rsi: "rsi", hopL: "hop_l", hopR: "hop_r", ktwL: "ktw_l", ktwR: "ktw_r", irD: "ir_d", irN: "ir_n", erD: "er_d", erN: "er_n" };
const extraFields = pre => EXTRA_FIELDS.map(([k, l, st, mx]) => `<label class="fl">${l}<input type="number" id="${pre}-${k}" inputmode="decimal" step="${st}" min="0" max="${mx}"></label>`).join("");
// 측정 방법 (매번 같은 방법으로 재야 비교가 돼요)
const PROTOCOL = [
  ["공통", "웨이트 A 전, 같은 시간대·같은 신발. 각 3번 해서 가장 좋은 값"],
  ["스탠딩 리치", "벽 옆에 서서 발뒤꿈치 붙이고 한 손 끝까지"],
  ["버티컬", "제자리, 팔 스윙 허용, 손끝 도달 − 리치"],
  ["맥스 버티컬", "스파이크 도움닫기 3–4걸음, 손끝 도달 − 리치"],
  ["CMJ", "손 허리, 반동 한 번 (점프 앱이나 매트)"],
  ["RSI", "30cm 박스 드롭 점프, 체공 시간 ÷ 접지 시간 (앱)"],
  ["한 발 홉", "한 발로 멀리, 같은 발로 2초 착지 고정. 출발선 – 뒤꿈치"],
  ["무릎 벽 대기", "뒤꿈치 붙인 채 무릎이 벽에 닿는 가장 먼 발끝–벽 거리"],
  ["어깨 내·외회전", "누워서 팔 90° 벌리고 팔꿈치 90°, 어깨 앞을 눌러 고정, 각도기 앱"],
  ["스쿼트·RDL 5RM", "워밍업 후 5회 가능한 최대 무게, 자세가 무너지면 그 전 무게"],
];
const protocolHtml = () => `<details class="proto"><summary class="small">측정 방법</summary><dl>${PROTOCOL.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;
const readExtra = (pre, row) => { for (const [k, col] of Object.entries(EXTRA_COL)) { const el = document.getElementById(`${pre}-${k}`); if (el) row[col] = el.value === "" ? null : Number(el.value); } return row; };

/* ---------- 웨이트 기록 · 추정 1RM ---------- */
function liftHtml(p) {
  const list = liftsOf(p.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created || "").localeCompare(String(a.created || "")));
  const best = e1rmMap(p.id, iso(today()));
  const mine = l => state.admin || l.author === (state.session && state.session.user.id);
  return `<section class="sec"><h3>웨이트 기록</h3>
    ${Object.keys(best).length ? `<p class="small">추정 1RM ${Object.entries(best).map(([k, v]) => `<span class="chip">${esc(LIFT_KO[k])} ${Math.round(v)}kg</span>`).join(" ")}</p>` : ""}
    ${list.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>운동</th><th>무게×회</th><th>RIR</th><th>추정 1RM</th><th></th></tr></thead><tbody>
      ${list.slice(0, 12).map(l => `<tr><td class="num">${md(parseD(l.date))}</td><td>${esc(l.name || LIFT_KO[l.lift] || "")}</td><td class="num">${l.kg}×${l.reps}</td><td class="num">${l.rir}</td><td class="num">${Math.round(e1rmOf(l.kg, l.reps, l.rir))}</td>
        <td>${mine(l) ? `<button class="btn link danger" type="button" data-act="dellift" data-id="${esc(l.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("프로그램에서 운동을 누르면 세트마다 무게를 적을 수 있어요.")}
  </section>`;
}

/* ---------- 성장 리포트 ---------- */
function growthRows(pid, weight) {
  const r = runs(pid);
  const fl = a => a.length >= 2 ? [a[0], a.at(-1)] : [null, null];   // 두 번 이상 잰 것만
  const fk = k => fl(r.filter(x => x[k] != null).map(x => Number(x[k]))), fv = f => fl(r.map(f).filter(v => v != null));
  const lifts = liftsOf(pid).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const lf = k => { const a = lifts.filter(l => l.lift === k).map(l => e1rmOf(l.kg, l.reps, l.rir)); return a.length >= 2 ? [Math.round(a[0]), Math.round(Math.max(...a.slice(-4)))] : [null, null]; };
  const rows = [
    ["맥스 버티컬", ...fv(maxVertOf), "cm"], ["버티컬", ...fv(vertOf), "cm"], ["CMJ", ...fk("cmj"), "cm"], ["RSI", ...fk("rsi"), ""],
    ["스쿼트 5RM", ...fk("squat"), "kg"], ["RDL 5RM", ...fk("rdl"), "kg"], ["턱걸이", ...fk("pull"), "회"],
    ["코어 합계", ...fv(coreSum), "초"], ["핸드스탠드 단계", ...fk("hsStage"), ""],
    ...Object.keys(LIFT_KO).map(k => [`${LIFT_KO[k]} 추정 1RM`, ...lf(k), "kg"]),
  ];
  return rows.filter(x => x[1] != null && x[2] != null);
}
function adherence(pid, days = 28) {
  const from = iso(addDays(today(), -days));
  const ws = wellOf(pid).filter(w => w.date >= from).map(wellSum);
  const lg = logsOf(pid).filter(e => e.date >= from && e.completion);
  const done = lg.length ? Math.round(100 * lg.reduce((a, e) => a + (e.completion === "all" ? 1 : e.completion === "part" ? 0.5 : 0), 0) / lg.length) : null;
  return { well: ws.length ? Math.round(10 * ws.reduce((a, b) => a + b, 0) / ws.length) / 10 : null, wellN: ws.length, done, logs: logsOf(pid).filter(e => e.date >= from).length };
}
function reportHtml(p) {
  const rows = growthRows(p.id, p.weight), a = adherence(p.id);
  const d = (x, y) => { const v = Math.round((y - x) * 100) / 100; return `<small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; };
  return `<section class="sec report"><h3>성장 리포트</h3>
    <div class="stats">
      <div class="stat"><div class="k">최근 4주 세션</div><div class="v">${a.logs}</div></div>
      <div class="stat"><div class="k">완료율</div><div class="v">${a.done != null ? a.done + "%" : "—"}</div></div>
      <div class="stat"><div class="k">아침 컨디션 평균</div><div class="v">${a.well != null ? a.well + "/20" : "—"}</div></div>
    </div>
    ${rows.length ? `<div class="tw"><table><thead><tr><th>항목</th><th>처음</th><th>지금</th><th>변화</th></tr></thead><tbody>
      ${rows.map(([n, x, y, u]) => `<tr><td>${esc(n)}</td><td class="num">${x}${u}</td><td class="num">${y}${u}</td><td class="num">${d(x, y)}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("측정이 두 번 이상 쌓이면 나와요.")}
  </section>`;
}
const bal = v => v === true ? "○" : v === false ? "×" : "—";
// 본인 기록: 선수 계정, 그리고 관리자가 '선수 화면'으로 볼 때의 자기 선수
const isMe = p => !!p && !!state.myPid && p.id === state.myPid && (state.role === "player" || state.coach);
function canEditSelf(p) { return state.admin || isMe(p); }
function painCheckForm(p, where) {
  if (!canEditSelf(p)) return "";
  const key = "pain-" + where, open = where === "rec" || modsFor(p).length > 0;
  return `<details class="pcheck" data-keep="${key}" ${keepOpen(key, open)}><summary><b>통증 체크</b></summary>
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
  return `<div class="tw"><table><thead><tr><th>날짜</th><th>부위</th><th>운동할 때</th><th>아침</th><th>정도</th><th></th></tr></thead><tbody>
    ${list.map(c => { const st = painStage({ d: c.during, m: c.morning, r: c.rest }); return `<tr><td class="num">${md(parseD(c.date))}</td><td>${esc(AREA_KO[c.area])}</td><td>${lv(c.during)}</td><td>${lv(c.morning)}${c.rest ? ' <span class="chip crit">쉴 때도</span>' : ""}</td>
      <td>${st ? `<span class="chip ${st === 1 ? "crit" : st === 2 ? "warn" : ""}">${PAIN_SEV[st - 1]}</span>` : "없음"}</td>
      <td><button class="btn link danger" type="button" data-act="delpain" data-id="${esc(c.id)}">삭제</button></td></tr>`; }).join("")}
  </tbody></table></div>`;
}
function coreHtml(p) {
  const all = runs(p.id).filter(isCoreHs), r = coreRuns(p.id), canAdd = canEditSelf(p);
  const first = r[0];
  const delta = (t, k) => !first || first === t || t[k] == null || first[k] == null ? "" : (() => { const v = Number(t[k]) - Number(first[k]); return ` <small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; })();
  const cell = (t, k) => t[k] == null ? "—" : t[k] + delta(t, k);
  return `<section class="sec"><h3>코어·핸드스탠드</h3>
    ${all.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>사이드 왼</th><th>사이드 오른</th><th>풀 플랭크</th><th>합계</th><th>핸드스탠드</th><th></th></tr></thead><tbody>
      ${all.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${cell(t, "sideL")}</td><td class="num">${cell(t, "sideR")}</td><td class="num">${cell(t, "plank")}</td>
        <td class="num">${coreSum(t) != null ? `<b>${coreSum(t)}</b>${first && first !== t ? ` <small class="${coreSum(t) - coreSum(first) < 0 ? "neg" : ""}">${coreSum(t) - coreSum(first) > 0 ? "+" : ""}${coreSum(t) - coreSum(first)}</small>` : ""}` : "—"}</td>
        <td>${hsText(t)}</td>
        <td>${state.admin || t.author === state.session.user.id ? `<button class="btn link danger" type="button" data-act="deltest" data-id="${esc(t.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
    ${canAdd ? `<details class="panel" data-keep="core-form" ${keepOpen("core-form", !all.length)}><summary><b>코어·핸드스탠드 입력</b></summary>
      <form class="f" id="coreForm" data-pid="${esc(p.id)}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="ct-date" value="${iso(today())}" required></label>
          <label class="fl">사이드 플랭크 왼 (초)<input type="number" id="ct-sl" inputmode="numeric" min="0" max="600"></label>
          <label class="fl">사이드 플랭크 오른 (초)<input type="number" id="ct-sr" inputmode="numeric" min="0" max="600"></label>
          <label class="fl">풀 플랭크 (초)<input type="number" id="ct-pl" inputmode="numeric" min="0" max="900"></label>
          ${hsStageSelect("ct-hs")}
          <label class="fl">버틴 시간 (초)<input type="number" id="ct-hsec" inputmode="numeric" min="0" max="120"></label>
          <label class="fl">워크 (m)<input type="number" id="ct-walk" inputmode="decimal" min="0" max="100" step="0.5"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">저장</button></div>
      </form></details>` : ""}
  </section>`;
}
const HS_SHORT = ["", "파이크 홀드", "백 투 월", "힐 풀", "프리스탠딩", "워크"];
const hsStageSelect = id => `<label class="fl">핸드스탠드 단계<select id="${id}"><option value="">—</option>${HS_SHORT.slice(1).map((n, i) => `<option value="${i + 1}">${i + 1} ${n}</option>`).join("")}</select></label>`;
/* ---------- 로그인 · 승인 대기 · 가입 정보 ---------- */
function viewAuth() {
  const login = state.authMode === "login";
  if (state.authMode === "reset") return `<section class="auth">
    <form class="f panel" id="resetForm">
      <div><h3>비밀번호 찾기</h3><p class="small muted">가입한 이메일로 새 비밀번호를 정하는 링크를 보내요.</p></div>
      <label class="fl">이메일<input type="email" id="rs-email" autocomplete="email" required></label>
      <div class="row"><button class="btn primary" type="submit">링크 보내기</button>
        <button class="btn link" type="button" data-act="authmode" data-m="login">로그인으로</button></div>
      ${state.authMsg ? `<p class="msg ${state.authErr ? "err" : ""}">${esc(state.authMsg)}</p>` : ""}
    </form></section>`;
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
      ${login ? `<button class="btn link small" type="button" data-act="authmode" data-m="reset">비밀번호를 잊었어요</button>` : ""}
      ${state.authMsg ? `<p class="msg ${state.authErr ? "err" : ""}">${esc(state.authMsg)}</p>` : ""}
    </form>
  </section>`;
}
// 새 비밀번호 (메일 링크로 들어왔을 때 · 로그인한 채 바꿀 때)
function viewNewPw() {
  return `<section class="auth"><form class="f panel" id="newPwForm">
    <div><h3>새 비밀번호</h3></div>
    <label class="fl">새 비밀번호 (6자 이상)<input type="password" id="np-1" autocomplete="new-password" minlength="6" required></label>
    <label class="fl">한 번 더<input type="password" id="np-2" autocomplete="new-password" minlength="6" required></label>
    <div class="row"><button class="btn primary" type="submit">바꾸기</button><button class="btn link" type="button" data-act="cancelpw">취소</button></div>
  </form></section>`;
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
        ${painRows("sf", pain)}
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
  const list = `<div class="plist">${ps.map(x => `<button type="button" data-act="edit" data-pid="${esc(x.id)}" aria-pressed="${x.id === pid}"><span>${esc(x.name)}</span><span class="chip pos">${esc(x.pos)}</span></button>`).join("")}
    <button type="button" data-act="edit" data-pid="__new" aria-pressed="${isNew}"><span>+ 새 선수</span></button></div>`;
  const opt = (v, cur) => `value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}`;
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
        <fieldset><legend>통증 · 부상 이력 <span class="private">본인·관리자만</span></legend>
          <h4 class="sub-h">지금 아픈 곳</h4>
          ${painRows("hf", pain)}
          <h4 class="sub-h">부상 이력</h4>
          ${injuryEditor("hf", h.injuries)}
          <div class="fields">
            <label class="fl">발목 다친 횟수 (왼)<input id="hf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
            <label class="fl">발목 다친 횟수 (오른)<input id="hf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
            <label class="fl wide">기타<input id="hf-note" maxlength="200" value="${esc(h.note || "")}"></label>
          </div>
        </fieldset>
        <fieldset><legend>개인 조정 <span class="private">관리자만 수정</span></legend>
          <div class="fields">
            <label class="fl wide">메모<input id="cu-memo" maxlength="120" value="${esc((h.custom || {}).memo || "")}"></label>
            <label class="fl wide">빼기 (쉼표로)<input id="cu-skip" maxlength="200" placeholder="예: 드롭 점프, 핸드스탠드" value="${esc(((h.custom || {}).skip || []).join(", "))}"></label>
            <label class="fl wide">바꾸기 (한 줄에 하나)<textarea id="cu-swap" rows="2" maxlength="400" placeholder="백스쿼트 → 고블릿 스쿼트">${esc(((h.custom || {}).swap || []).map(x => `${x.from} → ${x.to}`).join("\n"))}</textarea></label>
          </div>
        </fieldset>
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
      <label class="fl">버티컬 (cm)<input type="number" id="tf-vert" inputmode="decimal" step="0.5" min="0" max="150"></label>
      <label class="fl">맥스 버티컬 (cm)<input type="number" id="tf-maxvert" inputmode="decimal" step="0.5" min="0" max="150"></label>
      <label class="fl">CMJ (cm)<input type="number" id="tf-cmj" inputmode="decimal" step="0.1"></label>
      <label class="fl">스쿼트 5RM (kg)<input type="number" id="tf-squat" inputmode="decimal" step="2.5"></label>
      <label class="fl">RDL 5RM (kg)<input type="number" id="tf-rdl" inputmode="decimal" step="2.5"></label>
      <label class="fl">턱걸이 (회)<input type="number" id="tf-pull" inputmode="numeric" min="0" max="50"></label>
      <label class="fl">사이드 플랭크 왼 (초)<input type="number" id="tf-sl" inputmode="numeric" min="0" max="600"></label>
      <label class="fl">사이드 플랭크 오른 (초)<input type="number" id="tf-sr" inputmode="numeric" min="0" max="600"></label>
      <label class="fl">풀 플랭크 (초)<input type="number" id="tf-pl" inputmode="numeric" min="0" max="900"></label>
      ${hsStageSelect("tf-hsStage")}
      <label class="fl">버틴 시간 (초)<input type="number" id="tf-hsSec" inputmode="numeric" min="0" max="120"></label>
      <label class="fl">워크 (m)<input type="number" id="tf-hsWalk" inputmode="decimal" min="0" max="100" step="0.5"></label>
      <label class="fl">RSI<input type="number" id="tf-rsi" inputmode="decimal" step="0.01" min="0" max="5"></label>
      ${extraFields("tf")}
    </div>
    ${protocolHtml()}
    <div class="row"><button class="btn primary" type="submit">측정값 저장</button></div>
    ${r.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>리치</th><th>버티컬</th><th>맥스 버티컬</th><th>CMJ</th><th>핸드스탠드</th><th>스쿼트</th><th>RDL</th><th>턱걸이</th><th>기타</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td><td class="num">${t.reach ?? "—"}</td><td class="num">${vertOf(t) ?? "—"}</td><td class="num">${maxVertOf(t) ?? "—"}</td><td class="num">${t.cmj ?? "—"}</td><td>${hsText(t)}</td><td class="num">${t.squat ?? "—"}</td><td class="num">${t.rdl ?? "—"}</td><td class="num">${t.pull ?? "—"}</td><td class="small">${esc(extraText(t)) || "—"}</td>
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
      const spike = prev && prev.s > 0 && a.s >= 2 * prev.s;
      return `<td class="num ${spike ? "cell-warn" : ""}">${a.s.toLocaleString("ko-KR")}<br><span class="small">${a.n}건</span>${spike ? ' <span class="chip warn">2배↑</span>' : ""}</td>`;
    }).join("");
    return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td>${cells}</tr>`;
  }).join("");
  return `<section class="sec"><div><h2>훈련 부하</h2><p class="lede">주간 RPE×분 합(AU). 전주보다 2배 넘게 늘면 표시해요.</p></div>
  ${ps.length ? `<div class="tw"><table><thead><tr><th>선수</th>${mons.map(m => `<th>${md(parseD(m))}주${m === thisMon() ? " <span class=\"muted\">이번 주</span>" : ""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyLine("선수를 먼저 등록해 주세요.")}
  </section>
  ${ps.length ? teamReportHtml(ps) : ""}`;
}

function teamReportHtml(ps) {
  const ch = (rows, n) => { const r = rows.find(x => x[0] === n); if (!r) return "—"; const v = Math.round((r[2] - r[1]) * 10) / 10; return `${r[2]} <small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; };
  return `<section class="sec"><h3>선수별 리포트 <span class="small muted">최근 4주</span></h3>
    <div class="tw"><table><thead><tr><th>선수</th><th>컨디션</th><th>완료율</th><th>세션</th><th>맥스 버티컬</th><th>스쿼트 5RM</th><th>코어</th></tr></thead><tbody>
    ${ps.map(p => { const a = adherence(p.id), g = growthRows(p.id, p.weight);
      return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td><td class="num ${a.well != null && a.well <= WELL_LOW ? "cell-warn" : ""}">${a.well ?? "—"}</td><td class="num">${a.done != null ? a.done + "%" : "—"}</td><td class="num">${a.logs}</td>
        <td class="num">${ch(g, "맥스 버티컬")}</td><td class="num">${ch(g, "스쿼트 5RM")}</td><td class="num">${ch(g, "코어 합계")}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}

/* ---------- 일정 (1년: 3월 → 다음 해 2월) ---------- */
function viewSeason() {
  const t = iso(today()), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  const sy = m >= 3 ? y : y - 1, from = `${sy}-03-01`, to = `${sy + 1}-02-28`;
  const evs = normEvents(events());
  const list = evs.filter(e => e.end >= from && e.start <= to);
  const range = e => e.start === e.end ? longDate(parseD(e.start)) : `${md(parseD(e.start))} – ${md(parseD(e.end))}`;
  // 앞으로 8주 흐름
  const weeks = Array.from({ length: 8 }, (_, k) => dAdd(thisMon(), 7 * k)).map(mon => {
    const infos = DAYS.map((_, d) => infoOn(dAdd(mon, d)));
    const i = infos[3], tag = infos.some(x => x.slot === "match") ? "cup" : infos.every(x => x.optional) ? "opt" : i.measure ? "test" : "";
    const note = i.measure === "jump" ? "점프 측정" : i.measure ? "측정" : "";
    return `<li class="${tag}"><span class="num">${md(parseD(mon))}</span><span>${esc(weekLabel(mon).replace(/^[12]학기 · 정규 훈련 [^ ]+ · /, ""))}${note ? ` <span class="chip">${note}</span>` : ""}</span></li>`;
  }).join("");
  return `<section class="sec"><div><h2>일정 <span class="small muted">${sy}.3 – ${sy + 1}.2</span></h2>
    </div></section>
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
          <div class="pair"><label class="fl">시작<input type="date" id="ev-start" required></label>
          <label class="fl">끝<input type="date" id="ev-end"></label></div>
          <label class="fl wide">메모<input id="ev-note" maxlength="100" placeholder="예: 본선 진출 시에만"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">추가</button></div>
      </form>` : ""}
    </section>${state.admin ? teamOffHtml() : ""}</div>
    <div class="col"><section class="sec"><h3>앞으로 8주</h3><ul class="season-weeks">${weeks}</ul></section></div>
  </div>`;
}

function teamOffHtml() {
  const t = iso(today()), list = Object.entries(state.teamOff).filter(([d]) => d >= dAdd(t, -14)).sort();
  return `<section class="sec"><h3>정규 훈련 없는 날</h3>
    ${list.length ? `<ul class="watch">${list.map(([d, o]) => `<li><span class="num">${longDate(parseD(d))}</span>${o.note ? `<span class="small muted">${esc(o.note)}</span>` : ""}<button class="btn link danger" type="button" data-act="teamoff" data-date="${esc(d)}">취소</button></li>`).join("")}</ul>` : ""}
    <form class="f panel" id="offForm"><div class="fields">
      <label class="fl">날짜<input type="date" id="off-date" required></label>
      <label class="fl">메모<input id="off-note" maxlength="60" placeholder="예: 체육관 통제"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div></form>
  </section>`;
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
  document.getElementById("t-mode").textContent = timer.label || "";
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
// 진행 중에도 남은 시간을 더하고 뺌
function timerAdd(d) {
  timer.total = Math.max(5, timer.total + d);
  if (timer.running) timer.base = Math.max(1, timer.base + d);
  timer.left = Math.max(0, timer.left + d);
  timerDraw();
}
// 기본 시간: 처방에 시간이 있으면 그 시간, 없으면 세트 사이 휴식(설명의 '세트 간 N분'), 그것도 없으면 60초
function defaultSeconds(rx, cue) {
  const s = exSeconds(rx);
  if (s) return [s, "운동 시간"];
  const m = String(cue || "").match(/세트 간\s*(\d+)\s*(분|초)/);
  if (m) return [Number(m[1]) * (m[2] === "분" ? 60 : 1), "세트 사이 휴식"];
  return [60, "세트 사이 휴식"];
}
// 운동 창의 세트 기록: 처방(추천 무게·반복·RIR) → 지난번 기록 순으로 채워 둠
const liftName = n => baseName(n).slice(0, 80);
const dayWord = d => d === iso(today()) ? "오늘" : md(parseD(d));
function setLogHtml(name, rx) {
  const ctx = state.planCtx;
  if (!ctx || !isLoadable(name)) return "";
  const nm = liftName(name), mine = liftsOf(ctx.pid).filter(l => l.name === nm);
  const todays = mine.filter(l => l.date === ctx.date), last = mine.filter(l => l.date < ctx.date).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const sugg = String(rx).match(/약 ([\d.]+)kg/), reps = String(rx).match(/(\d+)\s*×\s*(\d+)/), rir = String(rx).match(/RIR\s*(\d)/);
  const kg = todays.length ? todays.at(-1).kg : sugg ? sugg[1] : last ? last.kg : "";
  const rp = todays.length ? todays.at(-1).reps : reps ? reps[2] : last ? last.reps : "";
  const ri = rir ? Number(rir[1]) : 2;
  return `<form class="setlog" id="setForm" data-pid="${esc(ctx.pid)}" data-date="${esc(ctx.date)}" data-name="${esc(nm)}">
    <div class="setlog-row">
      <label>무게 (kg)<input type="number" id="ls-kg" inputmode="decimal" step="0.5" min="0.5" max="400" value="${esc(kg)}" required></label>
      <label>반복<input type="number" id="ls-reps" inputmode="numeric" min="1" max="20" value="${esc(rp)}" required></label>
      <label>RIR<select id="ls-rir">${[0, 1, 2, 3, 4, 5].map(v => `<option value="${v}" ${v === ri ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <button class="btn primary" type="submit">세트 저장</button>
    </div>
    ${!kg ? `<p class="small muted">처음이면 가볍게 시작해 세트마다 올려서, 목표 반복을 하고도 2–3회 더 할 수 있는 무게를 찾아 저장 → 다음부터 무게가 자동으로 나와요</p>` : ""}
    <p class="small muted" id="ls-done">${todays.length ? `${dayWord(ctx.date)} ${todays.map(l => `${l.kg}×${l.reps}`).join(", ")}` : ""}${last ? `${todays.length ? " · " : ""}지난번 ${last.kg}kg × ${last.reps}` : ""}</p>
  </form>`;
}
function openSheet(name, rx, cue) {
  const steps = exGuide(name) || [], [sec, label] = defaultSeconds(rx, cue), link = exLink(name);
  timer.label = label;
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `
    <div class="row between"><h3>${esc(name)}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    ${rx ? `<p class="sheet-rx">${esc(fmtRx(rx))}</p>` : ""}
    ${steps.length ? `<ol class="sheet-steps">${steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
    ${cue ? `<p class="small muted">${esc(cue)}</p>` : ""}
    ${link ? `<p><a class="exlink" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">운동 가이드 · ${esc(link.src)} ↗</a></p>` : ""}
    ${setLogHtml(name, rx)}
    <div class="timer"><div class="t-time" id="t-time">0:00</div><div class="small muted" id="t-mode"></div>
      <div class="row center"><button class="btn primary" type="button" id="t-go" data-act="tgo">시작</button><button class="btn" type="button" data-act="treset">다시</button></div>
      <div class="row center chips-t">${[-30, -15, 15, 30].map(v => `<button class="btn chip-t" type="button" data-act="tadd" data-s="${v}">${v > 0 ? "+" : "−"}${Math.abs(v)}초</button>`).join("")}</div></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  timer.def = sec;
  timerSet(sec);
}
async function saveSetFrom(f) {
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  const row = { player_id: f.dataset.pid, date: f.dataset.date, name: f.dataset.name, lift: liftKey(f.dataset.name), kg: num("ls-kg"), reps: num("ls-reps"), rir: Number(document.getElementById("ls-rir").value) };
  try {
    const w = await dbWrite("lift_sets", "insert", row);
    (state.lifts[row.player_id] = state.lifts[row.player_id] || []).push({ ...row, id: w.queued ? "q" : undefined, author: state.session.user.id });
    const todays = liftsOf(row.player_id).filter(l => l.name === row.name && l.date === row.date);
    document.getElementById("ls-done").textContent = `${dayWord(row.date)} ${todays.map(l => `${l.kg}×${l.reps}`).join(", ")}`;
    toast(`${row.kg}kg × ${row.reps} 저장`);
  } catch (e) { toast(failMsg(e)); }
  finally { btn.disabled = false; }
}
/* ---------- 운동 따라가기 ----------
 * 그날 프로그램을 운동 하나씩: 세트를 누르면 다음 세트까지 휴식 타이머가 자동으로 돌고, 무게도 그 자리에서 기록.
 * 끝나면 RPE와 완료율(한 세트 수 ÷ 처방 세트 수)·시간을 채워 세션 기록으로 저장. 중간에 닫아도 이어서 할 수 있음 (이 기기). */
const setsOf = rx => {
  const r = String(rx || "");
  const t = r.match(/(\d+)\s*(?:초|분)\s*×\s*(\d+)/); if (t) return Math.min(6, +t[2]);
  const a = r.match(/(\d+)\s*×/); if (a) return Math.min(6, +a[1]);
  const b = r.match(/(\d+)\s*세트/); if (b) return Math.min(6, +b[1]);
  return 1;
};
const restOf = (x, blk) => { const m = String(x.cue || "").match(/세트 간\s*(\d+)\s*(분|초)/); return m ? +m[1] * (m[2] === "분" ? 60 : 1) : ["str", "thu2"].includes(blk) ? 90 : 60; };
const RUN_KEY = () => "snuvt-run-" + uid();
function startRun(pid, date) {
  const plan = planOn(playerOf(pid), date);
  const steps = plan.blocks.flatMap(b => b.items.filter(x => !/^(통증 체크|세션 RPE 기록|정규 훈련|휴식)/.test(x.name)).map(x => ({ name: x.name, rx: x.rx ?? "", cue: x.cue || "", mod: x.mod || "", blk: b.key, title: b.title, sets: setsOf(x.rx) })));
  if (!steps.length) { toast("오늘은 따라갈 운동이 없어요"); return; }
  state.run = { pid, date, steps, i: 0, done: {}, start: Date.now(), logType: plan.logType, minutes: plan.minutes, title: plan.title };
  lsSet(RUN_KEY(), state.run);
  openRun();
}
function openRun() {
  const r = state.run; if (!r) return;
  state.planCtx = { pid: r.pid, date: r.date };
  const el = document.getElementById("sheet"), body = el.querySelector(".sheet-body");
  if (r.i >= r.steps.length) { body.innerHTML = runFinishHtml(); el.hidden = false; document.body.classList.add("noscroll"); return; }
  const x = r.steps[r.i], done = r.done[r.i] || 0, steps = exGuide(x.name) || [], link = exLink(x.name), work = exSeconds(x.rx);
  body.innerHTML = `<div class="run">
    <div class="row between"><span class="small muted">${esc(x.title)} · ${r.i + 1}/${r.steps.length}</span><button class="btn link" type="button" data-act="runclose">닫기</button></div>
    <div class="runbar"><span style="width:${Math.round(100 * r.i / r.steps.length)}%"></span></div>
    <h3>${esc(x.name)}${x.mod ? ` <span class="mod">${esc(x.mod)}</span>` : ""}</h3>
    ${x.rx ? `<p class="sheet-rx">${esc(fmtRx(x.rx))}</p>` : ""}
    ${steps.length ? `<details class="run-how"><summary class="small">하는 법</summary><ol class="sheet-steps">${steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>${x.cue ? `<p class="small muted">${esc(x.cue)}</p>` : ""}</details>` : x.cue ? `<p class="small muted">${esc(x.cue)}</p>` : ""}
    ${link ? `<p><a class="exlink" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">운동 가이드 · ${esc(link.src)} ↗</a></p>` : ""}
    <div class="setdots">${Array.from({ length: x.sets }, (_, k) => `<span class="${k < done ? "on" : ""}">${k + 1}</span>`).join("")}</div>
    <div class="row center"><button class="btn primary big" type="button" data-act="runset" ${done >= x.sets ? "disabled" : ""}>${done >= x.sets ? "다 했어요" : `${done + 1}세트 완료`}</button></div>
    ${setLogHtml(x.name, x.rx)}
    <div class="timer"><div class="t-time" id="t-time">0:00</div><div class="small muted" id="t-mode"></div>
      <div class="row center"><button class="btn" type="button" id="t-go" data-act="tgo">시작</button><button class="btn" type="button" data-act="treset">다시</button></div>
      <div class="row center chips-t">${[-30, -15, 15, 30].map(v => `<button class="btn chip-t" type="button" data-act="tadd" data-s="${v}">${v > 0 ? "+" : "−"}${Math.abs(v)}초</button>`).join("")}</div></div>
    <div class="row between runnav"><button class="btn" type="button" data-act="runprev" ${r.i ? "" : "disabled"}>이전</button><button class="btn primary" type="button" data-act="runnext">${r.i + 1 < r.steps.length ? "다음 운동" : "마치기"}</button></div></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  const sec = work || restOf(x, x.blk);
  timer.label = work ? "운동 시간" : "세트 사이 휴식"; timer.def = sec; timerSet(sec);
}
function runFinishHtml() {
  const r = state.run, total = r.steps.reduce((a, x) => a + x.sets, 0), did = r.steps.reduce((a, x, i) => a + Math.min(x.sets, r.done[i] || 0), 0);
  const pct = total ? did / total : 0, comp = pct >= 0.9 ? "all" : pct >= 0.3 ? "part" : "none";
  const mins = Math.max(1, Math.min(400, Math.round((Date.now() - r.start) / 60000)));
  return `<div class="row between"><h3>${esc(r.title)} 끝</h3><button class="btn link" type="button" data-act="runclose">닫기</button></div>
    <p class="small muted">${did}/${total}세트 · ${mins}분</p>
    <form class="f" id="runForm"><div class="fields">
      <label class="fl">힘든 정도 (RPE)<select id="rn-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 6 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">완료율<select id="rn-done">${[["all", "100%"], ["part", "50%"], ["none", "0%"]].map(([v, l]) => `<option value="${v}" ${v === comp ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">시간 (분)<input type="number" id="rn-min" inputmode="numeric" min="1" max="400" value="${mins < 10 ? r.minutes : mins}"></label>
    </div><div class="row"><button class="btn primary" type="submit">세션 기록 저장</button><button class="btn link" type="button" data-act="runback">운동으로 돌아가기</button></div></form>`;
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
const savedMode = () => { try { return localStorage.getItem("snuvt-mode"); } catch (e) { return null; } };
function setMode(admin) {
  state.admin = admin; state.pid = null; state.editPid = null; state.dirty = false;
  try { localStorage.setItem("snuvt-mode", admin ? "admin" : "player"); } catch (e) {}
  if (!admin && ["intake", "load"].includes(state.view)) state.view = "home";
  render(); window.scrollTo(0, 0);
}
const needsSelfReg = () => state.session && state.role === "player" && !state.myPid && state.loaded;
function render() {
  flowCache.clear();
  header();
  if (state.dirty) return; // 입력 중인 폼은 덮어쓰지 않음
  let html;
  if (state.booting) html = `<div class="panel empty"><strong>불러오는 중</strong></div>`;
  else if (state.offline) html = offlineHtml();
  else if (!state.session) html = viewAuth();
  else if (state.recovery) html = viewNewPw();
  else if (!state.role || state.role === "pending") html = viewPending();
  else if (needsSelfReg() || (state.coach && state.editingSelf)) html = viewSelfReg();
  else {
    const v = state.view;
    html = v === "plan" ? viewPlan() : v === "rec" ? viewRec() : v === "season" ? viewSeason() : v === "intake" ? viewIntake() : v === "load" ? viewLoad() : viewHome();
  }
  const q = state.session ? queue().length : 0;
  const bar = state.loaded && (state.net === false || q) ? `<div class="netbar">${state.net === false ? "오프라인 · 마지막으로 불러온 내용" : "기록 올리는 중"}${q ? ` · 올라갈 기록 ${q}건` : ""}</div>` : "";
  document.getElementById("main").innerHTML = bar + html;
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
  if (act === "view") { ev.preventDefault(); return go(b.dataset.v); }
  if (act === "addinj") { document.getElementById(b.dataset.prefix + "-inj").insertAdjacentHTML("beforeend", injRowHtml()); state.dirty = true; return; }
  if (act === "delinj") { b.closest(".inj-row").remove(); state.dirty = true; return; }
  if (act === "ex") return openSheet(b.dataset.n, b.dataset.r, b.dataset.c);
  if (act === "gorec") {
    const focus = b.dataset.focus;
    if (focus === "pain") state.openKeys["pain-rec"] = true;
    go("rec");
    const el = document.getElementById(focus === "pain" ? "painForm" : "logForm");
    if (el) { el.scrollIntoView({ block: "center" }); const f = el.querySelector(focus === "pain" ? "select" : "#lg-rpe"); if (f) f.focus(); }
    return;
  }
  if (act === "tadd") return timerAdd(Number(b.dataset.s));
  if (act === "pick" || act === "unpick") {
    const pid = b.dataset.pid, date = b.dataset.date;
    try {
      const back = act === "unpick" || b.dataset.rec === "1"; // 권고를 누르면 고른 걸 지우고 흐름대로
      if (back) ok(await sb.from("day_picks").delete().eq("player_id", pid).eq("date", date));
      else ok(await sb.from("day_picks").upsert({ player_id: pid, date, pick: b.dataset.k }, { onConflict: "player_id,date" }));
      const m = state.picks[pid] = state.picks[pid] || {};
      if (back) delete m[date]; else m[date] = b.dataset.k;
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render();
  }
  if (act === "teamoff") {
    const date = b.dataset.date;
    try {
      if (state.teamOff[date]) { ok(await sb.from("team_off").delete().eq("date", date)); delete state.teamOff[date]; toast("정규 훈련 있음으로 돌렸어요"); }
      else { ok(await sb.from("team_off").insert({ date })); state.teamOff[date] = { note: "" }; toast("정규 훈련 없음 · 선수들이 골라서 해요"); }
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render();
  }
  if (act === "sheetclose") return closeSheet();
  if (act === "runstart") return startRun(b.dataset.pid, b.dataset.date);
  if (act === "runresume") { state.run = state.run || lsGet(RUN_KEY()); return openRun(); }
  if (act === "runclose") { closeSheet(); state.dirty = false; return render(); }
  if (state.run && ["runset", "runprev", "runnext", "runback"].includes(act)) {
    const r = state.run;
    if (act === "runset") {
      const sf = document.getElementById("setForm"), kg = document.getElementById("ls-kg");
      if (sf && kg && kg.value) await saveSetFrom(sf); // 무게를 적었으면 세트와 함께 저장
      const x = r.steps[r.i]; r.done[r.i] = Math.min(x.sets, (r.done[r.i] || 0) + 1); lsSet(RUN_KEY(), r);
      const more = r.done[r.i] < x.sets, work = exSeconds(x.rx);
      openRun();
      if (more) { const rest = work ? restOf(x, x.blk) : timer.def; timer.label = "세트 사이 휴식"; timerSet(rest); timerToggle(); }
      return;
    }
    if (act === "runprev") r.i = Math.max(0, r.i - 1);
    if (act === "runnext") r.i = Math.min(r.steps.length, r.i + 1);
    if (act === "runback") r.i = r.steps.length - 1;
    lsSet(RUN_KEY(), r); return openRun();
  }
  if (act === "tgo") return timerToggle();
  if (act === "treset") return timerSet(timer.def || timer.total);
  if (act === "tset") return timerSet(Number(b.dataset.s));
  if (act === "week") { state.week = b.dataset.m; state.day = null; state.dirty = false; return render(); }
  if (act === "day") { state.day = Number(b.dataset.d); state.dirty = false; return render(); }
  if (act === "openday") { state.week = b.dataset.m; state.day = Number(b.dataset.d); state.pid = state.myPid; return go("plan"); }
  if (act === "open") { state.pid = b.dataset.pid; state.week = null; state.day = null; return go("plan"); }
  if (act === "edit") { state.editPid = b.dataset.pid; state.dirty = false; state.armed = null; return render(); }
  if (act === "authmode") { state.authMode = b.dataset.m || (state.authMode === "login" ? "signup" : "login"); state.authMsg = ""; state.dirty = false; return render(); }
  if (act === "pwchange") { state.recovery = true; state.dirty = false; return render(); }
  if (act === "cancelpw") { state.recovery = false; state.dirty = false; return render(); }
  if (act === "logout") { lsDel(snapKey()); await pushOff(true); await sb.auth.signOut(); return; }
  if (act === "pushopen") return openPush();
  if (act === "pushon") return pushOn();
  if (act === "pushoff") return pushOff();
  if (act === "mode") return setMode(!state.admin);
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
    if (!confirmDel(`${who} 계정을 삭제할까요?\n선수 정보와 측정·기록·부상 정보가 모두 함께 지워져요.`)) return;
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
  if (["delplayer", "deltest", "dellog", "delpain", "delevent", "dellift"].includes(act)) {
    const msg = { dellift: "이 세트 기록을 삭제할까요?", delevent: "이 일정을 삭제할까요?\n프로그램이 바로 다시 맞춰져요.", delplayer: `${(state.players[b.dataset.pid] || {}).name || "이 선수"}를 삭제할까요?\n측정·기록·부상 정보도 함께 지워져요.`, deltest: "이 측정 기록을 삭제할까요?", dellog: "이 세션 기록을 삭제할까요?", delpain: "이 통증 기록을 삭제할까요?" }[act];
    if (!confirmDel(msg)) return;
    try {
      if (act === "delplayer") { ok(await sb.from("players").delete().eq("id", b.dataset.pid)); state.editPid = null; } // 부상·측정·기록도 함께 삭제됨
      else ok(await sb.from({ deltest: "tests", dellog: "logs", delpain: "pain_checks", delevent: "events", dellift: "lift_sets" }[act]).delete().eq("id", b.dataset.id));
      toast("삭제했어요");
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
});
document.addEventListener("change", ev => {
  if (ev.target.classList.contains("inj-part")) {
    const row = ev.target.closest(".inj-row"), t = row.querySelector(".inj-type");
    t.innerHTML = injTypes(ev.target.value).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    row.querySelector(".inj-finger").hidden = ev.target.value !== "finger";
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

// 개인 조정 (관리자): 메모 · 빼기 · 바꾸기("원래 → 바꿀 것")
function readCustom() {
  const memo = txt("cu-memo"), skip = txt("cu-skip").split(/[,，]/).map(x => x.trim()).filter(Boolean).slice(0, 20);
  const swap = document.getElementById("cu-swap").value.split("\n").map(l => l.split(/\s*(?:→|->|=>)\s*/)).filter(a => a.length === 2 && a[0].trim() && a[1].trim()).map(([a, b]) => ({ from: a.trim(), to: b.trim() })).slice(0, 20);
  return { ...(memo ? { memo } : {}), ...(skip.length ? { skip } : {}), ...(swap.length ? { swap } : {}) };
}
const num = id => { const v = document.getElementById(id).value; return v === "" ? null : Number(v); };
const txt = id => document.getElementById(id).value.trim();

document.addEventListener("submit", async ev => {
  ev.preventDefault();
  const f = ev.target;
  if (!sb) return toast("서버에 연결되어 있지 않아요.");
  if (f.id === "runForm") {
    const r = state.run, btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      const w = await dbWrite("logs", "insert", { player_id: r.pid, date: r.date, type: r.logType || "other", minutes: num("rn-min") || r.minutes || 1, rpe: Number(document.getElementById("rn-rpe").value), pain: 0, note: null, completion: document.getElementById("rn-done").value });
      toast(w.queued ? "연결되면 저장돼요" : "세션을 기록했어요");
      state.run = null; lsDel(RUN_KEY()); closeSheet(); state.dirty = false; await loadAll();
    } catch (e) { toast(failMsg(e)); } finally { btn.disabled = false; }
    return;
  }
  if (f.id === "setForm") { await saveSetFrom(f); return; }
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

  if (f.id === "resetForm") {
    try {
      const r = await sb.auth.resetPasswordForEmail(txt("rs-email"), { redirectTo: location.origin + location.pathname });
      state.authErr = !!r.error;
      state.authMsg = r.error ? (/rate|seconds/i.test(r.error.message) ? "잠시 뒤에 다시 보내 주세요." : "보내지 못했어요: " + r.error.message) : "메일을 보냈어요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.";
    } finally { if (btn) btn.disabled = false; }
    state.dirty = false; render(); return;
  }
  if (f.id === "newPwForm") {
    const a = document.getElementById("np-1").value, b2 = document.getElementById("np-2").value;
    try {
      if (a !== b2) { toast("두 비밀번호가 달라요."); return; }
      const r = await sb.auth.updateUser({ password: a });
      if (r.error) { toast(/different|same/i.test(r.error.message) ? "지금 비밀번호와 다르게 정해 주세요." : "바꾸지 못했어요: " + r.error.message); return; }
      state.recovery = false; state.dirty = false; toast("비밀번호를 바꿨어요"); render();
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
        rehab: [], consent: true, updated_at: new Date().toISOString(), custom: readCustom(),
      }));
      state.editPid = id;
      toast(prevPid ? "저장했어요" : `${name} 선수를 추가했어요`);
    } else if (f.id === "testForm") {
      const st = document.getElementById("tf-hsStage").value;
      const row = {
        player_id: f.dataset.pid, date: txt("tf-date"),
        reach: num("tf-reach"), cmj: num("tf-cmj"), vert: num("tf-vert"), max_vert: num("tf-maxvert"),
        hs_stage: st ? Number(st) : null, hs_sec: num("tf-hsSec"), hs_walk: num("tf-hsWalk"),
        squat: num("tf-squat"), rdl: num("tf-rdl"), pull: num("tf-pull"),
        side_l: num("tf-sl"), side_r: num("tf-sr"), plank: num("tf-pl"),
      };
      readExtra("tf", row);
      const filled = Object.entries(row).filter(([k, v]) => !["player_id", "date"].includes(k) && v != null && !Number.isNaN(v));
      if (!filled.length) { toast("측정값을 하나 이상 입력해 주세요."); return; }
      ok(await sb.from("tests").insert(row));
      toast("측정값을 저장했어요");
    } else if (f.id === "painForm") {
      const w = f.dataset.where;
      const pw = await dbWrite("pain_checks", "insert", {
        player_id: f.dataset.pid, date: txt("pc-date-" + w), area: document.getElementById("pc-area-" + w).value,
        during: Number(document.getElementById("pc-d-" + w).value), morning: Number(document.getElementById("pc-m-" + w).value),
        rest: document.getElementById("pc-r-" + w).checked,
      });
      toast(pw.queued ? "연결되면 저장돼요" : "통증을 기록했어요");
    } else if (f.id === "coreForm") {
      const hs = document.getElementById("ct-hs").value;
      const row = { player_id: f.dataset.pid, date: txt("ct-date"), side_l: num("ct-sl"), side_r: num("ct-sr"), plank: num("ct-pl"), hs_stage: hs ? Number(hs) : null, hs_sec: num("ct-hsec"), hs_walk: num("ct-walk") };
      const core = [row.side_l, row.side_r, row.plank].filter(v => v != null).length;
      if (core && core < 3) { toast("코어는 세 가지를 모두 입력해 주세요."); return; }
      if (!core && row.hs_stage == null && row.hs_walk == null && row.hs_sec == null) { toast("값을 하나 이상 입력해 주세요."); return; }
      if ((row.hs_sec != null || row.hs_walk != null) && row.hs_stage == null) { toast("핸드스탠드 단계를 골라 주세요."); return; }
      toast((await dbWrite("tests", "insert", row)).queued ? "연결되면 저장돼요" : "저장했어요");
    } else if (f.id === "measureForm") {
      const g = id => document.getElementById(id) ? num(id) : null;
      const row = { player_id: f.dataset.pid, date: txt("ms-date"), reach: g("ms-reach"), vert: g("ms-vert"), max_vert: g("ms-maxvert"), cmj: g("ms-cmj"), squat: g("ms-squat"), rdl: g("ms-rdl"), pull: g("ms-pull") };
      readExtra("ms", row);
      if (!Object.entries(row).some(([k, v]) => !["player_id", "date"].includes(k) && v != null)) { toast("값을 하나 이상 입력해 주세요."); return; }
      toast((await dbWrite("tests", "insert", row)).queued ? "연결되면 저장돼요" : "측정을 저장했어요");
    } else if (f.id === "eventForm") {
      const start = txt("ev-start"), end = txt("ev-end") || start;
      if (end < start) { toast("끝 날짜가 시작보다 앞이에요."); return; }
      ok(await sb.from("events").insert({ name: txt("ev-name"), kind: document.getElementById("ev-kind").value, start_date: start, end_date: end, note: txt("ev-note") || null }));
      toast("일정을 추가했어요. 프로그램이 맞춰졌어요.");
    } else if (f.id === "logForm") {
      const lw = await dbWrite("logs", "insert", {
        player_id: f.dataset.pid, date: txt("lg-date"), type: document.getElementById("lg-type").value,
        minutes: num("lg-min") || 1, rpe: Number(document.getElementById("lg-rpe").value),
        pain: 0, note: txt("lg-note") || null, completion: document.getElementById("lg-done").value,
      });
      toast(lw.queued ? "연결되면 저장돼요" : "기록했어요");
    } else if (f.id === "offForm") {
      const date = txt("off-date");
      if (seasonDay(date, events()).slot !== "team") { toast("그날은 정규 훈련 날이 아니에요."); return; }
      ok(await sb.from("team_off").upsert({ date, note: txt("off-note") || null }));
      toast("정규 훈련 없음 · 선수들이 골라서 해요");
    } else if (f.id === "wellForm") {
      const row = { player_id: f.dataset.pid, date: iso(today()) };
      for (const [k] of WELL_KEYS) row[k] = Number(document.getElementById("wl-" + k).value);
      row.stress = row.mood; // 기분·스트레스를 한 문항으로
      state.openKeys["well-form"] = false;
      await dbWrite("wellness", "upsert", row, { onConflict: "player_id,date" });
      toast(readiness(row, lastRpeBefore(f.dataset.pid, row.date)).length ? "저장했어요 · 오늘은 회복 버전" : "저장했어요");
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
  let r;
  try { r = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle(); } catch (e) { r = { error: e }; }
  if (r.error) {
    // 연결이 없으면 이 기기에 저장해 둔 것으로
    const snap = isNetErr(r.error) ? lsGet(snapKey()) : null;
    if (!snap || !snap.me) { state.offline = true; state.booting = false; render(); return; }
    r = { data: { role: snap.me.role, player_id: snap.me.player_id } };
  }
  state.role = r.data ? r.data.role : "pending";
  state.myPid = r.data ? r.data.player_id : null;
  state.coach = state.role === "coach";
  state.admin = state.coach && savedMode() !== "player"; // 관리자는 관리자 화면 ↔ 선수 화면 전환
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
/* ---------- 오프라인 ----------
 * 마지막으로 불러온 데이터를 이 기기에 저장해 두고(로그아웃하면 지움), 연결이 없으면 그걸로 화면을 보여 준다.
 * 연결이 없을 때 저장한 기록(세션·통증·컨디션·세트·코어·측정)은 이 기기에 모아 뒀다가 연결되면 올린다. */
const uid = () => (state.session && state.session.user && state.session.user.id) || "anon";
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const snapKey = () => "snuvt-snap-" + uid(), queueKey = () => "snuvt-queue-" + uid();
const queue = () => lsGet(queueKey()) || [];
const isNetErr = e => !navigator.onLine || /fetch|network|load failed|timed? ?out|aborted/i.test(String((e && (e.message || e.details)) || e || ""));
// 저장: 연결이 없으면 모아 둠 → { queued: true }
async function dbWrite(table, op, row, opts) {
  try {
    const q = sb.from(table), r = op === "upsert" ? await q.upsert(row, opts) : await q.insert(row);
    if (r.error) throw r.error;
    return { ok: true };
  } catch (e) {
    if (!isNetErr(e)) throw e;
    const list = queue(); list.push({ table, op, row, opts: opts || null, at: Date.now() }); lsSet(queueKey(), list);
    state.net = false;
    return { queued: true };
  }
}
let flushing = false;
async function flushQueue() {
  if (flushing || !sb || !state.session) return;
  let list = queue(); if (!list.length) return;
  flushing = true; let sent = 0;
  try {
    while (list.length) {
      const it = list[0];
      try {
        const q = sb.from(it.table), r = it.op === "upsert" ? await q.upsert(it.row, it.opts || undefined) : await q.insert(it.row);
        if (r.error && isNetErr(r.error)) break;
        if (r.error) toast("저장하지 못한 기록이 있어요 (" + it.table + ")");
        else sent++;
      } catch (e) { if (isNetErr(e)) break; }
      list.shift(); lsSet(queueKey(), list);
    }
  } finally { flushing = false; }
  if (sent) { toast(`모아 둔 기록 ${sent}건을 올렸어요`); await loadAll(); }
}
// 모아 둔 기록을 화면 데이터에 더하기 (올라가기 전에도 보이게)
function withQueued(raw) {
  const out = { ...raw };
  queue().forEach((it, i) => {
    if (!Array.isArray(out[it.table])) return;
    const row = { id: "q" + i, created_at: new Date(it.at).toISOString(), author: uid(), ...it.row };
    let arr = out[it.table];
    if (it.table === "wellness") arr = arr.filter(r => !(r.player_id === row.player_id && r.date === row.date));
    out[it.table] = [...arr, row];
  });
  return out;
}
async function loadAll() {
  let raw = null;
  try {
    const q = [
      sb.from("settings").select("*").maybeSingle(),
      sb.from("players").select("*"),
      sb.from("tests").select("*").order("date"),
      sb.from("health").select("*"),
      sb.from("logs").select("*").order("date"),
      sb.from("pain_checks").select("*").order("date"),
      sb.from("events").select("*").order("start_date"),
      sb.from("wellness").select("*").order("date"),
      sb.from("lift_sets").select("*").order("date"),
      sb.from("team_off").select("*"),
      sb.from("day_picks").select("*"),
    ];
    if (state.coach) q.push(sb.from("profiles").select("*").order("created_at"));
    const res = await Promise.all(q);
    const [st, pl, ts, hl, lg, pcs, evq, wq, lq, toq, dpq] = res, pr = state.coach ? res[11] : null;
    for (const r of [pl, ts, hl, lg]) if (r.error) throw r.error;
    const rows = r => r && !r.error && Array.isArray(r.data) ? r.data : [];
    raw = { players: pl.data, tests: ts.data, health: hl.data, logs: lg.data, pain_checks: rows(pcs), events: evq && !evq.error ? evq.data : null,
      wellness: rows(wq), lift_sets: rows(lq), team_off: rows(toq), day_picks: rows(dpq), profiles: pr && !pr.error ? pr.data : [],
      me: { role: state.role, player_id: state.myPid } };
    lsSet(snapKey(), raw); state.net = true;
  } catch (e) {
    raw = lsGet(snapKey());
    if (!raw) { state.offline = true; render(); return; }
    state.net = false;
  }
  buildState(withQueued(raw));
  state.loaded = true; state.offline = false;
  render();
  if (state.net && queue().length) flushQueue();
}
function buildState(raw) {
  const n = v => v == null ? null : Number(v);
  const wel = {};
  for (const r of raw.wellness || []) (wel[r.player_id] = wel[r.player_id] || []).push({ id: r.id, date: r.date, sleep: r.sleep, fatigue: r.fatigue, soreness: r.soreness, stress: r.stress, mood: r.mood });
  state.wellness = wel;
  const lif = {};
  for (const r of raw.lift_sets || []) (lif[r.player_id] = lif[r.player_id] || []).push({ id: r.id, date: r.date, name: r.name, lift: r.lift, kg: Number(r.kg), reps: r.reps, rir: r.rir, author: r.author, created: r.created_at });
  state.lifts = lif;
  state.teamOff = Object.fromEntries((raw.team_off || []).map(r => [r.date, { note: r.note }]));
  const pk = {};
  for (const r of raw.day_picks || []) (pk[r.player_id] = pk[r.player_id] || {})[r.date] = r.pick;
  state.picks = pk;
  state.events = raw.events ? raw.events.map(r => ({ id: r.id, name: r.name, kind: r.kind, start: r.start_date, end: r.end_date, note: r.note })) : null;
  state.players = Object.fromEntries((raw.players || []).map(r => [r.id, {
    name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp,
    weightExp: wexpNorm(r.weight_exp), adjust: r.adjust || {}, order: r.sort,
  }]));
  const tests = {};
  for (const r of raw.tests || []) {
    (tests[r.player_id] = tests[r.player_id] || { runs: [] }).runs.push({
      id: r.id, date: r.date, reach: r.reach, cmj: r.cmj, block: r.block, approach: r.approach,
      vert: n(r.vert), maxVert: n(r.max_vert), hsStage: r.hs_stage, hsSec: r.hs_sec, hsWalk: n(r.hs_walk), squat: r.squat, rdl: r.rdl, pull: r.pull,
      sideL: r.side_l, sideR: r.side_r, plank: r.plank, author: r.author,
      rsi: n(r.rsi), ktwL: n(r.ktw_l), ktwR: n(r.ktw_r), irD: n(r.ir_d), irN: n(r.ir_n), erD: n(r.er_d), erN: n(r.er_n), hopL: n(r.hop_l), hopR: n(r.hop_r),
    });
  }
  for (const t of Object.values(tests)) t.runs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  state.tests = tests;
  state.health = Object.fromEntries((raw.health || []).map(r => [r.player_id, {
    ankleL: r.ankle_l, ankleR: r.ankle_r, injuries: Array.isArray(r.injuries) ? r.injuries : [],
    pain: r.pain || {}, note: r.note, consent: r.consent, rehab: Array.isArray(r.rehab) ? r.rehab : [],
    custom: r.custom && typeof r.custom === "object" ? r.custom : {},
  }]));
  const logs = {};
  for (const r of raw.logs || []) {
    (logs[r.player_id] = logs[r.player_id] || []).push({
      _id: r.id, date: r.date, type: r.type, minutes: r.minutes, rpe: r.rpe, jumps: r.jumps,
      painArea: r.pain_area, pain: r.pain, note: r.note, completion: r.completion,
    });
  }
  state.logs = logs;
  const checks = {};
  for (const r of raw.pain_checks || []) (checks[r.player_id] = checks[r.player_id] || []).push({ id: r.id, date: r.date, area: r.area, during: r.during, morning: r.morning, rest: r.rest, created: r.created_at });
  state.painChecks = checks;
  state.profiles = raw.profiles || [];
  pushRefresh();
}
/* ---------- 알림 (휴대폰 웹 푸시) ----------
 * 아침 8시: 컨디션을 아직 안 넣었으면 · 밤 10시: 운동 있는 날 기록이 없으면 (서버 예약 작업이 보냄)
 * 운동 있는 날은 앱이 앞으로 4주치를 계산해 하루 한 번 올려 둠 */
const pushOk = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:";
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const b64u = s => Uint8Array.from(atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
function trainDays(pid) {
  const p = playerOf(pid), t = iso(today()), out = [];
  if (!p) return out;
  for (let i = 0; i < 28; i++) { const d = dAdd(t, i); try { if (planOn(p, d).slot !== "rest") out.push(d); } catch (e) { /* 계산 실패한 날은 건너뜀 */ } }
  return out;
}
async function pushSub() {
  if (!pushOk()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
async function openPush() {
  const el = document.getElementById("sheet"), body = el.querySelector(".sheet-body");
  let msg = "", row = null;
  if (!pushOk()) msg = isIOS() && !standalone() ? "아이폰은 Safari 공유 버튼 → '홈 화면에 추가'로 설치한 뒤, 설치한 앱에서 켤 수 있어요." : "이 브라우저는 알림을 지원하지 않아요.";
  else if (Notification.permission === "denied") msg = "알림이 차단돼 있어요. 휴대폰 설정에서 이 앱(사이트) 알림을 허용해 주세요.";
  else {
    const sub = await pushSub().catch(() => null);
    if (sub) { const r = await sb.from("push_subs").select("morning,evening").eq("endpoint", sub.endpoint).maybeSingle(); row = r.data || null; }
  }
  const on = !!row, ck = (id, v, l) => `<label class="check"><input type="checkbox" id="${id}" ${v ? "checked" : ""}> ${l}</label>`;
  body.innerHTML = `<div class="row between"><h3>알림</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    ${msg ? `<p class="small">${esc(msg)}</p>` : `
    <div class="fields">${ck("pu-m", on ? row.morning : true, "아침 8시 · 컨디션 (안 넣었을 때만)")}${ck("pu-e", on ? row.evening : true, "밤 10시 · 운동 기록 (운동 있는 날, 기록 없을 때만)")}</div>
    <div class="row"><button class="btn primary" type="button" data-act="pushon">${on ? "저장" : "알림 켜기"}</button>${on ? `<button class="btn" type="button" data-act="pushoff">끄기</button>` : ""}</div>
    <p class="small muted">${on ? "이 기기에서 알림을 받고 있어요." : "기기마다 따로 켜요."}</p>`}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function pushOn() {
  const m = document.getElementById("pu-m").checked, e = document.getElementById("pu-e").checked;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("알림이 허용되지 않았어요"); return openPush(); }
  try {
    let sub = await pushSub();
    if (!sub) {
      const k = await sb.rpc("push_pubkey");
      if (k.error || !k.data) throw new Error("key");
      const reg = await navigator.serviceWorker.ready;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.data) });
    }
    const j = sub.toJSON();
    const r = await sb.from("push_subs").upsert({ endpoint: sub.endpoint, user_id: uid(), player_id: state.myPid, p256dh: j.keys.p256dh, auth: j.keys.auth, morning: m, evening: e, train_days: trainDays(state.myPid), updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (r.error) throw r.error;
    lsSet(PUSH_DAY(), iso(today()));
    toast(m || e ? "알림을 켰어요" : "알림을 모두 껐어요");
    closeSheet();
  } catch (err) { toast("알림을 켜지 못했어요. 잠시 뒤 다시 해 주세요"); }
}
async function pushOff(quiet) {
  try {
    const sub = await pushSub();
    if (sub) { await sb.from("push_subs").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    if (!quiet) { toast("이 기기 알림을 껐어요"); closeSheet(); }
  } catch (err) { if (!quiet) toast("끄지 못했어요"); }
}
const PUSH_DAY = () => "snuvt-pushday-" + uid();
// 하루 한 번: 앞으로 4주 운동 있는 날 갱신
async function pushRefresh() {
  if (!pushOk() || !state.myPid || !navigator.onLine || Notification.permission !== "granted" || lsGet(PUSH_DAY()) === iso(today())) return;
  try {
    const sub = await pushSub(); if (!sub) return;
    const r = await sb.from("push_subs").update({ train_days: trainDays(state.myPid), updated_at: new Date().toISOString() }).eq("endpoint", sub.endpoint).select("endpoint");
    if (!r.error) lsSet(PUSH_DAY(), iso(today()));
  } catch (e) { /* 다음에 다시 */ }
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
  // 앱 설치·오프라인 (서비스 워커) · 연결되면 모아 둔 기록 올리기
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("online", () => { if (state.canWrite) { flushQueue(); loadAll(); } });
  // 콜백 안에서 바로 Supabase 를 부르면 멈출 수 있어 다음 틱으로 넘긴다
  sb.auth.onAuthStateChange(event => {
    if (event === "PASSWORD_RECOVERY") { state.recovery = true; state.dirty = false; }
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
