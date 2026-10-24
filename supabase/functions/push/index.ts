// 휴대폰 알림 보내기 (서버 예약 작업·공지 트리거가 부름). x-cron 비밀값이 맞아야만 동작.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://snuvt.vercel.app";
const MSG: Record<string, { title: string; body: string; tag: string; url: string }> = {
  morning: { title: "아침 컨디션", body: "수면·피로·근육통·기분 체크하고 오늘 운동 확인하세요", tag: "morning", url: "./#train" },
  evening: { title: "오늘 운동 기록", body: "RPE·완료율, 아픈 곳 있으면 통증도 남겨 주세요", tag: "evening", url: "./#train" },
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
async function keys() {
  const { data } = await sb.rpc("push_keys");
  return (Array.isArray(data) ? data[0] : data) || {};
}

Deno.serve(async (req) => {
  let k = await keys();
  if (!k.cron || req.headers.get("x-cron") !== k.cron) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  if (!k.priv) {
    const g = webpush.generateVAPIDKeys();
    await sb.rpc("push_set_vapid", { pub: g.publicKey, priv: g.privateKey });
    k = await keys();
  }
  if (body.kind === "init") return json({ ok: true, ready: !!k.pub });
  webpush.setVapidDetails(SITE, k.pub, k.priv);
  let targets: { endpoint: string; p256dh: string; auth: string }[] = [];
  let msg = MSG[body.kind];
  if (body.kind === "notice") msg = { title: "새 공지", body: String(body.title || "").slice(0, 80), tag: "notice", url: "./#notice" };
  if (body.kind === "test" && body.sub) { targets = [body.sub]; msg = { title: "알림 테스트", body: "알림이 잘 와요", tag: "test", url: "./#home" }; }
  else if (msg) {
    // 공지는 그 팀에게만 (team 없으면 전체: 아침·저녁 알림은 사람마다 따로라 상관없음)
    const { data, error } = await sb.rpc("push_targets_team", { kind: body.kind, team: body.team ?? null });
    if (error) return json({ error: error.message }, 500);
    targets = data || [];
  } else return json({ error: "kind" }, 400);
  const payload = JSON.stringify(msg);
  let sent = 0, failed = 0, gone = 0;
  const errs: string[] = [];
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 4 * 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { gone++; await sb.rpc("push_gone", { ep: t.endpoint }); }
      else { failed++; errs.push(String(code || (e as Error).message).slice(0, 120)); }
    }
  }));
  return json({ kind: body.kind, targets: targets.length, sent, failed, gone, errs: errs.slice(0, 5) });
});
