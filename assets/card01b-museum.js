(function(){
"use strict";

function buildMuseumAmbient(){
  if(document.querySelector(".museum-ambient"))return;
  const root=document.createElement("div");
  root.className="museum-ambient";
  root.innerHTML=`
    <span class="museum-led l1"></span>
    <span class="museum-led l2"></span>
    <span class="museum-led l3"></span>
  `;
  for(let i=0;i<16;i++){
    const d=document.createElement("span");
    d.className="museum-dust";
    d.style.left=(4+Math.random()*92).toFixed(1)+"%";
    d.style.top=(42+Math.random()*54).toFixed(1)+"%";
    d.style.animationDelay=(-Math.random()*9).toFixed(2)+"s";
    d.style.animationDuration=(7+Math.random()*7).toFixed(2)+"s";
    root.appendChild(d);
  }
  document.body.appendChild(root);
}
buildMuseumAmbient();
})();