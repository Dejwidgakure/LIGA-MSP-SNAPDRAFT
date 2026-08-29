(function(){
"use strict";

/* ---------------------------------------------------------
   Ambient cosmic pages — decorative only
--------------------------------------------------------- */
const ambient=document.getElementById("encyLibraryAmbient");
if(ambient&&!ambient.dataset.ready){
  ambient.dataset.ready="1";

  const pageSlots=[
    {left:"1.5%",top:"19%",tilt:"-8deg"},
    {right:"2.2%",top:"31%",tilt:"7deg"},
    {left:"3.3%",top:"68%",tilt:"5deg"},
    {right:"4.2%",top:"74%",tilt:"-6deg"},
    {left:"15%",top:"91%",tilt:"-4deg"},
    {right:"16%",top:"8%",tilt:"6deg"}
  ];

  pageSlots.forEach((slot,index)=>{
    const page=document.createElement("span");
    page.className="codex-float-page";
    Object.entries(slot).forEach(([key,value])=>page.style[key]=value);
    page.style.setProperty("--dur",`${18+index*2.4}s`);
    page.style.setProperty("--delay",`${-index*3.1}s`);
    page.style.setProperty("--tilt",slot.tilt);
    ambient.appendChild(page);
  });

  const runes=[
    ["✦","8%","47%"],
    ["◇","91%","19%"],
    ["✧","93%","56%"],
    ["✦","18%","84%"],
    ["◇","76%","92%"]
  ];
  runes.forEach(([glyph,left,top],index)=>{
    const rune=document.createElement("span");
    rune.className="codex-rune";
    rune.textContent=glyph;
    rune.style.left=left;
    rune.style.top=top;
    rune.style.animationDelay=`${index*.8}s`;
    ambient.appendChild(rune);
  });
}

/* ---------------------------------------------------------
   Reading progress
--------------------------------------------------------- */
const progress=document.querySelector("#encyReadingProgress span");
function syncProgress(){
  if(!progress)return;
  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const value=Math.max(0,Math.min(1,scrollY/max));
  progress.style.width=`${(value*100).toFixed(2)}%`;
}
addEventListener("scroll",syncProgress,{passive:true});
addEventListener("resize",syncProgress);
syncProgress();

/* ---------------------------------------------------------
   Codex chapter numbering + family rail
--------------------------------------------------------- */
const chapters=[...document.querySelectorAll(".encyclopedia-chapter[id]")];
chapters.forEach((section,index)=>{
  section.dataset.codexNo=String(index+1).padStart(2,"0");

  if(!section.querySelector(".codex-back-index")){
    const back=document.createElement("a");
    back.className="codex-back-index";
    back.href="#encyklopedia";
    back.textContent="↑ indeks wiedzy";
    section.appendChild(back);
  }
});

const rail=document.getElementById("encyChapterRail");
if(rail){
  const primaryIds=[
    "classic",
    "twarde-zasady",
    "classic-flow",
    "mecze",
    "settings-v2",
    "tryby",
    "rozszerzenia",
    "ustawienia",
    "katalogi",
    "interakcje",
    "slownik",
    "faq"
  ];

  primaryIds.forEach(id=>{
    const section=document.getElementById(id);
    if(!section)return;
    const title=section.querySelector("h2")?.textContent.trim()||id;
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="ency-rail-dot";
    btn.dataset.target=id;
    btn.dataset.label=title.replace(/^[^\p{L}\p{N}]+/u,"");
    btn.setAttribute("aria-label",`Przejdź: ${title}`);
    btn.addEventListener("click",()=>section.scrollIntoView({behavior:"smooth",block:"start"}));
    rail.appendChild(btn);
  });
}

/* ---------------------------------------------------------
   Auto local indexes for long chapters.
   Generated from actual H3s, so later canon edits update it
   automatically without rewriting navigation.
--------------------------------------------------------- */
function slugify(value){
  return String(value||"")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,64);
}

document.querySelectorAll(".encyclopedia-longform[id]").forEach(section=>{
  const headings=[...section.querySelectorAll(":scope > h3")];
  if(headings.length<3)return;

  const used=new Set();
  headings.forEach((heading,index)=>{
    if(!heading.id){
      let id=`${section.id}-${slugify(heading.textContent)||`sekcja-${index+1}`}`;
      let candidate=id,n=2;
      while(document.getElementById(candidate)||used.has(candidate)){
        candidate=`${id}-${n++}`;
      }
      heading.id=candidate;
      used.add(candidate);
    }
  });

  const index=document.createElement("div");
  index.className="codex-local-index";
  index.innerHTML=`<span>Na tej stronie kodeksu</span><nav>${headings.map(h=>
    `<a href="#${h.id}">${h.textContent.trim()}</a>`
  ).join("")}</nav>`;

  const lead=[...section.children].find(el=>
    el.matches("p,.chapter-lead")
  );
  if(lead){
    lead.insertAdjacentElement("afterend",index);
  }else{
    section.querySelector("h2")?.insertAdjacentElement("afterend",index);
  }
});

/* ---------------------------------------------------------
   Active chapter rail + existing sticky TOC synchronisation
--------------------------------------------------------- */
const railDots=[...document.querySelectorAll(".ency-rail-dot")];

function syncActiveChapter(){
  const marker=innerHeight*.34;
  let current=null;

  for(const section of chapters){
    const rect=section.getBoundingClientRect();
    if(rect.top<=marker&&rect.bottom>=marker){
      current=section;
      break;
    }
  }

  if(!current){
    const passed=chapters.filter(section=>section.getBoundingClientRect().top<=marker);
    current=passed[passed.length-1]||chapters[0]||null;
  }

  railDots.forEach(dot=>{
    dot.classList.toggle("is-active",dot.dataset.target===current?.id);
  });
}

addEventListener("scroll",syncActiveChapter,{passive:true});
addEventListener("resize",syncActiveChapter);
syncActiveChapter();

})();