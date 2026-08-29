"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
const html=read("snap-draft.html");
const settings=read("settings-v2.js");
const ui=read("planetary-reserve.js");
const css=read("planetary-reserve.css");
const saveSteal=read("saveSteal.js");
const chronicle=fs.readFileSync(path.join(__dirname,"..","draft.html"),"utf8");
const stats=fs.readFileSync(path.join(__dirname,"..","draft-stats-engine.js"),"utf8");

assert.match(html,/id="enablePlanetaryReserve"/,"settings expose an ON/OFF checkbox");
assert.match(html,/PLANETARNA REZERWA/);
assert.match(html,/planetary-reserve-engine\.js[\s\S]*planetary-reserve\.js/,"engine loads before UI");
assert.match(html,/planetary-reserve\.css/);
assert.match(settings,/sideboard:\{[\s\S]*enablePlanetaryReserve[\s\S]*size:3[\s\S]*candidatePoolSize:12[\s\S]*version:1/);
assert.match(settings,/selectedModeId\(\)!=="poker"&&checked\("enablePlanetaryReserve"\)/,"Poker Draft blocks Planetarna Rezerwa V1");
assert.match(ui,/buildPackCardButton\(card,index\)/,"sideboard cards reuse the canonical pack renderer");
assert.match(css,/\.planetary-reserve-card\.pack-card-btn::before\{background-image:url\("draft-assets\/cosmictool\.webp"\)!important\}/,"only the requested card backdrop is overridden");
assert.match(ui,/selected\.length!==3/,"confirmation requires exactly three cards");
assert.match(ui,/origin:"planetary_reserve"[\s\S]*zone="sideboard"/,"selected cards are marked as Sideboard instances");
assert.match(html,/deck:decks\[i\]\.map\(c=>c\.name\)[\s\S]*sideboard:window\.PlanetaryReserveUI\.getPlayerSideboardNames\(i\)/,"export keeps main deck and Sideboard separate");
assert.match(html,/continuePendingDraftFinish[\s\S]*CollectorUI\?\.beginFinalization[\s\S]*showDraftFinishedScene/,"Collector finalizes before the post-draft chain");
assert.match(html,/DevilDinoUI\?\.onDraftFinished[\s\S]*enableSaveSteal[\s\S]*PlanetaryReserveUI\?\.offerPhase/,"Planetarna Rezerwa is offered only after Devil Dino and Save & Steal");
assert.match(saveSteal,/__saveStealCompleted\s*=\s*true[\s\S]*continuePostDraftAfterGrootGardens/,"Save & Steal resumes the shared finalization chain once");
assert.match(html,/planetary-reserve-live-divider[\s\S]*getPlayerSideboard| getPlayerSideboard[\s\S]*planetary-reserve-live-divider/,"finished live deck panels append a compact reserve zone in the same deck panel");
assert.match(chronicle,/sideboardMarkup[\s\S]*PLANETARNA REZERWA[\s\S]*SIDEBOARD/,"Chronicles render a conditional Sideboard section");
assert.match(stats,/zone:'SIDEBOARD'/,"stats index records the structural Sideboard zone");
assert.match(stats,/mainDeckAppearances[\s\S]*sideboardAppearances/,"card appearances retain their source zone");

for(const asset of ["planetary_reserve_logo.png","planetary_reserve_modal_bg.png","planetary_reserve_badge.png","planetary_reserve_card_glow.png"]){
    assert.ok(html.includes(asset)||ui.includes(asset)||css.includes(asset),`missing asset reference: ${asset}`);
}


console.log("PLANETARY_RESERVE_INTEGRATION_REGRESSION_OK",JSON.stringify({settings:true,finalization:true,export:true,chronicles:true,assetMode:"assetless"}));
