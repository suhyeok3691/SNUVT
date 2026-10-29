/* ---------- 실시간 경기 분석 (버튼판, Tactic 방식) ----------
   대회 · 교류전 페이지, 전력분석(실시간 경기 분석)에서 씀. 분석 팀(us)은 SNU가 아니어도 됨(team = 팀 이름, 번호로 기록)
   팀(분석 팀 · 상대) → 선수(번호) → 동작 버튼 하나. 랠리 흐름대로 다음 단계 · 팀 · 선수가 저절로 골라짐:
   서브(서브권 팀, 1번 자리) → 리시브(받는 팀, 리베로) → 세트(세터) → 공격(앞줄 OH) → 이어지면 상대 디그(리베로) · 연타/넘김이면 캐치 → 세트 → …
   득점 · 실점이 나면 다음 랠리 서브로. 점수 · 서브권 · 로테는 저절로 (두 팀에서 같은 랠리 끝을 같이 눌러도 점수는 한 번) */
// [동작, 이름, [[결과, 이름, 단축키, 색, 점수(me: 그 팀 · other: 상대 팀)]]]
const LV_BOARD = [
  ["srv", "서브", [["ace", "에이스", "q", "best", "me"], ["err", "범실", "w", "bad", "other"], ["in", "들어감", "e", "ok"]]],
  ["rcv", "리시브", [["3", "3 완벽", "r", "best"], ["2", "2", "t", "good"], ["1", "1", "y", "ok"], ["0", "0 실패", "u", "bad", "other"]]],
  ["set", "세트", [["3", "3 좋음", "a", "best"], ["2", "2", "s", "good"], ["1", "1", "d", "ok"], ["err", "범실", "f", "bad", "other"]]],
  ["atk", "공격", [["kill", "득점", "g", "best", "me"], ["err", "범실", "h", "bad", "other"], ["blk", "막힘", "j", "bad", "other"], ["in", "이어짐", "k", "ok"], ["over", "3단 넘김", "l", "ok"]]],
  ["blk", "블로킹", [["pt", "득점", "z", "best", "me"], ["touch", "원터치", "x", "good"], ["out", "블락아웃", "c", "bad", "other"], ["err", "범실", "v", "bad", "other"]]],
  ["dig", "디그", [["3", "3", "b", "best"], ["2", "2", "n", "good"], ["1", "1", "m", "ok"], ["0", "0 실패", ",", "bad", "other"]]],
  ["cat", "캐치", [["3", "3", "i", "best"], ["2", "2", "o", "good"], ["1", "1", "p", "ok"], ["0", "0 실패", "[", "bad", "other"]]],
  ["err", "파울", [["net", "네트 터치", ";", "bad", "other"], ["line", "라인 침범", "'", "bad", "other"]]],
];
// 단계 이름 (탭 · 줄 강조)
const LV_PHN = { srv: "서브", rcv: "리시브", set: "세트", atk: "공격", dig: "디그", cat: "캐치" };
// 공격 종류(토스 분배): 공격 전에 골라 두면 그 공격에 붙음 (안 골라도 됨)
const LV_ATYPE = [["lo", "레프트 오픈"], ["lq", "레프트 퀵"], ["ro", "라이트 오픈"], ["rq", "라이트 퀵"], ["a", "A퀵"], ["b", "B퀵"], ["mv", "이동"], ["fc", "앞차"], ["bc", "백차"], ["pipe", "파이프"], ["back", "백어택"], ["etc", "그 외"]];
const LV_AT = { ...Object.fromEntries(LV_ATYPE), w4: "4번 윙", o2: "2번 아포짓", q3: "3번 속공" }; // 뒤 셋은 예전 기록
// 포지션별 선택지 (첫 번째 = 기본값). 나머지는 "기타"를 눌러야 보임. 상대 · 포지션 없음 = 전체
const LV_ATPOS = { OH: ["lo", "lq", "fc", "bc", "pipe"], OP: ["ro", "rq", "bc", "back"], MB: ["a", "b", "mv"] };
// 지도 색 묶음
const LV_ATG = { lo: "L", lq: "L", w4: "L", ro: "R", rq: "R", o2: "R", a: "M", b: "M", mv: "M", q3: "M", fc: "C", bc: "C", pipe: "B", back: "B", etc: "E" };
const LV_GRP = [["L", "레프트"], ["R", "라이트"], ["M", "A·B·이동"], ["C", "앞차·백차"], ["B", "파이프·백어택"], ["E", "그 외"]];
const LV_ATKEYS = ["v", "b", "n", "m", ",", ".", "/"];
// 코트 구역 (지키는 팀 쪽에서 네트를 보고: 앞 4·3·2 / 가운데 7·8·9 / 뒤 5·6·1, 각 3m)
const LV_ZROWS = [[4, 3, 2], [7, 8, 9], [5, 6, 1]];
const lvZone = (x, y) => LV_ZROWS[Math.min(2, Math.floor(y / 33.34))][Math.min(2, Math.floor(x / 33.34))];
// 타법: 스파이크 · 팁(페인트) · 밀어넣기(쳐내기) · 연타 (공격 득점 창에선 o · i · p · l)
const LV_SHOT = [["spike", "스파이크", "o"], ["tip", "팁", "i"], ["push", "밀어넣기", "p"], ["soft", "연타", "l"]];
const LV_SH = Object.fromEntries(LV_SHOT.map(x => [x[0], x[1]]));
const LV_SHKEY = Object.fromEntries(LV_SHOT.map(x => [x[2], x[0]]));
const lvShot = r => r.kind === "atk" && r.shot && r.shot !== "spike" ? LV_SH[r.shot] || "" : "";
// 지금 고른 선수 기준 공격 선택지 · 기본값
const lvAtList = () => { const L = lv(), g = lvGame(); if (!g || L.pick == null || L.pick === "") return null; return LV_ATPOS[lvPosOf(g, L.side, L.pick)] || null; };
const lvAtCur = () => lv().atype || (lvAtList() || [])[0] || null;
const lvShCur = () => lv().shot || "spike";
const lvAtVis = () => { const L = lv(), list = lvAtList(), cur = lvAtCur(), all = LV_ATYPE.map(x => x[0]);
  if (!list) return { ks: all, more: false }; const open = L.atMore || (cur && !list.includes(cur));
  return { ks: open ? list.concat(all.filter(k => !list.includes(k))) : list, more: !open }; };
const lvAtChips = (act, kb) => { const { ks, more } = lvAtVis(), cur = lvAtCur();
  return ks.map((k, i) => `<button type="button" class="chip sc-chip ${cur === k ? "on" : ""}" data-act="${act}" data-v="${k}">${LV_AT[k]}${kb && LV_ATKEYS[i] ? `<kbd>${LV_ATKEYS[i]}</kbd>` : ""}</button>`).join("") + (more ? `<button type="button" class="chip sc-chip" data-act="lvatmore">기타</button>` : ""); };
const lvShChips = (act, kb) => LV_SHOT.map(([k, l, key]) => `<button type="button" class="chip sc-chip ${lvShCur() === k ? "on" : ""}" data-act="${act}" data-v="${k}">${l}${kb ? `<kbd>${key}</kbd>` : ""}</button>`).join("");
// 세트(토스): 누가 올렸는지 · 세트 점수 3·2·1. 기본 = 코트에 있는 S(메이킹), 다른 사람이 올리면 이단
function lvCourtSide() { const L = lv(), g = lvGame(); if (!g) return null; const s = lvState(g, L.rallies[g.id] || [], L.set), on = lvCourtOn(g, L.side, s, L.set); return on ? on.vals.filter(v => v !== "" && v != null) : null; }
const lvSetterAuto = () => { const L = lv(), g = lvGame(), vals = lvCourtSide(); if (!vals) return null; const v = vals.find(x => lvPosOf(g, L.side, x) === "S"); return v == null ? null : String(v); };
const lvSetterCur = () => lv().setter !== undefined ? lv().setter : lvSetterAuto();
const lvShortName = (g, side, v) => { if (lvSnu(g, side)) { const p = playerOf(v); return p ? (p.number != null ? String(p.number) : p.name) : "?"; } return String(v); };
const lvSetLbl = r => { if (r.kind === "set") return r.two ? " · 이단" : ""; if (r.kind !== "atk" || (!r.setter && !r.set_q)) return ""; const g = lvGame(), two = r.setter && lvPosOf(g, r.side, r.setter) !== "S";
  if (!two && !r.set_q) return ""; return ` · ${two ? `이단(${esc(lvShortName(g, r.side, r.setter))})` : "세트"}${r.set_q ? " " + r.set_q : ""}`; };
const LV_RES = {}; for (const [k, l, rs] of LV_BOARD) for (const r of rs) LV_RES[k + ":" + r[0]] = { kind: k, kname: l, res: r[0], name: r[1], key: r[2], cls: r[3], pt: r[4] || null };
const LV_KEYS = Object.fromEntries(Object.values(LV_RES).map(x => [x.key, x]));
// 서브 들어감 → 점수 3 · 2 · 1 (예전 프로그램 3/2/1-serve), 안 고르면 그냥 들어감
const LV_SRV = [["s3", "3", "좋음"], ["s2", "2", "보통"], ["s1", "1", "약함"]];
for (const [k, l] of LV_SRV) LV_RES["srv:" + k] = { kind: "srv", kname: "서브", res: k, name: "들어감 " + l, key: "", cls: "ok", pt: null };
// 넘김(3단 처리 · 그냥 넘긴 공): 상대에게 어렵게 3 · 보통 2 · 쉽게 1
const LV_OVR = [["3", "어렵게"], ["2", "보통"], ["1", "쉽게"]];
for (const [k, l] of LV_OVR) LV_RES["ovr:" + k] = { kind: "ovr", kname: "3단 넘김", res: k, name: l, key: "", cls: "ok", pt: null };
// 막힘 → 블록 실점 / 블록 커버(막혔지만 우리 수비가 받아 이어감)
LV_RES["atk:bcov"] = { kind: "atk", kname: "공격", res: "bcov", name: "막힘 커버", key: "", cls: "ok", pt: null };
// 예전 기록 (디그 성공 · 실패)
LV_RES["dig:ok"] = { kind: "dig", kname: "디그", res: "ok", name: "성공", key: "", cls: "good", pt: null };
LV_RES["dig:err"] = { kind: "dig", kname: "디그", res: "err", name: "실패", key: "", cls: "bad", pt: "other" };
const lvOther = s => s === "us" ? "opp" : "us";
// 두 팀에서 같은 랠리 끝을 같이 눌렀을 때 (점수 한 번만)
const LV_PAIR = [["atk:kill", "dig:0"], ["atk:kill", "dig:err"], ["atk:kill", "cat:0"], ["atk:kill", "blk:out"], ["atk:blk", "blk:pt"], ["srv:ace", "rcv:0"]];
const lvPairOf = (a, b) => LV_PAIR.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
// 번호로 기록하는 팀: 선수 = 등번호(7) 또는 이름표(OH1 · MB2 · Li · S2, 교류전처럼 번호를 모를 때)
const lvIdNum = v => /^\d{1,2}$/.test(String(v));
const lvNormId = v => { const t = String(v ?? "").trim(); if (lvIdNum(t)) return Number(t); const m = /^li(\d*)$/i.exec(t); return m ? "Li" + m[1] : t.toUpperCase(); };
const lvOkId = v => /^(\d{1,2}|[A-Za-z]{1,2}\d{0,2})$/.test(String(v).trim());
const lvIdOf = r => r.opp_no != null ? String(r.opp_no) : (r.tag || "");
const lvShowId = v => lvIdNum(v) ? "#" + v : String(v);
const lvTagPos = t => { const m = /^(OH|OP|MB|S|LI|L)\d*$/i.exec(String(t)); return m ? lvNormPos(m[1]) : ""; };
const LV_TAGO = ["S", "OH", "MB", "OP", "L"];
const lvIdSort = (a, b) => { const na = lvIdNum(a), nb = lvIdNum(b); if (na && nb) return a - b; if (na !== nb) return na ? -1 : 1;
  return (LV_TAGO.indexOf(lvTagPos(a)) - LV_TAGO.indexOf(lvTagPos(b))) || String(a).localeCompare(String(b), "en", { numeric: true }); };
const lvWho = r => { const g = lvGame(); if (lvSnu(g, r.side)) { const p = playerOf(r.player_id); return p ? `${pNo(p)}${esc(p.name)}` : "SNU"; } const id = lvIdOf(r); return `${esc(lvTN(g, r.side))}${id ? ` ${esc(lvShowId(id))}` : ""}`; };
const lvLabel = r => { const x = LV_RES[r.kind + ":" + r.res], sh = lvShot(r);
  return `${lvWho(r)} · ${x ? `${x.kind === "err" ? "" : x.kname + " "}${x.name}` : esc(r.kind || "")}${r.atype ? ` · ${LV_AT[r.atype] || r.atype}` : ""}${sh ? ` · ${sh}` : ""}${lvSetLbl(r)}${r.miss ? ` · ${r.miss === "set" ? "토스 미스" : "공격 미스"}` : ""}${r.zone ? ` → ${r.zone}구역` : ""}`; };
const lv = () => state.live || (state.live = { games: {}, rallies: {}, open: null, set: 1, scope: "set", side: "us", pick: null, atype: null, shot: null, extra: {} });
const lvCan = () => can("analysis") || can("schedule");
const lvGame = () => { const L = lv(); for (const l of Object.values(L.games)) { const g = (l || []).find(x => x.id === L.open); if (g) return g; } return null; };
const lvView = () => state.view === "cup" || state.view === "fr" || (state.view === "scout" && sc().track === "live");
// 분석 팀(us) · 상대 팀(opp). team이 비어 있으면 분석 팀 = SNU(명단 선수로 고름), 아니면 두 팀 다 번호로
const lvTA = g => (g && g.team) || "SNU";
const lvTB = g => (g && g.opponent) || "상대";
const lvTN = (g, side) => side === "us" ? lvTA(g) : lvTB(g);
const lvSnu = (g, side) => side === "us" && !(g && g.team);
// 교류전 상대: 명단을 안 넣었으면 이름표로 시작 (OH1 · OH2 · MB1 · MB2 · OP · S · Li)
const LV_FR_ROS = [["S", "S"], ["OH1", "OH"], ["OH2", "OH"], ["MB1", "MB"], ["MB2", "MB"], ["OP", "OP"], ["Li", "L"]].map(([no, pos]) => ({ no, pos }));
const lvRos = (g, side) => { const r = ((g && g.roster) || {})[side]; if (r) return r; return g && side === "opp" && g.ref_kind === "friendly" ? LV_FR_ROS : []; }; // [{no, pos}]
const lvNos = (g, side) => [...new Set([...(lv().rallies[g.id] || []).filter(r => r.side === side).map(lvIdOf).filter(Boolean), ...lvRos(g, side).map(x => String(x.no))])].sort(lvIdSort);
const lvPosOf = (g, side, v) => lvSnu(g, side) ? lvNormPos((playerOf(v) || {}).pos) : lvNormPos((lvRos(g, side).find(x => String(x.no) === String(v)) || {}).pos) || lvTagPos(v);
const LV_POS = ["OH", "OP", "MB", "S", "L"];
// 번호 · 포지션 저장 (있으면 포지션만 바꿈)
function lvRosAdd(g, side, no, pos) {
  const ros = { us: [...lvRos(g, "us")], opp: [...lvRos(g, "opp")] }, l = ros[side], i = l.findIndex(x => String(x.no) === String(no));
  if (i >= 0) { if (!pos || l[i].pos === pos) return; l[i] = { no, pos }; } else l.push({ no, pos: pos || "" });
  g.roster = ros;
  sb.from("live_games").update({ roster: ros }).eq("id", g.id).then(r => { if (r.error) toast(failMsg(r.error)); });
}
// 코트 6명 (명단 · 로테 창에서 넣음): sets[n].lu[side] = { rot: 넣을 때 로테, slots: 자리 1~6 }. 로테가 돌면 같이 돎
// 저장한 코트가 없으면: SNU(대회 · 교류전)는 그 세트 출전(교류전) 또는 주전으로 자동 배치, 교류전 상대는 이름표 기본 배치
const lvLu = (g, side, setNo) => ((((g.sets || {})[setNo] || {}).lu || {})[side]) || lvDefLu(g, side, setNo);
function lvDefLu(g, side, setNo) {
  if (!g) return null;
  if (side === "opp" && g.ref_kind === "friendly" && !(g.roster || {}).opp) return { rot: 1, slots: ["S", "OH1", "MB1", "OP", "OH2", "MB2"], lib: "Li" };
  if (!lvSnu(g, side)) return null;
  const ps = lvSnuPool(g, setNo), court = ps.filter(p => lvNormPos(p.pos) !== "L").map(p => ({ v: p.id, pos: lvNormPos(p.pos) }));
  if (court.length < 6) return null;
  const lib = ps.find(p => lvNormPos(p.pos) === "L");
  return { rot: 1, slots: lvAutoArrange(court).map(x => x.v), lib: lib ? lib.id : "" };
}
// SNU 자동 배치 후보 (앞에 있을수록 먼저): 그 세트 출전(교류전) → 주전 → 엔트리 → 나머지 부원. 포지션은 명단 포지션
function lvSnuPool(g, setNo) {
  const kind = g.ref_kind, id = g.ref_id, cup = kind === "friendly" || kind === "event";
  const sl = kind === "friendly" ? (cupState().lineups[kind + ":" + id] || {})[setNo] : null;
  const ids = [...((sl && sl.members) || []), ...(cup ? [...startersOf(kind, id), ...entryOf(kind, id)] : []), ...sortedPlayers().map(p => p.id)];
  return [...new Set(ids)].map(playerOf).filter(p => p && !p.military);
}
function lvCourtNow(g, side, s, setNo) {
  const lu = lvLu(g, side, setNo); if (!lu || !(lu.slots || []).some(x => x !== "" && x != null)) return null;
  const k = (((side === "us" ? s.rot : s.orot) - (lu.rot || 1)) % 6 + 6) % 6;
  return [1, 2, 3, 4, 5, 6].map(z => lu.slots[((z - 1) + k) % 6]);
}
// 리베로 (배구 규칙): MB가 뒷줄(5 · 6, 그 팀이 서브권이 없을 때는 1도)에 오면 리베로가 대신 섬. MB가 1번에서 서브할 때는 MB 그대로, 서브권을 잃으면 리베로가 들어오고 MB가 앞줄(4)로 올라가면 다시 MB
const lvLib = (g, side, setNo) => { const lu = lvLu(g, side, setNo); if (!lu) return null; if (lu.lib !== undefined) return lu.lib === "" ? null : lu.lib;
  if (lvSnu(g, side)) return null; const x = lvRos(g, side).find(r => lvNormPos(r.pos) === "L"); return x ? String(x.no) : null; };
function lvCourtOn(g, side, s, setNo) {
  const base = lvCourtNow(g, side, s, setNo); if (!base) return null;
  const lib = lvLib(g, side, setNo), libZ = [];
  if (lib == null || base.some(v => String(v) === String(lib))) return { vals: base, libZ };
  const vals = base.map((v, i) => { const z = i + 1; if (lvPosOf(g, side, v) === "MB" && (z === 5 || z === 6 || (z === 1 && s.serve !== side))) { libZ.push(z); return lib; } return v; });
  return { vals, libZ };
}
const lvPosSel = (cls, cur) => `<select class="${cls}" aria-label="포지션"><option value="">포지션</option>${LV_POS.map(p => `<option ${p === cur ? "selected" : ""}>${p}</option>`).join("")}</select>`;
const lvRosRow = x => `<div class="lvr-row"><input class="lvr-n" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="번호 · OH1" value="${x ? esc(x.no) : ""}" aria-label="번호">${lvPosSel("lvr-p", x ? x.pos : "")}<button type="button" class="btn small danger" data-act="lvrosdel" aria-label="지우기">✕</button></div>`;
// 명단 · 로테 창: 명단(번호 + 포지션, 줄마다 지우기) → "자동 배치"로 S 1번 서브 자리 기준 기본 로테(S · OH · MB · OP · OH · MB) → OH끼리 · MB끼리 바꾸기, 한 칸씩 돌리기, 칸 직접 고치기
// 세트 처음(기록 없음)에 저장하면 S 자리로 로테 번호도 맞춤 (S 1번 = R1, 6번 = R2, 5번 = R3, 4번 = R4, 3번 = R5, 2번 = R6)
const LV_SROT = { 1: 1, 6: 2, 5: 3, 4: 4, 3: 5, 2: 6 };
const lvRefKey = g => [g.ref_kind, g.ref_id];
const lvNormPos = p => { p = String(p || "").toUpperCase(); return p === "LI" ? "L" : p; };
function lvRosSheet() {
  const L = lv(), g = lvGame(), side = L.side, snu = lvSnu(g, side), s = lvState(g, L.rallies[g.id] || [], L.set), now = lvCourtNow(g, side, s, L.set) || [], el = document.getElementById("sheet");
  const ros = lvRos(g, side), lib = lvLib(g, side, L.set) ?? (snu ? (sortedPlayers().find(p => !p.military && lvNormPos(p.pos) === "L" && (startersOf(...lvRefKey(g)).has(p.id) || entryOf(...lvRefKey(g)).has(p.id))) || {}).id : null);
  const cell = z => { const v = now[z - 1]; return `<div class="ct-lu-c"><span class="ct-lu-n">${z}${z === 1 ? " 서브" : ""} <b class="lvr-pos" data-z="${z}"></b></span>${snu
    ? `<select class="lvr-c" data-z="${z}" aria-label="${z}번 자리"><option value="">선택</option>${sortedPlayers().filter(p => !p.military).map(p => `<option value="${esc(p.id)}" data-pos="${esc(lvNormPos(p.pos))}" ${v === p.id ? "selected" : ""}>${esc(pNo(p) + p.name)} · ${esc(lvNormPos(p.pos))}</option>`).join("")}</select>`
    : `<input class="lvr-c" data-z="${z}" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="번호" value="${esc(v ?? "")}" aria-label="${z}번 자리">`}</div>`; };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${esc(lvTN(g, side))} 명단 · 로테</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="lvRosForm">
      ${snu ? "" : `<h4>명단</h4><div class="lvr-list" id="lvrList">${ros.map(lvRosRow).join("")}${lvRosRow(null)}</div><div class="sc-row">${["OH", "MB", "OP", "S", "Li"].map(t => `<button type="button" class="btn small" data-act="lvrostag" data-v="${t}">+ ${t}</button>`).join("")}</div>`}
      <h4>${L.set}세트 코트 <span class="small muted" id="lvrInfo"></span></h4>
      <div class="sc-row"><button type="button" class="btn small primary" data-act="lvauto">자동 배치</button><button type="button" class="btn small" data-act="lvswap" data-v="OH">OH 바꾸기</button><button type="button" class="btn small" data-act="lvswap" data-v="MB">MB 바꾸기</button><button type="button" class="btn small" data-act="lvturn" data-d="1" aria-label="로테 한 칸">↻</button><button type="button" class="btn small" data-act="lvturn" data-d="-1" aria-label="반대로 한 칸">↺</button></div>
      <div class="ct-lu"><span class="ct-netl">네트</span>${[4, 3, 2, 5, 6, 1].map(cell).join("")}</div>
      <div class="fields"><label class="fl">리베로${snu
        ? `<select id="lvrLib"><option value="">없음</option>${sortedPlayers().filter(p => !p.military).sort((a, b) => (lvNormPos(b.pos) === "L") - (lvNormPos(a.pos) === "L")).map(p => `<option value="${esc(p.id)}" ${String(lib ?? "") === String(p.id) ? "selected" : ""}>${esc(pNo(p) + p.name)}${lvNormPos(p.pos) === "L" ? " · L" : ""}</option>`).join("")}</select>`
        : `<input id="lvrLib" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="번호 · Li" value="${esc(lib ?? "")}">`}</label></div>
      <div class="row"><button class="btn primary" type="submit">저장</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
  const f = document.getElementById("lvRosForm");
  f.addEventListener("input", e => lvRosInfo(e)); f.addEventListener("change", e => lvRosInfo(e));
  lvRosInfo();
}
// 창 안: 명단 포지션 · 코트 읽기/쓰기
const lvRosMap = () => { const m = {}; document.querySelectorAll("#lvRosForm .lvr-row").forEach(r => { const n = r.querySelector(".lvr-n").value.trim(); if (n !== "") m[String(lvNormId(n))] = r.querySelector(".lvr-p").value || lvTagPos(n); }); return m; };
function lvCourtRead() {
  const m = lvRosMap();
  return [1, 2, 3, 4, 5, 6].map(z => { const x = document.querySelector(`#lvRosForm .lvr-c[data-z="${z}"]`), v = x ? x.value : "";
    const pos = v === "" ? "" : x.tagName === "SELECT" ? (x.selectedOptions[0] || {}).dataset.pos || "" : m[String(lvNormId(v))] || lvTagPos(v);
    return { v, pos: lvNormPos(pos) }; });
}
function lvCourtWrite(arr) { arr.forEach((x, i) => { const el = document.querySelector(`#lvRosForm .lvr-c[data-z="${i + 1}"]`); if (el) el.value = x.v; }); lvRosInfo(); }
function lvRosInfo(ev) {
  const le = document.getElementById("lvrLib");
  if (le && ev && ev.target === le) le.dataset.touched = "1";
  if (ev && ev.target && ev.target.classList.contains("lvr-n")) { const ps = ev.target.parentNode.querySelector(".lvr-p"), tp = lvTagPos(ev.target.value); if (ps && tp && !ps.value) ps.value = tp; } // OH3 → OH
  { const l = document.getElementById("lvrList"); if (l) { const rows = l.querySelectorAll(".lvr-row"), last = rows[rows.length - 1]; if (!last || last.querySelector(".lvr-n").value.trim() !== "") l.insertAdjacentHTML("beforeend", lvRosRow(null)); } } // 마지막 줄에 쓰면 빈 줄이 저절로
  if (le && le.tagName === "INPUT" && !le.dataset.touched && le.value === "") { const m = lvRosMap(), n = Object.keys(m).find(k => lvNormPos(m[k]) === "L"); if (n != null) le.value = n; } // 명단에 L이 있으면 리베로 칸에 저절로
  const arr = lvCourtRead(), sz = arr.findIndex(x => x.pos === "S") + 1;
  arr.forEach((x, i) => { const b = document.querySelector(`#lvRosForm .lvr-pos[data-z="${i + 1}"]`); if (b) b.textContent = x.pos; });
  const el = document.getElementById("lvrInfo"); if (el) el.textContent = sz ? `S ${sz}번 자리 · R${LV_SROT[sz]}` : "";
}
// 기본 로테: 1 S · 2 OH · 3 MB · 4 OP · 5 OH · 6 MB (모자라면 남는 선수로 채움)
function lvAutoArrange(list) {
  const pool = list.filter(x => x.v !== "" && x.pos !== "L"), take = pos => { const i = pool.findIndex(x => x.pos === pos); return i >= 0 ? pool.splice(i, 1)[0] : null; };
  const want = ["S", "OH", "MB", "OP", "OH", "MB"], out = want.map(take);
  return out.map(x => x || pool.shift() || { v: "", pos: "" });
}
function lvRosAuto() {
  let cur = lvCourtRead();
  const L = lv(), g = lvGame();
  if (lvSnu(g, L.side)) { // 우리 팀: 명단 포지션으로 자동으로 골라서 배치
    const pool = lvSnuPool(g, L.set), have = new Set(cur.filter(x => x.v !== "").map(x => x.v));
    if (have.size < 6) cur = [...cur.filter(x => x.v !== ""), ...pool.filter(p => !have.has(p.id) && lvNormPos(p.pos) !== "L").map(p => ({ v: p.id, pos: lvNormPos(p.pos) }))];
    const out = lvAutoArrange(cur); lvCourtWrite(out);
    const le = document.getElementById("lvrLib"), lib = pool.find(p => lvNormPos(p.pos) === "L" && !out.some(x => x.v === p.id));
    if (le && !le.value && lib) le.value = lib.id;
    return;
  }
  if (cur.filter(x => x.v !== "").length < 6) { // 코트가 비었으면 명단에서 고름
    const m = lvRosMap(), have = new Set(cur.filter(x => x.v !== "").map(x => String(x.v)));
    const extra = Object.entries(m).filter(([n]) => !have.has(n)).map(([n, p]) => ({ v: n, pos: lvNormPos(p) }));
    cur = [...cur.filter(x => x.v !== ""), ...extra];
  }
  lvCourtWrite(lvAutoArrange(cur));
}
function lvRosSwap(pos) {
  const arr = lvCourtRead(), ix = arr.map((x, i) => x.pos === pos ? i : -1).filter(i => i >= 0);
  if (ix.length < 2) return toast(`코트에 ${pos}가 두 명 있어야 해요`);
  [arr[ix[0]], arr[ix[1]]] = [arr[ix[1]], arr[ix[0]]]; lvCourtWrite(arr);
}
// 한 칸 돌리기 (d = 1: 로테 방향, 2번 → 1번)
function lvRosTurn(d) { const a = lvCourtRead(); lvCourtWrite(a.map((x, i) => a[((i + d) % 6 + 6) % 6])); }
// 교체: 나감(지금 코트, 리베로 포함) · 들어옴(벤치 또는 새 번호 · 이름표) → 이 세트 코트를 바꿔 저장 (로테는 그대로)
function lvSubSheet() {
  const L = lv(), g = lvGame(), side = L.side, snu = lvSnu(g, side), s = lvState(g, L.rallies[g.id] || [], L.set), on6 = lvCourtOn(g, side, s, L.set), el = document.getElementById("sheet");
  if (!on6) return lvRosSheet();
  const c = L.sub || (L.sub = { out: null, inn: null }), vals = on6.vals, ne0 = document.getElementById("lvSubNew"); if (ne0) c.typed = ne0.value;
  const nm = v => { if (snu) { const p = playerOf(v); return p ? `${pNo(p)}${p.name}` : "?"; } return lvShowId(v); };
  const outs = [4, 3, 2, 5, 6, 1].map(z => `<button type="button" class="ct-sb ${c.out === z ? "on" : ""}" data-act="lvsubout" data-v="${z}"><i>${z}</i><b>${esc(nm(vals[z - 1]))}</b><small>${on6.libZ.includes(z) && !lvTagPos(vals[z - 1]) ? "L" : lvTagPos(vals[z - 1]) ? "" : esc(lvPosOf(g, side, vals[z - 1]))}</small></button>`).join("");
  const bench = (snu ? lvSnuPool(g, L.set).map(p => p.id) : lvNos(g, side)).filter(v => !vals.some(x => String(x) === String(v)));
  const ins = bench.map(v => `<button type="button" class="ct-sb ${String(c.inn) === String(v) ? "on" : ""}" data-act="lvsubin" data-v="${esc(v)}"><b>${esc(nm(v))}</b><small>${lvTagPos(v) ? "" : esc(lvPosOf(g, side, v))}</small></button>`).join("");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${esc(lvTN(g, side))} 교체</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="ct-subg"><div><p class="sc-k">나감</p><div class="ct-subl out">${outs}</div></div><div><p class="sc-k">들어옴</p><div class="ct-subl">${snu ? "" : `<input id="lvSubNew" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="새 번호 · OH3" value="${esc(c.typed || "")}">`}${ins || ""}</div></div></div>
    <div class="row"><button class="btn primary" type="button" data-act="lvsubok">교체</button></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function lvSubSave() {
  const L = lv(), g = lvGame(), side = L.side, snu = lvSnu(g, side), s = lvState(g, L.rallies[g.id] || [], L.set), on6 = lvCourtOn(g, side, s, L.set), c = L.sub || {};
  const ne = document.getElementById("lvSubNew"), typed = ne && ne.value.trim();
  if (typed && !lvOkId(typed)) return toast("번호는 숫자, 이름표는 OH3 · Li2 처럼 넣어 주세요");
  const inn = typed ? lvNormId(typed) : c.inn;
  if (!c.out) return toast("나갈 선수를 골라 주세요");
  if (inn == null || inn === "") return toast("들어올 선수를 골라 주세요");
  if (on6.vals.some(x => String(x) === String(inn))) return toast("이미 코트에 있어요");
  const lu0 = lvLu(g, side, L.set), lu = { rot: lu0.rot || 1, slots: [...lu0.slots], lib: lu0.lib === undefined ? (lvLib(g, side, L.set) ?? "") : lu0.lib };
  if (on6.libZ.includes(c.out)) lu.lib = inn; // 리베로 교체
  else { const k = (((side === "us" ? s.rot : s.orot) - lu.rot) % 6 + 6) % 6; lu.slots[((c.out - 1) + k) % 6] = inn; }
  const sets = { ...(g.sets || {}) }, st = { ...(sets[L.set] || {}) }; st.lu = { ...(st.lu || {}), [side]: lu }; sets[L.set] = st;
  const roster = { us: [...lvRos(g, "us")], opp: [...lvRos(g, "opp")] };
  if (!snu && !roster[side].some(x => String(x.no) === String(inn))) roster[side].push({ no: inn, pos: lvTagPos(inn) });
  try { ok(await sb.from("live_games").update({ roster, sets }).eq("id", g.id)); } catch (e) { toast(failMsg(e)); return; }
  g.roster = roster; g.sets = sets; L.sub = null; closeSheet(); toast("교체했어요"); state.dirty = false; render();
}
async function lvRosSave(f) {
  const L = lv(), g = lvGame(), side = L.side, snu = lvSnu(g, side), s = lvState(g, L.rallies[g.id] || [], L.set);
  const arr = lvCourtRead(), slots = arr.map(x => x.v === "" ? "" : snu ? x.v : lvNormId(x.v));
  if (!snu && arr.some(x => x.v !== "" && !lvOkId(x.v))) { toast("번호는 숫자, 이름표는 OH1 · Li 처럼 넣어 주세요"); return; }
  const filled = slots.filter(x => x !== "");
  if (filled.length && filled.length < 6) { toast("코트 6자리를 다 넣거나 다 비워 주세요"); return; }
  if (new Set(filled.map(String)).size !== filled.length) { toast("코트에 같은 선수가 두 번 있어요"); return; }
  const roster = { us: [...lvRos(g, "us")], opp: [...lvRos(g, "opp")] };
  if (!snu) {
    const list = [], add = (raw, pos) => { if (!lvOkId(raw)) return; const no = lvNormId(raw), i = list.findIndex(x => String(x.no) === String(no)); pos = pos || lvTagPos(no); if (i >= 0) { if (pos) list[i].pos = pos; } else list.push({ no, pos: pos || "" }); };
    f.querySelectorAll(".lvr-row").forEach(r => { const n = r.querySelector(".lvr-n").value.trim(); if (n !== "") add(n, r.querySelector(".lvr-p").value); });
    slots.forEach(n => { if (n !== "") add(n, ""); });
    { const le = document.getElementById("lvrLib"); if (le && le.value.trim() !== "") add(le.value.trim(), "L"); }
    roster[side] = list.sort((a, b) => lvIdSort(String(a.no), String(b.no)));
  }
  const sets = { ...(g.sets || {}) }, st = { ...(sets[L.set] || {}) }, lu = { ...(st.lu || {}) }, rk = side === "us" ? "rot" : "orot";
  const sz = arr.findIndex(x => x.pos === "S") + 1, fresh = !s.list.length;
  if (filled.length && fresh && sz) st[rk] = LV_SROT[sz]; // 세트 처음이면 S 자리로 로테 번호
  const le = document.getElementById("lvrLib"), lib = !le || le.value.trim() === "" ? "" : snu ? le.value : lvNormId(le.value);
  if (lib !== "" && filled.some(x => String(x) === String(lib))) { toast("리베로는 코트 6명과 다른 선수로 넣어 주세요"); return; }
  if (filled.length) lu[side] = { rot: fresh && sz ? LV_SROT[sz] : (side === "us" ? s.rot : s.orot), slots, lib }; else delete lu[side];
  st.lu = lu; sets[L.set] = st;
  try { ok(await sb.from("live_games").update({ roster, sets }).eq("id", g.id)); } catch (e) { toast(failMsg(e)); return; }
  g.roster = roster; g.sets = sets; closeSheet(); state.dirty = false; render();
}
const lvRefOf = g => g.ref_kind === "scout" ? { kind: "scout", id: "-", name: "목록" } : (cupItems().find(y => y.kind === g.ref_kind && String(y.id) === String(g.ref_id)) || { kind: g.ref_kind, id: g.ref_id, name: "목록" });
// 세트 하나 다시 따라가기: 점수 · 서브권 · 우리 로테 · 연속 득실
function lvState(g, rs, setNo) {
  const st = (g.sets || {})[setNo] || {}, s = { rot: st.rot || 1, orot: st.orot || 1, serve: st.serve || "us", us: 0, op: 0, run: 0, list: [], last: null, phase: "start" };
  for (const r of rs) {
    if (r.set_no !== setNo || !r.kind) continue; s.list.push(r);
    s.phase = r.point ? "start" : r.kind === "srv" ? "served" : "rally"; // 랠리 단계: 처음(서브 전) → 서브 들어감 → 랠리
    r._sit = s.us > s.op ? "lead" : s.us < s.op ? "trail" : "tie"; // 점수 상황 (우리 기준, 이 플레이 전)
    r._orot = s.orot;
    if (r.kind === "srv") s.serve = r.side || "us"; else if (r.kind === "rcv") s.serve = lvOther(r.side || "us");
    if (r.point === "us") { s.us++; if (s.serve === "opp") s.rot = s.rot % 6 + 1; s.serve = "us"; s.run = s.run > 0 ? s.run + 1 : 1; s.last = r; }
    else if (r.point === "opp") { s.op++; if (s.serve === "us") s.orot = s.orot % 6 + 1; s.serve = "opp"; s.run = s.run < 0 ? s.run - 1 : -1; s.last = r; }
  }
  return s;
}
const lvEnd = (s, setNo) => { const t = setNo === 5 ? 15 : 25; return Math.max(s.us, s.op) >= t && Math.abs(s.us - s.op) >= 2 ? (s.us > s.op ? "us" : "opp") : null; };
async function lvLoadGames(x) {
  const L = lv(), key = x.kind + ":" + x.id; L.games[key] = L.games[key] || null;
  try { const r = await sb.from("live_games").select("*").eq("ref_kind", x.kind).eq("ref_id", String(x.id)).order("created_at"); L.games[key] = r.data || []; }
  catch (e) { L.games[key] = []; }
  if (lvView()) { state.dirty = false; render(); }
}
// 전력분석: 모든 실시간 경기 (대회 · 교류전에서 만든 것까지)
async function lvLoadAll() {
  const L = lv(); L.games["scout:all"] = L.games["scout:all"] || null;
  try { const r = await sb.from("live_games").select("*").order("created_at", { ascending: false }); L.games["scout:all"] = r.data || []; }
  catch (e) { L.games["scout:all"] = []; }
  if (state.view === "scout") { state.dirty = false; render(); }
}
async function lvLoadRallies(gid, quiet) {
  const L = lv();
  try {
    const r = await sb.from("live_rallies").select("*").eq("game_id", gid).order("created_at"); if (r.error) throw r.error;
    const ids = new Set((r.data || []).map(x => x.id)), pend = (L.rallies[gid] || []).filter(x => x._pending && !ids.has(x.id));
    L.rallies[gid] = [...(r.data || []), ...pend];
  } catch (e) { L.rallies[gid] = L.rallies[gid] || []; }
  if (!quiet || lvView() && L.open === gid && document.getElementById("sheet").hidden) { state.dirty = false; render(); }
}
// 보는 사람도 바로 보이게: 경기를 열어 두면 Supabase Realtime으로 다른 사람 기록이 오자마자 다시 불러옴 (안 되면 6초마다)
const lvRt = { ch: null, gid: null, ok: false, t: null, last: 0 };
function lvSub(gid) {
  if (lvRt.gid === gid || !sb || !sb.channel) return;
  lvUnsub(); lvRt.gid = gid;
  const kick = () => { clearTimeout(lvRt.t); lvRt.t = setTimeout(() => { const L = lv(); if (L.open === gid) { lvRt.last = Date.now(); lvLoadRallies(gid, true); } }, 200); };
  lvRt.ch = sb.channel("lv-" + gid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_rallies", filter: `game_id=eq.${gid}` }, p => { const l = lv().rallies[gid]; if (p.new && !(l || []).some(x => x.id === p.new.id)) kick(); })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "live_rallies" }, p => { const l = lv().rallies[gid]; if (p.old && (l || []).some(x => x.id === p.old.id)) kick(); })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_games", filter: `id=eq.${gid}` }, p => { const g = lvGame(); if (g && g.id === gid && p.new) { Object.assign(g, { sets: p.new.sets, roster: p.new.roster, team: p.new.team, opponent: p.new.opponent, label: p.new.label }); if (document.getElementById("sheet").hidden && lvView()) { state.dirty = false; render(); } } })
    .subscribe(st => { lvRt.ok = st === "SUBSCRIBED"; if (lvRt.ok) kick(); });
}
function lvUnsub() { if (lvRt.ch) { try { sb.removeChannel(lvRt.ch); } catch (e) {} } lvRt.ch = null; lvRt.gid = null; lvRt.ok = false; }
setInterval(() => { const L = state.live; if (!L || !L.open || !lvView()) { if (lvRt.ch) lvUnsub(); return; }
  if (document.visibilityState !== "visible" || lvQ.busy) return;
  if (lvRt.ok && Date.now() - lvRt.last < 30000) return; // 실시간이 붙어 있으면 30초마다만 맞춰 봄
  lvRt.last = Date.now(); lvLoadRallies(L.open, true); }, 6000);
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
      const it = lvQ.list[0], row = { ...it }; if (String(row.id).startsWith("tmp")) delete row.id; delete row._pending; delete row.created_at;
      let r = await sb.from("live_rallies").insert(row).select("id,created_at").maybeSingle();
      if (r.error && r.error.code === "23505" && row.id) r = { data: { id: row.id, created_at: it.created_at }, error: null }; // 끊겼다 다시 보낸 것: 이미 들어가 있음
      if (r.error) { if (!r.error.code || /fetch|network|JWT/i.test(r.error.message || "")) { setTimeout(lvFlush, 4000); break; } toast(failMsg(r.error)); }
      const l = lv().rallies[it.game_id] || [], loc = l.find(x => x.id === it.id);
      if (loc) { if (r.error) lv().rallies[it.game_id] = l.filter(x => x !== loc); else { loc.id = r.data.id; loc.created_at = r.data.created_at; delete loc._pending; } }
      lvQ.list.shift(); lvQSave();
    }
  } finally { lvQ.busy = false; }
  if (lvView() && document.getElementById("sheet").hidden) { state.dirty = false; render(); }
}
window.addEventListener("online", () => lvFlush());
setTimeout(lvFlush, 3500);
// 이단: 세터(S)가 아닌 사람이 올림 · 바로 앞 리시브/디그/캐치가 1이면 세터가 올려도 이단
function lvTwo(g, s, side, pk) {
  const prev = [...s.list].reverse().find(r => r.side === side);
  if (prev && ["rcv", "dig", "cat"].includes(prev.kind) && prev.res === "1") return true;
  return pk != null && pk !== "" ? lvPosOf(g, side, pk) !== "S" : false;
}
// 랠리 흐름: 마지막 기록으로 지금 단계와 그 팀
function lvPhase(cur) {
  const last = cur.list[cur.list.length - 1];
  if (!last || last.point) return { k: "srv", side: cur.serve };
  const sd = last.side, ot = lvOther(sd);
  if (last.kind === "srv") return { k: "rcv", side: ot };
  if (["rcv", "dig", "cat"].includes(last.kind)) return { k: "set", side: sd };
  if (last.kind === "set") return { k: "atk", side: sd };
  if (last.kind === "atk" && last.res === "bcov") return { k: "dig", side: sd, cover: true }; // 막혔지만 커버 → 공격한 팀이 다시 받음
  if (last.kind === "atk") return { k: last.shot === "soft" ? "cat" : "dig", side: ot }; // 연타는 캐치, 스파이크 · 팁 · 밀어넣기는 디그
  if (last.kind === "ovr") return { k: "cat", side: ot };
  if (last.kind === "blk") return last.res === "touch" ? { k: "dig", side: sd } : { k: "dig", side: ot };
  return { k: null, side: null };
}
// 단계마다 먼저 골라 둘 선수: 서브 = 1번 자리 · 리시브/디그/캐치 = 코트의 리베로 · 세트 = 세터 · 공격 = 앞줄 OH(없으면 OP)
function lvDefPick(g, ph, cur, setNo) {
  if (!ph.k || !ph.side) return null; const on = lvCourtOn(g, ph.side, cur, setNo); if (!on) return null;
  const v = on.vals, pos = x => lvPosOf(g, ph.side, x);
  let r = null;
  if (ph.k === "srv") r = v[0];
  else if (ph.k === "rcv" || ph.k === "dig" || ph.k === "cat") r = on.libZ.length ? v[on.libZ[0] - 1] : null;
  else if (ph.k === "set") r = v.find(x => pos(x) === "S") ?? null;
  else if (ph.k === "atk") { for (const z of [4, 3, 2]) if (pos(v[z - 1]) === "OH") { r = v[z - 1]; break; } if (r == null) for (const z of [2, 3, 4]) if (pos(v[z - 1]) === "OP") { r = v[z - 1]; break; } }
  return r == null || r === "" ? null : lvSnu(g, ph.side) ? r : String(r);
}
// 자동 넘김 (한 사람이 두 팀 다 기록할 때 켬, 두 사람이 팀을 나누면 끔) — 기기마다
const lvFollow = () => { try { return localStorage.getItem("snuvt-lvfollow") !== "0"; } catch (e) { return true; } };
// 팀 바꾸기 (그 팀이 지금 단계면 기본 선수까지)
function lvSideTo(v) {
  const L = lv(), g = lvGame(); L.side = v; L.atype = null; L.shot = null; L.atMore = false; L.pick = null;
  if (g) { const cur = lvState(g, L.rallies[g.id] || [], L.set), ph = lvPhase(cur); if (ph.side === v) L.pick = lvDefPick(g, ph, cur, L.set); }
}
function lvSave(code, extra) {
  const L = lv(), g = lvGame(), x = LV_RES[code]; if (!g || !x) return;
  const rs = L.rallies[g.id] || [], s = lvState(g, rs, L.set), side = L.side, pk = L.pick;
  const serve = x.kind === "srv" ? side : x.kind === "rcv" ? lvOther(side) : s.serve;
  let point = x.pt === "me" ? side : x.pt === "other" ? lvOther(side) : null;
  // 바로 앞 점수 기록이 같은 랠리의 짝이면(상대 팀 쪽에서 같은 끝을 누름) 점수는 한 번만
  const prev = s.list[s.list.length - 1];
  if (point && prev && prev.point === point && prev.side !== side && lvPairOf(prev.kind + ":" + prev.res, code)) point = null;
  // id는 폰에서 만들어 보냄 → 서버 줄과 화면 줄이 같은 id라 실시간으로 온 내 기록을 다시 안 불러옴
  const row = { id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "tmp" + Date.now() + Math.random().toString(36).slice(2, 5), game_id: g.id, set_no: L.set, side, rot: s.rot, serve, kind: x.kind, res: x.res,
    player_id: lvSnu(g, side) && pk ? pk : null, opp_no: !lvSnu(g, side) && pk != null && pk !== "" && lvIdNum(pk) ? Number(pk) : null, tag: !lvSnu(g, side) && pk != null && pk !== "" && !lvIdNum(pk) ? String(pk) : null, point, won: point ? point === "us" : null,
    atype: x.kind === "atk" ? lvAtCur() : null, shot: x.kind === "atk" ? lvShCur() : null, miss: null, two: x.kind === "set" ? lvTwo(g, s, side, pk) : null, x: null, y: null, zone: null, ...(extra || {}),
    author: uid(), created_at: new Date().toISOString(), _pending: true };
  (L.rallies[g.id] = rs).push(row); const q = { ...row }; delete q._sit; lvQ.list.push(q); lvQSave();
  L.pick = null; L.atype = null; L.shot = null; L.atkOpen = false; L.atMore = false; L.spot = null; closeSheet(); state.dirty = false; render(); lvFlush();
}
// 코트 그림 (지키는 팀 코트). x·y는 지키는 팀 기준(네트 쪽 y=0). flip = SNU 쪽에서 상대 코트를 봄(네트가 아래, 180° 돌림). dots = [{x,y,c}]
function lvCourt(dots, big, flip) {
  const W = 300, ny = flip ? W - 1 : 1, ay = flip ? 200 : 100, lines = `<rect x="1" y="1" width="${W - 2}" height="${W - 2}" class="lv-c-bd"/><line x1="0" y1="${ny}" x2="${W}" y2="${ny}" class="lv-c-net"/><line x1="0" y1="${ay}" x2="${W}" y2="${ay}" class="lv-c-al"/>
    <line x1="100" y1="0" x2="100" y2="${W}" class="lv-c-g"/><line x1="200" y1="0" x2="200" y2="${W}" class="lv-c-g"/><line x1="0" y1="200" x2="${W}" y2="200" class="lv-c-g"/>`;
  const labs = "";
  const pts = (dots || []).map(d => `<circle cx="${(flip ? 100 - d.x : d.x) * 3}" cy="${(flip ? 100 - d.y : d.y) * 3}" r="${big ? 7 : 6}" class="lv-dot ${d.c || ""}"/>`).join("");
  return `<svg class="lv-c ${big ? "big" : ""}" viewBox="0 0 ${W} ${W}" ${big ? 'id="lvCourtTap"' : ""} role="img" aria-label="코트">${lines}${labs}${pts}</svg>`;
}
// 고른 선수 이름
const lvWhoPick = () => { const L = lv(), g = lvGame(); if (lvSnu(g, L.side)) { const p = playerOf(L.pick); return p ? `${pNo(p)}${esc(p.name)}` : "SNU"; } return `${esc(lvTN(g, L.side))}${L.pick != null && L.pick !== "" ? ` ${esc(lvShowId(L.pick))}` : ""}`; };
const lvKb = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
// 공격 득점 → 종류 · 떨어진 자리 고르기
function lvSpotSheet(code) {
  const L = lv(), g = lvGame(), side = L.side, el = document.getElementById("sheet"), kb = lvKb();
  L.spot = { code };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${lvWhoPick()} 공격 득점</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="sc-row lv-at2">${lvAtChips("lvatype2", kb)}</div>
    <div class="sc-row">${lvShChips("lvshot2", kb)}</div>
    <p class="small muted">${esc(lvTN(g, lvOther(side)))} 코트</p>
    <div class="lv-cwrap">${lvCourt([], true, side === "us")}</div>
    <div class="row"><button type="button" class="btn link small" data-act="lvnospot">코스 모름</button></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  const svg = document.getElementById("lvCourtTap");
  svg.addEventListener("click", e => { const r = svg.getBoundingClientRect(), fx = Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100))), fy = Math.max(0, Math.min(100, Math.round((e.clientY - r.top) / r.height * 100))), x = side === "us" ? 100 - fx : fx, y = side === "us" ? 100 - fy : fy;
    lvSave(code, { x, y, zone: lvZone(x, y) }); });
}
// 공격 범실 → 공격 미스 / 토스 미스
function lvMissSheet() {
  const L = lv(), el = document.getElementById("sheet"), kb = lvKb();
  L.spot = { code: "atk:err", miss: true };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${lvWhoPick()} 공격 범실</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="lv-miss">${[["atk", "공격 미스", "1"], ["set", "토스 미스", "2"]].map(([v, l, key]) => `<button type="button" class="btn lv-b bad" data-act="lvmiss" data-v="${v}">${l}${kb ? `<kbd>${key}</kbd>` : ""}</button>`).join("")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
// 막힘 → 블록 실점 / 커버해서 이어감
function lvBlkSheet() {
  const L = lv(), el = document.getElementById("sheet"), kb = lvKb();
  L.spot = { code: "atk:blk", blkd: true };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${lvWhoPick()} 공격 막힘</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="lv-miss">${[["blk", "블록 실점", "1", "bad"], ["bcov", "커버 · 이어감", "2", "ok"]].map(([v, l, key, c]) => `<button type="button" class="btn lv-b ${c}" data-act="lvblkd" data-v="${v}">${l}${kb ? `<kbd>${key}</kbd>` : ""}</button>`).join("")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
// 공격 대신 넘김 → 상대에게 어렵게 · 보통 · 쉽게
function lvOverSheet() {
  const L = lv(), el = document.getElementById("sheet"), kb = lvKb();
  L.spot = { code: "ovr", over: true };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${lvWhoPick()} 3단 넘김</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="lv-miss lv-srv">${LV_OVR.map(([k, l]) => `<button type="button" class="btn lv-b ${k === "3" ? "best" : k === "2" ? "good" : "ok"}" data-act="lvover" data-v="${k}"><b>${l}</b>${kb ? `<kbd>${k}</kbd>` : ""}</button>`).join("")}</div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
// 서브 들어감 → 점수 고르기
function lvSrvSheet() {
  const L = lv(), el = document.getElementById("sheet"), kb = lvKb();
  L.spot = { code: "srv:in", srv: true };
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${lvWhoPick()} 서브 들어감</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <div class="lv-miss lv-srv">${LV_SRV.map(([k, l, d]) => `<button type="button" class="btn lv-b ${k === "s3" ? "best" : k === "s2" ? "good" : "ok"}" data-act="lvsrv" data-v="${k}"><b>${l}</b> <small>${d}</small>${kb ? `<kbd>${l}</kbd>` : ""}</button>`).join("")}</div>
    <div class="row"><button type="button" class="btn link small" data-act="lvsrv" data-v="in">점수 없이${kb ? " <kbd>0</kbd>" : ""}</button></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function lvUndo() {
  const L = lv(), g = lvGame(); if (!g) return;
  const l = (L.rallies[g.id] || []).filter(r => r.set_no === L.set && r.kind), r = l[l.length - 1]; if (!r) return;
  if (!await confirmDel(`마지막 기록을 지울까요?\n${lvLabel(r).replace(/<[^>]+>/g, "")}`, "네, 지울게요", true)) return;
  const qi = lvQ.list.findIndex(x => x.id === r.id);
  if (qi >= 0) { if (qi === 0 && lvQ.busy) { toast("저장 중이에요. 잠깐 뒤에 다시 눌러 주세요"); return; } lvQ.list.splice(qi, 1); lvQSave(); }
  else { try { ok(await sb.from("live_rallies").delete().eq("id", r.id)); } catch (e) { toast(failMsg(e)); return; } }
  L.rallies[g.id] = L.rallies[g.id].filter(x => x !== r); state.dirty = false; render();
}
// 대회 · 교류전 페이지 안 목록
function lvSection(x) {
  const L = lv(), key = x.kind + ":" + x.id, gs = L.games[key];
  if (gs === undefined) { lvLoadGames(x); return `<section class="panel sec"><div class="sec-head"><h3>실시간 경기 분석</h3></div>${loaderHtml(true)}</section>`; }
  const list = (gs || []).map(g => `<button type="button" class="box lv-g" data-act="lvopen" data-id="${esc(g.id)}"><span class="bn"><b>${esc(g.label || "경기")}</b> ${g.team ? `${esc(g.team)} ` : ""}vs ${esc(g.opponent)}</span><span class="go">›</span></button>`).join("");
  return `<section class="panel sec"><div class="sec-head"><h3>실시간 경기 분석</h3>${lvCan() ? `<button class="btn add" type="button" data-act="lvnew" data-k="${esc(key)}">+ 경기</button>` : ""}</div>${list ? `<div class="boxes">${list}</div>` : emptyLine("아직 기록한 경기가 없어요.")}</section>`;
}
// 전력분석 · 실시간 경기 분석 목록
function lvScoutList() {
  const L = lv(), gs = L.games["scout:all"];
  if (gs === undefined) lvLoadAll();
  if (!gs) return loaderHtml(true);
  const src = g => g.ref_kind === "scout" ? "" : (cupItems().find(y => y.kind === g.ref_kind && String(y.id) === String(g.ref_id)) || {}).name || "";
  const list = gs.map(g => `<button type="button" class="panel sc-card" data-act="lvopen" data-id="${esc(g.id)}"><b>${esc(lvTA(g))} vs ${esc(g.opponent)}</b><span class="small muted">${[g.created_at ? shortDate(new Date(g.created_at)) : "", src(g), g.label || ""].filter(Boolean).map(esc).join(" · ")}</span><span class="go">›</span></button>`).join("");
  return list ? `<div class="sc-list">${list}</div>` : emptyLine("아직 분석한 경기가 없어요.");
}
function lvForm(key, gid) {
  const [kind, id] = key.split(":"), x = cupItems().find(y => y.kind === kind && String(y.id) === id) || {}, g = gid ? lvGame() : null;
  const fr = kind === "friendly" ? ((state.friendlies && Object.values(state.friendlies).flat().find(f => String(f.id) === id)) || {}) : {};
  const st = g ? (g.sets || {})[lv().set] || {} : {};
  const el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${g ? "경기 수정" : "경기 추가"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="lvForm" data-k="${esc(key)}" data-id="${esc(gid || "")}"><div class="fields">
      <label class="fl">경기<input id="lv-label" maxlength="40" value="${esc(g ? g.label || "" : "")}" placeholder="예선 1경기 · 8강"></label>
      <label class="fl">분석 팀<input id="lv-team" maxlength="60" value="${esc(g ? g.team || "" : "")}" placeholder="SNU"></label>
      <label class="fl">상대 팀<input id="lv-opp" required maxlength="60" value="${esc(g ? g.opponent : fr.opponent || "")}"></label>
      ${g ? "" : `<label class="fl">첫 서브<select id="lv-serve"><option value="us">분석 팀</option><option value="opp">상대 팀</option></select></label>
      <label class="fl">분석 팀 로테<select id="lv-rot">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join("")}</select></label>
      <label class="fl">상대 팀 로테<select id="lv-orot">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join("")}</select></label>`}
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
      <label class="fl">첫 서브<select id="lvs-serve"><option value="us" ${serve === "us" ? "selected" : ""}>${esc(lvTA(g))}</option><option value="opp" ${serve === "opp" ? "selected" : ""}>${esc(g.opponent)}</option></select></label>
      <label class="fl">${esc(lvTA(g))} 로테<select id="lvs-rot">${[1, 2, 3, 4, 5, 6].map(r => `<option ${r === (st.rot || 1) ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label class="fl">${esc(lvTB(g))} 로테<select id="lvs-orot">${[1, 2, 3, 4, 5, 6].map(r => `<option ${r === (st.orot || 1) ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    </div><div class="row"><button class="btn primary" type="submit">시작</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function lvSubmit(f) {
  const L = lv(), v = id => (document.getElementById(id) || {}).value || "";
  if (f.id === "lvForm") {
    const [kind, id] = f.dataset.k.split(":"), tm = v("lv-team").trim(), team = !tm || /^(snu|서울대)/i.test(tm) ? null : tm;
    if (f.dataset.id) { const g = lvGame();
      if (g && !!g.team !== !!team && (L.rallies[g.id] || []).some(r => r.kind)) { toast("기록이 있어서 SNU ↔ 다른 팀은 바꿀 수 없어요"); return; }
      ok(await sb.from("live_games").update({ label: v("lv-label").trim() || null, team, opponent: v("lv-opp").trim() }).eq("id", f.dataset.id)); }
    else {
      const r = await sb.from("live_games").insert({ ref_kind: kind, ref_id: id, label: v("lv-label").trim() || null, team, opponent: v("lv-opp").trim(), sets: { 1: { serve: v("lv-serve") || "us", rot: Number(v("lv-rot")) || 1, orot: Number(v("lv-orot")) || 1 } } }).select().maybeSingle(); ok(r);
      if (r.data) { L.open = r.data.id; L.set = 1; L.side = "us"; L.pick = null; L.rallies[r.data.id] = []; pushInner(); }
    }
    closeSheet();
    if (kind === "scout" || state.view === "scout") { await lvLoadAll(); return; }
    const x = cupItems().find(y => y.kind === kind && String(y.id) === id); if (x) await lvLoadGames(x); if (L.games["scout:all"]) lvLoadAll(); return;
  }
  if (f.id === "lvRosForm") return lvRosSave(f);
  if (f.id === "lvSetForm") {
    const g = lvGame(), n = Number(f.dataset.n), sets = { ...(g.sets || {}), [n]: { ...((g.sets || {})[n] || {}), serve: v("lvs-serve") || "us", rot: Number(v("lvs-rot")) || 1, orot: Number(v("lvs-orot")) || 1 } };
    ok(await sb.from("live_games").update({ sets }).eq("id", g.id)); g.sets = sets; L.set = n; closeSheet(); state.dirty = false; render(); return;
  }
}
const lvPct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
const lvGrade = r => r.res === "ok" ? 2 : r.res === "err" ? 0 : Number(r.res) || 0;
const lvAvg = l => l.length ? (l.reduce((a, r) => a + lvGrade(r), 0) / l.length).toFixed(2) : "—";
// 팀 하나 선수별 표 (서브 · 리시브 · 공격 · 블로킹 · 디그)
function lvTeam(rs, side, g) {
  const snu = lvSnu(g, side), l = rs.filter(r => r.side === side), key = r => snu ? r.player_id || "" : lvIdOf(r);
  const ks = [...new Set(l.map(key))].sort((a, b) => (snu ? ((playerOf(a) || {}).number ?? 999) - ((playerOf(b) || {}).number ?? 999) : a === "" ? 1 : b === "" ? -1 : lvIdSort(a, b)));
  if (!ks.length) return emptyLine("기록이 없어요.");
  const nm = k => snu ? (playerOf(k) ? `${pNo(playerOf(k))}${esc(playerOf(k).name)}` : "선수 없음") : k === "" ? "번호 없음" : esc(lvShowId(k)) + (lvPosOf(g, side, k) && !lvTagPos(k) ? ` <small>${esc(lvPosOf(g, side, k))}</small>` : "");
  const d = v => v || "—";
  const row = k => { const m = l.filter(r => key(r) === k), c = (kd, rr) => m.filter(r => r.kind === kd && (!rr || r.res === rr)).length;
    const at = c("atk"), ak = c("atk", "kill"), ae = c("atk", "err") + c("atk", "blk"), rc = m.filter(r => r.kind === "rcv"), st = m.filter(r => r.kind === "set" && r.res !== "err"), dgl = m.filter(r => r.kind === "dig"), ct = m.filter(r => r.kind === "cat"), fl = c("err");
    return `<tr><td><b>${nm(k)}</b></td><td class="num">${c("srv") ? `${c("srv", "ace")}/${c("srv", "err")}` : "—"}</td><td class="num">${rc.length ? `${lvAvg(rc)} <small>${rc.length}</small>` : "—"}</td>
      <td class="num">${c("set") ? `${st.length ? lvAvg(st) : "—"} <small>${c("set")}${c("set", "err") ? ` · 범실 ${c("set", "err")}` : ""}</small>` : "—"}</td>
      <td class="num">${at ? `${ak}/${at}` : "—"}</td><td class="num">${d(c("atk", "err"))}</td><td class="num">${d(c("atk", "blk"))}</td><td class="num"><b>${at ? lvPct(ak - ae, at) : "—"}</b></td>
      <td class="num">${c("blk") ? `${c("blk", "pt")}/${c("blk", "touch")}` : "—"}</td><td class="num">${dgl.length ? `${dgl.filter(r => lvGrade(r) > 0).length}/${dgl.length}` : "—"}</td><td class="num">${ct.length ? `${lvAvg(ct)} <small>${ct.length}</small>` : "—"}</td><td class="num">${d(fl)}</td><td class="num"><b>${d(ak + c("blk", "pt") + c("srv", "ace"))}</b></td></tr>`; };
  return `<div class="tw"><table class="lv-t"><thead><tr><th>선수</th><th>서브 <small>에이스/범실</small></th><th>리시브 <small>평균</small></th><th>세트 <small>평균</small></th><th>공격 <small>득점/시도</small></th><th>범실</th><th>막힘</th><th>효율</th><th>블로킹 <small>득점/원터치</small></th><th>디그 <small>성공/시도</small></th><th>캐치 <small>평균</small></th><th>파울</th><th>득점</th></tr></thead><tbody>${ks.map(row).join("")}</tbody></table></div>`;
}
// 공격 종류(토스 분배) · 득점 자리 (두 팀)
function lvAtk(rs, g) {
  const team = side => { const a = rs.filter(r => r.side === side && r.kind === "atk"); if (!a.length) return "";
    const tot = a.length, rows = [...LV_ATYPE.map(x => x[0]), "w4", "o2", "q3"].map(k => [k, LV_AT[k]]).map(([k, l]) => { const l2 = a.filter(r => r.atype === k); if (!l2.length) return ""; const kk = l2.filter(r => r.res === "kill").length, e = l2.filter(r => r.res === "err" || r.res === "blk").length;
      return `<tr><td><b>${l}</b></td><td class="num">${l2.length} <small>${lvPct(l2.length, tot)}</small></td><td class="num">${kk}</td><td class="num">${e}</td><td class="num"><b>${lvPct(kk - e, l2.length)}</b></td></tr>`; }).join("");
    const kills = a.filter(r => r.res === "kill" && r.x != null), zc = {}; for (const r of kills) zc[r.zone] = (zc[r.zone] || 0) + 1;
    const ft = a.filter(r => r.shot === "tip"), ftk = ft.filter(r => r.res === "kill").length;
    return `<div class="col"><h4>${esc(lvTN(g, side))} 공격</h4>${rows ? `<div class="tw"><table class="lv-t"><thead><tr><th>종류</th><th>시도 <small>분배</small></th><th>득점</th><th>범실·막힘</th><th>효율</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
      ${kills.length ? `<p class="small muted">득점 자리 · ${esc(lvTN(g, lvOther(side)))} 코트${kills.some(r => r.shot === "tip") ? ` · ○ 팁` : ""}</p><div class="lv-cwrap sm">${lvCourt(kills.map(r => ({ x: r.x, y: r.y, c: "g" + (LV_ATG[r.atype] || "E") + (r.shot === "tip" ? " tip" : "") })), false, side === "us")}</div>
        <p class="small">${Object.entries(zc).sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z}구역 ${n}`).join(" · ")}</p>` : ""}${ft.length ? `<p class="small">팁 ${ft.length} · 득점 ${ftk}</p>` : ""}${a.some(r => r.miss === "set") ? `<p class="small">범실 중 토스 미스 ${a.filter(r => r.miss === "set").length}</p>` : ""}</div>`; };
  const u = team("us"), o = team("opp");
  return u || o ? `<div class="cols lv-two">${u}${o}</div><p class="small muted lv-leg">${LV_GRP.map(([k, l]) => `<i class="lv-dot-k g${k}"></i>${l}`).join(" ")}</p>` : "";
}
// 세트: 메이킹(세터, 앞 패스 2 이상) · 이단 · 사람별 — 세트 점수와 바로 다음 공격 결과
function lvSets(rs, g) {
  const link = new Map(); let pend = {};
  for (const r of rs) { if (r.kind === "set" && r.res !== "err") pend[r.side] = r; else if (r.kind === "atk" && pend[r.side]) { link.set(pend[r.side], r); pend[r.side] = null; } if (r.point) pend = {}; }
  const team = side => {
    const snu = lvSnu(g, side), who = r => snu ? r.player_id || "" : lvIdOf(r);
    const items = [...rs.filter(r => r.side === side && r.kind === "set").map(r => ({ who: who(r), two: !!r.two, q: r.res === "err" ? null : Number(r.res), err: r.res === "err", atk: link.get(r) })),
      ...rs.filter(r => r.side === side && r.kind === "atk" && (r.setter || r.set_q)).map(r => ({ who: r.setter || "", two: r.setter ? lvPosOf(g, side, r.setter) !== "S" : false, q: r.set_q || null, err: false, atk: r }))]; // 예전 기록
    if (!items.length) return "";
    const row = (lab, l) => { if (!l.length) return ""; const a = l.map(x => x.atk).filter(Boolean), kk = a.filter(r => r.res === "kill").length, e = a.filter(r => r.res === "err" || r.res === "blk").length, q = l.filter(x => x.q);
      return `<tr><td><b>${lab}</b></td><td class="num">${l.length}</td><td class="num">${q.length ? (q.reduce((x, y) => x + y.q, 0) / q.length).toFixed(2) : "—"}</td><td class="num">${l.filter(x => x.err).length || "—"}</td><td class="num">${a.length ? `${lvPct(kk, a.length)} <small>${kk}/${a.length}</small>` : "—"}</td><td class="num"><b>${a.length ? lvPct(kk - e, a.length) : "—"}</b></td></tr>`; };
    const whos = [...new Set(items.map(x => x.who).filter(Boolean))];
    const rows = [row("메이킹", items.filter(x => !x.two)), row("이단", items.filter(x => x.two)), ...whos.map(w => row(esc(lvShortName(g, side, w)) + (lvPosOf(g, side, w) && !lvTagPos(w) ? ` <small>${esc(lvPosOf(g, side, w))}</small>` : ""), items.filter(x => x.who === w)))].join("");
    return `<div class="col"><h4>${esc(lvTN(g, side))} 세트</h4><div class="tw"><table class="lv-t"><thead><tr><th>세트</th><th>수</th><th>점수</th><th>범실</th><th>공격 득점%</th><th>효율</th></tr></thead><tbody>${rows}</tbody></table></div></div>`; };
  const u = team("us"), o = team("opp");
  return u || o ? `<div class="cols lv-two">${u}${o}</div>` : "";
}
// 점수 상황별 (리드 · 동점 · 추격) — 우리 기준
function lvSit(rs, g) {
  const rows = [["lead", "리드"], ["tie", "동점"], ["trail", "추격"]].map(([k, l]) => { const l2 = rs.filter(r => r._sit === k), pts = l2.filter(r => r.point), so = pts.filter(r => r.serve === "opp"), br = pts.filter(r => r.serve === "us");
    const a = l2.filter(r => r.side === "us" && r.kind === "atk"), kk = a.filter(r => r.res === "kill").length, e = a.filter(r => r.res === "err" || r.res === "blk").length;
    return pts.length ? `<tr><td><b>${l}</b></td><td class="num">${lvPct(so.filter(r => r.point === "us").length, so.length)} <small>${so.filter(r => r.point === "us").length}/${so.length}</small></td><td class="num">${lvPct(br.filter(r => r.point === "us").length, br.length)} <small>${br.filter(r => r.point === "us").length}/${br.length}</small></td><td class="num">${lvPct(kk - e, a.length)}</td></tr>` : ""; }).join("");
  return rows ? `<h4>점수 상황별 (${esc(lvTA(g))})</h4><div class="tw"><table class="lv-t"><thead><tr><th>상황</th><th>사이드아웃</th><th>브레이크</th><th>공격 효율</th></tr></thead><tbody>${rows}</tbody></table></div>` : "";
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
  const orot = [1, 2, 3, 4, 5, 6].map(nr => { const l = pts.filter(r => r._orot === nr), a = l.filter(r => r.serve === "us"), b = l.filter(r => r.serve === "opp"), w = l.filter(r => r.point === "opp").length, dd = w * 2 - l.length;
    return `<tr><td><b>R${nr}</b></td><td class="num">${a.length ? `${lvPct(a.filter(r => r.point === "opp").length, a.length)} <small>${a.filter(r => r.point === "opp").length}/${a.length}</small>` : "—"}</td><td class="num">${b.length ? `${lvPct(b.filter(r => r.point === "opp").length, b.length)} <small>${b.filter(r => r.point === "opp").length}/${b.length}</small>` : "—"}</td><td class="num ${dd > 0 ? "good" : dd < 0 ? "crit" : ""}">${l.length ? (dd > 0 ? "+" : "") + dd : "—"}</td></tr>`; }).join("");
  const rot = [1, 2, 3, 4, 5, 6].map(nr => { const l = pts.filter(r => r.rot === nr), a = l.filter(r => r.serve === "opp"), b = l.filter(r => r.serve === "us"), dd = l.filter(r => r.point === "us").length * 2 - l.length;
    return `<tr><td><b>R${nr}</b></td><td class="num">${a.length ? `${lvPct(a.filter(r => r.point === "us").length, a.length)} <small>${a.filter(r => r.point === "us").length}/${a.length}</small>` : "—"}</td><td class="num">${b.length ? `${lvPct(b.filter(r => r.point === "us").length, b.length)} <small>${b.filter(r => r.point === "us").length}/${b.length}</small>` : "—"}</td><td class="num ${dd > 0 ? "good" : dd < 0 ? "crit" : ""}">${l.length ? (dd > 0 ? "+" : "") + dd : "—"}</td></tr>`; }).join("");
  return `<div class="lv-kpi"><div><span>사이드아웃</span><b>${lvPct(so.filter(r => r.point === "us").length, so.length)}</b><small>${so.filter(r => r.point === "us").length}/${so.length}</small></div><div><span>브레이크</span><b>${lvPct(br.filter(r => r.point === "us").length, br.length)}</b><small>${br.filter(r => r.point === "us").length}/${br.length}</small></div><div><span>공격 효율</span><b>${ue}</b><small>${esc(lvTA(g))} ${ul} · ${esc(lvTB(g))} ${oe}</small></div><div><span>리시브 평균</span><b>${lvAvg(rcv("us"))}</b><small>${esc(lvTB(g))} ${lvAvg(rcv("opp"))}</small></div></div>
    <div class="cols lv-two"><div class="col"><h4>${esc(lvTA(g))} 득점 ${pts.filter(r => r.point === "us").length}</h4>${src("us")}</div><div class="col"><h4>${esc(g.opponent)} 득점 ${pts.filter(r => r.point === "opp").length}</h4>${src("opp")}</div></div>
    <h4>${esc(lvTA(g))}</h4>${lvTeam(rs, "us", g)}<h4>${esc(g.opponent)}</h4>${lvTeam(rs, "opp", g)}
    ${lvAtk(rs, g)}
    ${lvSets(rs, g)}
    ${lvSit(rs, g)}
    <h4>로테별 (${esc(lvTA(g))})</h4><div class="tw"><table class="lv-t"><thead><tr><th>로테</th><th>사이드아웃</th><th>브레이크</th><th>득실</th></tr></thead><tbody>${rot}</tbody></table></div>
    ${Object.values(g.sets || {}).some(x => x.orot || (x.lu || {}).opp) ? `<h4>로테별 (${esc(lvTB(g))})</h4><div class="tw"><table class="lv-t"><thead><tr><th>로테</th><th>사이드아웃</th><th>브레이크</th><th>득실</th></tr></thead><tbody>${orot}</tbody></table></div>` : ""}`;
}
function lvPage(x) {
  const L = lv(), g = lvGame();
  if (!g) { L.open = null; return ""; }
  lvSub(g.id);
  if (!L.rallies[g.id]) { lvLoadRallies(g.id); return loaderHtml(); }
  const rs = L.rallies[g.id], sets = [1, 2, 3, 4, 5].map(n => ({ n, s: lvState(g, rs, n) })), cur = sets[L.set - 1].s, end = lvEnd(cur, L.set);
  const won = sets.filter(({ n, s }) => lvEnd(s, n) === "us").length, lost = sets.filter(({ n, s }) => lvEnd(s, n) === "opp").length;
  const lastSet = Math.max(1, ...rs.map(r => r.set_no), ...Object.keys(g.sets || {}).map(Number).filter(n => n >= 1 && n <= 5));
  const chips = sets.filter(({ n }) => n <= Math.min(5, lastSet + (lvEnd(sets[lastSet - 1].s, lastSet) ? 1 : 0))).map(({ n, s }) => `<button type="button" class="chip sc-chip ${n === L.set ? "on" : ""}" data-act="lvset" data-v="${n}">${n}세트${s.list.length ? ` <span class="num">${s.us}:${s.op}</span>` : ""}</button>`).join("");
  // 교류전: 그 세트 출전 명단이 있으면 주전으로
  const lu = x.kind === "friendly" && !g.team ? cupState().lineups[x.kind + ":" + x.id] : null;
  if (x.kind === "friendly" && !g.team && !lu) cupLoadLineups(x.kind, x.id);
  const mem = lu && lu[L.set] && (lu[L.set].members || []).length ? new Set(lu[L.set].members) : null;
  const me = lvCan(), en = entryOf(x.kind, x.id), st = mem || startersOf(x.kind, x.id), kb = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const ps = sortedPlayers().filter(p => !p.military && (st.size ? st.has(p.id) || en.has(p.id) : en.size ? en.has(p.id) : true)).sort((a, b) => (st.has(b.id) - st.has(a.id)) || (a.number ?? 999) - (b.number ?? 999));
  // 랠리 흐름: 기록이 하나 늘 때마다(다른 기기 것도) 다음 단계로 — 자동 넘김이면 그 팀 탭으로, 그 단계 기본 선수를 골라 둠
  const ph = !end ? lvPhase(cur) : { k: null, side: null }, lastR = cur.list[cur.list.length - 1], pkey = `${g.id}:${L.set}:${cur.list.length}:${lastR ? lastR.id : ""}`;
  if (L.phKey !== pkey) { L.phKey = pkey; if (me && lvFollow() && ph.side) L.side = ph.side; L.atype = null; L.shot = null; L.atMore = false; L.atkOpen = false; L.pick = L.side === ph.side ? lvDefPick(g, ph, cur, L.set) : null; }
  const side = L.side, want = ph.side === side && ph.k ? (ph.k === "dig" && !ph.cover ? ["dig", "blk"] : [ph.k]) : [];
  const nos = lvSnu(g, side) ? null : lvNos(g, side), on6 = lvCourtOn(g, side, cur, L.set), now = on6 && on6.vals;
  const nb = (v, z) => { const on = String(L.pick) === String(v), pos = nos ? lvPosOf(g, side, v) : "", lb = z && on6 && on6.libZ.includes(z) ? " lib" : "";
    if (!nos) { const p = playerOf(v); return `<button type="button" class="lv-n us ${on ? "on" : ""}${lb}" data-act="lvpick" data-v="${esc(v)}">${z ? `<i>${z}</i>` : ""}<b>${esc(p && p.number != null ? p.number : "–")}</b><span>${esc(p ? p.name : "?")}${lb ? " · L" : ""}</span></button>`; }
    return `<button type="button" class="lv-n ${side} ${on ? "on" : ""}${lb}" data-act="lvpick" data-v="${esc(v)}">${z ? `<i>${z}</i>` : ""}<b>${esc(v)}</b>${pos && !lvTagPos(v) ? `<span>${esc(pos)}</span>` : ""}</button>`; };
  const rosBtn = me ? `${now ? `<button type="button" class="btn small" data-act="lvsub">교체</button>` : ""}<button type="button" class="btn small" data-act="lvros">명단 · 로테</button>` : "";
  const players = now
    ? `<div class="lv-c6">${[4, 3, 2, 5, 6, 1].map(z => nb(now[z - 1], z)).join("")}</div><div class="lv-ns">${(nos ? nos.filter(n => !now.some(v => String(v) === String(n))) : ps.filter(p => !now.includes(p.id)).map(p => p.id)).map(v => nb(v).replace('class="lv-n', 'class="lv-n sub')).join("")}${rosBtn}</div>`
    : !nos
    ? ps.map(p => `<button type="button" class="lv-n us ${L.pick === p.id ? "on" : ""} ${st.has(p.id) ? "" : "sub"}" data-act="lvpick" data-v="${esc(p.id)}"><b>${esc(p.number ?? "–")}</b><span>${esc(p.name)}</span></button>`).join("")
    : nos.map(n => nb(n)).join("");
  const shRow = `<div class="lv-row"><span class="lv-rk">타법</span><div class="lv-rb lv-at">${lvShChips("lvshot", false)}</div></div>`;
  const atRow = `<div class="lv-row"><span class="lv-rk">종류</span><div class="lv-rb lv-at">${lvAtChips("lvatype", false)}</div></div>`;
  const atkOpen = L.atkOpen || L.atype || L.shot;
  const board = LV_BOARD.map(([k, l, rs2]) => `<div class="lv-row ${k === "set" ? "gap" : ""} ${want.includes(k) ? "want" : ""}">${k === "atk" ? `<button type="button" class="lv-rk lv-rkb ${atkOpen ? "on" : ""}" data-act="lvatkopen">${l}<i>${atkOpen ? "▴" : "▾"}</i></button>` : `<span class="lv-rk">${l}</span>`}<div class="lv-rb ${rs2.length > 4 ? "c5" : ""}" style="grid-template-columns:repeat(${Math.max(4, rs2.length)},minmax(0,1fr))">${rs2.map(r => `<button type="button" class="btn lv-b ${r[3]}" data-act="lvcode" data-v="${k}:${r[0]}">${esc(r[1])}${kb ? `<kbd>${r[2]}</kbd>` : ""}</button>`).join("")}</div></div>${k === "atk" && atkOpen ? atRow + shRow : ""}`).join("");
  const pad = me && !end ? `<div class="panel lv-pad ${side}">
      <div class="seg fill lv-side">${[["us", esc(lvTA(g))], ["opp", esc(g.opponent)]].map(([v, l]) => `<button type="button" class="seg-tab ${side === v ? "on solid" : ""}" data-act="lvside" data-v="${v}">${l}${ph.side === v && ph.k ? ` <span class="lv-todo ${ph.k === "srv" ? "srv" : "rcv"}">${ph.cover ? "커버" : LV_PHN[ph.k]}</span>` : ""}${kb ? ` <kbd>Tab</kbd>` : ""}</button>`).join("")}</div>
      ${now ? players : `<div class="lv-ns">${players}${rosBtn}</div>`}
      ${board}
      <div class="row between"><button type="button" class="btn small" data-act="lvundo" ${cur.list.length ? "" : "disabled"}>되돌리기${kb ? " <kbd>⌫</kbd>" : ""}</button><span class="row nowrap">${lvQ.list.length ? `<span class="chip warn">대기 ${lvQ.list.length}</span>` : ""}<button type="button" class="chip sc-chip ${lvFollow() ? "on" : ""}" data-act="lvfollow">자동 넘김</button></span></div>
    </div>` : "";
  const endBox = end ? `<div class="panel lv-end"><b>${L.set}세트 ${esc(lvTN(g, end))} 승 · ${cur.us}:${cur.op}</b>${me && L.set < 5 && !(won >= 3 || lost >= 3) ? `<button class="btn primary small" type="button" data-act="lvnext">${L.set + 1}세트 시작</button>` : ""}</div>` : "";
  const scope = L.scope === "all" ? rs.filter(r => r.kind) : cur.list;
  return `<section class="sec lv-page"><div class="row between"><button class="btn link small" type="button" data-act="lvback">‹ ${esc(x.name)}</button>${me ? `<button class="btn link small" type="button" data-act="lvedit">수정</button>` : ""}</div>
    <div class="jp-head"><h2 class="dyn">${g.label ? `${esc(g.label)} · ` : ""}${esc(lvTA(g))} vs ${esc(g.opponent)}</h2><span class="small muted">세트 ${won} : ${lost}</span></div>
    <div class="sc-row">${chips}</div>
    <div class="panel lv-score"><span class="lv-t1 ${cur.serve === "us" ? "srv" : ""}">${esc(lvTA(g))} <small>R${cur.rot}</small></span><b class="num">${cur.us} : ${cur.op}</b><span class="lv-t2 ${cur.serve === "opp" ? "srv" : ""}"><small>R${cur.orot}</small> ${esc(g.opponent)}</span>
      ${cur.run <= -3 ? `<span class="chip warn lv-run">${-cur.run}연속 실점</span>` : cur.run >= 3 ? `<span class="chip ok lv-run">${cur.run}연속 득점</span>` : ""}</div>
    ${endBox}${pad}
    ${cur.list.length ? `<section class="sec"><h4>최근 기록</h4><ul class="watch sc-recent">${cur.list.map((r, i) => ({ r, sc: (() => { let u = 0, o = 0; for (const y of cur.list.slice(0, i + 1)) { if (y.point === "us") u++; else if (y.point === "opp") o++; } return `${u}:${o}`; })() })).slice(-5).reverse().map(({ r, sc }) =>
      `<li class="${r._pending ? "ct-pend" : ""}"><span class="num small">${sc}</span><span class="small ct-l">${lvLabel(r)}</span>${r.point ? `<span class="chip ${r.point === "us" ? "ok" : "warn"}">${esc(lvTN(g, r.point))}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
    <section class="sec"><div class="seg fill">${[["set", `${L.set}세트`], ["all", "경기 전체"]].map(([k, l]) => `<button type="button" class="seg-tab ${L.scope === k ? "on solid" : ""}" data-act="lvscope" data-v="${k}">${l}</button>`).join("")}</div>
      ${scope.length ? lvStats(scope, g) : emptyLine(me ? "팀 · 선수를 고르고 동작 버튼을 눌러요." : "아직 기록이 없어요.")}</section>
  </section>`;
}
// 동작 버튼 · 단축키 → 창이 필요한 것은 창으로
const lvCode = c => c === "atk:kill" ? lvSpotSheet(c) : c === "atk:err" ? lvMissSheet() : c === "srv:in" ? lvSrvSheet() : c === "atk:over" ? lvOverSheet() : c === "atk:blk" ? lvBlkSheet() : lvSave(c);
async function liveClick(b, act) {
  const L = lv();
  if (act === "lvnew") return lvForm(b.dataset.k, null);
  if (act === "lvopen") { L.open = b.dataset.id; L.set = 1; L.pick = null; L.side = "us"; L.scope = "set"; pushInner();
    const g = lvGame(); state.dirty = false; render(); window.scrollTo(0, 0);
    if (g) lvLoadRallies(g.id).then(() => { const l = (L.rallies[g.id] || []).filter(r => r.kind); if (l.length) { L.set = Math.max(...l.map(r => r.set_no)); state.dirty = false; render(); } }); return; }
  if (act === "lvback") { if (history.state && history.state.inner) return history.back(); L.open = null; state.dirty = false; render(); window.scrollTo(0, 0); return; }
  if (act === "lvedit") { const g = lvGame(); return lvForm(`${g.ref_kind}:${g.ref_id}`, g.id); }
  if (act === "lvdel") { const g = lvGame(); if (!g) return;
    try { ok(await sb.from("live_games").delete().eq("id", g.id)); for (const k in L.games) if (L.games[k]) L.games[k] = L.games[k].filter(x => x.id !== g.id); L.open = null; closeSheet(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); }
    state.dirty = false; return render(); }
  if (act === "lvset") { const n = Number(b.dataset.v), g = lvGame(); L.set = n; L.pick = null;
    if (!(g.sets || {})[n] && lvCan() && !(L.rallies[g.id] || []).some(r => r.set_no === n && r.kind)) return lvSetForm(n);
    state.dirty = false; return render(); }
  if (act === "lvnext") return lvSetForm(L.set + 1);
  if (act === "lvfollow") { try { localStorage.setItem("snuvt-lvfollow", lvFollow() ? "0" : "1"); } catch (e) {} state.dirty = false; return render(); }
  if (act === "lvside") { lvSideTo(b.dataset.v); state.dirty = false; return render(); }
  if (act === "lvpick") { const v = b.dataset.v; L.pick = String(L.pick) === String(v) ? null : v; L.atype = null; L.atMore = false; state.dirty = false; return render(); }
  if (act === "lvros") return lvRosSheet();
  if (act === "lvsub") { L.sub = { out: null, inn: null }; return lvSubSheet(); }
  if (act === "lvsubout") { L.sub.out = Number(b.dataset.v); return lvSubSheet(); }
  if (act === "lvsubin") { L.sub.inn = b.dataset.v; const ne = document.getElementById("lvSubNew"); if (ne) ne.value = ""; L.sub.typed = ""; return lvSubSheet(); }
  if (act === "lvsubok") return lvSubSave();
  if (act === "lvauto") return lvRosAuto();
  if (act === "lvrostag") { const l = document.getElementById("lvrList"); if (!l) return; const t = b.dataset.v, used = new Set(Object.keys(lvRosMap())), base = t === "Li" ? "Li" : t;
    let tag; // OH · MB는 OH1 · OH2 · OH3 …, S · OP · Li는 처음엔 그대로 다음부터 S2 · Li2 …
    if (t === "OH" || t === "MB") { let n = 1; while (used.has(base + n)) n++; tag = base + n; }
    else { tag = base; for (let n = 2; used.has(tag); n++) tag = base + n; }
    const rows = l.querySelectorAll(".lvr-row"), last = rows[rows.length - 1];
    if (last && last.querySelector(".lvr-n").value.trim() === "") last.insertAdjacentHTML("beforebegin", lvRosRow({ no: tag, pos: lvTagPos(tag) })); else l.insertAdjacentHTML("beforeend", lvRosRow({ no: tag, pos: lvTagPos(tag) }));
    lvRosInfo(); return; }
  if (act === "lvswap") return lvRosSwap(b.dataset.v);
  if (act === "lvturn") return lvRosTurn(Number(b.dataset.d));
  if (act === "lvrosadd") { const l = document.getElementById("lvrList"); if (l) { l.insertAdjacentHTML("beforeend", lvRosRow(null)); const i = l.querySelectorAll(".lvr-n"); i[i.length - 1].focus(); } return; }
  if (act === "lvrosdel") { const r = b.closest(".lvr-row"); if (r) r.remove(); lvRosInfo(); return; }
  if (act === "lvaddno") { const i = document.getElementById("lvAddNo"), n = Number(i && i.value); if (!i || i.value === "" || n < 0 || n > 99) return toast("번호를 넣어 주세요");
    const g = lvGame(), ps = document.getElementById("lvAddPos"); lvRosAdd(g, L.side, n, ps ? ps.value : ""); L.pick = String(n); L.atype = null; state.dirty = false; return render(); }
  if (act === "lvcode") return lvCode(b.dataset.v);
  if (act === "lvsrv") return lvSave("srv:" + b.dataset.v);
  if (act === "lvmiss") return lvSave("atk:err", { miss: b.dataset.v });
  if (act === "lvatmore") { L.atMore = true; if (L.spot && !document.getElementById("sheet").hidden) return lvSpotSheet(L.spot.code); state.dirty = false; return render(); }
  if (act === "lvatkopen") { const o = !(L.atkOpen || L.atype || L.shot); L.atkOpen = o; if (!o) { L.atype = null; L.shot = null; } state.dirty = false; return render(); }
  if (act === "lvover") return lvSave("ovr:" + b.dataset.v);
  if (act === "lvblkd") return lvSave("atk:" + b.dataset.v);
  if (act === "lvshot" || act === "lvshot2") { L.shot = b.dataset.v === "spike" ? null : b.dataset.v; if (act === "lvshot2") return lvSpotSheet(L.spot.code); state.dirty = false; return render(); }
  if (act === "lvatype" || act === "lvatype2") { const v = b.dataset.v; L.atype = lvAtCur() === v && !lvAtList() ? null : v === (lvAtList() || [])[0] ? null : v; if (act === "lvatype2") return lvSpotSheet(L.spot.code); state.dirty = false; return render(); }
  if (act === "lvnospot") return lvSave(L.spot ? L.spot.code : "atk:kill");
  if (act === "lvundo") return lvUndo();
  if (act === "lvscope") { L.scope = b.dataset.v; state.dirty = false; return render(); }
}
// 컴퓨터 단축키: 동작 글자 · 숫자 = 선수 번호(이어서 치면 두 자리) · Tab = 팀 · Backspace = 되돌리기
let lvNum = { s: "", t: 0 };
document.addEventListener("keydown", ev => {
  const L = state.live; if (!L || !L.open || !lvView() || !lvCan() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  const sh = document.getElementById("sheet"), k = ev.key.toLowerCase();
  if (sh && !sh.hidden) { // 득점 자리 창: 숫자 1~9 = 그 구역 가운데, 0 = 코스 모름
    if (L.spot && L.spot.blkd) { if (k === "1" || k === "2") { ev.preventDefault(); return lvSave(k === "1" ? "atk:blk" : "atk:bcov"); } return; }
    if (L.spot && L.spot.over) { if (/^[1-3]$/.test(k)) { ev.preventDefault(); return lvSave("ovr:" + k); } return; }
    if (L.spot && L.spot.srv) { if (/^[0-3]$/.test(k)) { ev.preventDefault(); return lvSave(k === "0" ? "srv:in" : "srv:s" + k); } return; }
    if (L.spot && L.spot.miss) { if (k === "1" || k === "2") { ev.preventDefault(); return lvSave("atk:err", { miss: k === "1" ? "atk" : "set" }); } return; }
    if (L.spot && /^[0-9]$/.test(k)) { ev.preventDefault(); if (k === "0") return lvSave(L.spot.code); const z = Number(k), ri = LV_ZROWS.findIndex(r => r.includes(z)), ci = LV_ZROWS[ri].indexOf(z); return lvSave(L.spot.code, { x: ci * 33 + 17, y: ri * 33 + 17, zone: z }); }
    if (L.spot && LV_SHKEY[k]) { ev.preventDefault(); L.shot = LV_SHKEY[k] === "spike" ? null : LV_SHKEY[k]; return lvSpotSheet(L.spot.code); }
    const ai = LV_ATKEYS.indexOf(k), av = ai >= 0 ? lvAtVis().ks[ai] : null;
    if (L.spot && av) { ev.preventDefault(); L.atype = av === (lvAtList() || [])[0] ? null : av; return lvSpotSheet(L.spot.code); }
    return; }
  const g = lvGame(); if (!g || !L.rallies[g.id]) return;
  if (k === "tab") { ev.preventDefault(); lvSideTo(lvOther(L.side)); state.dirty = false; return render(); }
  if (k === "backspace") { ev.preventDefault(); return lvUndo(); }
  if (/^[0-9]$/.test(k)) { ev.preventDefault(); const now = Date.now(); lvNum.s = now - lvNum.t < 900 && lvNum.s.length < 2 ? lvNum.s + k : k; lvNum.t = now; const n = Number(lvNum.s);
    if (lvSnu(g, L.side)) { const p = sortedPlayers().find(x => x.number === n); if (p) L.pick = p.id; }
    else { if (!lvNos(g, L.side).includes(String(n))) lvRosAdd(g, L.side, n, ""); L.pick = String(n); }
    L.atype = null;
    state.dirty = false; return render(); }
  const x = LV_KEYS[k]; if (x) { ev.preventDefault(); return lvCode(x.kind + ":" + x.res); }
});
