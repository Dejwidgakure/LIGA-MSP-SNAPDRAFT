(function(){
"use strict";

const $=id=>document.getElementById(id);
if(!$('cardTagGroups') || typeof cardDatabase==='undefined' || typeof TAGS==='undefined' || typeof TAG_CATEGORIES==='undefined') return;

const params=new URLSearchParams(location.search);
const requested=params.get('card');
const card=cardDatabase.find(c=>c.name===requested) || cardDatabase[0] || null;
if(!card) return;

const categoryOrder=['series','abilityTypes','archetypes','subtypes','teams','themes','special'];
const tagIndex=new Map();
categoryOrder.forEach(category=>{
  (TAGS[category]||[]).forEach(tag=>tagIndex.set(tag.id,{...tag,category}));
});

const grouped=new Map(categoryOrder.map(c=>[c,[]]));
(card.tags||[]).forEach(id=>{
  const info=tagIndex.get(id);
  if(info) grouped.get(info.category).push(info);
});

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[ch]));

function primaryValue(category){
  const rows=grouped.get(category)||[];
  return rows.length?rows.map(x=>x.name).join(', '):'—';
}

$('cardIdentityCore').innerHTML=[
  ['Koszt',card.cost],
  ['Siła',card.power],
  ['Seria',primaryValue('series')],
  ['Typ zdolności',primaryValue('abilityTypes')]
].map(([label,value])=>`<div class="identity-core-card"><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join('');

const visibleCategories=['series','abilityTypes','archetypes','subtypes','teams','themes'];
$('cardTagGroups').innerHTML=visibleCategories.map(category=>{
  const rows=grouped.get(category)||[];
  if(!rows.length) return '';
  const meta=TAG_CATEGORIES[category]||{};
  const color=meta.color||'#65e9ff';
  const glow=meta.glow||'rgba(101,233,255,.15)';
  return `<section class="tag-category" style="--tag-color:${esc(color)};--tag-glow:${esc(glow)}">
    <div class="tag-category-meta">
      <b>${esc(meta.name||category)}</b>
      <small>${esc(meta.description||'')}</small>
    </div>
    <div class="tag-chip-list">
      ${rows.map(tag=>`<span class="card-tag-chip" style="--tag-color:${esc(color)}" title="${esc(tag.description||tag.name)}">${esc(tag.name)}</span>`).join('')}
    </div>
  </section>`;
}).join('');

const special=grouped.get('special')||[];
if(special.length){
  $('specialTagCount').textContent=`(${special.length})`;
  const meta=TAG_CATEGORIES.special||{};
  const color=meta.color||'#F6C94C';
  $('specialTagList').innerHTML=special.map(tag=>`<span class="card-tag-chip" style="--tag-color:${esc(color)}" title="${esc(tag.description||tag.name)}">${esc(tag.name)}</span>`).join('');
}else{
  $('specialTagsBox').hidden=true;
}
})();