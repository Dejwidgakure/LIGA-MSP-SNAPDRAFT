"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const here=__dirname;
const root=path.resolve(here,"..");
const read=(base,name)=>fs.readFileSync(path.join(base,name),"utf8");
function evalConst(source,name){ const ctx={}; vm.createContext(ctx); vm.runInContext(source+`\nthis.OUT=${name};`,ctx); return ctx.OUT; }
const tags=evalConst(read(root,"tags.js"),"TAGS");
const ids=new Set(Object.values(tags).flat().map(x=>String(x.id)));
assert.deepEqual(Object.keys(tags),["series","abilityTypes","mechanicFamilies","subtypes","deckArchetypes","teams","themes","special"]);

const cardsHtml=read(root,"cards.html");
assert.match(cardsHtml,/const categoryMeta=.*TAG_CATEGORIES/);
assert.match(cardsHtml,/Object\.keys\(categoryMeta\)/);
assert.doesNotMatch(cardsHtml,/categoryOrder=\[[^\]]*"archetypes"/);
assert.match(cardsHtml,/mechanicFamilies/);
assert.match(cardsHtml,/deckArchetypes/);

const dna=read(root,"sideboard-stats-ui-v2.js");
assert.doesNotMatch(dna,/byCategory\.archetypes/);
assert.match(dna,/byCategory\.deckArchetypes/);
assert.match(dna,/byCategory\.mechanicFamilies/);

for(const base of [root,here]){
  const cyclops=read(base,"superpowers-ui.js");
  assert.match(cyclops,/Object\.values\(TAGS\)/);
  assert.match(cyclops,/found\?\.name/);
  assert.doesNotMatch(cyclops,/const labels=\{/);
  const jokersSrc=read(base,"jokers.js");
  for(const oldId of ["silver-surfer","victoria-hand","darkhawk-rocks","sauron-nightmare"]){
    assert.doesNotMatch(jokersSrc,new RegExp(`"${oldId}"`),`${oldId} must not remain in live Joker filters`);
  }
  for(const id of ["surfer-buff","victoria-hand-big-hand","darkhawk-ronan","sauron-skaar"]){
    assert.match(jokersSrc,new RegExp(`"${id}"`),`${id} must be used by Joker filters`);
  }
  const engine=read(base,"jokerEngine.js");
  for(const [canonical,legacy] of [["surfer-buff","silver-surfer"],["victoria-hand-big-hand","victoria-hand"],["darkhawk-ronan","darkhawk-rocks"],["sauron-skaar","sauron-nightmare"]]){
    assert.ok(engine.includes(`"${canonical}"`)&&engine.includes(`"${legacy}"`),`${canonical} keeps migration alias ${legacy}`);
  }
}

const jokers=evalConst(read(here,"jokers.js"),"jokers");
const virtual=new Set(["cost-greater-than-power","power-greater-than-cost","equal-cost-power","exact-2-power","exact-6-6","power-4-above-cost","any"]);
function collect(filter,out=[]){ if(!filter||typeof filter!=="object")return out; if(filter.tags)for(const k of ["allOf","anyOf","noneOf"])for(const t of filter.tags[k]||[])if(typeof t==="string")out.push(t); for(const r of filter.tagCounts||[])for(const t of r.tags||[])if(typeof t==="string")out.push(t); for(const [k,v] of Object.entries(filter))if(k!=="tags"&&k!=="tagCounts"&&v&&typeof v==="object")collect(v,out); return out; }
const missing=[]; for(const j of jokers) for(const tag of collect(j.filter)) if(!ids.has(tag)&&!virtual.has(tag)) missing.push(`${j.id}:${tag}`);
assert.deepEqual(missing,[]);

const atlas=read(root,"atlas-tagow.html");
assert.match(atlas,/const order=Object\.keys\(TAG_CATEGORIES\)/);
assert.match(atlas,/tag-schema-v2-consumer-hotfix/);
assert.match(atlas,/id="tagCategoryRail"/);
assert.match(atlas,/renderCategoryRail/);

assert.doesNotMatch(read(root,"customPacks.js"),/category:\s*"archetypes"/);
assert.doesNotMatch(read(root,"draft-stats-engine.js"),/categoryById\[tagId\]\s*!==?\s*['"]archetypes['"]/);

const timerJs=read(here,"draft-turn-timer.js");
assert.doesNotMatch(timerJs,/document\.body\.appendChild\(hud\)/);
const timerCss=read(here,"draft-turn-timer.css");
assert.match(timerCss,/FINAL NATURAL TIMER LAYOUT/);
assert.match(timerCss,/position:relative/);
assert.doesNotMatch(timerCss,/draft-turn-hud-portal\{[\s\S]*position:fixed/);
const grootJs=read(here,"superpowers-groot.js");
const shop=grootJs.slice(grootJs.indexOf("function renderGardenShop"),grootJs.indexOf("function renderGardenMessage"));
assert.ok(shop.indexOf("spx-groot-economy-bridge")<shop.indexOf("spx-groot-rewards"),"Tree of Abundance is before reward grid in real DOM flow");
const grootCss=read(here,"superpowers-groot.css");
assert.match(grootCss,/FINAL TREE OF ABUNDANCE FLOW/);
assert.match(grootCss,/overflow-y:auto!important/);

const cards=evalConst(read(root,"cards.js"),"cardDatabase");
const orphan={}; for(const card of cards)for(const tag of card.tags||[])if(!ids.has(tag))(orphan[tag]??=[]).push(card.name);
assert.deepEqual(new Set(Object.keys(orphan)),new Set(["ongoing-combo","energy-ramp"]),"Only the two intentionally deferred data migrations may remain orphaned");
console.log("PASS Tag Consumers V2 Completeness",JSON.stringify({jokers:jokers.length,orphans:Object.fromEntries(Object.entries(orphan).map(([k,v])=>[k,v.length]))}));
