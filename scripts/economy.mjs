import {createServer} from 'vite';
import fs from 'node:fs';
const server=await createServer({server:{middlewareMode:true}});
try{
 const {Simulation}=await server.ssrLoadModule('/src/game/sim.ts');
 const {POINTS,BRANCHES}=await server.ssrLoadModule('/src/game/config.ts');
 const output=process.env.CAFE_ECONOMY_OUTPUT??'artifacts';fs.mkdirSync(output+'/qa',{recursive:true});
 const duration=Number(process.env.CAFE_DURATION??1800);
 const masteryRun=process.env.CAFE_MASTERY==='1';
 const g=new Simulation(),purchases=[];let completedAt=null;
 for(let frame=0;frame<30*duration;frame++){
  if(frame%15===0){
   const buy=(name,fn)=>{const branch=g.s.active;if(fn())purchases.push({time:Math.round(frame/30),branch,item:name,coins:Math.floor(g.s.coins),served:g.s.totalServed});};
   while(g.claimMastery())purchases.push({time:Math.round(frame/30),branch:g.s.active,item:'star '+g.b.mastery,coins:Math.floor(g.s.coins),served:g.s.totalServed});
   if(g.chainComplete&&completedAt===null)completedAt=Math.round(frame/30);
   const b=g.b;
   if(b.level.table<2)buy('table',()=>g.upgrade('table'));
   else if(!b.staff.barista)buy('barista',()=>g.hire('barista'));
   else if(!b.staff.waiter)buy('waiter',()=>g.hire('waiter'));
   else if(!b.staff.supplier)buy('supplier',()=>g.hire('supplier'));
   else if(b.level.table>=g.maxTables&&b.level.space<g.maxSpace)buy('floor extension',()=>g.upgrade('space'));
   else if(b.level.machine<2)buy('machine',()=>g.upgrade('machine'));
   else {
    if(b.menu!==g.def.preference)g.setMenu(g.def.preference);
    if(g.s.active===2&&b.level.quality<2)buy('quality',()=>g.upgrade('quality'));
    else if(g.s.active<2&&!g.s.branches[g.s.active+1])buy(BRANCHES[g.s.active+1].id,()=>g.switchBranch(g.s.active+1));
    else if(b.level.table<g.maxTables)buy('table',()=>g.upgrade('table'));
    else if(b.staff.waiter<2)buy('waiter training',()=>g.hire('waiter'));
    else if(b.level.machine<3)buy('machine',()=>g.upgrade('machine'));
    else if(b.level.stock<1)buy('stock',()=>g.upgrade('stock'));
    else if(b.staff.barista<2)buy('barista training',()=>g.hire('barista'));
    else if(b.level.quality<2)buy('quality',()=>g.upgrade('quality'));
    else if(masteryRun&&b.staff.waiter<3)buy('waiter training',()=>g.hire('waiter'));
    else if(masteryRun&&b.level.quality<3)buy('quality',()=>g.upgrade('quality'));
    else if(masteryRun&&b.level.machine<4)buy('machine',()=>g.upgrade('machine'));
    else if(Object.keys(g.s.branches).length===3&&(!masteryRun||b.mastery===3))g.switchBranch((g.s.active+1)%3);
   }
   // Re-read after a branch switch so the bot never gives the new café an old route.
   const current=g.b,p=g.s.player;
   if(!p.path.length){const cash=Object.keys(current.cash)[0],customer=g.waiting.find(c=>p.cups.some(cup=>cup.kind===c.kind));
    if(p.beans)g.go(POINTS.machine);
    else if(customer)g.go(g.orderPoint(customer));
    else if(cash!==undefined)g.go(g.servicePoint(Number(cash)*2));
    else if(current.stock<3&&!current.staff.supplier)g.go(POINTS.supply);
    else if(p.cups.length<current.level.tray)g.go(POINTS.machine);
    else if(g.waiting.length)g.go(g.orderPoint(g.waiting[0]));
   }
  }
  g.step(1/30);
 }
 const result={seconds:duration,completedAt,ads:0,initialCoins:35,purchases,finalCoins:Math.floor(g.s.coins),served:g.s.totalServed,branches:Object.keys(g.s.branches).length,stats:Object.fromEntries(Object.entries(g.s.branches).map(([i,b])=>[i,{mastery:b.mastery,signatureServed:b.signatureServed,menu:b.menu,level:b.level,staff:b.staff,served:b.served,lost:b.lost,waste:b.waste,rating:Number(b.rating.toFixed(2)),stock:b.stock}]))};
 fs.writeFileSync(masteryRun?output+'/qa/mastery-save.json':output+'/qa/chain-save.json',JSON.stringify(g.s));
 fs.writeFileSync(masteryRun?output+'/mastery-economy.json':output+'/economy-30min.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(masteryRun&&!g.chainComplete)throw new Error('No-ad bot did not earn nine stars; inspect mastery constraints');
 if(result.branches<3)throw new Error('No-ad bot did not reach all three branches in 30 minutes');
}finally{await server.close();}
