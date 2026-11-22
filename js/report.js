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
// 리포트 숫자 (화면 · PPT 같이 씀)
function rpData(r) {
  const t = r.opponent, msAll = rpMatches(r, true), ms = msAll.filter(m => !(r.excl || []).includes(m.id)), N = ms.map(m => rpNorm(m, t));
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
  const order = (() => { const L = lm ? ctLu(lm)[lside] || {} : {}, o = (L.slots || []).filter(n => n != null && n !== ""); const rest = nos.filter(n => !o.some(x => ctSame(x, n)) && te.some(e => e.opp_no === n && e.skill === "serve")); return [...o.map(Number), ...rest]; })();
  const svTop = order.map(n => ({ n, s: ctSum(te.filter(e => e.opp_no === n && e.skill === "serve")) })).filter(x => x.s.sv >= 5).sort((a, b) => b.s.ss - a.s.ss).slice(0, 3);
  const lmSlots = lm ? ((ctLu(lm)[lside] || {}).slots || []) : [], pinch = nos.filter(n => te.some(e => e.opp_no === n && e.skill === "serve") && !lmSlots.some(x => ctSame(x, n)) && !["S", "L"].includes(posOf(n)));
  const rstat = (rot, srv) => { const l = pts.filter(p => p.opp_rot === rot && (srv ? p.serve === "opp" : p.serve === "us")); return { n: l.length, w: l.filter(p => !p.won).length }; };
  const grade = srv => { const l = [1, 2, 3, 4, 5, 6].map(rot => ({ rot, ...rstat(rot, srv) })).filter(x => x.n >= 3).sort((a, b) => b.w / b.n - a.w / a.n), g = {};
    if (l.length >= 4) { l.forEach((x, i) => { g[x.rot] = i < 2 ? "강함" : i === l.length - 1 ? "약함" : "보통"; }); } return g; };
  const gS = grade(true), gC = grade(false);
  const starts = N.flatMap(x => scStartRows(x.m).filter(row => row.Team === ctTN(x.m, x.side)));
  const stS = rpTop(starts.filter(x => x["First Serve"] === "O").map(x => x["Start Rot"]), 2), stC = rpTop(starts.filter(x => x["First Serve"] !== "O").map(x => x["Start Rot"]), 2);
  const opts = (rot, srv) => { const l = te.filter(e => e.skill === "attack" && e.opp_rot === rot && (srv ? e.serve === "opp" : e.serve === "us") && e.opp_no != null); return l.length ? rpTop(l.map(e => e.opp_no), 3).map(([n, v]) => `#${n} <small>${Math.round(100 * v / l.length)}%</small>`).join(" · ") : "—"; };
  // 서브 타깃 · 리시브 구멍에서 세터는 뺌(세터는 서브 받을 때 빠져 있어서 노릴 대상이 아님)
  const isS = n => posOf(n) === "S";
  const rec = nos.map(n => ({ n, x: rowOf(n) })).filter(o => o.x && o.x.s.rc >= 3 && !isS(o.n)).sort((a, b) => a.x.리시브점수 - b.x.리시브점수);
  const hole = rot => { const l = te.filter(e => e.skill === "receive" && e.opp_rot === rot && e.opp_no != null && !isS(e.opp_no)), by = {}; for (const e of l) (by[e.opp_no] = by[e.opp_no] || []).push(e);
    const w = Object.entries(by).filter(([, a]) => a.length >= 2).map(([n, a]) => ({ n, s: ctSum(a) })).sort((a, b) => a.s.rs - b.s.rs)[0]; return w ? `#${w.n} <small>${rpF2(w.s.rs)} · ${w.s.rc}번</small>` : "—"; };
  const our = (() => { const sm = sc().matches.filter(m => !ctNine(m) && scSnuSide(m) && rpInRange(r, m) && (r.kinds || ["match"]).includes(scKindOf(m))), A = sm.map(scAsSnu), e = A.flatMap(x => ctReal(x.ev)).filter(x => x.side === "us"), p = A.flatMap(x => x.pts);
    const ns = new Set(A.flatMap((x, i) => x.ev.filter(y => y.action).map(y => sm[i].id + ":" + y.set_no))).size, s = ctSum(e), so = p.filter(x => x.serve === "opp"), br = p.filter(x => x.serve === "us");
    return { n: sm.length, s, ns, se: e.filter(x => CT_CNT.srv_err.includes(x.action)).length, so: rpPct(so.filter(x => x.won).length, so.length), br: rpPct(br.filter(x => x.won).length, br.length) }; })();
  return { t, msAll, ms, N, ev, te, pts, nSets, posVotes, posOf, nos, rows, rowOf, team, lm, lside, setter, ace, order, svTop, lmSlots, pinch, rstat, gS, gC, starts, stS, stC, opts, rec, hole, our };
}
/* ---- 리포트 한 장 ---- */
function scoutReport() {
  const R = rpS(), r = rpCur(); if (!r) { R.open = null; return scoutList(); }
  const S = sc(); if (S.all !== true) { scoutAll(); return loaderHtml(); }
  const ed = rpCanEdit(), D = rpData(r), { t, msAll, ms, te, nSets, posVotes, posOf, nos, rowOf, team, lm, lside, setter, ace, order, svTop, pinch, rstat, gS, gC, stS, stC, opts, rec, hole, our } = D;
  const head = `<div class="sc-top"><button class="btn link small" type="button" data-act="rpback">‹ 리포트</button><span class="row nowrap"><button class="btn link small" type="button" data-act="rpppt">PPT 만들기</button><button class="btn link small" type="button" data-act="rpprint">인쇄</button></span></div>`;
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
  const srow = n => { const l = te.filter(e => e.opp_no === n && e.skill === "serve"); if (!l.length) return "";
    const s = ctSum(l), er = l.filter(e => CT_CNT.srv_err.includes(e.action)).length, ty = rpTop(l.map(e => CT_STN[e.kind] || "").filter(Boolean), 2).map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
    const dots = l.filter(e => e.x != null && e.y != null).map(e => ({ x: e.x, y: e.y, c: e.action === "ace" ? "gL" : "gE" }));
    return `<div class="rp-card"><div class="rp-ch"><b>#${n}</b> <span class="small muted">${esc(posOf(n))}</span><span class="rp-chs">${l.length}개 · 에이스 ${s.sa} · 범실 ${er} · 점수 ${rpF2(s.ss)}</span></div>
      <div class="rp-cb"><div class="rp-mini">${dots.length ? ctCourtSvg(dots) : `<span class="small muted">떨어진 자리 기록 없음</span>`}</div><div class="rp-cx"><p class="small">${ty}</p>${rpTx(r, "sv." + n, "서브 스타일 · 주의 포인트 (예: 엔드라인 기준 두 발, 긴 건 오버로)", true)}</div></div></div>`; };
  const s3 = `<section class="sec rp-sec"><h3>3. 서브</h3><p class="small muted">서브 순서대로 (최근 경기 라인업 1번 자리부터)</p><div class="rp-cards">${order.map(srow).join("") || emptyLine("서브 기록이 없어요.")}</div>
    <label class="rp-l">가장 주의해야 할 서브 ${svTop.length ? `<span class="small muted">서브 점수 높은 순: ${svTop.map(x => `#${x.n} ${rpF2(x.s.ss)}`).join(" · ")}</span>` : ""}</label>${rpTx(r, "sv_warn", "예) 20번 (범실 0개) / 3번 세터 서브")}
    <label class="rp-l">핀치 서버 ${pinch.length ? `<span class="small muted">라인업 밖에서 서브한 선수: ${pinch.map(n => "#" + n).join(" · ")}</span>` : ""}</label>${rpTx(r, "sv_pinch", "번호 · 투입 상황(누구랑 교체) · 서브 특징")}</section>`;
  // 4. 공격: 로테이션별 (서브 시 = T 서브 · 브레이크, 캐치 시 = T 리시브 · 사이드아웃)
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
  if (act === "rpppt") return rpPptDownload();
  if (act === "rpprint") { document.querySelectorAll("#rpForm textarea").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }); return window.print(); }
  if (act === "rpdel") { if (!await confirmDel("이 리포트를 지울까요?")) return; try { ok(await sb.from("scout_reports").delete().eq("id", b.dataset.id)); R.list = (R.list || []).filter(x => x.id !== b.dataset.id); R.open = null; state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } }
}
// 그린 뒤 글 칸 높이를 글에 맞춤
const rpFit = () => document.querySelectorAll("#rpForm textarea.rp-in").forEach(t => { if (t.value) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; } });
/* ---- PPT 만들기: 전력분석 담당이 경기 전에 만들던 발표 자료 모양 (16:9, .pptx — 구글 슬라이드 · 파워포인트에서 열어 고침) ----
   표지 → 팀 개요 → 스탯 요약 → 선수마다 공격 · 서브(경기별 코트 지도) → 로테이션 → 경기 전 공유. 글은 리포트 글 칸(줄마다 한 줄), 숫자 · 지도는 자동 */
const RP_PPT_LIB = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
const RP_C = { ink: "0F1A3A", label: "D99A00", text: "2B3245", muted: "8A93A6", red: "C0392B", blue: "1C3C8C" };
const rpLines = v => String(v || "").split("\n").map(x => x.trim()).filter(Boolean);
// 코트 지도 PNG (공격한 팀 쪽에서 봄, 네트가 아래 — 앱 지도와 같은 좌표). dots: [{x, y, k: "pt" | "err" | ""}]
function rpCourtPng(dots) {
  const out = dots.some(d => d.x < 0 || d.x > 100 || d.y > 100), M = out ? 60 : 0, S = 2, W = 300 + 2 * M, H = 300 + M;
  const c = document.createElement("canvas"); c.width = W * S; c.height = H * S; const g = c.getContext("2d"); g.scale(S, S); g.translate(M, M);
  if (out) { g.fillStyle = "#FBF5EC"; g.fillRect(-M, -M, W, H); }
  g.fillStyle = "#F3E3C8"; g.fillRect(0, 0, 300, 300);
  g.strokeStyle = "#D5C3A6"; g.lineWidth = 1; for (const v of [100, 200]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 300); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(300, v); g.stroke(); }
  g.setLineDash([6, 4]); g.strokeStyle = "#8C7B65"; g.beginPath(); g.moveTo(0, 200); g.lineTo(300, 200); g.stroke(); g.setLineDash([]);
  g.strokeStyle = "#8C7B65"; g.lineWidth = 2; g.strokeRect(1, 1, 298, 298);
  g.strokeStyle = "#C0392B"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 299); g.lineTo(300, 299); g.stroke();
  for (const d of dots) { const x = (100 - d.x) * 3, y = (100 - d.y) * 3; g.beginPath(); g.arc(x, y, 7, 0, 7);
    g.fillStyle = d.k === "pt" ? "#1D4ED8" : d.k === "err" ? "#C0392B" : "#FFFFFF"; g.fill(); g.lineWidth = 2; g.strokeStyle = d.k ? "#FFFFFF" : "#6B7280"; g.stroke(); }
  return { data: c.toDataURL("image/png").replace(/^data:/, ""), ratio: W / H };
}
// 로테 자리 그림 PNG (앞줄 4·3·2 / 뒷줄 5·6·1, 세터 노란 테, 뒷줄 MB 는 받을 때 리베로)
function rpRotPng(m, side, rot, nameOf) {
  const L = ctLu(m), st = ctState(m, [], 1), slots = side === "us" ? st.usSlots : st.opSlots, pos = side === "us" ? st.usPos : st.opPos, lib = ctLibs(L, side)[0];
  const S = 2, W = 420, H = 300, c = document.createElement("canvas"); c.width = W * S; c.height = H * S; const g = c.getContext("2d"); g.scale(S, S);
  g.fillStyle = "#F3E3C8"; g.fillRect(0, 0, W, H); g.fillStyle = RP_C.ink.replace(/^/, "#"); g.fillRect(0, 0, W, 6);
  g.font = "600 11px sans-serif"; g.fillStyle = "#6B5B45"; g.textAlign = "center"; g.fillText("네트", W / 2, 20);
  const cw = (W - 40) / 3, ch = (H - 50) / 2, at = z => ((z - 1) + (rot - 1)) % 6;
  [[4, 3, 2], [5, 6, 1]].forEach((row, ri) => row.forEach((z, ci) => {
    const x = 10 + ci * (cw + 10), y = 30 + ri * (ch + 10), i = at(z), v = slots[i], ps = pos[i] || "", back = z === 1 || z === 5 || z === 6;
    g.fillStyle = "#FFFFFF"; g.fillRect(x, y, cw, ch); g.lineWidth = ps === "S" ? 4 : 1; g.strokeStyle = ps === "S" ? "#FFC83D" : "#D6D9E0"; g.strokeRect(x, y, cw, ch);
    g.textAlign = "left"; g.font = "500 11px sans-serif"; g.fillStyle = "#8A93A6"; g.fillText(`${z}${z === 1 ? " 서브" : ""}`, x + 6, y + 15);
    g.textAlign = "center"; g.font = "700 24px sans-serif"; g.fillStyle = "#0F1A3A"; g.fillText(ps || "—", x + cw / 2, y + ch / 2 + 2);
    const nm = nameOf(v); g.font = "500 13px sans-serif"; g.fillStyle = "#2B3245"; g.fillText(`${v != null && v !== "" ? "#" + v : ""} ${nm}`.trim(), x + cw / 2, y + ch / 2 + 24);
    if (ps === "MB" && back && lib != null) { g.font = "500 11px sans-serif"; g.fillStyle = "#0F8F7E"; g.fillText(`받을 때 리베로 #${lib}`, x + cw / 2, y + ch - 8); }
  }));
  return { data: c.toDataURL("image/png").replace(/^data:/, ""), ratio: W / H };
}
async function rpPptx(r) {
  if (!window.PptxGenJS) await loadScript(RP_PPT_LIB);
  const D = rpData(r), { t, ms, N, te, posOf, nos, rowOf, team, lm, lside, setter, ace, order, svTop, rstat, gS, gC, stS, stC, rec } = D, B = r.body || {};
  const pres = new window.PptxGenJS(); pres.layout = "LAYOUT_WIDE"; pres.title = r.title || t + " 분석"; pres.author = "서울대학교 배구부 전략분석";
  const F = "Noto Sans KR", foot = `${t} 분석  |  SNUVT 리포트`, nm = n => B["pn." + n] || "", pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
  const mname = m => (m.stage || m.title || "").slice(0, 18) + (m.date ? ` (${md(parseD(m.date))})` : "");
  const base = (label, title) => { const s = pres.addSlide(); s.background = { color: "FFFFFF" };
    s.addText(label, { x: 0.55, y: 0.3, w: 9, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: RP_C.label });
    s.addText(title, { x: 0.55, y: 0.6, w: 12.2, h: 0.7, fontFace: F, fontSize: 26, bold: true, color: RP_C.ink });
    s.addText(foot, { x: 0.55, y: 7.0, w: 9, h: 0.3, fontFace: F, fontSize: 9, color: RP_C.muted }); return s; };
  // 제목 + 줄 목록 (줄마다 글머리). 높이는 글 길이로 어림 → 다음 y
  const sect = (s, x, y, w, head, lines, o = {}) => { if (!lines.length) return y;
    s.addText(head, { x, y, w, h: 0.38, fontFace: F, fontSize: 14, bold: true, color: RP_C.ink }); y += 0.42;
    const rows = lines.reduce((a, l) => a + Math.max(1, Math.ceil(l.length / (w * 7.2))), 0), h = Math.min(6.9 - y, rows * 0.3 + 0.1 * lines.length + 0.1);
    s.addText(lines.map(l => ({ text: l, options: { bullet: o.red ? false : { indent: 14 }, breakLine: true } })), { x, y, w, h, fontFace: F, fontSize: o.size || 12.5, color: o.red ? RP_C.red : RP_C.text, bold: !!o.red, valign: "top", paraSpaceAfter: 4, fit: "shrink" });
    return y + h + 0.18; };
  const maps = (s, imgs, x0, y0, wAll) => { const n = Math.min(3, imgs.length); if (!n) return; const gap = 0.2, w = Math.min(3.4, (wAll - gap * (n - 1)) / n);
    imgs.slice(0, 3).forEach((im, i) => { const h = w / im.ratio, x = x0 + i * (w + gap); s.addImage({ data: im.data, x, y: y0, w, h }); s.addText(im.cap, { x, y: y0 + h + 0.03, w, h: 0.28, fontFace: F, fontSize: 9, color: RP_C.muted, align: "center" }); }); };
  const perMatch = (n, skill) => N.map(x => { const l = ctReal(x.ev).filter(e => e.side === "opp" && e.opp_no === n && e.skill === skill && e.x != null && e.y != null); if (!l.length) return null;
    const res = e => skill === "serve" ? (e.action === "ace" ? "pt" : CT_CNT.srv_err.includes(e.action) ? "err" : "") : CT_CNT.att_pt.includes(e.action) ? "pt" : CT_CNT.att_err.includes(e.action) ? "err" : "";
    return { ...rpCourtPng(l.map(e => ({ x: e.x, y: e.y, k: res(e) }))), cap: mname(x.m) }; }).filter(Boolean);
  // 1. 표지
  { const s = pres.addSlide(); s.background = { color: "FFFFFF" };
    s.addText([...new Set(ms.map(m => m.stage ? `${m.title} ${m.stage}` : m.title))].join(" · ").slice(0, 80), { x: 0.6, y: 1.2, w: 12, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: RP_C.label });
    s.addText(t, { x: 0.6, y: 1.7, w: 12, h: 0.9, fontFace: F, fontSize: 40, bold: true, color: RP_C.ink });
    s.addText(r.title || "", { x: 0.6, y: 2.6, w: 12, h: 0.6, fontFace: F, fontSize: 22, bold: true, color: RP_C.ink });
    s.addText(`분석 경기 ${ms.length}개 · ${r.date_from ? md(parseD(r.date_from)) : ""} ~ ${r.date_to ? md(parseD(r.date_to)) : ""}`, { x: 0.6, y: 3.3, w: 12, h: 0.4, fontFace: F, fontSize: 13, color: RP_C.muted });
    s.addText(`서울대학교 배구부 전략분석  |  ${md(today())} 만듦`, { x: 0.6, y: 6.8, w: 9, h: 0.3, fontFace: F, fontSize: 9, color: RP_C.muted }); }
  // 2. 팀 개요
  { const s = base("팀 개요", "상대 팀의 구조와 핵심 선수"); let y = 1.55;
    y = sect(s, 0.6, y, 12, "경기에서 먼저 기억할 정보", [`세터는 ${setter != null ? setter + "번" + (nm(setter) ? `(${nm(setter)})` : "") : "?"}, 에이스는 ${ace ? ace.no + "번" + (nm(ace.no) ? `(${nm(ace.no)})` : "") : "?"}`, ...rpLines(B.feature), ...rpLines(B.style)]);
    sect(s, 0.6, y, 12, "선수 분석의 중심", [ace ? `${ace.no}번은 공격 점유율 ${ace.점유율}%로 기록된 주 공격수다.` : "주 공격수 기록이 부족하다.", `팀 공격 성공률 ${pct(team.ak, team.at)} · 공격 효율 ${pct(team.ak - team.ae, team.at)} · 리시브 점수 ${rpF2(team.rs)} · 서브 점수 ${rpF2(team.ss)}`], { red: true, size: 13 }); }
  // 3. 스탯 요약 (표)
  { const s = base("선수별 기록", "스탯 요약"); s.addText("서브 수치는 시도 / 에이스 / 범실 순서", { x: 0.6, y: 1.35, w: 9, h: 0.3, fontFace: F, fontSize: 11, color: RP_C.muted });
    const hd = ["번호", "이름", "포지션", "공격 성공률", "공격 효율", "점유율", "서브", "리시브 점수"].map(h => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: RP_C.ink } } }));
    const rows = nos.map(n => { const x = rowOf(n); if (!x || (!x.s.at && !x.s.sv && !x.s.rc)) return null;
      return [String(n), nm(n), posOf(n), rpP(x.성공률), rpP(x.효율), x.s.at ? x.점유율 + "%" : "—", x.s.sv ? `${x.s.sv} / ${x.s.sa} / ${te.filter(e => e.opp_no === n && CT_CNT.srv_err.includes(e.action)).length}` : "—", x.s.rc ? rpF2(x.리시브점수) : "—"]; }).filter(Boolean);
    s.addTable([hd, ...rows.map(r2 => r2.map(c => ({ text: c })))], { x: 0.6, y: 1.75, w: 12.1, colW: [0.8, 1.6, 1, 1.5, 1.4, 1.2, 2.6, 2], fontFace: F, fontSize: Math.max(10, 14 - Math.floor(rows.length / 4)), color: RP_C.text, border: { type: "solid", pt: 0.5, color: "D6D9E0" }, align: "center", valign: "middle", rowH: Math.min(0.42, 5 / (rows.length + 1)) }); }
  // 4. 선수마다
  const label = n => { const p = posOf(n); return ace && ace.no === n ? "주 공격수 대응" : p === "S" ? "세터와 서브 특징" : p === "MB" ? "미들블로커와 서브 특징" : p === "L" ? "리시브와 커버 특징" : "공격 특징과 대응"; };
  const who = n => `${n}번${nm(n) ? " " + nm(n) : ""}${posOf(n) ? " · " + posOf(n) : ""}`;
  const players = [...new Set([...order, ...nos])];
  for (const n of players) {
    const x = rowOf(n); if (!x) continue;
    const at = te.filter(e => e.opp_no === n && e.skill === "attack"), sv = te.filter(e => e.opp_no === n && e.skill === "serve"), rc = te.filter(e => e.opp_no === n && e.skill === "receive");
    const note = rpLines(B["pnote." + n]), atkTxt = rpLines(B["atk." + n]), svTxt = rpLines(B["sv." + n]);
    let made = false;
    if (at.length >= 3 || atkTxt.length) { const s = base(label(n), who(n)), types = rpTop(at.map(e => CT_ATN[e.kind] || "").filter(Boolean), 3).map(([k, v]) => `${k} ${v}`).join(" · ");
      let y = 1.55; y = sect(s, 0.6, y, 6.1, "공격 습관", atkTxt.length ? atkTxt : types ? [`주로 쓰는 공격: ${types}`] : []);
      y = sect(s, 0.6, y, 6.1, "특이사항", note);
      sect(s, 0.6, Math.max(y, 5.6), 6.1, "기록", [`공격 ${at.length}번 · 성공 ${rpP(x.성공률)} · 효율 ${rpP(x.효율)} · 점유율 ${x.점유율 ?? "—"}%`], { red: true, size: 12 });
      maps(s, perMatch(n, "attack"), 7.0, 1.55, 5.8); made = true; }
    if (sv.length >= 3 || svTxt.length) { const s = base(label(n), who(n)), su = ctSum(sv), er = sv.filter(e => CT_CNT.srv_err.includes(e.action)).length, ty = rpTop(sv.map(e => CT_STN[e.kind] || "").filter(Boolean), 2).map(([k, v]) => `${k} ${v}`).join(" · ");
      let y = 1.55; y = sect(s, 0.6, y, 6.1, "서브", svTxt.length ? svTxt : ty ? [`서브 종류: ${ty}`] : []);
      if (!made) y = sect(s, 0.6, y, 6.1, "특이사항", note);
      sect(s, 0.6, Math.max(y, 5.6), 6.1, "기록", [`서브 ${sv.length}회, 에이스 ${su.sa}, 범실 ${er} · 서브 점수 ${rpF2(su.ss)}${svTop.some(o => o.n === n) ? " · 주의할 서브!" : ""}`], { red: true, size: 12 });
      maps(s, perMatch(n, "serve"), 7.0, 1.55, 5.8); made = true; }
    // 공격 · 서브 장이 없으면: 글이 있거나 리베로일 때만 (리시브만 몇 번 한 선수는 장 안 만듦)
    if (!made && (note.length || (posOf(n) === "L" && rc.length >= 3))) { const s = base(rc.length >= 3 || posOf(n) === "L" ? "리시브와 커버 특징" : "기록이 제한된 선수", who(n)); let y = 1.55;
      y = sect(s, 0.6, y, 12, "관찰한 내용", note.length ? note : ["기록된 관찰이 없다."]);
      if (rc.length) y = sect(s, 0.6, y, 12, "리시브", [`리시브 ${rc.length}번 · 리시브 점수 ${rpF2(ctSum(rc).rs)}`], { red: true, size: 12 });
      if (!rc.length && at.length + sv.length < 3) sect(s, 0.6, y, 12, "경기 중 보완 관찰", ["적은 데이터만으로 약점이나 플레이 스타일을 단정하지 않는다."]); }
  }
  // 5. 로테이션 (3개씩 2장)
  if (lm) for (const part of [[1, 2, 3], [4, 5, 6]]) {
    const s = base("로테이션", `로테이션별 강약과 공격 옵션 (${part[0] === 1 ? "1" : "2"}/2)`);
    s.addText(`상대 시작 로테 — 서브로 시작: ${stS.map(([k, v]) => `${k} ${v}세트`).join(" · ") || "—"} / 캐치로 시작: ${stC.map(([k, v]) => `${k} ${v}세트`).join(" · ") || "—"}`, { x: 0.6, y: 1.3, w: 12, h: 0.3, fontFace: F, fontSize: 11, color: RP_C.muted });
    part.forEach((rot, i) => { const x = 0.6 + i * 4.1, w = 3.9, im = rpRotPng(lm, lside, rot, nm), h = w / im.ratio;
      s.addText(`로테이션 ${rot}`, { x, y: 1.7, w, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: RP_C.ink }); s.addImage({ data: im.data, x, y: 2.08, w, h });
      const ph = srv => { const q = rstat(rot, srv), g = (srv ? gS : gC)[rot], l = te.filter(e => e.skill === "attack" && e.opp_rot === rot && (srv ? e.serve === "opp" : e.serve === "us") && e.opp_no != null);
        const o = l.length ? rpTop(l.map(e => e.opp_no), 3).map(([k, v]) => `${k}번 ${Math.round(100 * v / l.length)}%`).join(", ") : "—";
        return [`${srv ? "서브 시" : "캐치 시"}${g ? ` · ${g}` : ""} — ${srv ? "브레이크" : "사이드아웃"} ${q.n ? `${rpPct(q.w, q.n)}% (${q.w}/${q.n})` : "—"}`, `공격 옵션: ${o}`, ...rpLines(B[`rot.${rot}.${srv ? "s" : "c"}`])]; };
      s.addText([...ph(true), ...ph(false)].map((l, j) => ({ text: l, options: { breakLine: true, bold: j === 0 || /^캐치 시/.test(l), color: /^(서브|캐치) 시/.test(l) ? RP_C.ink : RP_C.text } })), { x, y: 2.15 + h, w, h: 6.85 - (2.15 + h), fontFace: F, fontSize: 10.5, valign: "top", paraSpaceAfter: 2, fit: "shrink" }); });
  }
  // 6. 경기 전 공유
  { const s = base("경기 전 공유", "우리 팀의 실전 대응 포인트"); let y = 1.55;
    const tgt = rec.length ? [`서브 1순위는 ${rec[0].n}번${nm(rec[0].n) ? `(${nm(rec[0].n)})` : ""} — 리시브 점수 ${rpF2(rec[0].x.리시브점수)}${B["tgt." + rec[0].n] ? `, ${B["tgt." + rec[0].n]}` : ""}`] : [];
    const warn = rpLines(B.sv_warn).length ? rpLines(B.sv_warn).map(l => "상대 서브: " + l) : svTop.length ? [`상대 서브에서는 ${svTop.map(o => o.n + "번").join(" · ")} 서브를 경계한다 (서브 점수 높은 순).`] : [];
    y = sect(s, 0.6, y, 12.1, "서브", [...tgt, ...warn, ...rpLines(B.f_def)]);
    y = sect(s, 0.6, y, 12.1, "공격", rpLines(B.f_atk));
    y = sect(s, 0.6, y, 12.1, "블로킹과 수비", [...(ace ? [`${ace.no}번의 높은 점유율(${ace.점유율}%)에 맞춰 블록 · 수비를 조정한다.`] : []), ...rpLines(B.def_feat)]);
    sect(s, 0.6, y, 12.1, "멘탈 · 흐름", rpLines(B.f_mind)); }
  return pres;
}
async function rpPptDownload() {
  const r = rpCur(); if (!r) return; if (!rpMatches(r).length) return toast("분석에 쓸 경기가 없어요");
  toast("PPT 만드는 중…");
  try { const p = await rpPptx(r); await p.writeFile({ fileName: `${(r.title || r.opponent + " 분석").replace(/[\\/:*?"<>|]/g, "_")}.pptx` }); }
  catch (e) { toast("PPT를 만들지 못했어요: " + (e && e.message || e)); }
}
