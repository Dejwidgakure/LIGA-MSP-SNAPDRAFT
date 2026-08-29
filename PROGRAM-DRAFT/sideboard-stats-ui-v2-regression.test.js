"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const stats=require("../draft-stats-engine.js");
const ui=require("../sideboard-stats-ui-v2.js");

const players=[
  {name:"Budiso",deck:["Alioth","En Sabah Nur","Firehair","Super-Skrull","Stardust","Omega Red","Topaz","Viv Vision","Yondu","Dracula","Sentinel","Galactus"],sideboard:["Dormammu","Enchantress","Juggernaut"]},
  {name:"Dejwidgakure",deck:Array.from({length:12},(_,i)=>`D ${i}`),sideboard:["Juggernaut","Reserve D 2","Reserve D 3"]},
  {name:"Supcio",deck:Array.from({length:12},(_,i)=>`S ${i}`),sideboard:["Reserve S 1","Reserve S 2","Reserve S 3"]},
  {name:"Weregesu",deck:Array.from({length:12},(_,i)=>`W ${i}`),sideboard:["Reserve W 1","Reserve W 2","Reserve W 3"]},
  {name:"Kmythic",deck:Array.from({length:12},(_,i)=>`K ${i}`),sideboard:["Juggernaut","Reserve K 2","Reserve K 3"]}
];
const d101={id:101,title:"RESERVE EDITION",status:"finished",playersCount:5,winner:"Budiso",scoring:{system:"standard25"},players,matches:[
  {p1:"Budiso",p2:"Dejwidgakure",pts1:21,pts2:4},
  {p1:"Budiso",p2:"Supcio",pts1:20,pts2:5},
  {p1:"Budiso",p2:"Weregesu",pts1:19,pts2:6},
  {p1:"Budiso",p2:"Kmythic",pts1:22,pts2:3},
  {p1:"Dejwidgakure",p2:"Supcio",pts1:18,pts2:7},
  {p1:"Dejwidgakure",p2:"Weregesu",pts1:16,pts2:9},
  {p1:"Dejwidgakure",p2:"Kmythic",pts1:18,pts2:7},
  {p1:"Supcio",p2:"Weregesu",pts1:17,pts2:8},
  {p1:"Supcio",p2:"Kmythic",pts1:17,pts2:8},
  {p1:"Weregesu",p2:"Kmythic",pts1:18,pts2:7}
]};
const d28={id:28,status:"active",playersCount:2,players:[{name:"A",deck:Array(12).fill("A")},{name:"B",deck:Array(12).fill("B")}],matches:[]};
const names=[...new Set(players.flatMap(p=>[...p.deck,...p.sideboard]))];
const cards=names.map((name,i)=>({name,cost:i%6+1,power:i+1,tags:[i%2?"destroy":"move"]}));
const profile=stats.calculateCardProfile([d28,d101],cards,"Juggernaut",{});
const budiso=profile.history.find(row=>row.id===101).carriers.find(row=>row.player==="Budiso");
assert.equal(budiso.zone,"sideboard");
assert.equal(budiso.place,1);
assert.equal(budiso.wins,4);
assert.equal(budiso.losses,0);
assert.equal(budiso.sideboard.includes("Juggernaut"),true);
assert.equal(budiso.mainDeck.includes("Juggernaut"),false);

const finish=ui.buildFinishModel(profile);
assert.equal(finish.counts[1],1,"Rozkład Miejsc includes Budiso #1 Sideboard appearance");
assert.equal(finish.rows.length,3,"each D101 Juggernaut Sideboard owner is a classified deck appearance");

const trajectory=ui.buildTrajectoryModel(profile,[d28,d101],stats);
assert.deepEqual(trajectory.map(row=>row.id),[101],"active D28 does not truncate or appear in finished career trajectory");
assert.equal(trajectory[0].appearances,3,"D101 trajectory counts all Sideboard owners");
assert.equal(trajectory[0].popularity,3/5);

const playerProfile=stats.calculatePlayerProfile([d28,d101],"Budiso");
const freq=ui.buildPlayerCardFrequency(playerProfile);
for(const name of ["Sentinel","Dormammu","Enchantress","Juggernaut"]){
  assert.equal(freq.some(row=>row.name===name&&row.appearances===1),true,`player signature data includes ${name}`);
}

const root=path.resolve(__dirname,"..");
const cardHtml=fs.readFileSync(path.join(root,"card-stats.html"),"utf8");
const playerHtml=fs.readFileSync(path.join(root,"player.html"),"utf8");
const archiveJs=fs.readFileSync(path.join(root,"stats-v2.js"),"utf8");
const cardsHtml=fs.readFileSync(path.join(root,"cards.html"),"utf8");
const lobbyHtml=fs.readFileSync(path.join(root,"player-lobby.html"),"utf8");
assert.match(cardHtml,/sideboard-stats-ui-v2\.js/,"card profile loads canonical Sideboard UI bridge after legacy modules");
assert.match(playerHtml,/sideboard-stats-ui-v2\.js/,"player profile loads canonical Sideboard UI bridge after legacy modules");
assert.doesNotMatch(playerHtml,/Ciekawostki z Arsenału|<div class="kicker">Arsenał<\/div>/,"player-facing profile no longer calls the deck an arsenal");
assert.match(archiveJs,/buildArchiveSnapshot/,"Gwiezdne Archiwum reads the canonical archive snapshot");
assert.doesNotMatch(archiveJs,/\.deck\.(?:forEach|includes)|player\.deck/,"Gwiezdne Archiwum has no private Main-Deck-only card statistics loop");
assert.match(cardsHtml,/calculateCardProfile/,"Kolekcja lobby reads canonical card profiles");
assert.doesNotMatch(cardsHtml,/player\.deck|\.deck\.includes|\.deck\.forEach/,"Kolekcja lobby has no private Main-Deck-only statistics loop");
assert.match(lobbyHtml,/calculatePlayerProfile/,"Galaktyczna Baza lobby reads canonical player profiles");

console.log("SIDEBOARD_STATS_UI_V2_REGRESSION_OK",JSON.stringify({
  juggernautBudiso:`${budiso.wins}-${budiso.losses}`,
  finishFirst:finish.counts[1],
  d101Popularity:trajectory[0].popularity,
  playerCards:freq.length
}));
