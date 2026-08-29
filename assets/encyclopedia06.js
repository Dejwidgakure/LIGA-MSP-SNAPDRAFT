(function(){
"use strict";
const slider=document.getElementById("battleLivesSlider");
const lives=document.getElementById("battleLivesValue");
const winner=document.getElementById("battleWinnerPoints");
const loser=document.getElementById("battleLoserPoints");
function updateBattleExample(){
  if(!slider||!lives||!winner||!loser)return;
  const remaining=Math.max(1,Math.min(10,Number(slider.value)||1));
  lives.textContent=remaining;
  winner.textContent=`${15+remaining} pkt`;
  loser.textContent=`${10-remaining} pkt`;
}
slider?.addEventListener("input",updateBattleExample);
updateBattleExample();
})();