(function(){
"use strict";

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const playerName=params.get("name");

const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[ch]));
const attr=value=>esc(value).replace(/`/g,"&#096;");
const pct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(1)}%`:"—";
const num=(value,digits=0)=>Number.isFinite(Number(value))?Number(value).toFixed(digits):"—";
const recordText=row=>row?`${row.wins}W–${row.losses}L · ${pct(row.winRate)}`:"—";

if(typeof database==="undefined"||!Array.isArray(database.drafts)||typeof DraftStatsEngine==="undefined"){
  $("playerName").textContent="Błąd danych";
  return;
}

const profile=playerName?DraftStatsEngine.calculatePlayerProfile(database.drafts,playerName):null;
$("playerName").textContent=playerName||"Nieznany Wojownik";
$("playerScanName").textContent=playerName||"WOJOWNIK";

const hero=PlayerVisuals.getHero(playerName||"");
if(hero){
  $("heroCharacter").src=hero.file;
  $("heroSignature").textContent="AKTYWNY PROFIL WOJOWNIKA · DANE HISTORYCZNE";
  $("profileStage").setAttribute("style",PlayerVisuals.heroStyle(hero));
}

function empty(id,message){
  const node=$(id);
  if(node) node.innerHTML=`<div class="empty-note-02a">${esc(message)}</div>`;
}

if(!profile){
  $("rank").textContent="Brak kanonicznych danych";
  ["signatureMain","signatureFacts","careerGrid","recordGrid","rivalGrid","draftHistory","arsenalGrid","achievementGrid"]
    .forEach(id=>empty(id,"Brak danych tego wojownika w ukończonych draftach."));
  return;
}

const s=profile.summary;
const r=profile.records||{};
const rivals=profile.rivalries||{};
const history=(profile.history||[]).slice().sort((a,b)=>Number(b.draftId)-Number(a.draftId));
const chronology=(profile.history||[]).slice().sort((a,b)=>Number(a.draftId)-Number(b.draftId));

const rankText=s.legendRank?`#${s.legendRank} RANKINGU LEGEND`:"POZA RANKINGIEM";
$("rank").innerHTML=`${rankText} · <span class="legend-star">✦</span> ${s.legendPoints} PUNKTÓW LEGEND`;
$("dRank").textContent=s.legendRank?`#${s.legendRank}`:"—";
$("dLegend").innerHTML=`<span class="legend-star">✦</span> ${s.legendPoints}`;
$("dDrafts").textContent=s.drafts;
$("dWr").textContent=pct(s.playedWinRate);

$("quickStrip").innerHTML=[
  ["Tytuły",s.draftWins],
  ["Podia",s.podiums],
  ["Bilans",`${s.playedWins}–${s.playedLosses}`],
  ["Mecze",s.playedMatches],
  ["Punkty draftowe",s.draftPoints]
].map(([label,value])=>`<div class="quick-stat"><b>${value}</b><span>${label}</span></div>`).join("");

/* Karty gracza */
const cardByName=new Map(
  typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)
    ? cardDatabase.map(card=>[card.name,card])
    : []
);

const usage={};
chronology.forEach(item=>{
  const unique=[...new Set(Array.isArray(item.deck)?item.deck:[])];
  unique.forEach(name=>{
    if(!usage[name]){
      usage[name]={name,appearances:0,matches:0,wins:0,losses:0,podiumDecks:0,titleDecks:0,legendPoints:0};
    }
    const stat=usage[name];
    stat.appearances++;
    if(Number(item.place)>=1&&Number(item.place)<=3)stat.podiumDecks++;
    if(item.isWinner)stat.titleDecks++;
    stat.legendPoints+=Number(item.legendPoints)||0;
  });

  const draft=database.drafts.find(d=>Number(d.id)===Number(item.draftId));
  if(!draft)return;

  (draft.matches||[]).forEach(match=>{
    if(DraftStatsEngine.getMatchType(match,draft)!==DraftStatsEngine.MATCH_TYPES.PLAYED)return;
    const outcome=DraftStatsEngine.getPlayerOutcome(match,draft,playerName);
    if(outcome!=="win"&&outcome!=="loss")return;

    unique.forEach(name=>{
      const stat=usage[name];
      if(!stat)return;
      stat.matches++;
      if(outcome==="win")stat.wins++;
      if(outcome==="loss")stat.losses++;
    });
  });
});

const cardRows=Object.values(usage).map(row=>({
  ...row,
  winRate:DraftStatsEngine.calculateWinRate(row.wins,row.losses)
}));

const mostUsed=cardRows.slice().sort((a,b)=>
  b.appearances-a.appearances||b.legendPoints-a.legendPoints||a.name.localeCompare(b.name,"pl")
)[0]||null;

const minMatches=DraftStatsEngine.SAMPLE_THRESHOLDS?.GLOBAL_CARD_WR_MATCHES||5;
const bestCard=cardRows.filter(row=>row.matches>=minMatches).slice().sort((a,b)=>
  b.winRate-a.winRate||b.matches-a.matches||b.wins-a.wins||a.name.localeCompare(b.name,"pl")
)[0]||null;

const mostWinsCard=cardRows.slice().sort((a,b)=>
  b.wins-a.wins||b.matches-a.matches||b.winRate-a.winRate||a.name.localeCompare(b.name,"pl")
)[0]||null;

const legendaryCard=cardRows.slice().sort((a,b)=>
  b.legendPoints-a.legendPoints||b.titleDecks-a.titleDecks||b.podiumDecks-a.podiumDecks||
  b.appearances-a.appearances||a.name.localeCompare(b.name,"pl")
)[0]||null;

const mostFrequentRival=(rivals.rivals||[])[0]||null;

/* Sygnatura kariery */
const bestPerformance=r.bestFinish||chronology[0]||null;

$("signatureMain").innerHTML=`
  <div class="signature-rank">${s.legendRank?`#${s.legendRank} RANKING LEGEND`:"POZA RANKINGIEM"}</div>
  <div class="signature-legend"><span class="legend-star">✦</span> ${s.legendPoints} Punktów Legend</div>
  <div class="signature-line">${s.drafts} ukończonych draftów · ${s.podiums} podiów · ${pct(s.playedWinRate)} WR w ${s.playedMatches} realnych meczach</div>
`;

const signatureFacts=[
  {
    label:"Najlepszy występ",
    value:bestPerformance?`D${bestPerformance.draftId} · #${bestPerformance.place}`:"—",
    sub:bestPerformance?`${bestPerformance.points} pkt · ${bestPerformance.wins}W–${bestPerformance.losses}L`:""
  },
  {
    label:"Najczęstszy rywal",
    value:mostFrequentRival?mostFrequentRival.name:"—",
    sub:mostFrequentRival?`${mostFrequentRival.matches} meczów · ${recordText(mostFrequentRival)}`:"Brak realnych pojedynków"
  },
  {
    label:"Karta sygnaturowa",
    value:mostUsed?mostUsed.name:"—",
    sub:mostUsed?`${mostUsed.appearances} finalnych talii · ${mostUsed.wins} zwycięstw`:"Brak zapisanych talii"
  },
  {
    label:"Najdłuższa seria",
    value:`${profile.streaks?.longestWinStreak?.length||0} zwycięstw`,
    sub:profile.streaks?.longestWinStreak?.length
      ?`D${profile.streaks.longestWinStreak.startDraftId} → D${profile.streaks.longestWinStreak.endDraftId}`
      :"Brak serii"
  }
];

$("signatureFacts").innerHTML=signatureFacts.map(f=>`
  <div class="signature-fact">
    <b>${esc(f.label)}</b><span>${esc(f.value)}</span>${f.sub?`<small>${esc(f.sub)}</small>`:""}
  </div>
`).join("");

/* Kariera */
const career=[
  {
    cls:"legend",label:"Punkty Legend",value:`✦ ${s.legendPoints}`,
    sub:s.legendRank?`#${s.legendRank} w Rankingu Legend`:"Poza rankingiem"
  },
  {label:"Ukończone drafty",value:s.drafts,sub:`${s.draftWins} tytułów · ${s.podiums} podiów`},
  {label:"Realny bilans",value:`${s.playedWins}W–${s.playedLosses}L`,sub:`${pct(s.playedWinRate)} WR · ${s.playedMatches} meczów`},
  {label:"Punkty draftowe",value:s.draftPoints,sub:`średnio ${num(s.averageDraftPoints,1)} / draft`},
  {label:"Średnie miejsce",value:s.averageFinish===null?"—":`#${num(s.averageFinish,2)}`,sub:`${pct(s.podiumRate)} draftów na podium`},
  {label:"Punkty w porażkach",value:s.lossPoints,sub:"punkty draftowe zdobyte w przegranych meczach"}
];

$("careerGrid").innerHTML=career.map(item=>`
  <article class="career-card ${item.cls||""}">
    <span class="metric-label">${esc(item.label)}</span>
    <span class="metric-value">${esc(item.value)}</span>
    <span class="metric-sub">${esc(item.sub||"")}</span>
  </article>
`).join("");

/* Rekordy */
const highest=r.highestPointsDraft;
const mostWins=r.mostWinsDraft;
const bestWR=r.bestWinRateDraft;
const bestFinish=r.bestFinish;

const records=[
  {
    label:"Najwięcej punktów",
    value:highest?`${highest.points} pkt · D${highest.draftId}`:"—",
    sub:highest?`${highest.wins}W–${highest.losses}L · #${highest.place}`:""
  },
  {
    label:"Najwięcej zwycięstw",
    value:mostWins?`${mostWins.wins} · D${mostWins.draftId}`:"—",
    sub:mostWins?`${pct(mostWins.winRate)} WR · ${mostWins.points} pkt`:""
  },
  {
    label:"Najlepszy WR w edycji",
    value:bestWR?`${pct(bestWR.winRate)} · D${bestWR.draftId}`:"—",
    sub:bestWR?`${bestWR.wins}W–${bestWR.losses}L · #${bestWR.place}`:""
  },
  {
    label:"Najlepsze miejsce",
    value:bestFinish?`#${bestFinish.place} · D${bestFinish.draftId}`:"—",
    sub:bestFinish?`${r.bestFinishCount||1}× osiągnięte · ${bestFinish.points} pkt`:""
  },
  {
    label:"Najdłuższa seria zwycięstw",
    value:`${profile.streaks?.longestWinStreak?.length||0}`,
    sub:profile.streaks?.longestWinStreak?.length
      ?`D${profile.streaks.longestWinStreak.startDraftId} → D${profile.streaks.longestWinStreak.endDraftId}`
      :"Brak serii"
  },
  {
    label:"Czyste zwycięstwa",
    value:profile.battle?.cleanWins||0,
    sub:`z ${profile.battle?.eligibleMatches||0} meczów kwalifikowanych do statystyk Battle`
  }
];

$("recordGrid").innerHTML=records.map(item=>`
  <article class="record-card">
    <span class="record-label">${esc(item.label)}</span>
    <span class="record-value">${esc(item.value)}</span>
    <span class="record-sub">${esc(item.sub||"")}</span>
  </article>
`).join("");

/* Rywalizacje */
const rivalDefs=[
  ["Arcyrival","Najczęściej spotykany przeciwnik",rivals.archrival],
  ["Pogromca","Najwyższy WR w kwalifikowanej rywalizacji",rivals.dominatedOpponent],
  ["Nemezis","Najtrudniejszy kwalifikowany rywal",rivals.nemesis],
  ["Najbardziej wyrównany","Bilans najbliższy 50/50",rivals.closestRival]
];

function rivalCard(type,description,row){
  if(!row){
    return `<article class="rival-card"><span class="rival-type">${esc(type)}</span><div class="empty-note-02a">Za mało rozegranych meczów.</div></article>`;
  }
  return `<article class="rival-card">
    <span class="rival-type">${esc(type)} · ${esc(description)}</span>
    <div class="rival-versus">
      <div class="rival-player">${esc(playerName)}</div>
      <div class="vs-orb">VS</div>
      <div class="rival-opponent">${esc(row.name)}</div>
    </div>
    <div class="rival-result">
      <span><b>${row.wins}–${row.losses}</b>Bilans</span>
      <span><b>${pct(row.winRate)}</b>WR</span>
      <span><b>${row.matches}</b>Mecze</span>
    </div>
  </article>`;
}

$("rivalGrid").innerHTML=rivalDefs.map(def=>rivalCard(...def)).join("");

/* Historia draftów */
function sanitizeDeckOwner(name){
  return String(name||"").toLowerCase().replace(/ /g,"").replace(/\./g,"");
}
function deckImagePath(name,draftId){
  return `assets/decks/${sanitizeDeckOwner(name)}_${draftId}.jpg`;
}
function medalLabel(item){
  if(item.isWinner)return "MISTRZ";
  if(Number(item.place)===2)return "II MIEJSCE";
  if(Number(item.place)===3)return "III MIEJSCE";
  return "";
}

$("draftHistory").innerHTML=history.length?history.map(item=>{
  const medal=medalLabel(item);
  const deckNames=(item.deck||[]).join(" · ");
  return `<a class="draft-history-card" href="draft.html?id=${encodeURIComponent(item.draftId)}">
    <div class="draft-thumb">
      <img src="${attr(deckImagePath(playerName,item.draftId))}"
           alt="Talia ${attr(playerName)} — Draft ${attr(item.draftId)}"
           loading="lazy"
           onerror="this.closest('.draft-history-card').classList.add('no-image');this.remove()">
      <span class="draft-badge">D${esc(item.draftId)}</span>
      ${medal?`<span class="draft-medal">${medal}</span>`:""}
    </div>
    <div class="draft-body">
      <div class="draft-place">#${esc(item.place||"?")} · ${esc(item.points)} pkt</div>
      <div class="draft-core">
        <span><b>${esc(item.wins)}–${esc(item.losses)}</b>Bilans</span>
        <span><b>${pct(item.winRate)}</b>WR</span>
        <span><b>${esc(item.matches)}</b>Mecze</span>
      </div>
      <div class="draft-legend-award">${Number(item.legendPoints)>0?`✦ +${esc(item.legendPoints)} Punktów Legend`:"Bez Punktów Legend"}</div>
      <div class="draft-deck-fallback">${esc(deckNames||"Brak zapisanego składu talii")}</div>
    </div>
  </a>`;
}).join(""):`<div class="empty-note-02a">Brak ukończonych draftów tego wojownika.</div>`;

/* Arsenał */
function arsenalCard(kind,row,metric,sub){
  if(!row){
    return `<div class="arsenal-card"><div class="arsenal-body"><span class="arsenal-kind">${esc(kind)}</span><span class="arsenal-metric">Brak danych</span><span class="arsenal-sub">${esc(sub||"")}</span></div></div>`;
  }

  const card=cardByName.get(row.name)||{};
  const cost=Number.isFinite(Number(card.cost))?card.cost:"?";
  const power=Number.isFinite(Number(card.power))?card.power:"?";

  return `<a class="arsenal-card" href="card-stats.html?card=${encodeURIComponent(row.name)}">
    <div class="arsenal-card-top">
      <span class="arsenal-cost">${esc(cost)}</span>
      <span class="arsenal-power">${esc(power)}</span>
      <span class="arsenal-name">${esc(row.name)}</span>
    </div>
    <div class="arsenal-body">
      <span class="arsenal-kind">${esc(kind)}</span>
      <span class="arsenal-metric">${esc(metric)}</span>
      <span class="arsenal-sub">${esc(sub||"")}</span>
    </div>
  </a>`;
}

$("arsenalGrid").innerHTML=[
  arsenalCard(
    "Najczęstsza karta",
    mostUsed,
    mostUsed?`${mostUsed.appearances} finalnych talii`:"—",
    mostUsed?`${mostUsed.wins}W–${mostUsed.losses}L · ${mostUsed.matches} realnych meczów`:""
  ),
  arsenalCard(
    "Najskuteczniejsza karta",
    bestCard,
    bestCard?`${pct(bestCard.winRate)} WR`:"—",
    bestCard?`${bestCard.wins}W–${bestCard.losses}L · ${bestCard.matches} meczów`:`Minimum ${minMatches} realnych meczów`
  ),
  arsenalCard(
    "Najwięcej zwycięstw",
    mostWinsCard,
    mostWinsCard?`${mostWinsCard.wins} zwycięstw`:"—",
    mostWinsCard?`${pct(mostWinsCard.winRate)} WR · ${mostWinsCard.appearances} talii`:""
  ),
  arsenalCard(
    "Najwięcej ✦ z graczem",
    legendaryCard,
    legendaryCard?`✦ ${legendaryCard.legendPoints}`:"—",
    legendaryCard?`${legendaryCard.titleDecks} tytułów · ${legendaryCard.podiumDecks} podiów z kartą`:""
  )
].join("");

const topArsenal=cardRows.slice().sort((a,b)=>
  b.appearances-a.appearances||b.wins-a.wins||a.name.localeCompare(b.name,"pl")
).slice(0,12);

$("arsenalChips").innerHTML=topArsenal.map(row=>
  `<a class="arsenal-chip" href="card-stats.html?card=${encodeURIComponent(row.name)}">${esc(row.name)} · ${row.appearances} talii</a>`
).join("");

/* Osiągnięcia — tylko realne wydarzenia */
const achievements=[];

chronology.forEach(item=>{
  if(item.isWinner){
    achievements.push({
      cls:"title",
      title:`Mistrz Draftu ${item.draftId}`,
      sub:`#1 · ${item.points} pkt · ${item.wins}W–${item.losses}L`
    });
  }else if(Number(item.place)===2||Number(item.place)===3){
    achievements.push({
      cls:"",
      title:`Podium Draftu ${item.draftId}`,
      sub:`#${item.place} · ${item.points} pkt · ${item.wins}W–${item.losses}L`
    });
  }
});

if(r.highestPointsDraft){
  achievements.push({
    cls:"",
    title:"Rekord punktowy kariery",
    sub:`D${r.highestPointsDraft.draftId} · ${r.highestPointsDraft.points} pkt`
  });
}

if((profile.streaks?.longestWinStreak?.length||0)>1){
  achievements.push({
    cls:"",
    title:`Seria ${profile.streaks.longestWinStreak.length} zwycięstw`,
    sub:`D${profile.streaks.longestWinStreak.startDraftId} → D${profile.streaks.longestWinStreak.endDraftId}`
  });
}

if((profile.battle?.cleanWins||0)>0){
  achievements.push({
    cls:"",
    title:`Czyste zwycięstwa: ${profile.battle.cleanWins}`,
    sub:"Konkretny wynik w statystykach Snap Battle"
  });
}

$("achievementGrid").innerHTML=achievements.length?achievements.map(item=>`
  <article class="achievement ${item.cls}">
    <b>${esc(item.title)}</b>
    <small>${esc(item.sub)}</small>
  </article>
`).join(""):`<div class="empty-note-02a">Brak zapisanych osiągnięć historycznych.</div>`;

/* Dopasowanie nicku w skanerze */
function fitPlayerScanName(){
  const el=$("playerScanName");
  if(!el)return;
  let size=15,min=8;
  el.style.fontSize=size+"px";
  const available=Math.max(0,el.parentElement.clientWidth*.72);
  while(size>min&&el.scrollWidth>available){
    size-=1;
    el.style.fontSize=size+"px";
  }
}

requestAnimationFrame(fitPlayerScanName);
window.addEventListener("resize",()=>requestAnimationFrame(fitPlayerScanName));

})();