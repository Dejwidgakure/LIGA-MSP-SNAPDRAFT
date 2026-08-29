"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const modulePath=path.join(__dirname,"superpowers-mysterio.js");
let source=fs.readFileSync(modulePath,"utf8");
// Test-only exposure: production API intentionally keeps peek behind its UI control.
source=source.replace("        getStatus,\n        isIllusionCard,","        getStatus,\n        peek,\n        isIllusionCard,");
assert.match(source,/\n\s*peek,\n\s*isIllusionCard,/,"test-only peek exposure failed");

class FakeNode{
    constructor(){
        this.dataset={};
        this.hidden=false;
        this.innerHTML="";
        this.title="";
        this.children=[];
        this.classList={
            add(){},remove(){},toggle(){},contains(){return false;}
        };
    }
    setAttribute(){}
    removeAttribute(){}
    appendChild(child){this.children.push(child);return child;}
    append(...children){this.children.push(...children);}
    remove(){}
    querySelector(){return null;}
    querySelectorAll(){return [];}
}

const body=new FakeNode();
const document={
    body,
    createElement(){return new FakeNode();},
    getElementById(){return null;},
    querySelector(){return null;},
    querySelectorAll(){return [];}
};

const card={instanceId:"card-pattern",name:"Loki",cost:2,power:2};
const effect={
    effectId:"fx-pattern",
    type:"mysterio_illusion",
    status:"active",
    targetCardInstanceId:card.instanceId,
    data:{illusionNumber:1,decoyCard:{name:"Loki",cost:2,power:2},decoySourceInstanceId:card.instanceId}
};

const window={
    document,
    console,
    Date,
    Math,
    JSON,
    Promise,
    structuredClone:global.structuredClone,
    setTimeout,
    clearTimeout,
    requestAnimationFrame:fn=>setTimeout(fn,0),
    alert(){},
    DraftStateEngine:{
        getPackEffects(packId,query){
            return packId==="pack-1" && (!query?.type || query.type==="mysterio_illusion") ? [effect] : [];
        },
        updatePackEffect(){return true;},
        removePackEffect(){return true;}
    }
};
window.window=window;

const context=vm.createContext({window,document,console,Date,Math,JSON,Promise,structuredClone:global.structuredClone,setTimeout,clearTimeout});
vm.runInContext(source,context,{filename:"superpowers-mysterio.js"});
const M=context.window.MysterioUI;
assert.ok(M,"MysterioUI should initialize");

M.configure({
    getCurrentPack:()=>[card],
    getCurrentPackId:()=>"pack-1",
    getCurrentPlayerIndex:()=>0,
    getCurrentPickIndex:()=>0,
    isPackOpen:()=>true,
    refreshPack(){},
    getPlayers:()=>["Mysterio"],
    getAssignment:()=>({powerId:"mysterio",used:false})
});
M.restoreState({
    active:true,
    ownerName:"Mysterio",
    ownerIndex:0,
    sourcePackId:"pack-1",
    sourcePackNumber:1,
    activatedAtPickIndex:0,
    illusionCount:1,
    sharedDecoyCard:{name:"Loki",cost:2,power:2},
    sharedDecoySourceInstanceId:card.instanceId,
    ownerPicksCompleted:0,
    peekTurnKey:null,
    peeksRemaining:0,
    reflectionLootUsed:false
});
M.onTurnChanged();
assert.equal(M.getStatus().peeksRemaining,4,"owner should receive shared pool of four peeks");

const started=Date.now();
assert.equal(M.peek(effect.effectId),true,"peek should start");
assert.ok(M.getStatus().currentPeek,"peek must be active immediately");
assert.equal(M.getStatus().peeksRemaining,3,"one shared peek should be consumed");

setTimeout(()=>{
    const elapsed=Date.now()-started;
    assert.ok(M.getStatus().currentPeek,`peek closed too early at ${elapsed}ms`);
},5000);

setTimeout(()=>{
    const elapsed=Date.now()-started;
    assert.equal(M.getStatus().currentPeek,null,`peek should be closed after the 5.5s window (${elapsed}ms)`);
    assert.ok(elapsed>=5500,`peek expiry fired before 5500ms (${elapsed}ms)`);
    console.log(`MYSTERIO_PEEK_TIMING_OK {\"requestedMs\":5500,\"observedCloseCheckMs\":${elapsed}}`);
},5850);
