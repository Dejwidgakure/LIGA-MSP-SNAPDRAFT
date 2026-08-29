/**
 * MSP SnapDraft — kanoniczny Kodeks Supermocy.
 * PATCH 100G: cleanup opisów — mniej powtórzeń między timingiem, opisem i ograniczeniami.
 */

SuperpowerEngine.register({
    id: "loki",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {type: "copy_opponent_card_replace_own"},
    name: "Loki",
    color: "#66FF66",
    heroImage: "draft-assets/lokipowershero.png",
    icon: "draft-assets/lokipowers.png",
    emoji: "🐊",
    power: "MAGICZNY PODSTĘP",
    description:
        "Loki, Bóg Podstępu, rzuca na wybraną kartę przeciwnika asgardzkie zaklęcie i tworzy jej iluzoryczną kopię w swoim decku, zastępując nią jedną własną kartę. Oryginał pozostaje u rywala — Loki kradnie jedynie jego odbicie.",
    restrictions: []
});

SuperpowerEngine.register({
    id: "jeff",
    timing: "open_pack",
    timingLabel: "Raz, podczas własnej tury w otwartej paczce, przed wyborem karty.",
    effect: {
        type: "premium_joker_wave_and_personal_swap",
        packMinimumRarity: "epic",
        personalMinimumRarity: "legendary"
    },
    name: "Jeff",
    color: "#BDEEFF",
    heroImage: "draft-assets/jeffpowershero.png",
    icon: "draft-assets/jeffpowerslogo.png",
    emoji: "🦈",
    power: "JOKEROWA FALA",
    description:
        "Jeff przepływa przez aktualną paczkę z Jokerową Falą: zwykłe karty przemienia w Epic Jokery, a istniejące Jokery wynosi o poziom wyżej, maksymalnie do Legendary. Na koniec wyławia dla siebie prywatnego Legendary Jokera i wymienia jedną kartę w swoim decku na jego nagrodę.",
    restrictions: [
        "Jokerową Falę można wywołać tylko wtedy, gdy w paczce pozostały co najmniej 4 karty."
    ]
});

SuperpowerEngine.register({
    id: "iron_man",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {type: "replace_own_card_exact_power", powerMultiplier: 2},
    name: "Iron Man",
    color: "#FFD34E",
    heroImage: "draft-assets/ironmanpowershero.png",
    icon: "draft-assets/ironmanpowers.png",
    emoji: "⚛️",
    power: "AKTYWACJA REAKTORA",
    description:
        "Iron Man przeciąża swój reaktor łukowy i wykorzystuje technologię Stark Industries, by ulepszyć jedną kartę ze swojego decku. Wymienia ją na wybraną kartę o dokładnie dwukrotnie większej Sile.",
    restrictions: []
});

SuperpowerEngine.register({
    id: "spider_man",
    timing: "open_pack_with_future_turn",
    timingLabel: "Raz, podczas otwartej paczki, jeśli Spider-Man ma w niej jeszcze kolejny pick przed sobą.",
    effect: {type: "reserve_current_pack_card_for_next_turn"},
    name: "Spider-Man",
    color: "#FF3B3B",
    heroImage: "draft-assets/spidermanpowershero.png",
    icon: "draft-assets/spidermanpowers.png",
    emoji: "🕸️",
    power: "PAJĘCZA SIEĆ",
    description:
        "Spider-Man, zwalczając przestępczość, wystrzeliwuje Pajęczą Sieć na jedną lub dwie karty aktualnej paczki i rezerwuje je do swojego następnego picka. Gdy jego tura wraca, musi wybrać jedną z oplątanych kart; niewybrane Sieci wtedy się rozpuszczają, uwalniając pozostałe karty.",
    restrictions: [
        "Oplątane karty są zarezerwowane dla Spider-Mana i chronione przed bezpośrednią ingerencją innych Supermocy aż do jego następnego picka.",
        "Pajęcza Sieć nie może pozbawić żadnego gracza możliwości wykonania normalnego picka."
    ]
});

SuperpowerEngine.register({
    id: "hulk",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {type: "destroy_two_opponents_cards_and_reroll", targetCount: 2},
    name: "Hulk",
    color: "#4FAE32",
    heroImage: "draft-assets/hulkpowershero.png",
    icon: "draft-assets/hulkpowers.png",
    emoji: "👊",
    power: "HULK SMASH!",
    description:
        "Hulk wpada w niepowstrzymany szał i roztrzaskuje po jednej karcie dwóch różnych przeciwników. W powstałym chaosie każda zniszczona karta zostaje zastąpiona zupełnie nową, losową kartą.",
    restrictions: [
        "Jeśli Hulk może zaatakować tylko jednego przeciwnika, wykonuje jeden cios."
    ]
});

SuperpowerEngine.register({
    id: "cyclops",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {
        type: "replace_two_own_cards_by_anchor_synergy",
        replacementCount: 2,
        noTagFallback: "exact_power"
    },
    name: "Cyclops",
    color: "#FFD52A",
    heroImage: "draft-assets/cyclopspowershero.png",
    icon: "draft-assets/cyclopspowers.png",
    emoji: "🔴",
    power: "DO MNIE, MOJA DRUŻYNO!",
    description:
        "Cyclops obejmuje dowodzenie, mianuje jedną kartę Kapitanem i wybiera jej synergię: Rodzinę Mechanik, Archetyp Deckowy / Paczkę albo Cechę Tematyczną. Na jego wezwanie do decku dołącza dwóch nowych sojuszników z tej samej synergii. Gracz wskazuje pierwszą kartę, która opuszcza drużynę; drugą wybiera los.",
    restrictions: [
        "Cyclops może aktywować moc dopiero, gdy ma co najmniej 6 kart w decku.",
        "Jeśli Kapitan nie posiada żadnej obsługiwanej Rodziny Mechanik, Archetypu Deckowego / Paczki ani Cechy Tematycznej, Cyclops szuka nowych członków o dokładnie takiej samej Sile jak Kapitan."
    ]
});

SuperpowerEngine.register({
    id: "professor_x",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {type: "control_two_opponents_next_pick", targetCount: 2, minimumTargetCount: 1},
    name: "Professor X",
    color: "#C65CFF",
    heroImage: "draft-assets/professorxpowershero.png",
    icon: "draft-assets/professorxpowers.png",
    emoji: "🧠",
    power: "KONTROLA UMYSŁU",
    description:
        "Professor X uruchamia Cerebro i wnika w umysły maksymalnie dwóch przeciwników. Gdy nadchodzi ich najbliższy pick, Xavier przejmuje decyzję i wybiera kartę za nich — karta trafia jednak do decku kontrolowanego gracza.",
    restrictions: [
        "Kontrola obejmuje tylko najbliższy pick każdego wybranego przeciwnika. Jeśli dostępny jest tylko jeden przeciwnik, Xavier może przejąć tylko jego wybór.",
        "Gracz objęty aktywną Kontrolą Umysłu nie może zostać wybrany ponownie."
    ]
});

SuperpowerEngine.register({
    id: "rocket",
    timing: "open_pack",
    timingLabel: "Raz, podczas otwartej paczki.",
    effect: {type: "plant_pack_bombs_destroy_and_salvage", bombCount: 2},
    name: "Rocket",
    color: "#FF9A3C",
    heroImage: "draft-assets/rocketpowershero.png",
    icon: "draft-assets/rocketpowers.png",
    emoji: "💣",
    power: "ŁADUNEK WYBUCHOWY",
    description:
        "Rocket podkłada ładunki pod maksymalnie dwie karty aktualnej paczki. Gdy przeciwnik wybierze uzbrojoną kartę, bomba przyczepia się do niej i trafia razem z nią do jego decku, gdzie eksploduje, niszcząc inną losową kartę. Po każdym wybuchu Rocket może zgarnąć zniszczoną kartę jako złom bojowy, wymieniając za nią jedną własną.",
    restrictions: [
        "Każdy ładunek działa niezależnie i może eksplodować osobno. Jeśli Rocket sam wybierze uzbrojoną kartę, jej bomba zostaje rozbrojona.",
        "Jeśli w decku ofiary nie ma innej karty, którą bomba może trafić, ładunek okazuje się niewypałem."
    ]
});

SuperpowerEngine.register({
    id: "doctor_doom",
    timing: "open_pack",
    timingLabel: "Raz, podczas otwartej paczki.",
    effect: {
        type: "forge_doombot_three_way_replacement",
        minimumPackCards: 4,
        minimumDeckCards: 4
    },
    name: "Doctor Doom",
    color: "#225C3B",
    heroImage: "draft-assets/doompowershero.png",
    icon: "draft-assets/doompowers.png",
    emoji: "🤖",
    power: "MAGICZNE DOOMBOTY",
    description:
        "Doctor Doom otwiera latveriańską bazę danych i wybiera kartę, której technologia stanie się wzorcem dla trzech Magicznych DoomBotów wysłanych na inwazję. Pierwszy zastępuje losową kartę w decku Dooma, drugi infiltruje aktualną paczkę, a trzeci zajmuje miejsce najsłabszej karty losowego przeciwnika.",
    restrictions: [
        "Inwazję można rozpocząć dopiero, gdy w aktualnej paczce oraz w deckach wszystkich graczy znajdują się co najmniej 4 karty."
    ]
});

SuperpowerEngine.register({
    id: "captain_america",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {
        type: "shield_three_cards_and_counterattack",
        shieldCount: 3,
        counterattackCount: 1
    },
    name: "Captain America",
    color: "#5CCBFF",
    heroImage: "draft-assets/captainamericapowershero.png",
    icon: "draft-assets/captainamericapowers.png",
    emoji: "🛡️",
    power: "TARCZA KAPITANA",
    description:
        "Captain America staje w obronie swojej drużyny i osłania trzy wybrane karty wibraniowymi tarczami aż do końca draftu. Jeśli wroga Supermoc uderzy w inną kartę Capa, Kapitan odpowiada kontrującym rzutem tarczą i przelosowuje losową kartę napastnika.",
    restrictions: [
        "Rykoszet może uruchomić się tylko raz i nie tworzy kolejnego łańcucha kontrataków."
    ]
});

SuperpowerEngine.register({
    id: "venom",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {
        type: "consume_own_and_opponent_card",
        opponentChoiceCount: 2,
        ownReplacementPower: "combined_power"
    },
    name: "Venom",
    color: "#A64DFF",
    heroImage: "draft-assets/venompowershero.png",
    icon: "draft-assets/venompowers.png",
    emoji: "🦷",
    power: "SYMBIOTYCZNE POŻARCIE",
    description:
        "Głodny symbiont pochłania jedną kartę z decku Venoma i jedną kartę wybranego przeciwnika, łącząc ich Siłę w jednym potężniejszym organizmie. Venom wybiera dla siebie nową kartę o Sile dokładnie równej sumie obu ofiar, a przeciwnik odbudowuje swój deck, wybierając jedną z dwóch wylosowanych kart.",
    restrictions: []
});

SuperpowerEngine.register({
    id: "deadpool",
    timing: "anytime",
    timingLabel: "Raz, w dowolnym momencie aktywnego draftu.",
    effect: {
        type: "break_ban_and_reroll_own_cards",
        minimumDeckCards: 3,
        forbiddenCards: ["Arishem", "Loki"]
    },
    name: "Deadpool",
    color: "#E33B50",
    heroImage: "draft-assets/deadpoolpowershero.png",
    icon: "draft-assets/deadpoolpowers.png",
    emoji: "💀",
    power: "BAN? JAKI BAN?!",
    description:
        "Deadpool przebija czwartą ścianę draftu, włamuje się do konsoli admina i wyciąga z niej wybraną zbanowaną kartę, podmieniając nią losową kartę własnego decku. Jeśli lista banów jest pusta, jego chaotyczny hack pozwala zamiast tego wybrać dowolną kartę z puli. A jak wam się coś nie podoba, to wypier... napiszcie do admina.",
    restrictions: [
        "Po zabraniu karty z banów Deadpool dodatkowo przelosowuje 1 losową kartę własnego decku. Jeśli lista banów jest pusta i korzysta z wolnej puli — przelosowuje 2.",
        "Deadpool może aktywować moc dopiero, gdy ma co najmniej 3 karty w decku.",
        "Arishem i Loki pozostają poza jego zasięgiem nawet wtedy, gdy znajdują się na liście banów."
    ]
});

SuperpowerEngine.register({
    id: "iron_fist",
    timing: "any_time_open_pack",
    timingLabel: "Raz, w dowolnym momencie, gdy paczka jest otwarta.",
    effect: {
        type: "kun_lun_adaptive_card_tournament",
        opponentCount: "1_in_duel_otherwise_2",
        hostStakeChoice: "full_available_deck",
        opponentStakeChoiceCount: 2,
        winsRequired: 2,
        maximumRounds: 4,
        chiBonus: 1,
        tiedLeaderOdds: "equal",
        optionalCapturedStake: true
    },
    name: "Iron Fist",
    color: "#71F2C0",
    heroImage: "draft-assets/ironfist_jeff_hero_v2.png",
    icon: "draft-assets/ironfist_shoulao_emblem_v2.png",
    emoji: "🐉",
    power: "WYZWANIE K’UN-LUN",
    description:
        "Iron Fist oznacza wskazaną kartę jako Smoczą Nagrodę, a Shou-Lao porywa ją z aktualnej paczki i ustanawia nagrodą turnieju K’un-Lun. Przyzywa dwóch rywali — jednego w drafcie dwuosobowym — a każdy uczestnik stawia kartę na szali jako stawkę. W kolejnych rundach Shou-Lao wystawia losowych wojowników z ich decków; najwyższa bazowa Siła zdobywa punkt, a Iron Fist otrzymuje handicap +1 Chi. Pierwszy do 2 punktów zdobywa Smoczą Nagrodę.",
    restrictions: [
        "Do Wyzwania mogą przystąpić tylko gracze posiadający co najmniej 5 kart w decku. Iron Fist wybiera własną stawkę, a każdy rywal wybiera swoją spośród 2 kart wskazanych przez Shou-Lao.",
        "Smocza Nagroda zastępuje jedną kartę w decku zwycięzcy. Stawka zwycięzcy wraca, a przegrane stawki zostają zastąpione; jeśli przegrywa Iron Fist, wybiera swój zamiennik spośród 3 kart, pozostali otrzymują losowy.",
        "Jeśli Iron Fist wygra turniej, może dodatkowo przejąć jedną przegraną stawkę, oddając za nią losową inną kartę własnego decku. Remis w rundzie rozstrzyga Shou-Lao."
    ]
});

SuperpowerEngine.register({
    id: "doctor_strange",
    timing: "after_first_pick_before_second",
    timingLabel: "Raz, po pierwszym picku Strange’a i przed jego drugim, z wyjątkiem paczki rozpoczętej przez Strange’a.",
    effect: {type: "portal_agamotto_future_pack_swap", futurePackOffset: 1},
    name: "Doctor Strange",
    color: "#FF9D2E",
    heroImage: "draft-assets/doctorstrangepowershero.png",
    icon: "draft-assets/doctorstrangepowers.png",
    emoji: "🌀",
    power: "PORTAL AGAMOTTO",
    description:
        "Doctor Strange rozcina czas Portalem Agamotto i sięga do następnej paczki. Jedną kartę sprowadza do swojego decku, odsyłając w przyszłość jedną własną. Drugą przenosi do teraźniejszej paczki, a w jej miejsce wysyła wybraną kartę z obecnej. Wyczerpany tak potężnym zaklęciem Strange musi odpocząć, dlatego jego drugi pick zostaje przesunięty na koniec paczki.",
    restrictions: [
        "Strange nie może podczas tego drugiego picka wybrać karty, którą sam sprowadził do teraźniejszości.",
        "Po ujrzeniu przyszłej paczki nie można już anulować mocy."
    ]
});

SuperpowerEngine.register({
    id: "wolverine",
    timing: "own_turn_open_pack_before_pick_until_pack_five",
    timingLabel: "Raz, podczas własnej tury przed pickiem z otwartej paczki — najpóźniej w piątej paczce.",
    effect: {
        type: "graveyard_resurrection_with_optional_second",
        minimumGraveyardCards: 2,
        minimumDeckCards: 2,
        firstCost: "chosen",
        secondCost: "random_other",
        firstCardProtection: ["destroy", "reroll"]
    },
    name: "Wolverine",
    color: "#F4C542",
    heroImage: "draft-assets/wolverinepowershero.png",
    icon: "draft-assets/wolverinepowers.png",
    emoji: "✕",
    power: "ADAMANTIOWA REGENERACJA",
    description:
        "Wolverine nasyca wybrany nagrobek swoim czynnikiem regeneracyjnym i wyrywa kartę z Cmentarzyska z powrotem do swojego decku, oddając w jej miejsce wskazaną własną kartę. Może potem zaryzykować drugie wskrzeszenie — wtedy Logan wybiera kolejny nagrobek, ale cenę w jego decku wskazuje już los. Pierwsza ocalona karta zachowuje część regeneracji Wolverinea, dzięki czemu wyjątkowo trudno ponownie posłać ją na Cmentarzysko.",
    restrictions: [
        "Do rozpoczęcia Adamantiowej Regeneracji Wolverine potrzebuje co najmniej 2 nagrobków na Cmentarzysku i 2 kart w swoim decku.",
        "Pierwsza wskrzeszona karta jest chroniona przed zniszczeniem i przelosowaniem do końca draftu.",
        "Drugie wskrzeszenie jest dobrowolne, ale po ujawnieniu losowej karty oddawanej w zamian nie można się już wycofać."
    ]
});

SuperpowerEngine.register({
    id: "thor",
    timing: "open_pack_before_remaining_pick",
    timingLabel: "Raz na draft, przy otwartej paczce, jeśli Thor ma w niej jeszcze co najmniej jeden pick do wykonania.",
    effect: {
        type: "odin_worthiness_trial",
        selectedPackCards: 2,
        rollRange: [1,6],
        canCancelBeforeRoll: true,
        cannotCancelAfterRoll: true,
        mayShiftPickToEndForPlusOne: true,
        boostMaxResult: 5
    },
    name: "Thor",
    color: "#3478C9",
    heroImage: "draft-assets/thorpowershero.png",
    icon: "draft-assets/thorpowerslogo.png",
    emoji: "⚡",
    power: "TEST GODNOŚCI MJOLNIRA",
    description:
        "Thor rzuca Mjolnirem w dwie wybrane karty aktualnej paczki, naznaczając je przed Testem Godności Asgardu. Wynik rzutu 1–6 odsłania werdykt Odyna i pokazuje, jak hojnie Asgard nagrodzi jego próbę — od nieudanego uderzenia i przelosowania naznaczonych kart aż po triumfalny powrót Mjolnira z dwoma dodatkowymi Łupami Asgardu.",
    restrictions: [
        "Thor może rozpocząć Test dopiero, gdy ma co najmniej 2 karty w swoim decku.",
        "Przed rzutem można wycofać się z próby. Po rzucie werdykt Odyna musi zostać rozliczony do końca.",
        "Po wyniku 1–4 Thor może użyć Asgardzkiej Nieustępliwości i podnieść wynik o +1, maksymalnie do 5, kosztem przesunięcia jego najbliższego pozostającego picka na koniec paczki."
    ]
});

SuperpowerEngine.register({
    id: "devil_dinosaur",
    timing: "any_safe_open_pack_window",
    timingLabel: "Raz na draft, w dowolnym momencie, gdy paczka jest otwarta.",
    effect: {
        type: "devil_dino_belly",
        devourMin: 1,
        devourMax: 3,
        threeCardPrintedCostMax: 3,
        totalPrintedCostMax: 10,
        queuePenalty: 3,
        bellyUnlock: "after_owner_next_full_pick",
        allowedContexts: ["pickReplacement","packReplacement","deckBackup","kunLunStake","finalExchange"]
    },
    name: "Devil Dino",
    heroImage: "draft-assets/devildinopowershero.png",
    color: "#FF6541",
    icon: "draft-assets/devildinopowerslogo.png",
    emoji: "🦖",
    power: "PREHISTORYCZNE WGRYZIENIE",
    description:
        "Devil Dinosaur rzuca się na aktualną paczkę i pożera 1–3 wybrane karty, zostawiając po nich ciężkie Ogryzki o Koszcie 6+. Po uczcie Dino zapada w głęboką drzemkę, przez co jego następny pick zostaje opóźniony. Gdy ponownie się obudzi, otwiera się jego Brzuch — połknięte karty stają się jednorazowymi zasobami, które Dino może później wykorzystać w odpowiednich momentach draftu.",
    restrictions: [
        "Dino może pożreć 1–3 karty o łącznym Koszcie maksymalnie 10. Jeśli pożera trzy, każda z nich musi kosztować najwyżej 3.",
        "Po uczcie następny pick Dino zostaje przesunięty o 3 miejsca. Brzuch odblokowuje się dopiero po wykonaniu tego pełnego picka.",
        "Każda połknięta karta może zostać wykorzystana z Brzucha tylko raz."
    ]
});


SuperpowerEngine.register({
    id: "groot",
    timing: "any_time_open_pack",
    timingLabel: "Raz na draft, w dowolnym momencie, gdy paczka jest otwarta.",
    effect: {
        type: "plant_two_planet_x_seeds",
        seedCount: 2,
        growthTarget: "max_4_or_player_count",
        growthScoring: "1_then_2_at_two_picks_then_3_at_half_then_6_full_then_10_jackpot",
        unresolvedJokersAllowed: true,
        gardenTiming: "forced_after_source_pack_or_current_resolution",
        gardenMaxPurchases: 2,
        gardenCosts: [2,2,3,4,4,5,6,8],
        heartPlanetX: {options:4,chooseCost:true,permanentProtection:true},
        economyGrowthConversion: {enabledWhenEconomy:true,rate:"1:1",maxJeffCoins:5,requiresGardenPurchase:true}
    },
    name: "Groot",
    heroImage: "draft-assets/grootpowershero.png",
    color: "#70E879",
    icon: "draft-assets/grootpowerslogo.png",
    emoji: "🌱",
    power: "NASIONA PLANETY X",
    description:
        "Groot zasiewa dwie karty aktualnej paczki Nasionami Planety X. Każdy kolejny pick, który Nasiono przetrwa, pozwala roślinie rozkwitać i przynosi Grootowi coraz więcej 🌿. Gdy paczka dobiega końca, Groot zbiera plony, a Ogród Planety X otwiera się natychmiast, by wymienić zdobyte liście na nagrody.",
    restrictions: [
        "Im dłużej Nasiono pozostaje w paczce, tym większy plon daje. Pełny naturalny cykl nagradza JACKPOTEM 10 🌿; dokładne progi wzrostu pokazuje licznik Nasiona podczas draftu.",
        "Przy 7+ graczach progi 2 🌿 i 3 🌿 przychodzą o 1 przetrwany pick wcześniej.",
        "Ogród Planety X otwiera się automatycznie po zakończeniu paczki i musi zostać rozliczony od razu. Groot może kupić maksymalnie 2 różne nagrody; jeśli stać go na choć jedną, musi kupić co najmniej 1. Przy aktywnej Economy, po zakupie normalnej nagrody, może zamienić pozostały Wzrost 1:1 na maksymalnie 5 JeffCoinów; reszta niewydanych 🌿 przepada po zamknięciu Ogrodu."
    ]
});

SuperpowerEngine.register({
    id: "gambit",
    timing: "any_safe_open_pack_window",
    timingLabel: "Raz na draft, w spokojnym momencie otwartej paczki.",
    effect: {
        type: "kinetic_casino_cumulative_salvo",
        maxCharge: 5,
        protections: 2,
        minigame: "higher_lower_printed_power",
        rewardsAreCumulative: true,
        reserveLimit: 2
    },
    name: "Gambit",
    color: "#C95CFF",
    heroImage: "draft-assets/gambitpowershero.png",
    icon: "draft-assets/gambitpowerslogo_lightning.png",
    emoji: "♠",
    power: "KINETYCZNE KASYNO",
    description:
        "Gambit wchodzi do Kinetycznego Kasyna i obstawia, czy bazowa Siła kolejnej karty będzie wyższa, czy niższa. Po Cash Out wygrywa dokładnie jeden poziom nagrody, po czym jedną widowiskową salwą wystrzeliwuje naładowane karty w decki rywali, kolejkę i paczkę. Trafione karty są przelosowywane na nowe karty tego samego kosztu, a od Charge 3 część z nich odbija do Kinetic Reserve jako możliwy Łup.",
    restrictions: [
        "Gambit zaczyna z dwiema Ochronami Kinetycznymi. Błąd zużywa Ochronę i obniża Charge o 1; błąd bez Ochrony wywołuje Bust i obniża Charge o 2, ale nie odbiera już zdobytych nagród.",
        "Remis Siły oznacza PUSH. Nie zmienia Charge ani nie zużywa Ochrony. Gambit może wypłacić nagrodę przyciskiem Cash Out albo ryzykować dalej — Charge 5 automatycznie uruchamia Jackpot.",
        "Charge 0: własne przelosowanie 1 z 3. Charge 1: strzał w losowy deck. Charge 2: dodatkowo wcześniejszy przyszły pick. Charge 3: dodatkowo strzał w paczkę i 1 Łup. Charge 4: drugi strzał w deck. Charge 5: trzeci precyzyjny strzał w najtańszy cel i do 2 Łupów.",
        "Charge 1–5 zastępują nagrodę Charge 0 — własne przelosowanie nie dołącza do ofensywnej salwy. Łup zawsze wymienia się 1:1 za najsłabszą dostępną kartę Gambita, więc deck nie zmienia rozmiaru."
    ]
});

SuperpowerEngine.register({
    id: "mysterio",
    timing: "prepared_pack_before_open",
    timingLabel: "Raz na draft, wyłącznie po przygotowaniu paczki i przed jej otwarciem.",
    effect: {
        type: "grand_illusion_information_disruption",
        coverage: "ceil_three_quarters",
        peeksPerActivation: 4,
        publicPeekDurationMs: 5500,
        persistentUntilOwnCardLeavesPack: true,
        sharedDecoyFromCoveredPackCard: true,
        stackOwnerPicks: true,
        identityMaskNotProtection: true,
        spiderWebBlockedOnActiveIllusion: true,
        lastIllusionAutoReveals: true,
        reflectionLootRequiresPatternPeek: true,
        maxReflectionLoot: 1
    },
    name: "Mysterio",
    color: "#37FF78",
    heroImage: "draft-assets/mysteriopowershero.png",
    icon: "draft-assets/mysteriopowerslogo.png",
    emoji: "🔮",
    power: "WIELKA ILUZJA",
    description:
        "Przed otwarciem paczki Mysterio przykrywa trzy czwarte kart zieloną iluzją. Wszystkie pokazują ten sam Wzorzec — jedną prawdziwą kartę ukrytą pod iluzją. Jego dwa normalne picki ustawiają się jeden po drugim, a na całą tę podwójną turę dostaje wspólną pulę 4 publicznych Podglądów. Jeśli Podgląd trafi dokładnie w prawdziwy Wzorzec, Mysterio może raz skopiować go jako Łup i wymienić kopię 1:1 za kartę ze swojego decku, bez zużywania picku.",
    restrictions: [
        "Działa tylko na świeżo przygotowanej, jeszcze nieotwartej paczce. Wzorzec zawsze jest jedną z kart faktycznie objętych Iluzją.",
        "Każdy Podgląd trwa około 5–6 sekund, jest publiczny i nie zatrzymuje timera picku. Cztery Podglądy są wspólną pulą na oba zestackowane picki Mysterio.",
        "Iluzja chroni wyłącznie tożsamość karty, nie chroni jej przed efektami. Groot i Rocket mogą oznaczać Iluzję; Thor, Strange i inne efekty mogą ją targetować bez przedwczesnego ujawniania nazwy. Pajęczej Sieci Spider-Mana nie można nałożyć na aktywną Iluzję.",
        "Gdy Wzorzec opuszcza lub zmienia rolę, system wybiera nowy ukryty Wzorzec. Gdy pozostaje tylko jedna aktywna Iluzja, opada automatycznie.",
        "Łup Wzorca jest maksymalnie jeden na aktywację i jest wymianą 1:1, więc nie zwiększa rozmiaru decku ani nie zastępuje normalnego picku."
    ]
});

SuperpowerEngine.register({
    id: "black_cat",
    timing: "anytime_safe_draft_window",
    timingLabel: "Raz na draft, w dowolnym spokojnym momencie aktywnego draftu.",
    effect: {
        type: "black_cat_museum_heist",
        board: {rows: 5, columns: 7, moves: 14, lasers: 7, rewardFields: 13, emptyFields: 15},
        mainExhibit: "steal_opponent_card_and_replace_same_cost",
        economySynergy: "optional_jeffcoin_reward_tiles",
        agilityUses: 1,
        failureKeeps: "all_collected_loot",
        gemQueue: "fifo_one_per_normal_pick"
    },
    name: "Black Cat",
    color: "#D8EEFF",
    heroImage: "draft-assets/blackcatpowershero.png?v=2-alpha",
    icon: "draft-assets/blackcatpowerslogo.png?v=3-bolt",
    emoji: "🐈‍⬛",
    power: "KOCI HEIST",
    description:
        "Black Cat zakrada się do kosmicznego muzeum, podmienia bezcenny eksponat i rusza między laserami. Im dłużej zostaje w środku, tym więcej skradzionych możliwości może wynieść — o ile zdąży uciec.",
    restrictions: [
        "Wskazana karta zostaje podmieniona od razu na losowy zamiennik o tym samym Koszcie. Oryginał nie wraca do właściciela, nawet jeśli Black Cat nie dotrze do głównej gabloty.",
        "Pierwszy laser zawsze uruchamia Super Refleks i nie odbiera łupu. Drugi kończy napad, ale wszystko, co już trafiło do torby, zostaje z Black Cat.",
        "Światło ujawnia pobliskie gabloty, lecz nie lasery. Nagrodę zdobywa się dopiero po wejściu na jej pole; powrót po odwiedzonej bezpiecznej trasie nie zużywa ruchu.",
        "Kosmiczne Klejnoty czekają w kolejności zdobycia. Przy jednym normalnym picku może rozbłysnąć najwyżej jeden z nich.",
        "Economy nie jest wymagane. Gdy działa, muzeum skrywa JeffCoiny i Koci Klucz; bez Economy pojawia się Skradziony Dostęp odsłaniający kolejne gabloty."
    ]
});

SuperpowerEngine.register({
    id: "collector",
    timing: "first_pick_first_pack",
    timingLabel: "Przy pierwszym picku Collectora w pierwszej paczce.",
    effect: {
        type: "ongoing_private_collection",
        capture: ["packResidue","unresolvedJokerResidue","jokerRejectedFromPack"],
        collectionLimit: null,
        finalSwapLimit: 8,
        finalDeckSize: 12,
        publicGallery: true
    },
    name: "The Collector",
    color: "#B98CFF",
    heroImage: "draft-assets/collectorpowershero.png",
    icon: "draft-assets/collectorpowerslogo.png",
    emoji: "🏛️",
    power: "NAJWIĘKSZA KOLEKCJA WE WSZECHŚWIECIE",
    description:
        "Collector otwiera swój prywatny skarbiec i przejmuje karty pozostawione przez innych na końcu paczek. Rosnącą galerię może oglądać przez cały draft, a przed zamknięciem swojej kolekcji wybrać z niej eksponaty, które najlepiej dopełnią jego finalny deck.",
    restrictions: [
        "Do Kolekcji trafiają karty naturalnie niewybrane podczas normalnego draftowania paczek — nie wszystkie karty odrzucone przez inne efekty w trakcie draftu.",
        "Kolekcja nie ma limitu rozmiaru. Przed końcem draftu Collector może wykonać maksymalnie 8 wymian 1:1 między Kolekcją a swoim Main Deckiem.",
        "Nierozstrzygnięty Joker pozostaje Jokerem w gablocie i rozstrzyga się dopiero wtedy, gdy Collector próbuje przenieść go do finalnego decku."
    ]
});
