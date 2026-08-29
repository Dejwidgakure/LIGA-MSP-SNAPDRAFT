"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const here=__dirname;
const read=name=>fs.readFileSync(path.join(here,name),"utf8");

const collectorJs=read("superpowers-collector.js");
const collectorCss=read("superpowers-collector.css");
assert.match(collectorJs,/`\$\{baseClass\} pack-card-btn`/,"Collector normal exhibits use canonical pack-card-btn");
assert.doesNotMatch(collectorCss,/\.spx-collector-card(?:\.pack-card-btn)? \.pack-card-name/,"Collector has no local card-name geometry override");

const customPacksSrc=read("customPacks.js");
assert.match(customPacksSrc,/id:\s*"cosmic_casino"[\s\S]*?composition:\s*\{[\s\S]*?mode:\s*"cycle"/);
assert.match(customPacksSrc,/allOf:\s*\["card-generation"\]/);
assert.match(customPacksSrc,/allOf:\s*\["random-card-pool"\]/);

// Dynamic Cosmic Casino composition test against the real cards.js database.
{
  const ctx={console,Math};vm.createContext(ctx);
  vm.runInContext('var window=globalThis; var bannedCards=[]; var TAGS={};',ctx);
  for(const file of [path.join(here,"..","cards.js"),path.join(here,"customPacks.js"),path.join(here,"customPackEngine.js")]){
    vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
  }
  vm.runInContext(`globalThis.__casino=customPacks.find(p=>p.id==="cosmic_casino");globalThis.__make=n=>generateCustomPack(__casino,n,"random").map(c=>({name:c.name,tags:c.tags||[]}));`,ctx);
  for(const size of [2,3,4,5,6,8,12]){
    for(let i=0;i<80;i++){
      const pack=ctx.__make(size);
      assert.equal(pack.length,size,`Cosmic Casino size ${size}`);
      assert(pack.some(card=>card.tags.includes("card-generation")),`Cosmic Casino ${size} missing Card Generation`);
      assert(pack.some(card=>card.tags.includes("random-card-pool")),`Cosmic Casino ${size} missing Random Card Pool`);
    }
  }
}

const cpCss=read("custom-packs-v2.css");
assert.match(cpCss,/FINAL LAST HOTFIX — CUSTOM PACK REVEAL SAFE LAYER/);
assert.match(cpCss,/#packStage #customPackRevealInfo\{[\s\S]*?z-index:32!important[\s\S]*?translateY\(-8px\)/);

const questUi=read("draft-quests-ui.js");
const questCss=read("draft-quests.css");
assert.match(questUi,/fx==="failed"\|\|fx==="reroll"\)\?1600:0/);
assert.match(questCss,/FINAL LAST HOTFIX — ARISHEM RESULT \/ REROLL CINEMATIC PASS/);
assert.match(questCss,/questLastSixEyes/);
assert.match(questCss,/questLastPromptFrameIn[\s\S]*?\.78s/);
assert.match(questCss,/quest_arishem_reward_frame\.webp/);
assert.match(questCss,/\.draft-quest-toast\[data-quest-fx="claim"\]>b[\s\S]*?font-size:22px/);

const jeff=read("jeffEngine.js");
assert.match(jeff,/const maxX = Math\.max\(0, w - JEFF_SIZE\)/);
assert.match(jeff,/if\(x < 0\)[\s\S]*?x = 0;[\s\S]*?if\(vx < 0\) vx = Math\.abs\(vx\)/);
assert.match(jeff,/else if\(x > maxX\)[\s\S]*?x = maxX/);
assert.doesNotMatch(jeff,/rotation \+= 0\.3/);
assert.match(jeff,/rotation \+= \(desiredRotation - rotation\) \* 0\.055/);
assert.match(jeff,/translate3d\(\$\{x\}px, \$\{y\}px, 0\)/);
assert.doesNotMatch(jeff,/MutationObserver/);

const html=read("snap-draft.html");
for(const expected of [
  "draft-quests.css?v=0.9-final-last",
  "superpowers-collector.css?v=1.3-final-last-pack-parity",
  "custom-packs-v2.css?v=2.1-final-last",
  "jeffEngine.js?v=5.1-final-calm",
  "customPacks.js?v=tags-v2-casino-cycle",
  "draft-quests-ui.js?v=0.7-final-last",
  "superpowers-collector.js?v=1.1-final-last-pack-parity"
]) assert(html.includes(expected),`Missing cache buster ${expected}`);

console.log("FINAL_LAST_HOTFIX_OK",JSON.stringify({collector:"pack-parity",casino:"dual-family-cycle",customPackInfo:"layer-safe",arishem:"cinematic-overlap",claim:"reward-frame-integrated",jeff:"boundary-clamped-calm"}));
