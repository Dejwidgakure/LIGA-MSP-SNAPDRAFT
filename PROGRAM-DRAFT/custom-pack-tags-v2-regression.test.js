"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const here=__dirname, root=path.resolve(here,"..");
const ctx={console,Math:{...Math,random:()=>0.25},bannedCards:[]};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,"tags.js"),"utf8")+'\nthis.TAGS_OUT=TAGS;',ctx);
vm.runInContext(fs.readFileSync(path.join(here,"customPacks.js"),"utf8")+'\nthis.CUSTOM_PACKS_OUT=customPacks;',ctx);
ctx.cardDatabase=[
  {name:"Triad",cost:3,power:5,tags:["highevo","wongreveal","zoo"]},
  {name:"Destroyer",cost:3,power:5,tags:["destroy","classic-destroy"]},
  {name:"Mover",cost:2,power:4,tags:["move","move-combo"]},
  {name:"Animal A",cost:1,power:2,tags:["animals"]},
  {name:"Animal B",cost:2,power:3,tags:["animal-themed"]},
  {name:"Surfer A",cost:3,power:4,tags:["surfer-buff"]},
  {name:"Negative A",cost:4,power:1,tags:["mister-negative"]}
];
vm.runInContext(fs.readFileSync(path.join(here,"customPackEngine.js"),"utf8")+'\nthis.GET_CAT=getCustomPackCategoryTagIds; this.GET_POOL=getCustomPackPool;',ctx);
assert.ok(ctx.GET_CAT("deckArchetypes").includes("highevo"));
assert.equal(ctx.GET_CAT("archetypes").length,0,"legacy category must not resolve");
const universal=ctx.CUSTOM_PACKS_OUT.find(p=>p.id==="universal_pack");
assert.equal(universal.filter.tagCounts[0].category,"deckArchetypes");
assert.deepEqual(Array.from(ctx.GET_POOL(universal),c=>c.name),["Triad"],"universal pack counts new Deck Archetype tags");
const animal=ctx.CUSTOM_PACKS_OUT.find(p=>p.id==="animal_pack");
assert.ok(animal.tags.includes("animals"));
assert.ok(Array.from(ctx.GET_POOL(animal),c=>c.name).includes("Animal A"));
const rainbow=ctx.CUSTOM_PACKS_OUT.find(p=>p.id==="archetype_rainbow");
assert.equal(rainbow.composition.category,"deckArchetypes");
console.log("PASS Custom Packs Tag Schema V2");
