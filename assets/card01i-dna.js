(function(){
"use strict";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[ch]));
const pct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(1)}%`:"—";
const signedPctPoints=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))return "—";
  return `${n>0?"+":""}${(n*100).toFixed(1)} pp`;
};

const params=new URLSearchParams(location.search);
const cardName=params.get("card");
if(!cardName||typeof cardDatabase==="undefined"||!Array.isArray(cardDatabase)||typeof database==="undefined"||!Array.isArray(database.drafts)||typeof DraftStatsEngine==="undefined")return;

const focal=cardDatabase.find(card=>card.name===cardName);
if(!focal)return;

const cardByName=new Map(cardDatabase.map(card=>[card.name,card]));
const tagMeta=new Map();
const categoryOrder=["series","abilityTypes","archetypes","subtypes","teams","themes","special"];

if(typeof TAGS!=="undefined"){
  categoryOrder.forEach(category=>{
    (TAGS[category]||[]).forEach(tag=>{
      tagMeta.set(tag.id,{...tag,category});
    });
  });
}

function isFinished(draft){
  return typeof DraftStatsEngine.isDraftFinished==="function"
    ?DraftStatsEngine.isDraftFinished(draft)
    :String(draft?.status||"").toLowerCase()==="finished";
}
function matchType(match,draft){
  return typeof DraftStatsEngine.getMatchType==="function"
    ?DraftStatsEngine.getMatchType(match,draft)
    :null;
}
function isPlayed(match,draft){
  const type=matchType(match,draft);
  return DraftStatsEngine.MATCH_TYPES?.PLAYED!==undefined
    ?type===DraftStatsEngine.MATCH_TYPES.PLAYED
    :type==="played";
}
function outcome(match,draft,player){
  if(typeof DraftStatsEngine.getPlayerOutcome==="function"){
    return DraftStatsEngine.getPlayerOutcome(match,draft,player);
  }
  return null;
}
function cardUrl(name){
  return "card-stats.html?card="+encodeURIComponent(name);
}

/* One entry per final deck containing the focal card. */
const deckEntries=[];
const finished=database.drafts.filter(isFinished).slice().sort((a,b)=>Number(a.id)-Number(b.id));

finished.forEach(draft=>{
  (draft.players||[]).forEach(player=>{
    const deck=Array.isArray(player.deck)?player.deck.filter(Boolean):[];
    const uniqueDeck=[...new Set(deck)];
    if(!uniqueDeck.includes(cardName))return;

    let wins=0,losses=0,matches=0;
    (draft.matches||[]).forEach(match=>{
      if(match?.p1!==player.name&&match?.p2!==player.name)return;
      if(!isPlayed(match,draft))return;
      const result=outcome(match,draft,player.name);
      if(result==="win"){wins++;matches++;}
      else if(result==="loss"){losses++;matches++;}
    });

    deckEntries.push({
      draftId:Number(draft.id),
      player:player.name,
      deck:uniqueDeck,
      companions:uniqueDeck.filter(name=>name!==cardName),
      wins,losses,matches
    });
  });
});

const totalDecks=deckEntries.length;

/* =========================================================
   TAG ENVIRONMENT
   Count a tag max once per final deck.
========================================================= */
const tagEnvironment=new Map();

deckEntries.forEach(entry=>{
  const seenTags=new Set();

  entry.companions.forEach(name=>{
    const card=cardByName.get(name);
    (card?.tags||[]).forEach(tagId=>{
      const meta=tagMeta.get(tagId);
      if(!meta||meta.category==="series"||meta.category==="special")return;
      seenTags.add(tagId);
    });
  });

  seenTags.forEach(tagId=>{
    const meta=tagMeta.get(tagId);
    const row=tagEnvironment.get(tagId)||{
      id:tagId,
      name:meta?.name||tagId,
      category:meta?.category||"unknown",
      decks:0,wins:0,losses:0,matches:0
    };
    row.decks++;
    row.wins+=entry.wins;
    row.losses+=entry.losses;
    row.matches+=entry.matches;
    tagEnvironment.set(tagId,row);
  });
});

const environmentRows=[...tagEnvironment.values()].map(row=>({
  ...row,
  coverage:totalDecks?row.decks/totalDecks:0,
  winRate:(row.wins+row.losses)?row.wins/(row.wins+row.losses):0
}));

function rowsFor(category,limit=6){
  return environmentRows
    .filter(row=>row.category===category)
    .sort((a,b)=>b.decks-a.decks||b.matches-a.matches||a.name.localeCompare(b.name,"pl"))
    .slice(0,limit);
}
function renderBars(target,rows){
  const root=$(target);
  if(!root)return;
  if(!rows.length){
    root.innerHTML='<div class="empty-01d">Brak wystarczającego środowiska tagowego.</div>';
    return;
  }
  root.innerHTML=rows.map(row=>`
    <div class="dna-bar-row">
      <span class="dna-bar-name" title="${esc(row.name)}">${esc(row.name)}</span>
      <div class="dna-bar-track"><div class="dna-bar-fill" style="width:${(row.coverage*100).toFixed(1)}%"></div></div>
      <span class="dna-bar-value">${pct(row.coverage)}</span>
    </div>
  `).join("");
}

renderBars("dnaArchetypes",rowsFor("archetypes",6));
renderBars("dnaSubtypes",rowsFor("subtypes",6));
renderBars("dnaAbilities",rowsFor("abilityTypes",6));

const themeRows=[
  ...environmentRows.filter(row=>row.category==="teams"),
  ...environmentRows.filter(row=>row.category==="themes")
].sort((a,b)=>b.decks-a.decks||b.matches-a.matches||a.name.localeCompare(b.name,"pl")).slice(0,6);
renderBars("dnaThemes",themeRows);

/* =========================================================
   HERO DNA FACTS
========================================================= */
const mostCommonEnv=environmentRows.slice().sort((a,b)=>
  b.decks-a.decks||
  b.matches-a.matches||
  a.name.localeCompare(b.name,"pl")
)[0]||null;

const wrThreshold=DraftStatsEngine.SAMPLE_THRESHOLDS?.GLOBAL_CARD_WR_MATCHES||5;
const bestQualifiedEnv=environmentRows
  .filter(row=>row.matches>=wrThreshold&&row.decks>=2)
  .sort((a,b)=>
    b.winRate-a.winRate||
    b.matches-a.matches||
    b.decks-a.decks||
    a.name.localeCompare(b.name,"pl")
  )[0]||null;

const uniquePartners=new Set(deckEntries.flatMap(entry=>entry.companions));
const uniqueArchetypes=environmentRows.filter(row=>row.category==="archetypes").length;

$("cardDnaHero").innerHTML=[
  {
    label:"Najczęstsze środowisko",
    value:mostCommonEnv?mostCommonEnv.name:"Brak danych",
    sub:mostCommonEnv?`${mostCommonEnv.decks}/${totalDecks} finalnych talii · ${pct(mostCommonEnv.coverage)}`:""
  },
  {
    label:"Najskuteczniejsze kwalifikowane środowisko",
    value:bestQualifiedEnv?bestQualifiedEnv.name:"Brak wymaganej próbki",
    sub:bestQualifiedEnv?`${bestQualifiedEnv.wins}W–${bestQualifiedEnv.losses}L · ${pct(bestQualifiedEnv.winRate)} WR`:`minimum ${wrThreshold} realnych meczów i 2 finalne talie`
  },
  {
    label:"Różnorodność partnerów",
    value:`${uniquePartners.size} kart`,
    sub:`Liczba różnych nazw kart, które historycznie dzieliły finalną talię z eksponatem.`
  },
  {
    label:"Zasięg archetypowy",
    value:`${uniqueArchetypes} archetypów`,
    sub:`Różne tagi archetypowe obecne w historycznym otoczeniu karty.`
  }
].map(item=>`
  <article class="dna-hero-card">
    <span>${esc(item.label)}</span>
    <b>${esc(item.value)}</b>
    <small>${esc(item.sub)}</small>
  </article>
`).join("");

/* =========================================================
   CORE PAIRS
   This replaces the redundant "top 4 partners" view.
========================================================= */
const pairMap=new Map();

deckEntries.forEach(entry=>{
  const companions=[...new Set(entry.companions)].sort((a,b)=>a.localeCompare(b,"pl"));
  for(let i=0;i<companions.length;i++){
    for(let j=i+1;j<companions.length;j++){
      const a=companions[i],b=companions[j];
      const key=`${a}|||${b}`;
      const row=pairMap.get(key)||{a,b,decks:0,drafts:new Set()};
      row.decks++;
      row.drafts.add(entry.draftId);
      pairMap.set(key,row);
    }
  }
});

const cores=[...pairMap.values()]
  .map(row=>({...row,draftCount:row.drafts.size}))
  .filter(row=>row.decks>=2)
  .sort((a,b)=>
    b.decks-a.decks||
    b.draftCount-a.draftCount||
    a.a.localeCompare(b.a,"pl")||
    a.b.localeCompare(b.b,"pl")
  )
  .slice(0,4);

const coCards=$("coCards");
if(coCards){
  coCards.className="dna-core-grid";
  coCards.innerHTML=cores.length?cores.map((row,index)=>`
    <article class="dna-core-card">
      <span class="dna-core-rank">RDZEŃ #${index+1}</span>
      <div class="dna-core-names">
        <a href="${cardUrl(row.a)}">${esc(row.a)}</a>
        <span class="dna-core-plus">+</span>
        <a href="${cardUrl(row.b)}">${esc(row.b)}</a>
      </div>
      <small>${row.decks} wspólnych finalnych talii · ${row.draftCount} draftów</small>
    </article>
  `).join(""):'<div class="empty-01d">Brak par powtarzających się w minimum 2 finalnych taliach.</div>';
}

/* =========================================================
   POPULARITY MOMENTUM
========================================================= */
const timeline=finished.map(draft=>{
  const playerCount=(draft.players||[]).length||Number(draft.playersCount)||0;
  const appearances=deckEntries.filter(entry=>entry.draftId===Number(draft.id)).length;
  return {
    draftId:Number(draft.id),
    appearances,
    playerCount,
    presence:playerCount?appearances/playerCount:0
  };
});

let biggestRise=null;
let biggestFall=null;

for(let i=1;i<timeline.length;i++){
  const before=timeline[i-1];
  const after=timeline[i];
  const delta=after.presence-before.presence;
  const row={before,after,delta};

  if(!biggestRise||delta>biggestRise.delta)biggestRise=row;
  if(!biggestFall||delta<biggestFall.delta)biggestFall=row;
}

const firstUsed=timeline.find(row=>row.appearances>0)||null;
const lastUsed=timeline.slice().reverse().find(row=>row.appearances>0)||null;

$("dnaMomentum").innerHTML=[
  {
    cls:"positive",
    label:"Największy skok popularności",
    value:biggestRise?signedPctPoints(biggestRise.delta):"—",
    sub:biggestRise?`D${biggestRise.before.draftId} → D${biggestRise.after.draftId}`:"Brak kolejnych edycji"
  },
  {
    cls:"negative",
    label:"Największy spadek popularności",
    value:biggestFall?signedPctPoints(biggestFall.delta):"—",
    sub:biggestFall?`D${biggestFall.before.draftId} → D${biggestFall.after.draftId}`:"Brak kolejnych edycji"
  },
  {
    cls:"",
    label:"Pierwsza ekspozycja",
    value:firstUsed?`D${firstUsed.draftId}`:"Nigdy",
    sub:firstUsed?`${firstUsed.appearances}/${firstUsed.playerCount} finalnych talii`:"Brak historycznego występu"
  },
  {
    cls:"",
    label:"Ostatnia ekspozycja",
    value:lastUsed?`D${lastUsed.draftId}`:"Nigdy",
    sub:lastUsed?`${lastUsed.appearances}/${lastUsed.playerCount} finalnych talii`:"Brak historycznego występu"
  }
].map(item=>`
  <article class="dna-momentum-card ${item.cls}">
    <span>${esc(item.label)}</span>
    <b>${esc(item.value)}</b>
    <small>${esc(item.sub)}</small>
  </article>
`).join("");

})();