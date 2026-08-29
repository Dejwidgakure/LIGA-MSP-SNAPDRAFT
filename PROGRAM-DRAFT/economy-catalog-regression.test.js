const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const catalogCode=fs.readFileSync(__dirname+'/economy-catalog-data.js','utf8');
const shopCode=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const engineCode=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
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

const data=sandbox.EconomyCatalogData;
assert.ok(data,'EconomyCatalogData is exposed');
const core=data.core();
assert.equal(core.length,10,'reference catalog contains 10 Core products');
const byId=Object.fromEntries(core.map(p=>[p.id,p]));
assert.equal(byId.deep_space_scan.prices.sale,6);
assert.equal(byId.deep_space_scan.prices.standard,8,'Deep Space Scan standard price is canonical 8 JC');
assert.equal(byId.graveyard_revival.prices.standard,6,'Graveyard revival has a fixed 6 JC price');
assert.equal(byId.graveyard_revival.artAsset,'draft-assets/shop_art_graveyard_revival.png');

const standardPrices=core.map(p=>Number(p.prices.standard));
const min=Math.min(...standardPrices);
const max=Math.max(...standardPrices);
assert.equal(min,4,'cheapest standard Core product costs 4 JC');
assert.equal(max,8,'most expensive standard Core product costs 8 JC');
assert.ok(12-max>=min,'from untouched 12 JC, any single Core purchase still leaves enough for another cheapest Core purchase');

sandbox.EconomyEngine.beginDraft(['A'],{enabled:true});
for(let i=0;i<6;i++) sandbox.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'p'+i});
const runtime=Object.fromEntries(sandbox.EconomyEngine.getCatalog(0).map(p=>[p.id,p]));
assert.equal(runtime.deep_space_scan.quotedPrice,8,'runtime shop reads the canonical Deep Space Scan price');
assert.equal(sandbox.EconomyEngine.getCatalogReference().find(p=>p.id==='deep_space_scan').prices.standard,8);

assert.match(html,/economy-catalog-data\.js\?v=2\.0\.1/);
console.log('Economy catalog single-source regression OK');
