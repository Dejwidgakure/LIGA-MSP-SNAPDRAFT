"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const here=__dirname;
const current=fs.readFileSync(path.join(here,"galactic-current.js"),"utf8");
const cerebro=fs.readFileSync(path.join(here,"cerebro-autopilot.js"),"utf8");
const incompatible=(current.match(/const INCOMPATIBLE_IDS = \[([\s\S]*?)\];/)||[])[1]||"";
assert.doesNotMatch(incompatible,/enableCerebro/,"Cerebro must be supported by Galactic Current");
assert.match(cerebro,/const VERSION = "1\.4\.0-tags-v2-galactic-current"/);
assert.match(cerebro,/if\(current\?\.active && Array\.isArray\(current\.cards\)\) return current\.cards/);
assert.match(cerebro,/"gc",\s*Number\(current\.round\|\|0\),\s*Number\(current\.pickNumber\|\|0\)/s);

const liveCard={name:"Live Current",cost:2,power:5,tags:["destroy","classic-destroy"],instanceId:"gc-live-1"};
const staleCard={name:"Stale Pack",cost:6,power:0,tags:[],instanceId:"stale"};
const context={
  console,
  setTimeout:()=>1, clearTimeout:()=>{},
  players:["Alpha"], decks:[[]], draftPlayers:["Alpha"], currentPack:[staleCard],
  pickOrder:[0], currentPickIndex:0, packStartIndex:0, draftFinished:false,
  packIsOpen:true, packOpeningInProgress:false, packEnding:false,
  TAGS:{
    mechanicFamilies:[{id:"destroy",name:"Destroy"}],
    deckArchetypes:[{id:"classic-destroy",name:"Classic Destroy"}],
    subtypes:[], abilityTypes:[], series:[], teams:[], themes:[], special:[]
  },
  document:{
    readyState:"loading",
    addEventListener(){},
    getElementById(){return null;},
    querySelectorAll(){return [];},
    querySelector(){return null;},
    body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},
    createElement(){return {className:"",dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},style:{}};}
  },
  Event:function(){},
};
context.window=context;
context.window.getCurrentPlayerIndex=()=>0;
context.window.GalacticCurrent={getState:()=>({active:true,round:2,pickNumber:5,cards:[liveCard],isResolving:false,isFinishing:false})};
context.window.MysterioUI={getPublicCardSnapshot:card=>card};
vm.createContext(context);
vm.runInContext(cerebro,context,{filename:"cerebro-autopilot.js"});
const ranked=context.CerebroAutopilot.rankCurrentPack(0);
assert.equal(ranked.length,1);
assert.equal(ranked[0].card.name,"Live Current","Cerebro must rank authoritative live-current cards, not stale currentPack mirrors");
const score=context.CerebroAutopilot.scoreCard({name:"Candidate",cost:2,power:4,tags:["destroy","classic-destroy"]},[{name:"Anchor",cost:2,power:3,tags:["destroy","classic-destroy"]}]);
assert.ok(score.score>0,"Tag Schema V2 synergy scoring should remain active");
console.log("PASS Cerebro Galactic Current",JSON.stringify({ranked:ranked[0].card.name,score:score.score}));
