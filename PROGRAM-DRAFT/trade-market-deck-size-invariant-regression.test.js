const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const path=require("path");

const source=fs.readFileSync(path.join(__dirname,"trade-market-runtime.js"),"utf8");
let archived=[];
const context={
  window:{dispatchEvent:()=>{}},
  players:["Buyer","Seller"],
  decks:[
    Array.from({length:12},(_,i)=>({instanceId:`b-${i}`,name:`Buyer ${i}`,cost:i%6,power:i+1})),
    Array.from({length:12},(_,i)=>({instanceId:`s-${i}`,name:`Seller ${i}`,cost:i%6,power:i+2}))
  ],
  packStartIndex:0,currentPickIndex:0,draftFinished:false,
  getCurrentPlayerIndex:()=>0,
  generateLegalRuntimeCards:(count,opts)=>[{instanceId:"replacement-1",name:"Replacement",cost:Number(opts?.exactCost)||0,power:1}],
  archiveCardToGraveyard:(reason,card,meta)=>{archived.push({reason,card,meta});return {ok:true};},
  showDecks:()=>{},refreshOpenDeckInspectors:()=>{},updateCurrentPickerBanner:()=>{},updateInfoPanel:()=>{},
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}},
  console
};
context.window.GalacticCurrent={getState:()=>({active:true,round:2,pickNumber:4})};
context.window.DraftStateEngine={log:()=>{}};
vm.createContext(context);
vm.runInContext(source,context,{filename:"trade-market-runtime.js"});
const runtime=context.window.TradeMarketRuntime;

const before=context.decks.map(deck=>deck.length);
const missing=runtime.previewCoinPurchase({buyerIndex:0,sellerIndex:1,targetInstanceId:"s-3"});
assert.equal(missing.ok,false,"cash-only negotiation must reject a purchase with no release slot");

const preview=runtime.previewCoinPurchase({buyerIndex:0,sellerIndex:1,targetInstanceId:"s-3",buyerReleaseInstanceId:"b-5"});
assert.equal(preview.ok,true);
const result=runtime.executeCoinPurchase({buyerIndex:0,sellerIndex:1,targetInstanceId:"s-3",buyerReleaseInstanceId:"b-5",transactionId:"t-1"});
assert.equal(result.ok,true);
assert.deepEqual(context.decks.map(deck=>deck.length),before,"cash-only negotiation may not change either Main Deck size");
assert(context.decks[0].some(card=>card.instanceId==="s-3"),"buyer receives target card");
assert(!context.decks[0].some(card=>card.instanceId==="b-5"),"buyer release card leaves buyer deck");
assert(!context.decks[1].some(card=>card.instanceId==="b-5"),"buyer release card does not go to seller");
assert(context.decks[1].some(card=>card.instanceId==="replacement-1"),"seller receives legal replacement");
assert.equal(archived.length,1,"released buyer card is archived exactly once");
assert.equal(result.releaseCard.instanceId,"b-5");
console.log("TRADE_MARKET_DECK_SIZE_INVARIANT_OK",JSON.stringify({before,after:context.decks.map(deck=>deck.length),archived:archived.length}));
