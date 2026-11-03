# SNUVT 피지컬 보드

- 원본: https://claude.ai/artifact/AYJXDbgED3hGvBPgoiGgCc (HTML 페이지 artifact, 버전 1792646717-a49c)
- 보관: 2026-11-03 (원본 삭제 전 사본)

---

> **보관 메모**: 이 artifact는 문서가 아니라 인터랙티브 웹 페이지(HTML + JavaScript)다. 화면에 보이는 글 대부분은 스크립트가 데이터와 규칙으로 만들어 낸다. 그래서 이 사본은 (1) 화면별로 보이는 고정 문구와 처방 데이터·규칙을 읽을 수 있게 정리한 부분과 (2) 맨 끝의 원본 HTML 소스 전체로 이루어져 있다. 소스를 `.html` 파일로 저장하면 페이지 모양과 동작을 그대로 다시 볼 수 있다(팀 데이터 연결은 artifact 런타임 전용).
>
> 페이지가 쓰던 공유 데이터베이스(`players`, `tests`, `health`, `logs`, `settings` 컬렉션)는 HTML에 들어 있지 않다. 보관 시점 설정값(`settings/main`)은 아래 "기준값"과 같다: 대회 이름 서울대배, 블록 시작 2026-10-26, 대회 2026-11-21–22.

## 화면 구성

- 상단: **SNUVT 피지컬 보드** 제목, 이번 주 표시(예: "1주차 · 측정 · 동작 익히기" / "블록 시작 전" / "블록 종료"), 대회 D-day(예: "서울대배까지 D-n" / "대회 중" / "서울대배 종료")
- 탭: **이번 주** · **선수별 처방** · (피지컬 담당자만) **등록·측정** · **훈련 부하** · **워밍업·원칙**

## 기준값

- 남자부 네트 높이: 243cm
- 기본 설정: 대회 이름 서울대배, 블록 시작 2026-10-26, 대회 시작 2026-11-21, 대회 종료 2026-11-22
- 포지션: OH 아웃사이드, MB 미들블로커, OP 아포짓, S 세터, Li 리베로 (표시 순서 OH → MB → OP → S → Li)

**4주 블록 트랙**

| 주차 | 목표 |
|---|---|
| 1주차 | 측정 · 동작 익히기 |
| 2주차 | 발달 |
| 3주차 | 발달 · 최고 강도 |
| 4주차 | 감량 · 대회 |
| 서울대배 (11/21–11/22) | 토 조별리그 2경기 · 일 최대 4경기 |

## 이번 주 화면

- 제목: "<주차> · <목표>"
- 안내: "월 <날짜> 세션 A (점프 + 하체 근력) · 목 <날짜> 세션 B (점프 적은 날) · 수·금 팀 훈련 전 워밍업 15분" (4주차에는 목요일이 "활성화 30분")
- 1주차 안내: "10/26(월)은 측정·접수 날이에요. 측정 후 남는 시간에 세션 A의 1주차 처방을 가볍게 해요."
- 4주차 안내: "대회 주예요. 양은 줄이고 무게와 점프 강도는 지켜요. 새로운 운동은 넣지 않아요."
- 포지션별로 선수 카드: 이름, 학년 · 키(없으면 "키 미입력"), 포지션 칩, CMJ(첫 측정 대비 변화), 네트 위 (블록) = 블록 리치 − 243, 월 착지 수, 상태 칩, "이번 주 처방 보기 →"
- 빈 상태 문구:
  - "선수 명단을 불러오는 중 / 잠시만 기다려 주세요."
  - "아직 등록된 선수가 없어요" + (담당자) "‘등록·측정’에서 주전부터 추가하면 이 화면에 포지션별 카드가 생겨요." [선수 등록하기] / (그 외) "피지컬 담당자가 선수를 등록하면 여기에 처방이 나타나요."
  - 연결 실패: "팀 데이터에 연결하지 못했어요 / claude.ai에 로그인한 상태로 이 페이지를 열면 선수 명단과 처방이 나타나요. 워밍업·원칙 화면은 지금도 볼 수 있어요." [워밍업·원칙 보기]

**상태 칩 (flags)**

- 담당자 화면(건강 정보 열람 시): 무릎/어깨/발목/허리 통증 3/10 이상 → "<부위> 통증 n/10"(빨강), 발목 염좌 이력 → "발목 염좌 이력 n회", 무릎 부상 이력 → "무릎 부상 이력"
- 그 외: "점프 대체 (등척성)", "점프 보류", "머리 위 동작 조정", "균형 +1분"
- 공통: 한 발 서기 미통과 → "한 발 서기 미통과", 웨이트 경험 없음 → "웨이트 입문"

## 선수별 처방 화면

선수 선택, 주차 트랙, 상태 칩, 개별 메모, 세션 A·세션 B(또는 활성화) 표, 측정 기록, 세션 기록 폼으로 구성.

### 세션 A · 월 — 점프 블록 (기본 처방)

"워밍업 → 점프 → 근력 순서. 착지 소리가 커지거나 무릎이 안으로 모이면 그 세트는 멈춰요."

| 운동 | 핵심 | 1주차 | 2주차 | 3주차 | 4주차 |
|---|---|---|---|---|---|
| 포고 점프 | 발목 탄성, 무릎은 거의 굽히지 않기 | 2×10 | 2×10 | 2×10 | 1×10 |
| 스쿼트 점프 착지 고정 | 2초 멈춤, 무릎은 발끝 방향 | 2×5 | 3×5 | — | — |
| CMJ 최대 노력 | 팔 스윙, 매 회 최고 높이 | — | 3×4 | 3×4 | 2×3 |
| 연속 제자리멀리뛰기 | 3번 연속, 착지하자마자 다음 | — | 3세트 × 3연속 | 4세트 × 3연속 | 2세트 × 3연속 |
| 포지션별 점프 | 실전 스텝으로 | — | — | 3×3 | 2×2 |

- 포지션별 점프 이름: MB "슬라이드 스텝 후 블록 점프", OP "공격 어프로치 + 블록 번갈아", OH "공격 어프로치 점프", S "점프 토스 테이크오프 (양발 착지)"
- 표 아래 "총 착지 수" = 세트 × 횟수 합계

### 세션 A · 월 — 근력 블록 (기본 처방)

| 운동 | 1주차 | 2주차 | 3주차 | 4주차 |
|---|---|---|---|---|
| 백스쿼트 | 동작 연습 2×8 (가볍게) | 4×5 · RIR 2–3 | 4×4 · RIR 2 · 무게 ↑ | 2×3 · 3주차 무게 유지 |
| 루마니안 데드리프트 (바벨) | 동작 연습 2×8 | 3×6 · RIR 3 | 3×5 · RIR 2 | 2×5 |
| 불가리안 스플릿 스쿼트 (덤벨, 다리당) | — | 3×6 | 3×6 · 무게 ↑ | 1×6 |
| 한 발 카프레이즈 (다리당) | — | 3×12 | 3×12 | 1×12 |
| 햄스트링 컬 머신 | — | 2×8 | 2×8 | — |

"RIR = 세트 끝에 더 할 수 있었던 횟수. 모든 세트를 목표보다 여유 있게 끝냈으면 다음 주 2.5–5kg 올려요."

### 개인별 변형 규칙 (페이지 로직)

- **세터(S)**: CMJ·연속 제자리멀리뛰기 1세트씩 감소(최소 1세트), 표시 "세터 −1세트"
- **리베로(Li)**: CMJ → "옆으로 한 발 바운드 착지 고정"(좌우 번갈아, 착지 2초 고정, 4회) / 연속 제자리멀리뛰기 삭제 / 포지션별 점프 → "측면 스텝 출발 5m"(첫 스텝을 빠르게, 세트 수 × 2회, 착지 없음). 표시 "리베로 대체"
- **한 발 서기 30초 미통과(최근 측정)**: 고강도 점프(CMJ, 연속 멀리뛰기, 포지션별 점프) 제외, 스쿼트 점프 착지 고정이 없으면 추가(4주차 2세트, 그 외 3세트 × 5회, 표시 "고강도 대신"). 메모: "한 발 서기 30초를 통과하지 못해 최대 점프·연속 점프는 보류했어요. 다음 측정에서 통과하면 다시 넣어요."
- **무릎 통증 3/10 이상(점프 대체, iso)**: 점프 블록 전체를 "레그 익스텐션 등척성 버티기"(무릎 약 60°에서 강하게, 세트 간 2분) 5×45초로 대체, 표시 "개별 조정". 메모: "점프 블록 대신 등척성 버티기를 해요. 무릎 통증이 2/10 이하로 내려오면 포고·스쿼트 점프부터 다시 시작해요."
- **발목 통증 3/10 이상(점프 보류, hold)**: 점프 블록 없음. 메모: "이번 주는 점프 블록을 쉬고 근력만 진행해요."
- **웨이트 경험 없음**: 백스쿼트 → "고블릿 스쿼트 (덤벨)", 표시 "입문". 1주차 메모: "웨이트 입문 단계라 첫 세션은 동작 연습만 해요."
- **허리 통증 3/10 이상**: 루마니안 데드리프트 처방에 " · 가볍게, 통증 없는 범위" 추가, 표시 "개별 조정"
- **어깨 통증 3/10 이상(머리 위 동작 조정)**: 세션 B의 물구나무 → "물구나무 대신 견갑·외회전 운동" 10분(통증 없는 범위에서), 덤벨 벤치프레스 3×8 · RIR 3(통증 없는 범위)
- **통증 3/10 이상 어느 부위든(refer)**: 메모 "통증이 이어지면 처방을 줄이고 물리치료사와 상담해요. 시스템은 진단하지 않아요."
- **발목 염좌 이력 있음**: 메모 "워밍업 3번(발목 균형)을 1분 더 해요."
- 등록 시 자동 조정: 발목 통증 ≥3 → 점프 보류, 그 외 무릎 통증 ≥3 → 등척성 대체, 어깨 ≥3 → 머리 위 조정, 허리 ≥3 → 허리 조정, 염좌 횟수 > 0 → 균형 +1분

### 세션 B · 목 (1–3주차)

부제: 1주차 "가볍게 (모든 운동 2세트)", 2주차 "기본 처방", 3주차 "무게만 조금 올림" + "다음 날 팀 훈련이 있어 점프는 포고만 해요."

| 운동 | 처방 | 메모 |
|---|---|---|
| 워밍업 루틴 | 15분 | |
| 포고 점프 | 2×10 | (점프 보류·등척성 대체 선수는 "생략", 개별 조정) |
| 턱걸이 | 3×3–6 | 못 하면 뛰어 올라가 3–5초 동안 내려오기 |
| 덤벨 벤치프레스 | 3×8 · RIR 2 | |
| 한 팔 덤벨 로우 | 3×8 | |
| 바벨 힙 쓰러스트 | 3×8 · RIR 2 | 등을 벤치에 |
| 덤벨 한 발 루마니안 데드리프트 | 2×8 (다리당) | |
| 옆으로 누워 덤벨 외회전 | 2×15 (가볍게) | |
| 물구나무 단계 n | 10분 | 단계별 내용 (세터는 " · 세터는 매 세션 빠짐없이" 추가) |
| 데드버그 · 사이드 플랭크 · 한 손 캐리 | 각 2세트 | |
| (리베로) 월싯 (수비 자세) | 3×30초 | |
| (리베로) 측면 스텝 출발 5m | 6회 | 첫 스텝을 빠르게 |

1주차에는 "3×"로 시작하는 처방을 모두 "2×"로 바꾼다.

**물구나무 단계** (최근 측정의 단계, 기본 1단계)

1. 파이크 버티기 (손은 바닥, 발은 벤치) 30초 × 3
2. 벽 걸어 올라가기 3–5회
3. 벽 물구나무 버티기 20–40초 × 3
4. 벽 물구나무 어깨 터치 → 벽 없이 킥업

### 4주차 목요일 · 활성화 30분

"대회 이틀 전이에요. 근육통이 생길 자극은 넣지 않아요."

| 운동 | 처방 | 메모 |
|---|---|---|
| 워밍업 루틴 | 15분 | |
| 포고 점프 | 1×10 | |
| CMJ 최대 노력 (리베로: 옆으로 한 발 바운드 2×2 / 점프 조정 선수: 레그 익스텐션 등척성 버티기 3×45초) | 2×3 | |
| 백스쿼트 (입문자: 고블릿 스쿼트) | 2×2 · 3주차 무게 | |
| 어깨 밴드 운동 | 워밍업 5번 순서 | 땀이 살짝 날 정도로 끝내기 |

점프 보류 선수는 포고와 CMJ 줄을 뺀다. 세션 B 예상 착지 수: 4주차 16(점프 조정 시 10), 그 외 20(점프 조정 시 0).

### 측정 기록 표

열: 날짜 · CMJ · 블록 리치 · 네트 위 · 어프로치 리치 · 네트 위 · 한 발 서기 L/R(통과/미통과) · 물구나무(단계 · 초). "단위 cm. 네트 위 = 리치 − 243cm (남자부 네트)." 기록이 없으면 "측정 기록이 아직 없어요." (담당자에게는 "‘등록·측정’에서 10/26 측정값을 넣으면 CMJ 변화와 네트 위 높이가 나와요." 추가)

### 세션 기록하기

"훈련이 끝나고 30분 안에 체감 강도(RPE)를 남겨요. 세션 RPE = RPE × 시간(분)."

- 입력: 날짜, 종류, 시간(분), RPE(0–10), 점프·착지 수("모르면 비워두기"), 통증 부위(없음/무릎/어깨/발목/허리), 통증(0–10), 메모("무게, 컨디션 등", 200자)
- 버튼 "기록 저장", 안내 "기록은 본인과 피지컬 담당자만 볼 수 있어요."
- 권한 없음: "이 페이지에서 기록을 남길 권한이 없어요. 피지컬 담당자에게 기록을 전달해 주세요."
- 최근 기록 표(최근 8건): 날짜 · 종류 · RPE×분 · 착지 · 통증. 담당자가 아니면 "이 기기에서 본인이 남긴 기록만 보여요."; 기록이 없으면 "아직 기록이 없어요."

| 종류 | 기본 시간(분) |
|---|---|
| 세션 A (월) | 75 |
| 세션 B (목) | 60 |
| 팀 훈련 | 180 |
| 활성화 | 30 |
| 경기 | 90 |
| 기타 | 60 |

RPE 선택지: 0 휴식, 1 아주 쉬움, 2 쉬움, 3 보통, 4 약간 힘듦, 5 힘듦, 6, 7 매우 힘듦, 8, 9, 10 최대 (기본 5)

## 등록·측정 화면 (피지컬 담당자 전용)

"가입 질문과 측정값을 넣으면 처방이 자동으로 바뀌어요. 부상·통증 정보는 피지컬 담당자(편집 권한)만 볼 수 있어요."

**기본 정보**: 이름(20자), 포지션(OH/MB/OP/S/Li), 학년("예: 3학년"), 키(cm, 140–220), 몸무게(kg, 40–150), 배구 경력(년, 0–20, 0.5 단위), 웨이트 경험(없음 / 6개월 미만 / 6개월 이상)

**부상·통증** (담당자만 열람): 발목 염좌 왼쪽·오른쪽 횟수, 마지막 염좌 시기("예: 2026년 5월"), 무릎·어깨·발목·허리 통증(0–10), 수술 이력·그 외 알아야 할 것, ☐ 무릎 부상 이력 있음, ☐ 선수가 처방 목적의 정보 사용에 동의함(필수)

버튼: "저장" / "선수 추가", "선수 삭제" → "정말 삭제 (기록 포함)"

**측정값 추가**: "같은 폰·같은 앱·같은 바닥으로 측정해요. 비워둔 칸은 저장하지 않아요."

- 날짜, 스탠딩 리치 (한 손, cm), CMJ (cm), 블록 점프 리치 (cm), 어프로치 점프 리치 (cm), 한 발 서기 왼쪽·오른쪽(미측정 / 30초 통과 / 미통과), 물구나무 단계(1 파이크 버티기 / 2 벽 걸어 올라가기 / 3 벽 물구나무 버티기 / 4 어깨 터치·킥업), 물구나무 버티기 (초), 스쿼트 5회 무게 (kg), RDL 5회 무게 (kg), 턱걸이 (회)
- 측정 기록 표: 날짜 · 리치 · CMJ · 블록 · 어프로치 · 균형 L/R · 물구나무 · 스쿼트 · RDL · 턱걸이 · 삭제

## 훈련 부하 화면 (피지컬 담당자 전용)

"주간 세션 RPE 합(RPE × 분, AU)과 기록된 착지 수예요. 전주보다 2배 이상 뛴 칸은 ‘주의’로만 표시해요. ACWR 같은 위험 판정은 근거가 부족해 쓰지 않아요."

- 열: 선수 · 블록 전 · 1주차 · 2주차 · 3주차 · 4주차(각 월요일 날짜)
- 칸: "<합계> AU / <착지>회 · <건수>건", 전주 대비 2배 이상이면 "전주 2배↑" 칩
- 선수가 없으면 "선수를 먼저 등록해 주세요"

## 워밍업·원칙 화면

### 워밍업 루틴 15분

수·금 팀 훈련과 월·목 세션 모두 이 순서로 시작해요. 지금의 긴 몸풀기 앞부분을 바꾸는 것이라 훈련 시간은 늘지 않아요.

| 순서 | 내용 | 시간 | 핵심 |
|---|---|---|---|
| 1 | 조깅, 사이드 셔플, 카리오카, 스킵 | 3분 | 체온 올리기 |
| 2 | 회전 런지, 옆 런지, 다리 앞뒤·옆 스윙 | 3분 | 엉덩이·햄스트링 가동성 |
| 3 | 한 발 서기 30초 (좌·우) → 한 발 홉 착지 고정 5회 (좌·우) | 2분 | 발목 균형 |
| 4 | 스쿼트 점프 착지 고정 5회 | 2분 | 무릎은 발끝 방향, 착지 소리 작게 |
| 5 | 밴드 외회전 2×10, 밴드 벌리기 10, 엎드려 Y·T 각 8, 오픈북 흉추 회전 좌·우 5 | 4분 | 어깨 외회전 근력, 견갑, 흉추 |
| 6 | 어프로치 점프 3회 (70% → 90%) | 1분 | 첫 점프 준비 |

발목 염좌 이력이 있으면 3번을 1분 더 해요. 밴드가 없으면 5번을 ‘엎드려 Y·T·W 들기’로 대신해요.

### 주간 구조

1. **월 · 세션 A** 점프 + 하체 근력. 수요일까지 48시간 회복.
2. **수 · 팀 훈련** 워밍업 루틴만.
3. **목 · 세션 B** 상체·엉덩이·코어·물구나무. 점프는 포고 20회만.
4. **금 · 팀 훈련** 워밍업 루틴만.

빠진 세션은 몰아서 하지 않고, 돌아온 날 그 주의 처방을 그대로 해요.

### 처방 규칙

- 포지션별 점프 양: MB·OP·OH 100%, 세터 −1세트, 리베로는 옆 바운드·측면 스텝으로 대체
- 웨이트 입문 → 백스쿼트 대신 고블릿 스쿼트
- 한 발 서기 30초 미통과 → 최대·연속 점프 보류
- 무릎 통증 3/10 이상 → 점프 대신 등척성 버티기, 전문가 상담 권고
- 대회 주 → 세트·횟수는 줄이고 무게는 유지
- 점프는 세션 초반, 지치기 전에. 훈련 후에는 착지 없는 운동만

### 대회 당일 (11/21–22)

- 경기 전 워밍업 루틴 15분 + 팀 몸풀기
- 경기 사이 옷을 껴입어 체온 유지, 다음 경기 10분 전 스킵·한 발 홉·어프로치 점프 3회로 다시 데우기. 세터는 경기 사이 추가 점프 없음
- 토요일 밤 수면 최우선. 일요일은 최대 4경기라 물과 탄수화물 간식을 미리 챙기기

근거와 설계 과정: [1단계 자료 수집](https://claude.ai/artifact/YKHY7dT6gXMJpkeJS1q1j4) · [2단계 블록 설계](https://claude.ai/artifact/2gjmAXXcdsDTwu8gAvpCjC)

## 저장 오류 문구

- "저장 권한이 없어요. 피지컬 담당자에게 요청해 주세요."
- "저장 공간이 가득 찼어요. 오래된 기록을 지운 뒤 다시 시도해 주세요."
- "저장하지 못했어요. 잠시 후 다시 시도해 주세요."
- 그 외: "팀 데이터에 연결되어 있지 않아요.", "이름을 입력해 주세요.", "측정값을 하나 이상 입력해 주세요.", "로그인한 상태에서만 기록을 남길 수 있어요.", 완료 시 "저장했어요" / "<이름> 선수를 추가했어요" / "측정값을 저장했어요" / "기록했어요" / "선수를 삭제했어요" / "측정값을 삭제했어요" / "기록을 삭제했어요"

## 원본 HTML 소스 (전체)

아래는 보관 시점 버전(1792646717-a49c)의 페이지 소스 전체다. 이 블록을 `.html` 파일로 저장하면 페이지를 다시 열 수 있다.

<details>
<summary>소스 펼치기 (828줄)</summary>

````html
<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>
<title>SNUVT 피지컬 보드</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>
/* Layout: 스코어보드 같은 4주 블록 트랙을 위에 두고, 그 아래 선수 카드·처방 표를 클립보드처럼 쌓는다 */
:root {
  --bg: #eef1f6;
  --surface: #ffffff;
  --surface-2: #f6f8fb;
  --ink: #142039;
  --muted: #59647a;
  --line: #d6dbe5;
  --blue: #1f4fa8;
  --blue-soft: #e3ebfa;
  --yellow: #f2c230;
  --on-yellow: #2a1f00;
  --yellow-soft: #fbf1cc;
  --good: #1f7a4d;
  --warn: #a35a00;
  --warn-soft: #fbecd6;
  --crit: #b42318;
  --crit-soft: #fbe2df;
  --f-display: "Do Hyeon", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --f-body: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  --f-data: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d1322; --surface: #151d31; --surface-2: #1a2440; --ink: #e7ecf6; --muted: #9ba6bd; --line: #2a3553;
    --blue: #86a9ff; --blue-soft: #1d2b52; --yellow: #f2c230; --on-yellow: #2a1f00; --yellow-soft: #3a3115;
    --good: #5fd09a; --warn: #f0b05a; --warn-soft: #3b2a12; --crit: #ff8a7d; --crit-soft: #3d1c1a;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0d1322; --surface: #151d31; --surface-2: #1a2440; --ink: #e7ecf6; --muted: #9ba6bd; --line: #2a3553;
  --blue: #86a9ff; --blue-soft: #1d2b52; --yellow: #f2c230; --on-yellow: #2a1f00; --yellow-soft: #3a3115;
  --good: #5fd09a; --warn: #f0b05a; --warn-soft: #3b2a12; --crit: #ff8a7d; --crit-soft: #3d1c1a;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--f-body); font-size: 15px; line-height: 1.55; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--surface); }
.wrap { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--surface); border-bottom: 1px solid var(--line); }
.top-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 12px 8px; flex-wrap: wrap; }
.brand { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.brand h1 { font-family: var(--f-display); font-weight: 400; font-size: 26px; letter-spacing: 0.01em; margin: 0; line-height: 1.1; }
.brand h1 b { color: var(--blue); font-weight: 400; }
.brand span { color: var(--muted); font-size: 13px; }
.dday { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.dday strong { font-family: var(--f-data); font-size: 15px; background: var(--yellow); color: var(--on-yellow); padding: 2px 10px; border-radius: 6px; font-variant-numeric: tabular-nums; }
nav.tabs { display: flex; gap: 4px; overflow-x: auto; padding-block: 0 0; scrollbar-width: none; }
nav.tabs button { flex: none; border: 0; background: none; color: var(--muted); font: inherit; font-weight: 600; font-size: 14px; padding: 8px 12px 10px; border-bottom: 3px solid transparent; cursor: pointer; }
nav.tabs button[aria-current="page"] { color: var(--ink); border-bottom-color: var(--blue); }
nav.tabs button:hover { color: var(--ink); }
main { padding-block: 20px 64px; display: grid; gap: 24px; }
h2 { font-family: var(--f-display); font-weight: 400; font-size: 22px; margin: 0; line-height: 1.2; text-wrap: balance; }
h3 { font-size: 15px; margin: 0; font-weight: 700; }
.lede { color: var(--muted); margin: 4px 0 0; max-width: 68ch; }
.sec { display: grid; gap: 12px; }
.sec-head { display: flex; align-items: end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; min-width: 0; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.num { font-family: var(--f-data); font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

/* block track */
.track { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr); gap: 6px; }
.wk { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; text-align: left; font: inherit; color: inherit; cursor: pointer; display: grid; gap: 2px; min-width: 0; }
.wk .lab { font-family: var(--f-display); font-size: 18px; line-height: 1.1; }
.wk .dt { font-family: var(--f-data); font-size: 12px; color: var(--muted); }
.wk .gl { font-size: 12.5px; color: var(--muted); }
.wk[aria-pressed="true"] { border-color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue); background: var(--blue-soft); }
.wk .now { justify-self: start; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--blue); }
.wk.cup { background: var(--yellow); color: var(--on-yellow); border-color: var(--yellow); cursor: default; }
.wk.cup .dt, .wk.cup .gl { color: var(--on-yellow); opacity: 0.8; }
@media (max-width: 720px) { .track { grid-template-columns: repeat(2, minmax(0, 1fr)); } .wk.cup { grid-column: 1 / -1; } }

/* chips */
.chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); white-space: nowrap; }
.chip.pos { font-family: var(--f-data); background: var(--blue-soft); color: var(--blue); border-color: transparent; }
.chip.warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
.chip.crit { background: var(--crit-soft); color: var(--crit); border-color: transparent; }
.chip.good { color: var(--good); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }

/* player cards */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.card-head { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
.card-head .nm { font-weight: 700; font-size: 16px; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.stat { background: var(--surface-2); border-radius: 6px; padding: 6px 8px; min-width: 0; }
.stat .k { font-size: 11.5px; color: var(--muted); }
.stat .v { font-family: var(--f-data); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.stat .v small { font-size: 11px; color: var(--good); font-weight: 600; }
.stat .v small.neg { color: var(--crit); }
.pos-group h3 { font-size: 13px; color: var(--muted); letter-spacing: 0.04em; margin-bottom: 6px; }

/* buttons & forms */
.btn { font: inherit; font-weight: 600; font-size: 14px; border-radius: 8px; padding: 8px 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
.btn:hover { border-color: var(--blue); }
.btn.primary { background: var(--blue); border-color: var(--blue); color: var(--surface); }
.btn.danger { color: var(--crit); }
.btn.danger.armed { background: var(--crit); color: var(--surface); border-color: var(--crit); }
.btn.link { border: 0; background: none; padding: 4px 0; color: var(--blue); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
form.f { display: grid; gap: 14px; }
.fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px 12px; }
label.fl { display: grid; gap: 4px; font-size: 13px; color: var(--muted); font-weight: 500; min-width: 0; }
label.fl.wide { grid-column: 1 / -1; }
input, select, textarea { font: inherit; font-size: 15px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 7px; padding: 7px 10px; width: 100%; min-width: 0; }
textarea { min-height: 60px; resize: vertical; }
label.check { display: flex; gap: 8px; align-items: center; font-size: 14px; color: var(--ink); }
label.check input { width: auto; }
fieldset { border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 0; display: grid; gap: 12px; min-width: 0; }
legend { font-weight: 700; padding: 0 6px; }
.private { font-size: 12px; color: var(--warn); font-weight: 600; }

/* prescription tables */
.tw { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 12px; color: var(--muted); font-weight: 600; background: var(--surface-2); white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.rx { font-family: var(--f-data); font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
td .cue { display: block; font-size: 12.5px; color: var(--muted); }
td .mod { display: inline-block; font-size: 11.5px; font-weight: 700; color: var(--warn); margin-left: 4px; }
tfoot td { font-weight: 700; background: var(--surface-2); }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
@media (max-width: 860px) { .two { grid-template-columns: minmax(0, 1fr); } }
.notes { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.notes li { font-size: 14px; }
.callout { border-left: 3px solid var(--warn); background: var(--warn-soft); padding: 10px 12px; border-radius: 0 8px 8px 0; font-size: 14px; }
.callout.info { border-left-color: var(--blue); background: var(--blue-soft); }
.empty { text-align: center; padding: 32px 16px; color: var(--muted); display: grid; gap: 10px; justify-items: center; }
.empty strong { color: var(--ink); font-size: 16px; }
.cell-warn { color: var(--warn); font-weight: 700; }
.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); background: var(--ink); color: var(--surface); padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 20; max-width: calc(100% - 32px); }
.side { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 760px) { .side { grid-template-columns: minmax(0, 1fr); } }
.plist { display: grid; gap: 4px; }
.plist button { text-align: left; font: inherit; border: 1px solid transparent; background: none; color: var(--ink); padding: 7px 10px; border-radius: 7px; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; }
.plist button[aria-pressed="true"] { background: var(--blue-soft); border-color: var(--blue); }
.steps { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>

<header class="top">
  <div class="wrap">
    <div class="top-row">
      <div class="brand"><h1>SNUVT <b>피지컬 보드</b></h1><span id="weekTag"></span></div>
      <div class="dday" id="dday"></div>
    </div>
    <nav class="tabs" id="tabs" aria-label="화면"></nav>
  </div>
</header>
<div class="wrap"><main id="main"></main></div>
<div class="toast" id="toast" hidden></div>

<script>
/* ---------- 기준값 ---------- */
const NET = 243; // 남자부 네트 높이 (cm)
const DEFAULT_SETTINGS = { name: "서울대배", blockStart: "2026-10-26", start: "2026-11-21", end: "2026-11-22" };
const POS = { OH: "아웃사이드", MB: "미들블로커", OP: "아포짓", S: "세터", Li: "리베로" };
const POS_ORDER = ["OH", "MB", "OP", "S", "Li"];
const WEEKS = [
  { label: "1주차", goal: "측정 · 동작 익히기" },
  { label: "2주차", goal: "발달" },
  { label: "3주차", goal: "발달 · 최고 강도" },
  { label: "4주차", goal: "감량 · 대회" },
];
const POSJ = { MB: "슬라이드 스텝 후 블록 점프", OP: "공격 어프로치 + 블록 번갈아", OH: "공격 어프로치 점프", S: "점프 토스 테이크오프 (양발 착지)" };
const PLYO = [
  { key: "pogo", name: "포고 점프", cue: "발목 탄성, 무릎은 거의 굽히지 않기", sets: [2, 2, 2, 1], reps: [10, 10, 10, 10], land: 1 },
  { key: "stick", name: "스쿼트 점프 착지 고정", cue: "2초 멈춤, 무릎은 발끝 방향", sets: [2, 3, 0, 0], reps: [5, 5, 5, 5], land: 1 },
  { key: "cmj", name: "CMJ 최대 노력", cue: "팔 스윙, 매 회 최고 높이", sets: [0, 3, 3, 2], reps: [4, 4, 4, 3], land: 1, hi: true },
  { key: "broad", name: "연속 제자리멀리뛰기", cue: "3번 연속, 착지하자마자 다음", sets: [0, 3, 4, 2], reps: [3, 3, 3, 3], land: 1, hi: true, fmt: "chain" },
  { key: "posj", name: "포지션별 점프", cue: "실전 스텝으로", sets: [0, 0, 3, 2], reps: [3, 3, 3, 2], land: 1, hi: true },
];
const STRENGTH = [
  { key: "squat", name: "백스쿼트", rx: ["동작 연습 2×8 (가볍게)", "4×5 · RIR 2–3", "4×4 · RIR 2 · 무게 ↑", "2×3 · 3주차 무게 유지"] },
  { key: "rdl", name: "루마니안 데드리프트 (바벨)", rx: ["동작 연습 2×8", "3×6 · RIR 3", "3×5 · RIR 2", "2×5"] },
  { key: "bss", name: "불가리안 스플릿 스쿼트 (덤벨, 다리당)", rx: [null, "3×6", "3×6 · 무게 ↑", "1×6"] },
  { key: "calf", name: "한 발 카프레이즈 (다리당)", rx: [null, "3×12", "3×12", "1×12"] },
  { key: "ham", name: "햄스트링 컬 머신", rx: [null, "2×8", "2×8", null] },
];
const HANDSTAND = ["", "파이크 버티기 (손은 바닥, 발은 벤치) 30초 × 3", "벽 걸어 올라가기 3–5회", "벽 물구나무 버티기 20–40초 × 3", "벽 물구나무 어깨 터치 → 벽 없이 킥업"];
const WARMUP = [
  ["조깅, 사이드 셔플, 카리오카, 스킵", "3분", "체온 올리기"],
  ["회전 런지, 옆 런지, 다리 앞뒤·옆 스윙", "3분", "엉덩이·햄스트링 가동성"],
  ["한 발 서기 30초 (좌·우) → 한 발 홉 착지 고정 5회 (좌·우)", "2분", "발목 균형"],
  ["스쿼트 점프 착지 고정 5회", "2분", "무릎은 발끝 방향, 착지 소리 작게"],
  ["밴드 외회전 2×10, 밴드 벌리기 10, 엎드려 Y·T 각 8, 오픈북 흉추 회전 좌·우 5", "4분", "어깨 외회전 근력, 견갑, 흉추"],
  ["어프로치 점프 3회 (70% → 90%)", "1분", "첫 점프 준비"],
];
const LOG_TYPES = { A: ["세션 A (월)", 75], B: ["세션 B (목)", 60], team: ["팀 훈련", 180], act: ["활성화", 30], match: ["경기", 90], other: ["기타", 60] };
const RPE = ["0 휴식", "1 아주 쉬움", "2 쉬움", "3 보통", "4 약간 힘듦", "5 힘듦", "6", "7 매우 힘듦", "8", "9", "10 최대"];

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, "0");
const parseD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
const today = () => parseD(iso(new Date()));
const daysBetween = (a, b) => Math.round((parseD(iso(a)) - parseD(iso(b))) / 86400000);
const S = () => ({ ...DEFAULT_SETTINGS, ...(state.settings || {}) });
const weekOf = date => Math.floor(daysBetween(date, parseD(S().blockStart)) / 7);
const monOf = w => addDays(parseD(S().blockStart), 7 * w);

/* ---------- 상태 ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = {
  view: "team", week: null, pid: null, editPid: null,
  players: {}, tests: {}, health: {}, logs: {}, settings: null,
  loaded: false, offline: false, admin: false, canWrite: null, dirty: false, armed: null,
};
let db = null;
const logUnsubs = {};

function sortedPlayers() {
  return Object.entries(state.players).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)) || ((a.order ?? 99) - (b.order ?? 99)) || String(a.name).localeCompare(String(b.name), "ko"));
}
function runs(pid) { return [...((state.tests[pid] || {}).runs || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))); }
const latest = pid => runs(pid).at(-1) || null;
const first = pid => runs(pid)[0] || null;
const curWeek = () => Math.min(3, Math.max(0, weekOf(today())));

/* ---------- 처방 계산 ---------- */
function rxText(x) {
  if (x.fmt === "chain") return `${x.sets}세트 × 3연속`;
  if (x.fmt === "time") return `${x.sets}×${x.reps}`;
  if (x.fmt === "count") return `${x.sets}회`;
  return `${x.sets}×${x.reps}`;
}
function prescribe(p, w) {
  const adj = p.adjust || {};
  const t = latest(p.id);
  const balanceFail = !!t && (t.balL === false || t.balR === false);
  const novice = p.weightExp === "none";
  const notes = [];
  const order = k => ["pogo", "stick", "cmj", "lat", "broad", "posj", "step", "iso"].indexOf(k);

  let plyo = PLYO.map(x => ({ ...x, sets: x.sets[w], reps: x.reps[w] })).filter(x => x.sets > 0)
    .map(x => x.key === "posj" ? { ...x, name: POSJ[p.pos] || x.name } : x);
  if (p.pos === "S") {
    plyo = plyo.map(x => (x.key === "cmj" || x.key === "broad") ? { ...x, sets: Math.max(1, x.sets - 1), mod: "세터 −1세트" } : x);
  }
  if (p.pos === "Li") {
    plyo = plyo.flatMap(x => {
      if (x.key === "cmj") return [{ ...x, key: "lat", name: "옆으로 한 발 바운드 착지 고정", cue: "좌우 번갈아, 착지 2초 고정", reps: 4, mod: "리베로 대체" }];
      if (x.key === "broad") return [];
      if (x.key === "posj") return [{ ...x, key: "step", name: "측면 스텝 출발 5m", cue: "첫 스텝을 빠르게", land: 0, hi: false, fmt: "count", sets: x.sets * 2, mod: "리베로 대체" }];
      return [x];
    });
  }
  if (balanceFail) {
    plyo = plyo.filter(x => !x.hi);
    if (!plyo.some(x => x.key === "stick")) plyo.push({ ...PLYO[1], sets: w === 3 ? 2 : 3, reps: 5, mod: "고강도 대신" });
    notes.push("한 발 서기 30초를 통과하지 못해 최대 점프·연속 점프는 보류했어요. 다음 측정에서 통과하면 다시 넣어요.");
  }
  if (adj.plyo === "iso") {
    plyo = [{ key: "iso", name: "레그 익스텐션 등척성 버티기", cue: "무릎 약 60°에서 강하게, 세트 간 2분", sets: 5, reps: "45초", land: 0, fmt: "time", mod: "개별 조정" }];
    notes.push("점프 블록 대신 등척성 버티기를 해요. 무릎 통증이 2/10 이하로 내려오면 포고·스쿼트 점프부터 다시 시작해요.");
  }
  if (adj.plyo === "hold") {
    plyo = [];
    notes.push("이번 주는 점프 블록을 쉬고 근력만 진행해요.");
  }
  plyo.sort((a, b) => order(a.key) - order(b.key));
  const landings = plyo.reduce((s, x) => s + (typeof x.reps === "number" ? x.sets * x.reps * x.land : 0), 0);

  const strength = STRENGTH.filter(x => x.rx[w]).map(x => {
    let name = x.name, rx = x.rx[w], mod = "";
    if (x.key === "squat" && novice) { name = "고블릿 스쿼트 (덤벨)"; mod = "입문"; }
    if (x.key === "rdl" && adj.back) { rx += " · 가볍게, 통증 없는 범위"; mod = "개별 조정"; }
    return { name, rx, mod };
  });
  if (novice && w === 0) notes.push("웨이트 입문 단계라 첫 세션은 동작 연습만 해요.");
  if (adj.refer) notes.push("통증이 이어지면 처방을 줄이고 물리치료사와 상담해요. 시스템은 진단하지 않아요.");

  // 세션 B
  let B, bTitle;
  const sq = novice ? "고블릿 스쿼트 (덤벨)" : "백스쿼트";
  if (w === 3) {
    bTitle = "활성화 30분";
    B = [
      ["워밍업 루틴", "15분"],
      ["포고 점프", "1×10"],
      p.pos === "Li" ? ["옆으로 한 발 바운드", "2×2"] : (adj.plyo ? ["레그 익스텐션 등척성 버티기", "3×45초"] : ["CMJ 최대 노력", "2×3"]),
      [sq, "2×2 · 3주차 무게"],
      ["어깨 밴드 운동", "워밍업 5번 순서", "땀이 살짝 날 정도로 끝내기"],
    ];
    if (adj.plyo === "hold") B.splice(1, 2);
  } else {
    bTitle = w === 0 ? "가볍게 (모든 운동 2세트)" : (w === 2 ? "무게만 조금 올림" : "기본 처방");
    const stage = Math.min(4, Math.max(1, Number((t && t.hsStage) || 1)));
    B = [
      ["워밍업 루틴", "15분"],
      ["포고 점프", "2×10"],
      ["턱걸이", "3×3–6", "못 하면 뛰어 올라가 3–5초 동안 내려오기"],
      ["덤벨 벤치프레스", "3×8 · RIR 2"],
      ["한 팔 덤벨 로우", "3×8"],
      ["바벨 힙 쓰러스트", "3×8 · RIR 2", "등을 벤치에"],
      ["덤벨 한 발 루마니안 데드리프트", "2×8 (다리당)"],
      ["옆으로 누워 덤벨 외회전", "2×15 (가볍게)"],
      adj.overhead ? ["물구나무 대신 견갑·외회전 운동", "10분", "통증 없는 범위에서"] : ["물구나무 단계 " + stage, "10분", HANDSTAND[stage] + (p.pos === "S" ? " · 세터는 매 세션 빠짐없이" : "")],
      ["데드버그 · 사이드 플랭크 · 한 손 캐리", "각 2세트"],
    ];
    if (adj.plyo === "hold" || adj.plyo === "iso") B[1] = ["포고 점프", "생략", "개별 조정"];
    if (adj.overhead) B[3] = ["덤벨 벤치프레스", "3×8 · RIR 3", "통증 없는 범위"];
    if (p.pos === "Li") B.push(["월싯 (수비 자세)", "3×30초"], ["측면 스텝 출발 5m", "6회", "첫 스텝을 빠르게"]);
    if (w === 0) B = B.map(([n, rx, c]) => [n, String(rx).replace(/^3×/, "2×"), c]);
  }
  const bLand = w === 3 ? (adj.plyo ? 10 : 16) : (adj.plyo ? 0 : 20);
  return { plyo, landings, strength, B, bTitle, bLand, notes, ankle: !!adj.ankleBal, balanceFail, novice };
}

/* ---------- 표시용 깃발 ---------- */
function flags(p) {
  const out = [];
  const adj = p.adjust || {};
  const h = state.health[p.id];
  if (state.admin && h) {
    const pain = h.pain || {};
    for (const [k, lab] of [["knee", "무릎"], ["shoulder", "어깨"], ["ankle", "발목"], ["back", "허리"]]) {
      if (Number(pain[k]) >= 3) out.push(["crit", `${lab} 통증 ${pain[k]}/10`]);
    }
    const sp = (Number(h.ankleL) || 0) + (Number(h.ankleR) || 0);
    if (sp > 0) out.push(["warn", `발목 염좌 이력 ${sp}회`]);
    if (h.kneeInjury) out.push(["warn", "무릎 부상 이력"]);
  } else {
    if (adj.plyo === "iso") out.push(["crit", "점프 대체 (등척성)"]);
    if (adj.plyo === "hold") out.push(["crit", "점프 보류"]);
    if (adj.overhead) out.push(["warn", "머리 위 동작 조정"]);
    if (adj.ankleBal) out.push(["warn", "균형 +1분"]);
  }
  const t = latest(p.id);
  if (t && (t.balL === false || t.balR === false)) out.push(["warn", "한 발 서기 미통과"]);
  if (p.weightExp === "none") out.push(["", "웨이트 입문"]);
  return out;
}
const chipsHtml = list => list.length ? `<div class="chips">${list.map(([c, t]) => `<span class="chip ${c}">${esc(t)}</span>`).join("")}</div>` : "";

/* ---------- 화면: 공통 ---------- */
function trackHtml(sel) {
  const s = S(), now = weekOf(today());
  const cells = WEEKS.map((wk, i) => {
    const mon = monOf(i), fri = addDays(mon, 4);
    return `<button class="wk" type="button" data-act="week" data-w="${i}" aria-pressed="${sel === i}">
      <span class="lab">${wk.label}</span><span class="dt">${md(mon)}–${md(fri)}</span><span class="gl">${esc(wk.goal)}</span>
      ${now === i ? '<span class="now">이번 주</span>' : ""}</button>`;
  }).join("");
  const a = parseD(s.start), b = parseD(s.end);
  return `<div class="track">${cells}<div class="wk cup" aria-label="대회"><span class="lab">${esc(s.name)}</span><span class="dt">${md(a)}–${md(b)}</span><span class="gl">토 조별리그 2경기 · 일 최대 4경기</span></div></div>`;
}
function header() {
  const s = S();
  const d = daysBetween(parseD(s.start), today());
  document.getElementById("dday").innerHTML = d > 0
    ? `${esc(s.name)}까지 <strong>D-${d}</strong>` : (d >= -1 ? `<strong>대회 중</strong>` : `<span>${esc(s.name)} 종료</span>`);
  const w = weekOf(today());
  document.getElementById("weekTag").textContent = w < 0 ? "블록 시작 전" : (w > 3 ? "블록 종료" : `${WEEKS[w].label} · ${WEEKS[w].goal}`);
  const tabs = [["team", "이번 주"], ["player", "선수별 처방"], ["guide", "워밍업·원칙"]];
  if (state.admin) tabs.splice(2, 0, ["intake", "등록·측정"], ["load", "훈련 부하"]);
  document.getElementById("tabs").innerHTML = tabs.map(([k, l]) =>
    `<button type="button" data-act="view" data-v="${k}" ${state.view === k ? 'aria-current="page"' : ""}>${l}</button>`).join("");
}

/* ---------- 화면: 이번 주 ---------- */
function viewTeam() {
  const w = state.week ?? curWeek();
  const mon = monOf(w), thu = addDays(mon, 3);
  const ps = sortedPlayers();
  let body;
  if (state.offline) body = offlineHtml();
  else if (!state.loaded) body = `<div class="panel empty"><strong>선수 명단을 불러오는 중</strong><span>잠시만 기다려 주세요.</span></div>`;
  else if (!ps.length) body = `<div class="panel empty"><strong>아직 등록된 선수가 없어요</strong><span>${state.admin ? "‘등록·측정’에서 주전부터 추가하면 이 화면에 포지션별 카드가 생겨요." : "피지컬 담당자가 선수를 등록하면 여기에 처방이 나타나요."}</span>${state.admin ? '<button class="btn primary" data-act="view" data-v="intake">선수 등록하기</button>' : ""}</div>`;
  else {
    body = POS_ORDER.filter(pos => ps.some(p => p.pos === pos)).map(pos => `
      <div class="pos-group"><h3>${POS[pos]} · ${pos}</h3><div class="grid">
      ${ps.filter(p => p.pos === pos).map(p => cardHtml(p, w)).join("")}
      </div></div>`).join("");
  }
  return `
  <section class="sec">
    <div class="sec-head"><div><h2>${WEEKS[w].label} · ${WEEKS[w].goal}</h2>
      <p class="lede">월 ${md(mon)} 세션 A (점프 + 하체 근력) · 목 ${md(thu)} ${w === 3 ? "활성화 30분" : "세션 B (점프 적은 날)"} · 수·금 팀 훈련 전 워밍업 15분</p></div></div>
    ${trackHtml(w)}
  </section>
  ${w === 0 ? `<div class="callout info">10/26(월)은 측정·접수 날이에요. 측정 후 남는 시간에 세션 A의 1주차 처방을 가볍게 해요.</div>` : ""}
  ${w === 3 ? `<div class="callout">대회 주예요. 양은 줄이고 무게와 점프 강도는 지켜요. 새로운 운동은 넣지 않아요.</div>` : ""}
  <section class="sec">${body}</section>`;
}
function cardHtml(p, w) {
  const rx = prescribe(p, w), t = latest(p.id), f0 = first(p.id);
  const cmj = t && t.cmj != null ? Number(t.cmj) : null;
  const dCmj = cmj != null && f0 && f0 !== t && f0.cmj != null ? (cmj - Number(f0.cmj)) : null;
  const blk = t && t.block != null ? Number(t.block) - NET : null;
  const delta = dCmj == null ? "" : `<small class="${dCmj < 0 ? "neg" : ""}">${dCmj > 0 ? "+" : ""}${dCmj.toFixed(1)}</small>`;
  return `<article class="card">
    <div class="card-head"><div><div class="nm">${esc(p.name)}</div><div class="small muted">${p.year ? esc(p.year) + " · " : ""}${p.height ? esc(p.height) + "cm" : "키 미입력"}</div></div><span class="chip pos">${esc(p.pos)}</span></div>
    <div class="stats">
      <div class="stat"><div class="k">CMJ</div><div class="v">${cmj != null ? cmj.toFixed(1) : "—"} ${delta}</div></div>
      <div class="stat"><div class="k">네트 위 (블록)</div><div class="v">${blk != null ? (blk >= 0 ? "+" : "") + blk : "—"}</div></div>
      <div class="stat"><div class="k">월 착지 수</div><div class="v">${rx.landings}</div></div>
    </div>
    ${chipsHtml(flags(p))}
    <button class="btn link" type="button" data-act="open" data-pid="${esc(p.id)}">이번 주 처방 보기 →</button>
  </article>`;
}
function offlineHtml() {
  return `<div class="panel empty"><strong>팀 데이터에 연결하지 못했어요</strong><span>claude.ai에 로그인한 상태로 이 페이지를 열면 선수 명단과 처방이 나타나요. 워밍업·원칙 화면은 지금도 볼 수 있어요.</span><button class="btn" data-act="view" data-v="guide">워밍업·원칙 보기</button></div>`;
}

/* ---------- 화면: 선수별 처방 ---------- */
function viewPlayer() {
  const ps = sortedPlayers();
  if (state.offline) return offlineHtml();
  if (!ps.length) return viewTeam();
  if (!state.pid || !state.players[state.pid]) state.pid = ps[0].id;
  const p = ps.find(x => x.id === state.pid);
  const w = state.week ?? curWeek();
  const rx = prescribe(p, w);
  const mon = monOf(w), thu = addDays(mon, 3);
  const plyoRows = rx.plyo.length ? rx.plyo.map(x => `<tr><td>${esc(x.name)}${x.mod ? `<span class="mod">${esc(x.mod)}</span>` : ""}<span class="cue">${esc(x.cue || "")}</span></td><td class="rx">${rxText(x)}</td></tr>`).join("")
    : `<tr><td colspan="2" class="muted">이번 주 점프 블록 없음</td></tr>`;
  const strRows = rx.strength.map(x => `<tr><td>${esc(x.name)}${x.mod ? `<span class="mod">${esc(x.mod)}</span>` : ""}</td><td class="rx">${esc(x.rx)}</td></tr>`).join("");
  const bRows = rx.B.map(([n, r, c]) => `<tr><td>${esc(n)}${c ? `<span class="cue">${esc(c)}</span>` : ""}</td><td class="rx">${esc(r)}</td></tr>`).join("");
  return `
  <section class="sec">
    <div class="sec-head">
      <div><h2>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></h2><p class="lede">${POS[p.pos]} · ${WEEKS[w].label} ${md(mon)}–${md(addDays(mon, 4))}</p></div>
      <label class="fl" style="min-width:180px">선수 선택<select id="pp-select" data-act="pick">${ps.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)} · ${esc(x.pos)}</option>`).join("")}</select></label>
    </div>
    ${trackHtml(w)}
    ${chipsHtml(flags(p))}
    ${rx.notes.length || rx.ankle ? `<div class="callout"><ul class="notes">${rx.notes.map(n => `<li>${esc(n)}</li>`).join("")}${rx.ankle ? "<li>워밍업 3번(발목 균형)을 1분 더 해요.</li>" : ""}</ul></div>` : ""}
  </section>
  <section class="two">
    <div class="sec">
      <div><h3>세션 A · 월 ${md(mon)} ${w === 0 ? "(측정 후 가볍게)" : ""}</h3><p class="small muted">워밍업 → 점프 → 근력 순서. 착지 소리가 커지거나 무릎이 안으로 모이면 그 세트는 멈춰요.</p></div>
      <div class="tw"><table><thead><tr><th>점프 블록</th><th>처방</th></tr></thead><tbody>${plyoRows}</tbody>
        <tfoot><tr><td>총 착지 수</td><td class="rx">${rx.landings}회</td></tr></tfoot></table></div>
      <div class="tw"><table><thead><tr><th>근력 블록</th><th>처방</th></tr></thead><tbody>${strRows}</tbody></table></div>
      <p class="small muted">RIR = 세트 끝에 더 할 수 있었던 횟수. 모든 세트를 목표보다 여유 있게 끝냈으면 다음 주 2.5–5kg 올려요.</p>
    </div>
    <div class="sec">
      <div><h3>${w === 3 ? "목 " + md(thu) + " · " + rx.bTitle : "세션 B · 목 " + md(thu)}</h3><p class="small muted">${w === 3 ? "대회 이틀 전이에요. 근육통이 생길 자극은 넣지 않아요." : rx.bTitle + " · 다음 날 팀 훈련이 있어 점프는 포고만 해요."}</p></div>
      <div class="tw"><table><thead><tr><th>운동</th><th>처방</th></tr></thead><tbody>${bRows}</tbody></table></div>
      ${testsHtml(p)}
    </div>
  </section>
  ${logSectionHtml(p, w, rx)}`;
}
function testsHtml(p) {
  const r = runs(p.id);
  if (!r.length) return `<div class="panel small muted">측정 기록이 아직 없어요. ${state.admin ? "‘등록·측정’에서 10/26 측정값을 넣으면 CMJ 변화와 네트 위 높이가 나와요." : ""}</div>`;
  const cell = v => v == null || v === "" ? "—" : esc(v);
  const above = v => v == null || v === "" ? "—" : ((Number(v) - NET >= 0 ? "+" : "") + (Number(v) - NET));
  return `<div><h3>측정 기록</h3></div><div class="tw"><table><thead><tr><th>날짜</th><th>CMJ</th><th>블록 리치</th><th>네트 위</th><th>어프로치 리치</th><th>네트 위</th><th>한 발 서기 L/R</th><th>물구나무</th></tr></thead><tbody>
  ${r.slice().reverse().map(t => `<tr><td class="num">${esc(t.date)}</td><td class="num">${cell(t.cmj)}</td><td class="num">${cell(t.block)}</td><td class="num">${above(t.block)}</td><td class="num">${cell(t.approach)}</td><td class="num">${above(t.approach)}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td>${t.hsStage ? "단계 " + esc(t.hsStage) : "—"}${t.hsSec ? " · " + esc(t.hsSec) + "초" : ""}</td></tr>`).join("")}
  </tbody></table></div><p class="small muted">단위 cm. 네트 위 = 리치 − 243cm (남자부 네트).</p>`;
}
const bal = v => v === true ? "통과" : v === false ? "미통과" : "—";

/* ---------- 세션 기록 ---------- */
function logSectionHtml(p, w, rx) {
  const canLog = state.canWrite !== false && !!state.uid;
  const defType = today().getDay() === 1 ? "A" : today().getDay() === 4 ? (w === 3 ? "act" : "B") : "team";
  const defJumps = defType === "A" ? rx.landings : defType === "B" || defType === "act" ? rx.bLand : "";
  const entries = (state.logs[p.id] || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  return `<section class="two">
    <div class="sec">
      <div><h3>세션 기록하기</h3><p class="small muted">훈련이 끝나고 30분 안에 체감 강도(RPE)를 남겨요. 세션 RPE = RPE × 시간(분).</p></div>
      ${canLog ? `<form class="f panel" id="logForm" data-pid="${esc(p.id)}">
        <div class="fields">
          <label class="fl">날짜<input type="date" id="lg-date" value="${iso(today())}" required></label>
          <label class="fl">종류<select id="lg-type">${Object.entries(LOG_TYPES).map(([k, [l]]) => `<option value="${k}" ${k === defType ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="fl">시간 (분)<input type="number" id="lg-min" inputmode="numeric" min="1" max="400" value="${LOG_TYPES[defType][1]}" required></label>
          <label class="fl">RPE (0–10)<select id="lg-rpe">${RPE.map((l, i) => `<option value="${i}" ${i === 5 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="fl">점프·착지 수<input type="number" id="lg-jumps" inputmode="numeric" min="0" max="2000" value="${defJumps}" placeholder="모르면 비워두기"></label>
          <label class="fl">통증 부위<select id="lg-area"><option value="">없음</option><option value="knee">무릎</option><option value="shoulder">어깨</option><option value="ankle">발목</option><option value="back">허리</option></select></label>
          <label class="fl">통증 (0–10)<input type="number" id="lg-pain" inputmode="numeric" min="0" max="10" value="0"></label>
          <label class="fl wide">메모<input type="text" id="lg-note" maxlength="200" placeholder="무게, 컨디션 등"></label>
        </div>
        <div class="row"><button class="btn primary" type="submit">기록 저장</button><span class="small muted">기록은 본인과 피지컬 담당자만 볼 수 있어요.</span></div>
      </form>` : `<div class="panel small muted">이 페이지에서 기록을 남길 권한이 없어요. 피지컬 담당자에게 기록을 전달해 주세요.</div>`}
    </div>
    <div class="sec">
      <div><h3>최근 기록</h3></div>
      ${!state.admin ? `<p class="small muted">이 기기에서 본인이 남긴 기록만 보여요.</p>` : ""}
      ${entries.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>종류</th><th>RPE×분</th><th>착지</th><th>통증</th><th></th></tr></thead><tbody>
        ${entries.map(e => `<tr><td class="num">${esc(e.date)}</td><td>${esc((LOG_TYPES[e.type] || ["기타"])[0])}</td><td class="num">${esc(e.rpe)}×${esc(e.minutes)} = ${Number(e.rpe) * Number(e.minutes)}</td><td class="num">${e.jumps ?? "—"}</td><td>${e.painArea ? `<span class="chip ${Number(e.pain) >= 3 ? "crit" : ""}">${esc(({ knee: "무릎", shoulder: "어깨", ankle: "발목", back: "허리" })[e.painArea] || "")} ${esc(e.pain)}</span>` : "—"}</td>
        <td>${!state.admin ? "" : `<button class="btn link danger ${state.armed === "log:" + e._id ? "armed" : ""}" data-act="dellog" data-pid="${esc(p.id)}" data-id="${esc(e._id)}">${state.armed === "log:" + e._id ? "정말 삭제" : "삭제"}</button>`}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="panel small muted">아직 기록이 없어요.</div>`}
    </div>
  </section>`;
}

/* ---------- 화면: 등록·측정 ---------- */
function viewIntake() {
  if (!state.admin) return `<div class="panel empty"><strong>피지컬 담당자 전용 화면이에요</strong></div>`;
  if (state.offline) return offlineHtml();
  const ps = sortedPlayers();
  const isNew = state.editPid === "__new" || !ps.length;
  const pid = isNew ? null : (state.editPid && state.players[state.editPid] ? state.editPid : ps[0].id);
  const p = pid ? { id: pid, ...state.players[pid] } : {};
  const h = (pid && state.health[pid]) || {};
  const pain = h.pain || {};
  const list = `<div class="plist">${ps.map(x => `<button type="button" data-act="edit" data-pid="${esc(x.id)}" aria-pressed="${x.id === pid}"><span>${esc(x.name)}</span><span class="chip pos">${esc(x.pos)}</span></button>`).join("")}
    <button type="button" data-act="edit" data-pid="__new" aria-pressed="${isNew}"><span>+ 새 선수</span></button></div>`;
  const opt = (v, cur) => `value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}`;
  return `<section class="sec"><div><h2>등록·측정</h2><p class="lede">가입 질문과 측정값을 넣으면 처방이 자동으로 바뀌어요. 부상·통증 정보는 피지컬 담당자(편집 권한)만 볼 수 있어요.</p></div></section>
  <section class="side">
    <div class="panel">${list}</div>
    <div class="sec">
      <form class="f panel" id="playerForm" data-pid="${esc(pid || "")}">
        <fieldset><legend>기본 정보</legend>
          <div class="fields">
            <label class="fl">이름<input id="pf-name" required maxlength="20" value="${esc(p.name || "")}"></label>
            <label class="fl">포지션<select id="pf-pos" required>${POS_ORDER.map(k => `<option ${opt(k, p.pos)}>${k}</option>`).join("")}</select></label>
            <label class="fl">학년<input id="pf-year" maxlength="10" placeholder="예: 3학년" value="${esc(p.year || "")}"></label>
            <label class="fl">키 (cm)<input id="pf-height" type="number" inputmode="decimal" min="140" max="220" value="${esc(p.height ?? "")}"></label>
            <label class="fl">몸무게 (kg)<input id="pf-weight" type="number" inputmode="decimal" min="40" max="150" value="${esc(p.weight ?? "")}"></label>
            <label class="fl">배구 경력 (년)<input id="pf-exp" type="number" inputmode="decimal" min="0" max="20" step="0.5" value="${esc(p.exp ?? "")}"></label>
            <label class="fl">웨이트 경험<select id="pf-wexp"><option ${opt("none", p.weightExp)}>없음</option><option ${opt("lt6", p.weightExp)}>6개월 미만</option><option ${opt("gte6", p.weightExp)}>6개월 이상</option></select></label>
          </div>
        </fieldset>
        <fieldset><legend>부상·통증 <span class="private">담당자만 열람</span></legend>
          <div class="fields">
            <label class="fl">발목 염좌 (왼쪽, 회)<input id="hf-al" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleL ?? 0)}"></label>
            <label class="fl">발목 염좌 (오른쪽, 회)<input id="hf-ar" type="number" inputmode="numeric" min="0" max="30" value="${esc(h.ankleR ?? 0)}"></label>
            <label class="fl">마지막 염좌 시기<input id="hf-alast" maxlength="30" placeholder="예: 2026년 5월" value="${esc(h.ankleLast || "")}"></label>
            <label class="fl">무릎 통증 (0–10)<input id="hf-knee" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.knee ?? 0)}"></label>
            <label class="fl">어깨 통증 (0–10)<input id="hf-shoulder" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.shoulder ?? 0)}"></label>
            <label class="fl">발목 통증 (0–10)<input id="hf-ankle" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.ankle ?? 0)}"></label>
            <label class="fl">허리 통증 (0–10)<input id="hf-back" type="number" inputmode="numeric" min="0" max="10" value="${esc(pain.back ?? 0)}"></label>
            <label class="fl wide">수술 이력·그 외 알아야 할 것<input id="hf-note" maxlength="200" value="${esc(h.note || "")}"></label>
          </div>
          <label class="check"><input type="checkbox" id="hf-knee-hx" ${h.kneeInjury ? "checked" : ""}> 무릎 부상 이력 있음</label>
          <label class="check"><input type="checkbox" id="hf-consent" ${h.consent ? "checked" : ""} required> 선수가 처방 목적의 정보 사용에 동의함</label>
        </fieldset>
        <div class="row"><button class="btn primary" type="submit">${pid ? "저장" : "선수 추가"}</button>
          ${pid ? `<button class="btn danger ${state.armed === "player:" + pid ? "armed" : ""}" type="button" data-act="delplayer" data-pid="${esc(pid)}">${state.armed === "player:" + pid ? "정말 삭제 (기록 포함)" : "선수 삭제"}</button>` : ""}</div>
      </form>
      ${pid ? testFormHtml(pid) : `<div class="panel small muted">선수를 추가하면 측정값을 넣을 수 있어요.</div>`}
    </div>
  </section>`;
}
function testFormHtml(pid) {
  const r = runs(pid);
  return `<form class="f panel" id="testForm" data-pid="${esc(pid)}">
    <div><h3>측정값 추가</h3><p class="small muted">같은 폰·같은 앱·같은 바닥으로 측정해요. 비워둔 칸은 저장하지 않아요.</p></div>
    <div class="fields">
      <label class="fl">날짜<input type="date" id="tf-date" value="${iso(today())}" required></label>
      <label class="fl">스탠딩 리치 (한 손, cm)<input type="number" id="tf-reach" inputmode="decimal" step="0.5"></label>
      <label class="fl">CMJ (cm)<input type="number" id="tf-cmj" inputmode="decimal" step="0.1"></label>
      <label class="fl">블록 점프 리치 (cm)<input type="number" id="tf-block" inputmode="decimal" step="0.5"></label>
      <label class="fl">어프로치 점프 리치 (cm)<input type="number" id="tf-approach" inputmode="decimal" step="0.5"></label>
      <label class="fl">한 발 서기 왼쪽<select id="tf-balL"><option value="">미측정</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      <label class="fl">한 발 서기 오른쪽<select id="tf-balR"><option value="">미측정</option><option value="1">30초 통과</option><option value="0">미통과</option></select></label>
      <label class="fl">물구나무 단계<select id="tf-hsStage"><option value="">미측정</option><option value="1">1 파이크 버티기</option><option value="2">2 벽 걸어 올라가기</option><option value="3">3 벽 물구나무 버티기</option><option value="4">4 어깨 터치·킥업</option></select></label>
      <label class="fl">물구나무 버티기 (초)<input type="number" id="tf-hsSec" inputmode="numeric" min="0" max="120"></label>
      <label class="fl">스쿼트 5회 무게 (kg)<input type="number" id="tf-squat" inputmode="decimal" step="2.5"></label>
      <label class="fl">RDL 5회 무게 (kg)<input type="number" id="tf-rdl" inputmode="decimal" step="2.5"></label>
      <label class="fl">턱걸이 (회)<input type="number" id="tf-pull" inputmode="numeric" min="0" max="50"></label>
    </div>
    <div class="row"><button class="btn primary" type="submit">측정값 저장</button></div>
    ${r.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>리치</th><th>CMJ</th><th>블록</th><th>어프로치</th><th>균형 L/R</th><th>물구나무</th><th>스쿼트</th><th>RDL</th><th>턱걸이</th><th></th></tr></thead><tbody>
    ${r.slice().reverse().map(t => `<tr><td class="num">${esc(t.date)}</td><td class="num">${t.reach ?? "—"}</td><td class="num">${t.cmj ?? "—"}</td><td class="num">${t.block ?? "—"}</td><td class="num">${t.approach ?? "—"}</td><td>${bal(t.balL)}/${bal(t.balR)}</td><td>${t.hsStage ? esc(t.hsStage) : "—"}${t.hsSec ? " · " + esc(t.hsSec) + "초" : ""}</td><td class="num">${t.squat ?? "—"}</td><td class="num">${t.rdl ?? "—"}</td><td class="num">${t.pull ?? "—"}</td>
    <td><button class="btn link danger ${state.armed === "test:" + t.id ? "armed" : ""}" type="button" data-act="deltest" data-pid="${esc(pid)}" data-id="${esc(t.id)}">${state.armed === "test:" + t.id ? "정말 삭제" : "삭제"}</button></td></tr>`).join("")}
    </tbody></table></div>` : ""}
  </form>`;
}

/* ---------- 화면: 훈련 부하 ---------- */
function viewLoad() {
  if (!state.admin) return `<div class="panel empty"><strong>피지컬 담당자 전용 화면이에요</strong></div>`;
  const ps = sortedPlayers();
  const weeks = [-1, 0, 1, 2, 3];
  const wl = k => k < 0 ? "블록 전" : WEEKS[k].label;
  const rows = ps.map(p => {
    const agg = {};
    for (const e of (state.logs[p.id] || [])) {
      const k = weekOf(parseD(e.date));
      agg[k] = agg[k] || { s: 0, j: 0, n: 0 };
      agg[k].s += (Number(e.rpe) || 0) * (Number(e.minutes) || 0);
      agg[k].j += Number(e.jumps) || 0;
      agg[k].n += 1;
    }
    const cells = weeks.map(k => {
      const a = agg[k], prev = agg[k - 1];
      if (!a) return `<td class="muted">—</td>`;
      const spikeS = prev && prev.s > 0 && a.s >= 2 * prev.s;
      const spikeJ = prev && prev.j > 0 && a.j >= 2 * prev.j;
      return `<td class="num ${spikeS || spikeJ ? "cell-warn" : ""}">${a.s.toLocaleString("ko-KR")} AU<br><span class="small">${a.j}회 · ${a.n}건</span>${spikeS || spikeJ ? '<br><span class="chip warn">전주 2배↑</span>' : ""}</td>`;
    }).join("");
    return `<tr><td>${esc(p.name)} <span class="chip pos">${esc(p.pos)}</span></td>${cells}</tr>`;
  }).join("");
  return `<section class="sec"><div><h2>훈련 부하</h2><p class="lede">주간 세션 RPE 합(RPE × 분, AU)과 기록된 착지 수예요. 전주보다 2배 이상 뛴 칸은 ‘주의’로만 표시해요. ACWR 같은 위험 판정은 근거가 부족해 쓰지 않아요.</p></div>
  ${ps.length ? `<div class="tw"><table><thead><tr><th>선수</th>${weeks.map(k => `<th>${wl(k)}${k >= 0 ? `<br><span class="num">${md(monOf(k))}</span>` : ""}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="panel empty"><strong>선수를 먼저 등록해 주세요</strong></div>`}
  </section>`;
}

/* ---------- 화면: 워밍업·원칙 ---------- */
function viewGuide() {
  return `<section class="sec"><div><h2>워밍업 루틴 15분</h2><p class="lede">수·금 팀 훈련과 월·목 세션 모두 이 순서로 시작해요. 지금의 긴 몸풀기 앞부분을 바꾸는 것이라 훈련 시간은 늘지 않아요.</p></div>
  <div class="tw"><table><thead><tr><th>순서</th><th>내용</th><th>시간</th><th>핵심</th></tr></thead><tbody>
  ${WARMUP.map(([a, b, c], i) => `<tr><td class="num">${i + 1}</td><td>${esc(a)}</td><td class="num">${b}</td><td class="muted">${esc(c)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="small muted">발목 염좌 이력이 있으면 3번을 1분 더 해요. 밴드가 없으면 5번을 ‘엎드려 Y·T·W 들기’로 대신해요.</p></section>
  <section class="two">
    <div class="panel sec"><h3>주간 구조</h3><ol class="steps">
      <li><b>월 · 세션 A</b> 점프 + 하체 근력. 수요일까지 48시간 회복.</li>
      <li><b>수 · 팀 훈련</b> 워밍업 루틴만.</li>
      <li><b>목 · 세션 B</b> 상체·엉덩이·코어·물구나무. 점프는 포고 20회만.</li>
      <li><b>금 · 팀 훈련</b> 워밍업 루틴만.</li></ol>
      <p class="small muted">빠진 세션은 몰아서 하지 않고, 돌아온 날 그 주의 처방을 그대로 해요.</p></div>
    <div class="panel sec"><h3>처방 규칙</h3><ul class="notes">
      <li>포지션별 점프 양: MB·OP·OH 100%, 세터 −1세트, 리베로는 옆 바운드·측면 스텝으로 대체</li>
      <li>웨이트 입문 → 백스쿼트 대신 고블릿 스쿼트</li>
      <li>한 발 서기 30초 미통과 → 최대·연속 점프 보류</li>
      <li>무릎 통증 3/10 이상 → 점프 대신 등척성 버티기, 전문가 상담 권고</li>
      <li>대회 주 → 세트·횟수는 줄이고 무게는 유지</li>
      <li>점프는 세션 초반, 지치기 전에. 훈련 후에는 착지 없는 운동만</li></ul></div>
  </section>
  <section class="panel sec"><h3>대회 당일 (11/21–22)</h3><ul class="notes">
    <li>경기 전 워밍업 루틴 15분 + 팀 몸풀기</li>
    <li>경기 사이 옷을 껴입어 체온 유지, 다음 경기 10분 전 스킵·한 발 홉·어프로치 점프 3회로 다시 데우기. 세터는 경기 사이 추가 점프 없음</li>
    <li>토요일 밤 수면 최우선. 일요일은 최대 4경기라 물과 탄수화물 간식을 미리 챙기기</li></ul>
    <p class="small muted">근거와 설계 과정: <a href="https://claude.ai/artifact/YKHY7dT6gXMJpkeJS1q1j4" target="_blank" rel="noopener">1단계 자료 수집</a> · <a href="https://claude.ai/artifact/2gjmAXXcdsDTwu8gAvpCjC" target="_blank" rel="noopener">2단계 블록 설계</a></p>
  </section>`;
}

/* ---------- 렌더 ---------- */
function render() {
  header();
  if (state.dirty) return; // 입력 중인 폼은 덮어쓰지 않음
  const v = state.view;
  const html = v === "player" ? viewPlayer() : v === "intake" ? viewIntake() : v === "load" ? viewLoad() : v === "guide" ? viewGuide() : viewTeam();
  document.getElementById("main").innerHTML = html;
}
function go(view) {
  state.view = view; state.dirty = false; state.armed = null;
  try { history.replaceState(null, "", "#" + view); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
let toastT;
function toast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}
function failMsg(e) {
  const c = e && e.code;
  if (c === "invalid_argument") return "저장 권한이 없어요. 피지컬 담당자에게 요청해 주세요.";
  if (c === "quota_exceeded") return "저장 공간이 가득 찼어요. 오래된 기록을 지운 뒤 다시 시도해 주세요.";
  return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]");
  if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act;
  if (act === "view") return go(b.dataset.v);
  if (act === "week") { state.week = Number(b.dataset.w); state.dirty = false; return render(); }
  if (act === "open") { state.pid = b.dataset.pid; return go("player"); }
  if (act === "edit") { state.editPid = b.dataset.pid; state.dirty = false; state.armed = null; return render(); }
  if (act === "delplayer" || act === "deltest" || act === "dellog") {
    const key = (act === "delplayer" ? "player:" + b.dataset.pid : act === "deltest" ? "test:" + b.dataset.id : "log:" + b.dataset.id);
    if (state.armed !== key) { state.armed = key; state.dirty = false; return render(); }
    state.armed = null;
    try {
      if (act === "delplayer") {
        const pid = b.dataset.pid;
        await db.doc("players/" + pid).delete();
        await db.doc("health/" + pid).delete();
        await db.doc("tests/" + pid).delete();
        state.editPid = null; toast("선수를 삭제했어요");
      } else if (act === "deltest") {
        const pid = b.dataset.pid;
        const next = runs(pid).filter(t => t.id !== b.dataset.id);
        await db.doc("tests/" + pid).set({ runs: next });
        toast("측정값을 삭제했어요");
      } else {
        const entry = (state.logs[b.dataset.pid] || []).find(x => x._id === b.dataset.id);
        if (entry) {
          const ref = db.doc("logs/" + entry._owner);
          const snap = await ref.get();
          const list = snap.exists ? ((snap.data() || {}).entries || []) : [];
          await ref.set({ entries: list.filter(x => x.id !== entry._id) });
          toast("기록을 삭제했어요");
        }
      }
    } catch (e) { toast(failMsg(e)); }
    state.dirty = false; render();
  }
});
document.addEventListener("change", ev => {
  if (ev.target.id === "pp-select") { state.pid = ev.target.value; state.dirty = false; render(); return; }
  if (ev.target.id === "lg-type") {
    const k = ev.target.value, m = document.getElementById("lg-min");
    if (m) m.value = LOG_TYPES[k][1];
  }
});
document.addEventListener("input", ev => { if (ev.target.closest("form.f")) state.dirty = true; });

const num = id => { const v = document.getElementById(id).value; return v === "" ? null : Number(v); };
const txt = id => document.getElementById(id).value.trim();

document.addEventListener("submit", async ev => {
  ev.preventDefault();
  const f = ev.target;
  if (!db) return toast("팀 데이터에 연결되어 있지 않아요.");
  const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
  try {
    if (f.id === "playerForm") {
      const name = txt("pf-name");
      if (!name) { toast("이름을 입력해 주세요."); return; }
      const pid = f.dataset.pid || ("p" + Date.now().toString(36));
      const pain = { knee: num("hf-knee") || 0, shoulder: num("hf-shoulder") || 0, ankle: num("hf-ankle") || 0, back: num("hf-back") || 0 };
      const health = {
        ankleL: num("hf-al") || 0, ankleR: num("hf-ar") || 0, ankleLast: txt("hf-alast"),
        kneeInjury: document.getElementById("hf-knee-hx").checked, pain, note: txt("hf-note"),
        consent: document.getElementById("hf-consent").checked, updatedAt: iso(today()),
      };
      const adjust = {
        plyo: pain.ankle >= 3 ? "hold" : pain.knee >= 3 ? "iso" : null,
        overhead: pain.shoulder >= 3 ? true : null,
        back: pain.back >= 3 ? true : null,
        ankleBal: (health.ankleL + health.ankleR) > 0 ? true : null,
        refer: (pain.knee >= 3 || pain.shoulder >= 3 || pain.back >= 3 || pain.ankle >= 3) ? true : null,
      };
      const prev = state.players[pid] || {};
      const player = {
        name, pos: document.getElementById("pf-pos").value, year: txt("pf-year"),
        height: num("pf-height"), weight: num("pf-weight"), exp: num("pf-exp"),
        weightExp: document.getElementById("pf-wexp").value, adjust, order: prev.order ?? Object.keys(state.players).length + 1,
      };
      await db.doc("players/" + pid).set(player);
      await db.doc("health/" + pid).set(health);
      state.editPid = pid; state.dirty = false;
      toast(f.dataset.pid ? "저장했어요" : `${name} 선수를 추가했어요`);
    } else if (f.id === "testForm") {
      const pid = f.dataset.pid;
      const balv = id => { const v = document.getElementById(id).value; return v === "" ? null : v === "1"; };
      const t = { id: "t" + Date.now().toString(36), date: txt("tf-date") };
      const fields = { reach: num("tf-reach"), cmj: num("tf-cmj"), block: num("tf-block"), approach: num("tf-approach"), hsSec: num("tf-hsSec"), squat: num("tf-squat"), rdl: num("tf-rdl"), pull: num("tf-pull") };
      for (const [k, v] of Object.entries(fields)) if (v != null && !Number.isNaN(v)) t[k] = v;
      const st = document.getElementById("tf-hsStage").value; if (st) t.hsStage = Number(st);
      const bl = balv("tf-balL"), br = balv("tf-balR"); if (bl != null) t.balL = bl; if (br != null) t.balR = br;
      if (Object.keys(t).length <= 2) { toast("측정값을 하나 이상 입력해 주세요."); return; }
      await db.doc("tests/" + pid).set({ runs: [...runs(pid), t] });
      state.dirty = false; toast("측정값을 저장했어요");
    } else if (f.id === "logForm") {
      const pid = f.dataset.pid;
      const area = document.getElementById("lg-area").value;
      const e = {
        date: txt("lg-date"), type: document.getElementById("lg-type").value,
        minutes: num("lg-min") || 0, rpe: Number(document.getElementById("lg-rpe").value),
        jumps: num("lg-jumps"), painArea: area || null, pain: area ? (num("lg-pain") || 0) : 0, note: txt("lg-note"),
      };
      if (!state.uid) { toast("로그인한 상태에서만 기록을 남길 수 있어요."); return; }
      e.id = "l" + Date.now().toString(36); e.pid = pid;
      const ref = db.doc("logs/" + state.uid);
      const snap = await ref.get();
      const list = snap.exists ? ((snap.data() || {}).entries || []) : [];
      await ref.set({ entries: [...list, e] });
      state.dirty = false; toast("기록했어요");
    }
  } catch (e) { toast(failMsg(e)); if (e && e.code === "invalid_argument" && f.id === "logForm") state.canWrite = false; state.dirty = false; }
  finally { if (btn) btn.disabled = false; }
  render();
});

/* ---------- 데이터 연결 ---------- */
function snapErr() { /* 구독이 끊기면 화면은 마지막 상태를 유지 */ }
// 기록은 기록한 사람마다 문서 하나(logs/<기록자 id>)에 모은다. 담당자는 전체를, 그 외에는 자기 것만 읽는다.
function groupLogs(docs) {
  const out = {};
  for (const d of docs) {
    const body = d.data() || {};
    for (const e of (body.entries || [])) {
      (out[e.pid] = out[e.pid] || []).push({ ...e, _id: e.id, _owner: d.id });
    }
  }
  state.logs = out;
}
async function boot() {
  const h = (location.hash || "").replace("#", "");
  if (["team", "player", "guide", "intake", "load"].includes(h)) state.view = h;
  render();
  const use = window.claude && window.claude.use;
  if (!use) { state.offline = true; render(); return; }
  try { db = await window.claude.use("db"); } catch (e) { db = null; }
  let user = null;
  try { user = await window.claude.use("user"); } catch (e) { user = null; }
  state.admin = user ? await user.canEdit() : false;
  state.canWrite = user ? await user.can("data.write") : null;
  state.uid = user ? await user.id() : null;
  if (!db) { state.offline = true; render(); return; }
  db.doc("settings/main").onSnapshot(s => { state.settings = s.exists ? s.data() : null; render(); }, snapErr);
  db.collection("players").onSnapshot(s => {
    state.players = Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
    state.loaded = true; render();
  }, snapErr);
  db.collection("tests").onSnapshot(s => { state.tests = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); render(); }, snapErr);
  if (state.admin) {
    db.collection("health").onSnapshot(s => { state.health = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); render(); }, snapErr);
    db.collection("logs").onSnapshot(s => { groupLogs(s.docs); render(); }, snapErr);
  } else if (state.uid) {
    db.doc("logs/" + state.uid).onSnapshot(s => { groupLogs(s.exists ? [s] : []); render(); }, snapErr);
  }
  render();
}
boot();
</script>

</body></html>
````

</details>
