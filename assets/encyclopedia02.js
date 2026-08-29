(function(){
"use strict";

const input=document.getElementById("encySearch");
const results=document.getElementById("encySearchResults");
const clear=document.getElementById("encySearchClear");
if(!input||!results)return;

const normalize=value=>String(value||"")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"");

const entries=[];
const seen=new Set();

function addEntry(label,href,text,type){
  const key=`${href}|||${label}`;
  if(!label||!href||seen.has(key))return;
  seen.add(key);
  entries.push({label,href,text:normalize(`${label} ${text||""}`),type});
}

/* Main encyclopedia chapters */
document.querySelectorAll(".encyclopedia-chapter[id]").forEach(section=>{
  const h=section.querySelector("h2");
  if(!h)return;
  addEntry(h.textContent.trim(),`#${section.id}`,section.textContent,"Rozdział");
});

/* System cards */
document.querySelectorAll(".ency-system-card").forEach(card=>{
  const h=card.querySelector("h3");
  if(!h)return;
  const ownLink=card.querySelector("a[href]");
  const parent=card.closest(".encyclopedia-chapter[id]");
  const href=ownLink?.getAttribute("href") || (parent?`#${parent.id}`:"");
  addEntry(h.textContent.trim(),href,card.textContent,"System");
});

/* Portals */
document.querySelectorAll(".ency-portal").forEach(portal=>{
  const b=portal.querySelector("b");
  const href=portal.getAttribute("href");
  if(!b||!href)return;
  addEntry(b.textContent.trim(),href,portal.textContent,"Katalog");
});

/* Dictionary terms resolve to the dictionary section for now. */
document.querySelectorAll(".dictionary-chips span").forEach(term=>{
  addEntry(term.textContent.trim(),"#slownik",term.textContent,"Termin");
});

function render(){
  const q=normalize(input.value.trim());
  if(q.length<2){
    results.innerHTML="";
    results.classList.remove("has-results");
    return;
  }

  const matches=entries
    .filter(entry=>entry.text.includes(q))
    .slice(0,9);

  results.classList.add("has-results");
  if(!matches.length){
    results.innerHTML='<div class="ency-search-result"><span>Brak wyniku w obecnym szkielecie Encyklopedii.</span><small>Spróbuj innego hasła</small></div>';
    return;
  }

  results.innerHTML=matches.map(entry=>`
    <a class="ency-search-result" href="${entry.href}">
      <span>${entry.label}</span>
      <small>${entry.type}</small>
    </a>
  `).join("");
}

input.addEventListener("input",render);
clear?.addEventListener("click",()=>{
  input.value="";
  results.innerHTML="";
  results.classList.remove("has-results");
  input.focus();
});

results.addEventListener("click",event=>{
  const link=event.target.closest("a");
  if(link&&link.getAttribute("href")?.startsWith("#")){
    results.classList.remove("has-results");
  }
});
})();