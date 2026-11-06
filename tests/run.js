/* SNUVT 화면 테스트 (Playwright · 가짜 Supabase, 진짜 서버에 안 붙음)
 *   cd tests && npm install && npm test        → 전부
 *   node run.js smoke                          → 하나만 (smoke · picker · guest · friendly · undo · practice …)
 * 저장소의 파일을 그대로 http://local.test 로 띄우고, CDN 의 supabase-js 자리에 mock.js 를 넣음.
 * 브라우저 시계는 2026-11-01 (일) 10:00 KST 로 고정 (mock 데이터 기준). */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), assert = require("assert");
const { mockScript } = require("./mock.js");
const ROOT = path.join(__dirname, "..") + path.sep;
const NOW = new Date("2026-11-01T10:00:00+09:00");
const VIEWS = ["home", "practice", "notes", "video", "jp", "scout", "train", "plan", "rec", "season", "comps", "cup", "fr", "campus", "sched", "report", "roster", "intake"];
const TYPES = { js: "text/javascript", html: "text/html", css: "text/css", png: "image/png", webmanifest: "application/manifest+json", json: "application/json" };

async function openApp(browser, role, { width = 390, height = 844, now = NOW } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  const page = await ctx.newPage(), errs = [], missing = [];
  await page.clock.setFixedTime(now);
  await page.route("**/*", r => {
    const u = new URL(r.request().url());
    if (u.hostname === "cdn.jsdelivr.net" && u.pathname.includes("supabase")) return r.fulfill({ body: mockScript(role), contentType: "text/javascript" });
    if (u.hostname !== "local.test") return r.abort();
    const p = u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname.slice(1));
    try { return r.fulfill({ body: fs.readFileSync(ROOT + p), contentType: TYPES[p.split(".").pop()] || "application/octet-stream" }); }
    catch (e) { missing.push(p); return r.fulfill({ status: 404, body: "" }); }
  });
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("http://local.test/#home", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("main") && !/불러오는 중/.test(document.querySelector("main").innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // 시계가 멈춰 있어서 앱의 '뒤로 가기 두 번 막기'(450ms 안)가 매번 걸림 → 화면 바꿀 때마다 풀어 줌
  const go = async v => { await page.evaluate(v => { try { popAt = 0; } catch (e) {} location.hash = "#" + v; }, v); await page.waitForTimeout(400); };
  const text = sel => page.evaluate(s => (document.querySelector(s) || {}).innerText || "", sel).then(t => t.replace(/\s+/g, " "));
  const writes = t => page.evaluate(t => (window.__w || []).filter(x => x[0] === t), t);
  return { ctx, page, errs, missing, go, text, writes };
}
const clean = a => { assert.deepStrictEqual(a.errs, [], "화면 오류"); assert.deepStrictEqual(a.missing, [], "없는 파일"); };

const SUITES = {
  // 모든 화면을 코치·부원으로 열어 보고, 새로고침(저장본으로 먼저 그리기)까지
  async smoke(b) {
    for (const role of ["coach", "player"]) {
      const a = await openApp(b, role);
      for (const v of VIEWS) { await a.go(v); assert.ok((await a.text("main")).length > 0, `${role} ${v} 빈 화면`); }
      await a.go("home"); await a.page.reload({ waitUntil: "domcontentloaded" }); await a.page.waitForTimeout(1500);
      assert.ok((await a.text("main")).length > 20, `${role} 새로고침 뒤 빈 화면`);
      clean(a); await a.ctx.close();
    }
  },
  // 날짜·시간 고르기: 달력(오늘) · 시·분 바퀴(15분) · 같은 칸 끝 시간은 시작 다음 정각부터
  async picker(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => openForm("friendly")); await p.waitForTimeout(300);
    await p.click("#fr-date + .dtp-btn"); await p.click(".dtp-days button.today");
    assert.strictEqual(await p.evaluate(() => document.getElementById("fr-date").value), "2026-11-01");
    assert.match(await p.evaluate(() => document.querySelector("#fr-date + .dtp-btn").textContent), /11월 1일 \(일\)/);
    await p.click("#fr-start + .dtp-btn");
    assert.deepStrictEqual(await p.evaluate(() => [...document.querySelectorAll('.dtp-col[data-k="m"] button')].map(x => x.textContent)), ["00", "15", "30", "45"]);
    await p.evaluate(() => { document.querySelector('.dtp-col[data-k="h"]').scrollTop = 18 * 40; }); await p.waitForTimeout(250);
    await p.click(".dtp-ok");
    assert.strictEqual(await p.evaluate(() => document.getElementById("fr-start").value), "18:00");
    await p.click("#fr-end + .dtp-btn"); await p.waitForTimeout(150);
    assert.strictEqual(await p.evaluate(() => document.querySelector('.dtp-col[data-k="h"] .sel').textContent), "19", "끝 시간은 시작 다음 정각부터");
    await p.keyboard.press("Escape");
    assert.ok(await p.evaluate(() => !document.getElementById("sheet").hidden), "Esc 는 고르기 창만 닫음");
    await p.evaluate(() => { document.getElementById("fr-start").value = "09:30:00"; });
    assert.strictEqual(await p.evaluate(() => document.getElementById("fr-start").value), "09:30");
    clean(a); await a.ctx.close();
  },
  // 다른 팀(여자부) 훈련 합류: 월·목만, 그 팀 교류전(11/5)·훈련 없음(11/9) 빠짐, 바뀐 시간(11/12 19:00) 반영, 시간 남기기
  async guest(b) {
    const a = await openApp(b, "player"), p = a.page;
    await a.go("season");
    const rows = await p.evaluate(() => [...document.querySelectorAll("li.guest")].map(l => l.innerText.replace(/\s+/g, " ")));
    assert.strictEqual(rows.length, 2, rows.join(" / "));
    assert.match(rows[0], /11월 2일 \(월\) 여자부 정규 훈련 · 18:00–21:00/);
    assert.match(rows[1], /11월 12일 \(목\) 여자부 정규 훈련 · 19:00–21:00/);
    await p.click("li.guest button[data-act=guestgo]");
    await p.evaluate(() => { document.getElementById("gs-s").value = "19:00"; });
    await p.click("#guestForm button[type=submit]"); await p.waitForTimeout(300);
    assert.deepStrictEqual((await a.writes("guest_votes"))[0][2], { host_team: "women", date: "2026-11-02", player_id: "p2", start_time: "19:00", end_time: "21:00" });
    assert.match(await a.text("li.guest"), /합류 19:00–21:00/);
    assert.strictEqual(await p.evaluate(() => document.querySelectorAll(".cd.k-guest").length), 1, "달력에 합류 표시");
    clean(a); await a.ctx.close();
    // 받는 쪽(관리자)은 우리 정규 훈련 줄에 누가 몇 시에 오는지
    const c = await openApp(b, "coach"); await c.go("season");
    assert.match(await c.text(".sched-list"), /여자부 1 김여부 S 19:00–21:00/);
    clean(c); await c.ctx.close();
  },
  // 교류전 투표 대상: 지정(p1만)이면 p2 는 대상 아님 · 내 투표에 없음, 저장 값 vote_to
  async friendly(b) {
    const a = await openApp(b, "player"), p = a.page;
    await a.go("season");
    assert.match(await a.text(".sched-list"), /연세대와 교류전 · 14:00–17:00 지정 1명 대상 아님/);
    await a.go("home");
    assert.doesNotMatch(await a.text(".my-votes"), /연세대/);
    clean(a); await a.ctx.close();
    const c = await openApp(b, "coach"), q = c.page;
    await c.go("home"); assert.match(await c.text(".my-votes"), /연세대/);
    await q.evaluate(() => openForm("friendly")); await q.waitForTimeout(300);
    await q.check('input[name="fr-to"][value="pick"]');
    assert.ok(await q.isVisible("#fr-to-list"));
    await q.check('#fr-to-list input[value="p2"]');
    await q.evaluate(() => { document.getElementById("fr-date").value = "2026-11-15"; document.getElementById("fr-opp").value = "고려대"; });
    await q.click("#friendlyForm button[type=submit]"); await q.waitForTimeout(300);
    assert.deepStrictEqual((await c.writes("friendlies"))[0][2].vote_to, ["p2"]);
    clean(c); await c.ctx.close();
  },
  // 실시간 라인업 (전력분석 Edit Lineup 처럼): 두 팀 한 창, SNU 는 명단 포지션으로 자동 배치된 채로 열림, 교류전 상대는 이름표 → 번호로 바꿔 저장
  async rotation(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => { // 부원 6명 더 (자동 배치가 되게)
      [["p3", "김OH", "OH"], ["p4", "박OH", "OH"], ["p5", "이MB", "MB"], ["p6", "정OP", "OP"], ["p7", "한L", "L"], ["p8", "오S", "S"]].forEach(([id, name, pos], i) => { state.players[id] = { name, pos, number: 20 + i }; });
      lvForm("friendly:f1"); });
    await p.waitForTimeout(200);
    await p.click("#lvForm button[type=submit]"); await p.waitForTimeout(300);
    await a.go("fr"); await p.evaluate(() => { cupState().key = "friendly:f1"; state.live.open = (lv().games["friendly:f1"] || [])[0]?.id; state.dirty = false; render(); }); await p.waitForTimeout(400);
    assert.ok(await p.$('[data-act="lvros"]'), "라인업 버튼");
    assert.strictEqual(await p.$('[data-act="lvswap"], [data-act="lvauto"]'), null, "옛 명단 · 로테 도구 없음");
    await p.click('[data-act="lvros"]'); await p.waitForTimeout(200);
    const f = await p.evaluate(() => ({ us: [1, 2, 3, 4, 5, 6].map(z => document.getElementById(`lvl-us-${z}`).value), lib: document.getElementById("lvl-us-l").value,
      opp: [1, 2, 3, 4, 5, 6].map(z => document.getElementById(`lvl-opp-${z}`).value), opos: document.getElementById("lvp-opp-1").value }));
    assert.ok(f.us.every(Boolean) && new Set(f.us).size === 6, "SNU 6자리 자동 " + f.us);
    assert.strictEqual(f.lib, "p7", "리베로 자동");
    assert.deepStrictEqual(f.opp, ["S", "OH1", "MB1", "OP", "OH2", "MB2"]);
    assert.strictEqual(f.opos, "S");
    // 상대 1번 자리를 등번호 9(S)로, 1세트 상대 로테 3 · 첫 서브 상대
    await p.evaluate(() => { document.getElementById("lvl-opp-1").value = "9"; document.getElementById("lvl-orot").value = "3"; document.getElementById("lvl-serve").value = "opp"; });
    await p.click("#lvLineupForm button[type=submit]"); await p.waitForTimeout(300);
    const g = await p.evaluate(() => { const g = lvGame(); return { st: { rot: g.sets[1].rot, orot: g.sets[1].orot, serve: g.sets[1].serve }, opp: g.sets[1].lu.opp, ros: g.roster.opp.find(x => String(x.no) === "9") }; });
    assert.deepStrictEqual(g.st, { rot: 1, orot: 3, serve: "opp" });
    assert.deepStrictEqual(g.opp.slots, [9, "OH1", "MB1", "OP", "OH2", "MB2"]);
    assert.strictEqual(g.opp.rot, 3);
    assert.deepStrictEqual(g.ros, { no: 9, pos: "S" });
    // 교체(상대): 나감 OH1 → 포지션 OH 자동 → 번호 15 → 교체, 다음엔 번호 없이 MB1 → MB3 이름표
    await p.click('[data-act="lvside"][data-v="opp"]'); await p.waitForTimeout(150);
    await p.click('[data-act="lvsub"]'); await p.waitForTimeout(150);
    const oz = await p.evaluate(() => { const s = lvState(lvGame(), lv().rallies[lvGame().id] || [], 1), on = lvCourtOn(lvGame(), "opp", s, 1); return { oh: on.vals.indexOf("OH1") + 1, mb: on.vals.indexOf("MB1") + 1 }; });
    await p.click(`[data-act="lvsubout"][data-v="${oz.oh}"]`); await p.waitForTimeout(100);
    assert.strictEqual(await p.$eval("#lvSubPos", e => e.value), "OH", "나간 선수 포지션이 기본 (번호 칸 옆)");
    await p.fill("#lvSubNew", "15"); await p.press("#lvSubNew", "Enter"); await p.waitForTimeout(300);
    await p.click('[data-act="lvsub"]'); await p.waitForTimeout(150);
    await p.click(`[data-act="lvsubout"][data-v="${oz.mb}"]`); await p.click('[data-act="lvsubok"]'); await p.waitForTimeout(300);
    const sb = await p.evaluate(() => { const g = lvGame(), r = g.roster.opp; return { r15: r.find(x => String(x.no) === "15"), mb3: r.find(x => x.no === "MB3"), slots: g.sets[1].lu.opp.slots }; });
    assert.deepStrictEqual(sb.r15, { no: 15, pos: "OH" });
    assert.deepStrictEqual(sb.mb3, { no: "MB3", pos: "MB" });
    assert.ok(sb.slots.includes(15) && sb.slots.includes("MB3") && !sb.slots.includes("OH1") && !sb.slots.includes("MB1"), String(sb.slots));
    // 교체 명단에서 잘못 넣은 번호 지우기 (✕) → 명단에서 빠짐
    await p.click('[data-act="lvsub"]'); await p.waitForTimeout(150);
    await p.click('[data-act="lvsubdel"][data-v="OH1"]'); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(() => lvGame().roster.opp.some(x => x.no === "OH1")), false, "OH1 지움");
    assert.strictEqual(await p.$('[data-act="lvsubin"][data-v="OH1"]'), null);
    await p.evaluate(() => closeSheet());
    await p.click('[data-act="lvside"][data-v="us"]');
    // 6자리를 다 안 채우면 저장 안 됨
    await p.click('[data-act="lvros"]'); await p.waitForTimeout(200);
    await p.evaluate(() => { document.getElementById("lvl-opp-2").value = ""; });
    await p.click("#lvLineupForm button[type=submit]"); await p.waitForTimeout(200);
    assert.ok(await p.isVisible("#lvLineupForm"), "빈 칸 있으면 창 그대로");
    clean(a); await a.ctx.close();
  },
  // 전력분석 = 예전 프로그램: 선수 → Attack → Spike Kill → 떨어진 자리 누르기 → 점수 · x/y/구역 저장, 분석 탭에 점
  async scout(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("scout"); await p.waitForTimeout(300);
    assert.match(await a.text("main"), /전력분석/);
    await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(400);
    await p.click('.ct-court .ct-p.us[data-v="2"]'); await p.waitForTimeout(150);
    await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="kill"]'); await p.waitForTimeout(150);
    assert.ok(await p.isVisible("#ctCourtTap"), "떨어진 자리 그림");
    const box = await p.locator("#ctCourtTap").boundingBox();
    await p.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.15); await p.waitForTimeout(300); // 오른쪽 위 = 상대 뒤 왼쪽(5번)
    const ev = (await a.writes("scout_events")).map(x => x[2]);
    assert.strictEqual(ev.length, 1);
    assert.deepStrictEqual({ action: ev[0].action, opp_no: ev[0].opp_no, point: ev[0].point, zone: ev[0].zone, x: ev[0].x, y: ev[0].y }, { action: "kill", opp_no: 2, point: "us", zone: 5, x: 20, y: 85 });
    assert.match(await a.text(".ct-score"), /1 : 0/);
    // 범실(이유가 있는 것)은 자리 단계 없이, Hit In Play 는 건너뛰기
    await p.click('.ct-court .ct-p.opp[data-v="12"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="inplay"]');
    await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(200);
    assert.strictEqual((await a.writes("scout_events"))[1][2].x, null);
    await p.click('[data-act="sctab"][data-k="stats"]'); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => document.querySelectorAll(".ct-spots circle").length), 1, "분석 탭에 점 하나");
    clean(a); await a.ctx.close();
  },
  // 홈 '오늘 할 것': 아침 컨디션 설문 없음 (2026-11-01 뺌), 큰 칸 4개(하단 탭과 같음)도 없음, 알림 안내에도 컨디션 없음
  async todo(b) {
    const a = await openApp(b, "player"), p = a.page;
    await a.go("home");
    assert.strictEqual(await p.$(".wl-form, .well-card, [name^='wl-']"), null, "컨디션 설문 없음");
    assert.strictEqual(await p.$(".tiles-grid"), null, "홈 큰 칸 없음");
    assert.doesNotMatch(await a.text("main"), /컨디션/);
    await a.go("train");
    assert.doesNotMatch(await a.text("main"), /아침 컨디션/);
    clean(a); await a.ctx.close();
    // 교류전 날: 홈 '오늘 할 것'에는 교류전 한 줄만 (피지컬 줄과 겹치지 않게), 피지컬 화면에는 그대로
    const c = await openApp(b, "coach", { now: new Date("2026-11-08T10:00:00+09:00") });
    await c.go("home");
    const td = await c.text(".todo-card");
    assert.strictEqual((td.match(/연세대와 교류전/g) || []).length, 1, td);
    assert.strictEqual(await c.page.$$eval(".todo-card .td-row", x => x.length), 1);
    await c.go("train");
    assert.match(await c.text("main"), /연세대와 교류전/);
    clean(c); await c.ctx.close();
  },
  // 기기 시계가 서버와 5분 넘게 어긋나면 로그인이 풀린다는 안내 (맞으면 안 뜸)
  async clock(b) {
    const a = await openApp(b, "coach"), p = a.page;
    const run = async serverIso => p.evaluate(async iso => { sb.rpc = async n => n === "server_now" ? { data: iso, error: null } : { data: null, error: null }; clockDone = false; await clockCheck(); }, serverIso);
    // 브라우저 시계 = 2026-11-01 10:00 KST (01:00Z). 서버가 1분 차이면 괜찮음, 8시간 차이면 안내, 다시 맞으면 사라짐
    await run("2026-11-01T01:01:00Z"); assert.strictEqual(await p.$("#clockWarn"), null, "1분은 괜찮음");
    await run("2026-10-31T17:00:00Z"); assert.match(await a.text("#clockWarn"), /8시간 빨라요/);
    await run("2026-11-01T01:00:00Z"); assert.strictEqual(await p.$("#clockWarn"), null, "맞으면 안내가 사라짐");
    clean(a); await a.ctx.close();
  },
  // 앱 오류 기록: 우리 파일에서 난 오류는 client_errors 에 한 번만 (같은 오류 두 번이어도 하나)
  async errors(b) {
    const a = await openApp(b, "coach"), p = a.page;
    // 브라우저 시계를 고정해 둬서 setTimeout 대신 스크립트를 바로 실행해 오류를 냄 (두 번)
    await p.evaluate(() => { for (let i = 0; i < 2; i++) { const s = document.createElement("script"); s.textContent = 'throw new Error("테스트 오류")'; document.body.append(s); } });
    await p.waitForTimeout(300);
    const w = (await a.writes("client_errors")).map(x => x[2]);
    assert.strictEqual(w.length, 1, JSON.stringify(w));
    assert.match(w[0].msg, /테스트 오류/); assert.strictEqual(w[0].view, "home");
    await a.ctx.close();
  },
  // 휴대폰 가로: 왼쪽 팀 | 네트 | 오른쪽 팀이 화면을 꽉 채움, 왼쪽 팀은 앞줄(4·3·2)이 네트 쪽 · 4번이 위, 오른쪽 팀은 2번이 위. 세로로 돌리면 위·아래
  async landscape(b) {
    const a = await openApp(b, "coach", { width: 844, height: 390 }), p = a.page;
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(400);
    const g = await p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), w = document.querySelector(".ct-wrap.h");
      const z = (side, n) => r(`.ct-court .ct-p.${side} i`) && [...document.querySelectorAll(`.ct-court .ct-col .ct-p.${side}`)].find(x => x.querySelector("i") && x.querySelector("i").textContent === String(n)).getBoundingClientRect();
      return { fixed: !!w && getComputedStyle(w).position === "fixed", fill: Math.round(r(".ct-court").height), u4: z("us", 4), u2: z("us", 2), u5: z("us", 5), o2: z("opp", 2), o4: z("opp", 4), net: r(".ct-netv") }; });
    assert.ok(g.fixed && g.fill > 280, "가로에서 코트가 화면을 채움 " + g.fill);
    assert.ok(g.u4.top < g.u2.top && g.u4.left > g.u5.left && g.u4.right < g.net.left, "왼쪽 팀: 앞줄이 네트 쪽, 4번이 위");
    assert.ok(g.o2.top < g.o4.top && g.o2.left > g.net.right, "오른쪽 팀: 2번이 위");
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
    assert.strictEqual(await p.$(".ct-wrap.h"), null, "세로로 돌리면 위·아래 코트");
    clean(a); await a.ctx.close();
  },
  // 서브 종류: 플로터 · 스파이크 토글 → kind 저장, 같은 선수 다음 서브는 기억, 떨어진 자리 그림엔 숫자 없음
  // 서브도 공격처럼 상대 코트에 떨어진 자리 (범실은 자리 단계 없음), 분석 탭 '서브가 떨어진 자리'
  async serve(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    assert.strictEqual(await p.$("#vodT"), null, "영상 시계 없음");
    const srv = async (stype, res) => { await p.click('.ct-court .ct-p.us[data-v="1"]'); await p.click('[data-act="ctcat"][data-v="serve"]'); if (stype) await p.click(`[data-act="ctstype"][data-v="${stype}"]`); await p.click(`[data-act="ctact"][data-a="${res}"]`); await p.waitForTimeout(150); };
    await srv("jump", "s3");
    assert.match(await a.text(".ct-spot-h"), /서브가 떨어진 자리/);
    const bb = await p.locator("#ctCourtTap").boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.15); await p.waitForTimeout(250); // 맨 뒤 가운데 = 6번
    await srv(null, "s2"); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(150);
    await p.click('.ct-court .ct-p.us[data-v="1"]'); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="foot"]'); await p.waitForTimeout(150);
    assert.strictEqual(await p.$("#ctCourtTap"), null, "범실은 자리 단계 없음");
    const ev = (await a.writes("scout_events")).map(x => x[2]);
    assert.deepStrictEqual(ev.map(e => [e.action, e.kind, e.zone, e.x, e.y]), [["s3", "jump", 6, 50, 85], ["s2", "jump", null, null, null], ["foot", "jump", null, null, null]]);
    await p.click('.ct-court .ct-p.us[data-v="2"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="kill"]'); await p.waitForTimeout(150);
    assert.strictEqual(await p.evaluate(() => document.querySelectorAll("#ctCourtTap text").length), 0, "구역 숫자 없음");
    await p.click('[data-act="ctnospot"]');
    await p.click('[data-act="sctab"][data-k="stats"]'); await p.waitForTimeout(300);
    assert.match(await a.text("main"), /서브 종류.*스파이크 3/);
    assert.match(await a.text("main"), /서브가 떨어진 자리/);
    assert.strictEqual(await p.evaluate(() => [...document.querySelectorAll(".sec")].find(x => /서브가 떨어진 자리/.test(x.querySelector("h3")?.textContent || "")).querySelectorAll("circle.gM").length), 1, "3-serve 초록 점 하나");
    clean(a); await a.ctx.close();
  },
  // 리베로 자동 교대: 1번 자리 MB 가 서브하다 서브권을 잃으면 그 자리에 리베로, 서브권을 다시 따서 로테가 돌면 MB 는 6번(뒷줄) 그대로 리베로
  async libero(b) {
    const a = await openApp(b, "coach"), p = a.page;
    const r = await p.evaluate(() => {
      const m = { id: "x", team: "A", division: "6", lineup: { us: { slots: [1, 2, 3, 4, 5, 6], pos: ["S", "OH", "MB", "OP", "OH", "MB"], libero: [7] }, opp: { slots: [11, 12, 13, 14, 15, 16], pos: ["S", "OH", "MB", "OP", "OH", "MB"], libero: [17] }, sets: { 1: { rot: 3, opp_rot: 1, serve: "us" } } } };
      const e = o => ({ set_no: 1, side: "us", action: "x", ...o }), lose = e({ skill: "serve", action: "serr", point: "opp" }), win = e({ skill: "attack", action: "kill", point: "us" });
      const at = (ev, z) => { const s = ctState(m, ev, 1), x = ctSideAt(s, "us", z); return x.v + (x.lib ? "L" : ""); };
      const g = { team: "A", opponent: "B", roster: { us: [{ no: 3, pos: "MB" }, { no: 7, pos: "L" }], opp: [] }, sets: { 1: { rot: 3, orot: 1, serve: "us", lu: { us: { rot: 3, slots: [3, 4, 5, 6, 1, 2], lib: 7 } } } } };
      const lz = rs => lvCourtOn(g, "us", lvState(g, rs, 1), 1).vals[0];
      return { court: [at([], 1), at([lose], 1), at([lose, win], 6)], live: [lz([]), lz([{ set_no: 1, kind: "srv", side: "us", point: "opp" }])] };
    });
    assert.deepStrictEqual(r, { court: ["3", "7L", "7L"], live: [3, 7] });
    clean(a); await a.ctx.close();
  },
  // 대회 페이지 실시간 기록: 방식 고르기 없이 Lite 로만 만듦
  async lite(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => lvForm("event:e1")).catch(() => {});
    await p.waitForTimeout(300);
    if (!(await p.$("#lvForm"))) { await a.ctx.close(); throw new Error("실시간 기록 경기 추가 창을 못 엶 (lvForm)"); }
    assert.strictEqual(await p.$("#lv-mode"), null, "방식 고르기 없음");
    await p.evaluate(() => { document.getElementById("lv-opp").value = "B대"; });
    await p.click("#lvForm button[type=submit]"); await p.waitForTimeout(300);
    assert.strictEqual((await a.writes("live_games"))[0][2].mode, "lite");
    // 만든 경기 화면: 점수만 +1 두 번 → 2:0, 다음 세트 창이 열림
    await a.go("cup"); await p.waitForTimeout(200);
    await p.evaluate(() => { state.cup = state.cup || {}; state.cup.key = "event:e1"; state.live.open = state.live.open || (lv().games["event:e1"] || [])[0]?.id; render(); }); await p.waitForTimeout(400);
    const hasPad = await p.$('[data-act="lvpt"][data-v="us"]');
    assert.ok(hasPad, "실시간 기록 화면(점수 +1 버튼)"); { await p.click('[data-act="lvpt"][data-v="us"]'); await p.click('[data-act="lvpt"][data-v="us"]'); await p.waitForTimeout(200);
      const rs = (await a.writes("live_rallies")).map(x => x[2]); assert.strictEqual(rs.filter(r => r.point === "us").length, 2, "점수만 +1 두 번"); }
    // 공격 이어짐을 누르면 상대 팀 화면으로 (다시 이어짐 → 우리 팀), 득점은 그대로
    const sideOn = () => p.evaluate(() => lv().side);
    await p.click('[data-act="lvside"][data-v="us"]');
    await p.click('[data-act="lvcode"][data-v="atk:in"]'); await p.waitForTimeout(150);
    assert.strictEqual(await sideOn(), "opp", "이어짐 → 상대 팀");
    await p.click('[data-act="lvcode"][data-v="atk:in"]'); await p.waitForTimeout(150);
    assert.strictEqual(await sideOn(), "us", "다시 이어짐 → 우리 팀");
    // 3단 넘김(점수 고르는 창 → 3/2/1)도 상대 팀으로
    await p.click('[data-act="lvcode"][data-v="atk:over"]'); await p.waitForTimeout(100); await p.click('[data-act="lvover"][data-v="2"]'); await p.waitForTimeout(150);
    assert.strictEqual(await sideOn(), "opp", "3단 넘김 → 상대 팀");
    await p.click('[data-act="lvside"][data-v="us"]');
    await p.evaluate(() => lvSave("blk:touch")); await p.waitForTimeout(100);
    assert.strictEqual(await sideOn(), "us", "다른 기록은 팀 그대로");
    // 공격 득점 자리: 코트 밖(터치아웃)도 찍힘 → 구역 없이 x < 0, 기록에 "코트 밖"
    const last = () => p.evaluate(() => { const l = lv().rallies[lvGame().id]; return l[l.length - 1]; });
    await p.click('[data-act="lvcode"][data-v="atk:kill"]'); await p.waitForTimeout(150);
    assert.match(await a.text("#sheet"), /터치아웃은 코트 밖/);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    const box = await (await p.$("#lvCourtTap")).boundingBox();
    await p.mouse.click(box.x + box.width * 0.03, box.y + box.height * 0.5); await p.waitForTimeout(150);
    { const r = await last(); assert.ok(r.kind === "atk" && r.res === "kill" && r.x > 100 && r.zone === null, "코트 밖 " + JSON.stringify([r.x, r.y, r.zone])); }
    assert.match(await p.evaluate(() => { const l = lv().rallies[lvGame().id]; return lvLabel(l[l.length - 1]); }), /코트 밖/);
    // 코트 안은 구역 그대로
    await p.click('[data-act="lvcode"][data-v="atk:kill"]'); await p.waitForTimeout(150);
    { const bx = await (await p.$("#lvCourtTap")).boundingBox(); await p.mouse.click(bx.x + bx.width * 0.5, bx.y + bx.height * 0.5); await p.waitForTimeout(150); }
    { const r = await last(); assert.ok(r.x >= 0 && r.x <= 100 && r.y >= 0 && r.y <= 100 && r.zone >= 1, "코트 안 " + JSON.stringify([r.x, r.y, r.zone])); }
    // 다이렉트 공격 종류
    assert.strictEqual(await p.evaluate(() => LV_AT.dir), "다이렉트");
    // 범실 → 3단 처리 미스 = 3단 넘김 미스(공격 아님), 상대 점수, 팀 그대로
    await p.click('[data-act="lvside"][data-v="us"]');
    await p.click('[data-act="lvcode"][data-v="atk:err"]'); await p.waitForTimeout(100);
    assert.match(await a.text("#sheet"), /3단 처리 미스/);
    await p.click('[data-act="lvmiss"][data-v="ovr"]'); await p.waitForTimeout(150);
    { const r = await last(); assert.ok(r.kind === "ovr" && r.res === "err" && r.point === "opp", "3단 처리 미스 " + JSON.stringify([r.kind, r.res, r.point])); }
    assert.strictEqual(await sideOn(), "us");
    // 막힘 → 커버 · 이어감: 커버한 사람 고르는 창 없이 바로
    await p.click('[data-act="lvcode"][data-v="atk:blk"]'); await p.waitForTimeout(100);
    await p.click('[data-act="lvblkd"][data-v="bcov"]'); await p.waitForTimeout(150);
    assert.ok(await p.evaluate(() => document.getElementById("sheet").hidden), "커버 사람 창 없음");
    { const r = await last(); assert.ok(r.kind === "atk" && r.res === "bcov"); }
    await p.evaluate(() => lvSetForm(2)); await p.waitForTimeout(150);
    assert.ok(await p.$("#lvSetForm"), "다음 세트 시작 창");
    await p.evaluate(() => closeSheet());

    // 선수 칸은 팀 색(우리 파랑), 고르면 꽉 채움
    const bg = sel => p.$eval(sel, el => getComputedStyle(el).backgroundColor);
    const off = await bg(".lv-n.us"); await p.click(".lv-n.us"); await p.waitForTimeout(100);
    assert.notStrictEqual(await bg(".lv-n.us.on"), off, "고른 선수 색 바뀜");
    assert.notStrictEqual(off, await bg('[data-act="lvundo"]'), "선수 칸은 다른 버튼과 색이 다름");
    // 전력분석 → 실시간 탭: 만든 경기가 보이고, 누르면 같은 실시간 화면(점수 · 기록)
    await p.evaluate(() => { state.live.open = null; state.cup.key = null; state.dirty = false; }); await a.go("home"); await a.go("scout"); await p.waitForTimeout(200);
    await p.click('[data-act="scltab"][data-k="live"]'); await p.waitForTimeout(400);
    assert.match(await a.text(".sc-list"), /SNU vs B대/);
    await p.click('[data-act="sclive"]'); await p.waitForTimeout(400);
    assert.ok(await p.$('[data-act="lvpt"][data-v="us"]'), "전력분석에서 연 실시간 화면");
    assert.match(await a.text(".lv-score"), /4 : 1/); // 점수 +1 둘 · 득점 둘 · 3단 처리 미스(상대 +1)
    await p.evaluate(() => innerBack()); await p.evaluate(() => { state.dirty = false; render(); }); await p.waitForTimeout(200);
    assert.ok(await p.$('[data-act="sclive"]'), "뒤로 → 실시간 목록");
    await a.go("cup");
    await p.evaluate(() => lvForm("friendly:f1")); await p.waitForTimeout(200);
    assert.strictEqual(await p.$("#lv-label"), null, "교류전 경기 이름 칸 없음");
    assert.strictEqual(await p.evaluate(() => document.getElementById("lv-opp").value), "연세대");
    clean(a); await a.ctx.close();
  },
  // 6인제 대회 세트 라인업: 로테이션 시작 위치 I~VI · 리베로 · 교체 명단 → 저장, 실시간 기록 SNU 코트가 그대로 따라감
  async lineup6(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => { [["p3", "김OH", "OH"], ["p4", "박OH", "OH"], ["p5", "이MB", "MB"], ["p6", "정OP", "OP"], ["p7", "한L", "L"], ["p8", "오S", "S"], ["p9", "류OH", "OH"]].forEach(([id, name, pos], i) => { state.players[id] = { name, pos, number: 20 + i }; }); });
    await a.go("cup"); await p.evaluate(() => { cupState().key = "event:e1"; state.dirty = false; render(); }); await p.waitForTimeout(400);
    assert.match(await a.text("main"), /세트별 라인업/);
    const f = await p.evaluate(() => [1, 2, 3, 4, 5, 6].map(z => document.getElementById(`lu6-${z}`).value));
    assert.ok(f.every(Boolean) && new Set(f).size === 6, "자동 배치 " + f);
    // 교체 명단엔 코트 · 리베로 사람이 안 보임, 코트에 넣으면 교체 명단에서 숨음
    const hid = await p.evaluate(() => { const sel = [1, 2, 3, 4, 5, 6].map(z => document.getElementById(`lu6-${z}`).value), vis = [...document.querySelectorAll(".lu6-b")].filter(c => !c.closest("label").hidden).map(c => c.value);
      return sel.some(v => vis.includes(v)); });
    assert.strictEqual(hid, false, "코트 선수는 교체 명단에 없음");
    await p.evaluate(() => { const vis = [...document.querySelectorAll(".lu6-b")].find(c => !c.closest("label").hidden), z = document.getElementById("lu6-6"); window.__old6 = z.value; z.value = vis.value; z.dispatchEvent(new Event("change", { bubbles: true })); window.__new6 = vis.value; });
    assert.ok(await p.evaluate(() => document.querySelector(`.lu6-b[value="${__new6}"]`).closest("label").hidden && !document.querySelector(`.lu6-b[value="${__old6}"]`).closest("label").hidden), "바꾼 사람은 숨고 빠진 사람은 보임");
    // 그대로 저장 (교체 명단 = 코트 · 리베로 밖 남는 사람 자동)
    await p.click("#lu6Form button[type=submit]"); await p.waitForTimeout(300);
    const w = (await a.writes("lineups")).map(x => x[2]).pop();
    assert.ok(w && w.data.lu && w.data.lu.slots.length === 6, "라인업 저장");
    assert.deepStrictEqual(w.data.lu.lib, ["p7"]);
    assert.ok(w.data.lu.bench.length >= 1 && !w.data.lu.bench.some(x => w.data.lu.slots.includes(x)), "교체 = 코트 밖");
    // 실시간 기록: 이 대회 경기 → SNU 코트 = 낸 라인업 (1번 자리 = I)
    await p.evaluate(() => lvForm("event:e1")); await p.waitForTimeout(200);
    await p.evaluate(() => { document.getElementById("lv-opp").value = "B대"; }); await p.click("#lvForm button[type=submit]"); await p.waitForTimeout(300);
    await p.evaluate(() => { cupState().key = "event:e1"; state.live.open = __db.live_games[0].id; state.dirty = false; render(); }); await p.waitForTimeout(400);
    const on = await p.evaluate(() => { const g = lvGame(); return lvCourtOn(g, "us", lvState(g, [], 1), 1); });
    assert.deepStrictEqual(on.vals.slice(0, 6).map(String).filter((v, i) => !on.libZ.includes(i + 1)), w.data.lu.slots.map(String).filter((v, i) => !on.libZ.includes(i + 1)));
    clean(a); await a.ctx.close();
  },
  // 기록 고치기: 전체 기록 보기 → 내 기록 "고치기" → 동작을 Block Out Kill(공격 득점)로 바꾸면 그 랠리 점수가 그 기록으로 옮겨지고 뒤 기록 점수도 맞춰짐
  async edit(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => CT_ACT.bout && CT_ACT.bout.res === "earned" && CT_CNT.att_pt.includes("bout") && CT_CNT.att_err.includes("aerr") && CT_CNT.rec_err.includes("rerr")), "Block Out Kill = 공격 득점 (다른 셈 그대로)");
    // A: 우리 2번 Hit In Play (점수 없음) · B: 상대 12번 Spike Dig Error (우리 점수 1:0) · C: 우리 1번 서브 3-serve
    await p.click('.ct-court .ct-p.us[data-v="2"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="inplay"]'); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(100);
    await p.click('.ct-court .ct-p.opp[data-v="12"]'); await p.click('[data-act="ctcat"][data-v="dig"]'); await p.click('[data-act="ctact"][data-a="derr"]'); await p.waitForTimeout(100);
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    assert.match(await a.text(".ct-score"), /1 : 0/);
    await p.click('[data-act="ctrecall"]'); await p.waitForTimeout(150);
    assert.match(await a.text(".ct-recs h3"), /1세트 전체 기록/);
    const idA = await p.evaluate(() => sc().events.m1.find(e => e.action === "inplay").id);
    await p.click(`[data-act="ctrec"][data-id="${idA}"]`); await p.waitForTimeout(100); await p.click(`[data-act="ctedit"][data-id="${idA}"]`); await p.waitForTimeout(150);
    await p.selectOption("#cte-act", "bout"); await p.click("#ctEditForm button[type=submit]"); await p.waitForTimeout(300);
    const ev = await p.evaluate(() => sc().events.m1.map(e => [e.action, e.point, e.score]));
    assert.deepStrictEqual(ev, [["bout", "us", "1:0"], ["derr", null, "1:0"]]);
    const up = (await a.writes("scout_events")).filter(x => x[1] === "update").map(x => x[2]);
    assert.ok(up.some(u => u.action === "bout" && u.point === "us") && up.some(u => u.point === null), "서버에도 두 기록 고침");
    assert.match(await a.text(".ct-score"), /1 : 0/);
    // 공격 종류: 공격 창 위 칩(포지션에 맞는 것 먼저 · 더보기) → kind 에 저장, 고치기에서도 바꿈, 분석 탭 "공격 종류" 표
    await p.click('[data-act="ctrecall"]'); await p.waitForTimeout(100);
    await p.click('.ct-court .ct-p.us[data-v="2"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.waitForTimeout(100);
    const chips = await p.$$eval('[data-act="ctatype"]', x => x.map(e => e.textContent.trim()));
    assert.deepStrictEqual(chips, ["레프트 오픈", "레프트 퀵", "앞차", "백차", "파이프", "다이렉트"], "OH 공격 종류 " + chips);
    await p.click('[data-act="ctatype"][data-v="pipe"]'); await p.click('[data-act="ctact"][data-a="kill"]'); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(150);
    const k = (await a.writes("scout_events")).filter(x => x[1] === "insert").pop()[2];
    assert.deepStrictEqual([k.action, k.kind], ["kill", "pipe"]);
    await p.click('[data-act="sctab"][data-k="stats"]'); await p.waitForTimeout(200);
    assert.match(await a.text("main"), /공격 종류.*파이프 1 1/);
    await p.click('[data-act="sctab"][data-k="court"]'); await p.waitForTimeout(150);
    // 부원은 다른 사람 기록을 못 고침 (전력분석 담당 이상은 모두)
    assert.strictEqual(await p.evaluate(() => { const e = { id: "x9", action: "kill", author: "someone" }, was = state.role; const r1 = ctCanEdit(e); state.admin = false; state.role = "player"; const t = state.titles; state.titles = []; const r2 = typeof can === "function" ? ctCanEdit(e) : null; state.admin = true; state.role = was; state.titles = t; return [r1, r2].join(); }), "true,false");
    clean(a); await a.ctx.close();
  },
  // 로테: 랠리 중에 Receive 를 눌러도(공격을 받은 걸 리시브로 기록) 서브권이 안 넘어감 → 상대가 그 랠리를 따면 상대 로테가 돎 (2026-11-04 경희대전)
  async rotrally(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const m = scMatch(), e = (side, action, skill, point, no) => ({ set_no: 1, side, action, skill, point: point || null, opp_no: no ?? null });
      const ev = [e("us", "serr", "serve", "opp", 1), e("opp", "s2", "serve", null, 12), e("us", "r3", "receive"), e("us", "kill", "attack", "us", 2),
        e("us", "s2", "serve", null, 2), e("opp", "r3", "receive"), e("opp", "inplay", "attack"), e("us", "r1", "receive"), e("opp", "dump", "attack", "opp", 14)];
      const s = ctState(m, ev, 1); return { orot: s.orot, rot: s.rot, serve: s.serve, z1: ctSideAt(s, "opp", 1).v };
    });
    assert.deepStrictEqual(r, { orot: 3, rot: 2, serve: "opp", z1: 13 }, "상대 3번째 선수가 1번 자리에서 서브");
    clean(a); await a.ctx.close();
  },
  // 남녀부 바꾸기는 관리자 · 주장(role coach)만 / 대회 엔트리 · Edit Lineup 에서 명단에 선수 바로 추가 (쓰던 칸은 그대로)
  async qpadd(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => openSettings()); await p.waitForTimeout(200);
    assert.ok(await p.$('input[name="teamsw"]'), "관리자는 남녀부 바꾸기");
    await p.evaluate(() => closeSettings());
    await a.go("cup"); await p.click('[data-act="cupopen"][data-k="event:e1"]'); await p.waitForTimeout(200);
    await p.click('[data-act="cupedit"]'); await p.waitForTimeout(150);
    const first = await p.$eval('#cupEntryForm input[name="en"]', e => e.value);
    await p.check(`#cupEntryForm input[name="en"][value="${first}"]`);
    await p.click('#cupEntryForm [data-act="qpadd"]'); await p.waitForTimeout(150);
    await p.fill("#qp-name", "김여부"); await p.fill("#qp-num", "17"); await p.selectOption("#qp-pos", "S");
    await p.click("#qpForm button[type=submit]"); await p.waitForTimeout(300);
    const ins = (await a.writes("players")).find(x => x[1] === "insert");
    assert.ok(ins && ins[2].name === "김여부" && ins[2].number === 17 && ins[2].pos === "S", "players 에 넣음 " + JSON.stringify(ins));
    assert.match(await a.text("#cupEntryForm"), /김여부/);
    assert.ok(await p.$eval(`#cupEntryForm input[name="en"][value="${first}"]`, e => e.checked), "쓰던 체크 그대로");
    assert.ok(await p.evaluate(() => { const id = sortedPlayers().find(x => x.name === "김여부").id; return document.querySelector(`#cupEntryForm input[name="en"][value="${id}"]`).checked; }), "새 선수는 엔트리에 체크");
    clean(a); await a.ctx.close();
    const c = await openApp(b, "player"), q = c.page;
    await q.evaluate(() => openSettings()); await q.waitForTimeout(200);
    assert.strictEqual(await q.$('input[name="teamsw"]'), null, "부원은 남녀부 못 바꿈");
    clean(c); await c.ctx.close();
  },
  // 실시간 감독 요약: 두 팀 비교표(사이드아웃 · 브레이크 · 공격 효율 · 서브 · 리시브 · 범실) → 벤치 메모 → 선수 칸 → 자세한 기록
  async lvcoach(b) {
    const a = await openApp(b, "coach", { width: Number(process.env.W || 390) }), p = a.page;
    await p.evaluate(() => lvForm("event:e1")).catch(() => {}); await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById("lv-opp").value = "B대"; }); await p.click("#lvForm button[type=submit]"); await p.waitForTimeout(300);
    await a.go("cup"); await p.waitForTimeout(200);
    await p.evaluate(() => { state.cup = state.cup || {}; state.cup.key = "event:e1"; state.live.open = (lv().games["event:e1"] || [])[0]?.id; render(); }); await p.waitForTimeout(400);
    await p.evaluate(() => {
      const L = lv(), g = lvGame(); let k = 7; const R = () => (k = (k * 9301 + 49297) % 233280) / 233280;
      const ids = sortedPlayers().map(x => x.id), opp = [1, 3, 7, 9, 12, 15];
      for (let i = 0; i < 34; i++) {
        const s = lvState(g, L.rallies[g.id] || [], 1); if (lvEnd(s, 1)) break;
        const sv = s.serve, rc = sv === "us" ? "opp" : "us", who = sd => { L.side = sd; L.pick = sd === "us" ? ids[Math.floor(R() * ids.length)] : String(opp[Math.floor(R() * 6)]); };
        who(sv); const x = R(); if (x < .1) { lvSave("srv:err"); continue; } if (x < .17) { lvSave("srv:ace"); continue; } lvSave("srv:s2");
        who(rc); lvSave("rcv:" + ["3", "2", "2", "1", "1", "0"][Math.floor(R() * 6)]); { const l = L.rallies[g.id]; if (l[l.length - 1].point) continue; }
        let atkSide = rc;
        for (let t = 0; t < 4; t++) { who(atkSide); L.atype = ["lo", "a", "ro", "pipe", "b"][Math.floor(R() * 5)]; const y = R();
          if (y < .4) { lvSave("atk:kill", { x: Math.round(R() * 100), y: Math.round(R() * 100), zone: 1 + Math.floor(R() * 6) }); break; }
          if (y < .55) { lvSave("atk:err", { miss: "atk" }); break; } if (y < .62) { lvSave("atk:blk"); break; }
          lvSave("atk:in"); atkSide = atkSide === "us" ? "opp" : "us"; who(atkSide); lvSave("dig:2"); }
      }
      state.dirty = false; render();
    });
    await p.waitForTimeout(300);
    if (process.env.SHOT) await (await p.$(".lv-cmp")).evaluate(el => el.closest("section")).then(async () => { const h = await p.$(".lv-cmp"); const sec = await h.evaluateHandle(el => el.closest("section")); await sec.asElement().screenshot({ path: process.env.SHOT }); });
    const txt = await a.text(".lv-page");
    for (const w of ["사이드아웃", "브레이크", "공격 효율", "리시브", "범실"]) assert.ok(txt.includes(w), w);
    clean(a); await a.ctx.close();
  },
  // 교내 대회는 위 탭이 아니라 '대회' 안 칸 → 누르면 교내 대회 화면(위 탭은 대회 그대로), ‹ 대회로 돌아옴
  async campustab(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("cup"); await p.waitForTimeout(200);
    assert.deepStrictEqual(await p.$$eval("#tabs .seg-tab", x => x.map(e => e.textContent.trim())), ["대회", "교류전", "전력분석"]);
    assert.match(await a.text("main"), /교내 대회/);
    await p.evaluate(() => { state.cups = [{ id: "c1", name: "2026 종합체육대회", kind: "gen", start: "2026-10-26", end: "2026-10-29", teams: [{ id: "t1", name: "종보상점" }, { id: "t2", name: "서울대 배구부" }], matches: [{ id: "f", stage: "f", label: "결승", a: "t2", b: "t1", winner: "t1", date: "2026-10-29", refs: {} }], photos: [], avail: {}, picks: {} }]; state.dirty = false; render(); });
    assert.match(await a.text("main"), /우승 종보상점/);
    await p.click('[data-act="cmpgo"][data-id="c1"]'); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(() => state.view), "campus");
    assert.strictEqual(await a.text("#tabs .seg-tab.on"), "대회", "위 탭은 대회");
    await p.click('main [data-act="view"][data-v="cup"]'); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(() => state.view), "cup");
    clean(a); await a.ctx.close();
  },
  // 시즌 화면: 팀 카드(효율 .300 · 리시브 0~3 · 서브 0~4 · 세트당) · 예전 선수 × 경기 표 · 로테 · 공격 종류 · 패스 (번호로 넣은 서울대 경기 포함)
  async seasonview(b) {
    const a = await openApp(b, "coach", { width: Number(process.env.W || 390) }), p = a.page;
    await a.go("scout"); await p.waitForTimeout(300);
    await p.evaluate(() => {
      const S = sc(), names = ["김도현", "박준서", "이민재", "정우진", "한서준", "오지훈"], pos = ["OH", "MB", "OP", "OH", "MB", "Li"];
      names.forEach((n, i) => { state.players["px" + i] = { name: n, pos: pos[i], number: 2 + i * 3, sort: 10 + i }; });
      S.matches.push({ id: "m2", title: "KUSF", date: "2026-10-20", team: "경희대", opponent: "서울대", division: "6", lineup: {} }, { id: "m3", title: "교류전", date: "2026-10-25", team: null, opponent: "고려대", division: "6", lineup: {} });
      let t = Date.parse("2026-10-20T10:00:00Z"), k = 0;
      const R = () => (k = (k * 9301 + 49297) % 233280) / 233280;
      for (const [mid, sd] of [["m2", "opp"], ["m3", "us"]]) {
        const ev = [], pts = [], ot = sd === "us" ? "opp" : "us";
        for (const set of [1, 2]) for (let r = 0; r < 40; r++) {
          const i = Math.floor(R() * 5), who = mid === "m2" ? { opp_no: 2 + i * 3, player_id: null } : { player_id: "px" + i, opp_no: null };
          const pick = R(), kinds = ["lo", "lq", "a", "b", "bc", "pipe", "ro", null];
          const mk = (action, skill, grade, point, extra = {}) => ev.push({ id: mid + "-" + ev.length, match_id: mid, set_no: set, side: sd, action, skill, grade, point, created_at: new Date(t += 1000).toISOString(), ...who, ...extra });
          if (pick < .45) { const g = R(); mk(g < .45 ? "kill" : g < .7 ? "inplay" : "aerr", "attack", g < .45 ? "#" : g < .7 ? "!" : "=", g < .45 ? sd : g < .7 ? null : ot, { kind: kinds[Math.floor(R() * kinds.length)] }); }
          else if (pick < .65) { const g = R(); mk(g < .12 ? "ace" : g < .8 ? "s2" : "serr", "serve", g < .12 ? "#" : g < .8 ? "!" : "=", g < .12 ? sd : g < .8 ? null : ot); }
          else if (pick < .82) { const g = R(); mk(g < .4 ? "r3" : g < .7 ? "r2" : g < .9 ? "r1" : "rerr", "receive", g < .4 ? "#" : g < .7 ? "+" : g < .9 ? "!" : "=", g < .9 ? null : ot); }
          else if (pick < .93) { const g = R(); mk(g < .6 ? "dig" : "derr", "dig", g < .6 ? "+" : "=", g < .6 ? null : ot); }
          else mk("blk", "block", "#", sd);
          const won = R() < .52; pts.push({ id: mid + "p" + pts.length, match_id: mid, set_no: set, rot: 1 + Math.floor(R() * 6), opp_rot: 1 + Math.floor(R() * 6), serve: R() < .5 ? "us" : "opp", won });
        }
        S.events[mid] = ev; S.points[mid] = pts;
      }
      S.all = true; S.ltab = "season"; state.dirty = false; render();
    });
    await p.waitForTimeout(300);
    const txt = await a.text("main");
    for (const w of ["공격 효율", "공격 성공률", "리시브 점수", "서브 점수", "로테이션별 득실", "공격 종류별", "패스에 따른 공격", "김도현"]) assert.ok(txt.includes(w), w);
    assert.match(await a.text(".ss-kpis"), /공격 효율\s*-?\.\d{3}/, "공격 효율은 .300 꼴");
    assert.doesNotMatch(await a.text(".ss-kpis"), /공격 효율\s*-?\d+%/);
    assert.ok(txt.includes("2경기"), "번호 서울대 경기 + 명단 경기");
    await p.click('[data-act="scmetric"][data-v="rcv"]'); await p.waitForTimeout(150);
    assert.match(await a.text("main"), /0~3점 평균 · 2\.0 이상 좋음/);
    assert.match(await a.text(".sc-season .sc-team"), /\d\.\d\d/, "리시브 점수 2.15 꼴");
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
    clean(a); await a.ctx.close();
  },
  // 고치기에서 서브 · 공격 떨어진 자리 넣기 · 고치기 · 지우기 / 번호로 넣은 서울대(SNUVT) 쪽 기록도 시즌 누적에
  async spotedit(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    await p.click('.ct-court .ct-p.us[data-v="2"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="kill"]'); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(100);
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    const id = await p.evaluate(() => sc().events.m1[0].id);
    await p.click('[data-act="ctrecall"]'); await p.waitForTimeout(100);
    await p.click(`[data-act="ctrec"][data-id="${id}"]`); await p.waitForTimeout(100); await p.click(`[data-act="ctedit"][data-id="${id}"]`); await p.waitForTimeout(150);
    assert.ok(!(await p.$eval("#cte-spotw", x => x.hidden)), "공격 득점이면 자리 칸");
    const box = await (await p.$("#cte-court svg")).boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.1); await p.waitForTimeout(100);
    assert.match(await a.text("#cte-spotn"), /번 자리/);
    await p.click("#ctEditForm button[type=submit]"); await p.waitForTimeout(300);
    const e1 = await p.evaluate(() => sc().events.m1[0]);
    assert.ok(e1.x === 50 && e1.y === 90 && e1.zone, "자리 저장 " + JSON.stringify([e1.x, e1.y, e1.zone]));
    assert.ok((await a.writes("scout_events")).some(x => x[1] === "update" && x[2].x === 50), "서버에도");
    // 동작을 범실로 바꾸면 자리 칸 숨고 자리 지움
    await p.click('[data-act="ctrecall"]'); await p.waitForTimeout(100);
    await p.click(`[data-act="ctrec"][data-id="${id}"]`); await p.waitForTimeout(100); await p.click(`[data-act="ctedit"][data-id="${id}"]`); await p.waitForTimeout(150);
    await p.selectOption("#cte-act", "aerr"); assert.ok(await p.$eval("#cte-spotw", x => x.hidden));
    await p.click("#ctEditForm button[type=submit]"); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => sc().events.m1[0].x), null);
    // 시즌: 상대가 SNUVT(번호) → 그 쪽 기록이 등번호로 부원에 붙어 시즌 표에
    await p.evaluate(() => { const id = sortedPlayers().find(x => x.name === "최수혁").id; state.players[id].number = 12; sc().matches.find(m => m.id === "m1").opponent = "SNUVT"; });
    await p.click('.ct-court .ct-p.opp[data-v="12"]'); await p.click('[data-act="ctcat"][data-v="attack"]'); await p.click('[data-act="ctact"][data-a="kill"]'); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(100);
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => scSnuSide(sc().matches.find(m => m.id === "m1")) === "opp"));
    const html = await p.evaluate(() => { sc().all = true; return scoutSeason(); });
    assert.match(html, /최수혁/, "SNUVT 쪽 #12 = 부원 최수혁 시즌 표에");
    assert.match(html, /A대/, "열 이름은 상대(분석 팀)");
    clean(a); await a.ctx.close();
  },
  // 라인업에서 번호를 고치면 이미 넣은 기록 번호도 바꿀지 묻고 바꿈 · 숫자 칸 휠은 값 안 바꿈
  async lurename(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => { window.confirmDel = async () => true; });
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    await p.click('.ct-court .ct-p.us[data-v="1"]'); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="foot"]'); await p.waitForTimeout(150);
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(200);
    await p.click('[data-act="ctlineup"]'); await p.waitForTimeout(200);
    // 휠: 숫자 칸을 고르고 굴리면 칸에서 빠져나옴
    await p.focus("#ctn-0"); await p.mouse.move(0, 0); await p.$eval("#ctn-0", el => el.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true })));
    assert.notStrictEqual(await p.evaluate(() => document.activeElement && document.activeElement.id), "ctn-0", "휠이면 칸에서 빠짐");
    await p.fill("#ctn-0", "9"); await p.click("#ctLineupForm button[type=submit]"); await p.waitForTimeout(400);
    assert.deepStrictEqual(await p.evaluate(() => sc().events.m1.filter(e => e.action === "foot").map(e => e.opp_no)), [9], "기록 번호 1 → 9");
    assert.ok((await a.writes("scout_events")).some(x => x[1] === "update" && x[2].opp_no === 9), "서버도 바꿈");
    clean(a); await a.ctx.close();
  },
  // 끼워 넣기 · 지우기: 기록 ⋯ → "이 앞에 넣기" → 코트 · 점수가 그 자리 기준 → 기록하면 그 사이 시각으로 들어감 → 끝내기 → 뒤 기록 점수 다시 맞춤. 지우면 다시 맞춤
  async insert(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => { window.confirmDel = async () => true; });
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    const kill = async (side, v) => { await p.click(`.ct-court .ct-p.${side}[data-v="${v}"]`); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="ace"]'); await p.click('[data-act="ctnospot"]'); await p.waitForTimeout(120); }; // 서브 에이스 = 랠리 하나
    await kill("us", 2); await kill("opp", 12); await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    await p.evaluate(() => sc().events.m1.forEach((e, i) => { e.created_at = new Date(Date.parse("2026-11-01T01:00:00Z") + i * 10000).toISOString(); })); // 시계가 멈춰 있어 시각을 벌려 둠
    const id2 = await p.evaluate(() => sc().events.m1.find(e => e.side === "opp").id);
    await p.click('[data-act="ctrecall"]'); await p.click(`[data-act="ctrec"][data-id="${id2}"]`); await p.click(`[data-act="ctins"][data-v="before"]`); await p.waitForTimeout(200);
    assert.ok(await p.$(".ct-ins"), "끼워 넣는 중 표시"); assert.match(await a.text(".ct-score"), /1 : 0/, "그 자리 점수");
    await kill("us", 3); await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    assert.match(await a.text(".ct-score"), /2 : 0/);
    await p.click('[data-act="ctinsend"]'); await p.waitForTimeout(400);
    const ev = await p.evaluate(() => sc().events.m1.map(e => [e.side, e.opp_no, e.score]));
    assert.deepStrictEqual(ev, [["us", 2, "1:0"], ["us", 3, "2:0"], ["opp", 12, "2:1"]], "순서 · 뒤 기록 점수");
    const ins = (await a.writes("scout_events")).filter(x => x[1] === "insert").pop()[2];
    assert.ok(ins.created_at && Date.parse(ins.created_at) < Date.parse(await p.evaluate(id => sc().events.m1.find(e => e.id === id).created_at, id2)), "넣은 기록 시각이 뒤 기록보다 앞");
    assert.ok((await a.writes("scout_events")).some(x => x[1] === "update" && x[2].score === "2:1"), "서버도 점수 고침");
    // 좁은 틈(4ms)에도 30개를 차례로 넣을 수 있음 (µs 단위)
    const tight = await p.evaluate(() => { const S = sc(), save = S.ins, base = ctUs("2026-11-01T02:00:00.000Z"); S.ins = { mid: "m1", set: 1, cur: base, next: base + 4000, label: "t" }; const out = [];
      for (let i = 0; i < 30; i++) { const r = { match_id: "m1", set_no: 1, side: "us", skill: "fault", grade: "!", action: "unk" }; if (!ctPush(r, null)) break; out.push(ctUs(r.created_at)); }
      S.ins = save; const ok2 = out.every((t, i) => t > (i ? out[i - 1] : base) && t < base + 4000); S.events.m1 = S.events.m1.filter(e => e.action !== "unk"); ctQ.list = ctQ.list.filter(x => !x.ev || x.ev.action !== "unk"); return [out.length, ok2]; });
    assert.deepStrictEqual(tight, [30, true]);
    // 넣은 기록 지우기 → 뒤 기록 점수 다시 1:1
    const id3 = await p.evaluate(() => sc().events.m1.find(e => e.opp_no === 3).id);
    await p.click('[data-act="ctrecall"]').catch(() => {}); await p.waitForTimeout(100);
    if (!(await p.$(`[data-act="ctrec"][data-id="${id3}"]`))) await p.click('[data-act="ctrecall"]');
    await p.click(`[data-act="ctrec"][data-id="${id3}"]`); await p.click(`[data-act="ctdelrec"]`); await p.waitForTimeout(400);
    assert.deepStrictEqual(await p.evaluate(() => sc().events.m1.map(e => [e.opp_no, e.score])), [[2, "1:0"], [12, "1:1"]]);
    // 다른 기기에서 지금 기록 중(다른 사람 기록이 10분 안)이면: 그 사람 기록 ⋯ → 안내만, 지우기 · 끼워 넣기 · RESET 막힘
    await p.evaluate(() => { sc().events.m1.push({ id: "live1", match_id: "m1", set_no: 1, side: "us", player_id: null, opp_no: 4, action: "s2", skill: "serve", point: null, score: "1:1", author: "someone", created_at: new Date(Date.now() - 60000).toISOString() }); state.dirty = false; render(); });
    await p.click('[data-act="ctrec"][data-id="live1"]').catch(async () => { await p.click('[data-act="ctrecall"]'); await p.click('[data-act="ctrec"][data-id="live1"]'); }); await p.waitForTimeout(150);
    assert.match(await a.text("#sheet .ct-live-note"), /다른 기기에서 기록하는 중/);
    assert.strictEqual(await p.$('#sheet [data-act="ctdelrec"]'), null, "지우기 버튼 없음");
    await p.evaluate(() => closeSheet());
    await p.evaluate(() => ctDelRec("live1")); await p.waitForTimeout(150);
    assert.ok(await p.evaluate(() => sc().events.m1.some(e => e.id === "live1")), "남의 기록 안 지워짐");
    await p.evaluate(() => ctReset()); await p.waitForTimeout(150);
    assert.ok(await p.evaluate(() => sc().events.m1.length === 3), "RESET 막힘");
    clean(a); await a.ctx.close();
  },
  // 아마추어 규칙(3세트, 21 · 21 · 15) · 서울대라고 넣은 번호 팀은 부원 이름 · 포지션 · 분석 표 포지션 · 다른 기기 기록은 Undo 안 됨
  async rules(b) {
    const a = await openApp(b, "coach"), p = a.page;
    const r = await p.evaluate(() => ({ s1: setWinner(21, 19, 1), s1n: setWinner(21, 20, 1), s3: setWinner(15, 13, 3), s3n: setWinner(15, 14, 3), max: SET_MAX,
      lv: lvEnd({ us: 13, op: 15 }, 3), lv2: lvEnd({ us: 20, op: 22 }, 2) }));
    assert.deepStrictEqual(r, { s1: "us", s1n: null, s3: "us", s3n: null, max: 3, lv: "opp", lv2: "opp" });
    // 3판 2선승: 1 · 2세트를 한 팀이 다 이기면 3세트 칩 없음, 1 · 1이면 있음
    const sets = await p.evaluate(() => { const m = { id: "x", lineup: {} }, pts = (n, side, k) => Array.from({ length: k }, () => ({ set_no: n, action: "pt", side, point: side, skill: "fault" }));
      return [ctSetNos([...pts(1, "us", 21), ...pts(2, "us", 21)], m).join(), ctSetNos([...pts(1, "us", 21), ...pts(2, "opp", 21)], m).join(), ctSetNos(pts(1, "us", 21), m).join()]; });
    assert.deepStrictEqual(sets, ["1,2", "1,2,3", "1,2,3"]);
    await p.evaluate(() => { state.players.p1.number = 11; state.players.p1.pos = "OP"; });
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { scMatch().opponent = "서울대"; const O = scMatch().lineup.opp; O.pos = ["", "", "", "", "", ""]; state.dirty = false; render(); }); await p.waitForTimeout(200);
    assert.match(await a.text('.ct-court .ct-p.opp[data-v="11"]'), /최수혁/, "서울대 번호 → 부원 이름");
    assert.match(await a.text('.ct-court .ct-p.opp[data-v="11"]'), /OP/, "부원 포지션");
    assert.deepStrictEqual(await p.$$eval('[data-act="scset"]', x => x.map(e => e.textContent.trim())), ["1", "2", "3"], "세트 1~3");
    // 기록 하나 → 분석 표에 배번 · 이름 · 포지션
    await p.click('.ct-court .ct-p.opp[data-v="11"]'); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="foot"]'); await p.waitForTimeout(200);
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(200);
    // 다른 기기 기록(이 기기 목록에 없음)은 Undo 로 안 지워짐
    await p.evaluate(() => { window.confirmDel = async () => true; sc().events.m1.push({ id: "other1", match_id: "m1", set_no: 1, side: "us", action: "foot", skill: "serve", point: "opp" }); });
    await p.evaluate(() => ctUndo()); await p.waitForTimeout(200);
    assert.ok(await p.evaluate(() => sc().events.m1.some(e => e.id === "other1")), "다른 기기 기록은 남음");
    assert.ok(await p.evaluate(() => !sc().events.m1.some(e => e.action === "foot" && e.side === "opp")), "이 기기 기록은 지워짐");
    await p.evaluate(() => { sc().events.m1 = sc().events.m1.filter(e => e.id !== "other1"); });
    await p.click('.ct-court .ct-p.opp[data-v="11"]'); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="foot"]'); await p.waitForTimeout(200);
    await p.click('[data-act="sctab"][data-k="stats"]'); await p.waitForTimeout(300);
    const row = await p.evaluate(() => [...document.querySelectorAll(".ct-sheet tbody tr")].map(t => t.innerText.replace(/\s+/g, " ")).find(t => /^11 /.test(t)));
    assert.match(row || "", /^11 최수혁 OP/, "분석 표: 배번 · 이름 · 포지션 " + row);
    // 지운 기록 되살리기: Settings 에 사람 · 2분 안 묶음으로 보이고, 묶음째 되살림
    await p.evaluate(() => { const t0 = Date.parse("2026-11-02T06:15:00Z"), mk = (i, by, dt) => ({ id: "d" + i, deleted_at: new Date(t0 + dt * 1000).toISOString(), by_name: by, set_no: 1, score: `${i}:0`, action: "kill" });
      window.__rows = [mk(1, "최수혁", 0), mk(2, "최수혁", 30), mk(3, "최수혁", 90), mk(4, "이석훈", 400)];
      sb.rpc = async (n, a) => n === "scout_trash" ? { data: window.__rows, error: null } : n === "scout_restore" ? (window.__res = a, { data: a.ids.length, error: null }) : { data: null, error: null }; });
    await p.click('[data-act="sctab"][data-k="court"]'); await p.waitForTimeout(200);
    await p.click('[data-act="ctcfg"]'); await p.waitForTimeout(300);
    assert.strictEqual(await p.$$eval(".ct-trl li", x => x.length), 2, "두 묶음");
    assert.match(await a.text(".ct-trl li"), /최수혁 · 3개/);
    await p.click('[data-act="cttrashres"][data-i="0"]'); await p.waitForTimeout(300);
    assert.deepStrictEqual(await p.evaluate(() => window.__res.ids), ["d1", "d2", "d3"]);
    clean(a); await a.ctx.close();
  },
  // Undo · 되돌리기: 빨리 여러 번 눌러도, 지우기가 서버에 가기 전에 새로고침해도 다 지워짐 (지우기도 폰 대기열에 남음)
  async undo(b) {
    const a = await openApp(b, "coach"), p = a.page;
    await p.evaluate(() => { window.confirmDel = async () => true; });
    // 전력분석: Foot Fault 4개 → 서버에 4개
    await a.go("scout"); await p.click('[data-act="scopen"][data-id="m1"]'); await p.waitForTimeout(300);
    for (const v of [1, 2, 3, 4]) { await p.click(`.ct-court .ct-p.us[data-v="${v}"]`); await p.click('[data-act="ctcat"][data-v="serve"]'); await p.click('[data-act="ctact"][data-a="foot"]'); await p.waitForTimeout(120); }
    await p.evaluate(() => ctFlush()); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => __db.scout_events.length), 4);
    // 인터넷 끊긴 채로 Undo 두 번 연달아 → 화면 2개, 폰 대기열에 지우기 2개
    await p.evaluate(async () => { window.__offline = true; await ctUndo(); await ctUndo(); }); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => sc().events.m1.length), 2, "Undo 두 번 → 화면 2개");
    assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem("snuvt-ctq")).filter(x => x.del).length), 2, "지우기 2개가 폰에 남음");
    // 새로고침처럼 서버에서 다시 불러와도 지운 것은 안 보임
    await p.evaluate(() => scoutEvents("m1")); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(() => sc().events.m1.length), 2, "다시 불러와도 2개");
    await p.evaluate(() => { window.__offline = false; return ctFlush(); }); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => __db.scout_events.length), 2, "서버도 2개");
    // 실시간: 기록 3개 → 끊긴 채로 되돌리기 두 번 → 다시 불러와도 1개 → 서버도 1개
    await p.evaluate(() => lvForm("event:e1")); await p.waitForTimeout(200);
    await p.evaluate(() => { document.getElementById("lv-opp").value = "B대"; }); await p.click("#lvForm button[type=submit]"); await p.waitForTimeout(300);
    await a.go("cup"); await p.evaluate(() => lvLoadGames({ kind: "event", id: "e1" })); await p.evaluate(() => { cupState().key = "event:e1"; state.live.open = __db.live_games[0].id; state.dirty = false; render(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { for (let i = 0; i < 3; i++) lvSave("blk:touch"); return lvFlush(); }); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => __db.live_rallies.length), 3);
    await p.evaluate(async () => { window.__offline = true; await lvUndo(); await lvUndo(); }); await p.waitForTimeout(300);
    const gid = await p.evaluate(() => lvGame().id);
    await p.evaluate(gid => lvLoadRallies(gid), gid); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(gid => lv().rallies[gid].filter(r => r.kind).length, gid), 1, "되돌리기 두 번 → 다시 불러와도 1개");
    await p.evaluate(() => { window.__offline = false; return lvFlush(); }); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => __db.live_rallies.length), 1, "서버도 1개");
    clean(a); await a.ctx.close();
  },
  // 훈련 계획: 기본 틀이 드릴 목록 이름과 맞고, 드릴 설명이 뜸
  async practice(b) {
    const L = require("../js/library.js"), names = new Set(L.DRILL_LIB.map(x => x.n));
    for (const blk of L.PRACTICE_TEMPLATE()) for (const g of blk.groups) for (const d of g.drills) assert.ok(names.has(d.n), `기본 틀에 없는 드릴: ${d.n}`);
    assert.strictEqual(names.size, L.DRILL_LIB.length, "드릴 이름 중복");
    for (const x of L.DRILL_LIB) assert.ok(L.DRILL_SRC[x.src], `출처 없음: ${x.n}`);
    const a = await openApp(b, "coach"), p = a.page;
    await a.go("practice"); await p.click(".pr-day:not(.past)"); await p.waitForTimeout(200);
    await p.click('[data-act="prnew"][data-k="tpl"]'); await p.waitForTimeout(300);
    assert.strictEqual(await p.evaluate(() => document.querySelectorAll(".pr-blk").length), L.PRACTICE_TEMPLATE().length);
    clean(a); await a.ctx.close();
  },
};

(async () => {
  const pick = process.argv.slice(2), names = pick.length ? pick : Object.keys(SUITES);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let fail = 0;
  for (const n of names) {
    if (!SUITES[n]) { console.log(`? ${n} (없는 테스트)`); fail++; continue; }
    const t0 = Date.now();
    try { await SUITES[n](browser); console.log(`✓ ${n} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
    catch (e) { fail++; console.log(`✗ ${n}\n  ${String(e.message || e).split("\n").join("\n  ")}`); }
  }
  await browser.close();
  console.log(fail ? `\n${fail}개 실패` : "\n모두 통과");
  process.exit(fail ? 1 : 0);
})();
