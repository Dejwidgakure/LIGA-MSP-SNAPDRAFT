const fs=require("fs");
const vm=require("vm");
const assert=require("assert");

const bridge={decks:[[]],cardDatabase:[],bannedCards:[],modes:{}};
const context={
    console,
    Date,
    Math,
    JSON,
    Set,
    Map,
    CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
    dispatchEvent(){},
    EconomyEngine:{isEnabled:()=>true,credit:()=>({ok:true})},
    DraftQuestBridge:{getContext:()=>bridge}
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+"/draft-quests-registry.js","utf8"),context);
vm.runInContext(fs.readFileSync(__dirname+"/draft-quests-engine.js","utf8"),context);

const engine=context.DraftQuestEngine;
const registry=context.DraftQuestRegistry;
const auditedCodes=new Set();

function definition(code){
    const value=registry.quests.find(item=>item.code===code);
    assert(value,`missing ${code}`);
    return value;
}

function restoreQuest(code,overrides={}){
    auditedCodes.add(code);
    const def=definition(code);
    const window=registry.windows[def.window];
    const target=def.progress?.target||3;
    const quest={
        runtimeId:`test-${code}`,
        code:def.code,
        id:def.id,
        name:def.name,
        family:def.family,
        tier:def.tier,
        rewardJC:def.rewardJC,
        evaluation:def.evaluation,
        evaluator:def.evaluator,
        window:def.window,
        parameters:{},
        text:def.name,
        status:"active",
        assignedAtNormalPick:0,
        endsAtNormalPick:Number(window.count||window.normalPickCap||12),
        progress:{current:0,target,meta:{}},
        history:[],
        rewardGranted:false,
        slotIndex:0,
        ...overrides
    };
    engine.restoreState({
        started:true,
        enabled:true,
        initialized:true,
        players:["Tester"],
        playerStates:[{
            playerIndex:0,
            playerName:"Tester",
            normalPicksCompleted:0,
            rerollsRemainingBySlot:[1,1,1],
            quests:[quest],
            completed:0,
            failed:0,
            jeffCoinsEarned:0
        }],
        questSequence:1,
        eventSequence:0,
        eventLog:[]
    });
    return quest.runtimeId;
}

function pick(card,extra={}){
    return engine.onNormalPickCompleted({playerIndex:0,resultCard:{instanceId:`pick-${Math.random()}`,name:"Test",cost:1,power:1,tags:[],...card},...extra});
}

function quest(){return engine.getPlayerState(0).quests[0];}

restoreQuest("Q015",{parameters:{forbiddenCostAtLeast:5},progress:{current:0,target:3,meta:{}}});
pick({cost:1});
assert.equal(quest().status,"active","avoid-cost quest must stay active after one safe pick");
pick({cost:4});
assert.equal(quest().status,"active","avoid-cost quest must stay active after two safe picks");
pick({cost:2});
assert.equal(quest().status,"completed","avoid-cost quest completes only after the full three-pick window");

restoreQuest("Q015",{parameters:{forbiddenCostAtLeast:5},progress:{current:0,target:3,meta:{}}});
pick({cost:2});
pick({cost:5});
assert.equal(quest().status,"failed","avoid-cost quest fails immediately when the condition is broken");

restoreQuest("Q005",{parameters:{targetTag:"on_reveal"},progress:{current:0,target:3,meta:{}}});
pick({tags:[]});
pick({tags:[]});
assert.equal(quest().status,"active","avoid-tag quest also waits for its full window");
pick({tags:[]});
assert.equal(quest().status,"completed");

restoreQuest("Q012",{parameters:{direction:"ascending"},progress:{current:0,target:3,meta:{}}});
pick({cost:1});
pick({cost:3});
assert.equal(quest().status,"active","ordered sequence cannot complete before its third pick");
pick({cost:4});
assert.equal(quest().status,"completed");

restoreQuest("Q012",{parameters:{direction:"ascending"},progress:{current:0,target:3,meta:{}}});
pick({cost:2});
pick({cost:2});
assert.equal(quest().status,"failed","ordered sequence fails on equality");

restoreQuest("Q010",{parameters:{targetAveragePower:5},progress:{current:0,target:5,meta:{}}});
pick({power:9});
assert.equal(quest().status,"active","running average never resolves after one pick");
pick({power:1});
assert.equal(quest().status,"active","running average never resolves after two picks");
pick({power:5});
assert.equal(quest().status,"completed","running average resolves at window end");

restoreQuest("Q008",{parameters:{requiredMatchingCards:2},progress:{current:0,target:2,meta:{}}});
pick({cost:3});
pick({cost:3});
assert.equal(quest().status,"completed","an irreversible matching pair may complete early");

restoreQuest("Q001",{parameters:{targetTag:"on_reveal"},progress:{current:0,target:1,meta:{}}});
pick({tags:[]});
assert.equal(quest().status,"active");
pick({tags:[]});
assert.equal(quest().status,"failed","hit quest fails when its two-pick window expires");

restoreQuest("Q002",{parameters:{targetCost:"3"},progress:{current:0,target:1,meta:{}}});
pick({cost:3});
assert.equal(quest().status,"completed","cost target resolves on a matching bucket");

restoreQuest("Q003",{parameters:{targetPower:8},progress:{current:0,target:1,meta:{}}});
pick({power:7});
assert.equal(quest().status,"active");
pick({power:8});
assert.equal(quest().status,"completed","power threshold resolves inside its hit window");

restoreQuest("Q004",{parameters:{},progress:{current:0,target:1,meta:{}}});
pick({instanceId:"edge-card"},{pickedPackCardInstanceId:"edge-card",packSnapshotBeforePick:[{instanceId:"edge-card"},{instanceId:"middle-card"},{instanceId:"other-edge"}]});
assert.equal(quest().status,"completed","pack-edge quest reads the pre-pick pack snapshot");

restoreQuest("Q006",{parameters:{requiredBuckets:4},endsAtNormalPick:6,progress:{current:0,target:4,meta:{}}});
bridge.decks[0]=[{cost:0},{cost:2},{cost:3},{cost:4}];
for(let index=0;index<5;index++) pick({cost:index%2});
assert.equal(quest().status,"active","checkpoint quest waits until its checkpoint even when already satisfied");
pick({cost:1});
assert.equal(quest().status,"completed");

restoreQuest("Q007",{parameters:{targetTag:"destroy",requiredCards:3},endsAtNormalPick:6,progress:{current:0,target:3,meta:{}}});
bridge.decks[0]=[{tags:["destroy"]},{tags:["destroy"]},{tags:["destroy"]}];
for(let index=0;index<6;index++) pick({cost:1});
assert.equal(quest().status,"completed","deck archetype checkpoint is evaluated at pick six");

restoreQuest("Q009",{parameters:{minCostGap:3},progress:{current:0,target:3,meta:{}}});
pick({cost:1});
assert.equal(quest().status,"active");
pick({cost:4});
assert.equal(quest().status,"completed","two-pick cost gap resolves exactly at the second pick");

restoreQuest("Q011",{parameters:{requiredMatchingCards:2},progress:{current:0,target:2,meta:{}}});
pick({power:6});
pick({power:6});
assert.equal(quest().status,"completed","same-power pair is detected");

restoreQuest("Q013",{parameters:{requiredDistinctCosts:3},progress:{current:0,target:3,meta:{}}});
pick({cost:1});
pick({cost:2});
assert.equal(quest().status,"active");
pick({cost:3});
assert.equal(quest().status,"completed","three distinct costs require all three picks");

restoreQuest("Q014",{parameters:{bands:[{id:"low",min:0,max:2},{id:"mid",min:3,max:4},{id:"high",min:5,max:null}]},progress:{current:0,target:3,meta:{}}});
pick({cost:2});
pick({cost:4});
assert.equal(quest().status,"active");
pick({cost:5});
assert.equal(quest().status,"completed","low/mid/high coverage resolves only after the full spectrum");

assert.deepEqual([...auditedCodes].sort(),registry.quests.map(item=>item.code).sort(),"every registry quest family has an executable regression scenario");

console.log("Draft Quest window regression OK");
