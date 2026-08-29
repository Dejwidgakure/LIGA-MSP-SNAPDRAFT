const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const source=fs.readFileSync(path.join(__dirname,"trade-market-engine.js"),"utf8");

function makeHarness(){
    let decks=[];
    let wallets=[];
    let calls=null;
    let replacementSequence=0;

    const findEntry=(playerIndex,instanceId)=>(decks[playerIndex]||[]).find(entry=>String(entry.card.instanceId)===String(instanceId))||null;
    const removeEntry=(playerIndex,instanceId)=>{
        const index=(decks[playerIndex]||[]).findIndex(entry=>String(entry.card.instanceId)===String(instanceId));
        return index>=0?decks[playerIndex].splice(index,1)[0]:null;
    };
    const runtime={
        getPlayers:()=>["Kupujący","Sprzedający"],
        getCurrentPlayerIndex:()=>0,
        getTurnKey:()=>"pack-1:pick-1:player-0",
        getDeckEntries:index=>decks[index]||[],
        findEntry,
        previewCoinPurchase:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>findEntry(sellerIndex,targetInstanceId)&&findEntry(buyerIndex,buyerReleaseInstanceId)&&buyerIndex!==sellerIndex?{ok:true}:{ok:false,reason:"Brak karty"},
        executeCoinPurchase:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>{
            calls.coin++;
            const targetEntry=removeEntry(sellerIndex,targetInstanceId);
            const releaseEntry=removeEntry(buyerIndex,buyerReleaseInstanceId);
            if(!targetEntry||!releaseEntry) return {ok:false,reason:"Brak karty"};
            const replacement={card:{instanceId:`replacement-${++replacementSequence}`,name:"Karta zastępcza",cost:targetEntry.card.cost,power:1}};
            decks[buyerIndex].push(targetEntry);
            decks[sellerIndex].push(replacement);
            return {ok:true,targetCard:targetEntry.card,releaseCard:releaseEntry.card,replacement:replacement.card};
        },
        previewCardSwap:({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId})=>findEntry(sellerIndex,targetInstanceId)&&findEntry(buyerIndex,offerCardInstanceId)?{ok:true}:{ok:false,reason:"Brak karty"},
        executeCardSwap:({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId})=>{
            calls.swap++;
            const targetEntry=removeEntry(sellerIndex,targetInstanceId);
            const offerEntry=removeEntry(buyerIndex,offerCardInstanceId);
            if(!targetEntry||!offerEntry) return {ok:false,reason:"Brak karty"};
            decks[buyerIndex].push(targetEntry);
            decks[sellerIndex].push(offerEntry);
            return {ok:true,targetCard:targetEntry.card,offerCard:offerEntry.card};
        }
    };
    const economy={
        isEnabled:()=>true,
        getWallet:index=>({balance:wallets[index]}),
        canAfford:(index,amount)=>wallets[index]>=Number(amount),
        debit:(index,amount)=>wallets[index]>=Number(amount)?(wallets[index]-=Number(amount),{ok:true}):{ok:false,reason:"Za mało JC"},
        credit:(index,amount)=>(wallets[index]+=Number(amount),{ok:true}),
        playJeffCoinAward:()=>{}
    };
    const window={TradeMarketRuntime:runtime,EconomyEngine:economy,dispatchEvent:()=>{}};
    const context={window,CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}},structuredClone,Date,Math,Number,String,Boolean,Array,Object,JSON,Set,Map};
    vm.runInNewContext(source,context,{filename:"trade-market-engine.js"});

    function reset(){
        decks=[
            [{card:{instanceId:"offer-1",name:"Agent Venom",cost:2,power:3}}],
            [{card:{instanceId:"target-1",name:"Supergiant",cost:4,power:6}}]
        ];
        wallets=[20,5];
        calls={coin:0,swap:0};
        window.TradeMarketEngine.beginDraft(["Kupujący","Sprzedający"],{enabled:true});
    }
    return {engine:window.TradeMarketEngine,reset,get decks(){return decks;},get wallets(){return wallets;},get calls(){return calls;}};
}

const h=makeHarness();

h.reset();
const invalidCash=h.engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",price:5,mode:"cash"});
assert.equal(invalidCash.ok,false,"coins-only deal must name the buyer slot that will be replaced");
const cash=h.engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",price:5,mode:"cash",buyerReleaseInstanceId:"offer-1"});
assert.equal(cash.ok,true,"coins-only deal uses a release slot but does not offer that card to the seller");
assert.equal(cash.negotiation.offerCardInstanceId,null);
assert.equal(cash.negotiation.buyerReleaseInstanceId,"offer-1");
const cashResolved=h.engine.resolveNegotiation({negotiationId:cash.negotiation.id,accept:true});
assert.equal(cashResolved.ok,true);
assert.deepEqual(h.wallets,[15,10]);
assert.deepEqual(h.calls,{coin:1,swap:0});
assert.equal(h.decks[0].length,1,"coins-only deal preserves buyer deck size");
assert.equal(h.decks[1].length,1,"coins-only deal preserves seller deck size");
assert(h.decks[0].some(entry=>entry.card.instanceId==="target-1"),"buyer receives the target in a coins-only deal");
assert(!h.decks[1].some(entry=>entry.card.instanceId==="offer-1"),"release card never goes to the seller in a coins-only deal");

h.reset();
const invalidCard=h.engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",mode:"card"});
assert.equal(invalidCard.ok,false,"card-only deal must require the offered card");
const card=h.engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",mode:"card",offerCardInstanceId:"offer-1"});
assert.equal(card.ok,true);
assert.equal(card.negotiation.price,0);
assert.equal(h.engine.resolveNegotiation({negotiationId:card.negotiation.id,accept:true}).ok,true);
assert.deepEqual(h.wallets,[20,5],"card-only deal never moves JeffCoins");
assert.deepEqual(h.calls,{coin:0,swap:1});
assert(h.decks[1].some(entry=>entry.card.instanceId==="offer-1"),"seller receives the offered card");

h.reset();
const hybrid=h.engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",price:7,mode:"hybrid",offerCardInstanceId:"offer-1"});
assert.equal(hybrid.ok,true);
assert.equal(h.engine.resolveNegotiation({negotiationId:hybrid.negotiation.id,accept:true}).ok,true);
assert.deepEqual(h.wallets,[13,12],"hybrid deal moves the configured JeffCoins");
assert.deepEqual(h.calls,{coin:0,swap:1});
assert(h.decks[0].some(entry=>entry.card.instanceId==="target-1"));
assert(h.decks[1].some(entry=>entry.card.instanceId==="offer-1"));

console.log("Trade Market contract models OK");
