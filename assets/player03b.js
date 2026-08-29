(function(){
"use strict";

const $=id=>document.getElementById(id);

/* =========================================================
   PLAYER NAME FIT
========================================================= */
function fitPlayerName(){
  const el=$("playerName");
  if(!el)return;

  const holder=el.closest(".profile-identity");
  if(!holder)return;

  el.classList.remove("player-name-long","player-name-extra-long");
  el.style.fontSize="";
  el.style.letterSpacing="";

  const mobile=window.matchMedia("(max-width:760px)").matches;
  const maxSize=mobile?54:78;
  const minSize=mobile?24:28;
  const available=Math.max(120,holder.clientWidth-2);

  let size=maxSize;
  el.style.fontSize=size+"px";
  el.style.whiteSpace="nowrap";

  const chars=Array.from((el.textContent||"").trim()).length;
  if(chars>=16)el.classList.add("player-name-extra-long");

  while(size>minSize&&el.scrollWidth>available){
    size-=1;
    el.style.fontSize=size+"px";
  }

  if(size<=46||chars>=15){
    el.classList.add("player-name-long");
  }

  /* One last pass after tighter tracking for exceptional names. */
  if(el.scrollWidth>available){
    el.classList.add("player-name-extra-long");
    let emergency=size;
    while(emergency>20&&el.scrollWidth>available){
      emergency-=1;
      el.style.fontSize=emergency+"px";
    }
  }
}

requestAnimationFrame(()=>requestAnimationFrame(fitPlayerName));
window.addEventListener("resize",()=>{
  requestAnimationFrame(fitPlayerName);
});

/* =========================================================
   RIVAL MAP — 4 ITEMS PER PAGE
========================================================= */
const rivalMap=$("rivalMap");
const rivalPager=$("rivalMapPagination");
const rivalPrev=$("rivalPrev");
const rivalNext=$("rivalNext");
const rivalLabel=$("rivalPageLabel");
const RIVALS_PER_PAGE=4;
let rivalPage=0;

function rivalRows(){
  if(!rivalMap)return[];
  return Array.from(rivalMap.querySelectorAll(".rival-map-row"));
}

function renderRivalPage(){
  const rows=rivalRows();
  if(!rows.length){
    if(rivalPager)rivalPager.hidden=true;
    return;
  }

  const totalPages=Math.max(1,Math.ceil(rows.length/RIVALS_PER_PAGE));
  rivalPage=Math.max(0,Math.min(rivalPage,totalPages-1));

  rows.forEach((row,index)=>{
    const visible=Math.floor(index/RIVALS_PER_PAGE)===rivalPage;
    row.classList.toggle("is-rival-hidden",!visible);
  });

  if(rivalPager)rivalPager.hidden=totalPages<=1;
  if(rivalLabel)rivalLabel.textContent=`${rivalPage+1} / ${totalPages}`;
  if(rivalPrev)rivalPrev.disabled=rivalPage<=0;
  if(rivalNext)rivalNext.disabled=rivalPage>=totalPages-1;
}

rivalPrev?.addEventListener("click",()=>{
  rivalPage-=1;
  renderRivalPage();
  rivalMap?.scrollIntoView({behavior:"smooth",block:"nearest"});
});

rivalNext?.addEventListener("click",()=>{
  rivalPage+=1;
  renderRivalPage();
  rivalMap?.scrollIntoView({behavior:"smooth",block:"nearest"});
});

renderRivalPage();

/* =========================================================
   DRAFT HISTORY — HORIZONTAL CONTROLS
========================================================= */
const history=$("draftHistory");
const historyControls=$("draftHistoryControls");
const historyPrev=$("draftHistoryPrev");
const historyNext=$("draftHistoryNext");

function historyStep(){
  const first=history?.querySelector(".draft-history-card");
  if(!first)return 330;
  const styles=getComputedStyle(history);
  const gap=parseFloat(styles.columnGap||styles.gap||"15")||15;
  return first.getBoundingClientRect().width+gap;
}

function updateHistoryButtons(){
  if(!history)return;

  const overflow=history.scrollWidth>history.clientWidth+4;
  if(historyControls)historyControls.hidden=!overflow;

  if(!overflow){
    if(historyPrev)historyPrev.disabled=true;
    if(historyNext)historyNext.disabled=true;
    return;
  }

  const max=Math.max(0,history.scrollWidth-history.clientWidth);
  if(historyPrev)historyPrev.disabled=history.scrollLeft<=3;
  if(historyNext)historyNext.disabled=history.scrollLeft>=max-3;
}

historyPrev?.addEventListener("click",()=>{
  history?.scrollBy({left:-historyStep(),behavior:"smooth"});
});

historyNext?.addEventListener("click",()=>{
  history?.scrollBy({left:historyStep(),behavior:"smooth"});
});

history?.addEventListener("scroll",()=>{
  requestAnimationFrame(updateHistoryButtons);
},{passive:true});

requestAnimationFrame(()=>requestAnimationFrame(updateHistoryButtons));
window.addEventListener("resize",()=>{
  requestAnimationFrame(updateHistoryButtons);
});

})();