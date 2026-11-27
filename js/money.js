/* ---------- 정산 (총무) ----------
   대회 · 교류전처럼 다녀온 건마다 공동 비용(숙소 · 식비 · 유류비·톨비 · 물품 · 기타)을 모아 같이 간 사람끼리 나눔.
   - 비용마다 낸 사람 · 영수증 사진(비공개 버킷 receipts). 유류비 · 톨비는 영수증 없이 대략(거리 · 연비 · 유가 + 톨비)
   - 운전자 등 사람마다 그때그때 감면: 종류별 면제(숙소 · 식비 · 유류비 …) 또는 금액 감면 → 빠진 몫은 감면 없는 나머지 인원이 나눠 냄
   - 회비 지원은 사람마다 똑같이 빼 줌. 낼 돈은 10원 단위로 올림
   - 사람마다 정산 = 낸 돈(영수증) − 낼 돈 → +면 총무가 보냄, −면 총무에게 보냄. 보냄/받음은 체크만(계좌번호는 저장 안 함)
   - 보기 · 관리 = 총무 · 부주장 · 관리자(주장) [money]. 부원은 내가 낸 비용 올리기 + 내 정산 금액만(settle_mine) */
const ST_CAT = [["lodging", "숙소"], ["food", "식비"], ["car", "유류비·톨비"], ["gear", "물품"], ["etc", "기타"]];
const stCatKo = k => (ST_CAT.find(x => x[0] === k) || [k, k])[1];
const stS = () => state.settle || (state.settle = { list: undefined, items: {}, open: null, mine: undefined, urls: {} });
const stCan = () => can("money");
const stWon = n => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
const stName = pid => { const p = playerOf(pid); return p ? `${pNo(p)}${p.name}` : "(명단에 없음)"; };
const stUid = () => state.session && state.session.user ? state.session.user.id : "";
const stCur = () => { const S = stS(); return (S.list || []).find(t => t.id === S.open) || null; };
const stPer = t => [t.date_from, t.date_to && t.date_to !== t.date_from ? t.date_to : ""].filter(Boolean).map(d => md(parseD(d))).join("~");

async function stLoad() {
  const S = stS(); if (S.list === null) return; S.list = null;
  try {
    if (stCan()) { const [a, b] = await Promise.all([sb.from("settle_trips").select("*").order("created_at", { ascending: false }), sb.from("settle_items").select("*").order("created_at", { ascending: true })]);
      S.list = a.error ? [] : a.data || []; S.items = {}; for (const it of (b.error ? [] : b.data || [])) (S.items[it.trip_id] = S.items[it.trip_id] || []).push(it); }
    else { const [a, b] = await Promise.all([sb.rpc("settle_mine"), sb.from("settle_items").select("*").order("created_at", { ascending: true })]);
      S.list = a && !a.error && Array.isArray(a.data) ? a.data : []; S.items = {}; for (const it of (b.error ? [] : b.data || [])) (S.items[it.trip_id] = S.items[it.trip_id] || []).push(it); }
  } catch (e) { S.list = []; }
  if (state.view === "money") { state.dirty = false; render(); }
}

/* 사람별 금액 (화면 · 정산표 · 저장해 두는 calc 모두 이것) */
function stCalc(t, items) {
  const P = [...new Set(t.members || [])], A = t.adj || {}, owe = {}, paid = {}, tot = {};
  const ex = p => (A[p] && A[p].ex) || [];
  P.forEach(p => { owe[p] = 0; paid[p] = 0; });
  for (const it of items) { tot[it.cat] = (tot[it.cat] || 0) + (it.amount || 0); paid[it.paid_by] = (paid[it.paid_by] || 0) + (it.amount || 0); }
  // 종류별: 그 종류 면제 아닌 사람끼리 똑같이
  for (const [c, T] of Object.entries(tot)) { let E = P.filter(p => !ex(p).includes(c)); if (!E.length) E = P; E.forEach(p => { owe[p] += T / E.length; }); }
  // 금액 감면: 감면 · 면제가 없는 나머지 인원이 나눠 냄
  let D = 0; const off = {};
  P.forEach(p => { off[p] = Math.min(Math.max(0, Number(A[p] && A[p].off) || 0), owe[p]); D += off[p]; owe[p] -= off[p]; });
  let R = P.filter(p => !off[p] && !ex(p).length); if (!R.length) R = P.filter(p => !off[p]); if (!R.length) R = P;
  if (D > 0) R.forEach(p => { owe[p] += D / R.length; });
  // 회비 지원: 사람마다 똑같이(낼 돈보다 많으면 남는 건 다른 사람에게)
  const total = Object.values(tot).reduce((a, b) => a + b, 0);
  let left = Math.min(Math.max(0, Number(t.club) || 0), total), pool = P.filter(p => owe[p] > 0.5);
  while (left > 0.5 && pool.length) { const each = left / pool.length; let used = 0; for (const p of pool) { const d = Math.min(each, owe[p]); owe[p] -= d; used += d; } left -= used; pool = pool.filter(p => owe[p] > 0.5); if (used < 0.5) break; }
  const ids = [...P, ...Object.keys(paid).filter(p => !P.includes(p))];
  const rows = ids.map(p => { const o = P.includes(p) ? Math.ceil(Math.round(owe[p]) / 10) * 10 : 0, pd = paid[p] || 0; return { pid: p, owe: o, paid: pd, net: pd - o }; });
  return { rows, tot, total, club: Math.min(Number(t.club) || 0, total), off: D };
}
const stCalcMap = c => Object.fromEntries(c.rows.map(r => [r.pid, { owe: r.owe, paid: r.paid, net: r.net }]));
// 총무 화면에서 계산이 바뀌었으면 저장 → 부원 '내 정산'에 보임
let stSaveT = null;
function stPersist(t, c) {
  const m = stCalcMap(c); if (JSON.stringify(m) === JSON.stringify(t.calc || {})) return;
  t.calc = m; t.calc_at = new Date().toISOString();
  clearTimeout(stSaveT); stSaveT = setTimeout(async () => { try { ok(await sb.from("settle_trips").update({ calc: t.calc, calc_at: t.calc_at, updated_at: t.calc_at }).eq("id", t.id)); } catch (e) { /* 다음에 다시 */ } }, 400);
}

/* ---- 화면 ---- */
function viewMoney() {
  const S = stS();
  if (S.list === undefined) { stLoad(); return `<section class="sec"><h2>정산</h2>${loaderHtml(true)}</section>`; }
  if (S.list === null) return `<section class="sec"><h2>정산</h2>${loaderHtml(true)}</section>`;
  if (stCan()) return S.open && stCur() ? stTripView(stCur()) : stListView();
  return S.open ? stMineTrip() : stMineList();
}
function stListView() {
  const S = stS();
  return `<section class="sec"><div class="sec-head"><h2>정산</h2><button class="btn add" type="button" data-act="stnew">＋ 정산</button></div>
    ${S.list.length ? `<div class="sc-list">${S.list.map(t => { const its = S.items[t.id] || [], c = stCalc(t, its), wait = its.filter(x => !x.ok).length;
      return `<button type="button" class="panel sc-card" data-act="stopen" data-id="${esc(t.id)}"><b>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</b><span class="small muted">${esc([stPer(t), `${(t.members || []).length}명`, `비용 ${stWon(c.total)}`, wait ? `확인 전 ${wait}건` : ""].filter(Boolean).join(" · "))}</span><span class="go">›</span></button>`; }).join("")}</div>`
      : emptyLine("대회 · 교류전을 다녀오면 정산을 만들어 비용을 모아요.")}</section>`;
}
function stTripView(t) {
  const S = stS(), its = S.items[t.id] || [], c = stCalc(t, its), A = t.adj || {}, done = t.done || {};
  stPersist(t, c);
  const tag = p => { const a = A[p] || {}, l = []; if (a.drive) l.push("운전"); if ((a.ex || []).length) l.push((a.ex || []).map(stCatKo).join("·") + " 면제"); if (a.off) l.push(`${stWon(a.off)} 감면`); return l.join(" · "); };
  const send = c.rows.filter(r => r.net > 0).reduce((a, r) => a + r.net, 0), get = c.rows.filter(r => r.net < 0).reduce((a, r) => a - r.net, 0);
  const rows = c.rows.map(r => { const d = done[r.pid], cls = r.net > 0 ? "st-get" : r.net < 0 ? "st-pay" : "";
    return `<tr><td><button type="button" class="st-who" data-act="stadj" data-p="${esc(r.pid)}" ${t.closed ? "disabled" : ""}><b>${esc(stName(r.pid))}</b>${tag(r.pid) ? `<small>${esc(tag(r.pid))}</small>` : ""}</button></td><td class="num st-op"><span>낼 ${stWon(r.owe)}</span><span>낸 ${r.paid ? stWon(r.paid) : "—"}</span></td>
      <td class="num st-net"><b class="${cls}">${r.net > 0 ? `보냄 ${stWon(r.net)}` : r.net < 0 ? `받음 ${stWon(-r.net)}` : "—"}</b>${r.net ? `<button type="button" class="chip st-done ${d ? "on" : ""}" data-act="stdone" data-p="${esc(r.pid)}">${d ? "✓ 끝" : "확인"}</button>` : ""}</td></tr>`; }).join("");
  const items = ST_CAT.map(([k, l]) => { const g = its.filter(x => x.cat === k); if (!g.length) return "";
    return `<h4>${l} <span class="small muted">${stWon(c.tot[k])}</span></h4><ul class="st-items">${g.map(x => stItemLine(x, true, t)).join("")}</ul>`; }).join("");
  return `<section class="sec"><div class="sec-head"><h2>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</h2><button class="btn link small" type="button" data-act="stedit">수정</button></div>
    <p class="small muted">${esc([stPer(t), `${(t.members || []).length}명`, t.club ? `회비 지원 ${stWon(t.club)}` : ""].filter(Boolean).join(" · "))}</p>
    <div class="st-sum"><div><span class="small muted">총 비용</span><b>${stWon(c.total)}</b></div><div><span class="small muted">총무가 보낼 돈</span><b>${stWon(send)}</b></div><div><span class="small muted">총무가 받을 돈</span><b>${stWon(get)}</b></div></div>
    ${c.rows.length ? `<h3>사람별</h3><div class="tw"><table class="st-t"><thead><tr><th>이름</th><th>낼 돈 · 낸 돈</th><th>총무 기준</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">이름을 누르면 운전 · 면제 · 감면. 빠진 몫은 감면 없는 사람이 나눠 내요.</p>` : ""}
    <div class="sec-head"><h3>비용</h3>${t.closed ? "" : `<button class="btn add small" type="button" data-act="stitem">＋ 비용</button>`}</div>
    ${items || emptyLine("영수증을 올리거나 비용을 넣어요. 부원도 자기가 낸 비용을 올릴 수 있어요.")}
    <div class="row st-foot"><button class="btn small" type="button" data-act="stcopy">정산표 복사</button><button class="btn small" type="button" data-act="stclose">${t.closed ? "다시 열기" : "정산 끝내기"}</button></div></section>`;
}
function stItemLine(x, mgr, t) {
  const S = stS(), canEdit = mgr ? !(t && t.closed) : !x.ok && !(t && t.closed);
  const pics = (x.receipts || []).map((p, i) => S.urls[p] ? `<a href="${esc(S.urls[p])}" target="_blank" rel="noopener"><img class="st-pic" src="${esc(S.urls[p])}" alt="영수증 ${i + 1}"></a>` : `<span class="st-pic st-pic0">영수증</span>`).join("");
  return `<li class="st-item"><div class="st-it-main"><b>${esc(x.title || stCatKo(x.cat))}</b><span class="small muted">${esc(stName(x.paid_by))}${x.approx ? " · 대략" : ""}${!x.approx && !(x.receipts || []).length ? " · 영수증 없음" : ""}</span>${pics ? `<span class="st-pics">${pics}</span>` : ""}</div>
    <span class="num"><b>${stWon(x.amount)}</b></span>
    ${mgr ? `<button type="button" class="chip st-ok ${x.ok ? "on" : ""}" data-act="stok" data-id="${esc(x.id)}">${x.ok ? "✓ 확인" : "확인"}</button>` : `<span class="chip ${x.ok ? "on" : ""}">${x.ok ? "✓ 확인" : "확인 전"}</span>`}
    ${canEdit ? `<button class="btn link small" type="button" data-act="stitem" data-id="${esc(x.id)}">수정</button>` : ""}</li>`;
}
// 영수증 사진은 비공개 → 그때그때 서명 주소
let stUrlBusy = false;
async function stSignUrls() {
  const S = stS(); if (stUrlBusy) return;
  const need = [...new Set(Object.values(S.items).flat().flatMap(x => x.receipts || []))].filter(p => !S.urls[p]); if (!need.length) return;
  stUrlBusy = true;
  try { const r = await sb.storage.from("receipts").createSignedUrls(need, 60 * 60); for (const x of (r && r.data) || []) if (x.signedUrl) S.urls[x.path] = x.signedUrl; } catch (e) { /* 사진 없이 */ }
  for (const p of need) if (!S.urls[p]) S.urls[p] = ""; // 못 받은 건 다시 안 부름
  stUrlBusy = false; if (state.view === "money") { state.dirty = false; render(); }
}

/* 부원: 내 정산 */
function stMineList() {
  const S = stS();
  return `<section class="sec"><h2>내 정산</h2>${S.list.length ? `<div class="sc-list">${S.list.map(t => { const m = t.mine || null;
    const v = !m ? "총무 정리 전" : m.net > 0 ? `받을 돈 ${stWon(m.net)}` : m.net < 0 ? `보낼 돈 ${stWon(-m.net)}` : "정산할 돈 없음";
    return `<button type="button" class="panel sc-card" data-act="stopen" data-id="${esc(t.id)}"><b>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</b><span class="small muted">${esc([stPer(t), v, t.done_at ? "✓ 끝" : ""].filter(Boolean).join(" · "))}</span><span class="go">›</span></button>`; }).join("")}</div>`
    : emptyLine("같이 간 대회 · 교류전 정산이 생기면 여기에 떠요.")}</section>`;
}
function stMineTrip() {
  const S = stS(), t = (S.list || []).find(x => x.id === S.open); if (!t) { S.open = null; return stMineList(); }
  const m = t.mine || null, its = (S.items[t.id] || []).filter(x => x.paid_by === state.myPid || x.author === stUid());
  return `<section class="sec"><h2>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</h2><p class="small muted">${esc([stPer(t), `${t.n || 0}명`].filter(Boolean).join(" · "))}</p>
    <div class="st-sum"><div><span class="small muted">내가 낼 돈</span><b>${m ? stWon(m.owe) : "—"}</b></div><div><span class="small muted">내가 낸 돈</span><b>${m ? stWon(m.paid) : "—"}</b></div>
      <div><span class="small muted">정산</span><b class="${m && m.net > 0 ? "st-get" : m && m.net < 0 ? "st-pay" : ""}">${!m ? "총무 정리 전" : m.net > 0 ? `받을 돈 ${stWon(m.net)}` : m.net < 0 ? `보낼 돈 ${stWon(-m.net)}` : "없음"}</b></div></div>
    ${t.calc_at ? `<p class="small muted">${md(new Date(t.calc_at))} ${stHm(new Date(t.calc_at))} 총무 정리 기준${t.done_at ? " · ✓ 끝" : ""}</p>` : ""}
    <div class="sec-head"><h3>내가 낸 비용</h3>${t.closed ? "" : `<button class="btn add small" type="button" data-act="stitem">＋ 비용</button>`}</div>
    ${its.length ? `<ul class="st-items">${its.map(x => stItemLine(x, false, t)).join("")}</ul>` : emptyLine("같이 쓰려고 산 게 있으면 영수증과 함께 올려요.")}</section>`;
}
const stHm = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/* ---- 정산 만들기 · 수정 ---- */
function stSchedOpts() {
  const t = iso(today()), from = dAdd(t, -120), to = dAdd(t, 30), out = [];
  for (const e of state.events || []) if (["major", "minor"].includes(e.kind) && e.end >= from && e.start <= to) out.push({ k: `event:${e.id}`, name: e.name, d: e.start, end: e.end });
  for (const [d, fs] of Object.entries(state.friendlies || {})) if (d >= from && d <= to) for (const f of fs) out.push({ k: `friendly:${f.id}`, name: frName(f.opponent), d, end: d });
  return out.sort((a, b) => b.d.localeCompare(a.d));
}
function stDefMembers(k) {
  const [kind, id] = k.split(":"), en = [...entryOf(kind, id)]; if (en.length) return en;
  return Object.entries(evVotesOf(kind, id)).filter(([, v]) => v.going).map(([p]) => p);
}
function stTripForm(t) {
  const el = document.getElementById("sheet"), opts = stSchedOpts(), mem = new Set(t ? t.members || [] : []);
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${t ? "정산 수정" : "새 정산"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stTripForm" data-id="${t ? esc(t.id) : ""}"><div class="fields">
      ${opts.length ? `<label class="fl wide">일정에서 고르기<select id="st-ref"><option value="">직접 입력</option>${opts.map(o => `<option value="${esc(o.k)}" data-n="${esc(o.name)}" data-d="${o.d}" data-e="${o.end}" ${t && t.ref_id && o.k === `${t.ref_kind}:${t.ref_id}` ? "selected" : ""}>${esc(o.name)} · ${md(parseD(o.d))}</option>`).join("")}</select></label>` : ""}
      <label class="fl wide">이름<input id="st-title" required maxlength="60" value="${esc(t ? t.title : "")}" placeholder="예: 서울대배 원정"></label>
      <label class="fl">시작<input type="date" id="st-from" value="${t ? t.date_from || "" : ""}"></label><label class="fl">끝<input type="date" id="st-to" value="${t ? t.date_to || "" : ""}"></label>
      <label class="fl">회비 지원(원)<input type="number" id="st-club" min="0" step="1000" inputmode="numeric" value="${t && t.club ? t.club : ""}" placeholder="0"></label>
      <div class="fl wide">같이 간 사람 <span class="small muted" id="st-n"></span><div class="st-mem">${sortedPlayers().map(p => `<label class="rp-ck"><input type="checkbox" name="st-m" value="${esc(p.id)}" ${mem.has(p.id) ? "checked" : ""}> ${esc(pNo(p) + p.name)}</label>`).join("")}</div></div>
    </div><div class="row"><button class="btn primary" type="submit">${t ? "저장" : "만들기"}</button></div>
    ${t ? `<div class="del-zone"><button class="btn danger small" type="button" data-act="stdel">정산 삭제</button></div>` : ""}</form>`;
  el.hidden = false; document.body.classList.add("noscroll"); stCountMem();
}
function stCountMem() { const n = document.getElementById("st-n"); if (n) n.textContent = `${document.querySelectorAll('input[name="st-m"]:checked').length}명`; }
document.addEventListener("change", e => {
  const el = e.target; if (!el || !el.closest) return;
  if (el.name === "st-m") return stCountMem();
  if (el.id === "st-ref" && el.value) { const o = el.selectedOptions[0], set = (id, v) => { const x = document.getElementById(id); if (x) x.value = v; };
    set("st-title", o.dataset.n); set("st-from", o.dataset.d); set("st-to", o.dataset.e);
    const def = new Set(stDefMembers(el.value)); if (def.size) document.querySelectorAll('input[name="st-m"]').forEach(x => { x.checked = def.has(x.value); }); stCountMem(); }
  if (el.id === "st-cat") stCarBox();
});
async function stTripSave(f) {
  const v = id => (document.getElementById(id) || {}).value || "", ref = v("st-ref"), [rk, rid] = ref ? ref.split(":") : [null, null];
  const row = { title: v("st-title").trim(), date_from: v("st-from") || null, date_to: v("st-to") || v("st-from") || null, club: Math.max(0, Math.round(Number(v("st-club")) || 0)),
    members: [...document.querySelectorAll('input[name="st-m"]:checked')].map(x => x.value), ref_kind: rk, ref_id: rid, updated_at: new Date().toISOString() };
  if (!row.title) return toast("이름을 넣어 주세요");
  if (row.date_from && row.date_to && row.date_from > row.date_to) return toast("시작이 끝보다 뒤예요");
  const S = stS();
  try {
    if (f.dataset.id) { ok(await sb.from("settle_trips").update(row).eq("id", f.dataset.id)); Object.assign(S.list.find(x => x.id === f.dataset.id) || {}, row); }
    else { const r = await sb.from("settle_trips").insert(row).select().maybeSingle(); ok(r); const t = { adj: {}, done: {}, calc: {}, closed: false, ...row, ...(r.data || {}) }; S.list = [t, ...(S.list || [])]; S.open = t.id; pushInner(); }
    closeSheet(); state.dirty = false; render(); window.scrollTo(0, 0); toast(f.dataset.id ? "고쳤어요" : "정산을 만들었어요");
  } catch (e) { toast(failMsg(e)); }
}

/* ---- 사람마다: 운전 · 면제 · 금액 감면 ---- */
function stAdjForm(pid) {
  const t = stCur(), a = (t.adj || {})[pid] || {}, el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${esc(stName(pid))}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stAdjForm" data-p="${esc(pid)}"><div class="fields">
      <label class="rp-ck wide"><input type="checkbox" id="sa-drive" ${a.drive ? "checked" : ""}> 운전</label>
      <div class="fl wide">면제 (이 종류는 안 냄)<span class="row">${ST_CAT.map(([k, l]) => `<label class="rp-ck"><input type="checkbox" name="sa-ex" value="${k}" ${(a.ex || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</span></div>
      <label class="fl">금액 감면(원)<input type="number" id="sa-off" min="0" step="1000" inputmode="numeric" value="${a.off || ""}" placeholder="0"></label>
      <p class="small muted wide">빠진 몫은 감면 · 면제 없는 사람끼리 나눠 내요. 운전을 켜면 유류비·톨비는 기본으로 면제.</p>
    </div><div class="row"><button class="btn primary" type="submit">저장</button>${(t.members || []).includes(pid) ? `<button class="btn link small" type="button" data-act="stout" data-p="${esc(pid)}">이번 정산에서 빼기</button>` : ""}</div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
document.addEventListener("change", e => { if (e.target && e.target.id === "sa-drive" && e.target.checked) { const c = document.querySelector('input[name="sa-ex"][value="car"]'); if (c) c.checked = true; } });
async function stAdjSave(f) {
  const t = stCur(), pid = f.dataset.p, a = { drive: document.getElementById("sa-drive").checked, ex: [...document.querySelectorAll('input[name="sa-ex"]:checked')].map(x => x.value), off: Math.max(0, Math.round(Number(document.getElementById("sa-off").value) || 0)) };
  const adj = { ...(t.adj || {}) }; if (!a.drive && !a.ex.length && !a.off) delete adj[pid]; else adj[pid] = a;
  try { ok(await sb.from("settle_trips").update({ adj, updated_at: new Date().toISOString() }).eq("id", t.id)); t.adj = adj; closeSheet(); state.dirty = false; render(); } catch (e) { toast(failMsg(e)); }
}

/* ---- 비용 (영수증) ---- */
function stItemForm(id) {
  const S = stS(), mgr = stCan(), t = mgr ? stCur() : (S.list || []).find(x => x.id === S.open), x = id ? (S.items[t.id] || []).find(y => y.id === id) : null, el = document.getElementById("sheet");
  const who = mgr ? [...new Set([...(t.members || []), ...(x ? [x.paid_by] : [])])] : [];
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${x ? "비용 수정" : "비용 올리기"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stItemForm" data-id="${x ? esc(x.id) : ""}"><div class="fields">
      <label class="fl">종류<select id="st-cat">${ST_CAT.map(([k, l]) => `<option value="${k}" ${x && x.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">금액(원)<input type="number" id="st-amt" required min="0" step="10" inputmode="numeric" value="${x ? x.amount : ""}"></label>
      <label class="fl wide">내용<input id="st-it" maxlength="60" value="${esc(x ? x.title || "" : "")}" placeholder="예: 숙소 2박 · 이마트 물 · 저녁 고깃집"></label>
      ${mgr ? `<label class="fl wide">낸 사람<select id="st-by">${who.map(p => `<option value="${esc(p)}" ${x && x.paid_by === p ? "selected" : ""}>${esc(stName(p))}</option>`).join("")}</select></label>` : ""}
      <div class="fl wide" id="st-carbox"></div>
      <label class="fl wide">영수증 사진${x && (x.receipts || []).length ? ` <span class="small muted">(${x.receipts.length}장 있음, 새로 고르면 더함)</span>` : ""}<input type="file" id="st-files" accept="image/*" multiple></label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "올리기"}</button></div>
    ${x ? `<div class="del-zone"><button class="btn danger small" type="button" data-act="stitemdel" data-id="${esc(x.id)}">비용 삭제</button></div>` : ""}</form>`;
  el.hidden = false; document.body.classList.add("noscroll"); stCarBox(x);
}
// 유류비 · 톨비는 영수증 없이 대략: 왕복 거리 ÷ 연비 × 유가 + 톨비 (100원 단위)
function stCarBox(x) {
  const box = document.getElementById("st-carbox"); if (!box) return;
  if (document.getElementById("st-cat").value !== "car") { box.innerHTML = ""; return; }
  box.innerHTML = `<details class="st-car" ${x && x.approx ? "" : "open"}><summary>대략 계산 (영수증 없을 때)</summary><div class="fields">
    <label class="fl">왕복 거리(km)<input type="number" id="sc-km" min="0" inputmode="decimal"></label><label class="fl">연비(km/L)<input type="number" id="sc-eff" min="1" step="0.1" value="12" inputmode="decimal"></label>
    <label class="fl">유가(원/L)<input type="number" id="sc-price" min="0" step="10" value="1650" inputmode="numeric"></label><label class="fl">톨비(원)<input type="number" id="sc-toll" min="0" step="100" inputmode="numeric"></label>
    <div class="row wide"><button class="btn small" type="button" data-act="stcarcalc">계산해서 금액에 넣기</button><span class="small muted" id="sc-out"></span></div></div></details>
    <label class="rp-ck"><input type="checkbox" id="st-approx" ${!x || x.approx ? "checked" : ""}> 대략 금액 (영수증 없음)</label>`;
}
function stCarCalc() {
  const n = id => Number((document.getElementById(id) || {}).value) || 0, km = n("sc-km"), eff = n("sc-eff") || 12, pr = n("sc-price"), toll = n("sc-toll");
  if (!km && !toll) return toast("거리나 톨비를 넣어 주세요");
  const fuel = Math.round(km / eff * pr / 100) * 100, sum = fuel + Math.round(toll);
  document.getElementById("st-amt").value = sum; document.getElementById("sc-out").textContent = `주유 약 ${stWon(fuel)} + 톨비 ${stWon(toll)} = ${stWon(sum)}`;
  const it = document.getElementById("st-it"); if (it && !it.value) it.value = `유류비${toll ? "·톨비" : ""} (${km}km)`;
}
async function stItemSave(f) {
  const S = stS(), mgr = stCan(), t = mgr ? stCur() : (S.list || []).find(x => x.id === S.open), old = f.dataset.id ? (S.items[t.id] || []).find(y => y.id === f.dataset.id) : null;
  const amt = Math.round(Number(document.getElementById("st-amt").value)); if (!(amt >= 0)) return toast("금액을 넣어 주세요");
  const cat = document.getElementById("st-cat").value, files = [...(document.getElementById("st-files").files || [])].slice(0, 6), ap = document.getElementById("st-approx");
  const row = { cat, amount: amt, title: document.getElementById("st-it").value.trim() || null, paid_by: mgr ? document.getElementById("st-by").value : state.myPid, approx: cat === "car" && !!(ap && ap.checked) };
  if (!row.paid_by) return toast("명단에 연결된 계정만 비용을 올릴 수 있어요");
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const paths = [];
    if (files.length) { toast("영수증 올리는 중…");
      for (const [i, fl] of files.entries()) { const blob = await shrinkImage(fl), p = `${TEAM.id}/${t.id}/${stUid()}/${Date.now()}-${i}.jpg`;
        const up = await sb.storage.from("receipts").upload(p, blob, { contentType: "image/jpeg" }); if (up && up.error) throw up.error; paths.push(p); } }
    row.receipts = [...(old ? old.receipts || [] : []), ...paths].slice(0, 6);
    if (old) { ok(await sb.from("settle_items").update(row).eq("id", old.id)); Object.assign(old, row); }
    else { const r = await sb.from("settle_items").insert({ ...row, trip_id: t.id }).select().maybeSingle(); ok(r); (S.items[t.id] = S.items[t.id] || []).push({ ok: false, receipts: [], author: stUid(), ...row, trip_id: t.id, ...(r.data || {}) }); }
    closeSheet(); state.dirty = false; render(); toast(old ? "고쳤어요" : "올렸어요");
  } catch (e) { toast(failMsg(e)); btn.disabled = false; }
}

/* ---- 정산표 (카톡에 붙여 넣기) ---- */
function stText(t) {
  const c = stCalc(t, stS().items[t.id] || []), L = [`[${t.title} 정산]${stPer(t) ? " " + stPer(t) : ""}`, `총 비용 ${stWon(c.total)}${c.club ? ` (회비 지원 ${stWon(c.club)})` : ""}`];
  for (const [k, l] of ST_CAT) if (c.tot[k]) L.push(`- ${l} ${stWon(c.tot[k])}`);
  L.push("");
  const pay = c.rows.filter(r => r.net < 0), get = c.rows.filter(r => r.net > 0);
  if (pay.length) { L.push("총무에게 보낼 돈"); for (const r of pay) L.push(`${stName(r.pid)} ${stWon(-r.net)}`); L.push(""); }
  if (get.length) { L.push("총무가 보낼 돈 (먼저 낸 비용)"); for (const r of get) L.push(`${stName(r.pid)} ${stWon(r.net)}`); }
  return L.join("\n").trim();
}

/* ---- 버튼 ---- */
async function stClick(b, act) {
  const S = stS();
  if (act === "stnew") return stTripForm(null);
  if (act === "stopen") { pushInner(); S.open = b.dataset.id; state.dirty = false; render(); window.scrollTo(0, 0); stSignUrls(); return; }
  if (act === "stedit") return stTripForm(stCur());
  if (act === "stadj") return stAdjForm(b.dataset.p);
  if (act === "stitem") return stItemForm(b.dataset.id || null);
  if (act === "stcarcalc") return stCarCalc();
  const t = stCan() ? stCur() : null;
  if (act === "stout" && t) {
    const members = (t.members || []).filter(p => p !== b.dataset.p), adj = { ...(t.adj || {}) }; delete adj[b.dataset.p];
    try { ok(await sb.from("settle_trips").update({ members, adj, updated_at: new Date().toISOString() }).eq("id", t.id)); t.members = members; t.adj = adj; closeSheet(); state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return;
  }
  if (act === "stok" && t) { const x = (S.items[t.id] || []).find(y => y.id === b.dataset.id); if (!x) return;
    try { ok(await sb.from("settle_items").update({ ok: !x.ok }).eq("id", x.id)); x.ok = !x.ok; state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stdone" && t) { const done = { ...(t.done || {}) }; if (done[b.dataset.p]) delete done[b.dataset.p]; else done[b.dataset.p] = new Date().toISOString();
    try { ok(await sb.from("settle_trips").update({ done }).eq("id", t.id)); t.done = done; state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stclose" && t) { try { ok(await sb.from("settle_trips").update({ closed: !t.closed, updated_at: new Date().toISOString() }).eq("id", t.id)); t.closed = !t.closed; state.dirty = false; render(); toast(t.closed ? "정산을 끝냈어요" : "다시 열었어요"); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stcopy" && t) { const s = stText(t); try { await navigator.clipboard.writeText(s); toast("정산표를 복사했어요"); } catch (e) { window.prompt("복사해서 쓰세요", s); } return; }
  if (act === "stdel" && t) { if (!await confirmDel(`${t.title} 정산을 지울까요?\n비용 · 영수증 기록도 같이 지워져요.`)) return;
    try { const ps = (S.items[t.id] || []).flatMap(x => x.receipts || []); ok(await sb.from("settle_trips").delete().eq("id", t.id)); if (ps.length) { try { await sb.storage.from("receipts").remove(ps); } catch (e) { /* 사진은 남아도 됨 */ } }
      S.list = S.list.filter(x => x.id !== t.id); delete S.items[t.id]; S.open = null; closeSheet(); state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stitemdel") { const tt = stCan() ? stCur() : (S.list || []).find(x => x.id === S.open), x = (S.items[tt.id] || []).find(y => y.id === b.dataset.id); if (!x || !await confirmDel("이 비용을 지울까요?")) return;
    try { ok(await sb.from("settle_items").delete().eq("id", x.id)); if ((x.receipts || []).length) { try { await sb.storage.from("receipts").remove(x.receipts); } catch (e) { /* 남아도 됨 */ } }
      S.items[tt.id] = S.items[tt.id].filter(y => y.id !== x.id); closeSheet(); state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } return; }
}
