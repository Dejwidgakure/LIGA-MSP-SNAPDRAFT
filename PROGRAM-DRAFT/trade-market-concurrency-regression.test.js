const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

const source=fs.readFileSync(__dirname+"/trade-market-engine.js","utf8");
let currentPlayer=0;
let decks=[];
let wallets=[];
let replacementSequence=0;

function findEntry(playerIndex,instanceId){
    const index=(decks[playerIndex]||[]).findIndex(entry=>String(entry.card.instanceId)===String(instanceId));
    return index<0?null:{...decks[playerIndex][index],index};
}
function removeEntry(playerIndex,instanceId){
    const index=(decks[playerIndex]||[]).findIndex(entry=>String(entry.card.instanceId)===String(instanceId));
    return index<0?null:decks[playerIndex].splice(index,1)[0];
}
function replacementFor(card){
    return {card:{instanceId:`replacement-${++replacementSequence}`,name:"Replacement",cost:card.cost,power:1}};
}

const runtime={
    getPlayers:()=>["Kupujący","Sprzedający"],
    getCurrentPlayerIndex:()=>currentPlayer,
    getTurnKey:()=>`turn-${currentPlayer}`,
    getDeckEntries:index=>decks[index]||[],
    findEntry,
    previewCoinPurchase:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>findEntry(sellerIndex,targetInstanceId)&&findEntry(buyerIndex,buyerReleaseInstanceId)&&buyerIndex!==sellerIndex?{ok:true}:{ok:false,reason:"Brak karty"},
    executeCoinPurchase:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>{
        const target=removeEntry(sellerIndex,targetInstanceId);
        const release=removeEntry(buyerIndex,buyerReleaseInstanceId);
        if(!target||!release) return {ok:false,reason:"Brak karty"};
        const replacement=replacementFor(target.card);
        decks[buyerIndex].push(target);
        decks[sellerIndex].push(replacement);
        return {ok:true,targetCard:target.card,releaseCard:release.card,replacement:replacement.card};
    },
    previewCardSwap:({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId})=>findEntry(sellerIndex,targetInstanceId)&&findEntry(buyerIndex,offerCardInstanceId)?{ok:true}:{ok:false,reason:"Brak karty"},
    executeCardSwap:({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId})=>{
        const target=removeEntry(sellerIndex,targetInstanceId);
        const offer=removeEntry(buyerIndex,offerCardInstanceId);
        if(!target||!offer) return {ok:false,reason:"Brak karty"};
        decks[buyerIndex].push(target);
        decks[sellerIndex].push(offer);
        return {ok:true,targetCard:target.card,offerCard:offer.card};
    },
    validateCashTransfer:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>findEntry(sellerIndex,targetInstanceId)&&findEntry(buyerIndex,buyerReleaseInstanceId)?{ok:true}:{ok:false,reason:"Brak karty"},
    executeCashTransfer:({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId})=>{
        const target=removeEntry(sellerIndex,targetInstanceId);
        const release=removeEntry(buyerIndex,buyerReleaseInstanceId);
        if(!target||!release) return {ok:false,reason:"Brak karty"};
        const replacement=replacementFor(target.card);
        decks[buyerIndex].push(target);
        decks[sellerIndex].push(replacement);
        return {ok:true,targetCard:target.card,releaseCard:release.card,replacement:replacement.card};
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
const engine=window.TradeMarketEngine;

function reset(){
    currentPlayer=0;
    decks=[
        [
            {card:{instanceId:"offer-1",name:"Agent Venom",cost:2,power:3}},
            {card:{instanceId:"release-1",name:"Wasp",cost:0,power:1}}
        ],
        [{card:{instanceId:"target-1",name:"Supergiant",cost:4,power:6}}]
    ];
    wallets=[20,5];
    engine.beginDraft(["Kupujący","Sprzedający"],{enabled:true});
}

reset();
currentPlayer=1;
const targetListing=engine.createListing({playerIndex:1,cardInstanceId:"target-1",price:6});
assert.equal(targetListing.ok,true);
currentPlayer=0;
const negotiation=engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",mode:"card",offerCardInstanceId:"offer-1"});
assert.equal(negotiation.ok,true,"a listed target remains negotiable until a transaction commits");
const offeredListing=engine.createListing({playerIndex:0,cardInstanceId:"offer-1",price:3});
assert.equal(offeredListing.ok,true,"an offered card may also remain listed before the deal commits");
const accepted=engine.resolveNegotiation({negotiationId:negotiation.negotiation.id,accept:true});
assert.equal(accepted.ok,true);
const listingsAfterNegotiation=engine.getListings();
assert.equal(listingsAfterNegotiation.find(item=>item.id===targetListing.listing.id).status,"expired");
assert.equal(listingsAfterNegotiation.find(item=>item.id===offeredListing.listing.id).status,"expired");
assert(listingsAfterNegotiation.filter(item=>item.status==="expired").every(item=>item.expireReason==="negotiation_committed"));

reset();
currentPlayer=1;
const marketListing=engine.createListing({playerIndex:1,cardInstanceId:"target-1",price:6});
assert.equal(marketListing.ok,true);
currentPlayer=0;
const pending=engine.createNegotiation({buyerIndex:0,sellerIndex:1,targetInstanceId:"target-1",price:5,mode:"cash",buyerReleaseInstanceId:"offer-1"});
assert.equal(pending.ok,true);
const purchased=engine.buyListing({buyerIndex:0,listingId:marketListing.listing.id,buyerReleaseInstanceId:"release-1"});
assert.equal(purchased.ok,true,"a market purchase can commit while a negotiation is still pending");
assert.equal(engine.getListings().find(item=>item.id===marketListing.listing.id).status,"sold");
const pendingAfterPurchase=engine.getNegotiations().find(item=>item.id===pending.negotiation.id);
assert.equal(pendingAfterPurchase.status,"expired","the losing pending negotiation is invalidated immediately");
assert.equal(pendingAfterPurchase.expireReason,"market_purchase_committed");

console.log("Trade Market commit-wins concurrency regression OK");
