(function(global){
"use strict";
const HEROES=[{"id":"captain-america","label":"Captain America","file":"assets/player-hero-captain-america.webp","scale":1.08,"x":50,"y":52},{"id":"professor-x","label":"Professor X","file":"assets/player-hero-professor-x.webp","scale":1.09,"x":50,"y":52},{"id":"spider-man","label":"Spider-Man","file":"assets/player-hero-spider-man.webp","scale":1.07,"x":50,"y":52},{"id":"venom","label":"Venom","file":"assets/player-hero-venom.webp","scale":1.08,"x":50,"y":52},{"id":"wolverine","label":"Wolverine","file":"assets/player-hero-wolverine.webp","scale":1.08,"x":50,"y":52},{"id":"doctor-strange","label":"Doctor Strange","file":"assets/player-hero-doctor-strange.webp","scale":1.1,"x":50,"y":51},{"id":"doctor-doom","label":"Doctor Doom","file":"assets/player-hero-doctor-doom.webp","scale":1.08,"x":50,"y":52},{"id":"groot","label":"Groot","file":"assets/player-hero-groot.webp","scale":1.1,"x":50,"y":52},{"id":"iron-fist","label":"Iron Fist","file":"assets/player-hero-iron-fist.webp","scale":1.08,"x":49,"y":52},{"id":"rocket","label":"Rocket","file":"assets/player-hero-rocket.webp","scale":1.1,"x":50,"y":51},{"id":"thor","label":"Thor","file":"assets/player-hero-thor.webp","scale":1.08,"x":50,"y":52},{"id":"deadpool","label":"Deadpool","file":"assets/player-hero-deadpool.webp","scale":1.07,"x":50,"y":52},{"id":"loki","label":"Loki","file":"assets/player-hero-loki.webp","scale":1.08,"x":50,"y":52},{"id":"moon-knight","label":"Moon Knight","file":"assets/player-hero-moon-knight.webp","scale":1.08,"x":50,"y":52},{"id":"cyclops","label":"Cyclops","file":"assets/player-hero-cyclops.webp","scale":1.08,"x":50,"y":52},{"id":"iron-man","label":"Iron Man","file":"assets/player-hero-iron-man.webp","scale":1.08,"x":50,"y":52}];
function normalizeName(name){ return String(name||"").trim().toLocaleLowerCase("pl"); }
function hashName(name){
  const text=normalizeName(name);
  let hash=2166136261;
  for(let i=0;i<text.length;i++){ hash^=text.charCodeAt(i); hash=Math.imul(hash,16777619); }
  return hash>>>0;
}
function compactKey(name){
  return normalizeName(name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
}
const FEATURED_KEYS=new Set(["dejwidgakure","dawidgakure","dawidgokkura","davidgokkura"]);
function getFeaturedHero(name){
  const loki=HEROES.find(hero=>hero.id==="loki");
  const alternatives=HEROES.filter(hero=>hero.id!=="loki");
  if(!loki||!alternatives.length) return HEROES[hashName(name)%HEROES.length]||null;
  const storageKey=`sd-player-visual:${compactKey(name)}`;
  try{
    const saved=sessionStorage.getItem(storageKey);
    if(saved){
      const found=HEROES.find(hero=>hero.id===saved);
      if(found) return found;
    }
  }catch(error){}
  const chosen=Math.random()<0.70 ? loki : alternatives[hashName(name)%alternatives.length];
  try{ sessionStorage.setItem(storageKey,chosen.id); }catch(error){}
  return chosen;
}
function getHero(name){
  if(!HEROES.length) return null;
  return FEATURED_KEYS.has(compactKey(name)) ? getFeaturedHero(name) : HEROES[hashName(name)%HEROES.length];
}
function heroStyle(hero){
  if(!hero) return "";
  return `--hero-x:${hero.x||50}%;--hero-y:${hero.y||52}%;--hero-scale:${hero.scale||1}`;
}
global.PlayerVisuals=Object.freeze({HEROES:Object.freeze(HEROES),getHero,hashName,heroStyle});
})(window);
