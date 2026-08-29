const fs=require("fs");
const assert=require("assert");
const read=f=>fs.readFileSync(f,"utf8");

const qcss=read("draft-quests.css"), qjs=read("draft-quests-ui.js");
assert(qcss.includes("questArishemSixEyesPseudo"),"quest result must use animation-safe six-eye pseudo animation");
assert(qcss.includes(".draft-quest-toast-eyes::before"),"quest eyes must render on a clean pseudo layer instead of an image mask");
assert(qjs.includes('const resultHold=(fx==="completion"||fx==="claim"||fx==="failed")?1600:0'),"result prompts must add post-transition reading hold");
assert(qjs.includes('"completion",4600'),"completed quest keeps canonical event duration plus result hold");
assert(qjs.includes('"failed",4300'),"failed quest keeps canonical event duration plus result hold");
assert(qcss.includes(".draft-quest-card.tier-avengers") && qcss.includes("rgba(233,47,115,.20)"),"Avengers tier needs its own red/magenta atmosphere");

const timer=read("draft-turn-timer.js"), timerCss=read("draft-turn-timer.css");
assert(!timer.includes("document.body.appendChild(hud)"),"timer HUD must stay in its natural WYBIERA slot");
assert(timer.includes("hud.classList.remove(\"draft-turn-hud-portal\")"),"timer removes any stale portal class");
assert(timerCss.includes("FINAL NATURAL TIMER LAYOUT"),"timer needs authoritative natural-layout CSS");

const groot=read("superpowers-groot.js"), grootCss=read("superpowers-groot.css");
const rewardsAt=groot.indexOf('<div class="spx-groot-rewards">');
const treeAt=groot.indexOf('<div class="spx-groot-economy-bridge');
assert(rewardsAt>=0 && treeAt>=0 && treeAt<rewardsAt,"Tree of Abundance must be visible in DOM flow before rewards");
assert(grootCss.includes("FINAL TREE OF ABUNDANCE FLOW"),"Groot shop must have one authoritative Tree layout");

const collector=read("superpowers-collector.css");
assert(collector.includes("left:50%!important;right:auto!important"),"Collector name must be centered on full card geometry");
assert(collector.includes("transform:translateX(-50%)!important"),"Collector name center transform missing");

const settings=read("settings-v2.css"), html=read("snap-draft.html");
assert(settings.includes("sv2ArchiveMatrixFallHotfix"),"Settings archive matrix hotfix missing");
assert(settings.includes("100%{top:108%"),"Settings matrix must traverse the whole configurator");
assert(html.includes("settings-v2.css?v=2.5.1-hotfix01-archive-rain"),"hotfix CSS cache bust missing");

const guide=read("../przewodnik.html");
assert(guide.includes("final-rc-hotfix01-extension-art-layering"),"Encyclopedia extension art hotfix missing");
assert(guide.includes("#rozszerzenia .canon-system-grid .canon-card.canon-visual::before"),"extension art layer selector missing");
console.log("FINAL RC HOTFIX 01 regression: PASS");
