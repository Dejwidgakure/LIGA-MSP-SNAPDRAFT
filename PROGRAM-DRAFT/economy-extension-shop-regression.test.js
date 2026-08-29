const fs=require('fs');
const assert=require('assert');
const engine=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
const shop=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');
const save=fs.readFileSync(__dirname+'/saveSteal.js','utf8');
const jokerUi=fs.readFileSync(__dirname+'/joker-v2-ui.js','utf8');

assert.match(shop,/id:"joker_under_counter"/);
assert.match(shop,/name:"Joker spod lady"/);
assert.match(shop,/prices:\{early:6,late:8\}/);
assert.match(shop,/minimumRarity:"epic"/);
assert.match(shop,/rarity==="epic"\|\|rarity==="legendary"/);
assert.match(shop,/allowCancel:false/);

assert.match(shop,/id:"custom_delivery"/);
assert.match(shop,/prices:\{early:7,late:9\}/);
assert.match(shop,/getCustomPackReplacementOptions/);
assert.match(shop,/count:3|,3\)/);

assert.match(shop,/id:"superpower_recharge"/);
assert.match(shop,/prices:\{early:10,late:10\}/);
assert.match(shop,/maxPerDraft:1/);
assert.match(html,/rechargeEconomySuperpower/);

assert.match(shop,/id:"save_steal_extra_save"/);
assert.match(shop,/prices:\{early:3,late:4\}/);
assert.match(shop,/maxPerDraft:2/);
assert.match(save,/save_steal_extra_saved_ids/);
assert.match(save,/isEconomyExtraSavedCard\(victim,card\)/);

assert.match(engine,/data-economy-shop-pages/);
assert.match(engine,/shopPage==="extensions"/);
assert.match(engine,/economy-extension-seal/);
assert.match(shop,/section:"extensions"/);
assert.match(shop,/mysteryEligible:false/);
assert.match(engine,/extensionState:/);
assert.match(jokerUi,/state\.allowCancel=mode===\"surprise\" \? false : options\?\.allowCancel!==false/);
assert.match(jokerUi,/if\(state\.resolving \|\| state\.allowCancel===false\) return/);

console.log('Economy E2.2A extension shop regression OK');
