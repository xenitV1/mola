import {createServer} from 'vite';
import fs from 'node:fs';
const server=await createServer({server:{middlewareMode:true}});
try{
 const {Simulation,actor,newBranch}=await server.ssrLoadModule('/src/game/sim.ts');
 const {BRANCHES,MENU}=await server.ssrLoadModule('/src/game/config.ts');
 const rows=[];
 for(let branch=0;branch<BRANCHES.length;branch++)for(const menu of Object.keys(MENU)){
  const g=new Simulation();g.s.active=branch;g.s.branches={[branch]:newBranch()};g.s.coins=100_000;
  for(const role of ['barista','waiter','supplier'])g.hire(role);
  g.b.level.table=3;g.b.level.space=1;g.b.level.machine=2;g.b.level.quality=1;g.b.prep=3;
  g.setMenu(menu);g.s.player=actor({x:0,z:5.8});
  for(let frame=0;frame<30*600;frame++)g.step(1/30);
  rows.push({branch:BRANCHES[branch].id,menu,earned:g.b.earned,served:g.b.served,lost:g.b.lost,waste:g.b.waste,rating:Number(g.b.rating.toFixed(2)),losses:g.b.losses});
 }
 fs.writeFileSync('artifacts/qa/menu-experiment.json',JSON.stringify({seconds:600,tableLevel:3,machineLevel:2,qualityLevel:1,staffLevel:1,player:'rests',ads:0,rows},null,2));
 console.table(rows);
}finally{await server.close();}
