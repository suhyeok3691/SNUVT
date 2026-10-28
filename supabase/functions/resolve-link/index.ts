// 네이버 짧은 주소(naver.me/…)를 따라가 치지직 다시보기 주소로 바꿔 줌. 로그인한 부원만(JWT), naver.me만 받음
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const start = String(body.url || "").trim();
  if (!/^https?:\/\/naver\.me\/[A-Za-z0-9]+\/?$/.test(start)) return json({ error: "naver.me 주소만 돼요" }, 400);
  let u = start.replace(/^http:/, "https:");
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 SNUVT link check" } });
    const loc = r.headers.get("location"); await r.body?.cancel();
    if (!loc) break;
    u = new URL(loc, u).toString();
    if (/chzzk\.naver\.com\/video\/\d+/.test(u)) break;
  }
  const m = /chzzk\.naver\.com\/video\/(\d+)/.exec(u);
  return m ? json({ url: `https://chzzk.naver.com/video/${m[1]}`, time: Number((/[?&]currentTime=(\d+)/.exec(u) || [])[1] || 0) }) : json({ error: "치지직 다시보기 주소가 아니에요", url: u }, 422);
});
