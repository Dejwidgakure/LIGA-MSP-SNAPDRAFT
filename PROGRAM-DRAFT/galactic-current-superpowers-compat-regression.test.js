const fs=require("fs");
const vm=require("vm");
const path=require("path");
const root=__dirname;
function assert(ok,msg){if(!ok) throw new Error(msg);}
const gc=fs.readFileSync(path.join(root,"galactic-current.js"),"utf8");
const html=fs.readFileSync(path.join(root,"snap-draft.html"),"utf8");
const settings=fs.readFileSync(path.join(root,"settings-v2.js"),"utf8");
const bridgeSource=fs.readFileSync(path.join(root,"superpowers-galactic-current-bridge.js"),"utf8");
const tradeRuntime=fs.readFileSync(path.join(root,"trade-market-runtime.js"),"utf8");

assert(!/INCOMPATIBLE_IDS[\s\S]{0,220}"enableSuperpowers"/.test(gc),"Gwiezdny Prąd nadal globalnie wyłącza Supermoce.");
assert(/superpowersEnabled:Boolean\(document\.getElementById\("enableSuperpowers"\)/.test(gc),"DraftStateEngine nie dostaje stanu Supermocy w Prądzie.");
assert(/window\.GalacticCurrent\.start\(\)/.test(html),"Wspólny startDraftFlow nie przekazuje finalnego startu do Gwiezdnego Prądu.");
assert(/GalacticCurrentSuperpowerBridge\?\.isPowerCompatible/.test(html),"Modal/aktywacja nie używa per-power compatibility.");
assert(!/Supermoce nie są jeszcze kompatybilne z Gwiezdnym Prądem/.test(settings),"Settings nadal blokuje Supermoce w Prądzie.");
assert(!/enableSuperpowers", economy:false, blocked:galacticOn/.test(settings),"Kafelek Supermocy nadal jest blokowany w Settings.");
assert(/galactic:\$\{Number\(gc\.round\)/.test(tradeRuntime),"Galaktyczny Targ nie rozróżnia obiegów Gwiezdnego Prądu w turnKey.");

const checkbox={checked:true};
const gcState={active:true,variant:"rushing",round:1,pickNumber:3,cards:[{name:"A"}],drawQueue:[{name:"B"}]};
const context={console,window:null,document:{getElementById:id=>id==="enableGalacticCurrent"?checkbox:null},GalacticCurrent:{isModeEnabled:()=>true,getState:()=>gcState,getLiveCards:()=>gcState.cards,getFutureCards:()=>gcState.drawQueue,getConfiguredVariant:()=>"rushing",getNextTurnDescriptor:()=>({turnsAway:2})}};
context.window=context;
vm.createContext(context);vm.runInContext(bridgeSource,context);
const b=context.GalacticCurrentSuperpowerBridge;
["loki","iron_man","hulk","cyclops","captain_america","venom","deadpool","black_cat","professor_x","wolverine","jeff","doctor_doom","spider_man"].forEach(id=>assert(b.isPowerCompatible(id),`${id} powinien być wspierany w aktualnej fali.`));
["doctor_strange","collector","mysterio","groot"].forEach(id=>assert(!b.isPowerCompatible(id),`${id} powinien pozostać świadomie zablokowany.`));
assert(b.getLiveCards()===gcState.cards,"Bridge nie zwraca referencji realnych kart nurtu.");
assert(b.getFutureCards()===gcState.drawQueue,"Bridge nie zwraca realnego przyszłego dopływu.");
const decorated=b.decoratePowerDefinition({id:"spider_man",timingLabel:"classic",description:"classic",restrictions:[]});
assert(decorated.galacticCurrentCompatibility?.status==="adapted","Spider-Man nie dostał statusu adaptera.");
assert(/nurt/i.test(decorated.description),"Dynamiczny wording Spider-Mana nie mówi o nurcie.");
const blocked=b.decoratePowerDefinition({id:"collector",restrictions:[]});
assert(blocked.galacticCurrentCompatibility?.status==="unsupported","Collector nie dostał statusu compatibility.");
assert(blocked.restrictions.some(x=>/NIEKOMPATYBILNA/.test(x)),"Carousel nie dostanie komunikatu o blokadzie Collectora.");
console.log("PASS Galactic Current Superpowers Compat current");
