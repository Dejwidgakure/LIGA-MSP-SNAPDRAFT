const fs=require("fs");
const path=require("path");
const vm=require("vm");
const assert=require("assert");

const source=fs.readFileSync(path.join(__dirname,"superpowers-blackcat.js"),"utf8");
const context={console,structuredClone,Math,Date,setTimeout,clearTimeout};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:"superpowers-blackcat.js"});
const Engine=context.BlackCatHeistEngine;

assert(Engine,"BlackCatHeistEngine should be exported without a DOM");

const rng=(()=>{let seed=123456789;return()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);})();
const session=Engine.createSession({rng,economyEnabled:false,target:{card:{name:"Kitty Pryde",cost:1,power:2}}});
assert.strictEqual(session.cells.length,35,"museum should be a 7x5 board");
assert.strictEqual(session.cells.filter(cell=>cell.kind==="laser").length,7,"museum should contain seven lasers");
assert.strictEqual(session.cells.filter(cell=>cell.kind==="reward").length,8,"museum should contain eight side rewards");
assert.strictEqual(session.cells.filter(cell=>cell.kind==="exhibit").length,1,"museum should contain one main exhibit");
assert(!session.cells.some(cell=>cell.reward?.type==="jeffcoin"),"JeffCoins must not spawn without Economy");
assert(session.safePath.every(index=>session.cells[index].kind!=="laser"),"the hidden route to the exhibit must always be laser-free");

for(const index of session.safePath.slice(1)){
    const result=Engine.move(session,index);
    assert(result.ok,"every step on the guaranteed route should be legal");
}
assert.strictEqual(session.status,"success","walking the guaranteed route should reach the main exhibit");
assert(session.movesRemaining>=0,"the guaranteed route must fit within the move budget");

const economySession=Engine.createSession({rng:()=>0.37,economyEnabled:true});
assert(economySession.cells.some(cell=>cell.reward?.type==="jeffcoin"),"Economy should add JeffCoin vitrines");

const agility=Engine.createSession({rng:()=>0.61,economyEnabled:false});
const first=agility.startIndex-agility.cols;
const second=first-agility.cols;
agility.cells[first]={...agility.cells[first],kind:"reward",reward:{type:"weakest_reroll",label:"CICHY REROLL",quality:2,rewardId:"forced-loot"}};
agility.cells[second]={...agility.cells[second],kind:"laser",reward:null};
assert(Engine.move(agility,first).reward,"the forced vitrine should award loot");
const laserHit=Engine.move(agility,second);
assert(laserHit.requiresAgilityChoice,"the first laser with loot should offer Cat Agility");
const survived=Engine.decideAgility(agility,true);
assert(survived.survived,"Cat Agility should survive one laser");
assert.strictEqual(agility.collected.length,0,"Cat Agility should sacrifice the lowest collected reward");
assert(agility.agilityUsed,"Cat Agility should be one-use");

const failure=Engine.createSession({rng:()=>0.23,economyEnabled:false});
const trap=failure.startIndex-failure.cols;
failure.cells[trap]={...failure.cells[trap],kind:"laser",reward:null};
const failed=Engine.move(failure,trap);
assert(failed.failed,"a laser without available agility payment should end the heist");
assert.strictEqual(failure.status,"failed");

const cashout=Engine.createSession({rng:()=>0.47,economyEnabled:false});
const lootCell=cashout.startIndex-cashout.cols;
cashout.cells[lootCell]={...cashout.cells[lootCell],kind:"reward",reward:{type:"queue_boost",label:"SKOK W KOLEJCE",quality:2,rewardId:"cash-loot"}};
Engine.move(cashout,lootCell);
const cashed=Engine.cashOut(cashout);
assert(cashed.ok&&cashout.status==="cashed_out","Black Cat should be able to cash out after collecting loot");
assert.strictEqual(cashout.finalLoot.length,1);

const invalid=Engine.createSession({rng:()=>0.82,economyEnabled:false});
assert(!Engine.move(invalid,invalid.startIndex).ok,"a visited cell must not be enterable twice");
assert(Engine.litIndices(invalid).length>1,"the token light should illuminate neighboring cells");

console.log("Black Cat Heist regression: OK");
