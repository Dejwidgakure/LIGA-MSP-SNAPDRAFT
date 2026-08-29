(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.SideboardStatsUIV2=api;
  if(typeof document!=='undefined'){
    const run=()=>{ try{ api.apply(); }catch(error){ console.error('[SideboardStatsUIV2]',error); } };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});
    else setTimeout(run,0);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const pct=value=>`${(num(value)*100).toFixed(1)}%`;
  const normalize=value=>String(value||'').trim();
  const unique=list=>[...new Set((Array.isArray(list)?list:[]).map(normalize).filter(Boolean))];

  function currentCardName(){
    if(typeof location==='undefined') return '';
    return normalize(new URLSearchParams(location.search).get('card'));
  }
  function currentPlayerName(){
    if(typeof location==='undefined') return '';
    return normalize(new URLSearchParams(location.search).get('name'));
  }
  function cardUrl(name){ return `card-stats.html?card=${encodeURIComponent(name)}`; }
  function playerUrl(name){ return `player.html?name=${encodeURIComponent(name)}`; }
  function draftUrl(id){ return `draft.html?id=${encodeURIComponent(id)}`; }
  function record(row){ return `${num(row?.wins)}W–${num(row?.losses)}L · ${pct(row?.winRate)}`; }

  function carriers(profile){
    return (Array.isArray(profile?.history)?profile.history:[]).flatMap(row=>(Array.isArray(row?.carriers)?row.carriers:[]).map(carrier=>({
      ...carrier,
      draftId:num(row.id),
      draftTitle:row.title||`D${row.id}`,
      playerCount:num(row.playerCount),
      draftMatches:num(row.matches),
      draftWins:num(row.wins),
      draftLosses:num(row.losses),
      draftWinRate:num(row.winRate)
    })));
  }

  function buildFinishModel(profile){
    const rows=carriers(profile).filter(row=>Number.isFinite(Number(row.place))&&Number(row.place)>0);
    const counts={1:0,2:0,3:0,4:0,5:0,other:0};
    rows.forEach(row=>{ const place=Number(row.place); if(place>=1&&place<=5) counts[place]++; else counts.other++; });
    const avg=rows.length?rows.reduce((sum,row)=>sum+Number(row.place),0)/rows.length:0;
    return {
      rows,counts,averagePlace:avg,
      podiumRate:rows.length?rows.filter(row=>row.place<=3).length/rows.length:0,
      titleRate:rows.length?rows.filter(row=>row.place===1).length/rows.length:0
    };
  }

  function buildTrajectoryModel(profile,drafts,engine){
    const historyById=new Map((profile?.history||[]).map(row=>[num(row.id),row]));
    return (Array.isArray(drafts)?drafts:[])
      .filter(draft=>engine?.isDraftFinished?engine.isDraftFinished(draft):normalize(draft?.status)==='finished')
      .slice().sort((a,b)=>num(a.id)-num(b.id))
      .map(draft=>{
        const row=historyById.get(num(draft.id));
        const playerCount=(Array.isArray(draft?.players)?draft.players.length:num(draft?.playersCount))||1;
        const appearances=Array.isArray(row?.carriers)?row.carriers.length:0;
        return {
          id:num(draft.id),
          appearances,
          playerCount,
          popularity:appearances/playerCount,
          matches:num(row?.matches),
          wins:num(row?.wins),
          losses:num(row?.losses),
          winRate:num(row?.winRate),
          legendPoints:(row?.carriers||[]).reduce((sum,item)=>sum+num(item.legendPoints),0)
        };
      });
  }

  function buildPlayerCardFrequency(profile){
    const map=new Map();
    (profile?.history||[]).forEach(row=>{
      unique(row?.playerDeck||row?.allDraftedCards||row?.deck||[]).forEach(name=>map.set(name,(map.get(name)||0)+1));
    });
    return [...map.entries()].map(([name,appearances])=>({name,appearances})).sort((a,b)=>b.appearances-a.appearances||a.name.localeCompare(b.name,'pl'));
  }

  function findCardMeta(name){
    const db=typeof cardDatabase!=='undefined'&&Array.isArray(cardDatabase)?cardDatabase:[];
    return db.find(card=>normalize(card?.name)===normalize(name))||null;
  }
  function cardChip(name,current){
    return `<a class="sbv2-card-chip${normalize(name)===normalize(current)?' is-current':''}" href="${cardUrl(name)}">${esc(name)}</a>`;
  }
  function miniCard(name,footer=''){
    const meta=findCardMeta(name)||{};
    return `<article class="sbv2-mini-card">
      <a href="${cardUrl(name)}" class="sbv2-mini-card-body">
        <span class="sbv2-mini-cost">${esc(meta.cost??'')}</span>
        <b>${esc(name)}</b>
        ${meta.power!==undefined&&meta.power!==null?`<span class="sbv2-mini-power">${esc(meta.power)}</span>`:''}
      </a>${footer?`<small>${footer}</small>`:''}
    </article>`;
  }

  function injectStyles(){
    if(typeof document==='undefined'||document.getElementById('sideboardStatsUIV2Styles')) return;
    const style=document.createElement('style');
    style.id='sideboardStatsUIV2Styles';
    style.textContent=`
      .sbv2-trajectory{display:flex;align-items:flex-end;gap:10px;min-width:max-content;height:280px;padding:24px 18px 34px;border-radius:18px;background:rgba(2,10,30,.54);border:1px solid rgba(96,221,255,.13)}
      .sbv2-trajectory-item{width:48px;height:220px;display:grid;grid-template-rows:1fr auto;gap:7px;position:relative;text-align:center;color:#8fb8c8;font:700 10px Rajdhani,sans-serif}
      .sbv2-trajectory-plot{position:relative;border-bottom:1px solid rgba(131,230,255,.12)}
      .sbv2-trajectory-bar{position:absolute;left:8px;right:8px;bottom:0;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#50e9ef,#5566ff);min-height:2px;box-shadow:0 0 18px rgba(67,220,255,.24)}
      .sbv2-trajectory-dot{position:absolute;width:9px;height:9px;border-radius:50%;left:50%;transform:translate(-50%,50%);background:#ffe098;border:2px solid #fff1c7;box-shadow:0 0 12px rgba(255,221,137,.62)}
      .sbv2-trajectory-item.is-hit strong{color:#e8fbff}.sbv2-trajectory-item:not(.is-hit){opacity:.42}
      .sbv2-facts,.sbv2-finish-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
      .sbv2-fact,.sbv2-finish-kpi{padding:15px 17px;border-radius:15px;background:rgba(4,15,39,.7);border:1px solid rgba(100,230,255,.16)}
      .sbv2-fact span,.sbv2-finish-kpi span{display:block;color:#86aabd;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.sbv2-fact b,.sbv2-finish-kpi b{display:block;margin-top:6px;color:#fff0b2;font:800 22px Orbitron,sans-serif}
      .sbv2-finish-bars{display:grid;gap:9px}.sbv2-finish-row{display:grid;grid-template-columns:48px 1fr 34px;gap:10px;align-items:center;color:#a9c5d2;font-weight:800}.sbv2-finish-track{height:12px;border-radius:999px;background:rgba(79,124,165,.16);overflow:hidden}.sbv2-finish-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#3be3e7,#8171ff)}
      .sbv2-pilot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.sbv2-pilot{padding:15px;border:1px solid rgba(95,230,255,.18);border-radius:17px;background:rgba(4,15,40,.72)}.sbv2-pilot>a{color:#eaffff;text-decoration:none;font:800 15px Orbitron,sans-serif}.sbv2-pilot-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0}.sbv2-pilot-stat{padding:7px 5px;text-align:center;border-radius:10px;background:rgba(75,117,174,.09)}.sbv2-pilot-stat b{display:block;color:white}.sbv2-pilot-stat span{font-size:9px;color:#8ea9b6;text-transform:uppercase}.sbv2-pilot small{color:#ffd86f;font-weight:800}
      .sbv2-deck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}.sbv2-deck{padding:16px;border-radius:18px;background:rgba(3,12,34,.75);border:1px solid rgba(101,225,255,.16)}.sbv2-deck-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.sbv2-deck-head b{color:#fff;font:800 14px Orbitron,sans-serif}.sbv2-deck-head small{color:#ffd970;font-weight:800}.sbv2-zone{margin-top:10px}.sbv2-zone-label{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#8fc3d5;font:800 9px Orbitron,sans-serif;letter-spacing:.12em}.sbv2-zone.is-sideboard .sbv2-zone-label{color:#ffd774}.sbv2-zone-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.sbv2-zone.is-sideboard .sbv2-zone-cards{grid-template-columns:repeat(3,minmax(0,1fr))}.sbv2-card-chip{display:flex;align-items:center;justify-content:center;min-width:0;min-height:31px;padding:5px;border-radius:8px;background:rgba(40,76,121,.18);border:1px solid rgba(116,220,255,.13);color:#dffbff;text-decoration:none;text-align:center;font-size:10px;line-height:1.05;word-break:break-word}.sbv2-zone.is-sideboard .sbv2-card-chip{border-color:rgba(255,214,111,.32);background:rgba(255,191,72,.07)}.sbv2-card-chip.is-current{box-shadow:0 0 0 1px #72f7ff inset,0 0 16px rgba(93,238,255,.23);color:white}.sbv2-zone.is-sideboard .sbv2-card-chip.is-current{box-shadow:0 0 0 1px #ffd76f inset,0 0 16px rgba(255,211,99,.25)}
      .sbv2-history{display:flex;gap:12px;overflow:auto;padding-bottom:8px}.sbv2-history-card{flex:0 0 min(390px,86vw)}
      .sbv2-mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}.sbv2-mini-card{border-radius:13px;background:rgba(4,14,38,.72);border:1px solid rgba(89,217,255,.15);overflow:hidden}.sbv2-mini-card-body{display:grid;grid-template-columns:25px 1fr 25px;gap:6px;align-items:center;padding:9px;color:white;text-decoration:none}.sbv2-mini-card-body b{font-size:11px;line-height:1.05;text-align:center}.sbv2-mini-cost,.sbv2-mini-power{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:rgba(87,102,255,.35);font-weight:900}.sbv2-mini-power{background:rgba(255,203,68,.22);color:#ffe7a3}.sbv2-mini-card small{display:block;padding:0 9px 8px;color:#88a9b8}
      .sbv2-dna-bars{display:grid;gap:8px}.sbv2-dna-row{display:grid;grid-template-columns:minmax(100px,180px) 1fr 48px;gap:9px;align-items:center}.sbv2-dna-row span{color:#cde9f2;font-size:11px}.sbv2-dna-track{height:9px;border-radius:999px;background:rgba(81,122,161,.16);overflow:hidden}.sbv2-dna-fill{height:100%;background:linear-gradient(90deg,#40dce5,#7d68ff);border-radius:inherit}.sbv2-dna-row b{color:#ffe195;font-size:11px}
      .sbv2-player-sideboard{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,214,111,.23)}.sbv2-player-sideboard-label{display:block;margin-bottom:6px;color:#ffd96f;font:800 9px Orbitron,sans-serif;letter-spacing:.11em}.sbv2-player-sideboard-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.sbv2-player-fallback{padding:14px;border:1px solid rgba(92,220,255,.14);border-radius:16px;background:rgba(4,14,36,.68)}.sbv2-player-fallback h3{margin:0 0 8px;color:#fff}.sbv2-player-fallback small{color:#ffd66e}.sbv2-player-fallback .sbv2-zone-cards{grid-template-columns:repeat(4,minmax(0,1fr))}
    `;
    document.head.appendChild(style);
  }

  function renderTrajectory(profile){
    const chart=document.getElementById('cardTrajectoryChart');
    const facts=document.getElementById('cardTrendFacts');
    if(!chart||typeof database==='undefined'||typeof DraftStatsEngine==='undefined') return;
    const model=buildTrajectoryModel(profile,database.drafts,DraftStatsEngine);
    chart.innerHTML=`<div class="sbv2-trajectory">${model.map(row=>`
      <div class="sbv2-trajectory-item${row.appearances?' is-hit':''}" title="D${row.id}: ${pct(row.popularity)} popularności · ${row.matches?pct(row.winRate):'brak meczów'} WR">
        <div class="sbv2-trajectory-plot">
          <i class="sbv2-trajectory-bar" style="height:${Math.max(0,Math.min(100,row.popularity*100))}%"></i>
          ${row.matches?`<i class="sbv2-trajectory-dot" style="bottom:${Math.max(0,Math.min(100,row.winRate*100))}%"></i>`:''}
        </div><strong>D${row.id}</strong>
      </div>`).join('')}</div>`;
    if(!facts) return;
    const hits=model.filter(row=>row.appearances);
    const peak=hits.slice().sort((a,b)=>b.popularity-a.popularity||b.id-a.id)[0];
    const best=hits.filter(row=>row.matches).slice().sort((a,b)=>b.winRate-a.winRate||b.matches-a.matches)[0];
    const legend=hits.slice().sort((a,b)=>b.legendPoints-a.legendPoints||b.id-a.id)[0];
    facts.innerHTML=`<div class="sbv2-facts">
      <div class="sbv2-fact"><span>Szczyt popularności</span><b>${peak?`D${peak.id} · ${pct(peak.popularity)}`:'—'}</b></div>
      <div class="sbv2-fact"><span>Najlepsza edycja WR</span><b>${best?`D${best.id} · ${pct(best.winRate)}`:'—'}</b></div>
      <div class="sbv2-fact"><span>Największy łup Legend</span><b>${legend?`D${legend.id} · ✦ ${legend.legendPoints}`:'—'}</b></div>
      <div class="sbv2-fact"><span>Ukończone edycje z kartą</span><b>${hits.length}</b></div>
    </div>`;
  }

  function renderFinishes(profile){
    const summary=document.getElementById('cardFinishSummary');
    const distribution=document.getElementById('cardFinishDistribution');
    if(!summary||!distribution) return;
    const model=buildFinishModel(profile);
    summary.innerHTML=`<div class="sbv2-finish-summary">
      <div class="sbv2-finish-kpi"><span>Średnie miejsce</span><b>${model.rows.length?`#${model.averagePlace.toFixed(1)}`:'—'}</b></div>
      <div class="sbv2-finish-kpi"><span>Występów na podium</span><b>${pct(model.podiumRate)}</b></div>
      <div class="sbv2-finish-kpi"><span>Występów zakończonych #1</span><b>${pct(model.titleRate)}</b></div>
      <div class="sbv2-finish-kpi"><span>Sklasyfikowanych decków</span><b>${model.rows.length}</b></div>
    </div>`;
    const labels=[[1,'#1'],[2,'#2'],[3,'#3'],[4,'#4'],[5,'#5'],['other','> #5']];
    const max=Math.max(1,...labels.map(([key])=>model.counts[key]||0));
    distribution.innerHTML=`<div class="sbv2-finish-bars">${labels.map(([key,label])=>{
      const count=model.counts[key]||0;
      return `<div class="sbv2-finish-row"><span>${label}</span><div class="sbv2-finish-track"><div class="sbv2-finish-fill" style="width:${count/max*100}%"></div></div><b>${count}</b></div>`;
    }).join('')}</div>`;
  }

  function renderPilots(profile){
    const target=document.getElementById('fullPilotGallery');
    if(!target) return;
    const rows=(profile?.pilots||[]).slice().sort((a,b)=>num(b.appearances)-num(a.appearances)||num(b.legendPoints)-num(a.legendPoints)||a.name.localeCompare(b.name,'pl'));
    target.innerHTML=`<div class="sbv2-pilot-grid">${rows.map(row=>`
      <article class="sbv2-pilot">
        <a href="${playerUrl(row.name)}">${esc(row.name)}</a>
        <div class="sbv2-pilot-stats">
          <div class="sbv2-pilot-stat"><b>${num(row.appearances)}</b><span>decki</span></div>
          <div class="sbv2-pilot-stat"><b>${num(row.wins)}–${num(row.losses)}</b><span>bilans</span></div>
          <div class="sbv2-pilot-stat"><b>${pct(row.winRate)}</b><span>WR</span></div>
        </div>
        <small>✦ ${num(row.legendPoints)} · ${num(row.draftWins)} zwycięskich draftów · ${num(row.drafts)} draftów</small>
      </article>`).join('')}</div>`;
    const expand=document.getElementById('pilotExpandRow'); if(expand) expand.hidden=true;
  }

  function zoneHtml(carrier,current){
    const main=unique(carrier?.mainDeck||[]);
    const reserve=unique(carrier?.sideboard||[]);
    return `<div class="sbv2-zone"><span class="sbv2-zone-label">MAIN DECK · ${main.length}</span><div class="sbv2-zone-cards">${main.map(name=>cardChip(name,current)).join('')}</div></div>${reserve.length?`<div class="sbv2-zone is-sideboard"><span class="sbv2-zone-label">PLANETARNA REZERWA · SIDEBOARD · ${reserve.length}</span><div class="sbv2-zone-cards">${reserve.map(name=>cardChip(name,current)).join('')}</div></div>`:''}`;
  }

  function carrierCard(row,current,compact=false){
    return `<article class="sbv2-deck${compact?' sbv2-history-card':''}">
      <div class="sbv2-deck-head"><div><b><a href="${draftUrl(row.draftId)}">D${row.draftId}</a> · <a href="${playerUrl(row.player)}">${esc(row.player)}</a></b><small>${row.place?`#${row.place}`:'—'} · ${record(row)}</small></div><small>${row.zone==='sideboard'?'SIDEBOARD':'MAIN DECK'}${row.isWinner?' · 🏆':''}</small></div>
      ${zoneHtml(row,current)}
    </article>`;
  }

  function renderDecksAndHistory(profile,cardName){
    const rows=carriers(profile);
    const showcase=document.getElementById('cardDeckShowcase');
    if(showcase){
      const important=rows.slice().sort((a,b)=>Number(b.isWinner)-Number(a.isWinner)||(a.place||999)-(b.place||999)||num(b.draftId)-num(a.draftId)).slice(0,8);
      showcase.innerHTML=`<div class="sbv2-deck-grid">${important.map(row=>carrierCard(row,cardName)).join('')}</div>`;
    }
    const history=document.getElementById('cardHistoryCarousel');
    if(history){
      const ordered=rows.slice().sort((a,b)=>num(b.draftId)-num(a.draftId)||(a.place||999)-(b.place||999));
      history.innerHTML=`<div class="sbv2-history">${ordered.map(row=>carrierCard(row,cardName,true)).join('')}</div>`;
    }
  }

  function tagIndex(){
    const out={byId:{},categoryById:{}};
    if(typeof TAGS==='undefined'||!TAGS||typeof TAGS!=='object') return out;
    Object.entries(TAGS).forEach(([category,items])=>(Array.isArray(items)?items:[]).forEach(item=>{
      const id=normalize(item?.id); if(!id) return; out.byId[id]=item; out.categoryById[id]=category;
    }));
    return out;
  }
  function buildDna(profile,cardName){
    const idx=tagIndex();
    const rows=carriers(profile);
    const counts={};
    rows.forEach(row=>{
      const seen=new Set();
      unique(row.playerDeck||[]).filter(name=>normalize(name)!==normalize(cardName)).forEach(name=>{
        const meta=findCardMeta(name);
        (Array.isArray(meta?.tags)?meta.tags:[]).forEach(tag=>seen.add(normalize(tag)));
      });
      seen.forEach(tag=>{ counts[tag]=(counts[tag]||0)+1; });
    });
    const denominator=Math.max(1,rows.length);
    const byCategory={};
    Object.entries(counts).forEach(([id,count])=>{
      const category=idx.categoryById[id]; if(!category) return;
      (byCategory[category]||(byCategory[category]=[])).push({id,name:idx.byId[id]?.name||id,count,share:count/denominator});
    });
    Object.values(byCategory).forEach(list=>list.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pl')));
    return {rows,byCategory};
  }
  function renderDnaBars(target,rows){
    if(!target) return;
    const list=(rows||[]).slice(0,8);
    target.innerHTML=list.length?`<div class="sbv2-dna-bars">${list.map(row=>`<div class="sbv2-dna-row"><span>${esc(row.name)}</span><div class="sbv2-dna-track"><div class="sbv2-dna-fill" style="width:${Math.min(100,row.share*100)}%"></div></div><b>${pct(row.share)}</b></div>`).join('')}</div>`:'<div class="empty">Brak danych.</div>';
  }
  function renderDna(profile,cardName){
    const dna=buildDna(profile,cardName);
    const archetypesAndFamilies=[...(dna.byCategory.deckArchetypes||[]),...(dna.byCategory.mechanicFamilies||[])].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pl'));
    renderDnaBars(document.getElementById('dnaArchetypes'),archetypesAndFamilies);
    renderDnaBars(document.getElementById('dnaSubtypes'),dna.byCategory.subtypes);
    renderDnaBars(document.getElementById('dnaAbilities'),dna.byCategory.abilityTypes);
    renderDnaBars(document.getElementById('dnaThemes'),[...(dna.byCategory.teams||[]),...(dna.byCategory.themes||[])].sort((a,b)=>b.count-a.count));
    const hero=document.getElementById('cardDnaHero');
    if(hero){
      const top=[...archetypesAndFamilies,...(dna.byCategory.subtypes||[]),...(dna.byCategory.abilityTypes||[])].sort((a,b)=>b.count-a.count).slice(0,3);
      hero.innerHTML=`<div class="sbv2-facts">${top.map(row=>`<div class="sbv2-fact"><span>Najczęstsze środowisko</span><b>${esc(row.name)}</b><small>${pct(row.share)} decków graczy z kartą</small></div>`).join('')}</div>`;
    }
    const momentum=document.getElementById('dnaMomentum');
    if(momentum){
      const recent=(profile?.history||[]).slice().sort((a,b)=>num(b.id)-num(a.id)).slice(0,4);
      momentum.innerHTML=recent.map(row=>`<div class="sbv2-fact"><span>D${row.id}</span><b>${(row.carriers||[]).length} decków</b><small>${record(row)}</small></div>`).join('');
    }
  }

  function renderSignature(profile){
    const target=document.getElementById('signatureTwelveGrid');
    if(!target) return;
    const rows=(profile?.partners||[]).slice().sort((a,b)=>num(b.sharedDecks)-num(a.sharedDecks)||num(b.drafts)-num(a.drafts)).slice(0,12);
    target.innerHTML=`<div class="sbv2-mini-grid">${rows.map(row=>miniCard(row.name,`${num(row.sharedDecks)} wspólnych decków · ${num(row.drafts)} draftów`)).join('')}</div>`;
  }

  function applyCardPage(){
    if(!document.getElementById('cardTrajectoryChart')||typeof DraftStatsEngine==='undefined'||typeof database==='undefined'||typeof cardDatabase==='undefined') return false;
    const requested=currentCardName();
    const card=cardDatabase.find(item=>normalize(item?.name)===requested)||cardDatabase[0];
    if(!card) return false;
    const profile=DraftStatsEngine.calculateCardProfile(database.drafts,cardDatabase,card.name);
    if(!profile) return false;
    const render=()=>{
      renderTrajectory(profile);
      renderFinishes(profile);
      renderPilots(profile);
      renderDecksAndHistory(profile,card.name);
      renderDna(profile,card.name);
      renderSignature(profile);
    };
    render();
    // Legacy museum modules sometimes repaint just after DOMContentLoaded; win the final render pass.
    setTimeout(render,80);
    setTimeout(render,350);
    return true;
  }

  function renderPlayerSignature(profile){
    const rows=buildPlayerCardFrequency(profile);
    const top=rows.slice(0,12);
    const arsenal=document.getElementById('arsenalGrid');
    if(arsenal) arsenal.innerHTML=`<div class="sbv2-mini-grid">${top.map(row=>miniCard(row.name,`${row.appearances} draftów w decku gracza`)).join('')}</div>`;
    const chips=document.getElementById('arsenalChips');
    if(chips) chips.innerHTML=top.slice(0,8).map(row=>`<a class="sbv2-card-chip" href="${cardUrl(row.name)}">${esc(row.name)} · ${row.appearances}</a>`).join('');
    const signature=document.getElementById('signatureDeckGrid');
    if(signature) signature.innerHTML=`<div class="sbv2-mini-grid">${top.map(row=>miniCard(row.name,`${row.appearances} występów`)).join('')}</div>`;
    const summary=document.getElementById('signatureDeckSummary');
    if(summary) summary.textContent='12 kart najczęściej należących do decku gracza — Main Deck i Planetarna Rezerwa liczą się identycznie.';
    const lore=document.getElementById('fortressLoreGrid');
    if(lore){
      const sideboardPicks=(profile?.history||[]).reduce((sum,row)=>sum+(row.sideboard||[]).length,0);
      lore.innerHTML=`<div class="sbv2-facts">
        <div class="sbv2-fact"><span>Różne karty w karierze</span><b>${rows.length}</b></div>
        <div class="sbv2-fact"><span>Wybory Planetarnej Rezerwy</span><b>${sideboardPicks}</b></div>
        <div class="sbv2-fact"><span>Najczęstsza karta</span><b>${top[0]?esc(top[0].name):'—'}</b></div>
      </div>`;
    }
  }

  function renderFallbackHistory(container,profile){
    container.innerHTML=(profile?.history||[]).slice().sort((a,b)=>num(b.draftId)-num(a.draftId)).map(row=>`<article class="sbv2-player-fallback" data-draft-id="${row.draftId}">
      <h3><a href="${draftUrl(row.draftId)}">D${row.draftId}</a> · ${row.place?`#${row.place}`:'—'} · ${num(row.points)} pkt</h3>
      <small>${num(row.wins)}–${num(row.losses)} · ${pct(row.winRate)} WR · ✦ ${num(row.legendPoints)}</small>
      ${zoneHtml({mainDeck:row.deck,sideboard:row.sideboard},'')}
    </article>`).join('');
  }

  function patchRenderedPlayerHistory(profile){
    const container=document.getElementById('draftHistory');
    if(!container) return;
    if(!container.children.length){ renderFallbackHistory(container,profile); return; }
    (profile?.history||[]).forEach(row=>{
      const sideboard=unique(row.sideboard||[]); if(!sideboard.length) return;
      const candidates=[...container.children].filter(child=>new RegExp(`\\bD${row.draftId}\\b`,'i').test(child.textContent||''));
      const card=candidates[0]; if(!card||card.querySelector('[data-sideboard-v2]')) return;
      // Real deck photos already include the Sideboard manually. Only a genuinely
      // missing/broken thumbnail gets the textual Sideboard fallback. If the photo
      // is still loading, wait for its final load/error result instead of creating
      // a duplicate reserve block during a slow network fetch.
      const appendFallback=()=>{
        if(card.querySelector('[data-sideboard-v2]')) return;
        const block=document.createElement('div');
        block.className='sbv2-player-sideboard';
        block.dataset.sideboardV2='true';
        block.innerHTML=`<span class="sbv2-player-sideboard-label">PLANETARNA REZERWA · SIDEBOARD</span><div class="sbv2-player-sideboard-cards">${sideboard.map(name=>cardChip(name,'')).join('')}</div>`;
        card.appendChild(block);
      };
      const image=card.querySelector('img[src]');
      if(image){
        if(image.complete){
          if(image.naturalWidth>0) return;
          appendFallback();
          return;
        }
        if(!image.dataset.sideboardV2Watch){
          image.dataset.sideboardV2Watch='true';
          image.addEventListener('error',appendFallback,{once:true});
        }
        return;
      }
      appendFallback();
    });
  }

  function applyPlayerPage(){
    if(!document.getElementById('draftHistory')||typeof DraftStatsEngine==='undefined'||typeof database==='undefined') return false;
    const name=currentPlayerName(); if(!name) return false;
    const profile=DraftStatsEngine.calculatePlayerProfile(database.drafts,name); if(!profile) return false;
    const render=()=>{
      renderPlayerSignature(profile);
      patchRenderedPlayerHistory(profile);
    };
    render();
    // Some legacy player modules repaint after load; re-apply after their deferred passes.
    setTimeout(render,80);
    setTimeout(render,350);
    return true;
  }

  function apply(){
    if(typeof document==='undefined') return false;
    injectStyles();
    const card=applyCardPage();
    const player=applyPlayerPage();
    return card||player;
  }

  return Object.freeze({
    apply,
    carriers,
    buildFinishModel,
    buildTrajectoryModel,
    buildPlayerCardFrequency
  });
});
