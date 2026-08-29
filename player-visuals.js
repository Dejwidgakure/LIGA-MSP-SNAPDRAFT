(function(global){
"use strict";
const HEROES=[{"id":"captain-america","label":"Captain America","file":"assets/player-heroes/captain-america.webp","scale":1.08,"x":50,"y":52},{"id":"professor-x","label":"Professor X","file":"assets/player-heroes/professor-x.webp","scale":1.09,"x":50,"y":52},{"id":"spider-man","label":"Spider-Man","file":"assets/player-heroes/spider-man.webp","scale":1.07,"x":50,"y":52},{"id":"venom","label":"Venom","file":"assets/player-heroes/venom.webp","scale":1.08,"x":50,"y":52},{"id":"wolverine","label":"Wolverine","file":"assets/player-heroes/wolverine.webp","scale":1.08,"x":50,"y":52},{"id":"doctor-strange","label":"Doctor Strange","file":"assets/player-heroes/doctor-strange.webp","scale":1.1,"x":50,"y":51},{"id":"doctor-doom","label":"Doctor Doom","file":"assets/player-heroes/doctor-doom.webp","scale":1.08,"x":50,"y":52},{"id":"groot","label":"Groot","file":"assets/player-heroes/groot.webp","scale":1.1,"x":50,"y":52},{"id":"iron-fist","label":"Iron Fist","file":"assets/player-heroes/iron-fist.webp","scale":1.08,"x":49,"y":52},{"id":"rocket","label":"Rocket","file":"assets/player-heroes/rocket.webp","scale":1.1,"x":50,"y":51},{"id":"thor","label":"Thor","file":"assets/player-heroes/thor.webp","scale":1.08,"x":50,"y":52},{"id":"deadpool","label":"Deadpool","file":"assets/player-heroes/deadpool.webp","scale":1.07,"x":50,"y":52},{"id":"loki","label":"Loki","file":"assets/player-heroes/loki.webp","scale":1.08,"x":50,"y":52},{"id":"moon-knight","label":"Moon Knight","file":"assets/player-heroes/moon-knight.webp","scale":1.08,"x":50,"y":52},{"id":"cyclops","label":"Cyclops","file":"assets/player-heroes/cyclops.webp","scale":1.08,"x":50,"y":52},{"id":"iron-man","label":"Iron Man","file":"assets/player-heroes/iron-man.webp","scale":1.08,"x":50,"y":52}];
function normalizeName(name){ return String(name||"").trim().toLocaleLowerCase("pl"); }
function hashName(name){
  const text=normalizeName(name);
  let hash=2166136261;
  for(let i=0;i<text.length;i++){ hash^=text.charCodeAt(i); hash=Math.imul(hash,16777619); }
  return hash>>>0;
}
function getHero(name){ return HEROES.length ? HEROES[hashName(name)%HEROES.length] : null; }
function heroStyle(hero){
  if(!hero) return "";
  return `--hero-x:${hero.x||50}%;--hero-y:${hero.y||52}%;--hero-scale:${hero.scale||1}`;
}
global.PlayerVisuals=Object.freeze({HEROES:Object.freeze(HEROES),getHero,hashName,heroStyle});
})(window);
