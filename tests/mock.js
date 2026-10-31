/* 브라우저에 넣는 가짜 Supabase (진짜 서버에 안 붙음)
 * - role: "coach"(관리자 · 최수혁 p1) / "player"(부원 · 홍길동 p2)
 * - 쓰기는 window.__w 에 [표, 동작, 값] 으로 쌓여서 테스트가 확인함
 * - 데이터는 2026년 10~11월 기준 (run.js 가 브라우저 시계를 2026-11-01 로 고정) */
const DB = String.raw`
const P1='p1',P2='p2';
const db = {
  events:[{id:'e1',name:'서울대배',kind:'major',start_date:'2026-11-21',end_date:'2026-11-22'},{id:'e2',name:'9인제 OO배',kind:'minor',start_date:'2026-11-07',end_date:'2026-11-07'},{id:'e3',name:'2학기 종강',kind:'termend',start_date:'2026-12-14',end_date:'2026-12-14'}],
  settings:[{name:'서울대배',block_start:'2026-10-26',start_date:'2026-11-21',end_date:'2026-11-22'}],
  players:[{id:P1,name:'최수혁',pos:'S',weight_exp:'oly',height:180,weight:72,adjust:{},sort:1},{id:P2,name:'홍길동',pos:'MB',weight_exp:'none',adjust:{plyo:'iso',refer:true},sort:2}],
  tests:[{id:'t1',player_id:P1,date:'2026-10-26',cmj:45,reach:236,approach:330,block:320,squat:90,bal_l:true,bal_r:true,hs_stage:3,side_l:60,side_r:52,plank:110},{id:'t2',player_id:P1,date:'2026-11-03',side_l:72,side_r:70,plank:140,author:'u1'},{id:'t3',player_id:P2,date:'2026-10-26',side_l:40,side_r:45,plank:80},{id:'t5',player_id:P2,date:'2026-10-20',cmj:40,squat:60,hop_l:150,hop_r:175,ktw_l:8,ktw_r:12,ir_d:40,ir_n:62,er_d:100,er_n:95,rsi:1.6},{id:'t4',player_id:P1,date:'2026-11-04',hs_stage:5,hs_walk:6.5,author:'u1'}],
  health: role==='coach'?[{player_id:P1,pain:{},rehab:[],ankle_l:1,ankle_r:0,custom:{memo:'토요일 리시브 추가',skip:['핸드스탠드'],swap:[{from:'백스쿼트',to:'고블릿 스쿼트'}]}},{player_id:P2,pain:{knee:4},rehab:[],injuries:[{side:'R',part:'finger',finger:'index',type:'손가락 염좌 (인대)',grade:'partial',status:'ok',year:'2026'},{side:'R',part:'knee',type:'전방십자인대(ACL) 파열',year:'2025',surgery:true,status:'rehab'},{side:'R',part:'ankle',type:'발목 염좌 (바깥쪽 인대)',year:'2026',surgery:false}]}]:[{player_id:P2,pain:{knee:4},rehab:[{area:'knee',stage:2},{area:'finger',stage:3}]}],
  pain_checks:[{id:'pc1',player_id:P2,date:'2026-11-02',area:'knee',during:0,morning:5,rest:false},{id:'pc2',player_id:P1,date:'2026-11-02',area:'shoulder',during:2,morning:0,rest:false}], logs:[{id:'l1',player_id:P1,date:'2026-10-26',type:'A',minutes:75,rpe:6,jumps:40},{id:'l2',player_id:P2,date:'2026-10-27',type:'other',minutes:30,rpe:3,pain_area:'knee',pain:5},{id:'l3',player_id:P1,date:'2026-10-28',type:'team',minutes:180,rpe:5}], inbody: role==='coach'?[{id:'i1',player_id:P1,date:'2026-10-20',weight:73.4,smm:35.1,pbf:12.3,leg_l:9.8,leg_r:10.1,standardized:true},{id:'i2',player_id:P1,date:'2026-10-27',weight:73.0,smm:35.4,pbf:12.0,leg_l:9.0,leg_r:10.2,standardized:false}]:[],
  wellness:[{id:'w1',player_id:P2,date:'2026-10-26',sleep:2,fatigue:2,soreness:2,stress:2,mood:2},{id:'w2',player_id:P1,date:'2026-10-26',sleep:4,fatigue:4,soreness:3,stress:4,mood:4},{id:'w3',player_id:P1,date:'2026-10-20',sleep:3,fatigue:3,soreness:3,stress:3,mood:3}],
  team_off:[{date:'2026-10-28',note:'체육관 통제'}],
  day_picks:[],
  lift_sets:[{id:'lf1',player_id:P1,date:'2026-10-19',name:'백스쿼트',lift:'squat',kg:85,reps:5,rir:2,author:'u1'},{id:'lf2',player_id:P1,date:'2026-10-24',name:'백스쿼트',lift:'squat',kg:90,reps:4,rir:2,author:'u1'},{id:'lf3',player_id:P2,date:'2026-10-24',name:'덤벨 벤치프레스',lift:'bench',kg:20,reps:8,rir:2,author:'u2'}],
  profiles:[{id:'u1',email:'coach@snuvt.test',role:'coach',player_id:P1},{id:'u3',email:'new@snuvt.test',role:'pending',player_id:null}],
};
const me = role==='coach'?{id:'u1',role:'coach',player_id:P1}:{id:'u2',role:'player',player_id:P2};
function q(t){ const res={data:db[t]||[],error:null}; const KEY={wellness:r=>r.player_id+r.date,day_picks:r=>r.player_id+r.date,team_off:r=>r.date,health:r=>r.player_id}; window.__w=window.__w||[]; let del=false;
  const o={select:()=>o,order:()=>o,gte:()=>o,lt:()=>o,limit:()=>o,range:()=>o,in:()=>o,eq:(k,v)=>{ if(del){ db[t]=(db[t]||[]).filter(r=>r[k]!==v); } return o;},
  insert:r=>{if(window.__offline)return o; window.__w.push([t,'insert',r]); (db[t]=db[t]||[]).push({id:'n'+Math.random(),author:me.id,...r}); return o;},
  upsert:(r)=>{window.__w.push([t,'upsert',r]); const kf=KEY[t]; db[t]=(db[t]||[]).filter(x=>!kf||kf(x)!==kf(r)); db[t].push({id:'n'+Math.random(),...r}); return o;},
  delete:()=>{window.__w.push([t,'delete']); del=true; return o;},
  update:()=>o,maybeSingle:()=>Promise.resolve(window.__offline?{data:null,error:{message:'TypeError: Failed to fetch'}}:t==='profiles'?{data:me,error:null}:{data:(db[t]||[])[0]||null,error:null}),single:()=>Promise.resolve({data:{id:'x'+Math.random()},error:null}),then:(a,b)=>Promise.resolve(window.__offline?{data:null,error:{message:'TypeError: Failed to fetch'}}:res).then(a,b)}; return o;}
let profCalls=0;
const client={auth:{getSession:async()=>({data:{session:{user:{id:me.id,email:role==='coach'?'coach@snuvt.test':'player@snuvt.test'}}}}),onAuthStateChange:cb=>setTimeout(()=>cb('INITIAL_SESSION'),0)},from:t=>{ if(t==='profiles'){profCalls++; const o=q(t); if(profCalls===1)return o; return {select:()=>({order:()=>Promise.resolve({data:db.profiles,error:null}),eq:()=>({maybeSingle:()=>Promise.resolve({data:me,error:null})})})};} return q(t);},rpc:async()=>({})};

// 일본 고교 (아주 작은 가짜 데이터)
db.jp_schools=[{id:"seifu",name_ja:"清風",name_ko:"세이후",pref:"大阪",gender:"m",aliases:[]},{id:"omi",name_ja:"近江",name_ko:"오미",pref:"滋賀",gender:"m",aliases:[]},{id:"sendai-shoko",name_ja:"川内商工",name_ko:"센다이쇼코",pref:"鹿児島",gender:"m",aliases:[]}];
db.jp_videos=[{id:"test0000001",source:"search",title:"清風 vs 近江 | 春高 決勝",year:2026,tourn:"haruko",gender:"m",rnd:"F",schools:["seifu","omi"],ch:"test",len:"1:00:00",noembed:false},{id:"test0000002",source:"search",title:"川内商工 練習",year:2026,tourn:"practice",gender:"m",rnd:null,schools:["sendai-shoko"],ch:"test",len:"20:00",noembed:false}];
for (const t of ["jp_pref_top","jp_sources","jp_results","jp_matches","jp_block_top","jp_rank","jp_stars","jp_roster","guest_votes"]) db[t]=[];
db.friendlies=[{id:"f1",team_id:"men",date:"2026-11-08",opponent:"연세대",format:"6",start_time:"14:00",end_time:"17:00",vote_to:["p1"]}];
// 여자부 (다른 팀) 일정 재료 · 우리 팀 훈련에 오는 여자부
const GUEST_CAL={team:{id:"women",label:"여자부",swap_days:true},events:[],off:["2026-11-09"],times:[{key:"2026-11-12",start:"19:00",end:"21:00"}],fr:["2026-11-05"]};
const GUEST_LIST=role==="coach"?[{date:"2026-11-04",name:"김여부",pos:"S",team:"women",start_time:"19:00",end_time:"21:00"}]:[];
const JP_COLS=["id","source","title","published","year","tourn","gender","rnd","schools","ch","len","noembed"];
window.supabase={createClient:()=>{client.functions={invoke:async()=>({data:{}})};client.rpc=async n=>n==="jp_videos_pack"?{data:db.jp_videos.map(v=>JP_COLS.map(k=>v[k]===undefined?null:v[k])),error:null}:n==="guest_cal"?{data:GUEST_CAL,error:null}:n==="guest_list"?{data:GUEST_LIST,error:null}:{data:null,error:null};return client;}};
`;
const mockScript = role => `(function(){const role=${JSON.stringify(role)};${DB}})();`;
module.exports = { mockScript };
