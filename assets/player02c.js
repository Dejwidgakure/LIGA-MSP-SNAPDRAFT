(function(){
"use strict";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[ch]));

const params=new URLSearchParams(location.search);
const playerName=params.get("name");
if(!playerName||typeof database==="undefined"||!Array.isArray(database.drafts)||typeof DraftStatsEngine==="undefined")return;

const profile=DraftStatsEngine.calculatePlayerProfile(database.drafts,playerName);
if(!profile)return;

if($("heroSignature")){
  $("heroSignature").textContent="OSOBISTA TWIERDZA · HISTORIA I STATYSTYKI GRACZA";
}

const chronology=(profile.history||[]).slice().sort((a,b)=>Number(a.draftId)-Number(b.draftId));
const cardByName=new Map(
  typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)
    ? cardDatabase.map(card=>[card.name,card])
    : []
);

const usage=new Map();
let totalDeckSlots=0;

chronology.forEach(item=>{
  const deck=Array.isArray(item.deck)?item.deck.filter(Boolean):[];
  totalDeckSlots+=deck.length;
  const unique=[...new Set(deck)];

  unique.forEach(name=>{
    const current=usage.get(name)||{name,appearances:0,wins:0,losses:0,matches:0,legendPoints:0};
    current.appearances++;
    current.legendPoints+=Number(item.legendPoints)||0;
    usage.set(name,current);
  });

  const draft=database.drafts.find(d=>Number(d.id)===Number(item.draftId));
  if(!draft)return;

  (draft.matches||[]).forEach(match=>{
    if(DraftStatsEngine.getMatchType(match,draft)!==DraftStatsEngine.MATCH_TYPES.PLAYED)return;
    if(match?.p1!==playerName&&match?.p2!==playerName)return;

    const outcome=DraftStatsEngine.getPlayerOutcome(match,draft,playerName);
    if(outcome!=="win"&&outcome!=="loss")return;

    unique.forEach(name=>{
      const current=usage.get(name);
      if(!current)return;
      current.matches++;
      if(outcome==="win")current.wins++;
      if(outcome==="loss")current.losses++;
    });
  });
});

const rows=[...usage.values()];
const signatureDeck=rows.slice().sort((a,b)=>
  b.appearances-a.appearances ||
  b.wins-a.wins ||
  b.legendPoints-a.legendPoints ||
  a.name.localeCompare(b.name,"pl")
).slice(0,12);

$("signatureDeckGrid").innerHTML=signatureDeck.length?signatureDeck.map((row,index)=>{
  const card=cardByName.get(row.name)||{};
  const cost=Number.isFinite(Number(card.cost))?card.cost:"?";
  const power=Number.isFinite(Number(card.power))?card.power:"?";

  return `<a class="fortress-card"
             href="card-stats.html?card=${encodeURIComponent(row.name)}"
             style="--delay:${(-index*.19).toFixed(2)}s"
             title="${esc(row.name)} · ${row.appearances} finalnych talii">
      <span class="fortress-card-number">#${index+1}</span>
      <span class="fortress-card-cost">${esc(cost)}</span>
      <span class="fortress-card-power">${esc(power)}</span>
      <span class="fortress-card-core"><span class="fortress-card-name">${esc(row.name)}</span></span>
      <span class="fortress-card-frequency">${row.appearances}× w finalnej talii</span>
    </a>`;
}).join(""):'<div class="signature-deck-empty">Brak wystarczających danych o finalnych taliach.</div>';

if($("signatureDeckSummary")){
  const top=signatureDeck[0];
  $("signatureDeckSummary").textContent=top
    ?`Najczęstsza karta: ${top.name} · ${top.appearances} ukończonych draftów.`
    :"Brak danych o finalnych taliach.";
}

/* Most common finish */
const finishCounts=new Map();
chronology.forEach(item=>{
  const place=Number(item.place);
  if(!Number.isFinite(place))return;
  finishCounts.set(place,(finishCounts.get(place)||0)+1);
});
const mostCommonFinish=[...finishCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]||null;

/* Longest card streak across the player's own appearances */
let loyalty={name:null,length:0,start:null,end:null};
const streakState=new Map();

chronology.forEach((item,index)=>{
  const set=new Set(Array.isArray(item.deck)?item.deck:[]);
  set.forEach(name=>{
    const previous=streakState.get(name);
    const next=previous&&previous.lastIndex===index-1
      ?{length:previous.length+1,start:previous.start,lastIndex:index}
      :{length:1,start:item.draftId,lastIndex:index};

    streakState.set(name,next);
    if(next.length>loyalty.length){
      loyalty={name,length:next.length,start:next.start,end:item.draftId};
    }
  });
});

/* Deck continuity/rebuild */
let biggestRebuild=null;
let strongestCore=null;

for(let i=1;i<chronology.length;i++){
  const before=chronology[i-1];
  const after=chronology[i];
  const a=new Set(Array.isArray(before.deck)?before.deck:[]);
  const b=new Set(Array.isArray(after.deck)?after.deck:[]);
  if(!a.size||!b.size)continue;

  const retained=[...a].filter(name=>b.has(name)).length;
  const base=Math.max(1,Math.min(a.size,b.size));
  const retainedShare=retained/base;

  if(!biggestRebuild||retainedShare<biggestRebuild.retainedShare){
    biggestRebuild={before,after,retained,base,retainedShare};
  }
  if(!strongestCore||retainedShare>strongestCore.retainedShare){
    strongestCore={before,after,retained,base,retainedShare};
  }
}

const uniqueCards=usage.size;
const diversityShare=totalDeckSlots?uniqueCards/totalDeckSlots:0;

const lore=[
  {
    label:"Różnorodność arsenału",
    value:`${uniqueCards} różnych kart`,
    sub:`${totalDeckSlots} miejsc w finalnych deckach · ${(diversityShare*100).toFixed(1)}% unikalnych nazw względem wszystkich slotów`
  },
  {
    label:"Najczęstsze miejsce",
    value:mostCommonFinish?`#${mostCommonFinish[0]} · ${mostCommonFinish[1]}×`:"Brak danych",
    sub:mostCommonFinish?"Najczęściej zajmowana końcowa pozycja w ukończonych draftach.":""
  },
  {
    label:"Najwierniejsza karta",
    value:loyalty.name||"Brak danych",
    sub:loyalty.name?`${loyalty.length} kolejnych własnych występów · D${loyalty.start} → D${loyalty.end}`:"Brak ciągłości decków"
  },
  {
    label:"Największa przebudowa talii",
    value:biggestRebuild?`D${biggestRebuild.before.draftId} → D${biggestRebuild.after.draftId}`:"Brak danych",
    sub:biggestRebuild?`Zachowane ${biggestRebuild.retained}/${biggestRebuild.base} kart między kolejnymi występami.`:"Za mało zapisanych decków"
  }
];

if(strongestCore&&chronology.length>2){
  lore.push({
    label:"Najtrwalszy rdzeń talii",
    value:`D${strongestCore.before.draftId} → D${strongestCore.after.draftId}`,
    sub:`Zachowane ${strongestCore.retained}/${strongestCore.base} kart między kolejnymi występami.`
  });
}

$("fortressLoreGrid").innerHTML=lore.map(item=>`
  <article class="fortress-lore-card">
    <span>${esc(item.label)}</span>
    <b>${esc(item.value)}</b>
    <small>${esc(item.sub||"")}</small>
  </article>
`).join("");

})();