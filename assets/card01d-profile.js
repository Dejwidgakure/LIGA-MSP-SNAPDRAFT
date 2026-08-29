(function(){
"use strict";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[ch]));
const pct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(1)}%`:"—";
const one=value=>Number.isFinite(Number(value))?Number(value).toFixed(1):"—";

const params=new URLSearchParams(location.search);
const cardName=params.get("card");
if(!cardName||typeof database==="undefined"||!Array.isArray(database.drafts)||typeof cardDatabase==="undefined"||!Array.isArray(cardDatabase)||typeof DraftStatsEngine==="undefined")return;

const focalCard=cardDatabase.find(c=>c.name===cardName);
if(!focalCard)return;

const cardByName=new Map(cardDatabase.map(c=>[c.name,c]));
const calculatedProfile=DraftStatsEngine.calculateCardProfile(database.drafts,cardDatabase,cardName);
const profile=calculatedProfile||{
  summary:{appearances:0,drafts:0,owners:0,matches:0,wins:0,losses:0,winRate:0,legendPoints:0,draftPoints:0,averageDraftPoints:0,draftWins:0,podiums:0,top5:0},
  history:[],partners:[],records:{},rivalries:{}
};

function isFinished(draft){
  if(typeof DraftStatsEngine.isDraftFinished==="function")return DraftStatsEngine.isDraftFinished(draft);
  return String(draft?.status||"").toLowerCase()==="finished";
}
function matchType(match,draft){
  if(typeof DraftStatsEngine.getMatchType==="function")return DraftStatsEngine.getMatchType(match,draft);
  if(match?.walkover||match?.doubleWalkover)return "walkover";
  return Number.isFinite(Number(match?.pts1))&&Number.isFinite(Number(match?.pts2))?"played":"unknown";
}
function isPlayed(match,draft){
  const type=matchType(match,draft);
  if(DraftStatsEngine.MATCH_TYPES?.PLAYED!==undefined)return type===DraftStatsEngine.MATCH_TYPES.PLAYED;
  return type==="played";
}
function outcome(match,draft,player){
  if(typeof DraftStatsEngine.getPlayerOutcome==="function")return DraftStatsEngine.getPlayerOutcome(match,draft,player);
  const p1=match?.p1===player,p2=match?.p2===player;
  if(!p1&&!p2)return null;
  const a=Number(p1?match.pts1:match.pts2);
  const b=Number(p1?match.pts2:match.pts1);
  if(!Number.isFinite(a)||!Number.isFinite(b))return null;
  return a>b?"win":a<b?"loss":"draw";
}
function playerPoints(match,player){
  if(match?.p1===player)return Number(match.pts1)||0;
  if(match?.p2===player)return Number(match.pts2)||0;
  return 0;
}
function legendForPlace(place){
  return ({1:8,2:4,3:3,4:2,5:1})[Number(place)]||0;
}
function sanitizeDeckOwner(name){
  return String(name||"").toLowerCase().replace(/ /g,"").replace(/\./g,"");
}
function playerUrl(name){return "player.html?name="+encodeURIComponent(name);}
function cardUrl(name){return "card-stats.html?card="+encodeURIComponent(name);}

/* Place lookup from canonical card profile history. */
const placeLookup=new Map();
(profile.history||[]).forEach(row=>{
  (row.places||[]).forEach(p=>{
    placeLookup.set(`${Number(row.id)}|||${p.player}`,Number(p.place));
  });
});

/* Build one entry per final deck that contains the card. */
const deckEntries=[];
const finished=database.drafts.filter(isFinished).slice().sort((a,b)=>Number(a.id)-Number(b.id));

finished.forEach(draft=>{
  (draft.players||[]).forEach(player=>{
    const deck=Array.isArray(player.deck)?player.deck.filter(Boolean):[];
    if(!new Set(deck).has(cardName))return;

    let wins=0,losses=0,draws=0,matches=0,points=0;
    (draft.matches||[]).forEach(match=>{
      if(match?.p1!==player.name&&match?.p2!==player.name)return;
      if(Number.isFinite(Number(match.pts1))&&Number.isFinite(Number(match.pts2))){
        points+=playerPoints(match,player.name);
      }
      if(!isPlayed(match,draft))return;
      const o=outcome(match,draft,player.name);
      if(o==="win"){wins++;matches++;}
      else if(o==="loss"){losses++;matches++;}
      else if(o==="draw"){draws++;matches++;}
    });

    const place=placeLookup.get(`${Number(draft.id)}|||${player.name}`)??null;
    deckEntries.push({
      draftId:Number(draft.id),
      player:player.name,
      playerCount:(draft.players||[]).length||Number(draft.playersCount)||0,
      deck,
      place,
      wins,losses,draws,matches,points,
      winRate:(wins+losses)>0?wins/(wins+losses):0,
      legendPoints:legendForPlace(place),
      isWinner:Number(place)===1||draft.winner===player.name
    });
  });
});

/* =========================================================
   TRAJECTORY ACROSS ALL FINISHED DRAFTS
========================================================= */
const timeline=finished.map(draft=>{
  const rows=deckEntries.filter(x=>x.draftId===Number(draft.id));
  const wins=rows.reduce((s,x)=>s+x.wins,0);
  const losses=rows.reduce((s,x)=>s+x.losses,0);
  const matches=wins+losses;
  const totalPlayers=(draft.players||[]).length||Number(draft.playersCount)||0;
  const places=rows.map(x=>x.place).filter(Number.isFinite);
  return {
    draftId:Number(draft.id),
    appearances:rows.length,
    totalPlayers,
    presence:totalPlayers?rows.length/totalPlayers:0,
    wins,losses,matches,
    winRate:matches?wins/matches:null,
    legendPoints:rows.reduce((s,x)=>s+x.legendPoints,0),
    avgPlace:places.length?places.reduce((s,x)=>s+x,0)/places.length:null
  };
});

function trajectorySvg(rows){
  if(!rows.length)return '<div class="empty-01d">Brak ukończonych draftów.</div>';

  const width=Math.max(920,rows.length*54);
  const height=320;
  const pad={l:49,r:52,t:24,b:42};
  const innerW=width-pad.l-pad.r;
  const innerH=height-pad.t-pad.b;
  const xPos=i=>rows.length===1?pad.l+innerW/2:pad.l+i/(rows.length-1)*innerW;
  const yVal=v=>pad.t+innerH-(Number(v)||0)*innerH;
  const barW=Math.min(20,Math.max(7,innerW/Math.max(1,rows.length)*.38));

  const grid=[];
  for(let i=0;i<=4;i++){
    const value=1-i/4;
    const yy=pad.t+i/4*innerH;
    grid.push(`<line class="ct-grid" x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}"></line>`);
    grid.push(`<text class="ct-axis" x="${pad.l-7}" y="${yy+3}" text-anchor="end">${Math.round(value*100)}%</text>`);
    grid.push(`<text class="ct-axis" x="${width-pad.r+7}" y="${yy+3}" text-anchor="start">${Math.round(value*100)}%</text>`);
  }

  const bars=rows.map((row,i)=>{
    const yy=yVal(row.presence);
    return `<rect class="ct-presence" x="${xPos(i)-barW/2}" y="${yy}" width="${barW}" height="${pad.t+innerH-yy}" rx="3"></rect>`;
  }).join("");

  const wrPoints=rows.map((row,i)=>row.winRate===null?null:{i,value:row.winRate}).filter(Boolean);
  const path=wrPoints.map((point,j)=>`${j?"L":"M"} ${xPos(point.i).toFixed(1)} ${yVal(point.value).toFixed(1)}`).join(" ");
  const dots=rows.map((row,i)=>row.winRate===null
    ?`<circle class="ct-empty-dot" cx="${xPos(i)}" cy="${yVal(0)}" r="2.5"></circle>`
    :`<circle class="ct-wr-dot" cx="${xPos(i)}" cy="${yVal(row.winRate)}" r="4"></circle>`
  ).join("");

  const labelStep=rows.length>22?2:1;
  const labels=rows.map((row,i)=>i%labelStep===0
    ?`<text class="ct-draft" x="${xPos(i)}" y="${height-15}" text-anchor="middle">D${row.draftId}</text>`
    :""
  ).join("");

  const hitW=Math.max(29,innerW/Math.max(1,rows.length));
  const hits=rows.map((row,i)=>
    `<rect class="ct-hit" data-index="${i}" x="${xPos(i)-hitW/2}" y="${pad.t}" width="${hitW}" height="${innerH}"></rect>`
  ).join("");

  return `<svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px" aria-label="Trajektoria karty ${esc(cardName)}">
    <defs>
      <linearGradient id="cardPresenceGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#63fff2"></stop>
        <stop offset="100%" stop-color="#476dff"></stop>
      </linearGradient>
    </defs>
    ${grid.join("")}
    ${bars}
    ${path?`<path class="ct-wr-line" d="${path}"></path>`:""}
    ${dots}
    ${labels}
    ${hits}
  </svg>`;
}

$("cardTrajectoryChart").innerHTML=trajectorySvg(timeline);

const tooltip=document.createElement("div");
tooltip.className="card-chart-tooltip";
document.body.appendChild(tooltip);

$("cardTrajectoryChart").addEventListener("mousemove",event=>{
  const hit=event.target.closest(".ct-hit");
  if(!hit){tooltip.style.display="none";return;}
  const row=timeline[Number(hit.dataset.index)];
  if(!row)return;
  tooltip.innerHTML=`<b>D${row.draftId}</b>
    ${row.appearances}/${row.totalPlayers} finalnych talii · ${pct(row.presence)} popularności<br>
    ${row.matches?`${row.wins}W–${row.losses}L · ${pct(row.winRate)} WR`:"Brak realnych meczów z kartą"}<br>
    ✦ ${row.legendPoints}${row.avgPlace!==null?` · śr. miejsce #${one(row.avgPlace)}`:""}`;
  tooltip.style.display="block";
  tooltip.style.left=`${event.clientX+14}px`;
  tooltip.style.top=`${event.clientY+14}px`;
});
$("cardTrajectoryChart").addEventListener("mouseleave",()=>{tooltip.style.display="none";});

const activeTimeline=timeline.filter(x=>x.appearances>0);
const peakPopularity=activeTimeline.slice().sort((a,b)=>b.presence-a.presence||b.appearances-a.appearances||b.draftId-a.draftId)[0]||null;
const threshold=DraftStatsEngine.SAMPLE_THRESHOLDS?.GLOBAL_CARD_WR_MATCHES||5;
const bestWrEra=activeTimeline.filter(x=>x.matches>=threshold).slice().sort((a,b)=>b.winRate-a.winRate||b.matches-a.matches||b.draftId-a.draftId)[0]||null;
const bestLegendEra=activeTimeline.slice().sort((a,b)=>b.legendPoints-a.legendPoints||b.presence-a.presence||b.draftId-a.draftId)[0]||null;

let longestRun={length:0,start:null,end:null};
let currentRun={length:0,start:null,end:null};
timeline.forEach(row=>{
  if(row.appearances>0){
    if(currentRun.length===0)currentRun.start=row.draftId;
    currentRun.length++;
    currentRun.end=row.draftId;
    if(currentRun.length>longestRun.length)longestRun={...currentRun};
  }else{
    currentRun={length:0,start:null,end:null};
  }
});

$("cardTrendFacts").innerHTML=[
  {
    label:"Szczyt popularności",
    value:peakPopularity?`D${peakPopularity.draftId} · ${pct(peakPopularity.presence)}`:"—",
    sub:peakPopularity?`${peakPopularity.appearances}/${peakPopularity.totalPlayers} finalnych talii`:"Brak danych"
  },
  {
    label:"Najlepsza kwalifikowana edycja WR",
    value:bestWrEra?`D${bestWrEra.draftId} · ${pct(bestWrEra.winRate)}`:"Brak próbki",
    sub:bestWrEra?`${bestWrEra.wins}W–${bestWrEra.losses}L · ${bestWrEra.matches} meczów`:`minimum ${threshold} realnych meczów`
  },
  {
    label:"Największy łup Legend",
    value:bestLegendEra?`D${bestLegendEra.draftId} · ✦ ${bestLegendEra.legendPoints}`:"—",
    sub:bestLegendEra?`${bestLegendEra.appearances} finalnych talii z kartą`:"Brak danych"
  },
  {
    label:"Najdłuższa ciągła ekspozycja",
    value:`${longestRun.length} draftów`,
    sub:longestRun.length?`D${longestRun.start} → D${longestRun.end}`:"Brak serii"
  }
].map(item=>`<article class="card-trend-fact"><span>${esc(item.label)}</span><b>${esc(item.value)}</b><small>${esc(item.sub)}</small></article>`).join("");

/* =========================================================
   FINISH DISTRIBUTION
========================================================= */
const placements=deckEntries.map(x=>x.place).filter(Number.isFinite);
const placeCounts=new Map();
placements.forEach(p=>placeCounts.set(p,(placeCounts.get(p)||0)+1));

const buckets=[
  ["#1",placeCounts.get(1)||0],
  ["#2",placeCounts.get(2)||0],
  ["#3",placeCounts.get(3)||0],
  ["#4",placeCounts.get(4)||0],
  ["#5",placeCounts.get(5)||0],
  ["> #5",placements.filter(p=>p>5).length]
];
const maxCount=Math.max(1,...buckets.map(x=>x[1]));
const avgFinish=placements.length?placements.reduce((s,x)=>s+x,0)/placements.length:null;
const podiums=placements.filter(p=>p<=3).length;
const titles=placements.filter(p=>p===1).length;

$("cardFinishSummary").innerHTML=`
  <article class="card-finish-summary-card"><b>${avgFinish===null?"—":`#${one(avgFinish)}`}</b><span>Średnie miejsce</span></article>
  <article class="card-finish-summary-card"><b>${pct(placements.length?podiums/placements.length:0)}</b><span>Występów na podium</span></article>
  <article class="card-finish-summary-card"><b>${pct(placements.length?titles/placements.length:0)}</b><span>Występów zakończonych #1</span></article>
  <article class="card-finish-summary-card"><b>${placements.length}</b><span>Sklasyfikowanych talii</span></article>
`;

$("cardFinishDistribution").innerHTML=buckets.map(([label,count])=>`
  <div class="card-finish-row">
    <span class="card-finish-label">${label}</span>
    <div class="card-finish-track"><div class="card-finish-fill" style="width:${(count/maxCount*100).toFixed(1)}%"></div></div>
    <span class="card-finish-count">${count}</span>
  </div>
`).join("");

/* =========================================================
   FULL PILOT GALLERY
========================================================= */
const pilots=new Map();
deckEntries.forEach(entry=>{
  const row=pilots.get(entry.player)||{
    name:entry.player,appearances:0,drafts:new Set(),wins:0,losses:0,matches:0,legendPoints:0
  };
  row.appearances++;
  row.drafts.add(entry.draftId);
  row.wins+=entry.wins;
  row.losses+=entry.losses;
  row.matches+=entry.matches;
  row.legendPoints+=entry.legendPoints;
  pilots.set(entry.player,row);
});

const pilotRows=[...pilots.values()].map(row=>({
  ...row,
  draftCount:row.drafts.size,
  winRate:(row.wins+row.losses)?row.wins/(row.wins+row.losses):0
})).sort((a,b)=>
  b.appearances-a.appearances ||
  b.legendPoints-a.legendPoints ||
  b.matches-a.matches ||
  a.name.localeCompare(b.name,"pl")
);

$("fullPilotGallery").innerHTML=pilotRows.length?pilotRows.map((row,index)=>`
  <article class="pilot-ledger-card">
    <span class="pilot-ledger-rank">#${index+1} PILOT</span>
    <a href="${playerUrl(row.name)}"><b>${esc(row.name)}</b></a>
    <div class="pilot-ledger-stats">
      <span><strong>${row.appearances}</strong>Talii</span>
      <span><strong>${row.wins}–${row.losses}</strong>Bilans</span>
      <span><strong>${pct(row.winRate)}</strong>WR</span>
    </div>
    <div class="historic-deck-legend">✦ ${row.legendPoints} · ${row.draftCount} draftów</div>
  </article>
`).join(""):'<div class="empty-01d">Brak danych o pilotach.</div>';

/* =========================================================
   SIGNATURE TWELVE
========================================================= */
const coUsage=new Map();
deckEntries.forEach(entry=>{
  const unique=[...new Set(entry.deck)].filter(name=>name!==cardName);
  unique.forEach(name=>{
    const row=coUsage.get(name)||{name,sharedDecks:0,drafts:new Set()};
    row.sharedDecks++;
    row.drafts.add(entry.draftId);
    coUsage.set(name,row);
  });
});

const signature=[...coUsage.values()].map(row=>({
  ...row,
  draftCount:row.drafts.size
})).sort((a,b)=>
  b.sharedDecks-a.sharedDecks ||
  b.draftCount-a.draftCount ||
  a.name.localeCompare(b.name,"pl")
).slice(0,12);

$("signatureTwelveGrid").innerHTML=signature.length?signature.map((row,index)=>{
  const card=cardByName.get(row.name)||{};
  const cost=Number.isFinite(Number(card.cost))?card.cost:"?";
  const power=Number.isFinite(Number(card.power))?card.power:"?";
  return `<a class="signature-partner-card" href="${cardUrl(row.name)}">
    <span class="signature-partner-rank">#${index+1}</span>
    <div class="signature-partner-stats">
      <span class="signature-partner-stat cost">${esc(cost)}</span>
      <span class="signature-partner-stat power">${esc(power)}</span>
    </div>
    <div class="signature-partner-name">${esc(row.name)}</div>
    <div class="signature-partner-foot">${row.sharedDecks} wspólnych talii · ${row.draftCount} draftów</div>
  </a>`;
}).join(""):'<div class="empty-01d">Brak danych do zbudowania statystycznej dwunastki.</div>';

/* =========================================================
   HISTORICAL DECK VITRINES
========================================================= */
const showcase=deckEntries.slice().sort((a,b)=>
  (Number.isFinite(a.place)?a.place:999)-(Number.isFinite(b.place)?b.place:999) ||
  b.points-a.points ||
  b.winRate-a.winRate ||
  b.wins-a.wins ||
  b.draftId-a.draftId
).slice(0,4);

function deckImagePath(entry){
  return `assets/decks/${sanitizeDeckOwner(entry.player)}_${entry.draftId}.jpg`;
}

$("cardDeckShowcase").innerHTML=showcase.length?showcase.map(entry=>{
  const place=Number.isFinite(entry.place)?`#${entry.place}`:"—";
  const cards=entry.deck.slice(0,12);
  return `<article class="historic-deck-card">
    <div class="historic-deck-image">
      <img src="${deckImagePath(entry)}" alt="Talia ${esc(entry.player)} — D${entry.draftId}"
           loading="lazy"
           onerror="this.closest('.historic-deck-card').classList.add('no-image')">
      <div class="historic-deck-fallback">
        ${cards.map(name=>`<span class="deck-mini-card ${name===cardName?"focal":""}">${esc(name)}</span>`).join("")}
      </div>
      <span class="deck-vitrine-badge draft">D${entry.draftId}</span>
      <span class="deck-vitrine-badge place">${place}</span>
    </div>
    <div class="historic-deck-body">
      <div class="historic-deck-pilot"><a href="${playerUrl(entry.player)}">${esc(entry.player)}</a></div>
      <div class="historic-deck-meta">
        <span><b>${entry.points}</b>Pkt</span>
        <span><b>${entry.wins}–${entry.losses}</b>Bilans</span>
        <span><b>${pct(entry.winRate)}</b>WR</span>
        <span><b>${entry.matches}</b>Mecze</span>
      </div>
      <div class="historic-deck-legend">✦ ${entry.legendPoints}${entry.isWinner?" · MISTRZOWSKA TALIA":""}</div>
    </div>
  </article>`;
}).join(""):'<div class="empty-01d">Brak historycznych talii z tym eksponatem.</div>';

})();