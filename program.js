/* SNUVT Physical — 프로그램 엔진
 * 'SNUVT Physical 운동 처방 라이브러리' 문서의 규칙을 코드로 옮긴 것.
 * 화면과 분리된 순수 함수만 둔다 (입력: 선수·측정·인바디·통증 단계 / 출력: 요일 프로그램).
 */

// 팀 설정: 남자부 기본. 여자부는 네트 224cm, 정규 훈련 요일이 학기마다 남자부와 반대 (1학기 수·금, 2학기 월·목)
const TEAM = { id: "men", label: "남자부", net: 243, swap: false };
function setTeam(t) { if (t) Object.assign(TEAM, { id: t.id || TEAM.id, label: t.label || TEAM.label, net: Number(t.net_cm || t.net) || TEAM.net, swap: !!(t.swap_days ?? t.swap) }); }
const POS = { OH: "아웃사이드 히터", MB: "미들블로커", OP: "아포짓", S: "세터", Li: "리베로" };
const POS_ORDER = ["OH", "MB", "OP", "S", "Li"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"]; // 0 = 월요일

/* ---------- 공통 블록 ---------- */
const CORE_WARM = { name: "코어: 데드버그 · 사이드 플랭크", rx: "3분", cue: "허리는 바닥에 붙이고 천천히, 좌우 모두" };
// 어깨 밴드 루틴 (피지컬부장): 화요일, 못 했으면 주말에
const BAND_SHOULDER = [
  { name: "밴드 외회전", rx: "2×12 (좌우 각)", cue: "팔꿈치를 몸통에 붙이고 바깥으로" },
  { name: "밴드 풀어파트", rx: "2×12–15", cue: "날개뼈를 모으며 가슴 앞에서 벌리기" },
  { name: "하이로우 풀", rx: "1×8 (좌우 각)", cue: "위에서 아래로 당기며 몸통 회전" },
  { name: "풀캔 레이즈", rx: "1×8–10", cue: "엄지 위로, 어깨 높이까지만" },
  { name: "히팅 풀백", rx: "1×5 (좌우 각)", cue: "스파이크 팔 동작을 천천히 거꾸로" },
  { name: "히팅 액셀러레이터", rx: "1×4 (좌우 각)", cue: "스파이크 팔 스윙을 밴드 저항으로 빠르게" },
];
// 워밍업은 짧게 4가지 (하체 날은 코어 하나 더)
const WARMUP = [
  { name: "조깅 · 셔플 · 스킵", rx: "3분", cue: "체온 올리기" },
  { name: "회전 런지 · 옆 런지", rx: "3분", cue: "정적 스트레칭을 넣는다면 근육당 30초 이내" },
  { name: "스쿼트 점프 착지 고정", rx: "5회", cue: "무릎은 발끝 방향, 착지 소리 작게" },
  { name: "어깨 밴드 · Y·T · 오픈북", rx: "3분", cue: "어깨 외회전·견갑·흉추" },
];
// 핸드스탠드 단계 — 목표는 버티기를 넘어 다 같이 코트를 걸어가는 것 (5단계 핸드스탠드 워크)
// 1–4단계는 버틴 시간(초), 5단계는 걸은 거리(m)로 기록. 기준을 넘으면 다음 단계로.
const HS_STAGES = ["", "파이크 핸드스탠드 홀드", "백 투 월 핸드스탠드 (벽에 등 대고)", "힐 풀 (벽에서 발 떼기)", "프리스탠딩 핸드스탠드", "핸드스탠드 워크"];
const HS_GOAL = ["", "30초", "60초", "발 떼고 10초", "30초", "18m (코트)"];
const HANDSTAND = [
  "",
  "박스에 발 올리고 엉덩이를 어깨 위로 · 다음 단계 기준 30초",
  "벽을 등지고 킥업해 발뒤꿈치를 벽에 대고 버티기 · 다음 단계 기준 60초",
  "백 투 월에서 발뒤꿈치를 벽에서 떼고 균형 잡기 · 다음 단계 기준 발 떼고 10초",
  "벽 없이 킥업 → 버티기 · 다음 단계 기준 30초",
  "핸드스탠드로 걷기 · 회마다 거리 재기 (목표 코트 18m)",
];
const POSJ = { MB: "슬라이드 스텝 후 블록 점프", OP: "공격 어프로치 + 블록 번갈아", OH: "공격 어프로치 점프", S: "점프 토스 테이크오프 (양발 착지)" };

/* ---------- 주기화 단계 ----------
 * 프로 팀처럼: 시즌 첫 주 적응 → 기초 근력(양) → 회복 주 → 근력·파워(강도) → 피크 → 대회 주(테이퍼).
 * 근거: 배구 선형 주기화 (González-Ravé 2011: 일반 → 근비대 → 최대 근력·파워 → 전문 근력으로 시즌 중 점프 향상),
 *       테이퍼 메타분석 (Bosquet 2007: 약 2주, 양 41–60% 줄이고 강도 유지), 3–4주마다 회복 주.
 * 학생 팀이라 웨이트는 주 2회 + 맨몸 2회로 줄이고, 정규 훈련 점프 부하를 감안해 점프 양은 낮게 둔다. */
const PH = { INTRO: 0, BASE: 1, DELOAD: 2, POWER: 3, PEAK: 4, TAPER: 5 };
// "국민대와 교류전" — 받침에 따라 와/과
const josaWa = w => { const c = String(w || "").trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? "과" : "와"; };
const frName = opp => opp ? `${opp}${josaWa(opp)} 교류전` : "교류전";
const PHASE_NAMES = ["적응", "기초 근력", "회복 주", "근력·파워", "피크", "대회 주"];
const LIGHT = w => w === PH.INTRO || w === PH.DELOAD || w === PH.TAPER;
const HEAVY = w => w === PH.POWER || w === PH.PEAK;

/* ---------- 점프 라이브러리 (웨이트 A) ----------
 * 단계 1 낮음(착지·탄성) · 2 중간(최대 노력·연속·한 발) · 3 높음(실전 점프·드롭)
 * 착지 수 (적응 → 기초 → 회복 → 근력·파워 → 피크 → 대회 주): 약 50 → 80 → 25 → 95 → 60 → 25. 정규 훈련 점프는 따로.
 * 근거: 배구 플라이오 메타분석 (Ramirez-Campillo 2020) — 주 2회 이하·8주 이하로도 점프 높이 향상
 * sides: 2 = 좌우 각각 (접촉 수 ×2) */
// 웨이트 A(하체) 기본 = 피지컬부장 루틴 (2026-10): 포고 · 리바운드 박스 점프(+통통 튀는 버전) · 불가리안 스플릿 스쿼트 점프 · 연속 허들 점프
// 단계 [적응, 기초, 회복 주, 근력·파워, 피크, 대회 주] 마다 세트만 줄였다 늘림
const PLYO = [
  { key: "pogo", tier: 1, name: "포고 점프", cue: "발목만 튕기듯, 무릎 거의 고정", sets: [2, 2, 1, 2, 1, 1], reps: [10, 10, 10, 10, 10, 10] },
  { key: "stick", tier: 1, name: "스쿼트 점프 착지 고정", cue: "착지 후 2초 멈춤, 무릎은 발끝 방향", sets: [2, 0, 0, 0, 0, 0], reps: [5, 5, 5, 5, 5, 5] },
  { key: "rebox", tier: 2, name: "리바운드 박스 점프", cue: "올라가서 내려오자마자 다시 · 착지 짧게", sets: [1, 2, 1, 2, 1, 1], reps: [8, 8, 8, 8, 8, 6] },
  { key: "rebox2", tier: 2, name: "리바운드 박스 점프 (통통 튀는 버전)", cue: "무릎 덜 굽히고 발목으로 빠르게 튕기기", sets: [0, 1, 0, 1, 1, 0], reps: [8, 8, 8, 8, 8, 8] },
  { key: "bssj", tier: 2, name: "불가리안 스플릿 스쿼트 점프", cue: "뒷발 벤치, 앞발로 위로 밀기 · 착지 부드럽게", sets: [0, 3, 2, 3, 2, 0], reps: [8, 8, 6, 8, 6, 6] },
  { key: "hurdle", tier: 2, name: "연속 허들 점프", cue: "지면 접촉 짧게, 무릎 끌어올리기", sets: [0, 3, 2, 3, 2, 0], reps: [5, 5, 5, 5, 5, 5] },
  { key: "posj", tier: 3, name: "포지션별 점프", cue: "실전 스텝으로, 매번 최대", sets: [0, 0, 0, 3, 3, 2], reps: [3, 3, 3, 3, 3, 2] },
  { key: "drop", tier: 3, name: "드롭 점프 (30cm 벤치)", cue: "떨어지자마자 최대한 빨리·높이", sets: [0, 0, 0, 2, 2, 0], reps: [4, 4, 4, 4, 3, 4] },
];
const PLYO_ORDER = ["pogo", "stick", "rebox", "rebox2", "bssj", "lat", "hurdle", "posj", "step", "drop"];

/* ---------- 근력 라이브러리 (웨이트 A 하체) — 단계별 처방 [적응, 기초, 회복, 근력·파워, 피크, 대회 주] ---------- */
const MON_STRENGTH = [
  { key: "jsq", name: "덤벨 점프 스쿼트", cue: "가벼운 무게로 최대한 빠르게 · 세트 간 2분",
    rx: [null, "3×4", "2×4", "3×4", "2×3", null] },
  { key: "sqwu", name: "백스쿼트 워밍업", cue: "빈 바 → 본세트 무게의 절반쯤, 가볍게",
    rx: ["1세트", "2세트", "2세트", "2세트", "2세트", "2세트"] },
  { key: "squat", name: "백스쿼트", cue: "워밍업 2세트 → 5–6회 가능한 무게로 1세트 → 무게 낮춰 8–10회 2세트 · 세트 간 3분",
    rx: ["동작 연습 2×8 (가볍게)", "1×5–6 (가능한 무게) → 2×8–10 (무게 ↓)", "1×5 → 1×8 (가볍게)", "1×5–6 (가능한 무게) → 2×8–10 (무게 ↓)", "1×5 → 1×8", "2×3 · 지난주 무게 유지"] },
  { key: "rdl", name: "데드리프트 (바벨)", cue: "스쿼트보다 가볍게 · 허리 중립 · 세트 간 3분",
    rx: ["동작 연습 2×6", "3×4", "2×4 · 가볍게", "3×4", "2×4", "2×3"] },
  { key: "bss", name: "덤벨 불가리안 스플릿 스쿼트", cue: "앞발 뒤꿈치로 밀기 · 세트 간 90초",
    rx: ["2×6 (다리당, 맨몸)", "2×10 (다리당)", "1×10 (다리당)", "2×10 (다리당)", "1×8 (다리당)", "1×6 (다리당)"] },
  { key: "calf", name: "카프레이즈", cue: "위에서 1초 멈춤 · 점프 탄성",
    rx: ["2×8", "3×8", "2×8", "3×8", "2×8", "1×8"] },
];
/* ---------- 웨이트 B: 상체 파워·근력 + 엉덩이 + 코어 ---------- */
const THU = [
  { key: "pogo", name: "포고 점프", rx: "2×10", cue: "다음 날 정규 훈련이라 플라이오메트릭은 이것만" },
  { key: "mb", name: "메디신볼 슬램 · 옆 던지기", rx: "3×5", cue: "근력 운동 전에, 매번 최대 속도", weeks: [0, 1, 2, 3, 4] },
  { key: "clap", name: "박수 푸시업", rx: "3×5", cue: "바닥을 세게 밀어 손 떼기 · 어렵다면 무릎 대고", weeks: [3, 4] },
  { key: "hip", name: "바벨 힙 쓰러스트", rx: "3×8 · RIR 2", rx2: "3×6 · 무게 ↑", cue: "엉덩이로 끝까지 펴기 · 세트 간 2분" },
  { key: "slrdl", name: "덤벨 한 발 루마니안 데드리프트", rx: "3×8 (다리당)", cue: "골반 수평 유지" },
  { key: "pull", name: "턱걸이", rx: "4×3–6", rx2: "4세트 (최대보다 1회 적게)", cue: "못 하면 뛰어 올라가서 3–5초 동안 내려오기" },
  { key: "bench", name: "덤벨 벤치프레스", rx: "3×8 · RIR 2", rx2: "3×6 · 무게 ↑", cue: "올릴 땐 빠르게" },
  { key: "row", name: "한 팔 덤벨 로우", rx: "3×8", cue: "견갑을 뒤로 모으며" },
  { key: "er", name: "옆으로 누워 덤벨 외회전", rx: "2×15", cue: "팔꿈치 옆구리에 고정 · 스파이크 감속 근육" },
  { key: "ytw", name: "엎드려 Y·T·W 들기", rx: "각 2×8", cue: "맨손 → 0.5–1kg" },
  { key: "hs", name: "핸드스탠드", rx: "10분", cue: "" },
  { key: "cph", name: "코펜하겐 플랭크", rx: "2×20초 (좌우)", rx2: "3×25초 (좌우)", cue: "무릎 대고 → 발목 대고 · 사타구니 부상 예방" },
  { key: "core", name: "할로우 홀드 · 데드버그 · 덤벨 들고 걷기", rx: "각 2–3세트", cue: "몸통이 버티는 운동" },
];
/* ---------- 포지션별 개인 훈련 (개인 블록) ----------
 * 웨이트 A: 포지션 점프(위 POSJ) · 웨이트 B: 포지션 상체·손 · 맨몸 하체: 포지션 풋워크 (점프 없이)
 * 세터: 점프 토스·손가락·손목 / 아웃사이드·아포짓: 회전 파워·리시브·블로킹 이동 / 미들: 블로킹 이동·머리 위 / 리베로: 반응·수비 이동 */
const POS_EXTRA = {
  S: { gymB: [
      { name: "플레이트 핀치 홀드", rx: "3×20초", cue: "원판 2장을 손가락으로 집어 버티기 · 토스하는 손가락 힘" },
      { name: "리스트 롤러 (감고 풀기)", rx: "2회", cue: "손목 굽힘·폄 지구력" }],
    bwL: [{ name: "세터 풋워크 (리시브 위치 → 세팅 위치)", rx: "2×6", cue: "3–4걸음 빠르게 → 오른발 앞 정지 자세" }] },
  OH: { gymB: [{ name: "메디신볼 회전 던지기 (벽)", rx: "3×5 (좌우)", cue: "엉덩이부터 돌려 던지기 · 공격 스윙 힘" }],
    bwL: [{ name: "리시브 풋워크 (셔플 → 리시브 자세 고정)", rx: "2×6 (좌우)", cue: "낮게 2걸음 → 플랫폼 고정 2초" }] },
  OP: { gymB: [{ name: "메디신볼 회전 던지기 (벽)", rx: "3×5 (좌우)", cue: "엉덩이부터 돌려 던지기 · 공격 스윙 힘" }],
    bwL: [{ name: "블로킹 풋워크 (크로스오버 2걸음 → 블록 자세)", rx: "2×6 (좌우)", cue: "점프 없이 자세까지만" }] },
  MB: { gymB: [{ name: "한 팔 랜드마인 프레스", rx: "3×6 (팔당)", cue: "블로킹 때 손을 위로 뻗는 힘" }],
    bwL: [{ name: "블로킹 풋워크 (슬라이드·크로스오버, 좌·중·우)", rx: "3×4", cue: "점프 없이 손 높이까지만" }] },
  Li: { gymB: [], bwL: [{ name: "낮은 자세 사이드 셔플 (4m 왕복)", rx: "3×20초", cue: "머리 높이 그대로" }] },
};
function posBlock(c, slot) {
  if (c.team || !c.p.pos) return null;
  let items = ((POS_EXTRA[c.p.pos] || {})[slot] || []).slice();
  if (slot === "gymB" && c.p.pos === "Li") items.push(...LIBERO_THU);
  const { fx } = c;
  items = items.filter(x => {
    if (fx.noOverhead && /메디신볼|랜드마인/.test(x.name)) return false;
    if (fx.goblet && /회전 던지기/.test(x.name)) return false;
    if ((fx.noGrip || fx.handstandMax < 1) && GRIP_RE.test(x.name)) return false;
    if ((fx.knee === 1 || fx.ankle === 1) && /풋워크|셔플|반응 스타트|월싯/.test(x.name)) return false;
    return true;
  });
  return items.length ? { key: "posx", scope: "me", title: `${POS[c.p.pos]} 개인 훈련`, items } : null;
}
const LIBERO_THU = [
  { name: "신호 반응 스타트", rx: "6–8회 × 2", cue: "수비 자세 → 파트너 손짓 방향으로 2–3걸음" },
  { name: "셔플 → 앞 다이빙 준비 자세", rx: "좌우 각 5회", cue: "옆 셔플 3m → 낮게 한 걸음 + 손 뻗기" },
  { name: "수비 자세 월싯", rx: "3×30초", cue: "무릎 약 90°, 팔은 리시브 자세" },
];
/* ---------- 부상 이력 → 처방 (개인 블록) ----------
 * 부상 하나마다 받는 것: 부위 · 종류 · 진단 정도(모름 / 부분 손상 / 완전 파열 / 골절·탈구) · 지금 상태(다 나음 / 재활 중 / 아직 아픔)
 *   · 손가락이면 어느 손가락 · 연도 · 수술.
 * 원칙
 *  1) 진단에 따라 달라지는 처방(테이핑 방식, 고정, 수술 뒤 프로토콜)은 하지 않는다 — 의료진이 정한다.
 *  2) 재활 중이면 사이트는 그 부위 운동을 처방하지 않고 부하만 줄인다 (담당자 재활 프로그램이 우선).
 *  3) 아직 아프면 '지금 아픈 곳'·통증 체크로 받은 통증 정도에 따라 부하를 줄이고, 진단 없이도 안전한 기본 관리만 한다.
 *  4) 다 나았으면 그 부위·종류에 근거가 있는 예방 운동을, 그 부위를 쓰는 날에 짧게 붙인다.
 * 근거: 발목 균형 훈련 (Verhagen 2004) · 어깨 OSTRC 프로그램 (Andersson 2017) · 노르딕 (van der Horst 2015)
 *       코펜하겐 (Harøy 2019) · 족저근막 고부하 근력 (Rathleff 2015) · 팔꿈치 편심 (Tyler 2010) · 맥길 3종 · 무릎 신경근 훈련 */
const ANKLE_PREV = [
  { name: "밴드 바깥쪽 밀기 (외번)", rx: "2×15" },
  { name: "한 발 균형 (눈 감고 → 쿠션)", rx: "좌우 각 30초 × 2" },
  { name: "한 발 서서 공 받기", rx: "2×10 (좌우)", not: ["bwL"] },
  { name: "양발 → 한 발 홉 착지 고정", rx: "2×5 (좌우)", jump: true },
];
const INJ_PART_LABEL = { shoulder: "어깨", elbow: "팔꿈치", wrist: "손목", finger: "손가락", neck: "목", back: "허리", hip: "엉덩이·사타구니", thigh: "허벅지", knee: "무릎", calf: "종아리·아킬레스", ankle: "발목", foot: "발", head: "머리", other: "기타" };
const INJ_AREA = { shoulder: "shoulder", knee: "knee", ankle: "ankle", back: "back", wrist: "wrist", finger: "finger" }; // 통증 부위와 같은 것
const FINGERS = { thumb: "엄지", index: "검지", middle: "중지", ring: "약지", little: "새끼" };
// 규칙: part · type(정규식, 없으면 그 부위 전부) · slots(붙는 날) · items · note(정규 훈련 날 알림)
const INJ_RULES = [
  { part: "ankle", slots: ["gymA", "bwL"], items: ANKLE_PREV },
  { part: "knee", type: /인대|반월상/, slots: ["gymA", "bwL"], items: [
    { name: "한 발 착지 고정 (앞·옆)", rx: "2×4 (다리당)", cue: "무릎이 안으로 모이지 않게, 2초 멈춤", jump: true },
    { name: "스텝다운 (박스, 천천히)", rx: "2×8 (다리당)", cue: "무릎이 둘째 발가락 방향" }] },
  { part: "knee", type: /슬개건병증/, slots: ["gymA", "bwL"], items: [
    { name: "스페인 스쿼트 등척성 (밴드)", rx: "45초 × 3", cue: "무릎 힘줄 관리 · 점프 다음 날 아침 통증 체크" }] },
  { part: "knee", type: /슬개대퇴|슬개골/, slots: ["gymA", "bwL"], items: [
    { name: "밴드 사이드 스텝", rx: "2×10m", cue: "엉덩이 옆 근육" },
    { name: "스텝다운 (박스, 천천히)", rx: "2×8 (다리당)", cue: "무릎이 둘째 발가락 방향" }] },
  { part: "shoulder", slots: ["gymB", "bwU"], items: [
    { name: "밴드 90/90 외회전", rx: "2×12", cue: "3초 동안 천천히 되돌리기" },
    { name: "견갑 푸시업 플러스", rx: "2×12", cue: "어깨뼈를 끝까지 밀어내기" },
    { name: "오픈북 흉추 회전", rx: "좌우 8회" }] },
  { part: "back", slots: ["gymA", "bwU"], items: [
    { name: "맥길 컬업", rx: "10초 × 5", cue: "허리는 누르지도 띄우지도 않게" },
    { name: "버드독", rx: "2×8 (좌우)" }] },
  { part: "thigh", type: /햄스트링/, slots: ["gymB", "bwU"], items: [
    { name: "롱 레버 한 발 브리지", rx: "2×8 (다리당)", cue: "노르딕은 팀 전체가 이미 함" }] },
  { part: "thigh", type: /대퇴사두/, slots: ["gymB"], items: [
    { name: "레그 익스텐션 (3초 내리기)", rx: "2×10" }] },
  { part: "hip", type: /사타구니|내전근/, slots: ["gymA", "bwU"], items: [
    { name: "내전근 공 쥐기 (무릎 사이)", rx: "5초 × 10" },
    { name: "코펜하겐 플랭크 (무릎 대고)", rx: "2×20초 (좌우)" }] },
  { part: "hip", type: /고관절|굴곡근/, slots: ["gymB"], items: [
    { name: "옆으로 누워 다리 들기 (힙 어브덕션)", rx: "2×12 (좌우)" },
    { name: "글루트 브리지", rx: "2×12" }] },
  { part: "calf", type: /아킬레스|종아리/, slots: ["gymB", "bwU"], items: [
    { name: "한 발 카프레이즈 (3초 내리기)", rx: "3×12 (다리당)", cue: "계단 끝에서 뒤꿈치 끝까지" }] },
  { part: "calf", type: /정강이|피로골절/, slots: ["gymB"], items: [
    { name: "한 발 카프레이즈 (3초 내리기)", rx: "2×12 (다리당)" }], note: "정강이 피로골절 이력" },
  { part: "foot", type: /족저근막/, slots: ["gymB", "bwL"], items: [
    { name: "수건 대고 카프레이즈 (발가락 젖히고)", rx: "3×12", cue: "3초 올리고 2초 멈추고 3초 내리기" },
    { name: "족저근막 스트레칭 (발가락 젖히기)", rx: "10초 × 10" }] },
  { part: "foot", type: /피로골절/, slots: [], items: [], note: "발 피로골절 이력" },
  { part: "wrist", slots: ["gymB", "bwU"], items: [
    { name: "손목 굽히기·펴기 (1–2kg)", rx: "각 2×15", cue: "핸드스탠드 전에" },
    { name: "네발 자세에서 앞뒤로 체중 싣기", rx: "30초 × 2" }] },
  { part: "finger", slots: ["gymB"], items: [
    { name: "핸드 그리퍼 또는 테라퍼티 쥐기", rx: "3×10" },
    { name: "손가락 힘줄 글라이딩 (주먹 모양 5가지)", rx: "각 5회" }],
    note: "손가락 테이핑" },
  { part: "elbow", type: /엘보|힘줄/, slots: ["gymB"], items: [
    { name: "덤벨 손목 펴기 (3초 내리기)", rx: "3×15" }] },
  { part: "neck", slots: ["gymB"], items: [
    { name: "목 등척성 (앞·뒤·옆)", rx: "10초 × 3", cue: "손으로 밀고 목은 버티기, 절반 힘" }] },
  { part: "head", slots: [], items: [], note: "뇌진탕 이력 · 두통·어지럼 있으면 멈추기" },
];
const injStatus = x => x.status || "ok";
// 재활 중인 부위: 사이트는 운동을 처방하지 않고 그 부위 부하만 줄임
const REHAB_LIMIT = { knee: "착지 연습 외 플라이오메트릭 빼기", ankle: "착지 연습 외 플라이오메트릭 빼기", calf: "착지 연습 외 플라이오메트릭 빼기", foot: "착지 연습 외 플라이오메트릭 빼기", thigh: "노르딕 빼고 RDL 가볍게", hip: "코펜하겐 빼기", shoulder: "머리 위 동작·던지기 빼기", wrist: "핸드스탠드 빼기", back: "바벨 무게 줄이기", finger: "토스·블로킹 강도는 담당자와 상의" };
const injName = x => INJ_PART_LABEL[x.part] + (x.part === "finger" && FINGERS[x.finger] ? `(${FINGERS[x.finger]})` : "");
function prevBlock(c, slot) {
  const items = [], seen = new Set();
  for (const x of c.injuries) {
    if (injStatus(x) !== "ok") continue;
    const area = INJ_AREA[x.part];
    if (area && c.mods.some(m => m.area === area)) continue; // 지금 아프면 통증 관리가 대신
    for (const r of INJ_RULES) {
      if (r.part !== x.part || (r.type && !r.type.test(x.type || "")) || !r.slots.includes(slot)) continue;
      for (const it of r.items) {
        if (it.jump && (c.fx.noJumps || c.fx.tierMax < 1)) continue;
        if (c.fx.ankle === 1 && /카프레이즈|한 발/.test(it.name)) continue;
        if (c.fx.knee === 1 && /스텝다운|한 발 착지/.test(it.name)) continue;
        if (c.fx.handstandMax < 1 && WRIST_RE.test(it.name)) continue;
        if (c.fx.noOverhead && OVERHEAD_RE.test(it.name)) continue;
        if (c.fx.noCph && /코펜하겐/.test(it.name)) continue;
        if (c.fx.noGrip && GRIP_RE.test(it.name)) continue;
        if (it.not && it.not.includes(slot)) continue;
        let name = it.name;
        if (x.part === "ankle" && c.kneeHx && name.includes("쿠션")) name = "한 발 균형 (눈 감고)";
        if (seen.has(name)) continue;
        if (items.filter(y => y.mod === INJ_PART_LABEL[x.part]).length >= 2) continue; // 부위마다 꼭 필요한 2개까지
        seen.add(name);
        items.push({ name, rx: it.rx, cue: it.cue, mod: INJ_PART_LABEL[x.part] });
      }
    }
  }
  return items.length ? { key: "prev", scope: "me", title: "부상 이력 · 재발 예방", items } : null;
}
// 재활 중 · 아직 아픔 알림
function injuryNotes(c) {
  const notes = [], done = new Set();
  for (const x of c.injuries) {
    const st = injStatus(x), lab = injName(x);
    if (st === "rehab" && !done.has("r" + x.part)) { done.add("r" + x.part); notes.push(`${lab} 재활 중${REHAB_LIMIT[x.part] ? ` · ${REHAB_LIMIT[x.part]}` : ""}`); }
    if (st === "pain" && !done.has("p" + x.part) && !(INJ_AREA[x.part] && c.mods.some(m => m.area === INJ_AREA[x.part]))) { done.add("p" + x.part); notes.push(`${lab} 통증`); }
  }
  return notes;
}
// 정규 훈련 날 알림
function teamNotes(c) {
  const notes = [];
  for (const r of INJ_RULES) if (r.note && !notes.includes(r.note) && c.injuries.some(x => x.part === r.part && injStatus(x) === "ok" && (!r.type || r.type.test(x.type || "")))) notes.push(r.note);
  return notes;
}
/* ---------- 맨몸 (팀 필수 세션, 점프 없음) ---------- */
const BW_U = [
  { key: "push", name: "푸시업", rx: "3세트 (최대보다 2회 적게)", cue: "몸통 일자, 가슴이 먼저 닿게" },
  { key: "pull", name: "턱걸이 또는 인버티드 로우", rx: "3×6–8", cue: "견갑부터 당기기" },
  { key: "pike", name: "파이크 푸시업", rx: "3×6", cue: "머리 위로 미는 힘 · 핸드스탠드 준비" },
  { key: "hs" },
  { key: "walk" },
  { key: "hollow", name: "할로우 홀드 · 슈퍼맨", rx: "3×20초 · 2×10", cue: "허리 뜨지 않게" },
  { key: "mob", name: "가동성 스트레칭", rx: "5분" },
];
const BW_L = [
  { key: "split", name: "스플릿 스쿼트", rx: "3×8 (다리당)", cue: "앞발 뒤꿈치로 밀기, 뒷무릎은 바닥 가까이" },
  { key: "latl", name: "옆 런지", rx: "2×6 (다리당)", cue: "엉덩이 뒤로, 반대 다리는 쭉" },
  { key: "pistol", name: "한 발 스쿼트 (박스)", rx: "3×5 (다리당)", cue: "무릎은 발끝 방향 · 5회 가능한 높이로" },
  { key: "slbridge", name: "한 발 힙 브리지", rx: "3×10 (다리당)", cue: "위에서 1초" },
  { key: "nordic", name: "노르딕 햄스트링", rx: "2×4", rx2: "2×5", cue: "파트너가 발목 고정, 버틸 수 있는 데까지 천천히 · 햄스트링 부상 예방" },
  { key: "calf", name: "한 발 카프레이즈 (맨몸)", rx: "2×15 (다리당)" },
  { key: "ybal", name: "Y 밸런스 뻗기", rx: "3방향 각 3회, 2세트 (다리당)", cue: "한 발로 서서 반대 발을 앞·뒤 양옆으로 멀리 · 발목 안정성" },
  { key: "catch", name: "한 발 서서 공 받기", rx: "좌우 각 1분", cue: "발목 안정성" },
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
      { name: "벽 밀기 외회전 (등척)", rx: "10초 × 5", cue: "통증 없는 힘으로" },
      { name: "견갑 모으고 내리기 (등척)", rx: "10초 × 10" },
      { name: "오픈북 흉추 회전", rx: "좌우 8회 × 2" }],
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
      { name: "양발 카프레이즈", rx: "2×15" },
      { name: "발목 알파벳 그리기", rx: "2회" }],
      next: "걸어도 안 아프고 한 발 10초 서기" },
    { title: "근력·균형", items: [
      { name: "밴드 바깥쪽 밀기 (외번)", rx: "3×15" },
      { name: "한 발 서기 → 눈 감고 → 쿠션 위", rx: "30초 × 3" },
      { name: "한 발 카프레이즈", rx: "3×12" },
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
    { title: "진료 · 보호", items: [
      { name: "진료 먼저 (어느 손가락·인대·골절 확인)", rx: "—", cue: "엄지 인대 완전 파열·골절은 수술이 필요할 수 있어 진단 없이 운동으로 버티지 않기" },
      { name: "손가락 힘줄 글라이딩 (주먹 모양 5가지)", rx: "각 5회, 하루 3번", cue: "통증 없는 범위만" }],
      next: "주먹을 끝까지 쥐고 펼 수 있음" },
    { title: "가동성 · 가벼운 악력", items: [
      { name: "손가락 힘줄 글라이딩 (주먹 모양 5가지)", rx: "각 5회" },
      { name: "테라퍼티 쥐기 (부드러운 것)", rx: "2×10", cue: "통증 3 이하" }],
      next: "쥐는 힘이 반대쪽과 비슷해짐" },
    { title: "악력 · 공 감각", items: [
      { name: "핸드 그리퍼 또는 단단한 테라퍼티 쥐기", rx: "3×10" },
      { name: "벽 오버 토스 (가볍게)", rx: "3×20", cue: "통증 3 이하에서 거리·세기 늘리기" }],
      next: "공 받아도 통증 3 이하" },
    { title: "배구 동작", items: [{ name: "정규 훈련 토스·블로킹 참여", rx: "단계적으로" }],
      next: "—" },
  ], always: "훈련 때 테이핑 권장" },
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
      { name: "파이크 핸드스탠드 홀드", rx: "3×30초" }],
      next: "푸시업·파이크에서 통증 없음" },
    { title: "배구 동작", items: [{ name: "토스·디그 정상 참여, 핸드스탠드 단계 복귀", rx: "단계적으로" }],
      next: "정규 훈련 이틀 연속 문제없이" },
  ] },
  knee: { label: "무릎", pain: ["쉬어도 아프거나 계단·쪼그려 앉기도 아픔", "점프할 때나 다음 날 아침 꽤 아픔", "점프 후·다음 날 살짝 뻐근함", "안 아픔 · 복귀 중"], stages: [
    { title: "등척성 (통증 조절)", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분 · 매일 가능" }],
      next: "한 발 스쿼트 통증 3 이하" },
    { title: "무겁고 느린 근력", items: [
      { name: "레그 익스텐션 · 스쿼트 · 한 발 레그프레스", rx: "15회 → 6회, 3–4세트", cue: "3초 올리고 3초 내리기 · 주 3회" }],
      next: "체중만큼 스쿼트 6회, 통증 3 이하" },
    { title: "에너지 저장 (플라이오메트릭)", items: [
      { name: "레그 익스텐션 · 스쿼트 무겁고 느리게 (유지)", rx: "주 2회 3×8", cue: "3초 올리고 3초 내리기" },
      { name: "플라이오메트릭은 웨이트 A 플라이오메트릭 블록(1–2단계)으로", rx: "—", cue: "다음 날 아침 통증 체크" }],
      next: "점프 다음 날 아침 통증이 늘지 않음 · 한 발 홉 좌우 차이 10% 이내" },
    { title: "종목 복귀", items: [{ name: "어프로치 점프 → 블록 점프 → 정규 훈련 점프 드릴", rx: "단계적 참여" }],
      next: "정규 훈련 이틀 연속 문제없이" },
  ], always: "플라이오메트릭 다음 날 아침 통증이 늘면 양을 줄여요" },
  back: { label: "허리", pain: ["쉬어도 아프고 움직이기 힘듦", "운동할 때나 다음 날 아침 꽤 아픔", "무거운 무게 뒤 살짝 뻐근함", "안 아픔 · 복귀 중"], stages: [
    { title: "가동성", items: [
      { name: "오픈북 흉추 회전", rx: "좌우 8회 × 2" },
      { name: "폼롤러 위 흉추 신전", rx: "5회 × 2" },
      { name: "하프 닐링 엉덩이 굴곡근 스트레칭", rx: "30초 × 2 (좌우)" }],
      next: "일상 통증 2 이하" },
    { title: "몸통 버티기", items: [
      { name: "데드버그 · 할로우 홀드", rx: "2×8 · 3×20초" },
      { name: "버드독", rx: "2×8 (좌우)" },
      { name: "글루트 브리지 → 힙 쓰러스트", rx: "3×10" }],
      next: "운동 중 통증 3 이하" },
    { title: "하중 복귀", items: [{ name: "RDL 가볍게 → 평소 무게, 고블릿 → 백스쿼트", rx: "주마다 단계적으로" }],
      next: "무게를 올려도 다음 날 괜찮음" },
    { title: "배구 동작", items: [{ name: "서브·공격 정상 참여", rx: "—", cue: "허리 과하게 젖히는 습관 확인" }],
      next: "—" },
  ] },
};
const REHAB_AREAS = Object.keys(REHAB);

/* ---------- 선수 상태 계산 ---------- */
function relOf(ctx) {
  const bw = Number(ctx.weight), sq = ctx.e1rm && ctx.e1rm.squat;
  if (sq > 0 && bw > 0) return sq / (1 + 5 / 30) / bw;
  return relStrength(ctx.test, ctx.weight);
}
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
// 통증 정도 (화면에는 '단계' 대신 정도로만 보여 줌)
const PAIN_SEV = ["심함", "중간", "약함", "복귀"];
const painLabel = m => `${REHAB[m.area].label} 통증 · ${PAIN_SEV[m.stage - 1]}`;
function moduleEffects(mods, ankleHistory) {
  const st = a => (mods.find(m => m.area === a) || {}).stage || 0;
  const knee = st("knee"), ankle = st("ankle"), sh = st("shoulder"), wr = st("wrist"), back = st("back");
  return {
    noJumps: knee === 1 || knee === 2 || ankle === 1,
    knee, ankle, back, wrist: wr, finger: st("finger"), // 부위별 통증 단계 (0 없음 · 1 심함 · 2 중간 · 3 약함 · 4 복귀)
    noGrip: st("finger") === 1 || st("finger") === 2 || wr === 1 || wr === 2, // 손가락·손목: 쥐기 운동 빼기
    kneeJumps: false,
    tierMax: ankle === 2 ? 1 : (knee === 3 || ankle === 3) ? 2 : 3, // 무릎 3단계: 1–2단계 점프로 진행 (드롭·실전 점프 제외)
    noOverhead: sh === 1 || sh === 2,     // 메디신볼·핸드스탠드 제외, 벤치 가볍게
    lightMedball: sh === 3,
    handstandMax: wr === 1 || wr === 2 ? 0 : wr === 3 ? 1 : 5,
    goblet: back === 1 || back === 2,
    rdlLight: back >= 1 && back <= 3,
    preIso: knee === 1,                   // 정규 훈련 전 등척성
    ankleBal: !!ankleHistory || ankle >= 1,
    kneeHx: false,
  };
}

/* ---------- 프로그램 만들기 ----------
 * 슬롯(하루의 종류)마다 프로그램을 만든다. 어느 날이 어떤 슬롯인지는 아래 '1년 주기'가 정한다.
 *   gymA 점프 + 하체 근력 · gymB 상체·엉덩이·코어 · team 정규 훈련 · bwU 맨몸 상체·핸드스탠드 · bwL 맨몸 하체·발목
 *   act 활성화 · prep 대회 전날 · match 대회 · recover 회복 · tryout 트라이아웃 · rest 휴식
 * ctx: { player, test(최신 측정), weight(인바디 우선), rehab, pain, checks, injuries, year, ankleHistory } */
function prepCtx(ctx) {
  const p = ctx.player || {};
  const t = ctx.test || null;
  const mods = effectiveModules(p.adjust, ctx.rehab, ctx.pain, ctx.checks);
  const inj = (Array.isArray(ctx.injuries) ? ctx.injuries : []).filter(x => x && x.part);
  if (ctx.ankleHistory && !inj.some(x => x.part === "ankle")) inj.push({ part: "ankle", type: "발목 염좌", status: "ok" });
  const thisYear = Number(ctx.year) || new Date().getFullYear(), thisMonth = Number(ctx.month) || 12;
  // 1년 안: 다친 달을 알면 12개월 안, 연도만 알면 올해·작년
  const recent = x => { const y = Number(x.year), m = Number(x.month); if (!y) return false; return m ? (thisYear - y) * 12 + (thisMonth - m) <= 12 : y >= thisYear - 1; };
  const parts = new Set(inj.map(x => x.part));
  const fx = moduleEffects(mods, parts.has("ankle"));
  const severe = x => x.surgery || x.grade === "complete" || x.grade === "fracture";
  // 무릎 수술·십자인대·완전 파열 1년 안: 드롭 점프·실전 점프(3단계) 빼기
  // 다 나았으면 제한 없음 (홉 좌우 차이가 크면 아래 복귀 기준이 따로 잡음)
  const kneeRecent = inj.some(x => x.part === "knee" && injStatus(x) !== "ok" && recent(x) && (severe(x) || /십자인대/.test(x.type || "")));
  // 재활 중인 부위: 그 부위 부하만 줄임 (처방은 담당자)
  const rehabbing = new Set(inj.filter(x => injStatus(x) === "rehab").map(x => x.part));
  if (rehabbing.has("knee") || rehabbing.has("ankle")) fx.tierMax = Math.min(fx.tierMax, 1);
  if (rehabbing.has("shoulder")) fx.noOverhead = true;
  if (rehabbing.has("wrist")) fx.handstandMax = 0;
  if (rehabbing.has("back")) { fx.goblet = true; fx.rdlLight = true; }
  if (rehabbing.has("calf") || rehabbing.has("foot")) fx.tierMax = Math.min(fx.tierMax, 1);
  if (rehabbing.has("thigh")) { fx.noNordic = true; fx.rdlLight = true; }
  if (rehabbing.has("hip")) fx.noCph = true;
  if (rehabbing.has("finger")) fx.noGrip = true;
  const kneeRecentNote = kneeRecent && !rehabbing.has("knee");
  const kneeRehab = rehabbing.has("knee");
  if (kneeRecent) fx.tierMax = Math.min(fx.tierMax, 2);
  // 측정 기반: 한 발 홉 좌우 차이(LSI) · 무릎 벽 대기(발목 가동성) · 어깨 내·외회전 (공격 팔 d / 반대 팔 n)
  const num = v => v == null || v === "" ? null : Number(v);
  const hopL = num(t && t.hopL), hopR = num(t && t.hopR);
  const lsi = hopL && hopR ? Math.min(hopL, hopR) / Math.max(hopL, hopR) : null;
  const hopShort = lsi != null && lsi < 0.9 ? (hopL < hopR ? "왼" : "오른") : null;
  const ktwL = num(t && t.ktwL), ktwR = num(t && t.ktwR);
  const ktwLow = ktwL != null && ktwR != null && (Math.min(ktwL, ktwR) < 10 || Math.abs(ktwL - ktwR) > 2) ? (ktwL <= ktwR ? "왼" : "오른") : null;
  const irD = num(t && t.irD), irN = num(t && t.irN), erD = num(t && t.erD), erN = num(t && t.erN);
  const gird = irD != null && irN != null && irN - irD >= 20;
  const tromDef = [irD, irN, erD, erN].every(v => v != null) && (irN + erN) - (irD + erD) > 5;
  // 복귀 기준: 무릎·발목을 1년 안에 다쳤거나 지금 아픈데 한 발 홉 좌우 차이가 10% 넘으면 실전 점프 보류
  const lowerRisk = inj.some(x => (x.part === "knee" || x.part === "ankle") && recent(x)) || mods.some(m => m.area === "knee" || m.area === "ankle");
  const rtpHold = !!hopShort && lowerRisk;
  if (rtpHold) fx.tierMax = Math.min(fx.tierMax, 2);
  return {
    hopShort, lsi, ktwLow, gird, tromDef, rtpHold,
    p, t, mods, fx, parts, kneeRecent: kneeRecentNote, kneeRehab, team: !p.pos, injuries: inj,
    kneeHx: parts.has("knee"),
    noExt: inj.some(x => x.part === "back" && /분리증/.test(x.type || "")), // 허리 과신전 줄이기
    recentAnkle: inj.some(x => x.part === "ankle" && recent(x) && injStatus(x) !== "rehab"),
    shoulderRecent: inj.some(x => x.part === "shoulder" && recent(x) && (severe(x) || /탈구|와순|파열|불안정/.test(x.type || ""))),
    novice: p.weightExp === "none",                                  // 입문: 웨이트 처음
    machineOnly: p.weightExp === "machine" || p.weightExp === "lt6", // 초급: 기구(머신)만 → 프리웨이트는 가볍게 익히며
    oly: p.weightExp === "oly",                                      // 상급: 파워 클린 같은 역도 동작 가능 → 파워 단계에 행 파워 클린
    rel: relOf(ctx),
    hsStage: Math.max(1, Math.min(5, Number((t && t.hsStage) || 1))),
    e1rm: ctx.e1rm || null, e1rmName: ctx.e1rmName || null,
  };
}
// 측정 결과로 붙는 개인 보완 (가동성 · 좌우 차이)
function measBlock(c, slot) {
  const items = [];
  if (c.ktwLow && (slot === "gymA" || slot === "bwL")) items.push(
    { name: `무릎 벽 대기 발목 가동성 (${c.ktwLow}쪽 더)`, rx: "2×10", cue: "발뒤꿈치 붙인 채 무릎을 벽으로", mod: "발목 가동성" },
    { name: "벽 종아리 스트레칭 (무릎 굽혀서·펴서)", rx: "각 30초 × 2", mod: "발목 가동성" });
  if ((c.gird || c.tromDef) && (slot === "gymB" || slot === "bwU")) items.push(
    { name: "크로스바디 스트레치 (공격 팔)", rx: "30초 × 3", cue: "어깨 뒤쪽이 당기게, 통증 없이", mod: "어깨 가동범위" });
  const legPain = (c.fx.knee && c.fx.knee <= 2) || c.fx.ankle === 1;
  if (c.hopShort && slot === "gymA" && !legPain) items.push({ name: `불가리안 스플릿 스쿼트 ${c.hopShort}쪽 1세트 더`, rx: "1×6", mod: "좌우 차이" });
  if (c.hopShort && slot === "bwL" && !legPain) items.push({ name: `한 발 스쿼트 (박스) ${c.hopShort}쪽 1세트 더`, rx: "1×5", mod: "좌우 차이" });
  return items.length ? { key: "meas", scope: "me", title: "측정 결과 보완", items } : null;
}
// 무게 추천: 추정 1RM(Epley + RIR)에서 처방 반복·RIR에 맞는 무게
const LIFT_OF = { "백스쿼트": "squat", "데드리프트 (바벨)": "rdl", "루마니안 데드리프트 (바벨)": "rdl", "바벨 힙 쓰러스트": "hip", "덤벨 벤치프레스": "bench", "행 파워 클린": "clean" };
const e1rmOf = (kg, reps, rir) => kg * (1 + (Number(reps) + Number(rir || 0)) / 30);
// 운동마다 그 선수의 최근 8주 세트 기록(추정 1RM)으로 처방 반복·RIR에 맞는 무게 (예전에 잰 5RM이 있으면 그것도 씀)
function loadFor(c, name, rx, w) {
  const lift = LIFT_OF[name];
  const e = (lift && c.e1rm && c.e1rm[lift]) || (c.e1rmName && c.e1rmName[baseName(name)]);
  if (!e) return "";
  const m = String(rx).match(/(\d+)\s*×\s*(\d+)/); if (!m) return "";
  const r = String(rx).match(/RIR\s*(\d)/);
  const rir = r ? Number(r[1]) : (LIGHT(w) ? 4 : 3);
  const step = /덤벨|케틀벨/.test(name) ? 1 : 2.5;
  const kg = Math.round(e / (1 + (Number(m[2]) + rir) / 30) / step) * step;
  return kg > 0 ? ` · 약 ${kg}kg` : "";
}
// 측정 안내: 통증·제한이 있으면 그 측정은 뺀다 (아픈 채로 잰 값은 비교가 안 되고 위험)
// 한 달에 한 번 측정 (트라이아웃식). 아프거나 제한이 있으면 그 측정은 뺀다 (아픈 채로 잰 값은 비교가 안 되고 위험)
function measureNote(c) {
  const { fx } = c, tests = [], skip = [];
  const legPain = (fx.knee && fx.knee <= 2) || fx.ankle === 1 || fx.tierMax < 2;
  if (!c.t || c.t.reach == null) tests.push("리치");
  if (fx.noJumps || fx.tierMax < 2) skip.push("점프"); else { tests.push("버티컬"); if (fx.tierMax >= 3) tests.push("맥스 버티컬"); else skip.push("맥스 버티컬"); }
  if (legPain) skip.push("반복 옆뛰기"); else tests.push("반복 옆뛰기");
  const head = "이번 달 측정";
  if (!tests.length) return `${head} · 통증 줄면`;
  return `${head} · ${tests.join("·")}`;
}
function hsItem(c, rx) {
  const max = c.fx.handstandMax;
  if (c.fx.noOverhead && c.mods.some(m => m.area === "shoulder")) return null; // 어깨 재활 블록이 대신
  if (c.fx.noOverhead || max < 1) return { name: "핸드스탠드 대신 견갑·외회전 운동", rx, cue: "통증 없는 범위에서", mod: c.fx.noOverhead ? "어깨" : "손목" };
  if (c.team) return { name: "핸드스탠드 단계 연습", rx, cue: "각자 단계대로 (1 파이크 홀드 → 5 핸드스탠드 워크)" };
  const s = Math.min(max, c.hsStage);
  return { name: `핸드스탠드 ${s}단계 · ${HS_STAGES[s]}`, rx, cue: HANDSTAND[s] + (c.p.pos === "S" ? " · 세터는 매번 빠짐없이" : ""), mod: s < c.hsStage ? "손목" : "" };
}
// 다 같이 코트 핸드스탠드 워크 — 단계에 맞춰 휠배로 워크 → 파트너 보조 → 혼자
function walkItem(c) {
  if (c.fx.noOverhead || c.fx.handstandMax < 1) return null;
  if (c.team) return { name: "다 같이 핸드스탠드 워크", rx: "코트 3회", cue: "단계에 맞게: 휠배로 워크 → 파트너 보조 → 혼자 · 목표는 다 같이 코트 18m" };
  const s = Math.min(c.fx.handstandMax, c.hsStage);
  if (s >= 5) return { name: "핸드스탠드 워크", rx: "3회", cue: "회마다 거리 재기 · 목표 코트 18m" };
  if (s === 4) return { name: "파트너 보조 핸드스탠드 워크", rx: "3×5m", cue: "파트너는 발목을 가볍게만" };
  return { name: "휠배로 워크 (파트너가 발목 잡기)", rx: "3×5m", cue: "몸통 일자, 허리 처지지 않게" };
}

// 점프 동작 이름 (점프 없이 하는 착지·자세 연습은 제외)
const JUMP_RE = /점프|홉|바운드|허들|스냅다운|5-10-5|CMJ/;
const NOJUMP_RE = /점프 없이|착지 자세 연습|플라이오메트릭은 웨이트/;
const isJump = n => JUMP_RE.test(n) && !NOJUMP_RE.test(n);
const WRIST_RE = /핸드스탠드(?! 대신)|휠배로|파이크|박수 푸시업|^푸시업(?! \(덤벨)|견갑 푸시업|플라이오 푸시업|플랭크 → 푸시업/;
const GRIP_RE = /플레이트 핀치|리스트 롤러|원판 꼬집어|그리퍼|테라퍼티/;
const OVERHEAD_RE = /핸드스탠드(?! 대신)|휠배로|파이크|메디신볼|박수 푸시업|랜드마인|던지기|오버헤드/;
// 같은 운동이 두 번 나오지 않게: 본 운동 블록을 먼저 보고, 워밍업에서 겹치는 건 워밍업 쪽을 뺀다
const baseName = n => String(n).replace(/\s*\([^)]*\)/g, "").trim();
function dedupe(out) {
  const seen = new Set(), order = [...out.blocks.filter(b => b.key !== "warm"), ...out.blocks.filter(b => b.key === "warm")];
  for (const b of order) {
    b.items = b.items.filter(x => {
      if (/^(통증 체크|세션 RPE 기록)/.test(x.name)) return true;
      const k = baseName(x.name), parts = k.split(" · ");
      const seenParts = new Set([...seen].flatMap(x => x.split(" · ")));
      if (seen.has(k) || parts.every(p => seenParts.has(p))) return false;
      seen.add(k); return true;
    });
  }
  out.blocks = out.blocks.filter(b => b.items.length || b.key === "team");
}
function slotPlan(ctx, slot, w, o = {}) {
  const c = prepCtx(ctx), { p, t, mods, fx } = c;
  const out = { blocks: [], notes: [], landings: 0, kind: "", title: "", mods, rel: c.rel, logType: "other", minutes: 30, slot, optional: !!o.optional };
  const add = b => { if (b) out.blocks.push(b); };
  // 하체 날 워밍업에는 간단한 코어를 넣음 (피지컬부장 요청)
  const withCore = b => { if (slot === "gymA" || slot === "bwL") b.items.splice(1, 0, { ...CORE_WARM }); return b; };
  const warm = () => withCore({ key: "warm", title: "워밍업", items: WARMUP.flatMap((x, i) => {
    if (i === 1 && (fx.knee === 1 || fx.ankle === 1)) return [{ name: "다리 스윙 · 엉덩이 돌리기", rx: "3분", cue: "런지 없이, 통증 없는 범위", mod: fx.knee === 1 ? "무릎 통증" : "발목 통증" }];
    if (i === 1 && fx.knee === 2) return [{ ...x, cue: "통증 없는 범위로 얕게", mod: "무릎 통증" }];
    if (i === 2 && slot === "gymB") return []; // 상체 날은 점프 워밍업 없이
    if (i === 2 && fx.noJumps) return [{ name: "스쿼트 착지 자세 연습 (점프 없이)", rx: "5회", cue: "무릎은 발끝 방향", mod: "통증" }];
    if (i === 3 && fx.noOverhead) return [{ ...x, name: "어깨 밴드 · Y·T (통증 없는 범위)", mod: "어깨 통증" }];
    return [x];
  }) });
  const rehabBlock = (title, filter, cap = REHAB_CAP) => {
    const items = [];
    for (const m of [...mods].sort((a, b) => a.stage - b.stage)) {
      if (filter && !filter(m)) continue;
      const def = REHAB[m.area], s = def.stages[m.stage - 1];
      const room = Math.min(cap.per, cap.total - items.length);
      if (room <= 0) break;
      items.push(...s.items.filter(x => {
        if (m.area !== "knee" && m.area !== "ankle" && fx.noJumps && isJump(x.name)) return false;
        if ((slot === "gymB" || slot === "bwU") && isJump(x.name)) return false; // 홉·점프 재활은 하체 날에만
        if (m.area !== "ankle" && m.area !== "knee" && fx.tierMax < 3 && /어프로치|블록 점프|점프 스파이크/.test(x.name)) return false;
        if (fx.noJumps && m.area !== "knee" && isJump(x.name)) return false;
        if (m.area !== "wrist" && fx.handstandMax < 1 && WRIST_RE.test(x.name)) return false;
        if (m.area !== "shoulder" && fx.noOverhead && OVERHEAD_RE.test(x.name)) return false;
        if (GRIP_RE.test(x.name) && ((fx.finger && fx.finger <= 2 && m.area !== "finger") || (fx.wrist && fx.wrist <= 2 && m.area !== "wrist"))) return false;
        return true;
      }).map(x => {
        if (m.area === "back" && fx.knee && fx.knee <= 2 && /백스쿼트/.test(x.name)) return { ...x, name: "RDL 가볍게 → 평소 무게 (스쿼트는 무릎 통증이 줄면)", mod: mods.length > 1 ? def.label : "" };
        return { ...x, mod: mods.length > 1 ? def.label : "" };
      }).slice(0, room));
    }
    return items.length ? { key: "rehab", scope: "me", title, items, note: "의료진 지시가 우선" } : null;
  };
  const h = { add, warm, rehabBlock };
  (SLOT_FN[slot] || SLOT_FN.rest)(c, w, o, out, h);
  if (!["rest", "match", "recover", "prep"].includes(slot)) out.notes.push(...injuryNotes(c));
  if (o.optional && out.title && !/^(자율|자유|회복|휴식)/.test(out.title)) out.title = "자율 · " + out.title;
  dedupe(out);
  if (!c.team && ADDON_MAX[slot]) capAddons(out, slot);
  return out;
}
// 재활 블록 크기: 부위마다 꼭 필요한 것만 (단계 항목의 앞쪽부터)
// 재활: 부위마다 그 단계의 중요한 것부터 3개까지 (대회 앞뒤는 1개)
const REHAB_CAP = { per: 3, total: 6 }, REHAB_CAP_LIGHT = { per: 1, total: 2 };
const ADDON_KEYS = ["prev", "meas"]; // 재활은 따로 (부위마다 3개), 예방·측정 보완만 상한
// 하루 개인 운동 상한: 재활(지금 아픈 곳)은 그대로 두고, 넘치면 측정 보완의 '1세트 더' →
// 부상 이력 예방 중 부위마다 첫 번째가 아닌 것 → 측정 보완 두 번째부터 → 나머지 예방 → 나머지 측정 보완 순으로 뺀다
const ADDON_MAX = { gymA: 3, gymB: 3, bwU: 2, bwL: 2 }; // 팀 세션은 줄이지 않고 예방·측정 보완은 최소한으로
function capAddons(out, slot) {
  const blk = k => out.blocks.find(b => b.key === k);
  const count = () => ADDON_KEYS.reduce((a, k) => a + ((blk(k) || {}).items || []).length, 0);
  const drop = (k, pick) => { const b = blk(k); if (!b) return false; const i = pick(b.items); if (i < 0) return false; b.items.splice(i, 1); return true; };
  const lastIdx = (arr, f) => { for (let i = arr.length - 1; i >= 0; i--) if (f(arr[i], i)) return i; return -1; };
  const steps = [
    () => drop("meas", it => lastIdx(it, x => /1세트 더/.test(x.name))),
    () => drop("prev", it => lastIdx(it, (x, i) => it.findIndex(y => y.mod === x.mod) !== i)),
    () => drop("meas", it => it.length > 1 ? it.length - 1 : -1),
    () => drop("prev", it => it.length - 1),
    () => drop("meas", it => it.length - 1),
  ];
  for (const step of steps) while (count() > ADDON_MAX[slot] && step()) {}
  out.blocks = out.blocks.filter(b => b.items.length || b.key === "team");
}

const SLOT_FN = {
  // ---- 점프 + 하체 근력
  gymA(c, w, o, out, h) {
    const { p, fx, rel, novice, machineOnly } = c;
    out.kind = "플라이오메트릭 + 하체 근력"; out.logType = "A"; out.minutes = 75;
    out.title = ["하체 · 가볍게", "하체 · 점프", "하체 · 회복 주", "하체 · 점프", "하체 · 피크", "하체 · 유지"][w];
    if (o.second) out.title = "하체 근력" + (LIGHT(w) ? " · 가볍게" : "");
    if (o.measure) out.notes.push(measureNote(c, o.measure));
    if (w === PH.TAPER) out.notes.push((o.weekEvent && o.weekEvent.kind === "minor" ? "컨디셔닝 주간" : "대회 주") + " · 양 줄임");
    h.add(h.warm());
    let plyo = PLYO.map(x => ({ ...x, sets: x.sets[w], reps: x.reps[w] })).filter(x => x.sets > 0);
    plyo = plyo.filter(x => x.key !== "drop" || (rel != null && rel > 1.2 && !c.mods.some(m => m.area === "knee") && !c.kneeHx));
    plyo = plyo.filter(x => x.key !== "posj" || rel == null || rel >= 0.8);
    plyo = plyo.map(x => x.key === "posj" ? { ...x, name: POSJ[p.pos] || x.name } : x);
    if (p.pos === "S") plyo = plyo.map(x => (x.key === "bssj" || x.key === "hurdle") ? { ...x, sets: Math.max(1, x.sets - 1), mod: "세터 −1세트" } : x);
    if (p.pos === "Li") {
      plyo = plyo.flatMap(x => {
        if (x.key === "bssj") return [{ ...x, key: "lat", name: "옆으로 한 발 바운드 착지 고정", cue: "바깥발 착지 2초 고정, 좌우", reps: 4, mod: "리베로 대체" }];
        if (x.key === "drop" || x.key === "hurdle") return [];
        if (x.key === "posj") return [{ ...x, key: "step", tier: 1, name: "5-10-5 방향 전환", cue: "낮은 무게중심, 회당 완전 휴식", sets: 4, reps: null, fmt: "count", mod: "리베로 대체" }];
        return [x];
      });
    }
    // 최근 3일 정규 훈련·경기를 본인이 RPE 7 이상으로 기록했으면 웨이트 A 플라이오메트릭을 줄임 (볼 훈련 점프까지 합친 부하 관리)
    const hard = o.hardTeam || 0;
    let tierMax = fx.tierMax;
    if (hard >= 2) { tierMax = Math.min(tierMax, 1); out.notes.push("RPE 높음 · 점프 줄임"); }
    else if (hard === 1 && !LIGHT(w)) {
      tierMax = Math.min(tierMax, 2);
      plyo = plyo.map(x => x.tier === 2 ? { ...x, sets: Math.max(1, x.sets - 1) } : x);
      out.notes.push("RPE 높음 · 점프 줄임");
    }
    if (c.rtpHold) out.notes.push(`한 발 홉 좌우 차이 ${Math.round((1 - c.lsi) * 100)}%`);
    if (tierMax < 3) {
      plyo = plyo.filter(x => x.tier <= tierMax);
      if (!plyo.some(x => x.key === "stick")) plyo.push({ ...PLYO[1], sets: LIGHT(w) ? 2 : 3, reps: 5, mod: "고강도 대신" });
    }
    if (c.kneeRehab) plyo = plyo.filter(x => !["bssj", "lat"].includes(x.key));
    // 발목 통증 약함: 재활 블록의 한 발 홉이 발목 쪽을 맡으니 팀 플라이오메트릭의 한 발 종목은 빼기 (겹침 방지)
    if (c.mods.some(m => m.area === "ankle" && m.stage === 3)) plyo = plyo.filter(x => !["bssj", "lat"].includes(x.key));
    if (fx.noJumps) { plyo = []; out.notes.push("통증 · 점프 쉼"); }
    if (o.second) plyo = [];
    plyo.sort((a, b) => PLYO_ORDER.indexOf(a.key) - PLYO_ORDER.indexOf(b.key));
    out.landings = plyo.reduce((s, x) => s + (typeof x.reps === "number" ? x.sets * x.reps * (x.sides || 1) : 0), 0);
    // 포지션별 점프(리베로는 방향 전환)·드롭은 개인, 나머지는 팀 공통 점프
    const posPlyo = plyo.filter(x => ["posj", "step", "drop"].includes(x.key)), teamPlyo = plyo.filter(x => !posPlyo.includes(x));
    if (teamPlyo.length) h.add({ key: "plyo", title: "플라이오메트릭", items: teamPlyo.map(x => ({ name: x.name, rx: plyoRx(x), cue: x.cue, mod: x.mod })) });
    const strength = MON_STRENGTH.filter(x => x.rx[w]).map(x => {
      let name = x.name, rx = x.rx[w], mod = "";
      if (c.team) return { name, rx, cue: x.cue };
      if (x.key === "rdl" && fx.rdlLight && !c.mods.some(m => m.area === "back")) mod = "허벅지 재활";
      if (x.key === "squat" && (novice || (rel != null && rel < 0.8) || fx.goblet)) { name = "고블릿 스쿼트 (덤벨)"; mod = fx.goblet ? "허리 통증" : novice ? "웨이트 입문" : ""; }
      else if (x.key === "squat" && machineOnly && w === PH.INTRO) { name = "백스쿼트 (빈 바부터)"; rx = "동작 연습 3×8"; }
      if (x.key === "rdl" && (novice || (machineOnly && w === PH.INTRO))) name = "덤벨 루마니안 데드리프트";
      if ((x.key === "squat" || x.key === "rdl") && (machineOnly || novice)) rx = rx.replace("RIR 2", "RIR 3");
      if (x.key === "rdl" && fx.rdlLight) { rx += " · 가볍게, 통증 없는 범위"; mod = mod || "허리 통증"; }
      if (x.key === "jsq" && (o.second || novice || fx.noJumps || tierMax < 2 || fx.knee === 2 || fx.ankle === 2 || (rel != null && rel < 0.8))) return null;
      // 무릎 심함: 무릎 쓰는 근력은 빼고 재활 블록(등척성)으로 · 중간: 통증 5 이하 무게로
      if (fx.knee === 1 && ["squat", "bss", "stepup", "jsq"].includes(x.key)) return null;
      if (fx.knee === 2 && ["bss", "stepup"].includes(x.key)) return null; // 재활 블록의 무겁고 느린 근력이 대신
      if (fx.knee === 2 && x.key === "sqwu") { rx += " · 통증 없는 범위"; mod = "무릎 통증"; }
      if (fx.knee === 2 && x.key === "squat") { rx = rx.replace(/^(\D*)([34])×/, (_, a, n) => `${a}${n - 1}×`) + " · 통증 5 이하 무게로"; mod = "무릎 통증"; }
      // 발목 심함(걸어도 아픔): 한 발로 서는 근력·카프레이즈 빼기
      if (fx.ankle === 1 && ["bss", "stepup", "calf"].includes(x.key)) return null;
      if (fx.ankle === 2 && x.key === "calf") { rx += " · 통증 5 이하"; mod = "발목 통증"; }
      if (x.key === "bss" && w === PH.INTRO && !novice) rx = "2×6 (다리당, 가볍게)";
      if (!mod) rx += loadFor(c, name, rx, w);
      return { name, rx, cue: x.cue, mod };
    }).filter(Boolean);
    // 1학기: 노르딕을 맨몸 하체(정규 훈련 다음 날)에서 이날로 옮김
    if (o.nordicHere && !novice && !fx.noNordic && w !== PH.TAPER) strength.push({ name: "노르딕 햄스트링", rx: HEAVY(w) ? "2×5" : "2×4", cue: "파트너가 발목 고정, 버틸 수 있는 데까지 천천히" });
    if (!strength.some(x => x.name.startsWith("백스쿼트") && x.name !== "백스쿼트 워밍업")) { const k = strength.findIndex(x => x.name === "백스쿼트 워밍업"); if (k >= 0) strength.splice(k, 1); }
    h.add({ key: "str", title: "근력", items: strength });
    if (posPlyo.length) h.add({ key: "pos", scope: "me", title: "포지션 플라이오메트릭", items: posPlyo.map(x => ({ name: x.name, rx: plyoRx(x), cue: x.cue })) });
    h.add(prevBlock(c, "gymA"));
    h.add(measBlock(c, "gymA"));
    h.add(h.rehabBlock("재활 운동"));
  },
  // ---- 상체·엉덩이·코어
  gymB(c, w, o, out, h) {
    const { p, fx, novice } = c;
    out.kind = "상체·엉덩이·코어"; out.logType = "B"; out.minutes = 60;
    out.title = "상체 · 코어" + (LIGHT(w) ? " · 가볍게" : "");
    h.add(h.warm());
    const items = THU.filter(x => !x.weeks || x.weeks.includes(w)).map(x => {
      let rx = (HEAVY(w) && x.rx2) ? x.rx2 : x.rx, cue = x.cue, mod = "";
      if (x.key === "pogo" && (fx.noJumps || o.picked)) return null;
      if (["er", "ytw"].includes(x.key) && fx.noOverhead) return null; // 어깨 재활 블록에 들어 있음
      if (x.key === "mb" && (fx.noOverhead || fx.goblet)) return null;
      if (x.key === "pull" && fx.noOverhead) return { name: "인버티드 로우 (통증 없는 범위)", rx: LIGHT(w) ? "2×8" : "3×8", cue: "견갑부터 당기기", mod: "어깨" };
      if (x.key === "cph" && fx.noCph) return { name: "사이드 플랭크", rx: LIGHT(w) ? "2×20초 (좌우)" : "3×25초 (좌우)", mod: "사타구니 재활" };
      if (x.key === "clap" && (fx.noOverhead || fx.handstandMax < 4 || novice || c.shoulderRecent)) return null;
      if (x.key === "mb" && fx.lightMedball) { rx = "3×5 · 2kg"; mod = "어깨 통증"; }
      if (x.key === "bench" && fx.noOverhead) { rx = "3×8 · RIR 3"; cue = "통증 없는 범위"; mod = "어깨 통증"; }
      if (x.key === "hs") return hsItem(c, "10분");
      if (LIGHT(w)) rx = String(rx).replace(/^[34]×/, "2×");
      if (!mod) rx += loadFor(c, x.name, rx, w);
      return { name: x.name, rx, cue, mod };
    }).filter(Boolean);
    out.landings = fx.noJumps ? 0 : 20;
    const cut = items.findIndex(x => x.name.startsWith("바벨 힙"));
    const power = items.slice(0, cut), main = items.slice(cut);
    const isCore = x => ["핸드스탠드", "코펜하겐", "할로우"].some(k => x.name.startsWith(k));
    if (power.length) h.add({ key: "thu", title: "파워", items: power });
    h.add({ key: "thu2", title: "근력", items: main.filter(x => !isCore(x)) });
    h.add({ key: "core", title: "핸드스탠드 · 코어", items: main.filter(isCore) });
    if (w !== PH.TAPER) h.add(posBlock(c, "gymB"));
    h.add(prevBlock(c, "gymB"));
    h.add(measBlock(c, "gymB"));
    h.add(h.rehabBlock("재활 운동"));
  },
  // ---- 대회 2–3일 전 활성화
  act(c, w, o, out, h) {
    const { p, fx, novice } = c;
    out.kind = "활성화 30분"; out.title = "활성화"; out.logType = "act"; out.minutes = 30;
    h.add(h.warm());
    const items = [];
    let land = 0;
    if (!fx.noJumps) { items.push({ name: "포고 점프", rx: "1×10" }); land += 10; }
    if (fx.noJumps) { if (!c.mods.some(m => m.area === "knee")) items.push({ name: "레그 익스텐션 등척성", rx: "3×45초", mod: "통증" }); }
    else if (fx.tierMax < 2) { items.push({ name: "스쿼트 점프 착지 고정", rx: "2×3", mod: "강도 제한" }); land += 6; }
    else if (p.pos === "Li") { items.push({ name: "옆으로 한 발 바운드", rx: "2×2" }); land += 4; }
    else { items.push({ name: "CMJ 최대 노력", rx: "2×3" }); land += 6; }
    if (fx.knee !== 1 && fx.ankle !== 1) items.push({ name: (novice || fx.goblet) ? "고블릿 스쿼트" : "백스쿼트", rx: "2×2 · 평소 무게" + (fx.knee === 2 ? " · 통증 5 이하" : ""), mod: fx.knee === 2 ? "무릎 통증" : "" });
    items.push({ name: "어깨 밴드 운동", rx: "워밍업 5번 순서" });
    out.landings = land;
    h.add({ key: "act", title: "활성화", items });
    h.add(h.rehabBlock("재활 운동 (가볍게)", null, REHAB_CAP_LIGHT));
  },
  // ---- 정규 훈련
  team(c, w, o, out, h) {
    const { fx } = c;
    if (c.recentAnkle) out.notes.push("발목 테이핑");
    out.kind = "정규 훈련"; out.logType = "team"; out.minutes = 180;
    out.title = o.light ? "정규 훈련 · 가볍게" : "정규 훈련";
    if (fx.preIso) h.add({ key: "pre", scope: "me", title: "훈련 전", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분", mod: "무릎 통증" }] });
    h.add({ key: "team", title: "정규 훈련", items: [{ name: "정규 훈련", rx: o.teamTime || "18:00–21:00" }] });
    if (o.teamTimeNote) out.notes.push(`오늘 훈련 시간 ${o.teamTime} · ${o.teamTimeNote}`);
    h.add({ key: "after", title: "훈련 후", items: [{ name: "통증 체크", rx: "아픈 곳 있으면" }, { name: "세션 RPE 기록", rx: "30분 안에" }] });
    h.add(prevBlock(c, "team"));
    out.notes.push(...teamNotes(c));
  },
  bwU(c, w, o, out, h) { bwPlan(c, w, o, out, h, true); },
  bwL(c, w, o, out, h) { bwPlan(c, w, o, out, h, false); },
  // ---- 교류전 (관리자가 일정에 넣음): 그날은 교류전이 훈련, 앞뒤 날 하체 웨이트는 피함 (weekFlow)
  friendly(c, w, o, out, h) {
    const { fx } = c, f = o.friendly || {}, nine = f.format === "9";
    const time = f.start ? `${f.start}${f.end ? `–${f.end}` : ""}` : "";
    out.kind = "교류전"; out.logType = "match"; out.minutes = nine ? 120 : 150;
    out.title = frName(f.opponent);
    if (c.recentAnkle) out.notes.push("발목 테이핑");
    if (fx.preIso) h.add({ key: "pre", scope: "me", title: "시작 전", items: [{ name: "레그 익스텐션 등척성 (무릎 약 60°)", rx: "45초 × 5", cue: "세트 간 2분", mod: "무릎 통증" }] });
    h.add({ key: "match", title: "교류전", items: [
      { name: "팀 워밍업", rx: time ? `${f.start} 전 30분` : "평소대로", cue: fx.noJumps || fx.tierMax < 3 ? "통증·제한이 있으면 어프로치 점프는 빼기" : "끝나고 어프로치 점프 2–3회로 마무리" },
      { name: "교류전", rx: time || "—" },
      { name: "세트 사이 체온 유지 · 물", rx: "세트마다" },
    ] });
    h.add({ key: "after", title: "끝나고", items: [{ name: "통증 체크", rx: "아픈 곳 있으면" }, { name: "세션 RPE 기록", rx: "30분 안에" }] });
    if (f.place) out.notes.push(f.place);
    if (f.note) out.notes.push(f.note);
    if (nine) out.notes.push("9인제");
    out.notes.push(...teamNotes(c));
  },
  // ---- 대회 전날
  prep(c, w, o, out, h) {
    out.kind = "대회 전날"; out.title = "대회 전날"; out.minutes = 20;
    const items = [{ name: "가볍게 조깅 · 동적 스트레칭", rx: "15분" }];
    if (!c.fx.noJumps && c.fx.tierMax >= 3) items.push({ name: "어프로치 점프", rx: "3회", cue: "70% → 90%" });
    items.push({ name: "물·탄수화물 간식", rx: "미리 챙기기" });
    h.add({ key: "prep", title: "오늘", items });
    out.notes.push("일찍 자기");
    h.add(h.rehabBlock("재활 운동 (가볍게)", m => m.stage <= 2, REHAB_CAP_LIGHT));
  },
  // ---- 대회
  match(c, w, o, out, h) {
    const ev = o.event || { name: "대회" };
    out.kind = "대회"; out.logType = "match"; out.minutes = 90;
    out.title = ev.name + (o.days > 1 ? ` ${o.dayNo}일차` : "");
    h.add({ key: "match", title: "경기 운영", items: [
      { name: "팀 워밍업", rx: "평소대로", cue: c.fx.noJumps || c.fx.tierMax < 3 ? "통증·제한이 있으면 어프로치 점프는 빼기" : "끝나고 어프로치 점프 2–3회로 마무리" },
      { name: "경기 사이 체온 유지", rx: "껴입기", cue: "앉아서 식지 않게" },
      { name: "다음 경기 10분 전 다시 데우기", rx: c.fx.noJumps ? "스킵 · 동적 스트레칭 (점프 없이)" : c.fx.tierMax < 3 || c.p.pos === "S" ? "스킵 · 한 발 홉" : "스킵 · 한 발 홉 · 어프로치 점프 3회", cue: c.p.pos === "S" && !c.fx.noJumps ? "세터는 추가 점프 없이" : "" },
      { name: "물·탄수화물 간식", rx: "경기 사이마다", cue: "경기가 많은 날은 미리 챙기기" },
    ] });
    h.add({ key: "after", title: "끝나고", items: [{ name: "통증 체크", rx: "아픈 곳 있으면" }, { name: "세션 RPE 기록", rx: "그날 안에" }] });
    if (o.days > 1 && o.dayNo < o.days) out.notes.push("일찍 자기");
  },
  // ---- 회복 (대회 다음 날들 · 비시즌 첫 주)
  recover(c, w, o, out, h) {
    out.kind = "회복"; out.title = "회복"; out.minutes = 30;
    h.add({ key: "rest", title: "오늘", items: [
      { name: "가볍게 걷기 · 자전거 (유산소)", rx: "20분", cue: "대화할 수 있는 강도" },
      { name: "가동성 스트레칭", rx: "10분" },
      { name: "통증 체크", rx: "아픈 곳 있으면" }] });
    h.add(h.rehabBlock("재활 운동", m => m.stage <= 2, REHAB_CAP_LIGHT));
  },
  // ---- 트라이아웃 (측정)
  tryout(c, w, o, out, h) {
    out.kind = "트라이아웃"; out.title = (o.event && o.event.name) || "트라이아웃"; out.minutes = 120;
    h.add(h.warm());
    const { fx } = c, skip = [];
    const tests = TRYOUT_TESTS.filter(x => {
      if ((fx.noJumps || fx.tierMax < 2) && /버티컬/.test(x.name)) { skip.push(x.name.replace(/ \(.*$/, "")); return false; }
      if (((fx.knee && fx.knee <= 2) || fx.ankle === 1 || fx.tierMax < 2) && /옆뛰기/.test(x.name)) { skip.push(x.name.replace(/ \(.*$/, "")); return false; }
      if (fx.tierMax < 3 && /맥스 버티컬/.test(x.name)) { skip.push("맥스 버티컬"); return false; }
      return true;
    });
    h.add({ key: "test", title: "측정", items: tests });
    if (skip.length) out.notes.push(`${skip.join("·")} 측정 제외`);
  },
  rest(c, w, o, out, h) {
    out.kind = "완전 휴식"; out.title = "휴식";
    h.add({ key: "rest", title: "오늘", items: [o.optional ? { name: "가볍게 걷기 · 자전거 (선택)", rx: "20–30분" } : { name: "휴식", rx: "—" }] });
  },
};
const TRYOUT_TESTS = [
  { name: "스탠딩 리치", rx: "1회", cue: "벽 옆에 서서 한 손을 최대한 뻗어 닿는 높이" },
  { name: "버티컬 (제자리 점프 높이)", rx: "3회 중 최고", cue: "팔 스윙 허용, 손끝 도달 높이 − 리치" },
  { name: "맥스 버티컬 (도움닫기 점프 높이)", rx: "3회 중 최고", cue: "실전 어프로치 한 손 도달 높이 − 리치" },
  { name: "반복 옆뛰기 (사이드스텝)", rx: "20초 × 2회", cue: "선 간격 1m, 가운데 선을 넘고 좌우 선을 밟거나 넘을 때마다 1점" },
]
// ---- 맨몸 (팀 필수, 점프 없음): 상체·코어·핸드스탠드 / 하체·발목·균형
function bwPlan(c, w, o, out, h, upper) {
  const { fx, mods, novice } = c;
  out.kind = upper ? "맨몸 상체·코어" : "맨몸 하체·균형"; out.minutes = 40;
  const two = LIGHT(w);
  out.title = upper ? "맨몸 상체" : "맨몸 하체";
  const kneeLow = mods.some(m => m.area === "knee" && m.stage <= 2);
  const ankleLow = mods.some(m => m.area === "ankle" && m.stage === 1);
  const legLow = kneeLow || ankleLow;
  const items = (upper ? BW_U : BW_L).map(x => {
    let name = x.name, rx = (HEAVY(w) && x.rx2) ? x.rx2 : x.rx, cue = x.cue, mod = "";
    if (x.key === "hs") return hsItem(c, "8분");
    if (x.key === "walk") return walkItem(c);
    if (x.key === "hollow" && (c.noExt || (fx.back && fx.back <= 2))) return { name: "할로우 홀드 · 버드독", rx: "3×20초 · 2×8 (좌우)", cue: "허리 젖히는 동작 대신", mod: "허리" };
    if (upper && x.key === "pike" && fx.handstandMax < 1) return { name: "엎드려 Y·T·W · 밴드 외회전", rx: "각 2×10", mod: "손목 통증" };
    if (upper && x.key === "pike" && fx.noOverhead) return { name: "견갑 푸시업 · 엎드려 Y·T·W", rx: "각 2×10", mod: "어깨 통증" };
    if (upper && x.key === "pull" && fx.noOverhead) return { name: "인버티드 로우 (통증 없는 범위)", rx: two ? "2×8" : "3×8", cue: "견갑부터 당기기", mod: "어깨" };
    if (upper && x.key === "push" && fx.handstandMax < 1) { name = "푸시업 (덤벨 손잡이 잡고)"; mod = "손목 통증"; }
    if (!upper && legLow && ["split", "latl", "pistol"].includes(x.key)) return x.key === "pistol" ? { name: "벽 기대 앉기 (무릎 60–90°)", rx: "4×45초", cue: "통증 5 이하로", mod: kneeLow ? "무릎 통증" : "발목 통증" } : null;
    if (!upper && x.key === "side" && fx.noCph) return { name: "사이드 플랭크 (짧게)", rx: "2×20초 (좌우)", mod: "사타구니 재활" };
    if (!upper && ankleLow && ["ybal", "catch", "calf"].includes(x.key)) return null;
    if (!upper && x.key === "nordic" && (novice || o.noNordic || fx.noNordic)) return null;
    if (two || (!upper && !o.offSeason)) rx = String(rx).replace(/^3×/, "2×"); // 시즌 중 맨몸 하체는 2세트 (정규 훈련·웨이트 A와 겹침)
    return { name, rx, cue, mod };
  }).filter(Boolean);
  h.add({ key: "warm", title: "워밍업 5분", items: [{ name: "가볍게 조깅 · 동적 스트레칭", rx: "3분" }, ...(upper ? [] : [{ ...CORE_WARM }]), upper ? { name: "어깨 밴드 · Y·T · 오픈북", rx: "2분" } : fx.ankle === 1 ? { name: "발목 알파벳 그리기", rx: "2분", mod: "발목 통증" } : { name: "한 발 서기 (좌우)", rx: "2분" }] });
  h.add({ key: "bw", title: upper ? "맨몸 상체·코어·핸드스탠드" : "맨몸 하체·발목·균형", items });
  if (!upper && w !== PH.TAPER) h.add(posBlock(c, "bwL"));
  h.add(prevBlock(c, upper ? "bwU" : "bwL"));
  h.add(measBlock(c, upper ? "bwU" : "bwL"));
  h.add(h.rehabBlock("재활 운동", m => (m.area === "knee" && m.stage === 1) || (m.area === "finger" && m.stage <= 2) || (m.area === "ankle" && m.stage <= 2) || (m.area === "shoulder" && m.stage === 1) || (m.area === "back" && m.stage <= 2)));
}

/* ---------- 1년 주기 (3월 → 다음 해 2월) ----------
 * 학기마다 요일 배치가 바뀐다: 남자부 정규 훈련 1학기 월·목, 2학기 수·금.
 * 원칙: 무거운 하체·점프(A)는 정규 훈련 이틀 이상 전, 상체(B)는 정규 훈련 전날, 일요일은 쉼.
 * 단계(PH): 시즌 첫 주 적응 → 기초 근력 → (3–4주마다) 회복 주 → 근력·파워 3주 → 피크 1주 → 대회 주.
 *   다음 주요 대회까지 남은 주(k)로 거꾸로 센다: k1 피크 · k2–4 근력·파워 · k5 회복 · 그 앞은 기초 근력(4주마다 회복).
 *   주요 대회 다음 주는 회복 주, 그다음은 기초 근력 (다음 시즌 준비).
 * 9인제·기타 대회 주는 컨디셔닝 주간 (대회 주처럼 줄이고, 끝나면 원래 흐름으로).
 * 겨울 방학(비시즌)은 자동: 2학기 종강일(보강 기간 끝) ~ 2월 말. 첫 주는 자유, 그다음은 볼 대신 몸 만들기:
 *   웨이트 주 4회(A·B·A·B) + 맨몸 2회, 기초 근력 3주 → 회복 → 근력·파워 3주 → 회복을 반복.
 * 여름 방학은 대회가 많아 비시즌으로 두지 않는다. */
const SLOT_WEEK = {
  S1: ["team", "bwL", "gymB", "team", "gymA", "bwU", "rest"],
  S2: ["gymA", "bwU", "team", "gymB", "team", "bwL", "rest"],
  OFF: ["gymA", "gymB", "bwU", "gymA", "gymB", "bwL", "rest"], // 비시즌: 웨이트 주 4회 (볼 대신 몸 만들기)
};
const TEAM_DAYS = { S1: "월·목", S2: "수·금" };
// 우리 팀의 그 학기 요일 배치 (여자부는 학기를 바꿔 씀)
const flipSem = sem => sem === "S1" ? "S2" : sem === "S2" ? "S1" : sem;
const weekOf = sem => SLOT_WEEK[TEAM.swap ? flipSem(sem) : sem];
const teamDaysOf = sem => TEAM_DAYS[TEAM.swap ? flipSem(sem) : sem];
const EVENT_KINDS = { major: "주요 대회", minor: "9인제·기타 대회", tryout: "트라이아웃", termend: "2학기 종강", off: "비시즌·방학" };
const DAY_MS = 864e5;
const dParse = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const dIso = t => new Date(t).toISOString().slice(0, 10);
const dAdd = (s, n) => dIso(dParse(s) + n * DAY_MS);
const dDiff = (a, b) => Math.round((dParse(a) - dParse(b)) / DAY_MS); // a − b (일)
const mondayOf = s => dAdd(s, -((new Date(dParse(s)).getUTCDay() + 6) % 7));
const semesterOf = mon => { const m = Number(dAdd(mon, 3).slice(5, 7)); return m >= 3 && m <= 8 ? "S1" : "S2"; };
function semesterStart(mon) {
  const th = dAdd(mon, 3), y = Number(th.slice(0, 4)), m = Number(th.slice(5, 7));
  return mondayOf(dAdd(m >= 3 && m <= 8 ? `${y}-03-01` : m >= 9 ? `${y}-09-01` : `${y - 1}-09-01`, 3));
}
// 겨울 방학(비시즌)은 자동: 2학기 종강일(일정의 '2학기 종강' = 학사일정의 보강 기간 마지막 날) ~ 2월 말. 없으면 12/21부터.
// 여름 방학은 대회가 많아 비시즌으로 두지 않는다 (1학기 흐름을 그대로 이어감).
function autoOffs(evs) {
  const out = [];
  for (let y = 2025; y <= 2035; y++) {
    const te = evs.filter(e => e.kind === "termend" && e.start.slice(0, 4) === String(y) && e.start.slice(5, 7) >= "11").map(e => e.start).sort()[0];
    out.push({ name: "겨울 방학", kind: "off", start: te || `${y}-12-21`, end: dAdd(`${y + 1}-03-01`, -1), auto: true });
  }
  // 관리자가 직접 넣은 방학과 겹치면 그쪽을 쓴다
  return out.filter(a => !evs.some(e => e.kind === "off" && e.start <= a.end && e.end >= a.start));
}
const normEvents = events => {
  const evs = (events || []).filter(e => e && e.start && e.kind)
    .map(e => ({ ...e, end: !e.end || e.end < e.start ? e.start : e.end }));
  return (evs.some(e => e.auto) ? evs : evs.concat(autoOffs(evs))).sort((a, b) => a.start.localeCompare(b.start));
};
// 다음(또는 진행 중인) 주요 대회
const nextMajor = (events, date) => normEvents(events).find(e => e.kind === "major" && e.end >= date) || null;

// 주 하나의 흐름: 기준 주(학기 시작·방학·대회 뒤), 다음 주요 대회까지 남은 주, 단계 w
function weekPhase(mon, evs) {
  const sun = dAdd(mon, 6), th = dAdd(mon, 3);
  const comp = evs.some(e => (e.kind === "major" || e.kind === "minor") && e.start <= sun && e.end >= mon);
  const resets = evs.filter(e => (e.kind === "off" || e.kind === "major") && e.end < mon).map(e => mondayOf(dAdd(e.end, 1)));
  const reset = [semesterStart(mon), ...resets].filter(x => x <= mon).sort().at(-1);
  const since = Math.floor(dDiff(mon, reset) / 7);
  const nm = evs.find(e => e.kind === "major" && e.end >= mon) || null;
  const k = nm ? Math.floor(dDiff(mondayOf(nm.start), mon) / 7) : null;
  const offBetween = !!nm && evs.some(e => e.kind === "off" && e.end >= mon && e.start < nm.start);
  const off = evs.some(e => e.kind === "off" && e.start <= th && th <= e.end);
  const postMajor = since === 0 && evs.some(e => e.kind === "major" && mondayOf(dAdd(e.end, 1)) === reset);
  const tryoutWeek = evs.some(e => e.kind === "tryout" && e.start <= sun && e.end >= mon);
  let w;
  if (comp) w = PH.TAPER;
  else if (since === 0) w = postMajor ? PH.DELOAD : PH.INTRO;
  else if (tryoutWeek) w = PH.INTRO;
  else if (nm && k >= 1 && !offBetween) w = k === 1 ? PH.PEAK : k <= 4 ? PH.POWER : k === 5 ? PH.DELOAD : ((k - 6) % 4 === 3 ? PH.DELOAD : PH.BASE);
  else w = since % 4 === 0 ? PH.DELOAD : PH.BASE;
  if (since <= 2 && w === PH.DELOAD && !postMajor) w = PH.BASE; // 시즌 시작 직후엔 회복 주 없이
  // 9인제·기타 대회(컨디셔닝 주간) 바로 앞뒤 주는 회복 주 대신 기초 근력 — 쉬운 주가 몰리지 않게
  const minorNear = evs.some(e => e.kind === "minor" && e.start <= dAdd(sun, 7) && e.end >= dAdd(mon, -7));
  if (w === PH.DELOAD && !postMajor && minorNear) w = PH.BASE;
  return { reset, since, k, nm, offBetween, off, comp, w, postMajor };
}
/* 측정 주 — 한 달에 한 번 (트라이아웃식 신체 능력, 15분 안쪽): 버티컬 · 맥스 버티컬 · 반복 옆뛰기 20초 (리치는 처음 한 번)
 *  그 달에서 회복 주·적응 주를 먼저 고르고, 없으면 첫 주. 대회 주·피크 주·대회 뒤 회복 주·방학 첫 주는 피한다. */
const _measureCache = new Map();
function measureWeeks(mon, evs) {
  // 한 시즌(3월 → 다음 해 2월) 전체를 한 번에 계산해 두고 재사용 (앞 달의 선택은 뒤 달에 영향받지 않음)
  const y = Number(mon.slice(0, 4)), sy = Number(mon.slice(5, 7)) >= 3 ? y : y - 1, ys = mondayOf(`${sy}-03-01`);
  const key = sy + "|" + evs.map(e => e.kind + e.start + e.end).join(",");
  if (_measureCache.has(key)) return _measureCache.get(key);
  const out = new Map();
  const monthOf = m => dAdd(m, 3).slice(0, 7), lastOfMonth = `${sy + 1}-02`;
  const months = new Map(), start = monthOf(ys) < ys.slice(0, 5) + "03" ? dAdd(ys, 7) : ys;
  for (let m = start; monthOf(m) <= lastOfMonth; m = dAdd(m, 7)) { const k = monthOf(m); if (!months.has(k)) months.set(k, []); months.get(k).push(m); }
  let last = null;
  for (const ws of months.values()) {
    const ok = ws.filter(m => {
      const ph = weekPhase(m, evs);
      if (ph.comp || ph.postMajor || ph.w === PH.TAPER || ph.w === PH.PEAK) return false;
      if (evs.some(e => e.kind === "tryout" && e.start <= dAdd(m, 6) && e.end >= m)) return false;
      const off = evs.find(e => e.kind === "off" && e.start <= dAdd(m, 3) && dAdd(m, 3) <= e.end);
      return !(off && dDiff(m, mondayOf(off.start)) < 7) && (!last || dDiff(m, last) >= 21); // 방학 첫 주는 자유 · 측정 사이 3주 이상
    });
    if (!ok.length) continue;
    const pick = ok.find(m => [PH.DELOAD, PH.INTRO].includes(weekPhase(m, evs).w)) || ok[0];
    out.set(pick, "basic"); last = pick;
  }
  if (_measureCache.size > 500) _measureCache.clear();
  _measureCache.set(key, out);
  return out;
}
// 다음 측정 주 (오늘 주 포함, 최대 30주 앞까지) → { mon, type }
function nextMeasure(date, events) {
  const evs = normEvents(events);
  for (let i = 0, m = mondayOf(date); i < 30; i++, m = dAdd(m, 7)) { const t = measureWeeks(m, evs).get(m); if (t) return { mon: m, type: t }; }
  return null;
}
// 날짜 하나 → { slot, w, 학기, 그 주 대회, 라벨 … }
// 같은 일정·같은 날은 계산 결과를 재사용 (화면을 그릴 때 수백 번 불림)
const _sdCache = new WeakMap();
function seasonDay(date, events) {
  if (events && typeof events === "object") {
    let m = _sdCache.get(events); if (!m) { m = new Map(); _sdCache.set(events, m); }
    const k = date + (TEAM.swap ? "w" : "m"), hit = m.get(k);
    if (hit) return { ...hit };
    const r = seasonDayRaw(date, events); m.set(k, r); return { ...r };
  }
  return seasonDayRaw(date, events);
}
function seasonDayRaw(date, events) {
  const evs = normEvents(events);
  const mon = mondayOf(date), sun = dAdd(mon, 6), d = dDiff(date, mon);
  const on = k => evs.find(e => e.kind === k && e.start <= date && date <= e.end);
  const comps = evs.filter(e => (e.kind === "major" || e.kind === "minor") && e.start <= sun && e.end >= mon);
  const weekEvent = comps.find(e => e.kind === "major") || comps[0] || null;
  const sem = semesterOf(mon);
  const info = { date, mon, d, sem, slot: weekOf(sem)[d], w: 1, event: null, weekEvent, optional: false, label: "", nordicHere: false, noNordic: false, measure: measureWeeks(mon, evs).get(mon) || false, phase: 0 };
  const wp = weekPhase(mon, evs);
  info.w = wp.w; info.postMajor = wp.postMajor;
  info.label = sem === "S1" ? "1학기" : "2학기";
  if (weekEvent) info.label = (weekEvent.kind === "major" ? "대회 주 · " : "컨디셔닝 주간 · ") + weekEvent.name;
  else if (wp.postMajor) info.label = "대회 뒤 회복 주";

  const comp = evs.find(e => (e.kind === "major" || e.kind === "minor") && e.start <= date && date <= e.end);
  const off = on("off"), tryout = on("tryout");
  if (comp) {
    return { ...info, slot: "match", event: comp, dayNo: dDiff(date, comp.start) + 1, days: dDiff(comp.end, comp.start) + 1 };
  }
  if (tryout) return { ...info, slot: "tryout", event: tryout, w: PH.INTRO, measure: false, label: "트라이아웃 주" };
  if (off) {
    const wk = Math.floor(dDiff(mon, mondayOf(off.start)) / 7);
    // 비시즌: 종강 첫 주는 자유, 그다음은 웨이트 집중 (기초 근력 3주 → 회복 → 근력·파워 3주 → 회복 …)
    const r = { ...info, measure: false, event: off, offSeason: true, label: `${off.name} · 몸 만들기` };
    if (wk <= 0) return { ...r, optional: true, free: true, slot: "rest", w: PH.DELOAD, label: `${off.name} · 자유 주` };
    const ow = [PH.BASE, PH.BASE, PH.BASE, PH.DELOAD, PH.POWER, PH.POWER, PH.POWER, PH.DELOAD][(wk - 1) % 8];
    return { ...r, slot: SLOT_WEEK.OFF[d], w: ow, second: d === 3 };
  }
  if (weekEvent) {
    const base = info.slot;
    if (date > weekEvent.end) return { ...info, slot: base === "team" || base === "rest" ? base : "recover" };
    const dt = dDiff(weekEvent.start, date);
    if (base === "team") return { ...info, light: dt === 1 };
    if (dt === 1 && base !== "rest") return { ...info, slot: "prep" };
    if ((base === "gymA" || base === "gymB") && dt <= 3) return { ...info, slot: "act" };
    // 대회 2–3일 전에 웨이트 날이 없으면 맨몸 날을 활성화로
    const gymNear = [2, 3].some(x => { const j = dDiff(dAdd(weekEvent.start, -x), mon); return j >= 0 && j < 7 && /^gym/.test(weekOf(sem)[j]); });
    if (/^bw/.test(base) && dt <= 3 && !gymNear) return { ...info, slot: "act" };
    return info;
  }
  if (sem === "S1") { info.nordicHere = info.slot === "gymA"; info.noNordic = info.slot === "bwL"; }
  return info;
}
// 아침 컨디션 (4문항, 각 1–5 · 높을수록 좋음, 합 4–20) + 전날 세션 RPE → 오늘 회복 버전으로 바꿀지
// Hooper·McLean 설문을 줄인 것 (기분과 스트레스는 한 문항). 선택지는 숫자 대신 말로 고름.
// 합 9 이하이거나 수면·피로·근육통 중 하나라도 가장 나쁨, 또는 전날 RPE 9 이상
const WELL_KEYS = [["sleep", "수면"], ["fatigue", "피로"], ["soreness", "근육통"], ["mood", "기분·스트레스"]];
const WELL_OPTS = {
  sleep: ["거의 못 잤어요", "설쳤어요", "보통", "잘 잤어요", "푹 잤어요"],
  fatigue: ["아주 피곤해요", "피곤해요", "보통", "괜찮아요", "개운해요"],
  soreness: ["많이 아파요", "꽤 뻐근해요", "조금", "거의 없어요", "없어요"],
  mood: ["많이 힘들어요", "스트레스 있어요", "보통", "좋아요", "아주 좋아요"],
};
const WELL_LOW = 9;
function readiness(well, lastRpe) {
  const why = [];
  if (well) {
    const sum = WELL_KEYS.reduce((a, [k]) => a + Number(well[k] || 0), 0);
    if (sum <= WELL_LOW) why.push(`아침 컨디션 ${sum}/20`);
    else { const one = WELL_KEYS.filter(([k]) => ["sleep", "fatigue", "soreness"].includes(k) && Number(well[k]) <= 1).map(([, l]) => l); if (one.length) why.push(`${one.join("·")} 1점`); }
  }
  if (lastRpe != null && lastRpe >= 9) why.push(`어제 RPE ${lastRpe}`);
  return why;
}
const TRAIN_SLOTS = ["gymA", "gymB", "bwU", "bwL"];
/* 고를 수 있는 날: 웨이트·맨몸 날과 정규 훈련 없는 날(관리자 지정).
 * 그날의 '권장'를 보여 주고 선수가 바꿀 수 있다 (예: 헬스장에 못 가면 맨몸). 고른 것에 따라 그 주의 남은 날 권장가 바뀐다.
 * 권장 규칙 (weekFlow)
 *  - 그 주 일정의 웨이트·맨몸 횟수를 목표로, 지금까지 한 것 + 뒤에 남은 일정으로 못 채우는 종류가 있으면 그걸 권장
 *    (하체 웨이트 → 상체 웨이트 → 맨몸 하체 → 맨몸 상체 순, 전날·다음 날과 같은 종류는 피함)
 *  - 정규 훈련 없는 날 기본은 하체 (하체가 가장 중요). 다음 날이 정규 훈련이거나 앞뒤가 하체면 상체 → 맨몸
 *  - 대회 주는 바꾸지 않고, 정규 훈련 없는 날은 회복 */
const PICKS = {
  lower: { label: "하체", slot: "gymA" },
  upper: { label: "상체", slot: "gymB" },
  core: { label: "맨몸", slot: "bw" },
  recover: { label: "회복", slot: "recover" },
};
const KEY_OF = { gymA: "lower", gymB: "upper", bwU: "core", bwL: "core", recover: "recover" };
const FLOW_NAME = { gymA: "하체 웨이트", gymB: "상체 웨이트", bwU: "맨몸 상체", bwL: "맨몸 하체" };
// 고른 것 → 그날 슬롯. 맨몸은 원래 하체 날이면 맨몸 하체, 상체 날이면 맨몸 상체
function resolvePick(pick, base, near) {
  if (pick === "lower") return "gymA";
  if (pick === "upper") return "gymB";
  if (pick === "recover") return "recover";
  if (base === "gymA" || base === "bwL") return "bwL";
  if (base === "gymB" || base === "bwU") return "bwU";
  return (near || []).includes("bwU") ? "bwL" : "bwU";
}
// days: 월–일 [{ slot (일정), off (정규 훈련 없음), pick (고른 것), event (대회 주) }] → 날마다 { rec (권장 슬롯), why, slot (실제) }
function weekFlow(days) {
  const TR = x => TRAIN_SLOTS.includes(x);
  const cnt = arr => arr.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
  // 교류전이 웨이트 날을 차지하면 그 웨이트는 다른 날로 (base = 원래 일정)
  const target = cnt(days.map(d => d.base || d.slot).filter(TR));
  const fr = days.some(d => d.slot === "friendly");
  const eff = [], out = [];
  days.forEach((d, i) => {
    const flex = TR(d.slot) || (d.slot === "team" && d.off);
    if (!flex) { eff[i] = d.slot; out[i] = null; return; }
    const prev = eff[i - 1], nx = days[i + 1], next = nx ? (nx.off ? "pick" : nx.slot) : null;
    const clash = x => prev === x || next === x || (x === "gymA" && (next === "team" || next === "friendly" || prev === "friendly" || prev === "gymA" || next === "gymA"));
    const nearFriendly = d.slot === "gymA" && (next === "friendly" || prev === "friendly"); // 교류전 앞뒤 날 하체 웨이트는 옮김
    let rec = null, why = "";
    if (d.event) rec = TR(d.slot) ? d.slot : "recover";
    else {
      const done = cnt(eff.slice(0, i).filter(TR)), later = cnt(days.slice(i + 1).filter(x => TR(x.slot)).map(x => x.slot));
      const missing = Object.keys(target).filter(k => target[k] - (done[k] || 0) - (later[k] || 0) > 0);
      if (fr && /^bw/.test(d.slot) && missing.includes("gymA") && !clash("gymA") && !(done.gymA >= 2)) { rec = "gymA"; why = "교류전 때문에 하체 웨이트를 이날로"; }
      else if (TR(d.slot) && !nearFriendly && (missing.includes(d.slot) || !missing.length)) rec = d.slot;
      else {
        const m = ["gymA", "gymB", "bwL", "bwU"].find(x => missing.includes(x) && !clash(x));
        if (m) { rec = m; why = `이번 주 ${FLOW_NAME[m]} 아직`; }
        else if (nearFriendly) { rec = ["gymB", "bwU", "bwL"].find(x => !clash(x)) || "recover"; why = "교류전 앞뒤라 하체 웨이트는 다른 날로"; }
      }
      // 같은 웨이트가 그 주에 이미 2번이면 다른 걸로 (하체 웨이트 3번은 많음)
      const twice = x => (x === "gymA" || x === "gymB") && (done[x] || 0) + (later[x] || 0) >= 2;
      if (!rec) rec = TR(d.slot) && !nearFriendly ? d.slot : (["gymA", "gymB", "bwU", "bwL"].find(x => !clash(x) && !twice(x)) || "recover");
    }
    eff[i] = d.pick && PICKS[d.pick] ? resolvePick(d.pick, TR(d.slot) ? d.slot : rec, [prev, next]) : rec;
    out[i] = { rec, why, slot: eff[i] };
  });
  return out;
}
const choicesFor = (rec, slot) => Object.entries(PICKS).map(([key, v]) => ({ key, label: v.label, rec: KEY_OF[rec] === key, sel: KEY_OF[slot] === key }));
function planForDay(ctx, info) {
  let i = info;
  const p = ctx.player || {};
  // 고를 수 있는 날: 권장(그 주 흐름) 또는 선수가 고른 것으로
  let flow = null;
  const flex = !!p.pos && (TRAIN_SLOTS.includes(i.slot) || (i.slot === "team" && i.teamOff));
  if (flex || (i.slot === "team" && i.teamOff)) {
    flow = info.flow || { rec: i.teamOff ? (i.w === PH.TAPER || i.light ? "recover" : "gymA") : i.slot, why: "" };
    let rec = flow.rec;
    // 정규 훈련 없는 날 하체 권장인데 무릎·발목이 많이 아프면 상체로
    if (i.teamOff && rec === "gymA" && p.pos) { const fx = prepCtx(ctx).fx; if ((fx.knee && fx.knee <= 2) || fx.ankle === 1) rec = "gymB"; }
    const pk = ctx.pick && PICKS[ctx.pick];
    const slot = pk ? resolvePick(ctx.pick, i.teamOff ? rec : i.slot, i.near) : rec;
    flow = { ...flow, rec, slot };
    if (slot !== i.slot) i = { ...i, slot, measure: false, second: false, picked: ctx.pick || null };
  }
  const rel = relOf(ctx);
  // 개인 단계: 웨이트 입문이거나 상대 근력 0.8 미만이면 근력·파워 대신 기초 근력, 피크 대신 회복 주 (기초가 먼저)
  const weak = !!p.pos && (p.weightExp === "none" || (rel != null && rel < 0.8));
  if (weak && TRAIN_SLOTS.includes(i.slot) && (i.w === PH.POWER || i.w === PH.PEAK)) i = { ...i, w: i.w === PH.POWER ? PH.BASE : PH.DELOAD, shifted: true };
  // 오늘 컨디션이 낮으면 회복 버전
  const low = ctx.ready ? readiness(ctx.ready.well, ctx.ready.lastRpe) : [];
  if (low.length && TRAIN_SLOTS.includes(i.slot) && i.w !== PH.TAPER) i = { ...i, w: PH.DELOAD, lowReady: true };
  let out = slotPlan(ctx, i.slot, i.w, i);
  // 팀 운동이 먼저: 재활·부상 때문에 팀 블록을 바꾸지 않고, 재활은 남는 시간에 개인 칸으로 더함.
  // 쉴 때도 아픈 가장 심한 단계만 예외로 빼 둠 (그 운동은 '통증 있으면 빼기'로 표시)
  if (p.pos && !(out.mods || []).some(m => m.stage === 1) && ((out.mods || []).length || (ctx.injuries || []).length || (p.adjust && Object.keys(p.adjust).length))) {
    const clean = slotPlan({ ...ctx, injuries: [], pain: null, checks: [], rehab: [], player: { ...p, adjust: {} } }, i.slot, i.w, i);
    const mine = new Map(out.blocks.map(b => [b.key, b]));
    const teamBlocks = clean.blocks.filter(b => !b.scope).map(b => {
      const m = mine.get(b.key), have = new Map(((m && m.items) || []).map(x => [x.name, x]));
      return { ...b, items: b.items.map(x => have.get(x.name) || { ...x, mod: "통증 있으면 빼기" }) };
    });
    out = { ...out, blocks: [...teamBlocks, ...out.blocks.filter(b => b.scope)], landings: clean.landings };
  }
  // 트레이닝 담당이 바꾼 박스 (날 종류 · 블록마다 빼기/추가, 팀 전체 → 그 선수 순서로)
  const eds = (ctx.edits || []).filter(e => e && e.slot === i.slot);
  if (eds.length) {
    for (const b of out.blocks) {
      const rem = new Set(eds.filter(e => e.op === "remove" && e.block === b.key).map(e => e.name));
      if (rem.size) b.items = b.items.filter(x => !rem.has(x.name));
      for (const e of eds.filter(e => e.op === "add" && e.block === b.key)) b.items.push({ name: e.name, rx: e.rx || "", cue: e.cue || "", mod: e.pid ? "개인" : "", edit: e.id });
    }
    const keys = new Set(out.blocks.map(b => b.key));
    for (const [key, me, title] of [["extra", false, "추가 운동"], ["extra-me", true, "개인 추가"]]) {
      const its = eds.filter(e => e.op === "add" && e.block === key && !keys.has(key));
      if (its.length) out.blocks.push({ key, ...(me ? { scope: "me" } : {}), title, items: its.map(e => ({ name: e.name, rx: e.rx || "", cue: e.cue || "", mod: e.pid ? "개인" : "", edit: e.id })) });
    }
    out.blocks = out.blocks.filter(b => b.items.length);
  }
  if (i.lowReady && info.measure) out.notes.push("컨디션 낮음 · 측정 미루기");
  if (i.lowReady) { out.title = slotPlan(ctx, i.slot, info.w, info).title + " · 가볍게"; out.notes.unshift(`컨디션 낮음 (${low.join(", ")})`); }
  if (i.shifted && !i.lowReady) out.notes.unshift("기초 근력 먼저");
  // 관리자 개인 조정: 빼기 · 바꾸기 · 메모
  const cu = ctx.custom || {};
  const skip = (cu.skip || []).map(x => String(x).trim()).filter(Boolean);
  const swap = (cu.swap || []).filter(x => x && x.from && x.to);
  if (skip.length || swap.length) {
    for (const b of out.blocks) {
      b.items = b.items.filter(x => !skip.some(k => x.name.includes(k))).map(x => {
        const s = swap.find(v => x.name.includes(v.from));
        if (!s) return x;
        const rx = s.rx || String(x.rx ?? "").replace(/ · 약 [\d.]+kg( \(한 손\))?/, "");
        return { ...x, name: s.to, rx: rx + loadFor({ e1rm: null, e1rmName: ctx.e1rmName }, s.to, rx, i.w), mod: "관리자 조정", cue: s.cue || "" };
      });
    }
    out.blocks = out.blocks.filter(b => b.items.length);
  }
  // 관리자가 추가한 운동: 적용할 날 종류(all = 웨이트·맨몸·활성화·정규 훈련 날)마다 '관리자 추가' 블록으로
  const ADD_ON = { all: ["gymA", "gymB", "bwU", "bwL", "act", "team"], gymA: ["gymA"], gymB: ["gymB"], bw: ["bwU", "bwL"], team: ["team"] };
  const adds = (cu.add || []).filter(x => x && x.name && (ADD_ON[x.on || "all"] || []).includes(i.slot));
  if (adds.length) out.blocks.push({ key: "custom", scope: "me", title: "관리자 추가", items: adds.map(x => ({ name: x.name, rx: x.rx || "", cue: x.cue || "", mod: "관리자" })) });
  if (cu.memo) out.notes.unshift(cu.memo);
  if (flow) {
    out.choices = choicesFor(flow.rec, flow.slot);
    out.picked = ctx.pick || null;
    if (info.absent) out.title = `불참 · ${out.title}`;
    else if (info.teamOff) { out.title = `정규 훈련 없음 · ${out.title}`; if (info.teamOffNote) out.notes.unshift(`정규 훈련 없음 · ${info.teamOffNote}`); }
  }
  if (info.absent && !flow) out.title = `불참 · ${out.title}`;
  // 어깨 밴드 루틴: 화요일, 못 했으면 일요일 쉬는 날에 선택 (어깨 재활 중이면 재활 블록이 대신)
  const shoulderRehab = (out.mods || []).some(m => m.area === "shoulder" && m.stage <= 2);
  if (!shoulderRehab && !["match", "prep", "tryout"].includes(out.slot)) {
    if (info.d === 1) out.blocks.push({ key: "band", title: "어깨 밴드", items: BAND_SHOULDER.map(x => ({ ...x })) });
    else if (info.d === 6) out.blocks.push({ key: "band", title: "어깨 밴드 (화요일에 못 했으면)", items: BAND_SHOULDER.map(x => ({ ...x })) });
  }
  out.season = info;
  return out;
}

// 예전 방식(2학기, 서울대배가 4주차 토·일) — 엔진 시험용
function dayPlan(ctx, w0, d) {
  const w = [PH.INTRO, PH.BASE, PH.POWER, PH.TAPER][w0];
  const o = { measure: w0 === 0 ? "full" : false };
  let slot = SLOT_WEEK.S2[d];
  if (w === PH.TAPER) {
    if (d >= 5) return slotPlan(ctx, "match", w, { event: { name: "서울대배", kind: "major" }, dayNo: d - 4, days: 2, weekEvent: { kind: "major" } });
    if (d === 3) slot = "act";
    if (d === 4) o.light = true;
    o.weekEvent = { kind: "major" };
  }
  return slotPlan(ctx, slot, w, o);
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
  const main = plan.blocks.find(b => ["plyo", "str", "thu", "act", "team", "match", "bw", "prep", "test", "rest"].includes(b.key));
  return { kind: plan.kind, title: plan.title, landings: plan.landings, items: main ? main.items.length : 0 };
}

if (typeof module !== "undefined") module.exports = { TEAM, setTeam, weekOf, teamDaysOf, fmtRx, painStage, normPain, PAIN_AREAS, STAGE_NAMES, STAGE_HINT, PAIN_RULE, NEXT_RULE, painLabel, dayPlan, daySummary, slotPlan, PH, PHASE_NAMES, POS_EXTRA, readiness, WELL_KEYS, WELL_OPTS, WELL_LOW, PICKS, weekFlow, resolvePick, relOf, baseName, e1rmOf, LIFT_OF, JUMP_RE, seasonDay, planForDay, measureWeeks, nextMeasure, HS_GOAL, INJ_PART_LABEL, FINGERS, PAIN_SEV, nextMajor, normEvents, mondayOf, dAdd, dDiff, SLOT_WEEK, EVENT_KINDS, HANDSTAND, HS_STAGES, effectiveModules, moduleEffects, relStrength, REHAB, REHAB_AREAS, DAYS, POS, POS_ORDER };
