(function(){
"use strict";

const $=id=>document.getElementById(id);

/* =========================================================
   PILOTS — SHOW FIRST 5
========================================================= */
const pilotGallery=$("fullPilotGallery");
const pilotRow=$("pilotExpandRow");
const pilotButton=$("togglePilots");
const pilotLabel=$("pilotVisibleLabel");
const PILOT_PREVIEW=5;
let pilotsExpanded=false;

function pilotCards(){
  if(!pilotGallery)return[];
  return Array.from(pilotGallery.querySelectorAll(".pilot-ledger-card"));
}

function renderPilotPreview(){
  const cards=pilotCards();
  if(!cards.length){
    if(pilotRow)pilotRow.hidden=true;
    return;
  }

  const hasMore=cards.length>PILOT_PREVIEW;
  cards.forEach((card,index)=>{
    card.classList.toggle("is-pilot-collapsed",!pilotsExpanded&&index>=PILOT_PREVIEW);
  });

  if(pilotRow)pilotRow.hidden=!hasMore;

  const visible=pilotsExpanded?cards.length:Math.min(PILOT_PREVIEW,cards.length);
  if(pilotLabel)pilotLabel.textContent=`Wyświetlono ${visible} z ${cards.length}`;

  if(pilotButton){
    pilotButton.textContent=pilotsExpanded
      ?"Zwiń listę pilotów"
      :`Pokaż pozostałych (${Math.max(0,cards.length-PILOT_PREVIEW)})`;
  }
}

pilotButton?.addEventListener("click",()=>{
  pilotsExpanded=!pilotsExpanded;
  renderPilotPreview();
  if(!pilotsExpanded){
    pilotGallery?.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
});

renderPilotPreview();

/* =========================================================
   HISTORY — CONVERT LEDGER ROWS INTO HORIZONTAL CARDS
========================================================= */
const historySource=$("appearances");
const historyCarousel=$("cardHistoryCarousel");
const historyControls=$("historyCarouselControls");
const historyPrev=$("historyPrev");
const historyNext=$("historyNext");

function cellHTML(cells,index){
  return cells[index]?.innerHTML?.trim()||"—";
}

function buildHistoryCarousel(){
  if(!historySource||!historyCarousel)return;

  const rows=Array.from(historySource.querySelectorAll("tr"));
  if(!rows.length){
    historyCarousel.innerHTML='<div class="card-history-empty">Brak historii występów tej karty.</div>';
    if(historyControls)historyControls.hidden=true;
    return;
  }

  const emptyRow=rows.length===1&&rows[0].querySelector("td[colspan]");
  if(emptyRow){
    historyCarousel.innerHTML=`<div class="card-history-empty">${emptyRow.textContent.trim()}</div>`;
    if(historyControls)historyControls.hidden=true;
    return;
  }

  historyCarousel.innerHTML=rows.map(row=>{
    const cells=Array.from(row.querySelectorAll("td"));
    return `<article class="card-history-entry">
      <div class="card-history-entry-head">
        ${cellHTML(cells,0)}
        <span>${cellHTML(cells,4)}</span>
      </div>
      <div class="card-history-entry-grid">
        <div class="card-history-entry-pilots"><small>Piloci</small><span>${cellHTML(cells,1)}</span></div>
        <div><small>Talii</small><b>${cellHTML(cells,2)}</b></div>
        <div><small>Bilans / WR</small><b>${cellHTML(cells,3)}</b></div>
        <div class="card-history-entry-pilots"><small>Miejsca</small><span>${cellHTML(cells,5)}</span></div>
      </div>
    </article>`;
  }).join("");

  requestAnimationFrame(updateHistoryButtons);
}

function historyStep(){
  const first=historyCarousel?.querySelector(".card-history-entry");
  if(!first)return 320;
  const style=getComputedStyle(historyCarousel);
  const gap=parseFloat(style.columnGap||style.gap||"13")||13;
  return first.getBoundingClientRect().width+gap;
}

function updateHistoryButtons(){
  if(!historyCarousel)return;
  const overflow=historyCarousel.scrollWidth>historyCarousel.clientWidth+4;
  if(historyControls)historyControls.hidden=!overflow;

  if(!overflow){
    if(historyPrev)historyPrev.disabled=true;
    if(historyNext)historyNext.disabled=true;
    return;
  }

  const max=Math.max(0,historyCarousel.scrollWidth-historyCarousel.clientWidth);
  if(historyPrev)historyPrev.disabled=historyCarousel.scrollLeft<=3;
  if(historyNext)historyNext.disabled=historyCarousel.scrollLeft>=max-3;
}

historyPrev?.addEventListener("click",()=>{
  historyCarousel?.scrollBy({left:-historyStep(),behavior:"smooth"});
});
historyNext?.addEventListener("click",()=>{
  historyCarousel?.scrollBy({left:historyStep(),behavior:"smooth"});
});
historyCarousel?.addEventListener("scroll",()=>{
  requestAnimationFrame(updateHistoryButtons);
},{passive:true});

buildHistoryCarousel();
window.addEventListener("resize",()=>requestAnimationFrame(updateHistoryButtons));

})();