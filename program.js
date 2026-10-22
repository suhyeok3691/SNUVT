/* SNUVT Physical — 처방 엔진
 * 'SNUVT Physical 운동 처방 라이브러리' 문서의 규칙을 코드로 옮긴 것.
 * 화면과 분리된 순수 함수만 둔다 (입력: 선수·측정·인바디·부상 모듈 / 출력: 요일 처방).
 */

const NET = 243; // 남자부 네트 높이 (cm)
const POS = { OH: "아웃사이드", MB: "미들블로커", OP: "아포짓", S: "세터", Li: "리베로" };
const POS_ORDER = ["OH", "MB", "OP", "S", "Li"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"]; // 0 = 월요일
const WEEKS = [
  { label: "1주차", goal: "측정 · 적응" },
  { label: "2주차", goal: "발달" },
  { label: "3주차", goal: "발달 · 최고 강도" },
  { label: "4주차", goal: "감량 · 대회" },
];

/* ---------- 공통 블록 ---------- */
const WARMUP = [
  { name: "조깅 · 사이드 셔플 · 카리오카 · 스킵", rx: "3분", cue: "체온 올리기" },
  { name: "회전 런지 · 옆 런지 · 다리 스윙", rx: "3분", cue: "정적 스트레칭을 넣는다면 근육당 30초 이내" },
  { name: "한 발 서기 30초 → 한 발 홉 착지 고정 5회", rx: "2분", cue: "좌·우 모두" },
  { name: "스쿼트 점프 착지 고정", rx: "5회", cue: "무릎은 발끝 방향, 착지 소리 작게" },
  { name: "밴드 외회전 2×10 · 밴드 벌리기 10 · 엎드려 Y·T 각 8 · 오픈북 좌우 5", rx: "4분", cue: "어깨 외회전·견갑·흉추" },
  { name: "어프로치 점프", rx: "3회", cue: "70% → 90%" },
];
const COOLDOWN = [
  { name: "가볍게 걷기·조깅", rx: "3분", cue: "심박 내리기" },
  { name: "종아리 · 엉덩이 굴곡근 · 햄스트링 · 어깨 뒤쪽 스트레칭", rx: "부위당 30초", cue: "통증 없는 범위" },
  { name: "통증 체크 (무릎·어깨·발목·허리)", rx: "0–10", cue: "3 이상이면 세션 기록에 남기기" },
  { name: "세션 RPE 기록", rx: "30분 안에", cue: "아래 '세션 기록하기'" },
];
const HANDSTAND = [
  "", "파이크 버티기 (손은 바닥, 발은 벤치) 30초 × 3", "벽 걸어 올라가기 3–5회",
  "벽 물구나무 버티기 20–40초 × 3", "벽 물구나무 어깨 터치 → 벽 없이 킥업 3×4",
];
const POSJ = { MB: "슬라이드 스텝 후 블록 점프", OP: "공격 어프로치 + 블록 번갈아", OH: "공격 어프로치 점프", S: "점프 토스 테이크오프 (양발 착지)" };

/* ---------- 점프 라이브러리 (월요일) — 단계 1 낮음 · 2 중간 · 3 높음 ---------- */
const PLYO = [
  { key: "pogo", tier: 1, name: "포고 점프", cue: "발목만 튕기듯, 무릎 거의 고정", sets: [2, 2, 2, 1], reps: [10, 10, 10, 10] },
  { key: "stick", tier: 1, name: "스쿼트 점프 착지 고정", cue: "착지 후 2초 멈춤, 무릎은 발끝 방향", sets: [2, 3, 0, 0], reps: [5, 5, 5, 5] },
  { key: "snap", tier: 1, name: "스냅다운", cue: "팔을 휘두르며 착지 자세로 떨어지기, 소리 없이", sets: [2, 0, 0, 0], reps: [5, 5, 5, 5] },
  { key: "cmj", tier: 2, name: "CMJ 최대 노력 (팔 스윙)", cue: "매 회 최고 높이, 세트 사이 60–90초", sets: [0, 3, 3, 2], reps: [4, 4, 4, 3] },
  { key: "broad", tier: 2, name: "연속 제자리멀리뛰기", cue: "3번 연속, 착지하자마자 다음", sets: [0, 3, 4, 2], reps: [3, 3, 3, 3], fmt: "chain" },
  { key: "line", tier: 2, name: "라인 좌우 홉 (양발)", cue: "지면 접촉 짧게", sets: [0, 2, 0, 0], reps: ["10초", "10초", "10초", "10초"], fmt: "time" },
  { key: "posj", tier: 3, name: "포지션별 점프", cue: "실전 스텝으로", sets: [0, 0, 3, 2], reps: [3, 3, 3, 2] },
  { key: "drop", tier: 3, name: "드롭 점프 (30cm 벤치)", cue: "떨어지자마자 최대한 빨리·높이", sets: [0, 0, 2, 0], reps: [4, 4, 4, 4] },
];
const PLYO_ORDER = ["pogo", "stick", "snap", "cmj", "lat", "broad", "line", "posj", "step", "drop"];

/* ---------- 근력 라이브러리 ---------- */
const MON_STRENGTH = [
  { key: "squat", name: "백스쿼트", cue: "올라올 땐 최대한 빠르게, 내려갈 땐 2–3초 · 세트 간 3분",
    rx: ["동작 연습 2×8 (가볍게)", "4×5 · RIR 3", "4×4 · RIR 2 · 무게 ↑", "2×3 · 3주차 무게 유지"] },
  { key: "rdl", name: "루마니안 데드리프트 (바벨)", cue: "엉덩이 뒤로, 허리 중립 · 세트 간 3분",
    rx: ["동작 연습 2×8", "3×6 · RIR 3", "3×5 · RIR 2", "2×5"] },
  { key: "bss", name: "불가리안 스플릿 스쿼트 (덤벨)", cue: "앞발 뒤꿈치로 밀기 · 세트 간 90초",
    rx: [null, "3×6 (다리당)", "3×6 · 무게 ↑", "1×6"] },
  { key: "stepup", name: "덤벨 스텝업 (벤치 높이)", cue: "올라간 다리로만 밀기",
    rx: [null, "3×6 (다리당)", "3×6", null] },
  { key: "calf", name: "한 발 카프레이즈", cue: "위에서 1초 멈춤",
    rx: [null, "3×12 (다리당)", "3×12", "1×12"] },
  { key: "ham", name: "햄스트링 컬 머신", cue: "내릴 때 3초",
    rx: [null, "2×8", "2×8", null] },
  { key: "nordic", name: "노르딕 햄스트링 (선택)", cue: "파트너가 발목 고정, 버틸 수 있는 데까지 천천히",
    rx: [null, "2×4", "2×5", null] },
];
const THU = [
  { key: "pogo", name: "포고 점프", rx: "2×10", cue: "다음 날 정규 훈련이 있어 점프는 이것만" },
  { key: "mb", name: "메디신볼 오버헤드 슬램 · 옆으로 던지기", rx: "3×5", cue: "파워 운동이라 근력 운동 전에", weeks: [1, 2] },
  { key: "hip", name: "바벨 힙 쓰러스트", rx: "3×8 · RIR 2", rx2: "3×6 · 무게 ↑", cue: "엉덩이로 끝까지 펴기 · 세트 간 2분" },
  { key: "slrdl", name: "덤벨 한 발 루마니안 데드리프트", rx: "2×8 (다리당)", cue: "골반 수평 유지" },
  { key: "pull", name: "턱걸이", rx: "3×3–6", cue: "못 하면 뛰어 올라가서 3–5초 동안 내려오기" },
  { key: "row", name: "한 팔 덤벨 로우", rx: "3×8", cue: "견갑을 뒤로 모으며" },
  { key: "bench", name: "덤벨 벤치프레스", rx: "3×8 · RIR 2", rx2: "3×6", cue: "올릴 땐 빠르게" },
  { key: "spu", name: "견갑 푸시업", rx: "2×10", cue: "팔은 편 채로 견갑만" },
  { key: "er", name: "옆으로 누워 덤벨 외회전", rx: "2×15 (가볍게)", cue: "팔꿈치 옆구리에 고정" },
  { key: "ytw", name: "엎드려 Y·T·W 들기", rx: "각 2×8", cue: "맨손 → 0.5–1kg" },
  { key: "sleeper", name: "슬리퍼 스트레치", rx: "30초 × 2", cue: "옆으로 누워 내회전, 통증 없는 범위" },
  { key: "hs", name: "물구나무", rx: "10분", cue: "" },
  { key: "core", name: "데드버그 2×8 · 사이드 플랭크 2×30초 · 덤벨 한 손 들고 걷기 2×20m", rx: "각 2세트", cue: "몸통이 버티는 운동" },
];
const LIBERO_THU = [
  { name: "신호 반응 스타트", rx: "6–8회 × 2", cue: "수비 자세 → 파트너 손짓 방향으로 2–3걸음" },
  { name: "셔플 → 앞 다이빙 준비 자세", rx: "좌우 각 5회", cue: "옆 셔플 3m → 낮게 한 걸음 + 손 뻗기" },
  { name: "수비 자세 월싯", rx: "3×30초", cue: "무릎 약 90°, 팔은 리시브 자세" },
];

/* ---------- 상황별 처방 모듈 (부상·통증) ---------- */
const REHAB = {
  shoulder: { label: "어깨 (와순·회전근개)", stages: [
    { title: "통증·가동성", items: [
      { name: "슬리퍼 스트레치 · 크로스바디 스트레치", rx: "각 30초 × 3–5" },
      { name: "견갑 모으고 내리기 (등척)", rx: "10초 × 10" },
      { name: "벽 밀기 외회전 (등척)", rx: "10초 × 5" }],
      next: "일상 통증 2/10 이하, 팔을 머리 위로 올릴 때 통증 없음" },
    { title: "근력", items: [
      { name: "옆으로 누워 덤벨 외회전", rx: "3×15" },
      { name: "엎드려 Y·T·W", rx: "각 2×10" },
      { name: "견갑 푸시업 플러스", rx: "2×12" },
      { name: "밴드 로우", rx: "3×12" },
      { name: "밴드 외회전 (팔 옆 0° → 통증 없으면 90/90)", rx: "3×12" }],
      next: "외회전 무게가 반대쪽과 비슷, 운동 중 통증 3/10 이하" },
    { title: "파워·속도", items: [
      { name: "밴드 90/90 빠른 외회전", rx: "3×10" },
      { name: "메디신볼 가슴 패스 → 가벼운 오버헤드 던지기", rx: "3×8" },
      { name: "무릎 대고 플라이오 푸시업", rx: "2×6" }],
      next: "빠른 동작에서 통증·빠지는 느낌 없음" },
    { title: "배구 동작", items: [
      { name: "서서 벽에 때리기 → 서브 → 점프 스파이크", rx: "20 → 20 → 10회", cue: "세션마다 개수 늘리기, 주장과 협의" }],
      next: "정규 훈련 공격량을 이틀 연속 문제없이 소화" },
  ] },
  ankle: { label: "발목", stages: [
    { title: "가동성", items: [
      { name: "무릎 벽 대기 (발끝-벽 거리 늘리기)", rx: "2×10" },
      { name: "발목 알파벳 그리기", rx: "2회" },
      { name: "양발 카프레이즈", rx: "2×15" }],
      next: "걸을 때 통증 없음, 한 발로 10초 서기" },
    { title: "근력·균형", items: [
      { name: "밴드 바깥쪽 밀기 (외번)", rx: "3×15" },
      { name: "한 발 카프레이즈", rx: "3×12" },
      { name: "한 발 서기 → 눈 감고 → 쿠션 위", rx: "30초 × 3" },
      { name: "한 발 서서 공 받기", rx: "2×10" }],
      next: "눈 감고 한 발 30초, 한 발 카프레이즈 좌우 비슷" },
    { title: "착지·홉", items: [
      { name: "양발 → 한 발 홉 착지 고정", rx: "3×5" },
      { name: "라인 좌우 홉", rx: "2×10초" },
      { name: "옆으로 한 발 바운드 착지 고정", rx: "3×4 (좌우)" }],
      next: "한 발 홉 거리 좌우 차이 10% 이내" },
    { title: "배구 동작", items: [
      { name: "블록 스텝 → 블록 점프 착지", rx: "3×5" },
      { name: "어프로치 점프", rx: "3×3" }],
      next: "통증·불안정감 없이 정규 훈련 이틀 연속" },
  ], always: "경기·훈련 중 반경성 보조기 또는 테이핑 (다친 뒤 1년)" },
  finger: { label: "손가락", stages: [
    { title: "가동성", items: [{ name: "손가락 힘줄 미끄러짐 운동 (주먹 모양 5종)", rx: "각 10회 × 하루 3번" }],
      next: "주먹을 완전히 쥐고 펼 수 있음" },
    { title: "근력", items: [
      { name: "고무줄 손가락 벌리기", rx: "3×15" },
      { name: "수건·공 쥐기 (5초 유지)", rx: "3×10" }],
      next: "쥐는 힘 좌우 비슷" },
    { title: "배구 동작", items: [{ name: "벽 오버 토스 → 블로킹 손 모양 → 정규 훈련", rx: "단계적으로", cue: "버디 테이핑 유지" }],
      next: "공 받을 때 통증 3/10 이하" },
  ], always: "훈련 중 옆 손가락과 묶는 버디 테이핑" },
  wrist: { label: "손목", stages: [
    { title: "가동성·체중 싣기", items: [
      { name: "손목 원 그리기 · 손바닥 스트레칭", rx: "각 30초" },
      { name: "네발 자세에서 앞뒤로 체중 싣기", rx: "30초 × 3" }],
      next: "체중을 실어도 통증 3/10 이하" },
    { title: "근력", items: [
      { name: "덤벨 손목 굽히기·펴기 (1–2kg)", rx: "각 2×15" },
      { name: "덤벨 돌리기 (손바닥 위·아래)", rx: "2×12" },
      { name: "엄지·새끼 방향 들기", rx: "각 2×12" },
      { name: "원판 꼬집어 들기 · 수건 짜기", rx: "30초 × 3" }],
      next: "손목 운동 무게가 반대쪽과 비슷" },
    { title: "체중 지지", items: [
      { name: "플랭크 → 푸시업", rx: "3×30초 → 3×8" },
      { name: "물구나무 1단계 (파이크 버티기)", rx: "3×30초" }],
      next: "푸시업·파이크에서 통증 없음" },
    { title: "배구 동작", items: [{ name: "토스·디그 정상 참여, 물구나무 단계 복귀", rx: "단계적으로" }],
      next: "정규 훈련 이틀 연속 통증 증가 없음" },
  ] },
  knee: { label: "무릎 (점퍼스니)", stages: [
    { title: "등척성 (통증 조절)", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분, 매일 가능, 정규 훈련 전에도" }],
      next: "한 발 스쿼트 시 통증 3/10 이하" },
    { title: "무겁고 느린 근력", items: [
      { name: "레그 익스텐션 · 스쿼트 · 한 발 레그프레스", rx: "3–4세트 × 15 → 8–6회", cue: "3초 올리고 3초 내리기, 주 3회, 주마다 무게 ↑" }],
      next: "체중 1배 이상 스쿼트 6회를 통증 3/10 이하로" },
    { title: "에너지 저장 (점프)", items: [
      { name: "포고 → 스쿼트 점프 → 연속 멀리뛰기 → 한 발 홉", rx: "단계마다 착지 수 점차 ↑", cue: "주 2–3회" }],
      next: "점프 다음 날 아침 통증이 평소보다 늘지 않음" },
    { title: "종목 복귀", items: [{ name: "어프로치 점프 → 블록 점프 → 정규 훈련 점프 드릴", rx: "단계적 참여" }],
      next: "정규 훈련 이틀 연속, 다음 날 통증 증가 없음" },
  ], always: "운동 중 통증 3/10 이하, 24시간 안에 평소로 돌아오면 진행" },
  back: { label: "허리", stages: [
    { title: "가동성", items: [
      { name: "오픈북 흉추 회전", rx: "좌우 8회 × 2" },
      { name: "폼롤러 위 흉추 신전", rx: "5회 × 2" },
      { name: "하프 닐링 엉덩이 굴곡근 스트레칭", rx: "30초 × 2 (좌우)" }],
      next: "일상 통증 2/10 이하" },
    { title: "몸통 버티기", items: [
      { name: "데드버그 · 할로우 홀드", rx: "2×8 · 3×20초" },
      { name: "글루트 브리지 → 힙 쓰러스트", rx: "3×10" },
      { name: "버드독", rx: "2×8 (좌우)" }],
      next: "운동 중 통증 3/10 이하" },
    { title: "하중 복귀", items: [{ name: "RDL 가볍게 → 평소 무게, 고블릿 → 백스쿼트", rx: "주마다 단계적으로" }],
      next: "무게를 올려도 다음 날 통증 증가 없음" },
    { title: "배구 동작", items: [{ name: "서브·공격 정상 참여", rx: "—", cue: "허리를 과하게 젖히는 습관은 주장과 함께 확인" }],
      next: "—" },
  ] },
};
const REHAB_AREAS = Object.keys(REHAB);

/* ---------- 선수 상태 계산 ---------- */
function relStrength(t, weight) {
  const sq = t && Number(t.squat), bw = Number(weight);
  return sq > 0 && bw > 0 ? sq / bw : null;
}
// 관리자가 지정한 모듈 + (모듈이 없는 부위는) 가입 때 자가 보고한 통증으로 추정한 모듈
function effectiveModules(adjust, rehab) {
  const mods = (rehab || []).filter(m => REHAB[m.area]).map(m => ({ ...m, stage: Math.min(REHAB[m.area].stages.length, Math.max(1, Number(m.stage) || 1)) }));
  const has = a => mods.some(m => m.area === a);
  const a = adjust || {};
  if (a.plyo === "iso" && !has("knee")) mods.push({ area: "knee", stage: 1, inferred: true });
  if (a.plyo === "hold" && !has("ankle")) mods.push({ area: "ankle", stage: 1, inferred: true });
  if (a.overhead && !has("shoulder")) mods.push({ area: "shoulder", stage: 1, inferred: true });
  if (a.back && !has("back")) mods.push({ area: "back", stage: 1, inferred: true });
  return mods;
}
function moduleEffects(mods, ankleHistory) {
  const st = a => (mods.find(m => m.area === a) || {}).stage || 0;
  const knee = st("knee"), ankle = st("ankle"), sh = st("shoulder"), wr = st("wrist"), back = st("back");
  return {
    noJumps: (knee >= 1 && knee <= 3) || ankle === 1,
    kneeJumps: knee === 3,               // 일반 점프 대신 무릎 모듈의 점프 단계를 씀
    tierMax: ankle === 2 ? 1 : 3,
    noOverhead: sh === 1 || sh === 2,     // 메디신볼·물구나무 제외, 벤치 가볍게
    lightMedball: sh === 3,
    handstandMax: wr === 1 || wr === 2 ? 0 : wr === 3 ? 1 : 4,
    goblet: back === 1 || back === 2,
    rdlLight: back >= 1 && back <= 3,
    preIso: knee === 1,                   // 정규 훈련 전 등척성
    ankleBal: !!ankleHistory || ankle >= 1,
    kneeHx: false,
  };
}

/* ---------- 요일 처방 ---------- */
// ctx: { player, test(최신 측정), weight(인바디 우선), rehab(관리자 지정 모듈), ankleHistory(bool), kneeHistory(bool) }
function dayPlan(ctx, w, d) {
  const p = ctx.player || {};
  const t = ctx.test || null;
  const mods = effectiveModules(p.adjust, ctx.rehab);
  const fx = moduleEffects(mods, ctx.ankleHistory);
  const novice = p.weightExp === "none";
  const rel = relStrength(t, ctx.weight);
  const balanceFail = !!t && (t.balL === false || t.balR === false);
  const tournament = w === 3 && d >= 5;
  const out = { blocks: [], notes: [], landings: 0, kind: "", title: "", mods, rel, logType: "other", minutes: 30 };
  const warm = () => ({ key: "warm", title: "워밍업 15분", items: WARMUP.flatMap((x, i) => {
    if (i === 2 && fx.ankleBal) return [{ ...x, rx: "3분", mod: "발목 +1분" }];
    if (i === 3 && fx.noJumps) return [{ name: "스쿼트 착지 자세 연습 (점프 없이)", rx: "5회", cue: "무릎은 발끝 방향", mod: "부상 단계" }];
    if (i === 5 && fx.noJumps) return [];
    return [x];
  }) });
  const rehabBlock = (title, filter) => {
    const items = [];
    for (const m of mods) {
      if (filter && !filter(m)) continue;
      const def = REHAB[m.area], s = def.stages[m.stage - 1];
      items.push(...s.items.map(x => ({ ...x, mod: mods.length > 1 ? `${def.label.split(" ")[0]} ${m.stage}단계` : "" })));
    }
    return items.length ? { key: "rehab", title, items, note: mods.map(m => {
      const def = REHAB[m.area], s = def.stages[m.stage - 1];
      return `${def.label} ${m.stage}단계(${s.title})${m.inferred ? " · 자가 보고 통증으로 임시 적용" : ""} → 다음 단계 조건: ${s.next}${def.always ? ` · ${def.always}` : ""}`;
    }).join("\n") } : null;
  };

  // ---- 대회 (4주차 토·일)
  if (tournament) {
    out.kind = d === 5 ? "대회 1일차" : "대회 2일차";
    out.title = d === 5 ? "서울대배 1일차 · 조별리그 2경기" : "서울대배 2일차 · 최대 4경기";
    out.logType = "match"; out.minutes = 90;
    out.blocks.push(warm());
    out.blocks.push({ key: "match", title: "경기 운영", items: [
      { name: "경기 사이 체온 유지", rx: "껴입기", cue: "앉아서 식지 않게" },
      { name: "다음 경기 10분 전 다시 데우기", rx: "스킵 · 한 발 홉 · 어프로치 점프 3회", cue: p.pos === "S" ? "세터는 추가 점프 없이 스킵·홉만" : "" },
      { name: "물·탄수화물 간식", rx: "경기 사이마다", cue: "일요일은 최대 4경기, 미리 챙기기" },
    ] });
    if (d === 5) out.notes.push("토요일 밤은 수면 시간을 최우선으로 확보해요.");
    return out;
  }

  // ---- 월: 점프 + 하체 근력
  if (d === 0) {
    out.kind = "점프 + 하체 근력"; out.title = w === 0 ? "측정 · 점프 1단계 · 웨이트 동작 연습" : w === 3 ? "재측정 · 점프·근력 절반 (무게 유지)" : "점프 + 하체 근력";
    out.logType = "A"; out.minutes = 75;
    if (w === 0) out.notes.push("오늘은 측정·접수 날이에요. 측정이 끝나고 남는 시간에 아래를 가볍게 해요.");
    if (w === 3) out.notes.push("대회 주예요. 세트·횟수는 줄이고 무게와 점프 강도는 지켜요. 시작 전에 CMJ·블록 리치를 재측정해요.");
    out.blocks.push(warm());
    // 점프
    let plyo = PLYO.map(x => ({ ...x, sets: x.sets[w], reps: x.reps[w] })).filter(x => x.sets > 0);
    plyo = plyo.filter(x => x.key !== "drop" || (rel != null && rel > 1.2 && !mods.some(m => m.area === "knee")));
    plyo = plyo.filter(x => x.key !== "posj" || rel == null || rel >= 0.8);
    plyo = plyo.map(x => x.key === "posj" ? { ...x, name: POSJ[p.pos] || x.name } : x);
    if (p.pos === "S") plyo = plyo.map(x => (x.key === "cmj" || x.key === "broad") ? { ...x, sets: Math.max(1, x.sets - 1), mod: "세터 −1세트" } : x);
    if (p.pos === "Li") {
      plyo = plyo.flatMap(x => {
        if (x.key === "cmj") return [{ ...x, key: "lat", name: "옆으로 한 발 바운드 착지 고정", cue: "바깥발 착지 2초 고정, 좌우", reps: 4, mod: "리베로 대체" }];
        if (x.key === "broad" || x.key === "drop") return [];
        if (x.key === "posj") return [{ ...x, key: "step", tier: 1, name: "5-10-5 방향 전환", cue: "낮은 무게중심, 회당 완전 휴식", sets: 4, reps: null, fmt: "count", mod: "리베로 대체" }];
        return [x];
      });
    }
    const tierMax = Math.min(fx.tierMax, balanceFail ? 1 : 3);
    if (tierMax < 3) {
      plyo = plyo.filter(x => x.tier <= tierMax);
      if (!plyo.some(x => x.key === "stick")) plyo.push({ ...PLYO[1], sets: w === 3 ? 2 : 3, reps: 5, mod: "고강도 대신" });
      if (balanceFail) out.notes.push("한 발 서기 30초를 통과하지 못해 중·고강도 점프는 보류했어요. 다음 측정에서 통과하면 다시 열려요.");
    }
    if (fx.noJumps) {
      plyo = [];
      out.notes.push(fx.kneeJumps ? "일반 점프 블록 대신 무릎 모듈의 점프 단계를 해요." : "부상 단계 때문에 이번에는 점프 블록을 쉬어요.");
    }
    plyo.sort((a, b) => PLYO_ORDER.indexOf(a.key) - PLYO_ORDER.indexOf(b.key));
    out.landings = plyo.reduce((s, x) => s + (typeof x.reps === "number" ? x.sets * x.reps : 0), 0);
    if (plyo.length) out.blocks.push({ key: "plyo", title: "점프 블록", items: plyo.map(x => ({ name: x.name, rx: plyoRx(x), cue: x.cue, mod: x.mod })),
      note: "착지 소리가 커지거나, 무릎이 안으로 모이거나, 높이가 눈에 띄게 떨어지면 그 운동은 끝내요." });
    // 근력
    const strength = MON_STRENGTH.filter(x => x.rx[w]).map(x => {
      let name = x.name, rx = x.rx[w], mod = "";
      if (x.key === "squat" && (novice || (rel != null && rel < 0.8) || fx.goblet)) { name = "고블릿 스쿼트 (덤벨)"; mod = fx.goblet ? "허리 모듈" : "입문"; }
      if (x.key === "rdl" && fx.rdlLight) { rx += " · 가볍게, 통증 없는 범위"; mod = "허리 모듈"; }
      if (x.key === "rdl" && novice && w > 0) rx = rx.replace("RIR 2", "RIR 3");
      if (x.key === "nordic" && novice) return null;
      return { name, rx, cue: x.cue, mod };
    }).filter(Boolean);
    if (w === 2 && rel != null && rel > 1.2 && !fx.noJumps) {
      strength.splice(1, 0, { name: "컨트라스트 (선택): 백스쿼트 3회 → 90초 → CMJ 3회", rx: "3묶음", cue: "상대 근력이 높을 때만 이득이 큼", mod: "상대 근력 > 1.2" });
    }
    if (w === 0 && novice) out.notes.push("웨이트 입문 단계라 첫 세션은 동작 연습만 해요.");
    out.blocks.push({ key: "str", title: "근력 블록", items: strength,
      note: "RIR = 세트 끝에 더 할 수 있었던 횟수. 모든 세트를 목표보다 여유 있게 끝냈으면 다음 주 2.5–5kg 올려요." });
    const rb = rehabBlock("상황별 처방"); if (rb) out.blocks.push(rb);
    out.notes.push("공 터치는 각자 원하는 만큼 자율로 해요.");
    return out;
  }

  // ---- 목: 상체·엉덩이·코어
  if (d === 3) {
    out.logType = w === 3 ? "act" : "B"; out.minutes = w === 3 ? 30 : 60;
    if (w === 3) {
      out.kind = "활성화 30분"; out.title = "활성화 30분 (대회 이틀 전)";
      out.blocks.push(warm());
      const items = [];
      if (!fx.noJumps) items.push({ name: "포고 점프", rx: "1×10" });
      if (fx.noJumps) items.push({ name: "레그 익스텐션 등척성", rx: "3×45초", mod: "무릎 모듈" });
      else if (p.pos === "Li") items.push({ name: "옆으로 한 발 바운드", rx: "2×2" });
      else items.push({ name: "CMJ 최대 노력", rx: "2×3" });
      items.push({ name: (novice || fx.goblet) ? "고블릿 스쿼트" : "백스쿼트", rx: "2×2 · 3주차 무게" });
      items.push({ name: "어깨 밴드 운동", rx: "워밍업 5번 순서" });
      out.landings = fx.noJumps ? 0 : (p.pos === "Li" ? 4 : 16);
      out.blocks.push({ key: "act", title: "활성화", items, note: "땀이 살짝 날 정도로 끝내요. 근육통이 생길 자극은 넣지 않아요." });
      const rb = rehabBlock("상황별 처방 (가볍게)"); if (rb) out.blocks.push(rb);
      return out;
    }
    out.kind = "상체·엉덩이·코어"; out.title = w === 0 ? "상체·엉덩이·코어 (모두 2세트, 가볍게)" : w === 2 ? "상체·엉덩이·코어 (무게만 조금 ↑)" : "상체·엉덩이·코어";
    out.blocks.push(warm());
    const stage = Math.min(fx.handstandMax, Math.max(1, Number((t && t.hsStage) || 1)));
    const items = THU.filter(x => !x.weeks || x.weeks.includes(w)).map(x => {
      let rx = (w === 2 && x.rx2) ? x.rx2 : x.rx, name = x.name, cue = x.cue, mod = "";
      if (x.key === "pogo" && fx.noJumps) return null;
      if (["er", "ytw", "spu"].includes(x.key) && fx.noOverhead) return null; // 어깨 모듈 블록에 들어 있음
      if (x.key === "mb" && fx.noOverhead) return null;
      if (x.key === "mb" && fx.lightMedball) { rx = "3×5 · 2kg"; mod = "어깨 모듈"; }
      if (x.key === "bench" && fx.noOverhead) { rx = "3×8 · RIR 3"; cue = "통증 없는 범위"; mod = "어깨 모듈"; }
      if (x.key === "hs") {
        if (fx.noOverhead || stage < 1) return { name: "물구나무 대신 견갑·외회전 운동", rx: "10분", cue: "통증 없는 범위에서", mod: fx.noOverhead ? "어깨 모듈" : "손목 모듈" };
        name = `물구나무 ${stage}단계`; cue = HANDSTAND[stage] + (p.pos === "S" ? " · 세터는 매번 빠짐없이" : "");
        if (stage < Math.max(1, Number((t && t.hsStage) || 1))) mod = "손목 모듈";
      }
      if (w === 0) rx = String(rx).replace(/^[34]×/, "2×");
      return { name, rx, cue, mod };
    }).filter(Boolean);
    out.landings = fx.noJumps ? 0 : 20;
    out.blocks.push({ key: "thu", title: "운동", items, note: "파워(메디신볼) → 엉덩이·하체 → 상체 → 어깨 → 물구나무 → 코어 순서예요." });
    if (p.pos === "Li") out.blocks.push({ key: "li", title: "리베로 수비 이동", items: LIBERO_THU });
    const rb = rehabBlock("상황별 처방"); if (rb) out.blocks.push(rb);
    out.notes.push("공 터치는 각자 원하는 만큼 자율로 해요.");
    return out;
  }

  // ---- 수·금: 정규 훈련
  if (d === 2 || d === 4) {
    out.kind = "정규 훈련"; out.logType = "team"; out.minutes = 180;
    out.title = w === 3 && d === 4 ? "가벼운 정규 훈련 · 일찍 자기" : w === 3 ? "정규 훈련 (점프 많은 드릴은 짧게)" : "정규 훈련";
    const pre = warm();
    if (fx.preIso) pre.items = [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "훈련 시작 전, 세트 간 2분", mod: "무릎 1단계" }, ...pre.items];
    out.blocks.push({ ...pre, title: "훈련 전 워밍업 15분" });
    out.blocks.push({ key: "team", title: "정규 훈련 (주장 진행)", items: [{ name: "기술·전술 훈련", rx: "18:00–21:00", cue: w === 3 ? "대회 주라 점프가 많은 드릴은 평소보다 짧게 (주장과 협의)" : "" }] });
    out.blocks.push({ key: "cool", title: "훈련 후 쿨다운 10분", items: COOLDOWN, note: "쿨다운은 회복을 빠르게 하기보다 마무리와 기록 습관을 위한 시간이에요." });
    return out;
  }

  // ---- 화·토·일: 휴식
  out.logType = "other"; out.minutes = 30;
  if (d === 6) {
    out.kind = "완전 휴식"; out.title = "완전 휴식";
    out.blocks.push({ key: "rest", title: "오늘 할 일", items: [{ name: "운동 없음", rx: "—", cue: "수면 시간을 넉넉히. 수면 부족은 수비·블로킹 반응을 떨어뜨려요." }] });
    return out;
  }
  out.kind = "휴식"; out.title = w === 3 ? "휴식" : "휴식 · 선택 운동";
  if (w === 3) {
    out.blocks.push({ key: "rest", title: "오늘 할 일", items: [{ name: "휴식", rx: "—", cue: "대회 주라 선택 운동도 쉬어요." }] });
    return out;
  }
  const opt = d === 1
    ? [{ name: "가벼운 유산소 (걷기·자전거)", rx: "15–20분", cue: "대화할 수 있는 강도" },
       { name: "코어: 데드버그 · 사이드 플랭크 · 버드독", rx: "각 2세트", cue: "10분" },
       { name: "가동성: 흉추 회전 · 엉덩이 굴곡근 · 종아리", rx: "5분" }]
    : [{ name: "어깨: 엎드려 Y·T·W · 견갑 푸시업", rx: "각 2×10" },
       { name: "코어: 데드버그 · 사이드 플랭크", rx: "각 2세트" },
       ...(fx.handstandMax >= 1 && !fx.noOverhead ? [{ name: "물구나무 단계 연습", rx: "5분" }] : [])];
  if (fx.ankleBal) opt.push({ name: "한 발 균형 (눈 감고 → 쿠션 위)", rx: "5분", mod: "발목" });
  out.blocks.push({ key: "opt", title: "선택 운동 (피로 없을 때만, 30분 이내)", items: opt, note: "점프는 넣지 않아요. 주간 점프 수가 갑자기 늘지 않게 하기 위해서예요." });
  const rb = rehabBlock("상황별 처방 (가능한 것만)", m => (m.area === "knee" && m.stage === 1) || m.area === "finger" || (m.area === "ankle" && m.stage <= 2) || (m.area === "shoulder" && m.stage === 1) || (m.area === "back" && m.stage <= 2));
  if (rb) out.blocks.push(rb);
  return out;
}
function plyoRx(x) {
  if (x.fmt === "chain") return `${x.sets}세트 × 3연속`;
  if (x.fmt === "time") return `${x.sets}×${x.reps}`;
  if (x.fmt === "count") return `${x.sets}회`;
  return `${x.sets}×${x.reps}`;
}
// 팀 카드용 한 줄 요약
function daySummary(plan) {
  const main = plan.blocks.find(b => ["plyo", "str", "thu", "act", "team", "match", "opt", "rest"].includes(b.key));
  return { kind: plan.kind, title: plan.title, landings: plan.landings, items: main ? main.items.length : 0 };
}

if (typeof module !== "undefined") module.exports = { dayPlan, daySummary, effectiveModules, moduleEffects, relStrength, REHAB, REHAB_AREAS, DAYS, WEEKS, POS, POS_ORDER, NET };
