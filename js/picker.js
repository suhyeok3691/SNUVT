/* 날짜·시간 고르기
 * 앱의 모든 <input type="date"> · <input type="time"> 을 앱 디자인의 고르기 창으로 바꾼다.
 * - 값은 그대로 YYYY-MM-DD · HH:MM (다른 코드는 .value 를 지금처럼 읽고 씀, required·min·max 도 그대로)
 * - 날짜: 달력 (오늘 표시, 값이 없으면 이번 달부터)
 * - 시간: 15분 간격, 한 줄에 한 시간 (정각이 먼저). 값이 없으면 지금 시각의 정각 줄부터 보임 */
(() => {
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const P = n => String(n).padStart(2, "0");
  const isoD = d => `${d.getFullYear()}-${P(d.getMonth() + 1)}-${P(d.getDate())}`;
  const parseD = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const ICON = {
    date: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
    time: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  };
  const norm = (kind, v) => {
    v = v == null ? "" : String(v);
    if (kind === "time") { const m = /^(\d{1,2}):(\d{2})/.exec(v); return m ? `${P(+m[1])}:${m[2]}` : ""; }
    return parseD(v.slice(0, 10)) ? v.slice(0, 10) : "";
  };
  const label = (kind, v) => {
    if (!v) return "";
    if (kind === "time") return v;
    const d = parseD(v), y = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : "";
    return `${y}${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  };

  // input 하나를 바꿈: 진짜 input 은 값·검사용으로 숨겨 두고, 그 자리에 버튼
  function enhance(inp) {
    const kind = inp.type === "time" ? "time" : "date";
    inp.dataset.dtp = kind;
    const start = norm(kind, VAL.get.call(inp));
    inp.type = "text";
    inp.setAttribute("inputmode", "none"); inp.setAttribute("autocomplete", "off");
    inp.tabIndex = -1; inp.setAttribute("aria-hidden", "true");
    inp.classList.add("dtp-raw");
    VAL.set.call(inp, start);
    const wrap = document.createElement("span"); wrap.className = "dtp";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "dtp-btn";
    inp.replaceWith(wrap); wrap.append(inp, btn);
    const sync = () => {
      const v = VAL.get.call(inp), ph = inp.placeholder || (kind === "time" ? "시간 선택" : "날짜 선택");
      btn.innerHTML = `<span class="${v ? "" : "ph"}">${v ? label(kind, v) : ph}</span>${ICON[kind]}`;
      btn.disabled = inp.disabled;
      btn.setAttribute("aria-label", `${kind === "time" ? "시간" : "날짜"} ${v ? label(kind, v) : "선택 안 함"}`);
    };
    Object.defineProperty(inp, "value", { configurable: true, get() { return VAL.get.call(this); }, set(v) { VAL.set.call(this, norm(kind, v)); sync(); } });
    inp._dtpSync = sync;
    new MutationObserver(sync).observe(inp, { attributes: true, attributeFilter: ["disabled", "placeholder"] });
    if (inp.form) inp.form.addEventListener("reset", () => setTimeout(sync));
    btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); open(inp, btn); });
    // 제출할 때 비어 있어 걸리면(required) 바로 고르기 창
    inp.addEventListener("focus", () => { if (!cur) open(inp, btn); });
    sync();
  }
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('input[type="date"], input[type="time"]') : []).forEach(enhance);

  // ---------- 고르기 창 ----------
  let cur = null; // { inp, btn, bg, pop, kind, month }
  const pick = v => {
    const { inp, btn } = cur;
    VAL.set.call(inp, v); inp._dtpSync();
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    close(); btn.focus();
  };
  function close() {
    if (!cur) return;
    cur.bg.remove(); cur.btn.classList.remove("on"); cur.btn.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", place); window.removeEventListener("keydown", onKey, true);
    cur = null;
  }
  function onKey(e) {
    if (e.key !== "Escape") return;
    e.stopPropagation(); e.preventDefault(); const b = cur.btn; close(); b.focus();
  }
  const mobile = () => window.matchMedia("(max-width: 599px)").matches;
  function place() {
    if (!cur) return;
    const { pop, btn, bg } = cur;
    bg.classList.toggle("sheetish", mobile());
    if (mobile()) { pop.style.left = pop.style.top = ""; return; }
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left, vw - w - 8));
    const top = r.bottom + 6 + h <= vh - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - h);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function open(inp, btn) {
    if (inp.disabled) return;
    close();
    const kind = inp.dataset.dtp, v = VAL.get.call(inp);
    const bg = document.createElement("div"); bg.className = "dtp-bg";
    const pop = document.createElement("div"); pop.className = `dtp-pop dtp-${kind}`; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", kind === "time" ? "시간 고르기" : "날짜 고르기");
    bg.append(pop); document.body.append(bg);
    const sel = parseD(v), base = sel || new Date();
    cur = { inp, btn, bg, pop, kind, month: new Date(base.getFullYear(), base.getMonth(), 1) };
    btn.classList.add("on"); btn.setAttribute("aria-expanded", "true");
    bg.addEventListener("click", e => { e.stopPropagation(); if (e.target === bg) close(); });
    pop.addEventListener("click", onPop);
    window.addEventListener("resize", place); window.addEventListener("keydown", onKey, true);
    draw(); place();
    if (kind === "time") scrollHour();
    const focus = pop.querySelector(".sel") || pop.querySelector(".today:not(:disabled)") || pop.querySelector(".hint");
    if (focus) focus.focus({ preventScroll: true });
  }
  function onPop(e) {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    if (b.dataset.m) { const m = cur.month; cur.month = new Date(m.getFullYear(), m.getMonth() + Number(b.dataset.m), 1); draw(); place(); return; }
    if (b.dataset.v != null) return pick(b.dataset.v);
    if (b.dataset.today != null) return pick(isoD(new Date()));
    if (b.dataset.clear != null) return pick("");
  }
  const inRange = (d, inp) => { const s = isoD(d); return !(inp.min && s < inp.min) && !(inp.max && s > inp.max); };
  function draw() {
    const { pop, inp, kind } = cur, v = VAL.get.call(inp), clear = !inp.required && v ? `<button type="button" class="btn link small" data-clear>지우기</button>` : "";
    if (kind === "time") {
      let rows = "";
      for (let h = 0; h < 24; h++) rows += `<div class="dtp-h" data-h="${h}">${[0, 15, 30, 45].map(m => { const t = `${P(h)}:${P(m)}`; return `<button type="button" class="t${m} ${t === v ? "sel" : ""}" data-v="${t}">${t}</button>`; }).join("")}</div>`;
      pop.innerHTML = `<div class="dtp-top"><b>시간</b><span class="small muted">15분 간격</span></div><div class="dtp-times">${rows}</div>${clear ? `<div class="dtp-foot">${clear}</div>` : ""}`;
      return;
    }
    const m = cur.month, y = m.getFullYear(), mo = m.getMonth(), todayS = isoD(new Date());
    const first = new Date(y, mo, 1 - m.getDay()), weeks = Math.ceil((m.getDay() + new Date(y, mo + 1, 0).getDate()) / 7);
    let cells = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i), s = isoD(d);
      const cls = [d.getMonth() !== mo ? "out" : "", s === todayS ? "today" : "", s === v ? "sel" : "", d.getDay() === 0 ? "sun" : d.getDay() === 6 ? "sat" : ""].filter(Boolean).join(" ");
      cells += `<button type="button" class="${cls}" data-v="${s}" ${inRange(d, inp) ? "" : "disabled"} aria-label="${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일">${d.getDate()}</button>`;
    }
    const prevOk = !inp.min || isoD(new Date(y, mo, 0)) >= inp.min, nextOk = !inp.max || isoD(new Date(y, mo + 1, 1)) <= inp.max;
    const todayOk = inRange(new Date(), inp);
    pop.innerHTML = `<div class="dtp-top"><button type="button" class="dtp-nav" data-m="-1" aria-label="이전 달" ${prevOk ? "" : "disabled"}>‹</button><b>${y}년 ${mo + 1}월</b><button type="button" class="dtp-nav" data-m="1" aria-label="다음 달" ${nextOk ? "" : "disabled"}>›</button></div>
      <div class="dtp-dow">${DOW.map((d, i) => `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${d}</span>`).join("")}</div>
      <div class="dtp-days">${cells}</div>
      <div class="dtp-foot"><button type="button" class="btn small" data-today ${todayOk ? "" : "disabled"}>오늘</button>${clear}</div>`;
  }
  // 시간: 고른 값 → 같은 칸(쌍)의 시작 시간 → 지금 시각, 그 정각 줄이 맨 위에 오게
  function scrollHour() {
    const { pop, inp } = cur, list = pop.querySelector(".dtp-times");
    let h = null; const v = VAL.get.call(inp);
    if (v) h = +v.slice(0, 2);
    else {
      const pair = inp.closest(".pair"), other = pair && [...pair.querySelectorAll('input[data-dtp="time"]')].find(x => x !== inp && VAL.get.call(x));
      h = other ? Math.min(23, +VAL.get.call(other).slice(0, 2) + 1) : new Date().getHours();
    }
    const row = list.querySelector(`[data-h="${h}"]`); if (row) list.scrollTop = row.offsetTop - list.offsetTop - 4;
    row && row.querySelector(".t0").classList.add("hint");
  }

  scan(document);
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches('input[type="date"], input[type="time"]')) enhance(n); else scan(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
