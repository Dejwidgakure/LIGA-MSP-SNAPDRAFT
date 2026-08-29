(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.DraftStatsEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const MATCH_TYPES = Object.freeze({
    PLAYED: 'played',
    WALKOVER: 'walkover',
    DOUBLE_WALKOVER: 'doubleWalkover'
  });

  const DRAFT_STATUSES = Object.freeze({
    ACTIVE: 'active',
    FINISHED: 'finished'
  });

  const VALID_MATCH_TYPES = new Set(Object.values(MATCH_TYPES));
  const VALID_DRAFT_STATUSES = new Set(Object.values(DRAFT_STATUSES));

  // Canonical MSP SnapDraft Legend system. Legend Points are derived data:
  // database.js stores historical facts, while the engine owns the scoring model.
  const LEGEND_POINTS = Object.freeze({
    1: 8,
    2: 4,
    3: 3,
    4: 2,
    5: 1
  });
  const MIN_LEGEND_DRAFTS = 2;

  // Shared sample thresholds for the statistics layer. Patch A uses player
  // rivalry thresholds; the remaining values reserve one canonical source
  // for the card/global layers added by later patches.
  const SAMPLE_THRESHOLDS = Object.freeze({
    PLAYER_RIVALRY_MATCHES:3,
    GLOBAL_RIVALRY_MATCHES:5,
    GLOBAL_PLAYER_WR_MATCHES:10,
    GLOBAL_CARD_WR_MATCHES:20,
    GLOBAL_FINISH_DRAFTS:3,
    GLOBAL_PODIUM_RATE_DRAFTS:3,
    CARD_PILOT_DRAFTS:2,
    CARD_PARTNER_DRAFTS:2,
    CARD_MATCHUP_MATCHES:5,
    GLOBAL_CARD_MATCHUP_MATCHES:8
  });


  // Canonical rules exposed to every presentation layer. Pages should render
  // these rules rather than re-implementing statistical definitions locally.
  const STAT_RULES = Object.freeze({
    HISTORICAL_STATS_FINISHED_DRAFTS_ONLY:true,
    BATTLE_LIFE_SCORING_SYSTEM:'standard25',
    BATTLE_TOTAL_POINTS:25,
    CLEAN_WIN_WINNER_POINTS:25,
    CLEAN_WIN_LOSER_POINTS:0,
    LAST_LIFE_WIN_WINNER_POINTS:16,
    LAST_LIFE_WIN_LOSER_POINTS:9,
    PLAYER_RIVALRY_MIN_MATCHES:SAMPLE_THRESHOLDS.PLAYER_RIVALRY_MATCHES,
    GLOBAL_RIVALRY_MIN_MATCHES:SAMPLE_THRESHOLDS.GLOBAL_RIVALRY_MATCHES,
    GLOBAL_PLAYER_WR_MIN_MATCHES:SAMPLE_THRESHOLDS.GLOBAL_PLAYER_WR_MATCHES,
    GLOBAL_CARD_WR_MIN_MATCHES:SAMPLE_THRESHOLDS.GLOBAL_CARD_WR_MATCHES,
    CARD_PILOT_MIN_DRAFTS:SAMPLE_THRESHOLDS.CARD_PILOT_DRAFTS,
    CARD_PARTNER_MIN_DRAFTS:SAMPLE_THRESHOLDS.CARD_PARTNER_DRAFTS,
    CARD_MATCHUP_MIN_MATCHES:SAMPLE_THRESHOLDS.CARD_MATCHUP_MATCHES,
    GLOBAL_CARD_MATCHUP_MIN_MATCHES:SAMPLE_THRESHOLDS.GLOBAL_CARD_MATCHUP_MATCHES
  });

  const STAT_DEFINITIONS = Object.freeze({
    legendRank:Object.freeze({
      label:'Ranga Legend',
      description:'Pozycja zawodnika w kanonicznym Rankingu Legend. Do rankingu kwalifikują się zawodnicy z co najmniej dwoma ukończonymi draftami.'
    }),
    legendPoints:Object.freeze({
      label:'Punkty Legend',
      description:'Punkty prestiżu przyznawane za miejsca 1–5 w ukończonych draftach według systemu 8 / 4 / 3 / 2 / 1.'
    }),
    draftPoints:Object.freeze({
      label:'Punkty draftowe',
      description:'Łączna liczba punktów zdobytych przez zawodnika w tabelach ukończonych draftów.'
    }),
    winRate:Object.freeze({
      label:'Win Rate',
      description:'Odsetek zwycięstw w rozstrzygniętych meczach. W interfejsie powinien być prezentowany razem z bilansem W–L, gdy pozwala na to miejsce.'
    }),
    officialMatches:Object.freeze({
      label:'Mecze oficjalne',
      description:'Wszystkie zapisane rozstrzygnięcia turniejowe zawodnika w ukończonych draftach, w tym walkovery i podwójne walkovery.'
    }),
    playedMatches:Object.freeze({
      label:'Rozegrane mecze',
      description:'Mecze oznaczone jako normalnie rozegrane, bez walkowerów i podwójnych walkowerów.'
    }),
    cleanWin:Object.freeze({
      label:'Czyste zwycięstwo',
      description:'Realnie rozegrany mecz w systemie standard25 zakończony wynikiem 25–0. Walkovery i starsze systemy punktacji są wykluczone.'
    }),
    cleanLoss:Object.freeze({
      label:'Czysta porażka',
      description:'Realnie rozegrany mecz w systemie standard25 zakończony dla zawodnika wynikiem 0–25.'
    }),
    lastLifeWin:Object.freeze({
      label:'Zwycięstwo o włos',
      description:'Realnie rozegrany mecz standard25 wygrany 16–9, czyli zwycięstwo z jednym zachowanym życiem.'
    }),
    lastLifeLoss:Object.freeze({
      label:'Porażka o włos',
      description:'Realnie rozegrany mecz standard25 przegrany 9–16, czyli porażka po odebraniu rywalowi dziewięciu żyć.'
    }),
    archrival:Object.freeze({
      label:'Arcyrival',
      description:'Rywal, z którym zawodnik rozegrał najwięcej prawdziwych bezpośrednich meczów. Walkovery nie zwiększają liczby spotkań H2H.'
    }),
    dominatedOpponent:Object.freeze({
      label:'Pogromca',
      description:'Rywal, przeciwko któremu zawodnik ma najwyższy H2H Win Rate przy wymaganej minimalnej liczbie realnie rozegranych spotkań.'
    }),
    nemesis:Object.freeze({
      label:'Nemesis',
      description:'Rywal, przeciwko któremu zawodnik ma najniższy H2H Win Rate przy wymaganej minimalnej liczbie realnie rozegranych spotkań.'
    }),
    closestRival:Object.freeze({
      label:'Wyrównany rywal',
      description:'Rywal, przeciwko któremu H2H Win Rate zawodnika jest najbliższy 50% przy wymaganej minimalnej próbce.'
    }),
    averageFinish:Object.freeze({
      label:'Średnie miejsce',
      description:'Średnia pozycja końcowa zawodnika we wszystkich jego ukończonych draftach.'
    }),
    averageFinishPercentile:Object.freeze({
      label:'Pozycja po uwzględnieniu wielkości edycji',
      description:'Pomocniczy wskaźnik techniczny porównujący miejsce z wielkością edycji. Nie jest domyślnie eksponowany graczom.'
    }),
    titleRate:Object.freeze({
      label:'Odsetek zwycięskich edycji',
      description:'Odsetek ukończonych draftów zawodnika zakończonych zwycięstwem całej edycji.'
    }),
    podiumRate:Object.freeze({
      label:'Odsetek podiów',
      description:'Odsetek ukończonych draftów zawodnika zakończonych miejscem w pierwszej trójce.'
    }),
    top5Rate:Object.freeze({
      label:'Top 5 Rate',
      description:'Odsetek ukończonych draftów zawodnika zakończonych miejscem w Top 5.'
    }),
    cardAppearance:Object.freeze({
      label:'Występ karty',
      description:'Obecność karty w finalnym decku zawodnika zapisanym w bazie. Nie należy automatycznie utożsamiać jej z historycznym pickiem.'
    }),
    cardLegendPoints:Object.freeze({
      label:'Punkty Legend karty',
      description:'Suma Punktów Legend zdobytych przez finalne decki zawierające tę kartę.'
    })
  });

  function hasOwn(object, key){
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function numberOrZero(value){
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function isFinitePointValue(value){
    return Number.isFinite(Number(value));
  }

  function normalizeName(value){
    return String(value || '').trim();
  }

  function pairKey(firstName, secondName){
    return [normalizeName(firstName), normalizeName(secondName)].sort().join('::');
  }

  function getScoringSystem(draftOrId){
    if(draftOrId && typeof draftOrId === 'object'){
      const system = normalizeName(draftOrId?.scoring?.system);
      return system || null;
    }
    return null;
  }

  function supportsBattleLifeStats(draftOrId){
    // Canonical Battle-life statistics are only reconstructible from the
    // standard25 system: winner = 15 + remaining lives, loser = lives taken.
    return getScoringSystem(draftOrId) === 'standard25';
  }

  function supportsCleanWins(draftOrId){
    // Backwards-compatible alias retained for existing consumers.
    return supportsBattleLifeStats(draftOrId);
  }

  function normalizeExplicitType(value){
    if(value === MATCH_TYPES.WALKOVER) return MATCH_TYPES.WALKOVER;
    if(value === MATCH_TYPES.DOUBLE_WALKOVER) return MATCH_TYPES.DOUBLE_WALKOVER;
    return MATCH_TYPES.PLAYED;
  }

  function isBareHistoricalDoubleWalkover(match){
    return !hasOwn(match,'resultType') &&
      isFinitePointValue(match?.pts1) &&
      isFinitePointValue(match?.pts2) &&
      Number(match.pts1) === 0 &&
      Number(match.pts2) === 0;
  }

  function isValidStandard25Score(match){
    if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return false;
    const pts1 = Number(match.pts1);
    const pts2 = Number(match.pts2);
    if(!Number.isInteger(pts1) || !Number.isInteger(pts2) || pts1 === pts2) return false;
    const winnerPoints = Math.max(pts1,pts2);
    const loserPoints = Math.min(pts1,pts2);
    return winnerPoints >= 16 && winnerPoints <= 25 &&
      loserPoints >= 0 && loserPoints <= 9 &&
      winnerPoints + loserPoints === STAT_RULES.BATTLE_TOTAL_POINTS;
  }

  function getMatchType(match, draftOrId){
    // Explicit metadata is canonical. A bare historical 0:0 remains the one
    // safe compatibility case: it always represents a double walkover.
    if(hasOwn(match, 'resultType')){
      return normalizeExplicitType(match.resultType);
    }
    if(isBareHistoricalDoubleWalkover(match)) return MATCH_TYPES.DOUBLE_WALKOVER;
    return MATCH_TYPES.PLAYED;
  }

  function getMatchResult(match, draftOrId){
    const type = getMatchType(match, draftOrId);
    const pts1 = numberOrZero(match?.pts1);
    const pts2 = numberOrZero(match?.pts2);

    if(type === MATCH_TYPES.DOUBLE_WALKOVER){
      return {type, p1Outcome:'loss', p2Outcome:'loss', winner:null, loser:null};
    }
    if(pts1 > pts2){
      return {type, p1Outcome:'win', p2Outcome:'loss', winner:match.p1, loser:match.p2};
    }
    if(pts2 > pts1){
      return {type, p1Outcome:'loss', p2Outcome:'win', winner:match.p2, loser:match.p1};
    }
    return {type, p1Outcome:'draw', p2Outcome:'draw', winner:null, loser:null};
  }

  function getPlayerOutcome(match, draftOrId, playerName){
    const result = getMatchResult(match, draftOrId);
    if(match?.p1 === playerName) return result.p1Outcome;
    if(match?.p2 === playerName) return result.p2Outcome;
    return null;
  }

  function isWalkover(match, draftOrId){
    return getMatchType(match, draftOrId) === MATCH_TYPES.WALKOVER;
  }

  function isDoubleWalkover(match, draftOrId){
    return getMatchType(match, draftOrId) === MATCH_TYPES.DOUBLE_WALKOVER;
  }

  function isBattleStatsEligibleMatch(match, draftOrId){
    if(!supportsBattleLifeStats(draftOrId)) return false;
    if(getMatchType(match, draftOrId) !== MATCH_TYPES.PLAYED) return false;
    return isValidStandard25Score(match);
  }

  function getBattleResult(match, draftOrId){
    if(!isBattleStatsEligibleMatch(match, draftOrId)) return null;
    const pts1 = Number(match.pts1);
    const pts2 = Number(match.pts2);
    const p1Won = pts1 > pts2;
    const winner = normalizeName(p1Won ? match?.p1 : match?.p2);
    const loser = normalizeName(p1Won ? match?.p2 : match?.p1);
    const winnerPoints = p1Won ? pts1 : pts2;
    const loserPoints = p1Won ? pts2 : pts1;
    return {
      winner,
      loser,
      winnerPoints,
      loserPoints,
      winnerLivesRemaining:winnerPoints - 15,
      loserDamageDealt:loserPoints,
      cleanWin:winnerPoints === 25 && loserPoints === 0,
      lastLifeWin:winnerPoints === 16 && loserPoints === 9
    };
  }

  function isCleanWin(match, draftOrId){
    return Boolean(getBattleResult(match, draftOrId)?.cleanWin);
  }

  function isCleanLoss(match, draftOrId, playerName){
    const battle = getBattleResult(match, draftOrId);
    return Boolean(battle?.cleanWin && battle.loser === normalizeName(playerName));
  }

  function isLastLifeWin(match, draftOrId){
    return Boolean(getBattleResult(match, draftOrId)?.lastLifeWin);
  }

  function isLastLifeLoss(match, draftOrId, playerName){
    const battle = getBattleResult(match, draftOrId);
    return Boolean(battle?.lastLifeWin && battle.loser === normalizeName(playerName));
  }

  function isPlayerCleanWin(match, draftOrId, playerName){
    const battle = getBattleResult(match, draftOrId);
    return Boolean(battle?.cleanWin && battle.winner === normalizeName(playerName));
  }

  function isPlayerLastLifeWin(match, draftOrId, playerName){
    const battle = getBattleResult(match, draftOrId);
    return Boolean(battle?.lastLifeWin && battle.winner === normalizeName(playerName));
  }

  function getRosterNames(draft){
    return (Array.isArray(draft?.players) ? draft.players : [])
      .map(player=>normalizeName(player?.name));
  }

  function getActualPlayerCount(draft){
    return Array.isArray(draft?.players) ? draft.players.length : 0;
  }

  function getExpectedMatchCount(draft){
    const playerCount = getActualPlayerCount(draft);
    return playerCount > 1 ? (playerCount * (playerCount - 1)) / 2 : 0;
  }

  function getExpectedPairKeys(draft){
    const names = getRosterNames(draft);
    const actualCount = getActualPlayerCount(draft);
    if(names.length !== actualCount || names.some(name=>!name)) return null;
    if(new Set(names).size !== actualCount) return null;

    const expectedPairs = new Set();
    for(let first=0; first<names.length; first++){
      for(let second=first+1; second<names.length; second++){
        expectedPairs.add(pairKey(names[first], names[second]));
      }
    }
    return expectedPairs;
  }

  function getResolvedPairKeys(draft){
    const roster = new Set(getRosterNames(draft).filter(Boolean));
    const resolvedPairs = new Set();
    (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
      const p1 = normalizeName(match?.p1);
      const p2 = normalizeName(match?.p2);
      if(!p1 || !p2 || p1 === p2) return;
      if(!roster.has(p1) || !roster.has(p2)) return;
      if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;
      resolvedPairs.add(pairKey(p1,p2));
    });
    return resolvedPairs;
  }

  function isFullRoundRobin(draft){
    const expectedPairs = getExpectedPairKeys(draft);
    if(!expectedPairs || expectedPairs.size === 0) return false;
    const resolvedPairs = getResolvedPairKeys(draft);
    return [...expectedPairs].every(key=>resolvedPairs.has(key));
  }

  function getUnplayedMatches(draft){
    const names = getRosterNames(draft).filter(Boolean);
    const resolvedPairs = getResolvedPairKeys(draft);
    const missing = [];
    for(let first=0; first<names.length; first++){
      for(let second=first+1; second<names.length; second++){
        if(!resolvedPairs.has(pairKey(names[first],names[second]))){
          missing.push({p1:names[first], p2:names[second]});
        }
      }
    }
    return missing;
  }

  function getExplicitDraftStatus(draft){
    if(!hasOwn(draft, 'status')) return null;
    const status = normalizeName(draft?.status);
    return VALID_DRAFT_STATUSES.has(status) ? status : null;
  }

  function getDraftStatus(draft){
    const explicitStatus = getExplicitDraftStatus(draft);
    if(explicitStatus) return explicitStatus;
    return isFullRoundRobin(draft) ? DRAFT_STATUSES.FINISHED : DRAFT_STATUSES.ACTIVE;
  }

  function isDraftFinished(draft){
    return getDraftStatus(draft) === DRAFT_STATUSES.FINISHED;
  }

  function emptyPlayerStats(name){
    return {
      name,
      total:0,
      wins:0,
      losses:0,
      winPoints:0,
      lossPoints:0,
      cleanWins:0,
      matches:0
    };
  }

  function getDirectMatchWinner(draft, firstName, secondName){
    const first = normalizeName(firstName);
    const second = normalizeName(secondName);
    if(!first || !second || first === second) return null;

    const directMatches = (Array.isArray(draft?.matches) ? draft.matches : []).filter(match=>
      pairKey(match?.p1, match?.p2) === pairKey(first,second) &&
      isFinitePointValue(match?.pts1) &&
      isFinitePointValue(match?.pts2)
    );
    if(!directMatches.length) return null;

    const winners = new Set();
    directMatches.forEach(match=>{
      const result = getMatchResult(match, draft);
      if(result.type !== MATCH_TYPES.DOUBLE_WALKOVER && result.winner){
        winners.add(normalizeName(result.winner));
      }
    });
    if(winners.size !== 1) return null;
    const winner = [...winners][0];
    return winner === first || winner === second ? winner : null;
  }

  function samePrimaryTieBreak(first, second){
    return first.total === second.total &&
      first.wins === second.wins &&
      first.winPoints === second.winPoints;
  }

  function applyRankingTieBreaks(baseRanking, draft){
    const ranking = [];
    let index = 0;
    while(index < baseRanking.length){
      let end = index + 1;
      while(end < baseRanking.length && samePrimaryTieBreak(baseRanking[index], baseRanking[end])) end++;
      const group = baseRanking.slice(index,end);

      // Head-to-head is unambiguous for a two-player tie. For larger tied
      // groups, the final alphabetical fallback stays deterministic instead
      // of introducing a potentially non-transitive circular H2H order.
      if(group.length === 2){
        const [first,second] = group;
        const directWinner = getDirectMatchWinner(draft, first.name, second.name);
        if(directWinner === second.name) group.reverse();
      }
      ranking.push(...group);
      index = end;
    }
    return ranking;
  }

  function calculateDraftStats(draft){
    const byName = {};
    const rosterNames = getRosterNames(draft).filter(Boolean);
    const roster = new Set(rosterNames);
    rosterNames.forEach(name=>{
      if(!byName[name]) byName[name] = emptyPlayerStats(name);
    });

    (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
      const p1 = normalizeName(match?.p1);
      const p2 = normalizeName(match?.p2);
      if(!p1 || !p2 || p1 === p2) return;
      if(!roster.has(p1) || !roster.has(p2)) return;
      if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;

      const pts1 = Number(match.pts1);
      const pts2 = Number(match.pts2);
      const result = getMatchResult(match, draft);

      byName[p1].total += pts1;
      byName[p2].total += pts2;
      byName[p1].matches++;
      byName[p2].matches++;

      if(result.type === MATCH_TYPES.DOUBLE_WALKOVER){
        byName[p1].losses++;
        byName[p2].losses++;
        byName[p1].lossPoints += pts1;
        byName[p2].lossPoints += pts2;
        return;
      }

      if(result.p1Outcome === 'win'){
        byName[p1].wins++;
        byName[p2].losses++;
        byName[p1].winPoints += pts1;
        byName[p2].lossPoints += pts2;
        if(isCleanWin(match, draft)) byName[p1].cleanWins++;
      }else if(result.p2Outcome === 'win'){
        byName[p2].wins++;
        byName[p1].losses++;
        byName[p2].winPoints += pts2;
        byName[p1].lossPoints += pts1;
        if(isCleanWin(match, draft)) byName[p2].cleanWins++;
      }
    });

    const baseRanking = Object.values(byName).sort((a,b)=>
      b.total-a.total ||
      b.wins-a.wins ||
      b.winPoints-a.winPoints ||
      a.name.localeCompare(b.name)
    );
    const ranking = applyRankingTieBreaks(baseRanking, draft);

    return {byName, ranking};
  }

  function calculateDraftRanking(draft){
    return calculateDraftStats(draft).ranking;
  }

  function getDraftLeader(draft){
    const ranking = calculateDraftRanking(draft);
    return ranking[0]?.name || null;
  }

  function getExplicitWinner(draft){
    return normalizeName(draft?.winner) || null;
  }

  function getDraftWinner(draft){
    if(!isDraftFinished(draft)) return null;
    const roster = new Set(getRosterNames(draft).filter(Boolean));
    const explicitWinner = getExplicitWinner(draft);
    if(explicitWinner && roster.has(explicitWinner)) return explicitWinner;
    return getDraftLeader(draft);
  }

  function getDraftLegendOrder(draft){
    if(!isDraftFinished(draft)) return [];
    const ranking = calculateDraftRanking(draft);
    const officialWinner = getDraftWinner(draft);
    if(!officialWinner) return ranking;

    // An explicit, valid official winner is the historical #1 for Legend purposes.
    // The mathematical ranking itself remains untouched; everybody else keeps the
    // relative order produced by the canonical draft ranking engine.
    const winnerEntry = ranking.find(player=>player.name === officialWinner);
    if(!winnerEntry) return ranking;
    return [winnerEntry, ...ranking.filter(player=>player.name !== officialWinner)];
  }

  function getDraftLegendAwards(draft){
    return getDraftLegendOrder(draft).slice(0,5).map((player,index)=>{
      const place = index + 1;
      return {
        place,
        name:player.name,
        points:LEGEND_POINTS[place] || 0,
        draftPoints:player.total,
        wins:player.wins,
        losses:player.losses
      };
    });
  }

  function createLegendPlayer(name){
    return {
      name,
      legendPoints:0,
      draftWins:0,
      first:0,
      second:0,
      third:0,
      fourth:0,
      fifth:0,
      drafts:0,
      draftPoints:0,
      avgDraftPoints:0,
      wins:0,
      losses:0,
      matches:0,
      winRate:0,
      balance:0,
      eligibleForRank:false,
      rank:null
    };
  }

  function ensureLegendPlayer(map, name){
    const normalized = normalizeName(name);
    if(!normalized) return null;
    if(!map[normalized]) map[normalized] = createLegendPlayer(normalized);
    return map[normalized];
  }

  function calculateLegendStandings(drafts){
    const byName = {};
    const finishedDrafts = (Array.isArray(drafts) ? drafts : []).filter(isDraftFinished);

    finishedDrafts.forEach(draft=>{
      const draftStats = calculateDraftStats(draft);

      // Participation is defined by the canonical players[] roster, not by whether
      // a player happened to have a match object in an incomplete historical draft.
      (Array.isArray(draft?.players) ? draft.players : []).forEach(player=>{
        const legendPlayer = ensureLegendPlayer(byName, player?.name);
        if(legendPlayer) legendPlayer.drafts++;
      });

      Object.values(draftStats.byName).forEach(playerStats=>{
        const legendPlayer = ensureLegendPlayer(byName, playerStats.name);
        if(!legendPlayer) return;
        legendPlayer.draftPoints += playerStats.total;
        legendPlayer.wins += playerStats.wins;
        legendPlayer.losses += playerStats.losses;
        legendPlayer.matches += playerStats.matches;
      });

      getDraftLegendAwards(draft).forEach(award=>{
        const legendPlayer = ensureLegendPlayer(byName, award.name);
        if(!legendPlayer) return;
        legendPlayer.legendPoints += award.points;
        if(award.place === 1){ legendPlayer.first++; legendPlayer.draftWins++; }
        if(award.place === 2) legendPlayer.second++;
        if(award.place === 3) legendPlayer.third++;
        if(award.place === 4) legendPlayer.fourth++;
        if(award.place === 5) legendPlayer.fifth++;
      });
    });

    const allPlayers = Object.values(byName).map(player=>{
      const decidedMatches = player.wins + player.losses;
      return {
        ...player,
        avgDraftPoints:player.drafts ? player.draftPoints / player.drafts : 0,
        winRate:decidedMatches ? player.wins / decidedMatches : 0,
        balance:player.wins - player.losses,
        eligibleForRank:player.drafts >= MIN_LEGEND_DRAFTS,
        rank:null
      };
    });

    const ranking = allPlayers
      .filter(player=>player.eligibleForRank)
      .sort((a,b)=>
        b.legendPoints-a.legendPoints ||
        b.draftWins-a.draftWins ||
        b.draftPoints-a.draftPoints ||
        b.winRate-a.winRate ||
        a.name.localeCompare(b.name,'pl')
      )
      .map((player,index)=>({...player, rank:index+1}));

    const rankByName = {};
    ranking.forEach(player=>{ rankByName[player.name] = player.rank; });
    const rankedByName = Object.fromEntries(ranking.map(player=>[player.name,player]));
    const allByName = Object.fromEntries(allPlayers.map(player=>[
      player.name,
      rankedByName[player.name] || player
    ]));

    return {
      legendPoints:LEGEND_POINTS,
      minDrafts:MIN_LEGEND_DRAFTS,
      ranking,
      allPlayers:Object.values(allByName),
      byName:allByName,
      rankByName
    };
  }

  function getPlayerLegendStats(drafts, playerName){
    const name = normalizeName(playerName);
    if(!name) return null;
    return calculateLegendStandings(drafts).byName[name] || null;
  }

  function getPlayerLegendRank(drafts, playerName){
    const stats = getPlayerLegendStats(drafts, playerName);
    return stats?.rank || null;
  }

  function calculateWinRate(wins, losses){
    const decided = numberOrZero(wins) + numberOrZero(losses);
    return decided > 0 ? numberOrZero(wins) / decided : 0;
  }

  function qualifiesSample(value, minimum){
    return numberOrZero(value) >= numberOrZero(minimum);
  }

  function rankTopN(items, compareFn, sameRankFn, limit){
    const sorted = (Array.isArray(items) ? items : []).slice().sort(compareFn);
    const maxRank = Math.max(1, Number(limit) || 3);
    const ranked = [];
    let previous = null;
    let rank = 0;
    sorted.forEach((item,index)=>{
      if(index === 0 || !sameRankFn(item, previous)) rank = index + 1;
      if(rank <= maxRank) ranked.push({...item, rank});
      previous = item;
    });
    return ranked;
  }


  function getStatDefinition(key){
    const normalized = normalizeName(key);
    return normalized && hasOwn(STAT_DEFINITIONS,normalized) ? STAT_DEFINITIONS[normalized] : null;
  }

  function calculateFinishPercentile(place, playerCount){
    const position = Number(place);
    const count = Number(playerCount);
    if(!Number.isFinite(position) || !Number.isFinite(count) || count <= 0) return null;
    if(count === 1) return position === 1 ? 1 : null;
    if(position < 1 || position > count) return null;
    return (count-position) / (count-1);
  }

  function getFinishedDraftsChronologically(drafts){
    return (Array.isArray(drafts) ? drafts : [])
      .filter(isDraftFinished)
      .slice()
      .sort((a,b)=>numberOrZero(a?.id)-numberOrZero(b?.id));
  }

  function getPlayerDraftEntry(draft, playerName){
    const name = normalizeName(playerName);
    return (Array.isArray(draft?.players) ? draft.players : [])
      .find(player=>normalizeName(player?.name) === name) || null;
  }

  function buildPlayerDraftPerformance(draft, playerName){
    const name = normalizeName(playerName);
    const playerEntry = getPlayerDraftEntry(draft,name);
    if(!name || !playerEntry || !isDraftFinished(draft)) return null;

    const draftStats = calculateDraftStats(draft);
    const stats = draftStats.byName[name] || emptyPlayerStats(name);
    const order = getDraftLegendOrder(draft);
    const placeIndex = order.findIndex(player=>player.name === name);
    const place = placeIndex >= 0 ? placeIndex + 1 : null;
    const award = place && place <= 5 ? (LEGEND_POINTS[place] || 0) : 0;
    const decidedMatches = stats.wins + stats.losses;

    let battleEligibleMatches = 0;
    let battleWins = 0;
    let battleLosses = 0;
    let cleanWins = 0;
    let cleanLosses = 0;
    let lastLifeWins = 0;
    let lastLifeLosses = 0;

    (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
      if(normalizeName(match?.p1) !== name && normalizeName(match?.p2) !== name) return;
      const battle = getBattleResult(match,draft);
      if(!battle) return;
      battleEligibleMatches++;
      if(battle.winner === name){
        battleWins++;
        if(battle.cleanWin) cleanWins++;
        if(battle.lastLifeWin) lastLifeWins++;
      }else if(battle.loser === name){
        battleLosses++;
        if(battle.cleanWin) cleanLosses++;
        if(battle.lastLifeWin) lastLifeLosses++;
      }
    });

    return {
      draftId:numberOrZero(draft?.id),
      startDate:draft?.startDate || null,
      endDate:draft?.endDate || null,
      mode:draft?.mode || '',
      playerCount:getActualPlayerCount(draft),
      place,
      points:stats.total,
      wins:stats.wins,
      losses:stats.losses,
      matches:stats.matches,
      winRate:decidedMatches ? stats.wins / decidedMatches : 0,
      winPoints:stats.winPoints,
      lossPoints:stats.lossPoints,
      legendPoints:award,
      isWinner:getDraftWinner(draft) === name,
      deck:Array.isArray(playerEntry?.deck) ? playerEntry.deck.slice() : [],
      battle:{
        eligibleMatches:battleEligibleMatches,
        wins:battleWins,
        losses:battleLosses,
        winRate:calculateWinRate(battleWins,battleLosses),
        cleanWins,
        cleanLosses,
        lastLifeWins,
        lastLifeLosses
      }
    };
  }

  function calculatePlayerHistory(drafts, playerName){
    const name = normalizeName(playerName);
    if(!name) return [];
    return getFinishedDraftsChronologically(drafts)
      .map(draft=>buildPlayerDraftPerformance(draft,name))
      .filter(Boolean);
  }

  function comparePerformanceSuccess(first, second){
    const firstPlace = Number.isFinite(Number(first?.place)) ? Number(first.place) : Number.POSITIVE_INFINITY;
    const secondPlace = Number.isFinite(Number(second?.place)) ? Number(second.place) : Number.POSITIVE_INFINITY;
    return firstPlace-secondPlace ||
      numberOrZero(second?.winRate)-numberOrZero(first?.winRate) ||
      numberOrZero(second?.points)-numberOrZero(first?.points) ||
      numberOrZero(second?.wins)-numberOrZero(first?.wins) ||
      numberOrZero(second?.draftId)-numberOrZero(first?.draftId);
  }

  function calculatePlayerTopPerformances(drafts, playerName, limit){
    const maxItems = Math.max(1,Number(limit) || 3);
    return calculatePlayerHistory(drafts,playerName)
      .slice()
      .sort(comparePerformanceSuccess)
      .slice(0,maxItems);
  }

  function chooseRecord(history, compareFn){
    const source = (Array.isArray(history) ? history : []).slice().filter(Boolean);
    return source.length ? source.sort(compareFn)[0] : null;
  }

  function calculatePlayerRecords(drafts, playerName){
    const history = calculatePlayerHistory(drafts,playerName);
    const withDecidedMatches = history.filter(item=>(item.wins + item.losses) > 0);
    const bestPlace = history.reduce((value,item)=>item.place && (!value || item.place < value) ? item.place : value,null);
    const worstPlace = history.reduce((value,item)=>item.place && (!value || item.place > value) ? item.place : value,null);

    return {
      bestFinish:chooseRecord(history,comparePerformanceSuccess),
      bestFinishCount:bestPlace ? history.filter(item=>item.place === bestPlace).length : 0,
      worstFinish:chooseRecord(history,(a,b)=>
        numberOrZero(b?.place)-numberOrZero(a?.place) ||
        numberOrZero(a?.winRate)-numberOrZero(b?.winRate) ||
        numberOrZero(a?.points)-numberOrZero(b?.points) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      ),
      worstFinishCount:worstPlace ? history.filter(item=>item.place === worstPlace).length : 0,
      bestWinRateDraft:chooseRecord(withDecidedMatches,(a,b)=>
        numberOrZero(b?.winRate)-numberOrZero(a?.winRate) ||
        numberOrZero(b?.wins)-numberOrZero(a?.wins) ||
        numberOrZero(b?.matches)-numberOrZero(a?.matches) ||
        numberOrZero(b?.points)-numberOrZero(a?.points) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      ),
      worstWinRateDraft:chooseRecord(withDecidedMatches,(a,b)=>
        numberOrZero(a?.winRate)-numberOrZero(b?.winRate) ||
        numberOrZero(b?.matches)-numberOrZero(a?.matches) ||
        numberOrZero(a?.wins)-numberOrZero(b?.wins) ||
        numberOrZero(a?.points)-numberOrZero(b?.points) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      ),
      highestPointsDraft:chooseRecord(history,(a,b)=>
        numberOrZero(b?.points)-numberOrZero(a?.points) ||
        numberOrZero(b?.wins)-numberOrZero(a?.wins) ||
        numberOrZero(b?.winRate)-numberOrZero(a?.winRate) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      ),
      lowestPointsDraft:chooseRecord(history,(a,b)=>
        numberOrZero(a?.points)-numberOrZero(b?.points) ||
        numberOrZero(a?.wins)-numberOrZero(b?.wins) ||
        numberOrZero(a?.winRate)-numberOrZero(b?.winRate) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      ),
      mostWinsDraft:chooseRecord(history,(a,b)=>
        numberOrZero(b?.wins)-numberOrZero(a?.wins) ||
        numberOrZero(b?.winRate)-numberOrZero(a?.winRate) ||
        numberOrZero(b?.points)-numberOrZero(a?.points) ||
        numberOrZero(b?.draftId)-numberOrZero(a?.draftId)
      )
    };
  }

  function createRivalStats(name){
    return {name,matches:0,wins:0,losses:0,winRate:0,balance:0};
  }

  function calculatePlayerRivalries(drafts, playerName, minimumMatches){
    const name = normalizeName(playerName);
    if(!name) return {minimumMatches:SAMPLE_THRESHOLDS.PLAYER_RIVALRY_MATCHES,rivals:[],archrival:null,dominatedOpponent:null,nemesis:null,closestRival:null};
    const minimum = Math.max(1,Number(minimumMatches) || SAMPLE_THRESHOLDS.PLAYER_RIVALRY_MATCHES);
    const map = {};

    getFinishedDraftsChronologically(drafts).forEach(draft=>{
      (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
        if(getMatchType(match,draft) !== MATCH_TYPES.PLAYED) return;
        if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;
        const p1 = normalizeName(match?.p1);
        const p2 = normalizeName(match?.p2);
        if(p1 !== name && p2 !== name) return;
        const opponent = p1 === name ? p2 : p1;
        if(!opponent || opponent === name) return;
        const outcome = getPlayerOutcome(match,draft,name);
        if(outcome !== 'win' && outcome !== 'loss') return;
        if(!map[opponent]) map[opponent] = createRivalStats(opponent);
        map[opponent].matches++;
        if(outcome === 'win') map[opponent].wins++;
        if(outcome === 'loss') map[opponent].losses++;
      });
    });

    const rivals = Object.values(map).map(rival=>({
      ...rival,
      winRate:calculateWinRate(rival.wins,rival.losses),
      balance:rival.wins-rival.losses
    })).sort((a,b)=>
      b.matches-a.matches ||
      b.wins-a.wins ||
      a.name.localeCompare(b.name,'pl')
    );

    const qualified = rivals.filter(rival=>qualifiesSample(rival.matches,minimum));
    const archrival = rivals.length ? rivals.slice().sort((a,b)=>
      b.matches-a.matches ||
      Math.abs(a.winRate-.5)-Math.abs(b.winRate-.5) ||
      a.name.localeCompare(b.name,'pl')
    )[0] : null;
    const dominatedOpponent = qualified.length ? qualified.slice().sort((a,b)=>
      b.winRate-a.winRate ||
      b.matches-a.matches ||
      b.balance-a.balance ||
      a.name.localeCompare(b.name,'pl')
    )[0] : null;
    const nemesis = qualified.length ? qualified.slice().sort((a,b)=>
      a.winRate-b.winRate ||
      b.matches-a.matches ||
      a.balance-b.balance ||
      a.name.localeCompare(b.name,'pl')
    )[0] : null;
    const closestRival = qualified.length ? qualified.slice().sort((a,b)=>
      Math.abs(a.winRate-.5)-Math.abs(b.winRate-.5) ||
      b.matches-a.matches ||
      Math.abs(a.balance)-Math.abs(b.balance) ||
      a.name.localeCompare(b.name,'pl')
    )[0] : null;

    return {minimumMatches:minimum,rivals,archrival,dominatedOpponent,nemesis,closestRival};
  }

  function calculatePlayerMatchBreakdown(drafts, playerName){
    const name = normalizeName(playerName);
    const stats = {
      officialMatches:0,
      playedMatches:0,
      playedWins:0,
      playedLosses:0,
      playedDraws:0,
      playedWinRate:0,
      walkoverMatches:0,
      walkoverWins:0,
      walkoverLosses:0,
      doubleWalkovers:0,
      battleEligibleMatches:0
    };
    if(!name) return stats;

    getFinishedDraftsChronologically(drafts).forEach(draft=>{
      (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
        const p1 = normalizeName(match?.p1);
        const p2 = normalizeName(match?.p2);
        if(p1 !== name && p2 !== name) return;
        if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;
        stats.officialMatches++;
        const type = getMatchType(match,draft);
        if(type === MATCH_TYPES.WALKOVER){
          stats.walkoverMatches++;
          const outcome = getPlayerOutcome(match,draft,name);
          if(outcome === 'win') stats.walkoverWins++;
          if(outcome === 'loss') stats.walkoverLosses++;
          return;
        }
        if(type === MATCH_TYPES.DOUBLE_WALKOVER){
          stats.doubleWalkovers++;
          return;
        }
        stats.playedMatches++;
        const outcome = getPlayerOutcome(match,draft,name);
        if(outcome === 'win') stats.playedWins++;
        else if(outcome === 'loss') stats.playedLosses++;
        else stats.playedDraws++;
        if(isBattleStatsEligibleMatch(match,draft)) stats.battleEligibleMatches++;
      });
    });
    stats.playedWinRate = calculateWinRate(stats.playedWins,stats.playedLosses);
    return stats;
  }

  function calculatePlayerBattleStats(drafts, playerName){
    const name = normalizeName(playerName);
    const stats = {
      eligibleMatches:0,
      wins:0,
      losses:0,
      winRate:0,
      cleanWins:0,
      cleanLosses:0,
      lastLifeWins:0,
      lastLifeLosses:0,
      totalLivesRemainingOnWins:0,
      averageLivesRemainingOnWin:0,
      totalDamageDealtOnLosses:0,
      averageDamageDealtOnLoss:0,
      walkoverWins:0,
      walkoverLosses:0,
      doubleWalkovers:0
    };
    if(!name) return stats;

    getFinishedDraftsChronologically(drafts).forEach(draft=>{
      (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
        const p1 = normalizeName(match?.p1);
        const p2 = normalizeName(match?.p2);
        if(p1 !== name && p2 !== name) return;

        const type = getMatchType(match,draft);
        if(type === MATCH_TYPES.WALKOVER){
          const outcome = getPlayerOutcome(match,draft,name);
          if(outcome === 'win') stats.walkoverWins++;
          if(outcome === 'loss') stats.walkoverLosses++;
          return;
        }
        if(type === MATCH_TYPES.DOUBLE_WALKOVER){
          stats.doubleWalkovers++;
          return;
        }

        const battle = getBattleResult(match,draft);
        if(!battle) return;
        stats.eligibleMatches++;
        if(battle.winner === name){
          stats.wins++;
          stats.totalLivesRemainingOnWins += battle.winnerLivesRemaining;
          if(battle.cleanWin) stats.cleanWins++;
          if(battle.lastLifeWin) stats.lastLifeWins++;
        }else if(battle.loser === name){
          stats.losses++;
          stats.totalDamageDealtOnLosses += battle.loserDamageDealt;
          if(battle.cleanWin) stats.cleanLosses++;
          if(battle.lastLifeWin) stats.lastLifeLosses++;
        }
      });
    });

    stats.winRate = calculateWinRate(stats.wins,stats.losses);
    stats.averageLivesRemainingOnWin = stats.wins ? stats.totalLivesRemainingOnWins / stats.wins : 0;
    stats.averageDamageDealtOnLoss = stats.losses ? stats.totalDamageDealtOnLosses / stats.losses : 0;
    return stats;
  }

  function calculateLongestOutcomeStreak(drafts, playerName, wantedOutcome){
    const name = normalizeName(playerName);
    const wanted = wantedOutcome === 'loss' ? 'loss' : 'win';
    let best = {length:0,startDraftId:null,endDraftId:null,startMatchIndex:null,endMatchIndex:null};
    let current = null;

    getFinishedDraftsChronologically(drafts).forEach(draft=>{
      (Array.isArray(draft?.matches) ? draft.matches : []).forEach((match,index)=>{
        if(getMatchType(match,draft) !== MATCH_TYPES.PLAYED) return;
        const p1 = normalizeName(match?.p1);
        const p2 = normalizeName(match?.p2);
        if(p1 !== name && p2 !== name) return;
        const outcome = getPlayerOutcome(match,draft,name);
        if(outcome !== 'win' && outcome !== 'loss') return;

        if(outcome === wanted){
          if(!current){
            current = {length:0,startDraftId:numberOrZero(draft?.id),startMatchIndex:index};
          }
          current.length++;
          current.endDraftId = numberOrZero(draft?.id);
          current.endMatchIndex = index;
          if(current.length > best.length) best = {...current};
        }else{
          current = null;
        }
      });
    });
    return best;
  }

  function calculateConsecutiveDraftAppearances(drafts, playerName){
    const name = normalizeName(playerName);
    let best = {length:0,startDraftId:null,endDraftId:null};
    let current = null;
    getFinishedDraftsChronologically(drafts).forEach(draft=>{
      const present = Boolean(getPlayerDraftEntry(draft,name));
      if(present){
        if(!current) current = {length:0,startDraftId:numberOrZero(draft?.id)};
        current.length++;
        current.endDraftId = numberOrZero(draft?.id);
        if(current.length > best.length) best = {...current};
      }else{
        current = null;
      }
    });
    return best;
  }

  function calculatePlayerStreaks(drafts, playerName){
    return {
      longestWinStreak:calculateLongestOutcomeStreak(drafts,playerName,'win'),
      longestLossStreak:calculateLongestOutcomeStreak(drafts,playerName,'loss'),
      consecutiveDraftAppearances:calculateConsecutiveDraftAppearances(drafts,playerName)
    };
  }

  function calculatePlayerSummary(drafts, playerName){
    const name = normalizeName(playerName);
    if(!name) return null;
    const history = calculatePlayerHistory(drafts,name);
    if(!history.length) return null;
    const legend = getPlayerLegendStats(drafts,name) || createLegendPlayer(name);
    const matchBreakdown = calculatePlayerMatchBreakdown(drafts,name);
    const totals = history.reduce((sum,item)=>{
      sum.matches += item.matches;
      sum.wins += item.wins;
      sum.losses += item.losses;
      sum.draftPoints += item.points;
      sum.winPoints += item.winPoints;
      sum.lossPoints += item.lossPoints;
      if(Number.isFinite(Number(item.place))){
        sum.finishTotal += Number(item.place);
        sum.finishCount++;
        const percentile = calculateFinishPercentile(item.place,item.playerCount);
        if(percentile !== null){
          sum.finishPercentileTotal += percentile;
          sum.finishPercentileCount++;
        }
      }
      return sum;
    },{
      matches:0,wins:0,losses:0,draftPoints:0,winPoints:0,lossPoints:0,
      finishTotal:0,finishCount:0,finishPercentileTotal:0,finishPercentileCount:0
    });

    const draftsPlayed = history.length;
    const draftWins = numberOrZero(legend.draftWins);
    const podiums = numberOrZero(legend.first)+numberOrZero(legend.second)+numberOrZero(legend.third);
    const top5 = podiums+numberOrZero(legend.fourth)+numberOrZero(legend.fifth);

    return {
      name,
      drafts:draftsPlayed,
      matches:totals.matches,
      officialMatches:matchBreakdown.officialMatches,
      playedMatches:matchBreakdown.playedMatches,
      walkoverMatches:matchBreakdown.walkoverMatches,
      doubleWalkovers:matchBreakdown.doubleWalkovers,
      battleEligibleMatches:matchBreakdown.battleEligibleMatches,
      playedWins:matchBreakdown.playedWins,
      playedLosses:matchBreakdown.playedLosses,
      playedWinRate:matchBreakdown.playedWinRate,
      wins:totals.wins,
      losses:totals.losses,
      balance:totals.wins-totals.losses,
      winRate:calculateWinRate(totals.wins,totals.losses),
      draftPoints:totals.draftPoints,
      averageDraftPoints:draftsPlayed ? totals.draftPoints / draftsPlayed : 0,
      averageFinish:totals.finishCount ? totals.finishTotal / totals.finishCount : null,
      averageFinishPercentile:totals.finishPercentileCount ? totals.finishPercentileTotal / totals.finishPercentileCount : null,
      winPoints:totals.winPoints,
      lossPoints:totals.lossPoints,
      legendPoints:numberOrZero(legend.legendPoints),
      legendRank:legend.rank || null,
      eligibleForLegendRank:Boolean(legend.eligibleForRank),
      draftWins,
      titleRate:draftsPlayed ? draftWins / draftsPlayed : 0,
      podiums,
      podiumRate:draftsPlayed ? podiums / draftsPlayed : 0,
      top5,
      top5Rate:draftsPlayed ? top5 / draftsPlayed : 0,
      first:numberOrZero(legend.first),
      second:numberOrZero(legend.second),
      third:numberOrZero(legend.third),
      fourth:numberOrZero(legend.fourth),
      fifth:numberOrZero(legend.fifth)
    };
  }


  function calculateCardProfile(drafts, cards, cardName, options){
    const name = normalizeName(cardName);
    if(!name) return null;

    const sourceCards = Array.isArray(cards) ? cards : [];
    const meta = sourceCards.find(card=>normalizeName(card?.name) === name) || null;
    const finishedDrafts = getFinishedDraftsChronologically(drafts);

    const draftIds = new Set();
    const owners = {};
    const pilots = {};
    const partners = {};
    const opponents = {};
    const perDraft = {};
    let appearances = 0;
    let matches = 0;
    let wins = 0;
    let losses = 0;
    let draftWins = 0;
    let podiums = 0;
    let top5 = 0;
    let legendPoints = 0;
    let draftPoints = 0;

    function ensureMini(map, key){
      if(!map[key]){
        map[key] = {
          name:key,
          appearances:0,
          sharedDecks:0,
          matches:0,
          wins:0,
          losses:0,
          draftPoints:0,
          legendPoints:0,
          draftIds:new Set()
        };
      }
      return map[key];
    }

    finishedDrafts.forEach(draft=>{
      const draftId = numberOrZero(draft?.id);
      const players = Array.isArray(draft?.players) ? draft.players : [];
      const ranking = getDraftLegendOrder(draft);
      const placeByName = {};
      ranking.forEach((row,index)=>{ placeByName[row.name] = index+1; });
      const rankByName = {};
      ranking.forEach(row=>{ rankByName[row.name] = row; });

      const deckByPlayer = {};
      const carriers = [];

      players.forEach(player=>{
        const playerName = normalizeName(player?.name);
        const rawDeck = Array.isArray(player?.deck) ? player.deck.map(normalizeName).filter(Boolean) : [];
        const uniqueDeck = [...new Set(rawDeck)];
        deckByPlayer[playerName] = uniqueDeck;

        if(!uniqueDeck.includes(name)) return;
        carriers.push(playerName);
        appearances++;
        draftIds.add(draftId);
        owners[playerName] = numberOrZero(owners[playerName])+1;

        const place = placeByName[playerName] || null;
        if(place === 1) draftWins++;
        if(place && place <= 3) podiums++;
        if(place && place <= 5) top5++;
        legendPoints += place ? numberOrZero(LEGEND_POINTS[place]) : 0;

        const playerDraftPoints = numberOrZero(rankByName[playerName]?.total);
        draftPoints += playerDraftPoints;

        const pilot = ensureMini(pilots,playerName);
        pilot.appearances++;
        pilot.draftIds.add(draftId);
        pilot.legendPoints += place ? numberOrZero(LEGEND_POINTS[place]) : 0;
        pilot.draftPoints += playerDraftPoints;

        if(!perDraft[draftId]){
          perDraft[draftId] = {
            id:draftId,
            players:new Set(),
            places:[],
            matches:0,
            wins:0,
            losses:0,
            draftPoints:0
          };
        }
        perDraft[draftId].players.add(playerName);
        if(place) perDraft[draftId].places.push({player:playerName,place});
        perDraft[draftId].draftPoints += playerDraftPoints;

        uniqueDeck.forEach(partnerName=>{
          if(partnerName === name) return;
          const partner = ensureMini(partners,partnerName);
          partner.sharedDecks++;
          partner.draftIds.add(draftId);
        });
      });

      if(!carriers.length) return;

      (Array.isArray(draft?.matches) ? draft.matches : []).forEach(match=>{
        if(getMatchType(match,draft) !== MATCH_TYPES.PLAYED) return;
        const p1 = normalizeName(match?.p1);
        const p2 = normalizeName(match?.p2);

        carriers.forEach(playerName=>{
          if(p1 !== playerName && p2 !== playerName) return;
          const outcome = getPlayerOutcome(match,draft,playerName);
          if(outcome !== 'win' && outcome !== 'loss') return;

          matches++;
          if(outcome === 'win') wins++;
          else losses++;

          const pilot = ensureMini(pilots,playerName);
          pilot.matches++;
          if(outcome === 'win') pilot.wins++;
          else pilot.losses++;

          const row = perDraft[draftId];
          if(row){
            row.matches++;
            if(outcome === 'win') row.wins++;
            else row.losses++;
          }

          const ownDeck = deckByPlayer[playerName] || [];
          ownDeck.forEach(partnerName=>{
            if(partnerName === name) return;
            const partner = ensureMini(partners,partnerName);
            partner.matches++;
            if(outcome === 'win') partner.wins++;
            else partner.losses++;
          });

          const opponentName = p1 === playerName ? p2 : p1;
          (deckByPlayer[opponentName] || []).forEach(opponentCardName=>{
            if(opponentCardName === name) return;
            const opponent = ensureMini(opponents,opponentCardName);
            opponent.draftIds.add(draftId);
            opponent.matches++;
            if(outcome === 'win') opponent.wins++;
            else opponent.losses++;
          });
        });
      });
    });

    const ownerRows = Object.entries(owners).map(([ownerName,count])=>({
      name:ownerName,
      appearances:count
    })).sort((a,b)=>b.appearances-a.appearances || compareLocale(a.name,b.name));

    function serializeMini(map){
      return Object.values(map).map(item=>({
        ...item,
        drafts:item.draftIds.size,
        draftIds:[...item.draftIds].sort((a,b)=>a-b),
        winRate:calculateWinRate(item.wins,item.losses)
      })).sort((a,b)=>
        b.appearances-a.appearances ||
        b.sharedDecks-a.sharedDecks ||
        b.matches-a.matches ||
        compareLocale(a.name,b.name)
      );
    }

    const pilotRows = serializeMini(pilots);
    const partnerRows = serializeMini(partners);
    const opponentRows = serializeMini(opponents);
    const perDraftRows = Object.values(perDraft).map(row=>({
      ...row,
      players:[...row.players].sort(compareLocale),
      places:row.places.slice().sort((a,b)=>a.place-b.place || compareLocale(a.player,b.player)),
      winRate:calculateWinRate(row.wins,row.losses)
    })).sort((a,b)=>b.id-a.id);

    const minimumPilotMatches = Number(options?.minimumPilotMatches) || SAMPLE_THRESHOLDS.GLOBAL_CARD_WR_MATCHES;
    const minimumRelationshipMatches = Number(options?.minimumRelationshipMatches) || SAMPLE_THRESHOLDS.GLOBAL_CARD_WR_MATCHES;

    const qualifiedPilots = pilotRows.filter(row=>qualifiesSample(row.matches,minimumPilotMatches));
    const qualifiedPartners = partnerRows.filter(row=>qualifiesSample(row.matches,minimumRelationshipMatches));
    const qualifiedOpponents = opponentRows.filter(row=>qualifiesSample(row.matches,minimumRelationshipMatches));

    const byBestWinRate = rows=>rows.slice().sort((a,b)=>
      numberOrZero(b.winRate)-numberOrZero(a.winRate) ||
      b.matches-a.matches ||
      compareLocale(a.name,b.name)
    )[0] || null;
    const byWorstWinRate = rows=>rows.slice().sort((a,b)=>
      numberOrZero(a.winRate)-numberOrZero(b.winRate) ||
      b.matches-a.matches ||
      compareLocale(a.name,b.name)
    )[0] || null;

    return {
      name,
      card:meta ? {...meta} : {name},
      summary:{
        appearances,
        drafts:draftIds.size,
        owners:ownerRows.length,
        matches,
        wins,
        losses,
        winRate:calculateWinRate(wins,losses),
        draftWins,
        podiums,
        top5,
        legendPoints,
        draftPoints,
        averageDraftPoints:draftIds.size ? draftPoints/draftIds.size : 0
      },
      ownerRows,
      topOwner:ownerRows[0] || null,
      pilots:pilotRows,
      partners:partnerRows,
      opponents:opponentRows,
      history:perDraftRows,
      records:{
        mostFrequentPilot:pilotRows[0] || null,
        bestQualifiedPilot:byBestWinRate(qualifiedPilots),
        bestQualifiedPartner:byBestWinRate(qualifiedPartners),
        bestQualifiedMatchup:byBestWinRate(qualifiedOpponents),
        worstQualifiedMatchup:byWorstWinRate(qualifiedOpponents),
        highestPointsDraft:perDraftRows.slice().sort((a,b)=>
          numberOrZero(b.draftPoints)-numberOrZero(a.draftPoints) ||
          b.matches-a.matches ||
          b.id-a.id
        )[0] || null,
        bestWinRateDraft:perDraftRows.filter(row=>row.matches>0).sort((a,b)=>
          numberOrZero(b.winRate)-numberOrZero(a.winRate) ||
          b.matches-a.matches ||
          b.id-a.id
        )[0] || null,
        worstWinRateDraft:perDraftRows.filter(row=>row.matches>0).sort((a,b)=>
          numberOrZero(a.winRate)-numberOrZero(b.winRate) ||
          b.matches-a.matches ||
          b.id-a.id
        )[0] || null
      }
    };
  }

  function calculatePlayerProfile(drafts, playerName, options){
    const name = normalizeName(playerName);
    const summary = calculatePlayerSummary(drafts,name);
    if(!summary) return null;
    const rivalryMinimum = Number(options?.rivalryMinimum) || SAMPLE_THRESHOLDS.PLAYER_RIVALRY_MATCHES;
    return {
      name,
      summary,
      topPerformances:calculatePlayerTopPerformances(drafts,name,3),
      records:calculatePlayerRecords(drafts,name),
      rivalries:calculatePlayerRivalries(drafts,name,rivalryMinimum),
      battle:calculatePlayerBattleStats(drafts,name),
      streaks:calculatePlayerStreaks(drafts,name),
      history:calculatePlayerHistory(drafts,name)
    };
  }

  function buildTagDefinitionIndex(tagsInput){
    const source = tagsInput && typeof tagsInput === 'object' ? tagsInput : {};
    const byId = {};
    const categoryById = {};
    const duplicateIds = [];
    Object.keys(source).forEach(category=>{
      const entries = Array.isArray(source[category]) ? source[category] : [];
      entries.forEach(entry=>{
        const id = normalizeName(entry?.id);
        if(!id) return;
        if(hasOwn(byId,id)) duplicateIds.push(id);
        byId[id] = entry;
        categoryById[id] = category;
      });
    });
    return {byId,categoryById,duplicateIds:[...new Set(duplicateIds)]};
  }

  function normalizeDatabaseValidationInput(draftsOrOptions, cardsArg, tagsArg){
    if(draftsOrOptions && !Array.isArray(draftsOrOptions) && typeof draftsOrOptions === 'object' && hasOwn(draftsOrOptions,'drafts')){
      return {
        drafts:Array.isArray(draftsOrOptions.drafts) ? draftsOrOptions.drafts : [],
        cards:Array.isArray(draftsOrOptions.cards) ? draftsOrOptions.cards : [],
        tags:draftsOrOptions.tags && typeof draftsOrOptions.tags === 'object' ? draftsOrOptions.tags : {}
      };
    }
    return {
      drafts:Array.isArray(draftsOrOptions) ? draftsOrOptions : [],
      cards:Array.isArray(cardsArg) ? cardsArg : [],
      tags:tagsArg && typeof tagsArg === 'object' ? tagsArg : {}
    };
  }

  function validateDatabase(draftsOrOptions, cardsArg, tagsArg){
    const {drafts,cards,tags} = normalizeDatabaseValidationInput(draftsOrOptions,cardsArg,tagsArg);
    const issues = [];
    const pushIssue = (severity,code,details)=>issues.push({severity,code,...(details || {})});
    const seenDraftIds = new Set();
    const dateFormats = new Set();

    drafts.forEach((draft,index)=>{
      const id = draft?.id;
      if(seenDraftIds.has(id)) pushIssue('error','duplicateDraftId',{draftId:id,index});
      seenDraftIds.add(id);
      const validation = validateDraft(draft);
      validation.warnings.forEach(warning=>pushIssue('warning',`draft.${warning.code}`,{draftId:id,...warning}));

      const startDate = normalizeName(draft?.startDate);
      if(startDate){
        if(/^\d{4}-\d{2}-\d{2}$/.test(startDate)) dateFormats.add('iso');
        else if(/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)) dateFormats.add('dmy');
        else dateFormats.add('other');
      }

      (Array.isArray(draft?.matches) ? draft.matches : []).forEach((match,matchIndex)=>{
        if(getScoringSystem(draft) === 'standard25' && getMatchType(match,draft) === MATCH_TYPES.PLAYED &&
          isFinitePointValue(match?.pts1) && isFinitePointValue(match?.pts2)){
          const pts1 = Number(match.pts1);
          const pts2 = Number(match.pts2);
          if(!isValidStandard25Score(match)){
            pushIssue('error','invalidStandard25PlayedScore',{draftId:id,matchIndex,pts1,pts2});
          }
        }
      });
    });

    if(dateFormats.size > 1) pushIssue('warning','mixedDateFormats',{formats:[...dateFormats]});

    const cardByName = {};
    const duplicateCardNames = [];
    cards.forEach((card,index)=>{
      const name = normalizeName(card?.name);
      if(!name) return;
      if(hasOwn(cardByName,name)) duplicateCardNames.push(name);
      cardByName[name] = card;
      if(Array.isArray(card?.tags)){
        const duplicateTags = card.tags.filter((tag,tagIndex)=>card.tags.indexOf(tag) !== tagIndex);
        if(duplicateTags.length) pushIssue('warning','duplicateCardTag',{card:name,tags:[...new Set(duplicateTags)]});
      }
    });
    [...new Set(duplicateCardNames)].forEach(name=>pushIssue('error','duplicateCardName',{card:name}));

    const tagIndex = buildTagDefinitionIndex(tags);
    tagIndex.duplicateIds.forEach(id=>pushIssue('error','duplicateTagId',{tagId:id}));

    if(cards.length && Object.keys(tagIndex.byId).length){
      cards.forEach(card=>{
        const name = normalizeName(card?.name);
        (Array.isArray(card?.tags) ? card.tags : []).forEach(tagId=>{
          if(!hasOwn(tagIndex.byId,tagId)) pushIssue('warning','unknownCardTag',{card:name,tagId});
        });
      });
    }

    drafts.forEach(draft=>{
      (Array.isArray(draft?.players) ? draft.players : []).forEach(player=>{
        const deck = Array.isArray(player?.deck) ? player.deck : [];
        if(deck.length !== 12) pushIssue('warning','unexpectedDeckSize',{draftId:draft?.id,player:normalizeName(player?.name),size:deck.length});
        const normalizedDeck = deck.map(normalizeName).filter(Boolean);
        const duplicateCards = normalizedDeck.filter((name,index)=>normalizedDeck.indexOf(name) !== index);
        if(duplicateCards.length) pushIssue('warning','duplicateCardInDeck',{draftId:draft?.id,player:normalizeName(player?.name),cards:[...new Set(duplicateCards)]});
        if(cards.length){
          normalizedDeck.forEach(cardName=>{
            if(!hasOwn(cardByName,cardName)) pushIssue('warning','unknownDeckCard',{draftId:draft?.id,player:normalizeName(player?.name),card:cardName});
          });
        }
      });
    });

    const counts = issues.reduce((acc,issue)=>{
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },{error:0,warning:0,info:0});

    return {
      valid:counts.error === 0,
      counts,
      issues,
      totals:{
        drafts:drafts.length,
        finishedDrafts:drafts.filter(isDraftFinished).length,
        activeDrafts:drafts.filter(draft=>!isDraftFinished(draft)).length,
        cards:cards.length,
        tags:Object.keys(tagIndex.byId).length
      }
    };
  }

  function createStatsContext(options){
    const source = options && typeof options === 'object' ? options : {};
    const drafts = Array.isArray(source.drafts) ? source.drafts : [];
    const cards = Array.isArray(source.cards) ? source.cards : [];
    const tags = source.tags && typeof source.tags === 'object' ? source.tags : {};
    const finishedDrafts = getFinishedDraftsChronologically(drafts);
    const activeDrafts = drafts.filter(draft=>!isDraftFinished(draft)).slice().sort((a,b)=>numberOrZero(a?.id)-numberOrZero(b?.id));
    const draftById = {};
    const playerDraftsByName = {};
    const playerNames = new Set();
    const cardByName = {};
    const deckAppearancesByCard = {};

    drafts.forEach(draft=>{
      draftById[draft?.id] = draft;
      (Array.isArray(draft?.players) ? draft.players : []).forEach(player=>{
        const name = normalizeName(player?.name);
        if(!name) return;
        playerNames.add(name);
        if(!playerDraftsByName[name]) playerDraftsByName[name] = [];
        playerDraftsByName[name].push(draft);
        (Array.isArray(player?.deck) ? player.deck : []).forEach(cardNameRaw=>{
          const cardName = normalizeName(cardNameRaw);
          if(!cardName) return;
          if(!deckAppearancesByCard[cardName]) deckAppearancesByCard[cardName] = [];
          deckAppearancesByCard[cardName].push({draftId:numberOrZero(draft?.id),player:name,finished:isDraftFinished(draft)});
        });
      });
    });
    Object.keys(playerDraftsByName).forEach(name=>playerDraftsByName[name].sort((a,b)=>numberOrZero(a?.id)-numberOrZero(b?.id)));
    cards.forEach(card=>{ const name = normalizeName(card?.name); if(name) cardByName[name] = card; });
    const tagIndex = buildTagDefinitionIndex(tags);
    const legendStandings = calculateLegendStandings(drafts);
    const playerProfileCache = new Map();
    let validationCache = null;
    let archiveSnapshotCache = null;

    function playerCacheKey(name,profileOptions){
      const minimum = Number(profileOptions?.rivalryMinimum) || SAMPLE_THRESHOLDS.PLAYER_RIVALRY_MATCHES;
      return `${normalizeName(name)}::${minimum}`;
    }

    const context = {
      drafts,
      finishedDrafts,
      activeDrafts,
      cards,
      tags,
      legendStandings,
      indexes:Object.freeze({
        draftById,
        playerDraftsByName,
        playerNames:[...playerNames].sort((a,b)=>a.localeCompare(b,'pl')),
        cardByName,
        deckAppearancesByCard,
        tagById:tagIndex.byId,
        tagCategoryById:tagIndex.categoryById
      }),
      getDraft(id){ return draftById[id] || null; },
      getPlayerNames(){ return [...context.indexes.playerNames]; },
      getPlayerSummary(name){ return calculatePlayerSummary(drafts,name); },
      getPlayerProfile(name,profileOptions){
        const key = playerCacheKey(name,profileOptions);
        if(!playerProfileCache.has(key)) playerProfileCache.set(key,calculatePlayerProfile(drafts,name,profileOptions));
        return playerProfileCache.get(key);
      },
      getPlayerHistory(name){ return calculatePlayerHistory(drafts,name); },
      getPlayerRivalries(name,minimum){ return calculatePlayerRivalries(drafts,name,minimum); },
      getPlayerBattleStats(name){ return calculatePlayerBattleStats(drafts,name); },
      getPlayerMatchBreakdown(name){ return calculatePlayerMatchBreakdown(drafts,name); },
      getCardMetadata(name){ return cardByName[normalizeName(name)] || null; },
      getCardDeckAppearances(name){ return (deckAppearancesByCard[normalizeName(name)] || []).slice(); },
      getTagDefinition(id){ return tagIndex.byId[normalizeName(id)] || null; },
      getTagCategory(id){ return tagIndex.categoryById[normalizeName(id)] || null; },
      getArchiveSnapshot(){
        if(!archiveSnapshotCache) archiveSnapshotCache = buildArchiveSnapshot({drafts,cards,tags});
        return archiveSnapshotCache;
      },
      validate(){
        if(!validationCache) validationCache = validateDatabase({drafts,cards,tags});
        return validationCache;
      },
      clearCaches(){ playerProfileCache.clear(); validationCache = null; archiveSnapshotCache = null; }
    };
    return Object.freeze(context);
  }

  function compareLocale(first,second){
    return normalizeName(first).localeCompare(normalizeName(second),'pl');
  }

  function average(values){
    const valid = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    return valid.length ? valid.reduce((sum,value)=>sum+value,0) / valid.length : 0;
  }

  function standardDeviation(values){
    const valid = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    if(!valid.length) return null;
    const mean = average(valid);
    return Math.sqrt(valid.reduce((sum,value)=>sum+Math.pow(value-mean,2),0)/valid.length);
  }

  function rankArchiveTop(items, valueGetter, direction, limit){
    const getValue = typeof valueGetter === 'function' ? valueGetter : item=>numberOrZero(item?.value);
    const factor = direction === 'asc' ? 1 : -1;
    const ordered = (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .slice()
      .sort((first,second)=>{
        const valueOrder = (numberOrZero(getValue(first))-numberOrZero(getValue(second))) * factor;
        if(valueOrder) return valueOrder;
        const firstRank = Number.isFinite(Number(first?.legendRank)) ? Number(first.legendRank) : Number.MAX_SAFE_INTEGER;
        const secondRank = Number.isFinite(Number(second?.legendRank)) ? Number(second.legendRank) : Number.MAX_SAFE_INTEGER;
        return firstRank-secondRank ||
          numberOrZero(second?.legendPoints)-numberOrZero(first?.legendPoints) ||
          numberOrZero(second?.draftPoints)-numberOrZero(first?.draftPoints) ||
          compareLocale(first?.name || first?.label,second?.name || second?.label);
      });
    const places = Math.max(1,Number(limit) || 3);
    let currentPlace = 0;
    let previousValue = null;
    return ordered.map((item,index)=>{
      const value = numberOrZero(getValue(item));
      if(index === 0 || value !== previousValue) currentPlace = index + 1;
      previousValue = value;
      return {...item,statPlace:currentPlace};
    }).filter(item=>item.statPlace <= places);
  }

  function buildArchiveSnapshot(options){
    const source = options && typeof options === 'object' ? options : {};
    const drafts = Array.isArray(source.drafts) ? source.drafts : [];
    const cards = Array.isArray(source.cards) ? source.cards : [];
    const context = createStatsContext({drafts,cards,tags:source.tags || {}});
    const finishedDrafts = context.finishedDrafts;
    const finishedWithMatches = finishedDrafts.filter(draft=>(draft?.matches || []).length);
    const startOrderCoverage = finishedWithMatches.length
      ? finishedWithMatches.filter(draft=>Array.isArray(draft?.startOrder) && draft.startOrder.length).length / finishedWithMatches.length
      : 0;
    const reliableMatchOrder = startOrderCoverage === 1;
    const cardMetaByName = {};
    cards.forEach(card=>{
      const name = normalizeName(card?.name);
      if(name) cardMetaByName[name] = card;
    });

    const playerNames = new Set();
    const deckCardNames = new Set();
    const cardMap = {};
    const cardPairMap = {};
    const h2hMap = {};
    const playerBattleMargins = {};
    const timeline = [];
    const draftRows = [];
    const global = {
      drafts:drafts.length,
      finishedDrafts:finishedDrafts.length,
      activeDrafts:drafts.length-finishedDrafts.length,
      players:0,
      storedMatches:0,
      playedMatches:0,
      walkovers:0,
      doubleWalkovers:0,
      decks:0,
      deckCards:0,
      availableCards:cards.length,
      totalRecordedPoints:0
    };
    let biggestStomp = null;
    let closestBattle = null;

    function ensureCard(nameRaw){
      const name = normalizeName(nameRaw);
      if(!name) return null;
      if(!cardMap[name]){
        cardMap[name] = {
          name,
          cost:Number.isFinite(Number(cardMetaByName[name]?.cost)) ? Number(cardMetaByName[name].cost) : null,
          power:Number.isFinite(Number(cardMetaByName[name]?.power)) ? Number(cardMetaByName[name].power) : null,
          appearances:0,
          draftIds:new Set(),
          owners:{},
          matches:0,
          wins:0,
          losses:0,
          draftWins:0,
          podiums:0,
          legendPoints:0,
          partners:{}
        };
      }
      return cardMap[name];
    }

    function addCardOutcome(cardNames,outcome){
      (Array.isArray(cardNames) ? cardNames : []).forEach(cardName=>{
        const stat = ensureCard(cardName);
        if(!stat) return;
        stat.matches++;
        if(outcome === 'win') stat.wins++;
        if(outcome === 'loss') stat.losses++;
      });
    }

    drafts.forEach(draft=>{
      const draftId = numberOrZero(draft?.id);
      const finished = isDraftFinished(draft);
      const players = Array.isArray(draft?.players) ? draft.players : [];
      const matches = Array.isArray(draft?.matches) ? draft.matches : [];
      const deckByPlayer = {};
      const uniqueDraftCards = new Set();
      let deckSlots = 0;

      players.forEach(player=>{
        const playerName = normalizeName(player?.name);
        if(!playerName) return;
        playerNames.add(playerName);
        global.decks++;
        const rawDeck = (Array.isArray(player?.deck) ? player.deck : []).map(normalizeName).filter(Boolean);
        const deck = [...new Set(rawDeck)];
        // Slot count preserves legal duplicate instances. Card appearance/pair analytics
        // intentionally count a card name at most once per final deck.
        deckSlots += rawDeck.length;
        deckByPlayer[playerName] = deck;
        rawDeck.forEach(cardName=>uniqueDraftCards.add(cardName));

        // Historical card records are frozen to FINISHED drafts only.
        if(finished){
          deck.forEach(cardName=>{
            deckCardNames.add(cardName);
            const stat = ensureCard(cardName);
            stat.appearances++;
            stat.draftIds.add(draftId);
            stat.owners[playerName] = numberOrZero(stat.owners[playerName])+1;
          });
          for(let first=0; first<deck.length; first++){
            for(let second=first+1; second<deck.length; second++){
              const names = [deck[first],deck[second]].sort((a,b)=>compareLocale(a,b));
              const key = names.join('::');
              if(!cardPairMap[key]) cardPairMap[key] = {cardA:names[0],cardB:names[1],decks:0,draftIds:new Set()};
              cardPairMap[key].decks++;
              cardPairMap[key].draftIds.add(draftId);
              const firstCard = ensureCard(names[0]);
              const secondCard = ensureCard(names[1]);
              firstCard.partners[names[1]] = numberOrZero(firstCard.partners[names[1]])+1;
              secondCard.partners[names[0]] = numberOrZero(secondCard.partners[names[0]])+1;
            }
          }
        }
      });

      matches.forEach(match=>{
        if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;
        global.storedMatches++;
        global.totalRecordedPoints += Number(match.pts1)+Number(match.pts2);
        const type = getMatchType(match,draft);
        if(type === MATCH_TYPES.PLAYED) global.playedMatches++;
        if(type === MATCH_TYPES.WALKOVER) global.walkovers++;
        if(type === MATCH_TYPES.DOUBLE_WALKOVER) global.doubleWalkovers++;
      });

      let ranking = [];
      let winner = null;
      let winnerMargin = null;
      let pointSpread = null;
      if(finished){
        ranking = getDraftLegendOrder(draft);
        winner = getDraftWinner(draft);
        if(ranking.length > 1) winnerMargin = numberOrZero(ranking[0]?.total)-numberOrZero(ranking[1]?.total);
        if(ranking.length){
          const totals = ranking.map(player=>numberOrZero(player?.total));
          pointSpread = Math.max(...totals)-Math.min(...totals);
        }
        const placeByName = {};
        ranking.forEach((player,index)=>{ placeByName[player.name] = index+1; });
        players.forEach(player=>{
          const playerName = normalizeName(player?.name);
          const place = placeByName[playerName];
          const deck = deckByPlayer[playerName] || [];
          deck.forEach(cardName=>{
            const stat = ensureCard(cardName);
            if(place === 1) stat.draftWins++;
            if(place && place <= 3) stat.podiums++;
            stat.legendPoints += place ? numberOrZero(LEGEND_POINTS[place]) : 0;
          });
        });

        matches.forEach((match,index)=>{
          if(getMatchType(match,draft) !== MATCH_TYPES.PLAYED) return;
          if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)) return;
          const p1 = normalizeName(match?.p1);
          const p2 = normalizeName(match?.p2);
          const result = getMatchResult(match,draft);
          if(result.p1Outcome !== 'win' && result.p1Outcome !== 'loss') return;
          addCardOutcome(deckByPlayer[p1],result.p1Outcome);
          addCardOutcome(deckByPlayer[p2],result.p2Outcome);

          const pairNames = [p1,p2].sort((a,b)=>compareLocale(a,b));
          const h2hKey = pairNames.join('::');
          if(!h2hMap[h2hKey]) h2hMap[h2hKey] = {playerA:pairNames[0],playerB:pairNames[1],matches:0,winsA:0,winsB:0,draftIds:new Set()};
          const h2h = h2hMap[h2hKey];
          h2h.matches++;
          h2h.draftIds.add(draftId);
          if(result.winner === h2h.playerA) h2h.winsA++;
          if(result.winner === h2h.playerB) h2h.winsB++;

          const battle = getBattleResult(match,draft);
          if(!battle) return;
          const margin = battle.winnerPoints-battle.loserPoints;
          [p1,p2].forEach(playerName=>{
            if(!playerBattleMargins[playerName]) playerBattleMargins[playerName] = [];
            playerBattleMargins[playerName].push(margin);
          });
          const battleRow = {
            draftId,
            matchIndex:index,
            winner:battle.winner,
            loser:battle.loser,
            winnerPoints:battle.winnerPoints,
            loserPoints:battle.loserPoints,
            margin
          };
          if(!biggestStomp || margin > biggestStomp.margin) biggestStomp = battleRow;
          if(!closestBattle || margin < closestBattle.margin) closestBattle = battleRow;
        });
      }

      const cleanWins = matches.filter(match=>isCleanWin(match,draft)).length;
      const totalPoints = matches.reduce((sum,match)=>sum+numberOrZero(match?.pts1)+numberOrZero(match?.pts2),0);
      const battleRows = matches.map(match=>getBattleResult(match,draft)).filter(Boolean);
      const battleMargins = battleRows.map(battle=>battle.winnerPoints-battle.loserPoints);
      const playerEfficiencies = finished && supportsBattleLifeStats(draft)
        ? ranking.map(player=>{
            const matchCount = numberOrZero(player?.matches);
            return matchCount ? numberOrZero(player?.total)/(matchCount*STAT_RULES.BATTLE_TOTAL_POINTS) : null;
          }).filter(Number.isFinite)
        : [];
      const efficiencyDispersion = standardDeviation(playerEfficiencies);
      const normalizedWinnerGap = finished && supportsBattleLifeStats(draft) && ranking.length > 1
        ? Math.max(0,(numberOrZero(ranking[0]?.total)-numberOrZero(ranking[1]?.total))/
          (Math.max(1,numberOrZero(ranking[0]?.matches))*STAT_RULES.BATTLE_TOTAL_POINTS))
        : null;
      const row = {
        id:draftId,
        label:`D${draftId}`,
        startDate:draft?.startDate || null,
        endDate:draft?.endDate || null,
        mode:normalizeName(draft?.mode) || 'Brak danych',
        status:finished ? DRAFT_STATUSES.FINISHED : DRAFT_STATUSES.ACTIVE,
        players:players.length,
        matches:matches.length,
        uniqueCards:uniqueDraftCards.size,
        deckSlots,
        diversityRate:deckSlots ? uniqueDraftCards.size/deckSlots : null,
        totalPoints,
        cleanWins,
        battleMatches:battleRows.length,
        brutalRate:battleRows.length ? battleRows.filter(battle=>battle.cleanWin).length/battleRows.length : null,
        nervousRate:battleRows.length ? battleRows.filter(battle=>battle.lastLifeWin).length/battleRows.length : null,
        averageBattleMargin:battleMargins.length ? average(battleMargins) : null,
        balanceIndex:efficiencyDispersion === null ? null : Math.max(0,100*(1-Math.min(1,efficiencyDispersion/.5))),
        normalizedWinnerGap,
        winner:finished ? winner : null,
        winnerMargin:finished ? winnerMargin : null,
        pointSpread:finished ? pointSpread : null
      };
      draftRows.push(row);
      timeline.push(row);
    });

    global.players = playerNames.size;
    global.deckCards = deckCardNames.size;

    const playerRows = [...playerNames].map(name=>{
      const profile = context.getPlayerProfile(name);
      if(!profile) return null;
      const summary = profile.summary;
      const history = profile.history || [];
      const debut = history[0] || null;
      const debutPercentile = debut ? calculateFinishPercentile(debut.place,debut.playerCount) : null;
      let biggestComeback = null;
      for(let index=1; index<history.length; index++){
        const before = history[index-1];
        const after = history[index];
        const beforePercentile = calculateFinishPercentile(before.place,before.playerCount);
        const afterPercentile = calculateFinishPercentile(after.place,after.playerCount);
        if(beforePercentile === null || afterPercentile === null) continue;
        const improvement = afterPercentile-beforePercentile;
        if(!biggestComeback || improvement > biggestComeback.improvement){
          biggestComeback = {fromDraftId:before.draftId,toDraftId:after.draftId,improvement};
        }
      }
      const firstTitleIndex = history.findIndex(item=>item.isWinner);
      return {
        name,
        drafts:summary.drafts,
        draftWins:summary.draftWins,
        podiums:summary.podiums,
        officialMatches:summary.officialMatches,
        officialWins:summary.wins,
        officialLosses:summary.losses,
        balance:summary.balance,
        playedMatches:summary.playedMatches,
        playedWins:summary.playedWins,
        playedLosses:summary.playedLosses,
        playedWinRate:summary.playedWinRate,
        cleanWins:profile.battle.cleanWins,
        winStreak:reliableMatchOrder ? profile.streaks.longestWinStreak.length : null,
        consecutiveDrafts:profile.streaks.consecutiveDraftAppearances.length,
        draftPoints:summary.draftPoints,
        legendPoints:summary.legendPoints,
        legendRank:summary.legendRank,
        averageFinishPercentile:summary.averageFinishPercentile,
        titleRate:summary.titleRate,
        podiumRate:summary.podiumRate,
        debutDraftId:debut?.draftId || null,
        debutPlace:debut?.place || null,
        debutPercentile,
        debutWinRate:debut?.battle?.winRate ?? null,
        debutBattleMatches:debut?.battle?.eligibleMatches || 0,
        rookieChampion:Boolean(debut?.isWinner),
        draftsToFirstTitle:firstTitleIndex >= 0 ? firstTitleIndex+1 : null,
        comeback:biggestComeback,
        averageBattleMargin:average(playerBattleMargins[name] || []),
        closeBattleSample:(playerBattleMargins[name] || []).length,
        lossPoints:summary.lossPoints,
        walkovers:summary.walkoverMatches+summary.doubleWalkovers
      };
    }).filter(Boolean).filter(player=>player.drafts > 0);

    // One historical performance = one player in one finished draft.
    // This is the missing middle layer between career records and whole-event records.
    const performanceRows = [];
    finishedDrafts.forEach(draft=>{
      const playerCount = getActualPlayerCount(draft);
      (Array.isArray(draft?.players) ? draft.players : []).forEach(player=>{
        const playerName = normalizeName(player?.name);
        if(!playerName) return;
        const performance = buildPlayerDraftPerformance(draft,playerName);
        if(!performance) return;
        const standard25 = supportsBattleLifeStats(draft);
        const scoreEfficiency = standard25 && performance.matches > 0
          ? performance.points / (performance.matches * STAT_RULES.BATTLE_TOTAL_POINTS)
          : null;
        performanceRows.push({
          ...performance,
          name:playerName,
          player:playerName,
          playerCount,
          scoreEfficiency
        });
      });
    });

    const cardRows = Object.values(cardMap).map(stat=>{
      const owners = Object.entries(stat.owners).map(([name,appearances])=>({name,appearances}))
        .sort((a,b)=>b.appearances-a.appearances || compareLocale(a.name,b.name));
      const partners = Object.entries(stat.partners).map(([name,decks])=>({name,decks}))
        .sort((a,b)=>b.decks-a.decks || compareLocale(a.name,b.name));
      return {
        name:stat.name,
        cost:stat.cost,
        power:stat.power,
        appearances:stat.appearances,
        drafts:stat.draftIds.size,
        owners:owners.length,
        ownerRows:owners,
        topOwner:owners[0] || null,
        topPartner:partners[0] || null,
        matches:stat.matches,
        wins:stat.wins,
        losses:stat.losses,
        winRate:calculateWinRate(stat.wins,stat.losses),
        draftWins:stat.draftWins,
        podiums:stat.podiums,
        legendPoints:stat.legendPoints
      };
    });

    const cardPairs = Object.values(cardPairMap).map(pair=>({
      cardA:pair.cardA,
      cardB:pair.cardB,
      decks:pair.decks,
      drafts:pair.draftIds.size,
      name:`${pair.cardA} + ${pair.cardB}`
    })).sort((a,b)=>b.decks-a.decks || compareLocale(a.name,b.name));

    const h2h = Object.values(h2hMap).map(pair=>({
      playerA:pair.playerA,
      playerB:pair.playerB,
      name:`${pair.playerA} vs ${pair.playerB}`,
      matches:pair.matches,
      winsA:pair.winsA,
      winsB:pair.winsB,
      drafts:pair.draftIds.size,
      balance:Math.abs(pair.winsA-pair.winsB),
      leader:pair.winsA === pair.winsB ? null : (pair.winsA > pair.winsB ? pair.playerA : pair.playerB),
      leaderWins:Math.max(pair.winsA,pair.winsB)
    })).sort((a,b)=>b.matches-a.matches || compareLocale(a.name,b.name));

    const qualifiedPlayers = playerRows.filter(player=>qualifiesSample(player.playedMatches,SAMPLE_THRESHOLDS.GLOBAL_PLAYER_WR_MATCHES));
    const qualifiedFinishPlayers = playerRows.filter(player=>qualifiesSample(player.drafts,SAMPLE_THRESHOLDS.GLOBAL_FINISH_DRAFTS));
    const qualifiedPodiumPlayers = playerRows.filter(player=>qualifiesSample(player.drafts,SAMPLE_THRESHOLDS.GLOBAL_PODIUM_RATE_DRAFTS));
    const qualifiedCards = cardRows.filter(card=>qualifiesSample(card.matches,SAMPLE_THRESHOLDS.GLOBAL_CARD_WR_MATCHES));
    const qualifiedH2H = h2h.filter(pair=>qualifiesSample(pair.matches,SAMPLE_THRESHOLDS.GLOBAL_RIVALRY_MATCHES));
    const finishedDraftRows = draftRows.filter(draft=>draft.status === DRAFT_STATUSES.FINISHED);

    const playerRecords = {
      success:{
        draftWins:rankArchiveTop(playerRows,item=>item.draftWins,'desc',3),
        podiums:rankArchiveTop(playerRows,item=>item.podiums,'desc',3),
        averageFinish:rankArchiveTop(
          qualifiedFinishPlayers.filter(item=>item.averageFinish !== null),
          item=>item.averageFinish,
          'asc',
          3
        ),
        podiumRate:rankArchiveTop(qualifiedPodiumPlayers,item=>item.podiumRate,'desc',3),
        drafts:rankArchiveTop(playerRows,item=>item.drafts,'desc',3)
      },
      effectiveness:{
        matches:rankArchiveTop(playerRows,item=>item.officialMatches,'desc',3),
        wins:rankArchiveTop(playerRows,item=>item.playedWins,'desc',3),
        balance:rankArchiveTop(playerRows,item=>item.balance,'desc',3),
        winRate:rankArchiveTop(qualifiedPlayers,item=>item.playedWinRate,'desc',3),
        winStreak:reliableMatchOrder ? rankArchiveTop(playerRows,item=>item.winStreak,'desc',3) : [],
        cleanWins:rankArchiveTop(playerRows,item=>item.cleanWins,'desc',3)
      },
      accumulation:{
        legendPoints:rankArchiveTop(playerRows,item=>item.legendPoints,'desc',3),
        draftPoints:rankArchiveTop(playerRows,item=>item.draftPoints,'desc',3),
        averageDraftPoints:rankArchiveTop(qualifiedFinishPlayers,item=>item.averageDraftPoints,'desc',3)
      }
    };

    const cardRecords = {
      popularity:{
        appearances:rankArchiveTop(cardRows,item=>item.appearances,'desc',3),
        drafts:rankArchiveTop(cardRows,item=>item.drafts,'desc',3),
        owners:rankArchiveTop(cardRows,item=>item.owners,'desc',3)
      },
      effectiveness:{
        wins:rankArchiveTop(cardRows,item=>item.wins,'desc',3),
        winRate:rankArchiveTop(qualifiedCards,item=>item.winRate,'desc',3),
        matches:rankArchiveTop(cardRows,item=>item.matches,'desc',3)
      },
      success:{
        draftWins:rankArchiveTop(cardRows,item=>item.draftWins,'desc',3),
        podiums:rankArchiveTop(cardRows,item=>item.podiums,'desc',3),
        legendPoints:rankArchiveTop(cardRows,item=>item.legendPoints,'desc',3)
      },
      pilots:cardRows.filter(card=>card.topOwner).map(card=>({
        name:`${card.topOwner.name} + ${card.name}`,
        player:card.topOwner.name,
        card:card.name,
        appearances:card.topOwner.appearances,
        cardAppearances:card.appearances,
        share:card.appearances ? card.topOwner.appearances/card.appearances : 0
      })).sort((a,b)=>b.appearances-a.appearances || b.share-a.share || compareLocale(a.name,b.name)).slice(0,3),
      pairs:cardPairs.slice(0,3)
    };

    const draftRecords = {
      largest:rankArchiveTop(finishedDraftRows,item=>item.players,'desc',3),
      smallest:rankArchiveTop(finishedDraftRows,item=>item.players,'asc',3),
      matches:rankArchiveTop(finishedDraftRows,item=>item.matches,'desc',3),
      uniqueCards:rankArchiveTop(finishedDraftRows,item=>item.uniqueCards,'desc',3),
      diversityRate:rankArchiveTop(finishedDraftRows.filter(item=>item.diversityRate !== null),item=>item.diversityRate,'desc',3),
      dominance:rankArchiveTop(finishedDraftRows.filter(item=>item.normalizedWinnerGap !== null),item=>item.normalizedWinnerGap,'desc',3),
      balance:rankArchiveTop(finishedDraftRows.filter(item=>item.balanceIndex !== null),item=>item.balanceIndex,'desc',3),
      cleanWins:rankArchiveTop(finishedDraftRows,item=>item.cleanWins,'desc',3),
      brutal:rankArchiveTop(finishedDraftRows.filter(item=>item.brutalRate !== null),item=>item.brutalRate,'desc',3),
      nervous:rankArchiveTop(finishedDraftRows.filter(item=>item.nervousRate !== null),item=>item.nervousRate,'desc',3),
      oneSided:rankArchiveTop(finishedDraftRows.filter(item=>item.averageBattleMargin !== null),item=>item.averageBattleMargin,'desc',3),
      balancedBattles:rankArchiveTop(finishedDraftRows.filter(item=>item.averageBattleMargin !== null),item=>item.averageBattleMargin,'asc',3),
      totalPoints:rankArchiveTop(finishedDraftRows,item=>item.totalPoints,'desc',3)
    };

    const perfectRuns = performanceRows.filter(item=>
      item.battle?.eligibleMatches >= 3 &&
      item.battle?.wins === item.battle?.eligibleMatches
    );
    const performanceRecords = {
      draftPoints:rankArchiveTop(performanceRows,item=>item.points,'desc',3),
      wins:rankArchiveTop(performanceRows,item=>item.wins,'desc',3),
      perfectRun:rankArchiveTop(perfectRuns,item=>item.battle.eligibleMatches,'desc',3),
      cleanWins:rankArchiveTop(performanceRows,item=>item.battle?.cleanWins || 0,'desc',3),
      scoreEfficiency:rankArchiveTop(
        performanceRows.filter(item=>item.scoreEfficiency !== null),
        item=>item.scoreEfficiency,
        'desc',
        3
      )
    };

    const rivalryRecords = {
      mostMeetings:rankArchiveTop(h2h,item=>item.matches,'desc',3),
      closest:rankArchiveTop(qualifiedH2H,item=>item.balance,'asc',3),
      oneSided:rankArchiveTop(qualifiedH2H,item=>item.balance,'desc',3),
      mostWinsAgainst:rankArchiveTop(qualifiedH2H,item=>item.leaderWins,'desc',3)
    };

    const loyalPair = cardRows.filter(card=>card.topOwner).map(card=>({
      name:`${card.topOwner.name} + ${card.name}`,
      player:card.topOwner.name,
      card:card.name,
      appearances:card.topOwner.appearances
    })).sort((a,b)=>b.appearances-a.appearances || compareLocale(a.name,b.name))[0] || null;

    const legendTop = context.legendStandings.ranking.slice(0,3);
    const legendFocus = context.legendStandings.ranking.slice(0,5).map(player=>player.name);
    const legendEvolution = finishedDrafts.map((draft,index)=>{
      const standings = calculateLegendStandings(finishedDrafts.slice(0,index+1));
      return {
        id:numberOrZero(draft?.id),
        ranks:Object.fromEntries(legendFocus.map(name=>[name,standings.rankByName[name] || null]))
      };
    });
    const veteranCardNoTitle = cardRows.filter(card=>card.drafts >= 3 && card.draftWins === 0)
      .sort((a,b)=>b.drafts-a.drafts || b.appearances-a.appearances || compareLocale(a.name,b.name))[0] || null;
    const alwaysClose = playerRows.filter(player=>player.closeBattleSample >= SAMPLE_THRESHOLDS.GLOBAL_PLAYER_WR_MATCHES)
      .sort((a,b)=>a.averageBattleMargin-b.averageBattleMargin || b.closeBattleSample-a.closeBattleSample || compareLocale(a.name,b.name))[0] || null;
    const bestDebut = playerRows.filter(player=>player.debutPercentile !== null)
      .sort((a,b)=>b.debutPercentile-a.debutPercentile || a.debutDraftId-b.debutDraftId || compareLocale(a.name,b.name))[0] || null;
    const rookieChampion = playerRows.filter(player=>player.rookieChampion)
      .sort((a,b)=>a.debutDraftId-b.debutDraftId || compareLocale(a.name,b.name))[0] || null;
    const bestDebutWinRate = playerRows.filter(player=>player.debutBattleMatches >= 3)
      .sort((a,b)=>b.debutWinRate-a.debutWinRate || b.debutBattleMatches-a.debutBattleMatches || compareLocale(a.name,b.name))[0] || null;
    const fastestCrown = playerRows.filter(player=>player.draftsToFirstTitle !== null)
      .sort((a,b)=>a.draftsToFirstTitle-b.draftsToFirstTitle || a.debutDraftId-b.debutDraftId || compareLocale(a.name,b.name))[0] || null;
    const glowUp = playerRows.filter(player=>player.comeback && player.comeback.improvement > 0)
      .sort((a,b)=>b.comeback.improvement-a.comeback.improvement || compareLocale(a.name,b.name))[0] || null;
    const attendanceStreak = playerRows.slice().sort((a,b)=>b.consecutiveDrafts-a.consecutiveDrafts || compareLocale(a.name,b.name))[0] || null;

    const curiosities = [];
    if(biggestStomp) curiosities.push({
      title:'Największy Standard25 stomp',
      value:`${biggestStomp.winner} ${biggestStomp.winnerPoints}–${biggestStomp.loserPoints} ${biggestStomp.loser}`,
      detail:`D${biggestStomp.draftId} · przewaga ${biggestStomp.margin} pkt`,
      entity:{type:'draft',id:biggestStomp.draftId}
    });
    if(closestBattle) curiosities.push({
      title:'Bitwa na najcieńszej linii',
      value:`${closestBattle.winner} ${closestBattle.winnerPoints}–${closestBattle.loserPoints} ${closestBattle.loser}`,
      detail:`D${closestBattle.draftId} · Standard25`,
      entity:{type:'draft',id:closestBattle.draftId}
    });
    if(glowUp) curiosities.push({
      title:'Największy kosmiczny glow-up',
      value:glowUp.name,
      detail:`D${glowUp.comeback.fromDraftId} → D${glowUp.comeback.toDraftId} · +${Math.round(glowUp.comeback.improvement*100)} pp pozycji względnej`,
      entity:{type:'player',name:glowUp.name}
    });
    if(bestDebut) curiosities.push({
      title:'Najmocniejszy debiut',
      value:bestDebut.name,
      detail:`D${bestDebut.debutDraftId} · miejsce ${bestDebut.debutPlace} · ${Math.round(bestDebut.debutPercentile*100)}% pozycji względnej`,
      entity:{type:'player',name:bestDebut.name}
    });
    if(bestDebutWinRate) curiosities.push({
      title:'Najlepszy debiutancki bilans',
      value:bestDebutWinRate.name,
      detail:`D${bestDebutWinRate.debutDraftId} · ${Math.round(bestDebutWinRate.debutWinRate*100)}% WR w ${bestDebutWinRate.debutBattleMatches} bitwach Standard25`,
      entity:{type:'player',name:bestDebutWinRate.name}
    });
    if(alwaysClose) curiosities.push({
      title:'Zawsze blisko',
      value:alwaysClose.name,
      detail:`Średnia różnica ${alwaysClose.averageBattleMargin.toFixed(1)} pkt w ${alwaysClose.closeBattleSample} bitwach Standard25`,
      entity:{type:'player',name:alwaysClose.name}
    });
    if(attendanceStreak) curiosities.push({
      title:'Nieprzerwana obecność',
      value:attendanceStreak.name,
      detail:`${attendanceStreak.consecutiveDrafts} kolejnych ukończonych draftów`,
      entity:{type:'player',name:attendanceStreak.name}
    });

    const snapshot = {
      version:'archive-v2.1',
      generatedFrom:{drafts:drafts.length,cards:cards.length},
      dataQuality:{
        scoringSystemCoverage:drafts.length ? drafts.filter(draft=>Boolean(getScoringSystem(draft))).length/drafts.length : 0,
        scoringSystems:drafts.reduce((map,draft)=>{
          const key=getScoringSystem(draft) || 'unknown';
          map[key]=numberOrZero(map[key])+1;
          return map;
        },{}),
        startOrderCoverage,
        reliableMatchOrder
      },
      thresholds:{
        playerWinRateMatches:SAMPLE_THRESHOLDS.GLOBAL_PLAYER_WR_MATCHES,
        cardWinRateMatches:SAMPLE_THRESHOLDS.GLOBAL_CARD_WR_MATCHES,
        rivalryMatches:SAMPLE_THRESHOLDS.GLOBAL_RIVALRY_MATCHES,
        finishDrafts:SAMPLE_THRESHOLDS.GLOBAL_FINISH_DRAFTS,
        podiumRateDrafts:SAMPLE_THRESHOLDS.GLOBAL_PODIUM_RATE_DRAFTS
      },
      legend:{top:legendTop,focus:legendFocus,evolution:legendEvolution},
      totals:global,
      players:playerRows,
      cards:cardRows,
      drafts:draftRows,
      h2h,
      timeline:timeline.slice().sort((a,b)=>numberOrZero(a.id)-numberOrZero(b.id)),
      records:{players:playerRecords,performances:performanceRecords,cards:cardRecords,drafts:draftRecords,rivalries:rivalryRecords},
      trends:{
        drafts:draftRows.map(draft=>({id:draft.id,players:draft.players,matches:draft.matches,uniqueCards:draft.uniqueCards,status:draft.status,averageBattleMargin:draft.averageBattleMargin,battleMatches:draft.battleMatches})),
        attendance:draftRows.map(draft=>({id:draft.id,players:draft.players,status:draft.status})),
        legendEvolution,
        competitiveness:finishedDraftRows.filter(draft=>draft.averageBattleMargin !== null).map(draft=>({id:draft.id,averageBattleMargin:draft.averageBattleMargin,battleMatches:draft.battleMatches})),
        cardPopularity:cardRecords.popularity.appearances.slice(0,8),
        resultTypes:{played:global.playedMatches,walkover:global.walkovers,doubleWalkover:global.doubleWalkovers}
      },
      highlights:{biggestStomp,closestBattle,loyalPair,topCardPair:cardPairs[0] || null},
      curiosities
    };
    return Object.freeze(snapshot);
  }

  function createWarning(code, details){
    return {code, ...(details || {})};
  }

  function validateDraft(draft){
    const warnings = [];
    const rosterNames = getRosterNames(draft);
    const roster = new Set(rosterNames.filter(Boolean));
    const actualPlayerCount = getActualPlayerCount(draft);
    const declaredPlayerCount = Number(draft?.playersCount);

    if(hasOwn(draft, 'status')){
      const rawStatus = normalizeName(draft?.status);
      if(!VALID_DRAFT_STATUSES.has(rawStatus)){
        warnings.push(createWarning('invalidStatus',{value:draft?.status}));
      }
    }

    if(Number.isFinite(declaredPlayerCount) && declaredPlayerCount !== actualPlayerCount){
      warnings.push(createWarning('playersCountMismatch',{
        declared:declaredPlayerCount,
        actual:actualPlayerCount
      }));
    }

    const seenPlayerNames = new Set();
    rosterNames.forEach((name,index)=>{
      if(!name){
        warnings.push(createWarning('blankPlayerName',{index}));
        return;
      }
      if(seenPlayerNames.has(name)) warnings.push(createWarning('duplicatePlayerName',{name}));
      seenPlayerNames.add(name);
    });

    const seenPairs = new Set();
    (Array.isArray(draft?.matches) ? draft.matches : []).forEach((match,index)=>{
      const p1 = normalizeName(match?.p1);
      const p2 = normalizeName(match?.p2);

      if(p1 && p2){
        const key = pairKey(p1,p2);
        if(seenPairs.has(key)) warnings.push(createWarning('duplicateMatchPair',{index,p1,p2}));
        seenPairs.add(key);
      }

      if(p1 && p2 && p1 === p2) warnings.push(createWarning('selfMatch',{index,player:p1}));
      if(p1 && !roster.has(p1)) warnings.push(createWarning('unknownMatchPlayer',{index,player:p1}));
      if(p2 && !roster.has(p2)) warnings.push(createWarning('unknownMatchPlayer',{index,player:p2}));
      if(!isFinitePointValue(match?.pts1) || !isFinitePointValue(match?.pts2)){
        warnings.push(createWarning('invalidPoints',{index,pts1:match?.pts1,pts2:match?.pts2}));
      }

      if(hasOwn(match,'resultType') && !VALID_MATCH_TYPES.has(match.resultType)){
        warnings.push(createWarning('invalidResultType',{index,value:match.resultType}));
      }

      const matchType = getMatchType(match,draft);
      if(getScoringSystem(draft) === 'standard25' && matchType === MATCH_TYPES.PLAYED &&
        isFinitePointValue(match?.pts1) && isFinitePointValue(match?.pts2)){
        const standardPts1 = Number(match.pts1);
        const standardPts2 = Number(match.pts2);
        if(!isValidStandard25Score(match)){
          warnings.push(createWarning('invalidStandard25PlayedScore',{index,pts1:standardPts1,pts2:standardPts2}));
        }
      }
      if(matchType === MATCH_TYPES.WALKOVER &&
        isFinitePointValue(match?.pts1) && isFinitePointValue(match?.pts2) &&
        Number(match.pts1) === Number(match.pts2)){
        warnings.push(createWarning('walkoverWithoutWinner',{index,pts1:match.pts1,pts2:match.pts2}));
      }
      if(matchType === MATCH_TYPES.DOUBLE_WALKOVER &&
        isFinitePointValue(match?.pts1) && isFinitePointValue(match?.pts2) &&
        Number(match.pts1) !== Number(match.pts2)){
        warnings.push(createWarning('doubleWalkoverUnequalPoints',{index,pts1:match.pts1,pts2:match.pts2}));
      }
    });

    const draftStatus = getDraftStatus(draft);
    const leader = getDraftLeader(draft);
    const explicitWinner = getExplicitWinner(draft);
    const winnerKnown = Boolean(explicitWinner && roster.has(explicitWinner));
    const officialWinner = getDraftWinner(draft);
    const winnerMismatch = Boolean(
      draftStatus === DRAFT_STATUSES.FINISHED &&
      winnerKnown && leader && explicitWinner !== leader
    );

    if(explicitWinner && !winnerKnown){
      warnings.push(createWarning('unknownWinner',{winner:explicitWinner}));
    }
    if(draftStatus === DRAFT_STATUSES.ACTIVE && explicitWinner){
      warnings.push(createWarning('winnerOnActiveDraft',{winner:explicitWinner}));
    }
    if(winnerMismatch){
      warnings.push(createWarning('winnerMismatch',{
        officialWinner:explicitWinner,
        calculatedLeader:leader
      }));
    }

    const roundRobinComplete = isFullRoundRobin(draft);
    const resolvedPairCount = getResolvedPairKeys(draft).size;
    const expectedMatchCount = getExpectedMatchCount(draft);
    const rawStatus = hasOwn(draft,'status') ? normalizeName(draft?.status) : null;
    const statusSource = VALID_DRAFT_STATUSES.has(rawStatus)
      ? 'explicit'
      : (hasOwn(draft,'status') ? 'invalid-fallback' : 'fallback');

    return {
      valid:warnings.length === 0,
      warnings,
      status:draftStatus,
      statusSource,
      roundRobinComplete,
      actualPlayerCount,
      declaredPlayerCount:Number.isFinite(declaredPlayerCount) ? declaredPlayerCount : null,
      expectedMatchCount,
      resolvedPairCount,
      leader,
      winner:officialWinner,
      winnerMismatch
    };
  }

  return Object.freeze({
    MATCH_TYPES,
    DRAFT_STATUSES,
    LEGEND_POINTS,
    MIN_LEGEND_DRAFTS,
    SAMPLE_THRESHOLDS,
    STAT_RULES,
    STAT_DEFINITIONS,
    getScoringSystem,
    supportsBattleLifeStats,
    supportsCleanWins,
    isValidStandard25Score,
    getMatchType,
    getMatchResult,
    getPlayerOutcome,
    isWalkover,
    isDoubleWalkover,
    isBattleStatsEligibleMatch,
    getBattleResult,
    isCleanWin,
    isCleanLoss,
    isLastLifeWin,
    isLastLifeLoss,
    isPlayerCleanWin,
    isPlayerLastLifeWin,
    getActualPlayerCount,
    getExpectedMatchCount,
    isFullRoundRobin,
    getUnplayedMatches,
    getDraftStatus,
    isDraftFinished,
    calculateDraftStats,
    calculateDraftRanking,
    getDraftLeader,
    getDraftWinner,
    getDraftLegendOrder,
    getDraftLegendAwards,
    calculateLegendStandings,
    getPlayerLegendStats,
    getPlayerLegendRank,
    calculateWinRate,
    qualifiesSample,
    rankTopN,
    getStatDefinition,
    calculateFinishPercentile,
    calculatePlayerHistory,
    calculatePlayerTopPerformances,
    calculatePlayerRecords,
    calculatePlayerRivalries,
    calculatePlayerMatchBreakdown,
    calculatePlayerBattleStats,
    calculatePlayerStreaks,
    calculatePlayerSummary,
    calculatePlayerProfile,
    calculateCardProfile,
    buildArchiveSnapshot,
    validateDraft,
    validateDatabase,
    createStatsContext
  });
});
