"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

class ClassList{
  constructor(initial=[]){this.set=new Set(initial)}
  contains(v){return this.set.has(v)} add(...v){v.forEach(x=>this.set.add(x))}
  remove(...v){v.forEach(x=>this.set.delete(x))}
  toggle(v,force){if(force===true){this.set.add(v);return true}if(force===false){this.set.delete(v);return false}if(this.set.has(v)){this.set.delete(v);return false}this.set.add(v);return true}
}
class El{
  constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.value="";this.textContent="";this.title="";this.classList=new ClassList();this.style={setProperty:(k,v)=>this.style[k]=v};this.listeners={};this.options=[];this.offsetWidth=10;}
  addEventListener(t,f){this.listeners[t]=f} getBoundingClientRect(){return {width:100,height:40}}
  getAttribute(){return null}
}

// TIMER: Bounty presentation and open graveyard must stop elapsed time without resetting it.
const ids={};
for(const id of ["turnTimerSeconds","draftTurnTimer","draftTurnHud","draftTurnTimerBonus","draftTurnTimerValue","draftTurnTimerStatus","draftTurnTimerPause","draftTurnTimerPlay","pack"]) ids[id]=new El(id);
ids.turnTimerSeconds.options=[0,60].map(value=>({value:String(value)})); ids.turnTimerSeconds.value="60";
const body={classList:new ClassList(["draft-active"])};
const timerDocument={readyState:"complete",body,getElementById:id=>ids[id]||null,querySelectorAll:()=>[],addEventListener:()=>{}};
let now=100000, tick=null, bounty=false, grave=false;
const timerCtx={console,document:timerDocument,Date:{now:()=>now},setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{},setTimeout:fn=>{fn();return 1},clearTimeout:()=>{},getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1"}),draftFinished:false,pickOrder:[0,1],currentPickIndex:0,packStartIndex:0,packIsOpen:true,packOpeningInProgress:false,packEnding:false,GalacticCurrent:{getState:()=>({active:false})},SuperpowerUI:{isBusy:()=>false},JokerV2UI:{isBusy:()=>false},DraftFoundation:{hasOpenTransaction:()=>false},BountyEngine:{hasPendingPresentations:()=>bounty},GraveyardUI:{isOpen:()=>grave}};
timerCtx.window=timerCtx;
vm.createContext(timerCtx); vm.runInContext(read("draft-turn-timer.js"),timerCtx);
tick(); const full=timerCtx.DraftTurnTimer.getState().remainingMs;
now+=3000; tick(); const running=timerCtx.DraftTurnTimer.getState().remainingMs; assert.equal(running,full-3000);
bounty=true; now+=9000; tick(); assert.equal(timerCtx.DraftTurnTimer.getState().remainingMs,running,"Bounty presentation pauses Timer");
bounty=false; grave=true; now+=7000; tick(); assert.equal(timerCtx.DraftTurnTimer.getState().remainingMs,running,"Open Graveyard pauses Timer");
grave=false; now+=1000; tick(); assert.equal(timerCtx.DraftTurnTimer.getState().remainingMs,running-1000,"Timer resumes without reset");

const timerCss=read("draft-turn-timer.css");
assert.match(timerCss,/FINAL NATURAL TIMER LAYOUT/,
  "Timer HUD extends the normal WYBIERA slot instead of floating over the viewport");
assert.match(timerCss,/body\.draft-turn-timer-enabled\.draft-active #draftTurnHud\{[\s\S]*?position:relative;[\s\S]*?top:auto;[\s\S]*?bottom:auto;/,
  "Timer HUD remains in normal document flow");

// CEREBRO: lifecycle blockers + no double synthetic click + Mysterio public-information scoring.
const cerebroSource=read("cerebro-autopilot.js");
assert.doesNotMatch(cerebroSource,/button\.click\(\);\s*button\.click\(\);/,
  "Cerebro never sends two synthetic clicks for one normal pick");
assert.equal((cerebroSource.match(/button\.click\(\);/g)||[]).length,1,
  "Cerebro has exactly one synthetic normal-card click site");
assert.equal((cerebroSource.match(/markFailedAndRetry\(chosen,expectedTurnKey,"pick_not_committed"\);/g)||[]).length,1,
  "A failed Cerebro normal pick schedules exactly one retry");
assert.match(cerebroSource,/if\(getDraftFinished\(\)\)\{\s*clearPendingPick\(\);\s*return;/,
  "Cerebro terminates scheduling after draft finish");

let modalVisible=false, cBounty=false, tx=false, cGrave=false, draftFinished=false;
const fakeModal=new El("modal"); fakeModal.getAttribute=name=>name==="aria-hidden"?"false":null;
const cerebroDocument={
  readyState:"complete",body:{classList:new ClassList()},
  getElementById:()=>null,
  querySelectorAll:selector=>modalVisible&&selector==='[aria-modal="true"]'?[fakeModal]:[],
  querySelector:()=>null,
  addEventListener:()=>{}
};
const cctx={console,document:cerebroDocument,Event:function(){},setTimeout:()=>1,clearTimeout:()=>{},getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1"}),players:["A"],decks:[[]],currentPack:[{name:"SECRET",cost:6,power:20,instanceId:"secret"},{name:"PUBLIC",cost:2,power:3,instanceId:"public"}],currentPickIndex:0,packStartIndex:0,pickOrder:[0],packIsOpen:true,packOpeningInProgress:false,packEnding:false,getCurrentPlayerIndex:()=>0,DraftFoundation:{hasOpenTransaction:()=>tx},BountyEngine:{hasPendingPresentations:()=>cBounty},GraveyardUI:{isOpen:()=>cGrave},SuperpowerUI:{isBusy:()=>false,isDraftMutationLocked:()=>false},JokerV2UI:{isBusy:()=>false},GalacticCurrent:{getState:()=>({active:false})},MysterioUI:{getPublicCardSnapshot:card=>card.instanceId==="secret"?{name:"DECOY",cost:1,power:1,instanceId:card.instanceId,isMysterioIllusion:true}:card}};
Object.defineProperty(cctx,"draftFinished",{get:()=>draftFinished,set:v=>{draftFinished=Boolean(v)},configurable:true});
cctx.window=cctx;
vm.createContext(cctx); vm.runInContext(cerebroSource,cctx,{filename:"cerebro-autopilot.js"});
const C=cctx.CerebroAutopilot;
assert.ok(C);
cBounty=true; assert.equal(C._test.getBusyReason(0),"bounty_presentation"); cBounty=false;
tx=true; assert.equal(C._test.getBusyReason(0),"draft_transaction"); tx=false;
cGrave=true; assert.equal(C._test.getBusyReason(0),"graveyard_open"); cGrave=false;
modalVisible=true; assert.equal(C._test.getBusyReason(0),"modal_open"); modalVisible=false;
draftFinished=true; assert.equal(C._test.getBusyReason(0),"draft_finished"); draftFinished=false;
const ranked=C.rankCurrentPack(0);
const illusion=ranked.find(entry=>entry.card.instanceId==="secret");
assert.equal(illusion.publicCard.name,"DECOY","Cerebro scores Mysterio illusion using only the public decoy snapshot");
assert.notEqual(illusion.publicCard.name,illusion.card.name,"real card identity stays separate from scoring identity");

console.log("PASS Timer + Cerebro System Stability");
