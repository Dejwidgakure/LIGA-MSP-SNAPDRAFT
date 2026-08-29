"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const here=__dirname;
const root=path.resolve(here,"..");
const read=n=>fs.readFileSync(path.join(here,n),"utf8");
const readRoot=n=>fs.readFileSync(path.join(root,n),"utf8");
function evalConst(source,name){
  const ctx={}; vm.createContext(ctx); vm.runInContext(source+`\nthis.OUT=${name};`,ctx); return ctx.OUT;
}
const tags=evalConst(readRoot("tags.js"),"TAGS");
assert.deepEqual(Object.keys(tags),["series","abilityTypes","mechanicFamilies","subtypes","deckArchetypes","teams","themes","special"]);
assert.equal(Object.prototype.hasOwnProperty.call(tags,"archetypes"),false,"legacy archetypes category must be gone");
const idToCategory=new Map();
for(const [category,list] of Object.entries(tags)) for(const item of list||[]) idToCategory.set(String(item.id),category);
for(const [id,category] of [["destroy","mechanicFamilies"],["disruption","mechanicFamilies"],["highevo","deckArchetypes"],["wongreveal","deckArchetypes"],["draw","subtypes"],["animals","themes"]]){
  assert.equal(idToCategory.get(id),category,`${id} must resolve to ${category}`);
}

const reserve=read("planetary-reserve-engine.js");
for(const token of ["mechanicFamilies","subtypes","deckArchetypes","tech_answer","missing_curve","cheap_random","random_option"]){
  assert.ok(reserve.includes(token),`Reserve V2 must include ${token}`);
}
assert.doesNotMatch(reserve,/dominantTag\("archetypes"\)|dominantIdentity\(\)|team_theme_subtype|high_power_finisher|second_synergy/);

const cyclopsUI=read("superpowers-ui.js"), html=read("snap-draft.html"), data=read("superpowers-data.js");
for(const source of [cyclopsUI,html]) assert.match(source,/\["mechanicFamilies","deckArchetypes","themes"\]/);
assert.doesNotMatch(cyclopsUI,/const allowedCategories=\["archetypes"/);
assert.match(data,/Rodzinę Mechanik, Archetyp Deckowy \/ Paczkę albo Cechę Tematyczną/);

const blackcat=read("superpowers-blackcat-v7.js");
assert.match(blackcat,/\["mechanicFamilies","subtypes","deckArchetypes"\]/);
const economySlice=html.slice(html.indexOf("function getEconomyEligibleSynergyTags"),html.indexOf("function replaceEconomyDeckCard"));
assert.match(economySlice,/\["mechanicFamilies","subtypes","deckArchetypes"\]/);

const custom=read("customPacks.js"), customEngine=read("customPackEngine.js");
assert.doesNotMatch(custom,/category:\s*"archetypes"/);
assert.match(custom,/category:\s*"deckArchetypes"/);
assert.match(custom,/tags:\s*\["animals"\]/);
assert.doesNotMatch(customEngine,/category:"archetypes"/);

const questRegistry=read("draft-quests-registry.js"), questEngine=read("draft-quests-engine.js");
assert.doesNotMatch(questRegistry,/category:\s*"archetypes"/);
assert.match(questRegistry,/category:\s*"deckArchetypes"/);
assert.doesNotMatch(questEngine,/tagIdsForCategory\("archetypes"\)|historyEntryTags\([^\n]+"archetypes"\)/);

const jokers=evalConst(read("jokers.js"),"jokers");
const virtual=new Set(["cost-greater-than-power","power-greater-than-cost","equal-cost-power","exact-2-power","exact-6-6","power-4-above-cost","any"]);
function collectTags(filter,out=[]){
  if(!filter||typeof filter!=="object") return out;
  if(filter.tags) for(const key of ["allOf","anyOf","noneOf"]) for(const tag of filter.tags[key]||[]) if(typeof tag==="string") out.push(tag);
  for(const rule of filter.tagCounts||[]) for(const tag of rule.tags||[]) if(typeof tag==="string") out.push(tag);
  for(const [key,value] of Object.entries(filter)) if(key!=="tags"&&key!=="tagCounts"&&value&&typeof value==="object") collectTags(value,out);
  return out;
}
const missing=[];
for(const joker of jokers){
  assert.equal((joker.sourceCategories||[]).includes("archetypes"),false,`${joker.id} must not expose legacy source category`);
  for(const tag of collectTags(joker.filter)) if(!idToCategory.has(tag)&&!virtual.has(tag)) missing.push(`${joker.id}:${tag}`);
}
assert.deepEqual(missing,[],"Every Joker concrete tag must exist in Tag Schema V2");
assert.ok(jokers.find(j=>j.id==="choice_location_control").filter.tags.anyOf.includes("location-control"));
assert.ok(jokers.find(j=>j.id==="choice_location_control").filter.tags.anyOf.includes("location-points"));
assert.ok(jokers.find(j=>j.id==="choice_negative").filter.tags.allOf.includes("mister-negative"));
assert.ok(jokers.find(j=>j.id==="choice_three_subtypes").filter.tagCounts[0].tags.every(id=>idToCategory.get(id)==="subtypes"));
assert.ok(jokers.find(j=>j.id==="choice_three_archetypes").filter.tagCounts[0].tags.every(id=>["mechanicFamilies","deckArchetypes"].includes(idToCategory.get(id))));
const jokerEngine=read("jokerEngine.js");
for(const legacy of ["negative","priority-control","shou-lao","nimrod-phoenix","wiccan","surfer","energy-ramp","location","zero-downsides"]){
  assert.ok(jokerEngine.includes(`"${legacy}"`),`Joker engine keeps a migration alias for ${legacy}`);
}

console.log("PASS Tag Schema V2 Integration",JSON.stringify({categories:Object.keys(tags),jokers:jokers.length}));
