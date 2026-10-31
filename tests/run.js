/* SNUVT 화면 테스트 (Playwright · 가짜 Supabase, 진짜 서버에 안 붙음)
 *   cd tests && npm install && npm test        → 전부
 *   node run.js smoke                          → 하나만 (smoke · picker · guest · friendly · practice)
 * 저장소의 파일을 그대로 http://local.test 로 띄우고, CDN 의 supabase-js 자리에 mock.js 를 넣음.
 * 브라우저 시계는 2026-11-01 (일) 10:00 KST 로 고정 (mock 데이터 기준). */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), assert = require("assert");
const { mockScript } = require("./mock.js");
const ROOT = path.join(__dirname, "..") + path.sep;
const NOW = new Date("2026-11-01T10:00:00+09:00");
const VIEWS = ["home", "practice", "notes", "video", "jp", "scout", "train", "plan", "rec", "season", "comps", "cup", "fr", "campus", "sched", "report", "roster", "intake"];
const TYPES = { js: "text/javascript", html: "text/html", css: "text/css", png: "image/png", webmanifest: "application/manifest+json", json: "application/json" };

async function openApp(browser, role, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  const page = await ctx.newPage(), errs = [], missing = [];
  await page.clock.setFixedTime(NOW);
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
  const go = async v => { await page.evaluate(v => { location.hash = "#" + v; }, v); await page.waitForTimeout(400); };
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
  // 전력분석 명단·로테: S ↔ OP 맞바꿈, OH ↔ MB 순서 바꾸기(두 번 누르면 원래대로), 명단 번호 고치면 코트도 (다른 팀 = 번호 입력 방식)
  async rotation(b) {
    const a = await openApp(b, "coach"), p = a.page;
    const ok = await p.evaluate(() => {
      document.getElementById("sheet").querySelector(".sheet-body").innerHTML = `<form id="lvRosForm"><div class="lvr-list" id="lvrList"></div>${[1, 2, 3, 4, 5, 6].map(z => `<input class="lvr-c" data-z="${z}">`).join("")}</form>`;
      const tag = ["S1", "OH1", "MB1", "OP1", "OH2", "MB2"];
      tag.forEach((v, i) => { document.querySelector(`.lvr-c[data-z="${i + 1}"]`).value = v; });
      try { lvRosInfo = () => {}; } catch (e) {}
      lvRosSwap("S|OP");
      return [1, 2, 3, 4, 5, 6].map(z => document.querySelector(`.lvr-c[data-z="${z}"]`).value).join(" ");
    });
    assert.strictEqual(ok, "OP1 OH1 MB1 S1 OH2 MB2");
    const ord = await p.evaluate(() => {
      const tag = ["S1", "OH1", "MB1", "OP1", "OH2", "MB2"], read = () => [1, 2, 3, 4, 5, 6].map(z => document.querySelector(`.lvr-c[data-z="${z}"]`).value).join(" ");
      tag.forEach((v, i) => { document.querySelector(`.lvr-c[data-z="${i + 1}"]`).value = v; });
      lvRosSwap("OH~MB"); const one = read(); lvRosSwap("OH~MB"); return [one, read()];
    });
    assert.deepStrictEqual(ord, ["S1 MB1 OH1 OP1 MB2 OH2", "S1 OH1 MB1 OP1 OH2 MB2"]);
    // 명단에서 번호를 고치면 코트 · 리베로 칸도 같이 (치는 중 "1" → "12" 도 따라감), 저장할 때 {옛: 새}
    const ren = await p.evaluate(() => {
      const f = document.getElementById("lvRosForm");
      f.innerHTML = ["OH1", "MB1", "Li"].map(no => lvRosRow({ no, pos: "" })).join("") + [1, 2, 3, 4, 5, 6].map(z => `<input class="lvr-c" data-z="${z}">`).join("") + `<input id="lvrLib">`;
      ["S1", "OH1", "MB1", "OP1", "OH2", "MB2"].forEach((v, i) => { f.querySelector(`.lvr-c[data-z="${i + 1}"]`).value = v; }); f.querySelector("#lvrLib").value = "Li";
      const n = f.querySelectorAll(".lvr-n");
      for (const v of ["", "1", "12"]) { n[0].value = v; lvRosRename(n[0]); }
      n[2].value = "7"; lvRosRename(n[2]);
      return { court: [1, 2, 3, 4, 5, 6].map(z => f.querySelector(`.lvr-c[data-z="${z}"]`).value).join(" "), lib: f.querySelector("#lvrLib").value, map: lvRosRenames(f) };
    });
    assert.deepStrictEqual(ren, { court: "S1 12 MB1 OP1 OH2 MB2", lib: "7", map: { OH1: "12", Li: "7" } });
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
