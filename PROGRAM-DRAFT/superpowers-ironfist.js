/**
 * MSP SnapDraft — Iron Fist / Wyzwanie K’un-Lun
 * PATCH 40.2: atomic tournament, fair ties and post-arena reward chain.
 */

const IronFistTournamentEngine=(()=>{
    const POWER_ID="iron_fist";
    const ZONE="tournamentEscrow";
    const MIN_DECK_SIZE=5;
    const OPPONENT_STAKE_OPTIONS=2;
    const CHI_BONUS=1;
    const EMBLEM="draft-assets/ironfist_shoulao_emblem_v2.png";
    const FALLBACK_PLAYER_COLORS=["#41dfff","#ff4f86","#ffd24a","#9d70ff","#65f095","#ff914d"];
    let session=null;
    let sequence=0;

    const normalize=value=>String(value||"").trim().toLowerCase();
    const randomItem=list=>list[Math.floor(Math.random()*list.length)];
    const clampIndex=(value,length)=>Math.max(0,Math.min(length,Number(value)||0));

    function shuffled(list){
        const copy=[...(Array.isArray(list)?list:[])];
        for(let index=copy.length-1;index>0;index--){
            const other=Math.floor(Math.random()*(index+1));
            [copy[index],copy[other]]=[copy[other],copy[index]];
        }
        return copy;
    }

    function assignmentFor(playerIndex){
        return typeof getSuperpowerRuntimeAssignment==="function"
            ? getSuperpowerRuntimeAssignment(players?.[playerIndex])
            : null;
    }

    function isCaptainPlayer(playerIndex){
        return assignmentFor(playerIndex)?.powerId==="captain_america";
    }

    function isProtected(playerIndex,cardIndex){
        const card=decks?.[playerIndex]?.[cardIndex];
        const captainProtected=typeof isCaptainAmericaProtectedCard==="function" &&
            isCaptainAmericaProtectedCard(playerIndex,cardIndex);
        const wolverineProtected=typeof isWolverineRegeneratedProtectedCard==="function" &&
            isWolverineRegeneratedProtectedCard(card);
        return Boolean(captainProtected||wolverineProtected);
    }

    function playerColorFor(playerIndex){
        if(typeof playerColors!=="undefined" && Array.isArray(playerColors) && playerColors.length){
            return playerColors[playerIndex%playerColors.length];
        }
        return assignmentFor(playerIndex)?.color||FALLBACK_PLAYER_COLORS[playerIndex%FALLBACK_PLAYER_COLORS.length];
    }

    function getStakeEntries(playerIndex){
        const deckEntries=(decks?.[playerIndex]||[])
            .map((card,cardIndex)=>({card,cardIndex,sourceZone:"deck",runtimeEntryId:null}))
            .filter(entry=>entry.card && !isProtected(playerIndex,entry.cardIndex));
        const bellyEntries=(window.DevilDinoUI?.getKunLunStakeOptions?.(playerIndex)||[])
            .map(option=>({
                card:option?.card,
                cardIndex:-1,
                sourceZone:"devilDinoBelly",
                runtimeEntryId:option?.entry?.runtimeEntryId||null
            }))
            .filter(entry=>entry.card&&entry.runtimeEntryId);
        return [...deckEntries,...bellyEntries];
    }

    function qualifyParticipant(playerIndex,{host=false}={}){
        const deck=decks?.[playerIndex]||[];
        const stakeEntries=getStakeEntries(playerIndex);
        const requiredStakeCount=host?1:OPPONENT_STAKE_OPTIONS;
        return {
            ok:deck.length>=MIN_DECK_SIZE && stakeEntries.length>=requiredStakeCount,
            playerIndex,
            playerName:players?.[playerIndex]||"",
            deckSize:deck.length,
            legalStakeCount:stakeEntries.length,
            protectedStakeCount:deck.length-stakeEntries.length,
            requiredStakeCount,
            stakeEntries,
            isCaptain:isCaptainPlayer(playerIndex)
        };
    }

    function requiredOpponentCount(){
        return (players||[]).length===2?1:2;
    }

    function getOpponentPool(ownerIndex){
        return (players||[])
            .map((playerName,playerIndex)=>({playerName,playerIndex,...qualifyParticipant(playerIndex)}))
            .filter(entry=>entry.playerIndex!==ownerIndex && entry.ok);
    }

    function chooseOpponents(ownerIndex){
        return shuffled(getOpponentPool(ownerIndex)).slice(0,requiredOpponentCount());
    }

    function livePack(){
        return window.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()
            ? (window.GalacticCurrentSuperpowerBridge.getLiveCards?.()||[])
            : (currentPack||[]);
    }

    function isPrizeCardLegal(card){
        if(!card || !livePack().includes(card)) return false;
        if(typeof getSpiderManReservationForCard==="function" && getSpiderManReservationForCard(card)) return false;
        return true;
    }

    function preflight(playerName){
        const name=String(playerName||"");
        const playerIndex=(players||[]).indexOf(name);
        const assignment=playerIndex>=0?assignmentFor(playerIndex):null;
        if(draftFinished) return {ok:false,reason:"Draft jest już zakończony."};
        if(playerIndex<0 || assignment?.powerId!==POWER_ID){
            return {ok:false,reason:"Ten gracz nie posiada Wyzwania K’un-Lun."};
        }
        if(assignment.used) return {ok:false,reason:"Iron Fist wykorzystał już Wyzwanie K’un-Lun."};
        if(!packIsOpen || packOpeningInProgress || packEnding){
            return {ok:false,reason:"Brama K’un-Lun otwiera się tylko przy aktywnej, odsłoniętej paczce."};
        }
        if(window.JokerV2UI?.isBusy?.()) return {ok:false,reason:"Najpierw rozstrzygnij aktywnego Jokera."};
        if(window.DraftFoundation?.hasOpenTransaction?.()){
            return {ok:false,reason:"Inna niepodzielna sekwencja draftu jest już aktywna."};
        }
        const economy=window.DraftFoundation?.canConsumePackSurplus?.(1);
        if(!economy?.ok){
            return {ok:false,reason:economy?.reason||"Paczka nie ma wolnej karty na Smoczą Nagrodę."};
        }
        const ownerQualification=qualifyParticipant(playerIndex,{host:true});
        if(!ownerQualification.ok){
            return {ok:false,reason:`Iron Fist potrzebuje co najmniej ${MIN_DECK_SIZE} kart w decku i jednej niezabezpieczonej karty na zakład.`};
        }
        const opponents=getOpponentPool(playerIndex);
        const needed=requiredOpponentCount();
        if(opponents.length<needed){
            const lobby=(players||[]).length===2?"jedynego rywala":"dwóch rywali";
            return {ok:false,reason:`K’un-Lun nie znalazło ${lobby} z co najmniej pięcioma kartami i dwiema dostępnymi kartami do zakładu.`};
        }
        const prizeCards=livePack().filter(isPrizeCardLegal);
        if(!prizeCards.length){
            return {ok:false,reason:"W paczce nie ma dostępnej karty, którą Shou-Lao może wykraść jako Smoczą Nagrodę."};
        }
        return {ok:true,playerName:name,playerIndex,prizeCards,opponentPool:opponents,economy,ownerQualification,opponentCount:needed};
    }

    function markOwnerStatus(ownerName,status,used=false){
        const stored=window.draftSuperpowers?.[ownerName];
        if(!stored) return;
        stored.status=status;
        stored.used=Boolean(used);
    }

    function failAndRollback(message,error){
        const active=session;
        if(active?.transactionId){
            window.DraftFoundation?.rollbackTransaction?.(active.transactionId,{powerId:POWER_ID,reason:message});
        }
        if(active?.ownerName) markOwnerStatus(active.ownerName,"unused",false);
        session=null;
        if(error) console.error("Iron Fist tournament rollback:",error);
        if(typeof showDecks==="function") showDecks();
        if(typeof showPack==="function") showPack(false);
        if(typeof updateRoundQueueDisplay==="function") updateRoundQueueDisplay();
        return {ok:false,reason:message,rolledBack:true};
    }

    function participantRecord(playerIndex,seatIndex,ownerIndex){
        const isHost=playerIndex===ownerIndex;
        const qualification=qualifyParticipant(playerIndex,{host:isHost});
        const assignment=assignmentFor(playerIndex)||{};
        const entries=isHost?qualification.stakeEntries:shuffled(qualification.stakeEntries).slice(0,OPPONENT_STAKE_OPTIONS);
        if(entries.length<(isHost?1:OPPONENT_STAKE_OPTIONS)){
            throw new Error(`${players[playerIndex]} nie ma wymaganej liczby dostępnych zakładów.`);
        }
        return {
            seatIndex,
            playerIndex,
            playerName:players[playerIndex],
            playerColor:playerColorFor(playerIndex),
            powerId:assignment.powerId||"",
            powerName:assignment.powerName||assignment.power||"",
            powerIcon:assignment.icon||"",
            powerEmoji:assignment.emoji||"⚡",
            isHost,
            hasIronFistPower:assignment.powerId===POWER_ID,
            isCaptain:qualification.isCaptain,
            protectedStakeCount:qualification.protectedStakeCount,
            stakeOptions:entries.map(entry=>entry.card),
            dinoBellyStakeIds:entries.filter(entry=>entry.sourceZone==="devilDinoBelly").map(entry=>String(entry.card?.instanceId||"")),
            chosenStakeInstanceId:"",
            stakeCard:null,
            stakeEntryId:null,
            stakeOriginalIndex:-1,
            stakeFromDinoBelly:false,
            dinoOriginalRuntimeEntryId:null,
            championOrder:[],
            score:0
        };
    }

    function prepareChallenge(request={}){
        if(session) return {ok:false,reason:"Wyzwanie K’un-Lun jest już aktywne."};
        const check=preflight(request.playerName);
        if(!check.ok) return check;
        const prizeCard=request.prizeCard;
        if(!check.prizeCards.includes(prizeCard)){
            return {ok:false,reason:"Ta karta nie może zostać Smoczą Nagrodą."};
        }

        const transaction=window.DraftFoundation?.beginTransaction?.("iron_fist_kun_lun_challenge",{
            powerId:POWER_ID,
            ownerName:check.playerName,
            ownerIndex:check.playerIndex,
            prizeCardInstanceId:prizeCard?.instanceId||null,
            resumePickIndex:currentPickIndex
        });
        if(!transaction?.ok) return {ok:false,reason:transaction?.reason||"Nie udało się zamknąć areny."};

        session={
            sessionId:`kun-lun-${++sequence}`,
            transactionId:transaction.transactionId,
            phase:"stakes",
            ownerName:check.playerName,
            ownerIndex:check.playerIndex,
            resumePickIndex:currentPickIndex,
            prizeCard:null,
            prizeEntryId:null,
            prizeOriginalIndex:-1,
            participants:[],
            rounds:[],
            winnerIndex:null,
            resolvedPrizeCard:null,
            winnerSwapInstanceId:null,
            consolationOptions:[],
            consolationName:"",
            primaryOutcome:null,
            captureDecisionMade:false,
            capturedStakeInstanceId:"",
            result:null,
            createdAt:Date.now()
        };

        try{
            const opponents=chooseOpponents(check.playerIndex);
            if(opponents.length!==check.opponentCount) throw new Error("K’un-Lun utraciło wymaganych przeciwników.");
            const consumed=window.DraftFoundation?.consumeCurrentPackSurplusCard?.({
                card:prizeCard,
                ownerIndex:check.playerIndex,
                sourcePowerId:POWER_ID,
                sourceEvent:"iron_fist_dragon_prize_stolen",
                zoneName:ZONE,
                metadata:{sessionId:session.sessionId,role:"dragon_prize",sealedJoker:Boolean(prizeCard?.joker)}
            });
            if(!consumed?.ok) throw new Error(consumed?.reason||"Nie udało się wykraść Smoczej Nagrody z paczki.");

            session.prizeCard=consumed.card;
            session.prizeEntryId=consumed.entry?.runtimeEntryId||null;
            session.prizeOriginalIndex=consumed.index;
            const participantIndices=[check.playerIndex,...opponents.map(entry=>entry.playerIndex)];
            session.participants=participantIndices.map((playerIndex,seatIndex)=>participantRecord(playerIndex,seatIndex,check.playerIndex));
            markOwnerStatus(check.playerName,"resolving",false);

            window.superpowerLog=window.superpowerLog||[];
            window.superpowerLog.push({
                type:"superpower_activation",event:"iron_fist_kun_lun_challenge_opened",
                playerName:check.playerName,playerIndex:check.playerIndex,powerId:POWER_ID,powerName:"WYZWANIE K’UN-LUN",
                logIcon:EMBLEM,dragon:"Shou-Lao",prizeCard:prizeCard.name,
                opponents:opponents.map(entry=>entry.playerName),packNumber:packStartIndex+1,pickIndex:currentPickIndex,
                timestamp:new Date().toISOString()
            });
            window.DraftStateEngine?.log?.("iron_fist_challenge_opened",{
                packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:check.playerIndex,player:check.playerName,
                sourceCard:prizeCard,resultCard:prizeCard,reason:"dragon_prize_stolen",
                data:{sessionId:session.sessionId,opponents:opponents.map(entry=>entry.playerIndex),logIcon:EMBLEM,sealedJoker:Boolean(prizeCard?.joker)}
            });
            return {ok:true,session:getSession()};
        }catch(error){
            return failAndRollback(error?.message||"Wyzwanie zostało cofnięte.",error);
        }
    }

    function getParticipant(playerIndex){
        return session?.participants?.find(entry=>entry.playerIndex===Number(playerIndex))||null;
    }

    function chooseStake(playerIndex,cardInstanceId){
        if(!session || session.phase!=="stakes") return {ok:false,reason:"Arena nie przyjmuje już zakładów."};
        const participant=getParticipant(playerIndex);
        if(!participant) return {ok:false,reason:"Ten gracz nie uczestniczy w Wyzwaniu."};
        const card=participant.stakeOptions.find(entry=>String(entry?.instanceId||"")===String(cardInstanceId||""));
        if(!card) return {ok:false,reason:participant.isHost?"Wybierz dostępną kartę ze swojego decku.":"Wybierz jedną z dwóch kart pokazanych przez Shou-Lao."};
        participant.chosenStakeInstanceId=String(card.instanceId||"");
        return {ok:true,participant,session:getSession()};
    }

    function lockStakes(){
        if(!session || session.phase!=="stakes") return {ok:false,reason:"Zakłady są już zamknięte."};
        if(session.participants.some(entry=>!entry.chosenStakeInstanceId)){
            return {ok:false,reason:"Każdy uczestnik musi wybrać swój zakład."};
        }
        try{
            for(const participant of session.participants){
                const deck=decks[participant.playerIndex]||[];
                const cardIndex=deck.findIndex(card=>String(card?.instanceId||"")===participant.chosenStakeInstanceId);
                const dinoStake=(participant.dinoBellyStakeIds||[]).includes(participant.chosenStakeInstanceId);
                if(dinoStake){
                    const consumed=window.DevilDinoUI?.consumeKunLunStake?.({
                        playerIndex:participant.playerIndex,
                        cardInstanceId:participant.chosenStakeInstanceId,
                        resolutionWindowId:session.sessionId
                    });
                    if(!consumed?.ok||!consumed.escrowEntry?.card){
                        throw new Error(consumed?.reason||`Brzuch Dino nie oddał stawki gracza ${participant.playerName}.`);
                    }
                    participant.stakeOriginalIndex=-1;
                    participant.stakeCard=consumed.escrowEntry.card;
                    participant.stakeEntryId=consumed.escrowEntry.runtimeEntryId;
                    participant.stakeFromDinoBelly=true;
                    participant.dinoOriginalRuntimeEntryId=consumed.entry?.runtimeEntryId||null;
                    continue;
                }
                const card=deck[cardIndex];
                if(cardIndex<0 || !card) throw new Error(`Zakład gracza ${participant.playerName} nie jest już dostępny.`);
                if(isProtected(participant.playerIndex,cardIndex)) throw new Error(`Tarcza Kapitana nie pozwala wystawić karty ${card.name}.`);
                participant.stakeOriginalIndex=cardIndex;
                participant.stakeCard=card;
                deck.splice(cardIndex,1);
                const escrow=window.DraftFoundation?.addCardToRuntimeZone?.(ZONE,card,{
                    ownerIndex:participant.playerIndex,sourcePowerId:POWER_ID,sourceEvent:"iron_fist_stake_escrowed",
                    metadata:{sessionId:session.sessionId,role:"stake",seatIndex:participant.seatIndex}
                });
                if(!escrow) throw new Error(`Nie udało się odłożyć zakładu gracza ${participant.playerName}.`);
                participant.stakeEntryId=escrow.runtimeEntryId;
            }
            for(const participant of session.participants){
                const champions=shuffled(decks[participant.playerIndex]||[]).slice(0,4);
                if(champions.length<4) throw new Error(`${participant.playerName} nie ma czterech wojowników po odłożeniu zakładu.`);
                participant.championOrder=champions;
            }
            session.phase="arena";
            window.DraftStateEngine?.log?.("iron_fist_stakes_locked",{
                packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:session.ownerIndex,player:session.ownerName,
                reason:"kun_lun_stakes_locked",
                data:{sessionId:session.sessionId,stakes:session.participants.map(entry=>({playerIndex:entry.playerIndex,card:entry.stakeCard?.name}))}
            });
            return {ok:true,session:getSession()};
        }catch(error){
            return failAndRollback(error?.message||"Nie udało się zamknąć zakładów.",error);
        }
    }

    function playRound(){
        if(!session || session.phase!=="arena") return {ok:false,reason:"Arena nie oczekuje teraz kolejnej rundy."};
        const roundIndex=session.rounds.length;
        if(roundIndex>=4) return {ok:false,reason:"Shou-Lao nie pozwala rozegrać piątej rundy."};
        const reveals=session.participants.map(participant=>{
            const card=participant.championOrder[roundIndex];
            const basePower=Number(card?.power)||0;
            return {
                playerIndex:participant.playerIndex,playerName:participant.playerName,isHost:participant.isHost,card,basePower,
                chiBonus:participant.isHost?CHI_BONUS:0,totalPower:basePower+(participant.isHost?CHI_BONUS:0)
            };
        });
        const highest=Math.max(...reveals.map(entry=>entry.totalPower));
        const tied=reveals.filter(entry=>entry.totalPower===highest);
        const winnerReveal=randomItem(tied);
        const winner=getParticipant(winnerReveal.playerIndex);
        winner.score+=1;
        const round={
            roundNumber:roundIndex+1,reveals,highestPower:highest,
            tiedPlayerIndices:tied.map(entry=>entry.playerIndex),shouLaoTieBreak:tied.length>1,
            winnerPlayerIndex:winner.playerIndex,winnerName:winner.playerName,
            scores:Object.fromEntries(session.participants.map(entry=>[entry.playerIndex,entry.score]))
        };
        session.rounds.push(round);
        if(winner.score>=2){session.winnerIndex=winner.playerIndex;session.phase="winner_resolution";}
        window.DraftStateEngine?.log?.("iron_fist_tournament_round",{
            packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:session.ownerIndex,player:session.ownerName,
            reason:"kun_lun_round_resolved",data:{sessionId:session.sessionId,...round}
        });
        return {ok:true,round,finished:session.winnerIndex!==null,session:getSession()};
    }

    function getWinner(){
        return session?.participants?.find(entry=>entry.playerIndex===session.winnerIndex)||null;
    }

    function preparePrizeResolution(resolvedPrizeCard){
        if(!session || session.phase!=="winner_resolution") return {ok:false,reason:"Zwycięzca nie został jeszcze ogłoszony."};
        const winner=getWinner();
        if(!winner) return {ok:false,reason:"Shou-Lao nie wskazał zwycięzcy."};
        const prize=session.prizeCard?.joker?resolvedPrizeCard:session.prizeCard;
        if(!prize) return {ok:false,reason:"Zapieczętowany Joker musi odsłonić Smoczą Nagrodę."};
        session.resolvedPrizeCard=prize;
        const combined=[
            ...(decks[winner.playerIndex]||[]),
            ...(winner.stakeFromDinoBelly?[]:[winner.stakeCard])
        ].filter(Boolean);
        const duplicate=combined.find(card=>normalize(card?.name)===normalize(prize?.name));
        const candidates=duplicate?combined.filter(card=>normalize(card?.name)===normalize(prize?.name)):combined;
        if(!candidates.length) return {ok:false,reason:"Zwycięzca nie ma karty, którą może wymienić na nagrodę."};
        return {ok:true,winner,prizeCard:session.prizeCard,resolvedPrizeCard:prize,candidates,forcedDuplicateReplacement:Boolean(duplicate)};
    }

    function chooseWinnerSwap(cardInstanceId){
        if(!session?.resolvedPrizeCard) return {ok:false,reason:"Najpierw rozstrzygnij Smoczą Nagrodę."};
        const prepared=preparePrizeResolution(session.resolvedPrizeCard);
        if(!prepared.ok) return prepared;
        const card=prepared.candidates.find(entry=>String(entry?.instanceId||"")===String(cardInstanceId||""));
        if(!card) return {ok:false,reason:"Ta karta nie może ustąpić miejsca Smoczej Nagrodzie."};
        session.winnerSwapInstanceId=String(card.instanceId||"");
        return {ok:true,card,prepared};
    }

    function getReplacementPool(playerIndex,removedCard){
        const banned=new Set((bannedCards||[]).map(normalize));
        const occupied=new Set((decks[playerIndex]||[]).map(card=>normalize(card?.name)).filter(Boolean));
        const removedName=normalize(removedCard?.name);
        return (cardDatabase||[]).filter(card=>{
            const name=normalize(card?.name);
            return Boolean(name && name!==removedName && !banned.has(name) && !occupied.has(name) && !card?.joker &&
                Number.isFinite(Number(card?.cost)) && Number.isFinite(Number(card?.power)));
        });
    }

    function getConsolationOptions(){
        if(!session || session.winnerIndex===null) return {ok:false,reason:"Turniej nie ma jeszcze zwycięzcy."};
        if(session.winnerIndex===session.ownerIndex) return {ok:true,options:[]};
        const owner=getParticipant(session.ownerIndex);
        if(!session.consolationOptions.length){
            session.consolationOptions=shuffled(getReplacementPool(owner.playerIndex,owner.stakeCard)).slice(0,3);
        }
        if(session.consolationOptions.length<3) return {ok:false,reason:"Nie znaleziono trzech legalnych kart Łaski Shou-Lao."};
        return {ok:true,options:session.consolationOptions};
    }

    function chooseConsolation(cardName){
        const prepared=getConsolationOptions();
        if(!prepared.ok) return prepared;
        const card=prepared.options.find(entry=>normalize(entry?.name)===normalize(cardName));
        if(!card) return {ok:false,reason:"Wybierz jedną z trzech kart pokazanych przez Shou-Lao."};
        session.consolationName=card.name;
        return {ok:true,card};
    }

    function returnStakeToWinner(winner){
        const removed=window.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,winner.stakeEntryId,{
            nextZone:winner.stakeFromDinoBelly?"devilDinoBelly":"deck",
            reason:"iron_fist_winner_stake_returned",zoneContext:{ownerIndex:winner.playerIndex}
        });
        if(!removed?.card) throw new Error("Nie udało się zwrócić zakładu zwycięzcy.");
        if(winner.stakeFromDinoBelly){
            const belly=window.DraftFoundation?.addCardToRuntimeZone?.("devilDinoBelly",removed.card,{
                ownerIndex:winner.playerIndex,sourcePowerId:"devil_dinosaur",sourceEvent:"devil_dino_kun_lun_stake_returned",
                metadata:{sessionId:session.sessionId,returnedFromKunLun:true,originalRuntimeEntryId:winner.dinoOriginalRuntimeEntryId||null}
            });
            if(!belly) throw new Error("Brzuch Dino nie odzyskał zwycięskiej stawki K’un-Lun.");
            return;
        }
        const deck=decks[winner.playerIndex];
        deck.splice(clampIndex(winner.stakeOriginalIndex,deck.length),0,removed.card);
    }

    function commitPrimaryPrize(){
        if(!session || session.phase!=="winner_resolution") return {ok:false,reason:"Turniej nie oczekuje teraz wypłaty nagrody."};
        const winner=getWinner();
        if(!winner || !session.resolvedPrizeCard || !session.winnerSwapInstanceId){
            return {ok:false,reason:"Wybierz kartę zwycięzcy, która ustąpi miejsca Smoczej Nagrodzie."};
        }
        if(session.winnerIndex!==session.ownerIndex && !session.consolationName){
            return {ok:false,reason:"Iron Fist musi wybrać jedną z trzech kart Łaski Shou-Lao."};
        }
        try{
            returnStakeToWinner(winner);
            const winnerDeck=decks[winner.playerIndex];
            const outgoingIndex=winnerDeck.findIndex(card=>String(card?.instanceId||"")===session.winnerSwapInstanceId);
            if(outgoingIndex<0) throw new Error("Wybrana karta zwycięzcy nie jest już dostępna.");
            const prizeEntry=window.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,session.prizeEntryId,{
                nextZone:"deck",reason:"iron_fist_dragon_prize_awarded",zoneContext:{ownerIndex:winner.playerIndex}
            });
            if(!prizeEntry?.card) throw new Error("Smocza Nagroda zniknęła z depozytu K’un-Lun.");
            const acquisition=window.DraftFoundation?.acquireCardToDeck?.({
                playerIndex:winner.playerIndex,sourceCard:prizeEntry.card,resolvedCard:session.resolvedPrizeCard,
                replacementIndex:outgoingIndex,preserveInstance:!prizeEntry.card?.joker,origin:"iron_fist_dragon_prize",
                powerId:POWER_ID,eventType:"iron_fist_dragon_prize_acquired",reason:"kun_lun_tournament_victory",
                sourceZone:ZONE,acquisitionType:"dragon_prize",graveyardCategory:"replaced"
            });
            if(!acquisition?.ok) throw new Error(acquisition?.reason||"Nie udało się przyznać Smoczej Nagrody.");
            const rejectedJokerEntries=window.archivePendingJokerRejections?.(
                acquisition.resultCard,
                {
                    source:"iron_fist_surprise_joker_rejected",
                    powerId:POWER_ID,
                    resolutionPath:"iron_fist_dragon_prize",
                    metadata:{sessionId:session.sessionId,winnerPlayerIndex:winner.playerIndex}
                }
            )||[];
            session.primaryOutcome={
                winner,prizeSourceCard:prizeEntry.card,prizeCard:acquisition.resultCard,
                winnerRemovedCard:acquisition.previousCard,rocketResult:acquisition.rocketResult||null,
                rejectedJokerEntries
            };
            session.phase="post_prize";
            session.captureDecisionMade=session.winnerIndex!==session.ownerIndex;
            window.DraftStateEngine?.log?.("iron_fist_primary_prize_awarded",{
                packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:winner.playerIndex,player:winner.playerName,
                sourceCard:prizeEntry.card,resultCard:acquisition.resultCard,reason:"dragon_prize_awarded",
                data:{
                    sessionId:session.sessionId,
                    rocketTriggered:Boolean(acquisition.rocketResult?.triggered),
                    rejectedJokerCards:rejectedJokerEntries.map(entry=>entry?.card?.name).filter(Boolean)
                }
            });
            return {
                ok:true,winnerName:winner.playerName,winnerIndex:winner.playerIndex,ironFistWon:winner.playerIndex===session.ownerIndex,
                prizeSourceCard:prizeEntry.card,prizeCard:acquisition.resultCard,winnerRemovedCard:acquisition.previousCard,
                rocketResult:acquisition.rocketResult||null
            };
        }catch(error){
            return failAndRollback(error?.message||"Wypłata Smoczej Nagrody została cofnięta.",error);
        }
    }

    function getCaptureOptions(){
        if(!session || session.phase!=="post_prize") return {ok:false,reason:"Dodatkowa nagroda nie jest teraz dostępna."};
        if(session.winnerIndex!==session.ownerIndex){
            session.captureDecisionMade=true;
            return {ok:true,options:[]};
        }
        const ownerDeck=decks[session.ownerIndex]||[];
        const occupied=new Set(ownerDeck.map(card=>normalize(card?.name)).filter(Boolean));
        const options=session.participants
            .filter(participant=>participant.playerIndex!==session.winnerIndex && participant.stakeCard && !occupied.has(normalize(participant.stakeCard.name)))
            .map(participant=>({
                playerIndex:participant.playerIndex,playerName:participant.playerName,
                stakeCard:participant.stakeCard,instanceId:String(participant.stakeCard.instanceId||"")
            }));
        if(!options.length) session.captureDecisionMade=true;
        return {ok:true,options};
    }

    function chooseCapturedStake(cardInstanceId){
        const prepared=getCaptureOptions();
        if(!prepared.ok) return prepared;
        const option=prepared.options.find(entry=>entry.instanceId===String(cardInstanceId||""));
        if(!option) return {ok:false,reason:"Ta stawka nie może zostać przejęta."};
        session.capturedStakeInstanceId=option.instanceId;
        session.captureDecisionMade=true;
        return {ok:true,option};
    }

    function declineCapturedStake(){
        if(!session || session.phase!=="post_prize") return {ok:false,reason:"Nie ma teraz dodatkowej nagrody do odrzucenia."};
        session.capturedStakeInstanceId="";
        session.captureDecisionMade=true;
        return {ok:true};
    }

    function makeReplacement(participant,replacementTemplate,mode){
        const replacement=createDraftCardInstance(replacementTemplate,{
            origin:"iron_fist_kun_lun_reroll",sourcePowerId:POWER_ID,sourceEvent:"losing_stake_replaced"
        });
        const deck=decks[participant.playerIndex];
        const index=clampIndex(participant.stakeOriginalIndex,deck.length);
        deck.splice(index,0,replacement);
        return {replacement,index,mode};
    }

    function replaceLosingStake(participant,replacementTemplate,mode){
        const removed=window.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,participant.stakeEntryId,{
            nextZone:"graveyard",reason:"iron_fist_losing_stake_rerolled",zoneContext:{ownerIndex:participant.playerIndex}
        });
        if(!removed?.card) throw new Error(`Nie udało się rozstrzygnąć zakładu gracza ${participant.playerName}.`);
        if(participant.stakeFromDinoBelly){
            archiveCardToGraveyard("digested",removed.card,{
                previousOwner:participant.playerIndex,source:"devil_dino_kun_lun_stake_lost",powerId:POWER_ID,
                metadata:{sessionId:session.sessionId,fromDinoBelly:true,noDeckMutation:true}
            });
            return {participant,removedCard:removed.card,replacementCard:null,index:-1,mode:"devil_dino_kun_lun_stake_lost",captured:false,noDeckMutation:true};
        }
        const made=makeReplacement(participant,replacementTemplate,mode);
        archiveCardToGraveyard("rerolled",removed.card,{
            previousOwner:participant.playerIndex,source:"iron_fist_losing_stake",powerId:POWER_ID,
            metadata:{sessionId:session.sessionId,replacementCardInstanceId:made.replacement.instanceId||null,replacementMode:mode}
        });
        window.DraftStateEngine?.log?.("iron_fist_losing_stake_replaced",{
            packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:participant.playerIndex,player:participant.playerName,
            sourceCard:removed.card,resultCard:made.replacement,reason:mode,data:{sessionId:session.sessionId,powerId:POWER_ID}
        });
        return {participant,removedCard:removed.card,replacementCard:made.replacement,index:made.index,mode,captured:false};
    }

    function captureLosingStake(participant){
        const ownerDeck=decks[session.ownerIndex]||[];
        const protectedPrize=session.primaryOutcome?.prizeCard;
        const costIndices=ownerDeck.map((card,index)=>({card,index})).filter(entry=>
            entry.card &&
            entry.card!==protectedPrize &&
            String(entry.card.instanceId||"")!==String(protectedPrize?.instanceId||"") &&
            !(
                typeof isWolverineRegeneratedProtectedCard==="function" &&
                isWolverineRegeneratedProtectedCard(entry.card)
            )
        );
        if(!costIndices.length) throw new Error("Iron Fist nie ma karty, którą może zapłacić za dodatkową stawkę.");
        const cost=randomItem(costIndices);
        const captured=window.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,participant.stakeEntryId,{
            nextZone:"deck",reason:"iron_fist_losing_stake_captured",zoneContext:{ownerIndex:session.ownerIndex}
        });
        if(!captured?.card) throw new Error(`Nie udało się przejąć stawki gracza ${participant.playerName}.`);
        ownerDeck[cost.index]=captured.card;
        archiveCardToGraveyard("replaced",cost.card,{
            previousOwner:session.ownerIndex,source:"iron_fist_captured_stake_cost",powerId:POWER_ID,
            metadata:{sessionId:session.sessionId,capturedCardInstanceId:captured.card.instanceId||null,protectedPrizeInstanceId:protectedPrize?.instanceId||null}
        });
        const replacementTemplate=participant.stakeFromDinoBelly?null:randomItem(getReplacementPool(participant.playerIndex,participant.stakeCard));
        if(!participant.stakeFromDinoBelly&&!replacementTemplate) throw new Error(`Brak zamiennika dla przejętej stawki gracza ${participant.playerName}.`);
        const made=participant.stakeFromDinoBelly
            ? {replacement:null,index:-1,mode:"captured_dino_belly_stake"}
            : makeReplacement(participant,replacementTemplate,"captured_stake_owner_reroll");
        window.DraftStateEngine?.log?.("iron_fist_losing_stake_captured",{
            packNumber:packStartIndex+1,pickIndex:currentPickIndex,playerIndex:session.ownerIndex,player:session.ownerName,
            sourceCard:cost.card,resultCard:captured.card,reason:"optional_winner_reward",
            data:{sessionId:session.sessionId,previousOwnerIndex:participant.playerIndex,previousOwnerReplacement:made.replacement?.name||null,fromDinoBelly:Boolean(participant.stakeFromDinoBelly)}
        });
        return {
            participant,removedCard:participant.stakeCard,replacementCard:made.replacement,index:made.index,
            mode:"captured_stake_owner_reroll",captured:true,capturedCard:captured.card,hostCostCard:cost.card,hostCostIndex:cost.index
        };
    }

    function finalizeOutcome(){
        if(!session || session.phase!=="post_prize") return {ok:false,reason:"Turniej nie oczekuje teraz ostatecznego werdyktu."};
        if(session.winnerIndex===session.ownerIndex && !session.captureDecisionMade){
            return {ok:false,reason:"Iron Fist musi przejąć jedną stawkę albo świadomie zrezygnować."};
        }
        const winner=getWinner();
        const primary=session.primaryOutcome;
        try{
            const losses=[];
            for(const participant of session.participants.filter(entry=>entry.playerIndex!==winner.playerIndex)){
                const captured=String(participant.stakeCard?.instanceId||"")===session.capturedStakeInstanceId;
                if(captured){
                    losses.push(captureLosingStake(participant));
                    continue;
                }
                let replacementTemplate;
                let mode="random_kun_lun_reroll";
                if(participant.stakeFromDinoBelly){
                    losses.push(replaceLosingStake(participant,null,"devil_dino_kun_lun_stake_lost"));
                    continue;
                }
                if(participant.playerIndex===session.ownerIndex){
                    replacementTemplate=session.consolationOptions.find(card=>normalize(card?.name)===normalize(session.consolationName));
                    mode="iron_fist_shou_lao_grace";
                }else{
                    replacementTemplate=randomItem(getReplacementPool(participant.playerIndex,participant.stakeCard));
                }
                if(!replacementTemplate) throw new Error(`Brak legalnego zamiennika dla zakładu gracza ${participant.playerName}.`);
                losses.push(replaceLosingStake(participant,replacementTemplate,mode));
            }

            const counterattacks=[];
            for(const loss of losses){
                if(!loss.participant.isCaptain || loss.index<0) continue;
                const counter=resolveCaptainAmericaCounterattack({
                    attackerPlayerIndex:session.ownerIndex,defenderPlayerIndex:loss.participant.playerIndex,
                    defenderCardIndex:loss.index,defenderCardName:loss.removedCard.name,
                    event:loss.captured?"iron_fist_captured_tournament_stake":"iron_fist_forced_tournament_loss"
                });
                if(counter?.triggered) counterattacks.push(counter);
            }

            const complete=window.SuperpowerEngine?.completeActivation?.(session.ownerName,POWER_ID,{
                sessionId:session.sessionId,prizeCard:primary.prizeCard.name,winnerName:winner.playerName,
                winnerPlayerIndex:winner.playerIndex,rounds:session.rounds.length,chiBonus:CHI_BONUS,
                capturedStake:losses.find(entry=>entry.captured)?.capturedCard?.name||null,
                packNumber:packStartIndex+1,pickIndex:session.resumePickIndex
            });
            if(complete?.ok===false) throw new Error("Silnik odrzucił finał Wyzwania K’un-Lun.");
            markOwnerStatus(session.ownerName,"used",true);

            const captureResult=losses.find(entry=>entry.captured)||null;
            const result={
                ok:true,sessionId:session.sessionId,ownerName:session.ownerName,ownerIndex:session.ownerIndex,
                winnerName:winner.playerName,winnerIndex:winner.playerIndex,ironFistWon:winner.playerIndex===session.ownerIndex,
                prizeSourceCard:primary.prizeSourceCard,prizeCard:primary.prizeCard,winnerRemovedCard:primary.winnerRemovedCard,
                winnerStake:winner.stakeCard,losses,captureResult,rounds:[...session.rounds],
                scores:Object.fromEntries(session.participants.map(entry=>[entry.playerIndex,entry.score])),
                rocketResult:primary.rocketResult||null,counterattacks,resumePickIndex:session.resumePickIndex
            };

            window.superpowerLog=window.superpowerLog||[];
            window.superpowerLog.push({
                type:"superpower_resolution",event:"iron_fist_kun_lun_challenge_resolved",
                playerName:session.ownerName,playerIndex:session.ownerIndex,powerId:POWER_ID,powerName:"WYZWANIE K’UN-LUN",
                logIcon:EMBLEM,dragon:"Shou-Lao",winner:winner.playerName,prizeCard:primary.prizeCard?.name,
                capturedStake:captureResult?.capturedCard?.name||null,rounds:session.rounds.length,
                losingStakes:losses.map(entry=>({player:entry.participant.playerName,card:entry.removedCard.name,replacement:entry.replacementCard.name,captured:entry.captured})),
                captainCounterattacks:counterattacks.length,packNumber:packStartIndex+1,pickIndex:session.resumePickIndex,
                timestamp:new Date().toISOString()
            });
            window.DraftStateEngine?.log?.("iron_fist_challenge_resolved",{
                packNumber:packStartIndex+1,pickIndex:session.resumePickIndex,playerIndex:session.ownerIndex,player:session.ownerName,
                sourceCard:primary.prizeSourceCard,resultCard:primary.prizeCard,reason:"kun_lun_winner_declared",
                data:{sessionId:session.sessionId,winnerPlayerIndex:winner.playerIndex,rounds:session.rounds.length,
                    capturedStake:Boolean(captureResult),counterattackCount:counterattacks.length}
            });
            window.DraftFoundation?.commitTransaction?.(session.transactionId,{
                powerId:POWER_ID,sessionId:session.sessionId,winnerPlayerIndex:winner.playerIndex,resumePickIndex:session.resumePickIndex
            });
            session.phase="complete";
            session.result=result;
            return result;
        }catch(error){
            return failAndRollback(error?.message||"Finał turnieju został cofnięty.",error);
        }
    }

    // Compatibility helper for non-visual tests and old integrations. The 40.2 UI
    // uses the explicit primary -> interactions -> final sequence above.
    function commitOutcome(){
        const primary=session?.phase==="winner_resolution"?commitPrimaryPrize():session?.primaryOutcome;
        if(!primary?.ok && !session?.primaryOutcome) return primary||{ok:false,reason:"Brak nagrody do rozstrzygnięcia."};
        if(session?.winnerIndex===session?.ownerIndex && !session.captureDecisionMade) declineCapturedStake();
        return finalizeOutcome();
    }

    function rollback(reason="kun_lun_cancelled"){
        if(!session) return true;
        failAndRollback("Wyzwanie K’un-Lun zostało cofnięte.",new Error(reason));
        return true;
    }

    function finish(){
        if(session?.phase!=="complete") return false;
        session=null;
        window.GraveyardUI?.refreshButton?.();
        return true;
    }

    function getSession(){return session;}

    return Object.freeze({
        POWER_ID,MIN_DECK_SIZE,OPPONENT_STAKE_OPTIONS,STAKE_OPTIONS:OPPONENT_STAKE_OPTIONS,CHI_BONUS,
        preflight,prepareChallenge,chooseStake,lockStakes,playRound,preparePrizeResolution,chooseWinnerSwap,
        getConsolationOptions,chooseConsolation,commitPrimaryPrize,getCaptureOptions,chooseCapturedStake,
        declineCapturedStake,finalizeOutcome,commitOutcome,rollback,finish,getSession,
        isBusy:()=>Boolean(session && session.phase!=="complete")
    });
})();

window.IronFistTournamentEngine=IronFistTournamentEngine;
