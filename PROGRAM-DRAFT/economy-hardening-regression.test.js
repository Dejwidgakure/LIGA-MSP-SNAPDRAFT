const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const engineCode=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
const shopCode=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');
const reshuffle=fs.readFileSync(__dirname+'/reshuffle.js','utf8');

const sandbox={console,setTimeout,clearTimeout};
sandbox.window=sandbox;
sandbox.CustomEvent=function(type,init){this.type=type;this.detail=init?.detail;};
sandbox.dispatchEvent=()=>{};
sandbox.document=undefined;

let externalState={deckValue:'A'};
let draftLog=[];
let openTx=null;

sandbox.DraftStateEngine={
  log:(type,payload)=>{draftLog.push({type,payload});return {type,payload};}
};
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
vm.runInContext(engineCode,sandbox,{filename:'economy-engine.js'});
const E=sandbox.EconomyEngine;

sandbox.DraftFoundation={
  beginTransaction:(type,context)=>{
    if(openTx) return {ok:false,reason:'busy'};
    openTx={
      id:'tx1',
      external:JSON.parse(JSON.stringify(externalState)),
      draftLog:JSON.parse(JSON.stringify(draftLog)),
      economy:E.exportState()
    };
    return {ok:true,transactionId:'tx1'};
  },
  commitTransaction:(id)=>{
    assert.equal(id,'tx1');
    openTx=null;
    return true;
  },
  rollbackTransaction:(id)=>{
    assert.equal(id,'tx1');
    externalState=JSON.parse(JSON.stringify(openTx.external));
    draftLog=JSON.parse(JSON.stringify(openTx.draftLog));
    E.restoreState(openTx.economy);
    openTx=null;
    return true;
  }
};

vm.runInContext(shopCode,sandbox,{filename:'economy-shop-core.js'});
E.beginDraft(['A'],{enabled:true});
for(let i=0;i<6;i++) E.registerNormalPickCompleted({playerIndex:0,completionKey:'t'+i});
const startingBalance=E.getWallet(0).balance;

// Full rollback: draft/external mutation + DraftState log + JeffCoin debit must disappear together.
E.registerProduct({
  id:'hardening_fail',
  name:'Fail',
  prices:{early:1,late:1},
  resolve:async ()=>{
    externalState.deckValue='BROKEN';
    sandbox.DraftStateEngine.log('external_mutation',{});
    return {ok:false,reason:'forced failure'};
  }
});

(async()=>{
  const result=await E.purchase(0,'hardening_fail',{source:'test'});
  assert.equal(result.ok,false);
  assert.equal(externalState.deckValue,'A','external draft mutation rolled back');
  assert.equal(E.getWallet(0).balance,startingBalance,'JeffCoin debit rolled back');
  assert.ok(!draftLog.some(entry=>entry.type==='economy_coin_spent'),'phantom coin-spend log rolled back');

  // Mutex: while first purchase is unresolved, a second purchase must be rejected.
  let releaseSlow;
  const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
  E.registerProduct({
    id:'hardening_slow',
    name:'Slow',
    prices:{early:1,late:1},
    resolve:async ()=>{await slowGate;return {ok:true};}
  });
  const first=E.purchase(0,'hardening_slow',{source:'test'});
  await new Promise(resolve=>setTimeout(resolve,0));
  const second=await E.purchase(0,'hardening_slow',{source:'test'});
  assert.equal(second.ok,false);
  assert.match(second.reason,/dokończ bieżący zakup/i);
  releaseSlow();
  const firstResult=await first;
  assert.equal(firstResult.ok,true);

  // Static integration guards.
  assert.match(shopCode,/repairTarget:true/,'repair flows mark Wolverine-sensitive targets');
  assert.match(shopCode,/Czynnik regeneracyjny Wolverinea chroni tę kartę przed przelosowaniem do końca draftu\./);
  assert.match(html,/!window\.EconomyEngine\?\.isCardProtected\?\.\(entry\.card\)/,'Captain ricochet skips Stellar Shield');
  assert.match(reshuffle,/occupiedNames/,'admin reroll filters occupied deck names');
  assert.match(reshuffle,/getLegalOptions\(3,p,c\)/);

  console.log('Economy E2.1B hardening regression OK');
})().catch(error=>{console.error(error);process.exit(1);});
