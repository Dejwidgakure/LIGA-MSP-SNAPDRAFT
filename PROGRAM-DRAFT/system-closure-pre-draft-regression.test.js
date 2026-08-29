const fs = require('fs');
const path = require('path');
const root = __dirname;
function read(name){ return fs.readFileSync(path.join(root,name),'utf8'); }
function ok(cond,msg){ if(!cond){ console.error('FAIL:',msg); process.exitCode=1; } else console.log('PASS:',msg); }

const gc=read('galactic-current.js');
const thor=read('superpowers-thor.js');
const joker=read('joker-v2-ui.js');
const cerebro=read('cerebro-autopilot.js');
const ui=read('superpowers-ui.js');
const settings=read('settings-v2.js');
const html=read('snap-draft.html');
const economy=read('economy.css');

ok(!/INCOMPATIBLE_IDS\s*=\s*\[[\s\S]*?enableSaveSteal/.test(gc),'Save & Steal is not blocked by Galactic Current');
ok(/enableCustomPacks/.test(gc) && /enablePokerDraft/.test(gc),'true Galactic Current incompatibilities remain registered');
ok(/allowDeferredTurn===true/.test(gc) && /deferredPickIndex/.test(gc),'Galactic Current accepts an explicitly deferred queued normal pick');
ok(/allowDeferredTurn:true/.test(thor),'Thor requests deferred queued-pick resolution in Galactic Current');
ok(/state\.allowCancel=mode==="surprise" \? false/.test(joker),'Surprise Joker is mandatory once opened');
ok(/mandatorySurprise = mode === "surprise"/.test(cerebro),'Cerebro recognizes mandatory Surprise resolution');
ok(/window\.ThorUI\?\.isBusy/.test(ui) && /window\.CollectorUI\?\.isBusy/.test(ui),'Thor and Collector lock draft mutations while busy');
ok(/Custom Packi tworzą klasyczne paczki/.test(settings),'Custom Packs explain Galactic Current N/A reason');
ok(/N\/A w Gwiezdnym Prądzie/.test(html),'Custom Packs UI visibly marks Galactic Current N/A');
ok(/is-surprise-sale-ribbon,[\s\S]*is-cosmic-sale-ribbon\{\s*top:50%!important;/.test(economy),'Cosmic/Surprise sale ribbons are vertically centered');
ok(/economyPatch113BCosmicRibbon[\s\S]*translateY\(-50%\)/.test(economy) && /economyPatch113CSurpriseRibbon[\s\S]*translateY\(-50%\)/.test(economy),'sale ribbon animations preserve centered baseline');
ok(/is-first-opening/.test(read('superpowers-collector.css')) && /is-first-opening/.test(read('superpowers-collector.js')),'Collector first-opening animation remains present');
ok(/pr-planet/.test(read('planetary-reserve.css')) && /is-opening/.test(read('planetary-reserve.js')),'Planetary Reserve atmospheric opening remains present');

if(process.exitCode) process.exit(process.exitCode);
