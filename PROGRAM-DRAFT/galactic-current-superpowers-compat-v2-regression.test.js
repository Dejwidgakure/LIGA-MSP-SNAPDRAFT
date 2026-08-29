const fs=require('fs');
const path=require('path');
const assert=require('assert');
const vm=require('vm');

const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const bridge=read('superpowers-galactic-current-bridge.js');
const current=read('galactic-current.js');
const snap=read('snap-draft.html');
const ui=read('superpowers-ui.js');
const wolverine=read('superpowers-wolverine.js');
const blackcat=read('superpowers-blackcat-v7.js');

// Runtime registry / dynamic wording.
const sandbox={console};
sandbox.window=sandbox;
sandbox.globalThis=sandbox;
sandbox.GalacticCurrent={
  isModeEnabled:()=>true,
  getState:()=>({active:true,variant:'rushing',round:2,pickNumber:9,cards:[],drawQueue:[]}),
  getConfiguredVariant:()=> 'rushing'
};
vm.createContext(sandbox);
vm.runInContext(bridge,sandbox);
const B=sandbox.GalacticCurrentSuperpowerBridge;
assert(B,'bridge exported');
for(const id of ['professor_x','wolverine','jeff','doctor_doom','spider_man','black_cat']){
  const c=B.getCompatibility(id);
  assert(c.compatible,`${id} should be compatible`);
}
for(const id of ['doctor_strange','collector','mysterio','groot']){
  const c=B.getCompatibility(id);
  assert(!c.compatible,`${id} should remain intentionally blocked after V2 foundations`);
}
const spider=B.decoratePowerDefinition({id:'spider_man',timingLabel:'Classic paczka',description:'Classic paczka',restrictions:[]});
assert(/nurt/i.test(spider.description),'Spider dynamic description uses river wording');
assert(!/aktualnej paczki/i.test(spider.description),'Spider GC description does not advertise current pack');
const jeff=B.decoratePowerDefinition({id:'jeff',timingLabel:'paczka',description:'paczka',restrictions:[]});
assert(/nurt/i.test(jeff.description),'Jeff dynamic description uses river wording');
const doom=B.decoratePowerDefinition({id:'doctor_doom',timingLabel:'paczka',description:'paczka',restrictions:[]});
assert(/nurt/i.test(doom.description),'Doom dynamic description uses river wording');
const collector=B.decoratePowerDefinition({id:'collector',description:'x',restrictions:[]});
assert(/NIEKOMPATYBILNA/.test(collector.restrictions.join(' ')),'Collector has visible incompatible reason');

// Spider-Man: real river anchoring + forced next pick + mutation shields.
assert(snap.includes('unlockRiverPickNumber'),'Spider stores GC absolute unlock sequence');
assert(snap.includes('window.isSpiderManReservationAnchored=isSpiderManReservationAnchored'),'Spider exposes anchor guard');
assert(snap.includes('window.finalizeSpiderManPackPick=finalizeSpiderManPackPick'),'Spider exposes resolution hook');
assert(current.includes('window.SuperpowerUI?.handlePackCardClick?.(index,pickedCard)'),'GC clicks pass through Superpower UI protections');
assert(current.includes('window.finalizeSpiderManPackPick?.(playerIndex,pickedCard)'),'GC resolves Spider webs on owner pick');
assert(current.includes('!isSpiderAnchored(card)'),'GC natural flow skips anchored cards');
assert(current.includes('age>=fadeLimit && !isSpiderAnchored(card)'),'Fading stars cannot naturally expire anchored Spider cards');
assert((current.match(/Pajęcza Sieć kotwiczy tę kartę w nurcie/g)||[]).length>=2,'direct replace + consume both reject Spider anchor');

// Professor X: future turn can cross orbit and GC consumes control after target pick.
assert(snap.includes('GalacticCurrentSuperpowerBridge.getNextTurnDescriptor?.(target)'),'Professor X searches future GC turn through bridge');
assert((current.match(/window\.consumeProfessorXControl\?\.\(playerIndex,resultCard\)/g)||[]).length>=2,'both GC variants resolve Professor X control');

// Jeff / Doom mutate authoritative state.cards through bridge, not a filtered copy.
assert(snap.includes('const livePack=inGalacticCurrent ? gcBridge.getLiveCards() : currentPack'),'Jeff reads authoritative live river');
assert(snap.includes('source:"jeff_joker_wave"'),'Jeff replacement carries GC source');
assert(snap.includes('JOKEROWY NURT'),'Jeff GC result wording is mode-aware');
assert(snap.includes('source:"doctor_doom_doombot_replacement"'),'Doom river replacement goes through bridge');
assert(snap.includes('const livePack=inGalacticCurrent ? gcBridge.getLiveCards() : currentPack'),'shared live-river selection present');

// Wolverine timing becomes fifth orbit instead of fifth pack.
assert(wolverine.includes('piątego obiegu Gwiezdnego Prądu'),'Wolverine has fifth-orbit wording');
assert(wolverine.includes('flowNumber()'),'Wolverine logs/checks mode-aware flow number');

// Black Cat's already-native GC adapter must not keep player-facing pack wording in its gem portal.
assert(blackcat.includes('KOPIA Z PRZYSZŁEGO DOPŁYWU'),'Black Cat Future Gem uses future-flow wording');
assert(blackcat.includes('flowSurfaceGenitive'),'Black Cat portal has mode-aware surface wording');
assert(blackcat.includes('gemTooltip(gem)'),'Black Cat gem tooltip is mode-aware at reward creation');

// Modal / feedback wording for adapted river powers.
for(const needle of ['NURT ZALANY JOKERAMI','zakotwicz','AKTUALNY NURT']){
  assert(ui.includes(needle),`UI wording contains ${needle}`);
}

console.log('PASS Galactic Current Superpowers Compat V2');
