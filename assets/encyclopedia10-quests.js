(function(){
"use strict";
const grid=document.getElementById("questDexGrid");
const summary=document.getElementById("questDexSummary");
const search=document.getElementById("questSearch");
const tier=document.getElementById("questTier");
if(!grid)return;

const data=window.DraftQuestRegistry;
if(!data?.quests){
  grid.innerHTML='<div class="deep-empty">Biblioteka Questów nie jest dostępna w tej wersji strony.</div>';
  return;
}

const tierNames={street:"Street Level",avengers:"Avengers Level",celestial:"Celestial Level"};
const tierClass={street:"street",avengers:"avengers",celestial:"celestial"};
const windowLabel={
  next2:"następne 2 picki",
  next3:"następne 3 picki",
  next6:"6 kolejnych picków",
  draftEnd:"do końca draftu"
};

function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function normalize(v){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function friendlyText(q){
  return String(q.textTemplate||"")
    .replace(/\{targetTagName\}/g,"wybranego typu")
    .replace(/\{targetCostLabel\}/g,"wybranego zakresu")
    .replace(/\{targetPower\}/g,"ustalony próg")
    .replace(/\{requiredBuckets\}/g,"wymaganą liczbę")
    .replace(/\{requiredCards\}/g,"wymaganą liczbę")
    .replace(/\{minCostGap\}/g,"ustaloną wartość")
    .replace(/\{targetAveragePower\}/g,"ustaloną wartość")
    .replace(/\{directionLabel\}/g,"wybranym kierunku");
}
function render(){
  const q=normalize(search?.value);
  const selected=tier?.value||"";
  const rows=data.quests.filter(item=>
    (!selected||item.tier===selected) &&
    (!q||normalize(`${item.name} ${friendlyText(item)} ${tierNames[item.tier]||""}`).includes(q))
  );
  grid.innerHTML=rows.map(item=>`
    <article class="questdex-card ${tierClass[item.tier]||""}">
      <div class="questdex-tier">${escapeHtml(tierNames[item.tier]||item.tier)}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(friendlyText(item))}</p>
      <div class="questdex-meta">
        <span>⏱ ${escapeHtml(windowLabel[item.window]||item.window||"")}</span>
        <b>🪙 +${escapeHtml(item.rewardJC)} JC</b>
      </div>
    </article>
  `).join("") || '<div class="deep-empty">Brak Questów dla wybranych filtrów.</div>';
  const counts={street:0,avengers:0,celestial:0};
  data.quests.forEach(x=>{if(counts[x.tier]!=null)counts[x.tier]++});
  summary.innerHTML=`<span>${rows.length} widocznych</span><span>${counts.street} Street</span><span>${counts.avengers} Avengers</span><span>${counts.celestial} Celestial</span>`;
}
search?.addEventListener("input",render);
tier?.addEventListener("change",render);
render();
})();