/* SNUVT Physical — 화면·데이터 (처방 규칙은 program.js) */

/* ---------- 기준값 ---------- */
const DEFAULT_SETTINGS = { name: "서울대배", blockStart: "2026-10-26", start: "2026-11-21", end: "2026-11-22" };
const LOG_TYPES = { A: ["월 웨이트 (점프·하체)", 75], B: ["목 웨이트 (상체·코어)", 60], team: ["정규 훈련", 180], act: ["활성화", 30], match: ["경기", 90], other: ["선택 운동·기타", 30] };
const RPE = ["0 휴식", "1 아주 쉬움", "2 쉬움", "3 보통", "4 약간 힘듦", "5 힘듦", "6", "7 매우 힘듦", "8", "9", "10 최대"];
const AREA_KO = { knee: "무릎", shoulder: "어깨", ankle: "발목", back: "허리" };
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, "0");
const parseD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
const today = () => parseD(iso(new Date()));
const daysBetween = (a, b) => Math.round((parseD(iso(a)) - parseD(iso(b))) / 86400000);
const S = () => ({ ...DEFAULT_SETTINGS, ...(state.settings || {}) });
const weekOf = date => Math.floor(daysBetween(date, parseD(S().blockStart)) / 7);
const monOf = w => addDays(parseD(S().blockStart), 7 * w);
const dateOf = (w, d) => addDays(monOf(w), d);
const dowMon = date => (date.getDay() + 6) % 7; // 월요일 = 0
const longDate = d => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;

/* ---------- 상태 ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = {
  view: "team", week: null, day: null, pid: null, editPid: null,
  players: {}, tests: {}, health: {}, logs: {}, inbody: {}, settings: null,
  loaded: false, offline: false, admin: false, canWrite: null, dirty: false, armed: null,
  session: null, role: null, myPid: null, email: "", profiles: [], authMode: "login", authMsg: "", authErr: false, booting: true,
  selfPlayer: null, selfHealth: null, editingSelf: false,
};
let sb = null;

function sortedPlayers() {
  return Object.entries(state.players).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)) || ((a.order ?? 99) - (b.order ?? 99)) || String(a.name).localeCompare(String(b.name), "ko"));
}
function runs(pid) { return [...((state.tests[pid] || {}).runs || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))); }
const latest = pid => runs(pid).at(-1) || null;
const first = pid => runs(pid)[0] || null;
const inbodyOf = pid => [...(state.inbody[pid] || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
const curWeek = () => Math.min(3, Math.max(0, weekOf(today())));
// 보고 있는 주에 오늘이 들어 있으면 오늘 요일, 아니면 월요일
function defaultDay(w) { const t = today(); return weekOf(t) === w ? dowMon(t) : 0; }
const selWeek = () => state.week ?? curWeek();
const selDay = () => state.day ?? defaultDay(selWeek());
const canSeePrivate = pid => state.admin || (!!pid && pid === state.myPid);

/* ---------- 처방 연결 ---------- */
function ctxFor(p) {
  const h = state.health[p.id] || {};
  const ib = inbodyOf(p.id).filter(x => x.weight != null).at(-1);
  return {
    player: p, test: latest(p.id),
    weight: ib ? ib.weight : p.weight,
    rehab: h.rehab || [],
    ankleHistory: !!(p.adjust && p.adjust.ankleBal) || (Number(h.ankleL) || 0) + (Number(h.ankleR) || 0) > 0,
  };
}
const planFor = (p, w, d) => dayPlan(ctxFor(p), w, d);
const teamPlan = (w, d) => dayPlan({ player: {} }, w, d);

/* ---------- 표시용 깃발 (관리자·본인만) ---------- */
function flags(p) {
  const out = [];
  if (!canSeePrivate(p.id)) return out;
  const h = state.health[p.id] || {};
  const pain = h.pain || {};
  for (const [k, lab] of Object.entries(AREA_KO)) if (Number(pain[k]) >= 3) out.push(["crit", `${lab} 통증 ${pain[k]}/10`]);
  for (const m of effectiveModules(p.adjust, h.rehab)) out.push([m.stage <= 1 ? "crit" : "warn", `${REHAB[m.area].label.split(" ")[0]} ${m.stage}단계${m.inferred ? "?" : ""}`]);
  const sp = (Number(h.ankleL) || 0) + (Number(h.ankleR) || 0);
  if (sp > 0) out.push(["", `발목 염좌 이력 ${sp}회`]);
  const t = latest(p.id);
  if (t && (t.balL === false || t.balR === false)) out.push(["warn", "한 발 서기 미통과"]);
  if (p.weightExp === "none") out.push(["", "웨이트 입문"]);
  if (state.admin && state.profiles.some(pr => pr.player_id === p.id && pr.role === "pending")) out.unshift(["warn", "승인 대기"]);
  return out;
}
const chipsHtml = list => list.length ? `<div class="chips">${list.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : "";

/* ---------- 화면: 공통 ---------- */
function trackHtml(sel) {
  const s = S(), now = weekOf(today());
  const cells = WEEKS.map((wk, i) => {
    const mon = monOf(i), sun = addDays(mon, 6);
    return `<button class="wk" type="button" data-act="week" data-w="${i}" aria-pressed="${sel === i}">
      <span class="lab">${wk.label}</span><span class="dt">${md(mon)}–${md(sun)}</span><span class="gl">${esc(wk.goal)}</span>
      ${now === i ? '<span class="now">이번 주</span>' : ""}</button>`;
  }).join("");
  const a = parseD(s.start), b = parseD(s.end);
  return `<div class="track">${cells}<div class="wk cup" aria-label="대회"><span class="lab">${esc(s.name)}</span><span class="dt">${md(a)}–${md(b)}</span><span class="gl">토 조별리그 2경기 · 일 최대 4경기</span></div></div>`;
}
const SHORT = { "점프 + 하체 근력": "하체", "상체·엉덩이·코어": "상체", "활성화 30분": "활성화", "정규 훈련": "훈련", "휴식": "휴식", "완전 휴식": "휴식", "대회 1일차": "대회", "대회 2일차": "대회" };
function daysHtml(w, sel, planOf) {
  const t = iso(today());
  return `<div class="days" role="group" aria-label="요일">${DAYS.map((lab, d) => {
    const date = dateOf(w, d), plan = planOf(d);
    const cls = plan.kind.includes("휴식") ? "rest" : plan.kind.includes("대회") ? "cup" : plan.kind === "정규 훈련" ? "team" : "gym";
    return `<button type="button" class="day ${cls}" data-act="day" data-d="${d}" aria-pressed="${sel === d}">
      <span class="dw">${lab}</span><span class="dt">${md(date)}</span><span class="kd">${esc(SHORT[plan.kind] || plan.kind)}</span>${iso(date) === t ? '<span class="tdy">오늘</span>' : ""}</button>`;
  }).join("")}</div>`;
}
function myName() {
  const p = (state.myPid && state.players[state.myPid]) || state.selfPlayer;
  return p && p.name ? p.name : (state.email || "").split("@")[0];
}
function header() {
  const s = S();
  document.getElementById("today").textContent = longDate(today());
  const d = daysBetween(parseD(s.start), today());
  const end = daysBetween(parseD(s.end), today());
  document.getElementById("dday").innerHTML = d > 0 ? `${esc(s.name)} <strong>D-${d}</strong>`
    : d === 0 ? `${esc(s.name)} <strong>D-DAY</strong>` : end >= 0 ? `${esc(s.name)} <strong>대회 중</strong>` : `<span>${esc(s.name)} 종료</span>`;
  const who = document.getElementById("who");
  const roleKo = state.admin ? "관리자" : state.role === "player" ? "선수" : "";
  who.innerHTML = state.session ? `<span>${esc(myName())}${roleKo ? " " + roleKo : ""}</span><button class="btn link" type="button" data-act="logout">로그아웃</button>` : "";
  if (!state.session || !state.role || state.role === "pending" || state.offline) { document.getElementById("tabs").innerHTML = ""; return; }
  const tabs = [["team", "팀 일정"], ["player", state.admin ? "선수별 처방" : "내 처방"]];
  if (state.admin) tabs.push(["intake", "등록·측정"], ["load", "훈련 부하"]);
  document.getElementById("tabs").innerHTML = tabs.map(([k, l]) =>
    `<button type="button" data-act="view" data-v="${k}" ${state.view === k ? 'aria-current="page"' : ""}>${l}</button>`).join("");
}

/* ---------- 화면: 팀 일정 ---------- */
function viewTeam() {
  const w = selWeek(), d = selDay();
  const date = dateOf(w, d), tp = teamPlan(w, d);
  const ps = sortedPlayers();
  let body;
  if (!state.loaded) body = `<div class="panel empty"><strong>선수 명단을 불러오는 중</strong><span>잠시만 기다려 주세요.</span></div>`;
  else if (!ps.length) body = `<div class="panel empty"><strong>아직 등록된 선수가 없어요</strong><span>${state.admin ? "‘등록·측정’에서 선수를 추가하거나, 팀원 가입을 승인하면 카드가 생겨요." : "관리자가 선수를 등록하면 여기에 나타나요."}</span>${state.admin ? '<button class="btn primary" data-act="view" data-v="intake">선수 등록하기</button>' : ""}</div>`;
  else {
    const mine = !state.admin && state.myPid && state.players[state.myPid] ? ps.find(p => p.id === state.myPid) : null;
    body = (mine ? `<div class="pos-group"><h3>내 카드</h3><div class="grid">${cardHtml(mine, w, d)}</div></div>` : "") +
      POS_ORDER.filter(pos => ps.some(p => p.pos === pos && p !== mine)).map(pos => `
      <div class="pos-group"><h3>${POS[pos]} · ${pos}</h3><div class="grid">
      ${ps.filter(p => p.pos === pos && p !== mine).map(p => cardHtml(p, w, d)).join("")}
      </div></div>`).join("");
  }
  return `
  <section class="sec">
    <div class="sec-head"><div><h2>${WEEKS[w].label} · ${esc(WEEKS[w].goal)}</h2>
      <p class="lede">월·목 웨이트 · 수·금 정규 훈련 (전 워밍업, 후 쿨다운) · 화·토 선택 운동 · 일 휴식</p></div></div>
    ${trackHtml(w)}
    ${daysHtml(w, d, x => teamPlan(w, x))}
  </section>
  <div class="callout info"><strong>${longDate(date)} · ${esc(tp.title)}</strong>${dayLine(w, d)}</div>
  <section class="sec">${body}</section>`;
}
function dayLine(w, d) {
  if (w === 0 && d === 0) return "<br>측정·접수 날이에요. 측정 후 남는 시간에 1주차 처방을 가볍게 해요.";
  if (w === 3 && d < 5) return "<br>대회 주예요. 양은 줄이고 무게와 점프 강도는 지켜요. 새로운 운동은 넣지 않아요.";
  if (d === 2 || d === 4) return "<br>18:00–21:00 · 정규 훈련 전 워밍업 15분, 끝나고 쿨다운 10분.";
  if (d === 0 || d === 3) return "<br>웨이트장. 공 터치는 각자 자율이에요.";
  return "";
}
function cardHtml(p, w, d) {
  const priv = canSeePrivate(p.id);
  const t = latest(p.id), f0 = first(p.id);
  const cmj = t && t.cmj != null ? Number(t.cmj) : null;
  const dCmj = cmj != null && f0 && f0 !== t && f0.cmj != null ? (cmj - Number(f0.cmj)) : null;
  const blk = t && t.block != null ? Number(t.block) - NET : null;
  const delta = dCmj == null ? "" : `<small class="${dCmj < 0 ? "neg" : ""}">${dCmj > 0 ? "+" : ""}${dCmj.toFixed(1)}</small>`;
  const plan = priv ? planFor(p, w, d) : null;
  return `<article class="card ${p.id === state.myPid ? "me" : ""}">
    <div class="card-head"><div><div class="nm">${esc(p.name)}</div><div class="small muted">${p.year ? esc(p.year) + " · " : ""}${p.height ? esc(p.height) + "cm" : "키 미입력"}</div></div><span class="chip pos">${esc(p.pos)}</span></div>
    <div class="stats">
      <div class="stat"><div class="k">CMJ</div><div class="v">${cmj != null ? cmj.toFixed(1) : "—"} ${delta}</div></div>
      <div class="stat"><div class="k">네트 위 (블록)</div><div class="v">${blk != null ? (blk >= 0 ? "+" : "") + blk : "—"}</div></div>
      <div class="stat"><div class="k">이날 착지</div><div class="v">${plan ? plan.landings : "—"}</div></div>
    </div>
    ${chipsHtml(flags(p))}
    ${priv ? `<button class="btn link" type="button" data-act="open" data-pid="${esc(p.id)}">${DAYS[d]}요일 처방 보기 →</button>` : ""}
  </article>`;
}
function offlineHtml() {
  return `<div class="panel empty"><strong>팀 데이터에 연결하지 못했어요</strong><span>인터넷 연결을 확인하고 새로고침해 주세요. 계속되면 config.js 의 Supabase 주소와 키를 확인해 주세요.</span></div>`;
}

/* ---------- 화면: 로그인 · 승인 대기 ---------- */
function viewAuth() {
  const login = state.authMode === "login";
  return `<section class="auth">
    <div class="auth-hero">
      <img class="logo logo-light" src="logo.png" alt="서울대학교 배구부 엠블럼" width="131" height="128">
      <img class="logo logo-dark" src="logo-white.png" alt="서울대학교 배구부 엠블럼" width="131" height="128">
      <h2>SNUVT <b>Physical</b></h2>
      <p>서울대학교 배구부 피지컬 트레이닝</p>
    </div>
    <div><h3>${login ? "로그인" : "가입하기"}</h3><p class="small muted">${login ? "관리자 승인 후 로그인할 수 있어요." : "가입 후 내 정보를 입력하면 관리자가 확인하고 승인해요."}</p></div>
    <form class="f panel" id="authForm">
      <label class="fl">이메일<input type="email" id="au-email" autocomplete="email" required></label>
      <label class="fl">비밀번호 (6자 이상)<input type="password" id="au-pw" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required></label>
      <div class="row"><button class="btn primary" type="submit">${login ? "로그인" : "가입하기"}</button>
        <button class="btn link" type="button" data-act="authmode">${login ? "처음이면 가입하기" : "이미 계정이 있으면 로그인"}</button></div>
      ${state.authMsg ? `<p class="msg ${state.authErr ? "err" : ""}">${esc(state.authMsg)}</p>` : ""}
    </form>
  </section>`;
}
function viewPending() {
  if (!state.myPid || state.editingSelf) return viewSelfReg();
  const p = state.selfPlayer || {};
  return `<section class="auth"><div class="panel empty"><strong>관리자 승인을 기다리고 있어요</strong>
    <span>${esc(p.name || "")}${p.pos ? " · " + esc(POS[p.pos] || p.pos) : ""} 정보를 제출했어요. 관리자가 승인하면 이 화면이 내 처방으로 바뀌어요.</span>
    <div class="row" style="justify-content:center"><button class="btn primary" type="button" data-act="refresh">승인됐는지 확인</button><button class="btn" type="button" data-act="editself">제출한 정보 수정</button></div></div></section>`;
}
function viewSelfReg() {
  const p = state.selfPlayer || {}, h = state.selfHealth || {}, pain = h.pain || {};
  const opt = (v, cur, l) => `<option value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${l}</option>`;
  return `<section class="sec narrow">
    <div><h2>내 정보 입력</h2><p class="lede">처방을 내 몸에 맞추는 데 쓰는 정보예요. 제출하면 관리자가 확인하고 승인해요. 승인 전까지는 여기서 다시 고칠 수 있어요.</p></div>
    <form class="f panel" id="selfForm">
      <fieldset><legend>기본 정보</legend>
        <div class="fields">
          <label class="fl">이름<input id="sf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
          <label class="fl">포지션<select id="sf-pos" required><option value="">고르기</option>${POS_ORDER.map(k => opt(k, p.pos, `${POS[k]} (${k})`)).join("")}</select></label>
          <label class="fl">학년<input id="sf-year" maxlength="10" placeholder="예: 3학년" value="${esc(p.year || "")}"></label>
          <label class="fl">키 (cm)<input id="sf-height" type="number" inputmode="decimal" min="140" max="220" step="0.1" value="${esc(p.height ?? "")}"></label>
          <label class="fl">몸무게 (kg)<input id="sf-weight" type="number" inputmode="decimal" min="40" max="150" step="0.1" value="${esc(p.weight ?? "")}"></label>
          <label class="fl">배구 경력 (년)<input id="sf-exp" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="${esc(p.exp ?? "")}"></label>
          <label class="fl">웨이트 경험<select id="sf-wexp" required><option value="">고르기</option>${opt("none", p.weightExp, "없음")}${opt("lt6", p.weightExp, "6개월 미만")}${opt("gte6", p.weightExp, "6개월 이상")}</select></label>
        </div>
      </fieldset>
      <fieldset><legend>부상·통증 <span class="private">나와 관리자만 봐요</span></legend>
        <div class="fields">
          <label class="fl">발목 염좌 (왼쪽, 회)<input id="sf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
          <label class="fl">발목 염좌 (오른쪽, 회)<input id="sf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
          <label class="fl">마지막 염좌 시기<input id="sf-alast" maxlength="30" placeholder="예: 2026년 5월" value="${esc(h.ankleLast || "")}"></label>
          <label class="fl">지금 무릎 통증 (0–10)<input id="sf-knee" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.knee ?? 0)}"></label>
          <label class="fl">지금 어깨 통증 (0–10)<input id="sf-shoulder" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.shoulder ?? 0)}"></label>
          <label class="fl">지금 발목 통증 (0–10)<input id="sf-ankle" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.ankle ?? 0)}"></label>
          <label class="fl">지금 허리 통증 (0–10)<input id="sf-back" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.back ?? 0)}"></label>
          <label class="fl wide">수술 이력·진단받은 부상·그 외 알려줄 것<input id="sf-note" maxlength="200" placeholder="예: 오른쪽 어깨 와순 파열 (2025), 손가락 인대" value="${esc(h.note || "")}"></label>
        </div>
        <p class="small muted">통증 0 = 없음, 10 = 참을 수 없음. 3 이상이면 그 부위의 상황별 처방이 1단계부터 붙고, 관리자가 확인해서 단계를 맞춰요.</p>
        <label class="check"><input type="checkbox" id="sf-knee-hx" ${h.kneeInjury ? "checked" : ""}> 무릎을 다친 적이 있어요</label>
        <label class="check"><input type="checkbox" id="sf-consent" ${h.consent ? "checked" : ""}> 이 정보를 트레이닝 처방 목적으로만 쓰는 데 동의해요</label>
      </fieldset>
      <div class="row"><button class="btn primary" type="submit">${state.myPid ? "수정 내용 제출" : "제출하기"}</button>
        ${state.editingSelf ? '<button class="btn" type="button" data-act="canceledit">취소</button>' : ""}</div>
    </form>
  </section>`;
}

/* ---------- 화면: 팀원 계정 (관리자) ---------- */
function membersHtml() {
  const ps = sortedPlayers();
  const list = state.profiles.slice().sort((a, b) => (a.role === "pending" ? -1 : 0) - (b.role === "pending" ? -1 : 0));
  if (!list.length) return "";
  const roleOpt = (v, cur, l) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`;
  const nameOf = m => (m.player_id && state.players[m.player_id] && state.players[m.player_id].name) || "";
  return `<section class="sec"><div><h3>팀원 계정</h3><p class="small muted">가입한 사람이 낸 정보는 자동으로 명단에 연결돼요. 내용을 확인하고 역할을 ‘선수’로 바꿔 저장하면 승인돼요. ‘삭제’는 계정을 없애요. 승인 대기 계정은 제출한 정보도 함께 지워지고, 승인된 선수는 측정·기록을 남긴 채 계정만 지워져요.</p></div>
    <div class="tw"><table><thead><tr><th>이름 · 이메일</th><th>역할</th><th>연결할 선수</th><th></th></tr></thead><tbody>
    ${list.map(m => `<tr><td>${nameOf(m) ? `<b>${esc(nameOf(m))}</b><br>` : ""}<span class="small muted">${esc(m.email || "")}</span>${m.role === "pending" ? (m.player_id ? ' <span class="chip warn">승인 대기 · 정보 제출함</span>' : ' <span class="chip">정보 미제출</span>') : ""}</td>
      <td><select id="mr-${esc(m.id)}" aria-label="역할">${roleOpt("pending", m.role, "대기")}${roleOpt("player", m.role, "선수")}${roleOpt("coach", m.role, "관리자")}</select></td>
      <td><select id="mp-${esc(m.id)}" aria-label="연결할 선수"><option value="">연결 안 함</option>${ps.map(p => `<option value="${esc(p.id)}" ${p.id === m.player_id ? "selected" : ""}>${esc(p.name)} · ${esc(p.pos)}</option>`).join("")}</select></td>
      <td>${m.id === state.session.user.id ? '<span class="small muted">내 계정</span>' : `<div class="row" style="flex-wrap:nowrap">
        <button class="btn" type="button" data-act="savemember" data-id="${esc(m.id)}">저장</button>
        <button class="btn danger ${state.armed === "member:" + m.id ? "armed" : ""}" type="button" data-act="delmember" data-id="${esc(m.id)}">${state.armed === "member:" + m.id ? "정말 삭제" : "삭제"}</button></div>`}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

/* ---------- 화면: 선수별 처방 ---------- */
function blockHtml(b) {
  const rows = b.items.map(x => `<tr><td>${esc(x.name)}${x.mod ? `<span class="mod">${esc(x.mod)}</span>` : ""}${x.cue ? `<span class="cue">${esc(x.cue)}</span>` : ""}</td><td class="rx">${esc(x.rx ?? "")}</td></tr>`).join("");
  return `<div class="block b-${esc(b.key)}"><div class="tw"><table><thead><tr><th>${esc(b.title)}</th><th>처방</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${b.note ? `<p class="small muted">${esc(b.note).replace(/\n/g, "<br>")}</p>` : ""}</div>`;
}
function viewPlayer() {
  const ps = sortedPlayers();
  if (!ps.length) return viewTeam();
  if (!state.admin) state.pid = state.myPid;
  if (!state.pid || !state.players[state.pid]) state.pid = (state.myPid && state.players[state.myPid]) ? state.myPid : (state.admin ? ps[0].id : null);
  if (!state.pid) return `<div class="panel empty"><strong>계정이 아직 선수 이름과 연결되지 않았어요</strong><span>관리자에게 연결을 요청해 주세요.</span></div>`;
  const p = ps.find(x => x.id === state.pid);
  const w = selWeek(), d = selDay();
  const plan = planFor(p, w, d);
  const date = dateOf(w, d);
  const notes = [...plan.notes];
  if (p.adjust && p.adjust.refer) notes.push("통증이 이어지면 처방을 줄이고 물리치료사·정형외과와 상담해요. 이 시스템은 진단하지 않아요.");
  return `
  <section class="sec">
    <div class="sec-head">
      <div><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2><p class="lede">${POS[p.pos]} · ${WEEKS[w].label} · ${esc(WEEKS[w].goal)}</p></div>
      ${state.admin ? `<label class="fl" style="min-width:180px">선수 선택<select id="pp-select">${ps.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)} · ${esc(x.pos)}</option>`).join("")}</select></label>` : ""}
    </div>
    ${trackHtml(w)}
    ${daysHtml(w, d, x => planFor(p, w, x))}
    ${chipsHtml(flags(p))}
  </section>
  <section class="sec">
    <div class="day-head"><div><h3 class="day-title">${longDate(date)} · ${esc(plan.title)}</h3>
      <p class="small muted">${plan.landings ? `이날 착지 약 ${plan.landings}회 · ` : ""}${esc(plan.kind)}</p></div></div>
    ${notes.length ? `<div class="callout"><ul class="notes">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
    <div class="blocks">${plan.blocks.map(blockHtml).join("")}</div>
  </section>
  ${rehabLadderHtml(p)}
  <section class="two">
    <div class="sec">${testsHtml(p)}</div>
    <div class="sec">${inbodyHtml(p)}</div>
  </section>
  ${logSectionHtml(p, w, d, plan)}`;
}
function rehabLadderHtml(p) {
  const h = state.health[p.id] || {};
  const mods = effectiveModules(p.adjust, h.rehab);
  if (!mods.length) return "";
  return `<section class="sec"><div><h3>상황별 처방 <span class="private">나와 관리자만 봐요</span></h3>
    <p class="small muted">단계는 관리자가 정해요. 각 단계의 ‘다음 단계 조건’을 넘으면 한 단계씩 올려요. 운동 중 통증 3/10 이하, 다음 날 아침 평소로 돌아오면 그대로 진행해요.${mods.some(m => m.inferred) ? " ‘?’ 표시는 자가 보고 통증으로 임시로 붙은 모듈이라, 관리자가 확인해 단계를 정해요." : ""}</p></div>
    ${mods.map(m => {
      const def = REHAB[m.area], note = ((h.rehab || []).find(x => x.area === m.area) || {}).note;
      return `<details class="panel ladder" ${m.stage ? "open" : ""}><summary><b>${esc(def.label)}</b> · 지금 ${m.stage}단계 (${esc(def.stages[m.stage - 1].title)})${m.inferred ? " ?" : ""}${note ? ` <span class="small muted">— ${esc(note)}</span>` : ""}</summary>
        <ol class="stages">${def.stages.map((s, i) => `<li class="${i + 1 === m.stage ? "cur" : i + 1 < m.stage ? "done" : ""}"><b>${i + 1}. ${esc(s.title)}</b>
          <span class="small">${s.items.map(x => esc(x.name) + " " + esc(x.rx)).join(" · ")}</span>
          <span class="small muted">다음 단계 조건: ${esc(s.next)}</span></li>`).join("")}</ol>
        ${def.always ? `<p class="small"><b>항상:</b> ${esc(def.always)}</p>` : ""}</details>`;
    }).join("")}</section>`;
}
function testsHtml(p) {
  const r = runs(p.id);
  if (!r.length) return `<div><h3>측정 기록</h3></div><div class="panel small muted">측정 기록이 아직 없어요. ${state.admin ? "‘등록·측정’에서 10/26 측정값을 넣으면 CMJ 변화와 네트 위 높이가 나와요." : ""}</div>`;
  const cell = v => v == null || v === "" ? "—" : esc(v);
  const above = v => v == null || v === "" ? "—" : ((Number(v) - NET >= 0 ? "+" : "") + (Number(v) - NET));
  const rel = relStrength(latest(p.id), ctxFor(p).weight);
  return `<div><h3>측정 기록</h3>${rel != null ? `<p class="small muted">상대 근력 (스쿼트 5RM ÷ 체중) <b class="num">${rel.toFixed(2)}</b> · 0.8 미만은 기초 근력, 1.2 초과면 컨트라스트·드롭 점프가 열려요.</p>` : ""}</div>
  <div class="tw"><table><thead><tr><th>날짜</th><th>CMJ</th><th>블록 리치</th><th>네트 위</th><th>어프로치</th><th>네트 위</th><th>균형 L/R</th><th>물구나무</th></tr></thead><tbody>
  ${r.slice().reverse().map(t => `<tr><td class="num">${esc(t.date)}</td><td class="num">${cell(t.cmj)}</td><td class="num">${cell(t.block)}</td><td class="num">${above(t.block)}</td><td class="num">${cell(t.approach)}</td><td class="num">${above(t.approach)}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td>${t.hsStage ? "단계 " + esc(t.hsStage) : "—"}${t.hsSec ? " · " + esc(t.hsSec) + "초" : ""}</td></tr>`).join("")}
  </tbody></table></div><p class="small muted">단위 cm. 네트 위 = 리치 − 243cm (남자부 네트).</p>`;
}
const bal = v => v === true ? "통과" : v === false ? "미통과" : "—";

/* ---------- 인바디 (본인·관리자) ---------- */
function inbodyHtml(p) {
  if (!canSeePrivate(p.id)) return "";
  const list = inbodyOf(p.id);
  const canAdd = state.admin || (state.role === "player" && p.id === state.myPid);
  const diff = (a, b, k) => a[k] == null || !b || b[k] == null ? "" : (() => { const v = Number(a[k]) - Number(b[k]); return ` <small class="${v < 0 ? "neg" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}</small>`; })();
  const rows = list.slice().reverse().map((x, i, arr) => {
    const prev = arr[i + 1];
    const legs = x.legL != null || x.legR != null ? `${x.legL ?? "—"} / ${x.legR ?? "—"}` : "—";
    const gap = x.legL && x.legR ? Math.abs(x.legL - x.legR) / Math.max(x.legL, x.legR) * 100 : null;
    return `<tr><td class="num">${esc(x.date)}${x.standardized ? "" : ' <span class="chip" title="아침 공복·운동 전 조건이 아님">조건 다름</span>'}</td>
      <td class="num">${x.weight ?? "—"}${diff(x, prev, "weight")}</td><td class="num">${x.smm ?? "—"}${diff(x, prev, "smm")}</td>
      <td class="num">${x.pbf ?? "—"}</td><td class="num">${legs}${gap != null && gap >= 10 ? ' <span class="chip warn">좌우 10%↑</span>' : ""}</td>
      <td>${canAdd ? `<button class="btn link danger ${state.armed === "inbody:" + x.id ? "armed" : ""}" type="button" data-act="delinbody" data-id="${esc(x.id)}">${state.armed === "inbody:" + x.id ? "정말 삭제" : "삭제"}</button>` : ""}</td></tr>`;
  }).join("");
  return `<div><h3>인바디 <span class="private">나와 관리자만 봐요</span></h3>
    <p class="small muted">아침 공복·운동 전·같은 기기에서 잰 값끼리만 비교해요. 처방의 상대 근력은 가장 최근 인바디 체중을 써요. 대회 블록 중에는 체중 감량 처방을 하지 않아요.</p></div>
    ${rows ? `<div class="tw"><table><thead><tr><th>날짜</th><th>체중</th><th>골격근량</th><th>체지방률</th><th>다리 근육 L/R</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="panel small muted">아직 인바디 기록이 없어요.</div>`}
    ${canAdd ? `<form class="f panel" id="inbodyForm" data-pid="${esc(p.id)}">
      <div class="fields">
        <label class="fl">측정일<input type="date" id="ib-date" value="${iso(today())}" required></label>
        <label class="fl">체중 (kg)<input type="number" id="ib-weight" inputmode="decimal" step="0.1" min="30" max="200" required></label>
        <label class="fl">골격근량 (kg)<input type="number" id="ib-smm" inputmode="decimal" step="0.1" min="10" max="80"></label>
        <label class="fl">체지방량 (kg)<input type="number" id="ib-fat" inputmode="decimal" step="0.1" min="0" max="100"></label>
        <label class="fl">체지방률 (%)<input type="number" id="ib-pbf" inputmode="decimal" step="0.1" min="1" max="60"></label>
        <label class="fl">왼다리 근육량 (kg)<input type="number" id="ib-legl" inputmode="decimal" step="0.01" min="1" max="30"></label>
        <label class="fl">오른다리 근육량 (kg)<input type="number" id="ib-legr" inputmode="decimal" step="0.01" min="1" max="30"></label>
        <label class="fl wide">메모<input id="ib-note" maxlength="100" placeholder="기기·장소 등"></label>
      </div>
      <label class="check"><input type="checkbox" id="ib-std" checked> 아침 공복 · 운동 전 · 화장실 다녀온 뒤 쟀어요</label>
      <div class="row"><button class="btn primary" type="submit">인바디 저장</button><span class="small muted">결과지의 ‘부위별 근육 분석’에서 다리 값을 옮겨 적어요.</span></div>
    </form>` : ""}`;
}

/* ---------- 세션 기록 ---------- */
function logSectionHtml(p, w, d, plan) {
  if (!canSeePrivate(p.id)) return "";
  const canLog = state.admin || (state.role === "player" && p.id === state.myPid);
  const isToday = iso(dateOf(w, d)) === iso(today());
  const tplan = isToday ? plan : planFor(p, weekOf(today()) >= 0 && weekOf(today()) <= 3 ? weekOf(today()) : w, dowMon(today()));
  const defType = tplan.logType, defJumps = tplan.landings || "";
  const entries = (state.logs[p.id] || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  return `<section class="two">
    <div class="sec">
      <div><h3>세션 기록하기</h3><p class="small muted">훈련이 끝나고 30분 안에 체감 강도(RPE)를 남겨요. 세션 RPE = RPE × 시간(분).</p></div>
      ${canLog ? `<form class="f panel" id="logForm" data-pid="${esc(p.id)}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="lg-date" value="${iso(today())}" required></label>
          <label class="fl">종류<select id="lg-type">${Object.entries(LOG_TYPES).map(([k, [l]]) => `<option value="${k}" ${k === defType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="fl">시간 (분)<input type="number" id="lg-min" inputmode="numeric" min="1" max="400" value="${tplan.minutes || LOG_TYPES[defType][1]}" required></label>
          <label class="fl">RPE (0–10)<select id="lg-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 5 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="fl">점프·착지 수<input type="number" id="lg-jumps" inputmode="numeric" min="0" max="2000" value="${defJumps}" placeholder="모르면 비워두기"></label>
          <label class="fl">통증 부위<select id="lg-area"><option value="">없음</option>${Object.entries(AREA_KO).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
          <label class="fl">통증 (0–10)<input type="number" id="lg-pain" inputmode="numeric" min="0" max="10" value="0"></label>
          <label class="fl wide">메모<input type="text" id="lg-note" maxlength="200" placeholder="무게, 컨디션, 손목·손가락 통증 등"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">기록 저장</button><span class="small muted">기록은 본인과 관리자만 볼 수 있어요.</span></div>
      </form>` : `<div class="panel small muted">기록은 본인 이름으로만 남길 수 있어요.</div>`}
    </div>
    <div class="sec">
      <div><h3>최근 기록</h3></div>
      ${entries.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>종류</th><th>RPE×분</th><th>착지</th><th>통증</th><th></th></tr></thead><tbody>
        ${entries.map(e => `<tr><td class="num">${esc(e.date)}</td><td>${esc((LOG_TYPES[e.type] || ["기타"])[0])}</td><td class="num">${esc(e.rpe)}×${esc(e.minutes)} = ${Number(e.rpe) * Number(e.minutes)}</td><td class="num">${e.jumps ?? "—"}</td><td>${e.painArea ? `<span class="chip ${Number(e.pain) >= 3 ? "crit" : ""}">${esc(AREA_KO[e.painArea] || "")} ${esc(e.pain)}</span>` : "—"}</td>
        <td>${!state.admin ? "" : `<button class="btn link danger ${state.armed === "log:" + e._id ? "armed" : ""}" data-act="dellog" data-pid="${esc(p.id)}" data-id="${esc(e._id)}">${state.armed === "log:" + e._id ? "정말 삭제" : "삭제"}</button>`}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="panel small muted">아직 기록이 없어요.</div>`}
    </div>
  </section>`;
}

/* ---------- 화면: 등록·측정 ---------- */
function viewIntake() {
  if (!state.admin) return `<div class="panel empty"><strong>관리자 전용 화면이에요</strong></div>`;
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
      <select id="rh-${a}" aria-label="${esc(REHAB[a].label)} 단계"><option value="">없음</option>${REHAB[a].stages.map((s, i) => `<option value="${i + 1}" ${Number(cur.stage) === i + 1 ? "selected" : ""}>${i + 1}단계 · ${esc(s.title)}</option>`).join("")}</select>
      <input id="rhn-${a}" maxlength="60" placeholder="메모 (예: 오른쪽, 10/20 진단)" value="${esc(cur.note || "")}" aria-label="${esc(REHAB[a].label)} 메모"></div>`;
  }).join("");
  return `<section class="sec"><div><h2>등록·측정</h2><p class="lede">기본 정보, 부상 단계, 측정값을 넣으면 요일별 처방이 자동으로 바뀌어요. 부상·통증·인바디는 관리자와 그 선수 본인만 볼 수 있어요.</p></div></section>
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
            <label class="fl">웨이트 경험<select id="pf-wexp"><option ${opt("none", p.weightExp)}>없음</option><option ${opt("lt6", p.weightExp)}>6개월 미만</option><option ${opt("gte6", p.weightExp)}>6개월 이상</option></select></label>
          </div>
        </fieldset>
        <fieldset><legend>부상·통증 <span class="private">관리자·본인만 열람</span></legend>
          <div class="fields">
            <label class="fl">발목 염좌 (왼쪽, 회)<input id="hf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
            <label class="fl">발목 염좌 (오른쪽, 회)<input id="hf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
            <label class="fl">마지막 염좌 시기<input id="hf-alast" maxlength="30" placeholder="예: 2026년 5월" value="${esc(h.ankleLast || "")}"></label>
            <label class="fl">무릎 통증 (0–10)<input id="hf-knee" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.knee ?? 0)}"></label>
            <label class="fl">어깨 통증 (0–10)<input id="hf-shoulder" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.shoulder ?? 0)}"></label>
            <label class="fl">발목 통증 (0–10)<input id="hf-ankle" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.ankle ?? 0)}"></label>
            <label class="fl">허리 통증 (0–10)<input id="hf-back" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.back ?? 0)}"></label>
            <label class="fl wide">수술 이력·그 외 알아야 할 것<input id="hf-note" maxlength="200" value="${esc(h.note || "")}"></label>
          </div>
          <label class="check"><input type="checkbox" id="hf-knee-hx" ${h.kneeInjury ? "checked" : ""}> 무릎 부상 이력 있음</label>
          <label class="check"><input type="checkbox" id="hf-consent" ${h.consent ? "checked" : ""} required> 선수가 처방 목적의 정보 사용에 동의함</label>
        </fieldset>
        <fieldset><legend>상황별 처방 단계 <span class="private">관리자·본인만 열람</span></legend>
          <p class="small muted">진단은 의료진이 해요. 여기서는 처방 단계만 골라요. 고른 단계의 운동이 그 선수의 요일 처방에 자동으로 붙고, 무릎 1–3단계·발목 1단계는 일반 점프를 막아요. 비워 두면 자가 보고 통증 3 이상인 부위만 1단계로 임시 적용돼요.</p>
          <div class="rh">${rehabRows}</div>
        </fieldset>
        <div class="row"><button class="btn primary" type="submit">${pid ? "저장" : "선수 추가"}</button>
          ${pid ? `<button class="btn danger ${state.armed === "player:" + pid ? "armed" : ""}" type="button" data-act="delplayer" data-pid="${esc(pid)}">${state.armed === "player:" + pid ? "정말 삭제 (기록 포함)" : "선수 삭제"}</button>` : ""}</div>
      </form>
      ${pid ? testFormHtml(pid) : `<div class="panel small muted">선수를 추가하면 측정값을 넣을 수 있어요.</div>`}
    </div>
  </section>`;
}
function testFormHtml(pid) {
  const r = runs(pid);
  return `<form class="f panel" id="testForm" data-pid="${esc(pid)}">
    <div><h3>측정값 추가</h3><p class="small muted">같은 폰·같은 앱·같은 바닥으로 측정해요. 비워둔 칸은 저장하지 않아요. 인바디는 ‘선수별 처방’ 화면 아래에서 넣어요.</p></div>
    <div class="fields">
      <label class="fl">날짜<input type="date" id="tf-date" value="${iso(today())}" required></label>
      <label class="fl">스탠딩 리치 (한 손, cm)<input type="number" id="tf-reach" inputmode="decimal" step="0.5"></label>
      <label class="fl">CMJ (cm)<input type="number" id="tf-cmj" inputmode="decimal" step="0.1"></label>
      <label class="fl">블록 점프 리치 (cm)<input type="number" id="tf-block" inputmode="decimal" step="0.5"></label>
      <label class="fl">어프로치 점프 리치 (cm)<input type="number" id="tf-approach" inputmode="decimal" step="0.5"></label>
      <label class="fl">한 발 서기 왼쪽<select id="tf-balL"><option value="">미측정</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      <label class="fl">한 발 서기 오른쪽<select id="tf-balR"><option value="">미측정</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      <label class="fl">물구나무 단계<select id="tf-hsStage"><option value="">미측정</option><option value="1">1 파이크 버티기</option><option value="2">2 벽 걸어 올라가기</option><option value="3">3 벽 물구나무 버티기</option><option value="4">4 어깨 터치·킥업</option></select></label>
      <label class="fl">물구나무 버티기 (초)<input type="number" id="tf-hsSec" inputmode="numeric" min="0" max="120"></label>
      <label class="fl">스쿼트 5회 무게 (kg)<input type="number" id="tf-squat" inputmode="decimal" step="2.5"></label>
      <label class="fl">RDL 5회 무게 (kg)<input type="number" id="tf-rdl" inputmode="decimal" step="2.5"></label>
      <label class="fl">턱걸이 (회)<input type="number" id="tf-pull" inputmode="numeric" min="0" max="50"></label>
    </div>
    <div class="row"><button class="btn primary" type="submit">측정값 저장</button></div>
    ${r.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>리치</th><th>CMJ</th><th>블록</th><th>어프로치</th><th>균형 L/R</th><th>물구나무</th><th>스쿼트</th><th>RDL</th><th>턱걸이</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${esc(t.date)}</td><td class="num">${t.reach ?? "—"}</td><td class="num">${t.cmj ?? "—"}</td><td class="num">${t.block ?? "—"}</td><td class="num">${t.approach ?? "—"}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td>${t.hsStage ? esc(t.hsStage) : "—"}${t.hsSec ? " · " + esc(t.hsSec) + "초" : ""}</td><td class="num">${t.squat ?? "—"}</td><td class="num">${t.rdl ?? "—"}</td><td class="num">${t.pull ?? "—"}</td>
    <td><button class="btn link danger ${state.armed === "test:" + t.id ? "armed" : ""}" type="button" data-act="deltest" data-pid="${esc(pid)}" data-id="${esc(t.id)}">${state.armed === "test:" + t.id ? "정말 삭제" : "삭제"}</button></td></tr>`).join("")}
    </tbody></table></div>` : ""}
  </form>`;
}

/* ---------- 화면: 훈련 부하 ---------- */
function viewLoad() {
  if (!state.admin) return `<div class="panel empty"><strong>관리자 전용 화면이에요</strong></div>`;
  const ps = sortedPlayers();
  const weeks = [-1, 0, 1, 2, 3];
  const wl = k => k < 0 ? "블록 전" : WEEKS[k].label;
  const rows = ps.map(p => {
    const agg = {};
    for (const e of (state.logs[p.id] || [])) {
      const k = weekOf(parseD(e.date));
      agg[k] = agg[k] || { s: 0, j: 0, n: 0 };
      agg[k].s += (Number(e.rpe) || 0) * (Number(e.minutes) || 0);
      agg[k].j += Number(e.jumps) || 0;
      agg[k].n += 1;
    }
    const cells = weeks.map(k => {
      const a = agg[k], prev = agg[k - 1];
      if (!a) return `<td class="muted">—</td>`;
      const spikeS = prev && prev.s > 0 && a.s >= 2 * prev.s;
      const spikeJ = prev && prev.j > 0 && a.j >= 2 * prev.j;
      return `<td class="num ${spikeS || spikeJ ? "cell-warn" : ""}">${a.s.toLocaleString("ko-KR")} AU<br><span class="small">${a.j}회 · ${a.n}건</span>${spikeS || spikeJ ? '<br><span class="chip warn">전주 2배↑</span>' : ""}</td>`;
    }).join("");
    return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td>${cells}</tr>`;
  }).join("");
  return `<section class="sec"><div><h2>훈련 부하</h2><p class="lede">주간 세션 RPE 합(RPE × 분, AU)과 기록된 착지 수예요. 전주보다 2배 이상 뛴 칸은 ‘주의’로만 표시해요. ACWR 같은 위험 판정은 근거가 부족해 쓰지 않아요.</p></div>
  ${ps.length ? `<div class="tw"><table><thead><tr><th>선수</th>${weeks.map(k => `<th>${wl(k)}${k >= 0 ? `<br><span class="num">${md(monOf(k))}</span>` : ""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="panel empty"><strong>선수를 먼저 등록해 주세요</strong></div>`}
  </section>`;
}

/* ---------- 렌더 ---------- */
function render() {
  header();
  if (state.dirty) return; // 입력 중인 폼은 덮어쓰지 않음
  let html;
  if (state.booting) html = `<div class="panel empty"><strong>불러오는 중</strong></div>`;
  else if (state.offline) html = offlineHtml();
  else if (!state.session) html = viewAuth();
  else if (!state.role || state.role === "pending") html = viewPending();
  else {
    const v = state.view;
    html = v === "player" ? viewPlayer() : v === "intake" ? viewIntake() : v === "load" ? viewLoad() : viewTeam();
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
  if (c === "42501") return "이 작업을 할 권한이 없어요. 관리자에게 요청해 주세요.";
  if (c === "23514") return "입력값이 허용 범위를 벗어났어요. 숫자를 확인해 주세요.";
  return "저장하지 못했어요. 잠시 후 다시 시도해 주세요." + (e && e.message ? ` (${e.message})` : "");
}
const ok = r => { if (r.error) throw r.error; return r.data; };

/* ---------- 이벤트 ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]");
  if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act;
  if (act === "view") return go(b.dataset.v);
  if (act === "week") { state.week = Number(b.dataset.w); state.day = null; state.dirty = false; return render(); }
  if (act === "day") { state.day = Number(b.dataset.d); state.dirty = false; return render(); }
  if (act === "open") { state.pid = b.dataset.pid; return go("player"); }
  if (act === "edit") { state.editPid = b.dataset.pid; state.dirty = false; state.armed = null; return render(); }
  if (act === "authmode") { state.authMode = state.authMode === "login" ? "signup" : "login"; state.authMsg = ""; state.dirty = false; return render(); }
  if (act === "logout") { await sb.auth.signOut(); return; }
  if (act === "refresh") { await loadProfile(); if (state.role === "pending") toast("아직 승인 전이에요."); return; }
  if (act === "editself") { state.editingSelf = true; state.dirty = false; return render(); }
  if (act === "canceledit") { state.editingSelf = false; state.dirty = false; return render(); }
  if (act === "savemember") {
    const id = b.dataset.id;
    const role = document.getElementById("mr-" + id).value;
    const pid = document.getElementById("mp-" + id).value || null;
    try { ok(await sb.from("profiles").update({ role, player_id: pid }).eq("id", id)); toast("팀원 계정을 저장했어요"); }
    catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
  if (act === "delmember") {
    const key = "member:" + b.dataset.id;
    if (state.armed !== key) { state.armed = key; state.dirty = false; return render(); }
    state.armed = null;
    const r = await sb.rpc("remove_member", { target: b.dataset.id });
    if (r.error) toast(r.error.code === "PGRST202" ? "삭제 기능이 아직 데이터베이스에 설치되지 않았어요. remove_member.sql 을 실행해 주세요." : (r.error.code === "42501" ? r.error.message : failMsg(r.error)));
    else toast("계정을 삭제했어요");
    state.dirty = false; return loadAll();
  }
  if (["delplayer", "deltest", "dellog", "delinbody"].includes(act)) {
    const key = act === "delplayer" ? "player:" + b.dataset.pid : act === "deltest" ? "test:" + b.dataset.id : act === "dellog" ? "log:" + b.dataset.id : "inbody:" + b.dataset.id;
    if (state.armed !== key) { state.armed = key; state.dirty = false; return render(); }
    state.armed = null;
    try {
      if (act === "delplayer") {
        ok(await sb.from("players").delete().eq("id", b.dataset.pid)); // 부상·측정·기록도 함께 삭제됨
        state.editPid = null; toast("선수를 삭제했어요");
      } else if (act === "deltest") {
        ok(await sb.from("tests").delete().eq("id", b.dataset.id)); toast("측정값을 삭제했어요");
      } else if (act === "dellog") {
        ok(await sb.from("logs").delete().eq("id", b.dataset.id)); toast("기록을 삭제했어요");
      } else {
        ok(await sb.from("inbody").delete().eq("id", b.dataset.id)); toast("인바디 기록을 삭제했어요");
      }
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return loadAll();
  }
});
document.addEventListener("change", ev => {
  if (ev.target.id === "pp-select") { state.pid = ev.target.value; state.dirty = false; render(); return; }
  if (ev.target.id === "lg-type") {
    const k = ev.target.value, m = document.getElementById("lg-min");
    if (m) m.value = LOG_TYPES[k][1];
  }
});
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
      ankle_l: txt("sf-al"), ankle_r: txt("sf-ar"), ankle_last: txt("sf-alast"),
      knee_injury: document.getElementById("sf-knee-hx").checked,
      pain: { knee: txt("sf-knee"), shoulder: txt("sf-shoulder"), ankle: txt("sf-ankle"), back: txt("sf-back") },
      note: txt("sf-note"), consent: document.getElementById("sf-consent").checked,
    };
    try {
      if (!info.consent) { toast("정보 사용에 동의해야 제출할 수 있어요."); return; }
      const r = await sb.rpc("submit_my_info", { info });
      if (r.error) { toast(r.error.code === "23514" || r.error.code === "42501" ? r.error.message : failMsg(r.error)); return; }
      state.editingSelf = false; state.dirty = false;
      toast("제출했어요. 관리자 승인을 기다려 주세요.");
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
        else if (!r.data.session) { state.authErr = false; state.authMode = "login"; state.authMsg = "확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요."; }
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
      const pain = { knee: num("hf-knee") || 0, shoulder: num("hf-shoulder") || 0, ankle: num("hf-ankle") || 0, back: num("hf-back") || 0 };
      const ankleL = num("hf-al") || 0, ankleR = num("hf-ar") || 0;
      const adjust = {
        plyo: pain.ankle >= 3 ? "hold" : pain.knee >= 3 ? "iso" : null,
        overhead: pain.shoulder >= 3 ? true : null,
        back: pain.back >= 3 ? true : null,
        ankleBal: (ankleL + ankleR) > 0 ? true : null,
        refer: (pain.knee >= 3 || pain.shoulder >= 3 || pain.back >= 3 || pain.ankle >= 3) ? true : null,
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
        player_id: id, ankle_l: ankleL, ankle_r: ankleR, ankle_last: txt("hf-alast") || null,
        knee_injury: document.getElementById("hf-knee-hx").checked, pain, note: txt("hf-note") || null,
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
        bal_l: balv("tf-balL"), bal_r: balv("tf-balR"), hs_stage: st ? Number(st) : null, hs_sec: num("tf-hsSec"),
        squat: num("tf-squat"), rdl: num("tf-rdl"), pull: num("tf-pull"),
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
    } else if (f.id === "logForm") {
      const area = document.getElementById("lg-area").value;
      ok(await sb.from("logs").insert({
        player_id: f.dataset.pid, date: txt("lg-date"), type: document.getElementById("lg-type").value,
        minutes: num("lg-min") || 1, rpe: Number(document.getElementById("lg-rpe").value),
        jumps: num("lg-jumps"), pain_area: area || null, pain: area ? (num("lg-pain") || 0) : 0, note: txt("lg-note") || null,
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
// 승인 대기 중인 사람이 자기가 제출한 정보를 다시 불러올 때
async function loadSelf() {
  const [pl, hl] = await Promise.all([
    sb.from("players").select("*").eq("id", state.myPid).maybeSingle(),
    sb.from("health").select("*").eq("player_id", state.myPid).maybeSingle(),
  ]);
  const r = pl.data, h = hl.data;
  state.selfPlayer = r ? { name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp, weightExp: r.weight_exp } : null;
  state.selfHealth = h ? { ankleL: h.ankle_l, ankleR: h.ankle_r, ankleLast: h.ankle_last, kneeInjury: h.knee_injury, pain: h.pain || {}, note: h.note, consent: h.consent } : null;
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
    ];
    if (state.admin) q.push(sb.from("profiles").select("*").order("created_at"));
    const [st, pl, ts, hl, lg, ib, pr] = await Promise.all(q);
    for (const r of [st, pl, ts, hl, lg]) if (r.error) throw r.error;
    const s = st.data;
    state.settings = s ? { name: s.name, blockStart: s.block_start, start: s.start_date, end: s.end_date } : null;
    state.players = Object.fromEntries(pl.data.map(r => [r.id, {
      name: r.name, pos: r.pos, year: r.year, height: r.height, weight: r.weight, exp: r.exp,
      weightExp: r.weight_exp, adjust: r.adjust || {}, order: r.sort,
    }]));
    const tests = {};
    for (const r of ts.data) {
      (tests[r.player_id] = tests[r.player_id] || { runs: [] }).runs.push({
        id: r.id, date: r.date, reach: r.reach, cmj: r.cmj, block: r.block, approach: r.approach,
        balL: r.bal_l, balR: r.bal_r, hsStage: r.hs_stage, hsSec: r.hs_sec, squat: r.squat, rdl: r.rdl, pull: r.pull,
      });
    }
    state.tests = tests;
    state.health = Object.fromEntries(hl.data.map(r => [r.player_id, {
      ankleL: r.ankle_l, ankleR: r.ankle_r, ankleLast: r.ankle_last, kneeInjury: r.knee_injury,
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
    state.profiles = pr && !pr.error ? pr.data : [];
    state.loaded = true; state.offline = false;
  } catch (e) { state.offline = true; }
  render();
}
function boot() {
  const h = (location.hash || "").replace("#", "");
  if (["team", "player", "intake", "load"].includes(h)) state.view = h;
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
  // 자정이 지나면 날짜·D-day·오늘 요일을 갱신
  let shown = iso(today());
  setInterval(() => { const t = iso(today()); if (t !== shown) { shown = t; state.day = null; if (!state.dirty) render(); else header(); } }, 60 * 1000);
}
if (typeof document !== "undefined" && document.getElementById("main")) boot();
