"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

const html=read("snap-draft.html");
const ui=read("superpowers-ui.js");
const engineSource=read("superpowers-engine.js");
const shop=read("economy-shop-core.js");

const policyBlock=(html.match(/const SUPERPOWER_RECHARGE_POLICIES=Object\.freeze\(\{([\s\S]*?)\}\);/)||[])[1]||"";
const ids=["loki","jeff","iron_man","spider_man","hulk","cyclops","professor_x","rocket","doctor_doom","captain_america","venom","deadpool","iron_fist","doctor_strange","wolverine","thor","devil_dinosaur","groot","gambit","mysterio","black_cat","collector"];
ids.forEach(id=>assert.match(policyBlock,new RegExp(`\\b${id}:\\{mode:`),`Recharge policy exists for ${id}`));
assert.match(policyBlock,/captain_america:\{mode:"upgrade",label:"WZMOCNIENIE OBRONY"\}/);
assert.match(policyBlock,/rocket:\{mode:"upgrade",label:"DODATKOWY ARSENAŁ"\}/);
assert.match(policyBlock,/black_cat:\{mode:"settled"\}/);
assert.match(policyBlock,/groot:\{mode:"off"/);
assert.match(policyBlock,/collector:\{mode:"off"/);

// Settled lifecycle guards.
for(const needle of [
  "getSpiderManReservations()",
  "getProfessorXPendingCount",
  "getDoctorStrangeRechargeSettlement",
  "window.DevilDinoUI?.getStatus",
  "window.GambitUI?.getStatus",
  "window.MysterioUI?.getStatus",
  "window.BlackCatUI?.isBusy"
]) assert.ok(html.includes(needle),`settled guard present: ${needle}`);

// Captain Recharge: second batch merges into persistent defense, max six, no second ricochet.
assert.match(html,/existingProtected\.size\+cardIndices\.length>6/);
assert.match(html,/mergedProtectedCards=\[\.\.\.existingProtected,\.\.\.protectedCards\]/);
assert.match(html,/ricochetUsed:Boolean\(existingDefense\?\.ricochetUsed\)/);
assert.match(ui,/adapter\.isCaptainAmericaProtectedCard\?\.\(playerIndex,cardIndex\)/,
  "Captain UI refuses selecting an already shielded card");
assert.match(ui,/unprotectedCount<3/,
  "Captain recharge preflight requires three fresh shield targets");

// Rocket Recharge: armed first-wave bombs may remain while a purchased upgrade opens a second plant action.
assert.match(html,/hasArmedRocketBombs && !isSuperpowerRechargeReady\(playerName,"rocket"\)/);
assert.match(html,/status\?\.ownerName/);
assert.doesNotMatch(html,/const belongsToPlayer=!status\?\.playerName/);
assert.match(ui,/hasArmedBombs && !adapter\.isSuperpowerRechargeReady\?\.\(playerName,"rocket"\)/);

// Dino SETTLED starts a clean second cycle only after the first belly has settled.
assert.match(html,/opportunity\.powerId==="devil_dinosaur"[\s\S]*delete engineData\.data\.dino/);

// Shop surfaces the special Recharge flavor instead of pretending every recharge is identical.
assert.match(shop,/opportunity\.rechargeLabel/);
assert.match(shop,/rechargeMode:opportunity\.rechargeMode\|\|"normal"/);

// Engine consumes a purchased recharge exactly on the next successful activation.
const sandbox={console,Date,JSON,window:{draftSuperpowers:{A:{recharge:{status:"ready"}}}}};
sandbox.window.window=sandbox.window;
vm.createContext(sandbox);
vm.runInContext(engineSource+"\n;globalThis.__RechargeTestEngine=SuperpowerEngine;",sandbox,{filename:"superpowers-engine.js"});
const E=sandbox.__RechargeTestEngine;
assert.ok(E,"SuperpowerEngine exported");
E.register({id:"dummy",name:"Dummy"});
E.init(["A"]);
E.assign({A:"dummy"});
let data=E.getPlayerData("A");
data.used=false;
data.data.recharge={purchased:true,status:"ready",mode:"normal"};
const result=E.completeActivation("A","dummy",{packNumber:2,pickIndex:4});
assert.equal(result.ok,true);
assert.equal(data.used,true);
assert.equal(data.data.recharge.status,"spent");
assert.equal(data.data.recharge.spentByActivation.packNumber,2);

console.log("PASS Superpower Recharge Hardening",{powers:ids.length});
