(function(global){
    "use strict";

    const VERSION="2.0.2-shop-final";

    const PRODUCTS=[
        {
            id:"cosmic_exchange",
            name:"Kosmiczna Wymiana",
            description:"Wymień własną kartę na 1 z 3 losowych kart.",
            section:"core",
            category:"repair",
            prices:{sale:3,standard:4},
            artAsset:"draft-assets/shop_art_exchange.png",
            accent:"#35c8ff",
            badge:"1 Z 3",
            assets:{sale:"draft-assets/shop_exchange_sale.png",standard:"draft-assets/shop_exchange_standard.png"}
        },
        {
            id:"galactic_sift",
            name:"Galaktyczny Przesiew",
            description:"Wymień własną kartę na 1 z 5 losowych kart.",
            section:"core",
            category:"repair",
            prices:{sale:5,standard:7},
            artAsset:"draft-assets/shop_art_sift.png",
            accent:"#6d8dff",
            badge:"1 Z 5",
            assets:{sale:"draft-assets/shop_sift_sale.png",standard:"draft-assets/shop_sift_standard.png"}
        },
        {
            id:"deep_space_scan",
            name:"Skan Głębokiej Przestrzeni",
            description:"Wymień własną kartę na 1 z 8 losowych kart.",
            section:"core",
            category:"repair",
            prices:{sale:6,standard:8},
            artAsset:"draft-assets/shop_art_deep_scan.png",
            accent:"#ff9a24",
            badge:"1 Z 8",
            assets:{sale:"draft-assets/shop_deep_scan_sale.png",standard:"draft-assets/shop_deep_scan_standard.png"}
        },
        {
            id:"low_orbit_scan",
            name:"Skan Niskiej Orbity",
            description:"Wymień własną kartę na 1 z 3 kart o koszcie 1–3.",
            section:"core",
            category:"scan",
            prices:{sale:4,standard:5},
            artAsset:"draft-assets/shop_art_low_orbit.png",
            accent:"#22e3ba",
            badge:"1 Z 3 • KOSZT 1–3",
            assets:{sale:"draft-assets/shop_low_orbit_sale.png",standard:"draft-assets/shop_low_orbit_standard.png"}
        },
        {
            id:"cost_scan",
            name:"Skan Kosztu",
            description:"Wybierz dokładny koszt i 1 z 3 kart o tym koszcie.",
            section:"core",
            category:"scan",
            prices:{sale:5,standard:7},
            artAsset:"draft-assets/shop_art_cost_scan.png",
            accent:"#25b8ff",
            badge:"1 Z 3 • WYBRANY KOSZT",
            assets:{sale:"draft-assets/shop_cost_scan_sale.png",standard:"draft-assets/shop_cost_scan_standard.png"}
        },
        {
            id:"synergy_scan",
            name:"Skan Synergii",
            description:"Wybierz archetyp / tag i 1 z 3 pasujących kart.",
            section:"core",
            category:"scan",
            prices:{sale:6,standard:8},
            artAsset:"draft-assets/shop_art_synergy_scan.png",
            accent:"#c35cff",
            badge:"1 Z 3 • SYNERGIA",
            assets:{sale:"draft-assets/shop_synergy_scan_sale.png",standard:"draft-assets/shop_synergy_scan_standard.png"}
        },
        {
            id:"hyperspace_jump",
            name:"Skok Nadświetlny",
            description:"Najbliższy przyszły normalny pick: +2 miejsca. Maksymalnie +4.",
            section:"core",
            category:"utility",
            prices:{sale:5,standard:6},
            artAsset:"draft-assets/shop_art_hyperjump.png",
            accent:"#ff4a91",
            badge:"+2 • MAKS. +4",
            assets:{sale:"draft-assets/shop_hyperjump_sale.png",standard:"draft-assets/shop_hyperjump_standard.png"}
        },
        {
            id:"stellar_shield",
            name:"Gwiezdna Osłona",
            description:"Chroni wybraną kartę do końca draftu. Można kupić wielokrotnie.",
            section:"core",
            category:"utility",
            prices:{sale:3,standard:4},
            artAsset:"draft-assets/shop_art_star_shield.png",
            accent:"#27ddb2",
            badge:"OCHRONA ∞",
            assets:{sale:"draft-assets/shop_star_shield_sale.png",standard:"draft-assets/shop_star_shield_standard.png"}
        },
        {
            id:"mystery_offer",
            name:"Tajemnicza Oferta",
            description:"Otrzymaj losowy produkt Core Shopu.",
            section:"core",
            category:"mystery",
            prices:{sale:5,standard:5},
            maxPerDraft:1,
            artAsset:"draft-assets/shop_art_mystery.png",
            accent:"#ff4aa8",
            badge:"LOSOWY PRODUKT",
            assets:{sale:"draft-assets/shop_mystery.png",standard:"draft-assets/shop_mystery.png"}
        },
        {
            id:"graveyard_revival",
            name:"Kosmiczne Zmartwychwstanie",
            description:"Wymień własną kartę na jedną z pięciu kart Cmentarzyska.",
            section:"core",
            category:"utility",
            prices:{sale:6,standard:6},
            artAsset:"draft-assets/shop_art_graveyard_revival.png",
            accent:"#a65cff",
            badge:"1 Z 5 • CMENTARZYSKO",
            assets:{sale:"draft-assets/shop_art_graveyard_revival.png",standard:"draft-assets/shop_art_graveyard_revival.png"}
        },
        {
            id:"joker_under_counter",
            name:"Joker spod lady",
            description:"Oddaj 1 kartę i natychmiast rozstrzygnij losowego Epickiego lub Legendarnego Jokera.",
            section:"extensions",
            category:"extension",
            requiresExtension:"jokers",
            prices:{sale:6,standard:8},
            artAsset:"draft-assets/shop_art_joker_under_counter.png",
            accent:"#c95cff",
            badge:"JOKERY",
            assets:{sale:"draft-assets/shop_joker_under_counter_sale.png",standard:"draft-assets/shop_joker_under_counter_standard.png"}
        },
        {
            id:"custom_delivery",
            name:"Customowa Dostawa",
            description:"Wybierz aktywną Customową Paczkę i wymień kartę na 1 z 3 kart z jej czystej puli.",
            section:"extensions",
            category:"extension",
            requiresExtension:"custom_packs",
            prices:{sale:7,standard:9},
            artAsset:"draft-assets/shop_art_custom_delivery.png",
            accent:"#49d8c6",
            badge:"CUSTOM PACKS",
            assets:{sale:"draft-assets/shop_custom_delivery_sale.png",standard:"draft-assets/shop_custom_delivery_standard.png"}
        },
        {
            id:"superpower_recharge",
            name:"Recharge Supermocy",
            description:"Naładuj ponownie już wykorzystaną Supermoc. Maksymalnie raz na draft.",
            section:"extensions",
            category:"extension",
            requiresExtension:"superpowers",
            prices:{sale:10,standard:10},
            maxPerDraft:1,
            fixedPrice:true,
            priceModifiersAllowed:false,
            artAsset:"draft-assets/shop_art_superpower_recharge.png",
            accent:"#ffb02e",
            badge:"SUPERMOC • 1×",
            assets:{sale:"draft-assets/shop_superpower_recharge_sale.png",standard:"draft-assets/shop_superpower_recharge_standard.png"}
        },
        {
            id:"save_steal_extra_save",
            name:"Dodatkowy Save",
            description:"Zabezpiecz dodatkową kartę przed STEAL. Możesz kupić maksymalnie 2 dodatkowe SAVE.",
            section:"extensions",
            category:"extension",
            requiresExtension:"save_steal",
            prices:{sale:3,standard:4},
            maxPerDraft:2,
            artAsset:"draft-assets/shop_art_extra_save.png",
            accent:"#ff688e",
            badge:"SAVE & STEAL",
            assets:{sale:"draft-assets/shop_extra_save_sale.png",standard:"draft-assets/shop_extra_save_standard.png"}
        }
    ];

    const clone=value=>JSON.parse(JSON.stringify(value));
    const byId=new Map(PRODUCTS.map(product=>[product.id,product]));

    function get(id){
        const product=byId.get(String(id||""));
        return product?clone(product):null;
    }

    function all(){ return PRODUCTS.map(clone); }
    function core(){ return PRODUCTS.filter(product=>product.section==="core").map(clone); }
    function extensions(){ return PRODUCTS.filter(product=>product.section==="extensions").map(clone); }
    function getEnginePrices(id){
        const product=byId.get(String(id||""));
        if(!product) return null;
        return {early:Number(product.prices.sale),late:Number(product.prices.standard)};
    }

    global.EconomyCatalogData=Object.freeze({
        VERSION,
        get,
        all,
        core,
        extensions,
        getEnginePrices
    });
})(window);
