(function(global){
    "use strict";

    const VERSION="0.4.0-post-draft-market";

    function playerNames(){
        try{return Array.isArray(players)?players.map(name=>String(name||"")):[];}catch(_){return [];}
    }

    function getCurrentPlayer(){
        try{
            const value=typeof getCurrentPlayerIndex==="function"?getCurrentPlayerIndex():null;
            return Number.isInteger(value)?value:null;
        }catch(_){return null;}
    }

    function getTurnKey(){
        try{
            const p=getCurrentPlayer();
            const gc=global.GalacticCurrent?.getState?.();
            if(gc?.active){
                return `galactic:${Number(gc.round)||0}:${Number(gc.pickNumber)||0}:${Number.isInteger(p)?p:"x"}`;
            }
            return `classic:${Number(packStartIndex)||0}:${Number(currentPickIndex)||0}:${Number.isInteger(p)?p:"x"}`;
        }catch(_){return "classic:0:0:x";}
    }

    function isPostDraft(){
        try{return typeof draftFinished!=="undefined"&&Boolean(draftFinished);}catch(_){return false;}
    }

    function getDeckEntries(playerIndex){
        try{
            const p=Number(playerIndex);
            if(!Number.isInteger(p)||!Array.isArray(decks?.[p])) return [];
            return decks[p].map((card,index)=>({card,index})).filter(entry=>entry.card);
        }catch(_){return [];}
    }

    function findEntry(playerIndex,instanceId){
        const id=String(instanceId||"");
        if(!id) return null;
        return getDeckEntries(playerIndex).find(entry=>String(entry.card?.instanceId||"")===id)||null;
    }

    function allLiveCards(){
        try{return (Array.isArray(decks)?decks:[]).flat().filter(Boolean);}catch(_){return [];}
    }

    function createSameCostReplacement(sellerIndex,targetCard,context={}){
        if(!targetCard) return null;
        const exactCost=Number(targetCard.cost);
        const excludeCards=allLiveCards().filter(Boolean);
        try{
            if(typeof generateLegalRuntimeCards==="function"){
                let generated=generateLegalRuntimeCards(1,{
                    exactCost:Number.isFinite(exactCost)?exactCost:null,
                    excludeCards,
                    ignoreCustomPack:false,
                    origin:"trade_market_replacement",
                    sourceEvent:context.sourceEvent||"trade_market_same_cost_replacement"
                });
                if(!generated?.length){
                    generated=generateLegalRuntimeCards(1,{
                        excludeCards,
                        ignoreCustomPack:false,
                        origin:"trade_market_replacement",
                        sourceEvent:"trade_market_fallback_replacement"
                    });
                }
                return generated?.[0]||null;
            }
        }catch(error){console.warn("Trade replacement generation failed",error);}
        return null;
    }

    function archiveTradeRelease(card,playerIndex,metadata={}){
        if(!card) return null;
        try{
            if(typeof archiveCardToGraveyard==="function"){
                return archiveCardToGraveyard("replaced",card,{
                    previousOwner:Number(playerIndex),
                    source:metadata.source||"trade_market_buyer_release",
                    recoverable:true,
                    metadata:{
                        tradeMarket:true,
                        tradeReason:metadata.tradeReason||"buyer_slot_replaced",
                        transactionId:metadata.transactionId||null,
                        acquiredCardInstanceId:metadata.acquiredCardInstanceId||null,
                        acquiredCardName:metadata.acquiredCardName||null
                    }
                });
            }
        }catch(error){console.warn("Trade graveyard archive failed",error);}
        return null;
    }

    function logRuntime(eventType,payload={}){
        try{
            const gc=global.GalacticCurrent?.getState?.();
            const galactic=Boolean(gc?.active);
            global.DraftStateEngine?.log?.(eventType,{
                packNumber:galactic?(Number(gc.round)||0)+1:(Number(packStartIndex)||0)+1,
                pickIndex:galactic?(Number(gc.pickNumber)||0):Number(currentPickIndex)||0,
                playerIndex:Number.isInteger(Number(payload.playerIndex))?Number(payload.playerIndex):null,
                player:Number.isInteger(Number(payload.playerIndex))?playerNames()[Number(payload.playerIndex)]||null:null,
                reason:payload.reason||eventType,
                data:payload.data||{}
            });
        }catch(_){ }
    }

    function refreshDraftUi(){
        try{typeof showDecks==="function"&&showDecks();}catch(_){ }
        try{typeof refreshOpenDeckInspectors==="function"&&refreshOpenDeckInspectors();}catch(_){ }
        try{typeof updateCurrentPickerBanner==="function"&&updateCurrentPickerBanner();}catch(_){ }
        try{typeof updateInfoPanel==="function"&&updateInfoPanel();}catch(_){ }
        try{global.GraveyardUI?.refreshButton?.();}catch(_){ }
        try{global.GrootUI?.refreshProtectionDecorations?.();}catch(_){ }
        try{global.refreshEconomyContextUI?.();}catch(_){ }
        global.dispatchEvent?.(new CustomEvent("trade-market:runtime-refreshed"));
    }

    function validateIndices(buyerIndex,sellerIndex){
        const names=playerNames();
        const buyer=Number(buyerIndex),seller=Number(sellerIndex);
        if(!Number.isInteger(buyer)||!names[buyer]) return {ok:false,reason:"Nie znaleziono kupującego."};
        if(!Number.isInteger(seller)||!names[seller]) return {ok:false,reason:"Nie znaleziono sprzedającego."};
        if(buyer===seller) return {ok:false,reason:"Nie możesz handlować sam ze sobą."};
        return {ok:true,buyer,seller};
    }

    function validateCashTransfer({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId}){
        const base=validateIndices(buyerIndex,sellerIndex);
        if(!base.ok) return base;
        const target=findEntry(base.seller,targetInstanceId);
        if(!target) return {ok:false,reason:"Karta będąca przedmiotem transakcji nie znajduje się już w Panelu Wojownika sprzedającego."};
        const release=findEntry(base.buyer,buyerReleaseInstanceId);
        if(!release) return {ok:false,reason:"Wybierz własną kartę, którą kupowana karta zastąpi w twoim Panelu Wojownika."};
        return {ok:true,...base,target,release};
    }

    function previewCashTransfer({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId}){
        const check=validateCashTransfer({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId});
        if(!check.ok) return check;
        const replacement=createSameCostReplacement(check.seller,check.target.card,{sourceEvent:"trade_market_preview"});
        if(!replacement) return {ok:false,reason:"Nie udało się znaleźć legalnej karty zastępczej dla sprzedającego."};
        return {...check,replacement};
    }

    function previewCoinPurchase({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId}){
        const base=validateIndices(buyerIndex,sellerIndex);
        if(!base.ok) return base;
        const target=findEntry(base.seller,targetInstanceId);
        if(!target) return {ok:false,reason:"Karta będąca przedmiotem negocjacji nie znajduje się już w Panelu Wojownika sprzedającego."};
        const release=findEntry(base.buyer,buyerReleaseInstanceId);
        if(!release) return {ok:false,reason:"Wybierz własną kartę, którą kupowana karta zastąpi w twoim Panelu Wojownika."};
        const replacement=createSameCostReplacement(base.seller,target.card,{sourceEvent:"trade_negotiation_coin_preview"});
        if(!replacement) return {ok:false,reason:"Nie udało się znaleźć legalnej karty zastępczej dla sprzedającego."};
        return {ok:true,...base,target,release,replacement};
    }

    function executeCoinPurchase({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId,transactionId,source="trade_negotiation_coin_purchase"}){
        const check=previewCoinPurchase({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId});
        if(!check.ok) return check;
        const buyerDeck=decks[check.buyer];
        const sellerDeck=decks[check.seller];
        const targetCard=check.target.card;
        const releaseCard=check.release.card;
        const replacement=check.replacement;

        archiveTradeRelease(releaseCard,check.buyer,{
            source,
            tradeReason:"buyer_slot_replaced",
            transactionId,
            acquiredCardInstanceId:targetCard.instanceId||null,
            acquiredCardName:targetCard.name||null
        });

        buyerDeck[check.release.index]=targetCard;
        sellerDeck[check.target.index]=replacement;

        logRuntime("trade_market_coin_purchase",{
            playerIndex:check.buyer,
            reason:source,
            data:{
                transactionId:transactionId||null,
                buyerIndex:check.buyer,
                sellerIndex:check.seller,
                acquiredCardName:targetCard.name||null,
                acquiredCardInstanceId:targetCard.instanceId||null,
                releasedCardName:releaseCard.name||null,
                releasedCardInstanceId:releaseCard.instanceId||null,
                sellerReplacementName:replacement.name||null,
                sellerReplacementInstanceId:replacement.instanceId||null,
                sellerReplacementCost:Number(replacement.cost)
            }
        });
        refreshDraftUi();
        return {ok:true,buyerIndex:check.buyer,sellerIndex:check.seller,targetCard,releaseCard,replacement};
    }

    function executeCashTransfer({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId,transactionId,source="trade_market_sale"}){
        const check=validateCashTransfer({buyerIndex,sellerIndex,targetInstanceId,buyerReleaseInstanceId});
        if(!check.ok) return check;
        const replacement=createSameCostReplacement(check.seller,check.target.card,{sourceEvent:source});
        if(!replacement) return {ok:false,reason:"Nie udało się znaleźć legalnej karty zastępczej dla sprzedającego."};
        const buyerDeck=decks[check.buyer];
        const sellerDeck=decks[check.seller];
        const targetCard=check.target.card;
        const releaseCard=check.release.card;

        archiveTradeRelease(releaseCard,check.buyer,{
            source,
            tradeReason:"buyer_slot_replaced",
            transactionId,
            acquiredCardInstanceId:targetCard.instanceId||null,
            acquiredCardName:targetCard.name||null
        });

        buyerDeck[check.release.index]=targetCard;
        sellerDeck[check.target.index]=replacement;

        logRuntime("trade_market_card_transfer",{
            playerIndex:check.buyer,
            reason:source,
            data:{
                transactionId:transactionId||null,
                buyerIndex:check.buyer,
                sellerIndex:check.seller,
                acquiredCardName:targetCard.name||null,
                acquiredCardInstanceId:targetCard.instanceId||null,
                releasedCardName:releaseCard.name||null,
                releasedCardInstanceId:releaseCard.instanceId||null,
                sellerReplacementName:replacement.name||null,
                sellerReplacementInstanceId:replacement.instanceId||null,
                sellerReplacementCost:Number(replacement.cost)
            }
        });
        refreshDraftUi();
        return {ok:true,buyerIndex:check.buyer,sellerIndex:check.seller,targetCard,releaseCard,replacement};
    }

    function previewCardSwap({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId}){
        const base=validateIndices(buyerIndex,sellerIndex);
        if(!base.ok) return base;
        const target=findEntry(base.seller,targetInstanceId);
        if(!target) return {ok:false,reason:"Karta będąca przedmiotem negocjacji nie znajduje się już u sprzedającego."};
        const offer=findEntry(base.buyer,offerCardInstanceId);
        if(!offer) return {ok:false,reason:"Karta dodana do oferty nie znajduje się już u kupującego."};
        return {ok:true,...base,target,offer};
    }

    function executeCardSwap({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId,transactionId,source="trade_negotiation_swap"}){
        const check=previewCardSwap({buyerIndex,sellerIndex,targetInstanceId,offerCardInstanceId});
        if(!check.ok) return check;
        const buyerDeck=decks[check.buyer];
        const sellerDeck=decks[check.seller];
        const targetCard=check.target.card;
        const offerCard=check.offer.card;
        buyerDeck[check.offer.index]=targetCard;
        sellerDeck[check.target.index]=offerCard;
        logRuntime("trade_market_card_swap",{
            playerIndex:check.buyer,
            reason:source,
            data:{
                transactionId:transactionId||null,
                buyerIndex:check.buyer,
                sellerIndex:check.seller,
                acquiredCardName:targetCard.name||null,
                acquiredCardInstanceId:targetCard.instanceId||null,
                offeredCardName:offerCard.name||null,
                offeredCardInstanceId:offerCard.instanceId||null
            }
        });
        refreshDraftUi();
        return {ok:true,buyerIndex:check.buyer,sellerIndex:check.seller,targetCard,offerCard};
    }

    global.TradeMarketRuntime=Object.freeze({
        VERSION,
        getPlayers:playerNames,
        getCurrentPlayerIndex:getCurrentPlayer,
        getTurnKey,
        isPostDraft,
        getDeckEntries,
        findEntry,
        validateCashTransfer,
        previewCashTransfer,
        executeCashTransfer,
        previewCoinPurchase,
        executeCoinPurchase,
        previewCardSwap,
        executeCardSwap,
        refreshDraftUi
    });
})(window);
