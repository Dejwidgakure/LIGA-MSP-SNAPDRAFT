const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const catalogCode=fs.readFileSync(__dirname+'/economy-catalog-data.js','utf8');
const engineCode=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
const shopCode=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');

const sandbox={console,setTimeout,clearTimeout};
sandbox.window=sandbox;
sandbox.CustomEvent=function(type,init){this.type=type;this.detail=init?.detail;};
sandbox.dispatchEvent=()=>{};
sandbox.DraftEconomyBridge={
  canShopPlayer:()=>({ok:true}),
  getDeckEntries:()=>[{index:0,card:{name:'Test',cost:2,power:3,instanceId:'x'}}],
  getReplacementOptions:(p,i,count)=>Array.from({length:count},(_,n)=>({name:'R'+n,cost:2,power:3})),
  getEligibleCosts:()=>[{cost:2,label:'2',count:10}],
  getEligibleSynergyTags:()=>[{id:'destroy',name:'Destroy',count:10}],
  getMomentumOpportunity:()=>({ok:true,targetKey:'classic:1:p0:o1',maxShift:4}),
  applyMomentum:()=>({ok:true,shifted:2}),
  isDraftFinished:()=>false
};
vm.createContext(sandbox);
vm.runInContext(catalogCode,sandbox,{filename:'economy-catalog-data.js'});
vm.runInContext(engineCode,sandbox,{filename:'economy-engine.js'});
vm.runInContext(shopCode,sandbox,{filename:'economy-shop-core.js'});

const E=sandbox.EconomyEngine;
E.beginDraft(['A'],{enabled:true});
assert.equal(E.getCatalog(0).length,10,'Core Shop ma 10 produktów');

let catalog=Object.fromEntries(E.getCatalog(0).map(p=>[p.id,p]));
assert.equal(catalog.cosmic_exchange.quotedPrice,3);
assert.equal(catalog.galactic_sift.quotedPrice,5);
assert.equal(catalog.deep_space_scan.quotedPrice,6);
assert.equal(catalog.low_orbit_scan.quotedPrice,4);
assert.equal(catalog.cost_scan.quotedPrice,5);
assert.equal(catalog.synergy_scan.quotedPrice,6);
assert.equal(catalog.hyperspace_jump.quotedPrice,5);
assert.equal(catalog.stellar_shield.quotedPrice,3);
assert.equal(catalog.mystery_offer.quotedPrice,5);
assert.equal(catalog.graveyard_revival.quotedPrice,6);

assert.equal(E.getWallet(0).balance,0,'brak JeffCoina przed pierwszym sfinalizowanym wyborem');
E.syncNormalPickStart({playerIndex:0,turnKey:'legacy-render'});
assert.equal(E.getWallet(0).balance,0,'render/start tury nie może dawać JeffCoina');
for(let i=0;i<5;i++) E.registerNormalPickCompleted({playerIndex:0,completionKey:'pick'+i});
assert.equal(E.getWallet(0).balance,5);
assert.equal(E.getPhase(0),'early');
E.registerNormalPickCompleted({playerIndex:0,completionKey:'pick4'});
assert.equal(E.getWallet(0).balance,5,'ten sam pick nie nalicza się drugi raz');
E.registerNormalPickCompleted({playerIndex:0,completionKey:'pick5'});
assert.equal(E.getWallet(0).balance,6);
assert.equal(E.getPhase(0),'late','po ukończeniu 6. picku następny ruch ma ceny standardowe');
catalog=Object.fromEntries(E.getCatalog(0).map(p=>[p.id,p]));
assert.equal(catalog.cosmic_exchange.quotedPrice,4);
assert.equal(catalog.galactic_sift.quotedPrice,7);
assert.equal(catalog.deep_space_scan.quotedPrice,8);
assert.equal(catalog.low_orbit_scan.quotedPrice,5);
assert.equal(catalog.cost_scan.quotedPrice,7);
assert.equal(catalog.synergy_scan.quotedPrice,8);
assert.equal(catalog.hyperspace_jump.quotedPrice,6);
assert.equal(catalog.stellar_shield.quotedPrice,4);
assert.equal(catalog.mystery_offer.quotedPrice,5);
assert.equal(catalog.graveyard_revival.quotedPrice,6);

assert.match(html,/economy-catalog-data\.js\?v=2\.0\.1/);
assert.match(html,/economy-shop-core\.js\?v=2\.5\.1/);
assert.match(html,/DraftEconomyBridge/);
assert.match(html,/\["reroll","replace","transform"\]/);
assert.match(html,/applyPendingMomentumForCurrentQueue/);

console.log('Economy E2 regression OK');
