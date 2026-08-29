"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

const bridge=read("superpowers-galactic-current-bridge.js");
const current=read("galactic-current.js");
const html=read("snap-draft.html");
const thor=read("superpowers-thor.js");
const ironFist=read("superpowers-ironfist.js");
const dino=read("superpowers-devildino.js");
const gambit=read("superpowers-gambit.js");
const refs=[
  "galactic-current.js?v=system-closure-01",
  "superpowers-galactic-current-bridge.js?v=3.1.0-gc-wording",
  "superpowers-thor.js?v=system-closure-01",
  "superpowers-ironfist.js?v=gc-wording-v1",
  "superpowers-devildino.js?v=106.4-gc-wording",
  "superpowers-gambit.js?v=3.2.7-gc-wording"
];
refs.forEach(ref=>assert.ok(html.includes(ref),`runtime cache-bust present: ${ref}`));

const sandbox={console};
sandbox.window=sandbox;
sandbox.globalThis=sandbox;
sandbox.GalacticCurrent={
  isModeEnabled:()=>true,
  getState:()=>({active:true,variant:"rushing",round:1,pickNumber:4,cards:[],drawQueue:[]}),
  getConfiguredVariant:()=>"rushing"
};
vm.createContext(sandbox);
vm.runInContext(bridge,sandbox);
const B=sandbox.GalacticCurrentSuperpowerBridge;
assert(B,"V3 bridge exported");
assert.match(B.VERSION,/^3\./,"bridge is V3");
for(const id of ["thor","iron_fist","devil_dinosaur","gambit","rocket"]){
  assert.equal(B.getCompatibility(id).compatible,true,`${id} is enabled in Compat V3`);
}
for(const id of ["groot","doctor_strange","collector","mysterio"]){
  assert.equal(B.getCompatibility(id).compatible,false,`${id} remains intentionally incompatible`);
}

// Shared river bridge: real state, transaction snapshots and normal-pick semantics.
for(const needle of ["resolveExternalNormalPick","captureState","restoreState","advanceExternalTurn"]){
  assert.match(current,new RegExp(`function ${needle}\\(`),`Galactic Current exports ${needle}`);
}
assert.match(bridge,/resolveExternalNormalPick/);
assert.match(bridge,/captureFlowState/);
assert.match(bridge,/restoreFlowState/);
assert.match(html,/galacticCurrentState:window\.GalacticCurrent\?\.captureState\?\.\(\)\|\|null/,
  "draft transactions snapshot authoritative Galactic Current state");
assert.match(html,/window\.GalacticCurrent\.restoreState\(payload\.galacticCurrentState,\{render:false\}\)/,
  "transaction rollback restores authoritative Galactic Current state");

// Thor: same Classic queue cost; only river pick/advance are mode adapters.
assert.match(thor,/function shiftNextPickToEnd\(nextRoll\)[\s\S]*pickOrder\.splice\(from,1\)[\s\S]*pickOrder\.push\(token\)/,
  "Thor keeps the Classic pick-order move-to-end mechanic");
assert.match(thor,/resolveExternalNormalPick\?\.\(packIndex,state\.playerIndex,resolvedCard/,
  "Thor consumes a real normal Galactic Current pick");
assert.match(thor,/advanceExternalTurn\?\.\(\)/,
  "Thor advances Galactic Current only when the consumed Classic-equivalent current pick requires it");
assert.ok((thor.match(/inheritFlowAge:true/g)||[]).length>=2,"Thor rerolls/refills preserve the occupied river slot age");
assert.doesNotMatch(thor,/next orbit|następn(?:y|ego) obieg/i,
  "Thor does not invent a separate orbit-only queue rule");

// Iron Fist: target comes from live river; shared consume helper is GC-aware and refills atomically.
assert.match(ironFist,/function livePack\(\)[\s\S]*GalacticCurrentSuperpowerBridge\.getLiveCards/);
assert.match(ironFist,/const prizeCards=livePack\(\)\.filter\(isPrizeCardLegal\)/);
assert.match(html,/function consumeCurrentPackSurplusCard\([\s\S]*consumeLiveCard\?\.\(index,\{refill:true,[\s\S]*render:false\}\)/,
  "Iron Fist shared consume path refills the current immediately");
assert.match(html,/restoreFlowState\?\.\(flowSnapshot/,
  "failed runtime-zone move rolls the river back");

// Devil Dinosaur: both direct replacements and pick replacement operate on authoritative current.
assert.match(dino,/function packList\(\)[\s\S]*GalacticCurrentSuperpowerBridge\.getLiveCards/);
assert.match(dino,/replaceLiveCard\?\.\(index,replacement,\{source:"devil_dino_devour_refill"/);
assert.match(dino,/resolveExternalNormalPick\?\.\(index,ui\.playerIndex,resolvedCard/);
assert.match(dino,/advanceExternalTurn\?\.\(\)/);
assert.ok((dino.match(/inheritFlowAge:true/g)||[]).length>=2,"Dino direct replacements preserve river slot age");

// Gambit: both kinetic pack shot and ricochet are true one-for-one river replacements.
assert.match(gambit,/replaceLiveCard\?\.\(index,replacement,\{source:"gambit_pack_shot"/);
assert.match(gambit,/replaceLiveCard\?\.\(index,replacement,\{source:"gambit_pack_ricochet"/);
assert.match(gambit,/if\(inCurrent\)[\s\S]*reserveHitCard\(state,sourceCard/,
  "Gambit reserves the original current card without consume+extra-refill overgrowth");
assert.ok((gambit.match(/inheritFlowAge:true/g)||[]).length>=2,"Gambit replacements preserve the occupied river slot age");

// Rocket: live targets, normal pick trigger, natural departure fizzle in both variants.
assert.match(html,/function getRocketLiveCards\(\)[\s\S]*getLiveCards/);
assert.match(html,/zone:window\.GalacticCurrentSuperpowerBridge\?\.isModeEnabled\?\.\(\)\?"galacticCurrent":"pack"/);
assert.ok((current.match(/galactic_current_escaped/g)||[]).length>=2,"Rushing Current disarms Rocket bombs on natural escape");
assert.ok((current.match(/galactic_current_faded/g)||[]).length>=2,"Fading Stars disarms Rocket bombs on natural fade");
assert.match(current,/resolveRocketBombAfterPick\?\.\(playerIndex,pickedCard,resultCard\)/,
  "normal Galactic Current picks resolve Rocket traps");

console.log("PASS Galactic Current Superpowers Compat V3");
