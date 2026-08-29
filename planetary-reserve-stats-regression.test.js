"use strict";

const assert=require("node:assert/strict");
const stats=require("../draft-stats-engine.js");

const d101Players=[
  {
    name:"Dejwidgakure",
    deck:["Hit-Monkey","Fastball Special","Danger","Triton","Prowler","Colleen Wing","Agent Venom","Xorn","Kang","Cable","Rocket and Groot","Okoye"],
    sideboard:["Juggernaut","Infinity Ultron","Majestic Wingbeat"]
  },
  {
    name:"Supcio",
    deck:["The Living Tribunal","Sage","Devil Dinosaur","Viper","The Collector","Aero","Valkyrie","Giganto","Mantis","Kahhori","Jocasta","Silver Sable"],
    sideboard:["Techno-Organic Virus","Hawkeye Kate Bishop","Nico Minoru"]
  },
  {
    name:"Budiso",
    deck:["Alioth","En Sabah Nur","Firehair","Super-Skrull","Stardust","Omega Red","Topaz","Viv Vision","Yondu","Dracula","Sentinel","Galactus"],
    sideboard:["Dormammu","Enchantress","Juggernaut"]
  },
  {
    name:"Weregesu",
    deck:["Ultron","Crystal","Shocker","X-23","Apocalypse","Gorgon","Green Goblin","The Infinaut","Uatu the Watcher","The Collector","Polaris","Hobgoblin"],
    sideboard:["Brood","Cannonball","Doctor Octopus"]
  },
  {
    name:"Kmythic",
    deck:["Scorpion Brand New Day","Sauron","Attuma","Cosmic Ghost Rider","Rama-Tut","Gladiator","The Thing First Steps","The Hood","Xorn","Silver Surfer","Ares","Caiera"],
    sideboard:["Nico Minoru","Infinity Ultron","Juggernaut"]
  }
];

const d101={
  id:101,
  title:"RESERVE EDITION",
  startDate:"2026-08-27",
  endDate:"2026-08-27",
  status:"finished",
  playersCount:5,
  winner:"Budiso",
  scoring:{system:"standard25",singleWalkover:"20:0",doubleWalkover:"0:0"},
  players:d101Players,
  matches:[
    {p1:"Dejwidgakure",p2:"Supcio",pts1:18,pts2:7},
    {p1:"Dejwidgakure",p2:"Budiso",pts1:4,pts2:21},
    {p1:"Dejwidgakure",p2:"Weregesu",pts1:16,pts2:9},
    {p1:"Dejwidgakure",p2:"Kmythic",pts1:18,pts2:7},
    {p1:"Supcio",p2:"Budiso",pts1:5,pts2:20},
    {p1:"Supcio",p2:"Weregesu",pts1:17,pts2:8},
    {p1:"Supcio",p2:"Kmythic",pts1:17,pts2:8},
    {p1:"Budiso",p2:"Weregesu",pts1:19,pts2:6},
    {p1:"Budiso",p2:"Kmythic",pts1:22,pts2:3},
    {p1:"Weregesu",p2:"Kmythic",pts1:18,pts2:7}
  ]
};

// Old draft: no Sideboard at all. It must retain legacy behavior.
const oldNames=Array.from({length:24},(_,index)=>`Legacy ${index+1}`);
const d27={
  id:27,
  status:"finished",
  playersCount:2,
  winner:"Legacy Alpha",
  scoring:{system:"standard25"},
  players:[
    {name:"Legacy Alpha",deck:oldNames.slice(0,12)},
    {name:"Legacy Beta",deck:oldNames.slice(12,24)}
  ],
  matches:[{p1:"Legacy Alpha",p2:"Legacy Beta",pts1:20,pts2:5}]
};

// Active D28 intentionally sits between D27 and D101. It must not truncate later finished data.
const d28={
  id:28,
  status:"active",
  playersCount:2,
  scoring:{system:"standard25"},
  players:[
    {name:"Active A",deck:Array.from({length:12},(_,i)=>`Active A ${i+1}`)},
    {name:"Active B",deck:Array.from({length:12},(_,i)=>`Active B ${i+1}`)}
  ],
  matches:[]
};

const allCardNames=[...new Set([
  ...oldNames,
  ...d101Players.flatMap(player=>[...(player.deck||[]),...(player.sideboard||[])]),
  ...d28.players.flatMap(player=>player.deck)
])];
const cards=allCardNames.map((name,index)=>({
  name,
  cost:(index%6)+1,
  power:index+1,
  tags:[index%2?"classic-destroy":"move-combo"]
}));
const tags={deckArchetypes:[{id:"classic-destroy",name:"Classic Destroy"},{id:"move-combo",name:"Move Combo"}]};
const drafts=[d27,d28,d101];

const validation=stats.validateDatabase({drafts,cards,tags});
assert.equal(validation.valid,true,"fixture should have no validation errors");
assert.equal(validation.issues.some(issue=>issue.code==="unexpectedSideboardSize"),false,"valid 3-card Sideboards have no size warning");

assert.deepEqual(stats.getSideboardCards(d27.players[0]),[],"old drafts without sideboard keep an empty reserve");
assert.equal(stats.getPlayerDeckCards(d27.players[0]).length,12,"old player deck remains exactly the legacy 12 cards");
assert.equal(stats.getPlayerDeckCards(d101Players[2]).length,15,"Planetary Reserve player deck = 12 Main Deck + 3 Sideboard");

const sentinel=stats.calculateCardProfile(drafts,cards,"Sentinel",{});
const dormammu=stats.calculateCardProfile(drafts,cards,"Dormammu",{});
const enchantress=stats.calculateCardProfile(drafts,cards,"Enchantress",{});
const juggernaut=stats.calculateCardProfile(drafts,cards,"Juggernaut",{});

for(const [label,profile] of [["Sentinel",sentinel],["Dormammu",dormammu],["Enchantress",enchantress]]){
  assert.equal(profile.summary.draftWins,1,`${label} inherits Budiso's D101 title`);
  assert.equal(profile.summary.podiums,1,`${label} inherits Budiso's podium`);
  assert.equal(profile.summary.legendPoints,8,`${label} inherits #1 Legend Points`);
  assert.equal(profile.summary.matches,4,`${label} inherits all four Budiso matches`);
  assert.equal(profile.summary.wins,4,`${label} inherits Budiso's four wins`);
  assert.equal(profile.summary.losses,0,`${label} inherits Budiso's 4-0 record`);
  assert.equal(profile.history.some(row=>row.id===101&&row.places.some(place=>place.player==="Budiso"&&place.place===1)),true,`${label} records Budiso #1 in D101 history`);
}

assert.equal(sentinel.summary.mainDeckAppearances,1);
assert.equal(sentinel.summary.sideboardAppearances,0);
assert.equal(dormammu.summary.mainDeckAppearances,0);
assert.equal(dormammu.summary.sideboardAppearances,1);
assert.equal(enchantress.summary.sideboardAppearances,1);

// Juggernaut appears in three D101 Sideboards. Budiso's copy still contributes his full 4-0/title result.
assert.equal(juggernaut.summary.appearances,3);
assert.equal(juggernaut.summary.sideboardAppearances,3);
assert.equal(juggernaut.summary.draftWins,1,"Juggernaut receives Budiso's title from the winning Sideboard");
assert.equal(juggernaut.summary.matches,12,"each owner contributes all of their played matches to the card profile");
assert.equal(juggernaut.history.some(row=>row.id===101&&row.places.some(place=>place.player==="Budiso"&&place.place===1)),true,"Szczyty i Cienie can see Juggernaut's #1 Budiso result");
const juggernautD101=juggernaut.history.find(row=>row.id===101);
const budisoJuggernaut=juggernautD101.carriers.find(row=>row.player==="Budiso");
assert.equal(budisoJuggernaut.zone,"sideboard","card history preserves the Sideboard zone for UI renderers");
assert.equal(budisoJuggernaut.place,1,"UI carrier history receives Budiso #1 directly from the engine");
assert.equal(budisoJuggernaut.wins,4,"UI carrier history receives Budiso's full 4-0 record");
assert.equal(budisoJuggernaut.losses,0);
assert.equal(budisoJuggernaut.mainDeck.length,12);
assert.equal(budisoJuggernaut.sideboard.length,3);
assert.equal(budisoJuggernaut.playerDeck.length,15);
const budisoPilot=juggernaut.pilots.find(row=>row.name==="Budiso");
assert.equal(budisoPilot.draftWins,1,"full pilot gallery receives Sideboard title data from the engine");
assert.equal(budisoPilot.wins,4,"full pilot gallery receives Sideboard match wins from the engine");
assert.equal(budisoPilot.legendPoints,8,"full pilot gallery receives Sideboard Legend Points from the engine");

const context=stats.createStatsContext({drafts,cards,tags});
assert.equal(context.indexes.deckAppearancesByCard.Dormammu[0].zone,"SIDEBOARD","zone metadata remains structural");
assert.equal(context.indexes.deckAppearancesByCard.Sentinel[0].zone,"MAIN_DECK","Main Deck zone remains structural");

const snapshot=stats.buildArchiveSnapshot({drafts,cards,tags});
const d101Row=snapshot.drafts.find(row=>row.id===101);
assert.equal(d101Row.deckSlots,60,"technical Main Deck slot count remains available");
assert.equal(d101Row.sideboardSlots,15,"Sideboard slot count remains available");
assert.equal(d101Row.playerDeckSlots,75,"statistical player deck includes both zones");
assert.equal(d101Row.draftedSlots,75);

const sentinelRow=snapshot.cards.find(card=>card.name==="Sentinel");
const dormammuRow=snapshot.cards.find(card=>card.name==="Dormammu");
assert.equal(sentinelRow.draftWins,1);
assert.equal(dormammuRow.draftWins,1,"archive card success includes Sideboard cards");
assert.equal(dormammuRow.wins,4,"archive card W-L includes Sideboard cards");
assert.equal(dormammuRow.losses,0);
assert.equal(dormammuRow.sideboardAppearances,1);
assert.equal(dormammuRow.mainDeckAppearances,0);
assert.equal(dormammu.partners.some(partner=>partner.name==="Sentinel"&&partner.sharedDecks===1),true,"partner/co-occurrence stats include Main Deck + Sideboard pairs");
assert.equal(snapshot.totals.deckCards>0,true,"global used-card coverage includes the complete player deck");

const legacyCard=stats.calculateCardProfile(drafts,cards,"Legacy 1",{});
assert.equal(legacyCard.summary.appearances,1);
assert.equal(legacyCard.summary.matches,1);
assert.equal(legacyCard.summary.wins,1,"old no-sideboard draft keeps its pre-Sideboard result semantics");
assert.equal(legacyCard.summary.sideboardAppearances,0);

console.log("PLANETARY_RESERVE_STATS_REGRESSION_OK",JSON.stringify({
  sentinel:`${sentinel.summary.wins}-${sentinel.summary.losses}`,
  dormammu:`${dormammu.summary.wins}-${dormammu.summary.losses}`,
  juggernautWins:juggernaut.summary.wins,
  budisoTitle:dormammu.summary.draftWins,
  d101PlayerDeckSlots:d101Row.playerDeckSlots
}));
