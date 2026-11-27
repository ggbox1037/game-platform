// @ts-nocheck
// 部署：supabase functions deploy sk（函式名稱必須是 sk；預設會驗證登入 JWT）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/* ===== 遊戲引擎（與前端相同的 engine.js）===== */
/* 地下尋金者 遊戲引擎：純函式、無任何 I/O。同一份程式碼同時給 Edge Function（可信任裁判）與前端（只用來顯示合法位置）。 */
var SKE=(function(){
var DX=[0,1,0,-1],DY=[-1,0,1,0]; // 邊：0 上 1 右 2 下 3 左
var CFG={MINP:3,MAXP:10,B:{x0:-2,x1:11,y0:-4,y1:4},GX:9,GY:[-2,0,2],LOG:40};
var TOOLS=['ladder','pump','light'];
var TN={ladder:'繩梯',pump:'抽水機',light:'頭燈'},TI={ladder:'🪜',pump:'💧',light:'🔦'};
// o=開口邊；g=「互通群組」。沒有群組 = 死路（有開口但中心被堵住，路不能穿過）
var PATHS={str:{o:[0,2],g:[[0,2]],n:'直道'},cur:{o:[0,1],g:[[0,1]],n:'彎道'},tee:{o:[0,1,2],g:[[0,1,2]],n:'T 字路'},crs:{o:[0,1,2,3],g:[[0,1,2,3]],n:'十字路'},
 d1:{o:[0],g:[],n:'死路・單口'},d2s:{o:[0,2],g:[],n:'死路・直斷'},d2c:{o:[0,1],g:[],n:'死路・彎斷'},d3:{o:[0,1,2],g:[],n:'死路・T 斷'},d4:{o:[0,1,2,3],g:[],n:'死路・十字斷'},
 brg:{o:[0,1,2,3],g:[[0,2],[1,3]],n:'立體橋（上下、左右各自相通）'}};
var GOALS={gold:{o:[0,1,2,3],g:[[0,1,2,3]]},ore:{o:[0,1,2,3],g:[[0,1,2,3]]},empty:{o:[0,1,2,3],g:[]}};
var GN={gold:'金礦',ore:'普通礦石',empty:'空礦洞'},GI={gold:'💰',ore:'💎',empty:'🕳️'};
var REPAIR={'r:ladder':['ladder'],'r:pump':['pump'],'r:light':['light'],'r:lp':['ladder','pump'],'r:pl':['pump','light'],'r:ll':['ladder','light']};
var DECK={'p:str':8,'p:cur':8,'p:tee':6,'p:crs':4,'p:d1':4,'p:d2s':2,'p:d2c':3,'p:d3':2,'p:d4':2,'p:brg':2,
 'b:ladder':3,'b:pump':3,'b:light':3,'r:ladder':2,'r:pump':2,'r:light':2,'r:lp':1,'r:pl':1,'r:ll':1,'m':5,'x':3,'s':2};
var SABS={3:1,4:1,5:2,6:2,7:3,8:3,9:3,10:3};
function sabCount(n){return SABS[n]||Math.max(1,Math.round(n*0.35))}
function handSize(n){return n<=5?6:n<=7?5:4}
function shuffle(a,rng){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(rng()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function rot(def,r){var open=[0,0,0,0],groups=[];def.o.forEach(function(e){open[(e+r)%4]=1});def.g.forEach(function(g){groups.push(g.map(function(e){return(e+r)%4}))});return{open:open,groups:groups}}
function shapeOf(key,r){return rot(PATHS[key],r|0)}
function info(id){var k=id.charAt(0),rest=id.slice(2);
 if(k==='p')return{k:'path',name:PATHS[rest].n,icon:'🧱',desc:'放在地圖上，邊緣必須和相鄰的道路吻合，並且接上起點延伸出來的通路。可以旋轉。身上有壞掉的工具時不能放。'};
 if(k==='b')return{k:'break',tool:rest,name:'破壞・'+TN[rest],icon:TI[rest],desc:'讓另一位玩家的「'+TN[rest]+'」壞掉。對方的工具壞掉時不能放道路牌。'};
 if(k==='r'){var t=REPAIR[id];return{k:'repair',tools:t,name:'修復・'+t.map(function(x){return TN[x]}).join('／'),icon:'🔧',desc:'修好任何一位玩家（包含自己）壞掉的「'+t.map(function(x){return TN[x]}).join('」或「')+'」。'}}
 if(k==='m')return{k:'map',name:'地圖查看',icon:'🗺️',desc:'偷看一個還沒公開的目標，結果只有你自己知道（其他人只知道你看了）。'};
 if(k==='x')return{k:'collapse',name:'拆除',icon:'💥',desc:'拆掉地圖上任何一張已放置的道路牌（起點與目標不能拆）。'};
 if(k==='s')return{k:'supply',name:'補給箱',icon:'📦',desc:'這回合多抽 2 張牌（不放牌也算行動）。'};
 return{k:'?',name:id,icon:'?',desc:''}}
function key(x,y){return x+','+y}
function goalAt(pub,x,y){for(var i=0;i<pub.goals.length;i++)if(pub.goals[i].x===x&&pub.goals[i].y===y)return i;return -1}
function inB(x,y){var b=CFG.B;return x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1}
// 取得某格的形狀；null=空格；{hidden:i}=還沒公開的目標
function cellInfo(pub,x,y){
 if(x===0&&y===0)return{open:[1,1,1,1],groups:[[0,1,2,3]],start:1};
 var c=pub.board[key(x,y)];if(c)return shapeOf(c.c,c.r);
 var gi=goalAt(pub,x,y);if(gi>=0){var g=pub.goals[gi];if(g.t)return rot(GOALS[g.t],0);return{hidden:gi}}
 return null}
// 從起點開始走，找出所有「連通的邊」。gt（目標真實內容，只有伺服器有）給了，碰到未公開目標就回報 touched。
function reach(pub,gt){
 var seen={},q=[],nodes={},touched=-1;
 function add(x,y,e){var k=x+','+y+','+e;if(!seen[k]){seen[k]=1;nodes[k]=1;q.push([x,y,e])}}
 for(var e=0;e<4;e++)add(0,0,e);
 while(q.length){var n=q.pop(),x=n[0],y=n[1],ed=n[2],ci=cellInfo(pub,x,y);
  if(ci&&ci.groups)ci.groups.forEach(function(g){if(g.indexOf(ed)>=0)g.forEach(function(e2){add(x,y,e2)})});
  var nx=x+DX[ed],ny=y+DY[ed];if(!inB(nx,ny)&&goalAt(pub,nx,ny)<0)continue;
  var ni=cellInfo(pub,nx,ny);if(!ni)continue;
  if(ni.hidden!==undefined){if(gt&&touched<0)touched=ni.hidden;continue}
  var oe=(ed+2)%4;if(ni.open[oe])add(nx,ny,oe)}
 return{nodes:nodes,touched:touched}}
// 合法放置：不能出界、不能蓋住別的牌、每個鄰居的邊要吻合（未公開目標視為萬用）、且至少接上「起點連通的通路」
function legalPlace(pub,card,x,y,r,R){
 if(card.charAt(0)!=='p')return'不是道路牌';
 if(!inB(x,y))return'超出礦坑範圍';
 if(x===0&&y===0||pub.board[key(x,y)]||goalAt(pub,x,y)>=0)return'這格已經有東西';
 var sh=shapeOf(card.slice(2),r),R2=R||reach(pub,null),connected=false;
 for(var d=0;d<4;d++){var nx=x+DX[d],ny=y+DY[d],ni=cellInfo(pub,nx,ny);if(!ni||ni.hidden!==undefined)continue;
  var oe=(d+2)%4;if(!!sh.open[d]!==!!ni.open[oe])return'道路邊緣對不上';
  if(sh.open[d]&&R2.nodes[nx+','+ny+','+oe])connected=true}
 return connected?null:'沒有接上起點延伸出來的通路'}
function placements(pub,card){var R=reach(pub,null),out=[],b=CFG.B;
 for(var x=b.x0;x<=b.x1;x++)for(var y=b.y0;y<=b.y1;y++)for(var r=0;r<4;r++)if(legalPlace(pub,card,x,y,r,R)===null)out.push({x:x,y:y,r:r});
 return out}
function pushLog(p,s,t){p.log.push({s:s,t:t});if(p.log.length>CFG.LOG)p.log.shift()}
function newGame(names,rng,host){
 var n=names.length;if(n<CFG.MINP||n>CFG.MAXP)throw new Error('人數必須是 '+CFG.MINP+'～'+CFG.MAXP+' 人');
 var deck=[];Object.keys(DECK).forEach(function(k){for(var i=0;i<DECK[k];i++)deck.push(k)});deck=shuffle(deck,rng);
 var roles=[],s=sabCount(n),i;for(i=0;i<s;i++)roles.push('saboteur');while(roles.length<n+1)roles.push('miner');roles=shuffle(roles,rng);
 var left=roles.pop(),hs=handSize(n),sec={},pl=[];
 for(i=0;i<n;i++){var hand=[];for(var j=0;j<hs;j++)hand.push(deck.pop());sec[i]={role:roles[i],hand:hand,peeks:{}};pl.push({s:i,name:names[i],br:{ladder:0,pump:0,light:0},hc:hs,gone:0})}
 var pub={gid:Math.floor(rng()*1e9).toString(36),phase:'play',n:n,host:host|0,turn:Math.floor(rng()*n),no:1,deckLeft:deck.length,board:{},
  goals:CFG.GY.map(function(y){return{x:CFG.GX,y:y,t:null}}),players:pl,log:[],result:null,last:null};
 pushLog(pub,-1,'遊戲開始！'+n+' 位玩家，其中有破壞者混在裡面。');
 return{pub:pub,srv:{deck:deck,disc:0,goals:shuffle(['gold','ore','empty'],rng),left:left},sec:sec}}
function removeCard(hand,id){var i=hand.indexOf(id);if(i<0)return false;hand.splice(i,1);return true}
function draw(st,seat,k){var h=st.sec[seat].hand;for(var i=0;i<k&&st.srv.deck.length;i++)h.push(st.srv.deck.pop());st.pub.deckLeft=st.srv.deck.length}
function sync(st){st.pub.players.forEach(function(p,i){p.hc=st.sec[i].hand.length});st.pub.deckLeft=st.srv.deck.length}
function endGame(st,winner,reason){var p=st.pub;p.phase='end';
 p.result={winner:winner,reason:reason,roles:p.players.map(function(x,i){return{s:i,role:st.sec[i].role}}),goals:st.srv.goals.slice()};
 pushLog(p,-1,winner==='miner'?'⛏️ 礦工找到金礦，礦工獲勝！':winner==='saboteur'?'🕳️ 破壞者獲勝！':'遊戲結束');}
function revealLoop(st){var p=st.pub;
 for(var guard=0;guard<6;guard++){var R=reach(p,st.srv.goals);if(R.touched<0)break;
  var g=p.goals[R.touched];g.t=st.srv.goals[R.touched];pushLog(p,-1,'通路抵達目標 '+(R.touched+1)+'：是'+GI[g.t]+GN[g.t]+'！');
  if(g.t==='gold'){endGame(st,'miner','金礦被挖到了');return}}}
function allEmpty(st){for(var i in st.sec)if(st.sec[i].hand.length)return false;return true}
function discardRandom(st,seat,rng){var h=st.sec[seat].hand;if(!h.length)return;
 var i=Math.floor(rng()*h.length);h.splice(i,1);st.srv.disc++;draw(st,seat,1);sync(st);pushLog(st.pub,seat,st.pub.players[seat].name+' 離線，自動棄了一張牌')}
function advance(st,rng){var p=st.pub;if(p.phase!=='play')return;sync(st);
 for(var guard=0;guard<p.n*4;guard++){
  if(!st.srv.deck.length&&allEmpty(st)){endGame(st,'saboteur','牌庫與手牌都用完了，沒有人挖到金礦');return}
  p.turn=(p.turn+1)%p.n;var s=st.sec[p.turn];
  if(!s.hand.length)continue;
  if(p.players[p.turn].gone){discardRandom(st,p.turn,rng);continue}
  p.no++;return}
 endGame(st,'none','沒有玩家能繼續遊戲')}
// 套用玩家行動（伺服器端驗證）。回傳 {ok,err,priv}；任何驗證失敗都不會改動 st。
function act(st,seat,a,rng){
 var p=st.pub;if(p.phase!=='play')return{ok:false,err:'遊戲不在進行中'};
 if(p.turn!==seat)return{ok:false,err:'還沒輪到你'};
 var me=p.players[seat],sec=st.sec[seat],card=a&&a.card,type=a&&a.type;
 if(typeof card!=='string'||sec.hand.indexOf(card)<0)return{ok:false,err:'你的手牌裡沒有這張牌'};
 var priv=null,nm=me.name,i=(x)=>Number.isInteger(x),draws=1,ci=info(card);
 if(type==='discard'){}
 else if(type==='place'){
  if(ci.k!=='path')return{ok:false,err:'這不是道路牌'};
  if(TOOLS.some(function(t){return me.br[t]}))return{ok:false,err:'你的工具壞了，不能放道路牌，請先修復'};
  if(!i(a.x)||!i(a.y)||!i(a.r)||a.r<0||a.r>3)return{ok:false,err:'位置不正確'};
  var e=legalPlace(p,card,a.x,a.y,a.r);if(e)return{ok:false,err:e}}
 else if(type==='break'){
  if(ci.k!=='break')return{ok:false,err:'這不是破壞牌'};var t=p.players[a.target];
  if(!i(a.target)||!t||a.target===seat)return{ok:false,err:'請選擇另一位玩家'};
  if(t.gone)return{ok:false,err:'對方已離開'};if(t.br[ci.tool])return{ok:false,err:'對方的'+TN[ci.tool]+'已經壞了'}}
 else if(type==='repair'){
  if(ci.k!=='repair')return{ok:false,err:'這不是修復牌'};var t2=p.players[a.target];
  if(!i(a.target)||!t2)return{ok:false,err:'請選擇玩家'};
  if(ci.tools.indexOf(a.tool)<0||!t2.br[a.tool])return{ok:false,err:'那位玩家沒有這個壞掉的工具'}}
 else if(type==='map'){
  if(ci.k!=='map')return{ok:false,err:'這不是地圖查看牌'};
  if(!i(a.goal)||!p.goals[a.goal])return{ok:false,err:'請選擇目標'};if(p.goals[a.goal].t)return{ok:false,err:'這個目標已經公開了'}}
 else if(type==='collapse'){
  if(ci.k!=='collapse')return{ok:false,err:'這不是拆除牌'};if(!i(a.x)||!i(a.y)||!p.board[key(a.x,a.y)])return{ok:false,err:'那格沒有可以拆的道路牌'}}
 else if(type==='supply'){if(ci.k!=='supply')return{ok:false,err:'這不是補給箱'};draws=3}
 else return{ok:false,err:'未知的行動'};
 // —— 驗證通過，開始修改 ——
 removeCard(sec.hand,card);st.srv.disc++;
 if(type==='discard'){pushLog(p,seat,nm+' 棄了一張牌');p.last={s:seat,type:'discard'}}
 else if(type==='place'){p.board[key(a.x,a.y)]={c:card.slice(2),r:a.r,by:seat};pushLog(p,seat,nm+' 放了「'+ci.name+'」');p.last={s:seat,type:'place',x:a.x,y:a.y}}
 else if(type==='break'){p.players[a.target].br[ci.tool]=1;pushLog(p,seat,nm+' 弄壞了 '+p.players[a.target].name+' 的'+TN[ci.tool]+TI[ci.tool]);p.last={s:seat,type:'break',target:a.target,card:card}}
 else if(type==='repair'){p.players[a.target].br[a.tool]=0;pushLog(p,seat,nm+' 修好了 '+(a.target===seat?'自己':p.players[a.target].name)+' 的'+TN[a.tool]+TI[a.tool]);p.last={s:seat,type:'repair',target:a.target,card:card}}
 else if(type==='map'){sec.peeks[a.goal]=st.srv.goals[a.goal];priv={goal:a.goal,t:st.srv.goals[a.goal]};pushLog(p,seat,nm+' 偷看了目標 '+(a.goal+1)+' 🗺️');p.last={s:seat,type:'map',goal:a.goal}}
 else if(type==='collapse'){delete p.board[key(a.x,a.y)];pushLog(p,seat,nm+' 拆掉了一段道路 💥');p.last={s:seat,type:'collapse',x:a.x,y:a.y}}
 else if(type==='supply'){pushLog(p,seat,nm+' 打開補給箱，多抽 2 張牌 📦');p.last={s:seat,type:'supply'}}
 draw(st,seat,draws>1?draws:1);if(draws>1)draw(st,seat,0);sync(st);
 if(type==='place')revealLoop(st);
 if(p.phase==='play')advance(st,rng);
 return{ok:true,priv:priv}}
// 讓目前輪到的（離線）玩家自動棄牌，避免遊戲卡住
function autoSkip(st,rng){var p=st.pub;if(p.phase!=='play')return false;var s=p.turn;if(!st.sec[s].hand.length)return false;
 discardRandom(st,s,rng);advance(st,rng);return true}
function setGone(st,seat,rng){var p=st.pub;if(!p.players[seat]||p.players[seat].gone)return;p.players[seat].gone=1;pushLog(p,-1,p.players[seat].name+' 離開了遊戲');
 if(p.phase==='play'&&p.turn===seat){autoSkip(st,rng)}
 else if(p.phase==='play'&&p.players.every(function(x){return x.gone}))endGame(st,'none','所有玩家都離開了')}
return{CFG:CFG,TOOLS:TOOLS,TN:TN,TI:TI,GN:GN,GI:GI,PATHS:PATHS,DECK:DECK,REPAIR:REPAIR,DX:DX,DY:DY,sabCount:sabCount,SABS:SABS,handSize:handSize,shuffle:shuffle,
 shapeOf:shapeOf,info:info,key:key,cellInfo:cellInfo,reach:reach,legalPlace:legalPlace,placements:placements,newGame:newGame,act:act,autoSkip:autoSkip,setGone:setGone,goalAt:goalAt}})();


/* ===== 裁判程式 ===== */
// ===== Edge Function：sk（地下尋金者的可信任裁判）=====
const URL_=Deno.env.get("SUPABASE_URL")!, SRK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(URL_,SRK,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const STALE_HOST=30000, STALE_TURN=45000;
async function sha(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function tok(){return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,"0")).join("")}
const cleanName=(s:any)=>String(s||"").replace(/[<>&"'`]/g,"").trim().slice(0,8);
class Fail extends Error{}
const fail=(m:string)=>{throw new Fail(m)};

// 以「鎖」確保同一個房間同一時間只處理一個請求
async function lock(code:string){
  for(let i=0;i<8;i++){
    const now=new Date(),until=new Date(now.getTime()+8000).toISOString();
    const {data}=await db.from("sk_rooms").update({locked_until:until}).eq("code",code).or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select("code,pub,version");
    if(data&&data.length)return data[0];
    const ex=await db.from("sk_rooms").select("code").eq("code",code).maybeSingle();
    if(!ex.data)fail("找不到這個房間");
    await sleep(120+Math.random()*120);
  }
  fail("房間忙碌中，請再試一次");
}
async function unlock(code:string){await db.from("sk_rooms").update({locked_until:null}).eq("code",code)}
async function loadAll(row:any){
  const [seats,secs,srv]=await Promise.all([
    db.from("sk_seats").select("seat,uid,token_hash,last_seen").eq("code",row.code),
    db.from("sk_secrets").select("seat,secret").eq("code",row.code),
    db.from("sk_server").select("data").eq("code",row.code).maybeSingle()]);
  const sec:any={};(secs.data||[]).forEach((r:any)=>sec[r.seat]=r.secret);
  return{pub:row.pub,version:row.version,seats:seats.data||[],sec,srv:srv.data?srv.data.data:null};
}
async function saveRoom(code:string,st:any,secChanged=true){
  const tasks:any[]=[];
  if(st.srv)tasks.push(db.from("sk_server").upsert({code,data:st.srv}));
  if(secChanged&&st.pub.phase!=="lobby"){
    const rows=Object.keys(st.sec).map(s=>{const seat=st.seats.find((x:any)=>x.seat==+s);return seat?{code,seat:+s,uid:seat.uid,secret:st.sec[s]}:null}).filter(Boolean);
    if(rows.length)tasks.push(db.from("sk_secrets").upsert(rows));
  }
  const rs=await Promise.all(tasks);for(const r of rs)if(r.error)throw new Error(r.error.message);
  const {error}=await db.from("sk_rooms").update({pub:st.pub,version:st.version+1,updated_at:new Date().toISOString(),locked_until:null}).eq("code",code);
  if(error)throw new Error(error.message);
}
async function withRoom(code:string,fn:(st:any)=>Promise<any>|any,secChanged=true){
  const row=await lock(code);
  try{
    const st=await loadAll(row);const out=await fn(st);
    if(out&&out.noSave){await unlock(code);return {...out,version:st.version}}
    await saveRoom(code,st,secChanged);return {...(out||{}),version:st.version+1};
  }catch(e){await unlock(code);throw e}
}
function seatOf(st:any,uid:string){const s=st.seats.find((x:any)=>x.uid===uid);if(!s)fail("你不在這個房間裡");return s.seat}
function meOf(st:any,seat:number){return st.sec[seat]?{seat,...st.sec[seat]}:{seat}}
const isHost=(st:any,seat:number)=>st.pub.host===seat;
function nameOk(st:any,name:string){let n=name,i=2;while(st.pub.players.some((p:any)=>p.name===n))n=name.slice(0,7)+i++;return n}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  try{
    const jwt=(req.headers.get("Authorization")||"").replace("Bearer ","");
    const {data:u,error:ue}=await db.auth.getUser(jwt);
    if(ue||!u||!u.user)return J({ok:false,err:"未登入"},401);
    const uid=u.user.id,b=await req.json(),op=b.op,code=String(b.code||"");

    if(op==="create"){
      const name=cleanName(b.name);if(!name)fail("請輸入名字");
      await db.rpc("sk_cleanup").then(()=>{},()=>{});
      const token=tok(),th=await sha(token);let c="";
      for(let i=0;i<30;i++){
        c=String(Math.floor(1000+rng()*9000));
        const pub={phase:"lobby",host:0,n:1,players:[{s:0,name,ready:1,gone:0}],log:[],result:null};
        const r=await db.from("sk_rooms").insert({code:c,pub,version:1});
        if(!r.error)break;if(i===29)fail("建立房間失敗，請再試一次");
      }
      const s=await db.from("sk_seats").insert({code:c,seat:0,uid,token_hash:th});
      if(s.error){await db.from("sk_rooms").delete().eq("code",c);throw new Error(s.error.message)}
      const row=await db.from("sk_rooms").select("pub,version").eq("code",c).single();
      return J({ok:true,code:c,token,seat:0,pub:row.data.pub,version:row.data.version});
    }
    if(op==="join"){
      const name=cleanName(b.name);if(!name)fail("請輸入名字");
      const token=tok(),th=await sha(token);
      return J(await withRoom(code,async(st)=>{
        const ex=st.seats.find((x:any)=>x.uid===uid);if(ex)fail("你已經在這個房間了，請用「回到房間」");
        if(st.pub.phase!=="lobby")fail("遊戲已經開始，無法加入");
        if(st.pub.players.length>=SKE.CFG.MAXP)fail("房間已滿（最多 "+SKE.CFG.MAXP+" 人）");
        const seat=(st.pub.players.reduce((m:number,p:any)=>Math.max(m,p.s),-1))+1;
        const nm=nameOk(st,name);
        const r=await db.from("sk_seats").insert({code,seat,uid,token_hash:th});if(r.error)fail("加入失敗，請再試一次");
        st.seats.push({seat,uid});st.pub.players.push({s:seat,name:nm,ready:0,gone:0});st.pub.n=st.pub.players.length;
        st.pub.log.push({s:-1,t:nm+" 加入了房間"});
        return{token,seat,pub:st.pub};
      },false).then((o:any)=>({ok:true,...o,code})));
    }
    if(op==="rejoin"){
      const th=await sha(String(b.token||""));
      return J(await withRoom(code,async(st)=>{
        const s=st.seats.find((x:any)=>x.token_hash===th);if(!s)fail("憑證無效，請重新加入");
        if(s.uid!==uid){
          const r=await db.from("sk_seats").update({uid}).eq("code",code).eq("seat",s.seat);if(r.error)throw new Error(r.error.message);
          await db.from("sk_secrets").update({uid}).eq("code",code).eq("seat",s.seat);s.uid=uid;
        }
        await db.from("sk_seats").update({last_seen:new Date().toISOString()}).eq("code",code).eq("seat",s.seat);
        const p=st.pub.players.find((x:any)=>x.s===s.seat);if(p&&p.gone)fail("你已經離開這場遊戲");
        return{noSave:true,seat:s.seat,pub:st.pub,version:st.version,me:meOf(st,s.seat)};
      }).then((o:any)=>({ok:true,...o,code})));
    }
    // 以下都需要是房間成員
    if(op==="heartbeat"){
      const r=await db.from("sk_seats").update({last_seen:new Date().toISOString()}).eq("code",code).eq("uid",uid).select("seat");
      if(!r.data||!r.data.length)return J({ok:false,err:"不在房間"});
      const v=await db.from("sk_rooms").select("version").eq("code",code).maybeSingle();
      return J({ok:true,version:v.data?v.data.version:-1});
    }
    return J(await withRoom(code,async(st)=>{
      const seat=seatOf(st,uid),p=st.pub;
      const now=Date.now(),stale=(s:number,ms:number)=>{const x=st.seats.find((q:any)=>q.seat===s);return !x||now-new Date(x.last_seen).getTime()>ms};
      const me=()=>meOf(st,seat);
      if(op==="ready"){if(p.phase!=="lobby")fail("已經開始了");const pl=p.players.find((x:any)=>x.s===seat);pl.ready=b.ready?1:0;return{ok:true,pub:p}}
      if(op==="kick"){
        if(!isHost(st,seat))fail("只有房主可以請人離開");if(p.phase!=="lobby")fail("遊戲開始後不能踢人");
        const t=+b.seat;if(t===seat)fail("不能踢自己");const i=p.players.findIndex((x:any)=>x.s===t);if(i<0)fail("找不到玩家");
        const nm=p.players[i].name;p.players.splice(i,1);p.n=p.players.length;p.log.push({s:-1,t:nm+" 被房主請出房間"});
        await db.from("sk_seats").delete().eq("code",code).eq("seat",t);return{ok:true,pub:p}}
      if(op==="leave"){
        if(p.phase==="lobby"){
          const i=p.players.findIndex((x:any)=>x.s===seat);p.players.splice(i,1);p.n=p.players.length;
          await db.from("sk_seats").delete().eq("code",code).eq("seat",seat);
          if(!p.players.length){await db.from("sk_rooms").delete().eq("code",code);return{noSave:true,ok:true}}
          if(p.host===seat){p.host=p.players[0].s;p.log.push({s:-1,t:p.players[0].name+" 成為新房主"})}
        }else SKE.setGone(st,seat,rng);
        if(p.phase!=="lobby"&&p.host===seat){const nx=p.players.find((x:any)=>!x.gone);if(nx){p.host=nx.s;p.log.push({s:-1,t:nx.name+" 成為新房主"})}}
        return{ok:true,pub:p,left:true}}
      if(op==="start"||op==="again"){
        if(!isHost(st,seat))fail("只有房主可以開始遊戲");
        if(op==="again"&&p.phase!=="end")fail("遊戲還沒結束");if(op==="start"&&p.phase!=="lobby")fail("已經開始了");
        const pls=p.players.filter((x:any)=>!x.gone).sort((a:any,c:any)=>a.s-c.s);
        if(pls.length<SKE.CFG.MINP||pls.length>SKE.CFG.MAXP)fail("需要 "+SKE.CFG.MINP+"～"+SKE.CFG.MAXP+" 位玩家");
        if(op==="start"&&pls.some((x:any)=>x.s!==p.host&&!x.ready))fail("還有玩家沒有按「準備」");
        // 重新編成連續座位 0..n-1
        const map:any={},seatsNew:any[]=[];pls.forEach((x:any,i:number)=>{map[x.s]=i;const sr=st.seats.find((q:any)=>q.seat===x.s);seatsNew.push({...sr,seat:i})});
        await db.from("sk_secrets").delete().eq("code",code);await db.from("sk_seats").delete().eq("code",code);
        const ins=await db.from("sk_seats").insert(seatsNew.map((s:any)=>({code,seat:s.seat,uid:s.uid,token_hash:s.token_hash,last_seen:new Date().toISOString()})));
        if(ins.error)throw new Error(ins.error.message);
        const g=SKE.newGame(pls.map((x:any)=>x.name),rng,map[p.host]);
        st.pub=g.pub;st.srv=g.srv;st.sec=g.sec;st.seats=seatsNew;
        return{ok:true,pub:st.pub,me:{seat:map[seat],...st.sec[map[seat]]},seat:map[seat]}}
      if(op==="act"){
        const r=SKE.act(st,seat,b.a,rng);if(!r.ok)return{noSave:true,ok:false,err:r.err};
        return{ok:true,pub:st.pub,me:me(),priv:r.priv}}
      if(op==="claimHost"){
        if(isHost(st,seat))return{noSave:true,ok:true,pub:p};
        const host=p.players.find((x:any)=>x.s===p.host);
        if(!(host&&host.gone)&&!stale(p.host,STALE_HOST))fail("房主還在線上");
        const alive=p.players.filter((x:any)=>!x.gone&&!stale(x.s,STALE_HOST)).sort((a:any,c:any)=>a.s-c.s);
        if(!alive.length||alive[0].s!==seat)fail("由座位較前面的玩家接任");
        p.host=seat;p.log.push({s:-1,t:p.players.find((x:any)=>x.s===seat).name+" 接任房主"});return{ok:true,pub:p}}
      if(op==="skip"){ // 輪到的人離線太久：任何成員可以幫他自動棄牌
        if(p.phase!=="play")fail("遊戲不在進行中");if(p.turn===seat)fail("輪到你了，請自己出牌");
        if(!stale(p.turn,STALE_TURN))fail("對方還在線上");
        SKE.autoSkip(st,rng);return{ok:true,pub:p,me:me()}}
      if(op==="sync")return{noSave:true,ok:true,pub:p,version:st.version,me:me(),seat};
      fail("未知的操作");
    }));
  }catch(e){
    if(e instanceof Fail)return J({ok:false,err:e.message});
    console.error(e);return J({ok:false,err:"伺服器錯誤，請再試一次"});
  }
});
