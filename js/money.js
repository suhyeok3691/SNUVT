/* ---------- 정산 (총무) ----------
   대회 · 교류전처럼 다녀온 건마다 공동 비용(숙소 · 식비 · 유류비·톨비 · 물품 · 기타)을 모아 같이 간 사람끼리 나눔. 손으로 하던 "OO 정산 공지" 방식 그대로:
   - 비용마다 낸 사람 · 영수증 사진(비공개 버킷 receipts). 유류비 · 톨비는 차마다 달라서 운전자가 직접 적음(영수증 없이, 계산 안 함)
   - 사람마다 그때그때: 운전(기본 = 전부 면제) · 종류별 면제 · 정액(늦참 · 매니저 "1만 원만") · 금액 감면 → 빠진 몫은 아무 조정 없는 나머지 인원이 나눠 냄
   - 회비 지원은 사람마다 똑같이 빼 줌. 낼 돈은 올림 단위(기본 1,000원)로 올림
   - 사람마다 정산 = 낸 돈 − 낼 돈 → +면 총무가 보냄, −면 총무에게 보냄. 보냄/받음은 체크만(계좌번호는 앱에 저장 안 함, 공지 글에 총무가 직접 적음)
   - 내역은 부원 모두 봄(투명하게). 관리 = 총무 · 부주장 · 관리자(주장) [money], 부원은 내가 낸 비용 올리기 · 고치기(총무 확인 전까지)
   - 정산을 만들면 "비용 올려 주세요" 공지, 다 모이면 "정산 공지"(예전 카톡 공지 모양, 고쳐서 올림) */
const ST_CAT = [["lodging", "숙소"], ["food", "식비"], ["car", "유류비·톨비"], ["gear", "물품"], ["etc", "기타"]];
const ST_ROUND = [[10, "10원"], [100, "100원"], [1000, "1,000원"], [10000, "1만 원"]];
const stCatKo = k => (ST_CAT.find(x => x[0] === k) || [k, k])[1];
const stS = () => state.settle || (state.settle = { list: undefined, items: {}, open: null, urls: {} });
const stCan = () => can("money");
const stWon = n => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
const stPl = pid => playerOf(pid) || (state.alumni || []).find(x => x.id === pid) || null;
const stName = pid => { const p = stPl(pid); return p ? `${pNo(p)}${p.name}` : "(명단에 없음)"; };
const stShort = pid => { const p = stPl(pid); return p ? p.name : "?"; };
const stUid = () => state.session && state.session.user ? state.session.user.id : "";
const stCur = () => { const S = stS(); return (S.list || []).find(t => t.id === S.open) || null; };
const stPer = t => [t.date_from, t.date_to && t.date_to !== t.date_from ? t.date_to : ""].filter(Boolean).map(d => md(parseD(d))).join("~");
const stMine = x => x.paid_by === state.myPid || x.author === stUid();

async function stLoad() {
  const S = stS(); if (S.list === null) return; S.list = null;
  try { const [a, b] = await Promise.all([sb.from("settle_trips").select("*").order("created_at", { ascending: false }), sb.from("settle_items").select("*").order("created_at", { ascending: true })]);
    S.list = a.error ? [] : a.data || []; S.items = {}; for (const it of (b.error ? [] : b.data || [])) (S.items[it.trip_id] = S.items[it.trip_id] || []).push(it);
  } catch (e) { S.list = []; }
  if (state.view === "money") { state.dirty = false; render(); }
}

/* 사람별 금액 (화면 · 정산 공지 모두 이것) */
function stCalc(t, items) {
  const P = [...new Set(t.members || [])], A = t.adj || {}, owe = {}, paid = {}, tot = {};
  const ad = p => A[p] || {}, ex = p => ad(p).ex || [], fixOf = p => { const v = ad(p).fix; return v === "" || v == null ? null : Math.max(0, Number(v) || 0); };
  P.forEach(p => { owe[p] = 0; paid[p] = 0; });
  for (const it of items) { tot[it.cat] = (tot[it.cat] || 0) + (it.amount || 0); paid[it.paid_by] = (paid[it.paid_by] || 0) + (it.amount || 0); }
  // 1) 종류마다 그 종류 면제 아닌 사람끼리 똑같이
  for (const [c, T] of Object.entries(tot)) { let E = P.filter(p => !ex(p).includes(c)); if (!E.length) E = P; E.forEach(p => { owe[p] += T / E.length; }); }
  // 2) 정액 · 금액 감면: 차액은 아무 조정 없는 나머지 인원이 나눠 냄
  let D = 0;
  P.forEach(p => { const f = fixOf(p); if (f != null) { D += owe[p] - f; owe[p] = f; } else { const o = Math.min(Math.max(0, Number(ad(p).off) || 0), owe[p]); D += o; owe[p] -= o; } });
  let R = P.filter(p => fixOf(p) == null && !ad(p).off && !ex(p).length); if (!R.length) R = P.filter(p => fixOf(p) == null); if (!R.length) R = P;
  if (Math.abs(D) > 0.5) R.forEach(p => { owe[p] = Math.max(0, owe[p] + D / R.length); });
  // 3) 회비 지원: 사람마다 똑같이(낼 돈보다 많으면 남는 건 다른 사람에게)
  const total = Object.values(tot).reduce((a, b) => a + b, 0);
  let left = Math.min(Math.max(0, Number(t.club) || 0), total), pool = P.filter(p => owe[p] > 0.5);
  while (left > 0.5 && pool.length) { const each = left / pool.length; let used = 0; for (const p of pool) { const d = Math.min(each, owe[p]); owe[p] -= d; used += d; } left -= used; pool = pool.filter(p => owe[p] > 0.5); if (used < 0.5) break; }
  // 4) 올림 단위
  const u = Number(t.round_to) || 1000, ids = [...P, ...Object.keys(paid).filter(p => !P.includes(p))];
  const rows = ids.map(p => { const o = P.includes(p) ? Math.ceil(Math.round(owe[p]) / u) * u : 0, pd = paid[p] || 0; return { pid: p, owe: o, paid: pd, net: pd - o }; });
  return { rows, tot, total, club: Math.min(Number(t.club) || 0, total) };
}

/* ---- 화면 ---- */
function viewMoney() {
  const S = stS();
  if (S.list === undefined) { stLoad(); return `<section class="sec"><h2>정산</h2>${loaderHtml(true)}</section>`; }
  if (S.list === null) return `<section class="sec"><h2>정산</h2>${loaderHtml(true)}</section>`;
  return S.open && stCur() ? stTripView(stCur()) : stListView();
}
function stListView() {
  const S = stS(), me = state.myPid;
  return `<section class="sec"><div class="sec-head"><h2>정산</h2>${stCan() ? `<button class="btn add" type="button" data-act="stnew">＋ 정산</button>` : ""}</div>
    ${S.list.length ? `<div class="sc-list">${S.list.map(t => { const its = S.items[t.id] || [], c = stCalc(t, its), wait = its.filter(x => !x.ok).length, r = c.rows.find(x => x.pid === me);
      const mine = r ? r.net > 0 ? `받을 돈 ${stWon(r.net)}` : r.net < 0 ? `낼 돈 ${stWon(-r.net)}` : "" : "";
      return `<button type="button" class="panel sc-card" data-act="stopen" data-id="${esc(t.id)}"><b>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</b><span class="small muted">${esc([stPer(t), `${(t.members || []).length}명`, `비용 ${stWon(c.total)}`, mine ? `나: ${mine}${(t.done || {})[me] ? " ✓" : ""}` : "", stCan() && wait ? `확인 전 ${wait}건` : ""].filter(Boolean).join(" · "))}</span><span class="go">›</span></button>`; }).join("")}</div>`
      : emptyLine(stCan() ? "대회 · 교류전을 다녀오면 정산을 만들어 비용을 모아요." : "아직 정산이 없어요.")}</section>`;
}
const stTag = (t, p) => { const a = (t.adj || {})[p] || {}, l = []; if (a.drive) l.push("운전"); const ex = a.ex || [];
  if (ex.length) l.push(ex.length === ST_CAT.length ? "전부 면제" : ex.map(stCatKo).join("·") + " 면제"); if (a.fix != null && a.fix !== "") l.push(`정액 ${stWon(a.fix)}`); if (a.off) l.push(`${stWon(a.off)} 감면`); return l.join(" · "); };
function stTripView(t) {
  const S = stS(), mgr = stCan(), its = S.items[t.id] || [], c = stCalc(t, its), done = t.done || {}, me = state.myPid, inTrip = (t.members || []).includes(me);
  const send = c.rows.filter(r => r.net > 0).reduce((a, r) => a + r.net, 0), get = c.rows.filter(r => r.net < 0).reduce((a, r) => a - r.net, 0);
  const rows = c.rows.map(r => { const d = done[r.pid], cls = r.net > 0 ? "st-get" : r.net < 0 ? "st-pay" : "", tag = stTag(t, r.pid);
    return `<tr class="${r.pid === me ? "st-me" : ""}"><td>${mgr && !t.closed ? `<button type="button" class="st-who" data-act="stadj" data-p="${esc(r.pid)}">` : `<span class="st-who">`}<b>${esc(stName(r.pid))}</b>${tag ? `<small>${esc(tag)}</small>` : ""}${mgr && !t.closed ? "</button>" : "</span>"}</td>
      <td class="num st-op"><span>낼 ${stWon(r.owe)}</span><span>낸 ${r.paid ? stWon(r.paid) : "—"}</span></td>
      <td class="num st-net"><b class="${cls}">${r.net > 0 ? `받음 ${stWon(r.net)}` : r.net < 0 ? `보냄 ${stWon(-r.net)}` : "—"}</b>${!r.net ? "" : mgr ? `<button type="button" class="chip st-done ${d ? "on" : ""}" data-act="stdone" data-p="${esc(r.pid)}">${d ? "✓ 끝" : "확인"}</button>` : d ? `<span class="chip on">✓ 끝</span>` : ""}</td></tr>`; }).join("");
  const items = ST_CAT.map(([k, l]) => { const g = its.filter(x => x.cat === k); if (!g.length) return "";
    return `<h4>${l} <span class="small muted">${stWon(c.tot[k])}</span></h4><ul class="st-items">${g.map(x => stItemLine(x, t)).join("")}</ul>`; }).join("");
  return `<section class="sec"><div class="sec-head"><h2>${esc(t.title)}${t.closed ? ` <span class="chip">끝</span>` : ""}</h2>${mgr ? `<button class="btn link small" type="button" data-act="stedit">수정</button>` : ""}</div>
    <p class="small muted">${esc([stPer(t), `${(t.members || []).length}명`, t.club ? `회비 지원 ${stWon(t.club)}` : "", `${(ST_ROUND.find(x => x[0] === (Number(t.round_to) || 1000)) || [0, "1,000원"])[1]} 단위 올림`].filter(Boolean).join(" · "))}</p>
    <div class="st-sum"><div><span class="small muted">총 비용</span><b>${stWon(c.total)}</b></div><div><span class="small muted">총무가 받을 돈</span><b>${stWon(get)}</b></div><div><span class="small muted">총무가 보낼 돈</span><b>${stWon(send)}</b></div></div>
    ${c.rows.length ? `<h3>사람별</h3><div class="tw"><table class="st-t"><thead><tr><th>이름</th><th>낼 돈 · 낸 돈</th><th>정산</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">보냄 = 총무에게 보낼 돈, 받음 = 먼저 낸 비용을 총무가 보내 줌.${mgr && !t.closed ? " 이름을 누르면 운전 · 면제 · 정액 · 감면." : ""}</p>` : ""}
    <div class="sec-head"><h3>비용</h3>${!t.closed && (mgr || inTrip) ? `<button class="btn add small" type="button" data-act="stitem">＋ 비용</button>` : ""}</div>
    ${items || emptyLine("같이 쓰려고 산 게 있으면 영수증과 함께 올려요. 운전자는 유류비 · 톨비를 적어요.")}
    ${mgr ? `<div class="row st-foot"><button class="btn small" type="button" data-act="stnotice">정산 공지</button><button class="btn small" type="button" data-act="stclose">${t.closed ? "다시 열기" : "정산 끝내기"}</button></div>` : ""}</section>`;
}
function stItemLine(x, t) {
  const S = stS(), mgr = stCan(), canEdit = !t.closed && (mgr || (stMine(x) && !x.ok));
  const pics = (x.receipts || []).map((p, i) => S.urls[p] ? `<a href="${esc(S.urls[p])}" target="_blank" rel="noopener"><img class="st-pic" src="${esc(S.urls[p])}" alt="영수증 ${i + 1}"></a>` : `<span class="st-pic">영수증</span>`).join("");
  return `<li class="st-item"><div class="st-it-main"><b>${esc(x.title || stCatKo(x.cat))}</b><span class="small muted">${esc(stName(x.paid_by))}${x.approx ? " · 영수증 없음(직접 적음)" : !(x.receipts || []).length ? " · 영수증 없음" : ""}</span>${pics ? `<span class="st-pics">${pics}</span>` : ""}</div>
    <span class="num"><b>${stWon(x.amount)}</b></span>
    ${mgr ? `<button type="button" class="chip st-ok ${x.ok ? "on" : ""}" data-act="stok" data-id="${esc(x.id)}">${x.ok ? "✓ 확인" : "확인"}</button>` : `<span class="chip ${x.ok ? "on" : ""}">${x.ok ? "✓ 확인" : "확인 전"}</span>`}
    ${canEdit ? `<button class="btn link small" type="button" data-act="stitem" data-id="${esc(x.id)}">수정</button>` : ""}</li>`;
}
// 영수증 사진은 비공개 → 그때그때 서명 주소
let stUrlBusy = false;
async function stSignUrls() {
  const S = stS(); if (stUrlBusy) return;
  const need = [...new Set(Object.values(S.items).flat().flatMap(x => x.receipts || []))].filter(p => !(p in S.urls)); if (!need.length) return;
  stUrlBusy = true;
  try { const r = await sb.storage.from("receipts").createSignedUrls(need, 60 * 60); for (const x of (r && r.data) || []) if (x.signedUrl) S.urls[x.path] = x.signedUrl; } catch (e) { /* 사진 없이 */ }
  for (const p of need) if (!(p in S.urls)) S.urls[p] = ""; // 못 받은 건 다시 안 부름
  stUrlBusy = false; if (state.view === "money") { state.dirty = false; render(); }
}

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
  const el = document.getElementById("sheet"), opts = stSchedOpts(), mem = new Set(t ? t.members || [] : []), ru = t ? Number(t.round_to) || 1000 : 1000;
  const al = (state.alumni || []).slice(0, 40), ck = p => `<label class="rp-ck"><input type="checkbox" name="st-m" value="${esc(p.id)}" ${mem.has(p.id) ? "checked" : ""}> ${esc(pNo(p) + p.name)}</label>`;
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${t ? "정산 수정" : "새 정산"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stTripForm" data-id="${t ? esc(t.id) : ""}"><div class="fields">
      ${opts.length ? `<label class="fl wide">일정에서 고르기<select id="st-ref"><option value="">직접 입력</option>${opts.map(o => `<option value="${esc(o.k)}" data-n="${esc(o.name)}" data-d="${o.d}" data-e="${o.end}" ${t && t.ref_id && o.k === `${t.ref_kind}:${t.ref_id}` ? "selected" : ""}>${esc(o.name)} · ${md(parseD(o.d))}</option>`).join("")}</select></label>` : ""}
      <label class="fl wide">이름<input id="st-title" required maxlength="60" value="${esc(t ? t.title : "")}" placeholder="예: 박계조배"></label>
      <label class="fl">시작<input type="date" id="st-from" value="${t ? t.date_from || "" : ""}"></label><label class="fl">끝<input type="date" id="st-to" value="${t ? t.date_to || "" : ""}"></label>
      <label class="fl">회비 지원(원)<input type="number" id="st-club" min="0" step="1000" inputmode="numeric" value="${t && t.club ? t.club : ""}" placeholder="0"></label>
      <label class="fl">낼 돈 올림 단위<select id="st-round">${ST_ROUND.map(([v, l]) => `<option value="${v}" ${v === ru ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <div class="fl wide">같이 간 사람 <span class="small muted" id="st-n"></span><div class="st-mem">${sortedPlayers().map(ck).join("")}</div>
        ${al.length ? `<details class="st-al" ${al.some(p => mem.has(p.id)) ? "open" : ""}><summary class="small">졸업생</summary><div class="st-mem">${al.map(ck).join("")}</div></details>` : ""}</div>
      ${t ? "" : `<label class="rp-ck wide"><input type="checkbox" id="st-ntc" checked> 같이 간 사람에게 "비용 올려 주세요" 공지</label>`}
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
  if (el.id === "sa-drive" && el.checked) document.querySelectorAll('input[name="sa-ex"]').forEach(x => { x.checked = true; }); // 운전자는 기본 전부 면제(그때그때 바꿈)
  if (el.id === "st-cat") stCarNote();
});
async function stTripSave(f) {
  const v = id => (document.getElementById(id) || {}).value || "", ref = v("st-ref"), [rk, rid] = ref ? ref.split(":") : [null, null];
  const row = { title: v("st-title").trim(), date_from: v("st-from") || null, date_to: v("st-to") || v("st-from") || null, club: Math.max(0, Math.round(Number(v("st-club")) || 0)), round_to: Number(v("st-round")) || 1000,
    members: [...document.querySelectorAll('input[name="st-m"]:checked')].map(x => x.value), ref_kind: rk, ref_id: rid, updated_at: new Date().toISOString() };
  if (!row.title) return toast("이름을 넣어 주세요");
  if (row.date_from && row.date_to && row.date_from > row.date_to) return toast("시작이 끝보다 뒤예요");
  const S = stS(), ntc = !f.dataset.id && (document.getElementById("st-ntc") || {}).checked;
  try {
    if (f.dataset.id) { ok(await sb.from("settle_trips").update(row).eq("id", f.dataset.id)); Object.assign(S.list.find(x => x.id === f.dataset.id) || {}, row); }
    else { const r = await sb.from("settle_trips").insert(row).select().maybeSingle(); ok(r); const t = { adj: {}, done: {}, closed: false, ...row, ...(r.data || {}) }; S.list = [t, ...(S.list || [])]; S.open = t.id; pushInner();
      if (ntc && can("notice")) { try { ok(await sb.from("notices").insert({ ...stAskNotice(t), pinned: false, notify: true })); if (typeof loadAll === "function") loadAll(); } catch (e) { toast("공지는 못 올렸어요"); } } }
    closeSheet(); state.dirty = false; render(); window.scrollTo(0, 0); toast(f.dataset.id ? "고쳤어요" : ntc ? "정산을 만들고 공지했어요" : "정산을 만들었어요");
  } catch (e) { toast(failMsg(e)); }
}
// 만들 때 공지: 비용 올려 주세요
const stAskNotice = t => ({ title: `[${t.title} 정산] 쓴 비용 올려 주세요`,
  body: `${t.title} 정산을 시작해요.\n같이 쓰려고 낸 비용(숙소 · 식비 · 물품 등)이 있으면 앱 → 대회 → 정산에서 영수증 사진과 함께 올려 주세요.\n운전자는 유류비 · 톨비를 대략 적어 주세요 (영수증 없어도 돼요).\n정산 내역은 모두 볼 수 있어요.` });

/* ---- 사람마다: 운전 · 면제 · 정액 · 금액 감면 ---- */
function stAdjForm(pid) {
  const t = stCur(), a = (t.adj || {})[pid] || {}, el = document.getElementById("sheet");
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${esc(stName(pid))}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stAdjForm" data-p="${esc(pid)}"><div class="fields">
      <label class="rp-ck wide"><input type="checkbox" id="sa-drive" ${a.drive ? "checked" : ""}> 운전 <span class="small muted">(켜면 전부 면제, 바꿀 수 있음)</span></label>
      <div class="fl wide">면제 (이 종류는 안 냄)<span class="row">${ST_CAT.map(([k, l]) => `<label class="rp-ck"><input type="checkbox" name="sa-ex" value="${k}" ${(a.ex || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</span></div>
      <label class="fl">정액(원) <input type="number" id="sa-fix" min="0" step="1000" inputmode="numeric" value="${a.fix != null && a.fix !== "" ? a.fix : ""}" placeholder="예: 늦참 10000"></label>
      <label class="fl">금액 감면(원)<input type="number" id="sa-off" min="0" step="1000" inputmode="numeric" value="${a.off || ""}" placeholder="0"></label>
      <p class="small muted wide">정액 = 이 사람은 이 금액만 내요(늦참 · 매니저). 빠진 몫은 아무 조정 없는 사람끼리 나눠 내요.</p>
    </div><div class="row"><button class="btn primary" type="submit">저장</button>${(t.members || []).includes(pid) ? `<button class="btn link small" type="button" data-act="stout" data-p="${esc(pid)}">이번 정산에서 빼기</button>` : ""}</div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function stAdjSave(f) {
  const t = stCur(), pid = f.dataset.p, fx = document.getElementById("sa-fix").value.trim();
  const a = { drive: document.getElementById("sa-drive").checked, ex: [...document.querySelectorAll('input[name="sa-ex"]:checked')].map(x => x.value), off: Math.max(0, Math.round(Number(document.getElementById("sa-off").value) || 0)) };
  if (fx !== "") a.fix = Math.max(0, Math.round(Number(fx) || 0));
  const adj = { ...(t.adj || {}) }; if (!a.drive && !a.ex.length && !a.off && a.fix == null) delete adj[pid]; else adj[pid] = a;
  try { ok(await sb.from("settle_trips").update({ adj, updated_at: new Date().toISOString() }).eq("id", t.id)); t.adj = adj; closeSheet(); state.dirty = false; render(); } catch (e) { toast(failMsg(e)); }
}

/* ---- 비용 (영수증) ---- */
function stItemForm(id) {
  const S = stS(), mgr = stCan(), t = stCur(), x = id ? (S.items[t.id] || []).find(y => y.id === id) : null, el = document.getElementById("sheet");
  const who = mgr ? [...new Set([...(t.members || []), ...(x ? [x.paid_by] : [])])] : [];
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>${x ? "비용 수정" : "비용 올리기"}</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stItemForm" data-id="${x ? esc(x.id) : ""}"><div class="fields">
      <label class="fl">종류<select id="st-cat">${ST_CAT.map(([k, l]) => `<option value="${k}" ${x && x.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="fl">금액(원)<input type="number" id="st-amt" required min="0" step="10" inputmode="numeric" value="${x ? x.amount : ""}"></label>
      <label class="fl wide">내용<input id="st-it" maxlength="60" value="${esc(x ? x.title || "" : "")}" placeholder="예: 숙소 2박 · 이마트 물 · 저녁 고깃집"></label>
      ${mgr ? `<label class="fl wide">낸 사람<select id="st-by">${who.map(p => `<option value="${esc(p)}" ${(x ? x.paid_by === p : p === state.myPid) ? "selected" : ""}>${esc(stName(p))}</option>`).join("")}</select></label>` : ""}
      <p class="small muted wide" id="st-carnote"></p>
      <label class="fl wide">영수증 사진${x && (x.receipts || []).length ? ` <span class="small muted">(${x.receipts.length}장 있음, 새로 고르면 더함)</span>` : ""}<input type="file" id="st-files" accept="image/*" multiple></label>
    </div><div class="row"><button class="btn primary" type="submit">${x ? "저장" : "올리기"}</button></div>
    ${x ? `<div class="del-zone"><button class="btn danger small" type="button" data-act="stitemdel" data-id="${esc(x.id)}">비용 삭제</button></div>` : ""}</form>`;
  el.hidden = false; document.body.classList.add("noscroll"); stCarNote();
}
// 유류비 · 톨비: 차마다 달라서 운전자가 대략 적음(계산 안 함, 영수증 없어도 됨)
function stCarNote() { const n = document.getElementById("st-carnote"), c = document.getElementById("st-cat"); if (n && c) n.textContent = c.value === "car" ? "주유 · 톨비를 합쳐 대략 적어요. 영수증은 없어도 돼요." : ""; }
async function stItemSave(f) {
  const S = stS(), mgr = stCan(), t = stCur(), old = f.dataset.id ? (S.items[t.id] || []).find(y => y.id === f.dataset.id) : null;
  const amt = Math.round(Number(document.getElementById("st-amt").value)); if (!(amt >= 0)) return toast("금액을 넣어 주세요");
  const cat = document.getElementById("st-cat").value, files = [...(document.getElementById("st-files").files || [])].slice(0, 6);
  const row = { cat, amount: amt, title: document.getElementById("st-it").value.trim() || null, paid_by: mgr ? document.getElementById("st-by").value : state.myPid };
  if (!row.paid_by) return toast("명단에 연결된 계정만 비용을 올릴 수 있어요");
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const paths = [];
    if (files.length) { toast("영수증 올리는 중…");
      for (const [i, fl] of files.entries()) { const blob = await shrinkImage(fl), p = `${TEAM.id}/${t.id}/${stUid()}/${Date.now()}-${i}.jpg`;
        const up = await sb.storage.from("receipts").upload(p, blob, { contentType: "image/jpeg" }); if (up && up.error) throw up.error; paths.push(p); } }
    row.receipts = [...(old ? old.receipts || [] : []), ...paths].slice(0, 6);
    row.approx = cat === "car" && !row.receipts.length;
    if (old) { ok(await sb.from("settle_items").update(row).eq("id", old.id)); Object.assign(old, row); }
    else { const r = await sb.from("settle_items").insert({ ...row, trip_id: t.id }).select().maybeSingle(); ok(r); (S.items[t.id] = S.items[t.id] || []).push({ ok: false, author: stUid(), ...row, trip_id: t.id, ...(r.data || {}) }); }
    closeSheet(); state.dirty = false; render(); stSignUrls(); toast(old ? "고쳤어요" : "올렸어요");
  } catch (e) { toast(failMsg(e)); btn.disabled = false; }
}

/* ---- 정산 공지 (예전 카톡 공지 모양) ---- */
const stJosa = w => { const c = String(w || "").trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "을" : "를"; };
function stNoticeText(t) {
  const its = stS().items[t.id] || [], c = stCalc(t, its), A = t.adj || {}, P = t.members || [];
  const drivers = P.filter(p => (A[p] || {}).drive), fixed = P.filter(p => !(A[p] || {}).drive && (A[p] || {}).fix != null && (A[p] || {}).fix !== ""), rest = P.length - drivers.length - fixed.length;
  const L = [`[${t.title} 정산 공지]`, `이번 ${t.title}${stJosa(t.title)} 거치며 소요된 금액을 정산하고자 합니다`, "다들 수고 많으셨습니다!!!", "", "* 이번 대회에 참가한 인원",
    [drivers.length ? `운전자 ${drivers.length}명` : "", `참가자 ${rest}명`, fixed.length ? fixed.map(p => `${stShort(p)}${(A[p] || {}).fix ? ` ${stWon(A[p].fix)}` : ""}`).join(", ") : ""].filter(Boolean).join(", "),
    `총 ${P.length}명이 정산에 참여했습니다!`, "", "* 정산 내역", `총 비용 ${stWon(c.total)}`];
  for (const [k, l] of ST_CAT) if (c.tot[k]) { const by = k === "car" ? [...new Set(its.filter(x => x.cat === k).map(x => stShort(x.paid_by)))] : [];
    L.push(`- ${l} ${stWon(c.tot[k])}${by.length ? ` (${by.join(", ")} 운전 · 직접 적음)` : ""}`); }
  if (c.club) L.push(`- 회비 지원 −${stWon(c.club)}`);
  // 낼 돈: 같은 금액끼리 묶음 (먼저 낸 비용 없는 사람)
  const pay = c.rows.filter(r => r.net < 0 && !r.paid), groups = new Map();
  for (const r of pay) { if (!groups.has(-r.net)) groups.set(-r.net, []); groups.get(-r.net).push(r.pid); }
  L.push("", "⭐️금액");
  for (const [amt, ps] of [...groups.entries()].sort((a, b) => a[1].length - b[1].length || a[0] - b[0])) {
    L.push(`${ps.length > 4 ? `나머지 ${ps.length}명 (${ps.map(stShort).join(", ")})` : ps.map(stShort).join(", ")} - ${ps.length > 1 ? "각 " : ""}${stWon(amt)}`); }
  const mixed = c.rows.filter(r => r.paid && r.net !== 0);
  if (mixed.length) { L.push("", "먼저 낸 비용이 있는 분 (낸 돈 − 낼 돈)");
    for (const r of mixed) L.push(`${stShort(r.pid)} - ${r.net > 0 ? `받을 돈 ${stWon(r.net)}` : `보낼 돈 ${stWon(-r.net)}`} (${stWon(r.paid)} − ${stWon(r.owe)})`); }
  L.push("", "아래 계좌로 송금 후 이 메세지에 체크 표시 해주세요!", "⭐️ 계좌", "(은행 · 계좌번호 · 이름을 적어 주세요)");
  return L.join("\n");
}
function stNoticeForm() {
  const t = stCur(), el = document.getElementById("sheet"), body = stNoticeText(t);
  el.querySelector(".sheet-body").innerHTML = `<div class="row between"><h3>정산 공지</h3><button class="btn link" type="button" data-act="sheetclose">닫기</button></div>
    <form class="f" id="stNoticeForm"><div class="fields">
      <label class="fl wide">제목<input id="sn-title" maxlength="80" value="${esc(`[${t.title} 정산 공지]`)}"></label>
      <label class="fl wide">내용 <span class="small muted">계좌는 여기 직접 적어요 (앱에 따로 저장 안 함)</span><textarea id="sn-body" rows="16">${esc(body)}</textarea></label>
      <label class="rp-ck wide"><input type="checkbox" id="sn-pin" checked> 홈 공지 맨 위에 고정</label>
    </div><div class="row"><button class="btn primary" type="submit" ${can("notice") ? "" : "disabled"}>공지 올리기 (알림)</button><button class="btn small" type="button" data-act="stcopy">복사</button></div></form>`;
  el.hidden = false; document.body.classList.add("noscroll");
}
async function stNoticeSave(f) {
  const title = document.getElementById("sn-title").value.trim(), body = document.getElementById("sn-body").value.trim();
  if (!title) return toast("제목을 넣어 주세요");
  if (/\(은행 · 계좌번호 · 이름을 적어 주세요\)/.test(body) && !await confirmDel("계좌를 아직 안 적었어요.\n그대로 올릴까요?", "그대로 올리기")) return;
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try { ok(await sb.from("notices").insert({ title, body, pinned: document.getElementById("sn-pin").checked, notify: true })); closeSheet(); toast("공지를 올렸어요"); if (typeof loadAll === "function") loadAll(); }
  catch (e) { toast(failMsg(e)); btn.disabled = false; }
}

/* ---- 버튼 ---- */
async function stClick(b, act) {
  const S = stS();
  if (act === "stopen") { pushInner(); S.open = b.dataset.id; state.dirty = false; render(); window.scrollTo(0, 0); stSignUrls(); return; }
  if (act === "stitem") return stItemForm(b.dataset.id || null);
  if (act === "stitemdel") { const t = stCur(), x = (S.items[t.id] || []).find(y => y.id === b.dataset.id); if (!x || !await confirmDel("이 비용을 지울까요?")) return;
    try { ok(await sb.from("settle_items").delete().eq("id", x.id)); if ((x.receipts || []).length) { try { await sb.storage.from("receipts").remove(x.receipts); } catch (e) { /* 남아도 됨 */ } }
      S.items[t.id] = S.items[t.id].filter(y => y.id !== x.id); closeSheet(); state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } return; }
  if (!stCan()) return;
  if (act === "stnew") return stTripForm(null);
  const t = stCur(); if (!t) return;
  if (act === "stedit") return stTripForm(t);
  if (act === "stadj") return stAdjForm(b.dataset.p);
  if (act === "stnotice") return stNoticeForm();
  if (act === "stout") {
    const members = (t.members || []).filter(p => p !== b.dataset.p), adj = { ...(t.adj || {}) }; delete adj[b.dataset.p];
    try { ok(await sb.from("settle_trips").update({ members, adj, updated_at: new Date().toISOString() }).eq("id", t.id)); t.members = members; t.adj = adj; closeSheet(); state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return;
  }
  if (act === "stok") { const x = (S.items[t.id] || []).find(y => y.id === b.dataset.id); if (!x) return;
    try { ok(await sb.from("settle_items").update({ ok: !x.ok }).eq("id", x.id)); x.ok = !x.ok; state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stdone") { const done = { ...(t.done || {}) }; if (done[b.dataset.p]) delete done[b.dataset.p]; else done[b.dataset.p] = new Date().toISOString();
    try { ok(await sb.from("settle_trips").update({ done }).eq("id", t.id)); t.done = done; state.dirty = false; render(); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stclose") { try { ok(await sb.from("settle_trips").update({ closed: !t.closed, updated_at: new Date().toISOString() }).eq("id", t.id)); t.closed = !t.closed; state.dirty = false; render(); toast(t.closed ? "정산을 끝냈어요" : "다시 열었어요"); } catch (e) { toast(failMsg(e)); } return; }
  if (act === "stcopy") { const ta = document.getElementById("sn-body"), s = ta ? ta.value : stNoticeText(t); try { await navigator.clipboard.writeText(s); toast("복사했어요"); } catch (e) { if (ta) { ta.select(); document.execCommand("copy"); toast("복사했어요"); } } return; }
  if (act === "stdel") { if (!await confirmDel(`${t.title} 정산을 지울까요?\n비용 · 영수증 기록도 같이 지워져요.`)) return;
    try { const ps = (S.items[t.id] || []).flatMap(x => x.receipts || []); ok(await sb.from("settle_trips").delete().eq("id", t.id)); if (ps.length) { try { await sb.storage.from("receipts").remove(ps); } catch (e) { /* 사진은 남아도 됨 */ } }
      S.list = S.list.filter(x => x.id !== t.id); delete S.items[t.id]; S.open = null; closeSheet(); state.dirty = false; render(); toast("지웠어요"); } catch (e) { toast(failMsg(e)); } return; }
}
