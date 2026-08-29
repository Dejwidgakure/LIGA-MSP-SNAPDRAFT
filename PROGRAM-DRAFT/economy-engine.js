(function(global){
    "use strict";

    const VERSION = "2.7.1-shop-final";
    const CURRENCY = Object.freeze({
        id: "jeff_coin",
        singular: "JeffCoin",
        plural: "JeffCoiny",
        short: "JC"
    });
    const DEFAULT_CONFIG = Object.freeze({
        passivePerNormalPick: 1,
        passivePickCap: 12,
        earlyPhaseMaxPick: 6
    });

    const CORE_SHOP_FALLBACK = Object.freeze([
        {id:"cosmic_exchange",name:"Kosmiczna Wymiana",description:"Wymień 1 kartę i wybierz 1 z 3 kart.",sale:3,standard:4,icon:"↔",category:"repair"},
        {id:"galactic_sift",name:"Galaktyczny Przesiew",description:"Wymień 1 kartę i wybierz 1 z 5 kart.",sale:5,standard:7,icon:"✦",category:"repair"},
        {id:"deep_space_scan",name:"Skan Głębokiej Przestrzeni",description:"Wymień 1 kartę i wybierz 1 z 8 kart.",sale:6,standard:8,icon:"⌁",category:"repair"},
        {id:"low_orbit_scan",name:"Skan Niskiej Orbity",description:"Wymień 1 kartę i wybierz 1 z 3 kart o Koszcie 1–3.",sale:4,standard:5,icon:"◒",category:"scan"},
        {id:"cost_scan",name:"Skan Kosztu",description:"Wybierz dokładny Koszt, potem wybierz 1 z 3 kart tego Kosztu.",sale:5,standard:7,icon:"#",category:"scan"},
        {id:"synergy_scan",name:"Skan Synergii",description:"Wybierz tag/archetyp, potem wybierz 1 z 3 pasujących kart.",sale:6,standard:8,icon:"⌬",category:"scan"},
        {id:"hyperspace_jump",name:"Skok Nadświetlny",description:"Przesuń swój najbliższy przyszły normalny pick o +2 miejsca. Maksymalnie +4.",sale:5,standard:6,icon:"➤",category:"utility"},
        {id:"stellar_shield",name:"Gwiezdna Osłona",description:"Zabezpiecz wybraną własną kartę do końca draftu. Można chronić wiele kart.",sale:3,standard:4,icon:"⬡",category:"utility"},
        {id:"mystery_offer",name:"Tajemnicza Oferta",description:"Zapłać 5 JC i wylosuj jeden produkt sklepu.",sale:5,standard:5,icon:"?",category:"mystery"},
        {id:"graveyard_revival",name:"Kosmiczne Zmartwychwstanie",description:"Wymień własną kartę na jedną z pięciu kart Cmentarzyska.",sale:6,standard:6,icon:"✥",category:"utility"}
    ]);

    function referenceCoreShell(){
        const catalog=global.EconomyCatalogData?.core?.();
        if(!Array.isArray(catalog)||!catalog.length) return CORE_SHOP_FALLBACK;
        const icons={cosmic_exchange:"↔",galactic_sift:"✦",deep_space_scan:"⌁",low_orbit_scan:"◒",cost_scan:"#",synergy_scan:"⌬",hyperspace_jump:"➤",stellar_shield:"⬡",mystery_offer:"?",graveyard_revival:"✥"};
        return catalog.map(product=>({
            id:product.id,
            name:product.name,
            description:product.description,
            sale:Number(product.prices?.sale||0),
            standard:Number(product.prices?.standard||0),
            icon:icons[product.id]||"✦",
            category:product.category||"utility"
        }));
    }

    const CORE_SHOP_SHELL = Object.freeze(referenceCoreShell());

    let state = createEmptyState();
    const products = new Map();
    let purchaseMutex = null;

    function createEmptyState(){
        return {
            version: VERSION,
            enabled: false,
            started: false,
            config: {...DEFAULT_CONFIG},
            players: [],
            wallets: [],
            awardedTurns: {},
            eventLog: [],
            sequence: 0,
            startedAt: null
        };
    }

    function safeClone(value){
        if(value === undefined) return undefined;
        if(typeof structuredClone === "function"){
            try{ return structuredClone(value); }catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizePlayerNames(input){
        return (Array.isArray(input) ? input : []).map((player,index)=>{
            const name = typeof player === "string" ? player : player?.name;
            return String(name || `Gracz ${index+1}`).trim() || `Gracz ${index+1}`;
        });
    }

    function makeWallet(playerName,playerIndex){
        return {
            playerIndex,
            playerName,
            balance: 0,
            totalEarned: 0,
            passiveEarned: 0,
            bonusEarned: 0,
            totalSpent: 0,
            normalPicksCompleted: 0,
            // legacy alias kept for old exports/snapshots; mirrors normalPicksCompleted
            normalPickStarts: 0,
            purchases: [],
            protectedCardInstanceIds: [],
            extensionState: {},
            priceModifiers: [],
            momentum: {pending:0,applied:0,targetKey:null}
        };
    }

    function getWallet(playerIndex){
        const index = Number(playerIndex);
        if(!Number.isInteger(index) || index < 0) return null;
        return state.wallets[index] || null;
    }

    function isEnabled(){
        return Boolean(state.enabled && state.started);
    }

    function getNormalPicksCompleted(wallet){
        if(!wallet) return 0;
        const explicit=Number(wallet.normalPicksCompleted);
        if(Number.isFinite(explicit)) return Math.max(0,explicit);
        return Math.max(0,Number(wallet.normalPickStarts||0));
    }

    function getPhase(playerIndex){
        const wallet = getWallet(playerIndex);
        if(!wallet) return "locked";
        const completed=getNormalPicksCompleted(wallet);
        const salePickCount=Math.max(0,Number(state.config.earlyPhaseMaxPick || 6));
        if(completed < 1) return "pre";
        // SALE obowiązuje w trakcie pierwszych 6 picków. Po sfinalizowaniu 6. picku
        // kolejny ruch tego gracza korzysta już z cen standardowych.
        return completed < salePickCount ? "early" : "late";
    }

    function phaseLabel(phase){
        if(phase === "early") return "COSMIC SALE";
        if(phase === "late") return "CENY STANDARDOWE";
        if(phase === "pre") return "COSMIC SALE • START";
        return "ECONOMY WYŁĄCZONE";
    }

    function log(type,payload={}){
        const event = {
            sequence: ++state.sequence,
            type: String(type || "economy_event"),
            playerIndex: Number.isInteger(payload.playerIndex) ? payload.playerIndex : null,
            playerName: payload.playerName || (Number.isInteger(payload.playerIndex) ? state.players[payload.playerIndex] : null),
            amount: Number(payload.amount || 0),
            balance: Number(payload.balance || 0),
            reason: payload.reason || null,
            turnKey: payload.turnKey || null,
            data: safeClone(payload.data || {}),
            timestamp: Date.now()
        };
        state.eventLog.push(event);
        return event;
    }

    function emitChange(playerIndex,detail={}){
        refreshWalletDom(playerIndex,detail);
        try{
            global.dispatchEvent(new CustomEvent("snapdraft:economy-change",{
                detail:{playerIndex,...safeClone(detail)}
            }));
        }catch(error){}
    }

    function engineLog(type,payload={}){
        try{
            global.DraftStateEngine?.log?.(type,{
                packNumber: payload.packNumber ?? null,
                pickIndex: payload.pickIndex ?? null,
                playerIndex: Number.isInteger(payload.playerIndex) ? payload.playerIndex : null,
                player: Number.isInteger(payload.playerIndex) ? state.players[payload.playerIndex] : null,
                reason: payload.reason || type,
                data:{
                    economyVersion: VERSION,
                    currency: CURRENCY.id,
                    amount: Number(payload.amount || 0),
                    balance: Number(payload.balance || 0),
                    turnKey: payload.turnKey || null,
                    ...(payload.data || {})
                }
            });
        }catch(error){}
    }

    function reset(){
        purchaseMutex = null;
        state = createEmptyState();
        closePanel();
        document.getElementById("economyShopLauncher")?.remove();
        refreshAllWalletDom();
        return exportState();
    }

    function beginDraft(playerNames,options={}){
        const names = normalizePlayerNames(playerNames);
        purchaseMutex = null;
        state = createEmptyState();
        state.enabled = Boolean(options.enabled);
        state.started = true;
        state.config = {
            ...DEFAULT_CONFIG,
            ...(options.config && typeof options.config === "object" ? options.config : {})
        };
        state.players = names;
        state.wallets = names.map((name,index)=>makeWallet(name,index));
        state.startedAt = Date.now();
        log("economy_started",{
            reason: state.enabled ? "enabled" : "disabled",
            data:{players:names.length,config:state.config}
        });
        engineLog("economy_started",{
            reason: state.enabled ? "enabled" : "disabled",
            data:{enabled:state.enabled,players:names.length,config:state.config}
        });
        ensureShopLauncher();
        refreshAllWalletDom();
        return exportState();
    }

    function credit(playerIndex,amount,metadata={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        const wallet = getWallet(playerIndex);
        const value = Math.max(0,Number(amount || 0));
        if(!wallet) return {ok:false,reason:"Nie znaleziono portfela gracza."};
        if(!Number.isFinite(value) || value <= 0) return {ok:false,reason:"Kwota musi być dodatnia."};

        wallet.balance += value;
        wallet.totalEarned += value;
        if(metadata.kind === "passive") wallet.passiveEarned += value;
        else wallet.bonusEarned += value;

        const event = log("jeff_coin_credited",{
            playerIndex,
            amount:value,
            balance:wallet.balance,
            reason:metadata.reason || metadata.kind || "credit",
            turnKey:metadata.turnKey || null,
            data:metadata.data || {}
        });
        engineLog("economy_coin_credited",{
            playerIndex,
            amount:value,
            balance:wallet.balance,
            reason:metadata.reason || metadata.kind || "credit",
            turnKey:metadata.turnKey || null,
            packNumber:metadata.packNumber,
            pickIndex:metadata.pickIndex,
            data:{kind:metadata.kind || "bonus",...(metadata.data || {})}
        });
        emitChange(playerIndex,{type:"credit",amount:value,event});
        return {ok:true,wallet:safeClone(wallet),event};
    }

    function debit(playerIndex,amount,metadata={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        const wallet = getWallet(playerIndex);
        const value = Math.max(0,Number(amount || 0));
        if(!wallet) return {ok:false,reason:"Nie znaleziono portfela gracza."};
        if(!Number.isFinite(value) || value <= 0) return {ok:false,reason:"Kwota musi być dodatnia."};
        if(wallet.balance < value) return {ok:false,reason:"Za mało Jeff Coinów.",required:value,balance:wallet.balance};

        wallet.balance -= value;
        wallet.totalSpent += value;
        const event = log("jeff_coin_spent",{
            playerIndex,
            amount:-value,
            balance:wallet.balance,
            reason:metadata.reason || "purchase",
            data:metadata.data || {}
        });
        engineLog("economy_coin_spent",{
            playerIndex,
            amount:-value,
            balance:wallet.balance,
            reason:metadata.reason || "purchase",
            packNumber:metadata.packNumber,
            pickIndex:metadata.pickIndex,
            data:metadata.data || {}
        });
        emitChange(playerIndex,{type:"debit",amount:value,event});
        return {ok:true,wallet:safeClone(wallet),event};
    }

    function canAfford(playerIndex,amount){
        const wallet = getWallet(playerIndex);
        return Boolean(wallet && wallet.balance >= Math.max(0,Number(amount || 0)));
    }

    function registerNormalPickCompleted(context={}){
        if(!isEnabled()) return {ok:false,skipped:true,reason:"disabled"};
        const playerIndex = Number(context.playerIndex);
        if(!Number.isInteger(playerIndex) || !getWallet(playerIndex)){
            return {ok:false,skipped:true,reason:"invalid_player"};
        }
        const completionKey = String(context.completionKey || context.turnKey || "").trim();
        if(!completionKey) return {ok:false,skipped:true,reason:"missing_completion_key"};
        if(state.awardedTurns[completionKey]){
            return {ok:true,skipped:true,reason:"already_awarded",wallet:safeClone(getWallet(playerIndex))};
        }

        const wallet = getWallet(playerIndex);
        const cap = Math.max(0,Number(state.config.passivePickCap || 12));
        const completedBefore=getNormalPicksCompleted(wallet);
        if(completedBefore >= cap){
            state.awardedTurns[completionKey] = {playerIndex,skipped:true,reason:"passive_cap",timestamp:Date.now()};
            return {ok:true,skipped:true,reason:"passive_cap",wallet:safeClone(wallet)};
        }

        state.awardedTurns[completionKey] = {
            playerIndex,
            mode:context.mode || "classic",
            packNumber:context.packNumber ?? null,
            pickIndex:context.pickIndex ?? null,
            timestamp:Date.now()
        };

        // Momentum jest konsumowane dopiero wtedy, kiedy pick rzeczywiście został wykonany.
        if(wallet.momentum?.pending>0){
            log("economy_momentum_consumed",{
                playerIndex,
                balance:wallet.balance,
                reason:"normal_pick_completed",
                turnKey:completionKey,
                data:{
                    targetKey:wallet.momentum.targetKey||null,
                    requested:Number(wallet.momentum.pending||0),
                    applied:Number(wallet.momentum.applied||0)
                }
            });
            wallet.momentum={pending:0,applied:0,targetKey:null};
        }

        const completed=completedBefore+1;
        wallet.normalPicksCompleted=completed;
        wallet.normalPickStarts=completed; // kompatybilność ze starszym eksportem/UI
        cleanupExpiredPriceModifiers(playerIndex,{source:"normal_pick_completed",completionKey});

        const amount = Math.max(0,Number(state.config.passivePerNormalPick || 1));
        const result = credit(playerIndex,amount,{
            kind:"passive",
            reason:"normal_pick_completed",
            turnKey:completionKey,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{
                mode:context.mode || "classic",
                normalPickNumber:completed,
                phase:getPhase(playerIndex)
            }
        });
        if(!result.ok) return result;

        log("normal_pick_income_awarded",{
            playerIndex,
            amount,
            balance:wallet.balance,
            reason:"normal_pick_completed",
            turnKey:completionKey,
            data:{
                mode:context.mode || "classic",
                normalPickNumber:completed,
                phase:getPhase(playerIndex)
            }
        });
        emitChange(playerIndex,{type:"passive_pick",amount,turnKey:completionKey,pulse:true});
        return {
            ok:true,
            awarded:true,
            amount,
            phase:getPhase(playerIndex),
            wallet:safeClone(wallet)
        };
    }

    // Legacy compatibility only. Rendering/queue refresh must NEVER award currency.
    function syncNormalPickStart(){
        return {ok:true,skipped:true,reason:"deprecated_award_on_pick_completion"};
    }

    function registerProduct(definition={}){
        const id = String(definition.id || "").trim();
        if(!id) throw new Error("Economy product wymaga id.");
        const normalized = {
            id,
            name:String(definition.name || id),
            description:String(definition.description || ""),
            section:String(definition.section || "core"),
            enabled:definition.enabled !== false,
            prices:{
                early:Number(definition.prices?.early ?? definition.price ?? 0),
                late:Number(definition.prices?.late ?? definition.price ?? 0)
            },
            maxPerDraft:Number.isFinite(Number(definition.maxPerDraft)) ? Number(definition.maxPerDraft) : null,
            resolve:typeof definition.resolve === "function" ? definition.resolve : null,
            canPurchase:typeof definition.canPurchase === "function" ? definition.canPurchase : null,
            isVisible:typeof definition.isVisible === "function" ? definition.isVisible : null,
            metadata:safeClone(definition.metadata || {})
        };
        products.set(id,normalized);
        return normalized;
    }

    function unregisterProduct(id){
        return products.delete(String(id || ""));
    }

    function getConfig(){
        return safeClone(state.config);
    }

    function normalizePriceModifier(playerIndex,modifier={}){
        const wallet=getWallet(playerIndex);
        if(!wallet) return null;
        const type=String(modifier.type||"percentage");
        if(!["percentage","flat","fixed"].includes(type)) return null;
        const completed=getNormalPicksCompleted(wallet);
        return {
            id:String(modifier.id||`price-mod-${playerIndex}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
            source:String(modifier.source||"economy"),
            stackGroup:String(modifier.stackGroup||modifier.source||"economy"),
            type,
            factor:Number.isFinite(Number(modifier.factor))?Number(modifier.factor):1,
            amount:Number.isFinite(Number(modifier.amount))?Number(modifier.amount):0,
            fixedPrice:Number.isFinite(Number(modifier.fixedPrice))?Number(modifier.fixedPrice):null,
            minPrice:Math.max(0,Number(modifier.minPrice??1)||0),
            oneShot:modifier.oneShot!==false,
            eligibleProductIds:Array.isArray(modifier.eligibleProductIds)?modifier.eligibleProductIds.map(String):null,
            eligibleSections:Array.isArray(modifier.eligibleSections)?modifier.eligibleSections.map(String):null,
            expiresAfterNormalPickCompleted:Number.isFinite(Number(modifier.expiresAfterNormalPickCompleted))
                ? Number(modifier.expiresAfterNormalPickCompleted)
                : null,
            grantedAtNormalPicks:completed,
            label:String(modifier.label||"PROMOCJA"),
            metadata:safeClone(modifier.metadata||{}),
            createdAt:Date.now()
        };
    }

    function modifierExpired(wallet,modifier){
        if(!wallet||!modifier) return true;
        const expires=Number(modifier.expiresAfterNormalPickCompleted);
        return Number.isFinite(expires)&&getNormalPicksCompleted(wallet)>=expires;
    }

    function cleanupExpiredPriceModifiers(playerIndex,metadata={}){
        const wallet=getWallet(playerIndex);
        if(!wallet) return [];
        wallet.priceModifiers=Array.isArray(wallet.priceModifiers)?wallet.priceModifiers:[];
        const expired=[];
        wallet.priceModifiers=wallet.priceModifiers.filter(modifier=>{
            if(!modifierExpired(wallet,modifier)) return true;
            expired.push(safeClone(modifier));
            return false;
        });
        if(expired.length){
            expired.forEach(modifier=>{
                log("economy_price_modifier_expired",{
                    playerIndex,
                    balance:wallet.balance,
                    reason:modifier.source||"price_modifier",
                    data:{modifier,...safeClone(metadata||{})}
                });
                engineLog("economy_price_modifier_expired",{
                    playerIndex,
                    balance:wallet.balance,
                    reason:modifier.source||"price_modifier",
                    data:{modifier,...safeClone(metadata||{})}
                });
            });
            emitChange(playerIndex,{type:"price_modifier_expired",expired});
        }
        return expired;
    }

    function getActivePriceModifiers(playerIndex){
        cleanupExpiredPriceModifiers(playerIndex,{source:"read"});
        const wallet=getWallet(playerIndex);
        return safeClone(wallet?.priceModifiers||[]);
    }

    function grantPriceModifier(playerIndex,modifier={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        const wallet=getWallet(playerIndex);
        if(!wallet) return {ok:false,reason:"Nie znaleziono portfela gracza."};
        cleanupExpiredPriceModifiers(playerIndex,{source:"grant"});
        wallet.priceModifiers=Array.isArray(wallet.priceModifiers)?wallet.priceModifiers:[];
        const normalized=normalizePriceModifier(playerIndex,modifier);
        if(!normalized) return {ok:false,reason:"Nieprawidłowy modyfikator ceny."};
        if(normalized.stackGroup && wallet.priceModifiers.some(entry=>String(entry.stackGroup||"")===normalized.stackGroup)){
            return {ok:false,reason:"Gracz ma już aktywną promocję tego typu.",code:"modifier_stack_conflict"};
        }
        wallet.priceModifiers.push(normalized);
        log("economy_price_modifier_granted",{
            playerIndex,
            balance:wallet.balance,
            reason:normalized.source,
            data:{modifier:safeClone(normalized)}
        });
        engineLog("economy_price_modifier_granted",{
            playerIndex,
            balance:wallet.balance,
            reason:normalized.source,
            data:{modifier:safeClone(normalized)}
        });
        emitChange(playerIndex,{type:"price_modifier_granted",modifier:normalized});
        return {ok:true,modifier:safeClone(normalized)};
    }

    function modifierEligibleForProduct(modifier,product){
        if(!modifier||!product) return false;
        if(product.metadata?.priceModifiersAllowed===false||product.metadata?.fixedPrice===true) return false;
        if(Array.isArray(modifier.eligibleProductIds)&&modifier.eligibleProductIds.length&&!modifier.eligibleProductIds.includes(String(product.id))) return false;
        if(Array.isArray(modifier.eligibleSections)&&modifier.eligibleSections.length&&!modifier.eligibleSections.includes(String(product.section||"core"))) return false;
        return true;
    }

    function quoteProductPrice(playerIndex,product,phaseOverride=null){
        const wallet=getWallet(playerIndex);
        const phase=phaseOverride||getPhase(playerIndex);
        const basePrice=Math.max(0,Number(phase==="late"?product?.prices?.late:product?.prices?.early)||0);
        if(!wallet||!product) return {basePrice,price:basePrice,modifiers:[]};
        cleanupExpiredPriceModifiers(playerIndex,{source:"quote"});
        let price=basePrice;
        const applied=[];
        for(const modifier of wallet.priceModifiers||[]){
            if(!modifierEligibleForProduct(modifier,product)) continue;
            let next=price;
            if(modifier.type==="percentage") next=Math.ceil(price*Math.max(0,Number(modifier.factor)||0));
            else if(modifier.type==="flat") next=price-Math.max(0,Number(modifier.amount)||0);
            else if(modifier.type==="fixed"&&Number.isFinite(Number(modifier.fixedPrice))) next=Number(modifier.fixedPrice);
            next=Math.max(Number(modifier.minPrice??0)||0,next);
            price=Math.max(0,Math.round(next));
            applied.push(safeClone(modifier));
        }
        return {basePrice,price,modifiers:applied};
    }

    function consumeAppliedPriceModifiers(playerIndex,modifiers=[],metadata={}){
        const wallet=getWallet(playerIndex);
        if(!wallet||!Array.isArray(modifiers)||!modifiers.length) return [];
        wallet.priceModifiers=Array.isArray(wallet.priceModifiers)?wallet.priceModifiers:[];
        const ids=new Set(modifiers.filter(entry=>entry?.oneShot!==false).map(entry=>String(entry.id||"")));
        if(!ids.size) return [];
        const consumed=[];
        wallet.priceModifiers=wallet.priceModifiers.filter(entry=>{
            if(!ids.has(String(entry.id||""))) return true;
            consumed.push(safeClone(entry));
            return false;
        });
        consumed.forEach(modifier=>{
            log("economy_price_modifier_consumed",{
                playerIndex,balance:wallet.balance,reason:modifier.source||"price_modifier",
                data:{modifier,...safeClone(metadata||{})}
            });
            engineLog("economy_price_modifier_consumed",{
                playerIndex,balance:wallet.balance,reason:modifier.source||"price_modifier",
                data:{modifier,...safeClone(metadata||{})}
            });
        });
        return consumed;
    }

    function productVisible(product,playerIndex=null,context={}){
        if(!product?.enabled) return false;
        if(typeof product.isVisible!=="function") return true;
        try{
            return product.isVisible({
                playerIndex:playerIndex!==null&&playerIndex!==undefined&&Number.isInteger(Number(playerIndex))?Number(playerIndex):null,
                wallet:playerIndex!==null&&playerIndex!==undefined&&Number.isInteger(Number(playerIndex))?safeClone(getWallet(Number(playerIndex))):null,
                phase:playerIndex!==null&&playerIndex!==undefined&&Number.isInteger(Number(playerIndex))?getPhase(Number(playerIndex)):null,
                context:safeClone(context||{})
            })!==false;
        }catch(error){
            console.warn("Economy product visibility check failed",product?.id,error);
            return false;
        }
    }

    function getCatalog(playerIndex=null,context={}){
        return [...products.values()].filter(product=>productVisible(product,playerIndex,context)).map(product=>{
            const phase = playerIndex === null ? null : getPhase(playerIndex);
            const quote = playerIndex === null
                ? {basePrice:phase === "late" ? product.prices.late : product.prices.early,price:phase === "late" ? product.prices.late : product.prices.early,modifiers:[]}
                : quoteProductPrice(playerIndex,product,phase);
            return {
                ...product,
                resolve:undefined,
                canPurchase:undefined,
                isVisible:undefined,
                baseQuotedPrice:quote.basePrice,
                quotedPrice:quote.price,
                activePriceModifiers:safeClone(quote.modifiers||[])
            };
        });
    }

    function countPurchases(wallet,productId){
        return (wallet?.purchases || []).filter(entry=>entry.productId === productId).length;
    }

    async function checkPurchase(playerIndex,productId,context={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        const wallet=getWallet(playerIndex);
        const product=products.get(String(productId||""));
        if(!wallet) return {ok:false,reason:"Nie znaleziono portfela."};
        if(!product||!productVisible(product,playerIndex,context)) return {ok:false,reason:"Produkt nie jest dostępny przy obecnych rozszerzeniach."};
        const accessCheck=global.DraftEconomyBridge?.canShopPlayer?.(playerIndex);
        if(accessCheck===false) return {ok:false,reason:"Podczas draftu kupować może wyłącznie aktywny gracz."};
        if(accessCheck&&accessCheck.ok===false) return accessCheck;
        const phase=getPhase(playerIndex);
        if(phase!=="early"&&phase!=="late") return {ok:false,reason:"Sklep nie jest jeszcze aktywny dla tego gracza."};
        if(product.maxPerDraft!==null&&countPurchases(wallet,product.id)>=product.maxPerDraft){
            return {ok:false,reason:"Osiągnięto limit zakupu tego produktu."};
        }
        if(product.canPurchase){
            const allowed=await product.canPurchase({playerIndex,wallet:safeClone(wallet),phase,context,snapshot:exportState()});
            if(allowed===false) return {ok:false,reason:"Zakup jest teraz niedostępny."};
            if(allowed&&allowed.ok===false) return allowed;
        }
        const quote=quoteProductPrice(playerIndex,product,phase);
        const price=quote.price;
        if(!canAfford(playerIndex,price)) return {ok:false,reason:"Za mało JeffCoinów.",price,basePrice:quote.basePrice,balance:wallet.balance,priceModifiers:quote.modifiers};
        return {ok:true,price,basePrice:quote.basePrice,phase,balance:wallet.balance,productId:product.id,priceModifiers:quote.modifiers};
    }

    async function purchase(playerIndex,productId,context={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        if(purchaseMutex){
            return {ok:false,reason:"Najpierw dokończ bieżący zakup w Jeff's Cosmic Shop."};
        }

        const mutexToken=`economy-purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        purchaseMutex=mutexToken;
        let draftTransaction=null;
        let localBefore=null;
        let transactionFinished=false;

        const rollbackPurchase=(metadata={})=>{
            if(transactionFinished) return false;
            transactionFinished=true;
            if(draftTransaction?.ok && draftTransaction.transactionId && global.DraftFoundation?.rollbackTransaction){
                return Boolean(global.DraftFoundation.rollbackTransaction(draftTransaction.transactionId,{
                    source:"economy_purchase",
                    ...safeClone(metadata)
                }));
            }
            if(localBefore){
                restoreState(localBefore);
                return true;
            }
            return false;
        };

        const commitPurchase=(metadata={})=>{
            if(transactionFinished) return false;
            transactionFinished=true;
            if(draftTransaction?.ok && draftTransaction.transactionId && global.DraftFoundation?.commitTransaction){
                return Boolean(global.DraftFoundation.commitTransaction(draftTransaction.transactionId,{
                    source:"economy_purchase",
                    ...safeClone(metadata)
                }));
            }
            return true;
        };

        try{
            const wallet = getWallet(playerIndex);
            const product = products.get(String(productId || ""));
            if(!wallet) return {ok:false,reason:"Nie znaleziono portfela."};
            if(!product || !productVisible(product,playerIndex,context)) return {ok:false,reason:"Produkt nie jest dostępny przy obecnych rozszerzeniach."};
            const accessCheck=global.DraftEconomyBridge?.canShopPlayer?.(playerIndex);
            if(accessCheck===false) return {ok:false,reason:"Podczas draftu kupować może wyłącznie aktywny gracz."};
            if(accessCheck && accessCheck.ok===false) return accessCheck;
            const phase = getPhase(playerIndex);
            if(phase !== "early" && phase !== "late") return {ok:false,reason:"Sklep nie jest jeszcze aktywny dla tego gracza."};
            if(product.maxPerDraft !== null && countPurchases(wallet,product.id) >= product.maxPerDraft){
                return {ok:false,reason:"Osiągnięto limit zakupu tego produktu."};
            }
            if(product.canPurchase){
                const allowed = await product.canPurchase({playerIndex,wallet:safeClone(wallet),phase,context,snapshot:exportState()});
                if(allowed === false) return {ok:false,reason:"Zakup jest teraz niedostępny."};
                if(allowed && allowed.ok === false) return allowed;
            }
            const priceQuote=quoteProductPrice(playerIndex,product,phase);
            const price=priceQuote.price;
            if(!canAfford(playerIndex,price)) return {ok:false,reason:"Za mało JeffCoinów.",price,basePrice:priceQuote.basePrice,balance:wallet.balance,priceModifiers:priceQuote.modifiers};

            // E2.1B: cały zakup jest jedną atomową transakcją draftu.
            // Snapshot Foundation obejmuje decki, Graveyard, kolejkę, logi, Supermoce i Economy.
            localBefore=exportState();
            if(global.DraftFoundation?.beginTransaction){
                draftTransaction=global.DraftFoundation.beginTransaction("economy_purchase",{
                    playerIndex,
                    playerName:state.players[playerIndex]||null,
                    productId:product.id,
                    productName:product.name,
                    phase,
                    price,
                    basePrice:priceQuote.basePrice,
                    priceModifiers:safeClone(priceQuote.modifiers||[])
                });
                if(draftTransaction?.ok===false){
                    return {ok:false,reason:draftTransaction.reason||"Najpierw dokończ bieżące rozstrzygnięcie."};
                }
            }

            const debitResult = debit(playerIndex,price,{reason:`purchase:${product.id}`,data:{productId:product.id,phase}});
            if(!debitResult.ok){
                rollbackPurchase({reason:"debit_failed",productId:product.id});
                return debitResult;
            }

            const result = product.resolve
                ? await product.resolve({playerIndex,price,phase,context,wallet:safeClone(getWallet(playerIndex))})
                : {ok:true};

            if(result === false || result?.ok === false){
                rollbackPurchase({
                    reason:result?.reason||"purchase_cancelled",
                    productId:product.id,
                    cancelled:true
                });
                return result && typeof result === "object" ? result : {ok:false,reason:"Zakup anulowany."};
            }

            const consumedPriceModifiers=consumeAppliedPriceModifiers(playerIndex,priceQuote.modifiers,{
                productId:product.id,
                productName:product.name,
                phase,
                basePrice:priceQuote.basePrice,
                finalPrice:price
            });
            getWallet(playerIndex).purchases.push({
                productId:product.id,
                productName:product.name,
                price,
                basePrice:priceQuote.basePrice,
                priceModifiers:safeClone(consumedPriceModifiers),
                phase,
                timestamp:Date.now(),
                data:safeClone(result?.data || {})
            });
            log("economy_purchase_completed",{
                playerIndex,
                amount:-price,
                balance:getWallet(playerIndex).balance,
                reason:product.id,
                data:{productId:product.id,phase,basePrice:priceQuote.basePrice,priceModifiers:safeClone(consumedPriceModifiers)}
            });
            engineLog("economy_purchase_completed",{
                playerIndex,
                amount:-price,
                balance:getWallet(playerIndex).balance,
                reason:product.id,
                data:{productId:product.id,phase,basePrice:priceQuote.basePrice,priceModifiers:safeClone(consumedPriceModifiers)}
            });

            if(!commitPurchase({reason:"completed",productId:product.id,price,phase})){
                throw new Error("Nie udało się zatwierdzić transakcji zakupu.");
            }

            emitChange(playerIndex,{type:"purchase",productId:product.id,price,basePrice:priceQuote.basePrice,priceModifiers:consumedPriceModifiers});
            return {ok:true,productId:product.id,price,basePrice:priceQuote.basePrice,priceModifiers:consumedPriceModifiers,phase,result};
        }catch(error){
            rollbackPurchase({reason:"exception",message:error?.message||String(error||""),productId:String(productId||"")});
            return {ok:false,reason:error?.message || "Zakup nie został ukończony.",error};
        }finally{
            if(purchaseMutex===mutexToken) purchaseMutex=null;
        }
    }

    function exportState(){
        return safeClone(state);
    }

    function restoreState(payload){
        if(!payload || typeof payload !== "object") return false;
        const restored = safeClone(payload);
        state = {
            ...createEmptyState(),
            ...restored,
            config:{...DEFAULT_CONFIG,...(restored.config || {})},
            players:Array.isArray(restored.players) ? restored.players : [],
            wallets:Array.isArray(restored.wallets) ? restored.wallets : [],
            awardedTurns:restored.awardedTurns && typeof restored.awardedTurns === "object" ? restored.awardedTurns : {},
            eventLog:Array.isArray(restored.eventLog) ? restored.eventLog : []
        };
        state.wallets=state.wallets.map((wallet,index)=>{
            const base={
                ...makeWallet(state.players[index]||wallet?.playerName||`Gracz ${index+1}`,index),
                ...(wallet||{}),
                protectedCardInstanceIds:Array.isArray(wallet?.protectedCardInstanceIds)?wallet.protectedCardInstanceIds:[],
                extensionState:(wallet?.extensionState&&typeof wallet.extensionState==="object")?safeClone(wallet.extensionState):{},
                priceModifiers:Array.isArray(wallet?.priceModifiers)?safeClone(wallet.priceModifiers):[],
                momentum:{pending:0,applied:0,targetKey:null,...(wallet?.momentum||{})}
            };
            const completed=Number.isFinite(Number(wallet?.normalPicksCompleted))
                ? Math.max(0,Number(wallet.normalPicksCompleted))
                : Math.max(0,Number(wallet?.normalPickStarts||0));
            base.normalPicksCompleted=completed;
            base.normalPickStarts=completed;
            return base;
        });
        ensureShopLauncher();
        refreshAllWalletDom();
        refreshOpenPanel();
        return true;
    }

    function getExportData(){
        return {
            version:VERSION,
            enabled:isEnabled(),
            currency:{...CURRENCY},
            config:safeClone(state.config),
            players:state.wallets.map(wallet=>({
                playerIndex:wallet.playerIndex,
                playerName:wallet.playerName,
                balance:wallet.balance,
                totalEarned:wallet.totalEarned,
                passiveEarned:wallet.passiveEarned,
                bonusEarned:wallet.bonusEarned,
                totalSpent:wallet.totalSpent,
                normalPicks:getNormalPicksCompleted(wallet),
                phase:getPhase(wallet.playerIndex),
                protectedCardInstanceIds:safeClone(wallet.protectedCardInstanceIds||[]),
                extensionState:safeClone(wallet.extensionState||{}),
                priceModifiers:safeClone(wallet.priceModifiers||[]),
                momentum:safeClone(wallet.momentum||{pending:0,applied:0,targetKey:null}),
                purchases:safeClone(wallet.purchases || [])
            })),
            eventLog:safeClone(state.eventLog)
        };
    }

    function coinMarkup(){
        return `<span class="jeff-coin-icon" aria-hidden="true"><img src="draft-assets/jeffcoin.png" alt="" onerror="this.onerror=null;this.src=\'draft-assets/jeff_normal.png\';"></span>`;
    }

    function playJeffCoinAward(playerIndex,amount,options={}){
        if(typeof document==="undefined") return false;
        const value=Math.max(0,Number(amount)||0);
        if(!value) return false;
        const target=[...document.querySelectorAll(`[data-economy-wallet-player="${Number(playerIndex)}"]`)]
            .find(node=>node.offsetParent!==null)||null;
        const source=String(options.source||"");
        const label=String(options.label||"JEFFCOINY");

        if(source==="bounty"){
            const root=document.createElement("div");
            root.className="economy-jeffcoin-award-flight is-bounty-award";
            root.innerHTML=`
                <img class="economy-bounty-award-static-coin" src="draft-assets/jeffcoin.png" alt="">
                <div class="economy-award-label">
                    <span>${label}</span>
                    <strong>+${value} JC</strong>
                </div>`;
            document.body.appendChild(root);
            requestAnimationFrame(()=>root.classList.add("is-visible"));

            setTimeout(()=>{
                if(!document.body.contains(root)) return;
                const sourceNode=root.querySelector(".economy-bounty-award-static-coin");
                const sourceRect=sourceNode?.getBoundingClientRect?.();
                const targetRect=target?.getBoundingClientRect?.();
                const fromX=sourceRect ? sourceRect.left+sourceRect.width/2 : (global.innerWidth||1000)/2;
                const fromY=sourceRect ? sourceRect.top+sourceRect.height/2 : (global.innerHeight||800)/2;
                const toX=targetRect ? targetRect.left+targetRect.width/2 : fromX;
                const toY=targetRect ? targetRect.top+targetRect.height/2 : fromY+150;
                const burst=document.createElement("div");
                burst.className="economy-bounty-coin-burst";
                const fan=[[-28,-12],[-14,14],[0,-18],[16,10],[30,-8]];
                burst.innerHTML=fan.map((offset,index)=>{
                    const dx=toX-fromX;
                    const dy=toY-fromY;
                    return `<img src="draft-assets/jeffcoin.png" alt="" style="--coin-from-x:${fromX}px;--coin-from-y:${fromY}px;--coin-dx:${dx}px;--coin-dy:${dy}px;--coin-fan-x:${offset[0]}px;--coin-fan-y:${offset[1]}px;--coin-delay:${index*45}ms">`;
                }).join("");
                document.body.appendChild(burst);
                requestAnimationFrame(()=>burst.classList.add("is-flying"));
                setTimeout(()=>{
                    if(target){
                        target.classList.remove("bounty-award-arrival-pulse");
                        void target.offsetWidth;
                        target.classList.add("bounty-award-arrival-pulse");
                        setTimeout(()=>target.classList.remove("bounty-award-arrival-pulse"),720);
                    }
                },900);
                setTimeout(()=>burst.remove(),1420);
            },860);

            setTimeout(()=>root.classList.add("is-leaving"),2150);
            setTimeout(()=>root.remove(),2580);
            return true;
        }

        const startX=global.innerWidth?global.innerWidth/2:500;
        const startY=global.innerHeight?global.innerHeight/2:400;
        const rect=target?.getBoundingClientRect?.();
        const targetX=rect?rect.left+rect.width/2:startX;
        const targetY=rect?rect.top+rect.height/2:startY+160;
        const root=document.createElement("div");
        root.className="economy-jeffcoin-award-flight";
        root.style.setProperty("--award-dx",`${targetX-startX}px`);
        root.style.setProperty("--award-dy",`${targetY-startY}px`);
        const coins=Array.from({length:5},(_,index)=>`<img src="draft-assets/jeffcoin.png" alt="" data-award-coin="${index}">`).join("");
        root.innerHTML=`<div class="economy-award-label"><span>${label}</span><strong>+${value} JC</strong></div><div class="economy-award-coins">${coins}</div>`;
        document.body.appendChild(root);
        requestAnimationFrame(()=>root.classList.add("is-flying"));
        setTimeout(()=>root.remove(),1650);
        return true;
    }

    function createWalletWidget(playerIndex){
        if(!isEnabled()) return null;
        const wallet = getWallet(playerIndex);
        if(!wallet || typeof document === "undefined") return null;
        const row = document.createElement("div");
        row.className = "economy-wallet-strip economy-wallet-compact";
        row.dataset.economyWalletPlayer = String(playerIndex);
        row.innerHTML = `
            <div class="economy-wallet-main" title="JeffCoiny: ${wallet.balance}">
                ${coinMarkup()}
                <b class="economy-wallet-balance" data-economy-balance>${wallet.balance}</b>
            </div>`;
        return row;
    }

    function refreshWalletDom(playerIndex,detail={}){
        if(typeof document === "undefined") return;
        const wallet = getWallet(playerIndex);
        document.querySelectorAll(`[data-economy-wallet-player="${Number(playerIndex)}"]`).forEach(node=>{
            const balance = node.querySelector("[data-economy-balance]");
            if(balance) balance.textContent = wallet ? String(wallet.balance) : "0";
            const main=node.querySelector(".economy-wallet-main");
            if(main) main.title=`JeffCoiny: ${wallet ? wallet.balance : 0}`;
            if(detail.pulse){
                node.classList.remove("economy-income-pulse");
                void node.offsetWidth;
                node.classList.add("economy-income-pulse");
                setTimeout(()=>node.classList.remove("economy-income-pulse"),850);
            }
        });
        refreshOpenPanel();
        refreshShopLauncher();
        try{ global.refreshEconomyContextUI?.(playerIndex); }catch(error){}
    }

    function refreshAllWalletDom(){
        if(typeof document === "undefined") return;
        state.wallets.forEach((wallet,index)=>refreshWalletDom(index));
        refreshShopLauncher();
    }

    function getCurrentShopPlayerIndex(){
        try{
            const index=global.getCurrentPlayerIndex?.();
            return Number.isInteger(index) ? index : null;
        }catch(error){ return null; }
    }

    function ensureShopLauncher(){
        if(typeof document === "undefined" || !isEnabled()) return null;
        let root=document.getElementById("economyShopLauncher");
        if(root) return root;
        root=document.createElement("div");
        root.id="economyShopLauncher";
        root.innerHTML=`
            <button type="button" class="economy-shop-launcher-button" aria-label="Otwórz Jeff’s Cosmic Shop">
                <img class="economy-shop-launcher-art" src="draft-assets/cosmic_shop_planet.png" alt="" onerror="this.hidden=true;this.closest('button')?.classList.add('asset-missing')">
                <img class="economy-shop-launcher-coin" src="draft-assets/jeffcoin.png" alt="" aria-hidden="true" onerror="this.hidden=true">
                <span class="economy-shop-launcher-label">SKLEP</span>
            </button>`;
        const dock=document.getElementById("shopDockSlot") || document.getElementById("draftBottomDock");
        dock?.appendChild(root);
        root.querySelector("button")?.addEventListener("click",event=>{
            event.preventDefault();
            event.stopPropagation();
            const playerIndex=getCurrentShopPlayerIndex();
            if(Number.isInteger(playerIndex)) openPanel(playerIndex);
            else openPlayerChooser();
        });
        refreshShopLauncher();
        return root;
    }

    function refreshShopLauncher(){
        if(typeof document === "undefined") return;
        const root=document.getElementById("economyShopLauncher");
        if(!root) return;
        root.hidden=!isEnabled();
        if(root.hidden) return;
        const playerIndex=getCurrentShopPlayerIndex();
        const wallet=Number.isInteger(playerIndex) ? getWallet(playerIndex) : null;
        const balance=root.querySelector("[data-shop-launcher-balance]");
        const ribbon=root.querySelector("[data-shop-sale-ribbon]");
        if(balance) balance.textContent=wallet ? String(wallet.balance) : "…";
        const phase=wallet ? getPhase(playerIndex) : "late";
        if(ribbon) ribbon.hidden=phase!=="early" && phase!=="pre";
        root.classList.toggle("is-sale",phase==="early"||phase==="pre");
        root.classList.toggle("is-post-draft",!Number.isInteger(playerIndex));
    }

    function openPlayerChooser(){
        if(!isEnabled() || typeof document === "undefined") return false;
        document.getElementById("economyPlayerChooserOverlay")?.remove();
        const overlay=document.createElement("div");
        overlay.id="economyPlayerChooserOverlay";
        overlay.className="economy-player-chooser-overlay";
        overlay.innerHTML=`
            <section class="economy-player-chooser" role="dialog" aria-modal="true" aria-label="Wybierz portfel JeffCoin">
                <button class="economy-player-chooser-close" type="button" aria-label="Zamknij">×</button>
                <small>KOSMICZNY SKLEP • PO DRAFCIE</small>
                <h3>Wybierz gracza</h3>
                <div class="economy-player-chooser-grid"></div>
            </section>`;
        const grid=overlay.querySelector(".economy-player-chooser-grid");
        state.wallets.forEach(wallet=>{
            const btn=document.createElement("button");
            btn.type="button";
            btn.innerHTML=`<b>${escapeHtml(wallet.playerName)}</b><span>${coinMarkup()} ${wallet.balance} JC</span>`;
            btn.addEventListener("click",()=>{ overlay.remove(); openPanel(wallet.playerIndex); });
            grid.appendChild(btn);
        });
        document.body.appendChild(overlay);
        const close=()=>overlay.remove();
        overlay.addEventListener("mousedown",event=>{ if(event.target===overlay) close(); });
        overlay.querySelector(".economy-player-chooser-close")?.addEventListener("click",close);
        return true;
    }

    function ensurePanel(){
        if(typeof document === "undefined") return null;
        let overlay = document.getElementById("economyShopOverlay");
        if(overlay) return overlay;
        overlay = document.createElement("div");
        overlay.id = "economyShopOverlay";
        overlay.className = "economy-shop-overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="economy-shop-panel economy-shop-v2" role="dialog" aria-modal="true" aria-labelledby="economyShopTitle">
                <h2 id="economyShopTitle" class="economy-shop-a11y-title">Jeff’s Cosmic Shop</h2>
                <button type="button" class="economy-shop-close" aria-label="Wyjdź ze sklepu">
                    <img class="economy-shop-exit-frame" src="draft-assets/shop_exit_tile.png" alt="" aria-hidden="true" onerror="this.hidden=true">
                    <span class="economy-shop-exit-cart" aria-hidden="true">🛒</span><span>WYJDŹ</span><i aria-hidden="true">↗</i>
                </button>

                <div class="economy-shop-title-sparkles" aria-hidden="true">
                    <i></i><i></i><i></i><i></i><i></i><i></i>
                </div>

                <header class="economy-shop-header">
                    <div class="economy-shop-customer-card" aria-label="Aktualny klient sklepu">
                        <img class="economy-shop-customer-frame" src="draft-assets/shop_customer_panel.png" alt="" aria-hidden="true" onerror="this.hidden=true">
                        <small>AKTUALNY KLIENT</small>
                        <b data-economy-customer-player>—</b>
                    </div>
                    <div class="economy-shop-balance-card" aria-label="Saldo JeffCoinów">
                        <img class="economy-shop-balance-frame" src="draft-assets/shop_wallet_panel_v2.png" alt="" aria-hidden="true" onerror="this.hidden=true">
                        <div class="economy-shop-balance-value">
                            <img class="economy-shop-balance-coin" src="draft-assets/jeffcoin.png" alt="JeffCoin" onerror="this.hidden=true">
                            <b data-economy-panel-balance>0</b>
                        </div>
                        <span data-economy-panel-player hidden></span>
                    </div>
                </header>

                <div class="economy-shop-ambient-coins" aria-hidden="true">
                    <img class="economy-shop-coin-swirl" src="draft-assets/shop_coin_swirl_fx.png" alt="">
                    <img class="economy-shop-floating-coin coin-1" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-2" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-3" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-4" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-5" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-6" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-7" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-8" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-9" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-10" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-11" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-12" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-13" src="draft-assets/jeffcoin.png" alt="">
                    <img class="economy-shop-floating-coin coin-14" src="draft-assets/jeffcoin.png" alt="">
                </div>

                <div class="economy-shop-sale-banner" data-economy-sale-banner hidden>
                    <img src="draft-assets/cosmic_sale_banner.png" alt="COSMIC SALE — pierwsze 6 picków" onerror="this.parentElement.hidden=true">
                </div>

                <nav class="economy-shop-pages" data-economy-shop-pages hidden>
                    <button type="button" class="economy-shop-page-arrow economy-shop-page-prev" data-economy-page-prev aria-label="Poprzednia strona">
                        <img src="draft-assets/shop_page_arrow_left.png" alt="">
                    </button>
                    <span data-economy-page-label>CORE SHOP</span>
                    <button type="button" class="economy-shop-page-arrow economy-shop-page-next" data-economy-page-next aria-label="Następna strona">
                        <img src="draft-assets/shop_page_arrow_right.png" alt="">
                    </button>
                </nav>

                <div class="economy-core-grid" data-economy-catalog></div>

                <footer class="economy-shop-footer">
                    <div class="economy-shop-purchase-summary" data-economy-purchase-summary>
                        <div class="economy-shop-purchase-heading">
                            <small>ZAKUPY ŁĄCZNIE</small>
                            <span data-economy-last-purchase-meta hidden></span>
                        </div>
                        <div class="economy-shop-purchase-details">
                            <b data-economy-last-purchase-name>0</b>
                            <div class="economy-shop-purchase-list" data-economy-purchase-list hidden></div>
                        </div>
                        <img class="economy-shop-purchase-cart" src="draft-assets/shop_purchase_cart.png" alt="" aria-hidden="true" onerror="this.hidden=true">
                    </div>
                    <div class="economy-shop-standard-status" data-economy-standard-status>
                        <b>CENY STANDARDOWE</b>
                        <span>Specjalne okazje mogą pojawić się podczas draftu.</span>
                    </div>
                    <div class="economy-shop-live-status" data-economy-live-status>
                        <b>GODZINY OTWARCIA SKLEPU</b>
                        <span>Kupuj podczas swojej tury. Sklep jest otwarty w późnych godzinach po skończeniu draftu.</span>
                    </div>
                    <span data-economy-sale-progress hidden><b data-economy-panel-progress>0/6</b></span>
                    <span data-economy-post-draft hidden></span>
                    <span data-economy-panel-phase hidden></span>
                </footer>
            </section>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener("mousedown",event=>{
            if(event.target === overlay && !document.getElementById("economyFlowOverlay") && document.getElementById("jokerV2ResolveModal")?.hidden !== false) closePanel();
        });
        const closeButton=overlay.querySelector(".economy-shop-close");
        closeButton?.addEventListener("pointerdown",event=>event.stopPropagation());
        closeButton?.addEventListener("click",event=>{ event.preventDefault(); event.stopPropagation(); closePanel(); });
        const changePage=delta=>{
            const playerIndex=Number(overlay.dataset.playerIndex);
            const catalog=getCatalog(playerIndex);
            const hasExtensions=catalog.some(product=>product.section==="extensions");
            const pages=hasExtensions?["core","extensions"]:["core"];
            const current=pages.includes(overlay.dataset.shopPage)?overlay.dataset.shopPage:"core";
            const index=pages.indexOf(current);
            overlay.dataset.shopPage=pages[(index+delta+pages.length)%pages.length];
            refreshOpenPanel();
        };
        [overlay.querySelector("[data-economy-page-prev]"),overlay.querySelector("[data-economy-page-next]")].forEach(button=>{
            button?.addEventListener("pointerdown",event=>event.stopPropagation());
        });
        overlay.querySelector("[data-economy-page-prev]")?.addEventListener("click",event=>{ event.preventDefault(); event.stopPropagation(); changePage(-1); });
        overlay.querySelector("[data-economy-page-next]")?.addEventListener("click",event=>{ event.preventDefault(); event.stopPropagation(); changePage(1); });
        overlay.querySelector("[data-economy-catalog]")?.addEventListener("click",async event=>{
            const button=event.target.closest?.("[data-economy-buy]");
            if(!button || button.disabled) return;
            const playerIndex=Number(overlay.dataset.playerIndex);
            const productId=button.dataset.economyBuy;
            button.disabled=true;
            button.classList.add("is-resolving");
            const result=await purchase(playerIndex,productId,{source:"shop_ui"});
            button.classList.remove("is-resolving");
            if(!result?.ok){
                const message=result?.reason||result?.message||"Zakup nie został ukończony.";
                global.EconomyShopCore?.showFeedback?.(message,"error");
            }else{
                const purchasedProduct=getCatalog(playerIndex).find(product=>String(product.id)===String(productId));
                global.EconomyShopCore?.showCheckout?.(result.price,purchasedProduct?.name||"TRANSAKCJA ZAKOŃCZONA");
                global.EconomyShopCore?.showFeedback?.("Zakup zakończony.","success");
            }
            refreshOpenPanel();
            refreshShopLauncher();
        });
        document.addEventListener("keydown",event=>{
            if(event.key !== "Escape" || overlay.hidden) return;
            if(document.getElementById("economyFlowOverlay")) return;
            if(document.getElementById("jokerV2ResolveModal")?.hidden === false) return;
            closePanel();
        });
        return overlay;
    }

    function productPresentation(product){
        const reference=global.EconomyCatalogData?.get?.(product?.id)||{};
        return {
            art:String(product?.metadata?.artAsset||reference.artAsset||""),
            accent:String(product?.metadata?.accent||reference.accent||"#53d8ff"),
            badge:String(product?.metadata?.badge||reference.badge||""),
            standardPrice:Number(reference.prices?.standard??product?.prices?.late??product?.quotedPrice??0)
        };
    }

    function coreCatalogMarkup(playerIndex,page="core"){
        const phase=getPhase(playerIndex);
        const catalog = getCatalog(playerIndex)
            .filter(product=>String(product.section||"core")===(page==="extensions"?"extensions":"core"))
            .sort((a,b)=>page==="core" ? Number(a.id==="graveyard_revival")-Number(b.id==="graveyard_revival") : 0);
        const wallet=getWallet(playerIndex);
        if(catalog.length){
            const renderProduct=(product,index)=>{
                const price=Number(product.quotedPrice||0);
                const affordable=Boolean(wallet && wallet.balance>=price);
                const presentation=productPresentation(product);
                const extensionBadge=product?.metadata?.extensionBadge||null;
                const extensionMarkup=extensionBadge?`<span class="economy-extension-seal" style="--extension-glow:${escapeHtml(extensionBadge.color||"#8cf7ff")}">${extensionBadge.icon?`<img src="${escapeHtml(extensionBadge.icon)}" alt="" onerror="this.hidden=true">`:""}<b>${escapeHtml(extensionBadge.label||"DODATEK")}</b></span>`:"";
                const modified=Number(product.baseQuotedPrice||price)!==price && Array.isArray(product.activePriceModifiers) && product.activePriceModifiers.length;
                const modifierLabel=modified?escapeHtml(product.activePriceModifiers.map(entry=>entry.label||"PROMOCJA").join(" • ")):"";
                const bountyFlashSale=modified&&product.activePriceModifiers.some(entry=>String(entry?.source||"")==="bounty"||String(entry?.stackGroup||"")==="bounty_flash_sale");
                const introSale=(phase==="early"||phase==="pre") && presentation.standardPrice>Number(product.baseQuotedPrice||price);
                const comparisonPrice=modified?Number(product.baseQuotedPrice||price):(introSale?presentation.standardPrice:null);
                const promoLabel=modified?(bountyFlashSale?"FLASH SALE −50%":modifierLabel):(introSale?"COSMIC SALE":"");
                const artMarkup=presentation.art?`<img class="economy-product-v2-art" src="${escapeHtml(presentation.art)}" alt="" loading="eager" onerror="this.hidden=true;this.closest('.economy-product-card')?.classList.add('asset-missing')">`:"";
                const titleLength=String(product.name||"").length;
                const titleFit=titleLength>=27?"is-title-very-long":(titleLength>=20?"is-title-long":"is-title-short");
                return `
                    <button type="button"
                        class="economy-core-card economy-product-card economy-product-card-v2 is-live ${presentation.art?"expects-asset":"asset-missing"} ${extensionBadge?"is-extension-product":""} ${introSale||modified?"is-sale":""} ${modified?"is-price-modified":""} ${affordable?"is-affordable":"is-unaffordable"}"
                        style="--product-accent:${escapeHtml(presentation.accent)}"
                        data-economy-buy="${escapeHtml(product.id)}"
                        data-product-index="${index}"
                        ${affordable?"":"disabled"}
                        aria-label="${escapeHtml(product.name)}"
                        aria-disabled="${affordable?"false":"true"}">
                        <span class="economy-product-v2-title ${titleFit}"><strong>${escapeHtml(product.name)}</strong></span>
                        <span class="economy-product-v2-art-wrap">${artMarkup}${extensionMarkup}</span>
                        <span class="economy-product-v2-copy">${escapeHtml(product.description)}</span>
                        <span class="economy-product-v2-price-zone ${promoLabel?"has-promo":"no-promo"}">
                            ${promoLabel?(
                                introSale && !modified
                                    ? `<em class="economy-product-v2-promo is-cosmic-sale-ribbon" aria-label="COSMIC SALE"><img src="draft-assets/cosmic_sale_product_ribbon.png" alt="COSMIC SALE"></em>`
                                    : `<em class="economy-product-v2-promo ${bountyFlashSale?"is-bounty-flash-sale":""}">${promoLabel}</em>`
                            ):""}
                            <span class="economy-product-v2-price">${coinMarkup()}<strong>${price}</strong>${comparisonPrice!==null?`<del>${comparisonPrice}</del>`:""}</span>
                        </span>
                        ${presentation.badge?`<span class="economy-product-v2-badge">${escapeHtml(presentation.badge)}</span>`:""}
                        <span class="economy-product-state" data-economy-product-state>${affordable?"KUP":"ZA MAŁO JC"}</span>
                    </button>`;
            };
            if(page==="extensions"){
                return `<div class="economy-product-row economy-product-row-extensions">${catalog.map(renderProduct).join("")}</div>`;
            }
            const first=catalog.slice(0,5).map(renderProduct).join("");
            const second=catalog.slice(5,10).map((product,index)=>renderProduct(product,index+5)).join("");
            return `<div class="economy-product-row economy-product-row-primary">${first}</div><div class="economy-product-row economy-product-row-secondary">${second}</div>`;
        }
        const sale=phase==="early"||phase==="pre";
        return `<div class="economy-product-row economy-product-row-primary economy-fallback-row">${CORE_SHOP_SHELL.slice(0,4).map(product=>{
            const price=sale ? product.sale : product.standard;
            return `<article class="economy-core-card economy-product-shell category-${product.category}"><div class="economy-product-sticker" aria-hidden="true"><b>${product.icon}</b></div><div class="economy-product-copy"><strong>${escapeHtml(product.name)}</strong><p>${escapeHtml(product.description)}</p></div><div class="economy-product-price"><span>${coinMarkup()} <b>${price}</b> JC</span></div></article>`;
        }).join("")}</div>`;
    }

    function escapeHtml(value){
        return String(value ?? "").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
    }

    function refreshOpenPanel(){
        if(typeof document === "undefined") return;
        const overlay = document.getElementById("economyShopOverlay");
        if(!overlay || overlay.hidden) return;
        const playerIndex = Number(overlay.dataset.playerIndex);
        const wallet = getWallet(playerIndex);
        if(!wallet){ closePanel(); return; }
        const phase = getPhase(playerIndex);
        const playerNode = overlay.querySelector("[data-economy-panel-player]");
        const customerNode = overlay.querySelector("[data-economy-customer-player]");
        const balanceNode = overlay.querySelector("[data-economy-panel-balance]");
        const phaseNode = overlay.querySelector("[data-economy-panel-phase]");
        const progressNode = overlay.querySelector("[data-economy-panel-progress]");
        const catalogNode = overlay.querySelector("[data-economy-catalog]");
        const pagesNode = overlay.querySelector("[data-economy-shop-pages]");
        const pageLabelNode = overlay.querySelector("[data-economy-page-label]");
        const prevButton = overlay.querySelector("[data-economy-page-prev]");
        const nextButton = overlay.querySelector("[data-economy-page-next]");
        const saleBanner = overlay.querySelector("[data-economy-sale-banner]");
        const saleProgress = overlay.querySelector("[data-economy-sale-progress]");
        const standardStatus = overlay.querySelector("[data-economy-standard-status]");
        const liveStatus = overlay.querySelector("[data-economy-live-status]");
        const postDraftInfo = overlay.querySelector("[data-economy-post-draft]");
        const lastPurchaseName = overlay.querySelector("[data-economy-last-purchase-name]");
        const lastPurchaseMeta = overlay.querySelector("[data-economy-last-purchase-meta]");
        const purchaseList = overlay.querySelector("[data-economy-purchase-list]");
        const postDraft=Boolean(global.DraftEconomyBridge?.isDraftFinished?.());
        const onSale=!postDraft && (phase === "early" || phase === "pre");

        if(playerNode) playerNode.textContent = wallet.playerName;
        if(customerNode){
            customerNode.textContent = wallet.playerName;
            const customerCard=customerNode.closest?.(".economy-shop-customer-card");
            const nameLength=String(wallet.playerName||"").trim().length;
            customerCard?.classList.toggle("is-name-long",nameLength>14);
            customerCard?.classList.toggle("is-name-very-long",nameLength>20);
        }
        if(balanceNode) balanceNode.textContent = String(wallet.balance);
        if(phaseNode) phaseNode.textContent = phaseLabel(phase);
        if(progressNode) progressNode.textContent = `${Math.min(6,getNormalPicksCompleted(wallet))}/6`;
        overlay.classList.toggle("is-cosmic-sale",onSale);
        overlay.classList.toggle("is-post-draft-shop",postDraft);
        if(saleBanner) saleBanner.hidden=!onSale;
        if(saleProgress) saleProgress.hidden=true;
        if(standardStatus){
            standardStatus.hidden=false;
            const heading=standardStatus.querySelector("b");
            const copy=standardStatus.querySelector("span");
            if(heading) heading.textContent=onSale?`COSMIC SALE: ${Math.min(6,getNormalPicksCompleted(wallet))}/6`:"CENY STANDARDOWE";
            if(copy) copy.textContent=onSale?"Pierwsze 6 normalnych picków ma ceny promocyjne — zaglądaj, póki trwa okazja.":"Zaglądaj do sklepu, by trafić na promocję startową lub specjalną okazję.";
        }
        if(liveStatus){
            liveStatus.hidden=false;
            const heading=liveStatus.querySelector("b");
            const copy=liveStatus.querySelector("span");
            if(heading) heading.textContent="GODZINY OTWARCIA SKLEPU";
            if(copy) copy.textContent="Kupuj podczas swojej tury. Sklep jest otwarty w późnych godzinach po skończeniu draftu.";
        }
        if(postDraftInfo) postDraftInfo.hidden=true;

        const purchases=Array.isArray(wallet.purchases)?wallet.purchases:[];
        const totalSpent=purchases.reduce((sum,entry)=>sum+Math.max(0,Number(entry?.price||0)),0);
        if(lastPurchaseName) lastPurchaseName.textContent=String(purchases.length);
        if(lastPurchaseMeta){
            lastPurchaseMeta.textContent=purchases.length?`-${totalSpent} JC`:"";
            lastPurchaseMeta.hidden=purchases.length===0;
        }
        if(purchaseList){
            const names=purchases.map(entry=>String(entry?.productName||entry?.name||entry?.productId||"").trim()).filter(Boolean);
            purchaseList.textContent=names.length?`· ${names.join(" · ")}`:"";
            purchaseList.hidden=names.length===0;
        }

        const visibleCatalog=getCatalog(playerIndex);
        const hasExtensions=visibleCatalog.some(product=>product.section==="extensions");
        if(!hasExtensions || !["core","extensions"].includes(overlay.dataset.shopPage)) overlay.dataset.shopPage="core";
        const shopPage=overlay.dataset.shopPage||"core";
        if(pagesNode) pagesNode.hidden=!hasExtensions;
        if(pageLabelNode) pageLabelNode.textContent=shopPage==="extensions"?"DODATKI":"CORE SHOP";
        if(prevButton) prevButton.hidden=!hasExtensions || shopPage==="core";
        if(nextButton) nextButton.hidden=!hasExtensions || shopPage==="extensions";
        if(catalogNode){
            catalogNode.classList.toggle("is-extensions-page",shopPage==="extensions");
            catalogNode.innerHTML = coreCatalogMarkup(playerIndex,shopPage);
            global.EconomyShopCore?.refreshAvailability?.(playerIndex,catalogNode);
        }
    }

    function openPanel(playerIndex){
        if(!isEnabled()) return false;
        const wallet = getWallet(playerIndex);
        if(!wallet) return false;
        const overlay = ensurePanel();
        if(!overlay) return false;
        overlay.dataset.playerIndex = String(playerIndex);
        overlay.dataset.shopPage = "core";
        overlay.hidden = false;
        document.body.classList.add("economy-shop-opened");
        refreshOpenPanel();
        return true;
    }

    function closePanel(){
        if(typeof document === "undefined") return;
        const overlay = document.getElementById("economyShopOverlay");
        if(overlay) overlay.hidden = true;
        document.body.classList.remove("economy-shop-opened");
    }

    function normalizeInstanceId(cardOrId){
        if(cardOrId && typeof cardOrId==="object") return String(cardOrId.instanceId||"").trim();
        return String(cardOrId||"").trim();
    }

    function protectCard(playerIndex,cardOrId,metadata={}){
        if(!isEnabled()) return {ok:false,reason:"Economy jest wyłączone."};
        const wallet=getWallet(playerIndex);
        const instanceId=normalizeInstanceId(cardOrId);
        if(!wallet || !instanceId) return {ok:false,reason:"Nie udało się wskazać karty do ochrony."};
        wallet.protectedCardInstanceIds=Array.isArray(wallet.protectedCardInstanceIds)?wallet.protectedCardInstanceIds:[];
        if(wallet.protectedCardInstanceIds.includes(instanceId)) return {ok:false,reason:"Ta karta ma już Gwiezdną Osłonę."};
        wallet.protectedCardInstanceIds.push(instanceId);
        log("economy_card_protected",{playerIndex,balance:wallet.balance,reason:"stellar_shield",data:{instanceId,...safeClone(metadata)}});
        engineLog("economy_card_protected",{playerIndex,balance:wallet.balance,reason:"stellar_shield",data:{instanceId,...safeClone(metadata)}});
        emitChange(playerIndex,{type:"protection",instanceId});
        refreshProtectionDecorations();
        return {ok:true,instanceId};
    }

    function isCardProtected(cardOrId){
        const instanceId=normalizeInstanceId(cardOrId);
        if(!instanceId) return false;
        return state.wallets.some(wallet=>(wallet.protectedCardInstanceIds||[]).includes(instanceId));
    }

    function isPlayerCardProtected(playerIndex,cardOrId){
        const wallet=getWallet(playerIndex);
        const instanceId=normalizeInstanceId(cardOrId);
        return Boolean(wallet && instanceId && (wallet.protectedCardInstanceIds||[]).includes(instanceId));
    }

    function getProtectedCardIds(playerIndex){
        return safeClone(getWallet(playerIndex)?.protectedCardInstanceIds||[]);
    }

    function refreshProtectionDecorations(){
        if(typeof document==="undefined") return;
        document.querySelectorAll(".economy-stellar-shield-marker,.economy-stellar-shield-field").forEach(node=>node.remove());
        document.querySelectorAll(".card[data-card-instance-id],.deckInspectorCard[data-card-instance-id]").forEach(cardNode=>{
            cardNode.classList.remove("economy-stellar-protected");
            if(Object.prototype.hasOwnProperty.call(cardNode.dataset,"economyStellarBaseTitle")){
                cardNode.title=cardNode.dataset.economyStellarBaseTitle||"";
                delete cardNode.dataset.economyStellarBaseTitle;
            }
            const instanceId=String(cardNode.dataset.cardInstanceId||"");
            if(!instanceId || !isCardProtected(instanceId)) return;
            cardNode.classList.add("economy-stellar-protected");
            cardNode.dataset.economyStellarBaseTitle=cardNode.title||"";
            cardNode.title=[cardNode.title,"GWIEZDNA OSŁONA: blokuje wrogie kradzieże, kopiowanie, zniszczenie, przelosowanie, podmianę i transformację."].filter(Boolean).join(" • ");
            const field=document.createElement("span");
            field.className="economy-stellar-shield-field";
            field.setAttribute("aria-hidden","true");
            cardNode.appendChild(field);
        });
    }

    function getExtensionState(playerIndex,key,defaultValue=null){
        const wallet=getWallet(playerIndex);
        if(!wallet) return safeClone(defaultValue);
        wallet.extensionState=wallet.extensionState&&typeof wallet.extensionState==="object" ? wallet.extensionState : {};
        const normalized=String(key||"").trim();
        if(!normalized) return safeClone(wallet.extensionState);
        return Object.prototype.hasOwnProperty.call(wallet.extensionState,normalized)
            ? safeClone(wallet.extensionState[normalized])
            : safeClone(defaultValue);
    }

    function setExtensionState(playerIndex,key,value,metadata={}){
        const wallet=getWallet(playerIndex);
        const normalized=String(key||"").trim();
        if(!wallet||!normalized) return {ok:false,reason:"Nieprawidłowy stan rozszerzenia Economy."};
        wallet.extensionState=wallet.extensionState&&typeof wallet.extensionState==="object" ? wallet.extensionState : {};
        wallet.extensionState[normalized]=safeClone(value);
        log("economy_extension_state_changed",{
            playerIndex,
            balance:wallet.balance,
            reason:metadata.reason||normalized,
            data:{key:normalized,value:safeClone(value),...(metadata.data||{})}
        });
        emitChange(playerIndex,{type:"extension_state",key:normalized});
        return {ok:true,value:safeClone(wallet.extensionState[normalized])};
    }

    function getMomentum(playerIndex){
        const wallet=getWallet(playerIndex);
        return safeClone(wallet?.momentum||{pending:0,applied:0,targetKey:null});
    }

    function reserveMomentum(playerIndex,targetKey,steps=2){
        const wallet=getWallet(playerIndex);
        if(!wallet) return {ok:false,reason:"Nie znaleziono portfela."};
        wallet.momentum=wallet.momentum||{pending:0,applied:0,targetKey:null};
        const value=Math.max(0,Number(steps)||0);
        if(!targetKey || value<=0) return {ok:false,reason:"Brak legalnego przyszłego picku."};
        if(wallet.momentum.pending>0 && wallet.momentum.targetKey && wallet.momentum.targetKey!==targetKey){
            return {ok:false,reason:"Najpierw wykorzystaj już wykupiony Skok Nadświetlny."};
        }
        if(Number(wallet.momentum.pending||0)+value>4) return {ok:false,reason:"Skok Nadświetlny może dać maksymalnie +4 na jeden pick."};
        wallet.momentum.targetKey=targetKey;
        wallet.momentum.pending=Number(wallet.momentum.pending||0)+value;
        log("economy_momentum_reserved",{playerIndex,balance:wallet.balance,reason:"hyperspace_jump",data:safeClone(wallet.momentum)});
        return {ok:true,momentum:safeClone(wallet.momentum)};
    }

    function applyPendingMomentumForCurrentQueue(options={}){
        if(!isEnabled()) return [];
        const results=[];
        for(const wallet of state.wallets){
            const momentum=wallet.momentum||{pending:0,applied:0,targetKey:null};
            const delta=Math.max(0,Number(momentum.pending||0)-Number(momentum.applied||0));
            if(delta<=0 || !momentum.targetKey) continue;
            const result=global.DraftEconomyBridge?.applyMomentum?.(wallet.playerIndex,delta,momentum.targetKey,{fresh:Boolean(options.fresh)});
            if(result?.ok && Number(result.shifted||0)>0){
                momentum.applied=Number(momentum.applied||0)+Number(result.shifted||0);
                wallet.momentum=momentum;
                log("economy_momentum_applied",{playerIndex:wallet.playerIndex,balance:wallet.balance,reason:"hyperspace_jump",data:{...safeClone(momentum),...safeClone(result)}});
                results.push({playerIndex:wallet.playerIndex,...result});
            }
        }
        if(results.length){
            try{ global.updateRoundQueueDisplay?.(); }catch(error){}
        }
        return results;
    }

    function bindLobbyCompatibility(){
        if(typeof document === "undefined") return;
        const economyInput=document.getElementById("enableEconomy");
        const pokerInput=document.getElementById("enablePokerDraft");
        if(!economyInput || !pokerInput) return;

        const sync=()=>{
            if(pokerInput.checked){
                if(economyInput.checked) economyInput.checked=false;
                economyInput.disabled=true;
                economyInput.closest?.(".modeOption")?.classList.add("economy-is-incompatible");
            }else{
                economyInput.disabled=false;
                economyInput.closest?.(".modeOption")?.classList.remove("economy-is-incompatible");
            }
            try{ global.updateModePreview?.(); }catch(error){}
        };
        pokerInput.addEventListener("change",sync);
        economyInput.addEventListener("change",()=>{
            if(economyInput.checked && pokerInput.checked){
                pokerInput.checked=false;
            }
            sync();
        });
        sync();
    }

    global.EconomyEngine = Object.freeze({
        VERSION,
        CURRENCY,
        beginDraft,
        reset,
        isEnabled,
        getWallet:(playerIndex)=>safeClone(getWallet(playerIndex)),
        getPlayerState:(playerIndex)=>safeClone(getWallet(playerIndex)),
        getAllPlayerStates:()=>safeClone(state.wallets),
        getConfig,
        getPhase,
        phaseLabel,
        syncNormalPickStart,
        registerNormalPickCompleted,
        credit,
        debit,
        canAfford,
        registerProduct,
        unregisterProduct,
        getCatalog,
        getCatalogReference:()=>global.EconomyCatalogData?.all?.() || safeClone(CORE_SHOP_SHELL),
        checkPurchase,
        purchase,
        exportState,
        restoreState,
        getExportData,
        createWalletWidget,
        ensureShopLauncher,
        refreshShopLauncher,
        openShop:openPanel,
        openShopChooser:openPlayerChooser,
        closeShop:closePanel,
        protectCard,
        isCardProtected,
        isPlayerCardProtected,
        getProtectedCardIds,
        refreshProtectionDecorations,
        getExtensionState,
        setExtensionState,
        grantPriceModifier,
        getActivePriceModifiers,
        quoteProductPrice:(playerIndex,productId)=>{
            const product=products.get(String(productId||""));
            return product?safeClone(quoteProductPrice(Number(playerIndex),product,getPhase(Number(playerIndex)))):null;
        },
        playJeffCoinAward,
        getMomentum,
        reserveMomentum,
        applyPendingMomentumForCurrentQueue
    });

    bindLobbyCompatibility();
})(window);

/* ============================================================
   PATCH113B — shop footer / post-draft enhancement observer
   ============================================================ */
(function(global){
    "use strict";
    if(global.__MSP_PATCH113B_SHOP_OBSERVER__) return;
    global.__MSP_PATCH113B_SHOP_OBSERVER__=true;

    function normalPicksCompleted(wallet){
        if(!wallet) return 0;
        const explicit=Number(wallet.normalPicksCompleted);
        if(Number.isFinite(explicit)) return Math.max(0,explicit);
        return Math.max(0,Number(wallet.normalPickStarts||0));
    }

    function ensureSaleMeter(statusNode){
        if(!statusNode) return null;
        let meter=statusNode.querySelector('[data-economy-sale-meter]');
        if(meter) return meter;
        meter=document.createElement('div');
        meter.className='economy-shop-sale-meter';
        meter.setAttribute('data-economy-sale-meter','');
        meter.hidden=true;
        meter.innerHTML='<i data-economy-sale-meter-fill></i><em data-economy-sale-meter-label>0/6</em>';
        statusNode.appendChild(meter);
        return meter;
    }

    function setTextIfChanged(node,value){
        if(!node) return;
        const next=String(value??'');
        if(node.textContent!==next) node.textContent=next;
    }
    function setHiddenIfChanged(node,value){
        if(!node) return;
        const next=Boolean(value);
        if(node.hidden!==next) node.hidden=next;
    }

    function enhanceShopOverlay(){
        const overlay=document.getElementById('economyShopOverlay');
        if(!overlay || overlay.hidden) return;
        const playerIndex=Number(overlay.dataset.playerIndex);
        if(!Number.isInteger(playerIndex)) return;
        const wallet=global.EconomyEngine?.getWallet?.(playerIndex);
        if(!wallet) return;
        const phase=String(global.EconomyEngine?.getPhase?.(playerIndex)||'late');
        const postDraft=Boolean(global.DraftEconomyBridge?.isDraftFinished?.());
        const onSale=!postDraft && (phase==='early' || phase==='pre');
        const completed=Math.min(6,normalPicksCompleted(wallet));

        const standardStatus=overlay.querySelector('[data-economy-standard-status]');
        const liveStatus=overlay.querySelector('[data-economy-live-status]');
        const lastName=overlay.querySelector('[data-economy-last-purchase-name]');
        const lastMeta=overlay.querySelector('[data-economy-last-purchase-meta]');
        const purchaseList=overlay.querySelector('[data-economy-purchase-list]');

        if(standardStatus){
            const heading=standardStatus.querySelector('b');
            const copy=standardStatus.querySelector('span');
            const meter=ensureSaleMeter(standardStatus);
            const fill=meter?.querySelector('[data-economy-sale-meter-fill]');
            const label=meter?.querySelector('[data-economy-sale-meter-label]');
            setTextIfChanged(heading,onSale?'COSMIC SALE':'CENY STANDARDOWE');
            setTextIfChanged(copy,onSale
                ? 'Pierwsze 6 normalnych picków ma ceny promocyjne — zaglądaj, póki trwa okazja.'
                : 'Zaglądaj do sklepu, by trafić na promocję startową lub specjalną okazję.');
            setHiddenIfChanged(meter,!onSale);
            if(fill) fill.style.width=onSale ? `${(completed/6)*100}%` : '0%';
            setTextIfChanged(label,`${completed}/6`);
        }

        if(liveStatus){
            const heading=liveStatus.querySelector('b');
            const copy=liveStatus.querySelector('span');
            setTextIfChanged(heading,'GODZINY OTWARCIA SKLEPU');
            setTextIfChanged(copy,'Kupuj podczas swojej tury. Sklep jest otwarty w późnych godzinach po skończeniu draftu.');
        }

        const purchases=Array.isArray(wallet.purchases)?wallet.purchases:[];
        const totalSpent=purchases.reduce((sum,entry)=>sum+Math.max(0,Number(entry?.price||0)),0);
        setTextIfChanged(lastName,String(purchases.length));
        setTextIfChanged(lastMeta,purchases.length?`-${totalSpent} JC`:'');
        setHiddenIfChanged(lastMeta,purchases.length===0);
        if(purchaseList){
            const names=purchases.map(entry=>String(entry?.productName||entry?.name||entry?.productId||'').trim()).filter(Boolean);
            setTextIfChanged(purchaseList,names.length?`· ${names.join(' · ')}`:'');
            setHiddenIfChanged(purchaseList,names.length===0);
        }
    }

    if(typeof document!=='undefined'){
        if(typeof MutationObserver!=='undefined'){
            const observer=new MutationObserver(()=>{
                if(typeof queueMicrotask==='function') queueMicrotask(enhanceShopOverlay);
                else Promise.resolve().then(enhanceShopOverlay);
            });
            /* PATCH113B/113C HOTFIX: structural changes are enough. Do not observe
               text/class mutations that this enhancer itself edits. */
            observer.observe(document.documentElement,{subtree:true,childList:true});
        }
        setInterval(enhanceShopOverlay,700);
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhanceShopOverlay,{once:true});
        else enhanceShopOverlay();
    }
})(window);


/* ============================================================
   PATCH113C — surprise sale + launcher + 5-tile promo meter
   ============================================================ */
(function(global){
    "use strict";
    if(global.__MSP_PATCH113C_SURPRISE_SALE__) return;
    global.__MSP_PATCH113C_SURPRISE_SALE__=true;

    const ENGINE=()=>global.EconomyEngine;
    const STATE_KEY='shop_surprise_sale_v1';
    const SURPRISE_LABEL='SURPRISE SALE • 2 JC';

    function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
    function sampleOne(items){ return Array.isArray(items)&&items.length ? items[randInt(0,items.length-1)] : null; }
    function clone(v){ return v==null ? v : JSON.parse(JSON.stringify(v)); }

    function scheduleForPlayer(playerIndex){
        const api=ENGINE();
        const existing=api?.getExtensionState?.(playerIndex,STATE_KEY,null);
        if(existing && Array.isArray(existing.turns)) return existing;
        const primary=randInt(2,9);
        const turns=[primary];
        if(Math.random()<0.10){
            let extra=randInt(primary+1,11);
            if(extra<=11) turns.push(extra);
        }
        const payload={turns,granted:[],active:null};
        api?.setExtensionState?.(playerIndex,STATE_KEY,payload,{reason:'surprise_sale_schedule'});
        return payload;
    }

    function initSchedules(){
        const api=ENGINE();
        if(!api?.getAllPlayerStates) return;
        const states=api.getAllPlayerStates()||[];
        states.forEach((_,idx)=>scheduleForPlayer(idx));
        refreshLauncherBadge();
    }

    function getEligibleProductId(playerIndex){
        const api=ENGINE();
        const catalog=(api?.getCatalog?.(playerIndex)||[])
            .filter(p=>p && p.enabled!==false && p.metadata?.fixedPrice!==true && p.metadata?.priceModifiersAllowed!==false && p.id!=='mystery_offer');
        const pick=sampleOne(catalog);
        return pick ? String(pick.id) : null;
    }

    function grantSurpriseSale(playerIndex,triggerTurn){
        const api=ENGINE();
        if(!api?.grantPriceModifier) return false;
        const state=scheduleForPlayer(playerIndex);
        if(state.granted.includes(triggerTurn)) return false;
        const productId=getEligibleProductId(playerIndex);
        if(!productId) return false;
        const wallet=api.getWallet?.(playerIndex);
        const completed=Math.max(0,Number(wallet?.normalPicksCompleted ?? wallet?.normalPickStarts ?? 0));
        const grant=api.grantPriceModifier(playerIndex,{
            source:'surprise_sale',
            label:SURPRISE_LABEL,
            type:'fixed',
            fixedPrice:2,
            minPrice:0,
            oneShot:true,
            stackGroup:`surprise_sale_${productId}`,
            eligibleProductIds:[productId],
            expiresAfterNormalPickCompleted:completed+1,
            metadata:{productId,triggerTurn}
        });
        if(!grant?.ok) return false;
        const next={...state,granted:[...state.granted,triggerTurn],active:{productId,triggerTurn}};
        api.setExtensionState(playerIndex,STATE_KEY,next,{reason:'surprise_sale_granted'});
        try{ global.dispatchEvent(new CustomEvent('snapdraft:surprise-sale',{detail:{playerIndex,productId,triggerTurn}})); }catch(_e){}
        refreshLauncherBadge();
        markSurpriseRibbon();
        return true;
    }

    function maybeTriggerAfterCompleted(playerIndex){
        const api=ENGINE();
        const wallet=api?.getWallet?.(playerIndex);
        const completed=Math.max(0,Number(wallet?.normalPicksCompleted ?? wallet?.normalPickStarts ?? 0));
        const state=scheduleForPlayer(playerIndex);
        if(!state || !Array.isArray(state.turns)) return;
        const match=state.turns.find(turn=>turn===completed);
        if(match!=null) grantSurpriseSale(playerIndex,match);
    }

    function patchEngineMethods(){
        /* EconomyEngine is frozen in this build, so Patch113C hooks into public events
           instead of reassigning engine methods. */
        return;
    }

    function ensureLauncherAlert(root){
        if(!root) return null;
        let node=root.querySelector('.economy-shop-launcher-alert');
        if(node) return node;
        node=document.createElement('div');
        node.className='economy-shop-launcher-alert';
        node.hidden=true;
        node.textContent='SURPRISE SALE';
        root.querySelector('.economy-shop-launcher-button')?.appendChild(node);
        return node;
    }

    function setHiddenIfChanged113C(node,value){
        if(!node) return;
        const next=Boolean(value);
        if(node.hidden!==next) node.hidden=next;
    }

    function refreshLauncherBadge(){
        const root=document.getElementById('economyShopLauncher');
        if(!root || !ENGINE()) return;
        const button=root.querySelector('.economy-shop-launcher-button');
        const alert=ensureLauncherAlert(root);
        const playerIndex=(typeof ENGINE().getCurrentShopPlayerIndex==='function') ? ENGINE().getCurrentShopPlayerIndex() : null;
        const explicitIndex=Number.isInteger(playerIndex) ? playerIndex : Number(document.getElementById('economyShopOverlay')?.dataset.playerIndex);
        let active=false;
        if(Number.isInteger(explicitIndex)){
            const modifiers=ENGINE().getActivePriceModifiers?.(explicitIndex)||[];
            active=modifiers.some(entry=>String(entry?.source||'')==='surprise_sale');
        }
        setHiddenIfChanged113C(alert,!active);
        button?.classList.toggle('has-surprise-sale',active);
    }

    function enhanceSaleMeters(){
        document.querySelectorAll('.economy-shop-sale-meter').forEach(meter=>{
            if(!meter.dataset.patch113cTiles){
                meter.dataset.patch113cTiles='1';
                const label=meter.querySelector('em') || document.createElement('em');
                const current=(label.textContent||'0/6').trim();
                meter.innerHTML='';
                for(let i=0;i<5;i++){
                    const tile=document.createElement('span');
                    tile.className='economy-shop-sale-tile';
                    meter.appendChild(tile);
                }
                label.textContent=current;
                meter.appendChild(label);
            }
            const label=meter.querySelector('em');
            const parts=String(label?.textContent||'0/6').split('/');
            const current=Math.max(0,Number(parts[0])||0);
            const progress=Math.max(0,Math.min(5,Math.round((current/6)*5)));
            meter.querySelectorAll('.economy-shop-sale-tile').forEach((tile,idx)=>tile.classList.toggle('is-active',idx<progress));
        });
    }

    function markSurpriseRibbon(){
        document.querySelectorAll('.economy-product-v2-promo').forEach(node=>{
            const text=String(node.textContent||'').trim().toUpperCase();
            if(text.includes('SURPRISE SALE') && !node.classList.contains('is-surprise-sale-ribbon')){
                node.classList.add('is-surprise-sale-ribbon');
                if(!node.querySelector('img')){
                    node.innerHTML='<img src="draft-assets/surprise_sale_ribbon.png" alt="SURPRISE SALE">';
                }
            }
        });
    }

    function bootstrap(){ patchEngineMethods(); initSchedules(); refreshLauncherBadge(); enhanceSaleMeters(); markSurpriseRibbon(); }
    if(typeof document!=='undefined'){
        if(typeof MutationObserver!=='undefined'){
            const observer=new MutationObserver(()=>{
                const run=()=>{refreshLauncherBadge(); enhanceSaleMeters(); markSurpriseRibbon();};
                if(typeof queueMicrotask==='function') queueMicrotask(run);
                else Promise.resolve().then(run);
            });
            /* PATCH113C HOTFIX: Surprise Sale UI reacts to inserted/removed shop DOM.
               Watching hidden/class here can self-trigger through badge/ribbon updates. */
            observer.observe(document.documentElement,{subtree:true,childList:true});
        }
        global.addEventListener('snapdraft:economy-change',event=>queueMicrotask(()=>{
            initSchedules();
            const detail=event?.detail||{};
            if(detail.type==='passive_pick' && Number.isInteger(Number(detail.playerIndex))){
                try{ maybeTriggerAfterCompleted(Number(detail.playerIndex)); }catch(_e){}
            }
            refreshLauncherBadge(); enhanceSaleMeters(); markSurpriseRibbon();
        }));
        global.addEventListener('snapdraft:surprise-sale',()=>queueMicrotask(()=>{refreshLauncherBadge(); enhanceSaleMeters(); markSurpriseRibbon();}));
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
        else bootstrap();
    }
})(window);
