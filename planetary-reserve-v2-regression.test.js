"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("./planetary-reserve-engine.js");

const here=__dirname;
const root=path.resolve(here,"..");
const read=(file)=>fs.readFileSync(path.join(here,file),"utf8");
const readRoot=(file)=>fs.readFileSync(path.join(root,file),"utf8");

const tags={
  mechanicFamilies:[{id:"destroy",name:"DESTROY"},{id:"move",name:"MOVE"},{id:"discard",name:"DISCARD"},{id:"tech",name:"TECH"}],
  subtypes:[{id:"draw",name:"DRAW"},{id:"transform",name:"TRANSFORM"},{id:"summon",name:"SUMMON"}],
  deckArchetypes:[{id:"classic-destroy",name:"CLASSIC DESTROY"},{id:"move-combo",name:"MOVE COMBO"},{id:"surfer-buff",name:"SILVER SURFER"}],
  abilityTypes:[{id:"on-reveal",name:"ON REVEAL"},{id:"ongoing",name:"ONGOING"}],
  teams:[{id:"xmen",name:"X-MEN"}],
  themes:[{id:"cosmic",name:"COSMIC"}]
};
const deck=Array.from({length:12},(_,i)=>({
  name:`Main ${i+1}`,
  cost:(i%6)+1,
  power:3+i,
  tags:[i<7?"destroy":"move",i%2?"draw":"transform",i<7?"classic-destroy":"move-combo",...(i===0?["tech"]:[])]
}));
const cards=[];
for(let i=0;i<96;i++){
  cards.push({
    name:`Candidate ${i+1}`,
    cost:(i%6)+1,
    power:2+(i%13),
    tags:[i%3===0?"destroy":i%3===1?"move":"discard",i%2?"draw":"transform",i%3===0?"classic-destroy":i%3===1?"move-combo":"surfer-buff",...(i<12?["tech"]:[]),...(i%11===0?["cosmic"]:[])]
  });
}
// Deliberately multi-tagged "favourite" cards: they must not become deterministic winners.
cards.push({name:"Prowler",cost:3,power:5,tags:["destroy","move","draw","classic-destroy","xmen","cosmic"]});
cards.push({name:"Nico Minoru",cost:1,power:2,tags:["destroy","move","discard","transform","classic-destroy","cosmic"]});
cards.push({name:"Hawkeye Kate Bishop",cost:2,power:3,tags:["destroy","move","draw","move-combo","xmen"]});
cards.push({name:"Infinity Ultron",cost:6,power:12,tags:["destroy","summon","classic-destroy","cosmic"]});

let seed=0x12345678;
const random=()=>{
  seed=(1664525*seed+1013904223)>>>0;
  return seed/0x100000000;
};
const suggestionCounts=new Map();
const frequency=new Map();
let maxTechOffered=0;
for(let run=0;run<500;run++){
  const result=engine.buildCandidatePool({deck,cards,tags,random,suggestionCounts});
  assert.equal(result.candidates.length,12,"Each complete candidate pool should contain 12 cards");
  assert.equal(new Set(result.candidates.map(row=>row.card.name)).size,12,"Candidate pool must not contain duplicates");
  const reasonCodes=new Set(result.candidates.map(row=>row.reasonCode));
  assert.ok(reasonCodes.has("mechanic_family"),"one slot follows the dominant Mechanic Family");
  assert.ok(reasonCodes.has("detailed_mechanic"),"one slot follows the dominant detailed mechanic");
  assert.ok(reasonCodes.has("deck_archetype"),"one slot follows the dominant Deck Archetype / Package");
  assert.ok(reasonCodes.has("missing_curve"),"one slot fills the missing Cost");
  assert.ok(reasonCodes.has("cheap_random"),"one slot is the fully random cheap option");
  const cheap=result.candidates.find(row=>row.reasonCode==="cheap_random");
  assert.ok([1,2].includes(Number(cheap.card.cost)),"cheap option is always Cost 1 or 2");
  assert.equal(result.candidates.some(row=>["team_theme_subtype","ability_type","high_power_finisher","second_synergy"].includes(row.reasonCode)),false,"legacy Reserve slot families are gone");
  assert.equal(result.candidates.filter(row=>row.reasonCode==="tech_answer").length,1,"Reserve must dedicate exactly one slot to TECH when legal candidates exist");
  maxTechOffered=Math.max(maxTechOffered,result.techRule.offered);
  for(const row of result.candidates){
    const k=row.card.name.toLocaleLowerCase("pl");
    suggestionCounts.set(k,(suggestionCounts.get(k)||0)+1);
    frequency.set(row.card.name,(frequency.get(row.card.name)||0)+1);
  }
}
const totalPools=500;
const sorted=[...frequency.entries()].sort((a,b)=>b[1]-a[1]);
const [mostName,mostCount]=sorted[0];
const favouriteNames=["Prowler","Nico Minoru","Hawkeye Kate Bishop","Infinity Ultron"];
for(const name of favouriteNames){
  const rate=(frequency.get(name)||0)/totalPools;
  assert.ok(rate<0.35,`${name} must not dominate candidate pools (rate=${rate})`);
}
assert.ok(mostCount/totalPools<0.45,`No single card should dominate pools (${mostName}: ${mostCount}/${totalPools})`);

const reserveJs=read("planetary-reserve.js");
const reserveCss=read("planetary-reserve.css");
const snapHtml=read("snap-draft.html");
const gcJs=read("galactic-current.js");
const settingsJs=read("settings-v2.js");
const marketEngine=read("trade-market-engine.js");
const marketRuntime=read("trade-market-runtime.js");
const statsJs=readRoot("stats-v2.js");
const statsEngine=readRoot("draft-stats-engine.js");
const sideboardUi=readRoot("sideboard-stats-ui-v2.js");

assert.match(reserveJs,/PRZEJDŹ DO PLANETARNEJ REZERWY/,"Reserve phase needs explicit CTA");
assert.match(reserveJs,/function\s+offerPhase\s*\(/,"Reserve phase must expose an offer/checkpoint before opening modal");
assert.match(reserveJs,/function\s+beginAfterFinalization\s*\(/,"Reserve modal must have explicit start function");
assert.match(reserveJs,/is-picking/,"Card selection animation marker must exist");
assert.doesNotMatch(reserveJs,/System wskazuje tę opcję/i,"Debug-like fallback copy must not remain in player-facing UI");
assert.match(reserveCss,/pr-(?:planet|orb|star)/,"Planet/orb/star opening visual must be present");
assert.match(reserveCss,/prefers-reduced-motion/,"Reserve animations need reduced-motion fallback");
assert.match(reserveCss,/grid-template-columns:\s*repeat\(6,/,"Desktop reserve candidate grid should be 6 columns");
assert.match(reserveCss,/overflow:\s*hidden/,"Reserve modal candidate area should avoid nested scrollbars on desktop");

assert.match(gcJs,/preparePendingDraftFinish\(\{prepared:true,source:"galactic_current"\}\)/,"Gwiezdny Prąd must enter shared finalization pipeline");
assert.match(snapHtml,/PlanetaryReserveUI\?\.offerPhase|PlanetaryReserveUI\.offerPhase/,"Classic final chain must offer Planetary Reserve instead of auto-opening it");
assert.match(snapHtml,/planetary-reserve-live-divider/,"Live player panels need compact Sideboard divider");
assert.match(settingsJs,/poker/i,"Settings must contain Poker compatibility handling");
assert.match(settingsJs,/sideboard/i,"Settings must contain Sideboard compatibility handling");

assert.match(marketEngine,/post-draft-open/,"Galactic Market must remain open after pack drafting finishes");
assert.match(marketEngine,/function\s+isPostDraft|const\s+isPostDraft/,"Market engine must distinguish post-draft state");
assert.match(marketRuntime,/isPostDraft/,"Market runtime must expose post-draft state");

assert.match(statsJs,/Drafty bez porażki/,"Legendary performances must include undefeated drafts");
assert.match(statsJs,/Najdłuższy perfekcyjny run/,"Perfect run must remain a separate legendary statistic");
assert.match(statsEngine,/undefeatedDrafts/,"Stats engine must calculate undefeated drafts");
assert.match(statsEngine,/longestWinRun/,"Stats engine must calculate longest in-draft win run");
assert.match(sideboardUi,/naturalWidth\s*>\s*0|naturalWidth>0/,"Player history fallback must distinguish a real loaded deck image from a missing thumbnail");

console.log("PLANETARY_RESERVE_V2_REGRESSION_OK",JSON.stringify({
  pools:totalPools,
  mostFrequent:{name:mostName,count:mostCount,rate:Number((mostCount/totalPools).toFixed(3))},
  maxTechOffered,
  favouriteRates:Object.fromEntries(favouriteNames.map(name=>[name,Number(((frequency.get(name)||0)/totalPools).toFixed(3))]))
}));
