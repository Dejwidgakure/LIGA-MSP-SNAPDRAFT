"use strict";

const assert=require("node:assert/strict");
require("./superpowers-blackcat-v7.js");
const E=global.BlackCatHeistEngine;

function mulberry32(seed){
    return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
function neighbors(index,rows=5,cols=7){
    const row=Math.floor(index/cols),col=index%cols,result=[];
    if(row>0)result.push(index-cols);if(row<rows-1)result.push(index+cols);if(col>0)result.push(index-1);if(col<cols-1)result.push(index+1);return result;
}
function pathAcrossVisited(session,targetPredicate){
    const queue=[[session.currentIndex]],seen=new Set([session.currentIndex]);
    while(queue.length){
        const path=queue.shift(),last=path[path.length-1];
        if(targetPredicate(last)) return path;
        for(const next of neighbors(last,session.rows,session.cols)){
            if(seen.has(next)||(!session.visited.has(next)&&!targetPredicate(next)))continue;
            seen.add(next);queue.push([...path,next]);
        }
    }
    return null;
}
function chooseMove(session,rng){
    const adjacent=neighbors(session.currentIndex,session.rows,session.cols);
    const visiblePrize=adjacent.filter(i=>session.revealed.has(i)&&!session.visited.has(i)&&["reward","exhibit"].includes(session.cells[i].kind));
    if(visiblePrize.length)return visiblePrize[Math.floor(rng()*visiblePrize.length)];
    const fresh=adjacent.filter(i=>!session.visited.has(i));
    if(fresh.length)return fresh[Math.floor(rng()*fresh.length)];
    const route=pathAcrossVisited(session,index=>neighbors(index,session.rows,session.cols).some(next=>!session.visited.has(next)));
    if(route?.length>1)return route[1];
    return adjacent[0];
}

for(let seed=1;seed<=300;seed++){
    const session=E.createSession({economyEnabled:true,rng:mulberry32(seed)});
    assert.equal(session.cells.length,35);
    assert.equal(session.cells.filter(cell=>cell.kind==="exhibit").length,1);
    assert.equal(session.cells.filter(cell=>cell.kind==="reward").length,12);
    assert.equal(session.cells.filter(cell=>cell.kind==="laser").length,7);
    assert.equal(session.cells.filter(cell=>cell.kind==="empty").length,15);
    assert.equal(session.cells[session.startIndex].kind,"empty");
    assert.equal(session.cells.filter(cell=>cell.reward?.type==="gem").length,4);
    const gemTypes=session.cells.filter(cell=>cell.reward?.type==="gem").map(cell=>cell.reward.gemType);
    assert.equal(new Set(gemTypes).size,gemTypes.length,"every gem found during one heist should have a distinct type");
    assert.equal(session.cells.filter(cell=>cell.reward?.type==="coin_1").length,5);
    assert.equal(session.cells.filter(cell=>cell.reward?.type==="coin_2").length,2);
    assert.equal(session.cells.filter(cell=>cell.reward?.type==="safe_key").length,1);
    assert.ok(session.safePath.filter(index=>session.cells[index].kind==="laser").length<=1);
    assert.equal(session.revealed.size,0,"the heist must start without revealing a route");
    assert.equal(session.scouted.size,0,"the heist must start without revealing loot contents");
}

{
    const session=E.createSession({economyEnabled:true,rng:mulberry32(31337)});
    const expectedLanternIndices=[];
    const startRow=Math.floor(session.currentIndex/session.cols),startCol=session.currentIndex%session.cols;
    for(let row=Math.max(0,startRow-1);row<=Math.min(session.rows-1,startRow+1);row++){
        for(let col=Math.max(0,startCol-1);col<=Math.min(session.cols-1,startCol+1);col++){
            if(row!==startRow||col!==startCol) expectedLanternIndices.push(row*session.cols+col);
        }
    }
    const lantern=E.useLantern(session);
    assert.equal(lantern.ok,true,"the one-use Cat Lantern should activate at the start");
    assert.equal(session.lanternAvailable,false,"the Cat Lantern must be one-use");
    assert.deepEqual([...lantern.indices].sort((a,b)=>a-b),expectedLanternIndices.sort((a,b)=>a-b),"the lantern should scan all eight adjacent directions within the board");
    assert.deepEqual([...session.revealed].sort((a,b)=>a-b),expectedLanternIndices,"the lantern should permanently mark only its adjacent scan");
    assert.ok([...session.scouted].every(index=>["reward","exhibit"].includes(session.cells[index].kind)),"the lantern should reveal only prizes and the main exhibit");
    assert.ok([...session.scouted].every(index=>session.cells[index].kind!=="laser"),"the lantern must never reveal a laser");
    assert.equal(E.useLantern(session).ok,false,"the Cat Lantern cannot be used twice");
}

{
    const session=E.createSession({economyEnabled:true,rng:mulberry32(909)});
    const startMoves=session.movesRemaining;
    const neighbor=neighbors(session.startIndex).find(i=>session.cells[i].kind!=="laser"&&session.cells[i].kind!=="exhibit");
    E.move(session,neighbor);
    const afterFresh=session.movesRemaining;
    assert.equal(session.revealed.size,0,"an ordinary move must not permanently light unvisited neighboring tiles");
    E.move(session,session.startIndex);
    assert.equal(afterFresh,startMoves-1);
    assert.equal(session.movesRemaining,afterFresh,"powrót po odwiedzonym polu nie zużywa ruchu");
}

{
    const session=E.createSession({economyEnabled:true,rng:mulberry32(77)});
    const lasers=session.cells.filter(cell=>cell.kind==="laser").map(cell=>cell.index);
    session.collected=[{rewardId:"proof",type:"gem",label:"TEST"}];
    for(const laser of lasers.slice(0,2)){
        const entry=neighbors(laser).find(index=>index!==laser);
        session.currentIndex=entry;session.visited.add(entry);
        const result=E.move(session,laser);
        if(session.laserHits===1){assert.equal(result.luckyEscape,true);assert.equal(session.status,"active");assert.equal(session.collected.length,1);}
        else{assert.equal(result.caught,true);assert.equal(session.status,"caught");assert.equal(session.finalLoot.length,1);}
    }
}

{
    const session=E.createSession({economyEnabled:true,rng:mulberry32(781)});
    const laser=session.startIndex-session.cols;
    session.cells[laser]={...session.cells[laser],kind:"laser",reward:null,collected:false};
    const hit=E.move(session,laser);
    assert.equal(hit.luckyEscape,true,"the first laser should still trigger the automatic Cat reflex");
    assert.equal(E.move(session,session.startIndex).ok,true,"Black Cat may retreat to the safe tile she came from");
    assert.equal(E.isReachable(session,laser),false,"a discovered laser must become a blocked tile");
    assert.equal(E.snapshot(session).reachableIndices.includes(laser),false,"the UI must not render SKOK on a discovered laser");
    assert.equal(E.move(session,laser).ok,false,"Black Cat must not be able to step onto the same laser again");
}

const totals={coins:0,gems:0,main:0,runs:12000,loot:0,caught:0};
for(let seed=1000;seed<1000+totals.runs;seed++){
    const rng=mulberry32(seed),session=E.createSession({economyEnabled:true,rng});
    E.useLantern(session);
    let guard=200;
    while(session.status==="active"&&guard-->0) E.move(session,chooseMove(session,rng));
    const loot=session.finalLoot.length?session.finalLoot:session.collected;
    totals.coins+=loot.reduce((sum,item)=>sum+(item.type==="coin_1"?1:item.type==="coin_2"?2:item.type==="safe_key"?1:0),0);
    totals.gems+=loot.filter(item=>item.type==="gem").length;
    totals.loot+=loot.length;
    if(session.status==="success")totals.main+=1;
    if(session.status==="caught")totals.caught+=1;
}
const stats={
    averageCoins:totals.coins/totals.runs,
    averageGems:totals.gems/totals.runs,
    averageSideLoot:totals.loot/totals.runs,
    mainRate:totals.main/totals.runs,
    caughtRate:totals.caught/totals.runs
};
console.log(JSON.stringify(stats,null,2));
assert.ok(stats.averageGems>=.65&&stats.averageGems<=1.45,"średnia klejnotów poza celem");
assert.ok(stats.averageCoins>=2.0&&stats.averageCoins<=3.4,"średnia JC poza celem");
assert.ok(stats.mainRate>=.08&&stats.mainRate<=.22,"częstotliwość głównego eksponatu poza celem");
console.log("Black Cat canonical regression: OK");
