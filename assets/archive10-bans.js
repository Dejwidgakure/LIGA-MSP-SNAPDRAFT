(function(){
"use strict";

const EXCLUDED_PERMANENT_BANS = new Set(["Arishem","Loki"]);
const LIMIT = 10;

const esc = value => String(value ?? "")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;");

function cardUrl(name){
  return `card-stats.html?card=${encodeURIComponent(name)}`;
}

function getDraftBans(draft){
  const bans=draft?.draftConfigV2?.specialSettings?.poolRules?.bans;
  if(!bans?.enabled || !Array.isArray(bans.cards)) return [];
  return bans.cards
    .map(item=>{
      if(typeof item==="string") return item.trim();
      if(item && typeof item==="object") return String(item.name || item.card || item.label || "").trim();
      return "";
    })
    .filter(Boolean);
}

function buildBanRanking(){
  const root=document.getElementById("mostBannedCards");
  if(!root)return;

  const drafts = (typeof database!=="undefined" && Array.isArray(database?.drafts))
    ? database.drafts
    : [];

  const cards = (typeof cardDatabase!=="undefined" && Array.isArray(cardDatabase))
    ? cardDatabase
    : [];

  const cardByName=new Map(cards.filter(Boolean).map(card=>[card.name,card]));
  const counts=new Map();

  drafts
    .filter(draft=>draft?.status==="finished")
    .forEach(draft=>{
      const uniqueBans=new Set(getDraftBans(draft));
      uniqueBans.forEach(name=>{
        if(EXCLUDED_PERMANENT_BANS.has(name))return;
        counts.set(name,(counts.get(name)||0)+1);
      });
    });

  const rows=[...counts.entries()]
    .map(([name,bans])=>({name,bans,card:cardByName.get(name)||null}))
    .sort((a,b)=>b.bans-a.bans || a.name.localeCompare(b.name,"pl"))
    .slice(0,LIMIT);

  if(!rows.length){
    root.innerHTML='<div class="ban-cards-empty">Brak zapisanej historii banów w ukończonych draftach.</div>';
    return;
  }

  root.innerHTML=rows.map((row,index)=>{
    const cost=row.card?.cost ?? "—";
    const power=row.card?.power ?? "—";
    const body=`<span class="ban-card-shell">
      <span class="ban-rank">#${index+1}</span>
      <span class="ban-cost">${esc(cost)}</span>
      <span class="ban-power">${esc(power)}</span>
      <b class="ban-card-name">${esc(row.name)}</b>
      <span class="ban-card-count">${row.bans} ${row.bans===1?"DRAFT":"DRAFTY"}</span>
    </span>`;

    return row.card
      ? `<a class="ban-stat-card" href="${cardUrl(row.name)}" title="${esc(row.name)} — ${row.bans} ukończonych draftów z banem">${body}</a>`
      : `<div class="ban-stat-card" title="${esc(row.name)} — ${row.bans} ukończonych draftów z banem">${body}</div>`;
  }).join("");
}

buildBanRanking();
})();
