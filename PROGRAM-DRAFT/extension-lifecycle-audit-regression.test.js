"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const read=n=>fs.readFileSync(path.join(__dirname,n),"utf8");
const html=read("snap-draft.html"), current=read("galactic-current.js"), timer=read("draft-turn-timer.js"), cerebro=read("cerebro-autopilot.js"), market=read("trade-market-ui.js"), bounty=read("bounties-engine.js"), quest=read("draft-quests-ui.js"), shop=read("economy-shop-core.js"), reserve=read("planetary-reserve.js");

// Intentional compatibility wall: only pack-bound Custom Packs and separate Poker remain excluded; Save & Steal is post-draft compatible.
for(const id of ["enableCustomPacks","enablePokerDraft"]){
  assert.match(current,new RegExp(`"${id}"`),`GC incompatibility remains explicit: ${id}`);
}
assert.doesNotMatch((current.match(/const INCOMPATIBLE_IDS = \[([\s\S]*?)\];/)||[])[1]||"",/enableSaveSteal|turnTimerSeconds|Timer|enableCerebro/,
  "Timer and Cerebro remain supported in Galactic Current");
assert.match(cerebro,/GalacticCurrent\?\.getState\?\.\(\)/,"Cerebro reads authoritative Galactic Current state");
assert.match(cerebro,/current\?\.active && Array\.isArray\(current\.cards\)/,"Cerebro ranks real live-current cards when Galactic Current is active");

// Modal-based extensions expose a blocking dialog to Timer/Cerebro lifecycle guards.
assert.match(quest,/aria-modal="true"/,"Quest sanctuary is modal");
assert.match(shop,/aria-modal="true"/,"Economy atomic flow is modal");
assert.match(market,/aria-modal="true"/,"Trade Market is modal");
assert.match(reserve,/aria-modal="true"/,"Planetary Reserve is modal");
assert.match(html,/continuePostDraftAfterGrootGardens\(\)[\s\S]*if\(!draftFinished\)/,
  "post-draft extensions are gated behind draft completion");

// Market additionally preserves an explicit host-timer pause contract.
assert.match(market,/DraftTurnTimer\?\.pause\?\.\(\)/);
assert.match(market,/DraftTurnTimer\?\.play\?\.\(\)/);

// Bounties now participate in both Timer and Cerebro lifecycle blocking.
assert.match(bounty,/function hasPendingPresentations\(\)/);
assert.match(timer,/BountyEngine\?\.hasPendingPresentations\?\.\(\)/);
assert.match(cerebro,/BountyEngine\?\.hasPendingPresentations\?\.\(\)/);

// Mysterio exception: public Peek intentionally does not pause Timer, but Cerebro must not cheat through it.
assert.doesNotMatch(timer,/MysterioUI\?\.getStatus|currentPeek/,
  "Timer does not freeze for Mysterio public Peek");
assert.match(cerebro,/MysterioUI\?\.getPublicCardSnapshot\?\.\(card\)/,
  "Cerebro evaluates Mysterio illusions from the public snapshot");

// Timer remains independent from Cerebro; no timeout-driven double-pick path is introduced.
assert.doesNotMatch(timer,/CerebroAutopilot|enableCerebro/);

console.log("PASS Extension Lifecycle Audit Contracts");
