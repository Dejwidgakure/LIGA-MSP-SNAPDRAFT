(function(){
"use strict";
const schematic=document.getElementById("arenaSchematic");
document.querySelectorAll("[data-highlight]").forEach(button=>{
  button.addEventListener("click",()=>{
    const zone=button.dataset.highlight;
    schematic?.querySelectorAll("[data-zone]").forEach(el=>el.classList.toggle("is-highlighted",el.dataset.zone===zone));
  });
});
schematic?.querySelectorAll("button[data-zone]").forEach(button=>{
  button.addEventListener("click",()=>{
    schematic.querySelectorAll("[data-zone]").forEach(el=>el.classList.toggle("is-highlighted",el===button));
  });
});
})();