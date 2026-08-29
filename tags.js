/* ============================================================
   MSP SNAP DRAFT — TAG DATABASE
   Version 2.00

   Kanoniczna kolejność tagów w cards.js:
   series → abilityTypes → mechanicFamilies → subtypes
   → deckArchetypes → teams → themes → special

   Tagi specjalne zawsze znajdują się na końcu.
============================================================ */

const TAG_CATEGORIES = {
  series: {
    name: "Serie",
    color: "#9B5CFF",
    glow: "rgba(155, 92, 255, .42)",
    description: "Klasyfikuje karty według sposobu ich odblokowania oraz serii kolekcjonerskiej, do której należą."
  },

  abilityTypes: {
    name: "Typy Zdolności",
    color: "#35B8FF",
    glow: "rgba(53, 184, 255, .40)",
    description: "Określa formalny typ zdolności karty, moment jej działania albo sposób aktywacji efektu. Karta może posiadać więcej niż jeden typ zdolności."
  },

  mechanicFamilies: {
    name: "Rodziny Mechanik",
    color: "#FF5FA2",
    glow: "rgba(255, 95, 162, .42)",
    description: "Szerokie ekosystemy i funkcjonalne rodziny mechanik. Obejmują karty, których własny tekst lub mechanika bezpośrednio wykonuje, wspiera, rozpoznaje, modyfikuje albo payoffuje daną mechanikę. Nie obejmują kart wyłącznie dlatego, że są popularnymi elementami konkretnego decku."
  },

  subtypes: {
    name: "Mechaniki Szczegółowe",
    color: "#FF9F43",
    glow: "rgba(255, 159, 67, .40)",
    description: "Węższe i precyzyjne cechy kart opisujące konkretną, powtarzalną operację, warunek, zachowanie efektu albo rodzaj interakcji. Nie wymagają tworzenia własnego ekosystemu ani archetypu deckowego."
  },

  deckArchetypes: {
    name: "Archetypy deckowe i paczki",
    color: "#C96CFF",
    glow: "rgba(201, 108, 255, .42)",
    description: "Rozpoznawalne strategie budowy decku, trwałe shelle i mniejsze pakiety synergicznych kart. Tag może obejmować charakterystyczne supporty i staple'e, nawet jeśli ich własny tekst nie należy bezpośrednio do głównej Rodziny Mechanik danego planu."
  },

  teams: {
    name: "Drużyny",
    color: "#43E08D",
    glow: "rgba(67, 224, 141, .38)",
    description: "Klasyfikuje postacie według ich drużyn, organizacji, frakcji oraz innych kanonicznych przynależności w uniwersum Marvela."
  },

  themes: {
    name: "Motywy",
    color: "#E94CFF",
    glow: "rgba(233, 76, 255, .42)",
    description: "Fabularne, wizualne i gatunkowe cechy kart niezależne od ich mechaniki w grze, takie jak pochodzenie, magia, technologia, typ postaci albo motyw przewodni."
  },

  special: {
    name: "Specjalne",
    color: "#F6C94C",
    glow: "rgba(246, 201, 76, .46)",
    description: "Ręcznie nadawane wyróżnienia oraz oznaczenia związane z edycjami MSP SnapDraft i zwycięskimi taliami."
  }
};

const TAGS = {

  series: [
    {
      id: "starter",
      name: "Starter",
      description: "Karty dostępne od początku gry."
    },

    {
      id: "recruit-pass",
      name: "Recruit Pass",
      description: "Karty odblokowywane w Recruit Pass."
    },

    {
      id: "series0",
      name: "Series 0",
      description: "Karty należące do Series 0."
    },

    {
      id: "series1",
      name: "Series 1",
      description: "Karty należące do Series 1."
    },

    {
      id: "series2",
      name: "Series 2",
      description: "Karty należące do Series 2."
    },

    {
      id: "series3",
      name: "Series 3",
      description: "Karty należące do Series 3."
    },

    {
      id: "series4",
      name: "Series 4",
      description: "Karty należące do Series 4."
    },

    {
      id: "series5",
      name: "Series 5",
      description: "Karty należące do Series 5."
    }
  ],

  abilityTypes: [
    {
      id: "activate",
      name: "Activate",
      description: "Karta posiada efekt Activate."
    },

    {
      id: "endofgame",
      name: "End of Game",
      description: "Efekt karty aktywuje się po zakończeniu gry."
    },

    {
      id: "endofturn",
      name: "End of Turn",
      description: "Efekt karty aktywuje się na końcu tury."
    },

    {
      id: "gamestart",
      name: "Game Start",
      description: "Efekt karty aktywuje się przed rozpoczęciem gry."
    },

    {
      id: "moveable",
      name: "Moveable",
      description: "Karta może zostać przesunięta dzięki własnej zdolności lub wbudowanej mechanice."
    },

    {
      id: "no-ability",
      name: "No Ability",
      description: "Karta nie posiada zdolności."
    },

    {
      id: "objective",
      name: "Objective",
      description: "Karta posiada cel lub specjalny warunek realizowany podczas gry."
    },

    {
      id: "on-reveal",
      name: "On Reveal",
      description: "Karta posiada efekt On Reveal."
    },

    {
      id: "ongoing",
      name: "Ongoing",
      description: "Karta posiada efekt Ongoing albo przejmuje tekst efektu Ongoing."
    },

    {
      id: "quickdraw",
      name: "Quick Draw",
      description: "Karta posiada zdolność Quick Draw."
    },

    {
      id: "startofturn",
      name: "Start of Turn",
      description: "Efekt karty aktywuje się na początku tury."
    },

    {
      id: "trigger-card",
      name: "Trigger Card",
      description: "Zdolność reaguje na określone wydarzenie albo warunek, na przykład zagranie, przesunięcie, zniszczenie lub zmianę stanu karty."
    }
  ],

  mechanicFamilies: [
    {
      id: "afflict",
      name: "Afflict",
      description: "Rodzina oparta na bezpośrednim obniżaniu Power kart oraz efektach, które rozpoznają, wykorzystują, wzmacniają albo kontrują takie osłabienia."
    },
    {
      id: "bounce",
      name: "Bounce",
      description: "Rodzina oparta na zwracaniu istniejących kart z planszy do ręki, ponownym ich zagrywaniu oraz efektach bezpośrednio reagujących na tę pętlę."
    },
    {
      id: "buff",
      name: "Buff",
      description: "Rodzina permanentnego zwiększania Power innych kart oraz efektów, które bezpośrednio payoffują zwiększony Power albo których własna zdolność bezpośrednio przetwarza aktualny Power karty — na przykład przekazuje, kopiuje lub mnoży tę wartość. Sam zwykły Self Buff ani luźna synergia deckowa nie wystarcza do otrzymania taga."
    },
    {
      id: "card-generation",
      name: "Card Generation",
      description: "Rodzina tworzenia nowych egzemplarzy kart w ręce, talii albo na planszy oraz efektów bezpośrednio rozpoznających lub payoffujących karty stworzone podczas gry albo karty, które nie rozpoczęły gry w talii."
    },
    {
      id: "clog",
      name: "Clog",
      description: "Rodzina oparta na zajmowaniu przestrzeni przeciwnika, dokładaniu mu niepożądanych kart, ograniczaniu dostępnych slotów oraz bezpośrednim wykorzystywaniu zapchanego boardu."
    },
    {
      id: "cost",
      name: "Cost",
      description: "Rodzina bezpośredniej manipulacji Costem kart: jego obniżania, zwiększania, ustawiania, ochrony przed zmianą oraz efektów bezpośrednio reagujących na zmianę Costu. Samo używanie Costu jako kryterium nie wystarcza do otrzymania taga."
    },
    {
      id: "destroy",
      name: "Destroy",
      description: "Rodzina mechaniki Destroy: kart bezpośrednio niszczących, reagujących na zniszczenie, wymagających go, korzystających z liczby zniszczeń albo w inny sposób bezpośrednio uczestniczących w tym ekosystemie."
    },
    {
      id: "discard",
      name: "Discard",
      description: "Rodzina mechaniki Discard: kart bezpośrednio odrzucających, reagujących na odrzucenie, wymagających go, wracających dzięki niemu albo payoffujących liczbę i historię odrzuceń."
    },
    {
      id: "disruption",
      name: "Disruption",
      description: "Funkcjonalna rodzina kart, które bezpośrednio utrudniają przeciwnikowi realizację planu przez ingerowanie w jego rękę, talię, teksty, pozycje, koszty, możliwość zagrywania, ujawniania lub dostęp do zasobów."
    },
    {
      id: "downside",
      name: "Downside",
      description: "Rodzina kart posiadających realny negatywny efekt, koszt lub ograniczenie oraz kart bezpośrednio zaprojektowanych do usuwania, obchodzenia albo wykorzystywania takich wad. Zwykły warunek otrzymania bonusu nie jest sam w sobie Downside."
    },
    {
      id: "energy",
      name: "Energy",
      description: "Rodzina kart, których tekst bezpośrednio manipuluje Energy lub Max Energy albo reaguje na ilość, przyrost, utratę, wydanie lub niewydanie Energy. Nie obejmuje kart cheatowanych do gry bez bezpośredniej relacji z Energy."
    },
    {
      id: "merge",
      name: "Merge",
      description: "Rodzina oparta na mechanice Merge oraz efektach bezpośrednio łączących karty, pracujących ze scalonymi jednostkami lub payoffujących ten stan."
    },
    {
      id: "move",
      name: "Move",
      description: "Rodzina mechaniki Move: kart przesuwających własne lub wrogie karty oraz efektów bezpośrednio reagujących na ruch, umożliwiających go albo payoffujących przesunięcia."
    },
    {
      id: "spells",
      name: "Spells",
      description: "Rodzina kart będących Spellami, tworzących Spelle albo bezpośrednio wspierających, rozpoznających lub payoffujących ich zagrywanie i działanie."
    },
    {
      id: "tech",
      name: "Tech",
      description: "Funkcjonalna rodzina kart będących odpowiedzią, zabezpieczeniem lub kontrą na określony stan, mechanikę, typ zdolności, klasę zagrożeń albo plan przeciwnika. Tech odpowiada na problem; nie oznacza każdej karty utrudniającej grę rywala."
    },
    {
      id: "zombie-horde",
      name: "Zombie Horde",
      description: "Rodzina mechaniki Horde: tworzenia, rozwijania, wzmacniania i payoffowania Hordy oraz bezpośrednich supportów tego systemu. Nie obejmuje automatycznie każdej karty będącej Zombie."
    }
  ],

  subtypes: [
    {
      id: "board-generator",
      name: "Board Generator",
      description: "Tworzy nowy egzemplarz karty bezpośrednio na planszy. Obejmuje tokeny, losowe karty, kopie i klony oraz nowe karty zastępujące zniszczony egzemplarz. Nie obejmuje przenoszenia istniejących kart z innych stref — te należą do Summon."
    },
    {
      id: "card-copy",
      name: "Card Copy",
      description: "Tworzy nowy pełny egzemplarz istniejącej karty w ręce, talii lub na planszy, kopiuje samą siebie albo staje się pełną kopią innej karty. Nie obejmuje kopiowania wyłącznie tekstu, Power ani samej zdolności."
    },
    {
      id: "cost-reduction",
      name: "Cost Reduction",
      description: "Bezpośrednio obniża lub może obniżyć własny Cost albo Cost innych kart. Nie obejmuje zwykłego ustawienia Costu, jeżeli istotą efektu nie jest redukcja."
    },
    {
      id: "deck-generator",
      name: "Deck Generator",
      description: "Tworzy nowy egzemplarz karty bezpośrednio w talii własnej albo przeciwnika. Obejmuje tasowanie nowych kart, tokenów, kopii i losowych kart do talii oraz przekształcanie kart w talii w nowe egzemplarze."
    },
    {
      id: "double-power",
      name: "Double Power",
      description: "Bezpośrednio podwaja Power własną albo innej konkretnej karty. Nie obejmuje podwajania całkowitej Power lokacji ani ogólnych mnożników wyniku lokacji."
    },
    {
      id: "draw",
      name: "Draw",
      description: "Przenosi istniejącą kartę z talii własnej albo przeciwnika do ręki lub bezpośrednio manipuluje tym, jaka karta i kiedy zostanie dobrana."
    },
    {
      id: "delayed-reveal",
      name: "Delayed Reveal",
      description: "Bezpośrednio opóźnia ujawnienie własnych albo innych kart albo umieszcza karty bez ujawnienia, aby zostały ujawnione później."
    },
    {
      id: "effect-multiplier",
      name: "Effect Multiplier",
      description: "Kopiuje, powtarza, podwaja lub wzmacnia działanie zdolności, efektów kart albo efektów lokacji. Obejmuje także stałe karty potomne wykonujące taką funkcję."
    },
    {
      id: "give-power",
      name: "Give Power",
      description: "Bezpośrednio i trwale zwiększa Power innej karty albo grupy kart. Nie obejmuje zwiększania wyłącznie własnej Power, ciągłych bonusów Ongoing, Set Power ani samych efektów Location Points."
    },
    {
      id: "hand-gen",
      name: "Hand Generation",
      description: "Tworzy nowy egzemplarz karty bezpośrednio w ręce własnej albo przeciwnika. Nie obejmuje Draw, Bounce ani odzyskiwania istniejących kart."
    },
    {
      id: "multi-location-power",
      name: "Multi-Location Power",
      description: "Zwiększa, dostarcza albo rozdziela naszą efektywną Power pomiędzy co najmniej dwie lokacje. Opisuje zasięg działania, niezależnie od tego, czy źródłem jest karta, aura czy bezpośredni efekt lokacji."
    },
    {
      id: "scaler",
      name: "Power Scaler",
      description: "Własna Power karty może wielokrotnie rosnąć dzięki powtarzalnym efektom, kolejnym zdarzeniom albo gromadzonemu progresowi. Nie obejmuje jednorazowych burstowych bonusów ani wartości zależnych wyłącznie od bieżącego stanu."
    },
    {
      id: "self-buff",
      name: "Self Buff",
      description: "Karta ma bezpośredni dostęp do zamkniętego, jednorazowego albo burstowego permanentnego zwiększenia własnej Power. Nie obejmuje naturalnego, powtarzalnego skalowania — ono należy do Power Scaler."
    },
    {
      id: "set-power",
      name: "Set Power",
      description: "Bezpośrednio ustawia albo resetuje Power własną lub innej karty do konkretnej wartości, wartości bazowej albo wartości wyznaczonej przez inny parametr. Nie obejmuje zwykłego dodawania lub odejmowania Power."
    },
    {
      id: "revive",
      name: "Revive",
      description: "Przywraca siebie albo inną istniejącą kartę po jej odrzuceniu, zniszczeniu lub trafieniu do innej utraconej strefy. Nie obejmuje zwykłego Bounce ani tworzenia nowej kopii."
    },
    {
      id: "summon",
      name: "Summon",
      description: "Umieszcza istniejący egzemplarz karty z ręki, talii, discardu, stosu zniszczonych albo innej strefy bezpośrednio na planszy bez normalnego zagrania."
    },
    {
      id: "transform",
      name: "Transform",
      description: "Bezpośrednio zmienia siebie albo inną istniejącą kartę w inną kartę, pełną kopię karty lub określoną alternatywną formę."
    },
    {
      id: "unique-card-creation",
      name: "Unique Card Creation",
      description: "Tworzy konkretną unikalną kartę albo zamknięty zestaw kart niedostępnych jako zwykłe karty kolekcjonerskie."
    },
    {
      id: "random-card-pool",
      name: "Random Card Pool",
      description: "Losowo wybiera tożsamość karty albo tekst zdolności z szerokiej lub zewnętrznej puli istniejących kart, a następnie tworzy, kopiuje, przyjmuje, zastępuje lub transformuje kartę według tego wyniku."
    },
    {
      id: "text-copy",
      name: "Text Copy",
      description: "Bezpośrednio kopiuje tekst zdolności innej karty na siebie albo na inną kartę. Nie obejmuje kopiowania całej karty ani samego powtarzania zdolności bez przejęcia tekstu."
    },
    {
      id: "text-disruption",
      name: "Text Disruption",
      description: "Destrukcyjnie ingeruje w tekst istniejącej karty przez usunięcie, wyłączenie, kradzież albo zastąpienie tekstu lub zdolności. Nie obejmuje samego blokowania wykonania bez zmiany tekstu."
    },
    {
      id: "power-steal",
      name: "Power Steal",
      description: "Bezpośrednio odbiera Power jednej lub kilku istniejącym kartom i przekazuje odpowiadającą jej wartość sobie albo wskazanej własnej karcie."
    },
    {
      id: "row-interaction",
      name: "Row Interaction",
      description: "Zdolność bezpośrednio zależy od położenia kart w front row lub back row, zapełnienia określonego rzędu albo relacji między kartami stojącymi przed i za sobą."
    },
    {
      id: "full-location",
      name: "Full Location",
      description: "Efekt bezpośrednio uruchamia się, zmienia, skaluje albo zostaje wyłączony wskutek zapełnienia jednej lub obu stron lokacji."
    },
    {
      id: "play-requirement",
      name: "Play Requirement",
      description: "Charakterystyczna zdolność, Cost albo możliwość zagrania wymaga określonego sposobu lub liczby zagrań, niezagrania karty albo spełnienia konkretnego warunku zagrywania."
    },
    {
      id: "unspent-energy",
      name: "Unspent Energy",
      description: "Bezpośrednio sprawdza, wykorzystuje albo reaguje na niewydaną Energy własną lub przeciwnika, jej liczbę albo wcześniejsze tury zakończone z niewydaną Energy."
    },
    {
      id: "winning",
      name: "Winning",
      description: "Mechanika bezpośrednio sprawdza stan wygrywania lub przegrywania lokacji, reaguje na niego albo wykorzystuje go jako warunek efektu."
    },
    {
      id: "power-aura",
      name: "Power Aura",
      description: "Zapewnia innym kartom ciągły, niepermanentny bonus Power tak długo, jak działa zdolność źródłowa, najczęściej Ongoing. Nie obejmuje trwałego Give Power ani bezpośrednich Location Points."
    },
    {
      id: "location-control",
      name: "Location Control",
      description: "Bezpośrednio tworzy, zmienia, zastępuje, przesuwa, wyłącza albo w inny sposób ingeruje w samą lokację. Nie obejmuje wyłącznie zmiany wyniku Power lokacji."
    },
    {
      id: "location-points",
      name: "Location Points",
      description: "Bezpośrednio dodaje, odejmuje, mnoży, rozdziela albo ustawia wynik Power lokacji bez trwałej zmiany Power konkretnych kart znajdujących się w tej lokacji."
    },
    {
      id: "banish",
      name: "Banish",
      description: "Bezpośrednio usuwa kartę z gry mechaniką Banish. Banish jest odrębne od Destroy i nie liczy się jako zniszczenie, chyba że tekst konkretnego efektu stanowi inaczej."
    },
    {
      id: "set-cost",
      name: "Set Cost",
      description: "Bezpośrednio ustawia Cost karty lub grupy kart na określoną wartość albo wyznacza go według innego parametru. Nie obejmuje zwykłej redukcji lub zwiększenia Costu."
    },
    {
      id: "cost-increase",
      name: "Cost Increase",
      description: "Bezpośrednio zwiększa Cost własnej lub cudzej karty albo grupy kart. Nie obejmuje ustawienia Costu na stałą wartość ani samego blokowania redukcji."
    }
  ],

  deckArchetypes: [
    {
      id: "highevo",
      name: "High Evolutionary",
      description: "Archetyp decków zbudowanych wokół High Evolutionary, odblokowanych zdolności kart bez tekstu oraz ich charakterystycznych synergii."
    },
    {
      id: "mill",
      name: "Mill",
      description: "Archetyp decków celowo odbierających przeciwnikowi zasoby z talii, przejmujących je albo ograniczających jego przyszłe drawy przy użyciu charakterystycznego pakietu Mill."
    },
    {
      id: "no-ability-buff",
      name: "No-Ability Buff",
      description: "Archetyp decków skupionych na kartach bez zdolności, generatorach takich jednostek oraz payoffach wzmacniających No Ability, szczególnie w pakietach Patriot/Ultron i pokrewnych."
    },
    {
      id: "wongreveal",
      name: "Wong / On Reveal Combo",
      description: "Archetyp decków combo opartych na wielokrotnym uruchamianiu, kopiowaniu lub ponawianiu efektów On Reveal oraz payoffach szczególnie korzystających z ich powielania."
    },
    {
      id: "zoo",
      name: "Zoo",
      description: "Archetyp oparty na zalewaniu planszy tanimi kartami, szczególnie 1-Costami i generatorami małych jednostek, oraz supportach i finisherach nagradzających szeroki board."
    },
    {
      id: "end-of-turn-combo",
      name: "End of Turn Combo",
      description: "Archetyp decków budowanych wokół wielu zdolności End of Turn, ich powtarzania, wzmacniania i charakterystycznych payoffów."
    },
    {
      id: "mister-negative",
      name: "Mister Negative",
      description: "Archetyp decków zbudowanych wokół Mister Negative, wcześniejszego uruchamiania jego zdolności oraz wykorzystywania kart, które po manipulacji Costem i Power stają się wyjątkowo wydajne."
    },
    {
      id: "lockdown",
      name: "Lockdown",
      description: "Archetyp decków ograniczających przestrzeń i możliwości zagrywania kart przez zamykanie lokacji, miękkie blokady oraz supporty obchodzące te ograniczenia lub dostarczające Power do niedostępnych miejsc."
    },
    {
      id: "scream",
      name: "Scream / Opponent Move",
      description: "Archetyp decków opartych na przymusowym przesuwaniu kart przeciwnika, karaniu ich za ruch, kontroli pozycji i payoffach zależnych od przesunięć wrogich kart."
    },
    {
      id: "mini-movers",
      name: "Mini Movers",
      description: "Archetyp Move oparty na elastycznym przesuwaniu wielu mniejszych kart, rozkładaniu Power między lokacjami i payoffach takich jak Kraven, Hydra Stomper czy Batroc zamiast jednego głównego skalera."
    },
    {
      id: "prio-control",
      name: "Prio Control",
      description: "Grupa decków budujących i utrzymujących priority przez efektywne statystyki i tempo, a następnie wykorzystujących reaktywne Tech, Disruption i narzędzia kontrolne szczególnie skuteczne przy prowadzeniu na planszy."
    },
    {
      id: "midrange-control",
      name: "Midrange Control",
      description: "Szersza grupa decków łączących wydajne karty value/tempo z pakietami Tech, Disruption i reaktywną kontrolą, bez konieczności budowania całego planu wokół jednej mechaniki lub priority."
    },
    {
      id: "aurora",
      name: "Aurora",
      description: "Archetyp decków budowanych wokół Aurory, różnorodnych typów zdolności oraz elastycznych supportów rozdzielających wartość i Power między lokacjami."
    },
    {
      id: "arishem-thanos",
      name: "Arishem / Thanos",
      description: "Archetyp i pakiet łączący charakterystyczne narzędzia Arishema i/lub Thanosa, dodatkowe zasoby, karty spoza startowej talii, Stones i payoffy tych planów."
    },
    {
      id: "hammer-bros",
      name: "Hammer Bros",
      description: "Pakiet deckbuildingowy zbudowany wokół Thora, Beta Ray Billa, ich młotów oraz narzędzi dobierania, przyzywania i ponownego uruchamiania efektów tych kart."
    },
    {
      id: "fantomex",
      name: "Fantomex",
      description: "Hybrydowy archetyp Destroy–Discard zbudowany wokół Fantomexa oraz kart łączących odrzucanie, niszczenie, odzyskiwanie zasobów i payoffy obu mechanik."
    },
    {
      id: "skaar",
      name: "Skaar",
      description: "Archetyp decków opartych na wystawianiu wielu kart o bardzo wysokiej Power, obniżaniu Costu Skaara oraz charakterystycznych dużych jednostkach i supportach planu 10+ Power."
    },
    {
      id: "zombie-galacti",
      name: "Zombie Galacti",
      description: "Archetyp decków zbudowanych wokół Zombie Galacti i charakterystycznego sposobu przekształcania lub rozwijania talii oraz supportów jego planu."
    },
    {
      id: "werewolf-sentry",
      name: "Werewolf / Sentry",
      description: "Archetyp i pakiet oparty na Werewolfie, pakiecie The Hood–Sentry–Annihilus oraz elastycznych narzędziach generowania wartości, bounce i kontroli planszy."
    },
    {
      id: "surfer-buff",
      name: "Surfer / Buff",
      description: "Archetyp decków opartych na Silver Surferze i szerszym pakiecie buffowania kart za 3, łączący charakterystyczne enablery, payoffy i supporty zwiększające Power tej puli."
    },
    {
      id: "classic-destroy",
      name: "Classic Destroy",
      description: "Klasyczny archetyp Destroy oparty na wydajnym niszczeniu własnych kart, powtarzalnych celach do zniszczenia i payoffach takich jak Venom, Death czy Knull."
    },
    {
      id: "destroy-combo",
      name: "Destroy Combo",
      description: "Bardziej kombinacyjna rodzina decków Destroy wykorzystująca linie Nimrod/Phoenix Force, wzmacnianie konkretnych celów, niszczenie ich w odpowiednim momencie, odradzanie i powielanie wartości."
    },
    {
      id: "move-combo",
      name: "Move Combo",
      description: "Greedy archetyp Move oparty na wielokrotnym przesuwaniu i skalowaniu kluczowych payoffów takich jak Human Torch czy Dagger oraz na dużych sekwencjach ruchu i finisherach."
    },
    {
      id: "ramp",
      name: "Ramp",
      description: "Archetyp decków obchodzących standardową krzywą przez dodatkową Energy, Cost manipulation, Summon lub inne formy cheatowania drogich kart oraz charakterystyczne duże payoffy."
    },
    {
      id: "victoria-hand-big-hand",
      name: "Victoria Hand / Big Hand",
      description: "Archetyp decków łączących created cards i generowanie ręki z payoffami za dużą lub pełną rękę, zbudowany wokół Victorii Hand oraz charakterystycznych generatorów, supportów i finisherów Big Hand."
    },
    {
      id: "small-buff",
      name: "Small Buff",
      description: "Archetyp i pakiet oparty na wielu małych, powtarzalnych permanentnych buffach oraz payoffach zwiększających wartość częstych niewielkich wzmocnień, łączący dotychczasowy shell Shou-Lao z planem Venus."
    },
    {
      id: "spectrum-ongoing",
      name: "Spectrum Ongoing",
      description: "Midrange’owy archetyp Ongoing oparty na szerokim boardzie trwałych efektów Ongoing, ich statystycznej wartości oraz payoffach takich jak Spectrum."
    },
    {
      id: "tribunal-ongoing",
      name: "Tribunal Ongoing",
      description: "Combo archetyp Ongoing oparty na kumulowaniu i mnożeniu Power przy użyciu kart takich jak Iron Man, Onslaught i Living Tribunal oraz na narzędziach składających tę linię combo."
    },
    {
      id: "doom-2099",
      name: "Doom 2099",
      description: "Archetyp decków zbudowanych wokół Doom 2099, charakterystycznej krzywej i planu ograniczającego liczbę zagrań na turę w celu regularnego tworzenia DoomBotów i skalowania boardu."
    },
    {
      id: "cerebro",
      name: "Cerebro",
      description: "Rodzina decków zbudowanych wokół Cerebro i utrzymywania wspólnej docelowej Power wielu kart, wraz z charakterystycznymi enablerami, korektami Power i payoffami tego planu."
    },
    {
      id: "galactus",
      name: "Galactus",
      description: "Archetyp i pakiet zbudowany wokół Galactusa oraz narzędzi przygotowujących jego warunek, kontrolujących board i wykorzystujących stan gry po zniszczeniu pozostałych lokacji."
    },
    {
      id: "darkhawk-ronan",
      name: "Darkhawk / Ronan",
      description: "Charakterystyczny pakiet wokół Darkhawka i Ronana, łączący dokładanie kart do talii lub ręki przeciwnika z payoffami za powiększanie jego zasobów i ograniczanie jakości drawów."
    },
    {
      id: "sauron-skaar",
      name: "Sauron / Skaar",
      description: "Archetyp dużych statsticków i kart z Downside, łączący Saurona, Skaara oraz narzędzia do obchodzenia negatywnego tekstu z payoffami za wystawianie bardzo wysokiej Power."
    }
  ],

  teams: [
    {
      id: "annihilators",
      name: "Annihilators",
      description: "Najpotężniejsi kosmiczni bohaterowie należący do drużyny Annihilators."
    },
    {
      id: "celestial-eternals",
      name: "Celestials & Eternals",
      description: "Celestials oraz stworzeni przez nich Eternals, połączeni w jedną kosmiczną afiliację."
    },
    {
      id: "atlanteans",
      name: "Atlanteans",
      description: "Postacie należące do Atlantydy i jej atlantydzkiej społeczności."
    },
    {
      id: "agents-of-atlas",
      name: "Agents of Atlas",
      description: "Członkowie klasycznych i współczesnych inkarnacji Agents of Atlas."
    },
    {
      id: "x-force",
      name: "X-Force",
      description: "Najważniejsi i długoterminowi członkowie różnych inkarnacji X-Force."
    },
    {
      id: "new-mutants",
      name: "New Mutants",
      description: "Najważniejsi i długoterminowi członkowie drużyny New Mutants."
    },
    {
      id: "new-avengers",
      name: "New Avengers",
      description: "Najważniejsi członkowie oryginalnej oraz podziemnej inkarnacji New Avengers."
    },
    {
      id: "west-coast-avengers",
      name: "West Coast Avengers",
      description: "Najważniejsi członkowie klasycznych i współczesnych inkarnacji West Coast Avengers."
    },
    {
      id: "cabal",
      name: "Cabal",
      description: "Członkowie tajnej rady złoczyńców utworzonej przez Normana Osborna podczas Dark Reign."
    },
    {
      id: "illuminati",
      name: "Illuminati",
      description: "Członkowie tajnej rady najpotężniejszych i najbardziej wpływowych bohaterów Marvela."
    },
    {
      id: "dark-avengers",
      name: "Dark Avengers",
      description: "Norman Osborn i członkowie jego rządowej drużyny złoczyńców podszywających się pod Avengers."
    },
    {
      id: "brotherhood",
      name: "Brotherhood of Mutants",
      description: "Najważniejsi i wieloletni członkowie różnych inkarnacji Brotherhood of Mutants."
    },
    {
      id: "hellfire-club",
      name: "Hellfire Club",
      description: "Najważniejsi i długoterminowi członkowie Hellfire Club oraz jego Inner Circle."
    },
    {
      id: "horsemen",
      name: "Horsemen of Apocalypse",
      description: "Apocalypse, En Sabah Nur oraz postacie przedstawione jako jego Jeźdźcy Apokalipsy."
    },
    {
      id: "hydra",
      name: "Hydra",
      description: "Liderzy, agenci i najważniejsi członkowie organizacji Hydra."
    },
    {
      id: "heroes-for-hire",
      name: "Heroes for Hire",
      description: "Stali i najbardziej rozpoznawalni członkowie organizacji Heroes for Hire."
    },
    {
      id: "marvel-knights",
      name: "Marvel Knights",
      description: "Członkowie ulicznego sojuszu Marvel Knights działającego przeciwko przestępczości i zagrożeniom miejskim."
    },
    {
      id: "future-foundation",
      name: "Future Foundation",
      description: "Członkowie i najważniejsi współpracownicy organizacji Future Foundation związanej z Fantastyczną Czwórką."
    },
    {
      id: "defenders",
      name: "Defenders",
      description: "Członkowie klasycznych i ulicznych inkarnacji drużyny Defenders."
    },
    {
      id: "wakanda",
      name: "Wakanda",
      description: "Postacie należące do Wakandy oraz najważniejsze osoby i bóstwa związane z jej historią, kulturą i władzą."
    },
    {
      id: "black-order",
      name: "Black Order",
      description: "Thanos oraz członkowie elitarnej kosmicznej organizacji Black Order."
    },
    {
      id: "asgardians",
      name: "Asgardians",
      description: "Bogowie, mieszkańcy i bohaterowie związani z Asgardem."
    },

    {
      id: "avengers",
      name: "Avengers",
      description: "Członkowie Avengers."
    }
,

    {
      id: "fantastic4",
      name: "Fantastic Four",
      description: "Członkowie Fantastic Four."
    },

    {
      id: "guardians",
      name: "Guardians of the Galaxy",
      description: "Członkowie Guardians of the Galaxy."
    },

    {
      id: "inhumans",
      name: "Inhumans",
      description: "Członkowie Inhumans."
    },

    {
      id: "midnight-sons",
      name: "Midnight Sons",
      description: "Członkowie Midnight Sons."
    },

    {
      id: "shield",
      name: "S.H.I.E.L.D.",
      description: "Agenci i członkowie organizacji S.H.I.E.L.D."
    },

    {
      id: "sinister-six",
      name: "Sinister Six",
      description: "Członkowie Sinister Six."
    },

    {
      id: "spider-verse",
      name: "Spider-Verse",
      description: "Postacie należące do uniwersum Spider-Mana."
    },

    {
      id: "symbiotes",
      name: "Symbiotes",
      description: "Symbionty oraz postacie bezpośrednio z nimi związane."
    },

    {
      id: "thunderbolts",
      name: "Thunderbolts",
      description: "Członkowie Thunderbolts."
    },

    {
      id: "xmen",
      name: "X-Men",
      description: "Członkowie X-Men."
    },

    {
      id: "young-avengers",
      name: "Young Avengers",
      description: "Członkowie Young Avengers."
    }
  ],

  themes: [

    {
      id: "animals",
      name: "Animals",
      description: "Faktyczne zwierzęta, antropomorficzne zwierzęta oraz jednoznacznie zwierzęce istoty."
    }


,

    {
      id: "monsters",
      name: "Monsters",
      description: "Potwory."
    }
,

    {
      id: "robots-cyborgs",
      name: "Robots & Cyborgs",
      description: "Roboty, androidy, synthezoidy oraz postacie trwale połączone z cybernetyką, dla których mechaniczne ciało lub części są kluczowym elementem tożsamości. Nie obejmuje zwykłych użytkowników zbroi, mechów ani technologicznego wyposażenia."
    }

,

    {
      id: "antiheroes",
      name: "Antiheroes",
      description: "Postacie działające po stronie dobra lub jako protagoniści, ale stosujące moralnie szare, brutalne albo przestępcze metody."
    }

,

    {
      id: "villains",
      name: "Villains",
      description: "Złoczyńcy."
    }

  ,

    {
      id: "magicians",
      name: "Magicians",
      description: "Magowie, czarownicy, wiedźmy oraz postacie aktywnie używające magii i mistycznych mocy."
    },

    {
      id: "cosmic-entities",
      name: "Cosmic Entities",
      description: "Kosmiczne byty, abstrakty i istoty o ponadludzkiej, uniwersalnej lub międzywymiarowej skali mocy."
    }
,

    {
      id: "geniuses",
      name: "Geniuses",
      description: "Wybitni naukowcy, wynalazcy, konstruktorzy i strategiczni geniusze, których intelekt jest jedną z głównych cech postaci."
    }
,

    {
      id: "animal-themed",
      name: "Animal-Themed",
      description: "Postacie niebędące faktycznymi zwierzętami, ale wyraźnie nawiązujące do istniejącego zwierzęcia przez nazwę, wygląd, kostium, moce albo motyw."
    },

    {
      id: "zombies",
      name: "Zombies",
      description: "Karty będące fabularnie lub wizualnie Zombie. Tag tematyczny jest niezależny od mechanicznej rodziny Zombie Horde — karta Zombie nie musi mechanicznie korzystać z Horde."
    },
    {
      id: "fractured-frontier",
      name: "Fractured Frontier",
      description: "Postacie i wersje kart pochodzące z Earth-383, oficjalnego kosmiczno-westernowego uniwersum Fractured Frontier stworzonego dla MARVEL SNAP."
    }
  ],

  special: [
    {
      id: "featured",
      name: "Featured",
      description: "Karty wyróżnione."
    },

    {
      id: "wind1",
      name: "Winning Draft 1",
      description: "Karta znajdowała się w zwycięskim decku Draftu 1."
    },

    {
      id: "wind2",
      name: "Winning Draft 2",
      description: "Karta znajdowała się w zwycięskim decku Draftu 2."
    },

    {
      id: "wind3",
      name: "Winning Draft 3",
      description: "Karta znajdowała się w zwycięskim decku Draftu 3."
    },

    {
      id: "wind4",
      name: "Winning Draft 4",
      description: "Karta znajdowała się w zwycięskim decku Draftu 4."
    },

    {
      id: "wind5",
      name: "Winning Draft 5",
      description: "Karta znajdowała się w zwycięskim decku Draftu 5."
    },

    {
      id: "wind6",
      name: "Winning Draft 6",
      description: "Karta znajdowała się w zwycięskim decku Draftu 6."
    },

    {
      id: "wind7",
      name: "Winning Draft 7",
      description: "Karta znajdowała się w zwycięskim decku Draftu 7."
    },

    {
      id: "wind8",
      name: "Winning Draft 8",
      description: "Karta znajdowała się w zwycięskim decku Draftu 8."
    },

    {
      id: "wind9",
      name: "Winning Draft 9",
      description: "Karta znajdowała się w zwycięskim decku Draftu 9."
    },

    {
      id: "wind10",
      name: "Winning Draft 10",
      description: "Karta znajdowała się w zwycięskim decku Draftu 10."
    },

    {
      id: "wind11",
      name: "Winning Draft 11",
      description: "Karta znajdowała się w zwycięskim decku Draftu 11."
    },

    {
      id: "wind12",
      name: "Winning Draft 12",
      description: "Karta znajdowała się w zwycięskim decku Draftu 12."
    },

    {
      id: "wind13",
      name: "Winning Draft 13",
      description: "Karta znajdowała się w zwycięskim decku Draftu 13."
    },

    {
      id: "wind14",
      name: "Winning Draft 14",
      description: "Karta znajdowała się w zwycięskim decku Draftu 14."
    },

    {
      id: "wind15",
      name: "Winning Draft 15",
      description: "Karta znajdowała się w zwycięskim decku Draftu 15."
    },

    {
      id: "wind16",
      name: "Winning Draft 16",
      description: "Karta znajdowała się w zwycięskim decku Draftu 16."
    },

    {
      id: "wind17",
      name: "Winning Draft 17",
      description: "Karta znajdowała się w zwycięskim decku Draftu 17."
    },

    {
      id: "wind18",
      name: "Winning Draft 18",
      description: "Karta znajdowała się w zwycięskim decku Draftu 18."
    },

    {
      id: "wind19",
      name: "Winning Draft 19",
      description: "Karta znajdowała się w zwycięskim decku Draftu 19."
    },

    {
      id: "wind20",
      name: "Draft 20",
      description: "Karta powiązana z Draftem 20."
    },

    {
      id: "wind21",
      name: "Draft 21",
      description: "Karta powiązana z Draftem 21."
    },

    {
      id: "wind22",
      name: "Draft 22",
      description: "Karta powiązana z Draftem 22."
    },

    {
      id: "wind23",
      name: "Draft 23",
      description: "Karta powiązana z Draftem 23."
    },

    {
      id: "wind24",
      name: "Draft 24",
      description: "Karta powiązana z Draftem 24."
    },

    {
      id: "wind25",
      name: "Draft 25",
      description: "Karta powiązana z Draftem 25."
    },

    {
      id: "wind26",
      name: "Draft 26",
      description: "Karta powiązana z Draftem 26."
    }
  ]

};
