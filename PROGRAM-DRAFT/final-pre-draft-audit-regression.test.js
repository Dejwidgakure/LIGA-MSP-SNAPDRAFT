"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

// 1) Canonical page / cache-busters / compatibility wall.
const html=read("snap-draft.html");
const current=read("galactic-current.js");
assert.match(html,/trade-market-runtime\.js\?v=0\.4\.1-final-audit-01/);
assert.match(html,/trade-market-engine\.js\?v=0\.6\.1-final-audit-01/);
assert.match(html,/trade-market-ui\.js\?v=1\.0\.5-final-audit-01/);
assert.match(html,/superpowers-collector\.js\?v=1\.1-final-last-pack-parity/);
const incompat=(current.match(/const INCOMPATIBLE_IDS = \[([\s\S]*?)\];/)||[])[1]||"";
for(const id of ["enableCustomPacks","enablePokerDraft"]) assert.match(incompat,new RegExp(`"${id}"`));
for(const id of ["enableSaveSteal","enableSuperpowers","enableEconomy","enableBounties","enableDraftQuests","enableTradeMarket"]){
  assert.doesNotMatch(incompat,new RegExp(id));
}

// 2) Trade Market: cash-only means coin-only consideration, NOT +1 Main Deck card.
const marketRuntime=read("trade-market-runtime.js");
const marketEngine=read("trade-market-engine.js");
const marketUi=read("trade-market-ui.js");
assert.match(marketRuntime,/function executeCoinPurchase\(\{buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId/);
assert.match(marketRuntime,/buyerDeck\[check\.release\.index\]=targetCard/);
assert.doesNotMatch(marketRuntime,/function executeCoinPurchase[\s\S]*?buyerDeck\.push\(targetCard\)/);
assert.match(marketEngine,/buyerReleaseInstanceId:releaseCard\?String\(releaseCard\.card\.instanceId/);
assert.match(marketEngine,/buyerReleaseInstanceId:negotiation\.buyerReleaseInstanceId/);
assert.match(marketUi,/KARTA ZASTĘPOWANA W TWOIM DECKU/);
assert.match(marketUi,/buyerReleaseInstanceId:mode==="cash"\?own:null/);

// Dynamic real-runtime 12 -> 12 invariant, with Galactic Current active.
{
  const archived=[];
  const context={
    window:{dispatchEvent:()=>{}},players:["Buyer","Seller"],
    decks:[
      Array.from({length:12},(_,i)=>({instanceId:`b-${i}`,name:`Buyer ${i}`,cost:i%6,power:i+1})),
      Array.from({length:12},(_,i)=>({instanceId:`s-${i}`,name:`Seller ${i}`,cost:i%6,power:i+2}))
    ],
    packStartIndex:0,currentPickIndex:0,draftFinished:false,getCurrentPlayerIndex:()=>0,
    generateLegalRuntimeCards:(count,opts)=>[{instanceId:"replacement-audit",name:"Replacement",cost:Number(opts?.exactCost)||0,power:1}],
    archiveCardToGraveyard:(reason,card,meta)=>{archived.push({reason,card,meta});return {ok:true};},
    showDecks:()=>{},refreshOpenDeckInspectors:()=>{},updateCurrentPickerBanner:()=>{},updateInfoPanel:()=>{},
    CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}},console
  };
  context.window.GalacticCurrent={getState:()=>({active:true,round:1,pickNumber:3})};
  context.window.DraftStateEngine={log:()=>{}};
  vm.createContext(context);vm.runInContext(marketRuntime,context,{filename:"trade-market-runtime.js"});
  const result=context.window.TradeMarketRuntime.executeCoinPurchase({buyerIndex:0,sellerIndex:1,targetInstanceId:"s-4",buyerReleaseInstanceId:"b-7",transactionId:"audit"});
  assert.equal(result.ok,true);
  assert.deepEqual(context.decks.map(deck=>deck.length),[12,12]);
  assert.equal(archived.length,1);
}

// 3) Economy: one passive JC per unique normal pick, hard cap 12.
{
  const source=read("economy-engine.js");
  const window={dispatchEvent:()=>{}};
  const context={window,CustomEvent:class{},structuredClone,Date,Math,Number,String,Boolean,Array,Object,JSON,Set,Map,console};
  vm.createContext(context);vm.runInContext(source,context,{filename:"economy-engine.js"});
  const engine=window.EconomyEngine;engine.beginDraft(["A"],{enabled:true});
  for(let i=1;i<=12;i++){
    const key=`audit:${i}:${i%2?"classic":"galactic_current"}`;
    const first=engine.registerNormalPickCompleted({playerIndex:0,completionKey:key});
    const duplicate=engine.registerNormalPickCompleted({playerIndex:0,completionKey:key});
    assert.equal(first.ok,true);assert.notEqual(first.awarded,false);assert.equal(Boolean(duplicate.awarded),false);
  }
  const extra=engine.registerNormalPickCompleted({playerIndex:0,completionKey:"audit:13:galactic_current"});
  const wallet=engine.getWallet(0);
  assert.equal(wallet.balance,12);assert.equal(wallet.passiveEarned,12);assert.equal(wallet.normalPicksCompleted,12);assert.equal(Boolean(extra.awarded),false);
}

// 4) Quest registry: every authored evaluator has a runtime implementation.
{
  const registry=require("./draft-quests-registry.js");
  const engine=read("draft-quests-engine.js");
  assert.equal(registry.quests.length,40);
  const evaluators=[...new Set(registry.quests.map(q=>q.evaluator))];
  assert.equal(evaluators.length,38);
  for(const evaluator of evaluators) assert(engine.includes(`case "${evaluator}"`)||engine.includes(`case '${evaluator}'`),`missing quest evaluator ${evaluator}`);
}

// 5) Collector first-opening animation is actually wired from JS to existing CSS.
{
  const js=read("superpowers-collector.js"),css=read("superpowers-collector.css");
  assert.match(css,/\.spx-collector-overlay\.is-first-opening/);
  assert.match(js,/overlay\?\.classList\.add\("is-first-opening"\)/);
  assert.match(js,/classList\.remove\("is-open","is-finalizing","is-gallery","is-first-opening"\)/);
  assert.match(js,/`\$\{baseClass\} pack-card-btn`/);
  assert.doesNotMatch(css,/\.spx-collector-card(?:\.pack-card-btn)? \.pack-card-name/);
}

console.log("FINAL_PRE_DRAFT_AUDIT_OK",JSON.stringify({tradeDeckInvariant:"12->12",economyPassiveCap:12,quests:40,questEvaluators:38}));
