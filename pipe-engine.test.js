const assert=require("assert"),E=require("../pipe-engine.js");
let n=0;function t(name,f){f();n++;console.log("ok -",name)}
function lvl(extra){return Object.assign({seed:1,size:8,tickMs:1000,delay:2,source:{x:0,y:3,dir:1},target:{x:7,y:3},obstacles:[{x:3,y:0}],path:[],inv:{straight:12,elbow:16,tee:5,cross:3}},extra||{})}
function line(s,a,b,y,by){for(let x=a;x<=b;x++){const r=E.place(s,by||"A",x,y,"straight",1);assert(r.ok,"place "+x+" "+r.err)}}
function run(s,max){let last=[];for(let i=0;i<max&&s.status==="flow";i++)last=E.tick(s);return last}

t("放置權限與庫存",()=>{const s=E.createGame(lvl());
 assert.equal(E.place(s,"A",3,0,"straight",0).err,"blocked");
 assert.equal(E.place(s,"A",0,3,"straight",0).err,"blocked");
 assert.equal(E.place(s,"A",7,3,"straight",0).err,"blocked");
 assert(E.place(s,"A",1,3,"straight",1).ok);
 assert.equal(E.place(s,"B",1,3,"elbow",0).err,"occupied");
 assert.equal(s.inv.straight,11);
 const s2=E.createGame(lvl({inv:{straight:1,elbow:0,tee:0,cross:0}}));
 assert(E.place(s2,"A",1,1,"straight",0).ok);
 assert.equal(E.place(s2,"A",2,1,"straight",0).err,"no_stock");
 assert.equal(E.place(s2,"A",2,1,"elbow",0).err,"no_stock")});
t("旋轉與拆除只限放置者，拆除歸還庫存",()=>{const s=E.createGame(lvl());
 E.place(s,"A",1,3,"straight",0);
 assert.equal(E.rotate(s,"B",1,3).err,"not_owner");
 assert.equal(E.remove(s,"B",1,3).err,"not_owner");
 assert(E.rotate(s,"A",1,3).ok);assert.equal(s.pipes["1,3"].rot,1);
 assert(E.remove(s,"A",1,3).ok);assert.equal(s.inv.straight,12);
 assert.equal(E.rotate(s,"A",1,3).err,"no_pipe")});
t("操作 ID 防重複",()=>{const s=E.createGame(lvl());
 assert(E.place(s,"A",1,3,"straight",1,"op1").ok);
 const r=E.place(s,"A",1,3,"straight",1,"op1");assert(r.ok&&r.dup);assert.equal(s.inv.straight,11)});
t("水流成功抵達終點",()=>{const s=E.createGame(lvl());line(s,1,6,3);
 const ev=run(s,50);assert.equal(s.status,"won");assert(ev.some(e=>e.t==="win"))});
t("水流到空格立即失敗；之後不能補救",()=>{const s=E.createGame(lvl());line(s,1,2,3);
 run(s,50);assert.equal(s.status,"lost");assert.equal(s.failure.reason,"empty");
 assert.equal(E.place(s,"A",3,3,"straight",1).err,"ended")});
t("來得及補管就不會失敗",()=>{const s=E.createGame(lvl());line(s,1,2,3);
 E.tick(s);E.tick(s);E.tick(s);E.tick(s);assert.equal(s.status,"flow");
 line(s,3,6,3);run(s,50);assert.equal(s.status,"won")});
t("方向錯誤的水管 → mismatch",()=>{const s=E.createGame(lvl());
 E.place(s,"A",1,3,"straight",0);run(s,10);assert.equal(s.status,"lost");assert.equal(s.failure.reason,"mismatch")});
t("彎管轉彎正確",()=>{const s=E.createGame(lvl());
 // 左→上→右：(1,3) 彎(左、上)=rot3；(1,2) 彎(下、右)=rot1；然後直線到 (6,2) 再下到 (6,3)... 終點在 (7,3)
 E.place(s,"A",1,3,"elbow",3);E.place(s,"A",1,2,"elbow",1);line(s,2,5,2);
 E.place(s,"A",6,2,"elbow",2); // 左、下
 E.place(s,"A",6,3,"elbow",0); // 上、右
 run(s,50);assert.equal(s.status,"won")});
t("已通水的水管鎖定",()=>{const s=E.createGame(lvl());line(s,1,6,3);
 E.tick(s);E.tick(s);E.tick(s);E.tick(s);
 assert.equal(E.rotate(s,"A",1,3).err,"locked");assert.equal(E.remove(s,"A",1,3).err,"locked");
 assert(E.rotate(s,"A",6,3).ok)});
t("繞圈偵測",()=>{const s=E.createGame(lvl({source:{x:0,y:3,dir:1}}));
 // (1,3) 十字，接 (1,2)(2,2)(2,3) 圍成一圈回到十字
 E.place(s,"A",1,3,"cross",0);
 E.place(s,"A",1,2,"elbow",1);E.place(s,"A",2,2,"elbow",2);E.place(s,"A",2,3,"elbow",3);
 run(s,50);assert.equal(s.status,"lost")});
t("分岔管：沒接的出口不算漏水",()=>{const s=E.createGame(lvl());
 E.place(s,"A",1,3,"tee",0); // 開口：上 右 左 → 左進；上(1,2)空、右(2,3)有管
 line(s,2,6,3);run(s,50);assert.equal(s.status,"won")});
t("關卡產生：可解且種子可重現",()=>{for(let d=0;d<3;d++)for(let sd=1;sd<=40;sd++){
  const L=E.makeLevel(d,sd),s=E.createGame(L);
  const P=L.path;
  for(let i=0;i<P.length;i++){const a=i?P[i-1]:{x:0,y:L.source.y},b=i<P.length-1?P[i+1]:{x:L.size-1,y:L.target.y},c=P[i];
   const ins=[a,b].map(q=>q.y<c.y?0:q.x>c.x?1:q.y>c.y?2:3).sort();
   let placed=false;
   for(const ty of ["straight","elbow"])for(let r=0;r<4&&!placed;r++){const o=E.openings(ty,r).slice().sort();if(o.length===2&&o[0]===ins[0]&&o[1]===ins[1]){assert(E.place(s,"A",c.x,c.y,ty,r).ok,"seed"+sd);placed=true}}
   assert(placed)}
  run(s,500);assert.equal(s.status,"won","diff"+d+" seed"+sd)}
 assert.deepEqual(E.makeLevel(1,7),E.makeLevel(1,7))});
t("庫存＝路線需求＋備用，且總量遠少於舊的 36 根",()=>{for(let d=0;d<3;d++)for(let sd=1;sd<=50;sd++){const L=E.makeLevel(d,sd),v=L.inv,D=E.DIFFS[d];
 assert.equal(v.tee,D.tee);assert.equal(v.cross,D.cross);assert(v.straight+v.elbow===L.path.length+2*D.slack);assert(v.straight>=3&&v.elbow>=D.slack)}});
t("等待回合：初級5／中級4／高級3；之後每次 tick 只前進一格",()=>{[5,4,3].forEach((w,d)=>{const L=E.makeLevel(d,9);assert.equal(L.delay,w);const s=E.createGame(L);
 for(let i=0;i<w;i++){E.tick(s);assert.equal(s.fronts[0].src,true)}
 assert.equal(s.wait,0)});
 const s=E.createGame(lvl({delay:5}));line(s,1,6,3);const pos=[];
 for(let i=0;i<5;i++)E.tick(s);assert.equal(s.fronts[0].src,true);
 for(let i=0;i<7;i++){E.tick(s);pos.push(s.fronts.length?s.fronts[0].x:-1)}
 assert.deepEqual(pos.slice(0,6),[1,2,3,4,5,6]);assert.equal(s.status,"won");assert.equal(s.rush,undefined)});
console.log("\n"+n+" 個測試全部通過");
