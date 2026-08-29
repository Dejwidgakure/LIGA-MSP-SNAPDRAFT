"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("./planetary-reserve-engine.js");

const tags={
    mechanicFamilies:[{id:"destroy"},{id:"move"},{id:"tech"}],
    subtypes:[{id:"draw"},{id:"transform"}],
    deckArchetypes:[{id:"classic-destroy"},{id:"move-combo"}],
    abilityTypes:[{id:"on-reveal"}],
    teams:[{id:"xmen"}],
    themes:[{id:"cosmic"}]
};

const deck=Array.from({length:12},(_,index)=>({
    name:`Main ${index+1}`,
    cost:(index%6)+1,
    power:index+2,
    tags:[index<7?"destroy":"move",index%2?"draw":"transform",index<7?"classic-destroy":"move-combo",...(index===0?["tech"]:[])]
}));

const candidates=Array.from({length:32},(_,index)=>({
    name:`Reserve ${index+1}`,
    cost:(index%6)+1,
    power:3+(index%10),
    tags:[index%3===0?"destroy":"move",index%2?"draw":"transform",index%3===0?"classic-destroy":"move-combo",...(index<4?["tech"]:[])]
}));
candidates.push({name:"Banned Reserve",cost:2,power:9,tags:["destroy","classic-destroy","tech"]});
candidates.push({name:"Joker Reserve",cost:2,power:9,tags:["destroy","classic-destroy"],joker:true});

const result=engine.buildCandidatePool({
    deck,
    cards:[...deck,...candidates],
    tags,
    bannedCards:["Banned Reserve"],
    random:()=>0.25
});

assert.equal(result.exact,true,"generator must return a complete 12-card pool");
assert.equal(result.candidates.length,12,"candidate pool is exactly 12 cards");
assert.equal(new Set(result.candidates.map(item=>item.card.name)).size,12,"candidate cards are unique");
assert.equal(result.candidates.some(item=>deck.some(card=>card.name===item.card.name)),false,"main-deck cards are excluded");
assert.equal(result.candidates.some(item=>item.card.name==="Banned Reserve"),false,"banned cards are excluded");
assert.equal(result.candidates.some(item=>item.card.joker),false,"Jokers are excluded");
assert.equal(result.techRule.mainDeckTechCount,1,"TECH count comes only from the main deck");
assert.equal(result.techRule.reserved,true,"Reserve always keeps one dedicated TECH slot when legal TECH exists");
assert.equal(result.techRule.fulfilled,true,"the TECH coverage request was fulfilled");
assert.equal(result.techRule.offered,1,"Reserve V2 offers exactly one dedicated TECH candidate");
assert.equal(result.candidates.filter(item=>item.reasonCode==="tech_answer").length,1,"exactly one candidate owns the TECH-answer reason");

const techDeck=deck.map((card,index)=>index===1?{...card,tags:[...card.tags,"tech"]}:card);
const stillOneTech=engine.buildCandidatePool({deck:techDeck,cards:candidates,tags,random:()=>0.25});
assert.equal(stillOneTech.techRule.mainDeckTechCount,2);
assert.equal(stillOneTech.techRule.reserved,true,"the dedicated TECH candidate remains part of the canonical Reserve composition");
assert.equal(stillOneTech.candidates.filter(item=>item.reasonCode==="tech_answer").length,1);

const player={deck:["A","B"],sideboard:["C","D","E"]};
assert.deepEqual(engine.getMainDeckCards(player),["A","B"]);
assert.deepEqual(engine.getSideboardCards(player),["C","D","E"]);
assert.deepEqual(engine.getAllDraftedCards(player),["A","B","C","D","E"]);
assert.equal(player.deck.length,2,"helpers never mutate the main deck");

// Real-database smoke simulation: many different 12-card decks must still
// produce a complete, unique and non-overlapping reserve pool.
const realCards=new Function(`${fs.readFileSync(path.join(__dirname,"..","cards.js"),"utf8")};return cardDatabase;`)();
const realTags=new Function(`${fs.readFileSync(path.join(__dirname,"..","tags.js"),"utf8")};return TAGS;`)();
for(let sample=0;sample<250;sample++){
    const start=(sample*7)%Math.max(1,realCards.length-12);
    const realDeck=realCards.slice(start,start+12);
    const generated=engine.buildCandidatePool({deck:realDeck,cards:realCards,tags:realTags,random:()=>0.37});
    assert.equal(generated.exact,true,`real card pool failed at sample ${sample}`);
    assert.equal(new Set(generated.candidates.map(item=>item.card.name)).size,12);
    assert.equal(generated.candidates.some(item=>realDeck.some(card=>card.name===item.card.name)),false);
    const legalTech=realCards.filter(card=>(card.tags||[]).includes("tech")&&!realDeck.some(deckCard=>deckCard.name===card.name)).length;
    assert.equal(generated.candidates.filter(item=>item.reasonCode==="tech_answer").length,legalTech?1:0);
}

console.log("PLANETARY_RESERVE_ENGINE_REGRESSION_OK",JSON.stringify({pool:result.candidates.length,sideboard:engine.SIDEBOARD_SIZE,tech:result.techRule,realDatabaseSamples:250}));
