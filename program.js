/* SNUVT Physical — 프로그램 엔진
 * 'SNUVT Physical 운동 처방 라이브러리' 문서의 규칙을 코드로 옮긴 것.
 * 화면과 분리된 순수 함수만 둔다 (입력: 선수·측정·인바디·통증 단계 / 출력: 요일 프로그램).
 */

const NET = 243; // 남자부 네트 높이 (cm)
const POS = { OH: "아웃사이드 히터", MB: "미들블로커", OP: "아포짓", S: "세터", Li: "리베로" };
const POS_ORDER = ["OH", "MB", "OP", "S", "Li"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"]; // 0 = 월요일
const WEEKS = [
  { label: "1주차" }, { label: "2주차" }, { label: "3주차" }, { label: "4주차" },
];

/* ---------- 공통 블록 ---------- */
const WARMUP = [
  { name: "조깅 · 셔플 · 카리오카 · 스킵", rx: "3분", cue: "체온 올리기" },
  { name: "회전 런지 · 옆 런지 · 다리 스윙", rx: "3분", cue: "정적 스트레칭을 넣는다면 근육당 30초 이내" },
  { name: "한 발 서기 → 한 발 홉", rx: "2분", cue: "좌·우 모두" },
  { name: "스쿼트 점프 착지 고정", rx: "5회", cue: "무릎은 발끝 방향, 착지 소리 작게" },
  { name: "어깨 밴드 · Y·T · 오픈북", rx: "4분", cue: "어깨 외회전·견갑·흉추" },
  { name: "어프로치 점프", rx: "3회", cue: "70% → 90%" },
];
const COOLDOWN = [
  { name: "가볍게 걷기·조깅", rx: "3분", cue: "심박 내리기" },
  { name: "종아리 · 엉덩이 굴곡근 · 햄스트링 · 어깨 뒤쪽 스트레칭", rx: "부위당 30초", cue: "통증 없는 범위" },
  { name: "통증 체크", rx: "—", cue: "아픈 곳이 있으면 ‘통증 체크’에 남기고, 다음 날 아침에도 한 번 더" },
  { name: "세션 RPE 기록", rx: "30분 안에", cue: "‘기록’ 탭" },
];
const HANDSTAND = [
  "", "파이크 버티기 (손은 바닥, 발은 벤치) 30초 × 3", "벽 걸어 올라가기 3–5회",
  "벽 물구나무 버티기 20–40초 × 3", "벽 물구나무 어깨 터치 → 킥업 → 물구나무 걷기 5m",
];
const POSJ = { MB: "슬라이드 스텝 후 블록 점프", OP: "공격 어프로치 + 블록 번갈아", OH: "공격 어프로치 점프", S: "점프 토스 테이크오프 (양발 착지)" };

/* ---------- 점프 라이브러리 (월요일) ----------
 * 단계 1 낮음(착지·탄성) · 2 중간(최대 노력·연속·한 발) · 3 높음(실전 점프·드롭)
 * 월요일 착지 수: 1주 ~50 → 2주 ~80 → 3주 ~90 (+드롭) → 4주 ~25. 수·금 정규 훈련 점프는 따로.
 * 근거: 배구 플라이오 메타분석 (Ramirez-Campillo 2020) — 주 2회 이하·8주 이하로도 점프 높이 향상
 * sides: 2 = 좌우 각각 (접촉 수 ×2) */
const PLYO = [
  { key: "pogo", tier: 1, name: "포고 점프", cue: "발목만 튕기듯, 무릎 거의 고정", sets: [2, 2, 2, 1], reps: [10, 10, 10, 10] },
  { key: "stick", tier: 1, name: "스쿼트 점프 착지 고정", cue: "착지 후 2초 멈춤, 무릎은 발끝 방향", sets: [2, 2, 0, 0], reps: [5, 5, 5, 5] },
  { key: "snap", tier: 1, name: "스냅다운", cue: "팔을 휘두르며 착지 자세로 떨어지기, 소리 없이", sets: [2, 0, 0, 0], reps: [5, 5, 5, 5] },
  { key: "latstick", tier: 1, name: "옆으로 한 발 바운드 → 착지 고정", cue: "바깥발로 2초 멈춤", sets: [2, 0, 0, 0], reps: [3, 3, 3, 3], sides: 2 },
  { key: "cmj", tier: 2, name: "CMJ 최대 노력", cue: "매 회 최고 높이, 세트 사이 60–90초", sets: [0, 3, 3, 2], reps: [4, 4, 3, 3] },
  { key: "broad", tier: 2, name: "연속 제자리멀리뛰기", cue: "3번 연속, 착지하자마자 다음 (센다이 방식)", sets: [0, 3, 3, 2], reps: [3, 3, 3, 3], fmt: "chain" },
  { key: "latb", tier: 2, name: "연속 옆 바운드 (좌우 번갈아)", cue: "멀리 · 바깥발로 밀기", sets: [0, 2, 2, 0], reps: [6, 6, 6, 6] },
  { key: "hurdle", tier: 2, name: "연속 허들 점프", cue: "지면 접촉 짧게, 무릎 끌어올리기", sets: [0, 2, 3, 0], reps: [5, 5, 5, 5] },
  { key: "slhop", tier: 2, name: "한 발 앞으로 홉 → 착지 고정", cue: "무릎 안으로 모이지 않게", sets: [0, 2, 2, 0], reps: [2, 2, 3, 3], sides: 2 },
  { key: "posj", tier: 3, name: "포지션별 점프", cue: "실전 스텝으로, 매번 최대", sets: [0, 0, 3, 2], reps: [3, 3, 3, 2] },
  { key: "drop", tier: 3, name: "드롭 점프 (30cm 벤치)", cue: "떨어지자마자 최대한 빨리·높이", sets: [0, 0, 2, 0], reps: [4, 4, 4, 4] },
];
const PLYO_ORDER = ["pogo", "stick", "snap", "latstick", "cmj", "lat", "broad", "latb", "hurdle", "slhop", "posj", "step", "drop"];

/* ---------- 근력 라이브러리 (월 하체) ---------- */
const MON_STRENGTH = [
  { key: "jsq", name: "덤벨 점프 스쿼트 (가볍게)", cue: "가벼운 무게로 최대한 빠르게 · 세트 간 2분",
    rx: [null, "3×4", "3×4", null] },
  { key: "squat", name: "백스쿼트", cue: "올라올 땐 최대한 빠르게, 내려갈 땐 2–3초 · 세트 간 3분",
    rx: ["동작 연습 2×8 (가볍게)", "4×5 · RIR 3", "4×4 · RIR 2 · 무게 ↑", "2×3 · 3주차 무게 유지"] },
  { key: "rdl", name: "루마니안 데드리프트 (바벨)", cue: "엉덩이 뒤로, 허리 중립 · 세트 간 3분",
    rx: ["동작 연습 2×8", "3×6 · RIR 3", "3×5 · RIR 2", "2×5"] },
  { key: "bss", name: "불가리안 스플릿 스쿼트 (덤벨)", cue: "앞발 뒤꿈치로 밀기 · 세트 간 90초",
    rx: ["2×6 (다리당, 맨몸)", "3×6 (다리당)", "3×6 · 무게 ↑", "1×6"] },
  { key: "stepup", name: "덤벨 스텝업", cue: "올라간 다리로만 밀기",
    rx: [null, "3×6 (다리당)", "3×6", null] },
  { key: "calf", name: "한 발 카프레이즈 (덤벨)", cue: "위에서 1초 멈춤 · 점프 탄성",
    rx: ["2×12 (다리당)", "3×12 (다리당)", "3×10 · 무게 ↑", "1×12"] },
  { key: "ham", name: "햄스트링 컬 머신", cue: "내릴 때 3초",
    rx: [null, "2×8", "2×8", null] },
];
/* ---------- 목: 상체 파워·근력 + 엉덩이 + 코어 ---------- */
const THU = [
  { key: "pogo", name: "포고 점프", rx: "2×10", cue: "다음 날 정규 훈련이라 점프는 이것만" },
  { key: "mb", name: "메디신볼 슬램 · 옆 던지기", rx: "3×5", cue: "근력 운동 전에, 매번 최대 속도", weeks: [0, 1, 2] },
  { key: "clap", name: "박수 푸시업", rx: "3×5", cue: "바닥을 세게 밀어 손 떼기 · 어렵다면 무릎 대고", weeks: [1, 2] },
  { key: "hip", name: "바벨 힙 쓰러스트", rx: "3×8 · RIR 2", rx2: "3×6 · 무게 ↑", cue: "엉덩이로 끝까지 펴기 · 세트 간 2분" },
  { key: "slrdl", name: "덤벨 한 발 루마니안 데드리프트", rx: "3×8 (다리당)", cue: "골반 수평 유지" },
  { key: "pull", name: "턱걸이", rx: "4×3–6", rx2: "4세트 (최대보다 1회 적게)", cue: "못 하면 뛰어 올라가서 3–5초 동안 내려오기" },
  { key: "bench", name: "덤벨 벤치프레스", rx: "3×8 · RIR 2", rx2: "3×6 · 무게 ↑", cue: "올릴 땐 빠르게" },
  { key: "row", name: "한 팔 덤벨 로우", rx: "3×8", cue: "견갑을 뒤로 모으며" },
  { key: "er", name: "옆으로 누워 덤벨 외회전", rx: "2×15", cue: "팔꿈치 옆구리에 고정 · 스파이크 감속 근육" },
  { key: "ytw", name: "엎드려 Y·T·W 들기", rx: "각 2×8", cue: "맨손 → 0.5–1kg" },
  { key: "hs", name: "물구나무", rx: "10분", cue: "" },
  { key: "cph", name: "코펜하겐 플랭크", rx: "2×20초 (좌우)", rx2: "3×25초 (좌우)", cue: "무릎 대고 → 발목 대고 · 사타구니 부상 예방" },
  { key: "core", name: "할로우 홀드 · 데드버그 · 덤벨 들고 걷기", rx: "각 2–3세트", cue: "몸통이 버티는 운동" },
];
const LIBERO_THU = [
  { name: "신호 반응 스타트", rx: "6–8회 × 2", cue: "수비 자세 → 파트너 손짓 방향으로 2–3걸음" },
  { name: "셔플 → 앞 다이빙 준비 자세", rx: "좌우 각 5회", cue: "옆 셔플 3m → 낮게 한 걸음 + 손 뻗기" },
  { name: "수비 자세 월싯", rx: "3×30초", cue: "무릎 약 90°, 팔은 리시브 자세" },
];
/* ---------- 발목을 다친 적 있는 선수: 재발 예방 (월·토) — 균형 훈련이 재발을 줄였다 (Verhagen 2004, Kosik 2017) ---------- */
const ANKLE_PREV = [
  { name: "밴드 바깥쪽 밀기 (외번)", rx: "2×15" },
  { name: "한 발 균형 (눈 감고 → 쿠션)", rx: "좌우 각 30초 × 2" },
  { name: "한 발 서서 공 받기", rx: "2×10 (좌우)" },
  { name: "양발 → 한 발 홉 착지 고정", rx: "2×5 (좌우)" },
];
/* ---------- 화: 맨몸 상체·코어 / 토: 맨몸 하체·균형 (권장, 점프 없음) ---------- */
const TUE_BW = [
  { key: "push", name: "푸시업", rx: "3세트 (최대보다 2회 적게)", cue: "몸통 일자, 가슴이 먼저 닿게" },
  { key: "pull", name: "턱걸이 또는 인버티드 로우", rx: "3×6–8", cue: "견갑부터 당기기" },
  { key: "pike", name: "파이크 푸시업 → 물구나무 단계 연습", rx: "3×6 + 5분", cue: "머리 위로 미는 힘 · 세터 필수" },
  { key: "crawl", name: "곰 기기 앞뒤 · 게 걷기", rx: "각 2×10m", cue: "무릎 바닥에서 5cm 띄우기" },
  { key: "hollow", name: "할로우 홀드 · 슈퍼맨", rx: "3×20초 · 2×10", cue: "허리 뜨지 않게" },
  { key: "mob", name: "가동성 스트레칭", rx: "5분" },
];
const SAT_BW = [
  { key: "lunge", name: "워킹 런지", rx: "3×8 (다리당)", cue: "뒷무릎이 바닥 가까이" },
  { key: "pistol", name: "한 발 스쿼트 (박스)", rx: "3×5 (다리당)", cue: "무릎은 발끝 방향 · 단계는 5회 가능한 높이로" },
  { key: "slbridge", name: "한 발 힙 브리지", rx: "3×10 (다리당)", cue: "위에서 1초" },
  { key: "nordic", name: "노르딕 햄스트링", rx: "2×4", rx2: "2×5", cue: "파트너가 발목 고정, 버틸 수 있는 데까지 천천히 · 햄스트링 부상 예방" },
  { key: "calf", name: "한 발 카프레이즈 (맨몸)", rx: "2×15 (다리당)" },
  { key: "bal", name: "한 발 균형 · 공 받기", rx: "좌우 각 1분", cue: "발목 안정성" },
  { key: "side", name: "사이드 플랭크 · 코펜하겐 플랭크 (짧게)", rx: "각 2×20초 (좌우)" },
];

/* ---------- 통증 단계별 재활 ----------
 * 단계는 두 시점의 통증과 쉴 때 통증으로 정한다 (통증 모니터링 모델: 운동 중 통증 + 다음 날 아침 반응, Silbernagel 2007).
 *   1 높음: 쉬거나 밤에도 아픔, 또는 운동 중·다음 날 아침 7점 이상
 *   2 중간: 운동 중 또는 다음 날 아침 4–6점 (운동 땐 괜찮았는데 다음 날 꽤 아픈 경우 포함)
 *   3 낮음: 운동 중·다음 날 아침 모두 1–3점
 *   4 복귀: 통증 없음 (관리자가 복귀 단계로 지정)
 * 운동 강도는 자극 민감도(높음·중간·낮음, Kelley 등 어깨 임상지침)에 맞춘다. */
const STAGE_NAMES = ["높음", "중간", "낮음", "복귀"];
const STAGE_HINT = ["쉬거나 밤에도 아픔, 또는 7점 이상", "운동 중이나 다음 날 아침 4–6점", "운동 중·다음 날 모두 1–3점", "통증 없음"];
const PAIN_RULE = "운동 중 통증 5 이하 · 다음 날 아침 평소대로 · 주마다 늘지 않기. 다음 날 아침 4점 이상이면 그 부위는 2단계로 내려가요.";
const NEXT_RULE = "규칙을 1–2주 지키고 운동 중·다음 날 통증이 다음 구간으로 내려가면 다음 단계로.";
const PAIN_AREAS = ["knee", "shoulder", "ankle", "back", "wrist", "finger"];
// 통증 값: 예전 숫자 형식(운동 중 값)과 {d: 운동 중, m: 다음 날 아침, r: 쉴 때·밤에도} 둘 다 받는다
const normPain = v => v == null ? null : typeof v === "object" ? { d: Number(v.d) || 0, m: Number(v.m) || 0, r: !!v.r } : { d: Number(v) || 0, m: 0, r: false };
function painStage(v) {
  const p = normPain(v); if (!p) return 0;
  const mx = Math.max(p.d, p.m);
  if (p.r || mx >= 7) return 1;
  if (mx >= 4) return 2;
  if (mx >= 1) return 3;
  return 0;
}
const REHAB = {
  shoulder: { label: "어깨", pain: ["쉬거나 밤에도 아프고 팔이 끝까지 안 올라감", "공격·서브할 때나 다음 날 꽤 아픔", "세게 때린 뒤 살짝 불편", "안 아픔 · 공격 복귀 중"], stages: [
    { title: "통증·가동성", items: [
      { name: "슬리퍼 스트레치 · 크로스바디 스트레치", rx: "각 30초 × 3–5" },
      { name: "견갑 모으고 내리기 (등척)", rx: "10초 × 10" },
      { name: "벽 밀기 외회전 (등척)", rx: "10초 × 5" }],
      next: "팔을 머리 위로 들어도 안 아픔" },
    { title: "근력", items: [
      { name: "옆으로 누워 덤벨 외회전", rx: "3×15" },
      { name: "엎드려 Y·T·W", rx: "각 2×10" },
      { name: "견갑 푸시업 플러스", rx: "2×12" },
      { name: "밴드 로우", rx: "3×12" },
      { name: "밴드 외회전 (팔 옆 0° → 통증 없으면 90/90)", rx: "3×12" }],
      next: "외회전 무게가 반대쪽과 비슷" },
    { title: "파워·속도", items: [
      { name: "밴드 90/90 빠른 외회전", rx: "3×10" },
      { name: "메디신볼 가슴 패스 → 가벼운 오버헤드 던지기", rx: "3×8" },
      { name: "무릎 대고 플라이오 푸시업", rx: "2×6" }],
      next: "빠르게 해도 안 아프고 빠지는 느낌 없음" },
    { title: "배구 동작", items: [
      { name: "서서 벽에 때리기 → 서브 → 점프 스파이크", rx: "20 → 20 → 10회", cue: "조금씩 늘리기" }],
      next: "정규 훈련 공격을 이틀 연속 문제없이" },
  ] },
  ankle: { label: "발목", pain: ["걸어도 아프고 부어 있음", "뛸 때나 다음 날 아침 꽤 아픔", "점프·방향 전환 뒤 살짝 불편", "안 아픔 · 복귀 중"], stages: [
    { title: "가동성", items: [
      { name: "무릎 벽 대기 (발끝-벽 거리 늘리기)", rx: "2×10" },
      { name: "발목 알파벳 그리기", rx: "2회" },
      { name: "양발 카프레이즈", rx: "2×15" }],
      next: "걸어도 안 아프고 한 발 10초 서기" },
    { title: "근력·균형", items: [
      { name: "밴드 바깥쪽 밀기 (외번)", rx: "3×15" },
      { name: "한 발 카프레이즈", rx: "3×12" },
      { name: "한 발 서기 → 눈 감고 → 쿠션 위", rx: "30초 × 3" },
      { name: "한 발 서서 공 받기", rx: "2×10" }],
      next: "눈 감고 한 발 30초" },
    { title: "착지·홉", items: [
      { name: "양발 → 한 발 홉 착지 고정", rx: "3×5" },
      { name: "라인 좌우 홉", rx: "2×10초" },
      { name: "옆으로 한 발 바운드 착지 고정", rx: "3×4 (좌우)" }],
      next: "한 발 홉 거리 좌우 차이 10% 이내" },
    { title: "배구 동작", items: [
      { name: "블록 스텝 → 블록 점프 착지", rx: "3×5" },
      { name: "어프로치 점프", rx: "3×3" }],
      next: "정규 훈련 이틀 연속 문제없이" },
  ], always: "다친 뒤 1년은 훈련·경기 때 보조기나 테이핑" },
  finger: { label: "손가락", pain: ["가만히 있어도 아프고 부어 있음", "공 받을 때나 다음 날 꽤 아픔", "공 받을 때 살짝 불편", "안 아픔 · 복귀 중"], stages: [
    { title: "보호·가동성", items: [
      { name: "손가락 힘줄 미끄러짐 운동 (주먹 모양 5종)", rx: "각 10회, 하루 3번", cue: "통증 없는 범위" },
      { name: "옆 손가락과 같이 테이핑", rx: "훈련·일상" }],
      next: "주먹을 끝까지 쥐고 펼 수 있음" },
    { title: "근력", items: [
      { name: "고무줄 손가락 벌리기", rx: "3×15" },
      { name: "수건·공 쥐기 (5초 유지)", rx: "3×10" }],
      next: "쥐는 힘 좌우 비슷" },
    { title: "공 감각", items: [
      { name: "벽 오버 토스 (가볍게)", rx: "3×20" },
      { name: "블로킹 손 모양 만들기 → 가벼운 공 막기", rx: "2×10" }],
      next: "공 받아도 통증 3 이하" },
    { title: "배구 동작", items: [{ name: "정규 훈련 토스·블로킹 참여", rx: "단계적으로", cue: "테이핑 유지" }],
      next: "—" },
  ], always: "훈련 때 옆 손가락과 같이 테이핑" },
  wrist: { label: "손목", pain: ["가만히 있어도 아픔", "손 짚을 때나 다음 날 꽤 아픔", "체중 실은 뒤 살짝 불편", "안 아픔 · 복귀 중"], stages: [
    { title: "가동성·체중 싣기", items: [
      { name: "손목 원 그리기 · 손바닥 스트레칭", rx: "각 30초" },
      { name: "네발 자세에서 앞뒤로 체중 싣기", rx: "30초 × 3" }],
      next: "손 짚어도 통증 3 이하" },
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
      next: "정규 훈련 이틀 연속 문제없이" },
  ] },
  knee: { label: "무릎", pain: ["쉬어도 아프거나 계단·쪼그려 앉기도 아픔", "점프할 때나 다음 날 아침 꽤 아픔", "점프 후·다음 날 살짝 뻐근함", "안 아픔 · 복귀 중"], stages: [
    { title: "등척성 (통증 조절)", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분 · 매일 가능" }],
      next: "한 발 스쿼트 통증 3 이하" },
    { title: "무겁고 느린 근력", items: [
      { name: "레그 익스텐션 · 스쿼트 · 한 발 레그프레스", rx: "15회 → 6회, 3–4세트", cue: "3초 올리고 3초 내리기 · 주 3회" }],
      next: "체중만큼 스쿼트 6회, 통증 3 이하" },
    { title: "에너지 저장 (점프)", items: [
      { name: "레그 익스텐션 · 스쿼트 무겁고 느리게 (유지)", rx: "주 2회 3×8", cue: "3초 올리고 3초 내리기" },
      { name: "점프는 월요일 점프 블록(1–2단계)으로", rx: "—", cue: "점프 다음 날 아침 통증 체크" }],
      next: "점프 다음 날 아침 통증이 늘지 않음" },
    { title: "종목 복귀", items: [{ name: "어프로치 점프 → 블록 점프 → 정규 훈련 점프 드릴", rx: "단계적 참여" }],
      next: "정규 훈련 이틀 연속 문제없이" },
  ], always: "점프 다음 날 아침 통증이 늘면 점프 양을 줄여요" },
  back: { label: "허리", pain: ["쉬어도 아프고 움직이기 힘듦", "운동할 때나 다음 날 아침 꽤 아픔", "무거운 무게 뒤 살짝 뻐근함", "안 아픔 · 복귀 중"], stages: [
    { title: "가동성", items: [
      { name: "오픈북 흉추 회전", rx: "좌우 8회 × 2" },
      { name: "폼롤러 위 흉추 신전", rx: "5회 × 2" },
      { name: "하프 닐링 엉덩이 굴곡근 스트레칭", rx: "30초 × 2 (좌우)" }],
      next: "일상 통증 2 이하" },
    { title: "몸통 버티기", items: [
      { name: "데드버그 · 할로우 홀드", rx: "2×8 · 3×20초" },
      { name: "글루트 브리지 → 힙 쓰러스트", rx: "3×10" },
      { name: "버드독", rx: "2×8 (좌우)" }],
      next: "운동 중 통증 3 이하" },
    { title: "하중 복귀", items: [{ name: "RDL 가볍게 → 평소 무게, 고블릿 → 백스쿼트", rx: "주마다 단계적으로" }],
      next: "무게를 올려도 다음 날 괜찮음" },
    { title: "배구 동작", items: [{ name: "서브·공격 정상 참여", rx: "—", cue: "허리 과하게 젖히는 습관 확인" }],
      next: "—" },
  ] },
};
const REHAB_AREAS = Object.keys(REHAB);

/* ---------- 선수 상태 계산 ---------- */
function relStrength(t, weight) {
  const sq = t && Number(t.squat), bw = Number(weight);
  return sq > 0 && bw > 0 ? sq / bw : null;
}
// 관리자가 지정한 단계 + 통증 기록으로 정한 단계
// pain: 가입·관리자 입력 통증, checks: 최근 통증 체크 [{area, date, during, morning, rest}] — 부위마다 가장 최근 체크가 가입 통증보다 우선
// 관리자 단계가 있어도 최근 체크가 더 나쁘면 그 단계로 내린다 (fromCheck)
function effectiveModules(adjust, rehab, pain, checks) {
  const mods = (rehab || []).filter(m => REHAB[m.area]).map(m => ({ ...m, stage: Math.min(REHAB[m.area].stages.length, Math.max(1, Number(m.stage) || 1)) }));
  const a = adjust || {};
  const flagged = { knee: a.plyo === "iso", ankle: a.plyo === "hold", shoulder: !!a.overhead, back: !!a.back };
  const last = {};
  for (const c of checks || []) if (!last[c.area] || String(c.date) >= String(last[c.area].date)) last[c.area] = c;
  for (const area of PAIN_AREAS) {
    const c = last[area];
    const src = c ? { d: c.during, m: c.morning, r: c.rest } : pain ? pain[area] : null;
    const st = src != null ? painStage(src) : (pain == null && flagged[area] ? 1 : 0);
    const cur = mods.find(m => m.area === area);
    if (cur) { if (c && st && st < cur.stage) { cur.stage = st; cur.fromCheck = true; } continue; }
    if (st) mods.push({ area, stage: Math.min(REHAB[area].stages.length, st), inferred: true, fromCheck: !!c });
  }
  return mods;
}
const painLabel = m => `${REHAB[m.area].label} 통증 ${m.stage}단계 (${STAGE_NAMES[m.stage - 1]})`;
function moduleEffects(mods, ankleHistory) {
  const st = a => (mods.find(m => m.area === a) || {}).stage || 0;
  const knee = st("knee"), ankle = st("ankle"), sh = st("shoulder"), wr = st("wrist"), back = st("back");
  return {
    noJumps: knee === 1 || knee === 2 || ankle === 1,
    kneeJumps: false,
    tierMax: ankle === 2 ? 1 : knee === 3 ? 2 : 3, // 무릎 3단계: 1–2단계 점프로 진행 (드롭·실전 점프 제외)
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

/* ---------- 요일 프로그램 ---------- */
// ctx: { player, test(최신 측정), weight(인바디 우선), rehab(관리자 지정 모듈), ankleHistory(bool), kneeHistory(bool) }
function dayPlan(ctx, w, d) {
  const p = ctx.player || {};
  const t = ctx.test || null;
  const mods = effectiveModules(p.adjust, ctx.rehab, ctx.pain, ctx.checks);
  const inj = Array.isArray(ctx.injuries) ? ctx.injuries : [];
  const ankleHx = !!ctx.ankleHistory || inj.some(x => x.part === "ankle");
  const kneeHx = inj.some(x => x.part === "knee");
  const thisYear = Number(ctx.year) || new Date().getFullYear();
  const recentAnkle = inj.some(x => x.part === "ankle" && Number(x.year) >= thisYear - 1);
  const fx = moduleEffects(mods, ankleHx);
  const novice = p.weightExp === "none";                                  // 초보자: 웨이트 처음
  const machineOnly = p.weightExp === "machine" || p.weightExp === "lt6"; // 중급자: 기구만 다룸 → 프리웨이트는 가볍게 익히며
  const ankleMod = mods.some(m => m.area === "ankle");
  const anklePrev = () => ankleHx && !ankleMod ? { key: "ankle", scope: "me", title: "발목 재발 예방", items: ANKLE_PREV.filter(x => !(fx.noJumps && x.name.includes("홉"))).map(x => kneeHx && x.name.includes("쿠션") ? { ...x, name: "한 발 균형 (눈 감고)" } : x) } : null;
  const rel = relStrength(t, ctx.weight);
  const balanceFail = !!t && (t.balL === false || t.balR === false);
  const tournament = w === 3 && d >= 5;
  const out = { blocks: [], notes: [], landings: 0, kind: "", title: "", mods, rel, logType: "other", minutes: 30 };
  const warm = () => ({ key: "warm", title: "워밍업 15분", items: WARMUP.flatMap((x, i) => {
    if (i === 2 && fx.ankleBal) return [{ ...x, rx: "3분", mod: "발목 +1분" }];
    if (i === 3 && fx.noJumps) return [{ name: "스쿼트 착지 자세 연습 (점프 없이)", rx: "5회", cue: "무릎은 발끝 방향", mod: "통증 단계" }];
    if (i === 5 && fx.noJumps) return [];
    return [x];
  }) });
  const rehabBlock = (title, filter) => {
    const items = [];
    for (const m of mods) {
      if (filter && !filter(m)) continue;
      const def = REHAB[m.area], s = def.stages[m.stage - 1];
      items.push(...s.items.map(x => ({ ...x, mod: mods.length > 1 ? def.label : "" })));
    }
    return items.length ? { key: "rehab", scope: "me", title, items } : null;
  };

  // ---- 대회 (4주차 토·일)
  if (tournament) {
    out.kind = d === 5 ? "대회 1일차" : "대회 2일차";
    out.title = d === 5 ? "서울대배 1일차 · 조별리그 2경기" : "서울대배 2일차 · 최대 4경기";
    out.logType = "match"; out.minutes = 90;
    out.blocks.push({ key: "match", title: "경기 운영", items: [
      { name: "팀 워밍업", rx: "평소대로", cue: "끝나고 어프로치 점프 2–3회로 마무리" },
      { name: "경기 사이 체온 유지", rx: "껴입기", cue: "앉아서 식지 않게" },
      { name: "다음 경기 10분 전 다시 데우기", rx: "스킵 · 한 발 홉 · 어프로치 점프 3회", cue: p.pos === "S" ? "세터는 추가 점프 없이 스킵·홉만" : "" },
      { name: "물·탄수화물 간식", rx: "경기 사이마다", cue: "일요일은 최대 4경기, 미리 챙기기" },
    ] });
    if (d === 5) out.notes.push("토요일 밤은 일찍 자기.");
    return out;
  }

  // ---- 월: 점프 + 하체 근력
  if (d === 0) {
    out.kind = "점프 + 하체 근력"; out.title = w === 0 ? "측정 · 가벼운 점프 · 동작 연습" : w === 3 ? "재측정 · 점프·근력 절반 (무게 유지)" : "점프 + 하체 근력";
    out.logType = "A"; out.minutes = 75;
    if (w === 0) out.notes.push("측정날 (점프·근력·코어 테스트) · 측정 후 가볍게");
    if (w === 3) out.notes.push("대회 주 · 양은 줄이고 무게는 유지 · 시작 전 재측정");
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
        if (x.key === "broad" || x.key === "drop" || x.key === "hurdle") return [];
        if (x.key === "posj") return [{ ...x, key: "step", tier: 1, name: "5-10-5 방향 전환", cue: "낮은 무게중심, 회당 완전 휴식", sets: 4, reps: null, fmt: "count", mod: "리베로 대체" }];
        return [x];
      });
    }
    const tierMax = Math.min(fx.tierMax, balanceFail ? 1 : 3);
    if (tierMax < 3) {
      plyo = plyo.filter(x => x.tier <= tierMax);
      if (!plyo.some(x => x.key === "stick")) plyo.push({ ...PLYO[1], sets: w === 3 ? 2 : 3, reps: 5, mod: "고강도 대신" });
      if (balanceFail) out.notes.push("한 발 서기 30초 미통과 · 강한 점프 보류");
    }
    if (fx.noJumps) {
      plyo = [];
      out.notes.push("통증 단계 때문에 점프는 쉬어요");
    }
    plyo.sort((a, b) => PLYO_ORDER.indexOf(a.key) - PLYO_ORDER.indexOf(b.key));
    out.landings = plyo.reduce((s, x) => s + (typeof x.reps === "number" ? x.sets * x.reps * (x.sides || 1) : 0), 0);
    // 포지션별 점프(리베로는 방향 전환)는 개인 블록으로, 나머지는 팀 공통 점프
    const posPlyo = plyo.filter(x => x.key === "posj" || x.key === "step" || x.key === "drop"), teamPlyo = plyo.filter(x => !posPlyo.includes(x));
    if (teamPlyo.length) out.blocks.push({ key: "plyo", title: "점프", items: teamPlyo.map(x => ({ name: x.name, rx: plyoRx(x), cue: x.cue, mod: x.mod })) });
    var posBlock = posPlyo.length ? { key: "pos", scope: "me", title: "포지션·추가 점프 (팀 점프 바로 다음에)", items: posPlyo.map(x => ({ name: x.name, rx: plyoRx(x), cue: x.cue })) } : null;
    // 근력
    const strength = MON_STRENGTH.filter(x => x.rx[w]).map(x => {
      let name = x.name, rx = x.rx[w], mod = "";
      if (x.key === "squat" && (novice || (rel != null && rel < 0.8) || fx.goblet)) { name = "고블릿 스쿼트 (덤벨)"; mod = fx.goblet ? "허리 통증" : novice ? "초보자" : ""; }
      else if (x.key === "squat" && machineOnly && w === 0) { name = "백스쿼트 (빈 바부터)"; rx = "동작 연습 3×8"; }
      if (x.key === "rdl" && (novice || (machineOnly && w === 0))) { name = "덤벨 루마니안 데드리프트"; }
      if ((x.key === "squat" || x.key === "rdl") && machineOnly && w > 0) rx = rx.replace("RIR 2", "RIR 3");
      if (x.key === "rdl" && fx.rdlLight) { rx += " · 가볍게, 통증 없는 범위"; mod = "허리 통증"; }
      if (x.key === "rdl" && novice && w > 0) rx = rx.replace("RIR 2", "RIR 3");
      if (x.key === "jsq" && (novice || fx.noJumps || (rel != null && rel < 0.8))) return null;
      if (x.key === "jsq" && w === 2 && rel != null && rel > 1.2) return { name: "컨트라스트: 백스쿼트 3회 → 90초 → CMJ 3회", rx: "3묶음", cue: "무거운 근력 직후 점프가 더 높게 나오는 효과 활용", mod: "상대 근력 > 1.2" };
      if (x.key === "bss" && w === 0 && !novice) rx = "2×6 (다리당, 가볍게)";
      return { name, rx, cue: x.cue, mod };
    }).filter(Boolean);
    if (strength[0] && strength[0].name.startsWith("컨트라스트") && strength[1]) strength.splice(0, 2, strength[1], strength[0]); // 무거운 스쿼트 다음에
    out.blocks.push({ key: "str", title: "근력", items: strength });
    if (posBlock) out.blocks.push(posBlock);
    const ap = anklePrev(); if (ap) out.blocks.push(ap);
    const rb = rehabBlock("재활 운동"); if (rb) out.blocks.push(rb);
    out.notes.push("공 터치는 자율.");
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
      if (fx.noJumps) items.push({ name: "레그 익스텐션 등척성", rx: "3×45초", mod: "무릎 통증" });
      else if (p.pos === "Li") items.push({ name: "옆으로 한 발 바운드", rx: "2×2" });
      else items.push({ name: "CMJ 최대 노력", rx: "2×3" });
      items.push({ name: (novice || fx.goblet) ? "고블릿 스쿼트" : "백스쿼트", rx: "2×2 · 3주차 무게" });
      items.push({ name: "어깨 밴드 운동", rx: "워밍업 5번 순서" });
      out.landings = fx.noJumps ? 0 : (p.pos === "Li" ? 4 : 16);
      out.blocks.push({ key: "act", title: "활성화", items });
      const rb = rehabBlock("재활 운동 (가볍게)"); if (rb) out.blocks.push(rb);
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
      if (x.key === "clap" && (fx.noOverhead || fx.handstandMax < 4 || novice)) return null;
      if (x.key === "mb" && fx.lightMedball) { rx = "3×5 · 2kg"; mod = "어깨 통증"; }
      if (x.key === "bench" && fx.noOverhead) { rx = "3×8 · RIR 3"; cue = "통증 없는 범위"; mod = "어깨 통증"; }
      if (x.key === "hs") {
        if (fx.noOverhead || stage < 1) return { name: "물구나무 대신 견갑·외회전 운동", rx: "10분", cue: "통증 없는 범위에서", mod: fx.noOverhead ? "어깨 통증" : "손목 통증" };
        name = `물구나무 ${stage}단계`; cue = HANDSTAND[stage] + (p.pos === "S" ? " · 세터는 매번 빠짐없이" : "");
        if (stage < Math.max(1, Number((t && t.hsStage) || 1))) mod = "손목 통증";
      }
      if (w === 0) rx = String(rx).replace(/^[34]×/, "2×");
      return { name, rx, cue, mod };
    }).filter(Boolean);
    out.landings = fx.noJumps ? 0 : 20;
    const cut = items.findIndex(x => x.name.startsWith("바벨 힙"));
    const power = items.slice(0, cut), main = items.slice(cut);
    const coreKeys = ["물구나무", "코펜하겐", "할로우", "물구나무 대신"];
    const isCore = x => coreKeys.some(k => x.name.startsWith(k));
    if (power.length) out.blocks.push({ key: "thu", title: "파워", items: power });
    out.blocks.push({ key: "thu2", title: "근력", items: main.filter(x => !isCore(x)) });
    out.blocks.push({ key: "core", title: "물구나무 · 코어", items: main.filter(isCore) });
    if (p.pos === "Li") out.blocks.push({ key: "li", scope: "me", title: "리베로 수비 이동", items: LIBERO_THU });
    const rb = rehabBlock("재활 운동"); if (rb) out.blocks.push(rb);
    out.notes.push("공 터치는 자율.");
    return out;
  }

  // ---- 수·금: 정규 훈련
  if (d === 2 || d === 4) {
    if (recentAnkle) out.notes.push("발목 다친 지 1년 안 · 훈련 때 보조기나 테이핑");
    out.kind = "정규 훈련"; out.logType = "team"; out.minutes = 180;
    out.title = w === 3 && d === 4 ? "가벼운 정규 훈련" : "정규 훈련";
    if (fx.preIso) out.blocks.push({ key: "pre", scope: "me", title: "훈련 전", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분", mod: "무릎 통증" }] });
    out.blocks.push({ key: "team", title: "정규 훈련", items: [{ name: "정규 훈련", rx: "18:00–21:00" }] });
    out.blocks.push({ key: "after", title: "훈련 후", items: [{ name: "통증 체크", rx: "아픈 곳 있으면" }, { name: "세션 RPE 기록", rx: "30분 안에" }] });
    return out;
  }

  // ---- 화·토·일: 휴식
  out.logType = "other"; out.minutes = 30;
  if (d === 6) {
    out.kind = "완전 휴식"; out.title = "완전 휴식";
    out.blocks.push({ key: "rest", title: "오늘", items: [{ name: "휴식", rx: "—" }] });
    return out;
  }
  const tue = d === 1;
  out.kind = tue ? "맨몸 상체·코어" : "맨몸 하체·균형"; out.minutes = 35;
  out.title = (tue ? "맨몸 상체·코어" : "맨몸 하체·균형") + (w === 0 || w === 3 ? " (2세트)" : "");
  const kneeLow = mods.some(m => m.area === "knee" && m.stage <= 2);
  const bw = (tue ? TUE_BW : SAT_BW).map(x => {
    let name = x.name, rx = (w === 2 && x.rx2) ? x.rx2 : x.rx, cue = x.cue, mod = "";
    if (tue && x.key === "pike" && (fx.noOverhead || fx.handstandMax < 1)) return { name: "견갑 푸시업 · 엎드려 Y·T·W", rx: "각 2×10", mod: fx.noOverhead ? "어깨 통증" : "손목 통증" };
    if (tue && x.key === "push" && fx.handstandMax < 1) { name = "푸시업 (덤벨 손잡이 잡고)"; mod = "손목 통증"; }
    if (tue && x.key === "crawl" && fx.handstandMax < 1) return null;
    if (!tue && kneeLow && (x.key === "lunge" || x.key === "pistol")) return x.key === "pistol" ? { name: "벽 기대 앉기 (무릎 60–90°)", rx: "4×45초", cue: "통증 5 이하로", mod: "무릎 통증" } : null;
    if (!tue && x.key === "nordic" && novice) return null;
    if (!tue && x.key === "bal" && ankleHx && !ankleMod) return null; // 발목 재발 예방 블록에 들어 있음
    if (w === 0 || w === 3) rx = String(rx).replace(/^3×/, "2×");
    return { name, rx, cue, mod };
  }).filter(Boolean);
  out.blocks.push({ key: "bw", title: tue ? "맨몸 상체·코어" : "맨몸 하체·균형", items: bw });
  if (!tue) { const ap = anklePrev(); if (ap) out.blocks.push(ap); }
  if (tue && w === 2) out.blocks.push({ key: "test", title: "코어 테스트", items: [
    { name: "사이드 플랭크 좌·우 최대 버티기", rx: "각 1회" },
    { name: "풀 플랭크 최대 버티기", rx: "1회" },
  ] });
  const rb = rehabBlock("재활 운동", m => (m.area === "knee" && m.stage === 1) || (m.area === "finger" && m.stage <= 2) || (m.area === "ankle" && m.stage <= 2) || (m.area === "shoulder" && m.stage === 1) || (m.area === "back" && m.stage <= 2));
  if (rb) out.blocks.push(rb);
  return out;
}
function plyoRx(x) {
  if (x.fmt === "chain") return `3연속 ${x.sets}세트`;
  if (x.fmt === "time") return `${x.reps} ${x.sets}세트`;
  if (x.fmt === "count") return `${x.sets}회`;
  return `${x.sets}×${x.reps}`;
}
// 처방 표기를 풀어서: "3×8 · RIR 2" → "8회 3세트 · RIR 2", "3×20초" → "20초 3세트", "45초 × 5" → "45초씩 5회"
function fmtRx(rx) {
  return String(rx ?? "")
    .replace(/(\d+(?:[–-]\d+)?)\s*×\s*(최대\s*[−-]\s*\d+회|최대|\d+(?:[–-]\d+)?(?:초|분|m|회)?)/g, (_, sets, reps) =>
      `${/^최대|[초분m회]$/.test(reps) ? reps : reps + "회"} ${sets}세트`)
    .replace(/(\d+(?:초|분))\s*×\s*(\d+(?:[–-]\d+)?)(?!세트)/g, "$1씩 $2회");
}
// 팀 카드용 한 줄 요약
function daySummary(plan) {
  const main = plan.blocks.find(b => ["plyo", "str", "thu", "act", "team", "match", "opt", "rest"].includes(b.key));
  return { kind: plan.kind, title: plan.title, landings: plan.landings, items: main ? main.items.length : 0 };
}

if (typeof module !== "undefined") module.exports = { fmtRx, painStage, normPain, PAIN_AREAS, STAGE_NAMES, STAGE_HINT, PAIN_RULE, NEXT_RULE, painLabel, dayPlan, daySummary, effectiveModules, moduleEffects, relStrength, REHAB, REHAB_AREAS, DAYS, WEEKS, POS, POS_ORDER, NET };
