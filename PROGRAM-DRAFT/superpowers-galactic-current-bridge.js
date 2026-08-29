(function(global){
    "use strict";

    const VERSION="3.0.0-galactic-current-compat";
    const STATUS=Object.freeze({SUPPORTED:"supported",ADAPTED:"adapted",UNSUPPORTED:"unsupported"});

    /*
       GWIEZDNY PRĄD compatibility registry.
       - SUPPORTED: power is mode-agnostic / deck-only and needs no river-specific mutation.
       - ADAPTED: power has an explicit Galactic Current adapter and regression coverage.
       - UNSUPPORTED: visible in the roster, but cannot be assigned or activated in the mode.

       Keep this list conservative. A power moves out of UNSUPPORTED only together with the
       concrete river behavior that makes its semantics true, not just with player-facing text.
    */
    const POLICIES=Object.freeze({
        loki:{status:STATUS.SUPPORTED},
        iron_man:{status:STATUS.SUPPORTED},
        hulk:{status:STATUS.SUPPORTED},
        cyclops:{status:STATUS.SUPPORTED},
        captain_america:{status:STATUS.SUPPORTED},
        venom:{status:STATUS.SUPPORTED},
        deadpool:{status:STATUS.SUPPORTED},
        black_cat:{status:STATUS.ADAPTED,note:"Koci Heist korzysta z natywnych hooków Gwiezdnego Prądu."},

        professor_x:{
            status:STATUS.ADAPTED,
            note:"Cerebro przejmuje najbliższy normalny wybór rywala, także w następnym obiegu.",
            modeText:{
                timingLabel:"Raz, w dowolnym momencie aktywnego Gwiezdnego Prądu.",
                description:"Professor X uruchamia Cerebro i wnika w umysły maksymalnie dwóch przeciwników. Gdy nadchodzi ich najbliższy wybór w Gwiezdnym Prądzie — w tym także w kolejnym obiegu — Xavier przejmuje decyzję i wybiera kartę za nich. Karta nadal trafia do decku kontrolowanego gracza."
            }
        },
        wolverine:{
            status:STATUS.ADAPTED,
            note:"Timing piątej paczki jest w Prądzie liczony jako piąty obieg.",
            modeText:{
                timingLabel:"Raz, podczas własnej tury przed wyborem z nurtu — najpóźniej w piątym obiegu Gwiezdnego Prądu."
            }
        },
        jeff:{
            status:STATUS.ADAPTED,
            note:"Jokerowa Fala transformuje realne karty aktualnego nurtu.",
            modeText:{
                timingLabel:"Raz, podczas własnej tury w aktywnym nurcie, przed wyborem karty.",
                description:"Jeff przepływa przez aktualny nurt z Jokerową Falą: zwykłe karty przemienia w Epic Jokery, a istniejące Jokery wynosi o poziom wyżej, maksymalnie do Legendary. Na koniec wyławia dla siebie prywatnego Legendary Jokera i wymienia jedną kartę w swoim decku na jego nagrodę.",
                restrictions:["Jokerową Falę można wywołać tylko wtedy, gdy w nurcie znajdują się co najmniej 4 karty."]
            }
        },
        doctor_doom:{
            status:STATUS.ADAPTED,
            note:"DoomBot infiltrujący stół podmienia realną kartę aktualnego nurtu.",
            modeText:{
                timingLabel:"Raz, gdy Gwiezdny Prąd jest aktywny.",
                description:"Doctor Doom otwiera latveriańską bazę danych i wybiera kartę, której technologia stanie się wzorcem dla trzech Magicznych DoomBotów. Pierwszy zastępuje losową kartę w decku Dooma, drugi infiltruje aktualny nurt, a trzeci zajmuje miejsce najsłabszej karty losowego przeciwnika.",
                restrictions:["Inwazję można rozpocząć dopiero, gdy w aktualnym nurcie oraz w deckach wszystkich graczy znajdują się co najmniej 4 karty."]
            }
        },
        iron_fist:{status:STATUS.ADAPTED,note:"Smocza Nagroda jest wyjmowana z realnego nurtu atomowo, z natychmiastowym uzupełnieniem przepływu i rollbackiem."},
        spider_man:{
            status:STATUS.ADAPTED,
            note:"Pajęcza Sieć kotwiczy kartę w nurcie do następnego wyboru Spider-Mana bez zwiększania rozmiaru Prądu.",
            modeText:{
                timingLabel:"Raz, podczas aktywnego nurtu, jeśli Spider-Man ma jeszcze kolejny normalny wybór przed sobą.",
                description:"Spider-Man wystrzeliwuje Pajęczą Sieć na jedną lub dwie karty aktualnego nurtu i kotwiczy je do swojego następnego wyboru. Oplątana karta nie może zostać wybrana przez innych ani naturalnie odpłynąć lub wygasnąć. Gdy tura Spider-Mana wraca, musi wybrać jedną z oplątanych kart; pozostałe Sieci wtedy się rozpuszczają.",
                restrictions:[
                    "Pajęcza Sieć nie zwiększa liczby kart w nurcie. Gdy Prąd próbowałby naturalnie usunąć oplątaną kartę, odpływa lub wygasa inna legalna karta.",
                    "Oplątane karty są zarezerwowane dla Spider-Mana i chronione przed bezpośrednią ingerencją innych Supermocy aż do jego następnego wyboru."
                ]
            }
        },

        rocket:{status:STATUS.ADAPTED,note:"Bomby są przypięte do realnych instancji kart nurtu; naturalny odpływ lub wygaśnięcie rozbraja ładunek."},
        doctor_strange:{status:STATUS.UNSUPPORTED,reason:"Portal Agamotto pozostaje Classic-only — przyszły dopływ i koszt kolejnego obiegu zmieniałyby semantykę mocy."},
        thor:{status:STATUS.ADAPTED,note:"Test Godności operuje na realnym nurcie; koszt przesunięcia picku pozostaje identyczny jak w Classicu."},
        devil_dinosaur:{status:STATUS.ADAPTED,note:"Wgryzienie i akcje Brzucha korzystają z realnego nurtu, a usunięte karty są natychmiast uzupełniane zgodnie z przepływem."},
        groot:{status:STATUS.UNSUPPORTED,reason:"Groot pozostaje świadomie Classic-only: naturalny odpływ i wygasanie kart tworzyłyby nieuczciwe skróty do jackpotu Ogrodu."},
        gambit:{status:STATUS.ADAPTED,note:"Salwa i Rykoszet trafiają w realne karty nurtu, a kolejka korzysta z aktywnej kolejki Prądu."},
        mysterio:{status:STATUS.UNSUPPORTED,reason:"Wielka Iluzja pozostaje Classic-only — dynamiczny nurt nie zachowuje sensownej struktury świeżej paczki i dwóch zestackowanych picków."},
        collector:{status:STATUS.UNSUPPORTED,reason:"Collection jest Classic-only także balansowo — naturalny odpływ Gwiezdnego Prądu dawałby Collectorowi nieproporcjonalnie wielką pulę."}
    });

    function modeEnabled(){
        try{return Boolean(global.GalacticCurrent?.isModeEnabled?.());}catch(_){return false;}
    }
    function policyFor(powerId){
        const id=String(powerId||"");
        return POLICIES[id]||{status:STATUS.UNSUPPORTED,reason:"Ta Supermoc nie ma jeszcze zatwierdzonego profilu Gwiezdnego Prądu."};
    }
    function compatibilityFor(powerId){
        const policy=policyFor(powerId);
        return {powerId:String(powerId||""),...policy,compatible:policy.status!==STATUS.UNSUPPORTED};
    }
    function isPowerCompatible(powerId){
        return !modeEnabled() || compatibilityFor(powerId).compatible;
    }
    function compatiblePowers(powers){
        const list=Array.isArray(powers)?powers:[];
        return modeEnabled()?list.filter(power=>isPowerCompatible(power?.id)):list;
    }
    function decoratePowerDefinition(power){
        if(!power||typeof power!=="object"||!modeEnabled()) return power;
        const compatibility=compatibilityFor(power.id);
        const clone={...power,galacticCurrentCompatibility:compatibility};
        const modeText=compatibility.modeText||null;
        if(modeText){
            if(modeText.timingLabel) clone.timingLabel=modeText.timingLabel;
            if(modeText.description) clone.description=modeText.description;
            if(Array.isArray(modeText.restrictions)) clone.restrictions=[...modeText.restrictions];
        }
        if(compatibility.status===STATUS.UNSUPPORTED){
            clone.restrictions=[
                ...(Array.isArray(clone.restrictions)?clone.restrictions:[]),
                `GWIEZDNY PRĄD • NIEKOMPATYBILNA: ${compatibility.reason}`
            ];
        }else if(compatibility.status===STATUS.ADAPTED&&compatibility.note){
            clone.restrictions=[...(Array.isArray(clone.restrictions)?clone.restrictions:[]),`GWIEZDNY PRĄD • ${compatibility.note}`];
        }
        return clone;
    }

    function currentMode(){
        if(modeEnabled()){
            const state=global.GalacticCurrent?.getState?.();
            return {id:"galactic_current",variant:state?.variant||global.GalacticCurrent?.getConfiguredVariant?.()||null};
        }
        return {id:"classic",variant:null};
    }
    function liveCards(){
        if(modeEnabled()) return global.GalacticCurrent?.getLiveCards?.()||global.GalacticCurrent?.getState?.()?.cards||[];
        return global.DraftSuperpowerHostBridge?.getCurrentPack?.()||[];
    }
    function futureCards(){
        if(modeEnabled()) return global.GalacticCurrent?.getFutureCards?.()||global.GalacticCurrent?.getState?.()?.drawQueue||[];
        return [];
    }
    function replaceLiveCard(index,replacement,options={}){
        if(modeEnabled()) return global.GalacticCurrent?.replaceLiveCardAt?.(index,replacement,options)||{ok:false,reason:"Bridge Gwiezdnego Prądu nie obsługuje podmiany."};
        return global.DraftSuperpowerHostBridge?.replaceCurrentPackCardAt?.(index,replacement,options)||{ok:false,reason:"Bridge Classica nie obsługuje podmiany."};
    }
    function consumeLiveCard(index,options={}){
        if(modeEnabled()) return global.GalacticCurrent?.consumeLiveCardAt?.(index,options)||{ok:false,reason:"Bridge Gwiezdnego Prądu nie obsługuje usunięcia."};
        return global.DraftSuperpowerHostBridge?.consumeCurrentPackCardAt?.(index,options)||{ok:false,reason:"Bridge Classica nie obsługuje usunięcia."};
    }
    function resolveExternalNormalPick(index,playerIndex,resultCard,options={}){
        if(modeEnabled()) return global.GalacticCurrent?.resolveExternalNormalPick?.(index,playerIndex,resultCard,options)||{ok:false,reason:"Bridge Gwiezdnego Prądu nie obsługuje zewnętrznego normalnego picku."};
        return {ok:false,reason:"Zewnętrzny normalny pick jest adapterem Gwiezdnego Prądu."};
    }
    function captureFlowState(){
        return modeEnabled()?global.GalacticCurrent?.captureState?.()||null:null;
    }
    function restoreFlowState(snapshot,options={}){
        return modeEnabled()?Boolean(global.GalacticCurrent?.restoreState?.(snapshot,options)):false;
    }
    function advanceExternalTurn(){
        if(modeEnabled()) return Boolean(global.GalacticCurrent?.advanceExternalTurn?.());
        global.nextPickOrPack?.();
        return true;
    }
    function nextTurn(playerIndex){
        if(modeEnabled()) return global.GalacticCurrent?.getNextTurnDescriptor?.(playerIndex)||null;
        return global.DraftSuperpowerHostBridge?.getNextTurnDescriptor?.(playerIndex)||null;
    }
    function flowContext(){
        const state=global.GalacticCurrent?.getState?.();
        return modeEnabled()?{
            mode:"galactic_current",
            variant:state?.variant||null,
            round:Number(state?.round||0)+1,
            pickNumber:Number(state?.pickNumber||0),
            cards:liveCards(),
            futureCards:futureCards()
        }:{mode:"classic",cards:liveCards(),futureCards:[]};
    }
    function surfaceWord(){return modeEnabled()?"nurt":"paczka";}
    function surfaceWordLocative(){return modeEnabled()?"nurcie":"paczce";}
    function roundWord(){return modeEnabled()?"obieg":"paczka";}
    function contextualText(classicText,currentText){return modeEnabled()?currentText:classicText;}

    global.GalacticCurrentSuperpowerBridge=Object.freeze({
        VERSION,STATUS,POLICIES,
        isModeEnabled:modeEnabled,
        getPolicy:policyFor,
        getCompatibility:compatibilityFor,
        isPowerCompatible,
        filterCompatiblePowers:compatiblePowers,
        decoratePowerDefinition,
        getCurrentMode:currentMode,
        getLiveCards:liveCards,
        getFutureCards:futureCards,
        replaceLiveCard,
        consumeLiveCard,
        resolveExternalNormalPick,
        captureFlowState,
        restoreFlowState,
        advanceExternalTurn,
        getNextTurnDescriptor:nextTurn,
        getFlowContext:flowContext,
        surfaceWord,
        surfaceWordLocative,
        roundWord,
        contextualText
    });
})(window);
