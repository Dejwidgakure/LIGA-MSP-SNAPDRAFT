const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=__dirname;
const collector=fs.readFileSync(path.join(ROOT,'superpowers-collector.js'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'superpowers-data.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'snap-draft.html'),'utf8');
const ui=fs.readFileSync(path.join(ROOT,'superpowers-ui.js'),'utf8');

assert.strictEqual((data.match(/id:\s*["']collector["']/g)||[]).length,1,'Collector must be registered exactly once');
assert.match(data,/finalSwapLimit:\s*8/,'Collector registry must expose the 8-swap cap');
assert.match(collector,/const MAX_FINAL_SWAPS=8/,'runtime must enforce the 8-swap cap');
assert.match(collector,/collectionLimit:\s*null|collection\.length/,'Collection must not be globally capped by a small fixed capacity');
assert.match(html,/capturePackRemainder\?\.\(card/,'pack remainder cleanup must ask Collector before Graveyard');
assert.match(html,/if\(!collectorCapture\?\.captured\)\{\s*window\.DraftStateEngine\.addToGraveyard\("unpicked"/s,'captured leftovers must skip the unpicked Graveyard path');
assert.match(html,/captureJokerRejection\?\.\(rejectedCard/,'normal rejected Joker options must have a Collector interception hook');
assert.match(collector,/if\(context\.powerId\) return false/,'Joker options created by Superpowers/effects must not be vacuumed into Collection');
assert.match(html,/beginFinalization\?\.\(\(\)=>continuePendingDraftFinish\(\)\)[\s\S]*showDraftFinishedScene\(\{prepared:true\}\)/,'Collector finalization must happen before draft_finished is emitted');
assert.match(collector,/state\.swapsUsed>=MAX_FINAL_SWAPS/,'ninth final swap must be blocked');
assert.match(collector,/sourceZone:"collector_collection"/,'unresolved Collection Jokers must resolve from the Collection zone');
assert.match(collector,/archivePendingJokerRejections\(incoming,[\s\S]*powerId:POWER_ID/s,'rejected results from a final Collection Joker must follow normal Graveyard resolution instead of re-entering Collection');
assert.doesNotMatch(collector,/PRZYWRÓĆ UKŁAD/,'final curation must not provide a free reset that bypasses the 8-swap cap or reopens resolved Jokers');
assert.match(collector,/backfillFirstPackJokerRejections/,'Collector activation must backfill eligible first-pack Joker rejects created before his first turn');
assert.match(collector,/consumeGraveyardEntry\(entry\.graveyardEntryId/,'first-pack backfill must remove eligible Joker rejects from the available Graveyard pool');
assert.match(collector,/bountyRoundOverlay/,'Collector activation must wait for the opening Bounty presentation instead of covering it');
assert.match(ui,/CollectorUI\?\.isBusy\?\.\(\)/,'central Superpower busy state must include Collector overlays');

// Lightweight runtime contract: natural leftovers are captured; unrelated discards are not.
const documentStub={
  body:{},
  getElementById(){return null;},
  querySelector(){return null;},
  querySelectorAll(){return [];},
  createElement(){return {classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},appendChild(){},append(){},addEventListener(){},setAttribute(){},querySelector(){return null;},querySelectorAll(){return []}};}
};
const players=['Tivan'];
const decks=[[...Array(12)].map((_,i)=>({name:`Deck ${i}`,cost:i%7,power:i+1,instanceId:`d${i}`}))];
const logs=[];
const context={
  window:null,document:documentStub,console,
  setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),
  matchMedia:()=>({matches:true}),Date,Map,Promise,
  players,decks,draftSuperpowers:{Tivan:{powerId:'collector',used:true,status:'used'}},superpowerLog:[],
  DraftStateEngine:{log:(event,payload)=>logs.push({event,payload})},
  SuperpowerFeedback:{event(){},warning(){},error(){}},
  getSuperpowerRuntimeAssignment:name=>name==='Tivan'?{powerId:'collector',used:true}:null
};
context.window=context;
vm.createContext(context);
vm.runInContext(collector,context,{filename:'superpowers-collector.js'});
context.CollectorUI.configure({
  getPlayers:()=>players,
  getDecks:()=>decks,
  getAssignment:name=>name==='Tivan'?{powerId:'collector',used:true}:null,
  getPackNumber:()=>2,
  getPickIndex:()=>4,
  getCurrentPlayerIndex:()=>0,
  refreshInspectors:()=>{}
});
context.CollectorUI.restoreState({collectors:[["Tivan",{
  playerName:'Tivan',playerIndex:0,activated:true,activationPrompted:true,collection:[],entrySequence:0,finalized:false,swapsUsed:0,capturedCount:0
}]]});
const leftover={name:'Venom',cost:3,power:3,instanceId:'pack-venom'};
assert.strictEqual(context.CollectorUI.capturePackRemainder(leftover,{packNumber:2,packId:'pack-2',packIndex:0}).captured,true);
assert.strictEqual(context.CollectorUI.getStatus('Tivan').collectionSize,1);
const effectReject={name:'Effect Reject',cost:2,power:2,instanceId:'effect-r'};
assert.strictEqual(context.CollectorUI.captureJokerRejection(effectReject,{powerId:'gambit',resolutionPath:'effect'}).captured,false);
assert.strictEqual(context.CollectorUI.getStatus('Tivan').collectionSize,1);
const packReject={name:'Pack Reject',cost:4,power:5,instanceId:'pack-r'};
assert.strictEqual(context.CollectorUI.captureJokerRejection(packReject,{resolutionPath:'joker_v2_pack_pick',source:'surprise_joker_rejected',packNumber:2}).captured,true);
assert.strictEqual(context.CollectorUI.getStatus('Tivan').collectionSize,2);
const snapshot=context.CollectorUI.exportState();
context.CollectorUI.restoreState(snapshot);
assert.strictEqual(context.CollectorUI.getStatus('Tivan').collectionSize,2,'Collection must survive snapshot/restore');

console.log('COLLECTOR_V1_REGRESSION_OK',JSON.stringify({assertions:23,collectionSize:2,logs:logs.length,maxFinalSwaps:context.CollectorUI.MAX_FINAL_SWAPS}));

// Dynamic final-curation contract: 12-card invariant, eight-swap cap and committed Joker resolution.
class FakeClassList{
  constructor(){this.values=new Set();}
  add(...names){names.forEach(n=>this.values.add(n));}
  remove(...names){names.forEach(n=>this.values.delete(n));}
  toggle(name,force){if(force===undefined){if(this.values.has(name)){this.values.delete(name);return false;}this.values.add(name);return true;}if(force)this.values.add(name);else this.values.delete(name);return Boolean(force);}
  contains(name){return this.values.has(name);}
}
class FakeElement{
  constructor(id=''){this.id=id;this.hidden=false;this.innerHTML='';this.textContent='';this.dataset={};this.children=[];this.listeners={};this.classList=new FakeClassList();this.style={setProperty(){}};this.draggable=false;}
  appendChild(node){this.children.push(node);return node;}
  append(...nodes){nodes.forEach(n=>this.appendChild(n));}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(){}
  remove(){}
  querySelector(){return null;}
  querySelectorAll(){return [];}
}
function makeCollectorDom(){
  const ids={};
  const make=id=>(ids[id]=new FakeElement(id));
  const overlay=make('spxCollectorOverlay');
  const kicker=make('spxCollectorKicker');
  const title=make('spxCollectorTitle');
  const lead=make('spxCollectorLead');
  const body=make('spxCollectorBody');
  const actions=make('spxCollectorActions');
  const close=make('spxCollectorClose');
  const deckRoot=make('spxCollectorFinalDeck');
  const collectionRoot=make('spxCollectorFinalCollection');
  const hint=make('spxCollectorFinalHint');
  const summary=new FakeElement('summary');
  overlay.querySelector=selector=>({
    '#spxCollectorKicker':kicker,'#spxCollectorTitle':title,'#spxCollectorLead':lead,
    '#spxCollectorBody':body,'#spxCollectorActions':actions,'#spxCollectorClose':close
  })[selector]||null;
  const document={
    body:new FakeElement('body'),
    getElementById:id=>ids[id]||null,
    querySelector:selector=>selector==='.spx-collector-final-summary strong'?summary:null,
    querySelectorAll:()=>[],
    createElement:()=>new FakeElement()
  };
  return {document,ids,summary};
}
async function runFinalizationRuntimeContract(){
  const dom=makeCollectorDom();
  const runtimePlayers=['Tivan'];
  const runtimeDeck=[[...Array(12)].map((_,i)=>({name:`Deck ${i}`,cost:i%7,power:i+1,instanceId:`fd${i}`}))];
  let archivedRejects=0;
  let jokerResolutions=0;
  const runtime={
    window:null,document:dom.document,console,Date,Map,Promise,
    setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},requestAnimationFrame:fn=>fn(),
    matchMedia:()=>({matches:true}),players:runtimePlayers,decks:runtimeDeck,
    draftSuperpowers:{Tivan:{powerId:'collector',used:true,status:'used'}},superpowerLog:[],
    getSuperpowerRuntimeAssignment:name=>name==='Tivan'?{powerId:'collector',used:true}:null,
    DraftStateEngine:{log(){}},SuperpowerFeedback:{event(){},warning(){},error(){}},
    archivePendingJokerRejections(){archivedRejects++;return [];},
    JokerV2UI:{resolveForEffect(joker,opts){jokerResolutions++;opts.onResolve({name:'Joker Result',cost:2,power:9,instanceId:`resolved-${jokerResolutions}`,instanceMeta:{pendingJokerRejections:{archived:false}}});return true;}}
  };
  runtime.window=runtime;
  vm.createContext(runtime);
  vm.runInContext(collector,runtime,{filename:'superpowers-collector.js'});
  runtime.CollectorUI.configure({
    getPlayers:()=>runtimePlayers,getDecks:()=>runtimeDeck,
    getAssignment:name=>name==='Tivan'?{powerId:'collector',used:true}:null,
    getPackNumber:()=>6,getPickIndex:()=>11,getCurrentPlayerIndex:()=>0,
    refreshDecks(){},refreshInspectors(){}
  });

  const entries=[...Array(10)].map((_,i)=>({
    entryId:`e${i}`,card:{name:`Collection ${i}`,cost:(i%6)+1,power:20+i,instanceId:`fc${i}`},sourceType:'packResidue',packNumber:6
  }));
  runtime.CollectorUI.restoreState({collectors:[["Tivan",{
    playerName:'Tivan',playerIndex:0,activated:true,activationPrompted:true,collection:entries,
    entrySequence:10,finalized:false,swapsUsed:0,capturedCount:10
  }]]});
  let callbackCount=0;
  assert.strictEqual(runtime.CollectorUI.beginFinalization(()=>callbackCount++),true,'finalization must start for a non-empty Collection');
  for(let i=0;i<8;i++){
    const outcome=await runtime.CollectorUI.performSwap('Tivan',`e${i}`,i);
    assert.strictEqual(outcome.ok,true,`final swap ${i+1} should succeed`);
  }
  const ninth=await runtime.CollectorUI.performSwap('Tivan','e8',8);
  assert.strictEqual(ninth.ok,false,'ninth final swap must fail');
  assert.strictEqual(ninth.reason,'swap_limit','ninth final swap must fail because of the cap');
  assert.strictEqual(runtimeDeck[0].length,12,'curation must preserve exactly 12 Main Deck cards');
  assert.strictEqual(runtime.CollectorUI.getStatus('Tivan').swapsUsed,8,'runtime must record exactly eight swaps');
  assert.strictEqual(runtime.CollectorUI.confirmFinalization({
    // resolve the real state through the public name path below instead of forging state
  }),false,'confirmFinalization must reject a forged state');
  const overlayState=runtime.CollectorUI.getStatus('Tivan');
  // The public API intentionally takes the internal state for UI click; use the generated action callback.
  const confirmButton=dom.ids.spxCollectorActions.children.find(node=>node.textContent==='ZAMKNIJ KOLEKCJĘ');
  assert.ok(confirmButton?.listeners?.click,'finalization must expose a confirm action');
  confirmButton.listeners.click();
  assert.strictEqual(runtime.CollectorUI.getStatus('Tivan').finalized,true,'Collector must finalize after confirmation');
  assert.strictEqual(callbackCount,1,'draft finish callback must continue exactly once');
  assert.strictEqual(runtimeDeck[0].length,12,'confirmed Collector deck must remain exactly 12 cards');

  // Fresh finalization: resolving a Joker is committed even if its result is temporarily blocked by duplicate rules.
  runtimeDeck[0]=[...Array(12)].map((_,i)=>({name:i===1?'Joker Result':`Fresh ${i}`,cost:i%7,power:i+2,instanceId:`fresh${i}`}));
  runtime.CollectorUI.restoreState({collectors:[["Tivan",{
    playerName:'Tivan',playerIndex:0,activated:true,activationPrompted:true,
    collection:[{entryId:'joker-entry',card:{joker:true,id:'CJ',name:'JOKER',type:'surprise',rarity:'epic',instanceId:'cj1'},sourceType:'packResidue',packNumber:6}],
    entrySequence:1,finalized:false,swapsUsed:0,capturedCount:1
  }]]});
  assert.strictEqual(runtime.CollectorUI.beginFinalization(()=>{}),true);
  const firstTry=await runtime.CollectorUI.performSwap('Tivan','joker-entry',0);
  assert.strictEqual(firstTry.ok,false);
  assert.strictEqual(firstTry.reason,'duplicate');
  assert.strictEqual(firstTry.jokerResolved,true,'the Joker must stay resolved after a blocked transfer');
  assert.strictEqual(jokerResolutions,1,'the Joker should resolve exactly once');
  assert.strictEqual(archivedRejects,1,'rejected Surprise options must leave Collection exactly once');
  const statusAfterResolve=runtime.CollectorUI.getStatus('Tivan');
  assert.strictEqual(statusAfterResolve.collection[0].card.joker,undefined,'resolved Joker must become a real card in Collection');
  assert.strictEqual(statusAfterResolve.collection[0].card.name,'Joker Result');
  const secondTry=await runtime.CollectorUI.performSwap('Tivan','joker-entry',0);
  assert.strictEqual(secondTry.ok,false);
  assert.strictEqual(secondTry.reason,'duplicate');
  assert.strictEqual(jokerResolutions,1,'retrying a resolved Collection card must never reroll the Joker');
  assert.strictEqual(archivedRejects,1,'rejected options must not be archived twice');

  return {callbackCount,jokerResolutions,archivedRejects};
}

runFinalizationRuntimeContract().then(result=>{
  console.log('COLLECTOR_V1_FINALIZATION_RUNTIME_OK',JSON.stringify(result));
}).catch(error=>{
  console.error(error);
  process.exitCode=1;
});
