/* SNUVT — 서울대 배구부 관리 (Physical 트레이닝 규칙은 program.js) */

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
// 웨이트 경험 4단계 (예전 값 lt6·gte6 도 읽음)
const WEXP = [
  ["none", "입문 · 웨이트를 한 번도 안 해 봤어요"],
  ["machine", "초급 · 기구(머신)는 써 봤어요"],
  ["free", "중급 · 웬만한 기구와 프리웨이트(스쿼트·데드리프트)를 할 수 있어요"],
  ["oly", "상급 · 파워 클린·행 클린·푸시 저크 같은 역도 동작을 할 수 있어요"],
];
const wexpNorm = v => v === "lt6" ? "machine" : v === "gte6" ? "free" : v;
// 웨이트 경험: 고르는 칸에는 입문·초급·중급·상급만, 고르면 아래에 설명
const wexpLabel = l => l.split(" · ")[0], wexpDesc = v => { const x = WEXP.find(w => w[0] === v); return x ? x[1].split(" · ").slice(1).join(" · ") : ""; };
const wexpSelect = (id, cur, required, blank = "고르기") => `<label class="fl wide">웨이트 경험<select id="${id}" class="wexp-sel" ${required ? "required" : ""}>${!cur || blank !== "—" ? `<option value="">${blank}</option>` : ""}${WEXP.map(([v, l]) => `<option value="${v}" ${wexpNorm(cur) === v ? "selected" : ""}>${wexpLabel(l)}</option>`).join("")}</select><span class="small muted wexp-desc" id="${id}-desc">${esc(wexpDesc(wexpNorm(cur)))}</span></label>`;
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
  return `<div class="inj-row" data-rtp="${esc(JSON.stringify(x.rtp || {}))}">
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
  rtp: (() => { try { const v = JSON.parse(r.dataset.rtp || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })(),
}));
// 학년: 숫자만 적으면 '학년'을 붙여 저장 (3 → 3학년)
const normYear = v => { const t = String(v || "").trim(); return /^[1-9]$/.test(t) ? t + "학년" : /^[1-9]\s*학년$/.test(t) ? t.replace(/\s+/g, "") : t; };
// 삭제 확인: 화면 가운데 창 (네 / 아니요)
function confirmDel(msg, yes = "네, 삭제") {
  return new Promise(res => {
    let el = document.getElementById("confirmBox");
    if (!el) { el = document.createElement("div"); el.id = "confirmBox"; el.className = "cf-wrap"; document.body.appendChild(el); }
    const [head, ...rest] = String(msg).split("\n");
    el.innerHTML = `<div class="cf-card" role="alertdialog" aria-modal="true" aria-labelledby="cfH"><p id="cfH" class="cf-h">${esc(head)}</p>${rest.length ? `<p class="cf-b small muted">${esc(rest.join(" "))}</p>` : ""}<div class="cf-row"><button type="button" class="btn" data-cf="0">아니요</button><button type="button" class="btn danger-fill" data-cf="1">${esc(yes)}</button></div></div>`;
    el.hidden = false;
    const done = v => { el.hidden = true; el.onclick = null; document.removeEventListener("keydown", key); res(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", key);
    el.onclick = e => { e.stopPropagation(); const b = e.target.closest("[data-cf]"); if (b) done(b.dataset.cf === "1"); else if (e.target === el) done(false); };
    el.querySelector('[data-cf="0"]').focus();
  });
}
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const VIEWS = ["home", "practice", "notes", "video", "scout", "train", "plan", "rec", "season", "comps", "sched", "report", "roster", "intake"];
// 섹션: 홈 → Physical(트레이닝) · 일정 · 관리 · 설정. 공지는 홈 맨 위
const SECTIONS = {
  physical: { label: "피지컬", views: [["train", "오늘"], ["plan", "프로그램"], ["rec", "기록"]] },
  schedule: { label: "일정", views: [["season", "다가오는"], ["comps", "대회·교류전"], ["sched", "훈련 관리", "attend"]] },
  scout: { label: "전력분석", views: [["scout", "전력분석"]] },
  admin: { label: "관리", views: [["roster", "명단", "roster"], ["intake", "부원", "full"], ["report", "리포트", "training"]] },
  practice: { label: "훈련", views: [["practice", "훈련 계획"], ["notes", "훈련 노트"], ["video", "영상"]] },
};
const SECTION_OF = { scout: "scout", practice: "practice", notes: "practice", video: "practice", train: "physical", plan: "physical", rec: "physical", season: "schedule", comps: "schedule", sched: "schedule", report: "admin", roster: "admin", intake: "admin" };
// 직책: 관리자·주장 = 전체 / 부주장·훈련 담당·총무·피지컬 담당 = 맡은 일만 (서버 규칙 private.can 과 같게)
const TITLES = { admin: "관리자", captain: "주장", vice: "부주장", treasurer: "총무", ops: "훈련 담당", trainer: "피지컬 담당", analyst: "전력분석 담당" };
// attend = 정규 훈련 시간·없는 날 · 자율 훈련 · 불참 확인
const STAFF_PERMS = { vice: ["schedule", "notice", "roster", "video", "attend"], ops: ["practice", "attend"], treasurer: ["notice", "roster"], trainer: ["training"], analyst: ["analysis"] };
// 화면 보기(viewAs): 관리자·주장은 모든 직책 화면으로 바꿔 볼 수 있고, 직책이 있으면 '내 직책 ↔ 선수'
const VIEW_LABEL = k => k === "player" ? "부원" : k === "media" ? "영상 담당" : TITLES[k] || k;
function viewOptions() {
  const o = state.coach ? ["admin", "captain", "vice", "treasurer", "ops", "trainer", "analyst", "media"] : [...(STAFF_PERMS[state.title] ? [state.title] : []), ...(state.media ? ["media"] : [])];
  return [...o, "player"];
}
const can = perm => {
  if (!state.admin) return false;
  const v = state.viewAs;
  if (v === "admin" || v === "captain") return !!state.coach;
  if (perm === "full") return false;
  if (v === "media") return perm === "video";
  return (STAFF_PERMS[v] || []).includes(perm);
};
const secViews = sec => sec.views.filter(v => !v[2] || can(v[2]));
const ICON = {
  physical: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  home: '<path d="M4 11.5 12 4.5l8 7V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  video: '<rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  // 배구공 (lucide volleyball, ISC)
  ball: '<g transform="translate(1.2 1.2) scale(.9)"><circle cx="12" cy="12" r="10"/><path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4M12 12a12.6 12.6 0 0 1-8.7 5M16.8 13.6a16.55 16.55 0 0 1-9 7.5M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5"/></g>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
  record: '<path d="M8 4h8l1 2h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2z"/><path d="M8.5 13l2.5 2.5 4.5-5"/>',
  schedule: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  notice: '<path d="M4 10.5v3a1 1 0 0 0 1 1h2.5l6.5 4.5V5L7.5 9.5H5a1 1 0 0 0-1 1z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
  admin: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

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
const shortDate = d => `${d.getMonth() + 1}/${d.getDate()} (${DOW_KO[d.getDay()]})`;
const longDate = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;

/* ---------- 상태 ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = {
  view: "home", week: null, day: null, pid: null, editPid: null,
  players: {}, tests: {}, health: {}, logs: {}, inbody: {}, events: null,
  loaded: false, offline: false, admin: false, coach: false, canWrite: null, dirty: false, armed: null,
  session: null, role: null, myPid: null, email: "", profiles: [], authMode: "login", authMsg: "", authErr: false, booting: true,
  selfPlayer: null, selfHealth: null, editingSelf: false, painChecks: {}, openKeys: {}, wellness: {}, lifts: {}, planCtx: null, teamOff: {}, picks: {}, friendlies: {}, absences: {}, notices: [], entries: {}, ptimes: {}, contacts: {}, edits: [], title: null, staff: false, practice: {}, videos: [], notes: [], opens: {},
};
let sb = null;

// 군 복무 중인 부원은 리포트·팀 현황에서 뺀다
const activePlayers = () => sortedPlayers().filter(p => !p.military);
function sortedPlayers() {
  return Object.entries(state.players).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)) || ((a.order ?? 99) - (b.order ?? 99)) || String(a.name).localeCompare(String(b.name), "ko"));
}
function runs(pid) { return [...((state.tests[pid] || {}).runs || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))); }
// 측정은 날마다 일부 항목만 잴 수 있어서, 항목별로 가장 최근 값을 모은다 (코어만 잰 날이 점프·근력 값을 지우지 않게)
const EXTRA_KEYS = ["rsi", "ktwL", "ktwR", "irD", "irN", "erD", "erN", "hopL", "hopR"];
const TEST_KEYS = ["reach", "vert", "maxVert", "cmj", "block", "approach", "sideStep", "agility", "hsStage", "hsSec", "hsWalk", "squat", "rdl", "pull", "sideL", "sideR", "plank", ...EXTRA_KEYS];
// 버티컬(제자리 점프 높이) · 맥스 버티컬(도움닫기 점프 높이) — 직접 입력. 예전 도달 높이(block·approach)는 리치를 빼서 읽음
const vertOf = t => t && t.vert != null ? Number(t.vert) : t && t.reach != null && t.block != null ? Number(t.block) - Number(t.reach) : null;
const maxVertOf = t => t && t.maxVert != null ? Number(t.maxVert) : t && t.reach != null && t.approach != null ? Number(t.approach) - Number(t.reach) : null;
// 네트 위 높이 = 스탠딩 리치 + 점프 높이 − 네트
const overNet = (t, v) => t && t.reach != null && v != null ? Number(t.reach) + v - TEAM.net : null;
function latest(pid) {
  const r = runs(pid); if (!r.length) return null;
  const out = { date: r.at(-1).date };
  for (const t of r) for (const k of TEST_KEYS) if (t[k] != null) out[k] = t[k];
  return out;
}
const logsOf = pid => state.logs[pid] || [];
const checksOf = pid => [...(state.painChecks[pid] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created).localeCompare(String(b.created)));
const recentChecks = pid => { const from = iso(addDays(today(), -14)); return checksOf(pid).filter(c => c.date >= from); };
// 다시 그려도 펼친 상태가 유지되게: <details data-keep="키">
const keepOpen = (key, dflt) => (state.openKeys[key] ?? dflt) ? "open" : "";
// 주는 월요일 날짜(YYYY-MM-DD)로 다룬다. 어떤 날의 프로그램은 일정표(대회·방학·학기)로 정해진다 (program.js seasonDay)
const thisMon = () => mondayOf(iso(today()));
const selMon = () => state.week ?? thisMon();
const selDay = () => state.day ?? (selMon() === thisMon() ? dowMon(today()) : 0);
// 정규 훈련 없는 날(관리자 지정)은 선수가 골라서 하는 날로
// 정규 훈련 시간: 그날 바뀐 시간 → 학기 기본 → 18:00–21:00
// 정규 훈련 시간은 18:00–21:00 고정 (그날만 바꾼 날만 예외)
const teamTimeOn = date => state.ptimes[date] || { start: "18:00", end: "21:00" };
const timeTxt = o => o.start + (o.end ? "–" + o.end : "");
// 교류전(관리자 입력)이 있는 날은 교류전이 그날 훈련 (대회·트라이아웃 날은 그대로)
const friendlyOn = date => (state.friendlies[date] || [])[0] || null;
const infoOn = date => {
  const i = seasonDay(date, events()), off = state.teamOff[date], f = friendlyOn(date);
  if (f && !["match", "tryout"].includes(i.slot)) return { ...i, slot: "friendly", baseSlot: i.slot, friendly: f, measure: false };
  if (i.slot === "team" && !off) { const tt = teamTimeOn(date); return { ...i, teamTime: timeTxt(tt), teamTimeNote: state.ptimes[date] ? state.ptimes[date].note || "시간 바뀜" : "" }; }
  if (!off || i.slot !== "team") return i;
  return { ...i, teamOff: true, teamOffNote: off.note || "", near: [seasonDay(dAdd(date, -1), events()).slot, seasonDay(dAdd(date, 1), events()).slot] };
};
// 불참 (본인·관리자만 봄): 아파서면 회복, 아니면 그날은 골라서 하는 날
const ABS_REASONS = { class: "수업·시험", sick: "아픔·부상", personal: "개인 사정", etc: "기타" };
const absOf = (pid, date) => (state.absences[pid] || {})[date] || null;
const isTeamDay = i => (i.slot === "team" && !i.teamOff) || i.slot === "friendly";
function infoFor(pid, date) {
  const i = infoOn(date), a = pid ? absOf(pid, date) : null;
  if (!a || !isTeamDay(i)) return i;
  if (a.reason === "sick") return { ...i, slot: "recover", absent: a, measure: false };
  return { ...i, slot: "team", teamOff: true, teamOffNote: "", absent: a, near: [infoOn(dAdd(date, -1)).slot, infoOn(dAdd(date, 1)).slot] };
}
function weekLabel(mon) {
  const infos = DAYS.map((_, d) => infoOn(dAdd(mon, d)));
  const ev = infos.find(i => /^(대회 주|컨디셔닝|트라이아웃|대회 뒤)/.test(i.label));
  if (ev) return ev.label;
  const i = infos[3];
  return i.optional ? i.label : `${i.label} · ${PHASE_NAMES[i.w]}`;
}
// 처방·기록 화면에서 보는 선수 (선수는 항상 본인)
function viewPid() {
  if (!can("training")) return state.myPid && state.players[state.myPid] ? state.myPid : null;
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
    e1rm: e1rmMap(p.id, d), e1rmName: e1rmNameMap(p.id, d), custom: h.custom || {}, edits: state.edits.filter(e => !e.pid || e.pid === p.id),
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
// 그 주 흐름: 고른 것에 따라 남은 날 권장가 바뀜 (선수·주마다 계산, 다시 그릴 때 새로)
const flowCache = new Map();
function flowFor(pid, date) {
  const mon = mondayOf(date), k = pid + mon;
  if (!flowCache.has(k)) {
    const picks = state.picks[pid] || {};
    flowCache.set(k, weekFlow(DAYS.map((_, d) => { const dt = dAdd(mon, d), i = infoFor(pid, dt); return { slot: i.slot, base: i.baseSlot, off: !!i.teamOff, pick: picks[dt] || null, event: !!i.weekEvent }; })));
  }
  return flowCache.get(k)[dDiff(date, mon)];
}
const planOn = (p, date) => planForDay(ctxFor(p, date), { ...infoFor(p.id, date), hardTeam: hardTeamOf(p.id, date), flow: flowFor(p.id, date) });
const teamPlanOn = date => planForDay({ player: {}, edits: state.edits.filter(e => !e.pid) }, infoOn(date));
const modsFor = p => { const h = state.health[p.id] || {}; return effectiveModules(p.adjust, [], state.health[p.id] ? (h.pain || {}) : null, recentChecks(p.id)); };
const playerOf = pid => pid && state.players[pid] ? { id: pid, ...state.players[pid] } : null;

/* ---------- 공통 조각 ---------- */
const chipsHtml = list => list.length ? `<div class="chips">${list.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : "";
const emptyLine = t => `<p class="empty-line">${t}</p>`;
const SHORT = { "플라이오메트릭 + 하체 근력": "하체", "상체·엉덩이·코어": "상체", "활성화 30분": "활성화", "정규 훈련": "훈련", "맨몸 상체·코어": "맨몸", "맨몸 하체·균형": "맨몸", "완전 휴식": "휴식", "대회": "대회", "대회 전날": "전날", "회복": "회복", "트라이아웃": "트라이", "고르기": "선택", "교류전": "교류전", };
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
// 완료율 5단계
const DONE_OPTS = [["all", "100%", 1], ["most", "75%", 0.75], ["part", "50%", 0.5], ["little", "25%", 0.25], ["none", "0%", 0]];
const doneVal = c => (DONE_OPTS.find(x => x[0] === c) || [0, 0, 0])[2];
const doneTxt = c => (DONE_OPTS.find(x => x[0] === c) || [0, ""])[1];
const doneSelect = (id, cur = "all") => `<select id="${id}">${DONE_OPTS.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select>`;
function playerPicker(pid) {
  if (!can("training")) return "";
  return `<label class="fl picker">선수<select id="pp-select">${state.view === "plan" ? `<option value="__team" ${pid === "__team" ? "selected" : ""}>팀 세션만 보기</option>` : ""}${sortedPlayers().map(x => `<option value="${esc(x.id)}" ${x.id === pid ? "selected" : ""}>${esc(x.name)} · ${esc(x.pos)}</option>`).join("")}</select></label>`;
}
function myName() {
  const p = (state.myPid && state.players[state.myPid]) || state.selfPlayer;
  return p && p.name ? p.name : (state.email || "").split("@")[0];
}
// 같은 내용이면 DOM을 건드리지 않음 (다시 그릴 때 깜빡임·잔상·불필요한 레이아웃 계산 줄이기)
const setHtml = (el, html) => { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
function header() {
  document.getElementById("today").textContent = longDate(today());
  const nm = nextMajor(events(), iso(today()));
  const d = nm ? daysBetween(parseD(nm.start), today()) : null;
  setHtml(document.getElementById("dday"), !nm ? "" : d > 0 ? `${esc(nm.name)} <strong>D-${d}</strong>` : `${esc(nm.name)} <strong>${d === 0 ? "D-DAY" : "대회 중"}</strong>`);
  const who = document.getElementById("who");
  const roleKo = state.title ? TITLES[state.title] : state.coach ? "관리자" : state.role === "player" ? "선수" : "";
  const modeBtn = state.staff && state.loaded ? `<button class="btn mode ${state.admin ? "" : "on"}" type="button" data-act="rolepick" title="어느 화면으로 볼지 골라요">${VIEW_LABEL(state.viewAs)} 화면 ▾</button>` : "";
  setHtml(who, state.session ? `<span>${esc(myName())}${roleKo ? " " + roleKo : ""}</span>${modeBtn}<button class="btn link" type="button" data-act="logout">로그아웃</button>` : "");
  const ready = state.session && state.role && state.role !== "pending" && !state.offline && !needsSelfReg();
  document.getElementById("menuBtn").hidden = !ready; document.getElementById("setBtn").hidden = !ready;
  if (!state.session || !state.role || state.role === "pending" || state.offline || needsSelfReg()) { setHtml(document.getElementById("tabs"), ""); document.getElementById("tabs")._key = ""; document.getElementById("tabbar").hidden = true; document.body.classList.remove("has-bar"); return; }
  const secKey = SECTION_OF[state.view], sec = SECTIONS[secKey];
  const nav = document.getElementById("tabs"), bar = document.getElementById("tabbar");
  // 아래 탭 (휴대폰): 홈 · Physical · 일정(가운데) · 공지 · 메뉴
  const onOf = v => (SECTION_OF[state.view] || "home") === (SECTION_OF[v] || "home");
  const bt = (v, k, label, cls = "") => `<button type="button" class="bt ${cls} ${onOf(v) ? "on" : ""}" data-act="view" data-v="${v}" ${onOf(v) ? 'aria-current="page"' : ""}><span class="bi">${svg(k)}</span><span>${label}</span></button>`;
  // 아래 탭: 홈이 가운데 (왼쪽 트레이닝 · 오른쪽 팀)
  // 아래 탭 바: 훈련 · Physical · 홈(가운데) · 일정 · 관리(관리 화면) / 영상
  // 다섯 번째 칸: 관리 화면이 있으면 관리, 없으면 전력분석 (영상은 훈련 안에)
  const adminV = secViews(SECTIONS.admin)[0];
  // 관리는 자주 안 들어가니 메뉴·홈 칸으로만, 아래 탭은 모두 같게
  const fifth = ["scout", "chart", "전력분석"];
  const barKey = fifth.join("|");
  if (bar._key === barKey) {
    // 같은 칸들: 다시 만들지 않고 고른 칸 표시만 바꿈 (누른 자국·깜빡임 없음)
    for (const b of bar.querySelectorAll(".bt")) { const on = onOf(b.dataset.v); b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
  } else {
    bar.innerHTML = bt("practice", "ball", "훈련") + bt("train", "physical", "피지컬") + bt("home", "home", "홈", "center") + bt("season", "schedule", "일정") + bt(fifth[0], fifth[1], fifth[2]);
    bar._key = barKey;
  }
  bar.hidden = false; document.body.classList.add("has-bar");
  const vs = sec ? secViews(sec) : [];
  if (!sec || vs.length < 2) { const h = sec ? `<span class="tab-title">${sec.label}</span>` : ""; setHtml(nav, h); nav._key = ""; nav.hidden = !h; return; }
  nav.hidden = false;
  const key = secKey + "|" + vs.map(v => v[0] + v[1]).join(",");
  if (nav._key === key) {
    // 같은 섹션: 버튼은 그대로 두고 고른 탭만 바꿈 → 흰 칸이 부드럽게 미끄러짐
    for (const b of nav.querySelectorAll(".seg-tab")) { const on = b.dataset.v === state.view; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }
    placeThumb(nav, true);
  } else {
    nav.innerHTML = `<span class="tab-title">${sec.label}</span><div class="seg" role="tablist"><span class="seg-thumb"></span>${vs.map(([k, l]) => `<button type="button" class="seg-tab ${state.view === k ? "on" : ""}" role="tab" aria-selected="${state.view === k}" data-act="view" data-v="${k}">${l}</button>`).join("")}</div>`;
    nav._key = key; nav._h = null;
    placeThumb(nav, false);
  }
}

// 하위 탭 밑의 흰 칸: 위치는 다음 프레임에 한 번만 잼 (그리는 도중에 강제로 레이아웃을 계산하지 않음)
function placeThumb(nav, animate) {
  requestAnimationFrame(() => {
    const on = nav.querySelector(".seg-tab.on"), th = nav.querySelector(".seg-thumb");
    if (!on || !th) return;
    if (!animate) th.style.transition = "none";
    th.style.width = on.offsetWidth + "px"; th.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!animate) requestAnimationFrame(() => { th.style.transition = ""; });
  });
}
/* ---------- 훈련 계획 (주장·훈련 담당이 설계, 모두 봄) ---------- */
const prMin = b => (b.groups || []).reduce((mx, g) => Math.max(mx, (g.drills || []).reduce((a, d) => a + (Number(d.m) || 0), 0)), 0);
function practiceDays() { const t = iso(today()); return teamDays(dAdd(t, -7), 35).filter(x => x.i.slot === "team"); }
function prDateNow() {
  const t = iso(today()), days = practiceDays();
  if (state.prDate && (days.some(d => d.date === state.prDate) || state.practice[state.prDate])) return state.prDate;
  return (days.find(d => d.date >= t) || days.at(-1) || {}).date || null;
}
function viewPractice() {
  const days = practiceDays(), date = prDateNow(), canEd = can("practice"), edit = canEd && state.prEdit;
  if (!date) return emptyLine("앞으로 정규 훈련 날이 없어요.");
  const plan = state.practice[date], me = playerOf(state.myPid), info = infoOn(date);
  const chips = `<div class="pr-days">${days.map(d => `<button type="button" class="pr-day ${d.date === date ? "on" : ""} ${d.date < iso(today()) ? "past" : ""}" data-act="prday" data-d="${d.date}"><b>${md(parseD(d.date))}</b><span>${DOW_KO[parseD(d.date).getDay()]}</span>${state.practice[d.date] ? `<i class="dot"></i>` : ""}</button>`).join("")}</div>`;
  const head = `<div class="row between pr-head"><div><h3>${longDate(parseD(date))}</h3><span class="small muted">${esc(tdLabel(info))}</span></div>
    ${canEd && plan ? `<div class="row">${edit ? `<label class="check"><input type="checkbox" data-act="prpub" ${plan.published ? "checked" : ""}> 선수에게 공개</label>` : ""}<button class="btn ${edit ? "primary" : ""} small" type="button" data-act="predit">${edit ? "완료" : "편집"}</button></div>` : ""}</div>`;
  if (!plan) return `${chips}<section class="sec">${head}
    ${canEd ? `<div class="panel pr-empty"><p>아직 이날 훈련 계획이 없어요.</p><div class="row"><button class="btn primary" type="button" data-act="prnew" data-k="tpl">기본 틀로 시작</button>${Object.keys(state.practice).some(d => d < date) ? `<button class="btn" type="button" data-act="prnew" data-k="copy">지난 훈련 복사</button>` : ""}<button class="btn" type="button" data-act="prnew" data-k="blank">빈 계획</button></div>
      </div>` : emptyLine("아직 훈련 계획이 올라오지 않았어요.")}</section>`;
  const total = plan.blocks.reduce((a, b) => a + (Number(b.minutes) || prMin(b)), 0);
  const blocks = plan.blocks.map((b, bi) => {
    const groups = b.groups || [];
    const gHtml = groups.map((g, gi) => {
      const mine = me && g.pos && g.pos.length && g.pos.includes(me.pos);
      const drills = (g.drills || []).map((d, di) => edit
        ? `<div class="box"><span class="bn">${esc(d.n)}</span><span class="br">${d.m ? d.m + "분" : ""}</span><button type="button" class="bx" data-act="prdrop" data-b="${bi}" data-g="${gi}" data-i="${di}" aria-label="${esc(d.n)} 제외">✕</button></div>`
        : `<li><span class="nm">${esc(d.n)}${d.note ? `<span class="small muted"> · ${esc(d.note)}</span>` : ""}</span><span class="rx">${d.m ? d.m + "분" : ""}</span></li>`).join("");
      return `<div class="pr-grp ${mine ? "mine" : ""}">${groups.length > 1 || (g.pos && g.pos.length) ? `<div class="pr-gname">${esc(g.name || "그룹")}${mine ? ` <span class="tag-in">내 포지션</span>` : ""}</div>` : ""}
        ${edit ? `<div class="boxes">${drills}<button type="button" class="box add-box" data-act="prdrill" data-b="${bi}" data-g="${gi}">＋ 드릴 추가</button></div>` : `<ul class="pr-drills">${drills || `<li class="small muted">드릴 없음</li>`}</ul>`}</div>`;
    }).join("");
    return `<section class="pr-blk ${groups.length > 1 ? "split-blk" : ""}">
      <div class="pr-bh"><span class="pr-no">${bi + 1}</span><b>${esc(b.title)}</b><span class="small muted">${Number(b.minutes) || prMin(b)}분${groups.length > 1 ? " · 포지션별 동시에" : ""}</span>
        ${edit ? `<span class="pr-ctl"><button type="button" class="btn link small" data-act="prblk" data-b="${bi}">수정</button><button type="button" class="btn link small" data-act="prmove" data-b="${bi}" data-d="-1" ${bi ? "" : "disabled"} aria-label="위로">↑</button><button type="button" class="btn link small" data-act="prmove" data-b="${bi}" data-d="1" ${bi < plan.blocks.length - 1 ? "" : "disabled"} aria-label="아래로">↓</button><button type="button" class="btn link small danger" data-act="prbdel" data-b="${bi}">삭제</button></span>` : ""}</div>
      <div class="pr-groups">${gHtml}</div></section>`;
  }).join("");
  return `${chips}<section class="sec">${head}
    ${edit ? `<form class="f panel pr-meta" id="prMetaForm" data-d="${date}"><div class="fields"><label class="fl">제목<input id="pr-title" maxlength="60" value="${esc(plan.title)}" placeholder="예: 리시브 집중"></label><label class="fl wide">목표<input id="pr-goal" maxlength="200" value="${esc(plan.goal)}" placeholder="예: 서브 리시브 A패스 60% 이상"></label></div><div class="row"><button class="btn" type="submit">저장</button><button class="btn link small danger" type="button" data-act="prwipe">계획 지우기</button></div></form>`
      : `${plan.title || plan.goal ? `<div class="panel pr-top">${plan.title ? `<b>${esc(plan.title)}</b>` : ""}${plan.goal ? `<span class="small">목표 · ${esc(plan.goal)}</span>` : ""}</div>` : ""}`}
    <p class="small muted">${plan.blocks.length}개 블록 · 약 ${total}분${!plan.published ? " · 선수에게 아직 안 보임" : ""}</p>
    <div class="pr-list">${blocks || emptyLine("블록이 없어요.")}</div>
    ${state.videos.filter(v => v.date === date).map(v => vidCard(v, state.vidOpen === v.id)).join("")}
    ${me && date <= iso(today()) ? `<button class="btn" type="button" data-act="notego" data-d="${date}">이날 훈련 노트 쓰기</button>` : ""}
    ${edit ? `<button class="btn add" type="button" data-act="prblk" data-b="new">＋ 블록 추가</button>` : ""}
  </section>`;
}
async function prSave(date, fn) {
  const cur = state.practice[date] ? JSON.parse(JSON.stringify(state.practice[date])) : { title: "", goal: "", blocks: [], published: true };
  const next = fn(cur) || cur;
  try {
    ok(await sb.from("practice_plans").upsert({ team_id: TEAM.id, date, title: next.title || null, goal: next.goal || null, blocks: next.blocks, published: next.published !== false, updated_at: new Date().toISOString() }));
    state.practice[date] = next; state.dirty = false; render(); return true;
  } catch (e) { toast(failMsg(e)); return false; }
}
function openPrBlock(bi) {
  const date = prDateNow(), plan = state.practice[date] || { blocks: [] }, b = bi === "new" ? null : plan.blocks[Number(bi)];
  const split = b ? (b.groups || []).length > 1 : false;
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${b ? "블록 수정" : "블록 추가"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="prBlockForm" data-b="${bi}" data-close="1"><div class="fields">
      <label class="fl wide">이름<input id="pb-title" required maxlength="40" value="${esc(b ? b.title : "")}" placeholder="예: 서브 · 서브 리시브"></label>
      <label class="fl">시간 (분)<input id="pb-min" type="number" inputmode="numeric" min="0" max="180" value="${esc(b ? b.minutes ?? "" : "")}"></label>
      <label class="fl">누가<select id="pb-split"><option value="all" ${split ? "" : "selected"}>공통 (다 같이)</option><option value="pos" ${split ? "selected" : ""}>포지션별 (나눠서 동시에)</option></select></label>
    </div><div class="row"><button class="btn primary" type="submit">${b ? "저장" : "추가"}</button></div>
    </form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
function openPrDrill(bi, gi) {
  const el = document.getElementById("sheet"), cats = [...new Set(DRILL_LIB.map(x => x.c))];
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>드릴 추가</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="prDrillForm" data-b="${bi}" data-g="${gi}" data-close="1">
      <div class="fields"><label class="fl wide">드릴<input id="pd-name" required maxlength="60" placeholder="목록에서 고르거나 직접 쓰기"></label><label class="fl">시간 (분)<input id="pd-min" type="number" inputmode="numeric" min="0" max="120"></label><label class="fl wide">메모<input id="pd-note" maxlength="80" placeholder="예: 리시브 A패스만 카운트"></label></div>
      <div class="row"><button class="btn primary" type="submit">추가</button></div>
    </form>
    <input id="pd-q" class="bx-q" placeholder="찾기 (예: 리시브, 토스, 게임)" autocomplete="off">
    <div class="lib-cats">${cats.map((c, i) => `<button type="button" class="chip ${i ? "" : "on"}" data-act="drcat" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="lib" id="dlib">${drillList(cats[0], "")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
const drillList = (cat, q) => DRILL_LIB.filter(x => q ? x.n.includes(q) : x.c === cat).map(x => `<button type="button" class="box lib-box" data-act="drpick" data-n="${esc(x.n)}" data-m="${x.m}"><span class="bn">${esc(x.n)}</span><span class="br">${x.m}분</span></button>`).join("") || `<p class="small muted">없어요</p>`;
/* ---------- 영상 (유튜브 재생목록·영상, 부원만) ---------- */
const VID_CATS = { practice: "훈련", friendly: "교류전", camp: "전지훈련", match: "대회", etc: "기타" };
const ytEmbed = v => v.kind === "playlist" ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(v.yt)}` : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}`;
const ytLink = v => v.kind === "playlist" ? `https://www.youtube.com/playlist?list=${encodeURIComponent(v.yt)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(v.yt)}`;
// 붙여 넣은 유튜브 주소 → { kind, yt }
function parseYt(url) {
  const u = String(url || "").trim(), list = u.match(/[?&]list=([A-Za-z0-9_-]{6,64})/), v = u.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,20})/);
  if (v && !/videoseries/.test(u)) return { kind: "video", yt: v[1] };
  if (list) return { kind: "playlist", yt: list[1] };
  return null;
}
const vidCard = (v, open) => `<article class="panel vid ${open ? "open" : ""}">
    <button type="button" class="vid-head" data-act="vidopen" data-id="${esc(v.id)}" aria-expanded="${open}"><span class="vid-ic">${svg("video")}</span><span class="vid-t"><b>${esc(v.title)}</b><span class="small muted">${v.kind === "playlist" ? "재생목록" : "영상"} · ${VID_CATS[v.cat] || ""}${v.date ? ` · ${md(parseD(v.date))}` : ""}${v.note ? ` · ${esc(v.note)}` : ""}</span></span><span class="vid-chev" aria-hidden="true">›</span></button>
    ${open ? `<div class="vid-body"><div class="vid-frame"><iframe src="${ytEmbed(v)}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <div class="row vid-foot"><a class="btn link small" href="${ytLink(v)}" target="_blank" rel="noopener noreferrer">유튜브에서 열기 ↗</a>${can("video") ? `<button class="btn link small" type="button" data-act="videdit" data-id="${esc(v.id)}">수정</button><button class="btn link small danger" type="button" data-act="viddel" data-id="${esc(v.id)}">삭제</button>` : ""}</div></div>` : ""}
  </article>`;
// 가장 최근 영상: 유튜브 플레이어가 재생목록을 읽은 뒤 맨 끝(최근 추가)으로 맞춤 · 목록이 최신순이면 '맨 앞'으로 바꿈
let ytApi = null;
function loadYtApi() {
  if (ytApi) return ytApi;
  ytApi = new Promise(res => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const t = setTimeout(() => res(null), 8000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(t); res(window.YT); };
    const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.onerror = () => { clearTimeout(t); res(null); };
    document.head.appendChild(sc);
  });
  return ytApi;
}
const latestSrc = () => { const pls = state.videos.filter(v => v.kind === "playlist"); return pls.find(v => v.id === state.latestId) || pls.find(v => v.cat === "practice") || pls[0] || null; };
// 가장 최근 영상: 재생목록 맨 앞부터, '이전 · 다음'으로 넘겨 봄
let ytPlayer = null;
async function initLatest() {
  const v = latestSrc(), box = document.getElementById("ytLatest"); if (!v || !box || box.dataset.ready) return;
  box.dataset.ready = "1"; ytPlayer = null;
  const info = t => { const el = document.getElementById("ytInfo"); if (el) el.textContent = t; };
  const pos = p => { const pl = p.getPlaylist && p.getPlaylist(), i = p.getPlaylistIndex ? p.getPlaylistIndex() : 0; info(pl && pl.length ? `${v.title} · ${i + 1} / ${pl.length}` : v.title); };
  const YT = await loadYtApi();
  if (!YT || !document.getElementById("ytLatest")) { info("유튜브를 불러오지 못했어요. 아래 목록에서 '유튜브에서 열기'로 봐 주세요."); return; }
  new YT.Player("ytLatest", { host: "https://www.youtube-nocookie.com", width: "100%", height: "100%", playerVars: { listType: "playlist", list: v.yt, playsinline: 1, rel: 0 },
    events: { onReady: e => { ytPlayer = e.target; pos(e.target); }, onStateChange: e => pos(e.target),
      onError: () => info("이 재생목록은 열 수 없어요. 링크나 공개 범위(일부 공개)를 확인해 주세요.") } });
}
function viewVideo() {
  const cat = state.vidCat || "all", list = state.videos.filter(v => cat === "all" || v.cat === cat);
  const pls = state.videos.filter(v => v.kind === "playlist"), src = latestSrc();
  const cats = ["all", ...Object.keys(VID_CATS).filter(k => state.videos.some(v => v.cat === k))];
  return `<section class="sec"><div class="sec-head"><h2>영상</h2>${can("video") ? `<button class="btn add" type="button" data-act="videdit" data-id="">＋ 영상 추가</button>` : ""}</div>
    <div class="lib-cats">${cats.map(k => `<button type="button" class="chip ${k === cat ? "on" : ""}" data-act="vidcat" data-c="${k}">${k === "all" ? "전체" : VID_CATS[k]}</button>`).join("")}</div>
    ${src ? `<section class="panel latest"><div class="row between"><h3>가장 최근 영상</h3><span class="row nowrap"><button class="btn small" type="button" data-act="ytprev">‹ 이전</button><button class="btn small" type="button" data-act="ytnext">다음 ›</button></span></div>
      ${pls.length > 1 ? `<div class="lib-cats">${pls.map(v => `<button type="button" class="chip ${v.id === src.id ? "on" : ""}" data-act="ytlatest" data-id="${esc(v.id)}">${esc(v.title)}</button>`).join("")}</div>` : ""}
      <div class="vid-frame"><div id="ytLatest"></div></div><p class="small muted" id="ytInfo">불러오는 중</p></section>` : ""}
    
    <div class="vid-list">${list.length ? list.map(v => vidCard(v, state.vidOpen === v.id)).join("") : emptyLine("아직 올라온 영상이 없어요.")}</div></section>`;
}
function openVidForm(id) {
  const v = state.videos.find(x => x.id === id) || {}, el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${id ? "영상 수정" : "영상 추가"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="vidForm" data-id="${esc(id || "")}" data-close="1"><div class="fields">
      <label class="fl wide">유튜브 주소<input id="vd-url" required maxlength="300" value="${v.yt ? esc(ytLink(v)) : ""}" placeholder="재생목록이나 영상 주소를 붙여 넣기"></label>
      <label class="fl wide">제목<input id="vd-title" required maxlength="80" value="${esc(v.title || "")}" placeholder="예: 11/6 훈련 · 서브 리시브"></label>
      <label class="fl">분류<select id="vd-cat">${Object.entries(VID_CATS).map(([k, l]) => `<option value="${k}" ${v.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">날짜<input id="vd-date" type="date" value="${esc(v.date || "")}"></label>
      <label class="fl wide">메모<input id="vd-note" maxlength="200" value="${esc(v.note || "")}"></label>
    </div><div class="row"><button class="btn primary" type="submit">${id ? "저장" : "추가"}</button></div>
    </form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
/* ---------- 훈련 노트 (쓰고 싶은 사람만, 기본은 나만 봄) ---------- */
function viewNotes() {
  const me = playerOf(state.myPid), t = iso(today());
  const mine = state.notes.filter(n => me && n.pid === me.id), shared = can("practice") ? state.notes.filter(n => n.shared && (!me || n.pid !== me.id)) : [];
  const d = state.noteDate || t, cur = mine.find(n => n.date === d) || {};
  const month = mine.filter(n => n.date.slice(0, 7) === t.slice(0, 7)).length;
  const ta = (id, l, v, ph, rows = 2, max = 500) => `<label class="fl wide">${l}<textarea id="${id}" rows="${rows}" maxlength="${max}" placeholder="${ph}">${esc(v || "")}</textarea></label>`;
  const noteCard = n => `<article class="panel note"><div class="row between"><b>${longDate(parseD(n.date))}${n.pid !== state.myPid ? ` · ${esc((playerOf(n.pid) || {}).name || "")}` : ""}</b>${n.pid === state.myPid ? `<span class="row">${n.shared ? `<span class="chip">공유</span>` : ""}<button class="btn link small" type="button" data-act="noteedit" data-d="${n.date}">수정</button></span>` : ""}</div>
    ${n.good ? `<p><span class="nk">잘된 것</span>${esc(n.good)}</p>` : ""}${n.fix ? `<p><span class="nk">고칠 것</span>${esc(n.fix)}</p>` : ""}${n.next ? `<p><span class="nk">다음 목표</span>${esc(n.next)}</p>` : ""}${n.body ? `<p class="nbody">${esc(n.body)}</p>` : ""}</article>`;
  return `<section class="sec"><div class="sec-head"><h2>훈련 노트</h2>${me ? `<span class="small muted">이번 달 ${month}개</span>` : ""}</div>
    
    ${me ? `<form class="f panel note-form" id="noteForm">
      <div class="fields"><label class="fl">날짜<input type="date" id="nt-date" value="${d}" max="${t}" required></label></div>
      ${ta("nt-good", "오늘 잘된 것", cur.good, "예: 리시브 때 발이 먼저 갔다")}
      ${ta("nt-fix", "고칠 것", cur.fix, "예: 공격 어프로치 마지막 두 걸음이 느림")}
      ${ta("nt-next", "다음 훈련 목표", cur.next, "예: 오픈 스파이크 크로스 코스 5개 중 3개", 1, 300)}
      ${ta("nt-body", "자유 메모", cur.body, "코치·선배 조언, 느낀 점", 3, 2000)}
      <label class="check"><input type="checkbox" id="nt-share" ${cur.shared ? "checked" : ""}> 주장·훈련 담당에게 공유</label>
      <div class="row"><button class="btn primary" type="submit">${cur.id ? "고치기" : "저장"}</button>${cur.id ? `<button class="btn link small danger" type="button" data-act="notedel" data-d="${d}">지우기</button>` : ""}</div>
    </form>` : ""}
    ${mine.length ? `<h3 class="sub-h">내 노트</h3><div class="notes-list">${mine.slice(0, 30).map(noteCard).join("")}</div>` : ""}
    ${shared.length ? `<h3 class="sub-h">공유받은 노트</h3><div class="notes-list">${shared.slice(0, 40).map(noteCard).join("")}</div>` : ""}
  </section>`;
}
/* ---------- 메뉴 (왼쪽에서 열림) ---------- */
function openDrawer() {
  const el = document.getElementById("drawer"); if (!el) return;
  const link = (v, l) => `<button type="button" class="dr-link ${state.view === v ? "on" : ""}" data-act="view" data-v="${v}">${l}</button>`;
  const group = (k, ic) => { const sec = SECTIONS[k]; return `<div class="dr-group"><div class="dr-h">${svg(ic)}<span>${sec.label}</span></div>${secViews(sec).map(([v, l]) => link(v, l)).join("")}</div>`; };
  el.querySelector(".drawer-body").innerHTML = `<div class="dr-top"><button type="button" class="dr-brand" data-act="view" data-v="home" aria-label="홈으로"><img class="logo logo-light" src="logo.png?v=4" alt="" width="32" height="31"><img class="logo logo-dark" src="logo-white.png?v=4" alt="" width="32" height="31"><b>SNUVT</b></button><button class="btn link" type="button" data-act="drawerclose" aria-label="닫기">닫기</button></div>
    ${state.staff ? `<div class="dr-group dr-view"><div class="dr-h"><span>화면 보기</span></div><div class="dr-roles"><select id="drViewAs" aria-label="화면 보기">${viewOptions().map(k => `<option value="${k}" ${state.viewAs === k ? "selected" : ""}>${VIEW_LABEL(k)}</option>`).join("")}</select></div></div>` : ""}
    <div class="dr-group">${link("home", "홈")}</div>
    ${group("practice", "ball")}${group("physical", "physical")}${group("schedule", "schedule")}${group("scout", "chart")}${secViews(SECTIONS.admin).length ? group("admin", "admin") : ""}
    <div class="dr-group"><button type="button" class="dr-link" data-act="settings">설정</button></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
function closeDrawer() { const el = document.getElementById("drawer"); if (el && !el.hidden) { el.hidden = true; document.body.classList.remove("noscroll"); } }
/* ---------- 설정 ---------- */
function viewSettings() {
  const me = playerOf(state.myPid), email = (state.session && state.session.user && state.session.user.email) || "";
  const theme = document.documentElement.dataset.theme || "auto";
  const opt = (v, cur, l) => `<option value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${l}</option>`;
  return `<div class="set-head"><h2>설정</h2><button class="btn link" type="button" data-act="setclose">닫기</button></div>
    ${me ? `<section class="panel set-sec"><h3>내 정보</h3>
      <div class="kv"><span>이름</span><b>${esc(me.name)}</b></div><div class="kv"><span>포지션</span><b>${esc(POS[me.pos] || me.pos)}</b></div>
      <div class="kv"><span>등번호</span><b>${me.number ?? "—"}</b></div>${me.title ? `<div class="kv"><span>직책</span><b>${esc(TITLES[me.title])}</b></div>` : ""}
      <form class="f" id="profileForm"><div class="fields">
        <label class="fl">전화번호<input id="pr-phone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" value="${esc((state.contacts || {})[me.id] || "")}"></label>
        <label class="fl">학년<input id="pr-year" maxlength="10" placeholder="예: 3" value="${esc(me.year || "")}"></label>
        <label class="fl">키 (cm)<input id="pr-h" type="number" inputmode="decimal" min="140" max="220" step="0.1" value="${esc(me.height ?? "")}"></label>
        <label class="fl">몸무게 (kg)<input id="pr-w" type="number" inputmode="decimal" min="40" max="150" step="0.1" value="${esc(me.weight ?? "")}"></label>
        <label class="fl">배구 경력 (년)<input id="pr-exp" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="${esc(me.exp ?? "")}"></label>
        ${wexpSelect("pr-wexp", me.weightExp, false, "—")}
      </div><div class="row"><button class="btn primary" type="submit">저장</button></div></form>
    </section>
    <section class="panel set-sec"><h3>부상 · 지금 상태</h3>
      <form class="f" id="myInjForm">${injuryEditor("mi", (state.health[me.id] || {}).injuries || [])}
        <div class="row"><button class="btn primary" type="submit">저장</button></div></form>
    </section>` : ""}
    <section class="panel set-sec"><h3>알림</h3><div id="pushBox">${loaderHtml(true)}</div></section>
    <section class="panel set-sec"><h3>화면</h3>
      <div class="seg fill" role="radiogroup" aria-label="화면 밝기">${[["light", "밝게"], ["dark", "어둡게"], ["auto", "기기 따라"]].map(([v, l]) => `<button type="button" class="seg-tab ${theme === v ? "on solid" : ""}" data-act="themeset" data-t="${v}" aria-pressed="${theme === v}">${l}</button>`).join("")}</div>
    </section>
    <section class="panel set-sec"><h3>계정</h3>
      ${email ? `<div class="kv"><span>이메일</span><b>${esc(email)}</b></div>` : ""}
      ${state.superAdmin ? `<div class="kv"><span>팀</span><div class="seg-pick team-switch" role="radiogroup" aria-label="팀 바꾸기">${[["men", "남자부"], ["women", "여자부"]].map(([v, l]) => `<label><input type="radio" name="teamsw" value="${v}" ${TEAM.id === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>` : ""}
      ${state.staff ? `<button type="button" class="menu-item" data-act="rolepick"><span>화면 보기</span><span class="small muted">${VIEW_LABEL(state.viewAs)}</span><span class="go">›</span></button>` : ""}
      <button type="button" class="menu-item" data-act="pwchange"><span>비밀번호 바꾸기</span><span></span><span class="go">›</span></button>
      <button type="button" class="menu-item danger" data-act="logout"><span>로그아웃</span><span></span><span class="go">›</span></button>
      <button type="button" class="menu-item danger" data-act="leave"><span>팀 탈퇴</span><span class="small muted">계정과 내 기록을 모두 지워요</span><span class="go">›</span></button>
    </section>`;
}
// 설정은 지금 화면 위에 오른쪽에서 열리는 창으로
function openSettings() {
  const el = document.getElementById("setpanel"); if (!el) return;
  el.querySelector(".setpanel-body").innerHTML = viewSettings();
  el.hidden = false; document.body.classList.add("noscroll");
  fillPushBox();
}
function closeSettings() { const el = document.getElementById("setpanel"); if (el && !el.hidden) { el.hidden = true; document.body.classList.remove("noscroll"); } }
function refreshSettings() {
  const el = document.getElementById("setpanel");
  if (el && !el.hidden && state.session && state.loaded) { el.querySelector(".setpanel-body").innerHTML = viewSettings(); fillPushBox(); }
}
/* ---------- 홈 ---------- */
function viewHome() {
  if (!state.loaded) return loaderHtml();
  const me = playerOf(state.myPid), t = iso(today()), team = infoOn(t);
  const nextT = upcoming(dAdd(t, 1), 21)[0], todayO = opensOn(t)[0];
  const itemLabel = x => x.open ? openLabel(x.open) : tdLabel(x.i);
  const teamLine = isTeamDay(team) ? tdLabel(team) : team.slot === "match" ? (team.event ? team.event.name : "대회") : todayO ? openLabel(todayO) : team.teamOff ? `정규 훈련 없음${team.teamOffNote ? " · " + team.teamOffNote : ""}` : "없음";
  const ab = me && absOf(me.id, t);
  const plan = me ? planOn(me, t) : null;
  // 다가오는 교류전 (3주 안)
  const fr = Object.entries(state.friendlies).filter(([d]) => d >= t && d <= dAdd(t, 21)).sort().flatMap(([d, fs]) => fs.map(f => ({ d, f })))[0];
  const rows = [
    `<div class="hub-row tap" data-act="view" data-v="season" role="button" tabindex="0"><span class="k">팀 일정</span><span class="v">${esc(teamLine)}${ab ? ` <span class="chip warn">불참</span>` : ""}${!isTeamDay(team) && !todayO && nextT ? `<span class="small muted">다음 · ${md(parseD(nextT.date))} (${DOW_KO[parseD(nextT.date).getDay()]}) ${esc(itemLabel(nextT))}</span>` : ""}</span><span class="go">›</span></div>`,
    state.practice[t] && isTeamDay(team) ? `<div class="hub-row tap" data-act="prgo" data-d="${t}" role="button" tabindex="0"><span class="k">훈련 계획</span><span class="v">${esc(state.practice[t].title || "오늘 훈련")}<span class="small muted">${state.practice[t].blocks.length}개 블록 · ${state.practice[t].blocks.reduce((a, b) => a + (Number(b.minutes) || 0), 0)}분</span></span><span class="go">›</span></div>` : "",
    plan ? `<div class="hub-row tap" data-act="view" data-v="train" role="button" tabindex="0"><span class="k">개인 훈련</span><span class="v">${esc(plan.title)}${!wellOn(me.id, t) ? `<span class="small muted">아침 컨디션 아직</span>` : ""}</span><span class="go">›</span></div>` : "",
    fr ? `<div class="hub-row tap" data-act="view" data-v="comps" role="button" tabindex="0"><span class="k">교류전</span><span class="v"><span class="line">${md(parseD(fr.d))} (${DOW_KO[parseD(fr.d).getDay()]}) ${esc(frName(fr.f.opponent))}${me && entryOf("friendly", fr.f.id).has(me.id) ? ` <span class="tag-in">엔트리</span>` : ""}</span><span class="small muted">${fmtKo(fr.f)}${fr.f.start ? ` · ${fr.f.start}${fr.f.end ? "–" + fr.f.end : ""}` : ""}${fr.f.place ? ` · ${esc(fr.f.place)}` : ""}</span></span><span class="go">›</span></div>` : "",
  ].filter(Boolean).join("");
  const pending = can("full") ? state.profiles.filter(m => m.role === "pending" && m.id !== state.session.user.id).length : 0;
  const tile = (act, v, k, label, sub, badge) => `<button type="button" class="tile-btn" data-act="${act}" ${v ? `data-v="${v}"` : ""}><span class="ic">${svg(k)}${badge ? `<span class="badge">${badge}</span>` : ""}</span><span class="tl">${label}</span>${sub ? `<span class="ts">${sub}</span>` : ""}</button>`;
  const adm = secViews(SECTIONS.admin);
  const tiles = [
    tile("view", "practice", "ball", "훈련"),
    tile("view", "train", "physical", "피지컬"),
    tile("view", "season", "schedule", "일정"),
    tile("view", "scout", "chart", "전력분석"),
    adm.length ? tile("view", adm[0][0], "admin", "관리", "", pending) : "",
  ].join("");
  return `${pendingHtml()}${voteCardsHtml()}${todayAbsHtml()}${noticesHtml()}${can("full") || can("training") ? teamStatusHtml() : ""}<section class="panel hub"><h3>오늘</h3>${rows}</section>
    <nav class="tiles-grid" aria-label="기능">${tiles}</nav>`;
}
// Physical · 오늘 (예전 홈)
function viewTrain() {
  if (!state.loaded) return loaderHtml();
  const me = playerOf(state.myPid);
  const parts = [];
  if (state.admin && !me) parts.push(`<section class="panel row between"><div><h3>내 선수 정보가 아직 없어요</h3></div><button class="btn primary" type="button" data-act="editself">내 정보 입력</button></section>`);
  if (me) parts.push(wellnessHtml(me), todayHtml(me), myStatusHtml(me));
  else if (!state.admin) parts.push(`<div class="panel empty"><strong>계정이 선수와 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`);
  return parts.join("");
}
function wellnessHtml(p) {
  const t = iso(today()), w = wellOn(p.id, t), why = readiness(w, lastRpeBefore(p.id, t));
  const sel = (k, l) => `<label class="fl">${l}<select id="wl-${k}">${[5, 4, 3, 2, 1].map(v => `<option value="${v}" ${(w ? Number(w[k]) : 3) === v ? "selected" : ""}>${WELL_OPTS[k][v - 1]}</option>`).join("")}</select></label>`;
  const key = "well-form";
  return `<section class="panel well-card">
    <div class="row between"><h3>아침 컨디션</h3>${w ? `<span class="chip ${why.length ? "warn" : ""}">${wellSum(w)}/20</span>` : why.length ? `<span class="chip warn">가볍게</span>` : ""}</div>
    <details data-keep="${key}" ${keepOpen(key, !w)}><summary class="small muted">${w ? "수정" : "입력"}</summary>
    <form class="f" id="wellForm" data-pid="${esc(p.id)}">
      <div class="fields well">${WELL_KEYS.map(([k, l]) => sel(k, l)).join("")}</div>
      <div class="row"><button class="btn primary small" type="submit">저장</button></div>
    </form></details>
  </section>`;
}
// 오늘 할 것: 권장가 표시되고, 눌러서 바꿈 (권장를 다시 누르면 원래대로)
function picksHtml(plan, pid, date) {
  if (!plan.choices) return "";
  const can = pid && canEditSelf(playerOf(pid));
  return `<div class="picks" role="group" aria-label="오늘 할 것">${plan.choices.map(c => `<button type="button" class="pick${c.rec ? " rec" : ""}" aria-pressed="${!!c.sel}" ${can ? `data-act="pick" data-pid="${esc(pid)}" data-date="${esc(date)}" data-k="${c.key}" data-rec="${c.rec ? 1 : 0}"` : "disabled"}>${esc(c.label)}${c.rec ? "<em>권장</em>" : ""}</button>`).join("")}</div>`;
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
    <p class="eyebrow">${longDate(today())}</p>
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
        ${stat("반복 옆뛰기", t.sideStep != null ? t.sideStep + "회" : "—")}
</div>` : emptyLine("측정 후 나와요.")}
      ${nm ? `<p class="small muted">다음 측정 ${md(parseD(nm.mon))} 주${nm.mon === thisMon() ? " (이번 주)" : ""}</p>` : ""}
    </div>
    <div class="panel tile">
      <h3>통증</h3>
      ${mods.length ? `<ul class="plain">${mods.map(m => `<li><b>${esc(painLabel(m))}</b>${m.fromCheck ? ' <span class="small muted">최근 체크</span>' : ""}</li>`).join("")}</ul>` : `<p class="small muted">지금 아픈 곳 없음</p>`}
      ${painCheckForm(p, "home")}
    </div>
  </section>`;
}
function teamStatusHtml() {
  const ps = activePlayers(), t = iso(today()), mon = thisMon();
  const pending = can("full") ? state.profiles.filter(m => m.role === "pending" && m.id !== state.session.user.id) : [];
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
      <div class="stat ${watch.length ? "hot" : ""}"><div class="k">확인할 선수</div><div class="v">${watch.length}</div></div>
    </div>
    ${watch.length ? `<ul class="watch">${watch.map(({ p, why }) => `<li><button type="button" class="btn link" data-act="open" data-pid="${esc(p.id)}">${esc(p.name)}</button>${chipsHtml(why)}</li>`).join("")}</ul>` : ""}
  </section>`;
}
// 명단: 등번호 · 이름 · 포지션 · 학년 · 직책 · 연락처 (관리자 · 부주장 · 총무)
function viewRoster() {
  if (!can("roster")) return `<div class="panel empty"><strong>명단 담당만 볼 수 있어요</strong></div>`;
  const ps = sortedPlayers().slice().sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "ko"));
  const staff = ps.filter(p => p.title || p.media);
  return `<section class="sec"><div class="sec-head"><h3>명단 <span class="small muted">${ps.length}명</span></h3>${can("full") ? `<button class="btn link small" type="button" data-act="view" data-v="intake">직책·정보 바꾸기 →</button>` : ""}</div>
    ${(() => { const hasT = ps.some(p => p.title || p.military); const tel = p => state.contacts[p.id] ? `<a class="r-tel" href="tel:${esc(state.contacts[p.id].replace(/[^0-9+]/g, ""))}">${esc(state.contacts[p.id])}</a>` : `<span class="muted">—</span>`;
      return `<div class="tw"><table class="roster"><thead><tr><th class="num">번호</th><th>이름</th><th>포지션</th><th>학년</th>${hasT ? `<th class="c-title">직책</th>` : ""}<th>전화</th></tr></thead><tbody>
      ${ps.map(p => `<tr><td class="num">${p.number ?? ""}</td><td><b>${esc(p.name)}</b>${p.title ? `<span class="chip t-inline">${esc(TITLES[p.title])}</span>` : ""}${p.military ? `<span class="chip mil t-inline">군</span>` : ""}</td><td><span class="chip pos">${esc(p.pos)}</span></td><td>${esc(String(p.year || "").replace(/학년$/, ""))}</td>${hasT ? `<td class="c-title">${p.title ? `<span class="chip">${esc(TITLES[p.title])}</span>` : ""}${p.military ? `<span class="chip mil">군 복무</span>` : ""}</td>` : ""}<td>${tel(p)}</td></tr>`).join("")}
      </tbody></table></div>`; })()}</section>
    <section class="sec"><h3>운영진</h3>${staff.length ? `<ul class="watch">${staff.map(p => `<li><b>${esc(p.name)}</b>${p.title ? `<span class="chip">${esc(TITLES[p.title])}</span>` : ""}${p.media ? `<span class="chip">영상 담당</span>` : ""}</li>`).join("")}</ul>` : emptyLine("아직 정해진 직책이 없어요.")}</section>`;
}
// 리포트: 지난주 요약 + 선수별 리포트(최근 4주) + 엑셀
// 시즌 = 3월 → 다음 해 2월. 기록이 있는 첫 시즌부터 이번 시즌까지
const syOf = d => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return m >= 3 ? y : y - 1; };
function seasonSelect() {
  const cur = seasonRange().sy, dates = [...Object.values(state.tests).flatMap(x => (x.runs || []).map(r => r.date)), ...Object.keys(state.friendlies)].filter(Boolean);
  const first = Math.min(cur, ...dates.map(syOf)), sel = state.repSy || cur, opts = [];
  for (let y = cur; y >= first; y--) opts.push(`<option value="${y}" ${y === sel ? "selected" : ""}>${y} 시즌</option>`);
  return `<select id="repSy" class="sm-select" aria-label="시즌">${opts.join("")}</select>`;
}
function viewReport() {
  if (!can("training")) return `<div class="panel empty"><strong>관리자 전용이에요</strong></div>`;
  const ps = activePlayers();
  return `<section class="sec"><div class="row between"><div class="row"><h2>리포트</h2>${seasonSelect()}</div><button class="btn" type="button" data-act="xlsx">엑셀 내보내기</button></div></section>
    ${weekSummaryHtml()}${ps.length ? teamReportHtml(ps) : ""}`;
}
// 지난주 요약 (관리 → 주간 요약): 기록 · 완료율 · 컨디션 · 통증 변화
function weekSummaryHtml() {
  const ps = activePlayers(), mon = dAdd(thisMon(), -7), end = dAdd(mon, 6), pm = dAdd(mon, -7);
  const inW = (d, a, b) => d >= a && d <= b;
  const rows = ps.map(p => {
    let plan = 0;
    for (let i = 0; i < 7; i++) { try { const x = planOn(p, dAdd(mon, i)); if (x.slot !== "rest" && !x.optional) plan++; } catch (e) { /* 건너뜀 */ } }
    const lg = logsOf(p.id).filter(e => inW(e.date, mon, end)), days = new Set(lg.map(e => e.date)).size;
    const cl = lg.filter(e => e.completion), done = cl.length ? Math.round(100 * cl.reduce((a, e) => a + doneVal(e.completion), 0) / cl.length) : null;
    const ws = wellOf(p.id).filter(w => inW(w.date, mon, end)).map(wellSum), low = ws.filter(v => v <= WELL_LOW).length;
    const avg = ws.length ? Math.round(10 * ws.reduce((a, b) => a + b, 0) / ws.length) / 10 : null;
    const peak = (a, b) => { const m = {}; for (const c of checksOf(p.id)) if (inW(c.date, a, b)) m[c.area] = Math.max(m[c.area] ?? 0, Number(c.during) || 0, Number(c.morning) || 0, c.rest ? 7 : 0); return m; };
    const now = peak(mon, end), before = peak(pm, dAdd(mon, -1));
    const up = Object.entries(now).filter(([a, v]) => v >= 3 && v - (before[a] ?? 0) >= 2).map(([a, v]) => `${AREA_KO[a] || a} ${before[a] ?? 0}→${v}`);
    const flag = { log: plan > 0 && days < plan - 1, done: done != null && done < 70, well: low >= 2 || (avg != null && avg <= WELL_LOW), pain: up.length > 0 };
    return { p, plan, days, done, ws: ws.length, low, avg, up, flag, n: Object.values(flag).filter(Boolean).length };
  }).sort((a, b) => b.n - a.n);
  const c = (f, t) => `<td class="num ${f ? "cell-warn" : ""}">${t}</td>`;
  const tr = r => `<tr><td><button type="button" class="btn link" data-act="open" data-pid="${esc(r.p.id)}">${esc(r.p.name)}</button></td>
    ${c(r.flag.log, `${r.days}/${r.plan}`)}${c(r.flag.done, r.done != null ? r.done + "%" : "—")}
    ${c(r.flag.well, r.ws ? `${r.avg}${r.low ? ` <span class="small">낮음 ${r.low}</span>` : ""}` : `<span class="small">없음</span>`)}
    ${c(r.flag.pain, r.up.length ? `<span class="small">${esc(r.up.join(", "))}</span>` : "—")}</tr>`;
  const head = `<thead><tr><th>선수</th><th>기록</th><th>완료율</th><th>컨디션</th><th>통증↑</th></tr></thead>`;
  const hot = rows.filter(r => r.n), rest = rows.filter(r => !r.n);
  return `<section class="panel wk-sum">
    <div class="row between"><h3>지난주 요약</h3><span class="small muted">${md(parseD(mon))} – ${md(parseD(end))}</span></div>
    <div class="row small"><span class="chip ${rows.some(r => r.flag.log) ? "warn" : ""}">기록 부족 ${rows.filter(r => r.flag.log).length}</span><span class="chip ${rows.some(r => r.flag.well) ? "warn" : ""}">컨디션 낮음 ${rows.filter(r => r.flag.well).length}</span><span class="chip ${rows.some(r => r.flag.pain) ? "crit" : ""}">통증 늘어남 ${rows.filter(r => r.flag.pain).length}</span></div>
    ${hot.length ? `<div class="tw"><table>${head}<tbody>${hot.map(tr).join("")}</tbody></table></div>` : `<p class="small muted">걸리는 선수 없어요</p>`}
    ${rest.length ? `<details><summary class="small muted">나머지 ${rest.length}명</summary><div class="tw"><table>${head}<tbody>${rest.map(tr).join("")}</tbody></table></div></details>` : ""}
    
  </section>`;
}
/* ---------- 프로그램 ---------- */
const rxMain = rx => fmtRx(rx).split(" · ")[0];
const rxRest = rx => fmtRx(rx).split(" · ").slice(1).map(t => /^약 [\d.]+kg$/.test(t) ? `<b>${esc(t)}</b>` : esc(t)).join(" · ");
const NOEDIT_RE = /^(통증 체크|세션 RPE 기록|정규 훈련|휴식|교류전)$/;
// 편집 모드: 운동 하나하나가 박스. ✕로 빼고, 블록마다 '+ 박스'로 목록에서 골라 넣음
function blockHtml(b, edit) {
  if (edit) {
    const boxes = b.items.map(x => NOEDIT_RE.test(x.name) ? `<div class="box fixed"><span class="bn">${esc(x.name)}</span><span class="br">${esc(rxMain(x.rx))}</span></div>`
      : `<div class="box ${x.edit ? "added" : ""}"><span class="bn">${esc(x.name)}${x.mod ? ` <span class="mod">${esc(x.mod)}</span>` : ""}</span><span class="br">${esc(rxMain(x.rx))}</span><button type="button" class="bx" data-act="boxdel" data-b="${esc(b.key)}" data-n="${esc(x.name)}" ${x.edit ? `data-e="${esc(x.edit)}"` : ""} aria-label="${esc(x.name)} 빼기">✕</button></div>`).join("");
    return `<section class="blk b-${esc(b.key)} editing"><h4>${esc(b.title)}</h4><div class="boxes">${boxes}<button type="button" class="box add-box" data-act="boxadd" data-b="${esc(b.key)}">＋ 운동 추가</button></div></section>`;
  }
  return `<section class="blk b-${esc(b.key)}"><h4>${esc(b.title)}</h4><ul class="rows">${b.items.map(x => {
    const rec = x.name === "통증 체크" ? "pain" : x.name === "세션 RPE 기록" ? "log" : "";
    if (rec) return `<li class="tap" data-act="gorec" data-focus="${rec}" role="button" tabindex="0"><div class="nm">${esc(x.name)} <span class="mod">기록 →</span></div><div class="rx">${esc(fmtRx(x.rx))}</div></li>`;
    const tap = exGuide(x.name) || exSeconds(x.rx) || exLink(x.name);
    return `<li${tap ? ` class="tap" data-act="ex" data-n="${esc(x.name)}" data-r="${esc(x.rx ?? "")}" data-c="${esc(x.cue || "")}" role="button" tabindex="0"` : ""}>
    <div class="nm">${esc(x.name)}${x.mod ? ` <span class="mod">${esc(x.mod)}</span>` : ""}</div><div class="rx">${esc(rxMain(x.rx))}</div>${rxRest(x.rx) ? `<div class="sub">${rxRest(x.rx)}</div>` : ""}</li>`; }).join("")}</ul>
    ${b.note ? `<p class="bnote">${esc(b.note).replace(/\n/g, "<br>")}</p>` : ""}</section>`;
}
/* ---------- 프로그램 박스 편집 (피지컬 담당) ---------- */
const SLOT_KO = { gymA: "하체 웨이트 날", gymB: "상체 웨이트 날", bwU: "맨몸 상체 날", bwL: "맨몸 하체 날", act: "활성화 날", team: "정규 훈련 날", recover: "회복 날", prep: "대회 전날" };
const editCtx = { slot: null, pid: null };
function editBar(plan, p) {
  if (!SLOT_KO[plan.slot]) return `<section class="panel edit-bar"><div class="row between"><b>프로그램 편집</b><button class="btn small" type="button" data-act="boxedit">완료</button></div><p class="small muted">이날(${esc(plan.kind || plan.slot)})은 편집할 수 없어요. 웨이트·맨몸·활성화·정규 훈련·회복 날을 골라 주세요.</p></section>`;
  const team = !p || state.editScope === "team";
  const rem = state.edits.filter(e => e.op === "remove" && e.slot === plan.slot && (team ? !e.pid : e.pid === p.id));
  return `<section class="panel edit-bar"><div class="row between"><b>프로그램 편집 · ${SLOT_KO[plan.slot]}</b><button class="btn small primary" type="button" data-act="boxedit">완료</button></div>
    ${p ? `<div class="seg fill" role="radiogroup" aria-label="적용 범위"><button type="button" class="seg-tab ${team ? "" : "on solid"}" data-act="boxscope" data-s="me">${esc(p.name)}만</button><button type="button" class="seg-tab ${team ? "on solid" : ""}" data-act="boxscope" data-s="team">팀 전체</button></div>` : ""}
    <p class="small muted">${team ? "모든 선수" : esc(p.name) + " 선수"}의 '${SLOT_KO[plan.slot]}'마다 똑같이 바뀌어요. ✕ 제외 · '＋ 운동 추가'로 넣기</p>
    ${rem.length ? `<div class="removed"><span class="small muted">제외한 운동</span>${rem.map(e => `<button type="button" class="chip" data-act="boxundo" data-e="${esc(e.id)}" title="다시 넣기">${esc(e.name)} ↺</button>`).join("")}</div>` : ""}
  </section>`;
}
async function boxWrite(op, row) {
  try {
    if (op === "delete") ok(await sb.from("program_edits").delete().eq("id", row));
    else ok(await sb.from("program_edits").insert(row));
    await loadAll();
    return true;
  } catch (e) { toast(failMsg(e)); return false; }
}
function openBoxLib(block) {
  const el = document.getElementById("sheet"), cats = [...new Set(BOX_LIB.map(x => x.c))];
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>운동 추가</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="boxForm" data-b="${esc(block)}" data-close="1">
      <div class="fields"><label class="fl wide">운동<input id="bx-name" required maxlength="80" placeholder="목록에서 고르거나 직접 쓰기"></label><label class="fl">세트×반복<input id="bx-rx" maxlength="40" placeholder="예: 3×8"></label></div>
      <div class="row"><button class="btn primary" type="submit">추가</button></div>
    </form>
    <input id="bx-q" class="bx-q" placeholder="찾기 (예: 홉, 스쿼트, 발목)" autocomplete="off">
    <div class="lib-cats">${cats.map((c, i) => `<button type="button" class="chip ${i ? "" : "on"}" data-act="libcat" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="lib" id="lib">${libList(cats[0], "")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
const libList = (cat, q) => BOX_LIB.filter(x => q ? x.n.includes(q) : x.c === cat).slice(0, 80).map(x => `<button type="button" class="box lib-box" data-act="libpick" data-n="${esc(x.n)}" data-r="${esc(x.r)}"><span class="bn">${esc(x.n)}</span><span class="br">${esc(rxMain(x.r))}</span></button>`).join("") || `<p class="small muted">없어요</p>`;
function viewPlan() {
  if (can("training") && state.pid === "__team") return viewTeamPlan();
  const pid = viewPid();
  if (!pid) return state.admin ? `<div class="panel empty"><strong>등록된 선수가 없어요</strong><button class="btn primary" data-act="view" data-v="intake">선수 등록하기</button></div>`
    : `<div class="panel empty"><strong>계정이 선수와 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`;
  const p = playerOf(pid);
  const mon = selMon(), d = selDay(), date = dAdd(mon, d);
  const plan = planOn(p, date);
  const notes = [...plan.notes];
  state.planCtx = canEditSelf(p) ? { pid, date } : null; // 운동 창에서 무게 기록
  editCtx.slot = plan.slot; editCtx.pid = state.editScope === "team" ? null : pid;
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
    ${can("training") ? (state.boxEdit ? editBar(plan, p) : `<button class="btn small cu-btn" type="button" data-act="boxedit">프로그램 편집</button>`) : ""}
    ${notes.length ? `<ul class="notes callout">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${picksHtml(plan, pid, date)}${scopedBlocks(plan, false, can("training") && state.boxEdit && !!SLOT_KO[plan.slot])}
  </section>`;
}
// 팀 세션(다 같이) / 개인(포지션 · 재활 · 예방)으로 나눠 보여 주기
// 비시즌은 '자율', 쉬는 날·대회 날은 나누지 않음
function scopedBlocks(plan, teamOnly, edit) {
  const bh = b => blockHtml(b, edit);
  const team = plan.blocks.filter(b => b.scope !== "me"), me = teamOnly ? [] : plan.blocks.filter(b => b.scope === "me");
  if (["rest", "recover", "match", "prep"].includes(plan.slot) && !me.length) return `<div class="blocks">${team.map(bh).join("")}</div>`;
  const teamH = plan.optional ? "자율" : "팀 세션";
  if (teamOnly) return `<h3 class="scope-h">${teamH}</h3><div class="blocks">${team.map(bh).join("")}</div>${edit && !plan.blocks.some(b => b.key === "extra") ? `<button type="button" class="btn add" data-act="boxadd" data-b="extra">＋ 블록 추가</button>` : ""}`;
  const more = (key, label) => edit && !plan.blocks.some(b => b.key === key) ? `<button type="button" class="btn add" data-act="boxadd" data-b="${key}">+ ${label}</button>` : "";
  return `<div class="split"><div class="sp-col"><h3 class="scope-h">${teamH}</h3>${team.map(bh).join("")}${more("extra", "블록 추가 (팀)")}</div>
    <div class="sp-col"><h3 class="scope-h me">개인</h3>${me.length ? me.map(bh).join("") : edit ? "" : `<p class="small muted">오늘은 개인 운동이 없어요.</p>`}${more("extra-me", "블록 추가 (개인)")}</div></div>`;
}
function viewTeamPlan() {
  const mon = selMon(), d = selDay(), date = dAdd(mon, d);
  state.planCtx = null;
  const plan = teamPlanOn(date);
  editCtx.slot = plan.slot; editCtx.pid = null;
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
    ${can("training") ? (state.boxEdit ? editBar(plan, null) : `<button class="btn small cu-btn" type="button" data-act="boxedit">프로그램 편집</button>`) : ""}
    ${scopedBlocks(plan, true, can("training") && state.boxEdit && !!SLOT_KO[plan.slot])}
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
    <div class="col">${liftHtml(p)}${testsHtml(p)}</div>
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
        <label class="fl">완료율${doneSelect("lg-done")}</label>
        <label class="fl wide">메모<input type="text" id="lg-note" maxlength="200" placeholder="컨디션, 손목·손가락 통증 등"></label>
      </div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div>
    </form>` : ""}
    ${entries.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>종류</th><th>RPE×분</th><th>통증</th>${can("full") ? "<th></th>" : ""}</tr></thead><tbody>
      ${entries.map(e => `<tr><td class="num">${md(parseD(e.date))}</td><td>${esc((LOG_TYPES[e.type] || ["기타"])[0])}${e.completion && e.completion !== "all" ? ` <span class="chip">${doneTxt(e.completion)}</span>` : ""}</td><td class="num">${Number(e.rpe) * Number(e.minutes)}</td><td>${e.painArea ? `<span class="chip ${Number(e.pain) >= 3 ? "crit" : ""}">${esc(AREA_KO[e.painArea] || "")} ${esc(e.pain)}</span>` : "—"}</td>
      ${can("full") ? `<td><button class="btn link danger" data-act="dellog" data-id="${esc(e._id)}">삭제</button></td>` : ""}</tr>`).join("")}
    </tbody></table></div>` : emptyLine("아직 기록이 없어요.")}
  </section>`;
}
// 측정: 선수가 직접 입력 (한 달에 한 번 측정 주에 안내), 관리자는 고치거나 지움
const measTable = (r, opts = {}) => {
  const sign = v => v == null ? "—" : (v >= 0 ? "+" : "") + v, mine = t => can("training") || t.author === (state.session && state.session.user.id);
  return `<div class="tw"><table><thead><tr><th>날짜</th>${opts.reach ? "<th>리치</th>" : ""}<th>버티컬</th><th>맥스 버티컬</th><th>네트 위</th><th>옆뛰기</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${md(parseD(t.date))}</td>${opts.reach ? `<td class="num">${t.reach ?? "—"}</td>` : ""}<td class="num">${vertOf(t) ?? "—"}</td><td class="num">${maxVertOf(t) ?? "—"}</td><td class="num">${sign(overNet(t, maxVertOf(t)))}</td><td class="num">${t.sideStep ?? "—"}</td>
      <td class="acts">${can("training") ? `<button class="btn link small" type="button" data-act="edtest" data-id="${esc(t.id)}">수정</button>` : ""}${mine(t) ? `<button class="btn link danger small" type="button" data-act="deltest" data-id="${esc(t.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
};
const isMeas = t => ["reach", "vert", "maxVert", "sideStep"].some(k => t[k] != null);
function testsHtml(p) {
  const r = runs(p.id).filter(isMeas), info = infoOn(iso(today())), week = !!info.measure;
  const nf = (id, label, step = "0.5", max = 400) => `<label class="fl">${label}<input type="number" id="${id}" inputmode="decimal" step="${step}" min="0" max="${max}"></label>`;
  const nm = nextMeasure(iso(today()), events());
  return `<section class="sec"><div class="sec-head"><h3>측정</h3>${nm ? `<span class="small muted">${nm.mon === thisMon() ? "이번 주 측정 주" : `다음 측정 ${md(parseD(nm.mon))} 주`}</span>` : ""}</div>
    ${r.length ? measTable(r) : emptyLine("아직 측정이 없어요.")}
    ${isMe(p) ? `<details class="panel" data-keep="measure-form" ${keepOpen("measure-form", week || !r.length)}><summary><b>측정 입력</b>${week ? ` <span class="chip warn">이번 주</span>` : ""}</summary>
      <form class="f" id="measureForm" data-pid="${esc(p.id)}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="ms-date" value="${iso(today())}" required></label>
          ${latest(p.id) && latest(p.id).reach != null ? "" : nf("ms-reach", "스탠딩 리치 (cm)")}${nf("ms-vert", "버티컬 (cm)", "0.5", 150)}${nf("ms-maxvert", "맥스 버티컬 (cm)", "0.5", 150)}${nf("ms-side", "반복 옆뛰기 20초 (회)", "1", 120)}
        </div>
        ${protocolHtml()}
        <div class="row"><button class="btn primary" type="submit">저장</button></div>
      </form></details>` : ""}
  </section>`;
}
// 측정 방법 (매번 같은 방법으로 재야 비교가 돼요)
const PROTOCOL = [
  ["공통", "한 달에 한 번, 웨이트 A 전 같은 시간대·같은 신발. 워밍업 10분 뒤 아래 순서로"],
  ["스탠딩 리치", "처음 한 번만. 벽 옆에 서서 발뒤꿈치 붙이고 한 손 끝까지"],
  ["버티컬", "제자리, 팔 스윙 허용, 3회 중 최고 · 손끝 도달 − 리치"],
  ["맥스 버티컬", "평소 스파이크 도움닫기, 한 손 터치, 3회 중 최고 · 도달 − 리치"],
  ["반복 옆뛰기", "가운데 선을 밟고 서서 1m 옆 선까지 옆으로 (점프 금지). 선을 넘거나 밟을 때마다 1점, 20초 × 2회 중 좋은 값"],
];
const protocolHtml = () => `<details class="proto"><summary class="small">측정 방법</summary><dl>${PROTOCOL.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;

/* ---------- 웨이트 기록 · 추정 1RM ---------- */
function liftHtml(p) {
  const list = liftsOf(p.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created || "").localeCompare(String(a.created || "")));
  const best = e1rmMap(p.id, iso(today()));
  const mine = l => can("full") || l.author === (state.session && state.session.user.id);
  return `<section class="sec"><h3>웨이트 기록</h3>
    ${Object.keys(best).length ? `<p class="small">추정 1RM ${Object.entries(best).map(([k, v]) => `<span class="chip">${esc(LIFT_KO[k])} ${Math.round(v)}kg</span>`).join(" ")}</p>` : ""}
    ${list.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>운동</th><th>무게×회</th><th>RIR</th><th>추정 1RM</th><th></th></tr></thead><tbody>
      ${list.slice(0, 12).map(l => `<tr><td class="num">${md(parseD(l.date))}</td><td>${esc(l.name || LIFT_KO[l.lift] || "")}</td><td class="num">${l.kg}×${l.reps}</td><td class="num">${l.rir}</td><td class="num">${Math.round(e1rmOf(l.kg, l.reps, l.rir))}</td>
        <td>${mine(l) ? `<button class="btn link danger" type="button" data-act="dellift" data-id="${esc(l.id)}">삭제</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("기록이 없어요.")}
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
    ["맥스 버티컬", ...fv(maxVertOf), "cm"], ["버티컬", ...fv(vertOf), "cm"], ["블로킹 점프", ...fk("block"), "cm"], ["반복 옆뛰기", ...fk("sideStep"), "회"], ["5-10-5", ...fk("agility"), "초"], ["CMJ", ...fk("cmj"), "cm"], ["RSI", ...fk("rsi"), ""],
    ["스쿼트 5RM", ...fk("squat"), "kg"], ["RDL 5RM", ...fk("rdl"), "kg"], ["턱걸이", ...fk("pull"), "회"],
    ...Object.keys(LIFT_KO).map(k => [`${LIFT_KO[k]} 추정 1RM`, ...lf(k), "kg"]),
  ];
  return rows.filter(x => x[1] != null && x[2] != null);
}
function adherence(pid, days = 28) {
  const from = iso(addDays(today(), -days));
  const ws = wellOf(pid).filter(w => w.date >= from).map(wellSum);
  const lg = logsOf(pid).filter(e => e.date >= from && e.completion);
  const done = lg.length ? Math.round(100 * lg.reduce((a, e) => a + doneVal(e.completion), 0) / lg.length) : null;
  return { well: ws.length ? Math.round(10 * ws.reduce((a, b) => a + b, 0) / ws.length) / 10 : null, wellN: ws.length, done, logs: logsOf(pid).filter(e => e.date >= from).length };
}
const LOWER_BETTER = new Set(["5-10-5"]); // 기록이 줄어야 좋은 것
function reportHtml(p) {
  const rows = growthRows(p.id, p.weight), a = adherence(p.id);
  const d = (x, y, n) => { const v = Math.round((y - x) * 100) / 100, bad = LOWER_BETTER.has(n) ? v > 0 : v < 0; return `<small class="${bad ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; };
  return `<section class="sec report"><h3>성장 리포트</h3>
    <div class="stats">
      <div class="stat"><div class="k">최근 4주 세션</div><div class="v">${a.logs}</div></div>
      <div class="stat"><div class="k">완료율</div><div class="v">${a.done != null ? a.done + "%" : "—"}</div></div>
      <div class="stat"><div class="k">아침 컨디션 평균</div><div class="v">${a.well != null ? a.well + "/20" : "—"}</div></div>
    </div>
    ${rows.length ? `<div class="tw"><table><thead><tr><th>항목</th><th>처음</th><th>지금</th><th>변화</th></tr></thead><tbody>
      ${rows.map(([n, x, y, u]) => `<tr><td>${esc(n)}</td><td class="num">${x}${u}</td><td class="num">${y}${u}</td><td class="num">${d(x, y, n)}</td></tr>`).join("")}
    </tbody></table></div>` : emptyLine("측정 2회부터 나와요.")}
  </section>`;
}
// 본인 기록: 선수 계정, 그리고 관리자가 '선수 화면'으로 볼 때의 자기 선수
const isMe = p => !!p && !!state.myPid && p.id === state.myPid && (state.role === "player" || state.coach);
function canEditSelf(p) { return can("full") || isMe(p); }
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
      <h2>SNUVT</h2>
      <p>서울대학교 배구부</p>
    </div>
    <form class="f panel" id="authForm">
      <div><h3>${login ? "로그인" : "가입하기"}</h3><p class="small muted">${login ? "가입 → 내 정보 입력 → 관리자 승인 순서예요." : "가입하면 바로 내 정보 입력으로 넘어가요."}</p></div>
      ${login ? "" : `<div class="seg-pick" role="radiogroup" aria-label="팀"><label><input type="radio" name="au-team" value="men" checked><span>남자부</span></label><label><input type="radio" name="au-team" value="women"><span>여자부</span></label></div>`}
      <label class="fl">이메일<input type="email" id="au-email" autocomplete="email" required></label>
      <label class="fl">비밀번호 (6자 이상)<input type="password" id="au-pw" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required></label>
      <div class="auth-actions"><button class="btn primary" type="submit">${login ? "로그인" : "가입하기"}</button>
        ${login ? `<button class="btn link small" type="button" data-act="authmode" data-m="reset">비밀번호를 잊었어요</button>` : ""}</div>
      ${state.authMsg ? `<p class="msg ${state.authErr ? "err" : ""}">${esc(state.authMsg)}</p>` : ""}
      <div class="auth-alt"><button class="btn" type="button" data-act="authmode">${login ? "처음이면 가입하기" : "계정이 있으면 로그인"}</button></div>
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
    <div><h2>내 정보</h2><p class="lede">${state.role === "pending" ? "제출하면 관리자가 승인해요." : state.admin ? "" : "내 정보를 입력하면 프로그램이 열려요."}</p></div>
    <form class="f panel" id="selfForm">
      <fieldset><legend>기본 정보</legend>
        <div class="fields">
          <label class="fl">이름<input id="sf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
          <label class="fl">포지션<select id="sf-pos" required><option value="">고르기</option>${POS_ORDER.map(k => opt(k, p.pos, `${POS[k]} (${k})`)).join("")}</select></label>
          <label class="fl">학년<input id="sf-year" maxlength="10" placeholder="예: 3" value="${esc(p.year || "")}"></label>
          <label class="fl">등번호<input id="sf-num" type="number" inputmode="numeric" min="0" max="99" value="${esc(p.number ?? "")}"></label>
          <label class="fl">전화번호<input id="sf-phone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" value="${esc(state.myPhone || "")}"></label>
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
  const stOf = m => m.role === "player" && m.player_id && (state.players[m.player_id] || {}).military ? "military" : m.role;
  return `<details class="sec members" data-keep="members" ${keepOpen("members", list.some(m => m.role === "pending"))}><summary><h3>팀원 계정 <span class="muted small">${list.length}명${list.some(m => m.role === "pending") ? ` · 대기 ${list.filter(m => m.role === "pending").length}` : ""}</span></h3></summary>
    <ul class="mem-list">${list.map(m => `<li><div class="mem-who">${nameOf(m) ? `<b>${esc(nameOf(m))}</b>` : `<span class="muted">정보 없음</span>`}${m.role === "pending" ? ' <span class="chip warn">대기</span>' : ""}${stOf(m) === "military" ? ' <span class="chip mil">군 복무</span>' : ""}<span class="small muted">${esc(m.email || "")}</span></div>
      ${m.id === state.session.user.id ? '<span class="small muted">나 · 관리자</span>' : `<div class="mem-act"><select id="mr-${esc(m.id)}" aria-label="역할">${roleOpt("pending", stOf(m), "대기")}${roleOpt("player", stOf(m), "부원")}${roleOpt("military", stOf(m), "군 복무")}${roleOpt("coach", stOf(m), "관리자")}${m.player_id ? roleOpt("alumni", "", "졸업") : ""}</select>
        <button class="btn small" type="button" data-act="savemember" data-id="${esc(m.id)}">저장</button>
        <button class="btn small danger" type="button" data-act="delmember" data-id="${esc(m.id)}">삭제</button></div>`}</li>`).join("")}</ul></details>`;
}
function alumniHtml() {
  const l = state.alumni || [];
  if (!l.length) return "";
  return `<details class="sec members" data-keep="alumni" ${keepOpen("alumni", false)}><summary><h3>졸업생 <span class="muted small">${l.length}명 · 계정·개인정보 없음, 기록만 남음</span></h3></summary>
    <ul class="watch">${l.map(x => `<li><b>${esc(x.name)}</b><span class="chip pos">${esc(x.pos || "")}</span><span class="small muted">${x.left ? esc(x.left) + " 졸업" : ""}</span><button class="btn link danger small" type="button" data-act="alumdel" data-pid="${esc(x.id)}">기록까지 삭제</button></li>`).join("")}</ul></details>`;
}
function viewIntake() {
  if (!can("full")) return `<div class="panel empty"><strong>관리자 전용이에요</strong></div>`;
  const ps = sortedPlayers();
  const isNew = state.editPid === "__new" || !ps.length;
  const pid = isNew ? null : (state.editPid && state.players[state.editPid] ? state.editPid : ps[0].id);
  const p = pid ? { id: pid, ...state.players[pid] } : {};
  const h = (pid && state.health[pid]) || {};
  const pain = h.pain || {};
  const list = `<div class="plist">${ps.map(x => `<button type="button" data-act="edit" data-pid="${esc(x.id)}" aria-pressed="${x.id === pid}"><span>${esc(x.name)}</span><span class="chip pos">${esc(x.pos)}</span>${x.military ? `<span class="chip mil">군</span>` : ""}</button>`).join("")}
    <button type="button" data-act="edit" data-pid="__new" aria-pressed="${isNew}"><span>+ 새 선수</span></button></div>`;
  const opt = (v, cur) => `value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}`;
  return `<section class="sec"><h2>부원</h2></section>
  ${membersHtml()}
  ${alumniHtml()}
  <section class="side">
    <div class="panel">${list}</div>
    <div class="sec">
      <form class="f panel" id="playerForm" data-pid="${esc(pid || "")}">
        <fieldset><legend>기본 정보</legend>
          <div class="fields">
            <label class="fl">이름<input id="pf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
            <label class="fl">포지션<select id="pf-pos" required>${POS_ORDER.map(k => `<option ${opt(k, p.pos)}>${k}</option>`).join("")}</select></label>
            <label class="fl">등번호<input id="pf-num" type="number" inputmode="numeric" min="0" max="99" value="${esc(p.number ?? "")}"></label>
            <label class="fl">직책<select id="pf-title"><option value="">부원</option>${Object.entries(TITLES).map(([k, l]) => `<option value="${k}" ${p.title === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="check"><input type="checkbox" id="pf-media" ${p.media ? "checked" : ""}> 영상 담당</label>
            <label class="fl">전화번호<input id="pf-phone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" value="${esc((state.contacts || {})[pid] || "")}"></label>
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
        <label class="check"><input type="checkbox" id="hf-consent" ${h.consent ? "checked" : ""} required> 선수가 프로그램 목적의 정보 사용에 동의함</label>
        <div class="row"><button class="btn primary" type="submit">${pid ? "저장" : "선수 추가"}</button>
          ${pid && pid !== state.myPid ? `<button class="btn danger" type="button" data-act="retireall" data-pid="${esc(pid)}">삭제</button>` : ""}</div>
      </form>
      ${pid ? testFormHtml(pid) : ""}
    </div>
  </section>`;
}
function testFormHtml(pid) {
  const r = runs(pid).filter(isMeas);
  return `<section class="panel"><h3>측정 기록</h3>
    ${r.length ? measTable(r, { reach: true }) : emptyLine("아직 측정이 없어요.")}</section>`;
}
function openTestEdit(id) {
  let t = null, pid = null;
  for (const [k, v] of Object.entries(state.tests)) { const x = (v.runs || []).find(z => z.id === id); if (x) { t = x; pid = k; } }
  if (!t) return;
  const f = (k, label, v, step, max) => `<label class="fl">${label}<input type="number" id="et-${k}" inputmode="decimal" step="${step}" min="0" max="${max}" value="${esc(v ?? "")}"></label>`;
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>측정 고치기 · ${esc((playerOf(pid) || {}).name || "")}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="testEditForm" data-id="${esc(id)}" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="et-date" value="${esc(t.date)}" required></label>
      ${f("reach", "스탠딩 리치 (cm)", t.reach, "0.5", 400)}${f("vert", "버티컬 (cm)", t.vert, "0.5", 150)}${f("maxvert", "맥스 버티컬 (cm)", t.maxVert, "0.5", 150)}${f("side", "반복 옆뛰기 (회)", t.sideStep, "1", 120)}
    </div><div class="row"><button class="btn primary" type="submit">저장</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}

/* ---------- 훈련 부하 (관리자) ---------- */

/* ---------- 엑셀 내보내기 (관리자) ---------- */
const XL_COLS = {
  tests: { date: "날짜", reach: "스탠딩 리치", vert: "버티컬", max_vert: "맥스 버티컬", cmj: "CMJ", block: "블로킹 점프", approach: "어프로치 점프", side_step: "반복 옆뛰기(회)", pro_agility: "5-10-5(초)", rsi: "RSI",
    squat: "스쿼트 5RM", rdl: "RDL 5RM", pull: "턱걸이", plank: "플랭크(초)", side_l: "사이드 플랭크 왼", side_r: "사이드 플랭크 오른", sorensen: "소렌슨(초)", flexor: "굴곡근(초)",
    bal_l: "한 발 서기 왼", bal_r: "한 발 서기 오른", hop_l: "한 발 홉 왼", hop_r: "한 발 홉 오른", ktw_l: "무릎 벽 왼", ktw_r: "무릎 벽 오른",
    ir_d: "내회전 주손", ir_n: "내회전 반대손", er_d: "외회전 주손", er_n: "외회전 반대손", hs_stage: "핸드스탠드 단계", hs_sec: "핸드스탠드(초)", hs_walk: "핸드스탠드 걷기" },
  logs: { date: "날짜", type: "종류", minutes: "분", rpe: "RPE", completion: "완료율", jumps: "점프 수", pain_area: "통증 부위", pain: "통증", note: "메모" },
  wellness: { date: "날짜", sleep: "수면", fatigue: "피로", soreness: "근육통", mood: "기분·스트레스" },
  lift_sets: { date: "날짜", name: "운동", kg: "kg", reps: "반복", rir: "RIR" },
  pain_checks: { date: "날짜", area: "부위", during: "운동 중", morning: "다음 날 아침", rest: "쉴 때도", note: "메모" },
  absences: { date: "날짜", reason: "사유", note: "메모" },
};
const XL_SHEETS = [["absences", "불참"], ["tests", "측정"], ["logs", "세션 기록"], ["wellness", "컨디션"], ["lift_sets", "무게"], ["pain_checks", "통증"]];
function loadScript(src) {
  return new Promise((ok, no) => { const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = no; document.head.appendChild(el); });
}
async function exportXlsx(sy) {
  toast("엑셀 만드는 중…");
  try {
    if (!window.XLSX) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    const t = iso(today()), from = `${sy}-03-01`, to = `${sy + 1}-03-01`;
    const pr = await sb.from("players").select("id,name,pos,year,height,weight,exp");
    if (pr.error) throw pr.error;
    const name = Object.fromEntries((pr.data || []).map(p => [p.id, p.name])), pos = Object.fromEntries((pr.data || []).map(p => [p.id, p.pos]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sortedPlayers().map(p => ({ 이름: p.name, 포지션: p.pos, 학년: p.year || "", "키(cm)": p.height ?? "", "체중(kg)": p.weight ?? "", "배구 경력(년)": p.exp ?? "" }))), "선수");
    const fq = await sb.from("friendlies").select("*").gte("date", from).lt("date", to).order("date");
    if (!fq.error) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((fq.data || []).length ? fq.data.map(f => ({ 날짜: f.date, 상대: f.opponent, 방식: f.format === "9" ? "9인제" : "6인제", 시작: (f.start_time || "").slice(0, 5), 끝: (f.end_time || "").slice(0, 5), 장소: f.place || "", 메모: f.note || "" })) : [{ 날짜: "기록 없음" }]), "교류전");
    for (const [tb, label] of XL_SHEETS) {
      const r = await sb.from(tb).select("*").gte("date", from).lt("date", to).order("date");
      if (r.error) throw r.error;
      const cols = XL_COLS[tb];
      const rows = (r.data || []).filter(x => name[x.player_id]).sort((a, b) => a.date.localeCompare(b.date) || name[a.player_id].localeCompare(name[b.player_id], "ko")).map(x => {
        const o = { 선수: name[x.player_id], 포지션: pos[x.player_id] };
        for (const [k, l] of Object.entries(cols)) {
          let v = x[k];
          if (tb === "logs" && k === "type") v = (LOG_TYPES[v] || [v])[0];
          if (tb === "logs" && k === "completion") v = doneTxt(v);
          if ((tb === "pain_checks" && k === "area") || (tb === "logs" && k === "pain_area")) v = AREA_KO[v] || v || "";
          if (k === "rest") v = v ? "예" : "";
          if (tb === "absences" && k === "reason") v = ABS_REASONS[v] || v;
          o[l] = v ?? "";
        }
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 선수: "기록 없음" }]);
      XLSX.utils.book_append_sheet(wb, ws, label);
    }
    XLSX.writeFile(wb, `SNUVT_${sy}시즌_${t}.xlsx`);
  } catch (e) { console.warn(e); toast("내보내지 못했어요. 연결을 확인해 주세요"); }
}
function teamReportHtml(ps) {
  const ch = (rows, n) => { const r = rows.find(x => x[0] === n); if (!r) return "—"; const v = Math.round((r[2] - r[1]) * 10) / 10; return `${r[2]} <small class="${(LOWER_BETTER.has(n) ? v > 0 : v < 0) ? "neg" : ""}">${v > 0 ? "+" : ""}${v}</small>`; };
  return `<section class="sec"><h3>선수별 리포트 <span class="small muted">최근 4주</span></h3>
    <div class="tw"><table><thead><tr><th>선수</th><th>컨디션</th><th>완료율</th><th>세션</th><th>맥스 버티컬</th><th>스쿼트 1RM</th><th>옆뛰기</th></tr></thead><tbody>
    ${ps.map(p => { const a = adherence(p.id), g = growthRows(p.id, p.weight);
      return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td><td class="num ${a.well != null && a.well <= WELL_LOW ? "cell-warn" : ""}">${a.well ?? "—"}</td><td class="num">${a.done != null ? a.done + "%" : "—"}</td><td class="num">${a.logs}</td>
        <td class="num">${ch(g, "맥스 버티컬")}</td><td class="num">${ch(g, `${LIFT_KO.squat} 추정 1RM`)}</td><td class="num">${ch(g, "반복 옆뛰기")}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}

/* ---------- 일정 (1년: 3월 → 다음 해 2월) ---------- */
// 일정 섹션: 다가오는 일정 · 대회·교류전 · 훈련 관리(관리자). 추가는 '+' 버튼 → 아래에서 올라오는 창
const seasonRange = () => { const t = iso(today()), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)), sy = m >= 3 ? y : y - 1; return { t, sy, from: `${sy}-03-01`, to: `${sy + 1}-02-28` }; };
const addBtn = (form, label) => `<button class="btn add" type="button" data-act="addform" data-f="${form}">+ ${label}</button>`;
function viewSeason() {
  const { t } = seasonRange(), me = playerOf(state.myPid), l = upcoming(t, 14);
  return `<div class="sched-cols"><section class="sec sched-list"><h3>다가오는 훈련 <span class="small muted">2주</span></h3>${l.length ? attendRows(l, me) : emptyLine("2주 안에 팀 일정이 없어요.")}</section>
    <section class="sec sched-cal">${calHtml(me)}</section></div>`;
}
// 달력: 정규 훈련 · 자율 훈련 · 교류전 · 대회 색을 나눠서 한 달을 한눈에
const CAL_KIND = (i, d) => i.slot === "match" ? "match" : i.slot === "friendly" ? "fr" : i.slot === "tryout" ? "try" : i.slot === "team" && !i.teamOff ? "team" : opensOn(d).length ? "open" : i.slot === "team" ? "off" : "";
const CAL_LABEL = { team: "정규 훈련", open: "자율 훈련", fr: "교류전", match: "대회", try: "트라이아웃", off: "훈련 없음" };
function calHtml(me) {
  const t = iso(today()), ym = state.calMonth || t.slice(0, 7), [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = first.getDay();
  const sel = state.calDay && state.calDay.startsWith(ym) ? state.calDay : (t.startsWith(ym) ? t : null);
  const cells = [];
  for (let k = 0; k < lead; k++) cells.push(`<span class="cd blank"></span>`);
  for (let d = 1; d <= days; d++) {
    const ds = `${ym}-${String(d).padStart(2, "0")}`, i = infoOn(ds), k = CAL_KIND(i, ds), a = me && absOf(me.id, ds), op = k !== "open" && opensOn(ds).length;
    cells.push(`<button type="button" class="cd ${k ? "k-" + k : ""} ${ds === t ? "today" : ""} ${ds === sel ? "sel" : ""} ${ds < t ? "past" : ""}" data-act="calday" data-d="${ds}" aria-pressed="${ds === sel}" aria-label="${longDate(parseD(ds))}${k ? " " + CAL_LABEL[k] : ""}${op ? " 자율 훈련" : ""}${a ? " 불참" : ""}"><span class="n">${d}</span>${a ? `<i class="abs" aria-hidden="true"></i>` : ""}${op ? `<i class="opn" aria-hidden="true"></i>` : ""}</button>`);
  }
  let detail = "";
  if (sel) {
    const i = infoOn(sel), k = CAL_KIND(i, sel), items = upcoming(sel, 1);
    const line = k === "match" ? esc((i.event && i.event.name) || "대회") + (i.days > 1 ? ` · ${i.dayNo}/${i.days}일째` : "") : k === "try" ? "트라이아웃" : k === "off" ? `훈련 없음${i.teamOffNote ? " · " + esc(i.teamOffNote) : ""}` : "";
    detail = `<div class="cal-detail"><b>${longDate(parseD(sel))}</b>${line ? `<span class="small"><i class="dot k-${k}"></i>${line}</span>` : ""}
      ${items.length ? attendRows(items, me) : line ? "" : `<span class="small muted">일정 없음</span>`}</div>`;
  }
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1), ymOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `<div class="cal-head"><button class="btn link" type="button" data-act="calmonth" data-m="${ymOf(prev)}" aria-label="이전 달">‹</button><h3>${y}년 ${m}월</h3><button class="btn link" type="button" data-act="calmonth" data-m="${ymOf(next)}" aria-label="다음 달">›</button>${ym !== t.slice(0, 7) ? `<button class="btn link small" type="button" data-act="calmonth" data-m="${t.slice(0, 7)}">오늘</button>` : ""}</div>
    <div class="cal">${DOW_KO.map((w, k) => `<span class="cw ${k === 0 ? "sun" : k === 6 ? "sat" : ""}">${w}</span>`).join("")}${cells.join("")}</div>
    <div class="cal-legend">${["team", "open", "fr", "match"].map(k => `<span><i class="dot k-${k}"></i>${CAL_LABEL[k]}</span>`).join("")}${me ? `<span><i class="abs-l"></i>불참</span>` : ""}</div>${detail}`;
}
function viewComps() {
  const { t, sy, from, to } = seasonRange();
  const list = normEvents(events()).filter(e => e.end >= from && e.start <= to);
  const range = e => e.start === e.end ? shortDate(parseD(e.start)) : `${md(parseD(e.start))} – ${md(parseD(e.end))}`;
  const frs = Object.entries(state.friendlies).filter(([d]) => d >= dAdd(t, -30)).sort().flatMap(([d, fs]) => fs.map(f => [d, f]));
  return `<div class="cols">
    <div class="col"><section class="sec"><div class="sec-head"><h3>대회·일정 <span class="small muted">${sy}.3 – ${sy + 1}.2</span></h3>${can("schedule") ? addBtn("event", "일정") : ""}</div>
      ${list.length ? `<ul class="ev-list">${list.map(e => `<li class="${e.end < t ? "past" : ""}"><span class="num">${range(e)}</span><span class="ev-main"><b>${esc(e.name)}</b> <span class="chip ${e.kind === "major" ? "warn" : ""}">${esc(EVENT_KINDS[e.kind] || e.kind)}</span>${e.note ? `<span class="small muted">${esc(e.note)}</span>` : ""}${e.id && (e.kind === "major" || e.kind === "minor") && e.end >= t ? entryChip("event", e.id) + voteBox("event", e.id) : ""}</span>${can("schedule") && e.id ? `<button class="btn link danger small" type="button" data-act="delevent" data-id="${esc(e.id)}">삭제</button>` : ""}</li>`).join("")}</ul>` : emptyLine("등록된 일정이 없어요.")}
    </section></div>
    <div class="col"><section class="sec"><div class="sec-head"><h3>교류전</h3>${can("schedule") ? addBtn("friendly", "교류전") : ""}</div>
      ${frs.length ? `<ul class="ev-list">${frs.map(([d, f]) => `<li class="${d < t ? "past" : ""}"><span class="num">${md(parseD(d))} (${DOW_KO[parseD(d).getDay()]})</span><span class="ev-main"><b>${esc(frName(f.opponent))}</b> <span class="chip">${fmtKo(f)}</span><span class="small muted">${esc([f.start && f.start + (f.end ? "–" + f.end : ""), f.place, f.note].filter(Boolean).join(" · "))}</span>${d >= t ? entryChip("friendly", f.id) + voteBox("friendly", f.id) : ""}</span>${can("schedule") ? `<button class="btn link danger small" type="button" data-act="delfriendly" data-id="${esc(f.id)}">삭제</button>` : ""}</li>`).join("")}</ul>` : emptyLine("잡힌 교류전이 없어요.")}
    </section></div>
  </div>`;
}
function viewSched() {
  if (!can("attend")) return `<div class="panel empty"><strong>관리자 전용이에요</strong></div>`;
  const t = iso(today()), off = Object.entries(state.teamOff).filter(([d]) => d >= dAdd(t, -14)).sort();
  const days = Object.entries(state.ptimes).filter(([k]) => /^\d{4}/.test(k) && k >= dAdd(t, -14)).sort();
  return `<div class="cols">
    <div class="col">
    <section class="sec"><div class="sec-head"><h3>그날만 시간 바꾸기</h3>${addBtn("ptday", "추가")}</div>
      ${days.length ? `<ul class="watch">${days.map(([d, o]) => `<li><span class="num">${shortDate(parseD(d))}</span><span>${esc(timeTxt(o))}</span>${o.note ? `<span class="small muted">${esc(o.note)}</span>` : ""}<button class="btn link danger" type="button" data-act="ptdel" data-key="${esc(d)}">취소</button></li>`).join("")}</ul>` : emptyLine("바꾼 날이 없어요.")}
    </section></div>
    <div class="col"><section class="sec"><div class="sec-head"><h3>자율 훈련</h3>${addBtn("open", "자율 훈련")}</div>
      ${(() => { const l = Object.values(state.opens).flat().filter(o => o.date >= t).sort((a, b) => a.date.localeCompare(b.date)); return l.length ? `<ul class="watch">${l.map(o => `<li><span class="num">${shortDate(parseD(o.date))}</span><span>${esc(openLabel(o).replace(/^자율 훈련 · ?/, ""))}</span><span class="chip ok">참석 ${Object.values(o.votes).filter(Boolean).length}</span><button class="btn link danger" type="button" data-act="delopen" data-id="${esc(o.id)}">취소</button></li>`).join("")}</ul>` : emptyLine("없어요."); })()}
    </section>
    <section class="sec"><div class="sec-head"><h3>정규 훈련 없는 날</h3>${addBtn("off", "추가")}</div>
      ${off.length ? `<ul class="watch">${off.map(([d, o]) => `<li><span class="num">${shortDate(parseD(d))}</span>${o.note ? `<span class="small muted">${esc(o.note)}</span>` : ""}<button class="btn link danger" type="button" data-act="teamoff" data-date="${esc(d)}">취소</button></li>`).join("")}</ul>` : emptyLine("없는 날이 없어요.")}
      
    </section></div>
  </div>`;
}
// 추가 창 (아래에서 올라옴)
const FORMS = {
  event: ["일정 추가", `<form class="f" id="eventForm" data-close="1"><div class="fields">
      <label class="fl">이름<input id="ev-name" required maxlength="40" placeholder="예: KUSF 중부 예선"></label>
      <label class="fl">종류<select id="ev-kind">${Object.entries(EVENT_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <div class="pair"><label class="fl">시작<input type="date" id="ev-start" required></label><label class="fl">끝<input type="date" id="ev-end"></label></div>
      <label class="fl wide">메모<input id="ev-note" maxlength="100" placeholder="예: 본선 진출 시에만"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div></form>`],
  friendly: ["교류전 추가", `<form class="f" id="friendlyForm" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="fr-date" required></label>
      <label class="fl">상대<input id="fr-opp" required maxlength="60" placeholder="예: 연세대"></label>
      <label class="fl">방식<select id="fr-fmt"><option value="6">6인제</option><option value="9">9인제</option></select></label>
      <div class="pair"><label class="fl">시작<input type="time" id="fr-start"></label><label class="fl">끝<input type="time" id="fr-end"></label></div>
      <label class="fl">장소<input id="fr-place" maxlength="60" placeholder="예: 상대 학교 체육관"></label>
      <label class="fl wide">메모<input id="fr-note" maxlength="200"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div>
    </form>`],
  notice: ["공지 올리기", `<form class="f" id="noticeForm" data-close="1">
      <label class="fl">제목<input id="nt-title" required maxlength="80"></label>
      <label class="fl">내용<textarea id="nt-body" rows="5" maxlength="2000"></textarea></label>
      <div class="checks"><label class="check"><input type="checkbox" id="nt-pin"> 위에 고정</label><label class="check"><input type="checkbox" id="nt-push" checked> 휴대폰 알림 보내기</label></div>
      <div class="row"><button class="btn primary" type="submit">올리기</button></div>
      </form>`],
  ptday: ["그날만 시간 바꾸기", `<form class="f" id="ptDayForm" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="ptd-date" required></label>
      <div class="pair"><label class="fl">시작<input type="time" id="ptd-s" required></label><label class="fl">끝<input type="time" id="ptd-e"></label></div>
      <label class="fl">메모<input id="ptd-note" maxlength="60" placeholder="예: 체육관 사정"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div></form>`],
  open: ["자율 훈련", `<form class="f" id="openForm" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="op-date" required></label>
      <div class="pair"><label class="fl">시작<input type="time" id="op-s"></label><label class="fl">끝<input type="time" id="op-e"></label></div>
      <label class="fl">장소<input id="op-place" maxlength="60"></label>
      <label class="fl wide">메모<input id="op-note" maxlength="100"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div></form>`],
  off: ["정규 훈련 없는 날", `<form class="f" id="offForm" data-close="1"><div class="fields">
      <label class="fl">날짜<input type="date" id="off-date" required></label>
      <label class="fl">메모<input id="off-note" maxlength="60" placeholder="예: 체육관 통제"></label>
    </div><div class="row"><button class="btn primary" type="submit">추가</button></div></form>`],
};
function openForm(k) {
  const [title, html] = FORMS[k] || []; if (!title) return;
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${title}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>${html}`;
  el.hidden = false; document.body.classList.add("noscroll");
  const first = el.querySelector("input"); if (first && matchMedia("(min-width: 760px)").matches) first.focus();
}

/* ---------- 훈련·교류전 참석 (불참은 본인·관리자만) ---------- */
function teamDays(from, n) { const out = []; for (let k = 0; k < n; k++) { const d = dAdd(from, k), i = infoOn(d); if (isTeamDay(i)) out.push({ date: d, i }); } return out; }
// 정규 훈련·교류전 + 자율 훈련, 날짜순
const opensOn = d => state.opens[d] || [];
function upcoming(from, n) {
  const out = teamDays(from, n);
  for (let k = 0; k < n; k++) { const d = dAdd(from, k); for (const o of opensOn(d)) out.push({ date: d, open: o }); }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.open ? 1 : 0) - (b.open ? 1 : 0));
}
const fmtKo = f => f.format === "9" ? "9인제" : "6인제";
const frTime = f => f.start ? `${f.start}${f.end ? "–" + f.end : ""}` : "";
const tdLabel = i => i.slot === "friendly" ? [frName(i.friendly.opponent), frTime(i.friendly)].filter(Boolean).join(" · ") : `정규 훈련 · ${i.teamTime || "18:00–21:00"}`;
const openLabel = o => ["자율 훈련", o.start ? `${o.start}${o.end ? "–" + o.end : ""}` : "", o.place].filter(Boolean).join(" · ");
function attendRows(list, me) {
  const t = iso(today());
  return `<ul class="attend">${list.map(({ date, i, open }) => {
    const when = `<div class="at-when"><b>${longDate(parseD(date))}</b><span class="small muted">${esc(open ? openLabel(open) : tdLabel(i))}</span>${!open && state.practice[date] ? `<button type="button" class="btn link small pr-link" data-act="prgo" data-d="${date}">훈련 계획</button>` : ""}</div>`;
    if (open) {
      const going = sortedPlayers().filter(p => open.votes[p.id] === true), mine = me ? open.votes[me.id] : undefined;
      const btns = me && date >= t ? `<span class="vote"><button type="button" class="btn small ${mine === true ? "on" : ""}" aria-pressed="${mine === true}" data-act="vote" data-id="${esc(open.id)}" data-go="1">참석</button><button type="button" class="btn small ${mine === false ? "on" : ""}" aria-pressed="${mine === false}" data-act="vote" data-id="${esc(open.id)}" data-go="0">불참</button></span>` : "";
      return `<li class="open">${when}<div class="at-side"><span class="chip ok">참석 ${going.length}</span>${btns}</div>${going.length ? `<p class="at-names small muted">${going.map(p => esc(p.name)).join(" · ")}</p>` : ""}</li>`;
    }
    if (can("attend")) {
      const abs = sortedPlayers().map(p => [p, absOf(p.id, date)]).filter(([, a]) => a);
      return `<li>${when}<div class="at-side">${abs.length ? `<span class="chip warn">불참 ${abs.length}</span>` : ""}</div>
        ${abs.length ? `<ul class="at-list">${abs.map(([p, a]) => `<li><b>${esc(p.name)}</b> <span class="small">${esc(ABS_REASONS[a.reason] || a.reason)}${a.note ? ` · ${esc(a.note)}` : ""}</span></li>`).join("")}</ul>` : ""}</li>`;
    }
    if (!me) return `<li>${when}</li>`;
    const a = absOf(me.id, date);
    return `<li>${when}<div class="at-side">${a ? `<span class="chip warn">불참</span><button class="btn link small" type="button" data-act="absopen" data-date="${date}">수정</button><button class="btn link small" type="button" data-act="absdel" data-date="${date}">취소</button>`
      : date >= t ? `<button class="btn small" type="button" data-act="absopen" data-date="${date}">불참</button>` : ""}</div></li>`;
  }).join("")}</ul>`;
}
/* ---------- 공지 ---------- */
const sortedNotices = () => [...state.notices].sort((a, b) => (b.pinned - a.pinned) || String(b.created).localeCompare(String(a.created)));
const SEEN_KEY = () => "snuvt-notice-seen-" + uid();
// 공지는 홈 맨 위: 고정 + 최근 2주, 나머지는 '지난 공지'로 접어 둠. 관리자는 여기서 올리고 고정·삭제
function noticesHtml() {
  const list = sortedNotices(), t = Date.now(), seen = lsGet(SEEN_KEY()) || "";
  const recent = list.filter(n => n.pinned || t - new Date(n.created).getTime() < 14 * 864e5), old = list.filter(n => !recent.includes(n));
  if (list.length) setTimeout(() => lsSet(SEEN_KEY(), list.map(n => String(n.created)).sort().at(-1)), 0);
  if (!list.length && !can("notice")) return "";
  const card = n => `<article class="notice ${n.pinned ? "pinned" : ""} ${String(n.created) > seen ? "new" : ""}">
      <div class="nt-head"><b>${n.pinned ? `<span class="chip">고정</span> ` : String(n.created) > seen ? `<span class="chip new">NEW</span> ` : ""}${esc(n.title)}</b><span class="small muted">${md(new Date(n.created))}</span></div>
      ${n.body ? `<p class="nbody">${esc(n.body)}</p>` : ""}
      ${can("notice") ? `<div class="row"><button class="btn link small" type="button" data-act="ntpin" data-id="${esc(n.id)}" data-p="${n.pinned ? "0" : "1"}">${n.pinned ? "고정 풀기" : "고정"}</button><button class="btn link small danger" type="button" data-act="ntdel" data-id="${esc(n.id)}">삭제</button></div>` : ""}
    </article>`;
  return `<section class="panel notices"><div class="row between"><h3>공지</h3>${can("notice") ? `<button class="btn add" type="button" data-act="addform" data-f="notice">+ 공지</button>` : ""}</div>
    ${recent.length ? recent.map(card).join("") : `<p class="small muted">${list.length ? "최근 공지가 없어요" : "아직 공지가 없어요"}</p>`}
    ${old.length ? `<details data-keep="old-notices" ${keepOpen("old-notices", false)}><summary class="small muted">지난 공지 ${old.length}</summary>${old.map(card).join("")}</details>` : ""}
  </section>`;
}
/* ---------- 전력분석: 경기 영상을 보면서 플레이를 입력 → 선수별·상대 서브 분석 ----------
 * 등급(DataVolley 방식): # 최고(득점·완벽) · + 좋음 · ! 보통 · - 나쁨 · / 막힘 · = 범실(실패) */
const SC_SKILLS = [["serve", "서브"], ["receive", "리시브"], ["attack", "공격"], ["block", "블로킹"], ["dig", "디그"], ["set", "토스"]];
const SC_GRADES = {
  serve: [["#", "에이스"], ["+", "좋음"], ["!", "보통"], ["-", "쉬운 공"], ["=", "범실"]],
  receive: [["#", "완벽"], ["+", "좋음"], ["!", "보통"], ["-", "나쁨"], ["=", "실패"]],
  attack: [["#", "득점"], ["+", "좋음"], ["!", "이어짐"], ["/", "막힘"], ["=", "범실"]],
  block: [["#", "득점"], ["+", "터치"], ["!", "보통"], ["-", "나쁨"], ["=", "범실"]],
  dig: [["#", "완벽"], ["+", "좋음"], ["!", "보통"], ["-", "나쁨"], ["=", "실패"]],
  set: [["#", "완벽"], ["+", "좋음"], ["!", "보통"], ["-", "나쁨"], ["=", "범실"]],
};
const SC_KINDS = { serve: ["무회전", "점프", "점프 플로터", "언더"], attack: ["오픈", "속공", "시간차", "백어택", "페인트"] };
const SC_LEN = [["short", "짧게"], ["long", "길게"]];
const ZONES = [4, 3, 2, 5, 6, 1]; // 코트 위에서 본 배치 (네트 쪽 4·3·2, 뒤 5·6·1)
const sc = () => state.scout || (state.scout = { loaded: false, matches: [], events: {}, sel: { set: 1, side: "us", pid: null, opp: "", skill: "serve", kind: null, len: null, zone: null }, tab: "input", fset: 0 });
const scMatch = () => sc().matches.find(m => m.id === state.scoutId) || null;
async function scoutLoad() {
  const S = sc();
  try { const r = await sb.from("scout_matches").select("*").order("date", { ascending: false }); if (!r.error) S.matches = r.data || []; } catch (e) { /* 연결 없음 */ }
  S.loaded = true; if (state.view === "scout") render();
}
async function scoutEvents(mid) {
  const S = sc();
  try { const r = await sb.from("scout_events").select("*").eq("match_id", mid).order("created_at"); if (!r.error) S.events[mid] = r.data || []; } catch (e) { S.events[mid] = S.events[mid] || []; }
  if (state.view === "scout" && state.scoutId === mid) render();
}
const pNo = p => p.number != null ? `${p.number} ` : "";
function viewScout() {
  const S = sc();
  if (!S.loaded) { scoutLoad(); return loaderHtml(); }
  const m = scMatch();
  if (!m) {
    return `<section class="sec"><div class="sec-head"><h2>전력분석</h2>${can("analysis") ? `<button class="btn add" type="button" data-act="scnew">+ 경기</button>` : ""}</div>
      ${S.matches.length ? `<div class="sc-list">${S.matches.map(x => `<button type="button" class="panel sc-card" data-act="scopen" data-id="${esc(x.id)}"><b>${esc(x.title)}</b><span class="small muted">${[x.date ? shortDate(parseD(x.date)) : "", x.opponent ? "상대 " + x.opponent : ""].filter(Boolean).map(esc).join(" · ")}</span><span class="go">›</span></button>`).join("")}</div>`
        : emptyLine(can("analysis") ? "경기 영상을 추가하면 다 같이 보면서 입력할 수 있어요." : "아직 분석할 경기가 없어요.")}</section>`;
  }
  const ev = S.events[m.id];
  if (!ev) { scoutEvents(m.id); }
  const tabs = `<div class="seg fill sc-tabs" role="tablist">${[["input", "입력"], ["stats", "분석"]].map(([k, l]) => `<button type="button" class="seg-tab ${S.tab === k ? "on solid" : ""}" role="tab" aria-selected="${S.tab === k}" data-act="sctab" data-k="${k}">${l}</button>`).join("")}</div>`;
  return `<section class="sec sc-page"><div class="sc-top"><button class="btn link small" type="button" data-act="scback">‹ 목록</button>
      ${can("analysis") ? `<span class="row nowrap"><button class="btn link small" type="button" data-act="scedit" data-id="${esc(m.id)}">수정</button><button class="btn link small danger" type="button" data-act="scdel" data-id="${esc(m.id)}">삭제</button></span>` : ""}</div>
    <div class="sc-title"><b>${esc(m.title)}</b><span class="small muted">${[m.date ? shortDate(parseD(m.date)) : "", m.opponent ? "상대 " + m.opponent : ""].filter(Boolean).map(esc).join(" · ")}</span></div>
    ${m.yt ? "" : `<p class="small muted">영상 링크가 없어요. 경기 수정에서 유튜브 링크를 넣으면 같이 볼 수 있어요.</p>`}
    ${tabs}
    ${!ev ? loaderHtml(true) : S.tab === "stats" ? scoutStats(m, ev) : scoutPad(m, ev)}</section>`;
}
function scoutPad(m, ev) {
  const S = sc(), x = S.sel, ps = sortedPlayers().filter(p => !p.military).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  const chip = (act, v, cur, l, extra = "") => `<button type="button" class="chip sc-chip ${String(v) === String(cur) ? "on" : ""}" data-act="${act}" data-v="${esc(v)}" ${extra}>${l}</button>`;
  const who = x.side === "us"
    ? `<div class="sc-row">${ps.map(p => chip("scpid", p.id, x.pid, `${pNo(p)}${esc(p.name)}`)).join("")}</div>`
    : `<div class="sc-row"><label class="fl sc-opp">상대 등번호<input id="scOpp" type="number" inputmode="numeric" min="0" max="99" value="${esc(x.opp)}" placeholder="번호"></label>${[...new Set(ev.filter(e => e.side === "opp" && e.opp_no != null).map(e => e.opp_no))].slice(-8).map(n => chip("scoppno", n, x.opp, "#" + n)).join("")}</div>`;
  const kinds = SC_KINDS[x.skill];
  const detail = `${kinds ? `<div class="sc-row"><span class="sc-k">종류</span>${kinds.map(k => chip("sckind", k, x.kind, k)).join("")}</div>` : ""}
    ${x.skill === "serve" ? `<div class="sc-row"><span class="sc-k">길이</span>${SC_LEN.map(([v, l]) => chip("sclen", v, x.len, l)).join("")}</div>` : ""}
    ${["serve", "attack", "receive", "dig"].includes(x.skill) ? `<div class="sc-row"><span class="sc-k">${x.skill === "serve" || x.skill === "attack" ? "코스" : "위치"}</span><div class="sc-court">${ZONES.map(z => `<button type="button" class="sc-z ${x.zone === z ? "on" : ""}" data-act="sczone" data-v="${z}">${z}</button>`).join("")}</div></div>` : ""}`;
  const mine = ev.slice(-8).reverse();
  const lbl = e => { const p = e.side === "us" ? playerOf(e.player_id) : null; const g = (SC_GRADES[e.skill] || []).find(y => y[0] === e.grade); return `${e.side === "us" ? (p ? `${pNo(p)}${esc(p.name)}` : "우리") : `상대 #${e.opp_no ?? "?"}`} · ${(SC_SKILLS.find(y => y[0] === e.skill) || ["", ""])[1]}${e.kind ? " " + esc(e.kind) : ""}${e.len ? " " + (e.len === "long" ? "길게" : "짧게") : ""}${e.zone ? " → " + e.zone : ""} · <b>${g ? g[1] : e.grade}</b>`; };
  return `<div class="panel sc-pad">
    <div class="sc-row"><span class="sc-k">세트</span>${[1, 2, 3, 4, 5].map(n => chip("scset", n, x.set, n)).join("")}</div>
    <div class="seg fill sc-side">${[["us", "우리"], ["opp", "상대"]].map(([v, l]) => `<button type="button" class="seg-tab ${x.side === v ? "on solid" : ""}" data-act="scside" data-v="${v}">${l}</button>`).join("")}</div>
    ${who}
    <div class="sc-row sc-skills">${SC_SKILLS.map(([v, l]) => chip("scskill", v, x.skill, l)).join("")}</div>
    ${detail}
    <div class="sc-grades">${SC_GRADES[x.skill].map(([g, l]) => `<button type="button" class="btn sc-g g-${g === "#" ? "best" : g === "+" ? "good" : g === "!" ? "ok" : g === "-" ? "bad" : g === "/" ? "blk" : "err"}" data-act="scsave" data-g="${g}">${l}</button>`).join("")}</div>
  </div>
  <section class="sec"><div class="sec-head"><h3>방금 입력 <span class="small muted">${ev.length}개</span></h3></div>
    ${mine.length ? `<ul class="watch sc-recent">${mine.map(e => `<li>${e.t != null ? `<button type="button" class="btn link small num" data-act="scseek" data-t="${e.t}">${Math.floor(e.t / 60)}:${String(Math.floor(e.t % 60)).padStart(2, "0")}</button>` : ""}<span class="small">${e.set_no}세트 · ${lbl(e)}</span>${e.author === uid() || can("analysis") ? `<button type="button" class="btn link small danger" data-act="scundo" data-id="${esc(e.id)}">지우기</button>` : ""}</li>`).join("")}</ul>` : emptyLine("결과 버튼을 누르면 한 플레이가 저장돼요.")}
  </section>`;
}
function scoutStats(m, ev) {
  const S = sc(), all = S.fset ? ev.filter(e => e.set_no === S.fset) : ev;
  const us = all.filter(e => e.side === "us"), opp = all.filter(e => e.side === "opp");
  const cnt = (l, sk, g) => l.filter(e => e.skill === sk && (!g || g.includes(e.grade))).length;
  const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
  const ps = sortedPlayers().filter(p => us.some(e => e.player_id === p.id));
  const rowOf = p => { const l = us.filter(e => e.player_id === p.id);
    const sv = cnt(l, "serve"), sa = cnt(l, "serve", "#"), se = cnt(l, "serve", "=");
    const rc = cnt(l, "receive"), rg = cnt(l, "receive", "#+"), re = cnt(l, "receive", "=");
    const at = cnt(l, "attack"), ak = cnt(l, "attack", "#"), ae = cnt(l, "attack", "=/");
    return `<tr><td><b>${pNo(p)}${esc(p.name)}</b></td><td class="num">${sv ? `${sv} · ${sa}/${se}` : "—"}</td><td class="num">${rc ? `${rc} · ${pct(rg, rc)}` : "—"}</td><td class="num">${at ? `${at} · ${pct(ak, at)}` : "—"}</td><td class="num">${at ? pct(ak - ae, at) : "—"}</td><td class="num">${cnt(l, "block", "#") || "—"}</td><td class="num">${cnt(l, "dig") ? pct(cnt(l, "dig", "#+!"), cnt(l, "dig")) : "—"}</td></tr>`; };
  // 상대 서브: 종류 × 길이별 시도 · 에이스 · 범실 · 우리를 흔든 비율(# +)
  const groups = {};
  for (const e of opp.filter(e => e.skill === "serve")) { const k = `${e.kind || "종류 없음"}${e.len ? " · " + (e.len === "long" ? "길게" : "짧게") : ""}`; (groups[k] = groups[k] || []).push(e); }
  const zoneMap = l => { const c = {}; for (const e of l) if (e.zone) c[e.zone] = (c[e.zone] || 0) + 1; const mx = Math.max(1, ...Object.values(c)); return `<div class="sc-court heat">${ZONES.map(z => `<span class="sc-z" style="--a:${((c[z] || 0) / mx).toFixed(2)}">${c[z] || ""}</span>`).join("")}</div>`; };
  return `<div class="sc-row"><span class="sc-k">세트</span>${[0, 1, 2, 3, 4, 5].map(n => `<button type="button" class="chip sc-chip ${S.fset === n ? "on" : ""}" data-act="scfset" data-v="${n}">${n ? n : "전체"}</button>`).join("")}</div>
    <section class="sec"><h3>우리 선수</h3>${ps.length ? `<div class="tw"><table><thead><tr><th>선수</th><th>서브</th><th>리시브</th><th>공격</th><th>효율</th><th>블록</th><th>디그</th></tr></thead><tbody>${ps.map(rowOf).join("")}</tbody></table></div><p class="small muted">서브 시도·에이스/범실 · 리시브 시도·좋음% · 공격 시도·득점% · 효율 (득점−범실−막힘)/시도 · 디그 성공%</p>` : emptyLine("아직 우리 팀 입력이 없어요.")}</section>
    <section class="sec"><h3>상대 서브</h3>${Object.keys(groups).length ? `<div class="tw"><table><thead><tr><th>종류 · 길이</th><th>시도</th><th>에이스</th><th>범실</th><th>흔듦</th></tr></thead><tbody>${Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `<tr><td>${esc(k)}</td><td class="num">${l.length}</td><td class="num">${l.filter(e => e.grade === "#").length}</td><td class="num">${l.filter(e => e.grade === "=").length}</td><td class="num">${pct(l.filter(e => "#+".includes(e.grade)).length, l.length)}</td></tr>`).join("")}</tbody></table></div>` : emptyLine("상대 서브 입력이 없어요.")}</section>
    <div class="cols"><div class="col"><section class="sec"><h3>상대 공격 코스</h3>${zoneMap(opp.filter(e => e.skill === "attack"))}</section></div>
      <div class="col"><section class="sec"><h3>상대 서브 코스</h3>${zoneMap(opp.filter(e => e.skill === "serve"))}</section></div></div>`;
}
// 경기 영상: #main 밖(위)의 고정 칸에 둬서 버튼을 눌러 화면을 다시 그려도 끊기지 않음
let scPlayer = null;
async function scoutDock() {
  const dock = document.getElementById("dock"); if (!dock) return;
  const m = state.view === "scout" ? scMatch() : null, y = m && m.yt ? parseYt(m.yt) : null;
  if (!y) { if (dock.dataset.mid) { dock.innerHTML = ""; dock.dataset.mid = ""; scPlayer = null; } dock.hidden = true; return; }
  dock.hidden = false;
  const hd = document.querySelector("header.top"); dock.style.top = (hd ? hd.offsetHeight : 0) + "px";
  if (dock.dataset.mid === m.id) return;
  dock.dataset.mid = m.id; scPlayer = null;
  dock.innerHTML = `<div class="vid-frame"><div id="scYt"></div></div>`;
  const YT = await loadYtApi();
  if (!YT || dock.dataset.mid !== m.id) { if (!YT) dock.innerHTML = `<div class="vid-frame"><iframe src="${ytEmbed(y)}" title="경기 영상" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`; return; }
  new YT.Player("scYt", { host: "https://www.youtube-nocookie.com", width: "100%", height: "100%", ...(y.kind === "playlist" ? { playerVars: { listType: "playlist", list: y.yt, playsinline: 1, rel: 0 } } : { videoId: y.yt, playerVars: { playsinline: 1, rel: 0 } }),
    events: { onReady: e => { if (dock.dataset.mid === m.id) scPlayer = e.target; } } });
}
async function scoutSave(g) {
  const S = sc(), x = S.sel, m = scMatch(); if (!m) return;
  if (x.side === "us" && !x.pid) { toast("선수를 골라 주세요"); return; }
  const opp = x.side === "opp" ? (document.getElementById("scOpp") ? document.getElementById("scOpp").value : x.opp) : "";
  if (x.side === "opp") x.opp = opp;
  let t = null; try { if (scPlayer && scPlayer.getCurrentTime) t = Math.round(scPlayer.getCurrentTime() * 10) / 10; } catch (e) {}
  const row = { match_id: m.id, set_no: x.set, side: x.side, player_id: x.side === "us" ? x.pid : null, opp_no: x.side === "opp" && opp !== "" ? Number(opp) : null, skill: x.skill,
    kind: SC_KINDS[x.skill] ? x.kind : null, len: x.skill === "serve" ? x.len : null, zone: ["serve", "attack", "receive", "dig"].includes(x.skill) ? x.zone : null, grade: g, t, author: uid() };
  const r = await sb.from("scout_events").insert(row).select().maybeSingle();
  if (r.error) { toast(failMsg(r.error)); return; }
  (S.events[m.id] = S.events[m.id] || []).push({ ...row, id: (r.data && r.data.id) || "tmp" + Date.now(), created_at: (r.data && r.data.created_at) || new Date().toISOString() });
  x.kind = null; x.len = null; x.zone = null;
  state.dirty = false; render();
}
function openScoutForm(id) {
  const m = sc().matches.find(x => x.id === id) || {}, el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${id ? "경기 수정" : "경기 추가"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="scForm" data-id="${esc(id || "")}"><div class="fields">
      <label class="fl wide">제목<input id="scf-title" required maxlength="80" value="${esc(m.title || "")}" placeholder="예: 서울대배 8강 vs 고려대"></label>
      <label class="fl">날짜<input type="date" id="scf-date" value="${esc(m.date || "")}"></label>
      <label class="fl">상대<input id="scf-opp" maxlength="60" value="${esc(m.opponent || "")}"></label>
      <label class="fl wide">유튜브 링크<input id="scf-yt" maxlength="200" value="${esc(m.yt || "")}" placeholder="https://youtu.be/..."></label>
      <label class="fl wide">메모<input id="scf-note" maxlength="300" value="${esc(m.note || "")}"></label>
    </div><div class="row"><button class="btn primary" type="submit">${id ? "저장" : "추가"}</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
/* ---------- 대회·교류전 참가 투표 (불참은 사유) ---------- */
const evVotesOf = (kind, id) => (state.evVotes || {})[kind + ":" + id] || {};
function voteItems() {
  const t = iso(today()), out = [];
  for (const e of normEvents(events())) if (e.id && (e.kind === "major" || e.kind === "minor") && e.end >= t) out.push({ kind: "event", id: e.id, name: e.name, when: e.start === e.end ? shortDate(parseD(e.start)) : `${md(parseD(e.start))}–${md(parseD(e.end))}`, d: e.start });
  for (const [d, fs] of Object.entries(state.friendlies)) if (d >= t) for (const f of fs) out.push({ kind: "friendly", id: f.id, name: frName(f.opponent), when: shortDate(parseD(d)) + (f.start ? " " + f.start : ""), d });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
function voteBox(kind, id) {
  const vs = evVotesOf(kind, id), ps = sortedPlayers().filter(p => !p.military), mine = state.myPid ? vs[state.myPid] : null;
  const yes = ps.filter(p => vs[p.id] && vs[p.id].going), no = ps.filter(p => vs[p.id] && !vs[p.id].going);
  const btns = state.myPid ? `<span class="vote"><button type="button" class="btn small ${mine && mine.going ? "on" : ""}" aria-pressed="${!!(mine && mine.going)}" data-act="evgo" data-kind="${kind}" data-id="${esc(id)}" data-go="1">참가</button><button type="button" class="btn small ${mine && !mine.going ? "on" : ""}" aria-pressed="${!!(mine && !mine.going)}" data-act="evno" data-kind="${kind}" data-id="${esc(id)}" data-go="0">불참</button></span>` : "";
  const sum = `<span class="small muted">참가 ${yes.length} · 불참 ${no.length} · 미응답 ${ps.length - yes.length - no.length}</span>`;
  const detail = can("schedule") && (yes.length || no.length) ? `<details class="ev-who"><summary class="small">명단 보기</summary>
    ${yes.length ? `<p class="small"><b>참가</b> ${yes.map(p => esc(p.name)).join(" · ")}</p>` : ""}
    ${no.length ? `<ul class="at-list">${no.map(p => `<li><b>${esc(p.name)}</b> <span class="small">${esc(ABS_REASONS[vs[p.id].reason] || "")}${vs[p.id].note ? ` · ${esc(vs[p.id].note)}` : ""}</span></li>`).join("")}</ul>` : ""}
    ${ps.length - yes.length - no.length ? `<p class="small muted">미응답 ${ps.filter(p => !vs[p.id]).map(p => esc(p.name)).join(" · ")}</p>` : ""}</details>` : "";
  return `<div class="ev-vote">${btns}${sum}${detail}</div>`;
}
// 관리자: 승인 대기는 홈 맨 위에 작게
function pendingHtml() {
  if (!can("full")) return "";
  const n = state.profiles.filter(m => m.role === "pending" && m.id !== state.session.user.id).length;
  return n ? `<button type="button" class="pending-pill" data-act="view" data-v="intake"><span class="chip warn">승인 대기 ${n}</span><span class="small">부원에서 승인하기 ›</span></button>` : "";
}
// 주장·훈련 담당: 오늘 훈련 불참자 (정규 훈련·교류전·자율 훈련)
function todayAbsHtml() {
  if (!can("attend")) return "";
  const t = iso(today()), i = infoOn(t), opens = opensOn(t);
  if (!isTeamDay(i) && !opens.length) return "";
  const ps = sortedPlayers().filter(p => !p.military);
  const rows = [];
  if (isTeamDay(i)) {
    const abs = ps.map(p => [p, absOf(p.id, t)]).filter(([, a]) => a);
    rows.push(`<div class="ta-h"><b>${esc(tdLabel(i))}</b><span class="chip ${abs.length ? "warn" : "ok"}">불참 ${abs.length}</span></div>${abs.length ? `<ul class="at-list">${abs.map(([p, a]) => `<li><b>${esc(p.name)}</b> <span class="small">${esc(ABS_REASONS[a.reason] || "")}${a.note ? ` · ${esc(a.note)}` : ""}</span></li>`).join("")}</ul>` : ""}`);
  }
  for (const o of opens) {
    const go = ps.filter(p => o.votes[p.id] === true), no = ps.filter(p => o.votes[p.id] === false);
    rows.push(`<div class="ta-h"><b>${esc(openLabel(o))}</b><span class="chip ok">참석 ${go.length}</span>${no.length ? `<span class="chip warn">불참 ${no.length}</span>` : ""}</div>${go.length ? `<p class="small">${go.map(p => esc(p.name)).join(" · ")}</p>` : ""}`);
  }
  return `<section class="panel today-abs"><h3>오늘 훈련 출석</h3>${rows.join("")}</section>`;
}
// 홈 맨 위: 아직 답하지 않은 대회·교류전 (공지처럼)
function voteCardsHtml() {
  if (!state.myPid || !playerOf(state.myPid) || playerOf(state.myPid).military) return "";
  const todo = voteItems().filter(x => !evVotesOf(x.kind, x.id)[state.myPid]);
  if (!todo.length) return "";
  return `<section class="panel vote-cards"><h3>참가 투표</h3>${todo.map(x => `<div class="vc-row"><div class="vc-t"><b>${esc(x.name)}</b><span class="small muted">${esc(x.when)}</span></div>
    <span class="vote"><button type="button" class="btn small" data-act="evgo" data-kind="${x.kind}" data-id="${esc(x.id)}">참가</button><button type="button" class="btn small" data-act="evno" data-kind="${x.kind}" data-id="${esc(x.id)}">불참</button></span></div>`).join("")}</section>`;
}
function openEvAbsent(kind, id) {
  const it = voteItems().find(x => x.kind === kind && x.id === id) || {}, a = evVotesOf(kind, id)[state.myPid], el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>불참</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <p class="small">${esc(it.name || "")} · ${esc(it.when || "")}</p>
    <form class="f" id="evAbsForm" data-kind="${kind}" data-id="${esc(id)}">
      <div class="reasons" role="radiogroup" aria-label="사유">${Object.entries(ABS_REASONS).map(([k, l], n) => `<label class="rsn"><input type="radio" name="eva-r" value="${k}" ${(a && !a.going ? a.reason === k : n === 0) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <label class="fl">메모 (선택)<input id="eva-note" maxlength="100" value="${esc(a && !a.going ? a.note : "")}"></label>
      <div class="row"><button class="btn primary" type="submit">불참 내기</button></div>
    </form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
/* ---------- 엔트리 (대회·교류전 명단) ---------- */
const entryOf = (kind, id) => state.entries[kind + ":" + id] || new Set();
const entryChip = (kind, id) => { const n = entryOf(kind, id).size, mine = state.myPid && entryOf(kind, id).has(state.myPid); return (n || can("schedule")) ? `<button type="button" class="chip entry ${mine ? "me" : ""}" data-act="entry" data-kind="${kind}" data-id="${esc(id)}">엔트리 ${n}${mine ? " · 나" : ""}</button>` : ""; };
function openEntry(kind, id) {
  let title = "", date = "";
  if (kind === "event") { const e = (state.events || []).find(x => x.id === id); if (e) { title = e.name; date = e.start; } }
  else for (const [d, fs] of Object.entries(state.friendlies)) { const f = fs.find(x => x.id === id); if (f) { title = `${frName(f.opponent)} · ${fmtKo(f)}`; date = d; } }
  const set = entryOf(kind, id), ps = sortedPlayers(), el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>엔트리</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <p class="small">${esc(title)}${date ? ` · ${longDate(parseD(date))}` : ""}</p>
    ${can("schedule") ? `<form class="f" id="entryForm" data-kind="${kind}" data-id="${esc(id)}"><div class="checks entry-list">${ps.map(p => `<label class="check"><input type="checkbox" value="${esc(p.id)}" ${set.has(p.id) ? "checked" : ""}> ${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span>${absOf(p.id, date) ? ` <span class="chip warn">불참</span>` : ""}</label>`).join("")}</div>
      <div class="row"><button class="btn primary" type="submit">저장</button><span class="small muted" id="en-n">${set.size}명</span></div></form>`
    : set.size ? `<ul class="entry-names">${ps.filter(p => set.has(p.id)).map(p => `<li class="${p.id === state.myPid ? "me" : ""}">${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></li>`).join("")}</ul>` : emptyLine("아직 엔트리가 없어요.")}`;
  el.hidden = false; document.body.classList.add("noscroll");
}
function openAbsent(date) {
  const i = infoOn(date), a = absOf(state.myPid, date), el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>불참</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <p class="small">${longDate(parseD(date))} · ${esc(tdLabel(i))}</p>
    <form class="f" id="absForm" data-date="${esc(date)}">
      <div class="reasons" role="radiogroup" aria-label="사유">${Object.entries(ABS_REASONS).map(([k, l], n) => `<label class="rsn"><input type="radio" name="abs-r" value="${k}" ${(a ? a.reason === k : n === 0) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <label class="fl">메모 (선택)<input id="abs-note" maxlength="100" value="${esc(a ? a.note : "")}"></label>
      <p class="small muted">관리자만 봐요</p>
      <div class="row"><button class="btn primary" type="submit">${a ? "저장" : "불참 내기"}</button></div>
    </form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
// 교류전 (관리자가 추가 · 모두 봄)
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
    ${!kg ? `<p class="small muted">2–3회 더 할 수 있는 무게</p>` : ""}
    <p class="small muted" id="ls-done">${todays.length ? `${dayWord(ctx.date)} ${todays.map(l => `${l.kg}×${l.reps}`).join(", ")}` : ""}${last ? `${todays.length ? " · " : ""}지난번 ${last.kg}kg × ${last.reps}` : ""}</p>
  </form>`;
}
// 핸드스탠드 단계: 측정 대신 운동 창에서 본인이 올림 (프로그램이 그 단계로 나옴)
function hsStageHtml(name) {
  const c = state.planCtx;
  if (!c || !/핸드스탠드|휠배로|파이크 홀드/.test(name) || /대신/.test(name)) return "";
  const cur = (latest(c.pid) || {}).hsStage || 1;
  return `<form class="f hs-form" id="hsForm" data-pid="${esc(c.pid)}"><div class="row"><label class="fl">내 핸드스탠드 단계<select id="hs-st">${HS_STAGES.slice(1).map((l, i) => `<option value="${i + 1}" ${i + 1 === cur ? "selected" : ""}>${i + 1}단계 · ${esc(l)}</option>`).join("")}</select></label><button class="btn" type="submit">바꾸기</button></div>
    <p class="small muted">3세트 깔끔하면 다음 단계</p></form>`;
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
    ${setLogHtml(name, rx)}${hsStageHtml(name)}
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
  const pct = total ? did / total : 0, comp = pct >= 0.9 ? "all" : pct >= 0.65 ? "most" : pct >= 0.4 ? "part" : pct >= 0.15 ? "little" : "none";
  const mins = Math.max(1, Math.min(400, Math.round((Date.now() - r.start) / 60000)));
  return `<div class="row between"><h3>${esc(r.title)} 끝</h3><button class="btn link" type="button" data-act="runclose">닫기</button></div>
    <p class="small muted">${did}/${total}세트 · ${mins}분</p>
    <form class="f" id="runForm"><div class="fields">
      <label class="fl">힘든 정도 (RPE)<select id="rn-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 6 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">완료율${doneSelect("rn-done", comp)}</label>
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
function setView(k) {
  if (!viewOptions().includes(k)) return;
  state.viewAs = k; state.admin = k !== "player"; state.pid = null; state.editPid = null; state.dirty = false; state.boxEdit = false; state.prEdit = false;
  try { localStorage.setItem("snuvt-mode", k); } catch (e) {}
  // 지금 화면을 그 직책이 못 보면 홈으로
  const sec = SECTIONS[SECTION_OF[state.view]], ok = !sec || secViews(sec).some(v => v[0] === state.view);
  if (!ok) state.view = "home";
  closeDrawer(); closeSheet(); render(); window.scrollTo(0, 0);
  toast(`${VIEW_LABEL(k)} 화면`);
}
// 저장된 보기 → 지금 가능한 것 중에서 (예전 값 admin/player 도 읽음)
function pickView() {
  const o = viewOptions(), saved = savedMode();
  if (saved && o.includes(saved)) return saved;
  if (saved === "admin" && o.length > 1) return state.coach ? (state.title === "captain" ? "captain" : "admin") : o[0];
  if (saved === "player") return "player";
  return state.coach ? (state.title === "captain" ? "captain" : "admin") : "player";
}
function openRolePick() {
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>화면 보기</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <p class="small muted">${state.coach ? "각 직책이 보는 화면으로 바꿔서 확인해요. 데이터는 그대로예요." : "내 직책 화면과 선수 화면을 바꿔요."}</p>
    <div class="role-list">${viewOptions().map(k => `<button type="button" class="role-opt ${state.viewAs === k ? "on" : ""}" data-act="viewas" data-k="${k}"><b>${VIEW_LABEL(k)}</b></button>`).join("")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
const needsSelfReg = () => state.session && state.role === "player" && !state.myPid && state.loaded;
function render() {
  flowCache.clear();
  header();
  if (state.dirty) return; // 입력 중인 폼은 덮어쓰지 않음
  let html;
  if (state.booting) html = loaderHtml();
  else if (state.offline) html = offlineHtml();
  else if (!state.session) html = viewAuth();
  else if (state.recovery) html = viewNewPw();
  else if (!state.role || state.role === "pending") html = viewPending();
  else if (needsSelfReg() || (state.coach && state.editingSelf)) html = viewSelfReg();
  else {
    const v = state.view;
    html = v === "train" ? viewTrain() : v === "comps" ? viewComps() : v === "sched" ? viewSched() : v === "report" ? viewReport() : v === "practice" ? viewPractice() : v === "notes" ? viewNotes() : v === "video" ? viewVideo() : v === "scout" ? viewScout() : v === "roster" ? viewRoster() : v === "plan" ? viewPlan() : v === "rec" ? viewRec() : v === "season" ? viewSeason() : v === "intake" ? viewIntake() : viewHome();
  }
  const q = state.session ? queue().length : 0;
  const bar = state.loaded && (state.net === false || q) ? `<div class="netbar">${state.net === false ? "오프라인 · 마지막으로 불러온 내용" : "기록 올리는 중"}${q ? ` · 올라갈 기록 ${q}건` : ""}</div>` : "";
  document.getElementById("main").innerHTML = bar + html;
  refreshSettings();
  if (state.view === "video") initLatest();
  scoutDock();
}
// 화면 넘김: 새 화면만 짧게 서서히 나타남 (투명도만 바꿔서 휴대폰에서도 가볍게)
const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
// 불러오는 중: 가운데서 도는 배구공
const BALL_SVG = '<svg class="ball-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4M12 12a12.6 12.6 0 0 1-8.7 5M16.8 13.6a16.55 16.55 0 0 1-9 7.5M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5"/></svg>';
const loaderHtml = small => `<div class="loader ${small ? "sm" : ""}" role="status" aria-label="불러오는 중">${BALL_SVG}</div>`;
function go(view) {
  const from = state.view;
  state.view = view; state.dirty = false; state.armed = null;
  try { history.replaceState(null, "", "#" + view); } catch (e) {}
  render(); window.scrollTo(0, 0);
  if (from === view || reduceMotion()) return;
  const m = document.getElementById("main");
  try { m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }); } catch (e) { /* 지원 안 하면 그냥 바뀜 */ }
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
  if (act === "view") { ev.preventDefault(); closeDrawer(); return go(b.dataset.v); }
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
      const back = act === "unpick" || b.dataset.rec === "1"; // 권장를 누르면 고른 걸 지우고 흐름대로
      if (back) ok(await sb.from("day_picks").delete().eq("player_id", pid).eq("date", date));
      else ok(await sb.from("day_picks").upsert({ player_id: pid, date, pick: b.dataset.k }, { onConflict: "player_id,date" }));
      const m = state.picks[pid] = state.picks[pid] || {};
      if (back) delete m[date]; else m[date] = b.dataset.k;
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; render(); return refreshSettings();
  }
  if (act === "teamoff") {
    const date = b.dataset.date;
    try {
      if (state.teamOff[date]) { ok(await sb.from("team_off").delete().eq("date", date)); delete state.teamOff[date]; toast("정규 훈련 있음으로 돌렸어요"); }
      else { ok(await sb.from("team_off").insert({ date })); state.teamOff[date] = { note: "" }; toast("정규 훈련 없음으로 정했어요"); }
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
  if (act === "week") { state.week = b.dataset.m; state.day = null; state.dirty = false; return render(); }
  if (act === "day") { state.day = Number(b.dataset.d); state.dirty = false; return render(); }
  if (act === "openday") { state.week = b.dataset.m; state.day = Number(b.dataset.d); state.pid = state.myPid; return go("plan"); }
  if (act === "open") { state.pid = b.dataset.pid; state.week = null; state.day = null; return go("plan"); }
  if (act === "edit") { state.editPid = b.dataset.pid; state.dirty = false; state.armed = null; return render(); }
  if (act === "authmode") { state.authMode = b.dataset.m || (state.authMode === "login" ? "signup" : "login"); state.authMsg = ""; state.dirty = false; return render(); }
  if (act === "pwchange") { closeSettings(); state.recovery = true; state.dirty = false; return render(); }
  if (act === "cancelpw") { state.recovery = false; state.dirty = false; return render(); }
  if (act === "leave") {
    if (!await confirmDel("팀에서 탈퇴할까요?\n계정, 연락처·키·몸무게, 측정·운동 기록, 컨디션·통증, 훈련 노트가 모두 지워지고 되돌릴 수 없어요.")) return;
    const r = await sb.rpc("leave_team");
    if (r.error) { toast(r.error.code === "42501" ? r.error.message : failMsg(r.error)); return; }
    closeSettings(); lsDel(snapKey()); try { await sb.auth.signOut({ scope: "local" }); } catch (e) {} toast("탈퇴했어요. 그동안 고마웠어요"); return;
  }
  if (act === "vote") {
    const o = Object.values(state.opens).flat().find(x => x.id === b.dataset.id); if (!o || !state.myPid) return;
    const go = b.dataset.go === "1", cur = o.votes[state.myPid];
    try {
      if (cur === go) { ok(await sb.from("open_votes").delete().eq("session_id", o.id).eq("player_id", state.myPid)); delete o.votes[state.myPid]; }
      else { ok(await sb.from("open_votes").upsert({ session_id: o.id, player_id: state.myPid, going: go, updated_at: new Date().toISOString() }, { onConflict: "session_id,player_id" })); o.votes[state.myPid] = go; }
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render();
  }
  if (act === "delopen") {
    if (!await confirmDel("이 자율 훈련을 취소할까요?")) return;
    try { ok(await sb.from("open_sessions").delete().eq("id", b.dataset.id)); toast("취소했어요"); } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
  if (act === "calmonth") { state.calMonth = b.dataset.m; state.calDay = null; state.dirty = false; return render(); }
  if (act === "calday") { state.calDay = b.dataset.d; state.dirty = false; return render(); }
  if (act === "alumdel") {
    const x = (state.alumni || []).find(y => y.id === b.dataset.pid) || {};
    if (!await confirmDel(`${x.name || "이 졸업생"}의 남은 기록까지 모두 지울까요?\n되돌릴 수 없어요.`)) return;
    const r = await sb.rpc("retire_member", { target: b.dataset.pid, wipe_all: true });
    toast(r.error ? (r.error.code === "42501" ? r.error.message : failMsg(r.error)) : "지웠어요");
    state.dirty = false; return loadAll();
  }
  if (act === "retireall") {
    const nm = (state.players[b.dataset.pid] || {}).name || "이 선수", all = act === "retireall";
    if (!await confirmDel(all ? `${nm}를 완전 삭제할까요?\n계정·개인정보·측정·운동 기록이 모두 지워지고 되돌릴 수 없어요.` : `${nm}를 졸업 처리할까요?\n계정과 개인정보는 지우고, 이름과 측정·운동 기록만 남겨요.`, all ? "네, 완전 삭제" : "네, 졸업")) return;
    const r = await sb.rpc("retire_member", { target: b.dataset.pid, wipe_all: all });
    if (r.error) toast(r.error.code === "42501" ? r.error.message : failMsg(r.error));
    else { toast(all ? "모두 지웠어요" : "졸업 처리했어요"); state.editPid = null; }
    state.dirty = false; return loadAll();
  }
  if (act === "logout") { closeSettings(); lsDel(snapKey()); await pushOff(true); await sb.auth.signOut(); return; }
  if (act === "drawer") return openDrawer();
  if (act === "settings") { closeDrawer(); return openSettings(); }
  if (act === "setclose") return closeSettings();
  if (act === "drawerclose") return closeDrawer();
  if (act === "themeset") {
    const r = document.documentElement, v = b.dataset.t;
    r.setAttribute("data-theme-transition", ""); setTimeout(() => r.removeAttribute("data-theme-transition"), 350);
    if (v === "auto") { delete r.dataset.theme; try { localStorage.removeItem("snuvt-theme"); } catch (e) {} }
    else { r.dataset.theme = v; try { localStorage.setItem("snuvt-theme", v); } catch (e) {} }
    state.dirty = false; return render();
  }
  if (act === "absopen") return openAbsent(b.dataset.date);
  if (act === "evno") return openEvAbsent(b.dataset.kind, b.dataset.id);
  if (act.startsWith("sc")) {
    const S = sc(), x = S.sel, v = b.dataset.v;
    if (act === "scnew") return openScoutForm("");
    if (act === "scedit") return openScoutForm(b.dataset.id);
    if (act === "scopen") { state.scoutId = b.dataset.id; S.tab = "input"; state.dirty = false; render(); window.scrollTo(0, 0); return; }
    if (act === "scback") { state.scoutId = null; state.dirty = false; render(); window.scrollTo(0, 0); return; }
    if (act === "sctab") S.tab = b.dataset.k;
    else if (act === "scset") x.set = Number(v);
    else if (act === "scside") { x.side = v; x.pid = null; }
    else if (act === "scpid") x.pid = v;
    else if (act === "scoppno") x.opp = v;
    else if (act === "scskill") { x.skill = v; x.kind = null; x.len = null; x.zone = null; }
    else if (act === "sckind") x.kind = x.kind === v ? null : v;
    else if (act === "sclen") x.len = x.len === v ? null : v;
    else if (act === "sczone") x.zone = x.zone === Number(v) ? null : Number(v);
    else if (act === "scfset") S.fset = Number(v);
    else if (act === "scsave") return scoutSave(b.dataset.g);
    else if (act === "scseek") { if (scPlayer) { try { scPlayer.seekTo(Number(b.dataset.t), true); } catch (e) {} } return; }
    else if (act === "scundo") {
      try { ok(await sb.from("scout_events").delete().eq("id", b.dataset.id)); const m = scMatch(); if (m) S.events[m.id] = (S.events[m.id] || []).filter(e => e.id !== b.dataset.id); } catch (e) { toast(failMsg(e)); }
    }
    else if (act === "scdel") {
      if (!await confirmDel("이 경기와 입력한 플레이를 모두 지울까요?")) return;
      try { ok(await sb.from("scout_matches").delete().eq("id", b.dataset.id)); S.matches = S.matches.filter(m => m.id !== b.dataset.id); state.scoutId = null; toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    }
    state.dirty = false; return render();
  }
  if (act === "evgo") {
    try { ok(await sb.from("event_votes").upsert({ kind: b.dataset.kind, ref_id: b.dataset.id, player_id: state.myPid, going: true, reason: null, note: null, updated_at: new Date().toISOString() }, { onConflict: "kind,ref_id,player_id" })); toast("참가로 냈어요"); }
    catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
  if (act === "entry") return openEntry(b.dataset.kind, b.dataset.id);
  if (act === "addform") return openForm(b.dataset.f);
  if (act === "edtest") return openTestEdit(b.dataset.id);
  if (act === "ytlatest") { state.latestId = b.dataset.id; state.dirty = false; return render(); }
  if (act === "ytprev" || act === "ytnext") { if (ytPlayer) { act === "ytnext" ? ytPlayer.nextVideo() : ytPlayer.previousVideo(); } else toast("영상을 불러오는 중이에요"); return; }
  if (act === "vidcat") { state.vidCat = b.dataset.c; state.dirty = false; return render(); }
  if (act === "vidopen") { state.vidOpen = state.vidOpen === b.dataset.id ? null : b.dataset.id; state.dirty = false; return render(); }
  if (act === "videdit") return openVidForm(b.dataset.id);
  if (act === "viddel") { if (!await confirmDel("이 영상을 목록에서 지울까요? (유튜브 영상은 그대로)")) return; try { ok(await sb.from("videos").delete().eq("id", b.dataset.id)); toast("지웠어요"); await loadAll(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "noteedit") { state.noteDate = b.dataset.d; state.dirty = false; render(); window.scrollTo(0, 0); return; }
  if (act === "notedel") { if (!await confirmDel("이 노트를 지울까요?")) return; try { ok(await sb.from("training_notes").delete().eq("player_id", state.myPid).eq("date", b.dataset.d)); state.noteDate = null; toast("지웠어요"); await loadAll(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "notego") { state.noteDate = b.dataset.d; return go("notes"); }
  if (act === "prgo") { state.prDate = b.dataset.d; return go("practice"); }
  if (act === "prday") { state.prDate = b.dataset.d; state.dirty = false; return render(); }
  if (act === "predit") { state.prEdit = !state.prEdit; state.dirty = false; return render(); }
  if (act === "prpub") { const d = prDateNow(), on = b.checked; return prSave(d, p => { p.published = on; }).then(r => r && toast(on ? "선수에게 공개했어요" : "선수에게 안 보이게 했어요")); }
  if (act === "prnew") {
    const d = prDateNow(), k = b.dataset.k, prev = Object.keys(state.practice).filter(x => x < d).sort().at(-1);
    state.prEdit = true;
    return prSave(d, p => { p.blocks = k === "tpl" ? PRACTICE_TEMPLATE() : k === "copy" && prev ? JSON.parse(JSON.stringify(state.practice[prev].blocks)) : []; if (k === "copy" && prev) { p.title = state.practice[prev].title; p.goal = state.practice[prev].goal; } });
  }
  if (act === "prwipe") { if (!await confirmDel("이날 훈련 계획을 지울까요?")) return; const d = prDateNow(); try { ok(await sb.from("practice_plans").delete().eq("date", d)); delete state.practice[d]; state.prEdit = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "prmove") { const i = Number(b.dataset.b), j = i + Number(b.dataset.d); return prSave(prDateNow(), p => { if (j < 0 || j >= p.blocks.length) return; [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]]; }); }
  if (act === "prbdel") { if (!await confirmDel("이 블록을 지울까요?")) return; const i = Number(b.dataset.b); return prSave(prDateNow(), p => { p.blocks.splice(i, 1); }); }
  if (act === "prblk") return openPrBlock(b.dataset.b);
  if (act === "prdrill") return openPrDrill(b.dataset.b, b.dataset.g);
  if (act === "prdrop") { const [bi, gi, di] = [b.dataset.b, b.dataset.g, b.dataset.i].map(Number); return prSave(prDateNow(), p => { p.blocks[bi].groups[gi].drills.splice(di, 1); }); }
  if (act === "drcat") { document.querySelectorAll(".lib-cats .chip").forEach(x => x.classList.toggle("on", x === b)); document.getElementById("pd-q").value = ""; document.getElementById("dlib").innerHTML = drillList(b.dataset.c, ""); return; }
  if (act === "drpick") { document.getElementById("pd-name").value = b.dataset.n; document.getElementById("pd-min").value = b.dataset.m || ""; document.querySelectorAll(".lib-box").forEach(x => x.classList.toggle("on", x === b)); return; }
  if (act === "boxedit") { state.boxEdit = !state.boxEdit; if (state.boxEdit && !state.editScope) state.editScope = "team"; state.dirty = false; return render(); }
  if (act === "boxscope") { state.editScope = b.dataset.s; state.dirty = false; return render(); }
  if (act === "boxadd") return openBoxLib(b.dataset.b);
  if (act === "boxundo") return boxWrite("delete", b.dataset.e);
  if (act === "boxdel") {
    if (b.dataset.e) return boxWrite("delete", b.dataset.e);
    return boxWrite("insert", { player_id: editCtx.pid, slot: editCtx.slot, block: b.dataset.b, op: "remove", name: b.dataset.n });
  }
  if (act === "libcat") { document.querySelectorAll(".lib-cats .chip").forEach(x => x.classList.toggle("on", x === b)); document.getElementById("bx-q").value = ""; document.getElementById("lib").innerHTML = libList(b.dataset.c, ""); return; }
  if (act === "libpick") { document.getElementById("bx-name").value = b.dataset.n; document.getElementById("bx-rx").value = b.dataset.r || ""; document.querySelectorAll(".lib-box").forEach(x => x.classList.toggle("on", x === b)); document.getElementById("bx-rx").focus(); return; }
  if (act === "ntpin" || act === "ntdel" || act === "ptdel") {
    try {
      if (act === "ntpin") ok(await sb.from("notices").update({ pinned: b.dataset.p === "1" }).eq("id", b.dataset.id));
      if (act === "ntdel") { if (!await confirmDel("이 공지를 지울까요?")) return; ok(await sb.from("notices").delete().eq("id", b.dataset.id)); toast("지웠어요"); }
      if (act === "ptdel") { ok(await sb.from("practice_times").delete().eq("key", b.dataset.key)); toast("원래 시간으로 돌렸어요"); }
      await loadAll();
    } catch (e) { toast(failMsg(e)); }
    return;
  }
  if (act === "absdel") {
    try { ok(await sb.from("absences").delete().eq("player_id", state.myPid).eq("date", b.dataset.date)); toast("불참을 취소했어요"); await loadAll(); } catch (e) { toast(failMsg(e)); }
    return;
  }
  if (act === "delfriendly") {
    if (!await confirmDel("이 교류전을 지울까요?")) return;
    try { ok(await sb.from("friendlies").delete().eq("id", b.dataset.id)); toast("지웠어요"); await loadAll(); } catch (e) { toast(failMsg(e)); }
    return;
  }
  if (act === "theme") {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.setAttribute("data-theme-transition", ""); setTimeout(() => r.removeAttribute("data-theme-transition"), 350);
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("snuvt-theme", r.dataset.theme); } catch (e) { /* 저장 못 해도 이번엔 바뀜 */ }
    return;
  }
  if (act === "xlsx") return exportXlsx(state.repSy || seasonRange().sy);
  if (act === "pushon") return pushOn();
  if (act === "pushoff") return pushOff();
  if (act === "rolepick") { closeDrawer(); closeSettings(); return openRolePick(); }
  if (act === "viewas") return setView(b.dataset.k);
  if (act === "refresh") { await loadProfile(); if (state.role === "pending") toast("아직 승인 전이에요."); return; }
  if (act === "editself") { state.editingSelf = true; state.dirty = false; return render(); }
  if (act === "canceledit") { state.editingSelf = false; state.dirty = false; return render(); }
  if (act === "savemember") {
    const id = b.dataset.id;
    const v = document.getElementById("mr-" + id).value, m = state.profiles.find(x => x.id === id) || {};
    try {
      if (v === "alumni") {
        const nm = (state.players[m.player_id] || {}).name || "이 부원";
        if (!await confirmDel(`${nm}를 졸업 처리할까요?\n계정과 개인정보는 지우고, 이름과 측정·운동 기록만 남겨요.`, "네, 졸업")) { state.dirty = false; return render(); }
        ok(await sb.rpc("retire_member", { target: m.player_id, wipe_all: false })); toast("졸업 처리했어요");
      } else {
        ok(await sb.from("profiles").update({ role: v === "military" ? "player" : v }).eq("id", id));
        if (m.player_id) ok(await sb.from("players").update({ military: v === "military" }).eq("id", m.player_id));
        toast("저장했어요");
      }
    } catch (e) { toast(e && e.code === "42501" ? e.message : failMsg(e)); }
    state.dirty = false; return loadAll();
  }
  if (act === "delmember") {
    const m = state.profiles.find(x => x.id === b.dataset.id) || {};
    const who = (m.player_id && state.players[m.player_id] && state.players[m.player_id].name) || m.email || "이 계정";
    if (!await confirmDel(`${who} 계정을 삭제할까요?\n선수 정보와 측정·기록·부상 정보가 모두 함께 지워져요.`)) return;
    // 이 계정에만 연결된 선수 정보를 먼저 지운다 (측정·기록 등은 cascade 로 함께 삭제) → 그다음 계정 삭제
    if (m.player_id && !state.profiles.some(o => o.id !== m.id && o.player_id === m.player_id)) {
      const d = await sb.from("players").delete().eq("id", m.player_id);
      if (d.error) { toast(failMsg(d.error)); state.dirty = false; return loadAll(); }
    }
    const r = await sb.rpc("remove_member", { target: b.dataset.id });
    if (r.error) toast(r.error.code === "42501" ? r.error.message : failMsg(r.error));
    else toast("계정을 삭제했어요");
    state.dirty = false; return loadAll();
  }
  if (["deltest", "dellog", "delpain", "delevent", "dellift"].includes(act)) {
    const msg = { dellift: "이 세트 기록을 삭제할까요?", delevent: "이 일정을 삭제할까요?\n프로그램이 바로 다시 맞춰져요.", deltest: "이 측정 기록을 삭제할까요?", dellog: "이 세션 기록을 삭제할까요?", delpain: "이 통증 기록을 삭제할까요?" }[act];
    if (!await confirmDel(msg)) return;
    try {
      ok(await sb.from({ deltest: "tests", dellog: "logs", delpain: "pain_checks", delevent: "events", dellift: "lift_sets" }[act]).delete().eq("id", b.dataset.id));
      toast("삭제했어요");
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
});
document.addEventListener("input", ev => { if (ev.target && ev.target.id === "scOpp") sc().sel.opp = ev.target.value; });
document.addEventListener("change", ev => {
  if (ev.target.id === "repSy") { state.repSy = Number(ev.target.value); return; }
  if (ev.target.id === "drViewAs") return setView(ev.target.value);
  if (ev.target.id === "scOpp") { sc().sel.opp = ev.target.value; return; }
  if (ev.target.name === "teamsw") return switchTeam(ev.target.value);
  if (ev.target.classList.contains("inj-part")) {
    const row = ev.target.closest(".inj-row"), t = row.querySelector(".inj-type");
    t.innerHTML = injTypes(ev.target.value).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    row.querySelector(".inj-finger").hidden = ev.target.value !== "finger";
    return;
  }
  if (ev.target.classList && ev.target.classList.contains("wexp-sel")) { const d = document.getElementById(ev.target.id + "-desc"); if (d) d.textContent = wexpDesc(ev.target.value); return; }
  if (ev.target.id === "pp-select") { state.pid = ev.target.value; state.dirty = false; render(); return; }
  if (ev.target.id === "lg-type") {
    const k = ev.target.value, m = document.getElementById("lg-min");
    if (m) m.value = LOG_TYPES[k][1];
  }
});
document.addEventListener("toggle", ev => { const d = ev.target; if (d && d.dataset && d.dataset.keep) state.openKeys[d.dataset.keep] = d.open; }, true);
document.addEventListener("input", ev => {
  if (ev.target.id === "pd-q") { const q = ev.target.value.trim(); const cat = (document.querySelector(".lib-cats .chip.on") || {}).dataset; document.getElementById("dlib").innerHTML = drillList(cat ? cat.c : "", q); return; }
  if (ev.target.id === "bx-q") { const q = ev.target.value.trim(); const cat = (document.querySelector(".lib-cats .chip.on") || {}).dataset; document.getElementById("lib").innerHTML = libList(cat ? cat.c : "", q); return; } const f = ev.target.closest("form.f"); if (f && f.id !== "authForm") state.dirty = true; });

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
      name: txt("sf-name"), pos: document.getElementById("sf-pos").value, year: normYear(txt("sf-year")),
      height: txt("sf-height"), weight: txt("sf-weight"), exp: txt("sf-exp"),
      weight_exp: document.getElementById("sf-wexp").value || null,
      ankle_l: txt("sf-al"), ankle_r: txt("sf-ar"), injuries: readInjuries("sf"),
      pain: readPain("sf"),
      note: txt("sf-note"), consent: document.getElementById("sf-consent").checked, number: txt("sf-num"),
    };
    const phone = txt("sf-phone");
    if (phone && !/^[0-9+ -]{7,20}$/.test(phone)) { toast("전화번호를 확인해 주세요."); return; }
    try {
      if (!info.consent) { toast("동의해야 제출할 수 있어요."); return; }
      const r = await sb.rpc("submit_my_info", { info });
      if (r.error) { toast(r.error.code === "23514" || r.error.code === "42501" ? r.error.message : failMsg(r.error)); return; }
      if (phone && r.data) { await sb.from("player_contacts").upsert({ player_id: r.data, phone, updated_at: new Date().toISOString() }); state.myPhone = phone; }
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
        const tm = (document.querySelector('input[name="au-team"]:checked') || {}).value || "men";
        const r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname, data: { team: tm } } });
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
        name, pos: document.getElementById("pf-pos").value, year: normYear(txt("pf-year")) || null,
        height: num("pf-height"), weight: num("pf-weight"), exp: num("pf-exp"),
        weight_exp: document.getElementById("pf-wexp").value, adjust, number: num("pf-num"),
        sort: prevPid ? ((state.players[prevPid] || {}).order ?? 99) : Object.keys(state.players).length + 1,
      };
      let id = prevPid;
      if (prevPid) ok(await sb.from("players").update(row).eq("id", prevPid));
      else id = ok(await sb.from("players").insert(row).select("id").single()).id;
      ok(await sb.from("health").upsert({
        player_id: id, ankle_l: ankleL, ankle_r: ankleR, injuries,
        knee_injury: injuries.some(x => x.part === "knee"), pain, note: txt("hf-note") || null,
        rehab: [], consent: true, updated_at: new Date().toISOString(),
      }));
      // 직책 (관리자·주장은 전체 권한) · 연락처
      const title = document.getElementById("pf-title").value || null;
      if (title !== ((state.players[id] || {}).title || null)) ok(await sb.rpc("set_member_title", { target: id, new_title: title }));
      const media = document.getElementById("pf-media").checked;
      if (media !== !!(state.players[id] || {}).media) ok(await sb.rpc("set_member_media", { target: id, on_: media }));
      const phone = txt("pf-phone");
      if (phone !== ((state.contacts || {})[id] || "")) ok(await sb.from("player_contacts").upsert({ player_id: id, phone: phone || null, updated_at: new Date().toISOString() }));
      state.editPid = id;
      toast(prevPid ? "저장했어요" : `${name} 선수를 추가했어요`);
    } else if (f.id === "vidForm") {
      const y = parseYt(document.getElementById("vd-url").value);
      if (!y) { toast("유튜브 재생목록이나 영상 주소를 넣어 주세요."); return; }
      const row = { ...y, category: document.getElementById("vd-cat").value, title: txt("vd-title"), date: txt("vd-date") || null, note: txt("vd-note") || null };
      if (f.dataset.id) ok(await sb.from("videos").update(row).eq("id", f.dataset.id)); else ok(await sb.from("videos").insert(row));
      toast(f.dataset.id ? "고쳤어요" : "영상을 추가했어요");
    } else if (f.id === "noteForm") {
      const row = { player_id: state.myPid, date: txt("nt-date"), good: txt("nt-good") || null, fix: txt("nt-fix") || null, next: txt("nt-next") || null, body: document.getElementById("nt-body").value.trim() || null, shared: document.getElementById("nt-share").checked, updated_at: new Date().toISOString() };
      if (!row.good && !row.fix && !row.next && !row.body) { toast("한 칸이라도 써 주세요."); return; }
      ok(await sb.from("training_notes").upsert(row, { onConflict: "player_id,date" }));
      state.noteDate = row.date; toast("노트를 저장했어요");
    } else if (f.id === "prMetaForm") {
      const title = txt("pr-title"), goal = txt("pr-goal");
      if (await prSave(f.dataset.d, p => { p.title = title; p.goal = goal; })) toast("저장했어요");
      return;
    } else if (f.id === "prBlockForm") {
      const bi = f.dataset.b, title = txt("pb-title"), minutes = num("pb-min"), split = document.getElementById("pb-split").value === "pos";
      closeSheet();
      await prSave(prDateNow(), p => {
        const groupsFor = old => split ? PRACTICE_GROUPS.map(([name, pos]) => (old || []).find(g => g.name === name) || { name, pos, drills: [] }) : [{ name: "공통", pos: [], drills: (old || []).flatMap(g => g.drills || []) }];
        if (bi === "new") p.blocks.push({ title, minutes, groups: groupsFor(null) });
        else { const b = p.blocks[Number(bi)]; const was = (b.groups || []).length > 1; b.title = title; b.minutes = minutes; if (was !== split) b.groups = groupsFor(was ? null : b.groups); }
      });
      return;
    } else if (f.id === "prDrillForm") {
      const bi = Number(f.dataset.b), gi = Number(f.dataset.g), n = txt("pd-name"); if (!n) return;
      const d = { n, m: num("pd-min") || null, note: txt("pd-note") || undefined };
      closeSheet();
      if (await prSave(prDateNow(), p => { p.blocks[bi].groups[gi].drills.push(d); })) toast(`${n} 추가했어요`);
      return;
    } else if (f.id === "boxForm") {
      const name = txt("bx-name"); if (!name) return;
      closeSheet();
      if (await boxWrite("insert", { player_id: editCtx.pid, slot: editCtx.slot, block: f.dataset.b, op: "add", name, rx: txt("bx-rx") || null })) toast(`${name} 추가했어요`);
      return;
    } else if (f.id === "myInjForm") {
      ok(await sb.rpc("update_my_injuries", { injuries: readInjuries("mi") }));
      toast("부상 정보를 저장했어요 · 프로그램이 맞춰져요"); state.dirty = false; await loadAll(); return refreshSettings();
    } else if (f.id === "profileForm") {
      const phone = txt("pr-phone");
      if (phone && !/^[0-9+ -]{7,20}$/.test(phone)) { toast("전화번호를 확인해 주세요."); return; }
      ok(await sb.rpc("update_my_profile", { info: { year: normYear(txt("pr-year")), height: txt("pr-h"), weight: txt("pr-w"), exp: txt("pr-exp"), weight_exp: document.getElementById("pr-wexp").value } }));
      if (phone !== ((state.contacts || {})[state.myPid] || "")) ok(await sb.from("player_contacts").upsert({ player_id: state.myPid, phone: phone || null, updated_at: new Date().toISOString() }));
      toast("내 정보를 저장했어요");
    } else if (f.id === "hsForm") {
      const st = Number(document.getElementById("hs-st").value);
      toast((await dbWrite("tests", "insert", { player_id: f.dataset.pid, date: iso(today()), hs_stage: st })).queued ? "연결되면 저장돼요" : `핸드스탠드 ${st}단계로 바꿨어요`);
    } else if (f.id === "testEditForm") {
      const g = id => { const v = document.getElementById(id).value; return v === "" ? null : Number(v); };
      ok(await sb.from("tests").update({ date: txt("et-date"), reach: g("et-reach"), vert: g("et-vert"), max_vert: g("et-maxvert"), side_step: g("et-side") }).eq("id", f.dataset.id));
      toast("측정값을 고쳤어요");
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
      const row = { player_id: f.dataset.pid, date: txt("ms-date"), reach: g("ms-reach"), vert: g("ms-vert"), max_vert: g("ms-maxvert"), side_step: g("ms-side") };
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
    } else if (f.id === "noticeForm") {
      ok(await sb.from("notices").insert({ title: txt("nt-title"), body: document.getElementById("nt-body").value.trim() || null, pinned: document.getElementById("nt-pin").checked, notify: document.getElementById("nt-push").checked }));
      toast(document.getElementById("nt-push").checked ? "공지를 올리고 알림을 보냈어요" : "공지를 올렸어요");
    } else if (f.id === "entryForm") {
      const kind = f.dataset.kind, id = f.dataset.id, pids = [...f.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
      ok(await sb.from("entries").delete().eq("kind", kind).eq("ref_id", id));
      if (pids.length) ok(await sb.from("entries").insert(pids.map(player_id => ({ kind, ref_id: id, player_id }))));
      closeSheet(); toast(`엔트리 ${pids.length}명 저장`);
    } else if (f.id === "ptForm") {
      const rows = ["S1", "S2"].map(k => ({ team_id: TEAM.id, key: k, start_time: txt(`pt-${k}-s`), end_time: txt(`pt-${k}-e`) || null }));
      if (rows.some(r => r.end_time && r.end_time <= r.start_time)) { toast("끝 시간이 시작보다 앞이에요."); return; }
      ok(await sb.from("practice_times").upsert(rows));
      toast("정규 훈련 시간을 저장했어요");
    } else if (f.id === "ptDayForm") {
      const date = txt("ptd-date"), st = txt("ptd-s"), en = txt("ptd-e") || null;
      if (seasonDay(date, events()).slot !== "team") { toast("그날은 정규 훈련 날이 아니에요."); return; }
      if (en && en <= st) { toast("끝 시간이 시작보다 앞이에요."); return; }
      ok(await sb.from("practice_times").upsert({ team_id: TEAM.id, key: date, start_time: st, end_time: en, note: txt("ptd-note") || null }));
      toast("그날 훈련 시간을 바꿨어요");
    } else if (f.id === "friendlyForm") {
      const st = txt("fr-start") || null, en = txt("fr-end") || null;
      if (st && en && en <= st) { toast("끝 시간이 시작보다 앞이에요."); return; }
      ok(await sb.from("friendlies").insert({ date: txt("fr-date"), opponent: txt("fr-opp"), format: document.getElementById("fr-fmt").value, start_time: st, end_time: en, place: txt("fr-place") || null, note: txt("fr-note") || null }));
      toast("교류전을 넣었어요 · 그 주 프로그램이 맞춰졌어요");
    } else if (f.id === "openForm") {
      const st = txt("op-s") || null, en = txt("op-e") || null;
      if (st && en && en <= st) { toast("끝 시간이 시작보다 앞이에요."); return; }
      ok(await sb.from("open_sessions").insert({ date: txt("op-date"), start_time: st, end_time: en, place: txt("op-place") || null, note: txt("op-note") || null }));
      toast("자율 훈련을 넣었어요");
    } else if (f.id === "scForm") {
      const yt = txt("scf-yt");
      if (yt && !parseYt(yt)) { toast("유튜브 링크를 확인해 주세요"); return; }
      const row = { title: txt("scf-title"), date: txt("scf-date") || null, opponent: txt("scf-opp") || null, yt: yt || null, note: txt("scf-note") || null };
      ok(f.dataset.id ? await sb.from("scout_matches").update(row).eq("id", f.dataset.id) : await sb.from("scout_matches").insert(row));
      closeSheet(); toast("저장했어요"); await scoutLoad(); return;
    } else if (f.id === "evAbsForm") {
      const r = f.querySelector('input[name="eva-r"]:checked');
      ok(await sb.from("event_votes").upsert({ kind: f.dataset.kind, ref_id: f.dataset.id, player_id: state.myPid, going: false, reason: r ? r.value : "etc", note: txt("eva-note") || null, updated_at: new Date().toISOString() }, { onConflict: "kind,ref_id,player_id" }));
      closeSheet(); toast("불참을 냈어요");
    } else if (f.id === "absForm") {
      const r = f.querySelector('input[name="abs-r"]:checked');
      ok(await sb.from("absences").upsert({ player_id: state.myPid, date: f.dataset.date, reason: r ? r.value : "etc", note: txt("abs-note") || null, author: uid() }, { onConflict: "player_id,date" }));
      closeSheet(); toast("불참을 냈어요");
    } else if (f.id === "offForm") {
      const date = txt("off-date");
      if (seasonDay(date, events()).slot !== "team") { toast("그날은 정규 훈련 날이 아니에요."); return; }
      ok(await sb.from("team_off").upsert({ team_id: TEAM.id, date, note: txt("off-note") || null }));
      toast("정규 훈련 없음으로 정했어요");
    } else if (f.id === "wellForm") {
      const row = { player_id: f.dataset.pid, date: iso(today()) };
      for (const [k] of WELL_KEYS) row[k] = Number(document.getElementById("wl-" + k).value);
      row.stress = row.mood; // 기분·스트레스를 한 문항으로
      state.openKeys["well-form"] = false;
      await dbWrite("wellness", "upsert", row, { onConflict: "player_id,date" });
      toast(readiness(row, lastRpeBefore(f.dataset.pid, row.date)).length ? "저장했어요 · 오늘은 회복 버전" : "저장했어요");
    }
    state.dirty = false;
    if (f.dataset.close) closeSheet();
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
    { const tg = document.getElementById("teamTag"); if (tg) tg.textContent = ""; }
    Object.assign(state, { role: null, admin: false, myPid: null, players: {}, tests: {}, health: {}, logs: {}, inbody: {}, profiles: [], loaded: false, booting: false, dirty: false, selfPlayer: null, selfHealth: null, editingSelf: false });
    render(); return;
  }
  let r;
  try { r = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle(); } catch (e) { r = { error: e }; }
  if (r.error) {
    // 연결이 없으면 이 기기에 저장해 둔 것으로
    const snap = isNetErr(r.error) ? lsGet(snapKey()) : null;
    if (!snap || !snap.me) { state.offline = true; state.booting = false; render(); return; }
    r = { data: { role: snap.me.role, player_id: snap.me.player_id, team_id: snap.me.team } };
  }
  await loadTeam(r.data ? r.data.team_id : "men");
  state.role = r.data ? r.data.role : "pending";
  state.superAdmin = !!(r.data && r.data.super);
  state.myPid = r.data ? r.data.player_id : null;
  state.coach = state.role === "coach";
  state.staff = state.coach || !!STAFF_PERMS[state.title] || !!state.media;
  state.viewAs = pickView(); state.admin = state.viewAs !== "player";
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
  state.selfPlayer = r ? { name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp, weightExp: wexpNorm(r.weight_exp), number: r.number } : null;
  state.selfHealth = h ? { ankleL: h.ankle_l, ankleR: h.ankle_r, injuries: h.injuries || [], pain: h.pain || {}, note: h.note, consent: h.consent } : null;
}
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
// 총관리자: 남자부·여자부 오가기 (서버에서 내 팀을 바꾸고 처음부터 다시 불러옴)
async function switchTeam(t) {
  if (t === TEAM.id) return;
  const r = await sb.rpc("switch_team", { t });
  if (r.error) { toast(r.error.code === "42501" ? r.error.message : failMsg(r.error)); return; }
  try { lsDel(snapKey()); } catch (e) {}
  closeSettings(); toast(`${t === "women" ? "여자부" : "남자부"}로 바꿨어요`);
  state.loaded = false; state.booting = true; render();
  return loadProfile();
}
// 팀 (남자부·여자부): 이름·네트 높이·정규 훈련 요일
const TEAMS_FALLBACK = { men: { id: "men", label: "남자부", net_cm: 243, swap_days: false }, women: { id: "women", label: "여자부", net_cm: 224, swap_days: true } };
async function loadTeam(id) {
  let t = TEAMS_FALLBACK[id] || TEAMS_FALLBACK.men;
  try { const q = await sb.from("teams").select("*").eq("id", id || "men").maybeSingle(); if (q.data) t = q.data; } catch (e) { /* 연결 없으면 기본값 */ }
  setTeam(t); document.documentElement.dataset.team = TEAM.id; const tg = document.getElementById("teamTag"); if (tg) tg.textContent = TEAM.label;
}
async function loadAll() {
  let raw = null;
  try {
    const q = [
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
      sb.from("friendlies").select("*").order("date"),
      sb.from("absences").select("*").gte("date", iso(addDays(today(), -120))),
      sb.from("notices").select("*").order("created_at", { ascending: false }).limit(60),
      sb.from("entries").select("*"),
      sb.from("practice_times").select("*"),
      sb.from("player_contacts").select("*"),
      sb.from("program_edits").select("*").order("created_at"),
      sb.from("player_private").select("*"),
      sb.from("practice_plans").select("*"),
      sb.from("videos").select("*").order("sort").order("created_at", { ascending: false }),
      sb.from("training_notes").select("*").order("date", { ascending: false }).limit(200),
      sb.from("open_sessions").select("*").gte("date", iso(addDays(today(), -60))).order("date"),
      sb.from("open_votes").select("*"),
      sb.from("event_votes").select("*"),
    ];
    if (state.coach) q.push(sb.from("profiles").select("*").order("created_at"));
    const res = await Promise.all(q);
    const [pl, ts, hl, lg, pcs, evq, wq, lq, toq, dpq, frq, abq, nq, enq, ptq, ctq, peq, pvq, ppq, vdq, tnq, osq, ovq, vtq] = res, pr = state.coach ? res[24] : null;
    for (const r of [pl, ts, hl, lg]) if (r.error) throw r.error;
    const rows = r => r && !r.error && Array.isArray(r.data) ? r.data : [];
    raw = { players: pl.data, tests: ts.data, health: hl.data, logs: lg.data, pain_checks: rows(pcs), events: evq && !evq.error ? evq.data : null,
      wellness: rows(wq), lift_sets: rows(lq), team_off: rows(toq), day_picks: rows(dpq), friendlies: rows(frq), absences: rows(abq), notices: rows(nq), entries: rows(enq), practice_times: rows(ptq), player_contacts: rows(ctq), program_edits: rows(peq), player_private: rows(pvq), practice_plans: rows(ppq), videos: rows(vdq), training_notes: rows(tnq), open_sessions: rows(osq), open_votes: rows(ovq), event_votes: rows(vtq), profiles: pr && !pr.error ? pr.data : [],
      me: { role: state.role, player_id: state.myPid, team: TEAM.id } };
    // 기기에 남기는 사본에는 연락처와 다른 사람 키·몸무게를 넣지 않음
    lsSet(snapKey(), { ...raw, training_notes: (raw.training_notes || []).filter(r => r.player_id === state.myPid), player_contacts: (raw.player_contacts || []).filter(r => r.player_id === state.myPid), player_private: (raw.player_private || []).filter(r => r.player_id === state.myPid) }); state.net = true;
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
  const fr = {};
  for (const r of raw.friendlies || []) (fr[r.date] = fr[r.date] || []).push({ id: r.id, opponent: r.opponent, format: r.format, start: r.start_time ? String(r.start_time).slice(0, 5) : "", end: r.end_time ? String(r.end_time).slice(0, 5) : "", place: r.place || "", note: r.note || "" });
  state.friendlies = fr;
  const op = {}, vt = {};
  for (const r of raw.open_votes || []) (vt[r.session_id] = vt[r.session_id] || {})[r.player_id] = !!r.going;
  for (const r of raw.open_sessions || []) (op[r.date] = op[r.date] || []).push({ id: r.id, date: r.date, start: r.start_time || "", end: r.end_time || "", place: r.place || "", note: r.note || "", votes: vt[r.id] || {} });
  state.opens = op;
  const ev = {};
  for (const r of raw.event_votes || []) (ev[r.kind + ":" + r.ref_id] = ev[r.kind + ":" + r.ref_id] || {})[r.player_id] = { going: !!r.going, reason: r.reason || "", note: r.note || "" };
  state.evVotes = ev;
  const ab = {};
  for (const r of raw.absences || []) (ab[r.player_id] = ab[r.player_id] || {})[r.date] = { id: r.id, reason: r.reason, note: r.note || "" };
  state.absences = ab;
  state.notices = (raw.notices || []).map(r => ({ id: r.id, title: r.title, body: r.body || "", pinned: !!r.pinned, created: r.created_at }));
  const en = {};
  for (const r of raw.entries || []) (en[r.kind + ":" + r.ref_id] = en[r.kind + ":" + r.ref_id] || new Set()).add(r.player_id);
  state.entries = en;
  state.ptimes = Object.fromEntries((raw.practice_times || []).map(r => [r.key, { start: String(r.start_time).slice(0, 5), end: r.end_time ? String(r.end_time).slice(0, 5) : "", note: r.note || "" }]));
  const pk = {};
  for (const r of raw.day_picks || []) (pk[r.player_id] = pk[r.player_id] || {})[r.date] = r.pick;
  state.picks = pk;
  state.events = raw.events ? raw.events.map(r => ({ id: r.id, name: r.name, kind: r.kind, start: r.start_date, end: r.end_date, note: r.note })) : null;
  // 졸업생은 팀 명단에서 빼고 따로 둔다 (기록만 남음)
  state.alumni = (raw.players || []).filter(r => r.alumni).map(r => ({ id: r.id, name: r.name, pos: r.pos, left: r.left_on })).sort((a, b) => String(b.left || "").localeCompare(String(a.left || "")));
  state.players = Object.fromEntries((raw.players || []).filter(r => !r.alumni).map(r => [r.id, {
    name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp,
    weightExp: wexpNorm(r.weight_exp), adjust: r.adjust || {}, order: r.sort, title: r.title || null, number: r.number ?? null, media: !!r.media, military: !!r.military,
  }]));
  // 다른 팀을 보고 있는 총관리자는 그 팀에 내 선수 정보가 없음 → 관리자로만
  if (state.coach && state.myPid && !state.players[state.myPid]) state.myPid = null;
  // 내 직책 → 맡은 일 (관리자·주장은 role coach)
  const myTitle = (state.players[state.myPid] || {}).title || null, myMedia = !!(state.players[state.myPid] || {}).media;
  if (myTitle !== state.title || myMedia !== !!state.media) {
    state.media = myMedia;
    state.title = myTitle;
    state.staff = state.coach || !!STAFF_PERMS[myTitle] || state.media;
    state.viewAs = pickView();
    state.admin = state.viewAs !== "player";
  }
  state.contacts = Object.fromEntries((raw.player_contacts || []).map(r => [r.player_id, r.phone || ""]));
  for (const r of raw.player_private || []) if (state.players[r.player_id]) Object.assign(state.players[r.player_id], { height: r.height == null ? null : Number(r.height), weight: r.weight == null ? null : Number(r.weight) });
  state.videos = (raw.videos || []).map(r => ({ id: r.id, kind: r.kind, cat: r.category, title: r.title, yt: r.yt, date: r.date, note: r.note || "" }));
  state.notes = (raw.training_notes || []).map(r => ({ id: r.id, pid: r.player_id, date: r.date, good: r.good || "", fix: r.fix || "", next: r.next || "", body: r.body || "", shared: !!r.shared }));
  state.practice = Object.fromEntries((raw.practice_plans || []).map(r => [r.date, { title: r.title || "", goal: r.goal || "", blocks: Array.isArray(r.blocks) ? r.blocks : [], published: r.published !== false }]));
  state.edits = (raw.program_edits || []).map(r => ({ id: r.id, pid: r.player_id || null, slot: r.slot, block: r.block, op: r.op, name: r.name, rx: r.rx || "", cue: r.cue || "" }));
  const tests = {};
  for (const r of raw.tests || []) {
    (tests[r.player_id] = tests[r.player_id] || { runs: [] }).runs.push({
      id: r.id, date: r.date, reach: r.reach, cmj: r.cmj, block: r.block, approach: r.approach,
      vert: n(r.vert), maxVert: n(r.max_vert), hsStage: r.hs_stage, hsSec: r.hs_sec, hsWalk: n(r.hs_walk), squat: r.squat, rdl: r.rdl, pull: r.pull,
      sideL: r.side_l, sideR: r.side_r, plank: r.plank, author: r.author, block: n(r.block), sideStep: r.side_step, agility: n(r.pro_agility),
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
// 설정 → 알림 칸 (기기마다)
async function fillPushBox() {
  const box = document.getElementById("pushBox"); if (!box) return;
  let msg = "", row = null;
  if (!playerOf(state.myPid)) msg = "선수 정보가 연결되면 켤 수 있어요.";
  else if (!pushOk()) msg = isIOS() && !standalone() ? "아이폰은 Safari 공유 버튼 → '홈 화면에 추가'로 설치한 뒤, 설치한 앱에서 켤 수 있어요." : "이 브라우저는 알림을 지원하지 않아요.";
  else if (Notification.permission === "denied") msg = "알림이 차단돼 있어요. 휴대폰 설정에서 이 앱(사이트) 알림을 허용해 주세요.";
  else {
    const sub = await pushSub().catch(() => null);
    if (sub) { const r = await sb.from("push_subs").select("morning,evening,notice,morning_at,evening_at").eq("endpoint", sub.endpoint).maybeSingle(); row = r.data || null; }
  }
  const el = document.getElementById("pushBox"); if (!el) return;
  const on = !!row, hours = (id, from, to, cur) => `<select id="${id}" class="hour-sel" aria-label="시간">${Array.from({ length: to - from + 1 }, (_, i) => from + i).map(h => `<option value="${h}" ${h === cur ? "selected" : ""}>${h < 12 ? "오전" : "오후"} ${h % 12 || 12}시</option>`).join("")}</select>`;
  const rowH = (id, v, l, sub, sel) => `<div class="push-row"><label class="check"><input type="checkbox" id="${id}" ${v ? "checked" : ""}> <span><b>${l}</b><span class="small muted">${sub}</span></span></label>${sel || ""}</div>`;
  el.innerHTML = msg ? `<p class="small">${esc(msg)}</p>` : `
    <div class="push-rows">${rowH("pu-m", on ? row.morning : true, "컨디션", "아직 안 넣었을 때만", hours("pu-mh", 5, 12, on ? row.morning_at ?? 8 : 8))}${rowH("pu-e", on ? row.evening : true, "운동 기록", "운동 있는 날, 안 남겼을 때만", hours("pu-eh", 17, 23, on ? row.evening_at ?? 22 : 22))}${rowH("pu-n", on ? row.notice !== false : true, "공지", "새 공지가 올라오면 바로")}</div>
    <div class="row"><button class="btn primary" type="button" data-act="pushon">${on ? "저장" : "알림 켜기"}</button>${on ? `<button class="btn" type="button" data-act="pushoff">끄기</button>` : ""}</div>
    <p class="small muted">${on ? "이 기기에서 알림을 받고 있어요." : "기기마다 따로 켜요."}</p>`;
}
async function pushOn() {
  const m = document.getElementById("pu-m").checked, e = document.getElementById("pu-e").checked, nt = document.getElementById("pu-n").checked;
  const mh = Number(document.getElementById("pu-mh").value), eh = Number(document.getElementById("pu-eh").value);
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("알림이 허용되지 않았어요"); return fillPushBox(); }
  try {
    let sub = await pushSub();
    if (!sub) {
      const k = await sb.rpc("push_pubkey");
      if (k.error || !k.data) throw new Error("key");
      const reg = await navigator.serviceWorker.ready;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.data) });
    }
    const j = sub.toJSON();
    const r = await sb.from("push_subs").upsert({ endpoint: sub.endpoint, user_id: uid(), player_id: state.myPid, p256dh: j.keys.p256dh, auth: j.keys.auth, morning: m, evening: e, notice: nt, morning_at: mh, evening_at: eh, train_days: trainDays(state.myPid), updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (r.error) throw r.error;
    lsSet(PUSH_DAY(), iso(today()));
    toast(m || e || nt ? "알림을 켰어요" : "알림을 모두 껐어요");
    fillPushBox();
  } catch (err) { toast("알림을 켜지 못했어요. 잠시 뒤 다시 해 주세요"); }
}
async function pushOff(quiet) {
  try {
    const sub = await pushSub();
    if (sub) { await sb.from("push_subs").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    if (!quiet) { toast("이 기기 알림을 껐어요"); fillPushBox(); }
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
  state.view = VIEWS.includes(h) ? h : h === "player" ? "plan" : ["week", "load"].includes(h) ? "report" : "home";
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
  document.body.insertAdjacentHTML("beforeend", `<div class="setpanel-bg" id="setpanel" hidden data-act="setclose"><aside class="setpanel" aria-label="설정" data-act="noop"><div class="setpanel-body"></div></aside></div>`);
  document.body.insertAdjacentHTML("beforeend", `<div class="drawer-bg" id="drawer" hidden data-act="drawerclose"><aside class="drawer" aria-label="전체 메뉴" data-act="noop"><div class="drawer-body"></div></aside></div>`);
  boot();
}
