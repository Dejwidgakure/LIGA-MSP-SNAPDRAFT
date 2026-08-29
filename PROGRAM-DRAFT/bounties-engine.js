(function(global){
    "use strict";

    const VERSION="1.4.7";
    const EXTENSION_ID="bounties";
    const DISPLAY_NAME="Łowcy Nagród";
    const DEFAULT_CONFIG=Object.freeze({
        roundChance:0.35,
        roundCooldownPicksPerPlayer:1,
        agedCheckChance:0.24,
        agedFirstGuaranteeChecks:2,
        agedCooldownPicks:2,
        agedEscalateEvery:2,
        agedMaxReward:4,
        flashSaleChance:0.10,
        flashSaleFactor:0.50,
        flashSaleFallbackDuplicate:3,
        flashSaleFallbackNoFuturePick:3
    });

    const REFERENCE_RULES=Object.freeze({
        roundBounty:{
            chancePerEligibleRound:0.35,
            openingGateNormalPicksFormula:"at least number_of_players total normal picks completed in the draft",
            firstRoundGuaranteeClassicByPlayers:[
                {players:"1-3",guaranteedByPack:2},
                {players:"4-8",guaranteedByPack:3},
                {players:"9+",guaranteedByPack:4}
            ],
            firstRoundGuaranteeGalacticCurrentByPlayers:[
                {players:"1-6",guaranteedByRound:1},
                {players:"7+",guaranteedByRound:2}
            ],
            cooldownFormula:"number_of_players * roundCooldownPicksPerPlayer normal picks",
            roundCooldownPicksPerPlayer:1,
            maxRoundsPerDraftByPlayers:[
                {players:"1-4",maxRounds:1},
                {players:"5-8",maxRounds:2},
                {players:"9-12",maxRounds:3},
                {players:"13+",maxRounds:4}
            ],
            bountiesAssignedPerRoundByEligibleCards:[
                {eligibleCards:"1-7",bountiesAssigned:1},
                {eligibleCards:"8-11",bountiesAssigned:2},
                {eligibleCards:"12-17",bountiesAssigned:3},
                {eligibleCards:"18-23",bountiesAssigned:4},
                {eligibleCards:"24+",bountiesAssigned:5}
            ]
        },
        agedBounty:{
            eligibleCheckChancePerAdvance:0.24,
            firstAgedGuaranteeChecks:2,
            sameTableCooldownPicks:2,
            ageThresholdByPlayers:[
                {players:"1-2",ageNeeded:2},
                {players:"3-6",ageNeeded:3},
                {players:"7-9",ageNeeded:4},
                {players:"10+",ageNeeded:5}
            ],
            maxAgedBountiesPerTableByInitialCardCount:[
                {initialCards:"1-11",maxAgedBounties:1},
                {initialCards:"12-21",maxAgedBounties:2},
                {initialCards:"22+",maxAgedBounties:3}
            ],
            rewardStartJeffCoins:2,
            escalationEverySurvivedChecks:2,
            rewardCapJeffCoins:4,
            targetSelection:"weighted among up to 3 oldest eligible cards"
        }
    });

    let runtimeRng=Math.random;
    let state=createEmptyState();
    const bountyPresentationQueue=[];
    const closedPresentationTables=new Set();
    let bountyPresentationRunning=false;
    let bountyPresentationCurrent=null;
    let bountyPresentationTimer=null;

    function createEmptyState(){
        return {
            version:VERSION,
            extensionId:EXTENSION_ID,
            displayName:DISPLAY_NAME,
            started:false,
            enabled:false,
            players:[],
            playerStats:[],
            config:{...DEFAULT_CONFIG},
            sequence:0,
            bountySequence:0,
            eventLog:[],
            roundDecisions:{},
            classicRoundsTriggered:0,
            galacticRoundsTriggered:0,
            agedBountiesAssigned:0,
            globalNormalPicksCompleted:0,
            lastRoundGlobalPick:null,
            tableTicks:{},
            tableState:{},
            telemetry:{
                spawned:0,
                roundSpawned:0,
                agedSpawned:0,
                claimed:0,
                expired:0,
                escalated:0,
                jeffCoinsAwarded:0,
                flashSaleSpawned:0,
                flashSaleGranted:0,
                flashSaleUsed:0,
                flashSaleExpired:0
            },
            startedAt:null
        };
    }

    function safeClone(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function random(){
        const value=Number(runtimeRng?.());
        return Number.isFinite(value) ? Math.min(0.999999999,Math.max(0,value)) : Math.random();
    }

    function shuffle(list){
        const result=[...(Array.isArray(list)?list:[])];
        for(let i=result.length-1;i>0;i--){
            const j=Math.floor(random()*(i+1));
            [result[i],result[j]]=[result[j],result[i]];
        }
        return result;
    }

    function normalizePlayers(players){
        return (Array.isArray(players)?players:[]).map((player,index)=>{
            const name=typeof player==="string"?player:player?.name;
            return String(name||`Gracz ${index+1}`);
        });
    }

    function isEnabled(){
        return Boolean(state.started&&state.enabled&&global.EconomyEngine?.isEnabled?.());
    }

    function ensurePlayerStat(playerIndex){
        const p=Number(playerIndex);
        if(!Number.isInteger(p)||p<0) return null;
        state.playerStats=Array.isArray(state.playerStats)?state.playerStats:[];
        if(!state.playerStats[p]){
            state.playerStats[p]={
                playerIndex:p,
                playerName:state.players[p]||`Gracz ${p+1}`,
                bountiesClaimed:0,
                coinBountiesClaimed:0,
                discountBountiesClaimed:0,
                jeffCoinsEarned:0,
                flashSalesGranted:0,
                flashSalesConverted:0,
                flashSalesUsed:0,
                flashSalesExpired:0
            };
        }
        return state.playerStats[p];
    }

    function getPlayerSummary(playerIndex){
        const stat=ensurePlayerStat(playerIndex);
        return stat?safeClone(stat):null;
    }

    function log(type,payload={}){
        const event={
            sequence:++state.sequence,
            type:String(type||"bounty_event"),
            bountyId:payload.bountyId||null,
            playerIndex:Number.isInteger(payload.playerIndex)?payload.playerIndex:null,
            playerName:Number.isInteger(payload.playerIndex)?state.players[payload.playerIndex]||null:null,
            cardInstanceId:payload.cardInstanceId||null,
            cardName:payload.cardName||null,
            source:payload.source||null,
            reward:safeClone(payload.reward||null),
            reason:payload.reason||null,
            data:safeClone(payload.data||{}),
            timestamp:Date.now()
        };
        state.eventLog.push(event);
        try{
            global.DraftStateEngine?.log?.(`bounty_${type}`,{
                packNumber:payload.packNumber??null,
                pickIndex:payload.pickIndex??null,
                playerIndex:Number.isInteger(payload.playerIndex)?payload.playerIndex:null,
                player:Number.isInteger(payload.playerIndex)?state.players[payload.playerIndex]||null:null,
                sourceCard:payload.card||null,
                resultCard:payload.resultCard||null,
                reason:payload.reason||payload.source||type,
                data:{
                    bountyVersion:VERSION,
                    bountyId:payload.bountyId||null,
                    cardInstanceId:payload.cardInstanceId||null,
                    reward:safeClone(payload.reward||null),
                    ...(payload.data||{})
                }
            });
        }catch(error){}
        return event;
    }

    function beginDraft(players,options={}){
        runtimeRng=typeof options.rng==="function"?options.rng:Math.random;
        bountyPresentationQueue.splice(0,bountyPresentationQueue.length);
        closedPresentationTables.clear();
        bountyPresentationRunning=false;
        bountyPresentationCurrent=null;
        clearTimeout(bountyPresentationTimer);
        bountyPresentationTimer=null;
        state=createEmptyState();
        state.started=true;
        state.players=normalizePlayers(players);
        state.playerStats=state.players.map((name,playerIndex)=>({
            playerIndex,
            playerName:name,
            bountiesClaimed:0,
            coinBountiesClaimed:0,
            discountBountiesClaimed:0,
            jeffCoinsEarned:0,
            flashSalesGranted:0,
            flashSalesConverted:0,
            flashSalesUsed:0,
            flashSalesExpired:0
        }));
        state.enabled=Boolean(options.enabled&&global.EconomyEngine?.isEnabled?.());
        state.config={...DEFAULT_CONFIG,...(options.config&&typeof options.config==="object"?options.config:{})};
        state.startedAt=Date.now();
        log("started",{
            reason:state.enabled?"enabled":"disabled",
            data:{players:state.players.length,config:state.config,economyRequired:true}
        });
        refreshLobbyDependency();
        return exportState();
    }

    function reset(){
        runtimeRng=Math.random;
        state=createEmptyState();
        bountyPresentationQueue.splice(0,bountyPresentationQueue.length);
        closedPresentationTables.clear();
        bountyPresentationRunning=false;
        bountyPresentationCurrent=null;
        clearTimeout(bountyPresentationTimer);
        bountyPresentationTimer=null;
        if(typeof document!=="undefined"){
            document.getElementById?.("bountyRoundOverlay")?.remove?.();
            document.querySelectorAll?.(".bounty-card-marker")?.forEach?.(node=>node.remove());
        }
        return exportState();
    }

    function ensureMeta(card){
        if(!card||typeof card!=="object") return null;
        card.instanceMeta=card.instanceMeta&&typeof card.instanceMeta==="object"?card.instanceMeta:{};
        return card.instanceMeta;
    }

    function getCardAge(card,mode="classic"){
        if(!card) return 0;
        const meta=ensureMeta(card);
        if(mode==="galactic_current"){
            return Math.max(0,Number(meta?.riverSurvivalCount??meta?.riverAge??0)||0);
        }
        return Math.max(0,Number(meta?.bountyAge||0)||0);
    }

    function getBounty(card){
        const bounty=card?.instanceMeta?.bounty;
        return bounty&&bounty.status!=="claimed"&&bounty.status!=="expired"?safeClone(bounty):null;
    }

    function hasBounty(card){
        return Boolean(getBounty(card));
    }

    function isSpiderReserved(card){
        try{
            return typeof global.getSpiderManReservationForCard==="function" && Boolean(global.getSpiderManReservationForCard(card));
        }catch(error){
            return false;
        }
    }

    function isAssignmentEligible(card){
        if(!card||typeof card!=="object"||!card.instanceId||hasBounty(card)) return false;
        if(isSpiderReserved(card)) return false;
        if(card.instanceMeta?.bountyBlocked===true) return false;
        return true;
    }

    function rollRoundReward(){
        const r=random();
        const flashChance=Math.max(0,Math.min(0.5,Number(state.config.flashSaleChance??0.10)||0));
        const moneySpan=Math.max(0.000001,1-flashChance);
        if(r>=moneySpan){
            return {
                kind:"flash_sale",
                label:"FLASH SALE 50%",
                factor:Number(state.config.flashSaleFactor||0.5),
                oneShot:true
            };
        }
        const moneyRoll=r/moneySpan;
        // W puli pieniężnej zachowujemy proporcję 60:25:5, czyli 2 JC jest najczęstsze.
        if(moneyRoll<(60/90)) return {kind:"jeffcoins",label:"+2 JC",amount:2};
        if(moneyRoll<(85/90)) return {kind:"jeffcoins",label:"+3 JC",amount:3};
        return {kind:"jeffcoins",label:"+4 JC",amount:4};
    }

    function rewardForSource(source){
        return String(source||"")==="aged"
            ? {kind:"jeffcoins",label:"+2 JC",amount:2}
            : rollRoundReward();
    }

    function assignBounty(card,source="round",context={}){
        if(!isEnabled()||!isAssignmentEligible(card)) return null;
        const meta=ensureMeta(card);
        const reward=context.reward&&typeof context.reward==="object"?safeClone(context.reward):rewardForSource(source);
        const bounty={
            id:`bounty-${++state.bountySequence}`,
            status:"active",
            source:String(source||"round"),
            reward,
            cardInstanceId:String(card.instanceId),
            cardName:card.name||null,
            assignedAt:Date.now(),
            assignedAtPack:Number(context.packNumber||0)||null,
            assignedAtPick:Number(context.pickIndex||0)||null,
            ageAtAssignment:getCardAge(card,context.mode||"classic"),
            survivedWithBounty:0,
            escalationCount:0
        };
        meta.bounty=bounty;
        state.telemetry.spawned=Number(state.telemetry.spawned||0)+1;
        if(bounty.source==="aged") state.telemetry.agedSpawned=Number(state.telemetry.agedSpawned||0)+1;
        else state.telemetry.roundSpawned=Number(state.telemetry.roundSpawned||0)+1;
        if(reward?.kind==="flash_sale") state.telemetry.flashSaleSpawned=Number(state.telemetry.flashSaleSpawned||0)+1;
        log("assigned",{
            bountyId:bounty.id,
            card,
            cardInstanceId:bounty.cardInstanceId,
            cardName:bounty.cardName,
            source:bounty.source,
            reward,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{mode:context.mode||"classic",ageAtAssignment:bounty.ageAtAssignment}
        });
        return safeClone(bounty);
    }

    function scaledRoundBountyCount(cardCount){
        const count=Math.max(0,Number(cardCount)||0);
        if(!count) return 0;
        if(count<=7) return 1;
        if(count<=11) return 2;
        if(count<=17) return 3;
        if(count<=23) return 4;
        return 5;
    }

    function maxBountyRoundsForPlayers(){
        const players=Math.max(1,state.players.length);
        if(players<=4) return 1;
        if(players<=8) return 2;
        if(players<=12) return 3;
        return 4;
    }

    function firstRoundGuaranteeOrdinal(mode){
        const players=Math.max(1,state.players.length);
        if(mode==="galactic_current") return players<=6 ? 1 : 2;
        if(players<=3) return 2;
        if(players<=8) return 3;
        return 4;
    }

    function roundCooldownPicks(){
        const multiplier=Math.max(1,Number(state.config.roundCooldownPicksPerPlayer||1));
        return Math.max(1,Math.round(state.players.length*multiplier));
    }

    function assignRoundBounties(cards,mode,context={}){
        const eligible=shuffle((Array.isArray(cards)?cards:[]).filter(isAssignmentEligible));
        const count=Math.min(eligible.length,scaledRoundBountyCount(eligible.length));
        const assigned=[];
        eligible.slice(0,count).forEach(card=>{
            const bounty=assignBounty(card,"round",{...context,mode});
            if(bounty) assigned.push(bounty);
        });
        return assigned;
    }

    function maybeStartBountyRound(mode,ordinal,cards,context={}){
        if(!isEnabled()) return {ok:false,triggered:false,reason:"disabled"};
        const normalizedMode=mode==="galactic_current"?"galactic_current":"classic";
        const key=`${normalizedMode}:${Number(ordinal)||0}`;
        if(Object.prototype.hasOwnProperty.call(state.roundDecisions,key)){
            return safeClone(state.roundDecisions[key]);
        }
        const used=normalizedMode==="galactic_current"?state.galacticRoundsTriggered:state.classicRoundsTriggered;
        const max=maxBountyRoundsForPlayers();
        const minimumOpeningPicks=Math.max(1,state.players.length);
        const cooldown=roundCooldownPicks();
        let reason="roll_missed";
        let triggered=false;

        const guaranteeOrdinal=firstRoundGuaranteeOrdinal(normalizedMode);
        const shouldGuaranteeFirstRound=used===0 && Number(ordinal||0)>=guaranteeOrdinal;

        if(state.globalNormalPicksCompleted<minimumOpeningPicks){
            reason="draft_too_fresh";
        }else if(used>=max){
            reason="round_cap";
        }else if(
            state.lastRoundGlobalPick!==null &&
            Number.isFinite(Number(state.lastRoundGlobalPick)) &&
            state.globalNormalPicksCompleted-Number(state.lastRoundGlobalPick)<cooldown
        ){
            reason="round_cooldown";
        }else if(shouldGuaranteeFirstRound){
            triggered=true;
            reason="first_round_guarantee";
        }else if(random()<Number(state.config.roundChance||0.35)){
            triggered=true;
            reason="triggered";
        }

        const result={
            ok:true,
            triggered,
            mode:normalizedMode,
            ordinal:Number(ordinal)||0,
            assigned:[],
            key,
            reason,
            globalPick:Number(state.globalNormalPicksCompleted||0)
        };
        if(triggered){
            result.assigned=assignRoundBounties(cards,normalizedMode,context);
            result.triggered=result.assigned.length>0;
            if(result.triggered){
                state.lastRoundGlobalPick=Number(state.globalNormalPicksCompleted||0);
                if(normalizedMode==="galactic_current") state.galacticRoundsTriggered++;
                else state.classicRoundsTriggered++;
                log("round_started",{
                    source:"round",
                    packNumber:context.packNumber,
                    pickIndex:context.pickIndex,
                    data:{
                        mode:normalizedMode,
                        ordinal:Number(ordinal)||0,
                        count:result.assigned.length,
                        bountyIds:result.assigned.map(entry=>entry.id),
                        globalPick:state.globalNormalPicksCompleted,
                        cooldown,
                        max
                    }
                });
            }else{
                result.reason="no_eligible_cards";
            }
        }
        state.roundDecisions[key]=safeClone(result);
        return safeClone(result);
    }

    function onClassicPackOpened(context={}){
        const tableKey=`classic:${context.packNumber||0}`;
        closedPresentationTables.delete(tableKey);
        ensureTableState(tableKey,context.cards||[],{initialCardCount:(context.cards||[]).length});
        return maybeStartBountyRound(
            "classic",
            context.packNumber||0,
            context.cards||[],
            {mode:"classic",packNumber:context.packNumber,pickIndex:0}
        );
    }

    function onGalacticOrbitStarted(context={}){
        closedPresentationTables.delete("galactic_current");
        ensureTableState("galactic_current",context.cards||[],{initialCardCount:(context.cards||[]).length});
        return maybeStartBountyRound(
            "galactic_current",
            context.round||0,
            context.cards||[],
            {mode:"galactic_current",packNumber:context.round,pickIndex:context.pickIndex||0}
        );
    }

    function agingThreshold(){
        const players=Math.max(1,state.players.length);
        if(players<=2) return 2;
        if(players<=6) return 3;
        if(players<=9) return 4;
        return 5;
    }

    function agingCapForTable(initialCardCount){
        const count=Math.max(0,Number(initialCardCount)||0);
        if(count<=11) return 1;
        if(count<=21) return 2;
        return 3;
    }

    function ensureTableState(tableKey,cards,context={}){
        state.tableState=state.tableState&&typeof state.tableState==="object"?state.tableState:{};
        if(!state.tableState[tableKey]){
            state.tableState[tableKey]={
                tick:0,
                initialCardCount:Math.max(0,Number(context.initialCardCount)||Number(cards?.length)||0),
                agingAssigned:0,
                eligibleAgingChecks:0,
                lastAgingAssignedTick:null
            };
        }else if(!Number(state.tableState[tableKey].initialCardCount)){
            state.tableState[tableKey].initialCardCount=Math.max(0,Number(context.initialCardCount)||Number(cards?.length)||0);
        }
        return state.tableState[tableKey];
    }

    function weightedOldCard(candidates,mode){
        const source=Array.isArray(candidates)?candidates:[];
        if(!source.length) return null;
        const groups=new Map();
        source.forEach(card=>{
            const age=Math.max(0,getCardAge(card,mode));
            if(!groups.has(age)) groups.set(age,[]);
            groups.get(age).push(card);
        });
        const pool=[];
        [...groups.keys()].sort((a,b)=>b-a).forEach(age=>{
            if(pool.length>=3) return;
            const group=shuffle(groups.get(age));
            for(const card of group){
                pool.push(card);
                if(pool.length>=3) break;
            }
        });
        const weights=pool.map(card=>Math.max(1,getCardAge(card,mode)));
        const total=weights.reduce((sum,value)=>sum+value,0);
        let roll=random()*total;
        for(let index=0;index<pool.length;index++){
            roll-=weights[index];
            if(roll<0) return pool[index];
        }
        return pool[pool.length-1]||null;
    }

    function escalateAgedBounties(cards,mode,context={}){
        const escalated=[];
        const every=Math.max(1,Number(state.config.agedEscalateEvery||2));
        const cap=Math.max(2,Number(state.config.agedMaxReward||4));
        (Array.isArray(cards)?cards:[]).forEach(card=>{
            const bounty=card?.instanceMeta?.bounty;
            if(!bounty||bounty.status!=="active"||bounty.source!=="aged"||bounty.reward?.kind!=="jeffcoins") return;
            bounty.survivedWithBounty=Math.max(0,Number(bounty.survivedWithBounty||0))+1;
            if(Number(bounty.reward.amount||0)>=cap||bounty.survivedWithBounty<every) return;
            bounty.survivedWithBounty=0;
            bounty.escalationCount=Math.max(0,Number(bounty.escalationCount||0))+1;
            bounty.reward.amount=Math.min(cap,Number(bounty.reward.amount||2)+1);
            bounty.reward.label=`+${bounty.reward.amount} JC`;
            state.telemetry.escalated=Number(state.telemetry.escalated||0)+1;
            const snapshot=safeClone(bounty);
            escalated.push(snapshot);
            log("increased",{
                bountyId:bounty.id,
                card,
                cardInstanceId:card.instanceId,
                cardName:card.name,
                source:"aged",
                reward:bounty.reward,
                packNumber:context.packNumber,
                pickIndex:context.pickIndex,
                data:{mode,amount:bounty.reward.amount,escalationCount:bounty.escalationCount}
            });
        });
        return escalated;
    }

    function closePresentationTable(tableKey){
        const key=String(tableKey||"");
        if(!key) return 0;
        closedPresentationTables.add(key);
        let removed=0;
        for(let index=bountyPresentationQueue.length-1;index>=0;index--){
            const item=bountyPresentationQueue[index];
            if(item?.requiresActiveTable&&String(item.tableKey||"")===key){
                bountyPresentationQueue.splice(index,1);
                removed++;
            }
        }
        if(typeof document!=="undefined"){
            document.querySelectorAll(`.bounty-aged-toast[data-bounty-table-key="${key.replace(/"/g,'\"')}"]`).forEach(node=>node.remove());
        }
        if(bountyPresentationCurrent?.requiresActiveTable&&String(bountyPresentationCurrent.tableKey||"")===key){
            bountyPresentationCurrent.cancelled=true;
        }
        return removed;
    }

    function onTableAdvanced(context={}){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        const mode=context.mode==="galactic_current"?"galactic_current":"classic";
        const cards=(Array.isArray(context.cards)?context.cards:[]).filter(Boolean);
        const tableKey=String(context.tableKey||`${mode}:${context.packNumber||0}`);
        const table=ensureTableState(tableKey,cards,context);

        // PATCH101K: hard pack-close guard BEFORE aging/tick mutation.
        // A closed table has no future pick opportunity, so it cannot age, escalate,
        // post a new aged bounty, or enqueue a late "NAGRODA ROŚNIE" presentation.
        const remainingPicks=Math.max(0,Number(context.remainingPicks??1));
        if(remainingPicks<=0){
            closePresentationTable(tableKey);
            return {ok:true,checked:true,assigned:null,reason:"no_remaining_picks",tick:table.tick,escalated:[]};
        }
        closedPresentationTables.delete(tableKey);

        if(mode==="classic"){
            cards.forEach(card=>{
                const meta=ensureMeta(card);
                meta.bountyAge=Math.max(0,Number(meta.bountyAge||0))+1;
            });
        }

        table.tick=Math.max(0,Number(table.tick||0))+1;
        state.tableTicks[tableKey]=table.tick;

        const escalated=escalateAgedBounties(cards,mode,context);
        if(escalated.length){
            decoratePack(cards);
            escalated.forEach((bounty,index)=>queueBountyPresentation(
                ()=>announceBountyIncrease(bounty,{tableKey}),
                {initialDelayMs:index*140,durationMs:3400,settleMs:300,tableKey,requiresActiveTable:true}
            ));
        }

        const threshold=agingThreshold();
        const cap=agingCapForTable(table.initialCardCount);
        if(Number(table.agingAssigned||0)>=cap){
            return {ok:true,checked:true,assigned:null,reason:"aging_table_cap",tick:table.tick,threshold,cap,escalated};
        }
        const lastTick=Number(table.lastAgingAssignedTick);
        const cooldown=Math.max(0,Number(state.config.agedCooldownPicks||2));
        if(table.lastAgingAssignedTick!==null&&Number.isFinite(lastTick)&&table.tick-lastTick<cooldown){
            return {ok:true,checked:true,assigned:null,reason:"aging_cooldown",tick:table.tick,threshold,cap,escalated};
        }

        const candidates=cards
            .filter(card=>isAssignmentEligible(card)&&getCardAge(card,mode)>=threshold)
            .sort((a,b)=>getCardAge(b,mode)-getCardAge(a,mode));
        if(!candidates.length){
            return {ok:true,checked:true,assigned:null,reason:"no_old_cards",tick:table.tick,threshold,cap,escalated};
        }
        const firstAgingPending=Number(table.agingAssigned||0)===0;
        if(firstAgingPending){
            table.eligibleAgingChecks=Math.max(0,Number(table.eligibleAgingChecks||0))+1;
        }
        const guaranteeChecks=Math.max(1,Number(state.config.agedFirstGuaranteeChecks||3));
        const guaranteedFirst=firstAgingPending && table.eligibleAgingChecks>=guaranteeChecks;
        if(!guaranteedFirst && random()>=Number(state.config.agedCheckChance||0.18)){
            return {
                ok:true,checked:true,assigned:null,reason:"roll_missed",tick:table.tick,threshold,cap,escalated,
                firstAgingPending,eligibleAgingChecks:Number(table.eligibleAgingChecks||0),guaranteeChecks
            };
        }

        const card=weightedOldCard(candidates,mode);
        const bounty=assignBounty(card,"aged",{
            mode,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            reward:{kind:"jeffcoins",amount:2,label:"+2 JC"}
        });
        if(bounty){
            table.agingAssigned=Math.max(0,Number(table.agingAssigned||0))+1;
            table.lastAgingAssignedTick=table.tick;
            state.agedBountiesAssigned++;
            log("aged_contract_posted",{
                bountyId:bounty.id,
                card,
                cardInstanceId:card.instanceId,
                cardName:card.name,
                source:"aged",
                reward:bounty.reward,
                packNumber:context.packNumber,
                pickIndex:context.pickIndex,
                data:{
                    mode,age:getCardAge(card,mode),tick:table.tick,threshold,cap,
                    guaranteedFirst:Boolean(guaranteedFirst),
                    eligibleAgingChecks:Number(table.eligibleAgingChecks||0)
                }
            });
        }
        decoratePack(cards);
        if(bounty){
            queueBountyPresentation(
                ()=>announceAgedBounty(bounty,{tableKey}),
                {durationMs:3650,settleMs:300,tableKey,requiresActiveTable:true}
            );
        }
        return {
            ok:true,checked:true,assigned:bounty||null,tick:table.tick,threshold,cap,escalated,
            guaranteedFirst:Boolean(bounty&&guaranteedFirst),
            eligibleAgingChecks:Number(table.eligibleAgingChecks||0)
        };
    }

    function clearBounty(card,status="expired"){
        if(!card?.instanceMeta?.bounty) return null;
        const bounty=safeClone(card.instanceMeta.bounty);
        card.instanceMeta.bounty={...card.instanceMeta.bounty,status};
        delete card.instanceMeta.bounty;
        return bounty;
    }

    function invalidateCard(card,reason="card_changed",context={}){
        if(!card||!hasBounty(card)) return {ok:true,removed:false};
        const bounty=clearBounty(card,"expired");
        state.telemetry.expired=Number(state.telemetry.expired||0)+1;
        log("expired",{
            bountyId:bounty?.id,
            card,
            cardInstanceId:card?.instanceId||null,
            cardName:card?.name||null,
            source:bounty?.source||null,
            reward:bounty?.reward||null,
            reason,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{cause:reason}
        });
        return {ok:true,removed:true,bounty};
    }

    function getPlayerPromoStatus(playerIndex){
        if(!isEnabled()) return null;
        const modifiers=global.EconomyEngine?.getActivePriceModifiers?.(Number(playerIndex))||[];
        const modifier=modifiers.find(entry=>String(entry.stackGroup||"")==="bounty_flash_sale");
        if(!modifier) return null;
        const wallet=global.EconomyEngine?.getWallet?.(Number(playerIndex))||null;
        const completed=Number(wallet?.normalPicksCompleted??wallet?.normalPickStarts??0)||0;
        const expires=Number(modifier.expiresAfterNormalPickCompleted);
        return {
            active:true,
            kind:"flash_sale",
            label:"FLASH SALE -50%",
            factor:Number(modifier.factor||0.5),
            expiresAfterNormalPickCompleted:Number.isFinite(expires)?expires:null,
            remainingPickWindow:Number.isFinite(expires)?Math.max(0,expires-completed):null,
            modifier:safeClone(modifier)
        };
    }

    function hasActiveBountyDiscount(playerIndex){
        return Boolean(getPlayerPromoStatus(playerIndex));
    }

    function elementIsVisible(node){
        if(!node||typeof node.getBoundingClientRect!=="function") return false;
        if(node.hidden) return false;
        const style=typeof global.getComputedStyle==="function"?global.getComputedStyle(node):null;
        if(style&&(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)) return false;
        const rect=node.getBoundingClientRect();
        return rect.width>0&&rect.height>0;
    }

    function higherPriorityPresentationBusy(){
        try{
            if(global.SuperpowerUI?.isBusy?.()) return true;
            if(global.JokerV2UI?.isBusy?.()) return true;
            if(global.GalacticCurrent?.getState?.()?.isResolving) return true;
        }catch(error){}
        if(typeof document==="undefined") return false;
        const bodyClasses=[...(document.body?.classList||[])];
        if(bodyClasses.some(name=>/^spx-/.test(name)&&/(resolving|animating|detonating|salvaging|planting|selecting|forging|breaking|active)/.test(name))) return true;
        const selectors=[
            '#spxRocketExplosion',
            '#spxCaptainRicochetLayer',
            '[id^="spx"][aria-modal="true"]',
            '[id^="spx"][role="dialog"]'
        ];
        return selectors.some(selector=>[...document.querySelectorAll(selector)].some(elementIsVisible));
    }

    function schedulePresentationPump(delay=90){
        clearTimeout(bountyPresentationTimer);
        bountyPresentationTimer=setTimeout(pumpBountyPresentationQueue,Math.max(20,Number(delay)||90));
    }

    function pumpBountyPresentationQueue(){
        if(bountyPresentationRunning||!bountyPresentationQueue.length) return;
        const item=bountyPresentationQueue[0];
        if(item?.requiresActiveTable&&closedPresentationTables.has(String(item.tableKey||""))){
            bountyPresentationQueue.shift();
            schedulePresentationPump(20);
            return;
        }
        const now=Date.now();
        if(now<item.notBefore||higherPriorityPresentationBusy()){
            item.quietSince=null;
            schedulePresentationPump(120);
            return;
        }
        if(item.quietSince===null){
            item.quietSince=now;
            schedulePresentationPump(120);
            return;
        }
        if(now-item.quietSince<item.settleMs){
            schedulePresentationPump(90);
            return;
        }
        bountyPresentationQueue.shift();
        bountyPresentationRunning=true;
        bountyPresentationCurrent=item;
        try{
            if(!(item.requiresActiveTable&&closedPresentationTables.has(String(item.tableKey||"")))) item.play?.();
        }catch(error){ console.warn("Bounty presentation skipped:",error); }
        setTimeout(()=>{
            bountyPresentationRunning=false;
            bountyPresentationCurrent=null;
            schedulePresentationPump(100);
        },Math.max(300,item.durationMs));
    }

    function queueBountyPresentation(play,options={}){
        if(typeof play!=="function") return false;
        if(typeof document==="undefined"){
            try{ play(); }catch(error){}
            return true;
        }
        const tableKey=String(options.tableKey||"");
        const requiresActiveTable=Boolean(options.requiresActiveTable&&tableKey);
        if(requiresActiveTable&&closedPresentationTables.has(tableKey)) return false;
        bountyPresentationQueue.push({
            play,
            tableKey,
            requiresActiveTable,
            notBefore:Date.now()+Math.max(0,Number(options.initialDelayMs??420)||0),
            quietSince:null,
            settleMs:Math.max(120,Number(options.settleMs??420)||420),
            durationMs:Math.max(300,Number(options.durationMs??3000)||3000)
        });
        schedulePresentationPump(80);
        return true;
    }

    function hasPendingPresentations(){
        return Boolean(bountyPresentationRunning||bountyPresentationQueue.length);
    }

    function waitForPresentationsIdle(options={}){
        const timeoutMs=Math.max(1000,Number(options.timeoutMs??30000)||30000);
        const pollMs=Math.max(40,Number(options.pollMs??80)||80);
        const startedAt=Date.now();
        return new Promise(resolve=>{
            const check=()=>{
                if(!hasPendingPresentations()){
                    resolve({ok:true,timeout:false,waitedMs:Date.now()-startedAt});
                    return;
                }
                if(Date.now()-startedAt>=timeoutMs){
                    resolve({ok:false,timeout:true,waitedMs:Date.now()-startedAt});
                    return;
                }
                setTimeout(check,pollMs);
            };
            check();
        });
    }

    function awardCoinFallback(playerIndex,amount,bounty,context={},reason="bounty_fallback"){
        const result=global.EconomyEngine?.credit?.(playerIndex,amount,{
            kind:"bonus",
            reason,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{bountyId:bounty.id,bountySource:bounty.source,cardInstanceId:bounty.cardInstanceId}
        });
        if(result?.ok){
            queueBountyPresentation(()=>global.EconomyEngine?.playJeffCoinAward?.(playerIndex,amount,{
                label:"NAGRODA ZEBRANA",
                source:"bounty"
            }),{durationMs:3300});
        }
        return result;
    }

    function claimCard(card,playerIndex,context={}){
        if(!isEnabled()||!card||!Number.isInteger(Number(playerIndex))) return {ok:false,claimed:false,reason:"disabled_or_invalid"};
        const bounty=getBounty(card);
        if(!bounty) return {ok:true,claimed:false,reason:"no_bounty"};
        const p=Number(playerIndex);
        let result=null;
        let grantedReward=safeClone(bounty.reward);
        const stat=ensurePlayerStat(p);

        if(bounty.reward?.kind==="flash_sale"){
            const wallet=global.EconomyEngine?.getWallet?.(p)||null;
            const completed=Number(wallet?.normalPicksCompleted??wallet?.normalPickStarts??0)||0;
            const cap=Number(global.EconomyEngine?.getConfig?.()?.passivePickCap||12);
            if(completed>=cap){
                const amount=Number(state.config.flashSaleFallbackNoFuturePick||3);
                result=awardCoinFallback(p,amount,bounty,context,"bounty_flash_sale_no_future_pick");
                grantedReward={kind:"jeffcoins",amount,label:`+${amount} JC`,convertedFrom:"flash_sale",conversionReason:"no_future_pick"};
            }else if(hasActiveBountyDiscount(p)){
                const amount=Number(state.config.flashSaleFallbackDuplicate||2);
                result=awardCoinFallback(p,amount,bounty,context,"bounty_flash_sale_duplicate");
                grantedReward={kind:"jeffcoins",amount,label:`+${amount} JC`,convertedFrom:"flash_sale",conversionReason:"duplicate_discount"};
            }else{
                result=global.EconomyEngine?.grantPriceModifier?.(p,{
                    source:"bounty",
                    stackGroup:"bounty_flash_sale",
                    type:"percentage",
                    factor:Number(bounty.reward.factor||state.config.flashSaleFactor||0.5),
                    minPrice:1,
                    oneShot:true,
                    expiresAfterNormalPickCompleted:completed+1,
                    label:"BOUNTY FLASH SALE • -50%",
                    metadata:{bountyId:bounty.id,cardInstanceId:bounty.cardInstanceId}
                });
                if(result?.ok){
                    queueBountyPresentation(()=>showDiscountAward(p,bounty),{durationMs:4200});
                }
            }
        }else{
            const amount=Math.max(1,Number(bounty.reward?.amount||2));
            result=global.EconomyEngine?.credit?.(p,amount,{
                kind:"bonus",
                reason:"bounty_claim",
                packNumber:context.packNumber,
                pickIndex:context.pickIndex,
                data:{bountyId:bounty.id,bountySource:bounty.source,cardInstanceId:bounty.cardInstanceId}
            });
            if(result?.ok){
                queueBountyPresentation(()=>global.EconomyEngine?.playJeffCoinAward?.(p,amount,{
                    label:"NAGRODA ZEBRANA",
                    source:"bounty"
                }),{durationMs:3300});
            }
        }

        if(!result?.ok) return {ok:false,claimed:false,reason:result?.reason||"Nie udało się wypłacić Bounty."};
        if(stat){
            stat.bountiesClaimed=Number(stat.bountiesClaimed||0)+1;
            if(grantedReward?.kind==="jeffcoins"){
                stat.coinBountiesClaimed=Number(stat.coinBountiesClaimed||0)+1;
                stat.jeffCoinsEarned=Number(stat.jeffCoinsEarned||0)+Math.max(0,Number(grantedReward.amount||0));
                if(grantedReward.convertedFrom==="flash_sale") stat.flashSalesConverted=Number(stat.flashSalesConverted||0)+1;
            }else if(grantedReward?.kind==="flash_sale"){
                stat.discountBountiesClaimed=Number(stat.discountBountiesClaimed||0)+1;
                stat.flashSalesGranted=Number(stat.flashSalesGranted||0)+1;
            }
        }
        clearBounty(card,"claimed");
        state.telemetry.claimed=Number(state.telemetry.claimed||0)+1;
        if(grantedReward?.kind==="jeffcoins"){
            state.telemetry.jeffCoinsAwarded=Number(state.telemetry.jeffCoinsAwarded||0)+Math.max(0,Number(grantedReward.amount||0));
        }else if(grantedReward?.kind==="flash_sale"){
            state.telemetry.flashSaleGranted=Number(state.telemetry.flashSaleGranted||0)+1;
        }
        log("claimed",{
            bountyId:bounty.id,
            playerIndex:p,
            card,
            cardInstanceId:bounty.cardInstanceId,
            cardName:bounty.cardName,
            source:bounty.source,
            reward:grantedReward,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{originalReward:safeClone(bounty.reward),resolvedCardInstanceId:context.resultCard?.instanceId||null}
        });
        return {ok:true,claimed:true,bounty,reward:grantedReward,result};
    }

    function onNormalPickCompleted(context={}){
        state.globalNormalPicksCompleted=Math.max(0,Number(state.globalNormalPicksCompleted||0))+1;
        return claimCard(context.sourceCard||context.card,Number(context.playerIndex),context);
    }

    function rewardLabel(bounty){
        if(!bounty?.reward) return "NAGRODA";
        if(bounty.reward.kind==="flash_sale") return "-50%";
        return `+${Number(bounty.reward.amount||0)} JC`;
    }

    function escapeHtml(value){
        return String(value ?? "").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
    }

    function fitTextToBox(element,options={}){
        if(!element||typeof global.getComputedStyle!=="function") return false;
        const max=Math.max(8,Number(options.max||44));
        const min=Math.max(6,Math.min(max,Number(options.min||12)));
        const step=Math.max(.5,Number(options.step||1));
        element.style.setProperty("font-size",`${max}px`,"important");
        let size=max;
        let guard=0;
        while(size>min && guard<80){
            const overflowX=element.scrollWidth>element.clientWidth+1;
            const overflowY=element.scrollHeight>element.clientHeight+1;
            if(!overflowX&&!overflowY) break;
            size=Math.max(min,size-step);
            element.style.setProperty("font-size",`${size}px`,"important");
            guard++;
        }
        element.classList.toggle("bounty-text-compressed",size<=min+.01);
        return true;
    }

    function fitAnnouncementText(root){
        if(!root||typeof document==="undefined") return;
        requestAnimationFrame(()=>{
            root.querySelectorAll?.("[data-bounty-fit]").forEach(node=>{
                const max=Number(node.dataset.bountyFitMax||44);
                const min=Number(node.dataset.bountyFitMin||12);
                fitTextToBox(node,{max,min,step:.75});
            });
        });
    }

    function dismissAnnouncement(node,{hold=2600,fade=420}={}){
        if(!node) return;
        setTimeout(()=>node.classList.add("is-leaving"),Math.max(0,hold));
        setTimeout(()=>node.remove(),Math.max(0,hold)+Math.max(120,fade));
    }

    function decorateCardButton(button,card){
        if(!button||!card) return button;
        if(card.instanceId) button.dataset.cardInstanceId=String(card.instanceId);
        button.querySelectorAll?.(".bounty-card-marker")?.forEach?.(node=>node.remove());
        const bounty=getBounty(card);
        button.classList?.toggle?.("has-bounty",Boolean(bounty));
        if(!bounty) return button;
        const marker=document.createElement("span");
        marker.className=`bounty-card-marker bounty-${bounty.reward?.kind==="flash_sale"?"discount":"coins"}`;
        marker.dataset.bountyId=bounty.id;
        marker.title=bounty.source==="aged"?"NAGRODA ZA UCIEKINIERA: ta karta zbyt długo wymykała się pickom.":"POLOWANIE NA NAGRODY: nagroda za normalne wybranie tej karty.";
        marker.innerHTML=bounty.reward?.kind==="flash_sale"
            ? `<b>FLASH</b><strong>-50%</strong>`
            : `<img src="draft-assets/jeffcoin.png" alt=""><strong>+${Number(bounty.reward?.amount||0)}</strong>`;
        button.appendChild(marker);
        return button;
    }

    function decoratePack(cards){
        if(typeof document==="undefined") return;
        const lookup=new Map((Array.isArray(cards)?cards:[]).filter(Boolean).map(card=>[String(card.instanceId||""),card]));
        document.querySelectorAll("#pack [data-card-instance-id]").forEach(button=>{
            const card=lookup.get(String(button.dataset.cardInstanceId||""));
            if(card) decorateCardButton(button,card);
        });
    }

    function pulseBountyCard(instanceId,className="bounty-marker-reveal"){
        if(typeof document==="undefined"||!instanceId) return false;
        const id=String(instanceId);
        const nodes=[...document.querySelectorAll("[data-card-instance-id]")];
        const node=nodes.find(entry=>String(entry.dataset?.cardInstanceId||"")===id)||null;
        if(!node) return false;
        node.classList.remove(className);
        void node.offsetWidth;
        node.classList.add(className);
        const duration=className.includes("aged")?2700:1900;
        setTimeout(()=>node.classList.remove(className),duration);
        return true;
    }

    function revealAssignedMarkers(result){
        if(!result?.assigned?.length||typeof document==="undefined") return false;
        result.assigned.forEach((entry,index)=>{
            setTimeout(()=>pulseBountyCard(entry.cardInstanceId,"bounty-marker-reveal"),760+index*190);
        });
        return true;
    }

    function announceAgedBounty(bounty,options={}){
        if(!bounty||typeof document==="undefined") return false;
        const tableKey=String(options.tableKey||"");
        if(tableKey&&closedPresentationTables.has(tableKey)) return false;
        document.querySelectorAll(".bounty-aged-toast").forEach(node=>node.remove());
        const toast=document.createElement("div");
        toast.className="bounty-aged-toast";
        if(tableKey) toast.dataset.bountyTableKey=tableKey;
        const reward=rewardLabel(bounty);
        toast.innerHTML=`
            <span class="bounty-aged-kicker">NAGRODA ZA UCIEKINIERA</span>
            <strong class="bounty-aged-name" data-bounty-fit data-bounty-fit-max="58" data-bounty-fit-min="26">${escapeHtml(bounty.cardName||"KARTA")}</strong>
            <small class="bounty-aged-reward">${escapeHtml(reward)}</small>`;
        document.body.appendChild(toast);
        fitAnnouncementText(toast);
        requestAnimationFrame(()=>toast.classList.add("is-visible"));
        setTimeout(()=>pulseBountyCard(bounty.cardInstanceId,"bounty-aged-reveal"),360);
        dismissAnnouncement(toast,{hold:3000,fade:520});
        return true;
    }

    function announceBountyIncrease(bounty,options={}){
        if(!bounty||typeof document==="undefined") return false;
        const tableKey=String(options.tableKey||"");
        if(tableKey&&closedPresentationTables.has(tableKey)) return false;
        document.querySelectorAll(".bounty-increase-toast").forEach(node=>node.remove());
        const toast=document.createElement("div");
        toast.className="bounty-aged-toast bounty-increase-toast";
        if(tableKey) toast.dataset.bountyTableKey=tableKey;
        toast.innerHTML=`
            <span class="bounty-aged-kicker">NAGRODA ROŚNIE</span>
            <strong class="bounty-aged-name" data-bounty-fit data-bounty-fit-max="58" data-bounty-fit-min="26">${escapeHtml(bounty.cardName||"KARTA")}</strong>
            <small class="bounty-aged-reward">+${Number(bounty.reward?.amount||0)} JC</small>`;
        document.body.appendChild(toast);
        fitAnnouncementText(toast);
        requestAnimationFrame(()=>toast.classList.add("is-visible"));
        setTimeout(()=>pulseBountyCard(bounty.cardInstanceId,"bounty-aged-reveal"),300);
        dismissAnnouncement(toast,{hold:2750,fade:500});
        return true;
    }

    function decorateWalletNode(node,playerIndex){
        if(!node||typeof document==="undefined") return node;
        node.querySelectorAll?.(".bounty-wallet-promo")?.forEach?.(child=>child.remove());
        const promo=getPlayerPromoStatus(playerIndex);
        node.classList?.toggle?.("has-bounty-promo",Boolean(promo));
        if(!promo) return node;
        const chip=document.createElement("span");
        chip.className="bounty-wallet-promo";
        chip.title="Bounty Flash Sale: następny kwalifikujący się zakup -50%";
        chip.innerHTML=`<b>FLASH</b><strong>-50%</strong>`;
        node.appendChild(chip);
        return node;
    }

    function refreshWalletDecorations(playerIndex=null){
        if(typeof document==="undefined") return;
        const nodes=[...document.querySelectorAll("[data-economy-wallet-player]")];
        nodes.forEach(node=>{
            const p=Number(node.dataset.economyWalletPlayer);
            if(Number.isInteger(Number(playerIndex))&&p!==Number(playerIndex)) return;
            decorateWalletNode(node,p);
        });
    }

    function ensureRoundOverlay(){
        if(typeof document==="undefined") return null;
        let overlay=document.getElementById("bountyRoundOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="bountyRoundOverlay";
        overlay.className="bounty-round-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`
            <div class="bounty-round-card" role="status" aria-live="polite">
                <div class="bounty-wanted-stamp">WANTED</div>
                <div class="bounty-round-kicker">ŁOWCY NAGRÓD</div>
                <strong class="bounty-round-title">
                    <span data-bounty-fit data-bounty-fit-max="40" data-bounty-fit-min="27">POLOWANIE NA</span>
                    <span data-bounty-fit data-bounty-fit-max="44" data-bounty-fit-min="29">NAGRODY!</span>
                </strong>
                <p class="bounty-round-copy">Ta paczka to runda polowania. Na niektóre karty wystawiono nagrody — złap je normalnym pickiem.</p>
                <small class="bounty-round-count" data-bounty-round-count></small>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function announceRound(result){
        if(!result?.triggered||!result.assigned?.length||typeof document==="undefined") return false;
        const overlay=ensureRoundOverlay();
        if(!overlay) return false;
        const count=overlay.querySelector("[data-bounty-round-count]");
        if(count) count.textContent=`${result.assigned.length} ${result.assigned.length===1?"KARTA DOSTAŁA NAGRODĘ":"KARTY DOSTAŁY NAGRODY"}`;
        overlay.hidden=false;
        overlay.classList.remove("is-showing","is-leaving");
        fitAnnouncementText(overlay);
        void overlay.offsetWidth;
        overlay.classList.add("is-showing");
        setTimeout(()=>revealAssignedMarkers(result),1220);
        setTimeout(()=>overlay.classList.add("is-leaving"),4700);
        setTimeout(()=>{
            overlay.classList.remove("is-showing","is-leaving");
            overlay.hidden=true;
        },5350);
        return true;
    }

    function showDiscountAward(playerIndex,bounty){
        if(typeof document==="undefined") return;
        const root=document.createElement("div");
        root.className="bounty-discount-award";
        root.innerHTML=`
            <div class="bounty-discount-ticket">
                <span>NAGRODA ZEBRANA</span>
                <strong>FLASH SALE -50%</strong>
                <small>NASTĘPNY KWALIFIKUJĄCY SIĘ ZAKUP</small>
            </div>`;
        document.body.appendChild(root);
        requestAnimationFrame(()=>root.classList.add("is-visible"));
        setTimeout(()=>root.classList.add("is-leaving"),3350);
        setTimeout(()=>root.remove(),4000);
    }

    function getReferenceRules(){
        return safeClone(REFERENCE_RULES);
    }

    function exportState(){
        return safeClone(state);
    }

    function restoreState(payload){
        if(!payload||typeof payload!=="object") return false;
        const restored=safeClone(payload);
        state={
            ...createEmptyState(),
            ...restored,
            config:{...DEFAULT_CONFIG,...(restored.config||{})},
            players:Array.isArray(restored.players)?restored.players:[],
            playerStats:Array.isArray(restored.playerStats)?restored.playerStats:[],
            eventLog:Array.isArray(restored.eventLog)?restored.eventLog:[],
            roundDecisions:restored.roundDecisions&&typeof restored.roundDecisions==="object"?restored.roundDecisions:{},
            tableTicks:restored.tableTicks&&typeof restored.tableTicks==="object"?restored.tableTicks:{},
            tableState:restored.tableState&&typeof restored.tableState==="object"?restored.tableState:{},
            telemetry:{...createEmptyState().telemetry,...(restored.telemetry||{})}
        };
        runtimeRng=Math.random;
        refreshLobbyDependency();
        return true;
    }

    function getExportData(){
        return {
            version:VERSION,
            enabled:Boolean(state.enabled),
            name:DISPLAY_NAME,
            classicBountyRounds:Number(state.classicRoundsTriggered||0),
            galacticBountyRounds:Number(state.galacticRoundsTriggered||0),
            agedBountiesAssigned:Number(state.agedBountiesAssigned||0),
            globalNormalPicksCompleted:Number(state.globalNormalPicksCompleted||0),
            telemetry:safeClone(state.telemetry||{}),
            players:safeClone(state.playerStats||[]),
            events:safeClone(state.eventLog)
        };
    }

    function refreshLobbyDependency(){
        if(typeof document==="undefined") return;
        const economy=document.getElementById("enableEconomy");
        const bounty=document.getElementById("enableBounties");
        const poker=document.getElementById("enablePokerDraft");
        if(!bounty) return;
        const option=bounty.closest?.(".modeOption");
        const blocked=Boolean(poker?.checked||!economy?.checked);
        bounty.disabled=blocked;
        if(poker?.checked&&bounty.checked) bounty.checked=false;
        option?.classList.toggle("bounties-requires-economy",blocked);
        option?.classList.toggle("bounties-active",Boolean(bounty.checked&&!blocked));
    }

    function bindLobbyCompatibility(){
        if(typeof document==="undefined") return;
        const economy=document.getElementById("enableEconomy");
        const bounty=document.getElementById("enableBounties");
        const poker=document.getElementById("enablePokerDraft");
        if(!bounty) return;
        bounty.addEventListener("click",()=>{
            if(bounty.checked&&economy&&!economy.checked&&!poker?.checked){
                economy.checked=true;
                economy.dispatchEvent(new Event("change",{bubbles:true}));
            }
            refreshLobbyDependency();
        });
        bounty.addEventListener("change",refreshLobbyDependency);
        economy?.addEventListener("change",()=>{
            if(!economy.checked&&bounty.checked) bounty.checked=false;
            refreshLobbyDependency();
        });
        poker?.addEventListener("change",refreshLobbyDependency);
        refreshLobbyDependency();
    }

    let economyEventsBound=false;
    function bindEconomyEvents(){
        if(economyEventsBound||typeof global.addEventListener!=="function") return;
        economyEventsBound=true;
        global.addEventListener("snapdraft:economy-change",event=>{
            const detail=event?.detail||{};
            const playerIndex=Number(detail.playerIndex);
            const p=Number.isInteger(playerIndex)?playerIndex:null;
            if(detail.type==="purchase"&&Array.isArray(detail.priceModifiers)){
                const used=detail.priceModifiers.filter(mod=>String(mod?.stackGroup||"")==="bounty_flash_sale");
                if(used.length){
                    state.telemetry.flashSaleUsed=Number(state.telemetry.flashSaleUsed||0)+used.length;
                    const stat=p!==null?ensurePlayerStat(p):null;
                    if(stat) stat.flashSalesUsed=Number(stat.flashSalesUsed||0)+used.length;
                    log("flash_sale_used",{playerIndex:p,source:"bounty",data:{productId:detail.productId||null,price:detail.price,basePrice:detail.basePrice,count:used.length}});
                }
            }
            if(detail.type==="price_modifier_expired"&&Array.isArray(detail.expired)){
                const expired=detail.expired.filter(mod=>String(mod?.stackGroup||"")==="bounty_flash_sale");
                if(expired.length){
                    state.telemetry.flashSaleExpired=Number(state.telemetry.flashSaleExpired||0)+expired.length;
                    const stat=p!==null?ensurePlayerStat(p):null;
                    if(stat) stat.flashSalesExpired=Number(stat.flashSalesExpired||0)+expired.length;
                    log("flash_sale_expired",{playerIndex:p,source:"bounty",data:{count:expired.length}});
                }
            }
            refreshWalletDecorations(p);
        });
    }

    global.BountyEngine=Object.freeze({
        VERSION,
        EXTENSION_ID,
        DISPLAY_NAME,
        beginDraft,
        reset,
        isEnabled,
        getBounty,
        hasBounty,
        getPlayerSummary,
        getPlayerPromoStatus,
        assignBounty,
        invalidateCard,
        onClassicPackOpened,
        onGalacticOrbitStarted,
        onTableAdvanced,
        onNormalPickCompleted,
        decorateCardButton,
        decoratePack,
        decorateWalletNode,
        refreshWalletDecorations,
        announceRound,
        announceAgedBounty,
        announceBountyIncrease,
        queueBountyPresentation,
        hasPendingPresentations,
        waitForPresentationsIdle,
        getReferenceRules,
        exportState,
        restoreState,
        getExportData,
        refreshLobbyDependency
    });

    bindEconomyEvents();
    if(typeof document!=="undefined"){
        const boot=()=>{
            bindLobbyCompatibility();
            refreshWalletDecorations();
        };
        if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
        else boot();
    }
})(window);
