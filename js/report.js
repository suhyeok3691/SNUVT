/* ---------- 상대 분석 리포트 (노션 "어택라인" 양식을 따름) ----------
   전력분석 → 리포트 탭: 상대 팀 · 기간 · 종류(대회/교류전)로 경기를 골라(경기마다 빼기도 됨) 숫자 칸은 앱이 채우고, 글 칸만 사람이 씀.
   표 scout_reports (보기 부원 모두, 쓰기 전력분석 담당). 글 칸은 body[키] 하나씩 저장(report_set) — 여러 명이 다른 칸을 같이 써도 안 겹침.
   상대 팀 T 는 경기마다 분석 팀(us)이었을 수도, 상대(opp)였을 수도 있어서 T 쪽이 늘 opp 가 되게 기록을 뒤집어 셈(rpNorm) */
const RP_PRINCIPLE = `<b>핵심 원칙</b> "상대가 어떻다"가 아니라 "그래서 우리가 뭘 해야 하나" — 분석하는 사람도, 읽는 선수도 내가 시합 때 어떻게 플레이할지를 항상 염두에 둘 것.`;
const RP_TIMEOUT = [["즉시 타임아웃", "상대 연속 득점 4점 이상", "흐름 차단"], ["타임아웃 고려", "상대 강한 로테이션 진입 시", "수비 정비"], ["세트 중반", "10점 이후 격차 3점 이상 벌어질 때", "전술 수정"], ["특수 상황", "상대 서브 에이스 연속 2개", "리시브 재정비"]];
const RP_CHECK = ["상대 세터 번호 · 오늘 로테이션 시작 번호 확인", "에이스 컨디션 확인 (워밍업 공격 보기)", "서브 방식 변경 여부 (점프서브 → 플로터 등)", "라인업 변경 여부 (분석과 다른 선수 있는지)"];
const rpS = () => { const S = sc(); return S.rp || (S.rp = { list: undefined, open: null, saving: {}, timers: {} }); };
const rpCanEdit = () => can("analysis");
async function rpLoad() {
  const R = rpS(); if (R.list === null) return; R.list = null;
  try { const r = await sb.from("scout_reports").select("*").order("updated_at", { ascending: false }); R.list = r.error ? [] : r.data || []; } catch (e) { R.list = []; }
  if (state.view === "scout") { state.dirty = false; render(); }
}
const rpCur = () => { const R = rpS(); return (R.list || []).find(x => x.id === R.open) || null; };
const rpTeams = () => [...new Set(sc().matches.flatMap(m => [(m.opponent || "").trim(), (m.team || "").trim()]).filter(t => t && !SNU_RE.test(t)))].sort((a, b) => a.localeCompare(b, "ko"));
const rpSide = (m, t) => (m.team || "").trim() === t ? "us" : (m.opponent || "").trim() === t ? "opp" : null;
const rpInRange = (r, m) => (!r.date_from || (m.date && m.date >= r.date_from)) && (!r.date_to || (m.date && m.date <= r.date_to));
// 기간 · 종류 안의 그 팀 경기 (all = 뺀 경기도). 9인제는 뺌
function rpMatches(r, all) {
  return sc().matches.filter(m => !ctNine(m) && rpSide(m, r.opponent) && rpInRange(r, m) && (r.kinds || ["match"]).includes(scKindOf(m)) && (all || !(r.excl || []).includes(m.id)))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}
// 그 경기 기록을 상대 팀 T 가 opp 쪽이 되게
function rpNorm(m, t) {
  const S = sc(), side = rpSide(m, t), fl = side === "us", sw = x => !fl ? x : x === "us" ? "opp" : x === "opp" ? "us" : x;
  const ev = (S.events[m.id] || []).map(e => fl ? { ...e, side: sw(e.side), point: sw(e.point), serve: sw(e.serve), rot: e.opp_rot, opp_rot: e.rot } : e);
  const pts = (S.points[m.id] || []).map(p => fl ? { ...p, won: !p.won, rot: p.opp_rot, opp_rot: p.rot, serve: sw(p.serve) } : p);
  return { m, side, ev, pts };
}
const rpPct = (a, b) => b ? Math.round(100 * a / b) : null;
const rpP = v => v == null ? "—" : v + "%";
const rpF2 = v => v == null ? "—" : v.toFixed(2);
const rpCnt = l => l.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const rpTop = (l, n) => [...rpCnt(l).entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
// 글 칸: 전력분석 담당은 입력, 나머지는 글만 (비면 안 보임)
function rpTx(r, k, ph, big) {
  const v = (r.body || {})[k] || "";
  if (!rpCanEdit()) return v ? `<p class="rp-txt">${esc(v).replace(/\n/g, "<br>")}</p>` : "";
  return `<textarea class="rp-in ${big ? "big" : ""}" data-rk="${esc(k)}" rows="${big ? 3 : 1}" placeholder="${esc(ph || "")}" maxlength="5000">${esc(v)}</textarea>`;
}
function rpIn(r, k, ph) { // 한 줄 짧은 칸 (목표값 · 이름)
  const v = (r.body || {})[k] || "";
  return rpCanEdit() ? `<input class="rp-in1" data-rk="${esc(k)}" maxlength="60" placeholder="${esc(ph || "")}" value="${esc(v)}">` : esc(v || "—");
}
/* ---- 목록 ---- */
function scoutReports() {
  const R = rpS(); if (R.list === undefined) { rpLoad(); return loaderHtml(true); } if (R.list === null) return loaderHtml(true);
  if (!R.list.length) return emptyLine(rpCanEdit() ? "상대 팀과 기간을 골라 리포트를 만들어요. 숫자는 저절로 채워져요." : "아직 리포트가 없어요.");
  const per = r => [r.date_from ? md(parseD(r.date_from)) : "", r.date_to ? md(parseD(r.date_to)) : ""].join("~");
  return `<div class="sc-list">${R.list.map(r => `<button type="button" class="panel sc-card" data-act="rpopen" data-id="${esc(r.id)}"><b>${esc(r.title || r.opponent + " 분석")}</b><span class="small muted">${esc(r.opponent)} · ${per(r)} · ${(r.kinds || []).map(k => k === "friendly" ? "교류전" : "대회").join("+")} · ${rpMatches(r).length}경기</span><span class="go">›</span></button>`).join("")}</div>`;
}
// + 리포트: 상대 팀 · 기간 · 종류
function rpNewForm() {
  const teams = rpTeams(), el = document.getElementById("sheet"), t = iso(today());
  if (!teams.length) return toast("경기에 상대 팀 이름을 넣으면 리포트를 만들 수 있어요");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>상대 분석 리포트</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="rpNewForm"><div class="fields">
      <label class="fl wide">상대 팀<select id="rpn-opp">${teams.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
      <label class="fl">시작<input type="date" id="rpn-from" value="${dAdd(t, -60)}"></label><label class="fl">끝<input type="date" id="rpn-to" value="${t}"></label>
      <div class="fl wide">포함<span class="row">${SC_KIND.map(([k, l]) => `<label class="rp-ck"><input type="checkbox" name="rpn-k" value="${k}" ${k === "match" ? "checked" : ""}> ${l}</label>`).join("")}</span></div>
      <p class="small muted wide" id="rpn-n"></p>
    </div><div class="row"><button class="btn primary" type="submit">만들기</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll"); rpNewCount();
}
function rpNewDraft() { const v = id => (document.getElementById(id) || {}).value || ""; return { opponent: v("rpn-opp"), date_from: v("rpn-from") || null, date_to: v("rpn-to") || null, kinds: [...document.querySelectorAll('input[name="rpn-k"]:checked')].map(x => x.value), excl: [] }; }
function rpNewCount() { const n = document.getElementById("rpn-n"); if (!n) return; const d = rpNewDraft(); n.textContent = `이 기간 ${d.opponent} 경기 ${d.kinds.length ? rpMatches(d).length : 0}개 (영상 분석 · 6인제)`; }
document.addEventListener("change", e => { if (e.target && e.target.closest && e.target.closest("#rpNewForm")) rpNewCount(); });
async function rpNewSave() {
  const d = rpNewDraft(); if (!d.kinds.length) return toast("대회 · 교류전 중 하나는 골라 주세요");
  if (d.date_from && d.date_to && d.date_from > d.date_to) return toast("시작이 끝보다 뒤예요");
  const yy = (d.date_to || iso(today())).replace(/-/g, "").slice(2);
  try { const r = await sb.from("scout_reports").insert({ ...d, title: `${d.opponent} 분석_${yy}`, body: {} }).select().maybeSingle(); ok(r);
    const R = rpS(); R.list = [r.data, ...(R.list || [])]; R.open = r.data.id; closeSheet(); pushInner(); state.dirty = false; render(); window.scrollTo(0, 0);
  } catch (e) { toast(failMsg(e)); }
}
/* ---- 리포트 한 장 ---- */
function scoutReport() {
  const R = rpS(), r = rpCur(); if (!r) { R.open = null; return scoutList(); }
  const S = sc(); if (S.all !== true) { scoutAll(); return loaderHtml(); }
  const ed = rpCanEdit(), t = r.opponent, msAll = rpMatches(r, true), ms = msAll.filter(m => !(r.excl || []).includes(m.id)), N = ms.map(m => rpNorm(m, t));
  const ev = N.flatMap(x => ctReal(x.ev)), te = ev.filter(e => e.side === "opp"), pts = N.flatMap(x => x.pts);
  const nSets = new Set(N.flatMap(x => x.ev.filter(e => e.action).map(e => x.m.id + ":" + e.set_no))).size;
  // 선수 번호 · 포지션 (경기마다 라인업 포지션 → 가장 많이 나온 것)
  const posVotes = {};
  for (const x of N) { const L = ctLuAll(x.m), T = L[x.side] || {}; (T.slots || []).forEach((n, i) => { if (n == null || n === "") return; (posVotes[n] = posVotes[n] || []).push((T.pos || [])[i] || ""); }); (T.libero || []).forEach(n => (posVotes[n] = posVotes[n] || []).push("L"));
    (T.bench || []).forEach(b => { if (b.no != null && b.pos) (posVotes[b.no] = posVotes[b.no] || []).push(b.pos, b.pos); }); } // 교체 선수 포지션(Edit Lineup)도
  // 공격 · 서브 점 색: 득점 파랑 · 범실 빨강 · 이어짐 회색 (전력분석 지도와 같음)
  const posOf = n => { const v = (posVotes[n] || []).filter(Boolean); return v.length ? rpTop(v, 1)[0][0] : ""; };
  const nos = [...new Set([...te.map(e => e.opp_no).filter(n => n != null), ...Object.keys(posVotes).map(Number)])].sort((a, b) => a - b);
  const rows = ctStatRows(ev, "opp", nos.map(n => [n, n, ""])), rowOf = n => rows[nos.indexOf(n)];
  const team = ctSum(te);
  // 최근 라인업(로테 그림 · 서브 순서 · 세터)
  const lm = ms.slice().reverse().find(m => ctReady(m)), lside = lm ? rpSide(lm, t) : null;
  const setter = (() => { const s = nos.filter(n => posOf(n) === "S"); return s.length ? s.sort((a, b) => (rowOf(b).s.st || 0) - (rowOf(a).s.st || 0))[0] : null; })();
  const ace = rows.filter(x => x.s.at >= 5).sort((a, b) => b.s.at - a.s.at)[0];
  const head = `<div class="sc-top"><button class="btn link small" type="button" data-act="rpback">‹ 리포트</button><span class="row nowrap"><button class="btn link small" type="button" data-act="rpprint">인쇄</button></span></div>`;
  const title = ed ? `<input class="rp-title" data-rk="__title" maxlength="80" value="${esc(r.title || "")}" aria-label="리포트 이름">` : `<h2 class="rp-title">${esc(r.title || t + " 분석")}</h2>`;
  const per = `${r.date_from ? shortDate(parseD(r.date_from)) : "처음"} ~ ${r.date_to ? shortDate(parseD(r.date_to)) : "지금"}`;
  const range = ed ? `<div class="rp-range"><label class="fl">시작<input type="date" data-rf="date_from" value="${esc(r.date_from || "")}"></label><label class="fl">끝<input type="date" data-rf="date_to" value="${esc(r.date_to || "")}"></label>
      <span class="row">${SC_KIND.map(([k, l]) => `<label class="rp-ck"><input type="checkbox" data-rf="kind" value="${k}" ${(r.kinds || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</span></div>` : `<p class="small muted">${per} · ${(r.kinds || []).map(k => k === "friendly" ? "교류전" : "대회").join(" · ")}</p>`;
  const mlist = msAll.length ? `<ul class="rp-ms">${msAll.map(m => { const on = !(r.excl || []).includes(m.id);
      return `<li class="${on ? "" : "off"}">${ed ? `<label class="rp-ck"><input type="checkbox" data-rf="excl" value="${esc(m.id)}" ${on ? "checked" : ""}>` : ""} ${m.date ? md(parseD(m.date)) : ""} ${esc(m.title)}${m.stage ? ` · ${esc(m.stage)}` : ""} <span class="small muted">vs ${esc(rpSide(m, t) === "us" ? (m.opponent || "") : ctTA(m))}</span>${ed ? "</label>" : ""}</li>`; }).join("")}</ul>` : emptyLine("이 기간 · 종류에 이 팀 경기가 없어요. 기간을 넓혀 보세요.");
  const top = `${head}<div class="rp-head">${title}<p class="small muted">${esc(t)} · ${per} · ${ms.length}경기 ${nSets}세트 · 마지막 수정 ${r.updated_at ? shortDate(new Date(r.updated_at)) : ""}</p></div>
    <p class="rp-principle">${RP_PRINCIPLE}</p>
    <section class="sec rp-sec"><h3>분석에 쓴 경기</h3>${range}${mlist}</section>`;
  if (!ms.length) return `<form class="f rp" id="rpForm" onsubmit="return false">${top}</form>`;
  const good = (v, g, b) => v == null ? "" : v >= g ? "ct-up" : v < b ? "ct-dn" : "";
  // 1. 팀 전반 요약
  const s1 = `<section class="sec rp-sec"><h3>1. 팀 전반 요약</h3>
    <div class="rp-kv"><div><span>세터</span><b>${setter != null ? "#" + setter : "—"}</b></div><div><span>에이스 (공격 점유율 1위)</span><b>${ace ? `#${ace.no} <small>${ace.점유율}%</small>` : "—"}</b></div>
      <div><span>공격 성공률</span><b>${rpP(rpPct(team.ak, team.at))}</b></div><div><span>공격 효율</span><b>${rpP(rpPct(team.ak - team.ae, team.at))}</b></div>
      <div><span>리시브 점수</span><b>${rpF2(team.rs)}</b></div><div><span>서브 점수</span><b>${rpF2(team.ss)}</b></div><div><span>세트당 서브 범실</span><b>${nSets ? (te.filter(e => CT_CNT.srv_err.includes(e.action)).length / nSets).toFixed(1) : "—"}</b></div></div>
    <label class="rp-l">팀 스타일</label>${rpTx(r, "style", "예) 빠른 토스, 레프트 의존")}<label class="rp-l">주요 특징</label>${rpTx(r, "feature", "예) 라이트가 후위일 때 10번이 미들까지 당겨서 블로킹", true)}</section>`;
  // 2. 선수 스탯 요약
  const prow = n => { const x = rowOf(n); if (!x || (!x.s.at && !x.s.sv && !x.s.rc && !posVotes[n])) return "";
    return `<tr><td>${rpIn(r, "pn." + n, "이름")}</td><td class="num"><b>${n}</b></td><td>${esc(posOf(n))}</td><td class="num ${good(x.성공률, 45, 25)}">${rpP(x.성공률)}</td><td class="num ${good(x.효율, 30, 10)}">${rpP(x.효율)}</td><td class="num">${x.s.at ? x.점유율 + "%" : "—"}</td>
      <td class="num">${x.s.sv ? `${x.s.sv}/${x.s.sa}/${te.filter(e => e.opp_no === n && CT_CNT.srv_err.includes(e.action)).length}` : "—"}</td><td class="num ${good(x.리시브점수, 2, 1.5)}">${x.s.rc ? rpF2(x.리시브점수) : "—"}</td><td class="rp-wide">${rpTx(r, "pnote." + n, "특이사항")}</td></tr>`; };
  const s2 = `<section class="sec rp-sec"><h3>2. 선수 스탯 요약</h3><div class="tw"><table class="rp-t"><thead><tr><th>이름</th><th>번호</th><th>포지션</th><th>공격 성공률</th><th>공격 효율</th><th>점유율</th><th>서브 (개수/에이스/범실)</th><th>리시브 점수</th><th>특이사항</th></tr></thead><tbody>${nos.map(prow).join("")}</tbody></table></div>
    <p class="small muted">초록 = 좋음(성공률 45% · 효율 30% · 리시브 2.0 이상), 빨강 = 약함(25% · 10% · 1.5 밑)</p></section>`;
  // 3. 서브 (서브 순서대로: 최근 라인업 1번 자리부터)
  const order = (() => { const L = lm ? ctLu(lm)[lside] || {} : {}, o = (L.slots || []).filter(n => n != null && n !== ""); const rest = nos.filter(n => !o.some(x => ctSame(x, n)) && te.some(e => e.opp_no === n && e.skill === "serve")); return [...o.map(Number), ...rest]; })();
  const srow = n => { const l = te.filter(e => e.opp_no === n && e.skill === "serve"); if (!l.length) return "";
    const s = ctSum(l), er = l.filter(e => CT_CNT.srv_err.includes(e.action)).length, ty = rpTop(l.map(e => CT_STN[e.kind] || "").filter(Boolean), 2).map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
    const dots = l.filter(e => e.x != null && e.y != null).map(e => ({ x: e.x, y: e.y, c: e.action === "ace" ? "gL" : "gE" }));
    return `<div class="rp-card"><div class="rp-ch"><b>#${n}</b> <span class="small muted">${esc(posOf(n))}</span><span class="rp-chs">${l.length}개 · 에이스 ${s.sa} · 범실 ${er} · 점수 ${rpF2(s.ss)}</span></div>
      <div class="rp-cb"><div class="rp-mini">${dots.length ? ctCourtSvg(dots) : `<span class="small muted">떨어진 자리 기록 없음</span>`}</div><div class="rp-cx"><p class="small">${ty}</p>${rpTx(r, "sv." + n, "서브 스타일 · 주의 포인트 (예: 엔드라인 기준 두 발, 긴 건 오버로)", true)}</div></div></div>`; };
  const svTop = order.map(n => ({ n, s: ctSum(te.filter(e => e.opp_no === n && e.skill === "serve")) })).filter(x => x.s.sv >= 5).sort((a, b) => b.s.ss - a.s.ss).slice(0, 3);
  const lmSlots = lm ? ((ctLu(lm)[lside] || {}).slots || []) : [], pinch = nos.filter(n => te.some(e => e.opp_no === n && e.skill === "serve") && !lmSlots.some(x => ctSame(x, n)) && !["S", "L"].includes(posOf(n)));
  const s3 = `<section class="sec rp-sec"><h3>3. 서브</h3><p class="small muted">서브 순서대로 (최근 경기 라인업 1번 자리부터)</p><div class="rp-cards">${order.map(srow).join("") || emptyLine("서브 기록이 없어요.")}</div>
    <label class="rp-l">가장 주의해야 할 서브 ${svTop.length ? `<span class="small muted">서브 점수 높은 순: ${svTop.map(x => `#${x.n} ${rpF2(x.s.ss)}`).join(" · ")}</span>` : ""}</label>${rpTx(r, "sv_warn", "예) 20번 (범실 0개) / 3번 세터 서브")}
    <label class="rp-l">핀치 서버 ${pinch.length ? `<span class="small muted">라인업 밖에서 서브한 선수: ${pinch.map(n => "#" + n).join(" · ")}</span>` : ""}</label>${rpTx(r, "sv_pinch", "번호 · 투입 상황(누구랑 교체) · 서브 특징")}</section>`;
  // 4. 공격: 로테이션별 (서브 시 = T 서브 · 브레이크, 캐치 시 = T 리시브 · 사이드아웃)
  const rstat = (rot, srv) => { const l = pts.filter(p => p.opp_rot === rot && (srv ? p.serve === "opp" : p.serve === "us")); return { n: l.length, w: l.filter(p => !p.won).length }; };
  const grade = srv => { const l = [1, 2, 3, 4, 5, 6].map(rot => ({ rot, ...rstat(rot, srv) })).filter(x => x.n >= 3).sort((a, b) => b.w / b.n - a.w / a.n), g = {};
    if (l.length >= 4) { l.forEach((x, i) => { g[x.rot] = i < 2 ? "강함" : i === l.length - 1 ? "약함" : "보통"; }); } return g; };
  const gS = grade(true), gC = grade(false);
  const starts = N.flatMap(x => scStartRows(x.m).filter(row => row.Team === ctTN(x.m, x.side)));
  const stS = rpTop(starts.filter(x => x["First Serve"] === "O").map(x => x["Start Rot"]), 2), stC = rpTop(starts.filter(x => x["First Serve"] !== "O").map(x => x["Start Rot"]), 2);
  const opts = (rot, srv) => { const l = te.filter(e => e.skill === "attack" && e.opp_rot === rot && (srv ? e.serve === "opp" : e.serve === "us") && e.opp_no != null); return l.length ? rpTop(l.map(e => e.opp_no), 3).map(([n, v]) => `#${n} <small>${Math.round(100 * v / l.length)}%</small>`).join(" · ") : "—"; };
  const phase = (rot, srv) => { const x = rstat(rot, srv), g = (srv ? gS : gC)[rot];
    return `<div class="rp-ph"><div class="rp-phh"><b>${srv ? "서브 시" : "캐치 시"}</b>${g ? `<span class="chip ${g === "강함" ? "warn" : g === "약함" ? "ok" : ""}">${g}</span>` : ""}<span class="small muted">${srv ? "브레이크" : "사이드아웃"} ${x.n ? `${rpPct(x.w, x.n)}% <small>${x.w}/${x.n}</small>` : "—"}</span></div>
      <p class="small">공격 옵션: ${opts(rot, srv)}</p>${rpTx(r, `rot.${rot}.${srv ? "s" : "c"}`, "우리 블로킹 포인트 · 수비 포인트", true)}</div>`; };
  const s4 = `<section class="sec rp-sec"><h3>4. 공격</h3>
    <p class="small">상대 시작 로테 — 서브로 시작: ${stS.map(([k, v]) => `<b>${k}</b> ${v}세트`).join(" · ") || "—"} / 캐치로 시작: ${stC.map(([k, v]) => `<b>${k}</b> ${v}세트`).join(" · ") || "—"}</p>
    <p class="small muted">강함 2 · 보통 3 · 약함 1 (상대가 그 로테에서 딴 비율 순, 3랠리 이상). 그림은 최근 경기 처음 라인업 기준</p>
    <div class="rp-rots">${[1, 2, 3, 4, 5, 6].map(rot => `<div class="rp-rot"><h4>로테이션 ${rot}</h4><div class="rp-rotb">${lm ? ctRotCourt(lm, lside, rot, true) : ""}<div class="rp-phs">${phase(rot, true)}${phase(rot, false)}</div></div></div>`).join("")}</div>
    <h4>개인별 공격 습관</h4><div class="rp-cards">${nos.map(n => { const l = te.filter(e => e.opp_no === n && e.skill === "attack"); if (l.length < 3) return "";
      const s = ctSum(l), ty = rpTop(l.map(e => CT_ATN[e.kind] || "").filter(Boolean), 3).map(([k, v]) => `${k} ${v}`).join(" · ") || "공격 종류 기록 없음";
      const dots = l.filter(e => e.x != null && e.y != null).map(e => ({ x: e.x, y: e.y, c: CT_CNT.att_pt.includes(e.action) ? "gL" : CT_CNT.att_err.includes(e.action) ? "gR" : "gE" }));
      return `<div class="rp-card"><div class="rp-ch"><b>#${n}</b> <span class="small muted">${esc(posOf(n))}</span><span class="rp-chs">${l.length}번 · 성공 ${rpP(rpPct(s.ak, s.at))} · 효율 ${rpP(rpPct(s.ak - s.ae, s.at))}</span></div>
        <div class="rp-cb"><div class="rp-mini">${dots.length ? ctCourtSvg(dots) : `<span class="small muted">떨어진 자리 기록 없음</span>`}</div><div class="rp-cx"><p class="small">${ty}</p>${rpTx(r, "atk." + n, "주요 코스 · 버릇 · 블로킹 대응 · 수비 대응", true)}</div></div></div>`; }).join("") || emptyLine("공격 3번 이상인 선수가 없어요.")}</div></section>`;
  // 5. 수비 (우리 서브 전략)
  const rec = nos.map(n => ({ n, x: rowOf(n) })).filter(o => o.x && o.x.s.rc >= 3).sort((a, b) => a.x.리시브점수 - b.x.리시브점수);
  const hole = rot => { const l = te.filter(e => e.skill === "receive" && e.opp_rot === rot && e.opp_no != null), by = {}; for (const e of l) (by[e.opp_no] = by[e.opp_no] || []).push(e);
    const w = Object.entries(by).filter(([, a]) => a.length >= 2).map(([n, a]) => ({ n, s: ctSum(a) })).sort((a, b) => a.s.rs - b.s.rs)[0]; return w ? `#${w.n} <small>${rpF2(w.s.rs)} · ${w.s.rc}번</small>` : "—"; };
  const s5 = `<section class="sec rp-sec"><h3>5. 수비 · 우리 서브 전략</h3><h4>서브 타깃 (리시브 점수 낮은 순, 3번 이상 받은 선수)</h4>
    ${rec.length ? `<div class="tw"><table class="rp-t"><thead><tr><th>순위</th><th>번호</th><th>포지션</th><th>리시브 점수</th><th>받은 수</th><th>노릴 코스 · 방향</th></tr></thead><tbody>${rec.map((o, i) => `<tr class="${i === rec.length - 1 && rec.length > 1 ? "rp-avoid" : ""}"><td>${i === rec.length - 1 && rec.length > 1 ? "피할 선수" : `${i + 1}순위`}</td><td class="num"><b>${o.n}</b></td><td>${esc(posOf(o.n))}</td><td class="num ${good(o.x.리시브점수, 2, 1.5)}">${rpF2(o.x.리시브점수)}</td><td class="num">${o.x.s.rc}</td><td class="rp-wide">${rpTx(r, "tgt." + o.n, "예) 10번과 20번 사이")}</td></tr>`).join("")}</tbody></table></div>` : emptyLine("리시브 기록이 부족해요.")}
    <h4>로테이션별 리시브 구멍</h4><div class="tw"><table class="rp-t"><thead><tr><th>로테</th><th>가장 약한 리시버</th><th>공략 방법</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(rot => `<tr><td><b>R${rot}</b></td><td class="num">${hole(rot)}</td><td class="rp-wide">${rpTx(r, "hole." + rot, "")}</td></tr>`).join("")}</tbody></table></div>
    <label class="rp-l">상대 수비 · 강타 수비 특징</label>${rpTx(r, "def_feat", "예) 가운데 연타(3번 자리) 대처를 못함", true)}
    <label class="rp-l">블로킹 높이</label>${rpTx(r, "blk_h", "")}<label class="rp-l">빠른 공격 대응</label>${rpTx(r, "fast", "")}</section>`;
  // 6 · 7 · 8
  const s6 = `<section class="sec rp-sec"><h3>6. 우리 로테이션 플랜</h3><label class="rp-l">서브 시 로테이션 · 이유 · 집중 포인트</label>${rpTx(r, "plan_s", "로테이션: / 이유: / 집중 포인트:", true)}<label class="rp-l">캐치 시 로테이션 · 이유 · 집중 포인트</label>${rpTx(r, "plan_c", "로테이션: / 이유: / 집중 포인트:", true)}</section>`;
  const s7 = `<section class="sec rp-sec"><h3>7. 교체 · 타임아웃 플랜</h3><h4>우리 팀 타임아웃 기준</h4><div class="tw"><table class="rp-t"><thead><tr><th>상황</th><th>조건</th><th>목적</th></tr></thead><tbody>${RP_TIMEOUT.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="small muted">타임아웃 때 전달할 메시지 미리 준비, 리베로 벤치로 들어올 때 말 전달</p>${rpTx(r, "to_note", "타임아웃 때 전할 말", true)}
    <label class="rp-l">교체 플랜 (공격 강화 · 수비 강화 · 핀치 서버)</label>${rpTx(r, "sub_plan", "상황 / 교체 OUT → IN / 목적", true)}
    <p class="small muted">교체는 두 번 이상 미스가 나거나 타임아웃이 없을 때. 이기고 있을 때는 가능하면 바꾸지 않기</p></section>`;
  const s8 = `<section class="sec rp-sec"><h3>8. 경기 중 체크리스트 (워밍업 때)</h3><ul class="rp-chk">${RP_CHECK.map((x, i) => `<li>${esc(x)}${i === 0 ? ` <span class="small muted">→ 세터 ${setter != null ? "#" + setter : "?"}${stS.length ? ` · 서브로 시작 ${stS[0][0]}` : ""}${stC.length ? ` · 캐치로 시작 ${stC[0][0]}` : ""}</span>` : ""}</li>`).join("")}</ul>${rpTx(r, "check", "더 확인할 것", true)}</section>`;
  // 9. 목표: 기준치 = 같은 기간 · 종류 우리 경기 기록
  const our = (() => { const sm = sc().matches.filter(m => !ctNine(m) && scSnuSide(m) && rpInRange(r, m) && (r.kinds || ["match"]).includes(scKindOf(m))), A = sm.map(scAsSnu), e = A.flatMap(x => ctReal(x.ev)).filter(x => x.side === "us"), p = A.flatMap(x => x.pts);
    const ns = new Set(A.flatMap((x, i) => x.ev.filter(y => y.action).map(y => sm[i].id + ":" + y.set_no))).size, s = ctSum(e), so = p.filter(x => x.serve === "opp"), br = p.filter(x => x.serve === "us");
    return { n: sm.length, s, ns, se: e.filter(x => CT_CNT.srv_err.includes(x.action)).length, so: rpPct(so.filter(x => x.won).length, so.length), br: rpPct(br.filter(x => x.won).length, br.length) }; })();
  const s9 = `<section class="sec rp-sec"><h3>9. 목표 달성치</h3><p class="small muted">기준치 = 같은 기간 우리 경기 ${our.n}개</p>
    <div class="rp-kv"><div><span>공격 성공률</span><b>${rpP(rpPct(our.s.ak, our.s.at))}</b></div><div><span>공격 효율</span><b>${rpP(rpPct(our.s.ak - our.s.ae, our.s.at))}</b></div><div><span>리시브 점수</span><b>${rpF2(our.s.rs)}</b></div><div><span>서브 점수</span><b>${rpF2(our.s.ss)}</b></div>
      <div><span>세트당 서브 범실</span><b>${our.ns ? (our.se / our.ns).toFixed(1) : "—"}</b></div><div><span>사이드아웃</span><b>${rpP(our.so)}</b></div><div><span>브레이크</span><b>${rpP(our.br)}</b></div></div>
    <div class="tw"><table class="rp-t"><thead><tr><th>항목</th><th>목표값</th><th>이유</th></tr></thead><tbody>${[["sm", "서브 미스", "개 이하"], ["eff", "공격 효율", "% 이상"], ["so", "사이드아웃", "% 이상"], ["ace", `상대 에이스${ace ? ` #${ace.no}` : ""} 공격 효율`, "% 이하로 억제"], ["sa", "서브 에이스", "개 이상"]]
      .map(([k, l, u]) => `<tr><td>${esc(l)}</td><td class="nowrap">${rpIn(r, "goal." + k, "")} ${u}</td><td class="rp-wide">${rpTx(r, "goalw." + k, "")}</td></tr>`).join("")}</tbody></table></div></section>`;
  const s10 = `<section class="sec rp-sec"><h3>10. 최종 요약 — 오늘 우리가 집중할 3가지</h3><p class="small muted">경기 전 팀 전체가 공유할 핵심 포인트. 3개 이하로</p>
    <label class="rp-l">[공격]</label>${rpTx(r, "f_atk", "")}<label class="rp-l">[수비 · 서브]</label>${rpTx(r, "f_def", "")}<label class="rp-l">[멘탈 · 흐름]</label>${rpTx(r, "f_mind", "")}
    <p class="small muted rp-sign">작성: 서울대학교 배구부 전력분석</p>${ed ? `<div class="del-zone"><button class="btn danger small" type="button" data-act="rpdel" data-id="${esc(r.id)}">리포트 삭제</button></div>` : ""}</section>`;
  return `<form class="f rp" id="rpForm" onsubmit="return false">${top}${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}${s9}${s10}</form>`;
}
/* ---- 저장 ---- */
// 글 칸: 쓰고 0.8초 쉬면 그 칸만 저장
document.addEventListener("input", e => {
  const x = e.target; if (!x || !x.dataset || !x.dataset.rk || !x.closest("#rpForm")) return;
  if (x.tagName === "TEXTAREA") { x.style.height = "auto"; x.style.height = x.scrollHeight + 2 + "px"; }
  const R = rpS(), k = x.dataset.rk; clearTimeout(R.timers[k]); R.timers[k] = setTimeout(() => rpSaveField(k, x.value), 800);
});
document.addEventListener("focusout", e => { const x = e.target; if (x && x.dataset && x.dataset.rk && x.closest("#rpForm")) { const R = rpS(); if (R.timers[x.dataset.rk]) { clearTimeout(R.timers[x.dataset.rk]); delete R.timers[x.dataset.rk]; rpSaveField(x.dataset.rk, x.value); } } });
async function rpSaveField(k, v) {
  const R = rpS(), r = rpCur(); if (!r) return; delete R.timers[k];
  try {
    if (k === "__title") { const t = v.trim() || `${r.opponent} 분석`; ok(await sb.from("scout_reports").update({ title: t, updated_at: new Date().toISOString() }).eq("id", r.id)); r.title = t; return; }
    const res = await sb.rpc("report_set", { rid: r.id, k, v }); if (res.error) throw res.error;
    r.body = { ...(r.body || {}) }; if (v) r.body[k] = v; else delete r.body[k]; if (res.data) r.updated_at = res.data;
  } catch (e) { toast("저장 못 했어요: " + failMsg(e)); }
}
// 기간 · 종류 · 경기 빼기: 바로 저장하고 다시 그림
document.addEventListener("change", async e => {
  const x = e.target; if (!x || !x.dataset || !x.dataset.rf || !x.closest("#rpForm")) return;
  const r = rpCur(); if (!r) return; let patch;
  if (x.dataset.rf === "kind") { const k = [...document.querySelectorAll('#rpForm input[data-rf="kind"]:checked')].map(y => y.value); if (!k.length) { x.checked = true; return toast("대회 · 교류전 중 하나는 골라 주세요"); } patch = { kinds: k }; }
  else if (x.dataset.rf === "excl") { const s = new Set(r.excl || []); if (x.checked) s.delete(x.value); else s.add(x.value); patch = { excl: [...s] }; }
  else patch = { [x.dataset.rf]: x.value || null };
  try { ok(await sb.from("scout_reports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id)); Object.assign(r, patch); } catch (err) { toast(failMsg(err)); }
  state.dirty = false; render();
});
async function rpClick(b, act) {
  const R = rpS();
  if (act === "rpnew") return rpNewForm();
  if (act === "rpopen") { R.open = b.dataset.id; pushInner(); state.dirty = false; render(); window.scrollTo(0, 0); return; }
  if (act === "rpback") { if (history.state && history.state.inner) return history.back(); R.open = null; state.dirty = false; render(); return; }
  if (act === "rpprint") { document.querySelectorAll("#rpForm textarea").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }); return window.print(); }
  if (act === "rpdel") { if (!await confirmDel("이 리포트를 지울까요?")) return; try { ok(await sb.from("scout_reports").delete().eq("id", b.dataset.id)); R.list = (R.list || []).filter(x => x.id !== b.dataset.id); R.open = null; state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } }
}
// 그린 뒤 글 칸 높이를 글에 맞춤
const rpFit = () => document.querySelectorAll("#rpForm textarea.rp-in").forEach(t => { if (t.value) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; } });
