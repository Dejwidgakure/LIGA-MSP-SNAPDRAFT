(function(){
"use strict";

if(typeof cardDatabase==="undefined"||!Array.isArray(cardDatabase)||!cardDatabase.length)return;
if(document.querySelector(".museum-card-swarm"))return;

function cardColor(card){
  const cost=Number(card?.cost);
  if(cost<=1)return"#00f0ff";
  if(cost===2)return"#65f2ff";
  if(cost===3)return"#8a7cff";
  if(cost===4)return"#c06bff";
  if(cost===5)return"#ff4fd8";
  return"#ffd66b";
}
function esc(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
function shuffled(source){
  const arr=source.slice();
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

const chosen=shuffled(cardDatabase).slice(0,8);
const root=document.createElement("div");
root.className="museum-card-swarm";
root.setAttribute("aria-hidden","true");

chosen.forEach((card,index)=>{
  const node=document.createElement("div");
  const duration=15+Math.random()*9;
  const phase=16+Math.random()*10;
  const delay=-(Math.random()*16);
  const tilt=(-10+Math.random()*20).toFixed(1);
  node.className=`living-museum-card slot-${index}`;
  node.style.setProperty("--ambient-accent",cardColor(card));
  node.style.setProperty("--float-duration",`${duration.toFixed(1)}s`);
  node.style.setProperty("--phase-duration",`${phase.toFixed(1)}s`);
  node.style.setProperty("--delay",`${delay.toFixed(1)}s`);
  node.style.setProperty("--tilt",`${tilt}deg`);
  node.innerHTML=`
    <div class="living-card-shell">
      <div class="living-card-solid">
        <span class="living-card-cost">${esc(card.cost)}</span>
        <span class="living-card-power">${esc(card.power)}</span>
        <span class="living-card-name">${esc(card.name)}</span>
      </div>
      <div class="living-card-blueprint">
        <span class="living-card-cost">${esc(card.cost)}</span>
        <span class="living-card-power">${esc(card.power)}</span>
        <span class="living-card-name">${esc(card.name)}</span>
      </div>
    </div>`;
  root.appendChild(node);
});

document.body.appendChild(root);
})();