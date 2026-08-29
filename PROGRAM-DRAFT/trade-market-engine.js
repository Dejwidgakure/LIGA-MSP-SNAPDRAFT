(function(global){
    "use strict";

    const VERSION="0.6.0-post-draft-market";
    const CONFIG=Object.freeze({
        marketMinPrice:2,
        negotiationMinPrice:5,
        maxMarketListingsPerPlayer:2,
        maxNegotiationsPerPlayer:2,
        maxNegotiationsPerTurn:1
    });

    const state={
        enabled:false,
        players:[],
        listings:[],
        negotiations:[],
        history:[],
        perPlayer:[],
        listingSequence:0,
        negotiationSequence:0,
        transactionSequence:0,
        startedAt:null
    };

    function clone(value){
        try{return structuredClone(value);}catch(_){return JSON.parse(JSON.stringify(value));}
    }
    function runtime(){return global.TradeMarketRuntime||null;}
    function economy(){return global.EconomyEngine||null;}
    function names(){return runtime()?.getPlayers?.()||state.players||[];}
    function emit(type,detail={}){
        global.dispatchEvent?.(new CustomEvent("trade-market:change",{detail:{type,...clone(detail)}}));
    }
    function makePlayerState(index,name){
        return {
            playerIndex:index,
            playerName:name,
            marketListingsCreated:0,
            negotiationsCreated:0,
            lastNegotiationTurnKey:null
        };
    }
    function reset(){
        state.enabled=false;
        state.players=[];
        state.listings=[];
        state.negotiations=[];
        state.history=[];
        state.perPlayer=[];
        state.listingSequence=0;
        state.negotiationSequence=0;
        state.transactionSequence=0;
        state.startedAt=null;
        emit("reset");
    }
    function beginDraft(playerNames,options={}){
        reset();
        state.players=(Array.isArray(playerNames)?playerNames:[]).map(String);
        state.enabled=Boolean(options.enabled) && Boolean(economy()?.isEnabled?.());
        state.perPlayer=state.players.map((name,index)=>makePlayerState(index,name));
        state.startedAt=Date.now();
        emit("begin",{enabled:state.enabled});
        return exportState();
    }
    function isEnabled(){return Boolean(state.enabled && economy()?.isEnabled?.());}
    function playerState(index){
        const p=Number(index);
        return Number.isInteger(p)?state.perPlayer[p]||null:null;
    }
    function getCurrentPlayer(){
        const p=runtime()?.getCurrentPlayerIndex?.();
        return Number.isInteger(p)?p:null;
    }
    function isPostDraft(){return Boolean(runtime()?.isPostDraft?.());}
    function requireActive(playerIndex){
        if(!isEnabled()) return {ok:false,reason:"Galaktyczny Targ jest wyłączony."};
        const p=Number(playerIndex);
        if(!Number.isInteger(p)||!names()[p]) return {ok:false,reason:"Nie znaleziono gracza."};
        if(isPostDraft()) return {ok:true,playerIndex:p,postDraft:true};
        const active=getCurrentPlayer();
        if(!Number.isInteger(active)) return {ok:false,reason:"Galaktyczny Targ działa wyłącznie podczas aktywnego ruchu gracza albo po zakończeniu draftowania."};
        if(active!==p) return {ok:false,reason:"Tylko aktywny gracz może teraz wykonać tę akcję."};
        return {ok:true,playerIndex:p};
    }
    function addHistory(type,data={}){
        const entry={
            id:`trade-history-${state.history.length+1}`,
            type,
            createdAt:Date.now(),
            ...clone(data)
        };
        state.history.unshift(entry);
        if(state.history.length>80) state.history.length=80;
        return entry;
    }
    function getDeckEntries(playerIndex){return runtime()?.getDeckEntries?.(Number(playerIndex))||[];}
    function getCardEntry(playerIndex,instanceId){return runtime()?.findEntry?.(Number(playerIndex),String(instanceId||""))||null;}
    function getWallet(playerIndex){return economy()?.getWallet?.(Number(playerIndex))||null;}
    function canAfford(playerIndex,amount){return Boolean(economy()?.canAfford?.(Number(playerIndex),Number(amount)));}
    function sanitizePrice(value,min){
        const amount=Math.floor(Number(value));
        return Number.isFinite(amount)?Math.max(min,amount):min;
    }
    function activeListings(){
        syncStaleListings();
        return state.listings.filter(item=>item.status==="active");
    }
    function listingUsesInstance(instanceId,ignoreListingId=null){
        const id=String(instanceId||"");
        if(!id) return false;
        return state.listings.some(item=>item.status==="active"&&item.id!==String(ignoreListingId||"")&&String(item.cardInstanceId||"")===id);
    }
    function negotiationUsesInstance(instanceId,ignoreNegotiationId=null){
        const id=String(instanceId||"");
        if(!id) return false;
        return state.negotiations.some(item=>{
            if(item.status!=="pending"||item.id===String(ignoreNegotiationId||"")) return false;
            return [item.targetInstanceId,item.offerCardInstanceId,item.buyerReleaseInstanceId].some(value=>String(value||"")===id);
        });
    }
    function isInstanceReserved(instanceId,{ignoreListingId=null,ignoreNegotiationId=null}={}){
        return listingUsesInstance(instanceId,ignoreListingId)||negotiationUsesInstance(instanceId,ignoreNegotiationId);
    }

    function closeListingsForInstances(instanceIds,reason,transactionId=null,ignoreListingId=null){
        const ids=new Set((Array.isArray(instanceIds)?instanceIds:[]).map(value=>String(value||"")).filter(Boolean));
        if(!ids.size) return [];
        const closed=[];
        for(const listing of state.listings){
            if(listing.status!=="active"||listing.id===String(ignoreListingId||"")||!ids.has(String(listing.cardInstanceId||""))) continue;
            listing.status="expired";
            listing.closedAt=Date.now();
            listing.expireReason=String(reason||"transaction_committed");
            if(transactionId) listing.transactionId=transactionId;
            addHistory("market_expired",{...listing,reason:listing.expireReason});
            emit("listing-expired",{listing,reason:listing.expireReason});
            closed.push(clone(listing));
        }
        return closed;
    }

    function expireNegotiationsForInstances(instanceIds,reason,transactionId=null,ignoreNegotiationId=null){
        const ids=new Set((Array.isArray(instanceIds)?instanceIds:[]).map(value=>String(value||"")).filter(Boolean));
        if(!ids.size) return [];
        const expired=[];
        for(const negotiation of state.negotiations){
            if(negotiation.status!=="pending"||negotiation.id===String(ignoreNegotiationId||"")) continue;
            const used=[negotiation.targetInstanceId,negotiation.offerCardInstanceId,negotiation.buyerReleaseInstanceId]
                .map(value=>String(value||""))
                .filter(Boolean);
            if(!used.some(id=>ids.has(id))) continue;
            negotiation.status="expired";
            negotiation.resolvedAt=Date.now();
            negotiation.expireReason=String(reason||"transaction_committed_elsewhere");
            if(transactionId) negotiation.transactionId=transactionId;
            addHistory("negotiation_expired",{...negotiation,reason:negotiation.expireReason});
            emit("negotiation-expired",{negotiation,reason:negotiation.expireReason});
            expired.push(clone(negotiation));
        }
        return expired;
    }

    function syncStaleListings(){
        for(const listing of state.listings){
            if(listing.status!=="active") continue;
            if(!getCardEntry(listing.sellerIndex,listing.cardInstanceId)){
                listing.status="expired";
                listing.closedAt=Date.now();
                addHistory("market_expired",{
                    listingId:listing.id,
                    sellerIndex:listing.sellerIndex,
                    sellerName:listing.sellerName,
                    cardName:listing.cardName,
                    reason:"card_left_deck"
                });
            }
        }
    }
    function syncStaleNegotiations(){
        for(const negotiation of state.negotiations){
            if(negotiation.status!=="pending") continue;
            const target=getCardEntry(negotiation.sellerIndex,negotiation.targetInstanceId);
            const ownInstanceId=negotiation.mode==="cash"?negotiation.buyerReleaseInstanceId:negotiation.offerCardInstanceId;
            const needsOwnCard=negotiation.mode==="cash"||negotiation.mode==="card"||negotiation.mode==="hybrid"||Boolean(ownInstanceId);
            const own=needsOwnCard?getCardEntry(negotiation.buyerIndex,ownInstanceId):true;
            const currentTurnKey=runtime()?.getTurnKey?.()||null;
            const turnExpired=!isPostDraft()&&Boolean(negotiation.turnKey&&currentTurnKey&&currentTurnKey!==negotiation.turnKey);
            if(target && own && !turnExpired) continue;
            negotiation.status="expired";
            negotiation.resolvedAt=Date.now();
            negotiation.expireReason=turnExpired?"turn_ended":(!target?"target_card_left_deck":"buyer_card_left_deck");
            addHistory("negotiation_expired",{
                ...negotiation,
                reason:negotiation.expireReason
            });
            emit("negotiation-expired",{negotiation});
        }
    }

    function createListing({playerIndex,cardInstanceId,price}){
        syncStaleListings();
        syncStaleNegotiations();
        const active=requireActive(playerIndex);
        if(!active.ok) return active;
        const ps=playerState(active.playerIndex);
        if(!ps) return {ok:false,reason:"Nie znaleziono gracza."};
        if(ps.marketListingsCreated>=CONFIG.maxMarketListingsPerPlayer){
            return {ok:false,reason:`Każdy gracz może wystawić maksymalnie ${CONFIG.maxMarketListingsPerPlayer} karty na Market podczas draftu.`};
        }
        const cardEntry=getCardEntry(active.playerIndex,cardInstanceId);
        if(!cardEntry) return {ok:false,reason:"Ta karta nie znajduje się już w Panelu Wojownika."};
        if(listingUsesInstance(cardInstanceId)){
            return {ok:false,reason:"Ta karta jest już wystawiona na Markecie."};
        }
        const finalPrice=sanitizePrice(price,CONFIG.marketMinPrice);
        state.listingSequence++;
        const listing={
            id:`market-${state.listingSequence}`,
            status:"active",
            sellerIndex:active.playerIndex,
            sellerName:names()[active.playerIndex]||`Gracz ${active.playerIndex+1}`,
            cardInstanceId:String(cardEntry.card.instanceId||""),
            cardName:String(cardEntry.card.name||"Karta"),
            cardCost:Number(cardEntry.card.cost),
            cardPower:Number(cardEntry.card.power),
            price:finalPrice,
            createdAt:Date.now(),
            turnKey:runtime()?.getTurnKey?.()||null
        };
        state.listings.push(listing);
        ps.marketListingsCreated++;
        addHistory("market_listed",listing);
        emit("listing-created",{listing});
        return {ok:true,listing:clone(listing)};
    }

    function cancelListing({playerIndex,listingId}){
        const active=requireActive(playerIndex);
        if(!active.ok) return active;
        const listing=state.listings.find(item=>item.id===String(listingId));
        if(!listing||listing.status!=="active") return {ok:false,reason:"To ogłoszenie nie jest już aktywne."};
        if(listing.sellerIndex!==active.playerIndex) return {ok:false,reason:"Możesz wycofać wyłącznie własne ogłoszenie."};
        listing.status="withdrawn";
        listing.closedAt=Date.now();
        addHistory("market_withdrawn",{...listing});
        emit("listing-withdrawn",{listing});
        return {ok:true,listing:clone(listing)};
    }

    function rollbackWalletTransfer(buyerIndex,sellerIndex,price,reason){
        try{economy()?.credit?.(buyerIndex,price,{reason:`trade_rollback:${reason}`});}catch(_){ }
        try{economy()?.debit?.(sellerIndex,price,{reason:`trade_rollback:${reason}`});}catch(_){ }
    }

    function executeWalletTransfer(buyerIndex,sellerIndex,price,metadata={}){
        if(!canAfford(buyerIndex,price)) return {ok:false,reason:"Za mało JeffCoinów na tę transakcję."};
        const debit=economy()?.debit?.(buyerIndex,price,{
            reason:metadata.reason||"trade_market_payment",
            data:metadata.data||{}
        });
        if(!debit?.ok) return debit||{ok:false,reason:"Nie udało się pobrać JeffCoinów."};
        const credit=economy()?.credit?.(sellerIndex,price,{
            reason:metadata.reason||"trade_market_income",
            kind:"trade",
            data:metadata.data||{}
        });
        if(!credit?.ok){
            try{economy()?.credit?.(buyerIndex,price,{reason:"trade_rollback_credit_failed"});}catch(_){ }
            return {ok:false,reason:"Nie udało się przekazać JeffCoinów sprzedającemu."};
        }
        return {ok:true,debit,credit};
    }

    function buyListing({buyerIndex,listingId,buyerReleaseInstanceId}){
        const active=requireActive(buyerIndex);
        if(!active.ok) return active;
        syncStaleListings();
        syncStaleNegotiations();
        const listing=state.listings.find(item=>item.id===String(listingId));
        if(!listing||listing.status!=="active") return {ok:false,reason:"To ogłoszenie nie jest już aktywne."};
        if(listing.sellerIndex===active.playerIndex) return {ok:false,reason:"Nie możesz kupić własnej karty."};
        if(negotiationUsesInstance(buyerReleaseInstanceId)){
            return {ok:false,reason:"Wybrana przez ciebie karta jest już częścią innej aktywnej negocjacji."};
        }
        const validation=runtime()?.validateCashTransfer?.({
            buyerIndex:active.playerIndex,
            sellerIndex:listing.sellerIndex,
            targetInstanceId:listing.cardInstanceId,
            buyerReleaseInstanceId
        });
        if(!validation?.ok) return validation||{ok:false,reason:"Nie można przygotować transakcji."};
        const transactionId=`trade-${++state.transactionSequence}`;
        const money=executeWalletTransfer(active.playerIndex,listing.sellerIndex,listing.price,{
            reason:"trade_market_purchase",
            data:{listingId:listing.id,transactionId}
        });
        if(!money.ok) return money;
        const transfer=runtime()?.executeCashTransfer?.({
            buyerIndex:active.playerIndex,
            sellerIndex:listing.sellerIndex,
            targetInstanceId:listing.cardInstanceId,
            buyerReleaseInstanceId,
            transactionId,
            source:"trade_market_purchase"
        });
        if(!transfer?.ok){
            rollbackWalletTransfer(active.playerIndex,listing.sellerIndex,listing.price,"card_transfer_failed");
            return transfer||{ok:false,reason:"Transfer karty nie powiódł się."};
        }
        listing.status="sold";
        listing.closedAt=Date.now();
        listing.buyerIndex=active.playerIndex;
        listing.buyerName=names()[active.playerIndex]||`Gracz ${active.playerIndex+1}`;
        listing.transactionId=transactionId;
        closeListingsForInstances(
            [listing.cardInstanceId,buyerReleaseInstanceId],
            "market_purchase_committed",
            transactionId,
            listing.id
        );
        expireNegotiationsForInstances(
            [listing.cardInstanceId,buyerReleaseInstanceId],
            "market_purchase_committed",
            transactionId
        );
        addHistory("market_sold",{
            transactionId,
            listingId:listing.id,
            buyerIndex:active.playerIndex,
            buyerName:listing.buyerName,
            sellerIndex:listing.sellerIndex,
            sellerName:listing.sellerName,
            cardName:listing.cardName,
            price:listing.price,
            replacementName:transfer.replacement?.name||null,
            releasedCardName:transfer.releaseCard?.name||null
        });
        emit("market-purchased",{listing,transactionId,transfer});
        try{economy()?.playJeffCoinAward?.(listing.sellerIndex,listing.price,{reason:"trade_market_sale",source:"trade"});}catch(_){ }
        return {ok:true,listing:clone(listing),transactionId,transfer:clone({
            targetCard:transfer.targetCard,
            releaseCard:transfer.releaseCard,
            replacement:transfer.replacement
        })};
    }

    function createNegotiation({buyerIndex,sellerIndex,targetInstanceId,price,mode=null,offerCardInstanceId=null,buyerReleaseInstanceId=null}){
        syncStaleNegotiations();
        const active=requireActive(buyerIndex);
        if(!active.ok) return active;
        const seller=Number(sellerIndex);
        if(!Number.isInteger(seller)||!names()[seller]) return {ok:false,reason:"Wybierz gracza, z którym chcesz negocjować."};
        if(seller===active.playerIndex) return {ok:false,reason:"Nie możesz negocjować sam ze sobą."};
        const ps=playerState(active.playerIndex);
        if(ps.negotiationsCreated>=CONFIG.maxNegotiationsPerPlayer){
            return {ok:false,reason:`Każdy gracz może rozpocząć maksymalnie ${CONFIG.maxNegotiationsPerPlayer} negocjacje podczas draftu.`};
        }
        const turnKey=runtime()?.getTurnKey?.()||null;
        if(!isPostDraft()&&ps.lastNegotiationTurnKey && ps.lastNegotiationTurnKey===turnKey){
            return {ok:false,reason:"Podczas jednego ruchu możesz rozpocząć tylko jedną negocjację."};
        }
        const target=getCardEntry(seller,targetInstanceId);
        if(!target) return {ok:false,reason:"Wybierz kartę, którą chcesz pozyskać."};
        if(negotiationUsesInstance(target.card.instanceId)){
            return {ok:false,reason:"Ta karta jest już przedmiotem aktywnej negocjacji."};
        }
        const transactionMode=["cash","card","hybrid"].includes(String(mode))?String(mode):(offerCardInstanceId?"hybrid":"cash");
        const usesCoins=transactionMode!=="card";
        const usesOfferCard=transactionMode!=="cash";
        const finalPrice=usesCoins?sanitizePrice(price,CONFIG.negotiationMinPrice):0;
        let offerCard=null;
        let releaseCard=null;
        if(usesOfferCard){
            offerCard=getCardEntry(active.playerIndex,offerCardInstanceId);
            if(!offerCard) return {ok:false,reason:"Karta dodana do oferty nie znajduje się już w twoim Panelu Wojownika."};
            if(negotiationUsesInstance(offerCard.card.instanceId)){
                return {ok:false,reason:"Karta dodawana do oferty jest już częścią innej aktywnej negocjacji."};
            }
        }else{
            releaseCard=getCardEntry(active.playerIndex,buyerReleaseInstanceId);
            if(!releaseCard) return {ok:false,reason:"Wybierz własną kartę, którą kupowana karta zastąpi w twoim Panelu Wojownika."};
            if(negotiationUsesInstance(releaseCard.card.instanceId)){
                return {ok:false,reason:"Karta wybrana do zastąpienia jest już częścią innej aktywnej transakcji."};
            }
            const validation=runtime()?.previewCoinPurchase?.({
                buyerIndex:active.playerIndex,
                sellerIndex:seller,
                targetInstanceId:target.card.instanceId,
                buyerReleaseInstanceId:releaseCard.card.instanceId
            });
            if(!validation?.ok) return validation;
        }
        state.negotiationSequence++;
        const negotiation={
            id:`neg-${state.negotiationSequence}`,
            status:"pending",
            buyerIndex:active.playerIndex,
            buyerName:names()[active.playerIndex]||`Gracz ${active.playerIndex+1}`,
            sellerIndex:seller,
            sellerName:names()[seller]||`Gracz ${seller+1}`,
            targetInstanceId:String(target.card.instanceId||""),
            targetCardName:String(target.card.name||"Karta"),
            targetCost:Number(target.card.cost),
            targetPower:Number(target.card.power),
            mode:transactionMode,
            price:finalPrice,
            offerCardInstanceId:offerCard?String(offerCard.card.instanceId||""):null,
            offerCardName:offerCard?String(offerCard.card.name||""):null,
            buyerReleaseInstanceId:releaseCard?String(releaseCard.card.instanceId||""):null,
            buyerReleaseCardName:releaseCard?String(releaseCard.card.name||""):null,
            createdAt:Date.now(),
            turnKey
        };
        state.negotiations.push(negotiation);
        ps.negotiationsCreated++;
        ps.lastNegotiationTurnKey=turnKey;
        addHistory("negotiation_created",negotiation);
        emit("negotiation-created",{negotiation});
        return {ok:true,negotiation:clone(negotiation)};
    }

    function resolveNegotiation({negotiationId,accept}){
        if(!isEnabled()) return {ok:false,reason:"Galaktyczny Targ jest wyłączony."};
        syncStaleNegotiations();
        const negotiation=state.negotiations.find(item=>item.id===String(negotiationId));
        if(!negotiation||negotiation.status!=="pending") return {ok:false,reason:"Ta negocjacja została już rozstrzygnięta."};
        if(!isPostDraft()&&getCurrentPlayer()!==negotiation.buyerIndex) return {ok:false,reason:"Negocjacja może zostać rozstrzygnięta wyłącznie podczas ruchu gracza, który ją rozpoczął."};
        const reservedIds=[negotiation.targetInstanceId,negotiation.offerCardInstanceId,negotiation.buyerReleaseInstanceId].filter(Boolean);
        if(reservedIds.some(id=>negotiationUsesInstance(id,negotiation.id))){
            negotiation.status="expired";
            negotiation.resolvedAt=Date.now();
            negotiation.expireReason="instance_reserved_elsewhere";
            addHistory("negotiation_expired",{...negotiation,reason:negotiation.expireReason});
            emit("negotiation-expired",{negotiation});
            return {ok:false,reason:"Jedna z kart negocjacji została w międzyczasie zajęta przez inną aktywną transakcję."};
        }
        if(!accept){
            negotiation.status="rejected";
            negotiation.resolvedAt=Date.now();
            addHistory("negotiation_rejected",negotiation);
            emit("negotiation-rejected",{negotiation});
            return {ok:true,accepted:false,negotiation:clone(negotiation)};
        }
        let preview;
        if(negotiation.mode==="card"||negotiation.mode==="hybrid"||negotiation.offerCardInstanceId){
            preview=runtime()?.previewCardSwap?.({
                buyerIndex:negotiation.buyerIndex,
                sellerIndex:negotiation.sellerIndex,
                targetInstanceId:negotiation.targetInstanceId,
                offerCardInstanceId:negotiation.offerCardInstanceId
            });
        }else{
            preview=runtime()?.previewCoinPurchase?.({
                buyerIndex:negotiation.buyerIndex,
                sellerIndex:negotiation.sellerIndex,
                targetInstanceId:negotiation.targetInstanceId,
                buyerReleaseInstanceId:negotiation.buyerReleaseInstanceId
            });
        }
        if(!preview?.ok) return preview||{ok:false,reason:"Nie można już wykonać tej negocjacji."};
        const transactionId=`trade-${++state.transactionSequence}`;
        const usesCoins=Number(negotiation.price)>0;
        const money=usesCoins?executeWalletTransfer(negotiation.buyerIndex,negotiation.sellerIndex,negotiation.price,{
            reason:"trade_negotiation_payment",
            data:{negotiationId:negotiation.id,transactionId}
        }):{ok:true};
        if(!money.ok) return money;
        const transfer=(negotiation.mode==="card"||negotiation.mode==="hybrid"||negotiation.offerCardInstanceId)
            ? runtime()?.executeCardSwap?.({
                buyerIndex:negotiation.buyerIndex,
                sellerIndex:negotiation.sellerIndex,
                targetInstanceId:negotiation.targetInstanceId,
                offerCardInstanceId:negotiation.offerCardInstanceId,
                transactionId,
                source:"trade_negotiation_swap"
            })
            : runtime()?.executeCoinPurchase?.({
                buyerIndex:negotiation.buyerIndex,
                sellerIndex:negotiation.sellerIndex,
                targetInstanceId:negotiation.targetInstanceId,
                buyerReleaseInstanceId:negotiation.buyerReleaseInstanceId,
                transactionId,
                source:"trade_negotiation_coin_purchase"
            });
        if(!transfer?.ok){
            if(usesCoins) rollbackWalletTransfer(negotiation.buyerIndex,negotiation.sellerIndex,negotiation.price,"negotiation_transfer_failed");
            return transfer||{ok:false,reason:"Nie udało się wykonać transakcji."};
        }
        negotiation.status="accepted";
        negotiation.resolvedAt=Date.now();
        negotiation.transactionId=transactionId;
        negotiation.result={
            acquiredCardName:transfer.targetCard?.name||negotiation.targetCardName,
            offeredCardName:transfer.offerCard?.name||null,
            releasedCardName:transfer.releaseCard?.name||null,
            replacementName:transfer.replacement?.name||null
        };
        closeListingsForInstances(
            [negotiation.targetInstanceId,negotiation.offerCardInstanceId,negotiation.buyerReleaseInstanceId],
            "negotiation_committed",
            transactionId
        );
        expireNegotiationsForInstances(
            [negotiation.targetInstanceId,negotiation.offerCardInstanceId,negotiation.buyerReleaseInstanceId],
            "negotiation_committed_elsewhere",
            transactionId,
            negotiation.id
        );
        addHistory("negotiation_accepted",negotiation);
        emit("negotiation-accepted",{negotiation,transactionId,transfer});
        if(usesCoins){try{economy()?.playJeffCoinAward?.(negotiation.sellerIndex,negotiation.price,{reason:"trade_negotiation_income",source:"trade"});}catch(_){ }}
        return {ok:true,accepted:true,negotiation:clone(negotiation),transactionId,transfer:clone({
            targetCard:transfer.targetCard||null,
            offerCard:transfer.offerCard||null,
            releaseCard:transfer.releaseCard||null,
            replacement:transfer.replacement||null
        })};
    }

    function onDraftFinished(){
        // Koniec draftowania z paczek nie zamyka Targu. Po tym checkpointcie
        // każdy gracz może nadal handlować Main Deckiem; Sideboard nie jest częścią
        // TradeMarketRuntime.getDeckEntries, więc pozostaje nietykalny.
        syncStaleListings();
        syncStaleNegotiations();
        emit("post-draft-open",{postDraft:true});
        return false;
    }

    function getPlayerSummary(playerIndex){
        syncStaleListings();
        syncStaleNegotiations();
        const ps=playerState(playerIndex);
        if(!ps) return null;
        return {
            ...clone(ps),
            marketListingsRemaining:Math.max(0,CONFIG.maxMarketListingsPerPlayer-ps.marketListingsCreated),
            negotiationsRemaining:Math.max(0,CONFIG.maxNegotiationsPerPlayer-ps.negotiationsCreated),
            activeListings:activeListings().filter(item=>item.sellerIndex===Number(playerIndex)).length,
            pendingNegotiations:state.negotiations.filter(item=>item.status==="pending"&&(item.buyerIndex===Number(playerIndex)||item.sellerIndex===Number(playerIndex))).length
        };
    }

    function exportState(){
        syncStaleListings();
        syncStaleNegotiations();
        return clone({version:VERSION,...state});
    }
    function restoreState(snapshot){
        if(!snapshot||typeof snapshot!=="object") return false;
        state.enabled=Boolean(snapshot.enabled);
        state.players=Array.isArray(snapshot.players)?snapshot.players.map(String):[];
        state.listings=Array.isArray(snapshot.listings)?clone(snapshot.listings):[];
        state.negotiations=Array.isArray(snapshot.negotiations)?clone(snapshot.negotiations):[];
        state.history=Array.isArray(snapshot.history)?clone(snapshot.history):[];
        state.perPlayer=Array.isArray(snapshot.perPlayer)?clone(snapshot.perPlayer):state.players.map((name,index)=>makePlayerState(index,name));
        state.listingSequence=Number(snapshot.listingSequence)||state.listings.length;
        state.negotiationSequence=Number(snapshot.negotiationSequence)||state.negotiations.length;
        state.transactionSequence=Number(snapshot.transactionSequence)||0;
        state.startedAt=snapshot.startedAt||Date.now();
        syncStaleListings();
        syncStaleNegotiations();
        emit("restore");
        return true;
    }
    function getExportData(){
        syncStaleListings();
        syncStaleNegotiations();
        return {
            enabled:isEnabled(),
            name:"Galaktyczny Targ",
            config:clone(CONFIG),
            listings:clone(state.listings),
            negotiations:clone(state.negotiations),
            history:clone(state.history),
            perPlayer:state.perPlayer.map((entry,index)=>getPlayerSummary(index)||clone(entry))
        };
    }

    global.TradeMarketEngine=Object.freeze({
        VERSION,
        CONFIG,
        beginDraft,
        reset,
        isEnabled,
        createListing,
        cancelListing,
        buyListing,
        createNegotiation,
        resolveNegotiation,
        onDraftFinished,
        isInstanceReserved:(instanceId)=>isInstanceReserved(instanceId),
        isInstanceInNegotiation:(instanceId)=>negotiationUsesInstance(instanceId),
        getActiveListingForInstance:(instanceId)=>clone(state.listings.find(item=>item.status==="active"&&String(item.cardInstanceId||"")===String(instanceId||""))||null),
        getActiveListings:()=>clone(activeListings()),
        getListings:()=>clone(state.listings),
        getNegotiations:()=>{syncStaleNegotiations();return clone(state.negotiations);},
        getPendingNegotiations:()=>{syncStaleNegotiations();return clone(state.negotiations.filter(item=>item.status==="pending"));},
        getHistory:()=>clone(state.history),
        getPlayerSummary,
        getConfig:()=>clone(CONFIG),
        exportState,
        restoreState,
        getExportData
    });
})(window);
