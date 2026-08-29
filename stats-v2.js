(()=>{
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const integer=value=>Number.isFinite(Number(value))?Math.round(Number(value)).toLocaleString('pl-PL'):'Brak danych';
  const decimal=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1}):'Brak danych';
  const percent=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'Brak danych';
  const legendPoints=value=>`✦ ${integer(value)} Punktów Legend`;
  const playerUrl=name=>`player.html?name=${encodeURIComponent(name)}`;
  const cardUrl=name=>`card-stats.html?card=${encodeURIComponent(name)}`;
  const draftUrl=id=>`draft.html?id=${encodeURIComponent(id)}`;
  const knownCards=new Set((Array.isArray(cardDatabase)?cardDatabase:[]).map(card=>card?.name).filter(Boolean));
  const entityLink=(type,name,id)=>{
    const label=esc(name || (id?`D${id}`:'Brak danych'));
    if(type==='player'&&name)return `<a class="entity-link" href="${playerUrl(name)}">${label}</a>`;
    if(type==='card'&&name&&knownCards.has(name))return `<a class="entity-link" href="${cardUrl(name)}">${label}</a>`;
    if(type==='draft'&&id)return `<a class="entity-link" href="${draftUrl(id)}">${label}</a>`;
    return `<span class="entity-link">${label}</span>`;
  };
  const setHtml=(id,html)=>{const node=document.getElementById(id);if(node)node.innerHTML=html;};

  let archive;
  try{
    archive=window.DraftStatsEngine.buildArchiveSnapshot({drafts:database.drafts,cards:cardDatabase,tags:(typeof TAGS!=='undefined'?TAGS:{})});
  }catch(error){
    console.error('Gwiezdne Archiwum v2:',error);
    return;
  }

  const totals=archive.totals;
  const counters=[
    [totals.drafts,'Drafty',`${integer(totals.finishedDrafts)} ukończonych · ${integer(totals.activeDrafts)} aktywnych`],
    [totals.players,'Unikalni wojownicy','w zapisanych składach'],
    [totals.storedMatches,'Oficjalne wyniki',`${integer(totals.playedMatches)} realnie rozegranych`],
    [totals.playedMatches,'Realnie rozegrane bitwy','bez walkowerów'],
    [totals.decks,'Zapisane decki','Main Deck + opcjonalna Planetarna Rezerwa'],
    [`${integer(totals.deckCards)} / ${integer(totals.availableCards)}`,'Użyte karty','pokrycie obecnej kolekcji']
  ];
  setHtml('globalCounters',counters.map(([value,label,sub])=>{
    const displayValue = typeof value === 'string' ? value : integer(value);
    return `<article class="counter glass"><b>${esc(displayValue)}</b><span>${esc(label)}</span><small>${esc(sub)}</small></article>`;
  }).join(''));

  setHtml('legendHall',(archive.legend?.top||[]).map((player,index)=>`<article class="legend-hero" data-rank="#${index+1}">${entityLink('player',player.name)}<b>${legendPoints(player.legendPoints)}</b><small>${integer(player.draftWins)} tytułów · ${integer(player.draftPoints)} punktów draftowych</small></article>`).join('')||'<div class="empty">Brak Rankingu Legend.</div>');

  function podiumRows(rows,type,valueGetter,formatter){
    const list=Array.isArray(rows)?rows:[];
    if(!list.length)return '<div class="empty">Brak wystarczających danych.</div>';
    const values=list.map(valueGetter).map(Number).filter(Number.isFinite);
    const max=Math.max(...values.map(Math.abs),1);
    return list.map((row,index)=>{
      const value=Number(valueGetter(row));
      const fill=Math.max(6,Math.round((Math.abs(value)/max)*100));
      const place=row.statPlace||index+1;
      return `<div class="podium-row" style="--fill:${fill}%"><span class="podium-rank">${place}</span>${entityLink(type,row.name,row.id)}<span class="podium-value">${esc(formatter(value,row))}</span></div>`;
    }).join('');
  }
  const metric=(title,rows,type,valueGetter,formatter)=>`<section class="metric"><h4>${esc(title)}</h4>${podiumRows(rows,type,valueGetter,formatter)}</section>`;
  const P=archive.records.players;
  setHtml('playerSuccess',
    metric('Zwycięstwa draftów',P.success.draftWins,'player',x=>x.draftWins,v=>`${integer(v)} tytułów`)+
    metric('Podia',P.success.podiums,'player',x=>x.podiums,v=>`${integer(v)} podiów`)+
    metric(`Odsetek podiów · min. ${archive.thresholds.podiumRateDrafts} drafty`,P.success.podiumRate,'player',x=>x.podiumRate,v=>percent(v))+
    metric(`Najlepsza średnia miejsca · min. ${archive.thresholds.finishDrafts} drafty`,P.success.averageFinish,'player',x=>x.averageFinish,v=>`#${decimal(v)}`)
  );
  setHtml('playerEffectiveness',
    metric(`Najwyższy WR · min. ${archive.thresholds.playerWinRateMatches} meczów`,P.effectiveness.winRate,'player',x=>x.playedWinRate,(v,row)=>`${percent(v)} · ${row.playedWins}–${row.playedLosses}`)+
    metric('Najwięcej zwycięstw w realnych bitwach',P.effectiveness.wins,'player',x=>x.playedWins,v=>`${integer(v)} zwycięstw`)+
    metric('Najwięcej rozegranych meczów',P.effectiveness.matches,'player',x=>x.playedMatches,v=>`${integer(v)} meczów · bez walkowerów`)+
    metric(`Najwyższa średnia punktów draftowych · min. ${archive.thresholds.finishDrafts} drafty`,P.effectiveness.averageDraftPoints,'player',x=>x.averageDraftPoints,v=>`${decimal(v)} pkt / draft`)
  );
  setHtml('playerAccumulation',
    metric('Najwięcej Punktów Legend',P.accumulation.legendPoints,'player',x=>x.legendPoints,v=>legendPoints(v))+
    metric('Najwięcej punktów draftowych',P.accumulation.draftPoints,'player',x=>x.draftPoints,v=>`${integer(v)} punktów`)+
    metric('Najwięcej punktów zdobytych w porażkach',P.accumulation.lossPoints,'player',x=>x.lossPoints,v=>`${integer(v)} punktów`)+
    metric('Najwięcej ukończonych draftów',P.accumulation.drafts,'player',x=>x.drafts,v=>`${integer(v)} występów`)
  );
  setHtml('veteransArchive',`<div class="veteran-list">${P.success.drafts.map(row=>`<span class="veteran-chip">${entityLink('player',row.name)} · ${integer(row.drafts)} draftów</span>`).join('')}</div>`);

  const SP=archive.records.performances || {};
  const performanceMetric=(title,rows,valueFormatter)=>`<article class="record-cell glass"><h3>${esc(title)}</h3>${(rows||[]).length?(rows||[]).map((row,index)=>`<div class="podium-row"><span class="podium-rank">${row.statPlace||index+1}</span><span>${entityLink('player',row.player||row.name)}<small style="display:block;opacity:.68;margin-top:3px">${entityLink('draft',`D${row.draftId}`,row.draftId)} · #${integer(row.place)}</small></span><span class="podium-value">${esc(valueFormatter(row))}</span></div>`).join(''):'<div class="empty">Brak porównywalnych danych</div>'}</article>`;
  setHtml('singleDraftRecords',
    performanceMetric('Najwięcej punktów draftowych w jednej edycji',SP.draftPoints,row=>`${integer(row.points)} pkt · ${integer(row.wins)}W–${integer(row.losses)}L`)+
    performanceMetric('Najwięcej zwycięstw w jednej edycji',SP.wins,row=>`${integer(row.wins)} W · ${percent(row.winRate)} WR`)+
    performanceMetric('Drafty bez porażki',SP.undefeatedDraft,row=>`${integer(row.wins)}–0 · bez porażki`)+
    performanceMetric('Najdłuższy perfekcyjny run',SP.perfectRun,row=>`${integer(row.battle?.longestWinRun||0)} zwycięstw z rzędu`)+
    performanceMetric('Najwięcej czystych zwycięstw',SP.cleanWins,row=>`${integer(row.battle?.cleanWins || 0)} × 25–0`)+
    performanceMetric('Najwyższa skuteczność punktowa',SP.scoreEfficiency,row=>`${percent(row.scoreEfficiency)} możliwych punktów`)
  );

  const C=archive.records.cards;
  setHtml('cardPopularity',
    metric('Najwięcej występów w deckach graczy',C.popularity.appearances,'card',x=>x.appearances,v=>`${integer(v)} decków`)+
    metric('Najwięcej różnych ukończonych draftów',C.popularity.drafts,'card',x=>x.drafts,v=>`${integer(v)} draftów`)+
    metric('Najwięcej różnych właścicieli',C.popularity.owners,'card',x=>x.owners,v=>`${integer(v)} pilotów`)
  );
  setHtml('cardEffectiveness',
    metric(`Najlepszy WR · min. ${archive.thresholds.cardWinRateMatches} meczów`,C.effectiveness.winRate,'card',x=>x.winRate,(v,row)=>`${percent(v)} · ${row.wins}–${row.losses}`)+
    metric('Najwięcej realnych zwycięstw',C.effectiveness.wins,'card',x=>x.wins,v=>`${integer(v)} W`)+
    metric('Najwięcej realnych bitew',C.effectiveness.matches,'card',x=>x.matches,v=>`${integer(v)} meczów`)
  );
  setHtml('cardSuccess',
    metric('Najwięcej Punktów Legend',C.success.legendPoints,'card',x=>x.legendPoints,v=>legendPoints(v))+
    metric('Najwięcej zwycięskich decków graczy',C.success.draftWins,'card',x=>x.draftWins,v=>`${integer(v)} tytułów`)+
    metric('Najwięcej podiów',C.success.podiums,'card',x=>x.podiums,v=>`${integer(v)} podiów`)
  );
  setHtml('cardPilots',(C.pilots||[]).map((pilot,index)=>`<div class="pilot-row"><span>#${index+1}</span><b>${entityLink('player',pilot.player)} × ${entityLink('card',pilot.card)}</b><span>${integer(pilot.appearances)} wspólnych decków gracza · ${percent(pilot.share)} użyć karty</span></div>`).join('')||'<div class="empty">Brak relacji pilota.</div>');
  setHtml('cardPairs',C.pairs.length?C.pairs.map((pair,index)=>`<div class="duet-row"><span>#${index+1}</span><b>${entityLink('card',pair.cardA)} + ${entityLink('card',pair.cardB)}</b><span>${integer(pair.decks)} decków · ${integer(pair.drafts)} draftów</span></div>`).join(''):'<div class="empty">Brak danych o duetach.</div>');

  const Decks=archive.records.decks || {};
  const Meta=archive.records.meta || {};

  const deckRecord=(title,rows,formatter)=>{
    const row=rows?.[0];
    if(!row)return `<div class="deck-record-card"><h4>${esc(title)}</h4><div class="empty">Brak wystarczających danych.</div></div>`;
    const tied=(rows||[]).filter(item=>(item.statPlace||1)===1).slice(1);
    return `<div class="deck-record-card">
      <h4>${esc(title)}</h4>
      <div class="deck-record-main">
        <strong>${entityLink('player',row.player||row.name)} · ${entityLink('draft',`D${row.draftId}`,row.draftId)}</strong>
        <span>${esc(formatter(row))}</span>
      </div>
      <small class="deck-record-sub">${row.primaryArchetype?`Główny archetyp: ${esc(row.primaryArchetype)}`:''}${tied.length?` · ex aequo: ${tied.map(item=>`${esc(item.player)} D${item.draftId}`).join(', ')}`:''}</small>
    </div>`;
  };

  setHtml('deckRecords',
    deckRecord('Najbardziej spójny archetypowo deck',Decks.cohesion,row=>`${integer(row.primaryCount)}/${integer(row.deckSize)} kart jednego archetypu`)+
    deckRecord('Najbardziej hybrydowy deck',Decks.hybrid,row=>`${integer(row.hybridArchetypeCount)} archetypów z min. ${integer(archive.thresholds.deckArchetypeCards)} kartami`)+
    deckRecord('Najbardziej spójny deck mistrzowski',Decks.championCohesion,row=>`${integer(row.primaryCount)}/${integer(row.deckSize)} kart jednego archetypu`)+
    deckRecord('Najbardziej hybrydowy deck mistrzowski',Decks.championHybrid,row=>`${integer(row.hybridArchetypeCount)} archetypów z min. ${integer(archive.thresholds.deckArchetypeCards)} kartami`)
  );

  const metaList=(title,rows,formatter)=>`<div class="deck-record-card"><h4>${esc(title)}</h4>${(rows||[]).length?(rows||[]).map((row,index)=>`
    <div class="meta-row">
      <span class="meta-rank">${row.statPlace||index+1}</span>
      <span><b>${esc(row.name)}</b><small>${integer(row.drafts)} draftów · ${integer(row.players)} graczy</small></span>
      <span class="meta-value">${esc(formatter(row))}</span>
    </div>`).join(''):'<div class="empty">Brak wystarczających danych.</div>'}</div>`;

  setHtml('metaRecords',
    metaList('Najczęściej budowane archetypy',Meta.popularArchetypes,row=>`${integer(row.decks)} decków`)+
    metaList('Najczęstsze archetypy mistrzów',Meta.championArchetypes,row=>`${integer(row.championDecks)} zwycięskich decków`)+
    metaList('Najbardziej uniwersalne archetypy',Meta.widespreadArchetypes,row=>`${integer(row.players)} różnych graczy`)
  );

  const miniStatDeck=(title,subtitle,cards,statFormatter)=>`<section class="stat-deck"><header><h4>${esc(title)}</h4><small>${esc(subtitle)}</small></header><div class="mini-deck-grid">${(cards||[]).map((card,index)=>`<a class="mini-stat-card" href="${cardUrl(card.name)}" title="${esc(card.name)}"><span class="mini-rank">${index+1}</span><b class="mini-card-name">${esc(card.name)}</b><span class="mini-card-stat">${esc(statFormatter(card))}</span></a>`).join('')}</div></section>`;
  setHtml('deckShowcases',
    `<div class="stat-decks">`+
    miniStatDeck('Dwunastka Popularności','12 kart najczęściej obecnych w deckach graczy',Decks.showcases?.popular,card=>`${integer(card.appearances)} decków`)+
    miniStatDeck('Legendarna Dwunastka','12 kart z największą liczbą Punktów Legend',Decks.showcases?.legendary,card=>`✦ ${integer(card.legendPoints)}`)+
    `</div>`
  );

  const D=archive.records.drafts;
  const draftRecordCard=(title,rows,format)=>{
    const row=rows?.[0];
    const tied=(rows||[]).filter(item=>(item.statPlace||1)===1).slice(1);
    return row
      ? `<article class="record-cell glass" data-draft="D${row.id}"><h3>${esc(title)}</h3><div class="record-main">${entityLink('draft',row.label,row.id)}</div><span class="record-value">${esc(format(row))}</span>${tied.length?`<div class="record-sub"><span>Ex aequo</span><span>${tied.map(item=>entityLink('draft',item.label,item.id)).join(' · ')}</span></div>`:''}</article>`
      : `<article class="record-cell glass"><h3>${esc(title)}</h3><div class="empty">Brak porównywalnych danych</div></article>`;
  };
  const draftGroups=[
    {
      title:'Skala i różnorodność',
      note:'Jak duże były edycje i jak szeroko wykorzystywały pulę kart.',
      records:[
        ['Największa edycja',D.largest,x=>`${integer(x.players)} graczy`],
        ['Najmniejsza edycja',D.smallest,x=>`${integer(x.players)} graczy`],
        ['Najwięcej różnych kart',D.uniqueCards,x=>`${integer(x.uniqueCards)} unikalnych kart`],
        ['Najmniej powtórzeń kart',D.diversityRate,x=>`${percent(x.diversityRate)} slotów było unikalnych`]
      ]
    },
    {
      title:'Walka o tytuł i tabela',
      note:'Jak mocno mistrz odjechał stawce oraz jak ciasno ułożyła się cała klasyfikacja.',
      records:[
        ['Największa przewaga mistrza',D.dominance,x=>`${percent(x.normalizedWinnerGap)} maksymalnego wyniku`],
        ['Najciaśniejsza walka o tytuł',D.closestTitle,x=>`${percent(x.normalizedWinnerGap)} różnicy`],
        ['Najbardziej wyrównana stawka',D.balance,x=>`${decimal(x.balanceIndex)} / 100`],
        ['Największe rozwarstwienie tabeli',D.standingsSpread,x=>`${percent(x.normalizedPointSpread)} pełnej skali punktów`]
      ]
    },
    {
      title:'Charakter pojedynków',
      note:'Nie pojedynczy wynik, lecz średni przebieg wszystkich realnie rozegranych starć w edycji.',
      records:[
        ['Najbardziej wyrównane pojedynki',D.balancedBattles,x=>`${decimal(x.averageBattleMargin)} pkt średniej różnicy`],
        ['Największe różnice w pojedynkach',D.oneSided,x=>`${decimal(x.averageBattleMargin)} pkt średniej różnicy`]
      ]
    }
  ];
  setHtml('draftRecords',draftGroups.map(group=>`
    <section class="draft-record-group">
      <div class="draft-record-group-head"><h3>${esc(group.title)}</h3><span>${esc(group.note)}</span></div>
      <div class="draft-record-grid">${group.records.map(([title,rows,format])=>draftRecordCard(title,rows,format)).join('')}</div>
    </section>
  `).join(''));

  const R=archive.records.rivalries;
  setHtml('rivalryNetwork',R.mostMeetings.length?R.mostMeetings.map(pair=>`<div class="versus-row"><div class="fighter">${entityLink('player',pair.playerA)}<small>${integer(pair.winsA)} zwycięstw</small></div><div class="vs-node">VS</div><div class="fighter">${entityLink('player',pair.playerB)}<small>${integer(pair.winsB)} zwycięstw</small></div></div>`).join(''):'<div class="empty">Brak pełnych rywalizacji.</div>');
  const rivalryMinimum=archive.thresholds.rivalryMatches;
  const readouts=[
    ['Najbardziej wyrównana',`Najmniejsza różnica zwycięstw przy min. ${rivalryMinimum} realnych meczach.`,R.closest?.[0]],
    ['Najbardziej jednostronna',`Największa różnica zwycięstw przy min. ${rivalryMinimum} realnych meczach.`,R.oneSided?.[0]],
    ['Najwięcej zwycięstw nad jednym rywalem','Największa liczba wygranych jednego gracza przeciw tej samej osobie.',R.mostWinsAgainst?.[0]]
  ];
  setHtml('rivalryReadouts',readouts.map(([label,description,row])=>`<div class="readout"><span>${esc(label)}</span><small>${esc(description)}</small>${row?`<b>${entityLink('player',row.playerA)} vs ${entityLink('player',row.playerB)}</b><em>${integer(row.matches)} meczów · ${integer(row.winsA)}–${integer(row.winsB)}</em>`:'<b>Brak danych</b>'}</div>`).join(''));

  const palette=['#00f0ff','#ffd66b','#c76fff','#ff62c8','#62ffa5'];
  function lineChart(rows,valueGetter,labelGetter,options={}){
    if(!rows?.length)return '<div class="empty">Brak danych trendu.</div>';
    const width=760,height=245,padX=34,padY=24,innerW=width-padX*2,innerH=height-padY*2;
    const values=rows.map(valueGetter).filter(Number.isFinite);
    const min=options.zero?0:Math.min(...values,0),max=Math.max(...values,1);
    const xAt=index=>rows.length===1?width/2:padX+(index/(rows.length-1))*innerW;
    const yAt=value=>height-padY-((Number(value)-min)/Math.max(.0001,max-min))*innerH;
    const path=rows.map((row,index)=>`${index?'L':'M'}${xAt(index).toFixed(1)},${yAt(valueGetter(row)).toFixed(1)}`).join(' ');
    const step=Math.max(1,Math.ceil(rows.length/10));
    const labels=rows.map((row,index)=>(index%step===0||index===rows.length-1)?`<text class="chart-label" x="${xAt(index)}" y="${height-5}" text-anchor="middle">${esc(labelGetter(row))}</text>`:'').join('');
    const dots=rows.map((row,index)=>`<circle class="chart-dot" cx="${xAt(index)}" cy="${yAt(valueGetter(row))}" r="3.5" stroke="${options.color||palette[0]}"><title>${esc(labelGetter(row))}: ${decimal(valueGetter(row))}</title></circle>`).join('');
    return `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img"><path class="bump-line" stroke="${options.color||palette[0]}" d="${path}"/>${dots}${labels}</svg>${options.note?`<p class="chart-note">${esc(options.note)}</p>`:''}`;
  }
  function bumpChart(){
    const rows=archive.trends.legendEvolution||[],names=archive.legend?.focus||[];
    if(!rows.length||!names.length)return '<div class="empty">Brak danych ewolucji.</div>';
    const width=900,height=260,padX=44,padY=28,innerW=width-padX*2,innerH=height-padY*2,maxRank=Math.max(5,...rows.flatMap(row=>Object.values(row.ranks||{}).filter(Number.isFinite)));
    const xAt=index=>rows.length===1?width/2:padX+(index/(rows.length-1))*innerW;
    const yAt=rank=>padY+((rank-1)/Math.max(1,maxRank-1))*innerH;
    const lines=names.map((name,nameIndex)=>{
      const points=rows.map((row,index)=>({index,rank:row.ranks?.[name]})).filter(point=>Number.isFinite(point.rank));
      if(!points.length)return '';
      const path=points.map((point,index)=>`${index?'L':'M'}${xAt(point.index).toFixed(1)},${yAt(point.rank).toFixed(1)}`).join(' ');
      return `<path class="bump-line" stroke="${palette[nameIndex]}" d="${path}"/>${points.map(point=>`<circle class="bump-dot" cx="${xAt(point.index)}" cy="${yAt(point.rank)}" r="4" stroke="${palette[nameIndex]}"><title>${esc(name)} · D${rows[point.index].id} · #${point.rank}</title></circle>`).join('')}`;
    }).join('');
    const rankLabels=Array.from({length:maxRank},(_,index)=>`<text class="chart-axis-label" x="12" y="${yAt(index+1)+4}">#${index+1}</text>`).join('');
    const step=Math.max(1,Math.ceil(rows.length/10));
    const draftLabels=rows.map((row,index)=>(index%step===0||index===rows.length-1)?`<text class="chart-label" x="${xAt(index)}" y="${height-6}" text-anchor="middle">D${row.id}</text>`:'').join('');
    return `<div class="legend">${names.map((name,index)=>`<span><i style="background:${palette[index]}"></i>${esc(name)}</span>`).join('')}</div><svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ewolucja pozycji Top 5 Rankingu Legend">${rankLabels}${lines}${draftLabels}</svg>`;
  }
  function dualLineChart(rows,series,labelGetter,options={}){
    if(!rows?.length)return '<div class="empty">Brak danych trendu.</div>';
    const width=760,height=245,padX=34,padY=24,innerW=width-padX*2,innerH=height-padY*2;
    const values=series.flatMap(item=>rows.map(item.getter)).filter(Number.isFinite);
    const min=options.zero?0:Math.min(...values,0),max=Math.max(...values,1);
    const xAt=index=>rows.length===1?width/2:padX+(index/(rows.length-1))*innerW;
    const yAt=value=>height-padY-((Number(value)-min)/Math.max(.0001,max-min))*innerH;
    const paths=series.map(item=>{
      const path=rows.map((row,index)=>`${index?'L':'M'}${xAt(index).toFixed(1)},${yAt(item.getter(row)).toFixed(1)}`).join(' ');
      const dots=rows.map((row,index)=>`<circle class="chart-dot" cx="${xAt(index)}" cy="${yAt(item.getter(row))}" r="3" stroke="${item.color}"><title>${esc(item.label)} · ${esc(labelGetter(row))}: ${decimal(item.getter(row))}</title></circle>`).join('');
      return `<path class="bump-line" stroke="${item.color}" d="${path}"/>${dots}`;
    }).join('');
    const step=Math.max(1,Math.ceil(rows.length/10));
    const labels=rows.map((row,index)=>(index%step===0||index===rows.length-1)?`<text class="chart-label" x="${xAt(index)}" y="${height-5}" text-anchor="middle">${esc(labelGetter(row))}</text>`:'').join('');
    return `<div class="legend">${series.map(item=>`<span><i style="background:${item.color}"></i>${esc(item.label)}</span>`).join('')}</div><svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img">${paths}${labels}</svg>${options.note?`<p class="chart-note">${esc(options.note)}</p>`:''}`;
  }

  setHtml('legendEvolution',bumpChart());
  setHtml('attendanceChart',lineChart(archive.trends.attendance,row=>row.players,row=>`D${row.id}`,{color:palette[0],zero:true,note:'Liczba graczy biorących udział w kolejnych ukończonych edycjach.'}));
  setHtml('cardUseChart',dualLineChart(
    archive.trends.cardUse||[],
    [
      {label:'Unikalne karty',color:palette[0],getter:row=>row.uniqueCards},
      {label:'Powtórzone sloty',color:palette[2],getter:row=>row.repeatedDeckSlots}
    ],
    row=>`D${row.id}`,
    {zero:true,note:'Unikalne karty w deckach graczy kontra sloty zajęte przez karty powtarzające się między deckami graczy.'}
  ));
  setHtml('averagePointsChart',lineChart(archive.trends.averagePoints,row=>row.averagePlayerPoints,row=>`D${row.id}`,{color:palette[1],zero:true,note:'Średnia liczba punktów draftowych przypadająca na jednego gracza w edycji.'}));
  setHtml('championCountChart',lineChart(archive.trends.champions,row=>row.uniqueChampions,row=>`D${row.id}`,{color:palette[4],zero:true,note:'Narastająca liczba różnych osób, które co najmniej raz wygrały ukończony draft.'}));

  const sanitizeDeckOwner=name=>String(name||'').toLowerCase().replace(/ /g,'').replace(/\./g,'');
  const deckImagePath=(name,draftId)=>`assets/decks/${sanitizeDeckOwner(name)}_${draftId}.jpg`;
  const dateLabel=row=>row.startDate?(row.endDate&&row.endDate!==row.startDate?`${row.startDate} — ${row.endDate}`:row.startDate):'Brak daty';
  setHtml('timeline',archive.timeline.map(row=>{
    const deckThumb = row.status==='finished' && row.winner ? deckImagePath(row.winner,row.id) : '';
    const deckStyle = deckThumb ? ` style="--deck-thumb:url('${esc(deckThumb)}')"` : '';
    return `<article class="timeline-card glass ${row.status==='active'?'active':''}"${deckStyle}><div class="timeline-top"><a href="${draftUrl(row.id)}">D${row.id}</a><span class="status-chip">${row.status==='active'?'aktywny':'ukończony'}</span></div><div class="timeline-mode">${esc(row.mode)}</div><div class="timeline-meta"><span>${esc(dateLabel(row))}</span><span>${integer(row.players)} graczy</span><span>${integer(row.matches)} meczów</span></div><div class="timeline-winner">${row.status==='finished'&&row.winner?`Zwycięzca: ${entityLink('player',row.winner)}`:'Nierozstrzygnięty'}</div></article>`;
  }).join(''));
  setHtml('curiosityGrid',archive.curiosities.length?archive.curiosities.map(item=>{
    const entity=item.entity||{};
    return `<article class="curiosity glass"><h3>${esc(item.title)}</h3>${entityLink(entity.type,item.value,entity.id)}<p>${esc(item.detail)}</p></article>`;
  }).join(''):'<div class="empty">Brak potwierdzonych anomalii.</div>');
})();
