(function(){
"use strict";

function el(tag,className,html){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(html!==undefined)node.innerHTML=html;
  return node;
}

const hero=document.querySelector(".catalog-hero");
if(!hero)return;

if(document.body.classList.contains("joker-catalog")){
  const stage=el("div","catalog-identity-stage");
  stage.innerHTML='<img class="catalog-mascot" src="assets/catalogs/jeff_joker.webp" alt="" aria-hidden="true">';
  hero.appendChild(stage);
  const label=el("div","catalog-world-label","ENCYKLOPEDIA SNAPDRAFTU");
  hero.appendChild(label);
}

if(document.body.classList.contains("pack-catalog")){
  const stage=el("div","catalog-identity-stage");
  stage.innerHTML=`<img class="custom-golden-jeff pack-hero-golden-jeff" src="assets/deep-systems/jeffgoldenhand.webp" alt="" aria-hidden="true">`+[1,2,3,4].map(n=>`<img class="pack-hero-item" src="assets/catalogs/pack_custom_${n}.png" alt="" aria-hidden="true">`).join("");
  hero.appendChild(stage);
  hero.appendChild(el("div","catalog-world-label","ENCYKLOPEDIA SNAPDRAFTU"));
}

if(document.body.classList.contains("tag-catalog")){
  const stage=el("div","catalog-identity-stage");
  stage.innerHTML=`
    <span class="taxonomy-orbit"></span>
    <img class="taxonomy-cardback" src="assets/catalogs/taxonomy_card_a.webp" alt="" aria-hidden="true">
    <img class="taxonomy-cardback" src="assets/catalogs/taxonomy_card_b.webp" alt="" aria-hidden="true">
    <img class="taxonomy-cardback" src="assets/catalogs/taxonomy_card_c.webp" alt="" aria-hidden="true">
  `;
  hero.appendChild(stage);
  hero.appendChild(el("div","catalog-world-label","ENCYKLOPEDIA SNAPDRAFTU"));
}

/* Atlas: quick legend from current TAG_CATEGORIES */
if(document.body.classList.contains("tag-catalog") && typeof TAG_CATEGORIES!=="undefined"){
  const order=["series","abilityTypes","archetypes","subtypes","teams","themes","special"];
  const legend=el("div","taxonomy-legend");
  order.forEach(key=>{
    const meta=TAG_CATEGORIES[key];
    if(!meta)return;
    const b=document.createElement("button");
    b.type="button";
    b.style.setProperty("--legend-color",meta.color||"#7eeff4");
    b.textContent=meta.name;
    b.addEventListener("click",()=>{
      const select=document.getElementById("categoryFilter");
      if(select){
        select.value=key;
        select.dispatchEvent(new Event("change",{bubbles:true}));
        document.getElementById("catalogRoot")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });
    legend.appendChild(b);
  });
  document.querySelector(".catalog-summary")?.insertAdjacentElement("beforebegin",legend);
}
})();