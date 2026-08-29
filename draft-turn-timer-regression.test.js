const fs=require('fs');
const vm=require('vm');
const path=require('path');

let assertions=0;
function ok(value,message){ assertions++; if(!value) throw new Error(message); }
function eq(actual,expected,message){ assertions++; if(actual!==expected) throw new Error(`${message}: expected ${expected}, got ${actual}`); }

class ClassList{
    constructor(initial=[]){this.set=new Set(initial);}
    contains(name){return this.set.has(name);}
    add(...names){names.forEach(n=>this.set.add(n));}
    remove(...names){names.forEach(n=>this.set.delete(n));}
    toggle(name,force){
        if(force===true){this.set.add(name);return true;}
        if(force===false){this.set.delete(name);return false;}
        if(this.set.has(name)){this.set.delete(name);return false;}
        this.set.add(name);return true;
    }
}
class FakeElement{
    constructor(id){
        this.id=id; this.hidden=false; this.disabled=false; this.value=''; this.textContent=''; this.title='';
        this.classList=new ClassList();
        this.style={setProperty:(k,v)=>{this.style[k]=v;}};
        this.listeners={}; this.options=[]; this.offsetWidth=10;
    }
    addEventListener(type,fn){this.listeners[type]=fn;}
    getBoundingClientRect(){return {width:100,height:100};}
}

const ids={};
for(const id of ['turnTimerSeconds','draftTurnTimer','draftTurnHud','draftTurnTimerBonus','draftTurnTimerValue','draftTurnTimerStatus','draftTurnTimerPause','draftTurnTimerPlay','pack']) ids[id]=new FakeElement(id);
ids.turnTimerSeconds.options=[0,45,60,70,75].map(value=>({value:String(value)}));
ids.turnTimerSeconds.value='70';
ids.draftTurnHud.classList.add('timer-hud-hidden');

const body={classList:new ClassList(['draft-active'])};
const document={
    readyState:'complete',
    body,
    getElementById:id=>ids[id]||null,
    querySelectorAll:()=>[],
    addEventListener:()=>{}
};

let fakeNow=100000;
let tickCallback=null;
const context={
    console,
    document,
    Date:{now:()=>fakeNow},
    setInterval:fn=>{tickCallback=fn;return 1;},
    clearInterval:()=>{},
    setTimeout:fn=>{fn();return 1;},
    clearTimeout:()=>{},
    getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),
    draftFinished:false,
    pickOrder:[0,1,0,1],
    currentPickIndex:0,
    packStartIndex:0,
    packIsOpen:true,
    packOpeningInProgress:false,
    packEnding:false,
    GalacticCurrent:{getState:()=>({active:false})},
    SuperpowerUI:{isBusy:()=>false},
    JokerV2UI:{isBusy:()=>false},
    DraftFoundation:{hasOpenTransaction:()=>false}
};
context.window=context;
vm.createContext(context);
const source=fs.readFileSync(path.join(__dirname,'draft-turn-timer.js'),'utf8');
vm.runInContext(source,context,{filename:'draft-turn-timer.js'});

ok(context.DraftTurnTimer,'Timer API should initialize');
eq(context.DraftTurnTimer.getState().baseSeconds,70,'Settings should configure 70 seconds');

tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,80000,'First pick of fresh pack gets +10 seconds');
ok(!ids.draftTurnTimer.hidden,'Timer is visible when enabled');

fakeNow+=5000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,75000,'Running timer counts elapsed time');

context.SuperpowerUI.isBusy=()=>true;
fakeNow+=12000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,75000,'Superpower flow pauses timer');
eq(context.DraftTurnTimer.getState().status,'paused','Busy flow sets paused state');

context.SuperpowerUI.isBusy=()=>false;
fakeNow+=1000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,74000,'Timer resumes with remaining time, without reset');

context.DraftTurnTimer.pause();
fakeNow+=9000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,74000,'Manual host pause freezes time');
ok(context.DraftTurnTimer.getState().manualPaused,'Manual pause state is stored');
context.DraftTurnTimer.play();
fakeNow+=2000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,72000,'Play resumes manual pause');

context.currentPickIndex=1;
fakeNow+=100; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,70000,'Second picker gets base time without opener bonus');
ok(!context.DraftTurnTimer.getState().openerBonus,'Non-opener has no bonus');

// Force countdown expiry. No Autopilot callback exists in v1 and nothing else should execute.
fakeNow+=70000; tickCallback();
eq(context.DraftTurnTimer.getState().remainingMs,0,'Timer reaches zero');
ok(context.DraftTurnTimer.getState().expired,'Timer enters expired state');
eq(ids.draftTurnTimerStatus.textContent,'CZAS MINĄŁ','Expired UI is explicit');

const saved=context.DraftTurnTimer.exportState();
context.DraftTurnTimer.configure(45,{reset:true});
context.DraftTurnTimer.restoreState(saved);
eq(context.DraftTurnTimer.getState().baseSeconds,70,'Restore keeps configured base time');
eq(context.DraftTurnTimer.getState().remainingMs,0,'Restore keeps remaining time');
ok(context.DraftTurnTimer.getState().expired,'Restore keeps expiry state');

context.DraftTurnTimer.configure(0,{reset:true});
ok(!context.DraftTurnTimer.getState().enabled,'Timer can be disabled');
ok(ids.draftTurnTimer.hidden,'Disabled timer hides timer face');

const html=fs.readFileSync(path.join(__dirname,'snap-draft.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'draft-turn-timer.css'),'utf8');
ok(html.includes('id="turnTimerSeconds"'),'Settings include timer selector');
for(const mode of ['45','60','70','75']) ok(html.includes(`<option value="${mode}">`),`Settings include ${mode}s mode`);
ok(html.includes('turnTimerState:window.DraftTurnTimer?.exportState?.()'),'Snapshot exports timer state');
ok(html.includes('window.DraftTurnTimer.restoreState(payload.turnTimerState)'),'Snapshot restores timer state');
ok(html.includes('draft-assets/cosmic_turn_timer.webp'),'HUD uses generated cosmic timer asset');
ok(css.includes('FINAL NATURAL TIMER LAYOUT'),'Timer HUD uses the natural WYBIERA layout slot');
ok(/body\.draft-turn-timer-enabled\.draft-active #draftTurnHud\{[\s\S]*?position:relative/.test(css),'Timer HUD stays in document flow instead of the viewport');
ok(!source.includes('document.body.appendChild(hud)'),'Timer never portals the WYBIERA HUD to body');
ok(!source.includes('CerebroAutopilot')&&!source.includes('enableCerebro'),'Timer v1 has no Autopilot integration');
ok(fs.existsSync(path.join(__dirname,'draft-assets','cosmic_turn_timer.webp')),'Cosmic timer asset exists');

console.log('DRAFT_TURN_TIMER_REGRESSION_OK',JSON.stringify({assertions,openerBonus:10,modes:[45,60,70,75],autopilot:false}));
